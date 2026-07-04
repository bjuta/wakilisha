import { useCallback, useEffect, useMemo, useState } from "react";
import {
  type AssistantJobType,
  type AssistantRun,
  type AssistantSuggestion,
  decideSuggestion,
  listAssistantRuns,
  listAssistantSuggestions,
  runAssistantJob,
} from "@/services/institute/assistantRunService";

// Inquiry Assistant review bridge. The assistant suggests, humans decide.
// Every card shows why it was suggested; every decision is recorded on the
// suggestion row. Nothing here changes the inquiry record itself.

const SUGGESTION_LABELS: Record<string, string> = {
  possible_question: "Question",
  evidence_gap: "Evidence to find",
  risk_note: "Worth watching",
  doubt: "Held as doubt",
  next_move: "Next honest move",
  relationship_lead: "Relationship lead",
  known: "What we know",
  unknown: "What we do not know",
  workbench_setup: "Workbench setup",
  public_path: "Public path",
};

const JOB_LABELS: Record<string, string> = {
  question_clinic: "Question Clinic",
  question_clinic_help: "Question Clinic",
  next_step_recommender: "Next move",
  next_inquiry_suggestions: "Next inquiry ideas",
  anchor_context_lift: "Anchor context",
  workbench_setup_suggestions: "Workbench setup",
  evidence_search_plan: "Evidence search plan",
  relationship_suggestions: "Relationship leads",
  risk_and_doubt_check: "Risk and doubt check",
};

function supportLabel(confidence: number | null): string | null {
  if (confidence === null) return null;
  if (confidence >= 70) return "Well supported by the material";
  if (confidence >= 40) return "Partly supported by the material";
  return "Thin support so far";
}

function runStatusLabel(run: AssistantRun): string {
  if (run.status === "succeeded") return "Finished";
  if (run.status === "failed") return "Did not finish";
  if (run.status === "running") return "Working";
  return run.status;
}

