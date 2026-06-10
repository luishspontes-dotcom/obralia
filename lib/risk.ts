"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createServerSupabase } from "@/lib/supabase/server";
import { VISIBLE_SOURCE_PROVIDERS, WBS_SOURCE_PROVIDERS } from "@/lib/rdo-source-scope";
import { canManageUsers, canWrite, getCurrentRole } from "@/lib/permissions";

/**
 * Previsão de risco de atraso por obra — estatística pura sobre os dados
 * históricos (RDOs, atividades, efetivo, clima, cronograma WBS).
 * Zero IA, zero custo externo. Score 0-100 explicável fator a fator.
 */

export type RiskFactor = { fator: string; peso: number; detalhe: string };

export type SiteRiskResult = {
  siteId: string;
  score: number | null;
  factors: RiskFactor[];
};

/* ───────── visão mínima tipada do client (colunas risk_* ainda não estão em database.types) ───────── */

type DbError = { message: string } | null;
type RowsResult<T> = { data: T[] | null; count: number | null; error: DbError };
type SingleResult<T> = { data: T | null; error: DbError };

type RiskQuery<T> = PromiseLike<RowsResult<T>> & {
  select(columns: string, options?: { count?: "exact"; head?: boolean }): RiskQuery<T>;
  update(values: Record<string, unknown>): RiskQuery<T>;
  eq(column: string, value: unknown): RiskQuery<T>;
  neq(column: string, value: unknown): RiskQuery<T>;
  in(column: string, values: readonly string[]): RiskQuery<T>;
  not(column: string, operator: string, value: unknown): RiskQuery<T>;
  gte(column: string, value: string): RiskQuery<T>;
  lt(column: string, value: string): RiskQuery<T>;
  order(column: string, options?: { ascending?: boolean; nullsFirst?: boolean }): RiskQuery<T>;
  limit(count: number): RiskQuery<T>;
  maybeSingle(): Promise<SingleResult<T>>;
};

type RiskDb = { from<T>(table: string): RiskQuery<T> };

async function requireRiskDb(): Promise<RiskDb> {
  const supabase = await createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  return supabase as unknown as RiskDb;
}

/* ───────── helpers ───────── */

const DAY_MS = 86_400_000;

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function shiftDays(base: Date, days: number): string {
  const d = new Date(base);
  d.setDate(d.getDate() + days);
  return isoDate(d);
}

function avg(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((acc, v) => acc + v, 0) / values.length;
}

async function countOf(q: RiskQuery<unknown>): Promise<number> {
  const { count, error } = await q;
  if (error) throw new Error(error.message);
  return count ?? 0;
}

async function rowsOf<T>(q: RiskQuery<T>): Promise<T[]> {
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return data ?? [];
}

const fmt1 = (n: number): string => (Math.round(n * 10) / 10).toLocaleString("pt-BR");

/* ───────── cálculo principal ───────── */

type SiteRow = { id: string; start_date: string | null; end_date: string | null; status: string };
type CondRow = { condition_morning: string | null; condition_afternoon: string | null };
type WfRow = { count: number | null };
type ProgRow = { progress_pct: number | null };
type DateRow = { date: string };

function isBadCondition(value: string | null): boolean {
  if (!value) return false;
  const v = value.toLowerCase();
  return v.startsWith("imprati") || v.includes("parcial");
}

