import Link from "next/link";
import { notFound } from "next/navigation";
import { createServerSupabase } from "@/lib/supabase/server";
import { mediaUrl } from "@/lib/storage";
import { PhotoUploader } from "@/components/PhotoUploader";
import { setRdoStatus, deleteRdo, deletePhoto, postComment } from "@/lib/rdo-actions";

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
type Activity = { id: string; description: string; progress_pct: number | null; notes: string | null };
type Workforce = { id: string; role: string; count: number };
type Equipment = { id: string; name: string; hours: number | null };
type Media = { id: string; storage_path: string | null; thumbnail_path: string | null; caption: string | null };
type Comment = { id: string; body: string; target_table: string; created_at: string | null };

const STATUS_META: Record<string, { label: string; cls: string }> = {
  draft:    { label: "Rascunho",   cls: "status-paused" },
  review:   { label: "Em revisão", cls: "status-progress" },
  approved: { label: "Aprovado",   cls: "status-done" },
};

export default async function RdoDetailPage({
  params,
}: {
  params: Promise<{ id: string; rdoId: string }>;
}) {
  const { id, rdoId } = await params;
  const supabase = await createServerSupabase();

  const { data: siteRaw } = await supabase
    .from("sites").select("id, name, client_name").eq("id", id).maybeSingle();
  const site = siteRaw as Site | null;
  if (!site) notFound();

  const { data: rdoRaw } = await supabase
    .from("daily_reports")
    .select("id, number, date, status, weather_morning, weather_afternoon, condition_morning, condition_afternoon, general_notes")
    .eq("id", rdoId).eq("site_id", id).maybeSingle();
  const rdo = rdoRaw as DR | null;
  if (!rdo) notFound();

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
  const workforce  = (wfR.data ?? []) as Workforce[];
  const equipment  = (eqR.data ?? []) as Equipment[];
  const photos     = (photosR.data ?? []) as Media[];
  const videos     = (videosR.data ?? []) as Media[];
  const files      = (filesR.data ?? []) as Media[];
  const comments   = (commentsR.data ?? []) as Comment[];

  const meta = STATUS_META[rdo.status] ?? STATUS_META.draft;
  const d = new Date(rdo.date);
  const dateLong = d.toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long", year: "numeric" });
  const totalWorkers = workforce.reduce((s, w) => s + (w.count ?? 0), 0);

  return (
    <div>
      <div className="page-hero">
        <div style={{ maxWidth: 1280, margin: "0 auto" }}>
          <div style={{ marginBottom: 12, fontSize: 13 }}>
            <Link href="/obras" style={{ color: "var(--o-text-2)", textDecoration: "none" }}>← Obras</Link>
            <span style={{ color: "var(--o-text-3)", margin: "0 8px" }}>/</span>
            <Link href={`/obras/${id}`} style={{ color: "var(--o-text-2)", textDecoration: "none" }}>{site.name}</Link>
            <span style={{ color: "var(--o-text-3)", margin: "0 8px" }}>/</span>
            <Link href={`/obras/${id}/rdos`} style={{ color: "var(--o-text-2)", textDecoration: "none" }}>RDOs</Link>
            <span style={{ color: "var(--o-text-3)", margin: "0 8px" }}>/</span>
            <span style={{ color: "var(--o-text-1)", fontWeight: 500 }} className="tnum">#{rdo.number}</span>
          </div>

          <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", flexWrap: "wrap", gap: 16 }}>
            <div>
              <div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "0.12em", color: "var(--t-brand)", fontWeight: 600, marginBottom: 8 }}>
                Relatório diário
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 6 }}>
                <h1 className="tnum" style={{
                  margin: 0, font: "700 36px var(--font-inter)",
                  letterSpacing: "-0.025em",
                  color: "var(--t-brand)",
                }}>
                  RDO #{rdo.number}
                </h1>
                <span className={`status ${meta.cls}`}>{meta.label}</span>
              </div>
              <div style={{ fontSize: 14, color: "var(--o-text-2)", textTransform: "capitalize" }}>{dateLong}</div>
            </div>

            {/* Action buttons */}
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <Link href={`/obras/${id}/rdos/${rdoId}/editar`} className="chip" style={{ textDecoration: "none" }}>
                ✎ Editar
              </Link>
              {rdo.status !== "approved" && (
                <form action={setRdoStatus} style={{ display: "inline" }}>
                  <input type="hidden" name="rdoId" value={rdoId} />
                  <input type="hidden" name="siteId" value={id} />
                  <input type="hidden" name="status" value="approved" />
                  <button type="submit" className="chip" style={{ background: "var(--st-done-soft, #dcf5e8)", color: "var(--st-done, #137a4d)", border: "1px solid var(--st-done, #137a4d)", cursor: "pointer" }}>
                    ✓ Aprovar
                  </button>
                </form>
              )}
              {rdo.status === "approved" && (
                <form action={setRdoStatus} style={{ display: "inline" }}>
                  <input type="hidden" name="rdoId" value={rdoId} />
                  <input type="hidden" name="siteId" value={id} />
                  <input type="hidden" name="status" value="draft" />
                  <button type="submit" className="chip" style={{ cursor: "pointer" }}>
                    ↺ Reabrir
                  </button>
                </form>
              )}
              <form action={deleteRdo} style={{ display: "inline" }}>
                <input type="hidden" name="rdoId" value={rdoId} />
                <input type="hidden" name="siteId" value={id} />
                <button
                  type="submit"
                  className="chip"
                  style={{ color: "#b3261e", borderColor: "#f5c6c2", cursor: "pointer" }}
                >
                  Excluir
                </button>
              </form>
            </div>
          </div>
        </div>
      </div>

      <div style={{ padding: "0 24px 32px", maxWidth: 1280, margin: "0 auto" }}>
        {/* Clima */}
        <div style={{ display: "grid", gap: 14, gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", marginBottom: 20 }}>
          <Block title="☀ Clima · Manhã">
            <KV label="Tempo" value={rdo.weather_morning ?? "—"} />
            <KV label="Condição" value={rdo.condition_morning ?? "—"} last />
          </Block>
          <Block title="🌅 Clima · Tarde">
            <KV label="Tempo" value={rdo.weather_afternoon ?? "—"} />
            <KV label="Condição" value={rdo.condition_afternoon ?? "—"} last />
          </Block>
        </div>

        {rdo.general_notes && (
          <Block title="📝 Observações gerais" style={{ marginBottom: 20 }}>
            <div style={{ fontSize: 14, color: "var(--o-text-1)", whiteSpace: "pre-wrap", lineHeight: 1.6 }}>
              {rdo.general_notes}
            </div>
          </Block>
        )}

        {/* Mão de obra */}
        {workforce.length > 0 && (
          <Section title={`Mão de obra · ${totalWorkers} pessoas`}>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 8 }}>
              {workforce.map((w) => (
                <div key={w.id} className="card" style={{ padding: "12px 16px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ fontSize: 13, color: "var(--o-text-1)" }}>{w.role}</span>
                  <span className="tnum" style={{ fontSize: 16, fontWeight: 700, color: "var(--t-brand)" }}>{w.count}</span>
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
                <div key={e.id} className="card" style={{ padding: "12px 16px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ fontSize: 13, color: "var(--o-text-1)" }}>{e.name}</span>
                  {e.hours != null && (
                    <span className="tnum" style={{ fontSize: 12, color: "var(--o-text-2)", fontWeight: 500 }}>{e.hours}h</span>
                  )}
                </div>
              ))}
            </div>
          </Section>
        )}

        {/* Atividades */}
        {activities.length > 0 && (
          <Section title={`Atividades · ${activities.length}`}>
            <div className="card" style={{ overflow: "hidden", padding: 0 }}>
              {activities.map((a, i) => {
                const pct = a.progress_pct ?? 0;
                const done = pct >= 100;
                return (
                  <div key={a.id} style={{
                    display: "flex", alignItems: "center", gap: 14,
                    padding: "14px 22px",
                    borderTop: i === 0 ? "none" : "1px solid var(--o-border)",
                    fontSize: 14,
                  }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 500, marginBottom: a.notes ? 2 : 0, color: "var(--o-text-1)" }}>{a.description}</div>
                      {a.notes && <div style={{ fontSize: 12, color: "var(--o-text-3)" }}>{a.notes}</div>}
                    </div>
                    <div style={{ width: 80 }}>
                      <div style={{ height: 6, background: "var(--o-mist)", borderRadius: 999, overflow: "hidden" }}>
                        <div style={{ width: `${pct}%`, height: "100%", background: done ? "var(--st-done)" : "var(--t-brand)", borderRadius: 999 }} />
                      </div>
                    </div>
                    <span className="tnum" style={{
                      fontSize: 13, fontWeight: 600,
                      minWidth: 42, textAlign: "right",
                      color: done ? "var(--st-done)" : "var(--t-brand)",
                    }}>
                      {pct}%
                    </span>
                  </div>
                );
              })}
            </div>
          </Section>
        )}

        {/* Fotos */}
        <Section title={`Fotos · ${photos.length}`}>
          <div className="card" style={{ padding: "16px 20px", marginBottom: photos.length > 0 ? 14 : 0 }}>
            <div style={{ fontSize: 12, color: "var(--o-text-2)", marginBottom: 10, fontWeight: 500 }}>
              Adicionar fotos / vídeos
            </div>
            <PhotoUploader siteId={id} rdoId={rdoId} />
          </div>
          {photos.length > 0 && (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: 6 }}>
              {photos.map((p) => (
                <div key={p.id} style={{ position: "relative" }}>
                  <a href={mediaUrl(p.storage_path) || "#"} target="_blank" rel="noreferrer"
                    style={{
                      display: "block", aspectRatio: "4 / 3",
                      background: "var(--o-mist)",
                      borderRadius: 8, overflow: "hidden",
                      transition: "transform var(--duration) var(--ease)",
                    }}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={mediaUrl(p.thumbnail_path ?? p.storage_path)} alt={p.caption ?? "Foto"} loading="lazy"
                      style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
                  </a>
                  <form action={deletePhoto} style={{ position: "absolute", top: 6, right: 6 }}>
                    <input type="hidden" name="photoId" value={p.id} />
                    <input type="hidden" name="rdoId" value={rdoId} />
                    <input type="hidden" name="siteId" value={id} />
                    <button type="submit" title="Remover" style={{
                      width: 26, height: 26, borderRadius: 6, border: "none",
                      background: "rgba(20,28,42,0.78)", color: "white", fontSize: 14,
                      cursor: "pointer", lineHeight: 1, display: "grid", placeItems: "center",
                    }}>×</button>
                  </form>
                </div>
              ))}
            </div>
          )}
        </Section>

        {/* Vídeos */}
        {videos.length > 0 && (
          <Section title={`Vídeos · ${videos.length}`}>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 12 }}>
              {videos.map((v) => (
                <a key={v.id} href={mediaUrl(v.storage_path) || "#"} target="_blank" rel="noreferrer"
                  className="card card-hover"
                  style={{ display: "flex", alignItems: "center", gap: 12, padding: "14px 18px", fontSize: 13.5, color: "var(--o-text-1)", textDecoration: "none" }}>
                  <span style={{
                    width: 40, height: 40, borderRadius: 8,
                    background: "var(--t-brand-soft)",
                    display: "grid", placeItems: "center",
                    fontSize: 18,
                  }}>🎬</span>
                  <span style={{ flex: 1, fontWeight: 500 }}>{v.caption ?? "Vídeo"}</span>
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
                <a key={f.id} href={mediaUrl(f.storage_path) || "#"} target="_blank" rel="noreferrer"
                  className="card card-hover"
                  style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 16px", fontSize: 14, color: "var(--o-text-1)", textDecoration: "none" }}>
                  <span style={{ fontSize: 18 }}>📎</span>
                  <span style={{ flex: 1, fontWeight: 500 }}>{f.caption ?? "Anexo"}</span>
                  <span style={{ fontSize: 12, color: "var(--t-brand)", fontWeight: 500 }}>abrir →</span>
                </a>
              ))}
            </div>
          </Section>
        )}

        {/* Comentários e ocorrências */}
        <Section title={`Comentários e ocorrências · ${comments.length}`}>
          <form action={postComment} className="card" style={{ padding: "14px 16px", marginBottom: 12 }}>
            <input type="hidden" name="target_table" value="daily_reports" />
            <input type="hidden" name="target_id" value={rdoId} />
            <input type="hidden" name="redirect_to" value={`/obras/${id}/rdos/${rdoId}`} />
            <textarea name="body" rows={2} required placeholder="Adicione um comentário ou ocorrência…"
              style={{
                width: "100%", border: "1px solid var(--o-border)", borderRadius: 8,
                padding: "10px 12px", font: "400 14px var(--font-inter)", color: "var(--o-text-1)",
                background: "var(--o-paper)", outline: "none", resize: "vertical",
              }} />
            <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 10 }}>
              <button type="submit" className="btn-brand" style={{ padding: "8px 16px", fontSize: 13 }}>
                Comentar
              </button>
            </div>
          </form>
          {comments.length > 0 && (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {comments.map((c) => {
                const isOcorrencia = c.body.startsWith("[OCORRÊNCIA]");
                const display = isOcorrencia ? c.body.replace("[OCORRÊNCIA] ", "") : c.body;
                const accent = isOcorrencia ? "var(--st-late)" : "var(--t-brand)";
                return (
                  <div key={c.id} className="card" style={{
                    padding: "14px 18px",
                    borderLeft: `3px solid ${accent}`,
                  }}>
                    {isOcorrencia && (
                      <div style={{ marginBottom: 6 }}>
                        <span className="status status-late">Ocorrência</span>
                      </div>
                    )}
                    <div style={{ fontSize: 14, lineHeight: 1.55, whiteSpace: "pre-wrap", color: "var(--o-text-1)" }}>{display}</div>
                    {c.created_at && (
                      <div style={{ fontSize: 11, color: "var(--o-text-3)", marginTop: 8 }}>
                        {new Date(c.created_at).toLocaleString("pt-BR", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </Section>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 28 }}>
      <h3 className="section-title">{title}</h3>
      {children}
    </div>
  );
}

function Block({ title, children, style }: { title: string; children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div className="card" style={{ padding: "18px 20px", ...style }}>
      <h3 className="section-title" style={{ marginBottom: 10 }}>{title}</h3>
      {children}
    </div>
  );
}

function KV({ label, value, last }: { label: string; value: string; last?: boolean }) {
  return (
    <div style={{
      display: "flex", justifyContent: "space-between",
      padding: "8px 0",
      fontSize: 14,
      borderBottom: last ? "none" : "1px solid var(--o-border)",
    }}>
      <span style={{ color: "var(--o-text-2)" }}>{label}</span>
      <span style={{ fontWeight: 500, color: "var(--o-text-1)" }}>{value}</span>
    </div>
  );
}
