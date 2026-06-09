import fs from "node:fs";
import { createClient } from "@supabase/supabase-js";

const PROVIDER_DIARIO = "diario_de_obra";
const PROVIDER_OBRALIA = "obralia";
const VISIBLE_PROVIDERS = [PROVIDER_DIARIO, PROVIDER_OBRALIA];
const PAGE_SIZE = 1000;

const env = { ...parseEnvFile(".env.local"), ...process.env };
const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY || env.SUPABASE_SECRET_KEY;

if (!supabaseUrl || !serviceKey) {
  throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or service role key.");
}

const supabase = createClient(supabaseUrl, serviceKey, {
  auth: { persistSession: false },
});

const org = await resolveOrganization();
const sites = await fetchAll("sites", "id,name,status,cover_url,external_provider,external_id,organization_id", (query) =>
  query.eq("organization_id", org.id)
);
const siteIds = new Set(sites.map((site) => site.id));
const visibleSiteIds = new Set(
  sites.filter((site) => VISIBLE_PROVIDERS.includes(site.external_provider)).map((site) => site.id)
);
const diarioSiteIds = new Set(sites.filter((site) => site.external_provider === PROVIDER_DIARIO).map((site) => site.id));

const [reports, wbsItems, media, activities, workforce, equipment, materials, invites, externalAccounts, syncRuns] =
  await Promise.all([
    fetchAll("daily_reports", "id,site_id,number,date,external_provider,external_id"),
    fetchAll("wbs_items", "id,site_id,parent_id,code,name,external_provider,external_id"),
    fetchAll("media", "id,site_id,daily_report_id,wbs_item_id,kind,storage_path,thumbnail_path,external_provider,external_id,external_url"),
    fetchAll("report_activities", "id,daily_report_id,wbs_item_id,description"),
    fetchAll("report_workforce", "id,daily_report_id,role,count"),
    fetchAll("report_equipment", "id,daily_report_id,name,hours"),
    fetchAll("report_materials", "id,daily_report_id,name,quantity,unit"),
    fetchAll("pending_invites", "id,email,full_name,role,organization_id,consumed_at", (query) => query.eq("organization_id", org.id)),
    fetchAll("external_accounts", "id,label,provider,status,last_success_at,last_sync_at,last_error,metadata,organization_id", (query) =>
      query.eq("organization_id", org.id)
    ),
    fetchAll("sync_runs", "id,provider,scope,status,started_at,finished_at,error,stats,organization_id", (query) =>
      query.eq("organization_id", org.id).order("created_at", { ascending: false }).limit(10)
    ),
  ]);

const reportIds = new Set(reports.map((report) => report.id));
const wbsIds = new Set(wbsItems.map((item) => item.id));
const officialReports = reports.filter((report) => visibleSiteIds.has(report.site_id) && VISIBLE_PROVIDERS.includes(report.external_provider));
const officialWbs = wbsItems.filter((item) => visibleSiteIds.has(item.site_id) && VISIBLE_PROVIDERS.includes(item.external_provider));
const officialMedia = media.filter((item) => visibleSiteIds.has(item.site_id) && VISIBLE_PROVIDERS.includes(item.external_provider));
const diarioReports = reports.filter((report) => diarioSiteIds.has(report.site_id) && report.external_provider === PROVIDER_DIARIO);
const diarioWbs = wbsItems.filter((item) => diarioSiteIds.has(item.site_id) && item.external_provider === PROVIDER_DIARIO);
const diarioMedia = media.filter((item) => diarioSiteIds.has(item.site_id) && item.external_provider === PROVIDER_DIARIO);
const diarioAccounts = externalAccounts.filter((account) => account.provider === PROVIDER_DIARIO);
const diarioAccount =
  diarioAccounts.find((account) => hasCadastroSnapshot(account.metadata)) ??
  diarioAccounts.find((account) => String(account.label ?? "").toLowerCase().includes("diario")) ??
  diarioAccounts[0];
