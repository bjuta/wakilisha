#!/usr/bin/env node
// discover-wordpress-tables.mjs
// Run directly on the WordPress Lightsail instance:
//   node discover-wordpress-tables.mjs
//
// Connects to local MySQL, lists ALL tables with columns + row counts,
// and outputs JSON ready for analysis.

import mysql from "mysql2/promise";

const CONFIG = {
  host: "127.0.0.1",
  port: 3306,
  user: "bn_wordpress",
  password: "236407f4e9404d1cd2215f9759d1ddc198d04fa6aaffc7d61fb98f1422c4eb0b",
  database: "bitnami_wordpress",
  connectTimeout: 15000,
};

async function discover() {
  const conn = await mysql.createConnection(CONFIG);
  console.error("[discover] Connected to MySQL. Scanning all tables...\n");

  try {
    // 1. Get ALL table names
    const [tableRows] = await conn.query(
      `SELECT TABLE_NAME FROM information_schema.TABLES WHERE TABLE_SCHEMA = ? ORDER BY TABLE_NAME`,
      [CONFIG.database]
    );
    const tables = tableRows.map((r) => r.TABLE_NAME);

    // 2. For each table, get columns + row count
    const schema = {};
    for (const tableName of tables) {
      try {
        // Columns
        const [colRows] = await conn.query(
          `SELECT COLUMN_NAME, DATA_TYPE, IS_NULLABLE, COLUMN_KEY, EXTRA, COLUMN_DEFAULT, COLUMN_TYPE FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ? ORDER BY ORDINAL_POSITION`,
          [CONFIG.database, tableName]
        );

        // Row count
        const [countRows] = await conn.query(
          `SELECT COUNT(*) AS cnt FROM \`${tableName}\``
        );
        const rowCount = Number(countRows[0]?.cnt ?? 0);

        // Sample first 3 rows (only if rowCount > 0 and not too large)
        let sampleRows = [];
        if (rowCount > 0 && rowCount <= 100000) {
          try {
            const [samples] = await conn.query(
              `SELECT * FROM \`${tableName}\` LIMIT 3`
            );
            sampleRows = samples;
          } catch {
            sampleRows = ["SAMPLE_ERROR"];
          }
        }

        schema[tableName] = {
          row_count: rowCount,
          columns: colRows.map((c) => ({
            name: c.COLUMN_NAME,
            type: c.COLUMN_TYPE || c.DATA_TYPE,
            nullable: c.IS_NULLABLE === "YES",
            key: c.COLUMN_KEY || null,
            extra: c.EXTRA || null,
            default: c.COLUMN_DEFAULT,
          })),
          sample_rows: sampleRows.length > 0 ? sampleRows : null,
        };

        console.error(`  ${tableName}: ${rowCount} rows, ${colRows.length} columns`);
      } catch (err) {
        schema[tableName] = {
          error: err instanceof Error ? err.message : String(err),
          row_count: null,
          columns: [],
        };
        console.error(`  ${tableName}: ERROR - ${err.message}`);
      }
    }

    // 3. Output full JSON
    const output = {
      scanned_at: new Date().toISOString(),
      database: CONFIG.database,
      host: CONFIG.host,
      total_tables: tables.length,
      total_rows: Object.values(schema).reduce((sum, t) => sum + (t.row_count ?? 0), 0),
      tables: schema,
    };

    console.log(JSON.stringify(output, null, 2));
    console.error(`\n[discover] Done. ${tables.length} tables, ${output.total_rows} total rows.`);
  } finally {
    await conn.end();
  }
}

discover().catch((err) => {
  console.error("[discover] FATAL:", err.message);
  process.exit(1);
});