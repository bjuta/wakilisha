import { FormEvent, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  getEvidenceItem,
  reviewEvidenceItem,
  updateEvidenceItem,
  type EvidenceItem,
  type EvidenceReviewStatus,
  type EvidenceType,
  type InstituteConfidence,
  type RetrievalStatus,
} from "@/services/institute";

const EVIDENCE_TYPES: EvidenceType[] = [
  "internal_memory",
  "book_reference",
  "field_note",
  "article",
  "official_documentation",
  "academic_paper",
  "chart_record",
  "release_metadata",
  "track_metadata",
  "artist_metadata",
  "contributor_memory",
  "correction",
  "interview",
  "video",
  "screenshot",
  "product_test",
  "technical_test",
];

const REVIEW_STATUSES: EvidenceReviewStatus[] = ["unreviewed", "reviewed", "approved", "disputed", "rejected"];
const RETRIEVAL_STATUSES: RetrievalStatus[] = ["excluded", "review_only", "default_retrieval"];
const CONFIDENCE_OPTIONS: InstituteConfidence[] = ["low", "medium", "high"];

function label(value: string) {
  return value.replaceAll("_", " ");
}

export default function AdminInstituteEvidenceDetailPage() {
  const { evidenceId } = useParams();
  const [item, setItem] = useState<EvidenceItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [reviewing, setReviewing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const [title, setTitle] = useState("");
  const [evidenceType, setEvidenceType] = useState<EvidenceType>("internal_memory");
  const [summary, setSummary] = useState("");
  const [sourceUrl, setSourceUrl] = useState("");
  const [sourceNote, setSourceNote] = useState("");
  const [mainClaim, setMainClaim] = useState("");
  const [whyItMatters, setWhyItMatters] = useState("");
  const [reliability, setReliability] = useState<InstituteConfidence>("medium");
  const [confidence, setConfidence] = useState<InstituteConfidence>("medium");
  const [reviewStatus, setReviewStatus] = useState<EvidenceReviewStatus>("unreviewed");
  const [retrievalStatus, setRetrievalStatus] = useState<RetrievalStatus>("review_only");

  async function loadEvidenceItem() {
    if (!evidenceId) return;

    setLoading(true);
    setError(null);

    try {
      const nextItem = await getEvidenceItem(evidenceId);

      if (!nextItem) {
        throw new Error("Evidence item not found.");
      }

      setItem(nextItem);
      setTitle(nextItem.title);
      setEvidenceType(nextItem.evidence_type);
      setSummary(nextItem.summary);
      setSourceUrl(nextItem.source_url ?? "");
      setSourceNote(nextItem.source_note ?? "");
      setMainClaim(nextItem.main_claim ?? "");
      setWhyItMatters(nextItem.why_it_matters ?? "");
      setReliability(nextItem.reliability);
      setConfidence(nextItem.confidence);
      setReviewStatus(nextItem.review_status);
      setRetrievalStatus(nextItem.retrieval_status);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadEvidenceItem();
  }, [evidenceId]);

  async function handleSave(event: FormEvent) {
    event.preventDefault();
    if (!evidenceId) return;

    setSaving(true);
    setError(null);
    setNotice(null);

    try {
      const updated = await updateEvidenceItem(evidenceId, {
        title: title.trim(),
        evidence_type: evidenceType,
        summary: summary.trim(),
        source_url: sourceUrl.trim() || null,
        source_note: sourceNote.trim() || null,
        main_claim: mainClaim.trim() || null,
        why_it_matters: whyItMatters.trim() || null,
        reliability,
        confidence,
        review_status: reviewStatus,
        retrieval_status: retrievalStatus,
      });

      setItem(updated);
      setNotice("Evidence updated.");
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  }

  async function handleReview(decision: Parameters<typeof reviewEvidenceItem>[0]["decision"]) {
    if (!evidenceId) return;

    setReviewing(true);
    setError(null);
    setNotice(null);

    try {
      await reviewEvidenceItem({
        evidenceId,
        decision,
        decisionNote: `Evidence Locker action: ${decision.replaceAll("_", " ")}`,
      });

      setNotice(`Evidence action applied: ${label(decision)}.`);
      await loadEvidenceItem();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setReviewing(false);
    }
  }

  if (loading) {
    return <div className="p-6 text-[13px] text-wk-text-muted">Loading evidence…</div>;
  }

  if (!item) {
    return <div className="p-6 text-[13px] text-wk-text-muted">Evidence not found.</div>;
  }

  const canEnableRetrieval = item.review_status === "reviewed" || item.review_status === "approved";

  return (
    <div className="space-y-6 p-6">
      <header className="rounded-3xl border border-wk-border bg-wk-surface p-6 shadow-sm">
        <div className="text-[12px] font-bold uppercase tracking-[0.2em] text-wk-brand">Evidence Locker</div>
        <div className="mt-3 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h1 className="text-3xl font-black tracking-tight text-wk-text">{item.title}</h1>
            <p className="mt-2 max-w-3xl text-[14px] leading-6 text-wk-text-muted">{item.summary}</p>
          </div>
          <Link to="/admin/institute/evidence" className="rounded-full border border-wk-border px-4 py-2 text-[13px] font-bold text-wk-text hover:border-wk-brand/40">
            Back to Evidence
          </Link>
        </div>
      </header>

      {error ? <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-[13px] font-semibold text-red-700">{error}</div> : null}
      {notice ? <div className="rounded-2xl border border-wk-brand/20 bg-wk-brand/10 p-4 text-[13px] font-semibold text-wk-text">{notice}</div> : null}

      <section className="rounded-3xl border border-wk-border bg-wk-surface p-5 shadow-sm">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <h2 className="text-lg font-black text-wk-text">Review and retrieval</h2>
            <p className="mt-1 text-[13px] text-wk-text-muted">Retrieval can only be enabled after review.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" disabled={reviewing} onClick={() => handleReview("reviewed")} className="rounded-full border border-wk-border px-3 py-2 text-[12px] font-bold text-wk-text hover:border-wk-brand/40 disabled:opacity-60">Mark reviewed</button>
            <button type="button" disabled={reviewing} onClick={() => handleReview("approved")} className="rounded-full bg-wk-brand px-3 py-2 text-[12px] font-bold text-wk-brand-on hover:opacity-90 disabled:opacity-60">Approve</button>
            <button type="button" disabled={reviewing} onClick={() => handleReview("needs_more_evidence")} className="rounded-full border border-wk-border px-3 py-2 text-[12px] font-bold text-wk-text hover:border-wk-brand/40 disabled:opacity-60">Needs evidence</button>
            <button type="button" disabled={reviewing} onClick={() => handleReview("rejected")} className="rounded-full border border-red-200 px-3 py-2 text-[12px] font-bold text-red-700 hover:border-red-400 disabled:opacity-60">Reject</button>
            <button type="button" disabled={reviewing || !canEnableRetrieval} onClick={() => handleReview("retrieval_enabled")} className="rounded-full border border-wk-border px-3 py-2 text-[12px] font-bold text-wk-text hover:border-wk-brand/40 disabled:cursor-not-allowed disabled:opacity-50">Enable retrieval</button>
            <button type="button" disabled={reviewing} onClick={() => handleReview("retrieval_disabled")} className="rounded-full border border-wk-border px-3 py-2 text-[12px] font-bold text-wk-text hover:border-wk-brand/40 disabled:opacity-60">Disable retrieval</button>
          </div>
        </div>
      </section>

      <section className="rounded-3xl border border-wk-border bg-wk-surface p-5 shadow-sm">
        <h2 className="text-lg font-black text-wk-text">Evidence detail</h2>
        <form onSubmit={handleSave} className="mt-4 grid gap-4">
          <div className="grid gap-4 lg:grid-cols-[1fr_220px_180px_180px]">
            <label className="grid gap-1 text-[12px] font-bold text-wk-text-muted">
              Title
              <input value={title} onChange={(event) => setTitle(event.target.value)} required className="rounded-2xl border border-wk-border bg-wk-bg px-3 py-2 text-[13px] text-wk-text" />
            </label>
            <label className="grid gap-1 text-[12px] font-bold text-wk-text-muted">
              Type
              <select value={evidenceType} onChange={(event) => setEvidenceType(event.target.value as EvidenceType)} className="rounded-2xl border border-wk-border bg-wk-bg px-3 py-2 text-[13px] text-wk-text">
                {EVIDENCE_TYPES.map((type) => <option key={type} value={type}>{label(type)}</option>)}
              </select>
            </label>
            <label className="grid gap-1 text-[12px] font-bold text-wk-text-muted">
              Review
              <select value={reviewStatus} onChange={(event) => setReviewStatus(event.target.value as EvidenceReviewStatus)} className="rounded-2xl border border-wk-border bg-wk-bg px-3 py-2 text-[13px] text-wk-text">
                {REVIEW_STATUSES.map((status) => <option key={status} value={status}>{label(status)}</option>)}
              </select>
            </label>
            <label className="grid gap-1 text-[12px] font-bold text-wk-text-muted">
              Retrieval
              <select value={retrievalStatus} onChange={(event) => setRetrievalStatus(event.target.value as RetrievalStatus)} className="rounded-2xl border border-wk-border bg-wk-bg px-3 py-2 text-[13px] text-wk-text">
                {RETRIEVAL_STATUSES.map((status) => <option key={status} value={status}>{label(status)}</option>)}
              </select>
            </label>
          </div>

          <label className="grid gap-1 text-[12px] font-bold text-wk-text-muted">
            Summary
            <textarea value={summary} onChange={(event) => setSummary(event.target.value)} required rows={3} className="rounded-2xl border border-wk-border bg-wk-bg px-3 py-2 text-[13px] text-wk-text" />
          </label>

          <div className="grid gap-4 lg:grid-cols-2">
            <label className="grid gap-1 text-[12px] font-bold text-wk-text-muted">
              Main claim
              <textarea value={mainClaim} onChange={(event) => setMainClaim(event.target.value)} rows={3} className="rounded-2xl border border-wk-border bg-wk-bg px-3 py-2 text-[13px] text-wk-text" />
            </label>
            <label className="grid gap-1 text-[12px] font-bold text-wk-text-muted">
              Why it matters
              <textarea value={whyItMatters} onChange={(event) => setWhyItMatters(event.target.value)} rows={3} className="rounded-2xl border border-wk-border bg-wk-bg px-3 py-2 text-[13px] text-wk-text" />
            </label>
          </div>

          <div className="grid gap-4 lg:grid-cols-[1fr_1fr_180px_180px]">
            <label className="grid gap-1 text-[12px] font-bold text-wk-text-muted">
              Source URL
              <input value={sourceUrl} onChange={(event) => setSourceUrl(event.target.value)} className="rounded-2xl border border-wk-border bg-wk-bg px-3 py-2 text-[13px] text-wk-text" />
            </label>
            <label className="grid gap-1 text-[12px] font-bold text-wk-text-muted">
              Source note
              <input value={sourceNote} onChange={(event) => setSourceNote(event.target.value)} className="rounded-2xl border border-wk-border bg-wk-bg px-3 py-2 text-[13px] text-wk-text" />
            </label>
            <label className="grid gap-1 text-[12px] font-bold text-wk-text-muted">
              Reliability
              <select value={reliability} onChange={(event) => setReliability(event.target.value as InstituteConfidence)} className="rounded-2xl border border-wk-border bg-wk-bg px-3 py-2 text-[13px] text-wk-text">
                {CONFIDENCE_OPTIONS.map((option) => <option key={option} value={option}>{option}</option>)}
              </select>
            </label>
            <label className="grid gap-1 text-[12px] font-bold text-wk-text-muted">
              Confidence
              <select value={confidence} onChange={(event) => setConfidence(event.target.value as InstituteConfidence)} className="rounded-2xl border border-wk-border bg-wk-bg px-3 py-2 text-[13px] text-wk-text">
                {CONFIDENCE_OPTIONS.map((option) => <option key={option} value={option}>{option}</option>)}
              </select>
            </label>
          </div>

          <div>
            <button type="submit" disabled={saving} className="rounded-full bg-wk-brand px-4 py-2 text-[13px] font-bold text-wk-brand-on hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60">
              {saving ? "Saving…" : "Save evidence"}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}
