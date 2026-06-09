import Link from "next/link";
import { createServerSupabase } from "@/lib/supabase/server";
import { VISIBLE_SOURCE_PROVIDERS } from "@/lib/rdo-source-scope";
import { CadastroShell, EmptyPanel, SimpleTable } from "../_shared";

type Site = { id: string; name: string; status: string; client_name: string | null };

const statusLabel: Record<string, string> = {
  in_progress: "Em andamento",
  not_started: "Não iniciada",
  paused: "Pausada",
  done: "Concluída",
};

export default async function GruposDeObraPage() {
  const supabase = await createServerSupabase();
  const { data } = await supabase
    .from("sites")
    .select("id, name, status, client_name")
    .in("external_provider", VISIBLE_SOURCE_PROVIDERS)
    .order("status")
    .order("name");
  const sites = (data ?? []) as Site[];
  const groups = new Map<string, Site[]>();
  for (const site of sites) {
    const list = groups.get(site.status) ?? [];
    list.push(site);
    groups.set(site.status, list);
  }

  const rows = Array.from(groups.entries()).map(([status, list]) => [
    statusLabel[status] ?? status,
    String(list.length),
    list.slice(0, 4).map((site) => site.name).join(", "),
    <Link key={status} href={`/obras?status=${status === "done" ? "done" : status}`}>Abrir</Link>,
  ]);

  return (
    <CadastroShell title="Grupos de obra" subtitle={`${groups.size} grupos gerados a partir das obras importadas`}>
      {rows.length === 0 ? (
        <EmptyPanel>Nenhum grupo de obra encontrado.</EmptyPanel>
      ) : (
        <SimpleTable headers={["Grupo", "Obras", "Exemplos", "Ação"]} rows={rows} />
      )}
    </CadastroShell>
  );
}
