import { supabase } from "@/lib/supabase";

export type PublicTrackPlaybackProvider = {
  trackId: string;
  providerKey: string;
  providerTrackId: string;
  providerReleaseId: string | null;
  isrc: string | null;
  upc: string | null;
  previewUrl: string | null;
  artworkUrl: string | null;
  durationMs: number | null;
  storefront: string | null;
  matchMethod: string;
  matchConfidence: number;
  lastCheckedAt: string;
};

export type TrackProviderLink = PublicTrackPlaybackProvider & {
  id: string;
  providerArtistIds: string[];
  matchStatus: "matched" | "needs_review" | "rejected" | "unavailable" | "stale";
  rawPayload: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
};

function mapPublicPlaybackProvider(row: Record<string, unknown>): PublicTrackPlaybackProvider {
  return {
    trackId: String(row.track_id),
    providerKey: String(row.provider_key),
    providerTrackId: String(row.provider_track_id),
    providerReleaseId: row.provider_release_id ? String(row.provider_release_id) : null,
    isrc: row.isrc ? String(row.isrc) : null,
    upc: row.upc ? String(row.upc) : null,
    previewUrl: row.preview_url ? String(row.preview_url) : null,
    artworkUrl: row.artwork_url ? String(row.artwork_url) : null,
    durationMs: row.duration_ms == null ? null : Number(row.duration_ms),
    storefront: row.storefront ? String(row.storefront) : null,
    matchMethod: String(row.match_method || "unknown"),
    matchConfidence: Number(row.match_confidence || 0),
    lastCheckedAt: String(row.last_checked_at || ""),
  };
}

function mapTrackProviderLink(row: Record<string, unknown>): TrackProviderLink {
  return {
    ...mapPublicPlaybackProvider(row),
    id: String(row.id),
    providerArtistIds: Array.isArray(row.provider_artist_ids)
      ? row.provider_artist_ids.map(String)
      : [],
    matchStatus: String(row.match_status || "matched") as TrackProviderLink["matchStatus"],
    rawPayload: (row.raw_payload && typeof row.raw_payload === "object")
      ? row.raw_payload as Record<string, unknown>
      : {},
    createdAt: String(row.created_at || ""),
    updatedAt: String(row.updated_at || ""),
  };
}

export async function getPublicTrackPlaybackProviders(
  trackIds: string[],
  providerKey: string = "apple_music",
): Promise<PublicTrackPlaybackProvider[]> {
  const ids = [...new Set(trackIds.filter(Boolean))];
  if (ids.length === 0) return [];

  const { data, error } = await supabase.rpc("registry_get_public_track_playback_providers", {
    p_track_ids: ids,
    p_provider_key: providerKey,
  });

  if (error) throw error;

  return (data || []).map((row: Record<string, unknown>) => mapPublicPlaybackProvider(row));
}

export async function getTrackProviderLinks(input: {
  trackId?: string | null;
  providerKey?: string | null;
  providerTrackId?: string | null;
  isrc?: string | null;
  limit?: number;
}): Promise<TrackProviderLink[]> {
  const { data, error } = await supabase.rpc("registry_get_track_provider_links", {
    p_track_id: input.trackId || null,
    p_provider_key: input.providerKey || null,
    p_provider_track_id: input.providerTrackId || null,
    p_isrc: input.isrc || null,
    p_limit: input.limit || 50,
  });

  if (error) throw error;

  return (data || []).map((row: Record<string, unknown>) => mapTrackProviderLink(row));
}

export async function upsertTrackProviderLink(input: {
  trackId: string;
  providerKey: string;
  providerTrackId: string;
  providerReleaseId?: string | null;
  providerArtistIds?: string[];
  isrc?: string | null;
  upc?: string | null;
  previewUrl?: string | null;
  artworkUrl?: string | null;
  durationMs?: number | null;
  storefront?: string | null;
  matchMethod?: string;
  matchConfidence?: number;
  matchStatus?: TrackProviderLink["matchStatus"];
  rawPayload?: Record<string, unknown>;
}): Promise<TrackProviderLink> {
  const { data, error } = await supabase.rpc("registry_upsert_track_provider_link", {
    p_track_id: input.trackId,
    p_provider_key: input.providerKey,
    p_provider_track_id: input.providerTrackId,
    p_provider_release_id: input.providerReleaseId || null,
    p_provider_artist_ids: input.providerArtistIds || [],
    p_isrc: input.isrc || null,
    p_upc: input.upc || null,
    p_preview_url: input.previewUrl || null,
    p_artwork_url: input.artworkUrl || null,
    p_duration_ms: input.durationMs || null,
    p_storefront: input.storefront || null,
    p_match_method: input.matchMethod || "unknown",
    p_match_confidence: input.matchConfidence ?? 0,
    p_match_status: input.matchStatus || "matched",
    p_raw_payload: input.rawPayload || {},
  });

  if (error) throw error;

  return mapTrackProviderLink(data as Record<string, unknown>);
}
