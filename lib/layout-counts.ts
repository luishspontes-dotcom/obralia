import { unstable_cache } from "next/cache";
import { createAdminSupabase } from "@/lib/supabase/admin";
import { VISIBLE_SOURCE_PROVIDERS } from "@/lib/rdo-source-scope";

/**
 * Snapshot leve do shell do app (badges do menu + obra recente da tab bar),
 * cacheado por organização com unstable_cache (revalidate 300s).
 *
 * Antes, o layout (app) rodava 5+ queries de contagem EM TODA navegação,
 * deixando o app inteiro lento. Agora as contagens saem do cache do servidor
 * e só são recalculadas a cada 5 minutos (ou via revalidateTag).
 *
 * IMPORTANTE: dentro do unstable_cache não dá pra usar cookies/sessão —
 * por isso usamos o client admin com o orgId como parte da chave do cache.
 * São apenas contagens não-sensíveis de menu (fotos/vídeos/anexos/cadastros).
 */

export type LayoutSnapshot = {
  recentSiteId: string | null;
  fotos: number;
  videos: number;
  anexos: number;
  cadastroCounts: Record<string, number>;
};

export const LAYOUT_SNAPSHOT_TAG = "layout-snapshot";

export function layoutSnapshotTagFor(orgId: string): string {
  return `${LAYOUT_SNAPSHOT_TAG}-${orgId}`;
}

const EMPTY_SNAPSHOT: LayoutSnapshot = {
  recentSiteId: null,
  fotos: 0,
  videos: 0,
  anexos: 0,
  cadastroCounts: {},
};

async function fetchLayoutSnapshot(orgId: string): Promise<LayoutSnapshot> {
  const admin = createAdminSupabase();

  // Obras da organização (escopo de todas as contagens; tabelas media e
  // daily_reports não têm organization_id — o vínculo é via site_id).
  const { data: siteRows } = await admin
    .from("sites")
    .select("id")
    .eq("organization_id", orgId)
    .in("external_provider", VISIBLE_SOURCE_PROVIDERS)
    .order("created_at", { ascending: false });
  const siteIds = (siteRows ?? []).map((row) => row.id);

  if (siteIds.length === 0) {
    const cadastroCounts = await fetchCadastroCounts(orgId);
    return { ...EMPTY_SNAPSHOT, cadastroCounts };
  }

  const [fotosR, videosR, anexosR, lastReportR, cadastroCounts] = await Promise.all([
    admin
      .from("media")
      .select("id", { count: "exact", head: true })
      .in("site_id", siteIds)
      .in("external_provider", VISIBLE_SOURCE_PROVIDERS)
      .eq("kind", "photo"),
    admin
      .from("media")
      .select("id", { count: "exact", head: true })
      .in("site_id", siteIds)
      .in("external_provider", VISIBLE_SOURCE_PROVIDERS)
      .eq("kind", "video"),
    admin
      .from("media")
      .select("id", { count: "exact", head: true })
      .in("site_id", siteIds)
      .in("external_provider", VISIBLE_SOURCE_PROVIDERS)
      .eq("kind", "file"),
    admin
      .from("daily_reports")
      .select("site_id")
      .in("site_id", siteIds)
      .in("external_provider", VISIBLE_SOURCE_PROVIDERS)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    fetchCadastroCounts(orgId),
  ]);

  // Obra do último RDO criado; fallback: obra mais recente da org.
  const recentSiteId =
    (lastReportR.data as { site_id: string } | null)?.site_id ?? siteIds[0] ?? null;

  return {
    recentSiteId,
    fotos: fotosR.count ?? 0,
    videos: videosR.count ?? 0,
    anexos: anexosR.count ?? 0,
    cadastroCounts,
  };
}

/** Contagens de cadastros importadas do Diário de Obra (metadata da conta externa). */
async function fetchCadastroCounts(orgId: string): Promise<Record<string, number>> {
  const admin = createAdminSupabase();
  const { data } = await admin
    .from("external_accounts")
    .select("metadata")
    .eq("organization_id", orgId)
    .eq("provider", "diario_de_obra")
    .ilike("label", "Diario de Obras")
    .order("last_success_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const metadata = (data as { metadata?: unknown } | null)?.metadata;
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) return {};
  const counts = (metadata as { counts?: unknown }).counts;
  if (!counts || typeof counts !== "object" || Array.isArray(counts)) return {};

  const out: Record<string, number> = {};
  for (const [key, value] of Object.entries(counts as Record<string, unknown>)) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) out[key] = parsed;
  }
  return out;
}

/**
 * Versão cacheada por org: chave inclui o orgId, revalida a cada 5 minutos.
 * Em caso de erro, devolve snapshot vazio — o shell nunca pode quebrar
 * a navegação por causa de badge de menu.
 */
export async function getLayoutSnapshot(orgId: string): Promise<LayoutSnapshot> {
  const cached = unstable_cache(
    async () => {
      try {
        return await fetchLayoutSnapshot(orgId);
      } catch {
        return EMPTY_SNAPSHOT;
      }
    },
    ["layout-snapshot", orgId],
    {
      revalidate: 300,
      tags: [LAYOUT_SNAPSHOT_TAG, layoutSnapshotTagFor(orgId)],
    }
  );
  return cached();
}
