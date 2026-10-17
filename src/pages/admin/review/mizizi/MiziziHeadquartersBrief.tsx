import { MiziziDurableCasesPanel } from "./MiziziDurableCasesPanel";
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { WkSurface } from "@/components/design-system/primitives/Surface";
import { WkStateMark } from "@/components/data-viz/WkStateMark";
import { WkStatusDistribution } from "@/components/data-viz/WkStatusDistribution";
import { WkRankedBars } from "@/components/data-viz/WkRankedBars";
import { WkZonedTimestamp } from "@/components/data-viz/WkZonedTimestamp";
import { WkButton } from "@/components/design-system/primitives/Button";
import { Modal } from "@/components/design-system/primitives/Modal";
import { WkIcon } from "@/components/design-system/Icon";
import { WkContextHelp } from "@/components/design-system/primitives/ContextHelp";
import { MiziziEvidenceWorkbench } from "./MiziziEvidenceWorkbench";
import { MiziziReviewField } from "./MiziziReviewField";
import { MiziziReviewRoots } from "./MiziziReviewRoots";
import { loadMiziziCaseSubjects, type CaseSubject } from "@/services/miziziCaseField";
import { reviewJobDisplay } from "@/services/reviewJobDisplay";
import { loadIssue1094Brief, type Issue1094BriefRow } from "@/services/miziziIssue1094Brief";
import {
  loadHeadquartersQueueV2,
  type HeadquartersQueueV2,
  type QueueReviewV2,
} from "@/services/miziziHeadquartersBrief";


function ReviewPreview({ items, onInspect, subjects }: {
  items: readonly QueueReviewV2[];
  onInspect?: (id: string) => void;
  subjects: ReadonlyMap<string, CaseSubject>;
}) {
  if (!items.length) {
    return <p className="px-4 py-6 text-[13px] text-wk-text-muted">No reviews to show.</p>;
  }
  return (
    <ul className="divide-y divide-wk-border">
      {items.map((item) => {
        const job = reviewJobDisplay(item, subjects.get(item.id));
        return (
        <li key={item.id} className="flex flex-col gap-1 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
          <div className="min-w-0">
            <p className="break-words text-[13px] font-semibold text-wk-text">{job.title}</p>
            <p className="mt-1 text-[11px] text-wk-text-muted">
              {job.type}{job.credits.length ? " · " + job.credits.join(", ") : ""}
              {job.isrc ? " · ISRC " + job.isrc : ""}
            </p>
            <p className="mt-1 text-[11px] text-wk-text-muted">{job.issue}</p>
          </div>
          <div className="flex shrink-0 items-center gap-3 text-[11px] text-wk-text-muted">
            <span>{item.subjectType}</span>
            {item.status === "other" ? <span>{item.sourceStatus}</span> : null}
            {onInspect ? (
              <WkButton variant="ghost" className="wk-button-sm" onClick={() => onInspect(item.id)}>
                Inspect
              </WkButton>
            ) : null}
          </div>
        </li>
      ); })}
    </ul>
  );
}


/** Focused, bounded read-only review sessions modelled on the source HTML.
 * No timer, synthetic evidence, unsourced choices or direct writer is created here.
 * A verified human decision is only made inside the governed Core review workflow.
 */
