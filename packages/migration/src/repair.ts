import path from 'node:path';
import { ensureDir, writeJson } from './csv.js';
import type { ExpectedTable } from './config.js';
import { buildFromRegistryRows, writeRegistrySeedFiles } from './registry.js';
import { buildSlugAndRedirectMap, writeSlugFiles } from './slugs.js';
import { buildPlaybackSources, writePlaybackFiles } from './playback.js';
import { classifyContent, writeContentFiles } from './content.js';
import { buildMasterReport, writeMasterReport } from './reports.js';
import type { Relationship, ReviewItem } from './types.js';

export function runFullRepair(
  tables: Partial<Record<ExpectedTable, Record<string, string>[]>>,
  reportDir: string
) {
  ensureDir(reportDir);

  const registryData = buildFromRegistryRows(tables);
  const slugData = buildSlugAndRedirectMap(tables);
  const playbackData = buildPlaybackSources(tables);
  const contentData = classifyContent(tables);

  const allRelationships: Relationship[] = [
    ...registryData.relationships,
    ...slugData.relationships,
    ...playbackData.relationships
  ];

  const allReviewItems: ReviewItem[] = [
    ...registryData.reviewQueue,
    ...slugData.reviewQueue,
    ...playbackData.reviewQueue
  ];

  const tracks = tables.wk_tracks ?? [];
  const releases = tables.wk_releases ?? [];
  const chartEntries = tables.wk_chart_entries ?? [];
  const mediaAssets = tables.wk_media_assets ?? [];

  const trackIdsWithArtists = new Set(registryData.trackArtists.map((ta) => ta.track_id));
  const releaseIdsWithTracks = new Set(registryData.releaseTracks.map((rt) => rt.release_id));
  const chartEntriesLinked = new Set(registryData.chartEntryTracks.map((cet) => cet.chart_entry_id));
  const mediaAssetsLinked = new Set(
    mediaAssets
      .filter((m) => m.entity_type && m.entity_slug)
      .map((m) => `${m.entity_type}:${m.entity_slug}`)
  );

  const oldRoutesResolved = slugData.coverage.activeRoutes + slugData.coverage.redirects + slugData.coverage.retired + slugData.coverage.duplicates;

  const graphCoverage = {
    totalTracks: tracks.length,
    tracksWithArtists: trackIdsWithArtists.size,
    tracksWithoutArtists: tracks.length - trackIdsWithArtists.size,
    releasesWithTracklists: releaseIdsWithTracks.size,
    releasesWithoutTracklists: releases.length - releaseIdsWithTracks.size,
    artistsWithGenres: registryData.artistGenres.length,
    chartEntriesLinked: chartEntriesLinked.size,
    mediaAssetsLinked: mediaAssetsLinked.size,
    oldRoutesResolved,
    oldRoutesUnresolved: slugData.coverage.unresolved
  };

  const masterReport = buildMasterReport(
    allRelationships,
    allReviewItems,
    registryData.trackArtists.length,
    registryData.releaseTracks.length,
    registryData.artistGenres.length,
    playbackData.playbackSources.length,
    slugData.slugs.length,
    registryData.chartEntryTracks.length,
    graphCoverage,
    slugData.coverage,
    playbackData.coverage,
    contentData.coverage,
    Object.values(tables).every((t) => t !== undefined)
  );

  writeRegistrySeedFiles(reportDir, registryData);
  writeSlugFiles(reportDir, slugData);
  writePlaybackFiles(reportDir, playbackData);
  writeContentFiles(reportDir, contentData);

  writeJson(path.join(reportDir, 'entity-relationships.full.json'), allRelationships);
  writeJson(path.join(reportDir, 'relationship-review-queue.full.json'), allReviewItems);
  writeJson(path.join(reportDir, 'graph-coverage.full.json'), graphCoverage);

  writeMasterReport(reportDir, masterReport);

  return masterReport;
}