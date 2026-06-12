import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js";
import { Client as MySQLClient } from "https://deno.land/x/mysql@v2.12.1/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// ── VERIFIED MARKET MAPPING (June 2026) ──
// Only Kenya has published charts. No auto-inference.
const VERIFIED_MARKET_MAP: Record<string, { series: string; market: string; label: string }> = {
  "2026":      { series: "2026-releases", market: "kenya", label: "2026 Releases" },
  "gengetone": { series: "gengetone",     market: "kenya", label: "Gengetone Songs" },
  "kenya":     { series: "top-songs",     market: "kenya", label: "Top 100 Songs" },
  "rnb":       { series: "rnb",           market: "kenya", label: "R&B Songs" },
};

const MARKET_CODES: Record<string, { code: string; tz: string }> = {
  kenya:       { code: "KE", tz: "Africa/Nairobi" },
  nigeria:     { code: "NG", tz: "Africa/Lagos" },
  "south-africa": { code: "ZA", tz: "Africa/Johannesburg" },
  ghana:       { code: "GH", tz: "Africa/Accra" },
  tanzania:    { code: "TZ", tz: "Africa/Dar_es_Salaam" },
  uganda:      { code: "UG", tz: "Africa/Kampala" },
};

function clean(v: unknown): string { return String(v ?? "").trim(); }

function isoDate(v: unknown): string {
  if (v instanceof Date && !isNaN(v.getTime())) return v.toISOString().slice(0, 10);
  const s = String(v ?? "").trim().slice(0, 10);
  return s.match(/^\d{4}-\d{2}-\d{2}$/) ? s : "";
}

