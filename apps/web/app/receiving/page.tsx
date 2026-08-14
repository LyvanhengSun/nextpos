'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import {
  Calendar,
  ChevronLeft,
  ChevronRight,
  PackageCheck,
  Plus,
  Search,
  Truck,
  Users,
} from 'lucide-react';
import {
  AlertBanner,
  Button,
  CustomSelect,
  EmptyState,
  FormField,
  Input,
  PageHeading,
  SectionCard,
} from '../../components/ui/';
import { PageContainer } from '../../components/layout/page-container';

const api = '/api';
type Product = {
  id: string;
  name: string;
  sku: string;
  variants: { id: string; name: string; sku: string }[];
};
type Supplier = { id: string; name: string; phone: string | null };
type Receipt = {
  id: string;
  quantity: number;
  unitCost: number | null;
  reference: string | null;
  note: string | null;
  createdAt: string;
  branch: { name: string };
  supplier: { name: string } | null;
  product: { name: string; sku: string };
  variant: { name: string; sku: string } | null;
};

function TablePager({
  total,
  page,
  pageSize,
  onPageChange,
  onPageSizeChange,
}: {
  total: number;
  page: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (pageSize: number) => void;
}) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const start = total ? (page - 1) * pageSize + 1 : 0;
  const end = Math.min(page * pageSize, total);
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border-subtle px-4 py-3 sm:px-8">
      <span className="text-xs text-text-muted">
        Showing{' '}
        <strong className="font-bold text-text-secondary">
          {start}–{end}
        </strong>{' '}
        of <strong className="font-bold text-text-secondary">{total}</strong>
      </span>
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-2 text-xs text-text-muted">
          <span>Rows</span>
          <CustomSelect
            value={String(pageSize)}
            onChange={(value) => onPageSizeChange(Number(value))}
            options={['10', '25', '50'].map((value) => ({
              value,
              label: value,
            }))}
            className="w-18"
          />
        </div>
        <span className="text-xs text-text-muted">
          Page {page} of {totalPages}
        </span>
        <Button
          aria-label="Previous page"
          disabled={page === 1}
          onClick={() => onPageChange(page - 1)}
          variant="secondary"
          size="icon"
          className="size-8 shrink-0"
        >
          <ChevronLeft size={16} />
        </Button>
        <Button
          aria-label="Next page"
          disabled={page === totalPages}
          onClick={() => onPageChange(page + 1)}
          variant="secondary"
          size="icon"
          className="size-8 shrink-0"
        >
          <ChevronRight size={16} />
        </Button>
      </div>
    </div>
  );
}

