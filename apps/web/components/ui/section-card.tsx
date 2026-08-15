import type { ReactNode } from 'react';

type SectionCardProps = {
  title?: string;
  description?: string;
  icon?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
  bodyPadding?: boolean;
  headerClassName?: string;
  contentClassName?: string;
};

/** Shared card container for body sections across operational and admin pages. */
export function SectionCard({
  title,
  description,
  icon,
  actions,
  children,
  className = '',
  bodyClassName = '',
  bodyPadding = true,
  headerClassName = '',
  contentClassName = '',
}: SectionCardProps) {
  const hasHeader = title || description || icon || actions;

  return (
    <section
      className={`overflow-visible rounded-lg border border-border-subtle bg-card shadow-sm ${className}`.trim()}
    >
      {hasHeader && (
        <header
          className={`flex items-start justify-between gap-3 border-b border-border-subtle px-4 py-6 sm:gap-4 sm:px-8 ${headerClassName}`.trim()}
        >
          <div className="flex min-w-0 flex-1 items-start gap-3">
            {icon && (
              <span className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-md border border-brand/20 bg-brand-subtle text-brand">
                {icon}
              </span>
            )}
            <div className="min-w-0">
              {title && (
                <h2 className="m-0 text-base font-bold leading-tight tracking-tight text-text-main">
                  {title}
                </h2>
              )}
              {description && (
                <p className="mt-1 mb-0 text-xs leading-relaxed text-text-muted">
                  {description}
                </p>
              )}
            </div>
          </div>
          {actions && (
            <div className="flex shrink-0 items-center justify-end gap-2">
              {actions}
            </div>
          )}
        </header>
      )}
      <div
        className={`${bodyPadding ? 'px-4 py-6 sm:px-8' : ''} ${bodyClassName} ${contentClassName}`.trim()}
      >
        {children}
      </div>
    </section>
  );
}
