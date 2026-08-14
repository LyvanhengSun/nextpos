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
  return (
    <div className={`alert-banner alert-banner-${tone} ${className}`.trim()}>
      {icon && <span className="alert-banner-icon">{icon}</span>}
      <span className="min-w-0 flex-1">
        {title && <strong className="block">{title}</strong>}
        {description && <span className="block">{description}</span>}
        {children}
      </span>
      {action && <span className="shrink-0">{action}</span>}
    </div>
  );
}
