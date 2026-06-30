import { FormEvent, useEffect, useMemo, useState } from "react";
import {
  InstituteContributionStatePanel,
  InstituteDecisionLog,
  InstituteNextMovePanel,
  InstitutePageHeader,
  InstituteSectionCard,
  InstituteUncertaintyPanel,
  type InstituteActionItem,
  type InstituteBadgeItem,
  type InstituteDecisionItem,
  type InstituteInsightItem,
} from "@/components/admin/institute";
import {
  acceptContributorSubmissionAsEvidence,
  acceptContributorSubmissionAsMemory,
  createContributor,
  createContributorSubmission,
  listContributorSubmissions,
  listContributors,
  listInquiries,
  reviewContributorSubmission,
  type Contributor,
  type ContributorConsentStatus,
  type ContributorSubmission,
  type ContributorSubmissionReviewStatus,
  type ContributorSubmissionType,
  type ContributorTrustLevel,
  type Inquiry,
} from "@/services/institute";

const SUBMISSION_TYPES: ContributorSubmissionType[] = ["memory", "evidence", "relationship_suggestion", "correction", "context_note"];
const CONSENT_STATUSES: ContributorConsentStatus[] = ["private", "internal_use", "public_review_allowed"];
const REVIEW_STATUSES: ContributorSubmissionReviewStatus[] = [
  "submitted",
  "triaged",
  "needs_source",
  "needs_clarification",
  "accepted_as_memory",
  "accepted_as_evidence",
  "accepted_as_relationship_context",
  "rejected",
  "merged",
  "archived",
];

const TRUST_LEVELS: ContributorTrustLevel[] = ["new", "known", "trusted"];

function humanize(value: string) {
  return value.replaceAll("_", " ");
}

function reviewTone(status: ContributorSubmissionReviewStatus): InstituteBadgeItem["tone"] {
  if (status === "accepted_as_memory" || status === "accepted_as_evidence" || status === "accepted_as_relationship_context" || status === "merged") return "good";
  if (status === "needs_source" || status === "needs_clarification") return "warning";
  if (status === "rejected") return "danger";
  if (status === "submitted") return "warning";
  return "info";
}

function consentTone(status: ContributorConsentStatus): InstituteBadgeItem["tone"] {
  if (status === "public_review_allowed") return "good";
  if (status === "internal_use") return "info";
  return "warning";
}

function consentLabel(status: ContributorConsentStatus) {
  if (status === "public_review_allowed") return "public review allowed";
  if (status === "internal_use") return "internal use only";
  return "private";
}

function contributorName(contributors: Contributor[], contributorId: string) {
  return contributors.find((contributor) => contributor.id === contributorId)?.display_name ?? "Unknown contributor";
}

function inquiryLabel(inquiries: Inquiry[], inquiryId: string | null) {
  if (!inquiryId) return "No Inquiry link";
  const inquiry = inquiries.find((item) => item.id === inquiryId);
  return inquiry ? `${inquiry.inquiry_number} · ${inquiry.title}` : inquiryId;
}

