import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { WkSurface } from "@/components/design-system/primitives/Surface";
import { WkTabs } from "@/components/design-system/primitives/Tabs";
import { WkButton } from "@/components/design-system/primitives/Button";
import { WkSearchField } from "@/components/design-system/primitives/Field";
import { WkSelect } from "@/components/design-system/primitives/Select";
import { WkInspector } from "@/components/design-system/primitives/Inspector";
import { selectOperatorReviewPageV1, selectReviewForInspectionV1, type OperatorStatusV1 } from "@/services/operatorReviewSelection";
import { WkIcon } from "@/components/design-system/Icon";
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
function OperatorReviewSession({
  queue, onInspect,
}: { queue: HeadquartersQueueV2; onInspect: (id: string) => void }) {
  const [minutes, setMinutes] = useState("15");
  const [active, setActive] = useState(false);
  const [skipped, setSkipped] = useState<readonly string[]>([]);
  const openReviews = queue.items.filter((item) => item.status === "open");
  const nextReview = openReviews.find((item) => !skipped.includes(item.id)) ?? null;
  const finish = () => {
    setActive(false);
    setSkipped([]);
  };

  return (
    <div className="border-t border-wk-border px-4 py-5 sm:px-5" aria-label="Review session">
      <h3 className="text-[14px] font-black text-wk-text">Make Time for Reviews</h3>
      <p className="mt-1 text-[12px] text-wk-text-muted">
        Work through one open review at a time. Your time choice is a guide, not a countdown.
      </p>
      {active ? (
        <div className="mt-3 space-y-3 rounded-xl border border-wk-border bg-wk-surface-raised p-4">
          <p className="text-[12px] text-wk-text-muted">
            {minutes} minute session · {openReviews.length} currently open · {skipped.length} skipped for this session
          </p>
          {nextReview ? (
            <>
              <div>
                <p className="text-[13px] font-semibold text-wk-text">{nextReview.title}</p>
                <p className="mt-1 text-[12px] text-wk-text-muted">{nextReview.workstreamLabel}</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <WkButton variant="secondary" className="wk-button-sm" onClick={() => onInspect(nextReview.id)}>
                  Inspect Review
                </WkButton>
                <WkButton
                  variant="ghost"
                  className="wk-button-sm"
                  onClick={() => setSkipped((current) =>
                    current.includes(nextReview.id) ? current : [...current, nextReview.id])}
                >
                  Skip for Now
                </WkButton>
              </div>
            </>
          ) : (
            <p role="status" className="text-[13px] text-wk-text">
              No more open reviews in this session. Skipped reviews remain open.
            </p>
          )}
          <WkButton variant="ghost" className="wk-button-sm" onClick={finish}>
            Done for Now
          </WkButton>
          <p className="text-[11px] text-wk-text-muted">
            Skips are not decisions. Only decisions recorded in the review queue are saved.
            Reopen a session to see the current review list.
          </p>
        </div>
      ) : (
        <div className="mt-3 flex flex-wrap items-end gap-3">
          <div className="w-full sm:w-44">
            <WkSelect
              ariaLabel="Approximate review time"
              value={minutes}
              options={[
                { value: "5", label: "5 minutes" },
                { value: "15", label: "15 minutes" },
                { value: "60", label: "60 minutes" },
              ]}
              onChange={(value) => {
                if (value === "5" || value === "15" || value === "60") setMinutes(value);
              }}
            />
          </div>
          <WkButton
            variant="secondary"
            className="wk-button-sm"
            disabled={openReviews.length === 0}
            onClick={() => { setSkipped([]); setActive(true); }}
          >
            Start Review Session
          </WkButton>
          <span className="text-[12px] text-wk-text-muted">{openReviews.length} open reviews available</span>
        </div>
      )}
    </div>
  );
}

/** Verifies accepted #1094 records from the current authenticated Registry read.
 * An unavailable record is unknown, never silently presented as complete.
 */
