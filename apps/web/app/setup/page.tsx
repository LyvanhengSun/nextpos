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
  PasswordInput,
  SectionCard,
} from '@/components/ui';

const initialValues = {
  name: '',
  currency: 'USD',
  ownerName: '',
  ownerEmail: '',
  password: '',
  confirmPassword: '',
};

const currencyOptions = [
  { value: 'USD', label: 'US Dollar (USD)' },
  { value: 'KHR', label: 'Cambodian Riel (KHR)' },
  { value: 'BOTH', label: 'USD and KHR' },
];

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
      setMessage({ tone: 'error', text: 'Passwords do not match.' });
      setSaving(false);
      return;
    }

    const nameParts = values.ownerName.trim().split(/\s+/).filter(Boolean);
    const ownerFirstName = nameParts.shift() ?? '';
    const ownerLastName = nameParts.join(' ') || 'Owner';

    try {
      const response = await fetch('/api/businesses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: values.name.trim(),
          code: createBusinessCode(values.name),
          currency: values.currency,
          branchName: 'Main Branch',
          branchCode: 'MAIN',
          ownerFirstName,
          ownerLastName,
          ownerEmail: values.ownerEmail.trim(),
          ownerPassword: values.password,
        }),
      });
      const data = (await response.json()) as { message?: string };
      if (!response.ok) {
        throw new Error(data.message ?? 'Unable to create the business.');
      }

      setMessage({
        tone: 'success',
        text: 'Business created. You can now sign in with your email and password.',
      });
      setValues(initialValues);
    } catch (error) {
      setMessage({
        tone: 'error',
        text:
          error instanceof Error
            ? error.message
            : 'Unable to contact the API. Start it with pnpm dev.',
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="min-h-dvh bg-app lg:grid lg:grid-cols-[minmax(18rem,0.72fr)_minmax(0,1.28fr)]">
      <aside className="relative overflow-hidden bg-text-main px-4 py-6 text-white sm:px-8 lg:flex lg:min-h-dvh lg:flex-col lg:justify-between lg:px-10 lg:py-12">
        <div className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-brand/20 blur-3xl" />
        <div className="relative">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-brand text-white shadow-sm sm:h-12 sm:w-12">
              <Store size={22} strokeWidth={2.25} />
            </span>
            <div>
              <p className="m-0 text-xs font-bold uppercase tracking-widest text-brand-border">
                Point of sale
              </p>
              <p className="mb-0 mt-0.5 text-lg font-bold">KN POS</p>
            </div>
          </div>

          <div className="mt-8 max-w-md lg:mt-20">
            <p className="m-0 text-xs font-bold uppercase tracking-widest text-brand-border">
              Quick setup
            </p>
            <h1 className="mb-0 mt-2 text-xl font-bold leading-tight tracking-tight sm:text-2xl lg:text-3xl">
              Start selling in minutes.
            </h1>
            <p className="mb-0 mt-3 text-sm leading-6 text-muted-strong">
              Enter the essentials now. Branch, receipt, tax, and inventory details can be completed later.
            </p>
          </div>
        </div>

        <div className="relative mt-8 hidden items-center gap-2 text-xs text-border-default lg:flex">
          <ShieldCheck size={16} className="text-brand-border" />
          <span>Secure owner setup</span>
        </div>
      </aside>

      <section className="flex px-4 py-6 sm:px-8 lg:min-h-dvh lg:items-center lg:px-12 lg:py-12">
        <div className="mx-auto w-full max-w-2xl">
          <header className="mb-5">
            <p className="m-0 text-xs font-bold uppercase tracking-widest text-brand">
              Create workspace
            </p>
            <h2 className="mb-0 mt-1 text-xl font-bold tracking-tight text-text-main sm:text-2xl">
              Tell us about your business
            </h2>
          </header>

          <form onSubmit={submit}>
            <SectionCard
              title="Business and owner"
              description="Only the essentials. You can change these details later."
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

                <FormField id="setup-name" label="Business name" required>
                  <Input
                    id="setup-name"
                    required
                    autoComplete="organization"
                    value={values.name}
                    placeholder="e.g. My Shop"
                    prefixIcon={<Building2 size={16} />}
                    onChange={(event) => updateValue('name', event.target.value)}
                  />
                </FormField>

                <FormField id="setup-currency" label="Currency" required>
                  <CustomSelect
                    name="currency"
                    value={values.currency}
                    options={currencyOptions}
                    leadingIcon={<Coins size={16} />}
                    onChange={(value) => updateValue('currency', value)}
                  />
                </FormField>

                <FormField id="setup-owner-name" label="Your name" required>
                  <Input
                    id="setup-owner-name"
                    required
                    autoComplete="name"
                    value={values.ownerName}
                    placeholder="e.g. John Doe"
                    prefixIcon={<CircleUserRound size={16} />}
                    onChange={(event) => updateValue('ownerName', event.target.value)}
                  />
                </FormField>

                <FormField id="setup-owner-email" label="Email address" required>
                  <Input
                    id="setup-owner-email"
                    required
                    type="email"
                    autoComplete="email"
                    value={values.ownerEmail}
                    placeholder="owner@example.com"
                    prefixIcon={<Mail size={16} />}
                    onChange={(event) => updateValue('ownerEmail', event.target.value)}
                  />
                </FormField>

                <FormField
                  id="setup-password"
                  label="Password"
                  required
                  help="Use at least 12 characters."
                >
                  <PasswordInput
                    id="setup-password"
                    required
                    minLength={12}
                    maxLength={128}
                    autoComplete="new-password"
                    value={values.password}
                    placeholder="12+ characters"
                    onChange={(event) => updateValue('password', event.target.value)}
                  />
                </FormField>

                <FormField
                  id="setup-confirm-password"
                  label="Confirm password"
                  required
                  error={
                    values.confirmPassword && values.password !== values.confirmPassword
                      ? 'Passwords do not match.'
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
                    placeholder="Enter password again"
                    onChange={(event) => updateValue('confirmPassword', event.target.value)}
                  />
                </FormField>

                <div className="flex flex-col-reverse items-center gap-3 border-t border-border-subtle pt-5 md:col-span-2 sm:flex-row sm:justify-between">
                  <p className="m-0 text-center text-sm text-text-muted sm:text-left">
                    Already have a workspace?{' '}
                    <Link className="font-bold text-brand hover:text-brand-hover" href="/login">
                      Sign in
                    </Link>
                  </p>
                  <Button type="submit" size="lg" disabled={saving} className="w-full sm:w-auto">
                    {saving ? 'Creating…' : 'Create workspace'}
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
