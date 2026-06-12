#!/usr/bin/env node
// push-wp-charts-v2.mjs - Matches actual WP schema. No guessing.

import mysql from "mysql2/promise";

var HOST = process.env.WP_DB_HOST || "127.0.0.1";
var PORT = Number(process.env.WP_DB_PORT || 3306);
var USER = process.env.WP_DB_USER || "bn_wordpress";
var PASS = process.env.WP_DB_PASSWORD || "236407f4e9404d1cd2215f9759d1ddc198d04fa6aaffc7d61fb98f1422c4eb0b";
var DB   = process.env.WP_DB_NAME || "bitnami_wordpress";
var PREF = process.env.WP_DB_PREFIX || "wp_";
var EDGE_URL = "https://pgzizndxdyhqmtyywjmt.supabase.co/functions/v1/import-wp-charts-v2";

function tbl(n) { return "`" + PREF + n + "`"; }
function c(v)  { return String(v != null ? v : "").trim(); }
function safeSlug(v) { return c(v).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, ""); }
function idate(v) {
  if (v instanceof Date && !isNaN(v.getTime())) return v.toISOString().slice(0, 10);
  return c(v).slice(0, 10);
}

async function main() {
  console.error("[push] Connecting to MySQL " + HOST + ":" + PORT + "/" + DB + "...");
  var db = await mysql.createConnection({
    host: HOST, port: PORT, user: USER, password: PASS, database: DB,
    connectTimeout: 15000,
  });
  await db.ping();
  console.error("[push] Connected.");

  function q(sql, params) {
    return db.query(sql, params).then(function(r) { return r[0]; });
  }

  // Charts
  var chartRows = await q("SELECT id, slug, title, chart_size, provider FROM " + tbl("wkcharts_charts"));
  console.error("[push] " + chartRows.length + " charts");

  // Editions - linked by chart_slug, NOT chart_id
  var edRows = await q("SELECT id, chart_slug, chart_title, source_url, edition_date, status FROM " + tbl("wkcharts_editions") + " ORDER BY edition_date DESC");
  console.error("[push] " + edRows.length + " editions");

  // Items
  var itemRows = await q("SELECT id, edition_id, position, previous_position, track_id, title, artist_name, artwork_url, release_date, isrc, provider, provider_track_id, score, release_id, duration_ms, source_count, carry_forward_only, continuity_locked FROM " + tbl("wkcharts_edition_items") + " ORDER BY edition_id, position ASC");
  console.error("[push] " + itemRows.length + " edition items");

  // Collect track IDs
  var allTids = [];
  var seen = {};
  itemRows.forEach(function(r) {
    if (r.track_id && !seen[r.track_id]) { seen[r.track_id] = true; allTids.push(r.track_id); }
  });

  // Tracks
  var tracksById = {};
  if (allTids.length) {
    var ph = allTids.map(function() { return "?"; }).join(",");
    var trs = await q("SELECT id, normalized_key, title, artist_name, display_artist_line, artwork_url, release_date, isrc, label_name, release_id, duration_ms FROM " + tbl("wkcharts_tracks") + " WHERE id IN (" + ph + ")", allTids);
    trs.forEach(function(t) { tracksById[t.id] = t; });
    console.error("[push] " + trs.length + " tracks");
  }

  // Track sources
  var sourcesByTrack = {};
  if (allTids.length) {
    var ph = allTids.map(function() { return "?"; }).join(",");
    var srcs = await q("SELECT id, track_id, provider, provider_track_id, source_url FROM " + tbl("wkcharts_track_sources") + " WHERE track_id IN (" + ph + ")", allTids);
    srcs.forEach(function(s) {
      if (!sourcesByTrack[s.track_id]) sourcesByTrack[s.track_id] = [];
      sourcesByTrack[s.track_id].push(s);
    });
    console.error("[push] " + srcs.length + " track sources");
  }

  await db.end();
  console.error("[push] MySQL done. Building payload...");

  // Group editions by chart_slug
  var editionsByChart = {};
  edRows.forEach(function(ed) {
    var key = c(ed.chart_slug);
    if (!editionsByChart[key]) editionsByChart[key] = [];
    editionsByChart[key].push(ed);
  });

  // Group items by edition_id
  var itemsByEdition = {};
  itemRows.forEach(function(item) {
    if (!itemsByEdition[item.edition_id]) itemsByEdition[item.edition_id] = [];
    itemsByEdition[item.edition_id].push(item);
  });

  // Build payload
  var outCharts = [];

  chartRows.forEach(function(ch) {
    var chartEditions = editionsByChart[c(ch.slug)] || [];
    var outEds = [];

    chartEditions.forEach(function(ed) {
      var edItems = itemsByEdition[ed.id] || [];
      var outItems = [];

      edItems.forEach(function(item) {
        var track = tracksById[item.track_id];

        // Derive track info - use item fields as fallback if track record missing
        var trackTitle = track ? c(track.title) : c(item.title);
        var trackSlug = track ? c(track.normalized_key) : safeSlug(trackTitle);
        var artistName = track ? c(track.artist_name) : c(item.artist_name);
        var artistSlug = safeSlug(artistName);
        var trackIsrc = track ? (c(track.isrc) || c(item.isrc) || null) : (c(item.isrc) || null);

        if (!trackIsrc || trackIsrc === "") trackIsrc = null;

        var srcs = sourcesByTrack[item.track_id] || [];
        // Also use item.provider/provider_track_id if no explicit sources
        var outSources = [];
        if (srcs.length > 0) {
          srcs.forEach(function(s) {
            outSources.push({
              provider: c(s.provider),
              url: c(s.source_url) || null,
            });
          });
        } else if (c(item.provider)) {
          outSources.push({
            provider: c(item.provider),
            url: c(item.provider_track_id) ? (c(item.provider) + ":track:" + c(item.provider_track_id)) : null,
          });
        }

        outItems.push({
          rank: Number(item.position),
          previous_rank: item.previous_position != null ? Number(item.previous_position) : null,
          weeks_on_chart: null,
          peak_position: null,
          is_new_entry: (item.carry_forward_only === 1) ? 0 : (item.previous_position == null ? 1 : 0),
          is_re_entry: (item.continuity_locked === 1 ? 0 : 0),
          track: {
            id: Number(item.track_id || 0),
            title: trackTitle,
            slug: trackSlug,
            artist_name: artistName || null,
            artist_slug: artistSlug || null,
            spotify_id: null,
            apple_music_id: null,
            youtube_id: null,
            isrc: trackIsrc,
          },
          sources: outSources,
        });
      });

      outEds.push({
        id: Number(ed.id),
        title: c(ed.chart_title),
        slug: safeSlug(c(ed.chart_slug) + "-" + idate(ed.edition_date)),
        status: c(ed.status),
        edition_date: idate(ed.edition_date),
        items: outItems,
      });
    });

    outCharts.push({
      id: Number(ch.id),
      name: c(ch.title),
      slug: c(ch.slug),
      status: "published",
      chart_type: c(ch.provider),
      editions: outEds,
    });
  });

  var body = JSON.stringify({ action: "import", payload: { charts: outCharts } });
  console.error("[push] Payload: " + (body.length / 1024 / 1024).toFixed(1) + " MB");
  console.error("[push] POSTing to " + EDGE_URL + " ...");

  var resp = await fetch(EDGE_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: body,
  });
  var result = await resp.json();
  console.error("[push] Response status: " + resp.status);
  process.stdout.write(JSON.stringify(result, null, 2) + "\n");

  if (result.success) {
    console.error("[push] DONE. Inserted: " + JSON.stringify(result.inserted));
  } else {
    console.error("[push] ERRORS: " + JSON.stringify(result.errors));
  }
}

main().catch(function(err) {
  console.error("[push] FATAL: " + (err && err.message || err));
  if (err && err.stack) console.error(err.stack);
  process.exit(1);
});