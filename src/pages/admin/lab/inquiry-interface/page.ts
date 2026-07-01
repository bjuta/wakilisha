import { createElement, useMemo, useReducer, useState } from "react";
import type { ChangeEvent, ReactNode } from "react";
import { useAdminUser } from "@/hooks/useAdminUser";
import { roleCanAccessAdmin } from "@/services/userRoles";
import { seedInquiry } from "./seed";
import type {
  ConsentLevel,
  EvidenceFormat,
  EvidenceItem,
  InquiryCorrection,
  InquiryLabState,
  ReviewDecision,
} from "./types";

type TabId = "question" | "evidence" | "claims" | "relationships" | "memory" | "corrections" | "review";

type LabAction =
  | { type: "set_question"; question: string; reason: string }
  | { type: "add_evidence"; evidence: EvidenceItem }
  | { type: "add_memory"; format: EvidenceFormat; about: string; memory: string; howTheyKnow: string; consent: ConsentLevel }
  | { type: "add_correction"; correction: string; whyItMatters: string; proposedBy: string }
  | { type: "set_understanding"; safeToSay: string; cannotSayYet: string; openDoubt: string; confidence: number }
  | { type: "record_review"; decision: ReviewDecision; reason: string };

type DraftEvidence = {
  title: string;
  format: EvidenceFormat;
  summary: string;
  source: string;
  investmentTime: EvidenceItem["investmentTime"];
  strengthensUnderstanding: boolean;
  publicSafe: boolean;
};

const tabs: Array<{ id: TabId; label: string }> = [
  { id: "question", label: "Question" },
  { id: "evidence", label: "Evidence" },
  { id: "claims", label: "Claims" },
  { id: "relationships", label: "Relationships" },
  { id: "memory", label: "Memory" },
  { id: "corrections", label: "Corrections" },
  { id: "review", label: "Review" },
];

const evidenceFormats: EvidenceFormat[] = ["Text", "Audio", "Video", "Photo", "Source Link", "Chart Data", "Interview"];
const consentLevels: ConsentLevel[] = ["Public", "Internal", "Review Only"];
const reviewDecisions: ReviewDecision[] = ["Needs More Work", "Approved for Internal Use", "Public Safe", "Paused as Doubt"];
const investmentTimes: EvidenceItem["investmentTime"][] = ["Five minutes", "Fifteen minutes", "An hour"];

const fieldClass =
  "w-full rounded-xl border border-wk-border bg-wk-bg px-4 py-3 text-sm text-wk-text outline-none focus:border-wk-brand";

function nextId(prefix: string, count: number): string {
  return `${prefix}-${count + 1}`;
}

function labReducer(state: InquiryLabState, action: LabAction): InquiryLabState {
  if (action.type === "set_question") {
    return {
      ...state,
      question: action.question,
      questionVersions: [
        ...state.questionVersions,
        {
          id: nextId("qv", state.questionVersions.length),
          label: `Version ${state.questionVersions.length + 1}`,
          question: action.question,
          reason: action.reason,
        },
      ],
      events: [...state.events, { id: nextId("event", state.events.length), text: "Question refined with a reason." }],
    };
  }

  if (action.type === "add_evidence") {
    return {
      ...state,
      lifecycleState: "Gathering Evidence",
      evidence: [...state.evidence, action.evidence],
      events: [...state.events, { id: nextId("event", state.events.length), text: "Evidence added for review." }],
    };
  }

  if (action.type === "add_memory") {
    return {
      ...state,
      memories: [
        ...state.memories,
        {
          id: nextId("mem", state.memories.length),
          format: action.format,
          about: action.about,
          memory: action.memory,
          howTheyKnow: action.howTheyKnow,
          consent: action.consent,
        },
      ],
      events: [...state.events, { id: nextId("event", state.events.length), text: "Contributor memory added." }],
    };
  }

  if (action.type === "add_correction") {
    return {
      ...state,
      corrections: [
        ...state.corrections,
        {
          id: nextId("cor", state.corrections.length),
          correction: action.correction,
          whyItMatters: action.whyItMatters,
          proposedBy: action.proposedBy,
          status: "Open",
        },
      ],
      events: [...state.events, { id: nextId("event", state.events.length), text: "Correction added." }],
    };
  }

  if (action.type === "set_understanding") {
    return {
      ...state,
      lifecycleState: "Current Understanding Drafted",
      currentUnderstanding: {
        safeToSay: action.safeToSay,
        cannotSayYet: action.cannotSayYet,
        openDoubt: action.openDoubt,
        confidence: action.confidence,
      },
      events: [...state.events, { id: nextId("event", state.events.length), text: "Current Understanding updated." }],
    };
  }

  if (action.type === "record_review") {
    return {
      ...state,
      lifecycleState: action.decision === "Public Safe" ? "Ready to Share" : "Needs Review",
      reviews: [...state.reviews, { id: nextId("review", state.reviews.length), decision: action.decision, reason: action.reason }],
      events: [...state.events, { id: nextId("event", state.events.length), text: "Human review recorded." }],
    };
  }

  return state;
}

