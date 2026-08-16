'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Activity,
  AlertCircle,
  Boxes,
  Building2,
  CircleDollarSign,
  Clock3,
  Database,
  ReceiptText,
  Search,
  Settings2,
  ShieldAlert,
  ShoppingCart,
  UserRound,
  UsersRound,
} from 'lucide-react';

import { PageContainer } from '../../components/layout/page-container';
import {
  AlertBanner,
  EmptyState,
  Input,
  PageHeading,
  SectionCard,
  StatusBadge,
  TabButton,
  TabCountBadge,
} from '../../components/ui/';
import { useI18n } from '../../lib/i18n';

const api = '/api';

type Log = {
  id: string;
  action: string;
  entityType: string;
  entityId: string;
  metadata: Record<string, unknown> | null;
  createdAt: string;
  actor: string;
};

const categories = [
  'All',
  'Sales',
  'Stock',
  'Staff',
  'Settings',
  'Expenses',
  'Purchasing',
] as const;

type Category = (typeof categories)[number] | 'Other';

const humanize = (action: string) =>
  action
    .toLowerCase()
    .replaceAll('_', ' ')
    .replace(/\b\w/g, (letter) => letter.toUpperCase());

function categoryFor(action: string): Category {
  if (action.includes('SALE') || action.includes('REFUND')) return 'Sales';
  if (
    action.includes('STOCK') ||
    action.includes('TRANSFER') ||
    action.includes('RECEIPT')
  )
    return 'Stock';
  if (action.includes('STAFF') || action.includes('TERMINAL')) return 'Staff';
  if (
    action.includes('SETTING') ||
    action.includes('BRANCH') ||
    action.includes('BUSINESS')
  )
    return 'Settings';
  if (action.includes('EXPENSE')) return 'Expenses';
  if (
    action.includes('PURCHASE') ||
    action.includes('SUPPLIER') ||
    action.includes('INVOICE')
  )
    return 'Purchasing';
  return 'Other';
}

function categoryIcon(category: Category) {
  switch (category) {
    case 'Sales':
      return <ShoppingCart size={16} />;
    case 'Stock':
      return <Boxes size={16} />;
    case 'Staff':
      return <UsersRound size={16} />;
    case 'Settings':
      return <Settings2 size={16} />;
    case 'Expenses':
      return <CircleDollarSign size={16} />;
    case 'Purchasing':
      return <ReceiptText size={16} />;
    default:
      return <Activity size={16} />;
  }
}

function metadataValue(value: unknown, none: string, updated: string) {
  if (value === null) return none;
  if (typeof value === 'object') {
    try {
      return JSON.stringify(value);
    } catch {
      return updated;
    }
  }
  return String(value);
}