export default function AdminInstituteContributorsPage() {
  const [contributors, setContributors] = useState<Contributor[]>([]);
  const [submissions, setSubmissions] = useState<ContributorSubmission[]>([]);
  const [inquiries, setInquiries] = useState<Inquiry[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingContributor, setSavingContributor] = useState(false);
  const [savingSubmission, setSavingSubmission] = useState(false);
  const [reviewingId, setReviewingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const [contributorSearch, setContributorSearch] = useState("");
  const [submissionStatus, setSubmissionStatus] = useState("");

  const [displayName, setDisplayName] = useState("");
  const [roleNote, setRoleNote] = useState("");
  const [trustLevel, setTrustLevel] = useState<ContributorTrustLevel>("new");

  const [submissionContributorId, setSubmissionContributorId] = useState("");
  const [submissionInquiryId, setSubmissionInquiryId] = useState("");
  const [submissionType, setSubmissionType] = useState<ContributorSubmissionType>("memory");
  const [submissionTitle, setSubmissionTitle] = useState("");
  const [submissionBody, setSubmissionBody] = useState("");
  const [sourceUrl, setSourceUrl] = useState("");
  const [sourceNote, setSourceNote] = useState("");
  const [consentStatus, setConsentStatus] = useState<ContributorConsentStatus>("internal_use");

  async function loadDesk() {
    setLoading(true);
    setError(null);

    try {
      const [nextContributors, nextSubmissions, nextInquiries] = await Promise.all([
        listContributors({ search: contributorSearch || undefined, limit: 100 }),
        listContributorSubmissions({ reviewStatus: submissionStatus || undefined, limit: 100 }),
        listInquiries(),
      ]);

      setContributors(nextContributors);
      setSubmissions(nextSubmissions);
      setInquiries(nextInquiries);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadDesk();
  }, []);

  async function handleCreateContributor(event: FormEvent) {
    event.preventDefault();
    setSavingContributor(true);
    setError(null);
    setNotice(null);

    try {
      const contributor = await createContributor({
        display_name: displayName.trim(),
        role_note: roleNote.trim() || null,
        contributor_status: "active",
        trust_level: trustLevel,
      });

      setDisplayName("");
      setRoleNote("");
      setTrustLevel("new");
      setSubmissionContributorId(contributor.id);
      setNotice("Contributor added. You can now attach memory to them.");
      await loadDesk();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSavingContributor(false);
    }
  }

  async function handleCreateSubmission(event: FormEvent) {
    event.preventDefault();
    setSavingSubmission(true);
    setError(null);
    setNotice(null);

    try {
      await createContributorSubmission({
        contributor_id: submissionContributorId,
        inquiry_id: submissionInquiryId || null,
        submission_type: submissionType,
        title: submissionTitle.trim() || null,
        body: submissionBody.trim(),
        source_url: sourceUrl.trim() || null,
        source_note: sourceNote.trim() || null,
        consent_status: consentStatus,
      });

      setSubmissionTitle("");
      setSubmissionBody("");
      setSourceUrl("");
      setSourceNote("");
      setNotice("Contributor memory entered the Desk for review.");
      await loadDesk();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSavingSubmission(false);
    }
  }

  async function handleReviewSubmission(
    submission: ContributorSubmission,
    action: Parameters<typeof reviewContributorSubmission>[0]["decision"],
  ) {
    setReviewingId(submission.id);
    setError(null);
    setNotice(null);

    try {
      await reviewContributorSubmission({
        submissionId: submission.id,
        decision: action,
        decisionNote: `Contributor Desk action: ${humanize(action)}`,
      });

      setNotice(`Contributor memory moved to ${humanize(action)}.`);
      await loadDesk();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setReviewingId(null);
    }
  }

  async function handleAcceptAsEvidence(submission: ContributorSubmission) {
    setReviewingId(submission.id);
    setError(null);
    setNotice(null);

    try {
      await acceptContributorSubmissionAsEvidence({
        submissionId: submission.id,
        evidenceTitle: submission.title,
        reviewNote: "Accepted as evidence from Contributor Desk.",
      });

      setNotice("Contributor memory accepted as evidence.");
      await loadDesk();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setReviewingId(null);
    }
  }

  async function handleAcceptAsMemory(submission: ContributorSubmission) {
    setReviewingId(submission.id);
    setError(null);
    setNotice(null);

    try {
      await acceptContributorSubmissionAsMemory({
        submissionId: submission.id,
        reviewNote: "Accepted as memory from Contributor Desk.",
      });

      setNotice("Contributor memory accepted into the Inquiry.");
      await loadDesk();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setReviewingId(null);
    }
  }

  const contributorStateItems: InstituteInsightItem[] = useMemo(() => [
    {
      label: "People helping",
      value: contributors.length,
      description: "Contributors known to the Institute under this filter.",
      tone: "info",
    },
    {
      label: "Trusted",
      value: contributors.filter((contributor) => contributor.trust_level === "trusted").length,
      description: "People whose memory has earned stronger working confidence.",
      tone: "good",
    },
    {
      label: "New voices",
      value: contributors.filter((contributor) => contributor.trust_level === "new").length,
      description: "People whose memory still needs careful review.",
      tone: "warning",
    },
  ], [contributors]);

  const reviewPressureItems: InstituteInsightItem[] = useMemo(() => [
    {
      label: "Waiting for first read",
      value: submissions.filter((submission) => submission.review_status === "submitted").length,
      description: "Memory that has entered the Desk but has not been triaged.",
      tone: "warning",
    },
    {
      label: "Needs source",
      value: submissions.filter((submission) => submission.review_status === "needs_source").length,
      description: "Useful memory that cannot become evidence yet.",
      tone: "warning",
    },
    {
      label: "Needs clarity",
      value: submissions.filter((submission) => submission.review_status === "needs_clarification").length,
      description: "Memory that needs a cleaner explanation before review.",
      tone: "info",
    },
  ], [submissions]);

  const decisionItems: InstituteDecisionItem[] = useMemo(() => {
    return submissions
      .filter((submission) => submission.reviewed_at || submission.review_note)
      .slice(0, 6)
      .map((submission) => ({
        label: `${submission.title ?? "Contributor memory"}: ${humanize(submission.review_status)}`,
        reason: submission.review_note ?? "A reviewer acted on this contributor memory.",
        meta: submission.reviewed_at ? new Date(submission.reviewed_at).toLocaleString() : "reviewed",
        tone: reviewTone(submission.review_status),
      }));
  }, [submissions]);

  const nextMoves: InstituteActionItem[] = [
    ...(contributors.length === 0
      ? [{
          label: "Add a person helping the Inquiry",
          description: "Start with the person before you record the memory.",
          href: "#add-person",
          tone: "warning" as const,
        }]
      : []),
    {
      label: "Add contributor memory",
      description: "Capture what someone is offering, how they know it, and how WAKILISHA may use it.",
      href: "#add-memory",
      tone: "neutral",
    },
    ...(submissions.some((submission) => submission.review_status === "submitted")
      ? [{
          label: "Triage new memory",
          description: "Read new contributions and decide whether they need source, clarity, memory, evidence, or rejection.",
          href: "#memory-review",
          tone: "warning" as const,
        }]
      : []),
    ...(submissions.some((submission) => submission.review_status === "needs_source")
      ? [{
          label: "Ask for source",
          description: "Do not turn useful memory into evidence until support is clear.",
          href: "#memory-review",
          tone: "warning" as const,
        }]
      : []),
  ];

  return (
    <div className="space-y-6 p-6">
      <InstitutePageHeader
        eyebrow="Contributor Desk"
        title="Contributor memory"
        description="Receive memory from people without letting it bypass consent, source checks, or human review."
        badges={[
          {
            label: `${contributors.length} contributors`,
            description: "People whose memory can help an Inquiry.",
            tone: "info",
          },
          {
            label: `${submissions.length} memory items`,
            description: "Contributor submissions visible under the current filter.",
            tone: "info",
          },
          {
            label: `${submissions.filter((submission) => submission.review_status === "submitted").length} waiting`,
            description: "New memory waiting for first read.",
            tone: submissions.some((submission) => submission.review_status === "submitted") ? "warning" : "good",
          },
        ]}
        actions={[{ label: "Back to Institute", href: "/admin/institute" }]}
      />

      {error ? <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-[13px] font-semibold text-red-700">{error}</div> : null}
      {notice ? <div className="rounded-2xl border border-wk-brand/20 bg-wk-brand/10 p-4 text-[13px] font-semibold text-wk-text">{notice}</div> : null}

      <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <InstituteContributionStatePanel items={contributorStateItems} />
        <InstituteUncertaintyPanel items={reviewPressureItems} />
      </div>

      <InstituteNextMovePanel moves={nextMoves} />
      <InstituteDecisionLog decisions={decisionItems} />

      <section className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
        <InstituteSectionCard
          eyebrow="People"
          title="Add a person helping the Inquiry"
          description="A contributor is a person carrying memory, not a row waiting for processing."
        >
          <form id="add-person" onSubmit={handleCreateContributor} className="grid gap-4">
            <label className="grid gap-1 text-[12px] font-bold text-wk-text-muted">
              Contributor name
              <input value={displayName} onChange={(event) => setDisplayName(event.target.value)} required className="rounded-2xl border border-wk-border bg-wk-bg px-3 py-2 text-[13px] text-wk-text" />
            </label>
            <div className="grid gap-4 lg:grid-cols-[1fr_180px]">
              <label className="grid gap-1 text-[12px] font-bold text-wk-text-muted">
                What they bring
                <input value={roleNote} onChange={(event) => setRoleNote(event.target.value)} className="rounded-2xl border border-wk-border bg-wk-bg px-3 py-2 text-[13px] text-wk-text" />
              </label>
              <label className="grid gap-1 text-[12px] font-bold text-wk-text-muted">
                Working trust
                <select value={trustLevel} onChange={(event) => setTrustLevel(event.target.value as ContributorTrustLevel)} className="rounded-2xl border border-wk-border bg-wk-bg px-3 py-2 text-[13px] text-wk-text">
                  {TRUST_LEVELS.map((level) => <option key={level} value={level}>{level}</option>)}
                </select>
              </label>
            </div>
            <div>
              <button type="submit" disabled={savingContributor} className="rounded-full bg-wk-brand px-4 py-2 text-[13px] font-bold text-wk-brand-on hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60">
                {savingContributor ? "Adding..." : "Add contributor"}
              </button>
            </div>
          </form>
        </InstituteSectionCard>

        <InstituteSectionCard
          eyebrow="People in view"
          title="Who is already helping?"
          description="Search contributors and choose the person before attaching memory."
        >
          <div className="flex flex-col gap-3 md:flex-row md:items-center">
            <input value={contributorSearch} onChange={(event) => setContributorSearch(event.target.value)} placeholder="Search contributors" className="rounded-2xl border border-wk-border bg-wk-bg px-3 py-2 text-[13px] text-wk-text" />
            <button type="button" onClick={loadDesk} className="rounded-full border border-wk-border px-3 py-2 text-[12px] font-bold text-wk-text hover:border-wk-brand/40">Search</button>
          </div>

          {loading ? (
            <p className="mt-4 text-[13px] text-wk-text-muted">Loading contributors...</p>
          ) : contributors.length === 0 ? (
            <p className="mt-4 rounded-2xl border border-wk-border bg-wk-bg p-4 text-[13px] leading-5 text-wk-text-muted">
              No one is attached to this part of the work yet.
            </p>
          ) : (
            <div className="mt-4 grid gap-3">
              {contributors.map((contributor) => (
                <article key={contributor.id} className="rounded-2xl border border-wk-border bg-wk-bg p-4">
                  <div className="text-[14px] font-black text-wk-text">{contributor.display_name}</div>
                  {contributor.role_note ? <p className="mt-2 text-[13px] leading-5 text-wk-text-muted">{contributor.role_note}</p> : null}
                  <div className="mt-3 flex flex-wrap gap-2">
                    <span className="rounded-full border border-wk-border px-2.5 py-1 text-[11px] font-bold text-wk-text-muted">{humanize(contributor.contributor_status)}</span>
                    <span className="rounded-full border border-wk-border px-2.5 py-1 text-[11px] font-bold text-wk-text-muted">{contributor.trust_level} trust</span>
                  </div>
                </article>
              ))}
            </div>
          )}
        </InstituteSectionCard>
      </section>

      <InstituteSectionCard
        eyebrow="Memory intake"
        title="What is this person offering?"
        description="Capture the memory, the Inquiry it may help, the consent boundary, and the source context before review."
      >
        <form id="add-memory" onSubmit={handleCreateSubmission} className="grid gap-4">
          <div className="grid gap-4 lg:grid-cols-[1fr_1fr_220px]">
            <label className="grid gap-1 text-[12px] font-bold text-wk-text-muted">
              Contributor
              <select value={submissionContributorId} onChange={(event) => setSubmissionContributorId(event.target.value)} required className="rounded-2xl border border-wk-border bg-wk-bg px-3 py-2 text-[13px] text-wk-text">
                <option value="">Choose contributor</option>
                {contributors.map((contributor) => <option key={contributor.id} value={contributor.id}>{contributor.display_name}</option>)}
              </select>
            </label>
            <label className="grid gap-1 text-[12px] font-bold text-wk-text-muted">
              Inquiry it may help
              <select value={submissionInquiryId} onChange={(event) => setSubmissionInquiryId(event.target.value)} className="rounded-2xl border border-wk-border bg-wk-bg px-3 py-2 text-[13px] text-wk-text">
                <option value="">No Inquiry link yet</option>
                {inquiries.map((inquiry) => <option key={inquiry.id} value={inquiry.id}>{inquiry.inquiry_number} · {inquiry.title}</option>)}
              </select>
            </label>
            <label className="grid gap-1 text-[12px] font-bold text-wk-text-muted">
              Kind of contribution
              <select value={submissionType} onChange={(event) => setSubmissionType(event.target.value as ContributorSubmissionType)} className="rounded-2xl border border-wk-border bg-wk-bg px-3 py-2 text-[13px] text-wk-text">
                {SUBMISSION_TYPES.map((type) => <option key={type} value={type}>{humanize(type)}</option>)}
              </select>
            </label>
          </div>

          <div className="grid gap-4 lg:grid-cols-[1fr_240px]">
            <label className="grid gap-1 text-[12px] font-bold text-wk-text-muted">
              Memory title
              <input value={submissionTitle} onChange={(event) => setSubmissionTitle(event.target.value)} className="rounded-2xl border border-wk-border bg-wk-bg px-3 py-2 text-[13px] text-wk-text" />
            </label>
            <label className="grid gap-1 text-[12px] font-bold text-wk-text-muted">
              Consent boundary
              <select value={consentStatus} onChange={(event) => setConsentStatus(event.target.value as ContributorConsentStatus)} className="rounded-2xl border border-wk-border bg-wk-bg px-3 py-2 text-[13px] text-wk-text">
                {CONSENT_STATUSES.map((status) => <option key={status} value={status}>{consentLabel(status)}</option>)}
              </select>
            </label>
          </div>

          <label className="grid gap-1 text-[12px] font-bold text-wk-text-muted">
            What they remember, know, correct, or suggest
            <textarea value={submissionBody} onChange={(event) => setSubmissionBody(event.target.value)} required rows={5} className="rounded-2xl border border-wk-border bg-wk-bg px-3 py-2 text-[13px] text-wk-text" />
          </label>

          <div className="grid gap-4 lg:grid-cols-2">
            <label className="grid gap-1 text-[12px] font-bold text-wk-text-muted">
              Source link
              <input value={sourceUrl} onChange={(event) => setSourceUrl(event.target.value)} className="rounded-2xl border border-wk-border bg-wk-bg px-3 py-2 text-[13px] text-wk-text" />
            </label>
            <label className="grid gap-1 text-[12px] font-bold text-wk-text-muted">
              Source note
              <input value={sourceNote} onChange={(event) => setSourceNote(event.target.value)} className="rounded-2xl border border-wk-border bg-wk-bg px-3 py-2 text-[13px] text-wk-text" />
            </label>
          </div>

          <div>
            <button type="submit" disabled={savingSubmission} className="rounded-full bg-wk-brand px-4 py-2 text-[13px] font-bold text-wk-brand-on hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60">
              {savingSubmission ? "Adding..." : "Add memory for review"}
            </button>
          </div>
        </form>
      </InstituteSectionCard>

      <InstituteSectionCard
        eyebrow="Memory review"
        title="What should happen to this contribution?"
        description="Review, ask for source, ask for clarity, accept as memory, accept as evidence, reject, or archive."
      >
        <div id="memory-review" className="flex flex-col gap-3 md:flex-row md:items-center">
          <select value={submissionStatus} onChange={(event) => setSubmissionStatus(event.target.value)} className="rounded-2xl border border-wk-border bg-wk-bg px-3 py-2 text-[13px] text-wk-text">
            <option value="">Any review state</option>
            {REVIEW_STATUSES.map((status) => <option key={status} value={status}>{humanize(status)}</option>)}
          </select>
          <button type="button" onClick={loadDesk} className="rounded-full border border-wk-border px-3 py-2 text-[12px] font-bold text-wk-text hover:border-wk-brand/40">Filter</button>
        </div>

        {submissions.length === 0 ? (
          <p className="mt-4 rounded-2xl border border-wk-border bg-wk-bg p-4 text-[13px] leading-5 text-wk-text-muted">
            No contributor memory is waiting under this filter.
          </p>
        ) : (
          <div className="mt-5 grid gap-4">
            {submissions.map((submission) => {
              const hasSource = Boolean(submission.source_url || submission.source_note);
              const isPrivate = submission.consent_status === "private";

              return (
                <article key={submission.id} className="rounded-3xl border border-wk-border bg-wk-bg p-4">
                  <div className="grid gap-4 xl:grid-cols-[1fr_auto]">
                    <div className="min-w-0">
                      <div className="text-[11px] font-black uppercase tracking-[0.16em] text-wk-brand">{humanize(submission.submission_type)}</div>
                      <h3 className="mt-1 text-[16px] font-black text-wk-text">{submission.title ?? "Untitled contributor memory"}</h3>
                      <p className="mt-2 text-[13px] leading-5 text-wk-text-muted">
                        From {contributorName(contributors, submission.contributor_id)} · {inquiryLabel(inquiries, submission.inquiry_id)}
                      </p>
                      <p className="mt-3 whitespace-pre-wrap text-[13px] leading-5 text-wk-text-soft">{submission.body}</p>

                      <div className="mt-3 grid gap-3 lg:grid-cols-3">
                        <div className="rounded-2xl border border-wk-border bg-wk-surface p-3">
                          <div className="text-[11px] font-black uppercase tracking-[0.14em] text-wk-text-muted">Consent</div>
                          <p className="mt-1 text-[13px] font-bold text-wk-text">{consentLabel(submission.consent_status)}</p>
                        </div>
                        <div className="rounded-2xl border border-wk-border bg-wk-surface p-3">
                          <div className="text-[11px] font-black uppercase tracking-[0.14em] text-wk-text-muted">Source strength</div>
                          <p className="mt-1 text-[13px] font-bold text-wk-text">{hasSource ? "source context present" : "needs source context"}</p>
                        </div>
                        <div className="rounded-2xl border border-wk-border bg-wk-surface p-3">
                          <div className="text-[11px] font-black uppercase tracking-[0.14em] text-wk-text-muted">Where this stands</div>
                          <p className="mt-1 text-[13px] font-bold text-wk-text">{humanize(submission.review_status)}</p>
                        </div>
                      </div>

                      {isPrivate ? (
                        <p className="mt-3 rounded-2xl border border-wk-warning/30 bg-wk-warning-soft p-3 text-[13px] leading-5 text-wk-warning">
                          Consent is private. Keep this internal until permission changes.
                        </p>
                      ) : null}
                    </div>

                    <div className="flex max-w-md flex-wrap gap-2 xl:justify-end">
                      <button type="button" disabled={reviewingId === submission.id} onClick={() => handleReviewSubmission(submission, "triaged")} className="rounded-full border border-wk-border px-3 py-1.5 text-[11px] font-bold text-wk-text hover:border-wk-brand/40 disabled:opacity-60">Triage</button>
                      <button type="button" disabled={reviewingId === submission.id} onClick={() => handleReviewSubmission(submission, "needs_source")} className="rounded-full border border-wk-border px-3 py-1.5 text-[11px] font-bold text-wk-text hover:border-wk-brand/40 disabled:opacity-60">Needs source</button>
                      <button type="button" disabled={reviewingId === submission.id} onClick={() => handleReviewSubmission(submission, "needs_clarification")} className="rounded-full border border-wk-border px-3 py-1.5 text-[11px] font-bold text-wk-text hover:border-wk-brand/40 disabled:opacity-60">Needs clarity</button>
                      <button type="button" disabled={reviewingId === submission.id} onClick={() => handleAcceptAsMemory(submission)} className="rounded-full border border-wk-border px-3 py-1.5 text-[11px] font-bold text-wk-text hover:border-wk-brand/40 disabled:opacity-60">Accept as memory</button>
                      <button type="button" disabled={reviewingId === submission.id || !hasSource || isPrivate} onClick={() => handleAcceptAsEvidence(submission)} className="rounded-full bg-wk-brand px-3 py-1.5 text-[11px] font-bold text-wk-brand-on hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50">Accept as evidence</button>
                      <button type="button" disabled={reviewingId === submission.id} onClick={() => handleReviewSubmission(submission, "rejected")} className="rounded-full border border-red-200 px-3 py-1.5 text-[11px] font-bold text-red-700 hover:border-red-400 disabled:opacity-60">Reject</button>
                      <button type="button" disabled={reviewingId === submission.id} onClick={() => handleReviewSubmission(submission, "archived")} className="rounded-full border border-wk-border px-3 py-1.5 text-[11px] font-bold text-wk-text hover:border-wk-brand/40 disabled:opacity-60">Archive</button>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </InstituteSectionCard>
    </div>
  );
}
