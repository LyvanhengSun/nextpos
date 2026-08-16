'use client';

import { FormEvent, KeyboardEvent, useEffect, useRef, useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  Keyboard,
  Monitor,
  Printer,
  ReceiptText,
  Save,
  ScanBarcode,
  Settings2,
  ShoppingBasket,
  WalletCards,
} from 'lucide-react';

import { PageContainer } from '../../components/layout/page-container';
import {
  AlertBanner,
  Button,
  CustomSelect,
  FormField,
  Input,
  PageHeading,
  SectionCard,
  Switch,
} from '../../components/ui/';
import {
  DeviceSettings,
  defaultDeviceSettings,
  getDeviceSettings,
  saveDeviceSettings as persistDeviceSettings,
} from '../../lib/';
import { useI18n } from '../../lib/i18n';

function ReceiptPreview({ settings }: { settings: DeviceSettings }) {
  const { t } = useI18n();
  return (
    <div className="mx-auto w-full max-w-sm rounded-lg border border-dashed border-border-default bg-card p-5 text-center shadow-sm">
      <ReceiptText size={24} className="mx-auto mb-3 text-text-muted" />
      <h3 className="m-0 text-base font-bold tracking-tight text-text-main">
        {settings.terminalName || t('hardware.posTerminal')}
      </h3>
      <p className="mt-1 mb-3 text-xs text-text-muted">
        {t('hardware.printerTest', { width: settings.receiptWidth })}
      </p>
      <div className="border-y border-dashed border-border-default py-3 text-sm text-text-secondary">
        <p className="m-0 font-semibold">{t('hardware.systemReady')}</p>
      </div>
      <p className="mt-3 mb-0 text-sm font-bold text-text-main">{t('hardware.thankYou')}</p>
    </div>
  );
}

