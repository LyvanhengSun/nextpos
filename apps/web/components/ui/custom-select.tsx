'use client';

import type { CSSProperties, ReactNode } from 'react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ChevronDown, Check } from 'lucide-react';
import { useI18n } from '../../lib/i18n';

export type SelectOption = {
  value: string;
  label: string;
  sublabel?: string;
  count?: number;
};

type CustomSelectProps = {
  name?: string;
  value: string;
  onChange: (value: string) => void;
  options: SelectOption[];
  placeholder?: string;
  disabled?: boolean;
  style?: CSSProperties;
  className?: string;
  leadingIcon?: ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  placement?: 'top' | 'bottom';
};

export function CustomSelect({
  name,
  value,
  onChange,
  options,
  placeholder,
  disabled = false,
  style,
  className = '',
  leadingIcon,
  open,
  onOpenChange,
  placement = 'bottom',
}: CustomSelectProps) {
  const { t } = useI18n();
  const resolvedPlaceholder = placeholder ?? t('common.selectOption');
  const [internalOpen, setInternalOpen] = useState(false);
  const isOpen = open ?? internalOpen;
  const containerRef = useRef<HTMLDivElement>(null);

  const setOpen = useCallback(
    (nextOpen: boolean) => {
      if (open === undefined) setInternalOpen(nextOpen);
      onOpenChange?.(nextOpen);
    },
    [onOpenChange, open],
  );

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [setOpen]);

  const selectedOption = options.find((opt) => opt.value === value);

  return (
    <div
      className={`relative inline-block ${className || 'w-full'}`}
      ref={containerRef}
      style={style}
    >
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen(!isOpen)}
        className={`flex h-10 w-full cursor-pointer items-center justify-between rounded-md border border-border-default bg-card px-3 text-left text-sm font-semibold text-text-main shadow-2xs transition focus:border-brand focus:ring-2 focus:ring-brand/10 focus:outline-none disabled:cursor-not-allowed disabled:bg-slate-50 disabled:opacity-60 ${
          !selectedOption ? 'text-slate-400 font-normal' : ''
        }`}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
      >
        <span className="flex min-w-0 items-center gap-2">
          {leadingIcon && (
            <span className="flex shrink-0 items-center text-text-muted">
              {leadingIcon}
            </span>
          )}
          <span className="truncate">
            {selectedOption ? selectedOption.label : resolvedPlaceholder}
          </span>
        </span>
        <ChevronDown
          size={16}
          className={`ml-2 shrink-0 text-text-muted transition-transform duration-150 ${
            isOpen ? 'rotate-180' : ''
          }`}
        />
      </button>

      {isOpen && !disabled && (
        <div
          className={`absolute left-0 right-0 z-[110] max-h-60 w-full overflow-y-auto rounded-md border border-border-subtle bg-card p-1 shadow-lg ${
            placement === 'top'
              ? 'bottom-[calc(100%+4px)]'
              : 'top-[calc(100%+4px)]'
          }`}
        >
          <ul className="m-0 flex list-none flex-col gap-px p-0" role="listbox">
            {options.map((opt) => {
              const isSelected = opt.value === value;
              return (
                <li key={opt.value} className="m-0 list-none p-0">
                  <button
                    type="button"
                    onClick={() => {
                      onChange(opt.value);
                      setOpen(false);
                    }}
                    className={`flex w-full cursor-pointer items-center justify-between gap-2 rounded-[var(--radius-sm)] border-0 px-2.5 py-[7px] text-left text-sm font-medium transition-colors duration-150 hover:bg-app hover:text-brand ${
                      isSelected
                        ? 'bg-brand-subtle font-bold text-brand'
                        : 'bg-transparent text-text-main'
                    }`}
                    role="option"
                    aria-selected={isSelected}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="truncate">{opt.label}</div>
                      {opt.sublabel && (
                        <small className="block text-xs text-text-muted">
                          {opt.sublabel}
                        </small>
                      )}
                    </div>
                    <span className="flex shrink-0 items-center gap-2">
                      {typeof opt.count === 'number' && (
                        <span
                          className={`min-w-6 rounded-full px-1.5 py-0.5 text-center text-xs font-semibold tabular-nums ${
                            isSelected
                              ? 'bg-card/80 text-brand'
                              : 'bg-app text-text-muted'
                          }`}
                        >
                          {opt.count}
                        </span>
                      )}
                      {isSelected && (
                        <Check size={15} className="shrink-0 text-brand" />
                      )}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {name && <input type="hidden" name={name} value={value} />}
    </div>
  );
}
