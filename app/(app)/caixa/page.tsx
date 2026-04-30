import { EmBreve } from "@/components/layout/EmBreve";

export default function CaixaPage() {
  return (
    <EmBreve
      title="Caixa de entrada"
      description="Em breve: tudo que pediu sua atenção em um lugar só — atribuições novas, comentários, RDOs aguardando aprovação. Por enquanto, veja suas atividades em Minhas tarefas."
      emoji="📥"
      cta={{ label: "Ver minhas tarefas", href: "/tarefas" }}
    />
  );
}
