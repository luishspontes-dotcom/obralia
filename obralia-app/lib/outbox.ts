import AsyncStorage from "@react-native-async-storage/async-storage";
import NetInfo from "@react-native-community/netinfo";
import * as FileSystem from "expo-file-system";
import { decode } from "base64-arraybuffer";
import { supabase } from "@/lib/supabase";
import type { PhotoDraft, RdoDraft } from "@/lib/types";

/* ─────────────────────────────────────────────────────────────
 * OUTBOX — fila offline-first do app de campo.
 *
 * Todo envio (RDO, foto) entra na fila ANTES de tentar a rede.
 * Se der certo, sai da fila; se falhar (sem sinal no canteiro),
 * fica guardado no AsyncStorage e o listener do NetInfo
 * reprocessa automaticamente quando a conexão voltar.
 * ───────────────────────────────────────────────────────────── */

const KEY = "obralia.outbox.v1";
const MAX_ATTEMPTS = 8;

export type OutboxItem =
  | { id: string; type: "rdo"; payload: RdoDraft; createdAt: string; attempts: number; lastError?: string }
  | { id: string; type: "photo"; payload: PhotoDraft; createdAt: string; attempts: number; lastError?: string };

type Listener = (pending: number) => void;
const listeners = new Set<Listener>();
let processing = false;

export function subscribeOutbox(fn: Listener): () => void {
  listeners.add(fn);
  void notify();
  return () => listeners.delete(fn);
}

async function notify() {
  const items = await readAll();
  for (const fn of listeners) fn(items.length);
}

async function readAll(): Promise<OutboxItem[]> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as OutboxItem[]) : [];
  } catch {
    return [];
  }
}

async function writeAll(items: OutboxItem[]) {
  await AsyncStorage.setItem(KEY, JSON.stringify(items));
  for (const fn of listeners) fn(items.length);
}

export async function enqueue(item: Omit<OutboxItem, "id" | "createdAt" | "attempts">): Promise<void> {
  const items = await readAll();
  items.push({
    ...item,
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    createdAt: new Date().toISOString(),
    attempts: 0,
  } as OutboxItem);
  await writeAll(items);
  void processOutbox();
}

export async function pendingCount(): Promise<number> {
  return (await readAll()).length;
}

/** Processa a fila em ordem; para no primeiro erro de rede. */
export async function processOutbox(): Promise<void> {
  if (processing) return;
  processing = true;
  try {
    let items = await readAll();
    while (items.length > 0) {
      const item = items[0];
      try {
        if (item.type === "rdo") await sendRdo(item.payload);
        else await sendPhoto(item.payload);
        items = items.slice(1);
        await writeAll(items);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        item.attempts += 1;
        item.lastError = message;
        // Erros de permissão/validação não se resolvem repetindo: descarta após MAX_ATTEMPTS.
        if (item.attempts >= MAX_ATTEMPTS) items = items.slice(1);
        await writeAll(items);
        break; // provavelmente sem rede — o NetInfo reprocessa depois
      }
    }
  } finally {
    processing = false;
  }
}

/** Liga o reprocessamento automático quando a conexão volta. */
export function startOutboxAutoSync(): () => void {
  const unsubscribe = NetInfo.addEventListener((state) => {
    if (state.isConnected) void processOutbox();
  });
  void processOutbox();
  return unsubscribe;
}

/* ───────────────────────────── envios ───────────────────────────── */

async function sendRdo(draft: RdoDraft): Promise<void> {
  // RPC SECURITY DEFINER do Obralia — mesma porta de entrada do web
  // (numera o RDO, valida permissão de escrita na obra via RLS helpers).
  const { data, error } = await supabase.rpc("create_daily_report", {
    target_site_id: draft.siteId,
    report_date: draft.reportDate,
    p_weather_morning: draft.weatherMorning || null,
    p_weather_afternoon: draft.weatherAfternoon || null,
    p_condition_morning: draft.conditionMorning || null,
    p_condition_afternoon: draft.conditionAfternoon || null,
    p_general_notes: draft.generalNotes || null,
  });
  if (error) throw new Error(`RDO: ${error.message}`);

  const reportId =
    typeof data === "string" ? data : (data as { id?: string } | null)?.id ?? null;
  if (!reportId) return; // RDO criado; sem id não há como anexar linhas

  const activities = draft.activities
    .filter((a) => a.description.trim())
    .map((a) => ({
      daily_report_id: reportId,
      description: a.description.trim(),
      progress_pct: a.progress_pct ? Number(a.progress_pct.replace(",", ".")) : null,
    }));
  if (activities.length > 0) {
    const { error: actErr } = await supabase.from("report_activities").insert(activities);
    if (actErr) throw new Error(`Atividades: ${actErr.message}`);
  }

  const workforce = draft.workforce
    .filter((w) => w.role.trim())
    .map((w) => ({
      daily_report_id: reportId,
      role: w.role.trim(),
      count: w.count ? Math.max(1, Math.round(Number(w.count))) : 1,
    }));
  if (workforce.length > 0) {
    const { error: wfErr } = await supabase.from("report_workforce").insert(workforce);
    if (wfErr) throw new Error(`Efetivo: ${wfErr.message}`);
  }

  const equipment = draft.equipment
    .filter((e) => e.name.trim())
    .map((e) => ({
      daily_report_id: reportId,
      name: e.name.trim(),
      hours: e.hours ? Number(e.hours.replace(",", ".")) : null,
    }));
  if (equipment.length > 0) {
    const { error: eqErr } = await supabase.from("report_equipment").insert(equipment);
    if (eqErr) throw new Error(`Equipamentos: ${eqErr.message}`);
  }
}

async function sendPhoto(draft: PhotoDraft): Promise<void> {
  const info = await FileSystem.getInfoAsync(draft.localUri);
  if (!info.exists) return; // arquivo local sumiu — nada a enviar

  const base64 = await FileSystem.readAsStringAsync(draft.localUri, {
    encoding: FileSystem.EncodingType.Base64,
  });
  const bytes = decode(base64);

  // Convenção de path do Obralia web: {site_id}/{uuid}.jpg no bucket `media`.
  const fileId = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  const storagePath = `${draft.siteId}/${fileId}.jpg`;

  const { error: upErr } = await supabase.storage
    .from("media")
    .upload(storagePath, bytes, { contentType: "image/jpeg", upsert: false });
  if (upErr) throw new Error(`Upload: ${upErr.message}`);

  const { data: userData } = await supabase.auth.getUser();
  const { error: dbErr } = await supabase.from("media").insert({
    site_id: draft.siteId,
    kind: "photo",
    storage_path: storagePath,
    caption: draft.caption,
    taken_at: draft.takenAt,
    taken_by: userData.user?.id ?? null,
    gps_lat: draft.gpsLat,
    gps_lng: draft.gpsLng,
    size_bytes: "size" in info && typeof info.size === "number" ? info.size : null,
  });
  if (dbErr) throw new Error(`Registro da foto: ${dbErr.message}`);
}
