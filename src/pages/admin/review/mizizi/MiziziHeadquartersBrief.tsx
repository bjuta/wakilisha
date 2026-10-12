import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { WkSurface } from "@/components/design-system/primitives/Surface";
import { WkStatusDistribution } from "@/components/data-viz/WkStatusDistribution";
import { WkStateMark } from "@/components/data-viz/WkStateMark";
import { WkZonedTimestamp } from "@/components/data-viz/WkZonedTimestamp";
import { WkRankedBars } from "@/components/data-viz/WkRankedBars";
import { WkTabs } from "@/components/design-system/primitives/Tabs";
import { WkButton } from "@/components/design-system/primitives/Button";
import { WkSearchField } from "@/components/design-system/primitives/Field";
import { WkSelect } from "@/components/design-system/primitives/Select";
import { selectOperatorReviewPageV1, type OperatorStatusV1 } from "@/services/operatorReviewSelection";
import { WkIcon } from "@/components/design-system/Icon";
import { MiziziEvidenceWorkbench } from "./MiziziEvidenceWorkbench";
import { loadIssue1094Brief, type Issue1094BriefRow } from "@/services/miziziIssue1094Brief";
import {
  loadHeadquartersQueueV2,
  type HeadquartersQueueV2,
  type QueueReviewV2,
} from "@/services/miziziHeadquartersBrief";

const TABS = [
  { id: "open", label: "Open Reviews" },
  { id: "resolved", label: "Review History" },
] as const;

type Tab = "open" | "resolved";

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


