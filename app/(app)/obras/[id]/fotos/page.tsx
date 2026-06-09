import Link from "next/link";
import { notFound } from "next/navigation";
import { PlayCircle, Printer, Search } from "lucide-react";
import { ObraSidebar } from "@/components/layout/ObraSidebar";
import { PhotoGrid } from "@/components/PhotoLightbox";
import { createServerSupabase } from "@/lib/supabase/server";
import { fetchAllPages } from "@/lib/supabase/fetch-all";
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

function fmtDate(value: string): string {
  return new Date(`${value}T00:00:00`).toLocaleDateString("pt-BR");
}

export default async function ObraFotosPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ relatorio?: string; q?: string; order?: string; tipo?: string }>;
}) {
  const { id } = await params;
  const { relatorio, q, order, tipo } = await searchParams;
  const mediaType = tipo === "video" ? "video" : "photo";
  const queryText = (q ?? "").trim().toLowerCase();
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

  const mediaRows = await fetchAllPages<Photo & { kind: string | null }>(() =>
    supabase
      .from("media")
      .select("id, storage_path, thumbnail_path, caption, taken_at, daily_report_id, kind")
      .eq("site_id", id)
      .in("external_provider", VISIBLE_SOURCE_PROVIDERS)
  );
  const photosAll = mediaRows.filter((media) => media.kind === "photo");
  const videosAll = mediaRows.filter((media) => media.kind === "video");
  const videoCount = videosAll.length;
  const fileCount = mediaRows.filter((media) => media.kind === "file").length;
  const selectedMedia = mediaType === "video" ? videosAll : photosAll;

  const visibleMedia = selectedMedia.filter((media) => {
    if (relatorio && media.daily_report_id !== relatorio) return false;
    if (!queryText) return true;
    const report = media.daily_report_id ? reportMap.get(media.daily_report_id) : null;
    const haystack = `${media.caption ?? ""} ${report ? `${fmtDate(report.date)} ${report.number}` : ""}`.toLowerCase();
    return haystack.includes(queryText);
  });

  const { data: taskRowsRaw } = await supabase
    .from("wbs_items")
    .select("id")
    .eq("site_id", id)
    .in("external_provider", VISIBLE_SOURCE_PROVIDERS)
    .not("parent_id", "is", null);
  const taskRows = (taskRowsRaw ?? []) as { id: string }[];
  const taskCount = taskRows.length;

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

  return (
    <div className="do-obra-layout">
      <ObraSidebar
        site={site}
        active="photos"
        counts={{
          reports: reports.length,
          tasks: taskCount,
          photos: photosAll.length,
          videos: videoCount,
          files: fileCount,
        }}
      />

      <main className="do-obra-main">
        <div className="diario-container">
          <div className="diario-page-header">
            <div>
              <h1>{mediaType === "video" ? "Vídeos" : "Fotos"}</h1>
              <p>Relatórios: {reports.length}</p>
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
