// Inquiry Court assistant job registry.
// Each job carries its prompt version, output schema, and the mapping from
// model output to reviewable suggestion rows. The assistant creates
// candidates. Humans create the record. Nothing here writes canonical data.

export type JobContext = {
  inquiry: {
    id: string;
    code: string;
    raw_question: string;
    current_question: string;
    status: string;
    maturity: string;
  };
  questionVersion: { id: string; version_number: number; question_text: string } | null;
  anchorSnapshot: Record<string, unknown> | null;
  evidence: Array<{
    id: string;
    title: string;
    evidence_kind: string;
    summary: string;
    why_it_matters: string;
    review_state: string;
  }>;
  workbenchSetup: Record<string, unknown> | null;
  /** Set when a job targets one evidence item (evidence_reader). */
  targetEvidence?: {
    id: string;
    title: string;
    evidence_kind: string;
    source: string;
    source_url: string | null;
    summary: string;
    why_it_matters: string;
    review_state: string;
  } | null;
};

export type SuggestionInsert = {
  suggestion_type:
    | "known"
    | "unknown"
    | "possible_question"
    | "relationship_lead"
    | "evidence_gap"
    | "risk_note"
    | "workbench_setup"
    | "next_move"
    | "public_path"
    | "doubt";
  title: string;
  body: string;
  reason: string | null;
  confidence: number | null;
  payload: Record<string, unknown>;
};

export type JobDefinition = {
  task: "question_clinic" | "next_step_recommender" | "evidence_reader";
  /** When true, the request must name an evidenceItemId and the engine loads it. */
  requiresTargetEvidence?: boolean;
  promptVersion: string;
  inputSchemaVersion: string;
  outputSchemaVersion: string;
  maxTokens: number;
  system: string;
  outputSchema: Record<string, unknown>;
  buildUserContent: (ctx: JobContext) => string;
  mapSuggestions: (output: Record<string, unknown>, ctx: JobContext) => SuggestionInsert[];
};

const DOCTRINE = `You assist the WAKILISHA Institute, a cultural inquiry practice for African music and culture.
Rules that bind every output:
- You suggest. Humans decide. Never present a suggestion as settled truth.
- Unknown is better than invented. If the material is thin, say what is missing instead of padding with confident prose.
- The question comes first. Serve the working question, not a generic content plan.
- Write in plain, warm, direct language. No academic fog, no marketing tone, no database jargon.
- Never use em dashes.
- When you mention names of people, works, or places, copy them exactly as they appear in the context. Never add stray punctuation or possessives to a name. If a possessive would read awkwardly, rephrase the sentence instead (write "the career of Nikita Kering", not a mangled possessive).
- Confidence is a number from 0 to 100 describing how well the provided material supports the suggestion. It is not a score of cultural quality.`;

function contextJson(ctx: JobContext): string {
  return JSON.stringify(
    {
      inquiryCode: ctx.inquiry.code,
      rawQuestion: ctx.inquiry.raw_question,
      workingQuestion: ctx.inquiry.current_question,
      inquiryStatus: ctx.inquiry.status,
      inquiryMaturity: ctx.inquiry.maturity,
      anchorContext: ctx.anchorSnapshot,
      evidence: ctx.evidence.map((item) => ({
        title: item.title,
        kind: item.evidence_kind,
        summary: item.summary,
        whyItMatters: item.why_it_matters,
        reviewState: item.review_state,
      })),
      workbenchSetup: ctx.workbenchSetup,
    },
    null,
    2,
  );
}

const CLINIC_ASSESSMENTS = [
  "raw_but_promising",
  "ready",
  "too_broad",
  "too_narrow",
  "loaded",
  "false_assumption",
  "too_speculative",
  "not_answerable_yet",
  "already_answered",
  "different_question",
  "should_fork",
  "should_merge",
  "should_pause",
] as const;

