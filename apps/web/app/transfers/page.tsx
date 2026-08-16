'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  ArrowRight,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  CircleAlert,
  PackageCheck,
  Search,
  Send,
  Warehouse,
} from 'lucide-react';
import { PageContainer } from '../../components/layout/page-container';
import {
  AlertBanner,
  Button,
  CustomSelect,
  EmptyState,
  FormField,
  Input,
  PageHeading,
  SectionCard,
} from '../../components/ui/';
import { useI18n } from '../../lib/i18n';

const api = '/api';
type Me = { branchId: string | null };
type Product = {
  id: string;
  name: string;
  sku: string;
  variants: { id: string; name: string; sku: string }[];
};
type Branch = { id: string; name: string; code: string };
type StockItem = {
  quantity: number;
  product: Product;
  variant: { id: string; name: string; sku: string } | null;
};
type Transfer = {
  id: string;
  quantity: number;
  note: string | null;
  createdAt: string;
  product: { name: string; sku: string };
  variant: { name: string; sku: string } | null;
  sourceBranch: { name: string };
  destinationBranch: { name: string };
};
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

export default function TransfersPage() {
  const { t, locale } = useI18n();
  const [me, setMe] = useState<Me | null>(null);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [stock, setStock] = useState<StockItem[]>([]);
  const [transfers, setTransfers] = useState<Transfer[]>([]);
  const [message, setMessage] = useState('');
  const [messageTone, setMessageTone] = useState<'success' | 'error'>(
    'success',
  );
  const [target, setTarget] = useState('');
  const [destinationBranchId, setDestinationBranchId] = useState('');
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
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
  function showMessage(text: string, tone: 'success' | 'error') {
    setMessage(text);
    setMessageTone(tone);
  }
  async function load() {
    setIsLoading(true);
    try {
      const [meResponse, branchesResponse, transfersResponse] =
        await Promise.all([
          fetch(`${api}/auth/me`, { headers }),
          fetch(`${api}/businesses/current/branches`, { headers }),
          fetch(`${api}/inventory/transfers`, { headers }),
        ]);
      if (!meResponse.ok || !branchesResponse.ok || !transfersResponse.ok) {
        throw new Error(t('transfers.error.signIn'));
      }

      const user = await meResponse.json();
      const branchData = await branchesResponse.json().catch(() => []);
      const transferData = await transfersResponse.json().catch(() => []);
      setMe(user);
      setBranches(Array.isArray(branchData) ? branchData : []);
      setTransfers(Array.isArray(transferData) ? transferData : []);

      if (user.branchId) {
        const stockResponse = await fetch(
          `${api}/inventory?branchId=${user.branchId}`,
          { headers },
        );
        const stockData = await stockResponse.json().catch(() => []);
        setStock(stockResponse.ok && Array.isArray(stockData) ? stockData : []);
      } else {
        setStock([]);
      }
    } finally {
      setIsLoading(false);
    }
  }
  useEffect(() => {
    void load().catch((error: Error) => showMessage(error.message, 'error'));
  }, []);
  const activeBranch = useMemo(
    () => branches.find((branch) => branch.id === me?.branchId),
    [branches, me],
  );
  const destinations = branches.filter((branch) => branch.id !== me?.branchId);
  const selectedItem = stock.find(
    (item) =>
      `${item.variant ? 'v' : 'p'}:${item.product.id}${item.variant ? `:${item.variant.id}` : ''}` ===
      target,
  );
  const available = selectedItem?.quantity;
  async function transfer(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = Object.fromEntries(new FormData(formElement));
    const selected = String(form.stockTarget ?? '').split(':');
    const quantity = Number(form.quantity);
    if (available === undefined) {
      showMessage(t('transfers.error.chooseStock'), 'error');
      return;
    }
    if (!form.destinationBranchId) {
      showMessage(t('transfers.error.chooseDestination'), 'error');
      return;
    }
    if (quantity > available) {
      showMessage(
        t('transfers.error.available', { count: available, branch: activeBranch?.name ?? t('transfers.thisBranch') }),
        'error',
      );
      return;
    }
    setIsSaving(true);
    try {
      const response = await fetch(`${api}/inventory/transfers`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          ...form,
          productId: selected[1],
          ...(selected[0] === 'v' ? { variantId: selected[2] } : {}),
          quantity,
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        showMessage(data.message ?? t('transfers.error.save'), 'error');
        return;
      }
      formElement.reset();
      setTarget('');
      setDestinationBranchId('');
      showMessage(
        t('transfers.success.transferred'),
        'success',
      );
      await load();
    } catch {
      showMessage(
        t('receiving.error.apiRetry'),
        'error',
      );
    } finally {
      setIsSaving(false);
    }
  }
  const filteredTransfers = useMemo(
    () =>
      transfers.filter((transfer) =>
        `${transfer.product.name} ${transfer.variant?.name ?? ''} ${transfer.sourceBranch.name} ${transfer.destinationBranch.name} ${transfer.note ?? ''}`
          .toLowerCase()
          .includes(query.toLowerCase()),
      ),
    [transfers, query],
  );
  const rows = filteredTransfers.slice((page - 1) * pageSize, page * pageSize);
  const stockOptions = stock.map((item) => ({
    value: `${item.variant ? 'v' : 'p'}:${item.product.id}${item.variant ? `:${item.variant.id}` : ''}`,
    label: `${item.product.name}${item.variant ? ` — ${item.variant.name}` : ''}`,
    sublabel: `${item.variant?.sku ?? item.product.sku} · ${t('transfers.availableCount', { count: item.quantity })}`,
  }));
  const destinationOptions = destinations.map((branch) => ({
    value: branch.id,
    label: branch.name,
    sublabel: branch.code,
  }));
  return (
    <main className="app-page">
      <PageHeading eyebrow={t('transfers.eyebrow')} title={t('transfers.title')} />

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

          <section className="mb-6 grid grid-cols-1 items-start gap-6 xl:grid-cols-[minmax(0,1.65fr)_minmax(17rem,1fr)]">
            <SectionCard
              title={t('transfers.new')}
              description={t('transfers.newHelp')}
              icon={<Send size={20} />}
              className="h-full"
            >
              {isLoading ? (
                <EmptyState
                  icon={<Send size={24} />}
                  title={t('transfers.loadingDetails')}
                  description={t('transfers.preparingStock')}
                />
              ) : me?.branchId && destinations.length ? (
                <form
                  onSubmit={transfer}
                  autoComplete="off"
                  className="grid grid-cols-1 items-start gap-x-4 gap-y-4 md:grid-cols-2"
                >
                  <div className="grid grid-cols-1 items-center gap-3 rounded-lg border border-border-subtle bg-muted-surface p-5 sm:grid-cols-[1fr_auto_1fr] md:col-span-2">
                    <div>
                      <span className="block text-xs font-bold uppercase tracking-wider text-text-muted">
                        {t('transfers.from')}
                      </span>
                      <strong className="mt-1 block text-sm text-text-main">
                        {activeBranch?.name ?? t('transfers.activeBranch')}
                      </strong>
                    </div>
                    <ArrowRight
                      size={20}
                      className="rotate-90 text-brand sm:rotate-0"
                    />
                    <div>
                      <span className="block text-xs font-bold uppercase tracking-wider text-text-muted">
                        {t('transfers.to')}
                      </span>
                      <strong className="mt-1 block text-sm text-text-main">
                        {destinationBranchId
                          ? destinations.find(
                              (branch) => branch.id === destinationBranchId,
                            )?.name
                          : t('transfers.chooseDestination')}
                      </strong>
                    </div>
                  </div>

                  <FormField
                    label={t('purchaseOrders.productOrVariant')}
                    id="stockTarget"
                    required
                    className="md:col-span-2"
                  >
                    <CustomSelect
                      name="stockTarget"
                      value={target}
                      onChange={setTarget}
                      options={stockOptions}
                      placeholder={t('transfers.selectStock')}
                    />
                  </FormField>
                  {target && (
                    <AlertBanner tone="info" className="md:col-span-2">
                      {t('transfers.available')}: <strong>{available ?? 0}</strong>
                    </AlertBanner>
                  )}
                  <FormField
                    label={t('transfers.destinationBranch')}
                    id="destinationBranchId"
                    required
                  >
                    <CustomSelect
                      name="destinationBranchId"
                      value={destinationBranchId}
                      onChange={setDestinationBranchId}
                      options={destinationOptions}
                      placeholder={t('transfers.selectDestination')}
                    />
                  </FormField>
                  <FormField label={t('suppliers.quantity')} id="transferQuantity" required>
                    <Input
                      required
                      id="transferQuantity"
                      min="1"
                      max={available}
                      name="quantity"
                      type="number"
                      step="1"
                      placeholder={t('transfers.quantityPlaceholder')}
                    />
                  </FormField>
                  <FormField
                    label={t('purchaseOrders.note')}
                    id="transferNote"
                    sublabel={t('common.optional')}
                    className="md:col-span-2"
                  >
                    <Input
                      id="transferNote"
                      name="note"
                      placeholder={t('transfers.notePlaceholder')}
                    />
                  </FormField>
                  <div className="flex justify-end border-t border-border-subtle pt-5 md:col-span-2">
                    <Button type="submit" disabled={isSaving}>
                      <PackageCheck size={16} />
                      {isSaving ? t('transfers.transferring') : t('transfers.transferStock')}
                    </Button>
                  </div>
                </form>
              ) : (
                <AlertBanner tone="warning" icon={<CircleAlert size={18} />}>
                  {me?.branchId
                    ? t('transfers.needAnotherBranch')
                    : t('transfers.needActiveBranch')}
                </AlertBanner>
              )}
            </SectionCard>

            <SectionCard
              title={t('transfers.safeTransfer')}
              description={t('transfers.safeTransferHelp')}
              icon={<Warehouse size={20} />}
              className="h-full"
            >
              <div className="flex flex-col gap-5">
                {[
                  [
                    '1',
                    t('transfers.stepChoose'),
                    t('transfers.stepChooseHelp'),
                  ],
                  [
                    '2',
                    t('transfers.stepDestination'),
                    t('transfers.stepDestinationHelp'),
                  ],
                  [
                    '3',
                    t('transfers.stepTrack'),
                    t('transfers.stepTrackHelp'),
                  ],
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
            title={t('transfers.recent')}
            description={t('transfers.count', { shown: filteredTransfers.length, total: transfers.length })}
            icon={<Warehouse size={20} />}
            bodyPadding={false}
          >
            <div className="border-b border-border-subtle px-4 py-6 sm:px-8">
              <Input
                type="search"
                value={query}
                onChange={(event) => {
                  setQuery(event.target.value);
                  setPage(1);
                }}
                placeholder={t('transfers.search')}
                prefixIcon={<Search size={16} />}
                wrapperClassName="max-w-md"
                aria-label={t('transfers.searchLabel')}
              />
            </div>
            {isLoading ? (
              <EmptyState
                title={t('transfers.loading')}
                description={t('transfers.preparingMovements')}
                icon={<Warehouse size={24} />}
              />
            ) : rows.length ? (
              <>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-3xl border-collapse text-sm">
                    <thead className="border-b border-border-subtle bg-muted-surface">
                      <tr>
                        {[
                          t('transfers.transferred'),
                          t('entity.product'),
                          t('transfers.from'),
                          t('transfers.to'),
                          t('suppliers.quantity'),
                          t('purchaseOrders.note'),
                        ].map((heading, index) => (
                          <th
                            key={heading}
                            className={`px-4 py-3 text-xs font-bold uppercase tracking-wider text-text-secondary first:pl-8 last:pr-8 ${index === 4 ? 'text-right' : 'text-left'}`}
                          >
                            {heading}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((transfer) => (
                        <tr
                          key={transfer.id}
                          className="border-b border-border-subtle last:border-b-0 hover:bg-muted-surface"
                        >
                          <td className="py-4 pr-4 pl-8 text-xs whitespace-nowrap text-text-muted">
                            {new Date(transfer.createdAt).toLocaleString(
                              locale === 'km' ? 'km-KH' : 'en-US',
                              { dateStyle: 'medium', timeStyle: 'short' },
                            )}
                          </td>
                          <td className="px-4 py-4">
                            <p className="m-0 text-sm font-bold text-text-main">
                              {transfer.product.name}
                              {transfer.variant && (
                                <span className="font-medium text-text-muted">
                                  {' '}
                                  · {transfer.variant.name}
                                </span>
                              )}
                            </p>
                            <p className="mt-1 mb-0 font-mono text-xs text-text-muted">
                              {transfer.variant?.sku ?? transfer.product.sku}
                            </p>
                          </td>
                          <td className="px-4 py-4 text-sm text-text-secondary">
                            {transfer.sourceBranch.name}
                          </td>
                          <td className="px-4 py-4 text-sm text-text-secondary">
                            {transfer.destinationBranch.name}
                          </td>
                          <td className="px-4 py-4 text-right text-sm font-extrabold text-brand">
                            {transfer.quantity}
                          </td>
                          <td className="py-4 pr-8 pl-4 text-sm text-text-muted">
                            {transfer.note ?? '—'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <TablePager
                  total={filteredTransfers.length}
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
                title={t('transfers.empty')}
                description={t('transfers.emptyHelp')}
                icon={<Warehouse size={24} />}
              />
            )}
          </SectionCard>
        </PageContainer>
      </div>
    </main>
  );
}
