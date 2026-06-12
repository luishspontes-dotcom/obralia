"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createServerSupabase } from "@/lib/supabase/server";
import { type EstimateInput } from "@/lib/budget-ai/estimate-engine";
import { callClaudeWithDocuments, isClaudeConfigured } from "@/lib/budget-ai/claude";
import { MAX_PLAN_TOTAL_BYTES, PLAN_LIMIT_MESSAGE } from "@/lib/budget-ai/limits";
import {
  type EstimateRow,
  type UploadedEstimateFile,
  fetchEstimate,
  resolveTemplateId,
} from "@/lib/budget-ai/process";
import { type UntypedSupabase, untypedDb } from "@/lib/supabase/untyped";

type Profile = {
  id: string;
  default_org_id: string | null;
};

type Organization = {
  id: string;
  name: string;
};

type MemorialItemRow = {
  code: string | null;
  group_name: string;
  description: string;
  quantity: unknown;
  unit: string;
  needs_review: boolean;
  sort_order: number;
  metadata: Record<string, unknown> | null;
};

type StoredPlanAnalysisSummary = {
  summary?: unknown;
  resumoObra?: unknown;
  areaTotalM2?: unknown;
  builtAreaM2?: unknown;
};

async function requireContext() {
  const supabase = await createServerSupabase();
  const db = untypedDb(supabase);
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profileRaw } = await db
    .from("profiles")
    .select("id, default_org_id")
    .eq("id", user.id)
    .maybeSingle();
  const profile = profileRaw as Profile | null;

  const { data: orgsRaw } = await db
    .from("organizations")
    .select("id, name")
    .order("created_at", { ascending: true });
  const orgs = (orgsRaw ?? []) as Organization[];
  const activeOrg = orgs.find((org) => org.id === profile?.default_org_id) ?? orgs[0] ?? null;
  if (!activeOrg) throw new Error("Nenhuma organizacao ativa encontrada.");

  return { supabase, db, user, activeOrg };
}

export async function prepareAiEstimate(formData: FormData) {
  const { db, user, activeOrg } = await requireContext();
  const templateId = await resolveTemplateId(db);

  const input: EstimateInput = {
    title: asString(formData.get("title")) || "Estudo preliminar",
    clientName: asNullableString(formData.get("client_name")),
    address: asNullableString(formData.get("address")),
    builtAreaM2: asNumber(formData.get("built_area_m2")),
    poolAreaM2: asNumber(formData.get("pool_area_m2")),
    terrainAreaM2: asNumber(formData.get("terrain_area_m2")),
    floorsCount: asInteger(formData.get("floors_count")),
    hasBasement: formData.get("has_basement") === "on",
    qualityStandard: asString(formData.get("quality_standard")) || "alto_padrao",
    fileNames: [],
  };
  const siteId = asNullableString(formData.get("site_id"));

  const { data: inserted, error: insertError } = await db
    .from("ai_estimates")
    .insert({
      organization_id: activeOrg.id,
      site_id: siteId,
      template_id: templateId,
      title: input.title,
      client_name: input.clientName,
      address: input.address,
      built_area_m2: input.builtAreaM2,
      pool_area_m2: input.poolAreaM2,
      terrain_area_m2: input.terrainAreaM2,
      floors_count: input.floorsCount,
      has_basement: input.hasBasement,
      quality_standard: input.qualityStandard,
      status: "processing",
      created_by: user.id,
    })
    .select("id")
    .single();

  if (insertError || !inserted) {
    throw new Error(insertError?.message ?? "Nao foi possivel criar o estudo.");
  }

  const estimateId = (inserted as { id: string }).id;
  return { estimateId, organizationId: activeOrg.id };
}

/**
 * Finalização RÁPIDA do upload: registra os arquivos enviados direto pro
 * Storage e mantém o estudo em 'processing'. A análise da planta pela Claude
 * (1 a 3 minutos) roda de forma ASSÍNCRONA via POST /api/budget-ai/process,
 * disparada pelo client component do detalhe do estudo — assim a action
 * responde em segundos e o 504 da Vercel não acontece mais.
 */
