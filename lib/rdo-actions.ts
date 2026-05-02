"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { canWrite } from "@/lib/authz";
import { createServerSupabase } from "@/lib/supabase/server";

type ServerSupabase = Awaited<ReturnType<typeof createServerSupabase>>;
type WritableSiteContext = { siteId: string; organizationId: string };

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
  const n = Number(s);
  return isNaN(n) ? null : n;
}

function normalizeReportStatus(value: string) {
  return ["draft", "review", "approved"].includes(value) ? value : "draft";
}

function normalizeSiteStatus(value: string) {
  return ["not_started", "in_progress", "paused", "done"].includes(value) ? value : null;
}

function normalizeTaskStatus(value: string) {
  return ["waiting", "in_progress", "late", "paused", "done"].includes(value) ? value : "waiting";
}

async function requireWritableSite(
  supabase: ServerSupabase,
  userId: string,
  siteId: string
): Promise<WritableSiteContext> {
  const { data: siteRaw, error: siteError } = await supabase
    .from("sites")
    .select("id, organization_id")
    .eq("id", siteId)
    .maybeSingle();
  if (siteError) throw new Error(siteError.message);

  const site = siteRaw as { id: string; organization_id: string } | null;
  if (!site) throw new Error("Obra não encontrada.");

  const { data: membershipRaw, error: membershipError } = await supabase
    .from("organization_members")
    .select("role")
    .eq("organization_id", site.organization_id)
    .eq("profile_id", userId)
    .maybeSingle();
  if (membershipError) throw new Error(membershipError.message);

  if (!canWrite((membershipRaw as { role?: string } | null)?.role)) {
    throw new Error("Sem permissão para alterar esta obra.");
  }

  return { siteId: site.id, organizationId: site.organization_id };
}

async function requireWritableRdo(
  supabase: ServerSupabase,
  userId: string,
  rdoId: string,
  siteId: string
): Promise<WritableSiteContext> {
  const context = await requireWritableSite(supabase, userId, siteId);
  const { data: rdoRaw, error } = await supabase
    .from("daily_reports")
    .select("id")
    .eq("id", rdoId)
    .eq("site_id", siteId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!rdoRaw) throw new Error("RDO não encontrado nesta obra.");
  return context;
}

