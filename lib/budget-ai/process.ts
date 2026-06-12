/**
 * Processamento ASSÍNCRONO do Orçamento IA.
 *
 * A server action de criação só sobe arquivos e cria o ai_estimates com
 * status 'processing'; a leitura da planta pela Claude (1 a 3 minutos) roda
 * aqui, chamada pela rota POST /api/budget-ai/process (maxDuration 300).
 *
 * Status: 'processing' → 'review' (sucesso) | 'failed' (erro, com a mensagem
 * gravada em source_summary.processing_error e em review_notes).
 */

import {
  type BudgetTemplateItem,
  type EstimateInput,
  type GeneratedEstimate,
  generateEstimateFromEtapas,
  generateEstimateFromTemplate,
} from "@/lib/budget-ai/estimate-engine";
import { buildHistoricalPriceIndex } from "@/lib/budget-ai/historical-prices";
import { MAX_PLAN_TOTAL_BYTES, PLAN_LIMIT_MESSAGE } from "@/lib/budget-ai/limits";
import {
  analyzePlanFilesFromStorage,
  PlanFilesTooLargeError,
  type PlanAnalysis,
  type StorageDownloadClient,
} from "@/lib/budget-ai/plan-analysis";
import type { UntypedSupabase } from "@/lib/supabase/untyped";

export type EstimateRow = {
  id: string;
  organization_id: string;
  site_id: string | null;
  template_id: string | null;
  title: string;
  client_name: string | null;
  address: string | null;
  built_area_m2: number | null;
  pool_area_m2: number | null;
  terrain_area_m2: number | null;
  floors_count: number | null;
  has_basement: boolean;
  quality_standard: string;
  status: string;
  source_summary: unknown;
};

export type UploadedEstimateFile = {
  kind: "plan" | "proposal" | "spreadsheet" | "other";
  file_name: string;
  storage_bucket: string;
  storage_path: string;
  content_type: string | null;
  size_bytes: number;
};

export type ProcessEstimateResult =
  | { ok: true; alreadyRunning?: boolean }
  | { ok: false; message: string };

/** Janela em que uma execução em andamento bloqueia disparos duplicados. */
const PROCESSING_LOCK_MS = 6 * 60 * 1000;

export async function processAiEstimate(
  db: UntypedSupabase,
  storage: StorageDownloadClient,
  estimateId: string
): Promise<ProcessEstimateResult> {
  const estimate = await fetchEstimate(db, estimateId);
  if (!estimate) {
    return { ok: false, message: "Estudo nao encontrado." };
  }

  // Evita rodar duas análises ao mesmo tempo (ex.: duas abas abertas).
  const startedAt = extractProcessingStartedAt(estimate.source_summary);
  if (
    estimate.status === "processing" &&
    startedAt !== null &&
    Date.now() - startedAt < PROCESSING_LOCK_MS
  ) {
    return { ok: true, alreadyRunning: true };
  }

  const { data: filesRaw, error: filesError } = await db
    .from("ai_estimate_files")
    .select("kind, file_name, storage_bucket, storage_path, content_type, size_bytes")
    .eq("estimate_id", estimateId)
    .order("created_at", { ascending: true });
  if (filesError) {
    await markEstimateFailed(db, estimate, filesError.message);
    return { ok: false, message: filesError.message };
  }
  const files = (filesRaw ?? []) as UploadedEstimateFile[];

  // Recusa amigável ANTES de mandar pro Claude (limite ~80 páginas / 20MB).
  const planBytes = files
    .filter((file) => file.kind === "plan")
    .reduce((sum, file) => sum + (file.size_bytes || 0), 0);
  if (planBytes > MAX_PLAN_TOTAL_BYTES) {
    await markEstimateFailed(db, estimate, PLAN_LIMIT_MESSAGE);
    return { ok: false, message: PLAN_LIMIT_MESSAGE };
  }

  const { error: lockError } = await db
    .from("ai_estimates")
    .update({
      status: "processing",
      source_summary: mergeSummary(estimate.source_summary, {
        processing_started_at: new Date().toISOString(),
      }),
    })
    .eq("id", estimateId)
    .eq("organization_id", estimate.organization_id);
  if (lockError) {
    return { ok: false, message: lockError.message };
  }

  try {
    const templateId = estimate.template_id ?? (await resolveTemplateId(db));
    const planAnalysis = await analyzePlanFilesFromStorage(storage, files);
    await updateEstimateFromPlanAnalysis(db, estimate, planAnalysis);
    await regenerateEstimateRows(
      db,
      estimateId,
      estimate.organization_id,
      templateId,
      buildEstimateInput(estimate, files.map((file) => file.file_name), planAnalysis)
    );
    return { ok: true };
  } catch (error) {
    const message =
      error instanceof PlanFilesTooLargeError
        ? error.message
        : error instanceof Error
          ? error.message
          : "Falha desconhecida ao processar o estudo.";
    await markEstimateFailed(db, estimate, message);
    return { ok: false, message };
  }
}

