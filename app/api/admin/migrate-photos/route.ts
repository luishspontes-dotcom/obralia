import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { createAdminSupabase } from "@/lib/supabase/admin";
import { getCurrentRole, canWrite } from "@/lib/permissions";

export const maxDuration = 60;

/**
 * Migra as fotos/vídeos cujo storage_path ainda aponta para o Azure do Diário
 * de Obra (blob.core.windows.net) para o bucket próprio "media".
 *
 * Mesmo padrão da migração de capas (server-side fetch → upload), mas para a
 * tabela `media`. Protegido por usuário autenticado com permissão de escrita.
 *
 * Processa em sub-lotes dentro de um orçamento de tempo (~50s) e devolve
 * { migrated, failed, remaining } — chame repetidamente até remaining = 0.
 */
export async function POST(req: Request) {
  // auth: precisa estar logado e poder escrever
  const supabase = await createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "não autenticado" }, { status: 401 });
  const role = await getCurrentRole();
  if (!canWrite(role)) return NextResponse.json({ error: "sem permissão" }, { status: 403 });

  const url = new URL(req.url);
  // quantos baixar do banco por rodada; processados em paralelo (chunks)
  const batch = Math.min(Math.max(Number(url.searchParams.get("batch") ?? 200) || 200, 1), 400);
  const concurrency = Math.min(Math.max(Number(url.searchParams.get("conc") ?? 12) || 12, 1), 20);
  const timeBudgetMs = 52_000;
  const startedAt = Date.now();

  const admin = createAdminSupabase();
  const VIDEO_EXTS = ["mp4", "mov", "webm", "m4v", "avi", "mkv", "3gp"];

  let migrated = 0;
  const failures: { id: string; reason: string }[] = [];

  type Row = { id: string; site_id: string; storage_path: string; kind: string | null };

  const migrateOne = async (m: Row) => {
    try {
      const res = await fetch(m.storage_path, { signal: AbortSignal.timeout(20_000) });
      if (!res.ok) throw new Error(`origem respondeu ${res.status}`);
      const contentType = res.headers.get("content-type") ?? "application/octet-stream";
      const bytes = new Uint8Array(await res.arrayBuffer());
      if (bytes.byteLength === 0) throw new Error("arquivo vazio");
      if (bytes.byteLength > 25 * 1024 * 1024) throw new Error("acima de 25MB");

      const urlExt = (m.storage_path.split("?")[0].split(".").pop() || "").toLowerCase();
      const isVideo = contentType.startsWith("video/") || VIDEO_EXTS.includes(urlExt);
      const ext = contentType.includes("png") ? "png"
        : contentType.includes("webp") ? "webp"
        : isVideo ? (VIDEO_EXTS.includes(urlExt) ? urlExt : "mp4")
        : "jpg";
      const path = `${m.site_id}/${m.id}.${ext}`;
      const buf = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;

      const up = await admin.storage.from("media").upload(path, buf, { contentType, upsert: true });
      if (up.error) throw new Error(up.error.message);

      const { error: updErr } = await admin
        .from("media")
        .update({ external_url: m.storage_path, storage_path: path, migrated_at: new Date().toISOString() } as never)
        .eq("id", m.id);
      if (updErr) throw new Error(updErr.message);

      migrated++;
    } catch (e) {
      const reason = e instanceof Error ? e.message : String(e);
      failures.push({ id: m.id, reason });
      await admin.from("media")
        .update({ migration_error: reason.slice(0, 300) } as never)
        .eq("id", m.id);
    }
  };

  while (Date.now() - startedAt < timeBudgetMs) {
    const { data: rowsRaw, error } = await admin
      .from("media")
      .select("id, site_id, storage_path, kind")
      .like("storage_path", "http%")
      .like("storage_path", "%blob.core.windows.net%")
      .is("migration_error", null)
      .limit(batch);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    const rows = (rowsRaw ?? []) as Row[];
    if (rows.length === 0) break;

    const before = migrated;
    for (let i = 0; i < rows.length; i += concurrency) {
      if (Date.now() - startedAt >= timeBudgetMs) break;
      await Promise.all(rows.slice(i, i + concurrency).map(migrateOne));
    }
    // se nada migrou no lote inteiro (ex.: Azure fora do ar), para cedo
    if (migrated === before) break;
  }

  const { count: remaining } = await admin
    .from("media")
    .select("*", { count: "exact", head: true })
    .like("storage_path", "http%")
    .like("storage_path", "%blob.core.windows.net%")
    .is("migration_error", null);

  const { count: erroredOut } = await admin
    .from("media")
    .select("*", { count: "exact", head: true })
    .like("storage_path", "http%")
    .like("storage_path", "%blob.core.windows.net%")
    .not("migration_error", "is", null);

  return NextResponse.json({
    migrated,
    failed: failures.length,
    sampleFailures: failures.slice(0, 5),
    remaining: remaining ?? 0,
    erroredOut: erroredOut ?? 0,
  });
}
