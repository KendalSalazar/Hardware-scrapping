import Link from 'next/link';
import { formatCrc } from '@/lib/format';
import type { ProductListItemDto } from '@/types/api';
import { SpecsBadges } from './SpecsBadges';

export function ProductCard({ product }: { product: ProductListItemDto }) {
  return (
    <article className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <h2 className="text-base font-semibold leading-snug">
        <Link
          href={`/productos/${product.id}`}
          className="text-slate-900 no-underline hover:underline"
        >
          {product.canonicalName}
        </Link>
      </h2>

      {product.brand ? (
        <p className="mt-1 text-sm text-slate-500">{product.brand}</p>
      ) : null}

      <SpecsBadges specs={product.specs} />

      <div className="mt-3 flex flex-wrap items-end justify-between gap-2">
        <div>
          <p className="text-xl font-bold text-slate-900">
            {formatCrc(product.lowestPrice.price)}
          </p>
          <p className="text-sm text-slate-600">{product.lowestPrice.storeName}</p>
        </div>
        <a
          href={product.lowestPrice.url}
          target="_blank"
          rel="noopener noreferrer"
          className="text-sm font-medium"
        >
          Ver en tienda
        </a>
      </div>
    </article>
  );
}
