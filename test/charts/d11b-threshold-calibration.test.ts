import { describe, expect, it } from "vitest";
import {
  fitM6,
  runM1,
  runM2,
  runM4,
  type D11BModelInput,
} from "../../scripts/research/d11b-threshold-calibration/models";
import {
  compareRankings,
  rankingOutputHash,
} from "../../scripts/research/d11b-threshold-calibration/metrics";

const APPLE_DAYS = Array.from(
  { length: 7 },
  (_, index) => `apple_top100_ke:2026-10-${String(index + 2).padStart(2, "0")}` as const,
);

function input(
  rankings: D11BModelInput["rankings"],
): D11BModelInput {
  return {
    expectedSourceKeys: [
      "youtube_weekly_ke",
      "audiomack_weekly100_ke",
      ...APPLE_DAYS,
    ],
    rankings,
  };
}

describe("D11B frozen model kernels", () => {
  it("caps seven Apple days to one source in M1", () => {
    const rankings: D11BModelInput["rankings"] = [
      {
        sourceKey: "youtube_weekly_ke",
        depth: 100,
        rows: [
          { canonicalTrackId: "youtube-track", rank: 1 },
          { canonicalTrackId: "apple-track", rank: 100 },
        ],
      },
      {
        sourceKey: "audiomack_weekly100_ke",
        depth: 100,
        rows: [
          { canonicalTrackId: "youtube-track", rank: 1 },
          { canonicalTrackId: "apple-track", rank: 100 },
        ],
      },
      ...APPLE_DAYS.map((sourceKey) => ({
        sourceKey,
        depth: 100,
        rows: [
          { canonicalTrackId: "apple-track", rank: 1 },
          { canonicalTrackId: "youtube-track", rank: 100 },
        ],
      })),
    ];

    const rows = runM1(input(rankings));
    const apple = rows.find((row) => row.canonicalTrackId === "apple-track")!;
    const youtube = rows.find((row) => row.canonicalTrackId === "youtube-track")!;

    expect(apple.lower).toBeCloseTo((1 / 3) + (2 / 3) * 0.01, 12);
    expect(youtube.lower).toBeCloseTo((2 / 3) + (1 / 3) * 0.01, 12);
    expect(youtube.rank).toBe(1);
  });

  it("does not redistribute a missing Apple day in M1", () => {
    const rankings: D11BModelInput["rankings"] = [
      {
        sourceKey: "youtube_weekly_ke",
        depth: 100,
        rows: [{ canonicalTrackId: "a", rank: 1 }],
      },
      {
        sourceKey: "audiomack_weekly100_ke",
        depth: 100,
        rows: [{ canonicalTrackId: "a", rank: 1 }],
      },
      ...APPLE_DAYS.slice(0, 6).map((sourceKey) => ({
        sourceKey,
        depth: 100,
        rows: [{ canonicalTrackId: "a", rank: 1 }],
      })),
    ];

    const row = runM1(input(rankings))[0];
    expect(row.lower).toBeCloseTo(20 / 21, 12);
    expect(row.upper).toBeCloseTo(1, 12);
  });

  it("gives video family half of M2 and audio family half", () => {
    const rankings: D11BModelInput["rankings"] = [
      {
        sourceKey: "youtube_weekly_ke",
        depth: 100,
        rows: [
          { canonicalTrackId: "video", rank: 1 },
          { canonicalTrackId: "audio", rank: 100 },
        ],
      },
      {
        sourceKey: "audiomack_weekly100_ke",
        depth: 100,
        rows: [
          { canonicalTrackId: "audio", rank: 1 },
          { canonicalTrackId: "video", rank: 100 },
        ],
      },
      ...APPLE_DAYS.map((sourceKey) => ({
        sourceKey,
        depth: 100,
        rows: [
          { canonicalTrackId: "audio", rank: 1 },
          { canonicalTrackId: "video", rank: 100 },
        ],
      })),
    ];

    const rows = runM2(input(rankings));
    const audio = rows.find((row) => row.canonicalTrackId === "audio")!;
    const video = rows.find((row) => row.canonicalTrackId === "video")!;

    expect(audio.lower).toBeCloseTo(0.5 + 0.5 * 0.01, 12);
    expect(video.lower).toBeCloseTo(0.5 + 0.5 * 0.01, 12);
    expect(audio.rank).toBe(video.rank);
  });

  it("keeps M4 as an unnormalized positional baseline", () => {
    const rows = runM4(input([
      {
        sourceKey: "youtube_weekly_ke",
        depth: 100,
        rows: [
          { canonicalTrackId: "deep", rank: 50 },
          { canonicalTrackId: "shallow", rank: 100 },
        ],
      },
      {
        sourceKey: "audiomack_weekly100_ke",
        depth: 20,
        rows: [
          { canonicalTrackId: "shallow", rank: 1 },
          { canonicalTrackId: "deep", rank: 20 },
        ],
      },
    ]));

    expect(rows.find((row) => row.canonicalTrackId === "deep")!.score)
      .toBe(52);
    expect(rows.find((row) => row.canonicalTrackId === "shallow")!.score)
      .toBe(21);
  });

  it("recovers a stable M6 ordering from consistent partial rankings", () => {
    const fit = fitM6(input([
      {
        sourceKey: "youtube_weekly_ke",
        depth: 3,
        rows: [
          { canonicalTrackId: "a", rank: 1 },
          { canonicalTrackId: "b", rank: 2 },
          { canonicalTrackId: "c", rank: 3 },
        ],
      },
      {
        sourceKey: "audiomack_weekly100_ke",
        depth: 3,
        rows: [
          { canonicalTrackId: "a", rank: 1 },
          { canonicalTrackId: "b", rank: 2 },
          { canonicalTrackId: "c", rank: 3 },
        ],
      },
      {
        sourceKey: APPLE_DAYS[0],
        depth: 3,
        rows: [
          { canonicalTrackId: "a", rank: 1 },
          { canonicalTrackId: "b", rank: 2 },
          { canonicalTrackId: "c", rank: 3 },
        ],
      },
    ]));

    expect(fit.converged).toBe(true);
    expect(fit.rows.map((row) => row.canonicalTrackId))
      .toEqual(["a", "b", "c"]);
    expect(fit.normalizedWorthByTrack.a)
      .toBeGreaterThan(fit.normalizedWorthByTrack.b);
    expect(fit.normalizedWorthByTrack.b)
      .toBeGreaterThan(fit.normalizedWorthByTrack.c);
  });

  it("keeps M6 primary npseudo fixed while allowing explicit sensitivity fits", () => {
    const source = input([
      {
        sourceKey: "youtube_weekly_ke",
        depth: 3,
        rows: [
          { canonicalTrackId: "a", rank: 1 },
          { canonicalTrackId: "b", rank: 2 },
          { canonicalTrackId: "c", rank: 3 },
        ],
      },
    ]);

    const primary = fitM6(source);
    const sensitivity = fitM6(source, { npseudo: 1 });

    expect(primary.converged).toBe(true);
    expect(sensitivity.converged).toBe(true);
    expect(primary.rows.map((row) => row.canonicalTrackId))
      .toEqual(sensitivity.rows.map((row) => row.canonicalTrackId));
    expect(primary.normalizedWorthByTrack.a)
      .not.toBe(sensitivity.normalizedWorthByTrack.a);
  });
});

