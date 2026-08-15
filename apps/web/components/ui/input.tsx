import type { InputHTMLAttributes, ReactNode } from 'react';
import { forwardRef } from 'react';

export type InputProps = InputHTMLAttributes<HTMLInputElement> & {
  prefixText?: string;
  prefixIcon?: ReactNode;
  suffixIcon?: ReactNode;
  wrapperClassName?: string;
};

export const Input = forwardRef<HTMLInputElement, InputProps>(
  (
    {
      className = '',
      wrapperClassName = '',
      prefixText,
      prefixIcon,
      suffixIcon,
      disabled,
      ...props
    },
    ref,
  ) => {
    const hasPrefix = Boolean(prefixText || prefixIcon);
    const hasSuffix = Boolean(suffixIcon);

    if (hasPrefix || hasSuffix) {
      return (
        <div
          className={`group relative flex h-10 w-full items-center rounded-md border border-border-default bg-card shadow-2xs transition-all focus-within:border-brand focus-within:ring-2 focus-within:ring-brand/10 ${
            disabled ? 'bg-slate-50 opacity-70 cursor-not-allowed' : ''
          } ${wrapperClassName}`.trim()}
        >
          {prefixText && (
            <span className="pointer-events-none absolute left-3 flex items-center text-sm font-semibold text-text-muted select-none">
              {prefixText}
            </span>
          )}
          {prefixIcon && (
            <span className="pointer-events-none absolute left-3 flex items-center text-text-muted select-none">
              {prefixIcon}
            </span>
          )}
          <input
            ref={ref}
            disabled={disabled}
            className={`h-full w-full rounded-md bg-transparent px-3 text-base font-semibold text-text-main outline-none transition placeholder:font-normal placeholder:text-slate-400 disabled:cursor-not-allowed sm:text-sm ${
              prefixText || prefixIcon ? 'pl-8' : ''
            } ${suffixIcon ? 'pr-9' : ''} ${className}`.trim()}
            {...props}
          />
          {suffixIcon && (
            <span className="pointer-events-none absolute right-3 flex items-center text-text-muted select-none">
              {suffixIcon}
            </span>
          )}
        </div>
      );
    }

    return (
      <input
        ref={ref}
        disabled={disabled}
        className={`h-10 w-full rounded-md border border-border-default bg-card px-3 text-base font-semibold text-text-main shadow-2xs outline-none transition placeholder:font-normal placeholder:text-slate-400 focus:border-brand focus:ring-2 focus:ring-brand/10 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-text-muted sm:text-sm ${className}`.trim()}
        {...props}
      />
    );
  },
);

Input.displayName = 'Input';
