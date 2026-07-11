import { useMemo, useState } from "react";
import { WkIcon } from "@/components/design-system/Icon";
import {
  completeRelationshipReview,
  draftRelationshipReview,
  type ConsolidationRow,
  type RelationshipReviewInput,
} from "@/services/registryKnowledgeReviewService";

const EVIDENCE_TYPES = [
  ["article", "Article"],
  ["official_documentation", "Official Documentation"],
  ["release_metadata", "Release Metadata"],
  ["track_metadata", "Track Metadata"],
  ["artist_metadata", "Artist Metadata"],
  ["interview", "Interview"],
  ["video", "Video"],
  ["screenshot", "Screenshot"],
  ["field_note", "Field Note"],
] as const;

function Gate({ pass, children }: { pass: boolean; children: React.ReactNode }) {
  return (
    <div className={`flex items-center gap-2 text-[12px] ${pass ? "text-wk-success" : "text-wk-text-muted"}`}>
      <WkIcon name={pass ? "CheckCircle2" : "Circle"} size={15} />
      <span>{children}</span>
    </div>
  );
}

export function RelationshipReviewDrawer({
  row,
  onClose,
  onComplete,
}: {
  row: ConsolidationRow;
  onClose: () => void;
  onComplete: (message: string) => Promise<void>;
}) {
  const [evidenceTitle, setEvidenceTitle] = useState("");
  const [evidenceType, setEvidenceType] = useState("track_metadata");
  const [sourceUrl, setSourceUrl] = useState("");
  const [evidenceSummary, setEvidenceSummary] = useState("");
  const [evidenceMainClaim, setEvidenceMainClaim] = useState("");
  const [reliability, setReliability] = useState("medium");
  const [confidence, setConfidence] = useState("medium");
  const [plainReason, setPlainReason] = useState(row.plain_reason ?? "");
  const [reviewReason, setReviewReason] = useState("");
  const [decision, setDecision] = useState<RelationshipReviewInput["nextReviewStatus"]>("pending_review");
  const [publicSafe, setPublicSafe] = useState(false);
  const [drafting, setDrafting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [uncertainty, setUncertainty] = useState("");
  const [drafted, setDrafted] = useState(false);

  const gates = useMemo(() => ({
    endpoints: Boolean(row.source_entity_id && row.target_entity_id),
    evidence: Boolean(evidenceTitle.trim() && evidenceSummary.trim()),
    explanation: Boolean(plainReason.trim()),
    reviewReason: Boolean(reviewReason.trim()),
    approved: decision === "approved",
    publicSafe,
  }), [decision, evidenceSummary, evidenceTitle, plainReason, publicSafe, reviewReason, row.source_entity_id, row.target_entity_id]);

  const canSave = gates.endpoints
    && gates.reviewReason
    && gates.explanation
    && (decision === "rejected" || decision === "disputed" || gates.evidence)
    && (!publicSafe || decision === "approved");

  const handleDraft = async () => {
    setDrafting(true);
    setError(null);
    try {
      const result = await draftRelationshipReview(row.relationship_id);
      setEvidenceTitle(result.evidenceTitle);
      setEvidenceType(result.evidenceType);
      setEvidenceSummary(result.evidenceSummary);
      setEvidenceMainClaim(result.evidenceMainClaim);
      setPlainReason(result.publicExplanation);
      setReviewReason(result.reviewReason);
      setReliability(result.reliability);
      setConfidence(result.confidence);
      setUncertainty(result.uncertaintyNote);
      setDrafted(true);
    } catch (draftError) {
      setError(draftError instanceof Error ? draftError.message : "The Culture Context Engine could not draft this review.");
    } finally {
      setDrafting(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      await completeRelationshipReview({
        relationshipId: row.relationship_id,
        evidenceTitle,
        evidenceType,
        sourceUrl,
        evidenceSummary,
        evidenceMainClaim,
        reliability,
        confidence,
        plainReason,
        reviewReason,
        nextReviewStatus: decision,
        publicSafe,
      });
      await onComplete(
        publicSafe
          ? `${row.source_slug} and ${row.target_slug} are approved for public use.`
          : `Review saved for ${row.source_slug} and ${row.target_slug}.`,
      );
      onClose();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "The relationship review could not be saved.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/40" role="dialog" aria-modal="true">
      <div className="ml-auto w-full max-w-2xl border-l border-wk-border bg-wk-surface shadow-2xl">
        <div className="flex items-start justify-between gap-4 border-b border-wk-border p-5">
          <div>
            <div className="text-[11px] font-black uppercase tracking-wide text-wk-brand">Relationship Review</div>
            <h2 className="mt-1 text-[20px] font-black text-wk-text">{row.source_slug} and {row.target_slug}</h2>
            <p className="mt-1 text-[12px] text-wk-text-muted">{row.relationship_type.replace(/_/g, " ")}</p>
          </div>
          <button onClick={onClose} disabled={saving} className="rounded-lg p-2 text-wk-text-muted hover:bg-wk-surface-raised" aria-label="Close">
            <WkIcon name="X" size={17} />
          </button>
        </div>

        <div className="space-y-6 p-5">
          {error ? <div className="rounded-xl border border-wk-danger/20 bg-wk-danger/10 px-4 py-3 text-[12px] font-semibold text-wk-danger">{error}</div> : null}

          <section className="rounded-xl border border-wk-brand/20 bg-wk-brand-soft p-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h3 className="text-[14px] font-black text-wk-text">Start With A Complete Draft</h3>
                <p className="mt-1 text-[12px] text-wk-text-muted">The Culture Context Engine drafts every required field from the available relationship context.</p>
              </div>
              <button onClick={handleDraft} disabled={drafting} className="inline-flex items-center justify-center gap-2 rounded-lg bg-wk-brand px-4 py-2.5 text-[12px] font-black text-wk-brand-on disabled:opacity-50">
                <WkIcon name={drafting ? "Loader2" : "Sparkles"} size={14} className={drafting ? "animate-spin" : ""} />
                {drafting ? "Drafting Full Review" : drafted ? "Redraft Full Review" : "Draft Full Review"}
              </button>
            </div>
          </section>

          <section className="space-y-4">
            <div>
              <h3 className="text-[14px] font-black text-wk-text">Evidence</h3>
              <p className="mt-1 text-[12px] text-wk-text-muted">Review and correct the drafted source record before saving.</p>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block sm:col-span-2">
                <span className="mb-1.5 block text-[11px] font-bold text-wk-text-muted">Evidence Title</span>
                <input value={evidenceTitle} onChange={(event) => setEvidenceTitle(event.target.value)} className="w-full rounded-lg border border-wk-border bg-wk-surface-raised px-3 py-2.5 text-[13px] text-wk-text outline-none focus:border-wk-brand" />
              </label>
              <label className="block">
                <span className="mb-1.5 block text-[11px] font-bold text-wk-text-muted">Evidence Type</span>
                <select value={evidenceType} onChange={(event) => setEvidenceType(event.target.value)} className="w-full rounded-lg border border-wk-border bg-wk-surface-raised px-3 py-2.5 text-[13px] text-wk-text outline-none focus:border-wk-brand">
                  {EVIDENCE_TYPES.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                </select>
              </label>
              <label className="block">
                <span className="mb-1.5 block text-[11px] font-bold text-wk-text-muted">Source URL <span className="font-normal">(optional)</span></span>
                <input value={sourceUrl} onChange={(event) => setSourceUrl(event.target.value)} placeholder="https://" className="w-full rounded-lg border border-wk-border bg-wk-surface-raised px-3 py-2.5 text-[13px] text-wk-text outline-none focus:border-wk-brand" />
              </label>
              <label className="block sm:col-span-2">
                <span className="mb-1.5 block text-[11px] font-bold text-wk-text-muted">Evidence Summary</span>
                <textarea value={evidenceSummary} onChange={(event) => setEvidenceSummary(event.target.value)} rows={4} className="w-full resize-none rounded-lg border border-wk-border bg-wk-surface-raised px-3 py-2.5 text-[13px] text-wk-text outline-none focus:border-wk-brand" />
              </label>
              <label className="block sm:col-span-2">
                <span className="mb-1.5 block text-[11px] font-bold text-wk-text-muted">Main Claim</span>
                <input value={evidenceMainClaim} onChange={(event) => setEvidenceMainClaim(event.target.value)} className="w-full rounded-lg border border-wk-border bg-wk-surface-raised px-3 py-2.5 text-[13px] text-wk-text outline-none focus:border-wk-brand" />
              </label>
              <label className="block">
                <span className="mb-1.5 block text-[11px] font-bold text-wk-text-muted">Reliability</span>
                <select value={reliability} onChange={(event) => setReliability(event.target.value)} className="w-full rounded-lg border border-wk-border bg-wk-surface-raised px-3 py-2.5 text-[13px] text-wk-text"><option value="high">High</option><option value="medium">Medium</option><option value="low">Low</option></select>
              </label>
              <label className="block">
                <span className="mb-1.5 block text-[11px] font-bold text-wk-text-muted">Confidence</span>
                <select value={confidence} onChange={(event) => setConfidence(event.target.value)} className="w-full rounded-lg border border-wk-border bg-wk-surface-raised px-3 py-2.5 text-[13px] text-wk-text"><option value="high">High</option><option value="medium">Medium</option><option value="low">Low</option></select>
              </label>
            </div>
          </section>

          <section className="space-y-4 border-t border-wk-border pt-5">
            <div>
              <h3 className="text-[14px] font-black text-wk-text">Public Explanation</h3>
              <p className="mt-1 text-[12px] text-wk-text-muted">Review the drafted sentence. It should state what happened without assigning unverified roles.</p>
            </div>
            <textarea value={plainReason} onChange={(event) => setPlainReason(event.target.value)} rows={4} className="w-full resize-none rounded-lg border border-wk-border bg-wk-surface-raised px-3 py-2.5 text-[13px] text-wk-text outline-none focus:border-wk-brand" />
            {uncertainty ? <p className="text-[11px] text-wk-text-muted">Check before approval: {uncertainty}</p> : null}
          </section>

          <section className="space-y-4 border-t border-wk-border pt-5">
            <h3 className="text-[14px] font-black text-wk-text">Human Decision</h3>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block">
                <span className="mb-1.5 block text-[11px] font-bold text-wk-text-muted">Decision</span>
                <select value={decision} onChange={(event) => { const value = event.target.value as RelationshipReviewInput["nextReviewStatus"]; setDecision(value); if (value !== "approved") setPublicSafe(false); }} className="w-full rounded-lg border border-wk-border bg-wk-surface-raised px-3 py-2.5 text-[13px] text-wk-text">
                  <option value="pending_review">Save For Review</option>
                  <option value="approved">Approve</option>
                  <option value="rejected">Reject</option>
                  <option value="disputed">Mark Disputed</option>
                </select>
              </label>
              <label className="flex items-center gap-3 rounded-lg border border-wk-border bg-wk-surface-raised px-3 py-2.5">
                <input type="checkbox" checked={publicSafe} disabled={decision !== "approved"} onChange={(event) => setPublicSafe(event.target.checked)} />
                <span className="text-[12px] font-bold text-wk-text">Clear For Public Use</span>
              </label>
              <label className="block sm:col-span-2">
                <span className="mb-1.5 block text-[11px] font-bold text-wk-text-muted">Review Reason</span>
                <textarea value={reviewReason} onChange={(event) => setReviewReason(event.target.value)} rows={3} className="w-full resize-none rounded-lg border border-wk-border bg-wk-surface-raised px-3 py-2.5 text-[13px] text-wk-text outline-none focus:border-wk-brand" />
              </label>
            </div>
          </section>

          <section className="space-y-2 rounded-xl border border-wk-border bg-wk-surface-raised p-4">
            <h3 className="mb-3 text-[13px] font-black text-wk-text">Publication Check</h3>
            <Gate pass={gates.endpoints}>Both artists are resolved</Gate>
            <Gate pass={gates.evidence}>Evidence is ready</Gate>
            <Gate pass={gates.explanation}>Public explanation is ready</Gate>
            <Gate pass={gates.reviewReason}>Review reason is ready</Gate>
            <Gate pass={gates.approved}>Human decision is approved</Gate>
            <Gate pass={gates.publicSafe}>Public use is confirmed</Gate>
          </section>
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-wk-border p-4">
          <button onClick={onClose} disabled={saving} className="rounded-lg border border-wk-border px-4 py-2 text-[12px] font-bold text-wk-text-muted">Cancel</button>
          <button onClick={handleSave} disabled={saving || !canSave} className="inline-flex items-center gap-2 rounded-lg bg-wk-brand px-4 py-2 text-[12px] font-black text-wk-brand-on disabled:opacity-40">
            <WkIcon name={saving ? "Loader2" : "Check"} size={14} className={saving ? "animate-spin" : ""} />
            {publicSafe ? "Approve And Publish" : "Save Review"}
          </button>
        </div>
      </div>
    </div>
  );
}
