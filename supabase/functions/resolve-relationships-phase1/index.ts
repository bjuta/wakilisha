
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const BATCH_SIZE = 500;

interface LookupMaps {
  wkchartsArtistIdToSlug: Map<string, string>;
  wkchartsTrackIdToSlug: Map<string, string>;
  wkchartsReleaseIdToSlug: Map<string, string>;
  wkchartsLabelIdToSlug: Map<string, string>;
  wkchartsGenreIdToSlug: Map<string, string>;
  wkchartsEditionIdToSlug: Map<string, string>;
  wpPostIdToSlug: Map<string, string>;
  termTaxonomyIdToSlug: Map<string, string>;
  artistTermIdToSlug: Map<string, string>;
}

interface ResolutionStats {
  total: number;
  resolved: number;
  orphaned: number;
  orphan_ids: string[];
  errors: string[];
}

function corsHeaders() {
  return {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  };
}

async function buildLookupMaps(supabase: any, ingestionRunId: string): Promise<LookupMaps> {
  const maps: LookupMaps = {
    wkchartsArtistIdToSlug: new Map(),
    wkchartsTrackIdToSlug: new Map(),
    wkchartsReleaseIdToSlug: new Map(),
    wkchartsLabelIdToSlug: new Map(),
    wkchartsGenreIdToSlug: new Map(),
    wkchartsEditionIdToSlug: new Map(),
    wpPostIdToSlug: new Map(),
    termTaxonomyIdToSlug: new Map(),
    artistTermIdToSlug: new Map(),
  };

  async function* fetchAll(query: any) {
    let range = 0;
    while (true) {
      const { data, error } = await query.range(range, range + 999);
      if (error) throw error;
      if (!data || data.length === 0) break;
      for (const row of data) yield row;
      if (data.length < 1000) break;
      range += 1000;
    }
  }

  const buildSelect = (sourceEntity: string) =>
    supabase
      .from("wk_import_staging_records")
      .select("raw_record, target_slug")
      .eq("ingestion_run_id", ingestionRunId)
      .eq("source_entity", sourceEntity)
      .not("target_slug", "is", null);

  const buildByTargetEntity = (targetEntity: string) =>
    supabase
      .from("wk_import_staging_records")
      .select("raw_record, target_slug")
      .eq("ingestion_run_id", ingestionRunId)
      .eq("target_entity", targetEntity)
      .not("target_slug", "is", null);

  // wkcharts artists
  for await (const row of fetchAll(buildSelect("mysql.wkcharts_artists"))) {
    const id = row.raw_record?.id;
    if (id != null) maps.wkchartsArtistIdToSlug.set(String(id), row.target_slug);
  }

  // wkcharts tracks
  for await (const row of fetchAll(buildSelect("mysql.wkcharts_tracks"))) {
    const id = row.raw_record?.id;
    if (id != null) maps.wkchartsTrackIdToSlug.set(String(id), row.target_slug);
  }

  // wkcharts releases
  for await (const row of fetchAll(buildSelect("mysql.wkcharts_releases"))) {
    const id = row.raw_record?.id;
    if (id != null) maps.wkchartsReleaseIdToSlug.set(String(id), row.target_slug);
  }

  // wkcharts labels
  for await (const row of fetchAll(buildSelect("mysql.wkcharts_labels"))) {
    const id = row.raw_record?.id;
    if (id != null) maps.wkchartsLabelIdToSlug.set(String(id), row.target_slug);
  }

  // wkcharts genres
  for await (const row of fetchAll(buildSelect("mysql.wkcharts_genres"))) {
    const id = row.raw_record?.id;
    if (id != null) maps.wkchartsGenreIdToSlug.set(String(id), row.target_slug);
  }

  // wkcharts editions → derive slug from chart_slug + edition_date
  for await (const row of fetchAll(buildSelect("mysql.wkcharts_editions"))) {
    const id = row.raw_record?.id;
    const chartSlug = row.raw_record?.chart_slug;
    const editionDate = row.raw_record?.edition_date;
    if (id != null && chartSlug && editionDate) {
      const dateOnly = String(editionDate).slice(0, 10);
      maps.wkchartsEditionIdToSlug.set(String(id), `${chartSlug}-${dateOnly}`);
    }
  }

  // WP posts (articles, pages)
  for await (const row of fetchAll(
    supabase
      .from("wk_import_staging_records")
      .select("raw_record, target_slug, target_entity")
      .eq("ingestion_run_id", ingestionRunId)
      .in("target_entity", ["articles", "pages"])
      .not("target_slug", "is", null)
  )) {
    const wpId = row.raw_record?.ID;
    if (wpId != null) maps.wpPostIdToSlug.set(String(wpId), row.target_slug);
  }

  // WP artists (mysql.wakilisha_artist has raw_record.ID)
  for await (const row of fetchAll(buildSelect("mysql.wakilisha_artist"))) {
    const wpId = row.raw_record?.ID;
    if (wpId != null) maps.wpPostIdToSlug.set(String(wpId), row.target_slug);
  }
  // Also wkcharts artists can link to WP posts (for artist_relationships.related_post_id)
  for await (const row of fetchAll(buildSelect("mysql.wkcharts_artists"))) {
    const wpId = row.raw_record?.ID;
    if (wpId != null && !maps.wpPostIdToSlug.has(String(wpId))) {
      maps.wpPostIdToSlug.set(String(wpId), row.target_slug);
    }
  }

  // Taxonomy terms
  for await (const row of fetchAll(buildByTargetEntity("taxonomy_terms"))) {
    const ttId = row.raw_record?.term_taxonomy_id;
    if (ttId != null) maps.termTaxonomyIdToSlug.set(String(ttId), row.target_slug);
  }

  // Artist taxonomy terms
  for await (const row of fetchAll(buildByTargetEntity("artist_taxonomy_terms"))) {
    const termId = row.raw_record?.term_id;
    if (termId != null) maps.artistTermIdToSlug.set(String(termId), row.target_slug);
  }

  return maps;
}

