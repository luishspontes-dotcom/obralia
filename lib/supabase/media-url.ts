import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "./database.types";

type MediaLike = {
  storage_path: string | null;
  thumbnail_path?: string | null;
};

export async function withSignedMediaUrls<T extends MediaLike>(
  supabase: SupabaseClient<Database>,
  rows: T[],
  expiresIn = 60 * 60
): Promise<T[]> {
  return Promise.all(
    rows.map(async (row) => {
      const storageUrl = await getMediaUrl(
        supabase,
        row.storage_path,
        expiresIn
      );
      const thumbnailUrl = await getMediaUrl(
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

async function getMediaUrl(
  supabase: SupabaseClient<Database>,
  path: string | null,
  expiresIn: number
) {
  if (!path || isExternalUrl(path)) return path;

  const { data } = await supabase.storage
    .from("media")
    .createSignedUrl(path, expiresIn);

  return data?.signedUrl ?? path;
}

function isExternalUrl(value: string) {
  return value.startsWith("http://") || value.startsWith("https://");
}
