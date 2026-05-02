import { redirect } from "next/navigation";
import { createServerSupabase } from "@/lib/supabase/server";

type Channel = { id: string; slug: string; name: string; description: string | null; organization_id: string };
type Message = {
  id: string;
  body: string;
  author_id: string;
  created_at: string | null;
  profiles: { full_name: string } | null;
};

async function postMessage(formData: FormData) {
  "use server";
  const channelId = formData.get("channelId") as string;
  const orgId = formData.get("orgId") as string;
  const body = (formData.get("body") as string)?.trim();
  if (!channelId || !body || !orgId) return;
  const supabase = await createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  await supabase.from("comments").insert({
    organization_id: orgId,
    author_id: user.id,
    target_table: "channel",
    target_id: channelId,
    body: body.substring(0, 2000),
  } as never);
  redirect(`/canal/${formData.get("slug")}`);
}

function dayLabel(d: Date): string {
  const today = new Date(); today.setHours(0,0,0,0);
  const yesterday = new Date(today); yesterday.setDate(today.getDate() - 1);
  const md = new Date(d); md.setHours(0,0,0,0);
  if (md.getTime() === today.getTime()) return "Hoje";
  if (md.getTime() === yesterday.getTime()) return "Ontem";
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" });
}

export default async function CanalPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const supabase = await createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();

  const { data: channelRaw } = await supabase
    .from("channels").select("id, slug, name, description, organization_id")
    .eq("slug", slug).maybeSingle();
  const channel = channelRaw as Channel | null;

  if (!channel) {
    return (
      <div style={{ padding: "32px 24px", maxWidth: 1024, margin: "0 auto" }}>
        <div className="empty">
          <div className="empty-emoji">🔍</div>
          <div style={{ fontSize: 16, color: "var(--o-text-1)", marginBottom: 4, fontWeight: 600 }}>
            Canal não encontrado
          </div>
          <div style={{ fontSize: 13 }}>
            O canal <strong>#{slug}</strong> não existe nesta organização.
          </div>
        </div>
      </div>
    );
  }

  const { data: messagesRaw } = await supabase
    .from("comments")
    .select("id, body, author_id, created_at, profiles(full_name)")
    .eq("target_table", "channel")
    .eq("target_id", channel.id)
    .order("created_at", { ascending: true });
  const messages = (messagesRaw ?? []) as unknown as Message[];

  // group by day
  const groups: { day: string; items: Message[] }[] = [];
  for (const m of messages) {
    const d = m.created_at ? new Date(m.created_at) : new Date();
    const label = dayLabel(d);
    const last = groups[groups.length - 1];
    if (!last || last.day !== label) groups.push({ day: label, items: [m] });
    else last.items.push(m);
  }

  return (
    <div style={{
      maxWidth: 960, margin: "0 auto", padding: "0 24px",
      display: "flex", flexDirection: "column",
      height: "calc(100vh - 56px)", // 56 do topbar
    }}>
      {/* Header do canal */}
      <div style={{
        padding: "20px 0 16px",
        borderBottom: "1px solid var(--o-border)",
        display: "flex", alignItems: "center", gap: 14,
      }}>
        <div style={{
          width: 44, height: 44, borderRadius: 10,
          background: "var(--t-brand-soft)",
          display: "grid", placeItems: "center",
          color: "var(--t-brand)",
          font: "700 20px var(--font-inter)",
          flexShrink: 0,
        }}>#</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <h1 style={{ margin: 0, font: "700 20px var(--font-inter)", letterSpacing: "-0.01em", color: "var(--o-text-1)" }}>
            {channel.name}
          </h1>
          {channel.description && (
            <p style={{ margin: "2px 0 0", fontSize: 13, color: "var(--o-text-2)" }}>{channel.description}</p>
          )}
        </div>
        <div style={{ fontSize: 12, color: "var(--o-text-3)" }} className="tnum">
          {messages.length} {messages.length === 1 ? "mensagem" : "mensagens"}
        </div>
      </div>

      {/* Mensagens */}
      <div style={{ flex: 1, overflowY: "auto", padding: "16px 4px", scrollBehavior: "smooth" }} className="light-scroll">
        {messages.length === 0 ? (
          <div className="empty" style={{ marginTop: 40 }}>
            <div className="empty-emoji">💬</div>
            <div style={{ fontSize: 16, color: "var(--o-text-1)", marginBottom: 4, fontWeight: 600 }}>
              Comece a conversa
            </div>
            <div style={{ fontSize: 13 }}>
              Envie a primeira mensagem em <strong>#{channel.name.toLowerCase()}</strong>.
            </div>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
            {groups.map((g, gi) => (
              <div key={gi}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, margin: "8px 0 12px" }}>
                  <div style={{ flex: 1, height: 1, background: "var(--o-border)" }} />
                  <span style={{
                    padding: "3px 10px",
                    fontSize: 11,
                    fontWeight: 600,
                    color: "var(--o-text-2)",
                    background: "var(--o-paper)",
                    border: "1px solid var(--o-border)",
                    borderRadius: 999,
                    textTransform: "uppercase",
                    letterSpacing: "0.05em",
                  }}>{g.day}</span>
                  <div style={{ flex: 1, height: 1, background: "var(--o-border)" }} />
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {g.items.map((m) => {
                    const name = m.profiles?.full_name ?? "?";
                    const initials = name.split(" ").map((s) => s[0]).slice(0, 2).join("").toUpperCase();
                    const isMe = user?.id === m.author_id;
                    return (
                      <div key={m.id} style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
                        <div style={{
                          width: 36, height: 36, borderRadius: 999,
                          background: isMe
                            ? "linear-gradient(135deg, var(--o-accent), var(--o-accent-h))"
                            : "linear-gradient(135deg, var(--t-brand), var(--t-brand-d))",
                          color: "white",
                          display: "grid", placeItems: "center",
                          font: "600 12px var(--font-inter)",
                          flexShrink: 0,
                          boxShadow: "var(--shadow-xs)",
                        }}>{initials}</div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 2 }}>
                            <span style={{ font: "600 13.5px var(--font-inter)", color: "var(--o-text-1)" }}>{name}</span>
                            {isMe && (
                              <span style={{ fontSize: 10, padding: "1px 6px", borderRadius: 999, background: "var(--o-accent-soft)", color: "var(--o-accent-h)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em" }}>
                                Você
                              </span>
                            )}
                            {m.created_at && (
                              <span style={{ fontSize: 11, color: "var(--o-text-3)" }}>
                                {new Date(m.created_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                              </span>
                            )}
                          </div>
                          <div style={{
                            fontSize: 14.5, lineHeight: 1.55,
                            whiteSpace: "pre-wrap",
                            color: "var(--o-text-1)",
                          }}>{m.body}</div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Composer */}
      <form action={postMessage} style={{
        padding: "12px 0 18px",
        borderTop: "1px solid var(--o-border)",
      }}>
        <input type="hidden" name="channelId" value={channel.id} />
        <input type="hidden" name="orgId" value={channel.organization_id} />
        <input type="hidden" name="slug" value={channel.slug} />
        <div style={{
          display: "flex", gap: 8, alignItems: "stretch",
          background: "var(--o-paper)",
          border: "1px solid var(--o-border)",
          borderRadius: 12,
          padding: 4,
          boxShadow: "var(--shadow-xs)",
          transition: "all var(--duration) var(--ease)",
        }}>
          <input
            name="body"
            placeholder={`Mensagem em #${channel.name.toLowerCase()}…`}
            required
            autoComplete="off"
            style={{
              flex: 1,
              background: "transparent",
              border: 0,
              padding: "10px 12px",
              font: "400 14.5px var(--font-inter)",
              color: "var(--o-text-1)",
              outline: "none",
            }}
          />
          <button type="submit" className="btn-brand" style={{ padding: "0 18px" }}>
            Enviar
          </button>
        </div>
      </form>
    </div>
  );
}
