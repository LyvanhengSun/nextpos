'use client';

import {
  ChangeEvent,
  FormEvent,
  Fragment,
  useEffect,
  useRef,
  useState,
} from 'react';
import { useRouter } from 'next/navigation';
import {
  Package,
  Plus,
  Minus,
  Upload,
  Tag,
  Layers,
  Sliders,
  Link as LinkIcon,
  DollarSign,
  Settings,
  Edit2,
  Trash2,
  CheckCircle2,
  AlertCircle,
  X,
  Download,
  Sparkles,
  Image as ImageIcon,
  FileSpreadsheet,
  Search,
  Filter,
  Check,
  FolderPlus,
  Eye,
  MoreHorizontal,
  GripVertical,
  Star,
  Building2,
} from 'lucide-react';

import { PageContainer } from '../../components/layout/page-container';
import {
  Button,
  CustomSelect,
  EmptyState,
  FormField,
  Input,
  Modal,
  PageHeading,
} from '../../components/ui/';
import { TabButton, TabCountBadge } from '../../components/ui/tab-button';

/* ─── Types ─────────────────────────────────────────────────────────────── */
type ModifierOption = { id: string; name: string; priceAdjustment: number };
type ModifierGroup = {
  id: string;
  name: string;
  minSelections: number;
  maxSelections: number;
  options: ModifierOption[];
};
type ProductVariant = {
  id: string;
  name: string;
  sku: string;
  barcode: string | null;
  price: number | null;
  isActive: boolean;
  inventory: {
    quantity: number;
    branch: { id: string; name: string; code: string };
  }[];
};
type Product = {
  id: string;
  name: string;
  sku: string;
  barcode: string | null;
  imageUrl: string | null;
  regularPrice: number | null;
  price: number | null;
  cost: number | null;
  reorderLevel: number;
  isActive: boolean;
  category: Category | null;
  modifierGroups: ModifierGroup[];
  variants: ProductVariant[];
};
type OptionSet = {
  id: string;
  name: string;
  minSelections: number;
  maxSelections: number;
  options: { id: string; name: string }[];
};
type Category = { id: string; name: string; _count?: { products: number } };
type Supplier = { id: string; name: string };
type SupplierCatalogItem = {
  id: string;
  supplierId: string;
  variantId: string | null;
  supplierSku: string | null;
  lastCost: number | null;
  isPreferred: boolean;
  supplier: Supplier;
  variant: { id: string; name: string; sku: string } | null;
};
type SupplierPriceHistoryItem = {
  id: string;
  createdAt: string;
  quantity: number;
  unitCost: number;
  reference: string | null;
  supplier: Supplier;
  variant: { id: string; name: string; sku: string } | null;
};
type ImportPreview = {
  valid: boolean;
  totalRows: number;
  errors: { row: number; message: string }[];
  preview: {
    name: string;
    sku: string;
    barcode: string;
    price: number | null;
    openingStock: number | null;
    reorderLevel: number | null;
    category: string;
  }[];
};

type VariantDraft = {
  key: string;
  name: string;
  sku: string;
  barcode: string;
  price: string;
  openingStock: string;
};
type ExistingVariantDraft = {
  id: string;
  name: string;
  sku: string;
  barcode: string;
  regularPrice: string;
  cost: string;
  price: string;
  stock: number;
};
type VariantOptionDraft = { name: string; values: string };
type VariantValueImage = { id: string; imageUrl: string; position: number };
type VariantOptionGallery = {
  id: string;
  name: string;
  values: { id: string; name: string; images: VariantValueImage[] }[];
};

const api = '/api';

type TabType = 'catalog' | 'add' | 'variants' | 'categories' | 'import';
type EditorTab = 'details' | 'suppliers' | 'variants';
type ProductsPageProps = { editorProductId?: string; createProduct?: boolean };

function workspaceTabFromUrl(tab: string | null): TabType {
  return tab === 'categories' || tab === 'import' ? tab : 'catalog';
}
function editorTabFromUrl(tab: string | null): EditorTab {
  return tab === 'suppliers' || tab === 'variants' ? tab : 'details';
}

