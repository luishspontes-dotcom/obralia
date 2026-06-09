import Link from "next/link";
import { notFound } from "next/navigation";
import { NewEstimateForm } from "@/app/(app)/orcamento-ia/novo/NewEstimateForm";
import { createServerSupabase } from "@/lib/supabase/server";
import { VISIBLE_SOURCE_PROVIDERS } from "@/lib/rdo-source-scope";
import { untypedDb } from "@/lib/supabase/untyped";

type Site = { id: string; name: string };

export default async function NovoOrcamentoIaObraPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createServerSupabase();
  const db = untypedDb(supabase);

  const { data: siteRaw } = await db
    .from("sites")
    .select("id, name")
    .eq("id", id)
    .in("external_provider", VISIBLE_SOURCE_PROVIDERS)
    .maybeSingle();
  const site = siteRaw as Site | null;
  if (!site) notFound();

  return (
    <div>
      <div className="page-hero">
        <div style={{ maxWidth: 1080, margin: "0 auto" }}>
          <Link href={`/obras/${id}/orcamento-ia`} style={{ color: "var(--o-text-2)", textDecoration: "none", fontSize: 13 }}>
            ← Orçamento IA · {site.name}
          </Link>
          <h1 style={{ margin: "14px 0 8px", font: "700 32px var(--font-inter)", letterSpacing: "-0.025em" }}>
            Novo orçamento da obra
          </h1>
          <p style={{ margin: 0, maxWidth: 720, color: "var(--o-text-2)", fontSize: 14 }}>
            Envie a planta da obra. O estudo já fica vinculado a {site.name}.
          </p>
        </div>
      </div>

      <div style={{ padding: "0 24px 40px", maxWidth: 1080, margin: "0 auto" }}>
        <NewEstimateForm sites={[site]} initialSiteId={site.id} lockSite />
      </div>
    </div>
  );
}
