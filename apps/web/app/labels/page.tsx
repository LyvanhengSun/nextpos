'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  Barcode as BarcodeIcon,
  CheckCircle2,
  Layers3,
  PackageSearch,
  Printer,
  SlidersHorizontal,
  Tag,
} from 'lucide-react';

import { PageContainer } from '../../components/layout/page-container';
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

const api = '/api';
type ModifierOption = { id: string; name: string; priceAdjustment: number };
type ModifierGroup = {
  id: string;
  name: string;
  maxSelections: number;
  options: ModifierOption[];
};
type Product = {
  id: string;
  name: string;
  sku: string;
  barcode: string | null;
  price: number;
  modifierGroups: ModifierGroup[];
  variants: {
    id: string;
    name: string;
    sku: string;
    barcode: string | null;
    price: number | null;
    isActive: boolean;
  }[];
};

const patterns: Record<string, string> = {
  '0': 'nnnwwnwnn',
  '1': 'wnnwnnnnw',
  '2': 'nnwwnnnnw',
  '3': 'wnwwnnnnn',
  '4': 'nnnwwnnnw',
  '5': 'wnwwwnnnn',
  '6': 'nnwwwnnnn',
  '7': 'nnnwnnwnw',
  '8': 'wnnwnnwnn',
  '9': 'nnwwnnwnn',
  A: 'wnnnnwnnw',
  B: 'nnwnnwnnw',
  C: 'wnwnnwnnn',
  D: 'nnnnwwnnw',
  E: 'wnnnwwnnn',
  F: 'nnwnwwnnn',
  G: 'nnnnnwwnw',
  H: 'wnnnnwwnn',
  I: 'nnwnnwwnn',
  J: 'nnnnwwwnn',
  K: 'wnnnnnnww',
  L: 'nnwnnnnww',
  M: 'wnwnnnnwn',
  N: 'nnnnwnnww',
  O: 'wnnnwnnwn',
  P: 'nnwnwnnwn',
  Q: 'nnnnnnwww',
  R: 'wnnnnnwwn',
  S: 'nnwnnnwwn',
  T: 'nnnnwnwwn',
  U: 'wwnnnnnnw',
  V: 'nwwnnnnnw',
  W: 'wwwnnnnnn',
  X: 'nwnnwnnnw',
  Y: 'wwnnwnnnn',
  Z: 'nwwnwnnnn',
  '-': 'nwnnnnwnw',
  '.': 'wwnnnnwnn',
  ' ': 'nwwnnnwnn',
  $: 'nwnwnwnnn',
  '/': 'nwnwnnnwn',
  '+': 'nwnnnwnwn',
  '%': 'nnnwnwnwn',
  '*': 'nwnnwnwnn',
};

function Barcode({ value }: { value: string }) {
  const safe = value.toUpperCase().replace(/[^0-9A-Z. \-$/+%]/g, '-');
  const text = `*${safe}*`;
  const bars: { x: number; width: number }[] = [];
  let x = 8;
  for (const character of text) {
    for (let index = 0; index < 9; index += 1) {
      const width = patterns[character][index] === 'w' ? 3 : 1;
      if (index % 2 === 0) bars.push({ x, width });
      x += width;
    }
    x += 1;
  }
  return (
    <svg
      className="h-16 w-full fill-text-main"
      viewBox={`0 0 ${x + 8} 52`}
      role="img"
      aria-label={`Barcode ${safe}`}
    >
      {bars.map((bar, index) => (
        <rect key={index} x={bar.x} y="0" width={bar.width} height="44" />
      ))}
      <text
        x={(x + 8) / 2}
        y="51"
        textAnchor="middle"
        className="font-sans text-[8px] tracking-[1px]"
      >
        {safe}
      </text>
    </svg>
  );
}

