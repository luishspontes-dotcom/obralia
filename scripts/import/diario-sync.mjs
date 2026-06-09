#!/usr/bin/env node

import crypto from "node:crypto";
import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";

const PROVIDER = "diario_de_obra";
const DIARIO_API_BASE = "https://api.diariodeobra.app/v2";
const DIARIO_APP_ISS = "app-web";
const DEFAULT_EXPORT_DIR = "/private/tmp/obralia-diario-export";

const command = process.argv.slice(2).find((arg) => !arg.startsWith("--")) ?? "sync";
const flags = parseFlags(process.argv.slice(2));

main().catch((error) => {
  console.error(`diario-sync failed: ${redact(error?.message ?? String(error))}`);
  process.exitCode = 1;
});

async function main() {
  if (["help", "--help", "-h"].includes(command)) {
    printHelp();
    return;
  }

  const exportDir = path.resolve(String(flags.exportDir ?? process.env.DIARIO_EXPORT_DIR ?? DEFAULT_EXPORT_DIR));
  if (command === "summary") {
    await printExportSummary(exportDir);
    return;
  }

  if (command === "auth-check") {
    const auth = readDiarioAuth();
    console.log(JSON.stringify({
      ok: Boolean(auth.token && auth.empresaId),
      has_token: Boolean(auth.token),
      has_empresa_id: Boolean(auth.empresaId),
      empresa_id: auth.empresaId ? String(auth.empresaId) : null,
    }, null, 2));
    return;
  }

  if (!["export", "import", "sync"].includes(command)) {
    throw new Error(`Unknown command "${command}". Use help.`);
  }

  let exportStats = null;
  if (command === "export" || command === "sync") {
    const auth = readDiarioAuth();
    exportStats = await exportDiario(auth, exportDir);
  }

  let importStats = null;
  if (command === "import" || command === "sync") {
    importStats = await importToObralia(exportDir);
  }

  console.log(JSON.stringify({ exportDir, exportStats, importStats }, null, 2));
}

function printHelp() {
  console.log(`Usage:
  node scripts/import/diario-sync.mjs auth-check
  node scripts/import/diario-sync.mjs export [--exportDir=/private/tmp/obralia-diario-export]
  node scripts/import/diario-sync.mjs import [--exportDir=/private/tmp/obralia-diario-export] [--dry-run]
  node scripts/import/diario-sync.mjs sync [--exportDir=/private/tmp/obralia-diario-export]
  node scripts/import/diario-sync.mjs summary [--exportDir=/private/tmp/obralia-diario-export]

Required for export/sync:
  DIARIO_TOKEN and DIARIO_EMPRESA_ID, or DIARIO_AUTH_FILE pointing to a JSON file.

Media import:
  DIARIO_UPLOAD_MEDIA=1 uploads Diario files to Supabase Storage (default: 1).
  DIARIO_UPLOAD_MAX_BYTES limits each remote file (default: 209715200).
`);
}

function parseFlags(args) {
  const parsed = {};
  for (const arg of args) {
    if (!arg.startsWith("--")) continue;
    const body = arg.slice(2);
    const idx = body.indexOf("=");
    if (idx === -1) parsed[body] = true;
    else parsed[body.slice(0, idx)] = body.slice(idx + 1);
  }
  return parsed;
}

function addQueryParam(query, key, value) {
  const prefix = query && query.startsWith("?") ? query : `?${query ?? ""}`;
  const separator = prefix.includes("=") ? "&" : "";
  return `${prefix}${separator}${encodeURIComponent(key)}=${encodeURIComponent(value)}`;
}

function parseEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return {};
  const env = {};
  for (const rawLine of fs.readFileSync(filePath, "utf8").split(/\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const idx = line.indexOf("=");
    if (idx < 0) continue;
    const key = line.slice(0, idx).trim();
    let value = line.slice(idx + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    env[key] = value;
  }
  return env;
}

async function retryingFetch(input, init) {
  const maxAttempts = optionalInt(process.env.SUPABASE_FETCH_RETRIES) ?? 5;
  let lastError = null;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      const response = await fetch(input, init);
      if (!shouldRetryResponse(response) || attempt === maxAttempts) return response;
      await sleep(retryDelayMs(attempt, response));
    } catch (error) {
      lastError = error;
      if (attempt === maxAttempts || !isTransientFetchError(error)) throw error;
      await sleep(retryDelayMs(attempt));
    }
  }

  throw lastError ?? new Error("fetch failed");
}

function shouldRetryResponse(response) {
  return response.status === 429 || response.status === 502 || response.status === 503 || response.status === 504;
}

function isTransientFetchError(error) {
  const message = String(error?.message ?? error);
  return /fetch failed|network|timeout|ECONNRESET|ETIMEDOUT|EAI_AGAIN|ENOTFOUND/i.test(message);
}

function retryDelayMs(attempt, response = null) {
  const retryAfter = response?.headers?.get?.("retry-after");
  const retryAfterMs = retryAfter && /^\d+$/.test(retryAfter) ? Number(retryAfter) * 1000 : null;
  if (retryAfterMs) return Math.min(retryAfterMs, 15_000);
  return Math.min(750 * 2 ** (attempt - 1), 8_000);
}

function readDiarioAuth() {
  const file = process.env.DIARIO_AUTH_FILE ?? "/private/tmp/diario-auth.json";
  let fromFile = {};

  if (fs.existsSync(file)) {
    const raw = JSON.parse(fs.readFileSync(file, "utf8"));
    fromFile = normalizeAuthPayload(raw);
  }

  const token = process.env.DIARIO_TOKEN ?? fromFile.token ?? fromFile.RDOToken ?? fromFile.tokenValue;
  const empresaId = process.env.DIARIO_EMPRESA_ID ?? fromFile.empresaId ?? fromFile.RDOEmpresaId;
  const usuarioId = process.env.DIARIO_USUARIO_ID ?? fromFile.usuarioId ?? fromFile.RDOUsuarioId;

  if (!token || !empresaId) {
    throw new Error(
      "Missing Diario auth. Provide DIARIO_TOKEN and DIARIO_EMPRESA_ID, or create /private/tmp/diario-auth.json.",
    );
  }

  return { token: String(token), empresaId: String(empresaId), usuarioId: usuarioId ? String(usuarioId) : null };
}

function normalizeAuthPayload(payload) {
  if (Array.isArray(payload)) {
    const auth = {};
    for (const row of payload) {
      const key = row?.key ?? row?.name;
      if (!key) continue;
      auth[key] = row?.value;
    }
    return normalizeAuthPayload(auth);
  }

  if (!payload || typeof payload !== "object") return {};
  const flat = { ...payload };

  for (const key of ["RDOEmpresa", "RDOUsuario"]) {
    if (typeof flat[key] === "string") {
      try {
        flat[key] = JSON.parse(flat[key]);
      } catch {
        // Keep the original value.
      }
    }
  }

  return {
    ...flat,
    token: flat.RDOToken ?? flat.token,
    empresaId: flat.RDOEmpresaId ?? flat.empresaId ?? flat.RDOEmpresa?.id,
    usuarioId: flat.RDOUsuarioId ?? flat.usuarioId ?? flat.RDOUsuario?.id,
  };
}