/** Browse the existing queue without duplicating or adjudicating a Registry review. */
function OperatorReviewExplorer({ queue, onInspect }: { queue: HeadquartersQueueV2; onInspect: (id: string) => void }) {
  const [status, setStatus] = useState<OperatorStatusV1>("open");
  const [workstream, setWorkstream] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const selection = useMemo(() => selectOperatorReviewPageV1(queue.items, {
    status, workstream, search, page,
  }), [queue.items, status, workstream, search, page]);
  const statusOptions = [
    { value: "open", label: "Open" },
    { value: "resolved", label: "Resolved" },
    { value: "other", label: "Other" },
    { value: "all", label: "All Statuses" },
  ];
  const workstreamOptions = [
    { value: "", label: "All Workstreams" },
    ...queue.workstreams.map((group) => ({ value: group.key, label: group.label })),
  ];
  const updateStatus = (value: string) => {
    if (value === "open" || value === "resolved" || value === "other" || value === "all") {
      setStatus(value);
      setPage(1);
    }
  };
  return (
    <div className="border-t border-wk-border px-4 py-5 sm:px-5" aria-label="Browse Registry reviews">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-[14px] font-black text-wk-text">Browse Reviews</h3>
        <span className="text-[12px] tabular-nums text-wk-text-muted">
          {selection.total.toLocaleString()} matching
        </span>
      </div>
      <div className="mt-3 grid gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,180px)_minmax(0,200px)]">
        <WkSearchField
          ariaLabel="Search reviews"
          placeholder="Search reviews"
          value={search}
          onChange={(value) => { setSearch(value); setPage(1); }}
        />
        <WkSelect
          ariaLabel="Review status"
          value={status}
          options={statusOptions}
          onChange={updateStatus}
        />
        <WkSelect
          ariaLabel="Review workstream"
          value={workstream}
          options={workstreamOptions}
          onChange={(value) => { setWorkstream(value); setPage(1); }}
        />
      </div>
      {selection.total === 0 ? (
        <p role="status" className="mt-4 rounded-xl bg-wk-surface-raised p-4 text-[13px] text-wk-text-muted">
          No reviews match these filters.
        </p>
      ) : (
        <div className="mt-4 overflow-hidden rounded-xl border border-wk-border">
          <ReviewPreview items={selection.items} onInspect={onInspect} />
        </div>
      )}
      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <span className="text-[12px] tabular-nums text-wk-text-muted" aria-live="polite">
          {selection.start.toLocaleString()}–{selection.end.toLocaleString()} of {selection.total.toLocaleString()}
        </span>
        <div className="flex items-center gap-2">
          <WkButton variant="ghost" className="wk-button-sm"
            disabled={selection.currentPage <= 1}
            onClick={() => setPage(Math.max(1, selection.currentPage - 1))}>
            Previous
          </WkButton>
          <span className="text-[12px] tabular-nums text-wk-text-muted">
            {selection.currentPage} / {selection.totalPages}
          </span>
          <WkButton variant="ghost" className="wk-button-sm"
            disabled={selection.currentPage >= selection.totalPages}
            onClick={() => setPage(Math.min(selection.totalPages, selection.currentPage + 1))}>
            Next
          </WkButton>
        </div>
      </div>
    </div>
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
    <section aria-label="Make time for reviews" className="min-w-0">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h3 className="text-[clamp(19px,2.4vw,27px)] font-black tracking-tight text-wk-text">
            How long do you have?
          </h3>
          <p className="mt-1 text-[12px] leading-5 text-wk-text-muted">
            Focus on one real open review at a time. Skipping never records a decision.
          </p>
        </div>
        <span className="text-[12px] tabular-nums text-wk-text-muted">
          {openReviews.length.toLocaleString()} open reviews
        </span>
      </div>
      {minutes === null ? (
        <div className="mt-4 grid gap-3 md:grid-cols-3">
          {([
            { value: "5", title: "Five minutes", maximum: 3, description: "Start with three open reviews. Keep the session small." },
            { value: "15", title: "Fifteen minutes", maximum: 8, description: "Work through a focused set of eight open reviews." },
            { value: "60", title: "An hour", maximum: 24, description: "Inspect up to 24 reviews at your own pace." },
          ] as const).map((choice, i) => (
            <button type="button" key={choice.value} disabled={openReviews.length === 0}
              onClick={() => { setMinutes(choice.value); setSkipped([]); }}
              className={`group flex min-h-[168px] flex-col justify-between rounded-2xl border p-5 text-left transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-wk-brand disabled:cursor-not-allowed disabled:opacity-40 ${
                i === 0
                  ? "border-wk-brand/30 bg-wk-brand-soft hover:border-wk-brand"
                  : "border-wk-border bg-wk-surface hover:border-wk-brand/40 hover:bg-wk-surface-raised"
              }`}>
              <span>
                <strong className="block text-[22px] font-black tracking-tight text-wk-text">{choice.title}</strong>
                <span className="mt-3 block text-[13px] leading-5 text-wk-text-muted">{choice.description}</span>
              </span>
              <span className="mt-4 flex items-center justify-between gap-3 text-[12px] font-bold text-wk-text">
                Start session <span className="flex items-center gap-1 text-wk-text-muted">Up to {Math.min(openReviews.length, choice.maximum)} cases <WkIcon name="ArrowRight" size={14} /></span>
              </span>
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
  const [tab, setTab] = useState<Tab>("open");
  const [fieldWorkstream, setFieldWorkstream] = useState<string | null>(null);
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
        <>
          <header className="border-b border-wk-border pb-7 pt-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-[11px] font-black uppercase tracking-wider text-wk-brand">Headquarters Brief</p>
              <WkButton variant="ghost" className="wk-button-sm" onClick={refresh}>
                <WkIcon name="RefreshCcw" size={14} /> Refresh
              </WkButton>
            </div>
            <h2 className="mt-4 text-[clamp(26px,3.4vw,41px)] font-black tracking-tight text-wk-text">
              The Registry at a glance
            </h2>
            <div className="mt-5">
              <WkStatusDistribution
                ariaLabel="Current Registry review states"
                expectedTotal={queue.total}
                segments={[
                  { key: "open", label: "Open", count: queue.open, tone: "open" },
                  { key: "resolved", label: "Resolved", count: queue.resolved, tone: "resolved" },
                  ...(queue.other > 0
                    ? [{ key: "other", label: "Other", count: queue.other, tone: "neutral" } as const]
                    : []),
                ]}
              />
            </div>
            <div className="mt-5 flex flex-wrap items-center gap-x-5 gap-y-2 text-[12px] text-wk-text-muted">
              <span><strong className="tabular-nums text-wk-text">{queue.total.toLocaleString()}</strong> recorded reviews</span>
              <span><strong className="tabular-nums text-wk-text">{queue.workstreams.length}</strong> workstreams</span>
              <span>Read at <WkZonedTimestamp value={queue.readAt} /></span>
              <WkButton variant="soft" className="wk-button-sm" onClick={onShowCases}>
                Open the Cores <WkIcon name="ArrowRight" size={14} />
              </WkButton>
            </div>
          </header>

          <OperatorReviewSession queue={queue} onInspect={inspect} />

          <div className="grid items-start gap-8 border-t border-wk-border pt-7 xl:grid-cols-[minmax(0,1.45fr)_minmax(280px,0.95fr)]">
            <section className="min-w-0">
              <Issue1094WorthKnowing revision={revision} onInspect={inspect} />
            </section>
            <section className="min-w-0">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h3 className="text-[16px] font-black text-wk-text">Where attention is needed</h3>
                <span className="text-[12px] text-wk-text-muted">Open reviews</span>
              </div>
              <div className="mt-4 border-y border-wk-border">
                <WkRankedBars
                  ariaLabel="Open reviews by workstream"
                  total={queue.open}
                  valueLabel="open reviews"
                  items={queue.workstreams
                    .filter((group) => group.open > 0)
                    .map((group) => ({
                      key: group.key,
                      label: group.label,
                      value: group.open,
                    }))}
                />
              </div>
              <p className="mt-3 text-[12px] leading-5 text-wk-text-muted">
                All claims and supporting records can be inspected without recording a decision.
              </p>
              <WkButton variant="ghost" className="wk-button-sm mt-3" onClick={onShowCases}>
                Explore the evidence <WkIcon name="ArrowRight" size={13} />
              </WkButton>
            </section>
          </div>

          <section className="border-t border-wk-border pt-7">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="text-[16px] font-black text-wk-text">Recent work</h3>
                <p className="mt-1 text-[12px] text-wk-text-muted">A small selection from the current Registry, not the full queue.</p>
              </div>
              <WkButton variant="ghost" className="wk-button-sm" onClick={onShowCases}>
                Explore Cores <WkIcon name="ArrowRight" size={13} />
              </WkButton>
            </div>
            <div className="mt-3 overflow-hidden rounded-xl border border-wk-border bg-wk-surface">
              <ReviewPreview items={queue.recentOpen.slice(0, 4)} onInspect={inspect} />
            </div>
          </section>
        </>
      ) : null}

      {queue && view === "field" ? (
        <div className="space-y-5">
          <header className="border-b border-wk-border pb-5">
            <h2 className="text-[clamp(25px,3vw,37px)] font-black tracking-tight text-wk-text">The Field</h2>
            <p className="mt-2 max-w-2xl text-[13px] leading-6 text-wk-text-muted">
              A real, searchable view of workstream coverage in the current Registry.
              An artist–recording graph is not shown until its relationships can be verified from live catalogue data.
            </p>
          </header>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {queue.workstreams.map((group) => (
              <button key={group.key} type="button"
                onClick={() => setFieldWorkstream(group.key === fieldWorkstream ? null : group.key)}
                aria-pressed={fieldWorkstream === group.key}
                className={`rounded-2xl border p-5 text-left transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-wk-brand ${
                  fieldWorkstream === group.key
                    ? "border-wk-brand bg-wk-brand-soft"
                    : "border-wk-border bg-wk-surface hover:bg-wk-surface-raised"
                }`}>
                <h3 className="text-[15px] font-bold text-wk-text">{group.label}</h3>
                <p className="mt-3 text-[29px] font-black tabular-nums text-wk-text">{group.open.toLocaleString()}
                  <span className="ml-2 text-[12px] font-normal text-wk-text-muted">open</span>
                </p>
                <p className="mt-2 text-[12px] text-wk-text-muted">
                  {group.resolved.toLocaleString()} resolved
                </p>
                <span className="mt-4 block text-[12px] font-semibold text-wk-brand">
                  {fieldWorkstream === group.key ? "Hide cases" : "Show cases"} <WkIcon name="ArrowRight" size={13} />
                </span>
              </button>
            ))}
          </div>
          {fieldWorkstream ? (
            <WkSurface className="overflow-hidden p-0">
              <div className="border-b border-wk-border p-4">
                <h3 className="text-[15px] font-bold text-wk-text">
                  {queue.workstreams.find((group) => group.key === fieldWorkstream)?.label ?? "Workstream"} · recent open cases
                </h3>
              </div>
              <ReviewPreview items={queue.items.filter((item) =>
                item.workstream === fieldWorkstream && item.status === "open").slice(0, 8)} onInspect={inspect} />
              <div className="border-t border-wk-border px-4 py-3">
                <WkButton className="wk-button-sm" onClick={onShowCases}>
                  Explore all Cores <WkIcon name="ArrowRight" size={13} />
                </WkButton>
              </div>
            </WkSurface>
          ) : (
            <p className="text-[12px] text-wk-text-muted">Choose a workstream to inspect its recorded cases.</p>
          )}
        </div>
      ) : null}

      {queue && view === "cores" ? (
        <MiziziEvidenceWorkbench
          queue={queue}
          selectedId={selectedId}
          onSelectedIdChange={onSelectedIdChange}
        />
      ) : null}

      {queue && view === "history" ? (
        <div className="space-y-4">
          <header className="border-b border-wk-border pb-5">
            <h2 className="text-[clamp(25px,3vw,37px)] font-black tracking-tight text-wk-text">History</h2>
            <p className="mt-2 max-w-2xl text-[13px] leading-6 text-wk-text-muted">
              Recorded Registry review outcomes. This is not an outbound delivery ledger:
              deliveries are shown only when verified integration receipts exist.
            </p>
          </header>
          <WkSurface className="overflow-hidden p-0">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-wk-border px-4 py-4">
              <h3 className="text-[15px] font-bold text-wk-text">Recent review records</h3>
              <span className="text-[12px] text-wk-text-muted">
                {queue.resolved.toLocaleString()} resolved overall
              </span>
            </div>
            <div className="px-3 pt-3 sm:px-4">
              <WkTabs items={TABS} value={tab} onChange={setTab}
                ariaLabel="History status" tabListClassName="overflow-x-auto">
                <ReviewPreview items={tab === "open" ? queue.recentOpen : queue.recentResolved}
                  onInspect={inspect} />
              </WkTabs>
            </div>
            <OperatorReviewExplorer queue={queue} onInspect={inspect} />
          </WkSurface>
        </div>
      ) : null}
    </section>
  );
}
