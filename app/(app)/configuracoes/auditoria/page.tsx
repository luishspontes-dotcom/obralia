import Link from "next/link";
import { redirect } from "next/navigation";
import { CheckCircle2, CircleAlert, CircleMinus } from "lucide-react";
import { canAdmin } from "@/lib/authz";
import { createServerSupabase } from "@/lib/supabase/server";

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
  provider: string;
  status: string;
  last_sync_at: string | null;
  last_success_at: string | null;
  last_error: string | null;
  updated_at: string;
};

type SyncRun = {
  provider: string;
  scope: string;
  status: string;
  started_at: string | null;
  finished_at: string | null;
  created_at: string;
  stats: unknown;
  error: string | null;
};

type CountResult = {
  count: number | null;
  error: { message: string } | null;
};

const PROVIDERS = [null, "clickup", "diario_de_obra", "asana", "manual", "import"] as const;

const HISTORICAL_TARGETS = [
  { key: "sites", label: "Obras", target: 26 },
  { key: "wbs_items", label: "Itens WBS", target: 956 },
  { key: "daily_reports", label: "RDOs", target: 1129 },
  { key: "report_activities", label: "Atividades em RDO", target: 3583 },
  { key: "media", label: "Fotos/midias", target: 10968 },
] as const;

function countValue(result: CountResult) {
  return result.error ? 0 : result.count ?? 0;
}

function formatNumber(value: number) {
  return new Intl.NumberFormat("pt-BR").format(value);
}