export async function finalizeAiEstimateUpload(formData: FormData) {
  const { db, user, activeOrg } = await requireContext();
  const estimateId = asString(formData.get("estimate_id"));
  if (!estimateId) throw new Error("estimate_id obrigatorio.");

  const estimate = await fetchEstimate(db, estimateId);
  if (!estimate || estimate.organization_id !== activeOrg.id) {
    throw new Error("Estudo nao encontrado.");
  }

  const files = parseUploadedFiles(formData.get("files_json"), activeOrg.id, estimateId);

  // Recusa amigável antes de qualquer leitura por IA (limite ~80 páginas / 20MB).
  const planBytes = files
    .filter((file) => file.kind === "plan")
    .reduce((sum, file) => sum + (file.size_bytes || 0), 0);
  if (planBytes > MAX_PLAN_TOTAL_BYTES) {
    throw new Error(PLAN_LIMIT_MESSAGE);
  }

  if (files.length > 0) {
    const { error: filesError } = await db.from("ai_estimate_files").insert(
      files.map((file) => ({
        estimate_id: estimateId,
        organization_id: activeOrg.id,
        ...file,
        uploaded_by: user.id,
      }))
    );
    if (filesError) throw new Error(filesError.message);
  }

  revalidatePath("/orcamento-ia");
  revalidatePath(`/orcamento-ia/${estimateId}`);
  if (estimate.site_id) {
    revalidatePath(`/obras/${estimate.site_id}/orcamento-ia`);
    revalidatePath(`/obras/${estimate.site_id}/orcamento-ia/${estimateId}`);
  }
  return { estimateId };
}

export async function failAiEstimate(formData: FormData) {
  const { db, activeOrg } = await requireContext();
  const estimateId = asString(formData.get("estimate_id"));
  const message = asNullableString(formData.get("message"));
  if (!estimateId) return;

  const estimate = await fetchEstimate(db, estimateId);
  if (!estimate || estimate.organization_id !== activeOrg.id) {
    throw new Error("Estudo nao encontrado.");
  }

  await db
    .from("ai_estimates")
    .update({
      status: "failed",
      review_notes: message
        ? `Falha no upload/processamento: ${message.slice(0, 500)}`
        : "Falha no upload/processamento.",
    })
    .eq("id", estimateId)
    .eq("organization_id", activeOrg.id);

  revalidatePath("/orcamento-ia");
  revalidatePath(`/orcamento-ia/${estimateId}`);
  if (estimate.site_id) {
    revalidatePath(`/obras/${estimate.site_id}/orcamento-ia`);
    revalidatePath(`/obras/${estimate.site_id}/orcamento-ia/${estimateId}`);
  }
}

/**
 * Reprocessar agora é RÁPIDO: só rearma o estudo em 'processing'.
 * O client component do detalhe detecta a transição e dispara a análise
 * assíncrona via POST /api/budget-ai/process (maxDuration 300).
 */
export async function reprocessAiEstimate(formData: FormData) {
  const { db, activeOrg } = await requireContext();
  const estimateId = asString(formData.get("estimate_id"));
  if (!estimateId) throw new Error("estimate_id obrigatorio.");

  const estimate = await fetchEstimate(db, estimateId);
  if (!estimate || estimate.organization_id !== activeOrg.id) {
    throw new Error("Estudo nao encontrado.");
  }

  const sourceSummary =
    estimate.source_summary &&
    typeof estimate.source_summary === "object" &&
    !Array.isArray(estimate.source_summary)
      ? { ...(estimate.source_summary as Record<string, unknown>) }
      : {};
  delete sourceSummary.processing_error;
  delete sourceSummary.processing_started_at;

  await db
    .from("ai_estimates")
    .update({ status: "processing", review_notes: null, source_summary: sourceSummary })
    .eq("id", estimateId)
    .eq("organization_id", activeOrg.id);

  revalidatePath(`/orcamento-ia/${estimateId}`);
  if (estimate.site_id) {
    revalidatePath(`/obras/${estimate.site_id}/orcamento-ia`);
    revalidatePath(`/obras/${estimate.site_id}/orcamento-ia/${estimateId}`);
  }
}

