import Link from 'next/link';
import type { ComponentProps, ReactNode } from 'react';

import {
  buttonBaseClasses,
  buttonSizeClasses,
  buttonVariantClasses,
  type ButtonSize,
  type ButtonVariant,
} from './button';

type ButtonLinkProps = ComponentProps<typeof Link> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
  children: ReactNode;
};

export function ButtonLink({
  variant = 'primary',
  size = 'md',
  className = '',
  children,
  ...props
}: ButtonLinkProps) {
  return (
    <Link
      className={`${buttonBaseClasses} ${buttonVariantClasses[variant]} ${buttonSizeClasses[size]} no-underline ${className}`.trim()}
      {...props}
    >
      {children}
    </Link>
  );
}
