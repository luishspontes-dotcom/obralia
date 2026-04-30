import { EmBreve } from "@/components/layout/EmBreve";

export default function NovaObraPage() {
  return (
    <EmBreve
      title="Nova obra"
      description="Em breve: criar obra direto pelo Obralia, com responsável, cronograma, contrato e WBS inicial. Por enquanto crie no ClickUp/Diário e a sincronização traz pra cá."
      emoji="🏗"
      cta={{ label: "Voltar pras obras", href: "/obras" }}
    />
  );
}
