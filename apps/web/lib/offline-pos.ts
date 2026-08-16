export type QueuedSale = {
  id: string;
  branchId: string;
  cashierId: string;
  queuedAt: string;
  payload: Record<string, unknown>;
};

type CachedCatalog<T> = { branchId: string; products: T; savedAt: string };

const DB_NAME = 'pos-offline';
const DB_VERSION = 1;

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onerror = () => reject(request.error);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains('catalogs'))
        db.createObjectStore('catalogs');
      if (!db.objectStoreNames.contains('queued-sales')) {
        db.createObjectStore('queued-sales', { keyPath: 'id' });
      }
    };
    request.onsuccess = () => resolve(request.result);
  });
}

async function transaction<T>(
  storeName: 'catalogs' | 'queued-sales',
  mode: IDBTransactionMode,
  action: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, mode);
    const request = action(tx.objectStore(storeName));
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
    tx.oncomplete = () => db.close();
    tx.onerror = () => reject(tx.error);
  });
}

export async function cacheCatalog<T>(branchId: string, products: T) {
  await transaction('catalogs', 'readwrite', (store) =>
    store.put(
      { branchId, products, savedAt: new Date().toISOString() },
      branchId,
    ),
  );
}

export async function loadCachedCatalog<T>(branchId: string) {
  return transaction<CachedCatalog<T> | undefined>(
    'catalogs',
    'readonly',
    (store) => store.get(branchId),
  );
}

export async function clearCachedCatalogs() {
  await transaction('catalogs', 'readwrite', (store) => store.clear());
}

export async function queueSale(sale: QueuedSale) {
  await transaction('queued-sales', 'readwrite', (store) => store.put(sale));
}

export async function queuedSalesFor(cashierId: string, branchId: string) {
  const all = await transaction<QueuedSale[]>(
    'queued-sales',
    'readonly',
    (store) => store.getAll(),
  );
  return all
    .filter(
      (sale) => sale.cashierId === cashierId && sale.branchId === branchId,
    )
    .sort((a, b) => a.queuedAt.localeCompare(b.queuedAt));
}

export async function removeQueuedSale(id: string) {
  await transaction('queued-sales', 'readwrite', (store) => store.delete(id));
}

export async function queuedSaleCount(cashierId: string, branchId: string) {
  return (await queuedSalesFor(cashierId, branchId)).length;
}
