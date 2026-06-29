import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  getInstituteAdminOverviewCountMap,
  listHumanReviewQueueItems,
  listRetrievalPolicies,
  listRetrievalRuns,
  type HumanReviewQueueItem,
  type RetrievalPolicy,
  type RetrievalRun,
} from "@/services/institute";

type Counts = Record<string, number>;

function formatCount(value: number | undefined): string {
  return new Intl.NumberFormat("en").format(value ?? 0);
}

function statusClass(status: string): string {
  if (["approved", "active", "succeeded"].includes(status)) return "bg-wk-success/10 text-wk-success border-wk-success/20";
  if (["rejected", "failed", "disputed"].includes(status)) return "bg-wk-danger/10 text-wk-danger border-wk-danger/20";
  if (["pending_review", "submitted", "queued", "running", "draft"].includes(status)) return "bg-wk-warning/10 text-wk-warning border-wk-warning/20";
  return "bg-wk-surface-raised text-wk-text-muted border-wk-border";
}

function StatCard({ label, value, note }: { label: string; value: string; note: string }) {
  return (
    <div className="rounded-2xl border border-wk-border bg-wk-surface p-5 shadow-sm">
      <div className="text-[12px] font-bold uppercase tracking-[0.18em] text-wk-text-faint">{label}</div>
      <div className="mt-3 text-3xl font-black text-wk-text">{value}</div>
      <div className="mt-2 text-[13px] leading-5 text-wk-text-muted">{note}</div>
    </div>
  );
}

