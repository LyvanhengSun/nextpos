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
import { useI18n } from '../../lib/i18n';

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
  const { t } = useI18n();
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
        throw new Error(data.message ?? t('settings.error.load'));
      }
      setSettings(data as Settings);
    } catch (error) {
      setIsError(true);
      setMessage(
        error instanceof Error
          ? error.message
          : t('settings.error.load'),
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
        throw new Error(data.message ?? t('settings.error.ownerOnly'));
      }

      setSettings(data as Settings);
      setIsError(false);
      setMessage(t('settings.success.saved'));
    } catch (error) {
      setIsError(true);
      setMessage(error instanceof Error ? error.message : t('settings.error.save'));
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <main className="app-page">
      <PageHeading eyebrow={t('settings.eyebrow')} title={t('settings.title')} />

      <div>
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
                title={t('activity.restricted')}
                description={t('settings.accessHelp')}
              />
            </SectionCard>
          ) : settings ? (
            <SectionCard
              title={t('settings.configuration', { name: settings.name || t('settings.business') })}
              description={t('settings.configurationHelp')}
              icon={<Settings2 size={20} />}
            >
              <form className="flex flex-col gap-6" onSubmit={save}>
                <section>
                  <h3 className="m-0 text-sm font-extrabold tracking-wide text-text-main uppercase">
                    {t('settings.businessDefaults')}
                  </h3>
                  <p className="mt-1 mb-4 text-xs leading-relaxed text-text-muted">
                    {t('settings.businessDefaultsHelp')}
                  </p>

                  <div className="grid grid-cols-1 gap-x-4 gap-y-4 md:grid-cols-2">
                    <FormField
                      id="tax-rate"
                      label={t('settings.taxRate')}
                      required
                      sublabel={t('settings.percent')}
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
                      label={t('settings.inventoryAlert')}
                      required
                      help={t('settings.inventoryAlertHelp')}
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
                      label={t('settings.businessPhone')}
                      sublabel={t('common.optional')}
                    >
                      <Input
                        id="business-phone"
                        name="phone"
                        type="tel"
                        defaultValue={settings.phone ?? ''}
                        placeholder={t('supplierPage.phonePlaceholder')}
                      />
                    </FormField>

                    <FormField
                      id="business-address"
                      label={t('settings.businessAddress')}
                      sublabel={t('common.optional')}
                    >
                      <Input
                        id="business-address"
                        name="address"
                        defaultValue={settings.address ?? ''}
                        placeholder={t('settings.addressPlaceholder')}
                      />
                    </FormField>
                  </div>
                </section>

                <section className="border-t border-border-subtle pt-6">
                  <h3 className="m-0 text-sm font-extrabold tracking-wide text-text-main uppercase">
                    {t('settings.receiptDetails')}
                  </h3>
                  <p className="mt-1 mb-4 text-xs leading-relaxed text-text-muted">
                    {t('settings.receiptDetailsHelp')}
                  </p>

                  <div className="grid grid-cols-1 gap-x-4 gap-y-4 md:grid-cols-2">
                    <FormField
                      id="receipt-prefix"
                      label={t('settings.receiptPrefix')}
                      required
                      help={t('settings.receiptPrefixHelp')}
                    >
                      <Input
                        id="receipt-prefix"
                        required
                        name="receiptPrefix"
                        maxLength={12}
                        defaultValue={settings.receiptPrefix}
                        placeholder={t('settings.receiptPrefixPlaceholder')}
                      />
                    </FormField>

                    <FormField
                      id="receipt-footer"
                      label={t('settings.receiptFooter')}
                      sublabel={t('common.optional')}
                    >
                      <Textarea
                        id="receipt-footer"
                        name="receiptFooter"
                        defaultValue={settings.receiptFooter ?? ''}
                        placeholder={t('settings.receiptFooterPlaceholder')}
                        className="min-h-20"
                      />
                    </FormField>
                  </div>
                </section>

                <div className="flex justify-end border-t border-border-subtle pt-6">
                  <Button type="submit" disabled={isSaving}>
                    <Save size={16} />
                    {isSaving ? t('common.saving') : t('hardware.saveSettings')}
                  </Button>
                </div>
              </form>
            </SectionCard>
          ) : (
            <SectionCard>
              <EmptyState
                icon={<Settings2 size={28} />}
                title={t('settings.loading')}
                description={t('settings.loadingHelp')}
              />
            </SectionCard>
          )}
        </PageContainer>
      </div>
    </main>
  );
}
