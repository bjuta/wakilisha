import pg from "pg";

type Pool = InstanceType<typeof pg.Pool>;
type Row = Record<string, unknown>;
type FieldGroup = "media" | "seo" | "editorial" | "registry" | "commerce" | "layout_junk" | "system" | "privacy_sensitive" | "unknown";
type PromotionPolicy = "safe_metadata" | "safe_media_candidate" | "ignore" | "review" | "blocked_sensitive";
type Classification = {
  fieldGroup: FieldGroup;
  promotionPolicy: PromotionPolicy;
  confidence: number;
  reason: string;
};
type CustomField = {
  stagingId: string;
  runId: string;
  sourceRecordId: string;
  postId: string;
  metaKey: string;
  metaValue: string;
  raw: Row;
};
type ObjectRecord = {
  objectId: string;
  targetEntity: string;
  slug: string;
  title: string;
};
type ResolvedObject = {
  tableName: string;
  id: string;
  slug: string;
  title: string;
  objectKind: string;
};
type Summary = {
  scanned: number;
  dictionaryKeys: number;
  media: number;
  seo: number;
  editorial: number;
  registry: number;
  layoutJunk: number;
  system: number;
  privacySensitive: number;
  unknown: number;
  appliedSafe: number;
};

const MEDIA_KEYS = [/thumbnail/i, /image/i, /img/i, /photo/i, /picture/i, /gallery/i, /cover/i, /artwork/i, /logo/i, /avatar/i, /featured_media/i];
const SEO_KEYS = [/yoast/i, /rank_math/i, /aioseo/i, /seo/i, /meta_title/i, /meta_description/i, /opengraph/i, /og_/i, /twitter_title/i, /twitter_description/i, /canonical/i];
const EDITORIAL_KEYS = [/subtitle/i, /sub_title/i, /dek/i, /kicker/i, /standfirst/i, /summary/i, /reading_time/i, /issue/i, /edition/i, /section/i, /featured/i, /sponsor/i, /source_credit/i, /byline/i];
const REGISTRY_KEYS = [/spotify/i, /apple_music/i, /youtube/i, /soundcloud/i, /audiomack/i, /boomplay/i, /deezer/i, /tidal/i, /isrc/i, /upc/i, /catalog/i, /catalogue/i, /label/i, /release_date/i, /artist/i, /genre/i, /country/i, /origin/i, /instagram/i, /twitter/i, /tiktok/i, /facebook/i, /website/i, /linktree/i];
const COMMERCE_KEYS = [/price/i, /sku/i, /stock/i, /product/i, /woocommerce/i, /^_wc_/i, /^_product_/i];
const LAYOUT_JUNK_KEYS = [/elementor/i, /wpbakery/i, /visual_composer/i, /vc_/i, /fusion/i, /beaver/i, /oxygen/i, /builder/i, /layout/i, /template/i, /css/i, /style/i, /shortcode/i, /blocks/i, /gutenberg/i];
const SYSTEM_KEYS = [/^_edit_/, /^_wp_old_/, /^_wp_trash_/, /^_wp_attached_file$/, /^_wp_attachment_/, /^_encloseme$/, /^_pingme$/, /^_menu_item_/, /^_wp_page_template$/];
const PRIVACY_KEYS = [/email/i, /phone/i, /mobile/i, /whatsapp/i, /address/i, /password/i, /token/i, /secret/i, /api_key/i, /private/i];

function normalizeDatabaseUrl(databaseUrl: string): string {
  try {
    const url = new URL(databaseUrl);
    url.searchParams.delete("sslmode");
    url.searchParams.delete("uselibpqcompat");
    return url.toString();
  } catch {
    return databaseUrl;
  }
}

function createPool(): Pool {
  const explicitHost = process.env.PGHOST;
  const explicitUser = process.env.PGUSER;
  const explicitPassword = process.env.PGPASSWORD;
  const explicitDatabase = process.env.PGDATABASE;
  const explicitPort = Number(process.env.PGPORT || 5432);
  if (explicitHost && explicitUser && explicitPassword && explicitDatabase) {
    return new pg.Pool({ host: explicitHost, port: explicitPort, user: explicitUser, password: explicitPassword, database: explicitDatabase, ssl: { rejectUnauthorized: false }, max: 4, connectionTimeoutMillis: 15000, query_timeout: 120000, statement_timeout: 120000 });
  }
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error("DATABASE_URL or explicit PG* env vars are required.");
  return new pg.Pool({ connectionString: normalizeDatabaseUrl(databaseUrl), ssl: { rejectUnauthorized: false }, max: 4, connectionTimeoutMillis: 15000, query_timeout: 120000, statement_timeout: 120000 });
}

