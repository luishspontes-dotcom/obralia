import Link from "next/link";
import { createServerSupabase } from "@/lib/supabase/server";

type Site = { id: string; name: string; address: string | null; client_name: string | null };
type WbsItem = { id: string; name: string; site_id: string; status: string | null };

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
      .select("id, name, address, client_name")
      .or(`name.ilike.%${query}%,address.ilike.%${query}%,client_name.ilike.%${query}%`)
      .limit(30);
    sites = (sitesR ?? []) as Site[];

    const { data: tasksR } = await supabase
      .from("wbs_items")
      .select("id, name, site_id, status")
      .ilike("name", `%${query}%`)
      .limit(30);
    tasks = (tasksR ?? []) as WbsItem[];
  }

  return (
    <div style={{ padding: "24px", maxWidth: 1280, margin: "0 auto" }}>
      <h1 style={{ margin: "0 0 16px", font: "700 28px var(--font-inter)", letterSpacing: "-0.02em" }}>
        Pesquisar
      </h1>

      <form action="/buscar" method="get">
        <input
          type="search"
          name="q"
          defaultValue={query}
          placeholder="Buscar por nome de obra, endereço, cliente ou atividade…"
          autoFocus
          style={{
            width: "100%",
            padding: "14px 18px",
            background: "var(--o-cream)",
            border: "1px solid var(--o-border)",
            borderRadius: 12,
            font: "400 16px var(--font-inter)",
            color: "var(--o-text-1)",
            marginBottom: 24,
            outline: "none",
          }}
        />
      </form>

      {!query && (
        <div style={{ background: "var(--o-paper)", border: "1px solid var(--o-border)", borderRadius: 12, padding: 48, textAlign: "center", color: "var(--o-text-2)", fontSize: 14 }}>
          Digite ao menos 2 caracteres pra buscar.
        </div>
      )}

      {query && sites.length === 0 && tasks.length === 0 && (
        <div style={{ background: "var(--o-paper)", border: "1px solid var(--o-border)", borderRadius: 12, padding: 48, textAlign: "center", color: "var(--o-text-2)" }}>
          Nada encontrado pra <strong>&quot;{query}&quot;</strong>.
        </div>
      )}

      {sites.length > 0 && (
        <div style={{ marginBottom: 24 }}>
          <h3 style={{ font: "600 12px var(--font-inter)", textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--o-text-3)", margin: "0 0 12px" }}>
            Obras · {sites.length}
          </h3>
          <div style={{ background: "var(--o-paper)", border: "1px solid var(--o-border)", borderRadius: 12, overflow: "hidden" }}>
            {sites.map((s, i) => (
              <Link key={s.id} href={`/obras/${s.id}`}
                style={{ display: "block", padding: "14px 18px", borderTop: i === 0 ? "none" : "1px solid var(--o-border)", textDecoration: "none", color: "inherit" }}>
                <div style={{ fontWeight: 500 }}>{s.name}</div>
                {s.address && <div style={{ fontSize: 12, color: "var(--o-text-3)", marginTop: 2 }}>{s.address}</div>}
                {s.client_name && <div style={{ fontSize: 12, color: "var(--o-text-3)" }}>{s.client_name}</div>}
              </Link>
            ))}
          </div>
        </div>
      )}

      {tasks.length > 0 && (
        <div>
          <h3 style={{ font: "600 12px var(--font-inter)", textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--o-text-3)", margin: "0 0 12px" }}>
            Atividades · {tasks.length}
          </h3>
          <div style={{ background: "var(--o-paper)", border: "1px solid var(--o-border)", borderRadius: 12, overflow: "hidden" }}>
            {tasks.map((t, i) => (
              <Link key={t.id} href={`/obras/${t.site_id}`}
                style={{ display: "flex", padding: "14px 18px", borderTop: i === 0 ? "none" : "1px solid var(--o-border)", textDecoration: "none", color: "inherit", alignItems: "center", gap: 12 }}>
                <span style={{ fontWeight: 500, flex: 1 }}>{t.name}</span>
                <span style={{ fontSize: 11, color: "var(--o-text-3)" }}>{t.status ?? "—"}</span>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
