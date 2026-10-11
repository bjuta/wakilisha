import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { WkIcon } from "@/components/design-system/Icon";
import { WkButton } from "@/components/design-system/primitives/Button";
import { WkSearchField } from "@/components/design-system/primitives/Field";
import { WkSelect } from "@/components/design-system/primitives/Select";
import { supabase } from "@/lib/supabase";
import { OPERATOR_REVIEW_PAGE_SIZE, selectOperatorReviewPageV1, type OperatorStatusV1 } from "@/services/operatorReviewSelection";
import type { HeadquartersQueueV2, QueueReviewV2 } from "@/services/miziziHeadquartersBrief";
import { projectRecordedCaseSubject } from "@/services/miziziRecordedCaseSubject";

type CaseFact = {
  id: string;
  title: string | null;
  summary: string | null;
  status: string | null;
  priority: string | null;
  created_at: string | null;
  updated_at: string | null;
  source_payload: unknown;
  resolution_payload: unknown;
};

const asRecord = (input: unknown): Record<string, unknown> =>
  input !== null && typeof input === "object" && !Array.isArray(input)
    ? input as Record<string, unknown> : {};
const words = (value: string): string =>
  value.replace(/[_-]+/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
const textOf = (value: unknown): string | null => {
  if (typeof value === "string" && value.trim()) return value.trim();
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return null;
};
const uuid = (value: string): boolean =>
  /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(value);
function readable(value: unknown): string {
  const raw = textOf(value);
  return raw ? (raw.includes("_") && !uuid(raw) ? words(raw) : raw) : "Not recorded";
}
function DateValue({ value }: { value: string | null }) {
  if (!value) return <>Not recorded</>;
  const date = new Date(value);
  return <>{Number.isNaN(date.getTime()) ? "Unknown date" : date.toLocaleString()}</>;
}
function CaseStatus({ status }: { status: QueueReviewV2["status"] }) {
  return (
    <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-semibold ${
      status === "open"
        ? "border-wk-warning/30 bg-wk-warning-soft text-wk-warning"
        : status === "resolved"
          ? "border-wk-brand/20 bg-wk-brand-soft text-wk-brand"
          : "border-wk-border bg-wk-surface-raised text-wk-text-muted"
    }`}>
      {status === "other" ? "Other status" : words(status)}
    </span>
  );
}
function Fact({ name, value }: { name: string; value: unknown }) {
  return (
    <div className="min-w-0 border-b border-wk-border py-3 last:border-b-0">
      <dt className="text-[11px] font-semibold text-wk-text-muted">{name}</dt>
      <dd className="mt-1 break-words text-[13px] text-wk-text">{readable(value)}</dd>
    </div>
  );
}

/** Only reads a review that was already included in the authenticated Registry inventory. */
export function MiziziEvidenceWorkbench({
  queue,
  selectedId,
  onSelectedIdChange,
}: {
  queue: HeadquartersQueueV2;
  selectedId: string | null;
  onSelectedIdChange: (id: string | null) => void;
}) {
  const [status, setStatus] = useState<OperatorStatusV1>("open");
  const [workstream, setWorkstream] = useState("");
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [detail, setDetail] = useState<{ kind: "loading" | "error" | "ready"; value?: CaseFact }>({ kind: "loading" });
  const [showReference, setShowReference] = useState(false);

  const selection = useMemo(() => selectOperatorReviewPageV1(queue.items, {
    status, workstream, search: query, page,
  }), [queue.items, status, workstream, query, page]);
  const selected = queue.items.find((item) => item.id === selectedId) ?? null;

  useEffect(() => {
    // Preserve a deep-linked/session-selected claim even if it is outside the current list page.
    if (selected) return;
    const first = selection.items[0];
    if (first) onSelectedIdChange(first.id);
  }, [selection.items, selected, onSelectedIdChange]);

  useEffect(() => {
    setShowReference(false);
    if (!selected || !uuid(selected.id)) {
      setDetail({ kind: "error" });
      return;
    }
    let active = true;
    setDetail({ kind: "loading" });
    void supabase.from("registry_review_items")
      .select("id,title,summary,status,priority,created_at,updated_at,source_payload,resolution_payload")
      .eq("id", selected.id).single()
      .then(({ data, error }) => {
        if (!active) return;
        if (error || !data || data.id !== selected.id || data.status !== selected.sourceStatus) {
          setDetail({ kind: "error" });
          return;
        }
        setDetail({ kind: "ready", value: data as CaseFact });
      }, () => { if (active) setDetail({ kind: "error" }); });
    return () => { active = false; };
  }, [selected?.id, selected?.sourceStatus]);

  const fact = detail.kind === "ready" ? detail.value : undefined;
  const source = asRecord(fact?.source_payload);
  const evidence = asRecord(source.evidence);
  const resolution = asRecord(fact?.resolution_payload);
  const recordedSubject = projectRecordedCaseSubject(fact?.source_payload, selected?.title ?? "");
  const peers = Array.isArray(evidence.peers) ? evidence.peers.slice(0, 8) : [];
  const evidencePairs = Object.entries(evidence).filter(([key, value]) =>
    key !== "peers" && (textOf(value) !== null)).slice(0, 9);
  const changeSelection = (id: string) => {
    if (queue.items.some((item) => item.id === id)) onSelectedIdChange(id);
  };
  return (
    <div className="grid min-w-0 overflow-hidden rounded-2xl border border-wk-border bg-wk-surface lg:grid-cols-[minmax(260px,0.78fr)_minmax(0,1.45fr)]"
      data-wk-mizizi-evidence-workbench>
      <div className="min-w-0 border-b border-wk-border lg:border-b-0 lg:border-r">
        <div className="space-y-3 border-b border-wk-border px-4 py-5">
          <div>
            <h2 className="text-[17px] font-black text-wk-text">Cores</h2>
            <p className="mt-1 text-[12px] leading-5 text-wk-text-muted">
              A claim, its recorded evidence and its current disposition.
            </p>
          </div>
          <WkSearchField ariaLabel="Find a Registry claim" value={query}
            onChange={(value) => { setQuery(value); setPage(1); onSelectedIdChange(null); }}
            placeholder="Search claims, types, references" />
          <div className="grid grid-cols-2 gap-2">
            <WkSelect ariaLabel="Claim status" value={status}
              options={[{ value: "open", label: "Open" }, { value: "resolved", label: "Resolved" },
                { value: "all", label: "All statuses" }, { value: "other", label: "Other" }]}
              onChange={(value) => {
                if (["open", "resolved", "all", "other"].includes(value)) {
                  setStatus(value as OperatorStatusV1); setPage(1); onSelectedIdChange(null);
                }
              }} />
            <WkSelect ariaLabel="Claim workstream" value={workstream}
              options={[{ value: "", label: "All workstreams" },
                ...queue.workstreams.map((group) => ({ value: group.key, label: group.label }))]}
              onChange={(value) => { setWorkstream(value); setPage(1); onSelectedIdChange(null); }} />
          </div>
          <p className="text-[11px] tabular-nums text-wk-text-muted">
            {selection.total.toLocaleString()} matching · {selection.start}–{selection.end} shown
          </p>
        </div>
        {selected && !selection.items.some((item) => item.id === selected.id) ? (
          <button type="button" onClick={() => {
            const sameStream = queue.items.filter((item) =>
              item.status === selected.status && item.workstream === selected.workstream);
            const position = sameStream.findIndex((item) => item.id === selected.id);
            setStatus(selected.status); setWorkstream(selected.workstream); setQuery("");
            setPage(position >= 0 ? Math.floor(position / OPERATOR_REVIEW_PAGE_SIZE) + 1 : 1);
          }}
            className="flex w-full items-center justify-between gap-3 border-b border-wk-border bg-wk-brand-soft px-4 py-3 text-left text-[12px] font-semibold text-wk-text focus:outline-none focus-visible:ring-2 focus-visible:ring-wk-brand">
            <span>Selected case is outside the current filters</span>
            <span className="shrink-0 text-wk-brand">Show in list</span>
          </button>
        ) : null}
        <div role="list" aria-label="Registry claims" className="max-h-[450px] overflow-y-auto lg:max-h-[min(68vh,800px)]">
          {selection.items.length ? selection.items.map((item) => (
            <div role="listitem" key={item.id} className="border-b border-wk-border last:border-b-0">
              <button type="button" aria-current={selected?.id === item.id ? "true" : undefined}
                onClick={() => changeSelection(item.id)}
                className={`w-full border-l-[3px] px-4 py-3 text-left transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-wk-brand ${
                  selected?.id === item.id
                    ? "border-l-wk-brand bg-wk-brand-soft"
                    : "border-l-transparent hover:bg-wk-surface-raised"
                }`}>
                <span className="block text-[13px] font-semibold leading-5 text-wk-text">{item.title}</span>
                <span className="mt-1.5 flex flex-wrap items-center justify-between gap-2 text-[11px] text-wk-text-muted">
                  <span>{item.workstreamLabel}</span><CaseStatus status={item.status} />
                </span>
              </button>
            </div>
          )) : (
            <p className="p-5 text-[13px] text-wk-text-muted">No claims match these filters.</p>
          )}
        </div>
        <div className="flex items-center justify-between gap-2 border-t border-wk-border px-3 py-3">
          <WkButton variant="ghost" className="wk-button-sm" disabled={selection.currentPage <= 1}
            onClick={() => { setPage(Math.max(1, selection.currentPage - 1)); onSelectedIdChange(null); }}>Previous</WkButton>
          <span className="text-[12px] tabular-nums text-wk-text-muted">{selection.currentPage} / {selection.totalPages}</span>
          <WkButton variant="ghost" className="wk-button-sm"
            disabled={selection.currentPage >= selection.totalPages}
            onClick={() => { setPage(Math.min(selection.totalPages, selection.currentPage + 1)); onSelectedIdChange(null); }}>Next</WkButton>
        </div>
      </div>
      <div className="min-w-0 px-5 py-6 sm:px-7 sm:py-8">
        {!selected ? (
          <p className="text-[13px] text-wk-text-muted">Select a case to inspect its evidence.</p>
        ) : (
          <>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-[11px] font-black uppercase tracking-wider text-wk-brand">
                {selected.workstreamLabel}
              </p>
              <CaseStatus status={selected.status} />
            </div>
            <h3 className="mt-3 max-w-3xl text-[clamp(22px,2.6vw,31px)] font-black leading-tight tracking-tight text-wk-text">
              {recordedSubject.title}
            </h3>
            {fact && recordedSubject.specific ? (
              <div className="mt-2 space-y-1 text-[12px] leading-5 text-wk-text-muted">
                <p>{selected.title}</p>
                {recordedSubject.artistReference ? (
                  <p>Recorded primary-artist reference: <span className="font-semibold text-wk-text">{recordedSubject.artistReference}</span></p>
                ) : null}
              </div>
            ) : null}
            {detail.kind === "loading" ? (
              <p role="status" className="mt-6 text-[13px] text-wk-text-muted">Reading the current Registry evidence…</p>
            ) : detail.kind === "error" || !fact ? (
              <div role="alert" className="mt-6 rounded-xl border border-wk-danger/30 p-4 text-[13px] text-wk-danger">
                Current evidence is unavailable or changed. Nothing can be inferred from this snapshot. Open the governed queue to verify.
              </div>
            ) : (
              <>
                <p className="mt-3 max-w-2xl text-[14px] leading-6 text-wk-text-muted">
                  {readable(fact.summary || source.ruleId || selected.title)}
                </p>
                <div className="mt-6 grid gap-5 xl:grid-cols-[minmax(0,1.45fr)_minmax(230px,0.9fr)]">
                  <div className="min-w-0">
                    <h4 className="text-[14px] font-black text-wk-text">Recorded Evidence</h4>
                    <p className="mt-1 text-[12px] text-wk-text-muted">
                      These fields come from the existing Registry review, not an inferred conclusion.
                    </p>
                    <dl className="mt-3 rounded-xl border border-wk-border px-4">
                      <Fact name="Rule" value={source.ruleId} />
                      <Fact name="Affected field" value={source.fieldName} />
                      {recordedSubject.artistReference ? <Fact name="Recorded primary-artist reference" value={recordedSubject.artistReference} /> : null}
                      <Fact name="Current value" value={source.currentValue} />
                      {evidencePairs.map(([name, value]) =>
                        <Fact key={name} name={words(name)} value={value} />)}
                    </dl>
                    {peers.length > 0 ? (
                      <section className="mt-5">
                        <h5 className="text-[13px] font-bold text-wk-text">Recorded Peer Evidence</h5>
                        <div className="mt-2 grid gap-2 sm:grid-cols-2">
                          {peers.map((raw, i) => {
                            const peer = asRecord(raw);
                            return (
                              <div key={String(peer.id ?? i)} className="min-w-0 rounded-xl border border-wk-border bg-wk-surface-raised p-3">
                                <p className="break-words text-[13px] font-semibold text-wk-text">
                                  {readable(peer.title || peer.trackTitle || peer.slug || peer.id)}
                                </p>
                                <p className="mt-1 break-words text-[11px] text-wk-text-muted">
                                  {readable(peer.artistName || peer.primaryArtistName || peer.sharedPrimaryArtistSlug || peer.isrc)}
                                </p>
                              </div>
                            );
                          })}
                        </div>
                      </section>
                    ) : null}
                  </div>
                  <aside className="min-w-0 space-y-5">
                    <section className="rounded-xl border border-wk-border bg-wk-surface-raised p-4">
                      <h4 className="text-[13px] font-black text-wk-text">Disposition</h4>
                      <p className="mt-2 text-[13px] leading-5 text-wk-text">
                        {selected.status === "open"
                          ? "This review is open. No new decision will be made here."
                          : selected.status === "resolved"
                            ? "The Registry marks this review resolved."
                            : `Registry status: ${selected.sourceStatus}`}
                      </p>
                      {selected.status === "resolved" ? (
                        <dl className="mt-3">
                          <Fact name="Decision receipt" value={resolution.decisionId} />
                          <Fact name="Verified operation" value={resolution.verifiedOperationId} />
                        </dl>
                      ) : null}
                    </section>
                    <section className="border-t border-wk-border pt-4">
                      <h4 className="text-[13px] font-black text-wk-text">History</h4>
                      <dl className="mt-2">
                        <Fact name="Review opened" value={fact.created_at ? new Date(fact.created_at).toLocaleString() : null} />
                        <Fact name="Last updated" value={fact.updated_at ? new Date(fact.updated_at).toLocaleString() : null} />
                        <Fact name="Recorded status" value={fact.status} />
                      </dl>
                    </section>
                    <section className="border-t border-wk-border pt-4">
                      <h4 className="text-[13px] font-black text-wk-text">Next Step</h4>
                      <p className="mt-2 text-[12px] leading-5 text-wk-text-muted">
                        A governed review is required before any decision or repair. This view cannot mutate Registry records.
                      </p>
                      <Link to={`/admin/review/queue?review=${encodeURIComponent(selected.id)}`}
                        className="wk-button wk-button-primary wk-button-sm mt-3 inline-flex">
                        Open Governed Review <WkIcon name="ArrowRight" size={13} />
                      </Link>
                    </section>
                  </aside>
                </div>
                <div className="mt-6 border-t border-wk-border pt-3">
                  <WkButton variant="ghost" className="wk-button-sm"
                    onClick={() => setShowReference((value) => !value)}>
                    {showReference ? "Hide Technical References" : "Show Technical References"}
                  </WkButton>
                  {showReference ? (
                    <dl className="mt-3 space-y-2 text-[11px] text-wk-text-muted">
                      <div><dt className="font-semibold">Review ID</dt><dd className="break-all font-mono">{selected.id}</dd></div>
                      <div><dt className="font-semibold">Rule version</dt><dd>{readable(source.ruleVersion)}</dd></div>
                      <div><dt className="font-semibold">Snapshot</dt><dd><DateValue value={queue.readAt} /></dd></div>
                    </dl>
                  ) : null}
                </div>
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}