const questionClinic: JobDefinition = {
  task: "question_clinic",
  promptVersion: "question_clinic.v1",
  inputSchemaVersion: "inquiry_context.v1",
  outputSchemaVersion: "question_clinic_output.v1",
  maxTokens: 6000,
  system: `${DOCTRINE}

Your job is the Question Clinic. Take the raw and working question and help a human sharpen it into an answerable working question. Name what the question assumes, where it is too broad or unsafe, what evidence it needs, and whether a better question is nearby. A weak question is a learning object, not trash. If the question is already strong, say so and keep the refinement minimal.`,
  outputSchema: {
    type: "object",
    additionalProperties: false,
    required: [
      "refined_question",
      "refinement_reason",
      "recommended_assessment",
      "sub_questions",
      "scope_boundaries",
      "assumptions",
      "terms_needing_definition",
      "evidence_needs",
      "possible_forks",
      "risk_notes",
      "next_honest_move",
      "confidence",
    ],
    properties: {
      refined_question: { type: "string" },
      refinement_reason: { type: "string" },
      recommended_assessment: { type: "string", enum: [...CLINIC_ASSESSMENTS] },
      sub_questions: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          required: ["question", "reason"],
          properties: { question: { type: "string" }, reason: { type: "string" } },
        },
      },
      scope_boundaries: { type: "array", items: { type: "string" } },
      assumptions: { type: "array", items: { type: "string" } },
      terms_needing_definition: { type: "array", items: { type: "string" } },
      evidence_needs: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          required: ["need", "reason"],
          properties: { need: { type: "string" }, reason: { type: "string" } },
        },
      },
      possible_forks: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          required: ["question", "reason"],
          properties: { question: { type: "string" }, reason: { type: "string" } },
        },
      },
      risk_notes: { type: "array", items: { type: "string" } },
      next_honest_move: {
        type: "object",
        additionalProperties: false,
        required: ["title", "body"],
        properties: { title: { type: "string" }, body: { type: "string" } },
      },
      confidence: { type: "integer" },
    },
  },
  buildUserContent: (ctx) =>
    `Here is the inquiry context as JSON. Run the Question Clinic on the working question.\n\n${contextJson(ctx)}`,
  mapSuggestions: (output, _ctx) => {
    const out = output as {
      refined_question: string;
      refinement_reason: string;
      recommended_assessment: string;
      sub_questions: Array<{ question: string; reason: string }>;
      scope_boundaries: string[];
      assumptions: string[];
      terms_needing_definition: string[];
      evidence_needs: Array<{ need: string; reason: string }>;
      possible_forks: Array<{ question: string; reason: string }>;
      risk_notes: string[];
      next_honest_move: { title: string; body: string };
      confidence: number;
    };
    const clamp = (n: number) => Math.max(0, Math.min(100, Math.round(n)));
    const suggestions: SuggestionInsert[] = [];

    suggestions.push({
      suggestion_type: "possible_question",
      title: "Refined working question",
      body: out.refined_question,
      reason: out.refinement_reason,
      confidence: clamp(out.confidence),
      payload: {
        kind: "refined_question",
        recommendedAssessment: out.recommended_assessment,
        scopeBoundaries: out.scope_boundaries,
        assumptions: out.assumptions,
        termsNeedingDefinition: out.terms_needing_definition,
      },
    });

    out.sub_questions.forEach((item) => {
      suggestions.push({
        suggestion_type: "possible_question",
        title: "Sub-question",
        body: item.question,
        reason: item.reason,
        confidence: null,
        payload: { kind: "sub_question" },
      });
    });

    out.evidence_needs.forEach((item) => {
      suggestions.push({
        suggestion_type: "evidence_gap",
        title: "Evidence this question needs",
        body: item.need,
        reason: item.reason,
        confidence: null,
        payload: { kind: "evidence_need" },
      });
    });

    out.assumptions.forEach((assumption) => {
      suggestions.push({
        suggestion_type: "risk_note",
        title: "This question assumes",
        body: assumption,
        reason: null,
        confidence: null,
        payload: { kind: "assumption" },
      });
    });

    out.risk_notes.forEach((note) => {
      suggestions.push({
        suggestion_type: "risk_note",
        title: "Risk to watch",
        body: note,
        reason: null,
        confidence: null,
        payload: { kind: "risk_note" },
      });
    });

    out.possible_forks.forEach((fork) => {
      suggestions.push({
        suggestion_type: "doubt",
        title: "A different inquiry may be hiding here",
        body: fork.question,
        reason: fork.reason,
        confidence: null,
        payload: { kind: "possible_fork" },
      });
    });

    suggestions.push({
      suggestion_type: "next_move",
      title: out.next_honest_move.title,
      body: out.next_honest_move.body,
      reason: null,
      confidence: null,
      payload: { kind: "next_honest_move", source: "question_clinic" },
    });

    return suggestions;
  },
};

