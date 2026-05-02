import Link from "next/link";
import { createServerSupabase } from "@/lib/supabase/server";
import { mediaUrl } from "@/lib/storage";

type Site = {
  id: string;
  name: string;
  status: string;
  client_name: string | null;
  start_date: string | null;
  end_date: string | null;
  cover_url: string | null;
};

type WbsItem = {
  id: string;
  site_id: string;
  status: string | null;
  parent_id: string | null;
  progress_pct: number | null;
};

const STATUS_LABELS: Record<string, { label: string; cls: string }> = {
  in_progress: { label: "Em andamento", cls: "status-progress" },
  done: { label: "Concluída", cls: "status-done" },
  paused: { label: "Pausada", cls: "status-paused" },
  late: { label: "Em risco", cls: "status-late" },
  not_started: { label: "Não iniciada", cls: "status-paused" },
};

export default async function ObrasPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const supabase = await createServerSupabase();
  const { status: filterStatus } = await searchParams;

  const { data: sitesRaw } = await supabase
    .from("sites")
    .select("id, name, status, client_name, start_date, end_date, cover_url")
    .order("name");
  const sites = (sitesRaw ?? []) as Site[];

  const { data: itemsRaw } = await supabase
    .from("wbs_items")
    .select("id, site_id, status, parent_id, progress_pct");
  const items = (itemsRaw ?? []) as WbsItem[];

  const { data: rdoRowsRaw } = await supabase.from("daily_reports").select("site_id");
  const rdoRows = (rdoRowsRaw ?? []) as { site_id: string }[];
  const rdoCount = new Map<string, number>();
  for (const r of rdoRows) rdoCount.set(r.site_id, (rdoCount.get(r.site_id) ?? 0) + 1);

  const perSite = new Map<string, { total: number; done: number; late: number; in_progress: number; progressAvg: number }>();
  for (const it of items) {
    if (it.parent_id === null) continue;
    const cur = perSite.get(it.site_id) ?? { total: 0, done: 0, late: 0, in_progress: 0, progressAvg: 0 };
    cur.total += 1;
    if (it.status === "done") cur.done += 1;
    if (it.status === "late") cur.late += 1;
    if (it.status === "in_progress") cur.in_progress += 1;
    cur.progressAvg += it.progress_pct ?? 0;
    perSite.set(it.site_id, cur);
  }
  for (const s of perSite.values()) {
    s.progressAvg = s.total > 0 ? Math.round(s.progressAvg / s.total) : 0;
  }

  const visibleSites = sites.filter((s) => {
    const stats = perSite.get(s.id);
    if (filterStatus === "at-risk") return (stats?.late ?? 0) > 0;
    if (filterStatus === "done") return s.status === "done";
    if (filterStatus === "in_progress") return s.status === "in_progress";
    return true;
  });

  const totals = {
    obras: sites.length,
    atRisk: sites.filter((s) => (perSite.get(s.id)?.late ?? 0) > 0).length,
    inProgress: sites.filter((s) => s.status === "in_progress").length,
    done: sites.filter((s) => s.status === "done").length,
  };

  return (
    <div>
      {/* HERO */}
      <div className="page-hero">
        <div style={{ maxWidth: 1280, margin: "0 auto", display: "flex", alignItems: "flex-end", justifyContent: "space-between", flexWrap: "wrap", gap: 16 }}>
          <div>
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
              Portfolio
            </div>
            <h1
              style={{
                margin: "0 0 8px",
                font: "700 32px var(--font-inter)",
                letterSpacing: "-0.025em",
              }}
            >
              Obras
            </h1>
            <p style={{ margin: 0, fontSize: 14, color: "var(--o-text-2)" }}>
              {totals.obras} obras · {totals.inProgress} em andamento
              {totals.atRisk > 0 && (
                <>
                  {" · "}
                  <span style={{ color: "var(--st-late)", fontWeight: 500 }}>
                    {totals.atRisk} em risco
                  </span>
                </>
              )}
            </p>
          </div>

          <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
            <Link href="/obras" className={`chip ${!filterStatus ? "chip-active" : ""}`}>
              Todas
            </Link>
            <Link href="/obras?status=in_progress" className={`chip ${filterStatus === "in_progress" ? "chip-active" : ""}`}>
              <span style={{ width: 6, height: 6, borderRadius: 999, background: "var(--st-progress)" }} />
              Em andamento
            </Link>
            <Link href="/obras?status=at-risk" className={`chip ${filterStatus === "at-risk" ? "chip-active" : ""}`}>
              <span style={{ width: 6, height: 6, borderRadius: 999, background: "var(--st-late)" }} />
              Em risco
            </Link>
            <Link href="/obras?status=done" className={`chip ${filterStatus === "done" ? "chip-active" : ""}`}>
              <span style={{ width: 6, height: 6, borderRadius: 999, background: "var(--st-done)" }} />
              Concluídas
            </Link>
            <Link href="/obras/nova" className="btn-primary" style={{ marginLeft: 4 }}>
              + Nova obra
            </Link>
          </div>
        </div>
      </div>

      {/* GRID DE CARDS */}
      <div style={{ padding: "0 24px 32px", maxWidth: 1280, margin: "0 auto" }}>
        {visibleSites.length === 0 ? (
          <div className="empty">
            <div className="empty-emoji">🏗️</div>
            <div style={{ fontSize: 15, color: "var(--o-text-1)", marginBottom: 4 }}>
              Nenhuma obra encontrada com este filtro.
            </div>
            <div style={{ fontSize: 13 }}>
              Tente outro filtro acima ou cadastre uma nova obra.
            </div>
          </div>
        ) : (
          <div
            className="reveal-stagger"
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))",
              gap: 18,
            }}
          >
            {visibleSites.map((s) => {
              const stats = perSite.get(s.id) ?? { total: 0, done: 0, late: 0, in_progress: 0, progressAvg: 0 };
              const accentColor =
                stats.late > 0
                  ? "var(--st-late)"
                  : s.status === "done"
                  ? "var(--st-done)"
                  : "var(--t-brand)";
              const statusInfo = STATUS_LABELS[s.status] ?? STATUS_LABELS.in_progress;
              const isOperational = s.name.includes("(operacional)");
              return (
                <Link key={s.id} href={`/obras/${s.id}`} className="obra-card">
                  <div
                    className="obra-card-cover"
                    style={{
                      backgroundImage: s.cover_url ? `url(${mediaUrl(s.cover_url)})` : undefined,
                      ...(isOperational
                        ? {
                            background:
                              "linear-gradient(135deg, var(--t-brand-mist) 0%, var(--o-mist) 100%)",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            color: "var(--t-brand)",
                            fontSize: 36,
                          }
                        : {}),
                    }}
                  >
                    {isOperational && <span style={{ position: "relative", zIndex: 1 }}>📋</span>}
                    {!isOperational && (
                      <span className={`status ${statusInfo.cls} status-on-cover obra-card-status`}>
                        {statusInfo.label}
                      </span>
                    )}
                  </div>
                  <div className="obra-card-body">
                    {s.client_name && (
                      <div
                        style={{
                          fontSize: 11,
                          color: "var(--o-text-3)",
                          textTransform: "uppercase",
                          letterSpacing: "0.06em",
                          marginBottom: 4,
                          fontWeight: 500,
                        }}
                      >
                        {s.client_name}
                      </div>
                    )}
                    <div
                      style={{
                        font: "600 16px var(--font-inter)",
                        letterSpacing: "-0.01em",
                        color: "var(--o-text-1)",
                        marginBottom: 14,
                        lineHeight: 1.3,
                      }}
                    >
                      {s.name}
                    </div>

                    {/* Progresso */}
                    {stats.total > 0 && (
                      <>
                        <div
                          style={{
                            height: 5,
                            background: "var(--o-mist)",
                            borderRadius: 999,
                            overflow: "hidden",
                            marginBottom: 8,
                          }}
                        >
                          <div
                            style={{
                              width: `${stats.progressAvg}%`,
                              height: "100%",
                              background: accentColor,
                              transition: "width 600ms var(--ease-out)",
                              borderRadius: 999,
                            }}
                          />
                        </div>
                        <div
                          style={{
                            display: "flex",
                            justifyContent: "space-between",
                            fontSize: 12,
                            color: "var(--o-text-2)",
                            marginBottom: 12,
                          }}
                          className="tnum"
                        >
                          <span style={{ fontWeight: 500 }}>{stats.progressAvg}% concluído</span>
                          <span>
                            {stats.done}/{stats.total} atividades
                          </span>
                        </div>
                      </>
                    )}

                    {/* Métricas secundárias */}
                    <div style={{ display: "flex", gap: 12, fontSize: 11.5, color: "var(--o-text-3)", flexWrap: "wrap" }}>
                      {(rdoCount.get(s.id) ?? 0) > 0 && (
                        <span>
                          <span className="tnum" style={{ fontWeight: 600, color: "var(--o-text-2)" }}>
                            {rdoCount.get(s.id)}
                          </span>{" "}
                          RDOs
                        </span>
                      )}
                      {stats.in_progress > 0 && (
                        <span>
                          <span className="tnum" style={{ fontWeight: 600, color: "var(--st-progress)" }}>
                            {stats.in_progress}
                          </span>{" "}
                          ativas
                        </span>
                      )}
                      {stats.late > 0 && (
                        <span>
                          <span className="tnum" style={{ fontWeight: 600, color: "var(--st-late)" }}>
                            {stats.late}
                          </span>{" "}
                          atrasadas
                        </span>
                      )}
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
