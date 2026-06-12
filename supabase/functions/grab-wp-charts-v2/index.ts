import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { Client } from "https://deno.land/x/mysql@v2.12.1/mod.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function c(v: unknown): string { return String(v ?? "").trim(); }
function slugify(v: string): string { return v.toLowerCase().normalize("NFKD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, ""); }
function safeId(prefix: string, v: string): string { return (prefix + "_" + slugify(v)).replace(/-+/g, "_").slice(0, 64); }
function idate(v: unknown): string { if (v instanceof Date && !isNaN(v.getTime())) return v.toISOString().slice(0, 10); return String(v ?? "").trim().slice(0, 10); }

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
    const { action } = body;

    if (action === "ping") {
      return new Response(JSON.stringify({ ok: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (action === "grab") {
      const { host, port = 3306, user, password, database, prefix = "wp_" } = body;
      if (!host || !user || !password || !database) {
        return new Response(JSON.stringify({ error: "host, user, password, database required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      let client: Client;
      try {
        client = new Client();
        await client.connect({ hostname: host, port: Number(port), username: user, password, db: database, connectTimeout: 15000 });
      } catch (e) {
        return new Response(JSON.stringify({ error: "MySQL connection failed", detail: e instanceof Error ? e.message : String(e) }), { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      const tbl = (n: string) => `\`${prefix}${n}\``;

      // ---- Pull all charts ----
      const chartRows = await client.execute(`SELECT id, name, slug, status, chart_type FROM ${tbl("wkcharts_charts")}`);
      const charts = chartRows.rows as Array<Record<string, unknown>>;

      // ---- Pull all editions ----
      const edRows = await client.execute(`SELECT id, chart_id, title, slug, status, edition_date FROM ${tbl("wkcharts_editions")} ORDER BY edition_date DESC`);
      const editionsByChart = new Map<number, Array<Record<string, unknown>>>();
      for (const ed of edRows.rows as Array<Record<string, unknown>>) {
        const cid = Number(ed.chart_id);
        if (!editionsByChart.has(cid)) editionsByChart.set(cid, []);
        editionsByChart.get(cid)!.push(ed);
      }

      // ---- Pull all edition items ----
      const itemRows = await client.execute(`SELECT id, edition_id, rank, previous_rank, weeks_on_chart, peak_position, is_new_entry, is_re_entry, track_id FROM ${tbl("wkcharts_edition_items")} ORDER BY rank ASC`);
      const itemsByEdition = new Map<number, Array<Record<string, unknown>>>();
      const allTrackIds = new Set<number>();
      for (const item of itemRows.rows as Array<Record<string, unknown>>) {
        const eid = Number(item.edition_id);
        if (!itemsByEdition.has(eid)) itemsByEdition.set(eid, []);
        itemsByEdition.get(eid)!.push(item);
        if (item.track_id != null) allTrackIds.add(Number(item.track_id));
      }

      // ---- Pull all tracks ----
      const trackIds = [...allTrackIds];
      let tracksById = new Map<number, Record<string, unknown>>();
      if (trackIds.length > 0) {
        const placeholders = trackIds.map(() => "?").join(",");
        const trRows = await client.execute(`SELECT id, title, slug, artist_id, spotify_id, apple_music_id, youtube_id, isrc FROM ${tbl("wkcharts_tracks")} WHERE id IN (${placeholders})`, trackIds);
        for (const t of trRows.rows as Array<Record<string, unknown>>) {
          tracksById.set(Number(t.id), t);
        }
      }

      // ---- Pull all artists ----
      const allArtistIds = new Set<number>();
      for (const t of tracksById.values()) { if (t.artist_id != null) allArtistIds.add(Number(t.artist_id)); }
      const artistIds = [...allArtistIds];
      let artistsById = new Map<number, Record<string, unknown>>();
      if (artistIds.length > 0) {
        const placeholders = artistIds.map(() => "?").join(",");
        const arRows = await client.execute(`SELECT id, name, slug FROM ${tbl("wkcharts_artists")} WHERE id IN (${placeholders})`, artistIds);
        for (const a of arRows.rows as Array<Record<string, unknown>>) {
          artistsById.set(Number(a.id), a);
        }
      }

      // ---- Pull track sources ----
      let sourcesByTrack = new Map<number, Array<Record<string, unknown>>>();
      if (trackIds.length > 0) {
        const placeholders = trackIds.map(() => "?").join(",");
        const srcRows = await client.execute(`SELECT id, track_id, provider FROM ${tbl("wkcharts_track_sources")} WHERE track_id IN (${placeholders})`, trackIds);
        for (const s of srcRows.rows as Array<Record<string, unknown>>) {
          const tid = Number(s.track_id);
          if (!sourcesByTrack.has(tid)) sourcesByTrack.set(tid, []);
          sourcesByTrack.get(tid)!.push(s);
        }
      }

      await client.close();

      // ---- Build v2 payload ----
      const seriesSet = new Map<string, { series_slug: string; series_label: string }>();
      const marketsSet = new Map<string, Record<string, unknown>>();
      const programs: Record<string, unknown>[] = [];
      const editions: Record<string, unknown>[] = [];
      const entries: Record<string, unknown>[] = [];
      const coverage: Record<string, unknown>[] = [];
      const aliases: Record<string, unknown>[] = [];

      for (const ch of charts) {
        const chartSlug = c(ch.slug);
        const market = inferMarket(chartSlug);
        const series = inferSeries(chartSlug);
        const pubSlug = series + "/" + market;
        const progId = safeId("program", pubSlug);

        if (!seriesSet.has(series)) {
          seriesSet.set(series, { series_slug: series, series_label: series.replace(/-/g, " ").replace(/\b\w/g, (x) => x.toUpperCase()) });
        }
        if (!marketsSet.has(market)) {
          marketsSet.set(market, {
            market_slug: market, market_label: market.replace(/-/g, " ").replace(/\b\w/g, (x) => x.toUpperCase()),
            market_type: "country",
            country_code: market === "kenya" ? "KE" : market === "nigeria" ? "NG" : market === "south-africa" ? "ZA" : market === "ghana" ? "GH" : market === "tanzania" ? "TZ" : market === "uganda" ? "UG" : null,
            timezone: market === "kenya" ? "Africa/Nairobi" : market === "nigeria" ? "Africa/Lagos" : market === "south-africa" ? "Africa/Johannesburg" : null,
            default_language: "en",
          });
        }

        programs.push({
          id: progId, series_slug: series, market_slug: market, public_slug: pubSlug,
          public_label: c(ch.name) || series + " \u00b7 " + market,
          short_label: c(ch.name) || series, source_family_slug: chartSlug,
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

        const chartEditions = editionsByChart.get(Number(ch.id)) || [];
        for (const ed of chartEditions) {
          const edDate = idate(ed.edition_date);
          const edId = safeId("edition", pubSlug + "_" + edDate);
          const edItems = itemsByEdition.get(Number(ed.id)) || [];

          editions.push({
            id: edId, program_id: progId, edition_slug: edDate,
            edition_label: c(ed.title) || pubSlug + " \u00b7 " + edDate,
            edition_date: edDate, period_start: edDate, period_end: edDate,
            status: c(ed.status) === "published" ? "published" : "draft",
            entry_count: edItems.length, chart_size: 20,
            methodology_version: "legacy-import-v1", source_policy_version: "legacy-import",
            eligibility_policy_version: "legacy-import", scoring_policy_version: "legacy-import",
            rule_set_snapshot: { old_edition_id: ed.id, old_chart_id: ch.id, migrated_at: new Date().toISOString() },
            ingest_run_id: null, published_at: c(ed.status) === "published" ? new Date().toISOString() : null, published_by: null,
          });

          aliases.push({
            id: safeId("alias", "chart_" + chartSlug + "_" + c(ed.slug)),
            legacy_slug: "charts/" + chartSlug + "/" + c(ed.slug),
            canonical_slug: "charts/" + pubSlug, entity_type: "chart_program", redirect_status: "active",
          });

          let edSourceCount = 0;
          for (const item of edItems) {
            const track = tracksById.get(Number(item.track_id));
            const artist = track?.artist_id ? artistsById.get(Number(track.artist_id)) : undefined;
            const srcs = sourcesByTrack.get(Number(item.track_id)) || [];
            edSourceCount += srcs.length;

            const trackTitle = c(track?.title) || "Track " + (track?.id || "?");
            const artistName = c(artist?.name) || "Unknown Artist";
            const sourceUrls = srcs.map((s) => c(s.provider) + ":track:" + (c(track?.slug) || ""));

            let movement = "same";
            const isNew = Number(item.is_new_entry ?? 0);
            const isRe = Number(item.is_re_entry ?? 0);
            const prevRank = item.previous_rank != null ? Number(item.previous_rank) : null;
            const rank = Number(item.rank);
            if (isNew) movement = "new";
            else if (isRe) movement = "re_entry";
            else if (prevRank != null) {
              if (rank < prevRank) movement = "up";
              else if (rank > prevRank) movement = "down";
            }

            entries.push({
              id: safeId("entry", edDate + "_" + String(rank).padStart(3, "0") + "_" + (track?.id || "0")),
              edition_id: edId, rank, previous_rank: prevRank, movement,
              track_slug: c(track?.slug) || null, track_title: trackTitle,
              artist_slug: c(artist?.slug) || null, artist_name: artistName,
              artwork_url: null, normalized_key: slugify(trackTitle) + "::" + slugify(artistName),
              source_urls_seen: [...new Set(sourceUrls)],
              source_payload: {
                old_track_id: track?.id, weeks_on_chart: item.weeks_on_chart,
                peak_position: item.peak_position, is_new_entry: isNew,
                is_re_entry: isRe, track_isrc: c(track?.isrc) || null,
                track_spotify_id: c(track?.spotify_id) || null,
                track_apple_music_id: c(track?.apple_music_id) || null,
                track_youtube_id: c(track?.youtube_id) || null,
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

      // ---- Write to v2 tables ----
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
        summary: { charts: charts.length, editions: editions.length, entries: entries.length },
        inserted,
        errors: errors.length > 0 ? errors : undefined,
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });

    }

    return new Response(JSON.stringify({ error: "Unknown action: " + (action || "none") }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (err) {
    return new Response(JSON.stringify({ error: err instanceof Error ? err.message : "Internal error" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