const nextStepRecommender: JobDefinition = {
  task: "next_step_recommender",
  promptVersion: "next_step_recommender.v1",
  inputSchemaVersion: "inquiry_context.v1",
  outputSchemaVersion: "next_step_output.v1",
  maxTokens: 2000,
  system: `${DOCTRINE}

Your job is to suggest the one next honest move for this inquiry, given its current state. One move, not a menu. Choose the smallest useful action that respects the workflow order: question first, then evidence, then relationships, then claims. If the inquiry is blocked on something a human must decide, name that instead of inventing busywork.`,
  outputSchema: {
    type: "object",
    additionalProperties: false,
    required: ["next_move", "waiting_on", "confidence"],
    properties: {
      next_move: {
        type: "object",
        additionalProperties: false,
        required: ["title", "body", "reason"],
        properties: {
          title: { type: "string" },
          body: { type: "string" },
          reason: { type: "string" },
        },
      },
      waiting_on: { type: "array", items: { type: "string" } },
      confidence: { type: "integer" },
    },
  },
  buildUserContent: (ctx) =>
    `Here is the inquiry context as JSON. Suggest the one next honest move.\n\n${contextJson(ctx)}`,
  mapSuggestions: (output, _ctx) => {
    const out = output as {
      next_move: { title: string; body: string; reason: string };
      waiting_on: string[];
      confidence: number;
    };
    return [
      {
        suggestion_type: "next_move",
        title: out.next_move.title,
        body: out.next_move.body,
        reason: out.next_move.reason,
        confidence: Math.max(0, Math.min(100, Math.round(out.confidence))),
        payload: { kind: "next_honest_move", source: "next_step_recommender", waitingOn: out.waiting_on },
      },
    ];
  },
};

