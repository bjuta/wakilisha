/**
 * Shared test helpers for the WAKILISHA scoring engine test suite.
 *
 * IMPORTANT: This file may only be imported by test files (test/**).
 * Never import from src/ — that would violate the test data discipline
 * rule (brief §6): "Fixtures may never be imported by non-test code."
 */

import * as fc from 'fast-check';
import type {
  ScoringInputRow,
  PreviousEditionEntry,
  AirplayContext,
  ScoringConfig,
} from '@/services/chartsScoring/scoringTypes';
import { DEFAULT_SCORING_CONFIG } from '@/services/chartsScoring/scoringTypes';

// ─────────────────────────────────────────────────────────────────────────────
// Factory helpers
// ─────────────────────────────────────────────────────────────────────────────

/** Build a valid current-evidence ScoringInputRow with optional overrides */
export function makeRow(overrides: Partial<ScoringInputRow> = {}): ScoringInputRow {
  return {
    normalized_key: 'track::artist',
    lead_artist_key: 'artist',
    track_title: 'Test Track',
    artist_name: 'Test Artist',
    source_count: 2,
    occurrence_count: 3,
    source_urls_seen: ['https://a.com', 'https://b.com'],
    release_date: '2026-06-01',
    carry_forward_only: false,
    continuity_locked: false,
    airplay_candidate_only: false,
    canonical_track_id: null,
    canonical_release_id: null,
    canonical_artist_id: null,
    artwork_url: null,
    track_slug: null,
    artist_slug: null,
    ...overrides,
  };
}

/** Build a carry-forward-only ScoringInputRow (zero streaming evidence) */
export function makeCarryForwardRow(overrides: Partial<ScoringInputRow> = {}): ScoringInputRow {
  return makeRow({
    source_count: 0,
    occurrence_count: 0,
    source_urls_seen: [],
    carry_forward_only: true,
    ...overrides,
  });
}

/** Build PreviousEditionEntry array from a simple position map */
export function makePrevEdition(
  entries: Array<{ key: string; pos: number }>,
): PreviousEditionEntry[] {
  return entries.map(({ key, pos }) => ({ normalized_key: key, position: pos }));
}

/** Build a valid AirplayContext with optional overrides */
export function makeAirplayContext(
  overrides: Partial<AirplayContext> = {},
): AirplayContext {
  return {
    normalized_key: 'track::artist',
    canonical_track_id: null,
    W: 36,
    station_count: 2,
    detection_count: 9,
    total_duration_seconds: 1620,
    last_detected_at: '2026-06-10T00:00:00Z',
    matched_by: 'normalized_key',
    rescue_mode: 'allow_rescue',
    ...overrides,
  };
}

/** ScoringConfig with airplay enabled */
export const AIRPLAY_CONFIG: ScoringConfig = {
  ...DEFAULT_SCORING_CONFIG,
  airplay_enabled: true,
};

/** The fixed edition date used across all property tests for determinism */
export const EDITION_DATE = '2026-06-11';

// ─────────────────────────────────────────────────────────────────────────────
// fast-check Arbitraries
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Arbitrary for source_count (1..10).
 * Distinct source URL count — always ≥ 1 for current-evidence rows.
 */
export const sourceCountArb = fc.integer({ min: 1, max: 10 });

/**
 * Arbitrary for occurrence_count, always ≥ source_count (passed as a param).
 * Adds 0..20 extra occurrences on top of source_count.
 */
export function occurrenceCountArb(sourceCount: number): fc.Arbitrary<number> {
  return fc.integer({ min: 0, max: 20 }).map((extra) => sourceCount + extra);
}

/**
 * Arbitrary for a release date 0..1000 days before the edition date,
 * or null (missing).
 * Maps integer days-ago to ISO date string.
 */
