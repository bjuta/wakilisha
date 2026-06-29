import { FormEvent, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  createEvidenceItem,
  linkEvidenceToInquiry,
  listEvidenceItems,
  listInquiries,
  type EvidenceItem,
  type EvidenceReviewStatus,
  type EvidenceType,
  type InstituteConfidence,
  type Inquiry,
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

export default function AdminInstituteEvidencePage() {
  const [items, setItems] = useState<EvidenceItem[]>([]);
  const [inquiries, setInquiries] = useState<Inquiry[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const [search, setSearch] = useState("");
  const [reviewStatus, setReviewStatus] = useState("");
  const [retrievalStatus, setRetrievalStatus] = useState("");

  const [title, setTitle] = useState("");
  const [evidenceType, setEvidenceType] = useState<EvidenceType>("internal_memory");
  const [summary, setSummary] = useState("");
  const [sourceUrl, setSourceUrl] = useState("");
  const [sourceNote, setSourceNote] = useState("");
  const [mainClaim, setMainClaim] = useState("");
  const [whyItMatters, setWhyItMatters] = useState("");
  const [reliability, setReliability] = useState<InstituteConfidence>("medium");
  const [confidence, setConfidence] = useState<InstituteConfidence>("medium");
  const [inquiryId, setInquiryId] = useState("");

  async function loadEvidence() {
    setLoading(true);
    setError(null);

    try {
      const [nextItems, nextInquiries] = await Promise.all([
        listEvidenceItems({
          search: search || undefined,
          reviewStatus: reviewStatus || undefined,
          retrievalStatus: retrievalStatus || undefined,
          limit: 100,
        }),
        listInquiries(),
      ]);

      setItems(nextItems);
      setInquiries(nextInquiries);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadEvidence();
  }, []);

  async function handleCreateEvidence(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    setNotice(null);

    try {
      const created = await createEvidenceItem({
        title: title.trim(),
        evidence_type: evidenceType,
        summary: summary.trim(),
        source_url: sourceUrl.trim() || null,
        source_note: sourceNote.trim() || null,
        main_claim: mainClaim.trim() || null,
        why_it_matters: whyItMatters.trim() || null,
        reliability,
        confidence,
        review_status: "unreviewed",
        retrieval_status: "review_only",
      });

      if (inquiryId) {
        await linkEvidenceToInquiry({
          inquiry_id: inquiryId,
          evidence_id: created.id,
          use_note: "Created from Evidence Locker.",
        });
      }

      setTitle("");
      setSummary("");
      setSourceUrl("");
      setSourceNote("");
      setMainClaim("");
      setWhyItMatters("");
      setInquiryId("");
      setNotice("Evidence created.");
      await loadEvidence();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6 p-6">
      <header className="rounded-3xl border border-wk-border bg-wk-surface p-6 shadow-sm">
        <div className="text-[12px] font-bold uppercase tracking-[0.2em] text-wk-brand">Evidence Locker</div>
        <div className="mt-3 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h1 className="text-3xl font-black tracking-tight text-wk-text">Evidence</h1>
            <p className="mt-2 max-w-3xl text-[14px] leading-6 text-wk-text-muted">
              Store evidence before it becomes retrieval memory. Unreviewed evidence stays out of default retrieval.
            </p>
          </div>
          <Link to="/admin/institute" className="rounded-full border border-wk-border px-4 py-2 text-[13px] font-bold text-wk-text hover:border-wk-brand/40">
            Back to Institute
          </Link>
        </div>
      </header>

      {error ? <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-[13px] font-semibold text-red-700">{error}</div> : null}
      {notice ? <div className="rounded-2xl border border-wk-brand/20 bg-wk-brand/10 p-4 text-[13px] font-semibold text-wk-text">{notice}</div> : null}

      <section className="rounded-3xl border border-wk-border bg-wk-surface p-5 shadow-sm">
        <h2 className="text-lg font-black text-wk-text">Create evidence</h2>
        <form onSubmit={handleCreateEvidence} className="mt-4 grid gap-4">
          <div className="grid gap-4 lg:grid-cols-[1fr_220px_220px]">
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
              Link to Inquiry
              <select value={inquiryId} onChange={(event) => setInquiryId(event.target.value)} className="rounded-2xl border border-wk-border bg-wk-bg px-3 py-2 text-[13px] text-wk-text">
                <option value="">No Inquiry link</option>
                {inquiries.map((inquiry) => <option key={inquiry.id} value={inquiry.id}>{inquiry.inquiry_number} · {inquiry.title}</option>)}
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
              <textarea value={mainClaim} onChange={(event) => setMainClaim(event.target.value)} rows={2} className="rounded-2xl border border-wk-border bg-wk-bg px-3 py-2 text-[13px] text-wk-text" />
            </label>
            <label className="grid gap-1 text-[12px] font-bold text-wk-text-muted">
              Why it matters
              <textarea value={whyItMatters} onChange={(event) => setWhyItMatters(event.target.value)} rows={2} className="rounded-2xl border border-wk-border bg-wk-bg px-3 py-2 text-[13px] text-wk-text" />
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
              {saving ? "Creating…" : "Create evidence"}
            </button>
          </div>
        </form>
      </section>

      <section className="rounded-3xl border border-wk-border bg-wk-surface p-5 shadow-sm">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h2 className="text-lg font-black text-wk-text">Locker</h2>
            <p className="mt-1 text-[13px] text-wk-text-muted">Review status and retrieval status stay separate.</p>
          </div>
          <div className="grid gap-2 lg:grid-cols-[220px_180px_180px_auto]">
            <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search title" className="rounded-2xl border border-wk-border bg-wk-bg px-3 py-2 text-[13px] text-wk-text" />
            <select value={reviewStatus} onChange={(event) => setReviewStatus(event.target.value)} className="rounded-2xl border border-wk-border bg-wk-bg px-3 py-2 text-[13px] text-wk-text">
              <option value="">Any review</option>
              {REVIEW_STATUSES.map((status) => <option key={status} value={status}>{label(status)}</option>)}
            </select>
            <select value={retrievalStatus} onChange={(event) => setRetrievalStatus(event.target.value)} className="rounded-2xl border border-wk-border bg-wk-bg px-3 py-2 text-[13px] text-wk-text">
              <option value="">Any retrieval</option>
              {RETRIEVAL_STATUSES.map((status) => <option key={status} value={status}>{label(status)}</option>)}
            </select>
            <button type="button" onClick={loadEvidence} className="rounded-full border border-wk-border px-3 py-2 text-[12px] font-bold text-wk-text hover:border-wk-brand/40">Filter</button>
          </div>
        </div>

        {loading ? (
          <p className="mt-4 text-[13px] text-wk-text-muted">Loading evidence…</p>
        ) : items.length === 0 ? (
          <p className="mt-4 text-[13px] text-wk-text-muted">No evidence found.</p>
        ) : (
          <div className="mt-4 divide-y divide-wk-border">
            {items.map((item) => (
              <Link key={item.id} to={`/admin/institute/evidence/${item.id}`} className="block py-4 hover:bg-wk-bg/60">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                  <div>
                    <div className="text-[12px] font-bold uppercase tracking-[0.16em] text-wk-brand">{label(item.evidence_type)}</div>
                    <h3 className="mt-1 text-[16px] font-black text-wk-text">{item.title}</h3>
                    <p className="mt-1 line-clamp-2 text-[13px] leading-5 text-wk-text-muted">{item.summary}</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <span className="rounded-full border border-wk-border px-2.5 py-1 text-[11px] font-bold text-wk-text-muted">{label(item.review_status)}</span>
                    <span className="rounded-full border border-wk-border px-2.5 py-1 text-[11px] font-bold text-wk-text-muted">{label(item.retrieval_status)}</span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
