/**
 * Helpers do lado Evolution API v2:
 * parse do payload de webhook (messages.upsert, com webhook_base64)
 * e envio de resposta curta de confirmação ao remetente.
 */

export type WhatsAppKind = "text" | "audio" | "image" | "video" | "document" | "other";

type EvolutionKey = {
  remoteJid?: unknown;
  fromMe?: unknown;
  id?: unknown;
};

type EvolutionMessage = {
  conversation?: unknown;
  extendedTextMessage?: { text?: unknown };
  audioMessage?: { mimetype?: unknown };
  imageMessage?: { caption?: unknown; mimetype?: unknown };
  videoMessage?: { caption?: unknown; mimetype?: unknown };
  documentMessage?: { fileName?: unknown; caption?: unknown; mimetype?: unknown };
  base64?: unknown;
};

export type EvolutionWebhookPayload = {
  event?: unknown;
  instance?: unknown;
  data?: {
    key?: EvolutionKey;
    pushName?: unknown;
    message?: EvolutionMessage;
    messageType?: unknown;
  };
};

export type ParsedInbound = {
  externalId: string;
  remoteJid: string;
  isGroup: boolean;
  fromMe: boolean;
  phone: string; // só dígitos
  pushName: string | null;
  kind: WhatsAppKind;
  text: string | null; // conversation / extendedTextMessage / caption
  base64: string | null; // mídia (webhook_base64 habilitado)
  mimetype: string | null;
};

function str(v: unknown): string | null {
  return typeof v === "string" && v.trim() ? v.trim() : null;
}

/** Normaliza telefone: só dígitos (ex: "5541999998888"). */
export function normalizePhone(raw: string): string {
  return raw.replace(/\D/g, "");
}

/** Extrai os campos relevantes do payload messages.upsert. Retorna null se não for uma mensagem reconhecível. */
export function parseInbound(payload: EvolutionWebhookPayload): ParsedInbound | null {
  const data = payload.data;
  if (!data || typeof data !== "object") return null;

  const key = data.key ?? {};
  const remoteJid = str(key.remoteJid);
  const externalId = str(key.id);
  if (!remoteJid || !externalId) return null;

  const msg = data.message ?? {};
  const conversation = str(msg.conversation);
  const extended = str(msg.extendedTextMessage?.text);
  const base64 = str(msg.base64);

  let kind: WhatsAppKind = "other";
  let text: string | null = null;
  let mimetype: string | null = null;

  if (msg.audioMessage && typeof msg.audioMessage === "object") {
    kind = "audio";
    mimetype = str(msg.audioMessage.mimetype);
  } else if (msg.imageMessage && typeof msg.imageMessage === "object") {
    kind = "image";
    text = str(msg.imageMessage.caption);
    mimetype = str(msg.imageMessage.mimetype);
  } else if (msg.videoMessage && typeof msg.videoMessage === "object") {
    kind = "video";
    text = str(msg.videoMessage.caption);
    mimetype = str(msg.videoMessage.mimetype);
  } else if (msg.documentMessage && typeof msg.documentMessage === "object") {
    kind = "document";
    text = str(msg.documentMessage.caption) ?? str(msg.documentMessage.fileName);
    mimetype = str(msg.documentMessage.mimetype);
  } else if (conversation || extended) {
    kind = "text";
    text = conversation ?? extended;
  }

  return {
    externalId,
    remoteJid,
    isGroup: remoteJid.endsWith("@g.us"),
    fromMe: key.fromMe === true,
    phone: normalizePhone(remoteJid.split("@")[0] ?? ""),
    pushName: str(data.pushName),
    kind,
    text,
    base64,
    mimetype,
  };
}

/**
 * Envia uma resposta curta de texto ao remetente via Evolution API.
 * No-op silencioso se as envs não estiverem configuradas; nunca lança.
 */
export async function sendWhatsAppReply(phone: string, text: string): Promise<void> {
  const baseUrl = process.env.EVOLUTION_API_URL;
  const apiKey = process.env.EVOLUTION_API_KEY;
  const instance = process.env.EVOLUTION_INSTANCE;
  if (!baseUrl || !apiKey || !instance) return;

  try {
    await fetch(`${baseUrl.replace(/\/$/, "")}/message/sendText/${instance}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: apiKey,
      },
      body: JSON.stringify({ number: phone, text }),
    });
  } catch {
    // Falha de resposta não derruba o processamento.
  }
}
