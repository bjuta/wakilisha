import fs from 'node:fs';
import path from 'node:path';
import { parse } from 'csv-parse/sync';

export type CsvFileSummary = {
  filePath: string;
  fileName: string;
  headers: string[];
  rowCount: number;
};

export type CsvRows = Record<string, string>[];

export function listCsvFiles(importDir: string): string[] {
  if (!fs.existsSync(importDir)) {
    throw new Error(`CSV import directory not found: ${importDir}`);
  }

  return fs
    .readdirSync(importDir)
    .filter((file) => file.toLowerCase().endsWith('.csv'))
    .map((file) => path.join(importDir, file))
    .sort();
}

export function readCsvSummary(filePath: string): CsvFileSummary {
  const content = fs.readFileSync(filePath, 'utf8');
  const rows = parse(content, {
    bom: true,
    columns: false,
    skip_empty_lines: true,
    relax_column_count: true
  }) as string[][];

  const headers = rows[0] ?? [];
  return {
    filePath,
    fileName: path.basename(filePath),
    headers,
    rowCount: Math.max(rows.length - 1, 0)
  };
}

export function readCsvRows(filePath: string): CsvRows {
  const content = fs.readFileSync(filePath, 'utf8');
  return parse(content, {
    bom: true,
    columns: true,
    skip_empty_lines: true,
    relax_column_count: true,
    relax_quotes: true
  }) as CsvRows;
}

export function ensureDir(dir: string): void {
  fs.mkdirSync(dir, { recursive: true });
}

export function writeJson(filePath: string, data: unknown): void {
  ensureDir(path.dirname(filePath));
  fs.writeFileSync(filePath, `${JSON.stringify(data, null, 2)}\n`, 'utf8');
}

export function writeText(filePath: string, content: string): void {
  ensureDir(path.dirname(filePath));
  fs.writeFileSync(filePath, content, 'utf8');
}
