'use client';

import type { ReactNode } from 'react';
import { Check } from 'lucide-react';

export type ChoiceCardOption = {
  value: string;
  label: string;
  description: string;
  icon?: ReactNode;
};

type ChoiceCardGroupProps = {
  name: string;
  value: string;
  options: ChoiceCardOption[];
  onChange: (value: string) => void;
  disabled?: boolean;
  className?: string;
};

/** Compact single-choice cards for short, high-signal setup options. */
export function ChoiceCardGroup({
  name,
  value,
  options,
  onChange,
  disabled = false,
  className = '',
}: ChoiceCardGroupProps) {
  return (
    <div
      className={`grid grid-cols-1 gap-2 sm:grid-cols-3 ${className}`.trim()}
      role="radiogroup"
    >
      {options.map((option) => {
        const selected = option.value === value;

        return (
          <label
            key={option.value}
            className={`relative flex min-h-16 cursor-pointer items-center gap-2 rounded-md border p-2.5 shadow-2xs transition has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-brand/20 ${
              selected
                ? 'border-brand bg-brand-subtle'
                : 'border-border-default bg-card hover:border-brand-border hover:bg-muted-surface'
            } ${disabled ? 'cursor-not-allowed opacity-60' : ''}`.trim()}
          >
            <input
              type="radio"
              className="sr-only"
              name={name}
              value={option.value}
              checked={selected}
              disabled={disabled}
              onChange={() => onChange(option.value)}
            />
            {option.icon && (
              <span
                className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-xs font-bold ${
                  selected
                    ? 'bg-brand text-white'
                    : 'bg-muted-surface text-text-secondary'
                }`}
              >
                {option.icon}
              </span>
            )}
            <span className="min-w-0">
              <span
                className={`block text-sm font-bold ${selected ? 'text-brand' : 'text-text-main'}`}
              >
                {option.label}
              </span>
              <span className="mt-0.5 block text-xs leading-4 text-text-muted">
                {option.description}
              </span>
            </span>
            {selected && (
              <Check
                size={15}
                className="absolute top-2 right-2 text-brand"
                aria-hidden="true"
              />
            )}
          </label>
        );
      })}
    </div>
  );
}
