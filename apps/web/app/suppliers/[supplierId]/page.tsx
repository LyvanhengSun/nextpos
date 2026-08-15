'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, Package, ReceiptText, ShoppingCart } from 'lucide-react';
import {
  AlertBanner,
  Button,
  EmptyState,
  PageHeading,
  SectionCard,
} from '../../../components/ui/';
import { PageContainer } from '../../../components/layout/page-container';

const api = '/api';
type Detail = {
  supplier: {
    id: string;
    code: string;
    name: string;
    phone: string | null;
    email: string | null;
    address: string | null;
    isActive: boolean;
    createdAt: string;
  };
  catalogItems: {
    id: string;
    supplierSku: string | null;
    lastCost: number | null;
    isPreferred: boolean;
    product: { name: string; sku: string };
    variant: { name: string; sku: string } | null;
  }[];
  purchaseOrders: {
    id: string;
    reference: string | null;
    status: string;
    createdAt: string;
    items: {
      quantityOrdered: number;
      quantityReceived: number;
      unitCost: number | null;
    }[];
  }[];
  receipts: {
    id: string;
    createdAt: string;
    quantity: number;
    unitCost: number | null;
    reference: string | null;
    product: { name: string; sku: string };
    variant: { name: string; sku: string } | null;
  }[];
  invoices: {
    id: string;
    invoiceNumber: string;
    total: number;
    dueDate: string | null;
    status: string;
    createdAt: string;
    payments: { amount: number }[];
  }[];
};
const money = (value: number) => `$${(value / 100).toFixed(2)}`;

