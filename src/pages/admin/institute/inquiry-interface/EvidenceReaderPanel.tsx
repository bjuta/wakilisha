import { useCallback, useEffect, useMemo, useState } from "react";
import type { InquiryDraft } from "./types";
import {
  type AssistantSuggestion,
  decideSuggestion,
  listAssistantSuggestions,
  runAssistantJob,
} from "@/services/institute/assistantRunService";
import {
  READER_VERDICT_OPTIONS,
  type EvidenceReaderVerdict,
  recordEvidenceVerdict,
} from "@/services/institute/evidenceReaderService";

// Evidence Reader. The assistant extracts what a piece of evidence contains;
// a human judges the extraction and records where the evidence stands.
// Extraction is never claim judgment.

const PART_LABELS: Record<string, string> = {
  summary: "What it says",
  key_fact: "Fact it states",
  possible_relationship: "Possible relationship",
  possible_claim: "Possible claim, not yet judged",
  source_quality: "Source quality",
  contradiction: "Contradiction",
  missing_context: "Missing context",
};

export default function EvidenceReaderPanel({
  draft,
  onEvidenceChanged,
}: {
  draft: InquiryDraft;
  onEvidenceChanged: () => void | Promise<void>;
}) {
  const [suggestions, setSuggestions] = useState<AssistantSuggestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState<string | null>(null);
  const [readingId, setReadingId] = useState<string | null>(null);
  const [decidingId, setDecidingId] = useState<string | null>(null);
  const [openEvidenceId, setOpenEvidenceId] = useState<string | null>(null);
  const [verdictById, setVerdictById] = useState<Record<string, EvidenceReaderVerdict>>({});
  const [noteById, setNoteById] = useState<Record<string, string>>({});
  const [savingVerdictId, setSavingVerdictId] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      setSuggestions(await listAssistantSuggestions(draft.id, 200));
      setNotice(null);
    } catch {
      setNotice("The reader history could not load. Try again in a moment.");
    } finally {
      setLoading(false);
    }
  }, [draft.id]);

  useEffect(() => {
    setLoading(true);
    void refresh();
  }, [refresh]);

  const extractionsByEvidence = useMemo(() => {
    const map = new Map<string, AssistantSuggestion[]>();
    suggestions.forEach((s) => {
      const payload = s.payload as { kind?: string; evidenceItemId?: string };
      if (payload.kind === "evidence_extraction" && payload.evidenceItemId) {
        const list = map.get(payload.evidenceItemId) ?? [];
        list.push(s);
        map.set(payload.evidenceItemId, list);
      }
    });
    return map;
  }, [suggestions]);

  const evidence = draft.evidence ?? [];

  const readEvidence = async (evidenceItemId: string) => {
    setReadingId(evidenceItemId);
    setNotice(null);
    try {
      await runAssistantJob(draft.id, "evidence_reader", { evidenceItemId });
      setOpenEvidenceId(evidenceItemId);
      await refresh();
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "The reader run did not finish.");
    } finally {
      setReadingId(null);
    }
  };

  const decide = async (suggestionId: string, decision: "accepted" | "rejected" | "saved_as_doubt") => {
    setDecidingId(suggestionId);
    try {
      await decideSuggestion(suggestionId, decision);
      await refresh();
    } catch {
      setNotice("That decision could not be saved. Try again.");
    } finally {
      setDecidingId(null);
    }
  };

  const saveVerdict = async (item: InquiryDraft["evidence"][number]) => {
    const verdict = verdictById[item.id] ?? "accepted";
    setSavingVerdictId(item.id);
    setNotice(null);
    try {
      await recordEvidenceVerdict(
        draft.id,
        { id: item.id, title: item.title, reviewState: item.reviewState, metadata: item.metadata },
        verdict,
        noteById[item.id] ?? "",
      );
      setNoteById((current) => ({ ...current, [item.id]: "" }));
      await Promise.resolve(onEvidenceChanged());
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "The verdict could not be saved.");
    } finally {
      setSavingVerdictId(null);
    }
  };

  if (evidence.length === 0) {
    return (
      <section className="mx-auto mt-5 max-w-[1180px] rounded-[22px] border border-wk-border bg-wk-surface p-6 shadow-sm lg:p-7">
        <div className="text-[10px] font-black uppercase tracking-[0.24em] text-wk-brand">Material review</div>
        <p className="mt-3 text-[13px] text-wk-text-muted">
          There is nothing to review yet. Add material first.
        </p>
      </section>
    );
  }

  return (
    <section className="mx-auto mt-5 max-w-[1180px] rounded-[22px] border border-wk-border bg-wk-surface p-6 shadow-sm lg:p-7">
      <div className="text-[10px] font-black uppercase tracking-[0.24em] text-wk-brand">Material review</div>
      <h2 className="mt-2 text-[24px] font-black leading-tight tracking-[-0.04em] text-wk-text">Review this material</h2>
      <p className="mt-1 max-w-[70ch] text-[13px] leading-5 text-wk-text-muted">
        The reader extracts what each piece of evidence contains. You judge the extraction and record where the
        evidence stands. Reading is not claim judgment.
      </p>

      {notice && (
        <div className="mt-4 rounded-xl border border-wk-border bg-wk-bg px-4 py-3 text-[13px] text-wk-text">{notice}</div>
      )}

      <div className="mt-4 space-y-3">
        {evidence.map((item) => {
          const extractions = extractionsByEvidence.get(item.id) ?? [];
          const pending = extractions.filter((s) => s.status === "suggested");
          const isOpen = openEvidenceId === item.id;
          return (
            <article key={item.id} className="rounded-xl border border-wk-border bg-wk-bg p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-[10px] font-black uppercase tracking-[0.16em] text-wk-text-faint">
                    {item.kind} · {item.reviewState}
                  </div>
                  <h3 className="mt-1 text-[15px] font-black leading-snug text-wk-text">{item.title}</h3>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    disabled={readingId !== null}
                    onClick={() => void readEvidence(item.id)}
                    className="rounded-full bg-wk-brand px-4 py-2 text-[12px] font-extrabold text-wk-brand-on disabled:opacity-50"
                  >
                    {readingId === item.id ? "Reading..." : extractions.length ? "Read again" : "Review Material"}
                  </button>
                  <button
                    type="button"
                    onClick={() => setOpenEvidenceId(isOpen ? null : item.id)}
                    className="rounded-full border border-wk-border px-4 py-2 text-[12px] font-bold text-wk-text-muted"
                  >
                    {isOpen ? "Close" : `Details${extractions.length ? ` (${extractions.length})` : ""}`}
                  </button>
                </div>
              </div>

              {isOpen && (
                <div className="mt-4 space-y-4">
                  {pending.length === 0 ? (
                    <p className="text-[13px] text-wk-text-muted">
                      {extractions.length
                        ? "Every extraction from this evidence has been decided."
                        : "This evidence has not been read yet. Run the reader when you are ready."}
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {pending.map((s) => {
                        const part = (s.payload as { part?: string }).part ?? "";
                        return (
                          <div key={s.id} className="rounded-lg border border-wk-border bg-wk-surface p-3">
                            <div className="text-[10px] font-black uppercase tracking-[0.14em] text-wk-brand">
                              {PART_LABELS[part] ?? s.title}
                            </div>
                            <p className="mt-1 text-[13px] leading-6 text-wk-text">{s.body}</p>
                            {s.reason && (
                              <p className="mt-1 text-[12px] text-wk-text-muted">
                                <span className="font-bold">Why:</span> {s.reason}
                              </p>
                            )}
                            <div className="mt-2 flex flex-wrap gap-2">
                              <button
                                type="button"
                                disabled={decidingId === s.id}
                                onClick={() => void decide(s.id, "accepted")}
                                className="rounded-full bg-wk-brand px-3.5 py-1.5 text-[11px] font-extrabold text-wk-brand-on disabled:opacity-50"
                              >
                                Accept
                              </button>
                              <button
                                type="button"
                                disabled={decidingId === s.id}
                                onClick={() => void decide(s.id, "saved_as_doubt")}
                                className="rounded-full border border-wk-border px-3.5 py-1.5 text-[11px] font-bold text-wk-text-muted disabled:opacity-50"
                              >
                                Keep as doubt
                              </button>
                              <button
                                type="button"
                                disabled={decidingId === s.id}
                                onClick={() => void decide(s.id, "rejected")}
                                className="rounded-full border border-wk-border px-3.5 py-1.5 text-[11px] font-bold text-wk-text-muted disabled:opacity-50"
                              >
                                Reject
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  <div className="rounded-lg border border-wk-border bg-wk-surface p-3">
                    <div className="text-[10px] font-black uppercase tracking-[0.14em] text-wk-text-faint">
                      Where this evidence stands
                    </div>
                    <div className="mt-2 grid gap-2 md:grid-cols-[260px_1fr_auto]">
                      <select
                        aria-label={`Verdict for ${item.title}`}
                        value={verdictById[item.id] ?? "accepted"}
                        onChange={(event) =>
                          setVerdictById((current) => ({
                            ...current,
                            [item.id]: event.target.value as EvidenceReaderVerdict,
                          }))
                        }
                        className="rounded-lg border border-wk-border bg-wk-bg p-2.5 text-[13px] text-wk-text"
                      >
                        {READER_VERDICT_OPTIONS.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                      <input
                        aria-label={`Verdict note for ${item.title}`}
                        value={noteById[item.id] ?? ""}
                        onChange={(event) =>
                          setNoteById((current) => ({ ...current, [item.id]: event.target.value }))
                        }
                        placeholder="A short note on why."
                        className="rounded-lg border border-wk-border bg-wk-bg p-2.5 text-[13px] text-wk-text"
                      />
                      <button
                        type="button"
                        disabled={savingVerdictId === item.id}
                        onClick={() => void saveVerdict(item)}
                        className="rounded-full border border-wk-border bg-wk-bg px-4 py-2 text-[12px] font-extrabold text-wk-text disabled:opacity-50"
                      >
                        {savingVerdictId === item.id ? "Saving..." : "Record"}
                      </button>
                    </div>
                    <p className="mt-1 text-[11px] text-wk-text-faint">
                      {READER_VERDICT_OPTIONS.find((o) => o.value === (verdictById[item.id] ?? "accepted"))?.hint}
                    </p>
                  </div>
                </div>
              )}
            </article>
          );
        })}
      </div>

      {loading && <p className="mt-3 text-[12px] text-wk-text-faint">Loading reader history...</p>}
    </section>
  );
}
