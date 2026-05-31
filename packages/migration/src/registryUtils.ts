import { readCsvRows, readCsvSummary, listCsvFiles } from './csv.js';
import { detectTable } from './tableSignatures.js';
import type { ExpectedTable } from './config.js';

export type Row = Record<string, string>;
export type Tables = Partial<Record<ExpectedTable, Row[]>>;

export function slugify(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function clean(value: unknown): string | null {
  const next = String(value ?? '').trim();
  return next.length ? next : null;
}

export function numberOrNull(value: unknown): number | null {
  const next = clean(value);
  if (!next) return null;
  const parsed = Number(next.replace(/,/g, ''));
  return Number.isFinite(parsed) ? parsed : null;
}

export function first(row: Row, keys: string[]): string | null {
  const lower = Object.fromEntries(Object.entries(row).map(([key, value]) => [key.toLowerCase(), value]));
  for (const key of keys) {
    const direct = clean(row[key]);
    if (direct) return direct;
    const loose = clean(lower[key.toLowerCase()]);
    if (loose) return loose;
  }
  return null;
}

export function list(value: string | null): string[] {
  if (!value) return [];
  return value.split(/[,|;]+/).map((item) => item.trim()).filter(Boolean);
}

export function addUnique(target: string[] | undefined, value: string | null | undefined): void {
  if (target && value && !target.includes(value)) target.push(value);
}

export function rowId(row: Row, fallbackPrefix: string, index: number): string {
  return first(row, ['id', 'post_id', 'term_id', 'entity_id', 'track_id', 'release_id', 'label_id', 'chart_entry_id']) ?? `${fallbackPrefix}-${index + 1}`;
}

export function rowName(row: Row): string | null {
  return first(row, ['name', 'title', 'post_title', 'entity_name', 'track_title', 'release_title', 'label_name', 'genre_name', 'artist_name']);
}

export function rowSlug(row: Row, fallback: string, prefix: string): string {
  return (first(row, ['slug', 'post_name', 'permalink_slug', 'old_slug', 'canonical_slug']) ?? slugify(fallback)) || `${prefix}-${Date.now()}`;
}

export function rowImage(row: Row): string | null {
  return first(row, ['image', 'image_url', 'imageUrl', 'artwork', 'artwork_url', 'cover_url', 'thumbnail', 'thumbnail_url', 'media_url', 'url']);
}

export function loadDetectedTables(importDir: string): Tables {
  const tables: Tables = {};
  for (const filePath of listCsvFiles(importDir)) {
    const summary = readCsvSummary(filePath);
    const table = detectTable(summary.headers);
    if (table) tables[table] = readCsvRows(filePath);
  }
  return tables;
}
