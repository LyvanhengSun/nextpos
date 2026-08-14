import type { ReactNode } from 'react';

type PageHeadingProps = {
  eyebrow: string;
  title: string;
  actions?: ReactNode;
  tabs?: ReactNode;
  className?: string;
};

/** Shared workspace heading for operational, report, and settings pages. */
export function PageHeading({
  eyebrow,
  title,
  actions,
  tabs,
  className = '',
}: PageHeadingProps) {
  return (
    <header
      className={`relative z-20 w-full overflow-visible border-b border-border-default bg-card ${className}`.trim()}
    >
      <div
        className={`mx-auto w-full max-w-[1400px] overflow-visible px-4 pt-4 sm:pt-6 md:px-8 xl:px-[clamp(32px,4vw,64px)] ${
          tabs ? '' : 'pb-4 sm:pb-6'
        }`}
      >
        <div className="flex items-start justify-between gap-3 overflow-visible sm:gap-7">
          <div className="min-w-0 pr-2">
            <span className="mb-1 inline-flex border-l-[3px] border-brand pl-2 text-[0.62rem] font-black uppercase tracking-[0.08em] text-brand sm:mb-1.5 sm:border-l-4 sm:pl-2.5 sm:text-xs">
              {eyebrow}
            </span>
            <h1 className="m-0 text-lg font-extrabold leading-tight tracking-tight text-text-main sm:text-[1.625rem] sm:tracking-[-0.03em]">
              {title}
            </h1>
          </div>
          {actions && (
            <div className="relative z-30 flex shrink-0 items-center justify-end gap-2 [&>button]:max-sm:h-9 [&>button]:max-sm:px-3 [&>button]:max-sm:text-[0.8rem]">
              {actions}
            </div>
          )}
        </div>
        {tabs && (
          <nav className="mt-4 overflow-visible sm:mt-[26px]">{tabs}</nav>
        )}
      </div>
    </header>
  );
}
