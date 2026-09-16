import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface ArtistCsvRow {
  artist_name: string;
  spotify_id: string;
  spotify_uri: string;
  origin_iso2: string;
  popularity: string;
  followers: string;
  genres: string;
  image_url: string;
  biography: string;
  profile_url: string;
  latest_release: string;
  top_tracks: string;
}

interface ReviewedArtistIntake {
  staging_id: string;
  intake_run_id: string;
  source_artist_name: string;
  source_normalized_name: string;
  source_spotify_id: string | null;
  source_spotify_uri: string | null;
  source_origin_iso2: string | null;
  source_popularity: number | null;
  source_followers: number | null;
  source_genres: unknown;
  source_images: Record<string, unknown> | null;
  source_metadata: Record<string, unknown> | null;
  match_status: string;
  matched_registry_artist_id: string | null;
  reviewed_by: string;
  reviewed_at: string;
  review_fingerprint: string;
  target_registry_artist_id: string | null;
}

class HttpError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function detectDelimiter(text: string): string {
  const firstLine = text.split(/\r?\n/)[0] || "";
  const tabCount = (firstLine.match(/\t/g) || []).length;
  const commaCount = (firstLine.match(/,/g) || []).length;
  return tabCount > commaCount ? "\t" : ",";
}

function parseCsv(text: string): ArtistCsvRow[] {
  const lines = text.split(/\r?\n/).filter((line) => line.trim());
  if (lines.length < 2) return [];

  const delimiter = detectDelimiter(text);
  const headers = lines[0]
    .split(delimiter)
    .map((header) => header.trim().toLowerCase().replace(/^"|"$/g, ""));
  const rows: ArtistCsvRow[] = [];

  for (let i = 1; i < lines.length; i += 1) {
    const values = lines[i]
      .split(delimiter)
      .map((value) => value.trim().replace(/^"|"$/g, ""));
    const row: Record<string, string> = {};
    headers.forEach((header, index) => {
      row[header] = values[index] || "";
    });

    const artistName = row.artist_name || row.name || "";
    if (!artistName.trim()) continue;

    rows.push({
      artist_name: artistName,
      spotify_id: row.artist_id || row.spotify_id || "",
      spotify_uri: row.spotify_uri || row.profile_url || "",
      origin_iso2: row.origin_country || row.origin_iso2 || row.country || "",
      popularity: row.popularity || "",
      followers: row.followers || "",
      genres: row.genres || "",
      image_url: row.image_url || "",
      biography: row.biography || row.bio || row.description || "",
      profile_url: row.profile_url || row.spotify_url || "",
      latest_release: row.latest_release || "",
      top_tracks: row.top_tracks || "",
    });
  }

  return rows;
}

function normaliseName(name: string): string {
  return name.trim().toLowerCase();
}

function parseGenres(genres: string): string[] {
  if (!genres) return [];
  return Array.from(
    new Set(
      genres
        .split(",")
        .map((genre) => genre.trim())
        .filter(Boolean),
    ),
  );
}

function finiteInteger(value: string): number | null {
  if (!value.trim()) return null;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : null;
}

function reviewedGenres(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return Array.from(
    new Set(
      value
        .filter((genre): genre is string => typeof genre === "string")
        .map((genre) => genre.trim())
        .filter(Boolean),
    ),
  );
}

function reviewedImage(value: Record<string, unknown> | null): string | null {
  if (!value) return null;
  if (typeof value.primary === "string" && value.primary.trim()) {
    return value.primary.trim();
  }
  if (Array.isArray(value.all)) {
    const first = value.all.find((item) => typeof item === "string" && item.trim());
    return typeof first === "string" ? first.trim() : null;
  }
  return null;
}

function reviewedBio(value: Record<string, unknown> | null): string | null {
  const biography = value?.biography;
  return typeof biography === "string" && biography.trim()
    ? biography.trim()
    : null;
}

async function requireManager(req: Request, supabaseUrl: string) {
  const authorization = req.headers.get("Authorization") || "";
  if (!authorization.startsWith("Bearer ")) {
    throw new HttpError(401, "Authentication is required.");
  }

  const token = authorization.slice("Bearer ".length).trim();
  if (!token) throw new HttpError(401, "Authentication is required.");

  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  if (!anonKey) throw new Error("SUPABASE_ANON_KEY is not configured");

  const caller = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authorization } },
  });

  const {
    data: { user },
    error: userError,
  } = await caller.auth.getUser(token);
  if (userError || !user) {
    throw new HttpError(401, "Authentication is required.");
  }

  const { data: canManage, error: capabilityError } = await caller.rpc(
    "current_user_has_capability",
    { required_capability: "manage_registry" },
  );
  if (capabilityError) {
    throw new Error(`Failed to verify Registry capability: ${capabilityError.message}`);
  }
  if (!canManage) {
    throw new HttpError(403, "manage_registry is required.");
  }

  return { caller, user };
}

