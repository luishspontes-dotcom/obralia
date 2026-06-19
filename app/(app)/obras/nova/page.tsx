import Link from "next/link";
import { redirect } from "next/navigation";
import { OBRALIA_SOURCE_PROVIDER } from "@/lib/rdo-source-scope";
import { createServerSupabase } from "@/lib/supabase/server";

// Etapas padrao da EAP (espelham o "Lista de tarefas" do Diario de Obra).
const ETAPAS_PADRAO: { code: string; name: string }[] = [
  { code: "1.0", name: "Serviços Preliminares" },
  { code: "2.0", name: "Fundação" },
  { code: "3.0", name: "Estrutura" },
  { code: "4.0", name: "Alvenaria, Reboco e Contrapiso" },
  { code: "5.0", name: "Cobertura" },
  { code: "6.0", name: "Esquadrias" },
  { code: "7.0", name: "Revestimento" },
  { code: "8.0", name: "Forro" },
  { code: "9.0", name: "Pintura" },
  { code: "10.0", name: "Instalações Elétricas" },
  { code: "11.0", name: "Instalações Hidráulicas" },
  { code: "12.0", name: "Serviços Finais" },
];

async function createObraAction(formData: FormData) {
  "use server";
  const supabase = await createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profileR } = await supabase
    .from("profiles").select("default_org_id").eq("id", user.id).maybeSingle();
  let orgId = (profileR as { default_org_id?: string } | null)?.default_org_id ?? null;
  if (!orgId) {
    const { data: orgsR } = await supabase.from("organizations").select("id").limit(1);
    orgId = (orgsR as { id: string }[] | null)?.[0]?.id ?? null;
  }
  if (!orgId) throw new Error("Sem organização ativa.");

  const name = (formData.get("name") as string)?.trim();
  if (!name) throw new Error("Nome é obrigatório");
  const address = (formData.get("address") as string)?.trim() || null;
  const client_name = (formData.get("client_name") as string)?.trim() || null;
  const responsible_name = (formData.get("responsible_name") as string)?.trim() || null;
  const contract_type = (formData.get("contract_type") as string)?.trim() || null;
  const site_group = (formData.get("site_group") as string)?.trim() || null;
  const start_date = (formData.get("start_date") as string) || null;
  const end_date = (formData.get("end_date") as string) || null;
  const contract_number = (formData.get("contract_number") as string)?.trim() || null;
  const statusRaw = (formData.get("status") as string) || "in_progress";
  const allowedStatus = ["in_progress", "not_started", "done", "paused"];
  const status = allowedStatus.includes(statusRaw) ? statusRaw : "in_progress";
  const createTasks = formData.get("create_tasks") === "on";

  const { data: inserted, error } = await supabase
    .from("sites")
    .insert({
      organization_id: orgId,
      name, address, client_name, responsible_name, contract_type, site_group,
      start_date, end_date, contract_number,
      status,
      external_provider: OBRALIA_SOURCE_PROVIDER,
    } as never)
    .select("id")
    .single();

  if (error) throw new Error(error.message);
  const insertedId = (inserted as { id: string } | null)?.id;
  if (!insertedId) throw new Error("Falha ao criar a obra.");

  // "Lista de tarefas" marcado: cria as etapas padrao da EAP (igual ao Diario).
  if (createTasks) {
    const rows = ETAPAS_PADRAO.map((e, i) => ({
      site_id: insertedId,
      parent_id: null,
      code: e.code,
      name: e.name,
      status: "not_started",
      progress_pct: 0,
      position: i,
      external_provider: OBRALIA_SOURCE_PROVIDER,
    }));
    await supabase.from("wbs_items").insert(rows as never);
  }

  redirect(`/obras/${insertedId}`);
}