export async function fetchEstimate(
  db: UntypedSupabase,
  estimateId: string
): Promise<EstimateRow | null> {
  const { data, error } = await db
    .from("ai_estimates")
    .select(
      "id, organization_id, site_id, template_id, title, client_name, address, built_area_m2, pool_area_m2, terrain_area_m2, floors_count, has_basement, quality_standard, status, source_summary"
    )
    .eq("id", estimateId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data as EstimateRow | null;
}

export async function resolveTemplateId(db: UntypedSupabase): Promise<string> {
  const { data, error } = await db
    .from("budget_templates")
    .select("id")
    .eq("is_default", true)
    .order("organization_id", { ascending: true, nullsFirst: true })
    .order("version", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(error.message);
  const id = (data as { id?: string } | null)?.id;
  if (!id) throw new Error("Nenhum template de orcamento IA cadastrado.");
  return id;
}

/** Mensagem de erro do último processamento, gravada em source_summary. */
export function extractProcessingError(sourceSummary: unknown): string | null {
  const summary = asRecord(sourceSummary);
  if (!summary) return null;
  const processingError = asRecord(summary.processing_error);
  if (!processingError) return null;
  return typeof processingError.message === "string" && processingError.message.trim()
    ? processingError.message.trim()
    : null;
}

function extractProcessingStartedAt(sourceSummary: unknown): number | null {
  const summary = asRecord(sourceSummary);
  if (!summary) return null;
  const raw = summary.processing_started_at;
  if (typeof raw !== "string") return null;
  const parsed = Date.parse(raw);
  return Number.isNaN(parsed) ? null : parsed;
}

async function markEstimateFailed(
  db: UntypedSupabase,
  estimate: EstimateRow,
  message: string
): Promise<void> {
  await db
    .from("ai_estimates")
    .update({
      status: "failed",
      review_notes: `Falha no processamento: ${message.slice(0, 500)}`,
      source_summary: mergeSummary(estimate.source_summary, {
        processing_error: {
          message: message.slice(0, 1000),
          at: new Date().toISOString(),
        },
      }),
    })
    .eq("id", estimate.id)
    .eq("organization_id", estimate.organization_id);
}

function mergeSummary(
  sourceSummary: unknown,
  patch: Record<string, unknown>
): Record<string, unknown> {
  return { ...(asRecord(sourceSummary) ?? {}), ...patch };
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function buildEstimateInput(
  estimate: EstimateRow,
  fileNames: string[],
  planAnalysis: PlanAnalysis | null
): EstimateInput {
  const genericTitle = new Set(["Estudo preliminar", "Novo estudo preliminar"]);
  return {
    title:
      genericTitle.has(estimate.title) && planAnalysis?.projectTitle
        ? planAnalysis.projectTitle
        : estimate.title,
    clientName: estimate.client_name ?? planAnalysis?.clientName ?? null,
    address: estimate.address ?? planAnalysis?.address ?? null,
    builtAreaM2: toNullableNumber(estimate.built_area_m2) ?? planAnalysis?.builtAreaM2 ?? null,
    poolAreaM2: toNullableNumber(estimate.pool_area_m2) ?? planAnalysis?.poolAreaM2 ?? null,
    terrainAreaM2: toNullableNumber(estimate.terrain_area_m2) ?? planAnalysis?.terrainAreaM2 ?? null,
    floorsCount: toNullableInteger(estimate.floors_count) ?? planAnalysis?.floorsCount ?? null,
    hasBasement: estimate.has_basement || planAnalysis?.hasBasement === true,
    qualityStandard: estimate.quality_standard || planAnalysis?.qualityStandard || "alto_padrao",
    fileNames,
    planAnalysis,
  };
}

async function updateEstimateFromPlanAnalysis(
  db: UntypedSupabase,
  estimate: EstimateRow,
  planAnalysis: PlanAnalysis | null
): Promise<void> {
  if (planAnalysis?.status !== "analyzed") return;

  const patch: Record<string, unknown> = {};
  const genericTitle = new Set(["Estudo preliminar", "Novo estudo preliminar"]);

  if (genericTitle.has(estimate.title) && planAnalysis.projectTitle) {
    patch.title = planAnalysis.projectTitle;
  }
  if (!estimate.client_name && planAnalysis.clientName) patch.client_name = planAnalysis.clientName;
  if (!estimate.address && planAnalysis.address) patch.address = planAnalysis.address;
  if (toNullableNumber(estimate.built_area_m2) === null && planAnalysis.builtAreaM2 !== null) {
    patch.built_area_m2 = planAnalysis.builtAreaM2;
  }
  if (toNullableNumber(estimate.pool_area_m2) === null && planAnalysis.poolAreaM2 !== null) {
    patch.pool_area_m2 = planAnalysis.poolAreaM2;
  }
  if (toNullableNumber(estimate.terrain_area_m2) === null && planAnalysis.terrainAreaM2 !== null) {
    patch.terrain_area_m2 = planAnalysis.terrainAreaM2;
  }
  if (toNullableInteger(estimate.floors_count) === null && planAnalysis.floorsCount !== null) {
    patch.floors_count = planAnalysis.floorsCount;
  }
  if (!estimate.has_basement && typeof planAnalysis.hasBasement === "boolean") {
    patch.has_basement = planAnalysis.hasBasement;
  }

  if (Object.keys(patch).length === 0) return;
  const { error } = await db
    .from("ai_estimates")
    .update(patch)
    .eq("id", estimate.id)
    .eq("organization_id", estimate.organization_id);
  if (error) throw new Error(error.message);
}

async function regenerateEstimateRows(
  db: UntypedSupabase,
  estimateId: string,
  organizationId: string,
  templateId: string,
  input: EstimateInput
): Promise<void> {
  const etapas = input.planAnalysis?.etapas ?? [];
  let generated: GeneratedEstimate;

  if (etapas.length > 0) {
    // Fluxo principal (Claude): etapas lidas da planta no formato historico,
    // precificadas pelo indice {etapa -> R$/m2 mediano} do historico real.
    const priceIndex = await buildHistoricalPriceIndex(db, organizationId);
    generated = generateEstimateFromEtapas(input, etapas, priceIndex);
  } else {
    // Fallback: template detalhado parametrico (fluxo anterior/OpenAI).
    const { data: templateItemsRaw, error: templateError } = await db
      .from("budget_template_items")
      .select(
        "id, code, group_name, description, unit, unit_cost, default_quantity, quantity_rule, confidence_baseline, needs_review_default, source_notes, sort_order"
      )
      .eq("template_id", templateId)
      .order("sort_order", { ascending: true });

    if (templateError) throw new Error(templateError.message);
    const templateItems = (templateItemsRaw ?? []) as BudgetTemplateItem[];
    if (templateItems.length === 0) {
      throw new Error("Template de orcamento sem itens cadastrados.");
    }

    generated = generateEstimateFromTemplate(input, templateItems);
  }

  await db.from("ai_extracted_facts").delete().eq("estimate_id", estimateId);
  await db.from("ai_estimate_items").delete().eq("estimate_id", estimateId);

  const { error: factsError } = await db.from("ai_extracted_facts").insert(
    generated.facts.map((fact) => ({
      estimate_id: estimateId,
      organization_id: organizationId,
      ...fact,
      metadata: fact.metadata ?? {},
    }))
  );
  if (factsError) throw new Error(factsError.message);

  const { error: itemsError } = await db.from("ai_estimate_items").insert(
    generated.items.map((item) => ({
      estimate_id: estimateId,
      organization_id: organizationId,
      ...item,
    }))
  );
  if (itemsError) throw new Error(itemsError.message);

  const { error: updateError } = await db
    .from("ai_estimates")
    .update({
      status: "review",
      subtotal: generated.subtotal,
      total: generated.total,
      confidence_score: generated.confidenceScore,
      memorial_text: generated.memorialText,
      source_summary: generated.sourceSummary,
    })
    .eq("id", estimateId);
  if (updateError) throw new Error(updateError.message);
}

function toNullableNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number(value.replace(/\./g, "").replace(",", "."));
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function toNullableInteger(value: unknown): number | null {
  const parsed = toNullableNumber(value);
  return parsed === null ? null : Math.round(parsed);
}