function OperatorReviewSession({
  queue, onInspect, subjects,
}: {
  queue: HeadquartersQueueV2;
  onInspect: (id: string) => void;
  subjects: ReadonlyMap<string, CaseSubject>;
}) {
  const [minutes, setMinutes] = useState<"5" | "15" | "60" | null>(null);
  const [step, setStep] = useState(0);
  const [skipped, setSkipped] = useState<readonly string[]>([]);
  const openReviews = useMemo(() => queue.items.filter(item => item.status === "open"), [queue]);
  const limit = minutes === "5" ? 3 : minutes === "15" ? 8 : 24;
  const sessionItems = openReviews.slice(0, limit);
  const current = sessionItems[Math.min(step, sessionItems.length - 1)] ?? null;
  const job = current ? reviewJobDisplay(current, subjects.get(current.id)) : null;
  const finish = () => { setMinutes(null); setStep(0); setSkipped([]); };
  const start = (duration: "5" | "15" | "60") => {
    setMinutes(duration); setStep(0); setSkipped([]);
  };
  const inspect = () => {
    if (!current || !queue.items.some(item => item.id === current.id && item.status === "open")) return;
    const id = current.id;
    finish();
    onInspect(id);
  };

  return (
    <section aria-label="Make time for reviews" className="time min-w-0">
      <div className="time-head">
        <div>
          <h2>How long do you have?</h2>
          <WkContextHelp label="How Focused Reviews Work" title="Review at your own pace">
            Choose a set of open reviews and inspect each recording. This does not record a decision.
            You can leave at any time. Open Workbench to examine evidence.
          </WkContextHelp>
        </div>
        <span className="text-[12px] tabular-nums text-wk-text-muted">
          {openReviews.length.toLocaleString()} open reviews
        </span>
      </div>
      <div className="choices">
        {([
          { value: "5", title: "Five minutes", maximum: 3, description: "Three questions to inspect, at your own pace." },
          { value: "15", title: "Fifteen minutes", maximum: 8, description: "Eight reviews in a focused session." },
          { value: "60", title: "An hour", maximum: 24, description: "Up to 24 reviews for a deeper pass." },
        ] as const).map((choice, i) => (
          <button type="button" key={choice.value} disabled={openReviews.length === 0}
            onClick={() => start(choice.value)}
            className={"choice" + (i === 0 ? " primary" : "")}>
            <span className="len">{choice.title}</span>
            <p>{choice.description}</p>
            <span className="go">Start <span>Up to {Math.min(openReviews.length, choice.maximum)} reviews</span></span>
          </button>
        ))}
      </div>
      <Modal open={minutes !== null} onClose={finish} showClose={false} title="Review session"
        maxWidth="5xl" panelClassName="mz-session-modal" bodyClassName="mz-session-body"
        footer={minutes !== null ? (
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-[12px] text-wk-text-muted">
              {skipped.length} skipped in this session. No decisions recorded.
            </p>
            <div className="flex flex-wrap gap-2">
              <WkButton variant="ghost" className="wk-button-sm"
                disabled={step === 0} onClick={() => setStep(value => Math.max(0, value - 1))}>Previous</WkButton>
              <WkButton variant="soft" className="wk-button-sm"
                disabled={step + 1 >= sessionItems.length}
                onClick={() => setStep(value => Math.min(sessionItems.length - 1, value + 1))}>Next</WkButton>
            </div>
          </div>
        ) : null}>
        <div data-wk-mizizi-session aria-label="Focused review session">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <WkButton variant="ghost" className="wk-button-sm" onClick={finish}>
              Done for Now <span aria-hidden="true">×</span>
            </WkButton>
            <span className="text-[12px] tabular-nums text-wk-text-muted">
              {minutes}-minute selection · {current ? step + 1 : 0} of {sessionItems.length}
            </span>
          </div>
          <div className="mz-session-progress" aria-label="Review session progress">
            {sessionItems.map((item, index) => (
              <span key={item.id} className={index === step ? "is-current" :
                index < step ? "is-seen" : ""} />
            ))}
          </div>
          {current ? (
            <article className="mz-session-question" key={current.id}>
              <p className="text-[12px] font-semibold text-wk-text-muted">{job?.type} to review</p>
              <h3 className="mt-2 break-words text-[clamp(24px,3.6vw,38px)] font-bold leading-tight text-wk-text">
                {job?.title}
              </h3>
              {job?.credits.length ? (
                <p className="mt-2 text-[14px] font-medium text-wk-text">
                  Recorded artist credits: {job.credits.join(", ")}
                </p>
              ) : null}
              {job?.isrc ? <p className="mt-1 text-[12px] text-wk-text-muted">ISRC {job.isrc}</p> : null}
              <section className="mz-session-job-issue" aria-label="Recorded issue">
                <h4>What Needs Review</h4>
                <p>{current.title}</p>
              </section>
              <div className="mz-session-job-bottom">
                <span>Current state: <strong>{current.sourceStatus}</strong></span>
                <span>Review ID: <code>{current.id}</code></span>
              </div>
              {!job?.sourced && (current.subjectType === "track" || current.subjectType === "release") ? (
                <p role="status" className="mt-3 text-[12px] text-wk-text-muted">
                  The Registry source name is unavailable. Inspect Workbench before deciding.
                </p>
              ) : null}
              <div className="mt-6 flex flex-wrap items-center gap-3">
                <WkButton onClick={inspect}>Inspect evidence in Workbench <WkIcon name="ArrowRight" size={14}/></WkButton>
                <WkButton variant="ghost" disabled={step + 1 >= sessionItems.length}
                  onClick={() => {
                    setSkipped(ids => ids.includes(current.id) ? ids : [...ids, current.id]);
                    setStep(value => Math.min(value + 1, sessionItems.length - 1));
                  }}>Skip for Now</WkButton>
              </div>
            </article>
          ) : (
            <p role="status" className="py-10 text-[13px] text-wk-text-muted">
              No open review is available for this session.
            </p>
          )}
        </div>
      </Modal>
    </section>
  );
}

