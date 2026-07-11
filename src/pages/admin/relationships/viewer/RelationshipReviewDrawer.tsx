import { useEffect, useMemo, useState } from "react";
import { WkIcon } from "@/components/design-system/Icon";
import {
  completeRelationshipReview,
  draftRelationshipExplanation,
  loadRelationshipReviewContext,
  type RelationshipReviewContext,
} from "@/services/registryRelationshipReviewService";

function humanize(value: string | null | undefined) {
  return value ? value.replace(/_/g, " ") : "Not set";
}

export function RelationshipReviewDrawer({
  relationshipId,
  onClose,
  onComplete,
}: {
  relationshipId: string;
  onClose: () => void;
  onComplete: (message: string) => Promise<void> | void;
}) {
  const [context, setContext] = useState<RelationshipReviewContext | null>(null);
  const [evidenceId, setEvidenceId] = useState("");
  const [plainReason, setPlainReason] = useState("");
  const [reviewReason, setReviewReason] = useState("");
  const [nextStatus, setNextStatus] = useState<"pending_review" | "approved" | "rejected" | "disputed">("pending_review");
  const [publicSafe, setPublicSafe] = useState(false);
  const [uncertaintyNote, setUncertaintyNote] = useState("");
  const [factsUsed, setFactsUsed] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [drafting, setDrafting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    loadRelationshipReviewContext(relationshipId)
      .then((data) => {
        if (!alive) return;
        setContext(data);
        setPlainReason(data.relationship.plainReason || "");
        setReviewReason(data.relationship.reviewNote || "");
        setNextStatus(data.relationship.reviewStatus === "approved" ? "approved" : "pending_review");
        setPublicSafe(data.relationship.publicSafe);
        const attached = data.evidence.find((item) => item.attached);
        if (attached) setEvidenceId(attached.id);
      })
      .catch((loadError) => {
        if (!alive) return;
        setError(loadError instanceof Error ? loadError.message : "This relationship could not be loaded.");
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => { alive = false; };
  }, [relationshipId]);

  const selectedEvidence = useMemo(
    () => context?.evidence.find((item) => item.id === evidenceId) || null,
    [context, evidenceId],
  );

  const checks = {
    endpoints: Boolean(context?.relationship.sourceEntityId && context?.relationship.targetEntityId),
    evidence: Boolean(selectedEvidence),
    explanation: plainReason.trim().length > 0,
    reviewedEvidence: Boolean(selectedEvidence && ["reviewed", "approved"].includes(selectedEvidence.reviewStatus)),
    publicEvidence: Boolean(selectedEvidence?.reviewStatus === "approved" && selectedEvidence.retrievalStatus === "default_retrieval"),
  };

  const canApprove = checks.endpoints && checks.evidence && checks.explanation && checks.reviewedEvidence && reviewReason.trim().length > 0;
  const canPublish = canApprove && checks.publicEvidence;

  const handleDraft = async () => {
    if (!evidenceId) {
      setError("Choose evidence before asking for a draft.");
      return;
    }
    setDrafting(true);
    setError(null);
    try {
      const draft = await draftRelationshipExplanation(relationshipId, evidenceId);
      setPlainReason(draft.draft);
      setUncertaintyNote(draft.uncertaintyNote);
      setFactsUsed(draft.factsUsed);
    } catch (draftError) {
      setError(draftError instanceof Error ? draftError.message : "The draft could not be created.");
    } finally {
      setDrafting(false);
    }
  };

  const handleSave = async () => {
    if ((nextStatus === "approved" || publicSafe) && !canApprove) {
      setError("Complete the evidence, explanation, and review reason before approving this relationship.");
      return;
    }
    if (publicSafe && !canPublish) {
      setError("Public use requires approved evidence enabled for public retrieval.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await completeRelationshipReview({
        relationshipId,
        evidenceId: evidenceId || null,
        plainReason,
        reviewReason,
        nextReviewStatus: nextStatus,
        publicSafe,
      });
      await onComplete(publicSafe ? "Relationship approved and cleared for public use." : "Relationship review saved.");
      onClose();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "The relationship review could not be saved.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/40" role="dialog" aria-modal="true">
      <div className="h-full w-full max-w-2xl overflow-y-auto border-l border-wk-border bg-wk-surface shadow-2xl">
        <div className="sticky top-0 z-10 flex items-start justify-between border-b border-wk-border bg-wk-surface px-5 py-4">
          <div>
            <div className="text-[11px] font-black uppercase tracking-wide text-wk-brand">Relationship Review</div>
            <h2 className="mt-1 text-[20px] font-black text-wk-text">
              {context ? `${context.relationship.sourceName} and ${context.relationship.targetName}` : "Loading Relationship"}
            </h2>
            {context ? <p className="mt-1 text-[12px] text-wk-text-muted">{humanize(context.relationship.relationshipType)}</p> : null}
          </div>
          <button onClick={onClose} className="rounded-lg p-2 text-wk-text-muted hover:bg-wk-surface-raised" aria-label="Close Review">
            <WkIcon name="X" size={17} />
          </button>
        </div>

        <div className="space-y-6 p-5">
          {loading ? <div className="flex items-center gap-2 text-[13px] text-wk-text-muted"><WkIcon name="Loader2" size={16} className="animate-spin" />Loading review details</div> : null}
          {error ? <div className="rounded-xl border border-wk-danger/20 bg-wk-danger/10 px-4 py-3 text-[12px] font-semibold text-wk-danger">{error}</div> : null}

          {context ? (
            <>
              <section>
                <h3 className="text-[13px] font-black text-wk-text">Supporting Evidence</h3>
                <p className="mt-1 text-[12px] text-wk-text-muted">Choose the reviewed source that proves this relationship.</p>
                <div className="mt-3 space-y-2">
                  {context.evidence.map((item) => (
                    <label key={item.id} className={`block cursor-pointer rounded-xl border p-3 ${evidenceId === item.id ? "border-wk-brand bg-wk-brand-soft" : "border-wk-border bg-wk-surface-raised"}`}>
                      <div className="flex gap-3">
                        <input type="radio" name="evidence" value={item.id} checked={evidenceId === item.id} onChange={() => setEvidenceId(item.id)} className="mt-1" />
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-[13px] font-black text-wk-text">{item.title}</span>
                            <span className="rounded-full bg-wk-surface px-2 py-0.5 text-[10px] font-bold text-wk-text-muted">{humanize(item.reviewStatus)}</span>
                            <span className="rounded-full bg-wk-surface px-2 py-0.5 text-[10px] font-bold text-wk-text-muted">{humanize(item.retrievalStatus)}</span>
                          </div>
                          <p className="mt-1 text-[11px] text-wk-text-muted">{item.summary}</p>
                          {item.sourceUrl ? <a href={item.sourceUrl} target="_blank" rel="noreferrer" className="mt-2 inline-block text-[11px] font-bold text-wk-brand">Open Source</a> : null}
                        </div>
                      </div>
                    </label>
                  ))}
                  {context.evidence.length === 0 ? <div className="rounded-xl border border-wk-warning/20 bg-wk-warning/10 px-4 py-3 text-[12px] text-wk-warning">No reviewed evidence is available yet.</div> : null}
                </div>
              </section>

              <section>
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <h3 className="text-[13px] font-black text-wk-text">Public Explanation</h3>
                    <p className="mt-1 text-[12px] text-wk-text-muted">Start with the Culture Context Engine, then review and edit every word.</p>
                  </div>
                  <button onClick={() => void handleDraft()} disabled={!evidenceId || drafting} className="inline-flex items-center justify-center gap-2 rounded-lg border border-wk-brand px-3 py-2 text-[12px] font-black text-wk-brand disabled:opacity-40">
                    {drafting ? <WkIcon name="Loader2" size={14} className="animate-spin" /> : <WkIcon name="Sparkles" size={14} />}
                    Draft With Culture Context Engine
                  </button>
                </div>
                <textarea value={plainReason} onChange={(event) => setPlainReason(event.target.value)} rows={4} className="mt-3 w-full resize-y rounded-xl border border-wk-border bg-wk-surface-raised px-3 py-3 text-[13px] text-wk-text outline-none focus:border-wk-brand" placeholder="What happened, based on the evidence?" />
                {uncertaintyNote ? <div className="mt-3 rounded-xl border border-wk-warning/20 bg-wk-warning/10 px-4 py-3"><div className="text-[11px] font-black text-wk-warning">What Still Needs Care</div><p className="mt-1 text-[12px] text-wk-text-muted">{uncertaintyNote}</p></div> : null}
                {factsUsed.length ? <div className="mt-3"><div className="text-[11px] font-black text-wk-text-muted">Facts Used</div><ul className="mt-1 space-y-1 text-[12px] text-wk-text-muted">{factsUsed.map((fact) => <li key={fact}>• {fact}</li>)}</ul></div> : null}
              </section>

              <section>
                <h3 className="text-[13px] font-black text-wk-text">Human Decision</h3>
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  <label className="block"><span className="mb-1.5 block text-[11px] font-bold text-wk-text-muted">Review Decision</span><select value={nextStatus} onChange={(event) => { const value = event.target.value as typeof nextStatus; setNextStatus(value); if (value !== "approved") setPublicSafe(false); }} className="w-full rounded-lg border border-wk-border bg-wk-surface-raised px-3 py-2.5 text-[13px] text-wk-text"><option value="pending_review">Needs More Work</option><option value="approved">Approve</option><option value="rejected">Reject</option><option value="disputed">Dispute</option></select></label>
                  <label className="flex items-center gap-3 rounded-xl border border-wk-border bg-wk-surface-raised px-3 py-3"><input type="checkbox" checked={publicSafe} disabled={nextStatus !== "approved"} onChange={(event) => setPublicSafe(event.target.checked)} /><span><span className="block text-[12px] font-black text-wk-text">Clear For Public Use</span><span className="block text-[11px] text-wk-text-muted">This remains a human decision.</span></span></label>
                </div>
                <label className="mt-3 block"><span className="mb-1.5 block text-[11px] font-bold text-wk-text-muted">Review Reason</span><textarea value={reviewReason} onChange={(event) => setReviewReason(event.target.value)} rows={3} className="w-full resize-y rounded-xl border border-wk-border bg-wk-surface-raised px-3 py-3 text-[13px] text-wk-text outline-none focus:border-wk-brand" placeholder="Why are you making this decision?" /></label>
              </section>

              <section className="rounded-xl border border-wk-border bg-wk-surface-raised p-4">
                <h3 className="text-[13px] font-black text-wk-text">Publication Check</h3>
                <div className="mt-3 grid gap-2 sm:grid-cols-2">
                  {[['Both identities resolved', checks.endpoints], ['Evidence selected', checks.evidence], ['Explanation reviewed', checks.explanation], ['Evidence reviewed', checks.reviewedEvidence], ['Evidence cleared for public retrieval', checks.publicEvidence]].map(([label, passed]) => <div key={String(label)} className="flex items-center gap-2 text-[12px]"><WkIcon name={passed ? "Check" : "Circle"} size={14} className={passed ? "text-wk-success" : "text-wk-text-faint"} /><span className={passed ? "text-wk-text" : "text-wk-text-muted"}>{String(label)}</span></div>)}
                </div>
              </section>
            </>
          ) : null}
        </div>

        <div className="sticky bottom-0 flex justify-end gap-2 border-t border-wk-border bg-wk-surface px-5 py-4">
          <button onClick={onClose} disabled={saving} className="rounded-lg border border-wk-border px-4 py-2 text-[12px] font-bold text-wk-text-muted">Cancel</button>
          <button onClick={() => void handleSave()} disabled={saving || loading || !context || !reviewReason.trim()} className="inline-flex items-center gap-2 rounded-lg bg-wk-brand px-4 py-2 text-[12px] font-black text-wk-brand-on disabled:opacity-40">{saving ? <WkIcon name="Loader2" size={14} className="animate-spin" /> : <WkIcon name="Check" size={14} />}Save Review</button>
        </div>
      </div>
    </div>
  );
}