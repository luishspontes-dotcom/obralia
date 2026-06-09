import { MediaListPage } from "../_media-list";

export default async function VideosAnalisePage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
  return <MediaListPage kind="video" q={q} />;
}
