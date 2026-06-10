import { NextResponse } from "next/server";
import { createAdminSupabase } from "@/lib/supabase/admin";

export const maxDuration = 60;

/**
 * Migra capas de obra hospedadas em domínios externos (Azure do Diário de Obra)
 * para o bucket próprio "media". Motivo: redes de alguns clientes bloqueiam
 * blob.core.windows.net e as capas quebram no navegador.
 *
 * Protegida por header x-obralia-secret (mesmo segredo do webhook WhatsApp).
 * Processa em lotes (?batch=10) — chamar repetidamente até migrated=0.
 */
export async function POST(req: Request) {
  const secret = process.env.WHATSAPP_WEBHOOK_SECRET;
  if (!secret) return NextResponse.json({ error: "secret não configurado" }, { status: 503 });
  if (req.headers.get("x-obralia-secret") !== secret) {
    return NextResponse.json({ error: "não autorizado" }, { status: 401 });
  }

  const url = new URL(req.url);
  const batch = Math.min(Math.max(Number(url.searchParams.get("batch") ?? 8) || 8, 1), 15);

  const admin = createAdminSupabase();
  const { data: sites, error } = await admin
    .from("sites")
    .select("id, cover_url")
    .like("cover_url", "http%")
    .limit(batch);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const rows = (sites ?? []) as { id: string; cover_url: string }[];
  let migrated = 0;
  const failures: { id: string; reason: string }[] = [];

  for (const site of rows) {
    try {
      const res = await fetch(site.cover_url, { signal: AbortSignal.timeout(15000) });
      if (!res.ok) throw new Error(`origem respondeu ${res.status}`);
      const contentType = res.headers.get("content-type") ?? "image/jpeg";
      const bytes = new Uint8Array(await res.arrayBuffer());
      if (bytes.byteLength === 0) throw new Error("imagem vazia");
      if (bytes.byteLength > 10 * 1024 * 1024) throw new Error("imagem acima de 10MB");

      const ext = contentType.includes("png") ? "png" : contentType.includes("webp") ? "webp" : "jpg";
      const path = `${site.id}/_cover_migrated.${ext}`;
      const buf = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;

      const up = await admin.storage.from("media").upload(path, buf, {
        contentType,
        upsert: true,
      });
      if (up.error) throw new Error(up.error.message);

      const { error: updErr } = await admin
        .from("sites")
        .update({ cover_url: path } as never)
        .eq("id", site.id);
      if (updErr) throw new Error(updErr.message);

      migrated++;
    } catch (e) {
      failures.push({ id: site.id, reason: e instanceof Error ? e.message : String(e) });
    }
  }

  const { count: remaining } = await admin
    .from("sites")
    .select("*", { count: "exact", head: true })
    .like("cover_url", "http%");

  return NextResponse.json({ migrated, failures, remaining: remaining ?? 0 });
}
