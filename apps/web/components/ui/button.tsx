import type { ButtonHTMLAttributes, ReactNode } from 'react';

export type ButtonVariant =
  | 'primary'
  | 'dark'
  | 'secondary'
  | 'outline'
  | 'ghost'
  | 'danger'
  | 'dangerSubtle'
  | 'brandSubtle'
  | 'successSubtle'
  | 'neutralSubtle'
  | 'warningSubtle'
  | 'overlay'
  | 'quantityControl'
  | 'quantityValue'
  | 'iconBareDanger';
export type ButtonSize =
  | 'sm'
  | 'md'
  | 'lg'
  | 'icon'
  | 'bareIcon'
  | 'keypadAction'
  | 'keypadKey'
  | 'productCard'
  | 'quantityControl'
  | 'quantityValue'
  | 'variantTile'
  | 'status';

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
  children: ReactNode;
};

export const buttonBaseClasses =
  'inline-flex cursor-pointer items-center justify-center gap-2 border font-bold transition disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-55';

export const buttonVariantClasses: Record<ButtonVariant, string> = {
  primary: 'border-brand bg-brand text-white shadow-sm hover:bg-brand-hover',
  dark: 'border-slate-900 bg-slate-900 text-white shadow-sm hover:bg-slate-800',
  secondary:
    'border-border-default bg-card text-text-main shadow-sm hover:bg-muted-surface',
  outline:
    'border-border-default bg-transparent text-text-main hover:bg-muted-surface',
  ghost:
    'border-transparent bg-transparent text-text-secondary hover:bg-muted-surface',
  danger: 'border-rose-600 bg-rose-600 text-white shadow-sm hover:bg-rose-700',
  dangerSubtle:
    'border-rose-200 bg-rose-50 text-rose-600 shadow-none hover:border-rose-300 hover:bg-rose-100 hover:text-rose-700',
  brandSubtle:
    'border-brand-border bg-brand-subtle text-brand shadow-none hover:border-brand hover:bg-brand-subtle hover:text-brand',
  successSubtle:
    'border-emerald-200 bg-emerald-50 text-emerald-700 shadow-none hover:border-emerald-300 hover:bg-emerald-100 hover:text-emerald-800',
  neutralSubtle:
    'border-border-subtle bg-muted-surface text-text-muted shadow-none hover:bg-slate-100 hover:text-text-main',
  warningSubtle:
    'border-amber-200 bg-amber-50 text-amber-700 shadow-none hover:border-amber-300 hover:bg-amber-100 hover:text-amber-800',
  overlay:
    'border-transparent bg-slate-950/45 text-transparent shadow-none hover:bg-slate-950/45',
  quantityControl:
    'border-slate-300 bg-white text-slate-700 shadow-2xs hover:border-slate-400 hover:bg-slate-50',
  quantityValue:
    'border-transparent bg-transparent text-slate-700 shadow-none hover:bg-white hover:text-text-main',
  iconBareDanger:
    'border-transparent bg-transparent text-rose-500 shadow-none hover:bg-transparent hover:text-rose-700',
};

export const buttonSizeClasses: Record<ButtonSize, string> = {
  sm: 'h-9 rounded-md px-3 text-[0.8rem]',
  md: 'h-10 rounded-md px-4 text-[0.86rem]',
  lg: 'h-11 rounded-md px-5 text-[0.92rem]',
  icon: 'h-10 w-10 rounded-md p-0',
  bareIcon: 'h-auto w-auto rounded-md p-0',
  keypadAction: 'h-12 w-12 rounded-md p-0',
  keypadKey: 'h-12 rounded-md px-3 text-lg',
  productCard: 'h-auto min-h-0 min-w-0 rounded-md p-2 sm:min-h-56',
  quantityControl: 'h-6 w-6 rounded-[5px] p-0',
  quantityValue: 'h-6 min-w-6 rounded-[5px] px-1 text-xs',
  variantTile: 'h-auto min-h-14 min-w-0 rounded-md p-2',
  status: 'h-auto rounded-md px-2 py-1 text-xs',
};

export function Button({
  variant = 'primary',
  size = 'md',
  className = '',
  children,
  type = 'button',
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      className={`${buttonBaseClasses} ${buttonVariantClasses[variant]} ${buttonSizeClasses[size]} ${className}`.trim()}
      {...props}
    >
      {children}
    </button>
  );
}
