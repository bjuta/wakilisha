export type ReleaseTaxonomy = "single" | "ep" | "album";

export function normalizeActiveTrackCount(value: unknown): number {
  const count = Number(value);
  if (!Number.isFinite(count) || count < 0) return 0;
  return Math.floor(count);
}

export function releaseTaxonomyFromActiveTrackCount(
  value: unknown,
): ReleaseTaxonomy | null {
  const count = normalizeActiveTrackCount(value);
  if (count < 1) return null;
  if (count === 1) return "single";
  if (count <= 6) return "ep";
  return "album";
}

export function releaseTypeLabelFromActiveTrackCount(
  value: unknown,
): "Single" | "EP" | "Album" | null {
  const taxonomy = releaseTaxonomyFromActiveTrackCount(value);
  if (taxonomy === "single") return "Single";
  if (taxonomy === "ep") return "EP";
  if (taxonomy === "album") return "Album";
  return null;
}

export function hasDedicatedPublicReleasePage(
  value: unknown,
): boolean {
  return normalizeActiveTrackCount(value) >= 2;
}
