import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { Client } from "https://deno.land/x/mysql@v2.12.1/mod.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const BATCH_SIZE = 100;

// ── helpers ────────────────────────────────────────────────────────────────
function clean(v: unknown): string { return String(v ?? "").trim(); }
function slugify(v: string): string { return v.toLowerCase().normalize("NFKD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 160); }
function parseDate(v: string): string | null { if (!v) return null; const d = new Date(v); return Number.isNaN(d.getTime()) ? null : d.toISOString(); }
function jsonResponse(data: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}
function safeStr(v: unknown, fallback = ""): string { return v === null || v === undefined ? fallback : String(v); }

// ── WordPress chart slug → V2 series slug mapping ──────────────────────────
// WP slugs may differ from V2 series slugs. This mapping is derived from
// the known WAKILISHA chart families.
const WP_SLUG_TO_SERIES: Record<string, string> = {
  "kenya": "top-songs",
  "rnb": "rnb",
  "gengetone": "gengetone",
  "2026": "2026-releases",
};

function resolveV2Program(
  wpChartSlug: string,
  programs: Array<{ id: string; public_slug: string; series_slug: string; market_slug: string; source_family_slug: string; default_methodology_version: string; default_eligibility_rules_version: string }>,
): typeof programs[0] | null {
  const seriesSlug = WP_SLUG_TO_SERIES[wpChartSlug] || wpChartSlug;
  // Try exact match first, then fallback
  let match = programs.find((p) => p.series_slug === seriesSlug);
  if (!match) match = programs.find((p) => p.source_family_slug === wpChartSlug);
  if (!match) match = programs.find((p) => p.public_slug.includes(wpChartSlug));
  return match || null;
}

// ── preview: scan WordPress and return mapping summary ─────────────────────
async function previewImport(
  client: Client,
  prefix: string,
  supabase: ReturnType<typeof createClient>,
) {
  // Load existing V2 state
  const { data: programs } = await supabase.from("wk_chart_programs_v2").select("id, public_slug, public_label, series_slug, market_slug, source_family_slug, default_methodology_version, default_eligibility_rules_version");
  const { data: existingEditions } = await supabase.from("wk_chart_editions_v2").select("edition_slug, program_id");
  const existingSlugs = new Set((existingEditions || []).map((e: any) => e.edition_slug));

  // Read WordPress chart definitions
  let charts: Array<Record<string, unknown>> = [];
  let editions: Array<Record<string, unknown>> = [];
  let editionItems: Array<Record<string, unknown>> = [];

  try {
    const r = await client.execute(`SELECT * FROM \`${prefix}wkcharts_charts\``);
    charts = (r.rows || []) as Array<Record<string, unknown>>;
  } catch { /* table may not exist */ }
  try {
    const r = await client.execute(`SELECT * FROM \`${prefix}wkcharts_editions\` ORDER BY id ASC`);
    editions = (r.rows || []) as Array<Record<string, unknown>>;
  } catch { /* table may not exist */ }
  try {
    const r = await client.execute(`SELECT * FROM \`${prefix}wkcharts_edition_items\` ORDER BY id ASC`);
    editionItems = (r.rows || []) as Array<Record<string, unknown>>;
  } catch { /* table may not exist */ }

  // Map chart → program
  const chartMappings: Array<Record<string, unknown>> = [];
  for (const chart of charts) {
    const wpSlug = clean(chart.slug);
    const program = resolveV2Program(wpSlug, programs || []);
    chartMappings.push({
      wp_chart_id: clean(chart.id),
      wp_chart_name: clean(chart.name),
      wp_chart_slug: wpSlug,
      wp_chart_type: clean(chart.chart_type),
      wp_frequency: clean(chart.frequency),
      wp_methodology_id: clean(chart.methodology_id),
      wp_market_scope_id: clean(chart.market_scope_id),
      v2_program_id: program?.id || null,
      v2_series_slug: program?.series_slug || null,
      v2_public_slug: program?.public_slug || null,
      matched: !!program,
    });
  }

  // Map editions → programs
  const editionMappings: Array<Record<string, unknown>> = [];
  let newCount = 0;
  let existingCount = 0;
  for (const ed of editions) {
    const wpChartId = clean(ed.chart_id);
    const wpSlug = clean(ed.slug);
    const chart = charts.find((c: any) => clean(c.id) === wpChartId);
    const wpChartSlug = chart ? clean(chart.slug) : "";
    const program = resolveV2Program(wpChartSlug, programs || []);
    const alreadyExists = existingSlugs.has(wpSlug);
    if (alreadyExists) existingCount++;
    else newCount++;
    editionMappings.push({
      wp_edition_id: clean(ed.id),
      wp_edition_slug: wpSlug,
      wp_edition_title: clean(ed.title),
      wp_edition_date: safeStr(ed.edition_date),
      wp_chart_id: wpChartId,
      wp_chart_slug: wpChartSlug,
      wp_entry_count: Number(ed.entry_count || 0),
      v2_program_id: program?.id || null,
      v2_program_label: program?.public_label || null,
      already_in_v2: alreadyExists,
      matched: !!program,
    });
  }

  // Count entries per edition
  const entriesPerEdition: Record<string, number> = {};
  for (const item of editionItems) {
    const eid = clean(item.edition_id);
    entriesPerEdition[eid] = (entriesPerEdition[eid] || 0) + 1;
  }

  return {
    preview: true,
    wp_charts_count: charts.length,
    wp_editions_count: editions.length,
    wp_edition_items_count: editionItems.length,
    v2_programs_count: (programs || []).length,
    v2_existing_editions: existingCount,
    v2_new_editions: newCount,
    chart_mappings: chartMappings,
    edition_mappings: editionMappings.slice(0, 200), // cap for response size
    entries_per_edition_sample: Object.entries(entriesPerEdition).slice(0, 40).map(([k, v]) => ({ edition_id: k, entries: v })),
    unmatched_charts: chartMappings.filter((m: any) => !m.matched),
    unmatched_editions: editionMappings.filter((m: any) => !m.matched && !m.already_in_v2).length,
  };
}

// ── import: actually insert into V2 tables ─────────────────────────────────
async function importEditions(
  client: Client,
  prefix: string,
  supabase: ReturnType<typeof createClient>,
  runId: string,
) {
  // Load V2 state
  const { data: programs } = await supabase.from("wk_chart_programs_v2").select("id, public_slug, public_label, series_slug, market_slug, source_family_slug, default_methodology_version, default_eligibility_rules_version");
  const { data: existingEditions } = await supabase.from("wk_chart_editions_v2").select("edition_slug, id");
  const existingSlugs = new Set((existingEditions || []).map((e: any) => e.edition_slug));

  // Read WordPress data
  let charts: Array<Record<string, unknown>> = [];
  let editions: Array<Record<string, unknown>> = [];
  let editionItems: Array<Record<string, unknown>> = [];

  try { const r = await client.execute(`SELECT * FROM \`${prefix}wkcharts_charts\``); charts = (r.rows || []) as Array<Record<string, unknown>>; } catch { /* noop */ }
  try { const r = await client.execute(`SELECT * FROM \`${prefix}wkcharts_editions\` ORDER BY id ASC`); editions = (r.rows || []) as Array<Record<string, unknown>>; } catch { /* noop */ }
  try { const r = await client.execute(`SELECT * FROM \`${prefix}wkcharts_edition_items\` ORDER BY id ASC`); editionItems = (r.rows || []) as Array<Record<string, unknown>>; } catch { /* noop */ }

  // Build WP chart lookup
  const chartById: Record<string, Record<string, unknown>> = {};
  for (const c of charts) chartById[clean(c.id)] = c;

  const stats = {
    editions_created: 0,
    editions_skipped: 0,
    entries_created: 0,
    source_coverages_created: 0,
    slug_aliases_created: 0,
    errors: [] as string[],
  };

  // ── Insert editions ────────────────────────────────────────────────────
  const editionBatch: Array<Record<string, unknown>> = [];
  const wpEditionToV2Id: Record<string, string> = {}; // wp_edition_id → v2_edition_id

  for (const ed of editions) {
    const wpEditionId = clean(ed.id);
    const wpSlug = clean(ed.slug);
    if (existingSlugs.has(wpSlug)) { stats.editions_skipped++; continue; }

    const wpChartId = clean(ed.chart_id);
    const chart = chartById[wpChartId];
    const wpChartSlug = chart ? clean(chart.slug) : "";
    const program = resolveV2Program(wpChartSlug, programs || []);
    if (!program) {
      stats.errors.push(`No V2 program found for edition ${wpEditionId} (chart slug: ${wpChartSlug})`);
      continue;
    }

    const v2EditionId = `edition_wp_${wpEditionId}`;
    wpEditionToV2Id[wpEditionId] = v2EditionId;
    const entryCount = Number(ed.entry_count || 0);
    const editionDate = safeStr(ed.edition_date);

    editionBatch.push({
      id: v2EditionId,
      program_id: program.id,
      edition_slug: wpSlug,
      edition_label: clean(ed.title) || clean(chart?.name) || "Untitled Edition",
      edition_date: editionDate || null,
      period_start: editionDate || null,
      period_end: editionDate || null,
      entry_count: entryCount,
      status: "published",
      methodology_version: program.default_methodology_version || "legacy-import-v1",
      source_policy_version: "legacy-import-v1",
      eligibility_policy_version: program.default_eligibility_rules_version || "legacy-import-v1",
      scoring_policy_version: "legacy-import-v1",
      rule_set_snapshot: {
        imported_from: "wordpress_wkcharts",
        wp_chart_id: wpChartId,
        wp_chart: chart || {},
        wp_edition_raw: ed,
        methodology_version: program.default_methodology_version,
        eligibility_version: program.default_eligibility_rules_version,
        imported_at: new Date().toISOString(),
        import_run_id: runId,
      },
      chart_size: Math.max(entryCount, 10),
      carry_forward_count: 0,
      new_entries_count: entryCount,
      re_entries_count: 0,
      exclusion_summary: { mode: "historical_import", note: "Imported from WordPress — no exclusion data available" },
      override_mode: "historical",
      ingest_run_id: runId,
      published_at: editionDate ? new Date(editionDate).toISOString() : new Date().toISOString(),
      published_by: "wp-import",
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });
    stats.editions_created++;
  }

  // Insert editions in batches
  for (let i = 0; i < editionBatch.length; i += BATCH_SIZE) {
    const batch = editionBatch.slice(i, i + BATCH_SIZE);
    try {
      const { error } = await supabase.from("wk_chart_editions_v2").upsert(batch, { onConflict: "edition_slug,program_id" });
      if (error) stats.errors.push(`Edition batch insert error: ${error.message}`);
    } catch (err: any) {
      stats.errors.push(`Edition batch insert failed: ${err?.message || String(err)}`);
    }
  }

  // ── Insert entries ─────────────────────────────────────────────────────
  const entryBatch: Array<Record<string, unknown>> = [];
  for (const item of editionItems) {
    const wpEditionId = clean(item.edition_id);
    const v2EditionId = wpEditionToV2Id[wpEditionId];
    if (!v2EditionId) continue; // edition wasn't created

    const rank = Number(item.rank || 0);
    const prevRank = Number(item.previous_rank || 0);
    let movement = "same";
    if (prevRank === 0 || rank < prevRank) movement = rank < prevRank ? "up" : "new";
    else if (rank === prevRank) movement = "same";
    else movement = "down";

    const wpTrackId = clean(item.track_id);
    // Try to get track info from the raw record — wp_wkcharts_edition_items may not have it
    // but we store whatever is available
    const trackTitle = clean(item.track_title || "") || `Track #${wpTrackId}`;
    const artistName = clean(item.artist_name || "") || "";

    const entryId = `entry_wp_${clean(item.id)}`;

    entryBatch.push({
      id: entryId,
      edition_id: v2EditionId,
      rank,
      previous_rank: prevRank || null,
      movement,
      track_slug: slugify(trackTitle) || `track-wp-${wpTrackId}`,
      track_title: trackTitle,
      artist_slug: slugify(artistName.split(",")[0]?.trim() || ""),
      artist_name: artistName,
      artwork_url: clean(item.artwork_url || item.cover_url || ""),
      normalized_key: slugify(trackTitle + " " + artistName),
      lead_artist_key: slugify(artistName.split(",")[0]?.trim() || ""),
      source_count: 1,
      occurrence_count: 1,
      source_urls_seen: [],
      release_date: null,
      release_recency_days: null,
      canonical_track_id: null,
      canonical_release_id: null,
      canonical_artist_id: null,
      source_score: 0,
      cross_source_bonus: 0,
      overlap_bonus: 0,
      recency_score: 0,
      continuity_score: 0,
      carry_forward_bonus: 0,
      airplay_score: 0,
      anti_gaming_penalty: 0,
      total_score: 0,
      carry_forward_only: false,
      continuity_locked: false,
      airplay_candidate_only: false,
      overlap_bonus_capped: false,
      lead_artist_overflow: false,
      stale_carry_forward_demoted: false,
      eligibility_status: "historical",
      eligibility_warnings: [],
      source_payload: {
        imported_from: "wordpress_wkcharts",
        wp_edition_item_id: clean(item.id),
        wp_edition_id: wpEditionId,
        wp_track_id: wpTrackId,
        wp_raw: item,
        weeks_on_chart: Number(item.weeks_on_chart || 0),
        peak_position: Number(item.peak_position || 0),
        is_new_entry: Boolean(item.is_new_entry),
        is_re_entry: Boolean(item.is_re_entry),
        imported_at: new Date().toISOString(),
      },
      scoring_policy_version: "legacy-import-v1",
      methodology_version: "legacy-import-v1",
      eligibility_policy_version: "legacy-import-v1",
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });
    stats.entries_created++;
  }

  // Insert entries in batches
  for (let i = 0; i < entryBatch.length; i += BATCH_SIZE) {
    const batch = entryBatch.slice(i, i + BATCH_SIZE);
    try {
      const { error } = await supabase.from("wk_chart_entries_v2").upsert(batch, { onConflict: "id" });
      if (error) stats.errors.push(`Entry batch insert error: ${error.message}`);
    } catch (err: any) {
      stats.errors.push(`Entry batch insert failed: ${err?.message || String(err)}`);
    }
  }

  // ── Insert source coverage ──────────────────────────────────────────────
  const coverageBatch: Array<Record<string, unknown>> = [];
  for (const [wpEditionId, v2EditionId] of Object.entries(wpEditionToV2Id)) {
    const ed = editions.find((e: any) => clean(e.id) === wpEditionId);
    const wpChartId = ed ? clean(ed.chart_id) : "";
    const chart = chartById[wpChartId];

    coverageBatch.push({
      id: crypto.randomUUID(),
      edition_id: v2EditionId,
      source_name: "WAKILISHA WordPress Import",
      source_count: Number(ed?.entry_count || 0),
      source_payload: {
        imported_from: "wordpress_wkcharts",
        wp_edition_id: wpEditionId,
        wp_chart_id: wpChartId,
        wp_chart_slug: chart ? clean(chart.slug) : "",
        wp_chart_name: chart ? clean(chart.name) : "",
        wp_methodology_id: chart ? clean(chart.methodology_id) : "",
        wp_market_scope_id: chart ? clean(chart.market_scope_id) : "",
        wp_raw_edition: ed || {},
        wp_raw_chart: chart || {},
        imported_at: new Date().toISOString(),
      },
    });
    stats.source_coverages_created++;
  }

  if (coverageBatch.length > 0) {
    for (let i = 0; i < coverageBatch.length; i += BATCH_SIZE) {
      const batch = coverageBatch.slice(i, i + BATCH_SIZE);
      try {
        const { error } = await supabase.from("wk_chart_source_coverage_v2").insert(batch);
        if (error) stats.errors.push(`Coverage insert error: ${error.message}`);
      } catch (err: any) {
        stats.errors.push(`Coverage insert failed: ${err?.message || String(err)}`);
      }
    }
  }

  // ── Insert slug aliases ──────────────────────────────────────────────────
  const aliasBatch: Array<Record<string, unknown>> = [];
  const seenAliases = new Set<string>();

  for (const chart of charts) {
    const wpSlug = clean(chart.slug);
    const program = resolveV2Program(wpSlug, programs || []);
    if (!program) continue;
    const canonicalSlug = program.public_slug || program.series_slug;
    const aliasKey = `${wpSlug}→${canonicalSlug}`;
    if (seenAliases.has(aliasKey)) continue;
    seenAliases.add(aliasKey);

    aliasBatch.push({
      legacy_slug: wpSlug,
      canonical_slug: canonicalSlug,
      entity_type: "chart_program",
      redirect_status: "active",
    });
    stats.slug_aliases_created++;
  }

  // Also add known legacy aliases from the V2 plan
  const knownAliases: Array<[string, string]> = [
    ["kenya", "top-songs/kenya/kenya"],
    ["top-100-kenya", "top-songs/kenya/kenya"],
    ["kenya-top-100", "top-songs/kenya/kenya"],
    ["rnb", "top-songs/kenya/rnb"],
    ["kenyan-rnb", "top-songs/kenya/rnb"],
    ["top-kenyan-rnb-songs", "top-songs/kenya/rnb"],
    ["gengetone", "top-songs/kenya/gengetone"],
    ["top-gengetone-songs", "top-songs/kenya/gengetone"],
    ["2026", "top-songs/kenya/2026"],
    ["top-kenyan-songs-released-in-2026", "top-songs/kenya/2026"],
  ];

  for (const [legacy, canonical] of knownAliases) {
    const aliasKey = `${legacy}→${canonical}`;
    if (seenAliases.has(aliasKey)) continue;
    seenAliases.add(aliasKey);
    aliasBatch.push({ legacy_slug: legacy, canonical_slug: canonical, entity_type: "chart_program", redirect_status: "active" });
    stats.slug_aliases_created++;
  }

  if (aliasBatch.length > 0) {
    try {
      const { error } = await supabase.from("wk_chart_slug_aliases_v2").upsert(aliasBatch, { onConflict: "legacy_slug" });
      if (error) stats.errors.push(`Alias insert error: ${error.message}`);
    } catch (err: any) {
      stats.errors.push(`Alias insert failed: ${err?.message || String(err)}`);
    }
  }

  return { success: true, ...stats };
}

// ── main serve ──────────────────────────────────────────────────────────────
serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? Deno.env.get("SUPABASE_ANON_KEY") ?? "";
  if (!supabaseUrl || !supabaseKey) return jsonResponse({ success: false, error: "Supabase config missing." }, 500);
  const supabase = createClient(supabaseUrl, supabaseKey);

  // Verify admin
  const authHeader = req.headers.get("Authorization") ?? "";
  const token = authHeader.replace("Bearer ", "");
  if (token) {
    const { data: { user }, error: authErr } = await supabase.auth.getUser(token);
    if (authErr || !user) return jsonResponse({ success: false, error: "Authentication required." }, 401);
  }

  try {
    const body = await req.json();
    const { action, credentials } = body;

    if (!credentials || typeof credentials !== "object") {
      return jsonResponse({ success: false, error: "credentials object is required" }, 400);
    }
    const { host, port = 3306, user, password, database, prefix = "wp_" } = credentials;
    if (!host || !user || !password || !database) {
      return jsonResponse({ success: false, error: "host, user, password, database are required" }, 400);
    }

    let client: Client;
    try {
      client = new Client();
      await client.connect({ hostname: host, port: Number(port), username: user, password, db: database, connectTimeout: 15000 });
    } catch (connectErr: any) {
      return jsonResponse({ success: false, accessible: false, error: connectErr?.message || "Could not connect to MySQL" });
    }

    try {
      if (action === "test") {
        await client.execute("SELECT 1");

        // Scan what's available
        const counts: Record<string, number> = {};
        for (const tbl of ["wkcharts_charts", "wkcharts_editions", "wkcharts_edition_items"]) {
          try {
            const r = await client.execute(`SELECT COUNT(*) AS cnt FROM \`${prefix}${tbl}\``);
            counts[tbl] = Number((r.rows?.[0] as any)?.cnt ?? 0);
          } catch { counts[tbl] = 0; }
        }

        return jsonResponse({ success: true, accessible: true, message: "Connected.", counts });
      }

      if (action === "preview") {
        const preview = await previewImport(client, prefix, supabase);
        return jsonResponse({ success: true, ...preview });
      }

      if (action === "import") {
        const runId = body.runId || crypto.randomUUID();
        const result = await importEditions(client, prefix, supabase, runId);
        return jsonResponse({ success: true, ...result });
      }

      return jsonResponse({ success: false, error: `Unknown action: ${action}` }, 400);
    } finally {
      try { await client.close(); } catch { /* noop */ }
    }
  } catch (err: any) {
    return jsonResponse({ success: false, error: err?.message || "Internal error" }, 500);
  }
});
