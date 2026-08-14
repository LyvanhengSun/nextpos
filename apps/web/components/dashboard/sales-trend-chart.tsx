'use client';

import type { TooltipContentProps } from 'recharts';
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

import { SectionCard } from '../ui/section-card';

export type SalesTrendPoint = {
  date: string;
  revenue: number;
  transactions: number;
};

type SalesTrendChartProps = {
  data: SalesTrendPoint[];
};

function money(value: number) {
  return `$${(value / 100).toFixed(2)}`;
}

function dayLabel(date: string) {
  return new Intl.DateTimeFormat('en', { weekday: 'short' }).format(
    new Date(`${date}T00:00:00`),
  );
}

function SalesTooltip({ active, payload, label }: TooltipContentProps) {
  if (!active || !payload?.length) return null;

  const point = payload[0]?.payload as SalesTrendPoint | undefined;
  if (!point) return null;

  return (
    <div className="min-w-36 rounded-md border border-border-subtle bg-card px-3 py-2 shadow-lg">
      <p className="m-0 text-xs font-bold text-text-main">
        {dayLabel(String(label))}
      </p>
      <p className="mt-1 mb-0 text-sm font-bold text-brand">
        {money(point.revenue)}
      </p>
      <p className="mt-0.5 mb-0 text-xs text-text-muted">
        {point.transactions}{' '}
        {point.transactions === 1 ? 'transaction' : 'transactions'}
      </p>
    </div>
  );
}

export function SalesTrendChart({ data }: SalesTrendChartProps) {
  const hasSales = data.some((point) => point.transactions > 0);

  return (
    <SectionCard
      title="7-day sales trend"
      description="Daily completed revenue and transaction activity."
      actions={
        <span className="text-xs font-bold uppercase tracking-wider text-text-muted">
          Last 7 days
        </span>
      }
      bodyClassName="h-64 sm:h-72"
    >
      {hasSales ? (
        <div
          className="h-full w-full"
          role="img"
          aria-label="Area chart of completed sales revenue over the last seven days"
        >
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart
              data={data}
              margin={{ top: 8, right: 8, left: 0, bottom: 0 }}
              accessibilityLayer
            >
              <defs>
                <linearGradient
                  id="dashboard-sales-fill"
                  x1="0"
                  y1="0"
                  x2="0"
                  y2="1"
                >
                  <stop
                    offset="5%"
                    stopColor="var(--color-brand)"
                    stopOpacity={0.24}
                  />
                  <stop
                    offset="95%"
                    stopColor="var(--color-brand)"
                    stopOpacity={0.02}
                  />
                </linearGradient>
              </defs>
              <CartesianGrid
                stroke="var(--color-border-subtle)"
                strokeDasharray="3 3"
                vertical={false}
              />
              <XAxis
                dataKey="date"
                tickFormatter={dayLabel}
                axisLine={false}
                tickLine={false}
                tick={{ fill: 'var(--color-text-muted)', fontSize: 12 }}
                dy={8}
              />
              <YAxis
                tickFormatter={(value: number) => `$${Math.round(value / 100)}`}
                axisLine={false}
                tickLine={false}
                tick={{ fill: 'var(--color-text-muted)', fontSize: 12 }}
                width={48}
              />
              <Tooltip
                content={SalesTooltip}
                cursor={{ stroke: 'var(--color-border-default)' }}
              />
              <Area
                type="monotone"
                dataKey="revenue"
                name="Revenue"
                stroke="var(--color-brand)"
                strokeWidth={3}
                fill="url(#dashboard-sales-fill)"
                activeDot={{ r: 5, fill: 'var(--color-brand)' }}
                isAnimationActive={false}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <div className="flex h-full flex-col items-center justify-center text-center">
          <p className="m-0 text-sm font-bold text-text-main">No sales yet</p>
          <p className="mt-1 mb-0 text-xs text-text-muted">
            Completed sales will appear here as the week progresses.
          </p>
        </div>
      )}
    </SectionCard>
  );
}
