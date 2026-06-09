import { NextRequest, NextResponse } from "next/server";
import { createAdminSupabase } from "@/lib/supabase/admin";
import { untypedDb } from "@/lib/supabase/untyped";
import { OBRALIA_SOURCE_PROVIDER } from "@/lib/rdo-source-scope";
import {
  parseInbound,
  sendWhatsAppReply,
  type EvolutionWebhookPayload,
  type ParsedInbound,
} from "@/lib/whatsapp/evolution";
import { structureRdoTranscript } from "@/lib/whatsapp/structure";
import {
  appendToGeneralNotes,
  applyStructuredToRdo,
  getOrCreateTodayWhatsappRdo,
  type AdminClient,
  type TodayRdo,
} from "@/lib/whatsapp/rdo";

/**
 * Webhook público da Evolution API v2 (evento messages.upsert, webhook_base64).
 * Protegido pelo header x-obralia-secret === WHATSAPP_WEBHOOK_SECRET.
 *
 * IMPORTANTE: a Evolution reenvia o webhook em respostas não-200, então depois
 * da autenticação TUDO responde 200 — erros ficam registrados em whatsapp_messages.
 */

export const runtime = "nodejs";
export const maxDuration = 60;

const MAX_BODY_BYTES = 25 * 1024 * 1024; // 25MB

type Sender = {
  id: string;
  organization_id: string;
  phone: string;
  display_name: string | null;
  profile_id: string | null;
  default_site_id: string | null;
  active: boolean;
};

function ok(body: Record<string, unknown>) {
  return NextResponse.json(body, { status: 200 });
}

/* ── Transcrição via OpenAI Whisper ── */
async function transcribeAudio(bytes: Uint8Array, mimetype: string | null): Promise<string> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OPENAI_API_KEY ausente");

  const type = (mimetype ?? "audio/ogg").split(";")[0].trim();
  const ext = type.includes("mpeg") ? "mp3" : type.includes("mp4") ? "m4a" : type.includes("wav") ? "wav" : "ogg";

  const form = new FormData();
  const buf = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
  form.append("file", new Blob([buf], { type }), `audio.${ext}`);
  form.append("model", "whisper-1");
  form.append("language", "pt");

  const res = await fetch("https://api.openai.com/v1/audio/transcriptions", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}` },
    body: form,
  });
  if (!res.ok) throw new Error(`Transcrição falhou (HTTP ${res.status})`);
  const data = (await res.json()) as { text?: unknown };
  const text = typeof data.text === "string" ? data.text.trim() : "";
  if (!text) throw new Error("Transcrição vazia");
  return text;
}

function base64ToBytes(b64: string): Uint8Array {
  return new Uint8Array(Buffer.from(b64, "base64"));
}

async function getSiteName(admin: AdminClient, siteId: string): Promise<string> {
  const { data } = await admin.from("sites").select("name").eq("id", siteId).maybeSingle();
  return (data as { name?: string } | null)?.name ?? "obra";
}

function confirmationText(rdo: TodayRdo, siteName: string): string {
  return `✅ Registrado no RDO #${rdo.number} de hoje — ${siteName}`;
}

