import { useMemo, useState } from "react";
import { WkButton } from "@/components/design-system/primitives/Button";
import { WkIcon } from "@/components/design-system/Icon";
import { WkStateMark } from "@/components/data-viz/WkStateMark";
import { WkZonedTimestamp } from "@/components/data-viz/WkZonedTimestamp";
import type { HeadquartersQueueV2, QueueReviewV2 } from "@/services/miziziHeadquartersBrief";
import { projectMiziziReviewRootsV1 } from "@/services/miziziReviewRoots";

/** The Registry's real classification roots: source review -> workstream -> entity type.
 * Leaf marks are review records, NOT operations or lines of independent evidence.
 */
export function MiziziReviewRoots({ queue, onInspect }: {
  queue: HeadquartersQueueV2;
  onInspect: (reviewId: string) => void;
}) {
  const roots = useMemo(() => {
    try { return projectMiziziReviewRootsV1(queue); }
    catch { return null; }
  }, [queue]);
  const [selection, setSelection] = useState<string | null>(null);
  const [selectedSubject, setSelectedSubject] = useState<string | null>(null);
  const [selectedReviewId, setSelectedReviewId] = useState<string | null>(null);
  const [visibleCount, setVisibleCount] = useState(8);
  const [visibleMarks, setVisibleMarks] = useState(24);
  if (!roots) {
    return <p role="alert" className="rounded-xl border border-wk-border p-5 text-[13px] text-wk-danger">
      The Registry review relationships could not be reconciled. No roots are shown.
    </p>;
  }
  if (roots.total === 0) {
    return <div role="status" className="rounded-xl border border-wk-border p-5 text-[13px] text-wk-text-muted">
      There are no recorded Registry reviews in this snapshot.
    </div>;
  }
  const chosen = roots.workstreams.find(group => group.key === selection) ?? roots.workstreams[0];
  const matchingReviews = selectedSubject ?
    chosen.reviews.filter(review => review.subjectType === selectedSubject) : chosen.reviews;
  const selectedReview = matchingReviews.find(review => review.id === selectedReviewId) ?? null;
  const chooseWorkstream = (key: string) => {
    setSelection(key); setSelectedSubject(null); setSelectedReviewId(null); setVisibleCount(8); setVisibleMarks(24);
  };
  const chooseSubject = (key: string, subject: string) => {
    setSelection(key); setSelectedSubject(current => current === subject && key === chosen.key ? null : subject);
    setSelectedReviewId(null); setVisibleCount(8); setVisibleMarks(24);
  };
  const chooseReview = (key: string, subject: string, id: string) => {
    setSelection(key); setSelectedSubject(subject); setSelectedReviewId(id);
  };
  const statusName = (review: QueueReviewV2): string =>
    review.status === "other" ? review.sourceStatus : review.status;

  return (
    <section data-wk-mizizi-review-roots aria-label="Registry review roots"
      className="mz-roots-map">
      <div className="mz-roots-heading">
        <div className="flex min-w-0 items-center gap-3">
          <WkIcon name="GitBranch" size={20} aria-hidden="true" />
          <div className="min-w-0">
            <h2 className="text-[17px] font-bold text-wk-text">The roots of the Registry</h2>
            <p className="text-[12px] leading-5 text-wk-text-muted">
              Registry review → workstream → subject type → recorded review
            </p>
          </div>
        </div>
        <span className="shrink-0 text-[12px] font-semibold tabular-nums text-wk-text">
          {roots.total.toLocaleString()} reviews
        </span>
      </div>
      <div className="mz-roots-tree">
        {roots.workstreams.map(group => (
          <section key={group.key} className={"mz-root-branch " + (chosen.key === group.key ? "is-active" : "")}>
            <button type="button" className="mz-root-workstream"
              aria-expanded={chosen.key === group.key}
              aria-pressed={chosen.key === group.key}
              onClick={() => chooseWorkstream(group.key)}>
              <span className="min-w-0 font-semibold text-wk-text">{group.label}</span>
              <span className="mz-root-branch-counts">
                <strong>{group.total} reviews</strong>
                <span>{group.open} open · {group.resolved} resolved{group.other ? " · " + group.other + " other" : ""}</span>
              </span>
              <WkIcon name={chosen.key === group.key ? "ChevronDown" : "ChevronRight"} size={16} aria-hidden="true" />
            </button>
            {chosen.key === group.key ? (
              <div className="mz-root-subjects">
                {group.subjects.map(subject => (
                  <div className="mz-root-subject" key={subject.name}>
                    <button type="button" className="mz-root-subject-title"
                      aria-expanded={selectedSubject === subject.name}
                      aria-pressed={selectedSubject === subject.name}
                      onClick={() => chooseSubject(group.key, subject.name)}>
                      <span className="min-w-0 font-semibold text-wk-text">{subject.name}</span>
                      <span className="tabular-nums text-wk-text-muted">
                        {subject.open} open · {subject.resolved} resolved · {subject.reviews.length} total
                      </span>
                      <WkIcon name={selectedSubject === subject.name ? "ChevronDown" : "ChevronRight"} size={14} aria-hidden="true" />
                    </button>
                    {selectedSubject === subject.name ? (
                      <div className="mz-root-subject-expanded">
                        <p className="mb-3 text-[12px] text-wk-text-muted">
                          Select a review to see its record. These are the exact reviews in this subject.
                        </p>
                        <div className="mz-root-leaves" role="group"
                          aria-label={group.label + ", " + subject.name + ": recorded reviews"}>
                          {subject.reviews.slice(0, visibleMarks).map(review => (
                            <button key={review.id} type="button" data-wk-root-review={review.id}
                              title={review.title + " · " + statusName(review)}
                              aria-label={"Inspect " + review.title + ", " + statusName(review)}
                              aria-pressed={selectedReviewId === review.id && chosen.key === group.key}
                              onClick={() => chooseReview(group.key, subject.name, review.id)}
                              className={"mz-root-leaf mz-root-leaf-" + review.status} />
                          ))}
                        </div>
                        {subject.reviews.length > visibleMarks ? (
                          <WkButton variant="ghost" className="wk-button-sm mt-3"
                            onClick={() => setVisibleMarks(count => Math.min(count + 24, subject.reviews.length))}>
                            Show More Review Marks ({Math.min(visibleMarks, subject.reviews.length)} of {subject.reviews.length})
                          </WkButton>
                        ) : null}
                      </div>
                    ) : null}
                  </div>
                ))}
              </div>
            ) : null}
          </section>
        ))}
      </div>
      <div className="mz-roots-legend" aria-label="Recorded review state key">
        <span><i className="mz-root-leaf mz-root-leaf-open" /> Open</span>
        <span><i className="mz-root-leaf mz-root-leaf-resolved" /> Resolved</span>
        <span><i className="mz-root-leaf mz-root-leaf-other" /> Other recorded state</span>
        <span className="ml-auto text-wk-text-muted">Each visible mark is one review</span>
      </div>
      <div className="mz-roots-inspection" aria-live="polite">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-[14px] font-bold text-wk-text">
            {chosen.label}{selectedSubject ? " · " + selectedSubject : ""}
            <span className="font-normal text-wk-text-muted">
              {" · " + matchingReviews.length + " recorded reviews"}
            </span>
          </h3>
          <div className="flex flex-wrap gap-3 text-[11px] tabular-nums text-wk-text-muted">
            <span>Open {chosen.open}</span><span>Resolved {chosen.resolved}</span>
            {chosen.other > 0 ? <span>Other {chosen.other}</span> : null}
          </div>
        </div>
        {selectedReview ? (
          <article className="mz-root-selected" aria-live="polite" data-wk-root-selected={selectedReview.id}>
            <div className="flex min-w-0 flex-wrap items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="mb-1 text-[11px] text-wk-text-muted">Selected Registry review · {selectedReview.subjectType}</p>
                <h4 className="break-words text-[16px] font-bold text-wk-text">{selectedReview.title}</h4>
              </div>
              <WkStateMark compact state={selectedReview.status === "resolved" ? "resolved" :
                selectedReview.status === "open" ? "open" : "unknown"} label={statusName(selectedReview)} />
            </div>
            <p className="mt-2 break-all font-mono text-[11px] text-wk-text-muted">{selectedReview.id}</p>
            {selectedReview.updatedAt ? <p className="mt-1 text-[11px] text-wk-text-muted">Recorded update: <WkZonedTimestamp value={selectedReview.updatedAt} /></p> : null}
            <p className="mt-2 text-[12px] text-wk-text-muted">Explore this recorded review here before opening its evidence in Cores.</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <WkButton variant="soft" className="wk-button-sm"
                onClick={() => onInspect(selectedReview.id)}>Inspect in Cores <WkIcon name="ArrowRight" size={13} /></WkButton>
              <WkButton variant="ghost" className="wk-button-sm"
                onClick={() => setSelectedReviewId(null)}>Close detail</WkButton>
            </div>
          </article>
        ) : null}
        <p className="mb-2 text-[12px] text-wk-text-muted">Browse recorded reviews in this branch</p>
        <ul className="mz-roots-review-list">
          {matchingReviews.slice(0, visibleCount).map(review => (
            <li key={review.id}>
              <span className="min-w-0">
                <span className="block truncate text-[12px] font-semibold text-wk-text">{review.title}</span>
                <span className="text-[11px] text-wk-text-muted">{review.subjectType}</span>
              </span>
              <WkStateMark state={review.status === "resolved" ? "resolved" :
                review.status === "open" ? "open" : "unknown"}
                label={statusName(review)} compact />
              <WkButton variant="ghost" className="wk-button-sm shrink-0"
                onClick={() => { setSelectedReviewId(review.id); setSelectedSubject(review.subjectType); }}>
                Explore
              </WkButton>
            </li>
          ))}
        </ul>
        {matchingReviews.length > visibleCount ? (
          <WkButton variant="ghost" className="wk-button-sm mt-3"
            onClick={() => setVisibleCount(count => Math.min(count + 8, matchingReviews.length))}>
            Show more reviews ({Math.min(visibleCount, matchingReviews.length)} of {matchingReviews.length})
          </WkButton>
        ) : null}
      </div>
      <p className="mz-info-line mt-3">
        Every connection here means recorded membership in the review inventory, not causation,
        elapsed work, independent evidence, or rights. This is a snapshot, not a history of actions.
      </p>
    </section>
  );
}