// --- Generic batch update helper (for smaller relationship types) ---

async function updateBatch(
  supabase: any,
  updates: { id: string; mapped_record: any }[],
): Promise<string[]> {
  const errors: string[] = [];
  const results = await Promise.allSettled(
    updates.map((u) =>
      supabase
        .from("wk_import_staging_records")
        .update({ mapped_record: u.mapped_record })
        .eq("id", u.id)
    )
  );
  for (const r of results) {
    if (r.status === "rejected") {
      errors.push(`Update error: ${r.reason?.message || r.reason}`);
    }
  }
  return errors;
}

async function processRelationshipBatch(
  supabase: any,
  ingestionRunId: string,
  sourceEntity: string,
  resolver: (raw: any, maps: LookupMaps) => { mapped: any; orphan_keys: string[] },
  maps: LookupMaps,
): Promise<ResolutionStats> {
  const stats: ResolutionStats = { total: 0, resolved: 0, orphaned: 0, orphan_ids: [], errors: [] };

  let range = 0;
  while (true) {
    const { data: rows, error } = await supabase
      .from("wk_import_staging_records")
      .select("id, raw_record, mapped_record")
      .eq("ingestion_run_id", ingestionRunId)
      .eq("source_entity", sourceEntity)
      .range(range, range + BATCH_SIZE - 1);

    if (error) { stats.errors.push(`Fetch error: ${error.message}`); break; }
    if (!rows || rows.length === 0) break;

    const updates: { id: string; mapped_record: any }[] = [];

    for (const row of rows) {
      stats.total++;
      try {
        const { mapped, orphan_keys } = resolver(row.raw_record, maps);
        const existing = row.mapped_record || {};
        updates.push({
          id: row.id,
          mapped_record: {
            ...existing,
            ...mapped,
            _orphan_keys: orphan_keys.length > 0 ? orphan_keys : undefined,
            _resolved_at: new Date().toISOString(),
          },
        });
        if (orphan_keys.length > 0) {
          stats.orphaned++;
          stats.orphan_ids.push(`${row.id}:${orphan_keys.join(",")}`);
        } else {
          stats.resolved++;
        }
      } catch (e) {
        stats.errors.push(`Processing ${row.id}: ${e.message}`);
      }
    }

    if (updates.length > 0) {
      const errs = await updateBatch(supabase, updates);
      stats.errors.push(...errs);
    }

    if (rows.length < BATCH_SIZE) break;
    range += BATCH_SIZE;
  }

  return stats;
}

