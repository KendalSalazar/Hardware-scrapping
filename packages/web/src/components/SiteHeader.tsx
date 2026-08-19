'use client';

import Link from 'next/link';
import { useAuth } from '@/components/auth/AuthProvider';

export function SiteHeader() {
  const { ready, isAuthenticated, isAdmin, user, logout } = useAuth();

  return (
    <header className="border-b border-slate-200 bg-white">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
        <Link href="/" className="text-lg font-semibold text-slate-900 no-underline">
          Comparador HW
        </Link>
        <nav className="flex items-center gap-4 text-sm">
          <Link href="/ram">RAM</Link>
          {ready && isAdmin ? <Link href="/admin">Admin</Link> : null}
          {ready && isAuthenticated ? (
            <>
              <span className="text-slate-500">{user?.email}</span>
              <button
                type="button"
                onClick={logout}
                className="rounded border border-slate-300 px-2 py-1 hover:bg-slate-50"
              >
                Salir
              </button>
            </>
          ) : ready ? (
            <Link href="/login">Login</Link>
          ) : null}
        </nav>
      </div>
    </header>
  );
}
