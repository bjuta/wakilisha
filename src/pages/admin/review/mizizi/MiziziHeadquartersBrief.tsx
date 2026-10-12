import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { WkSurface } from "@/components/design-system/primitives/Surface";
import { WkStateMark } from "@/components/data-viz/WkStateMark";
import { WkZonedTimestamp } from "@/components/data-viz/WkZonedTimestamp";
import { WkButton } from "@/components/design-system/primitives/Button";
import { WkIcon } from "@/components/design-system/Icon";
import { MiziziEvidenceWorkbench } from "./MiziziEvidenceWorkbench";
import { MiziziReviewField } from "./MiziziReviewField";
import { loadIssue1094Brief, type Issue1094BriefRow } from "@/services/miziziIssue1094Brief";
import {
  loadHeadquartersQueueV2,
  type HeadquartersQueueV2,
  type QueueReviewV2,
} from "@/services/miziziHeadquartersBrief";


/** The HTML's root-cascade illustration, drawn only from current real review rows.
 * Decorative branching does NOT assert an overnight processing timeline. */
function MiziziReviewRoots({ queue }: { queue: HeadquartersQueueV2 }) {
  const ref = useRef<HTMLCanvasElement | null>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let raf = 0;
    const draw = () => {
      const box = el.getBoundingClientRect();
      if (!box.width) return;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      el.width = Math.round(box.width * dpr);
      el.height = Math.round(box.height * dpr);
      const ctx = el.getContext("2d");
      if (!ctx) return;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, box.width, box.height);
      ctx.strokeStyle = "#EFE6D8"; ctx.globalAlpha = .86;
      ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(0, 1); ctx.lineTo(box.width, 1); ctx.stroke();
      const items = queue.items;
      if (!items.length) return;
      const hash = (s: string) => {
        let n = 2166136261;
        for (let i = 0; i < s.length; i++) n = Math.imul(n ^ s.charCodeAt(i), 16777619);
        return n >>> 0;
      };
      items.forEach((review, i) => {
        const seed = hash(review.id);
        const x = box.width * ((i + .5) / items.length);
        const height = Math.min(box.height - 6, 32 + (seed % 190));
        const color = review.status === "resolved" ? "#84C241" :
          review.status === "open" ? "#E5AC43" : "#B297FF";
        ctx.strokeStyle = color; ctx.globalAlpha = .38 + (seed % 37) / 100;
        const stem = 18 + (seed % 36);
        ctx.lineWidth = .5 + (seed % 3) * .25;
        ctx.beginPath(); ctx.moveTo(x, 2);
        ctx.bezierCurveTo(x - 6, stem * .6, x + (seed % 29) - 14, stem, x + (seed % 39) - 19, height);
        ctx.stroke();
        const branches = 3 + (seed % 3);
        for (let j = 1; j <= branches; j++) {
          const y = height * j / (branches + 1);
          const b = (j % 2 ? -1 : 1) * (9 + (seed % 12));
          ctx.beginPath(); ctx.moveTo(x + (seed % 15) - 7, y);
          ctx.quadraticCurveTo(x + b * .7, y + 12, x + b, Math.min(box.height - 3, y + 22));
          ctx.stroke();
        }
      });
      ctx.globalAlpha = 1;
    };
    const observer = new ResizeObserver(() => { cancelAnimationFrame(raf); raf = requestAnimationFrame(draw); });
    observer.observe(el); draw();
    return () => { observer.disconnect(); cancelAnimationFrame(raf); };
  }, [queue]);
  return <canvas ref={ref} id="growth" role="img"
    aria-label={"Root illustration of " + queue.total + " current Registry reviews. Green represents resolved, ochre represents open, and purple represents other review states. No timing is inferred."}/>;
}

function ReviewPreview({ items, onInspect }: { items: readonly QueueReviewV2[]; onInspect?: (id: string) => void }) {
  if (!items.length) {
    return <p className="px-4 py-6 text-[13px] text-wk-text-muted">No reviews to show.</p>;
  }
  return (
    <ul className="divide-y divide-wk-border">
      {items.map((item) => (
        <li key={item.id} className="flex flex-col gap-1 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
          <div className="min-w-0">
            <p className="break-words text-[13px] font-semibold text-wk-text">{item.title}</p>
            <p className="mt-1 text-[11px] text-wk-text-muted">{item.workstreamLabel}</p>
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
      ))}
    </ul>
  );
}


/** One-review-at-a-time work session over the existing authorized review snapshot.
 * Skipping is local to the session; decisions remain exclusively in Registry authority.
 */
/** HTML-inspired three entry points, backed only by the current authenticated queue.
 * A session is a local reading aid, not a clock, approval or decision ledger.
 */
