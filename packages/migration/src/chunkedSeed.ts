import fs from 'node:fs';
import path from 'node:path';
import { DEFAULT_REPORT_DIR } from './config.js';
import { ensureDir } from './csv.js';

const reportDir = process.env.WAKILISHA_REPORT_DIR ?? DEFAULT_REPORT_DIR;
const outputDir = process.env.WAKILISHA_CHUNKED_SEED_DIR ?? path.join(process.cwd(), 'packages', 'db', 'migrations', 'seed_chunks');
const chunkSize = Number(process.env.WAKILISHA_SEED_CHUNK_SIZE ?? 1000);
const schema = 'wakilisha_repaired';

type JsonRow = Record<string, unknown>;

type SeedSpec = {
  sourceFile: string;
  table: string;
  columns: string[];
  map: (row: JsonRow) => unknown[];
};

function escapeSql(value: unknown): string {
  if (value === null || value === undefined || value === '') return 'null';
  if (typeof value === 'number') return Number.isFinite(value) ? String(value) : 'null';
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  return `'${String(value).replace(/'/g, "''")}'`;
}

function jsonb(value: unknown): unknown {
  if (value === null || value === undefined || value === '') return null;
  return JSON.stringify(value);
}

function readRows(fileName: string): JsonRow[] {
  const filePath = path.join(reportDir, fileName);
  if (!fs.existsSync(filePath)) return [];
  return JSON.parse(fs.readFileSync(filePath, 'utf8')) as JsonRow[];
}

function cleanOutputDir(dir: string): void {
  ensureDir(dir);
  for (const file of fs.readdirSync(dir)) {
    if (file.endsWith('.sql') || file.endsWith('.md')) fs.rmSync(path.join(dir, file));
  }
}

function writeChunk(spec: SeedSpec, rows: JsonRow[], part: number, partRows: JsonRow[]): string {
  const fileName = `${String(part).padStart(3, '0')}_${spec.table}.sql`;
  const filePath = path.join(outputDir, fileName);
  const values = partRows.map((row) => `  (${spec.map(row).map(escapeSql).join(', ')})`).join(',\n');
  const sql = [
    '-- WAKILISHA chunked seed export',
    `-- Table: ${schema}.${spec.table}`,
    `-- Source: ${spec.sourceFile}`,
    `-- Rows in this chunk: ${partRows.length}`,
    `-- Total source rows: ${rows.length}`,
    '',
    `insert into ${schema}.${spec.table} (${spec.columns.join(', ')}) values`,
    values,
    'on conflict do nothing;',
    ''
  ].join('\n');
  fs.writeFileSync(filePath, sql, 'utf8');
  return fileName;
}

function writeSpec(spec: SeedSpec, startPart: number): { nextPart: number; files: string[]; rows: number } {
  const rows = readRows(spec.sourceFile);
  const files: string[] = [];
  let part = startPart;
  for (let offset = 0; offset < rows.length; offset += chunkSize) {
    files.push(writeChunk(spec, rows, part, rows.slice(offset, offset + chunkSize)));
    part += 1;
  }
  return { nextPart: part, files, rows: rows.length };
}

