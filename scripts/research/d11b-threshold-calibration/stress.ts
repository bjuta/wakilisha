import type {
  D11BModelInput,
  D11BSourceKey,
  RankedObservation,
} from "./models";

function cloneInput(input: D11BModelInput): D11BModelInput {
  return {
    expectedSourceKeys: [...input.expectedSourceKeys],
    rankings: input.rankings.map((ranking) => ({
      sourceKey: ranking.sourceKey,
      depth: ranking.depth,
      rows: ranking.rows.map((row) => ({ ...row })),
    })),
  };
}

export function deleteSource(
  input: D11BModelInput,
  sourceKey: D11BSourceKey,
): D11BModelInput {
  const next = cloneInput(input);
  next.rankings = next.rankings.filter(
    (ranking) => ranking.sourceKey !== sourceKey,
  );
  return next;
}

export type D11BProviderSource =
  | "youtube"
  | "audiomack"
  | "apple";

function providerSourceMatches(
  sourceKey: D11BSourceKey,
  provider: D11BProviderSource,
): boolean {
  if (provider === "youtube") return sourceKey === "youtube_weekly_ke";
  if (provider === "audiomack") {
    return sourceKey === "audiomack_weekly100_ke";
  }
  return sourceKey.startsWith("apple_top100_ke:");
}

export function deleteProviderSource(
  input: D11BModelInput,
  provider: D11BProviderSource,
): D11BModelInput {
  const next = cloneInput(input);
  next.rankings = next.rankings.filter(
    (ranking) => !providerSourceMatches(ranking.sourceKey, provider),
  );
  return next;
}

export function spikeProviderSource(
  input: D11BModelInput,
  provider: D11BProviderSource,
  canonicalTrackId: string,
  targetRank = 1,
): D11BModelInput {
  let next = cloneInput(input);
  const matching = next.rankings
    .filter((ranking) => providerSourceMatches(ranking.sourceKey, provider))
    .map((ranking) => ranking.sourceKey);

  if (matching.length === 0) {
    throw new Error(`provider_source_not_captured:${provider}`);
  }

  for (const sourceKey of matching) {
    next = singleSourceSpike(
      next,
      sourceKey,
      canonicalTrackId,
      targetRank,
    );
  }
  return next;
}

export function coordinatedProviderSpike(
  input: D11BModelInput,
  providers: Iterable<D11BProviderSource>,
  canonicalTrackId: string,
  targetRank = 1,
): D11BModelInput {
  let next = cloneInput(input);
  for (const provider of providers) {
    next = spikeProviderSource(
      next,
      provider,
      canonicalTrackId,
      targetRank,
    );
  }
  return next;
}

export function maskDepth(
  input: D11BModelInput,
  maximumDepth: number,
): D11BModelInput {
  if (!Number.isInteger(maximumDepth) || maximumDepth <= 0) {
    throw new Error("invalid_mask_depth");
  }

  const next = cloneInput(input);
  next.rankings = next.rankings.map((ranking) => ({
    ...ranking,
    depth: Math.min(ranking.depth, maximumDepth),
    rows: ranking.rows.filter((row) => row.rank <= maximumDepth),
  }));
  return next;
}

export function removeCanonicalIdentities(
  input: D11BModelInput,
  canonicalTrackIds: Iterable<string>,
): D11BModelInput {
  const removed = new Set(canonicalTrackIds);
  const next = cloneInput(input);
  next.rankings = next.rankings.map((ranking) => ({
    ...ranking,
    rows: ranking.rows.filter(
      (row) => !removed.has(row.canonicalTrackId),
    ),
  }));
  return next;
}

export function splitCanonicalIdentity(
  input: D11BModelInput,
  canonicalTrackId: string,
  splitTrackIds: [string, string],
): D11BModelInput {
  if (!canonicalTrackId || !splitTrackIds[0] || !splitTrackIds[1]) {
    throw new Error("invalid_identity_split");
  }
  if (splitTrackIds[0] === splitTrackIds[1]) {
    throw new Error("identity_split_ids_must_differ");
  }

  const next = cloneInput(input);
  let occurrence = 0;

  next.rankings = next.rankings.map((ranking) => ({
    ...ranking,
    rows: ranking.rows.map((row) => {
      if (row.canonicalTrackId !== canonicalTrackId) return row;
      const replacement = splitTrackIds[occurrence % 2];
      occurrence++;
      return {
        ...row,
        canonicalTrackId: replacement,
      };
    }),
  }));

  return next;
}

