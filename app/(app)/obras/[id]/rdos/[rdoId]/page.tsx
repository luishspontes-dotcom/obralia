import Link from "next/link";
import { notFound } from "next/navigation";
import { createServerSupabase } from "@/lib/supabase/server";

type Site = { id: string; name: string; client_name: string | null };
type DR = {
  id: string;
  number: number;
  date: string;
  status: string;
  weather_morning: string | null;
  weather_afternoon: string | null;
  condition_morning: string | null;
  condition_afternoon: string | null;
  general_notes: string | null;
};
type Activity = {
  id: string;
  description: string;
  progress_pct: number | null;
  notes: string | null;
};
type Workforce = { id: string; role: string; count: number };
type Equipment = { id: string; name: string; hours: number | null };
type Media = {
  id: string;
  storage_path: string | null;
  thumbnail_path: string | null;
  caption: string | null;
};
type Comment = {
  id: string;
  body: string;
  target_table: string;
  created_at: string | null;
};

const STATUS_META: Record<string, { label: string; color: string; bg: string }> = {
  draft: { label: "Rascunho", color: "var(--o-text-2)", bg: "rgba(0,0,0,0.04)" },
  review: { label: "Em revisão", color: "var(--st-progress)", bg: "rgba(8, 120, 155, 0.08)" },
  approved: { label: "Aprovado", color: "var(--st-done)", bg: "rgba(34, 139, 34, 0.08)" },
};

