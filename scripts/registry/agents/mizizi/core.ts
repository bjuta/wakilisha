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
export const MIZIZI_RULESET_VERSION = "1.2.0";
export const MIZIZI_PUBLIC_IDENTITY_REVIEW_RULE_VERSION = "1.3.0";
export const MIZIZI_PROVENANCE_AUDIT_RULE_VERSION = "1.0.0";

export type MiziziEntityType =
  | "track"
  | "release"
  | "chart_entry"
  | "contribution_attestation";
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

export type EvidenceLineageInput = {
  id: string;
  subjectType: string;
  subjectId: string;
  claimKey: string;
  claimPayload: unknown;
  sourceKind: string;
  sourceRef: string;
  sourcePayloadFingerprint: string;
  parentAssertionId?: string | null;
  originatorRef?: string | null;
  upstreamSourceRef?: string | null;
  lineageKey?: string | null;
  independenceGroupHint?: string | null;
  verificationMethod?: string | null;
  sourceUseBasis?: string | null;
};

export type EvidenceLineageBasis =
  | "explicit_lineage"
  | "parent_assertion"
  | "upstream_source"
  | "independence_group_hint"
  | "exact_payload_echo"
  | "unknown";

export type EvidenceLineageGroup = {
  groupKey: string;
  basis: EvidenceLineageBasis[];
  independenceStatus: "related" | "unknown";
  assertionIds: string[];
  subjectCount: number;
  sourceKinds: string[];
  sourceRefs: string[];
  claimPayloadFingerprints: string[];
  hasClaimVariants: boolean;
};

function stableJsonValue(
  value: unknown,
): unknown {
  if (Array.isArray(value)) {
    return value.map(stableJsonValue);
  }

  if (
    value &&
    typeof value === "object"
  ) {
    return Object.fromEntries(
      Object.entries(
        value as Record<string, unknown>,
      )
        .sort(([left], [right]) =>
          left.localeCompare(right),
        )
        .map(([key, item]) => [
          key,
          stableJsonValue(item),
        ]),
    );
  }

  return value;
}

function stablePayloadFingerprint(
  value: unknown,
): string {
  const serialized =
    JSON.stringify(
      stableJsonValue(value),
    ) ?? "null";

  return createHash("sha256")
    .update(serialized)
    .digest("hex");
}

