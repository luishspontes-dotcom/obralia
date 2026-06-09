// Obralia — fila offline de RDOs (IndexedDB) + sincronização via server action.
// Usado apenas em client components (RdoForm, OfflineIndicator).

import { createOrUpdateRdo } from "@/lib/rdo-actions";
import { dbAdd, dbCount, dbDelete, dbGetAll, RDO_QUEUE, type QueuedRdo } from "@/lib/offline/db";

/** Evento disparado quando a fila muda (enqueue/sync) — o OfflineIndicator escuta. */
export const RDO_QUEUE_EVENT = "obralia:rdo-queue-changed";

function notifyQueueChanged(): void {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(RDO_QUEUE_EVENT));
  }
}

/**
 * Detecta erro de REDE (fetch falhou porque não tem conexão), distinto de
 * erro de aplicação (validação, auth). Cobre Chrome ("Failed to fetch"),
 * Firefox ("NetworkError...") e Safari ("Load failed").
 */
export function isNetworkError(err: unknown): boolean {
  if (typeof navigator !== "undefined" && navigator.onLine === false) return true;
  if (!(err instanceof Error)) return false;
  const msg = err.message.toLowerCase();
  return (
    err instanceof TypeError ||
    msg.includes("fetch failed") ||
    msg.includes("failed to fetch") ||
    msg.includes("networkerror") ||
    msg.includes("load failed") ||
    msg.includes("network request failed")
  );
}

/** redirect() dentro da server action vira NEXT_REDIRECT — isso é SUCESSO, não erro. */
export function isNextRedirectError(err: unknown): boolean {
  if (typeof err !== "object" || err === null) return false;
  const digest = (err as { digest?: unknown }).digest;
  return typeof digest === "string" && digest.startsWith("NEXT_REDIRECT");
}

/** Salva o RDO serializado (campos do form, incl. *_json) na fila do aparelho. */
export async function enqueueRdo(payload: Record<string, string>): Promise<number> {
  const item: QueuedRdo = { payload, queuedAt: new Date().toISOString() };
  const id = await dbAdd<QueuedRdo>(RDO_QUEUE, item);
  notifyQueueChanged();
  return id;
}

/** Lista os RDOs pendentes de sincronização. */
export function listPending(): Promise<(QueuedRdo & { id: number })[]> {
  return dbGetAll<QueuedRdo>(RDO_QUEUE);
}

/** Quantos RDOs estão na fila (0 fora do navegador). */
export function countPending(): Promise<number> {
  return dbCount(RDO_QUEUE);
}

/** Remove um item da fila (após sincronizar com sucesso). */
export async function removeFromQueue(id: number): Promise<void> {
  await dbDelete(RDO_QUEUE, id);
  notifyQueueChanged();
}

export type SyncResult = { synced: number; failed: number };

let syncing = false;

/**
 * Sincroniza a fila item a item chamando a server action createOrUpdateRdo.
 * - Sucesso → remove da fila.
 * - Erro de REDE → para na hora (mantém tudo que sobrou na fila pra próxima tentativa).
 * - Erro de aplicação → mantém o item na fila (não descarta dado do canteiro) e segue.
 */
export async function syncPendingRdos(): Promise<SyncResult> {
  if (typeof window === "undefined") return { synced: 0, failed: 0 };
  if (syncing) return { synced: 0, failed: 0 };
  syncing = true;

  let synced = 0;
  let failed = 0;

  try {
    const pending = await listPending();
    for (let i = 0; i < pending.length; i++) {
      const item = pending[i];
      const fd = new FormData();
      for (const [key, value] of Object.entries(item.payload)) {
        fd.set(key, value);
      }
      try {
        await createOrUpdateRdo(fd);
        await removeFromQueue(item.id);
        synced++;
      } catch (err: unknown) {
        if (isNextRedirectError(err)) {
          // redirect() da action = RDO criado com sucesso
          await removeFromQueue(item.id);
          synced++;
          continue;
        }
        if (isNetworkError(err)) {
          // sem rede: para aqui, todo o resto continua na fila
          failed += pending.length - i;
          break;
        }
        // erro de aplicação: mantém na fila e tenta os próximos
        failed++;
      }
    }
  } finally {
    syncing = false;
  }

  return { synced, failed };
}
