"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { VISIBLE_SOURCE_PROVIDERS } from "@/lib/rdo-source-scope";
import { createServerSupabase } from "@/lib/supabase/server";

/* ───────── helpers ───────── */

async function requireUser() {
  const supabase = await createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  return { supabase, user };
}

function asString(v: FormDataEntryValue | null): string {
  return typeof v === "string" ? v.trim() : "";
}

function asNum(v: FormDataEntryValue | null): number | null {
  const s = asString(v);
  if (!s) return null;
  const n = Number(s.replace(",", "."));
  return isNaN(n) ? null : n;
}

type SupabaseClient = Awaited<ReturnType<typeof createServerSupabase>>;

/** Soma period_qty × unit_price dos itens com preço e grava em medicoes.total_value */
async function recalcMedicaoTotal(supabase: SupabaseClient, medicaoId: string): Promise<void> {
  const { data: itemsRaw } = await supabase
    .from("medicao_items")
    .select("period_qty, unit_price")
    .eq("medicao_id", medicaoId);
  const items = (itemsRaw ?? []) as Array<{ period_qty: number | null; unit_price: number | null }>;
  const total = items.reduce((sum, item) => {
    if (item.unit_price == null || item.period_qty == null) return sum;
    return sum + item.period_qty * item.unit_price;
  }, 0);
  await supabase
    .from("medicoes")
    .update({ total_value: Math.round(total * 100) / 100 } as never)
    .eq("id", medicaoId);
}

function revalidateMedicao(siteId: string, medicaoId?: string): void {
  revalidatePath(`/obras/${siteId}/medicoes`);
  if (medicaoId) revalidatePath(`/obras/${siteId}/medicoes/${medicaoId}`);
}

/* ───────── Medição CRUD ───────── */

export async function createMedicao(formData: FormData) {
  const { supabase, user } = await requireUser();

  const siteId = asString(formData.get("siteId"));
  const periodStart = asString(formData.get("period_start"));
  const periodEnd = asString(formData.get("period_end"));
  const notes = asString(formData.get("notes")) || null;
  if (!siteId || !periodStart || !periodEnd) {
    throw new Error("siteId, period_start e period_end são obrigatórios");
  }
  if (periodEnd < periodStart) throw new Error("Período inválido: fim antes do início");

  // organization_id vem da obra (respeitando o escopo de source provider do projeto)
  const { data: siteRaw } = await supabase
    .from("sites")
    .select("id, organization_id")
    .eq("id", siteId)
    .in("external_provider", VISIBLE_SOURCE_PROVIDERS)
    .maybeSingle();
  const site = siteRaw as { id: string; organization_id: string } | null;
  if (!site) throw new Error("Obra não encontrada");

  // número sequencial por obra
  const { data: maxR } = await supabase
    .from("medicoes")
    .select("number")
    .eq("site_id", siteId)
    .order("number", { ascending: false })
    .limit(1)
    .maybeSingle();
  const nextNumber = (((maxR as { number?: number } | null)?.number) ?? 0) + 1;

  const { data: inserted, error: insErr } = await supabase
    .from("medicoes")
    .insert({
      organization_id: site.organization_id,
      site_id: siteId,
      number: nextNumber,
      period_start: periodStart,
      period_end: periodEnd,
      status: "draft",
      notes,
      total_value: 0,
      created_by: user.id,
    } as never)
    .select("id")
    .single();
  if (insErr || !inserted) throw new Error(insErr?.message ?? "Falha ao criar medição");
  const medicaoId = (inserted as { id: string }).id;

  /* Pré-popula itens a partir das atividades dos RDOs APROVADOS do período:
     agrega por descrição, ficando com o MAIOR progress_pct registrado no período. */
  const { data: rdosRaw } = await supabase
    .from("daily_reports")
    .select("id")
    .eq("site_id", siteId)
    .eq("status", "approved")
    .in("external_provider", VISIBLE_SOURCE_PROVIDERS)
    .gte("date", periodStart)
    .lte("date", periodEnd);
  const rdoIds = ((rdosRaw ?? []) as Array<{ id: string }>).map((r) => r.id);

  if (rdoIds.length > 0) {
    const { data: actsRaw } = await supabase
      .from("report_activities")
      .select("description, progress_pct")
      .in("daily_report_id", rdoIds);
    const acts = (actsRaw ?? []) as Array<{ description: string | null; progress_pct: number | null }>;

    const agg = new Map<string, { description: string; period_qty: number | null }>();
    for (const act of acts) {
      const description = (act.description ?? "").trim();
      if (!description) continue;
      const key = description.toLowerCase();
      const prev = agg.get(key);
      if (!prev) {
        agg.set(key, { description, period_qty: act.progress_pct });
      } else if (act.progress_pct != null && (prev.period_qty == null || act.progress_pct > prev.period_qty)) {
        prev.period_qty = act.progress_pct;
      }
    }

    const rows = Array.from(agg.values()).map((entry) => ({
      medicao_id: medicaoId,
      description: entry.description,
      unit: "%",
      period_qty: entry.period_qty,
    }));
    if (rows.length > 0) {
      const { error: itemsErr } = await supabase.from("medicao_items").insert(rows as never);
      if (itemsErr) throw new Error(itemsErr.message);
    }
  }

  revalidateMedicao(siteId, medicaoId);
  redirect(`/obras/${siteId}/medicoes/${medicaoId}`);
}

