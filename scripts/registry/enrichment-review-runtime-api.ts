import pg from "pg";

type PgPool = InstanceType<typeof pg.Pool>;
type Row = Record<string, unknown>;

export interface ReleaseShellLookupInput {
  shellKey: string;
  registryEntityId: string | null;
  title?: string;
  artistDisplayName?: string;
  sourceSurface?: string;
  confidenceScore?: number;
}

export interface ReleaseShellLifecycleSnapshot {
  status: "open" | "resolved" | "reopened";
  reason: string | null;
  actor: string;
  createdAt: string | null;
}

export interface ReleaseShellEnrichmentContextResponse {
  shellKey: string;
  registryEntityId: string;
  dataSource: "runtime_api";
  lifecycle: ReleaseShellLifecycleSnapshot;
  observations: Row[];
  suggestions: Row[];
  providerLinks: Row[];
}

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

export function createRegistryEnrichmentPool(): PgPool {
  const explicitHost = process.env.PGHOST;
  const explicitUser = process.env.PGUSER;
  const explicitPassword = process.env.PGPASSWORD;
  const explicitDatabase = process.env.PGDATABASE;
  const explicitPort = Number(process.env.PGPORT || 5432);
  const databaseUrl = process.env.DATABASE_URL;

  if (explicitHost && explicitUser && explicitPassword && explicitDatabase) {
    return new pg.Pool({
      host: explicitHost,
      port: explicitPort,
      user: explicitUser,
      password: explicitPassword,
      database: explicitDatabase,
      ssl: { rejectUnauthorized: false },
      connectionTimeoutMillis: 10000,
      query_timeout: 10000,
      statement_timeout: 10000,
      max: 4,
    });
  }

  if (!databaseUrl) {
    throw new Error("DATABASE_URL or explicit PG* env vars are required for registry enrichment review API.");
  }

  return new pg.Pool({
    connectionString: normalizeDatabaseUrl(databaseUrl),
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 10000,
    query_timeout: 10000,
    statement_timeout: 10000,
    max: 4,
  });
}


async function ensureReleaseShellLifecycleTable(queryable: PgQueryable): Promise<void> {
  await queryable.query(`
    create table if not exists public.registry_release_shell_lifecycle_events (
      id uuid primary key default gen_random_uuid(),
      registry_entity_type text not null default 'release',
      registry_entity_id text not null,
      status text not null,
      reason text,
      actor text not null default 'system',
      created_at timestamptz not null default now()
    )
  `);

  await queryable.query(`
    create index if not exists registry_release_shell_lifecycle_events_entity_idx
    on public.registry_release_shell_lifecycle_events (registry_entity_type, registry_entity_id, created_at desc)
  `);
}

async function getReleaseShellLifecycleSnapshots(
  queryable: PgQueryable,
  registryEntityIds: string[],
): Promise<Map<string, ReleaseShellLifecycleSnapshot>> {
  await ensureReleaseShellLifecycleTable(queryable);

  if (registryEntityIds.length === 0) return new Map();

  const result = await queryable.query(
    `
      select distinct on (registry_entity_id)
        registry_entity_id::text as "registryEntityId",
        status,
        reason,
        actor,
        created_at as "createdAt"
      from public.registry_release_shell_lifecycle_events
      where registry_entity_type = 'release'
        and registry_entity_id::text = any($1::text[])
      order by registry_entity_id, created_at desc
    `,
    [registryEntityIds],
  );

  return new Map(
    result.rows.map((row) => [
      String(row.registryEntityId),
      {
        status: String(row.status || "open") as ReleaseShellLifecycleSnapshot["status"],
        reason: row.reason === null || row.reason === undefined ? null : String(row.reason),
        actor: String(row.actor || "system"),
        createdAt: row.createdAt ? String(row.createdAt) : null,
      },
    ]),
  );
}

