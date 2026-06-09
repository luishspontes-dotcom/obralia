import { MediaListPage } from "../_media-list";

export default async function AnexosAnalisePage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
  return <MediaListPage kind="file" q={q} />;
}
