import Link from "next/link";
import { redirect } from "next/navigation";
import { createServerSupabase } from "@/lib/supabase/server";

async function createRdoAction(formData: FormData) {
  "use server";
  const siteId = (formData.get("siteId") as string)?.trim();
  const date = (formData.get("date") as string)?.trim();
  const wm = (formData.get("weather_morning") as string) || null;
  const wa = (formData.get("weather_afternoon") as string) || null;
  const cm = (formData.get("condition_morning") as string) || null;
  const ca = (formData.get("condition_afternoon") as string) || null;
  const notes = (formData.get("general_notes") as string)?.trim() || null;
  if (!siteId || !date) throw new Error("Dados inválidos");

  const supabase = await createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: insertedId, error } = await supabase.rpc("create_daily_report", {
    target_site_id: siteId,
    report_date: date,
    p_weather_morning: wm ?? undefined,
    p_weather_afternoon: wa ?? undefined,
    p_condition_morning: cm ?? undefined,
    p_condition_afternoon: ca ?? undefined,
    p_general_notes: notes ?? undefined,
  });
  if (error) throw new Error(error.message);
  if (!insertedId) throw new Error("RDO criado sem identificador.");
  redirect(`/obras/${siteId}/rdos/${insertedId}`);
}

export default async function NovoRdoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createServerSupabase();
  const { data: siteRaw } = await supabase
    .from("sites").select("id, name").eq("id", id).maybeSingle();
  const site = siteRaw as { id: string; name: string } | null;
  if (!site) redirect("/obras");

  const { data: canCreateRdo } = await supabase.rpc("can_write_site", {
    target_site_id: id,
  });
  if (!canCreateRdo) redirect(`/obras/${id}/rdos`);

  const today = new Date().toISOString().slice(0, 10);

  const inputStyle: React.CSSProperties = {
    width: "100%",
    background: "var(--o-cream)",
    border: "1px solid var(--o-border)",
    borderRadius: 8,
    padding: "10px 12px",
    font: "400 14px var(--font-inter)",
    color: "var(--o-text-1)",
    marginBottom: 12,
    outline: "none",
  };
  const labelStyle: React.CSSProperties = {
    display: "block",
    fontSize: 12,
    color: "var(--o-text-2)",
    marginBottom: 6,
    fontWeight: 500,
  };

  const climaOpts = ["", "Claro", "Nublado", "Chuvoso", "Garoa", "Sol forte"];
  const condOpts = ["", "Praticável", "Impraticável", "Parcial"];

  return (
    <div style={{ padding: "24px", maxWidth: 720, margin: "0 auto" }}>
      <div style={{ marginBottom: 16, fontSize: 13 }}>
        <Link href={`/obras/${id}/rdos`} style={{ color: "var(--o-text-2)", textDecoration: "none" }}>← RDOs</Link>
      </div>
      <h1 style={{ margin: "0 0 4px", font: "700 28px var(--font-inter)", letterSpacing: "-0.02em" }}>
        Novo RDO
      </h1>
      <p style={{ margin: "0 0 24px", fontSize: 14, color: "var(--o-text-2)" }}>
        {site!.name}
      </p>

      <form action={createRdoAction}>
        <input type="hidden" name="siteId" value={id} />
        <div style={{ background: "var(--o-paper)", border: "1px solid var(--o-border)", borderRadius: 12, padding: 24 }}>
          <label style={labelStyle}>Data *</label>
          <input name="date" type="date" defaultValue={today} required style={inputStyle} />

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div>
              <label style={labelStyle}>Tempo manhã</label>
              <select name="weather_morning" defaultValue="" style={inputStyle}>
                {climaOpts.map((c) => <option key={c} value={c}>{c || "—"}</option>)}
              </select>
            </div>
            <div>
              <label style={labelStyle}>Condição manhã</label>
              <select name="condition_morning" defaultValue="" style={inputStyle}>
                {condOpts.map((c) => <option key={c} value={c}>{c || "—"}</option>)}
              </select>
            </div>
            <div>
              <label style={labelStyle}>Tempo tarde</label>
              <select name="weather_afternoon" defaultValue="" style={inputStyle}>
                {climaOpts.map((c) => <option key={c} value={c}>{c || "—"}</option>)}
              </select>
            </div>
            <div>
              <label style={labelStyle}>Condição tarde</label>
              <select name="condition_afternoon" defaultValue="" style={inputStyle}>
                {condOpts.map((c) => <option key={c} value={c}>{c || "—"}</option>)}
              </select>
            </div>
          </div>

          <label style={labelStyle}>Observações gerais</label>
          <textarea name="general_notes" rows={5} placeholder="O que aconteceu hoje na obra…"
            style={{ ...inputStyle, fontFamily: "inherit", resize: "vertical" }} />

          <button type="submit" style={{
            width: "100%",
            padding: "12px 16px",
            background: "var(--o-accent)",
            color: "white",
            border: 0,
            borderRadius: 10,
            font: "600 15px var(--font-inter)",
            cursor: "pointer",
            marginTop: 12,
          }}>
            Criar RDO
          </button>
          <p style={{ margin: "10px 0 0", fontSize: 11, color: "var(--o-text-3)", textAlign: "center" }}>
            Você poderá adicionar atividades, fotos e mão de obra depois de criar.
          </p>
        </div>
      </form>
    </div>
  );
}
