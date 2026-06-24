import Link from "next/link";
import { Camera, FileText, LayoutGrid, List, Search, Video } from "lucide-react";
import { createServerSupabase } from "@/lib/supabase/server";
import { createAdminSupabase } from "@/lib/supabase/admin";
import { VISIBLE_SOURCE_PROVIDERS } from "@/lib/rdo-source-scope";
import { thumbUrl } from "@/lib/storage";

type Site = {
  id: string;
  name: string;
  status: string;
  client_name: string | null;
  cover_url: string | null;
};

const STATUS_META: Record<string, { label: string; cls: string }> = {
  in_progress: { label: "Em andamento", cls: "" },
  done: { label: "Concluída", cls: "is-done" },
  completed: { label: "Concluída", cls: "is-done" },
  paused: { label: "Pausada", cls: "is-paused" },
  late: { label: "Em risco", cls: "is-late" },
  not_started: { label: "Não iniciada", cls: "is-planned" },
  planned: { label: "Não iniciada", cls: "is-planned" },
  cancelled: { label: "Cancelada", cls: "is-paused" },
};

// Grupos de obra: não existe coluna de agrupamento real em `sites`. A tela
// `cadastros/grupos-de-obra` deriva grupos a partir do `status`; reaproveitamos
// a mesma lógica para que o select "Todas as obras" fique funcional.
const GROUP_LABEL: Record<string, string> = {
  in_progress: "Em andamento",
  not_started: "Não iniciada",
  paused: "Pausada",
  done: "Concluída",
};

// Normaliza o status bruto da obra para a chave de grupo (mesma normalização
// usada na tela de grupos de obra).
function siteGroupKey(status: string): string {
  if (status === "completed") return "done";
  if (status === "planned") return "not_started";
  return status;
}

