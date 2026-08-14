'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  Boxes,
  ChevronLeft,
  ChevronRight,
  ClipboardCheck,
  History,
  Search,
  SlidersHorizontal,
} from 'lucide-react';
import { usePathname, useRouter } from 'next/navigation';
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
  StatusBadge,
  TabButton,
  TabCountBadge,
} from '../../components/ui/';

const api = '/api';
type Variant = { id: string; name: string; sku: string };
type Product = {
  id: string;
  name: string;
  sku: string;
  reorderLevel: number;
  variants: Variant[];
};
type Item = {
  id: string;
  quantity: number;
  product: Product;
  variant: Variant | null;
};
type Activity = {
  id: string;
  createdAt: string;
  quantityChange: number;
  reason: string;
  product: Pick<Product, 'id' | 'name' | 'sku'>;
  variant: Variant | null;
};
type ValuationItem = {
  id: string;
  product: string;
  variant: string | null;
  sku: string;
  quantity: number;
  unitCost: number | null;
  totalValue: number | null;
  costSource: string;
};
type Valuation = {
  branch: { id: string; name: string };
  totalValue: number;
  onHandUnits: number;
  valuedItems: number;
  missingCostItems: number;
  items: ValuationItem[];
};
type Supplier = { id: string; name: string; lastCost: number | null };
type ReorderSuggestion = {
  productId: string;
  variantId: string | null;
  product: string;
  variant: string | null;
  sku: string;
  quantity: number;
  alertLevel: number;
  targetQuantity: number;
  suggestedQuantity: number;
  preferredSupplier: Supplier | null;
};
type ReorderResult = {
  branch: { id: string; name: string };
  items: ReorderSuggestion[];
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
  onPageChange: (page: number) => void;
  onPageSizeChange: (pageSize: number) => void;
}) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
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
          Page {page} of {totalPages}
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
          disabled={page === totalPages}
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

