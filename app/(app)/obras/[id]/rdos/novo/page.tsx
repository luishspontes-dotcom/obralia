import Link from "next/link";
import { redirect } from "next/navigation";
import { canWriteOrganization } from "@/lib/org-access";
import { createServerSupabase } from "@/lib/supabase/server";
import { RdoForm } from "@/components/RdoForm";

export default async function NovoRdoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: siteRaw } = await supabase
    .from("sites").select("id, name, organization_id").eq("id", id).maybeSingle();
  const site = siteRaw as { id: string; name: string; organization_id: string } | null;
  if (!site) redirect("/obras");
  if (!(await canWriteOrganization(supabase, user.id, site.organization_id))) {
    redirect(`/obras/${id}`);
  }

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
        <RdoForm siteId={id} />
      </div>
    </div>
  );
}
