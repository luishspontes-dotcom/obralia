import Link from "next/link";
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

  const { data: maxR } = await supabase
    .from("daily_reports").select("number").eq("site_id", siteId)
    .order("number", { ascending: false }).limit(1).maybeSingle();
  const nextNumber = ((maxR as { number?: number } | null)?.number ?? 0) + 1;

  const { data: inserted, error } = await supabase
    .from("daily_reports")
    .insert({
      site_id: siteId,
      number: nextNumber,
      date, status: "draft",
      weather_morning: wm, weather_afternoon: wa,
      condition_morning: cm, condition_afternoon: ca,
      general_notes: notes,
      created_by: user.id,
    } as never)
    .select("id").single();

  if (error) throw new Error(error.message);
  const insertedId = (inserted as { id: string } | null)?.id;
  redirect(`/obras/${siteId}/rdos/${insertedId}`);
}

export default async function NovoRdoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createServerSupabase();
  const { data: siteRaw } = await supabase
    .from("sites").select("id, name").eq("id", id).maybeSingle();
  const site = siteRaw as { id: string; name: string } | null;
  if (!site) redirect("/obras");

  const today = new Date().toISOString().slice(0, 10);

  const climaOpts = ["", "Claro", "Nublado", "Chuvoso", "Garoa", "Sol forte"];
  const condOpts = ["", "Praticável", "Impraticável", "Parcial"];

  return (
    <div>
      <div className="page-hero">
        <div style={{ maxWidth: 720, margin: "0 auto" }}>
          <div style={{ marginBottom: 12, fontSize: 13 }}>
            <Link href="/obras" style={{ color: "var(--o-text-2)", textDecoration: "none" }}>← Obras</Link>
            <span style={{ color: "var(--o-text-3)", margin: "0 8px" }}>/</span>
            <Link href={`/obras/${id}`} style={{ color: "var(--o-text-2)", textDecoration: "none" }}>{site!.name}</Link>
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
            {site!.name}
          </p>
        </div>
      </div>

      <div style={{ padding: "0 24px 32px", maxWidth: 720, margin: "0 auto" }}>
        <form action={createRdoAction}>
          <input type="hidden" name="siteId" value={id} />
          <div className="card" style={{ padding: "26px 28px" }}>
            <Field label="Data" required>
              <input name="date" type="date" defaultValue={today} required style={inputStyle} />
            </Field>

            <h4 style={{ font: "600 13px var(--font-inter)", color: "var(--o-text-1)", margin: "8px 0 12px", letterSpacing: "-0.005em" }}>
              ☀ Clima
            </h4>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 8 }}>
              <Field label="Tempo manhã">
                <select name="weather_morning" defaultValue="" style={inputStyle}>
                  {climaOpts.map((c) => <option key={c} value={c}>{c || "—"}</option>)}
                </select>
              </Field>
              <Field label="Condição manhã">
                <select name="condition_morning" defaultValue="" style={inputStyle}>
                  {condOpts.map((c) => <option key={c} value={c}>{c || "—"}</option>)}
                </select>
              </Field>
              <Field label="Tempo tarde">
                <select name="weather_afternoon" defaultValue="" style={inputStyle}>
                  {climaOpts.map((c) => <option key={c} value={c}>{c || "—"}</option>)}
                </select>
              </Field>
              <Field label="Condição tarde">
                <select name="condition_afternoon" defaultValue="" style={inputStyle}>
                  {condOpts.map((c) => <option key={c} value={c}>{c || "—"}</option>)}
                </select>
              </Field>
            </div>

            <Field label="Observações gerais" hint="O que aconteceu hoje">
              <textarea name="general_notes" rows={5} placeholder="Ex: Equipe iniciou contramarcos. Recebimento de material às 10h. Pintura paralisada por chuva à tarde…"
                style={{ ...inputStyle, fontFamily: "inherit", resize: "vertical", lineHeight: 1.5 }} />
            </Field>

            <button type="submit" className="btn-brand" style={{
              width: "100%", padding: "13px 16px", fontSize: 15,
              justifyContent: "center", marginTop: 12,
            }}>
              Criar RDO
            </button>
            <p style={{ margin: "12px 0 0", fontSize: 12, color: "var(--o-text-3)", textAlign: "center" }}>
              Você poderá adicionar atividades, fotos e mão de obra depois de criar.
            </p>
          </div>
        </form>
      </div>
    </div>
  );
}

function Field({ label, required, hint, children }: { label: string; required?: boolean; hint?: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <label style={{
        display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 8,
        fontSize: 12, color: "var(--o-text-2)", marginBottom: 6, fontWeight: 500,
      }}>
        <span>
          {label}
          {required && <span style={{ color: "var(--o-accent)", marginLeft: 4 }}>*</span>}
        </span>
        {hint && <span style={{ fontSize: 11, color: "var(--o-text-3)", fontWeight: 400 }}>{hint}</span>}
      </label>
      {children}
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  width: "100%",
  background: "var(--o-paper)",
  border: "1px solid var(--o-border)",
  borderRadius: 10,
  padding: "11px 14px",
  font: "400 14px var(--font-inter)",
  color: "var(--o-text-1)",
  outline: "none",
  transition: "all var(--duration) var(--ease)",
};