export function analyzeEvidenceLineage(
  assertions: EvidenceLineageInput[],
): EvidenceLineageGroup[] {
  if (assertions.length === 0) {
    return [];
  }

  const parents = assertions.map(
    (_, index) => index,
  );

  const find = (index: number): number => {
    let current = index;

    while (parents[current] !== current) {
      parents[current] =
        parents[parents[current]];
      current = parents[current];
    }

    return current;
  };

  const union = (
    left: number,
    right: number,
  ): void => {
    const leftRoot = find(left);
    const rightRoot = find(right);

    if (leftRoot !== rightRoot) {
      parents[rightRoot] = leftRoot;
    }
  };

  const relationMembers =
    new Map<
      string,
      {
        basis: Exclude<
          EvidenceLineageBasis,
          "unknown"
        >;
        indexes: number[];
      }
    >();

  const addRelation = (
    key: string,
    basis: Exclude<
      EvidenceLineageBasis,
      "unknown"
    >,
    index: number,
  ): void => {
    if (!key) return;

    const existing =
      relationMembers.get(key);

    if (existing) {
      existing.indexes.push(index);
      return;
    }

    relationMembers.set(key, {
      basis,
      indexes: [index],
    });
  };

  assertions.forEach(
    (assertion, index) => {
      addRelation(
        "assertion:" + assertion.id,
        "parent_assertion",
        index,
      );

      if (assertion.parentAssertionId) {
        addRelation(
          "assertion:" +
            assertion.parentAssertionId,
          "parent_assertion",
          index,
        );
      }

      if (assertion.lineageKey) {
        addRelation(
          "lineage:" +
            assertion.lineageKey,
          "explicit_lineage",
          index,
        );
      }

      if (assertion.upstreamSourceRef) {
        addRelation(
          "upstream:" +
            assertion.upstreamSourceRef,
          "upstream_source",
          index,
        );
      }

      if (
        assertion.independenceGroupHint
      ) {
        addRelation(
          "independence:" +
            assertion.independenceGroupHint,
          "independence_group_hint",
          index,
        );
      }

      if (
        assertion.sourcePayloadFingerprint
      ) {
        addRelation(
          "payload:" +
            assertion.sourcePayloadFingerprint,
          "exact_payload_echo",
          index,
        );
      }
    },
  );

  for (
    const relation
    of relationMembers.values()
  ) {
    if (relation.indexes.length < 2) {
      continue;
    }

    const first = relation.indexes[0];

    for (
      const index
      of relation.indexes.slice(1)
    ) {
      union(first, index);
    }
  }

  const componentIndexes =
    new Map<number, number[]>();

  assertions.forEach((_, index) => {
    const root = find(index);
    const indexes =
      componentIndexes.get(root) || [];

    indexes.push(index);
    componentIndexes.set(
      root,
      indexes,
    );
  });

  const basisByRoot =
    new Map<
      number,
      Set<
        Exclude<
          EvidenceLineageBasis,
          "unknown"
        >
      >
    >();

  for (
    const relation
    of relationMembers.values()
  ) {
    if (relation.indexes.length < 2) {
      continue;
    }

    const root =
      find(relation.indexes[0]);
    const basis =
      basisByRoot.get(root) ||
      new Set();

    basis.add(relation.basis);
    basisByRoot.set(root, basis);
  }

  return [
    ...componentIndexes.entries(),
  ]
    .map(([root, indexes]) => {
      const rows =
        indexes
          .map(
            (index) =>
              assertions[index],
          )
          .sort(
            (left, right) =>
              left.id.localeCompare(
                right.id,
              ),
          );

      const basisSet =
        basisByRoot.get(root) ||
        new Set();

      const basis:
        EvidenceLineageBasis[] =
        basisSet.size > 0
          ? [...basisSet].sort()
          : ["unknown"];

      const claimVariants =
        new Map<string, Set<string>>();

      for (const row of rows) {
        const claimIdentity = [
          row.subjectType,
          row.subjectId,
          row.claimKey,
        ].join(":");

        const variants =
          claimVariants.get(
            claimIdentity,
          ) || new Set();

        variants.add(
          stablePayloadFingerprint(
            row.claimPayload,
          ),
        );

        claimVariants.set(
          claimIdentity,
          variants,
        );
      }

      const assertionIds =
        rows.map((row) => row.id);

      return {
        groupKey:
          createHash("sha256")
            .update(
              JSON.stringify({
                assertions:
                  assertionIds,
                basis,
              }),
            )
            .digest("hex"),
        basis,
        independenceStatus:
          rows.length > 1 &&
          basis[0] !== "unknown"
            ? "related"
            : "unknown",
        assertionIds,
        subjectCount:
          new Set(
            rows.map(
              (row) =>
                row.subjectType +
                ":" +
                row.subjectId,
            ),
          ).size,
        sourceKinds: [
          ...new Set(
            rows
              .map(
                (row) =>
                  row.sourceKind,
              )
              .filter(Boolean),
          ),
        ].sort(),
        sourceRefs: [
          ...new Set(
            rows
              .map(
                (row) =>
                  row.sourceRef,
              )
              .filter(Boolean),
          ),
        ].sort(),
        claimPayloadFingerprints: [
          ...new Set(
            rows.map(
              (row) =>
                stablePayloadFingerprint(
                  row.claimPayload,
                ),
            ),
          ),
        ].sort(),
        hasClaimVariants:
          [...claimVariants.values()]
            .some(
              (variants) =>
                variants.size > 1,
            ),
      };
    })
    .sort(
      (left, right) =>
        left.assertionIds[0]
          .localeCompare(
            right.assertionIds[0],
          ),
    );
}

export type ExternalIdentifierAutonomyCandidate = {
  subjectType: string;
  schemeKey: string;
  exactProviderIdentifier: boolean;
  sourceStateCurrent: boolean;
  sourceFingerprintMatches: boolean;
  candidateFingerprintMatches: boolean;
  conflictingCurrentAssertionCount: number;
  duplicateAssignmentCount: number;
};

export type ExternalIdentifierAutonomyDecision = {
  disposition: "eligible" | "abstain";
  reasons: string[];
};

export type ExternalIdentifierBenchmarkCase = {
  id: string;
  candidate: ExternalIdentifierAutonomyCandidate;
  expectedDisposition: ExternalIdentifierAutonomyDecision["disposition"];
};

