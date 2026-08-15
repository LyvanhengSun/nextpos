'use client';

import {
  FormEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  AlertCircle,
  BadgeDollarSign,
  CalendarDays,
  CheckCircle2,
  CircleDollarSign,
  Gift,
  Percent,
  Plus,
  Settings2,
  Sparkles,
  Tag,
  Target,
  X,
} from 'lucide-react';

import { PageContainer } from '../../components/layout/page-container';
import {
  AlertBanner,
  Button,
  CustomSelect,
  DatePicker,
  EmptyState,
  FormField,
  Input,
  Modal,
  PageHeading,
  SectionCard,
  StatusBadge,
  SummaryMetricCard,
} from '../../components/ui/';

const api = '/api';

type PromotionType = 'PERCENT' | 'FIXED' | 'BUY_X_GET_Y';
type PromotionScope = 'ORDER' | 'CATEGORY' | 'PRODUCT';
type PromotionTemplate = 'custom' | 'percent' | 'fixed' | 'bogo';
type Promotion = {
  id: string;
  name: string;
  type: PromotionType;
  value: number;
  minimumSpend: number;
  productId: string | null;
  categoryId: string | null;
  buyQuantity: number;
  rewardQuantity: number;
  startsAt: string | null;
  endsAt: string | null;
  isActive: boolean;
};
type Product = { id: string; name: string; categoryId: string | null };
type Category = { id: string; name: string };

const templateOptions = [
  {
    key: 'percent' as const,
    label: 'Percentage off',
    description: 'Discount by percent.',
    icon: Percent,
  },
  {
    key: 'fixed' as const,
    label: 'Fixed discount',
    description: 'Subtract a set amount.',
    icon: BadgeDollarSign,
  },
  {
    key: 'bogo' as const,
    label: 'Buy X, get Y',
    description: 'Free items after a quantity.',
    icon: Gift,
  },
  {
    key: 'custom' as const,
    label: 'Custom rule',
    description: 'Choose type and scope.',
    icon: Settings2,
  },
];

function authHeaders() {
  const token =
    typeof window === 'undefined'
      ? ''
      : (sessionStorage.getItem('pos_access_token') ??
        localStorage.getItem('pos_access_token') ??
        '');
  return {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  };
}

