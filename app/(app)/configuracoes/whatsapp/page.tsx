import Link from "next/link";
import { redirect } from "next/navigation";
import { createServerSupabase } from "@/lib/supabase/server";
import { untypedDb } from "@/lib/supabase/untyped";
import { canAdmin } from "@/lib/authz";
import { VISIBLE_SOURCE_PROVIDERS } from "@/lib/rdo-source-scope";
import {
  addWhatsappSender,
  removeWhatsappSender,
  toggleWhatsappSender,
} from "@/lib/whatsapp-admin-actions";

type Profile = { id: string; default_org_id: string | null };
type Org = { id: string; name: string };
type Membership = { role: string };
type Site = { id: string; name: string };

type SenderRow = {
  id: string;
  phone: string;
  display_name: string | null;
  default_site_id: string | null;
  active: boolean;
  created_at: string | null;
};

type MessageRow = {
  id: string;
  sender_id: string | null;
  site_id: string | null;
  daily_report_id: string | null;
  from_phone: string;
  kind: string;
  status: string;
  error: string | null;
  created_at: string | null;
};

const KIND_LABEL: Record<string, string> = {
  text: "Texto",
  audio: "Áudio",
  image: "Foto",
  video: "Vídeo",
  document: "Documento",
  other: "Outro",
};

const STATUS_META: Record<string, { label: string; color: string; bg: string }> = {
  received: { label: "Recebida", color: "var(--o-text-2)", bg: "rgba(0,0,0,0.04)" },
  processed: { label: "Processada", color: "var(--st-done)", bg: "rgba(34, 139, 34, 0.08)" },
  ignored: { label: "Ignorada", color: "var(--o-text-3)", bg: "rgba(0,0,0,0.04)" },
  error: { label: "Erro", color: "var(--st-late)", bg: "rgba(220, 38, 38, 0.08)" },
};

function formatPhone(digits: string): string {
  // 5541999998888 → +55 41 99999-8888 (best-effort)
  const m = /^55(\d{2})(\d{4,5})(\d{4})$/.exec(digits);
  if (m) return `+55 ${m[1]} ${m[2]}-${m[3]}`;
  return `+${digits}`;
}

