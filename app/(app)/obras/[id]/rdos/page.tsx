import Link from "next/link";
import { notFound } from "next/navigation";
import { Camera, FileText, Pencil, Printer, Search } from "lucide-react";
import { ObraSidebar } from "@/components/layout/ObraSidebar";
import { createServerSupabase } from "@/lib/supabase/server";
import { VISIBLE_SOURCE_PROVIDERS } from "@/lib/rdo-source-scope";

type Site = {
  id: string;
  name: string;
  cover_url: string | null;
};

type DailyReport = {
  id: string;
  number: number;
  date: string;
  status: string;
};

const STATUS_META: Record<string, { label: string; cls: string }> = {
  draft: { label: "Rascunho", cls: "is-paused" },
  submitted: { label: "Enviado", cls: "" },
  review: { label: "Em revisão", cls: "" },
  approved: { label: "Aprovado", cls: "is-done" },
};

const PER_PAGE = 50;

function fmtDate(value: string): string {
  return new Date(`${value}T00:00:00`).toLocaleDateString("pt-BR");
}

export default async function ObraRdosPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ status?: string; q?: string; order?: string; page?: string }>;
}) {
  const { id } = await params;
  const { status: rawFilter, q, order, page } = await searchParams;
  const filter =
    rawFilter && ["draft", "submitted", "review", "approved"].includes(rawFilter)
      ? rawFilter
      : undefined;
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

  // Contador total (sem filtro) — head:true não traz linhas, só o count
  const { count: totalAllCount } = await supabase
    .from("daily_reports")
    .select("*", { count: "exact", head: true })
    .eq("site_id", id)
    .in("external_provider", VISIBLE_SOURCE_PROVIDERS);
  const totalAll = totalAllCount ?? 0;

  // Contador do filtro ativo (pra calcular as páginas)
  let filteredTotal = totalAll;
  if (filter) {
    const { count } = await supabase
      .from("daily_reports")
      .select("*", { count: "exact", head: true })
      .eq("site_id", id)
      .in("external_provider", VISIBLE_SOURCE_PROVIDERS)
      .eq("status", filter);
    filteredTotal = count ?? 0;
  }
  const totalPages = Math.max(1, Math.ceil(filteredTotal / PER_PAGE));

  let rdoQuery = supabase
    .from("daily_reports")
    .select("id, number, date, status")
    .eq("site_id", id)
    .in("external_provider", VISIBLE_SOURCE_PROVIDERS)
    .order("number", { ascending: order === "asc" });

  if (filter) {
    rdoQuery = rdoQuery.eq("status", filter);
  }

  const { data: reportsRaw } = await rdoQuery.range(offset, offset + PER_PAGE - 1);
  const pageReports = (reportsRaw ?? []) as DailyReport[];
  // Busca textual aplicada sobre a página atual (server-side viria depois)
  const reports = queryText
    ? pageReports.filter((report) => {
        const haystack = `${report.number} ${fmtDate(report.date)} ${STATUS_META[report.status]?.label ?? report.status}`.toLowerCase();
        return haystack.includes(queryText);
      })
    : pageReports;

  // Contadores da sidebar via head:true (sem baixar linhas)
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

  // Fotos por RDO: só dos relatórios visíveis nesta página
  const photoCounts = new Map<string, number>();
  if (reports.length > 0) {
    const { data: mediaRowsRaw } = await supabase
      .from("media")
      .select("daily_report_id")
      .eq("site_id", id)
      .in("external_provider", VISIBLE_SOURCE_PROVIDERS)
      .eq("kind", "photo")
      .in("daily_report_id", reports.map((report) => report.id));
    const mediaRows = (mediaRowsRaw ?? []) as { daily_report_id: string | null }[];
    for (const media of mediaRows) {
      if (!media.daily_report_id) continue;
      photoCounts.set(media.daily_report_id, (photoCounts.get(media.daily_report_id) ?? 0) + 1);
    }
  }

  // Monta href preservando filtros ao trocar de página
  const pageHref = (p: number) => {
    const sp = new URLSearchParams();
    if (filter) sp.set("status", filter);
    if (q) sp.set("q", q);
    if (order) sp.set("order", order);
    if (p > 1) sp.set("page", String(p));
    const qs = sp.toString();
    return `/obras/${id}/rdos${qs ? `?${qs}` : ""}`;
  };

  return (
    <div className="do-obra-layout">
      <ObraSidebar
        site={site}
        active="reports"
        counts={{
          reports: totalAll,
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
              <h1>Relatórios ({totalAll})</h1>
              <p>
                {site.name}
                {totalPages > 1 ? (
                  <span className="tnum"> · página {pageNum} de {totalPages}</span>
                ) : null}
              </p>
            </div>
            <form method="get" action={`/obras/${id}/rdos`} className="diario-toolbar">
              <select className="diario-select" name="status" defaultValue={filter ?? ""}>
                <option value="">Todos os relatórios</option>
                <option value="approved">Aprovados</option>
                <option value="review">Em revisão</option>
                <option value="draft">Rascunhos</option>
              </select>
              <input className="diario-input" name="q" defaultValue={q ?? ""} placeholder="Pesquisa" />
              <select className="diario-select" name="order" defaultValue={order ?? "desc"}>
                <option value="desc">Ordem decrescente</option>
                <option value="asc">Ordem crescente</option>
              </select>
              <button className="diario-blue-button" type="submit" title="Pesquisar">
                <Search size={16} />
              </button>
              <Link href={`/obras/${id}/rdos/novo`} className="diario-blue-button">
                Novo RDO
              </Link>
            </form>
          </div>

          <section className="do-panel">
            <div className="do-table-wrap">
              <table className="do-table">
                <thead>
                  <tr>
                    <th>Data</th>
                    <th>N°</th>
                    <th>Status</th>
                    <th>Modelo de relatório</th>
                    <th>Fotos</th>
                    <th>Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {reports.map((report) => {
                    const meta = STATUS_META[report.status] ?? STATUS_META.draft;
                    return (
                      <tr key={report.id}>
                        <td>
                          <Link href={`/obras/${id}/rdos/${report.id}`}>{fmtDate(report.date)}</Link>
                        </td>
                        <td className="tnum">{report.number}</td>
                        <td>
                          <span className={`diario-status-badge ${meta.cls}`}>{meta.label}</span>
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
                            {photoCounts.get(report.id) ?? 0}
                          </span>
                        </td>
                        <td>
                          <span className="do-row-actions">
                            <Link href={`/obras/${id}/rdos/${report.id}/imprimir`} title="Imprimir">
                              <Printer size={15} />
                            </Link>
                            <Link href={`/obras/${id}/rdos/${report.id}/editar`} title="Editar">
                              <Pencil size={15} />
                            </Link>
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                  {reports.length === 0 ? (
                    <tr>
                      <td colSpan={6}>Nenhum relatório encontrado.</td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
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
