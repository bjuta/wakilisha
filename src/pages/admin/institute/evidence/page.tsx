import { FormEvent, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  InstituteEvidenceStatePanel,
  InstituteNextMovePanel,
  InstitutePageHeader,
  InstituteSectionCard,
  InstituteUncertaintyPanel,
  type InstituteActionItem,
  type InstituteBadgeItem,
  type InstituteInsightItem,
} from "@/components/admin/institute";
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

function humanize(value: string) {
  return value.replaceAll("_", " ");
}

function reviewTone(status: EvidenceReviewStatus): InstituteBadgeItem["tone"] {
  if (status === "approved") return "good";
  if (status === "disputed" || status === "rejected") return "danger";
  if (status === "unreviewed") return "warning";
  return "info";
}

function defaultUseLabel(status: RetrievalStatus) {
  if (status === "default_retrieval") return "ready for default use";
  if (status === "review_only") return "review only";
  return "excluded";
}

function defaultUseTone(status: RetrievalStatus): InstituteBadgeItem["tone"] {
  if (status === "default_retrieval") return "good";
  if (status === "review_only") return "info";
  return "neutral";
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
          use_note: "Created from Evidence Room.",
        });
      }

      setTitle("");
      setSummary("");
      setSourceUrl("");
      setSourceNote("");
      setMainClaim("");
      setWhyItMatters("");
      setInquiryId("");
      setNotice("Evidence entered the room for review.");
      await loadEvidence();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  }

  const evidenceStateItems: InstituteInsightItem[] = useMemo(() => [
    {
      label: "In the room",
      value: items.length,
      description: "Evidence records currently visible under this filter.",
      tone: "info",
    },
    {
      label: "Approved",
      value: items.filter((item) => item.review_status === "approved").length,
      description: "Evidence that can safely support stronger claims.",
      tone: "good",
    },
    {
      label: "Ready for default use",
      value: items.filter((item) => item.retrieval_status === "default_retrieval").length,
      description: "Approved memory available for future drafting support.",
      tone: "good",
    },
  ], [items]);

  const pressureItems: InstituteInsightItem[] = useMemo(() => [
    {
      label: "Needs first read",
      value: items.filter((item) => item.review_status === "unreviewed").length,
      description: "Evidence that has entered the room but has not been reviewed.",
      tone: "warning",
    },
    {
      label: "Disputed",
      value: items.filter((item) => item.review_status === "disputed").length,
      description: "Evidence that should not support strong claims yet.",
      tone: "danger",
    },
    {
      label: "Missing claim",
      value: items.filter((item) => !item.main_claim).length,
      description: "Evidence that has not named what it supports.",
      tone: "warning",
    },
  ], [items]);

  const nextMoves: InstituteActionItem[] = [
    {
      label: "Add evidence",
      description: "Enter a source, memory, test, or correction and name the claim it can support.",
      href: "#add-evidence",
      tone: "neutral",
    },
    ...(items.some((item) => item.review_status === "unreviewed")
      ? [{
          label: "Review new evidence",
          description: "Open unreviewed evidence and decide what it can safely carry.",
          href: "#evidence-trail",
          tone: "warning" as const,
        }]
      : []),
    ...(items.some((item) => !item.main_claim)
      ? [{
          label: "Name missing claims",
          description: "Evidence without a claim can become storage instead of discipline.",
          href: "#evidence-trail",
          tone: "warning" as const,
        }]
      : []),
  ];

  return (
    <div className="space-y-6 p-6">
      <InstitutePageHeader
        eyebrow="Evidence Room"
        title="Evidence"
        description="Discipline claims before they become memory. Evidence should make overclaiming harder, not easier."
        badges={[
          {
            label: `${items.length} in view`,
            description: "Evidence visible under the current filters.",
            tone: "info",
          },
          {
            label: `${items.filter((item) => item.review_status === "approved").length} approved`,
            description: "Evidence that can support stronger claims.",
            tone: "good",
          },
          {
            label: `${items.filter((item) => item.retrieval_status === "default_retrieval").length} ready for default use`,
            description: "Approved memory that can support future drafting safely.",
            tone: "good",
          },
        ]}
        actions={[{ label: "Back to Institute", href: "/admin/institute" }]}
      />

      {error ? <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-[13px] font-semibold text-red-700">{error}</div> : null}
      {notice ? <div className="rounded-2xl border border-wk-brand/20 bg-wk-brand/10 p-4 text-[13px] font-semibold text-wk-text">{notice}</div> : null}

      <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <InstituteEvidenceStatePanel items={evidenceStateItems} />
        <InstituteUncertaintyPanel items={pressureItems} />
      </div>

      <InstituteNextMovePanel moves={nextMoves} />

      <InstituteSectionCard
        eyebrow="Claim discipline"
        title="What claim can this evidence safely support?"
        description="Add evidence by naming the source, the claim it can support, and what WAKILISHA must be careful not to overstate."
      >
        <form id="add-evidence" onSubmit={handleCreateEvidence} className="grid gap-4">
          <div className="grid gap-4 lg:grid-cols-[1fr_220px_220px]">
            <label className="grid gap-1 text-[12px] font-bold text-wk-text-muted">
              Evidence title
              <input value={title} onChange={(event) => setTitle(event.target.value)} required className="rounded-2xl border border-wk-border bg-wk-bg px-3 py-2 text-[13px] text-wk-text" />
            </label>
            <label className="grid gap-1 text-[12px] font-bold text-wk-text-muted">
              Kind of evidence
              <select value={evidenceType} onChange={(event) => setEvidenceType(event.target.value as EvidenceType)} className="rounded-2xl border border-wk-border bg-wk-bg px-3 py-2 text-[13px] text-wk-text">
                {EVIDENCE_TYPES.map((type) => <option key={type} value={type}>{humanize(type)}</option>)}
              </select>
            </label>
            <label className="grid gap-1 text-[12px] font-bold text-wk-text-muted">
              Connect to an Inquiry
              <select value={inquiryId} onChange={(event) => setInquiryId(event.target.value)} className="rounded-2xl border border-wk-border bg-wk-bg px-3 py-2 text-[13px] text-wk-text">
                <option value="">No Inquiry link yet</option>
                {inquiries.map((inquiry) => <option key={inquiry.id} value={inquiry.id}>{inquiry.inquiry_number} · {inquiry.title}</option>)}
              </select>
            </label>
          </div>

          <label className="grid gap-1 text-[12px] font-bold text-wk-text-muted">
            What the evidence says
            <textarea value={summary} onChange={(event) => setSummary(event.target.value)} required rows={3} className="rounded-2xl border border-wk-border bg-wk-bg px-3 py-2 text-[13px] text-wk-text" />
          </label>

          <div className="grid gap-4 lg:grid-cols-2">
            <label className="grid gap-1 text-[12px] font-bold text-wk-text-muted">
              What this supports
              <textarea value={mainClaim} onChange={(event) => setMainClaim(event.target.value)} rows={3} className="rounded-2xl border border-wk-border bg-wk-bg px-3 py-2 text-[13px] text-wk-text" />
            </label>
            <label className="grid gap-1 text-[12px] font-bold text-wk-text-muted">
              Why it matters
              <textarea value={whyItMatters} onChange={(event) => setWhyItMatters(event.target.value)} rows={3} className="rounded-2xl border border-wk-border bg-wk-bg px-3 py-2 text-[13px] text-wk-text" />
            </label>
          </div>

          <div className="grid gap-4 lg:grid-cols-[1fr_1fr_180px_180px]">
            <label className="grid gap-1 text-[12px] font-bold text-wk-text-muted">
              Source link
              <input value={sourceUrl} onChange={(event) => setSourceUrl(event.target.value)} className="rounded-2xl border border-wk-border bg-wk-bg px-3 py-2 text-[13px] text-wk-text" />
            </label>
            <label className="grid gap-1 text-[12px] font-bold text-wk-text-muted">
              Source note
              <input value={sourceNote} onChange={(event) => setSourceNote(event.target.value)} className="rounded-2xl border border-wk-border bg-wk-bg px-3 py-2 text-[13px] text-wk-text" />
            </label>
            <label className="grid gap-1 text-[12px] font-bold text-wk-text-muted">
              Source strength
              <select value={reliability} onChange={(event) => setReliability(event.target.value as InstituteConfidence)} className="rounded-2xl border border-wk-border bg-wk-bg px-3 py-2 text-[13px] text-wk-text">
                {CONFIDENCE_OPTIONS.map((option) => <option key={option} value={option}>{option}</option>)}
              </select>
            </label>
            <label className="grid gap-1 text-[12px] font-bold text-wk-text-muted">
              Claim confidence
              <select value={confidence} onChange={(event) => setConfidence(event.target.value as InstituteConfidence)} className="rounded-2xl border border-wk-border bg-wk-bg px-3 py-2 text-[13px] text-wk-text">
                {CONFIDENCE_OPTIONS.map((option) => <option key={option} value={option}>{option}</option>)}
              </select>
            </label>
          </div>

          <div>
            <button type="submit" disabled={saving} className="rounded-full bg-wk-brand px-4 py-2 text-[13px] font-bold text-wk-brand-on hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60">
              {saving ? "Adding..." : "Add evidence"}
            </button>
          </div>
        </form>
      </InstituteSectionCard>

      <InstituteSectionCard
        eyebrow="Evidence trail"
        title="What evidence is waiting for judgment?"
        description="Human review and default-use readiness stay separate. Approved evidence can support stronger claims. Unreviewed evidence stays careful."
      >
        <div id="evidence-trail" className="grid gap-4 lg:grid-cols-[220px_180px_180px_auto]">
          <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search title" className="rounded-2xl border border-wk-border bg-wk-bg px-3 py-2 text-[13px] text-wk-text" />
          <select value={reviewStatus} onChange={(event) => setReviewStatus(event.target.value)} className="rounded-2xl border border-wk-border bg-wk-bg px-3 py-2 text-[13px] text-wk-text">
            <option value="">Any review state</option>
            {REVIEW_STATUSES.map((status) => <option key={status} value={status}>{humanize(status)}</option>)}
          </select>
          <select value={retrievalStatus} onChange={(event) => setRetrievalStatus(event.target.value)} className="rounded-2xl border border-wk-border bg-wk-bg px-3 py-2 text-[13px] text-wk-text">
            <option value="">Any default-use state</option>
            {RETRIEVAL_STATUSES.map((status) => <option key={status} value={status}>{defaultUseLabel(status)}</option>)}
          </select>
          <button type="button" onClick={loadEvidence} className="rounded-full border border-wk-border px-3 py-2 text-[12px] font-bold text-wk-text hover:border-wk-brand/40">Filter</button>
        </div>

        {loading ? (
          <p className="mt-4 text-[13px] text-wk-text-muted">Loading evidence...</p>
        ) : items.length === 0 ? (
          <p className="mt-4 rounded-2xl border border-wk-border bg-wk-bg p-4 text-[13px] leading-5 text-wk-text-muted">
            Nothing has entered the Evidence Room under this filter yet.
          </p>
        ) : (
          <div className="mt-5 grid gap-4">
            {items.map((item) => (
              <Link key={item.id} to={`/admin/institute/evidence/${item.id}`} className="block rounded-3xl border border-wk-border bg-wk-bg p-4 transition hover:border-wk-brand/40">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div className="min-w-0">
                    <div className="text-[11px] font-black uppercase tracking-[0.16em] text-wk-brand">{humanize(item.evidence_type)}</div>
                    <h3 className="mt-1 text-[17px] font-black text-wk-text">{item.title}</h3>
                    <p className="mt-2 line-clamp-2 text-[13px] leading-5 text-wk-text-muted">{item.summary}</p>
                    {item.main_claim ? (
                      <p className="mt-3 rounded-2xl border border-wk-border bg-wk-surface p-3 text-[13px] leading-5 text-wk-text-soft">
                        <span className="font-bold text-wk-text">Supports: </span>{item.main_claim}
                      </p>
                    ) : (
                      <p className="mt-3 rounded-2xl border border-wk-warning/30 bg-wk-warning-soft p-3 text-[13px] leading-5 text-wk-warning">
                        This evidence still needs a named claim.
                      </p>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-2 lg:max-w-xs lg:justify-end">
                    <span className={`rounded-full border px-2.5 py-1 text-[11px] font-bold ${reviewTone(item.review_status) === "good" ? "border-wk-success/30 bg-wk-success-soft text-wk-success" : reviewTone(item.review_status) === "danger" ? "border-wk-danger/30 bg-wk-danger-soft text-wk-danger" : reviewTone(item.review_status) === "warning" ? "border-wk-warning/30 bg-wk-warning-soft text-wk-warning" : "border-wk-info/30 bg-wk-info-soft text-wk-info"}`}>
                      {humanize(item.review_status)}
                    </span>
                    <span className={`rounded-full border px-2.5 py-1 text-[11px] font-bold ${defaultUseTone(item.retrieval_status) === "good" ? "border-wk-success/30 bg-wk-success-soft text-wk-success" : defaultUseTone(item.retrieval_status) === "info" ? "border-wk-info/30 bg-wk-info-soft text-wk-info" : "border-wk-border bg-wk-surface text-wk-text-muted"}`}>
                      {defaultUseLabel(item.retrieval_status)}
                    </span>
                    <span className="rounded-full border border-wk-border px-2.5 py-1 text-[11px] font-bold text-wk-text-muted">{item.confidence} confidence</span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </InstituteSectionCard>
    </div>
  );
}
