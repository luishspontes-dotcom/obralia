/**
 * Normaliza URLs de mídia que já foram resolvidas no servidor.
 * O bucket `media` é privado; paths internos precisam ser assinados via
 * `createSignedMediaUrl`/`withSignedMediaUrls` antes de chegar ao cliente.
 */
export function mediaUrl(path: string | null | undefined): string {
  if (!path) return "";
  if (
    path.startsWith("http://") ||
    path.startsWith("https://") ||
    path.startsWith("blob:") ||
    path.startsWith("data:")
  ) {
    return path;
  }
  return "";
}