export default function HardwarePage() {
  const { t } = useI18n();
  const [settings, setSettings] = useState<DeviceSettings>(
    defaultDeviceSettings,
  );
  const [message, setMessage] = useState('');
  const [messageTone, setMessageTone] = useState<'success' | 'error'>(
    'success',
  );
  const [scanResult, setScanResult] = useState('');
  const [scanTone, setScanTone] = useState<'success' | 'error'>('success');
  const scannerInput = useRef<HTMLInputElement>(null);

  useEffect(() => setSettings(getDeviceSettings()), []);

  function update<K extends keyof DeviceSettings>(
    key: K,
    value: DeviceSettings[K],
  ) {
    setSettings((current) => ({ ...current, [key]: value }));
  }

  function saveSettings() {
    try {
      persistDeviceSettings(settings);
      setMessage(t('hardware.success.saved'));
      setMessageTone('success');
    } catch {
      setMessage(t('hardware.error.save'));
      setMessageTone('error');
    }
  }

  function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    saveSettings();
  }

  function scan(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key !== 'Enter') return;
    event.preventDefault();
    const code = event.currentTarget.value.trim();
    setScanResult(
      code
        ? t('hardware.scannerReceived', { code })
        : t('hardware.noBarcode'),
    );
    setScanTone(code ? 'success' : 'error');
    event.currentTarget.value = '';
    scannerInput.current?.focus();
  }

  return (
    <main className="app-page hardware">
      <PageHeading
        eyebrow={t('hardware.eyebrow')}
        title={t('hardware.title')}
        className="print-hide"
        actions={
          <Button onClick={saveSettings}>
            <Save size={16} />
            {t('hardware.saveSettings')}
          </Button>
        }
      />

      <div className="print-hide">
        <PageContainer className="space-y-6">
          {message && (
            <AlertBanner
              tone={messageTone}
              icon={
                messageTone === 'success' ? (
                  <CheckCircle2 size={17} />
                ) : (
                  <AlertCircle size={17} />
                )
              }
            >
              {message}
            </AlertBanner>
          )}

          <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-2">
            <SectionCard
              title={t('hardware.terminalPrinter')}
              description={t('hardware.terminalPrinterHelp')}
              icon={<Settings2 size={20} />}
              className="h-full"
            >
              <form onSubmit={save} className="space-y-5">
                <div className="grid grid-cols-1 items-start gap-x-4 gap-y-4 md:grid-cols-2">
                  <FormField
                    label={t('hardware.terminalName')}
                    required
                    id="terminal-name"
                    help={t('hardware.terminalNameHelp')}
                  >
                    <Input
                      id="terminal-name"
                      required
                      value={settings.terminalName}
                      onChange={(event) =>
                        update('terminalName', event.target.value)
                      }
                      prefixIcon={<Monitor size={16} />}
                      placeholder={t('hardware.terminalPlaceholder')}
                    />
                  </FormField>
                  <FormField
                    label={t('hardware.paperWidth')}
                    required
                    help={t('hardware.paperWidthHelp')}
                  >
                    <CustomSelect
                      value={settings.receiptWidth}
                      onChange={(value) =>
                        update('receiptWidth', value as '58' | '80')
                      }
                      leadingIcon={<Printer size={16} />}
                      options={[
                        {
                          value: '80',
                          label: '80 mm',
                          sublabel: t('hardware.recommendedWidth'),
                        },
                        {
                          value: '58',
                          label: '58 mm',
                          sublabel: t('hardware.compactPrinter'),
                        },
                      ]}
                    />
                  </FormField>
                </div>

                <div className="flex items-center justify-between gap-4 rounded-lg border border-border-subtle bg-muted-surface p-5">
                  <div className="min-w-0">
                    <p className="m-0 text-sm font-bold text-text-main">
                      {t('hardware.openReceipt')}
                    </p>
                    <p className="mt-1 mb-0 text-xs leading-relaxed text-text-muted">
                      {t('hardware.openReceiptHelp')}
                    </p>
                  </div>
                  <Switch
                    checked={settings.autoPrint}
                    onCheckedChange={(checked) => update('autoPrint', checked)}
                    label={t('hardware.openReceiptLabel')}
                  />
                </div>

                <div className="flex justify-end border-t border-border-subtle pt-5">
                  <Button type="submit">
                    <Save size={16} />
                    {t('hardware.saveTerminal')}
                  </Button>
                </div>
              </form>
            </SectionCard>

            <SectionCard
              title={t('hardware.testReceipt')}
              description={t('hardware.testReceiptHelp')}
              icon={<ReceiptText size={20} />}
              className="h-full"
            >
              <ReceiptPreview settings={settings} />
              <div className="mt-5 flex justify-center">
                <Button variant="secondary" onClick={() => window.print()}>
                  <Printer size={16} />
                  {t('hardware.printTest')}
                </Button>
              </div>
            </SectionCard>

            <SectionCard
              title={t('hardware.scannerTest')}
              description={t('hardware.scannerTestHelp')}
              icon={<ScanBarcode size={20} />}
              className="h-full"
            >
              <FormField
                label={t('hardware.scannerInput')}
                help={t('hardware.scannerInputHelp')}
                id="scanner-test"
              >
                <Input
                  ref={scannerInput}
                  id="scanner-test"
                  aria-label={t('hardware.scannerTest')}
                  placeholder={t('hardware.scannerPlaceholder')}
                  onKeyDown={scan}
                  prefixIcon={<Keyboard size={16} />}
                />
              </FormField>
              {scanResult && (
                <AlertBanner
                  tone={scanTone}
                  className="mt-5"
                  icon={
                    scanTone === 'success' ? (
                      <CheckCircle2 size={17} />
                    ) : (
                      <AlertCircle size={17} />
                    )
                  }
                >
                  {scanResult}
                </AlertBanner>
              )}
            </SectionCard>

            <SectionCard
              title={t('hardware.cashDrawer')}
              description={t('hardware.cashDrawerHelp')}
              icon={<WalletCards size={20} />}
              className="h-full"
            >
              <FormField label={t('hardware.drawerMethod')} required>
                <CustomSelect
                  value={settings.cashDrawerMode}
                  onChange={(value) =>
                    update('cashDrawerMode', value as 'MANUAL' | 'PRINTER')
                  }
                  leadingIcon={<WalletCards size={16} />}
                  options={[
                    {
                      value: 'MANUAL',
                      label: t('hardware.manual'),
                      sublabel: t('hardware.manualHelp'),
                    },
                    {
                      value: 'PRINTER',
                      label: t('hardware.receiptPrinter'),
                      sublabel: t('hardware.printerDrawerHelp'),
                    },
                  ]}
                />
              </FormField>
              <AlertBanner
                tone="info"
                className="mt-5"
                icon={<AlertCircle size={17} />}
              >
                {t('hardware.driverHelp')}
              </AlertBanner>
            </SectionCard>
          </div>

          <SectionCard
            title={t('hardware.customerDisplay')}
            description={t('hardware.customerDisplayHelp')}
            icon={<ShoppingBasket size={20} />}
          >
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <p className="m-0 text-sm font-bold text-text-main">
                  {t('hardware.enableDisplay')}
                </p>
                <p className="mt-1 mb-0 text-xs leading-relaxed text-text-muted">
                  {t('hardware.enableDisplayHelp')}
                </p>
              </div>
              <Switch
                checked={settings.customerDisplay}
                onCheckedChange={(checked) =>
                  update('customerDisplay', checked)
                }
                label={t('hardware.enableDisplay')}
              />
            </div>
            <div className="mt-6 flex justify-end border-t border-border-subtle pt-5">
              <Button onClick={saveSettings}>
                <Save size={16} />
                {t('hardware.saveHardware')}
              </Button>
            </div>
          </SectionCard>
        </PageContainer>
      </div>

      <section className="hardware-test-receipt hidden">
        <ReceiptPreview settings={settings} />
      </section>
    </main>
  );
}
