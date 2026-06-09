import { notFound } from "next/navigation";
import { EstimateDetailContent } from "@/components/budget-ai/EstimateDetailContent";
import { ObraSidebar } from "@/components/layout/ObraSidebar";
import { VISIBLE_SOURCE_PROVIDERS } from "@/lib/rdo-source-scope";
import { createServerSupabase } from "@/lib/supabase/server";
import { untypedDb } from "@/lib/supabase/untyped";

type Site = {
  id: string;
  name: string;
  cover_url: string | null;
};

export default async function ObraOrcamentoIaDetailPage({
  params,
}: {
  params: Promise<{ id: string; estimateId: string }>;
}) {
  const { id, estimateId } = await params;
  const supabase = await createServerSupabase();
  const db = untypedDb(supabase);

  const { data: siteRaw } = await supabase
    .from("sites")
    .select("id, name, cover_url")
    .eq("id", id)
    .in("external_provider", VISIBLE_SOURCE_PROVIDERS)
    .maybeSingle();
  const site = siteRaw as Site | null;
  if (!site) notFound();

  const [
    { count: estimatesCount },
    { count: reportsCount },
    { count: tasksCount },
    { count: photosCount },
    { count: videosCount },
    { count: filesCount },
  ] = await Promise.all([
    db
      .from("ai_estimates")
      .select("id", { count: "exact", head: true })
      .eq("site_id", id),
    supabase
      .from("daily_reports")
      .select("id", { count: "exact", head: true })
      .eq("site_id", id)
      .in("external_provider", VISIBLE_SOURCE_PROVIDERS),
    supabase
      .from("wbs_items")
      .select("id", { count: "exact", head: true })
      .eq("site_id", id)
      .in("external_provider", VISIBLE_SOURCE_PROVIDERS)
      .not("parent_id", "is", null),
    supabase
      .from("media")
      .select("id", { count: "exact", head: true })
      .eq("site_id", id)
      .in("external_provider", VISIBLE_SOURCE_PROVIDERS)
      .eq("kind", "photo"),
    supabase
      .from("media")
      .select("id", { count: "exact", head: true })
      .eq("site_id", id)
      .in("external_provider", VISIBLE_SOURCE_PROVIDERS)
      .eq("kind", "video"),
    supabase
      .from("media")
      .select("id", { count: "exact", head: true })
      .eq("site_id", id)
      .in("external_provider", VISIBLE_SOURCE_PROVIDERS)
      .eq("kind", "file"),
  ]);

  return (
    <div className="do-obra-layout">
      <ObraSidebar
        site={site}
        active="budget"
        counts={{
          reports: reportsCount ?? 0,
          tasks: tasksCount ?? 0,
          photos: photosCount ?? 0,
          videos: videosCount ?? 0,
          files: filesCount ?? 0,
          estimates: estimatesCount ?? 0,
        }}
      />

      <main className="do-obra-main">
        <EstimateDetailContent
          estimateId={estimateId}
          expectedSiteId={id}
          backHrefOverride={`/obras/${id}/orcamento-ia`}
          backLabelOverride={`← Orçamento IA · ${site.name}`}
        />
      </main>
    </div>
  );
}
