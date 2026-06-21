import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { Client } from "https://deno.land/x/mysql@v2.12.1/mod.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const BATCH_SIZE = 100;

const ALLOWED_WP_POST_TYPES = new Set([
  "post", "page", "attachment", "wakilisha_artist", "wk_genre_page",
  "wk_field_guide", "wk_chart_series", "wk_chart_edition", "wk_methodology",
]);

const CPT_MAP: Record<string, { target_entity: string; canonical_kind: string; ready_policy: string }> = {
  post: { target_entity: "articles", canonical_kind: "article", ready_policy: "published_only" },
  page: { target_entity: "pages", canonical_kind: "page", ready_policy: "published_only" },
  wakilisha_artist: { target_entity: "artists", canonical_kind: "artist", ready_policy: "published_only" },
  wk_genre_page: { target_entity: "genres", canonical_kind: "genre", ready_policy: "published_only" },
  wk_field_guide: { target_entity: "guides", canonical_kind: "guide", ready_policy: "published_only" },
  wk_chart_series: { target_entity: "chart_series", canonical_kind: "chart_series", ready_policy: "published_only" },
  wk_chart_edition: { target_entity: "chart_editions", canonical_kind: "chart_edition", ready_policy: "published_only" },
  wk_top10_surface: { target_entity: "chart_surfaces", canonical_kind: "chart_surface", ready_policy: "needs_review" },
  wk_magazine_surface: { target_entity: "magazine_surfaces", canonical_kind: "magazine_surface", ready_policy: "needs_review" },
  wk_methodology: { target_entity: "methodologies", canonical_kind: "methodology", ready_policy: "published_only" },
  wk_correction_page: { target_entity: "corrections", canonical_kind: "correction", ready_policy: "needs_review" },
  wk_play_surface: { target_entity: "play_surfaces", canonical_kind: "play_surface", ready_policy: "needs_review" },
  wk_labels_surface: { target_entity: "label_surfaces", canonical_kind: "label_surface", ready_policy: "needs_review" },
  wk_settings_surface: { target_entity: "settings_surfaces", canonical_kind: "settings_surface", ready_policy: "needs_review" },
  wk_profile_surface: { target_entity: "profile_surfaces", canonical_kind: "profile_surface", ready_policy: "needs_review" },
};

const WAKILISHA_PLUGIN_TABLE_MAP = [
  { table: "wkcharts_tracks", target_entity: "tracks", canonical_kind: "track", id_column: "id", title_column: "title", slug_column: "slug", status_column: "status", body_column: null, excerpt_column: null, date_column: "created_at", author_column: null, url_column: null, extra_columns: ["artist_id", "release_id", "duration", "genre_id", "spotify_id", "apple_music_id", "youtube_id", "isrc", "explicit", "track_number"], ready_policy: "published_only" },
  { table: "wkcharts_releases", target_entity: "releases", canonical_kind: "release", id_column: "id", title_column: "title", slug_column: "slug", status_column: "status", body_column: "description", excerpt_column: null, date_column: "release_date", author_column: null, url_column: null, extra_columns: ["label_id", "artist_id", "type", "cover_url", "upc", "catalog_number", "track_count"], ready_policy: "published_only" },
  { table: "wkcharts_labels", target_entity: "labels", canonical_kind: "label", id_column: "id", title_column: "name", slug_column: "slug", status_column: "status", body_column: "description", excerpt_column: null, date_column: "created_at", author_column: null, url_column: "website", extra_columns: ["logo_url", "country", "founded_year", "parent_label_id"], ready_policy: "published_only" },
  { table: "wkcharts_artists", target_entity: "artists", canonical_kind: "artist", id_column: "id", title_column: "name", slug_column: "slug", status_column: "status", body_column: "bio", excerpt_column: null, date_column: "created_at", author_column: null, url_column: "website", extra_columns: ["image_url", "origin", "artist_type", "spotify_id", "apple_music_id", "instagram_handle", "twitter_handle"], ready_policy: "published_only" },
  { table: "wkcharts_genres", target_entity: "genres", canonical_kind: "genre", id_column: "id", title_column: "name", slug_column: "slug", status_column: null, body_column: "description", excerpt_column: null, date_column: "created_at", author_column: null, url_column: null, extra_columns: ["parent_id", "color", "icon"], ready_policy: "always_ready" },
  { table: "wkcharts_charts", target_entity: "chart_series", canonical_kind: "chart_series", id_column: "id", title_column: "name", slug_column: "slug", status_column: "status", body_column: "description", excerpt_column: null, date_column: "created_at", author_column: null, url_column: null, extra_columns: ["chart_type", "frequency", "market_scope_id", "methodology_id"], ready_policy: "published_only" },
  { table: "wkcharts_editions", target_entity: "chart_editions", canonical_kind: "chart_edition", id_column: "id", title_column: "title", slug_column: "slug", status_column: "status", body_column: null, excerpt_column: null, date_column: "edition_date", author_column: null, url_column: null, extra_columns: ["chart_id", "week_number", "year", "entry_count"], ready_policy: "published_only" },
  { table: "wkcharts_edition_items", target_entity: "chart_entries", canonical_kind: "chart_entry", id_column: "id", title_column: null, slug_column: null, status_column: null, body_column: null, excerpt_column: null, date_column: "created_at", author_column: null, url_column: null, extra_columns: ["edition_id", "track_id", "rank", "previous_rank", "weeks_on_chart", "peak_position", "is_new_entry", "is_re_entry"], ready_policy: "always_ready" },
];

