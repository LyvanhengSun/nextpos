import type { ButtonHTMLAttributes, ReactNode } from 'react';

type TabButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  active?: boolean;
  children: ReactNode;
};

type TabCountBadgeProps = {
  active?: boolean;
  children: ReactNode;
};

export function TabCountBadge({
  active = false,
  children,
}: TabCountBadgeProps) {
  return (
    <span
      className={`ml-0.5 inline-flex h-5 w-8 shrink-0 items-center justify-center overflow-hidden rounded-full px-1 text-xs font-bold leading-none tabular-nums ${
        active ? 'bg-brand text-white' : 'bg-muted-strong text-text-secondary'
      }`}
    >
      {children}
    </span>
  );
}

export function TabButton({
  active = false,
  className = '',
  children,
  type = 'button',
  ...props
}: TabButtonProps) {
  return (
    <button
      type={type}
      className={`relative mb-[-1px] inline-flex shrink-0 cursor-pointer items-center gap-2 border-b-[3px] py-2.5 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/20 ${
        active
          ? 'border-brand font-bold text-brand'
          : 'border-transparent text-text-muted hover:text-text-main'
      } ${className}`.trim()}
      {...props}
    >
      {children}
    </button>
  );
}