function formatDate(value: string | null) {
  if (!value) return null;
  return new Intl.DateTimeFormat(undefined, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(new Date(value));
}

export default function PromotionsPage() {
  const formRef = useRef<HTMLFormElement>(null);
  const [items, setItems] = useState<Promotion[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [message, setMessage] = useState('');
  const [messageTone, setMessageTone] = useState<'success' | 'error'>(
    'success',
  );
  const [type, setType] = useState<PromotionType>('PERCENT');
  const [scope, setScope] = useState<PromotionScope>('ORDER');
  const [template, setTemplate] = useState<PromotionTemplate>('custom');
  const [productId, setProductId] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [startsAt, setStartsAt] = useState('');
  const [endsAt, setEndsAt] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [canRetryLoad, setCanRetryLoad] = useState(false);
  const [togglingId, setTogglingId] = useState('');

  const notify = (text: string, tone: 'success' | 'error' = 'success') => {
    setMessage(text);
    setMessageTone(tone);
  };

  const load = useCallback(async () => {
    setIsLoading(true);
    setCanRetryLoad(false);
    try {
      const headers = authHeaders();
      const [promotionResponse, productResponse, categoryResponse] =
        await Promise.all([
          fetch(`${api}/promotions`, { headers }),
          fetch(`${api}/products`, { headers }),
          fetch(`${api}/products/categories`, { headers }),
        ]);

      if (
        !promotionResponse.ok ||
        !productResponse.ok ||
        !categoryResponse.ok
      ) {
        throw new Error('Unable to load promotion data. Please sign in again.');
      }

      const [promotionList, productList, categoryList] = await Promise.all([
        promotionResponse.json() as Promise<Promotion[]>,
        productResponse.json() as Promise<Product[]>,
        categoryResponse.json() as Promise<Category[]>,
      ]);
      setItems(promotionList);
      setProducts(productList);
      setCategories(categoryList);
    } catch (error) {
      setCanRetryLoad(true);
      notify(
        error instanceof Error
          ? error.message
          : 'Unable to load promotion data.',
        'error',
      );
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const promotionValue = Number(form.get('value'));
    setIsSaving(true);
    setCanRetryLoad(false);

    try {
      const response = await fetch(`${api}/promotions`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({
          name: form.get('name'),
          type,
          value: type === 'BUY_X_GET_Y' ? 0 : Math.round(promotionValue * 100),
          minimumSpend: Math.round(Number(form.get('minimumSpend') || 0) * 100),
          ...(scope === 'PRODUCT' || type === 'BUY_X_GET_Y'
            ? { productId: form.get('productId') }
            : {}),
          ...(scope === 'CATEGORY' && type !== 'BUY_X_GET_Y'
            ? { categoryId: form.get('categoryId') }
            : {}),
          ...(type === 'BUY_X_GET_Y'
            ? {
                buyQuantity: Number(form.get('buyQuantity')),
                rewardQuantity: Number(form.get('rewardQuantity')),
              }
            : {}),
          startsAt: form.get('startsAt') || undefined,
          endsAt: form.get('endsAt') || undefined,
        }),
      });
      const data = (await response.json().catch(() => ({}))) as {
        message?: string;
      };
      if (!response.ok) {
        throw new Error(data.message ?? 'Unable to save promotion.');
      }

      formRef.current?.reset();
      setType('PERCENT');
      setScope('ORDER');
      setTemplate('custom');
      setProductId('');
      setCategoryId('');
      setStartsAt('');
      setEndsAt('');
      setIsCreateOpen(false);
      notify('Promotion saved and ready to apply at checkout.');
      await load();
    } catch (error) {
      notify(
        error instanceof Error ? error.message : 'Unable to save promotion.',
        'error',
      );
    } finally {
      setIsSaving(false);
    }
  }

  async function toggle(item: Promotion) {
    setTogglingId(item.id);
    setCanRetryLoad(false);
    try {
      const response = await fetch(`${api}/promotions/${item.id}/toggle`, {
        method: 'POST',
        headers: authHeaders(),
      });
      if (!response.ok) throw new Error('Unable to update promotion.');
      notify(`${item.name} ${item.isActive ? 'deactivated' : 'activated'}.`);
      await load();
    } catch (error) {
      notify(
        error instanceof Error ? error.message : 'Unable to update promotion.',
        'error',
      );
    } finally {
      setTogglingId('');
    }
  }

  function chooseTemplate(next: PromotionTemplate) {
    setTemplate(next);
    if (next === 'percent') {
      setType('PERCENT');
      setScope('ORDER');
    } else if (next === 'fixed') {
      setType('FIXED');
      setScope('ORDER');
    } else if (next === 'bogo') {
      setType('BUY_X_GET_Y');
      setScope('PRODUCT');
    }
    setProductId('');
    setCategoryId('');
  }

  const now = Date.now();
  const activeCount = items.filter(
    (item) =>
      item.isActive &&
      (!item.startsAt || new Date(item.startsAt).getTime() <= now) &&
      (!item.endsAt || new Date(item.endsAt).getTime() >= now),
  ).length;
  const scheduledCount = items.filter(
    (item) =>
      item.isActive && item.startsAt && new Date(item.startsAt).getTime() > now,
  ).length;
  const targetedCount = items.filter(
    (item) => item.productId || item.categoryId,
  ).length;
  const productNames = useMemo(
    () => new Map(products.map((product) => [product.id, product.name])),
    [products],
  );
  const categoryNames = useMemo(
    () => new Map(categories.map((category) => [category.id, category.name])),
    [categories],
  );

  function promotionOffer(item: Promotion) {
    if (item.type === 'BUY_X_GET_Y') {
      return `Buy ${item.buyQuantity}, get ${item.rewardQuantity} free`;
    }
    if (item.type === 'PERCENT') {
      return `${Number((item.value / 100).toFixed(2))}% off`;
    }
    return `$${(item.value / 100).toFixed(2)} off`;
  }

  function promotionScope(item: Promotion) {
    if (item.productId)
      return productNames.get(item.productId) ?? 'Selected product';
    if (item.categoryId)
      return categoryNames.get(item.categoryId) ?? 'Selected category';
    return 'Entire order';
  }

  function promotionStatus(item: Promotion) {
    const now = new Date();
    if (!item.isActive)
      return {
        label: 'Inactive',
        tone: 'neutral' as const,
      };
    if (item.endsAt && new Date(item.endsAt) < now)
      return { label: 'Expired', tone: 'danger' as const };
    if (item.startsAt && new Date(item.startsAt) > now)
      return { label: 'Scheduled', tone: 'warning' as const };
    return { label: 'Active', tone: 'success' as const };
  }

  return (
    <main className="app-page">
      <PageHeading
        eyebrow="Sales promotions"
        title="Promotions"
        actions={
          <Button onClick={() => setIsCreateOpen(true)}>
            <Plus size={16} />
            New promotion
          </Button>
        }
      />

      <div>
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
              action={
                messageTone === 'error' && canRetryLoad ? (
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => void load()}
                  >
                    Retry
                  </Button>
                ) : (
                  <Button
                    variant="ghost"
                    size="bareIcon"
                    onClick={() => setMessage('')}
                    aria-label="Dismiss message"
                    className="text-inherit hover:bg-transparent"
                  >
                    <X size={16} />
                  </Button>
                )
              }
            >
              {message}
            </AlertBanner>
          )}

          <section
            className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3"
            aria-label="Promotion summary"
          >
            <SummaryMetricCard
              title="Active offers"
              value={activeCount}
              description={`${items.length} total`}
              icon={<Sparkles size={20} />}
              tone="emerald"
            />
            <SummaryMetricCard
              title="Scheduled"
              value={scheduledCount}
              description="Starts later"
              icon={<CalendarDays size={20} />}
              tone="sky"
            />
            <SummaryMetricCard
              title="Targeted offers"
              value={targetedCount}
              description="Item rules"
              icon={<Target size={20} />}
              tone="purple"
            />
          </section>

          {isCreateOpen && (
            <Modal
              title="Create promotion"
              description="Set the offer, scope, and schedule."
              icon={<Tag size={19} />}
              onClose={() => setIsCreateOpen(false)}
              size="xl"
              density="compact"
            >
              <div className="mb-4">
                <p className="mb-3 text-xs font-bold uppercase tracking-wider text-text-secondary">
                  Promotion template
                </p>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  {templateOptions.map((option) => {
                    const Icon = option.icon;
                    const selected = template === option.key;
                    return (
                      <Button
                        key={option.key}
                        variant={selected ? 'brandSubtle' : 'secondary'}
                        onClick={() => chooseTemplate(option.key)}
                        className="h-auto min-h-12 justify-start px-3 py-2 text-left"
                        aria-pressed={selected}
                      >
                        <Icon size={18} className="shrink-0" />
                        <span className="min-w-0">
                          <span className="block text-sm font-bold">
                            {option.label}
                          </span>
                          <span className="mt-0.5 block text-xs font-normal leading-snug text-text-muted">
                            {option.description}
                          </span>
                        </span>
                      </Button>
                    );
                  })}
                </div>
              </div>

              <form ref={formRef} onSubmit={create} className="space-y-4">
                <div className="grid grid-cols-1 items-start gap-x-4 gap-y-4 md:grid-cols-2">
                  <FormField
                    label="Promotion name"
                    required
                    id="promotion-name"
                  >
                    <Input
                      id="promotion-name"
                      required
                      name="name"
                      placeholder="e.g. Weekend coffee sale"
                    />
                  </FormField>
                  <FormField label="Discount type" required>
                    <CustomSelect
                      value={type}
                      onChange={(value) => {
                        const nextType = value as PromotionType;
                        setType(nextType);
                        setTemplate('custom');
                        if (nextType === 'BUY_X_GET_Y') setScope('PRODUCT');
                      }}
                      options={[
                        { value: 'PERCENT', label: 'Percentage off' },
                        { value: 'FIXED', label: 'Fixed amount off' },
                        { value: 'BUY_X_GET_Y', label: 'Buy X, get Y free' },
                      ]}
                      leadingIcon={<CircleDollarSign size={16} />}
                    />
                  </FormField>

                  {type !== 'BUY_X_GET_Y' && (
                    <FormField label="Apply to" required>
                      <CustomSelect
                        value={scope}
                        onChange={(value) => setScope(value as PromotionScope)}
                        options={[
                          { value: 'ORDER', label: 'Entire order' },
                          { value: 'CATEGORY', label: 'One category' },
                          { value: 'PRODUCT', label: 'One product' },
                        ]}
                        leadingIcon={<Target size={16} />}
                      />
                    </FormField>
                  )}

                  {scope === 'CATEGORY' && type !== 'BUY_X_GET_Y' && (
                    <FormField label="Category" required>
                      <CustomSelect
                        name="categoryId"
                        value={categoryId}
                        onChange={setCategoryId}
                        placeholder="Select category"
                        options={categories.map((category) => ({
                          value: category.id,
                          label: category.name,
                        }))}
                      />
                    </FormField>
                  )}

                  {(scope === 'PRODUCT' || type === 'BUY_X_GET_Y') && (
                    <FormField label="Product" required>
                      <CustomSelect
                        name="productId"
                        value={productId}
                        onChange={setProductId}
                        placeholder="Select product"
                        options={products.map((product) => ({
                          value: product.id,
                          label: product.name,
                        }))}
                      />
                    </FormField>
                  )}

                  {type === 'BUY_X_GET_Y' ? (
                    <>
                      <FormField
                        label="Customer buys"
                        required
                        id="buy-quantity"
                      >
                        <Input
                          id="buy-quantity"
                          required
                          name="buyQuantity"
                          type="number"
                          min="1"
                          step="1"
                          placeholder="2"
                        />
                      </FormField>
                      <FormField
                        label="Customer gets free"
                        required
                        id="reward-quantity"
                      >
                        <Input
                          id="reward-quantity"
                          required
                          name="rewardQuantity"
                          type="number"
                          min="1"
                          step="1"
                          placeholder="1"
                        />
                      </FormField>
                    </>
                  ) : (
                    <FormField
                      label={
                        type === 'PERCENT' ? 'Percentage off' : 'Amount off'
                      }
                      required
                      id="promotion-value"
                    >
                      <Input
                        id="promotion-value"
                        required
                        name="value"
                        type="number"
                        min="0.01"
                        max={type === 'PERCENT' ? '100' : undefined}
                        step="0.01"
                        placeholder={type === 'PERCENT' ? '10' : '2.00'}
                        prefixText={type === 'PERCENT' ? undefined : '$'}
                        suffixIcon={
                          type === 'PERCENT' ? <Percent size={16} /> : undefined
                        }
                      />
                    </FormField>
                  )}

                  <FormField
                    label="Minimum order"
                    sublabel="(optional)"
                    id="minimum-spend"
                  >
                    <Input
                      id="minimum-spend"
                      name="minimumSpend"
                      type="number"
                      min="0"
                      step="0.01"
                      placeholder="20.00"
                      prefixText="$"
                    />
                  </FormField>
                  <FormField label="Starts" sublabel="(optional)">
                    <DatePicker
                      name="startsAt"
                      value={startsAt}
                      onChange={(value) => {
                        setStartsAt(value);
                        if (endsAt && value > endsAt) setEndsAt('');
                      }}
                      placeholder="Select start date"
                    />
                  </FormField>
                  <FormField label="Ends" sublabel="(optional)">
                    <DatePicker
                      name="endsAt"
                      value={endsAt}
                      onChange={setEndsAt}
                      min={startsAt || undefined}
                      placeholder="Select end date"
                    />
                  </FormField>
                </div>

                <div className="flex justify-end border-t border-border-subtle pt-5">
                  <Button type="submit" disabled={isSaving}>
                    <Plus size={16} />
                    {isSaving ? 'Saving…' : 'Save promotion'}
                  </Button>
                </div>
              </form>
            </Modal>
          )}

          <SectionCard
            title="Your promotions"
            description={`${items.length} configured`}
            icon={<Tag size={20} />}
            actions={
              <span className="inline-flex min-w-8 items-center justify-center rounded-full bg-muted-strong px-2.5 py-1 text-xs font-bold text-text-secondary">
                {items.length}
              </span>
            }
            bodyPadding={false}
          >
            {items.length ? (
              <>
                <div className="divide-y divide-border-subtle md:hidden">
                  {items.map((item) => {
                    const status = promotionStatus(item);
                    const start = formatDate(item.startsAt);
                    const end = formatDate(item.endsAt);

                    return (
                      <article key={item.id} className="px-4 py-4">
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex min-w-0 items-center gap-3">
                            <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-brand-subtle text-brand">
                              <Tag size={17} />
                            </span>
                            <div className="min-w-0">
                              <h3 className="m-0 truncate text-sm font-bold text-text-main">
                                {item.name}
                              </h3>
                              <p className="mt-0.5 mb-0 text-xs font-bold text-brand">
                                {promotionOffer(item)}
                              </p>
                            </div>
                          </div>
                          <StatusBadge tone={status.tone}>
                            {status.label}
                          </StatusBadge>
                        </div>

                        <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3 border-y border-border-subtle py-3 text-xs">
                          <div className="min-w-0">
                            <dt className="font-bold uppercase tracking-wider text-text-muted">
                              Applies to
                            </dt>
                            <dd className="mt-1 mb-0 truncate font-semibold text-text-main">
                              {promotionScope(item)}
                            </dd>
                          </div>
                          <div className="min-w-0">
                            <dt className="font-bold uppercase tracking-wider text-text-muted">
                              Schedule
                            </dt>
                            <dd className="mt-1 mb-0 font-semibold text-text-main">
                              {start || end
                                ? `${start ?? 'Now'} – ${end ?? 'No end'}`
                                : 'Always'}
                            </dd>
                          </div>
                          {item.minimumSpend > 0 && (
                            <div className="col-span-2">
                              <dt className="font-bold uppercase tracking-wider text-text-muted">
                                Minimum order
                              </dt>
                              <dd className="mt-1 mb-0 font-semibold text-text-main">
                                ${(item.minimumSpend / 100).toFixed(2)}
                              </dd>
                            </div>
                          )}
                        </dl>

                        <div className="mt-4 flex justify-end">
                          <Button
                            variant={
                              item.isActive ? 'neutralSubtle' : 'successSubtle'
                            }
                            size="status"
                            disabled={togglingId === item.id}
                            onClick={() => void toggle(item)}
                          >
                            {togglingId === item.id
                              ? 'Updating…'
                              : item.isActive
                                ? 'Deactivate'
                                : 'Activate'}
                          </Button>
                        </div>
                      </article>
                    );
                  })}
                </div>

                <div className="hidden overflow-x-auto md:block">
                  <table className="w-full min-w-[900px] border-collapse text-left">
                    <thead className="bg-muted-surface text-xs font-bold uppercase tracking-wider text-text-secondary">
                      <tr className="border-b border-border-subtle">
                        <th className="px-4 py-3 sm:pl-8">Promotion</th>
                        <th className="px-4 py-3">Offer</th>
                        <th className="px-4 py-3">Applies to</th>
                        <th className="px-4 py-3">Schedule</th>
                        <th className="px-4 py-3">Status</th>
                        <th className="px-4 py-3 text-right sm:pr-8">Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {items.map((item) => {
                        const status = promotionStatus(item);
                        const start = formatDate(item.startsAt);
                        const end = formatDate(item.endsAt);
                        return (
                          <tr
                            key={item.id}
                            className="border-b border-border-subtle transition-colors last:border-b-0 hover:bg-muted-surface"
                          >
                            <td className="px-4 py-4 sm:pl-8">
                              <div className="flex items-center gap-3">
                                <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-brand-subtle text-brand">
                                  <Tag size={17} />
                                </span>
                                <strong className="text-sm text-text-main">
                                  {item.name}
                                </strong>
                              </div>
                            </td>
                            <td className="px-4 py-4 text-sm font-bold text-text-main">
                              {promotionOffer(item)}
                              {item.minimumSpend > 0 && (
                                <span className="mt-0.5 block text-xs font-normal text-text-muted">
                                  Minimum $
                                  {(item.minimumSpend / 100).toFixed(2)}
                                </span>
                              )}
                            </td>
                            <td className="px-4 py-4 text-sm text-text-secondary">
                              {promotionScope(item)}
                            </td>
                            <td className="px-4 py-4 text-sm text-text-secondary">
                              {start || end
                                ? `${start ?? 'Now'} – ${end ?? 'No end'}`
                                : 'Always'}
                            </td>
                            <td className="px-4 py-4">
                              <StatusBadge tone={status.tone}>
                                {status.label}
                              </StatusBadge>
                            </td>
                            <td className="px-4 py-4 text-right sm:pr-8">
                              <Button
                                variant={
                                  item.isActive
                                    ? 'neutralSubtle'
                                    : 'successSubtle'
                                }
                                size="status"
                                disabled={togglingId === item.id}
                                onClick={() => void toggle(item)}
                              >
                                {togglingId === item.id
                                  ? 'Updating…'
                                  : item.isActive
                                    ? 'Deactivate'
                                    : 'Activate'}
                              </Button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </>
            ) : (
              <EmptyState
                icon={<Tag size={24} />}
                title={isLoading ? 'Loading promotions' : 'No promotions yet'}
                description={
                  isLoading
                    ? 'Loading checkout offers.'
                    : 'Create your first checkout offer.'
                }
                className="min-h-40"
              />
            )}
          </SectionCard>
        </PageContainer>
      </div>
    </main>
  );
}