const evidenceReader: JobDefinition = {
  task: "evidence_reader",
  requiresTargetEvidence: true,
  promptVersion: "evidence_reader.v1",
  inputSchemaVersion: "evidence_context.v1",
  outputSchemaVersion: "evidence_reader_output.v1",
  maxTokens: 6000,
  system: `${DOCTRINE}

Your job is the Evidence Reader. Read one piece of evidence and prepare it for the rest of the inquiry. Extract what the evidence actually contains: a faithful summary, the facts it states, the people, works, places, events, and institutions it names, notes on source quality, contradictions with other evidence in the context, and what context is missing. You may point out possible relationships and possible claims, but extraction is not claim judgment: never declare a claim true, only that the evidence appears to support or complicate it. Stay inside what this evidence says. Do not import outside knowledge as if the evidence contained it.`,
  outputSchema: {
    type: "object",
    additionalProperties: false,
    required: [
      "summary",
      "key_facts",
      "named_entities",
      "source_quality_notes",
      "possible_relationships",
      "possible_claims",
      "contradictions",
      "missing_context",
      "confidence",
    ],
    properties: {
      summary: { type: "string" },
      key_facts: { type: "array", items: { type: "string" } },
      named_entities: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          required: ["name", "entity_kind", "note"],
          properties: {
            name: { type: "string" },
            entity_kind: {
              type: "string",
              enum: ["person", "work", "place", "event", "institution", "date", "other"],
            },
            note: { type: "string" },
          },
        },
      },
      source_quality_notes: { type: "array", items: { type: "string" } },
      possible_relationships: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          required: ["from_entity", "to_entity", "how", "reason"],
          properties: {
            from_entity: { type: "string" },
            to_entity: { type: "string" },
            how: { type: "string" },
            reason: { type: "string" },
          },
        },
      },
      possible_claims: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          required: ["claim", "evidence_role", "reason"],
          properties: {
            claim: { type: "string" },
            evidence_role: { type: "string", enum: ["supports", "complicates", "context"] },
            reason: { type: "string" },
          },
        },
      },
      contradictions: { type: "array", items: { type: "string" } },
      missing_context: { type: "array", items: { type: "string" } },
      confidence: { type: "integer" },
    },
  },
  buildUserContent: (ctx) => {
    const target = ctx.targetEvidence;
    return `Read this one piece of evidence for the inquiry. The wider inquiry context follows for orientation only; extract from the target evidence, not from the other items.\n\nTARGET EVIDENCE:\n${JSON.stringify(target, null, 2)}\n\nINQUIRY CONTEXT:\n${contextJson(ctx)}`;
  },
  mapSuggestions: (output, ctx) => {
    const out = output as {
      summary: string;
      key_facts: string[];
      named_entities: Array<{ name: string; entity_kind: string; note: string }>;
      source_quality_notes: string[];
      possible_relationships: Array<{ from_entity: string; to_entity: string; how: string; reason: string }>;
      possible_claims: Array<{ claim: string; evidence_role: string; reason: string }>;
      contradictions: string[];
      missing_context: string[];
      confidence: number;
    };
    const evidenceItemId = ctx.targetEvidence?.id ?? null;
    const base = { kind: "evidence_extraction", evidenceItemId };
    const clamp = (n: number) => Math.max(0, Math.min(100, Math.round(n)));
    const suggestions: SuggestionInsert[] = [];

    suggestions.push({
      suggestion_type: "known",
      title: "What this evidence says",
      body: out.summary,
      reason: null,
      confidence: clamp(out.confidence),
      payload: { ...base, part: "summary", namedEntities: out.named_entities },
    });

    out.key_facts.forEach((fact) => {
      suggestions.push({
        suggestion_type: "known",
        title: "Fact stated by this evidence",
        body: fact,
        reason: null,
        confidence: null,
        payload: { ...base, part: "key_fact" },
      });
    });

    out.possible_relationships.forEach((rel) => {
      suggestions.push({
        suggestion_type: "relationship_lead",
        title: `${rel.from_entity} and ${rel.to_entity}`,
        body: rel.how,
        reason: rel.reason,
        confidence: null,
        payload: { ...base, part: "possible_relationship", fromEntity: rel.from_entity, toEntity: rel.to_entity },
      });
    });

    out.possible_claims.forEach((claim) => {
      suggestions.push({
        suggestion_type: "known",
        title: "Possible claim, not yet judged",
        body: claim.claim,
        reason: claim.reason,
        confidence: null,
        payload: { ...base, part: "possible_claim", evidenceRole: claim.evidence_role },
      });
    });

    out.source_quality_notes.forEach((note) => {
      suggestions.push({
        suggestion_type: "risk_note",
        title: "Source quality",
        body: note,
        reason: null,
        confidence: null,
        payload: { ...base, part: "source_quality" },
      });
    });

    out.contradictions.forEach((item) => {
      suggestions.push({
        suggestion_type: "doubt",
        title: "This evidence contradicts something",
        body: item,
        reason: null,
        confidence: null,
        payload: { ...base, part: "contradiction" },
      });
    });

    out.missing_context.forEach((item) => {
      suggestions.push({
        suggestion_type: "evidence_gap",
        title: "Context this evidence is missing",
        body: item,
        reason: null,
        confidence: null,
        payload: { ...base, part: "missing_context" },
      });
    });

    return suggestions;
  },
};

export const JOB_REGISTRY: Record<string, JobDefinition> = {
  question_clinic: questionClinic,
  next_step_recommender: nextStepRecommender,
  evidence_reader: evidenceReader,
};
