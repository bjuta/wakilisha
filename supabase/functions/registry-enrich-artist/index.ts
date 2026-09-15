// Registry Artist Enrichment v3
// Proposal preparation + exact reviewed-evidence admission.
// Provider credentials live only in registry-artist-provider-fetch.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

const ALLOWED_ORIGINS = [
  "https://wakilisha.africa",
  "https://www.wakilisha.africa",
  "https://staging.wakilisha.africa",
  "http://localhost:5173",
  "http://localhost:3000",
];

function corsHeaders(req: Request): Record<string, string> {
  const origin = req.headers.get("Origin") ?? "";
  const allowed = ALLOWED_ORIGINS.includes(origin) || origin.endsWith(".wakilisha.africa");
  return {
    "Access-Control-Allow-Origin": allowed ? origin : ALLOWED_ORIGINS[0],
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    Vary: "Origin",
  };
}

function json(req: Request, body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders(req), "Content-Type": "application/json" },
  });
}

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

async function sha256Hex(value: unknown): Promise<string> {
  const bytes = new TextEncoder().encode(JSON.stringify(value));
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

function classifyArtistType(name: string): {
  type: "solo" | "group" | "band" | "duo" | "collective";
  heuristic: string;
} {
  const value = name.trim();
  const lower = value.toLowerCase().replace(/\s+/g, " ");
  if (/\b(band|orchestra|ensemble|quartet|quintet|symphony|philharmonic)\b/i.test(lower) || /(?:boys|boyz)\b/i.test(lower)) {
    return { type: "band", heuristic: "name-pattern:band" };
  }
  if (/\bduo\b/i.test(lower)) return { type: "duo", heuristic: "name-pattern:duo" };
  if (/\b(collective|crew|family)\b/i.test(lower) || /\ball[ -]?stars?\b/i.test(lower)) {
    return { type: "collective", heuristic: "name-pattern:collective" };
  }
  if (/\btrio\b/i.test(lower) || /^the\s+\w/i.test(lower) || /\s+&\s+/.test(value) || /\band\b/i.test(lower) || /\b(gang|squad|unit|mob)\b/i.test(lower) || /\b(feat|ft)\.?\s+/i.test(lower) || /\b\w+\s+x\s+\w+\b/i.test(value)) {
    return { type: "group", heuristic: "name-pattern:group" };
  }
  return { type: "solo", heuristic: "name-pattern:default-solo" };
}

interface ArtistRow {
  id: string;
  slug: string;
  display_name: string;
  normalized_name: string | null;
  public_image_url: string | null;
  image_source_provider: string | null;
  bio: string | null;
  artist_type: string | null;
  metadata: Record<string, unknown>;
  status: string;
}

interface ProviderImage {
  url: string;
  width: number;
  height: number;
}

interface SpotifyObservation {
  provider: "spotify";
  id: string;
  name: string;
  image: ProviderImage | null;
  followers: number | null;
  popularity: number | null;
  genres: string[];
  sourceRef: string;
  sourcePayloadFingerprint: string;
}

interface AppleObservation {
  provider: "apple_music";
  id: string;
  name: string;
  image: ProviderImage | null;
  bio: string | null;
  genres: string[];
  sourceRef: string;
  sourcePayloadFingerprint: string;
}

interface MusicBrainzObservation {
  provider: "musicbrainz";
  id: string;
  name: string;
  artistType: "solo" | "group" | "band" | "collective" | "duo" | null;
  providerType: string | null;
  score: number;
  sourceRef: string;
  sourcePayloadFingerprint: string;
}

interface ProviderResponse {
  ok: boolean;
  observedAt: string;
  artist: { id: string; slug: string; displayName: string; normalizedName: string | null };
  spotify: SpotifyObservation | null;
  appleMusic: AppleObservation | null;
  musicBrainz: MusicBrainzObservation | null;
  error?: string;
}

type OperationOutcome = {
  evidenceAssertionId: string;
  operationId: string;
  verifierStatus: string;
  idempotentReplay: boolean;
};

async function invokeProviderFetch(
  authorization: string,
  artistId: string,
  providers: string[],
  includeMusicBrainz: boolean,
): Promise<ProviderResponse> {
  const response = await fetch(`${SUPABASE_URL}/functions/v1/registry-artist-provider-fetch`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: authorization,
      apikey: ANON_KEY,
    },
    body: JSON.stringify({
      artist_id: artistId,
      providers,
      include_musicbrainz: includeMusicBrainz,
    }),
  });
  const body = await response.json() as ProviderResponse;
  if (!response.ok || !body.ok) {
    throw new Error(body.error || `provider_fetch_http_${response.status}`);
  }
  return body;
}

