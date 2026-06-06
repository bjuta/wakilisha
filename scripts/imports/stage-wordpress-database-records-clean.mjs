#!/usr/bin/env node
// stage.mjs — standalone bundled WordPress→Supabase staging script
// Run on your WordPress Lightsail SSH server:
//   DATABASE_URL="postgresql://..." \
//   WP_DB_HOST=127.0.0.1 WP_DB_PORT=3306 WP_DB_USER=bn_wordpress \
//   WP_DB_PASSWORD=... WP_DB_NAME=bitnami_wordpress WP_DB_PREFIX=wp_ \
//   node /home/bitnami/wk-import/stage.mjs --job <RUN_ID>
// ---------------------------------------------------------------------------

import mysql from "mysql2/promise";
import pg from "pg";

// ══════════════════════════════════════════════════════════════════════════
// CONFIG — WAKILISHA CPT / Plugin Table Map (inlined from wakilisha-cpt-map.ts)
// ══════════════════════════════════════════════════════════════════════════

const ALLOWED_WP_POST_TYPES = new Set([
  "post","page","attachment","wakilisha_artist","wk_genre_page",
  "wk_field_guide","wk_chart_series","wk_chart_edition","wk_methodology",
]);

const WAKILISHA_CPT_MAP = {
  post:               { post_type:"post",               target_entity:"articles",          canonical_kind:"article",          ready_policy:"published_only" },
  page:               { post_type:"page",               target_entity:"pages",             canonical_kind:"page",             ready_policy:"published_only" },
  wakilisha_artist:   { post_type:"wakilisha_artist",   target_entity:"artists",           canonical_kind:"artist",           ready_policy:"published_only" },
  wk_genre_page:      { post_type:"wk_genre_page",      target_entity:"genres",            canonical_kind:"genre",            ready_policy:"published_only" },
  wk_field_guide:     { post_type:"wk_field_guide",     target_entity:"guides",            canonical_kind:"guide",            ready_policy:"published_only" },
  wk_chart_series:    { post_type:"wk_chart_series",    target_entity:"chart_series",      canonical_kind:"chart_series",     ready_policy:"published_only" },
  wk_chart_edition:   { post_type:"wk_chart_edition",   target_entity:"chart_editions",    canonical_kind:"chart_edition",    ready_policy:"published_only" },
  wk_top10_surface:   { post_type:"wk_top10_surface",   target_entity:"chart_surfaces",    canonical_kind:"chart_surface",    ready_policy:"needs_review" },
  wk_magazine_surface:{ post_type:"wk_magazine_surface",target_entity:"magazine_surfaces", canonical_kind:"magazine_surface", ready_policy:"needs_review" },
  wk_methodology:     { post_type:"wk_methodology",     target_entity:"methodologies",     canonical_kind:"methodology",      ready_policy:"published_only" },
  wk_correction_page: { post_type:"wk_correction_page", target_entity:"corrections",       canonical_kind:"correction",       ready_policy:"needs_review" },
  wk_play_surface:    { post_type:"wk_play_surface",    target_entity:"play_surfaces",     canonical_kind:"play_surface",     ready_policy:"needs_review" },
  wk_labels_surface:  { post_type:"wk_labels_surface",  target_entity:"label_surfaces",    canonical_kind:"label_surface",    ready_policy:"needs_review" },
  wk_settings_surface:{ post_type:"wk_settings_surface",target_entity:"settings_surfaces", canonical_kind:"settings_surface", ready_policy:"needs_review" },
  wk_profile_surface: { post_type:"wk_profile_surface", target_entity:"profile_surfaces",  canonical_kind:"profile_surface",  ready_policy:"needs_review" },
};

