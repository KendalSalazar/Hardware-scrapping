import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="space-y-3">
      <h1 className="text-2xl font-semibold">Página no encontrada</h1>
      <p className="text-slate-600">El recurso solicitado no existe.</p>
      <Link href="/ram">Volver al listado de RAM</Link>
    </div>
  );
}
