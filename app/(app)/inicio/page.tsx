import Link from "next/link";
import { createServerSupabase } from "@/lib/supabase/server";
import { VISIBLE_SOURCE_PROVIDERS } from "@/lib/rdo-source-scope";
import { mediaUrl } from "@/lib/storage";
import { OnboardingBanner } from "@/components/OnboardingBanner";
import { RiskBadge } from "@/components/RiskBadge";
import { recomputeAllRisks, type RiskFactor } from "@/lib/risk";
import { canManageUsers, getCurrentRole } from "@/lib/permissions";
import { untypedDb } from "@/lib/supabase/untyped";

function greeting(): string {
  const h = new Date().getHours();
  if (h < 5) return "Boa noite";
  if (h < 12) return "Bom dia";
  if (h < 18) return "Boa tarde";
  return "Boa noite";
}

type SiteCard = { id: string; name: string; cover_url: string | null; status: string };

type RiskSiteRow = {
  id: string;
  name: string;
  status: string;
  risk_score: number | null;
  risk_factors: RiskFactor[] | null;
  risk_computed_at: string | null;
};

const OPERATIONAL_NAMES = new Set([
  "AGENDAS (operacional)",
  "ATA SEMANAL (operacional)",
  "MEDIÇÕES (operacional)",
]);

function mainFactor(factors: RiskFactor[] | null): string {
  if (!Array.isArray(factors) || factors.length === 0) return "";
  const top = [...factors].sort((a, b) => b.peso - a.peso)[0];
  return top && top.peso > 0 ? `${top.fator} (+${top.peso}): ${top.detalhe}` : "";
}

