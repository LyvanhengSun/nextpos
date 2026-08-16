'use client';

import { FormEvent, useEffect, useState } from 'react';
import Link from 'next/link';
import {
  ArrowRight,
  Building2,
  CheckCircle2,
  CircleUserRound,
  Coins,
  Mail,
  ShieldCheck,
  Store,
} from 'lucide-react';
import {
  AlertBanner,
  Button,
  CustomSelect,
  FormField,
  Input,
  LanguageSwitcher,
  PasswordInput,
  SectionCard,
} from '@/components/ui';
import { useI18n } from '@/lib/i18n';

const initialValues = {
  name: '',
  currency: 'USD',
  ownerName: '',
  ownerEmail: '',
  password: '',
  confirmPassword: '',
};

type MessageState = {
  tone: 'success' | 'error';
  text: string;
};

function createBusinessCode(name: string) {
  const prefix = name
    .normalize('NFKD')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 12)
    .toUpperCase() || 'BUSINESS';
  return `${prefix}-${Date.now().toString(36).slice(-5).toUpperCase()}`;
}

export default function SetupPage() {
  const { t } = useI18n();
  const [values, setValues] = useState(initialValues);
  const [message, setMessage] = useState<MessageState>();
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!message) return;
    const timer = setTimeout(() => setMessage(undefined), 5000);
    return () => clearTimeout(timer);
  }, [message]);

  function updateValue(field: keyof typeof initialValues, value: string) {
    setValues((current) => ({ ...current, [field]: value }));
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setMessage(undefined);

    if (values.password !== values.confirmPassword) {
      setMessage({ tone: 'error', text: t('setup.passwordMismatch') });
      setSaving(false);
      return;
    }

    const nameParts = values.ownerName.trim().split(/\s+/).filter(Boolean);
    const ownerFirstName = nameParts.shift() ?? '';
    const ownerLastName = nameParts.join(' ') || t('setup.ownerFallback');

    try {
      const response = await fetch('/api/businesses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: values.name.trim(),
          code: createBusinessCode(values.name),
          currency: values.currency,
          branchName: t('setup.mainBranch'),
          branchCode: 'MAIN',
          ownerFirstName,
          ownerLastName,
          ownerEmail: values.ownerEmail.trim(),
          ownerPassword: values.password,
        }),
      });
      const data = (await response.json()) as { message?: string };
      if (!response.ok) {
        throw new Error(data.message ?? t('setup.error.create'));
      }

      setMessage({
        tone: 'success',
        text: t('setup.created'),
      });
      setValues(initialValues);
    } catch (error) {
      setMessage({
        tone: 'error',
        text:
          error instanceof Error
            ? error.message
            : t('setup.error.api'),
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="min-h-dvh bg-app lg:grid lg:grid-cols-[minmax(18rem,0.72fr)_minmax(0,1.28fr)]">
      <div className="fixed top-4 right-4 z-20">
        <LanguageSwitcher />
      </div>
      <aside className="relative overflow-hidden bg-text-main px-4 py-6 text-white sm:px-8 lg:flex lg:min-h-dvh lg:flex-col lg:justify-between lg:px-10 lg:py-12">
        <div className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-brand/20 blur-3xl" />
        <div className="relative">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-brand text-white shadow-sm sm:h-12 sm:w-12">
              <Store size={22} strokeWidth={2.25} />
            </span>
            <div>
              <p className="m-0 text-xs font-bold uppercase tracking-widest text-brand-border">
                {t('auth.pointOfSale')}
              </p>
              <p className="mb-0 mt-0.5 text-lg font-bold">KN POS</p>
            </div>
          </div>

          <div className="mt-8 max-w-md lg:mt-20">
            <p className="m-0 text-xs font-bold uppercase tracking-widest text-brand-border">
              {t('setup.quickSetup')}
            </p>
            <h1 className="mb-0 mt-2 text-xl font-bold leading-tight tracking-tight sm:text-2xl lg:text-3xl">
              {t('setup.startSelling')}
            </h1>
            <p className="mb-0 mt-3 text-sm leading-6 text-muted-strong">
              {t('setup.intro')}
            </p>
          </div>
        </div>

        <div className="relative mt-8 hidden items-center gap-2 text-xs text-border-default lg:flex">
          <ShieldCheck size={16} className="text-brand-border" />
          <span>{t('setup.secureOwner')}</span>
        </div>
      </aside>

      <section className="flex px-4 py-6 sm:px-8 lg:min-h-dvh lg:items-center lg:px-12 lg:py-12">
        <div className="mx-auto w-full max-w-2xl">
          <header className="mb-5">
            <p className="m-0 text-xs font-bold uppercase tracking-widest text-brand">
              {t('setup.createWorkspace')}
            </p>
            <h2 className="mb-0 mt-1 text-xl font-bold tracking-tight text-text-main sm:text-2xl">
              {t('setup.aboutBusiness')}
            </h2>
          </header>

          <form onSubmit={submit}>
            <SectionCard
              title={t('setup.businessOwner')}
              description={t('setup.essentials')}
              icon={<Building2 size={20} />}
            >
              <div className="grid grid-cols-1 items-start gap-x-4 gap-y-4 md:grid-cols-2">
                {message && (
                  <AlertBanner
                    tone={message.tone}
                    icon={message.tone === 'success' ? <CheckCircle2 size={18} /> : undefined}
                    className="md:col-span-2"
                  >
                    {message.text}
                  </AlertBanner>
                )}

                <FormField id="setup-name" label={t('setup.businessName')} required>
                  <Input
                    id="setup-name"
                    required
                    autoComplete="organization"
                    value={values.name}
                    placeholder={t('setup.businessPlaceholder')}
                    prefixIcon={<Building2 size={16} />}
                    onChange={(event) => updateValue('name', event.target.value)}
                  />
                </FormField>

                <FormField id="setup-currency" label={t('setup.currency')} required>
                  <CustomSelect
                    name="currency"
                    value={values.currency}
                    options={[
                      { value: 'USD', label: t('setup.usd') },
                      { value: 'KHR', label: t('setup.khr') },
                      { value: 'BOTH', label: t('setup.bothCurrencies') },
                    ]}
                    leadingIcon={<Coins size={16} />}
                    onChange={(value) => updateValue('currency', value)}
                  />
                </FormField>

                <FormField id="setup-owner-name" label={t('setup.yourName')} required>
                  <Input
                    id="setup-owner-name"
                    required
                    autoComplete="name"
                    value={values.ownerName}
                    placeholder={t('setup.namePlaceholder')}
                    prefixIcon={<CircleUserRound size={16} />}
                    onChange={(event) => updateValue('ownerName', event.target.value)}
                  />
                </FormField>

                <FormField id="setup-owner-email" label={t('auth.email')} required>
                  <Input
                    id="setup-owner-email"
                    required
                    type="email"
                    autoComplete="email"
                    value={values.ownerEmail}
                    placeholder={t('setup.emailPlaceholder')}
                    prefixIcon={<Mail size={16} />}
                    onChange={(event) => updateValue('ownerEmail', event.target.value)}
                  />
                </FormField>

                <FormField
                  id="setup-password"
                  label={t('auth.password')}
                  required
                  help={t('setup.passwordHelp')}
                >
                  <PasswordInput
                    id="setup-password"
                    required
                    minLength={12}
                    maxLength={128}
                    autoComplete="new-password"
                    value={values.password}
                    placeholder={t('staff.passwordPlaceholder')}
                    onChange={(event) => updateValue('password', event.target.value)}
                  />
                </FormField>

                <FormField
                  id="setup-confirm-password"
                  label={t('setup.confirmPassword')}
                  required
                  error={
                    values.confirmPassword && values.password !== values.confirmPassword
                      ? t('setup.passwordMismatch')
                      : undefined
                  }
                >
                  <PasswordInput
                    id="setup-confirm-password"
                    required
                    minLength={12}
                    maxLength={128}
                    autoComplete="new-password"
                    value={values.confirmPassword}
                    placeholder={t('setup.passwordAgain')}
                    onChange={(event) => updateValue('confirmPassword', event.target.value)}
                  />
                </FormField>

                <div className="flex flex-col-reverse items-center gap-3 border-t border-border-subtle pt-5 md:col-span-2 sm:flex-row sm:justify-between">
                  <p className="m-0 text-center text-sm text-text-muted sm:text-left">
                    {t('setup.haveWorkspace')}{' '}
                    <Link className="font-bold text-brand hover:text-brand-hover" href="/login">
                      {t('auth.signIn')}
                    </Link>
                  </p>
                  <Button type="submit" size="lg" disabled={saving} className="w-full sm:w-auto">
                    {saving ? t('setup.creating') : t('setup.createWorkspace')}
                    {!saving && <ArrowRight size={17} />}
                  </Button>
                </div>
              </div>
            </SectionCard>
          </form>
        </div>
      </section>
    </main>
  );
}
