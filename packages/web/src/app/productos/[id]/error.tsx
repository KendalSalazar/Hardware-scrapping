'use client';

export default function ProductError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="space-y-3 rounded-lg border border-red-200 bg-red-50 p-4">
      <h2 className="text-lg font-semibold text-red-900">No se pudo cargar el producto</h2>
      <p className="text-sm text-red-800">{error.message}</p>
      <button
        type="button"
        className="rounded bg-red-900 px-3 py-1 text-sm text-white"
        onClick={reset}
      >
        Reintentar
      </button>
    </div>
  );
}