const WAKILISHA_PLUGIN_RELATIONSHIP_TABLES = [
  { table: "wkcharts_track_artists", source_entity: "mysql.wkcharts_track_artists", target_entity: "track_artists", id_column: "id", source_column: "track_id", target_column: "artist_id", extra_columns: ["role", "is_primary", "sort_order"] },
  { table: "wkcharts_release_tracks", source_entity: "mysql.wkcharts_release_tracks", target_entity: "release_tracks", id_column: "id", source_column: "release_id", target_column: "track_id", extra_columns: ["track_number", "disc_number"] },
  { table: "wkcharts_release_labels", source_entity: "mysql.wkcharts_release_labels", target_entity: "release_labels", id_column: "id", source_column: "release_id", target_column: "label_id", extra_columns: ["label_role"] },
  { table: "wkcharts_artist_genres", source_entity: "mysql.wkcharts_artist_genres", target_entity: "artist_genres", id_column: "id", source_column: "artist_id", target_column: "genre_id", extra_columns: [] },
  { table: "wkcharts_artist_relations", source_entity: "mysql.wkcharts_artist_relations", target_entity: "artist_relationships", id_column: "id", source_column: "artist_id", target_column: "related_artist_id", extra_columns: ["relationship_type"] },
  { table: "wkcharts_entity_relationships", source_entity: "mysql.wkcharts_entity_relationships", target_entity: "entity_relationships", id_column: "id", source_column: "source_id", target_column: "target_id", extra_columns: ["source_type", "target_type", "relationship_type", "metadata"] },
  { table: "wkcharts_chart_entry_links", source_entity: "mysql.wkcharts_chart_entry_links", target_entity: "chart_entry_links", id_column: "id", source_column: "entry_id", target_column: "entity_id", extra_columns: ["entity_type"] },
];

const WAKILISHA_PLUGIN_TAXONOMIES = ["wk_artist_genre", "wk_artist_origin"];

