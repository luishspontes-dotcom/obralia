import Link from "next/link";
import { notFound } from "next/navigation";
import { createServerSupabase } from "@/lib/supabase/server";

type Site = { id: string; name: string; client_name: string | null };
type DailyReport = {
  id: string;
  number: number;
  date: string;
  status: string;
  weather_morning: string | null;
  weather_afternoon: string | null;
  general_notes: string | null;
};

const STATUS_META: Record<string, { label: string; color: string; bg: string }> = {
  draft: { label: "Rascunho", color: "var(--o-text-2)", bg: "rgba(0,0,0,0.04)" },
  review: { label: "Em revisão", color: "var(--st-progress)", bg: "rgba(8, 120, 155, 0.08)" },
  approved: { label: "Aprovado", color: "var(--st-done)", bg: "rgba(34, 139, 34, 0.08)" },
};

export default async function ObraRdosPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ status?: string }>;
}) {
  const { id } = await params;
  const { status: filter } = await searchParams;
  const supabase = await createServerSupabase();

  const { data: siteRaw } = await supabase
    .from("sites")
    .select("id, name, client_name")
    .eq("id", id)
    .maybeSingle();
  const site = siteRaw as Site | null;
  if (!site) notFound();

  let rdoQuery = supabase
    .from("daily_reports")
    .select("id, number, date, status, weather_morning, weather_afternoon, general_notes")
    .eq("site_id", id)
    .order("number", { ascending: false });

  if (filter && ["draft", "review", "approved"].includes(filter)) {
    rdoQuery = rdoQuery.eq("status", filter);
  }

  const { data: rdosRaw } = await rdoQuery;
  const rdos = (rdosRaw ?? []) as DailyReport[];

  const totalCounts = await supabase
    .from("daily_reports")
    .select("status", { count: "exact" })
    .eq("site_id", id);
  const totalAll = totalCounts.count ?? rdos.length;

  // Group by month for nice display
  const grouped = new Map<string, DailyReport[]>();
  for (const r of rdos) {
    const d = new Date(r.date);
    const key = `${d.toLocaleDateString("pt-BR", { month: "long", year: "numeric" })}`;
    const arr = grouped.get(key) ?? [];
    arr.push(r);
    grouped.set(key, arr);
  }

  return (
    <div style={{ padding: "24px", maxWidth: 1280, margin: "0 auto" }}>
      <div style={{ marginBottom: 16, fontSize: 13 }}>
        <Link href="/obras" style={{ color: "var(--o-text-2)", textDecoration: "none" }}>
          ← Obras
        </Link>
        <span style={{ color: "var(--o-text-3)", margin: "0 8px" }}>/</span>
        <Link
          href={`/obras/${id}`}
          style={{ color: "var(--o-text-2)", textDecoration: "none" }}
        >
          {site.name}
        </Link>
        <span style={{ color: "var(--o-text-3)", margin: "0 8px" }}>/</span>
        <span style={{ color: "var(--o-text-1)", fontWeight: 500 }}>RDOs</span>
      </div>

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
            Relatórios Diários (RDOs)
          </h1>
          <p style={{ margin: 0, fontSize: 14, color: "var(--o-text-2)" }}>
            {totalAll} relatórios · {site.name}
          </p>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <Chip label="Todos" href={`/obras/${id}/rdos`} active={!filter} />
          <Chip
            label="Aprovados"
            href={`/obras/${id}/rdos?status=approved`}
            active={filter === "approved"}
            color="var(--st-done)"
          />
          <Chip
            label="Em revisão"
            href={`/obras/${id}/rdos?status=review`}
            active={filter === "review"}
            color="var(--st-progress)"
          />
          <Chip
            label="Rascunhos"
            href={`/obras/${id}/rdos?status=draft`}
            active={filter === "draft"}
          />
          <Link
            href={`/obras/${id}/rdos/novo`}
            style={{
              padding: "6px 14px",
              background: "var(--o-accent)",
              color: "white",
              borderRadius: 999,
              fontSize: 12,
              fontWeight: 500,
              textDecoration: "none",
              marginLeft: 8,
            }}
          >
            + Novo RDO
          </Link>
        </div>
      </div>

      {rdos.length === 0 ? (
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
          {filter ? "Nenhum RDO neste status." : "Esta obra ainda não tem RDOs."}
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
          {Array.from(grouped.entries()).map(([month, list]) => (
            <div key={month}>
              <h3
                style={{
                  margin: "0 0 12px",
                  font: "600 12px var(--font-inter)",
                  textTransform: "uppercase",
                  letterSpacing: "0.06em",
                  color: "var(--o-text-3)",
                }}
              >
                {month}
              </h3>
              <div
                style={{
                  background: "var(--o-paper)",
                  border: "1px solid var(--o-border)",
                  borderRadius: 12,
                  overflow: "hidden",
                }}
              >
                {list.map((r, idx) => {
                  const meta = STATUS_META[r.status] ?? STATUS_META.draft;
                  const d = new Date(r.date);
                  const dayShort = d.toLocaleDateString("pt-BR", {
                    weekday: "short",
                    day: "2-digit",
                    month: "short",
                  });
                  return (
                    <Link
                      key={r.id}
                      href={`/obras/${id}/rdos/${r.id}`}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 16,
                        padding: "14px 20px",
                        borderTop: idx === 0 ? "none" : "1px solid var(--o-border)",
                        fontSize: 14,
                        textDecoration: "none",
                        color: "inherit",
                      }}
                    >
                      <div
                        style={{
                          minWidth: 60,
                          font: "700 18px var(--font-inter)",
                          color: "var(--t-brand)",
                          letterSpacing: "-0.01em",
                        }}
                        className="tnum"
                      >
                        #{r.number}
                      </div>
                      <div style={{ flex: 1 }}>
                        <div
                          style={{
                            fontWeight: 500,
                            marginBottom: 2,
                            textTransform: "capitalize",
                          }}
                        >
                          {dayShort}
                        </div>
                        {(r.weather_morning || r.weather_afternoon) && (
                          <div
                            style={{
                              fontSize: 12,
                              color: "var(--o-text-3)",
                            }}
                          >
                            {r.weather_morning ?? "—"} · {r.weather_afternoon ?? "—"}
                          </div>
                        )}
                      </div>
                      <span
                        style={{
                          padding: "3px 10px",
                          background: meta.bg,
                          color: meta.color,
                          borderRadius: 999,
                          fontSize: 11,
                          fontWeight: 500,
                        }}
                      >
                        {meta.label}
                      </span>
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function Chip({
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
          style={{ width: 6, height: 6, borderRadius: 999, background: color }}
        />
      )}
      {label}
    </Link>
  );
}