function arg(name: string): string | undefined {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

function hasFlag(name: string): boolean {
  return process.argv.includes(name);
}

function text(value: unknown): string {
  return value === null || value === undefined ? "" : String(value).trim();
}

function parsePayload(value: unknown): Row {
  if (!value) return {};
  if (typeof value === "object" && !Array.isArray(value)) return value as Row;
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value) as unknown;
      return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed as Row : {};
    } catch {
      return {};
    }
  }
  return {};
}

function isLikelyUrl(value: string): boolean {
  return /^https?:\/\//i.test(value);
}

function isLikelyAttachmentId(value: string): boolean {
  return /^\d+$/.test(value) && Number(value) > 0;
}

function valuePreview(value: string): string {
  if (!value) return "";
  if (value.length <= 240) return value;
  return `${value.slice(0, 240)}…`;
}

function safeJson(value: unknown): string {
  return JSON.stringify(value ?? null);
}

function matchesAny(key: string, patterns: RegExp[]): boolean {
  return patterns.some((pattern) => pattern.test(key));
}

function classifyField(metaKey: string, metaValue: string): Classification {
  const key = metaKey.trim();
  const lower = key.toLowerCase();
  const value = metaValue.trim();

  if (!key) return { fieldGroup: "unknown", promotionPolicy: "review", confidence: 0, reason: "missing meta_key" };
  if (matchesAny(key, PRIVACY_KEYS)) return { fieldGroup: "privacy_sensitive", promotionPolicy: "blocked_sensitive", confidence: 95, reason: "key appears to contain private/contact/credential data" };
  if (matchesAny(key, SYSTEM_KEYS)) return { fieldGroup: "system", promotionPolicy: "ignore", confidence: 95, reason: "WordPress internal/system key" };
  if (matchesAny(key, LAYOUT_JUNK_KEYS)) return { fieldGroup: "layout_junk", promotionPolicy: "ignore", confidence: 90, reason: "builder/layout/rendering field, not canonical content" };
  if (matchesAny(key, SEO_KEYS)) return { fieldGroup: "seo", promotionPolicy: value ? "safe_metadata" : "review", confidence: 85, reason: "SEO/social metadata key" };
  if (matchesAny(key, MEDIA_KEYS)) return { fieldGroup: "media", promotionPolicy: isLikelyUrl(value) || isLikelyAttachmentId(value) ? "safe_media_candidate" : "review", confidence: 82, reason: "image/media candidate key" };
  if (matchesAny(key, REGISTRY_KEYS)) return { fieldGroup: "registry", promotionPolicy: value ? "safe_metadata" : "review", confidence: 80, reason: "registry/music platform/entity metadata key" };
  if (matchesAny(key, EDITORIAL_KEYS)) return { fieldGroup: "editorial", promotionPolicy: value ? "safe_metadata" : "review", confidence: 78, reason: "editorial metadata key" };
  if (matchesAny(key, COMMERCE_KEYS)) return { fieldGroup: "commerce", promotionPolicy: "review", confidence: 70, reason: "commerce/product key requires business decision before promotion" };
  if (lower.startsWith("_") && value.length > 1000) return { fieldGroup: "layout_junk", promotionPolicy: "ignore", confidence: 60, reason: "large private underscored field likely layout/plugin payload" };
  return { fieldGroup: "unknown", promotionPolicy: "review", confidence: 30, reason: "unknown key; needs field dictionary decision" };
}

async function hasTable(pool: Pool, tableName: string): Promise<boolean> {
  const result = await pool.query("select to_regclass($1) as table_name", [tableName]);
  return Boolean(result.rows[0]?.table_name);
}