export async function approveAiEstimate(formData: FormData) {
  const { db, activeOrg } = await requireContext();
  const estimateId = asString(formData.get("estimate_id"));
  if (!estimateId) throw new Error("estimate_id obrigatorio.");

  const estimate = await fetchEstimate(db, estimateId);
  if (!estimate || estimate.organization_id !== activeOrg.id) {
    throw new Error("Estudo nao encontrado.");
  }

  await db
    .from("ai_estimate_items")
    .update({
      confidence: 1,
      needs_review: false,
    })
    .eq("estimate_id", estimateId)
    .eq("organization_id", activeOrg.id);

  const { error } = await db
    .from("ai_estimates")
    .update({
      status: "approved",
      confidence_score: 1,
      review_notes: "Orcamento validado manualmente.",
    })
    .eq("id", estimateId)
    .eq("organization_id", activeOrg.id);
  if (error) throw new Error(error.message);

  revalidatePath("/orcamento-ia");
  revalidatePath(`/orcamento-ia/${estimateId}`);
  if (estimate.site_id) {
    revalidatePath(`/obras/${estimate.site_id}/orcamento-ia`);
    revalidatePath(`/obras/${estimate.site_id}/orcamento-ia/${estimateId}`);
  }
}

export async function saveEstimateMemorial(formData: FormData) {
  const { db, activeOrg } = await requireContext();
  const estimateId = asString(formData.get("estimate_id"));
  const memorialText = asString(formData.get("memorial_text"));
  if (!estimateId) throw new Error("estimate_id obrigatorio.");

  const estimate = await fetchEstimate(db, estimateId);
  if (!estimate || estimate.organization_id !== activeOrg.id) {
    throw new Error("Estudo nao encontrado.");
  }

  const { error } = await db
    .from("ai_estimates")
    .update({
      memorial_text: memorialText || null,
      status: "review",
      review_notes: "Memorial editado manualmente.",
    })
    .eq("id", estimateId)
    .eq("organization_id", activeOrg.id);
  if (error) throw new Error(error.message);

  revalidatePath(`/orcamento-ia/${estimateId}`);
  if (estimate.site_id) {
    revalidatePath(`/obras/${estimate.site_id}/orcamento-ia`);
    revalidatePath(`/obras/${estimate.site_id}/orcamento-ia/${estimateId}`);
  }
}

/**
 * Gera o MEMORIAL DESCRITIVO DEFINITIVO a partir do orcamento JA VALIDADO
 * pelo engenheiro: usa os ai_estimate_items atuais (com edicoes manuais),
 * os dados da obra e o resumo/area da leitura da planta. O memorial vindo
 * da analise da planta e apenas rascunho; este substitui memorial_text e
 * registra em source_summary.memorial_validado que foi gerado pos-validacao.
 */