function badge(label: string, tone = "default"): ReactNode {
  const toneClass =
    tone === "brand"
      ? "border-wk-brand/30 bg-wk-brand-soft text-wk-brand"
      : tone === "warning"
        ? "border-wk-warning/30 bg-wk-warning/10 text-wk-warning"
        : "border-wk-border bg-wk-bg text-wk-text-muted";

  return createElement(
    "span",
    { className: `inline-flex rounded-full border px-3 py-1 text-[11px] font-bold ${toneClass}` },
    label,
  );
}

function panel(title: string, body: ReactNode, eyebrow?: string): ReactNode {
  return createElement(
    "section",
    { className: "rounded-2xl border border-wk-border bg-wk-surface p-5" },
    eyebrow ? createElement("div", { className: "mb-2 text-[10px] font-black uppercase tracking-wider text-wk-text-faint" }, eyebrow) : null,
    createElement("h2", { className: "text-[16px] font-black text-wk-text" }, title),
    createElement("div", { className: "mt-3 text-[13px] leading-6 text-wk-text-muted" }, body),
  );
}

function emptyLine(text: string): ReactNode {
  return createElement("p", { className: "rounded-xl border border-dashed border-wk-border p-4 text-[13px] text-wk-text-muted" }, text);
}

function textArea(
  value: string,
  onChange: (value: string) => void,
  placeholder: string,
  rows = 4,
): ReactNode {
  return createElement("textarea", {
    value,
    rows,
    placeholder,
    onChange: (event: ChangeEvent<HTMLTextAreaElement>) => onChange(event.target.value),
    className: `${fieldClass} min-h-28 resize-y`,
  });
}

function input(
  value: string,
  onChange: (value: string) => void,
  placeholder: string,
): ReactNode {
  return createElement("input", {
    value,
    placeholder,
    onChange: (event: ChangeEvent<HTMLInputElement>) => onChange(event.target.value),
    className: fieldClass,
  });
}

function selectField<T extends string>(
  value: T,
  options: T[],
  onChange: (value: T) => void,
): ReactNode {
  return createElement(
    "select",
    {
      value,
      onChange: (event: ChangeEvent<HTMLSelectElement>) => onChange(event.target.value as T),
      className: fieldClass,
    },
    options.map((option) => createElement("option", { key: option, value: option }, option)),
  );
}

function primaryButton(label: string, onClick: () => void, disabled = false): ReactNode {
  return createElement(
    "button",
    {
      type: "button",
      disabled,
      onClick,
      className:
        "rounded-full bg-wk-brand px-5 py-3 text-[13px] font-black text-wk-brand-on transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40",
    },
    label,
  );
}

function smallToggle(label: string, active: boolean, onClick: () => void): ReactNode {
  return createElement(
    "button",
    {
      type: "button",
      onClick,
      className: `rounded-full border px-4 py-2 text-[12px] font-bold transition ${
        active
          ? "border-wk-brand bg-wk-brand-soft text-wk-brand"
          : "border-wk-border bg-wk-bg text-wk-text-muted hover:border-wk-brand/40"
      }`,
    },
    label,
  );
}