const WAKILISHA_PLUGIN_TABLE_MAP = [
  { table:"wkcharts_tracks",       target_entity:"tracks",          canonical_kind:"track",         id_column:"id", title_column:"title",    slug_column:"slug",    status_column:"status",    body_column:null,         excerpt_column:null, date_column:"created_at",   author_column:null, url_column:null,       extra_columns:["artist_id","release_id","duration","genre_id","spotify_id","apple_music_id","youtube_id","isrc","explicit","track_number"], ready_policy:"published_only" },
  { table:"wkcharts_releases",     target_entity:"releases",        canonical_kind:"release",       id_column:"id", title_column:"title",    slug_column:"slug",    status_column:"status",    body_column:"description", excerpt_column:null, date_column:"release_date", author_column:null, url_column:null,       extra_columns:["label_id","artist_id","type","cover_url","upc","catalog_number","track_count"],     ready_policy:"published_only" },
  { table:"wkcharts_labels",       target_entity:"labels",          canonical_kind:"label",         id_column:"id", title_column:"name",     slug_column:"slug",    status_column:"status",    body_column:"description", excerpt_column:null, date_column:"created_at",   author_column:null, url_column:"website",   extra_columns:["logo_url","country","founded_year","parent_label_id"],                           ready_policy:"published_only" },
  { table:"wkcharts_artists",      target_entity:"artists",         canonical_kind:"artist",        id_column:"id", title_column:"name",     slug_column:"slug",    status_column:"status",    body_column:"bio",         excerpt_column:null, date_column:"created_at",   author_column:null, url_column:"website",   extra_columns:["image_url","origin","artist_type","spotify_id","apple_music_id","instagram_handle","twitter_handle"], ready_policy:"published_only" },
  { table:"wkcharts_genres",       target_entity:"genres",          canonical_kind:"genre",         id_column:"id", title_column:"name",     slug_column:"slug",    status_column:null,       body_column:"description", excerpt_column:null, date_column:"created_at",   author_column:null, url_column:null,       extra_columns:["parent_id","color","icon"],                                                     ready_policy:"always_ready" },
  { table:"wkcharts_charts",       target_entity:"chart_series",    canonical_kind:"chart_series",   id_column:"id", title_column:"name",     slug_column:"slug",    status_column:"status",    body_column:"description", excerpt_column:null, date_column:"created_at",   author_column:null, url_column:null,       extra_columns:["chart_type","frequency","market_scope_id","methodology_id"],                    ready_policy:"published_only" },
  { table:"wkcharts_editions",     target_entity:"chart_editions",  canonical_kind:"chart_edition",  id_column:"id", title_column:"title",    slug_column:"slug",    status_column:"status",    body_column:null,         excerpt_column:null, date_column:"edition_date", author_column:null, url_column:null,       extra_columns:["chart_id","week_number","year","entry_count"],                                 ready_policy:"published_only" },
  { table:"wkcharts_edition_items",target_entity:"chart_entries",   canonical_kind:"chart_entry",    id_column:"id", title_column:null,       slug_column:null,      status_column:null,       body_column:null,         excerpt_column:null, date_column:"created_at",   author_column:null, url_column:null,       extra_columns:["edition_id","track_id","rank","previous_rank","weeks_on_chart","peak_position","is_new_entry","is_re_entry"], ready_policy:"always_ready" },
];

const WAKILISHA_PLUGIN_RELATIONSHIP_TABLES = [
  { table:"wkcharts_track_artists",       source_entity:"mysql.wkcharts_track_artists",       target_entity:"track_artists",        id_column:"id", source_column:"track_id",  target_column:"artist_id",         extra_columns:["role","is_primary","sort_order"] },
  { table:"wkcharts_release_tracks",      source_entity:"mysql.wkcharts_release_tracks",      target_entity:"release_tracks",       id_column:"id", source_column:"release_id",target_column:"track_id",          extra_columns:["track_number","disc_number"] },
  { table:"wkcharts_release_labels",      source_entity:"mysql.wkcharts_release_labels",      target_entity:"release_labels",       id_column:"id", source_column:"release_id",target_column:"label_id",          extra_columns:["label_role"] },
  { table:"wkcharts_artist_genres",       source_entity:"mysql.wkcharts_artist_genres",       target_entity:"artist_genres",        id_column:"id", source_column:"artist_id", target_column:"genre_id",          extra_columns:[] },
  { table:"wkcharts_artist_relations",    source_entity:"mysql.wkcharts_artist_relations",    target_entity:"artist_relationships", id_column:"id", source_column:"artist_id", target_column:"related_artist_id", extra_columns:["relationship_type"] },
  { table:"wkcharts_entity_relationships",source_entity:"mysql.wkcharts_entity_relationships",target_entity:"entity_relationships",id_column:"id", source_column:"source_id",  target_column:"target_id",         extra_columns:["source_type","target_type","relationship_type","metadata"] },
  { table:"wkcharts_chart_entry_links",   source_entity:"mysql.wkcharts_chart_entry_links",   target_entity:"chart_entry_links",    id_column:"id", source_column:"entry_id",   target_column:"entity_id",         extra_columns:["entity_type"] },
];