export async function generateMemorialValidado(estimateId: string) {
  const { db, activeOrg } = await requireContext();
  if (!estimateId) throw new Error("estimate_id obrigatorio.");

  const estimate = await fetchEstimate(db, estimateId);
  if (!estimate || estimate.organization_id !== activeOrg.id) {
    throw new Error("Estudo nao encontrado.");
  }
  if (!isClaudeConfigured()) {
    throw new Error(
      "ANTHROPIC_API_KEY nao esta configurada no ambiente do servidor para gerar o memorial validado."
    );
  }

  const [{ data: summaryRaw, error: summaryError }, { data: itemsRaw, error: itemsError }] =
    await Promise.all([
      db
        .from("ai_estimates")
        .select("source_summary")
        .eq("id", estimateId)
        .eq("organization_id", activeOrg.id)
        .maybeSingle(),
      db
        .from("ai_estimate_items")
        .select("code, group_name, description, quantity, unit, needs_review, sort_order, metadata")
        .eq("estimate_id", estimateId)
        .eq("organization_id", activeOrg.id)
        .order("sort_order", { ascending: true }),
    ]);
  if (summaryError) throw new Error(summaryError.message);
  if (itemsError) throw new Error(itemsError.message);

  const items = (itemsRaw ?? []) as MemorialItemRow[];
  if (items.length === 0) {
    throw new Error("O orcamento nao possui itens para gerar o memorial validado.");
  }

  const sourceSummaryValue = (summaryRaw as { source_summary?: unknown } | null)?.source_summary;
  const sourceSummary: Record<string, unknown> =
    sourceSummaryValue && typeof sourceSummaryValue === "object" && !Array.isArray(sourceSummaryValue)
      ? { ...(sourceSummaryValue as Record<string, unknown>) }
      : {};

  const { text, model } = await callClaudeWithDocuments({
    system: buildMemorialValidadoSystemPrompt(),
    prompt: buildMemorialValidadoPrompt(estimate, items, extractStoredPlanAnalysis(sourceSummary)),
    maxTokens: 16000,
    temperature: 0.3,
  });

  const memorialText = stripMarkdownFences(text);
  if (!memorialText) {
    throw new Error("A IA nao retornou um memorial descritivo valido.");
  }

  const generatedAt = new Date().toISOString();
  sourceSummary.memorial_validado = {
    generated_at: generatedAt,
    model,
    item_count: items.length,
    base: "ai_estimate_items_revisados_pelo_engenheiro",
  };

  const { error } = await db
    .from("ai_estimates")
    .update({
      memorial_text: memorialText,
      source_summary: sourceSummary,
    })
    .eq("id", estimateId)
    .eq("organization_id", activeOrg.id);
  if (error) throw new Error(error.message);

  revalidatePath(`/orcamento-ia/${estimateId}`);
  if (estimate.site_id) {
    revalidatePath(`/obras/${estimate.site_id}/orcamento-ia`);
    revalidatePath(`/obras/${estimate.site_id}/orcamento-ia/${estimateId}`);
  }
}

export async function updateEstimateItem(formData: FormData) {
  const { db, activeOrg } = await requireContext();
  const estimateId = asString(formData.get("estimate_id"));
  const itemId = asString(formData.get("item_id"));
  if (!estimateId || !itemId) throw new Error("estimate_id e item_id obrigatorios.");

  const estimate = await fetchEstimate(db, estimateId);
  if (!estimate || estimate.organization_id !== activeOrg.id) {
    throw new Error("Estudo nao encontrado.");
  }

  const quantity = asNumber(formData.get("quantity")) ?? 0;
  const unitCost = asNumber(formData.get("unit_cost")) ?? 0;
  const needsReview = formData.get("needs_review") === "on";
  const total = roundMoney(quantity * unitCost);

  const { data, error } = await db
    .from("ai_estimate_items")
    .update({
      code: asNullableString(formData.get("code")),
      group_name: asString(formData.get("group_name")) || "Sem grupo",
      description: asString(formData.get("description")) || "Item sem descricao",
      quantity,
      unit: asString(formData.get("unit")) || "VB",
      unit_cost: unitCost,
      total,
      source: "usuario",
      confidence: needsReview ? 0.85 : 1,
      needs_review: needsReview,
    })
    .eq("id", itemId)
    .eq("estimate_id", estimateId)
    .eq("organization_id", activeOrg.id)
    .select("id")
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Item nao encontrado.");

  await recalculateEstimateTotals(db, estimateId, activeOrg.id, { status: "review" });
  revalidatePath(`/orcamento-ia/${estimateId}`);
  if (estimate.site_id) {
    revalidatePath(`/obras/${estimate.site_id}/orcamento-ia`);
    revalidatePath(`/obras/${estimate.site_id}/orcamento-ia/${estimateId}`);
  }
}