export default function AdminInquiryInterfacePage() {
  const user = useAdminUser();
  const [state, dispatch] = useReducer(labReducer, seedInquiry);
  const [activeTab, setActiveTab] = useState<TabId>("question");
  const [questionDraft, setQuestionDraft] = useState(seedInquiry.question);
  const [questionReason, setQuestionReason] = useState("");
  const [evidenceDraft, setEvidenceDraft] = useState<DraftEvidence>({
    title: "",
    format: "Text",
    summary: "",
    source: "",
    investmentTime: "Fifteen minutes",
    strengthensUnderstanding: true,
    publicSafe: false,
  });
  const [memoryDraft, setMemoryDraft] = useState({
    format: "Text" as EvidenceFormat,
    about: "",
    memory: "",
    howTheyKnow: "",
    consent: "Internal" as ConsentLevel,
  });
  const [correctionDraft, setCorrectionDraft] = useState({ correction: "", whyItMatters: "", proposedBy: "" });
  const [understandingDraft, setUnderstandingDraft] = useState(state.currentUnderstanding);
  const [reviewDraft, setReviewDraft] = useState({ decision: "Needs More Work" as ReviewDecision, reason: "" });

  const methodQuestions = useMemo(
    () => [
      "What are we trying to understand?",
      "What do we currently understand?",
      "What evidence supports or weakens that understanding?",
      "What is still uncertain?",
      "What is the next honest move?",
    ],
    [],
  );

  if (user.loading || !user.id || !roleCanAccessAdmin(user.role)) {
    return createElement("div", { className: "p-6 text-wk-text" }, "Admin access needed");
  }

  const canSaveQuestion = questionDraft.trim().length > 10 && questionReason.trim().length > 10;
  const canAddEvidence = evidenceDraft.title.trim().length > 0 && evidenceDraft.summary.trim().length > 10;
  const canAddMemory = memoryDraft.about.trim().length > 0 && memoryDraft.memory.trim().length > 10;
  const canAddCorrection = correctionDraft.correction.trim().length > 10 && correctionDraft.whyItMatters.trim().length > 10;
  const canRecordReview = reviewDraft.reason.trim().length > 10;

  const tabBody: Record<TabId, ReactNode> = {
    question: createElement(
      "div",
      { className: "grid gap-4 lg:grid-cols-[1.2fr_0.8fr]" },
      panel(
        "Question Clinic",
        createElement(
          "div",
          { className: "space-y-4" },
          textArea(questionDraft, setQuestionDraft, "What are we trying to understand?", 5),
          textArea(questionReason, setQuestionReason, "Why is this a better question?", 3),
          primaryButton("Save Question Version", () => {
            dispatch({ type: "set_question", question: questionDraft.trim(), reason: questionReason.trim() });
            setQuestionReason("");
          }, !canSaveQuestion),
        ),
        "Start Here",
      ),
      panel(
        "Question History",
        state.questionVersions.length === 0
          ? emptyLine("No question versions yet.")
          : createElement(
              "div",
              { className: "space-y-3" },
              state.questionVersions.map((version) =>
                createElement(
                  "div",
                  { key: version.id, className: "rounded-xl border border-wk-border bg-wk-bg p-4" },
                  createElement("div", { className: "text-[12px] font-black text-wk-text" }, version.label),
                  createElement("p", { className: "mt-1 text-[13px] text-wk-text-muted" }, version.question),
                  createElement("p", { className: "mt-2 text-[12px] text-wk-text-faint" }, version.reason),
                ),
              ),
            ),
      ),
    ),
    evidence: createElement(
      "div",
      { className: "grid gap-4 lg:grid-cols-[0.95fr_1.05fr]" },
      panel(
        "Add Evidence",
        createElement(
          "div",
          { className: "space-y-4" },
          input(evidenceDraft.title, (value) => setEvidenceDraft((prev) => ({ ...prev, title: value })), "Evidence title"),
          selectField(evidenceDraft.format, evidenceFormats, (value) => setEvidenceDraft((prev) => ({ ...prev, format: value }))),
          textArea(evidenceDraft.summary, (value) => setEvidenceDraft((prev) => ({ ...prev, summary: value })), "What does this evidence show?", 4),
          input(evidenceDraft.source, (value) => setEvidenceDraft((prev) => ({ ...prev, source: value })), "Where did this come from?"),
          selectField(evidenceDraft.investmentTime, investmentTimes, (value) => setEvidenceDraft((prev) => ({ ...prev, investmentTime: value }))),
          createElement(
            "div",
            { className: "flex flex-wrap gap-2" },
            smallToggle("Strengthens understanding", evidenceDraft.strengthensUnderstanding, () =>
              setEvidenceDraft((prev) => ({ ...prev, strengthensUnderstanding: !prev.strengthensUnderstanding })),
            ),
            smallToggle("Public safe", evidenceDraft.publicSafe, () =>
              setEvidenceDraft((prev) => ({ ...prev, publicSafe: !prev.publicSafe })),
            ),
          ),
          primaryButton("Add Evidence", () => {
            dispatch({
              type: "add_evidence",
              evidence: {
                id: nextId("ev", state.evidence.length),
                title: evidenceDraft.title.trim(),
                format: evidenceDraft.format,
                summary: evidenceDraft.summary.trim(),
                source: evidenceDraft.source.trim() || "Not specified yet",
                investmentTime: evidenceDraft.investmentTime,
                strengthensUnderstanding: evidenceDraft.strengthensUnderstanding,
                publicSafe: evidenceDraft.publicSafe,
              },
            });
            setEvidenceDraft({
              title: "",
              format: "Text",
              summary: "",
              source: "",
              investmentTime: "Fifteen minutes",
              strengthensUnderstanding: true,
              publicSafe: false,
            });
          }, !canAddEvidence),
        ),
      ),
      panel(
        "Evidence Reading Route",
        createElement(
          "div",
          { className: "space-y-3" },
          state.evidence.map((item) =>
            createElement(
              "article",
              { key: item.id, className: "rounded-xl border border-wk-border bg-wk-bg p-4" },
              createElement("div", { className: "flex flex-wrap items-center gap-2" }, badge(item.format, "brand"), badge(item.investmentTime)),
              createElement("h3", { className: "mt-3 text-[14px] font-black text-wk-text" }, item.title),
              createElement("p", { className: "mt-2 text-[13px] text-wk-text-muted" }, item.summary),
              createElement("p", { className: "mt-2 text-[12px] text-wk-text-faint" }, item.source),
            ),
          ),
        ),
      ),
    ),
    claims: panel(
      "Claims We Can Test",
      createElement(
        "div",
        { className: "space-y-3" },
        state.claims.map((claim) =>
          createElement(
            "article",
            { key: claim.id, className: "rounded-xl border border-wk-border bg-wk-bg p-4" },
            createElement("p", { className: "text-[14px] font-bold text-wk-text" }, claim.text),
            createElement("p", { className: "mt-2 text-[12px] text-wk-text-muted" }, `Confidence: ${claim.confidence}%`),
            createElement("p", { className: "mt-2 text-[12px] text-wk-text-faint" }, claim.uncertainty),
          ),
        ),
      ),
    ),
    relationships: panel(
      "Relationship Reasoner",
      createElement(
        "div",
        { className: "space-y-3" },
        state.relationships.map((relationship) =>
          createElement(
            "article",
            { key: relationship.id, className: "rounded-xl border border-wk-border bg-wk-bg p-4" },
            createElement("p", { className: "text-[14px] font-black text-wk-text" }, `${relationship.from} connects to ${relationship.to}`),
            createElement("p", { className: "mt-2 text-[13px] text-wk-text-muted" }, relationship.reason),
            createElement("p", { className: "mt-2 text-[12px] text-wk-text-faint" }, `Confidence: ${relationship.confidence}%`),
          ),
        ),
      ),
    ),
    memory: createElement(
      "div",
      { className: "grid gap-4 lg:grid-cols-[0.95fr_1.05fr]" },
      panel(
        "Add Memory Or Correction",
        createElement(
          "div",
          { className: "space-y-4" },
          selectField(memoryDraft.format, evidenceFormats, (value) => setMemoryDraft((prev) => ({ ...prev, format: value }))),
          input(memoryDraft.about, (value) => setMemoryDraft((prev) => ({ ...prev, about: value })), "Who or what is this about?"),
          textArea(memoryDraft.memory, (value) => setMemoryDraft((prev) => ({ ...prev, memory: value })), "What do you know?", 4),
          textArea(memoryDraft.howTheyKnow, (value) => setMemoryDraft((prev) => ({ ...prev, howTheyKnow: value })), "How do you know?", 3),
          createElement("div", { className: "text-[12px] font-black uppercase tracking-wider text-wk-text-muted" }, "How can WAKILISHA use this?"),
          createElement(
            "div",
            { className: "flex flex-wrap gap-2" },
            consentLevels.map((level) =>
              smallToggle(level, memoryDraft.consent === level, () => setMemoryDraft((prev) => ({ ...prev, consent: level }))),
            ),
          ),
          primaryButton("Add Memory", () => {
            dispatch({
              type: "add_memory",
              format: memoryDraft.format,
              about: memoryDraft.about.trim(),
              memory: memoryDraft.memory.trim(),
              howTheyKnow: memoryDraft.howTheyKnow.trim() || "Not explained yet",
              consent: memoryDraft.consent,
            });
            setMemoryDraft({ format: "Text", about: "", memory: "", howTheyKnow: "", consent: "Internal" });
          }, !canAddMemory),
        ),
      ),
      panel(
        "Contributor Memories",
        createElement(
          "div",
          { className: "space-y-3" },
          state.memories.map((memory) =>
            createElement(
              "article",
              { key: memory.id, className: "rounded-xl border border-wk-border bg-wk-bg p-4" },
              createElement("div", { className: "flex flex-wrap gap-2" }, badge(memory.format, "brand"), badge(memory.consent)),
              createElement("h3", { className: "mt-3 text-[14px] font-black text-wk-text" }, memory.about),
              createElement("p", { className: "mt-2 text-[13px] text-wk-text-muted" }, memory.memory),
              createElement("p", { className: "mt-2 text-[12px] text-wk-text-faint" }, memory.howTheyKnow),
            ),
          ),
        ),
      ),
    ),
    corrections: createElement(
      "div",
      { className: "grid gap-4 lg:grid-cols-[0.95fr_1.05fr]" },
      panel(
        "Add Correction",
        createElement(
          "div",
          { className: "space-y-4" },
          textArea(correctionDraft.correction, (value) => setCorrectionDraft((prev) => ({ ...prev, correction: value })), "What needs to be corrected?", 4),
          textArea(correctionDraft.whyItMatters, (value) => setCorrectionDraft((prev) => ({ ...prev, whyItMatters: value })), "Why does it matter?", 3),
          input(correctionDraft.proposedBy, (value) => setCorrectionDraft((prev) => ({ ...prev, proposedBy: value })), "Who proposed this?"),
          primaryButton("Add Correction", () => {
            dispatch({
              type: "add_correction",
              correction: correctionDraft.correction.trim(),
              whyItMatters: correctionDraft.whyItMatters.trim(),
              proposedBy: correctionDraft.proposedBy.trim() || "Lab user",
            });
            setCorrectionDraft({ correction: "", whyItMatters: "", proposedBy: "" });
          }, !canAddCorrection),
        ),
      ),
      panel(
        "Open Corrections",
        createElement(
          "div",
          { className: "space-y-3" },
          state.corrections.map((correction: InquiryCorrection) =>
            createElement(
              "article",
              { key: correction.id, className: "rounded-xl border border-wk-border bg-wk-bg p-4" },
              createElement("div", { className: "mb-2" }, badge(correction.status, "warning")),
              createElement("p", { className: "text-[14px] font-bold text-wk-text" }, correction.correction),
              createElement("p", { className: "mt-2 text-[13px] text-wk-text-muted" }, correction.whyItMatters),
              createElement("p", { className: "mt-2 text-[12px] text-wk-text-faint" }, correction.proposedBy),
            ),
          ),
        ),
      ),
    ),
    review: createElement(
      "div",
      { className: "grid gap-4 lg:grid-cols-[0.95fr_1.05fr]" },
      panel(
        "Human Review",
        createElement(
          "div",
          { className: "space-y-4" },
          selectField(reviewDraft.decision, reviewDecisions, (value) => setReviewDraft((prev) => ({ ...prev, decision: value }))),
          textArea(reviewDraft.reason, (value) => setReviewDraft((prev) => ({ ...prev, reason: value })), "Why is this the right decision?", 4),
          primaryButton("Record Review", () => {
            dispatch({ type: "record_review", decision: reviewDraft.decision, reason: reviewDraft.reason.trim() });
            setReviewDraft({ decision: "Needs More Work", reason: "" });
          }, !canRecordReview),
        ),
      ),
      panel(
        "Review History",
        createElement(
          "div",
          { className: "space-y-3" },
          state.reviews.map((review) =>
            createElement(
              "article",
              { key: review.id, className: "rounded-xl border border-wk-border bg-wk-bg p-4" },
              createElement("div", null, badge(review.decision, review.decision === "Public Safe" ? "brand" : "warning")),
              createElement("p", { className: "mt-2 text-[13px] text-wk-text-muted" }, review.reason),
            ),
          ),
        ),
      ),
    ),
  };

  return createElement(
    "div",
    { className: "space-y-6" },
    createElement(
      "section",
      { className: "rounded-3xl border border-wk-border bg-wk-surface p-6 lg:p-8" },
      createElement("div", { className: "flex flex-wrap gap-2" }, badge("Protected Lab", "brand"), badge("Local Data Only"), badge("No SQL"), badge("No AI Execution")),
      createElement("h1", { className: "mt-5 text-[30px] font-black tracking-tight text-wk-text" }, `${state.inquiryId}: ${state.title}`),
      createElement("p", { className: "mt-3 max-w-3xl text-[14px] leading-7 text-wk-text-muted" }, "This surface tests whether the Institute helps people move from question to evidence, memory, relationships, review, and Current Understanding."),
      createElement(
        "div",
        { className: "mt-6 grid gap-3 md:grid-cols-4" },
        panel("Maturity", state.maturityState),
        panel("Lifecycle", state.lifecycleState),
        panel("Linked Context", `${state.linkedEntity.type}: ${state.linkedEntity.name}`),
        panel("Confidence", `${state.currentUnderstanding.confidence}%`),
      ),
    ),
    createElement(
      "section",
      { className: "rounded-2xl border border-wk-border bg-wk-surface p-5" },
      createElement("h2", { className: "text-[16px] font-black text-wk-text" }, "The Five Questions"),
      createElement(
        "div",
        { className: "mt-4 grid gap-3 lg:grid-cols-5" },
        methodQuestions.map((question, index) =>
          createElement(
            "div",
            { key: question, className: "rounded-xl border border-wk-border bg-wk-bg p-4" },
            createElement("div", { className: "text-[11px] font-black text-wk-brand" }, `0${index + 1}`),
            createElement("p", { className: "mt-2 text-[13px] font-bold text-wk-text" }, question),
          ),
        ),
      ),
    ),
    createElement(
      "section",
      { className: "rounded-2xl border border-wk-border bg-wk-surface p-3" },
      createElement(
        "div",
        { className: "flex flex-wrap gap-2" },
        tabs.map((tab) =>
          createElement(
            "button",
            {
              key: tab.id,
              type: "button",
              onClick: () => setActiveTab(tab.id),
              className: `rounded-full px-4 py-2 text-[12px] font-black transition ${
                activeTab === tab.id ? "bg-wk-brand text-wk-brand-on" : "text-wk-text-muted hover:bg-wk-bg hover:text-wk-text"
              }`,
            },
            tab.label,
          ),
        ),
      ),
    ),
    tabBody[activeTab],
    createElement(
      "section",
      { className: "rounded-2xl border border-wk-border bg-wk-surface p-5" },
      createElement("h2", { className: "text-[16px] font-black text-wk-text" }, "Current Understanding"),
      createElement(
        "div",
        { className: "mt-4 grid gap-4 lg:grid-cols-3" },
        createElement("div", null, createElement("div", { className: "mb-2 text-[12px] font-black text-wk-text-muted" }, "What We Can Safely Say"), textArea(understandingDraft.safeToSay, (value) => setUnderstandingDraft((prev) => ({ ...prev, safeToSay: value })), "What can we safely say?", 4)),
        createElement("div", null, createElement("div", { className: "mb-2 text-[12px] font-black text-wk-text-muted" }, "What We Cannot Say Yet"), textArea(understandingDraft.cannotSayYet, (value) => setUnderstandingDraft((prev) => ({ ...prev, cannotSayYet: value })), "What is still not safe to say?", 4)),
        createElement("div", null, createElement("div", { className: "mb-2 text-[12px] font-black text-wk-text-muted" }, "Open Doubt"), textArea(understandingDraft.openDoubt, (value) => setUnderstandingDraft((prev) => ({ ...prev, openDoubt: value })), "What doubt remains?", 4)),
      ),
      createElement(
        "div",
        { className: "mt-4 flex flex-wrap items-center gap-3" },
        createElement("input", {
          type: "range",
          min: 0,
          max: 100,
          value: understandingDraft.confidence,
          onChange: (event: ChangeEvent<HTMLInputElement>) => setUnderstandingDraft((prev) => ({ ...prev, confidence: Number(event.target.value) })),
          className: "w-64",
        }),
        badge(`Confidence: ${understandingDraft.confidence}%`, "brand"),
        primaryButton("Update Current Understanding", () => dispatch({ type: "set_understanding", ...understandingDraft })),
      ),
    ),
    panel(
      "Trace",
      createElement(
        "div",
        { className: "space-y-2" },
        state.events.map((event) => createElement("p", { key: event.id, className: "rounded-xl bg-wk-bg px-4 py-3 text-[13px] text-wk-text-muted" }, event.text)),
      ),
    ),
  );
}