function Issue1094WorthKnowing({ revision }: { revision: number }) {
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
    <div className="border-t border-wk-border px-4 py-5 sm:px-5" aria-label="Worth Knowing">
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
        <div className="mt-3 grid gap-3 lg:grid-cols-3">
          {state.items.map((item) => (
            <div key={item.reviewId} className="rounded-xl border border-wk-border bg-wk-surface-raised p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h4 className="text-[13px] font-bold text-wk-text">{item.title}</h4>
                <span className="text-[11px] font-semibold text-wk-text-muted">
                  {item.status === "completed" ? "Verified complete" :
                    item.status === "blocked" ? "Decision recorded · blocked" : "Needs verification"}
                </span>
              </div>
              <p className="mt-2 text-[12px] leading-5 text-wk-text-muted">{item.summary}</p>
              {item.status !== "unverified" ? (
                <dl className="mt-3 space-y-1 text-[11px] text-wk-text-muted">
                  <div><dt className="inline font-semibold">Decision: </dt>
                    <dd className="inline break-all font-mono">{item.decisionId}</dd></div>
                  {item.status === "completed" && item.operationId ? (
                    <div><dt className="inline font-semibold">Operation: </dt>
                      <dd className="inline break-all font-mono">{item.operationId}</dd></div>
                  ) : null}
                </dl>
              ) : null}
              {item.status === "blocked" ? (
                <Link className="mt-3 inline-flex text-[12px] font-semibold text-wk-brand hover:underline"
                  to={`/admin/review/queue?review=${encodeURIComponent(item.reviewId)}`}>
                  Inspect open review <WkIcon name="ArrowRight" size={13} />
                </Link>
              ) : null}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function MiziziHeadquartersBrief() {
  const [revision, setRevision] = useState(0);
  const [tab, setTab] = useState<Tab>("open");
  const [inspectedId, setInspectedId] = useState<string | null>(null);
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

  const inspectedReview = state.kind === "ready"
    ? selectReviewForInspectionV1(state.queue.items, inspectedId)
    : null;

  return (
    <section aria-label="Headquarters Brief" data-wk-mizizi-headquarters-brief>
      <WkSurface className="overflow-hidden p-0">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-wk-border px-4 py-4 sm:px-5">
          <div>
            <h2 className="text-[17px] font-black tracking-tight text-wk-text">Headquarters Brief</h2>
            <p className="mt-1 text-[12px] text-wk-text-muted">Work that needs attention across the music Registry.</p>
          </div>
          <div className="flex items-center gap-2">
            <WkButton
              variant="ghost"
              className="wk-button-sm"
              disabled={state.kind === "loading"}
              onClick={() => { setInspectedId(null); setRevision((value) => value + 1); }}
            >
              <WkIcon name="RefreshCcw" size={14} />
              Refresh
            </WkButton>
            <Link to="/admin/review/queue" className="wk-button wk-button-secondary wk-button-sm">
              All Reviews <WkIcon name="ArrowRight" size={13} />
            </Link>
          </div>
        </div>
        {state.kind === "loading" ? (
          <div role="status" className="space-y-3 p-5">
            <div className="h-16 animate-pulse rounded-xl bg-wk-surface-raised" />
            <div className="h-16 animate-pulse rounded-xl bg-wk-surface-raised" />
          </div>
        ) : state.kind === "error" ? (
          <div role="alert" className="p-5 text-[13px] text-wk-danger">
            We couldn’t load the review list. Try again.
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-3 p-4 sm:grid-cols-3 sm:p-5">
              <div className="rounded-xl bg-wk-surface-raised p-4">
                <div className="text-[27px] font-black tabular-nums text-wk-text">{state.queue.open.toLocaleString()}</div>
                <div className="mt-1 text-[12px] font-semibold text-wk-text">Open Reviews</div>
              </div>
              <div className="rounded-xl bg-wk-surface-raised p-4">
                <div className="text-[27px] font-black tabular-nums text-wk-text">{state.queue.resolved.toLocaleString()}</div>
                <div className="mt-1 text-[12px] font-semibold text-wk-text">Resolved Reviews</div>
              </div>
              <div className="col-span-2 rounded-xl bg-wk-surface-raised p-4 sm:col-span-1">
                <div className="text-[27px] font-black tabular-nums text-wk-text">{state.queue.total.toLocaleString()}</div>
                <div className="mt-1 text-[12px] font-semibold text-wk-text">All Review Records</div>
              </div>
            </div>
            <div className="border-t border-wk-border px-4 py-4 sm:px-5">
              <h3 className="text-[14px] font-black text-wk-text">Workstreams</h3>
              <div className="mt-3 grid gap-2 md:grid-cols-2 xl:grid-cols-3">
                {state.queue.workstreams.map((group) => (
                  <div key={group.key} className="rounded-xl border border-wk-border bg-wk-surface-raised px-4 py-3">
                    <div className="flex items-start justify-between gap-3">
                      <p className="text-[12px] font-semibold text-wk-text">{group.label}</p>
                      <span className="text-[15px] font-black tabular-nums text-wk-text">{group.open.toLocaleString()}</span>
                    </div>
                    <p className="mt-1 text-[11px] text-wk-text-muted">Open</p>
                    {group.subjects.length > 0 ? (
                      <p className="mt-2 text-[11px] text-wk-text-muted">
                        {group.subjects.map((part) => `${part.open} ${part.label}`).join(" · ")}
                      </p>
                    ) : null}
                  </div>
                ))}
              </div>
              {state.queue.other > 0 ? (
                <p className="mt-3 text-[12px] text-wk-text-muted">
                  {state.queue.other.toLocaleString()} reviews have another status.
                </p>
              ) : null}
            </div>
            <div className="border-t border-wk-border px-4 pt-4 sm:px-5">
              <WkTabs
                items={TABS}
                value={tab}
                onChange={setTab}
                ariaLabel="Review status"
                tabListClassName="overflow-x-auto"
              >
                <ReviewPreview
                  items={tab === "open" ? state.queue.recentOpen : state.queue.recentResolved}
                  onInspect={setInspectedId}
                />
              </WkTabs>
            </div>
            <Issue1094WorthKnowing revision={revision} />
            <OperatorReviewSession queue={state.queue} onInspect={setInspectedId} />
            <OperatorReviewExplorer queue={state.queue} onInspect={setInspectedId} />
            <div className="border-t border-wk-border px-4 py-3 sm:px-5">
              <Link to="/admin/review/queue" className="text-[12px] font-semibold text-wk-brand hover:underline">
                View the full review queue
              </Link>
            </div>
          </>
        )}
      </WkSurface>
      <WkInspector
        open={Boolean(inspectedReview)}
        onClose={() => setInspectedId(null)}
        title={inspectedReview?.title ?? "Review"}
        eyebrow={inspectedReview?.workstreamLabel}
        summary={
          <p className="text-[13px] text-wk-text">
            {inspectedReview?.status === "open" ? "This review needs attention." :
              inspectedReview?.status === "resolved" ? "This review is resolved." :
              inspectedReview ? `Current status: ${inspectedReview.sourceStatus}` : ""}
          </p>
        }
        advanced={inspectedReview ? (
          <dl className="space-y-3 text-[12px]">
            <div><dt className="font-semibold text-wk-text-muted">Review reference</dt>
              <dd className="mt-1 break-all font-mono text-wk-text">{inspectedReview.id}</dd></div>
            <div><dt className="font-semibold text-wk-text-muted">Last updated</dt>
              <dd className="mt-1 text-wk-text">{inspectedReview.updatedAt ?? "Date unavailable"}</dd></div>
          </dl>
        ) : null}
        advancedLabel="Review reference"
      >
        {inspectedReview ? (
          <div className="space-y-4 text-[13px] text-wk-text">
            <dl className="grid grid-cols-2 gap-3">
              <div><dt className="text-wk-text-muted">Workstream</dt><dd className="mt-1 font-semibold">{inspectedReview.workstreamLabel}</dd></div>
              <div><dt className="text-wk-text-muted">Subject</dt><dd className="mt-1 font-semibold">{inspectedReview.subjectType}</dd></div>
            </dl>
            <p className="text-wk-text-muted">Review details and decisions remain in the full review queue.</p>
            <Link to={`/admin/review/queue?review=${encodeURIComponent(inspectedReview.id)}`} className="wk-button wk-button-secondary wk-button-sm inline-flex">
              Open Review Queue <WkIcon name="ArrowRight" size={13} />
            </Link>
          </div>
        ) : null}
      </WkInspector>
    </section>
  );
}
