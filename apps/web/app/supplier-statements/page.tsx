'use client';

import {
  ChangeEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  AlertCircle,
  Building2,
  CheckCircle2,
  FileSpreadsheet,
  Scale,
  Upload,
  WalletCards,
} from 'lucide-react';

import { PageContainer } from '../../components/layout/page-container';
import {
  AlertBanner,
  Button,
  CustomSelect,
  EmptyState,
  FormField,
  PageHeading,
  SectionCard,
  SummaryMetricCard,
} from '../../components/ui/';

const api = '/api';
const requiredHeaders = [
  'transaction_date',
  'reference',
  'description',
  'debit',
  'credit',
  'balance',
] as const;

type MessageTone = 'success' | 'error' | 'warning' | 'info';
type Supplier = { id: string; name: string };
type InvoiceEntry = { amount: number; reference?: string | null };
type SupplierInvoice = {
  supplierId?: string;
  supplier?: { id: string };
  invoiceNumber: string;
  total: number;
  payments?: InvoiceEntry[];
  credits?: InvoiceEntry[];
};
type StatementRow = {
  transaction_date: string;
  reference: string;
  description: string;
  debit: string;
  credit: string;
  balance: string;
};

const money = (value: number) =>
  new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(value);

export default function SupplierStatementsPage() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [invoices, setInvoices] = useState<SupplierInvoice[]>([]);
  const [supplierId, setSupplierId] = useState('');
  const [rows, setRows] = useState<StatementRow[]>([]);
  const [fileName, setFileName] = useState('');
  const [message, setMessage] = useState('Upload a statement CSV.');
  const [messageTone, setMessageTone] = useState<MessageTone>('info');
  const [isLoading, setIsLoading] = useState(true);

  const load = useCallback(async () => {
    setIsLoading(true);
    const token =
      sessionStorage.getItem('pos_access_token') ??
      localStorage.getItem('pos_access_token') ??
      '';
    const headers = { Authorization: `Bearer ${token}` };

    try {
      const [supplierResponse, invoiceResponse] = await Promise.all([
        fetch(`${api}/suppliers`, { headers }),
        fetch(`${api}/supplier-invoices`, { headers }),
      ]);
      if (!supplierResponse.ok || !invoiceResponse.ok) {
        throw new Error('Unable to load supplier account data.');
      }
      setSuppliers(await supplierResponse.json());
      setInvoices(await invoiceResponse.json());
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : 'Unable to load supplier account data.',
      );
      setMessageTone('error');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  function importCsv(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      const lines = String(reader.result).trim().split(/\r?\n/);
      const headers =
        lines
          .shift()
          ?.split(',')
          .map((value) => value.trim()) ?? [];
      const missingHeaders = requiredHeaders.filter(
        (header) => !headers.includes(header),
      );

      if (missingHeaders.length) {
        setRows([]);
        setFileName('');
        setMessage(
          `CSV is missing required columns: ${missingHeaders.join(', ')}.`,
        );
        setMessageTone('error');
        return;
      }

      const parsed = lines
        .filter((line) => line.trim())
        .map(
          (line) =>
            Object.fromEntries(
              line
                .split(',')
                .map((value, index) => [headers[index], value.trim()]),
            ) as StatementRow,
        );

      setRows(parsed);
      setFileName(file.name);
      setMessage(
        `${parsed.length} transaction${parsed.length === 1 ? '' : 's'} imported from ${file.name}.`,
      );
      setMessageTone('success');
    };
    reader.onerror = () => {
      setMessage('The selected CSV could not be read. Please try again.');
      setMessageTone('error');
    };
    reader.readAsText(file);
  }

  const debitTotal = rows.reduce(
    (sum, row) => sum + (Number(row.debit) || 0),
    0,
  );
  const creditTotal = rows.reduce(
    (sum, row) => sum + (Number(row.credit) || 0),
    0,
  );
  const closingBalance = rows.length
    ? Number(rows[rows.length - 1].balance) || 0
    : 0;
  const calculatedBalance = debitTotal - creditTotal;
  const statementVariance = closingBalance - calculatedBalance;

  const supplierInvoices = useMemo(
    () =>
      invoices.filter(
        (invoice) =>
          invoice.supplierId === supplierId ||
          invoice.supplier?.id === supplierId,
      ),
    [invoices, supplierId],
  );
  const systemBalance =
    supplierInvoices.reduce(
      (sum, invoice) =>
        sum +
        invoice.total -
        (invoice.payments ?? []).reduce(
          (paid, payment) => paid + payment.amount,
          0,
        ) -
        (invoice.credits ?? []).reduce(
          (credited, credit) => credited + credit.amount,
          0,
        ),
      0,
    ) / 100;
  const balanceDifference = closingBalance - systemBalance;
  const references = useMemo(
    () =>
      new Set(
        supplierInvoices.flatMap((invoice) =>
          [
            invoice.invoiceNumber,
            ...(invoice.credits ?? []).map((credit) => credit.reference),
            ...(invoice.payments ?? []).map((payment) => payment.reference),
          ].filter((reference): reference is string => Boolean(reference)),
        ),
      ),
    [supplierInvoices],
  );
  const unmatched = rows.filter(
    (row) => row.reference !== 'OPENING' && !references.has(row.reference),
  );
  const selectedSupplier = suppliers.find(
    (supplier) => supplier.id === supplierId,
  );
  const showPageMessage = messageTone !== 'info' || rows.length > 0;

  const alertIcon =
    messageTone === 'success' ? (
      <CheckCircle2 size={17} />
    ) : messageTone === 'error' || messageTone === 'warning' ? (
      <AlertCircle size={17} />
    ) : (
      <FileSpreadsheet size={17} />
    );

  return (
    <main className="app-page">
      <PageHeading eyebrow="Supplier accounts" title="Supplier statements" />

      <div className="py-6">
        <PageContainer className="space-y-6">
          {showPageMessage && (
            <AlertBanner tone={messageTone} icon={alertIcon}>
              {message}
            </AlertBanner>
          )}

          <SectionCard
            title="Import statement"
            description="Upload CSV to reconcile."
            icon={<FileSpreadsheet size={20} />}
          >
            <div className="grid grid-cols-1 items-start gap-x-4 gap-y-4 md:grid-cols-2">
              <FormField
                label="Supplier"
                sublabel="(optional)"
                help="Compare invoices."
              >
                <CustomSelect
                  value={supplierId}
                  onChange={setSupplierId}
                  disabled={isLoading}
                  placeholder={
                    isLoading ? 'Loading suppliers...' : 'Select supplier'
                  }
                  leadingIcon={<Building2 size={16} />}
                  options={suppliers.map((supplier) => ({
                    value: supplier.id,
                    label: supplier.name,
                  }))}
                />
              </FormField>

              <FormField
                label="Statement CSV"
                required
                help="Requires date, reference, debit, credit, balance."
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv,text/csv"
                  onChange={importCsv}
                  className="sr-only"
                  tabIndex={-1}
                />
                <div className="flex min-h-10 flex-col gap-3 rounded-md border border-border-default bg-card p-2 shadow-2xs sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex min-w-0 items-center gap-3">
                    <span className="flex size-8 shrink-0 items-center justify-center rounded-md border border-brand-border bg-brand-subtle text-brand">
                      <FileSpreadsheet size={17} />
                    </span>
                    <div className="min-w-0">
                      <p className="m-0 truncate text-sm font-bold text-text-main">
                        {fileName || 'No CSV selected'}
                      </p>
                      <p className="m-0 mt-0.5 text-xs text-text-muted">
                        Standard UTF-8 CSV
                      </p>
                    </div>
                  </div>
                  <Button
                    variant="secondary"
                    size="sm"
                    className="shrink-0"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <Upload size={16} />
                    {fileName ? 'Replace CSV' : 'Choose CSV'}
                  </Button>
                </div>
              </FormField>
            </div>
          </SectionCard>

          {rows.length > 0 ? (
            <>
              <section className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3">
                <SummaryMetricCard
                  title="Statement balance"
                  value={money(closingBalance)}
                  description={`${rows.length} imported`}
                  icon={<FileSpreadsheet size={20} />}
                  tone="purple"
                />
                <SummaryMetricCard
                  title="System balance"
                  value={supplierId ? money(systemBalance) : '—'}
                  description={
                    selectedSupplier
                      ? selectedSupplier.name
                      : 'Select supplier'
                  }
                  icon={<WalletCards size={20} />}
                  tone="sky"
                />
                <SummaryMetricCard
                  title="Difference"
                  value={supplierId ? money(balanceDifference) : '—'}
                  description={
                    supplierId
                      ? Math.abs(balanceDifference) < 0.005
                        ? 'Balances match'
                        : 'Needs review'
                      : 'No comparison'
                  }
                  icon={<Scale size={20} />}
                  tone={
                    supplierId && Math.abs(balanceDifference) < 0.005
                      ? 'emerald'
                      : 'amber'
                  }
                />
              </section>

              <SectionCard
                title="Statement review"
                description={`${money(debitTotal)} debits · ${money(creditTotal)} credits`}
                icon={<Scale size={20} />}
                bodyPadding={false}
              >
                <div className="space-y-4 px-4 py-6 sm:px-8">
                  {Math.abs(statementVariance) >= 0.005 && (
                    <AlertBanner
                      tone="warning"
                      icon={<AlertCircle size={17} />}
                    >
                      Statement rows differ from the closing balance by{' '}
                      {money(statementVariance)}.
                    </AlertBanner>
                  )}
                  {supplierId ? (
                    <AlertBanner
                      tone={unmatched.length ? 'warning' : 'success'}
                      icon={
                        unmatched.length ? (
                          <AlertCircle size={17} />
                        ) : (
                          <CheckCircle2 size={17} />
                        )
                      }
                    >
                      {unmatched.length
                        ? `${unmatched.length} unmatched reference${unmatched.length === 1 ? '' : 's'}: ${unmatched
                            .map((row) => row.reference || 'No reference')
                            .join(', ')}`
                        : 'All statement references are matched.'}
                    </AlertBanner>
                  ) : (
                    <AlertBanner tone="info" icon={<Building2 size={17} />}>
                      Select a supplier to compare statement references.
                    </AlertBanner>
                  )}
                </div>

                <div className="overflow-x-auto border-t border-border-subtle">
                  <table className="min-w-[780px] w-full border-collapse text-sm">
                    <thead>
                      <tr className="border-b border-border-subtle bg-muted-surface">
                        {[
                          'Date',
                          'Reference',
                          'Description',
                          'Debit',
                          'Credit',
                          'Balance',
                        ].map((heading, index) => (
                          <th
                            key={heading}
                            className={`px-4 py-3 text-xs font-bold uppercase tracking-wider text-text-secondary sm:px-8 ${index > 2 ? 'text-right' : 'text-left'}`}
                          >
                            {heading}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((row, index) => (
                        <tr
                          key={`${row.reference}-${index}`}
                          className="border-b border-border-subtle transition-colors last:border-b-0 hover:bg-muted-surface/60"
                        >
                          <td className="whitespace-nowrap px-4 py-3 text-text-secondary sm:px-8">
                            {row.transaction_date || '—'}
                          </td>
                          <td className="whitespace-nowrap px-4 py-3 font-mono text-xs font-semibold text-text-secondary sm:px-8">
                            {row.reference || '—'}
                          </td>
                          <td className="px-4 py-3 font-semibold text-text-main sm:px-8">
                            {row.description || '—'}
                          </td>
                          <td className="whitespace-nowrap px-4 py-3 text-right tabular-nums text-text-secondary sm:px-8">
                            {row.debit ? money(Number(row.debit) || 0) : '—'}
                          </td>
                          <td className="whitespace-nowrap px-4 py-3 text-right tabular-nums text-text-secondary sm:px-8">
                            {row.credit ? money(Number(row.credit) || 0) : '—'}
                          </td>
                          <td className="whitespace-nowrap px-4 py-3 text-right font-bold tabular-nums text-text-main sm:px-8">
                            {money(Number(row.balance) || 0)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </SectionCard>
            </>
          ) : (
            <SectionCard
              title="Statement review"
              description="Import CSV to review."
              icon={<FileSpreadsheet size={20} />}
              bodyPadding={false}
            >
              <EmptyState
                title="No statement imported"
                description="Choose a CSV."
                icon={<FileSpreadsheet size={24} />}
                className="min-h-40"
              />
            </SectionCard>
          )}
        </PageContainer>
      </div>
    </main>
  );
}
