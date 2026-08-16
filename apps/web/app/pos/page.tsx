'use client';

import {
  ArrowLeft,
  BadgePercent,
  Banknote,
  CircleAlert,
  CircleCheck,
  Clock3,
  CreditCard,
  Gift,
  ImageOff,
  Info,
  LockKeyhole,
  MessageSquareText,
  Minus,
  Plus,
  Play,
  QrCode,
  RefreshCw,
  Scan,
  Search,
  ShoppingCart,
  Trash2,
  UserRound,
  UserPlus,
  X,
} from 'lucide-react';
import {
  FormEvent,
  KeyboardEvent,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  cacheCatalog,
  loadCachedCatalog,
  queueSale,
  queuedSaleCount,
  queuedSalesFor,
  removeQueuedSale,
  useI18n,
} from '../../lib/';
import { getDeviceSettings } from '../../lib/';
import {
  AlertBanner,
  Button,
  ButtonLink,
  CustomSelect,
  EmptyState,
  FormField,
  Input,
  Modal,
  NumericKeypad,
  PasswordInput,
  TabButton,
  Textarea,
} from '../../components/ui';

const api = '/api';

function parseJsonResponse<T>(raw: string): Partial<T> {
  if (!raw) return {};
  try {
    return JSON.parse(raw) as T;
  } catch {
    return {};
  }
}
type ModifierOption = { id: string; name: string; priceAdjustment: number };
type ModifierGroup = {
  id: string;
  name: string;
  minSelections: number;
  maxSelections: number;
  options: ModifierOption[];
};
type Product = {
  id: string;
  name: string;
  sku: string;
  barcode: string | null;
  imageUrl: string | null;
  price: number;
  regularPrice: number | null;
  stockQuantity: number;
  category: { id: string; name: string; sortOrder?: number | null } | null;
  modifierGroups: ModifierGroup[];
  variants: {
    id: string;
    name: string;
    sku: string;
    barcode: string | null;
    price: number | null;
    regularPrice: number | null;
    stockQuantity: number;
  }[];
  sortOrder?: number | null;
};
type Line = Product & {
  key: string;
  quantity: number;
  modifierOptionIds: string[];
  variantId?: string;
  variantLabel?: string;
  modifierLabel: string;
  note?: string;
  adjustedPrice: number;
  availableQuantity: number;
};
type Customer = {
  id: string;
  name: string;
  phone: string | null;
  email?: string | null;
};
const sizeOrder = ['XXS', 'XS', 'S', 'M', 'L', 'XL', 'XXL', 'XXXL'];
function variantSizeRank(name: string) {
  const size = name
    .toUpperCase()
    .match(/(?:^|\s|\/|-)(XXXS|XXL|XL|XXS|XS|S|M|L)(?:\s|\/|-|$)/)?.[1];
  const index = size ? sizeOrder.indexOf(size) : -1;
  return index === -1 ? sizeOrder.length : index;
}

function variantColorSwatchClass(name: string) {
  const color = name.toLowerCase();
  if (color.includes('black')) return 'bg-slate-950';
  if (color.includes('navy')) return 'bg-blue-950';
  if (color.includes('blue')) return 'bg-blue-500';
  if (color.includes('red')) return 'bg-red-500';
  if (color.includes('green')) return 'bg-emerald-500';
  if (color.includes('yellow')) return 'bg-yellow-400';
  if (color.includes('orange')) return 'bg-orange-500';
  if (color.includes('pink')) return 'bg-pink-400';
  if (color.includes('purple')) return 'bg-purple-500';
  if (color.includes('brown')) return 'bg-amber-800';
  if (color.includes('beige')) return 'bg-amber-100';
  if (color.includes('gray') || color.includes('grey')) return 'bg-slate-400';
  if (color.includes('white')) return 'bg-white';
  return 'bg-muted-strong';
}
type TerminalUser = {
  id: string;
  firstName: string;
  lastName: string;
  role: string;
};
type ManagerApprover = TerminalUser;
type HeldSale = {
  id: string;
  label: string;
  customerId: string | null;
  paymentMethod: string;
  discountTotal: number;
  note: string | null;
  items: Line[];
  cashier: { firstName: string; lastName: string };
  createdAt: string;
  updatedAt: string;
};
type ExchangeDraft = { sourceSaleId: string; credit: number };
type Promotion = {
  id: string;
  name: string;
  type: 'PERCENT' | 'FIXED' | 'BUY_X_GET_Y';
  value: number;
  minimumSpend: number;
  productId: string | null;
  categoryId: string | null;
  buyQuantity: number;
  rewardQuantity: number;
};

