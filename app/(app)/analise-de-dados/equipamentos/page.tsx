import { HistoricoPanel } from "../_historico-panel";

export const metadata = {
  title: "Equipamentos — histórico",
};

export default function EquipamentosHistoricoPage() {
  return (
    <HistoricoPanel
      eyebrow="Análise de dados"
      title="Equipamentos — histórico"
      description="Histórico de equipamentos registrados nos relatórios diários das obras. Em breve esta tela trará o consolidado por período e por obra."
    />
  );
}