export type ExternalIdentifierBenchmarkResult = {
  family: "strongly_bound_external_identifier_candidate_admission";
  fixtureCount: number;
  fixtureCorrect: number;
  falsePositiveCount: number;
  falseNegativeCount: number;
  fixturePrecision: number;
  fixtureAbstentionRate: number;
  productionGoldRows: number;
  minimumGoldRows: number;
  autonomyEarned: boolean;
  decision: "keep_human_review" | "eligible_for_bounded_policy";
};

const EXTERNAL_IDENTIFIER_SUBJECTS =
  new Set(["artist", "track", "release"]);

const EXTERNAL_IDENTIFIER_SCHEMES =
  new Set(["apple_music", "spotify"]);

export function evaluateExternalIdentifierAutonomyCandidate(
  candidate: ExternalIdentifierAutonomyCandidate,
): ExternalIdentifierAutonomyDecision {
  const reasons: string[] = [];

  if (!EXTERNAL_IDENTIFIER_SUBJECTS.has(candidate.subjectType)) {
    reasons.push("unsupported_subject");
  }

  if (!EXTERNAL_IDENTIFIER_SCHEMES.has(candidate.schemeKey)) {
    reasons.push("unsupported_scheme");
  }

  if (!candidate.exactProviderIdentifier) {
    reasons.push("identifier_not_exact");
  }

  if (!candidate.sourceStateCurrent) {
    reasons.push("stale_source_state");
  }

  if (!candidate.sourceFingerprintMatches) {
    reasons.push("source_fingerprint_drift");
  }

  if (!candidate.candidateFingerprintMatches) {
    reasons.push("candidate_fingerprint_drift");
  }

  if (candidate.conflictingCurrentAssertionCount > 0) {
    reasons.push("conflicting_current_assertion");
  }

  if (candidate.duplicateAssignmentCount > 0) {
    reasons.push("duplicate_assignment");
  }

  return {
    disposition:
      reasons.length === 0
        ? "eligible"
        : "abstain",
    reasons,
  };
}

export function benchmarkExternalIdentifierAutonomy(
  cases: ExternalIdentifierBenchmarkCase[],
  productionGoldRows: number,
  minimumGoldRows = 25,
): ExternalIdentifierBenchmarkResult {
  let fixtureCorrect = 0;
  let falsePositiveCount = 0;
  let falseNegativeCount = 0;
  let eligibleCount = 0;

  for (const item of cases) {
    const actual =
      evaluateExternalIdentifierAutonomyCandidate(
        item.candidate,
      ).disposition;

    if (actual === "eligible") {
      eligibleCount += 1;
    }

    if (actual === item.expectedDisposition) {
      fixtureCorrect += 1;
    } else if (
      actual === "eligible" &&
      item.expectedDisposition === "abstain"
    ) {
      falsePositiveCount += 1;
    } else {
      falseNegativeCount += 1;
    }
  }

  const fixtureCount = cases.length;
  const fixturePrecision =
    eligibleCount === 0
      ? 1
      : (eligibleCount - falsePositiveCount) / eligibleCount;
  const fixtureAbstentionRate =
    fixtureCount === 0
      ? 1
      : (fixtureCount - eligibleCount) / fixtureCount;

  const autonomyEarned =
    fixtureCount > 0 &&
    falsePositiveCount === 0 &&
    fixturePrecision === 1 &&
    productionGoldRows >= minimumGoldRows;

  return {
    family:
      "strongly_bound_external_identifier_candidate_admission",
    fixtureCount,
    fixtureCorrect,
    falsePositiveCount,
    falseNegativeCount,
    fixturePrecision,
    fixtureAbstentionRate,
    productionGoldRows,
    minimumGoldRows,
    autonomyEarned,
    decision:
      autonomyEarned
        ? "eligible_for_bounded_policy"
        : "keep_human_review",
  };
}

export type ProvenanceAttestationAdmissionInput = {
  attestationId: string;
  subjectType: "track" | "work";
  subjectId: string;
  evidenceAssertionId: string;
  evidenceSubjectType: string;
  evidenceSubjectId: string;
  evidenceClaimKey: string;
  latestState: string;
  elicitationMethod: string;
  canonicalContributionCount: number;
  canonicalContributionStatus?: string | null;
};

