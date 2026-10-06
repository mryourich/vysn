import type { CompanySummary, Data } from '../types';

/**
 * Datenstand auf dem Gerät (IndexedDB) für den Offline-Modus: der zuletzt bekannte
 * Stand je Nutzer und Firma (inkl. noch nicht übertragener Änderungen) sowie die
 * Firmenliste. Wird beim Abmelden gelöscht.
 */
const DB = 'vysn-one';
const SNAPSHOTS = 'snapshots';
const META = 'meta';

type Snapshot = { data: Data; savedAt: string };
export type CachedMeta = { companies: CompanySummary[]; activeCompanyId: string | null; email: string | null };

let opening: Promise<IDBDatabase> | null = null;
function open(): Promise<IDBDatabase> {
  if (opening) return opening;
  opening = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => {
      req.result.createObjectStore(SNAPSHOTS);
      req.result.createObjectStore(META);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => { opening = null; reject(req.error); };
  });
  return opening;
}

async function run<T>(store: string, mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest | void): Promise<T | undefined> {
  try {
    const db = await open();
    return await new Promise<T | undefined>((resolve, reject) => {
      const tx = db.transaction(store, mode);
      const req = fn(tx.objectStore(store));
      tx.oncomplete = () => resolve(req ? (req.result as T) : undefined);
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    });
  } catch {
    return undefined; // privater Modus, Speicher voll … – Offline-Kopie ist optional
  }
}

const snapKey = (userId: string, companyId: string) => `${userId}:${companyId}`;

export const saveSnapshot = (userId: string, companyId: string, data: Data) =>
  run<void>(SNAPSHOTS, 'readwrite', (s) => { s.put({ data, savedAt: new Date().toISOString() } satisfies Snapshot, snapKey(userId, companyId)); });

export const loadSnapshot = (userId: string, companyId: string) => run<Snapshot>(SNAPSHOTS, 'readonly', (s) => s.get(snapKey(userId, companyId)));

export const saveMeta = (userId: string, meta: CachedMeta) => run<void>(META, 'readwrite', (s) => { s.put(meta, userId); });

export const loadMeta = (userId: string) => run<CachedMeta>(META, 'readonly', (s) => s.get(userId));

export async function clearUserCache(userId: string) {
  await run<void>(META, 'readwrite', (s) => { s.delete(userId); });
  await run<void>(SNAPSHOTS, 'readwrite', (s) => { s.delete(IDBKeyRange.bound(`${userId}:`, `${userId}:￿`)); });
}
