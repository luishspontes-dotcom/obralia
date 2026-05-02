import Link from "next/link";

export const metadata = { title: "Política de privacidade · Obralia" };

export default function PrivacidadePage() {
  return (
    <div style={{
      maxWidth: 760, margin: "0 auto", padding: "48px 32px 80px",
      fontFamily: "var(--font-inter, system-ui)", color: "#141c2a", lineHeight: 1.6,
    }}>
      <Link href="/" style={{ color: "#08789B", textDecoration: "none", fontSize: 14 }}>← Voltar</Link>
      <h1 style={{ font: "700 36px var(--font-inter)", letterSpacing: "-0.025em", margin: "20px 0 8px" }}>
        Política de privacidade
      </h1>
      <p style={{ color: "#4a5568", fontSize: 13, marginBottom: 32 }}>
        Última atualização: 02 de maio de 2026 · Em conformidade com a LGPD (Lei 13.709/2018)
      </p>

      <Section title="1. Dados que coletamos">
        Coletamos apenas o necessário para o serviço funcionar:
        <ul style={{ marginTop: 8, paddingLeft: 20 }}>
          <li><strong>Identificação:</strong> nome completo, e-mail.</li>
          <li><strong>Conteúdo da obra:</strong> RDOs, atividades, mão de obra, fotos, comentários — fornecidos por você.</li>
          <li><strong>Geolocalização:</strong> só se você habilitar GPS na câmera; fica salva nos metadados da foto.</li>
          <li><strong>Logs técnicos:</strong> IP, user-agent, timestamps das requisições para auditoria e diagnóstico.</li>
        </ul>
      </Section>

      <Section title="2. Por que coletamos">
        <ul style={{ marginTop: 8, paddingLeft: 20 }}>
          <li>Operar o serviço (login, sincronização, geração de PDF, busca, mapas).</li>
          <li>Auditoria — saber quem aprovou/editou cada RDO.</li>
          <li>Suporte técnico — investigar problemas que você relatar.</li>
        </ul>
        Não usamos seus dados para publicidade ou venda a terceiros.
      </Section>

      <Section title="3. Quem tem acesso">
        Apenas membros da sua organização (com base no role) e a equipe técnica da Obralia,
        sob acordo de confidencialidade. Subprocessadores:
        <ul style={{ marginTop: 8, paddingLeft: 20 }}>
          <li><strong>Supabase</strong> (banco e storage) — datacenters AWS.</li>
          <li><strong>Vercel</strong> (hospedagem da aplicação) — datacenters AWS.</li>
          <li><strong>Sentry</strong> (monitoramento de erros, opcional).</li>
        </ul>
      </Section>

      <Section title="4. Por quanto tempo guardamos">
        Enquanto sua organização estiver ativa. Após cancelamento, dados ficam disponíveis para
        exportação por 30 dias e em seguida são deletados, exceto:
        <ul style={{ marginTop: 8, paddingLeft: 20 }}>
          <li>Logs de auditoria por até 5 anos (obrigação legal).</li>
          <li>Dados anonimizados para estatísticas de uso agregadas.</li>
        </ul>
      </Section>

      <Section title="5. Seus direitos (LGPD art. 18)">
        Você pode a qualquer momento solicitar:
        <ul style={{ marginTop: 8, paddingLeft: 20 }}>
          <li>Acesso aos seus dados.</li>
          <li>Correção de dados incorretos.</li>
          <li>Anonimização ou exclusão.</li>
          <li>Portabilidade (exportação em CSV, JSON).</li>
          <li>Revogação do consentimento.</li>
        </ul>
        Solicitações: <a href="mailto:luishspontes@gmail.com" style={{ color: "#08789B" }}>luishspontes@gmail.com</a>.
        Resposta em até 15 dias úteis.
      </Section>

      <Section title="6. Segurança">
        TLS em todas as conexões. Senhas com hash bcrypt. Row-Level Security no banco impede
        que organizações vejam dados umas das outras. Acesso da equipe técnica via auth com 2FA.
        Backup automático diário com retenção de 7 dias.
      </Section>

      <Section title="7. Cookies">
        Usamos apenas cookies essenciais (sessão de login). Não usamos cookies de tracking,
        analytics de terceiros nem fingerprinting.
      </Section>

      <Section title="8. Encarregado (DPO)">
        Luis Henrique Spontes — <a href="mailto:luishspontes@gmail.com" style={{ color: "#08789B" }}>luishspontes@gmail.com</a>
      </Section>

      <p style={{ marginTop: 48, fontSize: 13, color: "#4a5568" }}>
        Esta política pode ser atualizada. Avisaremos com 30 dias de antecedência sobre
        qualquer mudança relevante.
      </p>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 28 }}>
      <h2 style={{ font: "600 17px var(--font-inter)", margin: "0 0 8px", color: "#08789B" }}>{title}</h2>
      <div style={{ fontSize: 14.5 }}>{children}</div>
    </div>
  );
}