export const releaseDateArb: fc.Arbitrary<string | null> = fc.option(
  fc.integer({ min: 0, max: 1000 }).map((daysAgo) => {
    const d = new Date(EDITION_DATE);
    d.setDate(d.getDate() - daysAgo);
    return d.toISOString().slice(0, 10);
  }),
  { nil: null, freq: 5 }, // ~17% chance of null
);

/**
 * Arbitrary for previous chart position (1..50).
 * Returns null with ~20% probability (track not in previous edition).
 */
export const prevPositionArb: fc.Arbitrary<number | null> = fc.option(
  fc.integer({ min: 1, max: 50 }),
  { nil: null, freq: 5 },
);

/**
 * Arbitrary for airplay W (weighted score sum) — 0..500.
 * W = Σ(detection_count × station_weight + duration_minutes) per station.
 */
export const wArb = fc.integer({ min: 0, max: 500 }).map(Number);

/**
 * Arbitrary for a full ScoringInputRow (current evidence, not carry-forward).
 */
export const currentRowArb: fc.Arbitrary<ScoringInputRow> = sourceCountArb.chain(
  (sourceCount) =>
    fc.record({
      normalized_key: fc
        .tuple(
          fc.string({ minLength: 1, maxLength: 20 }),
          fc.string({ minLength: 1, maxLength: 20 }),
        )
        .map(([t, a]) => `${t.replace(/:/g, '_')}::${a.replace(/:/g, '_')}`),
      lead_artist_key: fc.string({ minLength: 1, maxLength: 20 }).map((s) =>
        s.replace(/:/g, '_'),
      ),
      track_title: fc.string({ minLength: 1 }),
      artist_name: fc.string({ minLength: 1 }),
      source_count: fc.constant(sourceCount),
      occurrence_count: occurrenceCountArb(sourceCount),
      source_urls_seen: fc.constant([]),
      release_date: releaseDateArb,
      carry_forward_only: fc.constant(false as const),
      continuity_locked: fc.boolean(),
      airplay_candidate_only: fc.constant(false as const),
      canonical_track_id: fc.constant(null),
      canonical_release_id: fc.constant(null),
      canonical_artist_id: fc.constant(null),
      artwork_url: fc.constant(null),
      track_slug: fc.constant(null),
      artist_slug: fc.constant(null),
    }),
);

/**
 * Arbitrary for a carry-forward-only ScoringInputRow (zero streaming evidence).
 */
export const carryForwardRowArb: fc.Arbitrary<ScoringInputRow> = fc.record({
  normalized_key: fc
    .tuple(
      fc.string({ minLength: 1, maxLength: 20 }),
      fc.string({ minLength: 1, maxLength: 20 }),
    )
    .map(([t, a]) => `${t.replace(/:/g, '_')}::${a.replace(/:/g, '_')}`),
  lead_artist_key: fc.string({ minLength: 1, maxLength: 20 }),
  track_title: fc.string({ minLength: 1 }),
  artist_name: fc.string({ minLength: 1 }),
  source_count: fc.constant(0),
  occurrence_count: fc.constant(0),
  source_urls_seen: fc.constant([]),
  release_date: releaseDateArb,
  carry_forward_only: fc.constant(true as const),
  continuity_locked: fc.boolean(),
  airplay_candidate_only: fc.constant(false as const),
  canonical_track_id: fc.constant(null),
  canonical_release_id: fc.constant(null),
  canonical_artist_id: fc.constant(null),
  artwork_url: fc.constant(null),
  track_slug: fc.constant(null),
  artist_slug: fc.constant(null),
});

/**
 * Arbitrary for a PreviousEditionEntry with a reasonable position.
 */
export const prevEntryArb: fc.Arbitrary<PreviousEditionEntry> = fc.record({
  normalized_key: fc
    .tuple(
      fc.string({ minLength: 1, maxLength: 20 }),
      fc.string({ minLength: 1, maxLength: 20 }),
    )
    .map(([t, a]) => `${t.replace(/:/g, '_')}::${a.replace(/:/g, '_')}`),
  position: fc.integer({ min: 1, max: 50 }),
});