import Link from "next/link";
import { Calculator, FileText, Plus, Sparkles, SlidersHorizontal } from "lucide-react";
import { DeleteEstimateButton } from "@/components/budget-ai/DeleteEstimateButton";
import { createServerSupabase } from "@/lib/supabase/server";
import { untypedDb } from "@/lib/supabase/untyped";

type Profile = { default_org_id: string | null };
type Org = { id: string; name: string };
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
  site_id: string | null;
  sites: { name: string } | null;
};

const BRL = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const NUM = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 2 });

export default async function OrcamentoIaPage() {
  const supabase = await createServerSupabase();
  const db = untypedDb(supabase);
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: profileRaw } = await db
    .from("profiles")
    .select("default_org_id")
    .eq("id", user?.id)
    .maybeSingle();
  const profile = profileRaw as Profile | null;

  const { data: orgsRaw } = await db.from("organizations").select("id, name");
  const orgs = (orgsRaw ?? []) as Org[];
  const activeOrg = orgs.find((org) => org.id === profile?.default_org_id) ?? orgs[0] ?? null;

  const { data: estimatesRaw } = activeOrg
    ? await db
        .from("ai_estimates")
        .select("id, title, client_name, built_area_m2, pool_area_m2, status, total, confidence_score, created_at, site_id, sites(name)")
        .eq("organization_id", activeOrg.id)
        .order("created_at", { ascending: false })
        .limit(20)
    : { data: [] };
  const estimates = (estimatesRaw ?? []) as Estimate[];

  const reviewCount = estimates.filter((estimate) => estimate.status !== "approved").length;
  const verifiedEstimates = estimates.filter((estimate) => estimate.status === "approved" && Number(estimate.confidence_score ?? 0) >= 1);
  const totalVerifiedPipeline = verifiedEstimates.reduce((sum, estimate) => sum + Number(estimate.total ?? 0), 0);

  return (
    <div>
      <div className="page-hero">
        <div style={{ maxWidth: 1280, margin: "0 auto", display: "flex", justifyContent: "space-between", gap: 18, alignItems: "flex-end", flexWrap: "wrap" }}>
          <div>
            <div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "0.12em", color: "var(--t-brand)", fontWeight: 600, marginBottom: 8 }}>
              Central de limpeza
            </div>
            <h1 style={{ margin: "0 0 8px", font: "700 32px var(--font-inter)", letterSpacing: "-0.025em" }}>
              Orçamento IA
            </h1>
            <p style={{ margin: 0, maxWidth: 680, fontSize: 14, color: "var(--o-text-2)" }}>
              Use esta visão para revisar ou apagar estudos soltos. O orçamento principal fica dentro de cada obra.
            </p>
          </div>
          <div style={{ display: "inline-flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
            <Link href="/orcamento-ia/taxas" style={{ textDecoration: "none", display: "inline-flex", gap: 6, alignItems: "center", fontSize: 13, fontWeight: 600, color: "var(--o-text-2)", border: "1px solid var(--o-border)", borderRadius: 8, padding: "8px 14px" }}>
              <SlidersHorizontal size={15} /> Taxas (R$/m²)
            </Link>
            <Link href="/obras" className="btn-brand" style={{ textDecoration: "none", display: "inline-flex", gap: 8, alignItems: "center" }}>
              <Plus size={16} /> Escolher obra
            </Link>
          </div>
        </div>
      </div>

      <div style={{ padding: "0 24px 32px", maxWidth: 1280, margin: "0 auto" }}>
        <div className="stat-grid ai-budget-metrics-grid" style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: 12, marginBottom: 18 }}>
          <Metric icon={<FileText size={18} />} label="Estudos" value={String(estimates.length)} />
          <Metric icon={<Sparkles size={18} />} label="Para revisar" value={String(reviewCount)} />
          <Metric icon={<Calculator size={18} />} label="Verificados" value={String(verifiedEstimates.length)} />
          <Metric icon={<Calculator size={18} />} label="Pipeline verificado" value={BRL.format(totalVerifiedPipeline)} />
        </div>

        {estimates.length === 0 ? (
          <div className="empty">
            <div className="empty-emoji">📐</div>
            <div style={{ fontSize: 16, color: "var(--o-text-1)", marginBottom: 4, fontWeight: 600 }}>
              Nenhum estudo criado ainda
            </div>
            <div style={{ fontSize: 13, marginBottom: 16 }}>
              Envie uma planta, informe os parâmetros principais e gere o primeiro orçamento preliminar.
            </div>
            <Link href="/orcamento-ia/novo" className="btn-brand" style={{ textDecoration: "none" }}>
              Criar primeiro estudo
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
                <Link
                  href={estimate.site_id ? `/obras/${estimate.site_id}/orcamento-ia/${estimate.id}` : `/orcamento-ia/${estimate.id}`}
                  style={{ minWidth: 0, textDecoration: "none", color: "inherit" }}
                >
                  <div style={{ fontWeight: 700, color: "var(--o-text-1)", letterSpacing: "-0.01em" }}>{estimate.title}</div>
                  <div style={{ fontSize: 12, color: "var(--o-text-2)", marginTop: 3 }}>
                    {[estimate.sites?.name, estimate.client_name, areaLabel(estimate)].filter(Boolean).join(" · ")}
                  </div>
                </Link>
                <StatusPill status={estimate.status} />
                <div className="tnum" style={{ fontWeight: 700 }}>{BRL.format(Number(estimate.total ?? 0))}</div>
                <div style={{ color: "var(--o-text-2)", fontSize: 12 }}>
                  Confiança {Math.round(Number(estimate.confidence_score ?? 0) * 100)}%
                </div>
                <DeleteEstimateButton estimateId={estimate.id} redirectTo="/orcamento-ia" compact />
              </div>
            ))}
          </div>
        )}
      </div>
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