export async function updateReleaseShellLifecycleStatus(
  pool: PgPool,
  registryEntityId: string,
  status: "resolved" | "reopened",
  reason = "",
): Promise<ReleaseShellLifecycleSnapshot> {
  const cleanRegistryEntityId = String(registryEntityId || "").trim();

  if (!cleanRegistryEntityId) {
    throw new Error("Missing registryEntityId.");
  }

  await ensureReleaseShellLifecycleTable(pool);

  const actor = process.env.WAKILISHA_CANONICAL_WRITE_ACTOR ?? "system";

  const result = await pool.query(
    `
      insert into public.registry_release_shell_lifecycle_events (
        registry_entity_type,
        registry_entity_id,
        status,
        reason,
        actor
      )
      values ('release', $1, $2, nullif($3, ''), $4)
      returning
        status,
        reason,
        actor,
        created_at as "createdAt"
    `,
    [cleanRegistryEntityId, status, reason, actor],
  );

  const row = result.rows[0] ?? {};

  return {
    status: String(row.status || status) as ReleaseShellLifecycleSnapshot["status"],
    reason: row.reason === null || row.reason === undefined ? null : String(row.reason),
    actor: String(row.actor || actor),
    createdAt: row.createdAt ? String(row.createdAt) : null,
  };
}


export async function listReleaseShellEnrichmentContexts(
  pool: PgPool,
  limit = 50,
  includeResolved = false,
): Promise<ReleaseShellEnrichmentContextResponse[]> {
  const result = await pool.query(
    `
      select
        registry_entity_id::text as "registryEntityId",
        max(created_at) as "createdAt",
        max(confidence_score)::float as "confidenceScore",
        coalesce(
          max(suggested_value) filter (where field_name = 'title'),
          max(suggested_value) filter (where field_name = 'release_title'),
          registry_entity_id::text
        ) as "title",
        coalesce(
          max(suggested_value) filter (where field_name = 'artist_display_name'),
          max(suggested_value) filter (where field_name = 'artist_name'),
          ''
        ) as "artistDisplayName"
      from public.registry_enrichment_suggestions
      where registry_entity_type = 'release'
      group by registry_entity_id
      order by max(created_at) desc
      limit $1::int
    `,
    [Math.max(1, Math.min(limit, 200))],
  );

  const shells = result.rows.map((row) => ({
    shellKey: String(row.registryEntityId),
    registryEntityId: String(row.registryEntityId),
    title: String(row.title ?? row.registryEntityId ?? "Untitled release"),
    artistDisplayName: String(row.artistDisplayName ?? ""),
    sourceSurface: "registry_enrichment",
    confidenceScore: Number(row.confidenceScore ?? 0.8),
  }));

  const contexts = await buildReleaseShellEnrichmentContexts(pool, shells);
  return includeResolved ? contexts : contexts.filter((context) => context.lifecycle.status !== "resolved");
}

export async function buildReleaseShellEnrichmentContexts(
  pool: PgPool,
  shells: ReleaseShellLookupInput[],
): Promise<ReleaseShellEnrichmentContextResponse[]> {
  const normalized = shells
    .map((shell) => ({
      ...shell,
      registryEntityId: String(shell.registryEntityId ?? shell.shellKey),
    }))
    .filter((shell) => shell.shellKey && shell.registryEntityId);

  if (normalized.length === 0) return [];

  const registryEntityIds = [...new Set(normalized.map((shell) => shell.registryEntityId))];

  const [observationsResult, suggestionsResult, linksResult] = await Promise.all([
    pool.query(
      `
        select
          id::text as "id",
          provider_item_id::text as "providerItemId",
          entity_type as "entityType",
          field_name as "fieldName",
          field_value as "fieldValue",
          provider,
          confidence_score::float as "confidenceScore",
          source_path as "sourcePath",
          created_at as "createdAt"
        from public.provider_field_observations
        where provider_item_id::text = any($1::text[])
        order by created_at desc, confidence_score desc, field_name asc
      `,
      [registryEntityIds],
    ),
    pool.query(
      `
        select
          id::text as "id",
          registry_entity_type as "registryEntityType",
          registry_entity_id::text as "registryEntityId",
          field_name as "fieldName",
          current_value as "currentValue",
          suggested_value as "suggestedValue",
          provider_item_id::text as "providerItemId",
          confidence_score::float as "confidenceScore",
          decision_status as "decisionStatus",
          created_at as "createdAt"
        from public.registry_enrichment_suggestions
        where registry_entity_id::text = any($1::text[])
        order by created_at desc, confidence_score desc, field_name asc
      `,
      [registryEntityIds],
    ),
    pool.query(
      `
        select
          id::text as "id",
          registry_entity_type as "registryEntityType",
          registry_entity_id::text as "registryEntityId",
          provider,
          provider_entity_id as "providerEntityId",
          provider_url as "providerUrl",
          match_status as "matchStatus",
          confidence_score::float as "confidenceScore",
          created_at as "createdAt"
        from public.provider_entity_links
        where registry_entity_id::text = any($1::text[])
        order by created_at desc, confidence_score desc, provider asc
      `,
      [registryEntityIds],
    ),
  ]);

  const observationsByEntity = groupBy(observationsResult.rows, "providerItemId");
  const suggestionsByEntity = groupBy(suggestionsResult.rows, "registryEntityId");
  const linksByEntity = groupBy(linksResult.rows, "registryEntityId");
  const lifecycleByEntity = await getReleaseShellLifecycleSnapshots(pool, registryEntityIds);

  return normalized.map((shell) => ({
    shellKey: shell.shellKey,
    registryEntityId: shell.registryEntityId,
    dataSource: "runtime_api" as const,
    lifecycle: lifecycleByEntity.get(shell.registryEntityId) ?? {
      status: "open" as const,
      reason: null,
      actor: "system",
      createdAt: null,
    },
    observations: observationsByEntity.get(shell.registryEntityId) ?? [],
    suggestions: suggestionsByEntity.get(shell.registryEntityId) ?? [],
    providerLinks: linksByEntity.get(shell.registryEntityId) ?? [],
  }));
}



