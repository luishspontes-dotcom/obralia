import Link from "next/link";
import { notFound } from "next/navigation";
import { createServerSupabase } from "@/lib/supabase/server";
import { RdoForm } from "@/components/RdoForm";

export default async function EditarRdoPage({
  params,
}: {
  params: Promise<{ id: string; rdoId: string }>;
}) {
  const { id, rdoId } = await params;
  const supabase = await createServerSupabase();

  const { data: siteRaw } = await supabase
    .from("sites").select("id, name").eq("id", id).maybeSingle();
  const site = siteRaw as { id: string; name: string } | null;
  if (!site) notFound();

  const { data: rdoRaw } = await supabase
    .from("daily_reports")
    .select("id, number, date, status, weather_morning, weather_afternoon, condition_morning, condition_afternoon, general_notes")
    .eq("id", rdoId).eq("site_id", id).maybeSingle();
  const rdo = rdoRaw as {
    id: string; number: number; date: string; status: string;
    weather_morning: string | null; weather_afternoon: string | null;
    condition_morning: string | null; condition_afternoon: string | null;
    general_notes: string | null;
  } | null;
  if (!rdo) notFound();

  const [wfR, eqR, acR] = await Promise.all([
    supabase.from("report_workforce").select("role, count").eq("daily_report_id", rdoId),
    supabase.from("report_equipment").select("name, hours").eq("daily_report_id", rdoId),
    supabase.from("report_activities").select("description, progress_pct, notes").eq("daily_report_id", rdoId),
  ]);

  return (
    <div>
      <div className="page-hero">
        <div style={{ maxWidth: 880, margin: "0 auto" }}>
          <div style={{ marginBottom: 12, fontSize: 13 }}>
            <Link href={`/obras/${id}/rdos/${rdoId}`} style={{ color: "var(--o-text-2)", textDecoration: "none" }}>
              ← Voltar pro RDO #{rdo.number}
            </Link>
          </div>
          <div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "0.12em", color: "var(--t-brand)", fontWeight: 600, marginBottom: 8 }}>
            Editar RDO
          </div>
          <h1 style={{ margin: "0 0 6px", font: "700 32px var(--font-inter)", letterSpacing: "-0.025em" }}>
            RDO #{rdo.number}
          </h1>
          <p style={{ margin: 0, fontSize: 14, color: "var(--o-text-2)" }}>{site.name}</p>
        </div>
      </div>

      <div style={{ padding: "0 24px 32px", maxWidth: 880, margin: "0 auto" }}>
        <RdoForm
          siteId={id}
          rdoId={rdoId}
          initial={{
            date: rdo.date,
            status: rdo.status,
            weather_morning: rdo.weather_morning,
            weather_afternoon: rdo.weather_afternoon,
            condition_morning: rdo.condition_morning,
            condition_afternoon: rdo.condition_afternoon,
            general_notes: rdo.general_notes,
            workforce: (wfR.data ?? []) as { role: string; count: number }[],
            equipment: (eqR.data ?? []) as { name: string; hours: number | null }[],
            activities: (acR.data ?? []) as { description: string; progress_pct: number | null; notes: string | null }[],
          }}
        />
      </div>
    </div>
  );
}
