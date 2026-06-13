import type { createServerSupabase } from "@/lib/supabase/server";
import { WBS_SOURCE_PROVIDERS } from "@/lib/rdo-source-scope";

type SupabaseClient = Awaited<ReturnType<typeof createServerSupabase>>;

export type ObraTaskOption = { id: string; label: string };

/**
 * F2: lista as tarefas da obra (itens com parent, ou seja, tarefas dentro de
 * etapas) no formato "Etapa › Código Nome", para o seletor de atividades do RDO.
 */
export async function loadObraTasks(
  supabase: SupabaseClient,
  siteId: string,
): Promise<ObraTaskOption[]> {
  const { data } = await supabase
    .from("wbs_items")
    .select("id, name, code, parent_id, position")
    .eq("site_id", siteId)
    .in("external_provider", WBS_SOURCE_PROVIDERS)
    .order("position");

  const items = (data ?? []) as Array<{
    id: string;
    name: string;
    code: string | null;
    parent_id: string | null;
    position: number | null;
  }>;

  const etapaName = new Map(
    items.filter((w) => w.parent_id === null).map((w) => [w.id, w.name]),
  );

  return items
    .filter((w) => w.parent_id !== null)
    .map((w) => {
      const etapa = w.parent_id ? etapaName.get(w.parent_id) : null;
      const code = w.code ? `${w.code} ` : "";
      const prefix = etapa ? `${etapa} › ` : "";
      return { id: w.id, label: `${prefix}${code}${w.name}` };
    });
}
