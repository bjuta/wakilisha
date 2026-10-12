import { useMemo, useState } from "react";
import { WkButton } from "@/components/design-system/primitives/Button";
import { WkIcon } from "@/components/design-system/Icon";
import { WkStateMark } from "@/components/data-viz/WkStateMark";
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
            <button type="button"
              className="mz-root-workstream"
              aria-pressed={chosen.key === group.key}
              onClick={() => setSelection(group.key)}>
              <span className="min-w-0 font-semibold text-wk-text">{group.label}</span>
              <span className="shrink-0 tabular-nums text-wk-text-muted">{group.total} reviews</span>
              <WkIcon name="ChevronRight" size={16} aria-hidden="true" />
            </button>
            <div className="mz-root-subjects">
              {group.subjects.map(subject => (
                <div className="mz-root-subject" key={subject.name}>
                  <div className="mz-root-subject-title">
                    <span className="font-semibold text-wk-text">{subject.name}</span>
                    <span className="tabular-nums text-wk-text-muted">{subject.reviews.length}</span>
                  </div>
                  <div className="mz-root-leaves" aria-hidden="true">
                    {subject.reviews.map(review => (
                      <span key={review.id} data-wk-root-review={review.id}
                        className={"mz-root-leaf mz-root-leaf-" + review.status} />
                    ))}
                  </div>
                  <p className="mz-root-status-counts">
                    <span>Open {subject.open}</span>
                    <span>Resolved {subject.resolved}</span>
                    {subject.other ? <span>Other {subject.other}</span> : null}
                  </p>
                </div>
              ))}
            </div>
          </section>
        ))}
      </div>
      <div className="mz-roots-legend" aria-label="Recorded review state key">
        <span><i className="mz-root-leaf mz-root-leaf-open" /> Open</span>
        <span><i className="mz-root-leaf mz-root-leaf-resolved" /> Resolved</span>
        <span><i className="mz-root-leaf mz-root-leaf-other" /> Other recorded state</span>
        <span className="ml-auto text-wk-text-muted">One mark = one review</span>
      </div>
      <div className="mz-roots-inspection" aria-live="polite">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-[14px] font-bold text-wk-text">
            {chosen.label} <span className="font-normal text-wk-text-muted">· {chosen.total} recorded reviews</span>
          </h3>
          <div className="flex flex-wrap gap-3 text-[11px] tabular-nums text-wk-text-muted">
            <span>Open {chosen.open}</span><span>Resolved {chosen.resolved}</span>
            {chosen.other > 0 ? <span>Other {chosen.other}</span> : null}
          </div>
        </div>
        <p className="mb-2 text-[12px] text-wk-text-muted">Recent reviews in this workstream</p>
        <ul className="mz-roots-review-list">
          {chosen.reviews.slice(0, 4).map(review => (
            <li key={review.id}>
              <span className="min-w-0">
                <span className="block truncate text-[12px] font-semibold text-wk-text">{review.title}</span>
                <span className="text-[11px] text-wk-text-muted">{review.subjectType}</span>
              </span>
              <WkStateMark state={review.status === "resolved" ? "resolved" :
                review.status === "open" ? "open" : "unknown"}
                label={statusName(review)} compact />
              <WkButton variant="ghost" className="wk-button-sm shrink-0"
                onClick={() => onInspect(review.id)}>
                Inspect
              </WkButton>
            </li>
          ))}
        </ul>
        {chosen.reviews.length > 4 ? (
          <p className="mt-2 text-[11px] text-wk-text-muted">
            Showing 4 of {chosen.total} reviews. Explore Cores for the complete authenticated list.
          </p>
        ) : null}
      </div>
      <p className="mz-info-line mt-3">
        Every connection here means recorded membership in the review inventory, not causation,
        elapsed work, independent evidence, or rights. This is a snapshot, not a history of actions.
      </p>
    </section>
  );
}
