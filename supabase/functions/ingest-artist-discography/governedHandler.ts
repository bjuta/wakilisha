import {
  authorizeDiscographyCaller,
  createReviewedDiscographyArtistShell,
  executeReviewedDiscographyEvidence,
  fetchDiscographyProviderObservation,
  previewImmutableDiscographyEvidence,
  recordImmutableDiscographyEvidence,
} from "./governedBroker.ts";
import type { DiscographyApplySelection } from "./governedPlan.ts";

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

function parseSelections(raw: unknown): DiscographyApplySelection[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((value) => {
    const row = value && typeof value === "object"
      ? value as Record<string, unknown>
      : {};
    const rawAdditional = Array.isArray(row.additional_primary_artists)
      ? row.additional_primary_artists
      : [];
    return {
      apple_music_id: String(row.apple_music_id ?? "").trim(),
      action: String(row.action ?? "ignore") as DiscographyApplySelection["action"],
      additional_primary_artists: rawAdditional.map((artist) => {
        const record = artist && typeof artist === "object"
          ? artist as Record<string, unknown>
          : {};
        return {
          artist_id: String(record.artist_id ?? "").trim(),
          artist_slug: String(record.artist_slug ?? "").trim(),
          artist_name: String(record.artist_name ?? "").trim(),
        };
      }),
    };
  });
}

function statusForError(message: string): number {
  if (message === "unauthorized") return 401;
  if (message === "forbidden") return 403;
  if (message.startsWith("invalid_")) return 400;
  if (message.includes("not found") || message.includes("not_found")) return 404;
  if (
    message.includes("required") ||
    message.includes("different Artist") ||
    message.includes("immutable") ||
    message.includes("stale") ||
    message.includes("fingerprint") ||
    message.includes("idempotency") ||
    message.includes("budget")
  ) return 409;
  return 500;
}

export async function handleGovernedDiscographyRequest(req: Request): Promise<Response> {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders(req) });
  if (req.method !== "POST") return json(req, { ok: false, error: "method_not_allowed" }, 405);

  const startedAt = Date.now();

  try {
    const caller = await authorizeDiscographyCaller(req);

    let body: Record<string, unknown>;
    try {
      body = await req.json() as Record<string, unknown>;
    } catch {
      return json(req, { ok: false, error: "invalid_json" }, 400);
    }

    const artistId = String(body.artist_id ?? "").trim();
    if (!isUuid(artistId)) return json(req, { ok: false, error: "invalid_artist_id" }, 400);

    const mode = String(body.mode ?? "preview").trim();

    if (mode === "preview") {
      const provider = await fetchDiscographyProviderObservation({
        authorization: caller.authorization,
        artistId,
      });
      const evidence = await recordImmutableDiscographyEvidence({
        db: caller.db,
        artistId,
        observation: provider.observation,
        sourcePayloadFingerprint: provider.sourcePayloadFingerprint,
      });
      const preview = await previewImmutableDiscographyEvidence({
        db: caller.db,
        evidenceAssertionId: evidence.evidenceAssertionId,
      });

      return json(req, {
        ok: true,
        mode: "preview",
        ...preview,
        evidence_assertion_id: evidence.evidenceAssertionId,
        provider_source_payload_fingerprint: evidence.providerSourcePayloadFingerprint,
        duration_ms: Date.now() - startedAt,
      });
    }

    if (mode === "create_artist_shell") {
      if (body.approved !== true) {
        return json(req, {
          ok: false,
          error: "approval_required",
          detail: "Artist shell creation requires explicit review approval.",
        }, 409);
      }

      const artistName = String(body.artist_name ?? body.artistName ?? "").trim();
      const result = await createReviewedDiscographyArtistShell({
        db: caller.db,
        currentArtistId: artistId,
        artistName,
      });
      return json(req, {
        ok: true,
        mode: "create_artist_shell",
        ...result,
        duration_ms: Date.now() - startedAt,
      });
    }

    if (mode === "apply") {
      if (body.approved !== true) {
        return json(req, {
          ok: false,
          error: "approval_required",
          detail: "Discography apply requires explicit review approval.",
        }, 409);
      }

      const evidenceAssertionId = String(body.evidence_assertion_id ?? "").trim();
      if (!isUuid(evidenceAssertionId)) {
        return json(req, { ok: false, error: "invalid_evidence_assertion_id" }, 400);
      }

      const selections = parseSelections(body.selected_albums);
      if (!selections.length) {
        return json(req, { ok: false, error: "reviewed_selections_required" }, 400);
      }

      const result = await executeReviewedDiscographyEvidence({
        db: caller.db,
        artistId,
        evidenceAssertionId,
        selections,
      });

      return json(req, {
        ok: true,
        mode: "apply",
        ...result,
        duration_ms: Date.now() - startedAt,
      });
    }

    return json(req, { ok: false, error: "unknown_mode" }, 400);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return json(req, {
      ok: false,
      error: message,
      duration_ms: Date.now() - startedAt,
    }, statusForError(message));
  }
}
