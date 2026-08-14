'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function Home() {
  const router = useRouter();

  useEffect(() => {
    const token =
      sessionStorage.getItem('pos_access_token') ??
      localStorage.getItem('pos_access_token');

    if (!token) {
      router.replace('/login');
      return;
    }

    // Redirect based on role or default to dashboard
    fetch('/api/auth/me', {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(async (res) => (res.ok ? res.json() : null))
      .then((user) => {
        if (user?.role === 'CASHIER') {
          router.replace('/pos');
        } else {
          router.replace('/dashboard');
        }
      })
      .catch(() => {
        router.replace('/login');
      });
  }, [router]);

  return (
    <div className="flex min-h-dvh items-center justify-center bg-app px-4 text-text-muted">
      <p className="m-0 text-sm font-bold">Loading KN POS…</p>
    </div>
  );
}
