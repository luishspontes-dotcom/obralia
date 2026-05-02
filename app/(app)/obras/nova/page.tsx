import Link from "next/link";
import { redirect } from "next/navigation";
import { getActiveWritableOrgId } from "@/lib/org-access";
import { createServerSupabase } from "@/lib/supabase/server";

async function createObraAction(formData: FormData) {
  "use server";
  const supabase = await createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const orgId = await getActiveWritableOrgId(supabase, user.id);
  if (!orgId) throw new Error("Sem permissão para criar obras.");

  const name = (formData.get("name") as string)?.trim();
  if (!name) throw new Error("Nome é obrigatório");
  const address = (formData.get("address") as string)?.trim() || null;
  const client_name = (formData.get("client_name") as string)?.trim() || null;
  const start_date = (formData.get("start_date") as string) || null;
  const end_date = (formData.get("end_date") as string) || null;
  const contract_number = (formData.get("contract_number") as string)?.trim() || null;

  const { data: inserted, error } = await supabase
    .from("sites")
    .insert({
      organization_id: orgId,
      name, address, client_name,
      start_date, end_date, contract_number,
      status: "in_progress",
    } as never)
    .select("id")
    .single();

  if (error) throw new Error(error.message);
  const insertedId = (inserted as { id: string } | null)?.id;
  redirect(`/obras/${insertedId}`);
}

export default async function NovaObraPage() {
  const supabase = await createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const orgId = await getActiveWritableOrgId(supabase, user.id);
  if (!orgId) redirect("/obras");

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
            <Field label="Cliente">
              <input name="client_name" placeholder="Ex: Aline e Anderson" style={inputStyle} />
            </Field>
            <Field label="Endereço">
              <input name="address" placeholder="Ex: Cond. Vitality, Lote 36 da Quadra 01" style={inputStyle} />
            </Field>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
              <Field label="Início">
                <input name="start_date" type="date" style={inputStyle} />
              </Field>
              <Field label="Previsão de término">
                <input name="end_date" type="date" style={inputStyle} />
              </Field>
            </div>

            <Field label="Número do contrato" hint="Opcional">
              <input name="contract_number" placeholder="Ex: DIA-12345" style={inputStyle} />
            </Field>

            <button type="submit" className="btn-brand" style={{
              width: "100%",
              padding: "13px 16px",
              fontSize: 15,
              justifyContent: "center",
              marginTop: 12,
            }}>
              Criar obra
            </button>
            <p style={{ margin: "12px 0 0", fontSize: 12, color: "var(--o-text-3)", textAlign: "center" }}>
              A obra é criada com status “Em andamento”. Você pode mudar depois.
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
