'use client';

import {
  Building2,
  CheckCircle2,
  CircleAlert,
  CircleCheck,
  MapPin,
  Pencil,
  Plus,
  Store,
  Users,
  X,
} from 'lucide-react';
import { FormEvent, useEffect, useState } from 'react';

import { PageContainer } from '../../components/layout/page-container';
import {
  AlertBanner,
  Button,
  EmptyState,
  FormField,
  Input,
  PageHeading,
  SectionCard,
  StatusBadge,
  Textarea,
} from '../../components/ui/';
import { useI18n } from '../../lib/i18n';

const api = '/api';

type Branch = {
  id: string;
  name: string;
  code: string;
  address: string | null;
  _count: { users: number; inventory: number; sales: number };
};
type Me = { branchId: string | null; role: string };

export default function BranchesPage() {
  const { t } = useI18n();
  const [branches, setBranches] = useState<Branch[]>([]);
  const [me, setMe] = useState<Me | null>(null);
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState<'success' | 'error'>(
    'success',
  );
  const [editing, setEditing] = useState<Branch | null>(null);
  const [saving, setSaving] = useState(false);

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

  async function load(accessToken = token) {
    const requestHeaders = {
      ...headers,
      Authorization: `Bearer ${accessToken}`,
    };
    const [meResponse, branchResponse] = await Promise.all([
      fetch(`${api}/auth/me`, { headers: requestHeaders }),
      fetch(`${api}/businesses/current/branches`, { headers: requestHeaders }),
    ]);
    if (!meResponse.ok || !branchResponse.ok)
      throw new Error(t('branches.error.signIn'));
    setMe(await meResponse.json());
    setBranches(await branchResponse.json());
  }

  useEffect(() => {
    void load().catch((error: Error) => notify(error.message, 'error'));
  }, []);

  async function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    setSaving(true);
    try {
      const response = await fetch(`${api}/businesses/current/branches`, {
        method: 'POST',
        headers,
        body: JSON.stringify(Object.fromEntries(new FormData(formElement))),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok)
        throw new Error(data.message ?? t('branches.error.create'));
      formElement.reset();
      notify(t('branches.success.created', { name: data.name }));
      await load();
    } catch (error) {
      notify(
        error instanceof Error ? error.message : t('branches.error.create'),
        'error',
      );
    } finally {
      setSaving(false);
    }
  }

  async function selectBranch(branch: Branch) {
    try {
      const response = await fetch(`${api}/auth/switch-branch`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ branchId: branch.id }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok)
        throw new Error(data.message ?? t('branches.error.switch'));
      sessionStorage.setItem('pos_access_token', data.accessToken);
      setMe((current) =>
        current ? { ...current, branchId: branch.id } : current,
      );
      await load(data.accessToken);
      notify(t('branches.success.switched', { name: branch.name }));
    } catch (error) {
      notify(
        error instanceof Error ? error.message : t('branches.error.switch'),
        'error',
      );
    }
  }

  async function update(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editing) return;
    setSaving(true);
    try {
      const response = await fetch(
        `${api}/businesses/current/branches/${editing.id}`,
        {
          method: 'PATCH',
          headers,
          body: JSON.stringify(
            Object.fromEntries(new FormData(event.currentTarget)),
          ),
        },
      );
      const data = await response.json().catch(() => ({}));
      if (!response.ok)
        throw new Error(data.message ?? t('branches.error.update'));
      setEditing(null);
      notify(t('branches.success.updated', { name: data.name }));
      await load();
    } catch (error) {
      notify(
        error instanceof Error ? error.message : t('branches.error.update'),
        'error',
      );
    } finally {
      setSaving(false);
    }
  }

  const canManage = me?.role === 'OWNER';

  return (
    <main className="app-page">
      <PageHeading eyebrow={t('branches.eyebrow')} title={t('entity.branches')} />

      <div>
        <PageContainer>
          {message && (
            <AlertBanner
              tone={messageType === 'success' ? 'success' : 'error'}
              icon={
                messageType === 'success' ? (
                  <CircleCheck size={18} />
                ) : (
                  <CircleAlert size={18} />
                )
              }
              className="mb-5"
            >
              {message}
            </AlertBanner>
          )}

          {!canManage && me && (
            <AlertBanner tone="info" className="mb-5">
              {t('branches.ownerOnly')}
            </AlertBanner>
          )}

          <div
            className={`grid grid-cols-1 items-start gap-6 ${
              canManage
                ? 'xl:grid-cols-[minmax(19rem,0.72fr)_minmax(0,1.5fr)]'
                : ''
            }`}
          >
            {canManage && (
              <SectionCard
                title={t('branches.add')}
                description={t('branches.addHelp')}
                icon={<Building2 size={20} />}
              >
                <form
                  className="flex flex-col gap-4"
                  onSubmit={create}
                  autoComplete="off"
                >
                  <FormField label={t('branches.name')} required id="branch-name">
                    <Input
                      id="branch-name"
                      required
                      name="name"
                      placeholder={t('branches.namePlaceholder')}
                    />
                  </FormField>
                  <FormField
                    label={t('branches.code')}
                    required
                    help={t('branches.codeHelp')}
                    id="branch-code"
                  >
                    <Input
                      id="branch-code"
                      required
                      name="code"
                      placeholder={t('branches.codePlaceholder')}
                      maxLength={24}
                      autoCapitalize="characters"
                      className="uppercase"
                    />
                  </FormField>
                  <FormField
                    label={t('branches.address')}
                    sublabel={t('common.optional')}
                    id="branch-address"
                  >
                    <Textarea
                      id="branch-address"
                      name="address"
                      rows={3}
                      placeholder={t('branches.addressPlaceholder')}
                    />
                  </FormField>
                  <Button
                    type="submit"
                    disabled={saving}
                    className="w-full"
                  >
                    <Plus size={16} />
                    {saving ? t('branches.creating') : t('branches.create')}
                  </Button>
                </form>
              </SectionCard>
            )}

            <SectionCard
              title={t('branches.yours')}
              description={t('branches.chooseCurrent')}
              icon={<Store size={20} />}
              actions={
                <span className="rounded-full bg-muted-strong px-2.5 py-1 text-xs font-bold text-text-secondary">
                  {t('branches.count', { count: branches.length })}
                </span>
              }
              bodyClassName="flex flex-col gap-3"
            >
              {branches.length ? (
                branches.map((branch) => {
                  const active = branch.id === me?.branchId;
                  return (
                    <article
                      key={branch.id}
                      className={`flex flex-col gap-3 rounded-lg border px-4 py-4 transition sm:flex-row sm:items-center sm:justify-between ${
                        active
                          ? 'border-brand bg-brand-subtle/60 shadow-sm'
                          : 'border-border-subtle bg-card hover:border-brand/40 hover:bg-muted-surface'
                      }`}
                    >
                      <div className="flex min-w-0 items-start gap-3">
                        <div
                          className={`grid size-10 shrink-0 place-items-center rounded-md border ${
                            active
                              ? 'border-brand/30 bg-card text-brand'
                              : 'border-border-subtle bg-muted-surface text-text-muted'
                          }`}
                        >
                          <Store size={18} />
                        </div>
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <h3 className="m-0 text-base font-bold text-text-main">
                              {branch.name}
                            </h3>
                            {active && (
                              <StatusBadge tone="success">
                                <CheckCircle2 size={13} />
                                {t('branches.current')}
                              </StatusBadge>
                            )}
                          </div>
                          <p className="mt-1 mb-0 flex items-start gap-1.5 text-xs text-text-muted">
                            <MapPin size={14} className="mt-px shrink-0" />
                            <span>
                              {branch.code}
                              {branch.address ? ` · ${branch.address}` : ''}
                            </span>
                          </p>
                          <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs font-medium text-text-secondary">
                            <span className="inline-flex items-center gap-1">
                              <Users size={13} />
                              {t('branches.staffCount', { count: branch._count.users })}
                            </span>
                            <span>
                              {t('branches.stockedCount', { count: branch._count.inventory })}
                            </span>
                            <span>{t('branches.salesCount', { count: branch._count.sales })}</span>
                          </div>
                        </div>
                      </div>
                      <div className="flex shrink-0 flex-wrap items-center gap-2 sm:justify-end">
                        {!active && me?.role !== 'CASHIER' && (
                          <Button
                            type="button"
                            variant="brandSubtle"
                            size="sm"
                            onClick={() => void selectBranch(branch)}
                          >
                            <MapPin size={15} />
                            {t('branches.use')}
                          </Button>
                        )}
                        {canManage && (
                          <Button
                            type="button"
                            variant="secondary"
                            size="sm"
                            onClick={() => setEditing(branch)}
                          >
                            <Pencil size={15} />
                            {t('common.edit')}
                          </Button>
                        )}
                      </div>
                    </article>
                  );
                })
              ) : (
                <EmptyState
                  icon={<Building2 size={24} />}
                  title={t('branches.empty')}
                  description={
                    canManage
                      ? t('branches.emptyOwner')
                      : t('branches.emptyStaff')
                  }
                />
              )}
            </SectionCard>
          </div>
        </PageContainer>
      </div>

      {editing && (
        <div className="fixed inset-0 z-[80]" role="presentation">
          <Button
            type="button"
            variant="overlay"
            className="absolute inset-0 h-auto w-auto rounded-none p-0"
            aria-label={t('branches.closeEditor')}
            onClick={() => setEditing(null)}
          >
            <span className="sr-only">{t('branches.closeEditor')}</span>
          </Button>
          <aside
            className="fixed inset-y-0 right-0 z-[81] flex h-dvh w-full max-w-md flex-col overflow-hidden border-l border-border-subtle bg-card shadow-2xl"
            role="dialog"
            aria-modal="true"
            aria-labelledby="branch-drawer-title"
          >
            <header className="flex shrink-0 items-start justify-between gap-4 border-b border-border-subtle px-4 py-4 sm:px-6 sm:py-5">
              <div className="flex min-w-0 items-center gap-3">
                <div className="grid size-10 shrink-0 place-items-center rounded-md border border-brand/20 bg-brand-subtle text-brand">
                  <Building2 size={19} />
                </div>
                <div className="min-w-0">
                  <h2
                    id="branch-drawer-title"
                    className="m-0 text-base font-bold tracking-tight text-text-main sm:text-lg"
                  >
                    {t('branches.edit')}
                  </h2>
                  <p className="mt-0.5 mb-0 truncate text-xs text-text-muted">
                    {t('branches.updateNamed', { name: editing.name })}
                  </p>
                </div>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="bareIcon"
                className="shrink-0 text-text-muted hover:text-rose-500"
                onClick={() => setEditing(null)}
                aria-label={t('branches.closeEditor')}
              >
                <X size={19} />
              </Button>
            </header>
            <form
              className="flex min-h-0 flex-1 flex-col"
              onSubmit={update}
              autoComplete="off"
            >
              <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-4 py-6 sm:px-6">
                <FormField label={t('branches.name')} required id="edit-branch-name">
                  <Input
                    id="edit-branch-name"
                    required
                    name="name"
                    defaultValue={editing.name}
                  />
                </FormField>
                <FormField
                  label={t('branches.code')}
                  required
                  help={t('branches.codeHelp')}
                  id="edit-branch-code"
                >
                  <Input
                    id="edit-branch-code"
                    required
                    name="code"
                    defaultValue={editing.code}
                    maxLength={24}
                    autoCapitalize="characters"
                    className="uppercase"
                  />
                </FormField>
                <FormField
                  label={t('branches.address')}
                  sublabel={t('common.optional')}
                  id="edit-branch-address"
                >
                  <Textarea
                    id="edit-branch-address"
                    name="address"
                    rows={3}
                    defaultValue={editing.address ?? ''}
                    placeholder={t('branches.addressPlaceholder')}
                  />
                </FormField>
              </div>
              <footer className="flex shrink-0 items-center justify-end gap-2 border-t border-border-subtle px-4 py-4 sm:px-6">
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => setEditing(null)}
                >
                  {t('common.cancel')}
                </Button>
                <Button type="submit" disabled={saving}>
                  <Building2 size={16} />
                  {saving ? t('common.saving') : t('branches.saveChanges')}
                </Button>
              </footer>
            </form>
          </aside>
        </div>
      )}
    </main>
  );
}
