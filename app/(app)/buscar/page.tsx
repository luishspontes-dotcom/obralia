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

type Supabase = Awaited<ReturnType<typeof createServerSupabase>>;
type SearchSite = { id: string; name: string; client_name: string | null; address: string | null; status: string | null };
type SearchWbs = { id: string; site_id: string; code: string | null; name: string; status: string | null };
type SearchRdo = {
  id: string;
  site_id: string;
  number: number;
  date: string;
  status: string | null;
  general_notes: string | null;
};
type SearchComment = { id: string; body: string; target_table: string; created_at: string | null };

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
    const searchGlobal = supabase.rpc as unknown as (
      fn: "search_global",
      args: { q: string; max_per_kind: number }
    ) => Promise<{ data: Hit[] | null; error: { message: string } | null }>;
    const { data, error } = await searchGlobal("search_global", { q: query, max_per_kind: 15 });
    hits = error
      ? await fallbackSearch(supabase, query)
      : ((data ?? []) as Hit[]).sort((a, b) => b.match_rank - a.match_rank);
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

async function fallbackSearch(supabase: Supabase, query: string): Promise<Hit[]> {
  const safeQuery = query.replace(/[%,]/g, " ").trim();
  if (safeQuery.length < 2) return [];
  const pattern = `%${safeQuery}%`;
  const numericQuery = Number.parseInt(safeQuery, 10);
  const canSearchNumber = Number.isFinite(numericQuery) && String(numericQuery) === safeQuery;

  const rdoQuery = supabase
    .from("daily_reports")
    .select("id, site_id, number, date, status, general_notes")
    .limit(15);

  const [sitesR, wbsR, rdosR, commentsR] = await Promise.all([
    supabase
      .from("sites")
      .select("id, name, client_name, address, status")
      .or(`name.ilike.${pattern},client_name.ilike.${pattern},address.ilike.${pattern},status.ilike.${pattern}`)
      .limit(15),
    supabase
      .from("wbs_items")
      .select("id, site_id, code, name, status")
      .or(`name.ilike.${pattern},code.ilike.${pattern},status.ilike.${pattern}`)
      .limit(15),
    canSearchNumber
      ? rdoQuery.eq("number", numericQuery)
      : rdoQuery.or(`date.ilike.${pattern},status.ilike.${pattern},general_notes.ilike.${pattern}`),
    supabase
      .from("comments")
      .select("id, body, target_table, created_at")
      .ilike("body", pattern)
      .limit(15),
  ]);
  const sites = (sitesR.data ?? []) as unknown as SearchSite[];
  const wbsItems = (wbsR.data ?? []) as unknown as SearchWbs[];
  const rdos = (rdosR.data ?? []) as unknown as SearchRdo[];
  const comments = (commentsR.data ?? []) as unknown as SearchComment[];

  const siteIds = new Set<string>();
  for (const item of wbsItems) siteIds.add(item.site_id);
  for (const item of rdos) siteIds.add(item.site_id);
  const siteLookup = new Map<string, string>();
  if (siteIds.size > 0) {
    const { data } = await supabase
      .from("sites")
      .select("id, name")
      .in("id", [...siteIds]);
    for (const site of (data ?? []) as unknown as Array<{ id: string; name: string }>) {
      siteLookup.set(site.id, site.name);
    }
  }

  const hits: Hit[] = [
    ...(sites.map((site) => ({
      kind: "obra" as const,
      id: site.id,
      title: site.name,
      subtitle: [site.client_name, site.address, site.status].filter(Boolean).join(" · "),
      link: `/obras/${site.id}`,
      match_rank: 70,
    }))),
    ...(wbsItems.map((item) => ({
      kind: "tarefa" as const,
      id: item.id,
      title: item.name,
      subtitle: [siteLookup.get(item.site_id), item.code, item.status].filter(Boolean).join(" · "),
      link: `/obras/${item.site_id}`,
      match_rank: 60,
    }))),
    ...(rdos.map((rdo) => ({
      kind: "rdo" as const,
      id: rdo.id,
      title: `RDO #${rdo.number} · ${siteLookup.get(rdo.site_id) ?? "Obra"}`,
      subtitle: [rdo.date, rdo.status, rdo.general_notes].filter(Boolean).join(" · "),
      link: `/obras/${rdo.site_id}/rdos/${rdo.id}`,
      match_rank: 50,
    }))),
    ...(comments.map((comment) => ({
      kind: "comentario" as const,
      id: comment.id,
      title: comment.body.slice(0, 90),
      subtitle: [comment.target_table, comment.created_at?.slice(0, 10)].filter(Boolean).join(" · "),
      link: "/comentarios",
      match_rank: 40,
    }))),
  ];

  return hits.sort((a, b) => b.match_rank - a.match_rank);
}
