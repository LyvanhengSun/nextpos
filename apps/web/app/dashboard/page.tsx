'use client';

import { FormEvent, ReactNode, useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  AlertCircle,
  AlertTriangle,
  Archive,
  BarChart3,
  Calculator,
  CheckCircle2,
  Clock,
  Package,
  ReceiptText,
  TrendingUp,
  X,
} from 'lucide-react';

import {
  Button,
  ButtonLink,
  FormField,
  PageHeading,
  SectionCard,
  SummaryMetricCard,
  Textarea,
} from '../../components/ui/';
import { PageContainer } from '../../components/layout/page-container';
import type { SalesTrendPoint } from '../../components/dashboard/sales-trend-chart';

const SalesTrendChart = dynamic(
  () =>
    import('../../components/dashboard/sales-trend-chart').then(
      (module) => module.SalesTrendChart,
    ),
  {
    ssr: false,
    loading: () => (
      <SectionCard
        title="7-day sales trend"
        description="Daily completed revenue and transaction activity."
        bodyClassName="h-64 animate-pulse bg-muted-surface sm:h-72"
      >
        <span className="sr-only">Loading sales trend</span>
      </SectionCard>
    ),
  },
);

const api = '/api';

type Overview = {
  salesTotal: number;
  transactionCount: number;
  salesTrend: SalesTrendPoint[];
  payments: { method: string; total: number }[];
  lowStock: { product: string; quantity: number; reorderLevel: number }[];
  openShifts: {
    id: string;
    cashier: string;
    branch: string;
    openingCash: number;
    openedAt: string;
  }[];
  recentSales: {
    id: string;
    total: number;
    paymentMethod: string;
    createdAt: string;
    branch: string;
    cashier: string;
  }[];
  procurementAlerts: {
    pendingPurchaseOrderApprovals: {
      id: string;
      reference: string | null;
      supplier: string;
      submittedAt: string | null;
      submittedBy: string;
      total: number;
    }[];
    overduePurchaseOrders: {
      id: string;
      reference: string | null;
      supplier: string;
      expectedDeliveryDate: string | null;
    }[];
    upcomingPurchaseOrders: {
      id: string;
      reference: string | null;
      supplier: string;
      expectedDeliveryDate: string | null;
    }[];
    overdueSupplierInvoices: {
      id: string;
      invoiceNumber: string;
      supplier: string;
      dueDate: string | null;
      balance: number;
    }[];
  };
};

type AlertListProps<T extends { id: string }> = {
  title: string;
  empty: string;
  toneClassName: string;
  href: string;
  items: T[];
  render: (item: T) => ReactNode;
};

type PendingPurchaseOrderApproval =
  Overview['procurementAlerts']['pendingPurchaseOrderApprovals'][number];

const dashboardActionLinkClass =
  'rounded-sm text-xs font-bold text-brand no-underline transition hover:text-brand-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/20';
const dashboardEmptyTextClass = 'm-0 text-sm text-text-muted';
const dashboardListRowClass =
  'rounded-lg border px-4 py-3 text-sm transition hover:bg-muted-surface';
const dashboardStackClass = 'flex flex-col gap-5';
const dashboardTwoColumnGridClass = 'grid grid-cols-1 gap-5 lg:grid-cols-2';

function DashboardNotice({
  message,
  type,
  onDismiss,
}: {
  message: string;
  type: 'success' | 'error';
  onDismiss: () => void;
}) {
  return (
    <div
      className={`flex items-center gap-2.5 rounded-lg border px-4 py-3 text-sm font-medium ${
        type === 'error'
          ? 'border-rose-200 bg-rose-50 text-rose-600'
          : 'border-emerald-200 bg-emerald-50 text-brand'
      }`}
    >
      {type === 'error' ? (
        <AlertCircle size={18} />
      ) : (
        <CheckCircle2 size={18} />
      )}
      <span className="flex-1">{message}</span>
      <Button
        variant="ghost"
        size="bareIcon"
        onClick={onDismiss}
        className="shrink-0 text-inherit hover:bg-transparent"
        aria-label="Dismiss message"
      >
        <X size={16} />
      </Button>
    </div>
  );
}

function EmptyText({ children }: { children: ReactNode }) {
  return <p className={dashboardEmptyTextClass}>{children}</p>;
}

function DashboardActionLink({
  href,
  children,
  strong = false,
}: {
  href: string;
  children: ReactNode;
  strong?: boolean;
}) {
  return (
    <Link
      href={href}
      className={`${dashboardActionLinkClass} ${strong ? 'font-bold' : ''}`}
    >
      {children}
    </Link>
  );
}

