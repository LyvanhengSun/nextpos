'use client';

import { FormEvent, useEffect, useState } from 'react';
import {
  BadgePercent,
  Banknote,
  CreditCard,
  Download,
  Gift,
  Landmark,
  PackageSearch,
  PieChart,
  QrCode,
  ReceiptText,
  RefreshCw,
  TrendingUp,
  User,
  Users,
  Wallet,
} from 'lucide-react';

import { PageContainer } from '../../components/layout/page-container';
import {
  AlertBanner,
  Button,
  DateRangeControls,
  EmptyState,
  PageHeading,
  SectionCard,
  SummaryMetricCard,
} from '../../components/ui/';
import { useI18n } from '../../lib/i18n';

const api = '/api';

type Item = { method: string; total: number; count: number };
type Cashier = { name: string; total: number; count: number };
type Product = { name: string; quantity: number; total: number };
type Report = {
  from: string;
  to: string;
  salesTotal: number;
  transactionCount: number;
  expenseTotal: number;
  expenseCount: number;
  netSalesAfterExpenses: number;
  costOfGoodsSold: number;
  grossProfit: number;
  netProfit: number;
  expenseCategories: { category: string; total: number; count: number }[];
  payments: Item[];
  cashiers: Cashier[];
  topProducts: Product[];
};
type DailyClose = {
  date: string;
  salesTotal: number;
  transactionCount: number;
  expenseTotal: number;
  expenseCount: number;
  refundTotal: number;
  refundCount: number;
  payments: Item[];
  closedShifts: {
    id: string;
    cashier: string;
    openingCash: number;
    closingCash: number;
    expectedCash: number;
    difference: number;
    varianceReason: string | null;
    closedAt: string | null;
  }[];
};
type ListItem = {
  id: string;
  title: string;
  subtitle: string;
  value: string;
  icon: React.ReactNode;
};

const money = (value: number) => `$${(value / 100).toFixed(2)}`;

const isoDate = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