const specs: SeedSpec[] = [
  {
    sourceFile: 'entity-slugs.full.json',
    table: 'entity_slugs',
    columns: ['entity_type', 'entity_id', 'slug', 'full_path', 'status', 'is_primary', 'legacy_path', 'source', 'needs_review', 'review_reason'],
    map: (row) => [row.entity_type, row.entity_id, row.slug, row.full_path, row.status ?? 'active', row.is_primary === true, row.legacy_path, row.source, row.needs_review === true, row.review_reason]
  },
  {
    sourceFile: 'entity-relationships.full.json',
    table: 'entity_relationships',
    columns: ['source_entity_type', 'source_entity_id', 'relationship_type', 'target_entity_type', 'target_entity_id', 'position', 'role', 'confidence', 'source', 'source_payload', 'needs_review', 'review_reason'],
    map: (row) => [row.sourceEntityType, row.sourceEntityId, row.relationshipType, row.targetEntityType, row.targetEntityId, row.position, row.role, row.confidence ?? 0.5, row.source, jsonb(row.sourcePayload ?? row.source_payload), row.needsReview === true, row.reviewReason ?? row.review_reason]
  },
  {
    sourceFile: 'track-artists.seed.json',
    table: 'track_artists',
    columns: ['track_id', 'artist_id', 'artist_name_snapshot', 'role', 'position', 'source', 'confidence', 'needs_review', 'review_reason'],
    map: (row) => [row.track_id, row.artist_id, row.artist_name_snapshot, row.role ?? 'primary', row.position, row.source, row.confidence ?? 0.5, row.needs_review === true, row.review_reason]
  },
  {
    sourceFile: 'release-tracks.seed.json',
    table: 'release_tracks',
    columns: ['release_id', 'track_id', 'disc_number', 'track_number', 'title_snapshot', 'artist_snapshot', 'source', 'confidence', 'needs_review', 'review_reason'],
    map: (row) => [row.release_id, row.track_id, row.disc_number, row.track_number, row.title_snapshot, row.artist_snapshot, row.source, row.confidence ?? 0.5, row.needs_review === true, row.review_reason]
  },
  {
    sourceFile: 'artist-genres.seed.json',
    table: 'artist_genres',
    columns: ['artist_id', 'genre_id', 'source', 'confidence', 'needs_review', 'review_reason'],
    map: (row) => [row.artist_id, row.genre_id, row.source, row.confidence ?? 0.5, row.needs_review === true, row.review_reason]
  },
  {
    sourceFile: 'track-playback-sources.full.json',
    table: 'track_playback_sources',
    columns: ['track_id', 'provider', 'provider_track_id', 'isrc', 'preview_url', 'duration_ms', 'artwork_url', 'source_url', 'source_ref', 'source_payload', 'confidence', 'needs_review', 'review_reason'],
    map: (row) => [row.track_id, row.provider, row.provider_track_id, row.isrc, row.preview_url, row.duration_ms, row.artwork_url, row.source_url, row.source_ref, jsonb(row.source_payload), row.confidence ?? 0.5, row.needs_review === true, row.review_reason]
  },
  {
    sourceFile: 'content-classification.json',
    table: 'content_route_classification',
    columns: ['legacy_wp_post_id', 'legacy_post_type', 'slug', 'title', 'classification', 'react_route', 'migration_action', 'needs_review', 'review_reason', 'source_payload'],
    map: (row) => [row.legacy_wp_post_id, row.legacy_post_type, row.slug, row.title, row.classification, row.react_route, row.migration_action, row.needs_review === true, row.review_reason, jsonb(row.source_payload)]
  },
  {
    sourceFile: 'relationship-review-queue.full.json',
    table: 'review_queue',
    columns: ['entity_type', 'entity_id', 'label', 'issue', 'source', 'confidence', 'recommendation', 'status'],
    map: (row) => [row.entityType, row.entityId, row.label, row.issue, row.source, row.confidence, row.recommendation, 'open']
  }
];

cleanOutputDir(outputDir);
let part = 1;
const summary: string[] = ['# WAKILISHA Chunked Seed Export', '', `Generated at: ${new Date().toISOString()}`, `Chunk size: ${chunkSize}`, '', '## Files', ''];
for (const spec of specs) {
  const result = writeSpec(spec, part);
  part = result.nextPart;
  summary.push(`### ${spec.table}`, '', `- Source: ${spec.sourceFile}`, `- Rows: ${result.rows}`, `- Chunks: ${result.files.length}`);
  for (const file of result.files) summary.push(`  - ${file}`);
  summary.push('');
}
fs.writeFileSync(path.join(outputDir, 'README.md'), summary.join('\n'), 'utf8');
console.log(`Chunked seed export written to: ${outputDir}`);
console.log(`Total SQL chunks: ${part - 1}`);
