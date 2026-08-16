'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  CircleDollarSign,
  FileText,
  Plus,
  ReceiptText,
  Search,
  WalletCards,
} from 'lucide-react';

import { PageContainer } from '../../components/layout/page-container';
import {
  AlertBanner,
  Button,
  CustomSelect,
  DatePicker,
  EmptyState,
  FormField,
  Input,
  PageHeading,
  SectionCard,
  StatusBadge,
  SummaryMetricCard,
} from '../../components/ui/';
import { useI18n } from '../../lib/i18n';

const api = '/api';
const categories = [
  'Rent',
  'Utilities',
  'Delivery',
  'Staff meal',
  'Supplies',
  'Repairs',
  'Marketing',
  'Other',
];

type Expense = {
  id: string;
  category: string;
  amount: number;
  paymentMethod: string;
  note: string | null;
  expenseDate: string;
  branch: { name: string };
};

const money = (amount: number) => `$${(amount / 100).toFixed(2)}`;

export default function ExpensesPage() {
  const { t, locale } = useI18n();
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [message, setMessage] = useState('');
  const [isError, setIsError] = useState(false);
  const [category, setCategory] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('CASH');
  const [expenseDate, setExpenseDate] = useState('');
  const [query, setQuery] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  const token =
    typeof window === 'undefined'
      ? ''
      : (sessionStorage.getItem('pos_access_token') ??
        localStorage.getItem('pos_access_token') ??
        '');
  const headers = {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  };

  async function load() {
    setIsLoading(true);
    try {
      const response = await fetch(`${api}/expenses`, { headers });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data.message ?? t('expenses.error.load'));
      }
      setExpenses(Array.isArray(data) ? data : []);
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    void load().catch((error: Error) => {
      setIsError(true);
      setMessage(error.message);
    });
  }, []);

  async function refresh() {
    setMessage('');
    try {
      await load();
    } catch (error) {
      setIsError(true);
      setMessage(
        error instanceof Error ? error.message : t('expenses.error.load'),
      );
    }
  }

  async function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage('');

    const element = event.currentTarget;
    const form = Object.fromEntries(new FormData(element));
    const actualCategory =
      category === 'Other'
        ? String(form.customCategory ?? '').trim()
        : category;

    if (!actualCategory) {
      setIsError(true);
      setMessage(t('expenses.error.category'));
      return;
    }

    setIsSaving(true);
    try {
      const response = await fetch(`${api}/expenses`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          category: actualCategory,
          amount: Math.round(Number(form.amount) * 100),
          paymentMethod,
          note: form.note,
          expenseDate: expenseDate
            ? new Date(expenseDate).toISOString()
            : undefined,
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data.message ?? t('expenses.error.record'));
      }

      element.reset();
      setCategory('');
      setPaymentMethod('CASH');
      setExpenseDate('');
      setIsError(false);
      setMessage(
        data.cashShiftId
          ? t('expenses.success.cash')
          : t('expenses.success.recorded'),
      );
      await load();
    } catch (error) {
      setIsError(true);
      setMessage(
        error instanceof Error
          ? error.message
          : t('receiving.error.api'),
      );
    } finally {
      setIsSaving(false);
    }
  }

  const total = expenses.reduce((sum, expense) => sum + expense.amount, 0);
  const today = new Date().toDateString();
  const todayTotal = expenses
    .filter((expense) => new Date(expense.expenseDate).toDateString() === today)
    .reduce((sum, expense) => sum + expense.amount, 0);

  const results = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    if (!normalizedQuery) return expenses;

    return expenses.filter((expense) =>
      `${expense.category} ${expense.paymentMethod} ${expense.note ?? ''} ${expense.branch?.name ?? ''}`
        .toLowerCase()
        .includes(normalizedQuery),
    );
  }, [expenses, query]);

  const categoryOptions = categories.map((item) => ({
    value: item,
    label: t(`expenses.category.${item.replace(' ', '')}` as Parameters<typeof t>[0]),
  }));
  const paymentOptions = [
    { value: 'CASH', label: t('supplierInvoices.cash') },
    { value: 'BANK', label: t('supplierInvoices.bankTransfer') },
    { value: 'CARD', label: t('supplierInvoices.card') },
    { value: 'KHQR', label: 'KHQR' },
  ];
  const paymentLabel = (value: string) =>
    paymentOptions.find((option) => option.value === value)?.label ?? value.replaceAll('_', ' ');
  const categoryLabel = (value: string) =>
    categories.includes(value)
      ? t(`expenses.category.${value.replace(' ', '')}` as Parameters<typeof t>[0])
      : value;

  return (
    <main className="app-page">
      <PageHeading eyebrow={t('expenses.eyebrow')} title={t('expenses.title')} />

      <div>
        <PageContainer>
          {message && (
            <AlertBanner
              tone={isError ? 'error' : 'success'}
              icon={
                isError ? <AlertCircle size={18} /> : <CheckCircle2 size={18} />
              }
              className="mb-5"
            >
              {message}
            </AlertBanner>
          )}

          <section className="mb-6 grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3">
            <SummaryMetricCard
              title={t('expenses.recorded')}
              value={money(total)}
              description={t('expenses.totalCosts')}
              icon={<CircleDollarSign size={20} />}
              tone="rose"
            />
            <SummaryMetricCard
              title={t('expenses.today')}
              value={money(todayTotal)}
              description={t('expenses.todayCosts')}
              icon={<ReceiptText size={20} />}
              tone="amber"
            />
            <SummaryMetricCard
              title={t('expenses.records')}
              value={expenses.length}
              description={t('expenses.transactions')}
              icon={<FileText size={20} />}
              tone="sky"
            />
          </section>

          <div className="grid grid-cols-1 items-start gap-6 xl:grid-cols-[minmax(20rem,0.85fr)_minmax(0,1.35fr)]">
            <SectionCard
              title={t('expenses.record')}
              description={t('expenses.recordHelp')}
              icon={<WalletCards size={20} />}
            >
              <form className="flex flex-col gap-6" onSubmit={create}>
                <div className="grid grid-cols-1 items-start gap-x-4 gap-y-4 md:grid-cols-2">
                  <FormField label={t('expenses.category')} required>
                    <CustomSelect
                      name="category"
                      value={category}
                      onChange={setCategory}
                      options={categoryOptions}
                      placeholder={t('expenses.chooseCategory')}
                    />
                  </FormField>

                  <FormField id="expense-amount" label={t('supplierInvoices.amountUsd')} required>
                    <Input
                      id="expense-amount"
                      required
                      name="amount"
                      type="number"
                      min="0.01"
                      step="0.01"
                      placeholder="0.00"
                      prefixText="$"
                    />
                  </FormField>

                  {category === 'Other' && (
                    <FormField
                      id="custom-category"
                      label={t('expenses.customCategory')}
                      required
                      className="md:col-span-2"
                    >
                      <Input
                        id="custom-category"
                        required
                        name="customCategory"
                        placeholder={t('expenses.customPlaceholder')}
                      />
                    </FormField>
                  )}

                  <FormField label={t('supplierInvoices.paymentMethod')} required>
                    <CustomSelect
                      name="paymentMethod"
                      value={paymentMethod}
                      onChange={setPaymentMethod}
                      options={paymentOptions}
                    />
                  </FormField>

                  <FormField
                    id="expense-date"
                    label={t('expenses.date')}
                    sublabel={t('common.optional')}
                  >
                    <DatePicker
                      id="expense-date"
                      name="expenseDate"
                      value={expenseDate}
                      onChange={setExpenseDate}
                      placeholder={t('expenses.selectDate')}
                    />
                  </FormField>

                  <FormField
                    id="expense-note"
                    label={t('purchaseOrders.note')}
                    sublabel={t('common.optional')}
                    className="md:col-span-2"
                  >
                    <Input
                      id="expense-note"
                      name="note"
                      placeholder={t('expenses.notePlaceholder')}
                    />
                  </FormField>
                </div>

                <div className="flex justify-end border-t border-border-subtle pt-6">
                  <Button type="submit" disabled={isSaving}>
                    <Plus size={16} />
                    {isSaving ? t('supplierInvoices.recording') : t('expenses.record')}
                  </Button>
                </div>
              </form>
            </SectionCard>

            <SectionCard
              title={t('expenses.recent')}
              description={t('expenses.count', { shown: results.length, total: expenses.length })}
              icon={<ReceiptText size={20} />}
              actions={
                <span className="inline-flex min-w-8 items-center justify-center rounded-full bg-muted-strong px-2.5 py-1 text-xs font-bold text-text-secondary">
                  {expenses.length}
                </span>
              }
              bodyPadding={false}
            >
              <div className="border-b border-border-subtle px-4 py-6 sm:px-8">
                <Input
                  type="search"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder={t('expenses.search')}
                  prefixIcon={<Search size={16} />}
                  aria-label={t('expenses.searchLabel')}
                />
              </div>

              {isLoading ? (
                <EmptyState
                  icon={<ReceiptText size={24} />}
                  title={t('expenses.loading')}
                  description={t('expenses.loadingHelp')}
                />
              ) : results.length ? (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[44rem] border-collapse text-left">
                    <thead>
                      <tr className="border-b border-border-subtle bg-muted-surface text-xs font-bold tracking-wider text-text-secondary uppercase">
                        <th className="px-4 py-3 sm:pl-8">{t('expenses.expense')}</th>
                        <th className="px-4 py-3">{t('expenses.branchDate')}</th>
                        <th className="px-4 py-3">{t('expenses.payment')}</th>
                        <th className="px-4 py-3 text-right sm:pr-8">{t('supplierInvoices.amountUsd')}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border-subtle">
                      {results.map((expense) => (
                        <tr
                          key={expense.id}
                          className="transition hover:bg-muted-surface"
                        >
                          <td className="px-4 py-4 sm:pl-8">
                            <div className="flex items-start gap-3">
                              <span className="inline-flex size-9 shrink-0 items-center justify-center rounded-md border border-brand-border bg-brand-subtle text-brand">
                                <ReceiptText size={16} />
                              </span>
                              <div className="min-w-0">
                                <p className="m-0 font-bold text-text-main">
                                  {categoryLabel(expense.category)}
                                </p>
                                <p className="mt-1 mb-0 max-w-64 truncate text-xs text-text-muted">
                                  {expense.note || t('expenses.noNote')}
                                </p>
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-4">
                            <p className="m-0 text-sm font-semibold text-text-secondary">
                              {expense.branch?.name || t('account.currentBranch')}
                            </p>
                            <p className="mt-1 mb-0 text-xs text-text-muted">
                              {new Date(
                                expense.expenseDate,
                              ).toLocaleDateString(locale === 'km' ? 'km-KH' : 'en-US')}
                            </p>
                          </td>
                          <td className="px-4 py-4">
                            <StatusBadge tone="neutral">
                              {paymentLabel(expense.paymentMethod)}
                            </StatusBadge>
                          </td>
                          <td className="px-4 py-4 text-right font-extrabold whitespace-nowrap text-amber-700 sm:pr-8">
                            {money(expense.amount)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <EmptyState
                  icon={<Search size={24} />}
                  title={t('expenses.empty')}
                  description={t('expenses.emptyHelp')}
                />
              )}
            </SectionCard>
          </div>
        </PageContainer>
      </div>
    </main>
  );
}