export default function InquiryAssistantPanel({
  inquiryId,
  workingQuestion,
}: {
  inquiryId: string;
  workingQuestion: string;
}) {
  const [suggestions, setSuggestions] = useState<AssistantSuggestion[]>([]);
  const [runs, setRuns] = useState<AssistantRun[]>([]);
  const [loading, setLoading] = useState(true);
  const [runningJob, setRunningJob] = useState<AssistantJobType | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [showLog, setShowLog] = useState(false);
  const [showDecided, setShowDecided] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editBody, setEditBody] = useState("");
  const [decidingId, setDecidingId] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const [nextSuggestions, nextRuns] = await Promise.all([
        listAssistantSuggestions(inquiryId),
        listAssistantRuns(inquiryId),
      ]);
      setSuggestions(nextSuggestions);
      setRuns(nextRuns);
    } catch {
      setNotice("The assistant history could not load. Try again in a moment.");
    } finally {
      setLoading(false);
    }
  }, [inquiryId]);

  useEffect(() => {
    setLoading(true);
    setNotice(null);
    void refresh();
  }, [refresh]);

  const pending = useMemo(() => suggestions.filter((s) => s.status === "suggested"), [suggestions]);
  const decided = useMemo(() => suggestions.filter((s) => s.status !== "suggested"), [suggestions]);

  const startJob = async (jobType: AssistantJobType) => {
    setRunningJob(jobType);
    setNotice(null);
    try {
      await runAssistantJob(inquiryId, jobType);
      await refresh();
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "The assistant could not finish this run.");
      await refresh();
    } finally {
      setRunningJob(null);
    }
  };

  const decide = async (
    suggestion: AssistantSuggestion,
    decision: "accepted" | "edited_and_accepted" | "rejected" | "saved_as_doubt",
  ) => {
    setDecidingId(suggestion.id);
    setNotice(null);
    try {
      await decideSuggestion(suggestion.id, decision, decision === "edited_and_accepted" ? editBody : undefined);
      setEditingId(null);
      setEditBody("");
      await refresh();
    } catch {
      setNotice("That decision could not be saved. Try again.");
    } finally {
      setDecidingId(null);
    }
  };

  return (
    <section className="rounded-[22px] border border-wk-border bg-wk-surface p-6 shadow-sm lg:p-7">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="text-[10px] font-black uppercase tracking-[0.24em] text-wk-brand">
            Inquiry Assistant · Help, never approval
          </div>
          <h2 className="mt-2 text-[24px] font-black leading-tight tracking-[-0.04em] text-wk-text">
            Suggestions to review
          </h2>
          <p className="mt-1 max-w-[62ch] text-[13px] leading-5 text-wk-text-muted">
            Working question: <span className="font-bold text-wk-text">{workingQuestion}</span>
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowLog((v) => !v)}
          className="rounded-full border border-wk-border bg-wk-bg px-4 py-2 text-[12px] font-bold text-wk-text-muted hover:text-wk-text"
        >
          {showLog ? "Hide run log" : `Run log (${runs.length})`}
        </button>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          disabled={runningJob !== null}
          onClick={() => void startJob("question_clinic")}
          className="rounded-full bg-wk-brand px-5 py-2.5 text-[13px] font-extrabold text-wk-brand-on disabled:opacity-50"
        >
          {runningJob === "question_clinic" ? "Running Question Clinic..." : "Run Question Clinic"}
        </button>
        <button
          type="button"
          disabled={runningJob !== null}
          onClick={() => void startJob("next_step_recommender")}
          className="rounded-full border border-wk-border bg-wk-bg px-5 py-2.5 text-[13px] font-extrabold text-wk-text disabled:opacity-50"
        >
          {runningJob === "next_step_recommender" ? "Thinking..." : "Suggest the next move"}
        </button>
      </div>

      {notice && (
        <div className="mt-4 rounded-xl border border-wk-border bg-wk-bg px-4 py-3 text-[13px] text-wk-text">
          {notice}
        </div>
      )}

      {showLog && (
        <div className="mt-4 rounded-xl border border-wk-border bg-wk-bg p-4">
          {runs.length === 0 ? (
            <p className="text-[13px] text-wk-text-muted">No assistant runs yet for this inquiry.</p>
          ) : (
            <ul className="space-y-2">
              {runs.map((run) => (
                <li key={run.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px] text-wk-text-muted">
                  <span className="font-bold text-wk-text">{JOB_LABELS[run.task] ?? run.task}</span>
                  <span>{runStatusLabel(run)}</span>
                  <span>{new Date(run.createdAt).toLocaleString()}</span>
                  {run.status === "failed" && (
                    <span className="text-wk-text">This run did not finish. Run it again when ready.</span>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      <div className="mt-5 space-y-3">
        {loading ? (
          <p className="text-[13px] text-wk-text-muted">Loading suggestions...</p>
        ) : pending.length === 0 ? (
          <div className="rounded-xl border border-dashed border-wk-border bg-wk-bg px-5 py-8 text-center">
            <p className="text-[14px] font-bold text-wk-text">Nothing waiting for review</p>
            <p className="mt-1 text-[13px] text-wk-text-muted">
              Run the Question Clinic or ask for the next move when you want a hand.
            </p>
          </div>
        ) : (
          pending.map((suggestion) => {
            const support = supportLabel(suggestion.confidence);
            const isEditing = editingId === suggestion.id;
            const busy = decidingId === suggestion.id;
            return (
              <article key={suggestion.id} className="rounded-xl border border-wk-border bg-wk-bg p-4">
                <div className="flex flex-wrap items-center gap-2 text-[10px] font-black uppercase tracking-[0.18em] text-wk-brand">
                  <span>{SUGGESTION_LABELS[suggestion.suggestionType] ?? suggestion.suggestionType}</span>
                  {support && <span className="text-wk-text-faint normal-case tracking-normal font-bold">{support}</span>}
                </div>
                {suggestion.title && (
                  <h3 className="mt-2 text-[15px] font-black leading-snug text-wk-text">{suggestion.title}</h3>
                )}
                {isEditing ? (
                  <textarea
                    value={editBody}
                    onChange={(event) => setEditBody(event.target.value)}
                    rows={3}
                    className="mt-2 w-full rounded-lg border border-wk-border bg-wk-surface p-3 text-[13px] leading-5 text-wk-text"
                  />
                ) : (
                  <p className="mt-1 text-[13px] leading-6 text-wk-text">{suggestion.body}</p>
                )}
                {suggestion.reason && (
                  <p className="mt-2 text-[12px] leading-5 text-wk-text-muted">
                    <span className="font-bold">Why this is suggested:</span> {suggestion.reason}
                  </p>
                )}
                <div className="mt-3 flex flex-wrap gap-2">
                  {isEditing ? (
                    <>
                      <button
                        type="button"
                        disabled={busy || !editBody.trim()}
                        onClick={() => void decide(suggestion, "edited_and_accepted")}
                        className="rounded-full bg-wk-brand px-4 py-2 text-[12px] font-extrabold text-wk-brand-on disabled:opacity-50"
                      >
                        Save edit and accept
                      </button>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => {
                          setEditingId(null);
                          setEditBody("");
                        }}
                        className="rounded-full border border-wk-border px-4 py-2 text-[12px] font-bold text-wk-text-muted"
                      >
                        Cancel
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => void decide(suggestion, "accepted")}
                        className="rounded-full bg-wk-brand px-4 py-2 text-[12px] font-extrabold text-wk-brand-on disabled:opacity-50"
                      >
                        Accept
                      </button>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => {
                          setEditingId(suggestion.id);
                          setEditBody(suggestion.body);
                        }}
                        className="rounded-full border border-wk-border px-4 py-2 text-[12px] font-bold text-wk-text disabled:opacity-50"
                      >
                        Edit first
                      </button>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => void decide(suggestion, "saved_as_doubt")}
                        className="rounded-full border border-wk-border px-4 py-2 text-[12px] font-bold text-wk-text-muted disabled:opacity-50"
                      >
                        Keep as doubt
                      </button>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => void decide(suggestion, "rejected")}
                        className="rounded-full border border-wk-border px-4 py-2 text-[12px] font-bold text-wk-text-muted disabled:opacity-50"
                      >
                        Reject
                      </button>
                    </>
                  )}
                </div>
              </article>
            );
          })
        )}
      </div>

      {decided.length > 0 && (
        <div className="mt-4">
          <button
            type="button"
            onClick={() => setShowDecided((v) => !v)}
            className="text-[12px] font-bold text-wk-text-muted hover:text-wk-text"
          >
            {showDecided ? "Hide decided suggestions" : `Decided suggestions (${decided.length})`}
          </button>
          {showDecided && (
            <ul className="mt-2 space-y-2">
              {decided.map((suggestion) => (
                <li key={suggestion.id} className="rounded-lg border border-wk-border bg-wk-bg px-4 py-2.5 text-[12px] text-wk-text-muted">
                  <span className="font-bold text-wk-text">
                    {SUGGESTION_LABELS[suggestion.suggestionType] ?? suggestion.suggestionType}:
                  </span>{" "}
                  {suggestion.body.slice(0, 140)}
                  {suggestion.body.length > 140 ? "..." : ""}{" "}
                  <span className="font-bold">
                    {suggestion.status === "accepted" && "Accepted"}
                    {suggestion.status === "edited_and_accepted" && "Edited and accepted"}
                    {suggestion.status === "rejected" && "Rejected"}
                    {suggestion.status === "saved_as_doubt" && "Kept as doubt"}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </section>
  );
}
