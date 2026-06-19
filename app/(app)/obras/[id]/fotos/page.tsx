import Link from "next/link";
import { notFound } from "next/navigation";
import { PlayCircle, Printer, Search } from "lucide-react";
import { ObraSidebar } from "@/components/layout/ObraSidebar";
import { PhotoGrid } from "@/components/PhotoLightbox";
import { PhotoAiPanel } from "@/components/PhotoAiPanel";
import { createServerSupabase } from "@/lib/supabase/server";
import { untypedDb, type DbQuery } from "@/lib/supabase/untyped";
import { VISIBLE_SOURCE_PROVIDERS, MEDIA_SOURCE_PROVIDERS, WBS_SOURCE_PROVIDERS } from "@/lib/rdo-source-scope";
import { getCurrentRole, canWrite } from "@/lib/permissions";
import { mediaUrl } from "@/lib/storage";
import { AI_STAGES, AI_STAGE_LABELS, isAiStage, normalizeAiFlags } from "@/lib/ai-photo-meta";

type Site = {
  id: string;
  name: string;
  cover_url: string | null;
};

type DailyReport = {
  id: string;
  number: number;
  date: string;
};

type Photo = {
  id: string;
  storage_path: string | null;
  thumbnail_path: string | null;
  caption: string | null;
  taken_at: string | null;
  daily_report_id: string | null;
  ai_caption: string | null;
  ai_stage: string | null;
  ai_flags: unknown;
};

const PER_PAGE = 100;

function fmtDate(value: string): string {
  return new Date(`${value}T00:00:00`).toLocaleDateString("pt-BR");
}

