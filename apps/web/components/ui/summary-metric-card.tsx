import type { ReactNode } from 'react';

const toneClasses = {
  purple: 'bg-violet-300 text-violet-950',
  amber: 'bg-amber-200 text-amber-900',
  sky: 'bg-sky-200 text-sky-950',
  emerald: 'bg-emerald-300 text-emerald-950',
  rose: 'bg-rose-200 text-rose-950',
  teal: 'bg-teal-200 text-teal-950',
} as const;

type SummaryMetricCardProps = {
  title: string;
  value: string | number;
  description: string;
  icon?: ReactNode;
  tone?: keyof typeof toneClasses;
  size?: 'default' | 'compact';
  className?: string;
};

export function SummaryMetricCard({
  title,
  value,
  description,
  icon,
  tone = 'purple',
  size = 'default',
  className = '',
}: SummaryMetricCardProps) {
  const compact = size === 'compact';
  const radiusClass = compact ? 'rounded-lg' : 'rounded-lg sm:rounded-[20px]';
  const headerClass = compact
    ? 'px-4 py-3 text-sm'
    : 'px-3 py-2.5 text-[0.82rem] leading-snug sm:px-[26px] sm:py-[18px] sm:text-[1.05rem]';
  const bodyClass = compact
    ? 'rounded-tl-lg px-4 py-4'
    : 'rounded-tl-lg px-3 py-3.5 sm:rounded-tl-[20px] sm:px-[26px] sm:py-6';
  const valueClass = compact
    ? 'text-2xl tracking-tight'
    : 'text-2xl tracking-tight sm:text-[2.35rem] sm:tracking-[-0.04em]';
  const descriptionClass = compact
    ? 'mt-1.5 text-xs'
    : 'mt-1.5 text-xs sm:mt-3 sm:text-[0.9rem]';

  return (
    <article
      className={`overflow-hidden border border-border-subtle shadow-card transition sm:hover:-translate-y-0.5 ${radiusClass} ${toneClasses[tone]} ${className}`.trim()}
    >
      <div
        className={`flex items-center justify-between font-extrabold ${headerClass}`}
      >
        <span className="min-w-0">{title}</span>
        {icon ? (
          <span className="shrink-0 opacity-75 [&>svg]:size-4 sm:[&>svg]:size-5">
            {icon}
          </span>
        ) : null}
      </div>
      <div className={`bg-card ${bodyClass}`}>
        <strong
          className={`block font-extrabold leading-none text-text-main ${valueClass}`}
        >
          {value}
        </strong>
        <small
          className={`block font-semibold text-text-muted ${descriptionClass}`}
        >
          {description}
        </small>
      </div>
    </article>
  );
}
