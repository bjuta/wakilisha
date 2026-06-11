/**
 * Anti-Gaming Engine — Unit + Property Tests
 * src/services/chartsScoring/scoringEngine.ts
 * §7: computeAntiGamingPenalties + applyAntiGamingAndFinalize
 *
 * Key rules:
 *   - Max 3 tracks per lead artist by default
 *   - §11.3: lowest-scoring extras eat the penalty (pre-sorted by score DESC)
 *   - Penalty formula: overflow_index × overflow_penalty (default 8/index)
 *   - Input order is preserved in output (not sorted)
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import {
  computeAntiGamingPenalties,
  applyAntiGamingAndFinalize,
  scoreEvidenceRow,
  scoreBatch,
} from '@/services/chartsScoring/scoringEngine';
import { DEFAULT_SCORING_CONFIG } from '@/services/chartsScoring/scoringTypes';
import { AIRPLAY_CONFIG, EDITION_DATE, makeRow, makePrevEdition } from './helpers';
import type { AntiGamingTrackInput } from '@/services/chartsScoring/scoringEngine';

// ─────────────────────────────────────────────────────────────────────────────
// §7.1 computeAntiGamingPenalties
// ─────────────────────────────────────────────────────────────────────────────

describe('§7 — computeAntiGamingPenalties()', () => {
  const config = DEFAULT_SCORING_CONFIG;

  it('returns empty array for empty input', () => {
    expect(computeAntiGamingPenalties([], config)).toEqual([]);
  });

  it('no penalty when artist has ≤ max_tracks_per_artist tracks', () => {
    const tracks: AntiGamingTrackInput[] = [
      { normalized_key: 'a::artist', lead_artist_key: 'artist', provisional_total: 90 },
      { normalized_key: 'b::artist', lead_artist_key: 'artist', provisional_total: 80 },
      { normalized_key: 'c::artist', lead_artist_key: 'artist', provisional_total: 70 },
    ];
    const results = computeAntiGamingPenalties(tracks, config);
    expect(results.every((r) => r.anti_gaming_penalty === 0)).toBe(true);
    expect(results.every((r) => !r.lead_artist_overflow)).toBe(true);
  });

  it('4th track earns penalty of 1 × overflow_penalty (default 8)', () => {
    const tracks: AntiGamingTrackInput[] = [
      { normalized_key: 'a::artist', lead_artist_key: 'artist', provisional_total: 90 },
      { normalized_key: 'b::artist', lead_artist_key: 'artist', provisional_total: 80 },
      { normalized_key: 'c::artist', lead_artist_key: 'artist', provisional_total: 70 },
      { normalized_key: 'd::artist', lead_artist_key: 'artist', provisional_total: 60 }, // overflow
    ];
    const results = computeAntiGamingPenalties(tracks, config);

    // First 3 → no penalty
    expect(results[0].anti_gaming_penalty).toBe(0);
    expect(results[1].anti_gaming_penalty).toBe(0);
    expect(results[2].anti_gaming_penalty).toBe(0);

    // 4th → 1 × 8 = 8 (lowest scoring extra)
    const overflowResult = results.find((r) => r.normalized_key === 'd::artist');
    expect(overflowResult?.anti_gaming_penalty).toBe(8);
    expect(overflowResult?.lead_artist_overflow).toBe(true);
    expect(overflowResult?.overflow_index).toBe(1);
  });

  it('§11.3: LOWEST-scoring extra tracks eat the penalty (sorted by score DESC)', () => {
    // Tracks ordered intentionally so the "best" track is last in input
    const tracks: AntiGamingTrackInput[] = [
      { normalized_key: 'low1::artist', lead_artist_key: 'artist', provisional_total: 30 },  // weakest
      { normalized_key: 'low2::artist', lead_artist_key: 'artist', provisional_total: 40 },  // 2nd weakest
      { normalized_key: 'mid::artist', lead_artist_key: 'artist', provisional_total: 70 },
      { normalized_key: 'high::artist', lead_artist_key: 'artist', provisional_total: 100 }, // strongest
    ];

    const results = computeAntiGamingPenalties(tracks, config);

    // High score and mid score → no penalty (top 3)
    const highResult = results.find((r) => r.normalized_key === 'high::artist');
    const midResult = results.find((r) => r.normalized_key === 'mid::artist');
    const low2Result = results.find((r) => r.normalized_key === 'low2::artist');
    expect(highResult?.anti_gaming_penalty).toBe(0);
    expect(midResult?.anti_gaming_penalty).toBe(0);
    expect(low2Result?.anti_gaming_penalty).toBe(0);

    // Weakest (30) → 1 × 8 = 8
    const low1Result = results.find((r) => r.normalized_key === 'low1::artist');
    expect(low1Result?.anti_gaming_penalty).toBe(8);
    expect(low1Result?.lead_artist_overflow).toBe(true);
  });

  it('5th and 6th tracks earn increasing penalties (progressive)', () => {
    const tracks: AntiGamingTrackInput[] = Array.from({ length: 6 }, (_, i) => ({
      normalized_key: `${String.fromCharCode(97 + i)}::artist`,
      lead_artist_key: 'artist',
      provisional_total: (6 - i) * 10, // descending order
    }));

    const results = computeAntiGamingPenalties(tracks, config);

    // Top 3 (highest scores) → no penalty
    expect(results[0].anti_gaming_penalty).toBe(0); // 60 pts
    expect(results[1].anti_gaming_penalty).toBe(0); // 50 pts
    expect(results[2].anti_gaming_penalty).toBe(0); // 40 pts

    // 4th (30 pts) → 1×8=8, 5th (20 pts) → 2×8=16, 6th (10 pts) → 3×8=24
    // After sorting by score desc: [60,50,40,30,20,10]
    // Sorted results[3]...[5] correspond to the 4th-6th weakest
    const overflowResults = results.filter((r) => r.lead_artist_overflow);
    expect(overflowResults).toHaveLength(3);

    const sorted = overflowResults.sort((a, b) => a.overflow_index - b.overflow_index);
    expect(sorted[0].anti_gaming_penalty).toBe(8);
    expect(sorted[1].anti_gaming_penalty).toBe(16);
    expect(sorted[2].anti_gaming_penalty).toBe(24);
  });

  it('tracks from different artists are independent', () => {
    const tracks: AntiGamingTrackInput[] = [
      { normalized_key: 'a::artist1', lead_artist_key: 'artist1', provisional_total: 100 },
      { normalized_key: 'b::artist2', lead_artist_key: 'artist2', provisional_total: 90 },
      { normalized_key: 'c::artist1', lead_artist_key: 'artist1', provisional_total: 80 },
      { normalized_key: 'd::artist2', lead_artist_key: 'artist2', provisional_total: 70 },
    ];

    const results = computeAntiGamingPenalties(tracks, config);
    // Only 2 tracks per artist → both artists stay under the limit of 3
    expect(results.every((r) => r.anti_gaming_penalty === 0)).toBe(true);
  });

  it('unknown lead_artist_key groups under __unknown__', () => {
    const tracks: AntiGamingTrackInput[] = [
      { normalized_key: 'a::', lead_artist_key: '', provisional_total: 100 },
      { normalized_key: 'b::', lead_artist_key: '', provisional_total: 90 },
      { normalized_key: 'c::', lead_artist_key: '', provisional_total: 80 },
      { normalized_key: 'd::', lead_artist_key: '', provisional_total: 70 }, // overflow
    ];

    const results = computeAntiGamingPenalties(tracks, config);
    const overflow = results.filter((r) => r.lead_artist_overflow);
    expect(overflow).toHaveLength(1);
    expect(overflow[0].anti_gaming_penalty).toBe(8);
  });

  it('output maintains the same order as input', () => {
    const tracks: AntiGamingTrackInput[] = [
      { normalized_key: 'c::artist', lead_artist_key: 'artist', provisional_total: 70 },
      { normalized_key: 'a::artist', lead_artist_key: 'artist', provisional_total: 90 },
      { normalized_key: 'b::artist', lead_artist_key: 'artist', provisional_total: 80 },
    ];

    const results = computeAntiGamingPenalties(tracks, config);
    expect(results.map((r) => r.normalized_key)).toEqual(['c::artist', 'a::artist', 'b::artist']);
  });

  // ── Property: final_total = provisional_total − penalty ───────────────────

  it('property: penalty is always non-negative', () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.record({
            normalized_key: fc.string({ minLength: 1, maxLength: 20 }),
            lead_artist_key: fc.constantFrom('artist_a', 'artist_b', 'artist_c'),
            provisional_total: fc.integer({ min: 0, max: 200 }),
          }),
          { minLength: 1, maxLength: 10 },
        ),
        (tracks) => {
          const results = computeAntiGamingPenalties(tracks, DEFAULT_SCORING_CONFIG);
          expect(results.every((r) => r.anti_gaming_penalty >= 0)).toBe(true);
        },
      ),
      { numRuns: 1000 },
    );
  });
});

describe('§7 — applyAntiGamingAndFinalize()', () => {
  it('final_total = provisional_total − penalty', () => {
    const scored = [
      {
        normalized_key: 'a::artist',
        lead_artist_key: 'artist',
        provisional_breakdown: {
          source_score: 72,
          cross_source_bonus: 18,
          overlap_bonus: 10,
          recency_score: 18,
          continuity_score: 18,
          carry_forward_bonus: 0,
          airplay_score: 24,
          anti_gaming_penalty: 0,
          total_score: 160,
          overlap_bonus_capped: false,
          release_recency_days: 5,
        },
      },
      {
        normalized_key: 'b::artist',
        lead_artist_key: 'artist',
        provisional_breakdown: {
          source_score: 48,
          cross_source_bonus: 6,
          overlap_bonus: 2,
          recency_score: 8,
          continuity_score: 15,
          carry_forward_bonus: 0,
          airplay_score: 10,
          anti_gaming_penalty: 0,
          total_score: 89,
          overlap_bonus_capped: false,
          release_recency_days: 45,
        },
      },
      {
        normalized_key: 'c::artist',
        lead_artist_key: 'artist',
        provisional_breakdown: {
          source_score: 24,
          cross_source_bonus: 0,
          overlap_bonus: 0,
          recency_score: 4,
          continuity_score: 0,
          carry_forward_bonus: 0,
          airplay_score: 0,
          anti_gaming_penalty: 0,
          total_score: 28,
          overlap_bonus_capped: false,
          release_recency_days: 120,
        },
      },
      {
        normalized_key: 'd::artist', // 4th track → overflow
        lead_artist_key: 'artist',
        provisional_breakdown: {
          source_score: 24,
          cross_source_bonus: 0,
          overlap_bonus: 0,
          recency_score: 0,
          continuity_score: 0,
          carry_forward_bonus: 0,
          airplay_score: 0,
          anti_gaming_penalty: 0,
          total_score: 24,
          overlap_bonus_capped: false,
          release_recency_days: 500,
        },
      },
    ];

    const finalized = applyAntiGamingAndFinalize(scored, DEFAULT_SCORING_CONFIG);

    // top 3 → no penalty
    const a = finalized.find((r) => r.normalized_key === 'a::artist')!;
    const b = finalized.find((r) => r.normalized_key === 'b::artist')!;
    const c = finalized.find((r) => r.normalized_key === 'c::artist')!;
    const d = finalized.find((r) => r.normalized_key === 'd::artist')!;

    expect(a.anti_gaming_penalty).toBe(0);
    expect(a.final_total).toBe(160);
    expect(b.anti_gaming_penalty).toBe(0);
    expect(b.final_total).toBe(89);
    expect(c.anti_gaming_penalty).toBe(0);
    expect(c.final_total).toBe(28);

    // 4th (lowest provisional: 24) → penalty 8
    expect(d.anti_gaming_penalty).toBe(8);
    expect(d.final_total).toBe(16);
    expect(d.lead_artist_overflow).toBe(true);
  });

  it('sorts descending by final_total in scoreBatch', () => {
    const rows = [
      makeRow({ normalized_key: 'low::z', lead_artist_key: 'z', source_count: 1, occurrence_count: 1 }),
      makeRow({ normalized_key: 'high::z', lead_artist_key: 'z', source_count: 3, occurrence_count: 10 }),
      makeRow({ normalized_key: 'mid::z', lead_artist_key: 'z', source_count: 2, occurrence_count: 5 }),
    ];

    const result = scoreBatch(rows, [], new Map(), AIRPLAY_CONFIG, EDITION_DATE);

    for (let i = 0; i < result.length - 1; i++) {
      expect(result[i].final_total).toBeGreaterThanOrEqual(result[i + 1].final_total);
    }
  });
});