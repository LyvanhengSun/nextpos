'use client';

import { FormEvent, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  AlertCircle,
  CheckCircle2,
  Percent,
  Save,
  Settings2,
  ShieldAlert,
} from 'lucide-react';

import { PageContainer } from '../../components/layout/page-container';
import {
  AlertBanner,
  Button,
  EmptyState,
  FormField,
  Input,
  PageHeading,
  SectionCard,
  Textarea,
} from '../../components/ui/';

const api = '/api';

type Settings = {
  name: string;
  currency: string;
  taxRateBasisPoints: number;
  defaultInventoryAlertLevel: number;
  address: string | null;
  phone: string | null;
  receiptPrefix: string;
  receiptFooter: string | null;
};

export default function SettingsPage() {
  const router = useRouter();
  const [settings, setSettings] = useState<Settings | null>(null);
  const [message, setMessage] = useState('');
  const [isError, setIsError] = useState(false);
  const [isOwner, setIsOwner] = useState<boolean | null>(null);
  const [isSaving, setIsSaving] = useState(false);

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

  async function checkRoleAndLoad() {
    try {
      const meResponse = await fetch(`${api}/auth/me`, { headers });
      if (!meResponse.ok) {
        router.replace('/login');
        return;
      }

      const me = await meResponse.json();
      if (me.role !== 'OWNER') {
        setIsOwner(false);
        router.replace('/dashboard');
        return;
      }
      setIsOwner(true);

      const response = await fetch(`${api}/businesses/current/settings`, {
        headers,
      });
      const raw = await response.text().catch(() => '');
      let data: Partial<Settings> & { message?: string } = {};
      if (raw.trim()) {
        try {
          data = JSON.parse(raw);
        } catch {
          data = {};
        }
      }
      if (!response.ok) {
        throw new Error(data.message ?? 'Unable to load business settings.');
      }
      setSettings(data as Settings);
    } catch (error) {
      setIsError(true);
      setMessage(
        error instanceof Error
          ? error.message
          : 'Unable to load business settings.',
      );
    }
  }

  useEffect(() => {
    void checkRoleAndLoad();
  }, []);

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage('');
    setIsSaving(true);

    const form = Object.fromEntries(new FormData(event.currentTarget));
    try {
      const response = await fetch(`${api}/businesses/current/settings`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify({
          taxRateBasisPoints: Math.round(Number(form.taxRate || 0) * 100),
          defaultInventoryAlertLevel: Number(
            form.defaultInventoryAlertLevel || 0,
          ),
          address: form.address,
          phone: form.phone,
          receiptPrefix: form.receiptPrefix,
          receiptFooter: form.receiptFooter,
        }),
      });
      const raw = await response.text().catch(() => '');
      let data: Partial<Settings> & { message?: string } = {};
      if (raw.trim()) {
        try {
          data = JSON.parse(raw);
        } catch {
          data = {};
        }
      }
      if (!response.ok) {
        throw new Error(data.message ?? 'Only the owner can change settings.');
      }

      setSettings(data as Settings);
      setIsError(false);
      setMessage('Business and receipt settings saved successfully.');
    } catch (error) {
      setIsError(true);
      setMessage(error instanceof Error ? error.message : 'Save failed.');
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <main className="app-page">
      <PageHeading eyebrow="Owner settings" title="Tax & Receipt Settings" />

      <div className="py-6">
        <PageContainer>
          {message && (
            <AlertBanner
              tone={isError ? 'error' : 'success'}
              icon={
                isError ? <AlertCircle size={18} /> : <CheckCircle2 size={18} />
              }
              className="mb-5"
            >
              {message}
            </AlertBanner>
          )}

          {isOwner === false ? (
            <SectionCard>
              <EmptyState
                icon={<ShieldAlert size={28} />}
                title="Access restricted"
                description="Only the business owner can access these settings."
              />
            </SectionCard>
          ) : settings ? (
            <SectionCard
              title={`${settings.name || 'Business'} configuration`}
              description="Set the defaults used for inventory, business details, and customer receipts."
              icon={<Settings2 size={20} />}
            >
              <form className="flex flex-col gap-6" onSubmit={save}>
                <section>
                  <h3 className="m-0 text-sm font-extrabold tracking-wide text-text-main uppercase">
                    Business defaults
                  </h3>
                  <p className="mt-1 mb-4 text-xs leading-relaxed text-text-muted">
                    Applied automatically when staff create products and
                    complete sales.
                  </p>

                  <div className="grid grid-cols-1 gap-x-4 gap-y-4 md:grid-cols-2">
                    <FormField
                      id="tax-rate"
                      label="Tax rate"
                      required
                      sublabel="(percent)"
                    >
                      <Input
                        id="tax-rate"
                        required
                        name="taxRate"
                        type="number"
                        min="0"
                        max="100"
                        step="0.01"
                        defaultValue={(
                          settings.taxRateBasisPoints / 100
                        ).toFixed(2)}
                        suffixIcon={<Percent size={15} />}
                      />
                    </FormField>

                    <FormField
                      id="inventory-alert-level"
                      label="Default inventory alert level"
                      required
                      help="Used when a new product has no custom alert level."
                    >
                      <Input
                        id="inventory-alert-level"
                        required
                        name="defaultInventoryAlertLevel"
                        type="number"
                        min="0"
                        step="1"
                        defaultValue={settings.defaultInventoryAlertLevel}
                      />
                    </FormField>

                    <FormField
                      id="business-phone"
                      label="Business phone"
                      sublabel="(optional)"
                    >
                      <Input
                        id="business-phone"
                        name="phone"
                        type="tel"
                        defaultValue={settings.phone ?? ''}
                        placeholder="e.g. +855 12 345 678"
                      />
                    </FormField>

                    <FormField
                      id="business-address"
                      label="Business address"
                      sublabel="(optional)"
                    >
                      <Input
                        id="business-address"
                        name="address"
                        defaultValue={settings.address ?? ''}
                        placeholder="e.g. 123 Main Street"
                      />
                    </FormField>
                  </div>
                </section>

                <section className="border-t border-border-subtle pt-6">
                  <h3 className="m-0 text-sm font-extrabold tracking-wide text-text-main uppercase">
                    Receipt details
                  </h3>
                  <p className="mt-1 mb-4 text-xs leading-relaxed text-text-muted">
                    Keep printed receipts recognizable and useful for customers.
                  </p>

                  <div className="grid grid-cols-1 gap-x-4 gap-y-4 md:grid-cols-2">
                    <FormField
                      id="receipt-prefix"
                      label="Receipt prefix"
                      required
                      help="A short code shown before each receipt number."
                    >
                      <Input
                        id="receipt-prefix"
                        required
                        name="receiptPrefix"
                        maxLength={12}
                        defaultValue={settings.receiptPrefix}
                        placeholder="e.g. REC"
                      />
                    </FormField>

                    <FormField
                      id="receipt-footer"
                      label="Receipt footer message"
                      sublabel="(optional)"
                    >
                      <Textarea
                        id="receipt-footer"
                        name="receiptFooter"
                        defaultValue={settings.receiptFooter ?? ''}
                        placeholder="e.g. Thank you for shopping with us!"
                        className="min-h-20"
                      />
                    </FormField>
                  </div>
                </section>

                <div className="flex justify-end border-t border-border-subtle pt-6">
                  <Button type="submit" disabled={isSaving}>
                    <Save size={16} />
                    {isSaving ? 'Saving…' : 'Save settings'}
                  </Button>
                </div>
              </form>
            </SectionCard>
          ) : (
            <SectionCard>
              <EmptyState
                icon={<Settings2 size={28} />}
                title="Loading settings"
                description="Preparing your business configuration."
              />
            </SectionCard>
          )}
        </PageContainer>
      </div>
    </main>
  );
}
