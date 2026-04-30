import { createServerSupabase } from "@/lib/supabase/server";
import { ChangePasswordForm } from "./ChangePasswordForm";

type Profile = { id: string; full_name: string; default_org_id: string | null; is_platform_admin?: boolean };
type Org = { id: string; name: string; brand_color: string | null; plan: string | null; slug: string };

export default async function ConfigPage() {
  const supabase = await createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profileR } = await supabase
    .from("profiles").select("id, full_name, default_org_id, is_platform_admin")
    .eq("id", user.id).maybeSingle();
  const profile = profileR as Profile | null;

  const { data: orgsR } = await supabase
    .from("organizations").select("id, name, brand_color, plan, slug");
  const orgs = (orgsR ?? []) as Org[];
  const activeOrg = orgs.find((o) => o.id === profile?.default_org_id) ?? orgs[0] ?? null;

  return (
    <div style={{ padding: "24px", maxWidth: 720, margin: "0 auto" }}>
      <h1 style={{ margin: "0 0 4px", font: "700 28px var(--font-inter)", letterSpacing: "-0.02em" }}>
        Configurações
      </h1>
      <p style={{ margin: "0 0 24px", fontSize: 14, color: "var(--o-text-2)" }}>
        Sua conta e a organização ativa.
      </p>

      <Section title="Sua conta">
        <Field label="E-mail" value={user.email ?? "—"} />
        <Field label="Nome" value={profile?.full_name ?? "—"} />
        <Field label="ID" value={user.id} mono />
        {profile?.is_platform_admin && (
          <Field label="Papel" value="Super admin de plataforma" />
        )}
      </Section>

      {activeOrg && (
        <Section title="Organização ativa">
          <Field label="Nome" value={activeOrg.name} />
          <Field label="Slug" value={activeOrg.slug} mono />
          <Field label="Plano" value={activeOrg.plan ?? "—"} />
          {activeOrg.brand_color && (
            <div style={{ display: "flex", justifyContent: "space-between", padding: "10px 0", borderBottom: "1px solid var(--o-border)" }}>
              <span style={{ color: "var(--o-text-2)", fontSize: 14 }}>Cor da marca</span>
              <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
                <span style={{ width: 18, height: 18, borderRadius: 4, background: activeOrg.brand_color, border: "1px solid var(--o-border)" }} />
                <span className="tnum" style={{ fontSize: 13 }}>{activeOrg.brand_color}</span>
              </span>
            </div>
          )}
        </Section>
      )}

      <Section title="Trocar senha">
        <ChangePasswordForm />
      </Section>

      <Section title="Sair">
        <form action="/auth/signout" method="post">
          <button type="submit" style={{
            padding: "10px 16px",
            background: "transparent",
            color: "var(--st-late)",
            border: "1px solid var(--st-late)",
            borderRadius: 8,
            fontSize: 14, fontWeight: 500,
            cursor: "pointer",
          }}>
            Encerrar sessão
          </button>
        </form>
      </Section>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ background: "var(--o-paper)", border: "1px solid var(--o-border)", borderRadius: 12, padding: 20, marginBottom: 16 }}>
      <h3 style={{ font: "600 13px var(--font-inter)", textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--o-text-3)", margin: "0 0 12px" }}>
        {title}
      </h3>
      {children}
    </div>
  );
}

function Field({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", padding: "10px 0", borderBottom: "1px solid var(--o-border)" }}>
      <span style={{ color: "var(--o-text-2)", fontSize: 14 }}>{label}</span>
      <span style={{ fontSize: mono ? 12 : 14, fontWeight: mono ? 400 : 500, fontFamily: mono ? "ui-monospace, monospace" : undefined, color: "var(--o-text-1)" }}>
        {value}
      </span>
    </div>
  );
}