export async function addEstimateItem(formData: FormData) {
  const { db, activeOrg } = await requireContext();
  const estimateId = asString(formData.get("estimate_id"));
  if (!estimateId) throw new Error("estimate_id obrigatorio.");

  const estimate = await fetchEstimate(db, estimateId);
  if (!estimate || estimate.organization_id !== activeOrg.id) {
    throw new Error("Estudo nao encontrado.");
  }

  const quantity = asNumber(formData.get("quantity")) ?? 1;
  const unitCost = asNumber(formData.get("unit_cost")) ?? 0;
  const total = roundMoney(quantity * unitCost);
  const { data: lastRaw } = await db
    .from("ai_estimate_items")
    .select("sort_order")
    .eq("estimate_id", estimateId)
    .eq("organization_id", activeOrg.id)
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle();
  const nextSort = toNullableInteger((lastRaw as { sort_order?: unknown } | null)?.sort_order) ?? 0;

  const { error } = await db.from("ai_estimate_items").insert({
    estimate_id: estimateId,
    organization_id: activeOrg.id,
    template_item_id: null,
    code: asNullableString(formData.get("code")),
    group_name: asString(formData.get("group_name")) || "Itens complementares",
    description: asString(formData.get("description")) || "Novo item",
    quantity,
    unit: asString(formData.get("unit")) || "VB",
    unit_cost: unitCost,
    total,
    confidence: 1,
    source: "usuario",
    needs_review: false,
    sort_order: nextSort + 10,
    metadata: {
      manual_item: true,
      created_from: "orcamento_ia_editor",
    },
  });
  if (error) throw new Error(error.message);

  await recalculateEstimateTotals(db, estimateId, activeOrg.id, { status: "review" });
  revalidatePath(`/orcamento-ia/${estimateId}`);
  if (estimate.site_id) {
    revalidatePath(`/obras/${estimate.site_id}/orcamento-ia`);
    revalidatePath(`/obras/${estimate.site_id}/orcamento-ia/${estimateId}`);
  }
}

export async function deleteEstimateItem(formData: FormData) {
  const { db, activeOrg } = await requireContext();
  const estimateId = asString(formData.get("estimate_id"));
  const itemId = asString(formData.get("item_id"));
  if (!estimateId || !itemId) throw new Error("estimate_id e item_id obrigatorios.");

  const estimate = await fetchEstimate(db, estimateId);
  if (!estimate || estimate.organization_id !== activeOrg.id) {
    throw new Error("Estudo nao encontrado.");
  }

  const { error } = await db
    .from("ai_estimate_items")
    .delete()
    .eq("id", itemId)
    .eq("estimate_id", estimateId)
    .eq("organization_id", activeOrg.id);
  if (error) throw new Error(error.message);

  await recalculateEstimateTotals(db, estimateId, activeOrg.id, { status: "review" });
  revalidatePath(`/orcamento-ia/${estimateId}`);
  if (estimate.site_id) {
    revalidatePath(`/obras/${estimate.site_id}/orcamento-ia`);
    revalidatePath(`/obras/${estimate.site_id}/orcamento-ia/${estimateId}`);
  }
}