export interface ApplyApprovedReleaseShellSuggestionsResult {
  registryEntityId: string;
  applied: Array<{ suggestionId: string; fieldName: string; target: string }>;
  skipped: Array<{ suggestionId: string; fieldName: string; reason: string }>;
  failed: Array<{ registryEntityId: string; reason: string }>;
}


export interface ApplyApprovedReleaseShellSuggestionPreviewItem {
  suggestionId: string;
  fieldName: string;
  targetPath: string;
  currentValue: string | null;
  proposedValue: string;
  writable: boolean;
  reason: string | null;
}

export interface ApplyApprovedReleaseShellSuggestionsPreview {
  registryEntityId: string;
  canonicalReleaseExists: boolean;
  willCreateCanonicalRelease: boolean;
  writable: ApplyApprovedReleaseShellSuggestionPreviewItem[];
  skipped: ApplyApprovedReleaseShellSuggestionPreviewItem[];
}


export interface CanonicalWriteAuditEvent {
  id: string;
  registryEntityType: string;
  registryEntityId: string;
  sourceSuggestionId: string | null;
  sourceTable: string;
  fieldName: string;
  targetPath: string;
  beforeValue: unknown;
  afterValue: unknown;
  action: string;
  status: string;
  errorMessage: string | null;
  actor: string;
  createdAt: string;
}

type PgQueryable = {
  query: PgPool["query"];
};

const DIRECT_RELEASE_FIELD_MAP: Record<string, string> = {
  title: "title",
  release_title: "title",
  artwork_url: "artwork_url",
  release_date: "release_date",
  release_type: "release_type",
};

const METADATA_RELEASE_FIELDS = new Set([
  "artist_display_name",
  "artist_name",
  "copyright",
  "label",
  "upc",
  "provider_url",
  "source_url",
]);

async function ensureCanonicalWriteAuditTable(queryable: PgQueryable): Promise<void> {
  await queryable.query(`
    create table if not exists public.registry_canonical_write_events (
      id uuid primary key default gen_random_uuid(),
      registry_entity_type text not null,
      registry_entity_id text not null,
      source_suggestion_id text,
      source_table text not null default 'registry_enrichment_suggestions',
      field_name text not null,
      target_path text not null,
      before_value jsonb,
      after_value jsonb,
      action text not null,
      status text not null,
      error_message text,
      actor text not null default 'system',
      created_at timestamptz not null default now()
    )
  `);

  await queryable.query(`
    create index if not exists registry_canonical_write_events_entity_idx
    on public.registry_canonical_write_events (registry_entity_type, registry_entity_id, created_at desc)
  `);

  await queryable.query(`
    create index if not exists registry_canonical_write_events_suggestion_idx
    on public.registry_canonical_write_events (source_suggestion_id)
  `);
}