function cptEntry(postType: string) { return CPT_MAP[postType] || null; }
function isAllowedPostType(postType: string): boolean { return ALLOWED_WP_POST_TYPES.has(postType); }
function targetEntityForPostType(postType: string): string {
  if (postType === "attachment") return "media_assets";
  const entry = cptEntry(postType);
  if (entry) return entry.target_entity;
  if (isAllowedPostType(postType)) return postType === "post" ? "articles" : postType === "page" ? "pages" : postType;
  return "ignored_post_types";
}
function canonicalKindForPostType(postType: string): string { return cptEntry(postType)?.canonical_kind ?? postType; }
function shouldReady(postType: string, status: string, title: string): boolean {
  const entry = cptEntry(postType);
  if (!title || !["publish", "published"].includes(status.toLowerCase())) return false;
  if (!entry) return postType === "post" || postType === "page";
  return entry.ready_policy === "published_only";
}
function clean(value: unknown): string { return String(value ?? "").trim(); }
function slugify(value: string): string { return value.toLowerCase().normalize("NFKD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 160); }
function parseDate(value: string): string | null { if (!value) return null; const date = new Date(value); return Number.isNaN(date.getTime()) ? null : date.toISOString(); }
function extraColumns(row: Record<string, unknown>, columns: string[]): Record<string, unknown> { const out: Record<string, unknown> = {}; for (const col of columns) { if (col in row) out[col] = row[col]; } return out; }

function mapPost(runId: string, row: Record<string, unknown>): Record<string, unknown> {
  const type = clean(row.post_type) || "post";
  const title = clean(row.post_title);
  const slug = clean(row.post_name) || slugify(title || clean(row.ID) || "untitled");
  const status = clean(row.post_status);
  const isAttachment = type === "attachment";
  const entry = cptEntry(type);
  const allowed = isAllowedPostType(type);
  const target = targetEntityForPostType(type);
  const ready = isAttachment ? false : shouldReady(type, status, title);
  const needsReview = title || entry || isAttachment;
  const blocked = !allowed && !entry;
  const warnings: string[] = [];
  if (blocked) warnings.push(`Unknown post_type "${type}" quarantined as ignored_post_types.`);
  else if (entry && !ready) warnings.push(`WAKILISHA CPT ${type} mapped to ${target}; review metadata/relationships.`);
  else if (!ready && isAttachment) warnings.push("Attachment staged as media asset; file copy policy required.");
  else if (!ready && title) warnings.push(`Post type/status requires review: ${type}/${status}`);
  const wpPostAuthor = clean(row.post_author);
  return {
    ingestion_run_id: runId, source_kind: "wordpress_database", source_file: "mysql.wp_posts",
    source_entity: `mysql.${type}`, source_record_id: clean(row.ID) || null, source_slug: clean(row.post_name) || null,
    target_entity: target,
    target_status: blocked ? "blocked" : isAttachment ? (clean(row.guid) ? "needs_review" : "blocked") : ready ? "ready" : needsReview ? "needs_review" : "blocked",
    target_slug: slug || null, title: title || clean(row.guid).split("/").pop() || null,
    body: clean(row.post_content) || null, excerpt: clean(row.post_excerpt) || null,
    published_at: parseDate(clean(row.post_date_gmt) || clean(row.post_date)), author_name: null, source_url: clean(row.guid) || null,
    raw_record: row,
    mapped_record: { post_type: type, canonical_kind: canonicalKindForPostType(type), wakilisha_cpt: Boolean(entry), allowed_post_type: allowed, status, slug, mime_type: clean(row.post_mime_type) || null, post_author: wpPostAuthor || null },
    mapping_candidate_ids: [blocked ? "quarantined-post-type" : entry ? `wakilisha-cpt-${type}` : isAttachment ? "mysql-attachments" : "mysql-posts"],
    warnings, errors: title || isAttachment ? [] : ["Missing title"],
  };
}

function mapEditorialUser(runId: string, row: Record<string, unknown>): Record<string, unknown> {
  const name = clean(row.display_name) || clean(row.user_login);
  const slug = slugify(clean(row.user_nicename) || clean(row.user_login) || name || clean(row.ID));
  return {
    ingestion_run_id: runId, source_kind: "wordpress_database", source_file: "mysql.wp_users",
    source_entity: "mysql.users", source_record_id: clean(row.ID) || null, source_slug: slug,
    target_entity: "authors", target_status: name ? "ready" : "blocked", target_slug: slug,
    title: name || null, body: null, excerpt: null, published_at: null, author_name: name || null, source_url: clean(row.user_url) || null,
    raw_record: row, mapped_record: { email: clean(row.user_email) || null, url: clean(row.user_url) || null, editorial_author: true },
    mapping_candidate_ids: ["mysql-users-editorial"],
    warnings: clean(row.user_email) ? ["Author email staged in mapped_record only; review privacy."] : [],
    errors: name ? [] : ["Missing author name"],
  };
}

function mapTerm(runId: string, row: Record<string, unknown>): Record<string, unknown> {
  const name = clean(row.name);
  const taxonomy = clean(row.taxonomy) || "term";
  const slug = clean(row.slug) || slugify(name || clean(row.term_id));
  const isWakilishaTax = WAKILISHA_PLUGIN_TAXONOMIES.includes(taxonomy);
  return {
    ingestion_run_id: runId, source_kind: "wordpress_database", source_file: "mysql.wp_terms",
    source_entity: `mysql.${taxonomy}`, source_record_id: clean(row.term_id) || null, source_slug: slug,
    target_entity: isWakilishaTax ? "artist_taxonomy_terms" : "taxonomy_terms", target_status: name ? "ready" : "blocked", target_slug: slug,
    title: name || null, body: clean(row.description) || null, excerpt: null, published_at: null, author_name: null, source_url: null,
    raw_record: row, mapped_record: { taxonomy, slug, parent: row.parent ?? null, count: row.count ?? null, wakilisha_taxonomy: isWakilishaTax },
    mapping_candidate_ids: [isWakilishaTax ? `wakilisha-tax-${taxonomy}` : "mysql-terms"],
    warnings: [], errors: name ? [] : ["Missing term name"],
  };
}

function mapGeneric(runId: string, file: string, entity: string, target: string, row: Record<string, unknown>, ids: string[]): Record<string, unknown> {
  const id = clean(row.meta_id) || clean(row.object_id) || clean(row.term_taxonomy_id) || clean(row.ID) || clean(row.id);
  const t = clean(row.meta_key) || clean(row.relationship_type) || `${entity}-${id}`;
  return {
    ingestion_run_id: runId, source_kind: "wordpress_database", source_file: file,
    source_entity: entity, source_record_id: id || null, source_slug: null,
    target_entity: target, target_status: "needs_review", target_slug: id ? slugify(`${entity}-${id}`) : null,
    title: t, body: clean(row.meta_value) || null, excerpt: null, published_at: null, author_name: null, source_url: null,
    raw_record: row, mapped_record: row, mapping_candidate_ids: ids,
    warnings: ["Staged for review; requires resolver before finalization."], errors: [],
  };
}

function mapPluginRow(runId: string, row: Record<string, unknown>, cfg: typeof WAKILISHA_PLUGIN_TABLE_MAP[number]): Record<string, unknown> {
  const id = clean(row[cfg.id_column]);
  const title = cfg.title_column ? clean(row[cfg.title_column]) || null : null;
  const slug = cfg.slug_column ? clean(row[cfg.slug_column]) || (title ? slugify(title) : slugify(id || "untitled")) : title ? slugify(title) : slugify(id || "untitled");
  const status = cfg.status_column ? clean(row[cfg.status_column]) || "publish" : "publish";
  const isPublished = ["publish", "published", "active", "1", "true"].includes(status.toLowerCase());
  let targetStatus = "needs_review";
  if (cfg.ready_policy === "always_ready") targetStatus = "ready";
  else if (cfg.ready_policy === "published_only") targetStatus = isPublished ? "ready" : "needs_review";
  return {
    ingestion_run_id: runId, source_kind: "wordpress_database", source_file: `mysql.wp_${cfg.table}`,
    source_entity: `mysql.${cfg.table}`, source_record_id: id || null, source_slug: slug,
    target_entity: cfg.target_entity, target_status: id ? targetStatus : "blocked", target_slug: slug,
    title: title || (cfg.target_entity === "chart_entries" ? `Entry ${id}` : `${cfg.target_entity}-${id}`),
    body: cfg.body_column ? clean(row[cfg.body_column]) || null : null,
    excerpt: cfg.excerpt_column ? clean(row[cfg.excerpt_column]) || null : null,
    published_at: cfg.date_column ? parseDate(clean(row[cfg.date_column])) : null,
    author_name: cfg.author_column ? clean(row[cfg.author_column]) || null : null,
    source_url: cfg.url_column ? clean(row[cfg.url_column]) || null : null,
    raw_record: row, mapped_record: extraColumns(row, cfg.extra_columns),
    mapping_candidate_ids: [`wakilisha-plugin-${cfg.table}`],
    warnings: [], errors: id ? [] : [`Missing ${cfg.id_column} for ${cfg.table}`],
  };
}

function mapRelationshipRow(runId: string, row: Record<string, unknown>, rel: typeof WAKILISHA_PLUGIN_RELATIONSHIP_TABLES[number]): Record<string, unknown> {
  const id = clean(row[rel.id_column]);
  const sourceId = clean(row[rel.source_column]);
  const targetId = clean(row[rel.target_column]);
  const t = `${rel.source_entity}-${sourceId}-${targetId}`;
  return {
    ingestion_run_id: runId, source_kind: "wordpress_database", source_file: `mysql.wp_${rel.table}`,
    source_entity: rel.source_entity, source_record_id: id || null, source_slug: null,
    target_entity: rel.target_entity, target_status: id && sourceId && targetId ? "ready" : "needs_review", target_slug: slugify(t),
    title: t, body: null, excerpt: null, published_at: null, author_name: null, source_url: null,
    raw_record: row, mapped_record: extraColumns(row, rel.extra_columns),
    mapping_candidate_ids: [`wakilisha-plugin-${rel.table}`],
    warnings: [], errors: (!id || !sourceId || !targetId) ? [`Missing required column(s) in ${rel.table}`] : [],
  };
}

function jsonResponse(data: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}

async function testConnection(client: Client) { await client.execute("SELECT 1"); }

async function scanDatabase(client: Client, prefix: string) {
  const tables = ["posts", "postmeta", "users", "terms", "term_taxonomy", "term_relationships"];
  const pluginTables = ["wkcharts_tracks", "wkcharts_releases", "wkcharts_labels", "wkcharts_artists", "wkcharts_genres", "wkcharts_charts", "wkcharts_editions", "wkcharts_edition_items", "wkcharts_track_artists", "wkcharts_release_tracks", "wkcharts_release_labels", "wkcharts_artist_genres", "wkcharts_artist_relations", "wkcharts_entity_relationships", "wkcharts_chart_entry_links"];
  const counts: Record<string, number> = {};
  const postTypeCounts: Record<string, number> = {};
  const postTypeStatuses: Record<string, Record<string, number>> = {};
  for (const name of [...tables, ...pluginTables]) {
    try { const result = await client.execute(`SELECT COUNT(*) AS count FROM \`${prefix}${name}\``); counts[`${prefix}${name}`] = Number(result.rows?.[0]?.count ?? 0); } catch { counts[`${prefix}${name}`] = 0; }
  }
  try {
    const result = await client.execute(`SELECT post_type, post_status, COUNT(*) AS count FROM \`${prefix}posts\` GROUP BY post_type, post_status ORDER BY count DESC`);
    for (const row of result.rows as Array<{ post_type: string; post_status: string; count: number }>) { postTypeCounts[row.post_type] = (postTypeCounts[row.post_type] ?? 0) + Number(row.count ?? 0); postTypeStatuses[row.post_type] = postTypeStatuses[row.post_type] ?? {}; postTypeStatuses[row.post_type][row.post_status] = Number(row.count ?? 0); }
  } catch { /* non-fatal */ }
  return { counts, postTypeCounts, postTypeStatuses };
}

function makeFailure(runId: string, sourceFile: string, stage: string, err: unknown, extra: Record<string, unknown> = {}): Record<string, unknown> {
  return { ingestion_run_id: runId, source_file: sourceFile, failure_stage: stage, message: err instanceof Error ? err.message : String(err), raw_record: extra };
}

async function stageAll(client: Client, supabase: ReturnType<typeof createClient>, prefix: string, runId: string, maxPostmeta: number) {
  const records: Record<string, unknown>[] = [];
  const failures: Record<string, unknown>[] = [];
  const ignoredPostTypeCounts: Record<string, number> = {};

  try {
    const result = await client.execute(`SELECT ID, post_author, post_date, post_date_gmt, post_content, post_title, post_excerpt, post_status, post_name, post_type, post_mime_type, guid FROM \`${prefix}posts\` WHERE post_type NOT IN ('revision','nav_menu_item')`);
    for (const row of result.rows as Array<Record<string, unknown>>) {
      const type = clean(row.post_type);
      if (!isAllowedPostType(type) && !cptEntry(type)) ignoredPostTypeCounts[type] = (ignoredPostTypeCounts[type] ?? 0) + 1;
      records.push(mapPost(runId, row));
    }
  } catch (err) { failures.push(makeFailure(runId, "mysql.wp_posts", "fetch", err)); }

  try {
    const result = await client.execute(`SELECT DISTINCT u.ID, u.user_login, u.user_nicename, u.user_email, u.user_url, u.display_name FROM \`${prefix}users\` u JOIN \`${prefix}posts\` p ON p.post_author = u.ID WHERE p.post_status = 'publish' AND p.post_type IN ('post','page','wk_field_guide','wk_methodology','wk_chart_series','wk_chart_edition','wakilisha_artist')`);
    for (const row of result.rows as Array<Record<string, unknown>>) records.push(mapEditorialUser(runId, row));
  } catch (err) { failures.push(makeFailure(runId, "mysql.wp_users", "fetch", err)); }

  try {
    const result = await client.execute(`SELECT t.term_id, t.name, t.slug, tt.term_taxonomy_id, tt.taxonomy, tt.description, tt.parent, tt.count FROM \`${prefix}terms\` t JOIN \`${prefix}term_taxonomy\` tt ON t.term_id = tt.term_id`);
    for (const row of result.rows as Array<Record<string, unknown>>) records.push(mapTerm(runId, row));
  } catch (err) { failures.push(makeFailure(runId, "mysql.wp_terms", "fetch", err)); }

  try {
    const result = await client.execute(`SELECT object_id, term_taxonomy_id, term_order FROM \`${prefix}term_relationships\``);
    for (const row of result.rows as Array<Record<string, unknown>>) records.push(mapGeneric(runId, "mysql.wp_term_relationships", "mysql.relationships", "entity_relationships", row, ["mysql-relationships"]));
  } catch (err) { failures.push(makeFailure(runId, "mysql.wp_term_relationships", "fetch", err)); }

  try {
    const result = await client.execute(`SELECT meta_id, post_id, meta_key, meta_value FROM \`${prefix}postmeta\` LIMIT ${maxPostmeta}`);
    for (const row of result.rows as Array<Record<string, unknown>>) records.push(mapGeneric(runId, "mysql.wp_postmeta", "mysql.postmeta", "custom_fields", row, ["mysql-postmeta"]));
  } catch (err) { failures.push(makeFailure(runId, "mysql.wp_postmeta", "fetch", err)); }

  for (const pt of WAKILISHA_PLUGIN_TABLE_MAP) {
    try { const result = await client.execute(`SELECT * FROM \`${prefix}${pt.table}\``); for (const row of result.rows as Array<Record<string, unknown>>) records.push(mapPluginRow(runId, row, pt)); }
    catch (err) { failures.push(makeFailure(runId, `mysql.wp_${pt.table}`, "fetch", err)); }
  }

  for (const rel of WAKILISHA_PLUGIN_RELATIONSHIP_TABLES) {
    try { const result = await client.execute(`SELECT * FROM \`${prefix}${rel.table}\``); for (const row of result.rows as Array<Record<string, unknown>>) records.push(mapRelationshipRow(runId, row, rel)); }
    catch (err) { failures.push(makeFailure(runId, `mysql.wp_${rel.table}`, "fetch", err)); }
  }

  for (let i = 0; i < records.length; i += BATCH_SIZE) {
    const batch = records.slice(i, i + BATCH_SIZE);
    try { const { error } = await supabase.from("wk_import_staging_records").insert(batch); if (error) throw new Error(error.message); }
    catch (batchErr) { failures.push(makeFailure(runId, "batch_insert", "insert", batchErr, { batchIndex: i, batchSize: batch.length })); }
  }

  if (failures.length > 0) {
    for (let i = 0; i < failures.length; i += BATCH_SIZE) {
      const batch = failures.slice(i, i + BATCH_SIZE);
      try { await supabase.from("wk_import_staging_failures").insert(batch); } catch { /* non-fatal */ }
    }
  }

  const counts = records.reduce<Record<string, number>>((acc, r) => { acc[r.target_entity as string] = (acc[r.target_entity as string] ?? 0) + 1; return acc; }, {});
  const statusCounts = records.reduce<Record<string, number>>((acc, r) => { acc[r.target_status as string] = (acc[r.target_status as string] ?? 0) + 1; return acc; }, {});
  return { records: records.length, failures: failures.length, counts, statusCounts, ignoredPostTypeCounts };
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  if (!supabaseUrl || !supabaseKey) return jsonResponse({ success: false, error: "Supabase service role key missing. This function requires SERVICE_ROLE_KEY to write staging records." }, 500);
  const supabase = createClient(supabaseUrl, supabaseKey);

  try {
    const body = await req.json();
    const { action, credentials, runId } = body;

    if (action === "create-run") {
      if (!credentials || typeof credentials !== "object") return jsonResponse({ success: false, error: "credentials object is required" }, 400);
      const { host, port = 3306, user, password, database, prefix = "wp_" } = credentials;
      if (!host || !user || !password || !database) return jsonResponse({ success: false, error: "host, user, password, database are required" }, 400);
      const { data: run, error: runErr } = await supabase.from("wk_ingestion_runs").insert({
        source_name: `${host}/${database}`, source_kind: "wordpress_database_cli",
        source_manifest: { connection_type: "wordpress_database_cli", credentials_preview: { host, port: Number(port), user, database, prefix, password_persisted: false, password_stored: false }, created_at: new Date().toISOString(), status: "created_for_cli" },
        status: "created_for_cli", imported_counts: {}, warnings: ["Created via UI. Ready for CLI staging."], errors: [],
      }).select("id").single();
      if (runErr) return jsonResponse({ success: false, error: `Database insert failed: ${runErr.message}` }, 500);
      return jsonResponse({ success: true, runId: (run as { id: string }).id, message: "Run created. Run the CLI command on your WordPress server." });
    }

    if (!credentials || typeof credentials !== "object") return jsonResponse({ success: false, error: "credentials object is required" }, 400);
    const { host, port = 3306, user, password, database, prefix = "wp_" } = credentials;
    if (!host || !user || !password || !database) return jsonResponse({ success: false, error: "host, user, password, database are required" }, 400);

    let client: Client;
    try {
      client = new Client();
      await client.connect({ hostname: host, port: Number(port), username: user, password, db: database, connectTimeout: 15000 });
    } catch (connectErr) {
      return jsonResponse({ success: false, accessible: false, error: connectErr instanceof Error ? connectErr.message : "Could not connect to MySQL", hint: host === "localhost" || host === "127.0.0.1" ? "The database is on localhost — run the CLI script directly on the WordPress instance." : "Check host is reachable and MySQL port is not firewalled." });
    }

    if (action === "test") {
      try { await testConnection(client); const scan = await scanDatabase(client, prefix); await client.close(); return jsonResponse({ success: true, accessible: true, message: "Connected.", scan }); }
      catch (err) { try { await client.close(); } catch {} return jsonResponse({ success: false, accessible: false, error: err instanceof Error ? err.message : "Connection test failed" }); }
    }

    if (action === "stage") {
      const effectiveRunId = runId || crypto.randomUUID();
      if (!runId) { await supabase.from("wk_ingestion_runs").insert({ id: effectiveRunId, source_name: `${host}/${database}`, source_kind: "wordpress_database", status: "staging", started_at: new Date().toISOString(), errors: [], warnings: ["v6 — post_author extraction enabled; no anon key fallback."] }); }
      else { await supabase.from("wk_ingestion_runs").update({ status: "staging", started_at: new Date().toISOString(), errors: [] }).eq("id", runId); }
      await supabase.from("wk_import_staging_records").delete().eq("ingestion_run_id", effectiveRunId);
      await supabase.from("wk_import_staging_failures").delete().eq("ingestion_run_id", effectiveRunId);
      const maxPostmeta = Number(body.maxPostmeta ?? 20000);
      const result = await stageAll(client, supabase, prefix, effectiveRunId, maxPostmeta);
      await client.close();
      const summary = { staged_at: new Date().toISOString(), processor: "wp-db-stage", version: "6.0.0", records: result.records, failures: result.failures, counts_by_target_entity: result.counts, counts_by_status: result.statusCounts, postmeta_limit: maxPostmeta, plugin_tables: WAKILISHA_PLUGIN_TABLE_MAP.map(t => t.table), ignored_post_types: result.ignoredPostTypeCounts };
      await supabase.from("wk_ingestion_runs").update({ status: "staged", finished_at: new Date().toISOString(), imported_counts: result.counts, source_manifest: { staging: summary }, warnings: [`v6 staging: ${result.records} records. post_author preserved in mapped_record and raw_record. No anon key fallback.`], errors: result.failures > 0 ? [`${result.failures} failures.`] : [] }).eq("id", effectiveRunId);
      return jsonResponse({ success: true, runId: effectiveRunId, stats: { total: result.records, ready: result.statusCounts.ready ?? 0, needs_review: result.statusCounts.needs_review ?? 0, blocked: result.statusCounts.blocked ?? 0, failed: result.failures }, entityCounts: result.counts, ignoredPostTypes: result.ignoredPostTypeCounts });
    }

    await client.close();
    return jsonResponse({ success: false, error: `Unknown action: ${action}` }, 400);
  } catch (err) { return jsonResponse({ success: false, error: err instanceof Error ? err.message : "Internal error" }, 500); }
});