function QuickActions() {
  return (
    <div className="flex flex-nowrap gap-2 overflow-x-auto overflow-y-hidden pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden [&>a]:shrink-0">
      <ButtonLink href="/pos">
        <Calculator size={16} />
        Open POS
      </ButtonLink>
      <ButtonLink href="/products" variant="secondary">
        <Package size={16} />
        Products
      </ButtonLink>
      <ButtonLink href="/inventory" variant="secondary">
        <Archive size={16} />
        Inventory
      </ButtonLink>
      <ButtonLink href="/reports" variant="secondary">
        <BarChart3 size={16} />
        Daily Report
      </ButtonLink>
    </div>
  );
}

function AlertList<T extends { id: string }>({
  title,
  empty,
  toneClassName,
  href,
  items,
  render,
}: AlertListProps<T>) {
  return (
    <div className="rounded-lg border border-border-subtle p-4">
      <p
        className={`mb-3 text-xs font-bold uppercase tracking-wider ${toneClassName}`}
      >
        {title}
      </p>
      {items.length ? (
        <div className="flex flex-col gap-2">
          {items.map((item) => (
            <Link
              key={item.id}
              href={href}
              className="rounded-md px-2 py-1.5 text-xs text-text-secondary no-underline transition hover:bg-muted-surface hover:text-text-main"
            >
              {render(item)}
            </Link>
          ))}
        </div>
      ) : (
        <p className="m-0 text-xs text-text-muted">{empty}</p>
      )}
    </div>
  );
}

function OpenShiftsCard({
  shifts,
  amount,
}: {
  shifts: Overview['openShifts'];
  amount: (value: number) => string;
}) {
  return (
    <SectionCard
      title="Open Cash Shifts"
      actions={
        <DashboardActionLink href="/shifts">
          Manage shifts →
        </DashboardActionLink>
      }
      bodyClassName="space-y-2"
    >
      {shifts.length ? (
        shifts.map((shift) => (
          <div
            key={shift.id}
            className={`${dashboardListRowClass} grid grid-cols-1 gap-1 border-border-subtle bg-card sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] sm:items-center sm:gap-3`}
          >
            <span className="font-semibold text-text-main">
              {shift.cashier}
            </span>
            <span className="text-text-muted">{shift.branch}</span>
            <span className="font-bold text-brand sm:text-right">
              Opening: {amount(shift.openingCash)}
            </span>
          </div>
        ))
      ) : (
        <EmptyText>No open shifts currently.</EmptyText>
      )}
    </SectionCard>
  );
}

function LowStockCard({ items }: { items: Overview['lowStock'] }) {
  return (
    <SectionCard
      title="Low Stock Alerts"
      actions={
        <DashboardActionLink href="/inventory">Inventory →</DashboardActionLink>
      }
      bodyClassName="space-y-2"
    >
      {items.length ? (
        items.map((item) => (
          <div
            key={item.product}
            className={`${dashboardListRowClass} flex flex-wrap items-center justify-between gap-2 border-amber-200 bg-amber-50`}
          >
            <span className="font-semibold text-amber-900">{item.product}</span>
            <span className="font-bold text-rose-600">
              {item.quantity} remaining (Alert @ {item.reorderLevel})
            </span>
          </div>
        ))
      ) : (
        <EmptyText>All products are adequately stocked.</EmptyText>
      )}
    </SectionCard>
  );
}

