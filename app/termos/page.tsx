import Link from "next/link";

export const metadata = { title: "Termos de uso · Obralia" };

export default function TermosPage() {
  return (
    <div style={{
      maxWidth: 760, margin: "0 auto", padding: "48px 32px 80px",
      fontFamily: "var(--font-inter, system-ui)", color: "#141c2a", lineHeight: 1.6,
    }}>
      <Link href="/" style={{ color: "#08789B", textDecoration: "none", fontSize: 14 }}>← Voltar</Link>
      <h1 style={{ font: "700 36px var(--font-inter)", letterSpacing: "-0.025em", margin: "20px 0 8px" }}>
        Termos de uso
      </h1>
      <p style={{ color: "#4a5568", fontSize: 13, marginBottom: 32 }}>
        Última atualização: 02 de maio de 2026
      </p>

      <Section title="1. Quem somos">
        Obralia é um sistema multi-tenant para construtoras gerenciarem obras, RDOs (Relatório Diário
        de Obra), cronograma, fotos e equipe. Operado por Luis Henrique Spontes ME, doravante &ldquo;Obralia&rdquo;.
      </Section>

      <Section title="2. Cadastro e conta">
        Apenas construtoras convidadas têm acesso. Cada usuário é vinculado a uma organização e
        recebe um papel (Owner, Admin, Engenheiro, Visualizador). É proibido compartilhar credenciais.
        Você é responsável por manter senha segura e por toda atividade na sua conta.
      </Section>

      <Section title="3. Uso aceitável">
        Você concorda em não: (a) tentar acessar dados de outras organizações; (b) explorar
        vulnerabilidades; (c) utilizar a plataforma para atividades ilegais; (d) tentar contornar
        limites de uso. Violações implicam suspensão imediata.
      </Section>

      <Section title="4. Conteúdo do cliente">
        Fotos, RDOs, atividades e demais dados que você inserir são seus. A Obralia tem licença
        limitada apenas para armazenar, exibir e processar esse conteúdo dentro do serviço.
        Você pode exportar (CSV, PDF) ou solicitar exclusão a qualquer momento.
      </Section>

      <Section title="5. Disponibilidade">
        O serviço é fornecido &ldquo;como está&rdquo;. Buscamos uptime de 99,5% mas não garantimos.
        Manutenções programadas serão comunicadas com 48 h de antecedência sempre que possível.
        Backup automatizado de dados via Supabase PITR.
      </Section>

      <Section title="6. Pagamento e cancelamento">
        Plano e preço acordados em contrato separado. Cancelamento implica perda de acesso após o
        último ciclo pago; dados ficam disponíveis para exportação por 30 dias antes da exclusão.
      </Section>

      <Section title="7. Limitação de responsabilidade">
        A responsabilidade total da Obralia, em qualquer caso, fica limitada ao valor pago pelo
        cliente nos últimos 12 meses. Não nos responsabilizamos por lucros cessantes ou danos
        indiretos decorrentes do uso ou indisponibilidade do serviço.
      </Section>

      <Section title="8. Alterações">
        Estes termos podem ser atualizados. Mudanças relevantes serão comunicadas com 30 dias
        de antecedência. Continuar usando após o aviso significa concordância.
      </Section>

      <Section title="9. Foro">
        Fica eleito o foro da comarca de Brasília/DF para dirimir quaisquer questões decorrentes
        deste contrato, com renúncia expressa de qualquer outro, por mais privilegiado que seja.
      </Section>

      <p style={{ marginTop: 48, fontSize: 13, color: "#4a5568" }}>
        Dúvidas? Escreva para{" "}
        <a href="mailto:luishspontes@gmail.com" style={{ color: "#08789B" }}>luishspontes@gmail.com</a>.
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
