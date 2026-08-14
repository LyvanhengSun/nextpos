import type { ReactNode } from 'react';

type FormHelpProps = {
  children: ReactNode;
  className?: string;
};

export function FormHelp({ children, className = '' }: FormHelpProps) {
  return <p className={`form-help ${className}`.trim()}>{children}</p>;
}