async function invokeEvidenceAdmission(
  caller: ReturnType<typeof createClient>,
  prepareFunction: string,
  prepareArgs: Record<string, unknown>,
) {
  const { data: evidenceId, error: prepareError } = await caller.rpc(
    prepareFunction,
    prepareArgs,
  );
  if (prepareError || !evidenceId) {
    throw new Error(
      `Failed to prepare reviewed Artist evidence: ${prepareError?.message || "missing evidence ID"}`,
    );
  }

  const { error: executeError } = await caller.rpc(
    "admin_execute_registry_artist_enrichment_evidence_admission",
    { p_evidence_assertion_id: evidenceId },
  );
  if (executeError) {
    throw new Error(`Failed to admit reviewed Artist evidence: ${executeError.message}`);
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return json({ ok: false, error: "Method not allowed" }, 405);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  if (!supabaseUrl) return json({ ok: false, error: "SUPABASE_URL is not configured" }, 500);

  try {
    const { caller, user } = await requireManager(req, supabaseUrl);

    // Service-role authority is used only after the caller is authenticated and
    // authorized. It is limited here to operational intake staging and canonical
    // reads. Canonical Artist writes happen only through caller-bound Registry RPCs.
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!serviceRoleKey) throw new Error("SUPABASE_SERVICE_ROLE_KEY is not configured");
    const admin = createClient(supabaseUrl, serviceRoleKey);

    const body = await req.json();
    const action = String(body?.action || "");

    if (action === "upload_csv") {
      const csvText = typeof body.csvText === "string" ? body.csvText : "";
      if (!csvText.trim()) throw new HttpError(400, "csvText is required");

      const rows = parseCsv(csvText);
      if (rows.length === 0) {
        throw new HttpError(400, "CSV is empty or could not be parsed");
      }

      const { data: run, error: runError } = await admin
        .from("provider_intake_runs")
        .insert({
          provider: "csv_manual_upload",
          provider_entity_type: "artist",
          provider_entity_id: crypto.randomUUID(),
          mode: "artist_intake",
          actor: `user:${user.id}`,
          status: "matching",
          summary_json: { totalRows: rows.length },
          idempotency_key: crypto.randomUUID(),
        })
        .select("id")
        .single();

      if (runError || !run) {
        throw new Error(`Failed to create intake run: ${runError?.message || "missing run"}`);
      }

      const stagingRecords = rows.map((row) => ({
        intake_run_id: run.id,
        source_artist_name: row.artist_name.trim(),
        source_normalized_name: normaliseName(row.artist_name),
        source_spotify_id: row.spotify_id || null,
        source_spotify_uri: row.spotify_uri || null,
        source_origin_iso2: row.origin_iso2.trim().toUpperCase() || null,
        source_popularity: finiteInteger(row.popularity),
        source_followers: finiteInteger(row.followers),
        source_genres: parseGenres(row.genres),
        source_images: row.image_url
          ? { primary: row.image_url.trim(), all: [row.image_url.trim()] }
          : null,
        source_metadata: {
          raw_popularity: row.popularity,
          raw_followers: row.followers,
          raw_genres: row.genres,
          biography: row.biography,
          profile_url: row.profile_url,
          latest_release: row.latest_release,
          top_tracks: row.top_tracks,
        },
      }));

      const { error: insertError } = await admin
        .from("provider_intake_artist_staging")
        .insert(stagingRecords);
      if (insertError) {
        throw new Error(`Failed to insert staging records: ${insertError.message}`);
      }

      const { data: matchResult, error: matchError } = await admin.rpc(
        "run_artist_intake_matching",
        { p_intake_run_id: run.id },
      );
      if (matchError) throw new Error(`Matching failed: ${matchError.message}`);

      return json({ ok: true, runId: run.id, matchSummary: matchResult });
    }

    if (action === "get_staging_results") {
      const runId = typeof body.runId === "string" ? body.runId : "";
      const status = typeof body.status === "string" ? body.status : "";
      if (!runId) throw new HttpError(400, "runId is required");

      let query = admin
        .from("provider_intake_artist_staging")
        .select(`
          id,
          source_artist_name,
          source_normalized_name,
          source_origin_iso2,
          source_spotify_id,
          source_popularity,
          source_followers,
          source_genres,
          source_images,
          source_metadata,
          match_status,
          matched_registry_artist_id,
          matched_registry_artist_name,
          match_confidence,
          match_reason,
          review_status,
          review_notes,
          action_taken,
          target_registry_artist_id,
          applied_registry_artist_id,
          created_at,
          registry_artists!matched_registry_artist_id(id, display_name, origin_iso2, public_image_url, bio, status),
          target_artist:registry_artists!target_registry_artist_id(id, display_name, origin_iso2, public_image_url, bio, status)
        `)
        .eq("intake_run_id", runId);

      if (status) query = query.eq("match_status", status);

      const { data, error } = await query.order("source_artist_name", { ascending: true });
      if (error) throw new Error(`Failed to fetch staging results: ${error.message}`);

      return json({ ok: true, data });
    }

    if (action === "get_run_summary") {
      const runId = typeof body.runId === "string" ? body.runId : "";
      if (!runId) throw new HttpError(400, "runId is required");

      const { data, error } = await admin
        .from("provider_intake_artist_staging")
        .select("match_status")
        .eq("intake_run_id", runId);
      if (error) throw new Error(`Failed to get summary: ${error.message}`);

      const summary = {
        exact_matches: data.filter((row) => row.match_status === "exact_match").length,
        fuzzy_matches: data.filter((row) => row.match_status === "fuzzy_match").length,
        no_matches: data.filter((row) => row.match_status === "no_match").length,
        conflicts: data.filter((row) => row.match_status === "conflict").length,
        total: data.length,
      };

      return json({ ok: true, summary });
    }

    if (action === "review_decision") {
      const runId = typeof body.runId === "string" ? body.runId : "";
      const decisions = Array.isArray(body.decisions) ? body.decisions : null;
      if (!runId || !decisions) {
        throw new HttpError(400, "runId and decisions array are required");
      }

      let processed = 0;
      for (const decision of decisions) {
        const stagingId = typeof decision?.stagingId === "string" ? decision.stagingId : "";
        const actionType = typeof decision?.decision === "string" ? decision.decision : "";
        const notes = typeof decision?.notes === "string" ? decision.notes : "";
        const explicitTarget = typeof decision?.targetRegistryArtistId === "string"
          ? decision.targetRegistryArtistId
          : null;

        if (!stagingId) throw new HttpError(400, "Each review decision requires a stagingId");

        // Keep review targets inside the same active/draft Registry boundary used by
        // the exact Artist origin and enrichment operations.
        if (actionType === "accepted" && explicitTarget) {
          const { data: target, error: targetError } = await admin
            .from("registry_artists")
            .select("id,status")
            .eq("id", explicitTarget)
            .maybeSingle();
          if (targetError) throw new Error(`Failed to validate Artist target: ${targetError.message}`);
          if (!target || !["active", "draft"].includes(target.status)) {
            throw new HttpError(400, "Accepted Artist intake targets must be active or draft Registry Artists.");
          }
        }

        const { error } = await caller.rpc("admin_review_registry_artist_intake_v1", {
          p_intake_run_id: runId,
          p_staging_id: stagingId,
          p_decision: actionType,
          p_notes: notes || null,
          p_target_registry_artist_id: explicitTarget,
        });
        if (error) throw new Error(`Failed to record reviewed Artist intake decision: ${error.message}`);
        processed += 1;
      }

      return json({ ok: true, processed });
    }

    if (action === "apply_approved") {
      const runId = typeof body.runId === "string" ? body.runId : "";
      if (!runId) throw new HttpError(400, "runId is required");

      const { data: approved, error: fetchError } = await admin
        .from("provider_intake_artist_staging")
        .select("id")
        .eq("intake_run_id", runId)
        .eq("review_status", "accepted")
        .is("action_taken", null)
        .order("created_at", { ascending: true });
      if (fetchError) throw new Error(`Failed to fetch approved records: ${fetchError.message}`);

      if (!approved || approved.length === 0) {
        return json({ ok: true, created: 0, updated: 0, skipped: 0, failures: [] });
      }

      let created = 0;
      let updated = 0;
      let skipped = 0;
      const failures: Array<{ stagingId: string; error: string }> = [];

      for (const approvedRow of approved) {
        const stagingId = approvedRow.id as string;
        try {
          const { data: reviewData, error: reviewError } = await caller.rpc(
            "admin_get_registry_artist_intake_review_v1",
            { p_staging_id: stagingId },
          );
          if (reviewError || !reviewData) {
            throw new Error(
              `Reviewed intake authority is not current: ${reviewError?.message || "missing review"}`,
            );
          }

          const review = reviewData as ReviewedArtistIntake;
          if (review.intake_run_id !== runId) {
            throw new Error("Reviewed intake row belongs to a different run.");
          }

          let artistId = review.target_registry_artist_id;
          let createdThisPass = false;

          if (!artistId) {
            const { data: createData, error: createError } = await caller.rpc(
              "admin_create_registry_artist_intake_shell_v1",
              { p_staging_id: stagingId },
            );
            if (createError || !createData) {
              throw new Error(
                `Failed to materialize reviewed Artist draft: ${createError?.message || "missing result"}`,
              );
            }

            const artist = (createData as Record<string, unknown>).artist as
              | Record<string, unknown>
              | undefined;
            artistId = typeof artist?.artist_id === "string" ? artist.artist_id : null;
            createdThisPass = Boolean((createData as Record<string, unknown>).created);
            if (!artistId) throw new Error("Artist creation returned no Registry Artist ID.");
          }

          const { data: currentArtist, error: artistError } = await admin
            .from("registry_artists")
            .select("id,status,origin_iso2,origin_confidence,bio,public_image_url,metadata")
            .eq("id", artistId)
            .maybeSingle();
          if (artistError) throw new Error(`Failed to read Registry Artist: ${artistError.message}`);
          if (!currentArtist || !["active", "draft"].includes(currentArtist.status)) {
            throw new Error("Reviewed Registry Artist target is no longer active or draft.");
          }

          const sourceRef = `artist-intake:${review.intake_run_id}:${review.staging_id}`;
          const fingerprint = review.review_fingerprint;
          const observedAt = review.reviewed_at;

          if (!currentArtist.origin_iso2 && review.source_origin_iso2) {
            const { error: originError } = await caller.rpc(
              "admin_execute_registry_artist_origin_admission",
              {
                p_artist_id: artistId,
                p_origin_iso2: review.source_origin_iso2.trim().toUpperCase(),
                p_confidence: 0.9,
                p_source_kind: "csv_manual_upload",
                p_source_ref: sourceRef,
                p_source_payload_fingerprint: fingerprint,
                p_observed_at: observedAt,
              },
            );
            if (originError) {
              throw new Error(`Failed to admit reviewed Artist origin: ${originError.message}`);
            }
          }

          const genres = reviewedGenres(review.source_genres);
          const providerProfile = {
            spotifyId: review.source_spotify_id?.trim() || null,
            followers: Number.isFinite(review.source_followers) ? review.source_followers : null,
            popularity: Number.isFinite(review.source_popularity) ? review.source_popularity : null,
            genres,
          };
          if (
            providerProfile.spotifyId ||
            providerProfile.followers !== null ||
            providerProfile.popularity !== null ||
            providerProfile.genres.length > 0
          ) {
            await invokeEvidenceAdmission(
              caller,
              "admin_prepare_registry_artist_provider_profile_evidence",
              {
                p_artist_id: artistId,
                p_spotify_id: providerProfile.spotifyId,
                p_apple_music_id: null,
                p_spotify_followers: providerProfile.followers,
                p_spotify_popularity: providerProfile.popularity,
                p_enriched_genres: providerProfile.genres.length > 0 ? providerProfile.genres : null,
                p_source_kind: "csv_manual_upload",
                p_source_ref: sourceRef,
                p_source_payload_fingerprint: fingerprint,
                p_observed_at: observedAt,
              },
            );
          }

          const imageUrl = reviewedImage(review.source_images);
          if (!currentArtist.public_image_url && imageUrl) {
            await invokeEvidenceAdmission(
              caller,
              "admin_prepare_registry_artist_public_image_evidence",
              {
                p_artist_id: artistId,
                p_public_image_url: imageUrl,
                p_image_source_provider: "csv_manual_upload",
                p_source_ref: sourceRef,
                p_source_payload_fingerprint: fingerprint,
                p_observed_at: observedAt,
              },
            );
          }

          const biography = reviewedBio(review.source_metadata);
          if (!currentArtist.bio && biography) {
            await invokeEvidenceAdmission(
              caller,
              "admin_prepare_registry_artist_bio_evidence",
              {
                p_artist_id: artistId,
                p_bio: biography,
                p_source_kind: "csv_manual_upload",
                p_source_ref: sourceRef,
                p_source_payload_fingerprint: fingerprint,
                p_observed_at: observedAt,
              },
            );
          }

          const { error: markError } = await caller.rpc(
            "admin_mark_registry_artist_intake_applied_v1",
            { p_staging_id: stagingId, p_artist_id: artistId },
          );
          if (markError) throw new Error(`Failed to seal Artist intake result: ${markError.message}`);

          if (createdThisPass) created += 1;
          else updated += 1;
        } catch (error) {
          skipped += 1;
          failures.push({
            stagingId,
            error: error instanceof Error ? error.message : "Unknown apply failure",
          });
        }
      }

      await admin
        .from("provider_intake_runs")
        .update({
          summary_json: {
            created,
            updated,
            skipped,
            attemptedCount: approved.length,
            failureCount: failures.length,
          },
        })
        .eq("id", runId);

      return json({ ok: true, created, updated, skipped, failures });
    }

    return json({ ok: false, error: "Unknown action" }, 400);
  } catch (error) {
    const status = error instanceof HttpError ? error.status : 500;
    const message = error instanceof Error ? error.message : "Unknown error";
    return json({ ok: false, error: message }, status);
  }
});
