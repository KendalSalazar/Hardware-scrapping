'use client';

import type { ScrapeRunDto } from '@/types/api';

export function ScrapeRunsTable({ runs }: { runs: ScrapeRunDto[] }) {
  if (runs.length === 0) {
    return <p className="text-sm text-slate-600">No hay corridas registradas.</p>;
  }

  return (
    <div className="overflow-x-auto rounded border border-slate-200">
      <table className="min-w-full text-left text-sm">
        <thead className="bg-slate-50 text-slate-600">
          <tr>
            <th className="px-3 py-2">ID</th>
            <th className="px-3 py-2">Estado</th>
            <th className="px-3 py-2">Productos</th>
            <th className="px-3 py-2">Errores</th>
            <th className="px-3 py-2">Inicio</th>
            <th className="px-3 py-2">Fin</th>
            <th className="px-3 py-2">Resumen</th>
          </tr>
        </thead>
        <tbody>
          {runs.map((run) => (
            <tr key={run.id} className="border-t border-slate-100">
              <td className="px-3 py-2 font-mono">{run.id}</td>
              <td className="px-3 py-2">{run.status}</td>
              <td className="px-3 py-2">{run.productsFound}</td>
              <td className="px-3 py-2">{run.errorsCount}</td>
              <td className="whitespace-nowrap px-3 py-2">
                {new Date(run.startedAt).toLocaleString()}
              </td>
              <td className="whitespace-nowrap px-3 py-2">
                {run.finishedAt ? new Date(run.finishedAt).toLocaleString() : '—'}
              </td>
              <td className="max-w-xs truncate px-3 py-2 text-slate-600" title={run.errorSummary ?? ''}>
                {run.errorSummary ?? '—'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
