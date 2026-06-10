import { redirect } from "next/navigation";
import { createServerSupabase } from "@/lib/supabase/server";
import { Topbar, type TopbarMenuCounts } from "@/components/layout/Topbar";
import { MobileTabBar } from "@/components/layout/MobileTabBar";
import { KeyboardShortcuts } from "@/components/KeyboardShortcuts";
import { OfflineIndicator } from "@/components/OfflineIndicator";
import { VISIBLE_SOURCE_PROVIDERS } from "@/lib/rdo-source-scope";
import { getDiarioCadastroSnapshot } from "@/lib/diario-cadastros";

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

  // Obra mais recente (último RDO criado) — alvo do botão ＋ da tab bar mobile
  let recentSiteId: string | null = null;
  const { data: lastReportRaw } = await supabase
    .from("daily_reports")
    .select("site_id")
    .in("external_provider", VISIBLE_SOURCE_PROVIDERS)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  recentSiteId = (lastReportRaw as { site_id: string } | null)?.site_id ?? null;
  if (!recentSiteId) {
    const { data: lastSiteRaw } = await supabase
      .from("sites")
      .select("id")
      .in("external_provider", VISIBLE_SOURCE_PROVIDERS)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    recentSiteId = (lastSiteRaw as { id: string } | null)?.id ?? null;
  }

  // Contagens reais pros badges dos menus do topo (paridade com o Diário de Obra)
  const [{ count: fotoCount }, { count: videoCount }, { count: anexoCount }, cadastroSnapshot] =
    await Promise.all([
      supabase
        .from("media")
        .select("*", { count: "exact", head: true })
        .in("external_provider", VISIBLE_SOURCE_PROVIDERS)
        .eq("kind", "photo"),
      supabase
        .from("media")
        .select("*", { count: "exact", head: true })
        .in("external_provider", VISIBLE_SOURCE_PROVIDERS)
        .eq("kind", "video"),
      supabase
        .from("media")
        .select("*", { count: "exact", head: true })
        .in("external_provider", VISIBLE_SOURCE_PROVIDERS)
        .eq("kind", "file"),
      getDiarioCadastroSnapshot(),
    ]);
  const snapshotCounts: Record<string, number> = cadastroSnapshot.snapshot.counts ?? {};
  const menuCounts: TopbarMenuCounts = {
    fotos: fotoCount ?? 0,
    videos: videoCount ?? 0,
    anexos: anexoCount ?? 0,
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
      <MobileTabBar recentSiteId={recentSiteId} />
      <KeyboardShortcuts />
      <OfflineIndicator />
    </div>
  );
}
