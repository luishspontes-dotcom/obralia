"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
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
  const n = Number(s);
  return isNaN(n) ? null : n;
}

/* ───────── RDO CRUD ───────── */

export async function createOrUpdateRdo(formData: FormData) {
  const { supabase, user } = await requireUser();
  const admin = supabase;

  const rdoId = asString(formData.get("rdoId")) || null;
  const siteId = asString(formData.get("siteId"));
  const date = asString(formData.get("date"));
  if (!siteId || !date) throw new Error("siteId e date são obrigatórios");

  const wm = asString(formData.get("weather_morning")) || null;
  const wa = asString(formData.get("weather_afternoon")) || null;
  const cm = asString(formData.get("condition_morning")) || null;
  const ca = asString(formData.get("condition_afternoon")) || null;
  const notes = asString(formData.get("general_notes")) || null;
  const status = asString(formData.get("status")) || "draft";

  // arrays vêm como JSON em hidden inputs (mantém o form simples)
  const wfRaw = asString(formData.get("workforce_json"));
  const eqRaw = asString(formData.get("equipment_json"));
  const acRaw = asString(formData.get("activities_json"));

  type WF = { role: string; count: number };
  type EQ = { name: string; hours: number | null };
  type AC = { description: string; progress_pct: number | null; notes: string | null };

  const wfList: WF[] = wfRaw ? JSON.parse(wfRaw) : [];
  const eqList: EQ[] = eqRaw ? JSON.parse(eqRaw) : [];
  const acList: AC[] = acRaw ? JSON.parse(acRaw) : [];

  let drId = rdoId;

  if (drId) {
    /* UPDATE flow */
    const { error: upErr } = await admin
      .from("daily_reports")
      .update({
        date,
        status,
        weather_morning: wm,
        weather_afternoon: wa,
        condition_morning: cm,
        condition_afternoon: ca,
        general_notes: notes,
      } as never)
      .eq("id", drId);
    if (upErr) throw new Error(upErr.message);
  } else {
    /* CREATE flow — auto número */
    const { data: maxR } = await admin
      .from("daily_reports").select("number")
      .eq("site_id", siteId)
      .order("number", { ascending: false }).limit(1).maybeSingle();
    const nextNumber = (((maxR as { number?: number } | null)?.number) ?? 0) + 1;

    const { data: inserted, error: insErr } = await admin
      .from("daily_reports")
      .insert({
        site_id: siteId,
        number: nextNumber,
        date,
        status,
        weather_morning: wm,
        weather_afternoon: wa,
        condition_morning: cm,
        condition_afternoon: ca,
        general_notes: notes,
        created_by: user.id,
      } as never)
      .select("id").single();
    if (insErr || !inserted) throw new Error(insErr?.message ?? "insert falhou");
    drId = (inserted as { id: string }).id;
  }

  /* Replace child collections (delete-then-insert keeps semantics simple) */
  await admin.from("report_workforce").delete().eq("daily_report_id", drId);
  await admin.from("report_equipment").delete().eq("daily_report_id", drId);
  await admin.from("report_activities").delete().eq("daily_report_id", drId);

  if (wfList.length > 0) {
    const rows = wfList
      .filter(w => w.role && w.count > 0)
      .map(w => ({ daily_report_id: drId, role: w.role.trim(), count: Math.round(w.count) }));
    if (rows.length > 0) await admin.from("report_workforce").insert(rows as never);
  }
  if (eqList.length > 0) {
    const rows = eqList
      .filter(e => e.name)
      .map(e => ({ daily_report_id: drId, name: e.name.trim(), hours: e.hours }));
    if (rows.length > 0) await admin.from("report_equipment").insert(rows as never);
  }
  if (acList.length > 0) {
    const rows = acList
      .filter(a => a.description)
      .map(a => ({
        daily_report_id: drId,
        description: a.description.trim(),
        progress_pct: a.progress_pct,
        notes: a.notes,
      }));
    if (rows.length > 0) await admin.from("report_activities").insert(rows as never);
  }

  revalidatePath(`/obras/${siteId}`);
  revalidatePath(`/obras/${siteId}/rdos`);
  revalidatePath(`/obras/${siteId}/rdos/${drId}`);
  redirect(`/obras/${siteId}/rdos/${drId}`);
}

