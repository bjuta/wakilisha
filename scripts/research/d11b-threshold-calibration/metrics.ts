import { createHash } from "node:crypto";
import type { RankedModelRow } from "./models";

export interface RankComparisonMetrics {
  top10Overlap: number;
  top40Overlap: number;
  top100Overlap: number;
  medianAbsoluteRankDisplacement: number;
  maximumRankDisplacement: number;
  top100EntryCount: number;
  top100ExitCount: number;
  comparedTrackCount: number;
}

function topKSet(rows: RankedModelRow[], k: number): Set<string> {
  return new Set(
    rows
      .filter((row) => row.rank <= k)
      .map((row) => row.canonicalTrackId),
  );
}

export function overlapCoefficient(
  a: Set<string>,
  b: Set<string>,
): number {
  if (a.size === 0 && b.size === 0) return 1;
  const denominator = Math.min(a.size, b.size);
  if (denominator === 0) return 0;

  let intersection = 0;
  for (const value of a) {
    if (b.has(value)) intersection++;
  }
  return intersection / denominator;
}

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const ordered = [...values].sort((a, b) => a - b);
  const middle = Math.floor(ordered.length / 2);
  return ordered.length % 2 === 1
    ? ordered[middle]
    : (ordered[middle - 1] + ordered[middle]) / 2;
}

export function compareRankings(
  baseline: RankedModelRow[],
  stressed: RankedModelRow[],
): RankComparisonMetrics {
  const baseMap = new Map(
    baseline.map((row) => [row.canonicalTrackId, row.rank]),
  );
  const stressedMap = new Map(
    stressed.map((row) => [row.canonicalTrackId, row.rank]),
  );

  const common = [...baseMap.keys()].filter((track) =>
    stressedMap.has(track)
  );

  const displacements = common.map((track) =>
    Math.abs(baseMap.get(track)! - stressedMap.get(track)!)
  );

  const base100 = topKSet(baseline, 100);
  const stressed100 = topKSet(stressed, 100);

  let entries = 0;
  for (const track of stressed100) {
    if (!base100.has(track)) entries++;
  }

  let exits = 0;
  for (const track of base100) {
    if (!stressed100.has(track)) exits++;
  }

  return {
    top10Overlap: overlapCoefficient(
      topKSet(baseline, 10),
      topKSet(stressed, 10),
    ),
    top40Overlap: overlapCoefficient(
      topKSet(baseline, 40),
      topKSet(stressed, 40),
    ),
    top100Overlap: overlapCoefficient(base100, stressed100),
    medianAbsoluteRankDisplacement: median(displacements),
    maximumRankDisplacement:
      displacements.length > 0 ? Math.max(...displacements) : 0,
    top100EntryCount: entries,
    top100ExitCount: exits,
    comparedTrackCount: common.length,
  };
}

export function canonicalRankingJson(rows: RankedModelRow[]): string {
  return JSON.stringify(
    [...rows]
      .sort((a, b) => {
        if (a.rank !== b.rank) return a.rank - b.rank;
        return a.canonicalTrackId.localeCompare(b.canonicalTrackId);
      })
      .map((row) => ({
        canonicalTrackId: row.canonicalTrackId,
        rank: row.rank,
        score: Number(row.score.toPrecision(15)),
        ...(row.lower === undefined
          ? {}
          : { lower: Number(row.lower.toPrecision(15)) }),
        ...(row.upper === undefined
          ? {}
          : { upper: Number(row.upper.toPrecision(15)) }),
      })),
  );
}

export function rankingOutputHash(rows: RankedModelRow[]): string {
  return createHash("sha256")
    .update(canonicalRankingJson(rows))
    .digest("hex");
}
