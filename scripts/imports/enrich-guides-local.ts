/**
 * enrich-guides-local.ts
 *
 * LOCAL Node.js script — run this directly on the WordPress server.
 *
 * Reads WordPress MySQL wp_posts (wk_field_guide CPT) + postmeta and
 * writes actual guide content into Supabase `guides` table.
 *
 * DRY RUN by default — pass --commit to actually write.
 *
 * USAGE:
 *   ./run-enrich-guides.sh              # dry run
 *   ./run-enrich-guides.sh --commit     # real write
 */

import mysql from "mysql2/promise";
import pg from "pg";
import crypto from "node:crypto";

// ── CLI ────────────────────────────────────────────────────────────────────
function arg(name: string) { const i = process.argv.indexOf(name); return i >= 0 ? process.argv[i + 1] : undefined; }
function hasFlag(name: string) { return process.argv.includes(name); }
function required(v: string | undefined, label: string) { if (!v) throw new Error(`${label} required`); return v; }
function normalizeDbUrl(url: string) { try { const u = new URL(url); u.searchParams.delete("sslmode"); return u.toString(); } catch { return url; } }

const COMMIT = hasFlag("--commit");

const WP = {
  host: arg("--host") ?? process.env.WP_DB_HOST ?? "localhost",
  port: Number(arg("--port") ?? process.env.WP_DB_PORT ?? 3306),
  user: required(arg("--user") ?? process.env.WP_DB_USER, "WP_DB_USER"),
  password: required(arg("--password") ?? process.env.WP_DB_PASSWORD, "WP_DB_PASSWORD"),
  database: required(arg("--database") ?? process.env.WP_DB_NAME, "WP_DB_NAME"),
  prefix: arg("--prefix") ?? process.env.WP_DB_PREFIX ?? "wp_",
  socket: arg("--socket") ?? process.env.WP_DB_SOCKET ?? undefined,
};
const DATABASE_URL = required(process.env.DATABASE_URL, "DATABASE_URL");

