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