function QueuePreview({ items }: { items: HumanReviewQueueItem[] }) {
  if (!items.length) {
    return (
      <div className="rounded-2xl border border-dashed border-wk-border bg-wk-surface p-6 text-[13px] text-wk-text-muted">
        No review queue items found. The Institute has nothing waiting for human review right now.
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-wk-border bg-wk-surface">
      {items.map((item) => (
        <div key={`${item.subject_type}-${item.subject_id}`} className="border-b border-wk-border p-4 last:border-b-0">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="text-[11px] font-bold uppercase tracking-[0.16em] text-wk-text-faint">
                {item.subject_type.replaceAll("_", " ")}
              </div>
              <div className="mt-1 line-clamp-1 text-[14px] font-bold text-wk-text">{item.title}</div>
              <div className="mt-1 line-clamp-2 text-[12px] leading-5 text-wk-text-muted">{item.review_reason}</div>
            </div>
            <span className={`rounded-full border px-2.5 py-1 text-[11px] font-bold ${statusClass(item.review_status)}`}>
              {item.review_status.replaceAll("_", " ")}
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}

function PolicyPreview({ policies }: { policies: RetrievalPolicy[] }) {
  if (!policies.length) {
    return <div className="text-[13px] text-wk-text-muted">No retrieval policies found yet.</div>;
  }

  return (
    <div className="space-y-3">
      {policies.slice(0, 5).map((policy) => (
        <div key={policy.id} className="rounded-xl border border-wk-border bg-wk-surface p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-[13px] font-bold text-wk-text">{policy.display_name}</div>
              <div className="mt-1 text-[12px] text-wk-text-muted">{policy.task_type.replaceAll("_", " ")}</div>
            </div>
            <span className={`rounded-full border px-2.5 py-1 text-[11px] font-bold ${statusClass(policy.status)}`}>
              {policy.status}
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}

function RunPreview({ runs }: { runs: RetrievalRun[] }) {
  if (!runs.length) {
    return <div className="text-[13px] text-wk-text-muted">No retrieval runs logged yet.</div>;
  }

  return (
    <div className="space-y-3">
      {runs.slice(0, 5).map((run) => (
        <div key={run.id} className="rounded-xl border border-wk-border bg-wk-surface p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-[13px] font-bold text-wk-text">{run.run_type.replaceAll("_", " ")}</div>
              <div className="mt-1 text-[12px] text-wk-text-muted">{run.task_type.replaceAll("_", " ")}</div>
            </div>
            <span className={`rounded-full border px-2.5 py-1 text-[11px] font-bold ${statusClass(run.status)}`}>
              {run.status}
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}

export default function AdminInstituteOverviewPage() {
  const [counts, setCounts] = useState<Counts>({});
  const [queueItems, setQueueItems] = useState<HumanReviewQueueItem[]>([]);
  const [policies, setPolicies] = useState<RetrievalPolicy[]>([]);
  const [runs, setRuns] = useState<RetrievalRun[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const stats = useMemo(
    () => [
      {
        label: "Review queue",
        value: formatCount(counts.review_queue_items),
        note: "Human decisions waiting across evidence, relationships, submissions, drafts, and corrections.",
      },
      {
        label: "Active inquiries",
        value: formatCount(counts.active_inquiries),
        note: "Open Institute questions with live research context.",
      },
      {
        label: "Retrieval ready",
        value: formatCount(counts.retrieval_ready_evidence),
        note: "Approved evidence allowed into default retrieval.",
      },
      {
        label: "Approved links",
        value: formatCount(counts.approved_relationships),
        note: "Reviewed entity relationships available for cultural context.",
      },
    ],
    [counts],
  );

  useEffect(() => {
    let cancelled = false;

    async function loadInstituteSurface() {
      setLoading(true);
      setError(null);

      try {
        const [countMap, queue, retrievalPolicies, retrievalRuns] = await Promise.all([
          getInstituteAdminOverviewCountMap(),
          listHumanReviewQueueItems({ limit: 8 }),
          listRetrievalPolicies(),
          listRetrievalRuns({ limit: 8 }),
        ]);

        if (cancelled) return;

        setCounts(countMap);
        setQueueItems(queue);
        setPolicies(retrievalPolicies);
        setRuns(retrievalRuns);
      } catch (err) {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : String(err));
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadInstituteSurface();

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="space-y-6 p-6">
      <header className="rounded-3xl border border-wk-border bg-wk-surface p-6 shadow-sm">
        <div className="text-[12px] font-bold uppercase tracking-[0.2em] text-wk-brand">WAKILISHA Institute</div>
        <div className="mt-3 max-w-3xl">
          <h1 className="text-3xl font-black tracking-tight text-wk-text">Inquiry Operating System</h1>
          <p className="mt-3 text-[14px] leading-6 text-wk-text-muted">
            The control room for inquiries, human review, retrieval readiness, relationship context, and the small AI layer that must stay accountable to evidence.
          </p>
        </div>
        <div className="mt-5 flex flex-wrap gap-3">
          <Link to="/admin/institute/inquiries" className="rounded-full border border-wk-border px-4 py-2 text-[13px] font-bold text-wk-text hover:border-wk-brand/40">
            Open Inquiries
          </Link>
          <Link to="/admin/institute/review" className="rounded-full bg-wk-brand px-4 py-2 text-[13px] font-bold text-wk-brand-on hover:opacity-90">
            Open review queue
          </Link>
          <Link to="/admin/relationships/viewer" className="rounded-full border border-wk-border px-4 py-2 text-[13px] font-bold text-wk-text hover:border-wk-brand/40">
            View relationships
          </Link>
          <Link to="/admin/review/queue" className="rounded-full border border-wk-border px-4 py-2 text-[13px] font-bold text-wk-text hover:border-wk-brand/40">
            Legacy review queue
          </Link>
        </div>
      </header>

      {error && (
        <div className="rounded-2xl border border-wk-danger/20 bg-wk-danger/10 p-4 text-[13px] font-semibold text-wk-danger">
          {error}
        </div>
      )}

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {stats.map((stat) => (
          <StatCard key={stat.label} {...stat} />
        ))}
      </section>

      {loading ? (
        <div className="rounded-2xl border border-wk-border bg-wk-surface p-6 text-[13px] text-wk-text-muted">
          Loading Institute surface…
        </div>
      ) : (
        <section className="grid gap-6 xl:grid-cols-[1.4fr_1fr]">
          <div className="space-y-4">
            <div className="flex items-end justify-between gap-4">
              <div>
                <h2 className="text-xl font-black text-wk-text">Human review queue</h2>
                <p className="mt-1 text-[13px] text-wk-text-muted">The next decisions that protect the Institute from weak evidence and overclaiming.</p>
              </div>
              <Link to="/admin/institute/review" className="text-[13px] font-bold text-wk-brand hover:underline">
                View all
              </Link>
            </div>
            <QueuePreview items={queueItems} />
          </div>

          <div className="space-y-6">
            <div className="rounded-2xl border border-wk-border bg-wk-surface-raised p-5">
              <h2 className="text-lg font-black text-wk-text">Retrieval policies</h2>
              <p className="mt-1 text-[13px] leading-5 text-wk-text-muted">Rules for what the AI layer may use as context.</p>
              <div className="mt-4">
                <PolicyPreview policies={policies} />
              </div>
            </div>

            <div className="rounded-2xl border border-wk-border bg-wk-surface-raised p-5">
              <h2 className="text-lg font-black text-wk-text">Recent retrieval runs</h2>
              <p className="mt-1 text-[13px] leading-5 text-wk-text-muted">Logged context-building activity. No live model calls happen here.</p>
              <div className="mt-4">
                <RunPreview runs={runs} />
              </div>
            </div>
          </div>
        </section>
      )}
    </div>
  );
}
