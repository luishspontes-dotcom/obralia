import { Fragment } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AlertTriangle, Camera, ClipboardList, FileText, MessageSquare, Video } from "lucide-react";
import { ObraSidebar } from "@/components/layout/ObraSidebar";
import { createServerSupabase } from "@/lib/supabase/server";
import { fetchAllPages } from "@/lib/supabase/fetch-all";
import { VISIBLE_SOURCE_PROVIDERS, MEDIA_SOURCE_PROVIDERS } from "@/lib/rdo-source-scope";
import { mediaUrl, thumbUrl } from "@/lib/storage";
import { getCurrentRole, canManageUsers, canWrite } from "@/lib/permissions";
import { untypedDb } from "@/lib/supabase/untyped";
import { uploadObraDocuments } from "@/lib/rdo-actions";
import { createShareLink, revokeShareLink, type ShareLinkRow } from "@/lib/share-actions";
import { recomputeSiteRisk, type RiskFactor } from "@/lib/risk";
import { RiskBadge, riskLevel } from "@/components/RiskBadge";

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
  contract_days: number | null;
  responsible_id: string | null;
  responsible_name: string | null;
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

type DailyReport = {
  id: string;
  number: number;
  date: string;
  status: string;
};

type Photo = {
  id: string;
  storage_path: string | null;
  thumbnail_path: string | null;
  caption: string | null;
  daily_report_id: string | null;
};

type SiteRisk = {
  risk_score: number | null;
  risk_factors: RiskFactor[] | null;
  risk_computed_at: string | null;
};

const SITE_STATUS: Record<string, { label: string; cls: string }> = {
  in_progress: { label: "Em andamento", cls: "" },
  done: { label: "Concluída", cls: "is-done" },
  completed: { label: "Concluída", cls: "is-done" },
  paused: { label: "Pausada", cls: "is-paused" },
  late: { label: "Em risco", cls: "is-late" },
  not_started: { label: "Não iniciada", cls: "is-planned" },
  planned: { label: "Não iniciada", cls: "is-planned" },
};

const TASK_STATUS: Record<string, { label: string; cls: string }> = {
  waiting: { label: "Não iniciada", cls: "is-planned" },
  in_progress: { label: "Em andamento", cls: "" },
  done: { label: "Concluída", cls: "is-done" },
  late: { label: "Atrasada", cls: "is-late" },
  paused: { label: "Pausada", cls: "is-paused" },
};

function fmtDate(value: string | null): string {
  if (!value) return "";
  return new Date(`${value}T00:00:00`).toLocaleDateString("pt-BR");
}

