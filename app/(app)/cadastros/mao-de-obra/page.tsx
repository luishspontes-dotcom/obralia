import { getDiarioCadastroSnapshot, textValue } from "@/lib/diario-cadastros";
import { CadastroShell, EmptyPanel, SimpleTable } from "../_shared";

export default async function MaoDeObraPage() {
  const { snapshot } = await getDiarioCadastroSnapshot();
  const mao = snapshot.cadastros?.mao_de_obra;
  const padrao = mao?.padrao ?? [];
  const personalizada = mao?.personalizada ?? [];
  const categorias = mao?.categorias ?? [];

  return (
    <CadastroShell
      title="Mão de obra"
      subtitle={`${padrao.length} padrões, ${personalizada.length} personalizadas, ${categorias.length} categorias`}
    >
      {padrao.length === 0 && personalizada.length === 0 ? (
        <EmptyPanel>Nenhum cadastro de mão de obra importado.</EmptyPanel>
      ) : (
        <>
          <SimpleTable
            headers={["Descrição", "Quantidade", "Categoria", "Status"]}
            rows={[...padrao, ...personalizada].map((item) => [
              textValue(item, ["descricao", "nome", "funcao.descricao"]),
              textValue(item, ["quantidade", "qtd"]),
              textValue(item, ["categoria.descricao", "categoria", "tipo.descricao"]),
              textValue(item, ["ativo"]),
            ])}
          />
        </>
      )}
    </CadastroShell>
  );
}
