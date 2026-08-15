import type { ReactNode } from 'react';

type AlertBannerProps = {
  tone?: 'success' | 'error' | 'warning' | 'info';
  icon?: ReactNode;
  children?: ReactNode;
  title?: string;
  description?: string;
  action?: ReactNode;
  className?: string;
};

export function AlertBanner({
  tone = 'info',
  icon,
  children,
  title,
  description,
  action,
  className = '',
}: AlertBannerProps) {
  const hasStructuredContent = Boolean(title || description);

  return (
    <div className={`alert-banner alert-banner-${tone} ${className}`.trim()}>
      {icon && (
        <span className="alert-banner-icon self-center leading-none [&>svg]:block">
          {icon}
        </span>
      )}
      <span
        className={
          hasStructuredContent
            ? 'flex min-w-0 flex-1 flex-col justify-center gap-0.5 leading-5'
            : 'flex min-h-5 min-w-0 flex-1 items-center leading-5'
        }
      >
        {title && <strong className="block">{title}</strong>}
        {description && <span className="block">{description}</span>}
        {children}
      </span>
      {action && <span className="shrink-0">{action}</span>}
    </div>
  );
}
