import { createServerSupabase } from "@/lib/supabase/server";
import { VISIBLE_SOURCE_PROVIDERS } from "@/lib/rdo-source-scope";
import { CadastroShell, EmptyPanel, SimpleTable } from "../_shared";

type Report = { sync_metadata: unknown };

export default async function ModelosRelatoriosPage() {
  const supabase = await createServerSupabase();
  const { data } = await supabase
    .from("daily_reports")
    .select("sync_metadata")
    .in("external_provider", VISIBLE_SOURCE_PROVIDERS)
    .limit(5000);
  const reports = (data ?? []) as Report[];
  const models = new Map<string, { name: string; count: number }>();

  for (const report of reports) {
    const metadata = report.sync_metadata as Record<string, unknown> | null;
    const model = metadata?.modelo as Record<string, unknown> | null;
    const rawName = model?.descricao ?? model?.nome ?? model?.name ?? model?.id ?? "Modelo padrão";
    const name = String(rawName || "Modelo padrão");
    const row = models.get(name) ?? { name, count: 0 };
    row.count += 1;
    models.set(name, row);
  }

  const rows = Array.from(models.values()).map((model) => [model.name, String(model.count)]);

  return (
    <CadastroShell title="Modelos de relatórios" subtitle={`${rows.length} modelos detectados nos RDOs importados`}>
      {rows.length === 0 ? (
        <EmptyPanel>Nenhum modelo de relatório detectado.</EmptyPanel>
      ) : (
        <SimpleTable headers={["Modelo", "RDOs"]} rows={rows} />
      )}
    </CadastroShell>
  );
}