export default async function InicioPage() {
  const supabase = await createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();

  let fullName: string | null = null;
  if (user) {
    const { data: profile } = await supabase
      .from("profiles").select("full_name").eq("id", user.id).maybeSingle();
    fullName = (profile as { full_name?: string } | null)?.full_name ?? null;
  }

  const firstName = fullName?.split(" ")[0] ?? user?.email?.split("@")[0] ?? "";

  // Counts
  const { count: obrasCount } = await supabase
    .from("sites").select("*", { count: "exact", head: true }).in("external_provider", VISIBLE_SOURCE_PROVIDERS);
  const { count: tasksInProgressCount } = await supabase
    .from("wbs_items").select("*", { count: "exact", head: true }).in("external_provider", VISIBLE_SOURCE_PROVIDERS).eq("status", "in_progress");
  const { count: rdosCount } = await supabase
    .from("daily_reports").select("*", { count: "exact", head: true }).in("external_provider", VISIBLE_SOURCE_PROVIDERS);

  // 3 obras mais recentemente atualizadas pra hero visual
  const { data: recentSitesRaw } = await supabase
    .from("sites")
    .select("id, name, cover_url, status")
    .in("external_provider", VISIBLE_SOURCE_PROVIDERS)
    .not("cover_url", "is", null)
    .neq("name", "AGENDAS (operacional)")
    .neq("name", "ATA SEMANAL (operacional)")
    .neq("name", "MEDIÇÕES (operacional)")
    .order("created_at", { ascending: false })
    .limit(6);
  const recentSites = (recentSitesRaw ?? []) as SiteCard[];

  // Risco de atraso — score pré-calculado em sites.risk_score (lib/risk.ts)
  const db = untypedDb(supabase);
  const { data: riskRaw } = await db
    .from<RiskSiteRow[]>("sites")
    .select("id, name, status, risk_score, risk_factors, risk_computed_at")
    .in("external_provider", VISIBLE_SOURCE_PROVIDERS)
    .order("risk_score", { ascending: false, nullsFirst: false })
    .limit(60);
  const riskRows = ((riskRaw ?? []) as RiskSiteRow[]).filter((s) => !OPERATIONAL_NAMES.has(s.name));
  const hasComputedRisk = riskRows.some((s) => s.risk_computed_at != null);
  const riskSites = riskRows.filter(
    (s) =>
      s.risk_score != null &&
      s.risk_score >= 30 &&
      s.status !== "done" &&
      s.status !== "completed"
  );
  const topRiskSites = riskSites.slice(0, 5);

  const role = await getCurrentRole();
  const isAdmin = canManageUsers(role);

  const stats = [
    { label: "Obras", value: String(obrasCount ?? 0), href: "/obras" },
    { label: "RDOs registrados", value: String(rdosCount ?? 0), href: "/obras" },
    { label: "Atividades em curso", value: String(tasksInProgressCount ?? 0), href: "/tarefas?status=in_progress" },
    { label: "Em risco", value: String(riskSites.length), href: "#obras-em-risco" },
  ];

  return (
    <div>
      {/* HERO */}
      <div className="page-hero">
        <div style={{ maxWidth: 1280, margin: "0 auto" }}>
          <div
            style={{
              fontSize: 11,
              textTransform: "uppercase",
              letterSpacing: "0.12em",
              color: "var(--t-brand)",
              fontWeight: 600,
              marginBottom: 8,
            }}
          >
            Painel da operação
          </div>
          <h1
            style={{
              margin: "0 0 8px",
              font: "700 36px var(--font-inter)",
              letterSpacing: "-0.025em",
              color: "var(--o-text-1)",
            }}
          >
            {greeting()}, {firstName}.
          </h1>
          <p
            className="font-body-lora"
            style={{
              fontSize: 17,
              color: "var(--o-text-2)",
              lineHeight: 1.55,
              maxWidth: 640,
              margin: 0,
            }}
          >
            Resumo da operação. Use a barra lateral pra navegar pelas obras,
            RDOs e mensagens — ou clique direto numa obra abaixo.
          </p>
        </div>
      </div>

      <div style={{ padding: "0 24px 32px", maxWidth: 1280, margin: "0 auto" }}>
        <OnboardingBanner rdoCount={rdosCount ?? 0} siteCount={obrasCount ?? 0} />

        {/* Stats */}
        <div
          className="stat-grid reveal-stagger"
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(4, 1fr)",
            gap: 14,
            marginBottom: 32,
          }}
        >
          {stats.map((s) => (
            <Link key={s.label} href={s.href} className="stat-card">
              <div
                style={{
                  font: "500 11px var(--font-inter)",
                  color: "var(--o-text-2)",
                  textTransform: "uppercase",
                  letterSpacing: "0.06em",
                  marginBottom: 8,
                }}
              >
                {s.label}
              </div>
              <div
                className="tnum"
                style={{
                  font: "700 32px var(--font-inter)",
                  letterSpacing: "-0.025em",
                  color: "var(--o-text-1)",
                }}
              >
                {s.value}
              </div>
            </Link>
          ))}
        </div>

        {/* Obras em risco */}
        <section id="obras-em-risco" style={{ marginBottom: 32 }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 12,
              marginBottom: 14,
            }}
          >
            <h2 className="section-title" style={{ margin: 0 }}>
              🎯 Obras em risco
            </h2>
            {isAdmin && (
              <form action={recomputeAllRisks}>
                <button
                  type="submit"
                  className="chip"
                  style={{ cursor: "pointer", fontSize: 12.5 }}
                  title="Recalcula o risco de todas as obras ativas a partir dos dados históricos"
                >
                  ↺ Recalcular
                </button>
              </form>
            )}
          </div>

          {topRiskSites.length > 0 ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {topRiskSites.map((s) => (
                <Link
                  key={s.id}
                  href={`/obras/${s.id}`}
                  className="stat-card"
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 14,
                    padding: "14px 18px",
                  }}
                >
                  <span
                    className="tnum"
                    style={{
                      font: "700 24px var(--font-inter)",
                      letterSpacing: "-0.02em",
                      color: "var(--o-text-1)",
                      minWidth: 44,
                      textAlign: "center",
                    }}
                  >
                    {Math.round(s.risk_score ?? 0)}
                  </span>
                  <RiskBadge score={s.risk_score} />
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div
                      style={{
                        font: "600 14px var(--font-inter)",
                        color: "var(--o-text-1)",
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                      }}
                    >
                      {s.name}
                    </div>
                    <div
                      style={{
                        fontSize: 12.5,
                        color: "var(--o-text-2)",
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                      }}
                    >
                      {mainFactor(s.risk_factors) || "Risco calculado a partir dos dados históricos da obra."}
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <div
              className="stat-card"
              style={{ display: "flex", alignItems: "center", gap: 10, padding: "16px 20px" }}
            >
              <span style={{ fontSize: 18 }}>✅</span>
              <div>
                <div style={{ font: "600 14px var(--font-inter)", color: "var(--o-text-1)" }}>
                  Tudo no prumo
                </div>
                <div style={{ fontSize: 12.5, color: "var(--o-text-2)" }}>
                  {hasComputedRisk
                    ? "Nenhuma obra ativa com risco de atraso relevante (score ≥ 30)."
                    : isAdmin
                      ? "Risco ainda não calculado — clique em “↺ Recalcular” para analisar os dados históricos."
                      : "Risco ainda não calculado para as obras ativas."}
                </div>
              </div>
            </div>
          )}
        </section>

        {/* Obras em destaque */}
        {recentSites.length > 0 && (
          <>
            <div
              style={{
                display: "flex",
                alignItems: "baseline",
                justifyContent: "space-between",
                marginBottom: 14,
              }}
            >
              <h2 className="section-title" style={{ margin: 0 }}>
                Obras em andamento
              </h2>
              <Link
                href="/obras"
                style={{
                  fontSize: 13,
                  color: "var(--t-brand)",
                  textDecoration: "none",
                  fontWeight: 500,
                }}
              >
                Ver todas →
              </Link>
            </div>

            <div
              className="reveal-stagger"
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))",
                gap: 16,
              }}
            >
              {recentSites.map((s) => (
                <Link key={s.id} href={`/obras/${s.id}`} className="obra-card">
                  <div className="obra-card-cover">
                    {s.cover_url && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        className="obra-card-cover-img"
                        src={mediaUrl(s.cover_url)}
                        alt=""
                        loading="lazy"
                        decoding="async"
                      />
                    )}
                    <span className="status status-progress status-on-cover obra-card-status">
                      Em andamento
                    </span>
                  </div>
                  <div className="obra-card-body">
                    <div
                      style={{
                        font: "600 15px var(--font-inter)",
                        letterSpacing: "-0.01em",
                        color: "var(--o-text-1)",
                        marginBottom: 4,
                      }}
                    >
                      {s.name}
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