// --- Optimized processor for wp entity_relationships (68K records) ---

async function processWpRelationships(
  supabase: any,
  ingestionRunId: string,
  maps: LookupMaps,
): Promise<ResolutionStats> {
  const stats: ResolutionStats = { total: 0, resolved: 0, orphaned: 0, orphan_ids: [], errors: [] };

  let range = 0;
  while (true) {
    const { data: rows, error } = await supabase
      .from("wk_import_staging_records")
      .select("id, raw_record, mapped_record")
      .eq("ingestion_run_id", ingestionRunId)
      .eq("source_entity", "mysql.relationships")
      .range(range, range + BATCH_SIZE - 1);

    if (error) { stats.errors.push(`Fetch error: ${error.message}`); break; }
    if (!rows || rows.length === 0) break;

    const updates: { id: string; mapped_record: any }[] = [];

    for (const row of rows) {
      stats.total++;
      const raw = row.raw_record || {};
      const objectId = String(raw.object_id ?? "");
      const ttId = String(raw.term_taxonomy_id ?? "");

      const objectSlug = maps.wpPostIdToSlug.get(objectId);
      const termSlug = maps.termTaxonomyIdToSlug.get(ttId);

      const orphanKeys: string[] = [];
      if (!objectSlug) orphanKeys.push(`object_id:${objectId}`);
      if (!termSlug) orphanKeys.push(`term_taxonomy_id:${ttId}`);

      if (orphanKeys.length > 0) {
        stats.orphaned++;
        stats.orphan_ids.push(`${row.id}:${orphanKeys.join(",")}`);
      } else {
        stats.resolved++;
      }

      const existing = row.mapped_record || {};
      updates.push({
        id: row.id,
        mapped_record: {
          ...existing,
          object_slug: objectSlug || null,
          term_slug: termSlug || null,
          term_order: raw.term_order ?? 0,
          _orphan_keys: orphanKeys.length > 0 ? orphanKeys : undefined,
          _resolved_at: new Date().toISOString(),
        },
      });
    }

    if (updates.length > 0) {
      const errs = await updateBatch(supabase, updates);
      stats.errors.push(...errs);
    }

    if (rows.length < BATCH_SIZE) break;
    range += BATCH_SIZE;
  }

  return stats;
}

// --- Resolver functions ---

function resolveTrackArtists(raw: any, maps: LookupMaps) {
  const trackSlug = maps.wkchartsTrackIdToSlug.get(String(raw.track_id ?? ""));
  const artistSlug = maps.wkchartsArtistIdToSlug.get(String(raw.artist_id ?? ""));
  const orphans: string[] = [];
  if (!trackSlug) orphans.push(`track_id:${raw.track_id}`);
  if (!artistSlug) orphans.push(`artist_id:${raw.artist_id}`);
  return {
    mapped: {
      track_slug: trackSlug || null,
      artist_slug: artistSlug || null,
      role: raw.role || "primary",
      confidence: raw.confidence || null,
      sort_order: raw.sort_order ?? 0,
    },
    orphan_keys: orphans,
  };
}

function resolveReleaseTracks(raw: any, maps: LookupMaps) {
  const trackSlug = maps.wkchartsTrackIdToSlug.get(String(raw.track_id ?? ""));
  const releaseSlug = maps.wkchartsReleaseIdToSlug.get(String(raw.release_id ?? ""));
  const orphans: string[] = [];
  if (!trackSlug) orphans.push(`track_id:${raw.track_id}`);
  if (!releaseSlug) orphans.push(`release_id:${raw.release_id}`);
  return {
    mapped: {
      track_slug: trackSlug || null,
      release_slug: releaseSlug || null,
      disc_number: raw.disc_number ?? 1,
      track_number: raw.track_number ?? 0,
    },
    orphan_keys: orphans,
  };
}

