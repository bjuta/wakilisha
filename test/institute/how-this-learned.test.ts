import { describe, expect, it } from "vitest";
import { buildLearningTimeline } from "../../src/services/institute/howThisLearnedService";

const versions = [
  {
    id: "v2",
    version_number: 2,
    question_text: "Refined question",
    version_type: "clinic_refinement",
    reason: "Sharper scope",
    created_at: "2026-07-04T20:51:00Z",
  },
  {
    id: "v1",
    version_number: 1,
    question_text: "Raw question",
    version_type: "raw",
    reason: "Initial Inquiry question",
    created_at: "2026-07-04T20:47:00Z",
  },
];

const events = [
  {
    id: "e1",
    event_type: "question_refined",
    event_label: "Question Clinic refined the working question",
    before_value: {},
    after_value: { question: "Refined question" },
    metadata: { reason: "Sharper scope" },
    created_at: "2026-07-04T20:51:01Z",
  },
  {
    id: "e2",
    event_type: "clinic_assessment_recorded",
    event_label: "Question Clinic assessed the working question",
    before_value: {},
    after_value: { assessment: "raw_but_promising" },
    metadata: { note: "Still shaping" },
    created_at: "2026-07-04T20:52:00Z",
  },
  {
    id: "e3",
    event_type: "evidence_review_decided",
    event_label: "Evidence Reader recorded a decision",
    before_value: {},
    after_value: { verdict: "context_only" },
    metadata: { note: "Background only" },
    created_at: "2026-07-05T00:10:00Z",
  },
];

const decidedSuggestions = [
  {
    id: "s1",
    suggestion_type: "possible_question",
    title: "Refined working question",
    body: "A suggested refinement",
    status: "rejected",
    reviewed_at: "2026-07-04T21:00:00Z",
  },
];

const packets = [
  {
    id: "p1",
    packet_version: 1,
    status: "under_review",
    editor_decision: null,
    reviewed_at: null,
    submitted_at: "2026-07-03T10:00:00Z",
  },
];

describe("buildLearningTimeline", () => {
  const timeline = buildLearningTimeline(events, versions, decidedSuggestions, packets);

  it("orders newest first and includes every source", () => {
    expect(timeline.map((e) => e.id)).toEqual([
      "event-e3",
      "suggestion-s1",
      "event-e2",
      "version-v2",
      "version-v1",
      "packet-p1",
    ]);
  });

  it("does not duplicate question refinements (version entry wins over event)", () => {
    expect(timeline.some((e) => e.id === "event-e1")).toBe(false);
    const v2 = timeline.find((e) => e.id === "version-v2");
    expect(v2?.title).toBe("The question moved to v2");
    expect(v2?.detail).toBe("Sharper scope");
  });

  it("uses human language, not raw types", () => {
    const raw = timeline.find((e) => e.id === "version-v1");
    expect(raw?.title).toBe("The question arrived");
    const decided = timeline.find((e) => e.id === "suggestion-s1");
    expect(decided?.title).toBe("A suggestion was rejected");
    for (const entry of timeline) {
      expect(entry.title.includes("—")).toBe(false);
      expect(entry.title.includes("_")).toBe(false);
    }
  });

  it("humanizes stored enum values instead of leaking them", () => {
    const verdictEntry = timeline.find((e) => e.id === "event-e3");
    expect(verdictEntry?.body).toBe("Keep for context only");
    const assessmentEntry = timeline.find((e) => e.id === "event-e2");
    expect(assessmentEntry?.body).toBe("Raw but promising");
    for (const entry of timeline) {
      expect(entry.body.includes("_")).toBe(false);
    }
  });

  it("groups entries for filtering", () => {
    expect(timeline.find((e) => e.id === "event-e3")?.group).toBe("evidence");
    expect(timeline.find((e) => e.id === "event-e2")?.group).toBe("question");
    expect(timeline.find((e) => e.id === "suggestion-s1")?.group).toBe("assistant");
    expect(timeline.find((e) => e.id === "packet-p1")?.group).toBe("review");
  });
});
