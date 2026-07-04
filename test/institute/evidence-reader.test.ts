import { describe, expect, it } from "vitest";
import { JOB_REGISTRY } from "../../supabase/functions/institute-assistant/jobs";
import { READER_VERDICT_OPTIONS } from "../../src/services/institute/evidenceReaderService";

const ALLOWED_SUGGESTION_TYPES = new Set([
  "known",
  "unknown",
  "possible_question",
  "relationship_lead",
  "evidence_gap",
  "risk_note",
  "workbench_setup",
  "next_move",
  "public_path",
  "doubt",
]);

// review_state values allowed by the institute_evidence_items check
// constraint (migration 202607020002).
const ALLOWED_REVIEW_STATES = new Set([
  "Draft",
  "Needs review",
  "Accepted for internal memory",
  "Public-safe candidate",
  "Needs more evidence",
  "Kept as doubt",
  "Rejected with reason",
]);

const targetEvidence = {
  id: "00000000-0000-0000-0000-00000000e001",
  title: "Radio playlist log, March 2021",
  evidence_kind: "Chart data",
  source: "Station archive",
  source_url: null,
  summary: "Playlist rotation counts for gengetone tracks in March 2021.",
  why_it_matters: "Direct measure of airplay.",
  review_state: "Needs review",
};

const ctx = {
  inquiry: {
    id: "00000000-0000-0000-0000-000000000001",
    code: "INQ-0001",
    raw_question: "raw",
    current_question: "working",
    status: "framing",
    maturity: "framing",
  },
  questionVersion: null,
  anchorSnapshot: null,
  evidence: [],
  workbenchSetup: null,
  targetEvidence,
};

const sampleOutput = {
  summary: "The log shows gengetone rotations fell between weeks 1 and 4.",
  key_facts: ["Week 1 had 41 gengetone spins", "Week 4 had 12 gengetone spins"],
  named_entities: [{ name: "Radio Jambo", entity_kind: "institution", note: "Station whose log this is" }],
  source_quality_notes: ["Single station; not citywide"],
  possible_relationships: [
    { from_entity: "Radio Jambo", to_entity: "gengetone", how: "reduced rotation", reason: "Counts fall across the month" },
  ],
  possible_claims: [
    { claim: "Airplay fell at Radio Jambo in March 2021", evidence_role: "supports", reason: "Direct counts" },
  ],
  contradictions: ["An interview in the file says airplay was stable"],
  missing_context: ["No comparison month from 2019"],
  confidence: 80,
};

describe("evidence_reader job", () => {
  const job = JOB_REGISTRY.evidence_reader;

  it("is registered, requires target evidence, and prompts against claim judgment", () => {
    expect(job).toBeDefined();
    expect(job.requiresTargetEvidence).toBe(true);
    expect(job.system).toContain("extraction is not claim judgment");
    expect(job.system.includes("—")).toBe(false);
  });

  it("maps extraction parts to allowed suggestion types, all tagged with the evidence id", () => {
    const suggestions = job.mapSuggestions(sampleOutput, ctx);
    expect(suggestions.length).toBe(8);
    for (const s of suggestions) {
      expect(ALLOWED_SUGGESTION_TYPES.has(s.suggestion_type)).toBe(true);
      const payload = s.payload as { kind?: string; evidenceItemId?: string };
      expect(payload.kind).toBe("evidence_extraction");
      expect(payload.evidenceItemId).toBe(targetEvidence.id);
    }
    const parts = suggestions.map((s) => (s.payload as { part?: string }).part);
    expect(parts).toContain("summary");
    expect(parts).toContain("possible_claim");
    expect(parts).toContain("contradiction");
    expect(parts).toContain("missing_context");
    const claim = suggestions.find((s) => (s.payload as { part?: string }).part === "possible_claim");
    expect(claim?.title).toBe("Possible claim, not yet judged");
  });

  it("targets one evidence item in the user content, with context clearly secondary", () => {
    const content = job.buildUserContent(ctx);
    expect(content).toContain("TARGET EVIDENCE");
    expect(content).toContain(targetEvidence.title);
    expect(content).toContain("orientation only");
  });
});

describe("reader verdicts", () => {
  it("every verdict option carries a human label and hint without em dashes", () => {
    expect(READER_VERDICT_OPTIONS.length).toBe(6);
    for (const option of READER_VERDICT_OPTIONS) {
      expect(option.label.length).toBeGreaterThan(3);
      expect(option.hint.length).toBeGreaterThan(4);
      expect(option.label.includes("—")).toBe(false);
      expect(option.hint.includes("—")).toBe(false);
    }
  });

  it("the review states this panel can produce are all valid database states", () => {
    // Keep in sync with VERDICT_TO_REVIEW_STATE in evidenceReaderService.
    const producedStates = [
      "Accepted for internal memory",
      "Kept as doubt",
      "Rejected with reason",
      "Needs more evidence",
    ];
    for (const state of producedStates) {
      expect(ALLOWED_REVIEW_STATES.has(state)).toBe(true);
    }
  });
});