async function exportDiario(auth, exportDir) {
  await fsp.mkdir(exportDir, { recursive: true });
  await fsp.mkdir(path.join(exportDir, "obras"), { recursive: true });

  const stats = {
    started_at: new Date().toISOString(),
    obras: 0,
    reports: 0,
    report_details: 0,
    errors: [],
  };

  const empresaUsuario = await safeDiarioGet(auth, "/informacoes-empresa-usuario", stats, "empresa_usuario");
  await writeJson(path.join(exportDir, "empresa-usuario.json"), empresaUsuario);
  await exportGlobalCadastros(auth, exportDir, stats);

  const obrasPayload = await diarioGet(auth, "/obras?sort=asc");
  await writeJson(path.join(exportDir, "obras.json"), obrasPayload);

  const obras = uniqueBy(extractArray(obrasPayload), (obra) => stableExternalId(obra));
  stats.obras = obras.length;

  const limit = optionalInt(flags.limitSites ?? process.env.DIARIO_LIMIT_SITES);
  const selectedObras = limit ? obras.slice(0, limit) : obras;

  for (const [index, obra] of selectedObras.entries()) {
    const obraId = stableExternalId(obra);
    if (!obraId) continue;
    const label = pickString(obra, ["nome", "name", "descricao"]) ?? `obra ${obraId}`;
    console.log(`[export] ${index + 1}/${selectedObras.length} obra ${obraId}: ${label}`);

    const obraDir = path.join(exportDir, "obras", sanitizePathPart(obraId));
    await fsp.mkdir(obraDir, { recursive: true });
    await fsp.mkdir(path.join(obraDir, "relatorios"), { recursive: true });
    await fsp.mkdir(path.join(obraDir, "etapas"), { recursive: true });

    const detail = await safeDiarioGet(auth, `/obras/${encodeURIComponent(obraId)}`, stats, `obra:${obraId}`);
    await writeJson(path.join(obraDir, "obra.json"), detail ?? obra);

    await writeJson(
      path.join(obraDir, "documentos.json"),
      await safeDiarioGet(auth, `/obras/${encodeURIComponent(obraId)}/anexos`, stats, `documentos:${obraId}`),
    );
    await writeJson(
      path.join(obraDir, "usuarios.json"),
      await safeDiarioGet(auth, `/obras/${encodeURIComponent(obraId)}/usuarios`, stats, `usuarios:${obraId}`),
    );

    const cronograma = await safeDiarioGet(auth, `/obras/${encodeURIComponent(obraId)}/cronograma`, stats, `cronograma:${obraId}`);
    await writeJson(path.join(obraDir, "cronograma.json"), cronograma);

    const etapasPayload = await safeDiarioGet(auth, `/obras/${encodeURIComponent(obraId)}/etapas`, stats, `etapas:${obraId}`);
    await writeJson(path.join(obraDir, "etapas.json"), etapasPayload);
    const etapas = extractArray(etapasPayload);
    for (const etapa of etapas) {
      const etapaId = stableExternalId(etapa);
      if (!etapaId) continue;
      const tarefas = await safeDiarioGet(
        auth,
        `/obras/${encodeURIComponent(obraId)}/etapas/${encodeURIComponent(etapaId)}/tarefas`,
        stats,
        `tarefas:${obraId}:${etapaId}`,
      );
      await writeJson(path.join(obraDir, "etapas", `${sanitizePathPart(etapaId)}-tarefas.json`), tarefas);
    }

    await writeJson(
      path.join(obraDir, "galeria-fotos.json"),
      await safeDiarioGet(auth, `/analise-de-dados-fotos-por-obra?obraId=${encodeURIComponent(obraId)}`, stats, `galeria-fotos:${obraId}`),
    );
    await writeJson(
      path.join(obraDir, "galeria-videos.json"),
      await safeDiarioGet(auth, `/analise-de-dados-videos-por-obra?obraId=${encodeURIComponent(obraId)}`, stats, `galeria-videos:${obraId}`),
    );
    await writeJson(
      path.join(obraDir, "galeria-anexos.json"),
      await safeDiarioGet(auth, `/analise-de-dados-anexos-por-obra?obraId=${encodeURIComponent(obraId)}`, stats, `galeria-anexos:${obraId}`),
    );

    const reportList = await exportReportsForObra(auth, obraId, obraDir, stats);
    stats.reports += reportList.length;
  }

  stats.finished_at = new Date().toISOString();
  await writeJson(path.join(exportDir, "manifest.json"), stats);
  return stats;
}

async function exportReportsForObra(auth, obraId, obraDir, stats) {
  const reportMap = new Map();
  const yearsPayload = await safeDiarioGet(
    auth,
    `/obras/${encodeURIComponent(obraId)}/anos-contem-informacao`,
    stats,
    `anos:${obraId}`,
  );
  await writeJson(path.join(obraDir, "anos-contem-informacao.json"), yearsPayload);

  const years = extractArray(yearsPayload)
    .map((row) => String(row?.ano ?? row?.year ?? row).trim())
    .filter((year) => /^\d{4}$/.test(year));

  const baseQueries = years.length > 0
    ? years.map((year) => `?ano=${encodeURIComponent(year)}&sort=asc`)
    : ["?sort=asc", "?mes=0&sort=asc"];

  for (const baseQuery of baseQueries) {
    for (let skip = 0; skip <= 10_000; skip += 30) {
      const query = addQueryParam(baseQuery, "skip", String(skip));
      const payload = await safeDiarioGet(auth, `/obras/${encodeURIComponent(obraId)}/relatorios${query}`, stats, `relatorios:${obraId}:${query}`);
      const reports = extractArray(payload);
      let newReports = 0;
      for (const report of reports) {
        const reportId = stableExternalId(report);
        if (!reportId || reportMap.has(reportId)) continue;
        reportMap.set(reportId, report);
        newReports += 1;
      }
      if (reports.length < 30 || newReports === 0) break;
    }
  }

  const reportList = [...reportMap.values()];
  await writeJson(path.join(obraDir, "relatorios-list.json"), reportList);

  for (const report of reportList) {
    const reportId = stableExternalId(report);
    if (!reportId) continue;
    const detailPath = path.join(obraDir, "relatorios", `${sanitizePathPart(reportId)}.json`);
    const existingDetail = await readJsonIfExists(detailPath);
    if (existingDetail && !process.env.DIARIO_REFRESH_REPORT_DETAILS) {
      stats.report_details += 1;
      continue;
    }
    const detail = await safeDiarioGet(
      auth,
      `/obras/${encodeURIComponent(obraId)}/relatorios/${encodeURIComponent(reportId)}`,
      stats,
      `relatorio:${obraId}:${reportId}`,
    );
    if (detail) stats.report_details += 1;
    await writeJson(detailPath, detail ?? report);
  }

  return reportList;
}

