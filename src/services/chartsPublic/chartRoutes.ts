import { resolveSourceFamilySlug, getPresentationBySource, getSourceFamilySlugFromPresentedFamily } from "./chartPresentation";
import type { ChartFamily } from "./types";

/**
 * Chart Route Canonicalization
 *
 * Public chart taxonomy gives each chart a canonical public slug.
 * Legacy routes (like /charts/rnb, /charts/kenya) still resolve to the right
 * family but should redirect to the canonical public slug.
 *
 * This module provides helpers for:
 * - Resolving any input slug to its canonical form
 * - Building canonical chart URLs
 * - Detecting legacy slugs and computing redirect targets
 */

/**
 * Resolve any input slug to its canonical public slug.
 * Returns the publicSlug if the input is a legacy or source slug,
 * otherwise returns the input unchanged.
 */

const LEGACY_CHART_ROUTE_MAP: Record<string, string> = {
};

export function normalizeChartProgramSlug(slug?: string | null): string {
  const clean = String(slug || "").replace(/^\/+|\/+$/g, "");
  return LEGACY_CHART_ROUTE_MAP[clean] || clean;
}

export function resolveChartRouteSlug(inputSlug: string): string {
  const sourceSlug = resolveSourceFamilySlug(inputSlug);
  const presentation = getPresentationBySource(sourceSlug);
  if (presentation) {
    return presentation.publicSlug;
  }
  return inputSlug;
}

/**
 * Check if a slug is a legacy slug (not the canonical public slug).
 */
export function isLegacyChartSlug(inputSlug: string): boolean {
  const canonical = resolveChartRouteSlug(inputSlug);
  return canonical !== inputSlug;
}

/**
 * Build the canonical chart path for a family, optionally with an edition.
 * Includes market slug for proper URL structure.
 */
export function getCanonicalChartPath(family: ChartFamily, editionSlug?: string): string {
  const publicSlug = family.publicSlug ?? family.slug ?? family.familyKey;
  if (editionSlug) {
    return `/charts/${publicSlug}/${editionSlug}`;
  }
  return `/charts/${publicSlug}`;
}

/**
 * Get the redirect target for a legacy slug.
 * Returns the canonical path string, or null if the slug is already canonical.
 */
export function getLegacyRedirectTarget(
  inputSlug: string,
  editionSlug?: string
): string | null {
  if (!isLegacyChartSlug(inputSlug)) return null;
  const canonicalSlug = normalizeChartProgramSlug(inputSlug);
  if (editionSlug) {
    return `/charts/${canonicalSlug}/${editionSlug}`;
  }
  return `/charts/${canonicalSlug}`;
}

/**
 * Build a canonical chart path from raw identifiers.
 * Useful for components that only have slug strings, not the full family object.
 * Includes market slug when available for proper 3-segment URL structure.
 */
export function getCanonicalChartPathFromSlugs(
  canonicalFamilySlug: string,
  editionSlug?: string,
  _marketSlug?: string
): string {
  if (editionSlug) {
    return `/charts/${canonicalFamilySlug}/${editionSlug}`;
  }
  return `/charts/${canonicalFamilySlug}`;
}

/**
 * Get the source family slug from a presented family.
 * Re-exported for convenience in edition pages.
 */
export function getSourceFamilySlug(family: ChartFamily): string {
  return getSourceFamilySlugFromPresentedFamily(family);
}