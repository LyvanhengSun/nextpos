'use client';

import { FormEvent, useEffect, useState } from 'react';
import Link from 'next/link';
import {
  ArrowRight,
  BarChart3,
  CheckCircle2,
  Mail,
  ShieldCheck,
  ShoppingBag,
  Store,
  Wifi,
} from 'lucide-react';
import {
  AlertBanner,
  Button,
  FormField,
  Input,
  LanguageSwitcher,
  PasswordInput,
  SectionCard,
  Switch,
} from '@/components/ui';
import { type TranslationKey, useI18n } from '@/lib/i18n';

const features = [
  { Icon: ShoppingBag, labelKey: 'auth.fastCheckout' },
  { Icon: Wifi, labelKey: 'auth.reliableOperations' },
  { Icon: BarChart3, labelKey: 'auth.clearReports' },
  { Icon: ShieldCheck, labelKey: 'auth.roleAccess' },
] satisfies { Icon: typeof ShoppingBag; labelKey: TranslationKey }[];

type MessageState = {
  tone: 'success' | 'error';
  text: string;
};

export function CredentialsForm({
  titleKey,
  endpoint,
  successKey,
}: {
  titleKey: TranslationKey;
  endpoint: 'activate-owner' | 'login';
  successKey: TranslationKey;
}) {
  const { t } = useI18n();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [message, setMessage] = useState<MessageState>();
  const [loading, setLoading] = useState(false);
  const isLogin = endpoint === 'login';

  useEffect(() => {
    if (!message) return;
    const timer = setTimeout(() => setMessage(undefined), 5000);
    return () => clearTimeout(timer);
  }, [message]);

  useEffect(() => {
    if (!isLogin) return;
    const saved = localStorage.getItem('pos_remembered_email');
    if (saved) {
      setEmail(saved);
      setRememberMe(true);
    }
  }, [isLogin]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage(undefined);
    setLoading(true);

    try {
      const response = await fetch(`/api/auth/${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const data = (await response.json()) as {
        accessToken?: string;
        message?: string;
      };
      if (!response.ok) throw new Error(data.message ?? t('auth.requestFailed'));

      if (data.accessToken) {
        sessionStorage.removeItem('pos_access_token');
        localStorage.removeItem('pos_access_token');

        if (rememberMe) {
          localStorage.setItem('pos_access_token', data.accessToken);
          localStorage.setItem('pos_remembered_email', email);
        } else {
          localStorage.removeItem('pos_access_token');
          localStorage.removeItem('pos_remembered_email');
          sessionStorage.setItem('pos_access_token', data.accessToken);
        }

        window.location.assign('/dashboard');
        return;
      }

      setMessage({ tone: 'success', text: t(successKey) });
      setPassword('');
    } catch (error) {
      setMessage({
        tone: 'error',
        text: error instanceof Error ? error.message : t('auth.requestFailed'),
      });
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-dvh bg-app lg:grid lg:grid-cols-[minmax(18rem,0.72fr)_minmax(0,1.28fr)]">
      <div className="fixed top-4 right-4 z-20">
        <LanguageSwitcher />
      </div>
      <aside className="relative hidden min-h-dvh overflow-hidden bg-text-main px-10 py-12 text-white lg:flex lg:flex-col lg:justify-between">
        <div className="pointer-events-none absolute -top-24 -right-24 h-72 w-72 rounded-full bg-brand/20 blur-3xl" />

        <div className="relative">
          <div className="flex items-center gap-3">
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-brand text-white shadow-sm">
              <Store size={25} strokeWidth={2.25} />
            </span>
            <div>
              <p className="m-0 text-xs font-bold tracking-widest text-brand-border uppercase">
                {t('auth.pointOfSale')}
              </p>
              <p className="mt-0.5 mb-0 text-lg font-bold">KN POS</p>
            </div>
          </div>

          <div className="mt-20 max-w-md">
            <p className="m-0 text-xs font-bold tracking-widest text-brand-border uppercase">
              {t('auth.secureWorkspace')}
            </p>
            <h1 className="mt-3 mb-0 text-3xl font-bold leading-tight tracking-tight">
              {t('auth.runStore')}
            </h1>
            <p className="mt-4 mb-0 text-sm leading-6 text-muted-strong">
              {t('auth.runStoreDescription')}
            </p>
          </div>

          <ul className="mt-12 grid list-none gap-4 p-0">
            {features.map(({ Icon, labelKey }) => (
              <li
                key={labelKey}
                className="flex items-center gap-3 text-sm font-medium text-muted-surface"
              >
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-brand/15 text-brand-border">
                  <Icon size={15} />
                </span>
                {t(labelKey)}
              </li>
            ))}
          </ul>
        </div>

        <p className="relative m-0 text-xs text-border-default">
          KN POS · {t('auth.secureAccess')}
        </p>
      </aside>

      <section className="flex min-h-dvh items-center px-4 py-6 sm:px-8 lg:px-12 lg:py-12">
        <div className="mx-auto w-full max-w-md">
          <div className="mb-5 flex items-center gap-3 lg:hidden">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-brand text-white shadow-sm">
              <Store size={21} />
            </span>
            <div>
              <p className="m-0 text-xs font-bold tracking-widest text-brand uppercase">
                {t('auth.pointOfSale')}
              </p>
              <p className="mt-0.5 mb-0 text-base font-bold text-text-main">
                KN POS
              </p>
            </div>
          </div>

          <SectionCard
            title={isLogin ? t('auth.signIn') : t(titleKey)}
            description={isLogin ? t('auth.accessRegister') : t('auth.createOwnerAccess')}
            icon={<ShieldCheck size={20} />}
          >
            <form className="grid gap-4" onSubmit={submit}>
              {message && (
                <AlertBanner
                  tone={message.tone}
                  icon={
                    message.tone === 'success' ? (
                      <CheckCircle2 size={18} />
                    ) : undefined
                  }
                >
                  {message.text}
                </AlertBanner>
              )}

              {!isLogin && (
                <AlertBanner tone="info" icon={<ShieldCheck size={18} />}>
                  {t('auth.ownerEmailHelp')}
                </AlertBanner>
              )}

              <FormField id="auth-email" label={t('auth.email')} required>
                <Input
                  id="auth-email"
                  required
                  type="email"
                  value={email}
                  placeholder={t('auth.emailPlaceholder')}
                  autoComplete="email"
                  prefixIcon={<Mail size={16} />}
                  onChange={(event) => setEmail(event.target.value)}
                />
              </FormField>

              <FormField
                id="auth-password"
                label={t('auth.password')}
                required
                help={!isLogin ? t('auth.passwordLength') : undefined}
              >
                <PasswordInput
                  id="auth-password"
                  required
                  minLength={12}
                  value={password}
                  placeholder={
                    isLogin ? t('auth.password') : t('auth.passwordLength')
                  }
                  autoComplete={isLogin ? 'current-password' : 'new-password'}
                  onChange={(event) => setPassword(event.target.value)}
                />
              </FormField>

              {isLogin && (
                <div className="flex items-center justify-between gap-4 rounded-md border border-border-subtle bg-muted-surface px-3 py-2.5">
                  <div>
                    <p className="m-0 text-sm font-bold text-text-main">
                      {t('auth.rememberDevice')}
                    </p>
                    <p className="mt-0.5 mb-0 text-xs text-text-muted">
                      {t('auth.staySignedIn')}
                    </p>
                  </div>
                  <Switch
                    checked={rememberMe}
                    onCheckedChange={setRememberMe}
                    label={t('auth.rememberDevice')}
                  />
                </div>
              )}

              <Button
                type="submit"
                size="lg"
                disabled={loading}
                className="mt-1 w-full"
              >
                {loading
                  ? t('auth.processing')
                  : isLogin
                    ? t('auth.signIn')
                    : t('auth.savePassword')}
                {!loading && <ArrowRight size={17} />}
              </Button>

              <p className="m-0 text-center text-sm text-text-muted">
                {isLogin
                  ? t('auth.firstSetup')
                  : t('auth.alreadyActivated')}{' '}
                <Link
                  className="font-bold text-brand hover:text-brand-hover"
                  href={isLogin ? '/setup' : '/login'}
                >
                  {isLogin ? t('auth.createBusiness') : t('auth.signIn')}
                </Link>
              </p>
            </form>
          </SectionCard>

          <p className="mt-5 mb-0 text-center text-xs text-text-muted">
            {t('auth.protectedAccess')}
          </p>
        </div>
      </section>
    </main>
  );
}
