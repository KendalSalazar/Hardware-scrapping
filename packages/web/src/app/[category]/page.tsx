import { Suspense } from 'react';
import { notFound } from 'next/navigation';
import { FilterPanel } from '@/components/FilterPanel';
import { Pagination } from '@/components/Pagination';
import { ProductList } from '@/components/ProductList';
import { SortSelect } from '@/components/SortSelect';
import { ApiClientError, fetchCategoryFilters, fetchProducts } from '@/lib/api-client';
import { buildProductsQuery, firstString, parsePositiveInt } from '@/lib/search-params';

interface CategoryPageProps {
  params: Promise<{ category: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function CategoryPage({ params, searchParams }: CategoryPageProps) {
  const { category } = await params;
  const resolvedSearchParams = await searchParams;

  let filtersResponse;
  try {
    filtersResponse = await fetchCategoryFilters(category);
  } catch (error) {
    if (error instanceof ApiClientError && error.status === 404) notFound();
    throw error;
  }

  const productsResponse = await fetchProducts(
    buildProductsQuery(category, resolvedSearchParams),
  );
  const page = parsePositiveInt(
    firstString(resolvedSearchParams.page),
    productsResponse.page,
  );

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold">{filtersResponse.displayName}</h1>
        <p className="text-sm text-slate-600">
          Compará precios y especificaciones con filtros generados desde la API.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[260px_1fr]">
        <Suspense fallback={<div className="text-sm text-slate-500">Cargando filtros...</div>}>
          <FilterPanel filters={filtersResponse.filters} />
        </Suspense>

        <section className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-slate-600">
              {productsResponse.totalCount} producto
              {productsResponse.totalCount === 1 ? '' : 's'}
            </p>
            <Suspense fallback={null}>
              <SortSelect />
            </Suspense>
          </div>

          <ProductList products={productsResponse.products} />

          <Suspense fallback={null}>
            <Pagination
              page={page}
              pageSize={productsResponse.pageSize}
              totalCount={productsResponse.totalCount}
            />
          </Suspense>
        </section>
      </div>
    </div>
  );
}
