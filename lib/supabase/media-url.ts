import "server-only";

import type { createServerSupabase } from "./server";

type MediaLike = {
  storage_path: string | null;
  thumbnail_path?: string | null;
};

type ServerSupabase = Awaited<ReturnType<typeof createServerSupabase>>;

const DEFAULT_EXPIRES_IN = 60 * 60;

export async function withSignedMediaUrls<T extends MediaLike>(
  supabase: ServerSupabase,
  rows: T[],
  expiresIn = DEFAULT_EXPIRES_IN
): Promise<T[]> {
  return Promise.all(
    rows.map(async (row) => {
      const storageUrl = await createSignedMediaUrl(
        supabase,
        row.storage_path,
        expiresIn
      );
      const thumbnailUrl = await createSignedMediaUrl(
        supabase,
        row.thumbnail_path ?? row.storage_path,
        expiresIn
      );

      return {
        ...row,
        storage_path: storageUrl,
        thumbnail_path: thumbnailUrl,
      };
    })
  );
}

export async function createSignedMediaUrl(
  supabase: ServerSupabase,
  path: string | null,
  expiresIn = DEFAULT_EXPIRES_IN
) {
  if (!path || isExternalUrl(path)) return path;

  const { data, error } = await supabase.storage
    .from("media")
    .createSignedUrl(path, expiresIn);

  if (error) {
    console.error("signed media url error:", error.message);
    return null;
  }

  return data?.signedUrl ?? null;
}

function isExternalUrl(value: string) {
  return value.startsWith("http://") || value.startsWith("https://");
}