async function ensureTables(pool: Pool): Promise<void> {
  await pool.query(`
    create table if not exists wp_postmeta_field_dictionary (
      id uuid primary key default gen_random_uuid(),
      meta_key text not null unique,
      field_group text not null,
      promotion_policy text not null,
      confidence numeric not null default 0,
      occurrence_count integer not null default 0,
      object_count integer not null default 0,
      sample_values jsonb not null default '[]'::jsonb,
      first_seen_run_id uuid,
      last_seen_run_id uuid,
      reason text,
      approved_policy text,
      approved_by text,
      approved_at timestamptz,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now()
    )
  `);

  await pool.query(`
    create table if not exists wp_postmeta_field_instances (
      id uuid primary key default gen_random_uuid(),
      meta_key text not null,
      field_group text not null,
      promotion_policy text not null,
      confidence numeric not null default 0,
      source_ingestion_run_id uuid not null,
      source_staging_record_id uuid not null unique,
      source_record_id text,
      object_id text,
      object_target_entity text,
      resolved_table text,
      resolved_id uuid,
      resolved_slug text,
      resolved_title text,
      meta_value_preview text,
      meta_value_raw text,
      promotion_status text not null default 'classified',
      reason text,
      metadata jsonb not null default '{}'::jsonb,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now()
    )
  `);

  await pool.query(`create index if not exists wp_postmeta_field_instances_key_idx on wp_postmeta_field_instances(meta_key, field_group, promotion_policy)`);
  await pool.query(`create index if not exists wp_postmeta_field_instances_object_idx on wp_postmeta_field_instances(object_id, object_target_entity)`);

  await pool.query(`
    create table if not exists entity_resolution_decisions (
      id uuid primary key default gen_random_uuid(),
      entity_type text not null,
      source_table text,
      source_kind text,
      source_record_id text,
      source_staging_record_id uuid,
      source_slug text,
      source_title text,
      target_table text,
      target_id text,
      target_slug text,
      target_title text,
      confidence_score numeric,
      decision text not null default 'needs_review',
      status text not null default 'open',
      review_required boolean not null default true,
      reason text,
      candidate_payload jsonb not null default '{}'::jsonb,
      source_payload jsonb not null default '{}'::jsonb,
      resolved_at timestamptz,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now()
    )
  `);
  await pool.query(`create unique index if not exists entity_resolution_postmeta_source_uidx on entity_resolution_decisions(entity_type, source_staging_record_id) where entity_type = 'custom_field' and source_staging_record_id is not null`);
}

async function getRunIds(pool: Pool): Promise<string[]> {
  const jobId = arg("--job");
  if (jobId) return [jobId];
  const limit = Number(arg("--limit") || 5);
  const result = await pool.query(
    "select distinct ingestion_run_id::text as id from wk_import_staging_records where target_entity = 'custom_fields' order by ingestion_run_id::text desc limit $1",
    [limit],
  );
  return result.rows.map((row) => String(row.id));
}

async function loadCustomFields(pool: Pool, runId: string): Promise<CustomField[]> {
  const result = await pool.query(`
    select id::text, ingestion_run_id::text, source_record_id, raw_record, mapped_record
    from wk_import_staging_records
    where ingestion_run_id = $1
      and target_entity = 'custom_fields'
      and source_file = 'mysql.wp_postmeta'
  `, [runId]);

  return result.rows.map((row) => {
    const raw = parsePayload(row.raw_record);
    const mapped = parsePayload(row.mapped_record);
    return {
      stagingId: String(row.id),
      runId: String(row.ingestion_run_id),
      sourceRecordId: firstText(row.source_record_id, raw.meta_id, mapped.meta_id),
      postId: firstText(raw.post_id, mapped.post_id),
      metaKey: firstText(raw.meta_key, mapped.meta_key),
      metaValue: firstText(raw.meta_value, mapped.meta_value),
      raw,
    };
  }).filter((field) => field.postId && field.metaKey);
}

function firstText(...values: unknown[]): string {
  for (const value of values) {
    const next = text(value);
    if (next && !["null", "undefined", "false", "[object object]"].includes(next.toLowerCase())) return next;
  }
  return "";
}