function OperatorReviewSession({
  queue, onInspect,
}: { queue: HeadquartersQueueV2; onInspect: (id: string) => void }) {
  const [minutes, setMinutes] = useState<"5" | "15" | "60" | null>(null);
  const [skipped, setSkipped] = useState<readonly string[]>([]);
  const openReviews = queue.items.filter((item) => item.status === "open");
  const cap = minutes === "5" ? 3 : minutes === "15" ? 8 : 24;
  const sessionItems = openReviews.slice(0, cap);
  const nextReview = sessionItems.find((item) => !skipped.includes(item.id)) ?? null;
  const finish = () => { setMinutes(null); setSkipped([]); };
  return (
    <section aria-label="Make time for reviews" className="time min-w-0">
      <div className="time-head">
        <div>
          <h2>
            How long do you have?
          </h2>
          <p className="mt-1 text-[12px] leading-5 text-wk-text-muted">
            Focus on one real open review at a time. Skipping never records a decision.
          </p>
        </div>
        <span className="text-[12px] tabular-nums text-wk-text-muted">
          {openReviews.length.toLocaleString()} open reviews
        </span>
      </div>
      {minutes === null ? (
        <div className="choices">
          {([
            { value: "5", title: "Five minutes", maximum: 3, description: "Start with three open reviews. Keep the session small." },
            { value: "15", title: "Fifteen minutes", maximum: 8, description: "Work through a focused set of eight open reviews." },
            { value: "60", title: "An hour", maximum: 24, description: "Inspect up to 24 reviews at your own pace." },
          ] as const).map((choice, i) => (
            <button type="button" key={choice.value} disabled={openReviews.length === 0}
              onClick={() => { setMinutes(choice.value); setSkipped([]); }}
              className={"choice" + (i === 0 ? " primary" : "")}>
              <span className="len">{choice.title}</span>
              <p>{choice.description}</p>
              <span className="go">Start <span>Up to {Math.min(openReviews.length, choice.maximum)} cases</span></span>
            </button>
          ))}
        </div>
      ) : (
        <div className="mt-4 rounded-2xl border border-wk-border bg-wk-surface p-5" data-wk-mizizi-session>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-[12px] font-bold text-wk-brand">{minutes}-minute review session</p>
            <WkButton variant="ghost" className="wk-button-sm" onClick={finish}>Done for Now</WkButton>
          </div>
          <p className="mt-1 text-[12px] text-wk-text-muted">
            {skipped.length} skipped · Up to {sessionItems.length} in this session · No changes saved
          </p>
          {nextReview ? (
            <div className="mt-5">
              <p className="text-[11px] font-semibold text-wk-text-muted">{nextReview.workstreamLabel}</p>
              <h4 className="mt-2 text-[20px] font-black tracking-tight text-wk-text">{nextReview.title}</h4>
              <div className="mt-5 flex flex-wrap gap-2">
                <WkButton className="wk-button-sm" onClick={() => onInspect(nextReview.id)}>
                  Open its Core <WkIcon name="ArrowRight" size={14} />
                </WkButton>
                <WkButton variant="ghost" className="wk-button-sm"
                  onClick={() => setSkipped((current) =>
                    current.includes(nextReview.id) ? current : [...current, nextReview.id])}>
                  Skip for Now
                </WkButton>
              </div>
            </div>
          ) : (
            <p role="status" className="mt-5 text-[13px] text-wk-text">
              That is everything in this session. The Registry reviews remain unchanged.
            </p>
          )}
        </div>
      )}
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
                  label={item.status === "completed" ? "Verified complete" :
                    item.status === "blocked" ? "Decision recorded · blocked" : "Needs verification"}
                />
              </div>
              <p className="mt-2 text-[12px] leading-5 text-wk-text-muted">{item.summary}</p>
              {item.status !== "unverified" ? (
                <WkButton variant="soft" className="wk-button-sm mt-3"
                  onClick={() => onInspect(item.reviewId)}>
                  View Evidence in Cores <WkIcon name="ArrowRight" size={13} />
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
            <div className="growth-box"><MiziziReviewRoots queue={queue} /></div>
            <div className="strata">
              <span><i style={{ background: "#84C241" }} />Resolved <b>{queue.resolved.toLocaleString()}</b></span>
              <span><i style={{ background: "#E5AC43" }} />Open <b>{queue.open.toLocaleString()}</b></span>
              {queue.other > 0 ? <span><i style={{ background: "#B297FF" }} />Other <b>{queue.other.toLocaleString()}</b></span> : null}
              <span className="faint">{queue.total.toLocaleString()} recorded reviews across {queue.workstreams.length} workstreams</span>
            </div>
            <p className="mz-info-line mt-3">Each drawn root represents an existing review. This is a snapshot, not a history of actions.</p>
          </header>
          <OperatorReviewSession queue={queue} onInspect={inspect} />
          <div className="mz-brief-columns">
            <section className="min-w-0">
              <div className="sect-head"><h2>Worth Knowing</h2>
                <button className="link" onClick={onShowCases}>Explore Cores</button>
              </div>
              <Issue1094WorthKnowing revision={revision} onInspect={inspect} />
            </section>
            <section className="min-w-0">
              <div className="sect-head"><h2>Open Reviews</h2>
                <button className="link" onClick={onShowCases}>All Reviews</button>
              </div>
              <div className="lic-mini">
                {queue.workstreams.filter(group => group.open > 0).map(group => (
                  <div className="row" key={group.key} style={{ gridTemplateColumns: "minmax(0,1fr) 60px" }}>
                    <span>{group.label}</span>
                    <span className="v">{group.open.toLocaleString()}</span>
                  </div>
                ))}
              </div>
              <p className="mt-3 text-[13px] muted">These counts come from the current Registry queue. No licence or automated action is implied.</p>
            </section>
          </div>
          <section>
            <div className="sect-head"><h2>Recent Work</h2>
              <button className="link" onClick={onShowCases}>Explore Cores</button>
            </div>
            <div style={{ borderTop: "1px solid var(--seam)" }}>
              <ReviewPreview items={queue.recentOpen.slice(0, 4)} onInspect={inspect} />
            </div>
          </section>
        </div>
      ) : null}

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
