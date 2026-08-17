import Link from 'next/link';
import { notFound } from 'next/navigation';
import { PriceHistoryTable } from '@/components/PriceHistoryTable';
import { SpecsBadges } from '@/components/SpecsBadges';
import { ApiClientError, fetchProductById } from '@/lib/api-client';
import { formatCrc } from '@/lib/format';

interface ProductDetailPageProps {
  params: Promise<{ id: string }>;
}

export default async function ProductDetailPage({ params }: ProductDetailPageProps) {
  const { id: rawId } = await params;
  const id = Number(rawId);
  if (!Number.isInteger(id) || id < 1) notFound();

  let product;
  try {
    product = await fetchProductById(id);
  } catch (error) {
    if (error instanceof ApiClientError && (error.status === 404 || error.status === 400)) {
      notFound();
    }
    throw error;
  }

  return (
    <div className="space-y-6">
      <div>
        <Link href={`/${product.category}`} className="text-sm">
          ← Volver a {product.category}
        </Link>
        <h1 className="mt-2 text-2xl font-semibold">{product.canonicalName}</h1>
        {product.brand ? (
          <p className="text-slate-600">{product.brand}</p>
        ) : (
          <p className="text-sm text-slate-500">Marca no disponible</p>
        )}
        <SpecsBadges specs={product.specs} />
      </div>

      <section className="space-y-4">
        <h2 className="text-lg font-semibold">Tiendas e historial</h2>
        {product.listings.length === 0 ? (
          <p className="text-slate-600">Este producto no tiene listings todavía.</p>
        ) : (
          product.listings.map((listing) => {
            const latest = listing.priceHistory[0];
            return (
              <div
                key={`${listing.storeId}-${listing.url}`}
                className="space-y-3 rounded-lg border border-slate-200 bg-white p-4"
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <h3 className="font-medium">{listing.storeName}</h3>
                    {latest ? (
                      <p className="text-xl font-bold">{formatCrc(latest.price)}</p>
                    ) : (
                      <p className="text-sm text-slate-500">Sin precio registrado</p>
                    )}
                  </div>
                  <a
                    href={listing.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm"
                  >
                    Abrir en tienda
                  </a>
                </div>
                <PriceHistoryTable history={listing.priceHistory} />
              </div>
            );
          })
        )}
      </section>
    </div>
  );
}