export default function NovaObraPage() {
  return (
    <div>
      <div className="page-hero">
        <div style={{ maxWidth: 720, margin: "0 auto" }}>
          <div style={{ marginBottom: 12, fontSize: 13 }}>
            <Link href="/obras" style={{ color: "var(--o-text-2)", textDecoration: "none" }}>← Obras</Link>
          </div>
          <div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "0.12em", color: "var(--t-brand)", fontWeight: 600, marginBottom: 8 }}>
            Cadastro
          </div>
          <h1 style={{ margin: "0 0 8px", font: "700 32px var(--font-inter)", letterSpacing: "-0.025em" }}>
            Nova obra
          </h1>
          <p style={{ margin: 0, fontSize: 14, color: "var(--o-text-2)" }}>
            Cadastre os dados básicos. Você poderá adicionar EAP, RDOs e fotos depois.
          </p>
        </div>
      </div>

      <div style={{ padding: "0 24px 32px", maxWidth: 720, margin: "0 auto" }}>
        <form action={createObraAction}>
          <div className="card" style={{ padding: "26px 28px" }}>
            <Field label="Nome da obra" required>
              <input name="name" required placeholder="Ex: ALINE E ANDERSON" style={inputStyle} />
            </Field>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
              <Field label="Responsável">
                <input name="responsible_name" placeholder="Ex: Eng. Carlos Silva" style={inputStyle} />
              </Field>
              <Field label="Tipo de contrato">
                <select name="contract_type" defaultValue="Contratante" style={inputStyle}>
                  <option value="Contratante">Contratante</option>
                  <option value="Empreitada">Empreitada</option>
                  <option value="Administração">Administração</option>
                  <option value="Preço fechado">Preço fechado</option>
                </select>
              </Field>
            </div>

            <Field label="Contratante">
              <input name="client_name" placeholder="Ex: Aline e Anderson" style={inputStyle} />
            </Field>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 14 }}>
              <Field label="Início" required>
                <input name="start_date" type="date" required style={inputStyle} />
              </Field>
              <Field label="Previsão de término" required>
                <input name="end_date" type="date" required style={inputStyle} />
              </Field>
              <Field label="Grupo" required>
                <select name="site_group" defaultValue="Todas as obras" style={inputStyle}>
                  <option value="Todas as obras">Todas as obras</option>
                </select>
              </Field>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
              <Field label="Número do contrato" hint="Opcional">
                <input name="contract_number" placeholder="Ex: DIA-12345" style={inputStyle} />
              </Field>
              <Field label="Status" required>
                <select name="status" defaultValue="in_progress" style={inputStyle}>
                  <option value="in_progress">Em andamento</option>
                  <option value="not_started">Não iniciada</option>
                  <option value="done">Concluída</option>
                  <option value="paused">Pausada</option>
                </select>
              </Field>
            </div>

            <Field label="Endereço">
              <input name="address" placeholder="Ex: Cond. Vitality, Lote 36 da Quadra 01" style={inputStyle} />
            </Field>

            <div style={{ marginTop: 6, paddingTop: 14, borderTop: "1px solid var(--o-border)" }}>
              <div style={{ fontSize: 12, color: "var(--o-text-2)", fontWeight: 600, marginBottom: 8 }}>Configurações</div>
              <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 14, cursor: "pointer" }}>
                <input type="checkbox" name="create_tasks" style={{ width: 16, height: 16 }} />
                Lista de tarefas
                <span style={{ fontSize: 12, color: "var(--o-text-3)" }}>(cria as etapas padrão da EAP)</span>
              </label>
            </div>

            <button type="submit" className="btn-brand" style={{
              width: "100%",
              padding: "13px 16px",
              fontSize: 15,
              justifyContent: "center",
              marginTop: 18,
            }}>
              Criar obra
            </button>
            <p style={{ margin: "12px 0 0", fontSize: 12, color: "var(--o-text-3)", textAlign: "center" }}>
              Você pode editar todos esses dados depois em “Editar obra”.
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
  color: "var(--o-text)",
};
