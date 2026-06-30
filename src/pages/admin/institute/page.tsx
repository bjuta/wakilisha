import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  getInstituteAdminOverviewCountMap,
  listHumanReviewQueueItems,
  type HumanReviewQueueItem,
} from "@/services/institute";

type Counts = Record<string, number>;

interface MethodStep {
  number: string;
  question: string;
  surface: string;
  route: string;
  note: string;
  signal: string;
}

interface SurfaceCard {
  label: string;
  title: string;
  route: string;
  description: string;
  governs: string;
  metric: string;
}

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
        Nothing is waiting for human review right now. Good. The next move is to open or strengthen an Inquiry.
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

function MethodStepCard({ step }: { step: MethodStep }) {
  return (
    <Link
      to={step.route}
      className="group rounded-3xl border border-wk-border bg-wk-surface p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-wk-brand/40"
    >
      <div className="flex items-start gap-4">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-wk-border bg-wk-bg text-[15px] font-black text-wk-brand">
          {step.number}
        </div>
        <div className="min-w-0">
          <div className="text-[11px] font-black uppercase tracking-[0.16em] text-wk-brand">{step.surface}</div>
          <h3 className="mt-2 text-[18px] font-black leading-6 text-wk-text">{step.question}</h3>
          <p className="mt-2 text-[13px] leading-5 text-wk-text-muted">{step.note}</p>
          <p className="mt-3 rounded-2xl border border-wk-border bg-wk-bg p-3 text-[12px] font-bold leading-5 text-wk-text-muted">
            {step.signal}
          </p>
        </div>
      </div>
    </Link>
  );
}

function SurfaceMapCard({ card }: { card: SurfaceCard }) {
  return (
    <Link
      to={card.route}
      className="group rounded-3xl border border-wk-border bg-wk-surface p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-wk-brand/40"
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="text-[11px] font-black uppercase tracking-[0.16em] text-wk-brand">{card.label}</div>
          <h3 className="mt-2 text-[18px] font-black tracking-[-0.03em] text-wk-text">{card.title}</h3>
        </div>
        <i className="ri-arrow-right-line text-[20px] text-wk-text-faint transition group-hover:text-wk-brand" />
      </div>
      <p className="mt-3 text-[13px] leading-5 text-wk-text-muted">{card.description}</p>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <div className="rounded-2xl border border-wk-border bg-wk-bg p-3">
          <div className="text-[10px] font-black uppercase tracking-[0.14em] text-wk-text-faint">Governs</div>
          <p className="mt-1 text-[12px] font-bold leading-5 text-wk-text-muted">{card.governs}</p>
        </div>
        <div className="rounded-2xl border border-wk-border bg-wk-bg p-3">
          <div className="text-[10px] font-black uppercase tracking-[0.14em] text-wk-text-faint">Signal</div>
          <p className="mt-1 text-[12px] font-bold leading-5 text-wk-text-muted">{card.metric}</p>
        </div>
      </div>
    </Link>
  );
}