async function loadObjects(pool: Pool, runId: string): Promise<Map<string, ObjectRecord>> {
  const result = await pool.query(`
    select source_record_id, target_entity, target_slug, title
    from wk_import_staging_records
    where ingestion_run_id = $1
      and source_record_id is not null
      and target_entity not in ('entity_relationships', 'custom_fields', 'taxonomy_terms', 'artist_taxonomy_terms')
  `, [runId]);
  const objects = new Map<string, ObjectRecord>();
  for (const row of result.rows) {
    const objectId = firstText(row.source_record_id);
    if (!objectId || objects.has(objectId)) continue;
    objects.set(objectId, {
      objectId,
      targetEntity: firstText(row.target_entity),
      slug: firstText(row.target_slug),
      title: firstText(row.title),
    });
  }
  return objects;
}

async function resolveObject(pool: Pool, object: ObjectRecord | undefined): Promise<ResolvedObject | null> {
  if (!object) return null;
  if (["articles", "pages"].includes(object.targetEntity) && await hasTable(pool, "wk_content_items")) {
    const result = await pool.query("select id::text, slug, title from wk_content_items where source_record_id = $1 order by updated_at desc nulls last limit 1", [object.objectId]);
    const row = result.rows[0];
    if (row) return { tableName: "wk_content_items", id: String(row.id), slug: firstText(row.slug), title: firstText(row.title), objectKind: object.targetEntity };
  }

  const registryTable = object.targetEntity === "artists" ? "registry_artists" : object.targetEntity === "tracks" ? "registry_tracks" : object.targetEntity === "releases" ? "registry_releases" : object.targetEntity === "labels" ? "registry_labels" : object.targetEntity === "genres" ? "registry_genres" : "";
  if (registryTable && await hasTable(pool, registryTable)) {
    const titleColumn = registryTable === "registry_artists" ? "display_name" : registryTable === "registry_labels" || registryTable === "registry_genres" ? "name" : "title";
    const result = await pool.query(`select id::text, slug, ${titleColumn} as title from ${registryTable} where metadata::text like $1 order by updated_at desc nulls last limit 1`, [`%${object.objectId}%`]);
    const row = result.rows[0];
    if (row) return { tableName: registryTable, id: String(row.id), slug: firstText(row.slug), title: firstText(row.title), objectKind: object.targetEntity };
  }

  if (await hasTable(pool, "wk_wakilisha_entities")) {
    const result = await pool.query("select id::text, slug, title, entity_type from wk_wakilisha_entities where source_record_id = $1 order by updated_at desc nulls last limit 1", [object.objectId]);
    const row = result.rows[0];
    if (row) return { tableName: "wk_wakilisha_entities", id: String(row.id), slug: firstText(row.slug), title: firstText(row.title), objectKind: firstText(row.entity_type, object.targetEntity) };
  }

  return null;
}

async function insertInstance(pool: Pool, field: CustomField, object: ObjectRecord | undefined, resolved: ResolvedObject | null, classification: Classification): Promise<void> {
  await pool.query(`
    insert into wp_postmeta_field_instances (
      meta_key, field_group, promotion_policy, confidence, source_ingestion_run_id, source_staging_record_id, source_record_id,
      object_id, object_target_entity, resolved_table, resolved_id, resolved_slug, resolved_title,
      meta_value_preview, meta_value_raw, promotion_status, reason, metadata, updated_at
    ) values (
      $1, $2, $3, $4, $5::uuid, $6::uuid, $7,
      $8, $9, $10, $11::uuid, $12, $13,
      $14, $15, 'classified', $16, $17::jsonb, now()
    )
    on conflict (source_staging_record_id) do update set
      meta_key = excluded.meta_key,
      field_group = excluded.field_group,
      promotion_policy = excluded.promotion_policy,
      confidence = excluded.confidence,
      object_id = excluded.object_id,
      object_target_entity = excluded.object_target_entity,
      resolved_table = excluded.resolved_table,
      resolved_id = excluded.resolved_id,
      resolved_slug = excluded.resolved_slug,
      resolved_title = excluded.resolved_title,
      meta_value_preview = excluded.meta_value_preview,
      meta_value_raw = excluded.meta_value_raw,
      reason = excluded.reason,
      metadata = excluded.metadata,
      updated_at = now()
  `, [
    field.metaKey,
    classification.fieldGroup,
    classification.promotionPolicy,
    classification.confidence,
    field.runId,
    field.stagingId,
    field.sourceRecordId,
    field.postId,
    object?.targetEntity ?? null,
    resolved?.tableName ?? null,
    resolved?.id ?? null,
    resolved?.slug ?? null,
    resolved?.title ?? null,
    valuePreview(field.metaValue),
    field.metaValue,
    classification.reason,
    safeJson({ raw: field.raw, object, resolved }),
  ]);
}

