#!/usr/bin/env node
// Single-statement, managed read-only source acquisition for governed SEO.
// This is a source fingerprint, NEVER a publication or deployment receipt.
// The SQL runs through an independently authenticated READ ONLY SQL facility.
// No source row contents are returned by the generated SQL.
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { PROJECT, SURFACES, DEFINITIONS, staticEvidence, stableJson } from "./collect-governed-publication-source.mjs";

const ORIGIN = "https://wakilisha.africa";
const FORMAT = "pg-jsonb-row-sha256-v2";
const MAX_PER_TABLE = 20000;
const MAX_TOTAL = 100000;
const EXPECTED_ROLE = "supabase_read_only_user";
const HEX = /^[a-f0-9]{64}$/;

function fail(reason) { throw new Error("[governed-managed-source] " + reason); }
function sha(bytes) { return crypto.createHash("sha256").update(bytes).digest("hex"); }
function identifier(value) {
  if (!/^[a-z][a-z0-9_]*$/.test(value)) fail("Unsafe reviewed SQL identifier");
  return '"' + value + '"';
}
function tableName(def) { return identifier(def.schema) + "." + identifier(def.table); }

function managedSourceSql() {
  const fragments = [];
  const payloads = [];
  for (const [idx, def] of DEFINITIONS.entries()) {
    const alias = "source_" + idx;
    const cols = def.columns.map(identifier).join(", ");
    const order = def.key.map(key => "record." + identifier(key)).join(", ");
    const selectOrder = def.key.map(identifier).join(", ");
    const unique = def.key.map(key => "record." + identifier(key)).join(", ");
    const target = tableName(def);
    fragments.push(`${alias} AS (
  SELECT count(*)::int AS row_count,
         count(DISTINCT (${unique}))::int AS unique_count,
         encode(extensions.digest(convert_to(
           coalesce(string_agg(encode(extensions.digest(convert_to(to_jsonb(record)::text, 'UTF8'), 'sha256'),'hex'), E'\\n' ORDER BY ${order}), ''),
           'UTF8'), 'sha256'),'hex') AS content_digest
  FROM (SELECT ${cols} FROM ${target} ORDER BY ${selectOrder} LIMIT ${MAX_PER_TABLE + 1}) AS record
)`);
    const permissions = ["SELECT","INSERT","UPDATE","DELETE","TRUNCATE"];
    const p = permissions.map(op => `'${op.toLowerCase()}', has_table_privilege(current_user, '${def.schema}.${def.table}', '${op}')`).join(", ");
    payloads.push(`jsonb_build_object('name','${def.name}','table','${def.schema}.${def.table}','rowCount',${alias}.row_count,'uniqueCount',${alias}.unique_count,'digest',${alias}.content_digest,'privileges',jsonb_build_object(${p}))`);
  }
  const joins = DEFINITIONS.map((_,i)=>"source_"+i).join(" CROSS JOIN ");
  // One SELECT, one snapshot. Never embed service credentials or row contents.
  return `/* WAKILISHA governed SEO source fingerprint. READ ONLY, single statement.
   Generated from the exact 40-table reviewed source allowlist.
   Protocol ${FORMAT}; output contains digests, row counts and role checks only.
   Run under the approved managed SQL read-only execution class. */
WITH ${fragments.join(",\n")}
SELECT jsonb_build_object(
  'protocol','${FORMAT}',
  'projectRef','${PROJECT}',
  'role',current_user,
  'transactionReadOnly',current_setting('transaction_read_only'),
  'isolation',current_setting('transaction_isolation'),
  'capturedAt',to_char(statement_timestamp() AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
  'transactionSnapshot',txid_current_snapshot()::text,
  'roleFlags',(SELECT jsonb_build_object('superuser',rolsuper,'bypassRls',rolbypassrls,
     'createRole',rolcreaterole,'createDb',rolcreatedb,'replication',rolreplication)
     FROM pg_roles WHERE rolname=current_user),
  'tables',jsonb_build_array(${payloads.join(",\n    ")})
) AS evidence
FROM ${joins};
`;
}

