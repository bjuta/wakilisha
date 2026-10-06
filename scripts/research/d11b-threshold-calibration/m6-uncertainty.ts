import { createHash } from "node:crypto";

import {
  m6RankingWeight,
  type D11BModelInput,
  type PlackettLuceFit,
} from "./models";

export const M6_RANK_UNCERTAINTY_VERSION =
  "M6-rank-uncertainty-v1";
export const M6_RANK_UNCERTAINTY_DRAWS = 2_000;

export interface M6TrackUncertainty {
  rankIntervalLower: number;
  rankIntervalUpper: number;
  top10Probability: number;
  top40Probability: number;
}

export interface M6RankUncertaintyResult {
  version: typeof M6_RANK_UNCERTAINTY_VERSION;
  seedHash: string;
  drawCount: number;
  covarianceState: "valid";
  covarianceMethod:
    "inverse-observed-information-fixed-ghost-via-cholesky";
  informationCholeskyMinDiagonal: number | null;
  byTrack: Record<string, M6TrackUncertainty>;
}

function informationMatrix(
  input: D11BModelInput,
  fit: PlackettLuceFit,
  npseudo: number,
  tracks: string[],
): Float64Array[] {
  if (!(npseudo > 0)) {
    throw new Error(
      "m6_uncertainty_requires_positive_pseudo_authority",
    );
  }

  const index = new Map(
    tracks.map((track, position) => [track, position]),
  );
  const theta = tracks.map((track) => {
    const value = fit.referenceRelativeWorthByTrack[track];
    if (!(value > 0) || !Number.isFinite(value)) {
      throw new Error("m6_uncertainty_invalid_reference_worth");
    }
    return value;
  });

  const matrix = Array.from(
    { length: tracks.length },
    () => new Float64Array(tracks.length),
  );

  for (const ranking of input.rankings) {
    const ordered = [...ranking.rows]
      .sort((a, b) => a.rank - b.rank)
      .map((row) => index.get(row.canonicalTrackId))
      .filter((value): value is number => value !== undefined);

    if (ordered.length < 2) continue;

    const weight = m6RankingWeight(ranking.sourceKey);

    for (let stage = 0; stage < ordered.length - 1; stage++) {
      const remaining = ordered.slice(stage);
      const denominator = remaining.reduce(
        (sum, itemIndex) => sum + theta[itemIndex],
        0,
      );

      if (!(denominator > 0) || !Number.isFinite(denominator)) {
        throw new Error("m6_uncertainty_invalid_choice_denominator");
      }

      const probabilities = remaining.map((itemIndex) =>
        theta[itemIndex] / denominator
      );

      for (let a = 0; a < remaining.length; a++) {
        const i = remaining[a];
        const pi = probabilities[a];
        matrix[i][i] += weight * pi * (1 - pi);

        for (let b = a + 1; b < remaining.length; b++) {
          const j = remaining[b];
          const value =
            -weight * pi * probabilities[b];
          matrix[i][j] += value;
          matrix[j][i] += value;
        }
      }
    }
  }

  // D11E primary M6 pseudo authority:
  // npseudo weighted win and npseudo weighted loss versus a
  // hypothetical item with fixed worth 1 (log-worth 0).
  for (let i = 0; i < theta.length; i++) {
    const p = theta[i] / (theta[i] + 1);
    matrix[i][i] += 2 * npseudo * p * (1 - p);
  }

  return matrix;
}

function cholesky(
  matrix: Float64Array[],
): {
  lower: Float64Array[];
  minDiagonal: number | null;
} {
  const n = matrix.length;
  const lower = Array.from(
    { length: n },
    () => new Float64Array(n),
  );
  let minDiagonal = Number.POSITIVE_INFINITY;

  for (let i = 0; i < n; i++) {
    for (let j = 0; j <= i; j++) {
      let value = matrix[i][j];

      for (let k = 0; k < j; k++) {
        value -= lower[i][k] * lower[j][k];
      }

      if (i === j) {
        if (!(value > 0) || !Number.isFinite(value)) {
          throw new Error(
            "m6_uncertainty_information_not_positive_definite",
          );
        }
        lower[i][j] = Math.sqrt(value);
        minDiagonal = Math.min(minDiagonal, lower[i][j]);
      } else {
        const divisor = lower[j][j];
        if (!(divisor > 0) || !Number.isFinite(divisor)) {
          throw new Error(
            "m6_uncertainty_invalid_cholesky_divisor",
          );
        }
        lower[i][j] = value / divisor;
      }
    }
  }

  return {
    lower,
    minDiagonal:
      n === 0 || !Number.isFinite(minDiagonal)
        ? null
        : minDiagonal,
  };
}

function rotateLeft(value: number, shift: number): number {
  return (
    (value << shift) |
    (value >>> (32 - shift))
  ) >>> 0;
}

function deterministicUniform(seedHash: Buffer): () => number {
  let s0 = seedHash.readUInt32BE(0) >>> 0;
  let s1 = seedHash.readUInt32BE(4) >>> 0;
  let s2 = seedHash.readUInt32BE(8) >>> 0;
  let s3 = seedHash.readUInt32BE(12) >>> 0;

  if ((s0 | s1 | s2 | s3) === 0) {
    s0 = 0x9e3779b9;
  }

  return () => {
    const result = Math.imul(
      rotateLeft(Math.imul(s1, 5) >>> 0, 7),
      9,
    ) >>> 0;

    const t = (s1 << 9) >>> 0;
    s2 = (s2 ^ s0) >>> 0;
    s3 = (s3 ^ s1) >>> 0;
    s1 = (s1 ^ s2) >>> 0;
    s0 = (s0 ^ s3) >>> 0;
    s2 = (s2 ^ t) >>> 0;
    s3 = rotateLeft(s3, 11);

    return result / 0x1_0000_0000;
  };
}

