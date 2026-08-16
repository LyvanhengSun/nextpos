'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import {
  Building2,
  Mail,
  MapPin,
  Phone,
  Plus,
  Search,
  Truck,
} from 'lucide-react';

import {
  AlertBanner,
  Button,
  ButtonLink,
  CustomSelect,
  EmptyState,
  FormField,
  Input,
  PageHeading,
  Textarea,
} from '../../components/ui/';
import { PageContainer } from '../../components/layout/page-container';
import { useI18n } from '../../lib/i18n';

const api = '/api';

type Supplier = {
  id: string;
  code: string;
  name: string;
  phone: string | null;
  email: string | null;
  address: string | null;
  isActive: boolean;
  summary?: {
    activeProductLinks: number;
    lastOrderAt: string | null;
    receivedSpend: number;
    openInvoiceBalance: number;
  };
};

export default function SuppliersPage() {
  const { t, locale } = useI18n();
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState<'success' | 'error'>(
    'success',
  );
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<
    'active' | 'inactive' | 'all'
  >('active');
  const [performancePeriod, setPerformancePeriod] = useState<
    'all' | '30d' | '90d' | 'year'
  >('all');
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState<Supplier | null>(null);
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

  function notify(text: string, type: 'success' | 'error' = 'success') {
    setMessage(text);
    setMessageType(type);
  }

  async function load() {
    const today = new Date();
    const date = (value: Date) => value.toISOString().slice(0, 10);
    const start = new Date(today);
    if (performancePeriod === '30d') start.setDate(today.getDate() - 30);
    if (performancePeriod === '90d') start.setDate(today.getDate() - 90);
    if (performancePeriod === 'year') start.setMonth(0, 1);
    const range =
      performancePeriod === 'all'
        ? ''
        : `&from=${date(start)}&to=${date(today)}`;
    const response = await fetch(
      `${api}/suppliers?includeInactive=true&includeSummary=true${range}`,
      {
        headers,
      },
    );
    const data = await response.json().catch(() => ({}));
    if (!response.ok)
      throw new Error(data.message ?? t('supplierPage.error.load'));
    setSuppliers(data);
  }

  useEffect(() => {
    void load().catch((error: Error) => notify(error.message, 'error'));
  }, [performancePeriod]);

  async function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    setSaving(true);
    try {
      const response = await fetch(`${api}/suppliers`, {
        method: 'POST',
        headers,
        body: JSON.stringify(Object.fromEntries(new FormData(form))),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok)
        throw new Error(data.message ?? t('supplierPage.error.add'));
      form.reset();
      await load();
      notify(t('supplierPage.success.added', { name: data.name }));
    } catch (error) {
      notify(
        error instanceof Error ? error.message : t('supplierPage.error.add'),
        'error',
      );
    } finally {
      setSaving(false);
    }
  }

  async function update(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editing) return;
    const form = event.currentTarget;
    setSaving(true);
    try {
      const response = await fetch(`${api}/suppliers/${editing.id}`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify(Object.fromEntries(new FormData(form))),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok)
        throw new Error(data.message ?? t('supplierPage.error.update'));
      setEditing(null);
      await load();
      notify(t('supplierPage.success.updated', { name: data.name }));
    } catch (error) {
      notify(
        error instanceof Error ? error.message : t('supplierPage.error.update'),
        'error',
      );
    } finally {
      setSaving(false);
    }
  }

  async function deactivate(supplier: Supplier) {
    if (
      !window.confirm(
        t('supplierPage.confirmDeactivate', { name: supplier.name }),
      )
    )
      return;
    try {
      const response = await fetch(`${api}/suppliers/${supplier.id}`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify({ isActive: false }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok)
        throw new Error(data.message ?? t('supplierPage.error.deactivate'));
      if (editing?.id === supplier.id) setEditing(null);
      await load();
      notify(t('supplierPage.success.deactivated', { name: supplier.name }));
    } catch (error) {
      notify(
        error instanceof Error
          ? error.message
          : t('supplierPage.error.deactivate'),
        'error',
      );
    }
  }

  async function reactivate(supplier: Supplier) {
    try {
      const response = await fetch(`${api}/suppliers/${supplier.id}`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify({ isActive: true }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok)
        throw new Error(data.message ?? t('supplierPage.error.reactivate'));
      await load();
      notify(t('supplierPage.success.reactivated', { name: supplier.name }));
    } catch (error) {
      notify(
        error instanceof Error
          ? error.message
          : t('supplierPage.error.reactivate'),
        'error',
      );
    }
  }

  const visibleSuppliers = useMemo(
    () =>
      suppliers.filter(
        (supplier) =>
          (statusFilter === 'all' ||
            (statusFilter === 'active'
              ? supplier.isActive
              : !supplier.isActive)) &&
          `${supplier.name} ${supplier.phone ?? ''} ${supplier.email ?? ''} ${supplier.address ?? ''}`
            .toLowerCase()
            .includes(query.toLowerCase()),
      ),
    [suppliers, query, statusFilter],
  );

  return (
    <main className="app-page">
      <PageHeading
        eyebrow={t('supplierPage.purchasing')}
        title={t('entity.suppliers')}
        actions={
          <label className="flex items-center gap-2 text-xs font-bold text-text-secondary">
            <span className="hidden sm:inline">{t('supplierPage.period')}</span>
            <div className="w-36">
              <CustomSelect
                value={performancePeriod}
                onChange={(value) =>
                  setPerformancePeriod(value as 'all' | '30d' | '90d' | 'year')
                }
                options={[
                  { value: 'all', label: t('supplierPage.allTime') },
                  { value: '30d', label: t('supplierPage.last30') },
                  { value: '90d', label: t('supplierPage.last90') },
                  { value: 'year', label: t('supplierPage.thisYear') },
                ]}
              />
            </div>
          </label>
        }
      />

      <div>
        <PageContainer>
          {message && (
            <AlertBanner
              tone={messageType === 'success' ? 'success' : 'error'}
              className="mb-5"
            >
              {message}
            </AlertBanner>
          )}

          <section className="grid grid-cols-1 items-start gap-6 xl:grid-cols-[minmax(19rem,0.72fr)_minmax(0,1.6fr)]">
            <article className="overflow-hidden rounded-lg border border-border-subtle bg-card shadow-sm">
              <div className="flex items-start justify-between gap-4 border-b border-border-subtle px-4 py-6 sm:px-8">
                <div className="flex min-w-0 items-center gap-3">
                  <div className="grid size-10 shrink-0 place-items-center rounded-md border border-brand/20 bg-brand-subtle text-brand">
                    <Truck size={18} />
                  </div>
                  <div className="min-w-0">
                    <h2 className="m-0 text-base font-bold tracking-tight text-text-main">
                      {editing ? t('supplierPage.edit') : t('supplierPage.add')}
                    </h2>
                    <p className="mt-1 mb-0 text-xs text-text-muted">
                      {editing
                        ? t('supplierPage.editHelp')
                        : t('supplierPage.addHelp')}
                    </p>
                  </div>
                </div>
                {editing && (
                  <Button
                    type="button"
                    onClick={() => setEditing(null)}
                    variant="ghost"
                    size="sm"
                  >
                    {t('common.cancel')}
                  </Button>
                )}
              </div>
              <form
                className="flex flex-col gap-4 px-4 py-6 sm:px-8"
                key={editing?.id ?? 'new'}
                onSubmit={editing ? update : create}
                autoComplete="off"
              >
                <FormField label={t('supplierPage.name')} required id="supplier-name">
                  <Input
                    id="supplier-name"
                    required
                    name="name"
                    minLength={2}
                    maxLength={100}
                    defaultValue={editing?.name}
                    placeholder={t('supplierPage.namePlaceholder')}
                  />
                </FormField>
                <FormField
                  label={t('customers.phone')}
                  sublabel={t('common.optional')}
                  id="supplier-phone"
                >
                  <Input
                    id="supplier-phone"
                    name="phone"
                    inputMode="tel"
                    defaultValue={editing?.phone ?? ''}
                    placeholder={t('supplierPage.phonePlaceholder')}
                  />
                </FormField>
                <FormField
                  label={t('auth.email')}
                  sublabel={t('common.optional')}
                  id="supplier-email"
                >
                  <Input
                    id="supplier-email"
                    name="email"
                    type="email"
                    defaultValue={editing?.email ?? ''}
                    placeholder={t('supplierPage.emailPlaceholder')}
                  />
                </FormField>
                <FormField
                  label={t('branches.address')}
                  sublabel={t('common.optional')}
                  id="supplier-address"
                >
                  <Textarea
                    id="supplier-address"
                    name="address"
                    defaultValue={editing?.address ?? ''}
                    maxLength={200}
                    rows={3}
                    placeholder={t('supplierPage.addressPlaceholder')}
                  />
                </FormField>
                <Button type="submit" className="mt-1 w-full" disabled={saving}>
                  <Plus size={16} />
                  {saving
                    ? t('common.saving')
                    : editing
                      ? t('suppliers.save')
                      : t('supplierPage.add')}
                </Button>
              </form>
            </article>

            <article className="overflow-hidden rounded-lg border border-border-subtle bg-card shadow-sm">
              <div className="border-b border-border-subtle px-4 py-6 sm:px-8">
                <div>
                  <h2 className="m-0 text-base font-bold tracking-tight text-text-main">
                    {t('supplierPage.directory')}
                  </h2>
                  <p className="mt-1 mb-0 text-xs text-text-muted">
                    {t('supplierPage.count', { shown: visibleSuppliers.length, total: suppliers.length })}
                  </p>
                </div>
              </div>
              <div className="border-b border-border-subtle px-4 py-4 sm:px-8">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <Input
                    prefixIcon={<Search size={16} />}
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder={t('supplierPage.search')}
                    wrapperClassName="sm:max-w-md"
                  />
                  <div className="flex w-full items-center rounded-md border border-border-subtle bg-app p-1 sm:w-auto">
                    {(
                      [
                        { key: 'active', label: t('common.active') },
                        { key: 'inactive', label: t('common.inactive') },
                        { key: 'all', label: t('common.all') },
                      ] as const
                    ).map((filter) => (
                      <Button
                        key={filter.key}
                        type="button"
                        onClick={() => setStatusFilter(filter.key)}
                        variant={
                          statusFilter === filter.key ? 'secondary' : 'ghost'
                        }
                        size="sm"
                        className="flex-1 border-0 shadow-none sm:flex-none"
                      >
                        {filter.label}
                      </Button>
                    ))}
                  </div>
                </div>
              </div>
              {visibleSuppliers.length ? (
                <div>
                  {visibleSuppliers.map((supplier) => (
                    <article
                      key={supplier.id}
                      className="flex flex-col gap-4 border-b border-border-subtle px-4 py-5 last:border-b-0 hover:bg-muted-surface sm:flex-row sm:px-8"
                    >
                      <div className="grid size-9 shrink-0 place-items-center rounded-md border border-brand/20 bg-brand-subtle text-brand">
                        <Building2 size={17} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <strong className="flex flex-wrap items-center gap-2 text-sm font-bold text-text-main">
                          {supplier.name}
                          {!supplier.isActive && (
                            <span className="rounded-full border border-border-subtle bg-muted-surface px-2 py-1 text-xs font-bold text-text-muted">
                              {t('common.inactive')}
                            </span>
                          )}
                        </strong>
                        <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1 text-xs text-text-muted">
                          {supplier.phone && (
                            <span className="inline-flex items-center gap-1">
                              <Phone size={13} />
                              {supplier.phone}
                            </span>
                          )}
                          {supplier.email && (
                            <span className="inline-flex items-center gap-1">
                              <Mail size={13} />
                              {supplier.email}
                            </span>
                          )}
                          {supplier.address && (
                            <span className="inline-flex items-center gap-1">
                              <MapPin size={13} />
                              {supplier.address}
                            </span>
                          )}
                          {!supplier.phone &&
                            !supplier.email &&
                            !supplier.address && (
                              <span>{t('supplierPage.noContact')}</span>
                            )}
                        </div>
                        {supplier.summary && (
                          <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs text-text-muted">
                            <span>
                              {t('supplierPage.linkedProducts', { count: supplier.summary.activeProductLinks })}
                            </span>
                            <span>
                              {t('supplierPage.receivedSpend', { amount: `$${(supplier.summary.receivedSpend / 100).toFixed(2)}` })}
                            </span>
                            <span>
                              {t('supplierPage.openInvoices', { amount: `$${(supplier.summary.openInvoiceBalance / 100).toFixed(2)}` })}
                            </span>
                            <span>
                              {supplier.summary.lastOrderAt
                                ? t('supplierPage.lastOrder', { date: new Date(supplier.summary.lastOrderAt).toLocaleDateString(locale === 'km' ? 'km-KH' : 'en-US') })
                                : t('supplierPage.noOrders')}
                            </span>
                          </div>
                        )}
                      </div>
                      <div className="flex flex-wrap items-center gap-2 sm:ml-auto sm:shrink-0 sm:self-start">
                        <ButtonLink
                          href={`/suppliers/${supplier.code.toLowerCase()}`}
                          variant="ghost"
                          size="sm"
                        >
                          {t('supplierPage.view')}
                        </ButtonLink>
                        <Button
                          type="button"
                          onClick={() => setEditing(supplier)}
                          variant="secondary"
                          size="sm"
                        >
                          {t('common.edit')}
                        </Button>
                        {supplier.isActive ? (
                          <Button
                            type="button"
                            onClick={() => void deactivate(supplier)}
                            variant="dangerSubtle"
                            size="sm"
                          >
                            {t('supplierPage.deactivate')}
                          </Button>
                        ) : (
                          <Button
                            type="button"
                            onClick={() => void reactivate(supplier)}
                            variant="successSubtle"
                            size="sm"
                          >
                            {t('supplierPage.reactivate')}
                          </Button>
                        )}
                      </div>
                    </article>
                  ))}
                </div>
              ) : (
                <EmptyState
                  icon={<Truck size={24} />}
                  title={query ? t('supplierPage.emptySearch') : t('supplierPage.empty')}
                  description={
                    query
                      ? t('supplierPage.emptySearchHelp')
                      : t('supplierPage.emptyHelp')
                  }
                />
              )}
            </article>
          </section>
        </PageContainer>
      </div>
    </main>
  );
}
