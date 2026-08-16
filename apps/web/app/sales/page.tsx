'use client';

import {
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Minus,
  Plus,
  ReceiptText,
  RotateCcw,
  Search,
  SlidersHorizontal,
  TrendingUp,
  X,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import {
  AlertBanner,
  Button,
  ButtonLink,
  CustomSelect,
  DateRangeControls,
  EmptyState,
  FormField,
  Input,
  PageHeading,
  SectionCard,
  SummaryMetricCard,
} from '../../components/ui/';
import { PageContainer } from '../../components/layout/page-container';
import { useI18n } from '../../lib/i18n';

const api = '/api';
const salesPageSize = 20;
type Sale = {
  id: string;
  createdAt: string;
  paymentMethod: string;
  total: number;
  refundedAt: string | null;
  refundReason: string | null;
  note: string | null;
  branch: { name: string };
  items: {
    id: string;
    quantity: number;
    returnedQuantity: number;
    unitPrice: number;
    product: { name: string };
  }[];
};
type Approver = {
  id: string;
  firstName: string;
  lastName: string;
  role: string;
};
type DateRange = 'all' | 'today' | '7d' | '30d' | 'custom';
type SaleStatus = 'all' | 'completed' | 'returned';
type SalesHistory = {
  items: Sale[];
  total: number;
  page: number;
  pageSize: number;
  summary: { totalValue: number; returnedCount: number };
};

const dateRangeLabels: Record<DateRange, string> = {
  all: 'All time',
  today: 'Today',
  '7d': 'Last 7 days',
  '30d': 'Last 30 days',
  custom: 'Custom range',
};
const quickDateRangeOptions = (['all', 'today', '7d', '30d'] as const).map(
  (value) => ({ value, label: dateRangeLabels[value] }),
);

function filtersFromUrl(): {
  dateRange: DateRange;
  statusFilter: SaleStatus;
  dateFrom: string;
  dateTo: string;
  page: number;
} {
  if (typeof window === 'undefined')
    return {
      dateRange: 'all',
      statusFilter: 'all',
      dateFrom: '',
      dateTo: '',
      page: 1,
    };
  const params = new URLSearchParams(window.location.search);
  const range = params.get('range');
  const status = params.get('status');
  return {
    dateRange:
      range === 'today' ||
      range === '7d' ||
      range === '30d' ||
      range === 'custom'
        ? range
        : 'all',
    statusFilter:
      status === 'completed' || status === 'returned' ? status : 'all',
    dateFrom: /^\d{4}-\d{2}-\d{2}$/.test(params.get('from') ?? '')
      ? params.get('from')!
      : '',
    dateTo: /^\d{4}-\d{2}-\d{2}$/.test(params.get('to') ?? '')
      ? params.get('to')!
      : '',
    page: Math.max(1, Number(params.get('page')) || 1),
  };
}

function dateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

async function readJson<T>(response: Response, fallback: T): Promise<T> {
  const raw = await response.text();
  if (!raw.trim()) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export default function SalesPage() {
  const { t, locale } = useI18n();
  const [sales, setSales] = useState<Sale[]>([]);
  const [totalSales, setTotalSales] = useState(0);
  const [summary, setSummary] = useState({ totalValue: 0, returnedCount: 0 });
  const [message, setMessage] = useState('');
  const [canRefund, setCanRefund] = useState(false);
  const [activeRole, setActiveRole] = useState('');
  const [returningSale, setReturningSale] = useState<Sale | null>(null);
  const [reason, setReason] = useState('');
  const [returnQuantities, setReturnQuantities] = useState<
    Record<string, number>
  >({});
  const [isReturning, setIsReturning] = useState(false);
  const [approvers, setApprovers] = useState<Approver[]>([]);
  const [approvalUserId, setApprovalUserId] = useState('');
  const [approvalPin, setApprovalPin] = useState('');
  const [managerApprovalToken, setManagerApprovalToken] = useState('');
  const [approvalMessage, setApprovalMessage] = useState('');
  const [returnConfirmationOpen, setReturnConfirmationOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<SaleStatus>('all');
  const [dateRange, setDateRange] = useState<DateRange>('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [page, setPage] = useState(1);
  const token =
    typeof window === 'undefined'
      ? ''
      : (sessionStorage.getItem('pos_access_token') ??
        localStorage.getItem('pos_access_token') ??
        '');

  async function load() {
    const params = new URLSearchParams({
      page: String(page),
      pageSize: String(salesPageSize),
    });
    if (statusFilter !== 'all') params.set('status', statusFilter);
    if (dateRange === 'custom') {
      if (dateFrom) params.set('from', dateFrom);
      if (dateTo) params.set('to', dateTo);
    }
    if (dateRange === 'today' || dateRange === '7d' || dateRange === '30d') {
      const start = new Date();
      start.setHours(0, 0, 0, 0);
      if (dateRange === '7d') start.setDate(start.getDate() - 6);
      if (dateRange === '30d') start.setDate(start.getDate() - 29);
      params.set('from', dateKey(start));
    }
    const [history, me, approverResponse] = await Promise.all([
      fetch(`${api}/pos/sales?${params}`, {
        headers: { Authorization: `Bearer ${token}` },
      }),
      fetch(`${api}/auth/me`, {
        headers: { Authorization: `Bearer ${token}` },
      }),
      fetch(`${api}/auth/manager-approvers`, {
        headers: { Authorization: `Bearer ${token}` },
      }),
    ]);
    if (!history.ok || !me.ok) throw new Error(t('sales.error.signIn'));
    const salesHistory = await readJson<SalesHistory>(history, {
      items: [],
      total: 0,
      page: 1,
      pageSize: 25,
      summary: { totalValue: 0, returnedCount: 0 },
    });
    setSales(salesHistory.items);
    setTotalSales(salesHistory.total);
    setSummary(salesHistory.summary);
    const user = await readJson<{ role?: string }>(me, {});
    const role = String(user.role ?? '').toUpperCase();
    setActiveRole(role);
    setCanRefund(role === 'OWNER' || role === 'MANAGER');
    if (approverResponse.ok) {
      const availableApprovers = await readJson<Approver[]>(
        approverResponse,
        [],
      );
      setApprovers(availableApprovers);
      if (availableApprovers.length === 1)
        setApprovalUserId(availableApprovers[0].id);
    }
    setMessage('');
  }
  useEffect(() => {
    void load().catch((error: Error) => setMessage(error.message));
  }, [page, statusFilter, dateRange, dateFrom, dateTo]);
  useEffect(() => {
    const restoreFilters = () => {
      const filters = filtersFromUrl();
      setDateRange(filters.dateRange);
      setStatusFilter(filters.statusFilter);
      setDateFrom(filters.dateFrom);
      setDateTo(filters.dateTo);
      setPage(filters.page);
    };
    restoreFilters();
    window.addEventListener('popstate', restoreFilters);
    return () => window.removeEventListener('popstate', restoreFilters);
  }, []);
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (dateRange === 'all') params.delete('range');
    else params.set('range', dateRange);
    if (statusFilter === 'all') params.delete('status');
    else params.set('status', statusFilter);
    if (dateRange === 'custom') {
      if (dateFrom) params.set('from', dateFrom);
      else params.delete('from');
      if (dateTo) params.set('to', dateTo);
      else params.delete('to');
    } else {
      params.delete('from');
      params.delete('to');
    }
    if (page === 1) params.delete('page');
    else params.set('page', String(page));
    const query = params.toString();
    const nextUrl = `${window.location.pathname}${query ? `?${query}` : ''}${
      window.location.hash
    }`;
    if (
      nextUrl !==
      `${window.location.pathname}${window.location.search}${window.location.hash}`
    )
      window.history.pushState(null, '', nextUrl);
  }, [dateRange, statusFilter, dateFrom, dateTo, page]);

  async function submitReturn(startExchange: boolean) {
    if (!returningSale) return;
    const items = returningSale.items
      .map((item) => ({
        saleItemId: item.id,
        quantity: returnQuantities[item.id] ?? 0,
      }))
      .filter((item) => item.quantity > 0);
    if (!items.length) {
      setMessage(t('sales.error.chooseItem'));
      return;
    }
    if (reason.trim().length < 3) {
      setMessage(t('sales.error.reason'));
      return;
    }
    if (!canRefund && !managerApprovalToken) {
      setMessage(t('sales.error.approvalRequired'));
      return;
    }
    setIsReturning(true);
    setMessage('');
    try {
      const response = await fetch(
        `${api}/pos/sales/${returningSale.id}/return-items`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            reason,
            managerApprovalToken: canRefund ? undefined : managerApprovalToken,
            items,
          }),
        },
      );
      const raw = await response.text();
      let data: { message?: string; returnedTotal?: number } = {};
      try {
        data = raw ? JSON.parse(raw) : {};
      } catch {
        throw new Error(t('sales.error.invalidResponse'));
      }
      if (!response.ok) {
        const errorMessage = data.message ?? t('sales.error.completeReturn');
        if (!canRefund && /approval.*(?:invalid|expired)/i.test(errorMessage)) {
          setManagerApprovalToken('');
          setApprovalPin('');
          setApprovalMessage(
            t('sales.error.approvalExpired'),
          );
        }
        setMessage(errorMessage);
        return;
      }
      const successMessage =
        data.message ?? t('sales.success.returned');
      const returnedSaleId = returningSale.id;
      setReturningSale(null);
      setReason('');
      setReturnQuantities({});
      setManagerApprovalToken('');
      setApprovalPin('');
      setApprovalMessage('');
      if (startExchange) {
        sessionStorage.setItem(
          'pos_exchange_draft',
          JSON.stringify({
            sourceSaleId: returnedSaleId,
            credit: data.returnedTotal,
          }),
        );
        window.location.assign('/pos');
        return;
      }
      await load();
      setMessage(successMessage);
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : t('sales.error.completeReturn'),
      );
    } finally {
      setIsReturning(false);
    }
  }

  async function approveReturn() {
    setApprovalMessage('');
    const response = await fetch(`${api}/auth/manager-approve`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        userId: approvalUserId,
        pin: approvalPin,
        action: 'RETURN',
      }),
    });
    const data = (await response.json().catch(() => ({}))) as {
      message?: string;
      approvalToken?: string;
      manager?: { firstName: string; lastName: string };
    };
    if (!response.ok || !data.approvalToken) {
      setApprovalMessage(data.message ?? t('sales.error.approveReturn'));
      return;
    }
    setManagerApprovalToken(data.approvalToken);
    setApprovalPin('');
    setApprovalMessage(
      t('pos.message.approvedBy', { name: `${data.manager?.firstName ?? t('pos.manager')} ${data.manager?.lastName ?? ''}` }),
    );
  }

  const visibleSales = useMemo(() => {
    const query = search.trim().toLowerCase();
    const now = new Date();
    const startOfToday = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate(),
    );
    const rangeStart =
      dateRange === 'custom' && dateFrom
        ? new Date(`${dateFrom}T00:00:00`)
        : dateRange === 'today'
          ? startOfToday
          : dateRange === '7d'
            ? new Date(startOfToday.getTime() - 6 * 24 * 60 * 60 * 1000)
            : dateRange === '30d'
              ? new Date(startOfToday.getTime() - 29 * 24 * 60 * 60 * 1000)
              : null;
    const rangeEnd =
      dateRange === 'custom' && dateTo
        ? new Date(`${dateTo}T23:59:59.999`)
        : null;
    return sales.filter((sale) => {
      const returned =
        Boolean(sale.refundedAt) ||
        sale.items.some((item) => item.returnedQuantity > 0);
      const matchesStatus =
        statusFilter === 'all' ||
        (statusFilter === 'returned' ? returned : !returned);
      const saleDate = new Date(sale.createdAt);
      const matchesDate =
        (!rangeStart || saleDate >= rangeStart) &&
        (!rangeEnd || saleDate <= rangeEnd);
      const searchable = [
        sale.id,
        sale.branch.name,
        sale.paymentMethod,
        ...sale.items.map((item) => item.product.name),
      ]
        .join(' ')
        .toLowerCase();
      return (
        matchesDate && matchesStatus && (!query || searchable.includes(query))
      );
    });
  }, [sales, search, statusFilter, dateRange, dateFrom, dateTo]);

  const salesTotal = search
    ? visibleSales.reduce((sum, sale) => sum + sale.total, 0)
    : summary.totalValue;
  const returnedCount = search
    ? visibleSales.filter(
        (sale) =>
          sale.refundedAt ||
          sale.items.some((item) => item.returnedQuantity > 0),
      ).length
    : summary.returnedCount;
  const pageCount = Math.max(1, Math.ceil(totalSales / salesPageSize));
  const paginationItems: Array<number | 'ellipsis'> = [];
  const visiblePages = Array.from(
    new Set([1, page - 1, page, page + 1, pageCount]),
  )
    .filter((pageNumber) => pageNumber >= 1 && pageNumber <= pageCount)
    .sort((left, right) => left - right);
  visiblePages.forEach((pageNumber, index) => {
    if (index && pageNumber - visiblePages[index - 1] > 1)
      paginationItems.push('ellipsis');
    paginationItems.push(pageNumber);
  });
  const returnTotal = returningSale
    ? returningSale.items.reduce(
        (sum, item) => sum + item.unitPrice * (returnQuantities[item.id] ?? 0),
        0,
      )
    : 0;

  function closeReturnDrawer() {
    setReturningSale(null);
    setReason('');
    setReturnQuantities({});
    setManagerApprovalToken('');
    setApprovalPin('');
    setApprovalMessage('');
    setReturnConfirmationOpen(false);
  }

  function openReturnConfirmation() {
    const selectedItems = Object.values(returnQuantities).some(
      (quantity) => quantity > 0,
    );
    if (!selectedItems)
      return setMessage(t('sales.error.chooseItem'));
    if (reason.trim().length < 3)
      return setMessage(t('sales.error.reason'));
    if (!canRefund && !managerApprovalToken)
      return setMessage(
        t('sales.error.approvalRequired'),
      );
    setMessage('');
    setReturnConfirmationOpen(true);
  }

  return (
    <main className="w-full pb-16">
      <PageHeading eyebrow={t('sales.transactions')} title={t('sales.history')} />

      <div>
        <PageContainer>
          <div className="flex flex-col gap-5">
            <section
              className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3"
              aria-label={t('sales.summary')}
            >
              <SummaryMetricCard
                title={t('sales.transactions')}
                value={visibleSales.length}
                description={
                  visibleSales.length === 1
                    ? t('sales.transactionCount', { count: visibleSales.length })
                    : t('sales.transactionCountPlural', { count: visibleSales.length })
                }
                icon={<ReceiptText size={20} />}
                tone="purple"
              />
              <SummaryMetricCard
                title={t('sales.value')}
                value={`$${(salesTotal / 100).toFixed(2)}`}
                description={t('sales.revenue')}
                icon={<TrendingUp size={20} />}
                tone="amber"
              />
              <SummaryMetricCard
                title={t('sales.returns')}
                value={returnedCount}
                description={
                  returnedCount === 1
                    ? t('sales.returnCount', { count: returnedCount })
                    : t('sales.returnCountPlural', { count: returnedCount })
                }
                icon={<RotateCcw size={20} />}
                tone="sky"
              />
            </section>
            {returningSale && (
              <div className="fixed inset-0 z-[80]" role="presentation">
                <Button
                  type="button"
                  variant="overlay"
                  className="absolute inset-0 h-auto w-auto rounded-none p-0"
                  aria-label={t('sales.closeReturn')}
                  onClick={closeReturnDrawer}
                >
                  <span className="sr-only">{t('sales.closeReturn')}</span>
                </Button>
                <aside
                  className="fixed inset-y-0 right-0 z-[81] flex h-dvh w-full max-w-md flex-col overflow-hidden border-l border-border-subtle bg-card shadow-2xl"
                  role="dialog"
                  aria-modal="true"
                  aria-labelledby="return-drawer-title"
                >
                  <header className="flex shrink-0 items-start justify-between gap-4 border-b border-border-subtle bg-card px-4 py-6 sm:px-6">
                    <div className="min-w-0">
                      <h2
                        id="return-drawer-title"
                        className="m-0 text-xl font-bold leading-tight tracking-tight text-text-main"
                      >
                        {t('sales.returnSale', { number: returningSale.id.slice(-6).toUpperCase() })}
                      </h2>
                      <p className="mt-1.5 mb-0 text-[0.78rem] leading-relaxed text-text-muted">
                        {returningSale.branch.name} ·{' '}
                        {new Date(returningSale.createdAt).toLocaleDateString(
                          locale === 'km' ? 'km-KH' : 'en-US',
                          {
                            month: 'short',
                            day: 'numeric',
                            year: 'numeric',
                          },
                        )}{' '}
                        · ${(returningSale.total / 100).toFixed(2)}
                      </p>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="shrink-0 text-text-muted hover:text-text-main"
                      aria-label={t('sales.closeReturn')}
                      onClick={closeReturnDrawer}
                    >
                      <X size={19} />
                    </Button>
                  </header>

                  <form
                    className="flex min-h-0 flex-1 flex-col"
                    onSubmit={(event) => event.preventDefault()}
                    noValidate
                  >
                    <div className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto px-4 py-6 sm:px-6">
                      <div className="grid gap-3">
                        <div className="flex items-baseline justify-between gap-3">
                          <strong className="text-[0.88rem] font-bold text-text-main">
                            {t('sales.itemsToReturn')}
                          </strong>
                        </div>
                        <div className="overflow-hidden rounded-lg border border-border-subtle bg-card">
                          {returningSale.items.map((item, index) => {
                            const available =
                              item.quantity - item.returnedQuantity;
                            const qty = returnQuantities[item.id] ?? 0;
                            return (
                              <div
                                className={`flex items-center justify-between gap-3.5 px-3.5 py-3.5 ${
                                  index ? 'border-t border-border-subtle' : ''
                                }`}
                                key={item.id}
                              >
                                <div className="min-w-0">
                                  <strong className="block text-[0.84rem] text-text-main">
                                    {item.product.name}
                                  </strong>
                                  <small className="mt-1 block text-[0.72rem] text-text-muted">
                                    {t('sales.eachPrice', { amount: `$${(item.unitPrice / 100).toFixed(2)}` })} ·{' '}
                                    {available > 0
                                      ? t('sales.canReturn', { count: available })
                                      : t('sales.alreadyReturned')}
                                  </small>
                                </div>
                                <div className="flex shrink-0 items-center overflow-hidden rounded-md border border-border-default bg-muted-surface focus-within:border-brand focus-within:ring-2 focus-within:ring-brand/10">
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="bareIcon"
                                    className="h-8 w-8 rounded-none text-text-main"
                                    disabled={
                                      available === 0 ||
                                      returnConfirmationOpen ||
                                      qty <= 0
                                    }
                                    onClick={() =>
                                      setReturnQuantities((current) => ({
                                        ...current,
                                        [item.id]: Math.max(
                                          0,
                                          (current[item.id] ?? 0) - 1,
                                        ),
                                      }))
                                    }
                                    aria-label={t('sales.decreaseNamed', { name: item.product.name })}
                                  >
                                    <Minus size={14} />
                                  </Button>
                                  <Input
                                    type="number"
                                    min="0"
                                    max={available}
                                    disabled={
                                      available === 0 || returnConfirmationOpen
                                    }
                                    value={qty}
                                    onChange={(event) =>
                                      setReturnQuantities((current) => ({
                                        ...current,
                                        [item.id]: Math.max(
                                          0,
                                          Math.min(
                                            available,
                                            Number(event.target.value),
                                          ),
                                        ),
                                      }))
                                    }
                                    className="h-8 w-10 rounded-none border-y-0 px-0 text-center shadow-none [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                                    aria-label={t('sales.quantityNamed', { name: item.product.name })}
                                  />
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="bareIcon"
                                    className="h-8 w-8 rounded-none text-text-main"
                                    disabled={
                                      available === 0 ||
                                      returnConfirmationOpen ||
                                      qty >= available
                                    }
                                    onClick={() =>
                                      setReturnQuantities((current) => ({
                                        ...current,
                                        [item.id]: Math.min(
                                          available,
                                          (current[item.id] ?? 0) + 1,
                                        ),
                                      }))
                                    }
                                    aria-label={t('sales.increaseNamed', { name: item.product.name })}
                                  >
                                    <Plus size={14} />
                                  </Button>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>

                      <FormField label={t('sales.reason')} required>
                        <Input
                          required
                          minLength={3}
                          disabled={returnConfirmationOpen}
                          value={reason}
                          onChange={(event) => setReason(event.target.value)}
                          placeholder={t('sales.reasonPlaceholder')}
                        />
                      </FormField>

                      {!canRefund && (
                        <div className="grid gap-3 rounded-lg border border-warning-border bg-warning-subtle p-5">
                          <strong className="text-[0.83rem] text-orange-800">
                            {t('pos.managerApproval')}
                          </strong>
                          <FormField label={t('pos.manager')}>
                            <CustomSelect
                              value={approvalUserId}
                              disabled={returnConfirmationOpen}
                              placeholder={t('pos.selectManager')}
                              options={approvers.map((user) => ({
                                value: user.id,
                                label: `${user.firstName} ${user.lastName}`,
                                sublabel: user.role,
                              }))}
                              onChange={(value) => {
                                setApprovalUserId(value);
                                setManagerApprovalToken('');
                              }}
                            />
                          </FormField>
                          <FormField label={t('pos.managerPin')} required>
                            <Input
                              required={!managerApprovalToken}
                              disabled={
                                Boolean(managerApprovalToken) ||
                                returnConfirmationOpen
                              }
                              type="password"
                              inputMode="numeric"
                              minLength={4}
                              maxLength={8}
                              pattern="[0-9]{4,8}"
                              value={approvalPin}
                              onChange={(event) => {
                                setApprovalPin(
                                  event.target.value.replace(/\D/g, ''),
                                );
                                setManagerApprovalToken('');
                              }}
                            />
                          </FormField>
                          <Button
                            variant="secondary"
                            size="sm"
                            className="justify-self-start border-orange-300 text-orange-700 hover:bg-orange-50"
                            disabled={returnConfirmationOpen}
                            onClick={() => void approveReturn()}
                          >
                            {t('sales.approveReturn')}
                          </Button>
                          {approvalMessage && (
                            <small className="text-[0.76rem] font-semibold text-orange-800">
                              {approvalMessage}
                            </small>
                          )}
                        </div>
                      )}

                      <div className="flex items-center justify-between rounded-lg bg-brand-subtle p-4 text-brand">
                        <span className="text-[0.85rem] font-bold">
                          {t('sales.refundTotal')}
                        </span>
                        <strong className="text-xl font-extrabold">
                          ${(returnTotal / 100).toFixed(2)}
                        </strong>
                      </div>

                      {returnConfirmationOpen && (
                        <div className="rounded-lg border border-warning-border bg-warning-subtle p-4 text-orange-800">
                          <strong className="text-[0.85rem]">
                            {t('sales.confirmTitle')}
                          </strong>
                          <p className="mt-1.5 mb-3 text-[0.78rem] leading-relaxed">
                            {t('sales.confirmHelp', { amount: `$${(returnTotal / 100).toFixed(2)}` })}
                          </p>
                          <Button
                            variant="secondary"
                            size="sm"
                            className="border-orange-300 text-orange-700 hover:bg-orange-50"
                            onClick={() => setReturnConfirmationOpen(false)}
                          >
                            {t('sales.editReturn')}
                          </Button>
                        </div>
                      )}

                      {message && (
                        <AlertBanner tone="error">{message}</AlertBanner>
                      )}
                    </div>

                    <footer className="flex shrink-0 flex-wrap items-center justify-end gap-2 border-t border-border-subtle bg-card px-4 py-4 sm:px-6">
                      <Button
                        variant="secondary"
                        disabled={isReturning}
                        onClick={closeReturnDrawer}
                      >
                        {t('common.cancel')}
                      </Button>
                      {!returnConfirmationOpen ? (
                        <Button
                          disabled={isReturning}
                          onClick={openReturnConfirmation}
                        >
                          {t('sales.reviewReturn')}
                        </Button>
                      ) : (
                        <>
                          <Button
                            variant="secondary"
                            disabled={isReturning}
                            onClick={() => void submitReturn(true)}
                          >
                            {t('sales.returnExchange')}
                          </Button>
                          <Button
                            disabled={isReturning}
                            onClick={() => void submitReturn(false)}
                          >
                            {isReturning ? t('pos.processing') : t('sales.confirmReturn')}
                          </Button>
                        </>
                      )}
                    </footer>
                  </form>
                </aside>
              </div>
            )}
            <SectionCard
              title={t('sales.transactions')}
              description={t('sales.shownCount', { shown: visibleSales.length, total: totalSales })}
              className="overflow-visible"
              headerClassName="max-sm:flex-wrap"
              actionsClassName="max-sm:w-full max-sm:basis-full max-sm:justify-start"
              bodyPadding={false}
              actions={
                <DateRangeControls
                  quickValue={dateRange === 'custom' ? '' : dateRange}
                  quickOptions={quickDateRangeOptions}
                  customActive={dateRange === 'custom'}
                  from={dateFrom}
                  to={dateTo}
                  onQuickChange={(value) => {
                    setDateRange(value as DateRange);
                    setPage(1);
                  }}
                  onRangeChange={(from, to) => {
                    setDateFrom(from);
                    setDateTo(to);
                    setDateRange(from || to ? 'custom' : 'all');
                    setPage(1);
                  }}
                />
              }
            >
              <div className="flex flex-col gap-3 border-b border-border-subtle px-4 py-4 sm:px-8 lg:flex-row lg:items-center lg:justify-between">
                <div className="w-full lg:max-w-sm">
                  <span className="sr-only">{t('sales.search')}</span>
                  <Input
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder={t('sales.searchPlaceholder')}
                    prefixIcon={<Search size={16} />}
                  />
                </div>
                <div className="flex items-center gap-2">
                  <SlidersHorizontal
                    size={16}
                    className="shrink-0 text-text-muted"
                  />
                  <div
                    className="flex items-center gap-1 overflow-x-auto rounded-md bg-muted-surface p-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
                    aria-label={t('sales.filter')}
                  >
                    {(['all', 'completed', 'returned'] as const).map(
                      (filter) => (
                        <Button
                          key={filter}
                          type="button"
                          variant={
                            statusFilter === filter ? 'secondary' : 'ghost'
                          }
                          size="sm"
                          className="shrink-0 border-transparent px-3 shadow-none"
                          aria-pressed={statusFilter === filter}
                          onClick={() => {
                            setStatusFilter(filter);
                            setPage(1);
                          }}
                        >
                          {filter === 'all'
                            ? t('common.all')
                            : filter === 'completed'
                              ? t('sales.completed')
                              : t('sales.returned')}
                        </Button>
                      ),
                    )}
                  </div>
                </div>
              </div>
              {visibleSales.length ? (
                <>
                  <div className="w-full">
                    <div className="hidden grid-cols-[40px_minmax(0,1fr)_180px_110px_190px] items-center gap-4 border-b border-border-subtle bg-muted-surface px-8 py-3 text-xs font-bold uppercase tracking-wider text-text-secondary lg:grid">
                      <span className="col-span-2">{t('dashboard.sale')}</span>
                      <span>{t('sales.date')}</span>
                      <span className="text-right">{t('dashboard.total')}</span>
                      <span className="text-right">{t('products.actions')}</span>
                    </div>
                    {visibleSales.map((sale) => {
                      const returned =
                        Boolean(sale.refundedAt) ||
                        sale.items.some((item) => item.returnedQuantity > 0);
                      const saleDate = new Date(sale.createdAt);

                      return (
                        <article
                          className="grid grid-cols-[40px_minmax(0,1fr)_auto] items-start gap-4 border-b border-border-subtle px-4 py-4 transition-colors last:border-b-0 hover:bg-muted-surface focus-within:bg-muted-surface sm:px-8 lg:grid-cols-[40px_minmax(0,1fr)_180px_110px_190px] lg:items-center"
                          key={sale.id}
                        >
                          <div className="flex h-10 w-10 items-center justify-center rounded-md bg-brand-subtle text-brand">
                            <ReceiptText size={20} />
                          </div>
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <strong className="text-[0.9rem] font-bold text-text-main">
                                {t('dashboard.saleNumber', { number: sale.id.slice(-6).toUpperCase() })}
                              </strong>
                              <span
                                className={`rounded-full px-2 py-1 text-[0.68rem] font-bold ${
                                  returned
                                    ? 'bg-danger-subtle text-danger'
                                    : 'bg-success-subtle text-success'
                                }`}
                              >
                                {returned ? t('sales.returned') : t('sales.completed')}
                              </span>
                            </div>
                            <p className="mt-1 mb-0 truncate text-[0.8rem] text-text-secondary">
                              {sale.items
                                .map(
                                  (item) =>
                                    `${item.quantity}× ${item.product.name}`,
                                )
                                .join(', ')}
                            </p>
                            {sale.note ? (
                              <small className="mt-1 block text-[0.75rem] text-text-muted">
                                {t('sales.noteNamed', { note: sale.note })}
                              </small>
                            ) : null}
                          </div>
                          <div className="col-start-2 text-sm text-text-secondary lg:col-start-auto">
                            <span className="block">
                              {saleDate.toLocaleDateString(locale === 'km' ? 'km-KH' : 'en-US', {
                                month: 'short',
                                day: 'numeric',
                                year: 'numeric',
                              })}
                            </span>
                            <small className="mt-1 block text-[0.72rem] text-text-muted">
                              {saleDate.toLocaleTimeString(locale === 'km' ? 'km-KH' : 'en-US', {
                                hour: 'numeric',
                                minute: '2-digit',
                              })}{' '}
                              · {sale.branch.name}
                            </small>
                          </div>
                          <div className="col-start-3 row-start-1 text-right lg:col-start-auto lg:row-start-auto">
                            <strong className="block text-[0.92rem] font-extrabold text-text-main">
                              ${(sale.total / 100).toFixed(2)}
                            </strong>
                            <small className="mt-1 block text-[0.72rem] uppercase text-text-muted">
                              {sale.paymentMethod}
                            </small>
                          </div>
                          <div className="col-span-2 col-start-2 flex items-center justify-start gap-2 lg:col-span-1 lg:col-start-auto lg:justify-end">
                            <ButtonLink
                              href={`/receipt/${sale.id}`}
                              variant="secondary"
                              size="sm"
                              aria-label={t('sales.viewReceipt', { number: sale.id.slice(-6) })}
                            >
                              <ReceiptText size={17} />
                              <span>{t('pos.receipt')}</span>
                            </ButtonLink>
                            {!sale.refundedAt && (
                              <Button
                                type="button"
                                variant="warningSubtle"
                                size="sm"
                                onClick={() => {
                                  setReturningSale(sale);
                                  setReturnConfirmationOpen(false);
                                  setMessage('');
                                  setReturnQuantities(
                                    Object.fromEntries(
                                      sale.items.map((item) => [
                                        item.id,
                                        item.quantity - item.returnedQuantity,
                                      ]),
                                    ),
                                  );
                                }}
                              >
                                <RotateCcw size={16} />
                                <span>{t('sales.returnAction')}</span>
                              </Button>
                            )}
                          </div>
                        </article>
                      );
                    })}
                  </div>
                  {pageCount > 1 && (
                    <nav
                      className="flex flex-wrap items-center justify-end gap-2 border-t border-border-subtle px-4 py-3 sm:px-8"
                      aria-label={t('sales.pagination')}
                    >
                      <Button
                        type="button"
                        variant="secondary"
                        size="icon"
                        className="size-8"
                        aria-label={t('sales.firstPage')}
                        title={t('sales.firstPage')}
                        disabled={page === 1}
                        onClick={() => setPage(1)}
                      >
                        <ChevronsLeft size={18} />
                      </Button>
                      <Button
                        type="button"
                        variant="secondary"
                        size="icon"
                        className="size-8"
                        aria-label={t('sales.previousPage')}
                        title={t('sales.previousPage')}
                        disabled={page === 1}
                        onClick={() => setPage((current) => current - 1)}
                      >
                        <ChevronLeft size={18} />
                      </Button>
                      {paginationItems.map((item, index) =>
                        item === 'ellipsis' ? (
                          <span key={`ellipsis-${index}`} aria-hidden="true">
                            …
                          </span>
                        ) : (
                          <Button
                            key={item}
                            type="button"
                            variant={item === page ? 'primary' : 'secondary'}
                            size="icon"
                            className="size-8"
                            aria-label={t('sales.pageNamed', { page: item })}
                            aria-current={item === page ? 'page' : undefined}
                            onClick={() => setPage(item)}
                          >
                            {item}
                          </Button>
                        ),
                      )}
                      <Button
                        type="button"
                        variant="secondary"
                        size="icon"
                        className="size-8"
                        aria-label={t('sales.nextPage')}
                        title={t('sales.nextPage')}
                        disabled={page === pageCount}
                        onClick={() => setPage((current) => current + 1)}
                      >
                        <ChevronRight size={18} />
                      </Button>
                      <Button
                        type="button"
                        variant="secondary"
                        size="icon"
                        className="size-8"
                        aria-label={t('sales.lastPage')}
                        title={t('sales.lastPage')}
                        disabled={page === pageCount}
                        onClick={() => setPage(pageCount)}
                      >
                        <ChevronsRight size={18} />
                      </Button>
                    </nav>
                  )}
                </>
              ) : (
                <EmptyState
                  title={t('sales.empty')}
                  description={t('sales.emptyHelp')}
                  icon={<Search size={22} />}
                  className="min-h-[225px]"
                />
              )}
            </SectionCard>
            {!returningSale && message && (
              <AlertBanner tone="error">{message}</AlertBanner>
            )}
          </div>
        </PageContainer>
      </div>
    </main>
  );
}