const cadastroSnapshot = diarioAccount?.metadata && typeof diarioAccount.metadata === "object" ? diarioAccount.metadata : {};

const result = {
  audited_at: new Date().toISOString(),
  organization: { id: org.id, name: org.name, slug: org.slug },
  totals: {
    all_sites: sites.length,
    visible_sites: sites.filter((site) => visibleSiteIds.has(site.id)).length,
    diario_sites: diarioSiteIds.size,
    obralia_sites: sites.filter((site) => site.external_provider === PROVIDER_OBRALIA).length,
    all_reports: reports.length,
    visible_reports: officialReports.length,
    diario_reports: diarioReports.length,
    all_wbs_items: wbsItems.length,
    visible_wbs_items: officialWbs.length,
    diario_wbs_items: diarioWbs.length,
    all_media: media.length,
    visible_media: officialMedia.length,
    diario_media: diarioMedia.length,
    report_activities: activities.length,
    report_workforce: workforce.length,
    report_equipment: equipment.length,
    report_materials: materials.length,
    pending_invites: invites.length,
  },
  provider_counts: {
    sites: countBy(sites, "external_provider"),
    reports: countBy(reports, "external_provider"),
    wbs_items: countBy(wbsItems, "external_provider"),
    media: countBy(media, "external_provider"),
  },
  media_by_kind: {
    visible: countBy(officialMedia, "kind"),
    diario: countBy(diarioMedia, "kind"),
  },
  covers: {
    visible_sites_with_cover: sites.filter((site) => visibleSiteIds.has(site.id) && Boolean(site.cover_url)).length,
    visible_sites_without_cover: sites
      .filter((site) => visibleSiteIds.has(site.id) && !site.cover_url)
      .map((site) => site.name)
      .sort(),
    diario_sites_with_cover: sites.filter((site) => diarioSiteIds.has(site.id) && Boolean(site.cover_url)).length,
    diario_sites_without_cover: sites
      .filter((site) => diarioSiteIds.has(site.id) && !site.cover_url)
      .map((site) => site.name)
      .sort(),
  },
  integrity: {
    reports_without_known_site: reports.filter((report) => !siteIds.has(report.site_id)).length,
    wbs_without_known_site: wbsItems.filter((item) => !siteIds.has(item.site_id)).length,
    wbs_with_missing_parent: wbsItems.filter((item) => item.parent_id && !wbsIds.has(item.parent_id)).length,
    media_without_known_site: media.filter((item) => !siteIds.has(item.site_id)).length,
    media_with_missing_report: media.filter((item) => item.daily_report_id && !reportIds.has(item.daily_report_id)).length,
    media_with_missing_wbs: media.filter((item) => item.wbs_item_id && !wbsIds.has(item.wbs_item_id)).length,
    activities_with_missing_report: activities.filter((item) => !reportIds.has(item.daily_report_id)).length,
    activities_with_missing_wbs: activities.filter((item) => item.wbs_item_id && !wbsIds.has(item.wbs_item_id)).length,
    workforce_with_missing_report: workforce.filter((item) => !reportIds.has(item.daily_report_id)).length,
    equipment_with_missing_report: equipment.filter((item) => !reportIds.has(item.daily_report_id)).length,
    materials_with_missing_report: materials.filter((item) => !reportIds.has(item.daily_report_id)).length,
    media_without_storage_path: media.filter((item) => !item.storage_path).length,
  },
  duplicate_external_ids: {
    sites: duplicateExternalIds(sites),
    reports: duplicateExternalIds(reports),
    wbs_items: duplicateExternalIds(wbsItems),
    media: duplicateExternalIds(media),
  },
  suspicious_legacy_sites: sites
    .filter((site) => !VISIBLE_PROVIDERS.includes(site.external_provider))
    .map((site) => ({ name: site.name, provider: site.external_provider, external_id: site.external_id }))
    .sort((a, b) => a.name.localeCompare(b.name)),
  cadastro_snapshot: {
    account_status: diarioAccount?.status ?? null,
    account_label: diarioAccount?.label ?? null,
    account_last_success_at: diarioAccount?.last_success_at ?? null,
    imported_at: cadastroSnapshot.imported_at ?? null,
    counts: cadastroSnapshot.counts ?? null,
    usuarios: Array.isArray(cadastroSnapshot.cadastros?.usuarios)
      ? cadastroSnapshot.cadastros.usuarios.length
      : null,
    equipamentos: Array.isArray(cadastroSnapshot.cadastros?.equipamentos)
      ? cadastroSnapshot.cadastros.equipamentos.length
      : null,
    tipos_ocorrencias: Array.isArray(cadastroSnapshot.cadastros?.tipos_ocorrencias)
      ? cadastroSnapshot.cadastros.tipos_ocorrencias.length
      : null,
    mao_de_obra_personalizada: Array.isArray(cadastroSnapshot.cadastros?.mao_de_obra?.personalizada)
      ? cadastroSnapshot.cadastros.mao_de_obra.personalizada.length
      : null,
    mao_de_obra_padrao: Array.isArray(cadastroSnapshot.cadastros?.mao_de_obra?.padrao)
      ? cadastroSnapshot.cadastros.mao_de_obra.padrao.length
      : null,
  },
  external_account_summaries: externalAccounts.map((account) => ({
    provider: account.provider,
    label: account.label,
    status: account.status,
    last_success_at: account.last_success_at,
    metadata_keys: account.metadata && typeof account.metadata === "object" ? Object.keys(account.metadata).sort() : [],
    has_cadastros: hasCadastroSnapshot(account.metadata),
  })),
  latest_sync_runs: syncRuns.map((run) => ({
    provider: run.provider,
    scope: run.scope,
    status: run.status,
    started_at: run.started_at,
    finished_at: run.finished_at,
    error: run.error,
    stats: run.stats,
  })),
};

