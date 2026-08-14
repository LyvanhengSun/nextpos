'use client';

import { useEffect } from 'react';

export function PwaRegistrar() {
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;

    // Next's development server refreshes and replaces scripts constantly.
    // A service worker caching those files can cause a refresh loop, so PWA
    // caching is deliberately enabled only for production deployments.
    if (process.env.NODE_ENV !== 'production') {
      void navigator.serviceWorker.getRegistrations().then((registrations) => {
        registrations.forEach((registration) => void registration.unregister());
      });
      return;
    }

    void navigator.serviceWorker.register('/sw.js').catch(() => {
      // The POS still works online if service worker registration is blocked.
    });
  }, []);
  return null;
}