const WAKILISHA_PLUGIN_TAXONOMIES = ["wk_artist_genre","wk_artist_origin"];

function wakilishaCptEntry(postType) { return WAKILISHA_CPT_MAP[postType] ?? null; }
function isAllowedPostType(postType)    { return ALLOWED_WP_POST_TYPES.has(postType); }

function targetEntityForWordPressPostType(postType) {
  if (postType === "attachment") return "media_assets";
  const entry = wakilishaCptEntry(postType);
  if (entry) return entry.target_entity;
  if (isAllowedPostType(postType)) return postType === "post" ? "articles" : postType === "page" ? "pages" : postType;
  return "ignored_post_types";
}

function canonicalKindForWordPressPostType(postType) {
  return wakilishaCptEntry(postType)?.canonical_kind ?? postType;
}

function shouldReadyPostType(postType, status, title) {
  const entry = wakilishaCptEntry(postType);
  if (!title || !["publish","published"].includes(status.toLowerCase())) return false;
  if (!entry) return postType === "post" || postType === "page";
  return entry.ready_policy === "published_only";
}

// ══════════════════════════════════════════════════════════════════════════
// HELPERS
// ══════════════════════════════════════════════════════════════════════════

const BATCH_SIZE = Number(process.env.WAKILISHA_IMPORT_STAGE_BATCH_SIZE ?? 500);