function daysBetween(start: string | null, end: string | null): { total: number | null; elapsed: number | null; remaining: number | null; pct: number } {
  if (!start || !end) return { total: null, elapsed: null, remaining: null, pct: 0 };
  const startMs = new Date(`${start}T00:00:00`).getTime();
  const endMs = new Date(`${end}T00:00:00`).getTime();
  if (!Number.isFinite(startMs) || !Number.isFinite(endMs) || endMs <= startMs) {
    return { total: null, elapsed: null, remaining: null, pct: 0 };
  }
  const day = 1000 * 60 * 60 * 24;
  // Prazo contratual inclusivo (conta o dia inicial e o final), igual ao Diário de Obra:
  // 19/06 → 31/12 = 196 dias.
  const total = Math.round((endMs - startMs) / day) + 1;
  const todayMs = Date.now();
  const elapsedRaw = Math.ceil((todayMs - startMs) / day);
  const elapsed = Math.min(Math.max(elapsedRaw, 0), total);
  const remaining = Math.max(total - elapsed, 0);
  const pct = total > 0 ? Math.round((elapsed / total) * 100) : 0;
  return { total, elapsed, remaining, pct };
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
    .select("id, name, status, client_name, start_date, end_date, address, cover_url, contract_number, contract_days, responsible_id, responsible_name")
    .eq("id", id)
    .in("external_provider", VISIBLE_SOURCE_PROVIDERS)
    .maybeSingle();

  const site = siteRaw as Site | null;
  if (!site) notFound();

  const { data: itemsRaw } = await supabase
    .from("wbs_items")
    .select("id, parent_id, name, code, status, position, progress_pct, due_date")
    .eq("site_id", id)
    .in("external_provider", VISIBLE_SOURCE_PROVIDERS)
    .order("position");
  const items = (itemsRaw ?? []) as WbsItem[];

  const phases = items
    .filter((item) => item.parent_id === null)
    .sort((a, b) => (a.position ?? 0) - (b.position ?? 0));
  const tasks = items.filter((item) => item.parent_id !== null);
  const tasksByPhase = new Map<string, WbsItem[]>();
  for (const task of tasks) {
    const list = tasksByPhase.get(task.parent_id ?? "") ?? [];
    list.push(task);
    tasksByPhase.set(task.parent_id ?? "", list);
  }

  const taskStats = {
    total: tasks.length,
    done: tasks.filter((task) => task.status === "done").length,
    inProgress: tasks.filter((task) => task.status === "in_progress").length,
    late: tasks.filter((task) => task.status === "late").length,
  };

  const { data: reportsRaw } = await supabase
    .from("daily_reports")
    .select("id, number, date, status")
    .eq("site_id", id)
    .in("external_provider", VISIBLE_SOURCE_PROVIDERS)
    .order("date", { ascending: false })
    .order("number", { ascending: false });
  const reports = (reportsRaw ?? []) as DailyReport[];

  const mediaRows = await fetchAllPages<Photo & { kind: string | null }>(() =>
    supabase
      .from("media")
      .select("id, storage_path, thumbnail_path, caption, daily_report_id, kind")
      .eq("site_id", id)
      .in("external_provider", MEDIA_SOURCE_PROVIDERS)
  );
  const photos = mediaRows.filter((media) => media.kind === "photo");
  const videos = mediaRows.filter((media) => media.kind === "video");
  const files = mediaRows.filter((media) => media.kind === "file");

  const reportPhotoCounts = new Map<string, number>();
  for (const photo of photos) {
    if (!photo.daily_report_id) continue;
    reportPhotoCounts.set(photo.daily_report_id, (reportPhotoCounts.get(photo.daily_report_id) ?? 0) + 1);
  }

  const recentPhotos = photos.slice(0, 12);

  const { count: commentCount } = await supabase
    .from("comments")
    .select("*", { count: "exact", head: true })
    .eq("target_id", id);

  const db = untypedDb(supabase);

  // Ocorrências — atividades de RDO com anotações (não há tabela própria de ocorrências)
  const { count: occurrenceCountRaw } = await db
    .from("report_activities")
    .select("id, daily_reports!inner(site_id)", { count: "exact", head: true })
    .eq("daily_reports.site_id", id)
    .not("notes", "is", null);
  const occurrenceCount = occurrenceCountRaw ?? 0;

  // Responsável pela obra (sites.responsible_id → profiles)
  let responsibleName: string | null = null;
  if (site.responsible_id) {
    const { data: responsibleRaw } = await supabase
      .from("profiles")
      .select("full_name")
      .eq("id", site.responsible_id)
      .maybeSingle();
    responsibleName = (responsibleRaw as { full_name: string | null } | null)?.full_name ?? null;
  }

  const siteStatus = SITE_STATUS[site.status] ?? SITE_STATUS.in_progress;
  const schedule = daysBetween(site.start_date, site.end_date);
  const contractDays = schedule.total ?? site.contract_days;

  // Portal do cliente — apenas administradores gerenciam links públicos
  const role = await getCurrentRole();
  const isAdmin = canManageUsers(role);
  const writer = canWrite(role);

  // Risco de atraso — pré-calculado em sites.risk_* (lib/risk.ts)
  const { data: riskRaw } = await db
    .from<SiteRisk>("sites")
    .select("risk_score, risk_factors, risk_computed_at")
    .eq("id", id)
    .maybeSingle();
  const risk = (riskRaw ?? null) as SiteRisk | null;
  const riskFactors: RiskFactor[] = Array.isArray(risk?.risk_factors) ? risk.risk_factors : [];

  let shareLinks: ShareLinkRow[] = [];
  if (isAdmin) {
    const { data: linksRaw } = await db
      .from<ShareLinkRow[]>("share_links")
      .select("id, token, label, created_at, expires_at, revoked_at")
      .eq("site_id", id)
      .is("revoked_at", null)
      .order("created_at", { ascending: false });
    shareLinks = (linksRaw ?? []) as ShareLinkRow[];
  }
  const portalBase =
    process.env.NEXT_PUBLIC_APP_URL?.trim() ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "") ||
    "https://www.obralia.com.br";

  return (
    <div className="do-obra-layout">
      <ObraSidebar
        site={site}
        active="overview"
        counts={{
          reports: reports.length,
          tasks: taskStats.total,
          photos: photos.length,
          videos: videos.length,
          files: files.length,
        }}
      />

      <main className="do-obra-main">
        <div className="diario-container">
          <div className="do-obra-header">
            <h1>{site.name}</h1>
          </div>

          <div className="do-metric-grid">
            <Metric href={`/obras/${id}/rdos`} value={reports.length} label="Relatórios" icon={<FileText size={24} />} />
            <Metric href={`/obras/${id}/tarefas`} value={taskStats.total} label="Atividades" icon={<ClipboardList size={24} />} />
            <Metric href={`/obras/${id}/rdos`} value={occurrenceCount} label="Ocorrências" icon={<AlertTriangle size={24} />} />
            <Metric href="/comentarios" value={commentCount ?? 0} label="Comentários" icon={<MessageSquare size={24} />} />
            <Metric href={`/obras/${id}/fotos`} value={photos.length} label="Fotos" icon={<Camera size={24} />} />
            <Metric href={`/obras/${id}/fotos?tipo=video`} value={videos.length} label="Vídeos" icon={<Video size={24} />} />
          </div>

          <div className="do-dashboard-grid">
            <section className="do-panel">
              <div className="do-panel__header">
                <h2>Relatórios recentes</h2>
                <Link href={`/obras/${id}/rdos`}>Ver tudo</Link>
              </div>
              <div className="do-table-wrap">
                <table className="do-table">
                  <thead>
                    <tr>
                      <th>Data</th>
                      <th>N°</th>
                      <th>Status</th>
                      <th>Modelo de relatório</th>
                      <th>Fotos</th>
                    </tr>
                  </thead>
                  <tbody>
                    {reports.slice(0, 7).map((report) => (
                      <tr key={report.id}>
                        <td>
                          <Link href={`/obras/${id}/rdos/${report.id}`}>{fmtDate(report.date)}</Link>
                        </td>
                        <td className="tnum">{report.number}</td>
                        <td>
                          <span className="diario-status-badge is-done">
                            {report.status === "approved" ? "Aprovado" : report.status}
                          </span>
                        </td>
                        <td>
                          <span className="do-report-model">
                            <FileText size={13} />
                            Relatório Diário de Obra (RDO)
                          </span>
                        </td>
                        <td>
                          <span className="do-photo-count">
                            <Camera size={13} />
                            {reportPhotoCounts.get(report.id) ?? 0}
                          </span>
                        </td>
                      </tr>
                    ))}
                    {reports.length === 0 ? (
                      <tr>
                        <td colSpan={5}>Nenhum relatório cadastrado.</td>
                      </tr>
                    ) : null}
                  </tbody>
                </table>
              </div>
            </section>

            <section className="do-panel">
              <div className="do-panel__header">
                <h2>Fotos recentes</h2>
                <Link href={`/obras/${id}/fotos`}>Ver tudo</Link>
              </div>
              {recentPhotos.length > 0 ? (
                <div className="do-photo-mosaic">
                  {recentPhotos.map((photo) => (
                    <a key={photo.id} href={mediaUrl(photo.storage_path)} target="_blank" rel="noreferrer">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={thumbUrl(photo.thumbnail_path ?? photo.storage_path, 400)} alt={photo.caption ?? "Foto da obra"} loading="lazy" decoding="async" />
                    </a>
                  ))}
                </div>
              ) : (
                <div style={{ padding: 14, color: "#777", fontSize: 12 }}>Nenhuma foto cadastrada.</div>
              )}
            </section>
          </div>

          <section className="do-panel" style={{ marginBottom: 18 }}>
            <div className="do-panel__header">
              <h2>Informações da obra</h2>
              <Link href={`/obras/${id}/editar`}>Editar</Link>
            </div>
            <div className="do-info-grid">
              <Info label="Status">
                <span className={`diario-status-badge ${siteStatus.cls}`}>{siteStatus.label}</span>
              </Info>
              <Info label="N° do contrato">
                <strong>{site.contract_number || "—"}</strong>
              </Info>
              <Info label="Prazo decorrido">
                <div className="do-progress">
                  <span style={{ width: `${schedule.pct}%` }}>{schedule.pct}%</span>
                </div>
              </Info>
              <Info label="Endereço">
                <p>{site.address || "—"}</p>
              </Info>
              <Info label="Prazo contratual">
                <strong>{contractDays != null ? `${contractDays} dias` : "—"}</strong>
              </Info>
              <Info label="Prazo decorrido">
                <strong>{schedule.elapsed != null ? `${schedule.elapsed} dias` : "—"}</strong>
              </Info>
              <Info label="Prazo a vencer">
                <strong>{schedule.remaining != null ? `${schedule.remaining} dias` : "—"}</strong>
              </Info>
              <Info label="Responsável">
                <strong>{site.responsible_name || responsibleName || "—"}</strong>
              </Info>
              <Info label="Contratante">
                <strong>{site.client_name || "—"}</strong>
              </Info>
              <Info label="Data início">
                <strong>{fmtDate(site.start_date) || "—"}</strong>
              </Info>
              <Info label="Previsão de término">
                <strong>{fmtDate(site.end_date) || "—"}</strong>
              </Info>
            </div>
          </section>

          <section id="risco-de-atraso" className="do-panel" style={{ marginBottom: 18 }}>
            <div className="do-panel__header">
              <h2>🎯 Risco de atraso</h2>
              {writer ? (
                <form action={recomputeSiteRisk} style={{ display: "inline" }}>
                  <input type="hidden" name="siteId" value={id} />
                  <button
                    type="submit"
                    className="chip"
                    style={{ cursor: "pointer", fontSize: 12 }}
                    title="Recalcula o risco a partir dos dados históricos desta obra"
                  >
                    ↺ Recalcular
                  </button>
                </form>
              ) : null}
            </div>
            <div style={{ padding: "14px 16px" }}>
              {risk?.risk_computed_at ? (
                <>
                  <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap", marginBottom: 14 }}>
                    <span
                      className="tnum"
                      style={{
                        font: "700 34px var(--font-inter)",
                        letterSpacing: "-0.02em",
                        color: riskLevel(risk.risk_score).color,
                      }}
                    >
                      {risk.risk_score != null ? Math.round(risk.risk_score) : "—"}
                    </span>
                    <RiskBadge score={risk.risk_score} />
                    <span style={{ fontSize: 12, color: "#777" }}>
                      Calculado em {new Date(risk.risk_computed_at).toLocaleString("pt-BR")}
                    </span>
                  </div>
                  {riskFactors.length > 0 ? (
                    <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
                      {riskFactors.map((f) => (
                        <div
                          key={f.fator}
                          style={{ display: "flex", gap: 10, alignItems: "baseline", fontSize: 13, lineHeight: 1.45 }}
                        >
                          <span
                            className="tnum"
                            style={{
                              minWidth: 36,
                              textAlign: "right",
                              fontWeight: 700,
                              color: f.peso > 0 ? "#e53935" : "#39b54a",
                            }}
                          >
                            {f.peso > 0 ? `+${f.peso}` : "0"}
                          </span>
                          <strong style={{ minWidth: 150, color: "var(--o-text-1, #1B2733)" }}>{f.fator}</strong>
                          <span style={{ color: "var(--o-text-2, #5C6B72)" }}>{f.detalhe}</span>
                        </div>
                      ))}
                    </div>
                  ) : null}
                </>
              ) : (
                <p style={{ margin: 0, fontSize: 12.5, color: "#777" }}>
                  Risco ainda não calculado para esta obra.
                  {writer ? " Clique em “↺ Recalcular” para analisar prazo, ritmo, clima, efetivo e tarefas vencidas." : ""}
                </p>
              )}
            </div>
          </section>

          <section id="lista-de-tarefas" className="do-panel" style={{ marginBottom: 18 }}>
            <div className="do-panel__header">
              <h2>Lista de tarefas</h2>
              <Link href={`/obras/${id}/tarefas`}>Ver todas</Link>
            </div>
            <div className="do-table-wrap">
              <table className="do-table">
                <tbody>
                  {phases.map((phase) => {
                    const phaseTasks = tasksByPhase.get(phase.id) ?? [];
                    const phaseDone = phaseTasks.filter((task) => task.status === "done").length;
                    const phasePct = phaseTasks.length > 0 ? Math.round((phaseDone / phaseTasks.length) * 100) : 0;
                    return (
                      <Fragment key={phase.id}>
                        <tr key={phase.id} className="do-task-phase">
                          <td className="tnum">{phase.code}</td>
                          <td>{phase.name}</td>
                          <td />
                          <td className="tnum">{phasePct.toFixed(2)}%</td>
                          <td />
                        </tr>
                        {phaseTasks.map((task) => {
                          const meta = TASK_STATUS[task.status ?? "waiting"] ?? TASK_STATUS.waiting;
                          return (
                            <tr key={task.id}>
                              <td className="tnum">{task.code}</td>
                              <td>{task.name}</td>
                              <td>1 vb</td>
                              <td>
                                <span className="tnum" style={{ marginRight: 8 }}>{task.progress_pct ?? 0}%</span>
                                <span className="do-task-progress">
                                  <span style={{ width: `${task.progress_pct ?? 0}%` }} />
                                </span>
                              </td>
                              <td>
                                <span className={`diario-status-badge ${meta.cls}`}>{meta.label}</span>
                              </td>
                            </tr>
                          );
                        })}
                      </Fragment>
                    );
                  })}
                  {phases.length === 0 ? (
                    <tr>
                      <td>Esta obra ainda não tem lista de tarefas.</td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </section>

          {(files.length > 0 || writer) ? (
            <section id="documentos" className="do-panel">
              <div className="do-panel__header">
                <h2>Documentos da obra</h2>
              </div>
              {writer ? (
                <form action={uploadObraDocuments} style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", padding: "12px 14px", borderBottom: "1px solid var(--o-border)" }}>
                  <input type="hidden" name="siteId" value={id} />
                  <input type="file" name="documents" multiple style={{ flex: "1 1 260px" }} />
                  <button type="submit" className="diario-blue-button">Enviar documento</button>
                  <span style={{ fontSize: 12, color: "var(--o-text-3)" }}>Projetos, plantas, contratos… (até 25MB cada)</span>
                </form>
              ) : null}
              {files.length > 0 ? (
                <div className="do-table-wrap">
                  <table className="do-table">
                    <tbody>
                      {files.map((file) => (
                        <tr key={file.id}>
                          <td>
                            <a href={mediaUrl(file.storage_path)} target="_blank" rel="noreferrer">
                              {file.caption ?? "Documento"}
                            </a>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div style={{ padding: "14px", fontSize: 13, color: "var(--o-text-3)" }}>Nenhum documento ainda.</div>
              )}
            </section>
          ) : null}

          {isAdmin ? (
            <section id="portal-do-cliente" className="do-panel" style={{ marginTop: 18 }}>
              <div className="do-panel__header">
                <h2>🔗 Portal do cliente</h2>
                <span style={{ color: "#777", fontSize: 12 }}>
                  {shareLinks.length} {shareLinks.length === 1 ? "link ativo" : "links ativos"}
                </span>
              </div>
              <div style={{ padding: "14px 16px" }}>
                <p style={{ margin: "0 0 12px", fontSize: 12.5, color: "#777" }}>
                  Compartilhe um link público (sem login) com o cliente: ele vê o andamento da obra,
                  os relatórios aprovados e as fotos recentes — sem custos nem dados internos.
                </p>

                {shareLinks.length > 0 ? (
                  <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 14 }}>
                    {shareLinks.map((link) => {
                      const url = `${portalBase}/p/${link.token}`;
                      return (
                        <div key={link.id} style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                          <input
                            readOnly
                            value={url}
                            style={{
                              flex: "1 1 280px", minWidth: 0,
                              border: "1px solid var(--o-border, #ddd)", borderRadius: 8,
                              padding: "8px 10px", fontSize: 12.5,
                              color: "var(--o-text-2, #555)", background: "var(--o-paper, #fafafa)",
                            }}
                          />
                          <span style={{ fontSize: 12, color: "#777", whiteSpace: "nowrap" }}>
                            {link.label ? `${link.label} · ` : ""}criado em {link.created_at ? new Date(link.created_at).toLocaleDateString("pt-BR") : "—"}
                          </span>
                          <form action={revokeShareLink} style={{ display: "inline" }}>
                            <input type="hidden" name="id" value={link.id} />
                            <input type="hidden" name="siteId" value={id} />
                            <button type="submit" className="chip" style={{ color: "#b3261e", borderColor: "#f5c6c2", cursor: "pointer", fontSize: 12 }}>
                              Revogar
                            </button>
                          </form>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div style={{ marginBottom: 14, fontSize: 12.5, color: "#999" }}>
                    Nenhum link ativo. Crie um abaixo para compartilhar com o cliente.
                  </div>
                )}

                <form action={createShareLink} style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                  <input type="hidden" name="siteId" value={id} />
                  <input
                    name="label"
                    placeholder="Rótulo (ex: Cliente — João)"
                    style={{
                      flex: "1 1 220px", minWidth: 0,
                      border: "1px solid var(--o-border, #ddd)", borderRadius: 8,
                      padding: "8px 10px", fontSize: 13, outline: "none",
                    }}
                  />
                  <button type="submit" className="btn-brand" style={{ padding: "8px 16px", fontSize: 13 }}>
                    + Criar link público
                  </button>
                </form>
              </div>
            </section>
          ) : null}
        </div>
      </main>
    </div>
  );
}

function Metric({
  href,
  value,
  label,
  icon,
}: {
  href: string;
  value: number;
  label: string;
  icon: React.ReactNode;
}) {
  return (
    <Link href={href} className="do-metric-card">
      <span>
        <strong className="tnum">{value}</strong>
        {label}
      </span>
      {icon}
    </Link>
  );
}

function Info({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="do-kv">
      <span>{label}</span>
      {children}
    </div>
  );
}
