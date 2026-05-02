import Link from "next/link";
import { notFound } from "next/navigation";
import { createServerSupabase } from "@/lib/supabase/server";
import { PhotoGrid } from "@/components/PhotoLightbox";

type Site = { id: string; name: string; cover_url: string | null };
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
    .from("sites").select("id, name, cover_url").eq("id", id).maybeSingle();
  const site = siteRaw as Site | null;
  if (!site) notFound();

  const { count: totalCount } = await supabase
    .from("media").select("*", { count: "exact", head: true })
    .eq("site_id", id).eq("kind", "photo");

  const { data: photosRaw } = await supabase
    .from("media")
    .select("id, storage_path, thumbnail_path, caption, taken_at, daily_report_id")
    .eq("site_id", id).eq("kind", "photo")
    .order("taken_at", { ascending: false, nullsFirst: false })
    .range(offset, offset + PER_PAGE - 1);
  const photos = (photosRaw ?? []) as Photo[];

  const total = totalCount ?? photos.length;
  const totalPages = Math.max(1, Math.ceil(total / PER_PAGE));

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
    <div>
      <div className="page-hero">
        <div style={{ maxWidth: 1280, margin: "0 auto" }}>
          <div style={{ marginBottom: 12, fontSize: 13 }}>
            <Link href="/obras" style={{ color: "var(--o-text-2)", textDecoration: "none" }}>← Obras</Link>
            <span style={{ color: "var(--o-text-3)", margin: "0 8px" }}>/</span>
            <Link href={`/obras/${id}`} style={{ color: "var(--o-text-2)", textDecoration: "none" }}>{site.name}</Link>
            <span style={{ color: "var(--o-text-3)", margin: "0 8px" }}>/</span>
            <span style={{ color: "var(--o-text-1)", fontWeight: 500 }}>Fotos</span>
          </div>

          <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", flexWrap: "wrap", gap: 16 }}>
            <div>
              <div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "0.12em", color: "var(--t-brand)", fontWeight: 600, marginBottom: 8 }}>
                Galeria
              </div>
              <h1 style={{ margin: "0 0 6px", font: "700 32px var(--font-inter)", letterSpacing: "-0.025em" }}>
                Fotos
              </h1>
              <p style={{ margin: 0, fontSize: 14, color: "var(--o-text-2)" }}>
                <span className="tnum" style={{ fontWeight: 500 }}>{total}</span> fotos · {site.name}
              </p>
            </div>

            {totalPages > 1 && (
              <div style={{ display: "flex", gap: 6, alignItems: "center", fontSize: 13 }}>
                {pageNum > 1 ? (
                  <Link href={`/obras/${id}/fotos?page=${pageNum - 1}`} className="chip">
                    ← Anterior
                  </Link>
                ) : (
                  <span className="chip" style={{ opacity: 0.4, cursor: "not-allowed" }}>← Anterior</span>
                )}
                <span style={{ padding: "0 12px", color: "var(--o-text-2)", fontSize: 13 }} className="tnum">
                  Página {pageNum} de {totalPages}
                </span>
                {pageNum < totalPages ? (
                  <Link href={`/obras/${id}/fotos?page=${pageNum + 1}`} className="chip">
                    Próxima →
                  </Link>
                ) : (
                  <span className="chip" style={{ opacity: 0.4, cursor: "not-allowed" }}>Próxima →</span>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      <div style={{ padding: "0 24px 32px", maxWidth: 1280, margin: "0 auto" }}>
        {photos.length === 0 ? (
          <div className="empty">
            <div className="empty-emoji">📸</div>
            <div style={{ fontSize: 16, color: "var(--o-text-1)", marginBottom: 4, fontWeight: 600 }}>
              Sem fotos por aqui
            </div>
            <div style={{ fontSize: 13 }}>
              As fotos dos RDOs desta obra vão aparecer aqui em ordem cronológica.
            </div>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 32 }}>
            {Array.from(grouped.entries()).map(([month, list]) => (
              <div key={month}>
                <h3 className="section-title" style={{
                  display: "flex", alignItems: "center", gap: 10,
                  textTransform: "capitalize", marginBottom: 14,
                }}>
                  {month}
                  <span className="tnum" style={{
                    padding: "2px 10px", fontSize: 11, fontWeight: 600,
                    background: "var(--t-brand-soft)", color: "var(--t-brand)",
                    borderRadius: 999,
                    textTransform: "none", letterSpacing: 0,
                  }}>
                    {list.length}
                  </span>
                </h3>
                <PhotoGrid photos={list} />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
