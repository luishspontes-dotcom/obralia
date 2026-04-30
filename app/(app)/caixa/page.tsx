import Link from "next/link";
import { createServerSupabase } from "@/lib/supabase/server";

type RDOReview = {
  id: string;
  number: number;
  date: string;
  site_id: string;
  status: string;
};
type LateTask = {
  id: string;
  name: string;
  site_id: string;
  due_date: string | null;
};
type SiteRow = { id: string; name: string };

export default async function CaixaPage() {
  const supabase = await createServerSupabase();

  // RDOs aguardando revisão
  const { data: pendingR } = await supabase
    .from("daily_reports")
    .select("id, number, date, site_id, status")
    .in("status", ["draft", "review"])
    .order("date", { ascending: false })
    .limit(50);
  const pendingRDOs = (pendingR ?? []) as RDOReview[];

  // Atividades atrasadas
  const { data: lateR } = await supabase
    .from("wbs_items")
    .select("id, name, site_id, due_date")
    .eq("status", "late")
    .not("parent_id", "is", null)
    .order("due_date", { ascending: true })
    .limit(50);
  const lateTasks = (lateR ?? []) as LateTask[];

  // Map sites
  const siteIds = new Set<string>([
    ...pendingRDOs.map((r) => r.site_id),
    ...lateTasks.map((t) => t.site_id),
  ]);
  const { data: sitesR } = await supabase
    .from("sites")
    .select("id, name")
    .in("id", Array.from(siteIds));
  const sites = new Map(((sitesR ?? []) as SiteRow[]).map((s) => [s.id, s.name]));

  return (
    <div style={{ padding: "24px", maxWidth: 1280, margin: "0 auto" }}>
      <h1 style={{ margin: "0 0 4px", font: "700 28px var(--font-inter)", letterSpacing: "-0.02em" }}>
        Caixa de entrada
      </h1>
      <p style={{ margin: "0 0 24px", fontSize: 14, color: "var(--o-text-2)" }}>
        {pendingRDOs.length + lateTasks.length} itens precisam da sua atenção
      </p>

      {pendingRDOs.length > 0 && (
        <Section title={`RDOs aguardando aprovação · ${pendingRDOs.length}`}>
          <List>
            {pendingRDOs.map((r) => (
              <Link
                key={r.id}
                href={`/obras/${r.site_id}/rdos/${r.id}`}
                style={rowStyle}
              >
                <span className="tnum" style={{ fontWeight: 600, color: "var(--t-brand)", minWidth: 60 }}>
                  #{r.number}
                </span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 500 }}>{sites.get(r.site_id) ?? "Obra"}</div>
                  <div style={{ fontSize: 12, color: "var(--o-text-3)" }}>
                    {new Date(r.date).toLocaleDateString("pt-BR")}
                  </div>
                </div>
                <span style={pillStyle("var(--st-progress)")}>
                  {r.status === "draft" ? "Rascunho" : "Em revisão"}
                </span>
              </Link>
            ))}
          </List>
        </Section>
      )}

      {lateTasks.length > 0 && (
        <Section title={`Atividades atrasadas · ${lateTasks.length}`}>
          <List>
            {lateTasks.map((t) => (
              <Link key={t.id} href={`/obras/${t.site_id}`} style={rowStyle}>
                <span style={{ fontSize: 16 }}>⚠</span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 500 }}>{t.name}</div>
                  <div style={{ fontSize: 12, color: "var(--o-text-3)" }}>
                    {sites.get(t.site_id) ?? "Obra"}
                  </div>
                </div>
                {t.due_date && (
                  <span style={{ fontSize: 12, color: "var(--st-late)" }}>
                    venceu {new Date(t.due_date).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })}
                  </span>
                )}
              </Link>
            ))}
          </List>
        </Section>
      )}

      {pendingRDOs.length === 0 && lateTasks.length === 0 && (
        <div style={{ background: "var(--o-paper)", border: "1px solid var(--o-border)", borderRadius: 12, padding: 48, textAlign: "center", color: "var(--o-text-2)" }}>
          Tudo em dia! Nenhum item pendente.
        </div>
      )}
    </div>
  );
}

const rowStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 14,
  padding: "12px 18px",
  borderTop: "1px solid var(--o-border)",
  fontSize: 14,
  textDecoration: "none",
  color: "inherit",
};

const pillStyle = (color: string): React.CSSProperties => ({
  padding: "3px 10px",
  background: `${color}15`,
  color,
  borderRadius: 999,
  fontSize: 11,
  fontWeight: 500,
});

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 24 }}>
      <h3 style={{ font: "600 12px var(--font-inter)", textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--o-text-3)", margin: "0 0 12px" }}>
        {title}
      </h3>
      {children}
    </div>
  );
}

function List({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ background: "var(--o-paper)", border: "1px solid var(--o-border)", borderRadius: 12, overflow: "hidden" }}>
      <div>{children}</div>
    </div>
  );
}