export default function AdminInstituteOverviewPage() {
  const [counts, setCounts] = useState<Counts>({});
  const [queueItems, setQueueItems] = useState<HumanReviewQueueItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const stats = useMemo(
    () => [
      {
        label: "Questions open",
        value: formatCount(counts.active_inquiries),
        note: "Open Institute questions with live research context.",
      },
      {
        label: "Judgment waiting",
        value: formatCount(counts.review_queue_items),
        note: "Human decisions waiting across evidence, relationships, submissions, drafts, and corrections.",
      },
      {
        label: "Evidence ready",
        value: formatCount(counts.retrieval_ready_evidence),
        note: "Approved evidence allowed into default context use.",
      },
      {
        label: "Relationships approved",
        value: formatCount(counts.approved_relationships),
        note: "Reviewed relationships available for cultural context.",
      },
    ],
    [counts],
  );

  const methodSteps: MethodStep[] = useMemo(
    () => [
      {
        number: "01",
        question: "What are we trying to understand?",
        surface: "Inquiry Workbench",
        route: "/admin/institute/inquiries",
        note: "Start with the question. No surface should begin as a content container.",
        signal: `${formatCount(counts.active_inquiries)} active questions need clear direction.`,
      },
      {
        number: "02",
        question: "What do we currently believe?",
        surface: "Inquiry Workbench",
        route: "/admin/institute/inquiries",
        note: "Separate current understanding from finished truth.",
        signal: "Use working belief, confidence, and open questions before writing public copy.",
      },
      {
        number: "03",
        question: "What evidence supports or weakens that belief?",
        surface: "Evidence Room",
        route: "/admin/institute/evidence",
        note: "Claims need evidence, and evidence needs limits.",
        signal: `${formatCount(counts.retrieval_ready_evidence)} evidence items are ready for default context use.`,
      },
      {
        number: "04",
        question: "What is still uncertain?",
        surface: "Review Queue",
        route: "/admin/institute/review",
        note: "Uncertainty is not failure. It protects the Institute from lazy confidence.",
        signal: `${formatCount(counts.review_queue_items)} items are waiting for human judgment.`,
      },
      {
        number: "05",
        question: "What is the next honest move?",
        surface: "Method Console",
        route: "/admin/institute/review",
        note: "The next move should strengthen the question, evidence, relationship, contributor memory, or restraint.",
        signal: "Choose the smallest move that makes the Inquiry more honest.",
      },
    ],
    [counts],
  );

  const surfaceCards: SurfaceCard[] = useMemo(
    () => [
      {
        label: "Question",
        title: "Inquiry Workbench",
        route: "/admin/institute/inquiries",
        description: "Open, shape, and strengthen the questions the Institute is trying to answer.",
        governs: "Questions, working belief, unknowns",
        metric: `${formatCount(counts.active_inquiries)} active`,
      },
      {
        label: "Evidence",
        title: "Evidence Room",
        route: "/admin/institute/evidence",
        description: "Keep claims humble by showing what evidence supports and what it does not prove.",
        governs: "Sources, claims, reliability, default-use readiness",
        metric: `${formatCount(counts.retrieval_ready_evidence)} ready`,
      },
      {
        label: "People",
        title: "Contributor Desk",
        route: "/admin/institute/contributors",
        description: "Receive human memory without letting it bypass consent, source checks, or review.",
        governs: "Contributor memory, consent, review state",
        metric: "Human memory enters carefully",
      },
      {
        label: "Meaning",
        title: "Relationship Curator",
        route: "/admin/institute/relationships",
        description: "Turn possible links into meaningful links with reasons, evidence, and public safety.",
        governs: "Connections, evidence strength, public safety",
        metric: `${formatCount(counts.approved_relationships)} approved`,
      },
      {
        label: "Judgment",
        title: "Review Queue",
        route: "/admin/institute/review",
        description: "Make the human decisions that stop weak evidence, vague claims, and unsafe public meaning.",
        governs: "Approval, rejection, correction, restraint",
        metric: `${formatCount(counts.review_queue_items)} waiting`,
      },
      {
        label: "Memory",
        title: "Library",
        route: "/library",
        description: "Read the books that govern the Institute method before the work becomes public memory.",
        governs: "Book One, Book Two, Book Three",
        metric: "Method before memory",
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
        const [countMap, queue] = await Promise.all([
          getInstituteAdminOverviewCountMap(),
          listHumanReviewQueueItems({ limit: 8 }),
        ]);

        if (cancelled) return;

        setCounts(countMap);
        setQueueItems(queue);
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
        <div className="mt-3 grid gap-6 lg:grid-cols-[1.1fr_0.9fr] lg:items-end">
          <div className="max-w-3xl">
            <h1 className="text-3xl font-black tracking-tight text-wk-text">Method Console</h1>
            <p className="mt-3 text-[14px] leading-6 text-wk-text-muted">
              The Institute starts with method. Use this console to move from question, to belief, to evidence, to uncertainty, to the next honest move.
            </p>
          </div>
          <div className="rounded-2xl border border-wk-border bg-wk-bg p-4">
            <div className="text-[11px] font-black uppercase tracking-[0.16em] text-wk-brand">Rule</div>
            <p className="mt-2 text-[14px] font-black leading-6 text-wk-text">
              No claim travels farther than its question, evidence, review, and restraint can carry.
            </p>
          </div>
        </div>
        <div className="mt-5 flex flex-wrap gap-3">
          <Link to="/admin/institute/inquiries" className="rounded-full border border-wk-border px-4 py-2 text-[13px] font-bold text-wk-text hover:border-wk-brand/40">
            Open Inquiry Workbench
          </Link>
          <Link to="/admin/institute/review" className="rounded-full bg-wk-brand px-4 py-2 text-[13px] font-bold text-wk-brand-on hover:opacity-90">
            Open Review Queue
          </Link>
          <Link to="/library" className="rounded-full border border-wk-border px-4 py-2 text-[13px] font-bold text-wk-text hover:border-wk-brand/40">
            Open Library
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

      <section className="rounded-3xl border border-wk-border bg-wk-surface-raised p-5 shadow-sm">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="text-[12px] font-black uppercase tracking-[0.18em] text-wk-brand">Five-screen rule</div>
            <h2 className="mt-2 text-2xl font-black tracking-tight text-wk-text">Move through the method before you move the story.</h2>
            <p className="mt-2 max-w-3xl text-[13px] leading-6 text-wk-text-muted">
              Every Institute surface should answer these five questions. If one answer is weak, the next honest move is not publishing. It is strengthening the work.
            </p>
          </div>
          <Link to="/library" className="rounded-full border border-wk-border px-4 py-2 text-[13px] font-bold text-wk-text hover:border-wk-brand/40">
            Read the method
          </Link>
        </div>

        <div className="mt-5 grid gap-4 xl:grid-cols-5">
          {methodSteps.map((step) => (
            <MethodStepCard key={step.number} step={step} />
          ))}
        </div>
      </section>

      {loading ? (
        <div className="rounded-2xl border border-wk-border bg-wk-surface p-6 text-[13px] text-wk-text-muted">
          Opening the Method Console...
        </div>
      ) : (
        <section className="grid gap-6 xl:grid-cols-[1.35fr_0.9fr]">
          <div className="space-y-4">
            <div className="flex items-end justify-between gap-4">
              <div>
                <div className="text-[12px] font-black uppercase tracking-[0.18em] text-wk-brand">Next honest move</div>
                <h2 className="mt-2 text-xl font-black text-wk-text">Human review queue</h2>
                <p className="mt-1 text-[13px] text-wk-text-muted">The next decisions that protect the Institute from weak evidence, vague claims, and unsafe public meaning.</p>
              </div>
              <Link to="/admin/institute/review" className="text-[13px] font-bold text-wk-brand hover:underline">
                View all
              </Link>
            </div>
            <QueuePreview items={queueItems} />
          </div>

          <aside className="rounded-3xl border border-wk-border bg-wk-surface p-5 shadow-sm">
            <div className="text-[12px] font-black uppercase tracking-[0.18em] text-wk-brand">Operating discipline</div>
            <h2 className="mt-2 text-xl font-black text-wk-text">What this console is for</h2>
            <div className="mt-4 space-y-3 text-[13px] leading-6 text-wk-text-muted">
              <p>It does not replace the Workbench. It tells you where method is weak.</p>
              <p>It does not publish. It points to the surface where a human should make the next decision.</p>
              <p>It does not reward activity. It rewards clearer questions, stronger evidence, honest uncertainty, and safer public meaning.</p>
            </div>
          </aside>
        </section>
      )}

      <section className="rounded-3xl border border-wk-border bg-wk-surface-raised p-5 shadow-sm">
        <div>
          <div className="text-[12px] font-black uppercase tracking-[0.18em] text-wk-brand">Institute surfaces</div>
          <h2 className="mt-2 text-2xl font-black tracking-tight text-wk-text">Where the method lives</h2>
          <p className="mt-2 max-w-3xl text-[13px] leading-6 text-wk-text-muted">
            Each surface exists to protect one part of the Institute method. Choose the surface based on what needs to become more honest.
          </p>
        </div>

        <div className="mt-5 grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
          {surfaceCards.map((card) => (
            <SurfaceMapCard key={card.title} card={card} />
          ))}
        </div>
      </section>
    </div>
  );
}