export function analyzeProvenanceAttestationAdmission(
  input: ProvenanceAttestationAdmissionInput,
): MiziziFinding[] {
  const findings: MiziziFinding[] = [];
  const expectedBinding = [
    input.subjectType,
    input.subjectId,
    "registry.contribution.attestation",
  ].join(":");
  const currentBinding = [
    input.evidenceSubjectType,
    input.evidenceSubjectId,
    input.evidenceClaimKey,
  ].join(":");

  if (
    input.evidenceSubjectType !==
      input.subjectType ||
    input.evidenceSubjectId !==
      input.subjectId ||
    input.evidenceClaimKey !==
      "registry.contribution.attestation"
  ) {
    findings.push(
      makeFinding({
        ruleId:
          "provenance_attestation_evidence_binding_drift",
        ruleVersion:
          MIZIZI_PROVENANCE_AUDIT_RULE_VERSION,
        entityType:
          "contribution_attestation",
        entityId:
          input.attestationId,
        fieldName:
          "evidence_binding",
        currentValue:
          currentBinding,
        proposedValue:
          expectedBinding,
        confidence: 1,
        severity: "high",
        disposition: "review",
        reason:
          "contribution_attestation_evidence_no_longer_matches_subject_authority",
        evidence: {
          subjectType:
            input.subjectType,
          subjectId:
            input.subjectId,
          evidenceAssertionId:
            input.evidenceAssertionId,
          latestState:
            input.latestState,
          elicitationMethod:
            input.elicitationMethod,
        },
      }),
    );

    return findings;
  }

  const matureState =
    input.latestState ===
      "corroborated" ||
    input.latestState ===
      "confirmed";
  const selfClaimReady =
    input.elicitationMethod !==
      "self_claim" ||
    input.latestState ===
      "confirmed";
  const admissible =
    matureState && selfClaimReady;

  if (!admissible) {
    return findings;
  }

  if (
    input.canonicalContributionCount >
      1
  ) {
    findings.push(
      makeFinding({
        ruleId:
          "provenance_attestation_multiple_canonical_rows",
        ruleVersion:
          MIZIZI_PROVENANCE_AUDIT_RULE_VERSION,
        entityType:
          "contribution_attestation",
        entityId:
          input.attestationId,
        fieldName:
          "canonical_contribution_count",
        currentValue:
          String(
            input.canonicalContributionCount,
          ),
        proposedValue:
          "single_canonical_history",
        confidence: 1,
        severity: "high",
        disposition: "review",
        reason:
          "one_exact_attestation_evidence_assertion_has_multiple_canonical_contribution_rows",
        evidence: {
          subjectType:
            input.subjectType,
          subjectId:
            input.subjectId,
          evidenceAssertionId:
            input.evidenceAssertionId,
          latestState:
            input.latestState,
        },
      }),
    );

    return findings;
  }

  if (
    input.canonicalContributionCount ===
      0
  ) {
    findings.push(
      makeFinding({
        ruleId:
          "provenance_admissible_attestation_pending_review",
        ruleVersion:
          MIZIZI_PROVENANCE_AUDIT_RULE_VERSION,
        entityType:
          "contribution_attestation",
        entityId:
          input.attestationId,
        fieldName:
          "canonical_contribution",
        currentValue: "none",
        proposedValue:
          "human_review_required",
        confidence: 1,
        severity: "medium",
        disposition: "review",
        reason:
          "corroborated_or_confirmed_attestation_has_no_canonical_contribution",
        evidence: {
          subjectType:
            input.subjectType,
          subjectId:
            input.subjectId,
          evidenceAssertionId:
            input.evidenceAssertionId,
          latestState:
            input.latestState,
          elicitationMethod:
            input.elicitationMethod,
        },
      }),
    );

    return findings;
  }

  if (
    input.canonicalContributionStatus !==
      "verified"
  ) {
    findings.push(
      makeFinding({
        ruleId:
          "provenance_attestation_noncurrent_canonical_history",
        ruleVersion:
          MIZIZI_PROVENANCE_AUDIT_RULE_VERSION,
        entityType:
          "contribution_attestation",
        entityId:
          input.attestationId,
        fieldName:
          "canonical_contribution",
        currentValue:
          input.canonicalContributionStatus ||
          "unknown",
        proposedValue:
          "new_reviewed_attestation_required",
        confidence: 1,
        severity: "high",
        disposition: "review",
        reason:
          "attestation_has_noncurrent_canonical_history_and_cannot_be_reused_for_admission",
        evidence: {
          subjectType:
            input.subjectType,
          subjectId:
            input.subjectId,
          evidenceAssertionId:
            input.evidenceAssertionId,
          latestState:
            input.latestState,
        },
      }),
    );
  }

  return findings;
}