function resolveChartEntries(raw: any, maps: LookupMaps) {
  const trackSlug = maps.wkchartsTrackIdToSlug.get(String(raw.track_id ?? ""));
  const editionSlug = maps.wkchartsEditionIdToSlug.get(String(raw.edition_id ?? ""));
  const orphans: string[] = [];
  if (!trackSlug) orphans.push(`track_id:${raw.track_id}`);
  if (!editionSlug) orphans.push(`edition_id:${raw.edition_id}`);
  return {
    mapped: {
      track_slug: trackSlug || null,
      edition_slug: editionSlug || null,
      position: raw.position ?? null,
      score: raw.score ?? null,
      isrc: raw.isrc || null,
      provider: raw.provider || null,
      title: raw.title || null,
      artist_name: raw.artist_name || null,
      artwork_url: raw.artwork_url || null,
      continuity_locked: raw.continuity_locked ?? 0,
      previous_position: raw.previous_position ?? null,
    },
    orphan_keys: orphans,
  };
}

function resolveReleaseLabels(raw: any, maps: LookupMaps) {
  const releaseSlug = maps.wkchartsReleaseIdToSlug.get(String(raw.release_id ?? ""));
  const labelSlug = maps.wkchartsLabelIdToSlug.get(String(raw.label_id ?? ""));
  const orphans: string[] = [];
  if (!releaseSlug) orphans.push(`release_id:${raw.release_id}`);
  if (!labelSlug) orphans.push(`label_id:${raw.label_id}`);
  return {
    mapped: {
      release_slug: releaseSlug || null,
      label_slug: labelSlug || null,
      role: raw.role || "label",
      confidence: raw.confidence || null,
      sort_order: raw.sort_order ?? 0,
      is_display_primary: raw.is_display_primary ?? 0,
      source_kind: raw.source_kind || null,
    },
    orphan_keys: orphans,
  };
}

function resolveArtistGenres(raw: any, maps: LookupMaps) {
  const artistSlug = maps.wkchartsArtistIdToSlug.get(String(raw.artist_id ?? ""));
  const genreSlug = maps.wkchartsGenreIdToSlug.get(String(raw.genre_id ?? ""));
  const orphans: string[] = [];
  if (!artistSlug) orphans.push(`artist_id:${raw.artist_id}`);
  if (!genreSlug) orphans.push(`genre_id:${raw.genre_id}`);
  return {
    mapped: {
      artist_slug: artistSlug || null,
      genre_slug: genreSlug || null,
      confidence: raw.confidence || null,
      source: raw.source || null,
      is_primary: raw.is_primary ?? 0,
    },
    orphan_keys: orphans,
  };
}

function resolveArtistRelationships(raw: any, maps: LookupMaps) {
  const artistSlug = maps.wkchartsArtistIdToSlug.get(String(raw.artist_id ?? ""));
  const relatedArtistSlug = maps.wkchartsArtistIdToSlug.get(String(raw.related_artist_id ?? ""));
  const orphans: string[] = [];
  if (!artistSlug) orphans.push(`artist_id:${raw.artist_id}`);
  if (!relatedArtistSlug) orphans.push(`related_artist_id:${raw.related_artist_id}`);
  const relatedPostSlug = raw.related_post_id != null
    ? (maps.wpPostIdToSlug.get(String(raw.related_post_id)) || null)
    : null;
  return {
    mapped: {
      artist_slug: artistSlug || null,
      related_artist_slug: relatedArtistSlug || null,
      related_post_slug: relatedPostSlug,
      relation_type: raw.relation_type || null,
      score: raw.score || null,
      shared_tracks_all: raw.shared_tracks_all ?? null,
      shared_chart_tracks: raw.shared_chart_tracks ?? null,
      artist_features_them: raw.artist_features_them ?? null,
      they_feature_artist: raw.they_feature_artist ?? null,
    },
    orphan_keys: orphans,
  };
}

