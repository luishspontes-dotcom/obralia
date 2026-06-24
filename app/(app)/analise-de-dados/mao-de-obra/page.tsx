import { HistoricoPanel } from "../_historico-panel";

export const metadata = {
  title: "Mão de obra — histórico",
};

export default function MaoDeObraHistoricoPage() {
  return (
    <HistoricoPanel
      eyebrow="Análise de dados"
      title="Mão de obra — histórico"
      description="Histórico de mão de obra registrada nos relatórios diários das obras. Em breve esta tela trará o consolidado por período e por obra."
    />
  );
}