/** Verifies accepted #1094 records from the current authenticated Registry read.
 * An unavailable record is unknown, never silently presented as complete.
 */
function Issue1094WorthKnowing({ revision, onInspect }: { revision: number; onInspect: (id: string) => void }) {
  const [expandedReceipt, setExpandedReceipt] = useState<string | null>(null);
  const [state, setState] = useState<
    | { kind: "loading" }
    | { kind: "error" }
    | { kind: "ready"; items: readonly Issue1094BriefRow[] }
  >({ kind: "loading" });
  useEffect(() => {
    let active = true;
    setState({ kind: "loading" });
    void loadIssue1094Brief().then(
      (items) => { if (active) setState({ kind: "ready", items }); },
      () => { if (active) setState({ kind: "error" }); },
    );
    return () => { active = false; };
  }, [revision]);

  return (
    <div aria-label="Worth Knowing">
      <h3 className="text-[14px] font-black text-wk-text">Worth Knowing</h3>
      <p className="mt-1 text-[12px] text-wk-text-muted">
        Three recording decisions from the existing Registry record. Nothing is changed here.
      </p>
      {state.kind === "loading" ? (
        <p role="status" className="mt-3 text-[12px] text-wk-text-muted">
          Checking decision and operation receipts…
        </p>
      ) : state.kind === "error" ? (
        <p role="alert" className="mt-3 text-[12px] text-wk-danger">
          The #1094 records could not be verified. Use Refresh to try again.
        </p>
      ) : (
        <div className="mt-4 divide-y divide-wk-border border-y border-wk-border">
          {state.items.map((item) => (
            <article key={item.reviewId} className="py-5 first:pt-4 last:pb-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h4 className="text-[13px] font-bold text-wk-text">{item.title}</h4>
                <WkStateMark
                  compact
                  state={item.status === "completed" ? "verified" :
                    item.status === "blocked" ? "blocked" : "unverified"}
                  label={item.status === "completed" ? "Recorded repair · receipt matched" :
                    item.status === "blocked" ? "Decision recorded · blocked" : "Needs verification"}
                />
              </div>
              <p className="mt-2 text-[12px] leading-5 text-wk-text-muted">{item.summary}</p>
              {item.status !== "unverified" ? (
                <WkButton variant="soft" className="wk-button-sm mt-3"
                  onClick={() => onInspect(item.reviewId)}>
                  View Evidence in Workbench <WkIcon name="ArrowRight" size={13} />
                </WkButton>
              ) : null}
              {item.status !== "unverified" ? (
                <>
                  <WkButton
                    variant="ghost"
                    className="wk-button-sm mt-3"
                    onClick={() => setExpandedReceipt((current) =>
                      current === item.reviewId ? null : item.reviewId)}
                  >
                    {expandedReceipt === item.reviewId ? "Hide Receipt" : "Show Receipt"}
                  </WkButton>
                  {expandedReceipt === item.reviewId ? (
                    <dl className="mt-3 space-y-1 text-[11px] text-wk-text-muted">
                      <div><dt className="inline font-semibold">Decision: </dt>
                        <dd className="inline break-all font-mono">{item.decisionId}</dd></div>
                      {item.status === "completed" && item.operationId ? (
                        <div><dt className="inline font-semibold">Operation: </dt>
                          <dd className="inline break-all font-mono">{item.operationId}</dd></div>
                      ) : null}
                    </dl>
                  ) : null}
                </>
              ) : null}
              {item.status === "blocked" ? (
                <Link className="mt-3 inline-flex text-[12px] font-semibold text-wk-brand hover:underline"
                  to={`/admin/review/queue?review=${encodeURIComponent(item.reviewId)}`}>
                  Inspect open review <WkIcon name="ArrowRight" size={13} />
                </Link>
              ) : null}
            </article>
          ))}
        </div>
      )}
    </div>
  );
}

