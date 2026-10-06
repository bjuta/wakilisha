export type D11BSourceKey =
  | "youtube_weekly_ke"
  | "audiomack_weekly100_ke"
  | `apple_top100_ke:${string}`;

export interface RankedObservation {
  sourceKey: D11BSourceKey;
  depth: number;
  rows: Array<{
    canonicalTrackId: string;
    rank: number;
  }>;
}

export interface D11BModelInput {
  expectedSourceKeys: D11BSourceKey[];
  rankings: RankedObservation[];
}

export interface RankedModelRow {
  canonicalTrackId: string;
  rank: number;
  score: number;
  lower?: number;
  upper?: number;
}

export interface PlackettLuceFit {
  rows: RankedModelRow[];
  converged: boolean;
  iterations: number;
  maxLogWorthDelta: number;
  normalizedWorthByTrack: Record<string, number>;
}

const YOUTUBE = "youtube_weekly_ke";
const AUDIOMACK = "audiomack_weekly100_ke";

function isApple(sourceKey: string): boolean {
  return sourceKey.startsWith("apple_top100_ke:");
}

function assertInput(input: D11BModelInput): void {
  const expected = new Set(input.expectedSourceKeys);
  if (expected.size !== input.expectedSourceKeys.length) {
    throw new Error("duplicate_expected_source_key");
  }

  for (const ranking of input.rankings) {
    if (!expected.has(ranking.sourceKey)) {
      throw new Error(`unexpected_source_key:${ranking.sourceKey}`);
    }
    if (!Number.isInteger(ranking.depth) || ranking.depth <= 0) {
      throw new Error("invalid_ranking_depth");
    }

    const ranks = new Set<number>();
    const tracks = new Set<string>();
    for (const row of ranking.rows) {
      if (!row.canonicalTrackId) throw new Error("missing_canonical_track_id");
      if (!Number.isInteger(row.rank) || row.rank <= 0 || row.rank > ranking.depth) {
        throw new Error("invalid_provider_rank");
      }
      if (ranks.has(row.rank)) throw new Error("provider_tie_or_duplicate_rank");
      if (tracks.has(row.canonicalTrackId)) throw new Error("duplicate_track_in_ranking");
      ranks.add(row.rank);
      tracks.add(row.canonicalTrackId);
    }
  }
}

function universe(input: D11BModelInput): string[] {
  return [...new Set(
    input.rankings.flatMap((ranking) =>
      ranking.rows.map((row) => row.canonicalTrackId)
    ),
  )].sort();
}

function rankingMap(input: D11BModelInput): Map<string, RankedObservation> {
  return new Map(input.rankings.map((ranking) => [ranking.sourceKey, ranking]));
}

function normalizedRank(rank: number, depth: number): number {
  return (depth - rank + 1) / depth;
}

function rankWithCompetition(
  scored: Array<{ canonicalTrackId: string; score: number }>,
): RankedModelRow[] {
  const ordered = [...scored].sort((a, b) => {
    const delta = b.score - a.score;
    if (delta !== 0) return delta;
    return a.canonicalTrackId.localeCompare(b.canonicalTrackId);
  });

  let previousScore: number | undefined;
  let previousRank = 0;

  return ordered.map((row, index) => {
    const rank =
      previousScore !== undefined && row.score === previousScore
        ? previousRank
        : index + 1;
    previousScore = row.score;
    previousRank = rank;
    return { ...row, rank };
  });
}

function fixedWeightM1(sourceKey: D11BSourceKey): number {
  if (sourceKey === YOUTUBE || sourceKey === AUDIOMACK) return 1 / 3;
  if (isApple(sourceKey)) return 1 / 21;
  throw new Error(`unknown_source_key:${sourceKey}`);
}

function fixedWeightM2(sourceKey: D11BSourceKey): number {
  if (sourceKey === YOUTUBE) return 1 / 2;
  if (sourceKey === AUDIOMACK) return 1 / 4;
  if (isApple(sourceKey)) return 1 / 28;
  throw new Error(`unknown_source_key:${sourceKey}`);
}

function compositeBounds(
  input: D11BModelInput,
  weight: (sourceKey: D11BSourceKey) => number,
): RankedModelRow[] {
  assertInput(input);
  const tracks = universe(input);
  const captured = rankingMap(input);

  const scored = tracks.map((canonicalTrackId) => {
    let lower = 0;
    let upper = 0;

    for (const sourceKey of input.expectedSourceKeys) {
      const w = weight(sourceKey);
      const ranking = captured.get(sourceKey);

      if (!ranking) {
        upper += w;
        continue;
      }

      const row = ranking.rows.find(
        (candidate) => candidate.canonicalTrackId === canonicalTrackId,
      );

      if (row) {
        const q = normalizedRank(row.rank, ranking.depth);
        lower += w * q;
        upper += w * q;
      } else {
        upper += w * (1 / ranking.depth);
      }
    }

    return {
      canonicalTrackId,
      score: lower,
      lower,
      upper,
    };
  });

  const ordered = [...scored].sort((a, b) => {
    const lowerDelta = b.lower - a.lower;
    if (lowerDelta !== 0) return lowerDelta;
    const upperDelta = b.upper - a.upper;
    if (upperDelta !== 0) return upperDelta;
    return a.canonicalTrackId.localeCompare(b.canonicalTrackId);
  });

  let previous: { lower: number; upper: number } | undefined;
  let previousRank = 0;

  return ordered.map((row, index) => {
    const tied =
      previous !== undefined &&
      row.lower === previous.lower &&
      row.upper === previous.upper;
    const rank = tied ? previousRank : index + 1;
    previous = { lower: row.lower, upper: row.upper };
    previousRank = rank;
    return { ...row, rank };
  });
}

