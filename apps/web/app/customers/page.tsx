'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import {
  Archive,
  ArchiveRestore,
  ContactRound,
  Pencil,
  Plus,
  Search,
  Trash2,
  TrendingUp,
  Users,
} from 'lucide-react';

import { PageContainer } from '../../components/layout/page-container';
import {
  AlertBanner,
  Button,
  EmptyState,
  FormField,
  Input,
  Modal,
  PageHeading,
  SectionCard,
  StatusBadge,
  SummaryMetricCard,
  Textarea,
} from '../../components/ui/';
import { useI18n } from '../../lib/i18n';

const api = '/api';

type Customer = {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  note: string | null;
  isActive: boolean;
  saleCount: number;
  totalSpent: number;
  lastPurchaseAt: string | null;
};

type PendingAction = {
  customer: Customer;
  type: 'archive' | 'delete';
};

const money = (value: number) => `$${(value / 100).toFixed(2)}`;

export default function CustomersPage() {
  const { t, locale } = useI18n();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState<'success' | 'error'>(
    'success',
  );
  const [query, setQuery] = useState('');
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [editing, setEditing] = useState<Customer | null>(null);
  const [saving, setSaving] = useState(false);
  const [pendingAction, setPendingAction] = useState<PendingAction | null>(
    null,
  );

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

  function closeDrawer() {
    setIsAddOpen(false);
    setEditing(null);
  }

  async function load() {
    const response = await fetch(`${api}/customers?includeInactive=true`, {
      headers,
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.message ?? t('customers.error.signIn'));
    setCustomers(data);
  }

  useEffect(() => {
    void load().catch((error: Error) => notify(error.message, 'error'));
  }, []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    setSaving(true);
    try {
      const response = await fetch(`${api}/customers`, {
        method: 'POST',
        headers,
        body: JSON.stringify(Object.fromEntries(new FormData(form))),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok)
        throw new Error(data.message ?? t('customers.error.add'));
      form.reset();
      closeDrawer();
      notify(t('customers.success.added'));
      await load();
    } catch (error) {
      notify(
        error instanceof Error
          ? error.message
          : t('customers.error.noResponse'),
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
      const response = await fetch(`${api}/customers/${editing.id}`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify(Object.fromEntries(new FormData(form))),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok)
        throw new Error(data.message ?? t('customers.error.update'));
      closeDrawer();
      notify(t('customers.success.updated', { name: data.name }));
      await load();
    } catch (error) {
      notify(
        error instanceof Error ? error.message : t('customers.error.update'),
        'error',
      );
    } finally {
      setSaving(false);
    }
  }

  async function archive(customer: Customer) {
    try {
      const response = await fetch(`${api}/customers/${customer.id}`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify({ isActive: false }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok)
        throw new Error(data.message ?? t('customers.error.archive'));
      notify(t('customers.success.archived', { name: customer.name }));
      await load();
    } catch (error) {
      notify(
        error instanceof Error ? error.message : t('customers.error.archive'),
        'error',
      );
    }
  }

  async function reactivate(customer: Customer) {
    try {
      const response = await fetch(`${api}/customers/${customer.id}`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify({ isActive: true }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok)
        throw new Error(data.message ?? t('customers.error.reactivate'));
      notify(t('customers.success.reactivated', { name: customer.name }));
      await load();
    } catch (error) {
      notify(
        error instanceof Error
          ? error.message
          : t('customers.error.reactivate'),
        'error',
      );
    }
  }

  async function remove(customer: Customer) {
    try {
      const response = await fetch(`${api}/customers/${customer.id}`, {
        method: 'DELETE',
        headers,
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok)
        throw new Error(data.message ?? t('customers.error.delete'));
      notify(t('customers.success.deleted', { name: customer.name }));
      await load();
    } catch (error) {
      notify(
        error instanceof Error ? error.message : t('customers.error.delete'),
        'error',
      );
    }
  }

  async function confirmPendingAction() {
    if (!pendingAction) return;
    const action = pendingAction;
    setPendingAction(null);
    if (action.type === 'archive') await archive(action.customer);
    else await remove(action.customer);
  }

  function customerActions(customer: Customer) {
    return (
      <div className="flex items-center justify-end gap-3">
        <Button
          type="button"
          aria-label={t('customers.editNamed', { name: customer.name })}
          title={t('customers.edit')}
          onClick={() => setEditing(customer)}
          variant="ghost"
          size="bareIcon"
          className="text-text-muted hover:bg-transparent hover:text-brand"
        >
          <Pencil size={17} />
        </Button>
        {customer.saleCount ? (
          customer.isActive ? (
            <Button
              type="button"
              aria-label={t('customers.archiveNamed', { name: customer.name })}
              title={t('customers.archive')}
              onClick={() =>
                setPendingAction({
                  customer,
                  type: 'archive',
                })
              }
              variant="ghost"
              size="bareIcon"
              className="text-text-muted hover:bg-transparent hover:text-amber-700"
            >
              <Archive size={17} />
            </Button>
          ) : (
            <Button
              type="button"
              aria-label={t('customers.reactivateNamed', { name: customer.name })}
              title={t('customers.reactivate')}
              onClick={() => void reactivate(customer)}
              variant="ghost"
              size="bareIcon"
              className="text-text-muted hover:bg-transparent hover:text-emerald-700"
            >
              <ArchiveRestore size={17} />
            </Button>
          )
        ) : (
          <Button
            type="button"
            aria-label={t('customers.deleteNamed', { name: customer.name })}
            title={t('customers.delete')}
            onClick={() => setPendingAction({ customer, type: 'delete' })}
            variant="iconBareDanger"
            size="bareIcon"
          >
            <Trash2 size={17} />
          </Button>
        )}
      </div>
    );
  }

  const results = useMemo(
    () =>
      customers.filter((customer) =>
        `${customer.name} ${customer.phone ?? ''} ${customer.email ?? ''}`
          .toLowerCase()
          .includes(query.toLowerCase()),
      ),
    [customers, query],
  );
  const totalSpent = customers.reduce(
    (sum, customer) => sum + customer.totalSpent,
    0,
  );
  const totalVisits = customers.reduce(
    (sum, customer) => sum + customer.saleCount,
    0,
  );

  return (
    <main className="app-page">
      <PageHeading
        eyebrow={t('customers.directory')}
        title={t('entity.customers')}
        actions={
          <Button type="button" onClick={() => setIsAddOpen(true)}>
            <Plus size={16} />
            {t('customers.add')}
          </Button>
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

          <section
            className="mb-6 grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3"
            aria-label={t('customers.summary')}
          >
            <SummaryMetricCard
              title={t('entity.customers')}
              value={customers.length}
              description={t('customers.savedProfiles')}
              icon={<Users size={20} />}
              tone="sky"
            />
            <SummaryMetricCard
              title={t('customers.sales')}
              value={money(totalSpent)}
              description={t('customers.recordedSpending')}
              icon={<TrendingUp size={20} />}
              tone="emerald"
            />
            <SummaryMetricCard
              title={t('customers.visits')}
              value={totalVisits}
              description={t('customers.recordedPurchases')}
              icon={<ContactRound size={20} />}
              tone="rose"
            />
          </section>

          <SectionCard
            title={t('customers.directory')}
            description={t('customers.resultCount', { shown: results.length, total: customers.length })}
            icon={<Users size={20} />}
            actions={
              <span className="rounded-full bg-slate-200 px-2.5 py-1 text-xs font-bold text-text-secondary">
                {customers.length}
              </span>
            }
            bodyPadding={false}
          >
            <div className="border-b border-border-subtle px-4 py-6 sm:px-8">
              <Input
                prefixIcon={<Search size={16} />}
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder={t('customers.search')}
                wrapperClassName="sm:max-w-md"
              />
            </div>

            {results.length ? (
              <>
                <div className="divide-y divide-border-subtle md:hidden">
                  {results.map((customer) => (
                    <article key={customer.id} className="px-4 py-5">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="flex min-w-0 items-center gap-2">
                            <h3 className="m-0 truncate text-sm font-bold text-text-main">
                              {customer.name}
                            </h3>
                            {!customer.isActive && (
                              <StatusBadge tone="neutral">{t('customers.archived')}</StatusBadge>
                            )}
                          </div>
                          <p className="mt-1 mb-0 text-xs text-text-muted">
                            {customer.phone ?? t('customers.noPhone')}
                            {customer.email ? ` · ${customer.email}` : ''}
                          </p>
                        </div>
                        {customerActions(customer)}
                      </div>

                      <dl className="mt-4 grid grid-cols-3 gap-3 rounded-lg border border-border-subtle bg-muted-surface p-3 text-xs">
                        <div>
                          <dt className="font-bold uppercase tracking-wider text-text-muted">
                            {t('customers.visitsShort')}
                          </dt>
                          <dd className="mt-1 mb-0 font-bold text-text-main">
                            {customer.saleCount}
                          </dd>
                        </div>
                        <div>
                          <dt className="font-bold uppercase tracking-wider text-text-muted">
                            {t('customers.spent')}
                          </dt>
                          <dd className="mt-1 mb-0 font-bold text-brand">
                            {money(customer.totalSpent)}
                          </dd>
                        </div>
                        <div>
                          <dt className="font-bold uppercase tracking-wider text-text-muted">
                            {t('customers.last')}
                          </dt>
                          <dd className="mt-1 mb-0 font-semibold text-text-secondary">
                            {customer.lastPurchaseAt
                              ? new Date(
                                  customer.lastPurchaseAt,
                                ).toLocaleDateString(locale === 'km' ? 'km-KH' : 'en-US')
                              : '-'}
                          </dd>
                        </div>
                      </dl>
                    </article>
                  ))}
                </div>

                <div className="hidden overflow-x-auto md:block">
                  <table className="w-full min-w-[820px] border-collapse text-left">
                    <thead className="bg-muted-surface text-xs font-bold uppercase tracking-wider text-text-secondary">
                      <tr className="border-b border-border-subtle">
                        <th className="px-4 py-3 sm:pl-8">{t('entity.customer')}</th>
                        <th className="px-4 py-3">{t('customers.contact')}</th>
                        <th className="px-4 py-3 text-right">{t('customers.visitsShort')}</th>
                        <th className="px-4 py-3 text-right">{t('customers.totalSpent')}</th>
                        <th className="px-4 py-3">{t('customers.lastPurchase')}</th>
                        <th className="px-4 py-3 text-right sm:pr-8">
                          {t('products.actions')}
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {results.map((customer) => (
                        <tr
                          key={customer.id}
                          className="border-b border-border-subtle transition last:border-b-0 hover:bg-muted-surface"
                        >
                          <td className="px-4 py-4 sm:pl-8">
                            <div className="flex items-center gap-2">
                              <strong className="text-sm text-text-main">
                                {customer.name}
                              </strong>
                              {!customer.isActive && (
                                <StatusBadge tone="neutral">
                                  {t('customers.archived')}
                                </StatusBadge>
                              )}
                            </div>
                          </td>
                          <td className="px-4 py-4 text-sm text-text-secondary">
                            <div>{customer.phone ?? '—'}</div>
                            {customer.email && (
                              <div className="mt-0.5 text-xs text-text-muted">
                                {customer.email}
                              </div>
                            )}
                          </td>
                          <td className="px-4 py-4 text-right text-sm font-semibold text-text-secondary">
                            {customer.saleCount}
                          </td>
                          <td className="px-4 py-4 text-right text-sm font-bold text-brand">
                            {money(customer.totalSpent)}
                          </td>
                          <td className="px-4 py-4 text-sm text-text-secondary">
                            {customer.lastPurchaseAt
                              ? new Date(
                                  customer.lastPurchaseAt,
                                ).toLocaleDateString(locale === 'km' ? 'km-KH' : 'en-US')
                              : '—'}
                          </td>
                          <td className="px-4 py-4 sm:pr-8">
                            {customerActions(customer)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            ) : (
              <EmptyState
                icon={<Users size={24} />}
                title={t('customers.empty')}
                description={t('customers.emptyHelp')}
              />
            )}
          </SectionCard>
        </PageContainer>
      </div>

      {(isAddOpen || editing) && (
        <Modal
          title={editing ? t('customers.edit') : t('customers.add')}
          description={
            editing
              ? t('customers.editHelp')
              : t('customers.addHelp')
          }
          icon={<ContactRound size={19} />}
          onClose={closeDrawer}
          size="md"
          density="compact"
          labelledBy="customer-modal-title"
        >
          <form
            key={editing?.id ?? 'new'}
            onSubmit={editing ? update : submit}
            className="space-y-5"
            autoComplete="off"
          >
            <div className="grid grid-cols-1 items-start gap-x-4 gap-y-4 md:grid-cols-2">
              <FormField
                label={t('customers.fullName')}
                required
                id="customer-name"
                className="md:col-span-2"
              >
                <Input
                  id="customer-name"
                  required
                  autoFocus
                  name="name"
                  defaultValue={editing?.name ?? ''}
                  placeholder={t('customers.namePlaceholder')}
                />
              </FormField>
              <FormField
                label={t('customers.phone')}
                sublabel={t('common.optional')}
                id="customer-phone"
              >
                <Input
                  id="customer-phone"
                  name="phone"
                  defaultValue={editing?.phone ?? ''}
                  inputMode="tel"
                  placeholder={t('customers.phonePlaceholder')}
                />
              </FormField>
              <FormField
                label={t('auth.email')}
                sublabel={t('common.optional')}
                id="customer-email"
              >
                <Input
                  id="customer-email"
                  name="email"
                  defaultValue={editing?.email ?? ''}
                  type="email"
                  placeholder={t('customers.emailPlaceholder')}
                />
              </FormField>
              <FormField
                label={t('customers.note')}
                sublabel={t('common.optional')}
                id="customer-note"
                className="md:col-span-2"
              >
                <Textarea
                  id="customer-note"
                  name="note"
                  defaultValue={editing?.note ?? ''}
                  placeholder={t('customers.notePlaceholder')}
                  rows={4}
                />
              </FormField>
            </div>
            <div className="flex items-center justify-end gap-2 border-t border-border-subtle pt-5">
              <Button type="button" variant="secondary" onClick={closeDrawer}>
                {t('common.cancel')}
              </Button>
              <Button type="submit" disabled={saving}>
                {editing ? <Pencil size={16} /> : <Plus size={16} />}
                {saving
                  ? t('common.saving')
                  : editing
                    ? t('branches.saveChanges')
                    : t('customers.add')}
              </Button>
            </div>
          </form>
        </Modal>
      )}

      {pendingAction && (
        <Modal
          title={
            pendingAction.type === 'archive'
              ? t('customers.archiveTitle')
              : t('customers.deleteTitle')
          }
          description={
            pendingAction.type === 'archive'
              ? t('customers.archiveHelpNamed', { name: pendingAction.customer.name })
              : t('customers.deleteHelpNamed', { name: pendingAction.customer.name })
          }
          icon={
            pendingAction.type === 'archive' ? (
              <Archive size={19} />
            ) : (
              <Trash2 size={19} />
            )
          }
          onClose={() => setPendingAction(null)}
          size="sm"
          density="compact"
          footer={
            <>
              <Button
                type="button"
                variant="secondary"
                onClick={() => setPendingAction(null)}
              >
                {t('common.cancel')}
              </Button>
              <Button
                type="button"
                variant={
                  pendingAction.type === 'archive' ? 'warningSubtle' : 'danger'
                }
                onClick={() => void confirmPendingAction()}
              >
                {pendingAction.type === 'archive' ? t('customers.archiveAction') : t('customers.deleteAction')}
              </Button>
            </>
          }
        >
          <div className="rounded-lg border border-border-subtle bg-muted-surface p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="m-0 truncate text-sm font-bold text-text-main">
                  {pendingAction.customer.name}
                </p>
                <p className="mt-1 mb-0 text-xs text-text-muted">
                  {pendingAction.customer.phone ?? t('customers.noPhone')}
                  {pendingAction.customer.email
                    ? ` · ${pendingAction.customer.email}`
                    : ''}
                </p>
              </div>
              <StatusBadge
                tone={pendingAction.customer.isActive ? 'success' : 'neutral'}
              >
                {pendingAction.customer.isActive ? t('common.active') : t('customers.archived')}
              </StatusBadge>
            </div>
          </div>
        </Modal>
      )}
    </main>
  );
}
