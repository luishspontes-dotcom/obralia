import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const migrationsDir = join(root, "supabase", "migrations");

if (!existsSync(migrationsDir)) {
  fail([`Missing migrations directory: ${migrationsDir}`]);
}

const migrationFiles = readdirSync(migrationsDir)
  .filter((file) => file.endsWith(".sql"))
  .sort();

const sql = migrationFiles
  .map((file) => readFileSync(join(migrationsDir, file), "utf8"))
  .join("\n")
  .toLowerCase();

const failures = [];

function requireMatch(label, pattern) {
  if (!pattern.test(sql)) {
    failures.push(label);
  }
}

const rlsTables = [
  "organizations",
  "profiles",
  "organization_members",
  "sites",
  "wbs_items",
  "daily_reports",
  "report_activities",
  "report_workforce",
  "report_equipment",
  "media",
  "notifications",
  "comments",
  "channels",
  "pending_invites",
  "audit_events",
  "external_accounts",
  "sync_runs",
];

for (const table of rlsTables) {
  requireMatch(
    `RLS must be enabled on public.${table}`,
    new RegExp(
      `alter\\s+table\\s+public\\.${table}\\s+enable\\s+row\\s+level\\s+security`
    )
  );
}

const functions = [
  "current_user_orgs",
  "current_user_writer_orgs",
  "current_user_admin_orgs",
  "can_access_profile",
  "can_access_site",
  "can_write_site",
  "can_access_daily_report",
  "can_write_daily_report",
  "create_daily_report",
  "consume_pending_invites_for_user",
  "consume_pending_invites",
  "handle_new_user",
  "notify_daily_report_created",
  "notify_comment_mentions",
  "audit_log_event",
  "audit_site_changes",
  "audit_daily_report_changes",
  "audit_pending_invite_changes",
  "audit_media_created",
  "touch_updated_at",
  "audit_external_account_changes",
  "audit_sync_run_changes",
];

for (const functionName of functions) {
  requireMatch(
    `Function public.${functionName} must be versioned`,
    new RegExp(`create\\s+or\\s+replace\\s+function\\s+public\\.${functionName}\\s*\\(`)
  );
}

for (const functionName of [
  "current_user_orgs",
  "current_user_writer_orgs",
  "current_user_admin_orgs",
  "can_access_profile",
  "can_access_site",
  "can_write_site",
  "can_access_daily_report",
  "can_write_daily_report",
  "handle_new_user",
  "notify_daily_report_created",
  "notify_comment_mentions",
  "audit_log_event",
  "audit_site_changes",
  "audit_daily_report_changes",
  "audit_pending_invite_changes",
  "audit_media_created",
  "audit_external_account_changes",
  "audit_sync_run_changes",
]) {
  requireFunctionClause(functionName, /security\s+definer/);
  requireFunctionClause(functionName, /set\s+search_path\s*=\s*public/);
}

for (const bucket of ["media", "avatars", "exports"]) {
  requireMatch(
    `Storage bucket '${bucket}' must be private and versioned`,
    new RegExp(`\\('${bucket}',\\s*'${bucket}',\\s*false\\)`)
  );
}

const requiredPolicies = [
  "members read organizations",
  "admins manage organizations",
  "members read visible profiles",
  "users update own profile",
  "members read organization memberships",
  "admins manage organization memberships",
  "members read sites",
  "writers manage sites",
  "members read daily reports",
  "writers manage daily reports",
  "recipients read notifications",
  "members update own notifications",
  "members read comments",
  "members create comments",
  "authors update comments",
  "members read channels",
  "admins manage channels",
  "admins manage pending invites",
  "admins read audit events",
  "admins read external accounts",
  "admins manage external accounts",
  "admins read sync runs",
  "admins manage sync runs",
  "members read media objects",
  "writers manage media objects",
  "users read own avatar objects",
  "users manage own avatar objects",
  "admins read export objects",
];

for (const policy of requiredPolicies) {
  requireMatch(
    `Policy '${policy}' must be versioned`,
    new RegExp(`create\\s+policy\\s+"${escapeRegExp(policy.toLowerCase())}"`)
  );
}

requireMatch(
  "Auth signup trigger must be attached to auth.users",
  /create\s+trigger\s+on_auth_user_created[\s\S]*after\s+insert\s+on\s+auth\.users/
);
requireMatch(
  "Daily report notification trigger must be attached",
  /create\s+trigger\s+on_daily_report_created_notify[\s\S]*on\s+public\.daily_reports/
);
requireMatch(
  "Comment mention notification trigger must be attached",
  /create\s+trigger\s+on_comment_mentions_notify[\s\S]*on\s+public\.comments/
);
requireMatch(
  "Site audit trigger must be attached",
  /create\s+trigger\s+on_sites_audit[\s\S]*on\s+public\.sites/
);
requireMatch(
  "Daily report audit trigger must be attached",
  /create\s+trigger\s+on_daily_reports_audit[\s\S]*on\s+public\.daily_reports/
);
requireMatch(
  "Pending invite audit trigger must be attached",
  /create\s+trigger\s+on_pending_invites_audit[\s\S]*on\s+public\.pending_invites/
);
requireMatch(
  "Media audit trigger must be attached",
  /create\s+trigger\s+on_media_audit[\s\S]*on\s+public\.media/
);
requireMatch(
  "External account audit trigger must be attached",
  /create\s+trigger\s+on_external_accounts_audit[\s\S]*on\s+public\.external_accounts/
);
requireMatch(
  "Sync run audit trigger must be attached",
  /create\s+trigger\s+on_sync_runs_audit[\s\S]*on\s+public\.sync_runs/
);
requireMatch(
  "Asana external provider must be accepted by schema",
  /provider\s+in\s+\('clickup',\s*'diario_de_obra',\s*'asana'\)/
);

if (failures.length > 0) {
  fail(failures);
}

console.log(
  `Schema contract OK: ${migrationFiles.length} migrations checked, ${rlsTables.length} RLS tables verified.`
);

function requireFunctionClause(functionName, pattern) {
  const functionPattern = new RegExp(
    `create\\s+or\\s+replace\\s+function\\s+public\\.${functionName}\\s*\\([\\s\\S]*?\\$\\$;`
  );
  const match = sql.match(functionPattern);

  if (!match || !pattern.test(match[0])) {
    failures.push(`Function public.${functionName} must include ${pattern}`);
  }
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function fail(messages) {
  console.error("Schema contract failed:");
  for (const message of messages) {
    console.error(`- ${message}`);
  }
  process.exit(1);
}
