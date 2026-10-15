import { describe, expect, it } from "vitest";
import { findingToCaseCandidateV1 } from "../../scripts/registry/agents/mizizi/runtime/case-adapter";
import type { MiziziFinding } from "../../scripts/registry/agents/mizizi/core";

const WORKSPACE = "b9710e6a-ceb7-4628-bfda-3471fd96c4c5";
const TRACK = "afbe3f47-62af-4b68-8d54-527f04987ebe";
const BASE: MiziziFinding = {
  fingerprint: "a".repeat(64),
  ruleId: "track_recording_identity_conflict",
  ruleVersion: "1.3.0",
  entityType: "track",
  entityId: TRACK,
  fieldName: "recording_identity",
  currentValue: "ambiguous",
  proposedValue: "candidate_track_reference",
  confidence: 0.92,
  severity: "high",
  disposition: "review",
  reason: "Two tracks require independent investigation",
  evidence: { source: "observation_only", proposal: "not_approved" },
};
const make = (finding: MiziziFinding) => findingToCaseCandidateV1({
  workspaceId: WORKSPACE,
  policyRulesetVersion: "mizizi-cultural-data-steward-1.2.0",
  finding,
});

describe("MIZIZI Headquarters pure case adapter", () => {
  it("maps a finding to a DB02-compatible triage candidate, never an approval", () => {
    const result = make(BASE);
    expect(result.contract).toBe("mizizi.case_candidate.v1");
    expect(result.persistence).toMatchObject({
      workspace_id: WORKSPACE,
      subject_type: "track",
      subject_id: TRACK,
      claim_family_key: "recording_identity_review_v1",
      claim_key: "mizizi.track_recording_identity_conflict.recording_identity",
      case_state: "open",
      current_stage: "triage",
      epistemic_state: "unknown",
      mutation_state: "not_planned",
      publication_state: "not_requested",
      delivery_state: "not_requested",
      risk_class: "high",
      transition_actor_key: "system:mizizi",
    });
    expect(result.persistence.case_key).toMatch(/^mizizi:case:v1:[a-f0-9]{64}$/);
    expect(JSON.stringify(result)).not.toMatch(/execution_grant|human_approved|registry_mutation/);
    expect(result).not.toHaveProperty("decision");
  });

  it("reuses case identity when new observations contradict prior proposals", () => {
    const first = make(BASE);
    const later = make({ ...BASE, fingerprint: "b".repeat(64), confidence: 0.01,
      proposedValue: "opposite_candidate", disposition: "auto_fix_candidate" });
    expect(later.persistence.case_key).toBe(first.persistence.case_key);
    expect(later.persistence.last_observation_fingerprint).not.toBe(first.persistence.last_observation_fingerprint);
    expect(later.persistence.mutation_state).toBe("not_planned");
  });

  it("separates multiple cultural claims about the same Track", () => {
    const first = make(BASE);
    const second = make({ ...BASE, ruleId: "track_title_credit_noise", fieldName: "artist_credit" });
    expect(second.persistence.case_key).not.toBe(first.persistence.case_key);
    expect(second.persistence.claim_family_key).toBe("track_credit_name_review_v1");
  });

  it("keeps case keys stable across workspaces while preserving workspace isolation", () => {
    const one = make(BASE);
    const two = findingToCaseCandidateV1({
      workspaceId: "d8ab02c0-b26b-4de0-8bd1-12c073c649c1",
      policyRulesetVersion: "mizizi-cultural-data-steward-1.2.0",
      finding: BASE,
    });
    expect(two.persistence.case_key).toBe(one.persistence.case_key);
    expect(two.persistence.workspace_id).not.toBe(one.persistence.workspace_id);
  });

  it("uses schema-authorized contribution type, not a new canonical Person", () => {
    const result = make({ ...BASE, entityType: "contribution_attestation",
      ruleId: "provenance_admissible_attestation_pending_review", fieldName: "credit_evidence" });
    expect(result.persistence.subject_type).toBe("contribution");
    expect(result.persistence.epistemic_state).toBe("unknown");
  });

  it("refuses unknown rule families, malformed authority and untrusted identifiers", () => {
    expect(() => make({ ...BASE, ruleId: "future_unreviewed_rule" })).toThrow("unregistered rule");
    expect(() => make({ ...BASE, entityId: "a-track-slug" })).toThrow("invalid finding.entityId");
    expect(() => make({ ...BASE, fingerprint: "not-sha256" })).toThrow("invalid observation fingerprint");
    expect(() => make({ ...BASE, fieldName: "__unsafe field" })).toThrow("invalid fieldName");
    expect(() => findingToCaseCandidateV1({
      workspaceId: "not-an-id", policyRulesetVersion: "1.2.0", finding: BASE,
    })).toThrow("invalid workspaceId");
  });

  it("never alters a live finding or treats confidence as approval", () => {
    const copy = structuredClone(BASE);
    const item = make(BASE);
    expect(BASE).toEqual(copy);
    expect(item.persistence.case_state).toBe("open");
    expect(item.persistence.mutation_state).toBe("not_planned");
    expect(item.persistence).not.toHaveProperty("approval_ref");
  });
});