async function requireWritableTask(
  supabase: ServerSupabase,
  userId: string,
  taskId: string
) {
  const { data: taskRaw, error } = await supabase
    .from("wbs_items")
    .select("site_id")
    .eq("id", taskId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  const task = taskRaw as { site_id: string } | null;
  if (!task) throw new Error("Atividade não encontrada.");
  await requireWritableSite(supabase, userId, task.site_id);
}

function mediaStoragePath({
  organizationId,
  siteId,
  dailyReportId,
  extension,
}: {
  organizationId: string;
  siteId: string;
  dailyReportId?: string;
  extension: string;
}) {
  const scope = dailyReportId ? `rdos/${dailyReportId}` : "site";
  const dateFolder = new Date().toISOString().slice(0, 10);
  return `${organizationId}/${siteId}/${scope}/${dateFolder}/${crypto.randomUUID()}.${extension}`;
}

function isInternalStoragePath(path: string | null | undefined): path is string {
  return typeof path === "string" && path.length > 0 && !path.startsWith("http");
}

export async function createOrUpdateRdo(formData: FormData) {
  const { supabase, user } = await requireUser();

  const rdoId = asString(formData.get("rdoId")) || null;
  const siteId = asString(formData.get("siteId"));
  const date = asString(formData.get("date"));
  if (!siteId || !date) throw new Error("siteId e date são obrigatórios");

  const weatherMorning = asString(formData.get("weather_morning")) || null;
  const weatherAfternoon = asString(formData.get("weather_afternoon")) || null;
  const conditionMorning = asString(formData.get("condition_morning")) || null;
  const conditionAfternoon = asString(formData.get("condition_afternoon")) || null;
  const notes = asString(formData.get("general_notes")) || null;
  const status = normalizeReportStatus(asString(formData.get("status")) || "draft");

  type Workforce = { role: string; count: number };
  type Equipment = { name: string; hours: number | null };
  type Activity = { description: string; progress_pct: number | null; notes: string | null };

  const wfRaw = asString(formData.get("workforce_json"));
  const eqRaw = asString(formData.get("equipment_json"));
  const acRaw = asString(formData.get("activities_json"));
  const workforce: Workforce[] = wfRaw ? JSON.parse(wfRaw) : [];
  const equipment: Equipment[] = eqRaw ? JSON.parse(eqRaw) : [];
  const activities: Activity[] = acRaw ? JSON.parse(acRaw) : [];

  let dailyReportId = rdoId;

  if (dailyReportId) {
    await requireWritableRdo(supabase, user.id, dailyReportId, siteId);
    const { error } = await supabase
      .from("daily_reports")
      .update({
        date,
        status,
        weather_morning: weatherMorning,
        weather_afternoon: weatherAfternoon,
        condition_morning: conditionMorning,
        condition_afternoon: conditionAfternoon,
        general_notes: notes,
      } as never)
      .eq("id", dailyReportId)
      .eq("site_id", siteId);
    if (error) throw new Error(error.message);
  } else {
    await requireWritableSite(supabase, user.id, siteId);
    const { data: maxReport } = await supabase
      .from("daily_reports")
      .select("number")
      .eq("site_id", siteId)
      .order("number", { ascending: false })
      .limit(1)
      .maybeSingle();
    const nextNumber = (((maxReport as { number?: number } | null)?.number) ?? 0) + 1;

    const { data: inserted, error } = await supabase
      .from("daily_reports")
      .insert({
        site_id: siteId,
        number: nextNumber,
        date,
        status,
        weather_morning: weatherMorning,
        weather_afternoon: weatherAfternoon,
        condition_morning: conditionMorning,
        condition_afternoon: conditionAfternoon,
        general_notes: notes,
        created_by: user.id,
      } as never)
      .select("id")
      .single();
    if (error || !inserted) throw new Error(error?.message ?? "insert falhou");
    dailyReportId = (inserted as { id: string }).id;
  }

  await supabase.from("report_workforce").delete().eq("daily_report_id", dailyReportId);
  await supabase.from("report_equipment").delete().eq("daily_report_id", dailyReportId);
  await supabase.from("report_activities").delete().eq("daily_report_id", dailyReportId);

  const workforceRows = workforce
    .filter((item) => item.role && item.count > 0)
    .map((item) => ({
      daily_report_id: dailyReportId,
      role: item.role.trim(),
      count: Math.round(item.count),
    }));
  if (workforceRows.length > 0) await supabase.from("report_workforce").insert(workforceRows as never);

  const equipmentRows = equipment
    .filter((item) => item.name)
    .map((item) => ({
      daily_report_id: dailyReportId,
      name: item.name.trim(),
      hours: item.hours,
    }));
  if (equipmentRows.length > 0) await supabase.from("report_equipment").insert(equipmentRows as never);

  const activityRows = activities
    .filter((item) => item.description)
    .map((item) => ({
      daily_report_id: dailyReportId,
      description: item.description.trim(),
      progress_pct: item.progress_pct,
      notes: item.notes,
    }));
  if (activityRows.length > 0) await supabase.from("report_activities").insert(activityRows as never);

  revalidatePath(`/obras/${siteId}`);
  revalidatePath(`/obras/${siteId}/rdos`);
  revalidatePath(`/obras/${siteId}/rdos/${dailyReportId}`);
  redirect(`/obras/${siteId}/rdos/${dailyReportId}`);
}

export async function deleteRdo(formData: FormData) {
  const { supabase, user } = await requireUser();
  const rdoId = asString(formData.get("rdoId"));
  const siteId = asString(formData.get("siteId"));
  if (!rdoId || !siteId) throw new Error("rdoId e siteId obrigatórios");
  await requireWritableRdo(supabase, user.id, rdoId, siteId);

  const { data: mediaRows } = await supabase
    .from("media")
    .select("storage_path, thumbnail_path")
    .eq("daily_report_id", rdoId);
  const storagePaths = ((mediaRows ?? []) as Array<{ storage_path: string | null; thumbnail_path: string | null }>)
    .flatMap((row) => [row.storage_path, row.thumbnail_path])
    .filter(isInternalStoragePath);
  if (storagePaths.length > 0) await supabase.storage.from("media").remove(storagePaths);

  await supabase.from("media").delete().eq("daily_report_id", rdoId);
  await supabase.from("report_workforce").delete().eq("daily_report_id", rdoId);
  await supabase.from("report_equipment").delete().eq("daily_report_id", rdoId);
  await supabase.from("report_activities").delete().eq("daily_report_id", rdoId);
  await supabase.from("comments").delete().eq("target_table", "daily_reports").eq("target_id", rdoId);
  const { error } = await supabase.from("daily_reports").delete().eq("id", rdoId).eq("site_id", siteId);
  if (error) throw new Error(error.message);

  revalidatePath(`/obras/${siteId}`);
  revalidatePath(`/obras/${siteId}/rdos`);
  redirect(`/obras/${siteId}/rdos`);
}

export async function setRdoStatus(formData: FormData) {
  const { supabase, user } = await requireUser();
  const rdoId = asString(formData.get("rdoId"));
  const siteId = asString(formData.get("siteId"));
  const status = asString(formData.get("status"));
  if (!rdoId || !siteId || !["draft", "review", "approved"].includes(status)) {
    throw new Error("status inválido");
  }
  await requireWritableRdo(supabase, user.id, rdoId, siteId);

  const patch: Record<string, unknown> = { status };
  if (status === "approved") {
    patch.approved_by = user.id;
    patch.approved_at = new Date().toISOString();
  } else {
    patch.approved_by = null;
    patch.approved_at = null;
  }

  const { error } = await supabase
    .from("daily_reports")
    .update(patch as never)
    .eq("id", rdoId)
    .eq("site_id", siteId);
  if (error) throw new Error(error.message);

  revalidatePath(`/obras/${siteId}/rdos/${rdoId}`);
}

export async function uploadPhotos(formData: FormData) {
  const { supabase, user } = await requireUser();
  const rdoId = asString(formData.get("rdoId"));
  const siteId = asString(formData.get("siteId"));
  if (!rdoId || !siteId) throw new Error("rdoId e siteId obrigatórios");
  const siteContext = await requireWritableRdo(supabase, user.id, rdoId, siteId);

  const files = formData.getAll("photos").filter((file): file is File => file instanceof File && file.size > 0);
  if (files.length === 0) return;

  type Meta = { lat?: number; lng?: number; takenAt?: string; w?: number; h?: number };
  let metas: Meta[] = [];
  try {
    const raw = asString(formData.get("photo_meta_json"));
    if (raw) metas = JSON.parse(raw) as Meta[];
  } catch {
    metas = [];
  }

  for (let index = 0; index < files.length; index++) {
    const file = files[index];
    const meta = metas[index] ?? {};
    const extension = (file.name.split(".").pop() || "jpg").toLowerCase();
    const id = crypto.randomUUID();
    const path = mediaStoragePath({
      organizationId: siteContext.organizationId,
      siteId: siteContext.siteId,
      dailyReportId: rdoId,
      extension,
    });

    const body = new Uint8Array(await file.arrayBuffer());
    const upload = await supabase.storage.from("media").upload(path, body, {
      contentType: file.type || "image/jpeg",
      upsert: false,
    });
    if (upload.error) throw new Error(upload.error.message);

    const { error } = await supabase.from("media").insert({
      id,
      site_id: siteContext.siteId,
      daily_report_id: rdoId,
      kind: file.type.startsWith("video/") ? "video" : "photo",
      storage_path: path,
      size_bytes: file.size,
      taken_at: meta.takenAt ?? new Date().toISOString(),
      taken_by: user.id,
      width: meta.w ?? null,
      height: meta.h ?? null,
      gps_lat: meta.lat ?? null,
      gps_lng: meta.lng ?? null,
      sync_metadata: { uploaded_via: "obralia" },
    } as never);
    if (error) {
      await supabase.storage.from("media").remove([path]);
      throw new Error(error.message);
    }
  }

  revalidatePath(`/obras/${siteId}/rdos/${rdoId}`);
  revalidatePath(`/obras/${siteId}/fotos`);
}

export async function deletePhoto(formData: FormData) {
  const { supabase, user } = await requireUser();
  const photoId = asString(formData.get("photoId"));
  const rdoId = asString(formData.get("rdoId"));
  const siteId = asString(formData.get("siteId"));
  if (!photoId) throw new Error("photoId obrigatório");

  const { data: row } = await supabase
    .from("media")
    .select("storage_path, thumbnail_path, site_id, daily_report_id")
    .eq("id", photoId)
    .maybeSingle();
  const media = row as { storage_path?: string; thumbnail_path?: string; site_id?: string; daily_report_id?: string | null } | null;
  if (!media?.site_id) throw new Error("Mídia não encontrada.");
  if (siteId && media.site_id !== siteId) throw new Error("Mídia não pertence a esta obra.");
  if (rdoId && media.daily_report_id !== rdoId) throw new Error("Mídia não pertence a este RDO.");
  await requireWritableSite(supabase, user.id, media.site_id);

  const paths = [media.storage_path, media.thumbnail_path]
    .filter(isInternalStoragePath);
  if (paths.length > 0) await supabase.storage.from("media").remove(paths);
  await supabase.from("media").delete().eq("id", photoId);

  if (rdoId) revalidatePath(`/obras/${siteId}/rdos/${rdoId}`);
  if (siteId) revalidatePath(`/obras/${siteId}/fotos`);
}

export async function updateSite(formData: FormData) {
  const { supabase, user } = await requireUser();
  const siteId = asString(formData.get("id"));
  if (!siteId) throw new Error("id obrigatório");
  await requireWritableSite(supabase, user.id, siteId);

  const patch = {
    name: asString(formData.get("name")) || undefined,
    client_name: asString(formData.get("client_name")) || null,
    address: asString(formData.get("address")) || null,
    start_date: asString(formData.get("start_date")) || null,
    end_date: asString(formData.get("end_date")) || null,
    contract_number: asString(formData.get("contract_number")) || null,
    status: normalizeSiteStatus(asString(formData.get("status"))) ?? undefined,
  };
  Object.keys(patch).forEach((key) => {
    if ((patch as Record<string, unknown>)[key] === undefined) delete (patch as Record<string, unknown>)[key];
  });

  const { error } = await supabase.from("sites").update(patch as never).eq("id", siteId);
  if (error) throw new Error(error.message);

  revalidatePath(`/obras/${siteId}`);
  revalidatePath("/obras");
  redirect(`/obras/${siteId}`);
}

export async function uploadSiteCover(formData: FormData) {
  const { supabase, user } = await requireUser();
  const siteId = asString(formData.get("siteId"));
  const file = formData.get("cover");
  if (!siteId || !(file instanceof File) || file.size === 0) return;
  const siteContext = await requireWritableSite(supabase, user.id, siteId);

  const extension = (file.name.split(".").pop() || "jpg").toLowerCase();
  const path = mediaStoragePath({
    organizationId: siteContext.organizationId,
    siteId: siteContext.siteId,
    extension,
  });
  const body = new Uint8Array(await file.arrayBuffer());
  const upload = await supabase.storage.from("media").upload(path, body, {
    contentType: file.type || "image/jpeg",
    upsert: true,
  });
  if (upload.error) throw new Error(upload.error.message);

  await supabase.from("sites").update({ cover_url: path } as never).eq("id", siteId);
  revalidatePath(`/obras/${siteId}`);
  revalidatePath("/obras");
}

export async function createOrUpdateTask(formData: FormData) {
  const { supabase, user } = await requireUser();
  const id = asString(formData.get("id")) || null;
  const siteId = asString(formData.get("site_id")) || null;
  const name = asString(formData.get("name"));
  if (!name) throw new Error("name obrigatório");
  if (!siteId) throw new Error("Selecione uma obra para a atividade.");
  const siteContext = await requireWritableSite(supabase, user.id, siteId);

  const patch = {
    name,
    site_id: siteContext.siteId,
    code: asString(formData.get("code")) || "MANUAL",
    status: normalizeTaskStatus(asString(formData.get("status"))),
    progress_pct: asNum(formData.get("progress_pct")),
    start_date: asString(formData.get("start_date")) || null,
    due_date: asString(formData.get("due_date")) || asString(formData.get("date_due")) || null,
  };

  if (id) {
    await requireWritableTask(supabase, user.id, id);
    const { error } = await supabase.from("wbs_items").update(patch as never).eq("id", id);
    if (error) throw new Error(error.message);
  } else {
    const { error } = await supabase.from("wbs_items").insert(patch as never);
    if (error) throw new Error(error.message);
  }

  revalidatePath("/tarefas");
  revalidatePath(`/obras/${siteContext.siteId}`);
}

export async function deleteTask(formData: FormData) {
  const { supabase, user } = await requireUser();
  const id = asString(formData.get("id"));
  if (!id) throw new Error("id obrigatório");
  await requireWritableTask(supabase, user.id, id);
  const { error } = await supabase.from("wbs_items").delete().eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/tarefas");
}

export async function postComment(formData: FormData) {
  const { supabase, user } = await requireUser();
  const targetTable = asString(formData.get("target_table"));
  const targetId = asString(formData.get("target_id"));
  const body = asString(formData.get("body"));
  const redirectTo = asString(formData.get("redirect_to")) || null;
  if (!targetTable || !targetId || !body) throw new Error("dados obrigatórios faltando");
  if (targetTable !== "daily_reports") throw new Error("Tipo de comentário inválido.");

  const { data: rdoRaw, error: rdoError } = await supabase
    .from("daily_reports")
    .select("site_id")
    .eq("id", targetId)
    .maybeSingle();
  if (rdoError) throw new Error(rdoError.message);
  const rdo = rdoRaw as { site_id: string } | null;
  if (!rdo) throw new Error("RDO não encontrado.");

  const { data: siteRaw, error: siteError } = await supabase
    .from("sites")
    .select("organization_id")
    .eq("id", rdo.site_id)
    .maybeSingle();
  if (siteError) throw new Error(siteError.message);
  const orgId = (siteRaw as { organization_id?: string } | null)?.organization_id;
  if (!orgId) throw new Error("Organização do RDO não encontrada.");

  const { error } = await supabase.from("comments").insert({
    organization_id: orgId,
    author_id: user.id,
    target_table: targetTable,
    target_id: targetId,
    body,
  } as never);
  if (error) throw new Error(error.message);

  if (redirectTo) revalidatePath(redirectTo);
}
