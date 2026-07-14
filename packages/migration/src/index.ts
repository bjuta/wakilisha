import path from 'node:path';
import { DEFAULT_IMPORT_DIR, DEFAULT_REPORT_DIR } from './config.js';
import { auditCsvImport } from './audit.js';
import { buildGraphReports } from './graph.js';
import { buildSlugMapReports } from './slugMap.js';
import { runFullRepair } from './repair.js';
import { generateSeedSql } from './db.js';
import { listCsvFiles, readCsvRows, readCsvSummary } from './csv.js';
import { detectTable } from './tableSignatures.js';
import type { ExpectedTable } from './config.js';

const command = process.argv[2] ?? 'audit';
const importDir = process.env.WAKILISHA_IMPORT_DIR ?? DEFAULT_IMPORT_DIR;
const reportDir = process.env.WAKILISHA_REPORT_DIR ?? DEFAULT_REPORT_DIR;

function loadTables(importDir: string): Partial<Record<ExpectedTable, Record<string, string>[]>> {
  const tables: Partial<Record<ExpectedTable, Record<string, string>[]>> = {};
  for (const filePath of listCsvFiles(importDir)) {
    const summary = readCsvSummary(filePath);
    const table = detectTable(summary.headers);
    if (!table) continue;
    tables[table] = readCsvRows(filePath);
  }
  return tables;
}

async function main() {
  if (command === 'audit') {
    const detected = auditCsvImport(importDir, reportDir);
    console.log(`CSV audit complete. Files detected: ${detected.length}`);
    console.log(`Reports written to: ${reportDir}`);
    return;
  }

  if (command === 'graph') {
    auditCsvImport(importDir, reportDir);
    const coverage = buildGraphReports(importDir, reportDir);
    console.log('Relationship graph first pass complete.');
    console.log(JSON.stringify(coverage.counts, null, 2));
    console.log(`Reports written to: ${reportDir}`);
    return;
  }

  if (command === 'routes') {
    auditCsvImport(importDir, reportDir);
    const coverage = buildSlugMapReports(importDir, reportDir);
    console.log('Route and slug map complete.');
    console.log(JSON.stringify(coverage.counts, null, 2));
    console.log(`Reports written to: ${reportDir}`);
    return;
  }

  if (command === 'repair') {
    auditCsvImport(importDir, reportDir);
    const tables = loadTables(importDir);
    const report = runFullRepair(tables, reportDir);
    console.log('Full repair pass complete.');
    console.log('');
    console.log('=== Acceptance Gate ===');
    console.log(JSON.stringify(report.acceptanceGate, null, 2));
    console.log('');
    console.log('=== Relationship Counts ===');
    console.log(JSON.stringify(report.counts, null, 2));
    console.log('');
    console.log(`Reports written to: ${reportDir}`);
    return;
  }

  if (command === 'seed') {
    const outputDir = process.env.WAKILISHA_SEED_DIR ?? path.join(process.cwd(), 'archive', 'legacy-migrations', 'generated');
    const seedPath = generateSeedSql(reportDir, outputDir);
    console.log(`Seed SQL generated: ${seedPath}`);
    return;
  }

  throw new Error(`Unknown command: ${command}. Use "audit", "graph", "routes", "repair", or "seed".`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