export default function LabelsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [productId, setProductId] = useState('');
  const [variantId, setVariantId] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [optionIds, setOptionIds] = useState<string[]>([]);
  const [message, setMessage] = useState('');
  const [messageTone, setMessageTone] = useState<'success' | 'error'>(
    'success',
  );
  const [isLoading, setIsLoading] = useState(true);

  const load = useCallback(async () => {
    setIsLoading(true);
    const token =
      sessionStorage.getItem('pos_access_token') ??
      localStorage.getItem('pos_access_token') ??
      '';
    try {
      const response = await fetch(`${api}/products`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.ok)
        throw new Error('Unable to load products. Please sign in again.');
      setProducts(await response.json());
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : 'Unable to load products.',
      );
      setMessageTone('error');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const product = products.find((item) => item.id === productId);
  const activeVariants =
    product?.variants.filter((item) => item.isActive) ?? [];
  const variant = activeVariants.find((item) => item.id === variantId);
  const code =
    variant?.barcode || variant?.sku || product?.barcode || product?.sku || '';
  const selectedOptions =
    product?.modifierGroups
      .flatMap((group) => group.options)
      .filter((option) => optionIds.includes(option.id)) ?? [];
  const finalPrice =
    (variant?.price ?? product?.price ?? 0) +
    selectedOptions.reduce(
      (total, option) => total + option.priceAdjustment,
      0,
    );
  const requiresVariant = activeVariants.length > 0;
  const canPrint = Boolean(product && code && (!requiresVariant || variant));

  function chooseProduct(id: string) {
    setProductId(id);
    setVariantId('');
    setOptionIds([]);
    setMessage('');
  }

  function toggleOption(group: ModifierGroup, optionId: string) {
    setOptionIds((current) => {
      if (current.includes(optionId)) {
        return current.filter((id) => id !== optionId);
      }
      const chosen = group.options.filter((option) =>
        current.includes(option.id),
      );
      if (chosen.length >= group.maxSelections) {
        return [
          ...current.filter(
            (id) => !group.options.some((option) => option.id === id),
          ),
          optionId,
        ];
      }
      return [...current, optionId];
    });
  }

  function printLabels() {
    if (!canPrint) return;
    setMessage(`${quantity} label${quantity === 1 ? '' : 's'} ready to print.`);
    setMessageTone('success');
    window.print();
  }

  const labels = useMemo(
    () => Array.from({ length: Math.min(Math.max(quantity, 1), 100) }),
    [quantity],
  );
  const codeSource = variant
    ? variant.barcode
      ? 'Variant barcode'
      : 'Variant SKU'
    : product?.barcode
      ? 'Product barcode'
      : 'Product SKU';

  return (
    <main className="app-page">
      <PageHeading
        eyebrow="Barcode labels"
        title="Print labels"
        className="print-hide"
        actions={
          <Button onClick={printLabels} disabled={!canPrint}>
            <Printer size={16} />
            Print {quantity} label{quantity === 1 ? '' : 's'}
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

          <SectionCard
            title="Label setup"
            description="Choose item and quantity."
            icon={<BarcodeIcon size={20} />}
          >
            <div className="grid grid-cols-1 items-start gap-x-4 gap-y-4 md:grid-cols-2">
              <FormField
                label="Product"
                required
                help="Barcode first, then SKU."
              >
                <CustomSelect
                  value={productId}
                  onChange={chooseProduct}
                  disabled={isLoading}
                  placeholder={
                    isLoading ? 'Loading products...' : 'Select product'
                  }
                  leadingIcon={<PackageSearch size={16} />}
                  options={products.map((item) => ({
                    value: item.id,
                    label: item.name,
                    sublabel: item.barcode || item.sku,
                  }))}
                />
              </FormField>

              {requiresVariant ? (
                <FormField
                  label="Exact variant"
                  required
                  help="Uses variant code."
                >
                  <CustomSelect
                    value={variantId}
                    onChange={setVariantId}
                    placeholder="Select variant"
                    leadingIcon={<Layers3 size={16} />}
                    options={activeVariants.map((item) => ({
                      value: item.id,
                      label: item.name,
                      sublabel: item.barcode || item.sku,
                    }))}
                  />
                </FormField>
              ) : (
                <FormField
                  label="Barcode source"
                  help="Barcode first, then SKU."
                >
                  <div className="flex h-10 items-center gap-2 rounded-md border border-border-default bg-muted-surface px-3 text-sm font-semibold text-text-secondary shadow-2xs">
                    <BarcodeIcon size={16} className="text-text-muted" />
                    {product
                      ? `${codeSource}: ${code || 'Unavailable'}`
                      : 'Select a product first'}
                  </div>
                </FormField>
              )}

              <FormField
                label="Number of labels"
                required
                help="Print 1–100."
                id="label-quantity"
              >
                <Input
                  id="label-quantity"
                  type="number"
                  min="1"
                  max="100"
                  value={quantity}
                  onChange={(event) =>
                    setQuantity(
                      Math.min(
                        100,
                        Math.max(1, Number(event.target.value) || 1),
                      ),
                    )
                  }
                  prefixIcon={<Tag size={16} />}
                />
              </FormField>

              {product && (
                <FormField label="Current label" sublabel="Preview">
                  <div className="flex min-h-10 items-center justify-between gap-3 rounded-md border border-border-default bg-muted-surface px-3 py-2 text-sm">
                    <span className="min-w-0 truncate font-semibold text-text-main">
                      {product.name}
                      {variant ? ` — ${variant.name}` : ''}
                    </span>
                    <strong className="shrink-0 text-brand">
                      ${(finalPrice / 100).toFixed(2)}
                    </strong>
                  </div>
                </FormField>
              )}
            </div>

            {product?.modifierGroups.length ? (
              <div className="mt-5 space-y-4 border-t border-border-subtle pt-5">
                <div>
                  <h3 className="m-0 flex items-center gap-2 text-sm font-bold text-text-main">
                    <SlidersHorizontal size={17} className="text-brand" />
                    Label options
                  </h3>
                  <p className="mt-1 mb-0 text-xs text-text-muted">
                    Adds option text.
                  </p>
                </div>
                {product.modifierGroups.map((group) => (
                  <fieldset
                    key={group.id}
                    className="rounded-lg border border-border-subtle bg-muted-surface p-5"
                  >
                    <legend className="px-2 text-xs font-bold uppercase tracking-wider text-text-secondary">
                      {group.name} · up to {group.maxSelections}
                    </legend>
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                      {group.options.map((option) => {
                        const selected = optionIds.includes(option.id);
                        return (
                          <Button
                            key={option.id}
                            variant={selected ? 'brandSubtle' : 'secondary'}
                            onClick={() => toggleOption(group, option.id)}
                            aria-pressed={selected}
                            className="h-auto min-h-14 justify-between px-3 py-2.5 text-left"
                          >
                            <span className="min-w-0 truncate">
                              {option.name}
                            </span>
                            <span className="shrink-0 text-xs font-semibold text-text-muted">
                              {option.priceAdjustment
                                ? `+$${(option.priceAdjustment / 100).toFixed(2)}`
                                : 'Included'}
                            </span>
                          </Button>
                        );
                      })}
                    </div>
                  </fieldset>
                ))}
              </div>
            ) : null}

            <div className="mt-5 flex flex-col gap-3 border-t border-border-subtle pt-5 sm:flex-row sm:items-center sm:justify-between">
              <p className="m-0 text-xs text-text-muted">
                {canPrint
                  ? `${codeSource}: ${code}`
                  : requiresVariant
                    ? 'Select a variant to print.'
                    : product
                      ? 'Add barcode or SKU before printing.'
                      : 'Select a product.'}
              </p>
              <Button
                onClick={printLabels}
                disabled={!canPrint}
                className="shrink-0"
              >
                <Printer size={16} />
                Print labels
              </Button>
            </div>
          </SectionCard>
        </PageContainer>
      </div>

      <section id="barcode-label-preview" className="pb-6">
        <PageContainer>
          <SectionCard
            title="Label preview"
            description={
              product
                ? `${quantity} label${quantity === 1 ? '' : 's'} · ${product.name}`
                : 'Select product.'
            }
            icon={<Printer size={20} />}
            bodyPadding={false}
          >
            {product && (!requiresVariant || variant) && code ? (
              <div className="label-sheet grid grid-cols-[repeat(auto-fill,minmax(190px,1fr))] gap-3 px-4 py-6 sm:px-8">
                {labels.map((_, index) => (
                  <article
                    className="barcode-label grid gap-2 rounded-md border border-dashed border-border-default bg-card p-3 text-center"
                    key={index}
                  >
                    <strong className="text-sm text-text-main">
                      {product.name}
                      {variant ? ` — ${variant.name}` : ''}
                      {selectedOptions.length
                        ? ` — ${selectedOptions.map((option) => option.name).join(', ')}`
                        : ''}
                    </strong>
                    <Barcode value={code} />
                    <small className="text-xs text-text-muted">
                      {variant?.sku || product.sku} · $
                      {(finalPrice / 100).toFixed(2)}
                    </small>
                  </article>
                ))}
              </div>
            ) : (
              <EmptyState
                icon={<BarcodeIcon size={24} />}
                title={
                  requiresVariant && product
                    ? 'Select a variant'
                    : 'No label preview yet'
                }
                description={
                  requiresVariant && product
                    ? 'Choose a variant.'
                    : 'Choose product with code.'
                }
                className="min-h-40"
              />
            )}
          </SectionCard>
        </PageContainer>
      </section>
    </main>
  );
}
