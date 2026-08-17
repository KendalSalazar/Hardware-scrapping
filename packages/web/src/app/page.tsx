import { redirect } from 'next/navigation';
import { fetchCategories } from '@/lib/api-client';

export default async function Home() {
  let categorySlug: string | null = null;

  try {
    const response = await fetchCategories();
    categorySlug = response.categories[0]?.slug ?? null;
  } catch {
    categorySlug = null;
  }

  if (categorySlug) {
    redirect(`/${categorySlug}`);
  }

  return (
    <div className="space-y-3">
      <h1 className="text-2xl font-semibold">Comparador de hardware</h1>
      <p className="text-slate-600">
        No hay categorías disponibles o la API no responde. Verificá que la API esté
        corriendo en el puerto 3001.
      </p>
    </div>
  );
}
