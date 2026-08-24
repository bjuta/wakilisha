import { useEffect, useMemo, useState } from "react";
import { WkIcon } from "@/components/design-system/Icon";
import { AdminWorkspaceSection } from "@/components/design-system/admin/AdminWorkspaceSection";
import {
  fetchTrackLyricsHistory,
  type TrackLyricsHistory,
} from "@/services/player/trackLyricsAdminService";

function formatDate(value: string | null): string {
  if (!value) return "";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "" : date.toLocaleString();
}

function humanize(value: string): string {
  return value
    .replace(/_/g, " ")
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

export function LyricsHistoryWorkspace({
  refreshKey = 0,
  onOpenContribution,
}: {
  refreshKey?: number;
  onOpenContribution?: (contributionId: string) => void;
}) {
  const [history, setHistory] = useState<TrackLyricsHistory>({
    contributions: [],
    versions: [],
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState("");

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError(null);

    fetchTrackLyricsHistory(null, 300)
      .then((next) => {
        if (alive) setHistory(next);
      })
      .catch((reason) => {
        if (alive) {
          setError(
            reason instanceof Error
              ? reason.message
              : "Lyrics history could not load.",
          );
        }
      })
      .finally(() => {
        if (alive) setLoading(false);
      });

    return () => {
      alive = false;
    };
  }, [refreshKey]);

  const normalizedFilter = filter.trim().toLowerCase();
  const contributions = useMemo(
    () => history.contributions.filter((item) => {
      if (!normalizedFilter) return true;
      return [
        item.trackTitle,
        item.trackSlug,
        item.artists.join(" "),
        item.contributorLabel,
        item.status,
        item.acceptanceMode ?? "",
      ].some((value) => value.toLowerCase().includes(normalizedFilter));
    }),
    [history.contributions, normalizedFilter],
  );
  const versions = useMemo(
    () => history.versions.filter((item) => {
      if (!normalizedFilter) return true;
      return [
        item.trackTitle,
        item.trackSlug,
        item.artists.join(" "),
        item.sourceContributorLabel ?? "",
        item.sourceKind,
        item.communityRevisionMode ?? "",
      ].some((value) => value.toLowerCase().includes(normalizedFilter));
    }),
    [history.versions, normalizedFilter],
  );
  const reviewDecisions = useMemo(
    () => contributions.filter((item) => item.status !== "submitted"),
    [contributions],
  );

  return (
    <div className="space-y-5">
      <AdminWorkspaceSection
        icon="History"
        title="Lyrics record"
        note="Contributions, review decisions, and immutable Lyrics versions stay distinct in authority but visible in one operational history."
        actions={
          <label className="flex min-w-[250px] items-center gap-2 rounded-lg border border-wk-border bg-wk-bg px-3 py-2">
            <WkIcon name="Search" size={13} className="text-wk-text-faint" />
            <input
              value={filter}
              onChange={(event) => setFilter(event.target.value)}
              placeholder="Track, artist, contributor"
              className="min-w-0 flex-1 bg-transparent text-xs text-wk-text outline-none placeholder:text-wk-text-faint"
            />
          </label>
        }
      >
        {loading ? (
          <div className="min-h-[240px]" aria-busy="true" />
        ) : error ? (
          <p className="rounded-xl border border-wk-danger/20 bg-wk-danger-soft px-4 py-3 text-xs text-wk-danger">
            {error}
          </p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-xl border border-wk-border bg-wk-bg p-4">
              <div className="text-2xl font-black text-wk-text">{contributions.length}</div>
              <div className="mt-1 text-[10px] font-black uppercase tracking-[0.12em] text-wk-text-faint">
                Contributions
              </div>
            </div>
            <div className="rounded-xl border border-wk-border bg-wk-bg p-4">
              <div className="text-2xl font-black text-wk-text">{reviewDecisions.length}</div>
              <div className="mt-1 text-[10px] font-black uppercase tracking-[0.12em] text-wk-text-faint">
                Review decisions
              </div>
            </div>
            <div className="rounded-xl border border-wk-border bg-wk-bg p-4">
              <div className="text-2xl font-black text-wk-text">{versions.length}</div>
              <div className="mt-1 text-[10px] font-black uppercase tracking-[0.12em] text-wk-text-faint">
                Immutable versions
              </div>
            </div>
            <div className="rounded-xl border border-wk-border bg-wk-bg p-4">
              <div className="text-2xl font-black text-wk-text">
                {versions.filter((version) => version.isPublished).length}
              </div>
              <div className="mt-1 text-[10px] font-black uppercase tracking-[0.12em] text-wk-text-faint">
                Current published versions
              </div>
            </div>
          </div>
        )}
      </AdminWorkspaceSection>

      {!loading && !error ? (
        <div className="grid gap-5 xl:grid-cols-2">
          <AdminWorkspaceSection
            icon="ShieldCheck"
            title="Contribution history"
            note="Submissions remain visible before and after review. Accepted and rejected contributions carry their durable review decision."
          >
            <div className="max-h-[720px] space-y-3 overflow-y-auto pr-1">
              {contributions.map((item) => (
                <article key={item.id} className="rounded-xl border border-wk-border bg-wk-bg p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h3 className="truncate text-sm font-black text-wk-text">{item.trackTitle}</h3>
                      <p className="mt-1 truncate text-xs text-wk-text-muted">
                        {item.artists.join(", ") || "Artist unresolved"}
                      </p>
                    </div>
                    <span className={[
                      "rounded-full px-2 py-0.5 text-[9px] font-black uppercase tracking-wide",
                      item.status === "rejected"
                        ? "bg-wk-danger-soft text-wk-danger"
                        : item.status === "promoted"
                          ? "bg-wk-success-soft text-wk-success"
                          : "bg-wk-warning-soft text-wk-warning",
                    ].join(" ")}>
                      {item.status === "promoted" && item.acceptanceMode
                        ? humanize(item.acceptanceMode)
                        : humanize(item.status)}
                    </span>
                  </div>
                  <div className="mt-3 text-[11px] leading-5 text-wk-text-muted">
                    <div>{item.contributorLabel}</div>
                    <div>{humanize(item.contributionKind)} · Submitted {formatDate(item.createdAt)}</div>
                    {item.reviewedAt ? <div>Reviewed {formatDate(item.reviewedAt)}</div> : null}
                  </div>
                  {item.reviewNote ? (
                    <p className="mt-3 rounded-lg border border-wk-border bg-wk-surface px-3 py-2 text-xs leading-5 text-wk-text">
                      {item.reviewNote}
                    </p>
                  ) : null}
                  {onOpenContribution ? (
                    <button
                      type="button"
                      onClick={() => onOpenContribution(item.id)}
                      className="wk-button wk-button-ghost wk-button-sm mt-3"
                    >
                      <WkIcon name="ScanText" size={14} />
                      Open in Review
                    </button>
                  ) : null}
                </article>
              ))}
              {!contributions.length ? (
                <p className="rounded-xl border border-dashed border-wk-border px-4 py-8 text-center text-xs text-wk-text-muted">
                  No Lyrics contributions match this filter.
                </p>
              ) : null}
            </div>
          </AdminWorkspaceSection>

          <AdminWorkspaceSection
            icon="GitCommitHorizontal"
            title="Lyrics versions"
            note="Every saved or accepted Lyrics version is immutable. Working and published pointers identify the active records."
          >
            <div className="max-h-[720px] space-y-3 overflow-y-auto pr-1">
              {versions.map((version) => (
                <article key={version.id} className="rounded-xl border border-wk-border bg-wk-bg p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h3 className="truncate text-sm font-black text-wk-text">
                        {version.trackTitle} · v{version.versionNumber}
                      </h3>
                      <p className="mt-1 truncate text-xs text-wk-text-muted">
                        {version.artists.join(", ") || "Artist unresolved"}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {version.isWorking ? (
                        <span className="rounded-full bg-wk-info-soft px-2 py-0.5 text-[9px] font-black text-wk-info">WORKING</span>
                      ) : null}
                      {version.isPublished ? (
                        <span className="rounded-full bg-wk-success-soft px-2 py-0.5 text-[9px] font-black text-wk-success">PUBLISHED</span>
                      ) : null}
                    </div>
                  </div>
                  <div className="mt-3 text-[11px] leading-5 text-wk-text-muted">
                    <div>{humanize(version.sourceKind)} · {version.languageCode.toUpperCase()} · {version.timingMode === "line" ? "Timed" : "Plain"}</div>
                    {version.sourceContributorLabel ? (
                      <div>
                        {version.communityRevisionMode === "with_revisions"
                          ? `Original submission by ${version.sourceContributorLabel}; WAKILISHA Community revisions accepted.`
                          : `Submitted by ${version.sourceContributorLabel}.`}
                      </div>
                    ) : null}
                    <div>Created {formatDate(version.createdAt)}</div>
                  </div>
                </article>
              ))}
              {!versions.length ? (
                <p className="rounded-xl border border-dashed border-wk-border px-4 py-8 text-center text-xs text-wk-text-muted">
                  No Lyrics versions match this filter.
                </p>
              ) : null}
            </div>
          </AdminWorkspaceSection>
        </div>
      ) : null}
    </div>
  );
}
