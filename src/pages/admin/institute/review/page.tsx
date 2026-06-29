import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  listHumanReviewQueueItems,
  type HumanReviewQueueItem,
  type HumanReviewSubjectType,
} from "@/services/institute";

type SubjectFilter = "all" | HumanReviewSubjectType;

const SUBJECT_FILTERS: Array<{ value: SubjectFilter; label: string }> = [
  { value: "all", label: "All" },
  { value: "evidence", label: "Evidence" },
  { value: "relationship", label: "Relationships" },
  { value: "contributor_submission", label: "Submissions" },
  { value: "surface_draft", label: "Drafts" },
  { value: "correction", label: "Corrections" },
];

function statusClass(status: string): string {
  if (["approved", "accepted_as_evidence", "accepted_as_memory"].includes(status)) return "bg-wk-success/10 text-wk-success border-wk-success/20";
  if (["rejected", "disputed"].includes(status)) return "bg-wk-danger/10 text-wk-danger border-wk-danger/20";
  if (["unreviewed", "submitted", "pending_review", "needs_source", "needs_clarification", "unresolved"].includes(status)) return "bg-wk-warning/10 text-wk-warning border-wk-warning/20";
  return "bg-wk-surface-raised text-wk-text-muted border-wk-border";
}

function subjectDestination(item: HumanReviewQueueItem): string {
  if (item.subject_type === "relationship") return "/admin/relationships/viewer";
  if (item.subject_type === "contributor_submission") return "/admin/community";
  return "/admin/review/queue";
}

function ReviewQueueRow({ item }: { item: HumanReviewQueueItem }) {
  return (
    <div className="rounded-2xl border border-wk-border bg-wk-surface p-4 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full border border-wk-border bg-wk-surface-raised px-2.5 py-1 text-[11px] font-bold uppercase tracking-[0.12em] text-wk-text-faint">
              {item.subject_type.replaceAll("_", " ")}
            </span>
            <span className={`rounded-full border px-2.5 py-1 text-[11px] font-bold ${statusClass(item.review_status)}`}>
              {item.review_status.replaceAll("_", " ")}
            </span>
            <span className="rounded-full border border-wk-border px-2.5 py-1 text-[11px] font-bold text-wk-text-muted">
              Priority {item.priority_weight}
            </span>
          </div>
          <h2 className="mt-3 line-clamp-1 text-[16px] font-black text-wk-text">{item.title}</h2>
          <p className="mt-2 line-clamp-2 text-[13px] leading-5 text-wk-text-muted">{item.summary}</p>
          <p className="mt-2 text-[12px] font-semibold text-wk-text-soft">{item.review_reason}</p>
        </div>

        <Link to={subjectDestination(item)} className="rounded-full border border-wk-border px-3 py-2 text-[12px] font-bold text-wk-text hover:border-wk-brand/40">
          Open source
        </Link>
      </div>
    </div>
  );
}

export default function AdminInstituteReviewPage() {
  const [filter, setFilter] = useState<SubjectFilter>("all");
  const [items, setItems] = useState<HumanReviewQueueItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const groupedCounts = useMemo(() => {
    return items.reduce<Record<string, number>>((acc, item) => {
      acc[item.subject_type] = (acc[item.subject_type] ?? 0) + 1;
      return acc;
    }, {});
  }, [items]);

  useEffect(() => {
    let cancelled = false;

    async function loadQueue() {
      setLoading(true);
      setError(null);

      try {
        const rows = await listHumanReviewQueueItems({
          subjectType: filter === "all" ? undefined : filter,
          limit: 100,
        });

        if (!cancelled) setItems(rows);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : String(err));
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadQueue();

    return () => {
      cancelled = true;
    };
  }, [filter]);

  return (
    <div className="space-y-6 p-6">
      <header className="rounded-3xl border border-wk-border bg-wk-surface p-6 shadow-sm">
        <div className="text-[12px] font-bold uppercase tracking-[0.2em] text-wk-brand">Human Review</div>
        <div className="mt-3 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-3xl font-black tracking-tight text-wk-text">Institute review queue</h1>
            <p className="mt-3 max-w-3xl text-[14px] leading-6 text-wk-text-muted">
              One queue for evidence, relationships, contributor submissions, drafts, and corrections. This page is read-only for now.
            </p>
          </div>
          <Link to="/admin/institute" className="rounded-full border border-wk-border px-4 py-2 text-[13px] font-bold text-wk-text hover:border-wk-brand/40">
            Back to Institute
          </Link>
        </div>
      </header>

      <section className="rounded-2xl border border-wk-border bg-wk-surface p-4">
        <div className="flex flex-wrap gap-2">
          {SUBJECT_FILTERS.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => setFilter(option.value)}
              className={`rounded-full px-3 py-2 text-[12px] font-bold transition ${
                filter === option.value
                  ? "bg-wk-brand text-wk-brand-on"
                  : "border border-wk-border text-wk-text-muted hover:border-wk-brand/40 hover:text-wk-text"
              }`}
            >
              {option.label}
              {option.value !== "all" && groupedCounts[option.value] ? ` (${groupedCounts[option.value]})` : ""}
            </button>
          ))}
        </div>
      </section>

      {error && (
        <div className="rounded-2xl border border-wk-danger/20 bg-wk-danger/10 p-4 text-[13px] font-semibold text-wk-danger">
          {error}
        </div>
      )}

      {loading ? (
        <div className="rounded-2xl border border-wk-border bg-wk-surface p-6 text-[13px] text-wk-text-muted">
          Loading review queue…
        </div>
      ) : items.length ? (
        <section className="space-y-3">
          {items.map((item) => (
            <ReviewQueueRow key={`${item.subject_type}-${item.subject_id}`} item={item} />
          ))}
        </section>
      ) : (
        <div className="rounded-2xl border border-dashed border-wk-border bg-wk-surface p-6 text-[13px] text-wk-text-muted">
          No queue items found for this filter.
        </div>
      )}
    </div>
  );
}
