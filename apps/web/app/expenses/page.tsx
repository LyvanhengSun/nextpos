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

const categoryOptions = categories.map((item) => ({
  value: item,
  label: item,
}));

const paymentOptions = [
  { value: 'CASH', label: 'Cash' },
  { value: 'BANK', label: 'Bank transfer' },
  { value: 'CARD', label: 'Card' },
  { value: 'KHQR', label: 'KHQR' },
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

function paymentLabel(paymentMethod: string) {
  return (
    paymentOptions.find((option) => option.value === paymentMethod)?.label ??
    paymentMethod.replaceAll('_', ' ')
  );
}

export default function ExpensesPage() {
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
        throw new Error(data.message ?? 'Unable to load expenses.');
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
        error instanceof Error ? error.message : 'Unable to load expenses.',
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
      setMessage('Choose an expense category.');
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
        throw new Error(data.message ?? 'Unable to record expense.');
      }

      element.reset();
      setCategory('');
      setPaymentMethod('CASH');
      setExpenseDate('');
      setIsError(false);
      setMessage(
        data.cashShiftId
          ? 'Cash expense recorded and removed from your open cash shift.'
          : 'Expense recorded and included in your profit report.',
      );
      await load();
    } catch (error) {
      setIsError(true);
      setMessage(
        error instanceof Error
          ? error.message
          : 'The API server did not return a response.',
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

  return (
    <main className="app-page">
      <PageHeading eyebrow="Business costs" title="Expenses" />

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
              title="Expenses recorded"
              value={money(total)}
              description="Total business costs"
              icon={<CircleDollarSign size={20} />}
              tone="rose"
            />
            <SummaryMetricCard
              title="Today"
              value={money(todayTotal)}
              description="Costs recorded today"
              icon={<ReceiptText size={20} />}
              tone="amber"
            />
            <SummaryMetricCard
              title="Expense records"
              value={expenses.length}
              description="Recorded transactions"
              icon={<FileText size={20} />}
              tone="sky"
            />
          </section>

          <div className="grid grid-cols-1 items-start gap-6 xl:grid-cols-[minmax(20rem,0.85fr)_minmax(0,1.35fr)]">
            <SectionCard
              title="Record expense"
              description="Cash payments automatically create a matching cash-out in the open shift."
              icon={<WalletCards size={20} />}
            >
              <form className="flex flex-col gap-6" onSubmit={create}>
                <div className="grid grid-cols-1 items-start gap-x-4 gap-y-4 md:grid-cols-2">
                  <FormField label="Category" required>
                    <CustomSelect
                      name="category"
                      value={category}
                      onChange={setCategory}
                      options={categoryOptions}
                      placeholder="Choose category"
                    />
                  </FormField>

                  <FormField id="expense-amount" label="Amount" required>
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
                      label="Custom category"
                      required
                      className="md:col-span-2"
                    >
                      <Input
                        id="custom-category"
                        required
                        name="customCategory"
                        placeholder="e.g. Licenses"
                      />
                    </FormField>
                  )}

                  <FormField label="Payment method" required>
                    <CustomSelect
                      name="paymentMethod"
                      value={paymentMethod}
                      onChange={setPaymentMethod}
                      options={paymentOptions}
                    />
                  </FormField>

                  <FormField
                    id="expense-date"
                    label="Expense date"
                    sublabel="(optional)"
                  >
                    <DatePicker
                      id="expense-date"
                      name="expenseDate"
                      value={expenseDate}
                      onChange={setExpenseDate}
                      placeholder="Select date"
                    />
                  </FormField>

                  <FormField
                    id="expense-note"
                    label="Note"
                    sublabel="(optional)"
                    className="md:col-span-2"
                  >
                    <Input
                      id="expense-note"
                      name="note"
                      placeholder="e.g. July electricity bill"
                    />
                  </FormField>
                </div>

                <div className="flex justify-end border-t border-border-subtle pt-6">
                  <Button type="submit" disabled={isSaving}>
                    <Plus size={16} />
                    {isSaving ? 'Recording…' : 'Record expense'}
                  </Button>
                </div>
              </form>
            </SectionCard>

            <SectionCard
              title="Recent expenses"
              description={`${results.length} of ${expenses.length} expense records.`}
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
                  placeholder="Search category, note, payment, or branch"
                  prefixIcon={<Search size={16} />}
                  aria-label="Search expenses"
                />
              </div>

              {isLoading ? (
                <EmptyState
                  icon={<ReceiptText size={24} />}
                  title="Loading expenses"
                  description="Preparing your latest expense records."
                />
              ) : results.length ? (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[44rem] border-collapse text-left">
                    <thead>
                      <tr className="border-b border-border-subtle bg-muted-surface text-xs font-bold tracking-wider text-text-secondary uppercase">
                        <th className="px-4 py-3 sm:pl-8">Expense</th>
                        <th className="px-4 py-3">Branch & date</th>
                        <th className="px-4 py-3">Payment</th>
                        <th className="px-4 py-3 text-right sm:pr-8">Amount</th>
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
                                  {expense.category}
                                </p>
                                <p className="mt-1 mb-0 max-w-64 truncate text-xs text-text-muted">
                                  {expense.note || 'No note added'}
                                </p>
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-4">
                            <p className="m-0 text-sm font-semibold text-text-secondary">
                              {expense.branch?.name || 'Current branch'}
                            </p>
                            <p className="mt-1 mb-0 text-xs text-text-muted">
                              {new Date(
                                expense.expenseDate,
                              ).toLocaleDateString()}
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
                  title="No matching expenses"
                  description="Try another category, note, payment, or branch."
                />
              )}
            </SectionCard>
          </div>
        </PageContainer>
      </div>
    </main>
  );
}
