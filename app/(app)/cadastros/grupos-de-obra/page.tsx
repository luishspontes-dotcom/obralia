import Link from "next/link";
import { createServerSupabase } from "@/lib/supabase/server";
import { createAdminSupabase } from "@/lib/supabase/admin";
import { VISIBLE_SOURCE_PROVIDERS } from "@/lib/rdo-source-scope";
import { CadastroShell, EmptyPanel, SimpleTable } from "../_shared";

type Site = { id: string; name: string };

export default async function GruposDeObraPage() {
  await createServerSupabase();
  const supabase = createAdminSupabase();
  const { data } = await supabase
    .from("sites")
    .select("id, name")
    .in("external_provider", VISIBLE_SOURCE_PROVIDERS)
    .order("name");
  const sites = (data ?? []) as Site[];

  // Paridade com o Diário: ele tem um único grupo padrão "Todas as obras" ao qual
  // todas as obras pertencem. Refletimos isso (em vez de agrupar por status, que
  // gerava rótulos como "Em andamento" que não existem como grupo no Diário).
  const rows =
    sites.length === 0
      ? []
      : [
          [
            "Todas as obras",
            "Padrão",
            String(sites.length),
            <Link key="todas" href="/obras">
              Abrir
            </Link>,
          ],
        ];

  return (
    <CadastroShell title="Grupos de obra" subtitle={`${rows.length} grupo`}>
      {rows.length === 0 ? (
        <EmptyPanel>Nenhum grupo de obra encontrado.</EmptyPanel>
      ) : (
        <SimpleTable headers={["Descrição", "", "Obras", "Ação"]} rows={rows} />
      )}
    </CadastroShell>
  );
}
