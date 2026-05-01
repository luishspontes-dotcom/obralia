import Link from "next/link";
import { notFound } from "next/navigation";
import { createServerSupabase } from "@/lib/supabase/server";
import { withSignedMediaUrls } from "@/lib/supabase/media-url";

type Site = {
  id: string;
  name: string;
  status: string;
  client_name: string | null;
  start_date: string | null;
  end_date: string | null;
  address: string | null;
};

type WbsItem = {
  id: string;
  parent_id: string | null;
  name: string;
  code: string;
  status: string | null;
  position: number | null;
  progress_pct: number | null;
  due_date: string | null;
};

const STATUS_META: Record<
  string,
  { label: string; color: string; bg: string }
> = {
  waiting: {
    label: "Aguardando",
    color: "var(--o-text-2)",
    bg: "rgba(0,0,0,0.04)",
  },
  in_progress: {
    label: "Em andamento",
    color: "var(--st-progress)",
    bg: "rgba(8, 120, 155, 0.08)",
  },
  done: {
    label: "Concluído",
    color: "var(--st-done)",
    bg: "rgba(34, 139, 34, 0.08)",
  },
  late: {
    label: "Atrasado",
    color: "var(--st-late)",
    bg: "rgba(220, 38, 38, 0.08)",
  },
  paused: {
    label: "Pausado",
    color: "var(--o-text-3)",
    bg: "rgba(0,0,0,0.06)",
  },
};