function paymentMethodLabel(value: string) {
  return value
    .toLowerCase()
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function RecentSalesCard({
  sales,
  amount,
}: {
  sales: Overview['recentSales'];
  amount: (value: number) => string;
}) {
  return (
    <SectionCard
      title="Recent sales"
      description="Latest completed transactions across your active scope."
      actions={
        <DashboardActionLink href="/sales">View sales →</DashboardActionLink>
      }
      bodyPadding={false}
    >
      {sales.length ? (
        <div>
          <div className="hidden grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)_minmax(7rem,0.65fr)_auto] gap-4 border-b border-border-subtle bg-muted-surface px-8 py-3 text-xs font-bold uppercase tracking-wider text-text-secondary sm:grid">
            <span>Sale</span>
            <span>Branch</span>
            <span>Payment</span>
            <span className="text-right">Total</span>
          </div>
          <div className="divide-y divide-border-subtle">
            {sales.map((sale) => {
              const createdAt = new Date(sale.createdAt);
              const saleNumber = sale.id.slice(-6).toUpperCase();

              return (
                <Link
                  key={sale.id}
                  href={`/receipt/${sale.id}`}
                  className="grid grid-cols-[minmax(0,1fr)_auto] gap-x-4 gap-y-2 px-4 py-4 text-sm no-underline transition hover:bg-muted-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand/20 sm:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)_minmax(7rem,0.65fr)_auto] sm:items-center sm:px-8"
                >
                  <span className="flex min-w-0 items-center gap-3">
                    <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-brand-soft text-brand">
                      <ReceiptText size={17} aria-hidden="true" />
                    </span>
                    <span className="min-w-0">
                      <strong className="block truncate font-bold text-text-main">
                        Sale #{saleNumber}
                      </strong>
                      <span className="mt-0.5 block text-xs text-text-muted">
                        {createdAt.toLocaleDateString(undefined, {
                          month: 'short',
                          day: 'numeric',
                        })}{' '}
                        ·{' '}
                        {createdAt.toLocaleTimeString(undefined, {
                          hour: 'numeric',
                          minute: '2-digit',
                        })}
                      </span>
                    </span>
                  </span>
                  <strong className="row-span-2 self-center text-right text-base font-bold text-text-main sm:order-4 sm:row-span-1">
                    {amount(sale.total)}
                  </strong>
                  <span className="min-w-0 pl-12 text-xs text-text-secondary sm:order-2 sm:pl-0 sm:text-sm">
                    <span className="block truncate font-semibold text-text-main">
                      {sale.branch}
                    </span>
                    <span className="mt-0.5 block truncate text-text-muted">
                      {sale.cashier}
                    </span>
                  </span>
                  <span className="pl-12 text-xs font-bold text-text-secondary sm:order-3 sm:pl-0 sm:text-sm">
                    {paymentMethodLabel(sale.paymentMethod)}
                  </span>
                </Link>
              );
            })}
          </div>
        </div>
      ) : (
        <div className="px-4 py-6 sm:px-8">
          <EmptyText>No completed sales yet.</EmptyText>
        </div>
      )}
    </SectionCard>
  );
}

function DashboardMetricsGrid({
  overview,
  amount,
}: {
  overview: Overview | null;
  amount: (value: number) => string;
}) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:gap-5 md:grid-cols-2 xl:grid-cols-4">
      <SummaryMetricCard
        title="Today's revenue"
        value={amount(overview?.salesTotal ?? 0)}
        description={
          overview?.payments.length
            ? overview.payments
                .map((payment) => `${payment.method}: ${amount(payment.total)}`)
                .join(' · ')
            : 'No sales today'
        }
        icon={<TrendingUp size={20} />}
        tone="purple"
      />
      <SummaryMetricCard
        title="Total transactions"
        value={overview?.transactionCount ?? 0}
        description="Completed orders"
        icon={<Calculator size={20} />}
        tone="amber"
      />
      <SummaryMetricCard
        title="Average ticket"
        value={amount(
          overview?.transactionCount
            ? Math.round((overview.salesTotal ?? 0) / overview.transactionCount)
            : 0,
        )}
        description="Average per order"
        icon={<BarChart3 size={20} />}
        tone="sky"
      />
      <SummaryMetricCard
        title="Open cash shifts"
        value={overview?.openShifts.length ?? 0}
        description="Active registers"
        icon={<Clock size={20} />}
        tone="emerald"
      />
    </div>
  );
}

function PurchaseOrderApprovalsCard({
  approvals,
  amount,
  dateLabel,
  onApprove,
  onReject,
}: {
  approvals: PendingPurchaseOrderApproval[];
  amount: (value: number) => string;
  dateLabel: (value: string | null) => string;
  onApprove: (id: string, reference: string | null) => void;
  onReject: (id: string, reference: string | null) => void;
}) {
  if (!approvals.length) return null;

  return (
    <section className="rounded-lg border border-amber-200 bg-amber-50 p-5 shadow-sm">
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h3 className="m-0 flex items-center gap-2 text-base font-bold text-amber-900">
            <AlertTriangle size={16} />
            Purchase-order approvals ({approvals.length})
          </h3>
          <p className="mt-1 mb-0 text-xs text-amber-700">
            Submitted orders need your approval before they can be received.
          </p>
        </div>
        <DashboardActionLink href="/purchase-orders" strong>
          View all →
        </DashboardActionLink>
      </div>
      <div className="flex flex-col gap-2">
        {approvals.map((order) => (
          <div
            key={order.id}
            className="flex flex-col gap-3 rounded-lg border border-amber-200 bg-card p-4 sm:flex-row sm:items-center sm:justify-between"
          >
            <div className="min-w-0">
              <strong className="block text-sm text-text-main">
                {order.reference || 'Purchase order'} · {order.supplier}
              </strong>
              <span className="mt-1 block text-xs text-text-muted">
                Submitted by {order.submittedBy}{' '}
                {order.submittedAt ? `· ${dateLabel(order.submittedAt)}` : ''} ·{' '}
                {amount(order.total)}
              </span>
            </div>
            <span className="flex shrink-0 flex-wrap gap-2">
              <Button
                type="button"
                onClick={() => onApprove(order.id, order.reference)}
                variant="successSubtle"
                size="sm"
              >
                Approve & order
              </Button>
              <Button
                type="button"
                onClick={() => onReject(order.id, order.reference)}
                variant="dangerSubtle"
                size="sm"
              >
                Request changes
              </Button>
            </span>
          </div>
        ))}
      </div>
    </section>
  );
}

