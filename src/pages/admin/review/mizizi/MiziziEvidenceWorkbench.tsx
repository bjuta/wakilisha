import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { WkIcon } from "@/components/design-system/Icon";
import { WkRecordingArtwork } from "@/components/data-viz/WkRecordingArtwork";
import { WkZonedTimestamp } from "@/components/data-viz/WkZonedTimestamp";
import { WkStateMark } from "@/components/data-viz/WkStateMark";
import { WkSplitWorkspace } from "@/components/data-viz/WkSplitWorkspace";
import { WkButton } from "@/components/design-system/primitives/Button";
import { WkSearchField } from "@/components/design-system/primitives/Field";
import { supabase } from "@/lib/supabase";
import { OPERATOR_REVIEW_PAGE_SIZE, selectOperatorReviewPageV1, type OperatorStatusV1 } from "@/services/operatorReviewSelection";
import type { HeadquartersQueueV2, QueueReviewV2 } from "@/services/miziziHeadquartersBrief";
import { projectRecordedCaseSubject, type RecordedCaseSubject } from "@/services/miziziRecordedCaseSubject";
import { ISSUE_1094_CASES, loadIssue1094Brief, type Issue1094BriefRow } from "@/services/miziziIssue1094Brief";

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
  return <WkStateMark compact state={status === "other" ? "unknown" : status}
    label={status === "other" ? "Other status" : words(status)} />;
}
function Fact({ name, value }: { name: string; value: unknown }) {
  return (
    <div className="min-w-0 border-b border-wk-border py-3 last:border-b-0">
      <dt className="text-[11px] font-semibold text-wk-text-muted">{name}</dt>
      <dd className="mt-1 break-words text-[13px] text-wk-text">{readable(value)}</dd>
    </div>
  );
}


/** Each stratum is one actual Registry field, not an independent corroboration.
 * The prototype's sourced/confirmed strata cannot be asserted without evidence. */
function RecordedLayer({ name, value, first = false, last = false }: {
  name: string; value: unknown; first?: boolean; last?: boolean;
}) {
  return (
    <div className={"layer k-raw" + (first ? " first" : " cont") + (last ? " last" : "")}>
      <span className="camp">{first ? "Registry" : ""}</span>
      <span className="rock" aria-hidden="true" />
      <span className="txt"><b>{name}</b><span>{readable(value)}</span></span>
    </div>
  );
}

