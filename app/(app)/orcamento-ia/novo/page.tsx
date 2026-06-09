import Link from "next/link";
import { UploadCloud } from "lucide-react";
import { createAiEstimate } from "@/lib/budget-ai/actions";
import { createServerSupabase } from "@/lib/supabase/server";
import { untypedDb } from "@/lib/supabase/untyped";

type Site = { id: string; name: string };

export default async function NovoOrcamentoIaPage() {
  const supabase = await createServerSupabase();
  const db = untypedDb(supabase);
  const { data: sitesRaw } = await db
    .from("sites")
    .select("id, name")
    .order("created_at", { ascending: false })
    .limit(200);
  const sites = (sitesRaw ?? []) as Site[];

  return (
    <div>
      <div className="page-hero">
        <div style={{ maxWidth: 1080, margin: "0 auto" }}>
          <Link href="/orcamento-ia" style={{ color: "var(--o-text-2)", textDecoration: "none", fontSize: 13 }}>
            ← Orçamento IA
          </Link>
          <h1 style={{ margin: "14px 0 8px", font: "700 32px var(--font-inter)", letterSpacing: "-0.025em" }}>
            Novo estudo de orçamento
          </h1>
          <p style={{ margin: 0, maxWidth: 720, color: "var(--o-text-2)", fontSize: 14 }}>
            Envie os arquivos e confirme os parâmetros principais. O sistema gera uma primeira base de memorial e orçamento com itens marcados para revisão.
          </p>
        </div>
      </div>

      <div style={{ padding: "0 24px 40px", maxWidth: 1080, margin: "0 auto" }}>
        <form action={createAiEstimate} encType="multipart/form-data" className="card" style={{ padding: 22 }}>
          <div className="ai-budget-form-grid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
            <Field label="Nome do estudo" required>
              <input name="title" required defaultValue="FER E MACIEL - Estudo preliminar" style={inputStyle} />
            </Field>
            <Field label="Obra vinculada">
              <select name="site_id" defaultValue="" style={inputStyle}>
                <option value="">Sem vinculo por enquanto</option>
                {sites.map((site) => (
                  <option key={site.id} value={site.id}>{site.name}</option>
                ))}
              </select>
            </Field>
            <Field label="Cliente">
              <input name="client_name" placeholder="Nome do cliente" defaultValue="Fernando e Maciel" style={inputStyle} />
            </Field>
            <Field label="Endereço">
              <input name="address" placeholder="Condomínio, lote, cidade..." defaultValue="Cond. Terras Alpha, lote 16, quadra Y1" style={inputStyle} />
            </Field>
            <Field label="Área construída (m²)" required>
              <input name="built_area_m2" required inputMode="decimal" defaultValue="424,56" style={inputStyle} />
            </Field>
            <Field label="Área da piscina (m²)">
              <input name="pool_area_m2" inputMode="decimal" defaultValue="24,31" style={inputStyle} />
            </Field>
            <Field label="Área do terreno (m²)">
              <input name="terrain_area_m2" inputMode="decimal" placeholder="Ex.: 418,18" style={inputStyle} />
            </Field>
            <Field label="Pavimentos">
              <input name="floors_count" inputMode="numeric" defaultValue="3" style={inputStyle} />
            </Field>
            <Field label="Padrão">
              <select name="quality_standard" defaultValue="alto_padrao" style={inputStyle}>
                <option value="alto_padrao">Alto padrão</option>
                <option value="medio_alto">Médio alto</option>
                <option value="economico">Econômico</option>
              </select>
            </Field>
            <label style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 24, color: "var(--o-text-1)", fontWeight: 600 }}>
              <input name="has_basement" type="checkbox" defaultChecked />
              Possui subsolo/corte relevante
            </label>
          </div>

          <div style={{ marginTop: 24, borderTop: "1px solid var(--o-border)", paddingTop: 20 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
              <UploadCloud size={18} color="var(--t-brand)" />
              <h2 style={{ margin: 0, font: "700 18px var(--font-inter)" }}>Arquivos de referência</h2>
            </div>
            <div className="ai-budget-form-grid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 14 }}>
              <FileField label="Planta PDF" name="plan_files" accept=".pdf,application/pdf" />
              <FileField label="Memorial/proposta PDF" name="proposal_files" accept=".pdf,application/pdf" />
              <FileField label="Planilha XLSX" name="spreadsheet_files" accept=".xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" />
            </div>
          </div>

          <div style={{ marginTop: 22, display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
            <p style={{ margin: 0, color: "var(--o-text-2)", fontSize: 12, maxWidth: 620 }}>
              O resultado nasce como revisão técnica, não como proposta final. Itens estimados por verba ou regra paramétrica serão sinalizados.
            </p>
            <button type="submit" className="btn-brand" style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
              Gerar estudo preliminar
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <label style={{ display: "grid", gap: 6 }}>
      <span style={{ font: "600 12px var(--font-inter)", color: "var(--o-text-2)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
        {label}{required ? " *" : ""}
      </span>
      {children}
    </label>
  );
}

function FileField({ label, name, accept }: { label: string; name: string; accept: string }) {
  return (
    <label style={{ display: "grid", gap: 8, border: "1px dashed var(--o-border-2)", borderRadius: 10, padding: 14, background: "var(--o-soft)" }}>
      <span style={{ fontWeight: 700, color: "var(--o-text-1)" }}>{label}</span>
      <input name={name} type="file" accept={accept} multiple style={{ fontSize: 12 }} />
      <span style={{ color: "var(--o-text-2)", fontSize: 12 }}>Pode enviar mais de um arquivo.</span>
    </label>
  );
}

const inputStyle: React.CSSProperties = {
  width: "100%",
  border: "1px solid var(--o-border)",
  borderRadius: 8,
  background: "white",
  color: "var(--o-text-1)",
  padding: "10px 12px",
  font: "400 14px var(--font-inter)",
  outline: "none",
};
