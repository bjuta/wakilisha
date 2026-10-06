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
import {
  coordinatedProviderSpike,
  coordinatedSourceSpike,
  deleteProviderSource,
  deleteSource,
  injectOrganicTrackFlood,
  maskDepth,
  removeCanonicalIdentities,
  singleSourceSpike,
  splitCanonicalIdentity,
  thresholdEdgeSwap,
} from "../../scripts/research/d11b-threshold-calibration/stress";
import {
  buildCalibrationModelInput,
} from "../../scripts/research/d11b-threshold-calibration/input";
import {
  buildCalibrationReport,
} from "../../scripts/research/d11b-threshold-calibration/calibrate";
import {
  buildCalibrationReplay,
  type D11BCalibrationSnapshot,
} from "../../scripts/research/d11b-threshold-calibration/replay";

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

    const meanReportedLogWorth =
      Object.values(fit.logWorthByTrack)
        .reduce((sum, value) => sum + value, 0) /
      Object.keys(fit.logWorthByTrack).length;
    expect(meanReportedLogWorth).toBeCloseTo(0, 12);
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


describe("D11B calibration stress transforms", () => {
  const base = input([
    {
      sourceKey: "youtube_weekly_ke",
      depth: 4,
      rows: [
        { canonicalTrackId: "a", rank: 1 },
        { canonicalTrackId: "b", rank: 2 },
        { canonicalTrackId: "c", rank: 3 },
        { canonicalTrackId: "d", rank: 4 },
      ],
    },
    {
      sourceKey: "audiomack_weekly100_ke",
      depth: 4,
      rows: [
        { canonicalTrackId: "b", rank: 1 },
        { canonicalTrackId: "a", rank: 2 },
        { canonicalTrackId: "d", rank: 3 },
        { canonicalTrackId: "c", rank: 4 },
      ],
    },
    {
      sourceKey: APPLE_DAYS[0],
      depth: 4,
      rows: [
        { canonicalTrackId: "a", rank: 1 },
        { canonicalTrackId: "c", rank: 2 },
        { canonicalTrackId: "b", rank: 3 },
        { canonicalTrackId: "d", rank: 4 },
      ],
    },
  ]);

  it("provider-level Apple deletion removes every Apple checkpoint together", () => {
    const appleComplete = input([
      {
        sourceKey: "youtube_weekly_ke",
        depth: 2,
        rows: [
          { canonicalTrackId: "a", rank: 1 },
          { canonicalTrackId: "b", rank: 2 },
        ],
      },
      {
        sourceKey: "audiomack_weekly100_ke",
        depth: 2,
        rows: [
          { canonicalTrackId: "b", rank: 1 },
          { canonicalTrackId: "a", rank: 2 },
        ],
      },
      ...APPLE_DAYS.map((sourceKey) => ({
        sourceKey,
        depth: 2,
        rows: [
          { canonicalTrackId: "a", rank: 1 },
          { canonicalTrackId: "b", rank: 2 },
        ],
      })),
    ]);

    const stressed = deleteProviderSource(appleComplete, "apple");

    expect(
      stressed.rankings.some((ranking) =>
        ranking.sourceKey.startsWith("apple_top100_ke:")
      ),
    ).toBe(false);
    expect(
      stressed.expectedSourceKeys.filter((sourceKey) =>
        sourceKey.startsWith("apple_top100_ke:")
      ),
    ).toHaveLength(7);

    const row = runM1(stressed)
      .find((candidate) => candidate.canonicalTrackId === "a")!;
    expect(row.upper!).toBeGreaterThan(row.lower!);
  });

  it("coordinated provider spikes treat all Apple checkpoints as one provider source", () => {
    const appleComplete = input([
      {
        sourceKey: "youtube_weekly_ke",
        depth: 2,
        rows: [
          { canonicalTrackId: "a", rank: 1 },
          { canonicalTrackId: "b", rank: 2 },
        ],
      },
      ...APPLE_DAYS.map((sourceKey) => ({
        sourceKey,
        depth: 2,
        rows: [
          { canonicalTrackId: "a", rank: 1 },
          { canonicalTrackId: "b", rank: 2 },
        ],
      })),
    ]);

    const stressed = coordinatedProviderSpike(
      appleComplete,
      ["youtube", "apple"],
      "b",
      1,
    );

    expect(
      stressed.rankings
        .filter((ranking) =>
          ranking.sourceKey === "youtube_weekly_ke" ||
          ranking.sourceKey.startsWith("apple_top100_ke:")
        )
        .every((ranking) => ranking.rows[0].canonicalTrackId === "b"),
    ).toBe(true);
  });

  it("source deletion preserves expected-source missingness", () => {
    const stressed = deleteSource(base, "youtube_weekly_ke");
    expect(stressed.expectedSourceKeys).toContain("youtube_weekly_ke");
    expect(
      stressed.rankings.some((ranking) =>
        ranking.sourceKey === "youtube_weekly_ke"
      ),
    ).toBe(false);

    const row = runM1(stressed)
      .find((candidate) => candidate.canonicalTrackId === "a")!;
    expect(row.upper!).toBeGreaterThan(row.lower!);
  });

  it("depth masking truncates observation authority instead of zero-filling", () => {
    const stressed = maskDepth(base, 2);
    expect(stressed.rankings.every((ranking) => ranking.depth === 2)).toBe(true);
    expect(
      stressed.rankings.every((ranking) =>
        ranking.rows.every((row) => row.rank <= 2)
      ),
    ).toBe(true);
    expect(
      stressed.rankings.some((ranking) =>
        ranking.rows.some((row) => row.canonicalTrackId === "d")
      ),
    ).toBe(false);
  });

  it("identity unresolved perturbation removes evidence rather than fuzzy-merging", () => {
    const stressed = removeCanonicalIdentities(base, ["a"]);
    expect(
      stressed.rankings.some((ranking) =>
        ranking.rows.some((row) => row.canonicalTrackId === "a")
      ),
    ).toBe(false);
  });

  it("identity splitting fragments one canonical signal across synthetic identities", () => {
    const stressed = splitCanonicalIdentity(base, "a", ["a-split-1", "a-split-2"]);
    const observed = stressed.rankings.flatMap((ranking) =>
      ranking.rows.map((row) => row.canonicalTrackId)
    );
    expect(observed).not.toContain("a");
    expect(observed).toContain("a-split-1");
    expect(observed).toContain("a-split-2");
  });

  it("stress injection preserves sparse provider ranks instead of compacting them", () => {
    const sparse = input([
      {
        sourceKey: "youtube_weekly_ke",
        depth: 100,
        rows: [
          { canonicalTrackId: "a", rank: 1 },
          { canonicalTrackId: "b", rank: 50 },
          { canonicalTrackId: "c", rank: 100 },
        ],
      },
    ]);

    const stressed = singleSourceSpike(
      sparse,
      "youtube_weekly_ke",
      "c",
      1,
    );
    const rows = stressed.rankings[0].rows;

    expect(rows).toEqual([
      { canonicalTrackId: "c", rank: 1 },
      { canonicalTrackId: "a", rank: 2 },
      { canonicalTrackId: "b", rank: 51 },
    ]);
  });

  it("single-source spikes do not alter undeclared source rankings", () => {
    const stressed = singleSourceSpike(
      base,
      "youtube_weekly_ke",
      "d",
      1,
    );

    expect(
      stressed.rankings.find((ranking) =>
        ranking.sourceKey === "youtube_weekly_ke"
      )!.rows[0].canonicalTrackId,
    ).toBe("d");

    expect(
      stressed.rankings.find((ranking) =>
        ranking.sourceKey === "audiomack_weekly100_ke"
      ),
    ).toEqual(
      base.rankings.find((ranking) =>
        ranking.sourceKey === "audiomack_weekly100_ke"
      ),
    );
  });

  it("coordinated spikes affect only the declared source set", () => {
    const stressed = coordinatedSourceSpike(
      base,
      ["youtube_weekly_ke", "audiomack_weekly100_ke"],
      "d",
      1,
    );

    expect(
      stressed.rankings
        .filter((ranking) =>
          ranking.sourceKey === "youtube_weekly_ke" ||
          ranking.sourceKey === "audiomack_weekly100_ke"
        )
        .every((ranking) => ranking.rows[0].canonicalTrackId === "d"),
    ).toBe(true);

    expect(
      stressed.rankings.find((ranking) => ranking.sourceKey === APPLE_DAYS[0]),
    ).toEqual(
      base.rankings.find((ranking) => ranking.sourceKey === APPLE_DAYS[0]),
    );
  });

  it("organic flooding remains valid rank evidence with no concentration penalty", () => {
    const stressed = injectOrganicTrackFlood(
      base,
      ["youtube_weekly_ke", "audiomack_weekly100_ke"],
      ["flood-1", "flood-2", "flood-3", "flood-4"],
      1,
    );

    const rows = runM4(stressed);
    for (const track of ["flood-1", "flood-2", "flood-3", "flood-4"]) {
      expect(rows.some((row) => row.canonicalTrackId === track)).toBe(true);
    }
  });

  it("threshold-edge perturbation swaps only the declared boundary pair", () => {
    const stressed = thresholdEdgeSwap(
      base,
      "youtube_weekly_ke",
      2,
    );
    const rows = stressed.rankings.find((ranking) =>
      ranking.sourceKey === "youtube_weekly_ke"
    )!.rows;

    expect(rows.find((row) => row.rank === 2)!.canonicalTrackId).toBe("c");
    expect(rows.find((row) => row.rank === 3)!.canonicalTrackId).toBe("b");
    expect(rows.find((row) => row.rank === 1)!.canonicalTrackId).toBe("a");
    expect(rows.find((row) => row.rank === 4)!.canonicalTrackId).toBe("d");
  });
});


