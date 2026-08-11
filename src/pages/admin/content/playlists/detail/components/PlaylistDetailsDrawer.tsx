import {
  useEffect,
  useMemo,
  useState,
} from "react";
import { createPortal } from "react-dom";
import { MediaPickerButton } from "@/components/admin/MediaPickerButton";
import { WkIcon } from "@/components/design-system/Icon";
import {
  PlaylistCoverPresentation,
} from "@/components/media/PlaylistCoverPresentation";
import {
  approvePlaylistCoverForPublicUse,
  fetchPlaylistCoverGovernance,
  searchPlaylistCuratorCandidates,
  type PlaylistCover,
  type PlaylistCoverConsentStatus,
  type PlaylistCoverGovernance,
  type PlaylistCoverPresentationInput,
  type PlaylistCoverRightsStatus,
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
  onCoverPresentationSave,
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
  onCoverSelect: (
    assetId: string,
    presentation: PlaylistCoverPresentationInput,
  ) => void;
  onCoverPresentationSave: (
    presentation: PlaylistCoverPresentationInput,
  ) => void;
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
  const [coverAltText, setCoverAltText] = useState("");
  const [coverCaption, setCoverCaption] = useState("");
  const [
    coverGovernance,
    setCoverGovernance,
  ] = useState<PlaylistCoverGovernance | null>(null);
  const [
    coverGovernanceLoading,
    setCoverGovernanceLoading,
  ] = useState(false);
  const [
    coverGovernanceSaving,
    setCoverGovernanceSaving,
  ] = useState(false);
  const [
    coverGovernanceError,
    setCoverGovernanceError,
  ] = useState<string | null>(null);
  const [
    coverRightsStatus,
    setCoverRightsStatus,
  ] = useState<PlaylistCoverRightsStatus | "">("");
  const [
    coverConsentStatus,
    setCoverConsentStatus,
  ] = useState<PlaylistCoverConsentStatus | "">("");
  const [
    coverRightsBasis,
    setCoverRightsBasis,
  ] = useState("");
  const [
    coverRightsHolder,
    setCoverRightsHolder,
  ] = useState("");
  const [
    coverApprovalReason,
    setCoverApprovalReason,
  ] = useState("");

  useEffect(() => {
    if (!open) return;

    setCoverAltText(
      cover?.altText ?? "",
    );
    setCoverCaption(
      cover?.caption ?? "",
    );
  }, [
    cover?.altText,
    cover?.caption,
    cover?.usageLinkId,
    open,
  ]);

  useEffect(() => {
    if (!open || !cover?.assetId) {
      setCoverGovernance(null);
      setCoverGovernanceError(null);
      return;
    }

    let alive = true;

    setCoverGovernanceLoading(true);
    setCoverGovernanceError(null);

    fetchPlaylistCoverGovernance(
      cover.assetId,
    )
      .then((governance) => {
        if (!alive) return;
        setCoverGovernance(
          governance,
        );
      })
      .catch((reason) => {
        if (!alive) return;
        setCoverGovernance(null);
        setCoverGovernanceError(
          reason instanceof Error
            ? reason.message
            : "Could not read cover governance.",
        );
      })
      .finally(() => {
        if (alive) {
          setCoverGovernanceLoading(
            false,
          );
        }
      });

    return () => {
      alive = false;
    };
  }, [
    cover?.assetId,
    cover?.usageLinkId,
    open,
  ]);

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
                <PlaylistCoverPresentation
                  src={coverUrl}
                  altText={
                    coverAltText ||
                    cover?.altText ||
                    null
                  }
                  slug={slug}
                  title={title}
                  caption={
                    coverCaption ||
                    null
                  }
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

            <label className="block">
              <span className="mb-1 block text-[10px] font-bold text-wk-text-muted">
                Alt text
              </span>
              <input
                value={coverAltText}
                onChange={(event) =>
                  setCoverAltText(
                    event.target.value,
                  )
                }
                disabled={!canEdit}
                placeholder="Describe the cover artwork"
                className="w-full rounded-lg border border-wk-border bg-wk-bg px-3 py-2 text-[11px] text-wk-text outline-none focus:border-wk-brand disabled:opacity-60"
              />
            </label>

            <label className="block">
              <span className="mb-1 block text-[10px] font-bold text-wk-text-muted">
                Subject label
              </span>
              <input
                value={coverCaption}
                onChange={(event) =>
                  setCoverCaption(
                    event.target.value,
                  )
                }
                disabled={!canEdit}
                placeholder="Lilac-breasted Roller"
                className="w-full rounded-lg border border-wk-border bg-wk-bg px-3 py-2 text-[11px] text-wk-text outline-none focus:border-wk-brand disabled:opacity-60"
              />
              <span className="mt-1 block text-[9px] leading-4 text-wk-text-faint">
                This appears below the Playlist title on the cover.
              </span>
            </label>

            {cover ? (
              <div className="rounded-xl border border-wk-border bg-wk-bg-subtle p-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-[10px] font-black uppercase tracking-[0.14em] text-wk-text-muted">
                      Public use
                    </div>
                    <p className="mt-1 text-[10px] leading-4 text-wk-text-faint">
                      Preview and publication use the exact frozen image revision, but Media governance can still block delivery.
                    </p>
                  </div>

                  {coverGovernance?.isApprovedPublic ? (
                    <span className="rounded-full bg-wk-success-soft px-2 py-1 text-[9px] font-black uppercase text-wk-success">
                      Approved
                    </span>
                  ) : (
                    <span className="rounded-full bg-wk-warning-soft px-2 py-1 text-[9px] font-black uppercase text-wk-warning">
                      Approval required
                    </span>
                  )}
                </div>

                {coverGovernanceLoading ? (
                  <div className="mt-3 text-[10px] text-wk-text-faint">
                    Checking Media governance...
                  </div>
                ) : null}

                {coverGovernanceError ? (
                  <div className="mt-3 rounded-lg bg-wk-danger-soft px-3 py-2 text-[10px] text-wk-danger">
                    {coverGovernanceError}
                  </div>
                ) : null}

                {coverGovernance?.isApprovedPublic ? (
                  <div className="mt-3 grid grid-cols-2 gap-2 text-[9px] text-wk-text-muted">
                    <div>
                      Rights:{" "}
                      <strong className="text-wk-text">
                        {humanize(
                          coverGovernance.rightsStatus,
                        )}
                      </strong>
                    </div>
                    <div>
                      Consent:{" "}
                      <strong className="text-wk-text">
                        {humanize(
                          coverGovernance.consentStatus,
                        )}
                      </strong>
                    </div>
                  </div>
                ) : canEdit ? (
                  <div className="mt-3 space-y-3">
                    <div className="grid gap-3 sm:grid-cols-2">
                      <label className="block">
                        <span className="mb-1 block text-[9px] font-bold text-wk-text-muted">
                          Rights status
                        </span>
                        <select
                          value={coverRightsStatus}
                          onChange={(event) =>
                            setCoverRightsStatus(
                              event.target.value as
                                PlaylistCoverRightsStatus | "",
                            )
                          }
                          disabled={coverGovernanceSaving}
                          className="w-full rounded-lg border border-wk-border bg-wk-bg px-3 py-2 text-[10px] text-wk-text outline-none focus:border-wk-brand disabled:opacity-60"
                        >
                          <option value="">
                            Select rights status
                          </option>
                          <option value="owned">
                            Owned
                          </option>
                          <option value="licensed">
                            Licensed
                          </option>
                          <option value="public_domain">
                            Public domain
                          </option>
                          <option value="fair_use">
                            Fair use
                          </option>
                        </select>
                      </label>

                      <label className="block">
                        <span className="mb-1 block text-[9px] font-bold text-wk-text-muted">
                          Consent
                        </span>
                        <select
                          value={coverConsentStatus}
                          onChange={(event) =>
                            setCoverConsentStatus(
                              event.target.value as
                                PlaylistCoverConsentStatus | "",
                            )
                          }
                          disabled={coverGovernanceSaving}
                          className="w-full rounded-lg border border-wk-border bg-wk-bg px-3 py-2 text-[10px] text-wk-text outline-none focus:border-wk-brand disabled:opacity-60"
                        >
                          <option value="">
                            Select consent status
                          </option>
                          <option value="not_required">
                            Not required
                          </option>
                          <option value="granted">
                            Granted
                          </option>
                        </select>
                      </label>
                    </div>

                    <label className="block">
                      <span className="mb-1 block text-[9px] font-bold text-wk-text-muted">
                        Rights basis
                      </span>
                      <input
                        value={coverRightsBasis}
                        onChange={(event) =>
                          setCoverRightsBasis(
                            event.target.value,
                          )
                        }
                        disabled={coverGovernanceSaving}
                        placeholder="Why WAKILISHA may publish this artwork"
                        className="w-full rounded-lg border border-wk-border bg-wk-bg px-3 py-2 text-[10px] text-wk-text outline-none focus:border-wk-brand disabled:opacity-60"
                      />
                    </label>

                    <label className="block">
                      <span className="mb-1 block text-[9px] font-bold text-wk-text-muted">
                        Rights holder
                      </span>
                      <input
                        value={coverRightsHolder}
                        onChange={(event) =>
                          setCoverRightsHolder(
                            event.target.value,
                          )
                        }
                        disabled={coverGovernanceSaving}
                        placeholder="Optional"
                        className="w-full rounded-lg border border-wk-border bg-wk-bg px-3 py-2 text-[10px] text-wk-text outline-none focus:border-wk-brand disabled:opacity-60"
                      />
                    </label>

                    <label className="block">
                      <span className="mb-1 block text-[9px] font-bold text-wk-text-muted">
                        Approval reason
                      </span>
                      <input
                        value={coverApprovalReason}
                        onChange={(event) =>
                          setCoverApprovalReason(
                            event.target.value,
                          )
                        }
                        disabled={coverGovernanceSaving}
                        placeholder="Why this cover is approved for public use"
                        className="w-full rounded-lg border border-wk-border bg-wk-bg px-3 py-2 text-[10px] text-wk-text outline-none focus:border-wk-brand disabled:opacity-60"
                      />
                    </label>

                    <button
                      type="button"
                      disabled={
                        busy ||
                        coverGovernanceSaving ||
                        !coverRightsStatus ||
                        !coverConsentStatus ||
                        !coverRightsBasis.trim() ||
                        !coverApprovalReason.trim()
                      }
                      onClick={async () => {
                        if (
                          !coverRightsStatus ||
                          !coverConsentStatus
                        ) {
                          return;
                        }

                        setCoverGovernanceSaving(
                          true,
                        );
                        setCoverGovernanceError(
                          null,
                        );

                        try {
                          const updated =
                            await approvePlaylistCoverForPublicUse(
                              cover.assetId,
                              {
                                rightsStatus:
                                  coverRightsStatus,
                                rightsBasis:
                                  coverRightsBasis,
                                rightsHolder:
                                  coverRightsHolder ||
                                  null,
                                consentStatus:
                                  coverConsentStatus,
                                reason:
                                  coverApprovalReason,
                              },
                            );

                          setCoverGovernance(
                            updated,
                          );
                        } catch (reason) {
                          setCoverGovernanceError(
                            reason instanceof Error
                              ? reason.message
                              : "Could not approve cover for public use.",
                          );
                        } finally {
                          setCoverGovernanceSaving(
                            false,
                          );
                        }
                      }}
                      className="wk-button wk-button-primary wk-button-sm disabled:opacity-40"
                    >
                      {coverGovernanceSaving
                        ? "Approving..."
                        : "Approve for public use"}
                    </button>

                    <p className="text-[9px] leading-4 text-wk-text-faint">
                      This creates a new immutable Media governance version. It does not alter the cover image.
                    </p>
                  </div>
                ) : null}
              </div>
            ) : null}

            {canEdit ? (
              <div className="flex flex-wrap gap-2">
                <MediaPickerButton
                  currentUrl={coverUrl || undefined}
                  label={cover ? "Replace cover" : "Choose cover"}
                  title="Select Playlist Cover"
                  onSelect={(assetId) => {
                    if (!assetId) return;

                    onCoverSelect(
                      assetId,
                      {
                        altText:
                          coverAltText.trim() ||
                          null,
                        caption:
                          coverCaption.trim() ||
                          null,
                      },
                    );
                  }}
                />

                {cover ? (
                  <button
                    type="button"
                    onClick={() =>
                      onCoverPresentationSave({
                        altText:
                          coverAltText.trim() ||
                          null,
                        caption:
                          coverCaption.trim() ||
                          null,
                      })
                    }
                    disabled={
                      busy ||
                      (
                        coverAltText.trim() ===
                          (cover.altText ?? "").trim() &&
                        coverCaption.trim() ===
                          (cover.caption ?? "").trim()
                      )
                    }
                    className="wk-button wk-button-ghost wk-button-sm disabled:opacity-40"
                  >
                    Save Cover Text
                  </button>
                ) : null}

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
