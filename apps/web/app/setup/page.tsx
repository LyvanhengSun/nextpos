'use client';

import { FormEvent, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  ArrowRight,
  Building2,
  CheckCircle2,
  CircleUserRound,
  Coins,
  LockKeyhole,
  Mail,
  Phone,
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
} from '@/components/ui';
import { useI18n } from '@/lib/i18n';

const initialValues = {
  name: '',
  currency: 'USD',
  businessType: 'RETAIL',
  phone: '',
  ownerName: '',
  ownerEmail: '',
  ownerPhone: '',
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
  const [step, setStep] = useState(0);
  const formRef = useRef<HTMLFormElement>(null);

  const steps = [
    { label: t('setup.ownerDetails'), Icon: CircleUserRound },
    { label: t('setup.businessDetails'), Icon: Store },
    { label: t('setup.security'), Icon: LockKeyhole },
  ];

  useEffect(() => {
    if (!message) return;
    const timer = setTimeout(() => setMessage(undefined), 5000);
    return () => clearTimeout(timer);
  }, [message]);

  function updateValue(field: keyof typeof initialValues, value: string) {
    setValues((current) => ({ ...current, [field]: value }));
  }

  function nextStep() {
    setMessage(undefined);
    if (formRef.current?.reportValidity()) {
      setStep((current) => Math.min(current + 1, steps.length - 1));
    }
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
          businessType: values.businessType,
          phone: values.phone.trim(),
          branchName: t('setup.mainBranch'),
          branchCode: 'MAIN',
          ownerFirstName,
          ownerLastName,
          ownerEmail: values.ownerEmail.trim(),
          ownerPhone: values.ownerPhone.trim(),
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
    <main className="min-h-dvh w-full max-w-full overflow-x-hidden bg-[#f7f8fa] lg:grid lg:grid-cols-[minmax(23rem,38%)_1fr]">
      <aside className="relative hidden min-h-dvh overflow-hidden bg-slate-950 text-white lg:flex lg:flex-col lg:justify-between">
        <div className="absolute inset-0 bg-[url('/images/login-hero.png')] bg-cover bg-center" />
        <div className="absolute inset-0 bg-gradient-to-b from-slate-950/45 via-slate-950/25 to-slate-950/90" />

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
          <p className="mb-3 text-xs font-bold text-emerald-300 uppercase">{t('setup.quickSetup')}</p>
          <h1 className="m-0 text-3xl font-extrabold leading-tight tracking-tight">{t('setup.startSelling')}</h1>
          <p className="mt-4 mb-0 max-w-lg text-sm leading-6 text-white/75">{t('setup.intro')}</p>
        </div>
      </aside>

      <section className="flex min-h-dvh flex-col">
        <header className="flex min-h-16 shrink-0 items-center justify-between border-b border-slate-200 px-4 sm:min-h-20 sm:px-8 lg:px-10">
          <Link href="/login" className="inline-flex items-center gap-2 text-sm font-bold text-brand transition hover:text-brand-hover">
            <ArrowLeft size={17} />
            {t('setup.backToSignIn')}
          </Link>
          <LanguageSwitcher />
        </header>

        <div className="mx-auto flex min-h-0 w-full max-w-5xl flex-1 flex-col px-5 py-5 sm:px-8 sm:py-8 lg:px-10 lg:py-10">
          <div className="mb-6 sm:mb-8">
            <h2 className="m-0 text-xl font-extrabold tracking-tight text-text-main sm:text-3xl">{t('setup.createAccount')}</h2>
            <p className="mt-2 mb-0 hidden text-sm leading-6 text-text-muted sm:block">{t('setup.createAccountHelp')}</p>
          </div>

          <ol className="mb-5 grid list-none grid-cols-3 gap-2 p-0 sm:mb-8 sm:gap-4" aria-label={t('setup.createWorkspace')}>
            {steps.map(({ label, Icon }, index) => {
              const active = index === step;
              const complete = index < step;
              return (
                <li key={label} className="relative min-w-0">
                  {index < steps.length - 1 && (
                    <span className={`absolute top-4 left-[calc(50%+1.25rem)] h-0.5 w-[calc(100%-2rem)] sm:top-5 sm:left-[calc(50%+1.5rem)] sm:w-[calc(100%-2.5rem)] ${complete ? 'bg-brand' : 'bg-slate-200'}`} aria-hidden="true" />
                  )}
                  <div className="relative flex flex-col items-center text-center">
                    <span className={`grid size-8 place-items-center rounded-full border-2 transition sm:size-10 ${active ? 'border-brand bg-brand text-white shadow-md shadow-brand/20' : complete ? 'border-brand bg-emerald-50 text-brand' : 'border-slate-200 bg-white text-slate-400'}`}>
                      {complete ? <CheckCircle2 size={18} /> : <Icon size={17} />}
                    </span>
                    <span className="mt-2 hidden text-[11px] font-semibold text-text-muted sm:block">{t('setup.step')} {index + 1}</span>
                    <span className={`mt-1 truncate text-[10px] font-bold sm:mt-0.5 sm:text-sm ${active || complete ? 'text-text-main' : 'text-slate-400'}`}>{label}</span>
                  </div>
                </li>
              );
            })}
          </ol>

          <form ref={formRef} onSubmit={submit} className="flex flex-1 flex-col rounded-xl border border-slate-200 bg-white shadow-[0_20px_60px_-40px_rgba(15,23,42,0.3)] sm:rounded-2xl">
            <div className="flex-1 p-6 sm:p-8 lg:min-h-[25rem] lg:p-10">
              <div className="mb-6 flex items-start gap-3 sm:mb-7">
                <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-emerald-50 text-brand sm:size-10">
                  {step === 0 ? <CircleUserRound size={20} /> : step === 1 ? <Building2 size={20} /> : <ShieldCheck size={20} />}
                </span>
                <div>
                  <h3 className="m-0 text-lg font-extrabold text-text-main">{steps[step].label}</h3>
                  <p className="mt-1 mb-0 hidden text-sm text-text-muted sm:block">
                    {step === 0 ? t('setup.ownerDetailsHelp') : step === 1 ? t('setup.businessDetailsHelp') : t('setup.securityHelp')}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 items-start gap-5 md:grid-cols-2">
                {message && (
                  <AlertBanner
                    tone={message.tone}
                    icon={message.tone === 'success' ? <CheckCircle2 size={18} /> : undefined}
                    className="md:col-span-2"
                  >
                    {message.text}
                  </AlertBanner>
                )}

                {step === 0 && <>
                  <FormField id="setup-owner-name" label={t('setup.yourName')} required className="md:col-span-2">
                    <Input id="setup-owner-name" required autoComplete="name" value={values.ownerName} placeholder={t('setup.namePlaceholder')} prefixIcon={<CircleUserRound size={16} />} className="pl-10" wrapperClassName="h-12 rounded-lg" onChange={(event) => updateValue('ownerName', event.target.value)} />
                  </FormField>
                  <FormField id="setup-owner-email" label={t('auth.email')} required>
                    <Input id="setup-owner-email" required type="email" autoComplete="email" value={values.ownerEmail} placeholder={t('setup.emailPlaceholder')} prefixIcon={<Mail size={16} />} className="pl-10" wrapperClassName="h-12 rounded-lg" onChange={(event) => updateValue('ownerEmail', event.target.value)} />
                  </FormField>
                  <FormField id="setup-owner-phone" label={t('setup.ownerPhone')} required>
                    <Input id="setup-owner-phone" required type="tel" autoComplete="tel" value={values.ownerPhone} placeholder={t('setup.phonePlaceholder')} prefixIcon={<Phone size={16} />} className="pl-10" wrapperClassName="h-12 rounded-lg" onChange={(event) => updateValue('ownerPhone', event.target.value)} />
                  </FormField>
                </>}

                {step === 1 && <>
                  <FormField id="setup-name" label={t('setup.businessName')} required>
                    <Input id="setup-name" required autoComplete="organization" value={values.name} placeholder={t('setup.businessPlaceholder')} prefixIcon={<Building2 size={16} />} className="pl-10" wrapperClassName="h-12 rounded-lg" onChange={(event) => updateValue('name', event.target.value)} />
                  </FormField>
                  <FormField id="setup-business-type" label={t('setup.businessType')} required>
                    <CustomSelect name="businessType" value={values.businessType} className="w-full [&>button]:h-12 [&>button]:rounded-lg" options={[{ value: 'RETAIL', label: t('setup.typeRetail') }, { value: 'GROCERY', label: t('setup.typeGrocery') }, { value: 'RESTAURANT_CAFE', label: t('setup.typeRestaurantCafe') }, { value: 'FASHION', label: t('setup.typeFashion') }, { value: 'ELECTRONICS', label: t('setup.typeElectronics') }, { value: 'BEAUTY_HEALTH', label: t('setup.typeBeautyHealth') }, { value: 'PHARMACY', label: t('setup.typePharmacy') }, { value: 'SERVICE', label: t('setup.typeService') }, { value: 'WHOLESALE', label: t('setup.typeWholesale') }, { value: 'OTHER', label: t('setup.typeOther') }]} leadingIcon={<Store size={16} />} onChange={(value) => updateValue('businessType', value)} />
                  </FormField>
                  <FormField id="setup-currency" label={t('setup.currency')} required>
                    <CustomSelect name="currency" value={values.currency} className="w-full [&>button]:h-12 [&>button]:rounded-lg" options={[{ value: 'USD', label: t('setup.usd') }, { value: 'KHR', label: t('setup.khr') }, { value: 'BOTH', label: t('setup.bothCurrencies') }]} leadingIcon={<Coins size={16} />} onChange={(value) => updateValue('currency', value)} />
                  </FormField>
                  <FormField id="setup-phone" label={t('setup.businessPhone')} required>
                    <Input id="setup-phone" required type="tel" autoComplete="tel" value={values.phone} placeholder={t('setup.phonePlaceholder')} prefixIcon={<Phone size={16} />} className="pl-10" wrapperClassName="h-12 rounded-lg" onChange={(event) => updateValue('phone', event.target.value)} />
                  </FormField>
                </>}

                {step === 2 && <>
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
                    className="pl-10"
                    wrapperClassName="[&>button]:h-12 [&>div]:h-12 [&>div]:rounded-lg"
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
                    className="pl-10"
                    wrapperClassName="[&>button]:h-12 [&>div]:h-12 [&>div]:rounded-lg"
                    onChange={(event) => updateValue('confirmPassword', event.target.value)}
                  />
                </FormField>
                </>}
              </div>
            </div>

            <div className="flex items-center justify-between gap-3 border-t border-slate-200 bg-slate-50/70 p-3 sm:px-8 sm:py-4">
              {step > 0 ? (
                <Button type="button" variant="secondary" size="lg" className="h-11 rounded-lg sm:h-12" onClick={() => { setMessage(undefined); setStep((current) => current - 1); }}>
                  <ArrowLeft size={17} /> {t('setup.back')}
                </Button>
              ) : (
                <p className="m-0 text-center text-sm text-text-muted sm:text-left">{t('setup.haveWorkspace')} <Link className="font-bold text-brand hover:text-brand-hover" href="/login">{t('auth.signIn')}</Link></p>
              )}

              {step < steps.length - 1 ? (
                <Button type="button" size="lg" className="h-11 rounded-lg sm:h-12 sm:min-w-36" onClick={nextStep}>
                  {t('setup.continue')} <ArrowRight size={17} />
                </Button>
              ) : (
                <Button type="submit" size="lg" disabled={saving} className="h-11 rounded-lg sm:h-12 sm:min-w-48">
                  {saving ? t('setup.creating') : t('setup.createWorkspace')}
                  {!saving && <ArrowRight size={17} />}
                </Button>
              )}
            </div>
          </form>
        </div>
      </section>
    </main>
  );
}
