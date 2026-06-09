import { getDiarioCadastroSnapshot } from "@/lib/diario-cadastros";
import { CadastroShell, EmptyPanel, groupLabel, roleLabel, SimpleTable } from "../_shared";

export default async function UsuariosEmpresasAcessoPage() {
  const { activeOrg, snapshot } = await getDiarioCadastroSnapshot();
  const users = snapshot.cadastros?.usuarios ?? [];

  return (
    <CadastroShell title="Usuários empresas/acesso" subtitle={`${users.length} usuários importados do Diário em ${activeOrg?.name ?? "Obrália"}`}>
      {users.length === 0 ? (
        <EmptyPanel>Nenhum usuário importado do Diário encontrado.</EmptyPanel>
      ) : (
        <SimpleTable
          headers={["Nome", "E-mail", "Grupo Diário", "Papel Obrália", "Status"]}
          rows={users.map((user) => [
            user.name ?? "-",
            user.email ?? "-",
            groupLabel(user.group),
            roleLabel(user.role),
            user.active === false ? "Inativo" : "Ativo",
          ])}
        />
      )}
    </CadastroShell>
  );
}
