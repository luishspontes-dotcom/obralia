import Link from "next/link";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createServerSupabase } from "@/lib/supabase/server";

type Notification = {
  id: string;
  kind: string;
  title: string;
  body: string | null;
  link: string | null;
  read_at: string | null;
  created_at: string | null;
};
type RDOReview = {
  id: string;
  number: number;
  date: string;
  site_id: string;
  status: string;
};
type LateTask = {
  id: string;
  name: string;
  site_id: string;
  due_date: string | null;
};
type SiteRow = { id: string; name: string };

async function markNotificationReadAction(formData: FormData) {
  "use server";

  const notificationId = (formData.get("notificationId") as string)?.trim();
  if (!notificationId) return;

  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  await supabase
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("id", notificationId)
    .eq("recipient_id", user.id)
    .is("archived_at", null);

  revalidatePath("/caixa");
  revalidatePath("/inicio");
}

async function archiveNotificationAction(formData: FormData) {
  "use server";

  const notificationId = (formData.get("notificationId") as string)?.trim();
  if (!notificationId) return;

  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  await supabase
    .from("notifications")
    .update({ archived_at: new Date().toISOString() })
    .eq("id", notificationId)
    .eq("recipient_id", user.id);

  revalidatePath("/caixa");
  revalidatePath("/inicio");
}

async function markAllNotificationsReadAction() {
  "use server";

  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  await supabase
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("recipient_id", user.id)
    .is("read_at", null)
    .is("archived_at", null);

  revalidatePath("/caixa");
  revalidatePath("/inicio");
}

