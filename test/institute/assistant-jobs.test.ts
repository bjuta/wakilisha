import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { JOB_REGISTRY } from "../../supabase/functions/institute-assistant/jobs";

// Suggestion types allowed by the institute_assistant_suggestions check
// constraint (migration 202607020001). Every mapped suggestion must use one.
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

// Task values allowed after migration 202607040004.
const ALLOWED_TASKS = new Set([
  "anchor_context_lift",
  "question_clinic_help",
  "workbench_setup_suggestions",
  "evidence_search_plan",
  "relationship_suggestions",
  "risk_and_doubt_check",
  "next_inquiry_suggestions",
  "question_clinic",
  "evidence_reader",
  "relationship_mapper",
  "claim_docket_builder",
  "inquiry_summary_builder",
  "how_this_learned_builder",
  "learning_board_curator",
  "lineage_fork_analyzer",
  "correction_impact_analyst",
  "next_step_recommender",
]);

const sampleContext = {
  inquiry: {
    id: "00000000-0000-0000-0000-000000000001",
    code: "INQ-0001",
    raw_question: "Why did gengetone fade from Nairobi radio?",
    current_question: "What changed in Nairobi radio programming between 2020 and 2023 that reduced gengetone airplay?",
    status: "framing",
    maturity: "framing",
  },
  questionVersion: { id: "00000000-0000-0000-0000-000000000002", version_number: 2, question_text: "..." },
  anchorSnapshot: null,
  evidence: [],
  workbenchSetup: null,
};

function assertStrictObjectSchema(schema: Record<string, unknown>, trail: string) {
  if (schema.type === "object") {
    expect(schema.additionalProperties, `${trail} must set additionalProperties false`).toBe(false);
    const properties = (schema.properties ?? {}) as Record<string, Record<string, unknown>>;
    const required = (schema.required ?? []) as string[];
    expect(new Set(required), `${trail} must require every property`).toEqual(new Set(Object.keys(properties)));
    Object.entries(properties).forEach(([key, child]) => assertStrictObjectSchema(child, `${trail}.${key}`));
  }
  if (schema.type === "array" && schema.items) {
    assertStrictObjectSchema(schema.items as Record<string, unknown>, `${trail}[]`);
  }
}

describe("assistant job registry", () => {
  it("registers exactly the shipped jobs", () => {
    expect(Object.keys(JOB_REGISTRY).sort()).toEqual(["evidence_reader", "next_step_recommender", "question_clinic", "relationship_mapper"]);
  });

  it("every job is complete and uses an allowed task name", () => {
    for (const job of Object.values(JOB_REGISTRY)) {
      expect(ALLOWED_TASKS.has(job.task)).toBe(true);
      expect(job.promptVersion).toMatch(/\.v\d+$/);
      expect(job.inputSchemaVersion.length).toBeGreaterThan(0);
      expect(job.outputSchemaVersion.length).toBeGreaterThan(0);
      expect(job.maxTokens).toBeGreaterThan(0);
      expect(job.system.length).toBeGreaterThan(100);
      assertStrictObjectSchema(job.outputSchema, job.task);
    }
  });

  it("system prompts follow the copy rules (no em dashes)", () => {
    for (const job of Object.values(JOB_REGISTRY)) {
      expect(job.system.includes("—")).toBe(false);
    }
  });
});

describe("question_clinic suggestion mapping", () => {
  const output = {
    refined_question: "What changed in Nairobi radio programming between 2020 and 2023 that reduced gengetone airplay?",
    refinement_reason: "The raw question assumes gengetone faded everywhere; radio airplay is the measurable slice.",
    recommended_assessment: "ready",
    sub_questions: [{ question: "Which stations changed playlists?", reason: "Narrows the evidence hunt." }],
    scope_boundaries: ["Nairobi stations only"],
    assumptions: ["Airplay fell at all"],
    terms_needing_definition: ["fade"],
    evidence_needs: [{ need: "Playlist logs from two stations", reason: "Direct measure of airplay." }],
    possible_forks: [{ question: "Did streaming replace radio for gengetone?", reason: "Different medium, different inquiry." }],
    risk_notes: ["Nostalgia bias in interviews"],
    next_honest_move: { title: "Collect playlist evidence", body: "Ask two stations for 2020 and 2023 logs." },
    confidence: 130,
  };

  it("maps every suggestion to an allowed type and clamps confidence", () => {
    const suggestions = JOB_REGISTRY.question_clinic.mapSuggestions(output, sampleContext);
    expect(suggestions.length).toBeGreaterThanOrEqual(7);
    suggestions.forEach((s) => {
      expect(ALLOWED_SUGGESTION_TYPES.has(s.suggestion_type)).toBe(true);
      expect(s.body.length).toBeGreaterThan(0);
      if (s.confidence !== null) {
        expect(s.confidence).toBeGreaterThanOrEqual(0);
        expect(s.confidence).toBeLessThanOrEqual(100);
      }
    });
    const refined = suggestions.find((s) => (s.payload as { kind?: string }).kind === "refined_question");
    expect(refined?.suggestion_type).toBe("possible_question");
    const nextMove = suggestions.find((s) => s.suggestion_type === "next_move");
    expect(nextMove?.title).toBe("Collect playlist evidence");
    const fork = suggestions.find((s) => (s.payload as { kind?: string }).kind === "possible_fork");
    expect(fork?.suggestion_type).toBe("doubt");
  });
});

describe("next_step_recommender suggestion mapping", () => {
  it("produces one next move with clamped confidence", () => {
    const suggestions = JOB_REGISTRY.next_step_recommender.mapSuggestions(
      {
        next_move: { title: "Read the waiting evidence", body: "Three items are unread.", reason: "Evidence before claims." },
        waiting_on: ["Editor review of INQ-0001 packet"],
        confidence: -5,
      },
      sampleContext,
    );
    expect(suggestions).toHaveLength(1);
    expect(suggestions[0].suggestion_type).toBe("next_move");
    expect(suggestions[0].confidence).toBe(0);
  });
});

describe("provider stays server-side", () => {
  it("no file under src/ references the provider or its key", () => {
    const offenders: string[] = [];
    const walk = (dir: string) => {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          walk(full);
        } else if (/\.(ts|tsx|js|jsx)$/.test(entry.name)) {
          const content = fs.readFileSync(full, "utf8");
          if (/anthropic/i.test(content)) offenders.push(full);
        }
      }
    };
    walk(path.resolve(__dirname, "../../src"));
    expect(offenders).toEqual([]);
  });
});