function resolveWkchartsEntityRelationships(raw: any, maps: LookupMaps) {
  const sourceType = raw.source_entity_type || "";
  const targetType = raw.target_entity_type || "";
  const sourceId = String(raw.source_entity_id ?? "");
  const targetId = String(raw.target_entity_id ?? "");

  let sourceSlug: string | null = null;
  let targetSlug: string | null = null;

  switch (sourceType) {
    case "artists": sourceSlug = maps.wkchartsArtistIdToSlug.get(sourceId) ?? null; break;
    case "tracks": sourceSlug = maps.wkchartsTrackIdToSlug.get(sourceId) ?? null; break;
    case "releases": sourceSlug = maps.wkchartsReleaseIdToSlug.get(sourceId) ?? null; break;
    case "labels": sourceSlug = maps.wkchartsLabelIdToSlug.get(sourceId) ?? null; break;
  }

  switch (targetType) {
    case "artists": targetSlug = maps.wkchartsArtistIdToSlug.get(targetId) ?? null; break;
    case "tracks": targetSlug = maps.wkchartsTrackIdToSlug.get(targetId) ?? null; break;
    case "releases": targetSlug = maps.wkchartsReleaseIdToSlug.get(targetId) ?? null; break;
    case "labels": targetSlug = maps.wkchartsLabelIdToSlug.get(targetId) ?? null; break;
  }

  const orphans: string[] = [];
  if (!sourceSlug) orphans.push(`source_entity_id:${sourceId}(${sourceType})`);
  if (!targetSlug) orphans.push(`target_entity_id:${targetId}(${targetType})`);

  return {
    mapped: {
      relationship_type: raw.relationship_type || null,
      relationship_role: raw.relationship_role || null,
      source_entity_type: sourceType,
      target_entity_type: targetType,
      source_slug: sourceSlug || null,
      target_slug: targetSlug || null,
      confidence: raw.confidence || null,
      sort_order: raw.sort_order ?? 0,
      context_type: raw.context_type || null,
      context_id: raw.context_id ?? null,
      notes: raw.notes || null,
      status: raw.status || null,
      source_table: raw.source_table || null,
      source_row_id: raw.source_row_id ?? null,
    },
    orphan_keys: orphans,
  };
}

function resolveArtistTaxonomyTerms(raw: any, maps: LookupMaps) {
  const termSlug = maps.artistTermIdToSlug.get(String(raw.term_id ?? ""));
  const orphans: string[] = [];
  if (!termSlug) orphans.push(`term_id:${raw.term_id}`);
  return {
    mapped: {
      term_slug: termSlug || raw.slug || null,
      term_name: raw.name || null,
      taxonomy: raw.taxonomy || null,
      parent: raw.parent ?? 0,
      count: raw.count ?? 0,
      description: raw.description || null,
    },
    orphan_keys: orphans,
  };
}

