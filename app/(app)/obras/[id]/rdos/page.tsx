import Link from "next/link";
import { notFound } from "next/navigation";
import { canWriteOrganization } from "@/lib/org-access";
import { createServerSupabase } from "@/lib/supabase/server";

type Site = { id: string; name: string; client_name: string | null; organization_id: string };
type DailyReport = {
  id: string;
  number: number;
  date: string;
  status: string;
  weather_morning: string | null;
  weather_afternoon: string | null;
  general_notes: string | null;
};

const STATUS_META: Record<string, { label: string; cls: string }> = {
  draft:    { label: "Rascunho",   cls: "status-paused"   },
  review:   { label: "Em revisão", cls: "status-progress" },
  approved: { label: "Aprovado",   cls: "status-done"     },
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
  const { data: { user } } = await supabase.auth.getUser();

  const { data: siteRaw } = await supabase
    .from("sites").select("id, name, client_name, organization_id").eq("id", id).maybeSingle();
  const site = siteRaw as Site | null;
  if (!site) notFound();
  const canEdit = user ? await canWriteOrganization(supabase, user.id, site.organization_id) : false;

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
    .from("daily_reports").select("status", { count: "exact" }).eq("site_id", id);
  const totalAll = totalCounts.count ?? rdos.length;

  const grouped = new Map<string, DailyReport[]>();
  for (const r of rdos) {
    const d = new Date(r.date);
    const key = d.toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
    const arr = grouped.get(key) ?? [];
    arr.push(r);
    grouped.set(key, arr);
  }

  return (
    <div>
      <div className="page-hero">
        <div style={{ maxWidth: 1280, margin: "0 auto" }}>
          <div style={{ marginBottom: 12, fontSize: 13 }}>
            <Link href="/obras" style={{ color: "var(--o-text-2)", textDecoration: "none" }}>← Obras</Link>
            <span style={{ color: "var(--o-text-3)", margin: "0 8px" }}>/</span>
            <Link href={`/obras/${id}`} style={{ color: "var(--o-text-2)", textDecoration: "none" }}>{site.name}</Link>
            <span style={{ color: "var(--o-text-3)", margin: "0 8px" }}>/</span>
            <span style={{ color: "var(--o-text-1)", fontWeight: 500 }}>RDOs</span>
          </div>

          <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", flexWrap: "wrap", gap: 16 }}>
            <div>
              <div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "0.12em", color: "var(--t-brand)", fontWeight: 600, marginBottom: 8 }}>
                Relatórios diários
              </div>
              <h1 style={{ margin: "0 0 6px", font: "700 32px var(--font-inter)", letterSpacing: "-0.025em" }}>
                RDOs
              </h1>
              <p style={{ margin: 0, fontSize: 14, color: "var(--o-text-2)" }}>
                {totalAll} relatórios · {site.name}
              </p>
            </div>

            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
              <Link href={`/obras/${id}/rdos`} className={`chip ${!filter ? "chip-active" : ""}`}>Todos</Link>
              <Link href={`/obras/${id}/rdos?status=approved`} className={`chip ${filter === "approved" ? "chip-active" : ""}`}>
                <span style={{ width: 6, height: 6, borderRadius: 999, background: "var(--st-done)" }} /> Aprovados
              </Link>
              <Link href={`/obras/${id}/rdos?status=review`} className={`chip ${filter === "review" ? "chip-active" : ""}`}>
                <span style={{ width: 6, height: 6, borderRadius: 999, background: "var(--st-progress)" }} /> Em revisão
              </Link>
              <Link href={`/obras/${id}/rdos?status=draft`} className={`chip ${filter === "draft" ? "chip-active" : ""}`}>Rascunhos</Link>
              {canEdit && (
                <Link href={`/obras/${id}/rdos/novo`} className="btn-primary" style={{ marginLeft: 4 }}>+ Novo RDO</Link>
              )}
            </div>
          </div>
        </div>
      </div>

      <div style={{ padding: "0 24px 32px", maxWidth: 1280, margin: "0 auto" }}>
        {rdos.length === 0 ? (
          <div className="empty">
            <div className="empty-emoji">📋</div>
            <div style={{ fontSize: 16, color: "var(--o-text-1)", marginBottom: 4, fontWeight: 600 }}>
              {filter ? "Nenhum RDO neste status" : "Sem RDOs"}
            </div>
            <div style={{ fontSize: 13 }}>
              {filter ? "Tente outro filtro acima." : "Esta obra ainda não tem relatórios diários cadastrados."}
            </div>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 28 }}>
            {Array.from(grouped.entries()).map(([month, list]) => (
              <div key={month}>
                <h3 className="section-title" style={{ textTransform: "capitalize" }}>
                  {month}
                </h3>
                <div className="card reveal-stagger" style={{ overflow: "hidden", padding: 0 }}>
                  {list.map((r, idx) => {
                    const meta = STATUS_META[r.status] ?? STATUS_META.draft;
                    const d = new Date(r.date);
                    const dayShort = d.toLocaleDateString("pt-BR", {
                      weekday: "short", day: "2-digit", month: "short",
                    });
                    return (
                      <Link key={r.id} href={`/obras/${id}/rdos/${r.id}`}
                        style={{
                          display: "flex", alignItems: "center", gap: 18,
                          padding: "14px 22px",
                          borderTop: idx === 0 ? "none" : "1px solid var(--o-border)",
                          fontSize: 14, textDecoration: "none", color: "inherit",
                        }}
                      >
                        <div className="tnum" style={{
                          minWidth: 60,
                          font: "700 20px var(--font-inter)",
                          color: "var(--t-brand)",
                          letterSpacing: "-0.01em",
                        }}>
                          #{r.number}
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontWeight: 500, marginBottom: 2, textTransform: "capitalize", color: "var(--o-text-1)" }}>
                            {dayShort}
                          </div>
                          {(r.weather_morning || r.weather_afternoon) && (
                            <div style={{ fontSize: 12, color: "var(--o-text-3)" }}>
                              {r.weather_morning ?? "—"} · {r.weather_afternoon ?? "—"}
                            </div>
                          )}
                        </div>
                        <span className={`status ${meta.cls}`}>{meta.label}</span>
                      </Link>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
