'use client';

import { Delete } from 'lucide-react';
import { Button } from './button';
import { Input } from './input';

type NumericKeypadProps = {
  value: string;
  onChange: (value: string) => void;
  allowDecimal?: boolean;
  autoFocus?: boolean;
  currencySymbol?: string;
  suffixText?: string;
  decimalPlaces?: number;
  maxIntegerDigits?: number;
  masked?: boolean;
  placeholder?: string;
  density?: 'default' | 'compact';
};

const keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '00', '0', '.'];

export function NumericKeypad({
  value,
  onChange,
  allowDecimal = true,
  autoFocus = false,
  currencySymbol,
  suffixText,
  decimalPlaces = 2,
  maxIntegerDigits = 7,
  masked = false,
  placeholder = '0.00',
  density = 'default',
}: NumericKeypadProps) {
  const compact = density === 'compact';

  function sanitize(nextValue: string) {
    const cleaned = nextValue.replace(/[^\d.]/g, '');
    const hasDecimal = allowDecimal && cleaned.includes('.');
    const [whole = '', ...fractionParts] = cleaned.split('.');
    const integer = whole.replace(/^0+(?=\d)/, '').slice(0, maxIntegerDigits);

    if (!hasDecimal) return integer;

    const fraction = fractionParts.join('').slice(0, decimalPlaces);
    return `${integer || '0'}.${fraction}`;
  }

  function append(key: string) {
    if (key === '.' && (!allowDecimal || value.includes('.'))) return;
    onChange(sanitize(`${value}${key}`));
  }

  return (
    <div
      className={`rounded-lg border border-border-subtle bg-muted-surface ${
        compact ? 'p-2 sm:p-3' : 'p-3'
      }`}
    >
      <div
        className={`grid ${
          compact
            ? 'grid-cols-[minmax(0,1fr)_2.5rem_2.5rem] gap-1.5 sm:grid-cols-[minmax(0,1fr)_3rem_3rem] sm:gap-2'
            : 'grid-cols-[minmax(0,1fr)_3rem_3rem] gap-2'
        }`}
      >
        <Input
          autoFocus={autoFocus}
          type={masked ? 'password' : 'text'}
          inputMode={allowDecimal ? 'decimal' : 'numeric'}
          value={value}
          prefixText={currencySymbol}
          suffixIcon={
            suffixText ? (
              <span className="text-sm font-bold">{suffixText}</span>
            ) : undefined
          }
          placeholder={placeholder}
          wrapperClassName={compact ? 'h-10 bg-card sm:h-12' : 'h-12 bg-card'}
          className={`text-right font-bold tabular-nums ${
            compact ? 'text-lg sm:text-xl' : 'text-xl'
          }`}
          onChange={(event) => onChange(sanitize(event.target.value))}
        />
        <Button
          variant="secondary"
          size="keypadAction"
          className={compact ? 'h-10 w-10 sm:h-12 sm:w-12' : ''}
          aria-label="Delete last digit"
          title="Delete last digit"
          onClick={() => onChange(value.slice(0, -1))}
        >
          <Delete size={18} />
        </Button>
        <Button
          variant="dangerSubtle"
          size="keypadAction"
          className={compact ? 'h-10 w-10 sm:h-12 sm:w-12' : ''}
          aria-label="Clear amount"
          title="Clear amount"
          onClick={() => onChange('')}
        >
          C
        </Button>
      </div>

      <div
        className={`grid grid-cols-3 ${
          compact ? 'mt-2 gap-1.5 sm:mt-3 sm:gap-2' : 'mt-3 gap-2'
        }`}
      >
        {keys.map((key) =>
          key === '.' && !allowDecimal ? (
            <span key={key} aria-hidden="true" />
          ) : (
            <Button
              key={key}
              variant="secondary"
              size="keypadKey"
              className={compact ? 'h-10 text-base sm:h-12 sm:text-lg' : ''}
              onClick={() => append(key)}
            >
              {key}
            </Button>
          ),
        )}
      </div>
    </div>
  );
}
