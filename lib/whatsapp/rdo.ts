/**
 * Helpers de RDO usados pelo webhook do WhatsApp.
 * Tudo roda com o client ADMIN (service role) — o webhook não tem sessão.
 */

import { createAdminSupabase } from "@/lib/supabase/admin";
import { OBRALIA_SOURCE_PROVIDER, VISIBLE_SOURCE_PROVIDERS } from "@/lib/rdo-source-scope";
import type { RdoStructuredData } from "@/lib/whatsapp/structure";

export type AdminClient = ReturnType<typeof createAdminSupabase>;

/** Data (YYYY-MM-DD) e hora (HH:MM) atuais no fuso de Brasília. */
export function nowInBrazil(): { date: string; time: string } {
  const now = new Date();
  const date = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
  const time = new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Sao_Paulo",
    hour: "2-digit",
    minute: "2-digit",
  }).format(now);
  return { date, time };
}

export type TodayRdo = { id: string; number: number };

/**
 * Busca o RDO draft de hoje criado via bot (sync_metadata->>via = 'whatsapp')
 * para a obra — ou cria um novo (number = max+1).
 */
export async function getOrCreateTodayWhatsappRdo(
  admin: AdminClient,
  siteId: string,
  profileId: string | null
): Promise<TodayRdo> {
  const { date } = nowInBrazil();

  const { data: existingR } = await admin
    .from("daily_reports")
    .select("id, number")
    .eq("site_id", siteId)
    .eq("date", date)
    .eq("status", "draft")
    .filter("sync_metadata->>via", "eq", "whatsapp")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  const existing = existingR as TodayRdo | null;
  if (existing) return existing;

  const { data: maxR } = await admin
    .from("daily_reports")
    .select("number")
    .eq("site_id", siteId)
    .in("external_provider", VISIBLE_SOURCE_PROVIDERS)
    .order("number", { ascending: false })
    .limit(1)
    .maybeSingle();
  const nextNumber = (((maxR as { number?: number } | null)?.number) ?? 0) + 1;

  const { data: insertedR, error: insErr } = await admin
    .from("daily_reports")
    .insert({
      site_id: siteId,
      number: nextNumber,
      date,
      status: "draft",
      created_by: profileId,
      external_provider: OBRALIA_SOURCE_PROVIDER,
      sync_metadata: { via: "whatsapp" },
      work_break_minutes: 60,
    } as never)
    .select("id, number")
    .single();
  if (insErr || !insertedR) {
    throw new Error(insErr?.message ?? "Falha ao criar RDO do dia");
  }
  return insertedR as TodayRdo;
}

/** Concatena texto em general_notes com marcador "— via WhatsApp HH:MM". */
export async function appendToGeneralNotes(
  admin: AdminClient,
  rdoId: string,
  text: string
): Promise<void> {
  const { time } = nowInBrazil();
  const { data: rowR } = await admin
    .from("daily_reports")
    .select("general_notes")
    .eq("id", rdoId)
    .maybeSingle();
  const current = (rowR as { general_notes?: string | null } | null)?.general_notes ?? null;

  const entry = `${text.trim()} — via WhatsApp ${time}`;
  const next = current && current.trim() ? `${current.trim()}\n\n${entry}` : entry;

  const { error } = await admin
    .from("daily_reports")
    .update({ general_notes: next } as never)
    .eq("id", rdoId);
  if (error) throw new Error(error.message);
}

/**
 * Aplica dados estruturados pela IA no RDO do dia:
 * - insere atividades / mão de obra / materiais / equipamentos (insert direto, sem replace);
 * - atualiza clima/condição/horário apenas se ainda estiverem null;
 * - anexa general_notes estruturado (se houver) com marcador via WhatsApp.
 */
export async function applyStructuredToRdo(
  admin: AdminClient,
  rdoId: string,
  data: RdoStructuredData
): Promise<void> {
  if (data.activities.length > 0) {
    const rows = data.activities.map((a) => ({
      daily_report_id: rdoId,
      description: a.description,
      progress_pct: a.progress_pct,
    }));
    const { error } = await admin.from("report_activities").insert(rows as never);
    if (error) throw new Error(error.message);
  }

  if (data.workforce.length > 0) {
    const rows = data.workforce.map((w) => ({
      daily_report_id: rdoId,
      role: w.role,
      count: w.count,
    }));
    const { error } = await admin.from("report_workforce").insert(rows as never);
    if (error) throw new Error(error.message);
  }

  if (data.materials.length > 0) {
    const rows = data.materials.map((m) => ({
      daily_report_id: rdoId,
      name: m.name,
      quantity: m.quantity,
      unit: m.unit,
    }));
    const { error } = await admin.from("report_materials").insert(rows as never);
    if (error) throw new Error(error.message);
  }

  if (data.equipment.length > 0) {
    const rows = data.equipment.map((e) => ({
      daily_report_id: rdoId,
      name: e.name,
      hours: e.hours,
    }));
    const { error } = await admin.from("report_equipment").insert(rows as never);
    if (error) throw new Error(error.message);
  }

  /* Clima / condição / horário: só preenche o que ainda está vazio. */
  const { data: rdoR } = await admin
    .from("daily_reports")
    .select("weather_morning, weather_afternoon, condition_morning, condition_afternoon, work_start, work_end")
    .eq("id", rdoId)
    .maybeSingle();
  const rdo = rdoR as {
    weather_morning: string | null;
    weather_afternoon: string | null;
    condition_morning: string | null;
    condition_afternoon: string | null;
    work_start: string | null;
    work_end: string | null;
  } | null;

  const patch: Record<string, string> = {};
  if (rdo) {
    if (rdo.weather_morning === null && data.weather_morning) patch.weather_morning = data.weather_morning;
    if (rdo.weather_afternoon === null && data.weather_afternoon) patch.weather_afternoon = data.weather_afternoon;
    if (rdo.condition_morning === null && data.condition_morning) patch.condition_morning = data.condition_morning;
    if (rdo.condition_afternoon === null && data.condition_afternoon) patch.condition_afternoon = data.condition_afternoon;
    if (rdo.work_start === null && data.work_start) patch.work_start = data.work_start;
    if (rdo.work_end === null && data.work_end) patch.work_end = data.work_end;
  }
  if (Object.keys(patch).length > 0) {
    const { error } = await admin.from("daily_reports").update(patch as never).eq("id", rdoId);
    if (error) throw new Error(error.message);
  }

  if (data.general_notes) {
    await appendToGeneralNotes(admin, rdoId, data.general_notes);
  }
}
