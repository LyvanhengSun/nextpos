'use client';

import { FormEvent, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  CircleAlert,
  CircleCheck,
  KeyRound,
  Lock,
  Search,
  Shield,
  UserPlus,
  Users,
  X,
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
  StatusBadge,
} from '../../components/ui/';
import { useI18n } from '../../lib/i18n';

const api = '/api';

type Branch = { id: string; name: string; code: string };
type Staff = {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: 'OWNER' | 'MANAGER' | 'CASHIER';
  isActive: boolean;
  hasPin: boolean;
  branch: { id: string; name: string } | null;
};

export default function StaffPage() {
  const router = useRouter();
  const { t } = useI18n();
  const [staff, setStaff] = useState<Staff[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [editing, setEditing] = useState<Staff | null>(null);
  const [message, setMessage] = useState('');
  const [isError, setIsError] = useState(false);
  const [isOwner, setIsOwner] = useState<boolean | null>(null);
  const [query, setQuery] = useState('');
  const [saving, setSaving] = useState(false);

  const [addRole, setAddRole] = useState('CASHIER');
  const [addBranchId, setAddBranchId] = useState('');
  const [editRole, setEditRole] = useState('CASHIER');
  const [editBranchId, setEditBranchId] = useState('');
  const [editIsActive, setEditIsActive] = useState('true');

  useEffect(() => {
    if (editing) {
      setEditRole(editing.role);
      setEditBranchId(editing.branch?.id ?? '');
      setEditIsActive(String(editing.isActive));
    }
  }, [editing]);

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

  function notify(text: string, error = false) {
    setIsError(error);
    setMessage(text);
  }

  async function parse(response: Response) {
    try {
      const raw = await response.text();
      return raw ? JSON.parse(raw) : {};
    } catch {
      return {};
    }
  }

  async function checkRoleAndLoad() {
    try {
      const meResponse = await fetch(`${api}/auth/me`, { headers });
      if (!meResponse.ok) {
        router.replace('/login');
        return;
      }
      const me = await meResponse.json().catch(() => ({}));
      if (me.role !== 'OWNER') {
        setIsOwner(false);
        router.replace('/dashboard');
        return;
      }
      setIsOwner(true);

      const [users, branchList] = await Promise.all([
        fetch(`${api}/staff`, { headers }),
        fetch(`${api}/businesses/current/branches`, { headers }),
      ]);
      const data = await parse(users);
      if (!users.ok)
        throw new Error(data.message ?? t('staff.error.ownerOnly'));
      setStaff(data);
      if (branchList.ok) setBranches(await parse(branchList));
    } catch (error) {
      notify(
        error instanceof Error ? error.message : t('staff.error.load'),
        true,
      );
    }
  }

  useEffect(() => {
    void checkRoleAndLoad();
  }, []);

  async function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = Object.fromEntries(new FormData(formElement));
    if (!form.pin) delete form.pin;
    setSaving(true);
    try {
      const response = await fetch(`${api}/staff`, {
        method: 'POST',
        headers,
        body: JSON.stringify(form),
      });
      const data = await parse(response);
      if (!response.ok) throw new Error(data.message ?? t('staff.error.add'));
      formElement.reset();
      setAddRole('CASHIER');
      setAddBranchId('');
      notify(t('staff.success.added'));
      await checkRoleAndLoad();
    } catch (error) {
      notify(
        error instanceof Error ? error.message : t('staff.error.add'),
        true,
      );
    } finally {
      setSaving(false);
    }
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editing) return;
    const form = Object.fromEntries(new FormData(event.currentTarget));
    setSaving(true);
    try {
      const response = await fetch(`${api}/staff/${editing.id}`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify({
          role: form.role,
          branchId: form.branchId,
          isActive: form.isActive === 'true',
        }),
      });
      const data = await parse(response);
      if (!response.ok)
        throw new Error(data.message ?? t('staff.error.update'));
      setEditing(null);
      notify(t('staff.success.updated'));
      await checkRoleAndLoad();
    } catch (error) {
      notify(
        error instanceof Error ? error.message : t('staff.error.update'),
        true,
      );
    } finally {
      setSaving(false);
    }
  }

  async function setPin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editing) return;
    const formElement = event.currentTarget;
    const form = Object.fromEntries(new FormData(formElement));
    try {
      const response = await fetch(`${api}/staff/${editing.id}/pin`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ pin: form.pin }),
      });
      const data = await parse(response);
      if (!response.ok) throw new Error(data.message ?? t('staff.error.pin'));
      formElement.reset();
      notify(data.message ?? t('staff.success.pin'));
      await checkRoleAndLoad();
    } catch (error) {
      notify(
        error instanceof Error ? error.message : t('staff.error.pin'),
        true,
      );
    }
  }

  async function resetPassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editing) return;
    const formElement = event.currentTarget;
    const form = Object.fromEntries(new FormData(formElement));
    try {
      const response = await fetch(
        `${api}/staff/${editing.id}/reset-password`,
        {
          method: 'POST',
          headers,
          body: JSON.stringify({ password: form.password }),
        },
      );
      const data = await parse(response);
      if (!response.ok)
        throw new Error(data.message ?? t('staff.error.password'));
      notify(data.message ?? t('staff.success.password'));
      formElement.reset();
    } catch (error) {
      notify(
        error instanceof Error ? error.message : t('staff.error.password'),
        true,
      );
    }
  }

  const visibleStaff = staff.filter((user) =>
    `${user.firstName} ${user.lastName} ${user.email} ${user.role} ${user.branch?.name ?? ''}`
      .toLowerCase()
      .includes(query.toLowerCase()),
  );

  if (isOwner === null) {
    return (
      <main className="app-page">
        <PageHeading eyebrow={t('staff.eyebrow')} title={t('staff.title')} />
      </main>
    );
  }

  return (
    <main className="app-page">
      <PageHeading eyebrow={t('staff.eyebrow')} title={t('staff.title')} />

      <div>
        <PageContainer>
          {message && (
            <AlertBanner
              tone={isError ? 'error' : 'success'}
              icon={
                isError ? <CircleAlert size={18} /> : <CircleCheck size={18} />
              }
              className="mb-5"
            >
              {message}
            </AlertBanner>
          )}

          <div className="grid grid-cols-1 items-start gap-6 xl:grid-cols-[minmax(20rem,0.8fr)_minmax(0,1.4fr)]">
            <SectionCard
              title={t('staff.addMember')}
              description={t('staff.addHelp')}
              icon={<UserPlus size={20} />}
            >
              <form
                onSubmit={create}
                className="grid grid-cols-1 items-start gap-x-4 gap-y-4 md:grid-cols-2"
                autoComplete="off"
              >
                <FormField label={t('staff.firstName')} required id="staff-first-name">
                  <Input
                    id="staff-first-name"
                    required
                    name="firstName"
                    placeholder={t('staff.firstNamePlaceholder')}
                  />
                </FormField>
                <FormField label={t('staff.lastName')} required id="staff-last-name">
                  <Input
                    id="staff-last-name"
                    required
                    name="lastName"
                    placeholder={t('staff.lastNamePlaceholder')}
                  />
                </FormField>
                <FormField label={t('auth.email')} required id="staff-email">
                  <Input
                    id="staff-email"
                    required
                    type="email"
                    name="email"
                    placeholder={t('staff.emailPlaceholder')}
                  />
                </FormField>
                <FormField
                  label={t('staff.temporaryPassword')}
                  required
                  help={t('staff.passwordHelp')}
                  id="staff-password"
                >
                  <Input
                    id="staff-password"
                    required
                    type="password"
                    name="password"
                    minLength={12}
                    placeholder={t('staff.passwordPlaceholder')}
                  />
                </FormField>
                <FormField label={t('staff.role')} required id="staff-role">
                  <CustomSelect
                    name="role"
                    value={addRole}
                    onChange={setAddRole}
                    options={[
                      { value: 'CASHIER', label: t('staff.cashierPos') },
                      {
                        value: 'MANAGER',
                        label: t('staff.managerAccess'),
                      },
                    ]}
                  />
                </FormField>
                <FormField label={t('staff.assignedBranch')} required id="staff-branch">
                  <CustomSelect
                    name="branchId"
                    value={addBranchId}
                    onChange={setAddBranchId}
                    placeholder={t('staff.selectBranch')}
                    options={[
                      { value: '', label: t('staff.selectBranch') },
                      ...branches.map((branch) => ({
                        value: branch.id,
                        label: `${branch.name} (${branch.code})`,
                      })),
                    ]}
                  />
                </FormField>
                <FormField
                  label={t('staff.terminalPin')}
                  sublabel={t('common.optional')}
                  help={t('staff.pinHelp')}
                  id="staff-pin"
                  className="md:col-span-2"
                >
                  <Input
                    id="staff-pin"
                    name="pin"
                    type="password"
                    inputMode="numeric"
                    pattern="[0-9]{4,8}"
                    maxLength={8}
                    placeholder={t('staff.pinPlaceholder')}
                  />
                </FormField>
                <Button
                  type="submit"
                  disabled={saving}
                  className="md:col-span-2 md:justify-self-start"
                >
                  <UserPlus size={16} />
                  {saving ? t('staff.adding') : t('staff.add')}
                </Button>
              </form>
            </SectionCard>

            <SectionCard
              title={t('staff.teamMembers')}
              description={t('staff.count', { shown: visibleStaff.length, total: staff.length })}
              icon={<Users size={20} />}
              bodyPadding={false}
            >
              <div className="border-b border-border-subtle px-4 py-6 sm:px-8">
                <Input
                  prefixIcon={<Search size={16} />}
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder={t('staff.search')}
                />
              </div>
              {visibleStaff.length ? (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[700px] border-collapse text-left">
                    <thead className="bg-muted-surface text-xs font-bold uppercase tracking-wider text-text-secondary">
                      <tr className="border-b border-border-subtle">
                        <th className="px-4 py-3 sm:pl-8">{t('staff.member')}</th>
                        <th className="px-4 py-3">{t('staff.access')}</th>
                        <th className="px-4 py-3">{t('purchaseOrders.status')}</th>
                        <th className="px-4 py-3 text-right sm:pr-8">
                          {t('purchaseOrders.actions')}
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {visibleStaff.map((user) => (
                        <tr
                          key={user.id}
                          className={`border-b border-border-subtle transition last:border-b-0 hover:bg-muted-surface ${
                            editing?.id === user.id ? 'bg-brand-subtle/50' : ''
                          }`}
                        >
                          <td className="px-4 py-4 sm:pl-8">
                            <strong className="block text-sm text-text-main">
                              {user.firstName} {user.lastName}
                            </strong>
                            <span className="mt-0.5 block text-xs text-text-muted">
                              {user.email}
                            </span>
                          </td>
                          <td className="px-4 py-4">
                            <span className="block text-sm font-semibold capitalize text-text-secondary">
                              {t(`staff.role.${user.role}` as Parameters<typeof t>[0])}
                            </span>
                            <span className="mt-0.5 block text-xs text-text-muted">
                              {user.branch?.name ?? t('staff.allBranches')} ·{' '}
                              {user.hasPin ? t('staff.pinReady') : t('staff.noPin')}
                            </span>
                          </td>
                          <td className="px-4 py-4">
                            <StatusBadge
                              tone={user.isActive ? 'success' : 'neutral'}
                            >
                              {user.isActive ? t('common.active') : t('common.inactive')}
                            </StatusBadge>
                          </td>
                          <td className="px-4 py-4 text-right sm:pr-8">
                            {isOwner && (
                              <Button
                                type="button"
                                onClick={() => setEditing(user)}
                                variant="secondary"
                                size="sm"
                              >
                                <Shield size={15} />
                                {t('staff.manage')}
                              </Button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <EmptyState
                  icon={<Users size={24} />}
                  title={t('staff.empty')}
                  description={
                    query
                      ? t('staff.emptySearchHelp')
                      : t('staff.emptyHelp')
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
            aria-label={t('staff.closePanel')}
            onClick={() => setEditing(null)}
          >
            <span className="sr-only">{t('staff.closePanel')}</span>
          </Button>
          <aside
            className="fixed inset-y-0 right-0 z-[81] flex h-dvh w-full max-w-md flex-col overflow-hidden border-l border-border-subtle bg-card shadow-xl"
            role="dialog"
            aria-modal="true"
            aria-labelledby="staff-drawer-title"
          >
            <header className="flex shrink-0 items-start justify-between gap-4 border-b border-border-subtle px-4 py-4 sm:px-6 sm:py-5">
              <div className="flex min-w-0 items-center gap-3">
                <div className="grid size-10 shrink-0 place-items-center rounded-md border border-brand/20 bg-brand-subtle text-brand">
                  <Shield size={19} />
                </div>
                <div className="min-w-0">
                  <h2
                    id="staff-drawer-title"
                    className="m-0 text-base font-bold tracking-tight text-text-main sm:text-lg"
                  >
                    {t('staff.manageAccess')}
                  </h2>
                  <p className="mt-0.5 mb-0 truncate text-xs text-text-muted">
                    {editing.firstName} {editing.lastName} · {editing.email}
                  </p>
                </div>
              </div>
              <Button
                type="button"
                variant="iconBareDanger"
                size="bareIcon"
                className="shrink-0"
                aria-label={t('staff.closePanel')}
                onClick={() => setEditing(null)}
              >
                <X size={19} />
              </Button>
            </header>

            <div className="flex min-h-0 flex-1 flex-col">
              <div className="flex min-h-0 flex-1 flex-col gap-6 overflow-y-auto px-4 py-6 sm:px-6">
                <form
                  id="staff-access-form"
                  onSubmit={save}
                  className="flex flex-col gap-4"
                >
                  <div>
                    <h3 className="m-0 text-xs font-bold uppercase tracking-wider text-text-secondary">
                      {t('staff.accessSettings')}
                    </h3>
                    <p className="mt-1 mb-0 text-xs text-text-muted">
                      {t('staff.accessSettingsHelp')}
                    </p>
                  </div>
                  <FormField label={t('staff.role')} required>
                    <CustomSelect
                      name="role"
                      value={editRole}
                      onChange={setEditRole}
                      options={[
                        ...(editing.role === 'OWNER'
                          ? [{ value: 'OWNER', label: t('staff.role.OWNER') }]
                          : []),
                        { value: 'CASHIER', label: t('staff.role.CASHIER') },
                        { value: 'MANAGER', label: t('staff.role.MANAGER') },
                      ]}
                    />
                  </FormField>
                  <FormField label={t('entity.branch')} required>
                    <CustomSelect
                      name="branchId"
                      value={editBranchId}
                      onChange={setEditBranchId}
                      options={[
                        { value: '', label: t('staff.noBranch') },
                        ...branches.map((branch) => ({
                          value: branch.id,
                          label: branch.name,
                        })),
                      ]}
                    />
                  </FormField>
                  <FormField label={t('staff.accountStatus')} required>
                    <CustomSelect
                      name="isActive"
                      value={editIsActive}
                      onChange={setEditIsActive}
                      options={[
                        { value: 'true', label: t('common.active') },
                        { value: 'false', label: t('common.inactive') },
                      ]}
                    />
                  </FormField>
                </form>

                <div className="border-t border-border-subtle pt-6">
                  <div className="mb-4">
                    <h3 className="m-0 text-xs font-bold uppercase tracking-wider text-text-secondary">
                      {t('staff.security')}
                    </h3>
                    <p className="mt-1 mb-0 text-xs text-text-muted">
                      {t('staff.securityHelp')}
                    </p>
                  </div>
                  <div className="flex flex-col gap-4">
                    <form onSubmit={setPin} className="flex flex-col gap-2">
                      <FormField
                        label={t('staff.terminalPin')}
                        help={t('staff.newPinHelp')}
                        id="edit-staff-pin"
                      >
                        <div className="flex flex-col gap-2 sm:flex-row">
                          <Input
                            id="edit-staff-pin"
                            required
                            name="pin"
                            type="password"
                            inputMode="numeric"
                            pattern="[0-9]{4,8}"
                            minLength={4}
                            maxLength={8}
                            placeholder={t('staff.pinPlaceholder')}
                          />
                          <Button
                            type="submit"
                            variant="secondary"
                            className="shrink-0"
                          >
                            <KeyRound size={16} />
                            {t('staff.savePin')}
                          </Button>
                        </div>
                      </FormField>
                    </form>
                    <form
                      onSubmit={resetPassword}
                      className="flex flex-col gap-2"
                    >
                      <FormField
                        label={t('staff.newPassword')}
                        help={t('staff.passwordHelp')}
                        id="edit-staff-password"
                      >
                        <div className="flex flex-col gap-2 sm:flex-row">
                          <Input
                            id="edit-staff-password"
                            required
                            name="password"
                            type="password"
                            minLength={12}
                            placeholder={t('staff.passwordPlaceholder')}
                          />
                          <Button
                            type="submit"
                            variant="secondary"
                            className="shrink-0"
                          >
                            <Lock size={16} />
                            {t('staff.reset')}
                          </Button>
                        </div>
                      </FormField>
                    </form>
                  </div>
                </div>
              </div>

              <footer className="flex shrink-0 flex-wrap items-center justify-end gap-2 border-t border-border-subtle px-4 py-3 sm:px-6 sm:py-4">
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => setEditing(null)}
                  className="max-sm:flex-1"
                >
                  {t('common.cancel')}
                </Button>
                <Button
                  type="submit"
                  form="staff-access-form"
                  disabled={saving}
                  className="max-sm:flex-1"
                >
                  <Shield size={16} />
                  {saving ? t('common.saving') : t('staff.saveAccess')}
                </Button>
              </footer>
            </div>
          </aside>
        </div>
      )}
    </main>
  );
}