async function insertCanonicalWriteAuditEvent(
  queryable: PgQueryable,
  event: {
    registryEntityType: string;
    registryEntityId: string;
    sourceSuggestionId?: string | null;
    fieldName: string;
    targetPath: string;
    beforeValue?: string | null;
    afterValue?: string | null;
    action: string;
    status: "applied" | "skipped" | "failed";
    errorMessage?: string | null;
    actor?: string;
  },
): Promise<void> {
  await queryable.query(
    `
      insert into public.registry_canonical_write_events (
        registry_entity_type,
        registry_entity_id,
        source_suggestion_id,
        source_table,
        field_name,
        target_path,
        before_value,
        after_value,
        action,
        status,
        error_message,
        actor
      )
      values (
        $1,
        $2,
        $3,
        'registry_enrichment_suggestions',
        $4,
        $5,
        case when $6::text is null then null::jsonb else to_jsonb($6::text) end,
        case when $7::text is null then null::jsonb else to_jsonb($7::text) end,
        $8,
        $9,
        $10,
        $11
      )
    `,
    [
      event.registryEntityType,
      event.registryEntityId,
      event.sourceSuggestionId ?? null,
      event.fieldName,
      event.targetPath,
      event.beforeValue ?? null,
      event.afterValue ?? null,
      event.action,
      event.status,
      event.errorMessage ?? null,
      event.actor ?? process.env.WAKILISHA_CANONICAL_WRITE_ACTOR ?? "system",
    ],
  );
}


