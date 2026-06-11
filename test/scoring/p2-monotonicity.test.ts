/**
 * Gate B — Property P2: Monotonicity in Evidence
 *
 * Bible §10 P2: "adding a source, an occurrence, a station, a detection,
 * or improving previous position never lowers the pre-penalty score."
 *
 * Each sub-test holds ALL OTHER INPUTS FIXED and increases exactly one
 * evidence variable, asserting that the score does not decrease.
 *
 * Note: "pre-penalty" means the provisional total before anti-gaming.
 * This is exactly what scoreEvidenceRow returns (anti_gaming_penalty = 0).
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import {
  sourceScore,
  crossSourceBonus,
  overlapBonus,
  continuityScore,
  carryForwardBonus,
  airplayScore,
  scoreEvidenceRow,
} from '@/services/chartsScoring/scoringEngine';
import {
  currentRowArb,
  wArb,
  AIRPLAY_CONFIG,
  EDITION_DATE,
  makeAirplayContext,
} from './helpers';

describe('P2 — Monotonicity in Evidence', () => {
  // ── §4.1 Source Score ─────────────────────────────────────────────────────

  it('P2.1: increasing source_count never decreases source_score', () => {
    fc.assert(
      fc.property(fc.integer({ min: 1, max: 9 }), (n) => {
        expect(sourceScore(n + 1)).toBeGreaterThanOrEqual(sourceScore(n));
      }),
      { numRuns: 10 }, // 9 distinct values
    );
  });

  // ── §4.2 Cross-Source Bonus ───────────────────────────────────────────────

  it('P2.2: increasing source_count never decreases cross_source_bonus', () => {
    fc.assert(
      fc.property(fc.integer({ min: 1, max: 9 }), (n) => {
        expect(crossSourceBonus(n + 1, 'standard', 1.0)).toBeGreaterThanOrEqual(
          crossSourceBonus(n, 'standard', 1.0),
        );
      }),
      { numRuns: 10 },
    );
  });

  // ── §4.3 Overlap Bonus ────────────────────────────────────────────────────

  it('P2.3: increasing occurrence_count never decreases overlap_bonus', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 9 }),  // source_count
        fc.integer({ min: 0, max: 19 }), // extra occurrences above source_count
        (sourceCount, extraOccurrences) => {
          const occ = sourceCount + extraOccurrences;
          expect(overlapBonus(occ + 1, sourceCount, 10)).toBeGreaterThanOrEqual(
            overlapBonus(occ, sourceCount, 10),
          );
        },
      ),
      { numRuns: 500 },
    );
  });

  // ── §4.5 Continuity Score ─────────────────────────────────────────────────

  it('P2.4: improving previous position (lower rank number) never decreases continuity_score', () => {
    fc.assert(
      fc.property(fc.integer({ min: 2, max: 50 }), (pos) => {
        // pos-1 is a better (lower-numbered = higher) position
        expect(continuityScore(pos - 1, 1.0)).toBeGreaterThanOrEqual(
          continuityScore(pos, 1.0),
        );
      }),
      { numRuns: 49 }, // 49 distinct values
    );
  });

  // ── §4.6 Carry-Forward Bonus ──────────────────────────────────────────────

  it('P2.5: improving previous position never decreases carry_forward_bonus', () => {
    fc.assert(
      fc.property(fc.integer({ min: 2, max: 50 }), (pos) => {
        expect(carryForwardBonus(pos - 1, 1.0, true)).toBeGreaterThanOrEqual(
          carryForwardBonus(pos, 1.0, true),
        );
      }),
      { numRuns: 49 },
    );
  });

  // ── §4.7 Airplay Score — non-decreasing in W ─────────────────────────────

  it('P2.6: increasing W never decreases airplay_score', () => {
    fc.assert(
      fc.property(wArb, (W) => {
        if (W === 0) return; // W+1 > W = 0 is trivial
        const lower = makeAirplayContext({ W: W - 1, station_count: 2, detection_count: 5 });
        const higher = makeAirplayContext({ W, station_count: 2, detection_count: 5 });

        expect(airplayScore(higher, AIRPLAY_CONFIG)).toBeGreaterThanOrEqual(
          airplayScore(lower, AIRPLAY_CONFIG),
        );
      }),
      { numRuns: 500 },
    );
  });

  it('P2.7: increasing station_count never decreases airplay_score', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 9 }),  // station count
        fc.integer({ min: 1, max: 100 }), // W (fixed)
        (stations, W) => {
          const lower = makeAirplayContext({ W, station_count: stations, detection_count: 10 });
          const higher = makeAirplayContext({ W, station_count: stations + 1, detection_count: 10 });

          // Adding a station (at same W) cannot decrease score
          // The station bonus term is station_count * 2.0, which is strictly increasing
          expect(airplayScore(higher, AIRPLAY_CONFIG)).toBeGreaterThanOrEqual(
            airplayScore(lower, AIRPLAY_CONFIG),
          );
        },
      ),
      { numRuns: 500 },
    );
  });

  it('P2.8: increasing detection_count never decreases airplay_score', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 49 }), // detections
        fc.integer({ min: 1, max: 100 }), // W (fixed)
        (detections, W) => {
          const lower = makeAirplayContext({ W, station_count: 2, detection_count: detections });
          const higher = makeAirplayContext({ W, station_count: 2, detection_count: detections + 1 });

          expect(airplayScore(higher, AIRPLAY_CONFIG)).toBeGreaterThanOrEqual(
            airplayScore(lower, AIRPLAY_CONFIG),
          );
        },
      ),
      { numRuns: 500 },
    );
  });

  // ── Full row: adding one source never lowers the full pre-penalty total ───

  it('P2.9: adding one source to a full row never lowers the pre-penalty total score', () => {
    fc.assert(
      fc.property(
        currentRowArb,
        (row) => {
          if (row.source_count >= 10) return; // skip at cap

          const lowerRow = { ...row };
          const higherRow = {
            ...row,
            source_count: row.source_count + 1,
            occurrence_count: row.occurrence_count + 1,
            source_urls_seen: [...row.source_urls_seen, 'https://extra.com'],
          };

          const lowerBreakdown = scoreEvidenceRow(lowerRow, [], null, AIRPLAY_CONFIG, EDITION_DATE);
          const higherBreakdown = scoreEvidenceRow(higherRow, [], null, AIRPLAY_CONFIG, EDITION_DATE);

          expect(higherBreakdown.total_score).toBeGreaterThanOrEqual(
            lowerBreakdown.total_score - 0.001, // epsilon for float precision
          );
        },
      ),
      { numRuns: 2000 },
    );
  });
});