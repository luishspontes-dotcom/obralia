import Link from "next/link";
import { notFound } from "next/navigation";
import { Calculator, FileText, Plus, Sparkles } from "lucide-react";
import { ObraSidebar } from "@/components/layout/ObraSidebar";
import { DeleteEstimateButton } from "@/components/budget-ai/DeleteEstimateButton";
import { createServerSupabase } from "@/lib/supabase/server";
import { VISIBLE_SOURCE_PROVIDERS } from "@/lib/rdo-source-scope";
import { untypedDb } from "@/lib/supabase/untyped";

type Site = {
  id: string;
  name: string;
  cover_url: string | null;
};

type Estimate = {
  id: string;
  title: string;
  client_name: string | null;
  built_area_m2: number | null;
  pool_area_m2: number | null;
  status: string;
  total: number;
  confidence_score: number;
  created_at: string | null;
};

const BRL = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const NUM = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 2 });

export default async function ObraOrcamentoIaPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
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
    { data: estimatesRaw },
    { count: reportsCount },
    { count: tasksCount },
    { count: photosCount },
    { count: videosCount },
    { count: filesCount },
  ] = await Promise.all([
    db
      .from("ai_estimates")
      .select("id, title, client_name, built_area_m2, pool_area_m2, status, total, confidence_score, created_at")
      .eq("site_id", id)
      .order("created_at", { ascending: false }),
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

  const estimates = (estimatesRaw ?? []) as Estimate[];
  const reviewCount = estimates.filter((estimate) => estimate.status !== "approved").length;
  const verifiedEstimates = estimates.filter((estimate) => estimate.status === "approved" && Number(estimate.confidence_score ?? 0) >= 1);
  const verifiedTotal = verifiedEstimates.reduce((sum, estimate) => sum + Number(estimate.total ?? 0), 0);

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
          estimates: estimates.length,
        }}
      />

      <main className="do-obra-main">
        <div className="diario-container">
          <div className="diario-page-header">
            <div>
              <h1>Orçamento IA</h1>
              <p>{site.name} · estudos e orçamento preliminar da obra</p>
            </div>
            <Link href={`/obras/${id}/orcamento-ia/novo`} className="diario-blue-button" style={{ textDecoration: "none" }}>
              <Plus size={16} />
              Novo orçamento
            </Link>
          </div>

          <div className="stat-grid ai-budget-metrics-grid" style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: 12, marginBottom: 18 }}>
            <Metric icon={<FileText size={18} />} label="Estudos" value={String(estimates.length)} />
            <Metric icon={<Sparkles size={18} />} label="Para revisar" value={String(reviewCount)} />
            <Metric icon={<Calculator size={18} />} label="Verificados" value={String(verifiedEstimates.length)} />
            <Metric icon={<Calculator size={18} />} label="Pipeline verificado" value={BRL.format(verifiedTotal)} />
          </div>

          {estimates.length === 0 ? (
            <div className="empty">
              <div className="empty-emoji">📐</div>
              <div style={{ fontSize: 16, color: "var(--o-text-1)", marginBottom: 4, fontWeight: 600 }}>
                Esta obra ainda não tem orçamento IA
              </div>
              <div style={{ fontSize: 13, marginBottom: 16 }}>
                Crie o estudo a partir da planta para iniciar orçamento, memorial e validação técnica.
              </div>
              <Link href={`/obras/${id}/orcamento-ia/novo`} className="btn-brand" style={{ textDecoration: "none" }}>
                Criar orçamento da obra
              </Link>
            </div>
          ) : (
            <div className="card" style={{ padding: 0, overflow: "hidden" }}>
              {estimates.map((estimate, index) => (
                <div
                  key={estimate.id}
                  style={{
                    display: "grid",
                    gridTemplateColumns: "minmax(0, 1.5fr) 140px 140px 130px 46px",
                    gap: 14,
                    alignItems: "center",
                    padding: "16px 18px",
                    borderTop: index === 0 ? "none" : "1px solid var(--o-border)",
                    color: "inherit",
                  }}
                >
                  <Link href={`/obras/${id}/orcamento-ia/${estimate.id}`} style={{ minWidth: 0, textDecoration: "none", color: "inherit" }}>
                    <div style={{ fontWeight: 700, color: "var(--o-text-1)", letterSpacing: "-0.01em" }}>{estimate.title}</div>
                    <div style={{ fontSize: 12, color: "var(--o-text-2)", marginTop: 3 }}>
                      {[estimate.client_name, areaLabel(estimate)].filter(Boolean).join(" · ")}
                    </div>
                  </Link>
                  <StatusPill status={estimate.status} />
                  <div className="tnum" style={{ fontWeight: 700 }}>{BRL.format(Number(estimate.total ?? 0))}</div>
                  <div style={{ color: "var(--o-text-2)", fontSize: 12 }}>
                    Confiança {Math.round(Number(estimate.confidence_score ?? 0) * 100)}%
                  </div>
                  <DeleteEstimateButton estimateId={estimate.id} redirectTo={`/obras/${id}/orcamento-ia`} compact />
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

function Metric({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="stat-card">
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center", marginBottom: 8 }}>
        <div style={{ font: "600 11px var(--font-inter)", color: "var(--o-text-2)", textTransform: "uppercase", letterSpacing: "0.06em" }}>{label}</div>
        <span style={{ color: "var(--t-brand)" }}>{icon}</span>
      </div>
      <div className="tnum" style={{ font: "700 24px var(--font-inter)", color: "var(--o-text-1)", letterSpacing: "-0.02em" }}>{value}</div>
    </div>
  );
}

function StatusPill({ status }: { status: string }) {
  const meta: Record<string, { label: string; color: string; bg: string }> = {
    draft: { label: "Rascunho", color: "var(--o-text-2)", bg: "var(--o-soft)" },
    processing: { label: "Processando", color: "var(--t-brand)", bg: "var(--t-brand-mist)" },
    review: { label: "Revisar", color: "var(--o-accent)", bg: "var(--o-accent-soft)" },
    approved: { label: "Aprovado", color: "var(--st-done)", bg: "rgba(90,141,140,.12)" },
    failed: { label: "Falhou", color: "var(--st-late)", bg: "rgba(180,61,61,.12)" },
  };
  const current = meta[status] ?? meta.draft;
  return (
    <span style={{ justifySelf: "start", color: current.color, background: current.bg, borderRadius: 999, padding: "5px 10px", font: "600 12px var(--font-inter)" }}>
      {current.label}
    </span>
  );
}

function areaLabel(estimate: Estimate): string {
  const values = [];
  if (estimate.built_area_m2) values.push(`${NUM.format(estimate.built_area_m2)} m2`);
  if (estimate.pool_area_m2) values.push(`piscina ${NUM.format(estimate.pool_area_m2)} m2`);
  return values.join(" · ");
}
