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
      <div style={{ padding: "24px", maxWidth: 1280, margin: "0 auto" }}>
        <h1 style={{ font: "700 28px var(--font-inter)" }}>Canal não encontrado</h1>
        <p style={{ color: "var(--o-text-2)" }}>O canal #{slug} não existe nesta organização.</p>
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

  return (
    <div style={{ padding: "24px", maxWidth: 1024, margin: "0 auto", display: "flex", flexDirection: "column", height: "calc(100vh - 24px)" }}>
      <div style={{ marginBottom: 16, paddingBottom: 14, borderBottom: "1px solid var(--o-border)" }}>
        <h1 style={{ margin: 0, font: "700 22px var(--font-inter)", letterSpacing: "-0.02em" }}>
          # {channel.name}
        </h1>
        {channel.description && (
          <p style={{ margin: "4px 0 0", fontSize: 13, color: "var(--o-text-2)" }}>{channel.description}</p>
        )}
      </div>

      <div style={{ flex: 1, overflowY: "auto", paddingRight: 8 }}>
        {messages.length === 0 ? (
          <div style={{ padding: 48, textAlign: "center", color: "var(--o-text-2)", fontSize: 14 }}>
            Comece a conversa enviando a primeira mensagem.
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {messages.map((m) => {
              const name = m.profiles?.full_name ?? "?";
              const initials = name.split(" ").map((s) => s[0]).slice(0, 2).join("").toUpperCase();
              const isMe = user?.id === m.author_id;
              return (
                <div key={m.id} style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
                  <div style={{
                    width: 32, height: 32, borderRadius: 999,
                    background: isMe ? "linear-gradient(135deg, #D97757, #C66946)" : "linear-gradient(135deg, #08789B, #054F66)",
                    color: "white",
                    display: "grid", placeItems: "center",
                    font: "600 11px var(--font-inter)",
                    flexShrink: 0,
                  }}>{initials}</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
                      <span style={{ font: "600 13px var(--font-inter)" }}>{name}</span>
                      {m.created_at && (
                        <span style={{ fontSize: 11, color: "var(--o-text-3)" }}>
                          {new Date(m.created_at).toLocaleString("pt-BR", { hour: "2-digit", minute: "2-digit", day: "2-digit", month: "short" })}
                        </span>
                      )}
                    </div>
                    <div style={{ fontSize: 14, lineHeight: 1.5, whiteSpace: "pre-wrap", marginTop: 2 }}>{m.body}</div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <form action={postMessage} style={{
        marginTop: 16,
        paddingTop: 12,
        borderTop: "1px solid var(--o-border)",
      }}>
        <input type="hidden" name="channelId" value={channel.id} />
        <input type="hidden" name="orgId" value={channel.organization_id} />
        <input type="hidden" name="slug" value={channel.slug} />
        <div style={{ display: "flex", gap: 8 }}>
          <input
            name="body"
            placeholder={`Mensagem em #${channel.name.toLowerCase()}…`}
            required
            style={{
              flex: 1,
              background: "var(--o-cream)",
              border: "1px solid var(--o-border)",
              borderRadius: 10,
              padding: "10px 14px",
              font: "400 14px var(--font-inter)",
              color: "var(--o-text-1)",
              outline: "none",
            }}
          />
          <button type="submit" style={{
            padding: "0 18px",
            background: "var(--o-accent)",
            color: "white",
            border: 0,
            borderRadius: 10,
            font: "600 14px var(--font-inter)",
            cursor: "pointer",
          }}>Enviar</button>
        </div>
      </form>
    </div>
  );
}