function ProcurementAlertsCard({
  overview,
  amount,
  dateLabel,
}: {
  overview: Overview | null;
  amount: (value: number) => string;
  dateLabel: (value: string | null) => string;
}) {
  const alerts = overview?.procurementAlerts;
  const hasNoAlerts =
    overview &&
    alerts &&
    !alerts.overduePurchaseOrders.length &&
    !alerts.upcomingPurchaseOrders.length &&
    !alerts.overdueSupplierInvoices.length;

  return (
    <SectionCard
      title="Procurement Alerts"
      actions={
        <div className="flex flex-wrap gap-3">
          <DashboardActionLink href="/purchase-orders">
            Purchase orders →
          </DashboardActionLink>
          <DashboardActionLink href="/supplier-invoices">
            Invoices →
          </DashboardActionLink>
        </div>
      }
    >
      {hasNoAlerts ? (
        <EmptyText>
          No overdue orders, upcoming deliveries, or overdue supplier invoices.
        </EmptyText>
      ) : (
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
          <AlertList
            title="Overdue deliveries"
            empty="No overdue purchase orders."
            toneClassName="text-red-600"
            href="/purchase-orders"
            items={alerts?.overduePurchaseOrders ?? []}
            render={(order) => (
              <>
                <strong>{order.reference || 'Purchase order'}</strong>
                <span>
                  {order.supplier} · due {dateLabel(order.expectedDeliveryDate)}
                </span>
              </>
            )}
          />
          <AlertList
            title="Due this week"
            empty="No upcoming deliveries."
            toneClassName="text-amber-600"
            href="/purchase-orders"
            items={alerts?.upcomingPurchaseOrders ?? []}
            render={(order) => (
              <>
                <strong>{order.reference || 'Purchase order'}</strong>
                <span>
                  {order.supplier} · due {dateLabel(order.expectedDeliveryDate)}
                </span>
              </>
            )}
          />
          <AlertList
            title="Overdue invoices"
            empty="No overdue supplier invoices."
            toneClassName="text-red-600"
            href="/supplier-invoices"
            items={alerts?.overdueSupplierInvoices ?? []}
            render={(invoice) => (
              <>
                <strong>{invoice.invoiceNumber}</strong>
                <span>
                  {invoice.supplier} · {amount(invoice.balance)} outstanding
                </span>
              </>
            )}
          />
        </div>
      )}
    </SectionCard>
  );
}

