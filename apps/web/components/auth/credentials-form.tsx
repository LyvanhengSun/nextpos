'use client';

import { FormEvent, useEffect, useState } from 'react';
import Link from 'next/link';
import {
  ArrowRight,
  CheckCircle2,
  Mail,
  ShieldCheck,
  Store,
} from 'lucide-react';
import {
  AlertBanner,
  Button,
  FormField,
  Input,
  LanguageSwitcher,
  PasswordInput,
  Switch,
} from '@/components/ui';
import { type TranslationKey, useI18n } from '@/lib/i18n';

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
    <main className="min-h-dvh bg-[#f7f8fa] lg:grid lg:grid-cols-[minmax(23rem,38%)_1fr]">
      <aside className="relative hidden min-h-dvh overflow-hidden bg-slate-950 text-white lg:flex lg:flex-col lg:justify-between">
        <div className="absolute inset-0 bg-[url('/images/login-hero.png')] bg-cover bg-center" />
        <div className="absolute inset-0 bg-gradient-to-b from-slate-950/45 via-slate-950/15 to-slate-950/90" />

        <div className="relative flex items-center gap-3 p-8 xl:p-10">
          <span className="grid size-12 place-items-center rounded-xl bg-brand text-white shadow-lg shadow-black/20">
            <Store size={25} strokeWidth={2.3} />
          </span>
          <div>
            <p className="m-0 text-lg font-extrabold tracking-tight">KN POS</p>
            <p className="m-0 text-xs font-semibold text-white/70">{t('auth.pointOfSale')}</p>
          </div>
        </div>

        <div className="relative w-full p-8 pb-12 xl:p-10 xl:pb-14">
          <p className="mb-3 text-xs font-bold text-emerald-300 uppercase">
            {t('auth.secureWorkspace')}
          </p>
          <h1 className="m-0 text-3xl font-extrabold leading-tight tracking-tight xl:text-3xl">
            {t('auth.runStore')}
          </h1>
          <p className="mt-4 mb-0 max-w-lg text-sm leading-6 text-white/75">
            {t('auth.runStoreDescription')}
          </p>
        </div>
      </aside>

      <section className="flex min-h-dvh flex-col">
        <header className="flex h-16 shrink-0 items-center justify-between px-4 sm:h-20 sm:px-8 lg:justify-end lg:px-10">
          <div className="flex items-center gap-2.5 lg:hidden">
            <span className="grid size-9 place-items-center rounded-lg bg-brand text-white shadow-sm sm:size-10">
              <Store size={20} />
            </span>
            <span className="font-extrabold text-text-main">KN POS</span>
          </div>
          <LanguageSwitcher />
        </header>

        <div className="flex min-h-0 flex-1 items-center justify-center px-5 py-4 sm:px-8 sm:py-8 lg:px-12">
          <div className="w-full max-w-[34rem] rounded-xl border border-slate-200 bg-white p-6 shadow-[0_20px_60px_-35px_rgba(15,23,42,0.28)] sm:rounded-2xl sm:p-10 lg:p-12">
            <div className="mb-6 sm:mb-8">
              <span className="mb-3 grid size-9 place-items-center rounded-lg bg-emerald-50 text-brand sm:mb-5 sm:size-11 sm:rounded-xl">
                <ShieldCheck size={20} />
              </span>
              <h2 className="m-0 text-xl font-extrabold tracking-tight text-text-main sm:text-3xl">
                {isLogin ? t('auth.signIn') : t(titleKey)}
              </h2>
              <p className="mt-2 mb-0 text-sm leading-6 text-text-muted">
                {isLogin ? t('auth.accessRegister') : t('auth.createOwnerAccess')}
              </p>
            </div>

            <form className="grid gap-5" onSubmit={submit}>
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
                  className="pl-10"
                  wrapperClassName="h-11 rounded-lg sm:h-12"
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
                  className="pl-10"
                  wrapperClassName="[&>button]:h-11 [&>div]:h-11 [&>div]:rounded-lg sm:[&>button]:h-12 sm:[&>div]:h-12"
                  onChange={(event) => setPassword(event.target.value)}
                />
              </FormField>

              {isLogin && (
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="m-0 text-sm font-semibold text-text-main">
                      {t('auth.rememberDevice')}
                    </p>
                    <p className="mt-0.5 mb-0 hidden text-xs text-text-muted sm:block">
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
                className="mt-1 h-11 w-full rounded-lg text-sm font-bold shadow-sm sm:h-12"
              >
                {loading
                  ? t('auth.processing')
                  : isLogin
                    ? t('auth.signIn')
                    : t('auth.savePassword')}
                {!loading && <ArrowRight size={17} />}
              </Button>

              <div className="my-1 hidden items-center gap-3 sm:flex" aria-hidden="true">
                <span className="h-px flex-1 bg-slate-200" />
                <span className="text-[11px] font-semibold tracking-wider text-slate-400 uppercase">KN POS</span>
                <span className="h-px flex-1 bg-slate-200" />
              </div>

              <p className="m-0 flex flex-col items-center text-center text-sm text-text-muted sm:block">
                <span>
                  {isLogin
                    ? t('auth.firstSetup')
                    : t('auth.alreadyActivated')}
                </span>{' '}
                <Link
                  className="whitespace-nowrap font-bold text-brand hover:text-brand-hover"
                  href={isLogin ? '/setup' : '/login'}
                >
                  {isLogin ? t('auth.createBusiness') : t('auth.signIn')}
                </Link>
              </p>
            </form>
          </div>
        </div>

        <footer className="hidden min-h-16 shrink-0 items-center justify-center border-t border-slate-200 px-6 py-4 text-center text-xs text-text-muted sm:flex sm:justify-between">
          <span>© {new Date().getFullYear()} KN POS</span>
          <span className="hidden sm:inline">{t('auth.protectedAccess')}</span>
        </footer>
      </section>
    </main>
  );
}
