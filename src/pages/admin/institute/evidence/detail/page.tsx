import { FormEvent, useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  InstituteDecisionLog,
  InstituteEvidenceStatePanel,
  InstituteNextMovePanel,
  InstitutePageHeader,
  InstituteSectionCard,
  InstituteUnderstandingPanel,
  InstituteUncertaintyPanel,
  type InstituteActionItem,
  type InstituteBadgeItem,
  type InstituteDecisionItem,
  type InstituteInsightItem,
} from "@/components/admin/institute";
import {
  getEvidenceItem,
  listEvidenceInquiryLinks,
  reviewEvidenceItem,
  updateEvidenceItem,
  type EvidenceItem,
  type EvidenceReviewStatus,
  type EvidenceType,
  type InquiryEvidenceLink,
  type InstituteConfidence,
  type InstituteEvidenceReviewAction,
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

export default function AdminInstituteEvidenceDetailPage() {
  const { evidenceId } = useParams();
  const [item, setItem] = useState<EvidenceItem | null>(null);
  const [inquiryLinks, setInquiryLinks] = useState<InquiryEvidenceLink[]>([]);
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
      const [nextItem, nextInquiryLinks] = await Promise.all([
        getEvidenceItem(evidenceId),
        listEvidenceInquiryLinks(evidenceId),
      ]);

      if (!nextItem) {
        throw new Error("Evidence item not found.");
      }

      setItem(nextItem);
      setInquiryLinks(nextInquiryLinks);
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
      setNotice("Evidence updated with claim discipline.");
      await loadEvidenceItem();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  }

  async function handleReview(decision: InstituteEvidenceReviewAction) {
    if (!evidenceId) return;

    setReviewing(true);
    setError(null);
    setNotice(null);

    try {
      await reviewEvidenceItem({
        evidenceId,
        decision,
        decisionNote: `Evidence Room action: ${humanize(decision)}`,
      });

      setNotice(`Evidence action applied: ${humanize(decision)}.`);
      await loadEvidenceItem();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setReviewing(false);
    }
  }

  const canEnableDefaultUse = item?.review_status === "approved";

  const evidenceStateItems: InstituteInsightItem[] = useMemo(() => {
    if (!item) return [];

    return [
      {
        label: "Where this stands",
        value: humanize(item.review_status),
        description: item.review_status === "approved" ? "This evidence can support stronger claims." : "This evidence still needs care before it carries strong claims.",
        tone: reviewTone(item.review_status),
      },
      {
        label: "Default use",
        value: defaultUseLabel(item.retrieval_status),
        description: item.retrieval_status === "default_retrieval" ? "Future drafting can use this by default." : "This stays limited until review says otherwise.",
        tone: defaultUseTone(item.retrieval_status),
      },
      {
        label: "Used by Inquiries",
        value: inquiryLinks.length,
        description: "Where this evidence is already helping a question.",
        tone: inquiryLinks.length > 0 ? "good" : "warning",
      },
    ];
  }, [item, inquiryLinks.length]);

  const uncertaintyItems: InstituteInsightItem[] = useMemo(() => {
    if (!item) return [];

    return [
      {
        label: "Missing claim",
        value: item.main_claim ? "No" : "Yes",
        description: item.main_claim ? "The evidence names what it can support." : "Name the claim before approval.",
        tone: item.main_claim ? "good" : "warning",
      },
      {
        label: "Needs source context",
        value: item.source_url || item.source_note ? "No" : "Yes",
        description: item.source_url || item.source_note ? "The source has a link or note." : "Add source context before this travels further.",
        tone: item.source_url || item.source_note ? "good" : "warning",
      },
      {
        label: "Public caution",
        value: item.review_status === "approved" ? "Lower" : "High",
        description: item.review_status === "approved" ? "Still use with care." : "Do not let this support public claims yet.",
        tone: item.review_status === "approved" ? "info" : "danger",
      },
    ];
  }, [item]);

  const decisionItems: InstituteDecisionItem[] = item
    ? [
        {
          label: `Review: ${humanize(item.review_status)}`,
          reason: item.reviewed_at ? "A reviewer has acted on this evidence." : "No reviewer has completed this evidence yet.",
          meta: item.reviewed_at ? new Date(item.reviewed_at).toLocaleString() : "waiting",
          tone: reviewTone(item.review_status),
        },
        {
          label: `Default use: ${defaultUseLabel(item.retrieval_status)}`,
          reason: item.retrieval_status === "default_retrieval" ? "This evidence can support future drafting by default." : "This evidence remains limited until it is safe to use by default.",
          tone: defaultUseTone(item.retrieval_status),
        },
      ]
    : [];

  const nextMoves: InstituteActionItem[] = item
    ? [
        ...(!item.main_claim
          ? [{
              label: "Name the claim",
              description: "Evidence cannot discipline a claim until the claim is named.",
              href: "#shape-evidence",
              tone: "warning" as const,
            }]
          : []),
        ...(item.review_status === "unreviewed"
          ? [{
              label: "Review this evidence",
              description: "Decide whether this evidence is reviewed, approved, disputed, or rejected.",
              href: "#review-evidence",
              tone: "warning" as const,
            }]
          : []),
        ...(item.review_status === "approved" && item.retrieval_status !== "default_retrieval"
          ? [{
              label: "Consider default use",
              description: "Only approved evidence should become available for future drafting by default.",
              href: "#review-evidence",
              tone: "info" as const,
            }]
          : []),
        {
          label: "Edit evidence",
          description: "Update the source, claim, confidence, or caution notes.",
          href: "#shape-evidence",
          tone: "neutral",
        },
      ]
    : [];

  if (loading) {
    return <div className="p-6 text-[13px] text-wk-text-muted">Opening evidence...</div>;
  }

  if (!item) {
    return <div className="p-6 text-[13px] text-wk-text-muted">Evidence could not be found.</div>;
  }

  const cannotSayYet = [
    ...(!item.main_claim ? ["This evidence does not yet name the claim it can support."] : []),
    ...(item.review_status !== "approved" ? ["This evidence should not support strong public claims yet."] : []),
    "This evidence does not prove more than its source, summary, and review allow.",
  ];

  return (
    <div className="space-y-6 p-6">
      <InstitutePageHeader
        eyebrow="Evidence Room"
        title={item.title}
        description="Evidence is not storage. It is a discipline for deciding what WAKILISHA can safely say."
        badges={[
          {
            label: `Where this stands: ${humanize(item.review_status)}`,
            description: item.review_status === "approved" ? "The evidence can support stronger claims." : "The evidence still needs care.",
            tone: reviewTone(item.review_status),
          },
          {
            label: `Default use: ${defaultUseLabel(item.retrieval_status)}`,
            description: item.retrieval_status === "default_retrieval" ? "Available for future drafting support." : "Not available by default.",
            tone: defaultUseTone(item.retrieval_status),
          },
          {
            label: `${inquiryLinks.length} Inquiry links`,
            description: "Where this evidence is already being used.",
            tone: inquiryLinks.length > 0 ? "good" : "warning",
          },
        ]}
        actions={[{ label: "Back to Evidence", href: "/admin/institute/evidence" }]}
      />

      {error ? <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-[13px] font-semibold text-red-700">{error}</div> : null}
      {notice ? <div className="rounded-2xl border border-wk-brand/20 bg-wk-brand/10 p-4 text-[13px] font-semibold text-wk-text">{notice}</div> : null}

      <InstituteSectionCard
        eyebrow="Claim discipline"
        title="What claim can this evidence safely support?"
        description="Start by separating the evidence from the claim someone may want to make with it."
      >
        <div className="grid gap-4 lg:grid-cols-[1fr_1fr]">
          <div className="rounded-2xl border border-wk-border bg-wk-bg p-4">
            <div className="text-[11px] font-black uppercase tracking-[0.16em] text-wk-brand">What this supports</div>
            <p className="mt-2 text-[14px] leading-6 text-wk-text-soft">
              {item.main_claim || "No claim has been named yet."}
            </p>
          </div>
          <div className="rounded-2xl border border-wk-border bg-wk-bg p-4">
            <div className="text-[11px] font-black uppercase tracking-[0.16em] text-wk-warning">What this does not prove</div>
            <p className="mt-2 text-[14px] leading-6 text-wk-text-soft">
              Evidence does not prove more than its source, summary, confidence, and human review allow.
            </p>
          </div>
        </div>
      </InstituteSectionCard>

      <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <InstituteUnderstandingPanel
          currentUnderstanding={item.summary}
          safeToSay={item.main_claim ? [item.main_claim] : []}
          cannotSayYet={cannotSayYet}
          confidenceLabel={`${item.confidence} confidence`}
        />
        <InstituteUncertaintyPanel items={uncertaintyItems} />
      </div>

      <InstituteEvidenceStatePanel items={evidenceStateItems} />
      <InstituteDecisionLog decisions={decisionItems} />
      <InstituteNextMovePanel moves={nextMoves} />

      <InstituteSectionCard
        eyebrow="Use map"
        title="Where is this evidence already used?"
        description="Evidence should show the Inquiries it supports so reviewers can see the consequences of changing it."
      >
        {inquiryLinks.length === 0 ? (
          <p className="rounded-2xl border border-wk-border bg-wk-bg p-4 text-[13px] leading-5 text-wk-text-muted">
            This evidence is not linked to an Inquiry yet.
          </p>
        ) : (
          <div className="grid gap-3">
            {inquiryLinks.map((link) => (
              <Link key={`${link.inquiry_id}-${link.evidence_id}`} to={`/admin/institute/inquiries/${link.inquiry_id}`} className="rounded-2xl border border-wk-border bg-wk-bg p-4 transition hover:border-wk-brand/40">
                <div className="text-[11px] font-black uppercase tracking-[0.16em] text-wk-brand">{link.inquiry?.inquiry_number ?? "Inquiry"}</div>
                <h3 className="mt-1 text-[14px] font-black text-wk-text">{link.inquiry?.title ?? link.inquiry_id}</h3>
                {link.use_note ? <p className="mt-2 text-[13px] leading-5 text-wk-text-muted">{link.use_note}</p> : null}
              </Link>
            ))}
          </div>
        )}
      </InstituteSectionCard>

      <InstituteSectionCard
        eyebrow="Review"
        title="Decide what this evidence can carry"
        description="Approval and default use are separate. Default use should only happen after approval."
      >
        <div id="review-evidence" className="flex flex-wrap gap-2">
          <button type="button" disabled={reviewing} onClick={() => handleReview("reviewed")} className="rounded-full border border-wk-border px-3 py-2 text-[12px] font-bold text-wk-text hover:border-wk-brand/40 disabled:opacity-60">Mark reviewed</button>
          <button type="button" disabled={reviewing || !item.main_claim} onClick={() => handleReview("approved")} className="rounded-full bg-wk-brand px-3 py-2 text-[12px] font-bold text-wk-brand-on hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50">Approve</button>
          <button type="button" disabled={reviewing} onClick={() => handleReview("needs_more_evidence")} className="rounded-full border border-wk-border px-3 py-2 text-[12px] font-bold text-wk-text hover:border-wk-brand/40 disabled:opacity-60">Needs stronger source</button>
          <button type="button" disabled={reviewing} onClick={() => handleReview("disputed")} className="rounded-full border border-wk-warning/30 px-3 py-2 text-[12px] font-bold text-wk-warning hover:border-wk-warning disabled:opacity-60">Dispute</button>
          <button type="button" disabled={reviewing} onClick={() => handleReview("rejected")} className="rounded-full border border-red-200 px-3 py-2 text-[12px] font-bold text-red-700 hover:border-red-400 disabled:opacity-60">Reject</button>
          <button type="button" disabled={reviewing || !canEnableDefaultUse} onClick={() => handleReview("retrieval_enabled")} className="rounded-full border border-wk-border px-3 py-2 text-[12px] font-bold text-wk-text hover:border-wk-brand/40 disabled:cursor-not-allowed disabled:opacity-50">Allow default use</button>
          <button type="button" disabled={reviewing} onClick={() => handleReview("retrieval_disabled")} className="rounded-full border border-wk-border px-3 py-2 text-[12px] font-bold text-wk-text hover:border-wk-brand/40 disabled:opacity-60">Remove default use</button>
        </div>
      </InstituteSectionCard>

      <InstituteSectionCard
        eyebrow="Shape evidence"
        title="Edit the source and claim"
        description="Use this when the source, summary, claim, confidence, or caution changes."
      >
        <form id="shape-evidence" onSubmit={handleSave} className="grid gap-4">
          <div className="grid gap-4 lg:grid-cols-[1fr_220px_180px_180px]">
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
              Where this stands
              <select value={reviewStatus} onChange={(event) => setReviewStatus(event.target.value as EvidenceReviewStatus)} className="rounded-2xl border border-wk-border bg-wk-bg px-3 py-2 text-[13px] text-wk-text">
                {REVIEW_STATUSES.map((status) => <option key={status} value={status}>{humanize(status)}</option>)}
              </select>
            </label>
            <label className="grid gap-1 text-[12px] font-bold text-wk-text-muted">
              Default use
              <select value={retrievalStatus} onChange={(event) => setRetrievalStatus(event.target.value as RetrievalStatus)} className="rounded-2xl border border-wk-border bg-wk-bg px-3 py-2 text-[13px] text-wk-text">
                {RETRIEVAL_STATUSES.map((status) => <option key={status} value={status}>{defaultUseLabel(status)}</option>)}
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
              {saving ? "Saving..." : "Save evidence"}
            </button>
          </div>
        </form>
      </InstituteSectionCard>
    </div>
  );
}