export default function DashboardPage() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [role, setRole] = useState('');
  const [overview, setOverview] = useState<Overview | null>(null);
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState<'success' | 'error'>(
    'success',
  );
  const [rejectionTarget, setRejectionTarget] = useState<{
    id: string;
    reference: string | null;
  } | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');

  const getAccessToken = () => {
    if (typeof window === 'undefined') return '';
    return (
      sessionStorage.getItem('pos_access_token') ??
      localStorage.getItem('pos_access_token') ??
      ''
    );
  };

  const request = (path: string, options?: RequestInit) =>
    fetch(`${api}${path}`, {
      ...options,
      headers: {
        Authorization: `Bearer ${getAccessToken()}`,
        'Content-Type': 'application/json',
        ...options?.headers,
      },
    });

  function notify(msg: string, type: 'success' | 'error' = 'success') {
    setMessage(msg);
    setMessageType(type);
  }

  async function load() {
    try {
      const meResponse = await request('/auth/me');
      if (!meResponse.ok) {
        router.replace('/login');
        return;
      }
      const user = await meResponse.json();
      const userRole = String(user.role ?? '').toUpperCase();
      setName(user.firstName);
      setRole(userRole);

      if (userRole === 'CASHIER') {
        router.replace('/pos');
        return;
      }

      const overviewResponse = await request('/reports/overview');

      if (overviewResponse.ok) setOverview(await overviewResponse.json());
    } catch (error) {
      notify(
        error instanceof Error ? error.message : 'Unable to load dashboard.',
        'error',
      );
    }
  }

  useEffect(() => {
    void load();
  }, []);

  async function approvePurchaseOrder(id: string, reference: string | null) {
    const response = await request(`/purchase-orders/${id}/approve`, {
      method: 'POST',
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      notify(data.message ?? 'Unable to approve this purchase order.', 'error');
      return;
    }
    notify(`${reference || 'Purchase order'} approved and marked as ordered.`);
    await load();
  }

  async function rejectPurchaseOrder(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!rejectionTarget || !rejectionReason.trim()) return;
    const response = await request(
      `/purchase-orders/${rejectionTarget.id}/reject`,
      {
        method: 'POST',
        body: JSON.stringify({ reason: rejectionReason.trim() }),
      },
    );
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      notify(data.message ?? 'Unable to reject this purchase order.', 'error');
      return;
    }
    notify(
      `${rejectionTarget.reference || 'Purchase order'} returned to draft for revision.`,
    );
    setRejectionTarget(null);
    setRejectionReason('');
    await load();
  }

  const amount = (value: number) => `$${(value / 100).toFixed(2)}`;
  const dateLabel = (value: string | null) =>
    value ? new Date(value).toLocaleDateString() : 'No date';
  const roleLabel =
    role === 'OWNER' ? 'Owner' : role === 'MANAGER' ? 'Manager' : 'User';
  return (
    <main className="w-full pb-16">
      <PageHeading
        eyebrow={`${roleLabel} dashboard`}
        title={`Welcome, ${name || roleLabel}`}
      />

      <div className="py-6">
        <PageContainer>
          <div className={dashboardStackClass}>
            {message && (
              <DashboardNotice
                message={message}
                type={messageType}
                onDismiss={() => setMessage('')}
              />
            )}

            <QuickActions />

            <DashboardMetricsGrid overview={overview} amount={amount} />

            <SalesTrendChart data={overview?.salesTrend ?? []} />

            <RecentSalesCard
              sales={overview?.recentSales ?? []}
              amount={amount}
            />

            <div className={dashboardTwoColumnGridClass}>
              <OpenShiftsCard
                shifts={overview?.openShifts ?? []}
                amount={amount}
              />
              <LowStockCard items={overview?.lowStock ?? []} />
            </div>

            {role === 'OWNER' && (
              <PurchaseOrderApprovalsCard
                approvals={
                  overview?.procurementAlerts.pendingPurchaseOrderApprovals ??
                  []
                }
                amount={amount}
                dateLabel={dateLabel}
                onApprove={(id, reference) =>
                  void approvePurchaseOrder(id, reference)
                }
                onReject={(id, reference) => {
                  setRejectionTarget({ id, reference });
                  setRejectionReason('');
                }}
              />
            )}

            <ProcurementAlertsCard
              overview={overview}
              amount={amount}
              dateLabel={dateLabel}
            />
          </div>
        </PageContainer>
      </div>

      {rejectionTarget && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Request purchase-order changes"
          className="fixed inset-0 z-[200] flex items-center justify-center bg-slate-950/45 p-4"
        >
          <form
            onSubmit={rejectPurchaseOrder}
            className="w-full max-w-md overflow-hidden rounded-lg border border-border-subtle bg-card shadow-xl"
          >
            <header className="border-b border-border-subtle px-4 py-6 sm:px-8">
              <h2 className="m-0 text-xl font-bold tracking-tight text-text-main">
                Request changes
              </h2>
              <p className="mt-1 mb-0 text-xs text-text-muted">
                Explain what must be revised before this order can be approved.
              </p>
            </header>
            <div className="px-4 py-6 sm:px-8">
              <FormField label="Revision reason" required id="rejection-reason">
                <Textarea
                  id="rejection-reason"
                  required
                  autoFocus
                  value={rejectionReason}
                  onChange={(event) => setRejectionReason(event.target.value)}
                  placeholder="e.g. Confirm the item quantity and supplier cost"
                  rows={4}
                />
              </FormField>
            </div>
            <footer className="flex flex-wrap justify-end gap-2 border-t border-border-subtle bg-muted-surface px-4 py-4 sm:px-8">
              <Button
                variant="secondary"
                onClick={() => {
                  setRejectionTarget(null);
                  setRejectionReason('');
                }}
              >
                Cancel
              </Button>
              <Button type="submit" variant="danger">
                Request changes
              </Button>
            </footer>
          </form>
        </div>
      )}
    </main>
  );
}
