import { FormEvent, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  createInquiry,
  listInquiries,
  type Inquiry,
  type InquiryStatus,
} from "@/services/institute";

const STATUS_OPTIONS: InquiryStatus[] = ["draft", "open", "active", "paused", "closed"];

function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function nextInquiryNumber(inquiries: Inquiry[]) {
  const max = inquiries.reduce((highest, inquiry) => {
    const parsed = Number.parseInt(inquiry.inquiry_number, 10);
    return Number.isFinite(parsed) ? Math.max(highest, parsed) : highest;
  }, 0);

  return String(max + 1).padStart(4, "0");
}

export default function AdminInstituteInquiriesPage() {
  const [inquiries, setInquiries] = useState<Inquiry[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const [title, setTitle] = useState("");
  const [primaryQuestion, setPrimaryQuestion] = useState("");
  const [whyItMatters, setWhyItMatters] = useState("");
  const [status, setStatus] = useState<InquiryStatus>("draft");

  const suggestedNumber = useMemo(() => nextInquiryNumber(inquiries), [inquiries]);

  async function loadInquiries() {
    setLoading(true);
    setError(null);

    try {
      setInquiries(await listInquiries());
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadInquiries();
  }, []);

  async function handleCreateInquiry(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    setNotice(null);

    try {
      const cleanTitle = title.trim();
      const created = await createInquiry({
        inquiry_number: suggestedNumber,
        title: cleanTitle,
        slug: slugify(cleanTitle || `inquiry-${suggestedNumber}`),
        primary_question: primaryQuestion.trim(),
        why_it_matters: whyItMatters.trim(),
        status,
        visibility: "internal",
      });

      setTitle("");
      setPrimaryQuestion("");
      setWhyItMatters("");
      setStatus("draft");
      setNotice(`Created Inquiry ${created.inquiry_number}.`);
      await loadInquiries();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6 p-6">
      <header className="rounded-3xl border border-wk-border bg-wk-surface p-6 shadow-sm">
        <div className="text-[12px] font-bold uppercase tracking-[0.2em] text-wk-brand">Inquiry Workbench</div>
        <div className="mt-3 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h1 className="text-3xl font-black tracking-tight text-wk-text">Inquiries</h1>
            <p className="mt-2 max-w-3xl text-[14px] leading-6 text-wk-text-muted">
              Open and manage Institute questions before they become evidence, relationships, drafts, or public meaning.
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
        <h2 className="text-lg font-black text-wk-text">Create Inquiry</h2>
        <form onSubmit={handleCreateInquiry} className="mt-4 grid gap-4">
          <div className="grid gap-4 lg:grid-cols-[160px_1fr_180px]">
            <label className="grid gap-1 text-[12px] font-bold text-wk-text-muted">
              Number
              <input value={suggestedNumber} readOnly className="rounded-2xl border border-wk-border bg-wk-bg px-3 py-2 text-[13px] font-bold text-wk-text" />
            </label>
            <label className="grid gap-1 text-[12px] font-bold text-wk-text-muted">
              Title
              <input value={title} onChange={(event) => setTitle(event.target.value)} required className="rounded-2xl border border-wk-border bg-wk-bg px-3 py-2 text-[13px] text-wk-text" />
            </label>
            <label className="grid gap-1 text-[12px] font-bold text-wk-text-muted">
              Status
              <select value={status} onChange={(event) => setStatus(event.target.value as InquiryStatus)} className="rounded-2xl border border-wk-border bg-wk-bg px-3 py-2 text-[13px] text-wk-text">
                {STATUS_OPTIONS.map((option) => <option key={option} value={option}>{option.replaceAll("_", " ")}</option>)}
              </select>
            </label>
          </div>
          <label className="grid gap-1 text-[12px] font-bold text-wk-text-muted">
            Primary question
            <textarea value={primaryQuestion} onChange={(event) => setPrimaryQuestion(event.target.value)} required rows={2} className="rounded-2xl border border-wk-border bg-wk-bg px-3 py-2 text-[13px] text-wk-text" />
          </label>
          <label className="grid gap-1 text-[12px] font-bold text-wk-text-muted">
            Why it matters
            <textarea value={whyItMatters} onChange={(event) => setWhyItMatters(event.target.value)} required rows={3} className="rounded-2xl border border-wk-border bg-wk-bg px-3 py-2 text-[13px] text-wk-text" />
          </label>
          <div>
            <button type="submit" disabled={saving} className="rounded-full bg-wk-brand px-4 py-2 text-[13px] font-bold text-wk-brand-on hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60">
              {saving ? "Creating…" : "Create Inquiry"}
            </button>
          </div>
        </form>
      </section>

      <section className="rounded-3xl border border-wk-border bg-wk-surface p-5 shadow-sm">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-lg font-black text-wk-text">Inquiry list</h2>
          <button type="button" onClick={loadInquiries} className="rounded-full border border-wk-border px-3 py-2 text-[12px] font-bold text-wk-text hover:border-wk-brand/40">Refresh</button>
        </div>

        {loading ? (
          <p className="mt-4 text-[13px] text-wk-text-muted">Loading inquiries…</p>
        ) : inquiries.length === 0 ? (
          <p className="mt-4 text-[13px] text-wk-text-muted">No inquiries found yet.</p>
        ) : (
          <div className="mt-4 divide-y divide-wk-border">
            {inquiries.map((inquiry) => (
              <Link key={inquiry.id} to={`/admin/institute/inquiries/${inquiry.id}`} className="block py-4 hover:bg-wk-bg/60">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                  <div>
                    <div className="text-[12px] font-bold uppercase tracking-[0.16em] text-wk-brand">Inquiry {inquiry.inquiry_number}</div>
                    <h3 className="mt-1 text-[16px] font-black text-wk-text">{inquiry.title}</h3>
                    <p className="mt-1 line-clamp-2 text-[13px] leading-5 text-wk-text-muted">{inquiry.primary_question}</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <span className="rounded-full border border-wk-border px-2.5 py-1 text-[11px] font-bold text-wk-text-muted">{inquiry.status}</span>
                    <span className="rounded-full border border-wk-border px-2.5 py-1 text-[11px] font-bold text-wk-text-muted">{inquiry.visibility}</span>
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
