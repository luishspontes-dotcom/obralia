"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createServerSupabase } from "@/lib/supabase/server";
import {
  type BudgetTemplateItem,
  type EstimateInput,
  generateEstimateFromTemplate,
} from "@/lib/budget-ai/estimate-engine";
import {
  analyzePlanFilesFromStorage,
  type PlanAnalysis,
} from "@/lib/budget-ai/plan-analysis";
import { type UntypedSupabase, untypedDb } from "@/lib/supabase/untyped";

type Profile = {
  id: string;
  default_org_id: string | null;
};

type Organization = {
  id: string;
  name: string;
};

type EstimateRow = {
  id: string;
  organization_id: string;
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
};

type UploadedEstimateFile = {
  kind: "plan" | "proposal" | "spreadsheet" | "other";
  file_name: string;
  storage_bucket: string;
  storage_path: string;
  content_type: string | null;
  size_bytes: number;
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

export async function finalizeAiEstimateUpload(formData: FormData) {
  const { supabase, db, user, activeOrg } = await requireContext();
  const estimateId = asString(formData.get("estimate_id"));
  if (!estimateId) throw new Error("estimate_id obrigatorio.");

  const estimate = await fetchEstimate(db, estimateId);
  if (!estimate || estimate.organization_id !== activeOrg.id) {
    throw new Error("Estudo nao encontrado.");
  }

  const files = parseUploadedFiles(formData.get("files_json"), activeOrg.id, estimateId);
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

  const templateId = estimate.template_id ?? (await resolveTemplateId(db));
  const planAnalysis = await analyzePlanFilesFromStorage(supabase, files);
  await updateEstimateFromPlanAnalysis(db, estimate, planAnalysis);
  await regenerateEstimateRows(
    db,
    estimateId,
    activeOrg.id,
    templateId,
    buildEstimateInput(estimate, files.map((file) => file.file_name), planAnalysis)
  );

  revalidatePath("/orcamento-ia");
  revalidatePath(`/orcamento-ia/${estimateId}`);
  return { estimateId };
}

export async function failAiEstimate(formData: FormData) {
  const { db, activeOrg } = await requireContext();
  const estimateId = asString(formData.get("estimate_id"));
  const message = asNullableString(formData.get("message"));
  if (!estimateId) return;

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
}

export async function reprocessAiEstimate(formData: FormData) {
  const { supabase, db, activeOrg } = await requireContext();
  const estimateId = asString(formData.get("estimate_id"));
  if (!estimateId) throw new Error("estimate_id obrigatorio.");

  const estimate = await fetchEstimate(db, estimateId);
  if (!estimate || estimate.organization_id !== activeOrg.id) {
    throw new Error("Estudo nao encontrado.");
  }

  const templateId = estimate.template_id ?? (await resolveTemplateId(db));
  const { data: filesRaw } = await db
    .from("ai_estimate_files")
    .select("kind, file_name, storage_bucket, storage_path, content_type, size_bytes")
    .eq("estimate_id", estimateId)
    .order("created_at", { ascending: true });
  const files = (filesRaw ?? []) as UploadedEstimateFile[];

  await db.from("ai_estimates").update({ status: "processing" }).eq("id", estimateId);
  const planAnalysis = await analyzePlanFilesFromStorage(supabase, files);
  await updateEstimateFromPlanAnalysis(db, estimate, planAnalysis);

  await regenerateEstimateRows(
    db,
    estimateId,
    activeOrg.id,
    templateId,
    buildEstimateInput(estimate, files.map((file) => file.file_name), planAnalysis)
  );

  revalidatePath(`/orcamento-ia/${estimateId}`);
}

export async function approveAiEstimate(formData: FormData) {
  const { db, activeOrg } = await requireContext();
  const estimateId = asString(formData.get("estimate_id"));
  if (!estimateId) throw new Error("estimate_id obrigatorio.");

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
}

function buildEstimateInput(
  estimate: EstimateRow,
  fileNames: string[],
  planAnalysis: PlanAnalysis | null
): EstimateInput {
  const genericTitle = new Set(["Estudo preliminar", "Novo estudo preliminar"]);
  return {
    title: genericTitle.has(estimate.title) && planAnalysis?.projectTitle
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
) {
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
) {
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

  const generated = generateEstimateFromTemplate(input, templateItems);

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

async function resolveTemplateId(db: UntypedSupabase): Promise<string> {
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

async function fetchEstimate(db: UntypedSupabase, estimateId: string): Promise<EstimateRow | null> {
  const { data, error } = await db
    .from("ai_estimates")
    .select(
      "id, organization_id, template_id, title, client_name, address, built_area_m2, pool_area_m2, terrain_area_m2, floors_count, has_basement, quality_standard"
    )
    .eq("id", estimateId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data as EstimateRow | null;
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
