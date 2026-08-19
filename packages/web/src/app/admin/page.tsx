'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ScrapeControl } from '@/components/admin/ScrapeControl';
import { useAuth } from '@/components/auth/AuthProvider';

export default function AdminPage() {
  const router = useRouter();
  const { ready, isAuthenticated, isAdmin, user } = useAuth();

  useEffect(() => {
    if (!ready) return;
    if (!isAuthenticated) {
      router.replace('/login');
    } else if (!isAdmin) {
      router.replace('/');
    }
  }, [ready, isAuthenticated, isAdmin, router]);

  if (!ready || !isAuthenticated || !isAdmin) {
    return <p className="text-sm text-slate-600">Verificando sesión...</p>;
  }

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Administración</h1>
        <p className="text-sm text-slate-600">Sesión: {user?.email}</p>
      </div>
      <ScrapeControl />
    </div>
  );
}