export default async function CaixaPage() {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: notificationsRaw } = await supabase
    .from("notifications")
    .select("id, kind, title, body, link, read_at, created_at")
    .eq("recipient_id", user.id)
    .is("archived_at", null)
    .order("created_at", { ascending: false })
    .limit(80);
  const notifications = (notificationsRaw ?? []) as Notification[];
  const unreadNotifications = notifications.filter(
    (notification) => !notification.read_at
  );

  // RDOs aguardando revisão
  const { data: pendingR } = await supabase
    .from("daily_reports")
    .select("id, number, date, site_id, status")
    .in("status", ["draft", "review"])
    .order("date", { ascending: false })
    .limit(50);
  const pendingRDOs = (pendingR ?? []) as RDOReview[];

  // Atividades atrasadas
  const { data: lateR } = await supabase
    .from("wbs_items")
    .select("id, name, site_id, due_date")
    .eq("status", "late")
    .not("parent_id", "is", null)
    .order("due_date", { ascending: true })
    .limit(50);
  const lateTasks = (lateR ?? []) as LateTask[];

  // Map sites
  const siteIds = new Set<string>([
    ...pendingRDOs.map((r) => r.site_id),
    ...lateTasks.map((t) => t.site_id),
  ]);
  const { data: sitesR } = await supabase
    .from("sites")
    .select("id, name")
    .in("id", Array.from(siteIds));
  const sites = new Map(((sitesR ?? []) as SiteRow[]).map((s) => [s.id, s.name]));

  return (
    <div style={{ padding: "24px", maxWidth: 1280, margin: "0 auto" }}>
      <h1 style={{ margin: "0 0 4px", font: "700 28px var(--font-inter)", letterSpacing: "-0.02em" }}>
        Caixa de entrada
      </h1>
      <p style={{ margin: "0 0 24px", fontSize: 14, color: "var(--o-text-2)" }}>
        {unreadNotifications.length + pendingRDOs.length + lateTasks.length} itens precisam da sua atenção
      </p>

      {notifications.length > 0 && (
        <Section
          action={
            unreadNotifications.length > 0 ? (
              <form action={markAllNotificationsReadAction}>
                <button type="submit" style={ghostButtonStyle}>
                  Marcar todas como lidas
                </button>
              </form>
            ) : null
          }
          title={`Notificações · ${unreadNotifications.length} não ${unreadNotifications.length === 1 ? "lida" : "lidas"}`}
        >
          <List>
            {notifications.map((notification, index) => (
              <div
                key={notification.id}
                style={{
                  ...rowStyle,
                  borderTop: index === 0 ? "none" : "1px solid var(--o-border)",
                  background: notification.read_at
                    ? "transparent"
                    : "rgba(8, 120, 155, 0.04)",
                }}
              >
                <span
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: 999,
                    background: notification.read_at
                      ? "var(--o-border)"
                      : "var(--t-brand)",
                    flex: "0 0 auto",
                  }}
                />
                <Link
                  href={notification.link ?? "/caixa"}
                  style={{ flex: 1, color: "inherit", textDecoration: "none" }}
                >
                  <div style={{ fontWeight: notification.read_at ? 500 : 700 }}>
                    {notification.title}
                  </div>
                  {notification.body && (
                    <div style={{ fontSize: 12, color: "var(--o-text-2)", marginTop: 2 }}>
                      {notification.body}
                    </div>
                  )}
                  {notification.created_at && (
                    <div style={{ fontSize: 11, color: "var(--o-text-3)", marginTop: 4 }}>
                      {new Date(notification.created_at).toLocaleString("pt-BR")}
                    </div>
                  )}
                </Link>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  {!notification.read_at && (
                    <form action={markNotificationReadAction}>
                      <input type="hidden" name="notificationId" value={notification.id} />
                      <button type="submit" style={ghostButtonStyle}>
                        Lida
                      </button>
                    </form>
                  )}
                  <form action={archiveNotificationAction}>
                    <input type="hidden" name="notificationId" value={notification.id} />
                    <button type="submit" style={ghostButtonStyle}>
                      Arquivar
                    </button>
                  </form>
                </div>
              </div>
            ))}
          </List>
        </Section>
      )}

      {pendingRDOs.length > 0 && (
        <Section title={`RDOs aguardando aprovação · ${pendingRDOs.length}`}>
          <List>
            {pendingRDOs.map((r) => (
              <Link
                key={r.id}
                href={`/obras/${r.site_id}/rdos/${r.id}`}
                style={rowStyle}
              >
                <span className="tnum" style={{ fontWeight: 600, color: "var(--t-brand)", minWidth: 60 }}>
                  #{r.number}
                </span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 500 }}>{sites.get(r.site_id) ?? "Obra"}</div>
                  <div style={{ fontSize: 12, color: "var(--o-text-3)" }}>
                    {new Date(r.date).toLocaleDateString("pt-BR")}
                  </div>
                </div>
                <span style={pillStyle("var(--st-progress)")}>
                  {r.status === "draft" ? "Rascunho" : "Em revisão"}
                </span>
              </Link>
            ))}
          </List>
        </Section>
      )}

      {lateTasks.length > 0 && (
        <Section title={`Atividades atrasadas · ${lateTasks.length}`}>
          <List>
            {lateTasks.map((t) => (
              <Link key={t.id} href={`/obras/${t.site_id}`} style={rowStyle}>
                <span style={{ fontSize: 16 }}>⚠</span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 500 }}>{t.name}</div>
                  <div style={{ fontSize: 12, color: "var(--o-text-3)" }}>
                    {sites.get(t.site_id) ?? "Obra"}
                  </div>
                </div>
                {t.due_date && (
                  <span style={{ fontSize: 12, color: "var(--st-late)" }}>
                    venceu {new Date(t.due_date).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })}
                  </span>
                )}
              </Link>
            ))}
          </List>
        </Section>
      )}

      {notifications.length === 0 && pendingRDOs.length === 0 && lateTasks.length === 0 && (
        <div style={{ background: "var(--o-paper)", border: "1px solid var(--o-border)", borderRadius: 12, padding: 48, textAlign: "center", color: "var(--o-text-2)" }}>
          Tudo em dia! Nenhum item pendente.
        </div>
      )}
    </div>
  );
}

const rowStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 14,
  padding: "12px 18px",
  borderTop: "1px solid var(--o-border)",
  fontSize: 14,
  textDecoration: "none",
  color: "inherit",
};

const ghostButtonStyle: React.CSSProperties = {
  border: "1px solid var(--o-border)",
  background: "var(--o-paper)",
  color: "var(--o-text-2)",
  borderRadius: 8,
  padding: "6px 10px",
  font: "600 12px var(--font-inter)",
  cursor: "pointer",
};

const pillStyle = (color: string): React.CSSProperties => ({
  padding: "3px 10px",
  background: `${color}15`,
  color,
  borderRadius: 999,
  fontSize: 11,
  fontWeight: 500,
});

function Section({
  title,
  action,
  children,
}: {
  title: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div style={{ marginBottom: 24 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, marginBottom: 12 }}>
        <h3 style={{ font: "600 12px var(--font-inter)", textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--o-text-3)", margin: 0 }}>
          {title}
        </h3>
        {action}
      </div>
      {children}
    </div>
  );
}

function List({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ background: "var(--o-paper)", border: "1px solid var(--o-border)", borderRadius: 12, overflow: "hidden" }}>
      <div>{children}</div>
    </div>
  );
}
