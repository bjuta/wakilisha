import { createHash } from "node:crypto";
import {
  canonicalTrackSlugCandidate,
  normalizeIdentityText,
  slugifyIdentity,
  stripFeatureCreditNoise,
} from "../../../../supabase/functions/_shared/registry-track-identity.ts";
import {
  releaseTaxonomyFromActiveTrackCount,
} from "../../../../supabase/functions/_shared/release-taxonomy.ts";

export {
  canonicalTrackSlugCandidate,
  normalizeIdentityText,
  slugifyIdentity,
  stripFeatureCreditNoise,
} from "../../../../supabase/functions/_shared/registry-track-identity.ts";
export {
  releaseTaxonomyFromActiveTrackCount,
} from "../../../../supabase/functions/_shared/release-taxonomy.ts";

export const MIZIZI_AGENT_KEY = "mizizi";
export const MIZIZI_AGENT_LABEL = "MIZIZI Cultural Data Steward";
export const MIZIZI_RULESET_VERSION = "1.1.0";

export type MiziziEntityType = "track" | "release" | "chart_entry";
export type MiziziDisposition = "auto_fix_candidate" | "review" | "observe";

export type MiziziFinding = {
  fingerprint: string;
  ruleId: string;
  ruleVersion: string;
  entityType: MiziziEntityType;
  entityId: string;
  fieldName: string;
  currentValue: string;
  proposedValue: string;
  confidence: number;
  severity: "low" | "medium" | "high";
  disposition: MiziziDisposition;
  reason: string;
  evidence: Record<string, unknown>;
};

export type TrackIdentityInput = {
  id: string;
  slug: string;
  title: string;
  primaryArtistSlug?: string | null;
  primaryArtistName?: string | null;
  featuredArtists?: Array<{ slug?: string | null; name?: string | null }>;
};

export type ReleaseIdentityInput = {
  id: string;
  slug: string;
  title: string;
  releaseType?: string | null;
  activeTrackCount?: number | null;
};

export type ChartIdentityInput = {
  id: string;
  trackSlug: string;
  artistSlug?: string | null;
  canonicalTrackId?: string | null;
  canonicalTrackSlug?: string | null;
  canonicalPrimaryArtistSlug?: string | null;
};

export function stripReleasePackagingSuffix(
  value: string,
  releaseType?: string | null,
): { coreTitle: string; removedSuffix: string } {
  const normalized = normalizeIdentityText(value);
  const normalizedType = String(releaseType || "").trim().toLowerCase();
  const allowed = new Set(["single", "ep", "album", "mixtape", "soundtrack", "deluxe"]);

  if (!allowed.has(normalizedType)) {
    return { coreTitle: normalized, removedSuffix: "" };
  }

  const suffix = new RegExp("\\s+-\\s+" + normalizedType + "$", "i");
  if (!suffix.test(normalized)) {
    return { coreTitle: normalized, removedSuffix: "" };
  }

  return {
    coreTitle: normalized.replace(suffix, "").trim(),
    removedSuffix: normalized.match(suffix)?.[0]?.trim() || "",
  };
}

function featureMarkerInSlug(slug: string): boolean {
  return /(^|-)(feat|featuring|ft)(-|$)/i.test(slug);
}

function primaryArtistPrefixInSlug(slug: string, primaryArtistSlug?: string | null): boolean {
  const artist = slugifyIdentity(primaryArtistSlug || "");
  return Boolean(artist && slug.toLowerCase().startsWith(artist + "--"));
}

function containsFeaturedArtistSlug(
  slug: string,
  featuredArtists: TrackIdentityInput["featuredArtists"] = [],
): boolean {
  const normalized = "-" + slug.toLowerCase() + "-";
  return featuredArtists.some((artist) => {
    const featuredSlug = slugifyIdentity(artist.slug || artist.name || "");
    return Boolean(featuredSlug && normalized.includes("-" + featuredSlug + "-"));
  });
}

