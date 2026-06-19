"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createServerSupabase } from "@/lib/supabase/server";
import { untypedDb } from "@/lib/supabase/untyped";
import { MEDIA_SOURCE_PROVIDERS } from "@/lib/rdo-source-scope";
import { getCurrentRole, canWrite } from "@/lib/permissions";
import { mediaUrl } from "@/lib/storage";
import { AI_STAGES, AI_FLAGS, isAiStage, isAiFlag } from "@/lib/ai-photo-meta";

const BATCH_MAX = 50;
const MAX_IMAGE_BYTES = 4 * 1024 * 1024; // 4MB — limite prático da API de imagens
const DELAY_BETWEEN_PHOTOS_MS = 300;

type MediaRow = {
  id: string;
  storage_path: string | null;
  thumbnail_path: string | null;
  ai_analyzed_at: string | null;
};

type AnthropicContentBlock = { type: string; text?: string };
type AnthropicResponse = { content?: AnthropicContentBlock[] };

type ParsedAnalysis = {
  caption: string | null;
  stage: string | null;
  flags: string[];
};

export type AnalyzePhotosResult = {
  analyzed: number;
  skippedTooLarge: number;
  failed: number;
  total: number;
};

function asString(v: FormDataEntryValue | null): string {
  return typeof v === "string" ? v.trim() : "";
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

const ALLOWED_MEDIA_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"] as const;
type AllowedMediaType = (typeof ALLOWED_MEDIA_TYPES)[number];

function resolveMediaType(contentType: string | null, url: string): AllowedMediaType {
  const ct = (contentType ?? "").split(";")[0].trim().toLowerCase();
  const found = ALLOWED_MEDIA_TYPES.find((t) => t === ct);
  if (found) return found;
  const lower = url.toLowerCase().split("?")[0];
  if (lower.endsWith(".png")) return "image/png";
  if (lower.endsWith(".webp")) return "image/webp";
  if (lower.endsWith(".gif")) return "image/gif";
  return "image/jpeg";
}

/** Baixa a imagem; retorna null se inacessível, "too-large" se exceder o limite. */
async function fetchImage(url: string): Promise<{ base64: string; mediaType: AllowedMediaType } | "too-large" | null> {
  const res = await fetch(url, { cache: "no-store" }).catch(() => null);
  if (!res || !res.ok) return null;

  const declared = Number(res.headers.get("content-length") ?? "0");
  if (declared > MAX_IMAGE_BYTES) return "too-large";

  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.byteLength > MAX_IMAGE_BYTES) return "too-large";
  if (buf.byteLength === 0) return null;

  return { base64: buf.toString("base64"), mediaType: resolveMediaType(res.headers.get("content-type"), url) };
}

const PHOTO_PROMPT = [
  `Você analisa fotos de canteiro de obras no Brasil. Responda APENAS com um JSON válido, sem markdown e sem texto fora do JSON, neste formato:`,
  `{"caption": "legenda objetiva em 1 frase, em português do Brasil", "stage": "...", "flags": []}`,
  ``,
  `Regras:`,
  `- "caption": uma única frase curta e objetiva descrevendo o que aparece na foto (sem opinião, sem nomes de pessoas).`,
  `- "stage": exatamente UMA destas etapas da obra: ${AI_STAGES.join(", ")}. Use "outro" se não for possível identificar.`,
  `- "flags": array com zero ou mais alertas de segurança visíveis na foto, escolhidos SOMENTE dentre: ${AI_FLAGS.join(", ")}. Use [] se estiver tudo ok ou se não houver pessoas/risco visível. Só sinalize o que estiver claramente visível.`,
].join("\n");

/** Extrai e valida o JSON retornado pelo modelo (parse defensivo). */
function parseAnalysis(text: string): ParsedAnalysis | null {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) return null;

  let raw: unknown;
  try {
    raw = JSON.parse(text.slice(start, end + 1));
  } catch {
    return null;
  }
  if (typeof raw !== "object" || raw === null) return null;

  const obj = raw as Record<string, unknown>;

  const caption = typeof obj.caption === "string" && obj.caption.trim()
    ? obj.caption.trim().slice(0, 300)
    : null;

  const stageRaw = typeof obj.stage === "string" ? obj.stage.trim().toLowerCase() : "";
  const stage = stageRaw ? (isAiStage(stageRaw) ? stageRaw : "outro") : null;

  const flags = Array.isArray(obj.flags)
    ? obj.flags
        .filter((f): f is string => typeof f === "string")
        .map((f) => f.trim().toLowerCase())
        .filter(isAiFlag)
    : [];

  if (!caption && !stage) return null;
  return { caption, stage, flags: Array.from(new Set(flags)) };
}

async function analyzeOne(
  apiKey: string,
  model: string,
  base64: string,
  mediaType: AllowedMediaType,
): Promise<ParsedAnalysis | null> {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model,
      max_tokens: 300,
      messages: [
        {
          role: "user",
          content: [
            { type: "image", source: { type: "base64", media_type: mediaType, data: base64 } },
            { type: "text", text: PHOTO_PROMPT },
          ],
        },
      ],
    }),
  });
  if (!res.ok) return null;

  const json = (await res.json()) as AnthropicResponse;
  const text = (json.content ?? [])
    .filter((block) => block.type === "text" && typeof block.text === "string")
    .map((block) => block.text as string)
    .join("\n")
    .trim();
  if (!text) return null;

  return parseAnalysis(text);
}

