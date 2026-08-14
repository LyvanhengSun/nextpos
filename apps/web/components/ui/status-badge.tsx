import type { ReactNode } from 'react';

const toneClasses = {
  neutral: 'bg-muted-strong text-text-secondary',
  success: 'bg-emerald-50 text-emerald-700',
  warning: 'bg-amber-50 text-amber-700',
  danger: 'bg-rose-50 text-rose-700',
  info: 'bg-brand-subtle text-brand',
} as const;

type StatusBadgeProps = {
  children: ReactNode;
  tone?: keyof typeof toneClasses;
  className?: string;
};

/** Shared compact semantic status label for lists, cards, and tables. */
export function StatusBadge({
  children,
  tone = 'neutral',
  className = '',
}: StatusBadgeProps) {
  return (
    <span
      className={`inline-flex shrink-0 items-center rounded-full px-2 py-1 text-xs font-bold ${toneClasses[tone]} ${className}`.trim()}
    >
      {children}
    </span>
  );
}