export default function PosPage() {
  const { locale, t } = useI18n();
  const [products, setProducts] = useState<Product[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [customerId, setCustomerId] = useState('');
  const [cart, setCart] = useState<Line[]>([]);
  const [query, setQuery] = useState('');
  const [selectedCategoryId, setSelectedCategoryId] = useState('');
  const [branchId, setBranchId] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('CASH');
  const [giftCardCode, setGiftCardCode] = useState('');
  const [giftCardBalance, setGiftCardBalance] = useState<number | null>(null);
  const [tendered, setTendered] = useState('');
  const [discount, setDiscount] = useState('');
  const [discountType, setDiscountType] = useState<'FIXED' | 'PERCENT'>(
    'FIXED',
  );
  const [discountDraft, setDiscountDraft] = useState('');
  const [discountTypeDraft, setDiscountTypeDraft] = useState<
    'FIXED' | 'PERCENT'
  >('FIXED');
  const [showDiscount, setShowDiscount] = useState(false);
  const [showNote, setShowNote] = useState(false);
  const [noteDraft, setNoteDraft] = useState('');
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [isProcessingPayment, setIsProcessingPayment] = useState(false);
  const [showCustomerModal, setShowCustomerModal] = useState(false);
  const [customerModalMode, setCustomerModalMode] = useState<
    'select' | 'create'
  >('select');
  const [customerQuery, setCustomerQuery] = useState('');
  const [isCreatingCustomer, setIsCreatingCustomer] = useState(false);
  const [customerFormError, setCustomerFormError] = useState('');
  const [newCustomerName, setNewCustomerName] = useState('');
  const [newCustomerPhone, setNewCustomerPhone] = useState('');
  const [newCustomerEmail, setNewCustomerEmail] = useState('');
  const [editingNoteKey, setEditingNoteKey] = useState<string | null>(null);
  const [linePendingRemoval, setLinePendingRemoval] = useState<Line | null>(
    null,
  );
  const [quantityEditingLine, setQuantityEditingLine] = useState<Line | null>(
    null,
  );
  const [quantityDraft, setQuantityDraft] = useState('');
  const [canDiscount, setCanDiscount] = useState(false);
  const [message, setMessage] = useState('');
  const [addedProductId, setAddedProductId] = useState('');
  const [addedProductName, setAddedProductName] = useState('');
  const [receiptId, setReceiptId] = useState('');
  const [shiftOpen, setShiftOpen] = useState(false);
  const [cashierId, setCashierId] = useState('');
  const [isOnline, setIsOnline] = useState(true);
  const [queuedCount, setQueuedCount] = useState(0);
  const [syncing, setSyncing] = useState(false);
  const [heldSales, setHeldSales] = useState<HeldSale[]>([]);
  const [holdLabel, setHoldLabel] = useState('');
  const [showHoldSaleModal, setShowHoldSaleModal] = useState(false);
  const [showHeldSalesModal, setShowHeldSalesModal] = useState(false);
  const [isSavingHeldSale, setIsSavingHeldSale] = useState(false);
  const [heldSaleActionId, setHeldSaleActionId] = useState('');
  const [heldPendingDeletion, setHeldPendingDeletion] =
    useState<HeldSale | null>(null);
  const [saleNote, setSaleNote] = useState('');
  const [promotions, setPromotions] = useState<Promotion[]>([]);
  const [terminalUsers, setTerminalUsers] = useState<TerminalUser[]>([]);
  const [terminalLocked, setTerminalLocked] = useState(false);
  const [mobileView, setMobileView] = useState<'products' | 'cart'>('products');
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);

  const [currentTime, setCurrentTime] = useState<Date | null>(null);
  useEffect(() => {
    setCurrentTime(new Date());
    const interval = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!message || message.startsWith('Offline mode')) return;
    const timer = setTimeout(() => {
      setMessage('');
    }, 4000);
    return () => clearTimeout(timer);
  }, [message]);
  useEffect(() => {
    if (!addedProductId) return;
    const timer = setTimeout(() => setAddedProductId(''), 180);
    return () => clearTimeout(timer);
  }, [addedProductId]);
  useEffect(() => {
    if (!addedProductName) return;
    const quantity = cart
      .filter((item) => item.name === addedProductName)
      .reduce((sum, item) => sum + item.quantity, 0);
    setMessage(t('pos.message.inCart', { name: addedProductName, count: quantity }));
    setAddedProductName('');
  }, [cart, addedProductName]);
  const [unlockUserId, setUnlockUserId] = useState('');
  const [unlockPin, setUnlockPin] = useState('');
  const [unlockMessage, setUnlockMessage] = useState('');
  const [isUnlocking, setIsUnlocking] = useState(false);
  const [managerApprovers, setManagerApprovers] = useState<ManagerApprover[]>(
    [],
  );
  const [approvalUserId, setApprovalUserId] = useState('');
  const [approvalPin, setApprovalPin] = useState('');
  const [managerApprovalToken, setManagerApprovalToken] = useState('');
  const [discountApprovalToken, setDiscountApprovalToken] = useState('');
  const [isApprovingDiscount, setIsApprovingDiscount] = useState(false);
  const [approvalMessage, setApprovalMessage] = useState('');
  const [configuring, setConfiguring] = useState<Product | null>(null);
  const [configuringVariant, setConfiguringVariant] = useState<
    Product['variants'][number] | null
  >(null);
  const [variantPicking, setVariantPicking] = useState<Product | null>(null);
  const [selectedVariantGroup, setSelectedVariantGroup] = useState('');
  const [selectedOptions, setSelectedOptions] = useState<string[]>([]);
  const [exchangeDraft, setExchangeDraft] = useState<ExchangeDraft | null>(
    null,
  );
  const [taxRateBasisPoints, setTaxRateBasisPoints] = useState(0);
  const scanInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setSelectedVariantGroup('');
  }, [variantPicking?.id]);

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
  useEffect(() => {
    const refreshQueuedCount = async (
      userId: string,
      activeBranchId: string,
    ) => {
      setQueuedCount(await queuedSaleCount(userId, activeBranchId));
    };
    const load = async () => {
      setIsOnline(navigator.onLine);
      const savedExchange = sessionStorage.getItem('pos_exchange_draft');
      if (savedExchange) {
        try {
          setExchangeDraft(JSON.parse(savedExchange) as ExchangeDraft);
        } catch {
          sessionStorage.removeItem('pos_exchange_draft');
        }
      }
      try {
        const [
          me,
          currentShift,
          customerList,
          terminalUserList,
          approverList,
          settings,
          promotionList,
        ] = await Promise.all([
          fetch(`${api}/auth/me`, { headers }),
          fetch(`${api}/shifts/current`, { headers }),
          fetch(`${api}/customers`, { headers }),
          fetch(`${api}/auth/terminal-users`, { headers }),
          fetch(`${api}/auth/manager-approvers`, { headers }),
          fetch(`${api}/businesses/current/settings`, { headers }),
          fetch(`${api}/promotions/active`, { headers }),
        ]);
        if (!me.ok) throw new Error(t('pos.error.signIn'));
        const user = await me.json();
        if (!user.branchId)
          throw new Error(t('pos.error.noBranch'));
        setBranchId(user.branchId);
        setCashierId(user.id);
        setCanDiscount(user.role === 'OWNER' || user.role === 'MANAGER');
        localStorage.setItem(
          'pos_offline_session',
          JSON.stringify({
            id: user.id,
            branchId: user.branchId,
            canDiscount: user.role === 'OWNER' || user.role === 'MANAGER',
          }),
        );
        const catalog = await fetch(
          `${api}/pos/catalog?branchId=${user.branchId}`,
          { headers },
        );
        if (catalog.ok) {
          const freshProducts = await catalog.json();
          setProducts(freshProducts);
          await cacheCatalog(user.branchId, freshProducts);
        } else {
          const cached = await loadCachedCatalog<Product[]>(user.branchId);
          if (!cached) throw new Error(t('pos.error.loadProducts'));
          setProducts(cached.products);
        }
        if (customerList.ok) setCustomers(await customerList.json());
        if (terminalUserList.ok) {
          const users = await terminalUserList.json();
          setTerminalUsers(users);
          if (users.length === 1) setUnlockUserId(users[0].id);
        }
        if (approverList.ok) {
          const approvers = await approverList.json();
          setManagerApprovers(approvers);
          if (approvers.length === 1) setApprovalUserId(approvers[0].id);
        }
        if (settings.ok) {
          const currentSettings = await settings.json();
          setTaxRateBasisPoints(currentSettings.taxRateBasisPoints ?? 0);
        }
        if (promotionList.ok) setPromotions(await promotionList.json());
        const heldResponse = await fetch(
          `${api}/pos/held?branchId=${user.branchId}`,
          { headers },
        );
        if (heldResponse.ok) setHeldSales(await heldResponse.json());
        const hasOpenShift =
          currentShift.ok && Boolean(await currentShift.json());
        setShiftOpen(hasOpenShift);
        localStorage.setItem(
          `pos_shift_${user.branchId}`,
          hasOpenShift ? 'open' : 'closed',
        );
        await refreshQueuedCount(user.id, user.branchId);
        // Browser connectivity flags are unreliable for localhost. A successful
        // authenticated API load is the authoritative online signal.
        setIsOnline(true);
        setMessage((current) =>
          current.startsWith('Offline mode:') ? '' : current,
        );
      } catch (error) {
        const cachedSession = localStorage.getItem('pos_offline_session');
        if (!cachedSession) throw error;
        const cachedUser = JSON.parse(cachedSession) as {
          id: string;
          branchId: string;
          canDiscount: boolean;
        };
        const cached = await loadCachedCatalog<Product[]>(cachedUser.branchId);
        if (!cached) throw error;
        setBranchId(cachedUser.branchId);
        setCashierId(cachedUser.id);
        setCanDiscount(cachedUser.canDiscount);
        setProducts(cached.products);
        setShiftOpen(
          localStorage.getItem(`pos_shift_${cachedUser.branchId}`) === 'open',
        );
        await refreshQueuedCount(cachedUser.id, cachedUser.branchId);
        setIsOnline(false);
      }
    };
    void load().catch((error: Error) => setMessage(error.message));
  }, []);

  useEffect(() => {
    const checkApi = async () => {
      try {
        const response = await fetch(`${api}/auth/me`, { headers });
        setIsOnline(response.ok);
      } catch {
        setIsOnline(false);
      }
    };
    void checkApi();
    const timer = window.setInterval(() => void checkApi(), 10_000);
    return () => window.clearInterval(timer);
  }, [token]);

  async function syncQueuedSales() {
    if (!isOnline || !cashierId || !branchId || syncing) return;
    setSyncing(true);
    try {
      const queued = await queuedSalesFor(cashierId, branchId);
      let synced = 0;
      let syncFailed = false;
      for (const sale of queued) {
        try {
          const response = await fetch(`${api}/pos/checkout`, {
            method: 'POST',
            headers,
            body: JSON.stringify(sale.payload),
          });
          if (!response.ok) {
            syncFailed = true;
            break;
          }
          await removeQueuedSale(sale.id);
          synced += 1;
        } catch {
          syncFailed = true;
          setIsOnline(false);
          break;
        }
      }
      const remaining = await queuedSaleCount(cashierId, branchId);
      setQueuedCount(remaining);
      if (synced)
        setMessage(
          t('pos.message.synced', { count: synced }),
        );
      else if (syncFailed && remaining)
        setMessage(
          t('pos.message.stillQueued', { count: remaining }),
        );
    } finally {
      setSyncing(false);
    }
  }

  useEffect(() => {
    if (isOnline) void syncQueuedSales();
  }, [isOnline, cashierId, branchId]);
  useEffect(() => {
    if (!isOnline || !cashierId || !branchId || !queuedCount) return;
    const retryTimer = window.setInterval(() => void syncQueuedSales(), 30_000);
    return () => window.clearInterval(retryTimer);
  }, [isOnline, cashierId, branchId, queuedCount]);
  const categories = useMemo(() => {
    return Array.from(
      new Map(
        products
          .filter((product) => product.category)
          .map((product) => [product.category!.id, product.category!]),
      ).values(),
    ).sort((a, b) => {
      const orderA = a.sortOrder ?? 0;
      const orderB = b.sortOrder ?? 0;
      if (orderA !== orderB) return orderA - orderB;
      return a.name.localeCompare(b.name);
    });
  }, [products]);
  const filtered = useMemo(() => {
    return products
      .filter((p) => {
        const matchesCategory =
          !selectedCategoryId || p.category?.id === selectedCategoryId;
        const searchString =
          `${p.name} ${p.sku} ${p.barcode ?? ''} ${p.category?.name ?? ''}`.toLowerCase();
        const queryWords = query.toLowerCase().split(/\s+/).filter(Boolean);
        const matchesQuery = queryWords.every((word) =>
          searchString.includes(word),
        );
        return matchesCategory && matchesQuery;
      })
      .sort((a, b) => {
        const orderA = a.sortOrder ?? 0;
        const orderB = b.sortOrder ?? 0;
        if (orderA !== orderB) return orderA - orderB;
        return a.name.localeCompare(b.name);
      });
  }, [products, selectedCategoryId, query]);
  const selectedCustomer = useMemo(
    () => customers.find((customer) => customer.id === customerId) ?? null,
    [customerId, customers],
  );
  const selectedUnlockUser = useMemo(
    () => terminalUsers.find((user) => user.id === unlockUserId) ?? null,
    [terminalUsers, unlockUserId],
  );
  const securedCartQuantity = useMemo(
    () => cart.reduce((sum, line) => sum + line.quantity, 0),
    [cart],
  );
  const filteredCustomers = useMemo(() => {
    const normalizedQuery = customerQuery.trim().toLowerCase();
    if (!normalizedQuery) return customers;
    return customers.filter((customer) =>
      `${customer.name} ${customer.phone ?? ''} ${customer.email ?? ''}`
        .toLowerCase()
        .includes(normalizedQuery),
    );
  }, [customerQuery, customers]);
  const total = useMemo(
    () =>
      cart.reduce((sum, line) => sum + line.adjustedPrice * line.quantity, 0),
    [cart],
  );
  const manualDiscountTotal = useMemo(() => {
    const val = Number(discount || '0');
    if (discountType === 'PERCENT') {
      return Math.round((total * val) / 100);
    }
    return Math.round(val * 100);
  }, [discount, discountType, total]);
  const activePromotion = useMemo(
    () =>
      promotions
        .map((promotion) => ({
          ...promotion,
          eligibleTotal: cart
            .filter(
              (line) =>
                (!promotion.productId || promotion.productId === line.id) &&
                (!promotion.categoryId ||
                  promotion.categoryId === line.category?.id),
            )
            .reduce((sum, line) => sum + line.adjustedPrice * line.quantity, 0),
        }))
        .filter(
          (promotion) =>
            total >= promotion.minimumSpend && promotion.eligibleTotal > 0,
        )
        .map((promotion) => ({
          ...promotion,
          discount: Math.min(
            promotion.eligibleTotal,
            promotion.type === 'BUY_X_GET_Y'
              ? cart
                  .filter((line) => line.id === promotion.productId)
                  .reduce(
                    (sum, line) =>
                      sum +
                      Math.floor(
                        line.quantity /
                          (promotion.buyQuantity + promotion.rewardQuantity),
                      ) *
                        promotion.rewardQuantity *
                        line.adjustedPrice,
                    0,
                  )
              : promotion.type === 'PERCENT'
                ? Math.floor(
                    (promotion.eligibleTotal * promotion.value) / 10000,
                  )
                : promotion.value,
          ),
        }))
        .sort((a, b) => b.discount - a.discount)[0],
    [cart, promotions, total],
  );
  const promotionDiscountTotal = activePromotion?.discount ?? 0;
  const discountDraftValue = Number(discountDraft || '0');
  const draftManualDiscountTotal =
    discountTypeDraft === 'PERCENT'
      ? Math.round((total * discountDraftValue) / 100)
      : Math.round(discountDraftValue * 100);
  const draftDiscountTotal = draftManualDiscountTotal + promotionDiscountTotal;
  const discountDraftIsExcessive =
    discountDraftValue > 0 &&
    (discountTypeDraft === 'PERCENT'
      ? discountDraftValue > 100 || draftDiscountTotal > total
      : draftDiscountTotal > total);
  const draftTaxableTotal = Math.max(0, total - draftDiscountTotal);
  const draftTaxTotal = Math.round(
    (draftTaxableTotal * taxRateBasisPoints) / 10000,
  );
  const draftExchangeCredit = Math.min(
    exchangeDraft?.credit ?? 0,
    draftTaxableTotal + draftTaxTotal,
  );
  const draftFinalTotal = Math.max(
    0,
    draftTaxableTotal + draftTaxTotal - draftExchangeCredit,
  );
  const discountTotal = manualDiscountTotal + promotionDiscountTotal;
  const taxableTotal = Math.max(0, total - discountTotal);
  const taxTotal = Math.round((taxableTotal * taxRateBasisPoints) / 10000);
  const exchangeCredit = Math.min(
    exchangeDraft?.credit ?? 0,
    taxableTotal + taxTotal,
  );
  const finalTotal = Math.max(0, taxableTotal + taxTotal - exchangeCredit);
  const tenderedCents = Math.round(Number(tendered || '0') * 100);
  const cashShortfall = Math.max(0, finalTotal - tenderedCents);
  const changeDue = Math.max(0, tenderedCents - finalTotal);
  const quickCashOptions = [
    { label: t('pos.exact'), value: (finalTotal / 100).toFixed(2) },
    ...[500, 1000, 2000, 5000, 10000].map((denomination) => {
      const amount = Math.ceil(finalTotal / denomination) * denomination;
      return {
        label: `$${(amount / 100).toFixed(amount % 100 ? 2 : 0)}`,
        value: (amount / 100).toFixed(2),
      };
    }),
  ].filter(
    (option, index, options) =>
      options.findIndex((candidate) => candidate.value === option.value) ===
      index,
  );
  async function checkGiftCard() {
    if (!giftCardCode.trim()) return;
    const response = await fetch(
      `${api}/gift-cards/lookup?code=${encodeURIComponent(giftCardCode)}`,
      { headers },
    );
    const raw = await response.text();
    const data = raw ? JSON.parse(raw) : {};
    setGiftCardBalance(response.ok ? data.balance : null);
    if (!response.ok) setMessage(data.message ?? t('pos.error.giftCardNotFound'));
  }
  function add(
    product: Product,
    modifierOptionIds: string[] = [],
    variant?: Product['variants'][number],
  ) {
    setAddedProductId(product.id);
    setAddedProductName(product.name);
    const availableStock = variant?.stockQuantity ?? product.stockQuantity;
    const options = product.modifierGroups
      .flatMap((group) => group.options)
      .filter((option) => modifierOptionIds.includes(option.id));
    const modifierLabel = options.map((option) => option.name).join(', ');
    const adjustedPrice =
      (variant?.price ?? product.price) +
      options.reduce((sum, option) => sum + option.priceAdjustment, 0);
    const key = `${product.id}:${variant?.id ?? ''}:${modifierOptionIds.slice().sort().join(',')}`;
    setCart((current) => {
      const line = current.find((item) => item.key === key);
      return line
        ? current.map((item) =>
            item.key === key
              ? {
                  ...item,
                  quantity: Math.min(item.quantity + 1, item.availableQuantity),
                }
              : item,
          )
        : [
            ...current,
            {
              ...product,
              key,
              quantity: 1,
              modifierOptionIds,
              variantId: variant?.id,
              variantLabel: variant?.name,
              modifierLabel,
              note: '',
              adjustedPrice,
              availableQuantity: availableStock,
            },
          ];
    });
  }
  function chooseProduct(product: Product) {
    if (product.variants.length) {
      setVariantPicking(product);
      return;
    }
    if (!product.modifierGroups.length) {
      add(product);
      return;
    }
    setConfiguring(product);
    setConfiguringVariant(null);
    setSelectedOptions([]);
  }
  function chooseVariant(
    product: Product,
    variant: Product['variants'][number],
  ) {
    if (variant.stockQuantity < 1) {
      setMessage(t('pos.message.variantOutOfStock', { product: product.name, variant: variant.name }));
      return;
    }
    if (product.modifierGroups.length) {
      setVariantPicking(null);
      setConfiguring(product);
      setConfiguringVariant(variant);
      setSelectedOptions([]);
      return;
    }
    add(product, [], variant);
    setVariantPicking(null);
    setMessage(t('pos.message.variantAdded', { product: product.name, variant: variant.name }));
    scanInput.current?.focus();
  }
  function toggleOption(group: ModifierGroup, optionId: string) {
    setSelectedOptions((current) => {
      const selectedInGroup = group.options.filter((option) =>
        current.includes(option.id),
      );
      if (current.includes(optionId))
        return current.filter((id) => id !== optionId);
      if (selectedInGroup.length >= group.maxSelections)
        return [
          ...current.filter(
            (id) => !group.options.some((option) => option.id === id),
          ),
          optionId,
        ];
      return [...current, optionId];
    });
  }
  function addConfigured() {
    if (!configuring) return;
    for (const group of configuring.modifierGroups) {
      const count = group.options.filter((option) =>
        selectedOptions.includes(option.id),
      ).length;
      if (count < group.minSelections) {
        setMessage(
          t('pos.message.chooseOptions', { count: group.minSelections, name: group.name }),
        );
        return;
      }
    }
    add(configuring, selectedOptions, configuringVariant ?? undefined);
    setConfiguring(null);
    setConfiguringVariant(null);
  }
  function scan(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key !== 'Enter') return;
    event.preventDefault();
    const scannedValue = query.trim();
    const code = scannedValue.toLowerCase();
    if (!code) return;
    const product = products.find(
      (item) =>
        item.barcode?.toLowerCase() === code || item.sku.toLowerCase() === code,
    );
    const variantMatch = products
      .flatMap((item) =>
        item.variants.map((variant) => ({ product: item, variant })),
      )
      .find(
        ({ variant }) =>
          variant.barcode?.toLowerCase() === code ||
          variant.sku.toLowerCase() === code,
      );
    if (variantMatch) {
      chooseVariant(variantMatch.product, variantMatch.variant);
      setQuery('');
      return;
    }
    if (!product) {
      setMessage(
        t('pos.message.codeNotFound', { code: scannedValue }),
      );
      return;
    }
    if (product.stockQuantity < 1) {
      setMessage(t('pos.message.productOutOfStock', { name: product.name }));
      return;
    }
    chooseProduct(product);
    setQuery('');
    setMessage(
      product.modifierGroups.length
        ? t('pos.message.productFound', { name: product.name })
        : t('pos.message.productAdded', { name: product.name }),
    );
    scanInput.current?.focus();
  }
  function change(key: string, quantity: number) {
    setCart((current) =>
      quantity < 1
        ? current.filter((line) => line.key !== key)
        : current.map((line) =>
            line.key === key ? { ...line, quantity } : line,
          ),
    );
  }
  function closeQuantityEditor() {
    setQuantityEditingLine(null);
    setQuantityDraft('');
  }
  function updateQuantity() {
    if (!quantityEditingLine) return;
    const nextQuantity = Number.parseInt(quantityDraft, 10);
    if (
      !Number.isInteger(nextQuantity) ||
      nextQuantity < 1 ||
      nextQuantity > quantityEditingLine.availableQuantity
    )
      return;
    change(quantityEditingLine.key, nextQuantity);
    closeQuantityEditor();
  }
  function clearCurrentSale() {
    setCart([]);
    setCustomerId('');
    setPaymentMethod('CASH');
    setTendered('');
    setDiscount('');
    setDiscountDraft('');
    setShowDiscount(false);
    setShowNote(false);
    setSaleNote('');
    setNoteDraft('');
    setEditingNoteKey(null);
    setLinePendingRemoval(null);
    closeQuantityEditor();
    setManagerApprovalToken('');
    setDiscountApprovalToken('');
    setApprovalMessage('');
    setApprovalPin('');
    setExchangeDraft(null);
    setReceiptId('');
    sessionStorage.removeItem('pos_exchange_draft');
    setMessage(t('pos.message.cartCleared'));
  }
  function openDiscountModal() {
    setDiscountDraft(discount);
    setDiscountTypeDraft(discountType);
    setDiscountApprovalToken(managerApprovalToken);
    setApprovalPin('');
    setApprovalMessage(
      !canDiscount && managerApprovalToken && discount
        ? t('pos.message.discountApproved')
        : '',
    );
    setShowDiscount(true);
  }
  function closeDiscountModal() {
    setShowDiscount(false);
    setApprovalPin('');
    setApprovalMessage('');
    setDiscountDraft('');
    setDiscountApprovalToken('');
  }
  function applyDiscount() {
    if (
      draftManualDiscountTotal <= 0 ||
      discountDraftIsExcessive ||
      (!canDiscount && !discountApprovalToken)
    )
      return;
    setDiscount(discountDraft);
    setDiscountType(discountTypeDraft);
    setManagerApprovalToken(canDiscount ? '' : discountApprovalToken);
    setShowDiscount(false);
    setApprovalPin('');
    setApprovalMessage('');
    setMessage(
      `${
        discountTypeDraft === 'PERCENT'
          ? `${discountDraft}%`
          : `$${Number(discountDraft).toFixed(2)}`
      } ${t('pos.message.discountApplied')}`,
    );
  }
  function removeDiscount() {
    setDiscount('');
    setDiscountDraft('');
    setDiscountType('FIXED');
    setDiscountTypeDraft('FIXED');
    setManagerApprovalToken('');
    setDiscountApprovalToken('');
    setApprovalPin('');
    setApprovalMessage('');
    setShowDiscount(false);
    setMessage(t('pos.message.discountRemoved'));
  }
  function openNoteModal() {
    setNoteDraft(saleNote);
    setShowNote(true);
  }
  function closeNoteModal() {
    setShowNote(false);
    setNoteDraft('');
  }
  function applyOrderNote() {
    const nextNote = noteDraft.trim();
    if (!nextNote) return;
    setSaleNote(nextNote);
    setShowNote(false);
    setNoteDraft('');
    setMessage(t('pos.message.noteAdded'));
  }
  function removeOrderNote() {
    setSaleNote('');
    setNoteDraft('');
    setShowNote(false);
    setMessage(t('pos.message.noteRemoved'));
  }
  function toggleQuickNote(quickNote: string) {
    setNoteDraft((current) => {
      const parts = current
        .split(' · ')
        .map((part) => part.trim())
        .filter(Boolean);
      return parts.includes(quickNote)
        ? parts.filter((part) => part !== quickNote).join(' · ')
        : [...parts, quickNote].join(' · ');
    });
  }
  function openCustomerModal(mode: 'select' | 'create' = 'select') {
    setCustomerModalMode(mode);
    setCustomerQuery('');
    setCustomerFormError('');
    setShowCustomerModal(true);
  }
  function closeCustomerModal() {
    if (isCreatingCustomer) return;
    setShowCustomerModal(false);
    setCustomerModalMode('select');
    setCustomerQuery('');
    setCustomerFormError('');
    setNewCustomerName('');
    setNewCustomerPhone('');
    setNewCustomerEmail('');
  }
  function selectCustomer(nextCustomerId: string) {
    setCustomerId(nextCustomerId);
    setShowCustomerModal(false);
    setCustomerQuery('');
    setMessage(
      nextCustomerId
        ? `${
            customers.find((customer) => customer.id === nextCustomerId)
              ?.name ?? t('entity.customer')
          } ${t('pos.message.selected')}`
        : t('pos.message.walkInSelected'),
    );
  }
  async function holdSale() {
    if (!cart.length || !branchId || isSavingHeldSale) return;
    setIsSavingHeldSale(true);
    try {
      const response = await fetch(`${api}/pos/held`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          branchId,
          label: holdLabel,
          ...(customerId ? { customerId } : {}),
          paymentMethod,
          ...(canDiscount && manualDiscountTotal > 0
            ? { discountTotal: manualDiscountTotal }
            : {}),
          ...(saleNote.trim() ? { note: saleNote.trim() } : {}),
          items: cart,
        }),
      });
      const raw = await response.text();
      const held = raw ? JSON.parse(raw) : {};
      if (!response.ok) {
        setMessage(held.message ?? t('pos.error.holdSale'));
        return;
      }
      setHeldSales((current) => [held, ...current]);
      setCart([]);
      setMobileView('products');
      setCustomerId('');
      setTendered('');
      setDiscount('');
      setDiscountDraft('');
      setManagerApprovalToken('');
      setDiscountApprovalToken('');
      setSaleNote('');
      setNoteDraft('');
      setHoldLabel('');
      setShowHoldSaleModal(false);
      setMessage(t('pos.message.heldSaved', { label: held.label }));
    } catch {
      setMessage(t('pos.error.holdConnection'));
    } finally {
      setIsSavingHeldSale(false);
    }
  }
  async function resumeHeldSale(held: HeldSale) {
    if (cart.length || heldSaleActionId) return;
    setHeldSaleActionId(held.id);
    try {
      const response = await fetch(`${api}/pos/held/${held.id}`, {
        method: 'DELETE',
        headers,
      });
      if (!response.ok) {
        setMessage(t('pos.error.resumeHeld'));
        return;
      }
      setCart(held.items);
      setCustomerId(held.customerId ?? '');
      setPaymentMethod(held.paymentMethod);
      setDiscount((held.discountTotal / 100).toFixed(2));
      setDiscountType('FIXED');
      setDiscountDraft('');
      setManagerApprovalToken('');
      setDiscountApprovalToken('');
      setSaleNote(held.note ?? '');
      setNoteDraft('');
      setTendered('');
      setHeldSales((current) => current.filter((item) => item.id !== held.id));
      setShowHeldSalesModal(false);
      setMessage(t('pos.message.heldResumed', { label: held.label }));
    } catch {
      setMessage(t('pos.error.resumeConnection'));
    } finally {
      setHeldSaleActionId('');
    }
  }
  async function deleteHeldSale(held: HeldSale) {
    if (heldSaleActionId) return;
    setHeldSaleActionId(held.id);
    try {
      const response = await fetch(`${api}/pos/held/${held.id}`, {
        method: 'DELETE',
        headers,
      });
      if (!response.ok) {
        setMessage(t('pos.error.deleteHeld'));
        return;
      }
      setHeldSales((current) => current.filter((item) => item.id !== held.id));
      setHeldPendingDeletion(null);
      setShowHeldSalesModal(true);
      setMessage(t('pos.message.heldDeleted', { label: held.label }));
    } catch {
      setMessage(t('pos.error.deleteConnection'));
    } finally {
      setHeldSaleActionId('');
    }
  }
  function lockTerminal() {
    if (!terminalUsers.length) {
      setMessage(t('pos.error.setPin'));
      return;
    }
    const activeUserId = terminalUsers.some((user) => user.id === cashierId)
      ? cashierId
      : terminalUsers.length === 1
        ? terminalUsers[0].id
        : unlockUserId;
    setUnlockUserId(activeUserId);
    setUnlockPin('');
    setUnlockMessage('');
    setIsUnlocking(false);
    setTerminalLocked(true);
  }
  async function unlockTerminal(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (
      isUnlocking ||
      !unlockUserId ||
      unlockPin.length < 4 ||
      unlockPin.length > 8
    )
      return;
    setIsUnlocking(true);
    setUnlockMessage('');
    try {
      const response = await fetch(`${api}/auth/terminal-unlock`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ userId: unlockUserId, pin: unlockPin }),
      });
      const raw = await response.text();
      const data = parseJsonResponse<{
        message?: string;
        accessToken?: string;
      }>(raw);
      if (!response.ok) {
        setUnlockPin('');
        setUnlockMessage(data.message ?? t('pos.error.incorrectPin'));
        return;
      }
      if (!data.accessToken) {
        setUnlockMessage(t('pos.error.incompleteUnlock'));
        return;
      }
      sessionStorage.setItem('pos_access_token', data.accessToken);
      setTerminalLocked(false);
      window.location.reload();
    } catch {
      setUnlockMessage(t('pos.error.serverConnection'));
    } finally {
      setIsUnlocking(false);
    }
  }
  async function handleAddCustomer(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!newCustomerName.trim() || isCreatingCustomer) return;
    setIsCreatingCustomer(true);
    setCustomerFormError('');
    try {
      const response = await fetch(`${api}/customers`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          name: newCustomerName.trim(),
          phone: newCustomerPhone.trim() || undefined,
          email: newCustomerEmail.trim() || undefined,
        }),
      });
      const raw = await response.text();
      const data = parseJsonResponse<Customer & { message?: string }>(raw);
      if (response.ok) {
        const freshRes = await fetch(`${api}/customers`, { headers });
        if (freshRes.ok) {
          const list = (await freshRes.json()) as Customer[];
          setCustomers(list);
        }
        if (!data.id) {
          setCustomerFormError(
            t('pos.error.customerNotSelected'),
          );
          return;
        }
        setCustomerId(data.id);
        setShowCustomerModal(false);
        setCustomerModalMode('select');
        setNewCustomerName('');
        setNewCustomerPhone('');
        setNewCustomerEmail('');
        setMessage(t('pos.message.customerCreated'));
      } else {
        setCustomerFormError(data.message ?? t('pos.error.createCustomer'));
      }
    } catch {
      setCustomerFormError(t('pos.error.customerNetwork'));
    } finally {
      setIsCreatingCustomer(false);
    }
  }
  async function approveDiscount(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isApprovingDiscount || discountDraftIsExcessive) return;
    setIsApprovingDiscount(true);
    try {
      const response = await fetch(`${api}/auth/manager-approve`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          userId: approvalUserId,
          pin: approvalPin,
          action: 'DISCOUNT',
        }),
      });
      const raw = await response.text();
      const data = parseJsonResponse<{
        message?: string;
        approvalToken?: string;
        manager?: { firstName: string; lastName: string };
      }>(raw);
      if (!response.ok) {
        setApprovalMessage(data.message ?? t('pos.error.approveDiscount'));
        return;
      }
      if (!data.approvalToken || !data.manager) {
        setApprovalMessage(
          t('pos.error.incompleteApproval'),
        );
        return;
      }
      setDiscountApprovalToken(data.approvalToken);
      setApprovalPin('');
      setApprovalMessage(
        t('pos.message.approvedBy', { name: `${data.manager.firstName} ${data.manager.lastName}` }),
      );
    } catch {
      setApprovalMessage(t('pos.error.approvalConnection'));
    } finally {
      setIsApprovingDiscount(false);
    }
  }
  async function checkout() {
    const amountTendered = Math.round(
      Number(tendered || finalTotal / 100) * 100,
    );
    if (!isOnline && (paymentMethod !== 'CASH' || exchangeDraft)) {
      setMessage(
        t('pos.error.offlineCheckout'),
      );
      return false;
    }
    const clientTransactionId = crypto.randomUUID();
    const payload = {
      branchId,
      ...(customerId ? { customerId } : {}),
      clientTransactionId,
      paymentMethod,
      ...(paymentMethod === 'GIFT_CARD' ? { giftCardCode } : {}),
      ...(manualDiscountTotal > 0
        ? { discountTotal: manualDiscountTotal }
        : {}),
      ...(activePromotion ? { promotionId: activePromotion.id } : {}),
      ...(saleNote.trim() ? { note: saleNote.trim() } : {}),
      ...(!canDiscount && managerApprovalToken ? { managerApprovalToken } : {}),
      ...(exchangeDraft
        ? {
            exchangeSourceSaleId: exchangeDraft.sourceSaleId,
            exchangeCredit,
          }
        : {}),
      ...(paymentMethod === 'CASH' ? { amountTendered } : {}),
      items: cart.map((line) => ({
        productId: line.id,
        ...(line.variantId ? { variantId: line.variantId } : {}),
        quantity: line.quantity,
        modifierOptionIds: line.modifierOptionIds,
        ...(line.note?.trim() ? { note: line.note.trim() } : {}),
      })),
    };
    const finishOfflineSale = async () => {
      const updatedProducts = products.map((product) => {
        const sold = cart
          .filter((line) => line.id === product.id)
          .reduce((sum, line) => sum + line.quantity, 0);
        const variants = product.variants.map((variant) => {
          const soldVariant = cart
            .filter((line) => line.variantId === variant.id)
            .reduce((sum, line) => sum + line.quantity, 0);
          return soldVariant
            ? {
                ...variant,
                stockQuantity: Math.max(0, variant.stockQuantity - soldVariant),
              }
            : variant;
        });
        return sold
          ? {
              ...product,
              variants,
              stockQuantity: variants.length
                ? variants.reduce(
                    (sum, variant) => sum + variant.stockQuantity,
                    0,
                  )
                : Math.max(0, product.stockQuantity - sold),
            }
          : product;
      });
      await queueSale({
        id: clientTransactionId,
        branchId,
        cashierId,
        queuedAt: new Date().toISOString(),
        payload,
      });
      setProducts(updatedProducts);
      await cacheCatalog(branchId, updatedProducts);
      setQueuedCount(await queuedSaleCount(cashierId, branchId));
      setCart([]);
      setCustomerId('');
      setTendered('');
      setDiscount('');
      setDiscountDraft('');
      setManagerApprovalToken('');
      setDiscountApprovalToken('');
      setSaleNote('');
      setNoteDraft('');
      setExchangeDraft(null);
      sessionStorage.removeItem('pos_exchange_draft');
      setMessage(
        t('pos.message.offlineSaved'),
      );
    };
    if (!isOnline) {
      await finishOfflineSale();
      return true;
    }
    let response: Response;
    try {
      response = await fetch(`${api}/pos/checkout`, {
        method: 'POST',
        headers,
        body: JSON.stringify(payload),
      });
    } catch {
      setIsOnline(false);
      if (paymentMethod === 'CASH' && !exchangeDraft) {
        await finishOfflineSale();
        return true;
      }
      setMessage(t('pos.error.paymentConnection'));
      return false;
    }
    const raw = await response.text();
    const data = parseJsonResponse<{
      message?: string;
      id?: string;
      total?: number;
    }>(raw);
    if (!response.ok) {
      const errorMessage = data.message ?? t('pos.error.checkout');
      if (
        managerApprovalToken &&
        errorMessage.toLowerCase().includes('manager approval')
      ) {
        setManagerApprovalToken('');
        setApprovalMessage(
          t('pos.error.approvalExpired'),
        );
      }
      setMessage(errorMessage);
      return false;
    }
    if (!data.id || typeof data.total !== 'number') {
      setMessage(
        t('pos.error.incompleteReceipt'),
      );
      return false;
    }
    setCart([]);
    setMobileView('products');
    setCustomerId('');
    setTendered('');
    setDiscount('');
    setDiscountDraft('');
    setSaleNote('');
    setNoteDraft('');
    setManagerApprovalToken('');
    setDiscountApprovalToken('');
    setExchangeDraft(null);
    sessionStorage.removeItem('pos_exchange_draft');
    setReceiptId(data.id);
    if (getDeviceSettings().autoPrint) {
      window.open(`/receipt/${data.id}`, '_blank', 'noopener,noreferrer');
    }
    setMessage(
      t('pos.message.saleComplete', {
        receipt: data.id.slice(-6).toUpperCase(),
        amount: `$${(data.total / 100).toFixed(2)}`,
      }),
    );
    return true;
  }
  function closePaymentModal() {
    if (!isProcessingPayment) setShowPaymentModal(false);
  }
  async function completePayment() {
    if (isProcessingPayment) return;
    setIsProcessingPayment(true);
    try {
      const completed = await checkout();
      if (completed) setShowPaymentModal(false);
    } finally {
      setIsProcessingPayment(false);
    }
  }
  return (
    <main
      className="min-h-screen bg-app text-text-main"
      suppressHydrationWarning
    >
      <header className="sticky top-0 z-40 flex min-h-14 flex-nowrap items-center justify-between gap-2 border-b border-border-subtle bg-card px-4 py-2 sm:min-h-16 sm:flex-wrap sm:gap-3 sm:px-6 sm:py-3 lg:px-8">
        <div className="flex min-w-0 items-center gap-2 sm:flex-wrap sm:gap-3">
          <span className="hidden rounded-full bg-brand-subtle px-3 py-1 text-xs font-bold uppercase tracking-wider text-brand sm:inline-flex">
            {t('pos.cashierPos')}
          </span>
          <h1 className="m-0 truncate text-base font-bold tracking-tight text-text-main sm:text-xl">
            {t('pos.mainCashier')}
          </h1>
          <div
            className={`inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-bold sm:gap-2 sm:px-3 ${
              isOnline
                ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                : 'border-amber-200 bg-amber-50 text-amber-700'
            }`}
          >
            <span
              className={`h-1.5 w-1.5 rounded-full ${
                isOnline ? 'bg-emerald-500' : 'bg-amber-500'
              }`}
            />
            <span>
              {syncing ? t('pos.syncing') : isOnline ? t('pos.online') : t('pos.offline')}
            </span>
            {queuedCount > 0 && (
              <>
                <span className="border-l border-current/20 pl-2 tabular-nums">
                  {t('pos.queued', { count: queuedCount })}
                </span>
                {isOnline && (
                  <Button
                    variant="ghost"
                    size="bareIcon"
                    onClick={() => void syncQueuedSales()}
                    disabled={syncing}
                    title={t('pos.syncQueuedTitle')}
                    aria-label={t('pos.syncQueued')}
                    className="border-transparent text-current shadow-none hover:bg-transparent"
                  >
                    <RefreshCw size={14} />
                  </Button>
                )}
              </>
            )}
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {currentTime && (
            <span className="hidden h-10 items-center rounded-md border border-border-subtle bg-muted-surface px-3 text-xs font-semibold text-text-muted sm:inline-flex">
              {currentTime.toLocaleDateString(locale === 'km' ? 'km-KH' : 'en-US', {
                weekday: 'short',
                month: 'short',
                day: 'numeric',
              })}
              {' · '}
              {currentTime.toLocaleTimeString(locale === 'km' ? 'km-KH' : 'en-US', {
                hour: '2-digit',
                minute: '2-digit',
              })}
            </span>
          )}
          <Button
            variant="secondary"
            size="icon"
            className="h-9 w-9 p-0 sm:h-10 sm:w-auto sm:px-4 sm:text-[0.86rem]"
            title={t('pos.lockTerminal')}
            aria-label={t('pos.lockTerminal')}
            onClick={lockTerminal}
          >
            <LockKeyhole className="h-4 w-4 shrink-0" strokeWidth={2.25} />
            <span className="hidden sm:inline">{t('pos.lockTerminal')}</span>
          </Button>
        </div>
      </header>

      {exchangeDraft && (
        <AlertBanner
          tone="info"
          className="mx-4 mt-4 sm:mx-6 lg:mx-8"
          title={`Exchange credit: $${(exchangeCredit / 100).toFixed(2)}`}
          description={t('pos.exchangeDescription')}
          action={
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setExchangeDraft(null);
                sessionStorage.removeItem('pos_exchange_draft');
              }}
            >
              {t('pos.cancelExchange')}
            </Button>
          }
        />
      )}
      {configuring && (
        <Modal
          title={`${t('pos.customize')} ${configuring.name}${
            configuringVariant ? ` · ${configuringVariant.name}` : ''
          }`}
          density="compactNarrow"
          description={
            configuringVariant
              ? `${configuringVariant.stockQuantity} in stock · $${(
                  (configuringVariant.price ?? configuring.price) / 100
                ).toFixed(2)}`
              : t('pos.chooseAddOns')
          }
          onClose={() => {
            setConfiguring(null);
            setConfiguringVariant(null);
          }}
          size="lg"
          footer={
            <>
              <Button
                variant="secondary"
                onClick={() => {
                  setConfiguring(null);
                  setConfiguringVariant(null);
                }}
              >
                {t('common.cancel')}
              </Button>
              <Button onClick={addConfigured}>{t('pos.addToCart')}</Button>
            </>
          }
        >
          <div className="grid grid-cols-1 gap-5">
            {configuring.modifierGroups.map((group) => (
              <fieldset
                key={group.id}
                className="rounded-lg border border-border-subtle bg-muted-surface p-4"
              >
                <legend className="px-1 text-sm font-bold text-text-main">
                  {group.name}{' '}
                  {group.minSelections
                    ? `(choose ${group.minSelections}${group.maxSelections !== group.minSelections ? `-${group.maxSelections}` : ''})`
                    : '(optional)'}
                </legend>
                <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {group.options.map((option) => (
                    <Button
                      variant={
                        selectedOptions.includes(option.id)
                          ? 'brandSubtle'
                          : 'secondary'
                      }
                      className="h-auto min-h-11 justify-between py-2 text-left"
                      key={option.id}
                      onClick={() => toggleOption(group, option.id)}
                    >
                      <strong className="truncate">{option.name}</strong>
                      {option.priceAdjustment ? (
                        <span className="shrink-0 text-xs text-text-muted">
                          +${(option.priceAdjustment / 100).toFixed(2)}
                        </span>
                      ) : (
                        <span className="shrink-0 text-xs text-text-muted">
                          {t('pos.included')}
                        </span>
                      )}
                    </Button>
                  ))}
                </div>
              </fieldset>
            ))}
          </div>
        </Modal>
      )}
      {variantPicking && (
        <Modal
          title={variantPicking.name}
          description={t('pos.chooseAvailableOption')}
          onClose={() => setVariantPicking(null)}
          size="xl"
          density="compactNarrow"
        >
          <div>
            {(() => {
              const hasSubAttributes =
                variantPicking.variants.length > 3 &&
                variantPicking.variants.some((v) => v.name.includes('/'));

              const renderVariantTile = (
                variant: (typeof variantPicking.variants)[number],
                label: string,
              ) => {
                const qtyInCart = cart
                  .filter(
                    (item) =>
                      item.id === variantPicking.id &&
                      item.variantId === variant.id,
                  )
                  .reduce((sum, item) => sum + item.quantity, 0);

                const remainingStock = Math.max(
                  0,
                  variant.stockQuantity - qtyInCart,
                );
                const isMaxedInCart =
                  variant.stockQuantity > 0 && remainingStock === 0;
                const isOutOfStock = variant.stockQuantity < 1;
                const isDisabled = isOutOfStock || isMaxedInCart;

                return (
                  <Button
                    variant="secondary"
                    size="variantTile"
                    className="flex-col items-stretch gap-0.5 text-left"
                    key={variant.id}
                    disabled={isDisabled}
                    onClick={() => chooseVariant(variantPicking, variant)}
                  >
                    <span className="flex items-center justify-between gap-1.5">
                      <span className="truncate text-sm font-bold text-text-main">
                        {label}
                      </span>
                      <span
                        className={`min-w-5 shrink-0 rounded-full px-1.5 py-0.5 text-center text-[0.65rem] font-bold ${
                          isOutOfStock
                            ? 'bg-rose-50 text-rose-600'
                            : isMaxedInCart
                              ? 'bg-amber-50 text-amber-700'
                              : 'bg-muted-strong text-text-secondary'
                        }`}
                      >
                        {isOutOfStock
                          ? 'Out'
                          : isMaxedInCart
                            ? 'Max'
                            : `${remainingStock}`}
                      </span>
                    </span>
                    <span className="text-xs font-bold text-brand">
                      $
                      {((variant.price ?? variantPicking.price) / 100).toFixed(
                        2,
                      )}
                    </span>
                  </Button>
                );
              };

              if (hasSubAttributes) {
                const parsed = variantPicking.variants.map((v) => {
                  const parts = v.name.split('/').map((s) => s.trim());
                  const isFirstNum = !isNaN(Number(parts[0]));
                  const header = (
                    isFirstNum ? (parts[1] ?? 'Other') : parts[0]
                  ).toUpperCase();
                  const label = isFirstNum ? parts[0] : (parts[1] ?? parts[0]);
                  return { variant: v, header, label };
                });

                const headerOrder: string[] = [];
                const groups: Record<
                  string,
                  {
                    variant: (typeof variantPicking.variants)[number];
                    label: string;
                  }[]
                > = {};

                for (const item of parsed) {
                  if (!groups[item.header]) {
                    groups[item.header] = [];
                    headerOrder.push(item.header);
                  }
                  groups[item.header].push({
                    variant: item.variant,
                    label: item.label,
                  });
                }

                const columnGroup = headerOrder.map((header) => ({
                  header,
                  items: groups[header].sort(
                    (a, b) =>
                      variantSizeRank(a.label) - variantSizeRank(b.label) ||
                      a.label.localeCompare(b.label),
                  ),
                }));
                const activeGroup =
                  columnGroup.find(
                    (group) => group.header === selectedVariantGroup,
                  ) ?? columnGroup[0];

                return (
                  <div>
                    <nav
                      className="mb-4 flex items-center gap-7 overflow-x-auto overflow-y-hidden border-b border-border-subtle [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
                      aria-label={t('pos.productColors')}
                      role="tablist"
                    >
                      {columnGroup.map((group) => {
                        const isActive = group.header === activeGroup.header;
                        return (
                          <TabButton
                            key={group.header}
                            active={isActive}
                            role="tab"
                            aria-selected={isActive}
                            aria-controls="variant-size-options"
                            onClick={() =>
                              setSelectedVariantGroup(group.header)
                            }
                          >
                            <span
                              className={`size-3 shrink-0 rounded-full border border-border-default ${variantColorSwatchClass(group.header)}`}
                              aria-hidden="true"
                            />
                            <span>{group.header}</span>
                          </TabButton>
                        );
                      })}
                    </nav>
                    <div
                      id="variant-size-options"
                      className="rounded-lg border border-border-subtle bg-muted-surface p-3 sm:p-4"
                      role="tabpanel"
                      aria-label={`${activeGroup.header} sizes`}
                    >
                      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
                        {activeGroup.items.map(({ variant, label }) =>
                          renderVariantTile(variant, label),
                        )}
                      </div>
                    </div>
                  </div>
                );
              }

              return (
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                  {variantPicking.variants
                    .slice()
                    .sort(
                      (left, right) =>
                        variantSizeRank(left.name) -
                          variantSizeRank(right.name) ||
                        left.name.localeCompare(right.name),
                    )
                    .map((variant) => renderVariantTile(variant, variant.name))}
                </div>
              );
            })()}
          </div>
        </Modal>
      )}
      {linePendingRemoval && (
        <Modal
          title={`Remove ${linePendingRemoval.name}?`}
          density="compactNarrow"
          description={t('pos.removeItemDescription')}
          icon={<Trash2 size={20} />}
          onClose={() => setLinePendingRemoval(null)}
          size="sm"
          labelledBy="remove-cart-item-title"
          footer={
            <>
              <Button
                variant="secondary"
                onClick={() => setLinePendingRemoval(null)}
              >
                {t('pos.keepItem')}
              </Button>
              <Button
                variant="danger"
                onClick={() => {
                  change(linePendingRemoval.key, 0);
                  setLinePendingRemoval(null);
                }}
              >
                <Trash2 size={16} />
                {t('pos.removeItem')}
              </Button>
            </>
          }
        >
          {(linePendingRemoval.variantLabel ||
            linePendingRemoval.modifierLabel ||
            linePendingRemoval.note) && (
            <div className="flex flex-wrap gap-2">
              {linePendingRemoval.variantLabel && (
                <span className="rounded-full bg-muted-surface px-2 py-1 text-xs font-semibold text-text-secondary">
                  {linePendingRemoval.variantLabel}
                </span>
              )}
              {linePendingRemoval.modifierLabel && (
                <span className="rounded-full bg-muted-surface px-2 py-1 text-xs font-semibold text-text-secondary">
                  {linePendingRemoval.modifierLabel}
                </span>
              )}
              {linePendingRemoval.note && (
                <span className="rounded-full bg-muted-surface px-2 py-1 text-xs font-semibold text-text-secondary">
                  {t('pos.noteAdded')}
                </span>
              )}
            </div>
          )}
        </Modal>
      )}
      {showNote && (
        <Modal
          title={t('pos.orderNote')}
          density="compactNarrow"
          description={t('pos.orderNoteHelp')}
          icon={<MessageSquareText size={20} />}
          onClose={closeNoteModal}
          size="sm"
          footer={
            <>
              {saleNote && (
                <Button
                  variant="dangerSubtle"
                  className="mr-auto"
                  onClick={removeOrderNote}
                >
                  {t('pos.removeNote')}
                </Button>
              )}
              <Button disabled={!noteDraft.trim()} onClick={applyOrderNote}>
                {t('pos.applyNote')}
              </Button>
            </>
          }
        >
          <div>
            <span className="text-xs font-bold uppercase tracking-wider text-text-secondary">
              {t('pos.quickNotes')}
            </span>
            <div className="mt-2 flex flex-wrap gap-2">
              {[
                ['Pickup', t('pos.notePickup')],
                ['Delivery', t('pos.noteDelivery')],
                ['Urgent', t('pos.noteUrgent')],
              ].map(([quickNote, quickNoteLabel]) => {
                const isSelected = noteDraft
                  .split(' · ')
                  .map((part) => part.trim())
                  .includes(quickNote);
                return (
                  <Button
                    key={quickNote}
                    variant={isSelected ? 'brandSubtle' : 'secondary'}
                    size="sm"
                    aria-pressed={isSelected}
                    onClick={() => toggleQuickNote(quickNote)}
                  >
                    {quickNoteLabel}
                  </Button>
                );
              })}
            </div>
          </div>

          <FormField
            className="mt-4"
            label={t('pos.note')}
            sublabel={`${noteDraft.length}/500`}
          >
            <Textarea
              autoFocus
              rows={4}
              maxLength={500}
              value={noteDraft}
              placeholder={t('pos.notePlaceholder')}
              onChange={(event) => setNoteDraft(event.target.value)}
            />
          </FormField>
        </Modal>
      )}
      {showDiscount && (
        <Modal
          title={t('pos.applyDiscount')}
          density="compactNarrow"
          description={t('pos.discountHelp')}
          icon={<BadgePercent size={20} />}
          onClose={closeDiscountModal}
          size="md"
          footer={
            <>
              {manualDiscountTotal > 0 && (
                <Button
                  variant="dangerSubtle"
                  className="mr-auto"
                  onClick={removeDiscount}
                >
                  {t('pos.removeDiscount')}
                </Button>
              )}
              <Button
                disabled={
                  draftManualDiscountTotal <= 0 ||
                  discountDraftIsExcessive ||
                  (!canDiscount && !discountApprovalToken)
                }
                onClick={applyDiscount}
              >
                {t('pos.applyDiscount')}
              </Button>
            </>
          }
        >
          <div className="grid grid-cols-2 gap-2">
            <Button
              variant={
                discountTypeDraft === 'FIXED' ? 'brandSubtle' : 'secondary'
              }
              aria-pressed={discountTypeDraft === 'FIXED'}
              onClick={() => {
                setDiscountTypeDraft('FIXED');
                setDiscountDraft('');
                setDiscountApprovalToken('');
                setApprovalPin('');
                setApprovalMessage('');
              }}
            >
              $ {t('pos.fixed')}
            </Button>
            <Button
              variant={
                discountTypeDraft === 'PERCENT' ? 'brandSubtle' : 'secondary'
              }
              aria-pressed={discountTypeDraft === 'PERCENT'}
              onClick={() => {
                setDiscountTypeDraft('PERCENT');
                setDiscountDraft('');
                setDiscountApprovalToken('');
                setApprovalPin('');
                setApprovalMessage('');
              }}
            >
              % {t('pos.percentage')}
            </Button>
          </div>

          <FormField
            className="mt-4"
            label={t('pos.discountAmount')}
            help={!canDiscount ? t('pos.managerApprovalRequired') : undefined}
          >
            <NumericKeypad
              autoFocus
              value={discountDraft}
              currencySymbol={discountTypeDraft === 'FIXED' ? '$' : undefined}
              suffixText={discountTypeDraft === 'PERCENT' ? '%' : undefined}
              decimalPlaces={2}
              maxIntegerDigits={discountTypeDraft === 'FIXED' ? 7 : 3}
              placeholder={discountTypeDraft === 'FIXED' ? '0.00' : '0'}
              onChange={(value) => {
                setDiscountDraft(value);
                setDiscountApprovalToken('');
                setApprovalPin('');
                setApprovalMessage('');
              }}
            />
          </FormField>

          {discountDraftIsExcessive && (
            <AlertBanner
              tone="error"
              className="mt-3"
              title={t('pos.discountTooHigh')}
              description={`Maximum available discount is $${(
                Math.max(0, total - promotionDiscountTotal) / 100
              ).toFixed(2)}.`}
            />
          )}

          <div className="mt-4 rounded-lg border border-border-subtle bg-muted-surface p-4 text-sm">
            <div className="flex items-center justify-between gap-4 text-text-muted">
              <span>{t('pos.subtotal')}</span>
              <span className="font-semibold tabular-nums text-text-secondary">
                ${(total / 100).toFixed(2)}
              </span>
            </div>
            {promotionDiscountTotal > 0 && (
              <div className="mt-2 flex items-center justify-between gap-4 text-emerald-700">
                <span>{t('pos.promotion')}</span>
                <span className="font-semibold tabular-nums">
                  -${(promotionDiscountTotal / 100).toFixed(2)}
                </span>
              </div>
            )}
            <div className="mt-2 flex items-center justify-between gap-4 text-rose-600">
              <span>{t('pos.discount')}</span>
              <span className="font-semibold tabular-nums">
                -${(draftManualDiscountTotal / 100).toFixed(2)}
              </span>
            </div>
            {draftTaxTotal > 0 && (
              <div className="mt-2 flex items-center justify-between gap-4 text-text-muted">
                <span>{t('pos.taxLabel')}</span>
                <span className="font-semibold tabular-nums text-text-secondary">
                  ${(draftTaxTotal / 100).toFixed(2)}
                </span>
              </div>
            )}
            <div className="mt-3 flex items-center justify-between gap-4 border-t border-border-subtle pt-3">
              <strong className="font-bold text-text-main">{t('pos.newTotal')}</strong>
              <strong className="text-lg font-bold tabular-nums text-brand">
                ${(draftFinalTotal / 100).toFixed(2)}
              </strong>
            </div>
          </div>

          {!canDiscount &&
            draftManualDiscountTotal > 0 &&
            !discountApprovalToken && (
              <form
                className="mt-4 border-t border-border-subtle pt-4"
                onSubmit={approveDiscount}
              >
                <strong className="text-sm font-bold text-text-main">
                  {t('pos.managerApproval')}
                </strong>
                <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <FormField label={t('pos.manager')} required>
                    <CustomSelect
                      value={approvalUserId}
                      onChange={setApprovalUserId}
                      options={managerApprovers.map((user) => ({
                        value: user.id,
                        label: `${user.firstName} ${user.lastName}`,
                        sublabel: user.role,
                      }))}
                      placeholder={t('pos.selectManager')}
                      placement="top"
                    />
                  </FormField>
                  <FormField label={t('pos.managerPin')} required>
                    <PasswordInput
                      required
                      value={approvalPin}
                      onChange={(event) =>
                        setApprovalPin(event.target.value.replace(/\D/g, ''))
                      }
                      inputMode="numeric"
                      minLength={4}
                      maxLength={8}
                      pattern="[0-9]{4,8}"
                    />
                  </FormField>
                </div>
                <Button
                  type="submit"
                  size="sm"
                  className="mt-3 w-full"
                  disabled={
                    isApprovingDiscount ||
                    discountDraftIsExcessive ||
                    !approvalUserId ||
                    approvalPin.length < 4
                  }
                >
                  {isApprovingDiscount ? (
                    <>
                      <RefreshCw size={15} className="animate-spin" />
                      {t('pos.approving')}
                    </>
                  ) : (
                    t('pos.approveDiscount')
                  )}
                </Button>
                {approvalMessage && (
                  <p className="mt-2 text-xs font-medium text-rose-600">
                    {approvalMessage}
                  </p>
                )}
              </form>
            )}

          {!canDiscount && discountApprovalToken && (
            <AlertBanner
              tone="success"
              className="mt-4"
              icon={<CircleCheck size={16} />}
              title={t('pos.managerApproved')}
              description={approvalMessage || t('pos.discountCanApply')}
            />
          )}
        </Modal>
      )}
      {quantityEditingLine &&
        (() => {
          const nextQuantity = Number.parseInt(quantityDraft, 10);
          const isEmpty = quantityDraft === '';
          const isTooHigh =
            Number.isInteger(nextQuantity) &&
            nextQuantity > quantityEditingLine.availableQuantity;
          const isValid =
            Number.isInteger(nextQuantity) &&
            nextQuantity >= 1 &&
            nextQuantity <= quantityEditingLine.availableQuantity;

          return (
            <Modal
              title={t('pos.editQuantity')}
              density="compactNarrow"
              description={quantityEditingLine.name}
              onClose={closeQuantityEditor}
              size="sm"
              footer={
                <Button disabled={!isValid} onClick={updateQuantity}>
                  {t('pos.updateQuantity')}
                </Button>
              }
            >
              <NumericKeypad
                autoFocus
                allowDecimal={false}
                value={quantityDraft}
                maxIntegerDigits={4}
                placeholder="1"
                onChange={setQuantityDraft}
              />
              <div className="mt-3 flex items-center justify-between gap-4 text-xs">
                <span className="font-medium text-text-muted">
                  {t('pos.availableStock')}
                </span>
                <strong className="font-bold tabular-nums text-text-main">
                  {quantityEditingLine.availableQuantity}
                </strong>
              </div>
              {!isEmpty && !isValid && (
                <p className="mt-2 text-xs font-semibold text-rose-600">
                  {isTooHigh
                    ? `Maximum available quantity is ${quantityEditingLine.availableQuantity}.`
                    : 'Enter a quantity of 1 or more.'}
                </p>
              )}
            </Modal>
          );
        })()}
      {showHoldSaleModal && (
        <Modal
          title={t('pos.holdCurrentSale')}
          density="compactNarrow"
          description={t('pos.holdHelp')}
          icon={<Clock3 size={20} />}
          onClose={() => {
            if (!isSavingHeldSale) setShowHoldSaleModal(false);
          }}
          size="sm"
          footer={
            <Button
              disabled={!cart.length || isSavingHeldSale}
              onClick={() => void holdSale()}
            >
              {isSavingHeldSale ? (
                <>
                  <RefreshCw size={16} className="animate-spin" />
                  {t('common.saving')}
                </>
              ) : (
                t('pos.holdSale')
              )}
            </Button>
          }
        >
          <FormField label={t('pos.reference')} sublabel={t('common.optional')}>
            <Input
              autoFocus
              maxLength={80}
              value={holdLabel}
              placeholder={t('pos.referencePlaceholder')}
              onChange={(event) => setHoldLabel(event.target.value)}
            />
          </FormField>
          <div className="mt-4 grid grid-cols-2 gap-3 rounded-lg border border-border-subtle bg-muted-surface p-4">
            <div>
              <span className="text-xs font-medium text-text-muted">{t('pos.itemsLabel')}</span>
              <strong className="mt-1 block text-sm font-bold tabular-nums text-text-main">
                {cart.reduce((sum, line) => sum + line.quantity, 0)}
              </strong>
            </div>
            <div className="text-right">
              <span className="text-xs font-medium text-text-muted">{t('dashboard.total')}</span>
              <strong className="mt-1 block text-sm font-bold tabular-nums text-text-main">
                ${(finalTotal / 100).toFixed(2)}
              </strong>
            </div>
          </div>
        </Modal>
      )}
      {showHeldSalesModal && (
        <Modal
          title={t('pos.heldSales')}
          density="compactNarrow"
          description={`${heldSales.length} ${heldSales.length === 1 ? 'sale' : 'sales'} waiting`}
          icon={<Clock3 size={20} />}
          onClose={() => setShowHeldSalesModal(false)}
          size="lg"
        >
          {cart.length > 0 && heldSales.length > 0 && (
            <AlertBanner
              tone="warning"
              title={t('pos.currentCartActive')}
              description={t('pos.currentCartHelp')}
              className="mb-4"
            />
          )}
          {heldSales.length === 0 ? (
            <EmptyState
              icon={<Clock3 size={24} />}
              title={t('pos.noHeldSales')}
              description={t('pos.noHeldSalesHelp')}
            />
          ) : (
            <div className="grid grid-cols-1 gap-3">
              {heldSales.map((held) => {
                const itemCount = held.items.reduce(
                  (sum, item) => sum + item.quantity,
                  0,
                );
                const heldSubtotal = held.items.reduce(
                  (sum, item) => sum + item.adjustedPrice * item.quantity,
                  0,
                );
                const heldTotal = Math.max(
                  0,
                  heldSubtotal - held.discountTotal,
                );
                const heldCustomer = customers.find(
                  (customer) => customer.id === held.customerId,
                );
                const savedAt = new Date(
                  held.updatedAt || held.createdAt,
                ).toLocaleString('en-US', {
                  month: 'short',
                  day: 'numeric',
                  hour: 'numeric',
                  minute: '2-digit',
                });

                return (
                  <article
                    key={held.id}
                    className="rounded-lg border border-border-subtle bg-card p-4 shadow-sm"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <strong className="block truncate text-sm font-bold text-text-main">
                          {held.label}
                        </strong>
                        <p className="mt-1 truncate text-xs text-text-muted">
                          {heldCustomer?.name ?? t('pos.walkIn')} · {t('pos.saved')}{' '}
                          {savedAt}
                        </p>
                      </div>
                      <strong className="text-base font-bold tabular-nums text-text-main">
                        ${(heldTotal / 100).toFixed(2)}
                      </strong>
                    </div>
                    <p className="mt-3 line-clamp-2 text-xs leading-5 text-text-secondary">
                      {held.items
                        .slice(0, 3)
                        .map(
                          (item) =>
                            `${item.quantity}× ${item.name}${item.variantLabel ? ` · ${item.variantLabel}` : ''}`,
                        )
                        .join(', ')}
                      {held.items.length > 3
                        ? `, ${t('pos.moreCount', { count: held.items.length - 3 })}`
                        : ''}
                    </p>
                    <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-border-subtle pt-3">
                      <span className="text-xs text-text-muted">
                        {t('pos.itemCount', { count: itemCount })} ·{' '}
                        {held.cashier.firstName} {held.cashier.lastName}
                      </span>
                      <div className="flex items-center gap-3">
                        <Button
                          variant="iconBareDanger"
                          size="icon"
                          disabled={Boolean(heldSaleActionId)}
                          aria-label={`Delete ${held.label}`}
                          title={t('pos.deleteHeldSale')}
                          onClick={() => {
                            setShowHeldSalesModal(false);
                            setHeldPendingDeletion(held);
                          }}
                        >
                          <Trash2 size={16} />
                        </Button>
                        <Button
                          size="sm"
                          disabled={
                            cart.length > 0 || Boolean(heldSaleActionId)
                          }
                          onClick={() => void resumeHeldSale(held)}
                        >
                          {heldSaleActionId === held.id ? (
                            <RefreshCw size={16} className="animate-spin" />
                          ) : (
                            <Play size={16} />
                          )}
                          {heldSaleActionId === held.id
                            ? t('pos.resuming')
                            : t('pos.resume')}
                        </Button>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </Modal>
      )}
      {heldPendingDeletion && (
        <Modal
          title={t('pos.deleteNamedHeld', { name: heldPendingDeletion.label })}
          density="compactNarrow"
          description={t('pos.deleteHeldHelp')}
          icon={<Trash2 size={20} />}
          onClose={() => {
            if (heldSaleActionId) return;
            setHeldPendingDeletion(null);
            setShowHeldSalesModal(true);
          }}
          size="sm"
          footer={
            <Button
              variant="danger"
              disabled={Boolean(heldSaleActionId)}
              onClick={() => void deleteHeldSale(heldPendingDeletion)}
            >
              {heldSaleActionId ? (
                <RefreshCw size={16} className="animate-spin" />
              ) : (
                <Trash2 size={16} />
              )}
              {heldSaleActionId ? t('common.deleting') : t('pos.deleteHeldSale')}
            </Button>
          }
        >
          <p className="text-sm leading-6 text-text-secondary">
            {t('pos.resumeInstead')}
          </p>
        </Modal>
      )}
      <div className="grid min-h-[calc(100vh-4rem)] grid-cols-1 lg:grid-cols-[minmax(0,1fr)_24rem] xl:grid-cols-[minmax(0,1fr)_28rem]">
        <section
          className={`${mobileView === 'cart' ? 'hidden sm:block' : 'block'} min-w-0 border-border-subtle px-4 pt-5 pb-24 sm:px-6 sm:py-5 lg:border-r lg:px-8`}
        >
          <div className="mb-4 flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
            <h2 className="m-0 hidden text-xl font-bold tracking-tight text-text-main sm:block">
              {t('pos.allProducts')}
            </h2>
            <div className="flex w-full items-center gap-2 xl:max-w-xl">
              <Input
                ref={scanInput}
                aria-label={t('pos.searchProducts')}
                autoFocus
                placeholder={t('pos.searchProducts')}
                value={query}
                prefixIcon={<Search size={16} />}
                wrapperClassName="flex-1"
                onChange={(e) => {
                  setQuery(e.target.value);
                  if (message.startsWith('Barcode / SKU')) setMessage('');
                }}
                onKeyDown={scan}
              />
              {query ? (
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => {
                    setQuery('');
                    scanInput.current?.focus();
                  }}
                  title={t('pos.clearSearch')}
                  aria-label={t('pos.clearSearch')}
                >
                  <X size={16} />
                </Button>
              ) : null}
              <Button
                variant="secondary"
                onClick={() => scanInput.current?.focus()}
                title={t('pos.focusScanner')}
              >
                <Scan size={16} />
                <span>{t('pos.scan')}</span>
              </Button>
            </div>
          </div>
          {!isOnline && (
            <AlertBanner
              tone="warning"
              icon={<CircleAlert size={17} />}
              className="mb-4"
            >
              {t('pos.offlineCashSync')}
            </AlertBanner>
          )}
          {categories.length > 0 && (
            <div className="mb-5 flex items-center gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              <Button
                variant={!selectedCategoryId ? 'primary' : 'secondary'}
                size="sm"
                className="shrink-0"
                onClick={() => setSelectedCategoryId('')}
              >
                {t('common.all')}
              </Button>
              {categories.map((category) => (
                <Button
                  variant={
                    selectedCategoryId === category.id ? 'primary' : 'secondary'
                  }
                  size="sm"
                  className="shrink-0"
                  key={category.id}
                  onClick={() => setSelectedCategoryId(category.id)}
                >
                  {category.name}
                </Button>
              ))}
            </div>
          )}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
            {filtered.map((product) => (
              <Button
                key={product.id}
                variant="secondary"
                size="productCard"
                className={`group flex-col items-stretch justify-start overflow-hidden text-left shadow-sm hover:border-brand hover:bg-card hover:shadow-md ${
                  addedProductId === product.id
                    ? 'border-brand ring-2 ring-brand/10'
                    : ''
                }`}
                disabled={product.stockQuantity < 1}
                onClick={() => chooseProduct(product)}
              >
                <span className="relative block aspect-4/3 w-full overflow-hidden rounded-md bg-muted-surface">
                  {product.imageUrl ? (
                    <img
                      className="h-full w-full object-cover transition duration-200 group-hover:scale-[1.02]"
                      src={product.imageUrl}
                      alt={product.name}
                      loading="lazy"
                    />
                  ) : (
                    <span
                      className="flex h-full w-full flex-col items-center justify-center gap-2 text-xs font-semibold text-slate-400"
                      aria-hidden="true"
                    >
                      <ImageOff size={24} strokeWidth={1.8} />
                      <span>{t('pos.noImage')}</span>
                    </span>
                  )}
                  {product.stockQuantity < 1 ? (
                    <span className="absolute top-2 right-2 rounded-full bg-rose-600 px-2 py-1 text-[0.68rem] font-bold text-white">
                      {t('pos.soldOut')}
                    </span>
                  ) : product.stockQuantity <= 5 ? (
                    <span className="absolute top-2 right-2 rounded-full border border-amber-200 bg-amber-50 px-2 py-1 text-[0.68rem] font-bold text-amber-700">
                      {t('pos.left', { count: product.stockQuantity })}
                    </span>
                  ) : null}
                </span>
                <strong className="mt-2 block truncate text-sm text-text-main">
                  {product.name}
                </strong>
                <span className="flex items-end justify-between gap-2">
                  <span className="flex min-w-0 items-baseline gap-1.5">
                    {product.regularPrice !== null &&
                      product.price < product.regularPrice && (
                        <span className="text-xs font-semibold text-slate-400 line-through">
                          ${(product.regularPrice / 100).toFixed(2)}
                        </span>
                      )}
                    <b className="text-base font-bold text-brand">
                      ${(product.price / 100).toFixed(2)}
                    </b>
                  </span>
                  {(product.variants.length > 0 ||
                    product.modifierGroups.length > 0) && (
                    <span className="shrink-0 text-[0.65rem] font-bold text-brand">
                      {product.variants.length > 0
                        ? t('pos.options', { count: product.variants.length })
                        : t('pos.custom')}
                    </span>
                  )}
                </span>
              </Button>
            ))}
            {filtered.length === 0 && (
              <div className="col-span-full rounded-lg border border-border-subtle bg-card">
                <EmptyState
                  icon={<Search size={24} />}
                  title={t('pos.noProducts')}
                  description={t('pos.trySearch')}
                />
              </div>
            )}
          </div>
        </section>

        {mobileView === 'products' && securedCartQuantity > 0 && (
          <Button
            size="lg"
            className="fixed right-4 bottom-4 left-4 z-30 h-14 justify-between px-5 text-base shadow-lg sm:hidden"
            aria-label={`Open cart with ${securedCartQuantity} item${securedCartQuantity === 1 ? '' : 's'}, total $${(finalTotal / 100).toFixed(2)}`}
            onClick={() => {
              setMobileView('cart');
              window.scrollTo({ top: 0 });
            }}
          >
            <span className="flex items-center gap-2">
              <ShoppingCart size={18} />
              <span>{t('pos.cart')}</span>
              <span className="font-medium">
                · {t('pos.items', { count: securedCartQuantity })}
              </span>
            </span>
            <span className="tabular-nums">
              ${(finalTotal / 100).toFixed(2)}
            </span>
          </Button>
        )}

        <section
          className={`${mobileView === 'products' ? 'hidden sm:flex' : 'flex'} h-[calc(100dvh-7.125rem)] min-h-0 min-w-0 flex-col bg-card sm:h-[100dvh] lg:sticky lg:top-16 lg:h-[calc(100vh-4rem)]`}
        >
          <div className="flex shrink-0 items-center justify-between gap-3 border-b border-border-subtle px-4 py-2 sm:px-6 sm:py-4">
            <div className="flex min-w-0 items-center gap-2">
              <Button
                variant="ghost"
                size="icon"
                className="h-9 w-9 shrink-0 p-0 sm:hidden"
                aria-label={t('pos.backProducts')}
                title={t('pos.backProducts')}
                onClick={() => {
                  setMobileView('products');
                  window.scrollTo({ top: 0 });
                }}
              >
                <ArrowLeft size={18} />
              </Button>
              <h2 className="m-0 truncate text-base font-bold tracking-tight text-text-main sm:text-xl">
                {t('pos.cart')}
              </h2>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant={heldSales.length ? 'brandSubtle' : 'secondary'}
                size="sm"
                onClick={() => setShowHeldSalesModal(true)}
              >
                <Clock3 size={15} />
                {t('pos.held', { count: heldSales.length })}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="border-transparent text-rose-500 shadow-none hover:bg-rose-50 hover:text-rose-700"
                disabled={!mounted || !cart.length}
                onClick={clearCurrentSale}
              >
                {t('pos.clear')}
              </Button>
            </div>
          </div>
          <div className="min-h-0 flex-1 overscroll-contain overflow-y-auto px-4 pb-3 sm:px-6 sm:pb-0">
            {cart.length ? (
              cart.map((line) => (
                <article
                  className="grid grid-cols-[2.75rem_minmax(0,1fr)_auto_auto_auto] items-center gap-2 border-b border-dashed border-border-subtle py-4"
                  key={line.key}
                >
                  {line.imageUrl ? (
                    <img
                      className="h-11 w-11 rounded-md border border-border-subtle object-cover"
                      src={line.imageUrl}
                      alt={line.name}
                      loading="lazy"
                    />
                  ) : (
                    <span className="flex h-11 w-11 items-center justify-center rounded-md border border-border-subtle bg-muted-surface text-slate-400">
                      <ImageOff
                        size={16}
                        strokeWidth={1.8}
                        aria-hidden="true"
                      />
                    </span>
                  )}
                  <div className="min-w-0">
                    <strong className="block truncate text-sm font-bold text-text-main">
                      {line.name}
                    </strong>
                    <div className="mt-0.5 flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-xs text-text-muted">
                      {line.variantLabel && <span>{line.variantLabel}</span>}
                      {line.modifierLabel && (
                        <span className="truncate">{line.modifierLabel}</span>
                      )}
                      <Button
                        variant="ghost"
                        size="bareIcon"
                        className={`border-transparent text-xs shadow-none hover:bg-transparent hover:text-brand ${
                          line.note ? 'text-brand' : 'text-text-muted'
                        }`}
                        onClick={() =>
                          setEditingNoteKey(
                            editingNoteKey === line.key ? null : line.key,
                          )
                        }
                      >
                        {line.note ? line.note : '+ Note'}
                      </Button>
                    </div>
                  </div>
                  <div className="inline-flex h-8 items-center gap-1 rounded-sm bg-slate-100 p-1">
                    <Button
                      variant="quantityControl"
                      size="quantityControl"
                      onClick={() => change(line.key, line.quantity - 1)}
                      aria-label={`Decrease ${line.name} quantity`}
                    >
                      <Minus size={14} strokeWidth={2} />
                    </Button>
                    <Button
                      variant="quantityValue"
                      size="quantityValue"
                      aria-label={`Set ${line.name} quantity`}
                      title={t('pos.enterQuantity')}
                      onClick={() => {
                        setQuantityEditingLine(line);
                        setQuantityDraft(String(line.quantity));
                      }}
                    >
                      {line.quantity}
                    </Button>
                    <Button
                      variant="quantityControl"
                      size="quantityControl"
                      disabled={line.quantity >= line.availableQuantity}
                      onClick={() =>
                        change(
                          line.key,
                          Math.min(line.quantity + 1, line.availableQuantity),
                        )
                      }
                      aria-label={`Increase ${line.name} quantity`}
                    >
                      <Plus size={14} strokeWidth={2} />
                    </Button>
                  </div>
                  <div className="min-w-[3.5rem] text-right">
                    <strong className="block text-sm font-bold tabular-nums text-text-main">
                      ${((line.adjustedPrice * line.quantity) / 100).toFixed(2)}
                    </strong>
                    {line.quantity > 1 && (
                      <span className="mt-0.5 block whitespace-nowrap text-[0.68rem] text-text-muted">
                        ${(line.adjustedPrice / 100).toFixed(2)} each
                      </span>
                    )}
                  </div>
                  <Button
                    variant="ghost"
                    size="bareIcon"
                    className="self-center border-transparent text-slate-400 shadow-none hover:bg-transparent hover:text-rose-600"
                    aria-label={`Remove ${line.name} from cart`}
                    title={t('pos.removeItem')}
                    onClick={() => setLinePendingRemoval(line)}
                  >
                    <Trash2 size={16} />
                  </Button>

                  {editingNoteKey === line.key && (
                    <div className="col-span-5">
                      <Input
                        autoFocus
                        maxLength={300}
                        value={line.note ?? ''}
                        placeholder={t('pos.lineNotePlaceholder')}
                        onBlur={() => setEditingNoteKey(null)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') setEditingNoteKey(null);
                        }}
                        onChange={(event) =>
                          setCart((current) =>
                            current.map((item) =>
                              item.key === line.key
                                ? { ...item, note: event.target.value }
                                : item,
                            ),
                          )
                        }
                      />
                    </div>
                  )}
                </article>
              ))
            ) : (
              <EmptyState
                className="min-h-72"
                icon={<ShoppingCart size={32} strokeWidth={1.6} />}
                title={t('pos.emptyCart')}
                description={t('pos.chooseProduct')}
              />
            )}
          </div>

          <div className="relative z-20 shrink-0 border-t border-border-subtle bg-card shadow-lg sm:sticky sm:bottom-0">
            <div className="px-4 pt-4 sm:px-6">
              <div className="flex items-center justify-between text-xs text-text-muted">
                <span>{t('pos.subtotal')}</span>
                <b className="font-bold tabular-nums text-text-secondary">
                  ${(total / 100).toFixed(2)}
                </b>
              </div>

              {activePromotion ? (
                <div className="mt-2 flex items-center justify-between text-xs font-semibold text-emerald-700">
                  <span>{t('pos.offer', { name: activePromotion.name })}</span>
                  <span>-${(promotionDiscountTotal / 100).toFixed(2)}</span>
                </div>
              ) : null}

              {manualDiscountTotal > 0 && (
                <div className="mt-2 flex items-center justify-between text-xs font-semibold text-rose-600">
                  <span>{t('pos.discount')}</span>
                  <span>-${(manualDiscountTotal / 100).toFixed(2)}</span>
                </div>
              )}

              {taxRateBasisPoints > 0 && (
                <div className="mt-2 flex items-center justify-between text-xs text-text-muted">
                  <span>{t('pos.tax', { rate: (taxRateBasisPoints / 100).toFixed(2) })}</span>
                  <b className="font-bold tabular-nums text-text-secondary">
                    ${(taxTotal / 100).toFixed(2)}
                  </b>
                </div>
              )}

              {exchangeCredit > 0 && (
                <div className="mt-2 flex items-center justify-between text-xs text-brand">
                  <span>{t('pos.exchangeCredit')}</span>
                  <b className="font-bold tabular-nums">
                    -${(exchangeCredit / 100).toFixed(2)}
                  </b>
                </div>
              )}
            </div>

            <div className="grid grid-cols-3 gap-2 px-4 pt-4 sm:px-6">
              <Button
                variant="dangerSubtle"
                size="sm"
                onClick={openDiscountModal}
              >
                {manualDiscountTotal > 0
                  ? `Discount -$${(manualDiscountTotal / 100).toFixed(2)}`
                  : '+ Discount'}
              </Button>
              <Button
                variant={saleNote ? 'brandSubtle' : 'secondary'}
                size="sm"
                onClick={openNoteModal}
              >
                {saleNote ? t('pos.noteAdded') : t('pos.addNote')}
              </Button>
              <Button variant="neutralSubtle" size="sm" onClick={lockTerminal}>
                <LockKeyhole size={14} />
                {t('pos.lock')}
              </Button>
            </div>

            <div className="grid grid-cols-[minmax(0,1fr)_2.5rem] gap-2 px-4 pt-3 sm:px-6">
              <Button
                variant="secondary"
                size="md"
                className="h-auto min-h-10 justify-start px-3 py-2 text-left"
                onClick={() => openCustomerModal('select')}
              >
                <UserRound size={16} className="shrink-0 text-text-muted" />
                <span className="min-w-0 flex-1">
                  <strong className="block truncate text-sm font-bold text-text-main">
                    {selectedCustomer?.name ?? t('pos.walkIn')}
                  </strong>
                  {selectedCustomer?.phone && (
                    <span className="block truncate text-[0.68rem] font-medium text-text-muted">
                      {selectedCustomer.phone}
                    </span>
                  )}
                </span>
              </Button>
              <Button
                variant="secondary"
                size="icon"
                title={
                  selectedCustomer ? t('pos.useWalkIn') : t('pos.addCustomer')
                }
                aria-label={
                  selectedCustomer ? t('pos.useWalkIn') : t('pos.addCustomer')
                }
                onClick={() =>
                  selectedCustomer
                    ? selectCustomer('')
                    : openCustomerModal('create')
                }
              >
                {selectedCustomer ? <X size={16} /> : <UserPlus size={16} />}
              </Button>
            </div>

            <div className="mt-3 px-4 pb-4 sm:px-6">
              {shiftOpen ? (
                <div className="grid grid-cols-[auto_minmax(0,1fr)] gap-2">
                  <Button
                    variant="dark"
                    size="lg"
                    onClick={() => setShowHoldSaleModal(true)}
                    disabled={!mounted || !cart.length}
                  >
                    {t('pos.hold')}
                  </Button>
                  <Button
                    size="lg"
                    className="min-w-0 justify-between text-base"
                    disabled={!mounted || !cart.length || !branchId}
                    onClick={() => {
                      setShowPaymentModal(true);
                      setTendered('');
                    }}
                  >
                    <span>{t('pos.pay')}</span>
                    <span className="tabular-nums">
                      ${(finalTotal / 100).toFixed(2)}
                    </span>
                  </Button>
                </div>
              ) : (
                <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
                  <div className="flex items-start gap-3">
                    <CircleAlert
                      className="mt-0.5 shrink-0 text-amber-700"
                      size={18}
                    />
                    <div className="min-w-0 flex-1">
                      <strong className="text-sm text-amber-900">
                        {t('pos.openShiftPayment')}
                      </strong>
                      <p className="mt-1 text-xs text-amber-700">
                        {t('pos.startShiftHelp')}
                      </p>
                    </div>
                    <ButtonLink
                      href="/shifts"
                      variant="warningSubtle"
                      size="sm"
                    >
                      {t('pos.openShift')}
                    </ButtonLink>
                  </div>
                </div>
              )}
            </div>
          </div>
        </section>
      </div>
      {message &&
        (() => {
          const lower = message.toLowerCase();
          const isOffline = lower.includes('offline');
          const isError =
            lower.includes('failed') ||
            lower.includes('error') ||
            lower.includes('lost') ||
            lower.includes('not found') ||
            lower.includes('out of stock') ||
            lower.includes('unable');
          const isSuccess =
            lower.includes('success') ||
            lower.includes('sale complete') ||
            lower.includes('resumed') ||
            lower.includes('saved') ||
            lower.includes('created') ||
            lower.includes('added to cart') ||
            lower.includes(' in cart');
          const isCartFeedback =
            lower.includes('added to cart') || lower.includes(' in cart');

          let typeClass = 'info';
          let icon = <Info size={18} />;
          if (isOffline) {
            typeClass = 'offline';
            icon = <CircleAlert size={18} />;
          } else if (isError) {
            typeClass = 'error';
            icon = <CircleAlert size={18} />;
          } else if (isSuccess) {
            typeClass = 'success';
            icon = <CircleCheck size={18} />;
          }

          return (
            <div
              className={`fixed left-1/2 z-[180] w-[min(calc(100%-2rem),28rem)] -translate-x-1/2 items-center gap-3 rounded-lg border bg-card px-4 py-3 text-sm font-semibold shadow-lg ${
                isCartFeedback ? 'hidden sm:flex' : 'flex'
              } ${
                securedCartQuantity > 0 && mobileView === 'products'
                  ? 'bottom-20 sm:bottom-5'
                  : 'bottom-5'
              } ${
                typeClass === 'error'
                  ? 'border-rose-200 text-rose-700'
                  : typeClass === 'success'
                    ? 'border-emerald-200 text-emerald-700'
                    : typeClass === 'offline'
                      ? 'border-amber-200 text-amber-700'
                      : 'border-border-subtle text-text-secondary'
              }`}
              role="status"
            >
              <span className="shrink-0">{icon}</span>
              <span className="min-w-0 flex-1">{message}</span>
              {receiptId && lower.includes('sale complete') && (
                <ButtonLink
                  href={`/receipt/${receiptId}`}
                  variant="secondary"
                  size="sm"
                  className="shrink-0"
                >
                  {t('pos.receipt')}
                </ButtonLink>
              )}
              <Button
                variant="ghost"
                size="bareIcon"
                className="border-transparent text-current shadow-none hover:bg-transparent"
                onClick={() => setMessage('')}
                title={t('pos.closeNotification')}
                aria-label={t('pos.closeNotification')}
              >
                <X size={16} />
              </Button>
            </div>
          );
        })()}
      {terminalLocked && (
        <div
          className="fixed inset-0 z-[250] flex items-center justify-center bg-text-main/75 p-4 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-labelledby="terminal-lock-title"
        >
          <form
            className="w-full max-w-md rounded-lg border border-border-subtle bg-card p-6 shadow-xl sm:p-8"
            onSubmit={unlockTerminal}
          >
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-md border border-brand-border bg-brand-subtle text-brand">
              <LockKeyhole size={22} aria-hidden="true" />
            </div>
            <p className="mt-5 text-center text-xs font-bold uppercase tracking-wider text-brand">
              {t('pos.terminalLocked')}
            </p>
            <h2
              id="terminal-lock-title"
              className="mt-2 text-center text-xl font-bold tracking-tight text-text-main"
            >
              {t('pos.unlockPos')}
            </h2>
            <p className="mt-2 text-center text-sm leading-6 text-text-muted">
              {securedCartQuantity
                ? t('pos.cartSecured', { count: securedCartQuantity })
                : t('pos.unlockInstructions')}
            </p>
            <div className="mt-6 grid grid-cols-1 items-start gap-4">
              <FormField label={t('pos.staffMember')} required>
                <CustomSelect
                  value={unlockUserId}
                  onChange={(value) => {
                    setUnlockUserId(value);
                    setUnlockPin('');
                    setUnlockMessage('');
                  }}
                  disabled={isUnlocking}
                  placeholder={t('pos.selectName')}
                  options={terminalUsers.map((user) => ({
                    value: user.id,
                    label: `${user.firstName} ${user.lastName}`,
                    sublabel: user.role,
                  }))}
                />
              </FormField>

              {selectedUnlockUser && (
                <div className="flex items-center gap-3 rounded-lg border border-brand-border bg-brand-subtle p-3">
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-card text-brand">
                    <UserRound size={17} aria-hidden="true" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <strong className="block truncate text-sm font-bold text-text-main">
                      {selectedUnlockUser.firstName}{' '}
                      {selectedUnlockUser.lastName}
                    </strong>
                    <span className="block text-xs font-medium text-text-muted">
                      {selectedUnlockUser.role}
                    </span>
                  </span>
                  <CircleCheck
                    size={17}
                    className="shrink-0 text-brand"
                    aria-hidden="true"
                  />
                </div>
              )}

              <FormField
                label={t('pos.terminalPin')}
                required
                sublabel={`${unlockPin.length}/8 digits`}
              >
                <NumericKeypad
                  autoFocus
                  value={unlockPin}
                  masked
                  allowDecimal={false}
                  maxIntegerDigits={8}
                  placeholder={t('pos.pinPlaceholder')}
                  onChange={(value) => {
                    setUnlockPin(value.slice(0, 8));
                    setUnlockMessage('');
                  }}
                />
              </FormField>
            </div>

            {unlockMessage && (
              <AlertBanner
                tone="error"
                className="mt-4"
                title={t('pos.unableUnlock')}
                description={unlockMessage}
              />
            )}

            <Button
              type="submit"
              size="lg"
              className="mt-5 w-full"
              disabled={isUnlocking || !unlockUserId || unlockPin.length < 4}
            >
              {isUnlocking ? (
                <>
                  <RefreshCw size={16} className="animate-spin" />
                  Unlocking…
                </>
              ) : (
                <>
                  <LockKeyhole size={16} />
                  {t('pos.unlockPos')}
                </>
              )}
            </Button>
          </form>
        </div>
      )}
      {showPaymentModal && (
        <Modal
          title={t('pos.completePayment')}
          density="compactNarrow"
          description={t('pos.choosePayment')}
          icon={<CreditCard size={20} />}
          onClose={closePaymentModal}
          size="lg"
          footer={
            <Button
              className="w-full sm:w-auto sm:min-w-48"
              disabled={
                isProcessingPayment ||
                discountTotal > total ||
                (!canDiscount &&
                  manualDiscountTotal > 0 &&
                  !managerApprovalToken) ||
                (!isOnline && paymentMethod !== 'CASH') ||
                (paymentMethod === 'CASH' &&
                  (tendered === '' || tenderedCents < finalTotal)) ||
                (paymentMethod === 'GIFT_CARD' && !giftCardCode.trim())
              }
              onClick={() => void completePayment()}
            >
              {isProcessingPayment ? (
                <>
                  <RefreshCw size={16} className="animate-spin" />
                  {t('pos.processing')}
                </>
              ) : (
                t('pos.complete', { amount: `$${(finalTotal / 100).toFixed(2)}` })
              )}
            </Button>
          }
        >
          <div className="grid grid-cols-1 gap-3 sm:gap-5">
            <div className="flex items-center justify-between gap-4 rounded-lg border border-brand-border bg-brand-subtle p-3 sm:p-4">
              <span className="text-xs font-bold uppercase tracking-wider text-brand">
                {t('pos.amountDue')}
              </span>
              <strong className="text-xl font-bold tabular-nums text-text-main sm:text-2xl">
                ${(finalTotal / 100).toFixed(2)}
              </strong>
            </div>

            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-text-secondary">
                {t('pos.paymentMethod')}
              </span>
              <div className="mt-2 grid grid-cols-2 gap-2 sm:mt-3 sm:grid-cols-4">
                {[
                  {
                    value: 'CASH',
                    label: t('payment.cash'),
                    icon: <Banknote size={18} />,
                  },
                  {
                    value: 'CARD',
                    label: t('payment.card'),
                    icon: <CreditCard size={18} />,
                  },
                  { value: 'KHQR', label: 'KHQR', icon: <QrCode size={18} /> },
                  {
                    value: 'GIFT_CARD',
                    label: t('entity.giftCard'),
                    icon: <Gift size={18} />,
                  },
                ].map((method) => (
                  <Button
                    key={method.value}
                    aria-pressed={paymentMethod === method.value}
                    variant={
                      paymentMethod === method.value
                        ? 'brandSubtle'
                        : 'secondary'
                    }
                    className="min-w-0 justify-start"
                    disabled={isProcessingPayment}
                    onClick={() => setPaymentMethod(method.value)}
                  >
                    {method.icon}
                    <span className="truncate">{method.label}</span>
                  </Button>
                ))}
              </div>
            </div>

            {!isOnline && paymentMethod !== 'CASH' && (
              <AlertBanner
                tone="warning"
                icon={<CircleAlert size={17} />}
                title={t('pos.offlineCashOnly')}
                description={t('pos.reconnectPayment')}
              />
            )}

            <div className="min-w-0 border-t border-border-subtle pt-3 sm:pt-5">
              {paymentMethod === 'GIFT_CARD' && (
                <div>
                  <FormField label={t('pos.giftCardCode')} required>
                    <Input
                      required
                      autoFocus
                      value={giftCardCode}
                      onChange={(event) => {
                        setGiftCardCode(event.target.value);
                        setGiftCardBalance(null);
                      }}
                      onBlur={() => void checkGiftCard()}
                      placeholder={t('pos.scanCard')}
                    />
                  </FormField>
                  {giftCardBalance !== null && (
                    <p className="mt-2 text-xs font-semibold text-emerald-700">
                      Available balance: ${(giftCardBalance / 100).toFixed(2)}
                    </p>
                  )}
                </div>
              )}

              {paymentMethod === 'CASH' && (
                <div>
                  <FormField label={t('pos.cashReceived')} required>
                    <NumericKeypad
                      autoFocus
                      density="compact"
                      value={tendered}
                      currencySymbol="$"
                      placeholder={(finalTotal / 100).toFixed(2)}
                      onChange={setTendered}
                    />
                  </FormField>

                  <div className="mt-2 grid grid-cols-5 gap-1.5 sm:mt-3 sm:grid-cols-3 sm:gap-2">
                    {quickCashOptions.map((quick) => (
                      <Button
                        key={quick.value}
                        variant={
                          tendered === quick.value ? 'brandSubtle' : 'secondary'
                        }
                        size="sm"
                        className="min-w-0 px-1.5 text-xs sm:px-3 sm:text-[0.8rem]"
                        onClick={() => setTendered(quick.value)}
                      >
                        {quick.label}
                      </Button>
                    ))}
                  </div>

                  {tendered !== '' && cashShortfall > 0 && (
                    <AlertBanner
                      className="mt-3 sm:mt-4"
                      tone="error"
                      icon={<CircleAlert size={17} />}
                      title={t('pos.moreCashNeeded')}
                      description={`Add $${(cashShortfall / 100).toFixed(2)} to complete payment.`}
                    />
                  )}

                  <div
                    className={`mt-3 flex items-center justify-between rounded-lg border px-3 py-2 sm:mt-4 sm:px-4 sm:py-3 ${
                      tendered !== '' && cashShortfall > 0
                        ? 'border-rose-200 bg-rose-50'
                        : 'border-brand-border bg-brand-subtle'
                    }`}
                  >
                    <span
                      className={`text-xs font-bold uppercase tracking-wider ${
                        tendered !== '' && cashShortfall > 0
                          ? 'text-rose-700'
                          : 'text-brand'
                      }`}
                    >
                      {tendered !== '' && cashShortfall > 0
                        ? t('pos.stillDue')
                        : t('pos.changeDue')}
                    </span>
                    <strong
                      className={`text-lg font-bold tabular-nums sm:text-xl ${
                        tendered !== '' && cashShortfall > 0
                          ? 'text-rose-700'
                          : 'text-brand'
                      }`}
                    >
                      $
                      {(
                        (tendered !== '' && cashShortfall > 0
                          ? cashShortfall
                          : changeDue) / 100
                      ).toFixed(2)}
                    </strong>
                  </div>
                </div>
              )}

              {paymentMethod === 'CARD' && (
                <AlertBanner tone="info" icon={<CreditCard size={17} />}>
                  Insert, swipe, or tap the card to charge{' '}
                  <strong>${(finalTotal / 100).toFixed(2)}</strong>.
                </AlertBanner>
              )}

              {paymentMethod === 'KHQR' && (
                <AlertBanner tone="info" icon={<QrCode size={17} />}>
                  Ask the customer to scan KHQR for{' '}
                  <strong>${(finalTotal / 100).toFixed(2)}</strong>.
                </AlertBanner>
              )}
            </div>
          </div>
        </Modal>
      )}
      {showCustomerModal && (
        <Modal
          title={
            customerModalMode === 'select' ? t('pos.selectCustomer') : t('pos.addCustomer')
          }
          density="compactNarrow"
          description={
            customerModalMode === 'select'
              ? t('pos.chooseCustomer')
              : t('pos.createCustomerHelp')
          }
          icon={
            customerModalMode === 'select' ? (
              <UserRound size={20} />
            ) : (
              <UserPlus size={20} />
            )
          }
          onClose={closeCustomerModal}
          size="md"
          footer={
            customerModalMode === 'create' ? (
              <>
                <Button
                  variant="secondary"
                  disabled={isCreatingCustomer}
                  onClick={() => {
                    setCustomerModalMode('select');
                    setCustomerFormError('');
                    setNewCustomerName('');
                    setNewCustomerPhone('');
                    setNewCustomerEmail('');
                  }}
                >
                  {t('products.back')}
                </Button>
                <Button
                  type="submit"
                  form="pos-add-customer-form"
                  disabled={
                    isCreatingCustomer || newCustomerName.trim().length < 2
                  }
                >
                  {isCreatingCustomer ? (
                    <>
                      <RefreshCw size={16} className="animate-spin" />
                      {t('common.saving')}
                    </>
                  ) : (
                    t('pos.saveCustomer')
                  )}
                </Button>
              </>
            ) : undefined
          }
        >
          {customerModalMode === 'select' ? (
            <div>
              <div className="grid grid-cols-1 items-start gap-2 sm:grid-cols-[minmax(0,1fr)_auto]">
                <Input
                  autoFocus
                  value={customerQuery}
                  prefixIcon={<Search size={16} />}
                  placeholder={t('pos.searchCustomers')}
                  onChange={(event) => setCustomerQuery(event.target.value)}
                />
                <Button onClick={() => setCustomerModalMode('create')}>
                  <UserPlus size={16} />
                  {t('pos.newCustomer')}
                </Button>
              </div>

              <div className="mt-4 max-h-72 space-y-2 overflow-y-auto pr-1">
                {!customerQuery.trim() && (
                  <Button
                    variant={!customerId ? 'brandSubtle' : 'secondary'}
                    className="h-auto w-full justify-start p-3 text-left"
                    aria-pressed={!customerId}
                    onClick={() => selectCustomer('')}
                  >
                    <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-muted-surface text-text-muted">
                      <UserRound size={17} />
                    </span>
                    <span className="min-w-0 flex-1">
                      <strong className="block text-sm font-bold text-text-main">
                        {t('pos.walkIn')}
                      </strong>
                      <span className="block text-xs font-medium text-text-muted">
                        {t('pos.noCustomerProfile')}
                      </span>
                    </span>
                    {!customerId && (
                      <CircleCheck size={17} className="shrink-0 text-brand" />
                    )}
                  </Button>
                )}

                {filteredCustomers.map((customer) => {
                  const isSelected = customer.id === customerId;
                  return (
                    <Button
                      key={customer.id}
                      variant={isSelected ? 'brandSubtle' : 'secondary'}
                      className="h-auto w-full justify-start p-3 text-left"
                      aria-pressed={isSelected}
                      onClick={() => selectCustomer(customer.id)}
                    >
                      <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-muted-surface text-text-muted">
                        <UserRound size={17} />
                      </span>
                      <span className="min-w-0 flex-1">
                        <strong className="block truncate text-sm font-bold text-text-main">
                          {customer.name}
                        </strong>
                        <span className="block truncate text-xs font-medium text-text-muted">
                          {customer.phone ||
                            customer.email ||
                            t('pos.noContact')}
                        </span>
                      </span>
                      {isSelected && (
                        <CircleCheck
                          size={17}
                          className="shrink-0 text-brand"
                        />
                      )}
                    </Button>
                  );
                })}
              </div>

              {filteredCustomers.length === 0 && customerQuery.trim() && (
                <EmptyState
                  className="mt-4 min-h-44 rounded-lg border border-border-subtle bg-muted-surface"
                  icon={<Search size={22} />}
                  title={t('pos.noCustomers')}
                  description={t('pos.noCustomersHelp')}
                  action={
                    <Button
                      size="sm"
                      onClick={() => setCustomerModalMode('create')}
                    >
                      <UserPlus size={15} />
                      {t('pos.newCustomer')}
                    </Button>
                  }
                />
              )}
            </div>
          ) : (
            <div>
              {customerFormError && (
                <AlertBanner
                  tone="error"
                  className="mb-4"
                  title={t('pos.unableSaveCustomer')}
                  description={customerFormError}
                />
              )}
              <form
                id="pos-add-customer-form"
                className="grid grid-cols-1 items-start gap-4"
                onSubmit={handleAddCustomer}
              >
                <FormField label={t('pos.fullName')} required>
                  <Input
                    required
                    autoFocus
                    minLength={2}
                    value={newCustomerName}
                    onChange={(event) => {
                      setNewCustomerName(event.target.value);
                      setCustomerFormError('');
                    }}
                    placeholder={t('pos.fullName')}
                  />
                </FormField>
                <div className="grid grid-cols-1 items-start gap-4 sm:grid-cols-2">
                  <FormField label={t('pos.phone')} sublabel={t('common.optional')}>
                    <Input
                      type="tel"
                      value={newCustomerPhone}
                      onChange={(event) => {
                        setNewCustomerPhone(event.target.value);
                        setCustomerFormError('');
                      }}
                      placeholder={t('pos.phone')}
                    />
                  </FormField>
                  <FormField label={t('pos.email')} sublabel={t('common.optional')}>
                    <Input
                      type="email"
                      value={newCustomerEmail}
                      onChange={(event) => {
                        setNewCustomerEmail(event.target.value);
                        setCustomerFormError('');
                      }}
                      placeholder={t('pos.email')}
                    />
                  </FormField>
                </div>
              </form>
            </div>
          )}
        </Modal>
      )}
    </main>
  );
}
