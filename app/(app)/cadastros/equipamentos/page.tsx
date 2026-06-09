import { getDiarioCadastroSnapshot, textValue } from "@/lib/diario-cadastros";
import { CadastroShell, EmptyPanel, SimpleTable } from "../_shared";

export default async function EquipamentosPage() {
  const { snapshot } = await getDiarioCadastroSnapshot();
  const equipamentos = snapshot.cadastros?.equipamentos ?? [];

  return (
    <CadastroShell title="Equipamentos" subtitle={`${equipamentos.length} equipamentos importados do Diário`}>
      {equipamentos.length === 0 ? (
        <EmptyPanel>Nenhum equipamento importado.</EmptyPanel>
      ) : (
        <SimpleTable
          headers={["Descrição", "Quantidade", "Status"]}
          rows={equipamentos.map((item) => [
            textValue(item, ["descricao", "nome"]),
            textValue(item, ["quantidade", "qtd"]),
            textValue(item, ["ativo"]),
          ])}
        />
      )}
    </CadastroShell>
  );
}