export default function InventoryPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [items, setItems] = useState<Item[]>([]);
  const [activity, setActivity] = useState<Activity[]>([]);
  const [branchId, setBranchId] = useState('');
  const [message, setMessage] = useState('');
  const [messageTone, setMessageTone] = useState<'success' | 'error'>(
    'success',
  );
  const [countProductId, setCountProductId] = useState('');
  const [adjustProductId, setAdjustProductId] = useState('');
  const [adjustReason, setAdjustReason] = useState('RECEIVED');
  const [stockQuery, setStockQuery] = useState('');
  const [stockStatus, setStockStatus] = useState<'all' | 'low' | 'in'>('all');
  const [stockPage, setStockPage] = useState(1);
  const [stockPageSize, setStockPageSize] = useState(10);
  const [activityQuery, setActivityQuery] = useState('');
  const [activityFilter, setActivityFilter] = useState<'all' | 'in' | 'out'>(
    'all',
  );
  const [activityPage, setActivityPage] = useState(1);
  const [activityPageSize, setActivityPageSize] = useState(10);
  const [valuation, setValuation] = useState<Valuation | null>(null);
  const [reorderResult, setReorderResult] = useState<ReorderResult | null>(
    null,
  );
  const [valuationQuery, setValuationQuery] = useState('');
  const [valuationPage, setValuationPage] = useState(1);
  const [valuationPageSize, setValuationPageSize] = useState(10);
  const pathname = usePathname();
  const router = useRouter();
  const activeTab: 'overview' | 'stock' | 'activity' | 'valuation' | 'reorder' =
    pathname.endsWith('/stock')
      ? 'stock'
      : pathname.endsWith('/activity')
        ? 'activity'
        : pathname.endsWith('/valuation')
          ? 'valuation'
          : pathname.endsWith('/reorder')
            ? 'reorder'
            : 'overview';
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
    const [me, catalog] = await Promise.all([
      fetch(`${api}/auth/me`, { headers }),
      fetch(`${api}/products`, { headers }),
    ]);
    if (!me.ok || !catalog.ok) throw new Error('Please sign in again.');
    const user = await me.json();
    setBranchId(user.branchId ?? '');
    setProducts(await catalog.json());

    const branchQuery = user.branchId ? `?branchId=${user.branchId}` : '';
    const [stock, recentActivity, valRes, reorderRes] = await Promise.all([
      fetch(`${api}/inventory${branchQuery}`, { headers }),
      fetch(`${api}/inventory/activity${branchQuery}`, { headers }),
      fetch(`${api}/inventory/valuation${branchQuery}`, { headers }),
      fetch(`${api}/inventory/reorder-suggestions${branchQuery}`, { headers }),
    ]);
    if (stock.ok) setItems(await stock.json().catch(() => []));
    if (recentActivity.ok)
      setActivity(await recentActivity.json().catch(() => []));
    if (valRes.ok) setValuation(await valRes.json().catch(() => null));
    if (reorderRes.ok)
      setReorderResult(await reorderRes.json().catch(() => null));
  }
  useEffect(() => {
    void load().catch((error: Error) => showMessage(error.message, 'error'));
  }, []);

  async function adjust(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = Object.fromEntries(new FormData(formElement));
    if (!form.productId) {
      showMessage('Select a product or variant to adjust.', 'error');
      return;
    }
    const quantityChange = Number(form.quantityChange);
    if (!Number.isInteger(quantityChange) || quantityChange === 0) {
      showMessage('Enter a whole stock change, for example 20 or -2.', 'error');
      return;
    }
    try {
      const [kind, id] = String(form.productId ?? '').split(':');
      const response = await fetch(`${api}/inventory/adjustments`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          branchId,
          ...(kind === 'v' ? { variantId: id } : { productId: id }),
          quantityChange,
          reason: form.reason,
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        showMessage(data.message ?? 'Unable to adjust stock.', 'error');
        return;
      }
      formElement.reset();
      setAdjustProductId('');
      setAdjustReason('RECEIVED');
      showMessage('Stock adjustment saved.', 'success');
      await load();
    } catch {
      showMessage('The API server did not return a response.', 'error');
    }
  }
  async function saveCount(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = Object.fromEntries(new FormData(formElement));
    if (!form.stockItem) {
      showMessage('Select a product or variant to count.', 'error');
      return;
    }
    const countedQuantity = Number(form.countedQuantity);
    if (!Number.isInteger(countedQuantity) || countedQuantity < 0) {
      showMessage('Enter a whole counted quantity of zero or more.', 'error');
      return;
    }
    const [kind, id] = String(form.stockItem ?? '').split(':');
    const response = await fetch(`${api}/inventory/stock-counts`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        branchId,
        ...(kind === 'v' ? { variantId: id } : { productId: id }),
        countedQuantity,
        note: form.note,
      }),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      showMessage(data.message ?? 'Unable to save stock count.', 'error');
      return;
    }
    formElement.reset();
    setCountProductId('');
    showMessage(
      `${data.product}: counted ${data.countedQuantity}. Difference: ${data.difference > 0 ? '+' : ''}${data.difference}.`,
      'success',
    );
    await load();
  }

  const lowStock = items.filter(
    (item) => item.quantity <= item.product.reorderLevel,
  );
  const visibleLowStock = lowStock.slice(0, 8);
  const stockResults = useMemo(
    () =>
      items.filter((item) => {
        const low = item.quantity <= item.product.reorderLevel;
        const search =
          `${item.product.name} ${item.variant?.name ?? ''} ${item.variant?.sku ?? item.product.sku}`.toLowerCase();
        return (
          (!stockQuery || search.includes(stockQuery.toLowerCase())) &&
          (stockStatus === 'all' || (stockStatus === 'low' ? low : !low))
        );
      }),
    [items, stockQuery, stockStatus],
  );
  const activityResults = useMemo(
    () =>
      activity.filter((entry) => {
        const search =
          `${entry.product.name} ${entry.variant?.name ?? ''} ${entry.variant?.sku ?? entry.product.sku} ${entry.reason}`.toLowerCase();
        return (
          (!activityQuery || search.includes(activityQuery.toLowerCase())) &&
          (activityFilter === 'all' ||
            (activityFilter === 'in'
              ? entry.quantityChange > 0
              : entry.quantityChange < 0))
        );
      }),
    [activity, activityFilter, activityQuery],
  );
  const valuationResults = useMemo(
    () =>
      (valuation?.items ?? []).filter((item) =>
        `${item.product} ${item.variant ?? ''} ${item.sku}`
          .toLowerCase()
          .includes(valuationQuery.toLowerCase()),
      ),
    [valuation, valuationQuery],
  );
  const stockRows = stockResults.slice(
    (stockPage - 1) * stockPageSize,
    stockPage * stockPageSize,
  );
  const activityRows = activityResults.slice(
    (activityPage - 1) * activityPageSize,
    activityPage * activityPageSize,
  );
  const valuationRows = valuationResults.slice(
    (valuationPage - 1) * valuationPageSize,
    valuationPage * valuationPageSize,
  );
  const readableReason = (reason: string) => {
    const [type, detail] = reason.split(':', 2);
    const labels: Record<string, string> = {
      RECEIVED: 'Stock received',
      OPENING_STOCK: 'Opening stock',
      DAMAGED: 'Damaged',
      EXPIRED: 'Expired',
      CORRECTION: 'Correction',
      STOCK_COUNT: 'Physical count',
      TRANSFER_IN: 'Transfer in',
      TRANSFER_OUT: 'Transfer out',
    };
    return detail && type === 'STOCK_COUNT'
      ? `${labels[type]} · ${detail}`
      : (labels[type] ?? reason.replace(/_/g, ' '));
  };
  const expectedQuantity =
    items.find(
      (item) =>
        `${item.variant ? 'v' : 'p'}:${item.variant?.id ?? item.product.id}` ===
        countProductId,
    )?.quantity ?? 0;
  const options = products.flatMap((product) =>
    product.variants.length
      ? product.variants.map((variant) => ({
          value: `v:${variant.id}`,
          label: `${product.name} — ${variant.name} · ${variant.sku}`,
        }))
      : [
          {
            value: `p:${product.id}`,
            label: `${product.name} · ${product.sku}`,
          },
        ],
  );
  const stockSelect = (
    name: string,
    value: string,
    onChange: (value: string) => void,
  ) => (
    <CustomSelect
      name={name}
      value={value}
      onChange={onChange}
      options={options}
      placeholder="Select product or variant"
    />
  );
  const searchBox = (
    value: string,
    onChange: (value: string) => void,
    placeholder: string,
  ) => (
    <Input
      value={value}
      onChange={(event) => onChange(event.target.value)}
      placeholder={placeholder}
      prefixIcon={<Search size={16} />}
      wrapperClassName="max-w-md flex-1"
    />
  );

  const tabs = [
    { key: 'overview', label: 'Overview', icon: Boxes, href: '/inventory' },
    {
      key: 'stock',
      label: 'Current stock',
      count: items.length,
      icon: ClipboardCheck,
      href: '/inventory/stock',
    },
    {
      key: 'activity',
      label: 'Activity',
      count: activity.length,
      icon: History,
      href: '/inventory/activity',
    },
    {
      key: 'valuation',
      label: 'Valuation',
      icon: SlidersHorizontal,
      href: '/inventory/valuation',
    },
    {
      key: 'reorder',
      label: 'Reorder',
      count: lowStock.length,
      icon: AlertTriangle,
      href: '/inventory/reorder',
    },
  ] as const;
  const reasonOptions = [
    { value: 'RECEIVED', label: 'Received stock' },
    { value: 'OPENING_STOCK', label: 'Opening stock' },
    { value: 'DAMAGED', label: 'Damaged' },
    { value: 'EXPIRED', label: 'Expired' },
    { value: 'CORRECTION', label: 'Correction' },
  ];
  const tableHead =
    'px-4 py-3 text-left text-xs font-bold uppercase tracking-wider text-text-secondary';
  const tableCell = 'px-4 py-3 text-sm text-text-secondary';

  return (
    <main className="app-page">
      <PageHeading
        eyebrow="Inventory"
        title="Stock management"
        tabs={
          <div className="flex items-center gap-7 overflow-x-auto overflow-y-hidden border-b border-border-subtle [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.key;
              return (
                <TabButton
                  key={tab.key}
                  active={isActive}
                  onClick={() => router.push(tab.href, { scroll: false })}
                >
                  <Icon size={16} /> {tab.label}
                  {'count' in tab && (
                    <TabCountBadge active={isActive}>{tab.count}</TabCountBadge>
                  )}
                </TabButton>
              );
            })}
          </div>
        }
      />

      <PageContainer>
        {message && (
          <AlertBanner tone={messageTone} className="mb-6">
            <ClipboardCheck size={17} /> {message}
          </AlertBanner>
        )}

        {activeTab === 'overview' && (
          <>
            <SectionCard
              title="Low-stock alerts"
              description={
                lowStock.length
                  ? `${lowStock.length} item${lowStock.length === 1 ? '' : 's'} need attention.`
                    : 'All tracked items are above their alert level.'
              }
              icon={<AlertTriangle size={20} />}
              actions={
                lowStock.length > 8 ? (
                  <Button
                    variant="warningSubtle"
                    onClick={() => router.push('/inventory/reorder')}
                  >
                    View all {lowStock.length}
                  </Button>
                ) : (
                  <StatusBadge tone={lowStock.length ? 'warning' : 'success'}>
                    {lowStock.length ? 'Needs review' : 'Healthy'}
                  </StatusBadge>
                )
              }
              className="mb-6"
            >
              {visibleLowStock.length ? (
                <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
                  {visibleLowStock.map((item) => (
                    <article
                      key={item.id}
                      className="flex items-center justify-between gap-3 rounded-lg border border-amber-200 bg-amber-50 p-4"
                    >
                      <div className="min-w-0">
                        <p className="m-0 truncate text-sm font-bold text-text-main">
                          {item.product.name}
                          {item.variant ? ` · ${item.variant.name}` : ''}
                        </p>
                        <p className="mt-1 mb-0 text-xs text-text-muted">
                          Alert at {item.product.reorderLevel}
                        </p>
                      </div>
                      <span className="shrink-0 text-xs font-semibold text-amber-700">
                        <strong className="text-base">{item.quantity}</strong>{' '}
                        left
                      </span>
                    </article>
                  ))}
                </div>
              ) : (
                <p className="m-0 text-sm font-semibold text-emerald-700">
                  Inventory levels look healthy.
                </p>
              )}
            </SectionCard>

            <section className="grid grid-cols-1 items-start gap-5 lg:grid-cols-2">
              <SectionCard
                title="Physical stock count"
                description="Set stock to the quantity actually counted."
                icon={<ClipboardCheck size={20} />}
                className="h-full"
              >
                <form onSubmit={saveCount} className="flex flex-col gap-4">
                  <FormField label="Product or variant" id="stockItem" required>
                    {stockSelect(
                      'stockItem',
                      countProductId,
                      setCountProductId,
                    )}
                  </FormField>
                  {countProductId && (
                    <AlertBanner tone="info">
                      Current system quantity:{' '}
                      <strong>{expectedQuantity}</strong>
                    </AlertBanner>
                  )}
                  <FormField
                    label="Counted quantity"
                    id="countedQuantity"
                    required
                  >
                    <Input
                      required
                      id="countedQuantity"
                      name="countedQuantity"
                      type="number"
                      min="0"
                      step="1"
                    />
                  </FormField>
                  <FormField label="Note" id="countNote" sublabel="(optional)">
                    <Input
                      id="countNote"
                      name="note"
                      placeholder="e.g. Monthly shelf count"
                    />
                  </FormField>
                  <div className="flex justify-end">
                    <Button type="submit">Save physical count</Button>
                  </div>
                </form>
              </SectionCard>

              <SectionCard
                title="Adjust stock"
                description="Add or remove stock with a recorded reason."
                icon={<SlidersHorizontal size={20} />}
                className="h-full"
              >
                <form onSubmit={adjust} className="flex flex-col gap-4">
                  <FormField label="Product or variant" id="productId" required>
                    {stockSelect(
                      'productId',
                      adjustProductId,
                      setAdjustProductId,
                    )}
                  </FormField>
                  <FormField
                    label="Quantity change"
                    id="quantityChange"
                    required
                  >
                    <Input
                      required
                      id="quantityChange"
                      name="quantityChange"
                      type="number"
                      placeholder="e.g. 10 or -2"
                    />
                  </FormField>
                  <FormField label="Reason" id="reason" required>
                    <CustomSelect
                      name="reason"
                      value={adjustReason}
                      onChange={setAdjustReason}
                      options={reasonOptions}
                    />
                  </FormField>
                  <div className="flex justify-end">
                    <Button type="submit">Save adjustment</Button>
                  </div>
                </form>
              </SectionCard>
            </section>
          </>
        )}

        {activeTab === 'stock' && (
          <SectionCard
            title="Current stock"
            description={`${stockResults.length} of ${items.length} tracked item${items.length === 1 ? '' : 's'} in the active branch.`}
            icon={<ClipboardCheck size={20} />}
            bodyPadding={false}
          >
            <div className="flex flex-wrap gap-3 border-b border-border-subtle px-4 py-6 sm:px-8">
              {searchBox(
                stockQuery,
                (value) => {
                  setStockQuery(value);
                  setStockPage(1);
                },
                'Search product or SKU',
              )}
              <CustomSelect
                value={stockStatus}
                onChange={(value) => {
                  setStockStatus(value as 'all' | 'low' | 'in');
                  setStockPage(1);
                }}
                options={[
                  { value: 'all', label: 'All stock' },
                  { value: 'low', label: 'Low stock' },
                  { value: 'in', label: 'In stock' },
                ]}
                className="w-full sm:w-40"
              />
            </div>
            {stockRows.length ? (
              <>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[620px] border-collapse">
                    <thead className="border-b border-border-subtle bg-muted-surface">
                      <tr>
                        {[
                          'Product',
                          'SKU',
                          'On hand',
                          'Alert level',
                          'Status',
                        ].map((heading) => (
                          <th key={heading} className={tableHead}>
                            {heading}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {stockRows.map((item) => {
                        const low = item.quantity <= item.product.reorderLevel;
                        return (
                          <tr
                            key={item.id}
                            className="border-b border-border-subtle last:border-b-0 hover:bg-muted-surface"
                          >
                            <td
                              className={`${tableCell} font-bold text-text-main`}
                            >
                              {item.product.name}
                              {item.variant && (
                                <span className="font-medium text-text-muted">
                                  {' '}
                                  · {item.variant.name}
                                </span>
                              )}
                            </td>
                            <td
                              className={`${tableCell} font-mono text-text-muted`}
                            >
                              {item.variant?.sku ?? item.product.sku}
                            </td>
                            <td
                              className={`${tableCell} font-extrabold ${low ? 'text-amber-700' : 'text-brand'}`}
                            >
                              {item.quantity}
                            </td>
                            <td className={tableCell}>
                              {item.product.reorderLevel}
                            </td>
                            <td className={tableCell}>
                              <StatusBadge tone={low ? 'warning' : 'success'}>
                                {low ? 'Low stock' : 'In stock'}
                              </StatusBadge>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                <TablePager
                  total={stockResults.length}
                  page={stockPage}
                  pageSize={stockPageSize}
                  onPageChange={setStockPage}
                  onPageSizeChange={(size) => {
                    setStockPageSize(size);
                    setStockPage(1);
                  }}
                />
              </>
            ) : (
              <EmptyState
                title="No stock items found"
                description="Try a different search or stock filter."
                icon={<Boxes size={24} />}
              />
            )}
          </SectionCard>
        )}

        {activeTab === 'activity' && (
          <SectionCard
            title="Recent stock activity"
            description={`${activityResults.length} of ${activity.length} activity record${activity.length === 1 ? '' : 's'}.`}
            icon={<History size={20} />}
            bodyPadding={false}
          >
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border-subtle px-4 py-6 sm:px-8">
              {searchBox(
                activityQuery,
                (value) => {
                  setActivityQuery(value);
                  setActivityPage(1);
                },
                'Search product or reason',
              )}
              <div className="inline-flex rounded-md bg-muted-surface p-1">
                {(
                  [
                    { key: 'all', label: 'All' },
                    { key: 'in', label: 'Added' },
                    { key: 'out', label: 'Removed' },
                  ] as const
                ).map((filter) => (
                  <Button
                    key={filter.key}
                    variant={
                      activityFilter === filter.key ? 'secondary' : 'ghost'
                    }
                    size="sm"
                    onClick={() => {
                      setActivityFilter(filter.key);
                      setActivityPage(1);
                    }}
                  >
                    {filter.label}
                  </Button>
                ))}
              </div>
            </div>
            {activityRows.length ? (
              <>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[640px] border-collapse">
                    <thead className="border-b border-border-subtle bg-muted-surface">
                      <tr>
                        {['When', 'Product', 'Reason', 'Change'].map(
                          (heading) => (
                            <th
                              key={heading}
                              className={`${tableHead} ${heading === 'Change' ? 'text-right' : ''}`}
                            >
                              {heading}
                            </th>
                          ),
                        )}
                      </tr>
                    </thead>
                    <tbody>
                      {activityRows.map((entry) => (
                        <tr
                          key={entry.id}
                          className="border-b border-border-subtle last:border-b-0 hover:bg-muted-surface"
                        >
                          <td
                            className={`${tableCell} whitespace-nowrap text-xs text-text-muted`}
                          >
                            {new Date(entry.createdAt).toLocaleString(
                              undefined,
                              { dateStyle: 'medium', timeStyle: 'short' },
                            )}
                          </td>
                          <td
                            className={`${tableCell} font-bold text-text-main`}
                          >
                            {entry.product.name}
                            {entry.variant && (
                              <span className="font-medium text-text-muted">
                                {' '}
                                · {entry.variant.name}
                              </span>
                            )}
                          </td>
                          <td className={tableCell}>
                            {readableReason(entry.reason)}
                          </td>
                          <td
                            className={`${tableCell} text-right font-extrabold ${entry.quantityChange > 0 ? 'text-emerald-700' : 'text-rose-600'}`}
                          >
                            {entry.quantityChange > 0 ? '+' : ''}
                            {entry.quantityChange}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <TablePager
                  total={activityResults.length}
                  page={activityPage}
                  pageSize={activityPageSize}
                  onPageChange={setActivityPage}
                  onPageSizeChange={(size) => {
                    setActivityPageSize(size);
                    setActivityPage(1);
                  }}
                />
              </>
            ) : (
              <EmptyState
                title="No activity found"
                description="Try a different search or movement filter."
                icon={<History size={24} />}
              />
            )}
          </SectionCard>
        )}

        {activeTab === 'valuation' && (
          <SectionCard
            title="Inventory valuation"
            description="Stock value calculated from weighted-average cost."
            icon={<SlidersHorizontal size={20} />}
            bodyPadding={false}
          >
            <div className="grid grid-cols-1 border-b border-border-subtle sm:grid-cols-3 sm:divide-x sm:divide-border-subtle">
              {[
                {
                  label: 'Stock value',
                  value: `$${((valuation?.totalValue ?? 0) / 100).toFixed(2)}`,
                  tone: 'text-brand',
                },
                {
                  label: 'On-hand units',
                  value: valuation?.onHandUnits ?? 0,
                  tone: 'text-text-main',
                },
                {
                  label: 'Missing costs',
                  value: valuation?.missingCostItems ?? 0,
                  tone: valuation?.missingCostItems
                    ? 'text-amber-700'
                    : 'text-emerald-700',
                },
              ].map((metric) => (
                <div
                  key={metric.label}
                  className="border-b border-border-subtle px-4 py-5 last:border-b-0 sm:border-b-0 sm:px-8"
                >
                  <span className="text-xs font-bold uppercase tracking-wider text-text-muted">
                    {metric.label}
                  </span>
                  <strong
                    className={`mt-1 block text-2xl font-extrabold ${metric.tone}`}
                  >
                    {metric.value}
                  </strong>
                </div>
              ))}
            </div>
            <div className="border-b border-border-subtle px-4 py-6 sm:px-8">
              {searchBox(
                valuationQuery,
                (value) => {
                  setValuationQuery(value);
                  setValuationPage(1);
                },
                'Search product or SKU',
              )}
            </div>
            {valuationRows.length ? (
              <>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[640px] border-collapse">
                    <thead className="border-b border-border-subtle bg-muted-surface">
                      <tr>
                        {[
                          'Product',
                          'SKU',
                          'On hand',
                          'Unit cost',
                          'Total value',
                        ].map((heading) => (
                          <th
                            key={heading}
                            className={`${tableHead} ${heading === 'Unit cost' || heading === 'Total value' ? 'text-right' : ''}`}
                          >
                            {heading}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {valuationRows.map((item) => (
                        <tr
                          key={item.id}
                          className="border-b border-border-subtle last:border-b-0 hover:bg-muted-surface"
                        >
                          <td
                            className={`${tableCell} font-bold text-text-main`}
                          >
                            {item.product}
                            {item.variant ? ` · ${item.variant}` : ''}
                          </td>
                          <td
                            className={`${tableCell} font-mono text-text-muted`}
                          >
                            {item.sku}
                          </td>
                          <td
                            className={`${tableCell} font-bold text-text-main`}
                          >
                            {item.quantity}
                          </td>
                          <td className={`${tableCell} text-right`}>
                            {item.unitCost != null
                              ? `$${(item.unitCost / 100).toFixed(2)}`
                              : '—'}
                          </td>
                          <td
                            className={`${tableCell} text-right font-extrabold text-brand`}
                          >
                            {item.totalValue != null
                              ? `$${(item.totalValue / 100).toFixed(2)}`
                              : '—'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <TablePager
                  total={valuationResults.length}
                  page={valuationPage}
                  pageSize={valuationPageSize}
                  onPageChange={setValuationPage}
                  onPageSizeChange={(size) => {
                    setValuationPageSize(size);
                    setValuationPage(1);
                  }}
                />
              </>
            ) : (
              <EmptyState
                title="No valuation records found"
                description="Costed inventory will appear here."
                icon={<SlidersHorizontal size={24} />}
              />
            )}
          </SectionCard>
        )}

        {activeTab === 'reorder' && (
          <SectionCard
            title="Reorder recommendations"
            description={`${reorderResult?.items.length ?? lowStock.length} items at or below reorder alert level.`}
            icon={<AlertTriangle size={20} />}
            bodyPadding={false}
          >
            {(reorderResult?.items.length ?? 0) === 0 ? (
              <EmptyState
                title="Inventory is well stocked"
                description="No items currently need reordering."
                icon={<ClipboardCheck size={24} />}
              />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[720px] border-collapse">
                  <thead className="border-b border-border-subtle bg-muted-surface">
                    <tr>
                      {[
                        'Product',
                        'SKU',
                        'Current stock',
                        'Alert level',
                        'Target stock',
                        'Suggested reorder',
                      ].map((heading) => (
                        <th
                          key={heading}
                          className={`${tableHead} ${['Current stock', 'Alert level', 'Target stock', 'Suggested reorder'].includes(heading) ? 'text-right' : ''}`}
                        >
                          {heading}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {(reorderResult?.items ?? []).map((item) => (
                      <tr
                        key={`${item.productId}-${item.variantId ?? ''}`}
                        className="border-b border-border-subtle last:border-b-0 hover:bg-muted-surface"
                      >
                        <td className={`${tableCell} font-bold text-text-main`}>
                          {item.product}
                          {item.variant ? ` · ${item.variant}` : ''}
                        </td>
                        <td
                          className={`${tableCell} font-mono text-text-muted`}
                        >
                          {item.sku}
                        </td>
                        <td
                          className={`${tableCell} text-right font-extrabold text-amber-700`}
                        >
                          {item.quantity}
                        </td>
                        <td className={`${tableCell} text-right`}>
                          {item.alertLevel}
                        </td>
                        <td className={`${tableCell} text-right`}>
                          {item.targetQuantity}
                        </td>
                        <td
                          className={`${tableCell} text-right font-extrabold text-brand`}
                        >
                          +{item.suggestedQuantity}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </SectionCard>
        )}
      </PageContainer>
    </main>
  );
}
