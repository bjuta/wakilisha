import pg from "pg";

type Pool = InstanceType<typeof pg.Pool>;
type Row = Record<string, unknown>;
type MediaRecord = {
  stagingId: string;
  runId: string;
  sourceRecordId: string;
  slug: string;
  title: string;
  sourceUrl: string;
  mimeType: string;
  postParent: string;
  raw: Row;
  mapped: Row;
};
type MetaThumb = {
  postId: string;
  attachmentId: string;
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
  entityType: string;
};
type Summary = {
  scanned: number;
  operationalAssets: number;
  attachedToContent: number;
  attachedToArtists: number;
  attachedToReleases: number;
  attachedToLabels: number;
  attachedToRegistry: number;
  unresolved: number;
  skippedNoUrl: number;
  updatedPublicFields: number;
};

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

function firstText(...values: unknown[]): string {
  for (const value of values) {
    const next = text(value);
    if (next && !["null", "undefined", "false", "[object object]"].includes(next.toLowerCase())) return next;
  }
  return "";
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

function isImage(media: MediaRecord): boolean {
  const mime = media.mimeType.toLowerCase();
  const url = media.sourceUrl.toLowerCase();
  return mime.startsWith("image/") || /\.(jpg|jpeg|png|webp|gif|avif)(\?|$)/i.test(url);
}

function roleFor(entityType: string, media: MediaRecord): string {
  const title = `${media.title} ${media.slug} ${media.sourceUrl}`.toLowerCase();
  if (entityType === "artists") return "artist_photo";
  if (entityType === "releases" || entityType === "tracks") return "artwork";
  if (entityType === "labels") return title.includes("logo") ? "label_logo" : "logo";
  if (["articles", "pages"].includes(entityType)) return "hero";
  if (title.includes("logo")) return "logo";
  if (title.includes("cover") || title.includes("artwork")) return "artwork";
  return "image";
}

async function hasTable(pool: Pool, tableName: string): Promise<boolean> {
  const result = await pool.query("select to_regclass($1) as table_name", [tableName]);
  return Boolean(result.rows[0]?.table_name);
}

async function hasColumn(pool: Pool, tableName: string, columnName: string): Promise<boolean> {
  const result = await pool.query("select 1 from information_schema.columns where table_schema = current_schema() and table_name = $1 and column_name = $2", [tableName, columnName]);
  return Boolean(result.rowCount);
}

async function ensureTables(pool: Pool): Promise<void> {
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
  await pool.query(`create unique index if not exists entity_resolution_media_source_uidx on entity_resolution_decisions(entity_type, source_staging_record_id) where entity_type = 'media_asset' and source_staging_record_id is not null`);

  if (await hasTable(pool, "wk_media_assets")) {
    const alters = [
      "alter table wk_media_assets add column if not exists entity_type text",
      "alter table wk_media_assets add column if not exists entity_slug text",
      "alter table wk_media_assets add column if not exists role text",
      "alter table wk_media_assets add column if not exists url text",
      "alter table wk_media_assets add column if not exists alt_text text",
      "alter table wk_media_assets add column if not exists source text",
      "alter table wk_media_assets add column if not exists status text",
      "alter table wk_media_assets add column if not exists source_ingestion_run_id uuid",
      "alter table wk_media_assets add column if not exists source_staging_record_id uuid",
      "alter table wk_media_assets add column if not exists source_record_id text",
      "alter table wk_media_assets add column if not exists metadata jsonb",
      "alter table wk_media_assets add column if not exists created_at timestamptz",
      "alter table wk_media_assets add column if not exists updated_at timestamptz"
    ];
    for (const alter of alters) await pool.query(alter);
    await pool.query(`create unique index if not exists wk_media_assets_source_staging_uidx on wk_media_assets(source_staging_record_id) where source_staging_record_id is not null`);
    await pool.query(`create index if not exists wk_media_assets_entity_role_idx on wk_media_assets(entity_type, entity_slug, role, status)`);
  }
}

async function getRunIds(pool: Pool): Promise<string[]> {
  const jobId = arg("--job");
  if (jobId) return [jobId];
  const limit = Number(arg("--limit") || 5);
  const result = await pool.query("select distinct ingestion_run_id::text as id from wk_import_staging_records where target_entity = 'media_assets' order by ingestion_run_id::text desc limit $1", [limit]);
  return result.rows.map((row) => String(row.id));
}

async function loadMedia(pool: Pool, runId: string): Promise<MediaRecord[]> {
  const result = await pool.query(`
    select id::text, ingestion_run_id::text, source_record_id, target_slug, title, source_url, raw_record, mapped_record
    from wk_import_staging_records
    where ingestion_run_id = $1
      and target_entity = 'media_assets'
      and target_status in ('ready', 'needs_review')
  `, [runId]);

  return result.rows.map((row) => {
    const raw = parsePayload(row.raw_record);
    const mapped = parsePayload(row.mapped_record);
    return {
      stagingId: String(row.id),
      runId: String(row.ingestion_run_id),
      sourceRecordId: firstText(row.source_record_id, raw.ID, raw.id),
      slug: firstText(row.target_slug, raw.post_name, mapped.slug),
      title: firstText(row.title, raw.post_title, mapped.title),
      sourceUrl: firstText(row.source_url, raw.guid, mapped.source_url, mapped.url),
      mimeType: firstText(mapped.mime_type, raw.post_mime_type, raw.mime_type),
      postParent: firstText(raw.post_parent, mapped.post_parent, raw.parent),
      raw,
      mapped,
    };
  });
}

async function loadThumbnailMeta(pool: Pool, runId: string): Promise<Map<string, string>> {
  const result = await pool.query(`
    select raw_record, mapped_record
    from wk_import_staging_records
    where ingestion_run_id = $1
      and target_entity = 'custom_fields'
      and source_file = 'mysql.wp_postmeta'
  `, [runId]);
  const map = new Map<string, string>();
  for (const row of result.rows) {
    const raw = parsePayload(row.raw_record);
    const mapped = parsePayload(row.mapped_record);
    const key = firstText(raw.meta_key, mapped.meta_key);
    if (key !== "_thumbnail_id") continue;
    const postId = firstText(raw.post_id, mapped.post_id);
    const attachmentId = firstText(raw.meta_value, mapped.meta_value);
    if (postId && attachmentId) map.set(attachmentId, postId);
  }
  return map;
}

async function loadObjects(pool: Pool, runId: string): Promise<Map<string, ObjectRecord>> {
  const result = await pool.query(`
    select source_record_id, target_entity, target_slug, title
    from wk_import_staging_records
    where ingestion_run_id = $1
      and source_record_id is not null
      and target_entity not in ('entity_relationships', 'custom_fields', 'taxonomy_terms', 'artist_taxonomy_terms', 'media_assets')
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
    if (row) return { tableName: "wk_content_items", id: String(row.id), slug: firstText(row.slug), title: firstText(row.title), entityType: object.targetEntity };
  }

  const registryTable = object.targetEntity === "artists" ? "registry_artists" : object.targetEntity === "tracks" ? "registry_tracks" : object.targetEntity === "releases" ? "registry_releases" : object.targetEntity === "labels" ? "registry_labels" : object.targetEntity === "genres" ? "registry_genres" : "";
  if (registryTable && await hasTable(pool, registryTable)) {
    const titleColumn = registryTable === "registry_artists" ? "display_name" : registryTable === "registry_labels" || registryTable === "registry_genres" ? "name" : "title";
    const result = await pool.query(`select id::text, slug, ${titleColumn} as title from ${registryTable} where metadata::text like $1 order by updated_at desc nulls last limit 1`, [`%${object.objectId}%`]);
    const row = result.rows[0];
    if (row) return { tableName: registryTable, id: String(row.id), slug: firstText(row.slug), title: firstText(row.title), entityType: object.targetEntity };
  }

  if (await hasTable(pool, "wk_wakilisha_entities")) {
    const result = await pool.query("select id::text, slug, title, entity_type from wk_wakilisha_entities where source_record_id = $1 order by updated_at desc nulls last limit 1", [object.objectId]);
    const row = result.rows[0];
    if (row) return { tableName: "wk_wakilisha_entities", id: String(row.id), slug: firstText(row.slug), title: firstText(row.title), entityType: firstText(row.entity_type, object.targetEntity) };
  }

  return null;
}

function candidateObjectId(media: MediaRecord, thumbnails: Map<string, string>): string {
  return firstText(thumbnails.get(media.sourceRecordId), media.postParent);
}

async function insertOperationalAsset(pool: Pool, media: MediaRecord, resolved: ResolvedObject, role: string): Promise<void> {
  await pool.query(`
    insert into wk_media_assets (
      entity_type, entity_slug, role, url, alt_text, source, status,
      source_ingestion_run_id, source_staging_record_id, source_record_id, metadata, updated_at
    ) values (
      $1, $2, $3, $4, $5, 'wordpress', 'active',
      $6::uuid, $7::uuid, $8, $9::jsonb, now()
    )
    on conflict (source_staging_record_id) where source_staging_record_id is not null
    do update set
      entity_type = excluded.entity_type,
      entity_slug = excluded.entity_slug,
      role = excluded.role,
      url = excluded.url,
      alt_text = excluded.alt_text,
      source = excluded.source,
      status = excluded.status,
      metadata = excluded.metadata,
      updated_at = now()
  `, [
    resolved.entityType,
    resolved.slug,
    role,
    media.sourceUrl,
    media.title || resolved.title,
    media.runId,
    media.stagingId,
    media.sourceRecordId,
    JSON.stringify({ source: "operationalize-wordpress-media", resolved, raw_record: media.raw, mapped_record: media.mapped }),
  ]);
}

async function updatePublicField(pool: Pool, resolved: ResolvedObject, role: string, url: string): Promise<boolean> {
  if (!hasFlag("--apply-public-fields")) return false;
  if (!url || !resolved.id) return false;

  if (resolved.tableName === "registry_artists" && await hasColumn(pool, "registry_artists", "public_image_url")) {
    await pool.query("update registry_artists set public_image_url = coalesce(nullif(public_image_url, ''), $2), image_source_provider = coalesce(nullif(image_source_provider, ''), 'wordpress'), updated_at = now() where id = $1::uuid", [resolved.id, url]);
    return true;
  }
  if (["registry_tracks", "registry_releases"].includes(resolved.tableName) && await hasColumn(pool, resolved.tableName, "artwork_url")) {
    await pool.query(`update ${resolved.tableName} set artwork_url = coalesce(nullif(artwork_url, ''), $2), updated_at = now() where id = $1::uuid`, [resolved.id, url]);
    return true;
  }
  if (resolved.tableName === "registry_labels" && await hasColumn(pool, "registry_labels", "metadata")) {
    await pool.query("update registry_labels set metadata = coalesce(metadata, '{}'::jsonb) || $2::jsonb, updated_at = now() where id = $1::uuid", [resolved.id, JSON.stringify({ wordpress_media: { logo_url: url, role } })]);
    return true;
  }
  if (resolved.tableName === "wk_content_items" && await hasColumn(pool, "wk_content_items", "raw_record")) {
    await pool.query("update wk_content_items set raw_record = coalesce(raw_record, '{}'::jsonb) || $2::jsonb, updated_at = now() where id = $1::uuid", [resolved.id, JSON.stringify({ wordpress_media: { hero_image_url: url, role } })]);
    return true;
  }
  return false;
}

async function queueMediaReview(pool: Pool, media: MediaRecord, object: ObjectRecord | undefined, resolved: ResolvedObject | null, reason: string): Promise<void> {
  await pool.query(`
    insert into entity_resolution_decisions (
      entity_type, source_table, source_kind, source_record_id, source_staging_record_id, source_slug, source_title,
      target_table, target_id, target_slug, target_title, confidence_score, decision, status, review_required,
      reason, candidate_payload, source_payload, updated_at
    ) values (
      'media_asset', 'wk_import_staging_records', 'wordpress_database', $1, $2::uuid, $3, $4,
      $5, $6, $7, $8, 0, 'media_asset_review', 'open', true,
      $9, $10::jsonb, $11::jsonb, now()
    )
    on conflict (entity_type, source_staging_record_id) where entity_type = 'media_asset' and source_staging_record_id is not null
    do update set
      target_table = excluded.target_table,
      target_id = excluded.target_id,
      target_slug = excluded.target_slug,
      target_title = excluded.target_title,
      reason = excluded.reason,
      candidate_payload = excluded.candidate_payload,
      source_payload = excluded.source_payload,
      updated_at = now()
  `, [
    media.sourceRecordId,
    media.stagingId,
    media.slug,
    media.title,
    resolved?.tableName ?? null,
    resolved?.id ?? null,
    resolved?.slug ?? null,
    resolved?.title ?? null,
    reason,
    JSON.stringify({ object, resolved }),
    JSON.stringify(media),
  ]);
}

async function promotionEvent(pool: Pool, media: MediaRecord, targetRecordId: string, message: string): Promise<void> {
  await pool.query(`
    insert into wk_import_promotion_events (ingestion_run_id, staging_record_id, target_table, target_record_id, event_type, message)
    values ($1::uuid, $2::uuid, 'wk_media_assets', $3, 'promoted', $4)
  `, [media.runId, media.stagingId, targetRecordId, message]);
}

async function runMedia(pool: Pool, runId: string): Promise<Summary> {
  const [mediaRows, thumbnails, objects] = await Promise.all([loadMedia(pool, runId), loadThumbnailMeta(pool, runId), loadObjects(pool, runId)]);
  const summary: Summary = { scanned: mediaRows.length, operationalAssets: 0, attachedToContent: 0, attachedToArtists: 0, attachedToReleases: 0, attachedToLabels: 0, attachedToRegistry: 0, unresolved: 0, skippedNoUrl: 0, updatedPublicFields: 0 };

  for (const media of mediaRows) {
    if (!media.sourceUrl) {
      summary.skippedNoUrl++;
      if (!hasFlag("--dry-run")) await queueMediaReview(pool, media, undefined, null, "Media record has no source URL/guid.");
      continue;
    }
    if (!isImage(media)) {
      if (hasFlag("--images-only")) continue;
    }

    const objectId = candidateObjectId(media, thumbnails);
    const object = objects.get(objectId);
    const resolved = await resolveObject(pool, object);
    const role = roleFor(object?.targetEntity ?? resolved?.entityType ?? "media", media);

    if (hasFlag("--dry-run")) {
      console.log(`[media-operationalize] dry-run attachment=${media.sourceRecordId} url=${media.sourceUrl} object=${objectId || '?'} target=${resolved?.tableName ?? object?.targetEntity ?? '?'} role=${role}`);
      continue;
    }

    if (!resolved) {
      await queueMediaReview(pool, media, object, resolved, objectId ? "Could not resolve media parent/thumbnail object to live content or registry record." : "Media record is unattached and has no _thumbnail_id/post_parent candidate.");
      summary.unresolved++;
      continue;
    }

    await insertOperationalAsset(pool, media, resolved, role);
    summary.operationalAssets++;
    if (resolved.tableName === "wk_content_items") summary.attachedToContent++;
    else if (resolved.tableName === "registry_artists") summary.attachedToArtists++;
    else if (resolved.tableName === "registry_releases") summary.attachedToReleases++;
    else if (resolved.tableName === "registry_labels") summary.attachedToLabels++;
    else summary.attachedToRegistry++;

    if (await updatePublicField(pool, resolved, role, media.sourceUrl)) summary.updatedPublicFields++;
    await promotionEvent(pool, media, `${resolved.tableName}:${resolved.id}:${role}`, `Phase 6 operationalized media for ${resolved.title} as ${role}.`);
  }

  if (!hasFlag("--dry-run")) {
    await pool.query(`
      update wk_ingestion_runs
      set source_manifest = jsonb_set(coalesce(source_manifest, '{}'::jsonb), '{media_operationalization}', $2::jsonb, true),
          warnings = array_remove(array_append(coalesce(warnings, '{}'::text[]), $3), null)
      where id = $1
    `, [runId, JSON.stringify({ operationalized_at: new Date().toISOString(), processor: "operationalize-wordpress-media", version: "0.1.0", apply_public_fields: hasFlag("--apply-public-fields"), summary }), `Phase 6 media operationalization completed: ${summary.operationalAssets} assets operationalized, ${summary.unresolved} queued for review.`]);
  }

  return summary;
}

async function main(): Promise<void> {
  const pool = createPool();
  try {
    await ensureTables(pool);
    const runIds = await getRunIds(pool);
    if (!runIds.length) {
      console.log("[media-operationalize] no media staging records found");
      return;
    }
    for (const runId of runIds) {
      const summary = await runMedia(pool, runId);
      console.log(`[media-operationalize] ${runId}: scanned=${summary.scanned} operationalAssets=${summary.operationalAssets} content=${summary.attachedToContent} artists=${summary.attachedToArtists} releases=${summary.attachedToReleases} labels=${summary.attachedToLabels} registry=${summary.attachedToRegistry} unresolved=${summary.unresolved} skippedNoUrl=${summary.skippedNoUrl} publicFields=${summary.updatedPublicFields}`);
    }
  } finally {
    await pool.end();
  }
}

main().catch((error) => {
  console.error("[media-operationalize] failed:", error instanceof Error ? error.message : error);
  process.exit(1);
});
