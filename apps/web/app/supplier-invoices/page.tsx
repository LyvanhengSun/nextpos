'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  CircleDollarSign,
  FileText,
  Plus,
  Search,
  WalletCards,
  X,
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
type Supplier = { id: string; name: string };
type PurchaseOrder = {
  id: string;
  reference: string | null;
  supplier: { name: string };
  status: string;
};
type Invoice = {
  id: string;
  invoiceNumber: string;
  total: number;
  dueDate: string | null;
  status: string;
  note: string | null;
  supplier: { name: string };
  branch: { name: string };
  purchaseOrder?: { reference: string | null } | null;
  payments: {
    id: string;
    amount: number;
    paymentMethod: string;
    paidAt: string;
  }[];
  credits: {
    id: string;
    amount: number;
    reference: string | null;
    createdAt: string;
  }[];
  match: {
    orderedTotal: number;
    receivedTotal: number;
    invoiceVariance: number;
    receiptVariance: number;
    hasUnreceivedQuantity: boolean;
  } | null;
  disputeStatus: string | null;
  disputeReason: string | null;
};
const money = (value: number) => `$${(value / 100).toFixed(2)}`;

function TablePager({
  total,
  page,
  pageSize,
  onPageChange,
  onPageSizeChange,
}: {
  total: number;
  page: number;
  pageSize: number;
  onPageChange: (value: number) => void;
  onPageSizeChange: (value: number) => void;
}) {
  const { t } = useI18n();
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const start = total ? (page - 1) * pageSize + 1 : 0;
  const end = Math.min(page * pageSize, total);
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border-subtle px-4 py-3 sm:px-8">
      <span className="text-xs text-text-muted">
        {t('purchaseOrders.showing')}{' '}
        <strong className="font-bold text-text-secondary">
          {start}–{end}
        </strong>{' '}
        {t('purchaseOrders.of')} <strong className="font-bold text-text-secondary">{total}</strong>
      </span>
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-2 text-xs text-text-muted">
          <span>{t('purchaseOrders.rows')}</span>
          <CustomSelect
            value={String(pageSize)}
            onChange={(value) => onPageSizeChange(Number(value))}
            options={['10', '25', '50'].map((value) => ({
              value,
              label: value,
            }))}
            className="w-18"
          />
        </div>
        <span className="text-xs text-text-muted">
          {t('purchaseOrders.pageCount', { page, pages })}
        </span>
        <Button
          aria-label={t('receiving.previousPage')}
          disabled={page === 1}
          onClick={() => onPageChange(page - 1)}
          variant="secondary"
          size="icon"
          className="size-8 shrink-0"
        >
          <ChevronLeft size={16} />
        </Button>
        <Button
          aria-label={t('receiving.nextPage')}
          disabled={page === pages}
          onClick={() => onPageChange(page + 1)}
          variant="secondary"
          size="icon"
          className="size-8 shrink-0"
        >
          <ChevronRight size={16} />
        </Button>
      </div>
    </div>
  );
}

