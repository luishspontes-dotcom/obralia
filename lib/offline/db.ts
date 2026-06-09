// Obralia — wrapper IndexedDB puro (sem libs externas).
// Fila offline do canteiro: RDOs e fotos aguardando sincronização.
// IMPORTANTE: a FILA vive aqui (IndexedDB). localStorage é só pro draft do form.

const DB_NAME = "obralia-offline";
const DB_VERSION = 1;

export const RDO_QUEUE = "rdo_queue" as const;
export const PHOTO_QUEUE = "photo_queue" as const;

export type StoreName = typeof RDO_QUEUE | typeof PHOTO_QUEUE;

/** Item da fila de RDOs: payload é o form serializado campo→valor (string). */
export type QueuedRdo = {
  id?: number; // autoIncrement
  payload: Record<string, string>;
  queuedAt: string; // ISO
};

/** Item da fila de fotos (reservado pra evolução — mesma infra). */
export type QueuedPhoto = {
  id?: number; // autoIncrement
  siteId: string;
  rdoId: string | null;
  fileName: string;
  fileType: string;
  blob: Blob;
  queuedAt: string; // ISO
};

function isBrowser(): boolean {
  return typeof window !== "undefined" && typeof indexedDB !== "undefined";
}

let dbPromise: Promise<IDBDatabase> | null = null;

/** Abre (e migra se preciso) o banco offline da Obralia. Singleton por aba. */
export function openObraliaDB(): Promise<IDBDatabase> {
  if (!isBrowser()) {
    return Promise.reject(new Error("IndexedDB indisponível fora do navegador"));
  }
  if (dbPromise) return dbPromise;

  dbPromise = new Promise<IDBDatabase>((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);

    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(RDO_QUEUE)) {
        db.createObjectStore(RDO_QUEUE, { keyPath: "id", autoIncrement: true });
      }
      if (!db.objectStoreNames.contains(PHOTO_QUEUE)) {
        db.createObjectStore(PHOTO_QUEUE, { keyPath: "id", autoIncrement: true });
      }
    };

    req.onsuccess = () => {
      const db = req.result;
      // Se outra aba pedir upgrade, fecha pra não travar.
      db.onversionchange = () => {
        db.close();
        dbPromise = null;
      };
      resolve(db);
    };

    req.onerror = () => {
      dbPromise = null;
      reject(req.error ?? new Error("Falha ao abrir IndexedDB"));
    };
  });

  return dbPromise;
}

function requestToPromise<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error("Erro no IndexedDB"));
  });
}

/** Adiciona um registro e retorna a chave (id autoIncrement). */
export async function dbAdd<T>(store: StoreName, value: T): Promise<number> {
  const db = await openObraliaDB();
  const tx = db.transaction(store, "readwrite");
  const key = await requestToPromise(tx.objectStore(store).add(value));
  return key as number;
}

/** Lista todos os registros do store (com id preenchido). */
export async function dbGetAll<T>(store: StoreName): Promise<(T & { id: number })[]> {
  const db = await openObraliaDB();
  const tx = db.transaction(store, "readonly");
  const all = await requestToPromise(tx.objectStore(store).getAll());
  return all as (T & { id: number })[];
}

/** Remove um registro pela chave. */
export async function dbDelete(store: StoreName, id: number): Promise<void> {
  const db = await openObraliaDB();
  const tx = db.transaction(store, "readwrite");
  await requestToPromise(tx.objectStore(store).delete(id));
}

/** Conta os registros do store. Retorna 0 fora do navegador (guard SSR). */
export async function dbCount(store: StoreName): Promise<number> {
  if (!isBrowser()) return 0;
  const db = await openObraliaDB();
  const tx = db.transaction(store, "readonly");
  return requestToPromise(tx.objectStore(store).count());
}
