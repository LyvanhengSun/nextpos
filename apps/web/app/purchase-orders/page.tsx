'use client';

import { FormEvent, Fragment, useEffect, useMemo, useState } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  PackageCheck,
  Plus,
  Search,
  Trash2,
  Truck,
  X,
} from 'lucide-react';
import {
  AlertBanner,
  Button,
  CustomSelect,
  FormField,
  Input,
  PageHeading,
} from '../../components/ui/';
import { PageContainer } from '../../components/layout/page-container';
import { useI18n } from '../../lib/i18n';

const api = '/api';
type Product = {
  id: string;
  name: string;
  sku: string;
  cost: number | null;
  variants: { id: string; name: string; sku: string; cost: number | null }[];
};
type Supplier = { id: string; name: string };
type SupplierCatalogItem = {
  productId: string;
  variantId: string | null;
  supplierSku: string | null;
  lastCost: number | null;
  isPreferred: boolean;
  product: { id: string; name: string; sku: string };
  variant: { id: string; name: string; sku: string } | null;
};
type Line = {
  productId: string;
  variantId?: string;
  quantity: number;
  unitCost: string;
};
type AddedEditLine = {
  key: string;
  productId: string;
  variantId?: string;
  quantity: string;
  unitCost: string;
};
type Order = {
  id: string;
  reference: string | null;
  note: string | null;
  expectedDeliveryDate: string | null;
  status: string;
  submittedAt: string | null;
  approvedAt: string | null;
  approvedBy: { firstName: string; lastName: string } | null;
  rejectionReason: string | null;
  dispatchedAt: string | null;
  dispatchedBy: { firstName: string; lastName: string } | null;
  supplierConfirmedAt: string | null;
  supplierConfirmationReference: string | null;
  confirmedDeliveryDate: string | null;
  changeRequests: {
    id: string;
    reason: string;
    createdAt: string;
    requestedBy: { firstName: string; lastName: string };
  }[];
  createdAt: string;
  branch: { name: string };
  supplier: { name: string };
  items: {
    id: string;
    quantityOrdered: number;
    quantityReceived: number;
    unitCost: number | null;
    product: { name: string; sku: string };
    variant: { name: string; sku: string } | null;
  }[];
};
const fieldStyle = {
  boxSizing: 'border-box' as const,
  width: '100%',
  marginTop: 5,
  padding: '9px 11px',
  borderRadius: 8,
  border: '1.5px solid #e2e8f0',
  background: '#fff',
  color: '#0f172a',
  fontSize: '0.84rem',
};
const labelStyle = { fontSize: '0.78rem', fontWeight: 700, color: '#475569' };
const cardStyle = {
  background: '#fff',
  borderRadius: 14,
  border: '1px solid #e2e8f0',
  boxShadow: '0 1px 3px rgba(15,23,42,0.04)',
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
  onPageChange: (value: number) => void;
  onPageSizeChange: (value: number) => void;
}) {
  const { t } = useI18n();
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const start = total ? (page - 1) * pageSize + 1 : 0;
  const end = Math.min(page * pageSize, total);
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border-subtle px-4 py-3 text-xs text-text-muted sm:px-8">
      <span>
        {t('purchaseOrders.showing')}{' '}
        <strong className="text-text-secondary">
          {start}–{end}
        </strong>{' '}
        {t('purchaseOrders.of')} <strong className="text-text-secondary">{total}</strong>
      </span>
      <div className="flex items-center gap-2">
        <label className="inline-flex items-center gap-1.5 whitespace-nowrap">
          {t('purchaseOrders.rows')}
          <CustomSelect
            value={String(pageSize)}
            onChange={(value) => onPageSizeChange(Number(value))}
            options={[
              { value: '10', label: '10' },
              { value: '25', label: '25' },
              { value: '50', label: '50' },
            ]}
            className="w-20"
          />
        </label>
        <span className="whitespace-nowrap">
          {t('purchaseOrders.pageCount', { page, pages })}
        </span>
        <Button
          type="button"
          disabled={page === 1}
          onClick={() => onPageChange(page - 1)}
          variant="secondary"
          size="icon"
          className="size-8 shrink-0 rounded-md text-text-secondary hover:border-brand hover:text-brand disabled:border-border-subtle disabled:bg-muted-surface disabled:text-slate-300"
        >
          <ChevronLeft size={16} />
        </Button>
        <Button
          type="button"
          disabled={page === pages}
          onClick={() => onPageChange(page + 1)}
          variant="secondary"
          size="icon"
          className="size-8 shrink-0 rounded-md text-text-secondary hover:border-brand hover:text-brand disabled:border-border-subtle disabled:bg-muted-surface disabled:text-slate-300"
        >
          <ChevronRight size={16} />
        </Button>
      </div>
    </div>
  );
}

