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

export interface ReleaseShellEnrichmentContextResponse {
  shellKey: string;
  registryEntityId: string;
  dataSource: "runtime_api";
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
          provider_item_id as "providerItemId",
          entity_type as "entityType",
          field_name as "fieldName",
          field_value as "fieldValue",
          provider,
          confidence_score::float as "confidenceScore",
          source_path as "sourcePath",
          created_at as "createdAt"
        from public.provider_field_observations
        where provider_item_id = any($1::text[])
        order by created_at desc, confidence_score desc, field_name asc
      `,
      [registryEntityIds],
    ),
    pool.query(
      `
        select
          id::text as "id",
          registry_entity_type as "registryEntityType",
          registry_entity_id as "registryEntityId",
          field_name as "fieldName",
          current_value as "currentValue",
          suggested_value as "suggestedValue",
          provider_item_id as "providerItemId",
          confidence_score::float as "confidenceScore",
          decision_status as "decisionStatus",
          created_at as "createdAt"
        from public.registry_enrichment_suggestions
        where registry_entity_id = any($1::text[])
        order by created_at desc, confidence_score desc, field_name asc
      `,
      [registryEntityIds],
    ),
    pool.query(
      `
        select
          id::text as "id",
          registry_entity_type as "registryEntityType",
          registry_entity_id as "registryEntityId",
          provider,
          provider_entity_id as "providerEntityId",
          provider_url as "providerUrl",
          match_status as "matchStatus",
          confidence_score::float as "confidenceScore",
          created_at as "createdAt"
        from public.provider_entity_links
        where registry_entity_id = any($1::text[])
        order by created_at desc, confidence_score desc, provider asc
      `,
      [registryEntityIds],
    ),
  ]);

  const observationsByEntity = groupBy(observationsResult.rows, "providerItemId");
  const suggestionsByEntity = groupBy(suggestionsResult.rows, "registryEntityId");
  const linksByEntity = groupBy(linksResult.rows, "registryEntityId");

  return normalized.map((shell) => ({
    shellKey: shell.shellKey,
    registryEntityId: shell.registryEntityId,
    dataSource: "runtime_api" as const,
    observations: observationsByEntity.get(shell.registryEntityId) ?? [],
    suggestions: suggestionsByEntity.get(shell.registryEntityId) ?? [],
    providerLinks: linksByEntity.get(shell.registryEntityId) ?? [],
  }));
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