function makeFinding(input: Omit<MiziziFinding, "fingerprint" | "ruleVersion">): MiziziFinding {
  const stable = JSON.stringify({
    agent: MIZIZI_AGENT_KEY,
    ruleId: input.ruleId,
    ruleVersion: MIZIZI_RULESET_VERSION,
    entityType: input.entityType,
    entityId: input.entityId,
    fieldName: input.fieldName,
    currentValue: input.currentValue,
    proposedValue: input.proposedValue,
  });

  return {
    ...input,
    fingerprint: createHash("sha256").update(stable).digest("hex"),
    ruleVersion: MIZIZI_RULESET_VERSION,
  };
}

export function analyzeTrackIdentity(input: TrackIdentityInput): MiziziFinding[] {
  const findings: MiziziFinding[] = [];
  const featureCleanup = stripFeatureCreditNoise(input.title);
  const structuredFeaturedArtists =
    (input.featuredArtists || [])
      .map((artist) =>
        artist.name || artist.slug || "",
      )
      .filter(Boolean);
  const proposedSlug =
    canonicalTrackSlugCandidate(
      input.title,
      {
        featuredArtistNames:
          structuredFeaturedArtists,
      },
    );
  const featureCreditStructurallyProven =
    proposedSlug !==
    slugifyIdentity(input.title);

  const strongNoiseReasons = [
    featureMarkerInSlug(input.slug) &&
    featureCreditStructurallyProven
      ? "feature_credit_marker_in_slug"
      : "",
    primaryArtistPrefixInSlug(
      input.slug,
      input.primaryArtistSlug,
    )
      ? "primary_artist_repeated_inside_slug"
      : "",
    containsFeaturedArtistSlug(
      input.slug,
      input.featuredArtists,
    )
      ? "featured_artist_repeated_inside_slug"
      : "",
  ].filter(Boolean);

  const slugDiffers =
    Boolean(proposedSlug) &&
    proposedSlug !== input.slug;

  if (
    slugDiffers &&
    strongNoiseReasons.length > 0
  ) {
    findings.push(makeFinding({
      ruleId: "track_slug_identity_noise",
      entityType: "track",
      entityId: input.id,
      fieldName: "slug",
      currentValue: input.slug,
      proposedValue: proposedSlug,
      confidence:
        featureMarkerInSlug(input.slug) ||
        primaryArtistPrefixInSlug(
          input.slug,
          input.primaryArtistSlug,
        )
          ? 0.99
          : 0.95,
      severity: "high",
      disposition: "auto_fix_candidate",
      reason: [
        ...strongNoiseReasons,
        "slug_not_minimal_title_identity",
      ].join(","),
      evidence: {
        title: input.title,
        coreTitle:
          featureCleanup.coreTitle,
        removedFragments:
          featureCleanup.removedFragments,
        primaryArtistSlug:
          input.primaryArtistSlug || "",
        primaryArtistName:
          input.primaryArtistName || "",
        featuredArtists:
          input.featuredArtists || [],
      },
    }));
  } else if (slugDiffers) {
    findings.push(makeFinding({
      ruleId: "track_slug_identity_mismatch",
      entityType: "track",
      entityId: input.id,
      fieldName: "slug",
      currentValue: input.slug,
      proposedValue: proposedSlug,
      confidence: 0.6,
      severity: "medium",
      disposition: "observe",
      reason:
        "slug_differs_from_minimal_title_identity_without_structural_noise_proof",
      evidence: {
        title: input.title,
        coreTitle:
          featureCleanup.coreTitle,
        primaryArtistSlug:
          input.primaryArtistSlug || "",
        primaryArtistName:
          input.primaryArtistName || "",
      },
    }));
  }

  if (featureCleanup.removedFragments.length > 0) {
    findings.push(makeFinding({
      ruleId: "track_title_credit_noise",
      entityType: "track",
      entityId: input.id,
      fieldName: "title",
      currentValue: input.title,
      proposedValue: featureCleanup.coreTitle,
      confidence: (input.featuredArtists || []).length > 0 ? 0.95 : 0.75,
      severity: "medium",
      disposition: "observe",
      reason: "featured_artist_credit_is_structural_data_not_title_identity",
      evidence: {
        removedFragments: featureCleanup.removedFragments,
        structuredFeaturedArtists: input.featuredArtists || [],
      },
    }));
  }

  return findings;
}

