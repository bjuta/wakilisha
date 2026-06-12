import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function safeSlug(v: string): string {
  return v.toLowerCase().normalize("NFKD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

function safeId(prefix: string, v: string): string {
  return (prefix + "_" + safeSlug(v)).replace(/-+/g, "_").slice(0, 64);
}

function inferMarket(slug: string): string {
  if (slug.includes("ke") || slug.includes("kenya") || slug.includes("nairobi")) return "kenya";
  if (slug.includes("ng") || slug.includes("nigeria") || slug.includes("lagos")) return "nigeria";
  if (slug.includes("za") || slug.includes("south-africa") || slug.includes("johannesburg")) return "south-africa";
  if (slug.includes("gh") || slug.includes("ghana") || slug.includes("accra")) return "ghana";
  if (slug.includes("tz") || slug.includes("tanzania") || slug.includes("dar")) return "tanzania";
  if (slug.includes("ug") || slug.includes("uganda") || slug.includes("kampala")) return "uganda";
  return "kenya";
}

function inferSeries(slug: string): string {
  const s = slug.toLowerCase();
  if (s.includes("rnb") || s.includes("r&b")) return "rnb";
  if (s.includes("gengetone")) return "gengetone";
  if (s.includes("gospel")) return "gospel";
  if (s.includes("afrobeats")) return "afrobeats";
  if (s.includes("hiphop") || s.includes("hip-hop") || s.includes("rap")) return "hiphop";
  if (s.includes("reggae") || s.includes("dancehall")) return "reggae";
  if (s.includes("2026")) return "2026";
  if (s.includes("2025")) return "2025";
  if (s.includes("new")) return "new-releases";
  if (s.includes("top")) return "top-songs";
  return s;
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  if (!supabaseUrl || !supabaseKey) {
    return new Response(JSON.stringify({ error: "Supabase config missing" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
  const supabase = createClient(supabaseUrl, supabaseKey);

  try {
    const body = await req.json();
    const { action, payload } = body;

    if (action === "ping") {
      const { data } = await supabase.from("wk_chart_programs_v2").select("id").limit(1);
      return new Response(JSON.stringify({ ok: true, tables_exist: data !== null }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (action === "import") {
      if (!payload || !payload.charts) {
        return new Response(JSON.stringify({ error: "payload.charts required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      const charts = payload.charts as Array<{
        id: number; name: string; slug: string; status: string; chart_type: string;
        editions: Array<{
          id: number; title: string; slug: string; status: string; edition_date: string;
          items: Array<{
            rank: number; previous_rank: number | null; weeks_on_chart: number | null;
            peak_position: number | null; is_new_entry: number | null; is_re_entry: number | null;
            track: { id: number; title: string; slug: string; artist_name?: string; artist_slug?: string; spotify_id?: string; apple_music_id?: string; youtube_id?: string; isrc?: string } | null;
            sources: Array<{ provider: string; url?: string }>;
          }>;
        }>;
      }>;

      const seriesSet = new Map<string, { series_slug: string; series_label: string }>();
      const marketsSet = new Map<string, Record<string, unknown>>();
      const programs: Record<string, unknown>[] = [];
      const editions: Record<string, unknown>[] = [];
      const entries: Record<string, unknown>[] = [];
      const coverage: Record<string, unknown>[] = [];
      const aliases: Record<string, unknown>[] = [];

      for (const chart of charts) {
        const market = inferMarket(chart.slug);
        const series = inferSeries(chart.slug);
        const pubSlug = series + "/" + market;
        const progId = safeId("program", pubSlug);

        if (!seriesSet.has(series)) {
          seriesSet.set(series, { series_slug: series, series_label: series.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()) });
        }
        if (!marketsSet.has(market)) {
          marketsSet.set(market, {
            market_slug: market, market_label: market.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
            market_type: "country",
            country_code: market === "kenya" ? "KE" : market === "nigeria" ? "NG" : market === "south-africa" ? "ZA" : market === "ghana" ? "GH" : market === "tanzania" ? "TZ" : market === "uganda" ? "UG" : null,
            timezone: market === "kenya" ? "Africa/Nairobi" : market === "nigeria" ? "Africa/Lagos" : market === "south-africa" ? "Africa/Johannesburg" : null,
            default_language: "en",
          });
        }
        programs.push({
          id: progId, series_slug: series, market_slug: market, public_slug: pubSlug,
          public_label: chart.name || series.replace(/-/g, " ") + " \u00b7 " + market.replace(/-/g, " "),
          short_label: chart.name || series, source_family_slug: chart.slug || series,
          default_period_type: "weekly", default_methodology_version: "legacy-import-v1",
          default_eligibility_rules_version: "legacy-import-v1", chart_size: 20,
          streaming_min_sources: 1, cross_source_mode: "standard", cross_source_weight: 1,
          continuity_weight: 1, carry_forward_weight: 1, airplay_enabled: false,
          airplay_station_scope: "all", airplay_min_duration: 20, airplay_weight: 1,
          airplay_min_stations: 1, airplay_min_detections: 1, airplay_max_score: 24,
          airplay_rescue_mode: "allow_rescue", anti_gaming_max_tracks_per_lead_artist: 3,
          anti_gaming_overlap_bonus_cap: 10, anti_gaming_artist_overflow_penalty: 8,
          anti_gaming_demote_carry_forward_without_current: false, missing_policy: "review",
          override_mode: "metadata_and_matching_only",
        });

        for (const ed of chart.editions) {
          const edId = safeId("edition", pubSlug + "_" + ed.edition_date);
          editions.push({
            id: edId, program_id: progId, edition_slug: ed.edition_date,
            edition_label: ed.title || pubSlug + " \u00b7 " + ed.edition_date,
            edition_date: ed.edition_date, period_start: ed.edition_date, period_end: ed.edition_date,
            status: ed.status === "published" ? "published" : "draft",
            entry_count: ed.items.length, chart_size: 20,
            methodology_version: "legacy-import-v1", source_policy_version: "legacy-import",
            eligibility_policy_version: "legacy-import", scoring_policy_version: "legacy-import",
            rule_set_snapshot: { old_edition_id: ed.id, old_chart_id: chart.id, migrated_at: new Date().toISOString() },
            ingest_run_id: null, published_at: ed.status === "published" ? new Date().toISOString() : null, published_by: null,
          });

          aliases.push({
            id: safeId("alias", "chart_" + chart.slug + "_" + ed.slug),
            legacy_slug: "charts/" + chart.slug + "/" + ed.slug,
            canonical_slug: "charts/" + pubSlug, entity_type: "chart_program", redirect_status: "active",
          });

          let edSourceCount = 0;
          for (const item of ed.items) {
            const trackTitle = item.track?.title || "Track " + item.track?.id || "Unknown";
            const artistName = item.track?.artist_name || "Unknown Artist";
            const sourceUrls = item.sources.map((s) => s.url || (s.provider + ":track:" + (item.track?.slug || "")));
            edSourceCount += item.sources.length;

            let movement = "same";
            if (item.is_new_entry) movement = "new";
            else if (item.is_re_entry) movement = "re_entry";
            else if (item.previous_rank != null) {
              if (item.rank < item.previous_rank) movement = "up";
              else if (item.rank > item.previous_rank) movement = "down";
            }

            entries.push({
              id: safeId("entry", ed.edition_date + "_" + String(item.rank).padStart(3, "0") + "_" + (item.track?.id || "0")),
              edition_id: edId, rank: item.rank, previous_rank: item.previous_rank, movement,
              track_slug: item.track?.slug || null, track_title: trackTitle,
              artist_slug: item.track?.artist_slug || null, artist_name: artistName,
              artwork_url: null, normalized_key: safeSlug(trackTitle) + "::" + safeSlug(artistName),
              source_urls_seen: [...new Set(sourceUrls)],
              source_payload: {
                old_track_id: item.track?.id, weeks_on_chart: item.weeks_on_chart,
                peak_position: item.peak_position, is_new_entry: item.is_new_entry,
                is_re_entry: item.is_re_entry, track_isrc: item.track?.isrc ?? null,
                track_spotify_id: item.track?.spotify_id ?? null,
                track_apple_music_id: item.track?.apple_music_id ?? null,
                track_youtube_id: item.track?.youtube_id ?? null,
                migrated_at: new Date().toISOString(),
              },
              scoring_policy_version: "legacy-import",
              methodology_version: "legacy-import-v1",
              eligibility_policy_version: "legacy-import",
            });
          }

          coverage.push({
            id: safeId("coverage", edId + "_wp_import"),
            edition_id: edId, source_name: "WordPress Legacy Import",
            source_count: edSourceCount,
            coverage_status: edSourceCount > 0 ? "manual" : "unavailable",
            coverage_payload: { old_edition_id: ed.id, source_count: edSourceCount, migrated_at: new Date().toISOString() },
          });
        }
      }

      const errors: string[] = [];
      const inserted: Record<string, number> = {};

      if (seriesSet.size > 0) {
        const { error } = await supabase.from("wk_chart_series_v2").upsert(Array.from(seriesSet.values()), { onConflict: "series_slug" });
        if (error) errors.push("series: " + error.message); else inserted.series = seriesSet.size;
      }
      if (marketsSet.size > 0) {
        const { error } = await supabase.from("wk_chart_markets_v2").upsert(Array.from(marketsSet.values()), { onConflict: "market_slug" });
        if (error) errors.push("markets: " + error.message); else inserted.markets = marketsSet.size;
      }
      if (programs.length > 0) {
        const { error } = await supabase.from("wk_chart_programs_v2").upsert(programs, { onConflict: "id" });
        if (error) errors.push("programs: " + error.message); else inserted.programs = programs.length;
      }
      if (editions.length > 0) {
        const { error } = await supabase.from("wk_chart_editions_v2").upsert(editions, { onConflict: "id" });
        if (error) errors.push("editions: " + error.message); else inserted.editions = editions.length;
      }
      if (entries.length > 0) {
        for (let i = 0; i < entries.length; i += 200) {
          const batch = entries.slice(i, i + 200);
          const { error } = await supabase.from("wk_chart_entries_v2").upsert(batch, { onConflict: "id" });
          if (error) { errors.push("entries batch " + i + ": " + error.message); break; }
        }
        if (!errors.some((e) => e.startsWith("entries"))) inserted.entries = entries.length;
      }
      if (coverage.length > 0) {
        const { error } = await supabase.from("wk_chart_source_coverage_v2").upsert(coverage, { onConflict: "id" });
        if (error) errors.push("coverage: " + error.message); else inserted.coverage = coverage.length;
      }
      if (aliases.length > 0) {
        const { error } = await supabase.from("wk_chart_slug_aliases_v2").upsert(aliases, { onConflict: "id" });
        if (error) errors.push("aliases: " + error.message); else inserted.aliases = aliases.length;
      }

      return new Response(JSON.stringify({
        success: errors.length === 0,
        inserted,
        errors: errors.length > 0 ? errors : undefined,
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    return new Response(JSON.stringify({ error: "Unknown action: " + (action || "none") }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (err) {
    return new Response(JSON.stringify({ error: err instanceof Error ? err.message : "Internal error" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
