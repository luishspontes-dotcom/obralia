import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { createAdminSupabase } from "@/lib/supabase/admin";
import { createServerSupabase } from "@/lib/supabase/server";
import { untypedDb } from "@/lib/supabase/untyped";
import { processAiEstimate } from "@/lib/budget-ai/process";

/**
 * Processamento assíncrono do Orçamento IA (leitura da planta pela Claude).
 *
 * Chamado pelo client component do detalhe do estudo logo após a criação
 * (ou no "Tentar de novo"). A análise leva 1 a 3 minutos, por isso roda
 * aqui com maxDuration 300 em vez de dentro da server action (que dava 504).
 *
 * Autenticação (aceita AMBOS):
 *  - header x-obralia-secret === WHATSAPP_WEBHOOK_SECRET (automação/retry externo); OU
 *  - sessão Supabase válida que enxerga o estudo via RLS (usuário logado da org).
 */

export const runtime = "nodejs";
export const maxDuration = 300;

type ProcessRequestBody = {
  estimateId?: unknown;
};

export async function POST(request: NextRequest) {
  let body: ProcessRequestBody;
  try {
    body = (await request.json()) as ProcessRequestBody;
  } catch {
    return NextResponse.json({ ok: false, message: "JSON inválido." }, { status: 400 });
  }

  const estimateId =
    typeof body.estimateId === "string" && body.estimateId.trim() ? body.estimateId.trim() : null;
  if (!estimateId) {
    return NextResponse.json({ ok: false, message: "estimateId obrigatório." }, { status: 400 });
  }

  const authorized = await isAuthorized(request, estimateId);
  if (!authorized) {
    return NextResponse.json({ ok: false, message: "Não autorizado." }, { status: 401 });
  }

  // Processa com o client admin: o trabalho pesado roda fora da sessão
  // (storage + escrita de status), independente de cookie expirar no meio.
  const admin = createAdminSupabase();
  const result = await processAiEstimate(untypedDb(admin), admin, estimateId);

  revalidatePath("/orcamento-ia");
  revalidatePath(`/orcamento-ia/${estimateId}`);

  if (result.ok) {
    return NextResponse.json(result, { status: 200 });
  }
  return NextResponse.json(result, { status: 422 });
}

async function isAuthorized(request: NextRequest, estimateId: string): Promise<boolean> {
  const secret = process.env.WHATSAPP_WEBHOOK_SECRET;
  const headerSecret = request.headers.get("x-obralia-secret");
  if (secret && headerSecret && headerSecret === secret) return true;

  try {
    const supabase = await createServerSupabase();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return false;

    // Se a sessão enxerga o estudo via RLS, pode processá-lo.
    const db = untypedDb(supabase);
    const { data } = await db
      .from("ai_estimates")
      .select("id")
      .eq("id", estimateId)
      .maybeSingle();
    return Boolean(data);
  } catch {
    return false;
  }
}
