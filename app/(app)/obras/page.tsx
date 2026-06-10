import Link from "next/link";
import { Camera, FileText, LayoutGrid, List, Search, Video } from "lucide-react";
import { createServerSupabase } from "@/lib/supabase/server";
import { fetchAllPages } from "@/lib/supabase/fetch-all";
import { VISIBLE_SOURCE_PROVIDERS } from "@/lib/rdo-source-scope";
import { mediaUrl } from "@/lib/storage";

type Site = {
  id: string;
  name: string;
  status: string;
  client_name: string | null;
  cover_url: string | null;
};

type WbsItem = {
  id: string;
  site_id: string;
  status: string | null;
  parent_id: string | null;
  progress_pct: number | null;
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

export default async function ObrasPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; q?: string; view?: string }>;
}) {
  const supabase = await createServerSupabase();
  const { status: filterStatus, q, view } = await searchParams;
  const query = (q ?? "").trim().toLowerCase();
  const isListView = view === "lista";

  const viewQs = (target: "grid" | "lista") => {
    const params = new URLSearchParams();
    if (q) params.set("q", q);
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

  const { data: itemsRaw } = await supabase
    .from("wbs_items")
    .select("id, site_id, status, parent_id, progress_pct")
    .in("external_provider", VISIBLE_SOURCE_PROVIDERS);
  const items = (itemsRaw ?? []) as WbsItem[];

  const rdoRows = await fetchAllPages<{ site_id: string }>(() =>
    supabase
      .from("daily_reports")
      .select("site_id")
      .in("external_provider", VISIBLE_SOURCE_PROVIDERS)
  );
  const rdoCount = new Map<string, number>();
  for (const r of rdoRows) rdoCount.set(r.site_id, (rdoCount.get(r.site_id) ?? 0) + 1);

  const mediaRows = await fetchAllPages<{ site_id: string; kind: string | null }>(() =>
    supabase
      .from("media")
      .select("site_id, kind")
      .in("external_provider", VISIBLE_SOURCE_PROVIDERS)
      .in("kind", ["photo", "video"])
  );
  const photoCount = new Map<string, number>();
  const videoCount = new Map<string, number>();
  for (const row of mediaRows) {
    if (row.kind === "video") videoCount.set(row.site_id, (videoCount.get(row.site_id) ?? 0) + 1);
    else photoCount.set(row.site_id, (photoCount.get(row.site_id) ?? 0) + 1);
  }

  const perSite = new Map<string, { total: number; done: number; late: number; in_progress: number; progressAvg: number }>();
  for (const it of items) {
    if (it.parent_id === null) continue;
    const cur = perSite.get(it.site_id) ?? { total: 0, done: 0, late: 0, in_progress: 0, progressAvg: 0 };
    cur.total += 1;
    if (it.status === "done") cur.done += 1;
    if (it.status === "late") cur.late += 1;
    if (it.status === "in_progress") cur.in_progress += 1;
    cur.progressAvg += it.progress_pct ?? 0;
    perSite.set(it.site_id, cur);
  }
  for (const stats of perSite.values()) {
    stats.progressAvg = stats.total > 0 ? Math.round(stats.progressAvg / stats.total) : 0;
  }

  const visibleSites = sites.filter((site) => {
    const stats = perSite.get(site.id);
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
            <select className="diario-select" name="status" defaultValue={filterStatus ?? ""}>
              <option value="">Todas as obras</option>
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
                        src={mediaUrl(site.cover_url)}
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
