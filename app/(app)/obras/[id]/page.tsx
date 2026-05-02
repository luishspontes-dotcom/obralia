import Link from "next/link";
import { notFound } from "next/navigation";
import { createServerSupabase } from "@/lib/supabase/server";
import { mediaUrl } from "@/lib/storage";

type Site = {
  id: string;
  name: string;
  status: string;
  client_name: string | null;
  start_date: string | null;
  end_date: string | null;
  address: string | null;
  cover_url: string | null;
  contract_number: string | null;
};

type WbsItem = {
  id: string;
  parent_id: string | null;
  name: string;
  code: string | null;
  status: string | null;
  position: number | null;
  progress_pct: number | null;
  due_date: string | null;
};

const STATUS_META: Record<string, { label: string; cls: string }> = {
  waiting:     { label: "Aguardando",   cls: "status-paused" },
  in_progress: { label: "Em andamento", cls: "status-progress" },
  done:        { label: "Concluído",    cls: "status-done" },
  late:        { label: "Atrasado",     cls: "status-late" },
  paused:      { label: "Pausado",      cls: "status-paused" },
};

function fmtDate(d: string | null): string {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" });
}

export default async function ObraDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createServerSupabase();

  const { data: siteRaw } = await supabase
    .from("sites")
    .select("id, name, status, client_name, start_date, end_date, address, cover_url, contract_number")
    .eq("id", id)
    .maybeSingle();

  const site = siteRaw as Site | null;
  if (!site) notFound();

  const { data: itemsRaw } = await supabase
    .from("wbs_items")
    .select("id, parent_id, name, code, status, position, progress_pct, due_date")
    .eq("site_id", id)
    .order("position");

  const items = (itemsRaw ?? []) as WbsItem[];
  const phases = items
    .filter((i) => i.parent_id === null)
    .sort((a, b) => (a.position ?? 0) - (b.position ?? 0));
  const tasksByPhase = new Map<string, WbsItem[]>();
  for (const it of items) {
    if (it.parent_id) {
      const arr = tasksByPhase.get(it.parent_id) ?? [];
      arr.push(it);
      tasksByPhase.set(it.parent_id, arr);
    }
  }

  const allTasks = items.filter((i) => i.parent_id !== null);
  const stats = {
    total: allTasks.length,
    done: allTasks.filter((t) => t.status === "done").length,
    in_progress: allTasks.filter((t) => t.status === "in_progress").length,
    late: allTasks.filter((t) => t.status === "late").length,
    waiting: allTasks.filter((t) => t.status === "waiting").length,
  };
  const progressAvg = stats.total > 0
    ? Math.round(allTasks.reduce((acc, t) => acc + (t.progress_pct ?? 0), 0) / stats.total)
    : 0;

  const { count: rdoCount } = await supabase
    .from("daily_reports").select("*", { count: "exact", head: true }).eq("site_id", id);
  const { count: photoCount } = await supabase
    .from("media").select("*", { count: "exact", head: true }).eq("site_id", id).eq("kind", "photo");

  const { data: filesRaw } = await supabase
    .from("media")
    .select("id, storage_path, caption, size_bytes")
    .eq("site_id", id).eq("kind", "file").is("daily_report_id", null)
    .order("caption");
  const obraFiles = (filesRaw ?? []) as { id: string; storage_path: string | null; caption: string | null; size_bytes: number | null }[];

  const accentColor = stats.late > 0 ? "var(--st-late)" : "var(--t-brand)";
  const isOperational = site.name.includes("(operacional)");

  return (
    <div>
      {/* HERO COM FOTO DE CAPA */}
      <div
        style={{
          position: "relative",
          height: 320,
          background: site.cover_url
            ? `linear-gradient(180deg, rgba(20,20,19,0.0) 35%, rgba(20,20,19,0.75) 100%), url(${mediaUrl(site.cover_url)})`
            : "linear-gradient(135deg, var(--t-brand-mist) 0%, var(--o-mist) 100%)",
          backgroundSize: "cover",
          backgroundPosition: "center",
          marginBottom: 24,
          overflow: "hidden",
          display: "flex",
          alignItems: "flex-end",
        }}
      >
        <div style={{ width: "100%", padding: "32px 28px 24px", position: "relative", zIndex: 1, maxWidth: 1280, margin: "0 auto" }}>
          <div style={{ marginBottom: 12, fontSize: 13 }}>
            <Link
              href="/obras"
              style={{
                color: site.cover_url ? "rgba(255,255,255,0.85)" : "var(--o-text-2)",
                textDecoration: "none",
                fontWeight: 500,
              }}
            >
              ← Obras
            </Link>
          </div>
          {site.client_name && (
            <div
              style={{
                fontSize: 11,
                color: site.cover_url ? "rgba(255,255,255,0.85)" : "var(--t-brand)",
                textTransform: "uppercase",
                letterSpacing: "0.08em",
                marginBottom: 8,
                fontWeight: 600,
              }}
            >
              {site.client_name}
            </div>
          )}
          <h1
            style={{
              margin: "0 0 12px",
              font: "700 38px var(--font-inter)",
              letterSpacing: "-0.025em",
              lineHeight: 1.1,
              color: site.cover_url ? "white" : "var(--o-text-1)",
              textShadow: site.cover_url ? "0 2px 12px rgba(0,0,0,0.3)" : "none",
            }}
          >
            {site.name}
          </h1>
          <div style={{ display: "flex", gap: 20, fontSize: 13, color: site.cover_url ? "rgba(255,255,255,0.92)" : "var(--o-text-2)", flexWrap: "wrap" }}>
            {site.address && <span>📍 {site.address}</span>}
            {site.contract_number && <span>📄 Contrato {site.contract_number}</span>}
            {site.start_date && <span>📅 Início {fmtDate(site.start_date)}</span>}
            {site.end_date && <span>🏁 Previsão {fmtDate(site.end_date)}</span>}
          </div>
        </div>
      </div>

      <div style={{ padding: "0 24px 32px", maxWidth: 1280, margin: "0 auto" }}>
        {/* Action bar */}
        <div style={{ display: "flex", gap: 8, marginBottom: 24, flexWrap: "wrap" }}>
          {(rdoCount ?? 0) > 0 && (
            <Link href={`/obras/${id}/rdos`} className="btn-primary">
              📋 {rdoCount} RDOs
            </Link>
          )}
          {(photoCount ?? 0) > 0 && (
            <Link href={`/obras/${id}/fotos`} className="chip">
              📸 {photoCount} fotos
            </Link>
          )}
        </div>

        {/* PROGRESS + STATS */}
        {!isOperational && stats.total > 0 && (
          <div className="card" style={{ padding: "20px 24px", marginBottom: 24 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 14, flexWrap: "wrap", gap: 12 }}>
              <div>
                <div style={{ fontSize: 11, color: "var(--o-text-2)", textTransform: "uppercase", letterSpacing: "0.06em", fontWeight: 600 }}>
                  Progresso geral
                </div>
                <div className="tnum" style={{ font: "700 28px var(--font-inter)", letterSpacing: "-0.02em", marginTop: 2 }}>
                  {progressAvg}%
                </div>
              </div>
              <div style={{ display: "flex", gap: 16 }}>
                <Stat label="Em curso" value={stats.in_progress} color="var(--st-progress)" />
                <Stat label="Atrasadas" value={stats.late} color="var(--st-late)" />
                <Stat label="Concluídas" value={stats.done} color="var(--st-done)" />
                <Stat label="Total" value={stats.total} color="var(--o-text-1)" />
              </div>
            </div>
            <div style={{ height: 8, background: "var(--o-mist)", borderRadius: 999, overflow: "hidden" }}>
              <div
                style={{
                  width: `${progressAvg}%`,
                  height: "100%",
                  background: accentColor,
                  borderRadius: 999,
                  transition: "width 600ms var(--ease-out)",
                }}
              />
            </div>
          </div>
        )}

        {/* PHASES TREE */}
        {phases.length > 0 && (
          <div className="reveal-stagger" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {phases.map((p) => {
              const phaseTasks = tasksByPhase.get(p.id) ?? [];
              const phaseDone = phaseTasks.filter((t) => t.status === "done").length;
              const phaseLate = phaseTasks.filter((t) => t.status === "late").length;
              const phaseProgress = phaseTasks.length > 0 ? Math.round((phaseDone / phaseTasks.length) * 100) : 0;
              const phaseColor = phaseLate > 0 ? "var(--st-late)" : "var(--t-brand)";

              return (
                <details
                  key={p.id}
                  open={phaseLate > 0}
                  className="card"
                  style={{ overflow: "hidden", padding: 0 }}
                >
                  <summary
                    style={{
                      cursor: "pointer",
                      padding: "16px 22px",
                      listStyle: "none",
                      display: "flex",
                      alignItems: "center",
                      gap: 16,
                      fontSize: 15,
                      fontWeight: 600,
                      letterSpacing: "-0.01em",
                    }}
                  >
                    {p.code && (
                      <span
                        style={{
                          fontSize: 11,
                          color: "var(--o-text-3)",
                          fontWeight: 500,
                          minWidth: 28,
                          fontVariantNumeric: "tabular-nums",
                        }}
                      >
                        {p.code}
                      </span>
                    )}
                    <span style={{ flex: 1 }}>{p.name}</span>
                    <span className="tnum" style={{ fontSize: 12, color: "var(--o-text-2)", fontWeight: 400, marginRight: 8 }}>
                      {phaseDone}/{phaseTasks.length}
                    </span>
                    <div style={{ width: 100, height: 5, background: "var(--o-mist)", borderRadius: 999, overflow: "hidden" }}>
                      <div style={{ width: `${phaseProgress}%`, height: "100%", background: phaseColor, borderRadius: 999 }} />
                    </div>
                    <span className="tnum" style={{ fontSize: 12, color: "var(--o-text-2)", fontWeight: 500, minWidth: 40, textAlign: "right" }}>
                      {phaseProgress}%
                    </span>
                  </summary>

                  <div style={{ borderTop: "1px solid var(--o-border)", background: "var(--o-soft)" }}>
                    {phaseTasks.length === 0 ? (
                      <div style={{ padding: "20px", fontSize: 13, color: "var(--o-text-3)", textAlign: "center" }}>
                        Nenhuma atividade nesta fase ainda.
                      </div>
                    ) : (
                      phaseTasks.map((t, idx) => {
                        const meta = STATUS_META[t.status ?? "waiting"] ?? STATUS_META.waiting;
                        return (
                          <div
                            key={t.id}
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: 12,
                              padding: "12px 22px 12px 60px",
                              borderTop: idx === 0 ? "none" : "1px solid var(--o-border)",
                              fontSize: 14,
                              background: "var(--o-paper)",
                            }}
                          >
                            <span style={{ flex: 1, color: "var(--o-text-1)" }}>{t.name}</span>
                            {t.due_date && (
                              <span
                                className="tnum"
                                style={{
                                  fontSize: 12,
                                  color: t.status === "late" ? "var(--st-late)" : "var(--o-text-3)",
                                  fontWeight: t.status === "late" ? 500 : 400,
                                }}
                              >
                                {fmtDate(t.due_date)}
                              </span>
                            )}
                            <span className={`status ${meta.cls}`} style={{ minWidth: 96, justifyContent: "center" }}>
                              {meta.label}
                            </span>
                          </div>
                        );
                      })
                    )}
                  </div>
                </details>
              );
            })}
          </div>
        )}

        {phases.length === 0 && !isOperational && (
          <div className="empty">
            <div className="empty-emoji">🏗️</div>
            <div style={{ fontSize: 15, color: "var(--o-text-1)", marginBottom: 4 }}>
              Sem cronograma ainda
            </div>
            <div style={{ fontSize: 13 }}>
              Esta obra ainda não tem fases ou atividades cadastradas.
            </div>
          </div>
        )}

        {/* DOCUMENTOS DA OBRA */}
        {obraFiles.length > 0 && (
          <div style={{ marginTop: 32 }}>
            <h3 className="section-title">Documentos · {obraFiles.length}</h3>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {obraFiles.map((f) => (
                <a
                  key={f.id}
                  href={mediaUrl(f.storage_path) || "#"}
                  target="_blank"
                  rel="noreferrer"
                  className="card"
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 12,
                    padding: "12px 16px",
                    fontSize: 14,
                    color: "var(--o-text-1)",
                    textDecoration: "none",
                  }}
                >
                  <span style={{ fontSize: 18 }}>📄</span>
                  <span style={{ flex: 1 }}>{f.caption ?? "Documento"}</span>
                  {f.size_bytes != null && (
                    <span className="tnum" style={{ fontSize: 11, color: "var(--o-text-3)" }}>
                      {(f.size_bytes / 1024).toFixed(0)} KB
                    </span>
                  )}
                  <span style={{ fontSize: 12, color: "var(--t-brand)" }}>abrir →</span>
                </a>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function Stat({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div style={{ textAlign: "center", minWidth: 70 }}>
      <div
        style={{
          fontSize: 10.5,
          color: "var(--o-text-2)",
          textTransform: "uppercase",
          letterSpacing: "0.06em",
          marginBottom: 2,
          fontWeight: 500,
        }}
      >
        {label}
      </div>
      <div className="tnum" style={{ font: "700 22px var(--font-inter)", color, letterSpacing: "-0.02em" }}>
        {value}
      </div>
    </div>
  );
}