async function computeRisk(db: RiskDb, siteId: string): Promise<SiteRiskResult> {
  const now = new Date();
  const today = isoDate(now);
  const d14 = shiftDays(now, -14);
  const d28 = shiftDays(now, -28);
  const d30 = shiftDays(now, -30);
  const d60 = shiftDays(now, -60);

  const { data: site, error: siteErr } = await db
    .from<SiteRow>("sites")
    .select("id, start_date, end_date, status")
    .eq("id", siteId)
    .in("external_provider", VISIBLE_SOURCE_PROVIDERS)
    .maybeSingle();
  if (siteErr) throw new Error(siteErr.message);
  if (!site) throw new Error("Obra não encontrada");

  // Tudo agregado no SQL (count/head) ou colunas únicas em janelas curtas — nunca a base inteira.
  const [
    totalRdos,
    lastRdoRows,
    rdos30,
    rdosPrev30,
    acts30,
    actsPrev30,
    condRows,
    wf14Rows,
    wfPrev14Rows,
    wbsProgRows,
    wbsTotal,
    wbsOverdue,
  ] = await Promise.all([
    countOf(db.from<never>("daily_reports").select("id", { count: "exact", head: true })
      .eq("site_id", siteId).in("external_provider", VISIBLE_SOURCE_PROVIDERS)),
    rowsOf(db.from<DateRow>("daily_reports").select("date")
      .eq("site_id", siteId).in("external_provider", VISIBLE_SOURCE_PROVIDERS)
      .order("date", { ascending: false }).limit(1)),
    countOf(db.from<never>("daily_reports").select("id", { count: "exact", head: true })
      .eq("site_id", siteId).in("external_provider", VISIBLE_SOURCE_PROVIDERS).gte("date", d30)),
    countOf(db.from<never>("daily_reports").select("id", { count: "exact", head: true })
      .eq("site_id", siteId).in("external_provider", VISIBLE_SOURCE_PROVIDERS).gte("date", d60).lt("date", d30)),
    countOf(db.from<never>("report_activities").select("id, daily_reports!inner(id)", { count: "exact", head: true })
      .eq("daily_reports.site_id", siteId).in("daily_reports.external_provider", VISIBLE_SOURCE_PROVIDERS)
      .gte("daily_reports.date", d30)),
    countOf(db.from<never>("report_activities").select("id, daily_reports!inner(id)", { count: "exact", head: true })
      .eq("daily_reports.site_id", siteId).in("daily_reports.external_provider", VISIBLE_SOURCE_PROVIDERS)
      .gte("daily_reports.date", d60).lt("daily_reports.date", d30)),
    rowsOf(db.from<CondRow>("daily_reports").select("condition_morning, condition_afternoon")
      .eq("site_id", siteId).in("external_provider", VISIBLE_SOURCE_PROVIDERS).gte("date", d30).limit(62)),
    rowsOf(db.from<WfRow>("report_workforce").select("count, daily_reports!inner(id)")
      .eq("daily_reports.site_id", siteId).in("daily_reports.external_provider", VISIBLE_SOURCE_PROVIDERS)
      .gte("daily_reports.date", d14).limit(1000)),
    rowsOf(db.from<WfRow>("report_workforce").select("count, daily_reports!inner(id)")
      .eq("daily_reports.site_id", siteId).in("daily_reports.external_provider", VISIBLE_SOURCE_PROVIDERS)
      .gte("daily_reports.date", d28).lt("daily_reports.date", d14).limit(1000)),
    rowsOf(db.from<ProgRow>("wbs_items").select("progress_pct")
      .eq("site_id", siteId).in("external_provider", WBS_SOURCE_PROVIDERS)
      .not("progress_pct", "is", null).limit(2000)),
    countOf(db.from<never>("wbs_items").select("id", { count: "exact", head: true })
      .eq("site_id", siteId).in("external_provider", WBS_SOURCE_PROVIDERS)),
    countOf(db.from<never>("wbs_items").select("id", { count: "exact", head: true })
      .eq("site_id", siteId).in("external_provider", WBS_SOURCE_PROVIDERS)
      .lt("due_date", today).neq("status", "done")),
  ]);

  /* Obra sem nenhum dado → não dá pra prever nada */
  if (totalRdos === 0 && wbsTotal === 0) {
    const factors: RiskFactor[] = [{
      fator: "Dados insuficientes",
      peso: 0,
      detalhe: "Obra sem RDOs e sem atividades cadastradas — dados insuficientes para calcular risco.",
    }];
    await persistRisk(db, siteId, null, factors);
    return { siteId, score: null, factors };
  }

  const factors: RiskFactor[] = [];

  /* 1. PRAZO — % do prazo decorrido vs % médio de progresso das atividades WBS */
  const startMs = site.start_date ? new Date(`${site.start_date}T00:00:00`).getTime() : NaN;
  const endMs = site.end_date ? new Date(`${site.end_date}T00:00:00`).getTime() : NaN;
  const progValues = wbsProgRows
    .map((r) => r.progress_pct)
    .filter((v): v is number => typeof v === "number");
  if (Number.isFinite(startMs) && Number.isFinite(endMs) && endMs > startMs && progValues.length > 0) {
    const elapsedPct = Math.min(100, Math.max(0, Math.round(((now.getTime() - startMs) / (endMs - startMs)) * 100)));
    const avgProg = Math.round(avg(progValues));
    const gap = elapsedPct - avgProg;
    const peso = gap > 25 ? 40 : gap > 10 ? 25 : 0;
    factors.push({
      fator: "Prazo vs progresso",
      peso,
      detalhe: `${elapsedPct}% do prazo decorrido vs ${avgProg}% de progresso médio das atividades (gap de ${gap} pts).`,
    });
  } else {
    factors.push({
      fator: "Prazo vs progresso",
      peso: 0,
      detalhe: "Dados insuficientes (sem datas de início/fim ou sem atividades com progresso).",
    });
  }

  /* 2. RITMO — média de atividades por RDO: últimos 30 dias vs 30 dias anteriores */
  if (rdos30 > 0 && rdosPrev30 > 0) {
    const cur = acts30 / rdos30;
    const prev = actsPrev30 / rdosPrev30;
    if (prev > 0) {
      const dropPct = ((prev - cur) / prev) * 100;
      const peso = dropPct > 30 ? 15 : 0;
      factors.push({
        fator: "Ritmo de atividades",
        peso,
        detalhe: peso > 0
          ? `Média caiu de ${fmt1(prev)} para ${fmt1(cur)} atividades/RDO (queda de ${Math.round(dropPct)}%).`
          : `Ritmo estável: ${fmt1(cur)} atividades/RDO nos últimos 30 dias vs ${fmt1(prev)} no período anterior.`,
      });
    } else {
      factors.push({ fator: "Ritmo de atividades", peso: 0, detalhe: "Dados insuficientes (sem atividades no período anterior)." });
    }
  } else {
    factors.push({ fator: "Ritmo de atividades", peso: 0, detalhe: "Dados insuficientes (sem RDOs em uma das janelas de 30 dias)." });
  }

  /* 3. CLIMA — % de períodos Impraticável/Parcial nos RDOs dos últimos 30 dias */
  const periods = condRows.flatMap((r) => [r.condition_morning, r.condition_afternoon]).filter((v): v is string => Boolean(v));
  if (periods.length > 0) {
    const bad = periods.filter(isBadCondition).length;
    const badPct = Math.round((bad / periods.length) * 100);
    const peso = badPct > 40 ? 20 : badPct > 20 ? 10 : 0;
    factors.push({
      fator: "Clima",
      peso,
      detalhe: `${badPct}% dos períodos com clima Impraticável/Parcial nos últimos 30 dias (${bad} de ${periods.length}).`,
    });
  } else {
    factors.push({ fator: "Clima", peso: 0, detalhe: "Dados insuficientes (sem registros de clima nos últimos 30 dias)." });
  }

  /* 4. EFETIVO — média de workforce.count: últimos 14 dias vs 14 dias anteriores */
  const wfCur = wf14Rows.map((r) => r.count).filter((v): v is number => typeof v === "number");
  const wfPrev = wfPrev14Rows.map((r) => r.count).filter((v): v is number => typeof v === "number");
  if (wfCur.length > 0 && wfPrev.length > 0) {
    const cur = avg(wfCur);
    const prev = avg(wfPrev);
    const dropPct = prev > 0 ? ((prev - cur) / prev) * 100 : 0;
    const peso = dropPct > 25 ? 15 : 0;
    factors.push({
      fator: "Efetivo",
      peso,
      detalhe: peso > 0
        ? `Efetivo médio caiu de ${fmt1(prev)} para ${fmt1(cur)} por registro (queda de ${Math.round(dropPct)}%).`
        : `Efetivo estável: média de ${fmt1(cur)} nos últimos 14 dias vs ${fmt1(prev)} no período anterior.`,
    });
  } else {
    factors.push({ fator: "Efetivo", peso: 0, detalhe: "Dados insuficientes (sem registros de efetivo em uma das janelas de 14 dias)." });
  }

  /* 5. SILÊNCIO — dias desde o último RDO */
  if (lastRdoRows.length > 0) {
    const lastMs = new Date(`${lastRdoRows[0].date}T00:00:00`).getTime();
    const days = Math.max(0, Math.floor((now.getTime() - lastMs) / DAY_MS));
    const peso = days > 14 ? 20 : days > 7 ? 10 : 0;
    factors.push({
      fator: "Silêncio",
      peso,
      detalhe: days === 0 ? "RDO registrado hoje." : `${days} ${days === 1 ? "dia" : "dias"} desde o último RDO.`,
    });
  } else {
    factors.push({ fator: "Silêncio", peso: 20, detalhe: "Nenhum RDO registrado até hoje." });
  }

  /* 6. TAREFAS VENCIDAS — % de wbs_items com due_date < hoje e status != done */
  if (wbsTotal > 0) {
    const overduePct = Math.round((wbsOverdue / wbsTotal) * 100);
    const peso = Math.min(20, Math.floor(overduePct / 10) * 5);
    factors.push({
      fator: "Tarefas vencidas",
      peso,
      detalhe: `${wbsOverdue} de ${wbsTotal} atividades com prazo vencido (${overduePct}%).`,
    });
  } else {
    factors.push({ fator: "Tarefas vencidas", peso: 0, detalhe: "Dados insuficientes (obra sem atividades cadastradas)." });
  }

  factors.sort((a, b) => b.peso - a.peso);
  const score = Math.min(100, factors.reduce((acc, f) => acc + f.peso, 0));

  await persistRisk(db, siteId, score, factors);
  return { siteId, score, factors };
}

