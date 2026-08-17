'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useTransition } from 'react';
import { parseSort } from '@/lib/search-params';

const OPTIONS = [
  { value: 'price_asc', label: 'Precio: menor a mayor' },
  { value: 'price_desc', label: 'Precio: mayor a menor' },
  { value: 'newest', label: 'Más recientes' },
] as const;

export function SortSelect() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const value = parseSort(searchParams.get('sort') ?? undefined);

  return (
    <label className="flex items-center gap-2 text-sm">
      <span className="text-slate-600">Ordenar</span>
      <select
        className="rounded border border-slate-300 bg-white px-2 py-1"
        value={value}
        disabled={isPending}
        onChange={(event) => {
          const params = new URLSearchParams(searchParams.toString());
          params.set('sort', event.target.value);
          params.delete('page');
          startTransition(() => router.replace(`${pathname}?${params.toString()}`));
        }}
      >
        {OPTIONS.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}
