import type { Metadata, Viewport } from 'next';
import { AppShell } from '../components/layout/app-shell';
import { PwaRegistrar } from '../components/layout/pwa-registrar';
import { I18nProvider } from '../lib/i18n';
import './styles.css';

export const metadata: Metadata = {
  title: 'KN POS',
  description: 'POS-first business platform',
  manifest: '/manifest.webmanifest',
};

export const viewport: Viewport = { themeColor: '#172033' };

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>
        <PwaRegistrar />
        <I18nProvider>
          <AppShell>{children}</AppShell>
        </I18nProvider>
      </body>
    </html>
  );
}