describe("D11B calibration identity input authority", () => {
  it("accepts explicit external Registry snapshot mappings for unresolved rows", () => {
    const receipt = buildCalibrationModelInput({
      expectedSourceKeys: ["youtube_weekly_ke"],
      sourceRuns: [{
        id: "run-youtube",
        sourceKey: "youtube_weekly_ke",
        chartDepth: 100,
      }],
      observations: [
        {
          sourceRunId: "run-youtube",
          providerRowKey: "youtube:video-a",
          providerTrackId: "video-a",
          rank: 1,
          identityStatus: "unresolved",
          canonicalTrackId: null,
        },
        {
          sourceRunId: "run-youtube",
          providerRowKey: "youtube:video-b",
          providerTrackId: "video-b",
          rank: 2,
          identityStatus: "resolved",
          canonicalTrackId: "track-b",
        },
      ],
      admittedSourceRunIds: ["run-youtube"],
      externalIdentityResolutions: [{
        providerRowKey: "youtube:video-a",
        canonicalTrackId: "track-a",
        authority: "production-registry-snapshot:test",
      }],
    });

    expect(receipt.externalResolutionCount).toBe(1);
    expect(receipt.resolvedObservationCount).toBe(1);
    expect(receipt.unresolvedObservationCount).toBe(1);
    expect(receipt.modelInput.rankings[0].rows).toEqual([
      { canonicalTrackId: "track-a", rank: 1 },
      { canonicalTrackId: "track-b", rank: 2 },
    ]);
  });

  it("never overrides quarantined identity with an external mapping", () => {
    const receipt = buildCalibrationModelInput({
      expectedSourceKeys: ["youtube_weekly_ke"],
      sourceRuns: [{
        id: "run-youtube",
        sourceKey: "youtube_weekly_ke",
        chartDepth: 100,
      }],
      observations: [{
        sourceRunId: "run-youtube",
        providerRowKey: "youtube:ambiguous",
        providerTrackId: "ambiguous",
        rank: 1,
        identityStatus: "quarantined",
        canonicalTrackId: null,
      }],
      admittedSourceRunIds: ["run-youtube"],
      externalIdentityResolutions: [{
        providerRowKey: "youtube:ambiguous",
        canonicalTrackId: "track-should-not-enter",
        authority: "production-registry-snapshot:test",
      }],
    });

    expect(receipt.quarantinedObservationCount).toBe(1);
    expect(receipt.externalResolutionCount).toBe(0);
    expect(receipt.modelInput.rankings[0].rows).toEqual([]);
  });

  it("requires source admissibility to be supplied explicitly", () => {
    const receipt = buildCalibrationModelInput({
      expectedSourceKeys: [
        "youtube_weekly_ke",
        "audiomack_weekly100_ke",
      ],
      sourceRuns: [
        {
          id: "run-youtube",
          sourceKey: "youtube_weekly_ke",
          chartDepth: 100,
        },
        {
          id: "run-audiomack",
          sourceKey: "audiomack_weekly100_ke",
          chartDepth: 100,
        },
      ],
      observations: [
        {
          sourceRunId: "run-youtube",
          providerRowKey: "youtube:a",
          providerTrackId: "a",
          rank: 1,
          identityStatus: "resolved",
          canonicalTrackId: "track-a",
        },
        {
          sourceRunId: "run-audiomack",
          providerRowKey: "audiomack:a",
          providerTrackId: "a",
          rank: 1,
          identityStatus: "resolved",
          canonicalTrackId: "track-a",
        },
      ],
      admittedSourceRunIds: ["run-youtube"],
    });

    expect(receipt.admittedSourceRunCount).toBe(1);
    expect(receipt.expectedSourceCount).toBe(2);
    expect(receipt.modelInput.rankings.map((ranking) => ranking.sourceKey))
      .toEqual(["youtube_weekly_ke"]);
  });
});


