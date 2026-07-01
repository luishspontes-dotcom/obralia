"use server";

import { revalidatePath } from "next/cache";
import { createServerSupabase } from "@/lib/supabase/server";
import { untypedDb, type UntypedSupabase } from "@/lib/supabase/untyped";
import { buildHistoricalPriceIndex, normalizeEtapaName } from "@/lib/budget-ai/historical-prices";

type OrgCtx = { db: UntypedSupabase; orgId: string; userId: string };

async function resolveOrg(): Promise<OrgCtx | null> {
  const supabase = await createServerSupabase();
  const db = untypedDb(supabase);
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: profileRaw } = await db
    .from("profiles")
    .select("default_org_id")
    .eq("id", user.id)
    .maybeSingle();
  const profile = profileRaw as { default_org_id: string | null } | null;
  const { data: orgsRaw } = await db.from("organizations").select("id");
  const orgs = (orgsRaw ?? []) as Array<{ id: string }>;
  const orgId = orgs.find((o) => o.id === profile?.default_org_id)?.id ?? orgs[0]?.id ?? null;
  if (!orgId) return null;
  return { db, orgId, userId: user.id };
}

function parseNumber(value: FormDataEntryValue | null): number | null {
  if (value === null) return null;
  const n = Number(String(value).replace(/\./g, "").replace(",", "."));
  return Number.isFinite(n) && n >= 0 ? n : null;
}

/** Salva as taxas editadas manualmente (so grava as que mudaram). */
export async function saveRates(formData: FormData) {
  const ctx = await resolveOrg();
  if (!ctx) return;
  const { db, orgId, userId } = ctx;

  const ids = new Set<string>();
  for (const key of formData.keys()) {
    if (key.startsWith("rate_")) ids.add(key.slice(5));
  }

  for (const id of ids) {
    const next = parseNumber(formData.get(`rate_${id}`));
    const orig = parseNumber(formData.get(`orig_${id}`));
    if (next === null) continue;
    if (orig !== null && Math.abs(next - orig) < 1e-9) continue; // inalterada
    await db
      .from("budget_rates")
      .update({
        cost_per_m2: next,
        source: "manual",
        updated_by: userId,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .eq("organization_id", orgId);
  }

  revalidatePath("/orcamento-ia/taxas");
}

/**
 * Recalibra as taxas a partir do historico VIVO que tem R$ de verdade:
 * orcamentos IA aprovados (via buildHistoricalPriceIndex). Atualiza apenas
 * as etapas que tem amostra historica; nao inventa preco. Marca source
 * "recalibrado" e guarda quantas amostras sustentam cada mediana.
 */
export async function recalibrateRates() {
  const ctx = await resolveOrg();
  if (!ctx) return;
  const { db, orgId, userId } = ctx;

  const index = await buildHistoricalPriceIndex(db, orgId);
  const { data: ratesRaw } = await db
    .from("budget_rates")
    .select("id, etapa_nome")
    .eq("organization_id", orgId);
  const rates = (ratesRaw ?? []) as Array<{ id: string; etapa_nome: string }>;

  for (const rate of rates) {
    const key = normalizeEtapaName(rate.etapa_nome);
    const cost = index.costPerM2ByEtapa.get(key);
    const samples = index.sampleCountByEtapa.get(key) ?? 0;
    // So recalibra com base historica real (>=1 amostra vinda de orcamento aprovado/template).
    if (typeof cost !== "number" || !Number.isFinite(cost) || cost <= 0 || samples < 1) continue;
    await db
      .from("budget_rates")
      .update({
        cost_per_m2: Math.round((cost + Number.EPSILON) * 100) / 100,
        source: "recalibrado",
        sample_count: samples,
        updated_by: userId,
        updated_at: new Date().toISOString(),
      })
      .eq("id", rate.id)
      .eq("organization_id", orgId);
  }

  revalidatePath("/orcamento-ia/taxas");
}

/**
 * Lanca o custo REAL de uma obra concluida (o mecanismo da "Planilha1"),
 * como uma nova amostra que desloca a mediana da etapa. O usuario informa
 * a area e o R$/m2 real observado; guardamos como origem "custo_real_obra"
 * fazendo media ponderada simples com as amostras ja existentes.
 */
export async function addRealCostObservation(formData: FormData) {
  const ctx = await resolveOrg();
  if (!ctx) return;
  const { db, orgId, userId } = ctx;

  const rateId = String(formData.get("rate_id") ?? "");
  const observed = parseNumber(formData.get("observed_r_m2"));
  if (!rateId || observed === null || observed <= 0) return;

  const { data: currentRaw } = await db
    .from("budget_rates")
    .select("cost_per_m2, sample_count")
    .eq("id", rateId)
    .eq("organization_id", orgId)
    .maybeSingle();
  const current = currentRaw as { cost_per_m2: number; sample_count: number } | null;
  if (!current) return;

  const n = Math.max(1, Number(current.sample_count) || 1);
  const blended = (Number(current.cost_per_m2) * n + observed) / (n + 1);

  await db
    .from("budget_rates")
    .update({
      cost_per_m2: Math.round((blended + Number.EPSILON) * 100) / 100,
      sample_count: n + 1,
      source: "custo_real_obra",
      updated_by: userId,
      updated_at: new Date().toISOString(),
    })
    .eq("id", rateId)
    .eq("organization_id", orgId);

  revalidatePath("/orcamento-ia/taxas");
}
