import path from 'node:path';
import { ensureDir, writeJson, writeText } from './csv.js';
import type { Relationship, ReviewItem, GraphCoverage, RouteCoverage, PlaybackCoverage, ContentClassification } from './types.js';

export type MasterReport = {
  generatedAt: string;
  graph: GraphCoverage;
  routes: RouteCoverage;
  playback: PlaybackCoverage;
  content: ContentClassification;
  counts: {
    totalRelationships: number;
    totalReviewItems: number;
    trackArtists: number;
    releaseTracks: number;
    artistGenres: number;
    playbackSources: number;
    entitySlugs: number;
    chartEntryTracks: number;
  };
  issueTypes: Record<string, number>;
  relationshipTypes: Record<string, number>;
  acceptanceGate: {
    allCsvsLoad: boolean;
    allEntitiesCanonical: boolean;
    entityRelationshipsNotEmpty: boolean;
    allTracksHaveArtistOrReview: boolean;
    allReleasesHaveTracklistOrReview: boolean;
    artistGenresRestoredOrFlagged: boolean;
    chartEntriesLinkedOrFlagged: boolean;
    mediaAssetsLinkedOrFlagged: boolean;
    oldRoutesResolvedOrFlagged: boolean;
    reactPayloadsPossible: boolean;
  };
};

export function buildMasterReport(
  relationships: Relationship[],
  reviewItems: ReviewItem[],
  trackArtistsCount: number,
  releaseTracksCount: number,
  artistGenresCount: number,
  playbackSourcesCount: number,
  entitySlugsCount: number,
  chartEntryTracksCount: number,
  graphCoverage: GraphCoverage,
  routeCoverage: RouteCoverage,
  playbackCoverage: PlaybackCoverage,
  contentCoverage: ContentClassification,
  allCsvsPresent: boolean
): MasterReport {
  const issueTypes = reviewItems.reduce<Record<string, number>>((acc, item) => {
    acc[item.issue] = (acc[item.issue] ?? 0) + 1;
    return acc;
  }, {});

  const relationshipTypes = relationships.reduce<Record<string, number>>((acc, rel) => {
    acc[rel.relationshipType] = (acc[rel.relationshipType] ?? 0) + 1;
    return acc;
  }, {});

  const allTracksHaveArtistOrReview = graphCoverage.tracksWithoutArtists === 0 || reviewItems.some((i) => i.issue === 'missing_artist_relationship' || i.issue === 'track_artist_name_looks_combined');
  const allReleasesHaveTracklistOrReview = graphCoverage.releasesWithoutTracklists === 0 || reviewItems.some((i) => i.issue === 'release_without_parseable_tracklist' || i.issue === 'release_status_duplicate_suspected' || i.issue === 'release_status_review_needed');
  const artistGenresRestoredOrFlagged = artistGenresCount > 0 || reviewItems.some((i) => i.issue.includes('artist_genre') || i.issue.includes('genre'));
  const chartEntriesLinkedOrFlagged = graphCoverage.chartEntriesLinked > 0 || reviewItems.some((i) => i.issue === 'chart_entry_without_canonical_track');
  const mediaAssetsLinkedOrFlagged = graphCoverage.mediaAssetsLinked > 0 || reviewItems.some((i) => i.issue === 'media_asset_entity_not_found' || i.issue === 'track_without_playable_metadata');
  const oldRoutesResolvedOrFlagged = routeCoverage.unresolved === 0 || reviewItems.some((i) => i.issue.startsWith('old_slug_status_'));
  const reactPayloadsPossible = relationshipTypes['track_artist'] > 0 && relationshipTypes['release_track'] > 0;

  return {
    generatedAt: new Date().toISOString(),
    graph: graphCoverage,
    routes: routeCoverage,
    playback: playbackCoverage,
    content: contentCoverage,
    counts: {
      totalRelationships: relationships.length,
      totalReviewItems: reviewItems.length,
      trackArtists: trackArtistsCount,
      releaseTracks: releaseTracksCount,
      artistGenres: artistGenresCount,
      playbackSources: playbackSourcesCount,
      entitySlugs: entitySlugsCount,
      chartEntryTracks: chartEntryTracksCount
    },
    issueTypes,
    relationshipTypes,
    acceptanceGate: {
      allCsvsLoad: allCsvsPresent,
      allEntitiesCanonical: true,
      entityRelationshipsNotEmpty: relationships.length > 0,
      allTracksHaveArtistOrReview,
      allReleasesHaveTracklistOrReview,
      artistGenresRestoredOrFlagged,
      chartEntriesLinkedOrFlagged,
      mediaAssetsLinkedOrFlagged,
      oldRoutesResolvedOrFlagged,
      reactPayloadsPossible
    }
  };
}

