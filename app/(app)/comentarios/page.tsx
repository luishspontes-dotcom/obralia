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

  const rdoIds = comments.filter((c) => c.target_table === "daily_reports").map((c) => c.target_id);
  const { data: rdosR } = await supabase
    .from("daily_reports").select("id, site_id, number")
    .in("id", rdoIds.length > 0 ? rdoIds : ["00000000-0000-0000-0000-000000000000"]);
  const rdoMap = new Map(((rdosR ?? []) as { id: string; site_id: string; number: number }[]).map((r) => [r.id, r]));

  const { data: sitesR } = await supabase.from("sites").select("id, name");
  const siteMap = new Map(((sitesR ?? []) as { id: string; name: string }[]).map((s) => [s.id, s.name]));

  const ocorrencias = comments.filter((c) => c.body.startsWith("[OCORRÊNCIA]")).length;

  return (
    <div>
      <div className="page-hero">
        <div style={{ maxWidth: 1280, margin: "0 auto" }}>
          <div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "0.12em", color: "var(--t-brand)", fontWeight: 600, marginBottom: 8 }}>
            Atividade
          </div>
          <h1 style={{ margin: "0 0 8px", font: "700 32px var(--font-inter)", letterSpacing: "-0.025em" }}>
            Comentários e ocorrências
          </h1>
          <p style={{ margin: 0, fontSize: 14, color: "var(--o-text-2)" }}>
            {comments.length} {comments.length === 1 ? "registro recente" : "registros mais recentes"}
            {ocorrencias > 0 && (
              <>
                {" · "}
                <span style={{ color: "var(--st-late)", fontWeight: 500 }}>
                  {ocorrencias} {ocorrencias === 1 ? "ocorrência" : "ocorrências"}
                </span>
              </>
            )}
          </p>
        </div>
      </div>

      <div style={{ padding: "0 24px 32px", maxWidth: 1280, margin: "0 auto" }}>
        {comments.length === 0 ? (
          <div className="empty">
            <div className="empty-emoji">💬</div>
            <div style={{ fontSize: 16, color: "var(--o-text-1)", marginBottom: 4, fontWeight: 600 }}>
              Nada por aqui ainda
            </div>
            <div style={{ fontSize: 13 }}>
              Quando alguém comentar em um RDO ou registrar uma ocorrência, vai aparecer aqui.
            </div>
          </div>
        ) : (
          <div className="reveal-stagger" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {comments.map((c) => {
              const isOcorrencia = c.body.startsWith("[OCORRÊNCIA]");
              const display = isOcorrencia ? c.body.replace("[OCORRÊNCIA] ", "") : c.body;
              const rdo = rdoMap.get(c.target_id);
              const siteName = rdo ? siteMap.get(rdo.site_id) : null;
              const link = rdo ? `/obras/${rdo.site_id}/rdos/${rdo.id}` : "#";
              const accentColor = isOcorrencia ? "var(--st-late)" : "var(--t-brand)";
              return (
                <Link
                  key={c.id} href={link} className="card card-hover"
                  style={{
                    display: "block",
                    padding: "16px 20px",
                    borderLeft: `3px solid ${accentColor}`,
                    textDecoration: "none",
                    color: "inherit",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8, flexWrap: "wrap" }}>
                    {isOcorrencia && (
                      <span className="status status-late">
                        Ocorrência
                      </span>
                    )}
                    {siteName && (
                      <span style={{ fontSize: 12, color: "var(--o-text-2)", fontWeight: 500 }}>
                        {siteName}
                        {rdo && (
                          <>
                            <span style={{ color: "var(--o-text-3)", margin: "0 6px" }}>·</span>
                            <span className="tnum" style={{ color: "var(--t-brand)" }}>RDO #{rdo.number}</span>
                          </>
                        )}
                      </span>
                    )}
                  </div>
                  <div style={{ fontSize: 14, lineHeight: 1.55, color: "var(--o-text-1)" }}>{display}</div>
                  {c.created_at && (
                    <div style={{ fontSize: 11, color: "var(--o-text-3)", marginTop: 8 }}>
                      {new Date(c.created_at).toLocaleString("pt-BR", {
                        day: "2-digit", month: "short", year: "numeric",
                        hour: "2-digit", minute: "2-digit",
                      })}
                    </div>
                  )}
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