function arg(name) {
  const i = process.argv.indexOf(name);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

function required(value, label) {
  if (!value) throw new Error(`${label} is required.`);
  return value;
}

function table(prefix, name) { return `\`${prefix}${name}\``; }
function clean(value)       { return String(value ?? "").trim(); }

function safeJson(value) {
  return JSON.stringify(value, (key, val) => {
    if (typeof val === 'string') {
      return val.replace(/\u0000/g, '').replace(/[\uD800-\uDFFF]/g, '\uFFFD');
    }
    return val;
  });
}

function slugify(value) {
  return value.toLowerCase().normalize("NFKD")
    .replace(/[\u0300-\u036f]/g,"")
    .replace(/[^a-z0-9]+/g,"-")
    .replace(/^-+|-+$/g,"")
    .slice(0,160);
}

function parseDate(value) {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

function normalizeDatabaseUrl(url) {
  try { const u = new URL(url); u.searchParams.delete("sslmode"); u.searchParams.delete("uselibpqcompat"); return u.toString(); }
  catch { return url; }
}

function pgPool() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is required.");
  return new pg.Pool({ connectionString: normalizeDatabaseUrl(url), ssl:{ rejectUnauthorized:false }, max:4 });
}

function wpConfig() {
  return {
    host:required(arg("--host")??process.env.WP_DB_HOST,"WP_DB_HOST or --host"),
    port:Number(arg("--port")??process.env.WP_DB_PORT??3306),
    user:required(arg("--user")??process.env.WP_DB_USER,"WP_DB_USER or --user"),
    password:required(arg("--password")??process.env.WP_DB_PASSWORD,"WP_DB_PASSWORD or --password"),
    database:required(arg("--database")??process.env.WP_DB_NAME,"WP_DB_NAME or --database"),
    prefix:arg("--prefix")??process.env.WP_DB_PREFIX??"wp_",
  };
}

// ══════════════════════════════════════════════════════════════════════════
// SUPABASE
// ══════════════════════════════════════════════════════════════════════════

async function clearPrior(pool, id) {
  await pool.query("delete from wk_import_staging_records where ingestion_run_id=$1",[id]);
  await pool.query("delete from wk_import_staging_failures where ingestion_run_id=$1",[id]);
}

async function insertBatch(pool, rows) {
  for (let i=0;i<rows.length;i+=BATCH_SIZE) {
    const batch = rows.slice(i,i+BATCH_SIZE);
    const vals = [];
    const params = batch.map((r,idx) => {
      const b = idx*20;
      vals.push(r.ingestion_run_id,r.source_kind,r.source_file,r.source_entity,r.source_record_id,r.source_slug,r.target_entity,r.target_status,r.target_slug,r.title,r.body,r.excerpt,r.published_at,r.author_name,r.source_url,safeJson(r.raw_record),safeJson(r.mapped_record),r.mapping_candidate_ids,r.warnings,r.errors);
      return `($${b+1},$${b+2},$${b+3},$${b+4},$${b+5},$${b+6},$${b+7},$${b+8},$${b+9},$${b+10},$${b+11},$${b+12},$${b+13},$${b+14},$${b+15},$${b+16}::jsonb,$${b+17}::jsonb,$${b+18},$${b+19},$${b+20})`;
    }).join(",");
    if (params) await pool.query(`insert into wk_import_staging_records (ingestion_run_id,source_kind,source_file,source_entity,source_record_id,source_slug,target_entity,target_status,target_slug,title,body,excerpt,published_at,author_name,source_url,raw_record,mapped_record,mapping_candidate_ids,warnings,errors) values ${params}`,vals);
    console.log(`[stage] Batch ${Math.floor(i/BATCH_SIZE)+1}/${Math.ceil(rows.length/BATCH_SIZE)}`);
  }
}

// ══════════════════════════════════════════════════════════════════════════
// MAPPERS
// ══════════════════════════════════════════════════════════════════════════

function mapPost(runId, row) {
  const type = clean(row.post_type)||"post";
  const title = clean(row.post_title);
  const slug = clean(row.post_name) || slugify(title || clean(row.ID) || "untitled");
  const status = clean(row.post_status);
  const isAttachment = type==="attachment";
  const entry = wakilishaCptEntry(type);
  const allowed = isAllowedPostType(type);
  const target = targetEntityForWordPressPostType(type);
  const ready = isAttachment?false:shouldReadyPostType(type,status,title);
  const needsReview = title||entry||isAttachment;
  const blocked = !allowed&&!entry;

  const warnings = [];
  if (blocked) warnings.push(`Unknown post_type "${type}" quarantined as ignored_post_types. Not mapping to content_entities.`);
  else if (entry&&!ready) warnings.push(`WAKILISHA CPT ${type} mapped to ${target}; review before finalization.`);
  else if (!ready&&isAttachment) warnings.push("Attachment staged; file copy policy required.");
  else if (!ready&&title) warnings.push(`Post type/status requires review: ${type}/${status}`);

  return {
    ingestion_run_id:runId, source_kind:"wordpress_database", source_file:"mysql.wp_posts",
    source_entity:`mysql.${type}`, source_record_id:clean(row.ID)||null, source_slug:clean(row.post_name)||null,
    target_entity:target,
    target_status:blocked?"blocked":isAttachment?(clean(row.guid)?"needs_review":"blocked"):ready?"ready":needsReview?"needs_review":"blocked",
    target_slug:slug||null,
    title:title||clean(row.guid).split("/").pop()||null,
    body:clean(row.post_content)||null, excerpt:clean(row.post_excerpt)||null,
    published_at:parseDate(clean(row.post_date_gmt)||clean(row.post_date)),
    author_name:null, source_url:clean(row.guid)||null, raw_record:row,
    mapped_record:{ post_type:type, canonical_kind:canonicalKindForWordPressPostType(type), wakilisha_cpt:Boolean(entry), allowed_post_type:allowed, status, slug, mime_type:clean(row.post_mime_type)||null },
    mapping_candidate_ids:[blocked?"quarantined-post-type":entry?`wakilisha-cpt-${type}`:isAttachment?"mysql-attachments":"mysql-posts"],
    warnings, errors:title||isAttachment?[]:["Missing title"],
  };
}

function mapPluginTableRow(runId, row, config) {
  const id = clean(row[config.id_column]);
  const title = config.title_column?clean(row[config.title_column])||null:null;
  const slug = config.slug_column?clean(row[config.slug_column])||(title?slugify(title):slugify(id||"untitled")):title?slugify(title):slugify(id||"untitled");
  const status = config.status_column?clean(row[config.status_column])||"publish":"publish";
  const isPublished = ["publish","published","active","1","true"].includes(status.toLowerCase());
  let ts; switch(config.ready_policy){ case"always_ready":ts="ready";break; case"published_only":ts=isPublished?"ready":"needs_review";break; default:ts="needs_review"; }

  return {
    ingestion_run_id:runId, source_kind:"wordpress_database", source_file:`mysql.wp_${config.table}`,
    source_entity:`mysql.${config.table}`, source_record_id:id||null, source_slug:slug,
    target_entity:config.target_entity, target_status:id?ts:"blocked", target_slug:slug,
    title:title||(config.target_entity==="chart_entries"?`Entry ${id}`:`${config.target_entity}-${id}`),
    body:config.body_column?clean(row[config.body_column])||null:null,
    excerpt:config.excerpt_column?clean(row[config.excerpt_column])||null:null,
    published_at:config.date_column?parseDate(clean(row[config.date_column])):null,
    author_name:config.author_column?clean(row[config.author_column])||null:null,
    source_url:config.url_column?clean(row[config.url_column])||null:null,
    raw_record:row,
    mapped_record:extraColumns(row,config.extra_columns),
    mapping_candidate_ids:[`wakilisha-plugin-${config.table}`],
    warnings:[], errors:id?[]:[`Missing ${config.id_column} for ${config.table}`],
  };
}

function mapRelationshipRow(runId, row, rel) {
  const id = clean(row[rel.id_column]);
  const src = clean(row[rel.source_column]);
  const tgt = clean(row[rel.target_column]);
  const title = `${rel.source_entity}-${src}-${tgt}`;
  return {
    ingestion_run_id:runId, source_kind:"wordpress_database", source_file:`mysql.wp_${rel.table}`,
    source_entity:rel.source_entity, source_record_id:id||null, source_slug:null,
    target_entity:rel.target_entity, target_status:id&&src&&tgt?"ready":"needs_review", target_slug:slugify(title),
    title, body:null, excerpt:null, published_at:null, author_name:null, source_url:null,
    raw_record:row, mapped_record:extraColumns(row,rel.extra_columns),
    mapping_candidate_ids:[`wakilisha-plugin-${rel.table}`],
    warnings:[], errors:!id||!src||!tgt?[`Missing required column(s) in ${rel.table}`]:[],
  };
}

function mapEditorialUser(runId, row) {
  const name = clean(row.display_name)||clean(row.user_login);
  const slug = slugify(clean(row.user_nicename)||clean(row.user_login)||name||clean(row.ID));
  return {
    ingestion_run_id:runId, source_kind:"wordpress_database", source_file:"mysql.wp_users",
    source_entity:"mysql.users", source_record_id:clean(row.ID)||null, source_slug:slug,
    target_entity:"authors", target_status:name?"ready":"blocked", target_slug:slug,
    title:name||null, body:null, excerpt:null, published_at:null, author_name:name||null,
    source_url:clean(row.user_url)||null, raw_record:row,
    mapped_record:{ email:clean(row.user_email)||null, url:clean(row.user_url)||null, editorial_author:true },
    mapping_candidate_ids:["mysql-users-editorial"],
    warnings:clean(row.user_email)?["Author email staged in mapped_record only; review privacy before public use."]:[],
    errors:name?[]:["Missing author name"],
  };
}

function mapTerm(runId, row) {
  const name = clean(row.name);
  const taxonomy = clean(row.taxonomy)||"term";
  const slug = clean(row.slug)||slugify(name||clean(row.term_id));
  const isWak = WAKILISHA_PLUGIN_TAXONOMIES.includes(taxonomy);
  return {
    ingestion_run_id:runId, source_kind:"wordpress_database", source_file:"mysql.wp_terms",
    source_entity:`mysql.${taxonomy}`, source_record_id:clean(row.term_id)||null, source_slug:slug,
    target_entity:isWak?"artist_taxonomy_terms":"taxonomy_terms", target_status:name?"ready":"blocked", target_slug:slug,
    title:name||null, body:clean(row.description)||null, excerpt:null, published_at:null, author_name:null, source_url:null,
    raw_record:row,
    mapped_record:{ taxonomy, slug, parent:row.parent??null, count:row.count??null, wakilisha_taxonomy:isWak },
    mapping_candidate_ids:[isWak?`wakilisha-tax-${taxonomy}`:"mysql-terms"],
    warnings:[], errors:name?[]:["Missing term name"],
  };
}

function mapGeneric(runId, file, entity, target, row, ids) {
  const id = clean(row.meta_id)||clean(row.object_id)||clean(row.term_taxonomy_id)||clean(row.ID)||clean(row.id);
  const title = clean(row.meta_key)||clean(row.relationship_type)||`${entity}-${id}`;
  return {
    ingestion_run_id:runId, source_kind:"wordpress_database", source_file:file,
    source_entity:entity, source_record_id:id||null, source_slug:null,
    target_entity:target, target_status:"needs_review", target_slug:id?slugify(`${entity}-${id}`):null,
    title, body:clean(row.meta_value)||null, excerpt:null, published_at:null, author_name:null, source_url:null,
    raw_record:row, mapped_record:row, mapping_candidate_ids:ids,
    warnings:["Staged for review; requires resolver before finalization."], errors:[],
  };
}

function extraColumns(row, cols) { const o={}; for(const c of cols){ if(c in row) o[c]=row[c]; } return o; }

// ══════════════════════════════════════════════════════════════════════════
// MAIN
// ══════════════════════════════════════════════════════════════════════════

async function stage(pool, wp, cfg, runId) {
  console.log(`[stage] Connected to MySQL ${cfg.host}:${cfg.port}/${cfg.database}`);
  await pool.query("update wk_ingestion_runs set status='staging' where id=$1",[runId]);
  await clearPrior(pool, runId);

  const records = [];
  const ignoredPostTypeCounts = {};

  // 1. wp_posts
  {
    const [postRows] = await wp.query(`select ID,post_author,post_date,post_date_gmt,post_content,post_title,post_excerpt,post_status,post_name,post_type,post_mime_type,guid from ${table(cfg.prefix,"posts")} where post_type not in ('revision','nav_menu_item')`);
    for (const r of postRows) {
      const type = clean(r.post_type);
      if (!isAllowedPostType(type)&&!wakilishaCptEntry(type)) ignoredPostTypeCounts[type]=(ignoredPostTypeCounts[type]??0)+1;
      records.push(mapPost(runId,r));
    }
    console.log(`[stage] wp_posts: ${postRows.length} rows`);
  }

  // 2. Editorial authors (JOIN on wp_posts, NOT all wp_users)
  {
    const [userRows] = await wp.query(`SELECT DISTINCT u.ID,u.user_login,u.user_nicename,u.user_email,u.user_url,u.display_name FROM \`${cfg.prefix}users\` u JOIN \`${cfg.prefix}posts\` p ON p.post_author=u.ID WHERE p.post_status='publish' AND p.post_type IN ('post','page','wk_field_guide','wk_methodology','wk_chart_series','wk_chart_edition','wakilisha_artist')`);
    const authors = userRows.map(r=>mapEditorialUser(runId,r));
    records.push(...authors);
    console.log(`[stage] Authors (editorial only): ${authors.length}`);
  }

  // 3. Terms
  {
    const [termRows] = await wp.query(`select t.term_id,t.name,t.slug,tt.term_taxonomy_id,tt.taxonomy,tt.description,tt.parent,tt.count from ${table(cfg.prefix,"terms")} t join ${table(cfg.prefix,"term_taxonomy")} tt on t.term_id=tt.term_id`);
    const terms = termRows.map(r=>mapTerm(runId,r));
    records.push(...terms);
    console.log(`[stage] Terms: ${terms.length}`);
  }

  // 4. Term relationships
  {
    const [relRows] = await wp.query(`select object_id,term_taxonomy_id,term_order from ${table(cfg.prefix,"term_relationships")}`);
    const mapped = relRows.map(r=>mapGeneric(runId,"mysql.wp_term_relationships","mysql.relationships","entity_relationships",r,["mysql-relationships"]));
    records.push(...mapped);
    console.log(`[stage] Term relationships: ${mapped.length}`);
  }

  // 5. Postmeta (sampled)
  {
    const limit = Number(process.env.WAKILISHA_DB_POSTMETA_LIMIT??20000);
    const [metaRows] = await wp.query(`select meta_id,post_id,meta_key,meta_value from ${table(cfg.prefix,"postmeta")} limit ${limit}`);
    const mapped = metaRows.map(r=>mapGeneric(runId,"mysql.wp_postmeta","mysql.postmeta","custom_fields",r,["mysql-postmeta"]));
    records.push(...mapped);
    console.log(`[stage] Postmeta: ${mapped.length} (limit ${limit})`);
  }

  // 6. WAKILISHA plugin tables (wp_wkcharts_*)
  for (const pt of WAKILISHA_PLUGIN_TABLE_MAP) {
    try {
      const [rows] = await wp.query(`select * from ${table(cfg.prefix,pt.table)}`);
      const mapped = rows.map(r=>mapPluginTableRow(runId,r,pt));
      records.push(...mapped);
      console.log(`[stage] Plugin table ${pt.table} → ${pt.target_entity}: ${mapped.length} records`);
    } catch(err) {
      console.warn(`[stage] Plugin table ${pt.table} SKIPPED: ${err?.message||err}`);
    }
  }

  // 7. WAKILISHA plugin relationship tables
  for (const rel of WAKILISHA_PLUGIN_RELATIONSHIP_TABLES) {
    try {
      const [rows] = await wp.query(`select * from ${table(cfg.prefix,rel.table)}`);
      const mapped = rows.map(r=>mapRelationshipRow(runId,r,rel));
      records.push(...mapped);
      console.log(`[stage] Relationship table ${rel.table} → ${rel.target_entity}: ${mapped.length} records`);
    } catch(err) {
      console.warn(`[stage] Relationship table ${rel.table} SKIPPED: ${err?.message||err}`);
    }
  }

  // 8. Insert
  console.log(`[stage] Inserting ${records.length} total records in batches of ${BATCH_SIZE}...`);
  await insertBatch(pool, records);

  // Summary
  const counts = {}, statusCounts = {}, readyCounts = {};
  for (const r of records) {
    counts[r.target_entity]=(counts[r.target_entity]??0)+1;
    statusCounts[r.target_status]=(statusCounts[r.target_status]??0)+1;
    if (r.target_status==="ready") readyCounts[r.target_entity]=(readyCounts[r.target_entity]??0)+1;
  }

  const summary = {
    staged_at:new Date().toISOString(), processor:"stage-wordpress-database-records.mjs", version:"1.0.0",
    records:records.length, counts_by_target_entity:readyCounts, counts_by_status:statusCounts,
    postmeta_limit:Number(process.env.WAKILISHA_DB_POSTMETA_LIMIT??20000),
    wakilisha_plugin_tables_staged:WAKILISHA_PLUGIN_TABLE_MAP.map(t=>t.table),
    relationship_tables_staged:WAKILISHA_PLUGIN_RELATIONSHIP_TABLES.map(t=>t.table),
    ignored_post_type_counts:ignoredPostTypeCounts,
  };

  const stagingWarnings = ['Plugin tables (wp_wkcharts_*) staged alongside wp_posts. Unknown post types quarantined as ignored_post_types.'];
  await pool.query("update wk_ingestion_runs set status='staged', source_manifest=jsonb_set(coalesce(source_manifest,'{}'::jsonb),'{staging}',$2::jsonb,true), imported_counts=$3::jsonb, warnings = coalesce(warnings,'[]'::jsonb) || $4::jsonb where id=$1",[runId,safeJson(summary),safeJson(readyCounts),safeJson(stagingWarnings)]);

  console.log(`\n[stage] DONE! ${runId}: ${records.length} total records`);
  console.log(`[stage] Ready counts by entity:`,JSON.stringify(readyCounts,null,2));
  if (Object.keys(ignoredPostTypeCounts).length>0) {
    console.log(`[stage] Quarantined post types:`,JSON.stringify(ignoredPostTypeCounts,null,2));
  }
}

// ══════════════════════════════════════════════════════════════════════════
// ENTRY
// ══════════════════════════════════════════════════════════════════════════

async function main() {
  const runId = required(arg("--job"),"--job");
  const cfg = wpConfig();
  const wp = await mysql.createConnection({ host:cfg.host,port:cfg.port,user:cfg.user,password:cfg.password,database:cfg.database,connectTimeout:15000 });
  const pool = pgPool();
  try {
    await wp.ping();
    await stage(pool,wp,cfg,runId);
  } finally {
    await wp.end();
    await pool.end();
    console.log("[stage] Connections closed.");
  }
}

main().catch(e=>{ console.error("[stage] FATAL:",e?.message||e); process.exit(1); });