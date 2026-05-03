import Link from "next/link";
import { createServerSupabase } from "@/lib/supabase/server";
import { mediaUrl } from "@/lib/storage";
import { OnboardingBanner } from "@/components/OnboardingBanner";

function greeting(): string {
  const h = new Date().getHours();
  if (h < 5) return "Boa noite";
  if (h < 12) return "Bom dia";
  if (h < 18) return "Boa tarde";
  return "Boa noite";
}

type SiteCard = { id: string; name: string; cover_url: string | null; status: string };

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
    .from("sites").select("*", { count: "exact", head: true });
  const { data: lateRows } = await supabase
    .from("wbs_items").select("site_id").eq("status", "late");
  const lateSiteIds = new Set(((lateRows ?? []) as { site_id: string }[]).map((r) => r.site_id));
  const { count: tasksInProgressCount } = await supabase
    .from("wbs_items").select("*", { count: "exact", head: true }).eq("status", "in_progress");
  const { count: rdosCount } = await supabase
    .from("daily_reports").select("*", { count: "exact", head: true });

  // 3 obras mais recentemente atualizadas pra hero visual
  const { data: recentSitesRaw } = await supabase
    .from("sites")
    .select("id, name, cover_url, status")
    .not("cover_url", "is", null)
    .neq("name", "AGENDAS (operacional)")
    .neq("name", "ATA SEMANAL (operacional)")
    .neq("name", "MEDIÇÕES (operacional)")
    .order("created_at", { ascending: false })
    .limit(6);
  const recentSites = (recentSitesRaw ?? []) as SiteCard[];

  const stats = [
    { label: "Obras", value: String(obrasCount ?? 0), href: "/obras" },
    { label: "RDOs registrados", value: String(rdosCount ?? 0), href: "/obras" },
    { label: "Atividades em curso", value: String(tasksInProgressCount ?? 0), href: "/tarefas?status=in_progress" },
    { label: "Em risco", value: String(lateSiteIds.size), href: "/obras?status=at-risk" },
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
                  <div
                    className="obra-card-cover"
                    style={{
                      backgroundImage: s.cover_url ? `url(${mediaUrl(s.cover_url)})` : undefined,
                    }}
                  >
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
