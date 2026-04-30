import Link from "next/link";
import { createServerSupabase } from "@/lib/supabase/server";

type WbsItem = {
  id: string;
  name: string;
  code: string;
  status: string | null;
  due_date: string | null;
  site_id: string;
  parent_id: string | null;
};

type Site = { id: string; name: string };

const STATUS_META: Record<string, { label: string; color: string; bg: string }> = {
  waiting: { label: "Aguardando", color: "var(--o-text-2)", bg: "rgba(0,0,0,0.04)" },
  in_progress: { label: "Em andamento", color: "var(--st-progress)", bg: "rgba(8, 120, 155, 0.08)" },
  done: { label: "Concluído", color: "var(--st-done)", bg: "rgba(34, 139, 34, 0.08)" },
  late: { label: "Atrasado", color: "var(--st-late)", bg: "rgba(220, 38, 38, 0.08)" },
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

  // Group by site
  const grouped = new Map<string, WbsItem[]>();
  for (const it of items) {
    const arr = grouped.get(it.site_id) ?? [];
    arr.push(it);
    grouped.set(it.site_id, arr);
  }

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
          <h1 style={{ margin: "0 0 4px", font: "700 28px var(--font-inter)", letterSpacing: "-0.02em" }}>
            Atividades
          </h1>
          <p style={{ margin: 0, fontSize: 14, color: "var(--o-text-2)" }}>
            {items.length} atividades · agrupadas por obra
          </p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <Chip label="Ativas" href="/tarefas" active={!filter || filter === "active"} />
          <Chip label="Em andamento" href="/tarefas?status=in_progress" active={filter === "in_progress"} color="var(--st-progress)" />
          <Chip label="Atrasadas" href="/tarefas?status=late" active={filter === "late"} color="var(--st-late)" />
          <Chip label="Concluídas" href="/tarefas?status=done" active={filter === "done"} color="var(--st-done)" />
        </div>
      </div>

      {grouped.size === 0 && (
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
          Nenhuma atividade encontrada com este filtro.
        </div>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        {Array.from(grouped.entries()).map(([siteId, list]) => {
          const siteName = siteMap.get(siteId) ?? "Obra";
          return (
            <div
              key={siteId}
              style={{
                background: "var(--o-paper)",
                border: "1px solid var(--o-border)",
                borderRadius: 12,
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  padding: "14px 20px",
                  borderBottom: "1px solid var(--o-border)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                }}
              >
                <Link
                  href={`/obras/${siteId}`}
                  style={{
                    font: "600 15px var(--font-inter)",
                    color: "var(--o-text-1)",
                    textDecoration: "none",
                    letterSpacing: "-0.01em",
                  }}
                >
                  {siteName}
                </Link>
                <span style={{ fontSize: 12, color: "var(--o-text-2)" }} className="tnum">
                  {list.length} {list.length === 1 ? "atividade" : "atividades"}
                </span>
              </div>
              {list.slice(0, 25).map((t) => {
                const meta = STATUS_META[t.status ?? "waiting"] ?? STATUS_META.waiting;
                return (
                  <div
                    key={t.id}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 12,
                      padding: "10px 20px",
                      borderTop: "1px solid var(--o-border)",
                      fontSize: 14,
                    }}
                  >
                    <span
                      style={{
                        width: 8,
                        height: 8,
                        borderRadius: 999,
                        background: meta.color,
                        flexShrink: 0,
                      }}
                    />
                    <span style={{ flex: 1 }}>{t.name}</span>
                    {t.due_date && (
                      <span
                        style={{
                          fontSize: 12,
                          color: t.status === "late" ? "var(--st-late)" : "var(--o-text-3)",
                        }}
                      >
                        {new Date(t.due_date).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })}
                      </span>
                    )}
                    <span
                      style={{
                        padding: "2px 8px",
                        background: meta.bg,
                        color: meta.color,
                        borderRadius: 999,
                        fontSize: 11,
                        fontWeight: 500,
                        minWidth: 84,
                        textAlign: "center",
                      }}
                    >
                      {meta.label}
                    </span>
                  </div>
                );
              })}
              {list.length > 25 && (
                <div
                  style={{
                    padding: "10px 20px",
                    borderTop: "1px solid var(--o-border)",
                    fontSize: 12,
                    color: "var(--o-text-2)",
                    textAlign: "center",
                  }}
                >
                  + {list.length - 25} atividades. <Link href={`/obras/${siteId}`} style={{ color: "var(--o-accent)", textDecoration: "none" }}>Ver tudo →</Link>
                </div>
              )}
            </div>
          );
        })}
      </div>
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
        <span style={{ width: 6, height: 6, borderRadius: 999, background: color }} />
      )}
      {label}
    </Link>
  );
}
