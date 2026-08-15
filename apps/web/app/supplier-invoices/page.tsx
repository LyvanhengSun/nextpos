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
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const start = total ? (page - 1) * pageSize + 1 : 0;
  const end = Math.min(page * pageSize, total);
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border-subtle px-4 py-3 sm:px-8">
      <span className="text-xs text-text-muted">
        Showing{' '}
        <strong className="font-bold text-text-secondary">
          {start}–{end}
        </strong>{' '}
        of <strong className="font-bold text-text-secondary">{total}</strong>
      </span>
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-2 text-xs text-text-muted">
          <span>Rows</span>
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
          Page {page} of {pages}
        </span>
        <Button
          aria-label="Previous page"
          disabled={page === 1}
          onClick={() => onPageChange(page - 1)}
          variant="secondary"
          size="icon"
          className="size-8 shrink-0"
        >
          <ChevronLeft size={16} />
        </Button>
        <Button
          aria-label="Next page"
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
        throw new Error('Please sign in as Owner or Manager.');
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
      showMessage('Select a supplier.', 'error');
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
        showMessage(data.message ?? 'Unable to record invoice.', 'error');
        return;
      }
      element.reset();
      setSupplierId('');
      setPurchaseOrderId('');
      setDueDate('');
      showMessage('Supplier invoice recorded as unpaid.', 'success');
      await load();
    } catch {
      showMessage('The API server did not return a response.', 'error');
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
        showMessage(data.message ?? 'Unable to record payment.', 'error');
        return;
      }
      setPaymentInvoice(null);
      setAmount('');
      setPaymentMethod('CASH');
      showMessage('Supplier payment recorded.', 'success');
      await load();
    } catch {
      showMessage('The API server did not return a response.', 'error');
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
              ? 'Unable to record credit note.'
              : 'Unable to update invoice dispute.'),
          'error',
        );
        return;
      }
      showMessage(
        isCredit
          ? 'Supplier credit note recorded.'
          : invoiceAction.mode === 'resolve'
            ? 'Supplier dispute resolved.'
            : 'Supplier dispute opened; payment is now held.',
        'success',
      );
      setInvoiceAction(null);
      await load();
    } catch {
      showMessage('The API server did not return a response.', 'error');
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
        ? ['success', 'Paid']
        : isOverdue
          ? ['danger', 'Overdue']
          : invoice.status === 'PARTIALLY_PAID'
            ? ['info', 'Partially paid']
            : ['warning', 'Unpaid'];
    return <StatusBadge tone={status[0]}>{status[1]}</StatusBadge>;
  };
  const supplierOptions = suppliers.map((supplier) => ({
    value: supplier.id,
    label: supplier.name,
  }));
  const orderOptions = [
    { value: '', label: 'Not linked to a purchase order' },
    ...orders.map((order) => ({
      value: order.id,
      label: order.reference ?? `Order ${order.id.slice(-6)}`,
      sublabel: `${order.supplier.name} · ${order.status.replace(/_/g, ' ')}`,
    })),
  ];
  const paymentMethodOptions = [
    { value: 'CASH', label: 'Cash' },
    { value: 'BANK', label: 'Bank transfer' },
    { value: 'CARD', label: 'Card' },
    { value: 'KHQR', label: 'KHQR' },
  ];
  return (
    <main className="app-page">
      <PageHeading eyebrow="Supplier accounts" title="Supplier invoices" />

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
              title="Outstanding balance"
              value={money(outstanding)}
              description="Unpaid"
              icon={<CircleDollarSign size={20} />}
              tone="amber"
            />
            <SummaryMetricCard
              title="Overdue balance"
              value={money(overdue)}
              description="Overdue"
              icon={<FileText size={20} />}
              tone="rose"
            />
            <SummaryMetricCard
              title="Payments recorded"
              value={money(paidThisList)}
              description="Paid"
              icon={<WalletCards size={20} />}
              tone="sky"
            />
          </section>

          <section className="mb-6 grid grid-cols-1 items-start gap-4 xl:grid-cols-[minmax(0,1.65fr)_minmax(17rem,1fr)]">
            <SectionCard
              title="Record invoice"
              description="Add bill."
              icon={<FileText size={20} />}
              className="h-full"
            >
              <form
                onSubmit={create}
                autoComplete="off"
                className="grid grid-cols-1 items-start gap-x-4 gap-y-4 md:grid-cols-2"
              >
                <FormField label="Supplier" id="supplierId" required>
                  <CustomSelect
                    name="supplierId"
                    value={supplierId}
                    onChange={setSupplierId}
                    options={supplierOptions}
                    placeholder="Select supplier"
                  />
                </FormField>
                <FormField label="Invoice number" id="invoiceNumber" required>
                  <Input
                    required
                    id="invoiceNumber"
                    name="invoiceNumber"
                    placeholder="e.g. INV-2026-001"
                  />
                </FormField>
                <FormField label="Total (USD)" id="invoiceTotal" required>
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
                <FormField label="Due date" id="dueDate" sublabel="(optional)">
                  <DatePicker
                    id="dueDate"
                    name="dueDate"
                    value={dueDate}
                    onChange={setDueDate}
                    placeholder="Select due date"
                  />
                </FormField>
                <FormField
                  label="Purchase order"
                  id="purchaseOrderId"
                  sublabel="(optional)"
                  className="md:col-span-2"
                >
                  <CustomSelect
                    name="purchaseOrderId"
                    value={purchaseOrderId}
                    onChange={setPurchaseOrderId}
                    options={orderOptions}
                    placeholder="Not linked to a purchase order"
                  />
                </FormField>
                <FormField
                  label="Note"
                  id="invoiceNote"
                  sublabel="(optional)"
                  className="md:col-span-2"
                >
                  <Input
                    id="invoiceNote"
                    name="note"
                    placeholder="e.g. Payment terms: 30 days"
                  />
                </FormField>
                <div className="flex justify-end border-t border-border-subtle pt-5 md:col-span-2">
                  <Button type="submit" disabled={isSavingInvoice}>
                    <Plus size={16} />
                    {isSavingInvoice ? 'Recording…' : 'Record invoice'}
                  </Button>
                </div>
              </form>
            </SectionCard>

            <SectionCard
              title="Payment flow"
              description="Payment steps."
              icon={<WalletCards size={20} />}
              className="h-full"
            >
              <div className="flex flex-col gap-5">
                {[
                  ['1', 'Record invoice', 'Add total and due date.'],
                  ['2', 'Pay invoice', 'Record payment.'],
                  ['3', 'Review balance', 'Updated automatically.'],
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
            title="Invoice balances"
            description={`${filtered.length} of ${invoices.length} invoices`}
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
                placeholder="Search invoice, supplier, or order"
                prefixIcon={<Search size={16} />}
                wrapperClassName="min-w-60 max-w-md flex-1"
                aria-label="Search supplier invoices"
              />
              <div className="inline-flex rounded-md bg-muted-surface p-1">
                {(
                  [
                    { key: 'all', label: 'All' },
                    { key: 'open', label: 'Open' },
                    { key: 'paid', label: 'Paid' },
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
                title="Loading invoices"
                description="Please wait."
                icon={<FileText size={24} />}
              />
            ) : rows.length ? (
              <>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-5xl border-collapse text-sm">
                    <thead className="border-b border-border-subtle bg-muted-surface">
                      <tr>
                        {[
                          'Invoice',
                          'Supplier',
                          'Due date',
                          'Total',
                          'Paid',
                          'Balance',
                          'Status',
                          'Actions',
                        ].map((heading) => (
                          <th
                            key={heading}
                            className={`px-4 py-3 text-xs font-bold uppercase tracking-wider text-text-secondary first:pl-4 last:pr-4 sm:first:pl-8 sm:last:pr-8 ${['Total', 'Paid', 'Balance', 'Actions'].includes(heading) ? 'text-right' : 'text-left'}`}
                          >
                            {heading}
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
                                    ? `Match review${invoice.match.invoiceVariance ? ` · ${money(invoice.match.invoiceVariance)} vs PO` : ''}${invoice.match.hasUnreceivedQuantity ? ' · items unreceived' : ''}`
                                    : 'PO / receipt match'}
                                </p>
                              )}
                            </td>
                            <td className="px-4 py-4 text-text-secondary">
                              {invoice.supplier.name}
                            </td>
                            <td className="px-4 py-4 text-text-muted">
                              {invoice.dueDate
                                ? new Date(invoice.dueDate).toLocaleDateString()
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
                                      Pay
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
                                      Credit note
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
                                        ? 'Resolve dispute'
                                        : 'Dispute'}
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
                title="No invoices found"
                description="Try another search or filter."
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
            aria-label="Close payment dialog"
            onClick={() => setPaymentInvoice(null)}
          >
            <span className="sr-only">Close payment dialog</span>
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
                  Record payment · {paymentInvoice.invoiceNumber}
                </h2>
                <p className="mt-1 mb-0 text-xs text-text-muted">
                  {paymentInvoice.supplier.name} · Remaining{' '}
                  <strong className="text-brand">
                    {money(balanceFor(paymentInvoice))}
                  </strong>
                </p>
              </div>
              <Button
                variant="iconBareDanger"
                size="bareIcon"
                aria-label="Close payment"
                onClick={() => setPaymentInvoice(null)}
              >
                <X size={18} />
              </Button>
            </header>
            <form
              onSubmit={pay}
              className="grid grid-cols-1 items-start gap-4 px-4 py-6 sm:grid-cols-2 sm:px-8"
            >
              <FormField label="Amount (USD)" id="paymentAmount" required>
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
              <FormField label="Payment method" id="paymentMethod" required>
                <CustomSelect
                  name="paymentMethod"
                  value={paymentMethod}
                  onChange={setPaymentMethod}
                  options={paymentMethodOptions}
                />
              </FormField>
              <FormField
                label="Note"
                id="paymentNote"
                sublabel="(optional)"
                className="sm:col-span-2"
              >
                <Input
                  id="paymentNote"
                  name="note"
                  placeholder="e.g. Bank transfer receipt"
                />
              </FormField>
              {paymentInvoice.match &&
                (paymentInvoice.match.invoiceVariance !== 0 ||
                  paymentInvoice.match.hasUnreceivedQuantity) && (
                  <FormField
                    label="Owner override reason"
                    id="overrideReason"
                    required
                    help="Explain the variance."
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
                  Cancel
                </Button>
                <Button type="submit" disabled={isSavingPayment}>
                  {isSavingPayment ? 'Recording…' : 'Record payment'}
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
            aria-label="Close invoice action dialog"
            onClick={() => setInvoiceAction(null)}
          >
            <span className="sr-only">Close invoice action dialog</span>
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
                    ? 'Record credit note'
                    : invoiceAction.mode === 'resolve'
                      ? 'Resolve dispute'
                      : 'Open dispute'}
                </h2>
                <p className="mt-1 mb-0 text-xs text-text-muted">
                  Invoice {invoiceAction.invoice.invoiceNumber} ·{' '}
                  {invoiceAction.invoice.supplier.name}
                </p>
              </div>
              <Button
                variant="iconBareDanger"
                size="bareIcon"
                aria-label="Close dialog"
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
                    label="Credit amount (USD)"
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
                    label="Reference"
                    id="creditReference"
                    sublabel="(optional)"
                  >
                    <Input id="creditReference" name="reference" />
                  </FormField>
                  <FormField label="Note" id="creditNote" sublabel="(optional)">
                    <Input id="creditNote" name="note" />
                  </FormField>
                </>
              ) : (
                <>
                  <FormField
                    label={
                      invoiceAction.mode === 'resolve'
                        ? 'Resolution note'
                        : 'Dispute reason'
                    }
                    id="disputeReason"
                    required
                  >
                    <Input required id="disputeReason" name="reason" />
                  </FormField>
                  <FormField
                    label="Supplier reference"
                    id="disputeReference"
                    sublabel="(optional)"
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
                  Cancel
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
                    ? 'Saving…'
                    : invoiceAction.mode === 'credit'
                      ? 'Record credit'
                      : invoiceAction.mode === 'resolve'
                        ? 'Resolve dispute'
                        : 'Open dispute'}
                </Button>
              </div>
            </form>
          </section>
        </div>
      )}
    </main>
  );
}
