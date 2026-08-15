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
    if (!response.ok) throw new Error(data.message ?? 'Please sign in again.');
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
        throw new Error(data.message ?? 'Unable to add customer.');
      form.reset();
      closeDrawer();
      notify('Customer added and ready to use at checkout.');
      await load();
    } catch (error) {
      notify(
        error instanceof Error
          ? error.message
          : 'The API server did not return a response.',
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
        throw new Error(data.message ?? 'Unable to update customer.');
      closeDrawer();
      notify(`${data.name} updated.`);
      await load();
    } catch (error) {
      notify(
        error instanceof Error ? error.message : 'Unable to update customer.',
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
        throw new Error(data.message ?? 'Unable to archive customer.');
      notify(`${customer.name} archived. Purchase history is unchanged.`);
      await load();
    } catch (error) {
      notify(
        error instanceof Error ? error.message : 'Unable to archive customer.',
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
        throw new Error(data.message ?? 'Unable to reactivate customer.');
      notify(`${customer.name} is active and available at checkout.`);
      await load();
    } catch (error) {
      notify(
        error instanceof Error
          ? error.message
          : 'Unable to reactivate customer.',
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
        throw new Error(data.message ?? 'Unable to delete customer.');
      notify(`${customer.name} deleted.`);
      await load();
    } catch (error) {
      notify(
        error instanceof Error ? error.message : 'Unable to delete customer.',
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
          aria-label={`Edit ${customer.name}`}
          title="Edit customer"
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
              aria-label={`Archive ${customer.name}`}
              title="Archive customer"
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
              aria-label={`Reactivate ${customer.name}`}
              title="Reactivate customer"
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
            aria-label={`Delete ${customer.name}`}
            title="Delete customer"
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
        eyebrow="Customer directory"
        title="Customers"
        actions={
          <Button type="button" onClick={() => setIsAddOpen(true)}>
            <Plus size={16} />
            Add customer
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
            aria-label="Customer summary"
          >
            <SummaryMetricCard
              title="Customers"
              value={customers.length}
              description="Saved profiles"
              icon={<Users size={20} />}
              tone="sky"
            />
            <SummaryMetricCard
              title="Customer sales"
              value={money(totalSpent)}
              description="Recorded spending"
              icon={<TrendingUp size={20} />}
              tone="emerald"
            />
            <SummaryMetricCard
              title="Customer visits"
              value={totalVisits}
              description="Recorded purchases"
              icon={<ContactRound size={20} />}
              tone="rose"
            />
          </section>

          <SectionCard
            title="Customer directory"
            description={`${results.length} of ${customers.length} customers`}
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
                placeholder="Search name, phone, or email"
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
                              <StatusBadge tone="neutral">Archived</StatusBadge>
                            )}
                          </div>
                          <p className="mt-1 mb-0 text-xs text-text-muted">
                            {customer.phone ?? 'No phone'}
                            {customer.email ? ` · ${customer.email}` : ''}
                          </p>
                        </div>
                        {customerActions(customer)}
                      </div>

                      <dl className="mt-4 grid grid-cols-3 gap-3 rounded-lg border border-border-subtle bg-muted-surface p-3 text-xs">
                        <div>
                          <dt className="font-bold uppercase tracking-wider text-text-muted">
                            Visits
                          </dt>
                          <dd className="mt-1 mb-0 font-bold text-text-main">
                            {customer.saleCount}
                          </dd>
                        </div>
                        <div>
                          <dt className="font-bold uppercase tracking-wider text-text-muted">
                            Spent
                          </dt>
                          <dd className="mt-1 mb-0 font-bold text-brand">
                            {money(customer.totalSpent)}
                          </dd>
                        </div>
                        <div>
                          <dt className="font-bold uppercase tracking-wider text-text-muted">
                            Last
                          </dt>
                          <dd className="mt-1 mb-0 font-semibold text-text-secondary">
                            {customer.lastPurchaseAt
                              ? new Date(
                                  customer.lastPurchaseAt,
                                ).toLocaleDateString()
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
                        <th className="px-4 py-3 sm:pl-8">Customer</th>
                        <th className="px-4 py-3">Contact</th>
                        <th className="px-4 py-3 text-right">Visits</th>
                        <th className="px-4 py-3 text-right">Total spent</th>
                        <th className="px-4 py-3">Last purchase</th>
                        <th className="px-4 py-3 text-right sm:pr-8">
                          Actions
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
                                  Archived
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
                                ).toLocaleDateString()
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
                title="No customers found"
                description="Try a different name, phone number, or email."
              />
            )}
          </SectionCard>
        </PageContainer>
      </div>

      {(isAddOpen || editing) && (
        <Modal
          title={editing ? 'Edit customer' : 'Add customer'}
          description={
            editing
              ? 'Update this customer profile.'
              : 'Create a profile for faster checkout.'
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
                label="Full name"
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
                  placeholder="e.g. Sophie Chan"
                />
              </FormField>
              <FormField
                label="Phone number"
                sublabel="(optional)"
                id="customer-phone"
              >
                <Input
                  id="customer-phone"
                  name="phone"
                  defaultValue={editing?.phone ?? ''}
                  inputMode="tel"
                  placeholder="e.g. 098 738 393"
                />
              </FormField>
              <FormField
                label="Email address"
                sublabel="(optional)"
                id="customer-email"
              >
                <Input
                  id="customer-email"
                  name="email"
                  defaultValue={editing?.email ?? ''}
                  type="email"
                  placeholder="e.g. sophie@email.com"
                />
              </FormField>
              <FormField
                label="Customer note"
                sublabel="(optional)"
                id="customer-note"
                className="md:col-span-2"
              >
                <Textarea
                  id="customer-note"
                  name="note"
                  defaultValue={editing?.note ?? ''}
                  placeholder="Preference, reminder, or helpful detail"
                  rows={4}
                />
              </FormField>
            </div>
            <div className="flex items-center justify-end gap-2 border-t border-border-subtle pt-5">
              <Button type="button" variant="secondary" onClick={closeDrawer}>
                Cancel
              </Button>
              <Button type="submit" disabled={saving}>
                {editing ? <Pencil size={16} /> : <Plus size={16} />}
                {saving
                  ? 'Saving...'
                  : editing
                    ? 'Save changes'
                    : 'Add customer'}
              </Button>
            </div>
          </form>
        </Modal>
      )}

      {pendingAction && (
        <Modal
          title={
            pendingAction.type === 'archive'
              ? 'Archive customer?'
              : 'Delete customer?'
          }
          description={
            pendingAction.type === 'archive'
              ? `${pendingAction.customer.name} will not appear at checkout, but history stays saved.`
              : `${pendingAction.customer.name} has no sales and will be permanently deleted.`
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
                Cancel
              </Button>
              <Button
                type="button"
                variant={
                  pendingAction.type === 'archive' ? 'warningSubtle' : 'danger'
                }
                onClick={() => void confirmPendingAction()}
              >
                {pendingAction.type === 'archive' ? 'Archive' : 'Delete'}
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
                  {pendingAction.customer.phone ?? 'No phone'}
                  {pendingAction.customer.email
                    ? ` · ${pendingAction.customer.email}`
                    : ''}
                </p>
              </div>
              <StatusBadge
                tone={pendingAction.customer.isActive ? 'success' : 'neutral'}
              >
                {pendingAction.customer.isActive ? 'Active' : 'Archived'}
              </StatusBadge>
            </div>
          </div>
        </Modal>
      )}
    </main>
  );
}