export default function PurchaseOrdersPage() {
  const { t, locale } = useI18n();
  const [products, setProducts] = useState<Product[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [supplierCatalog, setSupplierCatalog] = useState<SupplierCatalogItem[]>(
    [],
  );
  const [selectedSupplierId, setSelectedSupplierId] = useState('');
  const [loadingSupplierCatalog, setLoadingSupplierCatalog] = useState(false);
  const [orders, setOrders] = useState<Order[]>([]);
  const [role, setRole] = useState('');
  const [lines, setLines] = useState<Line[]>([]);
  const [target, setTarget] = useState('');
  const [quantity, setQuantity] = useState('');
  const [unitCost, setUnitCost] = useState('');
  const [message, setMessage] = useState('');
  const [editingOrder, setEditingOrder] = useState<Order | null>(null);
  const [editMode, setEditMode] = useState<'DRAFT' | 'CHANGE_REQUEST'>('DRAFT');
  const [changeReason, setChangeReason] = useState('');
  const [editAddedLines, setEditAddedLines] = useState<AddedEditLine[]>([]);
  const [editRemovedItemIds, setEditRemovedItemIds] = useState<string[]>([]);
  const [editTarget, setEditTarget] = useState('');
  const [editQuantity, setEditQuantity] = useState('1');
  const [editUnitCost, setEditUnitCost] = useState('');
  const [receivingOrderId, setReceivingOrderId] = useState('');
  const [receivedQuantities, setReceivedQuantities] = useState<
    Record<string, string>
  >({});
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState<'all' | 'open' | 'received'>('all');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
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
    const [productResponse, supplierResponse, orderResponse, meResponse] =
      await Promise.all([
        fetch(`${api}/products`, { headers }),
        fetch(`${api}/suppliers`, { headers }),
        fetch(`${api}/purchase-orders`, { headers }),
        fetch(`${api}/auth/me`, { headers }),
      ]);
    if (!productResponse.ok || !supplierResponse.ok || !orderResponse.ok)
      throw new Error(t('purchaseOrders.error.signIn'));
    const catalog: Product[] = await productResponse.json();
    setProducts(catalog);
    setSuppliers(await supplierResponse.json());
    setOrders(await orderResponse.json());
    if (meResponse.ok) {
      const user = await meResponse.json();
      setRole(String(user.role ?? '').toUpperCase());
    }
    const rawDraft = sessionStorage.getItem('pos_reorder_draft');
    if (rawDraft) {
      try {
        const parsed = JSON.parse(rawDraft) as
          | {
              supplierId?: string;
              items?: {
                productId: string;
                variantId: string | null;
                quantity: number;
              }[];
            }
          | { productId: string; variantId: string | null; quantity: number }[];
        const draft = Array.isArray(parsed) ? parsed : (parsed.items ?? []);
        setLines(
          draft.flatMap((item) => {
            const product = catalog.find(
              (entry) => entry.id === item.productId,
            );
            const variant = item.variantId
              ? product?.variants.find((entry) => entry.id === item.variantId)
              : undefined;
            if (!product || (item.variantId && !variant)) return [];
            const cost = variant?.cost ?? product.cost;
            return [
              {
                productId: product.id,
                ...(variant ? { variantId: variant.id } : {}),
                quantity: item.quantity,
                unitCost:
                  cost === null || cost === undefined
                    ? ''
                    : (cost / 100).toFixed(2),
              },
            ];
          }),
        );
        if (!Array.isArray(parsed) && parsed.supplierId)
          void selectSupplier(parsed.supplierId);
        setMessage(
          t('purchaseOrders.message.reorderDraft'),
        );
      } catch {
        /* Ignore an invalid stale browser draft. */
      }
      sessionStorage.removeItem('pos_reorder_draft');
    }
  }
  useEffect(() => {
    void load().catch((error: Error) => setMessage(error.message));
  }, []);
  async function selectSupplier(supplierId: string) {
    setSelectedSupplierId(supplierId);
    setSupplierCatalog([]);
    setTarget('');
    setUnitCost('');
    if (!supplierId) return;
    setLoadingSupplierCatalog(true);
    try {
      const response = await fetch(`${api}/suppliers/${supplierId}/catalog`, {
        headers,
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok)
        throw new Error(
          data.message ?? t('purchaseOrders.error.loadCatalog'),
        );
      setSupplierCatalog(data);
      if (!data.length)
        setMessage(
          t('purchaseOrders.message.noCatalog'),
        );
      else
        setMessage(
          t('purchaseOrders.message.catalogLoaded'),
        );
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : t('purchaseOrders.error.loadCatalog'),
      );
    } finally {
      setLoadingSupplierCatalog(false);
    }
  }
  function chooseTarget(value: string) {
    setTarget(value);
    const [kind, productId, variantId] = value.split(':');
    const catalogItem = supplierCatalog.find(
      (item) =>
        item.productId === productId &&
        (kind === 'v' ? item.variantId === variantId : !item.variantId),
    );
    setUnitCost(
      catalogItem?.lastCost === null || catalogItem?.lastCost === undefined
        ? ''
        : (catalogItem.lastCost / 100).toFixed(2),
    );
  }
  function addLine() {
    if (!selectedSupplierId) {
      setMessage(t('purchaseOrders.error.selectSupplier'));
      return;
    }
    if (!target || Number(quantity) < 1) {
      setMessage(t('purchaseOrders.error.chooseItem'));
      return;
    }
    const parts = target.split(':');
    const productId = parts[1];
    const variantId = parts[0] === 'v' ? parts[2] : undefined;
    if (
      lines.some(
        (line) => line.productId === productId && line.variantId === variantId,
      )
    ) {
      setMessage(t('purchaseOrders.error.duplicateItem'));
      return;
    }
    const catalogItem = supplierCatalog.find(
      (item) =>
        item.productId === productId && item.variantId === (variantId ?? null),
    );
    const product = products.find((item) => item.id === productId);
    const variant = variantId
      ? product?.variants.find((item) => item.id === variantId)
      : undefined;
    const defaultCost = catalogItem?.lastCost ?? variant?.cost ?? product?.cost;
    setLines((current) => [
      ...current,
      {
        productId,
        ...(variantId ? { variantId } : {}),
        quantity: Number(quantity),
        unitCost:
          unitCost ||
          (defaultCost !== null && defaultCost !== undefined
            ? (defaultCost / 100).toFixed(2)
            : ''),
      },
    ]);
    setTarget('');
    setQuantity('');
    setUnitCost('');
    setMessage('');
  }
  async function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    if (!lines.length) {
      setMessage(t('purchaseOrders.error.addItem'));
      return;
    }
    const form = Object.fromEntries(new FormData(formElement));
    try {
      const response = await fetch(`${api}/purchase-orders`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          ...form,
          items: lines.map((line) => ({
            productId: line.productId,
            ...(line.variantId ? { variantId: line.variantId } : {}),
            quantity: line.quantity,
            ...(line.unitCost
              ? { unitCost: Math.round(Number(line.unitCost) * 100) }
              : {}),
          })),
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        setMessage(data.message ?? t('purchaseOrders.error.create'));
        return;
      }
      formElement.reset();
      setLines([]);
      setMessage(
        t('purchaseOrders.message.created'),
      );
      await load();
    } catch {
      setMessage(t('purchaseOrders.error.api'));
    }
  }
  function startReceiving(order: Order) {
    setReceivingOrderId(order.id);
    setReceivedQuantities(
      Object.fromEntries(
        order.items.map((item) => [
          item.id,
          String(item.quantityOrdered - item.quantityReceived),
        ]),
      ),
    );
  }
  async function receive(order: Order) {
    const items = order.items
      .map((item) => ({
        purchaseOrderItemId: item.id,
        quantity: Number(receivedQuantities[item.id] ?? 0),
      }))
      .filter((item) => item.quantity > 0);
    try {
      const response = await fetch(
        `${api}/purchase-orders/${order.id}/receive`,
        { method: 'POST', headers, body: JSON.stringify({ items }) },
      );
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        setMessage(data.message ?? t('purchaseOrders.error.receive'));
        return;
      }
      setReceivingOrderId('');
      setReceivedQuantities({});
      setMessage(
        t('purchaseOrders.message.received'),
      );
      await load();
    } catch {
      setMessage(t('purchaseOrders.error.api'));
    }
  }
  async function cancelOrder(order: Order) {
    if (
      !window.confirm(
        t('purchaseOrders.confirmCancel', { reference: order.reference ?? t('purchaseOrders.thisOrder') }),
      )
    )
      return;
    try {
      const response = await fetch(
        `${api}/purchase-orders/${order.id}/cancel`,
        { method: 'POST', headers },
      );
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        setMessage(data.message ?? t('purchaseOrders.error.cancel'));
        return;
      }
      setMessage(t('purchaseOrders.message.cancelled'));
      await load();
    } catch {
      setMessage(t('purchaseOrders.error.api'));
    }
  }
  async function submitOrder(order: Order) {
    try {
      const response = await fetch(
        `${api}/purchase-orders/${order.id}/submit`,
        {
          method: 'POST',
          headers,
        },
      );
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        setMessage(data.message ?? t('purchaseOrders.error.submit'));
        return;
      }
      setMessage(t('purchaseOrders.message.submitted'));
      await load();
    } catch {
      setMessage(t('purchaseOrders.error.api'));
    }
  }
  async function approveOrder(order: Order) {
    try {
      const response = await fetch(
        `${api}/purchase-orders/${order.id}/approve`,
        {
          method: 'POST',
          headers,
        },
      );
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        setMessage(data.message ?? t('purchaseOrders.error.approve'));
        return;
      }
      setMessage(t('purchaseOrders.message.approved'));
      await load();
    } catch {
      setMessage(t('purchaseOrders.error.api'));
    }
  }
  async function rejectOrder(order: Order) {
    const reason = window.prompt(t('purchaseOrders.revisionPrompt'));
    if (!reason?.trim()) return;
    try {
      const response = await fetch(
        `${api}/purchase-orders/${order.id}/reject`,
        {
          method: 'POST',
          headers,
          body: JSON.stringify({ reason }),
        },
      );
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        setMessage(data.message ?? t('purchaseOrders.error.reject'));
        return;
      }
      setMessage(t('purchaseOrders.message.rejected'));
      await load();
    } catch {
      setMessage(t('purchaseOrders.error.api'));
    }
  }
  async function dispatchOrder(order: Order) {
    try {
      const response = await fetch(
        `${api}/purchase-orders/${order.id}/dispatch`,
        { method: 'POST', headers },
      );
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        setMessage(
          data.message ?? t('purchaseOrders.error.dispatch'),
        );
        return;
      }
      setMessage(t('purchaseOrders.message.dispatched'));
      await load();
    } catch {
      setMessage(t('purchaseOrders.error.api'));
    }
  }
  function printOrder(order: Order) {
    const popup = window.open('', '_blank');
    if (!popup) {
      setMessage(t('purchaseOrders.error.popup'));
      return;
    }
    const escapeHtml = (value: string) =>
      value.replace(
        /[&<>'"]/g,
        (character) =>
          ({
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            "'": '&#39;',
            '"': '&quot;',
          })[character]!,
      );
    const itemRows = order.items
      .map(
        (item) =>
          `<tr><td>${escapeHtml(item.product.name)}${item.variant ? ` · ${escapeHtml(item.variant.name)}` : ''}</td><td>${escapeHtml(item.variant?.sku ?? item.product.sku)}</td><td>${item.quantityOrdered}</td><td>${item.unitCost === null ? '—' : `$${(item.unitCost / 100).toFixed(2)}`}</td><td>${item.unitCost === null ? '—' : `$${((item.unitCost * item.quantityOrdered) / 100).toFixed(2)}`}</td></tr>`,
      )
      .join('');
    const total = order.items.reduce(
      (sum, item) => sum + (item.unitCost ?? 0) * item.quantityOrdered,
      0,
    );
    const printDate = (value: string) =>
      new Date(value).toLocaleDateString(locale === 'km' ? 'km-KH' : 'en-US');
    const printText = {
      title: escapeHtml(t('purchaseOrders.print.title')),
      issued: escapeHtml(t('purchaseOrders.print.issued', { date: printDate(order.createdAt) })),
      requested: order.expectedDeliveryDate
        ? escapeHtml(t('purchaseOrders.print.requestedDelivery', { date: printDate(order.expectedDeliveryDate) }))
        : '',
      supplier: escapeHtml(t('entity.supplier')),
      items: escapeHtml(t('purchaseOrders.orderItems')),
      item: escapeHtml(t('purchaseOrders.print.item')),
      quantity: escapeHtml(t('suppliers.quantity')),
      unitCost: escapeHtml(t('suppliers.unitCost')),
      lineTotal: escapeHtml(t('purchaseOrders.print.lineTotal')),
      orderTotal: escapeHtml(t('purchaseOrders.print.orderTotal')),
      notes: escapeHtml(t('purchaseOrders.print.notes')),
    };
    popup.document.write(
      `<!doctype html><html lang="${locale}"><head><title>${printText.title} ${escapeHtml(order.reference ?? order.id)}</title><style>body{font-family:Arial,sans-serif;color:#0f172a;max-width:760px;margin:40px auto;padding:0 24px}header{display:flex;justify-content:space-between;border-bottom:2px solid #0f766e;padding-bottom:18px}h1{margin:0;font-size:28px}h2{font-size:16px;margin-top:28px}p{color:#475569;line-height:1.5}table{width:100%;border-collapse:collapse;margin-top:14px}th,td{text-align:left;padding:10px;border-bottom:1px solid #e2e8f0;font-size:13px}th{background:#f8fafc}td:nth-last-child(-n+3),th:nth-last-child(-n+3){text-align:right}.total{text-align:right;font-size:16px;font-weight:bold;margin-top:14px}.note{background:#f8fafc;padding:12px;border-radius:6px}@media print{body{margin:0;max-width:none}}</style></head><body><header><div><h1>${printText.title}</h1><p>${escapeHtml(order.reference ?? order.id)}</p></div><div><strong>${escapeHtml(order.branch.name)}</strong><p>${printText.issued}${printText.requested ? `<br>${printText.requested}` : ''}</p></div></header><h2>${printText.supplier}</h2><p><strong>${escapeHtml(order.supplier.name)}</strong></p><h2>${printText.items}</h2><table><thead><tr><th>${printText.item}</th><th>SKU</th><th>${printText.quantity}</th><th>${printText.unitCost}</th><th>${printText.lineTotal}</th></tr></thead><tbody>${itemRows}</tbody></table><p class="total">${printText.orderTotal}: $${(total / 100).toFixed(2)}</p>${order.note ? `<h2>${printText.notes}</h2><p class="note">${escapeHtml(order.note)}</p>` : ''}</body></html>`,
    );
    popup.document.close();
    popup.focus();
    popup.print();
  }
  async function confirmSupplier(order: Order) {
    const reference = window.prompt(
      t('purchaseOrders.confirmationPrompt'),
    );
    if (reference === null) return;
    const confirmedDeliveryDate = window.prompt(
      t('purchaseOrders.confirmedDatePrompt'),
      order.expectedDeliveryDate?.slice(0, 10) ?? '',
    );
    if (confirmedDeliveryDate === null) return;
    try {
      const response = await fetch(
        `${api}/purchase-orders/${order.id}/confirm-supplier`,
        {
          method: 'POST',
          headers,
          body: JSON.stringify({
            reference,
            ...(confirmedDeliveryDate ? { confirmedDeliveryDate } : {}),
          }),
        },
      );
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        setMessage(data.message ?? t('purchaseOrders.error.confirmSupplier'));
        return;
      }
      setMessage(t('purchaseOrders.message.supplierConfirmed'));
      await load();
    } catch {
      setMessage(t('purchaseOrders.error.api'));
    }
  }
  async function saveOrderEdit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editingOrder) return;
    const form = new FormData(event.currentTarget);
    const items = editingOrder.items
      .filter((item) => !editRemovedItemIds.includes(item.id))
      .map((item) => {
        const cost = String(form.get(`cost-${item.id}`) ?? '').trim();
        return {
          id: item.id,
          quantity: Number(form.get(`quantity-${item.id}`)),
          unitCost: cost ? Math.round(Number(cost) * 100) : null,
        };
      });
    const addedItems = editAddedLines.map((item) => ({
      productId: item.productId,
      ...(item.variantId ? { variantId: item.variantId } : {}),
      quantity: Number(item.quantity),
      unitCost: item.unitCost.trim()
        ? Math.round(Number(item.unitCost) * 100)
        : null,
    }));
    if (
      [...items, ...addedItems].some(
        (item) =>
          !Number.isInteger(item.quantity) ||
          item.quantity < 1 ||
          (item.unitCost !== null &&
            (!Number.isInteger(item.unitCost) || item.unitCost < 0)),
      )
    ) {
      setMessage(t('purchaseOrders.error.validValues'));
      return;
    }
    if (
      editMode === 'CHANGE_REQUEST' &&
      (editRemovedItemIds.length || addedItems.length)
    ) {
      setMessage(
        t('purchaseOrders.error.changeLimits'),
      );
      return;
    }
    if (editMode === 'CHANGE_REQUEST' && !changeReason.trim()) {
      setMessage(t('purchaseOrders.error.changeReason'));
      return;
    }
    try {
      const response = await fetch(
        editMode === 'CHANGE_REQUEST'
          ? `${api}/purchase-orders/${editingOrder.id}/change-requests`
          : `${api}/purchase-orders/${editingOrder.id}`,
        {
          method: editMode === 'CHANGE_REQUEST' ? 'POST' : 'PATCH',
          headers,
          body: JSON.stringify({
            ...(editMode === 'CHANGE_REQUEST'
              ? { reason: changeReason.trim() }
              : {
                  reference: String(form.get('reference') ?? ''),
                  note: String(form.get('note') ?? ''),
                }),
            expectedDeliveryDate: String(
              form.get('expectedDeliveryDate') ?? '',
            ),
            items:
              editMode === 'CHANGE_REQUEST' ? items : [...items, ...addedItems],
          }),
        },
      );
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        setMessage(data.message ?? t('purchaseOrders.error.update'));
        return;
      }
      setEditingOrder(null);
      setEditAddedLines([]);
      setEditRemovedItemIds([]);
      setChangeReason('');
      setMessage(
        editMode === 'CHANGE_REQUEST'
          ? t('purchaseOrders.message.changeSubmitted')
          : t('purchaseOrders.message.updated'),
      );
      await load();
    } catch {
      setMessage(t('purchaseOrders.error.api'));
    }
  }
  function startOrderEdit(order: Order) {
    setEditMode('DRAFT');
    setEditingOrder(order);
    setEditAddedLines([]);
    setEditRemovedItemIds([]);
    setEditTarget('');
    setEditQuantity('1');
    setEditUnitCost('');
  }
  function startChangeRequest(order: Order) {
    setEditMode('CHANGE_REQUEST');
    setChangeReason('');
    setEditingOrder(order);
    setEditAddedLines([]);
    setEditRemovedItemIds([]);
    setEditTarget('');
    setEditQuantity('1');
    setEditUnitCost('');
  }
  async function approveChangeRequest(requestId: string) {
    try {
      const response = await fetch(
        `${api}/purchase-orders/change-requests/${requestId}/approve`,
        { method: 'POST', headers },
      );
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        setMessage(data.message ?? t('purchaseOrders.error.approveChange'));
        return;
      }
      setMessage(t('purchaseOrders.message.changeApproved'));
      await load();
    } catch {
      setMessage(t('purchaseOrders.error.api'));
    }
  }
  function addEditLine() {
    if (
      !editingOrder ||
      !editTarget ||
      !Number.isInteger(Number(editQuantity)) ||
      Number(editQuantity) < 1
    ) {
      setMessage(t('purchaseOrders.error.chooseWholeQuantity'));
      return;
    }
    const [kind, productId, variantId] = editTarget.split(':');
    const resolvedVariantId = kind === 'v' ? variantId : undefined;
    const duplicateExisting = editingOrder.items.some(
      (item) =>
        item.product.sku ===
          products.find((product) => product.id === productId)?.sku &&
        (resolvedVariantId
          ? item.variant?.sku ===
            products
              .find((product) => product.id === productId)
              ?.variants.find((variant) => variant.id === resolvedVariantId)
              ?.sku
          : !item.variant),
    );
    if (
      duplicateExisting ||
      editAddedLines.some(
        (item) =>
          item.productId === productId && item.variantId === resolvedVariantId,
      )
    ) {
      setMessage(t('purchaseOrders.error.duplicateItem'));
      return;
    }
    const product = products.find((item) => item.id === productId);
    const variant = resolvedVariantId
      ? product?.variants.find((item) => item.id === resolvedVariantId)
      : undefined;
    setEditAddedLines((current) => [
      ...current,
      {
        key: `${productId}:${resolvedVariantId ?? 'product'}`,
        productId,
        ...(resolvedVariantId ? { variantId: resolvedVariantId } : {}),
        quantity: editQuantity,
        unitCost:
          editUnitCost ||
          (variant?.cost ?? product?.cost) === null ||
          (variant?.cost ?? product?.cost) === undefined
            ? ''
            : ((variant?.cost ?? product?.cost ?? 0) / 100).toFixed(2),
      },
    ]);
    setEditTarget('');
    setEditQuantity('1');
    setEditUnitCost('');
  }
  const productOptions = supplierCatalog.map((item) => ({
    value: item.variant
      ? `v:${item.productId}:${item.variantId}`
      : `p:${item.productId}`,
    label: item.variant
      ? `${item.product.name} — ${item.variant.name} · ${item.supplierSku || item.variant.sku}${item.isPreferred ? ` · ${t('suppliers.preferred')}` : ''}`
      : `${item.product.name} · ${item.supplierSku || item.product.sku}${item.isPreferred ? ` · ${t('suppliers.preferred')}` : ''}`,
  }));
  const filteredOrders = useMemo(
    () =>
      orders.filter((order) => {
        const open = !['RECEIVED', 'CANCELLED'].includes(order.status);
        const search =
          `${order.supplier.name} ${order.reference ?? ''} ${order.items.map((item) => `${item.product.name} ${item.variant?.name ?? ''}`).join(' ')}`.toLowerCase();
        return (
          (!query || search.includes(query.toLowerCase())) &&
          (status === 'all' ||
            (status === 'open' ? open : order.status === 'RECEIVED'))
        );
      }),
    [orders, query, status],
  );
  const orderRows = filteredOrders.slice(
    (page - 1) * pageSize,
    page * pageSize,
  );
  const openCount = orders.filter(
    (order) => !['RECEIVED', 'CANCELLED'].includes(order.status),
  ).length;
  const itemName = (line: Line) => {
    const product = products.find((item) => item.id === line.productId);
    const variant = product?.variants.find(
      (item) => item.id === line.variantId,
    );
    return `${product?.name ?? t('entity.product')}${variant ? ` · ${variant.name}` : ''}`;
  };
  const statusBadge = (value: string) => {
    const received = value === 'RECEIVED';
    const partial = value === 'PARTIALLY_RECEIVED';
    const cancelled = value === 'CANCELLED';
    const className = received
      ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
      : partial
        ? 'border-blue-200 bg-blue-50 text-blue-700'
        : cancelled
          ? 'border-border-subtle bg-muted-surface text-text-muted'
          : 'border-amber-200 bg-amber-50 text-amber-700';
    return (
      <span
        className={`inline-flex rounded-full border px-2 py-1 text-xs font-bold ${className}`}
      >
        {t(`purchaseOrders.status.${value}` as Parameters<typeof t>[0])}
      </span>
    );
  };
  const isOrderOverdue = (order: Order) =>
    order.status === 'ORDERED' &&
    !!order.expectedDeliveryDate &&
    new Date(order.expectedDeliveryDate).getTime() <
      new Date().setHours(0, 0, 0, 0);
  return (
    <main className="app-page">
      <PageHeading eyebrow={t('supplierPage.purchasing')} title={t('purchaseOrders.title')} />
      <div>
        <PageContainer>
          {message && (
            <AlertBanner tone="success" className="mb-5">
              {message}
            </AlertBanner>
          )}
          <section className="mb-6 grid grid-cols-1 items-start gap-5 xl:grid-cols-[minmax(0,1.65fr)_minmax(270px,1fr)]">
            <article className="overflow-visible rounded-lg border border-border-subtle bg-card shadow-sm">
              <div className="flex items-center gap-3 border-b border-border-subtle px-4 py-6 sm:px-8">
                <div className="grid size-10 place-items-center rounded-md border border-brand/20 bg-brand-subtle text-brand">
                  <ClipboardList size={18} />
                </div>
                <div>
                  <h2 className="m-0 text-base font-bold tracking-tight text-text-main">
                    {t('purchaseOrders.create')}
                  </h2>
                  <p className="mt-1 mb-0 text-xs text-text-muted">
                    {t('purchaseOrders.createHelp')}
                  </p>
                </div>
              </div>
              <form
                onSubmit={create}
                autoComplete="off"
                className="flex flex-col gap-4 px-4 py-6 sm:px-8"
              >
                <div className="grid grid-cols-1 items-start gap-4 md:grid-cols-2">
                  <FormField label={t('entity.supplier')} required>
                    <CustomSelect
                      name="supplierId"
                      value={selectedSupplierId}
                      onChange={(value) => void selectSupplier(value)}
                      placeholder={t('purchaseOrders.selectSupplier')}
                      options={suppliers.map((supplier) => ({
                        value: supplier.id,
                        label: supplier.name,
                      }))}
                    />
                  </FormField>
                  <FormField label={t('purchaseOrders.supplierReference')} sublabel={t('common.optional')}>
                    <Input name="reference" placeholder={t('purchaseOrders.referencePlaceholder')} />
                  </FormField>
                  <FormField label={t('purchaseOrders.expectedDelivery')} sublabel={t('common.optional')}>
                    <Input name="expectedDeliveryDate" type="date" />
                  </FormField>
                </div>
                <FormField label={t('purchaseOrders.note')} sublabel={t('common.optional')}>
                  <Input
                    name="note"
                    placeholder={t('purchaseOrders.notePlaceholder')}
                  />
                </FormField>
                <div className="rounded-lg border border-border-subtle bg-muted-surface p-5">
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <strong className="text-sm font-bold text-text-main">
                      {t('purchaseOrders.orderItems')}
                    </strong>
                    <span className="text-xs text-text-muted">
                      {t('purchaseOrders.itemCount', { count: lines.length })}
                    </span>
                  </div>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-[minmax(0,1fr)_6rem_8rem_auto]">
                    <CustomSelect
                      disabled={
                        !selectedSupplierId ||
                        loadingSupplierCatalog ||
                        !supplierCatalog.length
                      }
                      value={target}
                      onChange={chooseTarget}
                      placeholder={
                        loadingSupplierCatalog
                          ? t('purchaseOrders.loadingSupplierProducts')
                          : !selectedSupplierId
                            ? t('purchaseOrders.selectSupplierFirst')
                            : !supplierCatalog.length
                              ? t('purchaseOrders.noLinkedProducts')
                              : t('purchaseOrders.productOrVariant')
                      }
                      options={productOptions}
                    />
                    <Input
                      type="number"
                      min="1"
                      step="1"
                      value={quantity}
                      onChange={(event) => setQuantity(event.target.value)}
                      placeholder={t('suppliers.quantity')}
                    />
                    <Input
                      type="number"
                      min="0"
                      step="0.01"
                      value={unitCost}
                      onChange={(event) => setUnitCost(event.target.value)}
                      placeholder={t('purchaseOrders.costUsd')}
                    />
                    <Button
                      type="button"
                      onClick={addLine}
                      variant="secondary"
                      size="md"
                    >
                      <Plus size={16} />
                      {t('common.add')}
                    </Button>
                  </div>
                  {lines.length > 0 && (
                    <div className="mt-3 overflow-hidden rounded-md border border-border-subtle bg-card">
                      {lines.map((line) => (
                        <div
                          key={`${line.productId}:${line.variantId ?? ''}`}
                          className="flex items-center justify-between gap-3 border-b border-border-subtle px-3 py-3 last:border-b-0"
                        >
                          <div className="min-w-0">
                            <strong className="text-sm font-bold text-text-main">
                              {line.quantity} × {itemName(line)}
                            </strong>
                            {line.unitCost && (
                              <span className="ml-2 text-xs text-text-muted">
                                {t('purchaseOrders.each', { amount: `$${line.unitCost}` })}
                              </span>
                            )}
                          </div>
                          <Button
                            aria-label={t('purchaseOrders.removeNamed', { name: itemName(line) })}
                            type="button"
                            onClick={() =>
                              setLines((current) =>
                                current.filter(
                                  (item) =>
                                    !(
                                      item.productId === line.productId &&
                                      item.variantId === line.variantId
                                    ),
                                ),
                              )
                            }
                            variant="iconBareDanger"
                            size="bareIcon"
                            className="size-7"
                          >
                            <Trash2 size={16} />
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                <div className="flex justify-end">
                  <Button type="submit">
                    <ClipboardList size={16} />
                    {t('purchaseOrders.create')}
                  </Button>
                </div>
              </form>
            </article>
            <aside className="h-full self-stretch rounded-lg border border-border-subtle bg-card p-5 shadow-sm">
              <div className="mb-3 grid size-10 place-items-center rounded-md border border-brand/20 bg-brand-subtle text-brand">
                <Truck size={19} />
              </div>
              <div>
                <h2 className="m-0 text-base font-bold tracking-tight text-text-main">
                  {t('purchaseOrders.receivingFlow')}
                </h2>
                <p className="mt-1 mb-0 text-xs leading-relaxed text-text-muted">
                  {t('purchaseOrders.receivingHelp')}
                </p>
              </div>
              <div className="mt-5 flex flex-col gap-3">
                {[
                  [
                    '1',
                    t('purchaseOrders.stepCreate'),
                    t('purchaseOrders.stepCreateHelp'),
                  ],
                  [
                    '2',
                    t('purchaseOrders.stepReceive'),
                    t('purchaseOrders.stepReceiveHelp'),
                  ],
                  [
                    '3',
                    t('purchaseOrders.stepTrack'),
                    t('purchaseOrders.stepTrackHelp'),
                  ],
                ].map(([number, title, text]) => (
                  <div key={number} className="flex gap-3">
                    <span className="grid size-6 shrink-0 place-items-center rounded-full bg-brand-subtle text-xs font-bold text-brand">
                      {number}
                    </span>
                    <div>
                      <strong className="text-sm font-bold text-text-main">
                        {title}
                      </strong>
                      <p className="mt-1 mb-0 text-xs leading-relaxed text-text-muted">
                        {text}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </aside>
          </section>
          {editingOrder && (
            <div className="fixed inset-0 z-50">
              <div
                className="absolute inset-0 bg-slate-950/30"
                aria-hidden="true"
                onClick={() => setEditingOrder(null)}
              />
              <section
                role="dialog"
                aria-modal="true"
                aria-labelledby="purchase-order-editor-title"
                className="absolute inset-y-0 right-0 flex w-full max-w-2xl flex-col overflow-hidden border-l border-border-subtle bg-card shadow-xl"
              >
                <div className="flex items-start justify-between gap-4 border-b border-border-subtle px-4 py-6 sm:px-8">
                  <div>
                    <h2
                      id="purchase-order-editor-title"
                      className="m-0 text-xl font-bold tracking-tight text-text-main"
                    >
                      {editMode === 'CHANGE_REQUEST'
                        ? t('purchaseOrders.requestChange')
                        : t('purchaseOrders.edit')}
                    </h2>
                    <p className="mt-1 mb-0 text-xs text-text-muted">
                      {editingOrder.supplier.name} ·{' '}
                      {editMode === 'CHANGE_REQUEST'
                        ? t('purchaseOrders.ownerApprovalHelp')
                        : t('purchaseOrders.editHelp')}
                    </p>
                  </div>
                  <Button
                    type="button"
                    onClick={() => setEditingOrder(null)}
                    variant="ghost"
                    size="icon"
                    aria-label={t('purchaseOrders.closeEditor')}
                  >
                    <X size={18} />
                  </Button>
                </div>
                <form
                  onSubmit={saveOrderEdit}
                  className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-4 py-6 sm:px-8"
                >
                  {editMode === 'CHANGE_REQUEST' && (
                    <FormField label={t('purchaseOrders.changeReason')}>
                      <Input
                        value={changeReason}
                        onChange={(event) =>
                          setChangeReason(event.target.value)
                        }
                        placeholder={t('purchaseOrders.changeReasonPlaceholder')}
                      />
                    </FormField>
                  )}
                  <div className="grid grid-cols-1 items-start gap-4 md:grid-cols-2">
                    <FormField label={t('purchaseOrders.supplierReference')}>
                      <Input
                        name="reference"
                        defaultValue={editingOrder.reference ?? ''}
                      />
                    </FormField>
                    <FormField label={t('purchaseOrders.note')}>
                      <Input
                        name="note"
                        defaultValue={editingOrder.note ?? ''}
                      />
                    </FormField>
                    <FormField label={t('purchaseOrders.expectedDelivery')}>
                      <Input
                        name="expectedDeliveryDate"
                        type="date"
                        defaultValue={
                          editingOrder.expectedDeliveryDate
                            ? editingOrder.expectedDeliveryDate.slice(0, 10)
                            : ''
                        }
                      />
                    </FormField>
                  </div>
                  <div className="overflow-hidden rounded-md border border-border-subtle">
                    {editingOrder.items
                      .filter((item) => !editRemovedItemIds.includes(item.id))
                      .map((item) => (
                        <div
                          key={item.id}
                          className="grid grid-cols-1 items-end gap-3 border-t border-border-subtle px-3 py-3 md:grid-cols-[minmax(0,1fr)_7rem_8rem_auto]"
                        >
                          <strong className="text-sm font-bold text-text-main">
                            {item.product.name}
                            {item.variant ? ` · ${item.variant.name}` : ''}
                            <span className="mt-1 block text-xs font-normal text-text-muted">
                              {item.product.sku}
                            </span>
                          </strong>
                          <FormField label={t('suppliers.quantity')}>
                            <Input
                              required
                              name={`quantity-${item.id}`}
                              type="number"
                              min="1"
                              step="1"
                              defaultValue={item.quantityOrdered}
                            />
                          </FormField>
                          <FormField label={t('purchaseOrders.unitCostUsd')}>
                            <Input
                              name={`cost-${item.id}`}
                              type="number"
                              min="0"
                              step="0.01"
                              defaultValue={
                                item.unitCost === null
                                  ? ''
                                  : (item.unitCost / 100).toFixed(2)
                              }
                            />
                          </FormField>
                          <Button
                            type="button"
                            onClick={() =>
                              setEditRemovedItemIds((current) => [
                                ...current,
                                item.id,
                              ])
                            }
                            variant="dangerSubtle"
                            size="sm"
                          >
                            {t('common.remove')}
                          </Button>
                        </div>
                      ))}
                  </div>
                  {editAddedLines.map((item) => {
                    const product = products.find(
                      (entry) => entry.id === item.productId,
                    );
                    const variant = product?.variants.find(
                      (entry) => entry.id === item.variantId,
                    );
                    return (
                      <div
                        key={item.key}
                        className="grid grid-cols-1 items-end gap-3 rounded-md border border-emerald-200 bg-emerald-50 p-3 md:grid-cols-[minmax(0,1fr)_7rem_8rem_auto]"
                      >
                        <strong className="text-sm font-bold text-text-main">
                          {product?.name ?? t('entity.product')}
                          {variant ? ` · ${variant.name}` : ''}
                          <span className="mt-1 block text-xs font-normal text-emerald-700">
                            {t('purchaseOrders.newLine')}
                          </span>
                        </strong>
                        <FormField label={t('suppliers.quantity')}>
                          <Input
                            type="number"
                            min="1"
                            step="1"
                            value={item.quantity}
                            onChange={(event) =>
                              setEditAddedLines((current) =>
                                current.map((line) =>
                                  line.key === item.key
                                    ? { ...line, quantity: event.target.value }
                                    : line,
                                ),
                              )
                            }
                          />
                        </FormField>
                        <FormField label={t('purchaseOrders.unitCostUsd')}>
                          <Input
                            type="number"
                            min="0"
                            step="0.01"
                            value={item.unitCost}
                            onChange={(event) =>
                              setEditAddedLines((current) =>
                                current.map((line) =>
                                  line.key === item.key
                                    ? { ...line, unitCost: event.target.value }
                                    : line,
                                ),
                              )
                            }
                          />
                        </FormField>
                        <Button
                          type="button"
                          onClick={() =>
                            setEditAddedLines((current) =>
                              current.filter((line) => line.key !== item.key),
                            )
                          }
                          variant="dangerSubtle"
                          size="sm"
                        >
                          {t('common.remove')}
                        </Button>
                      </div>
                    );
                  })}
                  <div className="grid grid-cols-1 items-end gap-3 rounded-md border border-dashed border-border-default p-3 md:grid-cols-[minmax(0,1fr)_7rem_8rem_auto]">
                    <FormField label={t('purchaseOrders.addProductOrVariant')}>
                      <CustomSelect
                        value={editTarget}
                        onChange={setEditTarget}
                        placeholder={t('purchaseOrders.selectItem')}
                        options={products.flatMap((product) =>
                          product.variants.length
                            ? product.variants.map((variant) => ({
                                value: `v:${product.id}:${variant.id}`,
                                label: `${product.name} · ${variant.name} · ${variant.sku}`,
                              }))
                            : [
                                {
                                  value: `p:${product.id}`,
                                  label: `${product.name} · ${product.sku}`,
                                },
                              ],
                        )}
                      />
                    </FormField>
                    <FormField label={t('suppliers.quantity')}>
                      <Input
                        type="number"
                        min="1"
                        step="1"
                        value={editQuantity}
                        onChange={(event) =>
                          setEditQuantity(event.target.value)
                        }
                      />
                    </FormField>
                    <FormField label={t('purchaseOrders.unitCostUsd')}>
                      <Input
                        type="number"
                        min="0"
                        step="0.01"
                        value={editUnitCost}
                        onChange={(event) =>
                          setEditUnitCost(event.target.value)
                        }
                      />
                    </FormField>
                    <Button
                      type="button"
                      onClick={addEditLine}
                      variant="successSubtle"
                      size="sm"
                    >
                      {t('purchaseOrders.addLine')}
                    </Button>
                  </div>
                  <div className="flex justify-end">
                    <Button type="submit">{t('common.saveChanges')}</Button>
                  </div>
                </form>
              </section>
            </div>
          )}
          <section className="overflow-hidden rounded-lg border border-border-subtle bg-card shadow-sm">
            <div className="border-b border-border-subtle px-4 py-6 sm:px-8">
              <div>
                <h2 className="m-0 text-base font-bold tracking-tight text-text-main">
                  {t('purchaseOrders.history')}
                </h2>
                <p className="mt-1 mb-0 text-xs text-text-muted">
                  {t('purchaseOrders.historyCount', { shown: filteredOrders.length, total: orders.length, open: openCount })}
                </p>
              </div>
            </div>
            <div className="flex flex-col gap-3 border-b border-border-subtle px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-8">
              <Input
                prefixIcon={<Search size={16} />}
                value={query}
                onChange={(event) => {
                  setQuery(event.target.value);
                  setPage(1);
                }}
                placeholder={t('purchaseOrders.search')}
                wrapperClassName="sm:max-w-md"
              />
              <div className="flex w-full items-center rounded-md border border-border-subtle bg-app p-1 sm:w-auto">
                {(
                  [
                    { key: 'all', label: t('common.all') },
                    { key: 'open', label: t('purchaseOrders.open') },
                    { key: 'received', label: t('supplierDetail.status.received') },
                  ] as const
                ).map((filter) => (
                  <Button
                    key={filter.key}
                    type="button"
                    onClick={() => {
                      setStatus(filter.key);
                      setPage(1);
                    }}
                    variant={status === filter.key ? 'secondary' : 'ghost'}
                    size="sm"
                    className="flex-1 border-0 shadow-none sm:flex-none"
                  >
                    {filter.label}
                  </Button>
                ))}
              </div>
            </div>
            {orderRows.length ? (
              <>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[790px] border-collapse text-sm">
                    <thead>
                      <tr className="border-b border-border-subtle bg-muted-surface">
                        {[
                          t('purchaseOrders.order'),
                          t('entity.supplier'),
                          t('purchaseOrders.items'),
                          t('purchaseOrders.progress'),
                          t('purchaseOrders.status'),
                          t('purchaseOrders.actions'),
                        ].map((heading) => (
                          <th
                            key={heading}
                            className={`px-4 py-3 text-xs font-bold uppercase tracking-wider text-text-secondary ${heading === 'Actions' ? 'text-right' : 'text-left'}`}
                          >
                            {heading}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {orderRows.map((order) => (
                        <Fragment key={order.id}>
                          <tr
                            className="border-b border-border-subtle hover:bg-muted-surface"
                          >
                            <td className="whitespace-nowrap px-4 py-3 text-text-muted">
                              {order.reference ?? t('supplierDetail.noReference')}
                              <div className="mt-1 text-xs text-text-muted">
                                {new Date(order.createdAt).toLocaleDateString(locale === 'km' ? 'km-KH' : 'en-US')}
                                {order.expectedDeliveryDate && (
                                  <>
                                    <br />
                                    <span
                                      className={
                                        isOrderOverdue(order)
                                          ? 'font-bold text-rose-600'
                                          : 'font-normal text-text-muted'
                                      }
                                    >
                                      {isOrderOverdue(order)
                                        ? t('purchaseOrders.overduePrefix')
                                        : t('purchaseOrders.duePrefix')}
                                      {new Date(
                                        order.expectedDeliveryDate,
                                      ).toLocaleDateString(locale === 'km' ? 'km-KH' : 'en-US')}
                                    </span>
                                  </>
                                )}
                              </div>
                            </td>
                            <td className="px-4 py-3 font-bold text-text-main">
                              {order.supplier.name}
                              <div className="mt-1 text-xs font-normal text-text-muted">
                                {order.branch.name}
                              </div>
                            </td>
                            <td className="max-w-65 px-4 py-3 text-text-secondary">
                              {order.items
                                .map(
                                  (item) =>
                                    `${item.product.name}${item.variant ? ` · ${item.variant.name}` : ''}`,
                                )
                                .join(', ')}
                            </td>
                            <td className="px-4 py-3 text-text-secondary">
                              {order.items.reduce(
                                (sum, item) => sum + item.quantityReceived,
                                0,
                              )}
                              /
                              {order.items.reduce(
                                (sum, item) => sum + item.quantityOrdered,
                                0,
                              )}
                            </td>
                            <td className="px-4 py-3">
                              {statusBadge(order.status)}
                              {order.approvedBy && (
                                <div className="mt-1 text-xs text-text-muted">
                                  {t('purchaseOrders.approvedBy', { name: `${order.approvedBy.firstName} ${order.approvedBy.lastName}` })}
                                </div>
                              )}
                              {order.rejectionReason && (
                                <div className="mt-1 text-xs text-rose-700">
                                  {t('purchaseOrders.revisionNeeded', { reason: order.rejectionReason })}
                                </div>
                              )}
                              {order.dispatchedAt && (
                                <div className="mt-1 text-xs text-brand">
                                  {t('purchaseOrders.sentDate', { date: new Date(order.dispatchedAt).toLocaleDateString(locale === 'km' ? 'km-KH' : 'en-US') })}
                                  {order.dispatchedBy
                                    ? t('purchaseOrders.byNamed', { name: `${order.dispatchedBy.firstName} ${order.dispatchedBy.lastName}` })
                                    : ''}
                                </div>
                              )}
                              {order.supplierConfirmedAt && (
                                <div className="mt-1 text-xs text-blue-700">
                                  {t('purchaseOrders.supplierConfirmed')}
                                  {order.supplierConfirmationReference
                                    ? ` · ${order.supplierConfirmationReference}`
                                    : ''}
                                  {order.confirmedDeliveryDate
                                    ? ` · ${t('purchaseOrders.deliveryDate', { date: new Date(order.confirmedDeliveryDate).toLocaleDateString(locale === 'km' ? 'km-KH' : 'en-US') })}`
                                    : ''}
                                </div>
                              )}
                              {order.changeRequests[0] && (
                                <div className="mt-1 text-xs text-amber-700">
                                  {t('purchaseOrders.changePending', { reason: order.changeRequests[0].reason })}
                                </div>
                              )}
                            </td>
                            <td className="px-4 py-3 text-right">
                              {receivingOrderId !== order.id && (
                                <span className="inline-flex flex-wrap justify-end gap-2">
                                  {order.status === 'DRAFT' && (
                                    <>
                                      <Button
                                        type="button"
                                        onClick={() => startOrderEdit(order)}
                                        variant="secondary"
                                        size="sm"
                                      >
                                        {t('common.edit')}
                                      </Button>
                                      <Button
                                        type="button"
                                        onClick={() => void submitOrder(order)}
                                        variant="successSubtle"
                                        size="sm"
                                      >
                                        {t('purchaseOrders.submit')}
                                      </Button>
                                    </>
                                  )}
                                  {order.status === 'PENDING_APPROVAL' &&
                                    role === 'OWNER' && (
                                      <>
                                        <Button
                                          type="button"
                                          onClick={() =>
                                            void approveOrder(order)
                                          }
                                          variant="successSubtle"
                                          size="sm"
                                        >
                                          {t('purchaseOrders.approveAndOrder')}
                                        </Button>
                                        <Button
                                          type="button"
                                          onClick={() =>
                                            void rejectOrder(order)
                                          }
                                          variant="dangerSubtle"
                                          size="sm"
                                        >
                                          {t('purchaseOrders.requestChanges')}
                                        </Button>
                                      </>
                                    )}
                                  {['ORDERED', 'PARTIALLY_RECEIVED'].includes(
                                    order.status,
                                  ) && (
                                    <>
                                      <Button
                                        type="button"
                                        onClick={() => printOrder(order)}
                                        variant="secondary"
                                        size="sm"
                                      >
                                        {t('purchaseOrders.printPdf')}
                                      </Button>
                                      {order.status === 'ORDERED' &&
                                        !order.dispatchedAt && (
                                          <Button
                                            type="button"
                                            onClick={() =>
                                              void dispatchOrder(order)
                                            }
                                            variant="successSubtle"
                                            size="sm"
                                          >
                                            {t('purchaseOrders.markSent')}
                                          </Button>
                                        )}
                                      {order.status === 'ORDERED' &&
                                        order.dispatchedAt &&
                                        !order.supplierConfirmedAt && (
                                          <Button
                                            type="button"
                                            onClick={() =>
                                              void confirmSupplier(order)
                                            }
                                            variant="secondary"
                                            size="sm"
                                          >
                                            {t('purchaseOrders.supplierConfirmed')}
                                          </Button>
                                        )}
                                      {order.status === 'ORDERED' &&
                                        order.supplierConfirmedAt &&
                                        !order.changeRequests.length && (
                                          <Button
                                            type="button"
                                            onClick={() =>
                                              startChangeRequest(order)
                                            }
                                            variant="warningSubtle"
                                            size="sm"
                                          >
                                            {t('purchaseOrders.requestChangeShort')}
                                          </Button>
                                        )}
                                      {order.status === 'ORDERED' &&
                                        role === 'OWNER' &&
                                        order.changeRequests[0] && (
                                          <Button
                                            type="button"
                                            onClick={() =>
                                              void approveChangeRequest(
                                                order.changeRequests[0].id,
                                              )
                                            }
                                            variant="successSubtle"
                                            size="sm"
                                          >
                                            {t('purchaseOrders.approveChange')}
                                          </Button>
                                        )}
                                      <Button
                                        type="button"
                                        onClick={() => startReceiving(order)}
                                        variant="successSubtle"
                                        size="sm"
                                      >
                                        <PackageCheck size={15} />
                                        {t('purchaseOrders.receive')}
                                      </Button>
                                    </>
                                  )}
                                  {!['RECEIVED', 'CANCELLED'].includes(
                                    order.status,
                                  ) && (
                                    <Button
                                      type="button"
                                      onClick={() => void cancelOrder(order)}
                                      variant="dangerSubtle"
                                      size="sm"
                                    >
                                      {t('common.cancel')}
                                    </Button>
                                  )}
                                </span>
                              )}
                            </td>
                          </tr>
                          {receivingOrderId === order.id && (
                            <tr
                              key={`${order.id}-receive`}
                              className="border-b border-border-subtle"
                            >
                              <td
                                colSpan={6}
                                className="bg-muted-surface px-4 py-5 sm:px-8"
                              >
                                <form
                                  onSubmit={(event) => {
                                    event.preventDefault();
                                    void receive(order);
                                  }}
                                >
                                  <div className="mb-4 flex items-start justify-between gap-3">
                                    <div>
                                      <strong className="text-sm font-bold text-text-main">
                                        {t('purchaseOrders.receiveDelivery')}
                                      </strong>
                                      <span className="ml-2 text-xs text-text-muted">
                                        {t('purchaseOrders.receiveTodayHelp')}
                                      </span>
                                    </div>
                                    <Button
                                      type="button"
                                      onClick={() => {
                                        setReceivingOrderId('');
                                        setReceivedQuantities({});
                                      }}
                                      variant="ghost"
                                      size="sm"
                                    >
                                      {t('common.cancel')}
                                    </Button>
                                  </div>
                                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                                    {order.items.map((item) => {
                                      const remaining =
                                        item.quantityOrdered -
                                        item.quantityReceived;
                                      return (
                                        <FormField
                                          key={item.id}
                                          label={`${item.product.name}${item.variant ? ` · ${item.variant.name}` : ''}`}
                                          sublabel={t('purchaseOrders.remaining', { count: remaining })}
                                        >
                                          <Input
                                            type="number"
                                            min="0"
                                            max={remaining}
                                            value={
                                              receivedQuantities[item.id] ?? '0'
                                            }
                                            onChange={(event) =>
                                              setReceivedQuantities(
                                                (current) => ({
                                                  ...current,
                                                  [item.id]: event.target.value,
                                                }),
                                              )
                                            }
                                          />
                                        </FormField>
                                      );
                                    })}
                                  </div>
                                  <div className="mt-4 flex justify-end">
                                    <Button type="submit">
                                      <PackageCheck size={16} />
                                      {t('purchaseOrders.recordDelivery')}
                                    </Button>
                                  </div>
                                </form>
                              </td>
                            </tr>
                          )}
                        </Fragment>
                      ))}
                    </tbody>
                  </table>
                </div>
                <TablePager
                  total={filteredOrders.length}
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
              <div className="px-4 py-8 text-center text-sm text-text-muted sm:px-8">
                {t('purchaseOrders.emptyFilter')}
              </div>
            )}
          </section>
        </PageContainer>
      </div>
    </main>
  );
}
