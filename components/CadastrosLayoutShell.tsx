import { createServerSupabase } from "@/lib/supabase/server";
import { getLayoutSnapshot } from "@/lib/layout-counts";
import { CadastrosNav, type CadastrosCounts } from "./CadastrosNav";

const EMPTY: CadastrosCounts = {
  usuarios: 0, gruposDeObra: 0, modelosRelatorios: 0, maoDeObra: 0, equipamentos: 0, tiposOcorrencias: 0,
};

/**
 * Shell da área de Cadastros: barra lateral (igual ao Diário) + conteúdo.
 * Aplicado via layout.tsx em /usuarios e /cadastros.
 */
export async function CadastrosLayoutShell({ children }: { children: React.ReactNode }) {
  const supabase = await createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();

  let counts: CadastrosCounts = EMPTY;
  if (user) {
    const { data: profileR } = await supabase
      .from("profiles").select("default_org_id").eq("id", user.id).maybeSingle();
    const orgId = (profileR as { default_org_id?: string } | null)?.default_org_id;
    if (orgId) {
      const c = (await getLayoutSnapshot(orgId)).cadastroCounts;
      const has = Object.keys(c).length > 0;
      counts = {
        usuarios: Number(c.usuarios ?? 0),
        gruposDeObra: Number(c.grupos ?? c.grupos_de_obra ?? (has ? 1 : 0)),
        modelosRelatorios: Number(c.modelos ?? c.modelos_relatorios ?? (has ? 1 : 0)),
        maoDeObra: Number(c.mao_de_obra_padrao ?? 0) + Number(c.mao_de_obra_personalizada ?? 0),
        equipamentos: Number(c.equipamentos ?? 0),
        tiposOcorrencias: Number(c.tipos_ocorrencias ?? 0),
      };
    }
  }

  return (
    <div className="cadastros-shell">
      <CadastrosNav counts={counts} />
      <div className="cadastros-shell__content">{children}</div>
    </div>
  );
}