describe("D11B calibration orchestration authority", () => {
  const calibrationInput = input([
    {
      sourceKey: "youtube_weekly_ke",
      depth: 4,
      rows: [
        { canonicalTrackId: "a", rank: 1 },
        { canonicalTrackId: "b", rank: 2 },
        { canonicalTrackId: "c", rank: 3 },
        { canonicalTrackId: "d", rank: 4 },
      ],
    },
    {
      sourceKey: "audiomack_weekly100_ke",
      depth: 4,
      rows: [
        { canonicalTrackId: "b", rank: 1 },
        { canonicalTrackId: "a", rank: 2 },
        { canonicalTrackId: "d", rank: 3 },
        { canonicalTrackId: "c", rank: 4 },
      ],
    },
    {
      sourceKey: APPLE_DAYS[0],
      depth: 4,
      rows: [
        { canonicalTrackId: "a", rank: 1 },
        { canonicalTrackId: "c", rank: 2 },
        { canonicalTrackId: "b", rank: 3 },
        { canonicalTrackId: "d", rank: 4 },
      ],
    },
  ]);

  it("emits all frozen models but no winner", () => {
    const report = buildCalibrationReport(calibrationInput);

    expect(report.models.map((model) => model.modelId))
      .toEqual(["M1", "M2", "M4", "M6"]);
    expect(report.winner).toBeNull();
    expect(report.confirmatory).toBe(false);
  });

  it("keeps every L036 proposal unresolved before complete calibration evidence", () => {
    const report = buildCalibrationReport(calibrationInput);

    expect(report.thresholdProposals.length).toBeGreaterThan(0);
    expect(
      report.thresholdProposals.every((proposal) =>
        proposal.status === "UNRESOLVED"
      ),
    ).toBe(true);

    const serialized = JSON.stringify(report.thresholdProposals);
    expect(serialized).not.toMatch(
      /"green"\s*:|"amber"\s*:|"red"\s*:|"threshold"\s*:\s*\d/i,
    );
  });

  it("produces deterministic report and model-output hashes", () => {
    const first = buildCalibrationReport(calibrationInput);
    const second = buildCalibrationReport(calibrationInput);

    expect(first.reportHash).toBe(second.reportHash);
    expect(first.inputHash).toBe(second.inputHash);
    expect(first.models.map((model) => model.outputHash))
      .toEqual(second.models.map((model) => model.outputHash));
    expect(first.reportHash).toMatch(/^[a-f0-9]{64}$/);
  });

  it("uses the three-provider source constitution for deletion and pair attacks", () => {
    const report = buildCalibrationReport(calibrationInput);

    const deletions = report.stresses.filter((stress) =>
      stress.stressType === "source_deletion" &&
      stress.modelId === "M1"
    );
    expect(deletions.map((stress) => stress.parameters.provider))
      .toEqual(["youtube", "audiomack", "apple"]);

    const pairAttacks = report.stresses.filter((stress) =>
      stress.modelId === "M1" &&
      stress.parameters.attack === "D09-A3-coordinated-two-source-spike"
    );
    expect(pairAttacks.map((stress) => stress.parameters.providers))
      .toEqual([
        ["youtube", "audiomack"],
        ["youtube", "apple"],
        ["audiomack", "apple"],
      ]);
  });

  it("records the organic multi-track demand negative control separately", () => {
    const report = buildCalibrationReport(calibrationInput);
    const controls = report.stresses.filter((stress) =>
      stress.modelId === "M1" &&
      stress.parameters.negativeControl === true
    );

    expect(controls).toHaveLength(1);
    expect(controls[0].parameters.scenario)
      .toBe("D09-organic-artist-release-flood");
    expect(controls[0].parameters.expectedPolicy)
      .toContain("no concentration penalty");
  });

  it("records source-deletion, censoring, identity and integrity stress families", () => {
    const report = buildCalibrationReport(calibrationInput);
    const types = new Set(report.stresses.map((stress) => stress.stressType));

    expect(types).toEqual(new Set([
      "source_deletion",
      "censoring_mask",
      "identity_perturbation",
      "integrity_attack",
    ]));

    expect(
      report.stresses.some((stress) =>
        stress.parameters.attack === "D09-A1-single-source-jump"
      ),
    ).toBe(true);
    expect(
      report.stresses.some((stress) =>
        stress.parameters.attack === "D09-A3-coordinated-two-source-spike"
      ),
    ).toBe(true);
  });

  it("surfaces threshold-edge evidence gaps after sparse identity filtering", () => {
    const sparse = input([
      {
        sourceKey: "youtube_weekly_ke",
        depth: 100,
        rows: [
          { canonicalTrackId: "a", rank: 1 },
          { canonicalTrackId: "b", rank: 50 },
          { canonicalTrackId: "c", rank: 100 },
        ],
      },
    ]);

    const report = buildCalibrationReport(sparse);
    expect(report.stressGaps).toContainEqual({
      stressId: "threshold-edge:youtube_weekly_ke:50",
      reason: "boundary_pair_unavailable_after_identity_filtering",
      parameters: {
        sourceKey: "youtube_weekly_ke",
        boundaryRank: 50,
      },
    });
  });
});