async function persistRisk(db: RiskDb, siteId: string, score: number | null, factors: RiskFactor[]): Promise<void> {
  const { error } = await db.from<never>("sites").update({
    risk_score: score,
    risk_factors: factors,
    risk_computed_at: new Date().toISOString(),
  }).eq("id", siteId);
  if (error) throw new Error(error.message);
}

/* ───────── server actions ───────── */

/** Calcula e persiste o risco de uma obra. Requer papel com escrita (owner/admin/engineer). */
export async function computeSiteRisk(siteId: string): Promise<SiteRiskResult> {
  const role = await getCurrentRole();
  if (!canWrite(role)) throw new Error("Sem permissão para calcular risco.");
  const db = await requireRiskDb();
  return computeRisk(db, siteId);
}

/** Action de formulário: recalcula o risco de uma obra (botão na página da obra). */
export async function recomputeSiteRisk(formData: FormData): Promise<void> {
  const raw = formData.get("siteId");
  const siteId = typeof raw === "string" ? raw.trim() : "";
  if (!siteId) throw new Error("siteId obrigatório");
  await computeSiteRisk(siteId);
  revalidatePath(`/obras/${siteId}`);
  revalidatePath("/inicio");
}

/** Recalcula todas as obras ativas em sequência. Apenas administradores. */
export async function recomputeAllRisks(): Promise<void> {
  const role = await getCurrentRole();
  if (!canManageUsers(role)) throw new Error("Apenas administradores podem recalcular todas as obras.");
  const db = await requireRiskDb();

  const { data, error } = await db
    .from<{ id: string; status: string }>("sites")
    .select("id, status")
    .in("external_provider", VISIBLE_SOURCE_PROVIDERS)
    .limit(500);
  if (error) throw new Error(error.message);

  const active = (data ?? []).filter((s) => s.status !== "done" && s.status !== "completed");
  // Sequencial de propósito: não estoura pool de conexões nem timeouts do PostgREST.
  for (const site of active) {
    await computeRisk(db, site.id);
  }

  revalidatePath("/inicio");
  revalidatePath("/obras");
}
