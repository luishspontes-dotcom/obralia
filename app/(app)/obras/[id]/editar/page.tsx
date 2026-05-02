import Link from "next/link";
import { notFound } from "next/navigation";
import { createServerSupabase } from "@/lib/supabase/server";
import { updateSite, uploadSiteCover } from "@/lib/rdo-actions";

type Site = {
  id: string;
  name: string;
  client_name: string | null;
  address: string | null;
  start_date: string | null;
  end_date: string | null;
  contract_number: string | null;
  status: string | null;
};

export default async function EditarObraPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createServerSupabase();
  const { data: siteRaw } = await supabase
    .from("sites")
    .select("id, name, client_name, address, start_date, end_date, contract_number, status")
    .eq("id", id).maybeSingle();
  const site = siteRaw as Site | null;
  if (!site) notFound();

  return (
    <div>
      <div className="page-hero">
        <div style={{ maxWidth: 720, margin: "0 auto" }}>
          <div style={{ marginBottom: 12, fontSize: 13 }}>
            <Link href={`/obras/${id}`} style={{ color: "var(--o-text-2)", textDecoration: "none" }}>
              ← Voltar pra obra
            </Link>
          </div>
          <div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "0.12em", color: "var(--t-brand)", fontWeight: 600, marginBottom: 8 }}>
            Editar obra
          </div>
          <h1 style={{ margin: "0 0 6px", font: "700 32px var(--font-inter)", letterSpacing: "-0.025em" }}>
            {site.name}
          </h1>
        </div>
      </div>

      <div style={{ padding: "0 24px 32px", maxWidth: 720, margin: "0 auto", display: "flex", flexDirection: "column", gap: 18 }}>
        <form action={updateSite} className="card" style={{ padding: "26px 28px" }}>
          <input type="hidden" name="id" value={id} />

          <Field label="Nome da obra" required>
            <input name="name" required defaultValue={site.name} style={inputStyle} />
          </Field>
          <Field label="Cliente">
            <input name="client_name" defaultValue={site.client_name ?? ""} style={inputStyle} />
          </Field>
          <Field label="Endereço">
            <input name="address" defaultValue={site.address ?? ""} style={inputStyle} />
          </Field>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
            <Field label="Início">
              <input name="start_date" type="date" defaultValue={site.start_date ?? ""} style={inputStyle} />
            </Field>
            <Field label="Previsão de término">
              <input name="end_date" type="date" defaultValue={site.end_date ?? ""} style={inputStyle} />
            </Field>
          </div>
          <Field label="Número do contrato" hint="Opcional">
            <input name="contract_number" defaultValue={site.contract_number ?? ""} style={inputStyle} />
          </Field>
          <Field label="Status">
            <select name="status" defaultValue={site.status ?? "in_progress"} style={inputStyle}>
              <option value="in_progress">Em andamento</option>
              <option value="planned">Planejada</option>
              <option value="paused">Pausada</option>
              <option value="completed">Concluída</option>
              <option value="cancelled">Cancelada</option>
            </select>
          </Field>

          <button type="submit" className="btn-brand" style={{
            width: "100%", padding: "13px 16px", fontSize: 15,
            justifyContent: "center", marginTop: 10,
          }}>
            Salvar alterações
          </button>
        </form>

        <form action={uploadSiteCover} className="card" style={{ padding: "20px 24px" }}>
          <input type="hidden" name="siteId" value={id} />
          <h3 className="section-title" style={{ marginBottom: 12 }}>Capa da obra</h3>
          <p style={{ margin: "0 0 12px", fontSize: 13, color: "var(--o-text-2)" }}>
            A foto de capa aparece no card da obra e no topo do detalhe.
          </p>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <input type="file" name="cover" accept="image/*" required
              style={{ font: "400 13px var(--font-inter)", color: "var(--o-text-2)" }} />
            <button type="submit" className="chip" style={{ cursor: "pointer" }}>Atualizar capa</button>
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
          {required && <span style={{ color: "var(--o-accent, #C28E3A)", marginLeft: 4 }}>*</span>}
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
};