describe("D11B calibration replay authority", () => {
  function snapshot(args: {
    expectedSourceKeys?: D11BCalibrationSnapshot["expectedSourceKeys"];
    sourceRuns?: D11BCalibrationSnapshot["sourceRuns"];
    observations?: D11BCalibrationSnapshot["observations"];
    admittedSourceRunIds?: string[];
    externalIdentityResolutions?: D11BCalibrationSnapshot["externalIdentityResolutions"];
  } = {}): D11BCalibrationSnapshot {
    return {
      snapshotVersion: "d11b-calibration-snapshot-v1",
      windowId: "window-test",
      phase: "engineering_pilot",
      sourcePolicyVersion: "d11b-source-v1",
      analysisCommit: "test-analysis-commit",
      expectedSourceKeys: args.expectedSourceKeys ?? [
        "youtube_weekly_ke",
      ],
      sourceRuns: args.sourceRuns ?? [{
        id: "run-youtube",
        sourceKey: "youtube_weekly_ke",
        chartDepth: 100,
        fetchStatus: "succeeded",
        parseStatus: "succeeded",
        healthState: "healthy",
        rowCount: 2,
      }],
      observations: args.observations ?? [
        {
          sourceRunId: "run-youtube",
          providerRowKey: "youtube:a",
          providerTrackId: "a",
          rank: 1,
          identityStatus: "resolved",
          canonicalTrackId: "track-a",
        },
        {
          sourceRunId: "run-youtube",
          providerRowKey: "youtube:b",
          providerTrackId: "b",
          rank: 2,
          identityStatus: "resolved",
          canonicalTrackId: "track-b",
        },
      ],
      admittedSourceRunIds: args.admittedSourceRunIds ?? [
        "run-youtube",
      ],
      externalIdentityResolutions:
        args.externalIdentityResolutions ?? [],
      identitySnapshotHash: "identity-snapshot-test",
    };
  }

  it("marks incomplete engineering-pilot evidence as partial and non-confirmatory", () => {
    const replay = buildCalibrationReplay(snapshot({
      expectedSourceKeys: [
        "youtube_weekly_ke",
        "audiomack_weekly100_ke",
      ],
    }));

    expect(replay.evidenceCompleteness.completeWindowEvidence).toBe(false);
    expect(replay.evidenceCompleteness.missingSourceKeys)
      .toEqual(["audiomack_weekly100_ke"]);
    expect(replay.readiness.state).toBe("PARTIAL_WINDOW");
    expect(replay.readiness.confirmatoryAuthority).toBe(false);
    expect(replay.readiness.l036IdentityThresholdStatus)
      .toBe("UNRESOLVED");
    expect(replay.calibrationReport.winner).toBeNull();
  });

  it("blocks structurally sparse admitted identity evidence without inventing a threshold", () => {
    const replay = buildCalibrationReplay(snapshot({
      observations: [{
        sourceRunId: "run-youtube",
        providerRowKey: "youtube:a",
        providerTrackId: "a",
        rank: 1,
        identityStatus: "resolved",
        canonicalTrackId: "track-a",
      }],
    }));

    expect(replay.evidenceCompleteness.completeWindowEvidence).toBe(true);
    expect(replay.readiness.state).toBe("BLOCKED_IDENTITY_STRUCTURE");
    expect(replay.readiness.reasons)
      .toContain("fewer_than_two_usable_identity_rows:youtube_weekly_ke");
    expect(replay.readiness.l036IdentityThresholdStatus)
      .toBe("UNRESOLVED");
  });

  it("reports external strong identity coverage separately from native resolution", () => {
    const replay = buildCalibrationReplay(snapshot({
      observations: [
        {
          sourceRunId: "run-youtube",
          providerRowKey: "youtube:a",
          providerTrackId: "a",
          rank: 1,
          identityStatus: "unresolved",
          canonicalTrackId: null,
        },
        {
          sourceRunId: "run-youtube",
          providerRowKey: "youtube:b",
          providerTrackId: "b",
          rank: 2,
          identityStatus: "resolved",
          canonicalTrackId: "track-b",
        },
      ],
      externalIdentityResolutions: [{
        providerRowKey: "youtube:a",
        canonicalTrackId: "track-a",
        authority: "exact-provider-id:test",
      }],
    }));

    expect(replay.inputReceipt.nativeResolvedObservationCount).toBe(1);
    expect(replay.inputReceipt.externalResolutionCount).toBe(1);
    expect(replay.inputReceipt.effectiveResolvedObservationCount).toBe(2);
    expect(replay.identityCoverage[0]).toMatchObject({
      nativeResolvedRows: 1,
      externalResolvedRows: 1,
      effectiveResolvedRows: 2,
      usableModelRows: 2,
    });
    expect(replay.readiness.state).toBe("CALIBRATION_ONLY");
  });

  it("produces deterministic snapshot, report and replay hashes", () => {
    const first = buildCalibrationReplay(snapshot());
    const second = buildCalibrationReplay(snapshot());

    expect(first.snapshotHash).toBe(second.snapshotHash);
    expect(first.calibrationReport.reportHash)
      .toBe(second.calibrationReport.reportHash);
    expect(first.replayHash).toBe(second.replayHash);
    expect(first.replayHash).toMatch(/^[a-f0-9]{64}$/);
  });

  it("rejects failed source runs from explicit model admission", () => {
    expect(() => buildCalibrationReplay(snapshot({
      sourceRuns: [{
        id: "run-youtube",
        sourceKey: "youtube_weekly_ke",
        chartDepth: 100,
        fetchStatus: "failed",
        parseStatus: "not_applicable",
        healthState: "down",
        rowCount: 0,
      }],
      observations: [],
    }))).toThrow(
      "admitted_source_fetch_not_succeeded:youtube_weekly_ke",
    );
  });
});
