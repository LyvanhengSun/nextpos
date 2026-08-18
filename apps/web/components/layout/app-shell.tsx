'use client';

import { usePathname, useRouter } from 'next/navigation';
import type { ReactNode } from 'react';
import { useEffect, useState } from 'react';
import { AppNav } from './app-nav';
import { useI18n } from '../../lib/i18n';

type AppShellProps = {
  children: ReactNode;
};

const publicRoutes = new Set(['/', '/login', '/setup', '/activate']);

export function AppShell({ children }: AppShellProps) {
  const { t } = useI18n();
  const pathname = usePathname();
  const router = useRouter();
  const [routeReady, setRouteReady] = useState(false);

  useEffect(() => {
    if (publicRoutes.has(pathname)) {
      setRouteReady(true);
      return;
    }

    const token =
      sessionStorage.getItem('pos_access_token') ??
      localStorage.getItem('pos_access_token');

    if (!token) {
      setRouteReady(false);
      router.replace('/login');
      return;
    }

    setRouteReady(true);
  }, [pathname, router]);

  if (!routeReady) {
    return (
      <div className="flex min-h-dvh w-full items-center justify-center bg-app px-4 text-text-muted">
        <p className="m-0 text-sm font-bold">{t('auth.checkingSession')}</p>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen w-full max-w-full overflow-hidden bg-app max-[768px]:h-dvh max-[768px]:min-h-0 max-[768px]:flex-col">
      <AppNav />
      <div className="h-screen min-w-0 max-w-full flex-1 overflow-y-auto max-[768px]:h-auto max-[768px]:min-h-0 max-[768px]:w-full max-[768px]:overflow-x-hidden max-[768px]:overflow-y-auto max-[768px]:overscroll-x-none">
        {children}
      </div>
    </div>
  );
}
