import { supabase } from "@/lib/supabase";

export interface AdminTopSongTrack {
  trackId: string;
  trackSlug: string;
  title: string;
  artistNames: string;
  durationMs: number | null;
  artworkUrl: string;
  previewUrl: string;
  sortOrder: number;
}

export interface AdminTopSongLegacyException {
  relationshipId: string;
  targetSlug: string;
  sortOrder: number;
  reason: "no_active_track_match" | "ambiguous_active_track_slug";
  candidateTrackIds: string[];
}

export interface AdminTopSongsPayload {
  artistId: string;
  artistSlug: string;
  fingerprint: string;
  tracks: AdminTopSongTrack[];
  unresolvedLegacy: AdminTopSongLegacyException[];
}

function normalizePayload(raw: unknown): AdminTopSongsPayload {
  const value = (raw ?? {}) as Record<string, unknown>;
  const tracks = Array.isArray(value.tracks) ? value.tracks : [];
  const unresolved = Array.isArray(value.unresolvedLegacy) ? value.unresolvedLegacy : [];

  return {
    artistId: String(value.artistId ?? ""),
    artistSlug: String(value.artistSlug ?? ""),
    fingerprint: String(value.fingerprint ?? ""),
    tracks: tracks.map((item) => {
      const row = item as Record<string, unknown>;
      return {
        trackId: String(row.trackId ?? ""),
        trackSlug: String(row.trackSlug ?? ""),
        title: String(row.title ?? ""),
        artistNames: String(row.artistNames ?? ""),
        durationMs: row.durationMs == null ? null : Number(row.durationMs),
        artworkUrl: String(row.artworkUrl ?? ""),
        previewUrl: String(row.previewUrl ?? ""),
        sortOrder: Number(row.sortOrder ?? 0),
      };
    }),
    unresolvedLegacy: unresolved.map((item) => {
      const row = item as Record<string, unknown>;
      const reason = String(row.reason ?? "no_active_track_match");
      return {
        relationshipId: String(row.relationshipId ?? ""),
        targetSlug: String(row.targetSlug ?? ""),
        sortOrder: Number(row.sortOrder ?? 0),
        reason:
          reason === "ambiguous_active_track_slug"
            ? "ambiguous_active_track_slug"
            : "no_active_track_match",
        candidateTrackIds: Array.isArray(row.candidateTrackIds)
          ? row.candidateTrackIds.map(String)
          : [],
      };
    }),
  };
}

export async function loadAdminArtistTopSongs(
  artistId: string,
): Promise<AdminTopSongsPayload> {
  const { data, error } = await (supabase as any).rpc(
    "get_artist_top_songs_v1",
    {
      p_artist_id: artistId,
      p_artist_slug: null,
    },
  );

  if (error) throw error;
  return normalizePayload(data);
}

export async function replaceAdminArtistTopSongs(
  artistId: string,
  trackIds: string[],
  expectedFingerprint: string,
): Promise<AdminTopSongsPayload> {
  const { data, error } = await (supabase as any).rpc(
    "admin_replace_artist_top_songs_v1",
    {
      p_artist_id: artistId,
      p_track_ids: trackIds,
      p_expected_fingerprint: expectedFingerprint,
    },
  );

  if (error) throw error;
  return normalizePayload(data);
}
