import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { createAdminSupabase } from "@/lib/supabase/admin";
import { untypedDb } from "@/lib/supabase/untyped";
import { VISIBLE_SOURCE_PROVIDERS } from "@/lib/rdo-source-scope";
import { mediaUrl, thumbUrl } from "@/lib/storage";

/** Portal público do cliente — revalida a cada 5 minutos. */
export const revalidate = 300;

export const metadata: Metadata = {
  title: "Acompanhamento da obra",
  robots: { index: false, follow: false },
};

type ShareLink = {
  id: string;
  site_id: string;
  organization_id: string;
  expires_at: string | null;
  revoked_at: string | null;
};

type PortalSite = {
  id: string;
  name: string;
  address: string | null;
  cover_url: string | null;
  start_date: string | null;
  end_date: string | null;
  status: string;
  organization_id: string;
};

type PortalOrg = { name: string; brand_color: string | null };

type PortalReport = {
  id: string;
  number: number;
  date: string;
  client_summary: string | null;
};

type PortalActivity = {
  daily_report_id: string;
  description: string;
  progress_pct: number | null;
};

type PortalPhoto = {
  id: string;
  storage_path: string | null;
  thumbnail_path: string | null;
  caption: string | null;
};

function fmtDate(value: string | null): string {
  if (!value) return "—";
  return new Date(`${value}T00:00:00`).toLocaleDateString("pt-BR", {
    day: "2-digit", month: "long", year: "numeric",
  });
}

function schedulePct(start: string | null, end: string | null): number {
  if (!start || !end) return 0;
  const startMs = new Date(`${start}T00:00:00`).getTime();
  const endMs = new Date(`${end}T00:00:00`).getTime();
  if (!Number.isFinite(startMs) || !Number.isFinite(endMs) || endMs <= startMs) return 0;
  const pct = Math.round(((Date.now() - startMs) / (endMs - startMs)) * 100);
  return Math.min(Math.max(pct, 0), 100);
}

const SITE_STATUS_LABEL: Record<string, string> = {
  in_progress: "Em andamento",
  done: "Concluída",
  completed: "Concluída",
  paused: "Pausada",
  late: "Em andamento",
  not_started: "Não iniciada",
  planned: "Não iniciada",
};