export default function SupplierDetailPage() {
  const router = useRouter();
  const { supplierId } = useParams<{ supplierId: string }>();
  const [detail, setDetail] = useState<Detail | null>(null);
  const [message, setMessage] = useState('');
  const token =
    typeof window === 'undefined'
      ? ''
      : (sessionStorage.getItem('pos_access_token') ??
        localStorage.getItem('pos_access_token') ??
        '');
  useEffect(() => {
    void fetch(`${api}/suppliers/${supplierId}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(async (response) => {
        const data = await response.json().catch(() => ({}));
        if (!response.ok)
          throw new Error(data.message ?? 'Unable to load supplier.');
        setDetail(data);
      })
      .catch((error: Error) => setMessage(error.message));
  }, [supplierId]);
  if (message)
    return (
      <main className="app-page">
        <PageHeading
          eyebrow="Supplier detail"
          title="Supplier unavailable"
          actions={
            <Button
              type="button"
              onClick={() => router.push('/suppliers')}
              variant="secondary"
              size="sm"
            >
              <ArrowLeft size={16} />
              Suppliers
            </Button>
          }
        />
        <div>
          <PageContainer>
            <AlertBanner tone="error">{message}</AlertBanner>
          </PageContainer>
        </div>
      </main>
    );
  if (!detail)
    return (
      <main className="app-page">
        <PageHeading eyebrow="Supplier detail" title="Loading supplier" />
        <div>
          <PageContainer>
            <section className="rounded-lg border border-border-subtle bg-card shadow-sm">
              <EmptyState title="Loading supplier…" />
            </section>
          </PageContainer>
        </div>
      </main>
    );
  const openBalance = detail.invoices.reduce(
    (sum, invoice) =>
      sum +
      Math.max(
        0,
        invoice.total -
          invoice.payments.reduce((paid, payment) => paid + payment.amount, 0),
      ),
    0,
  );
  return (
    <main className="app-page">
      <PageHeading
        eyebrow="Supplier detail"
        title={detail.supplier.name}
        actions={
          <Button
            type="button"
            onClick={() => router.push('/suppliers')}
            variant="secondary"
            size="sm"
          >
            <ArrowLeft size={16} />
            Suppliers
          </Button>
        }
      />
      <div>
        <PageContainer>
          <section className="flex flex-col gap-6">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              {[
                {
                  label: 'Linked products',
                  value: String(detail.catalogItems.length),
                  icon: Package,
                },
                {
                  label: 'Open invoice balance',
                  value: money(openBalance),
                  icon: ReceiptText,
                },
                {
                  label: 'Recent receipts',
                  value: String(detail.receipts.length),
                  icon: ShoppingCart,
                },
              ].map((stat) => (
                <article
                  key={stat.label}
                  className="flex items-center gap-3 rounded-lg border border-border-subtle bg-card px-4 py-5 shadow-sm sm:px-6"
                >
                  <div className="grid size-10 shrink-0 place-items-center rounded-md border border-brand/20 bg-brand-subtle text-brand">
                    <stat.icon size={17} />
                  </div>
                  <div>
                    <p className="m-0 text-xs font-medium text-text-muted">
                      {stat.label}
                    </p>
                    <strong className="mt-1 block text-xl font-bold tracking-tight text-text-main">
                      {stat.value}
                    </strong>
                  </div>
                </article>
              ))}
            </div>

            <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
              <SectionCard title="Received cost history" bodyPadding={false}>
                {detail.receipts.length ? (
                  <div>
                    {detail.receipts.map((receipt) => (
                      <div
                        key={receipt.id}
                        className="flex items-center justify-between gap-4 border-b border-border-subtle px-4 py-4 last:border-b-0 hover:bg-muted-surface sm:px-8"
                      >
                        <div>
                          <strong className="text-sm font-bold text-text-main">
                            {receipt.product.name}
                            {receipt.variant
                              ? ` · ${receipt.variant.name}`
                              : ''}
                          </strong>
                          <p className="mt-1 mb-0 text-xs text-text-muted">
                            {new Date(receipt.createdAt).toLocaleDateString()} ·{' '}
                            {receipt.reference || 'No reference'}
                          </p>
                        </div>
                        <div className="shrink-0 text-sm font-bold text-text-main">
                          {receipt.quantity} ×{' '}
                          {receipt.unitCost === null
                            ? '—'
                            : money(receipt.unitCost)}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <EmptyState title="No supplier receipts yet." />
                )}
              </SectionCard>

              <SectionCard title="Purchase orders" bodyPadding={false}>
                {detail.purchaseOrders.length ? (
                  <div>
                    {detail.purchaseOrders.map((order) => (
                      <div
                        key={order.id}
                        className="flex items-center justify-between gap-4 border-b border-border-subtle px-4 py-4 last:border-b-0 hover:bg-muted-surface sm:px-8"
                      >
                        <div>
                          <strong className="text-sm font-bold text-text-main">
                            {order.reference || 'No reference'}
                          </strong>
                          <p className="mt-1 mb-0 text-xs text-text-muted">
                            {new Date(order.createdAt).toLocaleDateString()} ·{' '}
                            {order.items.length} item
                            {order.items.length === 1 ? '' : 's'}
                          </p>
                        </div>
                        <span className="shrink-0 rounded-full border border-border-subtle bg-muted-surface px-2 py-1 text-xs font-bold text-text-secondary">
                          {order.status.replace(/_/g, ' ')}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <EmptyState title="No purchase orders yet." />
                )}
              </SectionCard>

              <SectionCard title="Linked products" bodyPadding={false}>
                {detail.catalogItems.length ? (
                  <div>
                    {detail.catalogItems.map((item) => (
                      <div
                        key={item.id}
                        className="flex items-center justify-between gap-4 border-b border-border-subtle px-4 py-4 last:border-b-0 hover:bg-muted-surface sm:px-8"
                      >
                        <span className="text-sm font-bold text-text-main">
                          {item.product.name}
                          {item.variant ? ` · ${item.variant.name}` : ''}
                          {item.isPreferred ? ' · Preferred' : ''}
                        </span>
                        <strong className="shrink-0 text-sm font-bold text-text-main">
                          {item.lastCost === null ? '—' : money(item.lastCost)}
                        </strong>
                      </div>
                    ))}
                  </div>
                ) : (
                  <EmptyState title="No linked products yet." />
                )}
              </SectionCard>

              <SectionCard title="Invoices" bodyPadding={false}>
                {detail.invoices.length ? (
                  <div>
                    {detail.invoices.map((invoice) => {
                      const balance =
                        invoice.total -
                        invoice.payments.reduce(
                          (sum, payment) => sum + payment.amount,
                          0,
                        );
                      return (
                        <div
                          key={invoice.id}
                          className="flex items-center justify-between gap-4 border-b border-border-subtle px-4 py-4 last:border-b-0 hover:bg-muted-surface sm:px-8"
                        >
                          <span className="text-sm font-bold text-text-main">
                            {invoice.invoiceNumber}
                            <small className="mt-1 block text-xs font-normal text-text-muted">
                              {invoice.dueDate
                                ? `Due ${new Date(invoice.dueDate).toLocaleDateString()}`
                                : 'No due date'}
                            </small>
                          </span>
                          <strong
                            className={`shrink-0 text-sm font-bold ${
                              balance > 0
                                ? 'text-amber-700'
                                : 'text-emerald-700'
                            }`}
                          >
                            {money(balance)}
                          </strong>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <EmptyState title="No invoices yet." />
                )}
              </SectionCard>
            </div>
          </section>
        </PageContainer>
      </div>
    </main>
  );
}
