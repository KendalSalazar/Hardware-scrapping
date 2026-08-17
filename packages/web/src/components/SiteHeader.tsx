import Link from 'next/link';

export function SiteHeader() {
  return (
    <header className="border-b border-slate-200 bg-white">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
        <Link href="/" className="text-lg font-semibold text-slate-900 no-underline">
          Comparador HW
        </Link>
        <nav className="flex gap-4 text-sm">
          <Link href="/ram">RAM</Link>
        </nav>
      </div>
    </header>
  );
}
