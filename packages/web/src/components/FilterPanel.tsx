'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useMemo, useState, useTransition } from 'react';
import { formatFilterOptionLabel } from '@/lib/format';
import type { FilterDefinitionDto } from '@/types/api';

interface FilterPanelProps {
  filters: FilterDefinitionDto[];
}

interface RangeDraft {
  min: string;
  max: string;
}

function toggleCsvValue(
  current: string | null,
  option: string,
  checked: boolean,
): string | null {
  const values = new Set(
    (current ?? '')
      .split(',')
      .map((part) => part.trim())
      .filter(Boolean),
  );

  if (checked) values.add(option);
  else values.delete(option);

  return values.size === 0 ? null : [...values].join(',');
}

export function FilterPanel({ filters }: FilterPanelProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const rangeDrafts = useMemo(() => {
    const drafts: Record<string, RangeDraft> = {};
    for (const filter of filters) {
      if (filter.type !== 'range') continue;
      drafts[filter.key] = {
        min: searchParams.get(`${filter.key}_min`) ?? '',
        max: searchParams.get(`${filter.key}_max`) ?? '',
      };
    }
    return drafts;
  }, [filters, searchParams]);

  const [rangeState, setRangeState] = useState<Record<string, RangeDraft>>(rangeDrafts);

  // La URL es la fuente de verdad después de navegar o aplicar filtros.
  // Sincronizar en un effect evita llamar setState durante el render.
  useEffect(() => {
    setRangeState(rangeDrafts);
  }, [rangeDrafts]);

  const replaceParams = useCallback(
    (mutate: (params: URLSearchParams) => void) => {
      const params = new URLSearchParams(searchParams.toString());
      mutate(params);
      params.delete('page');
      const query = params.toString();

      startTransition(() => {
        router.replace(query ? `${pathname}?${query}` : pathname);
      });
    },
    [pathname, router, searchParams],
  );

  return (
    <aside
      className={`space-y-6 rounded-lg border border-slate-200 bg-white p-4 ${
        isPending ? 'opacity-70' : ''
      }`}
    >
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
          Filtros
        </h2>
        <button
          type="button"
          className="text-sm text-sky-700"
          onClick={() => {
            startTransition(() => router.replace(pathname));
          }}
        >
          Limpiar
        </button>
      </div>

      {filters.map((filter) => {
        if (filter.type === 'enum' || filter.type === 'number') {
          const selected = new Set(
            (searchParams.get(filter.key) ?? '')
              .split(',')
              .map((part) => part.trim())
              .filter(Boolean),
          );

          return (
            <fieldset key={filter.key} className="space-y-2">
              <legend className="text-sm font-medium text-slate-800">{filter.label}</legend>
              <div className="space-y-1">
                {(filter.options ?? []).map((option) => {
                  const inputId = `${filter.key}-${option}`;
                  return (
                    <label key={option} htmlFor={inputId} className="flex items-center gap-2 text-sm">
                      <input
                        id={inputId}
                        type="checkbox"
                        checked={selected.has(option)}
                        onChange={(event) => {
                          replaceParams((params) => {
                            const next = toggleCsvValue(
                              params.get(filter.key),
                              option,
                              event.target.checked,
                            );
                            if (next === null) params.delete(filter.key);
                            else params.set(filter.key, next);
                          });
                        }}
                      />
                      <span>{formatFilterOptionLabel(filter.key, option)}</span>
                    </label>
                  );
                })}
              </div>
            </fieldset>
          );
        }

        const minKey = `${filter.key}_min`;
        const maxKey = `${filter.key}_max`;
        const draft = rangeState[filter.key] ?? { min: '', max: '' };

        return (
          <fieldset key={filter.key} className="space-y-2">
            <legend className="text-sm font-medium text-slate-800">{filter.label}</legend>
            <div className="flex items-center gap-2">
              <input
                type="number"
                inputMode="numeric"
                placeholder="Mín"
                className="w-full rounded border border-slate-300 px-2 py-1 text-sm"
                value={draft.min}
                onChange={(event) => {
                  setRangeState((previous) => ({
                    ...previous,
                    [filter.key]: { min: event.target.value, max: draft.max },
                  }));
                }}
              />
              <span className="text-slate-400">–</span>
              <input
                type="number"
                inputMode="numeric"
                placeholder="Máx"
                className="w-full rounded border border-slate-300 px-2 py-1 text-sm"
                value={draft.max}
                onChange={(event) => {
                  setRangeState((previous) => ({
                    ...previous,
                    [filter.key]: { min: draft.min, max: event.target.value },
                  }));
                }}
              />
            </div>
            <button
              type="button"
              className="rounded bg-slate-900 px-3 py-1 text-sm text-white"
              onClick={() => {
                replaceParams((params) => {
                  if (draft.min.trim()) params.set(minKey, draft.min.trim());
                  else params.delete(minKey);
                  if (draft.max.trim()) params.set(maxKey, draft.max.trim());
                  else params.delete(maxKey);
                });
              }}
            >
              Aplicar {filter.label}
            </button>
          </fieldset>
        );
      })}
    </aside>
  );
}
