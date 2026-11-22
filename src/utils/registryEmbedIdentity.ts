/**
 * Identity authority for Article Registry embeds.
 * A human-readable slug is never an identity when multiple active Registry
 * records claim it. New embeds use canonical UUIDs; old embeds fail closed.
 */
export const REGISTRY_UUID_RE =
  /^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i;

export function resolveRegistryEmbedIdentity<Row extends { id: string; slug: string }>(
  reference: { id?: string | null; slug?: string | null },
  exactIdRows: readonly Row[],
  legacySlugRows: readonly Row[],
): Row | null {
  if (reference.id) {
    return exactIdRows.find((row) => row.id === reference.id) ?? null;
  }
  if (!reference.slug) return null;

  let match: Row | null = null;
  for (const row of legacySlugRows) {
    if (row.slug !== reference.slug) continue;
    if (match) return null; // Never choose a random winner for duplicate slugs.
    match = row;
  }
  return match;
}

export type UnresolvedRegistryEmbedReason =
  | "missing-id"
  | "ambiguous-legacy-slug"
  | "missing-legacy-slug";

export function unresolvedRegistryEmbed(
  kind: "track" | "release",
  reason: UnresolvedRegistryEmbedReason,
): string {
  // All interpolated values are closed unions, never content-supplied strings.
  return `<span data-wk-registry-embed-unresolved="${kind}" data-wk-registry-reason="${reason}" role="note">${kind === "track" ? "Track" : "Release"} reference needs editorial review.</span>`;
}