function formatDate(value: string | null | undefined) {
  if (!value) return "Nunca";
  return new Date(value).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function providerLabel(provider: string) {
  const labels: Record<string, string> = {
    clickup: "ClickUp",
    diario_de_obra: "Diario",
    asana: "Asana",
    manual: "Manual",
    import: "Import",
    null: "Sem origem",
  };
  return labels[provider] ?? provider;
}

export default async function AuditoriaPage() {
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

  const { data: rdoRows } = await supabase
    .from("daily_reports")
    .select("id")
    .in("site_id", siteFilter)
    .limit(5000);
  const rdoIds = ((rdoRows ?? []) as Array<{ id: string }>).map((rdo) => rdo.id);
  const rdoFilter = rdoIds.length > 0 ? rdoIds : ["00000000-0000-0000-0000-000000000000"];

  const [
    sitesR,
    wbsR,
    phasesR,
    activitiesR,
    dailyReportsR,
    reportActivitiesR,
    workforceR,
    equipmentR,
    mediaR,
    commentsR,
    externalAccountsR,
    syncRunsR,
  ] = await Promise.all([
    supabase.from("sites").select("id", { count: "exact", head: true }).eq("organization_id", activeOrg.id),
    supabase.from("wbs_items").select("id", { count: "exact", head: true }).in("site_id", siteFilter),
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
      .from("report_activities")
      .select("id", { count: "exact", head: true })
      .in("daily_report_id", rdoFilter),
    supabase
      .from("report_workforce")
      .select("id", { count: "exact", head: true })
      .in("daily_report_id", rdoFilter),
    supabase
      .from("report_equipment")
      .select("id", { count: "exact", head: true })
      .in("daily_report_id", rdoFilter),
    supabase.from("media").select("id", { count: "exact", head: true }).in("site_id", siteFilter),
    supabase.from("comments").select("id", { count: "exact", head: true }).eq("organization_id", activeOrg.id),
    supabase
      .from("external_accounts")
      .select("provider, status, last_sync_at, last_success_at, last_error, updated_at")
      .eq("organization_id", activeOrg.id)
      .order("provider", { ascending: true }),
    supabase
      .from("sync_runs")
      .select("provider, scope, status, started_at, finished_at, created_at, stats, error")
      .eq("organization_id", activeOrg.id)
      .order("created_at", { ascending: false })
      .limit(12),
  ]);

  const totals = {
    sites: countValue(sitesR),
    wbs_items: countValue(wbsR),
    wbs_phases: countValue(phasesR),
    wbs_activities: countValue(activitiesR),
    daily_reports: countValue(dailyReportsR),
    report_activities: countValue(reportActivitiesR),
    report_workforce: countValue(workforceR),
    report_equipment: countValue(equipmentR),
    media: countValue(mediaR),
    comments: countValue(commentsR),
  };

  const providerCounts: Record<string, Record<string, number>> = {
    sites: {},
    wbs_items: {},
    daily_reports: {},
    media: {},
  };

  for (const provider of PROVIDERS) {
    const label = provider ?? "null";
    const siteProviderQuery = supabase
      .from("sites")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", activeOrg.id);
    providerCounts.sites[label] = countValue(
      await (provider === null
        ? siteProviderQuery.is("external_provider", null)
        : siteProviderQuery.eq("external_provider", provider))
    );

    const wbsProviderQuery = supabase
      .from("wbs_items")
      .select("id", { count: "exact", head: true })
      .in("site_id", siteFilter);
    providerCounts.wbs_items[label] = countValue(
      await (provider === null
        ? wbsProviderQuery.is("external_provider", null)
        : wbsProviderQuery.eq("external_provider", provider))
    );

    const rdoProviderQuery = supabase
      .from("daily_reports")
      .select("id", { count: "exact", head: true })
      .in("site_id", siteFilter);
    providerCounts.daily_reports[label] = countValue(
      await (provider === null
        ? rdoProviderQuery.is("external_provider", null)
        : rdoProviderQuery.eq("external_provider", provider))
    );

    const mediaProviderQuery = supabase
      .from("media")
      .select("id", { count: "exact", head: true })
      .in("site_id", siteFilter);
    providerCounts.media[label] = countValue(
      await (provider === null
        ? mediaProviderQuery.is("external_provider", null)
        : mediaProviderQuery.eq("external_provider", provider))
    );
  }

  const externalAccounts = (externalAccountsR.data ?? []) as ExternalAccount[];
  const syncRuns = (syncRunsR.data ?? []) as SyncRun[];
  const credentialStatus = {
    clickup: Boolean(process.env.CLICKUP_API_TOKEN),
    diario_de_obra: Boolean(
      process.env.DIARIO_API_TOKEN ||
        process.env.DIARIO_AUTH_TOKEN ||
        (process.env.DIARIO_EMAIL && process.env.DIARIO_PASSWORD)
    ),
    asana: Boolean(process.env.ASANA_ACCESS_TOKEN),
  };

  const targetRows = HISTORICAL_TARGETS.map((target) => ({
    ...target,
    current: totals[target.key],
    ok: totals[target.key] >= target.target,
  }));
  const allTargetsMet = targetRows.every((row) => row.ok);
  const hasExternalEvidence =
    providerCounts.wbs_items.clickup > 0 ||
    providerCounts.daily_reports.diario_de_obra > 0 ||
    providerCounts.media.diario_de_obra > 0 ||
    providerCounts.daily_reports.import > 0 ||
    providerCounts.media.import > 0;
  const hasSourceCredentials = credentialStatus.clickup && credentialStatus.diario_de_obra;
  const hasSuccessfulSync = syncRuns.some((run) => run.status === "success");
  const hasAuditedImport = syncRuns.some(
    (run) => run.status === "success" && ["audit", "import"].includes(run.scope)
  );
  const hasExternalAccounts = externalAccounts.length > 0;

  const checks = [
    { label: "Totais batem com a meta historica", ok: allTargetsMet },
    { label: "Registros possuem origem externa rastreavel", ok: hasExternalEvidence },
    { label: "Contas externas cadastradas", ok: hasExternalAccounts },
    { label: "Credenciais ou importacao auditada", ok: hasSourceCredentials || hasAuditedImport },
    { label: "Historico de sincronizacao/auditoria com sucesso", ok: hasSuccessfulSync },
  ];
  const score = Math.round((checks.filter((check) => check.ok).length / checks.length) * 10);

  return (
    <div style={{ padding: "24px", maxWidth: 1120, margin: "0 auto" }}>
      <div style={{ marginBottom: 18 }}>
        <Link href="/configuracoes" style={{ color: "var(--o-text-2)", textDecoration: "none", fontSize: 14 }}>
          Configuracoes
        </Link>
        <span style={{ color: "var(--o-text-3)", margin: "0 8px" }}>/</span>
        <span style={{ color: "var(--o-text-1)", fontSize: 14 }}>Auditoria</span>
      </div>

      <div style={{ display: "flex", justifyContent: "space-between", gap: 20, alignItems: "flex-start", marginBottom: 20 }}>
        <div>
          <h1 style={{ margin: "0 0 4px", font: "700 28px var(--font-inter)", letterSpacing: "-0.02em" }}>
            Auditoria operacional
          </h1>
          <p style={{ margin: 0, color: "var(--o-text-2)", fontSize: 14 }}>
            Evidencia de dados, origem externa e sincronizacao da organizacao {activeOrg.name}.
          </p>
        </div>
        <div style={{ textAlign: "right" }}>
          <div className="tnum" style={{ font: "700 34px var(--font-inter)", color: score === 10 ? "var(--st-done)" : "var(--t-brand)" }}>
            {score}/10
          </div>
          <div style={{ fontSize: 12, color: "var(--o-text-2)" }}>prontidao auditavel</div>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 10, marginBottom: 16 }}>
        <Metric label="Obras" value={totals.sites} />
        <Metric label="Itens WBS" value={totals.wbs_items} hint={`${formatNumber(totals.wbs_phases)} fases · ${formatNumber(totals.wbs_activities)} atividades`} />
        <Metric label="RDOs" value={totals.daily_reports} />
        <Metric label="Atividades em RDO" value={totals.report_activities} />
        <Metric label="Midias" value={totals.media} />
      </div>

      <Section title="Checklist 10/10">
        <div style={{ display: "grid", gap: 10 }}>
          {checks.map((check) => (
            <CheckRow key={check.label} label={check.label} ok={check.ok} />
          ))}
        </div>
      </Section>

      <Section title="Meta historica Meu Viver">
        <div style={{ display: "grid", gap: 8 }}>
          {targetRows.map((row) => (
            <div key={row.key} style={{ display: "grid", gridTemplateColumns: "1fr auto auto", gap: 12, alignItems: "center", padding: "10px 0", borderBottom: "1px solid var(--o-border)" }}>
              <span style={{ fontSize: 14, color: "var(--o-text-1)", fontWeight: 500 }}>{row.label}</span>
              <span className="tnum" style={{ color: row.ok ? "var(--st-done)" : "var(--st-late)", fontWeight: 700 }}>
                {formatNumber(row.current)}
              </span>
              <span style={{ color: "var(--o-text-3)", fontSize: 12 }}>
                alvo {formatNumber(row.target)}
              </span>
            </div>
          ))}
        </div>
      </Section>

      <Section title="Origem dos registros">
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ color: "var(--o-text-2)", textAlign: "left" }}>
                <th style={thStyle}>Tabela</th>
                {PROVIDERS.map((provider) => (
                  <th key={provider ?? "null"} style={thStyle}>{providerLabel(provider ?? "null")}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {Object.entries(providerCounts).map(([table, counts]) => (
                <tr key={table} style={{ borderTop: "1px solid var(--o-border)" }}>
                  <td style={tdStyle}>{table}</td>
                  {PROVIDERS.map((provider) => (
                    <td key={provider ?? "null"} className="tnum" style={tdStyle}>
                      {formatNumber(counts[provider ?? "null"] ?? 0)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>

      <Section title="Conectores">
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 10 }}>
          <ConnectorCard label="ClickUp" configured={credentialStatus.clickup} account={externalAccounts.find((item) => item.provider === "clickup")} />
          <ConnectorCard label="Diario" configured={credentialStatus.diario_de_obra} account={externalAccounts.find((item) => item.provider === "diario_de_obra")} />
          <ConnectorCard label="Asana" configured={credentialStatus.asana} account={externalAccounts.find((item) => item.provider === "asana")} optional />
        </div>
      </Section>

      <Section title="Ultimas sincronizacoes">
        {syncRuns.length === 0 ? (
          <div style={{ color: "var(--o-text-2)", fontSize: 14 }}>Nenhuma execucao registrada.</div>
        ) : (
          <div style={{ display: "grid", gap: 8 }}>
            {syncRuns.map((run) => (
              <div key={`${run.provider}-${run.scope}-${run.created_at}`} style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 12, border: "1px solid var(--o-border)", borderRadius: 8, padding: 12 }}>
                <div>
                  <div style={{ fontWeight: 700, color: "var(--o-text-1)", fontSize: 14 }}>
                    {providerLabel(run.provider)} · {run.scope}
                  </div>
                  <div style={{ color: "var(--o-text-2)", fontSize: 12, marginTop: 2 }}>
                    {formatDate(run.created_at)}
                  </div>
                </div>
                <StatusPill status={run.status} />
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
    <div className="card" style={{ padding: 18, marginBottom: 14 }}>
      <h2 className="section-title" style={{ marginBottom: 14 }}>{title}</h2>
      {children}
    </div>
  );
}

function Metric({ label, value, hint }: { label: string; value: number; hint?: string }) {
  return (
    <div className="card" style={{ padding: 14 }}>
      <div className="tnum" style={{ font: "700 24px var(--font-inter)", color: "var(--o-text-1)" }}>
        {formatNumber(value)}
      </div>
      <div style={{ color: "var(--o-text-2)", fontSize: 12 }}>{label}</div>
      {hint && <div style={{ color: "var(--o-text-3)", fontSize: 11, marginTop: 4 }}>{hint}</div>}
    </div>
  );
}

function CheckRow({ label, ok }: { label: string; ok: boolean }) {
  const Icon = ok ? CheckCircle2 : CircleAlert;
  return (
    <div style={{ display: "flex", gap: 10, alignItems: "center", padding: "10px 12px", border: "1px solid var(--o-border)", borderRadius: 8 }}>
      <Icon size={18} color={ok ? "var(--st-done)" : "var(--st-late)"} />
      <span style={{ fontSize: 14, color: "var(--o-text-1)", fontWeight: 500 }}>{label}</span>
    </div>
  );
}

function ConnectorCard({
  label,
  configured,
  account,
  optional,
}: {
  label: string;
  configured: boolean;
  account?: ExternalAccount;
  optional?: boolean;
}) {
  return (
    <div style={{ border: "1px solid var(--o-border)", borderRadius: 8, padding: 14 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
        <strong style={{ fontSize: 14 }}>{label}</strong>
        <StatusPill status={account?.status ?? (optional ? "optional" : "not_configured")} />
      </div>
      <div style={{ marginTop: 10, display: "grid", gap: 6, fontSize: 12, color: "var(--o-text-2)" }}>
        <span>Credencial: {configured ? "configurada" : optional ? "opcional" : "ausente"}</span>
        <span>Ultimo sync: {formatDate(account?.last_sync_at)}</span>
        <span>Ultimo sucesso: {formatDate(account?.last_success_at)}</span>
      </div>
    </div>
  );
}

function StatusPill({ status }: { status: string }) {
  const meta: Record<string, { label: string; color: string; bg: string }> = {
    connected: { label: "Conectado", color: "var(--st-done)", bg: "rgba(34, 139, 34, 0.08)" },
    success: { label: "Sucesso", color: "var(--st-done)", bg: "rgba(34, 139, 34, 0.08)" },
    syncing: { label: "Sincronizando", color: "var(--st-progress)", bg: "rgba(8, 120, 155, 0.08)" },
    running: { label: "Rodando", color: "var(--st-progress)", bg: "rgba(8, 120, 155, 0.08)" },
    partial: { label: "Parcial", color: "var(--o-accent)", bg: "rgba(217, 119, 87, 0.1)" },
    error: { label: "Erro", color: "var(--st-late)", bg: "rgba(220, 38, 38, 0.08)" },
    failed: { label: "Falhou", color: "var(--st-late)", bg: "rgba(220, 38, 38, 0.08)" },
    not_configured: { label: "Nao configurado", color: "var(--o-text-2)", bg: "rgba(0,0,0,0.04)" },
    optional: { label: "Opcional", color: "var(--o-text-2)", bg: "rgba(0,0,0,0.04)" },
  };
  const item = meta[status] ?? { label: status, color: "var(--o-text-2)", bg: "rgba(0,0,0,0.04)" };
  const Icon = status === "not_configured" || status === "optional" ? CircleMinus : status === "error" || status === "failed" ? CircleAlert : CheckCircle2;
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 6, color: item.color, background: item.bg, borderRadius: 999, padding: "5px 9px", fontSize: 12, fontWeight: 700 }}>
      <Icon size={13} />
      {item.label}
    </span>
  );
}

const thStyle: React.CSSProperties = {
  padding: "10px 8px",
  fontWeight: 700,
  borderBottom: "1px solid var(--o-border)",
};

const tdStyle: React.CSSProperties = {
  padding: "10px 8px",
  color: "var(--o-text-1)",
};