export default function ReceivingPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [receipts, setReceipts] = useState<Receipt[]>([]);
  const [message, setMessage] = useState('');
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [showSupplierForm, setShowSupplierForm] = useState(false);
  const [supplierId, setSupplierId] = useState('');
  const [stockTarget, setStockTarget] = useState('');
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
  async function load() {
    const [productResponse, supplierResponse, receiptResponse] =
      await Promise.all([
        fetch(`${api}/products`, { headers }),
        fetch(`${api}/suppliers`, { headers }),
        fetch(`${api}/inventory/receipts`, { headers }),
      ]);
    if (!productResponse.ok || !supplierResponse.ok || !receiptResponse.ok)
      throw new Error('Please sign in again.');
    setProducts(await productResponse.json());
    setSuppliers(await supplierResponse.json());
    setReceipts(await receiptResponse.json());
  }
  useEffect(() => {
    void load().catch((error: Error) => setMessage(error.message));
  }, []);
  async function createSupplier(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    try {
      const response = await fetch(`${api}/suppliers`, {
        method: 'POST',
        headers,
        body: JSON.stringify(Object.fromEntries(new FormData(formElement))),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        setMessage(data.message ?? 'Unable to create supplier.');
        return;
      }
      formElement.reset();
      setShowSupplierForm(false);
      setMessage(`${data.name} was added to suppliers.`);
      await load();
    } catch {
      setMessage('The API server did not return a response.');
    }
  }
  async function receive(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = Object.fromEntries(new FormData(formElement));
    const target = String(form.stockTarget ?? '').split(':');
    const payload = {
      ...form,
      productId: target[1],
      ...(target[0] === 'v' ? { variantId: target[2] } : {}),
      supplierId: form.supplierId || undefined,
      quantity: Number(form.quantity),
      ...(form.unitCost
        ? { unitCost: Math.round(Number(form.unitCost) * 100) }
        : {}),
    };
    try {
      const response = await fetch(`${api}/inventory/receipts`, {
        method: 'POST',
        headers,
        body: JSON.stringify(payload),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        setMessage(data.message ?? 'Unable to receive stock.');
        return;
      }
      formElement.reset();
      setSupplierId('');
      setStockTarget('');
      setMessage(
        'Delivery received. Branch stock and cost history were updated.',
      );
      await load();
    } catch {
      setMessage(
        'The API server did not return a response. Confirm it is running, then try again.',
      );
    }
  }
  const receiptResults = useMemo(
    () =>
      receipts.filter((receipt) =>
        `${receipt.product.name} ${receipt.variant?.name ?? ''} ${receipt.product.sku} ${receipt.variant?.sku ?? ''} ${receipt.supplier?.name ?? ''} ${receipt.reference ?? ''}`
          .toLowerCase()
          .includes(query.toLowerCase()),
      ),
    [receipts, query],
  );
  const visibleReceipts = receiptResults.slice(
    (page - 1) * pageSize,
    page * pageSize,
  );
  const stockOptions = products.flatMap((product) =>
    product.variants.length
      ? product.variants.map((variant) => ({
          value: `v:${product.id}:${variant.id}`,
          label: `${product.name} — ${variant.name}`,
          sublabel: variant.sku,
        }))
      : [
          {
            value: `p:${product.id}`,
            label: product.name,
            sublabel: product.sku,
          },
        ],
  );
  const supplierOptions = [
    { value: '', label: 'Unknown / no supplier' },
    ...suppliers.map((supplier) => ({
      value: supplier.id,
      label: supplier.name,
      sublabel: supplier.phone ?? undefined,
    })),
  ];

  return (
    <main className="app-page">
      <PageHeading
        eyebrow="Inventory"
        title="Stock receiving"
        className="page-heading-full-bleed"
      />

      <PageContainer>
        {message && <AlertBanner tone="success">{message}</AlertBanner>}

        <section className="mb-6 grid grid-cols-1 items-start gap-5 xl:grid-cols-[minmax(0,1.65fr)_minmax(270px,1fr)]">
          <SectionCard
            title="Receive delivery"
            description="Add the exact product or variant delivered by your supplier."
            icon={<Truck size={20} />}
            className="h-full"
          >
            <form
              onSubmit={receive}
              autoComplete="off"
              className="grid grid-cols-1 items-start gap-x-4 gap-y-4 md:grid-cols-2"
            >
              <FormField label="Supplier" id="supplierId">
                <CustomSelect
                  name="supplierId"
                  value={supplierId}
                  onChange={setSupplierId}
                  options={supplierOptions}
                />
              </FormField>
              <FormField
                label="Product or exact variant"
                id="stockTarget"
                required
              >
                <CustomSelect
                  name="stockTarget"
                  value={stockTarget}
                  onChange={setStockTarget}
                  options={stockOptions}
                  placeholder="Select product or variant"
                />
              </FormField>
              <FormField label="Quantity received" id="quantity" required>
                <Input
                  required
                  id="quantity"
                  name="quantity"
                  min="1"
                  step="1"
                  type="number"
                  placeholder="e.g. 50"
                />
              </FormField>
              <FormField
                label="Unit cost (USD)"
                id="unitCost"
                sublabel="(optional)"
              >
                <Input
                  id="unitCost"
                  name="unitCost"
                  min="0"
                  step="0.01"
                  type="number"
                  prefixText="$"
                  placeholder="e.g. 1.25"
                />
              </FormField>
              <FormField
                label="Supplier invoice / reference"
                id="reference"
                sublabel="(optional)"
                className="md:col-span-2"
              >
                <Input
                  id="reference"
                  name="reference"
                  placeholder="e.g. INV-2026-001"
                />
              </FormField>
              <FormField
                label="Note"
                id="note"
                sublabel="(optional)"
                className="md:col-span-2"
              >
                <Input
                  id="note"
                  name="note"
                  placeholder="e.g. Morning delivery"
                />
              </FormField>
              <div className="flex justify-end md:col-span-2">
                <Button type="submit">
                  <PackageCheck size={16} /> Receive stock
                </Button>
              </div>
            </form>
          </SectionCard>

          <SectionCard
            title="Suppliers"
            description={`${suppliers.length} available`}
            actions={
              <Button
                variant="secondary"
                size="icon"
                aria-label="Add supplier"
                onClick={() => setShowSupplierForm((current) => !current)}
              >
                <Plus size={18} />
              </Button>
            }
            className="h-full"
          >
            {showSupplierForm ? (
              <form
                onSubmit={createSupplier}
                autoComplete="off"
                className="flex flex-col gap-4"
              >
                <FormField label="Supplier name" id="supplierName" required>
                  <Input
                    required
                    id="supplierName"
                    name="name"
                    placeholder="Coffee supplier"
                  />
                </FormField>
                <FormField
                  label="Phone"
                  id="supplierPhone"
                  sublabel="(optional)"
                >
                  <Input id="supplierPhone" name="phone" />
                </FormField>
                <FormField
                  label="Email"
                  id="supplierEmail"
                  sublabel="(optional)"
                >
                  <Input id="supplierEmail" name="email" type="email" />
                </FormField>
                <FormField
                  label="Address"
                  id="supplierAddress"
                  sublabel="(optional)"
                >
                  <Input id="supplierAddress" name="address" />
                </FormField>
                <div className="flex justify-end gap-2">
                  <Button
                    variant="secondary"
                    onClick={() => setShowSupplierForm(false)}
                  >
                    Cancel
                  </Button>
                  <Button type="submit">Add supplier</Button>
                </div>
              </form>
            ) : suppliers.length ? (
              <ul className="m-0 list-none divide-y divide-border-subtle p-0">
                {suppliers.slice(0, 6).map((supplier) => (
                  <li
                    key={supplier.id}
                    className="flex items-center justify-between gap-3 py-3 first:pt-0 last:pb-0"
                  >
                    <span className="text-sm font-bold text-text-main">
                      {supplier.name}
                    </span>
                    <span className="text-xs text-text-muted">
                      {supplier.phone ?? '—'}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState
                title="No suppliers yet"
                description="Add a supplier to record deliveries."
                icon={<Users size={24} />}
              />
            )}
          </SectionCard>
        </section>

        <SectionCard
          title="Recent deliveries"
          description={`${receiptResults.length} of ${receipts.length} delivery record${receipts.length === 1 ? '' : 's'}.`}
          bodyPadding={false}
        >
          <div className="border-b border-border-subtle px-4 py-4 sm:px-8">
            <Input
              value={query}
              onChange={(event) => {
                setQuery(event.target.value);
                setPage(1);
              }}
              placeholder="Search product, supplier, or reference"
              prefixIcon={<Search size={16} />}
              className="max-w-md"
            />
          </div>
          {visibleReceipts.length ? (
            <>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[760px] border-collapse text-sm">
                  <thead className="border-b border-border-subtle bg-muted-surface">
                    <tr>
                      {[
                        'Received',
                        'Product',
                        'Supplier',
                        'Quantity',
                        'Unit cost',
                        'Reference',
                      ].map((heading) => (
                        <th
                          key={heading}
                          className={`px-4 py-3 text-xs font-bold uppercase tracking-wider text-text-secondary ${heading === 'Quantity' || heading === 'Unit cost' ? 'text-right' : 'text-left'}`}
                        >
                          {heading}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {visibleReceipts.map((receipt) => (
                      <tr
                        key={receipt.id}
                        className="border-b border-border-subtle last:border-b-0 hover:bg-muted-surface"
                      >
                        <td className="whitespace-nowrap px-4 py-3 text-xs text-text-muted">
                          {new Date(receipt.createdAt).toLocaleString(
                            undefined,
                            {
                              dateStyle: 'medium',
                              timeStyle: 'short',
                            },
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <p className="m-0 text-sm font-bold text-text-main">
                            {receipt.product.name}
                            {receipt.variant && (
                              <span className="font-medium text-text-muted">
                                {' '}
                                · {receipt.variant.name}
                              </span>
                            )}
                          </p>
                          <p className="mt-1 mb-0 font-mono text-xs text-text-muted">
                            {receipt.variant?.sku ?? receipt.product.sku}
                          </p>
                        </td>
                        <td className="px-4 py-3 text-sm text-text-secondary">
                          {receipt.supplier?.name ?? '—'}
                        </td>
                        <td className="px-4 py-3 text-right text-sm font-extrabold text-emerald-700">
                          +{receipt.quantity}
                        </td>
                        <td className="px-4 py-3 text-right text-sm text-text-secondary">
                          {receipt.unitCost === null
                            ? '—'
                            : `$${(receipt.unitCost / 100).toFixed(2)}`}
                        </td>
                        <td className="px-4 py-3 text-sm text-text-muted">
                          {receipt.reference ?? receipt.note ?? '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <TablePager
                total={receiptResults.length}
                page={page}
                pageSize={pageSize}
                onPageChange={setPage}
                onPageSizeChange={(size) => {
                  setPageSize(size);
                  setPage(1);
                }}
              />
            </>
          ) : (
            <EmptyState
              title="No deliveries found"
              description="Try a different product, supplier, or reference."
              icon={<Calendar size={24} />}
            />
          )}
        </SectionCard>
      </PageContainer>
    </main>
  );
}