export default function ActivityPage() {
  const { t, locale } = useI18n();
  const router = useRouter();
  const [logs, setLogs] = useState<Log[]>([]);
  const [message, setMessage] = useState('');
  const [category, setCategory] = useState<(typeof categories)[number]>('All');
  const [query, setQuery] = useState('');
  const [isOwner, setIsOwner] = useState<boolean | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const token =
    typeof window === 'undefined'
      ? ''
      : (sessionStorage.getItem('pos_access_token') ??
        localStorage.getItem('pos_access_token') ??
        '');
  const headers = { Authorization: `Bearer ${token}` };

  async function checkRoleAndLoad() {
    setIsLoading(true);
    try {
      const meResponse = await fetch(`${api}/auth/me`, { headers });
      if (!meResponse.ok) {
        router.replace('/login');
        return;
      }

      const me = await meResponse.json();
      if (me.role !== 'OWNER') {
        setIsOwner(false);
        router.replace('/dashboard');
        return;
      }
      setIsOwner(true);

      const response = await fetch(`${api}/audit-logs`, { headers });
      const raw = await response.text().catch(() => '');
      let data: Log[] | { message?: string } = [];
      if (raw.trim()) {
        try {
          data = JSON.parse(raw);
        } catch {
          data = [];
        }
      }
      if (!response.ok) {
        throw new Error(
          !Array.isArray(data) && data.message
            ? data.message
            : t('activity.error.ownerOnly'),
        );
      }
      setLogs(Array.isArray(data) ? data : []);
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : t('activity.error.load'),
      );
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    void checkRoleAndLoad();
  }, []);

  const knownActions = new Set([
    'DISCOUNT', 'MANAGER_APPROVAL_GRANTED', 'TERMINAL_UNLOCKED', 'BRANCH_CREATED',
    'BRANCH_UPDATED', 'BUSINESS_CREATED', 'BUSINESS_SETTINGS_UPDATED',
    'BUSINESS_EXPENSE_RECORDED', 'PHYSICAL_STOCK_COUNT_RECORDED',
    'VARIANT_PHYSICAL_STOCK_COUNT_RECORDED', 'VARIANT_STOCK_ADJUSTED',
    'DISCOUNT_APPROVED_AT_CHECKOUT', 'SALE_HELD', 'SALE_ITEMS_RETURNED',
    'SALE_REFUNDED', 'PRODUCTS_IMPORTED_FROM_CSV', 'PURCHASE_ORDER_APPROVED',
    'PURCHASE_ORDER_CANCELLED', 'PURCHASE_ORDER_CHANGE_APPROVED',
    'PURCHASE_ORDER_CHANGE_REQUESTED', 'PURCHASE_ORDER_CREATED',
    'PURCHASE_ORDER_DISPATCHED', 'PURCHASE_ORDER_REJECTED',
    'PURCHASE_ORDER_SUBMITTED_FOR_APPROVAL', 'PURCHASE_ORDER_SUPPLIER_CONFIRMED',
    'PURCHASE_ORDER_UPDATED', 'LOCAL_OWNER_PASSWORD_RESET', 'SHIFT_CLOSED',
    'SHIFT_OPENED', 'STAFF_CREATED', 'STAFF_PASSWORD_RESET', 'STAFF_PIN_SET',
    'STAFF_UPDATED', 'SUPPLIER_INVOICE_CREATED', 'SUPPLIER_INVOICE_CREDIT_RECORDED',
    'SUPPLIER_INVOICE_DISPUTED', 'SUPPLIER_INVOICE_DISPUTE_RESOLVED',
    'SUPPLIER_INVOICE_PAYMENT_RECORDED', 'SUPPLIER_CREATED',
  ]);
  const actionLabel = (action: string) =>
    knownActions.has(action)
      ? t(`activity.action.${action}` as Parameters<typeof t>[0])
      : humanize(action);

  const filtered = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    return logs.filter((log) => {
      const matchesCategory =
        category === 'All' || categoryFor(log.action) === category;
      if (!matchesCategory) return false;
      if (!normalizedQuery) return true;

      const searchable = [
        actionLabel(log.action),
        log.actor,
        log.entityType,
        log.entityId,
        log.metadata ? JSON.stringify(log.metadata) : '',
      ]
        .join(' ')
        .toLowerCase();

      return searchable.includes(normalizedQuery);
    });
  }, [logs, category, query]);

  return (
    <main className="app-page">
      <PageHeading eyebrow={t('activity.eyebrow')} title={t('activity.title')} />

      <div>
        <PageContainer>
          {message ? (
            <AlertBanner tone="error" icon={<AlertCircle size={18} />}>
              {message}
            </AlertBanner>
          ) : isOwner === false ? (
            <SectionCard>
              <EmptyState
                icon={<ShieldAlert size={28} />}
                title={t('activity.restricted')}
                description={t('activity.ownerOnly')}
              />
            </SectionCard>
          ) : (
            <SectionCard
              title={t('activity.auditTrail')}
              description={t('activity.latestEvents')}
              icon={<Activity size={20} />}
              actions={
                !isLoading ? (
                  <TabCountBadge>
                    {filtered.length}
                  </TabCountBadge>
                ) : null
              }
              bodyPadding={false}
            >
              <div className="border-b border-border-subtle px-4 py-6 sm:px-8">
                <div className="flex flex-col gap-4">
                  <Input
                    type="search"
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder={t('activity.search')}
                    prefixIcon={<Search size={16} />}
                    aria-label={t('activity.searchLabel')}
                  />

                  <nav
                    className="flex items-center gap-7 overflow-x-auto overflow-y-hidden border-b border-border-subtle [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
                    aria-label={t('activity.filterLabel')}
                  >
                    {categories.map((item) => {
                      const active = category === item;
                      return (
                        <TabButton
                          type="button"
                          key={item}
                          active={active}
                          aria-pressed={active}
                          onClick={() => setCategory(item)}
                        >
                          {t(`activity.category.${item}` as const)}
                        </TabButton>
                      );
                    })}
                  </nav>
                </div>
              </div>

              {isLoading ? (
                <EmptyState
                  icon={<Activity size={24} />}
                  title={t('activity.loading')}
                  description={t('activity.pleaseWait')}
                />
              ) : filtered.length === 0 ? (
                <EmptyState
                  icon={<Search size={24} />}
                  title={t('activity.empty')}
                  description={t('activity.emptyHelp')}
                />
              ) : (
                <div className="divide-y divide-border-subtle">
                  {filtered.map((log) => {
                    const logCategory = categoryFor(log.action);
                    const metadata = Object.entries(log.metadata ?? {}).slice(
                      0,
                      2,
                    );

                    return (
                      <article
                        key={log.id}
                        className="flex flex-col gap-3 px-4 py-4 transition hover:bg-muted-surface sm:px-8 sm:py-5 lg:flex-row lg:items-start"
                      >
                        <div className="flex min-w-0 flex-1 items-start gap-3">
                          <span className="inline-flex size-10 shrink-0 items-center justify-center rounded-md border border-brand-border bg-brand-subtle text-brand">
                            {categoryIcon(logCategory)}
                          </span>

                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                              <h3 className="m-0 text-sm font-bold text-text-main">
                                {actionLabel(log.action)}
                              </h3>
                              <StatusBadge tone="neutral">
                                {t(`activity.category.${logCategory === 'Other' ? 'Other' : logCategory}` as Parameters<typeof t>[0])}
                              </StatusBadge>
                            </div>

                            <div className="mt-2 flex flex-wrap gap-x-5 gap-y-2 text-xs text-text-muted">
                              <span className="inline-flex min-w-0 items-center gap-1.5">
                                <UserRound size={14} />
                                <span className="truncate font-semibold text-text-secondary">
                                  {log.actor || t('activity.system')}
                                </span>
                              </span>
                              <span className="inline-flex min-w-0 items-center gap-1.5">
                                <Database size={14} />
                                <span className="truncate">
                                  {log.entityType || t('activity.record')}
                                </span>
                              </span>
                              {log.entityId && (
                                <span className="inline-flex min-w-0 items-center gap-1.5">
                                  <Building2 size={14} />
                                  <span className="max-w-52 truncate font-mono text-xs">
                                    {log.entityId}
                                  </span>
                                </span>
                              )}
                            </div>

                            {metadata.length > 0 && (
                              <div className="mt-2 flex flex-wrap gap-2 sm:mt-3">
                                {metadata.map(([key, value]) => (
                                  <span
                                    key={key}
                                    className="inline-flex max-w-full items-center gap-1 rounded-md border border-border-subtle bg-muted-surface px-2 py-1 text-xs text-text-muted"
                                  >
                                    <strong className="font-bold text-text-secondary">
                                      {humanize(key)}:
                                    </strong>
                                    <span className="max-w-72 truncate">
                                      {metadataValue(value, t('activity.none'), t('activity.updated'))}
                                    </span>
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>

                        <time
                          dateTime={log.createdAt}
                          className="inline-flex shrink-0 items-center gap-1.5 text-xs font-medium text-text-muted"
                        >
                          <Clock3 size={14} />
                          {new Date(log.createdAt).toLocaleString(locale === 'km' ? 'km-KH' : 'en-US')}
                        </time>
                      </article>
                    );
                  })}
                </div>
              )}
            </SectionCard>
          )}
        </PageContainer>
      </div>
    </main>
  );
}
