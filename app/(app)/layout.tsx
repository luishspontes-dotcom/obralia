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

  // Contagens dos badges do menu + obra recente da tab bar mobile: saem do
  // cache do servidor por organização (unstable_cache, revalidate 300s) em
  // vez de rodar 5+ queries em TODA navegação — navegação volta a ser leve.
  const snapshot = activeOrg ? await getLayoutSnapshot(activeOrg.id) : EMPTY_SNAPSHOT;
  const snapshotCounts = snapshot.cadastroCounts;
  const menuCounts: TopbarMenuCounts = {
    fotos: snapshot.fotos,
    videos: snapshot.videos,
    anexos: snapshot.anexos,
    usuarios: Number(snapshotCounts.usuarios ?? 0),
    gruposDeObra: Number(snapshotCounts.grupos ?? 0),
    modelosRelatorios: Number(snapshotCounts.modelos ?? 0),
    maoDeObra: Number(snapshotCounts.mao_de_obra_padrao ?? 0),
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