function safeSlug(v: string): string {
  return v.toLowerCase().normalize("NFKD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

function safeId(prefix: string, v: string): string {
  return (prefix + "_" + safeSlug(v)).replace(/-+/g, "_").slice(0, 64);
}

function slugify(v: string): string {
  return v.toLowerCase().normalize("NFKD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 160);
}

function wpTbl(prefix: string, name: string): string { return "`" + prefix + name + "`"; }

function jsonResponse(data: Record<string, unknown>, status = 200): Response {
  return new Response(JSON.stringify(data), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}

// ── REGISTRY CANONICALIZATION (non-blocking) ──

async function lookupRegistryEntities(
  supabase: ReturnType<typeof createClient>,
  tracks: Array<{ title: string; slug: string; isrc: string | null; artist_name: string; artist_slug: string }>,
): Promise<{
  trackMap: Map<string, { canonical_track_id: string | null; canonical_release_id: string | null; canonical_artist_id: string | null }>;
  stats: { matched_tracks: number; unmatched_tracks: number; matched_artists: number };
}> {
  const trackMap = new Map<string, { canonical_track_id: string | null; canonical_release_id: string | null; canonical_artist_id: string | null }>();
  let matchedTracks = 0;
  let unmatchedTracks = 0;
  let matchedArtists = 0;

  // Look up by ISRC (most reliable)
  const isrcs = [...new Set(tracks.map((t) => t.isrc).filter(Boolean))] as string[];
  const isrcTrackMap = new Map<string, { id: string; slug: string; release_id: string | null }>();

  if (isrcs.length > 0) {
    for (let i = 0; i < isrcs.length; i += 100) {
      const batch = isrcs.slice(i, i + 100);
      const { data } = await supabase.from("registry_tracks").select("id, slug, isrc, release_id").in("isrc", batch).not("isrc", "is", null);
      if (data) { for (const row of data) { if (row.isrc) isrcTrackMap.set(row.isrc.toLowerCase(), row); } }
    }
  }

  // Look up by slug (fallback)
  const slugs = [...new Set(tracks.map((t) => t.slug).filter(Boolean))];
  const slugTrackMap = new Map<string, { id: string; slug: string; release_id: string | null }>();
  if (slugs.length > 0) {
    for (let i = 0; i < slugs.length; i += 100) {
      const batch = slugs.slice(i, i + 100);
      const { data } = await supabase.from("registry_tracks").select("id, slug, release_id").in("slug", batch);
      if (data) { for (const row of data) { slugTrackMap.set(row.slug, row); } }
    }
  }

  // Look up artists by slug
  const artistSlugs = [...new Set(tracks.map((t) => t.artist_slug).filter(Boolean))];
  const artistMap = new Map<string, string>();
  if (artistSlugs.length > 0) {
    for (let i = 0; i < artistSlugs.length; i += 100) {
      const batch = artistSlugs.slice(i, i + 100);
      const { data } = await supabase.from("registry_artists").select("id, slug").in("slug", batch);
      if (data) { for (const row of data) { artistMap.set(row.slug, row.id); } }
    }
  }

  // Match each track
  for (const tr of tracks) {
    const key = `${tr.title}::${tr.artist_name}`;
    let canonicalTrackId: string | null = null;
    let canonicalReleaseId: string | null = null;

    if (tr.isrc) {
      const match = isrcTrackMap.get(tr.isrc.toLowerCase());
      if (match) { canonicalTrackId = match.id; canonicalReleaseId = match.release_id ?? null; matchedTracks++; }
    }

    if (!canonicalTrackId) {
      const slugMatch = slugTrackMap.get(tr.slug);
      if (slugMatch) { canonicalTrackId = slugMatch.id; canonicalReleaseId = slugMatch.release_id ?? null; matchedTracks++; }
    }

    if (!canonicalTrackId) { unmatchedTracks++; }

    const artistId = artistMap.get(tr.artist_slug) ?? null;
    if (artistId) matchedArtists++;

    trackMap.set(key, { canonical_track_id: canonicalTrackId, canonical_release_id: canonicalReleaseId, canonical_artist_id: artistId });
  }

  return { trackMap, stats: { matched_tracks: matchedTracks, unmatched_tracks: unmatchedTracks, matched_artists: matchedArtists } };
}

// ── MAIN ──

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  if (!supabaseUrl || !supabaseKey) return jsonResponse({ error: "Supabase config missing" }, 500);
  const supabase = createClient(supabaseUrl, supabaseKey);

  try {
    const body = await req.json();
    const { action, credentials } = body;

    if (!credentials || typeof credentials !== "object") return jsonResponse({ error: "credentials object is required" }, 400);
    const { host, port = 3306, user, password, database, prefix = "wp_" } = credentials;
    if (!host || !user || !password || !database) return jsonResponse({ error: "host, user, password, database are required" }, 400);

    let wp: MySQLClient;
    try {
      wp = new MySQLClient();
      await wp.connect({ hostname: host, port: Number(port), username: user, password, db: database, connectTimeout: 15000 });
    } catch (err) {
      return jsonResponse({ success: false, accessible: false, error: err instanceof Error ? err.message : "Could not connect to MySQL" });
    }

    try {
      // ── DISCOVER ──
      if (action === "discover") {
        const tables = ["wkcharts_charts","wkcharts_editions","wkcharts_edition_items","wkcharts_tracks","wkcharts_artists","wkcharts_track_artists","wkcharts_track_sources","wkcharts_ingest_runs"];
        const counts: Record<string, number> = {};
        for (const name of tables) {
          try { const r = await wp.query("SELECT COUNT(*) AS cnt FROM " + wpTbl(prefix, name)); counts[name] = Number((r as Array<{cnt:number}>)[0]?.cnt ?? 0); } catch { counts[name] = 0; }
        }
        try { const r = await wp.query("SELECT COUNT(*) AS cnt FROM " + wpTbl(prefix, "posts") + " WHERE post_type = 'wk_chart_series'"); counts["wp_posts_wk_chart_series"] = Number((r as Array<{cnt:number}>)[0]?.cnt ?? 0); } catch { counts["wp_posts_wk_chart_series"] = 0; }

        let charts: Array<{id:number;name:string;slug:string;status:string}> = [];
        if (counts["wkcharts_charts"] > 0) { charts = await wp.query("SELECT id, name, slug, status FROM " + wpTbl(prefix, "wkcharts_charts")) as Array<{id:number;name:string;slug:string;status:string}>; }
        if (charts.length === 0 && counts["wp_posts_wk_chart_series"] > 0) { charts = await wp.query("SELECT ID AS id, post_title AS name, post_name AS slug, post_status AS status FROM " + wpTbl(prefix, "posts") + " WHERE post_type = 'wk_chart_series' AND post_status != 'trash'") as Array<{id:number;name:string;slug:string;status:string}>; }

        const mappingPreview = charts.map((c) => {
          const s = clean(c.slug); const known = VERIFIED_MARKET_MAP[s];
          return { old_id: c.id, old_slug: s, old_name: clean(c.name), new_series: known?.series ?? "UNKNOWN", new_market: known?.market ?? "UNKNOWN", status: known ? "verified" : "needs_mapping" };
        });

        await wp.close();
        return jsonResponse({ success: true, tables: counts, charts_found: charts.length, mapping_preview: mappingPreview });
      }

      // ── PREVIEW ──
      if (action === "preview") {
        const counts: Record<string, number> = {};
        try { const r = await wp.query("SELECT COUNT(*) AS cnt FROM " + wpTbl(prefix, "wkcharts_editions")); counts["editions"] = Number((r as Array<{cnt:number}>)[0]?.cnt ?? 0); } catch { counts["editions"] = 0; }
        try { const r = await wp.query("SELECT COUNT(*) AS cnt FROM " + wpTbl(prefix, "wkcharts_edition_items")); counts["entries"] = Number((r as Array<{cnt:number}>)[0]?.cnt ?? 0); } catch { counts["entries"] = 0; }

        let charts: Array<{id:number;name:string;slug:string;status:string}> = [];
        try { charts = await wp.query("SELECT id, name, slug, status FROM " + wpTbl(prefix, "wkcharts_charts")) as Array<{id:number;name:string;slug:string;status:string}>; } catch {}
        if (charts.length === 0) {
          try { charts = await wp.query("SELECT ID AS id, post_title AS name, post_name AS slug, post_status AS status FROM " + wpTbl(prefix, "posts") + " WHERE post_type = 'wk_chart_series' AND post_status != 'trash'") as Array<{id:number;name:string;slug:string;status:string}>; } catch {}
        }

        const programs: Array<{slug:string;series:string;market:string;editions:number}> = [];
        for (const chart of charts) {
          const s = clean(chart.slug); const known = VERIFIED_MARKET_MAP[s];
          let edCnt = 0;
          try { const r = await wp.query("SELECT COUNT(*) AS cnt FROM " + wpTbl(prefix, "wkcharts_editions") + " WHERE chart_id = ?", [chart.id]); edCnt = Number((r as Array<{cnt:number}>)[0]?.cnt ?? 0); } catch {}
          programs.push({ slug: s, series: known?.series ?? "UNKNOWN", market: known?.market ?? "UNKNOWN", editions: edCnt });
        }

        let sampleEditions: Array<{date:string;items:number}> = [];
        try { sampleEditions = await wp.query("SELECT e.edition_date AS date, COUNT(ei.id) AS items FROM " + wpTbl(prefix, "wkcharts_editions") + " e LEFT JOIN " + wpTbl(prefix, "wkcharts_edition_items") + " ei ON ei.edition_id = e.id GROUP BY e.id, e.edition_date ORDER BY e.edition_date DESC LIMIT 10") as Array<{date:string;items:number}>; } catch {}

        await wp.close();
        return jsonResponse({ success: true, counts, programs, sample_editions: sampleEditions, verified_mappings: Object.keys(VERIFIED_MARKET_MAP).length });
      }

      // ── IMPORT ──
      if (action === "import") {
        console.log("[clean-wp-chart-import] Starting import from " + host + "/" + database);

        let charts: Array<{id:number;name:string;slug:string;status:string}> = [];
        try { charts = await wp.query("SELECT id, name, slug, status FROM " + wpTbl(prefix, "wkcharts_charts")) as Array<{id:number;name:string;slug:string;status:string}>; } catch {}
        if (charts.length === 0) {
          try { charts = await wp.query("SELECT ID AS id, post_title AS name, post_name AS slug, post_status AS status FROM " + wpTbl(prefix, "posts") + " WHERE post_type = 'wk_chart_series' AND post_status != 'trash'") as Array<{id:number;name:string;slug:string;status:string}>; } catch {}
        }
        if (charts.length === 0) { await wp.close(); return jsonResponse({ error: "No charts found in WordPress database" }, 404); }

        console.log("[clean-wp-chart-import] Found " + charts.length + " charts");

        // Build mapping
        const mapping: Array<{old_chart_id:number;old_chart_slug:string;old_chart_name:string;series:string;market:string;public_slug:string;public_label:string;program_id:string;verified:boolean}> = [];
        const unmappedSlugs: string[] = [];

        for (const chart of charts) {
          const s = clean(chart.slug); const name = clean(chart.name);
          const known = VERIFIED_MARKET_MAP[s];
          if (known) {
            const pubSlug = known.series + "/" + known.market;
            mapping.push({ old_chart_id: chart.id, old_chart_slug: s, old_chart_name: name, series: known.series, market: known.market, public_slug: pubSlug, public_label: known.label + " \u00b7 " + (known.market === "kenya" ? "Kenya" : known.market), program_id: safeId("program", pubSlug), verified: true });
          } else {
            unmappedSlugs.push(s);
            const series = slugify(s); const market = "kenya"; const pubSlug = series + "/" + market;
            mapping.push({ old_chart_id: chart.id, old_chart_slug: s, old_chart_name: name, series, market, public_slug: pubSlug, public_label: (name || series) + " \u00b7 Kenya", program_id: safeId("program", pubSlug), verified: false });
          }
        }

        console.log("[clean-wp-chart-import] " + mapping.filter((m) => m.verified).length + " verified, " + unmappedSlugs.length + " unmapped");

        // Load all data
        const allEditions: Array<Record<string, unknown>> = [];
        const allEntriesRaw: Array<Record<string, unknown>> = [];
        const allAliases: Array<Record<string, unknown>> = [];
        const allCoverage: Array<Record<string, unknown>> = [];
        const allTracksForRegistry: Array<{title:string;slug:string;isrc:string|null;artist_name:string;artist_slug:string}> = [];

        for (const m of mapping) {
          let editions: Array<Record<string, unknown>> = [];
          try { editions = await wp.query("SELECT id, title, slug, status, edition_date, chart_id, week_number, year, entry_count FROM " + wpTbl(prefix, "wkcharts_editions") + " WHERE chart_id = ? ORDER BY edition_date ASC", [m.old_chart_id]) as Array<Record<string, unknown>>; } catch (err) { console.error("Failed editions for " + m.old_chart_slug + ": " + err); continue; }
          console.log("[clean-wp-chart-import] " + m.old_chart_slug + ": " + editions.length + " editions");

          const ingestByEdition = new Map<number, Record<string, unknown>>();
          try {
            const runs = await wp.query("SELECT id, edition_id, methodology, source_policy, scoring_policy, eligibility_policy, status FROM " + wpTbl(prefix, "wkcharts_ingest_runs") + " WHERE chart_id = ? ORDER BY created_at DESC", [m.old_chart_id]) as Array<Record<string, unknown>>;
            for (const run of runs) { const edId = run.edition_id as number; if (edId && !ingestByEdition.has(edId)) ingestByEdition.set(edId, run); }
          } catch {}

          const allTrackIds = new Set<number>();

          for (const ed of editions) {
            const edId = ed.id as number; const edDate = isoDate(ed.edition_date); const edSlug = clean(ed.slug as string);
            const ingestRun = ingestByEdition.get(edId) || null;

            allAliases.push({ id: safeId("alias", "chart_" + m.old_chart_slug + "_" + edSlug), legacy_slug: "charts/" + m.old_chart_slug + "/" + edSlug, canonical_slug: "charts/" + m.public_slug, entity_type: "chart_program", redirect_status: "active" });

            let items: Array<Record<string, unknown>> = [];
            try { items = await wp.query("SELECT id, edition_id, track_id, rank, previous_rank, weeks_on_chart, peak_position, is_new_entry, is_re_entry FROM " + wpTbl(prefix, "wkcharts_edition_items") + " WHERE edition_id = ? ORDER BY rank ASC", [edId]) as Array<Record<string, unknown>>; } catch (err) { console.error("Failed entries for edition " + edId + ": " + err); continue; }

            for (const item of items) { if (item.track_id) allTrackIds.add(item.track_id as number); }

            const v2EdId = safeId("edition", m.public_slug + "_" + edDate);
            allEditions.push({ id: v2EdId, program_id: m.program_id, edition_slug: edDate, edition_label: clean(ed.title as string) || m.public_label + " \u00b7 " + edDate, edition_date: edDate, period_start: edDate, period_end: edDate, status: "published", entry_count: items.length, chart_size: 20, methodology_version: clean(ingestRun?.methodology as string) || "legacy-import-v1", source_policy_version: clean(ingestRun?.source_policy as string) || "legacy-import", eligibility_policy_version: clean(ingestRun?.eligibility_policy as string) || "legacy-import", scoring_policy_version: clean(ingestRun?.scoring_policy as string) || "legacy-import", rule_set_snapshot: { old_edition_id: edId, old_chart_id: m.old_chart_id, old_chart_slug: m.old_chart_slug, week_number: ed.week_number, year: ed.year, ingest_run_id: ingestRun?.id ?? null, ingest_run_status: ingestRun?.status ?? null, migrated_at: new Date().toISOString() }, ingest_run_id: ingestRun ? String(ingestRun.id) : null, published_at: new Date().toISOString(), published_by: "clean-wp-chart-import" });

            allCoverage.push({ id: safeId("coverage", v2EdId + "_wp_import"), edition_id: v2EdId, source_name: "WordPress Legacy Import", source_count: items.length, coverage_status: items.length > 0 ? "manual" : "unavailable", coverage_payload: { old_edition_id: edId, migrated_at: new Date().toISOString() } });

            for (const item of items) {
              (item as Record<string, unknown>)._v2_edition_id = v2EdId;
              (item as Record<string, unknown>)._chart_id = m.old_chart_id;
              (item as Record<string, unknown>)._public_slug = m.public_slug;
              (item as Record<string, unknown>)._program_id = m.program_id;
              (item as Record<string, unknown>)._verified = m.verified;
            }
            allEntriesRaw.push(...items);
          }

          // Load tracks
          if (allTrackIds.size > 0) {
            const trackIdsArr = [...allTrackIds];
            for (let i = 0; i < trackIdsArr.length; i += 200) {
              const batch = trackIdsArr.slice(i, i + 200);
              const ph = batch.map(() => "?").join(",");
              try {
                const tracks = await wp.query("SELECT id, title, slug, artist_id, spotify_id, apple_music_id, youtube_id, isrc, explicit FROM " + wpTbl(prefix, "wkcharts_tracks") + " WHERE id IN (" + ph + ")", batch) as Array<Record<string, unknown>>;
                for (const item of allEntriesRaw) {
                  const tid = item.track_id as number;
                  const track = tracks.find((t) => t.id === tid);
                  if (track) { (item as Record<string, unknown>)._track = track; }
                }
              } catch (err) { console.error("Failed tracks batch: " + err); }
            }
          }

          // Load artists
          const artistIds = new Set<number>();
          for (const item of allEntriesRaw) {
            const track = (item as Record<string, unknown>)._track as Record<string, unknown> | undefined;
            if (track?.artist_id) artistIds.add(track.artist_id as number);
          }

          if (artistIds.size > 0) {
            const artistIdsArr = [...artistIds];
            for (let i = 0; i < artistIdsArr.length; i += 200) {
              const batch = artistIdsArr.slice(i, i + 200);
              const ph = batch.map(() => "?").join(",");
              try {
                const artists = await wp.query("SELECT id, name, slug FROM " + wpTbl(prefix, "wkcharts_artists") + " WHERE id IN (" + ph + ")", batch) as Array<Record<string, unknown>>;
                for (const item of allEntriesRaw) {
                  const track = (item as Record<string, unknown>)._track as Record<string, unknown> | undefined;
                  if (track?.artist_id) {
                    const artist = artists.find((a) => a.id === track.artist_id);
                    if (artist) {
                      (item as Record<string, unknown>)._artist = artist;
                      const title = clean(track.title as string);
                      const isrc = track.isrc ? clean(track.isrc as string) : null;
                      const artistName = clean(artist.name as string);
                      if (title && artistName) {
                        const exists = allTracksForRegistry.find((t) => t.title === title && t.artist_name === artistName);
                        if (!exists) allTracksForRegistry.push({ title, slug: slugify(title), isrc: isrc || null, artist_name: artistName, artist_slug: slugify(artistName) });
                      }
                    }
                  }
                }
              } catch (err) { console.error("Failed artists batch: " + err); }
            }
          }
        }

        await wp.close();
        console.log("[clean-wp-chart-import] MySQL done. Editions=" + allEditions.length + " Entries=" + allEntriesRaw.length + " RegistryTracks=" + allTracksForRegistry.length);

        // ── REGISTRY CANONICALIZATION ──
        const registryResult = await lookupRegistryEntities(supabase, allTracksForRegistry);
        console.log("[clean-wp-chart-import] Registry: matched=" + registryResult.stats.matched_tracks + " unmatched=" + registryResult.stats.unmatched_tracks + " artists=" + registryResult.stats.matched_artists);

        // ── Build final entries ──
        const finalEntries: Array<Record<string, unknown>> = [];
        let canonMatched = 0; let canonUnmatched = 0;

        for (const item of allEntriesRaw) {
          const track = (item as Record<string, unknown>)._track as Record<string, unknown> | undefined;
          const artist = (item as Record<string, unknown>)._artist as Record<string, unknown> | undefined;
          const v2EdId = (item as Record<string, unknown>)._v2_edition_id as string;
          const edDate = v2EdId ? v2EdId.split("_").pop() || "" : "";

          const trackTitle = clean(track?.title as string) || "Track " + (item.track_id || "unknown");
          const artistName = clean(artist?.name as string) || "Unknown Artist";
          const rank = Number(item.rank ?? 0);
          const prevRank = item.previous_rank != null ? Number(item.previous_rank) : null;
          const isNewEntry = item.is_new_entry === 1 || item.is_new_entry === "1";
          const isReEntry = item.is_re_entry === 1 || item.is_re_entry === "1";

          let movement = "same";
          if (isNewEntry) movement = "new";
          else if (isReEntry) movement = "re_entry";
          else if (prevRank !== null) { if (rank < prevRank) movement = "up"; else if (rank > prevRank) movement = "down"; }

          const canonKey = trackTitle + "::" + artistName;
          const canon = registryResult.trackMap.get(canonKey);
          if (canon?.canonical_track_id) canonMatched++; else canonUnmatched++;

          finalEntries.push({
            id: safeId("entry", edDate + "_" + String(rank).padStart(3, "0") + "_" + String(item.track_id || "0")),
            edition_id: v2EdId, rank, previous_rank: prevRank, movement,
            track_slug: track?.slug ? clean(track.slug as string) : null,
            track_title: trackTitle,
            artist_slug: artist?.slug ? clean(artist.slug as string) : null,
            artist_name: artistName,
            artwork_url: null,
            normalized_key: slugify(trackTitle) + "::" + slugify(artistName),
            lead_artist_key: slugify(artistName),
            source_count: 1, occurrence_count: 1,
            source_urls_seen: track?.youtube_id ? ["https://youtube.com/watch?v=" + clean(track.youtube_id as string)] : [],
            release_date: null,
            canonical_track_id: canon?.canonical_track_id ?? null,
            canonical_release_id: canon?.canonical_release_id ?? null,
            canonical_artist_id: canon?.canonical_artist_id ?? null,
            source_score: 0, total_score: 0,
            continuity_locked: false, carry_forward_only: false, airplay_candidate_only: false,
            overlap_bonus_capped: false, lead_artist_overflow: false, stale_carry_forward_demoted: false,
            eligibility_status: "published",
            eligibility_warnings: canon?.canonical_track_id ? [] : [{ type: "no_registry_match", message: "Track not found in registry. Flagged for future enrichment." }],
            source_payload: {
              old_item_id: Number(item.id ?? 0), old_track_id: item.track_id ?? null,
              weeks_on_chart: item.weeks_on_chart ?? null, peak_position: item.peak_position ?? null,
              is_new_entry: isNewEntry, is_re_entry: isReEntry,
              track_isrc: track?.isrc ? clean(track.isrc as string) : null,
              track_spotify_id: track?.spotify_id ? clean(track.spotify_id as string) : null,
              track_apple_music_id: track?.apple_music_id ? clean(track.apple_music_id as string) : null,
              track_youtube_id: track?.youtube_id ? clean(track.youtube_id as string) : null,
              migrated_at: new Date().toISOString(),
            },
            scoring_policy_version: "legacy-import",
            methodology_version: "legacy-import-v1",
            eligibility_policy_version: "legacy-import",
          });
        }

        console.log("[clean-wp-chart-import] Built " + finalEntries.length + " entries");

        // ── Build series, markets, programs ──
        const seenSeries = new Set<string>(); const seriesRows: Array<Record<string, unknown>> = [];
        const seenMarkets = new Set<string>(); const marketRows: Array<Record<string, unknown>> = [];
        const seenPrograms = new Set<string>(); const programRows: Array<Record<string, unknown>> = [];

        for (const m of mapping) {
          if (!seenSeries.has(m.series)) {
            seenSeries.add(m.series);
            seriesRows.push({ series_slug: m.series, series_label: m.series.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()) });
          }
          if (!seenMarkets.has(m.market)) {
            seenMarkets.add(m.market);
            const mc = MARKET_CODES[m.market] || { code: null, tz: null };
            marketRows.push({ market_slug: m.market, market_label: m.market.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()), market_type: "country", country_code: mc.code, timezone: mc.tz, default_language: "en" });
          }
          if (!seenPrograms.has(m.program_id)) {
            seenPrograms.add(m.program_id);
            programRows.push({ id: m.program_id, series_slug: m.series, market_slug: m.market, public_slug: m.public_slug, public_label: m.public_label, short_label: m.old_chart_name || m.series, source_family_slug: m.old_chart_slug, default_period_type: "weekly", default_methodology_version: "legacy-import-v1", default_eligibility_rules_version: "legacy-import-v1", chart_size: 20, streaming_min_sources: 1, cross_source_mode: "standard", cross_source_weight: 1, continuity_weight: 1, carry_forward_weight: 1, airplay_enabled: false, airplay_station_scope: "all", airplay_min_duration: 20, airplay_weight: 1, airplay_min_stations: 1, airplay_min_detections: 1, airplay_max_score: 24, airplay_rescue_mode: "allow_rescue", anti_gaming_max_tracks_per_lead_artist: 3, anti_gaming_overlap_bonus_cap: 10, anti_gaming_artist_overflow_penalty: 8, anti_gaming_demote_carry_forward_without_current: false, missing_policy: "review", override_mode: "full_pipeline" });
          }
        }

        // ── COMMIT ──
        const inserted: Record<string, number> = {}; const errors: string[] = [];

        const batchInsert = async (table: string, rows: Array<Record<string, unknown>>, conflictCol: string) => {
          if (rows.length === 0) return 0;
          let count = 0;
          for (let i = 0; i < rows.length; i += 200) {
            const batch = rows.slice(i, i + 200);
            const { error } = await supabase.from(table).upsert(batch, { onConflict: conflictCol, ignoreDuplicates: false });
            if (error) { errors.push(table + ": " + error.message); break; }
            count += batch.length;
          }
          return count;
        };

        inserted.series = await batchInsert("wk_chart_series_v2", seriesRows, "series_slug");
        inserted.markets = await batchInsert("wk_chart_markets_v2", marketRows, "market_slug");
        inserted.programs = await batchInsert("wk_chart_programs_v2", programRows, "id");
        inserted.editions = await batchInsert("wk_chart_editions_v2", allEditions, "id");
        inserted.entries = await batchInsert("wk_chart_entries_v2", finalEntries, "id");
        inserted.coverage = await batchInsert("wk_chart_source_coverage_v2", allCoverage, "id");
        inserted.aliases = await batchInsert("wk_chart_slug_aliases_v2", allAliases, "id");

        console.log("[clean-wp-chart-import] COMMITTED: " + JSON.stringify(inserted));

        return jsonResponse({
          success: errors.length === 0, inserted,
          errors: errors.length > 0 ? errors : undefined,
          registry: { tracks_looked_up: allTracksForRegistry.length, tracks_matched: registryResult.stats.matched_tracks, tracks_unmatched: registryResult.stats.unmatched_tracks, artists_matched: registryResult.stats.matched_artists, canon_entries_matched: canonMatched, canon_entries_unmatched: canonUnmatched },
          mapping: { verified: mapping.filter((m) => m.verified).length, unmapped_slugs: unmappedSlugs, programs_total: mapping.length },
          publish_first: { all_editions_published: true, editions_total: allEditions.length, entries_total: finalEntries.length },
        });
      }

      await wp.close();
      return jsonResponse({ error: "Unknown action: " + (action || "none") }, 400);
    } catch (err) {
      try { await wp.close(); } catch {}
      throw err;
    }
  } catch (err) {
    console.error("[clean-wp-chart-import] FATAL:", err);
    return jsonResponse({ success: false, error: err instanceof Error ? err.message : "Internal error" }, 500);
  }
});