function slugifyReleaseValue(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/['"]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 96) || "release";
}

function getSuggestionTextValue(suggestions: Row[], fieldNames: string[], fallback = ""): string {
  for (const fieldName of fieldNames) {
    const match = suggestions.find((suggestion) => String(suggestion.fieldName ?? "") === fieldName);
    if (match?.suggestedValue !== undefined && match.suggestedValue !== null && String(match.suggestedValue).trim()) {
      return String(match.suggestedValue).trim();
    }
  }

  return fallback;
}

async function getRegistryReleaseColumns(queryable: PgQueryable): Promise<Set<string>> {
  const result = await queryable.query(
    `
      select column_name as "columnName"
      from information_schema.columns
      where table_schema = 'public'
        and table_name = 'registry_releases'
    `,
  );

  return new Set(result.rows.map((row) => String(row.columnName)));
}

async function ensureCanonicalRegistryReleaseRow(
  queryable: PgQueryable,
  registryEntityId: string,
  suggestions: Row[],
): Promise<boolean> {
  const releaseCheck = await queryable.query(
    `
      select id::text as id
      from public.registry_releases
      where id::text = $1
      limit 1
    `,
    [registryEntityId],
  );

  if ((releaseCheck.rowCount ?? 0) > 0) return false;

  const columns = await getRegistryReleaseColumns(queryable);
  const title = getSuggestionTextValue(suggestions, ["title", "release_title"], `Release ${registryEntityId}`);
  const slug = `${slugifyReleaseValue(title)}-${slugifyReleaseValue(registryEntityId)}`;
  const metadata: Record<string, string> = {};

  for (const fieldName of METADATA_RELEASE_FIELDS) {
    const value = getSuggestionTextValue(suggestions, [fieldName]);
    if (value) metadata[fieldName] = value;
  }

  const values: Record<string, unknown> = {};

  if (columns.has("id")) values.id = registryEntityId;
  if (columns.has("title")) values.title = title;
  if (columns.has("release_title")) values.release_title = title;
  if (columns.has("slug")) values.slug = slug;
  if (columns.has("release_slug")) values.release_slug = slug;
  if (columns.has("canonical_slug")) values.canonical_slug = slug;
  if (columns.has("artwork_url")) values.artwork_url = getSuggestionTextValue(suggestions, ["artwork_url"]);
  if (columns.has("release_type")) values.release_type = getSuggestionTextValue(suggestions, ["release_type"], "single");
  if (columns.has("artist_display_name")) values.artist_display_name = getSuggestionTextValue(suggestions, ["artist_display_name", "artist_name"]);
  if (columns.has("label_name")) values.label_name = getSuggestionTextValue(suggestions, ["label", "label_name"]);
  if (columns.has("upc")) values.upc = getSuggestionTextValue(suggestions, ["upc"]);
  if (columns.has("source")) values.source = "release_shell_review";
  if (columns.has("status")) values.status = "draft";
  if (columns.has("lifecycle_status")) values.lifecycle_status = "open";

  const releaseDate = getSuggestionTextValue(suggestions, ["release_date"]);
  if (columns.has("release_date") && releaseDate) values.release_date = releaseDate;

  if (columns.has("metadata")) {
    values.metadata = JSON.stringify({
      ...metadata,
      auto_provisioned_from: "release_shell_review",
      registry_entity_id: registryEntityId,
    });
  }

  if (!values.id) {
    throw new Error("registry_releases.id column is required for auto-provisioning.");
  }

  const insertColumns = Object.keys(values);
  const params = Object.values(values);
  const placeholders = insertColumns.map((column, index) => {
    const position = `$${index + 1}`;
    if (column === "metadata") return `${position}::jsonb`;
    if (column === "release_date") return `nullif(${position}::text, '')::date`;
    return position;
  });

  await queryable.query(
    `
      insert into public.registry_releases (${insertColumns.map((column) => `"${column}"`).join(", ")})
      values (${placeholders.join(", ")})
      on conflict (id) do nothing
    `,
    params,
  );

  await insertCanonicalWriteAuditEvent(queryable, {
    registryEntityType: "release",
    registryEntityId,
    sourceSuggestionId: null,
    fieldName: "canonical_release",
    targetPath: "registry_releases",
    beforeValue: null,
    afterValue: registryEntityId,
    action: "canonical_release_created",
    status: "applied",
  });

  return true;
}


export async function getReleaseShellCanonicalWriteEvents(
  pool: PgPool,
  registryEntityId: string,
  limit = 25,
): Promise<CanonicalWriteAuditEvent[]> {
  await ensureCanonicalWriteAuditTable(pool);

  const result = await pool.query(
    `
      select
        id::text as "id",
        registry_entity_type as "registryEntityType",
        registry_entity_id as "registryEntityId",
        source_suggestion_id as "sourceSuggestionId",
        source_table as "sourceTable",
        field_name as "fieldName",
        target_path as "targetPath",
        before_value as "beforeValue",
        after_value as "afterValue",
        action,
        status,
        error_message as "errorMessage",
        actor,
        created_at as "createdAt"
      from public.registry_canonical_write_events
      where registry_entity_type = 'release'
        and registry_entity_id = $1
      order by created_at desc
      limit $2::int
    `,
    [String(registryEntityId), Math.max(1, Math.min(limit, 100))],
  );

  return result.rows as CanonicalWriteAuditEvent[];
}


async function readCanonicalReleaseValue(
  queryable: PgQueryable,
  registryEntityId: string,
  fieldName: string,
  targetColumn: string | undefined,
): Promise<string | null> {
  if (targetColumn) {
    const result = await queryable.query(
      `select ${targetColumn}::text as "currentValue" from public.registry_releases where id::text = $1 limit 1`,
      [registryEntityId],
    );

    return result.rows[0]?.currentValue ?? null;
  }

  if (METADATA_RELEASE_FIELDS.has(fieldName)) {
    const result = await queryable.query(
      `
        select metadata->>$2 as "currentValue"
        from public.registry_releases
        where id::text = $1
        limit 1
      `,
      [registryEntityId, fieldName],
    );

    return result.rows[0]?.currentValue ?? null;
  }

  return null;
}


export interface UpdateReleaseShellSuggestionDecisionResult {
  suggestionId: string;
  registryEntityId: string;
  decisionStatus: "approved" | "rejected" | "needs_review";
}

export async function updateReleaseShellSuggestionDecision(
  pool: PgPool,
  suggestionId: string,
  decisionStatus: "approved" | "rejected" | "needs_review",
): Promise<UpdateReleaseShellSuggestionDecisionResult> {
  const cleanSuggestionId = String(suggestionId || "").trim();

  if (!cleanSuggestionId) {
    throw new Error("Missing suggestionId.");
  }

  if (!["approved", "rejected", "needs_review"].includes(decisionStatus)) {
    throw new Error("Invalid decision status.");
  }

  const result = await pool.query(
    `
      update public.registry_enrichment_suggestions
      set decision_status = $2
      where id::text = $1
        and registry_entity_type = 'release'
      returning
        id::text as "suggestionId",
        registry_entity_id::text as "registryEntityId",
        decision_status as "decisionStatus"
    `,
    [cleanSuggestionId, decisionStatus],
  );

  if ((result.rowCount ?? 0) === 0) {
    throw new Error(`No release enrichment suggestion found for ${cleanSuggestionId}.`);
  }

  return result.rows[0] as UpdateReleaseShellSuggestionDecisionResult;
}


export async function previewApprovedReleaseShellSuggestions(
  pool: PgPool,
  registryEntityId: string,
): Promise<ApplyApprovedReleaseShellSuggestionsPreview> {
  const cleanRegistryEntityId = String(registryEntityId || "").trim();

  if (!cleanRegistryEntityId) {
    throw new Error("Missing registryEntityId.");
  }

  const releaseCheck = await pool.query(
    `
      select id::text as id
      from public.registry_releases
      where id::text = $1
      limit 1
    `,
    [cleanRegistryEntityId],
  );

  const canonicalReleaseExists = (releaseCheck.rowCount ?? 0) > 0;

  const suggestions = await pool.query(
    `
      select
        id::text as "id",
        field_name as "fieldName",
        suggested_value as "suggestedValue"
      from public.registry_enrichment_suggestions
      where registry_entity_type = 'release'
        and registry_entity_id::text = $1
        and decision_status = 'approved'
      order by confidence_score desc nulls last, created_at asc
    `,
    [cleanRegistryEntityId],
  );

  const writable: ApplyApprovedReleaseShellSuggestionPreviewItem[] = [];
  const skipped: ApplyApprovedReleaseShellSuggestionPreviewItem[] = [];

  for (const suggestion of suggestions.rows) {
    const suggestionId = String(suggestion.id);
    const fieldName = String(suggestion.fieldName || "").trim();
    const proposedValue = suggestion.suggestedValue === null || suggestion.suggestedValue === undefined
      ? ""
      : String(suggestion.suggestedValue);

    const targetColumn = DIRECT_RELEASE_FIELD_MAP[fieldName];
    const isMetadataField = METADATA_RELEASE_FIELDS.has(fieldName);
    const isWritable = Boolean(targetColumn || isMetadataField);
    const targetPath = targetColumn
      ? `registry_releases.${targetColumn}`
      : isMetadataField
        ? `registry_releases.metadata.${fieldName}`
        : "unmapped";

    const currentValue = canonicalReleaseExists
      ? await readCanonicalReleaseValue(pool, cleanRegistryEntityId, fieldName, targetColumn)
      : null;

    const item: ApplyApprovedReleaseShellSuggestionPreviewItem = {
      suggestionId,
      fieldName,
      targetPath,
      currentValue,
      proposedValue,
      writable: isWritable,
      reason: isWritable ? null : "Field is not in the canonical write allowlist.",
    };

    if (isWritable) writable.push(item);
    else skipped.push(item);
  }

  return {
    registryEntityId: cleanRegistryEntityId,
    canonicalReleaseExists,
    willCreateCanonicalRelease: !canonicalReleaseExists,
    writable,
    skipped,
  };
}


export async function applyApprovedReleaseShellSuggestions(
  pool: PgPool,
  registryEntityId: string,
): Promise<ApplyApprovedReleaseShellSuggestionsResult> {
  const cleanRegistryEntityId = String(registryEntityId || "").trim();
  const result: ApplyApprovedReleaseShellSuggestionsResult = {
    registryEntityId: cleanRegistryEntityId,
    applied: [],
    skipped: [],
    failed: [],
  };

  if (!cleanRegistryEntityId) {
    result.failed.push({ registryEntityId: cleanRegistryEntityId, reason: "Missing registryEntityId." });
    return result;
  }

  await ensureCanonicalWriteAuditTable(pool);

  const client = await pool.connect();

  try {
    await client.query("begin");

    const suggestions = await client.query(
      `
        select
          id::text as "id",
          field_name as "fieldName",
          suggested_value as "suggestedValue"
        from public.registry_enrichment_suggestions
        where registry_entity_type = 'release'
          and registry_entity_id::text = $1
          and decision_status = 'approved'
        order by confidence_score desc nulls last, created_at asc
      `,
      [cleanRegistryEntityId],
    );

    await ensureCanonicalRegistryReleaseRow(client, cleanRegistryEntityId, suggestions.rows);

    for (const suggestion of suggestions.rows) {
      const suggestionId = String(suggestion.id);
      const fieldName = String(suggestion.fieldName || "").trim();
      const suggestedValue = suggestion.suggestedValue === null || suggestion.suggestedValue === undefined
        ? ""
        : String(suggestion.suggestedValue);

      const targetColumn = DIRECT_RELEASE_FIELD_MAP[fieldName];

      if (targetColumn) {
        const beforeResult = await client.query(
          `select ${targetColumn}::text as "beforeValue" from public.registry_releases where id::text = $1 limit 1`,
          [cleanRegistryEntityId],
        );
        const beforeValue = beforeResult.rows[0]?.beforeValue ?? null;

        if (targetColumn === "release_date") {
          await client.query(
            `
              update public.registry_releases
              set release_date = nullif($2, '')::date
              where id::text = $1
            `,
            [cleanRegistryEntityId, suggestedValue],
          );
        } else {
          await client.query(
            `
              update public.registry_releases
              set ${targetColumn} = $2
              where id::text = $1
            `,
            [cleanRegistryEntityId, suggestedValue],
          );
        }

        await client.query(
          `
            update public.registry_enrichment_suggestions
            set decision_status = 'applied'
            where id::text = $1
          `,
          [suggestionId],
        );

        await insertCanonicalWriteAuditEvent(client, {
          registryEntityType: "release",
          registryEntityId: cleanRegistryEntityId,
          sourceSuggestionId: suggestionId,
          fieldName,
          targetPath: `registry_releases.${targetColumn}`,
          beforeValue,
          afterValue: suggestedValue,
          action: "apply_approved_suggestion",
          status: "applied",
        });

        result.applied.push({ suggestionId, fieldName, target: `registry_releases.${targetColumn}` });
        continue;
      }

      if (METADATA_RELEASE_FIELDS.has(fieldName)) {
        const beforeResult = await client.query(
          `
            select metadata->>$2 as "beforeValue"
            from public.registry_releases
            where id::text = $1
            limit 1
          `,
          [cleanRegistryEntityId, fieldName],
        );
        const beforeValue = beforeResult.rows[0]?.beforeValue ?? null;

        await client.query(
          `
            update public.registry_releases
            set metadata = jsonb_set(
              coalesce(metadata, '{}'::jsonb),
              $2::text[],
              to_jsonb($3::text),
              true
            )
            where id::text = $1
          `,
          [cleanRegistryEntityId, [fieldName], suggestedValue],
        );

        await client.query(
          `
            update public.registry_enrichment_suggestions
            set decision_status = 'applied'
            where id::text = $1
          `,
          [suggestionId],
        );

        await insertCanonicalWriteAuditEvent(client, {
          registryEntityType: "release",
          registryEntityId: cleanRegistryEntityId,
          sourceSuggestionId: suggestionId,
          fieldName,
          targetPath: `registry_releases.metadata.${fieldName}`,
          beforeValue,
          afterValue: suggestedValue,
          action: "apply_approved_suggestion",
          status: "applied",
        });

        result.applied.push({ suggestionId, fieldName, target: `registry_releases.metadata.${fieldName}` });
        continue;
      }

      await insertCanonicalWriteAuditEvent(client, {
        registryEntityType: "release",
        registryEntityId: cleanRegistryEntityId,
        sourceSuggestionId: suggestionId,
        fieldName,
        targetPath: "unmapped",
        beforeValue: null,
        afterValue: suggestedValue,
        action: "apply_approved_suggestion",
        status: "skipped",
        errorMessage: "Field is not in the canonical write allowlist.",
      });

      result.skipped.push({
        suggestionId,
        fieldName,
        reason: "Field is not in the canonical write allowlist.",
      });
    }

    await client.query("commit");
    return result;
  } catch (err) {
    await client.query("rollback");

    const reason = err instanceof Error ? err.message : "Unknown canonical write failure.";

    try {
      await insertCanonicalWriteAuditEvent(pool, {
        registryEntityType: "release",
        registryEntityId: cleanRegistryEntityId,
        sourceSuggestionId: null,
        fieldName: "canonical_write",
        targetPath: "registry_releases",
        beforeValue: null,
        afterValue: null,
        action: "apply_approved_suggestion",
        status: "failed",
        errorMessage: reason,
      });
    } catch {
      // Avoid masking the original canonical write failure.
    }

    result.failed.push({
      registryEntityId: cleanRegistryEntityId,
      reason,
    });
    return result;
  } finally {
    client.release();
  }
}


function groupBy(rows: Row[], key: string): Map<string, Row[]> {
  const grouped = new Map<string, Row[]>();

  for (const row of rows) {
    const value = String(row[key] ?? "");
    if (!value) continue;
    const bucket = grouped.get(value) ?? [];
    bucket.push(row);
    grouped.set(value, bucket);
  }

  return grouped;
}
