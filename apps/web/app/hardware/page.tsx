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

function ReceiptPreview({ settings }: { settings: DeviceSettings }) {
  return (
    <div className="mx-auto w-full max-w-sm rounded-lg border border-dashed border-border-default bg-card p-5 text-center shadow-sm">
      <ReceiptText size={24} className="mx-auto mb-3 text-text-muted" />
      <h3 className="m-0 text-base font-bold tracking-tight text-text-main">
        {settings.terminalName || 'POS Terminal'}
      </h3>
      <p className="mt-1 mb-3 text-xs text-text-muted">
        Printer test · {settings.receiptWidth} mm
      </p>
      <div className="border-y border-dashed border-border-default py-3 text-sm text-text-secondary">
        <p className="m-0 font-semibold">POS System is ready.</p>
      </div>
      <p className="mt-3 mb-0 text-sm font-bold text-text-main">Thank you!</p>
    </div>
  );
}

export default function HardwarePage() {
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
      setMessage('Hardware settings saved on this device.');
      setMessageTone('success');
    } catch {
      setMessage('Unable to save hardware settings on this device.');
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
        ? `Scanner received ${code}.`
        : 'No barcode received. Scan again, then press Enter.',
    );
    setScanTone(code ? 'success' : 'error');
    event.currentTarget.value = '';
    scannerInput.current?.focus();
  }

  return (
    <main className="app-page hardware">
      <PageHeading
        eyebrow="Terminal setup"
        title="Hardware"
        className="print-hide"
        actions={
          <Button onClick={saveSettings}>
            <Save size={16} />
            Save settings
          </Button>
        }
      />

      <div className="print-hide py-6">
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
              title="Terminal and receipt printer"
              description="Set device and receipt defaults."
              icon={<Settings2 size={20} />}
              className="h-full"
            >
              <form onSubmit={save} className="space-y-5">
                <div className="grid grid-cols-1 items-start gap-x-4 gap-y-4 md:grid-cols-2">
                  <FormField
                    label="Terminal name"
                    required
                    id="terminal-name"
                    help="Shown on receipts."
                  >
                    <Input
                      id="terminal-name"
                      required
                      value={settings.terminalName}
                      onChange={(event) =>
                        update('terminalName', event.target.value)
                      }
                      prefixIcon={<Monitor size={16} />}
                      placeholder="e.g. Front counter"
                    />
                  </FormField>
                  <FormField
                    label="Receipt paper width"
                    required
                    help="Match printer paper."
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
                          sublabel: 'Recommended receipt width',
                        },
                        {
                          value: '58',
                          label: '58 mm',
                          sublabel: 'Compact receipt printer',
                        },
                      ]}
                    />
                  </FormField>
                </div>

                <div className="flex items-center justify-between gap-4 rounded-lg border border-border-subtle bg-muted-surface p-5">
                  <div className="min-w-0">
                    <p className="m-0 text-sm font-bold text-text-main">
                      Open receipt after sale
                    </p>
                    <p className="mt-1 mb-0 text-xs leading-relaxed text-text-muted">
                      Open receipt after checkout.
                    </p>
                  </div>
                  <Switch
                    checked={settings.autoPrint}
                    onCheckedChange={(checked) => update('autoPrint', checked)}
                    label="Open receipt automatically after sale"
                  />
                </div>

                <div className="flex justify-end border-t border-border-subtle pt-5">
                  <Button type="submit">
                    <Save size={16} />
                    Save terminal settings
                  </Button>
                </div>
              </form>
            </SectionCard>

            <SectionCard
              title="Test receipt"
              description="Preview receipt setup."
              icon={<ReceiptText size={20} />}
              className="h-full"
            >
              <ReceiptPreview settings={settings} />
              <div className="mt-5 flex justify-center">
                <Button variant="secondary" onClick={() => window.print()}>
                  <Printer size={16} />
                  Print test receipt
                </Button>
              </div>
            </SectionCard>

            <SectionCard
              title="Scanner test"
              description="Confirm barcode input."
              icon={<ScanBarcode size={20} />}
              className="h-full"
            >
              <FormField
                label="Barcode scanner input"
                help="Focus field, then scan."
                id="scanner-test"
              >
                <Input
                  ref={scannerInput}
                  id="scanner-test"
                  aria-label="Scanner test"
                  placeholder="Click here, then scan a barcode"
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
              title="Cash drawer"
              description="Choose drawer opening method."
              icon={<WalletCards size={20} />}
              className="h-full"
            >
              <FormField label="Drawer opening method" required>
                <CustomSelect
                  value={settings.cashDrawerMode}
                  onChange={(value) =>
                    update('cashDrawerMode', value as 'MANUAL' | 'PRINTER')
                  }
                  leadingIcon={<WalletCards size={16} />}
                  options={[
                    {
                      value: 'MANUAL',
                      label: 'Manual',
                      sublabel: 'Open with the drawer key or button',
                    },
                    {
                      value: 'PRINTER',
                      label: 'Receipt printer',
                      sublabel: 'Drawer is connected to the printer',
                    },
                  ]}
                />
              </FormField>
              <AlertBanner
                tone="info"
                className="mt-5"
                icon={<AlertCircle size={17} />}
              >
                Printer drawers need a driver or local bridge.
              </AlertBanner>
            </SectionCard>
          </div>

          <SectionCard
            title="Customer display"
            description="Show a second customer screen."
            icon={<ShoppingBasket size={20} />}
          >
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <p className="m-0 text-sm font-bold text-text-main">
                  Enable customer-facing display
                </p>
                <p className="mt-1 mb-0 text-xs leading-relaxed text-text-muted">
                  Show basket, payment, and change.
                </p>
              </div>
              <Switch
                checked={settings.customerDisplay}
                onCheckedChange={(checked) =>
                  update('customerDisplay', checked)
                }
                label="Enable customer-facing display"
              />
            </div>
            <div className="mt-6 flex justify-end border-t border-border-subtle pt-5">
              <Button onClick={saveSettings}>
                <Save size={16} />
                Save hardware settings
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