export default async function ObrasPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; q?: string; view?: string; grupo?: string }>;
}) {
  const supabase = await createServerSupabase();
  const { status: filterStatus, q, view, grupo: filterGrupo } = await searchParams;
  const query = (q ?? "").trim().toLowerCase();
  const isListView = view === "lista";

  const viewQs = (target: "grid" | "lista") => {
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    if (filterGrupo) params.set("grupo", filterGrupo);
    if (filterStatus) params.set("status", filterStatus);
    if (target === "lista") params.set("view", "lista");
    const qs = params.toString();
    return `/obras${qs ? `?${qs}` : ""}`;
  };

  const { data: sitesRaw } = await supabase
    .from("sites")
    .select("id, name, status, client_name, cover_url")
    .in("external_provider", VISIBLE_SOURCE_PROVIDERS)
    .order("name");
  const sites = (sitesRaw ?? []) as Site[];

  // Grupos de obra disponíveis (derivados do status) para o select "Todas as obras".
  const grupoOptions = Array.from(new Set(sites.map((s) => siteGroupKey(s.status))))
    .map((key) => ({ key, label: GROUP_LABEL[key] ?? key }))
    .sort((a, b) => a.label.localeCompare(b.label, "pt-BR"));

  // B1: contagens agregadas no banco (view obra_dashboard_counts) — evita baixar
  // dezenas de milhares de linhas de mídia/tarefas só para contar por obra.
  type ObraCounts = {
    site_id: string;
    tasks_total: number; tasks_done: number; tasks_late: number; tasks_in_progress: number;
    progress_avg: number | string; rdo_count: number; photo_count: number; video_count: number;
  };
  // As contagens agregam dezenas de milhares de linhas (media/tarefas). Sob o
  // RLS do usuário isso fica lento (~5s) porque a checagem roda por linha.
  // Usamos o cliente admin só para LER os números agregados por site_id; a
  // exibição continua restrita às obras visíveis (sites já filtrados).
  const viewClient = createAdminSupabase() as unknown as {
    from(table: string): { select(cols: string): Promise<{ data: ObraCounts[] | null }> };
  };
  const { data: countsRaw } = await viewClient
    .from("obra_dashboard_counts")
    .select("site_id, tasks_total, tasks_done, tasks_late, tasks_in_progress, progress_avg, rdo_count, photo_count, video_count");
  const counts = (countsRaw ?? []) as ObraCounts[];

  const rdoCount = new Map<string, number>();
  const photoCount = new Map<string, number>();
  const videoCount = new Map<string, number>();
  const perSite = new Map<string, { total: number; done: number; late: number; in_progress: number; progressAvg: number }>();
  for (const c of counts) {
    rdoCount.set(c.site_id, Number(c.rdo_count) || 0);
    photoCount.set(c.site_id, Number(c.photo_count) || 0);
    videoCount.set(c.site_id, Number(c.video_count) || 0);
    perSite.set(c.site_id, {
      total: Number(c.tasks_total) || 0,
      done: Number(c.tasks_done) || 0,
      late: Number(c.tasks_late) || 0,
      in_progress: Number(c.tasks_in_progress) || 0,
      progressAvg: Number(c.progress_avg) || 0,
    });
  }

  const visibleSites = sites.filter((site) => {
    const stats = perSite.get(site.id);
    if (filterGrupo && siteGroupKey(site.status) !== filterGrupo) return false;
    if (filterStatus === "at-risk" && (stats?.late ?? 0) === 0) return false;
    if (filterStatus === "done" && !["done", "completed"].includes(site.status)) return false;
    if (filterStatus === "in_progress" && site.status !== "in_progress") return false;
    if (filterStatus === "not_started" && !["planned", "not_started"].includes(site.status)) return false;
    if (filterStatus === "paused" && site.status !== "paused") return false;
    if (query) {
      const haystack = `${site.name} ${site.client_name ?? ""}`.toLowerCase();
      if (!haystack.includes(query)) return false;
    }
    return true;
  });

  return (
    <div className="diario-page">
      <div className="diario-container">
        <div className="diario-page-header">
          <div>
            <h1>Obras ({sites.length})</h1>
            {visibleSites.length !== sites.length ? <p>{visibleSites.length} obras neste filtro</p> : null}
          </div>

          <form method="get" action="/obras" className="diario-toolbar">
            {isListView ? <input type="hidden" name="view" value="lista" /> : null}
            <input
              className="diario-input"
              type="search"
              name="q"
              defaultValue={q ?? ""}
              placeholder="Pesquisa"
            />
            <select className="diario-select" name="grupo" defaultValue={filterGrupo ?? ""}>
              <option value="">Todas as obras</option>
              {grupoOptions.map((g) => (
                <option key={g.key} value={g.key}>
                  {g.label}
                </option>
              ))}
            </select>
            <select className="diario-select" name="status" defaultValue={filterStatus ?? ""}>
              <option value="">Todos os status</option>
              <option value="in_progress">Em andamento</option>
              <option value="not_started">Não iniciadas</option>
              <option value="paused">Pausadas</option>
              <option value="done">Concluídas</option>
              <option value="at-risk">Em risco</option>
            </select>
            <button className="diario-blue-button" type="submit" title="Pesquisar">
              <Search size={16} />
            </button>
            <span className="diario-view-toggle" role="group" aria-label="Modo de visualização">
              <Link
                href={viewQs("lista")}
                className={isListView ? "is-active" : undefined}
                title="Visualizar em lista"
              >
                <List size={16} />
              </Link>
              <Link
                href={viewQs("grid")}
                className={!isListView ? "is-active" : undefined}
                title="Visualizar em grade"
              >
                <LayoutGrid size={16} />
              </Link>
            </span>
          </form>
        </div>

        {visibleSites.length === 0 ? (
          <div className="do-panel" style={{ padding: 24, color: "#666" }}>
            Nenhuma obra encontrada com este filtro.
          </div>
        ) : isListView ? (
          <div className="do-panel">
            <div className="do-table-wrap">
              <table className="do-table">
                <thead>
                  <tr>
                    <th>Obra</th>
                    <th>Status</th>
                    <th>Relatórios</th>
                    <th>Fotos</th>
                    <th>Vídeos</th>
                    <th>Cliente</th>
                  </tr>
                </thead>
                <tbody>
                  {visibleSites.map((site) => {
                    const status = STATUS_META[site.status] ?? STATUS_META.in_progress;
                    return (
                      <tr key={site.id}>
                        <td>
                          <Link href={`/obras/${site.id}`}>{site.name}</Link>
                        </td>
                        <td>
                          <span className={`diario-status-badge ${status.cls}`}>{status.label}</span>
                        </td>
                        <td className="tnum">{rdoCount.get(site.id) ?? 0}</td>
                        <td className="tnum">{photoCount.get(site.id) ?? 0}</td>
                        <td className="tnum">{videoCount.get(site.id) ?? 0}</td>
                        <td>{site.client_name ?? "—"}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <div className="diario-obra-grid">
            {visibleSites.map((site, cardIdx) => {
              const status = STATUS_META[site.status] ?? STATUS_META.in_progress;
              return (
                <Link key={site.id} href={`/obras/${site.id}`} className="diario-obra-card">
                  <div className="diario-obra-card__cover">
                    {site.cover_url && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        className="diario-obra-card__cover-img"
                        src={thumbUrl(site.cover_url, 500)}
                        alt=""
                        loading={cardIdx < 4 ? "eager" : "lazy"}
                        decoding="async"
                      />
                    )}
                    <span className={`diario-status-badge ${status.cls}`}>{status.label}</span>
                  </div>
                  <div className="diario-obra-card__body">
                    <div className="diario-card-counts">
                      <span title="Relatórios">
                        <FileText size={13} />
                        {rdoCount.get(site.id) ?? 0}
                      </span>
                      <span title="Fotos">
                        <Camera size={13} />
                        {photoCount.get(site.id) ?? 0}
                      </span>
                      <span title="Vídeos">
                        <Video size={13} />
                        {videoCount.get(site.id) ?? 0}
                      </span>
                    </div>
                    <div className="diario-obra-card__title">{site.name}</div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
