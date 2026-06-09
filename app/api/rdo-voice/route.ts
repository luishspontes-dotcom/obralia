import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";

/* ── Shape devolvido ao cliente (espelhado em components/RdoVoiceAssist.tsx) ── */
type WfItem = { role: string; count: number };
type EqItem = { name: string; hours: number | null };
type AcItem = { description: string; progress_pct: number | null };
type MtItem = { name: string; quantity: number | null; unit: string | null };

type RdoVoiceData = {
  weather_morning: string | null;
  weather_afternoon: string | null;
  condition_morning: string | null;
  condition_afternoon: string | null;
  work_start: string | null;
  work_end: string | null;
  workforce: WfItem[];
  equipment: EqItem[];
  activities: AcItem[];
  materials: MtItem[];
  general_notes: string | null;
};

const CLIMAS = ["Claro", "Parcialmente nublado", "Nublado", "Chuvoso", "Garoa", "Sol forte"] as const;
const CONDICOES = ["Praticável", "Impraticável", "Parcial"] as const;

const MAX_TRANSCRIPT_CHARS = 12_000;

/* ── Rate limit em memória: 10 estruturações por usuário por hora.
 *    Reseta no cold-start do serverless — aceitável pra esse uso. ── */
const RATE_LIMIT_MAX = 10;
const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000; // 1h
const rateLimit = new Map<string, number[]>();

function checkRateLimit(userId: string): { ok: boolean; retryAfterSec?: number } {
  const now = Date.now();
  const recent = (rateLimit.get(userId) ?? []).filter((t) => now - t < RATE_LIMIT_WINDOW_MS);
  if (recent.length >= RATE_LIMIT_MAX) {
    const oldest = recent[0];
    return { ok: false, retryAfterSec: Math.ceil((RATE_LIMIT_WINDOW_MS - (now - oldest)) / 1000) };
  }
  recent.push(now);
  rateLimit.set(userId, recent);
  return { ok: true };
}

/* ── Prompt em pt-BR — responde APENAS JSON ── */
const SYSTEM_PROMPT = `Você estrutura Relatórios Diários de Obra (RDO) a partir do relato falado de um mestre de obras brasileiro.

Responda APENAS com um objeto JSON válido, sem markdown, sem comentários, sem texto antes ou depois, exatamente neste formato:
{
  "weather_morning": string|null,
  "weather_afternoon": string|null,
  "condition_morning": string|null,
  "condition_afternoon": string|null,
  "work_start": string|null,
  "work_end": string|null,
  "workforce": [{"role": string, "count": number}],
  "equipment": [{"name": string, "hours": number|null}],
  "activities": [{"description": string, "progress_pct": number|null}],
  "materials": [{"name": string, "quantity": number|null, "unit": string|null}],
  "general_notes": string|null
}

Regras:
- weather_morning/weather_afternoon: exatamente um de "Claro", "Parcialmente nublado", "Nublado", "Chuvoso", "Garoa", "Sol forte" — ou null se não mencionado. Mapeie sinônimos (ex: "céu aberto"/"sol" → "Claro"; "choveu forte" → "Chuvoso"; "chuvisco" → "Garoa"; "calorão"/"sol rachando" → "Sol forte").
- condition_morning/condition_afternoon: exatamente "Praticável", "Impraticável" ou "Parcial" — ou null.
- work_start/work_end: horário no formato "HH:MM" em 24h (ex: "das 7 às 5 da tarde" → "07:00" e "17:00") — ou null.
- workforce: funções e quantidades de pessoas (ex: "4 pedreiros e 2 serventes" → [{"role":"Pedreiro","count":4},{"role":"Servente","count":2}]). Capitalize a função.
- equipment: equipamentos usados, com horas de uso se ditas (senão hours: null).
- activities: o que foi executado, com progress_pct de 0 a 100 se mencionado percentual (senão null).
- materials: materiais recebidos/usados, com quantity numérica e unit (un, m², m³, kg, t, sc, br, l) quando mencionados, senão null.
- general_notes: tudo que foi relatado e NÃO couber nos campos acima (visitas, acidentes, paralisações, entregas atrasadas, recados etc.) — ou null se não sobrar nada.
- O que não for mencionado fica null (campos) ou [] (listas). NUNCA invente dados que não estão no relato.`;

/* ── Validação à mão (zod não está instalado) ── */
function asTrimmedString(v: unknown): string | null {
  return typeof v === "string" && v.trim() ? v.trim() : null;
}

function asEnum(v: unknown, allowed: readonly string[]): string | null {
  const s = asTrimmedString(v);
  return s !== null && allowed.includes(s) ? s : null;
}

function asTime(v: unknown): string | null {
  const s = asTrimmedString(v);
  if (!s) return null;
  const m = /^(\d{1,2}):(\d{2})/.exec(s);
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h > 23 || min > 59) return null;
  return `${String(h).padStart(2, "0")}:${String(min).padStart(2, "0")}`;
}

function asFiniteNumber(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && v.trim() !== "") {
    const n = Number(v.replace(",", "."));
    if (Number.isFinite(n)) return n;
  }
  return null;
}

function asRecordArray(v: unknown): Record<string, unknown>[] {
  if (!Array.isArray(v)) return [];
  return v.filter((item): item is Record<string, unknown> => typeof item === "object" && item !== null);
}

