import path from 'node:path';
import { EXPECTED_TABLES, type ExpectedTable } from './config.js';
import { ensureDir, listCsvFiles, readCsvSummary, writeJson, writeText } from './csv.js';
import { detectTable } from './tableSignatures.js';

export type DetectedCsv = {
  detectedTable: ExpectedTable | null;
  fileName: string;
  filePath: string;
  headers: string[];
  rowCount: number;
};

export function auditCsvImport(importDir: string, reportDir: string): DetectedCsv[] {
  const files = listCsvFiles(importDir);
  const detected = files.map((filePath) => {
    const summary = readCsvSummary(filePath);
    return {
      detectedTable: detectTable(summary.headers),
      fileName: summary.fileName,
      filePath: summary.filePath,
      headers: summary.headers,
      rowCount: summary.rowCount
    } satisfies DetectedCsv;
  });

  const found = new Set(detected.flatMap((item) => (item.detectedTable ? [item.detectedTable] : [])));
  const missing = EXPECTED_TABLES.filter((table) => !found.has(table));
  const unknown = detected.filter((item) => !item.detectedTable);

  ensureDir(reportDir);
  writeJson(path.join(reportDir, 'csv-audit.json'), {
    importDir,
    detectedAt: new Date().toISOString(),
    expectedTables: EXPECTED_TABLES,
    foundTables: Array.from(found).sort(),
    missingTables: missing,
    unknownFiles: unknown.map((item) => item.fileName),
    files: detected.map((item) => ({
      table: item.detectedTable,
      fileName: item.fileName,
      rowCount: item.rowCount,
      headers: item.headers
    }))
  });

  const lines = [
    '# WAKILISHA CSV Import Audit',
    '',
    `Import directory: ${importDir}`,
    `Detected at: ${new Date().toISOString()}`,
    '',
    '## Detected files',
    '',
    '| Table | Rows | File |',
    '|---|---:|---|',
    ...detected.map((item) => `| ${item.detectedTable ?? 'UNKNOWN'} | ${item.rowCount} | ${item.fileName} |`),
    '',
    '## Missing expected tables',
    '',
    missing.length ? missing.map((table) => `- ${table}`).join('\n') : 'None.',
    '',
    '## Unknown files',
    '',
    unknown.length ? unknown.map((item) => `- ${item.fileName}`).join('\n') : 'None.',
    ''
  ];

  writeText(path.join(reportDir, 'csv-audit.md'), lines.join('\n'));

  return detected;
}
