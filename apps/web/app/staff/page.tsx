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
        throw new Error(data.message ?? 'Only the owner can manage staff.');
      setStaff(data);
      if (branchList.ok) setBranches(await parse(branchList));
    } catch (error) {
      notify(
        error instanceof Error ? error.message : 'Unable to load staff list.',
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
      if (!response.ok) throw new Error(data.message ?? 'Unable to add staff.');
      formElement.reset();
      setAddRole('CASHIER');
      setAddBranchId('');
      notify('Staff member added. Share the password privately.');
      await checkRoleAndLoad();
    } catch (error) {
      notify(
        error instanceof Error ? error.message : 'Unable to add staff.',
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
        throw new Error(data.message ?? 'Unable to update staff.');
      setEditing(null);
      notify('Staff access updated.');
      await checkRoleAndLoad();
    } catch (error) {
      notify(
        error instanceof Error ? error.message : 'Unable to update staff.',
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
      if (!response.ok) throw new Error(data.message ?? 'Unable to save PIN.');
      formElement.reset();
      notify(data.message);
      await checkRoleAndLoad();
    } catch (error) {
      notify(
        error instanceof Error ? error.message : 'Unable to save PIN.',
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
        throw new Error(data.message ?? 'Unable to reset password.');
      notify(data.message);
      formElement.reset();
    } catch (error) {
      notify(
        error instanceof Error ? error.message : 'Unable to reset password.',
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
        <PageHeading eyebrow="Owner control" title="Staff" />
      </main>
    );
  }

  return (
    <main className="app-page">
      <PageHeading eyebrow="Owner control" title="Staff" />

      <div className="py-6">
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
              title="Add staff member"
              description="Create staff access."
              icon={<UserPlus size={20} />}
            >
              <form
                onSubmit={create}
                className="grid grid-cols-1 items-start gap-x-4 gap-y-4 md:grid-cols-2"
                autoComplete="off"
              >
                <FormField label="First name" required id="staff-first-name">
                  <Input
                    id="staff-first-name"
                    required
                    name="firstName"
                    placeholder="e.g. Sokha"
                  />
                </FormField>
                <FormField label="Last name" required id="staff-last-name">
                  <Input
                    id="staff-last-name"
                    required
                    name="lastName"
                    placeholder="e.g. Heng"
                  />
                </FormField>
                <FormField label="Email" required id="staff-email">
                  <Input
                    id="staff-email"
                    required
                    type="email"
                    name="email"
                    placeholder="staff@store.com"
                  />
                </FormField>
                <FormField
                  label="Temporary password"
                  required
                  help="Use at least 12 characters."
                  id="staff-password"
                >
                  <Input
                    id="staff-password"
                    required
                    type="password"
                    name="password"
                    minLength={12}
                    placeholder="12+ characters"
                  />
                </FormField>
                <FormField label="Role" required id="staff-role">
                  <CustomSelect
                    name="role"
                    value={addRole}
                    onChange={setAddRole}
                    options={[
                      { value: 'CASHIER', label: 'Cashier — POS' },
                      {
                        value: 'MANAGER',
                        label: 'Manager — store access',
                      },
                    ]}
                  />
                </FormField>
                <FormField label="Assigned branch" required id="staff-branch">
                  <CustomSelect
                    name="branchId"
                    value={addBranchId}
                    onChange={setAddBranchId}
                    placeholder="Select branch"
                    options={[
                      { value: '', label: 'Select branch' },
                      ...branches.map((branch) => ({
                        value: branch.id,
                        label: `${branch.name} (${branch.code})`,
                      })),
                    ]}
                  />
                </FormField>
                <FormField
                  label="Terminal PIN"
                  sublabel="(optional)"
                  help="4–8 digits for terminal access."
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
                    placeholder="4–8 digits"
                  />
                </FormField>
                <Button
                  type="submit"
                  disabled={saving}
                  className="md:col-span-2 md:justify-self-start"
                >
                  <UserPlus size={16} />
                  {saving ? 'Adding…' : 'Add staff'}
                </Button>
              </form>
            </SectionCard>

            <SectionCard
              title="Team members"
              description={`${visibleStaff.length} of ${staff.length} shown`}
              icon={<Users size={20} />}
              bodyPadding={false}
            >
              <div className="border-b border-border-subtle px-4 py-6 sm:px-8">
                <Input
                  prefixIcon={<Search size={16} />}
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Search staff"
                />
              </div>
              {visibleStaff.length ? (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[700px] border-collapse text-left">
                    <thead className="bg-muted-surface text-xs font-bold uppercase tracking-wider text-text-secondary">
                      <tr className="border-b border-border-subtle">
                        <th className="px-4 py-3 sm:pl-8">Staff member</th>
                        <th className="px-4 py-3">Access</th>
                        <th className="px-4 py-3">Status</th>
                        <th className="px-4 py-3 text-right sm:pr-8">
                          Actions
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
                              {user.role.toLowerCase()}
                            </span>
                            <span className="mt-0.5 block text-xs text-text-muted">
                              {user.branch?.name ?? 'All branches'} ·{' '}
                              {user.hasPin ? 'PIN ready' : 'No PIN'}
                            </span>
                          </td>
                          <td className="px-4 py-4">
                            <StatusBadge
                              tone={user.isActive ? 'success' : 'neutral'}
                            >
                              {user.isActive ? 'Active' : 'Inactive'}
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
                                Manage
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
                  title="No staff found"
                  description={
                    query
                      ? 'Try another search.'
                      : 'Add your first staff member.'
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
            aria-label="Close staff access panel"
            onClick={() => setEditing(null)}
          >
            <span className="sr-only">Close staff access panel</span>
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
                    Manage access
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
                aria-label="Close staff access panel"
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
                      Access settings
                    </h3>
                    <p className="mt-1 mb-0 text-xs text-text-muted">
                      Set role and status.
                    </p>
                  </div>
                  <FormField label="Role" required>
                    <CustomSelect
                      name="role"
                      value={editRole}
                      onChange={setEditRole}
                      options={[
                        ...(editing.role === 'OWNER'
                          ? [{ value: 'OWNER', label: 'Owner' }]
                          : []),
                        { value: 'CASHIER', label: 'Cashier' },
                        { value: 'MANAGER', label: 'Manager' },
                      ]}
                    />
                  </FormField>
                  <FormField label="Branch" required>
                    <CustomSelect
                      name="branchId"
                      value={editBranchId}
                      onChange={setEditBranchId}
                      options={[
                        { value: '', label: 'No branch assigned' },
                        ...branches.map((branch) => ({
                          value: branch.id,
                          label: branch.name,
                        })),
                      ]}
                    />
                  </FormField>
                  <FormField label="Account status" required>
                    <CustomSelect
                      name="isActive"
                      value={editIsActive}
                      onChange={setEditIsActive}
                      options={[
                        { value: 'true', label: 'Active' },
                        { value: 'false', label: 'Inactive' },
                      ]}
                    />
                  </FormField>
                </form>

                <div className="border-t border-border-subtle pt-6">
                  <div className="mb-4">
                    <h3 className="m-0 text-xs font-bold uppercase tracking-wider text-text-secondary">
                      Security
                    </h3>
                    <p className="mt-1 mb-0 text-xs text-text-muted">
                      Update PIN and password.
                    </p>
                  </div>
                  <div className="flex flex-col gap-4">
                    <form onSubmit={setPin} className="flex flex-col gap-2">
                      <FormField
                        label="Terminal PIN"
                        help="New 4–8 digit PIN."
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
                            placeholder="4–8 digit PIN"
                          />
                          <Button
                            type="submit"
                            variant="secondary"
                            className="shrink-0"
                          >
                            <KeyRound size={16} />
                            Save PIN
                          </Button>
                        </div>
                      </FormField>
                    </form>
                    <form
                      onSubmit={resetPassword}
                      className="flex flex-col gap-2"
                    >
                      <FormField
                        label="New password"
                        help="Use at least 12 characters."
                        id="edit-staff-password"
                      >
                        <div className="flex flex-col gap-2 sm:flex-row">
                          <Input
                            id="edit-staff-password"
                            required
                            name="password"
                            type="password"
                            minLength={12}
                            placeholder="12+ characters"
                          />
                          <Button
                            type="submit"
                            variant="secondary"
                            className="shrink-0"
                          >
                            <Lock size={16} />
                            Reset
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
                  Cancel
                </Button>
                <Button
                  type="submit"
                  form="staff-access-form"
                  disabled={saving}
                  className="max-sm:flex-1"
                >
                  <Shield size={16} />
                  {saving ? 'Saving…' : 'Save access'}
                </Button>
              </footer>
            </div>
          </aside>
        </div>
      )}
    </main>
  );
}
