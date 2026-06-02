/**
 * Sprint 5: V2 Programs Registry (mock)
 * These are the real V2 chart programs derived from the repo's actual data:
 *   Series × Market = Program
 *
 * wk_chart_programs_v2 shape:
 *   id, series_slug, market_slug, public_slug, label, ...
 */

import type { V2Program } from "./commitTypes";

export const V2_PROGRAMS: V2Program[] = [
  {
    id: "prog-kenya",
    publicSlug: "kenya",
    seriesSlug: "top-songs",
    marketSlug: "kenya",
    label: "WAKILISHA Top 40 Kenya",
    defaultMethodologyVersion: "weighted_streaming_v1",
    defaultEligibilityRulesVersion: "default_v1",
  },
  {
    id: "prog-gengetone",
    publicSlug: "gengetone",
    seriesSlug: "gengetone",
    marketSlug: "kenya",
    label: "WAKILISHA Gengetone Kenya",
    defaultMethodologyVersion: "genre_weighted_v1",
    defaultEligibilityRulesVersion: "gengetone_v1",
  },
  {
    id: "prog-rnb",
    publicSlug: "rnb",
    seriesSlug: "rnb",
    marketSlug: "kenya",
    label: "WAKILISHA R&B Kenya",
    defaultMethodologyVersion: "genre_weighted_v1",
    defaultEligibilityRulesVersion: "rnb_v1",
  },
  {
    id: "prog-2026",
    publicSlug: "2026",
    seriesSlug: "2026-releases",
    marketSlug: "kenya",
    label: "2026 Releases Kenya",
    defaultMethodologyVersion: "release_weighted_v1",
    defaultEligibilityRulesVersion: "releases_v1",
  },
  {
    id: "prog-top-songs-nigeria",
    publicSlug: "top-songs-nigeria",
    seriesSlug: "top-songs",
    marketSlug: "nigeria",
    label: "WAKILISHA Top Songs Nigeria",
    defaultMethodologyVersion: "weighted_streaming_v1",
    defaultEligibilityRulesVersion: "default_v1",
  },
  {
    id: "prog-top-songs-global",
    publicSlug: "top-songs-global-african",
    seriesSlug: "top-songs",
    marketSlug: "global",
    label: "WAKILISHA Top Songs Global African",
    defaultMethodologyVersion: "weighted_streaming_v1",
    defaultEligibilityRulesVersion: "default_v1",
  },
];

/**
 * Resolve a V2 program from a public slug or program ID.
 * Also matches legacy series IDs from the old ingest studio.
 */
export function resolveV2Program(publicSlugOrId: string): V2Program | null {
  if (!publicSlugOrId) return null;

  // Direct public slug match
  const bySlug = V2_PROGRAMS.find((p) => p.publicSlug === publicSlugOrId);
  if (bySlug) return bySlug;

  // ID match
  const byId = V2_PROGRAMS.find((p) => p.id === publicSlugOrId);
  if (byId) return byId;

  // Series slug match (for backwards compat with old existingSeriesId)
  const bySeries = V2_PROGRAMS.find((p) => p.seriesSlug === publicSlugOrId);
  if (bySeries) return bySeries;

  return null;
}