export async function deleteAiEstimate(formData: FormData) {
  const { supabase, db, activeOrg } = await requireContext();
  const estimateId = asString(formData.get("estimate_id"));
  const redirectTo = asNullableString(formData.get("redirect_to"));
  if (!estimateId) throw new Error("estimate_id obrigatorio.");

  const estimate = await fetchEstimate(db, estimateId);
  if (!estimate || estimate.organization_id !== activeOrg.id) {
    throw new Error("Estudo nao encontrado.");
  }

  const { data: filesRaw, error: filesError } = await db
    .from("ai_estimate_files")
    .select("storage_bucket, storage_path")
    .eq("estimate_id", estimateId)
    .eq("organization_id", activeOrg.id);
  if (filesError) throw new Error(filesError.message);

  const pathsByBucket = new Map<string, string[]>();
  for (const file of (filesRaw ?? []) as Array<{ storage_bucket: string | null; storage_path: string | null }>) {
    if (!file.storage_bucket || !file.storage_path) continue;
    const list = pathsByBucket.get(file.storage_bucket) ?? [];
    list.push(file.storage_path);
    pathsByBucket.set(file.storage_bucket, list);
  }

  for (const [bucket, paths] of pathsByBucket.entries()) {
    if (paths.length > 0) {
      await supabase.storage.from(bucket).remove(paths);
    }
  }

  const { error } = await db
    .from("ai_estimates")
    .delete()
    .eq("id", estimateId)
    .eq("organization_id", activeOrg.id);
  if (error) throw new Error(error.message);

  revalidatePath("/orcamento-ia");
  if (estimate.site_id) {
    revalidatePath(`/obras/${estimate.site_id}`);
    revalidatePath(`/obras/${estimate.site_id}/orcamento-ia`);
  }

  redirect(redirectTo ?? (estimate.site_id ? `/obras/${estimate.site_id}/orcamento-ia` : "/orcamento-ia"));
}

async function recalculateEstimateTotals(
  db: UntypedSupabase,
  estimateId: string,
  organizationId: string,
  options: { status?: "review" | "approved"; confidenceScore?: number } = {}
) {
  const [{ data: estimateRaw, error: estimateError }, { data: itemsRaw, error: itemsError }] =
    await Promise.all([
      db
        .from("ai_estimates")
        .select("contingency_pct")
        .eq("id", estimateId)
        .eq("organization_id", organizationId)
        .maybeSingle(),
      db
        .from("ai_estimate_items")
        .select("total, confidence")
        .eq("estimate_id", estimateId)
        .eq("organization_id", organizationId),
    ]);
  if (estimateError) throw new Error(estimateError.message);
  if (itemsError) throw new Error(itemsError.message);

  const items = (itemsRaw ?? []) as Array<{ total: unknown; confidence: unknown }>;
  const subtotal = roundMoney(items.reduce((sum, item) => sum + (toNullableNumber(item.total) ?? 0), 0));
  const contingencyPct = toNullableNumber((estimateRaw as { contingency_pct?: unknown } | null)?.contingency_pct) ?? 0;
  const total = roundMoney(subtotal * (1 + contingencyPct / 100));
  const confidenceScore =
    options.confidenceScore ??
    (items.length === 0
      ? 0
      : clampConfidence(
          items.reduce((sum, item) => {
            const itemTotal = toNullableNumber(item.total) ?? 0;
            const weight = subtotal > 0 ? itemTotal / subtotal : 1 / items.length;
            return sum + (toNullableNumber(item.confidence) ?? 0.5) * weight;
          }, 0)
        ));

  const patch: Record<string, unknown> = {
    subtotal,
    total,
    confidence_score: confidenceScore,
  };
  if (options.status) patch.status = options.status;

  const { error } = await db
    .from("ai_estimates")
    .update(patch)
    .eq("id", estimateId)
    .eq("organization_id", organizationId);
  if (error) throw new Error(error.message);
}

const MEMORIAL_NUM = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 2 });

function extractStoredPlanAnalysis(sourceSummary: Record<string, unknown>): StoredPlanAnalysisSummary | null {
  const planAnalysis = sourceSummary.plan_analysis;
  if (!planAnalysis || typeof planAnalysis !== "object" || Array.isArray(planAnalysis)) return null;
  return planAnalysis as StoredPlanAnalysisSummary;
}

