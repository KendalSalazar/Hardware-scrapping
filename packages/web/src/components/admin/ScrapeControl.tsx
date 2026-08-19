'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ApiClientError,
  fetchScrapeRunById,
  fetchScrapeRuns,
  startRamScrape,
  stopRamScrape,
} from '@/lib/api-client';
import type { ScrapeRunDto } from '@/types/api';
import { ScrapeRunsTable } from './ScrapeRunsTable';

const POLL_MS = 4000;
const RUNNING_FRESH_MS = 3 * 60 * 60 * 1000;

function isTerminal(status: string): boolean {
  return status === 'success' || status === 'partial' || status === 'failed';
}

function isFreshRunning(run: ScrapeRunDto): boolean {
  return (
    run.status === 'running' &&
    Date.now() - new Date(run.startedAt).getTime() <= RUNNING_FRESH_MS
  );
}

export function ScrapeControl() {
  const [activeRun, setActiveRun] = useState<ScrapeRunDto | null>(null);
  const [history, setHistory] = useState<ScrapeRunDto[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);
  const [stopping, setStopping] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const refreshHistory = useCallback(async () => {
    const result = await fetchScrapeRuns();
    setHistory(result.runs);
    return result.runs;
  }, []);

  const stopPolling = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }, []);

  const startPolling = useCallback(
    (runId: number) => {
      stopPolling();
      pollRef.current = setInterval(async () => {
        try {
          const run = await fetchScrapeRunById(runId);
          setActiveRun(run);
          if (isTerminal(run.status)) {
            stopPolling();
            setMessage(
              run.status === 'success'
                ? `Corrida #${run.id} finalizada con éxito (${run.productsFound} productos).`
                : `Corrida #${run.id} finalizó con estado ${run.status}.`,
            );
            await refreshHistory();
          }
        } catch (pollError) {
          stopPolling();
          setError(
            pollError instanceof ApiClientError
              ? pollError.message
              : 'Error al consultar progreso',
          );
        }
      }, POLL_MS);
    },
    [refreshHistory, stopPolling],
  );

  useEffect(() => {
    void refreshHistory()
      .then((runs) => {
        const running = runs.find(isFreshRunning);
        if (running) {
          setActiveRun(running);
          startPolling(running.id);
        }
      })
      .catch((loadError) => {
        setError(loadError instanceof ApiClientError ? loadError.message : 'Error al cargar historial');
      });

    return stopPolling;
  }, [refreshHistory, startPolling, stopPolling]);

  async function onStart(): Promise<void> {
    setError(null);
    setMessage(null);
    setStarting(true);
    try {
      const result = await startRamScrape();
      setActiveRun(result.run);
      setMessage(`Corrida #${result.run.id} iniciada.`);
      startPolling(result.run.id);
      await refreshHistory();
    } catch (startError) {
      if (startError instanceof ApiClientError && startError.code === 'SCRAPE_ALREADY_RUNNING') {
        setError(startError.message);
        const runs = await refreshHistory();
        const running = runs.find(isFreshRunning);
        if (running) {
          setActiveRun(running);
          startPolling(running.id);
        }
      } else {
        setError(startError instanceof ApiClientError ? startError.message : 'No se pudo iniciar el scrape');
      }
    } finally {
      setStarting(false);
    }
  }

  async function onStop(): Promise<void> {
    if (!activeRun || activeRun.status !== 'running') return;

    setError(null);
    setMessage(null);
    setStopping(true);
    stopPolling();
    try {
      const result = await stopRamScrape(activeRun.id);
      setActiveRun(result.run);
      await refreshHistory();
      setMessage(`Corrida #${result.run.id} detenida.`);
    } catch (stopError) {
      setError(stopError instanceof ApiClientError ? stopError.message : 'No se pudo detener la corrida');
      startPolling(activeRun.id);
    } finally {
      setStopping(false);
    }
  }

  const busy = starting || activeRun?.status === 'running';

  return (
    <div className="flex flex-col gap-6">
      <section className="rounded-lg border border-slate-200 bg-white p-4">
        <h2 className="mb-2 text-lg font-semibold">Scraping RAM</h2>
        <p className="mb-4 text-sm text-slate-600">
          El proceso corre en el servidor; cerrar esta pestaña no lo detiene.
        </p>
        <button
          type="button"
          onClick={() => void onStart()}
          disabled={busy}
          className="rounded bg-emerald-700 px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-60"
        >
          {busy ? 'Scraping en progreso...' : 'Iniciar scraping de RAM'}
        </button>
        {activeRun?.status === 'running' ? (
          <button
            type="button"
            onClick={() => void onStop()}
            disabled={stopping}
            className="ml-2 rounded bg-red-700 px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
          >
            {stopping ? 'Deteniendo...' : 'Detener scraping'}
          </button>
        ) : null}

        {activeRun ? (
          <div className="mt-4 rounded bg-slate-50 p-3 text-sm">
            <p>
              <span className="font-medium">Run #{activeRun.id}</span> — estado:{' '}
              <span className="font-mono">{activeRun.status}</span>
            </p>
            <p className="mt-1">
              Productos procesados: <strong>{activeRun.productsFound}</strong> · Errores:{' '}
              <strong>{activeRun.errorsCount}</strong>
            </p>
            {activeRun.errorSummary && isTerminal(activeRun.status) ? (
              <p className="mt-2 text-red-700">{activeRun.errorSummary}</p>
            ) : null}
          </div>
        ) : null}
        {message ? <p className="mt-3 text-sm text-emerald-800">{message}</p> : null}
        {error ? <p className="mt-3 text-sm text-red-700" role="alert">{error}</p> : null}
      </section>

      <section>
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-lg font-semibold">Historial de corridas</h2>
          <button
            type="button"
            className="text-sm text-slate-600 underline"
            onClick={() => void refreshHistory().catch(() => undefined)}
          >
            Actualizar
          </button>
        </div>
        <ScrapeRunsTable runs={history} />
      </section>
    </div>
  );
}
