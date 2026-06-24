import { createServerSupabase } from "@/lib/supabase/server";
import { VISIBLE_SOURCE_PROVIDERS } from "@/lib/rdo-source-scope";

const inputStyle = {
  width: "100%",
  background: "var(--o-paper)",
  border: "1px solid var(--o-border)",
  borderRadius: 10,
  padding: "11px 14px",
  font: "400 14px var(--font-inter)",
  color: "var(--o-text)",
} as const;

type Site = { id: string; name: string };

export default async function Page() {
  const supabase = await createServerSupabase();
  const { data } = await supabase
    .from("sites")
    .select("id, name")
    .in("external_provider", VISIBLE_SOURCE_PROVIDERS)
    .order("name");
  const sites = (data ?? []) as Site[];

  return (
    <div>
      <h1 style={{ font: "600 22px var(--font-inter)", margin: "8px 0 18px" }}>
        Predefinir mão de obra (opcional)
      </h1>

      <div className="card" style={{ padding: "22px 24px" }}>
        <div style={{ fontWeight: 600, marginBottom: 8 }}>
          Selecione uma obra para continuar
        </div>
        <select style={inputStyle} defaultValue="">
          <option value="">Selecione uma obra</option>
          {sites.map((site) => (
            <option key={site.id} value={site.id}>
              {site.name}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}
