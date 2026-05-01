import { redirect } from "next/navigation";
import { createServerSupabase } from "@/lib/supabase/server";

async function createRdoAction(formData: FormData) {
  "use server";
  const siteId = formData.get("siteId") as string;
  const date = formData.get("date") as string;
  const wm = (formData.get("weather_morning") as string) || null;
  const wa = (formData.get("weather_afternoon") as string) || null;
  const cm = (formData.get("condition_morning") as string) || null;
  const ca = (formData.get("condition_afternoon") as string) || null;
  const notes = (formData.get("general_notes") as string)?.trim() || null;
  if (!siteId || !date) throw new Error("Dados inválidos");

  const supabase = await createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // next number per site
  const { data: maxR } = await supabase
    .from("daily_reports").select("number").eq("site_id", siteId)
    .order("number", { ascending: false }).limit(1).maybeSingle();
  const nextNumber = ((maxR as { number?: number } | null)?.number ?? 0) + 1;

  const { data: inserted, error } = await supabase
    .from("daily_reports")
    .insert({
      site_id: siteId,
      number: nextNumber,
      date,
      status: "draft",
      weather_morning: wm,
      weather_afternoon: wa,
      condition_morning: cm,
      condition_afternoon: ca,
      general_notes: notes,
      created_by: user.id,
    })
    .select("id")
    .single();

  if (error) throw new Error(error.message);
  redirect(`/obras/${siteId}/rdos/${inserted!.id}`);
}

export default async function NovoRdoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createServerSupabase();
  const { data: siteRaw } = await supabase
    .from("sites").select("id, name").eq("id", id).maybeSingle();
  const site = siteRaw as { id: string; name: string } | null;
  if (!site) redirect("/obras");

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
        <a href={`/obras/${id}/rdos`} style={{ color: "var(--o-text-2)", textDecoration: "none" }}>← RDOs</a>
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
