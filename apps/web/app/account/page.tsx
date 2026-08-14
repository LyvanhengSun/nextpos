'use client';

import { FormEvent, useEffect, useState } from 'react';
import {
  BadgeCheck,
  Building2,
  CheckCircle2,
  KeyRound,
  Laptop,
  Lock,
  Mail,
  ShieldCheck,
  UserCheck,
} from 'lucide-react';

import { PageContainer } from '../../components/layout/page-container';
import {
  AlertBanner,
  Button,
  FormField,
  Input,
  PageHeading,
  SectionCard,
  StatusBadge,
} from '../../components/ui/';

const api = '/api';

type AccountUser = {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  role: string;
  businessId?: string;
  branchId?: string | null;
};

export default function AccountPage() {
  const [user, setUser] = useState<AccountUser | null>(null);
  const [branchName, setBranchName] = useState('');
  const [message, setMessage] = useState('');
  const [isSuccess, setIsSuccess] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

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

  useEffect(() => {
    async function loadData() {
      try {
        const response = await fetch(`${api}/auth/me`, { headers });
        if (!response.ok) throw new Error('Please sign in again.');
        const data = await response.json();
        setUser(data);

        if (data.branchId) {
          const branchesResponse = await fetch(
            `${api}/businesses/current/branches`,
            { headers },
          ).catch(() => null);
          if (branchesResponse?.ok) {
            const branches = await branchesResponse.json().catch(() => []);
            const found = branches.find(
              (branch: { id: string; name: string; code?: string }) =>
                branch.id === data.branchId,
            );
            if (found) {
              const hasCodeInName =
                found.code &&
                found.name
                  .toLowerCase()
                  .includes(`(${found.code.toLowerCase()})`);
              setBranchName(
                found.code && !hasCodeInName
                  ? `${found.name} (${found.code})`
                  : found.name,
              );
            }
          }
        }
      } catch (error) {
        setMessage(
          error instanceof Error ? error.message : 'Please sign in again.',
        );
        setIsSuccess(false);
      }
    }
    void loadData();
  }, []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage('');
    setIsSuccess(false);

    const form = event.currentTarget;
    const values = Object.fromEntries(new FormData(form)) as Record<
      string,
      string
    >;

    if (values.newPassword !== values.confirmPassword) {
      setMessage('New passwords do not match.');
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await fetch(`${api}/auth/change-password`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          currentPassword: values.currentPassword,
          newPassword: values.newPassword,
        }),
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok)
        throw new Error(data.message ?? 'Unable to change password.');

      form.reset();
      setMessage('Password changed successfully.');
      setIsSuccess(true);
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : 'Unable to change password.',
      );
      setIsSuccess(false);
    } finally {
      setIsSubmitting(false);
    }
  }

  const initials = user
    ? `${user.firstName.charAt(0)}${user.lastName.charAt(0)}`.toUpperCase()
    : 'U';
  const roleLabel = !user
    ? 'Profile unavailable'
    : user.role === 'OWNER'
      ? 'Owner & Admin'
      : user.role === 'MANAGER'
        ? 'Manager'
        : 'Cashier';
  const currentBranch = branchName
    ? branchName
    : user?.branchId
      ? `Branch (${user.branchId.slice(0, 8)})`
      : 'All locations';

  const profileItems = [
    {
      label: 'Email address',
      value: user?.email ?? '—',
      icon: <Mail size={16} />,
    },
    {
      label: 'Access level',
      value: roleLabel,
      icon: <UserCheck size={16} />,
    },
    {
      label: 'Current branch',
      value: currentBranch,
      icon: <Building2 size={16} />,
    },
  ];

  return (
    <main className="app-page">
      <PageHeading
        eyebrow="Account profile"
        title={user ? `${user.firstName} ${user.lastName}` : 'My account'}
      />

      <div className="py-6">
        <PageContainer>
          {message && (
            <AlertBanner
              tone={isSuccess ? 'success' : 'error'}
              icon={
                isSuccess ? (
                  <CheckCircle2 size={18} />
                ) : (
                  <ShieldCheck size={18} />
                )
              }
              className="mb-5"
            >
              {message}
            </AlertBanner>
          )}

          <div className="grid grid-cols-1 items-start gap-6 xl:grid-cols-[minmax(19rem,0.78fr)_minmax(0,1.22fr)]">
            <div className="flex flex-col gap-6">
              <SectionCard bodyClassName="flex flex-col gap-6">
                <div className="flex flex-col items-start gap-4 sm:flex-row sm:items-center">
                  <div className="relative shrink-0">
                    <div className="grid size-12 place-items-center rounded-full bg-brand text-base font-extrabold text-white shadow-sm sm:size-14 sm:text-lg">
                      {initials}
                    </div>
                    <span
                      className={`absolute right-0 bottom-0 size-4 rounded-full border-[3px] border-card ${
                        user ? 'bg-brand' : 'bg-muted-strong'
                      }`}
                      title={user ? 'Active session' : 'Session unavailable'}
                    />
                  </div>
                  <div className="min-w-0">
                    <h2 className="m-0 text-base font-bold tracking-tight text-text-main sm:text-lg">
                      {user
                        ? `${user.firstName} ${user.lastName}`
                        : 'Loading profile…'}
                    </h2>
                    <p className="mt-0.5 mb-0 break-all text-sm text-text-muted">
                      {user?.email ?? '—'}
                    </p>
                    <StatusBadge tone="info" className="mt-2 gap-1.5">
                      <BadgeCheck size={14} />
                      {roleLabel}
                    </StatusBadge>
                  </div>
                </div>

                <div className="divide-y divide-border-subtle border-y border-border-subtle">
                  {profileItems.map((item) => (
                    <div
                      key={item.label}
                      className="flex items-start gap-3 py-4"
                    >
                      <div className="grid size-9 shrink-0 place-items-center rounded-md bg-muted-surface text-text-muted">
                        {item.icon}
                      </div>
                      <div className="min-w-0">
                        <span className="block text-xs font-medium text-text-muted">
                          {item.label}
                        </span>
                        <strong className="mt-0.5 block break-words text-sm text-text-main">
                          {item.value}
                        </strong>
                      </div>
                    </div>
                  ))}
                  <div className="flex items-start gap-3 py-4">
                    <div
                      className={`grid size-9 shrink-0 place-items-center rounded-md ${
                        user
                          ? 'bg-brand-subtle text-brand'
                          : 'bg-muted-surface text-text-muted'
                      }`}
                    >
                      <CheckCircle2 size={16} />
                    </div>
                    <div>
                      <span className="block text-xs font-medium text-text-muted">
                        Account status
                      </span>
                      <strong
                        className={`mt-0.5 block text-sm ${
                          user ? 'text-brand' : 'text-text-muted'
                        }`}
                      >
                        {user ? 'Active' : 'Unavailable'}
                      </strong>
                    </div>
                  </div>
                </div>
              </SectionCard>

              <SectionCard
                title="Active web session"
                description={user ? 'Connected to POS.' : 'Sign in again.'}
                icon={<Laptop size={20} />}
              >
                <div className="rounded-lg border border-border-subtle bg-muted-surface p-5">
                  <div className="flex items-center gap-2">
                    <span
                      className={`size-2.5 rounded-full ring-4 ${
                        user
                          ? 'bg-brand ring-brand-subtle'
                          : 'bg-muted-strong ring-muted-surface'
                      }`}
                    />
                    <strong className="text-sm text-text-main">
                      {user ? 'Active session' : 'Session unavailable'}
                    </strong>
                  </div>
                  <p className="mt-2 mb-0 text-xs leading-relaxed text-text-muted">
                    {user
                      ? 'Session renews while you work.'
                      : 'Sign in to restore access.'}
                  </p>
                </div>
              </SectionCard>
            </div>

            <div className="flex flex-col gap-6">
              <SectionCard
                title="Change password"
                description="Use 12+ characters."
                icon={<Lock size={20} />}
              >
                <form
                  onSubmit={submit}
                  autoComplete="off"
                  data-1p-ignore="true"
                  data-lpignore="true"
                  className="flex flex-col gap-4"
                >
                  <FormField
                    label="Current password"
                    required
                    id="current-password"
                  >
                    <Input
                      id="current-password"
                      required
                      type="password"
                      name="currentPassword"
                      autoComplete="current-password"
                      placeholder="Current password"
                    />
                  </FormField>
                  <FormField
                    label="New password"
                    required
                    help="12+ characters."
                    id="new-password"
                  >
                    <Input
                      id="new-password"
                      required
                      type="password"
                      minLength={12}
                      name="newPassword"
                      autoComplete="new-password"
                      placeholder="New password"
                    />
                  </FormField>
                  <FormField
                    label="Confirm new password"
                    required
                    id="confirm-password"
                  >
                    <Input
                      id="confirm-password"
                      required
                      type="password"
                      minLength={12}
                      name="confirmPassword"
                      autoComplete="new-password"
                      placeholder="Confirm password"
                    />
                  </FormField>
                  <div className="flex justify-end border-t border-border-subtle pt-4">
                    <Button type="submit" disabled={isSubmitting}>
                      <Lock size={16} />
                      {isSubmitting ? 'Updating…' : 'Update password'}
                    </Button>
                  </div>
                </form>
              </SectionCard>

              <SectionCard
                title="Terminal quick PIN"
                description="For cashier switch and approvals."
                icon={<KeyRound size={20} />}
              >
                <AlertBanner tone="warning" icon={<ShieldCheck size={18} />}>
                  Manage PINs in Staff & Access Control.
                </AlertBanner>
              </SectionCard>
            </div>
          </div>
        </PageContainer>
      </div>
    </main>
  );
}