export async function deleteRdo(formData: FormData) {
  const { supabase } = await requireUser();
  const admin = supabase;
  const rdoId = asString(formData.get("rdoId"));
  const siteId = asString(formData.get("siteId"));
  if (!rdoId || !siteId) throw new Error("rdoId e siteId obrigatórios");

  await admin.from("media").delete().eq("daily_report_id", rdoId);
  await admin.from("report_workforce").delete().eq("daily_report_id", rdoId);
  await admin.from("report_equipment").delete().eq("daily_report_id", rdoId);
  await admin.from("report_activities").delete().eq("daily_report_id", rdoId);
  await admin.from("comments").delete().eq("target_table", "daily_reports").eq("target_id", rdoId);
  const { error } = await admin.from("daily_reports").delete().eq("id", rdoId);
  if (error) throw new Error(error.message);

  revalidatePath(`/obras/${siteId}`);
  revalidatePath(`/obras/${siteId}/rdos`);
  redirect(`/obras/${siteId}/rdos`);
}

export async function setRdoStatus(formData: FormData) {
  const { supabase, user } = await requireUser();
  const admin = supabase;
  const rdoId = asString(formData.get("rdoId"));
  const siteId = asString(formData.get("siteId"));
  const status = asString(formData.get("status"));
  if (!rdoId || !["draft", "review", "approved"].includes(status)) {
    throw new Error("status inválido");
  }
  const patch: Record<string, unknown> = { status };
  if (status === "approved") {
    patch.approved_by = user.id;
    patch.approved_at = new Date().toISOString();
    patch.approval_status_id = 4;
    patch.approval_status_label = "Aprovado";
  }
  const { error } = await admin.from("daily_reports").update(patch as never).eq("id", rdoId);
  if (error) throw new Error(error.message);

  revalidatePath(`/obras/${siteId}/rdos/${rdoId}`);
}

/* ───────── Photo upload / delete ───────── */

export async function uploadPhotos(formData: FormData) {
  const { supabase, user } = await requireUser();
  const admin = supabase;
  const rdoId = asString(formData.get("rdoId"));
  const siteId = asString(formData.get("siteId"));
  if (!rdoId || !siteId) throw new Error("rdoId e siteId obrigatórios");

  const files = formData.getAll("photos").filter((f): f is File => f instanceof File && f.size > 0);
  if (files.length === 0) return;

  type Meta = { lat?: number; lng?: number; takenAt?: string; w?: number; h?: number };
  let metas: Meta[] = [];
  try {
    const raw = asString(formData.get("photo_meta_json"));
    if (raw) metas = JSON.parse(raw) as Meta[];
  } catch {
    metas = [];
  }

  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    const meta = metas[i] ?? {};
    const ext = (file.name.split(".").pop() || "jpg").toLowerCase();
    const id = crypto.randomUUID();
    const path = `${siteId}/${id}.${ext}`;

    const buf = new Uint8Array(await file.arrayBuffer());
    const up = await admin.storage.from("media").upload(path, buf, {
      contentType: file.type || "image/jpeg",
      upsert: false,
    });
    if (up.error) {
      console.error("upload error:", up.error.message);
      continue;
    }

    await admin.from("media").insert({
      id,
      site_id: siteId,
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
      migrated_at: new Date().toISOString(),
      sync_metadata: { uploaded_via: "obralia" },
    } as never);
  }

  revalidatePath(`/obras/${siteId}/rdos/${rdoId}`);
  revalidatePath(`/obras/${siteId}/fotos`);
}

export async function deletePhoto(formData: FormData) {
  const { supabase } = await requireUser();
  const admin = supabase;
  const photoId = asString(formData.get("photoId"));
  const rdoId = asString(formData.get("rdoId"));
  const siteId = asString(formData.get("siteId"));
  if (!photoId) throw new Error("photoId obrigatório");

  const { data: row } = await admin.from("media").select("storage_path, thumbnail_path").eq("id", photoId).maybeSingle();
  const r = row as { storage_path?: string; thumbnail_path?: string } | null;
  if (r?.storage_path && !r.storage_path.startsWith("http")) {
    await admin.storage.from("media").remove([r.storage_path]);
  }
  if (r?.thumbnail_path && !r.thumbnail_path.startsWith("http")) {
    await admin.storage.from("media").remove([r.thumbnail_path]);
  }
  await admin.from("media").delete().eq("id", photoId);

  if (rdoId) revalidatePath(`/obras/${siteId}/rdos/${rdoId}`);
  if (siteId) revalidatePath(`/obras/${siteId}/fotos`);
}

/* ───────── Obra edit ───────── */