console.log(JSON.stringify(result, null, 2));

function parseEnvFile(file) {
  if (!fs.existsSync(file)) return {};
  const output = {};
  for (const line of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const index = trimmed.indexOf("=");
    if (index === -1) continue;
    const key = trimmed.slice(0, index).trim();
    let value = trimmed.slice(index + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    output[key] = value;
  }
  return output;
}

async function resolveOrganization() {
  const slug = env.OBRALIA_ORG_SLUG ?? "meu-viver";
  let { data, error } = await supabase.from("organizations").select("id,name,slug").eq("slug", slug).maybeSingle();
  if (error) throw error;
  if (data) return data;
  ({ data, error } = await supabase.from("organizations").select("id,name,slug").order("created_at").limit(1).maybeSingle());
  if (error) throw error;
  if (!data) throw new Error("No organization found.");
  return data;
}

async function fetchAll(table, select, decorate = (query) => query) {
  const rows = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    const to = from + PAGE_SIZE - 1;
    const query = decorate(supabase.from(table).select(select).range(from, to));
    const { data, error } = await query;
    if (error) throw new Error(`${table}: ${error.message}`);
    rows.push(...(data ?? []));
    if (!data || data.length < PAGE_SIZE) return rows;
  }
}

function countBy(rows, key) {
  return rows.reduce((acc, row) => {
    const value = row[key] ?? "null";
    acc[value] = (acc[value] ?? 0) + 1;
    return acc;
  }, {});
}

function duplicateExternalIds(rows) {
  const groups = new Map();
  for (const row of rows) {
    if (!row.external_id) continue;
    const key = `${row.external_provider ?? "null"}:${row.external_id}`;
    const group = groups.get(key) ?? [];
    group.push(row.id);
    groups.set(key, group);
  }
  return [...groups.entries()]
    .filter(([, ids]) => ids.length > 1)
    .slice(0, 20)
    .map(([key, ids]) => ({ key, count: ids.length }));
}

function hasCadastroSnapshot(metadata) {
  return Boolean(
    metadata &&
      typeof metadata === "object" &&
      metadata.cadastros &&
      typeof metadata.cadastros === "object"
  );
}