export default async function ObraDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createServerSupabase();

  const { data: siteRaw } = await supabase
    .from("sites")
    .select("id, name, status, client_name, start_date, end_date, address")
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

  // Aggregates
  const allTasks = items.filter((i) => i.parent_id !== null);
  const stats = {
    total: allTasks.length,
    done: allTasks.filter((t) => t.status === "done").length,
    in_progress: allTasks.filter((t) => t.status === "in_progress").length,
    late: allTasks.filter((t) => t.status === "late").length,
    waiting: allTasks.filter((t) => t.status === "waiting").length,
  };
  const progressAvg =
    stats.total > 0
      ? Math.round(
          allTasks.reduce((acc, t) => acc + (t.progress_pct ?? 0), 0) /
            stats.total
        )
      : 0;

  // RDO count for this site
  const { count: rdoCount } = await supabase
    .from("daily_reports")
    .select("*", { count: "exact", head: true })
    .eq("site_id", id);

  const { count: photoCount } = await supabase
    .from("media")
    .select("*", { count: "exact", head: true })
    .eq("site_id", id)
    .eq("kind", "photo");

  // Anexos da obra (kind=file SEM daily_report_id = anexos do nível obra)
  const { data: filesRaw } = await supabase
    .from("media")
    .select("id, storage_path, caption, size_bytes")
    .eq("site_id", id)
    .eq("kind", "file")
    .is("daily_report_id", null)
    .order("caption");
  const obraFiles = await withSignedMediaUrls(
    supabase,
    (filesRaw ?? []) as {
      id: string;
      storage_path: string | null;
      caption: string | null;
      size_bytes: number | null;
    }[]
  );

  return (
    <div style={{ padding: "24px", maxWidth: 1280, margin: "0 auto" }}>
      {/* Breadcrumb */}
      <div style={{ marginBottom: 16, fontSize: 13 }}>
        <Link
          href="/obras"
          style={{
            color: "var(--o-text-2)",
            textDecoration: "none",
          }}
        >
          ← Obras
        </Link>
      </div>

      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <div
          style={{
            fontSize: 11,
            color: "var(--o-text-3)",
            textTransform: "uppercase",
            letterSpacing: "0.06em",
            marginBottom: 6,
            fontWeight: 500,
          }}
        >
          {site.client_name ?? "Cliente Meu Viver"}
        </div>
        <h1
          style={{
            margin: "0 0 12px",
            font: "700 32px var(--font-inter)",
            letterSpacing: "-0.02em",
            lineHeight: 1.15,
          }}
        >
          {site.name}
        </h1>
        {/* Action bar */}
        <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
          {(rdoCount ?? 0) > 0 && (
            <Link
              href={`/obras/${id}/rdos`}
              style={{
                padding: "8px 14px",
                background: "var(--o-accent)",
                color: "white",
                borderRadius: 8,
                textDecoration: "none",
                fontSize: 13,
                fontWeight: 500,
              }}
            >
              📋 {rdoCount} RDOs →
            </Link>
          )}
          <Link
            href={`/obras/${id}/fotos`}
            style={{
              padding: "8px 14px",
              background: "var(--o-paper)",
              color: "var(--o-text-1)",
              border: "1px solid var(--o-border)",
              borderRadius: 8,
              textDecoration: "none",
              fontSize: 13,
              fontWeight: 500,
            }}
          >
            Fotos · {photoCount ?? 0} →
          </Link>
        </div>
        {site.address && (
          <div
            style={{
              fontSize: 14,
              color: "var(--o-text-2)",
              marginBottom: 20,
            }}
          >
            📍 {site.address}
          </div>
        )}

        {/* Stat cards */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr repeat(4, max-content)",
            gap: 12,
            alignItems: "center",
            marginTop: 20,
          }}
        >
          <div>
            <div
              style={{
                fontSize: 12,
                color: "var(--o-text-2)",
                marginBottom: 6,
              }}
            >
              Progresso geral · {progressAvg}%
            </div>
            <div
              style={{
                height: 8,
                background: "var(--o-border)",
                borderRadius: 4,
                overflow: "hidden",
                maxWidth: 480,
              }}
            >
              <div
                style={{
                  width: `${progressAvg}%`,
                  height: "100%",
                  background:
                    stats.late > 0
                      ? "var(--st-late)"
                      : "var(--t-brand)",
                  transition: "300ms",
                }}
              />
            </div>
          </div>
          <Stat label="Em curso" value={stats.in_progress} color="var(--st-progress)" />
          <Stat label="Atrasadas" value={stats.late} color="var(--st-late)" />
          <Stat label="Concluídas" value={stats.done} color="var(--st-done)" />
          <Stat label="Total" value={stats.total} color="var(--o-text-1)" />
        </div>
      </div>

      {/* Phases tree */}
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {phases.map((p) => {
          const phaseTasks = tasksByPhase.get(p.id) ?? [];
          const phaseDone = phaseTasks.filter((t) => t.status === "done").length;
          const phaseLate = phaseTasks.filter((t) => t.status === "late").length;
          const phaseProgress =
            phaseTasks.length > 0
              ? Math.round((phaseDone / phaseTasks.length) * 100)
              : 0;

          return (
            <details
              key={p.id}
              open={phaseLate > 0}
              style={{
                background: "var(--o-paper)",
                border: "1px solid var(--o-border)",
                borderRadius: 12,
                overflow: "hidden",
              }}
            >
              <summary
                style={{
                  cursor: "pointer",
                  padding: "16px 20px",
                  listStyle: "none",
                  display: "flex",
                  alignItems: "center",
                  gap: 14,
                  fontSize: 15,
                  fontWeight: 600,
                  letterSpacing: "-0.01em",
                  borderBottom: "1px solid transparent",
                }}
              >
                <span
                  style={{
                    fontSize: 11,
                    color: "var(--o-text-3)",
                    fontWeight: 500,
                    minWidth: 24,
                  }}
                >
                  {p.code}
                </span>
                <span style={{ flex: 1 }}>{p.name}</span>
                <span
                  style={{
                    fontSize: 12,
                    color: "var(--o-text-2)",
                    fontWeight: 400,
                    marginRight: 12,
                  }}
                  className="tnum"
                >
                  {phaseDone}/{phaseTasks.length}
                </span>
                <div
                  style={{
                    width: 80,
                    height: 6,
                    background: "var(--o-border)",
                    borderRadius: 3,
                    overflow: "hidden",
                  }}
                >
                  <div
                    style={{
                      width: `${phaseProgress}%`,
                      height: "100%",
                      background:
                        phaseLate > 0
                          ? "var(--st-late)"
                          : "var(--t-brand)",
                    }}
                  />
                </div>
                <span
                  style={{
                    fontSize: 12,
                    color: "var(--o-text-2)",
                    fontWeight: 400,
                    minWidth: 40,
                    textAlign: "right",
                  }}
                  className="tnum"
                >
                  {phaseProgress}%
                </span>
              </summary>

              <div style={{ borderTop: "1px solid var(--o-border)" }}>
                {phaseTasks.length === 0 ? (
                  <div
                    style={{
                      padding: "20px",
                      fontSize: 13,
                      color: "var(--o-text-3)",
                      textAlign: "center",
                    }}
                  >
                    Nenhuma atividade nesta fase ainda.
                  </div>
                ) : (
                  phaseTasks.map((t) => {
                    const meta =
                      STATUS_META[t.status ?? "waiting"] ?? STATUS_META.waiting;
                    return (
                      <div
                        key={t.id}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 12,
                          padding: "10px 20px 10px 56px",
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
                              color:
                                t.status === "late"
                                  ? "var(--st-late)"
                                  : "var(--o-text-3)",
                            }}
                          >
                            {new Date(t.due_date).toLocaleDateString("pt-BR", {
                              day: "2-digit",
                              month: "short",
                            })}
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
                  })
                )}
              </div>
            </details>
          );
        })}
      </div>

      {phases.length === 0 && (
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
          Esta obra ainda não tem fases ou atividades cadastradas.
        </div>
      )}

      {obraFiles.length > 0 && (
        <div style={{ marginTop: 32 }}>
          <h3 style={{ font: "600 14px var(--font-inter)", textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--o-text-3)", margin: "0 0 12px" }}>
            Documentos da obra · {obraFiles.length}
          </h3>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {obraFiles.map((f) => (
              <a
                key={f.id}
                href={f.storage_path ?? "#"}
                target="_blank"
                rel="noreferrer"
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  padding: "10px 14px",
                  background: "var(--o-paper)",
                  border: "1px solid var(--o-border)",
                  borderRadius: 10,
                  fontSize: 14,
                  color: "var(--o-text-1)",
                  textDecoration: "none",
                }}
              >
                <span style={{ fontSize: 18 }}>📄</span>
                <span style={{ flex: 1 }}>{f.caption ?? "Documento"}</span>
                {f.size_bytes != null && (
                  <span style={{ fontSize: 11, color: "var(--o-text-3)" }}>
                    {(f.size_bytes / 1024).toFixed(0)} KB
                  </span>
                )}
                <span style={{ fontSize: 12, color: "var(--o-text-3)" }}>abrir →</span>
              </a>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function Stat({
  label,
  value,
  color,
}: {
  label: string;
  value: number;
  color: string;
}) {
  return (
    <div
      style={{
        background: "var(--o-paper)",
        border: "1px solid var(--o-border)",
        borderRadius: 8,
        padding: "8px 14px",
        textAlign: "center",
        minWidth: 80,
      }}
    >
      <div
        style={{
          fontSize: 10,
          color: "var(--o-text-2)",
          textTransform: "uppercase",
          letterSpacing: "0.04em",
          marginBottom: 2,
          fontWeight: 500,
        }}
      >
        {label}
      </div>
      <div
        className="tnum"
        style={{
          font: "700 18px var(--font-inter)",
          color,
        }}
      >
        {value}
      </div>
    </div>
  );
}
