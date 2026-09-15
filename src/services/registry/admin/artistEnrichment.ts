import { supabase } from "@/lib/supabase";

const supabaseUrl = import.meta.env.VITE_PUBLIC_SUPABASE_URL as string;
const anonKey = import.meta.env.VITE_PUBLIC_SUPABASE_ANON_KEY as string;
const ENRICH_URL = `${supabaseUrl}/functions/v1/registry-enrich-artist`;

export type ArtistEnrichmentMode = "profile" | "type";

export type ArtistEnrichmentResultItem = {
  id?: string;
  slug?: string;
  name?: string;
  status: "updated" | "skipped" | "no_data" | "error";
  admissionStatus?: "proposed" | "admitted" | "partial_failure";
  providersTried?: string[];
  providersFound?: string[];
  changes?: Record<string, unknown>;
  evidenceIds?: string[];
  proposedOperations?: Array<Record<string, unknown>>;
  operations?: Array<Record<string, unknown>>;
  failures?: Array<Record<string, unknown>>;
  message?: string;
};

export type ArtistEnrichmentResponse = {
  ok: boolean;
  dry_run: boolean;
  approved?: boolean;
  force?: boolean;
  total_found: number;
  updated: number;
  skipped: number;
  no_data: number;
  errors: number;
  provider_status?: Record<string, { connected: boolean; error?: string }>;
  reviewed_artist_ids?: string[];
  reviewed_evidence_ids?: string[];
  results: ArtistEnrichmentResultItem[];
  error?: string;
  message?: string;
};

async function authHeaders(): Promise<Record<string, string>> {
  const { data: { session } } = await supabase.auth.getSession();
  const token = session?.access_token;
  if (!token) throw new Error("Not authenticated.");
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
    apikey: anonKey || "",
  };
}

async function callArtistEnrichment(body: Record<string, unknown>): Promise<ArtistEnrichmentResponse> {
  const response = await fetch(ENRICH_URL, {
    method: "POST",
    headers: await authHeaders(),
    body: JSON.stringify(body),
  });
  const data = await response.json() as ArtistEnrichmentResponse;
  if (!response.ok || !data.ok) {
    throw new Error(data.message || data.error || `Artist enrichment failed (HTTP ${response.status}).`);
  }
  return data;
}

export async function previewArtistEnrichment(input: {
  mode: ArtistEnrichmentMode;
  artistIds?: string[];
  artistId?: string;
  artistSlug?: string;
  batchSize?: number;
  filter?: string;
  providers?: string[];
  force?: boolean;
  useMusicBrainz?: boolean;
}): Promise<ArtistEnrichmentResponse> {
  return callArtistEnrichment({
    dry_run: true,
    artist_ids: input.artistIds,
    artist_id: input.artistId,
    artist_slug: input.artistSlug,
    batch_size: input.batchSize,
    filter: input.filter ?? (input.mode === "type" ? "missing_type" : "missing_image"),
    providers: input.mode === "type" ? [] : (input.providers ?? ["spotify", "apple_music"]),
    include_type: input.mode === "type",
    use_musicbrainz: input.useMusicBrainz !== false,
    force: input.force === true,
  });
}

export async function applyReviewedArtistEnrichment(
  preview: ArtistEnrichmentResponse,
): Promise<ArtistEnrichmentResponse> {
  const evidenceIds = [...new Set(preview.reviewed_evidence_ids ?? [])];
  if (!evidenceIds.length) {
    throw new Error("This preview contains no reviewed evidence to apply.");
  }
  return callArtistEnrichment({
    dry_run: false,
    approved: true,
    evidence_ids: evidenceIds,
  });
}
