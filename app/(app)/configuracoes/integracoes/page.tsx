import Link from "next/link";
import { redirect } from "next/navigation";
import { CheckCircle2, CircleAlert, Clock3, KeyRound, RotateCcw } from "lucide-react";
import { createServerSupabase } from "@/lib/supabase/server";
import { canAdmin } from "@/lib/authz";

type Profile = {
  id: string;
  default_org_id: string | null;
};

type Org = {
  id: string;
  name: string;
};

type Membership = {
  role: string;
};

type ExternalAccount = {
  id: string;
  provider: string;
  label: string;
  external_account_id: string | null;
  status: string;
  last_sync_at: string | null;
  last_success_at: string | null;
  last_error: string | null;
  updated_at: string;
};

type SyncRun = {
  id: string;
  provider: string;
  scope: string;
  status: string;
  started_at: string | null;
  finished_at: string | null;
  created_at: string;
  error: string | null;
  stats: unknown;
};

type ProviderKey = "clickup" | "diario_de_obra";

const PROVIDERS: Array<{
  key: ProviderKey;
  label: string;
  purpose: string;
  expected: string;
}> = [
  {
    key: "clickup",
    label: "ClickUp",
    purpose: "Cronogramas, listas, fases e atividades granulares",
    expected: "CLICKUP_API_TOKEN",
  },
  {
    key: "diario_de_obra",
    label: "Diario de Obras",
    purpose: "Obras, RDOs, atividades do dia, fotos e anexos",
    expected: "DIARIO_API_TOKEN ou DIARIO_EMAIL + DIARIO_PASSWORD",
  },
];

const STATUS_META: Record<string, { label: string; color: string; bg: string }> = {
  connected: { label: "Conectado", color: "var(--st-done)", bg: "rgba(34, 139, 34, 0.08)" },
  syncing: { label: "Sincronizando", color: "var(--st-progress)", bg: "rgba(8, 120, 155, 0.08)" },
  needs_auth: { label: "Precisa autenticar", color: "var(--st-late)", bg: "rgba(220, 38, 38, 0.08)" },
  error: { label: "Erro", color: "var(--st-late)", bg: "rgba(220, 38, 38, 0.08)" },
  disabled: { label: "Desativado", color: "var(--o-text-3)", bg: "rgba(0,0,0,0.04)" },
  not_configured: { label: "Nao configurado", color: "var(--o-text-2)", bg: "rgba(0,0,0,0.04)" },
  queued: { label: "Na fila", color: "var(--o-text-2)", bg: "rgba(0,0,0,0.04)" },
  running: { label: "Rodando", color: "var(--st-progress)", bg: "rgba(8, 120, 155, 0.08)" },
  success: { label: "Sucesso", color: "var(--st-done)", bg: "rgba(34, 139, 34, 0.08)" },
  partial: { label: "Parcial", color: "var(--o-accent)", bg: "rgba(217, 119, 87, 0.1)" },
  failed: { label: "Falhou", color: "var(--st-late)", bg: "rgba(220, 38, 38, 0.08)" },
  cancelled: { label: "Cancelado", color: "var(--o-text-3)", bg: "rgba(0,0,0,0.04)" },
};