export function runM1(input: D11BModelInput): RankedModelRow[] {
  return compositeBounds(input, fixedWeightM1);
}

export function runM2(input: D11BModelInput): RankedModelRow[] {
  return compositeBounds(input, fixedWeightM2);
}

export function runM4(input: D11BModelInput): RankedModelRow[] {
  assertInput(input);
  const tracks = universe(input);

  const scored = tracks.map((canonicalTrackId) => {
    let score = 0;

    for (const ranking of input.rankings) {
      const row = ranking.rows.find(
        (candidate) => candidate.canonicalTrackId === canonicalTrackId,
      );
      if (!row) continue;

      const points = ranking.depth - row.rank + 1;
      score += isApple(ranking.sourceKey) ? points / 7 : points;
    }

    return { canonicalTrackId, score };
  });

  return rankWithCompetition(scored);
}

function weightedRankingAuthority(sourceKey: D11BSourceKey): number {
  return isApple(sourceKey) ? 1 / 7 : 1;
}

export function fitM6(
  input: D11BModelInput,
  options: {
    npseudo?: number;
    tolerance?: number;
    maxIterations?: number;
  } = {},
): PlackettLuceFit {
  assertInput(input);

  const npseudo = options.npseudo ?? 0.5;
  const tolerance = options.tolerance ?? 1e-12;
  const maxIterations = options.maxIterations ?? 10_000;

  if (!(npseudo >= 0)) throw new Error("invalid_npseudo");
  if (!(tolerance > 0)) throw new Error("invalid_tolerance");
  if (!Number.isInteger(maxIterations) || maxIterations <= 0) {
    throw new Error("invalid_max_iterations");
  }

  const tracks = universe(input);
  if (tracks.length === 0) {
    return {
      rows: [],
      converged: true,
      iterations: 0,
      maxLogWorthDelta: 0,
      normalizedWorthByTrack: {},
    };
  }

  const trackIndex = new Map(tracks.map((track, index) => [track, index]));
  let theta = tracks.map(() => 1);

  const rankings = input.rankings
    .map((ranking) => ({
      weight: weightedRankingAuthority(ranking.sourceKey),
      indices: [...ranking.rows]
        .sort((a, b) => a.rank - b.rank)
        .map((row) => trackIndex.get(row.canonicalTrackId))
        .filter((index): index is number => index !== undefined),
    }))
    .filter((ranking) => ranking.indices.length >= 2);

  let converged = false;
  let maxLogWorthDelta = Number.POSITIVE_INFINITY;
  let iterations = 0;

  for (let iteration = 1; iteration <= maxIterations; iteration++) {
    const wins = tracks.map(() => npseudo);
    const denominator = tracks.map((_, index) =>
      npseudo > 0 ? (2 * npseudo) / (theta[index] + 1) : 0
    );

    for (const ranking of rankings) {
      for (let stage = 0; stage < ranking.indices.length - 1; stage++) {
        const remaining = ranking.indices.slice(stage);
        const sumWorth = remaining.reduce(
          (sum, index) => sum + theta[index],
          0,
        );

        if (!(sumWorth > 0) || !Number.isFinite(sumWorth)) {
          throw new Error("m6_non_finite_choice_denominator");
        }

        wins[ranking.indices[stage]] += ranking.weight;
        for (const index of remaining) {
          denominator[index] += ranking.weight / sumWorth;
        }
      }
    }

    const next = theta.map((current, index) => {
      const denom = denominator[index];
      if (!(denom > 0)) return current;
      const updated = wins[index] / denom;
      if (!(updated > 0) || !Number.isFinite(updated)) {
        throw new Error("m6_non_finite_update");
      }
      return updated;
    });

    const geometricMean = Math.exp(
      next.reduce((sum, value) => sum + Math.log(value), 0) / next.length,
    );
    const normalized = next.map((value) => value / geometricMean);

    maxLogWorthDelta = Math.max(
      ...normalized.map((value, index) =>
        Math.abs(Math.log(value) - Math.log(theta[index]))
      ),
    );

    theta = normalized;
    iterations = iteration;

    if (maxLogWorthDelta <= tolerance) {
      converged = true;
      break;
    }
  }

  const totalWorth = theta.reduce((sum, value) => sum + value, 0);
  const normalizedWorthByTrack = Object.fromEntries(
    tracks.map((track, index) => [track, theta[index] / totalWorth]),
  );

  const rows = rankWithCompetition(
    tracks.map((canonicalTrackId) => ({
      canonicalTrackId,
      score: normalizedWorthByTrack[canonicalTrackId],
    })),
  );

  return {
    rows,
    converged,
    iterations,
    maxLogWorthDelta,
    normalizedWorthByTrack,
  };
}