describe("D11B calibration metrics", () => {
  it("computes source-deletion overlap and displacement deterministically", () => {
    const baseline = [
      { canonicalTrackId: "a", rank: 1, score: 4 },
      { canonicalTrackId: "b", rank: 2, score: 3 },
      { canonicalTrackId: "c", rank: 3, score: 2 },
      { canonicalTrackId: "d", rank: 4, score: 1 },
    ];
    const stressed = [
      { canonicalTrackId: "b", rank: 1, score: 4 },
      { canonicalTrackId: "a", rank: 2, score: 3 },
      { canonicalTrackId: "d", rank: 3, score: 2 },
      { canonicalTrackId: "c", rank: 4, score: 1 },
    ];

    const metrics = compareRankings(baseline, stressed);
    expect(metrics.top10Overlap).toBe(1);
    expect(metrics.medianAbsoluteRankDisplacement).toBe(1);
    expect(metrics.maximumRankDisplacement).toBe(1);
    expect(metrics.top100EntryCount).toBe(0);
    expect(metrics.top100ExitCount).toBe(0);
  });

  it("produces byte-stable canonical hashes", () => {
    const a = [
      { canonicalTrackId: "b", rank: 2, score: 0.25 },
      { canonicalTrackId: "a", rank: 1, score: 0.75 },
    ];
    const b = [...a].reverse();

    expect(rankingOutputHash(a)).toBe(rankingOutputHash(b));
    expect(rankingOutputHash(a)).toMatch(/^[a-f0-9]{64}$/);
  });
});