export async function deleteMedicao(formData: FormData) {
  const { supabase } = await requireUser();
  const medicaoId = asString(formData.get("medicaoId"));
  const siteId = asString(formData.get("siteId"));
  if (!medicaoId || !siteId) throw new Error("medicaoId e siteId obrigatórios");

  const { data: medRaw } = await supabase
    .from("medicoes")
    .select("id, status")
    .eq("id", medicaoId)
    .maybeSingle();
  const med = medRaw as { id: string; status: string } | null;
  if (!med) throw new Error("Medição não encontrada");
  if (med.status !== "draft") throw new Error("Só é possível excluir medições em rascunho");

  await supabase.from("medicao_items").delete().eq("medicao_id", medicaoId);
  const { error } = await supabase.from("medicoes").delete().eq("id", medicaoId);
  if (error) throw new Error(error.message);

  revalidateMedicao(siteId);
  redirect(`/obras/${siteId}/medicoes`);
}

export async function setMedicaoStatus(formData: FormData) {
  const { supabase, user } = await requireUser();
  const medicaoId = asString(formData.get("medicaoId"));
  const siteId = asString(formData.get("siteId"));
  const status = asString(formData.get("status"));
  if (!medicaoId || !siteId || !["draft", "submitted", "approved"].includes(status)) {
    throw new Error("status inválido");
  }

  const patch: Record<string, unknown> = { status };
  if (status === "approved") {
    patch.approved_by = user.id;
    patch.approved_at = new Date().toISOString();
  } else {
    patch.approved_by = null;
    patch.approved_at = null;
  }
  const { error } = await supabase.from("medicoes").update(patch as never).eq("id", medicaoId);
  if (error) throw new Error(error.message);

  revalidateMedicao(siteId, medicaoId);
}

/* ───────── Itens da medição ───────── */

export async function addMedicaoItem(formData: FormData) {
  const { supabase } = await requireUser();
  const medicaoId = asString(formData.get("medicaoId"));
  const siteId = asString(formData.get("siteId"));
  const description = asString(formData.get("description"));
  if (!medicaoId || !siteId || !description) throw new Error("dados obrigatórios faltando");

  const { error } = await supabase.from("medicao_items").insert({
    medicao_id: medicaoId,
    description,
    unit: asString(formData.get("unit")) || null,
    contracted_qty: asNum(formData.get("contracted_qty")),
    previous_qty: asNum(formData.get("previous_qty")),
    period_qty: asNum(formData.get("period_qty")),
    unit_price: asNum(formData.get("unit_price")),
  } as never);
  if (error) throw new Error(error.message);

  await recalcMedicaoTotal(supabase, medicaoId);
  revalidateMedicao(siteId, medicaoId);
}

export async function updateMedicaoItem(formData: FormData) {
  const { supabase } = await requireUser();
  const id = asString(formData.get("id"));
  const medicaoId = asString(formData.get("medicaoId"));
  const siteId = asString(formData.get("siteId"));
  if (!id || !medicaoId || !siteId) throw new Error("dados obrigatórios faltando");
  const description = asString(formData.get("description"));

  const { error } = await supabase
    .from("medicao_items")
    .update({
      description: description || undefined,
      unit: asString(formData.get("unit")) || null,
      contracted_qty: asNum(formData.get("contracted_qty")),
      previous_qty: asNum(formData.get("previous_qty")),
      period_qty: asNum(formData.get("period_qty")),
      unit_price: asNum(formData.get("unit_price")),
    } as never)
    .eq("id", id);
  if (error) throw new Error(error.message);

  await recalcMedicaoTotal(supabase, medicaoId);
  revalidateMedicao(siteId, medicaoId);
}

export async function deleteMedicaoItem(formData: FormData) {
  const { supabase } = await requireUser();
  const id = asString(formData.get("id"));
  const medicaoId = asString(formData.get("medicaoId"));
  const siteId = asString(formData.get("siteId"));
  if (!id || !medicaoId || !siteId) throw new Error("dados obrigatórios faltando");

  const { error } = await supabase.from("medicao_items").delete().eq("id", id);
  if (error) throw new Error(error.message);

  await recalcMedicaoTotal(supabase, medicaoId);
  revalidateMedicao(siteId, medicaoId);
}

export async function recalcTotal(formData: FormData) {
  const { supabase } = await requireUser();
  const medicaoId = asString(formData.get("medicaoId"));
  const siteId = asString(formData.get("siteId"));
  if (!medicaoId || !siteId) throw new Error("medicaoId e siteId obrigatórios");
  await recalcMedicaoTotal(supabase, medicaoId);
  revalidateMedicao(siteId, medicaoId);
}
