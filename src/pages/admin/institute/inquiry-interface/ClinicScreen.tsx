import { useCallback, useEffect, useMemo, useState } from "react";
import type { InquiryDraft } from "./types";
import {
  type AssistantSuggestion,
  decideSuggestion,
  listAssistantSuggestions,
  runAssistantJob,
} from "@/services/institute/assistantRunService";
import {
  CLINIC_ASSESSMENT_OPTIONS,
  type ClinicAssessmentState,
  type QuestionVersion,
  applyQuestionRefinement,
  listQuestionVersions,
  recordClinicAssessment,
} from "@/services/institute/questionClinicService";

// Question Clinic. The raw question is preserved, refinements are versioned
// with reasons, and the assistant only ever supplies candidates. The human
// makes the working question.

const VERSION_TYPE_LABELS: Record<string, string> = {
  raw: "Raw question",
  working: "Working edit",
  clinic_refinement: "Clinic refinement",
  fork_source: "Fork source",
  review_revision: "Review revision",
};

function assessmentLabel(value: string | null): string | null {
  if (!value) return null;
  return CLINIC_ASSESSMENT_OPTIONS.find((option) => option.value === value)?.label ?? value;
}

export default function ClinicScreen({
  draft,
  onQuestionChanged,
}: {
  draft: InquiryDraft | null;
  onQuestionChanged: () => void | Promise<void>;
}) {
  const [versions, setVersions] = useState<QuestionVersion[]>([]);
  const [suggestions, setSuggestions] = useState<AssistantSuggestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState<string | null>(null);
  const [running, setRunning] = useState(false);
  const [saving, setSaving] = useState(false);

  const [formQuestion, setFormQuestion] = useState("");
  const [formReason, setFormReason] = useState("");
  const [formAssessment, setFormAssessment] = useState<ClinicAssessmentState>("ready");
  const [formSourceSuggestionId, setFormSourceSuggestionId] = useState<string | null>(null);

  const [assessmentOnly, setAssessmentOnly] = useState<ClinicAssessmentState>("raw_but_promising");
  const [assessmentNote, setAssessmentNote] = useState("");

  const refresh = useCallback(async () => {
    if (!draft) return;
    try {
      const [nextVersions, nextSuggestions] = await Promise.all([
        listQuestionVersions(draft.id),
        listAssistantSuggestions(draft.id),
      ]);
      setVersions(nextVersions);
      setSuggestions(nextSuggestions);
      setNotice(null);
    } catch {
      setNotice("The question history could not load. Try again in a moment.");
    } finally {
      setLoading(false);
    }
  }, [draft?.id]);

  useEffect(() => {
    setLoading(true);
    setFormQuestion("");
    setFormReason("");
    setFormSourceSuggestionId(null);
    void refresh();
  }, [refresh]);

  const refinementCandidates = useMemo(
    () =>
      suggestions.filter(
        (s) =>
          s.status === "suggested" &&
          s.suggestionType === "possible_question" &&
          (s.payload as { kind?: string }).kind === "refined_question",
      ),
    [suggestions],
  );

  const currentVersion = versions[0] ?? null;
  const rawVersion = versions.length ? versions[versions.length - 1] : null;

  if (!draft) {
    return (
      <div className="mx-auto max-w-[1040px]">
        <section className="rounded-[22px] border border-wk-border bg-wk-surface p-8 text-center shadow-sm">
          <div className="text-[10px] font-black uppercase tracking-[0.24em] text-wk-brand">Question Clinic</div>
          <h1 className="mt-2 text-[26px] font-black tracking-[-0.04em] text-wk-text">No inquiry selected</h1>
          <p className="mt-2 text-[14px] text-wk-text-muted">Pick an inquiry first. The Clinic works on one question at a time.</p>
        </section>
      </div>
    );
  }

  const startClinicRun = async () => {
    setRunning(true);
    setNotice(null);
    try {
      await runAssistantJob(draft.id, "question_clinic");
      await refresh();
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "The Clinic run did not finish.");
    } finally {
      setRunning(false);
    }
  };

  const useCandidate = (suggestion: AssistantSuggestion) => {
    setFormQuestion(suggestion.body);
    setFormReason(suggestion.reason ?? "");
    const recommended = (suggestion.payload as { recommendedAssessment?: string }).recommendedAssessment;
    if (recommended && CLINIC_ASSESSMENT_OPTIONS.some((o) => o.value === recommended)) {
      setFormAssessment(recommended as ClinicAssessmentState);
    }
    setFormSourceSuggestionId(suggestion.id);
  };

  const rejectCandidate = async (suggestion: AssistantSuggestion) => {
    try {
      await decideSuggestion(suggestion.id, "rejected");
      await refresh();
    } catch {
      setNotice("That decision could not be saved. Try again.");
    }
  };

  const submitRefinement = async () => {
    setSaving(true);
    setNotice(null);
    try {
      await applyQuestionRefinement(
        { id: draft.id, currentQuestion: draft.workingQuestion },
        {
          questionText: formQuestion,
          reason: formReason,
          assessmentState: formAssessment,
          sourceSuggestionId: formSourceSuggestionId,
        },
      );
      setFormQuestion("");
      setFormReason("");
      setFormSourceSuggestionId(null);
      await Promise.all([refresh(), Promise.resolve(onQuestionChanged())]);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "The refinement could not be saved.");
    } finally {
      setSaving(false);
    }
  };

  const submitAssessment = async () => {
    if (!currentVersion) return;
    setSaving(true);
    setNotice(null);
    try {
      await recordClinicAssessment(
        { id: draft.id, currentQuestion: draft.workingQuestion },
        currentVersion.id,
        assessmentOnly,
        assessmentNote,
      );
      setAssessmentNote("");
      await refresh();
    } catch {
      setNotice("The assessment could not be saved. Try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mx-auto max-w-[1180px] space-y-5">
      <section className="rounded-[22px] border border-wk-border bg-wk-surface p-6 shadow-sm lg:p-7">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="text-[10px] font-black uppercase tracking-[0.24em] text-wk-brand">
            Inquiry {draft.code.replace("Inquiry ", "")} · Question Clinic
          </div>
          <button
            type="button"
            disabled={running}
            onClick={() => void startClinicRun()}
            className="rounded-full bg-wk-brand px-5 py-2.5 text-[13px] font-extrabold text-wk-brand-on disabled:opacity-50"
          >
            {running ? "Running the Clinic..." : "Ask the assistant for a refinement"}
          </button>
        </div>

        <h1 className="mt-3 text-[30px] font-black leading-[1.05] tracking-[-0.06em] text-wk-text lg:text-[34px]">
          Sharpen the question before anything else
        </h1>

        <div className="mt-5 grid gap-4 lg:grid-cols-2">
          <div className="rounded-xl border border-wk-border bg-wk-bg p-4">
            <div className="text-[10px] font-black uppercase tracking-[0.18em] text-wk-text-faint">Raw question, preserved</div>
            <p className="mt-2 text-[14px] leading-6 text-wk-text-muted">{rawVersion?.questionText ?? draft.rawQuestion}</p>
          </div>
          <div className="rounded-xl border border-wk-brand/25 bg-wk-brand-soft p-4">
            <div className="text-[10px] font-black uppercase tracking-[0.18em] text-wk-brand">Working question now</div>
            <p className="mt-2 text-[15px] font-bold leading-6 text-wk-text">{draft.workingQuestion}</p>
            {currentVersion?.assessmentState && (
              <p className="mt-2 text-[12px] font-bold text-wk-text-muted">
                Assessed: {assessmentLabel(currentVersion.assessmentState)}
              </p>
            )}
          </div>
        </div>

        {notice && (
          <div className="mt-4 rounded-xl border border-wk-border bg-wk-bg px-4 py-3 text-[13px] text-wk-text">{notice}</div>
        )}
      </section>

      {refinementCandidates.length > 0 && (
        <section className="rounded-[22px] border border-wk-border bg-wk-surface p-6 shadow-sm lg:p-7">
          <h2 className="text-[20px] font-black tracking-[-0.04em] text-wk-text">Refinements to consider</h2>
          <p className="mt-1 text-[13px] text-wk-text-muted">
            The assistant suggested these. Nothing changes until you make one the working question.
          </p>
          <div className="mt-4 space-y-3">
            {refinementCandidates.map((candidate) => (
              <article key={candidate.id} className="rounded-xl border border-wk-border bg-wk-bg p-4">
                <p className="text-[14px] font-bold leading-6 text-wk-text">{candidate.body}</p>
                {candidate.reason && (
                  <p className="mt-2 text-[12px] leading-5 text-wk-text-muted">
                    <span className="font-bold">Why this is suggested:</span> {candidate.reason}
                  </p>
                )}
                <div className="mt-3 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => useCandidate(candidate)}
                    className="rounded-full bg-wk-brand px-4 py-2 text-[12px] font-extrabold text-wk-brand-on"
                  >
                    Use this as a starting point
                  </button>
                  <button
                    type="button"
                    onClick={() => void rejectCandidate(candidate)}
                    className="rounded-full border border-wk-border px-4 py-2 text-[12px] font-bold text-wk-text-muted"
                  >
                    Reject
                  </button>
                </div>
              </article>
            ))}
          </div>
        </section>
      )}

      <section className="rounded-[22px] border border-wk-border bg-wk-surface p-6 shadow-sm lg:p-7">
        <h2 className="text-[20px] font-black tracking-[-0.04em] text-wk-text">Refine the working question</h2>
        <p className="mt-1 text-[13px] text-wk-text-muted">
          The old question stays in the history. Every refinement needs a reason.
        </p>

        <div className="mt-4 space-y-3">
          <div>
            <label className="text-[11px] font-black uppercase tracking-[0.14em] text-wk-text-faint" htmlFor="clinic-question">
              New working question
            </label>
            <textarea
              id="clinic-question"
              value={formQuestion}
              onChange={(event) => setFormQuestion(event.target.value)}
              rows={3}
              placeholder="Write the sharper question here."
              className="mt-1 w-full rounded-lg border border-wk-border bg-wk-bg p-3 text-[14px] leading-6 text-wk-text"
            />
          </div>
          <div>
            <label className="text-[11px] font-black uppercase tracking-[0.14em] text-wk-text-faint" htmlFor="clinic-reason">
              Why it changed
            </label>
            <input
              id="clinic-reason"
              value={formReason}
              onChange={(event) => setFormReason(event.target.value)}
              placeholder="One honest sentence. Lineage needs it."
              className="mt-1 w-full rounded-lg border border-wk-border bg-wk-bg p-3 text-[13px] text-wk-text"
            />
          </div>
          <div>
            <label className="text-[11px] font-black uppercase tracking-[0.14em] text-wk-text-faint" htmlFor="clinic-assessment">
              Where the question stands now
            </label>
            <select
              id="clinic-assessment"
              value={formAssessment}
              onChange={(event) => setFormAssessment(event.target.value as ClinicAssessmentState)}
              className="mt-1 w-full rounded-lg border border-wk-border bg-wk-bg p-3 text-[13px] text-wk-text"
            >
              {CLINIC_ASSESSMENT_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <p className="mt-1 text-[12px] text-wk-text-faint">
              {CLINIC_ASSESSMENT_OPTIONS.find((option) => option.value === formAssessment)?.hint}
            </p>
          </div>
          {formSourceSuggestionId && (
            <p className="text-[12px] text-wk-text-muted">
              This refinement started from an assistant suggestion. Applying it will mark that suggestion accepted.
            </p>
          )}
          <button
            type="button"
            disabled={saving || formQuestion.trim().length < 8 || formReason.trim().length < 4}
            onClick={() => void submitRefinement()}
            className="rounded-full bg-wk-brand px-5 py-2.5 text-[13px] font-extrabold text-wk-brand-on disabled:opacity-50"
          >
            {saving ? "Saving..." : "Make this the working question"}
          </button>
        </div>
      </section>

      <section className="rounded-[22px] border border-wk-border bg-wk-surface p-6 shadow-sm lg:p-7">
        <h2 className="text-[20px] font-black tracking-[-0.04em] text-wk-text">Assess without changing the words</h2>
        <p className="mt-1 text-[13px] text-wk-text-muted">
          Sometimes the question is fine, or the problem is not the wording. Record where it stands.
        </p>
        <div className="mt-4 grid gap-3 md:grid-cols-[240px_1fr_auto]">
          <select
            aria-label="Assessment"
            value={assessmentOnly}
            onChange={(event) => setAssessmentOnly(event.target.value as ClinicAssessmentState)}
            className="rounded-lg border border-wk-border bg-wk-bg p-3 text-[13px] text-wk-text"
          >
            {CLINIC_ASSESSMENT_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          <input
            aria-label="Assessment note"
            value={assessmentNote}
            onChange={(event) => setAssessmentNote(event.target.value)}
            placeholder="A short note on why."
            className="rounded-lg border border-wk-border bg-wk-bg p-3 text-[13px] text-wk-text"
          />
          <button
            type="button"
            disabled={saving || !currentVersion}
            onClick={() => void submitAssessment()}
            className="rounded-full border border-wk-border bg-wk-bg px-5 py-2.5 text-[13px] font-extrabold text-wk-text disabled:opacity-50"
          >
            Record assessment
          </button>
        </div>
      </section>

      <section className="rounded-[22px] border border-wk-border bg-wk-surface p-6 shadow-sm lg:p-7">
        <h2 className="text-[20px] font-black tracking-[-0.04em] text-wk-text">How this question has moved</h2>
        {loading ? (
          <p className="mt-3 text-[13px] text-wk-text-muted">Loading the question history...</p>
        ) : versions.length === 0 ? (
          <p className="mt-3 text-[13px] text-wk-text-muted">No versions recorded yet.</p>
        ) : (
          <ol className="mt-4 space-y-3">
            {versions.map((version) => (
              <li key={version.id} className="rounded-xl border border-wk-border bg-wk-bg p-4">
                <div className="flex flex-wrap items-center gap-2 text-[10px] font-black uppercase tracking-[0.16em] text-wk-text-faint">
                  <span className="text-wk-brand">v{version.versionNumber}</span>
                  <span>{VERSION_TYPE_LABELS[version.versionType] ?? version.versionType}</span>
                  {version.assessmentState && <span>{assessmentLabel(version.assessmentState)}</span>}
                  <span>{new Date(version.createdAt).toLocaleString()}</span>
                </div>
                <p className="mt-2 text-[14px] leading-6 text-wk-text">{version.questionText}</p>
                {version.reason && (
                  <p className="mt-1 text-[12px] text-wk-text-muted">
                    <span className="font-bold">Why:</span> {version.reason}
                  </p>
                )}
              </li>
            ))}
          </ol>
        )}
      </section>
    </div>
  );
}
