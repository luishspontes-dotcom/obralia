import Link from "next/link";
import { createServerSupabase } from "@/lib/supabase/server";

type Comment = {
  id: string;
  body: string;
  target_table: string;
  target_id: string;
  created_at: string | null;
};

export default async function ComentariosPage() {
  const supabase = await createServerSupabase();

  const { data: commentsR } = await supabase
    .from("comments")
    .select("id, body, target_table, target_id, created_at")
    .order("created_at", { ascending: false })
    .limit(100);
  const comments = (commentsR ?? []) as Comment[];

  // Map daily_reports → site_id for linking
  const rdoIds = comments.filter((c) => c.target_table === "daily_reports").map((c) => c.target_id);
  const { data: rdosR } = await supabase
    .from("daily_reports")
    .select("id, site_id, number")
    .in("id", rdoIds.length > 0 ? rdoIds : ["00000000-0000-0000-0000-000000000000"]);
  const rdoMap = new Map(((rdosR ?? []) as { id: string; site_id: string; number: number }[]).map((r) => [r.id, r]));

  const { data: sitesR } = await supabase.from("sites").select("id, name");
  const siteMap = new Map(((sitesR ?? []) as { id: string; name: string }[]).map((s) => [s.id, s.name]));

  return (
    <div style={{ padding: "24px", maxWidth: 1280, margin: "0 auto" }}>
      <h1 style={{ margin: "0 0 4px", font: "700 28px var(--font-inter)", letterSpacing: "-0.02em" }}>
        Comentários e ocorrências
      </h1>
      <p style={{ margin: "0 0 24px", fontSize: 14, color: "var(--o-text-2)" }}>
        {comments.length} {comments.length === 1 ? "registro" : "registros"} mais recentes
      </p>

      {comments.length === 0 ? (
        <div style={{ background: "var(--o-paper)", border: "1px solid var(--o-border)", borderRadius: 12, padding: 48, textAlign: "center", color: "var(--o-text-2)" }}>
          Nenhum comentário ainda.
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {comments.map((c) => {
            const isOcorrencia = c.body.startsWith("[OCORRÊNCIA]");
            const display = isOcorrencia ? c.body.replace("[OCORRÊNCIA] ", "") : c.body;
            const rdo = rdoMap.get(c.target_id);
            const siteName = rdo ? siteMap.get(rdo.site_id) : null;
            const link = rdo ? `/obras/${rdo.site_id}/rdos/${rdo.id}` : "#";
            return (
              <Link
                key={c.id}
                href={link}
                style={{
                  display: "block",
                  padding: "14px 18px",
                  background: "var(--o-paper)",
                  border: "1px solid var(--o-border)",
                  borderLeft: `3px solid ${isOcorrencia ? "var(--st-late)" : "var(--t-brand)"}`,
                  borderRadius: 10,
                  textDecoration: "none",
                  color: "inherit",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                  {isOcorrencia && (
                    <span style={{ fontSize: 11, color: "var(--st-late)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                      ⚠ Ocorrência
                    </span>
                  )}
                  {siteName && (
                    <span style={{ fontSize: 12, color: "var(--o-text-2)" }}>
                      {siteName}{rdo && ` · RDO #${rdo.number}`}
                    </span>
                  )}
                </div>
                <div style={{ fontSize: 14, lineHeight: 1.5 }}>{display}</div>
                {c.created_at && (
                  <div style={{ fontSize: 11, color: "var(--o-text-3)", marginTop: 6 }}>
                    {new Date(c.created_at).toLocaleString("pt-BR")}
                  </div>
                )}
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
