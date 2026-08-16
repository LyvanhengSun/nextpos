'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { ArrowLeft, Printer, ReceiptText } from 'lucide-react';

import { PageContainer } from '../../../components/layout/page-container';
import {
  AlertBanner,
  Button,
  ButtonLink,
  EmptyState,
  PageHeading,
} from '../../../components/ui';
import { getDeviceSettings } from '../../../lib/device-settings';
import { useI18n } from '../../../lib/i18n';

const api = '/api';

type Sale = {
  id: string;
  createdAt: string;
  paymentMethod: string;
  subtotal: number;
  discountTotal: number;
  taxTotal: number;
  total: number;
  amountTendered: number | null;
  changeDue: number;
  note: string | null;
  branch: { name: string };
  business: {
    name: string;
    address: string | null;
    phone: string | null;
    receiptPrefix: string;
    receiptFooter: string | null;
  };
  items: {
    quantity: number;
    unitPrice: number;
    lineTotal: number;
    note: string | null;
    modifiers:
      { group: string; name: string; priceAdjustment: number }[] | null;
    product: { name: string; regularPrice?: number | null };
  }[];
};

const money = (amount: number) => `$${(amount / 100).toFixed(2)}`;

export default function ReceiptPage() {
  const { t, locale } = useI18n();
  const params = useParams<{ id: string }>();
  const [sale, setSale] = useState<Sale>();
  const [message, setMessage] = useState('');
  const [receiptWidth, setReceiptWidth] = useState('80');
  const token =
    typeof window === 'undefined'
      ? ''
      : (sessionStorage.getItem('pos_access_token') ??
        localStorage.getItem('pos_access_token') ??
        '');

  useEffect(() => {
    setReceiptWidth(getDeviceSettings().receiptWidth);
    void fetch(`${api}/pos/sales/${params.id}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(async (response) => {
        if (!response.ok) throw new Error(t('receipt.notFound'));
        setSale(await response.json());
      })
      .catch((error: Error) => setMessage(error.message));
  }, [params.id]);

  if (!sale) {
    return (
      <main className="w-full pb-16">
        <PageHeading eyebrow={t('sales.transactions')} title={t('receipt.salesReceipt')} />
        <div className="py-6">
          <PageContainer>
            {message ? (
              <AlertBanner tone="error">{message}</AlertBanner>
            ) : (
              <EmptyState
                title={t('receipt.loading')}
                description={t('receipt.loadingTransaction')}
                icon={<ReceiptText size={24} />}
                className="min-h-64 rounded-lg border border-border-subtle bg-card shadow-sm"
              />
            )}
          </PageContainer>
        </div>
      </main>
    );
  }

  const receiptNumber = `${sale.business.receiptPrefix}${sale.id
    .slice(-8)
    .toUpperCase()}`;
  const saleDate = new Date(sale.createdAt);

  return (
    <main className="receipt w-full pb-16 print:pb-0">
      <PageHeading
        eyebrow={t('sales.transactions')}
        title={t('receipt.number', { number: receiptNumber })}
        className="print-hide"
        actions={
          <>
            <ButtonLink href="/sales" variant="secondary">
              <ArrowLeft size={16} aria-hidden="true" />
              {t('receipt.backToSales')}
            </ButtonLink>
            <Button onClick={() => window.print()}>
              <Printer size={16} aria-hidden="true" />
              {t('receipt.print')}
            </Button>
          </>
        }
      />

      <div className="receipt-content py-6 print:p-0">
        <PageContainer className="print:max-w-none print:px-0">
          <article
            className={`receipt-paper mx-auto overflow-hidden rounded-lg border border-border-subtle bg-card shadow-sm print:rounded-none print:border-0 print:shadow-none ${
              receiptWidth === '58'
                ? 'max-w-sm print:w-[58mm]'
                : 'max-w-xl print:w-[80mm]'
            }`}
          >
            <header className="border-b border-dashed border-border-default px-4 py-5 text-center sm:px-8 sm:py-6 print:px-3 print:py-4">
              <p className="m-0 text-xs font-black uppercase tracking-wider text-brand">
                {t('receipt.salesReceipt')}
              </p>
              <h1 className="mt-1.5 mb-0 text-xl font-extrabold tracking-tight text-text-main sm:text-2xl">
                {sale.business.name}
              </h1>
              <p className="mt-1 mb-0 text-sm font-bold text-text-main">
                {sale.branch.name}
              </p>
              {(sale.business.address || sale.business.phone) && (
                <address className="mt-2 text-xs leading-relaxed text-text-muted not-italic">
                  {sale.business.address && (
                    <span className="block">{sale.business.address}</span>
                  )}
                  {sale.business.phone && (
                    <span className="block">{sale.business.phone}</span>
                  )}
                </address>
              )}
              <div className="mt-3 flex flex-col items-center gap-1 text-xs text-text-muted">
                <time dateTime={sale.createdAt}>
                  {saleDate.toLocaleString(locale === 'km' ? 'km-KH' : 'en-US')}
                </time>
                <strong className="font-bold tracking-wide text-text-main">
                  #{receiptNumber}
                </strong>
              </div>
            </header>

            <section aria-label={t('receipt.purchasedItems')}>
              <div className="grid grid-cols-[minmax(0,1fr)_auto_auto] gap-3 border-b border-border-subtle bg-muted-surface px-4 py-3 text-xs font-bold uppercase tracking-wider text-text-secondary sm:px-8 print:px-3">
                <span>{t('entity.product')}</span>
                <span className="text-right">{t('products.price')}</span>
                <span className="text-right">{t('dashboard.total')}</span>
              </div>
              <div className="divide-y divide-border-subtle">
                {sale.items.map((item, index) => {
                  const hasSale =
                    item.product.regularPrice != null &&
                    item.product.regularPrice > item.unitPrice;
                  return (
                    <div
                      className="grid grid-cols-[minmax(0,1fr)_auto_auto] items-start gap-3 px-4 py-4 sm:px-8 print:px-3 print:py-3"
                      key={`${item.product.name}-${index}`}
                    >
                      <div className="min-w-0">
                        <strong className="block text-sm leading-snug text-text-main">
                          {item.product.name} ×{item.quantity}
                        </strong>
                        {hasSale && (
                          <s className="mt-1 block text-xs text-text-muted">
                            {t('receipt.regularPrice', { amount: money(item.product.regularPrice!) })}
                          </s>
                        )}
                        {item.modifiers?.length ? (
                          <small className="mt-1 block text-xs leading-relaxed text-text-muted">
                            {item.modifiers
                              .map((modifier) => modifier.name)
                              .join(', ')}
                          </small>
                        ) : null}
                        {item.note ? (
                          <small className="mt-1 block text-xs leading-relaxed text-text-muted">
                            {t('sales.noteNamed', { note: item.note })}
                          </small>
                        ) : null}
                      </div>
                      <span className="whitespace-nowrap text-right text-sm text-text-secondary">
                        {money(item.unitPrice)}
                      </span>
                      <strong className="whitespace-nowrap text-right text-sm text-text-main">
                        {money(item.lineTotal)}
                      </strong>
                    </div>
                  );
                })}
              </div>
            </section>

            <div className="border-t border-dashed border-border-default px-4 py-6 sm:px-8 print:px-3 print:py-4">
              {sale.note && (
                <div className="mb-5 rounded-lg border-l-4 border-brand bg-muted-surface p-4">
                  <strong className="block text-xs font-bold uppercase tracking-wider text-text-secondary">
                    {t('pos.orderNote')}
                  </strong>
                  <p className="mt-1 mb-0 text-xs leading-relaxed text-text-muted">
                    {sale.note}
                  </p>
                </div>
              )}

              <dl className="m-0 grid gap-2 text-sm">
                <div className="flex items-center justify-between gap-4">
                  <dt className="text-text-muted">{t('pos.subtotal')}</dt>
                  <dd className="m-0 font-semibold text-text-main">
                    {money(sale.subtotal)}
                  </dd>
                </div>
                {sale.discountTotal > 0 && (
                  <div className="flex items-center justify-between gap-4 text-success">
                    <dt>{t('pos.discount')}</dt>
                    <dd className="m-0 font-semibold">
                      -{money(sale.discountTotal)}
                    </dd>
                  </div>
                )}
                {sale.taxTotal > 0 && (
                  <div className="flex items-center justify-between gap-4">
                    <dt className="text-text-muted">{t('pos.taxLabel')}</dt>
                    <dd className="m-0 font-semibold text-text-main">
                      {money(sale.taxTotal)}
                    </dd>
                  </div>
                )}
                <div className="mt-1 flex items-center justify-between gap-4 border-t border-border-subtle pt-3 text-lg">
                  <dt className="font-extrabold text-text-main">{t('dashboard.total')}</dt>
                  <dd className="m-0 font-extrabold text-text-main">
                    {money(sale.total)}
                  </dd>
                </div>
              </dl>

              <dl className="mt-5 mb-0 grid gap-2 border-t border-dashed border-border-default pt-4 text-sm">
                <div className="flex items-center justify-between gap-4">
                  <dt className="text-text-muted">{t('dashboard.payment')}</dt>
                  <dd className="m-0 font-bold text-text-main">
                    {sale.paymentMethod === 'CASH'
                      ? t('payment.cash')
                      : sale.paymentMethod === 'CARD'
                        ? t('payment.card')
                        : sale.paymentMethod}
                  </dd>
                </div>
                {sale.paymentMethod === 'CASH' && (
                  <>
                    <div className="flex items-center justify-between gap-4">
                      <dt className="text-text-muted">{t('receipt.cashReceived')}</dt>
                      <dd className="m-0 font-semibold text-text-main">
                        {money(sale.amountTendered ?? sale.total)}
                      </dd>
                    </div>
                    <div className="flex items-center justify-between gap-4">
                      <dt className="text-text-muted">{t('receipt.change')}</dt>
                      <dd className="m-0 font-semibold text-text-main">
                        {money(sale.changeDue)}
                      </dd>
                    </div>
                  </>
                )}
              </dl>
            </div>

            <footer className="border-t border-dashed border-border-default px-4 py-5 text-center text-xs font-semibold text-text-muted sm:px-8 print:px-3">
              {sale.business.receiptFooter || t('receipt.thankYou')}
            </footer>
          </article>
        </PageContainer>
      </div>
    </main>
  );
}
