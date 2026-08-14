import type { ReactNode } from 'react';
import { AppNav } from './app-nav';

type AppShellProps = {
  children: ReactNode;
};

export function AppShell({ children }: AppShellProps) {
  return (
    <div className="flex min-h-screen w-full overflow-hidden bg-app max-[768px]:flex-col max-[768px]:overflow-visible">
      <AppNav />
      <div className="h-screen flex-1 overflow-y-auto max-[768px]:h-auto max-[768px]:overflow-visible">
        {children}
      </div>
    </div>
  );
}
