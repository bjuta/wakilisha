/**
 * Gate B — Property P5: Determinism
 *
 * Bible §10 P5:
 *   "Running the engine twice on the same input must produce bit-identical
 *   output. Shuffling the input rows must produce the same final ranked list
 *   (same normalized_keys in the same order)."
 *
 * Two sub-properties:
 *   P5a — Idempotency: same inputs → identical JSON-serialized output
 *   P5b — Shuffle-invariance: shuffled input rows → same ranked order
 *
 * The engine's only allowed source of non-determinism would be:
 *   - Math.random() — PROHIBITED by contract
 *   - Date.now() / new Date() — PROHIBITED by contract (editionDate is injected)
 *   - Map/Set iteration order — must be resolved by explicit sorting
 *   - Floating point non-associativity — summation order must be consistent
 *
 * We verify all of these by:
 *   1. Running the same inputs twice and asserting JSON.stringify equality
 *   2. Running shuffled inputs and asserting the output normalized_keys match
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { scoreBatch } from '@/services/chartsScoring/scoringEngine';
import { buildScoringInputRows, runFullPipeline } from '@/services/chartsScoring/scoringPipeline';
import { build_normalized_key } from '@/services/chartsScoring/normalize';
import { AIRPLAY_CONFIG, EDITION_DATE, makeRow, makePrevEdition } from './helpers';
import type { ScoringInputRow, AirplayContext } from '@/services/chartsScoring/scoringTypes';

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

/** Fisher-Yates shuffle using a seeded PRNG (pure, no Math.random) */
function shuffleWithSeed<T>(arr: T[], seed: number): T[] {
  const result = [...arr];
  let s = seed;
  for (let i = result.length - 1; i > 0; i--) {
    s = (s * 1664525 + 1013904223) & 0xffffffff;
    const j = Math.abs(s) % (i + 1);
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

/** Generate N distinct unique (track, artist) pairs */
function makeDistinctRows(n: number): ScoringInputRow[] {
  return Array.from({ length: n }, (_, i) => {
    const key = `track_${i.toString().padStart(3, '0')}::artist_${i.toString().padStart(3, '0')}`;
    return makeRow({
      normalized_key: key,
      lead_artist_key: `artist_${i.toString().padStart(3, '0')}`,
      track_title: `Track ${i}`,
      artist_name: `Artist ${i}`,
      source_count: (i % 3) + 1,
      occurrence_count: (i % 5) + 1,
    });
  });
}

describe('P5 — Determinism', () => {
  // ── P5a: Idempotency ───────────────────────────────────────────────────────

  it('P5a.1: scoreBatch produces bit-identical output when called twice with the same inputs', () => {
    const rows = makeDistinctRows(15);
    const prev = makePrevEdition([
      { key: rows[0].normalized_key, pos: 1 },
      { key: rows[1].normalized_key, pos: 3 },
      { key: rows[2].normalized_key, pos: 5 },
    ]);
    const airplayMap = new Map<string, AirplayContext>();

    const run1 = scoreBatch(rows, prev, airplayMap, AIRPLAY_CONFIG, EDITION_DATE);
    const run2 = scoreBatch(rows, prev, airplayMap, AIRPLAY_CONFIG, EDITION_DATE);

    expect(JSON.stringify(run1)).toBe(JSON.stringify(run2));
  });

  it('P5a.2: scoreBatch is idempotent across random row sets', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 8 }), // number of distinct tracks
        fc.integer({ min: 0, max: 5 }),  // seed for variation
        (trackCount, seed) => {
          const rows = Array.from({ length: trackCount }, (_, i) => {
            const idx = i + seed * 100;
            return makeRow({
              normalized_key: `t${idx}::a${idx}`,
              lead_artist_key: `a${idx}`,
              source_count: (idx % 3) + 1,
              occurrence_count: (idx % 5) + 1,
            });
          });

          const airplayMap = new Map<string, AirplayContext>();

          const run1 = scoreBatch(rows, [], airplayMap, AIRPLAY_CONFIG, EDITION_DATE);
          const run2 = scoreBatch(rows, [], airplayMap, AIRPLAY_CONFIG, EDITION_DATE);

          expect(JSON.stringify(run1)).toBe(JSON.stringify(run2));
        },
      ),
      { numRuns: 500 },
    );
  });

  // ── P5b: Shuffle-invariance ────────────────────────────────────────────────

  it('P5b.1: shuffling the input rows does not change the final ranked order', () => {
    const rows = makeDistinctRows(12);
    const prev = makePrevEdition([]);
    const airplayMap = new Map<string, AirplayContext>();

    const original = scoreBatch(rows, prev, airplayMap, AIRPLAY_CONFIG, EDITION_DATE);

    // Try 5 different shuffle seeds
    for (const seed of [17, 42, 99, 137, 256]) {
      const shuffled = shuffleWithSeed(rows, seed);
      const result = scoreBatch(shuffled, prev, airplayMap, AIRPLAY_CONFIG, EDITION_DATE);

      // Same number of results
      expect(result.length).toBe(original.length);

      // Same normalized_keys in the same order
      const origKeys = original.map((r) => r.normalized_key);
      const resultKeys = result.map((r) => r.normalized_key);
      expect(resultKeys).toEqual(origKeys);

      // Same final totals in the same order
      const origTotals = original.map((r) => r.final_total);
      const resultTotals = result.map((r) => r.final_total);
      expect(resultTotals).toEqual(origTotals);
    }
  });

  it('P5b.2: shuffle-invariance holds with previous edition entries', () => {
    const rows = makeDistinctRows(10);
    const prev = makePrevEdition(
      rows.slice(0, 5).map((r, i) => ({ key: r.normalized_key, pos: i + 1 })),
    );
    const airplayMap = new Map<string, AirplayContext>();

    const original = scoreBatch(rows, prev, airplayMap, AIRPLAY_CONFIG, EDITION_DATE);

    for (const seed of [7, 21, 83]) {
      const shuffled = shuffleWithSeed(rows, seed);
      const result = scoreBatch(shuffled, prev, airplayMap, AIRPLAY_CONFIG, EDITION_DATE);

      expect(result.map((r) => r.normalized_key)).toEqual(
        original.map((r) => r.normalized_key),
      );
    }
  });

  it('P5b.3: property-based shuffle-invariance with random track counts', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 2, max: 10 }), // track count
        fc.integer({ min: 1, max: 9999 }), // shuffle seed
        (trackCount, shuffleSeed) => {
          const rows = Array.from({ length: trackCount }, (_, i) =>
            makeRow({
              normalized_key: `prop_t${i}::prop_a${i}`,
              lead_artist_key: `prop_a${i}`,
              source_count: (i % 3) + 1,
              occurrence_count: (i % 5) + 1,
            }),
          );

          const airplayMap = new Map<string, AirplayContext>();

          const original = scoreBatch(rows, [], airplayMap, AIRPLAY_CONFIG, EDITION_DATE);
          const shuffled = shuffleWithSeed(rows, shuffleSeed);
          const result = scoreBatch(shuffled, [], airplayMap, AIRPLAY_CONFIG, EDITION_DATE);

          expect(result.map((r) => r.normalized_key)).toEqual(
            original.map((r) => r.normalized_key),
          );
        },
      ),
      { numRuns: 1000 },
    );
  });

  // ── P5c: normalize is deterministic ───────────────────────────────────────

  it('P5c: build_normalized_key always returns the same key for the same inputs', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 100 }),
        fc.string({ minLength: 1, maxLength: 100 }),
        (title, artist) => {
          const key1 = build_normalized_key(title, artist);
          const key2 = build_normalized_key(title, artist);
          expect(key1).toBe(key2);
        },
      ),
      { numRuns: 2000 },
    );
  });

  // ── P5d: runFullPipeline is deterministic ─────────────────────────────────

  it('P5d: runFullPipeline produces the same ranked keys when called twice', () => {
    const rawEvidence = makeDistinctRows(8).map((row) => ({
      track_title: row.track_title,
      artist_name: row.artist_name,
      source_urls: row.source_urls_seen.length
        ? row.source_urls_seen
        : [`https://chart.test/${row.normalized_key}`],
      release_date: row.release_date,
      canonical_track_id: null,
      canonical_release_id: null,
      canonical_artist_id: null,
      artwork_url: null,
      track_slug: null,
      artist_slug: null,
    }));

    const result1 = runFullPipeline(
      rawEvidence,
      [],
      [],
      new Map(),
      AIRPLAY_CONFIG,
      EDITION_DATE,
    );
    const result2 = runFullPipeline(
      rawEvidence,
      [],
      [],
      new Map(),
      AIRPLAY_CONFIG,
      EDITION_DATE,
    );

    expect(result1.scoredRows.map((r) => r.normalized_key)).toEqual(
      result2.scoredRows.map((r) => r.normalized_key),
    );
    expect(result1.scoredRows.map((r) => r.total_score)).toEqual(
      result2.scoredRows.map((r) => r.total_score),
    );
  });
});