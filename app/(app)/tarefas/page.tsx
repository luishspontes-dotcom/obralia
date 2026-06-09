import Link from "next/link";
import { createServerSupabase } from "@/lib/supabase/server";
import { createOrUpdateTask } from "@/lib/rdo-actions";
import { VISIBLE_SOURCE_PROVIDERS } from "@/lib/rdo-source-scope";
import { TaskRow } from "@/components/TaskRow";
import { ExportButton } from "@/components/ExportButton";

type WbsItem = {
  id: string;
  name: string;
  code: string | null;
  status: string | null;
  due_date: string | null;
  site_id: string;
  parent_id: string | null;
  time_spent_ms: number | null;
};
type Site = { id: string; name: string };

const PER_PAGE = 100;

export default async function TarefasPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; page?: string }>;
}) {
  const supabase = await createServerSupabase();
  const { status: filter, page } = await searchParams;
  const pageNum = Math.max(1, parseInt(page ?? "1", 10) || 1);
  const offset = (pageNum - 1) * PER_PAGE;

  const statusFilter =
    filter && ["waiting", "in_progress", "done", "late"].includes(filter) ? filter : undefined;

  // Total do filtro ativo — head:true não baixa linhas, só conta
  let countQuery = supabase
    .from("wbs_items")
    .select("*", { count: "exact", head: true })
    .in("external_provider", VISIBLE_SOURCE_PROVIDERS)
    .not("parent_id", "is", null);
  if (statusFilter) {
    countQuery = countQuery.eq("status", statusFilter);
  } else {
    countQuery = countQuery.in("status", ["waiting", "in_progress", "late"]);
  }
  const { count: totalCount } = await countQuery;
  const total = totalCount ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PER_PAGE));

  let query = supabase
    .from("wbs_items")
    .select("id, name, code, status, due_date, site_id, parent_id, time_spent_ms")
    .in("external_provider", VISIBLE_SOURCE_PROVIDERS)
    .not("parent_id", "is", null)
    .order("due_date", { ascending: true, nullsFirst: false });

  if (statusFilter) {
    query = query.eq("status", statusFilter);
  } else {
    query = query.in("status", ["waiting", "in_progress", "late"]);
  }

  const { data: itemsRaw } = await query.range(offset, offset + PER_PAGE - 1);
  const items = (itemsRaw ?? []) as WbsItem[];

  // Monta href preservando o filtro de status ao trocar de página
  const pageHref = (p: number) => {
    const sp = new URLSearchParams();
    if (filter) sp.set("status", filter);
    if (p > 1) sp.set("page", String(p));
    const qs = sp.toString();
    return `/tarefas${qs ? `?${qs}` : ""}`;
  };

  const { data: sitesRaw } = await supabase
    .from("sites")
    .select("id, name")
    .in("external_provider", VISIBLE_SOURCE_PROVIDERS);
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
              <span className="tnum">{total}</span> atividades · agrupadas por obra
              {totalPages > 1 && (
                <span className="tnum" style={{ color: "var(--o-text-3)" }}>
                  {" · "}página {pageNum} de {totalPages}
                </span>
              )}
            </p>
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <ExportButton
              filename={`tarefas-${new Date().toISOString().slice(0, 10)}`}
              label="Exportar CSV"
              rows={items.map((t) => ({
                obra: siteMap.get(t.site_id) ?? "",
                atividade: t.name,
                status: t.status ?? "",
                prazo: t.due_date ?? "",
              }))}
            />
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
        {/* Quick add task */}
        <form action={createOrUpdateTask} className="card" style={{ padding: "16px 20px", marginBottom: 18 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: "var(--o-text-2)", marginBottom: 10, letterSpacing: "0.04em", textTransform: "uppercase" }}>
            + Nova atividade
          </div>
          <div className="task-quick-add-grid" style={{ display: "grid", gridTemplateColumns: "2fr 1fr 130px 110px 100px", gap: 10, alignItems: "center" }}>
            <input name="name" required placeholder="Nome da atividade" style={taskInputStyle} />
            <select name="site_id" defaultValue="" style={taskInputStyle}>
              <option value="">Sem obra (geral)</option>
              {sites.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
            <input name="date_due" type="date" style={taskInputStyle} />
            <select name="status" defaultValue="waiting" style={taskInputStyle}>
              <option value="waiting">Aguardando</option>
              <option value="in_progress">Em andamento</option>
              <option value="done">Concluída</option>
              <option value="late">Atrasada</option>
            </select>
            <button type="submit" className="btn-brand" style={{ padding: "10px 14px", fontSize: 13, justifyContent: "center" }}>
              Criar
            </button>
          </div>
        </form>

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
                {list.slice(0, 25).map((t) => (
                  <TaskRow key={t.id} task={t} siteId={siteId} />
                ))}
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

        {totalPages > 1 && (
          <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: 8, paddingTop: 18 }}>
            {pageNum > 1 ? (
              <Link href={pageHref(pageNum - 1)} className="chip">← Anteriores</Link>
            ) : (
              <span className="chip" style={{ opacity: 0.4, cursor: "not-allowed" }}>← Anteriores</span>
            )}
            <span className="tnum" style={{ padding: "0 10px", fontSize: 13, color: "var(--o-text-2)" }}>
              Página {pageNum} de {totalPages}
            </span>
            {pageNum < totalPages ? (
              <Link href={pageHref(pageNum + 1)} className="chip">Próximos →</Link>
            ) : (
              <span className="chip" style={{ opacity: 0.4, cursor: "not-allowed" }}>Próximos →</span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

const taskInputStyle: React.CSSProperties = {
  width: "100%",
  background: "var(--o-paper)",
  border: "1px solid var(--o-border)",
  borderRadius: 8,
  padding: "9px 12px",
  font: "400 13px var(--font-inter)",
  color: "var(--o-text-1)",
  outline: "none",
};