// ── Utils ──────────────────────────────────────────────────────────────────
function clean(v: unknown): string { return String(v ?? "").trim(); }
function slugify(s: string): string {
  return s.toLowerCase().normalize("NFKD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 160);
}
function parseDate(v: unknown): string | null {
  if (!v) return null; const s = String(v).trim();
  if (!s || s === "0000-00-00") return null;
  const d = new Date(s); return isNaN(d.getTime()) ? null : d.toISOString();
}
function t(prefix: string, name: string) { return `\`${prefix}${name}\``; }

// WordPress postmeta keys we care about for guide mapping
const POSTMETA_KEYS = [
  "_thumbnail_id",
  "dek",
  "download_url",
  "download_label",
  "downloadables",
  "pillar",
  "guide_format",
  "color_var",
  "icon",
  "framing",
  "subtitle",
  "hero_url",
];

// Fields that go into metadata jsonb vs top-level columns
const METADATA_KEYS = new Set(["pillar", "guide_format", "color_var", "icon", "framing", "wp_post_type"]);

// ── Stats ──────────────────────────────────────────────────────────────────
const stats = { wpGuides: 0, guidesUpserted: 0, skipped: 0, errors: 0 };

const BATCH = 100;

async function batchUpsert(pool: pg.Pool, table: string, rows: Record<string,unknown>[], conflict: string) {
  if (rows.length === 0) return;
  const cols = Object.keys(rows[0]);
  const colList = cols.map(c => `"${c}"`).join(", ");
  for (let i = 0; i < rows.length; i += BATCH) {
    const batch = rows.slice(i, i + BATCH);
    const vals: unknown[] = [];
    const groups = batch.map((row, ri) => {
      const base = ri * cols.length;
      cols.forEach(c => vals.push(row[c] ?? null));
      return `(${cols.map((_, j) => `$${base + j + 1}`).join(", ")})`;
    });
    const setClause = cols.filter(c => c !== conflict && c !== "id").map(c => `"${c}" = EXCLUDED."${c}"`).join(", ");
    await pool.query(`INSERT INTO "${table}" (${colList}) VALUES ${groups.join(", ")} ON CONFLICT ("${conflict}") DO UPDATE SET ${setClause}`, vals);
  }
}

// ── Main ───────────────────────────────────────────────────────────────────
async function main() {
  console.log("═══════════════════════════════════════════════════════");
  console.log("  Wakilisha Guide Content Enrichment (LOCAL)");
  console.log("═══════════════════════════════════════════════════════");
  console.log(`  Mode:       ${COMMIT ? "COMMIT" : "DRY RUN"}`);
  console.log(`  WP MySQL:   ${WP.user}@${WP.socket ? `socket:${WP.socket}` : `${WP.host}:${WP.port}`}/${WP.database}`);
  console.log("═══════════════════════════════════════════════════════\n");

  const wpConn: Record<string,unknown> = { user: WP.user, password: WP.password, database: WP.database, connectTimeout: 20000 };
  if (WP.socket) {
    wpConn.socketPath = WP.socket;
  } else {
    wpConn.host = WP.host;
    wpConn.port = WP.port;
  }
  const wp = await mysql.createConnection(wpConn);
  await wp.ping();
  console.log(`[enrich] Connected to WordPress MySQL${WP.socket ? ` via socket ${WP.socket}` : ""}`);

  const pool = new pg.Pool({ connectionString: normalizeDbUrl(DATABASE_URL), ssl: { rejectUnauthorized: false }, max: 4 });

  try {
    // ════════════════════════════════════════════════════════════════════
    // 1. Load all WP guides (wk_field_guide CPT)
    // ════════════════════════════════════════════════════════════════════
    const [guideRows] = await wp.query(
      `SELECT ID, post_author, post_date, post_date_gmt, post_content, post_title, post_excerpt, post_status, post_name, post_modified, post_modified_gmt, guid FROM ${t(WP.prefix, "posts")} WHERE post_type = 'wk_field_guide' AND post_status = 'publish' ORDER BY post_date DESC`
    );
    const wpGuides = guideRows as Record<string,unknown>[];
    stats.wpGuides = wpGuides.length;
    console.log(`[enrich] WP guides (published): ${wpGuides.length}`);

    if (wpGuides.length === 0) {
      console.log("[enrich] No published wk_field_guide posts found. Nothing to do.");
      return;
    }

    // ════════════════════════════════════════════════════════════════════
    // 2. Load existing guides from Supabase for slug dedup
    // ════════════════════════════════════════════════════════════════════
    const existRes = await pool.query(`SELECT id, slug, source_wp_post_id FROM guides`);
    const existBySlug = new Map<string, string>();
    const existByWpId = new Map<number, string>();
    for (const r of existRes.rows) {
      existBySlug.set(String(r.slug), String(r.id));
      if (r.source_wp_post_id) existByWpId.set(Number(r.source_wp_post_id), String(r.id));
    }
    const seenSlugs = new Set(existBySlug.keys());

    // ════════════════════════════════════════════════════════════════════
    // 3. Batch-load all attachment URLs (for _thumbnail_id resolution)
    // ════════════════════════════════════════════════════════════════════
    const attachMap = new Map<number, string>();
    const [attachRows] = await wp.query(
      `SELECT ID, guid FROM ${t(WP.prefix, "posts")} WHERE post_type = 'attachment'`
    );
    for (const a of attachRows as Record<string,unknown>[]) {
      attachMap.set(Number(a.ID), clean(a.guid));
    }

    // ════════════════════════════════════════════════════════════════════
    // 4. Batch-load all postmeta for wk_field_guide posts
    // ════════════════════════════════════════════════════════════════════
    const guideIds = wpGuides.map(g => Number(g.ID));
    const metaByPost = new Map<number, Record<string,string>>();
    // Process in chunks to avoid MySQL max_allowed_packet issues
    const META_CHUNK = 500;
    for (let i = 0; i < guideIds.length; i += META_CHUNK) {
      const chunk = guideIds.slice(i, i + META_CHUNK);
      const placeholders = chunk.map(() => "?").join(",");
      const [metaRows] = await wp.query(
        `SELECT post_id, meta_key, meta_value FROM ${t(WP.prefix, "postmeta")} WHERE post_id IN (${placeholders}) AND meta_key IN (${POSTMETA_KEYS.map(() => "?").join(",")})`,
        [...chunk, ...POSTMETA_KEYS]
      );
      for (const m of metaRows as Record<string,unknown>[]) {
        const pid = Number(m.post_id);
        if (!metaByPost.has(pid)) metaByPost.set(pid, {});
        metaByPost.get(pid)![clean(m.meta_key)] = clean(m.meta_value);
      }
    }

    // ════════════════════════════════════════════════════════════════════
    // 5. Map guides and build rows
    // ════════════════════════════════════════════════════════════════════
    const guideTableRows: Record<string,unknown>[] = [];

    for (const wpGuide of wpGuides) {
      const wpId = Number(wpGuide.ID);
      const rawTitle = clean(wpGuide.post_title);
      const wpSlug = clean(wpGuide.post_name) || slugify(rawTitle);
      const meta = metaByPost.get(wpId) ?? {};

      // Check if already imported
      if (existByWpId.has(wpId)) {
        stats.skipped++;
        continue;
      }

      let guideId: string;
      if (existBySlug.has(wpSlug)) {
        guideId = existBySlug.get(wpSlug)!;
      } else {
        guideId = crypto.randomUUID();
        seenSlugs.add(wpSlug);
      }

      // Resolve hero image: meta hero_url > _thumbnail_id > attachment guid
      let heroUrl: string | null = null;
      if (meta["hero_url"]) {
        heroUrl = meta["hero_url"];
      } else if (meta["_thumbnail_id"]) {
        const thumbId = Number(meta["_thumbnail_id"]);
        heroUrl = attachMap.get(thumbId) ?? null;
      }

      // Parse downloadables if present
      let downloadables: unknown = [];
      if (meta["downloadables"]) {
        try { downloadables = JSON.parse(meta["downloadables"]); } catch { downloadables = []; }
      }

      // Build metadata
      const metadataObj: Record<string,unknown> = { post_type: "wk_field_guide" };
      for (const [key, val] of Object.entries(meta)) {
        if (METADATA_KEYS.has(key)) metadataObj[key] = val;
      }

      guideTableRows.push({
        id: guideId,
        source_wp_post_id: wpId,
        slug: wpSlug,
        title: rawTitle,
        excerpt: clean(wpGuide.post_excerpt) || meta["dek"] || null,
        dek: meta["dek"] || null,
        content: clean(wpGuide.post_content) || null,
        hero_url: heroUrl,
        download_url: meta["download_url"] || null,
        download_label: meta["download_label"] || null,
        downloadables: JSON.stringify(downloadables),
        status: "published",
        published_at: parseDate(wpGuide.post_date_gmt || wpGuide.post_date),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        metadata: JSON.stringify(metadataObj),
      });
    }

    stats.guidesUpserted = guideTableRows.length;

    console.log(`\n[enrich] Guides to upsert:    ${guideTableRows.length}`);
    console.log(`[enrich] Already imported:    ${stats.skipped}`);

    // ════════════════════════════════════════════════════════════════════
    // 6. COMMIT
    // ════════════════════════════════════════════════════════════════════
    if (COMMIT) {
      console.log("\n── Writing to Supabase ──");
      if (guideTableRows.length > 0) {
        console.log(`[enrich] Upserting ${guideTableRows.length} guides into 'guides' table...`);
        await batchUpsert(pool, "guides", guideTableRows, "slug");
      }
      console.log("\n✓ COMMIT COMPLETE");
    } else {
      console.log("\n── DRY RUN (no writes) ──");
      if (guideTableRows.length > 0) {
        console.log("  Sample guides that would be imported:");
        for (const g of guideTableRows.slice(0, 5)) {
          console.log(`    • ${g.slug} — "${g.title}"`);
        }
      }
      console.log("  Pass --commit to write to Supabase.");
    }

    // ════════════════════════════════════════════════════════════════════
    // 7. Summary
    // ════════════════════════════════════════════════════════════════════
    console.log("\n═══════════════════════════════════════════════════════");
    console.log("  SUMMARY");
    console.log("═══════════════════════════════════════════════════════");
    console.log(`  WP guides (published):   ${stats.wpGuides}`);
    console.log(`  ─────────────────────────────────────────`);
    console.log(`  Guides ${COMMIT ? "inserted" : "to insert"}:     ${stats.guidesUpserted}`);
    console.log(`  Already imported:        ${stats.skipped}`);
    console.log(`  Errors:                  ${stats.errors}`);
    console.log("═══════════════════════════════════════════════════════");
  } finally {
    await wp.end();
    await pool.end();
  }
}

main().catch(e => { console.error("\n[enrich] FATAL:", e instanceof Error ? e.message : String(e)); process.exit(1); });