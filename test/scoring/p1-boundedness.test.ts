/**
 * Gate B — Property P1: Boundedness
 *
 * Bible §10 P1: "for 10,000 random rows:
 *   current-evidence score ≤ 160 (standard mode),
 *   carry-forward score ≤ 78;
 *   no NaN, no Infinity"
 *
 * Theoretical maximums (default weights, standard mode):
 *   current: src(72) + cross(18) + overlap(10) + rec(18) + cont(18) + air(24) = 160
 *   carry-forward: rec(18) + cont(18) + carry(18) + air(24) = 78
 *
 * IMPORTANT: This is a property-based test using fast-check.
 * It is NOT permitted to be hand-replaced with examples or skipped.
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import {
  scoreEvidenceRow,
  sourceScore,
} from '@/services/chartsScoring/scoringEngine';
import {
  currentRowArb,
  carryForwardRowArb,
  prevEntryArb,
  AIRPLAY_CONFIG,
  EDITION_DATE,
} from './helpers';
import type { AirplayContext, PreviousEditionEntry } from '@/services/chartsScoring/scoringTypes';

/** Build an AirplayContext from integer inputs (no NaN, no Infinity) */
function makeTestAirplay(W: number, stations: number, detections: number): AirplayContext {
  return {
    normalized_key: 'test::test',
    canonical_track_id: null,
    W,
    station_count: stations,
    detection_count: detections,
    total_duration_seconds: 0,
    last_detected_at: null,
    matched_by: 'normalized_key',
    rescue_mode: 'allow_rescue',
  };
}

describe('P1 — Boundedness (10,000 random rows per check)', () => {
  it('P1.1: current-evidence rows never exceed 160 points (standard mode)', () => {
    fc.assert(
      fc.property(
        currentRowArb,
        fc.array(prevEntryArb, { maxLength: 10 }),
        fc.integer({ min: 0, max: 300 }), // W
        fc.integer({ min: 1, max: 10 }),   // stations
        fc.integer({ min: 1, max: 50 }),   // detections
        fc.boolean(),                       // airplay enabled?
        (row, prevEdition, W, stations, detections, airplayEnabled) => {
          // Wire first prev entry to the row's key so continuity can activate
          const prevWithMatchedKey: PreviousEditionEntry[] = prevEdition.map((e, i) =>
            i === 0 ? { ...e, normalized_key: row.normalized_key } : e,
          );

          const config = { ...AIRPLAY_CONFIG, airplay_enabled: airplayEnabled };
          const airplayCtx = airplayEnabled
            ? makeTestAirplay(W, stations, detections)
            : null;

          const breakdown = scoreEvidenceRow(
            row,
            prevWithMatchedKey,
            airplayCtx,
            config,
            EDITION_DATE,
          );

          // No NaN, no Infinity on total
          expect(Number.isFinite(breakdown.total_score)).toBe(true);
          expect(Number.isNaN(breakdown.total_score)).toBe(false);

          // §4.1–§4.7 individual component upper bounds
          expect(breakdown.source_score).toBeGreaterThanOrEqual(0);
          expect(breakdown.source_score).toBeLessThanOrEqual(72);

          expect(breakdown.cross_source_bonus).toBeGreaterThanOrEqual(0);
          expect(breakdown.cross_source_bonus).toBeLessThanOrEqual(24);

          expect(breakdown.overlap_bonus).toBeGreaterThanOrEqual(0);
          expect(breakdown.overlap_bonus).toBeLessThanOrEqual(10);

          expect(breakdown.recency_score).toBeGreaterThanOrEqual(0);
          expect(breakdown.recency_score).toBeLessThanOrEqual(18);

          expect(breakdown.continuity_score).toBeGreaterThanOrEqual(0);
          expect(breakdown.continuity_score).toBeLessThanOrEqual(18);

          // Current-evidence rows always have carry_forward_bonus = 0
          expect(breakdown.carry_forward_bonus).toBe(0);

          expect(breakdown.airplay_score).toBeGreaterThanOrEqual(0);
          expect(breakdown.airplay_score).toBeLessThanOrEqual(24);

          // Pre-anti-gaming total ≤ 160 for standard mode
          // (epsilon 0.001 for NUMERIC(12,4) float representation)
          expect(breakdown.total_score).toBeLessThanOrEqual(160.001);
        },
      ),
      { numRuns: 10000, seed: 42 },
    );
  });

  it('P1.2: carry-forward rows never exceed 78 points', () => {
    fc.assert(
      fc.property(
        carryForwardRowArb,
        fc.array(prevEntryArb, { maxLength: 10 }),
        fc.integer({ min: 0, max: 300 }),
        fc.integer({ min: 1, max: 10 }),
        fc.integer({ min: 1, max: 50 }),
        (row, prevEdition, W, stations, detections) => {
          const prevWithMatchedKey: PreviousEditionEntry[] = prevEdition.map((e, i) =>
            i === 0 ? { ...e, normalized_key: row.normalized_key } : e,
          );

          const airplayCtx = makeTestAirplay(W, stations, detections);

          const breakdown = scoreEvidenceRow(
            row,
            prevWithMatchedKey,
            airplayCtx,
            AIRPLAY_CONFIG,
            EDITION_DATE,
          );

          // No NaN, no Infinity
          expect(Number.isFinite(breakdown.total_score)).toBe(true);
          expect(Number.isNaN(breakdown.total_score)).toBe(false);

          // Carry-forward rows have zero streaming-derived components
          expect(breakdown.source_score).toBe(0);
          expect(breakdown.cross_source_bonus).toBe(0);
          expect(breakdown.overlap_bonus).toBe(0);

          // Total ≤ 78 (rec 18 + cont 18 + carry 18 + air 24)
          expect(breakdown.total_score).toBeLessThanOrEqual(78.001);
        },
      ),
      { numRuns: 10000, seed: 42 },
    );
  });

  it('P1.3: no component produces NaN or Infinity for extreme inputs', () => {
    fc.assert(
      fc.property(
        currentRowArb,
        fc.integer({ min: 0, max: 10000 }), // extreme W (up to 10,000)
        (row, W) => {
          const airplayCtx = makeTestAirplay(W, 5, 20);
          const breakdown = scoreEvidenceRow(
            row,
            [],
            airplayCtx,
            AIRPLAY_CONFIG,
            EDITION_DATE,
          );

          const components = [
            breakdown.source_score,
            breakdown.cross_source_bonus,
            breakdown.overlap_bonus,
            breakdown.recency_score,
            breakdown.continuity_score,
            breakdown.carry_forward_bonus,
            breakdown.airplay_score,
            breakdown.total_score,
          ];

          for (const c of components) {
            expect(Number.isFinite(c)).toBe(true);
            expect(Number.isNaN(c)).toBe(false);
          }
        },
      ),
      { numRuns: 10000, seed: 137 },
    );
  });

  it('P1.4: source_score is in [24, 72] for source_count in [1, 10]', () => {
    fc.assert(
      fc.property(fc.integer({ min: 1, max: 10 }), (n) => {
        const s = sourceScore(n);
        expect(s).toBeGreaterThanOrEqual(24);
        expect(s).toBeLessThanOrEqual(72);
        expect(Number.isFinite(s)).toBe(true);
      }),
      { numRuns: 10 },
    );
  });

  it('P1.5: source_score(0) = 0 (no streaming evidence)', () => {
    expect(sourceScore(0)).toBe(0);
  });
});