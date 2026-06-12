/**
 * Gate C — Worked Example Exact Reproduction
 * Brief §5: "must reproduce bible §10's worked example exactly: 102.85"
 *
 * This is a NAMED UNIT TEST — not randomized. It must return exactly 102.85
 * (to the cent, 2 decimal places) for the specific inputs in the worked example.
 * Any mismatch means the formula is wrong — find it before anything else.
 *
 * Worked example inputs (bible §10):
 *   2 sources, 3 occurrences, released 45 days ago, previously #4,
 *   2 stations (weight 1.0), 9 detections, 27 minutes total airplay
 *   W = 9 + 27 = 36
 *
 * Expected total: 102.85
 */

import { describe, it, expect } from 'vitest';
import {
  verifyGateC,
  gateCReport,
  sourceScore,
  crossSourceBonus,
  overlapBonus,
  recencyScore,
  continuityScore,
  carryForwardBonus,
  airplayScore,
  scoreEvidenceRow,
} from '@/services/chartsScoring/scoringEngine';
import { makeRow, makePrevEdition, makeAirplayContext, AIRPLAY_CONFIG, EDITION_DATE } from './helpers';

describe('Gate C — Worked Example', () => {
  it('verifyGateC() returns pass=true and total_score=102.85 (to the cent)', () => {
    const result = verifyGateC();

    // Primary assertion from the brief: must equal 102.85
    expect(result.pass).toBe(true);
    expect(result.actual_total_2dp).toBe(102.85);
    expect(result.expected_total_2dp).toBe(102.85);

    // Verify all 7 components individually
    const b = result.breakdown;

    // §4.1 source_score: 2 sources × 24 = 48
    expect(b.source_score).toBe(48);

    // §4.2 cross_source_bonus: (2-1) × 6 × 1.0 = 6
    expect(b.cross_source_bonus).toBe(6);

    // §4.3 overlap_bonus: (3-2) × 2 = 2
    expect(b.overlap_bonus).toBe(2);

    // §4.5 continuity_score: max(4, 18 - min(14, 4-1)) × 1.0 = max(4, 15) = 15
    expect(b.continuity_score).toBe(15);

    // §4.6 carry_forward_bonus: 0 (has streaming evidence)
    expect(b.carry_forward_bonus).toBe(0);

    // §7 anti_gaming_penalty: 0 (single track)
    expect(b.anti_gaming_penalty).toBe(0);

    // airplay_score > 0 (airplay is enabled with W=36)
    expect(b.airplay_score).toBeGreaterThan(0);

    // Total must be ≤ 160 (P1 bound for standard mode)
    expect(result.actual_total_4dp).toBeLessThanOrEqual(160);
  });

  it('gateCReport() returns a non-empty string containing the pass status', () => {
    const report = gateCReport();
    expect(typeof report).toBe('string');
    expect(report.length).toBeGreaterThan(0);
    expect(report).toContain('GATE C');
    expect(report).toContain('YES');
  });

  it('scoreEvidenceRow() matches verifyGateC() breakdown exactly', () => {
    const editionDate = '2026-06-11';
    const releaseDate = '2026-04-27'; // exactly 45 days before

    const row = makeRow({
      normalized_key: 'test_track::test_artist',
      source_count: 2,
      occurrence_count: 3,
      release_date: releaseDate,
    });

    const prev = makePrevEdition([{ key: 'test_track::test_artist', pos: 4 }]);

    const airplayCtx = makeAirplayContext({
      normalized_key: 'test_track::test_artist',
      W: 36,
      station_count: 2,
      detection_count: 9,
      total_duration_seconds: 1620,
    });

    const breakdown = scoreEvidenceRow(row, prev, airplayCtx, AIRPLAY_CONFIG, editionDate);

    expect(breakdown.source_score).toBe(48);
    expect(breakdown.cross_source_bonus).toBe(6);
    expect(breakdown.overlap_bonus).toBe(2);
    expect(breakdown.continuity_score).toBe(15);
    expect(breakdown.carry_forward_bonus).toBe(0);
    expect(breakdown.anti_gaming_penalty).toBe(0);

    // Total (rounded to 2dp) must be 102.85
    const total2dp = Math.round(breakdown.total_score * 100) / 100;
    expect(total2dp).toBe(102.85);
  });

  it('individual component functions produce correct values for Gate C inputs', () => {
    // §4.1
    expect(sourceScore(2)).toBe(48);
    expect(sourceScore(1)).toBe(24);
    expect(sourceScore(3)).toBe(72);
    expect(sourceScore(4)).toBe(72); // capped

    // §4.2
    expect(crossSourceBonus(2, 'standard', 1.0)).toBe(6);
    expect(crossSourceBonus(3, 'standard', 1.0)).toBe(12);
    expect(crossSourceBonus(4, 'standard', 1.0)).toBe(18); // capped
    expect(crossSourceBonus(1, 'standard', 1.0)).toBe(0);

    // §4.3
    expect(overlapBonus(3, 2, 10)).toBe(2);
    expect(overlapBonus(2, 2, 10)).toBe(0); // no extra occurrences
    expect(overlapBonus(7, 2, 10)).toBe(10); // capped

    // §4.5
    expect(continuityScore(4, 1.0)).toBe(15);
    expect(continuityScore(1, 1.0)).toBe(18);
    expect(continuityScore(15, 1.0)).toBe(4); // floor
    expect(continuityScore(null, 1.0)).toBe(0);

    // §4.6
    expect(carryForwardBonus(1, 1.0, true)).toBe(18);
    expect(carryForwardBonus(11, 1.0, true)).toBe(8); // floor
    expect(carryForwardBonus(1, 1.0, false)).toBe(0); // not carry-forward

    // recency — engine-specific buckets (§4.4: ≤30→18, 31-90→12, 91-180→8, 181-365→4, >365→0)
    expect(recencyScore('2026-06-11', EDITION_DATE)).toBe(18); // 0 days → ≤30
    expect(recencyScore('2026-06-04', EDITION_DATE)).toBe(18); // 7 days → ≤30
    expect(recencyScore('2026-06-01', EDITION_DATE)).toBe(18); // 10 days → ≤30
    expect(recencyScore('2026-05-13', EDITION_DATE)).toBe(18); // 29 days → ≤30
    expect(recencyScore('2026-05-11', EDITION_DATE)).toBe(12); // 31 days → 31-90 bucket
    expect(recencyScore('2026-03-12', EDITION_DATE)).toBe(8);  // 91 days → 91-180 bucket
    expect(recencyScore(null, EDITION_DATE)).toBe(0);          // missing
  });

  it('airplay score formula: W=36, 2 stations, 9 detections produces correct value', () => {
    const ctx = makeAirplayContext({ W: 36, station_count: 2, detection_count: 9 });
    const score = airplayScore(ctx, AIRPLAY_CONFIG);
    // §5.3 formula: ln(37)×4.25 + min(6,(2-1)×1.5) + min(4,⌊9/3⌋) = 15.3464 + 1.5 + 3.0 = 19.8464
    expect(score).toBe(19.8464);
    const engineTotal = 48 + 6 + 2 + (recencyScore('2026-04-27', EDITION_DATE)) + 15 + 0 + score;
    const total2dp = Math.round(engineTotal * 100) / 100;
    expect(total2dp).toBe(102.85);
  });
});