export default function SupplierInvoicesPage() {
  const { t, locale } = useI18n();
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [orders, setOrders] = useState<PurchaseOrder[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [message, setMessage] = useState('');
  const [messageTone, setMessageTone] = useState<'success' | 'error'>(
    'success',
  );
  const [supplierId, setSupplierId] = useState('');
  const [purchaseOrderId, setPurchaseOrderId] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [paymentInvoice, setPaymentInvoice] = useState<Invoice | null>(null);
  const [amount, setAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('CASH');
  const [invoiceAction, setInvoiceAction] = useState<{
    invoice: Invoice;
    mode: 'credit' | 'dispute' | 'resolve';
  } | null>(null);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<'all' | 'open' | 'paid'>('all');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [isLoading, setIsLoading] = useState(true);
  const [isSavingInvoice, setIsSavingInvoice] = useState(false);
  const [isSavingPayment, setIsSavingPayment] = useState(false);
  const [isSavingAction, setIsSavingAction] = useState(false);
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
  function showMessage(text: string, tone: 'success' | 'error') {
    setMessage(text);
    setMessageTone(tone);
  }
  async function load() {
    setIsLoading(true);
    try {
      const [supplierResponse, orderResponse, invoiceResponse] =
        await Promise.all([
          fetch(`${api}/suppliers`, { headers }),
          fetch(`${api}/purchase-orders`, { headers }),
          fetch(`${api}/supplier-invoices`, { headers }),
        ]);
      if (!supplierResponse.ok || !orderResponse.ok || !invoiceResponse.ok) {
        throw new Error(t('supplierInvoices.error.signIn'));
      }

      const supplierData = await supplierResponse.json().catch(() => []);
      const orderData = await orderResponse.json().catch(() => []);
      const invoiceData = await invoiceResponse.json().catch(() => []);
      setSuppliers(Array.isArray(supplierData) ? supplierData : []);
      setOrders(Array.isArray(orderData) ? orderData : []);
      setInvoices(Array.isArray(invoiceData) ? invoiceData : []);
    } finally {
      setIsLoading(false);
    }
  }
  useEffect(() => {
    void load().catch((error: Error) => showMessage(error.message, 'error'));
  }, []);
  async function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const element = event.currentTarget;
    const form = Object.fromEntries(new FormData(element));
    if (!form.supplierId) {
      showMessage(t('supplierInvoices.error.selectSupplier'), 'error');
      return;
    }
    setIsSavingInvoice(true);
    try {
      const response = await fetch(`${api}/supplier-invoices`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          ...form,
          purchaseOrderId: form.purchaseOrderId || undefined,
          total: Math.round(Number(form.total) * 100),
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        showMessage(data.message ?? t('supplierInvoices.error.recordInvoice'), 'error');
        return;
      }
      element.reset();
      setSupplierId('');
      setPurchaseOrderId('');
      setDueDate('');
      showMessage(t('supplierInvoices.success.invoiceRecorded'), 'success');
      await load();
    } catch {
      showMessage(t('receiving.error.api'), 'error');
    } finally {
      setIsSavingInvoice(false);
    }
  }
  async function pay(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!paymentInvoice) return;
    setIsSavingPayment(true);
    const form = Object.fromEntries(new FormData(event.currentTarget));
    try {
      const response = await fetch(
        `${api}/supplier-invoices/${paymentInvoice.id}/payments`,
        {
          method: 'POST',
          headers,
          body: JSON.stringify({
            ...form,
            amount: Math.round(Number(amount) * 100),
          }),
        },
      );
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        showMessage(data.message ?? t('supplierInvoices.error.recordPayment'), 'error');
        return;
      }
      setPaymentInvoice(null);
      setAmount('');
      setPaymentMethod('CASH');
      showMessage(t('supplierInvoices.success.paymentRecorded'), 'success');
      await load();
    } catch {
      showMessage(t('receiving.error.api'), 'error');
    } finally {
      setIsSavingPayment(false);
    }
  }
  async function submitInvoiceAction(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!invoiceAction) return;
    const form = Object.fromEntries(new FormData(event.currentTarget));
    const isCredit = invoiceAction.mode === 'credit';
    const endpoint = isCredit
      ? 'credits'
      : invoiceAction.mode === 'resolve'
        ? 'resolve-dispute'
        : 'dispute';
    const payload = isCredit
      ? {
          amount: Math.round(Number(form.amount) * 100),
          reference: form.reference,
          note: form.note,
        }
      : { reason: form.reason, reference: form.reference };
    setIsSavingAction(true);
    try {
      const response = await fetch(
        `${api}/supplier-invoices/${invoiceAction.invoice.id}/${endpoint}`,
        { method: 'POST', headers, body: JSON.stringify(payload) },
      );
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        showMessage(
          data.message ??
            (isCredit
              ? t('supplierInvoices.error.recordCredit')
              : t('supplierInvoices.error.updateDispute')),
          'error',
        );
        return;
      }
      showMessage(
        isCredit
          ? t('supplierInvoices.success.creditRecorded')
          : invoiceAction.mode === 'resolve'
            ? t('supplierInvoices.success.disputeResolved')
            : t('supplierInvoices.success.disputeOpened'),
        'success',
      );
      setInvoiceAction(null);
      await load();
    } catch {
      showMessage(t('receiving.error.api'), 'error');
    } finally {
      setIsSavingAction(false);
    }
  }
  const balanceFor = (invoice: Invoice) =>
    invoice.total -
    invoice.payments.reduce((sum, payment) => sum + payment.amount, 0) -
    invoice.credits.reduce((sum, credit) => sum + credit.amount, 0);
  const outstanding = invoices.reduce(
    (sum, invoice) => sum + balanceFor(invoice),
    0,
  );
  const now = new Date();
  const overdue = invoices
    .filter(
      (invoice) =>
        balanceFor(invoice) > 0 &&
        invoice.dueDate &&
        new Date(invoice.dueDate) < now,
    )
    .reduce((sum, invoice) => sum + balanceFor(invoice), 0);
  const paidThisList = invoices.reduce(
    (sum, invoice) =>
      sum + invoice.payments.reduce((sub, payment) => sub + payment.amount, 0),
    0,
  );
  const filtered = useMemo(
    () =>
      invoices.filter((invoice) => {
        const balance = balanceFor(invoice);
        const search =
          `${invoice.invoiceNumber} ${invoice.supplier.name} ${invoice.purchaseOrder?.reference ?? ''}`.toLowerCase();
        return (
          (!query || search.includes(query.toLowerCase())) &&
          (filter === 'all' ||
            (filter === 'open' ? balance > 0 : balance === 0))
        );
      }),
    [invoices, query, filter],
  );
  const rows = filtered.slice((page - 1) * pageSize, page * pageSize);
  const statusBadge = (invoice: Invoice) => {
    const balance = balanceFor(invoice);
    const isOverdue =
      balance > 0 && invoice.dueDate && new Date(invoice.dueDate) < now;
    const status: ['success' | 'danger' | 'info' | 'warning', string] =
      balance === 0
        ? ['success', t('supplierInvoices.paid')]
        : isOverdue
          ? ['danger', t('supplierInvoices.overdue')]
          : invoice.status === 'PARTIALLY_PAID'
            ? ['info', t('supplierInvoices.partiallyPaid')]
            : ['warning', t('supplierInvoices.unpaid')];
    return <StatusBadge tone={status[0]}>{status[1]}</StatusBadge>;
  };
  const supplierOptions = suppliers.map((supplier) => ({
    value: supplier.id,
    label: supplier.name,
  }));
  const orderOptions = [
    { value: '', label: t('supplierInvoices.notLinked') },
    ...orders.map((order) => ({
      value: order.id,
      label: order.reference ?? t('supplierInvoices.orderNamed', { id: order.id.slice(-6) }),
      sublabel: `${order.supplier.name} · ${t(`purchaseOrders.status.${order.status}` as Parameters<typeof t>[0])}`,
    })),
  ];
  const paymentMethodOptions = [
    { value: 'CASH', label: t('supplierInvoices.cash') },
    { value: 'BANK', label: t('supplierInvoices.bankTransfer') },
    { value: 'CARD', label: t('supplierInvoices.card') },
    { value: 'KHQR', label: 'KHQR' },
  ];
  return (
    <main className="app-page">
      <PageHeading eyebrow={t('supplierInvoices.eyebrow')} title={t('supplierInvoices.title')} />

      <div>
        <PageContainer>
          {message && (
            <AlertBanner
              tone={messageTone}
              icon={
                messageTone === 'success' ? (
                  <CheckCircle2 size={18} />
                ) : (
                  <AlertCircle size={18} />
                )
              }
              className="mb-6"
            >
              {message}
            </AlertBanner>
          )}

          <section className="mb-6 grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3">
            <SummaryMetricCard
              title={t('supplierInvoices.outstandingBalance')}
              value={money(outstanding)}
              description={t('supplierInvoices.unpaid')}
              icon={<CircleDollarSign size={20} />}
              tone="amber"
            />
            <SummaryMetricCard
              title={t('supplierInvoices.overdueBalance')}
              value={money(overdue)}
              description={t('supplierInvoices.overdue')}
              icon={<FileText size={20} />}
              tone="rose"
            />
            <SummaryMetricCard
              title={t('supplierInvoices.paymentsRecorded')}
              value={money(paidThisList)}
              description={t('supplierInvoices.paid')}
              icon={<WalletCards size={20} />}
              tone="sky"
            />
          </section>

          <section className="mb-6 grid grid-cols-1 items-start gap-4 xl:grid-cols-[minmax(0,1.65fr)_minmax(17rem,1fr)]">
            <SectionCard
              title={t('supplierInvoices.recordInvoice')}
              description={t('supplierInvoices.recordInvoiceHelp')}
              icon={<FileText size={20} />}
              className="h-full"
            >
              <form
                onSubmit={create}
                autoComplete="off"
                className="grid grid-cols-1 items-start gap-x-4 gap-y-4 md:grid-cols-2"
              >
                <FormField label={t('entity.supplier')} id="supplierId" required>
                  <CustomSelect
                    name="supplierId"
                    value={supplierId}
                    onChange={setSupplierId}
                    options={supplierOptions}
                    placeholder={t('purchaseOrders.selectSupplier')}
                  />
                </FormField>
                <FormField label={t('supplierInvoices.invoiceNumber')} id="invoiceNumber" required>
                  <Input
                    required
                    id="invoiceNumber"
                    name="invoiceNumber"
                    placeholder={t('receiving.referencePlaceholder')}
                  />
                </FormField>
                <FormField label={t('supplierInvoices.totalUsd')} id="invoiceTotal" required>
                  <Input
                    required
                    id="invoiceTotal"
                    name="total"
                    type="number"
                    min="0.01"
                    step="0.01"
                    prefixText="$"
                    placeholder="0.00"
                  />
                </FormField>
                <FormField label={t('supplierInvoices.dueDate')} id="dueDate" sublabel={t('common.optional')}>
                  <DatePicker
                    id="dueDate"
                    name="dueDate"
                    value={dueDate}
                    onChange={setDueDate}
                    placeholder={t('supplierInvoices.selectDueDate')}
                  />
                </FormField>
                <FormField
                  label={t('dashboard.purchaseOrder')}
                  id="purchaseOrderId"
                  sublabel={t('common.optional')}
                  className="md:col-span-2"
                >
                  <CustomSelect
                    name="purchaseOrderId"
                    value={purchaseOrderId}
                    onChange={setPurchaseOrderId}
                    options={orderOptions}
                    placeholder={t('supplierInvoices.notLinked')}
                  />
                </FormField>
                <FormField
                  label={t('purchaseOrders.note')}
                  id="invoiceNote"
                  sublabel={t('common.optional')}
                  className="md:col-span-2"
                >
                  <Input
                    id="invoiceNote"
                    name="note"
                    placeholder={t('supplierInvoices.notePlaceholder')}
                  />
                </FormField>
                <div className="flex justify-end border-t border-border-subtle pt-5 md:col-span-2">
                  <Button type="submit" disabled={isSavingInvoice}>
                    <Plus size={16} />
                    {isSavingInvoice ? t('supplierInvoices.recording') : t('supplierInvoices.recordInvoice')}
                  </Button>
                </div>
              </form>
            </SectionCard>

            <SectionCard
              title={t('supplierInvoices.paymentFlow')}
              description={t('supplierInvoices.paymentSteps')}
              icon={<WalletCards size={20} />}
              className="h-full"
            >
              <div className="flex flex-col gap-5">
                {[
                  ['1', t('supplierInvoices.recordInvoice'), t('supplierInvoices.stepRecordHelp')],
                  ['2', t('supplierInvoices.payInvoice'), t('supplierInvoices.stepPayHelp')],
                  ['3', t('supplierInvoices.reviewBalance'), t('supplierInvoices.stepReviewHelp')],
                ].map(([number, title, text]) => (
                  <div key={number} className="flex gap-3">
                    <span className="grid size-7 shrink-0 place-items-center rounded-full bg-brand-subtle text-xs font-extrabold text-brand">
                      {number}
                    </span>
                    <div>
                      <p className="m-0 text-sm font-bold text-text-main">
                        {title}
                      </p>
                      <p className="mt-1 mb-0 text-xs leading-relaxed text-text-muted">
                        {text}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </SectionCard>
          </section>

          <SectionCard
            title={t('supplierInvoices.invoiceBalances')}
            description={t('supplierInvoices.invoiceCount', { shown: filtered.length, total: invoices.length })}
            icon={<FileText size={20} />}
            bodyPadding={false}
          >
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border-subtle px-4 py-6 sm:px-8">
              <Input
                type="search"
                value={query}
                onChange={(event) => {
                  setQuery(event.target.value);
                  setPage(1);
                }}
                placeholder={t('supplierInvoices.search')}
                prefixIcon={<Search size={16} />}
                wrapperClassName="min-w-60 max-w-md flex-1"
                aria-label={t('supplierInvoices.searchLabel')}
              />
              <div className="inline-flex rounded-md bg-muted-surface p-1">
                {(
                  [
                    { key: 'all', label: t('common.all') },
                    { key: 'open', label: t('purchaseOrders.open') },
                    { key: 'paid', label: t('supplierInvoices.paid') },
                  ] as const
                ).map((item) => (
                  <Button
                    key={item.key}
                    variant={filter === item.key ? 'secondary' : 'ghost'}
                    size="sm"
                    onClick={() => {
                      setFilter(item.key);
                      setPage(1);
                    }}
                  >
                    {item.label}
                  </Button>
                ))}
              </div>
            </div>
            {isLoading ? (
              <EmptyState
                title={t('supplierInvoices.loading')}
                description={t('supplierInvoices.pleaseWait')}
                icon={<FileText size={24} />}
              />
            ) : rows.length ? (
              <>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-5xl border-collapse text-sm">
                    <thead className="border-b border-border-subtle bg-muted-surface">
                      <tr>
                        {[
                          { label: t('supplierInvoices.invoice'), right: false },
                          { label: t('entity.supplier'), right: false },
                          { label: t('supplierInvoices.dueDate'), right: false },
                          { label: t('supplierInvoices.total'), right: true },
                          { label: t('supplierInvoices.paid'), right: true },
                          { label: t('supplierInvoices.balance'), right: true },
                          { label: t('purchaseOrders.status'), right: false },
                          { label: t('purchaseOrders.actions'), right: true },
                        ].map((heading) => (
                          <th
                            key={heading.label}
                            className={`px-4 py-3 text-xs font-bold uppercase tracking-wider text-text-secondary first:pl-4 last:pr-4 sm:first:pl-8 sm:last:pr-8 ${heading.right ? 'text-right' : 'text-left'}`}
                          >
                            {heading.label}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((invoice) => {
                        const paid = invoice.total - balanceFor(invoice);
                        const balance = balanceFor(invoice);
                        const hasMatchIssue =
                          !!invoice.match &&
                          (invoice.match.invoiceVariance !== 0 ||
                            invoice.match.hasUnreceivedQuantity);
                        return (
                          <tr
                            key={invoice.id}
                            className="border-b border-border-subtle last:border-b-0 hover:bg-muted-surface"
                          >
                            <td className="py-4 pr-4 pl-4 sm:pl-8">
                              <p className="m-0 font-bold text-text-main">
                                {invoice.invoiceNumber}
                              </p>
                              <p className="mt-1 mb-0 text-xs text-text-muted">
                                {invoice.purchaseOrder?.reference
                                  ? `PO · ${invoice.purchaseOrder.reference}`
                                  : invoice.branch.name}
                              </p>
                              {invoice.match && (
                                <p
                                  className={`mt-1 mb-0 text-xs font-bold ${hasMatchIssue ? 'text-warning' : 'text-brand'}`}
                                >
                                  {hasMatchIssue
                                    ? t('supplierInvoices.matchReview', {
                                        variance: invoice.match.invoiceVariance
                                          ? ` · ${t('supplierInvoices.varianceVsPo', { amount: money(invoice.match.invoiceVariance) })}`
                                          : '',
                                        unreceived: invoice.match.hasUnreceivedQuantity
                                          ? ` · ${t('supplierInvoices.itemsUnreceived')}`
                                          : '',
                                      })
                                    : t('supplierInvoices.matchOk')}
                                </p>
                              )}
                            </td>
                            <td className="px-4 py-4 text-text-secondary">
                              {invoice.supplier.name}
                            </td>
                            <td className="px-4 py-4 text-text-muted">
                              {invoice.dueDate
                                ? new Date(invoice.dueDate).toLocaleDateString(locale === 'km' ? 'km-KH' : 'en-US')
                                : '—'}
                            </td>
                            <td className="px-4 py-4 text-right text-text-secondary">
                              {money(invoice.total)}
                            </td>
                            <td className="px-4 py-4 text-right font-bold text-brand">
                              {money(paid)}
                            </td>
                            <td
                              className={`px-4 py-4 text-right font-extrabold ${balance > 0 ? 'text-warning' : 'text-text-muted'}`}
                            >
                              {money(balance)}
                            </td>
                            <td className="px-4 py-4">
                              {statusBadge(invoice)}
                            </td>
                            <td className="py-4 pr-4 pl-4 sm:pr-8">
                              <div className="flex justify-end gap-2 whitespace-nowrap">
                                {balance > 0 && (
                                  <>
                                    <Button
                                      variant="successSubtle"
                                      size="sm"
                                      onClick={() => {
                                        setPaymentInvoice(invoice);
                                        setAmount((balance / 100).toFixed(2));
                                      }}
                                    >
                                      {t('supplierInvoices.pay')}
                                    </Button>
                                    <Button
                                      variant="secondary"
                                      size="sm"
                                      onClick={() =>
                                        setInvoiceAction({
                                          invoice,
                                          mode: 'credit',
                                        })
                                      }
                                    >
                                      {t('supplierInvoices.creditNote')}
                                    </Button>
                                    <Button
                                      variant="warningSubtle"
                                      size="sm"
                                      onClick={() =>
                                        setInvoiceAction({
                                          invoice,
                                          mode:
                                            invoice.disputeStatus === 'OPEN'
                                              ? 'resolve'
                                              : 'dispute',
                                        })
                                      }
                                    >
                                      {invoice.disputeStatus === 'OPEN'
                                        ? t('supplierInvoices.resolveDispute')
                                        : t('supplierInvoices.dispute')}
                                    </Button>
                                  </>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                <TablePager
                  total={filtered.length}
                  page={page}
                  pageSize={pageSize}
                  onPageChange={setPage}
                  onPageSizeChange={(size) => {
                    setPageSize(size);
                    setPage(1);
                  }}
                />
              </>
            ) : (
              <EmptyState
                title={t('supplierInvoices.empty')}
                description={t('supplierInvoices.emptyHelp')}
                icon={<FileText size={24} />}
              />
            )}
          </SectionCard>
        </PageContainer>
      </div>

      {paymentInvoice && (
        <div className="fixed inset-0 z-50 grid place-items-center p-4">
          <Button
            variant="overlay"
            className="absolute inset-0 h-full w-full rounded-none"
            aria-label={t('supplierInvoices.closePaymentDialog')}
            onClick={() => setPaymentInvoice(null)}
          >
            <span className="sr-only">{t('supplierInvoices.closePaymentDialog')}</span>
          </Button>
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="payment-dialog-title"
            className="relative z-10 max-h-[calc(100dvh-2rem)] w-full max-w-2xl overflow-y-auto rounded-lg border border-border-subtle bg-card shadow-xl"
          >
            <header className="flex items-start justify-between gap-4 border-b border-border-subtle px-4 py-4 sm:px-8 sm:py-6">
              <div>
                <h2
                  id="payment-dialog-title"
                  className="m-0 text-base font-bold tracking-tight text-text-main sm:text-lg"
                >
                  {t('supplierInvoices.recordPayment')} · {paymentInvoice.invoiceNumber}
                </h2>
                <p className="mt-1 mb-0 text-xs text-text-muted">
                  {paymentInvoice.supplier.name} · {t('supplierInvoices.remaining')}{' '}
                  <strong className="text-brand">
                    {money(balanceFor(paymentInvoice))}
                  </strong>
                </p>
              </div>
              <Button
                variant="iconBareDanger"
                size="bareIcon"
                aria-label={t('supplierInvoices.closePayment')}
                onClick={() => setPaymentInvoice(null)}
              >
                <X size={18} />
              </Button>
            </header>
            <form
              onSubmit={pay}
              className="grid grid-cols-1 items-start gap-4 px-4 py-6 sm:grid-cols-2 sm:px-8"
            >
              <FormField label={t('supplierInvoices.amountUsd')} id="paymentAmount" required>
                <Input
                  required
                  id="paymentAmount"
                  type="number"
                  min="0.01"
                  max={(balanceFor(paymentInvoice) / 100).toFixed(2)}
                  step="0.01"
                  value={amount}
                  onChange={(event) => setAmount(event.target.value)}
                  prefixText="$"
                />
              </FormField>
              <FormField label={t('supplierInvoices.paymentMethod')} id="paymentMethod" required>
                <CustomSelect
                  name="paymentMethod"
                  value={paymentMethod}
                  onChange={setPaymentMethod}
                  options={paymentMethodOptions}
                />
              </FormField>
              <FormField
                label={t('purchaseOrders.note')}
                id="paymentNote"
                sublabel={t('common.optional')}
                className="sm:col-span-2"
              >
                <Input
                  id="paymentNote"
                  name="note"
                  placeholder={t('supplierInvoices.paymentNotePlaceholder')}
                />
              </FormField>
              {paymentInvoice.match &&
                (paymentInvoice.match.invoiceVariance !== 0 ||
                  paymentInvoice.match.hasUnreceivedQuantity) && (
                  <FormField
                    label={t('supplierInvoices.overrideReason')}
                    id="overrideReason"
                    required
                    help={t('supplierInvoices.explainVariance')}
                    className="sm:col-span-2"
                  >
                    <Input required id="overrideReason" name="overrideReason" />
                  </FormField>
                )}
              <div className="flex justify-end gap-2 border-t border-border-subtle pt-5 sm:col-span-2">
                <Button
                  variant="secondary"
                  onClick={() => setPaymentInvoice(null)}
                >
                  {t('common.cancel')}
                </Button>
                <Button type="submit" disabled={isSavingPayment}>
                  {isSavingPayment ? t('supplierInvoices.recording') : t('supplierInvoices.recordPayment')}
                </Button>
              </div>
            </form>
          </section>
        </div>
      )}

      {invoiceAction && (
        <div className="fixed inset-0 z-50 grid place-items-center p-4">
          <Button
            variant="overlay"
            className="absolute inset-0 h-full w-full rounded-none"
            aria-label={t('supplierInvoices.closeActionDialog')}
            onClick={() => setInvoiceAction(null)}
          >
            <span className="sr-only">{t('supplierInvoices.closeActionDialog')}</span>
          </Button>
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="invoice-action-title"
            className="relative z-10 max-h-[calc(100dvh-2rem)] w-full max-w-lg overflow-y-auto rounded-lg border border-border-subtle bg-card shadow-xl"
          >
            <header className="flex items-start justify-between gap-4 border-b border-border-subtle px-4 py-4 sm:px-8 sm:py-6">
              <div>
                <h2
                  id="invoice-action-title"
                  className="m-0 text-base font-bold tracking-tight text-text-main sm:text-lg"
                >
                  {invoiceAction.mode === 'credit'
                    ? t('supplierInvoices.recordCreditNote')
                    : invoiceAction.mode === 'resolve'
                      ? t('supplierInvoices.resolveDispute')
                      : t('supplierInvoices.openDispute')}
                </h2>
                <p className="mt-1 mb-0 text-xs text-text-muted">
                  {t('supplierInvoices.invoice')} {invoiceAction.invoice.invoiceNumber} ·{' '}
                  {invoiceAction.invoice.supplier.name}
                </p>
              </div>
              <Button
                variant="iconBareDanger"
                size="bareIcon"
                aria-label={t('supplierInvoices.closeDialog')}
                onClick={() => setInvoiceAction(null)}
              >
                <X size={18} />
              </Button>
            </header>
            <form
              onSubmit={submitInvoiceAction}
              className="flex flex-col gap-4 px-4 py-6 sm:px-8"
            >
              {invoiceAction.mode === 'credit' ? (
                <>
                  <FormField
                    label={t('supplierInvoices.creditAmountUsd')}
                    id="creditAmount"
                    required
                  >
                    <Input
                      required
                      id="creditAmount"
                      name="amount"
                      type="number"
                      min="0.01"
                      step="0.01"
                      prefixText="$"
                    />
                  </FormField>
                  <FormField
                    label={t('suppliers.reference')}
                    id="creditReference"
                    sublabel={t('common.optional')}
                  >
                    <Input id="creditReference" name="reference" />
                  </FormField>
                  <FormField label={t('purchaseOrders.note')} id="creditNote" sublabel={t('common.optional')}>
                    <Input id="creditNote" name="note" />
                  </FormField>
                </>
              ) : (
                <>
                  <FormField
                    label={
                      invoiceAction.mode === 'resolve'
                        ? t('supplierInvoices.resolutionNote')
                        : t('supplierInvoices.disputeReason')
                    }
                    id="disputeReason"
                    required
                  >
                    <Input required id="disputeReason" name="reason" />
                  </FormField>
                  <FormField
                    label={t('purchaseOrders.supplierReference')}
                    id="disputeReference"
                    sublabel={t('common.optional')}
                  >
                    <Input id="disputeReference" name="reference" />
                  </FormField>
                </>
              )}
              <div className="flex justify-end gap-2 border-t border-border-subtle pt-5">
                <Button
                  variant="secondary"
                  onClick={() => setInvoiceAction(null)}
                >
                  {t('common.cancel')}
                </Button>
                <Button
                  type="submit"
                  variant={
                    invoiceAction.mode === 'dispute'
                      ? 'warningSubtle'
                      : 'primary'
                  }
                  disabled={isSavingAction}
                >
                  {isSavingAction
                    ? t('common.saving')
                    : invoiceAction.mode === 'credit'
                      ? t('supplierInvoices.recordCredit')
                      : invoiceAction.mode === 'resolve'
                        ? t('supplierInvoices.resolveDispute')
                        : t('supplierInvoices.openDispute')}
                </Button>
              </div>
            </form>
          </section>
        </div>
      )}
    </main>
  );
}
