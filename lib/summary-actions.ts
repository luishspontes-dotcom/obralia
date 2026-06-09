"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createServerSupabase } from "@/lib/supabase/server";
import { VISIBLE_SOURCE_PROVIDERS } from "@/lib/rdo-source-scope";
import { getCurrentRole, canWrite } from "@/lib/permissions";

type RdoRow = {
  id: string;
  number: number;
  date: string;
  weather_morning: string | null;
  weather_afternoon: string | null;
  condition_morning: string | null;
  condition_afternoon: string | null;
  general_notes: string | null;
};

type ActivityRow = { description: string; progress_pct: number | null; notes: string | null };
type WorkforceRow = { role: string; count: number };

type AnthropicContentBlock = { type: string; text?: string };
type AnthropicResponse = { content?: AnthropicContentBlock[] };

function asString(v: FormDataEntryValue | null): string {
  return typeof v === "string" ? v.trim() : "";
}

/**
 * Gera (ou regenera) o resumo do dia em linguagem leiga para o cliente,
 * usando a API da Anthropic, e salva em daily_reports.client_summary.
 */
export async function generateClientSummary(formData: FormData) {
  const supabase = await createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const role = await getCurrentRole();
  if (!canWrite(role)) throw new Error("Sem permissão para gerar resumo.");

  const rdoId = asString(formData.get("rdoId"));
  const siteId = asString(formData.get("siteId"));
  if (!rdoId || !siteId) throw new Error("rdoId e siteId são obrigatórios");

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error("IA não configurada — defina ANTHROPIC_API_KEY na Vercel");
  }

  // RDO (mesmo escopo de providers usado no detalhe do RDO)
  const { data: rdoRaw } = await supabase
    .from("daily_reports")
    .select("id, number, date, weather_morning, weather_afternoon, condition_morning, condition_afternoon, general_notes")
    .eq("id", rdoId)
    .eq("site_id", siteId)
    .in("external_provider", VISIBLE_SOURCE_PROVIDERS)
    .maybeSingle();
  const rdo = rdoRaw as RdoRow | null;
  if (!rdo) throw new Error("RDO não encontrado");

  const [actsR, wfR, siteR] = await Promise.all([
    supabase.from("report_activities").select("description, progress_pct, notes").eq("daily_report_id", rdoId),
    supabase.from("report_workforce").select("role, count").eq("daily_report_id", rdoId),
    supabase.from("sites").select("name").eq("id", siteId).maybeSingle(),
  ]);
  const activities = (actsR.data ?? []) as ActivityRow[];
  const workforce = (wfR.data ?? []) as WorkforceRow[];
  const siteName = (siteR.data as { name?: string } | null)?.name ?? "a obra";

  const dateLong = new Date(`${rdo.date}T00:00:00`).toLocaleDateString("pt-BR", {
    weekday: "long", day: "2-digit", month: "long", year: "numeric",
  });
  const totalWorkers = workforce.reduce((sum, w) => sum + (w.count ?? 0), 0);

  const linhasAtividades = activities.length > 0
    ? activities.map((a) => `- ${a.description} (avanço: ${a.progress_pct ?? 0}%)${a.notes ? ` — obs: ${a.notes}` : ""}`).join("\n")
    : "(nenhuma atividade registrada)";
  const linhasEquipe = workforce.length > 0
    ? workforce.map((w) => `- ${w.role}: ${w.count}`).join("\n")
    : "(efetivo não registrado)";

  const prompt = [
    `Escreva um resumo do dia da obra para o CLIENTE leigo, em português do Brasil, com tom cordial e objetivo, em 2-3 parágrafos, sem jargão técnico.`,
    `Cite o avanço dos trabalhos, o clima e a equipe presente. NÃO invente nada além dos dados fornecidos. Não mencione custos, valores ou nomes de pessoas.`,
    ``,
    `Dados do dia (RDO #${rdo.number} — ${dateLong} — obra "${siteName}"):`,
    ``,
    `Clima manhã: ${rdo.weather_morning ?? "não informado"}${rdo.condition_morning ? ` (condição de trabalho: ${rdo.condition_morning})` : ""}`,
    `Clima tarde: ${rdo.weather_afternoon ?? "não informado"}${rdo.condition_afternoon ? ` (condição de trabalho: ${rdo.condition_afternoon})` : ""}`,
    ``,
    `Atividades executadas:`,
    linhasAtividades,
    ``,
    `Equipe presente (total ${totalWorkers} pessoas):`,
    linhasEquipe,
    rdo.general_notes ? `\nObservações gerais do responsável: ${rdo.general_notes}` : "",
  ].join("\n");

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: process.env.ANTHROPIC_MODEL ?? "claude-sonnet-4-6",
      max_tokens: 600,
      messages: [{ role: "user", content: prompt }],
    }),
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`Falha ao gerar resumo com IA (HTTP ${res.status}). ${detail.slice(0, 200)}`);
  }

  const json = (await res.json()) as AnthropicResponse;
  const summary = (json.content ?? [])
    .filter((block) => block.type === "text" && typeof block.text === "string")
    .map((block) => block.text as string)
    .join("\n")
    .trim();
  if (!summary) throw new Error("A IA não retornou texto. Tente novamente.");

  const { error: upErr } = await supabase
    .from("daily_reports")
    .update({
      client_summary: summary,
      client_summary_generated_at: new Date().toISOString(),
    } as never)
    .eq("id", rdoId);
  if (upErr) throw new Error(upErr.message);

  revalidatePath(`/obras/${siteId}/rdos/${rdoId}`);
}
