import Link from "next/link";
import { notFound } from "next/navigation";
import { createServerSupabase } from "@/lib/supabase/server";

type Site = { id: string; name: string };
type Photo = {
  id: string;
  storage_path: string | null;
  thumbnail_path: string | null;
  caption: string | null;
  taken_at: string | null;
  daily_report_id: string | null;
};

export default async function ObraFotosPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ page?: string }>;
}) {
  const { id } = await params;
  const { page } = await searchParams;
  const pageNum = Math.max(1, parseInt(page ?? "1", 10) || 1);
  const PER_PAGE = 100;
  const offset = (pageNum - 1) * PER_PAGE;

  const supabase = await createServerSupabase();
  const { data: siteRaw } = await supabase
    .from("sites").select("id, name").eq("id", id).maybeSingle();
  const site = siteRaw as Site | null;
  if (!site) notFound();

  const { count: totalCount } = await supabase
    .from("media")
    .select("*", { count: "exact", head: true })
    .eq("site_id", id)
    .eq("kind", "photo");

  const { data: photosRaw } = await supabase
    .from("media")
    .select("id, storage_path, thumbnail_path, caption, taken_at, daily_report_id")
    .eq("site_id", id)
    .eq("kind", "photo")
    .order("taken_at", { ascending: false, nullsFirst: false })
    .range(offset, offset + PER_PAGE - 1);
  const photos = (photosRaw ?? []) as Photo[];

  const total = totalCount ?? photos.length;
  const totalPages = Math.max(1, Math.ceil(total / PER_PAGE));

  // Group by month
  const grouped = new Map<string, Photo[]>();
  for (const p of photos) {
    const key = p.taken_at
      ? new Date(p.taken_at).toLocaleDateString("pt-BR", { month: "long", year: "numeric" })
      : "Sem data";
    const arr = grouped.get(key) ?? [];
    arr.push(p);
    grouped.set(key, arr);
  }

  return (
    <div style={{ padding: "24px", maxWidth: 1280, margin: "0 auto" }}>
      <div style={{ marginBottom: 16, fontSize: 13 }}>
        <Link href="/obras" style={{ color: "var(--o-text-2)", textDecoration: "none" }}>Obras</Link>
        <span style={{ color: "var(--o-text-3)", margin: "0 8px" }}>/</span>
        <Link href={`/obras/${id}`} style={{ color: "var(--o-text-2)", textDecoration: "none" }}>{site.name}</Link>
        <span style={{ color: "var(--o-text-3)", margin: "0 8px" }}>/</span>
        <span style={{ color: "var(--o-text-1)", fontWeight: 500 }}>Fotos</span>
      </div>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 24 }}>
        <div>
          <h1 style={{ margin: "0 0 4px", font: "700 28px var(--font-inter)", letterSpacing: "-0.02em" }}>Galeria de fotos</h1>
          <p style={{ margin: 0, fontSize: 14, color: "var(--o-text-2)" }}>
            {total} fotos · {site.name}
          </p>
        </div>
        {totalPages > 1 && (
          <div style={{ display: "flex", gap: 8, fontSize: 13 }}>
            {pageNum > 1 && (
              <Link href={`/obras/${id}/fotos?page=${pageNum - 1}`} style={{ padding: "6px 12px", border: "1px solid var(--o-border)", borderRadius: 8, color: "var(--o-text-2)", textDecoration: "none" }}>← Anterior</Link>
            )}
            <span style={{ padding: "6px 12px", color: "var(--o-text-2)" }}>Página {pageNum} de {totalPages}</span>
            {pageNum < totalPages && (
              <Link href={`/obras/${id}/fotos?page=${pageNum + 1}`} style={{ padding: "6px 12px", border: "1px solid var(--o-border)", borderRadius: 8, color: "var(--o-text-2)", textDecoration: "none" }}>Próxima →</Link>
            )}
          </div>
        )}
      </div>

      {photos.length === 0 ? (
        <div style={{ background: "var(--o-paper)", border: "1px solid var(--o-border)", borderRadius: 12, padding: 48, textAlign: "center", color: "var(--o-text-2)" }}>
          Nenhuma foto registrada nesta obra.
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
          {Array.from(grouped.entries()).map(([month, list]) => (
            <div key={month}>
              <h3 style={{ margin: "0 0 10px", font: "600 12px var(--font-inter)", textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--o-text-3)" }}>
                {month} · {list.length}
              </h3>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", gap: 6 }}>
                {list.map((p) => (
                  <a
                    key={p.id}
                    href={p.storage_path ?? "#"}
                    target="_blank"
                    rel="noreferrer"
                    style={{
                      display: "block",
                      aspectRatio: "1 / 1",
                      background: "var(--o-border)",
                      borderRadius: 6,
                      overflow: "hidden",
                    }}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={p.thumbnail_path ?? p.storage_path ?? ""}
                      alt={p.caption ?? "Foto"}
                      loading="lazy"
                      style={{ width: "100%", height: "100%", objectFit: "cover", transition: "transform 200ms" }}
                    />
                  </a>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
