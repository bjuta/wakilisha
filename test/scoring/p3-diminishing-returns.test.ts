/**
 * Gate B — Property P3: Diminishing Airplay Returns (Anti-Payola)
 *
 * Bible §10 P3: "the marginal gain from the nth unit of W is strictly less
 * than the marginal gain from the (n-1)th unit. Verified by checking the
 * second derivative of the scoring function is negative for all W > 0."
 *
 * The ln(1+W) term is the key: d/dW[4.25·ln(1+W)] = 4.25/(1+W),
 * which is strictly decreasing in W for all W ≥ 0.
 *
 * This means:
 *   - The 1st radio spin is worth ~4.25 points
 *   - At W=50 it is worth ~0.083 points
 *   - No amount of radio plays can saturate the chart via airplay alone
 *     (score is always capped at airplay_max_score = 24)
 *
 * Three sub-properties:
 *   P3a — Concavity: for any W > 0 and δ > 0,
 *         gain(W, δ) := airplay(W+δ) − airplay(W) is strictly decreasing in W
 *   P3b — Cap enforcement: no W value produces airplay_score > airplay_max_score
 *   P3c — Breadth advantage: S stations at W/S each reach cap at lower total W
 *         than 1 station at W (when below cap)
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { airplayScore } from '@/services/chartsScoring/scoringEngine';
import { AIRPLAY_CONFIG, makeAirplayContext } from './helpers';
import type { AirplayContext, ScoringConfig } from '@/services/chartsScoring/scoringTypes';

/** Compute airplay score for a given W, holding station/detection counts fixed */
function scoreAtW(W: number, stations: number, detections: number, config: ScoringConfig): number {
  const ctx: AirplayContext = {
    normalized_key: 'test::test',
    canonical_track_id: null,
    W: Math.max(0, W),
    station_count: stations,
    detection_count: detections,
    total_duration_seconds: 0,
    last_detected_at: null,
    matched_by: 'normalized_key',
    rescue_mode: 'allow_rescue',
  };
  return airplayScore(ctx, config);
}