function promoteTrackInRanking(
  ranking: RankedObservation,
  canonicalTrackId: string,
  targetRank: number,
): RankedObservation {
  if (
    !Number.isInteger(targetRank) ||
    targetRank <= 0 ||
    targetRank > ranking.depth
  ) {
    throw new Error("invalid_spike_target_rank");
  }

  const existing = ranking.rows.find(
    (row) => row.canonicalTrackId === canonicalTrackId,
  );
  const existingRank = existing?.rank ?? null;

  const shifted = ranking.rows
    .filter((row) => row.canonicalTrackId !== canonicalTrackId)
    .map((row) => {
      let rank = row.rank;

      if (existingRank === null) {
        if (rank >= targetRank) rank += 1;
      } else if (targetRank < existingRank) {
        if (rank >= targetRank && rank < existingRank) rank += 1;
      } else if (targetRank > existingRank) {
        if (rank > existingRank && rank <= targetRank) rank -= 1;
      }

      return {
        canonicalTrackId: row.canonicalTrackId,
        rank,
      };
    })
    .filter((row) => row.rank <= ranking.depth);

  shifted.push({
    canonicalTrackId,
    rank: targetRank,
  });

  return {
    ...ranking,
    rows: shifted.sort((a, b) => a.rank - b.rank),
  };
}

export function singleSourceSpike(
  input: D11BModelInput,
  sourceKey: D11BSourceKey,
  canonicalTrackId: string,
  targetRank = 1,
): D11BModelInput {
  const next = cloneInput(input);
  const ranking = next.rankings.find(
    (candidate) => candidate.sourceKey === sourceKey,
  );
  if (!ranking) throw new Error("spike_source_not_captured");

  next.rankings = next.rankings.map((candidate) =>
    candidate.sourceKey === sourceKey
      ? promoteTrackInRanking(candidate, canonicalTrackId, targetRank)
      : candidate
  );

  return next;
}

export function coordinatedSourceSpike(
  input: D11BModelInput,
  sourceKeys: Iterable<D11BSourceKey>,
  canonicalTrackId: string,
  targetRank = 1,
): D11BModelInput {
  let next = cloneInput(input);
  for (const sourceKey of sourceKeys) {
    next = singleSourceSpike(
      next,
      sourceKey,
      canonicalTrackId,
      targetRank,
    );
  }
  return next;
}

export function injectOrganicTrackFlood(
  input: D11BModelInput,
  sourceKeys: Iterable<D11BSourceKey>,
  canonicalTrackIds: string[],
  startRank = 1,
): D11BModelInput {
  if (canonicalTrackIds.length === 0) {
    throw new Error("organic_flood_requires_tracks");
  }

  let next = cloneInput(input);
  const sources = [...sourceKeys];

  for (const sourceKey of sources) {
    for (let index = canonicalTrackIds.length - 1; index >= 0; index--) {
      next = singleSourceSpike(
        next,
        sourceKey,
        canonicalTrackIds[index],
        startRank,
      );
    }
  }

  return next;
}

export function thresholdEdgeSwap(
  input: D11BModelInput,
  sourceKey: D11BSourceKey,
  boundaryRank: number,
): D11BModelInput {
  if (!Number.isInteger(boundaryRank) || boundaryRank <= 0) {
    throw new Error("invalid_boundary_rank");
  }

  const next = cloneInput(input);
  const ranking = next.rankings.find(
    (candidate) => candidate.sourceKey === sourceKey,
  );
  if (!ranking) throw new Error("boundary_source_not_captured");

  const at = ranking.rows.find((row) => row.rank === boundaryRank);
  const below = ranking.rows.find((row) => row.rank === boundaryRank + 1);

  if (!at || !below) throw new Error("boundary_pair_unavailable");

  next.rankings = next.rankings.map((candidate) => {
    if (candidate.sourceKey !== sourceKey) return candidate;
    return {
      ...candidate,
      rows: candidate.rows.map((row) => {
        if (row.rank === boundaryRank) {
          return { ...row, canonicalTrackId: below.canonicalTrackId };
        }
        if (row.rank === boundaryRank + 1) {
          return { ...row, canonicalTrackId: at.canonicalTrackId };
        }
        return row;
      }),
    };
  });

  return next;
}
