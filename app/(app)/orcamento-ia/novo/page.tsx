import Link from "next/link";
import { NewEstimateForm } from "./NewEstimateForm";
import { createServerSupabase } from "@/lib/supabase/server";
import { untypedDb } from "@/lib/supabase/untyped";

type Site = { id: string; name: string };

export default async function NovoOrcamentoIaPage() {
  const supabase = await createServerSupabase();
  const db = untypedDb(supabase);
  const { data: sitesRaw } = await db
    .from("sites")
    .select("id, name")
    .order("created_at", { ascending: false })
    .limit(200);
  const sites = (sitesRaw ?? []) as Site[];

  return (
    <div>
      <div className="page-hero">
        <div style={{ maxWidth: 1080, margin: "0 auto" }}>
          <Link href="/orcamento-ia" style={{ color: "var(--o-text-2)", textDecoration: "none", fontSize: 13 }}>
            ← Orçamento IA
          </Link>
          <h1 style={{ margin: "14px 0 8px", font: "700 32px var(--font-inter)", letterSpacing: "-0.025em" }}>
            Novo estudo de orçamento
          </h1>
          <p style={{ margin: 0, maxWidth: 720, color: "var(--o-text-2)", fontSize: 14 }}>
            Envie a planta como fonte principal. Memorial e planilha são opcionais; quando não existirem, o sistema usa leitura visual e o template detalhado para gerar orçamento e memorial preliminares.
          </p>
        </div>
      </div>

      <div style={{ padding: "0 24px 40px", maxWidth: 1080, margin: "0 auto" }}>
        <NewEstimateForm sites={sites} />
      </div>
    </div>
  );
}