async function queueReview(pool: Pool, field: CustomField, object: ObjectRecord | undefined, resolved: ResolvedObject | null, classification: Classification): Promise<void> {
  if (!["review", "blocked_sensitive"].includes(classification.promotionPolicy)) return;
  await pool.query(`
    insert into entity_resolution_decisions (
      entity_type, source_table, source_kind, source_record_id, source_staging_record_id, source_title,
      target_table, target_id, target_slug, target_title, confidence_score, decision, status, review_required,
      reason, candidate_payload, source_payload, updated_at
    ) values (
      'custom_field', 'wk_import_staging_records', 'wordpress_database', $1, $2::uuid, $3,
      $4, $5, $6, $7, $8, $9, 'open', true,
      $10, $11::jsonb, $12::jsonb, now()
    )
    on conflict (entity_type, source_staging_record_id) where entity_type = 'custom_field' and source_staging_record_id is not null
    do update set
      target_table = excluded.target_table,
      target_id = excluded.target_id,
      target_slug = excluded.target_slug,
      target_title = excluded.target_title,
      confidence_score = excluded.confidence_score,
      decision = excluded.decision,
      reason = excluded.reason,
      candidate_payload = excluded.candidate_payload,
      source_payload = excluded.source_payload,
      updated_at = now()
  `, [
    field.sourceRecordId,
    field.stagingId,
    field.metaKey,
    resolved?.tableName ?? null,
    resolved?.id ?? null,
    resolved?.slug ?? null,
    resolved?.title ?? null,
    classification.confidence,
    classification.promotionPolicy === "blocked_sensitive" ? "blocked_sensitive_custom_field" : "custom_field_review",
    classification.reason,
    safeJson({ object, resolved, classification }),
    safeJson({ post_id: field.postId, meta_key: field.metaKey, meta_value_preview: valuePreview(field.metaValue), raw: field.raw }),
  ]);
}

async function rebuildDictionary(pool: Pool, runId: string): Promise<number> {
  const result = await pool.query(`
    insert into wp_postmeta_field_dictionary (
      meta_key, field_group, promotion_policy, confidence, occurrence_count, object_count, sample_values, first_seen_run_id, last_seen_run_id, reason, updated_at
    )
    select
      meta_key,
      mode() within group (order by field_group) as field_group,
      mode() within group (order by promotion_policy) as promotion_policy,
      max(confidence) as confidence,
      count(*)::int as occurrence_count,
      count(distinct object_id)::int as object_count,
      coalesce(jsonb_agg(distinct meta_value_preview) filter (where nullif(meta_value_preview, '') is not null), '[]'::jsonb) as sample_values,
      min(source_ingestion_run_id) as first_seen_run_id,
      max(source_ingestion_run_id) as last_seen_run_id,
      mode() within group (order by reason) as reason,
      now()
    from wp_postmeta_field_instances
    where source_ingestion_run_id = $1
    group by meta_key
    on conflict (meta_key) do update set
      field_group = excluded.field_group,
      promotion_policy = coalesce(wp_postmeta_field_dictionary.approved_policy, excluded.promotion_policy),
      confidence = excluded.confidence,
      occurrence_count = excluded.occurrence_count,
      object_count = excluded.object_count,
      sample_values = excluded.sample_values,
      last_seen_run_id = excluded.last_seen_run_id,
      reason = excluded.reason,
      updated_at = now()
  `, [runId]);
  return result.rowCount ?? 0;
}

