import { DEFAULT_IMPORT_DIR, DEFAULT_REPORT_DIR } from './config.js';
import { auditCsvImport } from './audit.js';
import { buildGraphReports } from './graph.js';
import { buildSlugMapReports } from './slugMap.js';

const command = process.argv[2] ?? 'audit';
const importDir = process.env.WAKILISHA_IMPORT_DIR ?? DEFAULT_IMPORT_DIR;
const reportDir = process.env.WAKILISHA_REPORT_DIR ?? DEFAULT_REPORT_DIR;

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

  throw new Error(`Unknown command: ${command}. Use "audit", "graph", or "routes".`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
