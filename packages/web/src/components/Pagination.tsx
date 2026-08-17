'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useTransition } from 'react';

interface PaginationProps {
  page: number;
  pageSize: number;
  totalCount: number;
}

export function Pagination({ page, pageSize, totalCount }: PaginationProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));

  function goTo(nextPage: number) {
    const params = new URLSearchParams(searchParams.toString());
    if (nextPage <= 1) params.delete('page');
    else params.set('page', String(nextPage));
    const query = params.toString();
    startTransition(() => router.push(query ? `${pathname}?${query}` : pathname));
  }

  if (totalCount === 0) return null;

  return (
    <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
      <p className="text-sm text-slate-600">
        Página {page} de {totalPages} · {totalCount} resultado{totalCount === 1 ? '' : 's'}
      </p>
      <div className="flex gap-2">
        <button
          type="button"
          className="rounded border border-slate-300 bg-white px-3 py-1 text-sm disabled:opacity-40"
          disabled={page <= 1 || isPending}
          onClick={() => goTo(page - 1)}
        >
          Anterior
        </button>
        <button
          type="button"
          className="rounded border border-slate-300 bg-white px-3 py-1 text-sm disabled:opacity-40"
          disabled={page >= totalPages || isPending}
          onClick={() => goTo(page + 1)}
        >
          Siguiente
        </button>
      </div>
    </div>
  );
}
