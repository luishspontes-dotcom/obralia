/**
 * Converte um storage_path da tabela `media` em URL pública.
 * Após a migração de Storage (1 mai 2026), todos os paths começam com
 * `{site_id}/{media_id}.{ext}` e ficam no bucket público "media".
 *
 * Mantém compatibilidade com URLs externas legadas (caso aparecem novas
 * antes da próxima migração).
 */
export function mediaUrl(path: string | null | undefined): string {
  if (!path) return "";
  if (path.startsWith("http")) return path; // legacy externa

  const base = process.env.NEXT_PUBLIC_SUPABASE_URL
    ?? "https://bhhscygbhaqyewejlgug.supabase.co";
  return `${base}/storage/v1/object/public/media/${path}`;
}