// --- Main ---

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders() });
  }

  try {
    const body = await req.json();
    const { ingestion_run_id } = body;

    if (!ingestion_run_id) {
      return new Response(
        JSON.stringify({ error: "Missing ingestion_run_id" }),
        { status: 400, headers: corsHeaders() }
      );
    }

    const supabaseUrl = Deno.env.get("VITE_PUBLIC_SUPABASE_URL") || Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    console.log(`[Phase1] Building lookup maps for run: ${ingestion_run_id}`);

    const maps = await buildLookupMaps(supabase, ingestionRunId);

    const lookupSizes = {
      wkcharts_artists: maps.wkchartsArtistIdToSlug.size,
      wkcharts_tracks: maps.wkchartsTrackIdToSlug.size,
      wkcharts_releases: maps.wkchartsReleaseIdToSlug.size,
      wkcharts_labels: maps.wkchartsLabelIdToSlug.size,
      wkcharts_genres: maps.wkchartsGenreIdToSlug.size,
      wkcharts_editions: maps.wkchartsEditionIdToSlug.size,
      wp_posts: maps.wpPostIdToSlug.size,
      taxonomy_terms: maps.termTaxonomyIdToSlug.size,
      artist_terms: maps.artistTermIdToSlug.size,
    };
    console.log("[Phase1] Lookup maps built:", JSON.stringify(lookupSizes));

    const results: Record<string, ResolutionStats> = {};

    // Process each relationship type
    console.log("[Phase1] Resolving wp entity_relationships (mysql.relationships)...");
    results.entity_relationships_wp = await processWpRelationships(supabase, ingestionRunId, maps);

    console.log("[Phase1] Resolving wkcharts entity_relationships...");
    results.entity_relationships_wk = await processRelationshipBatch(
      supabase, ingestionRunId, "mysql.wkcharts_entity_relationships",
      resolveWkchartsEntityRelationships, maps
    );

    console.log("[Phase1] Resolving track_artists...");
    results.track_artists = await processRelationshipBatch(
      supabase, ingestionRunId, "mysql.wkcharts_track_artists",
      resolveTrackArtists, maps
    );

    console.log("[Phase1] Resolving chart_entries...");
    results.chart_entries = await processRelationshipBatch(
      supabase, ingestionRunId, "mysql.wkcharts_edition_items",
      resolveChartEntries, maps
    );

    console.log("[Phase1] Resolving release_tracks...");
    results.release_tracks = await processRelationshipBatch(
      supabase, ingestionRunId, "mysql.wkcharts_release_tracks",
      resolveReleaseTracks, maps
    );

    console.log("[Phase1] Resolving artist_relationships...");
    results.artist_relationships = await processRelationshipBatch(
      supabase, ingestionRunId, "mysql.wkcharts_artist_relations",
      resolveArtistRelationships, maps
    );

    console.log("[Phase1] Resolving release_labels...");
    results.release_labels = await processRelationshipBatch(
      supabase, ingestionRunId, "mysql.wkcharts_release_labels",
      resolveReleaseLabels, maps
    );

    console.log("[Phase1] Resolving artist_genres...");
    results.artist_genres = await processRelationshipBatch(
      supabase, ingestionRunId, "mysql.wkcharts_artist_genres",
      resolveArtistGenres, maps
    );

    console.log("[Phase1] Resolving artist_taxonomy_terms (wk_artist_genre)...");
    results.artist_taxonomy_terms = await processRelationshipBatch(
      supabase, ingestionRunId, "mysql.wk_artist_genre",
      resolveArtistTaxonomyTerms, maps
    );
    console.log("[Phase1] Resolving artist_taxonomy_terms (wk_artist_origin)...");
    const originStats = await processRelationshipBatch(
      supabase, ingestionRunId, "mysql.wk_artist_origin",
      resolveArtistTaxonomyTerms, maps
    );
    results.artist_taxonomy_terms.total += originStats.total;
    results.artist_taxonomy_terms.resolved += originStats.resolved;
    results.artist_taxonomy_terms.orphaned += originStats.orphaned;
    results.artist_taxonomy_terms.orphan_ids.push(...originStats.orphan_ids);
    results.artist_taxonomy_terms.errors.push(...originStats.errors);

    const grandTotal = Object.values(results).reduce((s, r) => s + r.total, 0);
    const grandResolved = Object.values(results).reduce((s, r) => s + r.resolved, 0);
    const grandOrphaned = Object.values(results).reduce((s, r) => s + r.orphaned, 0);
    const grandErrors = Object.values(results).reduce((s, r) => s + r.errors.length, 0);

    console.log(`[Phase1] Complete. Total: ${grandTotal}, Resolved: ${grandResolved}, Orphaned: ${grandOrphaned}`);

    return new Response(JSON.stringify({
      ingestion_run_id,
      lookup_map_sizes: lookupSizes,
      results,
      grand_total: grandTotal,
      grand_resolved: grandResolved,
      grand_orphaned: grandOrphaned,
      grand_errors: grandErrors,
    }), { headers: corsHeaders() });

  } catch (err) {
    console.error("[Phase1] Fatal error:", err);
    return new Response(
      JSON.stringify({ error: err.message, stack: err.stack }),
      { status: 500, headers: corsHeaders() }
    );
  }
});
