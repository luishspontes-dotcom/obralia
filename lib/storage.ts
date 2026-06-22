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

/**
 * URL de MINIATURA redimensionada on-the-fly pela transformação de imagem do
 * Supabase (plano Pro). Resolve a lentidão: 68% das fotos não têm thumbnail
 * gerado e estavam carregando o ORIGINAL (3-8MB). Aqui o Supabase entrega uma
 * versão de ~`width`px (cacheada na CDN), muito mais leve.
 *
 * Usar em GRADES/listas de fotos. No lightbox/zoom continuar usando mediaUrl
 * (original) para qualidade total.
 */
export function thumbUrl(path: string | null | undefined, width = 400): string {
  if (!path) return "";
  if (path.startsWith("http")) return path; // externa legada — não dá pra transformar

  const base = process.env.NEXT_PUBLIC_SUPABASE_URL
    ?? "https://bhhscygbhaqyewejlgug.supabase.co";
  return `${base}/storage/v1/render/image/public/media/${path}?width=${width}&quality=70&resize=contain`;
}
