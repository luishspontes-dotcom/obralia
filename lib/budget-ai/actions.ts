"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createServerSupabase } from "@/lib/supabase/server";
import {
  type BudgetTemplateItem,
  type EstimateInput,
  generateEstimateFromTemplate,
} from "@/lib/budget-ai/estimate-engine";
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

  return { db, user, activeOrg };
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
  const { db, user, activeOrg } = await requireContext();
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
  await regenerateEstimateRows(db, estimateId, activeOrg.id, templateId, {
    title: estimate.title,
    clientName: estimate.client_name,
    address: estimate.address,
    builtAreaM2: toNullableNumber(estimate.built_area_m2),
    poolAreaM2: toNullableNumber(estimate.pool_area_m2),
    terrainAreaM2: toNullableNumber(estimate.terrain_area_m2),
    floorsCount: toNullableInteger(estimate.floors_count),
    hasBasement: estimate.has_basement,
    qualityStandard: estimate.quality_standard,
    fileNames: files.map((file) => file.file_name),
  });

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
  const { db, activeOrg } = await requireContext();
  const estimateId = asString(formData.get("estimate_id"));
  if (!estimateId) throw new Error("estimate_id obrigatorio.");

  const estimate = await fetchEstimate(db, estimateId);
  if (!estimate || estimate.organization_id !== activeOrg.id) {
    throw new Error("Estudo nao encontrado.");
  }

  const templateId = estimate.template_id ?? (await resolveTemplateId(db));
  const { data: filesRaw } = await db
    .from("ai_estimate_files")
    .select("file_name")
    .eq("estimate_id", estimateId)
    .order("created_at", { ascending: true });

  await db.from("ai_estimates").update({ status: "processing" }).eq("id", estimateId);

  await regenerateEstimateRows(db, estimateId, activeOrg.id, templateId, {
    title: estimate.title,
    clientName: estimate.client_name,
    address: estimate.address,
    builtAreaM2: toNullableNumber(estimate.built_area_m2),
    poolAreaM2: toNullableNumber(estimate.pool_area_m2),
    terrainAreaM2: toNullableNumber(estimate.terrain_area_m2),
    floorsCount: toNullableInteger(estimate.floors_count),
    hasBasement: estimate.has_basement,
    qualityStandard: estimate.quality_standard,
    fileNames: ((filesRaw ?? []) as Array<{ file_name: string }>).map((file) => file.file_name),
  });

  revalidatePath(`/orcamento-ia/${estimateId}`);
}

export async function approveAiEstimate(formData: FormData) {
  const { db, activeOrg } = await requireContext();
  const estimateId = asString(formData.get("estimate_id"));
  if (!estimateId) throw new Error("estimate_id obrigatorio.");

  const { error } = await db
    .from("ai_estimates")
    .update({ status: "approved" })
    .eq("id", estimateId)
    .eq("organization_id", activeOrg.id);
  if (error) throw new Error(error.message);

  revalidatePath("/orcamento-ia");
  revalidatePath(`/orcamento-ia/${estimateId}`);
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
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function toNullableInteger(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? Math.round(value) : null;
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