export default async function IntegracoesPage() {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profileR } = await supabase
    .from("profiles")
    .select("id, default_org_id")
    .eq("id", user.id)
    .maybeSingle();
  const profile = profileR as Profile | null;

  const { data: orgsR } = await supabase.from("organizations").select("id, name");
  const orgs = (orgsR ?? []) as Org[];
  const activeOrg = orgs.find((org) => org.id === profile?.default_org_id) ?? orgs[0] ?? null;
  if (!activeOrg) redirect("/configuracoes");

  const { data: membershipRaw } = await supabase
    .from("organization_members")
    .select("role")
    .eq("organization_id", activeOrg.id)
    .eq("profile_id", user.id)
    .maybeSingle();
  if (!canAdmin((membershipRaw as Membership | null)?.role)) {
    redirect("/configuracoes");
  }

  const { data: siteRows } = await supabase
    .from("sites")
    .select("id")
    .eq("organization_id", activeOrg.id)
    .limit(5000);
  const siteIds = ((siteRows ?? []) as Array<{ id: string }>).map((site) => site.id);
  const siteFilter = siteIds.length > 0 ? siteIds : ["00000000-0000-0000-0000-000000000000"];

  const [
    externalAccountsR,
    syncRunsR,
    wbsPhasesR,
    wbsActivitiesR,
    dailyReportsR,
    mediaR,
  ] = await Promise.all([
    supabase
      .from("external_accounts")
      .select("id, provider, label, external_account_id, status, last_sync_at, last_success_at, last_error, updated_at")
      .eq("organization_id", activeOrg.id)
      .order("provider", { ascending: true }),
    supabase
      .from("sync_runs")
      .select("id, provider, scope, status, started_at, finished_at, created_at, error, stats")
      .eq("organization_id", activeOrg.id)
      .order("created_at", { ascending: false })
      .limit(8),
    supabase
      .from("wbs_items")
      .select("id", { count: "exact", head: true })
      .in("site_id", siteFilter)
      .is("parent_id", null),
    supabase
      .from("wbs_items")
      .select("id", { count: "exact", head: true })
      .in("site_id", siteFilter)
      .not("parent_id", "is", null),
    supabase
      .from("daily_reports")
      .select("id", { count: "exact", head: true })
      .in("site_id", siteFilter),
    supabase
      .from("media")
      .select("id", { count: "exact", head: true })
      .in("site_id", siteFilter),
  ]);

  const externalAccounts = (externalAccountsR.data ?? []) as ExternalAccount[];
  const syncRuns = (syncRunsR.data ?? []) as SyncRun[];
  const credentialStatus: Record<ProviderKey, boolean> = {
    clickup: Boolean(process.env.CLICKUP_API_TOKEN),
    diario_de_obra: Boolean(
      process.env.DIARIO_API_TOKEN ||
        process.env.DIARIO_AUTH_TOKEN ||
        (process.env.DIARIO_EMAIL && process.env.DIARIO_PASSWORD)
    ),
  };

  const counts = [
    { label: "Obras", value: siteIds.length },
    { label: "Fases", value: wbsPhasesR.count ?? 0 },
    { label: "Atividades", value: wbsActivitiesR.count ?? 0 },
    { label: "RDOs", value: dailyReportsR.count ?? 0 },
    { label: "Midias", value: mediaR.count ?? 0 },
  ];

  return (
    <div style={{ padding: "24px", maxWidth: 1040, margin: "0 auto" }}>
      <div style={{ marginBottom: 18 }}>
        <Link href="/configuracoes" style={{ color: "var(--o-text-2)", textDecoration: "none", fontSize: 14 }}>
          Configuracoes
        </Link>
        <span style={{ color: "var(--o-text-3)", margin: "0 8px" }}>/</span>
        <span style={{ color: "var(--o-text-1)", fontSize: 14 }}>Integracoes</span>
      </div>

      <div style={{ display: "flex", justifyContent: "space-between", gap: 20, alignItems: "flex-start", marginBottom: 24 }}>
        <div>
          <h1 style={{ margin: "0 0 4px", font: "700 28px var(--font-inter)", letterSpacing: "-0.02em" }}>
            Integracoes e sincronizacao
          </h1>
          <p style={{ margin: 0, color: "var(--o-text-2)", fontSize: 14 }}>
            Controle das fontes externas da organizacao {activeOrg.name}.
          </p>
        </div>
        <StatusPill status={externalAccounts.length > 0 ? "connected" : "not_configured"} />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 10, marginBottom: 16 }}>
        {counts.map((item) => (
          <div key={item.label} style={{ background: "var(--o-paper)", border: "1px solid var(--o-border)", borderRadius: 10, padding: 14 }}>
            <div className="tnum" style={{ font: "700 22px var(--font-inter)", color: "var(--o-text-1)" }}>{item.value}</div>
            <div style={{ color: "var(--o-text-2)", fontSize: 12 }}>{item.label}</div>
          </div>
        ))}
      </div>

      <Section title="Contas externas">
        <div style={{ display: "grid", gap: 12 }}>
          {PROVIDERS.map((provider) => {
            const account = externalAccounts.find((item) => item.provider === provider.key);
            const lastRun = syncRuns.find((run) => run.provider === provider.key);
            return (
              <div key={provider.key} style={{ border: "1px solid var(--o-border)", borderRadius: 10, padding: 16 }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 16, alignItems: "flex-start" }}>
                  <div>
                    <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                      <h2 style={{ margin: 0, font: "700 18px var(--font-inter)", letterSpacing: "-0.01em" }}>
                        {provider.label}
                      </h2>
                      <StatusPill status={account?.status ?? "not_configured"} />
                    </div>
                    <p style={{ margin: "6px 0 0", color: "var(--o-text-2)", fontSize: 13 }}>{provider.purpose}</p>
                  </div>
                  <CredentialPill configured={credentialStatus[provider.key]} />
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 10, marginTop: 14 }}>
                  <KV label="Conta" value={account?.label ?? "Nenhuma conta cadastrada"} />
                  <KV label="ID externo" value={account?.external_account_id ?? "Sem ID"} mono />
                  <KV label="Variavel esperada" value={provider.expected} mono />
                  <KV label="Ultimo sync" value={formatDate(account?.last_sync_at)} />
                  <KV label="Ultimo sucesso" value={formatDate(account?.last_success_at)} />
                  <KV label="Ultima execucao" value={lastRun ? `${statusLabel(lastRun.status)} · ${formatDate(lastRun.created_at)}` : "Sem execucoes"} />
                </div>

                {(account?.last_error || lastRun?.error) && (
                  <div style={{ marginTop: 12, color: "var(--st-late)", fontSize: 13 }}>
                    {account?.last_error ?? lastRun?.error}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </Section>

      <Section title="Historico de sincronizacao">
        {syncRuns.length === 0 ? (
          <EmptyState />
        ) : (
          <div style={{ display: "grid", gap: 10 }}>
            {syncRuns.map((run) => (
              <div key={run.id} style={{ borderBottom: "1px solid var(--o-border)", paddingBottom: 10 }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
                  <div style={{ font: "600 14px var(--font-inter)" }}>
                    {providerLabel(run.provider)} · {run.scope}
                  </div>
                  <StatusPill status={run.status} />
                </div>
                <div style={{ color: "var(--o-text-3)", fontSize: 12, marginTop: 3 }}>
                  Criado em {formatDate(run.created_at)}
                  {run.finished_at ? ` · finalizado em ${formatDate(run.finished_at)}` : ""}
                </div>
              </div>
            ))}
          </div>
        )}
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

function KV({ label, value, mono }: { label: string; value: string | number; mono?: boolean }) {
  return (
    <div style={{ minWidth: 0 }}>
      <div style={{ color: "var(--o-text-3)", fontSize: 11, marginBottom: 4 }}>{label}</div>
      <div
        className={mono ? "tnum" : undefined}
        style={{
          color: "var(--o-text-1)",
          fontSize: mono ? 12 : 13,
          fontFamily: mono ? "ui-monospace, monospace" : undefined,
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
        }}
        title={String(value)}
      >
        {value}
      </div>
    </div>
  );
}

function CredentialPill({ configured }: { configured: boolean }) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        padding: "5px 9px",
        borderRadius: 999,
        background: configured ? "rgba(34, 139, 34, 0.08)" : "rgba(220, 38, 38, 0.08)",
        color: configured ? "var(--st-done)" : "var(--st-late)",
        font: "600 12px var(--font-inter)",
        whiteSpace: "nowrap",
      }}
    >
      <KeyRound size={13} />
      {configured ? "Credencial no Vercel" : "Sem credencial"}
    </span>
  );
}

function StatusPill({ status }: { status: string }) {
  const meta = STATUS_META[status] ?? STATUS_META.not_configured;
  const Icon = status === "connected" || status === "success" ? CheckCircle2 : status === "syncing" || status === "running" ? RotateCcw : status === "queued" ? Clock3 : CircleAlert;
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 5,
        padding: "4px 8px",
        borderRadius: 999,
        background: meta.bg,
        color: meta.color,
        font: "600 11px var(--font-inter)",
        whiteSpace: "nowrap",
      }}
    >
      <Icon size={12} />
      {statusLabel(status)}
    </span>
  );
}

function EmptyState() {
  return (
    <div style={{ color: "var(--o-text-2)", fontSize: 14 }}>
      Nenhuma execucao registrada. A proxima etapa e conectar as credenciais e rodar um backfill controlado.
    </div>
  );
}

function formatDate(value?: string | null) {
  if (!value) return "Nunca";
  return new Date(value).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function providerLabel(provider: string) {
  return PROVIDERS.find((item) => item.key === provider)?.label ?? provider;
}

function statusLabel(status: string) {
  return STATUS_META[status]?.label ?? status;
}
