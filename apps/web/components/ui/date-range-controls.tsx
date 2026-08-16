'use client';

import { CalendarDays, ChevronLeft, ChevronRight } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Button } from './button';
import { CustomSelect, type SelectOption } from './custom-select';
import { useI18n } from '../../lib/i18n';

type DateRangeControlsProps = {
  quickValue: string;
  quickOptions: SelectOption[];
  onQuickChange: (value: string) => void;
  from: string;
  to: string;
  onRangeChange: (from: string, to: string) => void;
  customActive?: boolean;
};

function dateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function formattedDate(value: string, includeYear = true) {
  if (!value) return '';
  return new Date(`${value}T00:00:00`).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    ...(includeYear ? { year: 'numeric' } : {}),
  });
}

export function DateRangeControls({
  quickValue,
  quickOptions,
  onQuickChange,
  from,
  to,
  onRangeChange,
  customActive = false,
}: DateRangeControlsProps) {
  const { t } = useI18n();
  const [quickOpen, setQuickOpen] = useState(false);
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [calendarTarget, setCalendarTarget] = useState<'from' | 'to'>('from');
  const [calendarMonth, setCalendarMonth] = useState(() => new Date());
  const calendarRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function closeCalendar(event: MouseEvent) {
      if (
        calendarRef.current &&
        !calendarRef.current.contains(event.target as Node)
      ) {
        setCalendarOpen(false);
      }
    }

    function handleEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') setCalendarOpen(false);
    }

    document.addEventListener('mousedown', closeCalendar);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', closeCalendar);
      document.removeEventListener('keydown', handleEscape);
    };
  }, []);

  const calendarDays = useMemo(() => {
    const first = new Date(
      calendarMonth.getFullYear(),
      calendarMonth.getMonth(),
      1,
    );
    const start = new Date(first);
    start.setDate(start.getDate() - start.getDay());
    return Array.from({ length: 42 }, (_, index) => {
      const date = new Date(start);
      date.setDate(start.getDate() + index);
      return date;
    });
  }, [calendarMonth]);

  const customLabel =
    from || to
      ? `${from ? formattedDate(from, false) : t('date.start')} – ${
          to ? formattedDate(to, false) : t('date.end')
        }`
      : t('date.range');
  const today = dateKey(new Date());

  function selectDate(date: Date) {
    const selected = dateKey(date);
    if (calendarTarget === 'from') {
      onRangeChange(selected, to && selected > to ? '' : to);
      setCalendarTarget('to');
      return;
    }
    if (from && selected < from) {
      onRangeChange(selected, to);
      return;
    }
    onRangeChange(from, selected);
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <CustomSelect
        value={quickValue}
        options={quickOptions}
        placeholder={customActive ? t('date.custom') : t('date.quickRange')}
        leadingIcon={<CalendarDays size={17} />}
        className="w-36 shrink-0"
        open={quickOpen}
        onOpenChange={(open) => {
          setQuickOpen(open);
          if (open) setCalendarOpen(false);
        }}
        onChange={(value) => {
          onQuickChange(value);
          setQuickOpen(false);
        }}
      />

      <div className="relative" ref={calendarRef}>
        <Button
          type="button"
          variant="secondary"
          className={`px-3 font-semibold text-brand ${
            customActive
              ? 'border-brand-border bg-brand-subtle'
              : 'border-border-subtle'
          }`}
          aria-haspopup="dialog"
          aria-expanded={calendarOpen}
          onClick={() => {
            setCalendarOpen((open) => !open);
            setQuickOpen(false);
          }}
        >
          <CalendarDays size={17} />
          <span>{customLabel}</span>
        </Button>

        {calendarOpen && (
          <div
            className="absolute right-0 top-full z-[110] mt-2 w-72 rounded-lg border border-border-subtle bg-card p-3 shadow-lg"
            role="dialog"
            aria-label={t('date.customRange')}
          >
            <div className="grid gap-2.5">
              <div className="flex items-center justify-between gap-3">
                <div className="flex min-w-0 items-center gap-2">
                  <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-brand-subtle text-brand">
                    <CalendarDays size={15} />
                  </span>
                  <div className="min-w-0">
                    <strong className="block text-xs text-text-main">
                      {t('date.customRange')}
                    </strong>
                    <small className="mt-0.5 block text-xs text-text-muted">
                      {t('date.chooseRange')}
                    </small>
                  </div>
                </div>
                {(from || to) && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-8 px-2 text-brand"
                    onClick={() => {
                      onRangeChange('', '');
                      setCalendarTarget('from');
                    }}
                  >
                    {t('common.clear')}
                  </Button>
                )}
              </div>

              <div className="grid grid-cols-[1fr_16px_1fr] items-center gap-1.5">
                <Button
                  type="button"
                  variant="secondary"
                  size="bareIcon"
                  className={`min-h-13 w-full flex-col items-start overflow-hidden text-ellipsis whitespace-nowrap px-2.5 py-2 text-left text-xs leading-tight hover:border-brand-border hover:bg-brand-subtle hover:text-brand ${
                    calendarTarget === 'from'
                      ? 'border-brand bg-brand-subtle text-brand'
                      : 'border-border-subtle bg-muted-surface text-text-secondary'
                  }`}
                  onClick={() => setCalendarTarget('from')}
                >
                  <small className="mb-1 block text-xs font-bold uppercase tracking-wider text-text-muted">
                    {t('date.from')}
                  </small>
                  {from ? formattedDate(from) : t('date.select')}
                </Button>
                <span className="text-center text-slate-400">–</span>
                <Button
                  type="button"
                  variant="secondary"
                  size="bareIcon"
                  className={`min-h-13 w-full flex-col items-start overflow-hidden text-ellipsis whitespace-nowrap px-2.5 py-2 text-left text-xs leading-tight hover:border-brand-border hover:bg-brand-subtle hover:text-brand ${
                    calendarTarget === 'to'
                      ? 'border-brand bg-brand-subtle text-brand'
                      : 'border-border-subtle bg-muted-surface text-text-secondary'
                  }`}
                  onClick={() => setCalendarTarget('to')}
                >
                  <small className="mb-1 block text-xs font-bold uppercase tracking-wider text-text-muted">
                    {t('date.to')}
                  </small>
                  {to ? formattedDate(to) : t('date.select')}
                </Button>
              </div>

              <div className="rounded-lg border border-border-subtle p-2">
                <div className="mb-2 flex items-center justify-between">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    aria-label={t('date.previousMonth')}
                    className="size-8 bg-muted-surface text-text-muted hover:bg-brand-subtle hover:text-brand"
                    onClick={() =>
                      setCalendarMonth(
                        (month) =>
                          new Date(
                            month.getFullYear(),
                            month.getMonth() - 1,
                            1,
                          ),
                      )
                    }
                  >
                    <ChevronLeft size={15} />
                  </Button>
                  <strong className="text-xs text-text-secondary">
                    {calendarMonth.toLocaleDateString(undefined, {
                      month: 'long',
                      year: 'numeric',
                    })}
                  </strong>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    aria-label={t('date.nextMonth')}
                    className="size-8 bg-muted-surface text-text-muted hover:bg-brand-subtle hover:text-brand"
                    onClick={() =>
                      setCalendarMonth(
                        (month) =>
                          new Date(
                            month.getFullYear(),
                            month.getMonth() + 1,
                            1,
                          ),
                      )
                    }
                  >
                    <ChevronRight size={15} />
                  </Button>
                </div>

                <div className="mb-1 grid grid-cols-7 text-center text-[0.58rem] font-bold text-slate-400">
                  {t('date.weekdays').split(',').map(
                    (day) => (
                      <span key={day}>{day}</span>
                    ),
                  )}
                </div>
                <div className="grid grid-cols-7 gap-0.5 text-center">
                  {calendarDays.map((date) => {
                    const key = dateKey(date);
                    const inMonth =
                      date.getMonth() === calendarMonth.getMonth();
                    const selected = key === from || key === to;
                    const isToday = key === today;
                    const isPast = key < today;
                    const inRange = Boolean(
                      from && to && key > from && key < to,
                    );
                    return (
                      <Button
                        key={key}
                        type="button"
                        variant={
                          selected
                            ? 'primary'
                            : inRange || isToday
                              ? 'brandSubtle'
                              : isPast && inMonth
                                ? 'neutralSubtle'
                                : 'ghost'
                        }
                        size="bareIcon"
                        aria-label={date.toDateString()}
                        className={`aspect-square w-full text-xs ${inRange && !selected ? 'rounded-none' : 'rounded-md'} ${isToday && !selected ? 'font-extrabold ring-1 ring-brand' : ''} ${!inMonth && !selected ? 'opacity-45' : ''}`}
                        onClick={() => selectDate(date)}
                      >
                        {date.getDate()}
                      </Button>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
