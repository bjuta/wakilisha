import { useState } from "react";
import { WkIcon } from "@/components/design-system/Icon";
import {
  createReviewedRelationshipEvidence,
  type ReviewEvidenceItem,
} from "@/services/registryRelationshipReviewService";

export function RelationshipEvidenceCreator({
  onCreated,
}: {
  onCreated: (item: ReviewEvidenceItem) => void;
}) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [evidenceType, setEvidenceType] = useState<"article" | "official_documentation" | "release_metadata" | "track_metadata" | "artist_metadata" | "interview" | "video">("track_metadata");
  const [sourceUrl, setSourceUrl] = useState("");
  const [summary, setSummary] = useState("");
  const [mainClaim, setMainClaim] = useState("");
  const [reviewReason, setReviewReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const create = async () => {
    setBusy(true);
    setError(null);
    try {
      const item = await createReviewedRelationshipEvidence({
        title,
        evidenceType,
        sourceUrl,
        summary,
        mainClaim,
        reviewReason,
      });
      onCreated(item);
      setOpen(false);
      setTitle("");
      setSourceUrl("");
      setSummary("");
      setMainClaim("");
      setReviewReason("");
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : "The evidence could not be created.");
    } finally {
      setBusy(false);
    }
  };

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className="mt-3 inline-flex items-center gap-2 rounded-lg border border-wk-brand px-3 py-2 text-[12px] font-black text-wk-brand">
        <WkIcon name="Plus" size={14} />
        Add Reviewed Evidence
      </button>
    );
  }

  return (
    <div className="mt-3 rounded-xl border border-wk-border bg-wk-surface-raised p-4">
      <div className="flex items-start justify-between gap-3">
        <div><h4 className="text-[13px] font-black text-wk-text">Add Reviewed Evidence</h4><p className="mt-1 text-[11px] text-wk-text-muted">Add the source you checked. This action marks it reviewed and ready for public retrieval.</p></div>
        <button onClick={() => setOpen(false)} aria-label="Close Evidence Form"><WkIcon name="X" size={15} className="text-wk-text-muted" /></button>
      </div>
      {error ? <div className="mt-3 rounded-lg border border-wk-danger/20 bg-wk-danger/10 px-3 py-2 text-[11px] font-semibold text-wk-danger">{error}</div> : null}
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <label className="block sm:col-span-2"><span className="mb-1 block text-[11px] font-bold text-wk-text-muted">Source Title</span><input value={title} onChange={(event) => setTitle(event.target.value)} className="w-full rounded-lg border border-wk-border bg-wk-surface px-3 py-2 text-[12px] text-wk-text" /></label>
        <label className="block"><span className="mb-1 block text-[11px] font-bold text-wk-text-muted">Evidence Type</span><select value={evidenceType} onChange={(event) => setEvidenceType(event.target.value as typeof evidenceType)} className="w-full rounded-lg border border-wk-border bg-wk-surface px-3 py-2 text-[12px] text-wk-text"><option value="track_metadata">Track Metadata</option><option value="release_metadata">Release Metadata</option><option value="official_documentation">Official Documentation</option><option value="article">Article</option><option value="interview">Interview</option><option value="video">Video</option><option value="artist_metadata">Artist Metadata</option></select></label>
        <label className="block"><span className="mb-1 block text-[11px] font-bold text-wk-text-muted">Source URL</span><input value={sourceUrl} onChange={(event) => setSourceUrl(event.target.value)} placeholder="https://" className="w-full rounded-lg border border-wk-border bg-wk-surface px-3 py-2 text-[12px] text-wk-text" /></label>
        <label className="block sm:col-span-2"><span className="mb-1 block text-[11px] font-bold text-wk-text-muted">What The Source Shows</span><textarea value={summary} onChange={(event) => setSummary(event.target.value)} rows={3} className="w-full resize-y rounded-lg border border-wk-border bg-wk-surface px-3 py-2 text-[12px] text-wk-text" /></label>
        <label className="block sm:col-span-2"><span className="mb-1 block text-[11px] font-bold text-wk-text-muted">Main Claim</span><input value={mainClaim} onChange={(event) => setMainClaim(event.target.value)} placeholder="For example: Both artists appear on the same track." className="w-full rounded-lg border border-wk-border bg-wk-surface px-3 py-2 text-[12px] text-wk-text" /></label>
        <label className="block sm:col-span-2"><span className="mb-1 block text-[11px] font-bold text-wk-text-muted">Why You Trust This Source</span><textarea value={reviewReason} onChange={(event) => setReviewReason(event.target.value)} rows={2} className="w-full resize-y rounded-lg border border-wk-border bg-wk-surface px-3 py-2 text-[12px] text-wk-text" /></label>
      </div>
      <div className="mt-4 flex justify-end gap-2"><button onClick={() => setOpen(false)} disabled={busy} className="rounded-lg border border-wk-border px-3 py-2 text-[12px] font-bold text-wk-text-muted">Cancel</button><button onClick={() => void create()} disabled={busy || !title.trim() || !sourceUrl.trim() || !summary.trim() || !reviewReason.trim()} className="inline-flex items-center gap-2 rounded-lg bg-wk-brand px-3 py-2 text-[12px] font-black text-wk-brand-on disabled:opacity-40">{busy ? <WkIcon name="Loader2" size={14} className="animate-spin" /> : <WkIcon name="Check" size={14} />}Add Evidence</button></div>
    </div>
  );
}