function sanitize(raw: unknown): RdoVoiceData {
  const obj = (typeof raw === "object" && raw !== null ? raw : {}) as Record<string, unknown>;

  const workforce: WfItem[] = asRecordArray(obj.workforce)
    .map((w) => ({
      role: asTrimmedString(w.role) ?? "",
      count: Math.max(0, Math.round(asFiniteNumber(w.count) ?? 0)),
    }))
    .filter((w) => w.role !== "" && w.count > 0)
    .slice(0, 30);

  const equipment: EqItem[] = asRecordArray(obj.equipment)
    .map((e) => {
      const hours = asFiniteNumber(e.hours);
      return {
        name: asTrimmedString(e.name) ?? "",
        hours: hours !== null && hours >= 0 ? hours : null,
      };
    })
    .filter((e) => e.name !== "")
    .slice(0, 30);

  const activities: AcItem[] = asRecordArray(obj.activities)
    .map((a) => {
      const pct = asFiniteNumber(a.progress_pct);
      return {
        description: asTrimmedString(a.description) ?? "",
        progress_pct: pct !== null ? Math.min(100, Math.max(0, Math.round(pct))) : null,
      };
    })
    .filter((a) => a.description !== "")
    .slice(0, 30);

  const materials: MtItem[] = asRecordArray(obj.materials)
    .map((m) => {
      const qty = asFiniteNumber(m.quantity);
      return {
        name: asTrimmedString(m.name) ?? "",
        quantity: qty !== null && qty >= 0 ? qty : null,
        unit: asTrimmedString(m.unit),
      };
    })
    .filter((m) => m.name !== "")
    .slice(0, 30);

  return {
    weather_morning: asEnum(obj.weather_morning, CLIMAS),
    weather_afternoon: asEnum(obj.weather_afternoon, CLIMAS),
    condition_morning: asEnum(obj.condition_morning, CONDICOES),
    condition_afternoon: asEnum(obj.condition_afternoon, CONDICOES),
    work_start: asTime(obj.work_start),
    work_end: asTime(obj.work_end),
    workforce,
    equipment,
    activities,
    materials,
    general_notes: asTrimmedString(obj.general_notes),
  };
}

/** Remove cercas ```/```json e isola o objeto JSON da resposta do modelo. */
function extractJson(text: string): unknown {
  let cleaned = text.trim();
  cleaned = cleaned.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim();
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) {
    throw new Error("Resposta da IA sem JSON");
  }
  return JSON.parse(cleaned.slice(start, end + 1)) as unknown;
}

type AnthropicContentBlock = { type: string; text?: string };
type AnthropicResponse = { content?: AnthropicContentBlock[] };

export async function POST(request: NextRequest) {
  /* 1. Body */
  let body: { transcript?: unknown };
  try {
    body = (await request.json()) as { transcript?: unknown };
  } catch {
    return NextResponse.json({ error: "Payload inválido." }, { status: 400 });
  }
  const transcript = typeof body.transcript === "string" ? body.transcript.trim() : "";
  if (!transcript) {
    return NextResponse.json({ error: "Transcrição vazia." }, { status: 400 });
  }
  if (transcript.length > MAX_TRANSCRIPT_CHARS) {
    return NextResponse.json({ error: "Transcrição longa demais." }, { status: 413 });
  }

  /* 2. Auth */
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Faça login para usar a IA." }, { status: 401 });
  }

  /* 3. Rate limit */
  const rate = checkRateLimit(user.id);
  if (!rate.ok) {
    const min = Math.ceil((rate.retryAfterSec ?? 60) / 60);
    return NextResponse.json(
      { error: `Muitas estruturações em pouco tempo. Tente de novo em ${min} min.` },
      { status: 429, headers: { "Retry-After": String(rate.retryAfterSec ?? 60) } }
    );
  }

  /* 4. IA configurada? */
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "IA não configurada" }, { status: 503 });
  }

  /* 5. Chamada à Anthropic */
  let aiText: string;
  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: process.env.ANTHROPIC_MODEL ?? "claude-sonnet-4-6",
        max_tokens: 1500,
        system: SYSTEM_PROMPT,
        messages: [
          {
            role: "user",
            content: `Relato falado do mestre de obras (transcrição automática, pode ter erros de pontuação):\n\n"""${transcript}"""`,
          },
        ],
      }),
    });
    if (!res.ok) {
      return NextResponse.json(
        { error: "O serviço de IA está indisponível no momento. Tente de novo em instantes." },
        { status: 502 }
      );
    }
    const data = (await res.json()) as AnthropicResponse;
    const textBlock = (data.content ?? []).find((b) => b.type === "text" && typeof b.text === "string");
    if (!textBlock?.text) {
      return NextResponse.json({ error: "A IA não retornou conteúdo. Tente de novo." }, { status: 502 });
    }
    aiText = textBlock.text;
  } catch {
    return NextResponse.json(
      { error: "Falha ao falar com o serviço de IA. Tente de novo." },
      { status: 502 }
    );
  }

  /* 6. Parse defensivo + validação de shape */
  try {
    const parsed = extractJson(aiText);
    return NextResponse.json({ data: sanitize(parsed) });
  } catch {
    return NextResponse.json(
      { error: "A IA respondeu num formato inesperado. Tente estruturar de novo." },
      { status: 502 }
    );
  }
}