function buildMemorialValidadoSystemPrompt(): string {
  return [
    "Voce e o engenheiro orcamentista senior e redator tecnico da Meu Viver Construtora (obras residenciais de alto padrao).",
    "Sua funcao agora: redigir o MEMORIAL DESCRITIVO DEFINITIVO de uma obra, baseado no orcamento JA VALIDADO pelo engenheiro responsavel.",
    "Regras inegociaveis:",
    "1. NUNCA cite precos, custos unitarios, totais ou qualquer valor monetario. Memorial descreve escopo e especificacao, nao custo.",
    "2. Use as quantidades e unidades reais dos itens validados quando forem relevantes para descrever o escopo.",
    "3. Nao invente servicos que nao estejam nas etapas do orcamento validado.",
    "4. Escreva em portugues do Brasil, tom de proposta comercial de construtora de alto padrao: profissional, direto, confiante e acolhedor (tom da Meu Viver).",
    "5. Responda SOMENTE com o memorial em markdown, sem comentarios antes ou depois e sem cercas de codigo.",
  ].join("\n");
}

function buildMemorialValidadoPrompt(
  estimate: EstimateRow,
  items: MemorialItemRow[],
  planAnalysis: StoredPlanAnalysisSummary | null
): string {
  const builtArea = toNullableNumber(estimate.built_area_m2);
  const poolArea = toNullableNumber(estimate.pool_area_m2);
  const terrainArea = toNullableNumber(estimate.terrain_area_m2);
  const floors = toNullableInteger(estimate.floors_count);
  const planAreaTotal =
    planAnalysis === null
      ? null
      : toNullableNumber(planAnalysis.areaTotalM2) ?? toNullableNumber(planAnalysis.builtAreaM2);
  const planSummary =
    planAnalysis === null
      ? null
      : typeof planAnalysis.resumoObra === "string" && planAnalysis.resumoObra.trim()
        ? planAnalysis.resumoObra.trim()
        : typeof planAnalysis.summary === "string" && planAnalysis.summary.trim()
          ? planAnalysis.summary.trim()
          : null;

  const obraLines = [
    `Titulo do projeto: ${estimate.title}`,
    `Cliente: ${estimate.client_name ?? "a definir"}`,
    `Endereco: ${estimate.address ?? "a confirmar"}`,
    `Area construida: ${builtArea !== null ? `${MEMORIAL_NUM.format(builtArea)} m2` : planAreaTotal !== null ? `${MEMORIAL_NUM.format(planAreaTotal)} m2 (leitura da planta)` : "nao informada"}`,
    `Area do terreno: ${terrainArea !== null ? `${MEMORIAL_NUM.format(terrainArea)} m2` : "nao informada"}`,
    `Area de piscina: ${poolArea !== null && poolArea > 0 ? `${MEMORIAL_NUM.format(poolArea)} m2` : "sem piscina informada"}`,
    `Pavimentos: ${floors !== null ? String(floors) : "nao informado"}`,
    `Subsolo: ${estimate.has_basement ? "sim" : "nao informado"}`,
    `Padrao de acabamento: ${estimate.quality_standard}`,
  ];

  const groups = new Map<string, MemorialItemRow[]>();
  for (const item of items) {
    const list = groups.get(item.group_name) ?? [];
    list.push(item);
    groups.set(item.group_name, list);
  }
  const etapasText = [...groups.entries()]
    .map(([groupName, groupItems]) => {
      const lines = groupItems.map((item) => {
        const quantity = toNullableNumber(item.quantity);
        const quantityText =
          quantity !== null && quantity > 0 ? `${MEMORIAL_NUM.format(quantity)} ${item.unit}` : item.unit;
        const observacao =
          item.metadata && typeof item.metadata.observacao === "string" && item.metadata.observacao.trim()
            ? ` (obs.: ${item.metadata.observacao.trim()})`
            : "";
        return `- ${item.description} — ${quantityText}${observacao}`;
      });
      return [`Etapa: ${groupName}`, ...lines].join("\n");
    })
    .join("\n\n");

  return [
    "Redija o MEMORIAL DESCRITIVO DEFINITIVO desta obra, no formato de proposta comercial da Meu Viver Construtora.",
    "Este memorial substitui o rascunho automatico gerado na leitura da planta: a base agora e o ORCAMENTO VALIDADO pelo engenheiro, listado abaixo com quantidades e unidades reais.",
    "",
    "DADOS DA OBRA:",
    ...obraLines,
    "",
    planSummary ? `RESUMO DA LEITURA DA PLANTA (contexto): ${planSummary}` : "RESUMO DA LEITURA DA PLANTA: nao disponivel.",
    "",
    "ETAPAS E ITENS DO ORCAMENTO VALIDADO (escopo definitivo):",
    etapasText,
    "",
    "ESTRUTURA OBRIGATORIA do memorial (markdown):",
    "1. Titulo 'MEMORIAL DESCRITIVO' com identificacao da obra, e introducao com cliente, endereco e areas.",
    "2. Uma secao '## NOME DA ETAPA' para CADA etapa do orcamento validado acima, na mesma ordem, mantendo a numeracao da etapa quando presente no nome. Em cada secao descreva escopo, materiais, especificacoes e premissas dos itens daquela etapa, citando quantidades/unidades reais quando agregarem clareza.",
    "3. Fechamento com '## Condicoes gerais' e '## Itens nao inclusos' coerentes com o escopo descrito.",
    "Lembrete final: NENHUM preco, custo ou valor monetario pode aparecer no texto.",
  ].join("\n");
}