/* ─── Main Component ────────────────────────────────────────────────────── */
export default function ProductsPage({
  editorProductId,
  createProduct = false,
}: ProductsPageProps) {
  const router = useRouter();
  const isEditorRoute = createProduct || Boolean(editorProductId);
  const [activeTab, setActiveTab] = useState<TabType>(
    isEditorRoute
      ? 'add'
      : workspaceTabFromUrl(
          typeof window === 'undefined'
            ? null
            : new URLSearchParams(window.location.search).get('tab'),
        ),
  );
  const [editorTab, setEditorTab] = useState<EditorTab>(() =>
    editorTabFromUrl(
      typeof window === 'undefined'
        ? null
        : new URLSearchParams(window.location.search).get('tab'),
    ),
  );
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [optionSets, setOptionSets] = useState<OptionSet[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [supplierCatalog, setSupplierCatalog] = useState<SupplierCatalogItem[]>(
    [],
  );
  const [supplierPriceHistory, setSupplierPriceHistory] = useState<
    SupplierPriceHistoryItem[]
  >([]);
  const [supplierId, setSupplierId] = useState('');
  const [supplierVariantId, setSupplierVariantId] = useState('');
  const [supplierSku, setSupplierSku] = useState('');
  const [supplierLastCost, setSupplierLastCost] = useState('');
  const [supplierIsPreferred, setSupplierIsPreferred] = useState(false);
  const [savingSupplierCatalog, setSavingSupplierCatalog] = useState(false);
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState<'success' | 'error'>(
    'success',
  );
  const [pendingDelete, setPendingDelete] = useState<Product | null>(null);
  const [deletingProduct, setDeletingProduct] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [categoryName, setCategoryName] = useState('');
  const [pendingCategoryDelete, setPendingCategoryDelete] =
    useState<Category | null>(null);
  const [deletingCategory, setDeletingCategory] = useState(false);

  // Search & Filter in catalog
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState<
    'all' | 'active' | 'inactive'
  >('all');
  const [isFormCategoryDropdownOpen, setIsFormCategoryDropdownOpen] =
    useState(false);
  const formCategoryDropdownRef = useRef<HTMLDivElement>(null);

  const [isSupplierSelectOpen, setIsSupplierSelectOpen] = useState(false);
  const supplierSelectRef = useRef<HTMLDivElement>(null);
  const [isAppliesToSelectOpen, setIsAppliesToSelectOpen] = useState(false);
  const appliesToSelectRef = useRef<HTMLDivElement>(null);
  const variantActionsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        formCategoryDropdownRef.current &&
        !formCategoryDropdownRef.current.contains(event.target as Node)
      ) {
        setIsFormCategoryDropdownOpen(false);
      }
      if (
        supplierSelectRef.current &&
        !supplierSelectRef.current.contains(event.target as Node)
      ) {
        setIsSupplierSelectOpen(false);
      }
      if (
        appliesToSelectRef.current &&
        !appliesToSelectRef.current.contains(event.target as Node)
      ) {
        setIsAppliesToSelectOpen(false);
      }
      if (
        variantActionsRef.current &&
        !variantActionsRef.current.contains(event.target as Node)
      ) {
        setOpenVariantActionsId(null);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // Product Table Drag & Drop Reordering
  const [draggedProductIndex, setDraggedProductIndex] = useState<number | null>(
    null,
  );
  const canDragProducts =
    searchQuery === '' &&
    selectedCategoryFilter === '' &&
    statusFilter === 'all';

  const handleProductDragStart = (e: React.DragEvent, index: number) => {
    if (!canDragProducts) return;
    setDraggedProductIndex(index);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleProductDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (
      !canDragProducts ||
      draggedProductIndex === null ||
      draggedProductIndex === index
    )
      return;

    const updated = [...products];
    const [movedProduct] = updated.splice(draggedProductIndex, 1);
    updated.splice(index, 0, movedProduct);

    setDraggedProductIndex(index);
    setProducts(updated);
  };

  const handleProductDragEnd = async () => {
    setDraggedProductIndex(null);
    try {
      const orderPayload = products.map((p, idx) => ({
        id: p.id,
        sortOrder: idx,
      }));
      await fetch(`${api}/products/reorder`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ items: orderPayload }),
      });
    } catch {
      // Reordering preserved in state
    }
  };

  // Category Drag & Drop Reordering
  const [draggedCategoryIndex, setDraggedCategoryIndex] = useState<
    number | null
  >(null);

  const handleCategoryDragStart = (e: React.DragEvent, index: number) => {
    setDraggedCategoryIndex(index);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleCategoryDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (draggedCategoryIndex === null || draggedCategoryIndex === index) return;

    const updated = [...categories];
    const [movedItem] = updated.splice(draggedCategoryIndex, 1);
    updated.splice(index, 0, movedItem);

    setDraggedCategoryIndex(index);
    setCategories(updated);
  };

  const handleCategoryDragEnd = async () => {
    setDraggedCategoryIndex(null);
    try {
      const orderPayload = categories.map((c, idx) => ({
        id: c.id,
        sortOrder: idx,
      }));
      await fetch(`${api}/products/categories/reorder`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ items: orderPayload }),
      });
    } catch {
      // Reordering preserved in state
    }
  };

  // Product Edit
  const [editing, setEditing] = useState<Product | null>(null);
  const [editRegularPrice, setEditRegularPrice] = useState('');
  const [editCost, setEditCost] = useState('');
  const [editSalePrice, setEditSalePrice] = useState('');
  const [editReorderLevel, setEditReorderLevel] = useState('');
  const [editName, setEditName] = useState('');
  const [editSku, setEditSku] = useState('');
  const [editBarcode, setEditBarcode] = useState('');
  const [editImageUrl, setEditImageUrl] = useState('');
  const [newImageUrl, setNewImageUrl] = useState('');
  const [uploadingImage, setUploadingImage] = useState(false);
  const [editCategoryId, setEditCategoryId] = useState('');

  // Modifiers & Option Sets
  const [modifierGroup, setModifierGroup] = useState('Size');
  const [preset, setPreset] = useState('DRINK_SIZES');
  const [pricedProductId, setPricedProductId] = useState('');
  const [optionPrices, setOptionPrices] = useState<Record<string, string>>({});

  // CSV Import
  const [csvText, setCsvText] = useState('');
  const [importPreview, setImportPreview] = useState<ImportPreview | null>(
    null,
  );

  // Retail Variants
  const [variantProductId, setVariantProductId] = useState('');
  const [editingVariant, setEditingVariant] = useState<{
    product: Product;
    variant: ProductVariant;
  } | null>(null);
  const [variantName, setVariantName] = useState('');
  const [variantSku, setVariantSku] = useState('');
  const [variantBarcode, setVariantBarcode] = useState('');
  const [variantPrice, setVariantPrice] = useState('');
  const [variantOptions, setVariantOptions] = useState<VariantOptionDraft[]>(
    [],
  );
  const [variantDrafts, setVariantDrafts] = useState<VariantDraft[]>([]);
  const [existingVariantDrafts, setExistingVariantDrafts] = useState<
    ExistingVariantDraft[]
  >([]);
  const [savingExistingVariants, setSavingExistingVariants] = useState(false);
  const [pendingExistingVariantDelete, setPendingExistingVariantDelete] =
    useState<{ id: string; name: string } | null>(null);
  const [deletingExistingVariant, setDeletingExistingVariant] = useState(false);
  const [openVariantActionsId, setOpenVariantActionsId] = useState<
    string | null
  >(null);
  const [stockAdjustmentVariant, setStockAdjustmentVariant] = useState<{
    id: string;
    name: string;
    stock: number;
  } | null>(null);
  const [stockAdjustmentQuantity, setStockAdjustmentQuantity] = useState('');
  const [stockAdjustmentReason, setStockAdjustmentReason] =
    useState('RECEIVED');
  const [savingStockAdjustment, setSavingStockAdjustment] = useState(false);
  const [variantDefaultPrice, setVariantDefaultPrice] = useState('');
  const [variantDefaultStock, setVariantDefaultStock] = useState('0');
  const [variantSkuPrefix, setVariantSkuPrefix] = useState('');
  const [variantSearch, setVariantSearch] = useState('');
  const [selectedVariantDrafts, setSelectedVariantDrafts] = useState<string[]>(
    [],
  );
  const [bulkVariantPrice, setBulkVariantPrice] = useState('');
  const [bulkVariantStock, setBulkVariantStock] = useState('');
  const [variantOptionGalleries, setVariantOptionGalleries] = useState<
    VariantOptionGallery[]
  >([]);
  const [uploadingVariantValueId, setUploadingVariantValueId] = useState('');
  const [editingVariantValue, setEditingVariantValue] = useState<{
    id: string;
    name: string;
  } | null>(null);
  const [pendingVariantValueDelete, setPendingVariantValueDelete] = useState<{
    id: string;
    name: string;
    optionName: string;
  } | null>(null);
  const [deletingVariantValue, setDeletingVariantValue] = useState(false);

  const token =
    typeof window === 'undefined'
      ? ''
      : (sessionStorage.getItem('pos_access_token') ??
        localStorage.getItem('pos_access_token') ??
        '');

  function notify(
    msg: string | string[] | undefined | null,
    type: 'success' | 'error' = 'success',
  ) {
    if (!msg) return;
    const text = Array.isArray(msg) ? msg.join('. ') : String(msg);
    setMessage(text);
    setMessageType(type);
  }

  useEffect(() => {
    if (!message) return;
    const timeout = window.setTimeout(() => setMessage(''), 4500);
    return () => window.clearTimeout(timeout);
  }, [message]);

  function selectWorkspaceTab(tab: 'catalog' | 'categories' | 'import') {
    setActiveTab(tab);
    const params = new URLSearchParams(window.location.search);
    if (tab === 'catalog') params.delete('tab');
    else params.set('tab', tab);
    const query = params.toString();
    window.history.pushState(
      null,
      '',
      query ? `/products?${query}` : '/products',
    );
  }

  function selectEditorTab(tab: EditorTab) {
    setEditorTab(tab);
    const params = new URLSearchParams(window.location.search);
    if (tab === 'details') params.delete('tab');
    else params.set('tab', tab);
    const query = params.toString();
    window.history.pushState(
      null,
      '',
      `${window.location.pathname}${query ? `?${query}` : ''}`,
    );
  }

  async function readJson<T>(response: Response): Promise<T> {
    const raw = await response.text();
    if (!raw)
      throw new Error(
        'The server returned an empty response. Please refresh and try again.',
      );
    try {
      return JSON.parse(raw) as T;
    } catch {
      throw new Error(
        'The server returned an invalid response. Please refresh and try again.',
      );
    }
  }

  async function load() {
    const [productsResponse, categoriesResponse, optionSetsResponse] =
      await Promise.all([
        fetch(`${api}/products`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
        fetch(`${api}/products/categories`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
        fetch(`${api}/products/option-sets`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
      ]);
    if (
      !productsResponse.ok ||
      !categoriesResponse.ok ||
      !optionSetsResponse.ok
    )
      throw new Error('Please sign in again.');
    const [productData, categoryData, optionSetData] = await Promise.all([
      readJson<Product[]>(productsResponse),
      readJson<Category[]>(categoriesResponse),
      readJson<OptionSet[]>(optionSetsResponse),
    ]);
    setProducts(productData);
    setCategories(categoryData);
    setOptionSets(optionSetData);
  }

  useEffect(() => {
    void load().catch((e: Error) => notify(e.message, 'error'));
  }, []);

  useEffect(() => {
    const syncTabFromUrl = () => {
      const tab = new URLSearchParams(window.location.search).get('tab');
      if (isEditorRoute) setEditorTab(editorTabFromUrl(tab));
      else setActiveTab(workspaceTabFromUrl(tab));
    };
    window.addEventListener('popstate', syncTabFromUrl);
    return () => window.removeEventListener('popstate', syncTabFromUrl);
  }, [isEditorRoute]);

  useEffect(() => {
    if (createProduct) {
      setEditing(null);
      setVariantProductId('');
      setVariantOptionGalleries([]);
      setActiveTab('add');
      return;
    }
    const product = products.find((item) => item.id === editorProductId);
    if (product) openProductEditor(product);
  }, [createProduct, editorProductId, products]);

  async function uploadProductImage(
    event: ChangeEvent<HTMLInputElement>,
    editingImage = false,
  ) {
    const file = event.target.files?.[0];
    if (!file) return;
    setUploadingImage(true);
    const body = new FormData();
    body.append('file', file);
    try {
      const response = await fetch(`${api}/products/image-upload`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body,
      });
      const data = await response.json();
      if (!response.ok)
        throw new Error(data.message ?? 'Unable to upload image.');
      const fullUrl = data.imageUrl.startsWith('http')
        ? data.imageUrl
        : `${api}${data.imageUrl}`;
      if (editingImage) setEditImageUrl(fullUrl);
      else setNewImageUrl(fullUrl);
      notify('Image uploaded successfully. Save product to complete.');
    } catch (error) {
      notify(
        error instanceof Error ? error.message : 'Unable to upload image.',
        'error',
      );
    } finally {
      setUploadingImage(false);
      event.target.value = '';
    }
  }

  async function loadVariantOptionGalleries(productId = variantProductId) {
    if (!productId) {
      setVariantOptionGalleries([]);
      return;
    }
    const response = await fetch(
      `${api}/products/${productId}/variant-options`,
      {
        headers: { Authorization: `Bearer ${token}` },
      },
    );
    if (!response.ok) return;
    setVariantOptionGalleries(await response.json());
  }

  async function loadExistingVariants(productId: string) {
    const response = await fetch(`${api}/products/${productId}/variants`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!response.ok) return;
    const variants = (await response.json()) as {
      id: string;
      name: string;
      sku: string;
      barcode: string | null;
      regularPrice: number | null;
      price: number | null;
      cost: number | null;
      inventory: { quantity: number }[];
    }[];
    setExistingVariantDrafts(
      variants.map((variant) => ({
        id: variant.id,
        name: variant.name,
        sku: variant.sku,
        barcode: variant.barcode ?? '',
        regularPrice: (
          (variant.regularPrice ?? variant.price ?? 0) / 100
        ).toFixed(2),
        cost: variant.cost === null ? '' : (variant.cost / 100).toFixed(2),
        price: variant.price === null ? '' : (variant.price / 100).toFixed(2),
        stock: variant.inventory.reduce(
          (total, item) => total + item.quantity,
          0,
        ),
      })),
    );
  }

  async function loadSupplierCatalog(productId: string) {
    const response = await fetch(
      `${api}/products/${productId}/supplier-catalog`,
      {
        headers: { Authorization: `Bearer ${token}` },
      },
    );
    if (!response.ok) throw new Error('Unable to load product suppliers.');
    setSupplierCatalog(await readJson<SupplierCatalogItem[]>(response));
  }

  async function loadSupplierPriceHistory(productId: string) {
    const response = await fetch(
      `${api}/products/${productId}/supplier-price-history`,
      { headers: { Authorization: `Bearer ${token}` } },
    );
    if (!response.ok) throw new Error('Unable to load supplier price history.');
    setSupplierPriceHistory(
      await readJson<SupplierPriceHistoryItem[]>(response),
    );
  }

  async function loadSuppliers() {
    const response = await fetch(`${api}/suppliers`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!response.ok) throw new Error('Unable to load suppliers.');
    setSuppliers(await readJson<Supplier[]>(response));
  }

  function resetSupplierCatalogForm() {
    setSupplierId('');
    setSupplierVariantId('');
    setSupplierSku('');
    setSupplierLastCost('');
    setSupplierIsPreferred(false);
  }

  function editSupplierCatalogItem(item: SupplierCatalogItem) {
    setSupplierId(item.supplierId);
    setSupplierVariantId(item.variantId ?? '');
    setSupplierSku(item.supplierSku ?? '');
    setSupplierLastCost(
      item.lastCost === null ? '' : (item.lastCost / 100).toFixed(2),
    );
    setSupplierIsPreferred(item.isPreferred);
  }

  async function saveSupplierCatalog(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editing || !supplierId) return;
    const cost = supplierLastCost.trim();
    if (cost && (!Number.isFinite(Number(cost)) || Number(cost) < 0)) {
      notify('Enter a valid supplier cost.', 'error');
      return;
    }
    setSavingSupplierCatalog(true);
    try {
      const response = await fetch(
        `${api}/products/${editing.id}/supplier-catalog`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            supplierId,
            ...(supplierVariantId ? { variantId: supplierVariantId } : {}),
            supplierSku,
            lastCost: cost ? Math.round(Number(cost) * 100) : null,
            isPreferred: supplierIsPreferred,
          }),
        },
      );
      const data = await response.json().catch(() => ({}));
      if (!response.ok)
        throw new Error(data.message ?? 'Unable to save supplier details.');
      await loadSupplierCatalog(editing.id);
      await loadSupplierPriceHistory(editing.id);
      resetSupplierCatalogForm();
      notify('Supplier details saved.');
    } catch (error) {
      notify(
        error instanceof Error
          ? error.message
          : 'Unable to save supplier details.',
        'error',
      );
    } finally {
      setSavingSupplierCatalog(false);
    }
  }

  function updateExistingVariant(
    id: string,
    field: 'sku' | 'barcode' | 'regularPrice' | 'price' | 'cost',
    value: string,
  ) {
    setExistingVariantDrafts((current) =>
      current.map((variant) =>
        variant.id === id ? { ...variant, [field]: value } : variant,
      ),
    );
  }

  async function saveExistingVariants() {
    if (!variantProductId || !existingVariantDrafts.length) return;
    setSavingExistingVariants(true);
    try {
      const results = await Promise.all(
        existingVariantDrafts.map(async (variant) => {
          const response = await fetch(
            `${api}/products/${variantProductId}/variants/${variant.id}`,
            {
              method: 'PATCH',
              headers: {
                Authorization: `Bearer ${token}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                sku: variant.sku,
                barcode: variant.barcode,
                regularPrice: Math.round(
                  Number(variant.regularPrice || 0) * 100,
                ),
                price: variant.price.trim()
                  ? Math.round(Number(variant.price) * 100)
                  : null,
                cost: variant.cost.trim()
                  ? Math.round(Number(variant.cost) * 100)
                  : null,
              }),
            },
          );
          if (!response.ok) {
            const data = await response.json().catch(() => ({}));
            throw new Error(data.message ?? `Unable to save ${variant.name}.`);
          }
        }),
      );
      await Promise.all(results);
      notify('Variant prices and identifiers saved.');
      await loadExistingVariants(variantProductId);
      await load();
    } catch (error) {
      notify(
        error instanceof Error ? error.message : 'Unable to save variants.',
        'error',
      );
    } finally {
      setSavingExistingVariants(false);
    }
  }

  async function deleteExistingVariant() {
    if (!pendingExistingVariantDelete || !variantProductId) return;
    setDeletingExistingVariant(true);
    try {
      const response = await fetch(
        `${api}/products/${variantProductId}/variants/${pendingExistingVariantDelete.id}`,
        { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } },
      );
      const data = await response.json().catch(() => ({}));
      if (!response.ok)
        throw new Error(data.message ?? 'Unable to delete variant.');
      setPendingExistingVariantDelete(null);
      await loadExistingVariants(variantProductId);
      await load();
      notify('Variant deleted.');
    } catch (error) {
      notify(
        error instanceof Error ? error.message : 'Unable to delete variant.',
        'error',
      );
    } finally {
      setDeletingExistingVariant(false);
    }
  }

  async function saveStockAdjustment() {
    if (!stockAdjustmentVariant) return;
    const quantityChange = Number(stockAdjustmentQuantity);
    if (!Number.isInteger(quantityChange) || quantityChange === 0) {
      notify('Enter a whole stock change, for example 10 or -2.', 'error');
      return;
    }
    setSavingStockAdjustment(true);
    try {
      const me = await fetch(`${api}/auth/me`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const user = await me.json().catch(() => ({}));
      if (!me.ok || !user.branchId)
        throw new Error('Choose an active branch before adjusting stock.');
      const response = await fetch(`${api}/inventory/adjustments`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          branchId: user.branchId,
          variantId: stockAdjustmentVariant.id,
          quantityChange,
          reason: stockAdjustmentReason,
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok)
        throw new Error(data.message ?? 'Unable to adjust stock.');
      setStockAdjustmentVariant(null);
      setStockAdjustmentQuantity('');
      await loadExistingVariants(variantProductId);
      notify('Stock adjusted and recorded.');
    } catch (error) {
      notify(
        error instanceof Error ? error.message : 'Unable to adjust stock.',
        'error',
      );
    } finally {
      setSavingStockAdjustment(false);
    }
  }

  async function uploadVariantValueImage(valueId: string, file?: File) {
    if (!file || !variantProductId) return;
    setUploadingVariantValueId(valueId);
    try {
      const body = new FormData();
      body.append('file', file);
      const upload = await fetch(`${api}/products/image-upload`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body,
      });
      const uploaded = await upload.json();
      if (!upload.ok)
        throw new Error(uploaded.message ?? 'Unable to upload image.');
      const imageUrl = uploaded.imageUrl.startsWith('http')
        ? uploaded.imageUrl
        : `${api}${uploaded.imageUrl}`;
      const saved = await fetch(
        `${api}/products/${variantProductId}/variant-option-values/${valueId}/images`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ imageUrl }),
        },
      );
      const data = await saved.json();
      if (!saved.ok)
        throw new Error(data.message ?? 'Unable to save variant image.');
      await loadVariantOptionGalleries();
      notify('Variant gallery image added.');
    } catch (error) {
      notify(
        error instanceof Error
          ? error.message
          : 'Unable to upload variant image.',
        'error',
      );
    } finally {
      setUploadingVariantValueId('');
    }
  }

  async function removeVariantValueImage(valueId: string, imageId: string) {
    if (!variantProductId) return;
    const response = await fetch(
      `${api}/products/${variantProductId}/variant-option-values/${valueId}/images/${imageId}`,
      {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      },
    );
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      notify(data.message ?? 'Unable to remove image.', 'error');
      return;
    }
    await loadVariantOptionGalleries();
    notify('Variant gallery image removed.');
  }

  async function saveVariantValueName() {
    if (!editingVariantValue || !variantProductId) return;
    const response = await fetch(
      `${api}/products/${variantProductId}/variant-option-values/${editingVariantValue.id}`,
      {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ name: editingVariantValue.name }),
      },
    );
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      notify(data.message ?? 'Unable to rename variant value.', 'error');
      return;
    }
    setEditingVariantValue(null);
    await loadVariantOptionGalleries();
    await load();
    notify('Variant value renamed.');
  }

  async function deleteVariantValue() {
    if (!pendingVariantValueDelete || !variantProductId) return;
    setDeletingVariantValue(true);
    try {
      const response = await fetch(
        `${api}/products/${variantProductId}/variant-option-values/${pendingVariantValueDelete.id}`,
        {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${token}` },
        },
      );
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        notify(data.message ?? 'Unable to delete variant value.', 'error');
        return;
      }
      setPendingVariantValueDelete(null);
      await loadVariantOptionGalleries();
      await load();
      notify(
        `Deleted ${data.deletedVariants ?? 0} related variant${data.deletedVariants === 1 ? '' : 's'} and the value.`,
      );
    } finally {
      setDeletingVariantValue(false);
    }
  }

  function downloadTemplate() {
    const csv =
      'name,sku,barcode,price,opening_stock,reorder_level,category\nIced Latte,ICED-LATTE,885000001,3.50,20,5,Coffee\n';
    const url = URL.createObjectURL(
      new Blob([csv], { type: 'text/csv;charset=utf-8' }),
    );
    const link = document.createElement('a');
    link.href = url;
    link.download = 'pos-product-import-template.csv';
    link.click();
    URL.revokeObjectURL(url);
  }

  async function chooseCsv(file?: File) {
    if (!file) return;
    if (!file.name.toLowerCase().endsWith('.csv')) {
      notify('Choose a valid CSV file.', 'error');
      return;
    }
    const text = await file.text();
    setCsvText(text);
    setImportPreview(null);
    notify(`Loaded ${file.name}. Click Preview CSV to validate.`);
  }

  async function previewCsv() {
    if (!csvText) {
      notify('Choose a CSV file first.', 'error');
      return;
    }
    const response = await fetch(`${api}/products/import-preview`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ csv: csvText }),
    });
    const raw = await response.text();
    const data = raw ? JSON.parse(raw) : {};
    if (!response.ok) {
      notify(data.message ?? 'Unable to preview CSV.', 'error');
      return;
    }
    setImportPreview(data);
    notify(
      data.valid
        ? `${data.totalRows} products ready to import.`
        : 'Fix CSV errors before importing.',
      data.valid ? 'success' : 'error',
    );
  }

  async function importCsv() {
    if (!csvText || !importPreview?.valid) return;
    const response = await fetch(`${api}/products/import`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ csv: csvText }),
    });
    const raw = await response.text();
    const data = raw ? JSON.parse(raw) : {};
    if (!response.ok) {
      notify(data.message ?? 'Unable to import products.', 'error');
      return;
    }
    setCsvText('');
    setImportPreview(null);
    notify(`${data.created} products imported successfully.`);
    await load();
    selectWorkspaceTab('catalog');
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = Object.fromEntries(new FormData(formElement));
    const {
      categoryId,
      reorderLevel,
      salePrice,
      cost,
      regularPrice,
      ...product
    } = form;
    const response = await fetch(`${api}/products`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        ...product,
        ...(categoryId ? { categoryId } : {}),
        regularPrice: Math.round(Number(regularPrice ?? 0) * 100),
        price: String(salePrice ?? '').trim()
          ? Math.round(Number(salePrice) * 100)
          : null,
        cost: String(cost ?? '').trim() ? Math.round(Number(cost) * 100) : null,
        ...(String(reorderLevel ?? '').trim()
          ? { reorderLevel: Math.max(0, Math.floor(Number(reorderLevel))) }
          : {}),
      }),
    });
    const data = await response.json();
    if (!response.ok) {
      notify(data.message ?? 'Unable to save product.', 'error');
      return;
    }
    setNewImageUrl('');
    router.replace(`/products/${data.id}`);
  }

  async function createCategory(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = Object.fromEntries(new FormData(formElement));
    const response = await fetch(`${api}/products/categories`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ name: form.name }),
    });
    const data = await response.json();
    if (!response.ok) {
      notify(data.message ?? 'Unable to create category.', 'error');
      return;
    }
    formElement.reset();
    notify(`Category "${data.name}" created.`);
    await load();
  }

  function startCategoryEdit(category: Category) {
    setEditingCategory(category);
    setCategoryName(category.name);
  }

  async function saveCategory(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editingCategory) return;
    const response = await fetch(
      `${api}/products/categories/${editingCategory.id}`,
      {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ name: categoryName }),
      },
    );
    const data = await response.json();
    if (!response.ok) {
      notify(data.message ?? 'Unable to update category.', 'error');
      return;
    }
    setEditingCategory(null);
    notify(`Category renamed to “${data.name}”.`);
    await load();
  }

  async function deleteCategory(category: Category) {
    setDeletingCategory(true);
    const response = await fetch(`${api}/products/categories/${category.id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await response.json();
    setDeletingCategory(false);
    if (!response.ok) {
      notify(data.message ?? 'Unable to delete category.', 'error');
      return;
    }
    setPendingCategoryDelete(null);
    notify(data.message ?? `Category “${category.name}” deleted.`);
    await load();
  }

  function openProductEditor(product: Product) {
    setEditing(product);
    setEditName(product.name);
    setEditSku(product.sku);
    setEditBarcode(product.barcode ?? '');
    setEditImageUrl(product.imageUrl ?? '');
    setEditCategoryId(product.category?.id ?? '');
    setEditRegularPrice(
      ((product.regularPrice ?? product.price ?? 0) / 100).toFixed(2),
    );
    setEditCost(product.cost === null ? '' : (product.cost / 100).toFixed(2));
    setEditSalePrice(
      product.price === null ? '' : (product.price / 100).toFixed(2),
    );
    setEditReorderLevel(String(product.reorderLevel));
    setVariantProductId(product.id);
    void loadVariantOptionGalleries(product.id);
    void loadExistingVariants(product.id);
    void loadSuppliers().catch((error: Error) =>
      notify(error.message, 'error'),
    );
    void loadSupplierCatalog(product.id).catch((error: Error) =>
      notify(error.message, 'error'),
    );
    void loadSupplierPriceHistory(product.id).catch((error: Error) =>
      notify(error.message, 'error'),
    );
    resetSupplierCatalogForm();
    setActiveTab('add');
  }

  function startEdit(product: Product) {
    router.push(`/products/${product.id}`);
  }

  async function saveEdit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editing) return;
    const response = await fetch(`${api}/products/${editing.id}`, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: editName,
        sku: editSku,
        barcode: editBarcode,
        imageUrl: editImageUrl,
        categoryId: editCategoryId,
        regularPrice: Math.round(Number(editRegularPrice) * 100),
        price: editSalePrice.trim()
          ? Math.round(Number(editSalePrice) * 100)
          : null,
        cost: editCost.trim() ? Math.round(Number(editCost) * 100) : null,
        reorderLevel: editReorderLevel.trim()
          ? Math.max(0, Math.floor(Number(editReorderLevel)))
          : 0,
      }),
    });
    const data = await response.json();
    if (!response.ok) {
      notify(data.message ?? 'Unable to update product.', 'error');
      return;
    }
    notify(
      'Product details saved. Continue below to manage variants and options.',
    );
    await load();
  }

  async function toggleActive(product: Product) {
    const response = await fetch(`${api}/products/${product.id}`, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ isActive: !product.isActive }),
    });
    const data = await response.json();
    if (!response.ok) {
      notify(data.message ?? 'Unable to update product.', 'error');
      return;
    }
    setEditing((current) =>
      current?.id === product.id
        ? { ...current, isActive: data.isActive }
        : current,
    );
    notify(product.isActive ? 'Product deactivated.' : 'Product activated.');
    await load();
  }

  async function deleteProduct(product: Product) {
    setDeletingProduct(true);
    try {
      const response = await fetch(`${api}/products/${product.id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        notify(
          data.message ??
            'Unable to delete product. Deactivate it to keep its history.',
          'error',
        );
        return;
      }
      notify('Product deleted.');
      await load();
    } finally {
      setDeletingProduct(false);
      setPendingDelete(null);
    }
  }

  async function createOptionSet(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = Object.fromEntries(new FormData(formElement));
    const custom = preset === 'CUSTOM';
    const response = await fetch(`${api}/products/option-sets`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        preset,
        name: custom ? String(form.name ?? '') : undefined,
        optionNames: custom
          ? String(form.optionNames ?? '')
              .split(',')
              .map((v) => v.trim())
              .filter(Boolean)
          : undefined,
        minSelections: Number(form.minSelections ?? 0),
        maxSelections: Number(form.maxSelections ?? 1),
      }),
    });
    const data = await response.json();
    if (!response.ok) {
      notify(data.message ?? 'Unable to create option set.', 'error');
      return;
    }
    formElement.reset();
    setPreset('DRINK_SIZES');
    notify(`Option set "${data.name}" created.`);
    await load();
  }

  async function applyOptionSet(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = Object.fromEntries(new FormData(event.currentTarget));
    const response = await fetch(
      `${api}/products/${form.productId}/apply-option-set`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ optionSetId: form.optionSetId }),
      },
    );
    const data = await response.json();
    if (!response.ok) {
      notify(data.message ?? 'Unable to apply option set.', 'error');
      return;
    }
    notify('Option set applied to product.');
    await load();
  }

  function selectProductForPrices(productId: string) {
    setPricedProductId(productId);
    const product = products.find((item) => item.id === productId);
    setOptionPrices(
      Object.fromEntries(
        product?.modifierGroups.flatMap((group) =>
          group.options.map((option) => [
            option.id,
            (option.priceAdjustment / 100).toFixed(2),
          ]),
        ) ?? [],
      ),
    );
  }

  async function saveOptionPrices(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!pricedProductId) return;
    const items = Object.entries(optionPrices).map(
      ([optionId, priceAdjustment]) => ({
        optionId,
        priceAdjustment: Math.round(Number(priceAdjustment || 0) * 100),
      }),
    );
    const response = await fetch(
      `${api}/products/${pricedProductId}/modifier-option-prices`,
      {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ items }),
      },
    );
    const data = await response.json();
    if (!response.ok) {
      notify(data.message ?? 'Unable to save option prices.', 'error');
      return;
    }
    notify('Option prices saved.');
    await load();
  }

  async function removeModifierGroup(productId: string, groupId: string) {
    const response = await fetch(
      `${api}/products/${productId}/modifier-groups/${groupId}`,
      {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      },
    );
    const data = await response.json();
    if (!response.ok) {
      notify(data.message ?? 'Unable to remove modifier group.', 'error');
      return;
    }
    if (pricedProductId === productId) selectProductForPrices(productId);
    notify('Modifier group removed.');
    await load();
  }

  async function removeModifierOption(productId: string, optionId: string) {
    const response = await fetch(
      `${api}/products/${productId}/modifier-options/${optionId}`,
      {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      },
    );
    const data = await response.json();
    if (!response.ok) {
      notify(data.message ?? 'Unable to remove modifier option.', 'error');
      return;
    }
    notify('Modifier option removed.');
    await load();
  }

  async function addModifier(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = Object.fromEntries(new FormData(formElement));
    const groupName =
      modifierGroup === 'OTHER'
        ? String(form.customGroupName ?? '')
        : modifierGroup;
    const response = await fetch(
      `${api}/products/${form.productId}/modifier-options`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          groupName,
          optionName: form.optionName,
          priceAdjustment: Math.round(Number(form.priceAdjustment || 0) * 100),
          minSelections: Number(form.minSelections || 0),
          maxSelections: Number(form.maxSelections || 1),
        }),
      },
    );
    const data = await response.json();
    if (!response.ok) {
      notify(data.message ?? 'Unable to add modifier.', 'error');
      return;
    }
    formElement.reset();
    setModifierGroup('Size');
    notify('Modifier option added.');
    await load();
  }

  function buildVariantDrafts(
    nextOptions: VariantOptionDraft[],
    productId = variantProductId,
  ) {
    const product = products.find((item) => item.id === productId);
    const valuesByOption = nextOptions.map((option) =>
      option.values
        .split(',')
        .map((value) => value.trim())
        .filter(Boolean),
    );
    if (
      !product ||
      !nextOptions.length ||
      !nextOptions.every((option) => option.name.trim()) ||
      valuesByOption.some((values) => !values.length)
    ) {
      setVariantDrafts([]);
      return;
    }
    const combinations = valuesByOption.reduce<string[][]>(
      (all, values) =>
        all.flatMap((combination) =>
          values.map((value) => [...combination, value]),
        ),
      [[]],
    );
    if (combinations.length > 100) {
      setVariantDrafts([]);
      notify('Use up to 100 variant combinations per product.', 'error');
      return;
    }
    const slug = (value: string) =>
      value
        .toUpperCase()
        .replace(/[^A-Z0-9]+/g, '-')
        .replace(/^-|-$/g, '');
    const existingNames = new Set(
      product.variants.map((variant) => variant.name.toLowerCase()),
    );
    setVariantDrafts((current) =>
      combinations
        .map((values) => {
          const key = values.join('\u0001');
          const name = values.join(' / ');
          const existing = current.find((draft) => draft.key === key);
          return (
            existing ?? {
              key,
              name,
              sku: `${variantSkuPrefix || product.sku}-${values.map(slug).join('-')}`,
              barcode: '',
              price:
                variantDefaultPrice ||
                ((product.price ?? product.regularPrice ?? 0) / 100).toFixed(2),
              openingStock: variantDefaultStock,
            }
          );
        })
        .filter((draft) => !existingNames.has(draft.name.toLowerCase())),
    );
  }

  function updateVariantOption(
    index: number,
    field: keyof VariantOptionDraft,
    value: string,
  ) {
    setVariantOptions((current) => {
      const next = current.map((option, optionIndex) =>
        optionIndex === index ? { ...option, [field]: value } : option,
      );
      buildVariantDrafts(next);
      return next;
    });
  }

  function selectVariantProduct(productId: string) {
    setVariantProductId(productId);
    const product = products.find((item) => item.id === productId);
    setVariantDefaultPrice(
      product
        ? ((product.price ?? product.regularPrice ?? 0) / 100).toFixed(2)
        : '',
    );
    setVariantDefaultStock('0');
    setVariantSkuPrefix(product?.sku ?? '');
    setVariantSearch('');
    setSelectedVariantDrafts([]);
    setVariantOptions([]);
    setVariantDrafts([]);
    void loadVariantOptionGalleries(productId);
  }

  function updateVariantDraft(
    index: number,
    field: keyof VariantDraft,
    value: string,
  ) {
    setVariantDrafts((current) =>
      current.map((draft, draftIndex) =>
        draftIndex === index ? { ...draft, [field]: value } : draft,
      ),
    );
  }

  function applyBulkVariantValues() {
    if (!selectedVariantDrafts.length) return;
    if (bulkVariantPrice === '' && bulkVariantStock === '') {
      notify('Enter a price or opening stock value to apply.', 'error');
      return;
    }
    const selected = new Set(selectedVariantDrafts);
    setVariantDrafts((current) =>
      current.map((draft) =>
        selected.has(draft.key)
          ? {
              ...draft,
              ...(bulkVariantPrice !== '' ? { price: bulkVariantPrice } : {}),
              ...(bulkVariantStock !== ''
                ? { openingStock: bulkVariantStock }
                : {}),
            }
          : draft,
      ),
    );
    notify(
      `Updated ${selectedVariantDrafts.length} variant${selectedVariantDrafts.length === 1 ? '' : 's'}.`,
    );
  }

  async function saveVariantDrafts() {
    if (!variantProductId || !variantDrafts.length) return;
    const response = await fetch(
      `${api}/products/${variantProductId}/variants/batch`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          options: variantOptions.map((option) => ({
            name: option.name,
            values: option.values
              .split(',')
              .map((value) => value.trim())
              .filter(Boolean),
          })),
          variants: variantDrafts.map((draft) => ({
            name: draft.name,
            sku: draft.sku,
            barcode: draft.barcode || undefined,
            price: Math.round(Number(draft.price || 0) * 100),
            openingStock: Number(draft.openingStock || 0),
            values: draft.key.split('\u0001'),
          })),
        }),
      },
    );
    if (!response.ok) {
      const raw = await response.text();
      let data: { message?: string } = {};
      try {
        data = raw ? JSON.parse(raw) : {};
      } catch {
        /* handled below */
      }
      notify(data.message ?? 'Unable to save variants.', 'error');
      return;
    }
    setVariantDrafts([]);
    setSelectedVariantDrafts([]);
    notify(
      `${variantDrafts.length} variant${variantDrafts.length === 1 ? '' : 's'} created.`,
    );
    await load();
    await loadVariantOptionGalleries();
    await loadExistingVariants(variantProductId);
  }

  function startVariantEdit(product: Product, variant: ProductVariant) {
    setEditingVariant({ product, variant });
    setVariantName(variant.name);
    setVariantSku(variant.sku);
    setVariantBarcode(variant.barcode ?? '');
    setVariantPrice(
      variant.price === null ? '' : (variant.price / 100).toFixed(2),
    );
    setEditing(product);
    setVariantProductId(product.id);
    void loadVariantOptionGalleries(product.id);
    setActiveTab('add');
  }

  async function saveVariant(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editingVariant) return;
    const { product, variant } = editingVariant;
    const response = await fetch(
      `${api}/products/${product.id}/variants/${variant.id}`,
      {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: variantName,
          sku: variantSku,
          barcode: variantBarcode,
          ...(variantPrice !== ''
            ? { price: Math.round(Number(variantPrice) * 100) }
            : {}),
        }),
      },
    );
    const raw = await response.text();
    const data = raw ? JSON.parse(raw) : {};
    if (!response.ok) {
      notify(data.message ?? 'Unable to update variant.', 'error');
      return;
    }
    setEditingVariant(null);
    notify('Variant updated.');
    await load();
  }

  async function toggleVariantActive(
    product: Product,
    variant: ProductVariant,
  ) {
    const response = await fetch(
      `${api}/products/${product.id}/variants/${variant.id}`,
      {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ isActive: !variant.isActive }),
      },
    );
    const raw = await response.text();
    const data = raw ? JSON.parse(raw) : {};
    if (!response.ok) {
      notify(data.message ?? 'Unable to update variant.', 'error');
      return;
    }
    notify(variant.isActive ? 'Variant deactivated.' : 'Variant activated.');
    await load();
  }

  // Filtered products list
  const filteredProducts = products.filter((p) => {
    const matchesSearch =
      searchQuery === '' ||
      p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.sku.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (p.barcode &&
        p.barcode.toLowerCase().includes(searchQuery.toLowerCase()));
    const matchesCategory =
      selectedCategoryFilter === '' ||
      p.category?.id === selectedCategoryFilter;
    const matchesStatus =
      statusFilter === 'all' ||
      (statusFilter === 'active' ? p.isActive : !p.isActive);
    return matchesSearch && matchesCategory && matchesStatus;
  });
  const visibleVariantDrafts = variantDrafts.filter((draft) =>
    `${draft.name} ${draft.sku} ${draft.barcode}`
      .toLowerCase()
      .includes(variantSearch.toLowerCase()),
  );
  const categoryProductTotal = categories.reduce(
    (total, category) => total + (category._count?.products ?? 0),
    0,
  );

  const pricedProduct = products.find(
    (product) => product.id === pricedProductId,
  );

  /* ─── Render ──────────────────────────────────────────────────────────── */
  return (
    <main className="w-full pb-16">
      <PageHeading
        eyebrow="Catalog management"
        title="Products"
        actions={
          !isEditorRoute ? (
            <Button onClick={() => router.push('/products/new')}>
              <Plus size={18} />
              New Product
            </Button>
          ) : undefined
        }
        tabs={
          !isEditorRoute ? (
            <div className="flex items-center gap-7 overflow-x-auto overflow-y-hidden [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {[
                {
                  id: 'catalog',
                  label: 'All Products',
                  icon: Package,
                  count: products.length,
                },
                {
                  id: 'categories',
                  label: 'Categories',
                  icon: Tag,
                  count: categories.length,
                },
                { id: 'import', label: 'CSV Import', icon: Upload },
              ].map((tab) => {
                const Icon = tab.icon;
                const isActive = activeTab === tab.id;
                return (
                  <TabButton
                    key={tab.id}
                    type="button"
                    onClick={() =>
                      selectWorkspaceTab(
                        tab.id as 'catalog' | 'categories' | 'import',
                      )
                    }
                    active={isActive}
                    className="whitespace-nowrap leading-tight tracking-[-0.01em]"
                  >
                    <Icon size={16} strokeWidth={2} />
                    {tab.label}
                    {tab.count !== undefined && (
                      <TabCountBadge active={isActive}>
                        {tab.count}
                      </TabCountBadge>
                    )}
                  </TabButton>
                );
              })}
            </div>
          ) : undefined
        }
      />

      {/* ── Page Body Content Container ── */}
      <PageContainer>
        {/* ── Status Toast Alert ── */}
        {message && (
          <div
            className={`fixed top-5 right-6 z-[100] flex w-[min(420px,calc(100vw-32px))] items-center gap-2.5 rounded-md border px-[15px] py-3 text-[0.86rem] font-semibold shadow-lg ${
              messageType === 'error'
                ? 'border-rose-200 bg-rose-50 text-rose-700'
                : 'border-emerald-200 bg-emerald-50 text-emerald-700'
            }`}
            role="status"
          >
            {messageType === 'error' ? (
              <AlertCircle size={18} />
            ) : (
              <CheckCircle2 size={18} />
            )}
            <span className="flex-1">{message}</span>
            <Button
              type="button"
              onClick={() => setMessage('')}
              variant="ghost"
              size="sm"
              className="h-7 w-7 rounded-md border-0 p-0 text-inherit hover:bg-black/5"
              aria-label="Dismiss message"
            >
              <X size={16} />
            </Button>
          </div>
        )}

        {/* ─────────────────────────────────────────────────────────────────── */}
        {/* TAB 1: ALL PRODUCTS CATALOG                                         */}
        {/* ─────────────────────────────────────────────────────────────────── */}
        {activeTab === 'catalog' && (
          <div className="flex flex-col gap-4">
            {/* Search and Filters Bar */}
            <div className="flex flex-wrap items-center gap-3 rounded-lg border border-border-subtle bg-card px-4 py-3 shadow-sm">
              {/* Search Input */}
              <div className="relative min-w-[240px] flex-1">
                <Search
                  size={16}
                  className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-text-muted"
                />
                <Input
                  type="search"
                  placeholder="Search products by name, SKU, or barcode..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>

              <CustomSelect
                value={selectedCategoryFilter}
                onChange={setSelectedCategoryFilter}
                leadingIcon={<Filter size={14} />}
                className="w-[190px] max-[520px]:w-full"
                options={[
                  {
                    value: '',
                    label: 'All Categories',
                    count: products.length,
                  },
                  ...categories.map((category) => ({
                    value: category.id,
                    label: category.name,
                    count: products.filter(
                      (product) => product.category?.id === category.id,
                    ).length,
                  })),
                ]}
              />

              {/* Status Filter Segment Control */}
              <div className="flex h-10 items-center rounded-md border border-border-subtle bg-app p-[3px] max-[520px]:w-full">
                {(['all', 'active', 'inactive'] as const).map((st) => (
                  <Button
                    key={st}
                    type="button"
                    onClick={() => setStatusFilter(st)}
                    variant={statusFilter === st ? 'secondary' : 'ghost'}
                    size="sm"
                    className={`inline-flex h-8 cursor-pointer items-center justify-center rounded-sm border px-3.5 text-sm font-semibold capitalize transition max-[520px]:flex-1 ${
                      statusFilter === st
                        ? 'border-border-default font-bold text-text-main shadow-sm'
                        : 'border-transparent bg-transparent text-text-muted hover:text-text-main'
                    }`}
                  >
                    {st}
                  </Button>
                ))}
              </div>
            </div>

            {/* Catalog Product Grid / List */}
            {filteredProducts.length === 0 ? (
              <div className="rounded-lg border border-border-subtle bg-card shadow-sm">
                <EmptyState
                  title="No products found"
                  description="Try clearing active filters or create a new product for your catalog."
                  icon={<Package size={22} strokeWidth={2} />}
                  className="py-8"
                />
                <div className="flex justify-center px-5 pb-8">
                  {searchQuery ||
                  selectedCategoryFilter ||
                  statusFilter !== 'all' ? (
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => {
                        setSearchQuery('');
                        setSelectedCategoryFilter('');
                        setStatusFilter('all');
                      }}
                    >
                      Clear filters
                    </Button>
                  ) : (
                    <Button
                      size="sm"
                      onClick={() => router.push('/products/new')}
                    >
                      <Plus size={16} />
                      Add First Product
                    </Button>
                  )}
                </div>
              </div>
            ) : (
              <div className="overflow-x-auto rounded-lg border border-border-subtle bg-card shadow-sm">
                <table className="w-full min-w-[880px] border-collapse text-left">
                  <thead>
                    <tr className="border-b border-border-default bg-muted-surface text-xs font-bold uppercase tracking-wide text-text-secondary [&>th]:px-[18px] [&>th]:py-3">
                      <th
                        className="w-9 text-center"
                        aria-label="Drag handle"
                      />
                      <th>Product &amp; SKU</th>
                      <th>Category</th>
                      <th>Variants</th>
                      <th>Price</th>
                      <th>Status</th>
                      <th className="text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredProducts.map((product, index) => {
                      const isDragging = draggedProductIndex === index;
                      return (
                        <Fragment key={product.id}>
                          <tr
                            draggable={canDragProducts}
                            onDragStart={(e) =>
                              handleProductDragStart(e, index)
                            }
                            onDragOver={(e) => handleProductDragOver(e, index)}
                            onDragEnd={handleProductDragEnd}
                            className={`border-b border-border-subtle transition-colors last:border-b-0 hover:bg-navy-subtle [&>td]:px-[18px] [&>td]:py-3.5 [&>td]:align-middle ${
                              isDragging ? 'bg-brand-subtle opacity-50' : ''
                            }`}
                          >
                            {/* Drag Handle Cell */}
                            <td
                              className={`w-9 text-center ${
                                canDragProducts
                                  ? 'cursor-grab text-text-muted active:cursor-grabbing'
                                  : 'cursor-default text-slate-300'
                              }`}
                              title={
                                canDragProducts
                                  ? 'Drag to reorder product order'
                                  : 'Clear search and filters to reorder products'
                              }
                            >
                              <GripVertical size={16} />
                            </td>

                            {/* Product Name & SKU */}
                            <td>
                              <div className="flex items-center gap-3.5">
                                {product.imageUrl ? (
                                  <img
                                    src={product.imageUrl}
                                    alt={product.name}
                                    className="h-11 w-11 shrink-0 rounded-md border border-border-default object-cover"
                                  />
                                ) : (
                                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md border border-border-default bg-muted-surface text-slate-400">
                                    <Package size={20} strokeWidth={1.75} />
                                  </div>
                                )}
                                <div className="min-w-0">
                                  <div className="mb-0.5 truncate text-[0.925rem] font-bold text-text-main">
                                    {product.name}
                                  </div>
                                  <div className="flex flex-wrap items-center gap-2">
                                    <span className="font-mono text-[0.78rem] font-medium text-text-secondary">
                                      SKU: {product.sku}
                                    </span>
                                    {product.barcode && (
                                      <span className="font-mono text-[0.78rem] text-text-muted">
                                        • {product.barcode}
                                      </span>
                                    )}
                                  </div>
                                </div>
                              </div>
                            </td>

                            {/* Category */}
                            <td>
                              {product.category ? (
                                <span className="inline-flex rounded-full bg-blue-50 px-2 py-1 text-xs font-bold text-blue-700">
                                  {product.category.name}
                                </span>
                              ) : (
                                <span className="text-[0.82rem] text-slate-400">
                                  —
                                </span>
                              )}
                            </td>

                            {/* Variants */}
                            <td>
                              {product.variants.length > 0 ? (
                                <span className="inline-flex rounded-full bg-emerald-50 px-2 py-1 text-xs font-bold text-emerald-700">
                                  {product.variants.length} variant
                                  {product.variants.length === 1 ? '' : 's'}
                                </span>
                              ) : (
                                <span className="text-[0.82rem] font-medium text-text-muted">
                                  Single
                                </span>
                              )}
                            </td>

                            {/* Price */}
                            <td>
                              <div className="text-[0.95rem] font-extrabold tracking-[-0.01em] text-text-main">
                                $
                                {(
                                  (product.price ?? product.regularPrice ?? 0) /
                                  100
                                ).toFixed(2)}
                              </div>
                              {product.price !== null &&
                                product.regularPrice !== null &&
                                product.price !== product.regularPrice && (
                                  <div className="mt-0.5 text-xs font-semibold text-slate-400 line-through">
                                    $
                                    {(
                                      (product.regularPrice ?? 0) / 100
                                    ).toFixed(2)}
                                  </div>
                                )}
                            </td>

                            {/* Status */}
                            <td>
                              <Button
                                type="button"
                                onClick={() => void toggleActive(product)}
                                variant={
                                  product.isActive
                                    ? 'successSubtle'
                                    : 'neutralSubtle'
                                }
                                size="status"
                                title={
                                  product.isActive
                                    ? 'Click to deactivate product'
                                    : 'Click to activate product'
                                }
                                className="gap-1.5 rounded-full"
                              >
                                <span className="h-1.5 w-1.5 rounded-full bg-current" />
                                {product.isActive ? 'Active' : 'Inactive'}
                              </Button>
                            </td>

                            {/* Actions */}
                            <td className="text-right">
                              <div className="inline-flex items-center justify-end gap-1.5">
                                <Button
                                  variant="secondary"
                                  size="sm"
                                  onClick={() => startEdit(product)}
                                  title={`Edit ${product.name}`}
                                >
                                  <Edit2 size={13} />
                                  Edit
                                </Button>
                                <Button
                                  variant="dangerSubtle"
                                  size="icon"
                                  aria-label={`Delete ${product.name}`}
                                  title="Delete product"
                                  onClick={() => setPendingDelete(product)}
                                  className="h-9 w-9"
                                >
                                  <Trash2 size={13} />
                                </Button>
                              </div>
                            </td>
                          </tr>

                          {/* Modifiers summary sub-row */}
                          {product.modifierGroups.length > 0 && (
                            <tr>
                              <td
                                colSpan={7}
                                className="border-b border-border-subtle bg-muted-surface px-[18px] py-2"
                              >
                                <div className="flex flex-col gap-1.5">
                                  {product.modifierGroups.map((group) => (
                                    <div
                                      key={group.id}
                                      className="flex flex-wrap items-center gap-2.5"
                                    >
                                      <span className="text-[0.78rem] font-bold text-text-secondary">
                                        {group.name}:
                                      </span>
                                      {group.options.map((opt) => (
                                        <span
                                          key={opt.id}
                                          className="inline-flex items-center gap-1 rounded-sm border border-border-default bg-card px-2 py-0.5 text-[0.78rem] text-text-secondary"
                                        >
                                          {opt.name}
                                          {opt.priceAdjustment
                                            ? ` (+$${(opt.priceAdjustment / 100).toFixed(2)})`
                                            : ''}
                                          <Button
                                            type="button"
                                            onClick={() =>
                                              void removeModifierOption(
                                                product.id,
                                                opt.id,
                                              )
                                            }
                                            variant="ghost"
                                            size="sm"
                                            className="h-auto w-auto border-0 p-0 text-danger hover:bg-transparent"
                                            aria-label={`Remove ${opt.name}`}
                                          >
                                            <X size={12} />
                                          </Button>
                                        </span>
                                      ))}
                                      <Button
                                        type="button"
                                        onClick={() =>
                                          void removeModifierGroup(
                                            product.id,
                                            group.id,
                                          )
                                        }
                                        variant="dangerSubtle"
                                        size="sm"
                                        className="h-7 px-2 text-xs"
                                      >
                                        Delete Group
                                      </Button>
                                    </div>
                                  ))}
                                </div>
                              </td>
                            </tr>
                          )}
                        </Fragment>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* ─────────────────────────────────────────────────────────────────── */}
        {/* TAB 2: ADD / EDIT PRODUCT                                          */}
        {/* ─────────────────────────────────────────────────────────────────── */}
        {isEditorRoute && editing && (
          <nav
            className="mb-6 flex items-center gap-7 overflow-x-auto border-b border-border-subtle [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
            aria-label="Product editor sections"
          >
            {[
              { key: 'details', label: 'Basic details', icon: Sliders },
              { key: 'suppliers', label: 'Suppliers', icon: Package },
              {
                key: 'variants',
                label: 'Variants',
                count: editing.variants.length,
                icon: Layers,
              },
            ].map(({ key, label, count, icon: Icon }) => {
              const isActive = editorTab === key;
              return (
                <TabButton
                  key={key}
                  type="button"
                  active={isActive}
                  aria-current={isActive ? 'page' : undefined}
                  onClick={() => selectEditorTab(key as typeof editorTab)}
                >
                  <Icon
                    size={15}
                    className={isActive ? 'text-brand' : 'text-text-muted'}
                  />
                  <span>{label}</span>
                  {typeof count === 'number' && (
                    <TabCountBadge active={isActive}>{count}</TabCountBadge>
                  )}
                </TabButton>
              );
            })}
          </nav>
        )}
        {activeTab === 'add' && (!editing || editorTab === 'details') && (
          <section className="overflow-visible rounded-lg border border-border-subtle bg-card shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border-subtle px-4 py-6 sm:px-8">
              <h2 className="text-base font-bold tracking-tight text-text-main">
                {editing
                  ? `Product editor — ${editing.name}`
                  : 'Add new product'}
              </h2>
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() => router.push('/products')}
                >
                  Back to products
                </Button>
                <Button type="submit" form="product-editor-form" size="sm">
                  {editing ? 'Save product' : 'Create product'}
                </Button>
              </div>
            </div>

            <form
              id="product-editor-form"
              onSubmit={editing ? saveEdit : submit}
              className="flex flex-col gap-4 px-4 py-6 sm:px-8"
            >
              <div>
                <p className="m-0 text-xs font-bold uppercase tracking-wider text-text-secondary">
                  Product details
                </p>
                <p className="mt-1 text-xs text-text-muted">
                  The basic information staff use to find and sell this product.
                </p>
              </div>
              <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_300px] items-start">
                {/* Left Column: Form Fields */}
                <div className="grid grid-cols-1 gap-x-4 gap-y-4 md:grid-cols-2 items-start">
                  {/* Product Name */}
                  <FormField label="Product Name" required>
                    <Input
                      key={editing ? 'edit-name' : 'new-name'}
                      required
                      value={editing ? editName : undefined}
                      onChange={
                        editing ? (e) => setEditName(e.target.value) : undefined
                      }
                      name={editing ? undefined : 'name'}
                      placeholder="e.g. Iced Latte"
                    />
                  </FormField>

                  {/* SKU */}
                  <FormField label="SKU" required>
                    <Input
                      key={editing ? 'edit-sku' : 'new-sku'}
                      required
                      value={editing ? editSku : undefined}
                      onChange={
                        editing ? (e) => setEditSku(e.target.value) : undefined
                      }
                      name={editing ? undefined : 'sku'}
                      placeholder="COFFEE-LATTE"
                    />
                  </FormField>

                  {/* Barcode */}
                  <FormField label="Barcode" sublabel="(optional)">
                    <div className="flex items-center gap-2">
                      <Input
                        key={editing ? 'edit-barcode' : 'new-barcode'}
                        value={editing ? editBarcode : undefined}
                        onChange={
                          editing
                            ? (e) => setEditBarcode(e.target.value)
                            : undefined
                        }
                        name={editing ? undefined : 'barcode'}
                        placeholder="885000001"
                        className="flex-1"
                      />
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        className="h-10 shrink-0 gap-1.5 px-3 font-semibold"
                        title="Auto-generate a unique barcode"
                        onClick={() => {
                          const generated =
                            '200' +
                            Math.floor(
                              100000 + Math.random() * 900000,
                            ).toString();
                          if (editing) {
                            setEditBarcode(generated);
                          } else {
                            const barcodeEl = document.querySelector(
                              'input[name="barcode"]',
                            ) as HTMLInputElement | null;
                            if (barcodeEl) barcodeEl.value = generated;
                          }
                        }}
                      >
                        <Sparkles size={14} className="text-brand" />
                        Generate
                      </Button>
                    </div>
                  </FormField>

                  {/* Regular Price */}
                  <FormField label="Regular Price (USD)" required>
                    <Input
                      key={editing ? 'edit-regular-price' : 'new-regular-price'}
                      required
                      type="number"
                      min="0"
                      step="0.01"
                      inputMode="decimal"
                      prefixText="$"
                      value={editing ? editRegularPrice : undefined}
                      onChange={
                        editing
                          ? (e) => setEditRegularPrice(e.target.value)
                          : undefined
                      }
                      onBlur={(e) => {
                        if (editing && e.target.value) {
                          const num = parseFloat(e.target.value);
                          if (!isNaN(num)) setEditRegularPrice(num.toFixed(2));
                        }
                      }}
                      name={editing ? undefined : 'regularPrice'}
                      placeholder="3.50"
                    />
                  </FormField>

                  {/* Cost Price */}
                  <FormField
                    label="Cost Price (USD)"
                    sublabel="(used for profit)"
                  >
                    <Input
                      key={editing ? 'edit-cost' : 'new-cost'}
                      type="number"
                      min="0"
                      step="0.01"
                      inputMode="decimal"
                      prefixText="$"
                      value={editing ? editCost : undefined}
                      onChange={
                        editing ? (e) => setEditCost(e.target.value) : undefined
                      }
                      onBlur={(e) => {
                        if (editing && e.target.value) {
                          const num = parseFloat(e.target.value);
                          if (!isNaN(num)) setEditCost(num.toFixed(2));
                        }
                      }}
                      name={editing ? undefined : 'cost'}
                      placeholder="e.g. 1.20"
                    />
                  </FormField>

                  {/* Sale Price */}
                  <FormField label="Sale Price (USD)" sublabel="(optional)">
                    <Input
                      key={editing ? 'edit-sale-price' : 'new-sale-price'}
                      type="number"
                      min="0"
                      step="0.01"
                      inputMode="decimal"
                      prefixText="$"
                      value={editing ? editSalePrice : undefined}
                      onChange={
                        editing
                          ? (e) => setEditSalePrice(e.target.value)
                          : undefined
                      }
                      onBlur={(e) => {
                        if (editing && e.target.value) {
                          const num = parseFloat(e.target.value);
                          if (!isNaN(num)) setEditSalePrice(num.toFixed(2));
                        }
                      }}
                      name={editing ? undefined : 'salePrice'}
                      placeholder="No sale"
                    />
                  </FormField>

                  {/* Category Select */}
                  <FormField label="Category">
                    <CustomSelect
                      name={editing ? undefined : 'categoryId'}
                      value={editCategoryId}
                      onChange={(val) => setEditCategoryId(val)}
                      placeholder="No category"
                      leadingIcon={<Tag size={14} className="text-brand" />}
                      options={[
                        { value: '', label: 'No category' },
                        ...categories.map((c) => ({
                          value: c.id,
                          label: c.name,
                        })),
                      ]}
                    />
                  </FormField>

                  {/* Inventory Alert Level Stepper */}
                  <FormField
                    label="Inventory alert level"
                    sublabel="(optional)"
                    help={
                      !editing
                        ? 'Leave empty to use the business default.'
                        : undefined
                    }
                  >
                    <div className="flex">
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        className="h-10 w-10 rounded-r-none border-r-0 p-0"
                        title="Decrease alert level"
                        onClick={() => {
                          if (editing) {
                            const current = parseInt(
                              editReorderLevel || '0',
                              10,
                            );
                            setEditReorderLevel(
                              Math.max(0, current - 1).toString(),
                            );
                          }
                        }}
                      >
                        <Minus size={14} />
                      </Button>
                      <Input
                        key={
                          editing ? 'edit-reorder-level' : 'new-reorder-level'
                        }
                        type="text"
                        inputMode="numeric"
                        pattern="[0-9]*"
                        value={editing ? editReorderLevel : undefined}
                        onChange={
                          editing
                            ? (e) =>
                                setEditReorderLevel(
                                  e.target.value.replace(/[^0-9]/g, ''),
                                )
                            : undefined
                        }
                        onKeyDown={(e) => {
                          if (
                            !/[0-9]/.test(e.key) &&
                            ![
                              'Backspace',
                              'Delete',
                              'ArrowLeft',
                              'ArrowRight',
                              'Tab',
                              'Enter',
                            ].includes(e.key) &&
                            !e.metaKey &&
                            !e.ctrlKey
                          ) {
                            e.preventDefault();
                          }
                        }}
                        name={editing ? undefined : 'reorderLevel'}
                        placeholder="e.g. 5"
                        className="rounded-none text-center font-mono"
                      />
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        className="h-10 w-10 rounded-l-none border-l-0 p-0"
                        title="Increase alert level"
                        onClick={() => {
                          if (editing) {
                            const current = parseInt(
                              editReorderLevel || '0',
                              10,
                            );
                            setEditReorderLevel((current + 1).toString());
                          }
                        }}
                      >
                        <Plus size={14} />
                      </Button>
                    </div>
                  </FormField>
                </div>

                {/* Right Column: Product Image Card */}
                <div className="flex flex-col gap-3 rounded-lg border border-border-subtle bg-muted-surface p-5">
                  <p className="m-0 text-xs font-bold uppercase tracking-wider text-text-secondary">
                    Product image
                  </p>
                  <div className="flex flex-col gap-4">
                    <div className="relative flex h-36 w-full items-center justify-center overflow-hidden rounded-md border border-border-default bg-card shadow-2xs">
                      {(editing ? editImageUrl : newImageUrl) ? (
                        <>
                          <img
                            src={editing ? editImageUrl : newImageUrl}
                            alt="Product preview"
                            className="h-full w-full object-cover"
                          />
                          <Button
                            type="button"
                            title="Remove image"
                            aria-label="Remove image"
                            onClick={() =>
                              editing ? setEditImageUrl('') : setNewImageUrl('')
                            }
                            variant="iconBareDanger"
                            size="bareIcon"
                            className="absolute top-2 right-2"
                          >
                            <X size={13} />
                          </Button>
                        </>
                      ) : (
                        <div className="flex flex-col items-center justify-center text-slate-400">
                          <ImageIcon size={28} strokeWidth={1.5} />
                          <span className="mt-1 text-xs font-semibold">
                            No image
                          </span>
                        </div>
                      )}
                    </div>
                    <div className="flex flex-col gap-3">
                      <label className="inline-flex h-9 cursor-pointer items-center justify-center gap-1.5 rounded-md border border-border-default bg-card px-3 text-xs font-semibold text-text-main shadow-2xs transition hover:bg-slate-50 focus:outline-none">
                        <Upload size={14} className="text-text-muted" />
                        {uploadingImage ? 'Uploading…' : 'Upload image'}
                        <input
                          type="file"
                          accept="image/*"
                          disabled={uploadingImage}
                          onChange={(e) =>
                            void uploadProductImage(e, Boolean(editing))
                          }
                          className="hidden"
                        />
                      </label>
                      <FormField label="Image link">
                        <Input
                          type="url"
                          prefixIcon={<LinkIcon size={14} />}
                          value={editing ? editImageUrl : newImageUrl}
                          onChange={
                            editing
                              ? (e) => setEditImageUrl(e.target.value)
                              : (e) => setNewImageUrl(e.target.value)
                          }
                          name={editing ? undefined : 'imageUrl'}
                          placeholder="Paste image link"
                        />
                      </FormField>
                      <p className="m-0 text-xs font-medium text-text-muted">
                        JPG, PNG, WEBP · Max 5 MB
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </form>
          </section>
        )}

        {/* ─────────────────────────────────────────────────────────────────── */}
        {/* TAB 3: VARIANTS & OPTIONS                                           */}
        {/* ─────────────────────────────────────────────────────────────────── */}
        {activeTab === 'add' && editing && (
          <div className="flex flex-col gap-5">
            {editorTab === 'details' && (
              <div className="mt-4 flex items-center justify-between gap-4 rounded-lg border border-border-subtle bg-card px-5 py-4 shadow-sm">
                <div>
                  <h3 className="text-base font-bold text-text-main">
                    Availability
                  </h3>
                  <p className="mt-1 text-xs text-text-muted">
                    {editing.isActive
                      ? 'Available to sell in the POS.'
                      : 'Hidden from normal POS selling.'}
                  </p>
                </div>
                <Button
                  type="button"
                  onClick={() => void toggleActive(editing)}
                  variant={editing.isActive ? 'dangerSubtle' : 'secondary'}
                  size="sm"
                >
                  {editing.isActive ? 'Deactivate' : 'Activate'}
                </Button>
              </div>
            )}

            {editorTab === 'suppliers' && (
              <section className="overflow-visible rounded-lg border border-border-subtle bg-card shadow-sm">
                <div className="border-b border-border-subtle px-4 py-6 sm:px-8">
                  <h3 className="text-base font-bold tracking-tight text-text-main">
                    Suppliers
                  </h3>
                  <p className="mt-1 text-xs text-text-muted">
                    Save a supplier SKU and most recent cost for this product or
                    one of its variants.
                  </p>
                </div>

                <div className="px-4 py-6 sm:px-8">
                  {!suppliers.length ? (
                    <div className="alert alert-warning">
                      No active suppliers are available. Add a supplier before
                      linking it to this product.
                    </div>
                  ) : (
                    <form
                      onSubmit={saveSupplierCatalog}
                      className="grid grid-cols-1 items-start gap-x-4 gap-y-4 rounded-lg border border-border-subtle bg-muted-surface p-5 md:grid-cols-2 lg:grid-cols-4"
                    >
                      {/* Supplier Dropdown */}
                      <FormField label="Supplier">
                        <CustomSelect
                          value={supplierId}
                          onChange={(val) => setSupplierId(val)}
                          placeholder="Select supplier"
                          options={[
                            { value: '', label: 'Select supplier' },
                            ...suppliers.map((s) => ({
                              value: s.id,
                              label: s.name,
                            })),
                          ]}
                        />
                      </FormField>

                      {/* Applies to Dropdown */}
                      <FormField label="Applies to">
                        <CustomSelect
                          value={supplierVariantId}
                          onChange={(val) => setSupplierVariantId(val)}
                          placeholder="Base product"
                          options={[
                            { value: '', label: 'Base product' },
                            ...existingVariantDrafts.map((v) => ({
                              value: v.id,
                              label: `${v.name} · ${v.sku}`,
                            })),
                          ]}
                        />
                      </FormField>

                      {/* Supplier SKU */}
                      <FormField label="Supplier SKU" sublabel="(optional)">
                        <Input
                          value={supplierSku}
                          onChange={(event) =>
                            setSupplierSku(event.target.value)
                          }
                          placeholder="Supplier item code"
                        />
                      </FormField>

                      {/* Last cost (USD) */}
                      <FormField label="Last cost (USD)" sublabel="(optional)">
                        <Input
                          type="number"
                          min="0"
                          step="0.01"
                          inputMode="decimal"
                          prefixText="$"
                          value={supplierLastCost}
                          onChange={(event) =>
                            setSupplierLastCost(event.target.value)
                          }
                          onBlur={(e) => {
                            if (e.target.value) {
                              const num = parseFloat(e.target.value);
                              if (!isNaN(num))
                                setSupplierLastCost(num.toFixed(2));
                            }
                          }}
                          placeholder="0.00"
                        />
                      </FormField>

                      {/* Preferred supplier toggle */}
                      <div className="col-span-full">
                        <div
                          onClick={() =>
                            setSupplierIsPreferred(!supplierIsPreferred)
                          }
                          className={`group flex cursor-pointer items-center justify-between gap-4 rounded-lg border p-3.5 transition-all select-none ${
                            supplierIsPreferred
                              ? 'border-brand/40 bg-brand-subtle/30 shadow-2xs'
                              : 'border-border-default bg-card hover:bg-muted-surface'
                          }`}
                        >
                          <div className="flex items-center gap-3">
                            <div
                              className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-md transition-colors ${
                                supplierIsPreferred
                                  ? 'bg-brand text-white'
                                  : 'bg-muted-surface text-text-subtle'
                              }`}
                            >
                              <Star
                                size={16}
                                className={
                                  supplierIsPreferred ? 'fill-white' : ''
                                }
                              />
                            </div>
                            <div>
                              <p className="m-0 text-sm font-bold text-text-main">
                                Preferred supplier for this{' '}
                                {supplierVariantId ? 'variant' : 'product'}
                              </p>
                              <p className="m-0 text-xs font-medium text-text-muted">
                                Prioritize this supplier when reordering
                                inventory.
                              </p>
                            </div>
                          </div>

                          {/* Toggle switch */}
                          <div
                            className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out ${
                              supplierIsPreferred ? 'bg-brand' : 'bg-slate-200'
                            }`}
                          >
                            <span
                              className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-xs ring-0 transition duration-200 ease-in-out ${
                                supplierIsPreferred
                                  ? 'translate-x-4'
                                  : 'translate-x-0'
                              }`}
                            />
                          </div>
                        </div>
                      </div>

                      {/* Action buttons */}
                      <div className="col-span-full flex justify-end gap-2">
                        <Button
                          type="button"
                          onClick={resetSupplierCatalogForm}
                          variant="secondary"
                          size="sm"
                        >
                          Clear
                        </Button>
                        <Button disabled={savingSupplierCatalog} size="sm">
                          {savingSupplierCatalog ? 'Saving…' : 'Save supplier'}
                        </Button>
                      </div>
                    </form>
                  )}

                  {supplierCatalog.length > 0 && (
                    <div className="mt-6 overflow-hidden rounded-lg border border-border-subtle bg-card shadow-2xs">
                      <div className="border-b border-border-subtle bg-muted-surface px-4 py-3">
                        <h4 className="m-0 text-xs font-bold uppercase tracking-wider text-text-secondary">
                          Linked Suppliers ({supplierCatalog.length})
                        </h4>
                      </div>
                      <div className="overflow-x-auto">
                        <table className="w-full text-left text-sm">
                          <thead>
                            <tr className="border-b border-border-subtle bg-muted-surface text-[0.72rem] font-bold uppercase tracking-wider text-text-secondary select-none">
                              <th className="px-4 py-3">Supplier</th>
                              <th className="px-4 py-3">Applies To</th>
                              <th className="px-4 py-3">Supplier SKU</th>
                              <th className="px-4 py-3 text-right">
                                Last Cost
                              </th>
                              <th className="px-4 py-3 text-right">Action</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-border-subtle/60">
                            {supplierCatalog.map((item) => (
                              <tr
                                key={item.id}
                                className="transition-colors hover:bg-muted-surface"
                              >
                                <td className="px-4 py-3">
                                  <div className="flex items-center gap-2 font-semibold text-text-main">
                                    <Building2
                                      size={15}
                                      className="text-text-muted shrink-0"
                                    />
                                    <span>{item.supplier.name}</span>
                                    {item.isPreferred && (
                                      <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-xs font-bold text-emerald-700">
                                        <Star
                                          size={11}
                                          className="fill-emerald-500 text-emerald-500"
                                        />
                                        Preferred
                                      </span>
                                    )}
                                  </div>
                                </td>
                                <td className="px-4 py-3 text-xs font-medium text-text-secondary">
                                  {item.variant ? (
                                    <span className="inline-flex items-center gap-1 text-text-main font-semibold">
                                      <Tag
                                        size={13}
                                        className="text-brand shrink-0"
                                      />
                                      {item.variant.name}
                                    </span>
                                  ) : (
                                    <span className="inline-flex items-center rounded-md border border-border-subtle bg-muted-surface px-2 py-0.5 text-xs font-semibold text-text-secondary">
                                      Base product
                                    </span>
                                  )}
                                </td>
                                <td className="px-4 py-3">
                                  {item.supplierSku ? (
                                    <code className="rounded bg-muted-surface px-2 py-0.5 font-mono text-xs font-semibold text-text-secondary">
                                      {item.supplierSku}
                                    </code>
                                  ) : (
                                    <span className="text-text-muted">—</span>
                                  )}
                                </td>
                                <td className="px-4 py-3 text-right font-semibold text-text-main tabular-nums">
                                  {item.lastCost === null
                                    ? '—'
                                    : `$${(item.lastCost / 100).toFixed(2)}`}
                                </td>
                                <td className="px-4 py-3 text-right">
                                  <Button
                                    type="button"
                                    variant="secondary"
                                    size="sm"
                                    onClick={() =>
                                      editSupplierCatalogItem(item)
                                    }
                                    className="h-8 px-3 text-xs"
                                  >
                                    Edit
                                  </Button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  {supplierPriceHistory.length > 0 && (
                    <div className="mt-6 overflow-hidden rounded-lg border border-border-subtle bg-card shadow-2xs">
                      <div className="flex items-center justify-between border-b border-border-subtle bg-muted-surface px-4 py-3">
                        <h4 className="m-0 text-xs font-bold uppercase tracking-wider text-text-secondary">
                          Recent Received Costs
                        </h4>
                        <span className="text-xs font-medium text-text-muted">
                          Last 20 supplier receipts
                        </span>
                      </div>
                      <div className="overflow-x-auto">
                        <table className="w-full text-left text-sm">
                          <thead>
                            <tr className="border-b border-border-subtle bg-muted-surface text-[0.72rem] font-bold uppercase tracking-wider text-text-secondary select-none">
                              <th className="px-4 py-2.5">Received</th>
                              <th className="px-4 py-2.5">Supplier</th>
                              <th className="px-4 py-2.5">Variant</th>
                              <th className="px-4 py-2.5 text-right">Qty</th>
                              <th className="px-4 py-2.5 text-right">
                                Unit Cost
                              </th>
                              <th className="px-4 py-2.5">Reference</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-border-subtle/60 text-xs">
                            {supplierPriceHistory.map((item) => (
                              <tr
                                key={item.id}
                                className="transition-colors hover:bg-muted-surface"
                              >
                                <td className="px-4 py-2.5 font-medium text-text-muted">
                                  {new Date(
                                    item.createdAt,
                                  ).toLocaleDateString()}
                                </td>
                                <td className="px-4 py-2.5 font-semibold text-text-main">
                                  {item.supplier.name}
                                </td>
                                <td className="px-4 py-2.5 text-text-secondary">
                                  {item.variant?.name ? (
                                    item.variant.name
                                  ) : (
                                    <span className="inline-flex items-center rounded-md border border-slate-200 bg-slate-100/80 px-2 py-0.5 text-xs font-semibold text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">
                                      Base product
                                    </span>
                                  )}
                                </td>
                                <td className="px-4 py-2.5 text-right font-semibold text-text-main tabular-nums">
                                  {item.quantity}
                                </td>
                                <td className="px-4 py-2.5 text-right font-semibold text-emerald-700 dark:text-emerald-400 tabular-nums">
                                  ${(item.unitCost / 100).toFixed(2)}
                                </td>
                                <td className="px-4 py-2.5 text-text-muted">
                                  {item.reference || '—'}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </div>
              </section>
            )}

            {editorTab === 'variants' && (
              <>
                {/* Sub-Card 1: Retail Variants */}
                <section className="rounded-lg border border-border-subtle bg-card shadow-sm">
                  <div className="border-b border-border-subtle px-4 py-6 sm:px-8">
                    <h3 className="text-base font-bold tracking-tight text-text-main">
                      Product variants
                    </h3>
                    <p className="mt-1 text-xs text-text-muted">
                      Use variants when each size, color, or other choice has
                      its own SKU, barcode, price, or stock level.
                    </p>
                  </div>

                  <div className="flex flex-col gap-4 px-4 py-6 sm:px-8">
                    {existingVariantDrafts.length > 0 && (
                      <div className="overflow-hidden rounded-lg border border-border-subtle bg-card">
                        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border-subtle bg-muted-surface px-4 py-3">
                          <div>
                            <p className="m-0 text-sm font-bold text-text-main">
                              Variants
                            </p>
                            <p className="mt-1 text-xs text-text-muted">
                              Edit selling price, cost, SKU, and barcode inline.
                              A blank cost uses the product cost.
                            </p>
                          </div>
                          <div className="flex flex-wrap items-center gap-2">
                            <Button
                              type="button"
                              onClick={() => {
                                existingVariantDrafts.forEach((variant) => {
                                  if (!variant.barcode) {
                                    const generated =
                                      '200' +
                                      Math.floor(
                                        100000000 + Math.random() * 900000000,
                                      ).toString();
                                    updateExistingVariant(
                                      variant.id,
                                      'barcode',
                                      generated,
                                    );
                                  }
                                });
                              }}
                              variant="secondary"
                              size="sm"
                              title="Auto-generate barcodes for all empty variant fields"
                            >
                              <Sparkles size={14} className="text-brand" />
                              Auto-generate barcodes
                            </Button>
                            <Button
                              type="button"
                              onClick={() => void saveExistingVariants()}
                              disabled={savingExistingVariants}
                              size="sm"
                            >
                              {savingExistingVariants
                                ? 'Saving…'
                                : 'Save variant changes'}
                            </Button>
                          </div>
                        </div>
                        <div className="overflow-x-auto">
                          <table className="w-full min-w-[1120px] text-left text-sm [&_thead_th]:border-b [&_thead_th]:border-border-subtle [&_thead_th]:bg-muted-surface [&_thead_th]:px-3 [&_thead_th]:py-3 [&_thead_th]:text-xs [&_thead_th]:font-bold [&_thead_th]:uppercase [&_thead_th]:tracking-wider [&_thead_th]:text-text-secondary [&_tbody_tr]:border-b [&_tbody_tr]:border-border-subtle [&_tbody_tr]:transition-colors [&_tbody_tr:hover]:bg-muted-surface [&_tbody_td]:px-3 [&_tbody_td]:py-2 [&_tbody_td:first-child]:min-w-[132px] [&_tbody_td:first-child]:align-middle [&_tbody_input]:!h-10 [&_tbody_input]:rounded-md">
                            <thead>
                              <tr>
                                {[
                                  'Variant',
                                  'SKU',
                                  'Regular price ($)',
                                  'Sale price ($)',
                                  'Cost ($)',
                                  'Barcode',
                                  'Stock',
                                  '',
                                ].map((heading, index) => (
                                  <th
                                    key={`${heading}-${index}`}
                                    className={
                                      heading === 'Stock' || heading === ''
                                        ? 'text-right'
                                        : 'text-left'
                                    }
                                  >
                                    {heading}
                                  </th>
                                ))}
                              </tr>
                            </thead>
                            <tbody>
                              {existingVariantDrafts.map((variant) => (
                                <tr key={variant.id}>
                                  <td>
                                    <span className="flex min-w-[108px] flex-col leading-5 text-text-main">
                                      {variant.name
                                        .split(' / ')
                                        .map((part, index) => (
                                          <span
                                            key={`${variant.id}-${part}-${index}`}
                                            className={
                                              index === 0
                                                ? 'font-bold'
                                                : 'text-xs font-medium text-text-muted'
                                            }
                                          >
                                            {index === 0 ? part : `/ ${part}`}
                                          </span>
                                        ))}
                                    </span>
                                  </td>
                                  <td>
                                    <Input
                                      value={variant.sku}
                                      onChange={(event) =>
                                        updateExistingVariant(
                                          variant.id,
                                          'sku',
                                          event.target.value.toUpperCase(),
                                        )
                                      }
                                      aria-label={`${variant.name} SKU`}
                                      className="min-w-[140px] font-mono"
                                    />
                                  </td>
                                  <td>
                                    <Input
                                      value={variant.regularPrice}
                                      onChange={(event) =>
                                        updateExistingVariant(
                                          variant.id,
                                          'regularPrice',
                                          event.target.value,
                                        )
                                      }
                                      onBlur={(e) => {
                                        if (e.target.value) {
                                          const num = parseFloat(
                                            e.target.value,
                                          );
                                          if (!isNaN(num))
                                            updateExistingVariant(
                                              variant.id,
                                              'regularPrice',
                                              num.toFixed(2),
                                            );
                                        }
                                      }}
                                      aria-label={`${variant.name} regular price`}
                                      type="number"
                                      min="0"
                                      step="0.01"
                                      inputMode="decimal"
                                      prefixText="$"
                                    />
                                  </td>
                                  <td>
                                    <Input
                                      value={variant.price}
                                      onChange={(event) =>
                                        updateExistingVariant(
                                          variant.id,
                                          'price',
                                          event.target.value,
                                        )
                                      }
                                      onBlur={(e) => {
                                        if (e.target.value) {
                                          const num = parseFloat(
                                            e.target.value,
                                          );
                                          if (!isNaN(num))
                                            updateExistingVariant(
                                              variant.id,
                                              'price',
                                              num.toFixed(2),
                                            );
                                        }
                                      }}
                                      aria-label={`${variant.name} sale price`}
                                      placeholder="No sale"
                                      type="number"
                                      min="0"
                                      step="0.01"
                                      inputMode="decimal"
                                      prefixText="$"
                                    />
                                  </td>
                                  <td>
                                    <Input
                                      value={variant.cost}
                                      onChange={(event) =>
                                        updateExistingVariant(
                                          variant.id,
                                          'cost',
                                          event.target.value,
                                        )
                                      }
                                      onBlur={(e) => {
                                        if (e.target.value) {
                                          const num = parseFloat(
                                            e.target.value,
                                          );
                                          if (!isNaN(num))
                                            updateExistingVariant(
                                              variant.id,
                                              'cost',
                                              num.toFixed(2),
                                            );
                                        }
                                      }}
                                      aria-label={`${variant.name} cost`}
                                      placeholder="Cost"
                                      type="number"
                                      min="0"
                                      step="0.01"
                                      inputMode="decimal"
                                      prefixText="$"
                                    />
                                  </td>
                                  <td>
                                    <div className="flex items-center gap-1">
                                      <Input
                                        value={variant.barcode}
                                        onChange={(event) =>
                                          updateExistingVariant(
                                            variant.id,
                                            'barcode',
                                            event.target.value,
                                          )
                                        }
                                        aria-label={`${variant.name} barcode`}
                                        placeholder="Optional"
                                        className="min-w-[130px] font-mono"
                                      />
                                      <Button
                                        type="button"
                                        variant="secondary"
                                        size="sm"
                                        title="Auto-generate barcode"
                                        onClick={() => {
                                          const generated =
                                            '200' +
                                            Math.floor(
                                              100000000 +
                                                Math.random() * 900000000,
                                            ).toString();
                                          updateExistingVariant(
                                            variant.id,
                                            'barcode',
                                            generated,
                                          );
                                        }}
                                        className="h-10 shrink-0 px-2"
                                      >
                                        <Sparkles
                                          size={13}
                                          className="text-brand"
                                        />
                                      </Button>
                                    </div>
                                  </td>
                                  <td className="text-right">
                                    <Button
                                      type="button"
                                      title={`Adjust stock for ${variant.name}`}
                                      aria-label={`Adjust stock for ${variant.name}`}
                                      onClick={() => {
                                        setStockAdjustmentVariant({
                                          id: variant.id,
                                          name: variant.name,
                                          stock: variant.stock,
                                        });
                                        setStockAdjustmentQuantity('');
                                        setStockAdjustmentReason('RECEIVED');
                                      }}
                                      variant="ghost"
                                      size="sm"
                                      className={
                                        variant.stock > 0
                                          ? 'font-bold text-brand'
                                          : 'font-bold text-text-subtle'
                                      }
                                    >
                                      {variant.stock}
                                      <Edit2 size={13} />
                                    </Button>
                                  </td>
                                  <td className="text-right">
                                    <Button
                                      type="button"
                                      title={`Delete variant ${variant.name}`}
                                      aria-label={`Delete variant ${variant.name}`}
                                      onClick={() =>
                                        setPendingExistingVariantDelete({
                                          id: variant.id,
                                          name: variant.name,
                                        })
                                      }
                                      variant="dangerSubtle"
                                      size="sm"
                                      className="size-9 p-0"
                                    >
                                      <Trash2 size={16} />
                                    </Button>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}

                    {variantProductId && (
                      <>
                        {variantOptions.length > 0 && (
                          <section className="rounded-lg border border-border-subtle bg-muted-surface p-5">
                            <p className="mb-3 text-sm font-bold text-text-main">
                              Default values
                            </p>
                            <div className="grid grid-cols-1 items-start gap-4 md:grid-cols-3">
                              <FormField label="SKU prefix">
                                <Input
                                  value={variantSkuPrefix}
                                  onChange={(e) =>
                                    setVariantSkuPrefix(
                                      e.target.value.toUpperCase(),
                                    )
                                  }
                                  placeholder="SHIRT"
                                  className="font-mono"
                                />
                              </FormField>

                              <FormField label="Default price">
                                <Input
                                  value={variantDefaultPrice}
                                  onChange={(e) =>
                                    setVariantDefaultPrice(e.target.value)
                                  }
                                  onBlur={(e) => {
                                    if (e.target.value) {
                                      const num = parseFloat(e.target.value);
                                      if (!isNaN(num))
                                        setVariantDefaultPrice(num.toFixed(2));
                                    }
                                  }}
                                  type="number"
                                  min="0"
                                  step="0.01"
                                  inputMode="decimal"
                                  placeholder="0.00"
                                  prefixText="$"
                                />
                              </FormField>

                              <FormField label="Default opening stock">
                                <div className="flex h-10 overflow-hidden rounded-md border border-border-default bg-card shadow-2xs">
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    className="h-full w-10 shrink-0 rounded-none border-r border-border-default p-0"
                                    title="Decrease opening stock"
                                    onClick={() => {
                                      const val =
                                        parseInt(variantDefaultStock, 10) || 0;
                                      setVariantDefaultStock(
                                        Math.max(0, val - 1).toString(),
                                      );
                                    }}
                                  >
                                    <Minus size={14} />
                                  </Button>
                                  <Input
                                    type="text"
                                    inputMode="numeric"
                                    pattern="[0-9]*"
                                    value={variantDefaultStock}
                                    onKeyDown={(e) => {
                                      if (
                                        !/[0-9]/.test(e.key) &&
                                        ![
                                          'Backspace',
                                          'Delete',
                                          'ArrowLeft',
                                          'ArrowRight',
                                          'Tab',
                                          'Enter',
                                        ].includes(e.key) &&
                                        !e.metaKey &&
                                        !e.ctrlKey
                                      ) {
                                        e.preventDefault();
                                      }
                                    }}
                                    onChange={(e) => {
                                      const sanitized = e.target.value.replace(
                                        /[^0-9]/g,
                                        '',
                                      );
                                      setVariantDefaultStock(sanitized);
                                    }}
                                    placeholder="0"
                                    className="h-full min-w-0 rounded-none border-0 text-center font-mono shadow-none focus:ring-0"
                                  />
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    className="h-full w-10 shrink-0 rounded-none border-l border-border-default p-0"
                                    title="Increase opening stock"
                                    onClick={() => {
                                      const val =
                                        parseInt(variantDefaultStock, 10) || 0;
                                      setVariantDefaultStock(
                                        (val + 1).toString(),
                                      );
                                    }}
                                  >
                                    <Plus size={14} />
                                  </Button>
                                </div>
                              </FormField>
                            </div>
                            <p className="mt-3 text-xs text-text-muted">
                              Defaults fill new combinations automatically. Edit
                              any row below for an exception.
                            </p>
                          </section>
                        )}

                        <section className="rounded-lg border border-border-subtle bg-muted-surface p-5">
                          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                            <div>
                              <p className="m-0 text-sm font-bold text-text-main">
                                Variant options
                              </p>
                              <p className="mt-1 text-xs text-text-muted">
                                Add values separated by commas. Combinations
                                appear automatically.
                              </p>
                            </div>
                            {variantOptions.length < 3 && (
                              <Button
                                type="button"
                                onClick={() =>
                                  setVariantOptions((current) => {
                                    const next = [
                                      ...current,
                                      {
                                        name: current.length ? 'Color' : 'Size',
                                        values: '',
                                      },
                                    ];
                                    buildVariantDrafts(next);
                                    return next;
                                  })
                                }
                                variant="secondary"
                                size="sm"
                              >
                                <Plus size={14} />{' '}
                                {variantOptions.length
                                  ? 'Add option'
                                  : 'Add variants'}
                              </Button>
                            )}
                          </div>
                          <div className="flex flex-col gap-2.5">
                            {variantOptions.map((option, index) => (
                              <div
                                key={index}
                                className="grid grid-cols-1 gap-2 sm:grid-cols-[minmax(150px,0.35fr)_minmax(0,1fr)_auto]"
                              >
                                <Input
                                  value={option.name}
                                  onChange={(e) =>
                                    updateVariantOption(
                                      index,
                                      'name',
                                      e.target.value,
                                    )
                                  }
                                  placeholder="Option name"
                                  aria-label={`Option ${index + 1} name`}
                                  className="font-semibold"
                                />
                                <Input
                                  value={option.values}
                                  onChange={(e) =>
                                    updateVariantOption(
                                      index,
                                      'values',
                                      e.target.value,
                                    )
                                  }
                                  placeholder="e.g. Red, Blue, Black"
                                  aria-label={`${option.name || 'Option'} values`}
                                />
                                <Button
                                  type="button"
                                  aria-label={`Remove ${option.name || 'option'}`}
                                  onClick={() =>
                                    setVariantOptions((current) => {
                                      const next = current.filter(
                                        (_, optionIndex) =>
                                          optionIndex !== index,
                                      );
                                      buildVariantDrafts(next);
                                      return next;
                                    })
                                  }
                                  variant="dangerSubtle"
                                  size="sm"
                                >
                                  <X size={15} />
                                </Button>
                              </div>
                            ))}
                          </div>
                        </section>

                        {variantDrafts.length > 0 && (
                          <div className="overflow-hidden rounded-lg border border-border-subtle bg-card">
                            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border-subtle bg-muted-surface px-4 py-3">
                              <span className="text-sm font-bold text-text-main">
                                {variantDrafts.length} new variant
                                {variantDrafts.length === 1 ? '' : 's'}
                              </span>
                              <Input
                                value={variantSearch}
                                onChange={(e) =>
                                  setVariantSearch(e.target.value)
                                }
                                placeholder="Search variants"
                                className="w-[180px]"
                              />
                            </div>
                            {selectedVariantDrafts.length > 0 && (
                              <div className="flex flex-wrap items-end gap-3 border-b border-brand-border bg-brand-subtle px-4 py-3">
                                <span className="mr-1 text-xs font-bold text-brand">
                                  {selectedVariantDrafts.length} selected
                                </span>
                                <FormField label="Set price">
                                  <Input
                                    value={bulkVariantPrice}
                                    onChange={(e) =>
                                      setBulkVariantPrice(e.target.value)
                                    }
                                    type="number"
                                    min="0"
                                    step="0.01"
                                    prefixText="$"
                                    className="w-[100px]"
                                  />
                                </FormField>
                                <FormField label="Set opening stock">
                                  <Input
                                    value={bulkVariantStock}
                                    onChange={(e) =>
                                      setBulkVariantStock(e.target.value)
                                    }
                                    type="number"
                                    min="0"
                                    step="1"
                                    className="w-[120px]"
                                  />
                                </FormField>
                                <Button
                                  type="button"
                                  onClick={applyBulkVariantValues}
                                  size="sm"
                                >
                                  Apply
                                </Button>
                                <Button
                                  type="button"
                                  onClick={() => setSelectedVariantDrafts([])}
                                  variant="secondary"
                                  size="sm"
                                >
                                  Clear
                                </Button>
                              </div>
                            )}
                            <div className="overflow-x-auto">
                              <table className="w-full min-w-[760px] text-left text-sm [&_thead_th]:border-b [&_thead_th]:border-border-subtle [&_thead_th]:bg-muted-surface [&_thead_th]:px-3 [&_thead_th]:py-3 [&_thead_th]:text-xs [&_thead_th]:font-bold [&_thead_th]:uppercase [&_thead_th]:tracking-wider [&_thead_th]:text-text-secondary [&_tbody_tr]:border-b [&_tbody_tr]:border-border-subtle [&_tbody_tr:hover]:bg-muted-surface [&_tbody_td]:px-3 [&_tbody_td]:py-2 [&_tbody_input]:h-10 [&_tbody_input]:rounded-md">
                                <thead>
                                  <tr>
                                    <th>
                                      <input
                                        type="checkbox"
                                        className="size-4 rounded border-border-default text-brand focus:ring-brand/10"
                                        aria-label="Select all visible variants"
                                        checked={
                                          visibleVariantDrafts.length > 0 &&
                                          visibleVariantDrafts.every((draft) =>
                                            selectedVariantDrafts.includes(
                                              draft.key,
                                            ),
                                          )
                                        }
                                        onChange={(e) =>
                                          setSelectedVariantDrafts(
                                            e.target.checked
                                              ? Array.from(
                                                  new Set([
                                                    ...selectedVariantDrafts,
                                                    ...visibleVariantDrafts.map(
                                                      (draft) => draft.key,
                                                    ),
                                                  ]),
                                                )
                                              : selectedVariantDrafts.filter(
                                                  (key) =>
                                                    !visibleVariantDrafts.some(
                                                      (draft) =>
                                                        draft.key === key,
                                                    ),
                                                ),
                                          )
                                        }
                                      />
                                    </th>
                                    {[
                                      'Variant',
                                      'SKU',
                                      'Price ($)',
                                      'Opening stock',
                                      'Barcode',
                                    ].map((heading) => (
                                      <th key={heading}>{heading}</th>
                                    ))}
                                  </tr>
                                </thead>
                                <tbody>
                                  {visibleVariantDrafts.map((draft) => {
                                    const index = variantDrafts.findIndex(
                                      (item) => item.key === draft.key,
                                    );
                                    return (
                                      <tr key={draft.key}>
                                        <td>
                                          <input
                                            type="checkbox"
                                            className="size-4 rounded border-border-default text-brand focus:ring-brand/10"
                                            aria-label={`Select ${draft.name}`}
                                            checked={selectedVariantDrafts.includes(
                                              draft.key,
                                            )}
                                            onChange={(e) =>
                                              setSelectedVariantDrafts(
                                                (current) =>
                                                  e.target.checked
                                                    ? [...current, draft.key]
                                                    : current.filter(
                                                        (key) =>
                                                          key !== draft.key,
                                                      ),
                                              )
                                            }
                                          />
                                        </td>
                                        <td className="font-bold text-text-main">
                                          {draft.name}
                                        </td>
                                        {(
                                          [
                                            'sku',
                                            'price',
                                            'openingStock',
                                            'barcode',
                                          ] as const
                                        ).map((field) => (
                                          <td key={field}>
                                            <div className="flex items-center gap-1">
                                              <Input
                                                value={draft[field]}
                                                type={
                                                  field === 'price' ||
                                                  field === 'openingStock'
                                                    ? 'number'
                                                    : 'text'
                                                }
                                                min={
                                                  field === 'price' ||
                                                  field === 'openingStock'
                                                    ? '0'
                                                    : undefined
                                                }
                                                step={
                                                  field === 'price'
                                                    ? '0.01'
                                                    : undefined
                                                }
                                                onChange={(e) =>
                                                  updateVariantDraft(
                                                    index,
                                                    field,
                                                    e.target.value,
                                                  )
                                                }
                                                className={`${field === 'sku' ? 'min-w-[140px]' : 'min-w-[100px]'} ${field === 'sku' || field === 'barcode' ? 'font-mono' : ''}`}
                                              />
                                              {field === 'barcode' && (
                                                <Button
                                                  type="button"
                                                  variant="secondary"
                                                  size="sm"
                                                  title="Auto-generate barcode"
                                                  onClick={() => {
                                                    const generated =
                                                      '200' +
                                                      Math.floor(
                                                        100000000 +
                                                          Math.random() *
                                                            900000000,
                                                      ).toString();
                                                    updateVariantDraft(
                                                      index,
                                                      'barcode',
                                                      generated,
                                                    );
                                                  }}
                                                  className="h-10 shrink-0 px-2"
                                                >
                                                  <Sparkles
                                                    size={13}
                                                    className="text-brand"
                                                  />
                                                </Button>
                                              )}
                                            </div>
                                          </td>
                                        ))}
                                      </tr>
                                    );
                                  })}
                                </tbody>
                              </table>
                            </div>
                          </div>
                        )}

                        {variantOptionGalleries.length > 0 && (
                          <section className="rounded-lg border border-border-subtle bg-muted-surface p-5">
                            <div className="mb-4">
                              <p className="m-0 text-sm font-bold text-text-main">
                                Images by variant value
                              </p>
                              <p className="mt-1 text-xs text-text-muted">
                                Upload an image once for a value, such as Red.
                                Every Red variant can use this gallery.
                              </p>
                            </div>
                            <div className="flex flex-col gap-4">
                              {variantOptionGalleries.map((option) => (
                                <div
                                  key={option.id}
                                  className="border-t border-border-subtle pt-4 first:border-t-0 first:pt-0"
                                >
                                  <p className="mb-2.5 text-xs font-bold uppercase tracking-wider text-text-subtle">
                                    {option.name}
                                  </p>
                                  <div className="flex flex-wrap gap-3">
                                    {option.values.map((value) => (
                                      <div
                                        key={value.id}
                                        className="w-[150px] rounded-lg border border-border-subtle bg-card p-3 shadow-sm"
                                      >
                                        {editingVariantValue?.id ===
                                        value.id ? (
                                          <div className="mb-2 flex gap-1">
                                            <Input
                                              autoFocus
                                              value={editingVariantValue.name}
                                              onChange={(event) =>
                                                setEditingVariantValue({
                                                  ...editingVariantValue,
                                                  name: event.target.value,
                                                })
                                              }
                                              onKeyDown={(event) => {
                                                if (event.key === 'Enter') {
                                                  event.preventDefault();
                                                  void saveVariantValueName();
                                                }
                                                if (event.key === 'Escape')
                                                  setEditingVariantValue(null);
                                              }}
                                              aria-label={`Rename ${value.name}`}
                                              className="h-8 min-w-0 flex-1 px-2 text-xs font-bold"
                                            />
                                            <Button
                                              type="button"
                                              aria-label="Save value name"
                                              onClick={() =>
                                                void saveVariantValueName()
                                              }
                                              size="sm"
                                              className="h-8 px-2"
                                            >
                                              <Check size={13} />
                                            </Button>
                                          </div>
                                        ) : (
                                          <div className="mb-2 flex items-center gap-1">
                                            <p className="min-w-0 flex-1 truncate text-xs font-bold text-text-main">
                                              {value.name}
                                            </p>
                                            <Button
                                              type="button"
                                              aria-label={`Rename ${value.name}`}
                                              onClick={() =>
                                                setEditingVariantValue({
                                                  id: value.id,
                                                  name: value.name,
                                                })
                                              }
                                              variant="ghost"
                                              size="sm"
                                              className="size-7 p-0 text-brand"
                                            >
                                              <Edit2 size={13} />
                                            </Button>
                                            <Button
                                              type="button"
                                              aria-label={`Delete ${value.name}`}
                                              onClick={() =>
                                                setPendingVariantValueDelete({
                                                  id: value.id,
                                                  name: value.name,
                                                  optionName: option.name,
                                                })
                                              }
                                              variant="ghost"
                                              size="sm"
                                              className="h-auto w-auto border-0 bg-transparent p-0 text-rose-500 shadow-none hover:bg-transparent hover:text-rose-700"
                                            >
                                              <Trash2 size={13} />
                                            </Button>
                                          </div>
                                        )}
                                        <div className="flex min-h-11 flex-wrap gap-1.5">
                                          {value.images.map((image) => (
                                            <div
                                              key={image.id}
                                              className="relative"
                                            >
                                              <img
                                                src={image.imageUrl}
                                                alt={`${value.name} variant`}
                                                className="size-[42px] rounded-md border border-border-subtle object-cover"
                                              />
                                              <Button
                                                type="button"
                                                aria-label={`Remove ${value.name} image`}
                                                onClick={() =>
                                                  void removeVariantValueImage(
                                                    value.id,
                                                    image.id,
                                                  )
                                                }
                                                variant="ghost"
                                                size="sm"
                                                className="absolute -top-1 -right-1 h-auto w-auto border-0 bg-transparent p-0 text-rose-500 shadow-none hover:bg-transparent hover:text-rose-700"
                                              >
                                                <X size={10} />
                                              </Button>
                                            </div>
                                          ))}
                                        </div>
                                        <label className="mt-2 inline-flex h-9 w-full cursor-pointer items-center justify-center gap-2 rounded-md border border-border-default bg-card px-3 text-xs font-bold text-text-main shadow-sm transition hover:bg-muted-surface">
                                          <ImageIcon size={13} />{' '}
                                          {uploadingVariantValueId === value.id
                                            ? 'Uploading…'
                                            : 'Add image'}
                                          <input
                                            type="file"
                                            accept="image/*"
                                            disabled={
                                              uploadingVariantValueId !== ''
                                            }
                                            className="sr-only"
                                            onChange={(e) => {
                                              void uploadVariantValueImage(
                                                value.id,
                                                e.target.files?.[0],
                                              );
                                              e.target.value = '';
                                            }}
                                          />
                                        </label>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              ))}
                            </div>
                          </section>
                        )}
                      </>
                    )}
                  </div>

                  {editingVariant && (
                    <section className="mt-4 rounded-lg border border-border-subtle bg-muted-surface p-5">
                      <h4 className="mb-4 text-sm font-bold text-text-main">
                        Edit Variant — {editingVariant.product.name}
                      </h4>
                      <form
                        onSubmit={saveVariant}
                        className="flex flex-col gap-4"
                      >
                        <div className="grid grid-cols-1 items-start gap-4 md:grid-cols-2">
                          <FormField label="Variant name" required>
                            <Input
                              required
                              value={variantName}
                              onChange={(e) => setVariantName(e.target.value)}
                              placeholder="Variant name"
                            />
                          </FormField>
                          <FormField label="Variant SKU" required>
                            <Input
                              required
                              value={variantSku}
                              onChange={(e) => setVariantSku(e.target.value)}
                              placeholder="Variant SKU"
                            />
                          </FormField>
                          <FormField label="Barcode">
                            <Input
                              value={variantBarcode}
                              onChange={(e) =>
                                setVariantBarcode(e.target.value)
                              }
                              placeholder="Barcode"
                            />
                          </FormField>
                          <FormField label="Price">
                            <Input
                              value={variantPrice}
                              onChange={(e) => setVariantPrice(e.target.value)}
                              type="number"
                              min="0"
                              step="0.01"
                              placeholder="Price"
                              prefixText="$"
                            />
                          </FormField>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <Button type="submit" size="sm">
                            Save Variant
                          </Button>
                          <Button
                            type="button"
                            onClick={() => setEditingVariant(null)}
                            variant="secondary"
                            size="sm"
                          >
                            Cancel
                          </Button>
                        </div>
                      </form>
                    </section>
                  )}
                </section>

                {/* Legacy POS modifiers are intentionally hidden from the Shopify-style product editor. */}
                {false && (
                  <>
                    {/* Sub-Card 2: Reusable Option Sets */}
                    <div
                      style={{
                        background: '#fff',
                        borderRadius: 14,
                        border: '1px solid #e2e8f0',
                        padding: 22,
                        boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
                      }}
                    >
                      <h3
                        style={{
                          margin: '0 0 4px',
                          fontSize: '1rem',
                          fontWeight: 700,
                          color: '#0f172a',
                        }}
                      >
                        Reusable Option Sets
                      </h3>
                      <p
                        style={{
                          margin: '0 0 16px',
                          fontSize: '0.82rem',
                          color: '#64748b',
                        }}
                      >
                        Create a set once (e.g. Drink Sizes S, M, L) then apply
                        it to any product.
                      </p>

                      <form
                        onSubmit={createOptionSet}
                        style={{
                          display: 'flex',
                          flexDirection: 'column',
                          gap: 14,
                        }}
                      >
                        <div
                          style={{
                            display: 'grid',
                            gridTemplateColumns: '1fr 1fr',
                            gap: 14,
                          }}
                        >
                          <div>
                            <label
                              style={{
                                display: 'block',
                                fontSize: '0.8rem',
                                fontWeight: 600,
                                color: '#374151',
                                marginBottom: 4,
                              }}
                            >
                              Template
                            </label>
                            <select
                              value={preset}
                              onChange={(e) => setPreset(e.target.value)}
                              style={{
                                width: '100%',
                                padding: '8px 12px',
                                borderRadius: 8,
                                border: '1.5px solid #e2e8f0',
                                fontSize: '0.85rem',
                              }}
                            >
                              <option value="DRINK_SIZES">
                                Drink sizes — S, M, L
                              </option>
                              <option value="SHOE_SIZES">
                                Shoe sizes — 34 to 45
                              </option>
                              <option value="CLOTHING_SIZES">
                                Clothing sizes — XS to 2XL
                              </option>
                              <option value="SUGAR_LEVEL">
                                Sugar level — 0% to 100%
                              </option>
                              <option value="TEMPERATURE">
                                Temperature — Hot, Iced
                              </option>
                              <option value="ADD_ONS">Add-ons</option>
                              <option value="CUSTOM">Custom set</option>
                            </select>
                          </div>
                          {preset === 'CUSTOM' && (
                            <div>
                              <label
                                style={{
                                  display: 'block',
                                  fontSize: '0.8rem',
                                  fontWeight: 600,
                                  color: '#374151',
                                  marginBottom: 4,
                                }}
                              >
                                Set Name
                              </label>
                              <input
                                required
                                name="name"
                                placeholder="Bread size"
                                style={{
                                  width: '100%',
                                  padding: '8px 12px',
                                  borderRadius: 8,
                                  border: '1.5px solid #e2e8f0',
                                  fontSize: '0.85rem',
                                }}
                              />
                            </div>
                          )}
                          {preset === 'CUSTOM' && (
                            <div style={{ gridColumn: '1 / -1' }}>
                              <label
                                style={{
                                  display: 'block',
                                  fontSize: '0.8rem',
                                  fontWeight: 600,
                                  color: '#374151',
                                  marginBottom: 4,
                                }}
                              >
                                Option Names (comma separated)
                              </label>
                              <input
                                required
                                name="optionNames"
                                placeholder="Small, Medium, Large"
                                style={{
                                  width: '100%',
                                  padding: '8px 12px',
                                  borderRadius: 8,
                                  border: '1.5px solid #e2e8f0',
                                  fontSize: '0.85rem',
                                }}
                              />
                            </div>
                          )}
                          <div>
                            <label
                              style={{
                                display: 'block',
                                fontSize: '0.8rem',
                                fontWeight: 600,
                                color: '#374151',
                                marginBottom: 4,
                              }}
                            >
                              Min Choices
                            </label>
                            <input
                              name="minSelections"
                              type="number"
                              min="0"
                              defaultValue="0"
                              style={{
                                width: '100%',
                                padding: '8px 12px',
                                borderRadius: 8,
                                border: '1.5px solid #e2e8f0',
                                fontSize: '0.85rem',
                              }}
                            />
                          </div>
                          <div>
                            <label
                              style={{
                                display: 'block',
                                fontSize: '0.8rem',
                                fontWeight: 600,
                                color: '#374151',
                                marginBottom: 4,
                              }}
                            >
                              Max Choices
                            </label>
                            <input
                              name="maxSelections"
                              type="number"
                              min="1"
                              defaultValue="1"
                              style={{
                                width: '100%',
                                padding: '8px 12px',
                                borderRadius: 8,
                                border: '1.5px solid #e2e8f0',
                                fontSize: '0.85rem',
                              }}
                            />
                          </div>
                        </div>
                        <div>
                          <button
                            type="submit"
                            style={{
                              padding: '8px 18px',
                              borderRadius: 8,
                              background: '#0d9488',
                              color: '#fff',
                              fontWeight: 600,
                              fontSize: '0.85rem',
                              border: 'none',
                              cursor: 'pointer',
                            }}
                          >
                            Create Option Set
                          </button>
                        </div>
                      </form>

                      {optionSets.length > 0 && (
                        <div
                          style={{
                            marginTop: 16,
                            display: 'flex',
                            flexDirection: 'column',
                            gap: 8,
                          }}
                        >
                          <p
                            style={{
                              margin: '0 0 6px',
                              fontSize: '0.78rem',
                              fontWeight: 700,
                              color: '#64748b',
                              textTransform: 'uppercase',
                            }}
                          >
                            Existing Option Sets
                          </p>
                          {optionSets.map((s) => (
                            <div
                              key={s.id}
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                padding: '8px 12px',
                                borderRadius: 8,
                                background: '#f8fafc',
                                border: '1px solid #e2e8f0',
                                fontSize: '0.82rem',
                              }}
                            >
                              <span
                                style={{ fontWeight: 600, color: '#0f172a' }}
                              >
                                {s.name}
                              </span>
                              <span style={{ color: '#64748b' }}>
                                {s.options.map((o) => o.name).join(', ')}
                              </span>
                              <span
                                style={{
                                  color: '#94a3b8',
                                  fontSize: '0.75rem',
                                }}
                              >
                                ({s.minSelections}–{s.maxSelections} choices)
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Sub-Card 3: Apply Option Set */}
                    <div
                      style={{
                        background: '#fff',
                        borderRadius: 14,
                        border: '1px solid #e2e8f0',
                        padding: 22,
                        boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
                      }}
                    >
                      <h3
                        style={{
                          margin: '0 0 4px',
                          fontSize: '1rem',
                          fontWeight: 700,
                          color: '#0f172a',
                        }}
                      >
                        Apply Option Set to Product
                      </h3>
                      <p
                        style={{
                          margin: '0 0 16px',
                          fontSize: '0.82rem',
                          color: '#64748b',
                        }}
                      >
                        Attach a created option set to a specific product.
                      </p>
                      <form
                        onSubmit={applyOptionSet}
                        style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}
                      >
                        <select
                          required
                          name="productId"
                          style={{
                            flex: 1,
                            minWidth: 200,
                            padding: '8px 12px',
                            borderRadius: 8,
                            border: '1.5px solid #e2e8f0',
                            fontSize: '0.85rem',
                          }}
                        >
                          <option value="">Select product</option>
                          {products.map((p) => (
                            <option key={p.id} value={p.id}>
                              {p.name}
                            </option>
                          ))}
                        </select>
                        <select
                          required
                          name="optionSetId"
                          style={{
                            flex: 1,
                            minWidth: 200,
                            padding: '8px 12px',
                            borderRadius: 8,
                            border: '1.5px solid #e2e8f0',
                            fontSize: '0.85rem',
                          }}
                        >
                          <option value="">Select option set</option>
                          {optionSets.map((s) => (
                            <option key={s.id} value={s.id}>
                              {s.name} (
                              {s.options.map((o) => o.name).join(', ')})
                            </option>
                          ))}
                        </select>
                        <button
                          type="submit"
                          style={{
                            padding: '8px 18px',
                            borderRadius: 8,
                            background: '#0d9488',
                            color: '#fff',
                            fontWeight: 600,
                            fontSize: '0.85rem',
                            border: 'none',
                            cursor: 'pointer',
                          }}
                        >
                          Apply
                        </button>
                      </form>
                    </div>

                    {/* Sub-Card 4: Set Option Prices */}
                    <div
                      style={{
                        background: '#fff',
                        borderRadius: 14,
                        border: '1px solid #e2e8f0',
                        padding: 22,
                        boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
                      }}
                    >
                      <h3
                        style={{
                          margin: '0 0 4px',
                          fontSize: '1rem',
                          fontWeight: 700,
                          color: '#0f172a',
                        }}
                      >
                        Set Option Extra Prices
                      </h3>
                      <p
                        style={{
                          margin: '0 0 16px',
                          fontSize: '0.82rem',
                          color: '#64748b',
                        }}
                      >
                        Set price adjustments for each option choice (e.g. Large
                        +$0.50).
                      </p>
                      <select
                        value={pricedProductId}
                        onChange={(e) => selectProductForPrices(e.target.value)}
                        style={{
                          width: '100%',
                          padding: '8px 12px',
                          borderRadius: 8,
                          border: '1.5px solid #e2e8f0',
                          fontSize: '0.85rem',
                          marginBottom: 16,
                        }}
                      >
                        <option value="">Select product with modifiers</option>
                        {products
                          .filter((p) => p.modifierGroups.length > 0)
                          .map((p) => (
                            <option key={p.id} value={p.id}>
                              {p.name}
                            </option>
                          ))}
                      </select>

                      {pricedProduct && (
                        <form
                          onSubmit={saveOptionPrices}
                          style={{
                            display: 'flex',
                            flexDirection: 'column',
                            gap: 12,
                          }}
                        >
                          {pricedProduct!.modifierGroups.map((g) => (
                            <div
                              key={g.id}
                              style={{
                                padding: 14,
                                background: '#f8fafc',
                                borderRadius: 10,
                                border: '1px solid #e2e8f0',
                              }}
                            >
                              <p
                                style={{
                                  margin: '0 0 10px',
                                  fontWeight: 700,
                                  fontSize: '0.85rem',
                                  color: '#334151',
                                }}
                              >
                                {g.name}
                              </p>
                              <div
                                style={{
                                  display: 'grid',
                                  gridTemplateColumns: '1fr 1fr',
                                  gap: 10,
                                }}
                              >
                                {g.options.map((opt) => (
                                  <div key={opt.id}>
                                    <label
                                      style={{
                                        display: 'block',
                                        fontSize: '0.78rem',
                                        fontWeight: 600,
                                        color: '#64748b',
                                        marginBottom: 4,
                                      }}
                                    >
                                      {opt.name} extra price ($)
                                    </label>
                                    <input
                                      type="number"
                                      min="0"
                                      step="0.01"
                                      value={optionPrices[opt.id] ?? '0.00'}
                                      onChange={(e) =>
                                        setOptionPrices((curr) => ({
                                          ...curr,
                                          [opt.id]: e.target.value,
                                        }))
                                      }
                                      style={{
                                        width: '100%',
                                        padding: '6px 10px',
                                        borderRadius: 6,
                                        border: '1px solid #cbd5e1',
                                        fontSize: '0.85rem',
                                      }}
                                    />
                                  </div>
                                ))}
                              </div>
                            </div>
                          ))}
                          <div>
                            <button
                              type="submit"
                              style={{
                                padding: '8px 18px',
                                borderRadius: 8,
                                background: '#0d9488',
                                color: '#fff',
                                fontWeight: 600,
                                fontSize: '0.85rem',
                                border: 'none',
                                cursor: 'pointer',
                              }}
                            >
                              Save Option Prices
                            </button>
                          </div>
                        </form>
                      )}
                    </div>

                    {/* Sub-Card 5: Custom One-off Option */}
                    <div
                      style={{
                        background: '#fff',
                        borderRadius: 14,
                        border: '1px solid #e2e8f0',
                        padding: 22,
                        boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
                      }}
                    >
                      <h3
                        style={{
                          margin: '0 0 4px',
                          fontSize: '1rem',
                          fontWeight: 700,
                          color: '#0f172a',
                        }}
                      >
                        Custom One-off Option
                      </h3>
                      <p
                        style={{
                          margin: '0 0 16px',
                          fontSize: '0.82rem',
                          color: '#64748b',
                        }}
                      >
                        Add an unusual option specific to a single product.
                      </p>
                      <form
                        onSubmit={addModifier}
                        style={{
                          display: 'flex',
                          flexDirection: 'column',
                          gap: 12,
                        }}
                      >
                        <div
                          style={{
                            display: 'grid',
                            gridTemplateColumns: '1fr 1fr',
                            gap: 12,
                          }}
                        >
                          <div>
                            <label
                              style={{
                                display: 'block',
                                fontSize: '0.8rem',
                                fontWeight: 600,
                                color: '#374151',
                                marginBottom: 4,
                              }}
                            >
                              Product
                            </label>
                            <select
                              required
                              name="productId"
                              style={{
                                width: '100%',
                                padding: '8px 12px',
                                borderRadius: 8,
                                border: '1.5px solid #e2e8f0',
                                fontSize: '0.85rem',
                              }}
                            >
                              <option value="">Select product</option>
                              {products.map((p) => (
                                <option key={p.id} value={p.id}>
                                  {p.name}
                                </option>
                              ))}
                            </select>
                          </div>
                          <div>
                            <label
                              style={{
                                display: 'block',
                                fontSize: '0.8rem',
                                fontWeight: 600,
                                color: '#374151',
                                marginBottom: 4,
                              }}
                            >
                              Modifier Type
                            </label>
                            <select
                              value={modifierGroup}
                              onChange={(e) => setModifierGroup(e.target.value)}
                              style={{
                                width: '100%',
                                padding: '8px 12px',
                                borderRadius: 8,
                                border: '1.5px solid #e2e8f0',
                                fontSize: '0.85rem',
                              }}
                            >
                              <option>Size</option>
                              <option>Sugar level</option>
                              <option>Temperature</option>
                              <option>Add-ons</option>
                              <option value="OTHER">Other</option>
                            </select>
                          </div>
                          {modifierGroup === 'OTHER' && (
                            <div>
                              <label
                                style={{
                                  display: 'block',
                                  fontSize: '0.8rem',
                                  fontWeight: 600,
                                  color: '#374151',
                                  marginBottom: 4,
                                }}
                              >
                                Custom Group Name
                              </label>
                              <input
                                required
                                name="customGroupName"
                                placeholder="Milk"
                                style={{
                                  width: '100%',
                                  padding: '8px 12px',
                                  borderRadius: 8,
                                  border: '1.5px solid #e2e8f0',
                                  fontSize: '0.85rem',
                                }}
                              />
                            </div>
                          )}
                          <div>
                            <label
                              style={{
                                display: 'block',
                                fontSize: '0.8rem',
                                fontWeight: 600,
                                color: '#374151',
                                marginBottom: 4,
                              }}
                            >
                              Option Name
                            </label>
                            <input
                              required
                              name="optionName"
                              placeholder="Large"
                              style={{
                                width: '100%',
                                padding: '8px 12px',
                                borderRadius: 8,
                                border: '1.5px solid #e2e8f0',
                                fontSize: '0.85rem',
                              }}
                            />
                          </div>
                          <div>
                            <label
                              style={{
                                display: 'block',
                                fontSize: '0.8rem',
                                fontWeight: 600,
                                color: '#374151',
                                marginBottom: 4,
                              }}
                            >
                              Price Change ($)
                            </label>
                            <input
                              name="priceAdjustment"
                              type="number"
                              step="0.01"
                              defaultValue="0"
                              style={{
                                width: '100%',
                                padding: '8px 12px',
                                borderRadius: 8,
                                border: '1.5px solid #e2e8f0',
                                fontSize: '0.85rem',
                              }}
                            />
                          </div>
                        </div>
                        <div>
                          <button
                            type="submit"
                            style={{
                              padding: '8px 18px',
                              borderRadius: 8,
                              background: '#0d9488',
                              color: '#fff',
                              fontWeight: 600,
                              fontSize: '0.85rem',
                              border: 'none',
                              cursor: 'pointer',
                            }}
                          >
                            Add Custom Option
                          </button>
                        </div>
                      </form>
                    </div>
                  </>
                )}
              </>
            )}
          </div>
        )}

        {/* ─────────────────────────────────────────────────────────────────── */}
        {/* TAB 2: CATEGORIES                                                   */}
        {/* ─────────────────────────────────────────────────────────────────── */}
        {activeTab === 'categories' && (
          <section className="overflow-hidden rounded-lg border border-border-subtle bg-card shadow-sm">
            <div className="border-b border-border-subtle px-4 py-6 sm:px-8">
              <div className="flex items-start gap-4">
                <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-brand-subtle text-brand ring-1 ring-inset ring-brand-border">
                  <Tag size={21} aria-hidden="true" />
                </div>
                <div>
                  <h2 className="mb-1 text-base font-bold tracking-tight text-text-main">
                    Product Categories
                  </h2>
                  <p className="m-0 max-w-2xl text-sm leading-6 text-text-muted">
                    Organize and reorder products for faster checkout.
                  </p>
                </div>
              </div>
            </div>

            <div className="border-b border-border-subtle bg-muted-surface px-4 py-6 sm:px-8">
              <form onSubmit={createCategory} className="max-w-2xl">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
                  <FormField
                    id="new-category-name"
                    label="Create a category"
                    required
                    className="min-w-0 flex-1"
                  >
                    <Input
                      id="new-category-name"
                      required
                      name="name"
                      placeholder="e.g. Coffee, Bakery, Shoes"
                      className="w-full"
                    />
                  </FormField>
                  <Button type="submit" className="w-full shrink-0 sm:w-auto">
                    <Plus size={16} />
                    Add Category
                  </Button>
                </div>
              </form>
            </div>

            <div className="px-4 py-6 sm:px-8">
              <div className="mb-4 flex items-center justify-between gap-3">
                <div>
                  <h3 className="mb-1 text-xs font-bold uppercase tracking-wider text-teal-700">
                    Your categories
                  </h3>
                  <p className="m-0 text-sm text-text-muted">
                    {categories.length === 0
                      ? 'Create your first category to organize the catalog.'
                      : `${categories.length} ${categories.length === 1 ? 'category' : 'categories'} in your catalog`}
                  </p>
                </div>
                {categories.length > 0 && (
                  <span className="rounded-full bg-brand-subtle px-3 py-1 text-xs font-bold text-brand ring-1 ring-inset ring-brand-border">
                    {categoryProductTotal} products assigned
                  </span>
                )}
              </div>

              {categories.length === 0 ? (
                <div className="rounded-lg border border-dashed border-border-default bg-muted-surface px-5 py-10 text-center">
                  <Tag className="mx-auto mb-3 text-text-subtle" size={24} />
                  <p className="m-0 text-sm font-semibold text-text-secondary">
                    No categories yet
                  </p>
                  <p className="mt-1 text-sm text-text-muted">
                    Use the form above to add the first one.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
                  {categories.map((c, index) => {
                    const productCount = c._count?.products ?? 0;
                    const isEditing = editingCategory?.id === c.id;
                    const isDragging = draggedCategoryIndex === index;
                    return (
                      <div
                        key={c.id}
                        draggable={!isEditing}
                        onDragStart={(e) => handleCategoryDragStart(e, index)}
                        onDragOver={(e) => handleCategoryDragOver(e, index)}
                        onDragEnd={handleCategoryDragEnd}
                        title="Drag to reorder category"
                        className={`group flex min-h-14 items-center justify-between gap-2 rounded-lg border bg-card px-3 py-2 shadow-sm transition duration-150 ${
                          isDragging
                            ? 'scale-[0.98] border-dashed border-brand bg-brand-subtle opacity-60'
                            : 'border-border-subtle hover:-translate-y-px hover:border-brand-border hover:shadow-md'
                        } ${isEditing ? 'cursor-default' : 'cursor-grab active:cursor-grabbing'}`}
                      >
                        {isEditing ? (
                          <form
                            onSubmit={saveCategory}
                            className="m-0 flex w-full items-center gap-2"
                          >
                            <Input
                              aria-label="Category name"
                              value={categoryName}
                              onChange={(event) =>
                                setCategoryName(event.target.value)
                              }
                              className="h-8 min-w-[120px] flex-1 px-2 text-sm"
                              autoFocus
                            />
                            <Button type="submit" size="sm">
                              Save
                            </Button>
                            <Button
                              type="button"
                              variant="secondary"
                              size="sm"
                              onClick={() => setEditingCategory(null)}
                            >
                              Cancel
                            </Button>
                          </form>
                        ) : (
                          <>
                            <div className="flex min-w-0 items-center gap-2 overflow-hidden">
                              <GripVertical
                                size={15}
                                className="shrink-0 cursor-grab text-text-subtle"
                              />
                              <Tag
                                size={15}
                                className="shrink-0 text-teal-700"
                              />
                              <span className="truncate text-sm font-bold text-text-main">
                                {c.name}
                              </span>
                            </div>

                            <div className="flex shrink-0 items-center gap-1.5">
                              <span className="rounded-full border border-border-subtle bg-muted-surface px-2 py-0.5 text-xs font-semibold text-text-secondary">
                                {productCount}{' '}
                                {productCount === 1 ? 'product' : 'products'}
                              </span>
                              <Button
                                type="button"
                                variant="ghost"
                                size="bareIcon"
                                title={`Edit ${c.name}`}
                                aria-label={`Edit ${c.name}`}
                                onClick={() => startCategoryEdit(c)}
                                className="size-7 border-0 bg-transparent p-0 text-text-muted shadow-none hover:bg-transparent hover:text-text-main"
                              >
                                <Edit2 size={15} />
                              </Button>
                              <Button
                                type="button"
                                variant="iconBareDanger"
                                size="bareIcon"
                                title={
                                  productCount
                                    ? 'Move or remove products before deleting this category'
                                    : `Delete ${c.name}`
                                }
                                aria-label={`Delete ${c.name}`}
                                disabled={productCount > 0}
                                onClick={() => setPendingCategoryDelete(c)}
                                className="size-7 border-0 bg-transparent p-0 shadow-none hover:bg-transparent"
                              >
                                <Trash2 size={15} />
                              </Button>
                            </div>
                          </>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </section>
        )}

        {/* ─────────────────────────────────────────────────────────────────── */}
        {/* TAB 5: CSV IMPORT                                                   */}
        {/* ─────────────────────────────────────────────────────────────────── */}
        {activeTab === 'import' && (
          <section className="overflow-hidden rounded-lg border border-border-subtle bg-card shadow-sm">
            <div className="border-b border-border-subtle px-4 py-6 sm:px-8">
              <div className="flex items-start gap-4">
                <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-brand-subtle text-brand ring-1 ring-inset ring-brand-border">
                  <FileSpreadsheet size={20} aria-hidden="true" />
                </div>
                <div>
                  <h2 className="mb-1 text-base font-bold tracking-tight text-text-main">
                    Import products from CSV
                  </h2>
                  <p className="m-0 text-sm leading-6 text-text-muted">
                    Add multiple products from a CSV export.
                  </p>
                </div>
              </div>
            </div>

            <div className="space-y-5 px-4 py-6 sm:px-8">
              <div className="flex flex-wrap items-center gap-2 text-xs text-text-muted">
                <span className="font-semibold text-text-secondary">
                  Required:
                </span>
                {['name', 'sku', 'price'].map((column) => (
                  <code
                    key={column}
                    className="rounded-md border border-border-subtle bg-muted-surface px-2 py-1 font-mono text-text-secondary"
                  >
                    {column}
                  </code>
                ))}
                <span className="ml-1">
                  Optional: barcode, stock, reorder level, category
                </span>
              </div>

              <div className="flex max-w-3xl flex-col items-center rounded-lg border-2 border-dashed border-border-default bg-muted-surface px-6 py-8 text-center">
                <FileSpreadsheet
                  size={36}
                  className="mb-3 text-brand"
                  strokeWidth={1.5}
                />
                <p className="m-0 text-sm font-bold text-text-main">
                  Choose a CSV file to upload
                </p>
                <p className="mt-1 text-xs text-text-muted">
                  Supports standard UTF-8 CSV exports
                </p>

                <div className="mt-4 flex flex-wrap justify-center gap-2">
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={downloadTemplate}
                  >
                    <Download size={15} />
                    Download template
                  </Button>
                  <label className="inline-flex h-9 cursor-pointer items-center justify-center gap-2 rounded-md border border-brand bg-brand px-3 text-[0.8rem] font-bold text-white shadow-sm transition hover:bg-brand-hover focus-within:ring-2 focus-within:ring-brand/10">
                    <Upload size={15} />
                    Choose CSV
                    <input
                      type="file"
                      accept=".csv,text/csv"
                      className="sr-only"
                      onChange={(e) => void chooseCsv(e.target.files?.[0])}
                    />
                  </label>
                </div>
              </div>

              {csvText && (
                <div className="flex flex-wrap items-center gap-3 rounded-lg border border-brand-border bg-brand-subtle px-4 py-3">
                  <div className="flex items-center gap-2 text-sm font-semibold text-text-secondary">
                    <CheckCircle2 size={17} className="text-brand" />
                    CSV file loaded and ready to validate.
                  </div>
                  <div className="ml-auto flex flex-wrap gap-2">
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      onClick={() => void previewCsv()}
                    >
                      Preview CSV
                    </Button>
                    {importPreview?.valid && (
                      <Button
                        type="button"
                        size="sm"
                        onClick={() => void importCsv()}
                      >
                        Import {importPreview.totalRows} Products
                      </Button>
                    )}
                  </div>
                </div>
              )}

              {importPreview && (
                <div className="max-w-3xl overflow-hidden rounded-lg border border-border-subtle">
                  {importPreview.errors.length > 0 ? (
                    <div className="border-b border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                      <p className="mb-1.5 font-bold">Validation errors</p>
                      <ul className="list-disc space-y-0.5 pl-4">
                        {importPreview.errors.map((err) => (
                          <li key={`${err.row}-${err.message}`}>
                            Row {err.row}: {err.message}
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : (
                    <div className="border-b border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700">
                      CSV file is valid and ready to import.
                    </div>
                  )}

                  {importPreview.preview.length > 0 && (
                    <div className="overflow-x-auto">
                      <table className="w-full min-w-[520px] border-collapse text-left text-sm">
                        <thead className="border-b border-border-subtle bg-muted-surface text-xs font-bold uppercase tracking-wide text-text-secondary">
                          <tr>
                            <th className="px-4 py-3">Name</th>
                            <th className="px-4 py-3">SKU</th>
                            <th className="px-4 py-3">Price</th>
                            <th className="px-4 py-3">Stock</th>
                          </tr>
                        </thead>
                        <tbody>
                          {importPreview.preview.map((p) => (
                            <tr
                              key={p.sku}
                              className="border-b border-border-subtle last:border-b-0"
                            >
                              <td className="px-4 py-3 font-semibold text-text-main">
                                {p.name}
                              </td>
                              <td className="px-4 py-3 font-mono text-text-muted">
                                {p.sku}
                              </td>
                              <td className="px-4 py-3 font-semibold text-brand">
                                ${((p.price ?? 0) / 100).toFixed(2)}
                              </td>
                              <td className="px-4 py-3 text-text-muted">
                                {p.openingStock ?? 0}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}
            </div>
          </section>
        )}

        {pendingCategoryDelete && (
          <Modal
            title="Delete category?"
            description="Only empty categories can be deleted."
            icon={<Trash2 size={20} />}
            size="sm"
            density="compact"
            onClose={() =>
              !deletingCategory && setPendingCategoryDelete(null)
            }
            footer={
              <>
                <Button
                  variant="secondary"
                  size="sm"
                  disabled={deletingCategory}
                  onClick={() => setPendingCategoryDelete(null)}
                >
                  Cancel
                </Button>
                <Button
                  variant="danger"
                  size="sm"
                  disabled={deletingCategory}
                  onClick={() => void deleteCategory(pendingCategoryDelete)}
                >
                  <Trash2 size={14} />
                  {deletingCategory ? 'Deleting…' : 'Delete category'}
                </Button>
              </>
            }
          >
            <p className="text-sm leading-5 text-text-muted">
              Permanently delete{' '}
              <strong className="font-semibold text-text-main">
                {pendingCategoryDelete.name}
              </strong>
              ?
            </p>
          </Modal>
        )}

        {pendingDelete && (
          <Modal
            title="Delete product"
            description="This action is permanent."
            icon={<Trash2 size={20} />}
            size="sm"
            density="compact"
            onClose={() => !deletingProduct && setPendingDelete(null)}
            footer={
              <>
                <Button
                  variant="secondary"
                  size="sm"
                  disabled={deletingProduct}
                  onClick={() => setPendingDelete(null)}
                  className="max-sm:w-full"
                >
                  Cancel
                </Button>
                <Button
                  variant="dangerSubtle"
                  size="sm"
                  disabled={deletingProduct}
                  onClick={() => void deleteProduct(pendingDelete)}
                  className="max-sm:w-full"
                >
                  <Trash2 size={14} />
                  {deletingProduct ? 'Deleting…' : 'Delete product'}
                </Button>
              </>
            }
          >
            <div className="grid gap-4">
              <p className="text-sm leading-5 text-text-muted">
                Are you sure you want to permanently delete{' '}
                <strong className="font-semibold text-text-main">
                  {pendingDelete.name}
                </strong>
                ?
              </p>
              <div className="flex items-start gap-2.5 rounded-lg border border-amber-200 bg-amber-50 px-3.5 py-3 text-sm leading-5 text-amber-800">
                <AlertCircle size={17} className="mt-0.5 shrink-0" />
                <p>
                  This is only allowed when the product has no sales or stock
                  history.
                </p>
              </div>
            </div>
          </Modal>
        )}

        {pendingVariantValueDelete && (
          <Modal
            title={`Delete ${pendingVariantValueDelete.optionName} value?`}
            description="This cannot be undone."
            icon={<Trash2 size={20} />}
            size="sm"
            density="compact"
            onClose={() =>
              !deletingVariantValue && setPendingVariantValueDelete(null)
            }
            footer={
              <>
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  disabled={deletingVariantValue}
                  onClick={() => setPendingVariantValueDelete(null)}
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  variant="danger"
                  size="sm"
                  disabled={deletingVariantValue}
                  onClick={() => void deleteVariantValue()}
                >
                  <Trash2 size={15} />{' '}
                  {deletingVariantValue ? 'Deleting…' : 'Delete value'}
                </Button>
              </>
            }
          >
            <div className="grid gap-4">
              <p className="text-sm leading-5 text-text-muted">
                Delete{' '}
                <strong className="font-semibold text-text-main">
                  {pendingVariantValueDelete.name}
                </strong>{' '}
                and every variant that uses it.
              </p>
              <div className="flex gap-2.5 rounded-lg border border-amber-200 bg-amber-50 px-3.5 py-3 text-xs leading-5 text-amber-800">
                <AlertCircle size={17} className="mt-0.5 shrink-0" />
                <span>
                  Values used by sales or stock history cannot be deleted.
                </span>
              </div>
            </div>
          </Modal>
        )}

        {stockAdjustmentVariant && (
          <Modal
            title="Adjust stock"
            description={`${stockAdjustmentVariant.name} · Current stock: ${stockAdjustmentVariant.stock}`}
            icon={<Sliders size={20} />}
            size="sm"
            density="compact"
            onClose={() =>
              !savingStockAdjustment && setStockAdjustmentVariant(null)
            }
            footer={
              <>
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  disabled={savingStockAdjustment}
                  onClick={() => setStockAdjustmentVariant(null)}
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  size="sm"
                  disabled={savingStockAdjustment}
                  onClick={() => void saveStockAdjustment()}
                >
                  {savingStockAdjustment ? 'Saving…' : 'Save adjustment'}
                </Button>
              </>
            }
          >
            <div className="grid gap-4">
                <FormField label="Quantity change">
                  <div className="flex h-10 overflow-hidden rounded-md border border-border-default bg-card shadow-2xs">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-full w-10 shrink-0 rounded-none border-r border-border-default p-0"
                      title="Decrease quantity"
                      aria-label="Decrease quantity"
                      onClick={() => {
                        const current = parseInt(
                          stockAdjustmentQuantity || '0',
                          10,
                        );
                        const next = isNaN(current) ? -1 : current - 1;
                        setStockAdjustmentQuantity(next.toString());
                      }}
                    >
                      <Minus size={14} />
                    </Button>
                    <Input
                      autoFocus
                      type="text"
                      inputMode="text"
                      value={stockAdjustmentQuantity}
                      onKeyDown={(e) => {
                        if (
                          [
                            'Backspace',
                            'Delete',
                            'Tab',
                            'Escape',
                            'Enter',
                            'ArrowLeft',
                            'ArrowRight',
                          ].includes(e.key) ||
                          (e.key === '-' &&
                            e.currentTarget.selectionStart === 0 &&
                            !e.currentTarget.value.includes('-')) ||
                          /^[0-9]$/.test(e.key) ||
                          e.metaKey ||
                          e.ctrlKey
                        ) {
                          return;
                        }
                        e.preventDefault();
                      }}
                      onChange={(event) => {
                        const val = event.target.value;
                        if (val === '' || val === '-' || /^-?\d*$/.test(val)) {
                          setStockAdjustmentQuantity(val);
                        }
                      }}
                      placeholder="e.g. 10 or -2"
                      className="h-full min-w-0 rounded-none border-0 text-center font-mono shadow-none focus:ring-0"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-full w-10 shrink-0 rounded-none border-l border-border-default p-0"
                      title="Increase quantity"
                      aria-label="Increase quantity"
                      onClick={() => {
                        const current = parseInt(
                          stockAdjustmentQuantity || '0',
                          10,
                        );
                        const next = isNaN(current) ? 1 : current + 1;
                        setStockAdjustmentQuantity(next.toString());
                      }}
                    >
                      <Plus size={14} />
                    </Button>
                  </div>
                </FormField>
                <FormField label="Reason">
                  <CustomSelect
                    value={stockAdjustmentReason}
                    onChange={setStockAdjustmentReason}
                    options={[
                      { value: 'RECEIVED', label: 'Received stock' },
                      { value: 'OPENING_STOCK', label: 'Opening stock' },
                      { value: 'DAMAGED', label: 'Damaged' },
                      { value: 'EXPIRED', label: 'Expired' },
                      { value: 'CORRECTION', label: 'Correction' },
                    ]}
                    placeholder="Select reason"
                  />
                </FormField>
              <p className="text-xs leading-5 text-text-muted">
                This creates an inventory record for the active branch.
              </p>
            </div>
          </Modal>
        )}

        {pendingExistingVariantDelete && (
          <Modal
            title="Delete variant?"
            description="This action is permanent."
            icon={<Trash2 size={20} />}
            size="sm"
            density="compact"
            onClose={() =>
              !deletingExistingVariant &&
              setPendingExistingVariantDelete(null)
            }
            footer={
              <>
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  disabled={deletingExistingVariant}
                  onClick={() => setPendingExistingVariantDelete(null)}
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  variant="danger"
                  size="sm"
                  disabled={deletingExistingVariant}
                  onClick={() => void deleteExistingVariant()}
                >
                  <Trash2 size={15} />
                  {deletingExistingVariant ? 'Deleting…' : 'Delete variant'}
                </Button>
              </>
            }
          >
            <div className="grid gap-4">
              <p className="text-sm leading-5 text-text-muted">
                Permanently delete{' '}
                <strong className="font-semibold text-text-main">
                  {pendingExistingVariantDelete.name}
                </strong>
                .
              </p>
              <p className="rounded-lg border border-amber-200 bg-amber-50 px-3.5 py-3 text-xs leading-5 text-amber-800">
                This removes its stock record. Variants with sales or stock
                history cannot be deleted.
              </p>
            </div>
          </Modal>
        )}
      </PageContainer>
    </main>
  );
}