export type TrackIdentityInput = {
  id: string;
  slug: string;
  title: string;
  isrc?: string | null;
  primaryArtistSlug?: string | null;
  primaryArtistName?: string | null;
  featuredArtists?: Array<{ slug?: string | null; name?: string | null }>;
  recordingIdentityPeers?: Array<{
    id: string;
    slug: string;
    title: string;
    isrc?: string | null;
    sharedPrimaryArtistSlug: string;
  }>;
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

function makeFinding(
  input:
    Omit<MiziziFinding, "fingerprint" | "ruleVersion"> & {
      ruleVersion?: string;
    },
): MiziziFinding {
  const ruleVersion =
    input.ruleVersion ||
    MIZIZI_RULESET_VERSION;
  const stable = JSON.stringify({
    agent: MIZIZI_AGENT_KEY,
    ruleId: input.ruleId,
    ruleVersion,
    entityType: input.entityType,
    entityId: input.entityId,
    fieldName: input.fieldName,
    currentValue: input.currentValue,
    proposedValue: input.proposedValue,
  });

  return {
    ...input,
    fingerprint: createHash("sha256").update(stable).digest("hex"),
    ruleVersion,
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
      ruleVersion: "1.1.0",
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

  if (
    featureMarkerInSlug(input.slug) &&
    !featureCreditStructurallyProven
  ) {
    const reviewCandidate =
      slugifyIdentity(
        featureCleanup.coreTitle,
      );

    if (
      reviewCandidate &&
      reviewCandidate !== input.slug
    ) {
      findings.push(makeFinding({
        ruleId:
          "track_slug_credit_evidence_gap",
        ruleVersion:
          MIZIZI_PUBLIC_IDENTITY_REVIEW_RULE_VERSION,
        entityType: "track",
        entityId: input.id,
        fieldName: "slug",
        currentValue: input.slug,
        proposedValue:
          reviewCandidate,
        confidence: 1,
        severity: "high",
        disposition: "review",
        reason:
          "feature_credit_marker_without_structural_feature_credit_proof",
        evidence: {
          title: input.title,
          removedFragments:
            featureCleanup.removedFragments,
          primaryArtistSlug:
            input.primaryArtistSlug || "",
          primaryArtistName:
            input.primaryArtistName || "",
          structuredFeaturedArtists:
            input.featuredArtists || [],
        },
      }));
    }
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

  const recordingIdentityPeers =
    input.recordingIdentityPeers || [];

  if (recordingIdentityPeers.length > 0) {
    const canonicalTitleSlug =
      slugifyIdentity(
        featureCleanup.coreTitle,
      );

    findings.push(makeFinding({
      ruleId:
        "track_recording_identity_conflict",
      ruleVersion:
        MIZIZI_PUBLIC_IDENTITY_REVIEW_RULE_VERSION,
      entityType: "track",
      entityId: input.id,
      fieldName:
        "recording_identity",
      currentValue: input.id,
      proposedValue:
        "human_review_required",
      confidence: 1,
      severity: "high",
      disposition: "review",
      reason:
        "same_primary_artist_and_normalized_title_multiple_track_identities",
      evidence: {
        canonicalTitleSlug,
        isrc: input.isrc || "",
        peers:
          recordingIdentityPeers,
        identityPolicy:
          "different_isrc_is_evidence_not_automatic_distinct_recording_proof",
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

  const slugPackagingType =
    input.slug.match(
      /-(single|ep|album)$/i,
    )?.[1]?.toLowerCase() || "";

  const cleanup =
    slugPackagingType
      ? stripReleasePackagingSuffix(
          input.title,
          slugPackagingType,
        )
      : {
          coreTitle: input.title,
          removedSuffix: "",
        };

  if (!cleanup.removedSuffix) {
    return findings;
  }

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
      packagingType:
        slugPackagingType,
      removedSuffix:
        cleanup.removedSuffix,
    },
  }));

  const slugPackagingSuffix =
    new RegExp(
      "-" +
        slugPackagingType +
        "$",
      "i",
    );
  const proposedSlug =
    input.slug
      .replace(
        slugPackagingSuffix,
        "",
      )
      .replace(/-+$/g, "");

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
      confidence: 1,
      severity: "high",
      disposition: "auto_fix_candidate",
      reason: "provider_package_type_is_not_slug_identity",
      evidence: {
        releaseType: input.releaseType || "",
        packagingType:
          slugPackagingType,
        sourceTitle: input.title,
        baseCleanSlug: proposedSlug,
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
