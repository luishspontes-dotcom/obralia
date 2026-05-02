import Link from "next/link";
import { createServerSupabase } from "@/lib/supabase/server";

type Site = { id: string; name: string; address: string | null; client_name: string | null; cover_url: string | null };
type WbsItem = { id: string; name: string; site_id: string; status: string | null };

const STATUS_LABELS: Record<string, string> = {
  in_progress: "Em andamento",
  done: "Concluído",
  late: "Atrasado",
  paused: "Pausado",
  waiting: "Aguardando",
};

export default async function BuscarPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
  const query = (q ?? "").trim();
  const supabase = await createServerSupabase();

  let sites: Site[] = [];
  let tasks: WbsItem[] = [];

  if (query.length >= 2) {
    const { data: sitesR } = await supabase
      .from("sites")
      .select("id, name, address, client_name, cover_url")
      .or(`name.ilike.%${query}%,address.ilike.%${query}%,client_name.ilike.%${query}%`)
      .limit(30);
    sites = (sitesR ?? []) as Site[];

    const { data: tasksR } = await supabase
      .from("wbs_items").select("id, name, site_id, status")
      .ilike("name", `%${query}%`).limit(30);
    tasks = (tasksR ?? []) as WbsItem[];
  }

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

        {query && sites.length === 0 && tasks.length === 0 && (
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

        {sites.length > 0 && (
          <div style={{ marginBottom: 28 }}>
            <h3 className="section-title">Obras · {sites.length}</h3>
            <div className="card reveal-stagger" style={{ overflow: "hidden", padding: 0 }}>
              {sites.map((s, i) => (
                <Link key={s.id} href={`/obras/${s.id}`}
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
                    color: "var(--t-brand)", fontSize: 16, fontWeight: 600,
                  }}>
                    {s.name.charAt(0)}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 500, color: "var(--o-text-1)" }}>{s.name}</div>
                    {(s.client_name || s.address) && (
                      <div style={{ fontSize: 12, color: "var(--o-text-3)", marginTop: 2 }}>
                        {s.client_name}
                        {s.client_name && s.address && " · "}
                        {s.address}
                      </div>
                    )}
                  </div>
                  <span style={{ fontSize: 13, color: "var(--t-brand)" }}>→</span>
                </Link>
              ))}
            </div>
          </div>
        )}

        {tasks.length > 0 && (
          <div>
            <h3 className="section-title">Atividades · {tasks.length}</h3>
            <div className="card reveal-stagger" style={{ overflow: "hidden", padding: 0 }}>
              {tasks.map((t, i) => (
                <Link key={t.id} href={`/obras/${t.site_id}`}
                  style={{
                    display: "flex", padding: "14px 20px",
                    borderTop: i === 0 ? "none" : "1px solid var(--o-border)",
                    textDecoration: "none", color: "inherit",
                    alignItems: "center", gap: 14,
                  }}>
                  <span style={{ fontWeight: 500, flex: 1, color: "var(--o-text-1)" }}>{t.name}</span>
                  {t.status && (
                    <span className={`status status-${t.status === "in_progress" ? "progress" : t.status === "late" ? "late" : t.status === "done" ? "done" : "paused"}`}>
                      {STATUS_LABELS[t.status] ?? t.status}
                    </span>
                  )}
                </Link>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