export function MiziziHeadquartersBrief({
  view = "brief",
  onShowReviews = () => {},
  onShowCases = () => {},
  selectedId = null,
  onSelectedIdChange = () => {},
}: {
  view?: "brief" | "field" | "cores" | "history";
  onShowReviews?: () => void;
  onShowCases?: () => void;
  selectedId?: string | null;
  onSelectedIdChange?: (id: string | null) => void;
}) {
  const [revision, setRevision] = useState(0);
  const [state, setState] = useState<
    | { kind: "loading" }
    | { kind: "error" }
    | { kind: "ready"; queue: HeadquartersQueueV2 }
  >({ kind: "loading" });

  useEffect(() => {
    let active = true;
    setState({ kind: "loading" });
    void loadHeadquartersQueueV2().then(
      (queue) => { if (active) setState({ kind: "ready", queue }); },
      () => { if (active) setState({ kind: "error" }); },
    );
    return () => { active = false; };
  }, [revision]);

  const queue = state.kind === "ready" ? state.queue : null;
  const [caseSubjects, setCaseSubjects] = useState<ReadonlyMap<string, CaseSubject>>(new Map());
  const [subjectReadError, setSubjectReadError] = useState(false);
  useEffect(() => {
    if (!queue || view !== "brief") return;
    let active = true;
    setCaseSubjects(new Map());
    setSubjectReadError(false);
    void loadMiziziCaseSubjects(queue).then(
      rows => { if (active) setCaseSubjects(new Map(rows.map(row => [row.reviewId, row]))); },
      () => { if (active) setSubjectReadError(true); },
    );
    return () => { active = false; };
  }, [queue, view]);
  const inspect = (id: string) => {
    if (!queue?.items.some((item) => item.id === id)) return;
    onSelectedIdChange(id);
    onShowCases();
  };
  const refresh = () => {
    onSelectedIdChange(null);
    setRevision((value) => value + 1);
  };

  return (
    <section aria-label={view === "brief" ? "Headquarters Brief" : `MIZIZI ${view}`}
      data-wk-mizizi-headquarters-brief
      className="min-w-0 space-y-6">
      {state.kind === "loading" ? (
        <WkSurface className="space-y-4 p-6" role="status">
          <div className="h-10 max-w-lg animate-pulse rounded-xl bg-wk-surface-raised" />
          <div className="h-24 animate-pulse rounded-xl bg-wk-surface-raised" />
          <div className="h-16 animate-pulse rounded-xl bg-wk-surface-raised" />
        </WkSurface>
      ) : state.kind === "error" ? (
        <WkSurface className="p-6">
          <p role="alert" className="text-[13px] text-wk-danger">
            The current Registry review inventory could not be verified. No counts or decisions can be inferred.
          </p>
          <WkButton variant="soft" className="wk-button-sm mt-4" onClick={refresh}>
            <WkIcon name="RefreshCcw" size={14} /> Try Again
          </WkButton>
        </WkSurface>
      ) : null}

      {queue && view === "brief" ? (
        <div className="mz-brief-shell">
          <header className="night">
            <div className="night-copy">
              <p className="when">Current authenticated Registry review inventory · Read at <WkZonedTimestamp value={queue.readAt} /></p>
              <h1>Across the Registry, <strong>{queue.resolved.toLocaleString()}</strong> reviews are resolved. <em>{queue.open.toLocaleString()} still need attention.</em></h1>
            </div>
            <MiziziReviewRoots queue={queue} onInspect={inspect} subjects={caseSubjects} />
            <div className="mt-5">
              <WkStatusDistribution expectedTotal={queue.total}
                ariaLabel="Current Registry review states"
                segments={[
                  { key: "open", label: "Open reviews", count: queue.open, tone: "open" },
                  { key: "resolved", label: "Resolved reviews", count: queue.resolved, tone: "resolved" },
                  ...(queue.other > 0 ? [{ key: "other", label: "Other recorded states", count: queue.other, tone: "neutral" } as const] : []),
                ]} />
              <p className="mt-3 text-[12px] text-wk-text-muted">
                {queue.total.toLocaleString()} recorded reviews across {queue.workstreams.length} workstreams
              </p>
            </div>
          </header>
          {subjectReadError ? (
             <p role="status" className="text-[12px] text-wk-text-muted">
               Some source names are unavailable. Reviews remain accessible in Workbench.
             </p>
           ) : null}
           <OperatorReviewSession queue={queue} onInspect={inspect} subjects={caseSubjects} />
          <div className="mz-brief-columns">
            <section className="min-w-0">
              <div className="sect-head"><h2>Worth Knowing</h2>
                <WkButton variant="ghost" className="wk-button-sm" onClick={onShowCases}>Explore Workbench</WkButton>
              </div>
              <Issue1094WorthKnowing revision={revision} onInspect={inspect} />
            </section>
            <section className="min-w-0">
              <div className="sect-head"><h2>Open Reviews</h2>
                <WkButton variant="ghost" className="wk-button-sm" onClick={onShowCases}>All Reviews</WkButton>
              </div>
              <WkRankedBars ariaLabel="Open reviews by workstream"
                items={queue.workstreams.filter(group => group.open > 0).map(group =>
                  ({ key: group.key, label: group.label, value: group.open }))}
                total={queue.open} valueLabel="open reviews" />
              <p className="mt-3 text-[13px] muted">These counts come from the current Registry queue. No licence or automated action is implied.</p>
            </section>
          </div>
          <section>
            <div className="sect-head"><h2>Recent Work</h2>
              <button className="link" onClick={onShowCases}>Explore Workbench</button>
            </div>
            <div style={{ borderTop: "1px solid var(--seam)" }}>
              <ReviewPreview items={queue.recentOpen.slice(0, 4)} onInspect={inspect} subjects={caseSubjects} />
            </div>
          </section>
        </div>
      ) : null}

      {queue && view === "brief" ? <MiziziDurableCasesPanel /> : null}

      {queue && view === "field" ? (
        <MiziziReviewField queue={queue} onInspect={inspect} />
      ) : null}

      {queue && view === "cores" ? (
        <MiziziEvidenceWorkbench
          queue={queue}
          selectedId={selectedId}
          onSelectedIdChange={onSelectedIdChange}
        />
      ) : null}

      {queue && view === "history" ? (
        <MiziziEvidenceWorkbench mode="history" queue={queue} selectedId={selectedId}
          onSelectedIdChange={onSelectedIdChange} />
      ) : null}
    </section>
  );
}