async function diarioGet(auth, endpoint) {
  const url = new URL(`${DIARIO_API_BASE}/empresas/${encodeURIComponent(auth.empresaId)}${endpoint}`);
  url.searchParams.set("t", String(Date.now()));

  const response = await fetch(url, {
    headers: {
      "Content-Type": "application/json",
      "App-Iss": DIARIO_APP_ISS,
      Accept: "application/json",
      "Cache-Control": "no-cache, no-store, must-revalidate, max-age=0",
      token: auth.token,
    },
  });

  const text = await response.text();
  if (!response.ok) {
    throw new Error(`Diario API ${response.status} for ${endpoint}: ${text.slice(0, 180)}`);
  }
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

async function safeDiarioGet(auth, endpoint, stats, label) {
  try {
    return await diarioGet(auth, endpoint);
  } catch (error) {
    stats.errors.push({ label, message: redact(error?.message ?? String(error)) });
    return null;
  }
}

async function importToObralia(exportDir) {
  const dryRun = Boolean(flags["dry-run"] ?? process.env.DIARIO_DRY_RUN);
  const uploadMedia = String(process.env.DIARIO_UPLOAD_MEDIA ?? "1") !== "0";
  const maxBytes = optionalInt(process.env.DIARIO_UPLOAD_MAX_BYTES) ?? 209_715_200;
  const mediaConcurrency = clamp(optionalInt(process.env.DIARIO_MEDIA_CONCURRENCY) ?? 8, 1, 16);
  const skipExistingReports = String(process.env.DIARIO_SKIP_EXISTING_REPORTS ?? "0") === "1";
  const skipWbs = String(process.env.DIARIO_SKIP_WBS ?? "0") === "1";
  const skipLooseGalleries = String(process.env.DIARIO_SKIP_LOOSE_GALLERIES ?? "0") === "1";
  const supabase = createSupabaseAdmin();
  const org = await resolveOrganization(supabase);
  const runId = dryRun ? null : await startSyncRun(supabase, org.id);

  const stats = {
    dry_run: dryRun,
    organization: org.name,
    sites_created: 0,
    sites_updated: 0,
    wbs_items_created: 0,
    wbs_items_updated: 0,
    reports_created: 0,
    reports_updated: 0,
    reports_skipped_existing: 0,
    media_created: 0,
    media_updated: 0,
    media_uploaded: 0,
    media_external_fallback: 0,
    cadastro_users_imported: 0,
    cadastro_users_skipped: 0,
    cadastro_snapshot_updated: 0,
    media_concurrency: mediaConcurrency,
    skip_existing_reports: skipExistingReports,
    skip_wbs: skipWbs,
    skip_loose_galleries: skipLooseGalleries,
    report_child_rows: 0,
    errors: [],
  };

  try {
    const obrasPayload = await readJson(path.join(exportDir, "obras.json"));
    const obras = uniqueBy(extractArray(obrasPayload), (obra) => stableExternalId(obra));
    const limit = optionalInt(flags.limitSites ?? process.env.DIARIO_LIMIT_SITES);
    const limitedObras = limit ? obras.slice(0, limit) : obras;
    const startIndex = clamp(optionalInt(flags.startIndex ?? process.env.DIARIO_START_INDEX) ?? 1, 1, Math.max(limitedObras.length, 1));
    const selectedObras = limitedObras.slice(startIndex - 1);
    stats.start_index = startIndex;
    stats.total_sites_in_export = limitedObras.length;
    await importCadastroSnapshot(supabase, org.id, exportDir, { dryRun, stats });

    for (const [index, obraListItem] of selectedObras.entries()) {
      const obraId = stableExternalId(obraListItem);
      if (!obraId) continue;
      const obraDir = path.join(exportDir, "obras", sanitizePathPart(obraId));
      const obraDetail = (await readJsonIfExists(path.join(obraDir, "obra.json"))) ?? obraListItem;
      const obra = mergeObjects(obraListItem, unwrapEntity(obraDetail, ["obra", "data", "dados"]));
      const label = pickString(obra, ["nome", "name", "descricao"]) ?? `obra ${obraId}`;
      console.log(`[import] ${startIndex + index}/${limitedObras.length} obra ${obraId}: ${label}`);

      const site = await upsertSite(supabase, org.id, obraId, obra, { dryRun, stats });
      if (!site?.id) continue;

      if (!skipWbs) await importWbsForSite(supabase, site.id, obraId, obraDir, { dryRun, stats });
      await importReportsForSite(supabase, site.id, obraId, obraDir, {
        dryRun,
        stats,
        uploadMedia,
        maxBytes,
        mediaConcurrency,
        skipExistingReports,
      });
      if (!skipLooseGalleries) {
        await importLooseGalleries(supabase, site.id, obraId, obraDir, { dryRun, stats, uploadMedia, maxBytes, mediaConcurrency });
      }
    }

    if (runId) await finishSyncRun(supabase, runId, "success", stats);
    return stats;
  } catch (error) {
    stats.errors.push({ message: redact(error?.message ?? String(error)) });
    if (runId) await finishSyncRun(supabase, runId, "failed", stats, error);
    throw error;
  }
}

async function exportGlobalCadastros(auth, exportDir, stats) {
  const endpoints = [
    ["usuarios-cadastro.json", "/usuarios?sort=asc", "cadastro-usuarios"],
    ["mao-de-obra-cadastro.json", "/mao-de-obra", "cadastro-mao-de-obra"],
    ["equipamentos-cadastro.json", "/equipamentos", "cadastro-equipamentos"],
    ["tipos-ocorrencias-cadastro.json", "/tipos-de-ocorrencias", "cadastro-tipos-ocorrencias"],
  ];

  for (const [fileName, endpoint, label] of endpoints) {
    await writeJson(path.join(exportDir, fileName), await safeDiarioGet(auth, endpoint, stats, label));
  }
}

async function importCadastroSnapshot(supabase, organizationId, exportDir, context) {
  const { dryRun, stats } = context;
  const usuariosPayload = await readJsonIfExists(path.join(exportDir, "usuarios-cadastro.json"));
  const maoDeObraPayload = await readJsonIfExists(path.join(exportDir, "mao-de-obra-cadastro.json"));
  const equipamentosPayload = await readJsonIfExists(path.join(exportDir, "equipamentos-cadastro.json"));
  const tiposOcorrenciasPayload = await readJsonIfExists(path.join(exportDir, "tipos-ocorrencias-cadastro.json"));
  const empresaUsuario = await readJsonIfExists(path.join(exportDir, "empresa-usuario.json"));

  const users = normalizeCadastroUsers(usuariosPayload);
  const metadata = {
    source: PROVIDER,
    imported_at: new Date().toISOString(),
    empresa: compactCadastroEmpresa(empresaUsuario?.empresa),
    usuario_logado: compactCadastroUser(empresaUsuario?.usuario),
    menu_analise_de_dados: empresaUsuario?.menuAnaliseDeDados ?? null,
    menu_cadastros: empresaUsuario?.menuCadastros ?? null,
    cadastros: {
      usuarios: users,
      mao_de_obra: {
        categorias: extractArray(maoDeObraPayload?.categorias),
        personalizada: extractArray(maoDeObraPayload?.personalizada),
        padrao: extractArray(maoDeObraPayload?.padrao),
      },
      equipamentos: extractArray(equipamentosPayload),
      tipos_ocorrencias: extractArray(tiposOcorrenciasPayload),
    },
    counts: {
      usuarios: users.length,
      usuarios_administrador: users.filter((user) => user.group === "administrador").length,
      usuarios_personalizado: users.filter((user) => user.group === "personalizado").length,
      usuarios_cliente_obra: users.filter((user) => user.group === "clienteObra").length,
      mao_de_obra_categorias: extractArray(maoDeObraPayload?.categorias).length,
      mao_de_obra_personalizada: extractArray(maoDeObraPayload?.personalizada).length,
      mao_de_obra_padrao: extractArray(maoDeObraPayload?.padrao).length,
      equipamentos: extractArray(equipamentosPayload).length,
      tipos_ocorrencias: extractArray(tiposOcorrenciasPayload).length,
    },
  };

  if (dryRun) {
    stats.cadastro_snapshot_updated += 1;
    stats.cadastro_users_imported += users.filter((user) => user.email).length;
    stats.cadastro_users_skipped += users.filter((user) => !user.email).length;
    return;
  }

  const existing = await findByExternalAccountLabel(supabase, organizationId, "Diario de Obras");
  const patch = {
    organization_id: organizationId,
    provider: PROVIDER,
    label: "Diario de Obras",
    external_account_id: empresaUsuario?.empresa?._id ?? null,
    status: "connected",
    last_sync_at: new Date().toISOString(),
    last_success_at: new Date().toISOString(),
    last_error: null,
    metadata,
  };

  if (existing) {
    const { error } = await supabase.from("external_accounts").update(patch).eq("id", existing.id);
    if (error) throw error;
  } else {
    const { error } = await supabase.from("external_accounts").insert(patch);
    if (error) throw error;
  }
  stats.cadastro_snapshot_updated += 1;

  for (const user of users) {
    if (!user.email) {
      stats.cadastro_users_skipped += 1;
      continue;
    }
    const { error } = await supabase.from("pending_invites").upsert({
      organization_id: organizationId,
      email: user.email,
      role: user.role,
      full_name: user.name,
      invited_by: null,
      consumed_at: null,
    }, { onConflict: "email,organization_id" });
    if (error) throw error;
    stats.cadastro_users_imported += 1;
  }
}

async function findByExternalAccountLabel(supabase, organizationId, label) {
  const { data, error } = await supabase
    .from("external_accounts")
    .select("id")
    .eq("organization_id", organizationId)
    .eq("provider", PROVIDER)
    .ilike("label", label)
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data;
}

function createSupabaseAdmin() {
  const env = { ...parseEnvFile(".env.local"), ...process.env };
  const url = env.NEXT_PUBLIC_SUPABASE_URL;
  const key = env.SUPABASE_SERVICE_ROLE_KEY || env.SUPABASE_SECRET_KEY;
  if (!url || !key) throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or service secret in .env.local");
  return createClient(url, key, {
    auth: { persistSession: false },
    global: { fetch: retryingFetch },
  });
}

async function resolveOrganization(supabase) {
  const slug = process.env.OBRALIA_ORG_SLUG ?? "meu-viver";
  let query = supabase.from("organizations").select("id,name,slug").eq("slug", slug).maybeSingle();
  let { data, error } = await query;
  if (error) throw error;
  if (data) return data;

  ({ data, error } = await supabase.from("organizations").select("id,name,slug").order("created_at").limit(1).maybeSingle());
  if (error) throw error;
  if (!data) throw new Error("No organization found in Obralia.");
  return data;
}

async function startSyncRun(supabase, organizationId) {
  const { data, error } = await supabase
    .from("sync_runs")
    .insert({
      organization_id: organizationId,
      provider: PROVIDER,
      scope: "import",
      status: "running",
      started_at: new Date().toISOString(),
      stats: {},
    })
    .select("id")
    .single();
  if (error) throw error;
  return data.id;
}

async function finishSyncRun(supabase, runId, status, stats, error = null) {
  await supabase
    .from("sync_runs")
    .update({
      status,
      finished_at: new Date().toISOString(),
      stats,
      error: error ? redact(error?.message ?? String(error)) : null,
    })
    .eq("id", runId);
}

async function upsertSite(supabase, organizationId, obraId, obra, context) {
  const { dryRun, stats } = context;
  const now = new Date().toISOString();
  const name = pickString(obra, ["nome", "name", "descricao", "titulo"]) ?? `Obra Diario ${obraId}`;
  const patch = {
    organization_id: organizationId,
    name,
    status: mapSiteStatus(obra.status),
    client_name: pickString(obra, ["cliente.nome", "clienteNome", "contratante", "proprietario", "cliente"]),
    address: formatAddress(obra),
    contract_number: pickString(obra, ["contrato", "numeroContrato", "contratoNumero"]),
    contract_days: pickNumber(obra, ["diasContrato", "prazo", "prazoExecucao"]),
    start_date: toIsoDate(pickValue(obra, ["dataInicio", "inicio", "startDate"])),
    end_date: toIsoDate(pickValue(obra, ["dataFim", "termino", "endDate"])),
    cover_url: normalizeRemoteUrl(pickString(obra, ["foto", "urlFoto", "fotoUrl", "logo", "imagem"])),
    external_provider: PROVIDER,
    external_id: String(obraId),
    external_url: `https://web.diariodeobra.app/#/app/obras/${obraId}`,
    last_synced_at: now,
    sync_metadata: {
      source: PROVIDER,
      diario_status: compactObject(obra.status),
      imported_at: now,
      raw_keys: Object.keys(obra).slice(0, 80),
    },
  };

  const existing = await findSite(supabase, organizationId, obraId, name);
  if (dryRun) {
    if (existing) stats.sites_updated += 1;
    else stats.sites_created += 1;
    return existing ?? { id: crypto.randomUUID() };
  }

  if (existing) {
    const { data, error } = await supabase.from("sites").update(patch).eq("id", existing.id).select("id,name").single();
    if (error) throw error;
    stats.sites_updated += 1;
    return data;
  }

  const { data, error } = await supabase.from("sites").insert(patch).select("id,name").single();
  if (error) throw error;
  stats.sites_created += 1;
  return data;
}

async function findSite(supabase, organizationId, obraId, name) {
  let { data, error } = await supabase
    .from("sites")
    .select("id,name")
    .eq("organization_id", organizationId)
    .eq("external_provider", PROVIDER)
    .eq("external_id", String(obraId))
    .maybeSingle();
  if (error) throw error;
  if (data) return data;

  ({ data, error } = await supabase
    .from("sites")
    .select("id,name")
    .eq("organization_id", organizationId)
    .ilike("name", name)
    .limit(1)
    .maybeSingle());
  if (error) throw error;
  return data;
}

async function importWbsForSite(supabase, siteId, obraId, obraDir, context) {
  const cronograma = await readJsonIfExists(path.join(obraDir, "cronograma.json"));
  const etapasPayload = await readJsonIfExists(path.join(obraDir, "etapas.json"));
  const etapasFromCronograma = extractStages(cronograma);
  const etapas = uniqueBy([...etapasFromCronograma, ...extractArray(etapasPayload)], (etapa) => stableExternalId(etapa) || hashObject(etapa));

  let position = 0;
  for (const etapa of etapas) {
    const etapaId = stableExternalId(etapa) ?? hashObject(etapa);
    const etapaName = pickString(etapa, ["descricao", "nome", "name", "titulo"]) ?? `Etapa ${position + 1}`;
    const etapaRow = await upsertWbsItem(supabase, {
      site_id: siteId,
      parent_id: null,
      code: pickString(etapa, ["item", "codigo", "code"]) ?? String(position + 1),
      name: etapaName,
      description: pickString(etapa, ["observacao", "descricaoCompleta", "notes"]),
      status: mapTaskStatus(etapa.status),
      progress_pct: pickNumber(etapa, ["porcentagem", "percentual", "progresso"]) ?? null,
      start_date: toIsoDate(pickValue(etapa, ["dataInicio", "inicio"])),
      due_date: toIsoDate(pickValue(etapa, ["dataFim", "fim", "termino"])),
      position,
      external_provider: PROVIDER,
      external_id: `${obraId}:etapa:${etapaId}`,
      external_url: `https://web.diariodeobra.app/#/app/obras/${obraId}/cronograma`,
      last_synced_at: new Date().toISOString(),
      sync_metadata: { source: PROVIDER, diario_type: "etapa", diario_id: etapaId },
    }, context);

    const tarefas = await loadTarefasForEtapa(obraDir, etapa);
    let taskPosition = 0;
    for (const tarefa of tarefas) {
      const tarefaId = stableExternalId(tarefa) ?? hashObject(tarefa);
      await upsertWbsItem(supabase, {
        site_id: siteId,
        parent_id: etapaRow?.id ?? null,
        code: pickString(tarefa, ["item", "codigo", "code"]) ?? `${position + 1}.${taskPosition + 1}`,
        name: pickString(tarefa, ["descricao", "nome", "name", "titulo"]) ?? `Tarefa ${taskPosition + 1}`,
        description: pickString(tarefa, ["observacao", "notes", "descricaoCompleta"]),
        status: mapTaskStatus(tarefa.status),
        progress_pct: pickNumber(tarefa, ["porcentagem", "percentual", "progresso"]) ?? null,
        start_date: toIsoDate(pickValue(tarefa, ["dataInicio", "inicio"])),
        due_date: toIsoDate(pickValue(tarefa, ["dataFim", "fim", "termino"])),
        position: taskPosition,
        external_provider: PROVIDER,
        external_id: `${obraId}:tarefa:${tarefaId}`,
        external_url: `https://web.diariodeobra.app/#/app/obras/${obraId}/cronograma`,
        last_synced_at: new Date().toISOString(),
        sync_metadata: { source: PROVIDER, diario_type: "tarefa", diario_id: tarefaId, etapa_id: etapaId },
      }, context);
      taskPosition += 1;
    }

    position += 1;
  }
}

async function loadTarefasForEtapa(obraDir, etapa) {
  const inline = extractTasks(etapa);
  const etapaId = stableExternalId(etapa);
  if (!etapaId) return inline;
  const file = path.join(obraDir, "etapas", `${sanitizePathPart(etapaId)}-tarefas.json`);
  const payload = await readJsonIfExists(file);
  return uniqueBy([...inline, ...extractArray(payload)], (tarefa) => stableExternalId(tarefa) || hashObject(tarefa));
}

async function upsertWbsItem(supabase, patch, context) {
  const { dryRun, stats } = context;
  const existing = await findByExternal(supabase, "wbs_items", {
    site_id: patch.site_id,
    external_provider: PROVIDER,
    external_id: patch.external_id,
  });

  if (dryRun) {
    if (existing) stats.wbs_items_updated += 1;
    else stats.wbs_items_created += 1;
    return existing ?? { id: crypto.randomUUID() };
  }

  if (existing) {
    const { data, error } = await supabase.from("wbs_items").update(patch).eq("id", existing.id).select("id").single();
    if (error) throw error;
    stats.wbs_items_updated += 1;
    return data;
  }

  const { data, error } = await supabase.from("wbs_items").insert(patch).select("id").single();
  if (error) throw error;
  stats.wbs_items_created += 1;
  return data;
}

async function importReportsForSite(supabase, siteId, obraId, obraDir, context) {
  const list = await readJsonIfExists(path.join(obraDir, "relatorios-list.json"));
  const summaries = extractArray(list);
  const reportFiles = await listJsonFiles(path.join(obraDir, "relatorios"));
  const byId = new Map(summaries.map((report) => [stableExternalId(report), report]).filter(([id]) => id));

  for (const file of reportFiles) {
    const reportIdFromFile = path.basename(file, ".json");
    if (context.skipExistingReports) {
      const existing = await findByExternal(supabase, "daily_reports", {
        site_id: siteId,
        external_provider: PROVIDER,
        external_id: reportIdFromFile,
      });
      if (existing) {
        context.stats.reports_skipped_existing += 1;
        continue;
      }
    }

    const detailPayload = await readJson(file);
    const detail = unwrapReport(detailPayload);
    const reportId = stableExternalId(detail) ?? reportIdFromFile;
    const summary = byId.get(reportId) ?? {};
    const report = mergeObjects(summary, detail);
    const links = extractLinks(detailPayload, detail);
    const dailyReport = await upsertDailyReport(supabase, siteId, obraId, reportId, report, context);
    if (!dailyReport?.id) continue;

    await replaceReportChildren(supabase, dailyReport.id, report, context);
    await importReportMedia(supabase, siteId, dailyReport.id, obraId, reportId, report, links, context);
  }
}

async function upsertDailyReport(supabase, siteId, obraId, reportId, report, context) {
  const { dryRun, stats } = context;
  const now = new Date().toISOString();
  const number = pickNumber(report, ["numero", "number", "id"]) ?? 1;
  const date = toIsoDate(pickValue(report, ["data", "date", "dataInicio", "createdAt"])) ?? new Date().toISOString().slice(0, 10);
  const patch = {
    site_id: siteId,
    number,
    date,
    status: mapReportStatus(report.status),
    weather_morning: pickString(report, ["clima.manha.clima", "clima.morning.weather", "weather_morning"]),
    weather_afternoon: pickString(report, ["clima.tarde.clima", "clima.afternoon.weather", "weather_afternoon"]),
    condition_morning: pickString(report, ["clima.manha.condicao", "condition_morning"]),
    condition_afternoon: pickString(report, ["clima.tarde.condicao", "condition_afternoon"]),
    general_notes: buildReportNotes(report),
    approval_status_id: pickNumber(report, ["status.id"]),
    approval_status_label: pickString(report, ["status.descricao", "status.label"]),
    external_provider: PROVIDER,
    external_id: String(reportId),
    external_url: `https://web.diariodeobra.app/#/app/obras/${obraId}/relatorios/${reportId}`,
    last_synced_at: now,
    sync_metadata: {
      source: PROVIDER,
      diario_id: reportId,
      imported_at: now,
      data_fim: pickValue(report, ["dataFim"]) ?? null,
      modelo: compactObject(pickValue(report, ["modeloDeRelatorio"])),
    },
  };

  let existing = await findByExternal(supabase, "daily_reports", {
    site_id: siteId,
    external_provider: PROVIDER,
    external_id: String(reportId),
  });

  if (!existing && Number.isFinite(number)) {
    const { data, error } = await supabase
      .from("daily_reports")
      .select("id")
      .eq("site_id", siteId)
      .eq("number", number)
      .maybeSingle();
    if (error) throw error;
    existing = data;
  }

  if (dryRun) {
    if (existing) stats.reports_updated += 1;
    else stats.reports_created += 1;
    return existing ?? { id: crypto.randomUUID() };
  }

  if (existing) {
    const { data, error } = await supabase.from("daily_reports").update(patch).eq("id", existing.id).select("id").single();
    if (error) throw error;
    stats.reports_updated += 1;
    return data;
  }

  const { data, error } = await supabase.from("daily_reports").insert(patch).select("id").single();
  if (error) throw error;
  stats.reports_created += 1;
  return data;
}

async function replaceReportChildren(supabase, dailyReportId, report, context) {
  const { dryRun, stats } = context;
  const workforce = normalizeWorkforce(report);
  const equipment = normalizeEquipment(report);
  const activities = normalizeActivities(report);

  if (dryRun) {
    stats.report_child_rows += workforce.length + equipment.length + activities.length;
    return;
  }

  await throwIfError(supabase.from("report_workforce").delete().eq("daily_report_id", dailyReportId));
  await throwIfError(supabase.from("report_equipment").delete().eq("daily_report_id", dailyReportId));
  await throwIfError(supabase.from("report_activities").delete().eq("daily_report_id", dailyReportId));

  if (workforce.length) {
    await throwIfError(supabase.from("report_workforce").insert(workforce.map((row) => ({ ...row, daily_report_id: dailyReportId }))));
  }
  if (equipment.length) {
    await throwIfError(supabase.from("report_equipment").insert(equipment.map((row) => ({ ...row, daily_report_id: dailyReportId }))));
  }
  if (activities.length) {
    await throwIfError(supabase.from("report_activities").insert(activities.map((row) => ({ ...row, daily_report_id: dailyReportId }))));
  }
  stats.report_child_rows += workforce.length + equipment.length + activities.length;
}

async function importReportMedia(supabase, siteId, dailyReportId, obraId, reportId, report, links, context) {
  const media = collectReportMedia(report, links).map((item) => ({
    ...item,
    external_id: `${reportId}:${item.external_id}`,
    daily_report_id: dailyReportId,
  }));
  await mapWithConcurrency(media, context.mediaConcurrency ?? 1, (item) => upsertMedia(supabase, siteId, obraId, item, context));
}

async function importLooseGalleries(supabase, siteId, obraId, obraDir, context) {
  const files = [
    ["galeria-fotos.json", "photo"],
    ["galeria-videos.json", "video"],
    ["galeria-anexos.json", "file"],
    ["documentos.json", "file"],
  ];

  for (const [fileName, kind] of files) {
    const payload = await readJsonIfExists(path.join(obraDir, fileName));
    const items = extractArray(payload);
    await mapWithConcurrency(items, context.mediaConcurrency ?? 1, async (raw) => {
      const url = normalizeRemoteUrl(pickString(raw, ["url", "link", "arquivo", "downloadUrl", "foto", "video"]));
      if (!url) return;
      const itemId = stableExternalId(raw) ?? hashString(url);
      await upsertMedia(supabase, siteId, obraId, {
        kind,
        external_id: `${fileName}:${itemId}`,
        external_url: url,
        source_url: url,
        thumbnail_url: normalizeRemoteUrl(pickString(raw, ["urlMiniatura", "thumbnail", "thumb", "urlFoto"])),
        caption: pickString(raw, ["descricao", "comentario", "legenda", "nome"]),
        taken_at: toIsoDateTime(pickValue(raw, ["data", "dataHora", "createdAt"])),
        sync_metadata: { source_file: fileName, diario: compactObject(raw) },
      }, context);
    });
  }
}

async function upsertMedia(supabase, siteId, obraId, item, context) {
  const { dryRun, stats, uploadMedia, maxBytes } = context;
  const now = new Date().toISOString();
  let existing = await findByExternal(supabase, "media", {
    site_id: siteId,
    external_provider: PROVIDER,
    external_id: item.external_id,
  });
  const sourceUrlForMatch = item.source_url ?? item.external_url ?? null;
  if (!existing && sourceUrlForMatch) {
    existing = await findMediaBySourceUrl(supabase, siteId, sourceUrlForMatch);
  }

  let storagePath = existing?.storage_path;
  let thumbnailPath = existing?.thumbnail_path ?? null;
  let migrationError = null;
  let sizeBytes = item.size_bytes ?? null;

  if (!storagePath && item.source_url) {
    if (uploadMedia && !dryRun) {
      const uploaded = await uploadRemoteMedia(supabase, siteId, item, maxBytes);
      if (uploaded.ok) {
        storagePath = uploaded.path;
        thumbnailPath = uploaded.thumbnailPath ?? thumbnailPath;
        sizeBytes = uploaded.sizeBytes ?? sizeBytes;
        stats.media_uploaded += 1;
      } else {
        storagePath = item.source_url;
        migrationError = uploaded.error;
        stats.media_external_fallback += 1;
      }
    } else {
      storagePath = item.source_url;
      if (!dryRun) stats.media_external_fallback += 1;
    }
  }

  if (!storagePath) return;

  const patch = {
    site_id: siteId,
    daily_report_id: item.daily_report_id ?? existing?.daily_report_id ?? null,
    kind: item.kind,
    storage_path: storagePath,
    thumbnail_path: thumbnailPath,
    caption: item.caption ?? null,
    taken_at: item.taken_at ?? null,
    gps_lat: item.gps_lat ?? null,
    gps_lng: item.gps_lng ?? null,
    width: item.width ?? null,
    height: item.height ?? null,
    size_bytes: sizeBytes,
    external_provider: PROVIDER,
    external_id: existing?.external_id ?? item.external_id,
    external_url: item.external_url ?? item.source_url ?? existing?.external_url ?? null,
    last_synced_at: now,
    migrated_at: storagePath.startsWith("http") ? null : now,
    migration_error: migrationError,
    sync_metadata: {
      source: PROVIDER,
      obra_id: obraId,
      imported_at: now,
      ...(item.sync_metadata ?? {}),
    },
  };

  if (dryRun) {
    if (existing) stats.media_updated += 1;
    else stats.media_created += 1;
    return;
  }

  if (existing) {
    const { error } = await supabase.from("media").update(patch).eq("id", existing.id);
    if (error) throw error;
    stats.media_updated += 1;
    return;
  }

  const { error } = await supabase.from("media").insert(patch);
  if (error) throw error;
  stats.media_created += 1;
}

async function uploadRemoteMedia(supabase, siteId, item, maxBytes) {
  try {
    const response = await fetch(item.source_url, {
      headers: { Accept: "*/*" },
      signal: AbortSignal.timeout(60_000),
    });
    if (!response.ok) return { ok: false, error: `fetch ${response.status}` };

    const contentLength = Number(response.headers.get("content-length") ?? "0");
    if (contentLength > maxBytes) return { ok: false, error: `remote file exceeds ${maxBytes} bytes` };

    const contentType = response.headers.get("content-type") || contentTypeForKind(item.kind);
    const arrayBuffer = await response.arrayBuffer();
    if (arrayBuffer.byteLength > maxBytes) return { ok: false, error: `remote file exceeds ${maxBytes} bytes` };

    const id = crypto.randomUUID();
    const ext = guessExtension(item.source_url, contentType, item.kind);
    const storagePath = `${siteId}/${id}.${ext}`;

    const { error } = await supabase.storage.from("media").upload(storagePath, new Uint8Array(arrayBuffer), {
      contentType,
      upsert: false,
    });
    if (error) return { ok: false, error: error.message };

    return { ok: true, path: storagePath, sizeBytes: arrayBuffer.byteLength };
  } catch (error) {
    return { ok: false, error: redact(error?.message ?? String(error)) };
  }
}

async function findByExternal(supabase, table, filters) {
  let query = supabase.from(table).select("*");
  for (const [key, value] of Object.entries(filters)) {
    query = query.eq(key, value);
  }
  const { data, error } = await query.limit(1).maybeSingle();
  if (error) throw error;
  return data;
}

async function findMediaBySourceUrl(supabase, siteId, url) {
  const { data, error } = await supabase
    .from("media")
    .select("*")
    .eq("site_id", siteId)
    .eq("external_provider", PROVIDER)
    .eq("external_url", url)
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data;
}

async function throwIfError(queryPromise) {
  const { error } = await queryPromise;
  if (error) throw error;
}

function unwrapReport(payload) {
  return unwrapEntity(payload, ["relatorio", "report", "data", "dados"]) ?? payload ?? {};
}

function extractLinks(payload, report) {
  return pickValue(payload, ["links", "data.links", "dados.links"]) ?? pickValue(report, ["links"]) ?? {};
}

function collectReportMedia(report, links) {
  const items = [];
  const addPhoto = (photo, scope) => {
    const url = buildLinkedUrl(links.urlFotos, pickString(photo, ["url", "arquivo", "path"]));
    const thumb = buildLinkedUrl(links.urlFotosMiniatura, pickString(photo, ["urlMiniatura", "thumbnail", "thumb"]));
    if (!url && !thumb) return;
    const id = stableExternalId(photo) ?? hashString(url ?? thumb);
    items.push({
      kind: "photo",
      external_id: `foto:${scope}:${id}`,
      source_url: url ?? thumb,
      external_url: url ?? thumb,
      thumbnail_url: thumb,
      caption: pickString(photo, ["descricao", "comentario", "legenda"]),
      taken_at: toIsoDateTime(pickValue(photo, ["data", "dataHora", "createdAt"])),
      width: pickNumber(photo, ["width", "largura"]),
      height: pickNumber(photo, ["height", "altura"]),
      gps_lat: pickNumber(photo, ["latitude", "lat"]),
      gps_lng: pickNumber(photo, ["longitude", "lng"]),
      sync_metadata: { scope, diario: compactObject(photo) },
    });
  };

  for (const photo of extractArray(report.galeriaDeFotos)) addPhoto(photo, "galeria");
  for (const activity of extractArray(report.atividades)) {
    for (const photo of extractArray(activity.fotos)) addPhoto(photo, `atividade:${stableExternalId(activity) ?? hashObject(activity)}`);
  }
  for (const occurrence of extractArray(report.ocorrencias)) {
    for (const photo of extractArray(occurrence.fotos)) addPhoto(photo, `ocorrencia:${stableExternalId(occurrence) ?? hashObject(occurrence)}`);
  }
  for (const group of extractArray(report.checklist)) {
    for (const item of extractArray(group.itens)) {
      for (const photo of extractArray(item.fotos)) addPhoto(photo, `checklist:${stableExternalId(item) ?? hashObject(item)}`);
    }
  }

  for (const video of extractArray(report.videos)) {
    const raw = pickString(video, ["url", "arquivo", "path"]);
    const url = buildLinkedUrl(links.urlVideos, raw, links.tokenSAS);
    const poster = buildLinkedUrl(links.urlVideos, pickString(video, ["urlFoto", "thumbnail", "thumb"]));
    if (!url) continue;
    const id = stableExternalId(video) ?? hashString(url);
    items.push({
      kind: "video",
      external_id: `video:${id}`,
      source_url: url,
      external_url: url,
      thumbnail_url: poster,
      caption: pickString(video, ["descricao", "comentario", "legenda"]),
      taken_at: toIsoDateTime(pickValue(video, ["data", "dataHora", "createdAt"])),
      sync_metadata: { scope: "videos", diario: compactObject(video) },
    });
  }

  for (const file of extractArray(report.anexos)) {
    const url = buildLinkedUrl(links.urlAnexos, pickString(file, ["url", "arquivo", "path"]));
    if (!url) continue;
    const id = stableExternalId(file) ?? hashString(url);
    items.push({
      kind: "file",
      external_id: `anexo:${id}`,
      source_url: url,
      external_url: url,
      caption: pickString(file, ["nome", "descricao", "filename"]),
      taken_at: toIsoDateTime(pickValue(file, ["data", "dataHora", "createdAt"])),
      sync_metadata: { scope: "anexos", diario: compactObject(file) },
    });
  }

  return uniqueBy(items, (item) => item.external_id);
}

function normalizeWorkforce(report) {
  const mao = report.maoDeObra;
  if (!mao || typeof mao !== "object") return [];
  const selected = mao.opcaoSelecionada || (Array.isArray(mao.padrao) && mao.padrao.length ? "padrao" : "personalizada");
  const rows = [];

  if (selected === "padrao") {
    for (const item of extractArray(mao.padrao)) {
      const count = pickNumber(item, ["quantidade", "count"]);
      const role = pickString(item, ["descricao", "nome", "funcao.descricao", "categoria.descricao"]);
      if (role && count && count > 0) rows.push({ role, count: Math.round(count) });
    }
  } else {
    const grouped = new Map();
    for (const item of extractArray(mao.personalizada)) {
      if (item.presenca === false) continue;
      const role = pickString(item, ["funcao", "funcao.descricao", "categoria.descricao"]) ?? "Equipe";
      grouped.set(role, (grouped.get(role) ?? 0) + 1);
    }
    for (const [role, count] of grouped.entries()) rows.push({ role, count });
  }

  return rows;
}

function normalizeEquipment(report) {
  const rows = [];
  for (const item of extractArray(report.equipamentos)) {
    const quantity = pickNumber(item, ["quantidade", "count"]);
    const name = pickString(item, ["descricao", "nome", "name"]);
    if (!name || !quantity || quantity <= 0) continue;
    const hours = parseHours(pickValue(item, ["horario.total", "horario.descricao", "horas", "hours"]));
    rows.push({ name: quantity > 1 ? `${quantity}x ${name}` : name, hours });
  }
  return rows;
}

function normalizeActivities(report) {
  const rows = [];
  for (const item of extractArray(report.atividades)) {
    const description = pickString(item, ["descricao", "nome", "name"]);
    if (!description && !pickValue(item, ["tarefaId"])) continue;
    const notes = [
      pickString(item, ["status.descricao"]),
      pickString(item, ["horario.descricao"]),
      productionText(item),
      occurrenceText(item),
    ].filter(Boolean).join("\n");
    rows.push({
      description: description ?? "Atividade do cronograma",
      progress_pct: pickNumber(item, ["porcentagem", "percentual", "progresso"]),
      notes: notes || null,
    });
  }
  return rows;
}

function buildReportNotes(report) {
  const sections = [];
  const direct = pickString(report, ["observacao", "observacoes", "general_notes", "descricao"]);
  if (direct) sections.push(`Observacoes\n${direct}`);

  const horario = workHoursText(report.horarioDeTrabalho);
  if (horario) sections.push(`Horario de trabalho\n${horario}`);

  const ocorrencias = extractArray(report.ocorrencias)
    .map((item) => [pickString(item, ["descricao"]), pickString(item, ["horario.descricao"])].filter(Boolean).join(" - "))
    .filter(Boolean);
  if (ocorrencias.length) sections.push(`Ocorrencias\n${ocorrencias.join("\n")}`);

  const comentarios = extractArray(report.comentarios)
    .map((item) => [pickString(item, ["dataHora"]), pickString(item, ["usuario.nome"]), pickString(item, ["descricao"])].filter(Boolean).join(" - "))
    .filter(Boolean);
  if (comentarios.length) sections.push(`Comentarios\n${comentarios.join("\n\n")}`);

  const material = materialText(report.controleDeMaterial);
  if (material) sections.push(`Controle de material\n${material}`);

  return sections.join("\n\n") || null;
}

function workHoursText(value) {
  if (!value || typeof value !== "object") return null;
  const chunks = [];
  const start = pickString(value, ["expedienteInicio"]);
  const end = pickString(value, ["expedienteFim"]);
  const total = pickString(value, ["horasTrabalhadas"]);
  if (start || end) chunks.push(`Expediente: ${[start, end].filter(Boolean).join(" as ")}`);
  if (total) chunks.push(`Total: ${total}`);
  return chunks.join("\n") || null;
}

function materialText(value) {
  if (!value || typeof value !== "object") return null;
  const lines = [];
  for (const key of ["recebido", "utilizado"]) {
    const list = extractArray(value[key]);
    if (!list.length) continue;
    lines.push(key);
    for (const item of list) {
      const desc = pickString(item, ["descricao", "nome"]);
      const qty = pickNumber(item, ["quantidade"]);
      if (desc) lines.push(qty ? `${desc}: ${qty}` : desc);
    }
  }
  return lines.join("\n") || null;
}

function productionText(item) {
  const prod = pickValue(item, ["controleDeProducao"]);
  if (!prod?.ativo) return null;
  const realizado = pickValue(prod, ["realizado"]);
  const unidade = pickValue(prod, ["unidade"]);
  return realizado ? `Producao: ${realizado}${unidade ? ` ${unidade}` : ""}` : null;
}

function occurrenceText(item) {
  const rows = extractArray(item.ocorrencias).map((occurrence) => pickString(occurrence, ["descricao"])).filter(Boolean);
  return rows.length ? `Ocorrencias: ${rows.join(" | ")}` : null;
}

function extractArray(payload) {
  if (!payload) return [];
  if (Array.isArray(payload)) return payload;
  if (typeof payload !== "object") return [];
  for (const key of ["data", "dados", "items", "result", "resultado", "registros", "lista", "obras", "relatorios", "tarefas", "fotos", "videos", "anexos"]) {
    const value = payload[key];
    if (Array.isArray(value)) return value;
    if (value && typeof value === "object") {
      const nested = extractArray(value);
      if (nested.length) return nested;
    }
  }
  return [];
}

function extractStages(payload) {
  const direct = extractArray(payload);
  if (direct.length) return direct;
  if (payload && typeof payload === "object") {
    for (const key of ["etapas", "cronograma", "items"]) {
      if (Array.isArray(payload[key])) return payload[key];
    }
  }
  return [];
}

function extractTasks(etapa) {
  if (!etapa || typeof etapa !== "object") return [];
  for (const key of ["tarefas", "tasks", "items", "filhos"]) {
    if (Array.isArray(etapa[key])) return etapa[key];
  }
  return [];
}

function normalizeCadastroUsers(payload) {
  if (!payload || typeof payload !== "object") return [];
  const groups = [
    ["administrador", "admin"],
    ["personalizado", "engineer"],
    ["clienteObra", "viewer"],
  ];
  const users = [];

  for (const [group, role] of groups) {
    for (const raw of extractArray(payload[group])) {
      const user = compactCadastroUser(raw);
      if (!user.external_id && !user.email && !user.name) continue;
      users.push({
        ...user,
        group,
        role,
        profile_label: pickString(raw, ["perfil.descricao", "perfil", "tipo.descricao", "tipo"]) ?? group,
        active: pickValue(raw, ["ativo"]) !== false,
        raw: compactObject(raw),
      });
    }
  }

  return uniqueBy(users, (user) => user.external_id ?? user.email ?? user.name);
}

function compactCadastroUser(user) {
  if (!user || typeof user !== "object") return null;
  return {
    external_id: stableExternalId(user),
    name: pickString(user, ["nome", "name", "full_name"]),
    initials: pickString(user, ["sigla", "initials"]),
    email: normalizeEmail(pickString(user, ["email", "mail"])),
    phone: pickString(user, ["telefone", "celular", "phone"]),
    title: pickString(user, ["cargo", "funcao", "role"]),
    avatar_url: normalizeRemoteUrl(pickString(user, ["fotoUrl", "avatar_url", "foto"])),
    signature_url: normalizeRemoteUrl(pickString(user, ["arquivoAssinaturaUrl"])),
  };
}

function compactCadastroEmpresa(empresa) {
  if (!empresa || typeof empresa !== "object") return null;
  return {
    external_id: stableExternalId(empresa),
    name: pickString(empresa, ["nome", "razaoSocial"]),
    legal_name: pickString(empresa, ["razaoSocial"]),
    document: pickString(empresa, ["cpfCnpj"]),
    phone: pickString(empresa, ["telefone"]),
    logo_url: normalizeRemoteUrl(pickString(empresa, ["logoUrl"])),
    status: pickString(empresa, ["status.descricao"]),
    plan: pickString(empresa, ["contratacao.plano.descricao", "contratacao.plano.nome"]),
  };
}

function unwrapEntity(payload, keys) {
  if (!payload || typeof payload !== "object") return null;
  for (const key of keys) {
    const value = pickValue(payload, [key]);
    if (value && typeof value === "object" && !Array.isArray(value)) return value;
  }
  return payload;
}

function mergeObjects(...objects) {
  return Object.assign({}, ...objects.filter((obj) => obj && typeof obj === "object" && !Array.isArray(obj)));
}

function pickValue(obj, paths) {
  for (const keyPath of paths) {
    const parts = String(keyPath).split(".");
    let value = obj;
    for (const part of parts) {
      if (value == null || typeof value !== "object") {
        value = undefined;
        break;
      }
      value = value[part];
    }
    if (value !== undefined && value !== null && value !== "") return value;
  }
  return null;
}

function pickString(obj, paths) {
  const value = pickValue(obj, paths);
  if (value == null) return null;
  if (typeof value === "object") {
    if (typeof value.descricao === "string") return value.descricao.trim() || null;
    if (typeof value.nome === "string") return value.nome.trim() || null;
    return null;
  }
  const text = String(value).trim();
  return text || null;
}

function pickNumber(obj, paths) {
  const value = pickValue(obj, paths);
  if (value == null || value === "") return null;
  const number = Number(String(value).replace(",", "."));
  return Number.isFinite(number) ? number : null;
}

function stableExternalId(obj) {
  if (obj == null) return null;
  if (typeof obj === "string" || typeof obj === "number") return String(obj);
  return pickString(obj, ["_id", "id", "obraId", "relatorioId", "tarefaId", "etapaId", "codigo", "uuid"]);
}

function mapSiteStatus(status) {
  const id = typeof status === "object" && status ? Number(status.id) : Number(status);
  const text = typeof status === "object" && status ? pickString(status, ["descricao", "label", "name"]) : String(status ?? "");
  if (id === 1 || /nao|n.o|not.*start/i.test(removeAccents(text))) return "not_started";
  if (id === 2 || /paralis|paus|paused/i.test(removeAccents(text))) return "paused";
  if (id === 4 || /conclu|done|final/i.test(removeAccents(text))) return "done";
  return "in_progress";
}

function mapTaskStatus(status) {
  const id = typeof status === "object" && status ? Number(status.id) : Number(status);
  const text = typeof status === "object" && status ? pickString(status, ["descricao", "label", "name"]) : String(status ?? "");
  if (id === 3 || /conclu|done|final/i.test(removeAccents(text))) return "done";
  if (/atras|late/i.test(removeAccents(text))) return "late";
  if (/paralis|paus/i.test(removeAccents(text))) return "paused";
  if (id === 2 || /andamento|progress/i.test(removeAccents(text))) return "in_progress";
  return "waiting";
}

function mapReportStatus(status) {
  const id = typeof status === "object" && status ? Number(status.id) : Number(status);
  const text = typeof status === "object" && status ? pickString(status, ["descricao", "label", "name"]) : String(status ?? "");
  if (id === 4 || /aprov|approved/i.test(removeAccents(text))) return "approved";
  if (id === 3 || /revis|review/i.test(removeAccents(text))) return "review";
  return "draft";
}

function formatAddress(obra) {
  const direct = pickString(obra, ["endereco", "address", "localizacao"]);
  if (direct) return direct;
  const parts = [
    pickString(obra, ["logradouro", "rua"]),
    pickString(obra, ["numero"]),
    pickString(obra, ["bairro"]),
    pickString(obra, ["cidade"]),
    pickString(obra, ["uf", "estado"]),
  ].filter(Boolean);
  return parts.length ? parts.join(", ") : null;
}

function toIsoDate(value) {
  if (!value) return null;
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  const text = String(value).trim();
  if (!text) return null;
  if (/^\d{4}-\d{2}-\d{2}/.test(text)) return text.slice(0, 10);
  const br = text.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (br) return `${br[3]}-${br[2].padStart(2, "0")}-${br[1].padStart(2, "0")}`;
  const parsed = new Date(text);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString().slice(0, 10);
}

function toIsoDateTime(value) {
  const date = toIsoDate(value);
  if (!date) return null;
  const text = String(value ?? "");
  const time = text.match(/(\d{1,2}):(\d{2})(?::(\d{2}))?/);
  return time ? `${date}T${time[1].padStart(2, "0")}:${time[2]}:${time[3] ?? "00"}.000Z` : `${date}T00:00:00.000Z`;
}

function parseHours(value) {
  if (value == null || value === "") return null;
  if (typeof value === "number") return value;
  const text = String(value);
  const hhmm = text.match(/(\d{1,2}):(\d{2})/);
  if (hhmm) return Number(hhmm[1]) + Number(hhmm[2]) / 60;
  const hours = text.match(/(\d+(?:[,.]\d+)?)\s*h/i);
  if (hours) return Number(hours[1].replace(",", "."));
  const number = Number(text.replace(",", "."));
  return Number.isFinite(number) ? number : null;
}

function normalizeRemoteUrl(url) {
  if (!url) return null;
  const text = String(url).trim();
  if (!text) return null;
  if (/^https?:\/\//i.test(text)) return text;
  return null;
}

function normalizeEmail(email) {
  if (!email) return null;
  const text = String(email).trim().toLowerCase();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(text) ? text : null;
}

function buildLinkedUrl(base, filePath, suffix = "") {
  if (!filePath) return null;
  if (/^https?:\/\//i.test(filePath)) return `${filePath}${suffix ?? ""}`;
  if (!base) return null;
  return `${String(base).replace(/\/?$/, "/")}${String(filePath).replace(/^\//, "")}${suffix ?? ""}`;
}

function contentTypeForKind(kind) {
  if (kind === "video") return "video/mp4";
  if (kind === "file") return "application/octet-stream";
  return "image/jpeg";
}

function guessExtension(url, contentType, kind) {
  try {
    const pathname = new URL(url).pathname;
    const ext = path.extname(pathname).slice(1).toLowerCase();
    if (ext && ext.length <= 5) return ext;
  } catch {
    // Fall through to content type.
  }
  if (/png/i.test(contentType)) return "png";
  if (/webp/i.test(contentType)) return "webp";
  if (/gif/i.test(contentType)) return "gif";
  if (/pdf/i.test(contentType)) return "pdf";
  if (/mp4/i.test(contentType)) return "mp4";
  if (/quicktime|mov/i.test(contentType)) return "mov";
  if (kind === "video") return "mp4";
  if (kind === "file") return "bin";
  return "jpg";
}

function optionalInt(value) {
  if (value == null || value === "") return null;
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? Math.floor(number) : null;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function mapWithConcurrency(items, concurrency, mapper) {
  if (!items.length) return [];
  const results = [];
  let nextIndex = 0;
  const workerCount = Math.min(concurrency, items.length);

  await Promise.all(Array.from({ length: workerCount }, async () => {
    while (nextIndex < items.length) {
      const index = nextIndex;
      nextIndex += 1;
      results[index] = await mapper(items[index], index);
    }
  }));

  return results;
}

function compactObject(value) {
  if (!value || typeof value !== "object") return value ?? null;
  const result = {};
  for (const [key, inner] of Object.entries(value).slice(0, 40)) {
    if (inner == null) result[key] = inner;
    else if (typeof inner === "object") result[key] = Array.isArray(inner) ? `[${inner.length} items]` : "{...}";
    else result[key] = inner;
  }
  return result;
}

function uniqueBy(items, keyFn) {
  const map = new Map();
  for (const item of items) {
    const key = keyFn(item);
    if (!key) continue;
    if (!map.has(key)) map.set(key, item);
  }
  return [...map.values()];
}

function hashObject(value) {
  return hashString(JSON.stringify(value));
}

function hashString(value) {
  return crypto.createHash("sha1").update(String(value)).digest("hex").slice(0, 16);
}

function sanitizePathPart(value) {
  return String(value).replace(/[^a-zA-Z0-9_.-]/g, "_");
}

function removeAccents(value) {
  return String(value ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

function redact(value) {
  return String(value)
    .replace(/sb_secret_[A-Za-z0-9_-]+/g, "sb_secret_[redacted]")
    .replace(/eyJ[A-Za-z0-9._-]+/g, "jwt_[redacted]")
    .replace(/token=([^&\s]+)/gi, "token=[redacted]");
}

async function writeJson(filePath, value) {
  await fsp.mkdir(path.dirname(filePath), { recursive: true });
  await fsp.writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

async function readJson(filePath) {
  return JSON.parse(await fsp.readFile(filePath, "utf8"));
}

async function readJsonIfExists(filePath) {
  if (!fs.existsSync(filePath)) return null;
  return readJson(filePath);
}

async function listJsonFiles(dir) {
  if (!fs.existsSync(dir)) return [];
  return (await fsp.readdir(dir))
    .filter((name) => name.endsWith(".json"))
    .sort()
    .map((name) => path.join(dir, name));
}

async function printExportSummary(exportDir) {
  const manifest = await readJsonIfExists(path.join(exportDir, "manifest.json"));
  const obrasPayload = await readJsonIfExists(path.join(exportDir, "obras.json"));
  const usuariosPayload = await readJsonIfExists(path.join(exportDir, "usuarios-cadastro.json"));
  const maoDeObraPayload = await readJsonIfExists(path.join(exportDir, "mao-de-obra-cadastro.json"));
  const equipamentosPayload = await readJsonIfExists(path.join(exportDir, "equipamentos-cadastro.json"));
  const tiposOcorrenciasPayload = await readJsonIfExists(path.join(exportDir, "tipos-ocorrencias-cadastro.json"));
  const obraDirs = fs.existsSync(path.join(exportDir, "obras")) ? await fsp.readdir(path.join(exportDir, "obras")) : [];
  let reportFiles = 0;
  for (const dir of obraDirs) {
    reportFiles += (await listJsonFiles(path.join(exportDir, "obras", dir, "relatorios"))).length;
  }
  console.log(JSON.stringify({
    exportDir,
    manifest,
    obras_in_list: extractArray(obrasPayload).length,
    obra_dirs: obraDirs.length,
    report_detail_files: reportFiles,
    cadastro_users: normalizeCadastroUsers(usuariosPayload).length,
    cadastro_workforce_default: extractArray(maoDeObraPayload?.padrao).length,
    cadastro_equipment: extractArray(equipamentosPayload).length,
    cadastro_occurrence_types: extractArray(tiposOcorrenciasPayload).length,
  }, null, 2));
}
