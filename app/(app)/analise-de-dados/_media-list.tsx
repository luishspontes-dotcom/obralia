import Link from "next/link";
import { Search } from "lucide-react";
import { createServerSupabase } from "@/lib/supabase/server";
import { MEDIA_SOURCE_PROVIDERS } from "@/lib/rdo-source-scope";
import { mediaUrl, thumbUrl } from "@/lib/storage";

type MediaKind = "photo" | "video" | "file";

type MediaRow = {
  id: string;
  kind: string;
  storage_path: string | null;
  thumbnail_path: string | null;
  caption: string | null;
  taken_at: string | null;
  site_id: string;
  daily_report_id: string | null;
  sites: { name: string } | null;
};

const titleByKind: Record<MediaKind, string> = {
  photo: "Fotos",
  video: "Vídeos",
  file: "Anexos",
};

export async function MediaListPage({
  kind,
  q,
}: {
  kind: MediaKind;
  q?: string;
}) {
  const supabase = await createServerSupabase();
  const query = (q ?? "").trim().toLowerCase();
  const { data } = await supabase
    .from("media")
    .select("id, kind, storage_path, thumbnail_path, caption, taken_at, site_id, daily_report_id, sites(name)")
    .in("external_provider", MEDIA_SOURCE_PROVIDERS)
    .eq("kind", kind)
    .order("taken_at", { ascending: false, nullsFirst: false })
    .limit(300);
  const rows = ((data ?? []) as unknown as MediaRow[]).filter((row) => {
    if (!query) return true;
    return `${row.caption ?? ""} ${row.sites?.name ?? ""}`.toLowerCase().includes(query);
  });

  return (
    <div className="diario-page">
      <div className="diario-container">
        <div className="diario-page-header">
          <div>
            <h1>{titleByKind[kind]} ({rows.length})</h1>
            <p>Galeria global importada do Diário de Obras</p>
          </div>
          <form method="get" className="diario-toolbar">
            <input className="diario-input" type="search" name="q" defaultValue={q ?? ""} placeholder="Pesquisa" />
            <button className="diario-blue-button" type="submit" title="Pesquisar">
              <Search size={16} />
            </button>
          </form>
        </div>

        {kind === "photo" ? (
          <div className="do-media-grid">
            {rows.map((row) => (
              <Link key={row.id} href={`/obras/${row.site_id}/fotos`} className="do-media-card">
                <span style={{ backgroundImage: `url(${thumbUrl(row.thumbnail_path ?? row.storage_path, 400)})` }} />
                <strong>{row.sites?.name ?? "Obra"}</strong>
                <small>{row.caption ?? "Foto"}</small>
              </Link>
            ))}
          </div>
        ) : (
          <div className="do-panel">
            <div className="do-table-wrap">
              <table className="do-table">
                <thead>
                  <tr>
                    <th>Descrição</th>
                    <th>Obra</th>
                    <th>Data</th>
                    <th>Arquivo</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr key={row.id}>
                      <td>{row.caption ?? titleByKind[kind].slice(0, -1)}</td>
                      <td>{row.sites?.name ?? "Obra"}</td>
                      <td>{row.taken_at ? new Date(row.taken_at).toLocaleDateString("pt-BR") : "-"}</td>
                      <td>
                        <a href={mediaUrl(row.storage_path) || "#"} target="_blank" rel="noreferrer">
                          Abrir
                        </a>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
