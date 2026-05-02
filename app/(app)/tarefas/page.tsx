import Link from "next/link";
import { createServerSupabase } from "@/lib/supabase/server";

type WbsItem = {
  id: string;
  name: string;
  code: string | null;
  status: string | null;
  due_date: string | null;
  site_id: string;
  parent_id: string | null;
};
type Site = { id: string; name: string };

const STATUS_META: Record<string, { label: string; cls: string }> = {
  waiting:     { label: "Aguardando",   cls: "status-paused"   },
  in_progress: { label: "Em andamento", cls: "status-progress" },
  done:        { label: "Concluído",    cls: "status-done"     },
  late:        { label: "Atrasado",     cls: "status-late"     },
};

export default async function TarefasPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const supabase = await createServerSupabase();
  const { status: filter } = await searchParams;

  let query = supabase
    .from("wbs_items")
    .select("id, name, code, status, due_date, site_id, parent_id")
    .not("parent_id", "is", null)
    .order("due_date", { ascending: true, nullsFirst: false });

  if (filter && ["waiting", "in_progress", "done", "late"].includes(filter)) {
    query = query.eq("status", filter);
  } else if (!filter || filter === "active") {
    query = query.in("status", ["waiting", "in_progress", "late"]);
  }

  const { data: itemsRaw } = await query.limit(500);
  const items = (itemsRaw ?? []) as WbsItem[];

  const { data: sitesRaw } = await supabase.from("sites").select("id, name");
  const sites = (sitesRaw ?? []) as Site[];
  const siteMap = new Map(sites.map((s) => [s.id, s.name]));

  const grouped = new Map<string, WbsItem[]>();
  for (const it of items) {
    const arr = grouped.get(it.site_id) ?? [];
    arr.push(it);
    grouped.set(it.site_id, arr);
  }

  return (
    <div>
      <div className="page-hero">
        <div style={{ maxWidth: 1280, margin: "0 auto", display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
          <div>
            <div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "0.12em", color: "var(--t-brand)", fontWeight: 600, marginBottom: 8 }}>
              Cronograma
            </div>
            <h1 style={{ margin: "0 0 8px", font: "700 32px var(--font-inter)", letterSpacing: "-0.025em" }}>
              Atividades
            </h1>
            <p style={{ margin: 0, fontSize: 14, color: "var(--o-text-2)" }}>
              {items.length} atividades · agrupadas por obra
            </p>
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <Link href="/tarefas" className={`chip ${(!filter || filter === "active") ? "chip-active" : ""}`}>Ativas</Link>
            <Link href="/tarefas?status=in_progress" className={`chip ${filter === "in_progress" ? "chip-active" : ""}`}>
              <span style={{ width: 6, height: 6, borderRadius: 999, background: "var(--st-progress)" }} /> Em andamento
            </Link>
            <Link href="/tarefas?status=late" className={`chip ${filter === "late" ? "chip-active" : ""}`}>
              <span style={{ width: 6, height: 6, borderRadius: 999, background: "var(--st-late)" }} /> Atrasadas
            </Link>
            <Link href="/tarefas?status=done" className={`chip ${filter === "done" ? "chip-active" : ""}`}>
              <span style={{ width: 6, height: 6, borderRadius: 999, background: "var(--st-done)" }} /> Concluídas
            </Link>
          </div>
        </div>
      </div>

      <div style={{ padding: "0 24px 32px", maxWidth: 1280, margin: "0 auto" }}>
        {grouped.size === 0 && (
          <div className="empty">
            <div className="empty-emoji">📋</div>
            <div style={{ fontSize: 16, color: "var(--o-text-1)", marginBottom: 4, fontWeight: 600 }}>
              Sem atividades neste filtro
            </div>
            <div style={{ fontSize: 13 }}>
              Tente outro filtro acima ou consulte uma obra específica.
            </div>
          </div>
        )}

        <div className="reveal-stagger" style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {Array.from(grouped.entries()).map(([siteId, list]) => {
            const siteName = siteMap.get(siteId) ?? "Obra";
            return (
              <div key={siteId} className="card" style={{ overflow: "hidden", padding: 0 }}>
                <div style={{
                  padding: "14px 22px",
                  borderBottom: "1px solid var(--o-border)",
                  display: "flex", alignItems: "center", justifyContent: "space-between",
                  background: "var(--o-soft)",
                }}>
                  <Link href={`/obras/${siteId}`} style={{
                    font: "600 15px var(--font-inter)", color: "var(--o-text-1)",
                    textDecoration: "none", letterSpacing: "-0.01em",
                  }}>
                    {siteName}
                  </Link>
                  <span className="tnum" style={{ fontSize: 12, color: "var(--o-text-2)", fontWeight: 500 }}>
                    {list.length} {list.length === 1 ? "atividade" : "atividades"}
                  </span>
                </div>
                {list.slice(0, 25).map((t, i) => {
                  const meta = STATUS_META[t.status ?? "waiting"] ?? STATUS_META.waiting;
                  return (
                    <div key={t.id} style={{
                      display: "flex", alignItems: "center", gap: 12,
                      padding: "12px 22px",
                      borderTop: i === 0 ? "none" : "1px solid var(--o-border)",
                      fontSize: 14,
                    }}>
                      <span style={{ flex: 1, color: "var(--o-text-1)" }}>{t.name}</span>
                      {t.due_date && (
                        <span className="tnum" style={{
                          fontSize: 12,
                          color: t.status === "late" ? "var(--st-late)" : "var(--o-text-3)",
                          fontWeight: t.status === "late" ? 500 : 400,
                        }}>
                          {new Date(t.due_date).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })}
                        </span>
                      )}
                      <span className={`status ${meta.cls}`} style={{ minWidth: 96, justifyContent: "center" }}>
                        {meta.label}
                      </span>
                    </div>
                  );
                })}
                {list.length > 25 && (
                  <div style={{
                    padding: "10px 22px",
                    borderTop: "1px solid var(--o-border)",
                    fontSize: 12, color: "var(--o-text-2)", textAlign: "center",
                    background: "var(--o-soft)",
                  }}>
                    + {list.length - 25} atividades.{" "}
                    <Link href={`/obras/${siteId}`} style={{ color: "var(--t-brand)", textDecoration: "none", fontWeight: 500 }}>
                      Ver tudo →
                    </Link>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