/** Only reads a review that was already included in the authenticated Registry inventory. */
export function MiziziEvidenceWorkbench({
  queue,
  selectedId,
  onSelectedIdChange,
  mode = "cores",
}: {
  queue: HeadquartersQueueV2;
  selectedId: string | null;
  onSelectedIdChange: (id: string | null) => void;
  mode?: "cores" | "history";
}) {
  const [status, setStatus] = useState<OperatorStatusV1>(mode === "history" ? "resolved" : "open");
  const [workstream, setWorkstream] = useState("");
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [detail, setDetail] = useState<{ kind: "loading" | "error" | "ready"; value?: CaseFact }>({ kind: "loading" });
  const [showReference, setShowReference] = useState(false);
  const [pageSubjects, setPageSubjects] = useState<{
    pageKey: string;
    subjects: Readonly<Record<string, RecordedCaseSubject>>;
    artwork: Readonly<Record<string, string>>;
  }>({ pageKey: "", subjects: {}, artwork: {} });
  const [verifiedDecision, setVerifiedDecision] = useState<{
    reviewId: string;
    status: "loading" | "verified" | "unverified";
    item?: Issue1094BriefRow;
  } | null>(null);

  const selection = useMemo(() => selectOperatorReviewPageV1(queue.items, {
    status: mode === "history" ? "resolved" : status, workstream, search: query, page,
  }), [queue.items, status, workstream, query, page, mode]);
  const selected = queue.items.find((item) => item.id === selectedId &&
    (mode !== "history" || item.status === "resolved"))
    ?? (mode === "history" ? selection.items.find((item) => item.status === "resolved")
      ?? queue.recentResolved[0] ?? null : selection.items[0] ?? null);
  const pageKey = selection.items.map((item) => item.id).join(",");

  // One bounded authenticated read for the visible page, never 301 per-item requests.
  // A missing, stale or inaccessible source falls back to the unchanged Registry title.
  useEffect(() => {
    let active = true;
    setPageSubjects({ pageKey, subjects: {}, artwork: {} });
    const pageIds = pageKey ? pageKey.split(",") : [];
    if (pageIds.length === 0) return () => { active = false; };
    void supabase.from("registry_review_items")
      .select("id,title,entity_type,source_id,source_payload")
      .in("id", pageIds)
      .then(async ({ data, error }) => {
        if (!active || error || !data || !Array.isArray(data)) return;
        const permitted = new Set(pageIds);
        const subjects: Record<string, RecordedCaseSubject> = {};
        const mediaRows: Array<{ reviewId: string; sourceId: string; kind: "track" | "release" }> = [];
        for (const row of data) {
          if (!row || typeof row.id !== "string" || !permitted.has(row.id) || row.id in subjects) {
            return; // Never display an unexpected or ambiguous row.
          }
          const review = selection.items.find((item) => item.id === row.id);
          if (!review || row.title !== review.title) continue; // Avoid changed snapshot labels.
          subjects[row.id] = projectRecordedCaseSubject(row.source_payload, review.title);
          if ((row.entity_type === "track" || row.entity_type === "release") &&
              review.subjectType === row.entity_type &&
              typeof row.source_id === "string" && uuid(row.source_id)) {
            mediaRows.push({ reviewId: row.id, sourceId: row.source_id, kind: row.entity_type });
          }
        }
        const artwork: Record<string, string> = {};
        for (const kind of ["track", "release"] as const) {
          const batch = mediaRows.filter((item) => item.kind === kind);
          if (!batch.length) continue;
          const result = await supabase.from(kind === "track" ? "registry_tracks" : "registry_releases")
            .select("id,artwork_url").in("id", [...new Set(batch.map((item) => item.sourceId))]);
          if (!active) return;
          if (result.error || !result.data) continue;
          const validIds = new Set(batch.map((item) => item.sourceId));
          const imageById = new Map<string, string>();
          for (const image of result.data) {
            if (image && typeof image.id === "string" && validIds.has(image.id) &&
                typeof image.artwork_url === "string" && !imageById.has(image.id)) {
              imageById.set(image.id, image.artwork_url);
            }
          }
          for (const item of batch) {
            const image = imageById.get(item.sourceId);
            if (image) artwork[item.reviewId] = image;
          }
        }
        if (active) setPageSubjects({ pageKey, subjects, artwork });
      });
    return () => { active = false; };
  }, [pageKey, selection.items]);

  useEffect(() => {
    const reviewId = selected?.id;
    let active = true;
    if (!reviewId || !ISSUE_1094_CASES.some((item) => item.reviewId === reviewId)) {
      setVerifiedDecision(null);
      return () => { active = false; };
    }
    setVerifiedDecision({ reviewId, status: "loading" });
    void loadIssue1094Brief().then((items) => {
      if (!active) return;
      const matched = items.find((item) => item.reviewId === reviewId);
      setVerifiedDecision(matched?.status === "blocked" || matched?.status === "completed"
        ? { reviewId, status: "verified", item: matched }
        : { reviewId, status: "unverified" });
    }, () => {
      if (active) setVerifiedDecision({ reviewId, status: "unverified" });
    });
    return () => { active = false; };
  }, [selected?.id]);

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

  // Never render a previous review's payload under the currently selected case.
  const fact = detail.kind === "ready" && detail.value?.id === selected?.id
    ? detail.value : undefined;
  const detailIsLoading = detail.kind === "loading" ||
    (detail.kind === "ready" && detail.value?.id !== selected?.id);
  const source = asRecord(fact?.source_payload);
  const evidence = asRecord(source.evidence);
  const resolution = asRecord(fact?.resolution_payload);
  const recordedSubject = projectRecordedCaseSubject(fact?.source_payload, selected?.title ?? "");
  const peers = Array.isArray(evidence.peers) ? evidence.peers.slice(0, 8) : [];
  const evidencePairs = Object.entries(evidence).filter(([key, value]) =>
    key !== "peers" && (textOf(value) !== null)).slice(0, 9);
  const exactDecision = verifiedDecision && selected && verifiedDecision.reviewId === selected.id && verifiedDecision.status === "verified"
    ? verifiedDecision.item : undefined;
  const changeSelection = (id: string) => {
    if (queue.items.some((item) => item.id === id)) onSelectedIdChange(id);
  };
  return (
    <WkSplitWorkspace data-wk-mizizi-evidence-workbench className="cores">
      <div className="core-list">
        <div className="top">
          <div>
            <h2 className="text-[17px] font-black text-wk-text">{mode === "history" ? "History" : "Cores"}</h2>
            <p className="mt-1 text-[12px] leading-5 text-wk-text-muted">
              {mode === "history" ? "Recorded review outcomes and receipts, not an outbound-delivery ledger." : "A claim, its recorded evidence and its current disposition."}
            </p>
          </div>
          <WkSearchField ariaLabel="Find a Registry claim" value={query}
            onChange={(value) => { setQuery(value); setPage(1); onSelectedIdChange(null); }}
            placeholder="Search claims, types, references" />
          <div className="border-t border-wk-border pt-2" data-wk-edge-filters>
            <div className="flex flex-wrap gap-1" aria-label="Filter by review status">
              {(mode === "history" ? ["resolved"] as const :
                ["open", "resolved", "all", "other"] as const).map((value) => (
                <button key={value} type="button" aria-pressed={status === value}
                  onClick={() => { setStatus(value); setPage(1); onSelectedIdChange(null); }}
                  className={`border-b-2 px-2 py-2 text-[12px] font-semibold ${status === value
                    ? "border-wk-brand text-wk-text"
                    : "border-transparent text-wk-text-muted hover:text-wk-text"}`}>
                  {value === "all" ? "All" : value === "other" ? "Other" : words(value)}
                </button>
              ))}
            </div>
            <div className="mt-2 flex flex-wrap gap-1" aria-label="Filter by workstream">
              <button type="button" aria-pressed={workstream === ""}
                onClick={() => { setWorkstream(""); setPage(1); onSelectedIdChange(null); }}
                className={`border px-2 py-1.5 text-[11px] font-semibold ${workstream === ""
                  ? "border-wk-brand text-wk-brand" : "border-wk-border text-wk-text-muted"}`}>
                All work
              </button>
              {queue.workstreams.map((group) => (
                <button key={group.key} type="button"
                  aria-pressed={workstream === group.key}
                  onClick={() => { setWorkstream(group.key); setPage(1); onSelectedIdChange(null); }}
                  className={`border px-2 py-1.5 text-[11px] font-semibold ${workstream === group.key
                    ? "border-wk-brand text-wk-brand" : "border-wk-border text-wk-text-muted"}`}>
                  {group.label}
                </button>
              ))}
            </div>
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
        <div role="list" aria-label="Registry claims" className="list">
          {selection.items.length ? selection.items.map((item) => (
            <div role="listitem" key={item.id} className="border-b border-wk-border last:border-b-0">
              <button type="button" aria-current={selected?.id === item.id ? "true" : undefined}
                onClick={() => changeSelection(item.id)}
                className={`w-full border-l-[3px] px-4 py-3 text-left transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-wk-brand ${
                  selected?.id === item.id
                    ? "border-l-wk-brand bg-wk-brand-soft"
                    : "border-l-transparent hover:bg-wk-surface-raised"
                }`}>
                <span className="flex min-w-0 items-center gap-3">
                  <WkRecordingArtwork
                    url={pageSubjects.pageKey === pageKey ? pageSubjects.artwork[item.id] : null}
                    title={pageSubjects.pageKey === pageKey ? pageSubjects.subjects[item.id]?.title ?? item.title : item.title}
                    kind={item.subjectType === "track" ? "track" : item.subjectType === "release" ? "release" : "other"}
                  />
                  <span className="min-w-0 flex-1 break-words text-[13px] font-semibold leading-5 text-wk-text">
                  {pageSubjects.pageKey === pageKey && pageSubjects.subjects[item.id]?.specific
                    ? pageSubjects.subjects[item.id].title
                    : item.id === selected?.id && fact && recordedSubject.specific
                      ? recordedSubject.title : item.title}
                  </span>
                </span>
                <span className="mt-1.5 flex flex-wrap items-center justify-between gap-2 text-[11px] text-wk-text-muted">
                  <span className="min-w-0 truncate">
                    {pageSubjects.pageKey === pageKey && pageSubjects.subjects[item.id]?.artistReference
                      ? `Artist ref: ${pageSubjects.subjects[item.id].artistReference}`
                      : item.workstreamLabel}
                  </span>
                  <CaseStatus status={item.status} />
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
      <div className="core-pane">
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
            <h3 className="claim">
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
            {detailIsLoading ? (
              <p role="status" className="mt-6 text-[13px] text-wk-text-muted">Reading the current Registry evidence…</p>
            ) : detail.kind === "error" || !fact ? (
              <div role="alert" className="mt-6 rounded-xl border border-wk-danger/30 p-4 text-[13px] text-wk-danger">
                Current evidence is unavailable or changed. Nothing can be inferred from this snapshot. Open the governed queue to verify.
              </div>
            ) : (
              <>
                <p className="verdict">
                  {readable(fact.summary || source.ruleId || selected.title)}
                </p>
                <div className="core-body">
                  <div className="min-w-0">
                    <h4 className="text-[14px] font-black text-wk-text">Recorded Evidence</h4>
                    <p className="mt-1 text-[12px] text-wk-text-muted">
                      These fields come from the existing Registry review, not an inferred conclusion.
                    </p>
                    <div className="sample">
                      <div className="ground-cap">
                        <span />
                        <div className="public">What the Registry records</div>
                        <span className="faint" style={{ fontSize: 13.5, paddingBottom: 9 }}>Not a public or independently verified claim</span>
                      </div>
                      <div className="layers" aria-label="Recorded Registry evidence fields">
                        <RecordedLayer name="Rule" value={source.ruleId} first />
                        <RecordedLayer name="Affected Field" value={source.fieldName} />
                        {recordedSubject.artistReference ? (
                          <RecordedLayer name="Recorded Primary-Artist Reference" value={recordedSubject.artistReference} />
                        ) : null}
                        <RecordedLayer name="Current Value" value={source.currentValue} last={evidencePairs.length === 0} />
                        {evidencePairs.map(([name, value], index) =>
                          <RecordedLayer key={name} name={words(name)} value={value}
                            last={index === evidencePairs.length - 1} />)}
                      </div>
                      <p className="count-line">These are recorded fields. They are not independent evidence groups.</p>
                    </div>
                    {peers.length > 0 ? (
                      <section className="mt-5">
                        <h5 className="text-[13px] font-bold text-wk-text">Recorded Peer Evidence</h5>
                        <div className="mt-2 grid gap-2 sm:grid-cols-2">
                          {peers.map((raw, i) => {
                            const peer = asRecord(raw);
                            return (
                              <div key={String(peer.id ?? i)} className="min-w-0 border-b border-wk-border py-3">
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
                  <aside className="side">
                    <section className="border-l-[3px] border-wk-brand bg-wk-surface-raised px-4 py-3">
                      <h4 className="text-[13px] font-black text-wk-text">Disposition</h4>
                      {exactDecision?.status === "blocked" && selected.status === "open" ? (
                        <div role="status" className="mt-3 space-y-2">
                          <WkStateMark state="blocked" label="Human decision recorded · Blocked" />
                          <p className="text-[12px] leading-5 text-wk-text-muted">{exactDecision.summary}</p>
                        </div>
                      ) : exactDecision?.status === "completed" && selected.status === "resolved" ? (
                        <p className="mt-3 text-[12px] leading-5 text-wk-text-muted">
                          Verified complete against the existing decision and operation receipts. No repair needs repeating.
                        </p>
                      ) : null}
                      {verifiedDecision?.reviewId === selected.id && verifiedDecision.status === "unverified" ? (
                        <p role="status" className="mt-3 text-[12px] leading-5 text-wk-text-muted">
                          Earlier #1094 decision evidence could not be independently verified. Check the governed record.
                        </p>
                      ) : null}
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
                        <div className="border-b border-wk-border py-3">
                          <dt className="text-[11px] font-semibold text-wk-text-muted">Review opened · Nairobi</dt>
                          <dd className="mt-1 text-[13px] text-wk-text"><WkZonedTimestamp value={fact.created_at} /></dd>
                        </div>
                        <div className="border-b border-wk-border py-3">
                          <dt className="text-[11px] font-semibold text-wk-text-muted">Last updated · Nairobi</dt>
                          <dd className="mt-1 text-[13px] text-wk-text"><WkZonedTimestamp value={fact.updated_at} /></dd>
                        </div>
                        <Fact name="Recorded status" value={fact.status} />
                      </dl>
                    </section>
                    <section className="border-t border-wk-border pt-4">
                      <h4 className="text-[13px] font-black text-wk-text">Next Step</h4>
                      <p className="mt-2 text-[12px] leading-5 text-wk-text-muted">
                        {exactDecision?.status === "blocked"
                          ? "A human duplicate decision is already recorded. The archived-credit blocker needs separate governed reconciliation; this view cannot mutate Registry records."
                          : "A governed review is required before any new decision or repair. This view cannot mutate Registry records."}
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
                      <div><dt className="font-semibold">Snapshot (Nairobi)</dt><dd><WkZonedTimestamp value={queue.readAt} /></dd></div>
                    </dl>
                  ) : null}
                </div>
              </>
            )}
          </>
        )}
      </div>
    </WkSplitWorkspace>
  );
}
