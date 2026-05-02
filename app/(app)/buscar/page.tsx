import Link from "next/link";
import { createServerSupabase } from "@/lib/supabase/server";

type Hit = {
  kind: "obra" | "tarefa" | "rdo" | "comentario";
  id: string;
  title: string;
  subtitle: string;
  link: string;
  match_rank: number;
};

const KIND_META: Record<string, { label: string; emoji: string; color: string }> = {
  obra:       { label: "Obra",       emoji: "🏗",  color: "var(--t-brand)" },
  tarefa:     { label: "Atividade",  emoji: "📋",  color: "var(--st-progress)" },
  rdo:        { label: "RDO",        emoji: "📝",  color: "var(--o-text-2)" },
  comentario: { label: "Comentário", emoji: "💬",  color: "var(--st-late)" },
};

export default async function BuscarPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
  const query = (q ?? "").trim();
  const supabase = await createServerSupabase();

  let hits: Hit[] = [];

  if (query.length >= 2) {
    const pattern = `%${query}%`;
    const [sitesR, tasksR, rdosR, commentsR] = await Promise.all([
      supabase
        .from("sites")
        .select("id, name, address, client_name")
        .or(`name.ilike.${pattern},address.ilike.${pattern},client_name.ilike.${pattern}`)
        .limit(15),
      supabase
        .from("wbs_items")
        .select("id, name, site_id, status")
        .ilike("name", pattern)
        .limit(15),
      supabase
        .from("daily_reports")
        .select("id, number, date, site_id, general_notes")
        .ilike("general_notes", pattern)
        .limit(15),
      supabase
        .from("comments")
        .select("id, body, target_table, target_id")
        .ilike("body", pattern)
        .limit(15),
    ]);

    hits = [
      ...((sitesR.data ?? []) as Array<{ id: string; name: string; address: string | null; client_name: string | null }>).map((site) => ({
        kind: "obra" as const,
        id: site.id,
        title: site.name,
        subtitle: [site.client_name, site.address].filter(Boolean).join(" · ") || "Obra",
        link: `/obras/${site.id}`,
        match_rank: 100,
      })),
      ...((tasksR.data ?? []) as Array<{ id: string; name: string; site_id: string; status: string | null }>).map((task) => ({
        kind: "tarefa" as const,
        id: task.id,
        title: task.name,
        subtitle: task.status ?? "Atividade",
        link: `/obras/${task.site_id}`,
        match_rank: 80,
      })),
      ...((rdosR.data ?? []) as Array<{ id: string; number: number; date: string; site_id: string; general_notes: string | null }>).map((rdo) => ({
        kind: "rdo" as const,
        id: rdo.id,
        title: `RDO #${rdo.number}`,
        subtitle: rdo.general_notes ?? rdo.date,
        link: `/obras/${rdo.site_id}/rdos/${rdo.id}`,
        match_rank: 60,
      })),
      ...((commentsR.data ?? []) as Array<{ id: string; body: string; target_table: string; target_id: string }>).map((comment) => ({
        kind: "comentario" as const,
        id: comment.id,
        title: comment.body.slice(0, 80),
        subtitle: comment.target_table,
        link: "/comentarios",
        match_rank: 40,
      })),
    ];
  }

  // Group by kind for display
  const groups = new Map<string, Hit[]>();
  for (const h of hits) {
    const arr = groups.get(h.kind) ?? [];
    arr.push(h);
    groups.set(h.kind, arr);
  }
  const KIND_ORDER = ["obra", "tarefa", "rdo", "comentario"];

  return (
    <div>
      <div className="page-hero">
        <div style={{ maxWidth: 1280, margin: "0 auto" }}>
          <div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "0.12em", color: "var(--t-brand)", fontWeight: 600, marginBottom: 8 }}>
            Buscar
          </div>
          <h1 style={{ margin: "0 0 16px", font: "700 32px var(--font-inter)", letterSpacing: "-0.025em" }}>
            Pesquisar
          </h1>
          <form action="/buscar" method="get">
            <input
              type="search" name="q" defaultValue={query} autoFocus
              placeholder="Buscar por nome de obra, endereço, cliente ou atividade…"
              style={{
                width: "100%", maxWidth: 720,
                padding: "14px 18px",
                background: "var(--o-paper)",
                border: "1px solid var(--o-border)",
                borderRadius: 12,
                font: "400 16px var(--font-inter)",
                color: "var(--o-text-1)",
                outline: "none",
                boxShadow: "var(--shadow-xs)",
              }}
            />
          </form>
        </div>
      </div>

      <div style={{ padding: "0 24px 32px", maxWidth: 1280, margin: "0 auto" }}>
        {!query && (
          <div className="empty">
            <div className="empty-emoji">🔍</div>
            <div style={{ fontSize: 16, color: "var(--o-text-1)", marginBottom: 4, fontWeight: 600 }}>
              Comece a digitar
            </div>
            <div style={{ fontSize: 13 }}>
              Digite ao menos 2 caracteres pra buscar obras, atividades, endereços ou clientes.
            </div>
          </div>
        )}

        {query && hits.length === 0 && (
          <div className="empty">
            <div className="empty-emoji">🤔</div>
            <div style={{ fontSize: 16, color: "var(--o-text-1)", marginBottom: 4, fontWeight: 600 }}>
              Nada encontrado
            </div>
            <div style={{ fontSize: 13 }}>
              Não há resultado pra <strong>&quot;{query}&quot;</strong>. Tente outras palavras-chave.
            </div>
          </div>
        )}

        {KIND_ORDER.map((kind) => {
          const list = groups.get(kind);
          if (!list || list.length === 0) return null;
          const meta = KIND_META[kind];
          return (
            <div key={kind} style={{ marginBottom: 28 }}>
              <h3 className="section-title">{meta.label}s · {list.length}</h3>
              <div className="card reveal-stagger" style={{ overflow: "hidden", padding: 0 }}>
                {list.map((h, i) => (
                  <Link key={h.id} href={h.link}
                    style={{
                      display: "flex", padding: "14px 20px",
                      borderTop: i === 0 ? "none" : "1px solid var(--o-border)",
                      textDecoration: "none", color: "inherit",
                      alignItems: "center", gap: 14,
                    }}>
                    <div style={{
                      width: 40, height: 40, borderRadius: 8, flexShrink: 0,
                      background: "var(--t-brand-mist)",
                      display: "grid", placeItems: "center",
                      color: meta.color, fontSize: 18,
                    }}>
                      {meta.emoji}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 500, color: "var(--o-text-1)" }}>{h.title}</div>
                      {h.subtitle && (
                        <div style={{ fontSize: 12, color: "var(--o-text-3)", marginTop: 2 }}>
                          {h.subtitle}
                        </div>
                      )}
                    </div>
                    <span style={{ fontSize: 13, color: "var(--t-brand)" }}>→</span>
                  </Link>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
