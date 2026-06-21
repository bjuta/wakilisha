
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js";

const ALLOWED_ORIGINS = [
  "https://wakilisha.africa",
  "https://www.wakilisha.africa",
  "https://staging.wakilisha.africa",
  "http://localhost:5173",
  "http://localhost:3000",
];

function getCorsHeaders(req: Request): Record<string, string> {
  const origin = req.headers.get("Origin") ?? "";
  const allowed = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    "Access-Control-Allow-Origin": allowed,
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Vary": "Origin",
  };
}

function slugify(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

async function verifyAdmin(req: Request): Promise<{ userId: string } | null> {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) return null;

  const token = authHeader.replace("Bearer ", "");
  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

  if (!supabaseUrl || !serviceKey) return null;

  const authClient = createClient(supabaseUrl, serviceKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  });

  const { data: { user }, error } = await authClient.auth.getUser(token);
  if (error || !user) return null;

  // Verify admin capability
  const { data: roles } = await authClient
    .from("user_role_assignments")
    .select("role_key, role_definitions!inner(role_capabilities(capability_key))")
    .eq("user_id", user.id)
    .eq("status", "active")
    .or("expires_at.is.null,expires_at.gt.now()");

  if (!roles || roles.length === 0) return null;

  const isAdmin = roles.some((r: { role_key: string }) => r.role_key === "administrator");
  if (isAdmin) return { userId: user.id };

  const allCaps = new Set<string>();
  for (const r of roles) {
    const caps = (r.role_definitions as { role_capabilities?: Array<{ capability_key: string }> } | null)
      ?.role_capabilities ?? [];
    for (const c of caps) allCaps.add(c.capability_key);
  }
  if (!allCaps.has("manage_charts")) return null;

  return { userId: user.id };
}

