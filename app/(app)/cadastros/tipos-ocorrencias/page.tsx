import { getDiarioCadastroSnapshot, textValue } from "@/lib/diario-cadastros";
import { CadastroShell, EmptyPanel, SimpleTable } from "../_shared";

export default async function TiposOcorrenciasPage() {
  const { snapshot } = await getDiarioCadastroSnapshot();
  const tipos = snapshot.cadastros?.tipos_ocorrencias ?? [];

  return (
    <CadastroShell title="Tipos de ocorrências" subtitle={`${tipos.length} tipos importados do Diário`}>
      {tipos.length === 0 ? (
        <EmptyPanel>Nenhum tipo de ocorrência importado.</EmptyPanel>
      ) : (
        <SimpleTable
          headers={["Descrição", "Código"]}
          rows={tipos.map((item) => [
            textValue(item, ["descricao", "nome"]),
            textValue(item, ["_id", "id", "codigo"]),
          ])}
        />
      )}
    </CadastroShell>
  );
}
