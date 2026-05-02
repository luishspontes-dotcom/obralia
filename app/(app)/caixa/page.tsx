import Link from "next/link";
import { createServerSupabase } from "@/lib/supabase/server";

type RDOReview = { id: string; number: number; date: string; site_id: string; status: string };
type LateTask = { id: string; name: string; site_id: string; due_date: string | null };
type SiteRow = { id: string; name: string };

export default async function CaixaPage() {
  const supabase = await createServerSupabase();

  const { data: pendingR } = await supabase
    .from("daily_reports")
    .select("id, number, date, site_id, status")
    .in("status", ["draft", "review"])
    .order("date", { ascending: false }).limit(50);
  const pendingRDOs = (pendingR ?? []) as RDOReview[];

  const { data: lateR } = await supabase
    .from("wbs_items")
    .select("id, name, site_id, due_date")
    .eq("status", "late").not("parent_id", "is", null)
    .order("due_date", { ascending: true }).limit(50);
  const lateTasks = (lateR ?? []) as LateTask[];

  const siteIds = new Set<string>([...pendingRDOs.map((r) => r.site_id), ...lateTasks.map((t) => t.site_id)]);
  const { data: sitesR } = await supabase.from("sites").select("id, name").in("id", Array.from(siteIds));
  const sites = new Map(((sitesR ?? []) as SiteRow[]).map((s) => [s.id, s.name]));

  const totalPending = pendingRDOs.length + lateTasks.length;

  return (
    <div>
      <div className="page-hero">
        <div style={{ maxWidth: 1280, margin: "0 auto" }}>
          <div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "0.12em", color: "var(--t-brand)", fontWeight: 600, marginBottom: 8 }}>
            Sua caixa
          </div>
          <h1 style={{ margin: "0 0 8px", font: "700 32px var(--font-inter)", letterSpacing: "-0.025em" }}>
            Caixa de entrada
          </h1>
          <p style={{ margin: 0, fontSize: 14, color: "var(--o-text-2)" }}>
            {totalPending === 0
              ? "Tudo em dia. Nenhum item precisa da sua atenção agora."
              : `${totalPending} ${totalPending === 1 ? "item precisa" : "itens precisam"} da sua atenção`}
          </p>
        </div>
      </div>

      <div style={{ padding: "0 24px 32px", maxWidth: 1280, margin: "0 auto" }}>
        {pendingRDOs.length > 0 && (
          <div style={{ marginBottom: 28 }}>
            <h3 className="section-title">RDOs aguardando aprovação · {pendingRDOs.length}</h3>
            <div className="card reveal-stagger" style={{ overflow: "hidden", padding: 0 }}>
              {pendingRDOs.map((r, idx) => (
                <Link key={r.id} href={`/obras/${r.site_id}/rdos/${r.id}`}
                  style={{
                    display: "flex", alignItems: "center", gap: 14,
                    padding: "14px 20px",
                    borderTop: idx === 0 ? "none" : "1px solid var(--o-border)",
                    fontSize: 14, textDecoration: "none", color: "inherit",
                    transition: "background var(--duration) var(--ease)",
                  }}
                >
                  <span className="tnum" style={{ fontWeight: 700, color: "var(--t-brand)", minWidth: 56, fontSize: 16 }}>
                    #{r.number}
                  </span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 500, color: "var(--o-text-1)" }}>{sites.get(r.site_id) ?? "Obra"}</div>
                    <div style={{ fontSize: 12, color: "var(--o-text-3)", marginTop: 2 }}>
                      {new Date(r.date).toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" })}
                    </div>
                  </div>
                  <span className={`status ${r.status === "draft" ? "status-paused" : "status-progress"}`}>
                    {r.status === "draft" ? "Rascunho" : "Em revisão"}
                  </span>
                </Link>
              ))}
            </div>
          </div>
        )}

        {lateTasks.length > 0 && (
          <div style={{ marginBottom: 28 }}>
            <h3 className="section-title">Atividades atrasadas · {lateTasks.length}</h3>
            <div className="card reveal-stagger" style={{ overflow: "hidden", padding: 0 }}>
              {lateTasks.map((t, idx) => (
                <Link key={t.id} href={`/obras/${t.site_id}`}
                  style={{
                    display: "flex", alignItems: "center", gap: 14,
                    padding: "14px 20px",
                    borderTop: idx === 0 ? "none" : "1px solid var(--o-border)",
                    fontSize: 14, textDecoration: "none", color: "inherit",
                  }}
                >
                  <span style={{
                    width: 32, height: 32, borderRadius: 8,
                    background: "rgba(180, 61, 61, 0.10)",
                    display: "grid", placeItems: "center",
                    color: "var(--st-late)", fontSize: 16,
                    flexShrink: 0,
                  }}>⚠</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 500, color: "var(--o-text-1)" }}>{t.name}</div>
                    <div style={{ fontSize: 12, color: "var(--o-text-3)", marginTop: 2 }}>
                      {sites.get(t.site_id) ?? "Obra"}
                    </div>
                  </div>
                  {t.due_date && (
                    <span className="tnum" style={{ fontSize: 12, color: "var(--st-late)", fontWeight: 500 }}>
                      venceu {new Date(t.due_date).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })}
                    </span>
                  )}
                </Link>
              ))}
            </div>
          </div>
        )}

        {totalPending === 0 && (
          <div className="empty">
            <div className="empty-emoji">✨</div>
            <div style={{ fontSize: 16, color: "var(--o-text-1)", marginBottom: 4, fontWeight: 600 }}>
              Tudo em dia
            </div>
            <div style={{ fontSize: 13 }}>
              Quando alguém atribuir uma tarefa, criar um RDO ou comentar em uma obra, vai aparecer aqui.
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
