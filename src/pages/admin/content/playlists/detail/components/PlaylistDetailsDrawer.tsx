import {
  useEffect,
  useMemo,
  useState,
} from "react";
import { createPortal } from "react-dom";
import { MediaPickerButton } from "@/components/admin/MediaPickerButton";
import { WkIcon } from "@/components/design-system/Icon";
import {
  searchPlaylistCuratorCandidates,
  type PlaylistCover,
  type PlaylistCuratorCandidate,
  type PlaylistCuratorIdentity,
  type PlaylistLifecycleEvent,
  type PlaylistReviewEvent,
  type PlaylistSchedule,
} from "@/services/playlists/playlistAdminService";

function humanize(value: string): string {
  return value
    .replace(/_/g, " ")
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

function formatDate(value?: string | null): string {
  if (!value) return "";
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? ""
    : date.toLocaleString();
}

export function PlaylistDetailsDrawer({
  open,
  onClose,
  title,
  slug,
  description,
  onTitleChange,
  onSlugChange,
  onDescriptionChange,
  canEdit,
  curator,
  curatorLabel,
  onSelectCurator,
  onClearCurator,
  cover,
  coverFallbackUrl,
  onCoverSelect,
  onClearCover,
  busy,
  status,
  canPublish,
  approvedVersionId,
  schedule,
  onSchedule,
  reviewNote,
  onReviewNoteChange,
  reviewEvents,
  lifecycleEvents,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  slug: string;
  description: string;
  onTitleChange: (value: string) => void;
  onSlugChange: (value: string) => void;
  onDescriptionChange: (value: string) => void;
  canEdit: boolean;
  curator: PlaylistCuratorIdentity | null;
  curatorLabel: string | null;
  onSelectCurator: (
    candidate: PlaylistCuratorCandidate,
  ) => void;
  onClearCurator: () => void;
  cover: PlaylistCover | null;
  coverFallbackUrl: string | null;
  onCoverSelect: (assetId: string) => void;
  onClearCover: () => void;
  busy: boolean;
  status: string;
  canPublish: boolean;
  approvedVersionId: string | null;
  schedule: PlaylistSchedule | null;
  onSchedule: (publishAt: string, note: string) => void;
  reviewNote: string;
  onReviewNoteChange: (value: string) => void;
  reviewEvents: PlaylistReviewEvent[];
  lifecycleEvents: PlaylistLifecycleEvent[];
}) {
  const [curatorQuery, setCuratorQuery] = useState("");
  const [curatorResults, setCuratorResults] = useState<
    PlaylistCuratorCandidate[]
  >([]);
  const [curatorSearching, setCuratorSearching] = useState(false);
  const [curatorError, setCuratorError] = useState<string | null>(
    null,
  );
  const [scheduleAt, setScheduleAt] = useState("");
  const [scheduleNote, setScheduleNote] = useState("");

  useEffect(() => {
    if (!open) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [onClose, open]);

  useEffect(() => {
    if (!open) return;

    const query = curatorQuery.trim();
    if (query.length < 2) {
      setCuratorResults([]);
      setCuratorError(null);
      return;
    }

    let alive = true;
    const timeout = window.setTimeout(() => {
      setCuratorSearching(true);
      setCuratorError(null);

      searchPlaylistCuratorCandidates(query)
        .then((rows) => {
          if (alive) setCuratorResults(rows);
        })
        .catch((reason) => {
          if (!alive) return;
          setCuratorResults([]);
          setCuratorError(
            reason instanceof Error
              ? reason.message
              : "Curator search is unavailable.",
          );
        })
        .finally(() => {
          if (alive) setCuratorSearching(false);
        });
    }, 250);

    return () => {
      alive = false;
      window.clearTimeout(timeout);
    };
  }, [curatorQuery, open]);

  const combinedHistory = useMemo(() => {
    const reviewRows = reviewEvents.map((event, index) => ({
      key: `review-${event.id ?? event.event_number ?? index}`,
      action: event.action ?? "review_event",
      priorStatus: event.prior_status ?? null,
      resultingStatus: event.resulting_status ?? "",
      note: event.reason ?? null,
      createdAt: event.created_at ?? "",
    }));

    const lifecycleRows = lifecycleEvents.map((event) => ({
      key: `lifecycle-${event.id}`,
      action: event.action,
      priorStatus: event.priorStatus,
      resultingStatus: event.resultingStatus,
      note: event.note,
      createdAt: event.createdAt,
    }));

    return [...reviewRows, ...lifecycleRows]
      .sort((left, right) => {
        const leftTime = Date.parse(left.createdAt || "");
        const rightTime = Date.parse(right.createdAt || "");
        return (Number.isNaN(rightTime) ? 0 : rightTime) -
          (Number.isNaN(leftTime) ? 0 : leftTime);
      })
      .slice(0, 20);
  }, [lifecycleEvents, reviewEvents]);

  if (!open || typeof document === "undefined") return null;

  const coverUrl = cover?.url || coverFallbackUrl || null;
  const activeSchedule =
    schedule?.status === "scheduled" ? schedule : null;

  return createPortal(
    <div className="fixed inset-0 z-[80]">
      <button
        type="button"
        aria-label="Close Playlist details"
        onClick={onClose}
        className="absolute inset-0 bg-black/35"
      />

      <aside className="absolute inset-y-0 right-0 flex w-full max-w-[460px] flex-col border-l border-wk-border bg-wk-surface shadow-2xl">
        <div className="flex items-center justify-between border-b border-wk-border px-5 py-4">
          <div>
            <div className="text-[13px] font-black text-wk-text">
              Playlist details
            </div>
            <div className="mt-0.5 text-[10px] text-wk-text-muted">
              Moving fields save automatically.
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-wk-text-muted hover:bg-wk-surface-raised hover:text-wk-text"
            aria-label="Close details"
          >
            <WkIcon name="X" size={15} />
          </button>
        </div>

        <div className="flex-1 space-y-6 overflow-y-auto p-5">
          <section className="space-y-3">
            <div className="text-[10px] font-black uppercase tracking-wider text-wk-text-faint">
              Identity
            </div>

            <label className="block">
              <span className="mb-1 block text-[10px] font-bold text-wk-text-muted">
                Title
              </span>
              <input
                value={title}
                onChange={(event) =>
                  onTitleChange(event.target.value)
                }
                disabled={!canEdit}
                className="w-full rounded-lg border border-wk-border bg-wk-bg px-3 py-2 text-[12px] font-semibold text-wk-text outline-none focus:border-wk-brand disabled:opacity-60"
              />
            </label>

            <label className="block">
              <span className="mb-1 block text-[10px] font-bold text-wk-text-muted">
                Slug
              </span>
              <input
                value={slug}
                onChange={(event) =>
                  onSlugChange(event.target.value)
                }
                disabled={!canEdit}
                className="w-full rounded-lg border border-wk-border bg-wk-bg px-3 py-2 text-[12px] text-wk-text outline-none focus:border-wk-brand disabled:opacity-60"
              />
            </label>

            <label className="block">
              <span className="mb-1 block text-[10px] font-bold text-wk-text-muted">
                Description
              </span>
              <textarea
                value={description}
                onChange={(event) =>
                  onDescriptionChange(event.target.value)
                }
                disabled={!canEdit}
                rows={5}
                className="w-full resize-y rounded-lg border border-wk-border bg-wk-bg px-3 py-2 text-[12px] leading-5 text-wk-text outline-none focus:border-wk-brand disabled:opacity-60"
              />
            </label>
          </section>

          <section className="space-y-3 border-t border-wk-border pt-5">
            <div>
              <div className="text-[10px] font-black uppercase tracking-wider text-wk-text-faint">
                Curator
              </div>
              <p className="mt-1 text-[10px] leading-4 text-wk-text-muted">
                Choose a Registry Author or an eligible public WAKILISHA user.
              </p>
            </div>

            <div className="rounded-xl border border-wk-border bg-wk-bg-subtle p-3">
              <div className="text-[12px] font-bold text-wk-text">
                {curator?.displayName ||
                  curatorLabel ||
                  "No governed Curator selected"}
              </div>
              {curator ? (
                <div className="mt-1 text-[10px] text-wk-text-muted">
                  {curator.authorSlug
                    ? `Registry Author · ${curator.authorSlug}`
                    : curator.username
                      ? `WAKILISHA user · @${curator.username}`
                      : "Governed WAKILISHA identity"}
                </div>
              ) : null}
            </div>

            {canEdit ? (
              <>
                <div className="flex items-center gap-2 rounded-lg border border-wk-border bg-wk-bg px-3 py-2">
                  <WkIcon
                    name="Search"
                    size={13}
                    className="text-wk-text-faint"
                  />
                  <input
                    value={curatorQuery}
                    onChange={(event) =>
                      setCuratorQuery(event.target.value)
                    }
                    placeholder="Search Curator identity"
                    className="min-w-0 flex-1 bg-transparent text-[11px] text-wk-text outline-none placeholder:text-wk-text-faint"
                  />
                  {curatorSearching ? (
                    <WkIcon
                      name="LoaderCircle"
                      size={12}
                      className="animate-spin text-wk-text-faint"
                    />
                  ) : null}
                </div>

                {curatorError ? (
                  <div className="text-[10px] text-wk-danger">
                    {curatorError}
                  </div>
                ) : null}

                {curatorResults.length > 0 ? (
                  <div className="max-h-56 overflow-y-auto rounded-xl border border-wk-border bg-wk-bg p-1.5">
                    {curatorResults.map((candidate) => (
                      <button
                        key={`${candidate.kind}:${candidate.id}`}
                        type="button"
                        onClick={() => {
                          onSelectCurator(candidate);
                          setCuratorQuery("");
                          setCuratorResults([]);
                        }}
                        disabled={busy}
                        className="flex w-full items-center gap-3 rounded-lg p-2 text-left hover:bg-wk-surface-raised disabled:opacity-50"
                      >
                        {candidate.avatarUrl ? (
                          <img
                            src={candidate.avatarUrl}
                            alt=""
                            className="h-9 w-9 rounded-full object-cover"
                          />
                        ) : (
                          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-wk-surface-raised text-wk-text-faint">
                            <WkIcon name="User" size={14} />
                          </div>
                        )}
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-[11px] font-bold text-wk-text">
                            {candidate.displayName}
                          </div>
                          <div className="truncate text-[9px] uppercase tracking-wide text-wk-text-faint">
                            {candidate.kind === "registry_author"
                              ? "Registry Author"
                              : candidate.username
                                ? `WAKILISHA user · @${candidate.username}`
                                : "WAKILISHA user"}
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                ) : null}

                {curator ? (
                  <button
                    type="button"
                    onClick={onClearCurator}
                    disabled={busy}
                    className="text-[10px] font-bold text-wk-danger disabled:opacity-40"
                  >
                    Clear Curator
                  </button>
                ) : null}
              </>
            ) : null}
          </section>

          <section className="space-y-3 border-t border-wk-border pt-5">
            <div>
              <div className="text-[10px] font-black uppercase tracking-wider text-wk-text-faint">
                Cover
              </div>
              <p className="mt-1 text-[10px] leading-4 text-wk-text-muted">
                Choose canonical Media. WAKILISHA keeps the source image untouched.
              </p>
            </div>

            <div className="aspect-square max-w-[220px] overflow-hidden rounded-xl border border-wk-border bg-wk-bg-subtle">
              {coverUrl ? (
                <img
                  src={coverUrl}
                  alt=""
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="flex h-full flex-col items-center justify-center gap-2 text-wk-text-faint">
                  <WkIcon name="Image" size={24} />
                  <span className="text-[10px] font-semibold">
                    No cover selected
                  </span>
                </div>
              )}
            </div>

            {canEdit ? (
              <div className="flex flex-wrap gap-2">
                <MediaPickerButton
                  currentUrl={coverUrl || undefined}
                  label={cover ? "Replace cover" : "Choose cover"}
                  title="Select Playlist Cover"
                  onSelect={(assetId) => {
                    if (assetId) onCoverSelect(assetId);
                  }}
                />
                {cover ? (
                  <button
                    type="button"
                    onClick={onClearCover}
                    disabled={busy}
                    className="wk-button wk-button-ghost wk-button-sm text-wk-danger disabled:opacity-40"
                  >
                    Clear
                  </button>
                ) : null}
              </div>
            ) : null}
          </section>

          <section className="space-y-3 border-t border-wk-border pt-5">
            <div>
              <div className="text-[10px] font-black uppercase tracking-wider text-wk-text-faint">
                Review
              </div>
              <p className="mt-1 text-[10px] leading-4 text-wk-text-muted">
                Review actions target the exact submitted Playlist version.
              </p>
            </div>

            <textarea
              value={reviewNote}
              onChange={(event) =>
                onReviewNoteChange(event.target.value)
              }
              rows={3}
              placeholder="Review note"
              className="w-full resize-y rounded-lg border border-wk-border bg-wk-bg px-3 py-2 text-[11px] leading-5 text-wk-text outline-none focus:border-wk-brand"
            />
          </section>

          <section className="space-y-3 border-t border-wk-border pt-5">
            <div>
              <div className="text-[10px] font-black uppercase tracking-wider text-wk-text-faint">
                Publication
              </div>
              <p className="mt-1 text-[10px] leading-4 text-wk-text-muted">
                Current status: {humanize(status)}
              </p>
            </div>

            {activeSchedule ? (
              <div className="rounded-xl border border-wk-info/20 bg-wk-info-soft p-3">
                <div className="text-[11px] font-bold text-wk-info">
                  Scheduled
                </div>
                <div className="mt-1 text-[10px] text-wk-info">
                  {formatDate(activeSchedule.runAfter)}
                </div>
                {activeSchedule.note ? (
                  <div className="mt-1 text-[10px] text-wk-info">
                    {activeSchedule.note}
                  </div>
                ) : null}
              </div>
            ) : null}

            {canPublish &&
            status === "approved" &&
            approvedVersionId ? (
              <div className="space-y-2 rounded-xl border border-wk-border bg-wk-bg-subtle p-3">
                <label className="block">
                  <span className="mb-1 block text-[9px] font-bold text-wk-text-muted">
                    Publish date and time
                  </span>
                  <input
                    type="datetime-local"
                    value={scheduleAt}
                    onChange={(event) =>
                      setScheduleAt(event.target.value)
                    }
                    className="w-full rounded-lg border border-wk-border bg-wk-bg px-3 py-2 text-[11px] text-wk-text outline-none focus:border-wk-brand"
                  />
                </label>

                <textarea
                  value={scheduleNote}
                  onChange={(event) =>
                    setScheduleNote(event.target.value)
                  }
                  rows={2}
                  placeholder="Scheduling note, optional"
                  className="w-full resize-y rounded-lg border border-wk-border bg-wk-bg px-3 py-2 text-[10px] leading-4 text-wk-text outline-none focus:border-wk-brand"
                />

                <button
                  type="button"
                  disabled={busy || !scheduleAt}
                  onClick={() => {
                    const date = new Date(scheduleAt);
                    if (Number.isNaN(date.getTime())) return;
                    onSchedule(date.toISOString(), scheduleNote);
                  }}
                  className="wk-button wk-button-primary wk-button-sm w-full disabled:opacity-40"
                >
                  <WkIcon name="CalendarClock" size={13} />
                  Schedule
                </button>
              </div>
            ) : null}
          </section>

          <section className="space-y-3 border-t border-wk-border pt-5">
            <div className="text-[10px] font-black uppercase tracking-wider text-wk-text-faint">
              History
            </div>

            {combinedHistory.length > 0 ? (
              <div className="space-y-2">
                {combinedHistory.map((event) => (
                  <div
                    key={event.key}
                    className="rounded-lg bg-wk-bg-subtle px-3 py-2"
                  >
                    <div className="text-[10px] font-bold text-wk-text">
                      {humanize(event.action)}
                    </div>
                    <div className="mt-0.5 text-[9px] text-wk-text-muted">
                      {event.priorStatus
                        ? `${humanize(event.priorStatus)} → `
                        : ""}
                      {humanize(event.resultingStatus)}
                      {event.createdAt
                        ? ` · ${formatDate(event.createdAt)}`
                        : ""}
                    </div>
                    {event.note ? (
                      <div className="mt-1 text-[9px] leading-4 text-wk-text-muted">
                        {event.note}
                      </div>
                    ) : null}
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-[10px] text-wk-text-faint">
                No Review or lifecycle history yet.
              </div>
            )}
          </section>
        </div>
      </aside>
    </div>,
    document.body,
  );
}