function stripMarkdownFences(text: string): string {
  const trimmed = text.trim();
  const fenced = /^```(?:markdown|md)?\s*\n([\s\S]*?)\n```$/i.exec(trimmed);
  return (fenced ? fenced[1] : trimmed).trim();
}

function asString(value: FormDataEntryValue | null): string {
  return typeof value === "string" ? value.trim() : "";
}

function asNullableString(value: FormDataEntryValue | null): string | null {
  const str = asString(value);
  return str ? str : null;
}

function asNumber(value: FormDataEntryValue | null): number | null {
  const str = asString(value);
  if (!str) return null;
  const normalized = str.includes(",")
    ? str.replace(/\./g, "").replace(",", ".")
    : str;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

function asInteger(value: FormDataEntryValue | null): number | null {
  const parsed = asNumber(value);
  return parsed === null ? null : Math.round(parsed);
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

function roundMoney(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function clampConfidence(value: number): number {
  return Math.max(0, Math.min(1, Math.round(value * 100) / 100));
}

function parseUploadedFiles(
  value: FormDataEntryValue | null,
  organizationId: string,
  estimateId: string
): UploadedEstimateFile[] {
  const raw = asString(value);
  if (!raw) return [];

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error("Metadados de arquivos invalidos.");
  }

  if (!Array.isArray(parsed)) {
    throw new Error("Metadados de arquivos invalidos.");
  }

  const allowedKinds = new Set<UploadedEstimateFile["kind"]>([
    "plan",
    "proposal",
    "spreadsheet",
    "other",
  ]);
  const prefix = `${organizationId}/estimativas/${estimateId}/`;

  return parsed.map((item): UploadedEstimateFile => {
    const record = item as Partial<UploadedEstimateFile>;
    const kind = record.kind;
    const fileName = typeof record.file_name === "string" ? record.file_name.trim() : "";
    const storagePath = typeof record.storage_path === "string" ? record.storage_path.trim() : "";
    const sizeBytes = Number(record.size_bytes ?? 0);

    if (!kind || !allowedKinds.has(kind)) throw new Error("Tipo de arquivo invalido.");
    if (!fileName || fileName.length > 240) throw new Error("Nome de arquivo invalido.");
    if (!storagePath.startsWith(prefix)) throw new Error("Caminho de arquivo invalido.");
    if (!Number.isFinite(sizeBytes) || sizeBytes < 0) throw new Error("Tamanho de arquivo invalido.");

    return {
      kind,
      file_name: fileName,
      storage_bucket: "exports",
      storage_path: storagePath,
      content_type:
        typeof record.content_type === "string" && record.content_type.trim()
          ? record.content_type.trim().slice(0, 160)
          : null,
      size_bytes: sizeBytes,
    };
  });
}