function deterministicNormal(
  uniform: () => number,
): () => number {
  let spare: number | null = null;

  return () => {
    if (spare !== null) {
      const value = spare;
      spare = null;
      return value;
    }

    let u1 = uniform();
    const u2 = uniform();
    if (u1 <= 0) u1 = Number.MIN_VALUE;

    const magnitude = Math.sqrt(-2 * Math.log(u1));
    const angle = 2 * Math.PI * u2;
    spare = magnitude * Math.sin(angle);
    return magnitude * Math.cos(angle);
  };
}

function sampleInformationInverse(
  lower: Float64Array[],
  normal: () => number,
): Float64Array {
  const n = lower.length;
  const z = new Float64Array(n);
  const x = new Float64Array(n);

  for (let i = 0; i < n; i++) z[i] = normal();

  // If H = L L^T and z ~ N(0,I), then x = L^-T z
  // has covariance H^-1.
  for (let i = n - 1; i >= 0; i--) {
    let value = z[i];
    for (let j = i + 1; j < n; j++) {
      value -= lower[j][i] * x[j];
    }
    x[i] = value / lower[i][i];
  }

  return x;
}

function histogramQuantile(
  histogram: Uint32Array,
  draws: number,
  probability: number,
): number {
  const target = Math.max(
    1,
    Math.ceil(probability * draws),
  );
  let cumulative = 0;

  for (let rank = 1; rank < histogram.length; rank++) {
    cumulative += histogram[rank];
    if (cumulative >= target) return rank;
  }

  return Math.max(1, histogram.length - 1);
}

function probabilityAtMost(
  histogram: Uint32Array,
  draws: number,
  maximumRank: number,
): number {
  let count = 0;
  const upper = Math.min(
    maximumRank,
    histogram.length - 1,
  );
  for (let rank = 1; rank <= upper; rank++) {
    count += histogram[rank];
  }
  return count / draws;
}

export function simulateM6RankUncertainty(args: {
  input: D11BModelInput;
  fit: PlackettLuceFit;
  modelInputHash: string;
  npseudo?: number;
  draws?: number;
}): M6RankUncertaintyResult {
  if (!args.fit.converged) {
    throw new Error("m6_uncertainty_requires_converged_fit");
  }

  const npseudo = args.npseudo ?? 0.5;
  const draws = args.draws ?? M6_RANK_UNCERTAINTY_DRAWS;

  if (!Number.isInteger(draws) || draws <= 0) {
    throw new Error("m6_uncertainty_invalid_draw_count");
  }

  const tracks = Object.keys(
    args.fit.referenceRelativeWorthByTrack,
  ).sort();

  if (tracks.length === 0) {
    return {
      version: M6_RANK_UNCERTAINTY_VERSION,
      seedHash: createHash("sha256")
        .update(
          args.modelInputHash +
            ":M6-rank-uncertainty-v1",
        )
        .digest("hex"),
      drawCount: draws,
      covarianceState: "valid",
      covarianceMethod:
        "inverse-observed-information-fixed-ghost-via-cholesky",
      informationCholeskyMinDiagonal: null,
      byTrack: {},
    };
  }

  const information = informationMatrix(
    args.input,
    args.fit,
    npseudo,
    tracks,
  );
  const factor = cholesky(information);

  const seedBytes = createHash("sha256")
    .update(
      args.modelInputHash +
        ":M6-rank-uncertainty-v1",
    )
    .digest();
  const seedHash = seedBytes.toString("hex");
  const uniform = deterministicUniform(seedBytes);
  const normal = deterministicNormal(uniform);

  const baseBeta = tracks.map((track) =>
    Math.log(
      args.fit.referenceRelativeWorthByTrack[track],
    )
  );
  const histograms = tracks.map(
    () => new Uint32Array(tracks.length + 1),
  );

  for (let draw = 0; draw < draws; draw++) {
    const noise = sampleInformationInverse(
      factor.lower,
      normal,
    );
    const beta = baseBeta.map(
      (value, index) => value + noise[index],
    );
    const mean =
      beta.reduce((sum, value) => sum + value, 0) /
      beta.length;
    const centered = beta.map((value) => value - mean);

    const order = tracks
      .map((track, index) => ({
        track,
        index,
        beta: centered[index],
      }))
      .sort((a, b) => {
        const delta = b.beta - a.beta;
        if (delta !== 0) return delta;
        return a.track.localeCompare(b.track);
      });

    for (let position = 0; position < order.length; position++) {
      histograms[order[position].index][position + 1]++;
    }
  }

  const byTrack = Object.fromEntries(
    tracks.map((track, index) => {
      const histogram = histograms[index];
      return [
        track,
        {
          rankIntervalLower: histogramQuantile(
            histogram,
            draws,
            0.025,
          ),
          rankIntervalUpper: histogramQuantile(
            histogram,
            draws,
            0.975,
          ),
          top10Probability: probabilityAtMost(
            histogram,
            draws,
            10,
          ),
          top40Probability: probabilityAtMost(
            histogram,
            draws,
            40,
          ),
        },
      ];
    }),
  );

  return {
    version: M6_RANK_UNCERTAINTY_VERSION,
    seedHash,
    drawCount: draws,
    covarianceState: "valid",
    covarianceMethod:
      "inverse-observed-information-fixed-ghost-via-cholesky",
    informationCholeskyMinDiagonal:
      factor.minDiagonal,
    byTrack,
  };
}
