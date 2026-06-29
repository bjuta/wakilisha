import { FormEvent, useEffect, useState } from "react";
import { Link } from "react-router-dom";
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

function label(value: string) {
  return value.replaceAll("_", " ");
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
      setNotice("Contributor created.");
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
      setNotice("Submission created.");
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
        decisionNote: `Contributor Desk action: ${action.replaceAll("_", " ")}`,
      });

      setNotice(`Submission action applied: ${label(action)}.`);
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

      setNotice("Submission converted to evidence.");
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

      setNotice("Submission converted to memory.");
      await loadDesk();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setReviewingId(null);
    }
  }

  return (
    <div className="space-y-6 p-6">
      <header className="rounded-3xl border border-wk-border bg-wk-surface p-6 shadow-sm">
        <div className="text-[12px] font-bold uppercase tracking-[0.2em] text-wk-brand">Contributor Desk</div>
        <div className="mt-3 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h1 className="text-3xl font-black tracking-tight text-wk-text">Contributors</h1>
            <p className="mt-2 max-w-3xl text-[14px] leading-6 text-wk-text-muted">
              Capture contributor memory without letting it bypass review.
            </p>
          </div>
          <Link to="/admin/institute" className="rounded-full border border-wk-border px-4 py-2 text-[13px] font-bold text-wk-text hover:border-wk-brand/40">
            Back to Institute
          </Link>
        </div>
      </header>

      {error ? <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-[13px] font-semibold text-red-700">{error}</div> : null}
      {notice ? <div className="rounded-2xl border border-wk-brand/20 bg-wk-brand/10 p-4 text-[13px] font-semibold text-wk-text">{notice}</div> : null}

      <section className="grid gap-6 xl:grid-cols-2">
        <div className="rounded-3xl border border-wk-border bg-wk-surface p-5 shadow-sm">
          <h2 className="text-lg font-black text-wk-text">Create contributor</h2>
          <form onSubmit={handleCreateContributor} className="mt-4 grid gap-4">
            <label className="grid gap-1 text-[12px] font-bold text-wk-text-muted">
              Display name
              <input value={displayName} onChange={(event) => setDisplayName(event.target.value)} required className="rounded-2xl border border-wk-border bg-wk-bg px-3 py-2 text-[13px] text-wk-text" />
            </label>
            <div className="grid gap-4 lg:grid-cols-[1fr_180px]">
              <label className="grid gap-1 text-[12px] font-bold text-wk-text-muted">
                Role note
                <input value={roleNote} onChange={(event) => setRoleNote(event.target.value)} className="rounded-2xl border border-wk-border bg-wk-bg px-3 py-2 text-[13px] text-wk-text" />
              </label>
              <label className="grid gap-1 text-[12px] font-bold text-wk-text-muted">
                Trust
                <select value={trustLevel} onChange={(event) => setTrustLevel(event.target.value as ContributorTrustLevel)} className="rounded-2xl border border-wk-border bg-wk-bg px-3 py-2 text-[13px] text-wk-text">
                  {TRUST_LEVELS.map((level) => <option key={level} value={level}>{level}</option>)}
                </select>
              </label>
            </div>
            <div>
              <button type="submit" disabled={savingContributor} className="rounded-full bg-wk-brand px-4 py-2 text-[13px] font-bold text-wk-brand-on hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60">
                {savingContributor ? "Creating…" : "Create contributor"}
              </button>
            </div>
          </form>
        </div>

        <div className="rounded-3xl border border-wk-border bg-wk-surface p-5 shadow-sm">
          <div className="flex items-end justify-between gap-3">
            <h2 className="text-lg font-black text-wk-text">Contributor list</h2>
            <div className="flex gap-2">
              <input value={contributorSearch} onChange={(event) => setContributorSearch(event.target.value)} placeholder="Search contributors" className="rounded-2xl border border-wk-border bg-wk-bg px-3 py-2 text-[13px] text-wk-text" />
              <button type="button" onClick={loadDesk} className="rounded-full border border-wk-border px-3 py-2 text-[12px] font-bold text-wk-text hover:border-wk-brand/40">Search</button>
            </div>
          </div>
          {loading ? (
            <p className="mt-4 text-[13px] text-wk-text-muted">Loading contributors…</p>
          ) : contributors.length === 0 ? (
            <p className="mt-4 text-[13px] text-wk-text-muted">No contributors found.</p>
          ) : (
            <div className="mt-4 space-y-3">
              {contributors.map((contributor) => (
                <article key={contributor.id} className="rounded-2xl border border-wk-border bg-wk-bg p-4">
                  <div className="text-[14px] font-black text-wk-text">{contributor.display_name}</div>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <span className="rounded-full border border-wk-border px-2.5 py-1 text-[11px] font-bold text-wk-text-muted">{contributor.contributor_status}</span>
                    <span className="rounded-full border border-wk-border px-2.5 py-1 text-[11px] font-bold text-wk-text-muted">{contributor.trust_level}</span>
                  </div>
                </article>
              ))}
            </div>
          )}
        </div>
      </section>

      <section className="rounded-3xl border border-wk-border bg-wk-surface p-5 shadow-sm">
        <h2 className="text-lg font-black text-wk-text">Create submission</h2>
        <form onSubmit={handleCreateSubmission} className="mt-4 grid gap-4">
          <div className="grid gap-4 lg:grid-cols-[1fr_1fr_220px]">
            <label className="grid gap-1 text-[12px] font-bold text-wk-text-muted">
              Contributor
              <select value={submissionContributorId} onChange={(event) => setSubmissionContributorId(event.target.value)} required className="rounded-2xl border border-wk-border bg-wk-bg px-3 py-2 text-[13px] text-wk-text">
                <option value="">Choose contributor</option>
                {contributors.map((contributor) => <option key={contributor.id} value={contributor.id}>{contributor.display_name}</option>)}
              </select>
            </label>
            <label className="grid gap-1 text-[12px] font-bold text-wk-text-muted">
              Inquiry
              <select value={submissionInquiryId} onChange={(event) => setSubmissionInquiryId(event.target.value)} className="rounded-2xl border border-wk-border bg-wk-bg px-3 py-2 text-[13px] text-wk-text">
                <option value="">No Inquiry link</option>
                {inquiries.map((inquiry) => <option key={inquiry.id} value={inquiry.id}>{inquiry.inquiry_number} · {inquiry.title}</option>)}
              </select>
            </label>
            <label className="grid gap-1 text-[12px] font-bold text-wk-text-muted">
              Type
              <select value={submissionType} onChange={(event) => setSubmissionType(event.target.value as ContributorSubmissionType)} className="rounded-2xl border border-wk-border bg-wk-bg px-3 py-2 text-[13px] text-wk-text">
                {SUBMISSION_TYPES.map((type) => <option key={type} value={type}>{label(type)}</option>)}
              </select>
            </label>
          </div>

          <div className="grid gap-4 lg:grid-cols-[1fr_220px]">
            <label className="grid gap-1 text-[12px] font-bold text-wk-text-muted">
              Title
              <input value={submissionTitle} onChange={(event) => setSubmissionTitle(event.target.value)} className="rounded-2xl border border-wk-border bg-wk-bg px-3 py-2 text-[13px] text-wk-text" />
            </label>
            <label className="grid gap-1 text-[12px] font-bold text-wk-text-muted">
              Consent
              <select value={consentStatus} onChange={(event) => setConsentStatus(event.target.value as ContributorConsentStatus)} className="rounded-2xl border border-wk-border bg-wk-bg px-3 py-2 text-[13px] text-wk-text">
                {CONSENT_STATUSES.map((status) => <option key={status} value={status}>{label(status)}</option>)}
              </select>
            </label>
          </div>

          <label className="grid gap-1 text-[12px] font-bold text-wk-text-muted">
            Body
            <textarea value={submissionBody} onChange={(event) => setSubmissionBody(event.target.value)} required rows={4} className="rounded-2xl border border-wk-border bg-wk-bg px-3 py-2 text-[13px] text-wk-text" />
          </label>

          <div className="grid gap-4 lg:grid-cols-2">
            <label className="grid gap-1 text-[12px] font-bold text-wk-text-muted">
              Source URL
              <input value={sourceUrl} onChange={(event) => setSourceUrl(event.target.value)} className="rounded-2xl border border-wk-border bg-wk-bg px-3 py-2 text-[13px] text-wk-text" />
            </label>
            <label className="grid gap-1 text-[12px] font-bold text-wk-text-muted">
              Source note
              <input value={sourceNote} onChange={(event) => setSourceNote(event.target.value)} className="rounded-2xl border border-wk-border bg-wk-bg px-3 py-2 text-[13px] text-wk-text" />
            </label>
          </div>

          <div>
            <button type="submit" disabled={savingSubmission} className="rounded-full bg-wk-brand px-4 py-2 text-[13px] font-bold text-wk-brand-on hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60">
              {savingSubmission ? "Creating…" : "Create submission"}
            </button>
          </div>
        </form>
      </section>

      <section className="rounded-3xl border border-wk-border bg-wk-surface p-5 shadow-sm">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h2 className="text-lg font-black text-wk-text">Submission inbox</h2>
            <p className="mt-1 text-[13px] text-wk-text-muted">Review, request more source, or convert contributor memory into evidence.</p>
          </div>
          <div className="flex gap-2">
            <select value={submissionStatus} onChange={(event) => setSubmissionStatus(event.target.value)} className="rounded-2xl border border-wk-border bg-wk-bg px-3 py-2 text-[13px] text-wk-text">
              <option value="">Any status</option>
              {REVIEW_STATUSES.map((status) => <option key={status} value={status}>{label(status)}</option>)}
            </select>
            <button type="button" onClick={loadDesk} className="rounded-full border border-wk-border px-3 py-2 text-[12px] font-bold text-wk-text hover:border-wk-brand/40">Filter</button>
          </div>
        </div>

        {submissions.length === 0 ? (
          <p className="mt-4 text-[13px] text-wk-text-muted">No submissions found.</p>
        ) : (
          <div className="mt-4 space-y-3">
            {submissions.map((submission) => (
              <article key={submission.id} className="rounded-2xl border border-wk-border bg-wk-bg p-4">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                  <div>
                    <div className="text-[12px] font-bold uppercase tracking-[0.16em] text-wk-brand">{label(submission.submission_type)}</div>
                    <h3 className="mt-1 text-[15px] font-black text-wk-text">{submission.title ?? "Untitled submission"}</h3>
                    <p className="mt-2 whitespace-pre-wrap text-[13px] leading-5 text-wk-text-muted">{submission.body}</p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <span className="rounded-full border border-wk-border px-2.5 py-1 text-[11px] font-bold text-wk-text-muted">{label(submission.review_status)}</span>
                      <span className="rounded-full border border-wk-border px-2.5 py-1 text-[11px] font-bold text-wk-text-muted">{label(submission.consent_status)}</span>
                    </div>
                  </div>
                  <div className="flex max-w-md flex-wrap gap-2">
                    <button type="button" disabled={reviewingId === submission.id} onClick={() => handleReviewSubmission(submission, "triaged")} className="rounded-full border border-wk-border px-3 py-1.5 text-[11px] font-bold text-wk-text hover:border-wk-brand/40 disabled:opacity-60">Triage</button>
                    <button type="button" disabled={reviewingId === submission.id} onClick={() => handleReviewSubmission(submission, "needs_source")} className="rounded-full border border-wk-border px-3 py-1.5 text-[11px] font-bold text-wk-text hover:border-wk-brand/40 disabled:opacity-60">Needs source</button>
                    <button type="button" disabled={reviewingId === submission.id} onClick={() => handleReviewSubmission(submission, "needs_clarification")} className="rounded-full border border-wk-border px-3 py-1.5 text-[11px] font-bold text-wk-text hover:border-wk-brand/40 disabled:opacity-60">Needs clarity</button>
                    <button type="button" disabled={reviewingId === submission.id} onClick={() => handleAcceptAsMemory(submission)} className="rounded-full border border-wk-border px-3 py-1.5 text-[11px] font-bold text-wk-text hover:border-wk-brand/40 disabled:opacity-60">Accept memory</button>
                    <button type="button" disabled={reviewingId === submission.id} onClick={() => handleAcceptAsEvidence(submission)} className="rounded-full bg-wk-brand px-3 py-1.5 text-[11px] font-bold text-wk-brand-on hover:opacity-90 disabled:opacity-60">Accept evidence</button>
                    <button type="button" disabled={reviewingId === submission.id} onClick={() => handleReviewSubmission(submission, "rejected")} className="rounded-full border border-red-200 px-3 py-1.5 text-[11px] font-bold text-red-700 hover:border-red-400 disabled:opacity-60">Reject</button>
                    <button type="button" disabled={reviewingId === submission.id} onClick={() => handleReviewSubmission(submission, "archived")} className="rounded-full border border-wk-border px-3 py-1.5 text-[11px] font-bold text-wk-text hover:border-wk-brand/40 disabled:opacity-60">Archive</button>
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
