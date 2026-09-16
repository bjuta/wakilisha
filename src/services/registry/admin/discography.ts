import { supabase } from "@/lib/supabase";

export type DiscographyAlbumAction = "merge" | "canonicalize" | "ignore";

export interface DiscographyAdditionalPrimaryArtist {
  artist_id: string;
  artist_slug: string;
  artist_name: string;
}

export interface DiscographySelection {
  apple_music_id: string;
  action: DiscographyAlbumAction;
  additional_primary_artists: DiscographyAdditionalPrimaryArtist[];
}

export interface DiscographyPreviewTrack {
  apple_music_id: string;
  title: string;
  track_number: number | null;
  disc_number: number | null;
  duration_ms: number | null;
  duration_display: string;
  isrc: string | null;
  artist_name: string;
  explicit: boolean;
  preview_url: string | null;
}

export interface DiscographyPreviewAlbum {
  apple_music_id: string;
  title: string;
  slug: string;
  release_type: string;
  release_date: string | null;
  upc: string | null;
  record_label: string | null;
  genre_names: string[];
  artwork_url: string | null;
  apple_music_url: string | null;
  track_count: number;
  tracks: DiscographyPreviewTrack[];
  match_status: "existing" | "new";
  existing_release: {
    id: string;
    slug: string;
    title: string;
    source: string;
  } | null;
  album_artist_name: string;
}

export interface DiscographyPreviewResponse {
  ok: boolean;
  mode: "preview";
  artist: { id: string; slug: string; name: string };
  storefront: string;
  albums_searched: number;
  albums_fetched: number;
  albums_failed: string[];
  albums: DiscographyPreviewAlbum[];
  evidence_assertion_id: string;
  provider_source_payload_fingerprint: string;
  duration_ms: number;
  error?: string;
  detail?: string;
}

export interface DiscographyApplySummary {
  merged: number;
  canonicalized: number;
  ignored: number;
  tracks_created: number;
  featured_artist_links: number;
  operations?: Array<{
    operation_id: string;
    verifier_status: string;
    idempotent_replay: boolean;
  }>;
  errors: string[];
}

export interface DiscographyApplyResponse {
  ok: boolean;
  mode: "apply";
  summary: DiscographyApplySummary;
  error?: string;
  detail?: string;
}

export interface DiscographyArtistShellResponse {
  ok: boolean;
  mode: "create_artist_shell";
  created: boolean;
  artist: DiscographyAdditionalPrimaryArtist;
  operation_id?: string | null;
  verifier_status?: string | null;
  error?: string;
  detail?: string;
}

function extractInvokeError(error: unknown): string {
  if (!error || typeof error !== "object") return "Discography request failed.";
  const record = error as Record<string, unknown>;
  let message = String(record.message ?? "Discography request failed.");
  const context = record.context;
  if (!context || typeof context !== "object") return message;
  const body = (context as Record<string, unknown>).body;
  if (typeof body !== "string" || !body.trim()) return message;
  try {
    const parsed = JSON.parse(body) as { detail?: string; error?: string; stage?: string };
    if (parsed.detail) return parsed.detail;
    if (parsed.error) return parsed.stage ? `[${parsed.stage}] ${parsed.error}` : parsed.error;
  } catch {
    // Keep the connector error when the response body is not JSON.
  }
  return message;
}

async function invokeDiscography<T>(body: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke(
    "ingest-artist-discography",
    { body, timeout: 15000 },
  );
  if (error) throw new Error(extractInvokeError(error));
  return data as T;
}

export async function previewGovernedArtistDiscography(
  artistId: string,
): Promise<DiscographyPreviewResponse> {
  const response = await invokeDiscography<DiscographyPreviewResponse>({
    artist_id: artistId,
    mode: "preview",
  });
  if (!response.ok) {
    throw new Error(response.detail ?? response.error ?? "Discography preview failed.");
  }
  if (!response.evidence_assertion_id || !response.provider_source_payload_fingerprint) {
    throw new Error("Discography preview did not return immutable evidence authority.");
  }
  return response;
}

export async function createGovernedDiscographyArtistShell(input: {
  currentArtistId: string;
  artistName: string;
}): Promise<DiscographyArtistShellResponse> {
  const response = await invokeDiscography<DiscographyArtistShellResponse>({
    artist_id: input.currentArtistId,
    mode: "create_artist_shell",
    artist_name: input.artistName,
    approved: true,
  });
  if (!response.ok || !response.artist) {
    throw new Error(response.detail ?? response.error ?? "Artist shell creation failed.");
  }
  return response;
}

export async function applyReviewedArtistDiscography(input: {
  artistId: string;
  evidenceAssertionId: string;
  selections: DiscographySelection[];
}): Promise<DiscographyApplyResponse> {
  const response = await invokeDiscography<DiscographyApplyResponse>({
    artist_id: input.artistId,
    mode: "apply",
    approved: true,
    evidence_assertion_id: input.evidenceAssertionId,
    selected_albums: input.selections,
  });
  if (!response.ok) {
    throw new Error(response.detail ?? response.error ?? "Discography apply failed.");
  }
  return response;
}
