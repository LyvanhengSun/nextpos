'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { CalendarDays, ChevronLeft, ChevronRight } from 'lucide-react';

import { Button } from './button';

type DatePickerProps = {
  value: string;
  onChange: (value: string) => void;
  name?: string;
  id?: string;
  placeholder?: string;
  min?: string;
  max?: string;
  disabled?: boolean;
  className?: string;
};

const weekDays = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

function parseLocalDate(value: string) {
  const [year, month, day] = value.split('-').map(Number);
  if (!year || !month || !day) return null;
  return new Date(year, month - 1, day);
}

function toDateValue(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function formatDisplayDate(value: string) {
  const date = parseLocalDate(value);
  return date
    ? new Intl.DateTimeFormat(undefined, {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      }).format(date)
    : '';
}

export function DatePicker({
  value,
  onChange,
  name,
  id,
  placeholder = 'Select date',
  min,
  max,
  disabled = false,
  className = '',
}: DatePickerProps) {
  const selectedDate = parseLocalDate(value);
  const [open, setOpen] = useState(false);
  const [viewDate, setViewDate] = useState(
    selectedDate ??
      new Date(new Date().getFullYear(), new Date().getMonth(), 1),
  );
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (selectedDate) {
      setViewDate(
        new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1),
      );
    }
  }, [value]);

  useEffect(() => {
    function closeOnOutsideClick(event: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') setOpen(false);
    }
    document.addEventListener('mousedown', closeOnOutsideClick);
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      document.removeEventListener('mousedown', closeOnOutsideClick);
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, []);

  const calendarDays = useMemo(() => {
    const year = viewDate.getFullYear();
    const month = viewDate.getMonth();
    const firstWeekDay = new Date(year, month, 1).getDay();
    return Array.from(
      { length: 42 },
      (_, index) => new Date(year, month, index - firstWeekDay + 1),
    );
  }, [viewDate]);

  const today = toDateValue(new Date());
  const monthLabel = new Intl.DateTimeFormat(undefined, {
    month: 'long',
    year: 'numeric',
  }).format(viewDate);

  function selectDate(date: Date) {
    onChange(toDateValue(date));
    setOpen(false);
  }

  return (
    <div ref={rootRef} className={`relative w-full ${className}`.trim()}>
      <Button
        id={id}
        type="button"
        variant="secondary"
        disabled={disabled}
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
        className={`w-full px-3 ${value ? 'text-text-main' : 'font-normal text-slate-400'}`}
      >
        <span className="min-w-0 flex-1 truncate text-left">
          {value ? formatDisplayDate(value) : placeholder}
        </span>
        <CalendarDays size={16} className="shrink-0 text-text-muted" />
      </Button>

      {name && <input type="hidden" name={name} value={value} />}

      {open && !disabled && (
        <div
          role="dialog"
          aria-label="Choose date"
          className="absolute top-[calc(100%+6px)] left-0 z-[120] w-[min(20rem,calc(100vw-2rem))] rounded-lg border border-border-subtle bg-card p-4 shadow-xl sm:right-0 sm:left-auto"
        >
          <div className="mb-3 flex items-center justify-between gap-3">
            <Button
              variant="ghost"
              size="icon"
              className="size-8"
              aria-label="Previous month"
              onClick={() =>
                setViewDate(
                  new Date(viewDate.getFullYear(), viewDate.getMonth() - 1, 1),
                )
              }
            >
              <ChevronLeft size={17} />
            </Button>
            <p className="m-0 text-sm font-extrabold text-text-main">
              {monthLabel}
            </p>
            <Button
              variant="ghost"
              size="icon"
              className="size-8"
              aria-label="Next month"
              onClick={() =>
                setViewDate(
                  new Date(viewDate.getFullYear(), viewDate.getMonth() + 1, 1),
                )
              }
            >
              <ChevronRight size={17} />
            </Button>
          </div>

          <div className="mb-1 grid grid-cols-7 gap-1">
            {weekDays.map((day) => (
              <span
                key={day}
                className="grid h-8 place-items-center text-xs font-bold text-text-muted"
              >
                {day}
              </span>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-1">
            {calendarDays.map((date) => {
              const dateValue = toDateValue(date);
              const isSelected = dateValue === value;
              const isToday = dateValue === today;
              const isPast = dateValue < today;
              const outsideMonth = date.getMonth() !== viewDate.getMonth();
              const outsideRange = Boolean(
                (min && dateValue < min) || (max && dateValue > max),
              );
              return (
                <Button
                  key={dateValue}
                  variant={
                    isSelected
                      ? 'primary'
                      : isToday
                        ? 'brandSubtle'
                        : isPast && !outsideMonth
                          ? 'neutralSubtle'
                          : 'ghost'
                  }
                  size="icon"
                  disabled={outsideRange}
                  aria-label={date.toLocaleDateString()}
                  aria-pressed={isSelected}
                  onClick={() => selectDate(date)}
                  className={`size-9 rounded-md p-0 text-xs ${isToday && !isSelected ? 'font-extrabold ring-1 ring-brand' : ''} ${outsideMonth && !isSelected ? 'opacity-45' : ''}`}
                >
                  {date.getDate()}
                </Button>
              );
            })}
          </div>

          <div className="mt-3 flex items-center justify-between border-t border-border-subtle pt-3">
            <Button
              variant="ghost"
              size="sm"
              disabled={!value}
              onClick={() => {
                onChange('');
                setOpen(false);
              }}
            >
              Clear
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => {
                const date = new Date();
                setViewDate(new Date(date.getFullYear(), date.getMonth(), 1));
                selectDate(date);
              }}
            >
              Today
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
