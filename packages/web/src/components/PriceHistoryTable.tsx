import { formatCrc, formatDateTime } from '@/lib/format';
import type { PriceHistoryPointDto } from '@/types/api';

export function PriceHistoryTable({ history }: { history: PriceHistoryPointDto[] }) {
  if (history.length === 0) {
    return <p className="text-sm text-slate-600">Sin historial de precios todavía.</p>;
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
      <table className="min-w-full text-left text-sm">
        <thead className="bg-slate-100 text-slate-700">
          <tr>
            <th className="px-3 py-2 font-medium">Fecha</th>
            <th className="px-3 py-2 font-medium">Precio</th>
            <th className="px-3 py-2 font-medium">Stock</th>
          </tr>
        </thead>
        <tbody>
          {history.map((row, index) => (
            <tr
              key={`${row.scrapedAt}-${row.price}-${index}`}
              className="border-t border-slate-100"
            >
              <td className="px-3 py-2">{formatDateTime(row.scrapedAt)}</td>
              <td className="px-3 py-2 font-medium">{formatCrc(row.price)}</td>
              <td className="px-3 py-2">{row.inStock ? 'Sí' : 'No'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
