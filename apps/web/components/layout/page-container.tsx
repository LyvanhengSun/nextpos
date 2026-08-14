import type { ReactNode } from 'react';

type PageContainerProps = {
  children: ReactNode;
  className?: string;
};

export function PageContainer({
  children,
  className = '',
}: PageContainerProps) {
  return (
    <div
      className={`mx-auto w-full max-w-[1400px] px-4 py-6 md:px-8 xl:px-[clamp(32px,4vw,64px)] ${className}`.trim()}
    >
      {children}
    </div>
  );
}
