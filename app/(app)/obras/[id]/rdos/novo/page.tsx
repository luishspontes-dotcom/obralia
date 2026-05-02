import Link from "next/link";
import { redirect } from "next/navigation";
import { createServerSupabase } from "@/lib/supabase/server";
import { RdoForm } from "@/components/RdoForm";

export default async function NovoRdoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createServerSupabase();
  const { data: siteRaw } = await supabase
    .from("sites").select("id, name").eq("id", id).maybeSingle();
  const site = siteRaw as { id: string; name: string } | null;
  if (!site) redirect("/obras");

  const { data: tplRaw } = await supabase
    .from("rdo_templates").select("id, name, workforce, equipment, activities");
  const templates = (tplRaw ?? []) as Array<{ id: string; name: string; workforce: unknown; equipment: unknown; activities: unknown }>;

  return (
    <div>
      <div className="page-hero">
        <div style={{ maxWidth: 880, margin: "0 auto" }}>
          <div style={{ marginBottom: 12, fontSize: 13 }}>
            <Link href="/obras" style={{ color: "var(--o-text-2)", textDecoration: "none" }}>← Obras</Link>
            <span style={{ color: "var(--o-text-3)", margin: "0 8px" }}>/</span>
            <Link href={`/obras/${id}`} style={{ color: "var(--o-text-2)", textDecoration: "none" }}>{site.name}</Link>
            <span style={{ color: "var(--o-text-3)", margin: "0 8px" }}>/</span>
            <Link href={`/obras/${id}/rdos`} style={{ color: "var(--o-text-2)", textDecoration: "none" }}>RDOs</Link>
            <span style={{ color: "var(--o-text-3)", margin: "0 8px" }}>/</span>
            <span style={{ color: "var(--o-text-1)", fontWeight: 500 }}>Novo</span>
          </div>
          <div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "0.12em", color: "var(--t-brand)", fontWeight: 600, marginBottom: 8 }}>
            Diário de obra
          </div>
          <h1 style={{ margin: "0 0 6px", font: "700 32px var(--font-inter)", letterSpacing: "-0.025em" }}>
            Novo RDO
          </h1>
          <p style={{ margin: 0, fontSize: 14, color: "var(--o-text-2)" }}>
            {site.name} · preencha o que aconteceu hoje na obra.
          </p>
        </div>
      </div>

      <div style={{ padding: "0 24px 32px", maxWidth: 880, margin: "0 auto" }}>
        <RdoForm
          siteId={id}
          templates={templates.map((t) => ({
            id: t.id, name: t.name,
            workforce: Array.isArray(t.workforce) ? (t.workforce as { role: string; count: number }[]) : [],
            equipment: Array.isArray(t.equipment) ? (t.equipment as { name: string; hours: number | null }[]) : [],
            activities: Array.isArray(t.activities) ? (t.activities as { description: string; progress_pct: number | null; notes: string | null }[]) : [],
          }))}
        />
      </div>
    </div>
  );
}