function verifyManagedEvidence(raw, repositoryRoot) {
  let record = raw;
  if (Array.isArray(record)) {
    if (record.length !== 1) fail("Expected one managed SQL result row");
    record = record[0];
  }
  if (record?.result && !record.evidence) record = record.result;
  if (record?.evidence) record = record.evidence;
  if (typeof record === "string") {
    try { record = JSON.parse(record); } catch { fail("Managed result is not JSON"); }
  }
  if (!record || typeof record !== "object" || Array.isArray(record)) fail("Managed result must be an object");
  if (record.protocol !== FORMAT || record.projectRef !== PROJECT ||
      record.role !== EXPECTED_ROLE || record.transactionReadOnly !== "on") {
    fail("Untrusted managed SQL protocol, role, project or read-only status");
  }
  const flags = record.roleFlags;
  if (!flags || flags.superuser !== false || flags.bypassRls !== true ||
      flags.createRole !== false || flags.createDb !== false || flags.replication !== false) {
    fail("Managed SQL role lacks approved complete, non-mutating authority");
  }
  if (!Array.isArray(record.tables) || record.tables.length !== DEFINITIONS.length) fail("Incomplete managed source table set");
  if (typeof record.capturedAt !== "string" ||
      !/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/.test(record.capturedAt) ||
      !Number.isFinite(Date.parse(record.capturedAt)) ||
      typeof record.transactionSnapshot !== "string" || !record.transactionSnapshot) {
    fail("Invalid managed source snapshot receipt");
  }
  const tables = {};
  let total = 0;
  for (const [idx, def] of DEFINITIONS.entries()) {
    const row = record.tables[idx];
    const privileges = row?.privileges;
    if (!row || row.name !== def.name || row.table !== def.schema+"."+def.table ||
        !Number.isSafeInteger(row.rowCount) || row.rowCount < 0 || row.rowCount > MAX_PER_TABLE ||
        row.uniqueCount !== row.rowCount || typeof row.digest !== "string" || !HEX.test(row.digest) ||
        !privileges || privileges.select !== true || privileges.insert !== false ||
        privileges.update !== false || privileges.delete !== false || privileges.truncate !== false) {
      fail("Missing, over-budget, nonunique or writable managed source: " + def.name);
    }
    total += row.rowCount;
    tables[def.name] = {rowCount:row.rowCount,digest:row.digest};
  }
  if (total > MAX_TOTAL) fail("Managed source exceeds global row budget");

  const root = fs.realpathSync(repositoryRoot);
  const staticFiles = staticEvidence(root);
  const surfaces = {};
  for (const surface of SURFACES) {
    const refs = DEFINITIONS.filter(d=>d.surfaces.includes(surface))
      .map(d=>({table:d.schema+"."+d.table,...tables[d.name]}));
    if (["static","briefings","taxonomy"].includes(surface))
      refs.push({table:"repository.static-SEO-authority",...staticFiles});
    surfaces[surface] = {
      rowCount:refs.reduce((n,x)=>n+x.rowCount,0),
      digest:sha(stableJson(refs)),
      tableCount:refs.length,
    };
  }
  const sourceEpoch = sha(stableJson({protocol:FORMAT,project:PROJECT,surfaces}));
  return {
    format:1,kind:"wakilisha-governed-source-scan",origin:ORIGIN,projectRef:PROJECT,
    protocol:FORMAT,readOnly:true,isolation:"single-managed-readonly-statement",
    databaseRole:EXPECTED_ROLE,transactionSnapshot:record.transactionSnapshot,
    sourceEpoch,capturedAt:record.capturedAt,tables,surfaces,static:staticFiles,
    querySha256:sha(managedSourceSql()),queryCount:1,rowCount:total,
    completeAllowlistScan:true,sourceAuthorityCoverage:"review-required",
    publicationReceipt:false,publicationActivationAuthority:false,
  };
}

function validateReplay(first, second) {
  if (!first || !second || first.protocol !== FORMAT || second.protocol !== FORMAT ||
      first.publicationActivationAuthority !== false || second.publicationActivationAuthority !== false ||
      first.completeAllowlistScan !== true || second.completeAllowlistScan !== true ||
      first.databaseRole !== EXPECTED_ROLE || second.databaseRole !== EXPECTED_ROLE ||
      first.projectRef !== PROJECT || second.projectRef !== PROJECT ||
      first.querySha256 !== sha(managedSourceSql()) ||
      second.querySha256 !== sha(managedSourceSql())) {
    fail("Untrusted replay provenance or source query");
  }
  for (const item of [first, second]) {
    if (!Number.isSafeInteger(item.rowCount) || item.rowCount < 0 || item.rowCount > MAX_TOTAL ||
        !item.readOnly || item.isolation !== "single-managed-readonly-statement" ||
        typeof item.capturedAt !== "string" || !Number.isFinite(Date.parse(item.capturedAt)) ||
        !item.tables || Object.keys(item.tables).length !== DEFINITIONS.length ||
        !item.surfaces || Object.keys(item.surfaces).length !== SURFACES.length ||
        !HEX.test(item.sourceEpoch || "")) {
      fail("Incomplete managed replay evidence");
    }
  }
  const elapsed = Date.parse(second.capturedAt) - Date.parse(first.capturedAt);
  if (elapsed < 0 || elapsed > 15 * 60 * 1000)
    fail("Managed source replays are reversed or too far apart");
  if (first.sourceEpoch !== second.sourceEpoch ||
      stableJson(first.tables) !== stableJson(second.tables) ||
      stableJson(first.surfaces) !== stableJson(second.surfaces) ||
      stableJson(first.static) !== stableJson(second.static)) {
    fail("Managed source state changed during replay");
  }
  return {sourceEpoch:second.sourceEpoch,rows:second.rowCount,replayIntervalMs:elapsed,publicationActivationAuthority:false};
}

