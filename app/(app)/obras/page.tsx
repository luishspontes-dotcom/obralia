import Link from "next/link";
import { createServerSupabase } from "@/lib/supabase/server";

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

  // Aggregate per site
  const perSite = new Map<
    string,
    {
      total: number;
      done: number;
      late: number;
      in_progress: number;
      progressAvg: number;
    }
  >();
  for (const it of items) {
    if (it.parent_id === null) continue; // skip phase rows, only count leaves
    const cur = perSite.get(it.site_id) ?? {
      total: 0,
      done: 0,
      late: 0,
      in_progress: 0,
      progressAvg: 0,
    };
    cur.total += 1;
    if (it.status === "done") cur.done += 1;
    if (it.status === "late") cur.late += 1;
    if (it.status === "in_progress") cur.in_progress += 1;
    cur.progressAvg += it.progress_pct ?? 0;
    perSite.set(it.site_id, cur);
  }

  // Compute final progress as average
  for (const s of perSite.values()) {
    s.progressAvg = s.total > 0 ? Math.round(s.progressAvg / s.total) : 0;
  }

  // Filter
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
    <div style={{ padding: "24px", maxWidth: 1280, margin: "0 auto" }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 24,
        }}
      >
        <div>
          <h1
            style={{
              margin: "0 0 4px",
              font: "700 28px var(--font-inter)",
              letterSpacing: "-0.02em",
            }}
          >
            Obras
          </h1>
          <p
            style={{
              margin: 0,
              fontSize: 14,
              color: "var(--o-text-2)",
            }}
          >
            {totals.obras} obras · {totals.inProgress} em andamento ·{" "}
            <span style={{ color: "var(--st-late)" }}>
              {totals.atRisk} em risco
            </span>
          </p>
        </div>

        {/* Filtros */}
        <div style={{ display: "flex", gap: 8 }}>
          <FilterChip label="Todas" href="/obras" active={!filterStatus} />
          <FilterChip
            label="Em andamento"
            href="/obras?status=in_progress"
            active={filterStatus === "in_progress"}
            color="var(--st-progress)"
          />
          <FilterChip
            label="Em risco"
            href="/obras?status=at-risk"
            active={filterStatus === "at-risk"}
            color="var(--st-late)"
          />
          <FilterChip
            label="Concluídas"
            href="/obras?status=done"
            active={filterStatus === "done"}
            color="var(--st-done)"
          />
        </div>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(360px, 1fr))",
          gap: 16,
        }}
      >
        {visibleSites.map((s) => {
          const stats = perSite.get(s.id) ?? {
            total: 0,
            done: 0,
            late: 0,
            in_progress: 0,
            progressAvg: 0,
          };
          const accentColor =
            stats.late > 0
              ? "var(--st-late)"
              : s.status === "done"
              ? "var(--st-done)"
              : "var(--t-brand)";
          return (
            <Link
              key={s.id}
              href={`/obras/${s.id}`}
              style={{
                background: "var(--o-paper)",
                border: "1px solid var(--o-border)",
                borderLeft: `3px solid ${accentColor}`,
                borderRadius: 12,
                padding: "20px 22px",
                textDecoration: "none",
                color: "inherit",
                display: "block",
                transition: "150ms",
              }}
            >
              <div
                style={{
                  fontSize: 11,
                  color: "var(--o-text-3)",
                  textTransform: "uppercase",
                  letterSpacing: "0.06em",
                  marginBottom: 6,
                  fontWeight: 500,
                }}
              >
                {s.client_name ?? "Cliente"}
              </div>
              <div
                style={{
                  font: "600 17px var(--font-inter)",
                  letterSpacing: "-0.01em",
                  marginBottom: 14,
                  lineHeight: 1.3,
                }}
              >
                {s.name}
              </div>

              {/* Progress bar */}
              <div
                style={{
                  height: 6,
                  background: "var(--o-border)",
                  borderRadius: 3,
                  overflow: "hidden",
                  marginBottom: 8,
                }}
              >
                <div
                  style={{
                    width: `${stats.progressAvg}%`,
                    height: "100%",
                    background: accentColor,
                    transition: "300ms",
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
              >
                <span>{stats.progressAvg}% concluído</span>
                <span className="tnum">
                  {stats.done}/{stats.total} atividades
                </span>
              </div>

              {/* Status pills */}
              <div style={{ display: "flex", gap: 6, fontSize: 11 }}>
                {stats.in_progress > 0 && (
                  <Pill color="var(--st-progress)">
                    {stats.in_progress} em andamento
                  </Pill>
                )}
                {stats.late > 0 && (
                  <Pill color="var(--st-late)">{stats.late} atrasadas</Pill>
                )}
                {stats.done > 0 && (
                  <Pill color="var(--st-done)">{stats.done} ok</Pill>
                )}
              </div>
            </Link>
          );
        })}
      </div>

      {visibleSites.length === 0 && (
        <div
          style={{
            background: "var(--o-paper)",
            border: "1px solid var(--o-border)",
            borderRadius: 12,
            padding: 48,
            textAlign: "center",
            color: "var(--o-text-2)",
          }}
        >
          Nenhuma obra encontrada com este filtro.
        </div>
      )}
    </div>
  );
}

function FilterChip({
  label,
  href,
  active,
  color,
}: {
  label: string;
  href: string;
  active: boolean;
  color?: string;
}) {
  return (
    <Link
      href={href}
      style={{
        padding: "6px 12px",
        background: active ? "var(--o-dark)" : "var(--o-paper)",
        color: active ? "var(--o-cream)" : "var(--o-text-2)",
        border: `1px solid ${active ? "var(--o-dark)" : "var(--o-border)"}`,
        borderRadius: 999,
        fontSize: 12,
        fontWeight: 500,
        textDecoration: "none",
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
      }}
    >
      {color && (
        <span
          style={{
            width: 6,
            height: 6,
            borderRadius: 999,
            background: color,
          }}
        />
      )}
      {label}
    </Link>
  );
}

function Pill({ children, color }: { children: React.ReactNode; color: string }) {
  return (
    <span
      style={{
        padding: "2px 8px",
        background: `${color}15`,
        color: color,
        borderRadius: 999,
        fontWeight: 500,
      }}
    >
      {children}
    </span>
  );
}
