import { describe, expect, it } from "vitest";
import {
  JOB_REGISTRY,
  RELATIONSHIP_CONFIDENCE_BANDS,
  RELATIONSHIP_ENTITY_TYPES,
} from "../../supabase/functions/institute-assistant/jobs";
import {
  CONFIDENCE_BAND_LABELS,
  RELATIONSHIP_ENTITY_TYPES as SERVICE_ENTITY_TYPES,
} from "../../src/services/institute/relationshipService";

// Entity types allowed by the institute_relationships check constraint
// (migration 202607050001, per the approved schema plan).
const DB_ENTITY_TYPES = [
  "artist",
  "track",
  "release",
  "label",
  "genre",
  "scene",
  "place",
  "event",
  "institution",
  "person",
  "work",
  "contributor_memory",
  "evidence_item",
  "claim",
  "inquiry",
];

const evidenceA = "00000000-0000-0000-0000-00000000e001";
const evidenceB = "00000000-0000-0000-0000-00000000e002";

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
  evidence: [
    {
      id: evidenceA,
      title: "Playlist log",
      evidence_kind: "Chart data",
      summary: "s",
      why_it_matters: "w",
      review_state: "Accepted for internal memory",
    },
  ],
  workbenchSetup: null,
};

const sampleOutput = {
  candidates: [
    {
      source_entity: { entity_type: "artist", label: "Mbogi Genje", registry_slug: "mbogi-genje" },
      target_entity: { entity_type: "scene", label: "Umoja gengetone scene", registry_slug: "" },
      relationship_kind: "grew out of",
      plain_reason: "The playlist log ties their first rotations to Umoja shows.",
      confidence_band: "partly_supported",
      evidence_item_ids: [evidenceA, evidenceB],
      contradictions: ["One interview claims a Kayole origin"],
      recommended_action: "review_carefully",
    },
    {
      source_entity: { entity_type: "person", label: "Unknown DJ", registry_slug: "" },
      target_entity: { entity_type: "genre", label: "gengetone", registry_slug: "gengetone" },
      relationship_kind: "championed",
      plain_reason: "Only hearsay so far.",
      confidence_band: "thin_support",
      evidence_item_ids: [],
      contradictions: [],
      recommended_action: "hold_as_doubt",
    },
  ],
  material_note: "Only one reviewed evidence item exists; most connections are not mappable yet.",
};

describe("relationship_mapper job", () => {
  const job = JOB_REGISTRY.relationship_mapper;

  it("is registered with grounding rules in the prompt", () => {
    expect(job).toBeDefined();
    expect(job.system).toContain("Never invent slugs");
    expect(job.system).toContain("hold_as_doubt");
    expect(job.system.includes("—")).toBe(false);
  });

  it("entity types and bands match the database contract and the service", () => {
    expect([...RELATIONSHIP_ENTITY_TYPES]).toEqual(DB_ENTITY_TYPES);
    expect([...SERVICE_ENTITY_TYPES]).toEqual(DB_ENTITY_TYPES);
    expect([...RELATIONSHIP_CONFIDENCE_BANDS]).toEqual(Object.keys(CONFIDENCE_BAND_LABELS));
  });

  it("maps candidates to relationship_lead suggestions with word bands, never numbers", () => {
    const suggestions = job.mapSuggestions(sampleOutput, ctx);
    const leads = suggestions.filter((s) => s.suggestion_type === "relationship_lead");
    expect(leads).toHaveLength(2);
    for (const lead of leads) {
      expect(lead.confidence).toBeNull();
      const payload = lead.payload as { kind?: string; confidenceBand?: string };
      expect(payload.kind).toBe("relationship_candidate");
      expect(RELATIONSHIP_CONFIDENCE_BANDS).toContain(payload.confidenceBand);
    }
  });

  it("filters cited evidence to ids that exist and flags evidence-less candidates", () => {
    const suggestions = job.mapSuggestions(sampleOutput, ctx);
    const grounded = suggestions[0].payload as { evidenceItemIds: string[]; needsEvidence: boolean };
    expect(grounded.evidenceItemIds).toEqual([evidenceA]); // unknown id dropped
    expect(grounded.needsEvidence).toBe(false);
    const hearsay = suggestions[1].payload as { evidenceItemIds: string[]; needsEvidence: boolean };
    expect(hearsay.evidenceItemIds).toEqual([]);
    expect(hearsay.needsEvidence).toBe(true);
  });

  it("surfaces the material note as a risk note", () => {
    const suggestions = job.mapSuggestions(sampleOutput, ctx);
    const note = suggestions.find((s) => (s.payload as { kind?: string }).kind === "relationship_material_note");
    expect(note?.suggestion_type).toBe("risk_note");
  });
});

describe("relationship confidence labels", () => {
  it("are human words without em dashes or numbers", () => {
    for (const label of Object.values(CONFIDENCE_BAND_LABELS)) {
      expect(label.includes("—")).toBe(false);
      expect(/\d/.test(label)).toBe(false);
    }
  });
});
