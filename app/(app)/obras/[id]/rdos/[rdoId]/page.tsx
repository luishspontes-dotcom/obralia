import Link from "next/link";
import { notFound } from "next/navigation";
import { createServerSupabase } from "@/lib/supabase/server";

type Site = { id: string; name: string; client_name: string | null };
type DR = {
  id: string;
  number: number;
  date: string;
  status: string;
  weather_morning: string | null;
  weather_afternoon: string | null;
  condition_morning: string | null;
  condition_afternoon: string | null;
  general_notes: string | null;
};
type Activity = {
  id: string;
  description: string;
  progress_pct: number | null;
  notes: string | null;
};
type Media = {
  id: string;
  storage_path: string | null;
  thumbnail_path: string | null;
  caption: string | null;
};

const STATUS_META: Record<string, { label: string; color: string; bg: string }> = {
  draft: { label: "Rascunho", color: "var(--o-text-2)", bg: "rgba(0,0,0,0.04)" },
  review: { label: "Em revisão", color: "var(--st-progress)", bg: "rgba(8, 120, 155, 0.08)" },
  approved: { label: "Aprovado", color: "var(--st-done)", bg: "rgba(34, 139, 34, 0.08)" },
};

export default async function RdoDetailPage({
  params,
}: {
  params: Promise<{ id: string; rdoId: string }>;
}) {
  const { id, rdoId } = await params;
  const supabase = await createServerSupabase();

  const { data: siteRaw } = await supabase
    .from("sites").select("id, name, client_name")
    .eq("id", id).maybeSingle();
  const site = siteRaw as Site | null;
  if (!site) notFound();

  const { data: rdoRaw } = await supabase
    .from("daily_reports")
    .select("id, number, date, status, weather_morning, weather_afternoon, condition_morning, condition_afternoon, general_notes")
    .eq("id", rdoId).maybeSingle();
  const rdo = rdoRaw as DR | null;
  if (!rdo) notFound();

  const { data: actsRaw } = await supabase
    .from("report_activities").select("id, description, progress_pct, notes")
    .eq("daily_report_id", rdoId);
  const activities = (actsRaw ?? []) as Activity[];

  const { data: mediaRaw } = await supabase
    .from("media").select("id, storage_path, thumbnail_path, caption")
    .eq("daily_report_id", rdoId)
    .eq("kind", "photo")
    .limit(50);
  const photos = (mediaRaw ?? []) as Media[];

  const meta = STATUS_META[rdo.status] ?? STATUS_META.draft;
  const d = new Date(rdo.date);
  const dateLong = d.toLocaleDateString("pt-BR", {
    weekday: "long", day: "2-digit", month: "long", year: "numeric",
  });

  return (
    <div style={{ padding: "24px", maxWidth: 1280, margin: "0 auto" }}>
      <div style={{ marginBottom: 16, fontSize: 13 }}>
        <Link href="/obras" style={{ color: "var(--o-text-2)", textDecoration: "none" }}>Obras</Link>
        <span style={{ color: "var(--o-text-3)", margin: "0 8px" }}>/</span>
        <Link href={`/obras/${id}`} style={{ color: "var(--o-text-2)", textDecoration: "none" }}>{site.name}</Link>
        <span style={{ color: "var(--o-text-3)", margin: "0 8px" }}>/</span>
        <Link href={`/obras/${id}/rdos`} style={{ color: "var(--o-text-2)", textDecoration: "none" }}>RDOs</Link>
        <span style={{ color: "var(--o-text-3)", margin: "0 8px" }}>/</span>
        <span style={{ color: "var(--o-text-1)", fontWeight: 500 }}>#{rdo.number}</span>
      </div>

      <div style={{ marginBottom: 28 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 10 }}>
          <div style={{
            font: "700 32px var(--font-inter)",
            color: "var(--t-brand)",
            letterSpacing: "-0.02em",
          }} className="tnum">RDO #{rdo.number}</div>
          <span style={{
            padding: "4px 12px",
            background: meta.bg, color: meta.color,
            borderRadius: 999, fontSize: 12, fontWeight: 500,
          }}>{meta.label}</span>
        </div>
        <div style={{
          fontSize: 16, color: "var(--o-text-2)",
          textTransform: "capitalize", marginBottom: 4,
        }}>{dateLong}</div>
      </div>

      <div style={{
        display: "grid", gap: 20,
        gridTemplateColumns: "1fr 1fr",
        marginBottom: 28,
      }}>
        <Block title="Clima — Manhã">
          <KV label="Tempo" value={rdo.weather_morning ?? "—"} />
          <KV label="Condição" value={rdo.condition_morning ?? "—"} />
        </Block>
        <Block title="Clima — Tarde">
          <KV label="Tempo" value={rdo.weather_afternoon ?? "—"} />
          <KV label="Condição" value={rdo.condition_afternoon ?? "—"} />
        </Block>
      </div>

      {rdo.general_notes && (
        <Block title="Observações gerais" style={{ marginBottom: 28 }}>
          <div style={{ fontSize: 14, color: "var(--o-text-1)", whiteSpace: "pre-wrap" }}>
            {rdo.general_notes}
          </div>
        </Block>
      )}

      {activities.length > 0 && (
        <div style={{ marginBottom: 28 }}>
          <h3 style={{ font: "600 14px var(--font-inter)", textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--o-text-3)", margin: "0 0 12px" }}>
            Atividades · {activities.length}
          </h3>
          <div style={{ background: "var(--o-paper)", border: "1px solid var(--o-border)", borderRadius: 12, overflow: "hidden" }}>
            {activities.map((a, i) => (
              <div key={a.id} style={{
                display: "flex", alignItems: "center", gap: 12,
                padding: "12px 18px",
                borderTop: i === 0 ? "none" : "1px solid var(--o-border)",
                fontSize: 14,
              }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 500, marginBottom: 2 }}>{a.description}</div>
                  {a.notes && <div style={{ fontSize: 12, color: "var(--o-text-3)" }}>{a.notes}</div>}
                </div>
                <div style={{ width: 64 }}>
                  <div style={{ height: 6, background: "var(--o-border)", borderRadius: 3, overflow: "hidden" }}>
                    <div style={{
                      width: `${a.progress_pct ?? 0}%`,
                      height: "100%",
                      background: (a.progress_pct ?? 0) >= 100 ? "var(--st-done)" : "var(--t-brand)",
                    }} />
                  </div>
                </div>
                <span className="tnum" style={{ fontSize: 13, fontWeight: 500, minWidth: 36, textAlign: "right", color: (a.progress_pct ?? 0) >= 100 ? "var(--st-done)" : "var(--o-text-1)" }}>
                  {a.progress_pct ?? 0}%
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {photos.length > 0 && (
        <div>
          <h3 style={{ font: "600 14px var(--font-inter)", textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--o-text-3)", margin: "0 0 12px" }}>
            Fotos · {photos.length}
          </h3>
          <div style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))",
            gap: 8,
          }}>
            {photos.map((p) => (
              <a key={p.id} href={p.storage_path ?? "#"} target="_blank" rel="noreferrer"
                style={{
                  display: "block",
                  aspectRatio: "4 / 3",
                  background: "var(--o-border)",
                  borderRadius: 8,
                  overflow: "hidden",
                  position: "relative",
                }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={p.thumbnail_path ?? p.storage_path ?? ""}
                  alt={p.caption ?? "Foto da obra"}
                  loading="lazy"
                  style={{ width: "100%", height: "100%", objectFit: "cover" }}
                />
              </a>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function Block({ title, children, style }: { title: string; children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div style={{
      background: "var(--o-paper)",
      border: "1px solid var(--o-border)",
      borderRadius: 12,
      padding: 18,
      ...style,
    }}>
      <h3 style={{ font: "600 12px var(--font-inter)", textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--o-text-3)", margin: "0 0 12px" }}>
        {title}
      </h3>
      {children}
    </div>
  );
}

function KV({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", fontSize: 14 }}>
      <span style={{ color: "var(--o-text-2)" }}>{label}</span>
      <span style={{ fontWeight: 500 }}>{value}</span>
    </div>
  );
}
