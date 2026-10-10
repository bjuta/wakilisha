/**
 * MIZIZI Headquarters / Slice 1 — pure finding to case-candidate adapter.
 *
 * No SQL, auth, job dispatch, grant issuance, decision recording, or Registry DML.
 * Existing MIZIZI rule findings remain authoritative as *observations*, not facts.
 * A separate privileged, reviewed writer must validate and persist the candidate.
 */
import { createHash } from "node:crypto";
import type { MiziziFinding, MiziziEntityType } from "../core";

export const CASE_CANDIDATE_CONTRACT = "mizizi.case_candidate.v1" as const;

// Explicit, reviewable mapping: unknown rule IDs must NOT generate a new policy family.
// These are governance classification families, NOT operation licences.
const RULE_FAMILIES = {
  provenance_attestation_evidence_binding_drift: "contribution_provenance_review_v1",
  provenance_attestation_multiple_canonical_rows: "contribution_provenance_review_v1",
  provenance_admissible_attestation_pending_review: "contribution_provenance_review_v1",
  provenance_attestation_noncurrent_canonical_history: "contribution_provenance_review_v1",
  track_slug_identity_noise: "track_identity_metadata_review_v1",
  track_slug_identity_mismatch: "track_identity_metadata_review_v1",
  track_slug_credit_evidence_gap: "track_identity_metadata_review_v1",
  track_title_credit_noise: "track_credit_name_review_v1",
  track_recording_identity_conflict: "recording_identity_review_v1",
  release_taxonomy_drift: "release_taxonomy_review_v1",
  release_title_provider_packaging: "release_identity_metadata_review_v1",
  release_slug_provider_packaging: "release_identity_metadata_review_v1",
  chart_track_slug_drift: "chart_identity_projection_review_v1",
  chart_artist_slug_drift: "chart_identity_projection_review_v1",
} as const satisfies Record<string, string>;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const SHA256 = /^[0-9a-f]{64}$/;
const KEY_SEGMENT = /^[a-z][a-z0-9_]{2,79}$/;

export type CaseSubjectTypeV1 = "track" | "release" | "chart_entry" | "contribution";

export type CaseCandidateInsertV1 = Readonly<{
  workspace_id: string;
  case_key: string;
  subject_type: CaseSubjectTypeV1;
  subject_id: string;
  claim_family_key: string;
  claim_key: string;
  case_state: "open";
  current_stage: "triage";
  epistemic_state: "unknown";
  mutation_state: "not_planned";
  publication_state: "not_requested";
  delivery_state: "not_requested";
  risk_class: "high";
  last_observation_fingerprint: string;
  policy_ruleset_version: string;
  transition_actor_key: "system:mizizi";
  transition_reason: string;
}>;

export type CaseCandidateV1 = Readonly<{
  contract: typeof CASE_CANDIDATE_CONTRACT;
  source: "mizizi_deterministic_finding";
  rule_id: string;
  rule_version: string;
  finding_disposition: MiziziFinding["disposition"];
  finding_fingerprint: string;
  persistence: CaseCandidateInsertV1;
  // Deliberately absent: human decision, approval, grant, operation, evidence authority.
}>;

function requireUuid(value: string, field: string): string {
  if (typeof value !== "string" || !UUID.test(value)) {
    throw new TypeError(`MIZIZI case candidate: invalid ${field}`);
  }
  return value.toLowerCase();
}

function subjectType(type: MiziziEntityType): CaseSubjectTypeV1 {
  switch (type) {
    case "track": return "track";
    case "release": return "release";
    case "chart_entry": return "chart_entry";
    // DB02 refers to the cultural contribution, not a new canonical identity.
    case "contribution_attestation": return "contribution";
    default: throw new TypeError("MIZIZI case candidate: unsupported subject type");
  }
}

function claimSegment(value: string, field: string): string {
  if (typeof value !== "string" || !KEY_SEGMENT.test(value)) {
    throw new TypeError(`MIZIZI case candidate: invalid ${field}`);
  }
  return value;
}

export function findingToCaseCandidateV1(input: Readonly<{
  workspaceId: string;
  policyRulesetVersion: string;
  finding: Readonly<MiziziFinding>;
}>): CaseCandidateV1 {
  const workspaceId = requireUuid(input.workspaceId, "workspaceId");
  const finding = input.finding;
  if (!finding || typeof finding !== "object") {
    throw new TypeError("MIZIZI case candidate: finding is required");
  }
  const subjectId = requireUuid(finding.entityId, "finding.entityId");
  const mappedSubjectType = subjectType(finding.entityType);
  const ruleId = claimSegment(finding.ruleId, "ruleId");
  const fieldName = claimSegment(finding.fieldName, "fieldName");
  if (!Object.prototype.hasOwnProperty.call(RULE_FAMILIES, ruleId)) {
    throw new TypeError("MIZIZI case candidate: unregistered rule family");
  }
  if (typeof finding.ruleVersion !== "string" ||
      finding.ruleVersion.length < 1 || finding.ruleVersion.length > 64) {
    throw new TypeError("MIZIZI case candidate: invalid ruleVersion");
  }
  if (typeof finding.fingerprint !== "string" || !SHA256.test(finding.fingerprint)) {
    throw new TypeError("MIZIZI case candidate: invalid observation fingerprint");
  }
  if (!["observe", "review", "auto_fix_candidate"].includes(finding.disposition)) {
    throw new TypeError("MIZIZI case candidate: invalid observation disposition");
  }
  const policyRulesetVersion = input.policyRulesetVersion;
  if (typeof policyRulesetVersion !== "string" ||
      policyRulesetVersion.length < 3 || policyRulesetVersion.length > 128 ||
      !/^[a-zA-Z0-9][a-zA-Z0-9._:-]*$/.test(policyRulesetVersion)) {
    throw new TypeError("MIZIZI case candidate: invalid policyRulesetVersion");
  }

  const claimFamilyKey = RULE_FAMILIES[ruleId as keyof typeof RULE_FAMILIES];
  const claimKey = `mizizi.${ruleId}.${fieldName}`;
  if (claimKey.length > 200) {
    throw new TypeError("MIZIZI case candidate: claim key exceeds DB02 limit");
  }
  // Important: proposal, confidence, source payload and observation hash are NOT
  // part of identity. Changed observations must reopen/revise the SAME case.
  const identity = JSON.stringify([mappedSubjectType, subjectId, claimFamilyKey, claimKey]);
  const caseKey = `mizizi:case:v1:${createHash("sha256").update(identity).digest("hex")}`;

  return {
    contract: CASE_CANDIDATE_CONTRACT,
    source: "mizizi_deterministic_finding",
    rule_id: ruleId,
    rule_version: finding.ruleVersion,
    finding_disposition: finding.disposition,
    finding_fingerprint: finding.fingerprint,
    persistence: {
      workspace_id: workspaceId,
      case_key: caseKey,
      subject_type: mappedSubjectType,
      subject_id: subjectId,
      claim_family_key: claimFamilyKey,
      claim_key: claimKey,
      case_state: "open",
      current_stage: "triage",
      epistemic_state: "unknown",
      mutation_state: "not_planned",
      publication_state: "not_requested",
      delivery_state: "not_requested",
      risk_class: "high", // unassessed: conservative, NOT derived permission
      last_observation_fingerprint: finding.fingerprint,
      policy_ruleset_version: policyRulesetVersion,
      transition_actor_key: "system:mizizi",
      transition_reason: "MIZIZI deterministic finding awaiting governed case triage.",
    },
  };
}
