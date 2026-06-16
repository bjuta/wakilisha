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
}

function parseCsv(text: string): ArtistCsvRow[] {
  const lines = text.split(/\r?\n/).filter((l) => l.trim());
  if (lines.length < 2) return [];
  const headers = lines[0].split(",").map((h) => h.trim().toLowerCase().replace(/^"|"$/g, ""));
  const rows: ArtistCsvRow[] = [];
  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split(",").map((v) => v.trim().replace(/^"|"$/g, ""));
    const row: Record<string, string> = {};
    headers.forEach((h, idx) => { row[h] = values[idx] || ""; });
    rows.push({
      artist_name: row.artist_name || "",
      spotify_id: row.spotify_id || "",
      spotify_uri: row.spotify_uri || "",
      origin_iso2: row.origin_iso2 || "",
      popularity: row.popularity || "",
      followers: row.followers || "",
      genres: row.genres || "",
    });
  }
  return rows;
}

function normaliseName(name: string): string {
  return name.trim().toLowerCase();
}

function parseGenres(genresStr: string): string[] {
  if (!genresStr) return [];
  return genresStr.split(",").map((g) => g.trim()).filter(Boolean);
}

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, "")
    .replace(/\s+/g, "-")
    .substring(0, 80);
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseKey);

  try {
    const body = await req.json();
    const { action } = body;

    // ─────────────────────────────────────────────────────────────
    // ACTION: upload_csv
    // ─────────────────────────────────────────────────────────────
    if (action === "upload_csv") {
      const { csvText, actor } = body;
      if (!csvText) throw new Error("csvText is required");

      const rows = parseCsv(csvText);
      if (rows.length === 0) throw new Error("CSV is empty or could not be parsed");

      const { data: run, error: runError } = await supabase
        .from("provider_intake_runs")
        .insert({
          provider: "csv_manual_upload",
          provider_entity_type: "artist",
          provider_entity_id: crypto.randomUUID(),
          mode: "artist_intake",
          actor: actor || "system",
          status: "matching",
          summary_json: { totalRows: rows.length },
          idempotency_key: crypto.randomUUID(),
        })
        .select()
        .single();

      if (runError || !run) throw new Error(`Failed to create intake run: ${runError?.message}`);

      const stagingRecords = rows.map((row) => ({
        intake_run_id: run.id,
        source_artist_name: row.artist_name.trim(),
        source_normalized_name: normaliseName(row.artist_name),
        source_spotify_id: row.spotify_id || null,
        source_spotify_uri: row.spotify_uri || null,
        source_origin_iso2: row.origin_iso2 || null,
        source_popularity: row.popularity ? parseInt(row.popularity, 10) : null,
        source_followers: row.followers ? parseInt(row.followers, 10) : null,
        source_genres: parseGenres(row.genres),
        source_metadata: {
          raw_popularity: row.popularity,
          raw_followers: row.followers,
          raw_genres: row.genres,
        },
      }));

      const { error: insertError } = await supabase
        .from("provider_intake_artist_staging")
        .insert(stagingRecords);

      if (insertError) throw new Error(`Failed to insert staging records: ${insertError.message}`);

      const { data: matchResult, error: matchError } = await supabase.rpc("run_artist_intake_matching", { p_intake_run_id: run.id });
      if (matchError) throw new Error(`Matching failed: ${matchError.message}`);

      return new Response(JSON.stringify({ ok: true, runId: run.id, matchSummary: matchResult }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ─────────────────────────────────────────────────────────────
    // ACTION: get_staging_results
    // ─────────────────────────────────────────────────────────────
    if (action === "get_staging_results") {
      const { runId, status } = body;
      if (!runId) throw new Error("runId is required");

      let query = supabase
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
          match_status,
          matched_registry_artist_id,
          matched_registry_artist_name,
          match_confidence,
          match_reason,
          review_status,
          review_notes,
          action_taken,
          target_registry_artist_id,
          created_at,
          registry_artists!matched_registry_artist_id(id, display_name, origin_iso2, public_image_url, status)
        `)
        .eq("intake_run_id", runId);

      if (status) {
        query = query.eq("match_status", status);
      }

      const { data, error } = await query.order("source_artist_name", { ascending: true });
      if (error) throw new Error(`Failed to fetch staging results: ${error.message}`);

      return new Response(JSON.stringify({ ok: true, data }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ─────────────────────────────────────────────────────────────
    // ACTION: get_run_summary
    // ─────────────────────────────────────────────────────────────
    if (action === "get_run_summary") {
      const { runId } = body;
      if (!runId) throw new Error("runId is required");

      const { data, error } = await supabase
        .from("provider_intake_artist_staging")
        .select("match_status")
        .eq("intake_run_id", runId);

      if (error) throw new Error(`Failed to get summary: ${error.message}`);

      const summary = {
        exact_matches: data.filter((d) => d.match_status === "exact_match").length,
        fuzzy_matches: data.filter((d) => d.match_status === "fuzzy_match").length,
        no_matches: data.filter((d) => d.match_status === "no_match").length,
        conflicts: data.filter((d) => d.match_status === "conflict").length,
        total: data.length,
      };

      return new Response(JSON.stringify({ ok: true, summary }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ─────────────────────────────────────────────────────────────
    // ACTION: review_decision
    // ─────────────────────────────────────────────────────────────
    if (action === "review_decision") {
      const { runId, decisions, actor } = body;
      if (!runId || !decisions || !Array.isArray(decisions)) throw new Error("runId and decisions array are required");

      const { data: user } = await supabase.auth.getUser();
      const reviewerId = actor || user?.user?.id || null;

      for (const decision of decisions) {
        const { stagingId, decision: actionType, notes, targetRegistryArtistId } = decision;
        
        const updateData: Record<string, unknown> = {
          review_status: actionType,
          reviewed_by: reviewerId,
          reviewed_at: new Date().toISOString(),
          review_notes: notes || null,
        };

        if (actionType === "accepted" && targetRegistryArtistId) {
          updateData.target_registry_artist_id = targetRegistryArtistId;
        }
        if (actionType === "rejected") {
          updateData.action_taken = "skipped";
        }

        const { error: updateError } = await supabase
          .from("provider_intake_artist_staging")
          .update(updateData)
          .eq("id", stagingId)
          .eq("intake_run_id", runId);

        if (updateError) throw new Error(`Failed to update decision: ${updateError.message}`);
      }

      return new Response(JSON.stringify({ ok: true, processed: decisions.length }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ─────────────────────────────────────────────────────────────
    // ACTION: apply_approved
    // ─────────────────────────────────────────────────────────────
    if (action === "apply_approved") {
      const { runId, actor } = body;
      if (!runId) throw new Error("runId is required");

      const { data: user } = await supabase.auth.getUser();
      const reviewerId = actor || user?.user?.id || null;

      const { data: approved, error: fetchError } = await supabase
        .from("provider_intake_artist_staging")
        .select("*")
        .eq("intake_run_id", runId)
        .eq("review_status", "accepted")
        .is("action_taken", null);

      if (fetchError) throw new Error(`Failed to fetch approved records: ${fetchError.message}`);
      if (!approved || approved.length === 0) {
        return new Response(JSON.stringify({ ok: true, created: 0, updated: 0, skipped: 0, message: "No approved records to apply" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      let created = 0;
      let updated = 0;
      let skipped = 0;
      const processedIds: string[] = [];

      for (const record of approved) {
        const { data: existing } = await supabase
          .from("registry_artists")
          .select("id, origin_iso2, metadata, normalized_name")
          .eq("id", record.matched_registry_artist_id || record.target_registry_artist_id)
          .maybeSingle();

        if (existing) {
          const updateData: Record<string, unknown> = {
            updated_at: new Date().toISOString(),
          };

          if (!existing.origin_iso2 && record.source_origin_iso2) {
            updateData.origin_iso2 = record.source_origin_iso2;
            updateData.origin_confidence = 0.85;
          }

          const currentMetadata = (existing.metadata as Record<string, unknown>) || {};
          if (record.source_spotify_id) {
            updateData.metadata = {
              ...currentMetadata,
              spotify_id: record.source_spotify_id,
              spotify_uri: record.source_spotify_uri,
              source_provider: "csv_manual_upload",
              source_intake_run_id: runId,
            };
          }

          const { error: updateError } = await supabase
            .from("registry_artists")
            .update(updateData)
            .eq("id", existing.id);

          if (updateError) {
            skipped++;
            continue;
          }

          updated++;
          processedIds.push(record.id);
        } else {
          if (record.match_status !== "no_match") {
            skipped++;
            continue;
          }

          const displayName = record.source_artist_name;
          const normalized = normaliseName(displayName);
          const slug = slugify(displayName);

          const { data: dupeCheck } = await supabase
            .from("registry_artists")
            .select("id")
            .eq("normalized_name", normalized)
            .maybeSingle();

          if (dupeCheck) {
            skipped++;
            continue;
          }

          const { error: insertError } = await supabase
            .from("registry_artists")
            .insert({
              slug,
              display_name: displayName,
              normalized_name: normalized,
              origin_iso2: record.source_origin_iso2,
              origin_confidence: record.source_origin_iso2 ? 0.85 : null,
              public_image_url: null,
              image_source_provider: null,
              status: "active",
              metadata: {
                spotify_id: record.source_spotify_id,
                spotify_uri: record.source_spotify_uri,
                source_provider: "csv_manual_upload",
                source_intake_run_id: runId,
                source_genres: record.source_genres,
                source_popularity: record.source_popularity,
                source_followers: record.source_followers,
              },
            });

          if (insertError) {
            skipped++;
            continue;
          }

          created++;
          processedIds.push(record.id);
        }
      }

      if (processedIds.length > 0) {
        await supabase
          .from("provider_intake_artist_staging")
          .update({
            action_taken: "processed",
            updated_at: new Date().toISOString(),
          })
          .in("id", processedIds);
      }

      await supabase
        .from("provider_intake_runs")
        .update({
          status: "completed",
          completed_at: new Date().toISOString(),
          summary_json: {
            created,
            updated,
            skipped,
            processedCount: processedIds.length,
          },
        })
        .eq("id", runId);

      return new Response(JSON.stringify({ ok: true, created, updated, skipped }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Unknown action" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err instanceof Error ? err.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
