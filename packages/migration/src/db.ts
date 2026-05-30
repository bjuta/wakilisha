import path from 'node:path';
import fs from 'node:fs';
import { ensureDir } from './csv.js';

function escapeSqlString(value: string | undefined): string {
  if (!value) return 'null';
  return `'${value.replace(/'/g, "''")}'`;
}

function toJsonb(value: unknown): string {
  if (!value) return 'null';
  return escapeSqlString(JSON.stringify(value));
}

export function generateSeedSql(reportDir: string, outputDir: string) {
  ensureDir(outputDir);

  const schema = 'wakilisha_repaired';
  const lines: string[] = [];
  lines.push(`-- WAKILISHA React Rebuild`);
  lines.push(`-- Auto-generated seed SQL from migration repair pass`);
  lines.push(`-- Generated at: ${new Date().toISOString()}`);
  lines.push('');
  lines.push(`set search_path to ${schema}, public;`);
  lines.push('');

  const entitySlugsPath = path.join(reportDir, 'entity-slugs.full.json');
  const entityRelationshipsPath = path.join(reportDir, 'entity-relationships.full.json');
  const trackArtistsPath = path.join(reportDir, 'track-artists.seed.json');
  const releaseTracksPath = path.join(reportDir, 'release-tracks.seed.json');
  const artistGenresPath = path.join(reportDir, 'artist-genres.seed.json');
  const playbackSourcesPath = path.join(reportDir, 'track-playback-sources.full.json');
  const chartEntryTracksPath = path.join(reportDir, 'chart-entry-tracks.seed.json');
  const reviewQueuePath = path.join(reportDir, 'relationship-review-queue.full.json');
  const contentClassificationPath = path.join(reportDir, 'content-classification.json');

  if (fs.existsSync(entitySlugsPath)) {
    const slugs = JSON.parse(fs.readFileSync(entitySlugsPath, 'utf8')) as Array<Record<string, unknown>>;
    lines.push(`-- entity_slugs: ${slugs.length} rows`);
    lines.push(`insert into ${schema}.entity_slugs (entity_type, entity_id, slug, full_path, status, is_primary, legacy_path, source, needs_review, review_reason) values`);
    const values = slugs.slice(0, 5000).map((row, i) => {
      const parts = [
        escapeSqlString(String(row.entity_type ?? '')),
        escapeSqlString(String(row.entity_id ?? '')),
        escapeSqlString(String(row.slug ?? '')),
        escapeSqlString(row.full_path as string | undefined),
        escapeSqlString(String(row.status ?? 'active')),
        row.is_primary === true ? 'true' : 'false',
        escapeSqlString(row.legacy_path as string | undefined),
        escapeSqlString(String(row.source ?? '')),
        row.needs_review === true ? 'true' : 'false',
        escapeSqlString(row.review_reason as string | undefined)
      ];
      return `  (${parts.join(', ')})${i === slugs.length - 1 || i === 4999 ? ';' : ','}`;
    });
    lines.push(...values);
    if (slugs.length > 5000) {
      lines.push(`-- Note: ${slugs.length - 5000} additional entity_slugs rows truncated for seed SQL size`);
    }
    lines.push('');
  }

  if (fs.existsSync(entityRelationshipsPath)) {
    const rels = JSON.parse(fs.readFileSync(entityRelationshipsPath, 'utf8')) as Array<Record<string, unknown>>;
    lines.push(`-- entity_relationships: ${rels.length} rows`);
    lines.push(`insert into ${schema}.entity_relationships (source_entity_type, source_entity_id, relationship_type, target_entity_type, target_entity_id, position, role, confidence, source, needs_review, review_reason) values`);
    const values = rels.slice(0, 5000).map((row, i) => {
      const parts = [
        escapeSqlString(String(row.sourceEntityType ?? '')),
        escapeSqlString(String(row.sourceEntityId ?? '')),
        escapeSqlString(String(row.relationshipType ?? '')),
        escapeSqlString(String(row.targetEntityType ?? '')),
        escapeSqlString(String(row.targetEntityId ?? '')),
        row.position !== null && row.position !== undefined ? String(row.position) : 'null',
        escapeSqlString(row.role as string | undefined),
        String(row.confidence ?? 0.5),
        escapeSqlString(String(row.source ?? '')),
        row.needsReview === true ? 'true' : 'false',
        escapeSqlString(row.reviewReason as string | undefined)
      ];
      return `  (${parts.join(', ')})${i === rels.length - 1 || i === 4999 ? ';' : ','}`;
    });
    lines.push(...values);
    if (rels.length > 5000) {
      lines.push(`-- Note: ${rels.length - 5000} additional relationship rows truncated for seed SQL size`);
    }
    lines.push('');
  }

  if (fs.existsSync(trackArtistsPath)) {
    const rows = JSON.parse(fs.readFileSync(trackArtistsPath, 'utf8')) as Array<Record<string, unknown>>;
    lines.push(`-- track_artists: ${rows.length} rows`);
    lines.push(`insert into ${schema}.track_artists (track_id, artist_id, artist_name_snapshot, role, position, source, confidence, needs_review, review_reason) values`);
    const values = rows.slice(0, 5000).map((row, i) => {
      const parts = [
        escapeSqlString(String(row.track_id ?? '')),
        escapeSqlString(String(row.artist_id ?? '')),
        escapeSqlString(row.artist_name_snapshot as string | undefined),
        escapeSqlString(String(row.role ?? 'primary')),
        row.position !== undefined ? String(row.position) : 'null',
        escapeSqlString(String(row.source ?? '')),
        String(row.confidence ?? 0.5),
        row.needs_review === true ? 'true' : 'false',
        escapeSqlString(row.review_reason as string | undefined)
      ];
      return `  (${parts.join(', ')})${i === rows.length - 1 || i === 4999 ? ';' : ','}`;
    });
    lines.push(...values);
    lines.push('');
  }

  if (fs.existsSync(releaseTracksPath)) {
    const rows = JSON.parse(fs.readFileSync(releaseTracksPath, 'utf8')) as Array<Record<string, unknown>>;
    lines.push(`-- release_tracks: ${rows.length} rows`);
    lines.push(`insert into ${schema}.release_tracks (release_id, track_id, disc_number, track_number, title_snapshot, artist_snapshot, source, confidence, needs_review, review_reason) values`);
    const values = rows.slice(0, 5000).map((row, i) => {
      const parts = [
        escapeSqlString(String(row.release_id ?? '')),
        escapeSqlString(String(row.track_id ?? '')),
        row.disc_number !== undefined ? String(row.disc_number) : 'null',
        row.track_number !== undefined ? String(row.track_number) : 'null',
        escapeSqlString(row.title_snapshot as string | undefined),
        escapeSqlString(row.artist_snapshot as string | undefined),
        escapeSqlString(String(row.source ?? '')),
        String(row.confidence ?? 0.5),
        row.needs_review === true ? 'true' : 'false',
        escapeSqlString(row.review_reason as string | undefined)
      ];
      return `  (${parts.join(', ')})${i === rows.length - 1 || i === 4999 ? ';' : ','}`;
    });
    lines.push(...values);
    lines.push('');
  }

  if (fs.existsSync(artistGenresPath)) {
    const rows = JSON.parse(fs.readFileSync(artistGenresPath, 'utf8')) as Array<Record<string, unknown>>;
    lines.push(`-- artist_genres: ${rows.length} rows`);
    lines.push(`insert into ${schema}.artist_genres (artist_id, genre_id, source, confidence, needs_review, review_reason) values`);
    const values = rows.map((row, i) => {
      const parts = [
        escapeSqlString(String(row.artist_id ?? '')),
        escapeSqlString(String(row.genre_id ?? '')),
        escapeSqlString(String(row.source ?? '')),
        String(row.confidence ?? 0.5),
        row.needs_review === true ? 'true' : 'false',
        escapeSqlString(row.review_reason as string | undefined)
      ];
      return `  (${parts.join(', ')})${i === rows.length - 1 ? ';' : ','}`;
    });
    lines.push(...values);
    lines.push('');
  }

  if (fs.existsSync(playbackSourcesPath)) {
    const rows = JSON.parse(fs.readFileSync(playbackSourcesPath, 'utf8')) as Array<Record<string, unknown>>;
    lines.push(`-- track_playback_sources: ${rows.length} rows`);
    lines.push(`insert into ${schema}.track_playback_sources (track_id, provider, provider_track_id, isrc, preview_url, duration_ms, artwork_url, source_url, source_ref, source_payload, confidence, needs_review, review_reason) values`);
    const values = rows.slice(0, 5000).map((row, i) => {
      const parts = [
        escapeSqlString(String(row.track_id ?? '')),
        escapeSqlString(row.provider as string | undefined),
        escapeSqlString(row.provider_track_id as string | undefined),
        escapeSqlString(row.isrc as string | undefined),
        escapeSqlString(row.preview_url as string | undefined),
        row.duration_ms !== undefined ? String(row.duration_ms) : 'null',
        escapeSqlString(row.artwork_url as string | undefined),
        escapeSqlString(row.source_url as string | undefined),
        escapeSqlString(row.source_ref as string | undefined),
        toJsonb(row.source_payload),
        String(row.confidence ?? 0.5),
        row.needs_review === true ? 'true' : 'false',
        escapeSqlString(row.review_reason as string | undefined)
      ];
      return `  (${parts.join(', ')})${i === rows.length - 1 || i === 4999 ? ';' : ','}`;
    });
    lines.push(...values);
    if (rows.length > 5000) {
      lines.push(`-- Note: ${rows.length - 5000} additional playback source rows truncated for seed SQL size`);
    }
    lines.push('');
  }

  if (fs.existsSync(reviewQueuePath)) {
    const rows = JSON.parse(fs.readFileSync(reviewQueuePath, 'utf8')) as Array<Record<string, unknown>>;
    lines.push(`-- review_queue: ${rows.length} rows`);
    lines.push(`insert into ${schema}.review_queue (entity_type, entity_id, label, issue, source, confidence, recommendation, status) values`);
    const values = rows.slice(0, 5000).map((row, i) => {
      const parts = [
        escapeSqlString(String(row.entityType ?? '')),
        escapeSqlString(String(row.entityId ?? '')),
        escapeSqlString(row.label as string | undefined),
        escapeSqlString(String(row.issue ?? '')),
        escapeSqlString(String(row.source ?? '')),
        row.confidence !== undefined ? String(row.confidence) : 'null',
        escapeSqlString(row.recommendation as string | undefined),
        escapeSqlString('open')
      ];
      return `  (${parts.join(', ')})${i === rows.length - 1 || i === 4999 ? ';' : ','}`;
    });
    lines.push(...values);
    if (rows.length > 5000) {
      lines.push(`-- Note: ${rows.length - 5000} additional review queue rows truncated for seed SQL size`);
    }
    lines.push('');
  }

  if (fs.existsSync(contentClassificationPath)) {
    const rows = JSON.parse(fs.readFileSync(contentClassificationPath, 'utf8')) as Array<Record<string, unknown>>;
    lines.push(`-- content_route_classification: ${rows.length} rows`);
    lines.push(`insert into ${schema}.content_route_classification (legacy_wp_post_id, legacy_post_type, slug, title, classification, react_route, migration_action, needs_review, review_reason, source_payload) values`);
    const values = rows.slice(0, 5000).map((row, i) => {
      const parts = [
        escapeSqlString(row.legacy_wp_post_id as string | undefined),
        escapeSqlString(row.legacy_post_type as string | undefined),
        escapeSqlString(row.slug as string | undefined),
        escapeSqlString(row.title as string | undefined),
        escapeSqlString(String(row.classification ?? '')),
        escapeSqlString(row.react_route as string | undefined),
        escapeSqlString(String(row.migration_action ?? '')),
        row.needs_review === true ? 'true' : 'false',
        escapeSqlString(row.review_reason as string | undefined),
        toJsonb(row.source_payload)
      ];
      return `  (${parts.join(', ')})${i === rows.length - 1 || i === 4999 ? ';' : ','}`;
    });
    lines.push(...values);
    if (rows.length > 5000) {
      lines.push(`-- Note: ${rows.length - 5000} additional classification rows truncated for seed SQL size`);
    }
    lines.push('');
  }

  const outputPath = path.join(outputDir, '003_seed_repaired_data.sql');
  fs.writeFileSync(outputPath, lines.join('\n'), 'utf8');
  console.log(`Seed SQL written to: ${outputPath}`);
  return outputPath;
}