export function analyzeReleaseIdentity(input: ReleaseIdentityInput): MiziziFinding[] {
  const findings: MiziziFinding[] = [];
  const storedReleaseType =
    String(input.releaseType || "").trim();
  const normalizedStoredType =
    storedReleaseType.toLowerCase();
  const canonicalTaxonomy =
    releaseTaxonomyFromActiveTrackCount(
      input.activeTrackCount,
    );

  if (
    canonicalTaxonomy &&
    normalizedStoredType !== canonicalTaxonomy
  ) {
    findings.push(makeFinding({
      ruleId: "release_taxonomy_drift",
      entityType: "release",
      entityId: input.id,
      fieldName: "release_type",
      currentValue: storedReleaseType,
      proposedValue: canonicalTaxonomy,
      confidence: 1,
      severity: "high",
      disposition: "auto_fix_candidate",
      reason:
        "release_type_differs_from_resolvable_active_track_membership_taxonomy",
      evidence: {
        resolvableActiveTrackCount:
          Number(input.activeTrackCount || 0),
        storedReleaseType,
        canonicalReleaseType:
          canonicalTaxonomy,
      },
    }));
  }

  const cleanup =
    stripReleasePackagingSuffix(
      input.title,
      input.releaseType,
    );

  if (!cleanup.removedSuffix) {
    return findings;
  }

  const proposedSlug =
    slugifyIdentity(
      cleanup.coreTitle,
    );

  findings.push(makeFinding({
    ruleId: "release_title_provider_packaging",
    entityType: "release",
    entityId: input.id,
    fieldName: "title",
    currentValue: input.title,
    proposedValue: cleanup.coreTitle,
    confidence: 0.99,
    severity: "medium",
    disposition: "observe",
    reason: "provider_package_type_is_structural_metadata_not_release_title",
    evidence: {
      releaseType: input.releaseType || "",
      removedSuffix: cleanup.removedSuffix,
    },
  }));

  if (
    proposedSlug &&
    proposedSlug !== input.slug
  ) {
    findings.push(makeFinding({
      ruleId: "release_slug_provider_packaging",
      entityType: "release",
      entityId: input.id,
      fieldName: "slug",
      currentValue: input.slug,
      proposedValue: proposedSlug,
      confidence: 0.99,
      severity: "medium",
      disposition: "observe",
      reason: "provider_package_type_is_not_slug_identity",
      evidence: {
        releaseType: input.releaseType || "",
        sourceTitle: input.title,
        coreTitle: cleanup.coreTitle,
      },
    }));
  }

  return findings;
}

export function analyzeChartIdentity(input: ChartIdentityInput): MiziziFinding[] {
  const findings: MiziziFinding[] = [];

  if (
    input.canonicalTrackId &&
    input.canonicalTrackSlug &&
    input.trackSlug !== input.canonicalTrackSlug
  ) {
    findings.push(makeFinding({
      ruleId: "chart_track_slug_drift",
      entityType: "chart_entry",
      entityId: input.id,
      fieldName: "track_slug",
      currentValue: input.trackSlug,
      proposedValue: input.canonicalTrackSlug,
      confidence: 1,
      severity: "high",
      disposition: "auto_fix_candidate",
      reason: "chart_entry_has_canonical_track_id_so_track_slug_is_derived",
      evidence: { canonicalTrackId: input.canonicalTrackId },
    }));
  }

  if (
    input.canonicalPrimaryArtistSlug &&
    input.artistSlug &&
    input.artistSlug !== input.canonicalPrimaryArtistSlug
  ) {
    findings.push(makeFinding({
      ruleId: "chart_artist_slug_drift",
      entityType: "chart_entry",
      entityId: input.id,
      fieldName: "artist_slug",
      currentValue: input.artistSlug,
      proposedValue: input.canonicalPrimaryArtistSlug,
      confidence: 0.9,
      severity: "medium",
      disposition: "observe",
      reason: "chart_artist_slug_differs_from_registry_primary_artist",
      evidence: { canonicalTrackId: input.canonicalTrackId || "" },
    }));
  }

  return findings;
}