export default async function PortalClientePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  if (!token || token.length < 8) notFound();

  // Página pública: usa o client admin (service role) APENAS no servidor.
  const db = untypedDb(createAdminSupabase());

  const { data: linkRaw } = await db
    .from<ShareLink>("share_links")
    .select("id, site_id, organization_id, expires_at, revoked_at")
    .eq("token", token)
    .is("revoked_at", null)
    .maybeSingle();
  const link = linkRaw;
  if (!link) notFound();
  if (link.expires_at && new Date(link.expires_at).getTime() < Date.now()) notFound();

  const { data: siteRaw } = await db
    .from<PortalSite>("sites")
    .select("id, name, address, cover_url, start_date, end_date, status, organization_id")
    .eq("id", link.site_id)
    .in("external_provider", VISIBLE_SOURCE_PROVIDERS)
    .maybeSingle();
  const site = siteRaw;
  if (!site) notFound();

  const [orgR, reportsR, photosR] = await Promise.all([
    db.from<PortalOrg>("organizations")
      .select("name, brand_color")
      .eq("id", site.organization_id)
      .maybeSingle(),
    db.from<PortalReport[]>("daily_reports")
      .select("id, number, date, client_summary")
      .eq("site_id", site.id)
      .eq("status", "approved")
      .in("external_provider", VISIBLE_SOURCE_PROVIDERS)
      .order("date", { ascending: false })
      .limit(10),
    db.from<PortalPhoto[]>("media")
      .select("id, storage_path, thumbnail_path, caption")
      .eq("site_id", site.id)
      .eq("kind", "photo")
      .in("external_provider", VISIBLE_SOURCE_PROVIDERS)
      .order("taken_at", { ascending: false })
      .limit(12),
  ]);

  const org = orgR.data;
  const reports = (reportsR.data ?? []) as PortalReport[];
  const photos = (photosR.data ?? []) as PortalPhoto[];

  // Atividades resumidas para RDOs aprovados sem resumo de IA
  const idsSemResumo = reports.filter((r) => !r.client_summary).map((r) => r.id);
  const activitiesByReport = new Map<string, PortalActivity[]>();
  if (idsSemResumo.length > 0) {
    const { data: actsRaw } = await db
      .from<PortalActivity[]>("report_activities")
      .select("daily_report_id, description, progress_pct")
      .in("daily_report_id", idsSemResumo);
    for (const act of (actsRaw ?? []) as PortalActivity[]) {
      const list = activitiesByReport.get(act.daily_report_id) ?? [];
      list.push(act);
      activitiesByReport.set(act.daily_report_id, list);
    }
  }

  const brand = org?.brand_color ?? "#08789B";
  const pct = schedulePct(site.start_date, site.end_date);
  const statusLabel = SITE_STATUS_LABEL[site.status] ?? "Em andamento";
  const coverSrc = site.cover_url ? thumbUrl(site.cover_url, 1000) : "";

  return (
    <div style={{ minHeight: "100vh", background: "#f5f6f7", fontFamily: "var(--font-inter, Inter, system-ui, sans-serif)", color: "#1c1f23" }}>
      {/* Cabeçalho com branding da construtora */}
      <header style={{ background: brand, color: "#fff", padding: "20px 24px" }}>
        <div style={{ maxWidth: 880, margin: "0 auto", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
          <div style={{ fontWeight: 700, fontSize: 16, letterSpacing: "0.01em" }}>
            {org?.name ?? "Acompanhamento de obra"}
          </div>
          <div style={{ fontSize: 12, opacity: 0.85 }}>Portal do cliente</div>
        </div>
      </header>

      <main style={{ maxWidth: 880, margin: "0 auto", padding: "28px 24px 48px" }}>
        {/* Identificação da obra */}
        <section style={{ background: "#fff", borderRadius: 14, overflow: "hidden", boxShadow: "0 1px 3px rgba(0,0,0,0.07)", marginBottom: 24 }}>
          {coverSrc ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={coverSrc} alt={`Foto de capa de ${site.name}`} style={{ width: "100%", height: 240, objectFit: "cover", display: "block" }} />
          ) : null}
          <div style={{ padding: "22px 24px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", marginBottom: 6 }}>
              <h1 style={{ margin: 0, fontSize: 26, fontWeight: 700, letterSpacing: "-0.02em" }}>{site.name}</h1>
              <span style={{ fontSize: 11, fontWeight: 600, padding: "4px 10px", borderRadius: 999, background: `${brand}1A`, color: brand }}>
                {statusLabel}
              </span>
            </div>
            {site.address ? (
              <div style={{ fontSize: 13.5, color: "#5b626b", marginBottom: 16 }}>📍 {site.address}</div>
            ) : null}

            {/* Progresso (prazo decorrido) */}
            <div style={{ marginTop: 4 }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "#5b626b", marginBottom: 6 }}>
                <span>Andamento do prazo</span>
                <span style={{ fontWeight: 600, color: brand }}>{pct}%</span>
              </div>
              <div style={{ height: 10, background: "#e8eaed", borderRadius: 999, overflow: "hidden" }}>
                <div style={{ width: `${pct}%`, height: "100%", background: brand, borderRadius: 999 }} />
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11.5, color: "#8a9099", marginTop: 6 }}>
                <span>Início: {fmtDate(site.start_date)}</span>
                <span>Previsão de término: {fmtDate(site.end_date)}</span>
              </div>
            </div>
          </div>
        </section>

        {/* Últimos relatórios aprovados */}
        <section style={{ marginBottom: 24 }}>
          <h2 style={{ fontSize: 15, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "#5b626b", margin: "0 0 12px" }}>
            Últimas atualizações
          </h2>
          {reports.length > 0 ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {reports.map((report) => {
                const acts = activitiesByReport.get(report.id) ?? [];
                return (
                  <article key={report.id} style={{ background: "#fff", borderRadius: 12, padding: "18px 22px", boxShadow: "0 1px 3px rgba(0,0,0,0.06)", borderLeft: `3px solid ${brand}` }}>
                    <div style={{ fontSize: 12.5, fontWeight: 600, color: brand, marginBottom: 8, textTransform: "capitalize" }}>
                      {new Date(`${report.date}T00:00:00`).toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long", year: "numeric" })}
                    </div>
                    {report.client_summary ? (
                      <div style={{ fontSize: 14, lineHeight: 1.7, color: "#2b3036", whiteSpace: "pre-wrap" }}>
                        {report.client_summary}
                      </div>
                    ) : acts.length > 0 ? (
                      <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13.5, lineHeight: 1.8, color: "#2b3036" }}>
                        {acts.slice(0, 6).map((act, i) => (
                          <li key={`${report.id}-${i}`}>
                            {act.description}
                            {act.progress_pct != null ? ` — ${act.progress_pct}% concluído` : ""}
                          </li>
                        ))}
                        {acts.length > 6 ? (
                          <li style={{ color: "#8a9099" }}>e mais {acts.length - 6} atividades…</li>
                        ) : null}
                      </ul>
                    ) : (
                      <div style={{ fontSize: 13.5, color: "#8a9099" }}>
                        Dia de obra registrado e aprovado pela equipe técnica.
                      </div>
                    )}
                  </article>
                );
              })}
            </div>
          ) : (
            <div style={{ background: "#fff", borderRadius: 12, padding: "22px", fontSize: 13.5, color: "#8a9099", boxShadow: "0 1px 3px rgba(0,0,0,0.06)" }}>
              Ainda não há relatórios aprovados para exibir. Volte em breve!
            </div>
          )}
        </section>

        {/* Galeria de fotos */}
        {photos.length > 0 ? (
          <section>
            <h2 style={{ fontSize: 15, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "#5b626b", margin: "0 0 12px" }}>
              Fotos recentes
            </h2>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", gap: 10 }}>
              {photos.map((photo) => (
                <a key={photo.id} href={mediaUrl(photo.storage_path)} target="_blank" rel="noreferrer"
                  style={{ display: "block", borderRadius: 10, overflow: "hidden", background: "#e8eaed", aspectRatio: "4 / 3" }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={thumbUrl(photo.thumbnail_path ?? photo.storage_path, 400)}
                    alt={photo.caption ?? "Foto da obra"}
                    loading="lazy"
                    style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
                  />
                </a>
              ))}
            </div>
          </section>
        ) : null}
      </main>

      <footer style={{ padding: "20px 24px 32px", textAlign: "center", fontSize: 12, color: "#8a9099" }}>
        Powered by <strong style={{ color: brand }}>Obralia</strong>
      </footer>
    </div>
  );
}