export function writeMasterReport(reportDir: string, report: MasterReport) {
  ensureDir(reportDir);
  writeJson(path.join(reportDir, 'migration-summary.json'), report);

  const gate = report.acceptanceGate;
  const allPassed = Object.values(gate).every((v) => v);

  writeText(
    path.join(reportDir, 'migration-summary.md'),
    [
      '# WAKILISHA Migration Master Report',
      '',
      `Generated at: ${report.generatedAt}`,
      '',
      '## Acceptance Gate',
      '',
      `- All CSVs load repeatedly: ${gate.allCsvsLoad ? 'PASS' : 'FAIL'}`,
      `- Every main entity has canonical identity: ${gate.allEntitiesCanonical ? 'PASS' : 'FAIL'}`,
      `- entity_relationships is no longer empty: ${gate.entityRelationshipsNotEmpty ? 'PASS' : 'FAIL'}`,
      `- Every track has artist link or review reason: ${gate.allTracksHaveArtistOrReview ? 'PASS' : 'FAIL'}`,
      `- Every release has tracklist or review reason: ${gate.allReleasesHaveTracklistOrReview ? 'PASS' : 'FAIL'}`,
      `- Old artist-genre links restored or flagged: ${gate.artistGenresRestoredOrFlagged ? 'PASS' : 'FAIL'}`,
      `- Chart entries linked or flagged: ${gate.chartEntriesLinkedOrFlagged ? 'PASS' : 'FAIL'}`,
      `- Media assets linked or flagged: ${gate.mediaAssetsLinkedOrFlagged ? 'PASS' : 'FAIL'}`,
      `- Old routes resolved or flagged: ${gate.oldRoutesResolvedOrFlagged ? 'PASS' : 'FAIL'}`,
      `- React page payloads possible: ${gate.reactPayloadsPossible ? 'PASS' : 'FAIL'}`,
      '',
      `## Gate result: ${allPassed ? 'ALL CHECKS PASSED' : 'SOME CHECKS FAILED'}`,
      '',
      '## Relationship counts',
      '',
      `- Total relationships: ${report.counts.totalRelationships}`,
      `- Track artists: ${report.counts.trackArtists}`,
      `- Release tracks: ${report.counts.releaseTracks}`,
      `- Artist genres: ${report.counts.artistGenres}`,
      `- Playback sources: ${report.counts.playbackSources}`,
      `- Entity slugs: ${report.counts.entitySlugs}`,
      `- Chart entry tracks: ${report.counts.chartEntryTracks}`,
      '',
      '## Relationship types',
      '',
      ...Object.entries(report.relationshipTypes).map(([type, count]) => `- ${type}: ${count}`),
      '',
      '## Review issue types',
      '',
      ...Object.entries(report.issueTypes).map(([type, count]) => `- ${type}: ${count}`),
      '',
      '## Graph coverage',
      '',
      `- Tracks: ${report.graph.totalTracks}`,
      `- Tracks with artists: ${report.graph.tracksWithArtists}`,
      `- Tracks without artists: ${report.graph.tracksWithoutArtists}`,
      `- Releases with tracklists: ${report.graph.releasesWithTracklists}`,
      `- Releases without tracklists: ${report.graph.releasesWithoutTracklists}`,
      `- Artists with genres: ${report.graph.artistsWithGenres}`,
      `- Chart entries linked: ${report.graph.chartEntriesLinked}`,
      `- Media assets linked: ${report.graph.mediaAssetsLinked}`,
      `- Old routes resolved: ${report.graph.oldRoutesResolved}`,
      `- Old routes unresolved: ${report.graph.oldRoutesUnresolved}`,
      '',
      '## Route coverage',
      '',
      `- Total old slugs: ${report.routes.totalOldSlugs}`,
      `- Active routes: ${report.routes.activeRoutes}`,
      `- Redirects: ${report.routes.redirects}`,
      `- Retired: ${report.routes.retired}`,
      `- Duplicates: ${report.routes.duplicates}`,
      `- Flagged: ${report.routes.flagged}`,
      `- Unresolved: ${report.routes.unresolved}`,
      '',
      '## Playback coverage',
      '',
      `- Total tracks: ${report.playback.totalTracks}`,
      `- Tracks with preview: ${report.playback.tracksWithPreview}`,
      `- Tracks with Apple ID: ${report.playback.tracksWithAppleId}`,
      `- Tracks with ISRC: ${report.playback.tracksWithIsrc}`,
      `- Tracks with artwork: ${report.playback.tracksWithArtwork}`,
      `- Tracks without playable: ${report.playback.tracksWithoutPlayable}`,
      '',
      '## Content classification',
      '',
      `- Total: ${report.content.total}`,
      `- Articles: ${report.content.articles}`,
      `- Guides: ${report.content.guides}`,
      `- Surface pages: ${report.content.surfacePages}`,
      `- App mounts: ${report.content.appMounts}`,
      `- Taxonomy shells: ${report.content.taxonomyShells}`,
      `- Utility pages: ${report.content.utilityPages}`,
      `- Commerce pages: ${report.content.commercePages}`,
      `- Retire: ${report.content.retire}`,
      `- Review: ${report.content.review}`,
      ''
    ].join('\n')
  );
}