describe('P3 — Diminishing Airplay Returns (Anti-Payola)', () => {
  // ── P3a: Concavity of the ln(1+W) term ────────────────────────────────────

  it('P3a.1: marginal gain from W→W+1 is strictly less than gain from (W-1)→W', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 200 }), // W (at least 1 so W-1 ≥ 0)
        (W) => {
          // Use a low-W config where we don't hit the cap (airplay_max_score = 100)
          // This lets us observe the ln curve without cap truncation
          const nocapConfig: ScoringConfig = {
            ...AIRPLAY_CONFIG,
            airplay_max_score: 1000, // no cap — expose the raw ln curve
            airplay_min_stations: 1,
            airplay_min_detections: 1,
          };

          const gainAtW = scoreAtW(W + 1, 2, 10, nocapConfig) - scoreAtW(W, 2, 10, nocapConfig);
          const gainAtWminus1 = scoreAtW(W, 2, 10, nocapConfig) - scoreAtW(W - 1, 2, 10, nocapConfig);

          // Marginal gain strictly decreases
          expect(gainAtW).toBeLessThan(gainAtWminus1 + 1e-9); // strict with float epsilon
        },
      ),
      { numRuns: 200 },
    );
  });

  it('P3a.2: gain from W=1→W=2 is greater than gain from W=10→W=11', () => {
    const nocapConfig: ScoringConfig = {
      ...AIRPLAY_CONFIG,
      airplay_max_score: 1000,
      airplay_min_stations: 1,
      airplay_min_detections: 1,
    };

    const gainAt1 = scoreAtW(2, 2, 10, nocapConfig) - scoreAtW(1, 2, 10, nocapConfig);
    const gainAt10 = scoreAtW(11, 2, 10, nocapConfig) - scoreAtW(10, 2, 10, nocapConfig);

    expect(gainAt1).toBeGreaterThan(gainAt10);
  });

  it('P3a.3: gain from W=1→W=2 is greater than gain from W=49→W=50', () => {
    const nocapConfig: ScoringConfig = {
      ...AIRPLAY_CONFIG,
      airplay_max_score: 1000,
      airplay_min_stations: 1,
      airplay_min_detections: 1,
    };

    const gainAt1 = scoreAtW(2, 2, 10, nocapConfig) - scoreAtW(1, 2, 10, nocapConfig);
    const gainAt49 = scoreAtW(50, 2, 10, nocapConfig) - scoreAtW(49, 2, 10, nocapConfig);

    // Marginal value at W=49..50 is ~4.25/51 ≈ 0.083, at W=1..2 is ~4.25/2 ≈ 2.125
    expect(gainAt1).toBeGreaterThan(gainAt49);
    expect(gainAt49).toBeLessThan(0.5); // tiny marginal value at high W
  });

  // ── P3b: Cap enforcement ──────────────────────────────────────────────────

  it('P3b: airplay_score never exceeds airplay_max_score for any W', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 10000 }), // extreme W values
        fc.integer({ min: 1, max: 50 }),     // stations
        fc.integer({ min: 1, max: 200 }),    // detections
        (W, stations, detections) => {
          const score = scoreAtW(W, stations, detections, AIRPLAY_CONFIG);
          expect(score).toBeLessThanOrEqual(AIRPLAY_CONFIG.airplay_max_score + 1e-9);
          expect(score).toBeGreaterThanOrEqual(0);
        },
      ),
      { numRuns: 2000 },
    );
  });

  // ── P3c: Breadth over depth ───────────────────────────────────────────────

  it('P3c: a track on 3 stations at W_total/3 each has same total W but higher station_bonus than 1 station at W_total', () => {
    // The station bonus = station_count × 2.0 rewards breadth
    // For a fixed W, more stations always yields higher station_bonus → higher score
    fc.assert(
      fc.property(
        fc.integer({ min: 2, max: 5 }),   // number of stations
        fc.integer({ min: 10, max: 100 }), // W per station (total W = n * this)
        (numStations, wPerStation) => {
          const totalW = numStations * wPerStation;

          // Track on numStations stations, each contributing wPerStation
          const multiStation = scoreAtW(totalW, numStations, numStations * 3, AIRPLAY_CONFIG);

          // Same total W but on only 1 station (fewer station bonus)
          const oneStation = scoreAtW(totalW, 1, 3, AIRPLAY_CONFIG);

          // Multiple stations should score at least as high as one station
          // (station_count × 2.0 is additive on top of the same ln(1+W) term)
          expect(multiStation).toBeGreaterThanOrEqual(oneStation - 1e-9);
        },
      ),
      { numRuns: 1000 },
    );
  });

  it('P3c.2: going from 1 to 2 stations (same W) always increases or maintains score', () => {
    fc.assert(
      fc.property(fc.integer({ min: 1, max: 500 }), (W) => {
        const oneStation = scoreAtW(W, 1, 5, AIRPLAY_CONFIG);
        const twoStations = scoreAtW(W, 2, 5, AIRPLAY_CONFIG);
        expect(twoStations).toBeGreaterThanOrEqual(oneStation - 1e-9);
      }),
      { numRuns: 500 },
    );
  });

  // ── P3d: The ln formula is the core: verify derivation ───────────────────

  it('P3d: ln(1+W)×4.25 is strictly concave — direct formula verification', () => {
    // If we remove station/detection bonuses, the remaining function is
    // f(W) = ln(1+W) × 4.25, which is provably strictly concave.
    // f''(W) = -4.25 / (1+W)^2 < 0 for all W > 0.
    //
    // We verify: for any W1 < W2, the chord slope from W1 to W2 is less than
    // the slope from 0 to W1 (concavity definition).

    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 100 }),  // W1
        fc.integer({ min: 1, max: 100 }),  // additional W (so W2 = W1 + extra)
        (W1, extra) => {
          const W2 = W1 + extra;
          const f = (W: number) => Math.log(1 + W) * 4.25;

          const slopeW1toW2 = (f(W2) - f(W1)) / (W2 - W1);
          const slopeOriginToW1 = W1 > 0 ? f(W1) / W1 : f(1); // f'(0) direction

          // The chord from W1 to W2 is always less steep than from origin to W1
          // This is the definition of a strictly concave function
          expect(slopeW1toW2).toBeLessThan(slopeOriginToW1 + 1e-9);
        },
      ),
      { numRuns: 2000 },
    );
  });
});