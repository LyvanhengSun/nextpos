import type { ReactNode } from 'react';

type EmptyStateProps = {
  title: string;
  description?: string;
  icon?: ReactNode;
  action?: ReactNode;
  className?: string;
};

export function EmptyState({
  title,
  description,
  icon,
  action,
  className = '',
}: EmptyStateProps) {
  return (
    <div
      className={`flex flex-col items-center justify-center gap-1.5 px-5 py-[30px] text-center text-[0.85rem] text-text-muted ${className}`.trim()}
      role="status"
    >
      {icon && <div className="mb-0.5 leading-none text-slate-400">{icon}</div>}
      <p className="m-0 text-[0.9rem] font-bold text-text-secondary">{title}</p>
      {description && (
        <p className="m-0 text-[0.82rem] text-text-muted">{description}</p>
      )}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}