function formatDateTime(value?: string | null): string {
  if (!value) return "—";
  return new Date(value).toLocaleString("pt-BR", {
    timeZone: "America/Sao_Paulo",
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default async function WhatsappConfigPage() {
  const supabase = await createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profileR } = await supabase
    .from("profiles").select("id, default_org_id").eq("id", user.id).maybeSingle();
  const profile = profileR as Profile | null;

  const { data: orgsR } = await supabase.from("organizations").select("id, name");
  const orgs = (orgsR ?? []) as Org[];
  const activeOrg = orgs.find((o) => o.id === profile?.default_org_id) ?? orgs[0] ?? null;
  if (!activeOrg) redirect("/configuracoes");

  const { data: membershipR } = await supabase
    .from("organization_members")
    .select("role")
    .eq("organization_id", activeOrg.id)
    .eq("profile_id", user.id)
    .maybeSingle();
  if (!canAdmin((membershipR as Membership | null)?.role)) {
    redirect("/configuracoes");
  }

  const db = untypedDb(supabase);

  const [sendersR, messagesR, sitesR] = await Promise.all([
    db.from<SenderRow[]>("whatsapp_senders")
      .select("id, phone, display_name, default_site_id, active, created_at")
      .eq("organization_id", activeOrg.id)
      .order("created_at", { ascending: true }),
    db.from<MessageRow[]>("whatsapp_messages")
      .select("id, sender_id, site_id, daily_report_id, from_phone, kind, status, error, created_at")
      .eq("organization_id", activeOrg.id)
      .order("created_at", { ascending: false })
      .limit(20),
    supabase
      .from("sites")
      .select("id, name")
      .eq("organization_id", activeOrg.id)
      .in("external_provider", VISIBLE_SOURCE_PROVIDERS)
      .order("name", { ascending: true }),
  ]);

  const senders = (sendersR.data ?? []) as unknown as SenderRow[];
  const messages = (messagesR.data ?? []) as unknown as MessageRow[];
  const sites = ((sitesR.data ?? []) as Site[]);
  const siteName = new Map(sites.map((s) => [s.id, s.name]));
  const senderName = new Map(senders.map((s) => [s.id, s.display_name ?? formatPhone(s.phone)]));

  return (
    <div style={{ padding: "24px", maxWidth: 1040, margin: "0 auto" }}>
      <div style={{ marginBottom: 18 }}>
        <Link href="/configuracoes" style={{ color: "var(--o-text-2)", textDecoration: "none", fontSize: 14 }}>
          Configurações
        </Link>
        <span style={{ color: "var(--o-text-3)", margin: "0 8px" }}>/</span>
        <span style={{ color: "var(--o-text-1)", fontSize: 14 }}>WhatsApp</span>
      </div>

      <div style={{ marginBottom: 24 }}>
        <h1 style={{ margin: "0 0 4px", font: "700 28px var(--font-inter)", letterSpacing: "-0.02em" }}>
          📱 WhatsApp da obra
        </h1>
        <p style={{ margin: 0, color: "var(--o-text-2)", fontSize: 14 }}>
          O mestre de obras manda texto, áudio ou foto no WhatsApp e o Obralia lança tudo no RDO do dia — organização {activeOrg.name}.
        </p>
      </div>

      {/* ── Como conectar ── */}
      <Section title="Como conectar">
        <ol style={{ margin: 0, paddingLeft: 20, color: "var(--o-text-1)", fontSize: 14, lineHeight: 1.9 }}>
          <li>Pegue um chip dedicado para o número do bot (pode ser pré-pago).</li>
          <li>No painel da Evolution API (no VPS), crie a instância e leia o QR Code com o WhatsApp desse chip.</li>
          <li>Cadastre abaixo os telefones autorizados, cada um com sua obra padrão.</li>
          <li>Pronto: quem estiver cadastrado manda mensagem pro número do bot e o RDO do dia é preenchido sozinho.</li>
        </ol>
        <p style={{ margin: "12px 0 0", color: "var(--o-text-3)", fontSize: 12 }}>
          Texto vira anotação, áudio é transcrito e estruturado pela IA (atividades, equipe, materiais, clima) e foto entra na galeria do RDO.
        </p>
      </Section>

      {/* ── Números autorizados ── */}
      <Section title="Números autorizados">
        {senders.length === 0 ? (
          <p style={{ margin: "0 0 16px", color: "var(--o-text-2)", fontSize: 14 }}>
            Nenhum número cadastrado ainda. Mensagens de números desconhecidos são ignoradas.
          </p>
        ) : (
          <div style={{ overflowX: "auto", marginBottom: 16 }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
              <thead>
                <tr>
                  <Th>Telefone</Th>
                  <Th>Nome</Th>
                  <Th>Obra padrão</Th>
                  <Th>Status</Th>
                  <Th>Ações</Th>
                </tr>
              </thead>
              <tbody>
                {senders.map((s) => (
                  <tr key={s.id} style={{ borderTop: "1px solid var(--o-border)" }}>
                    <Td mono>{formatPhone(s.phone)}</Td>
                    <Td>{s.display_name ?? "—"}</Td>
                    <Td>{s.default_site_id ? (siteName.get(s.default_site_id) ?? "Obra removida") : "—"}</Td>
                    <Td>
                      <Pill
                        label={s.active ? "Ativo" : "Inativo"}
                        color={s.active ? "var(--st-done)" : "var(--o-text-3)"}
                        bg={s.active ? "rgba(34, 139, 34, 0.08)" : "rgba(0,0,0,0.04)"}
                      />
                    </Td>
                    <Td>
                      <div style={{ display: "flex", gap: 8 }}>
                        <form action={toggleWhatsappSender}>
                          <input type="hidden" name="id" value={s.id} />
                          <input type="hidden" name="next_active" value={s.active ? "false" : "true"} />
                          <SmallButton>{s.active ? "Desativar" : "Ativar"}</SmallButton>
                        </form>
                        <form action={removeWhatsappSender}>
                          <input type="hidden" name="id" value={s.id} />
                          <SmallButton danger>Remover</SmallButton>
                        </form>
                      </div>
                    </Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Form adicionar */}
        <form
          action={addWhatsappSender}
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr 1fr auto",
            gap: 10,
            alignItems: "end",
            paddingTop: 14,
            borderTop: "1px solid var(--o-border)",
          }}
        >
          <label style={labelStyle}>
            Telefone (DDI+DDD)
            <input name="phone" required placeholder="5541999998888" inputMode="numeric" style={inputStyle} />
          </label>
          <label style={labelStyle}>
            Nome
            <input name="display_name" placeholder="Mestre João" style={inputStyle} />
          </label>
          <label style={labelStyle}>
            Obra padrão
            <select name="default_site_id" required defaultValue="" style={inputStyle}>
              <option value="" disabled>Selecione a obra…</option>
              {sites.map((site) => (
                <option key={site.id} value={site.id}>{site.name}</option>
              ))}
            </select>
          </label>
          <button
            type="submit"
            style={{
              padding: "10px 18px",
              background: "var(--t-brand)",
              color: "white",
              border: "none",
              borderRadius: "var(--r)",
              fontSize: 13,
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Adicionar
          </button>
        </form>
      </Section>

      {/* ── Últimas mensagens ── */}
      <Section title="Últimas mensagens (20)">
        {messages.length === 0 ? (
          <p style={{ margin: 0, color: "var(--o-text-2)", fontSize: 14 }}>
            Nenhuma mensagem recebida ainda.
          </p>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr>
                  <Th>Quando</Th>
                  <Th>De quem</Th>
                  <Th>Tipo</Th>
                  <Th>Status</Th>
                  <Th>RDO</Th>
                </tr>
              </thead>
              <tbody>
                {messages.map((m) => {
                  const meta = STATUS_META[m.status] ?? STATUS_META.received;
                  const who = (m.sender_id && senderName.get(m.sender_id)) || formatPhone(m.from_phone);
                  return (
                    <tr key={m.id} style={{ borderTop: "1px solid var(--o-border)" }}>
                      <Td mono>{formatDateTime(m.created_at)}</Td>
                      <Td>{who}</Td>
                      <Td>{KIND_LABEL[m.kind] ?? m.kind}</Td>
                      <Td>
                        <Pill label={meta.label} color={meta.color} bg={meta.bg} />
                        {m.status === "error" && m.error && (
                          <div style={{ color: "var(--st-late)", fontSize: 11, marginTop: 4, maxWidth: 280 }}>
                            {m.error}
                          </div>
                        )}
                      </Td>
                      <Td>
                        {m.daily_report_id && m.site_id ? (
                          <Link
                            href={`/obras/${m.site_id}/rdos/${m.daily_report_id}`}
                            style={{ color: "var(--t-brand)", fontWeight: 600, textDecoration: "none" }}
                          >
                            Abrir RDO →
                          </Link>
                        ) : (
                          <span style={{ color: "var(--o-text-3)" }}>—</span>
                        )}
                      </Td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Section>
    </div>
  );
}

/* ───────── UI helpers (mesmo visual de configuracoes/integracoes) ───────── */

const labelStyle: React.CSSProperties = {
  display: "grid",
  gap: 6,
  color: "var(--o-text-2)",
  fontSize: 12,
  fontWeight: 600,
};

const inputStyle: React.CSSProperties = {
  padding: "9px 12px",
  border: "1px solid var(--o-border)",
  borderRadius: "var(--r)",
  fontSize: 14,
  fontFamily: "inherit",
  background: "var(--o-paper)",
  color: "var(--o-text-1)",
};

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

function Th({ children }: { children: React.ReactNode }) {
  return (
    <th style={{ textAlign: "left", padding: "8px 10px", color: "var(--o-text-3)", fontSize: 11, textTransform: "uppercase", letterSpacing: "0.06em" }}>
      {children}
    </th>
  );
}

function Td({ children, mono }: { children: React.ReactNode; mono?: boolean }) {
  return (
    <td style={{
      padding: "10px",
      color: "var(--o-text-1)",
      fontFamily: mono ? "ui-monospace, monospace" : undefined,
      fontSize: mono ? 12 : undefined,
      verticalAlign: "top",
    }}>
      {children}
    </td>
  );
}

function Pill({ label, color, bg }: { label: string; color: string; bg: string }) {
  return (
    <span style={{
      display: "inline-flex",
      alignItems: "center",
      padding: "4px 8px",
      borderRadius: 999,
      background: bg,
      color,
      font: "600 11px var(--font-inter)",
      whiteSpace: "nowrap",
    }}>
      {label}
    </span>
  );
}

function SmallButton({ children, danger }: { children: React.ReactNode; danger?: boolean }) {
  return (
    <button
      type="submit"
      style={{
        padding: "6px 12px",
        background: "transparent",
        color: danger ? "var(--st-late)" : "var(--o-text-1)",
        border: `1px solid ${danger ? "var(--st-late)" : "var(--o-border)"}`,
        borderRadius: "var(--r)",
        fontSize: 12,
        fontWeight: 600,
        cursor: "pointer",
      }}
    >
      {children}
    </button>
  );
}
