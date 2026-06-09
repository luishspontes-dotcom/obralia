import Link from "next/link";
import { notFound } from "next/navigation";
import { Camera, FileText, Pencil, Printer, Search } from "lucide-react";
import { ObraSidebar } from "@/components/layout/ObraSidebar";
import { createServerSupabase } from "@/lib/supabase/server";
import { fetchAllPages } from "@/lib/supabase/fetch-all";
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

function fmtDate(value: string): string {
  return new Date(`${value}T00:00:00`).toLocaleDateString("pt-BR");
}

export default async function ObraRdosPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ status?: string; q?: string; order?: string }>;
}) {
  const { id } = await params;
  const { status: filter, q, order } = await searchParams;
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

  let rdoQuery = supabase
    .from("daily_reports")
    .select("id, number, date, status")
    .eq("site_id", id)
    .in("external_provider", VISIBLE_SOURCE_PROVIDERS)
    .order("number", { ascending: order === "asc" });

  if (filter && ["draft", "submitted", "review", "approved"].includes(filter)) {
    rdoQuery = rdoQuery.eq("status", filter);
  }

  const { data: reportsRaw } = await rdoQuery;
  const allReports = (reportsRaw ?? []) as DailyReport[];
  const reports = queryText
    ? allReports.filter((report) => {
        const haystack = `${report.number} ${fmtDate(report.date)} ${STATUS_META[report.status]?.label ?? report.status}`.toLowerCase();
        return haystack.includes(queryText);
      })
    : allReports;

  const mediaRows = await fetchAllPages<{ daily_report_id: string | null; kind: string | null }>(() =>
    supabase
      .from("media")
      .select("daily_report_id, kind")
      .eq("site_id", id)
      .in("external_provider", VISIBLE_SOURCE_PROVIDERS)
  );
  const photoCounts = new Map<string, number>();
  let photoTotal = 0;
  let videoTotal = 0;
  for (const media of mediaRows) {
    if (media.kind === "video") videoTotal += 1;
    if (media.kind !== "photo") continue;
    photoTotal += 1;
    if (media.daily_report_id) {
      photoCounts.set(media.daily_report_id, (photoCounts.get(media.daily_report_id) ?? 0) + 1);
    }
  }

  const { data: taskRowsRaw } = await supabase
    .from("wbs_items")
    .select("id")
    .eq("site_id", id)
    .in("external_provider", VISIBLE_SOURCE_PROVIDERS)
    .not("parent_id", "is", null);
  const taskRows = (taskRowsRaw ?? []) as { id: string }[];
  const taskCount = taskRows.length;

  const fileCount = mediaRows.filter((media) => media.kind === "file").length;

  return (
    <div className="do-obra-layout">
      <ObraSidebar
        site={site}
        active="reports"
        counts={{
          reports: allReports.length,
          tasks: taskCount,
          photos: photoTotal,
          videos: videoTotal,
          files: fileCount,
        }}
      />

      <main className="do-obra-main">
        <div className="diario-container">
          <div className="diario-page-header">
            <div>
              <h1>Relatórios ({allReports.length})</h1>
              <p>{site.name}</p>
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
        </div>
      </main>
    </div>
  );
}
