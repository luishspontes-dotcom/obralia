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

  const { data: orgsR } = await supabase.from("organizations").select("id, name, brand_color, plan, slug");
  const orgs = (orgsR ?? []) as Org[];
  const activeOrg = orgs.find((o) => o.id === profile?.default_org_id) ?? orgs[0] ?? null;

  const initials = (profile?.full_name ?? user.email ?? "??")
    .split(" ").map((s) => s[0]).slice(0, 2).join("").toUpperCase();

  return (
    <div>
      <div className="page-hero">
        <div style={{ maxWidth: 720, margin: "0 auto", display: "flex", alignItems: "center", gap: 18 }}>
          <div style={{
            width: 64, height: 64, borderRadius: 999,
            background: "linear-gradient(135deg, var(--t-brand), var(--t-brand-d))",
            display: "grid", placeItems: "center",
            color: "white", font: "700 24px var(--font-inter)",
            boxShadow: "var(--shadow-brand)",
            flexShrink: 0,
          }}>
            {initials}
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "0.12em", color: "var(--t-brand)", fontWeight: 600, marginBottom: 6 }}>
              Sua conta
            </div>
            <h1 style={{ margin: "0 0 4px", font: "700 28px var(--font-inter)", letterSpacing: "-0.02em" }}>
              {profile?.full_name ?? "Configurações"}
            </h1>
            <p style={{ margin: 0, fontSize: 14, color: "var(--o-text-2)" }}>
              {user.email}
              {activeOrg && (<> · <span style={{ color: "var(--t-brand)", fontWeight: 500 }}>{activeOrg.name}</span></>)}
            </p>
          </div>
        </div>
      </div>

      <div style={{ padding: "0 24px 32px", maxWidth: 720, margin: "0 auto" }}>
        <Section title="Sua conta">
          <Field label="E-mail" value={user.email ?? "—"} />
          <Field label="Nome" value={profile?.full_name ?? "—"} />
          <Field label="ID" value={user.id} mono last />
          {profile?.is_platform_admin && (
            <Field label="Papel" value="Super admin de plataforma" last />
          )}
        </Section>

        {activeOrg && (
          <Section title="Organização ativa">
            <Field label="Nome" value={activeOrg.name} />
            <Field label="Slug" value={activeOrg.slug} mono />
            <Field label="Plano" value={activeOrg.plan ?? "—"} />
            {activeOrg.brand_color && (
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 0" }}>
                <span style={{ color: "var(--o-text-2)", fontSize: 14 }}>Cor da marca</span>
                <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
                  <span style={{ width: 22, height: 22, borderRadius: 6, background: activeOrg.brand_color, border: "1px solid var(--o-border)", boxShadow: "var(--shadow-xs)" }} />
                  <span className="tnum" style={{ fontSize: 13, color: "var(--o-text-1)", fontWeight: 500 }}>{activeOrg.brand_color}</span>
                </span>
              </div>
            )}
          </Section>
        )}

        <Section title="Trocar senha">
          <ChangePasswordForm />
        </Section>

        <Section title="Sessão">
          <p style={{ margin: "0 0 14px", fontSize: 13, color: "var(--o-text-2)" }}>
            Encerrar a sessão remove o acesso deste dispositivo. Você pode entrar de novo a qualquer momento.
          </p>
          <form action="/auth/signout" method="post">
            <button type="submit" style={{
              padding: "10px 18px",
              background: "transparent",
              color: "var(--st-late)",
              border: "1px solid var(--st-late)",
              borderRadius: "var(--r)",
              fontSize: 13, fontWeight: 600,
              cursor: "pointer",
              transition: "all var(--duration) var(--ease)",
            }}>
              Encerrar sessão
            </button>
          </form>
        </Section>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="card" style={{ padding: 22, marginBottom: 14 }}>
      <h3 className="section-title" style={{ marginBottom: 16 }}>{title}</h3>
      {children}
    </div>
  );
}

function Field({ label, value, mono, last }: { label: string; value: string; mono?: boolean; last?: boolean }) {
  return (
    <div style={{
      display: "flex", justifyContent: "space-between", alignItems: "center",
      padding: "12px 0",
      borderBottom: last ? "none" : "1px solid var(--o-border)",
    }}>
      <span style={{ color: "var(--o-text-2)", fontSize: 14 }}>{label}</span>
      <span style={{
        fontSize: mono ? 12 : 14,
        fontWeight: mono ? 400 : 500,
        fontFamily: mono ? "ui-monospace, monospace" : undefined,
        color: "var(--o-text-1)",
        textAlign: "right",
        wordBreak: mono ? "break-all" : undefined,
        maxWidth: "60%",
      }}>
        {value}
      </span>
    </div>
  );
}