export async function updateSite(formData: FormData) {
  const { supabase } = await requireUser();
  const admin = supabase;
  const id = asString(formData.get("id"));
  if (!id) throw new Error("id obrigatório");

  const patch = {
    name: asString(formData.get("name")) || undefined,
    client_name: asString(formData.get("client_name")) || null,
    address: asString(formData.get("address")) || null,
    start_date: asString(formData.get("start_date")) || null,
    end_date: asString(formData.get("end_date")) || null,
    contract_number: asString(formData.get("contract_number")) || null,
    status: asString(formData.get("status")) || undefined,
  };
  Object.keys(patch).forEach(k => {
    if ((patch as Record<string, unknown>)[k] === undefined) delete (patch as Record<string, unknown>)[k];
  });

  const { error } = await admin.from("sites").update(patch as never).eq("id", id);
  if (error) throw new Error(error.message);

  revalidatePath(`/obras/${id}`);
  revalidatePath(`/obras`);
  redirect(`/obras/${id}`);
}

export async function uploadSiteCover(formData: FormData) {
  const { supabase } = await requireUser();
  const admin = supabase;
  const siteId = asString(formData.get("siteId"));
  const file = formData.get("cover");
  if (!siteId || !(file instanceof File) || file.size === 0) return;

  const ext = (file.name.split(".").pop() || "jpg").toLowerCase();
  const path = `${siteId}/_cover_${Date.now()}.${ext}`;
  const buf = new Uint8Array(await file.arrayBuffer());
  const up = await admin.storage.from("media").upload(path, buf, {
    contentType: file.type || "image/jpeg", upsert: true,
  });
  if (up.error) throw new Error(up.error.message);

  await admin.from("sites").update({ cover_url: path } as never).eq("id", siteId);
  revalidatePath(`/obras/${siteId}`);
  revalidatePath(`/obras`);
}

/* ───────── Tarefa CRUD ───────── */

export async function createOrUpdateTask(formData: FormData) {
  const { supabase, user } = await requireUser();
  const admin = supabase;
  const id = asString(formData.get("id")) || null;
  const siteId = asString(formData.get("site_id")) || null;
  const name = asString(formData.get("name"));
  if (!name) throw new Error("name obrigatório");

  const patch = {
    name,
    site_id: siteId,
    status: asString(formData.get("status")) || "todo",
    progress_pct: asNum(formData.get("progress_pct")),
    date_started: asString(formData.get("date_started")) || null,
    date_due: asString(formData.get("date_due")) || null,
    description: asString(formData.get("description")) || null,
  };

  if (id) {
    const { error } = await admin.from("wbs_items").update(patch as never).eq("id", id);
    if (error) throw new Error(error.message);
  } else {
    const { data: orgR } = await admin.from("profiles").select("default_org_id").eq("id", user.id).maybeSingle();
    const orgId = (orgR as { default_org_id?: string } | null)?.default_org_id;
    if (!orgId) throw new Error("Sem organização");
    const { error } = await admin.from("wbs_items").insert({
      ...patch,
      organization_id: orgId,
      created_by: user.id,
    } as never);
    if (error) throw new Error(error.message);
  }

  revalidatePath("/tarefas");
  if (siteId) revalidatePath(`/obras/${siteId}`);
}

export async function deleteTask(formData: FormData) {
  const { supabase } = await requireUser();
  const admin = supabase;
  const id = asString(formData.get("id"));
  if (!id) throw new Error("id obrigatório");
  const { error } = await admin.from("wbs_items").delete().eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/tarefas");
}

/* ───────── Comments ───────── */

export async function postComment(formData: FormData) {
  const { supabase, user } = await requireUser();
  const admin = supabase;
  const target_table = asString(formData.get("target_table"));
  const target_id = asString(formData.get("target_id"));
  const body = asString(formData.get("body"));
  const redirectTo = asString(formData.get("redirect_to")) || null;
  if (!target_table || !target_id || !body) throw new Error("dados obrigatórios faltando");

  const { data: orgR } = await admin.from("profiles").select("default_org_id").eq("id", user.id).maybeSingle();
  const orgId = (orgR as { default_org_id?: string } | null)?.default_org_id;
  if (!orgId) throw new Error("Sem organização");

  const { error } = await admin.from("comments").insert({
    organization_id: orgId,
    author_id: user.id,
    target_table,
    target_id,
    body,
  } as never);
  if (error) throw new Error(error.message);

  if (redirectTo) revalidatePath(redirectTo);
}
