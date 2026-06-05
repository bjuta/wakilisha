import fs from "node:fs";
import path from "node:path";
import pg from "pg";

const root = process.cwd();
const localStorePath = path.join(root, "tmp", "magazine-visual-assets.json");

type PgPool = InstanceType<typeof pg.Pool>;
export type VisualAssetStatus = "draft" | "generated" | "approved" | "rejected" | "locked";
export type VisualAssetRow = Record<string, unknown> & { id: string; status: VisualAssetStatus };

const VALID_STATUSES = new Set(["draft", "generated", "approved", "rejected", "locked"]);

function normalizeDatabaseUrlForPg(databaseUrl: string): string {
  try {
    const url = new URL(databaseUrl);
    url.searchParams.delete("sslmode");
    url.searchParams.delete("uselibpqcompat");
    return url.toString();
  } catch {
    return databaseUrl;
  }
}

function sqlLiteral(value: string): string {
  return `'${value.replace(/'/g, "''")}'`;
}

function ensureDir() {
  fs.mkdirSync(path.dirname(localStorePath), { recursive: true });
}

function normalizeStatus(value: unknown, fallback: VisualAssetStatus = "generated"): VisualAssetStatus {
  const status = String(value ?? fallback);
  return VALID_STATUSES.has(status) ? status as VisualAssetStatus : fallback;
}

function rowFromPayload(payload: Record<string, unknown>): VisualAssetRow {
  const brief = payload.visual_brief_json as Record<string, unknown> | undefined;
  const id = String(payload.id ?? brief?.id ?? "");
  if (!id) throw new Error("Visual asset id is required.");
  return {
    id,
    issue_id: String(payload.issue_id ?? brief?.issue_id ?? ""),
    issue_slug: payload.issue_slug ? String(payload.issue_slug) : null,
    spread_id: String(payload.spread_id ?? brief?.spread_id ?? ""),
    article_id: payload.article_id ?? brief?.article_id ?? null,
    visual_family: String(payload.visual_family ?? brief?.visual_family ?? "Scene / Atmosphere"),
    visual_type: String(payload.visual_type ?? brief?.visual_type ?? "full_bleed_atmosphere"),
    editorial_intent: String(payload.editorial_intent ?? brief?.editorial_intent ?? "create atmosphere"),
    treatment: String(payload.treatment ?? brief?.treatment ?? "annotated-photo"),
    palette: String(payload.palette ?? brief?.palette ?? "neutral"),
    contrast_mode: String(payload.contrast_mode ?? brief?.contrast_mode ?? "dark"),
    visual_brief_json: brief ?? payload,
    status: normalizeStatus(payload.status),
    notes: payload.notes ?? null,
    created_by: String(payload.created_by ?? "Muiruri Beautah"),
    created_at: String(payload.created_at ?? new Date().toISOString()),
    updated_at: String(payload.updated_at ?? new Date().toISOString()),
    approved_at: payload.approved_at ?? null,
    approved_by: payload.approved_by ?? null,
    locked_at: payload.locked_at ?? null,
    locked_by: payload.locked_by ?? null,
    rejected_at: payload.rejected_at ?? null,
    rejected_by: payload.rejected_by ?? null,
  } as VisualAssetRow;
}

export interface MagazineVisualAssetsRepository {
  kind: "json-local" | "database";
  testConnection(): Promise<boolean>;
  list(status?: string | null): Promise<VisualAssetRow[]>;
  get(id: string): Promise<VisualAssetRow | null>;
  upsert(payload: Record<string, unknown>): Promise<VisualAssetRow>;
  setStatus(id: string, status: VisualAssetStatus, actor?: string): Promise<VisualAssetRow | null>;
  remove(id: string): Promise<boolean>;
  clearUnlocked(): Promise<number>;
}

class JsonVisualAssetsRepository implements MagazineVisualAssetsRepository {
  kind = "json-local" as const;

  async testConnection(): Promise<boolean> {
    ensureDir();
    return true;
  }

