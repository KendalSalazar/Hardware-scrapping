import type { ProductListItemDto } from '@/types/api';
import { ProductCard } from './ProductCard';

export function ProductList({ products }: { products: ProductListItemDto[] }) {
  if (products.length === 0) {
    return (
      <p className="rounded-lg border border-dashed border-slate-300 bg-white p-6 text-slate-600">
        No hay productos con los filtros seleccionados.
      </p>
    );
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {products.map((product) => (
        <ProductCard key={product.id} product={product} />
      ))}
    </div>
  );
}