Deno.serve(async (req: Request) => {
  const corsHeaders = getCorsHeaders(req);

  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "GET") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Require admin authentication
  const admin = await verifyAdmin(req);
  if (!admin) {
    return new Response(JSON.stringify({ error: "Unauthorized: admin access required" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabaseClient = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    {}
  );

  const url = new URL(req.url);
  const programId = url.searchParams.get("program_id");

  if (!programId) {
    return new Response(JSON.stringify({ error: "Missing program_id parameter" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    // 1. Look up the program
    const { data: program, error: progErr } = await supabaseClient
      .from("wk_chart_programs_v2")
      .select("id, series_slug, market_slug, public_slug")
      .eq("id", programId)
      .single();

    if (progErr || !program) {
      return new Response(JSON.stringify({ error: "Program not found", detail: progErr?.message }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const chartSlug = program.series_slug;
    const marketSlug = program.market_slug;

    console.log(`Finalizing program: ${programId} (chart_slug=${chartSlug}, market=${marketSlug}) by user ${admin.userId}`);

    // 2. Find edition staging records for this chart_slug
    const { data: editionStaging, error: edErr } = await supabaseClient
      .from("wk_import_staging_records")
      .select("id, source_record_id, target_slug, raw_record, mapped_record")
      .eq("target_entity", "chart_editions")
      .eq("raw_record->>chart_slug", chartSlug);

    if (edErr) throw new Error(`Failed to fetch edition staging: ${edErr.message}`);

    if (!editionStaging || editionStaging.length === 0) {
      return new Response(JSON.stringify({
        message: "No edition staging records found for this program",
        program_id: programId,
        chart_slug: chartSlug,
        editions_promoted: 0,
        entries_promoted: 0
      }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`Found ${editionStaging.length} edition staging records`);

    const wpEditionIdStrs = editionStaging.map((e: { target_slug: string }) => e.target_slug);

    // 3. Find entry staging records for these editions
    const { data: entryStaging, error: entryErr } = await supabaseClient
      .from("wk_import_staging_records")
      .select("id, source_record_id, target_slug, raw_record, mapped_record")
      .eq("target_entity", "chart_entries")
      .in("mapped_record->>edition_id", wpEditionIdStrs);

    if (entryErr) throw new Error(`Failed to fetch entry staging: ${entryErr.message}`);

    const entries = entryStaging ?? [];
    console.log(`Found ${entries.length} entry staging records`);

    const entriesByWpEdition = new Map<string, number>();
    for (const entry of entries) {
      const wpEdId = String((entry.mapped_record as Record<string, unknown>).edition_id ?? "");
      entriesByWpEdition.set(wpEdId, (entriesByWpEdition.get(wpEdId) ?? 0) + 1);
    }

    // 4. Create V2 editions
    const editionMap: Array<{
      v2_id: string;
      staging_id: string;
      wp_edition_id: number;
      edition_date: string;
    }> = [];

    for (const ed of editionStaging) {
      const raw = ed.raw_record as Record<string, unknown>;
      const editionDateRaw = raw.edition_date;
      if (!editionDateRaw) {
        console.warn(`Skipping edition staging ${ed.id}: no edition_date`);
        continue;
      }
      const editionDate = String(editionDateRaw).split("T")[0];
      const dateFormatted = editionDate.replace(/-/g, "_");
      const editionId = `edition_${chartSlug}_${marketSlug}_${dateFormatted}`;
      const chartTitle = raw.chart_title ? String(raw.chart_title) : "Chart Edition";
      const chartSize = raw.chart_size ? parseInt(String(raw.chart_size)) : 100;
      const ingestSummary = typeof raw.ingest_summary === "string"
        ? JSON.parse(raw.ingest_summary)
        : (raw.ingest_summary || {});
      const policyVersions = ingestSummary.policy_versions || {};
      const entryCount = entriesByWpEdition.get(ed.target_slug) ?? 0;

      const { error: insertErr } = await supabaseClient
        .from("wk_chart_editions_v2")
        .upsert({
          id: editionId,
          program_id: programId,
          edition_slug: `${chartSlug}/${marketSlug}/${dateFormatted}`,
          edition_label: chartTitle,
          edition_date: editionDate,
          period_start: editionDate,
          period_end: editionDate,
          entry_count: entryCount,
          status: "published",
          methodology_version: policyVersions.methodology_version || "1.0",
          source_policy_version: policyVersions.source_policy_version || "1.0",
          eligibility_policy_version: policyVersions.eligibility_policy_version || "1.0",
          scoring_policy_version: policyVersions.scoring_policy_version || "1.0",
          chart_size: chartSize,
          override_mode: "metadata_and_matching_only",
          published_at: raw.published_at || new Date().toISOString(),
        }, { onConflict: "id", ignoreDuplicates: false });

      if (insertErr) {
        console.error(`Failed to insert edition ${editionId}: ${insertErr.message}`);
        throw new Error(`Failed to insert edition ${editionId}: ${insertErr.message}`);
      }

      editionMap.push({
        v2_id: editionId,
        staging_id: ed.id,
        wp_edition_id: parseInt(ed.target_slug),
        edition_date: editionDate,
      });
    }

    console.log(`Created ${editionMap.length} V2 editions`);

    const wpToV2Edition = new Map<number, string>();
    for (const m of editionMap) {
      wpToV2Edition.set(m.wp_edition_id, m.v2_id);
    }

    // 5. Create V2 entries
    let entriesPromoted = 0;
    const promotedEntryStagingIds: string[] = [];

    for (const entry of entries) {
      const mapped = entry.mapped_record as Record<string, unknown>;
      const raw = entry.raw_record as Record<string, unknown>;
      const wpEditionId = mapped.edition_id ? parseInt(String(mapped.edition_id)) : null;
      if (!wpEditionId || !wpToV2Edition.has(wpEditionId)) {
        console.warn(`Entry ${entry.id}: no valid edition_id=${wpEditionId}, skipping`);
        continue;
      }

      const v2EditionId = wpToV2Edition.get(wpEditionId)!;
      const trackTitle = raw.title ? String(raw.title) : "Unknown Track";
      const artistName = raw.artist_name ? String(raw.artist_name) : "Unknown Artist";
      const rank = raw.position ? parseInt(String(raw.position)) : 0;
      const previousRank = raw.previous_position != null ? parseInt(String(raw.previous_position)) : undefined;
      const trackSlug = slugify(trackTitle);
      const artistSlug = slugify(artistName);
      const normalizedKey = `${trackSlug}--${artistSlug}`;
      const entryId = `entry_${wpEditionId}_${rank}`;
      const score = raw.score ? parseFloat(String(raw.score)) : 0;

      let movement = "new";
      if (previousRank) {
        movement = previousRank > rank ? "up" : previousRank < rank ? "down" : "same";
      }

      let sourcePayload = raw.source_payload;
      if (typeof sourcePayload === "string") {
        try { sourcePayload = JSON.parse(sourcePayload); } catch { sourcePayload = {}; }
      }

      const { error: insertEntryErr } = await supabaseClient
        .from("wk_chart_entries_v2")
        .upsert({
          id: entryId,
          edition_id: v2EditionId,
          rank: rank,
          previous_rank: previousRank ?? null,
          movement: movement,
          track_slug: trackSlug,
          track_title: trackTitle,
          artist_slug: artistSlug,
          artist_name: artistName,
          artwork_url: raw.artwork_url ? String(raw.artwork_url) : null,
          normalized_key: normalizedKey,
          source_count: raw.source_count ? parseInt(String(raw.source_count)) : 1,
          occurrence_count: 1,
          release_date: raw.release_date ? String(raw.release_date) : null,
          source_score: score,
          total_score: score,
          source_payload: sourcePayload || {},
          methodology_version: "1.0",
          eligibility_policy_version: "1.0",
          scoring_policy_version: "1.0",
          continuity_locked: raw.continuity_locked === 1 || raw.continuity_locked === "1",
          carry_forward_only: raw.carry_forward_only === 1 || raw.carry_forward_only === "1",
        }, { onConflict: "id", ignoreDuplicates: false });

      if (insertEntryErr) {
        console.error(`Failed to insert entry ${entryId}: ${insertEntryErr.message}`);
        continue;
      }

      promotedEntryStagingIds.push(entry.id);
      entriesPromoted++;
    }

    // 6. Delete promoted staging records
    const editionStagingIds = editionMap.map((m) => m.staging_id);
    const allPromotedIds = [...editionStagingIds, ...promotedEntryStagingIds];

    if (allPromotedIds.length > 0) {
      for (let i = 0; i < allPromotedIds.length; i += 1000) {
        const batch = allPromotedIds.slice(i, i + 1000);
        const { error: delErr } = await supabaseClient
          .from("wk_import_staging_records")
          .delete()
          .in("id", batch);

        if (delErr) {
          console.error(`Failed to delete staging batch: ${delErr.message}`);
        }
      }
      console.log(`Deleted ${allPromotedIds.length} staging records`);
    }

    return new Response(JSON.stringify({
      message: "Program finalized successfully",
      program_id: programId,
      chart_slug: chartSlug,
      editions_promoted: editionMap.length,
      entries_promoted: entriesPromoted,
      staging_deleted: allPromotedIds.length,
    }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (err) {
    console.error("Unexpected error:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
