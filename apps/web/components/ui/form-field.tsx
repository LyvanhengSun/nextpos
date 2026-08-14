import type { ReactNode } from 'react';

export type FormFieldProps = {
  label: string;
  children: ReactNode;
  required?: boolean;
  error?: string;
  help?: string;
  sublabel?: string;
  className?: string;
  labelClassName?: string;
  id?: string;
};

export function FormField({
  label,
  children,
  required = false,
  error,
  help,
  sublabel,
  className = '',
  labelClassName = '',
  id,
}: FormFieldProps) {
  return (
    <div className={`flex flex-col gap-1 ${className}`.trim()}>
      <div className="flex items-center justify-between gap-2 leading-none">
        <label
          htmlFor={id}
          className={`text-xs font-bold text-text-secondary select-none ${labelClassName}`.trim()}
        >
          {label}
          {required && <span className="ml-1 text-rose-500 font-bold" title="Required">*</span>}
        </label>
        {sublabel && (
          <span className="text-[0.75rem] font-normal text-text-muted select-none">
            {sublabel}
          </span>
        )}
      </div>
      {children}
      {error ? (
        <p className="m-0 text-xs font-medium text-rose-500">{error}</p>
      ) : help ? (
        <p className="m-0 text-xs font-medium text-text-muted">{help}</p>
      ) : null}
    </div>
  );
}

