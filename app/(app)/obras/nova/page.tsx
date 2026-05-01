import Link from "next/link";
import { redirect } from "next/navigation";
import { createServerSupabase } from "@/lib/supabase/server";

async function createObraAction(formData: FormData) {
  "use server";
  const supabase = await createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profileR } = await supabase
    .from("profiles").select("default_org_id").eq("id", user.id).maybeSingle();
  const orgId = (profileR as { default_org_id?: string } | null)?.default_org_id;
  if (!orgId) {
    const { data: orgsR } = await supabase.from("organizations").select("id").limit(1);
    const fallbackOrgId = (orgsR as { id: string }[] | null)?.[0]?.id;
    if (!fallbackOrgId) throw new Error("Sem organização ativa.");
  }

  const name = (formData.get("name") as string)?.trim();
  if (!name) throw new Error("Nome é obrigatório");
  const address = (formData.get("address") as string)?.trim() || null;
  const client_name = (formData.get("client_name") as string)?.trim() || null;
  const start_date = (formData.get("start_date") as string) || null;
  const end_date = (formData.get("end_date") as string) || null;
  const contract_number = (formData.get("contract_number") as string)?.trim() || null;

  const finalOrgId = orgId ?? (await supabase.from("organizations").select("id").limit(1).single()).data?.id;
  if (!finalOrgId) throw new Error("Sem organização.");

  const { data: inserted, error } = await supabase
    .from("sites")
    .insert({
      organization_id: finalOrgId,
      name,
      address,
      client_name,
      start_date,
      end_date,
      contract_number,
      status: "in_progress",
    } as never)
    .select("id")
    .single();

  if (error) throw new Error(error.message);
  const insertedId = (inserted as { id: string } | null)?.id;
  redirect(`/obras/${insertedId}`);
}

export default function NovaObraPage() {
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

  return (
    <div style={{ padding: "24px", maxWidth: 720, margin: "0 auto" }}>
      <div style={{ marginBottom: 16, fontSize: 13 }}>
        <Link href="/obras" style={{ color: "var(--o-text-2)", textDecoration: "none" }}>← Obras</Link>
      </div>
      <h1 style={{ margin: "0 0 4px", font: "700 28px var(--font-inter)", letterSpacing: "-0.02em" }}>
        Nova obra
      </h1>
      <p style={{ margin: "0 0 24px", fontSize: 14, color: "var(--o-text-2)" }}>
        Cadastre uma nova obra — você poderá adicionar EAP, RDOs e fotos depois.
      </p>

      <form action={createObraAction}>
        <div style={{
          background: "var(--o-paper)",
          border: "1px solid var(--o-border)",
          borderRadius: 12,
          padding: 24,
        }}>
          <label style={labelStyle}>Nome da obra *</label>
          <input name="name" required placeholder="Ex: ALINE E ANDERSON" style={inputStyle} />

          <label style={labelStyle}>Cliente</label>
          <input name="client_name" placeholder="Ex: Aline e Anderson" style={inputStyle} />

          <label style={labelStyle}>Endereço</label>
          <input name="address" placeholder="Ex: Cond. Vitality, Lote 36 da Quadra 01" style={inputStyle} />

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div>
              <label style={labelStyle}>Início</label>
              <input name="start_date" type="date" style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>Previsão de término</label>
              <input name="end_date" type="date" style={inputStyle} />
            </div>
          </div>

          <label style={labelStyle}>Número do contrato</label>
          <input name="contract_number" placeholder="Opcional" style={inputStyle} />

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
            Criar obra
          </button>
        </div>
      </form>
    </div>
  );
}
