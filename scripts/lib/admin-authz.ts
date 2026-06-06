import pg from "pg";

type Pool = InstanceType<typeof pg.Pool>;

export type AdminScopeCheck = {
  scopeType?: "global" | "market" | "country" | "region" | "series" | "vertical" | "entity_type" | string;
  scopeValue?: string;
  requireEdit?: boolean;
  requirePublish?: boolean;
};

export type AuthorizedAdmin = {
  userId: string;
  email: string | null;
  roles: string[];
  capabilities: string[];
};

type JwtPayload = {
  sub?: string;
  email?: string;
  role?: string;
  exp?: number;
  [key: string]: unknown;
};

let pool: Pool | null = null;

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

export function getAdminAuthzPool(): Pool {
  if (pool) return pool;
  const explicitHost = process.env.PGHOST;
  const explicitUser = process.env.PGUSER;
  const explicitPassword = process.env.PGPASSWORD;
  const explicitDatabase = process.env.PGDATABASE;
  const explicitPort = Number(process.env.PGPORT || 5432);
  if (explicitHost && explicitUser && explicitPassword && explicitDatabase) {
    pool = new pg.Pool({ host: explicitHost, port: explicitPort, user: explicitUser, password: explicitPassword, database: explicitDatabase, ssl: { rejectUnauthorized: false }, max: 4, connectionTimeoutMillis: 10000, query_timeout: 15000, statement_timeout: 15000 });
    return pool;
  }
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw Object.assign(new Error("DATABASE_URL or explicit PG* env vars are required for admin authorization."), { status: 500 });
  pool = new pg.Pool({ connectionString: normalizeDatabaseUrl(databaseUrl), ssl: { rejectUnauthorized: false }, max: 4, connectionTimeoutMillis: 10000, query_timeout: 15000, statement_timeout: 15000 });
  return pool;
}

function base64UrlDecode(value: string): string {
  const padded = value + "=".repeat((4 - (value.length % 4)) % 4);
  return Buffer.from(padded.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf8");
}

export function extractBearerToken(headers: Record<string, string | string[] | undefined>): string | null {
  const raw = headers.authorization ?? headers.Authorization;
  const value = Array.isArray(raw) ? raw[0] : raw;
  if (!value) return null;
  const match = value.match(/^Bearer\s+(.+)$/i);
  return match?.[1] ?? null;
}

export function decodeJwtUnsafe(token: string): JwtPayload {
  const parts = token.split(".");
  if (parts.length < 2) throw Object.assign(new Error("Invalid bearer token."), { status: 401 });
  const payload = JSON.parse(base64UrlDecode(parts[1])) as JwtPayload;
  if (!payload.sub) throw Object.assign(new Error("Bearer token has no user subject."), { status: 401 });
  if (payload.exp && payload.exp * 1000 < Date.now()) throw Object.assign(new Error("Bearer token has expired."), { status: 401 });
  return payload;
}

export async function loadAuthorizedAdmin(userId: string, requiredCapability?: string, scope?: AdminScopeCheck): Promise<AuthorizedAdmin> {
  const db = getAdminAuthzPool();
  const result = await db.query(`
    select
      coalesce(up.email, '') as email,
      coalesce(array_agg(distinct ura.role_key) filter (where ura.role_key is not null), '{}'::text[]) as roles,
      coalesce(array_agg(distinct rc.capability_key) filter (where rc.capability_key is not null), '{}'::text[]) as capabilities
    from user_role_assignments ura
    left join user_profiles up on up.user_id = ura.user_id
    left join role_capabilities rc on rc.role_key = ura.role_key
    where ura.user_id = $1::uuid
      and ura.status = 'active'
      and (ura.expires_at is null or ura.expires_at > now())
    group by up.email
  `, [userId]);

  const row = result.rows[0];
  const roles = (row?.roles ?? []) as string[];
  const capabilities = (row?.capabilities ?? []) as string[];
  if (!roles.length) throw Object.assign(new Error("User has no active WAKILISHA role assignment."), { status: 403 });
  if (!capabilities.includes("view_admin_readonly") && !capabilities.includes("view_dashboard")) throw Object.assign(new Error("User is not allowed to access Admin Studio."), { status: 403 });
  if (requiredCapability && !capabilities.includes(requiredCapability)) throw Object.assign(new Error(`Missing required capability: ${requiredCapability}`), { status: 403 });

  if (scope?.scopeType && scope.scopeValue && !roles.includes("administrator") && !capabilities.includes("manage_settings")) {
    const scopeResult = await db.query(`
      select 1
      from user_access_scopes
      where user_id = $1::uuid
        and status = 'active'
        and (scope_type = 'global' or (scope_type = $2 and scope_value = $3))
        and ($4::boolean is false or can_edit is true)
        and ($5::boolean is false or can_publish is true)
      limit 1
    `, [userId, scope.scopeType, scope.scopeValue, Boolean(scope.requireEdit), Boolean(scope.requirePublish)]);
    if (!scopeResult.rowCount) throw Object.assign(new Error(`User is not allowed for scope ${scope.scopeType}:${scope.scopeValue}.`), { status: 403 });
  }

  return { userId, email: row?.email || null, roles, capabilities };
}

export async function requireAdminFromHeaders(headers: Record<string, string | string[] | undefined>, requiredCapability?: string, scope?: AdminScopeCheck): Promise<AuthorizedAdmin> {
  const token = extractBearerToken(headers);
  if (!token) throw Object.assign(new Error("Missing bearer token."), { status: 401 });
  const payload = decodeJwtUnsafe(token);
  return loadAuthorizedAdmin(String(payload.sub), requiredCapability, scope);
}

export async function auditAdminEvent(input: {
  actorUserId: string;
  targetUserId?: string | null;
  eventType: string;
  targetTable?: string | null;
  targetRecordId?: string | null;
  message?: string | null;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  const db = getAdminAuthzPool();
  await db.query(`
    insert into admin_audit_events (actor_user_id, target_user_id, event_type, target_table, target_record_id, message, metadata, created_at)
    values ($1::uuid, $2::uuid, $3, $4, $5, $6, $7::jsonb, now())
  `, [input.actorUserId, input.targetUserId ?? null, input.eventType, input.targetTable ?? null, input.targetRecordId ?? null, input.message ?? null, JSON.stringify(input.metadata ?? {})]);
}