function writeExclusive(file, value) {
  if (!path.isAbsolute(file) || path.extname(file) !== ".json" && path.extname(file) !== ".sql")
    fail("Evidence output requires absolute .json or .sql path");
  const dir = fs.realpathSync(path.dirname(file));
  const target = path.join(dir,path.basename(file));
  if (fs.existsSync(target)) fail("Refusing to overwrite evidence: " + target);
  fs.writeFileSync(target,value,{flag:"wx",mode:0o600});
  return sha(value);
}

function main() {
  if (process.env.CI || process.env.GITHUB_ACTIONS)
    fail("Managed source execution/capture is forbidden in CI");
  const action = process.argv[2];
  if (action === "--emit-sql" && process.argv.length === 4) {
    const digest = writeExclusive(process.argv[3],managedSourceSql());
    console.log("MANAGED_SOURCE_SQL_SHA256="+digest);
    console.log("MANAGED_SOURCE_STATEMENTS=1");
    console.log("MANAGED_SOURCE_PRODUCTION_MUTATIONS=0");
    return;
  }
  if (action === "--verify-result" && process.argv.length === 6) {
    const [sqlPath, resultPath, outputPath] = process.argv.slice(3);
    if (!fs.existsSync(sqlPath) || sha(fs.readFileSync(sqlPath)) !== sha(managedSourceSql()))
      fail("SQL source changed after independent approval");
    const resultText = fs.readFileSync(resultPath,"utf8");
    if (Buffer.byteLength(resultText,"utf8") > 1024 * 1024)
      fail("Unexpected raw/private data in managed result");
    let result;
    try { result = JSON.parse(resultText); } catch { fail("Invalid managed JSON result"); }
    const evidence = verifyManagedEvidence(result,process.cwd());
    // Static files must still be the source exact revision when evidence is persisted.
    if (evidence.static.digest !== staticEvidence(fs.realpathSync(process.cwd())).digest)
      fail("Static SEO sources changed during managed verification");
    const digest = writeExclusive(outputPath,JSON.stringify(evidence,null,2)+"\n");
    console.log("MANAGED_SOURCE_SCAN_SHA256="+digest);
    console.log("MANAGED_SOURCE_EPOCH="+evidence.sourceEpoch);
    console.log("MANAGED_SOURCE_ROWS="+evidence.rowCount);
    console.log("PUBLICATION_ACTIVATION_AUTHORITY=NONE");
    return;
  }
  if (action === "--verify-replay" && process.argv.length === 5) {
    const files = process.argv.slice(3);
    const expected = [
      process.env.WAKILISHA_MANAGED_SOURCE_FIRST_SHA256,
      process.env.WAKILISHA_MANAGED_SOURCE_SECOND_SHA256,
    ];
    const scans = files.map((file, idx) => {
      if (!path.isAbsolute(file) || !HEX.test(expected[idx] || ""))
        fail("Replay requires absolute filenames and two independently pinned SHA-256 values");
      const data = fs.readFileSync(file);
      if (sha(data) !== expected[idx]) fail("Managed source replay SHA-256 mismatch");
      try {return JSON.parse(data.toString("utf8"));} catch {fail("Unparseable managed source replay");}
    });
    const evidence = validateReplay(scans[0], scans[1]);
    console.log("MANAGED_SOURCE_EPOCH_REPLAY=PASS");
    console.log("MANAGED_SOURCE_EPOCH="+evidence.sourceEpoch);
    console.log("MANAGED_SOURCE_ROWS="+evidence.rows);
    console.log("PUBLICATION_ACTIVATION_AUTHORITY=NONE");
    return;
  }
  fail("Use --emit-sql /absolute/query.sql or --verify-replay FIRST.json SECOND.json or --verify-result /absolute/query.sql /absolute/result.json /absolute/scan.json");
}
export {FORMAT,managedSourceSql,verifyManagedEvidence,validateReplay};
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {main();} catch(error) {console.error(error instanceof Error?error.message:String(error)); process.exitCode=1;}
}