async function prepareEvidence(
  db: ReturnType<typeof createClient>,
  rpcName: string,
  args: Record<string, unknown>,
): Promise<string> {
  const { data, error } = await db.rpc(rpcName, args);
  if (error) throw new Error(error.message);
  const value = Array.isArray(data) ? data[0] : data;
  const evidenceId = typeof value === "string"
    ? value
    : String((value as Record<string, unknown> | null)?.admin_prepare_registry_artist_provider_profile_evidence ?? "");
  if (!isUuid(evidenceId)) throw new Error(`${rpcName}:missing_evidence_assertion_id`);
  return evidenceId;
}

async function verifyOperation(
  db: ReturnType<typeof createClient>,
  operationId: string,
): Promise<string> {
  const { data, error } = await db.rpc(
    "admin_verify_registry_artist_enrichment_admission",
    { p_operation_id: operationId },
  );
  if (error) throw new Error(error.message);
  const row = Array.isArray(data) ? data[0] : data;
  const status = String(row?.verifier_status ?? "");
  if (status !== "passed") throw new Error(`verification_failed:${operationId}`);
  return status;
}

async function executeReviewedEvidence(
  db: ReturnType<typeof createClient>,
  evidenceId: string,
): Promise<OperationOutcome> {
  const { data, error } = await db.rpc(
    "admin_execute_registry_artist_enrichment_evidence_admission",
    { p_evidence_assertion_id: evidenceId },
  );
  if (error) throw new Error(error.message);
  const row = Array.isArray(data) ? data[0] : data;
  const operationId = String(row?.operation_id ?? "");
  if (!operationId) throw new Error("reviewed_evidence_admission:missing_operation_id");
  const verifierStatus = await verifyOperation(db, operationId);
  return {
    evidenceAssertionId: evidenceId,
    operationId,
    verifierStatus,
    idempotentReplay: Boolean(row?.idempotent_replay),
  };
}

