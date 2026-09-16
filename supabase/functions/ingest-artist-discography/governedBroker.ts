import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import {
  freezeReviewedDiscographyPlan,
  type DiscographyApplySelection,
  type DiscographyProviderObservation,
  type FrozenReviewedDiscographyPlan,
} from "./governedPlan.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

export type CallerAuthority = {
  authorization: string;
  userId: string;
  db: ReturnType<typeof createClient>;
};

type ProviderFetchResponse = {
  ok: boolean;
  observation?: DiscographyProviderObservation;
  source_payload_fingerprint?: string;
  error?: string;
  detail?: string;
};

export type PreparedDiscographyEvidence = {
  evidenceAssertionId: string;
  providerSourcePayloadFingerprint: string;
  observation: DiscographyProviderObservation;
};

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function unwrapSingleValue(data: unknown, label: string): string {
  const value = Array.isArray(data) ? data[0] : data;
  if (typeof value === "string") return value;
  if (value && typeof value === "object") {
    const entries = Object.values(value as Record<string, unknown>);
    if (entries.length === 1 && typeof entries[0] === "string") return entries[0];
  }
  throw new Error(`${label}: missing scalar response.`);
}

export async function authorizeDiscographyCaller(req: Request): Promise<CallerAuthority> {
  const authorization = req.headers.get("Authorization") ?? "";
  if (!authorization.startsWith("Bearer ")) throw new Error("unauthorized");

  const token = authorization.slice("Bearer ".length);
  const db = createClient(SUPABASE_URL, ANON_KEY, {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false },
  });

  const { data: { user }, error: userError } = await db.auth.getUser(token);
  if (userError || !user) throw new Error("unauthorized");

  const { data: canManage, error: capabilityError } = await db.rpc(
    "current_user_has_capability",
    { required_capability: "manage_registry" },
  );
  if (capabilityError || canManage !== true) throw new Error("forbidden");

  return { authorization, userId: user.id, db };
}

export async function fetchDiscographyProviderObservation(input: {
  authorization: string;
  artistId: string;
  albumIds?: string[];
}): Promise<{
  observation: DiscographyProviderObservation;
  sourcePayloadFingerprint: string;
}> {
  if (!isUuid(input.artistId)) throw new Error("invalid_artist_id");

  const response = await fetch(
    `${SUPABASE_URL}/functions/v1/registry-discography-provider-fetch`,
    {
      method: "POST",
      headers: {
        Authorization: input.authorization,
        apikey: ANON_KEY,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        artist_id: input.artistId,
        album_ids: input.albumIds,
      }),
    },
  );

  const body = await response.json() as ProviderFetchResponse;
  if (!response.ok || !body.ok || !body.observation || !body.source_payload_fingerprint) {
    throw new Error(body.detail || body.error || `provider_fetch_http_${response.status}`);
  }

  return {
    observation: body.observation,
    sourcePayloadFingerprint: body.source_payload_fingerprint,
  };
}

export async function recordImmutableDiscographyEvidence(input: {
  db: ReturnType<typeof createClient>;
  artistId: string;
  observation: DiscographyProviderObservation;
  sourcePayloadFingerprint: string;
}): Promise<PreparedDiscographyEvidence> {
  const { data, error } = await input.db.rpc(
    "admin_prepare_registry_discography_evidence_v1",
    {
      p_artist_id: input.artistId,
      p_observation: input.observation,
      p_source_payload_fingerprint: input.sourcePayloadFingerprint,
    },
  );
  if (error) throw new Error(error.message);

  const evidenceAssertionId = unwrapSingleValue(
    data,
    "admin_prepare_registry_discography_evidence_v1",
  );
  if (!isUuid(evidenceAssertionId)) {
    throw new Error("discography_evidence_missing_id");
  }

  return {
    evidenceAssertionId,
    providerSourcePayloadFingerprint: input.sourcePayloadFingerprint,
    observation: input.observation,
  };
}

export async function previewImmutableDiscographyEvidence(input: {
  db: ReturnType<typeof createClient>;
  evidenceAssertionId: string;
}): Promise<Record<string, unknown>> {
  if (!isUuid(input.evidenceAssertionId)) throw new Error("invalid_evidence_assertion_id");
  const { data, error } = await input.db.rpc(
    "admin_preview_registry_discography_evidence_v1",
    { p_evidence_assertion_id: input.evidenceAssertionId },
  );
  if (error) throw new Error(error.message);
  const value = Array.isArray(data) ? data[0] : data;
  if (!value || typeof value !== "object") {
    throw new Error("discography_preview_missing_payload");
  }
  return value as Record<string, unknown>;
}

export function freezeReviewedSelection(input: {
  artistId: string;
  evidence: PreparedDiscographyEvidence;
  selections: DiscographyApplySelection[];
}): FrozenReviewedDiscographyPlan {
  return freezeReviewedDiscographyPlan({
    exact_artist_id: input.artistId,
    provider_source_payload_fingerprint: input.evidence.providerSourcePayloadFingerprint,
    observation: input.evidence.observation,
    selections: input.selections,
  });
}

export async function executeReviewedDiscographyEvidence(input: {
  db: ReturnType<typeof createClient>;
  artistId: string;
  evidenceAssertionId: string;
  selections: DiscographyApplySelection[];
}): Promise<Record<string, unknown>> {
  if (!isUuid(input.artistId)) throw new Error("invalid_artist_id");
  if (!isUuid(input.evidenceAssertionId)) throw new Error("invalid_evidence_assertion_id");

  const { data, error } = await input.db.rpc(
    "admin_execute_registry_discography_evidence_v1",
    {
      p_artist_id: input.artistId,
      p_evidence_assertion_id: input.evidenceAssertionId,
      p_reviewed_selections: input.selections,
    },
  );
  if (error) throw new Error(error.message);

  const value = Array.isArray(data) ? data[0] : data;
  if (!value || typeof value !== "object") {
    throw new Error("discography_apply_missing_payload");
  }
  return value as Record<string, unknown>;
}

export async function createReviewedDiscographyArtistShell(input: {
  db: ReturnType<typeof createClient>;
  currentArtistId: string;
  artistName: string;
}): Promise<Record<string, unknown>> {
  if (!isUuid(input.currentArtistId)) throw new Error("invalid_artist_id");
  const artistName = input.artistName.trim();
  if (artistName.length < 2) throw new Error("invalid_artist_name");

  const { data, error } = await input.db.rpc(
    "admin_create_registry_discography_artist_shell_v1",
    {
      p_current_artist_id: input.currentArtistId,
      p_artist_name: artistName,
    },
  );
  if (error) throw new Error(error.message);

  const value = Array.isArray(data) ? data[0] : data;
  if (!value || typeof value !== "object") {
    throw new Error("discography_artist_shell_missing_payload");
  }
  return value as Record<string, unknown>;
}