export async function POST(request: NextRequest) {
  /* 1. Autenticação por secret compartilhado */
  const secret = process.env.WHATSAPP_WEBHOOK_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "Webhook não configurado." }, { status: 503 });
  }
  if (request.headers.get("x-obralia-secret") !== secret) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  }

  /* 2. Limite de payload (25MB) + parse */
  const contentLength = Number(request.headers.get("content-length") ?? "0");
  if (contentLength > MAX_BODY_BYTES) {
    return ok({ action: "ignored", reason: "payload_too_large" });
  }
  let payload: EvolutionWebhookPayload;
  try {
    const raw = await request.text();
    if (raw.length > MAX_BODY_BYTES) {
      return ok({ action: "ignored", reason: "payload_too_large" });
    }
    payload = JSON.parse(raw) as EvolutionWebhookPayload;
  } catch {
    return ok({ action: "ignored", reason: "invalid_json" });
  }

  /* 3. Só processa messages.upsert */
  const event = typeof payload.event === "string" ? payload.event.toLowerCase().replace(/_/g, ".") : "";
  if (event !== "messages.upsert") {
    return ok({ action: "ignored", reason: "event" });
  }

  const inbound: ParsedInbound | null = parseInbound(payload);
  if (!inbound) return ok({ action: "ignored", reason: "unparseable" });
  if (inbound.fromMe) return ok({ action: "ignored", reason: "from_me" });
  if (inbound.isGroup) return ok({ action: "ignored", reason: "group" });
  if (!inbound.phone) return ok({ action: "ignored", reason: "no_phone" });

  const admin = createAdminSupabase();
  const db = untypedDb(admin);

  /* 4. Dedupe por external_id (Evolution reenvia webhooks) */
  try {
    const { data: dup } = await db
      .from<{ id: string }>("whatsapp_messages")
      .select("id")
      .eq("external_id", inbound.externalId)
      .limit(1)
      .maybeSingle();
    if (dup) return ok({ action: "duplicate" });
  } catch {
    // segue — pior caso é registrar de novo
  }

  /* 5. Remetente cadastrado e ativo? */
  let sender: Sender | null = null;
  try {
    const { data } = await db
      .from<Sender>("whatsapp_senders")
      .select("id, organization_id, phone, display_name, profile_id, default_site_id, active")
      .eq("phone", inbound.phone)
      .eq("active", true)
      .limit(1)
      .maybeSingle();
    sender = data;
  } catch {
    sender = null;
  }

  if (!sender) {
    try {
      await db.from("whatsapp_messages").insert({
        organization_id: null,
        sender_id: null,
        site_id: null,
        from_phone: inbound.phone,
        kind: inbound.kind,
        body: inbound.text,
        status: "ignored",
        error: "Remetente não cadastrado ou inativo",
        external_id: inbound.externalId,
        processed_at: new Date().toISOString(),
      });
    } catch {
      // sem org não dá pra registrar se a coluna for NOT NULL — só ignora
    }
    return ok({ action: "ignored", reason: "unknown_sender" });
  }

  /* 6. Registra a mensagem (status received) */
  let messageId: string | null = null;
  try {
    const { data: inserted, error: insErr } = await db
      .from<{ id: string }>("whatsapp_messages")
      .insert({
        organization_id: sender.organization_id,
        sender_id: sender.id,
        site_id: sender.default_site_id,
        from_phone: inbound.phone,
        kind: inbound.kind,
        body: inbound.text,
        status: "received",
        external_id: inbound.externalId,
      })
      .select("id")
      .single();
    if (insErr || !inserted) throw new Error(insErr?.message ?? "insert falhou");
    messageId = inserted.id;
  } catch {
    return ok({ action: "error", reason: "message_insert_failed" });
  }

  const setMessage = async (patch: Record<string, unknown>) => {
    try {
      await db.from("whatsapp_messages").update(patch).eq("id", messageId);
    } catch {
      // não derruba o fluxo
    }
  };

  /* 7. Sem obra padrão não tem onde lançar */
  const siteId = sender.default_site_id;
  if (!siteId) {
    await setMessage({
      status: "error",
      error: "Remetente sem obra padrão configurada",
      processed_at: new Date().toISOString(),
    });
    await sendWhatsAppReply(
      inbound.phone,
      "⚠️ Seu número está cadastrado, mas sem obra padrão. Peça ao administrador para configurar em Configurações → WhatsApp."
    );
    return ok({ action: "error", reason: "no_default_site" });
  }

  /* 8. Processamento por tipo — erros viram status 'error', resposta segue 200 */
  try {
    if (inbound.kind === "text") {
      if (!inbound.text) throw new Error("Mensagem de texto vazia");
      const rdo = await getOrCreateTodayWhatsappRdo(admin, siteId, sender.profile_id);
      await appendToGeneralNotes(admin, rdo.id, inbound.text);
      await setMessage({
        status: "processed",
        daily_report_id: rdo.id,
        processed_at: new Date().toISOString(),
      });
      await sendWhatsAppReply(inbound.phone, confirmationText(rdo, await getSiteName(admin, siteId)));
      return ok({ action: "processed", kind: "text", daily_report_id: rdo.id });
    }

    if (inbound.kind === "audio") {
      if (!inbound.base64) throw new Error("Áudio sem mídia base64 (habilite webhook_base64 na Evolution)");
      if (!process.env.OPENAI_API_KEY) {
        await setMessage({
          status: "received",
          error: "OPENAI_API_KEY não configurada — áudio recebido mas não transcrito",
          processed_at: new Date().toISOString(),
        });
        await sendWhatsAppReply(
          inbound.phone,
          "⚠️ Áudio recebido, mas a transcrição não está configurada. Envie por texto ou avise o administrador."
        );
        return ok({ action: "received", kind: "audio", reason: "no_transcription" });
      }

      const transcript = await transcribeAudio(base64ToBytes(inbound.base64), inbound.mimetype);
      await setMessage({ transcript });

      const rdo = await getOrCreateTodayWhatsappRdo(admin, siteId, sender.profile_id);
      const structured = await structureRdoTranscript(transcript);
      if (structured) {
        await applyStructuredToRdo(admin, rdo.id, structured);
        if (
          !structured.general_notes &&
          structured.activities.length === 0 &&
          structured.workforce.length === 0 &&
          structured.materials.length === 0 &&
          structured.equipment.length === 0
        ) {
          // IA não extraiu nada — preserva o relato cru
          await appendToGeneralNotes(admin, rdo.id, transcript);
        }
      } else {
        // IA indisponível → anexa a transcrição crua
        await appendToGeneralNotes(admin, rdo.id, transcript);
      }

      await setMessage({
        status: "processed",
        daily_report_id: rdo.id,
        processed_at: new Date().toISOString(),
      });
      await sendWhatsAppReply(inbound.phone, confirmationText(rdo, await getSiteName(admin, siteId)));
      return ok({ action: "processed", kind: "audio", daily_report_id: rdo.id });
    }

    if (inbound.kind === "image") {
      if (!inbound.base64) throw new Error("Imagem sem mídia base64 (habilite webhook_base64 na Evolution)");
      const bytes = base64ToBytes(inbound.base64);
      const rdo = await getOrCreateTodayWhatsappRdo(admin, siteId, sender.profile_id);

      const mediaId = crypto.randomUUID();
      const storagePath = `${siteId}/whatsapp/${mediaId}.jpg`;
      const up = await admin.storage.from("media").upload(storagePath, bytes, {
        contentType: inbound.mimetype ?? "image/jpeg",
        upsert: false,
      });
      if (up.error) throw new Error(`Upload da foto falhou: ${up.error.message}`);

      const { error: mediaErr } = await admin.from("media").insert({
        id: mediaId,
        site_id: siteId,
        daily_report_id: rdo.id,
        kind: "photo",
        storage_path: storagePath,
        caption: inbound.text,
        size_bytes: bytes.byteLength,
        taken_at: new Date().toISOString(),
        taken_by: sender.profile_id,
        migrated_at: new Date().toISOString(),
        external_provider: OBRALIA_SOURCE_PROVIDER,
        sync_metadata: { via: "whatsapp" },
      } as never);
      if (mediaErr) throw new Error(`Registro da foto falhou: ${mediaErr.message}`);

      await setMessage({
        status: "processed",
        daily_report_id: rdo.id,
        media_path: storagePath,
        processed_at: new Date().toISOString(),
      });
      await sendWhatsAppReply(inbound.phone, confirmationText(rdo, await getSiteName(admin, siteId)));
      return ok({ action: "processed", kind: "image", daily_report_id: rdo.id });
    }

    /* video / document / other: registra mas ainda não processa */
    await setMessage({
      status: "received",
      processed_at: new Date().toISOString(),
    });
    await sendWhatsAppReply(
      inbound.phone,
      "⚠️ Por enquanto o bot entende texto, áudio e foto. Esse tipo de mensagem foi guardado, mas não entrou no RDO."
    );
    return ok({ action: "received", kind: inbound.kind });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erro desconhecido";
    await setMessage({
      status: "error",
      error: message.slice(0, 500),
      processed_at: new Date().toISOString(),
    });
    await sendWhatsAppReply(
      inbound.phone,
      "❌ Não consegui registrar sua mensagem no RDO agora. Tente de novo em instantes."
    );
    return ok({ action: "error", reason: "processing_failed" });
  }
}
