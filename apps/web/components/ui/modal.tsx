'use client';

import type { ReactNode } from 'react';
import { X } from 'lucide-react';
import { Button } from './button';

type ModalProps = {
  title: string;
  description?: string;
  icon?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  onClose: () => void;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  density?: 'default' | 'compact' | 'compactNarrow';
  labelledBy?: string;
};

const widths = {
  sm: 'max-w-md',
  md: 'max-w-xl',
  lg: 'max-w-3xl',
  xl: 'max-w-5xl',
};

export function Modal({
  title,
  description,
  icon,
  children,
  footer,
  onClose,
  size = 'md',
  density = 'default',
  labelledBy = 'modal-title',
}: ModalProps) {
  const compactHeader = density === 'compact' || density === 'compactNarrow';
  const narrowOnly = density === 'compactNarrow';

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center p-3 sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-labelledby={labelledBy}
    >
      <Button
        variant="overlay"
        className="absolute inset-0 h-full w-full rounded-none p-0"
        onClick={onClose}
        aria-label="Close dialog"
      >
        <span className="sr-only">Close dialog</span>
      </Button>
      <section
        className={`relative z-10 flex max-h-[calc(100vh-1.5rem)] w-full flex-col overflow-hidden rounded-lg border border-border-subtle bg-card shadow-xl sm:max-h-[calc(100vh-3rem)] ${widths[size]}`}
      >
        <header
          className={`flex items-start justify-between gap-4 border-b border-border-subtle px-4 sm:px-8 ${
            compactHeader
              ? `py-3 sm:py-4 ${narrowOnly ? 'lg:py-5' : ''}`
              : 'py-5'
          }`}
        >
          <div className="flex min-w-0 items-start gap-3">
            {icon && (
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md border border-brand-border bg-brand-subtle text-brand">
                {icon}
              </span>
            )}
            <div className="min-w-0">
              <h2
                id={labelledBy}
                className={`m-0 font-bold tracking-tight text-text-main ${
                  narrowOnly ? 'text-base sm:text-xl' : 'text-xl'
                }`}
              >
                {title}
              </h2>
              {description && (
                <p
                  className={`${
                    compactHeader
                      ? `mt-0.5 leading-4 ${
                          narrowOnly ? 'lg:mt-1 lg:leading-5' : ''
                        }`
                      : 'mt-1 leading-5'
                  } text-xs text-text-muted`}
                >
                  {description}
                </p>
              )}
            </div>
          </div>
          <Button
            variant="iconBareDanger"
            size="icon"
            className="-mr-2 shrink-0"
            onClick={onClose}
            aria-label="Close"
          >
            <X size={18} />
          </Button>
        </header>
        <div
          className={`min-h-0 flex-1 overflow-y-auto px-4 sm:px-8 ${
            compactHeader
              ? `py-4 sm:py-5 ${narrowOnly ? 'lg:py-6' : ''}`
              : 'py-6'
          }`}
        >
          {children}
        </div>
        {footer && (
          <footer
            className={`flex flex-wrap justify-end gap-2 border-t border-border-subtle px-4 sm:px-8 ${
              compactHeader ? 'py-3 sm:py-4' : 'py-4'
            }`}
          >
            {footer}
          </footer>
        )}
      </section>
    </div>
  );
}
