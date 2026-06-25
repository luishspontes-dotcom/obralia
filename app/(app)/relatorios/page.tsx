import Link from "next/link";
import { Search } from "lucide-react";
import { createServerSupabase } from "@/lib/supabase/server";
import { VISIBLE_SOURCE_PROVIDERS } from "@/lib/rdo-source-scope";

type Report = {
  id: string;
  number: number;
  date: string;
  status: string | null;
  site_id: string;
  sites: { name: string } | null;
};

const statusLabel: Record<string, string> = {
  draft: "Rascunho",
  review: "Em revisão",
  approved: "Aprovado",
};

export default async function RelatoriosPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string }>;
}) {
  const supabase = await createServerSupabase();
  const { q, status } = await searchParams;
  const query = (q ?? "").trim().toLowerCase();

  let dbQuery = supabase
    .from("daily_reports")
    .select("id, number, date, status, site_id, sites(name)", { count: "exact" })
    .in("external_provider", VISIBLE_SOURCE_PROVIDERS)
    .order("date", { ascending: false })
    .limit(300);
  if (status) dbQuery = dbQuery.eq("status", status);
  const { data, count } = await dbQuery;
  const reports = ((data ?? []) as unknown as Report[]).filter((report) => {
    if (!query) return true;
    return `${report.number} ${report.date} ${report.sites?.name ?? ""}`.toLowerCase().includes(query);
  });

  return (
    <div className="diario-page">
      <div className="diario-container">
        <div className="diario-page-header">
          <div>
            <h1>Relatórios ({count ?? reports.length})</h1>
            <p>RDOs importados do Diário. Exibindo os {reports.length} mais recentes nesta página.</p>
          </div>
          <form method="get" action="/relatorios" className="diario-toolbar">
            <input className="diario-input" type="search" name="q" defaultValue={q ?? ""} placeholder="Pesquisa" />
            <select className="diario-select" name="status" defaultValue={status ?? ""}>
              <option value="">Todos</option>
              <option value="draft">Rascunho</option>
              <option value="review">Em revisão</option>
              <option value="approved">Aprovados</option>
            </select>
            <button className="diario-blue-button" type="submit" title="Pesquisar">
              <Search size={16} />
            </button>
          </form>
        </div>

        <div className="do-panel">
          <div className="do-table-wrap">
            <table className="do-table">
              <thead>
                <tr>
                  <th>Número</th>
                  <th>Data</th>
                  <th>Obra</th>
                  <th>Status</th>
                  <th>Ação</th>
                </tr>
              </thead>
              <tbody>
                {reports.length === 0 ? (
                  <tr>
                    <td colSpan={5} style={{ textAlign: "center", padding: "32px 12px", color: "var(--o-text-2)" }}>
                      Nenhum relatório encontrado.
                    </td>
                  </tr>
                ) : (
                  reports.map((report) => (
                    <tr key={report.id}>
                      <td>n° {report.number}</td>
                      <td>{new Date(`${report.date}T00:00:00`).toLocaleDateString("pt-BR")}</td>
                      <td>{report.sites?.name ?? "Obra"}</td>
                      <td>{statusLabel[report.status ?? ""] ?? report.status ?? "-"}</td>
                      <td>
                        <Link href={`/obras/${report.site_id}/rdos/${report.id}`}>Abrir</Link>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
