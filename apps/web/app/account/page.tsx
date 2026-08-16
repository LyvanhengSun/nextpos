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
import { useI18n } from '../../lib/i18n';

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
  const { t } = useI18n();
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
        if (!response.ok) throw new Error(t('account.error.signIn'));
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
          error instanceof Error ? error.message : t('account.error.signIn'),
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
      setMessage(t('account.error.passwordMismatch'));
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
        throw new Error(data.message ?? t('account.error.changePassword'));

      form.reset();
      setMessage(t('account.success.passwordChanged'));
      setIsSuccess(true);
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : t('account.error.changePassword'),
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
    ? t('account.profileUnavailable')
    : user.role === 'OWNER'
      ? t('account.ownerAdmin')
      : user.role === 'MANAGER'
        ? t('dashboard.manager')
        : t('account.cashier');
  const currentBranch = branchName
    ? branchName
    : user?.branchId
      ? t('account.branchNamed', { id: user.branchId.slice(0, 8) })
      : t('account.allLocations');

  const profileItems = [
    {
      label: t('auth.email'),
      value: user?.email ?? '—',
      icon: <Mail size={16} />,
    },
    {
      label: t('account.accessLevel'),
      value: roleLabel,
      icon: <UserCheck size={16} />,
    },
    {
      label: t('account.currentBranch'),
      value: currentBranch,
      icon: <Building2 size={16} />,
    },
  ];

  return (
    <main className="app-page">
      <PageHeading
        eyebrow={t('account.eyebrow')}
        title={user ? `${user.firstName} ${user.lastName}` : t('account.myAccount')}
      />

      <div>
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
              <SectionCard bodyClassName="flex flex-col gap-5 sm:gap-6">
                <div className="flex items-center gap-3 sm:gap-4">
                  <div className="relative shrink-0">
                    <div className="grid size-12 place-items-center rounded-full bg-brand text-base font-extrabold text-white shadow-sm sm:size-14 sm:text-lg">
                      {initials}
                    </div>
                    <span
                      className={`absolute right-0 bottom-0 size-4 rounded-full border-[3px] border-card ${
                        user ? 'bg-brand' : 'bg-muted-strong'
                      }`}
                      title={user ? t('account.activeSessionShort') : t('account.sessionUnavailable')}
                    />
                  </div>
                  <div className="min-w-0">
                    <h2 className="m-0 text-base font-bold tracking-tight text-text-main sm:text-lg">
                      {user
                        ? `${user.firstName} ${user.lastName}`
                        : t('account.loadingProfile')}
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
                      className="flex items-start gap-3 py-3 sm:py-4"
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
                  <div className="flex items-start gap-3 py-3 sm:py-4">
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
                        {t('account.status')}
                      </span>
                      <strong
                        className={`mt-0.5 block text-sm ${
                          user ? 'text-brand' : 'text-text-muted'
                        }`}
                      >
                        {user ? t('common.active') : t('account.unavailable')}
                      </strong>
                    </div>
                  </div>
                </div>
              </SectionCard>

              <SectionCard
                title={t('account.activeSession')}
                description={user ? t('account.connected') : t('account.signInAgain')}
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
                      {user ? t('account.activeSessionShort') : t('account.sessionUnavailable')}
                    </strong>
                  </div>
                  <p className="mt-2 mb-0 text-xs leading-relaxed text-text-muted">
                    {user
                      ? t('account.sessionRenews')
                      : t('account.restoreAccess')}
                  </p>
                </div>
              </SectionCard>
            </div>

            <div className="flex flex-col gap-6">
              <SectionCard
                title={t('account.changePassword')}
                description={t('account.passwordHelp')}
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
                    label={t('account.currentPassword')}
                    required
                    id="current-password"
                  >
                    <Input
                      id="current-password"
                      required
                      type="password"
                      name="currentPassword"
                      autoComplete="current-password"
                      placeholder={t('account.currentPassword')}
                    />
                  </FormField>
                  <FormField
                    label={t('account.newPassword')}
                    required
                    help={t('account.passwordHelp')}
                    id="new-password"
                  >
                    <Input
                      id="new-password"
                      required
                      type="password"
                      minLength={12}
                      name="newPassword"
                      autoComplete="new-password"
                      placeholder={t('account.newPassword')}
                    />
                  </FormField>
                  <FormField
                    label={t('account.confirmPassword')}
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
                      placeholder={t('account.confirmPassword')}
                    />
                  </FormField>
                  <div className="flex justify-end border-t border-border-subtle pt-4">
                    <Button type="submit" disabled={isSubmitting}>
                      <Lock size={16} />
                      {isSubmitting ? t('account.updating') : t('account.updatePassword')}
                    </Button>
                  </div>
                </form>
              </SectionCard>

              <SectionCard
                title={t('account.quickPin')}
                description={t('account.quickPinHelp')}
                icon={<KeyRound size={20} />}
              >
                <AlertBanner tone="warning" icon={<ShieldCheck size={18} />}>
                  {t('account.managePins')}
                </AlertBanner>
              </SectionCard>
            </div>
          </div>
        </PageContainer>
      </div>
    </main>
  );
}
