import Link from "next/link";
import { notFound } from "next/navigation";
import { PlayCircle, Printer, Search } from "lucide-react";
import { ObraSidebar } from "@/components/layout/ObraSidebar";
import { PhotoGrid } from "@/components/PhotoLightbox";
import { createServerSupabase } from "@/lib/supabase/server";
import { VISIBLE_SOURCE_PROVIDERS } from "@/lib/rdo-source-scope";
import { mediaUrl } from "@/lib/storage";

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
  searchParams: Promise<{ relatorio?: string; q?: string; order?: string; tipo?: string; page?: string }>;
}) {
  const { id } = await params;
  const { relatorio, q, order, tipo, page } = await searchParams;
  const mediaType = tipo === "video" ? "video" : "photo";
  const queryText = (q ?? "").trim().toLowerCase();
  const pageNum = Math.max(1, parseInt(page ?? "1", 10) || 1);
  const offset = (pageNum - 1) * PER_PAGE;
  const supabase = await createServerSupabase();

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
      .in("external_provider", VISIBLE_SOURCE_PROVIDERS)
      .eq("kind", "photo"),
    supabase
      .from("media")
      .select("*", { count: "exact", head: true })
      .eq("site_id", id)
      .in("external_provider", VISIBLE_SOURCE_PROVIDERS)
      .eq("kind", "video"),
    supabase
      .from("media")
      .select("*", { count: "exact", head: true })
      .eq("site_id", id)
      .in("external_provider", VISIBLE_SOURCE_PROVIDERS)
      .eq("kind", "file"),
    supabase
      .from("wbs_items")
      .select("*", { count: "exact", head: true })
      .eq("site_id", id)
      .in("external_provider", VISIBLE_SOURCE_PROVIDERS)
      .not("parent_id", "is", null),
  ]);

  // Total do recorte atual (tipo + relatório) pra calcular as páginas
  let filteredCountQuery = supabase
    .from("media")
    .select("*", { count: "exact", head: true })
    .eq("site_id", id)
    .in("external_provider", VISIBLE_SOURCE_PROVIDERS)
    .eq("kind", mediaType);
  if (relatorio) filteredCountQuery = filteredCountQuery.eq("daily_report_id", relatorio);
  const { count: filteredCount } = await filteredCountQuery;
  const filteredTotal = filteredCount ?? 0;
  const totalPages = Math.max(1, Math.ceil(filteredTotal / PER_PAGE));

  // Página atual de mídias (range no servidor, sem fetchAllPages)
  let mediaQuery = supabase
    .from("media")
    .select("id, storage_path, thumbnail_path, caption, taken_at, daily_report_id")
    .eq("site_id", id)
    .in("external_provider", VISIBLE_SOURCE_PROVIDERS)
    .eq("kind", mediaType)
    .order("taken_at", { ascending: order === "asc", nullsFirst: false });
  if (relatorio) mediaQuery = mediaQuery.eq("daily_report_id", relatorio);
  const { data: mediaRaw } = await mediaQuery.range(offset, offset + PER_PAGE - 1);
  const selectedMedia = (mediaRaw ?? []) as Photo[];

  // Busca textual aplicada sobre a página atual
  const visibleMedia = selectedMedia.filter((media) => {
    if (!queryText) return true;
    const report = media.daily_report_id ? reportMap.get(media.daily_report_id) : null;
    const haystack = `${media.caption ?? ""} ${report ? `${fmtDate(report.date)} ${report.number}` : ""}`.toLowerCase();
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

          <section className="do-panel">
            {orderedGroups.length === 0 ? (
              <div style={{ padding: 18, color: "#777", fontSize: 12 }}>
                {mediaType === "video" ? "Nenhum vídeo encontrado." : "Nenhuma foto encontrada."}
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