export default async function ObraFotosPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{
    relatorio?: string; q?: string; order?: string; tipo?: string; page?: string;
    etapa?: string; flags?: string; ia?: string; iaerr?: string; iagrande?: string;
  }>;
}) {
  const { id } = await params;
  const { relatorio, q, order, tipo, page, etapa, flags, ia, iaerr, iagrande } = await searchParams;
  const mediaType = tipo === "video" ? "video" : "photo";
  const queryText = (q ?? "").trim().toLowerCase();
  const pageNum = Math.max(1, parseInt(page ?? "1", 10) || 1);
  const offset = (pageNum - 1) * PER_PAGE;
  // Filtros de IA só fazem sentido pra fotos
  const stageFilter = mediaType === "photo" && etapa && isAiStage(etapa) ? etapa : null;
  const flagsFilter = mediaType === "photo" && flags === "1";
  const supabase = await createServerSupabase();
  const db = untypedDb(supabase);
  const role = await getCurrentRole();
  const canEdit = canWrite(role);

  const { data: siteRaw } = await supabase
    .from("sites")
    .select("id, name, cover_url")
    .eq("id", id)
    .in("external_provider", VISIBLE_SOURCE_PROVIDERS)
    .maybeSingle();
  const site = siteRaw as Site | null;
  if (!site) notFound();

  const { data: reportsRaw } = await supabase
    .from("daily_reports")
    .select("id, number, date")
    .eq("site_id", id)
    .in("external_provider", VISIBLE_SOURCE_PROVIDERS)
    .order("number", { ascending: order === "asc" });
  const reports = (reportsRaw ?? []) as DailyReport[];
  const reportMap = new Map(reports.map((report) => [report.id, report]));

  // Contadores da sidebar via head:true — sem baixar a tabela media inteira
  const [
    { count: photoTotalCount },
    { count: videoTotalCount },
    { count: fileTotalCount },
    { count: taskTotalCount },
  ] = await Promise.all([
    supabase
      .from("media")
      .select("*", { count: "exact", head: true })
      .eq("site_id", id)
      .in("external_provider", MEDIA_SOURCE_PROVIDERS)
      .eq("kind", "photo"),
    supabase
      .from("media")
      .select("*", { count: "exact", head: true })
      .eq("site_id", id)
      .in("external_provider", MEDIA_SOURCE_PROVIDERS)
      .eq("kind", "video"),
    supabase
      .from("media")
      .select("*", { count: "exact", head: true })
      .eq("site_id", id)
      .in("external_provider", MEDIA_SOURCE_PROVIDERS)
      .eq("kind", "file"),
    supabase
      .from("wbs_items")
      .select("*", { count: "exact", head: true })
      .eq("site_id", id)
      .in("external_provider", WBS_SOURCE_PROVIDERS)
      .not("parent_id", "is", null),
  ]);

  // Aplica os filtros comuns (tipo + relatório + IA) em qualquer query de media
  const applyMediaFilters = <T,>(query: DbQuery<T>): DbQuery<T> => {
    let q2 = query
      .eq("site_id", id)
      .in("external_provider", MEDIA_SOURCE_PROVIDERS)
      .eq("kind", mediaType);
    if (relatorio) q2 = q2.eq("daily_report_id", relatorio);
    if (stageFilter) q2 = q2.eq("ai_stage", stageFilter);
    if (flagsFilter) q2 = q2.not("ai_flags", "eq", "[]");
    return q2;
  };

  // Total do recorte atual (tipo + relatório + IA) pra calcular as páginas
  const { count: filteredCount } = await applyMediaFilters(
    db.from("media").select("*", { count: "exact", head: true }),
  );
  const filteredTotal = filteredCount ?? 0;
  const totalPages = Math.max(1, Math.ceil(filteredTotal / PER_PAGE));

  // Página atual de mídias (range no servidor, sem fetchAllPages).
  // untypedDb: os campos ai_* ainda não estão em database.types.ts.
  const { data: mediaRaw } = await applyMediaFilters(
    db.from<Photo[]>("media").select(
      "id, storage_path, thumbnail_path, caption, taken_at, daily_report_id, ai_caption, ai_stage, ai_flags",
    ),
  )
    .order("taken_at", { ascending: order === "asc", nullsFirst: false })
    .range(offset, offset + PER_PAGE - 1);
  const selectedMedia = mediaRaw ?? [];

  // Controles de IA: fotos pendentes de análise + alertas de segurança (30 dias)
  let pendingCount = 0;
  let flaggedPhotoCount = 0;
  let flagTotal = 0;
  if (mediaType === "photo") {
    const cutoff30d = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const [pendingR, flaggedR] = await Promise.all([
      db.from("media")
        .select("*", { count: "exact", head: true })
        .eq("site_id", id)
        .in("external_provider", MEDIA_SOURCE_PROVIDERS)
        .eq("kind", "photo")
        .is("ai_analyzed_at", null),
      db.from<{ ai_flags: unknown }[]>("media")
        .select("ai_flags")
        .eq("site_id", id)
        .in("external_provider", MEDIA_SOURCE_PROVIDERS)
        .eq("kind", "photo")
        .gte("taken_at", cutoff30d)
        .not("ai_flags", "eq", "[]")
        .limit(500),
    ]);
    pendingCount = pendingR.count ?? 0;
    const flaggedRows = flaggedR.data ?? [];
    flaggedPhotoCount = flaggedRows.length;
    flagTotal = flaggedRows.reduce((sum, row) => sum + normalizeAiFlags(row.ai_flags).length, 0);
  }
  const analyzedNotice = ia !== undefined ? Math.max(0, parseInt(ia, 10) || 0) : null;

  // Busca textual aplicada sobre a página atual
  const visibleMedia = selectedMedia.filter((media) => {
    if (!queryText) return true;
    const report = media.daily_report_id ? reportMap.get(media.daily_report_id) : null;
    const haystack = `${media.caption ?? ""} ${media.ai_caption ?? ""} ${report ? `${fmtDate(report.date)} ${report.number}` : ""}`.toLowerCase();
    return haystack.includes(queryText);
  });

  const grouped = new Map<string, Photo[]>();
  for (const media of visibleMedia) {
    const key = media.daily_report_id ?? "sem-relatorio";
    const list = grouped.get(key) ?? [];
    list.push(media);
    grouped.set(key, list);
  }

  const orderedGroups = Array.from(grouped.entries()).sort(([a], [b]) => {
    if (a === "sem-relatorio") return 1;
    if (b === "sem-relatorio") return -1;
    const ra = reportMap.get(a)?.number ?? 0;
    const rb = reportMap.get(b)?.number ?? 0;
    return order === "asc" ? ra - rb : rb - ra;
  });

  // Monta href preservando filtros ao trocar de página
  const pageHref = (p: number) => {
    const sp = new URLSearchParams();
    if (mediaType === "video") sp.set("tipo", "video");
    if (relatorio) sp.set("relatorio", relatorio);
    if (q) sp.set("q", q);
    if (order) sp.set("order", order);
    if (stageFilter) sp.set("etapa", stageFilter);
    if (flagsFilter) sp.set("flags", "1");
    if (p > 1) sp.set("page", String(p));
    const qs = sp.toString();
    return `/obras/${id}/fotos${qs ? `?${qs}` : ""}`;
  };

  return (
    <div className="do-obra-layout">
      <ObraSidebar
        site={site}
        active="photos"
        counts={{
          reports: reports.length,
          tasks: taskTotalCount ?? 0,
          photos: photoTotalCount ?? 0,
          videos: videoTotalCount ?? 0,
          files: fileTotalCount ?? 0,
        }}
      />

      <main className="do-obra-main">
        <div className="diario-container">
          <div className="diario-page-header">
            <div>
              <h1>
                {mediaType === "video" ? "Vídeos" : "Fotos"} ({filteredTotal})
              </h1>
              <p>
                Relatórios: {reports.length}
                {totalPages > 1 ? (
                  <span className="tnum"> · página {pageNum} de {totalPages}</span>
                ) : null}
              </p>
            </div>
            <form method="get" action={`/obras/${id}/fotos`} className="diario-toolbar">
              {mediaType === "video" ? <input type="hidden" name="tipo" value="video" /> : null}
              {flagsFilter ? <input type="hidden" name="flags" value="1" /> : null}
              <Link className={mediaType === "photo" ? "diario-blue-button" : "diario-gray-button"} href={`/obras/${id}/fotos`}>
                Fotos
              </Link>
              <Link className={mediaType === "video" ? "diario-blue-button" : "diario-gray-button"} href={`/obras/${id}/fotos?tipo=video`}>
                Vídeos
              </Link>
              <select className="diario-select" name="relatorio" defaultValue={relatorio ?? ""}>
                <option value="">Todos os relatórios</option>
                {reports.map((report) => (
                  <option key={report.id} value={report.id}>
                    {fmtDate(report.date)} n° {report.number}
                  </option>
                ))}
              </select>
              {mediaType === "photo" ? (
                <select className="diario-select" name="etapa" defaultValue={stageFilter ?? ""} title="Etapa identificada pela IA">
                  <option value="">Todas as etapas</option>
                  {AI_STAGES.map((stage) => (
                    <option key={stage} value={stage}>
                      {AI_STAGE_LABELS[stage]}
                    </option>
                  ))}
                </select>
              ) : null}
              <input className="diario-input" name="q" defaultValue={q ?? ""} placeholder="Pesquisa" />
              <select className="diario-select" name="order" defaultValue={order ?? "desc"}>
                <option value="desc">Ordem decrescente</option>
                <option value="asc">Ordem crescente</option>
              </select>
              <button className="diario-blue-button" type="submit" title="Pesquisar">
                <Search size={16} />
              </button>
              <button className="diario-gray-button" type="button" title="Imprimir">
                <Printer size={16} />
                Imprimir
              </button>
            </form>
          </div>

          {mediaType === "photo" && (
            <PhotoAiPanel
              siteId={id}
              canEdit={canEdit}
              pendingCount={pendingCount}
              flaggedPhotoCount={flaggedPhotoCount}
              flagTotal={flagTotal}
              flagsActive={flagsFilter}
              analyzedNotice={analyzedNotice}
              failedNotice={iaerr !== undefined ? Math.max(0, parseInt(iaerr, 10) || 0) : 0}
              tooLargeNotice={iagrande !== undefined ? Math.max(0, parseInt(iagrande, 10) || 0) : 0}
            />
          )}

          <section className="do-panel">
            {orderedGroups.length === 0 ? (
              <div style={{ padding: 18, color: "#777", fontSize: 12 }}>
                {mediaType === "video"
                  ? "Nenhum vídeo encontrado."
                  : stageFilter || flagsFilter
                    ? "Nenhuma foto encontrada com esse filtro de IA."
                    : "Nenhuma foto encontrada."}
              </div>
            ) : (
              orderedGroups.map(([reportId, list]) => {
                const report = reportId === "sem-relatorio" ? null : reportMap.get(reportId);
                return (
                  <div key={reportId} className="do-gallery-report">
                    {report ? (
                      <Link href={`/obras/${id}/rdos/${report.id}`} className="do-gallery-report__title">
                        {fmtDate(report.date)} n° {report.number}
                      </Link>
                    ) : (
                      <span className="do-gallery-report__title">Sem relatório</span>
                    )}
                    {mediaType === "video" ? <VideoStrip videos={list} /> : <PhotoGrid photos={list} variant="strip" />}
                  </div>
                );
              })
            )}
          </section>

          {totalPages > 1 && (
            <div
              style={{
                display: "flex",
                justifyContent: "center",
                alignItems: "center",
                gap: 10,
                marginTop: 14,
              }}
            >
              {pageNum > 1 ? (
                <Link href={pageHref(pageNum - 1)} className="diario-gray-button">
                  ← Anteriores
                </Link>
              ) : (
                <span className="diario-gray-button" style={{ opacity: 0.45, pointerEvents: "none" }}>
                  ← Anteriores
                </span>
              )}
              <span className="tnum" style={{ padding: "0 10px", fontSize: 13, color: "#555" }}>
                Página {pageNum} de {totalPages}
              </span>
              {pageNum < totalPages ? (
                <Link href={pageHref(pageNum + 1)} className="diario-gray-button">
                  Próximos →
                </Link>
              ) : (
                <span className="diario-gray-button" style={{ opacity: 0.45, pointerEvents: "none" }}>
                  Próximos →
                </span>
              )}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

function VideoStrip({ videos }: { videos: Photo[] }) {
  return (
    <div className="diario-video-strip">
      {videos.map((video) => (
        <a key={video.id} href={mediaUrl(video.storage_path) || "#"} target="_blank" rel="noreferrer">
          <PlayCircle size={28} />
          <span>{video.caption ?? "Vídeo da obra"}</span>
        </a>
      ))}
    </div>
  );
}
