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

const actionLabel = (action: string) =>
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

function metadataValue(value: unknown) {
  if (value === null) return 'None';
  if (typeof value === 'object') {
    try {
      return JSON.stringify(value);
    } catch {
      return 'Updated';
    }
  }
  return String(value);
}

export default function ActivityPage() {
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
            : 'Only the owner can view activity logs.',
        );
      }
      setLogs(Array.isArray(data) ? data : []);
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : 'Unable to load activity logs.',
      );
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    void checkRoleAndLoad();
  }, []);

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
      <PageHeading eyebrow="Owner control" title="Activity logs" />

      <div className="py-6">
        <PageContainer>
          {message ? (
            <AlertBanner tone="error" icon={<AlertCircle size={18} />}>
              {message}
            </AlertBanner>
          ) : isOwner === false ? (
            <SectionCard>
              <EmptyState
                icon={<ShieldAlert size={28} />}
                title="Access restricted"
                description="Owner only."
              />
            </SectionCard>
          ) : (
            <SectionCard
              title="Audit trail"
              description="Latest events"
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
                    placeholder="Search activity"
                    prefixIcon={<Search size={16} />}
                    aria-label="Search activity logs"
                  />

                  <nav
                    className="flex items-center gap-7 overflow-x-auto overflow-y-hidden border-b border-border-subtle [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
                    aria-label="Filter activity by category"
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
                          {item}
                        </TabButton>
                      );
                    })}
                  </nav>
                </div>
              </div>

              {isLoading ? (
                <EmptyState
                  icon={<Activity size={24} />}
                  title="Loading activity"
                  description="Please wait."
                />
              ) : filtered.length === 0 ? (
                <EmptyState
                  icon={<Search size={24} />}
                  title="No matching activity"
                  description="Try another search or filter."
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
                                {logCategory}
                              </StatusBadge>
                            </div>

                            <div className="mt-2 flex flex-wrap gap-x-5 gap-y-2 text-xs text-text-muted">
                              <span className="inline-flex min-w-0 items-center gap-1.5">
                                <UserRound size={14} />
                                <span className="truncate font-semibold text-text-secondary">
                                  {log.actor || 'System'}
                                </span>
                              </span>
                              <span className="inline-flex min-w-0 items-center gap-1.5">
                                <Database size={14} />
                                <span className="truncate">
                                  {log.entityType || 'Record'}
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
                                      {actionLabel(key)}:
                                    </strong>
                                    <span className="max-w-72 truncate">
                                      {metadataValue(value)}
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
                          {new Date(log.createdAt).toLocaleString()}
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