  private read(): VisualAssetRow[] {
    ensureDir();
    if (!fs.existsSync(localStorePath)) return [];
    try {
      const parsed = JSON.parse(fs.readFileSync(localStorePath, "utf8"));
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  private write(rows: VisualAssetRow[]) {
    ensureDir();
    fs.writeFileSync(localStorePath, JSON.stringify(rows, null, 2));
  }

  async list(status?: string | null): Promise<VisualAssetRow[]> {
    return this.read()
      .filter((row) => !status || row.status === status)
      .sort((a, b) => String(b.updated_at).localeCompare(String(a.updated_at)));
  }

  async get(id: string): Promise<VisualAssetRow | null> {
    return this.read().find((row) => row.id === id) ?? null;
  }

  async upsert(payload: Record<string, unknown>): Promise<VisualAssetRow> {
    const rows = this.read();
    const next = rowFromPayload(payload);
    const existing = rows.find((row) => row.id === next.id);
    const merged = existing
      ? { ...existing, ...next, status: existing.status === "locked" ? "locked" : next.status, created_at: existing.created_at, updated_at: new Date().toISOString() } as VisualAssetRow
      : next;
    this.write([merged, ...rows.filter((row) => row.id !== merged.id)]);
    return merged;
  }

  async setStatus(id: string, status: VisualAssetStatus, actor = "Muiruri Beautah"): Promise<VisualAssetRow | null> {
    const rows = this.read();
    const existing = rows.find((row) => row.id === id);
    if (!existing) return null;
    const timestamp = new Date().toISOString();
    const nextStatus = existing.status === "locked" && status !== "locked" ? "locked" : status;
    const next = {
      ...existing,
      status: nextStatus,
      updated_at: timestamp,
      approved_at: nextStatus === "approved" || nextStatus === "locked" ? existing.approved_at ?? timestamp : existing.approved_at,
      approved_by: nextStatus === "approved" || nextStatus === "locked" ? existing.approved_by ?? actor : existing.approved_by,
      locked_at: nextStatus === "locked" ? existing.locked_at ?? timestamp : existing.locked_at,
      locked_by: nextStatus === "locked" ? existing.locked_by ?? actor : existing.locked_by,
      rejected_at: nextStatus === "rejected" ? timestamp : existing.rejected_at,
      rejected_by: nextStatus === "rejected" ? actor : existing.rejected_by,
    } as VisualAssetRow;
    this.write([next, ...rows.filter((row) => row.id !== id)]);
    return next;
  }

  async remove(id: string): Promise<boolean> {
    const rows = this.read();
    const next = rows.filter((row) => row.id !== id);
    this.write(next);
    return next.length !== rows.length;
  }

  async clearUnlocked(): Promise<number> {
    const rows = this.read();
    const next = rows.filter((row) => row.status === "locked");
    this.write(next);
    return rows.length - next.length;
  }
}

class DatabaseVisualAssetsRepository implements MagazineVisualAssetsRepository {
  kind = "database" as const;
  private pool: PgPool;

  constructor(private databaseUrl = process.env.DATABASE_URL ?? "") {
    const explicitHost = process.env.PGHOST;
    const explicitUser = process.env.PGUSER;
    const explicitPassword = process.env.PGPASSWORD;
    const explicitDatabase = process.env.PGDATABASE;
    const explicitPort = Number(process.env.PGPORT || 5432);
    this.pool = explicitHost && explicitUser && explicitPassword && explicitDatabase
      ? new pg.Pool({ host: explicitHost, port: explicitPort, user: explicitUser, password: explicitPassword, database: explicitDatabase, ssl: { rejectUnauthorized: false }, max: 4 })
      : new pg.Pool({ connectionString: normalizeDatabaseUrlForPg(this.databaseUrl), ssl: { rejectUnauthorized: false }, max: 4 });
  }

  async testConnection(): Promise<boolean> {
    const result = await this.pool.query("SELECT to_regclass('public.wk_magazine_visual_assets') AS table_name");
    return Boolean(result.rows[0]?.table_name);
  }

  private toRow(row: Record<string, unknown>): VisualAssetRow {
    return { ...row, status: normalizeStatus(row.status) } as VisualAssetRow;
  }

  async list(status?: string | null): Promise<VisualAssetRow[]> {
    const where = status ? `WHERE status = ${sqlLiteral(normalizeStatus(status))}` : "";
    const result = await this.pool.query(`SELECT * FROM wk_magazine_visual_assets ${where} ORDER BY updated_at DESC LIMIT 500`);
    return result.rows.map((row) => this.toRow(row));
  }

  async get(id: string): Promise<VisualAssetRow | null> {
    const result = await this.pool.query("SELECT * FROM wk_magazine_visual_assets WHERE id = $1 LIMIT 1", [id]);
    return result.rows[0] ? this.toRow(result.rows[0]) : null;
  }

  async upsert(payload: Record<string, unknown>): Promise<VisualAssetRow> {
    const row = rowFromPayload(payload);
    const existing = await this.get(row.id);
    if (existing?.status === "locked") return existing;
    const result = await this.pool.query(`
      INSERT INTO wk_magazine_visual_assets (
        id, issue_id, issue_slug, spread_id, article_id, visual_family, visual_type, editorial_intent,
        treatment, palette, contrast_mode, visual_brief_json, status, notes, created_by
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)
      ON CONFLICT (id) DO UPDATE SET
        issue_id = EXCLUDED.issue_id,
        issue_slug = EXCLUDED.issue_slug,
        spread_id = EXCLUDED.spread_id,
        article_id = EXCLUDED.article_id,
        visual_family = EXCLUDED.visual_family,
        visual_type = EXCLUDED.visual_type,
        editorial_intent = EXCLUDED.editorial_intent,
        treatment = EXCLUDED.treatment,
        palette = EXCLUDED.palette,
        contrast_mode = EXCLUDED.contrast_mode,
        visual_brief_json = EXCLUDED.visual_brief_json,
        status = EXCLUDED.status,
        notes = EXCLUDED.notes
      RETURNING *
    `, [row.id, row.issue_id, row.issue_slug, row.spread_id, row.article_id, row.visual_family, row.visual_type, row.editorial_intent, row.treatment, row.palette, row.contrast_mode, row.visual_brief_json, row.status, row.notes, row.created_by]);
    return this.toRow(result.rows[0]);
  }

  async setStatus(id: string, status: VisualAssetStatus, actor = "Muiruri Beautah"): Promise<VisualAssetRow | null> {
    const existing = await this.get(id);
    if (!existing) return null;
    const nextStatus = existing.status === "locked" && status !== "locked" ? "locked" : status;
    const result = await this.pool.query(`
      UPDATE wk_magazine_visual_assets SET
        status = $2,
        approved_at = CASE WHEN $2 IN ('approved','locked') THEN COALESCE(approved_at, now()) ELSE approved_at END,
        approved_by = CASE WHEN $2 IN ('approved','locked') THEN COALESCE(approved_by, $3) ELSE approved_by END,
        locked_at = CASE WHEN $2 = 'locked' THEN COALESCE(locked_at, now()) ELSE locked_at END,
        locked_by = CASE WHEN $2 = 'locked' THEN COALESCE(locked_by, $3) ELSE locked_by END,
        rejected_at = CASE WHEN $2 = 'rejected' THEN now() ELSE rejected_at END,
        rejected_by = CASE WHEN $2 = 'rejected' THEN $3 ELSE rejected_by END
      WHERE id = $1
      RETURNING *
    `, [id, nextStatus, actor]);
    return result.rows[0] ? this.toRow(result.rows[0]) : null;
  }

  async remove(id: string): Promise<boolean> {
    const result = await this.pool.query("DELETE FROM wk_magazine_visual_assets WHERE id = $1 AND status != 'locked'", [id]);
    return (result.rowCount ?? 0) > 0;
  }

  async clearUnlocked(): Promise<number> {
    const result = await this.pool.query("DELETE FROM wk_magazine_visual_assets WHERE status != 'locked'");
    return result.rowCount ?? 0;
  }
}

export function createMagazineVisualAssetsRepository(): MagazineVisualAssetsRepository {
  const mode = process.env.WAKILISHA_VISUAL_ASSETS_REPOSITORY_MODE ?? process.env.WAKILISHA_V2_REPOSITORY_MODE ?? "json";
  if (mode === "database" && (process.env.DATABASE_URL || process.env.PGHOST)) return new DatabaseVisualAssetsRepository();
  return new JsonVisualAssetsRepository();
}
