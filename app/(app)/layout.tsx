import { redirect } from "next/navigation";
import { createServerSupabase } from "@/lib/supabase/server";
import { Topbar, type TopbarMenuCounts } from "@/components/layout/Topbar";
import { MobileTabBar } from "@/components/layout/MobileTabBar";
import { KeyboardShortcuts } from "@/components/KeyboardShortcuts";
import { OfflineIndicator } from "@/components/OfflineIndicator";
import { getLayoutSnapshot, type LayoutSnapshot } from "@/lib/layout-counts";

type Profile = {
  full_name: string | null;
  default_org_id: string | null;
};

type Organization = {
  id: string;
  name: string;
  slug: string;
  brand_color: string | null;
};

const EMPTY_SNAPSHOT: LayoutSnapshot = {
  recentSiteId: null,
  fotos: 0,
  videos: 0,
  anexos: 0,
  cadastroCounts: {},
};

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  // Try to fetch first organization the user belongs to
  const { data: profileRaw } = await supabase
    .from("profiles")
    .select("full_name, default_org_id")
    .eq("id", user.id)
    .maybeSingle();
  const profile = profileRaw as Profile | null;

  const { data: orgsRaw } = await supabase
    .from("organizations")
    .select("id, name, slug, brand_color");
  const orgs = (orgsRaw ?? []) as Organization[];

  const activeOrg =
    orgs.find((org) => org.id === profile?.default_org_id) ?? orgs[0] ?? null;
  const fullName = profile?.full_name ?? null;

  // Papel do usuário na org ativa — usado para esconder Cadastros/Análise e o
  // botão Adicionar quando o perfil é "Cliente Obra" (viewer), igual ao Diário:
  // "Acessa somente para consulta dos relatórios e obras selecionadas."
  const { data: memberRaw } = activeOrg
    ? await supabase
        .from("organization_members")
        .select("role")
        .eq("profile_id", user.id)
        .eq("organization_id", activeOrg.id)
        .maybeSingle()
    : { data: null };
  const role = (memberRaw as { role: string } | null)?.role ?? null;
  const isClient = role === "viewer";

  // Contagens dos badges do menu + obra recente da tab bar mobile: saem do
  // cache do servidor por organização (unstable_cache, revalidate 300s) em
  // vez de rodar 5+ queries em TODA navegação — navegação volta a ser leve.
  const snapshot = activeOrg ? await getLayoutSnapshot(activeOrg.id) : EMPTY_SNAPSHOT;
  const snapshotCounts = snapshot.cadastroCounts;
  // Existe snapshot do Diário quando há qualquer contagem importada.
  // O Diário sempre tem os defaults "Todas as obras" (grupo) e "Relatório
  // Diário de Obra (RDO)" (modelo), por isso caem para 1 quando o snapshot
  // não traz a chave explícita — assim o menu bate com o Diário (1/1).
  const hasDiarioSnapshot = Object.keys(snapshotCounts).length > 0;
  const menuCounts: TopbarMenuCounts = {
    fotos: snapshot.fotos,
    videos: snapshot.videos,
    anexos: snapshot.anexos,
    usuarios: Number(snapshotCounts.usuarios ?? 0),
    gruposDeObra: Number(snapshotCounts.grupos ?? snapshotCounts.grupos_de_obra ?? (hasDiarioSnapshot ? 1 : 0)),
    modelosRelatorios: Number(snapshotCounts.modelos ?? snapshotCounts.modelos_relatorios ?? (hasDiarioSnapshot ? 1 : 0)),
    // Mão de obra = padrão + personalizada (Diário mostra o total: 13 + 3 = 16).
    maoDeObra: Number(snapshotCounts.mao_de_obra_padrao ?? 0) + Number(snapshotCounts.mao_de_obra_personalizada ?? 0),
    equipamentos: Number(snapshotCounts.equipamentos ?? 0),
    tiposOcorrencias: Number(snapshotCounts.tipos_ocorrencias ?? 0),
  };

  return (
    <div className="app-shell">
      <a href="#main-content" className="skip-nav">
        Pular para o conteúdo
      </a>
      <Topbar
        activeOrg={activeOrg}
        userName={fullName ?? user.email ?? null}
        userEmail={user.email ?? null}
        menuCounts={menuCounts}
        isClient={isClient}
      />
      <main id="main-content" className="app-main light-scroll" tabIndex={-1}>
        {children}
      </main>
      <MobileTabBar recentSiteId={snapshot.recentSiteId} />
      <KeyboardShortcuts />
      <OfflineIndicator />
    </div>
  );
}
