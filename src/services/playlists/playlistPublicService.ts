import { supabase } from "@/lib/supabase";
import {
  decodePublicPlaylist,
  decodePublicPlaylistCollection,
  type PublicPlaylist,
  type PublicPlaylistListItem,
} from "./playlistPublicModel";

export interface PublicPlaylistCursor {
  publishedAt: string;
  snapshotId: string;
}

export async function getPublicPlaylist(
  slug: string,
): Promise<PublicPlaylist | null> {
  const normalizedSlug = slug.trim();

  if (!normalizedSlug) return null;

  const { data, error } = await supabase.rpc(
    "get_public_playlist",
    {
      p_slug: normalizedSlug,
    },
  );

  if (error) {
    throw new Error(
      `Could not load this Playlist: ${error.message}`,
    );
  }

  return decodePublicPlaylist(data);
}

export async function getPublicPlaylistPreview(
  slug: string,
  nonce: string,
): Promise<PublicPlaylist | null> {
  const normalizedSlug = slug.trim();
  const normalizedNonce = nonce.trim();

  if (!normalizedSlug || !normalizedNonce) return null;

  const { data, error } = await supabase.rpc(
    "resolve_playlist_preview_nonce",
    {
      p_nonce: normalizedNonce,
    },
  );

  if (error) {
    throw new Error(
      `Could not load this Playlist preview: ${error.message}`,
    );
  }

  const playlist = decodePublicPlaylist(data);

  if (
    !playlist ||
    playlist.slug !== normalizedSlug
  ) {
    return null;
  }

  return playlist;
}

export async function listPublicPlaylists(
  options: {
    limit?: number;
    cursor?: PublicPlaylistCursor | null;
  } = {},
): Promise<PublicPlaylistListItem[]> {
  const limit = Math.max(
    1,
    Math.min(options.limit ?? 24, 50),
  );

  const args: {
    p_limit: number;
    p_before_published_at?: string;
    p_before_snapshot_id?: string;
  } = {
    p_limit: limit,
  };

  if (options.cursor) {
    args.p_before_published_at =
      options.cursor.publishedAt;
    args.p_before_snapshot_id =
      options.cursor.snapshotId;
  }

  const { data, error } = await supabase.rpc(
    "list_public_playlists",
    args,
  );

  if (error) {
    throw new Error(
      `Could not load Playlists: ${error.message}`,
    );
  }

  return decodePublicPlaylistCollection(
    data,
  );
}