/**
 * Analisa fotos da obra com IA (visão): gera legenda, etapa e alertas de
 * segurança, e salva em media.ai_caption / ai_stage / ai_flags / ai_analyzed_at.
 *
 * FormData:
 * - siteId (obrigatório)
 * - photoIds (opcional, csv de ids) OU rdoId (opcional) — sem ambos, pega o lote pendente da obra
 * - batch (opcional, máx 50)
 * - force ("1" reanalisa fotos já analisadas)
 * - redirectTo ("fotos" volta pra galeria com feedback)
 */
export async function analyzePhotos(formData: FormData): Promise<AnalyzePhotosResult> {
  const supabase = await createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const role = await getCurrentRole();
  if (!canWrite(role)) throw new Error("Sem permissão para analisar fotos.");

  const siteId = asString(formData.get("siteId"));
  if (!siteId) throw new Error("siteId é obrigatório");
  const photoIdsCsv = asString(formData.get("photoIds"));
  const rdoId = asString(formData.get("rdoId"));
  const force = asString(formData.get("force")) === "1";
  const batchRaw = parseInt(asString(formData.get("batch")) || String(BATCH_MAX), 10);
  const batch = Math.min(BATCH_MAX, Math.max(1, Number.isFinite(batchRaw) ? batchRaw : BATCH_MAX));
  const redirectTo = asString(formData.get("redirectTo"));

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error("IA não configurada — defina ANTHROPIC_API_KEY na Vercel");
  }
  // Haiku por padrão: análise em lote precisa de custo baixo.
  const model = process.env.ANTHROPIC_PHOTO_MODEL ?? "claude-haiku-4-5-20251001";

  const db = untypedDb(supabase);
  let query = db.from<MediaRow[]>("media")
    .select("id, storage_path, thumbnail_path, ai_analyzed_at")
    .eq("site_id", siteId)
    .eq("kind", "photo")
    .in("external_provider", MEDIA_SOURCE_PROVIDERS);

  if (photoIdsCsv) {
    const ids = photoIdsCsv.split(",").map((s) => s.trim()).filter(Boolean).slice(0, batch);
    if (ids.length === 0) throw new Error("Nenhuma foto informada.");
    query = query.in("id", ids);
  } else if (rdoId) {
    query = query.eq("daily_report_id", rdoId);
  }
  if (!force) query = query.is("ai_analyzed_at", null);

  const { data, error } = await query
    .order("taken_at", { ascending: false, nullsFirst: false })
    .limit(batch);
  if (error) throw new Error(error.message);

  const photos = data ?? [];
  const result: AnalyzePhotosResult = { analyzed: 0, skippedTooLarge: 0, failed: 0, total: photos.length };

  for (let i = 0; i < photos.length; i++) {
    const photo = photos[i];
    try {
      const url = mediaUrl(photo.storage_path);
      if (!url) {
        result.failed += 1;
        continue;
      }

      // Original >4MB? Tenta a thumbnail antes de desistir.
      let image = await fetchImage(url);
      if (image === "too-large" && photo.thumbnail_path && photo.thumbnail_path !== photo.storage_path) {
        const thumbUrl = mediaUrl(photo.thumbnail_path);
        if (thumbUrl) image = await fetchImage(thumbUrl);
      }

      if (image === "too-large") {
        // Marca como analisada (sem etapa/alertas) pra não reprocessar a cada lote.
        await db.from("media")
          .update({
            ai_caption: "Imagem muito grande para análise automática (>4MB)",
            ai_stage: null,
            ai_flags: [],
            ai_analyzed_at: new Date().toISOString(),
          })
          .eq("id", photo.id);
        result.skippedTooLarge += 1;
        continue;
      }
      if (!image) {
        result.failed += 1;
        continue;
      }

      const analysis = await analyzeOne(apiKey, model, image.base64, image.mediaType);
      if (!analysis) {
        result.failed += 1;
        continue;
      }

      const { error: upErr } = await db.from("media")
        .update({
          ai_caption: analysis.caption,
          ai_stage: analysis.stage,
          ai_flags: analysis.flags,
          ai_analyzed_at: new Date().toISOString(),
        })
        .eq("id", photo.id);
      if (upErr) {
        result.failed += 1;
        continue;
      }
      result.analyzed += 1;
    } catch {
      result.failed += 1;
    } finally {
      // Sequencial com respiro pra não estourar rate limit da API.
      if (i < photos.length - 1) await sleep(DELAY_BETWEEN_PHOTOS_MS);
    }
  }

  revalidatePath(`/obras/${siteId}/fotos`);
  if (rdoId) revalidatePath(`/obras/${siteId}/rdos/${rdoId}`);

  if (redirectTo === "fotos") {
    const sp = new URLSearchParams({ ia: String(result.analyzed) });
    if (result.failed > 0) sp.set("iaerr", String(result.failed));
    if (result.skippedTooLarge > 0) sp.set("iagrande", String(result.skippedTooLarge));
    redirect(`/obras/${siteId}/fotos?${sp.toString()}`);
  }
  return result;
}