function mergeGenres(...sources: Array<string[] | undefined | null>): string[] {
  return [...new Set(
    sources.flatMap((source) => source ?? [])
      .map((genre) => genre.trim())
      .filter(Boolean),
  )].sort((a, b) => a.localeCompare(b));
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders(req) });
  if (req.method !== "POST") return json(req, { error: "method_not_allowed" }, 405);

  const authorization = req.headers.get("Authorization");
  if (!authorization?.startsWith("Bearer ")) return json(req, { error: "unauthorized" }, 401);
  const token = authorization.slice("Bearer ".length);
  const callerDb = createClient(SUPABASE_URL, ANON_KEY, {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false },
  });
  const { data: { user }, error: userError } = await callerDb.auth.getUser(token);
  if (userError || !user) return json(req, { error: "unauthorized" }, 401);
  const { data: canManage, error: capabilityError } = await callerDb.rpc(
    "current_user_has_capability",
    { required_capability: "manage_registry" },
  );
  if (capabilityError || canManage !== true) return json(req, { error: "forbidden" }, 403);

  let body: {
    dry_run?: boolean;
    approved?: boolean;
    evidence_ids?: string[];
    artist_id?: string;
    artist_slug?: string;
    artist_ids?: string[];
    batch_size?: number;
    filter?: string;
    providers?: string[];
    force?: boolean;
    include_type?: boolean;
    use_musicbrainz?: boolean;
  };
  try {
    body = await req.json();
  } catch {
    return json(req, { error: "invalid_json" }, 400);
  }

  const dryRun = body.dry_run !== false;

  if (!dryRun) {
    if (body.approved !== true) {
      return json(req, {
        error: "approval_required",
        message: "Applying Artist enrichment requires approved=true over reviewed evidence.",
      }, 409);
    }
    const evidenceIds = Array.isArray(body.evidence_ids)
      ? [...new Set(body.evidence_ids.map(String).filter(isUuid))].slice(0, 200)
      : [];
    if (!evidenceIds.length) {
      return json(req, {
        error: "reviewed_evidence_required",
        message: "Apply requires immutable evidence IDs returned by preview.",
      }, 409);
    }

    const outcomes: OperationOutcome[] = [];
    const failures: Array<{ evidenceAssertionId: string; error: string }> = [];
    for (const evidenceId of evidenceIds) {
      try {
        outcomes.push(await executeReviewedEvidence(callerDb, evidenceId));
      } catch (error) {
        failures.push({
          evidenceAssertionId: evidenceId,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    return json(req, {
      ok: failures.length === 0,
      dry_run: false,
      approved: true,
      total_found: evidenceIds.length,
      updated: outcomes.length,
      skipped: 0,
      no_data: 0,
      errors: failures.length,
      reviewed_evidence_ids: evidenceIds,
      results: [{
        status: failures.length === 0 ? "updated" : "error",
        admissionStatus: failures.length === 0 ? "admitted" : "partial_failure",
        operations: outcomes,
        failures,
        changes: {},
        providersTried: [],
        providersFound: [],
      }],
    }, failures.length === 0 ? 200 : 409);
  }

  const requestedProviders = Array.isArray(body.providers)
    ? body.providers.filter((provider) => ["spotify", "apple_music"].includes(provider))
    : ["spotify", "apple_music"];
  const includeType = body.include_type === true;
  const useMusicBrainz = body.use_musicbrainz !== false;
  const force = body.force === true;
  const filterMode = String(body.filter || "missing_image");
  const batchSize = Math.min(Math.max(Number(body.batch_size) || 20, 1), 50);

  let query = callerDb
    .from("registry_artists")
    .select("id,slug,display_name,normalized_name,public_image_url,image_source_provider,bio,artist_type,metadata,status")
    .in("status", ["active", "draft"]);

  const exactIds = Array.isArray(body.artist_ids)
    ? [...new Set(body.artist_ids.map(String).filter(isUuid))].slice(0, 50)
    : [];
  const exactId = String(body.artist_id || "").trim();
  const exactSlug = String(body.artist_slug || "").trim();

  if (exactIds.length > 0) {
    query = query.in("id", exactIds);
  } else if (isUuid(exactId)) {
    query = query.eq("id", exactId);
  } else if (exactSlug) {
    query = query.eq("slug", exactSlug);
  } else {
    if (filterMode === "missing_image") {
      query = query.or("public_image_url.is.null,public_image_url.not.like.http%");
    } else if (filterMode === "missing_bio") {
      query = query.is("bio", null);
    } else if (filterMode === "missing_type") {
      query = query.or("artist_type.is.null,artist_type.eq.unknown");
    }
    query = query.limit(batchSize);
  }

  const { data: artistRows, error: artistError } = await query;
  if (artistError) return json(req, { error: "artist_read_failed", detail: artistError.message }, 500);
  const artists = (artistRows ?? []) as ArtistRow[];

  const results: Array<Record<string, unknown>> = [];
  const allEvidenceIds: string[] = [];
  let updated = 0;
  let skipped = 0;
  let noData = 0;
  let errors = 0;
  const providerAvailability = {
    spotify: { connected: false as boolean },
    apple_music: { connected: false as boolean },
    musicbrainz: { connected: false as boolean },
  };

  for (const artist of artists) {
    try {
      const providerData = await invokeProviderFetch(
        authorization,
        artist.id,
        requestedProviders,
        includeType && useMusicBrainz,
      );
      providerAvailability.spotify.connected ||= Boolean(providerData.spotify);
      providerAvailability.apple_music.connected ||= Boolean(providerData.appleMusic);
      providerAvailability.musicbrainz.connected ||= Boolean(providerData.musicBrainz);

      const providersTried = [
        ...requestedProviders,
        ...(includeType && useMusicBrainz ? ["musicbrainz"] : []),
      ];
      const providersFound = [
        ...(providerData.spotify ? ["spotify"] : []),
        ...(providerData.appleMusic ? ["apple_music"] : []),
        ...(providerData.musicBrainz ? ["musicbrainz"] : []),
      ];

      const genres = mergeGenres(providerData.spotify?.genres, providerData.appleMusic?.genres);
      const providerProfile: Record<string, unknown> = {};
      if (providerData.spotify?.id) providerProfile.spotify_id = providerData.spotify.id;
      if (providerData.appleMusic?.id) providerProfile.apple_music_id = providerData.appleMusic.id;
      if (providerData.spotify?.followers != null) providerProfile.spotify_followers = providerData.spotify.followers;
      if (providerData.spotify?.popularity != null) providerProfile.spotify_popularity = providerData.spotify.popularity;
      if (genres.length > 0) providerProfile.enriched_genres = genres;

      const images = [providerData.spotify?.image, providerData.appleMusic?.image]
        .filter((image): image is ProviderImage => Boolean(image?.url))
        .sort((a, b) => b.width - a.width);
      const image = images[0] ?? null;
      const imageSource = image && providerData.appleMusic?.image?.url === image.url
        ? "apple_music"
        : image ? "spotify" : null;
      const imageObservation = imageSource === "apple_music" ? providerData.appleMusic : providerData.spotify;
      const proposedBio = providerData.appleMusic?.bio?.trim() || null;

      const heuristic = classifyArtistType(artist.display_name);
      const proposedType = providerData.musicBrainz?.artistType ?? heuristic.type;
      const typeSourceKind = providerData.musicBrainz?.artistType ? "musicbrainz" : "name_heuristic";
      const typeSourceRef = providerData.musicBrainz?.artistType
        ? providerData.musicBrainz.sourceRef
        : `heuristic:name-v1:${heuristic.heuristic}`;
      const typeSourceFingerprint = providerData.musicBrainz?.artistType
        ? providerData.musicBrainz.sourcePayloadFingerprint
        : await sha256Hex({ artistId: artist.id, displayName: artist.display_name, result: heuristic });

      const currentGenres = Array.isArray(artist.metadata?.enriched_genres)
        ? (artist.metadata.enriched_genres as unknown[]).map(String)
        : [];
      const changes: Record<string, unknown> = {};
      if (image && (force || !artist.public_image_url || !artist.public_image_url.startsWith("http"))) {
        changes.image = { old: artist.public_image_url, new: image.url, source: imageSource };
      }
      if (proposedBio && (force || !artist.bio)) {
        changes.bio = { old: artist.bio, new: proposedBio, source: "apple_music" };
      }
      if (genres.length > 0 && (force || JSON.stringify([...currentGenres].sort()) !== JSON.stringify(genres))) {
        changes.genres = { old: currentGenres, new: genres, source: providerData.spotify && providerData.appleMusic ? "spotify + apple_music" : providerData.spotify ? "spotify" : "apple_music" };
      }
      if (includeType && proposedType && (force || !artist.artist_type || artist.artist_type === "unknown")) {
        changes.type = {
          old: artist.artist_type,
          new: proposedType,
          source: typeSourceKind,
          heuristic: heuristic.heuristic,
          musicbrainzType: providerData.musicBrainz?.providerType ?? null,
          score: providerData.musicBrainz?.score ?? null,
        };
      }

      const metadataChanged = Object.entries(providerProfile).some(([key, value]) =>
        JSON.stringify(artist.metadata?.[key]) !== JSON.stringify(value)
      );
      const hasChanges = metadataChanged || Object.keys(changes).length > 0;
      if (!providersFound.length && !includeType) {
        noData++;
        results.push({
          id: artist.id,
          slug: artist.slug,
          name: artist.display_name,
          status: "no_data",
          providersTried,
          providersFound,
          changes: {},
          evidenceIds: [],
          message: "No matching provider evidence found.",
        });
        continue;
      }
      if (!hasChanges) {
        skipped++;
        results.push({
          id: artist.id,
          slug: artist.slug,
          name: artist.display_name,
          status: "skipped",
          providersTried,
          providersFound,
          changes: {},
          evidenceIds: [],
          message: "No governed enrichment change is proposed.",
        });
        continue;
      }

      const proposedOperations: Array<Record<string, unknown>> = [];
      const evidenceIds: string[] = [];

      if (metadataChanged && Object.keys(providerProfile).length > 0) {
        const combinedSource = providerData.spotify && providerData.appleMusic
          ? "spotify_apple_music"
          : providerData.spotify ? "spotify" : "apple_music";
        const combinedRef = [providerData.spotify?.sourceRef, providerData.appleMusic?.sourceRef]
          .filter(Boolean)
          .join(" | ");
        const combinedFingerprint = await sha256Hex({
          spotify: providerData.spotify && {
            id: providerData.spotify.id,
            followers: providerData.spotify.followers,
            popularity: providerData.spotify.popularity,
            genres: providerData.spotify.genres,
            fingerprint: providerData.spotify.sourcePayloadFingerprint,
          },
          appleMusic: providerData.appleMusic && {
            id: providerData.appleMusic.id,
            genres: providerData.appleMusic.genres,
            fingerprint: providerData.appleMusic.sourcePayloadFingerprint,
          },
        });
        const evidenceId = await prepareEvidence(callerDb, "admin_prepare_registry_artist_provider_profile_evidence", {
          p_artist_id: artist.id,
          p_spotify_id: providerData.spotify?.id ?? null,
          p_apple_music_id: providerData.appleMusic?.id ?? null,
          p_spotify_followers: providerData.spotify?.followers ?? null,
          p_spotify_popularity: providerData.spotify?.popularity ?? null,
          p_enriched_genres: genres.length ? genres : null,
          p_source_kind: combinedSource,
          p_source_ref: combinedRef,
          p_source_payload_fingerprint: combinedFingerprint,
          p_observed_at: providerData.observedAt,
        });
        evidenceIds.push(evidenceId);
        proposedOperations.push({ operation: "provider_profile", payload: providerProfile, source: combinedSource, evidenceId });
      }

      if (changes.image && image && imageSource && imageObservation) {
        const evidenceId = await prepareEvidence(callerDb, "admin_prepare_registry_artist_public_image_evidence", {
          p_artist_id: artist.id,
          p_public_image_url: image.url,
          p_image_source_provider: imageSource,
          p_source_ref: imageObservation.sourceRef,
          p_source_payload_fingerprint: imageObservation.sourcePayloadFingerprint,
          p_observed_at: providerData.observedAt,
        });
        evidenceIds.push(evidenceId);
        proposedOperations.push({ operation: "public_image", value: image.url, source: imageSource, evidenceId });
      }

      if (changes.bio && proposedBio && providerData.appleMusic) {
        const evidenceId = await prepareEvidence(callerDb, "admin_prepare_registry_artist_bio_evidence", {
          p_artist_id: artist.id,
          p_bio: proposedBio,
          p_source_kind: "apple_music",
          p_source_ref: providerData.appleMusic.sourceRef,
          p_source_payload_fingerprint: providerData.appleMusic.sourcePayloadFingerprint,
          p_observed_at: providerData.observedAt,
        });
        evidenceIds.push(evidenceId);
        proposedOperations.push({ operation: "bio", value: proposedBio, source: "apple_music", evidenceId });
      }

      if (changes.type && proposedType) {
        const evidenceId = await prepareEvidence(callerDb, "admin_prepare_registry_artist_type_evidence", {
          p_artist_id: artist.id,
          p_artist_type: proposedType,
          p_source_kind: typeSourceKind,
          p_source_ref: typeSourceRef,
          p_source_payload_fingerprint: typeSourceFingerprint,
          p_observed_at: providerData.observedAt,
        });
        evidenceIds.push(evidenceId);
        proposedOperations.push({ operation: "artist_type", value: proposedType, source: typeSourceKind, evidenceId });
      }

      allEvidenceIds.push(...evidenceIds);
      updated++;
      results.push({
        id: artist.id,
        slug: artist.slug,
        name: artist.display_name,
        status: "updated",
        admissionStatus: "proposed",
        providersTried,
        providersFound,
        changes,
        proposedOperations,
        evidenceIds,
      });
    } catch (error) {
      errors++;
      results.push({
        id: artist.id,
        slug: artist.slug,
        name: artist.display_name,
        status: "error",
        providersTried: requestedProviders,
        providersFound: [],
        changes: {},
        evidenceIds: [],
        message: error instanceof Error ? error.message : String(error),
      });
    }
  }

  return json(req, {
    ok: true,
    dry_run: true,
    approved: false,
    force,
    total_found: artists.length,
    updated,
    skipped,
    no_data: noData,
    errors,
    provider_status: providerAvailability,
    reviewed_artist_ids: results
      .filter((result) => result.status === "updated")
      .map((result) => String(result.id)),
    reviewed_evidence_ids: allEvidenceIds,
    results,
  });
});