async function readResponse<T>(response: Response): Promise<T | null> {
  const raw = await response.text().catch(() => '');
  if (!raw.trim()) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

function responseMessage(data: unknown, fallback: string) {
  if (
    data &&
    typeof data === 'object' &&
    'message' in data &&
    typeof data.message === 'string'
  ) {
    return data.message;
  }
  return fallback;
}

function ReportListCard({
  title,
  description,
  items,
  emptyTitle,
  emptyDescription,
  emptyIcon,
}: {
  title: string;
  description: string;
  items: ListItem[];
  emptyTitle: string;
  emptyDescription: string;
  emptyIcon: React.ReactNode;
}) {
  return (
    <SectionCard title={title} description={description} bodyPadding={false}>
      {items.length ? (
        <div>
          {items.map((item) => (
            <div
              key={item.id}
              className="flex items-center justify-between gap-4 border-b border-border-subtle px-4 py-4 last:border-b-0 hover:bg-muted-surface sm:px-8"
            >
              <div className="flex min-w-0 items-center gap-3">
                <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-brand-subtle text-brand">
                  {item.icon}
                </span>
                <div className="min-w-0">
                  <strong className="block truncate text-sm text-text-main">
                    {item.title}
                  </strong>
                  <span className="mt-1 block text-xs text-text-muted">
                    {item.subtitle}
                  </span>
                </div>
              </div>
              <strong className="shrink-0 text-sm text-text-main tabular-nums">
                {item.value}
              </strong>
            </div>
          ))}
        </div>
      ) : (
        <EmptyState
          title={emptyTitle}
          description={emptyDescription}
          icon={emptyIcon}
        />
      )}
    </SectionCard>
  );
}

export default function ReportsPage() {
  const { t } = useI18n();
  const builtInExpenseCategories = new Set([
    'Rent', 'Utilities', 'Delivery', 'Staff meal', 'Supplies', 'Repairs', 'Marketing', 'Other',
  ]);
  const expenseCategoryLabel = (value: string) =>
    builtInExpenseCategories.has(value)
      ? t(`expenses.category.${value.replace(' ', '')}` as Parameters<typeof t>[0])
      : value;
  const paymentMethodLabel = (value: string) => {
    const supported = new Set(['CASH', 'CARD', 'KHQR', 'BANK', 'BANK_TRANSFER', 'GIFT_CARD']);
    return supported.has(value)
      ? t(`reports.payment.${value}` as Parameters<typeof t>[0])
      : value.replaceAll('_', ' ');
  };
  const today = isoDate(new Date());
  const [report, setReport] = useState<Report | null>(null);
  const [dailyClose, setDailyClose] = useState<DailyClose | null>(null);
  const [message, setMessage] = useState('');
  const [from, setFrom] = useState(today);
  const [to, setTo] = useState(today);
  const [quickValue, setQuickValue] = useState('today');

  const token =
    typeof window === 'undefined'
      ? ''
      : (sessionStorage.getItem('pos_access_token') ??
        localStorage.getItem('pos_access_token') ??
        '');

  async function load(nextFrom = from, nextTo = to) {
    const [response, dailyResponse] = await Promise.all([
      fetch(`${api}/reports/range?from=${nextFrom}&to=${nextTo}`, {
        headers: { Authorization: `Bearer ${token}` },
      }),
      fetch(`${api}/reports/daily`, {
        headers: { Authorization: `Bearer ${token}` },
      }),
    ]);

    const data = await readResponse<Report>(response);
    if (!response.ok) {
      throw new Error(responseMessage(data, t('reports.error.load')));
    }

    const dailyData = await readResponse<DailyClose>(dailyResponse);
    if (!dailyResponse.ok) {
      throw new Error(
        responseMessage(dailyData, t('reports.error.daily')),
      );
    }

    setReport(data);
    setDailyClose(dailyData);
  }

  useEffect(() => {
    void load().catch((error: Error) => setMessage(error.message));
  }, []);

  async function apply(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage('');
    try {
      await load();
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : t('reports.error.load'),
      );
    }
  }

  function applyPreset(value: string) {
    const days = value === 'today' ? 1 : value === 'week' ? 7 : 30;
    const end = new Date();
    const start = new Date(end);
    start.setDate(start.getDate() - (days - 1));
    const nextFrom = isoDate(start);
    const nextTo = isoDate(end);
    setQuickValue(value);
    setFrom(nextFrom);
    setTo(nextTo);
    setMessage('');
    void load(nextFrom, nextTo).catch((error: Error) =>
      setMessage(error.message),
    );
  }

  function downloadCsv() {
    if (!report) return;
    const rows: string[][] = [
      [t('reports.csv.title'), t('reports.csv.period', { from, to })],
      [t('reports.completedSales'), String(report.transactionCount)],
      [t('reports.salesTotal'), (report.salesTotal / 100).toFixed(2)],
      [t('expenses.title'), (report.expenseTotal / 100).toFixed(2)],
      [t('reports.cogs'), (report.costOfGoodsSold / 100).toFixed(2)],
      [t('reports.grossProfit'), (report.grossProfit / 100).toFixed(2)],
      [t('reports.netProfit'), (report.netProfit / 100).toFixed(2)],
      [],
      [t('reports.expenseCategory'), t('reports.records'), t('supplierInvoices.total')],
      ...report.expenseCategories.map((item) => [
        expenseCategoryLabel(item.category),
        String(item.count),
        (item.total / 100).toFixed(2),
      ]),
      [],
      [t('supplierInvoices.paymentMethod'), t('reports.transactions'), t('supplierInvoices.total')],
      ...report.payments.map((item) => [
        paymentMethodLabel(item.method),
        String(item.count),
        (item.total / 100).toFixed(2),
      ]),
      [],
      [t('staff.role.CASHIER'), t('reports.transactions'), t('supplierInvoices.total')],
      ...report.cashiers.map((item) => [
        item.name,
        String(item.count),
        (item.total / 100).toFixed(2),
      ]),
      [],
      [t('entity.product'), t('reports.unitsSold'), t('reports.productSales')],
      ...report.topProducts.map((item) => [
        item.name,
        String(item.quantity),
        (item.total / 100).toFixed(2),
      ]),
    ];
    const csv = rows
      .map((row) =>
        row.map((value) => `"${value.replaceAll('"', '""')}"`).join(','),
      )
      .join('\n');
    const url = URL.createObjectURL(
      new Blob([csv], { type: 'text/csv;charset=utf-8' }),
    );
    const link = document.createElement('a');
    link.href = url;
    link.download = `sales-report-${from}-to-${to}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  const paymentIcon = (method: string) =>
    method === 'CASH' ? (
      <Banknote size={16} />
    ) : method === 'CARD' ? (
      <CreditCard size={16} />
    ) : method === 'KHQR' ? (
      <QrCode size={16} />
    ) : (
      <Gift size={16} />
    );

  const expenseItems: ListItem[] =
    report?.expenseCategories.map((item) => {
      const percent =
        report.expenseTotal > 0 ? (item.total / report.expenseTotal) * 100 : 0;
      return {
        id: item.category,
        title: expenseCategoryLabel(item.category),
        subtitle: t('reports.expenseShare', { count: item.count, percent: percent.toFixed(1) }),
        value: money(item.total),
        icon: <PieChart size={16} />,
      };
    }) ?? [];

  const paymentItems: ListItem[] =
    report?.payments.map((item) => {
      const percent =
        report.salesTotal > 0 ? (item.total / report.salesTotal) * 100 : 0;
      return {
        id: item.method,
        title: paymentMethodLabel(item.method),
        subtitle: t('reports.salesShare', { count: item.count, percent: percent.toFixed(1) }),
        value: money(item.total),
        icon: paymentIcon(item.method),
      };
    }) ?? [];

  const cashierItems: ListItem[] =
    report?.cashiers.map((item) => {
      const percent =
        report.salesTotal > 0 ? (item.total / report.salesTotal) * 100 : 0;
      return {
        id: item.name,
        title: item.name,
        subtitle: t('reports.salesShare', { count: item.count, percent: percent.toFixed(1) }),
        value: money(item.total),
        icon: <User size={16} />,
      };
    }) ?? [];

  return (
    <main className="w-full pb-16">
      <PageHeading eyebrow={t('reports.eyebrow')} title={t('reports.title')} />

      <div>
        <PageContainer>
          <div className="flex flex-col gap-6">
            {message && <AlertBanner tone="error">{message}</AlertBanner>}

            {report && (
              <section
                className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-5"
                aria-label={t('reports.summary')}
              >
                <SummaryMetricCard
                  size="compact"
                  title={t('reports.grossSales')}
                  value={money(report.salesTotal)}
                  description={t('reports.revenueHelp')}
                  icon={<TrendingUp size={18} />}
                  tone="purple"
                />
                <SummaryMetricCard
                  size="compact"
                  title={t('reports.totalOrders')}
                  value={report.transactionCount}
                  description={
                    report.transactionCount
                      ? t('reports.average', { amount: money(Math.round(report.salesTotal / report.transactionCount)) })
                      : t('reports.noTransactions')
                  }
                  icon={<ReceiptText size={18} />}
                  tone="sky"
                />
                <SummaryMetricCard
                  size="compact"
                  title={t('reports.branchExpenses')}
                  value={money(report.expenseTotal)}
                  description={t('reports.expenseRecords', { count: report.expenseCount })}
                  icon={<PieChart size={18} />}
                  tone="amber"
                />
                <SummaryMetricCard
                  size="compact"
                  title={t('reports.grossProfit')}
                  value={money(report.grossProfit)}
                  description={t('reports.grossProfitHelp')}
                  icon={<Wallet size={18} />}
                  tone="emerald"
                />
                <SummaryMetricCard
                  size="compact"
                  title={t('reports.netProfit')}
                  value={money(report.netProfit)}
                  description={t('reports.netProfitHelp')}
                  icon={<BadgePercent size={18} />}
                  tone="purple"
                />
              </section>
            )}

            <SectionCard bodyClassName="py-4">
              <form
                onSubmit={apply}
                className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between"
              >
                <div className="flex min-w-0 items-center gap-3">
                  <span className="hidden text-xs font-bold text-text-secondary sm:inline">
                    {t('supplierPage.period')}
                  </span>
                  <DateRangeControls
                    quickValue={quickValue}
                    quickOptions={[
                      { value: 'today', label: t('expenses.today') },
                      { value: 'week', label: t('reports.last7') },
                      { value: 'month', label: t('supplierPage.last30') },
                    ]}
                    onQuickChange={applyPreset}
                    from={from}
                    to={to}
                    customActive={!quickValue}
                    onRangeChange={(nextFrom, nextTo) => {
                      setFrom(nextFrom);
                      setTo(nextTo);
                      setQuickValue('');
                    }}
                  />
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button type="submit" variant="secondary">
                    <RefreshCw size={16} />
                    {t('reports.apply')}
                  </Button>
                  {report && (
                    <Button
                      type="button"
                      variant="secondary"
                      onClick={downloadCsv}
                    >
                      <Download size={16} />
                      {t('reports.exportCsv')}
                    </Button>
                  )}
                </div>
              </form>
            </SectionCard>

            {dailyClose && (
              <SectionCard
                title={t('reports.cashReconciliation')}
                description={t('reports.cashReconciliationHelp')}
                actions={
                  <span className="rounded-full border border-brand-border bg-brand-subtle px-2 py-1 text-xs font-bold uppercase tracking-wider text-brand">
                    {t('expenses.today')}
                  </span>
                }
              >
                <div className="grid grid-cols-1 items-start gap-3 sm:grid-cols-2 xl:grid-cols-4">
                  {[
                    [t('reports.completedSales'), money(dailyClose.salesTotal)],
                    [t('reports.transactions'), String(dailyClose.transactionCount)],
                    [
                      t('reports.refunds'),
                      `${dailyClose.refundCount} · ${money(dailyClose.refundTotal)}`,
                    ],
                    [
                      t('expenses.title'),
                      `${dailyClose.expenseCount} · ${money(dailyClose.expenseTotal)}`,
                    ],
                  ].map(([label, value]) => (
                    <div
                      key={label}
                      className="rounded-lg border border-border-subtle bg-card p-5"
                    >
                      <p className="m-0 text-xs font-bold text-text-muted">
                        {label}
                      </p>
                      <strong className="mt-2 block text-lg text-text-main tabular-nums">
                        {value}
                      </strong>
                    </div>
                  ))}
                </div>

                <div className="mt-6">
                  <h3 className="mb-3 text-sm font-bold text-text-secondary">
                    {t('reports.closedCashShifts')}
                  </h3>
                  {dailyClose.closedShifts.length ? (
                    <div className="overflow-x-auto rounded-lg border border-border-subtle">
                      <table className="w-full min-w-[720px] border-collapse text-left text-sm">
                        <thead>
                          <tr className="border-b border-border-subtle bg-muted-surface">
                            {[
                              t('staff.role.CASHIER'),
                              t('reports.expected'),
                              t('reports.counted'),
                              t('reports.variance'),
                              t('shifts.reason'),
                            ].map((heading) => (
                              <th
                                key={heading}
                                className="px-4 py-3 text-xs font-bold uppercase tracking-wider text-text-secondary"
                              >
                                {heading}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {dailyClose.closedShifts.map((shift) => (
                            <tr
                              key={shift.id}
                              className="border-b border-border-subtle last:border-b-0 hover:bg-muted-surface"
                            >
                              <td className="px-4 py-4 font-semibold text-text-main">
                                {shift.cashier}
                              </td>
                              <td className="px-4 py-4 text-right tabular-nums text-text-secondary">
                                {money(shift.expectedCash)}
                              </td>
                              <td className="px-4 py-4 text-right tabular-nums text-text-secondary">
                                {money(shift.closingCash)}
                              </td>
                              <td
                                className={`px-4 py-4 text-right font-bold tabular-nums ${
                                  shift.difference === 0
                                    ? 'text-emerald-700'
                                    : 'text-rose-600'
                                }`}
                              >
                                {shift.difference === 0
                                  ? t('reports.balanced')
                                  : `${shift.difference > 0 ? '+' : '-'}${money(Math.abs(shift.difference))}`}
                              </td>
                              <td className="px-4 py-4 text-text-secondary">
                                {shift.varianceReason ?? '—'}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <EmptyState
                      title={t('shifts.noClosed')}
                      description={t('reports.noClosedHelp')}
                      icon={<Landmark size={24} />}
                    />
                  )}
                </div>
              </SectionCard>
            )}

            {report && (
              <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-2">
                <ReportListCard
                  title={t('reports.expenseBreakdown')}
                  description={t('reports.expenseBreakdownHelp')}
                  items={expenseItems}
                  emptyTitle={t('reports.noExpenses')}
                  emptyDescription={t('reports.noExpensesHelp')}
                  emptyIcon={<PieChart size={24} />}
                />
                <ReportListCard
                  title={t('reports.paymentBreakdown')}
                  description={t('reports.paymentBreakdownHelp')}
                  items={paymentItems}
                  emptyTitle={t('reports.noPayments')}
                  emptyDescription={t('reports.noPaymentsHelp')}
                  emptyIcon={<CreditCard size={24} />}
                />
                <ReportListCard
                  title={t('reports.cashierPerformance')}
                  description={t('reports.cashierPerformanceHelp')}
                  items={cashierItems}
                  emptyTitle={t('reports.noCashierSales')}
                  emptyDescription={t('reports.noCashierSalesHelp')}
                  emptyIcon={<Users size={24} />}
                />

                <SectionCard
                  title={t('reports.bestProducts')}
                  description={t('reports.bestProductsHelp')}
                  bodyPadding={false}
                >
                  {report.topProducts.length ? (
                    <div className="overflow-x-auto">
                      <table className="w-full min-w-[560px] border-collapse text-left text-sm">
                        <thead>
                          <tr className="border-b border-border-subtle bg-muted-surface">
                            {[
                              t('reports.rank'),
                              t('entity.product'),
                              t('reports.unitsSold'),
                              t('reports.totalSales'),
                            ].map((heading) => (
                              <th
                                key={heading}
                                className="px-4 py-3 text-xs font-bold uppercase tracking-wider text-text-secondary first:pl-8 last:pr-8"
                              >
                                {heading}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {report.topProducts.map((item, index) => (
                            <tr
                              key={item.name}
                              className="border-b border-border-subtle last:border-b-0 hover:bg-muted-surface"
                            >
                              <td className="px-4 py-4 pl-8">
                                <span className="inline-flex size-7 items-center justify-center rounded-full bg-muted-strong text-xs font-bold text-text-secondary">
                                  {index + 1}
                                </span>
                              </td>
                              <td className="px-4 py-4 font-semibold text-text-main">
                                {item.name}
                              </td>
                              <td className="px-4 py-4 text-right tabular-nums text-text-secondary">
                                {item.quantity}
                              </td>
                              <td className="px-4 py-4 pr-8 text-right font-bold tabular-nums text-text-main">
                                {money(item.total)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <EmptyState
                      title={t('reports.noProducts')}
                      description={t('reports.noProductsHelp')}
                      icon={<PackageSearch size={24} />}
                    />
                  )}
                </SectionCard>
              </div>
            )}
          </div>
        </PageContainer>
      </div>
    </main>
  );
}
