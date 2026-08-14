import type { TextareaHTMLAttributes } from 'react';

type TextareaProps = TextareaHTMLAttributes<HTMLTextAreaElement>;

export function Textarea({ className = '', ...props }: TextareaProps) {
  return (
    <textarea
      className={`min-h-24 w-full resize-y rounded-md border border-border-default bg-card px-3 py-2 text-[0.92rem] font-semibold text-text-main outline-none transition placeholder:text-slate-400 focus:border-brand focus:ring-2 focus:ring-brand/10 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-text-muted ${className}`.trim()}
      {...props}
    />
  );
}
