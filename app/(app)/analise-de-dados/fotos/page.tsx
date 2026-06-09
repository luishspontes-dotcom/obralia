import { MediaListPage } from "../_media-list";

export default async function FotosAnalisePage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
  return <MediaListPage kind="photo" q={q} />;
}