async function applySafeMetadata(pool: Pool, field: CustomField, resolved: ResolvedObject | null, classification: Classification): Promise<boolean> {
  if (!hasFlag("--apply-safe")) return false;
  if (classification.promotionPolicy !== "safe_metadata") return false;
  if (!resolved) return false;
  if (!["wk_content_items", "registry_artists", "registry_tracks", "registry_releases", "registry_labels", "registry_genres", "wk_wakilisha_entities"].includes(resolved.tableName)) return false;

  const key = classification.fieldGroup === "seo" ? "wordpress_seo_fields" : classification.fieldGroup === "registry" ? "wordpress_registry_fields" : "wordpress_editorial_fields";
  const payload = safeJson({ [key]: { [field.metaKey]: field.metaValue } });
  const sql = resolved.tableName === "wk_content_items"
    ? "update wk_content_items set raw_record = coalesce(raw_record, '{}'::jsonb) || $2::jsonb, updated_at = now() where id = $1::uuid"
    : `update ${resolved.tableName} set metadata = coalesce(metadata, '{}'::jsonb) || $2::jsonb, updated_at = now() where id = $1::uuid`;
  await pool.query(sql, [resolved.id, payload]);
  await pool.query("update wp_postmeta_field_instances set promotion_status = 'applied_safe_metadata', updated_at = now() where source_staging_record_id = $1::uuid", [field.stagingId]);
  return true;
}

async function classifyRun(pool: Pool, runId: string): Promise<Summary> {
  const [fields, objects] = await Promise.all([loadCustomFields(pool, runId), loadObjects(pool, runId)]);
  const summary: Summary = { scanned: fields.length, dictionaryKeys: 0, media: 0, seo: 0, editorial: 0, registry: 0, layoutJunk: 0, system: 0, privacySensitive: 0, unknown: 0, appliedSafe: 0 };

  for (const field of fields) {
    const classification = classifyField(field.metaKey, field.metaValue);
    const object = objects.get(field.postId);
    const resolved = await resolveObject(pool, object);

    if (hasFlag("--dry-run")) {
      console.log(`[postmeta-classify] dry-run post=${field.postId} key=${field.metaKey} group=${classification.fieldGroup} policy=${classification.promotionPolicy} target=${resolved?.tableName ?? object?.targetEntity ?? '?'}`);
      continue;
    }

    await insertInstance(pool, field, object, resolved, classification);
    await queueReview(pool, field, object, resolved, classification);
    if (await applySafeMetadata(pool, field, resolved, classification)) summary.appliedSafe++;

    if (classification.fieldGroup === "media") summary.media++;
    else if (classification.fieldGroup === "seo") summary.seo++;
    else if (classification.fieldGroup === "editorial") summary.editorial++;
    else if (classification.fieldGroup === "registry") summary.registry++;
    else if (classification.fieldGroup === "layout_junk") summary.layoutJunk++;
    else if (classification.fieldGroup === "system") summary.system++;
    else if (classification.fieldGroup === "privacy_sensitive") summary.privacySensitive++;
    else summary.unknown++;
  }

  if (!hasFlag("--dry-run")) {
    summary.dictionaryKeys = await rebuildDictionary(pool, runId);
    await pool.query(`
      update wk_ingestion_runs
      set source_manifest = jsonb_set(coalesce(source_manifest, '{}'::jsonb), '{postmeta_classification}', $2::jsonb, true),
          warnings = array_remove(array_append(coalesce(warnings, '{}'::text[]), $3), null)
      where id = $1
    `, [runId, safeJson({ classified_at: new Date().toISOString(), processor: "classify-wordpress-postmeta", version: "0.1.0", apply_safe: hasFlag("--apply-safe"), summary }), `Phase 5 postmeta classification completed: ${summary.scanned} fields classified, ${summary.unknown + summary.privacySensitive} queued/blocked for review.`]);
  }

  return summary;
}

async function main(): Promise<void> {
  const pool = createPool();
  try {
    await ensureTables(pool);
    const runIds = await getRunIds(pool);
    if (!runIds.length) {
      console.log("[postmeta-classify] no custom field staging records found");
      return;
    }
    for (const runId of runIds) {
      const summary = await classifyRun(pool, runId);
      console.log(`[postmeta-classify] ${runId}: scanned=${summary.scanned} dictionaryKeys=${summary.dictionaryKeys} media=${summary.media} seo=${summary.seo} editorial=${summary.editorial} registry=${summary.registry} layoutJunk=${summary.layoutJunk} system=${summary.system} privacySensitive=${summary.privacySensitive} unknown=${summary.unknown} appliedSafe=${summary.appliedSafe}`);
    }
  } finally {
    await pool.end();
  }
}

main().catch((error) => {
  console.error("[postmeta-classify] failed:", error instanceof Error ? error.message : error);
  process.exit(1);
});