export default async function RdoDetailPage({
  params,
}: {
  params: Promise<{ id: string; rdoId: string }>;
}) {
  const { id, rdoId } = await params;
  const supabase = await createServerSupabase();

  const { data: siteRaw } = await supabase
    .from("sites").select("id, name, client_name")
    .eq("id", id).maybeSingle();
  const site = siteRaw as Site | null;
  if (!site) notFound();

  const { data: rdoRaw } = await supabase
    .from("daily_reports")
    .select("id, number, date, status, weather_morning, weather_afternoon, condition_morning, condition_afternoon, general_notes")
    .eq("id", rdoId).eq("site_id", id).maybeSingle();
  const rdo = rdoRaw as DR | null;
  if (!rdo) notFound();

  // Parallel fetches
  const [actsR, wfR, eqR, photosR, videosR, filesR, commentsR] = await Promise.all([
    supabase.from("report_activities").select("id, description, progress_pct, notes").eq("daily_report_id", rdoId),
    supabase.from("report_workforce").select("id, role, count").eq("daily_report_id", rdoId),
    supabase.from("report_equipment").select("id, name, hours").eq("daily_report_id", rdoId),
    supabase.from("media").select("id, storage_path, thumbnail_path, caption").eq("daily_report_id", rdoId).eq("kind", "photo").limit(60),
    supabase.from("media").select("id, storage_path, thumbnail_path, caption").eq("daily_report_id", rdoId).eq("kind", "video"),
    supabase.from("media").select("id, storage_path, thumbnail_path, caption").eq("daily_report_id", rdoId).eq("kind", "file"),
    supabase.from("comments").select("id, body, target_table, created_at").eq("target_id", rdoId).order("created_at", { ascending: false }),
  ]);

  const activities = (actsR.data ?? []) as Activity[];
  const workforce = (wfR.data ?? []) as Workforce[];
  const equipment = (eqR.data ?? []) as Equipment[];
  const photos = (photosR.data ?? []) as Media[];
  const videos = (videosR.data ?? []) as Media[];
  const files = (filesR.data ?? []) as Media[];
  const comments = (commentsR.data ?? []) as Comment[];

  const meta = STATUS_META[rdo.status] ?? STATUS_META.draft;
  const d = new Date(rdo.date);
  const dateLong = d.toLocaleDateString("pt-BR", {
    weekday: "long", day: "2-digit", month: "long", year: "numeric",
  });

  const totalWorkers = workforce.reduce((s, w) => s + (w.count ?? 0), 0);

  return (
    <div style={{ padding: "24px", maxWidth: 1280, margin: "0 auto" }}>
      <div style={{ marginBottom: 16, fontSize: 13 }}>
        <Link href="/obras" style={{ color: "var(--o-text-2)", textDecoration: "none" }}>Obras</Link>
        <span style={{ color: "var(--o-text-3)", margin: "0 8px" }}>/</span>
        <Link href={`/obras/${id}`} style={{ color: "var(--o-text-2)", textDecoration: "none" }}>{site.name}</Link>
        <span style={{ color: "var(--o-text-3)", margin: "0 8px" }}>/</span>
        <Link href={`/obras/${id}/rdos`} style={{ color: "var(--o-text-2)", textDecoration: "none" }}>RDOs</Link>
        <span style={{ color: "var(--o-text-3)", margin: "0 8px" }}>/</span>
        <span style={{ color: "var(--o-text-1)", fontWeight: 500 }}>#{rdo.number}</span>
      </div>

      <div style={{ marginBottom: 28 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 10 }}>
          <div style={{ font: "700 32px var(--font-inter)", color: "var(--t-brand)", letterSpacing: "-0.02em" }} className="tnum">RDO #{rdo.number}</div>
          <span style={{ padding: "4px 12px", background: meta.bg, color: meta.color, borderRadius: 999, fontSize: 12, fontWeight: 500 }}>{meta.label}</span>
        </div>
        <div style={{ fontSize: 16, color: "var(--o-text-2)", textTransform: "capitalize" }}>{dateLong}</div>
      </div>

      {/* Clima */}
      <div style={{ display: "grid", gap: 20, gridTemplateColumns: "1fr 1fr", marginBottom: 28 }}>
        <Block title="Clima — Manhã">
          <KV label="Tempo" value={rdo.weather_morning ?? "—"} />
          <KV label="Condição" value={rdo.condition_morning ?? "—"} />
        </Block>
        <Block title="Clima — Tarde">
          <KV label="Tempo" value={rdo.weather_afternoon ?? "—"} />
          <KV label="Condição" value={rdo.condition_afternoon ?? "—"} />
        </Block>
      </div>

      {rdo.general_notes && (
        <Block title="Observações gerais" style={{ marginBottom: 28 }}>
          <div style={{ fontSize: 14, color: "var(--o-text-1)", whiteSpace: "pre-wrap" }}>{rdo.general_notes}</div>
        </Block>
      )}

      {/* Mão de obra */}
      {workforce.length > 0 && (
        <Section title={`Mão de obra · ${totalWorkers} pessoas`}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 8 }}>
            {workforce.map((w) => (
              <div key={w.id} style={{ background: "var(--o-paper)", border: "1px solid var(--o-border)", borderRadius: 10, padding: "10px 14px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontSize: 13 }}>{w.role}</span>
                <span className="tnum" style={{ fontSize: 14, fontWeight: 600, color: "var(--t-brand)" }}>{w.count}</span>
              </div>
            ))}
          </div>
        </Section>
      )}

      {/* Equipamentos */}
      {equipment.length > 0 && (
        <Section title={`Equipamentos · ${equipment.length}`}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 8 }}>
            {equipment.map((e) => (
              <div key={e.id} style={{ background: "var(--o-paper)", border: "1px solid var(--o-border)", borderRadius: 10, padding: "10px 14px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontSize: 13 }}>{e.name}</span>
                {e.hours != null && <span className="tnum" style={{ fontSize: 12, color: "var(--o-text-2)" }}>{e.hours}h</span>}
              </div>
            ))}
          </div>
        </Section>
      )}

      {/* Atividades */}
      {activities.length > 0 && (
        <Section title={`Atividades · ${activities.length}`}>
          <div style={{ background: "var(--o-paper)", border: "1px solid var(--o-border)", borderRadius: 12, overflow: "hidden" }}>
            {activities.map((a, i) => (
              <div key={a.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 18px", borderTop: i === 0 ? "none" : "1px solid var(--o-border)", fontSize: 14 }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 500, marginBottom: 2 }}>{a.description}</div>
                  {a.notes && <div style={{ fontSize: 12, color: "var(--o-text-3)" }}>{a.notes}</div>}
                </div>
                <div style={{ width: 64 }}>
                  <div style={{ height: 6, background: "var(--o-border)", borderRadius: 3, overflow: "hidden" }}>
                    <div style={{ width: `${a.progress_pct ?? 0}%`, height: "100%", background: (a.progress_pct ?? 0) >= 100 ? "var(--st-done)" : "var(--t-brand)" }} />
                  </div>
                </div>
                <span className="tnum" style={{ fontSize: 13, fontWeight: 500, minWidth: 36, textAlign: "right", color: (a.progress_pct ?? 0) >= 100 ? "var(--st-done)" : "var(--o-text-1)" }}>{a.progress_pct ?? 0}%</span>
              </div>
            ))}
          </div>
        </Section>
      )}

      {/* Fotos */}
      {photos.length > 0 && (
        <Section title={`Fotos · ${photos.length}`}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: 8 }}>
            {photos.map((p) => (
              <a key={p.id} href={p.storage_path ?? "#"} target="_blank" rel="noreferrer"
                style={{ display: "block", aspectRatio: "4 / 3", background: "var(--o-border)", borderRadius: 8, overflow: "hidden" }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={p.thumbnail_path ?? p.storage_path ?? ""} alt={p.caption ?? "Foto"} loading="lazy"
                  style={{ width: "100%", height: "100%", objectFit: "cover" }} />
              </a>
            ))}
          </div>
        </Section>
      )}

      {/* Vídeos */}
      {videos.length > 0 && (
        <Section title={`Vídeos · ${videos.length}`}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 12 }}>
            {videos.map((v) => (
              <a key={v.id} href={v.storage_path ?? "#"} target="_blank" rel="noreferrer"
                style={{ display: "block", padding: "16px 18px", background: "var(--o-paper)", border: "1px solid var(--o-border)", borderRadius: 12, fontSize: 13, color: "var(--o-text-1)", textDecoration: "none" }}>
                <span style={{ fontSize: 24, marginRight: 8 }}>🎬</span>
                {v.caption ?? "Vídeo"}
              </a>
            ))}
          </div>
        </Section>
      )}

      {/* Anexos */}
      {files.length > 0 && (
        <Section title={`Anexos · ${files.length}`}>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {files.map((f) => (
              <a key={f.id} href={f.storage_path ?? "#"} target="_blank" rel="noreferrer"
                style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 14px", background: "var(--o-paper)", border: "1px solid var(--o-border)", borderRadius: 10, fontSize: 14, color: "var(--o-text-1)", textDecoration: "none" }}>
                <span style={{ fontSize: 18 }}>📎</span>
                <span style={{ flex: 1 }}>{f.caption ?? "Anexo"}</span>
                <span style={{ fontSize: 12, color: "var(--o-text-3)" }}>abrir →</span>
              </a>
            ))}
          </div>
        </Section>
      )}

      {/* Comentários e ocorrências */}
      {comments.length > 0 && (
        <Section title={`Comentários e ocorrências · ${comments.length}`}>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {comments.map((c) => {
              const isOcorrencia = c.body.startsWith("[OCORRÊNCIA]");
              const display = isOcorrencia ? c.body.replace("[OCORRÊNCIA] ", "") : c.body;
              return (
                <div key={c.id} style={{ padding: "12px 16px", background: "var(--o-paper)", border: "1px solid var(--o-border)", borderLeft: `3px solid ${isOcorrencia ? "var(--st-late)" : "var(--t-brand)"}`, borderRadius: 10 }}>
                  {isOcorrencia && (
                    <div style={{ fontSize: 11, color: "var(--st-late)", fontWeight: 600, marginBottom: 4, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                      ⚠ Ocorrência
                    </div>
                  )}
                  <div style={{ fontSize: 14, lineHeight: 1.5, whiteSpace: "pre-wrap" }}>{display}</div>
                  {c.created_at && (
                    <div style={{ fontSize: 11, color: "var(--o-text-3)", marginTop: 6 }}>
                      {new Date(c.created_at).toLocaleString("pt-BR")}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </Section>
      )}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 28 }}>
      <h3 style={{ font: "600 14px var(--font-inter)", textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--o-text-3)", margin: "0 0 12px" }}>{title}</h3>
      {children}
    </div>
  );
}
function Block({ title, children, style }: { title: string; children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div style={{ background: "var(--o-paper)", border: "1px solid var(--o-border)", borderRadius: 12, padding: 18, ...style }}>
      <h3 style={{ font: "600 12px var(--font-inter)", textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--o-text-3)", margin: "0 0 12px" }}>{title}</h3>
      {children}
    </div>
  );
}
function KV({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", fontSize: 14 }}>
      <span style={{ color: "var(--o-text-2)" }}>{label}</span>
      <span style={{ fontWeight: 500 }}>{value}</span>
    </div>
  );
}
