import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  useNavigate,
} from "react-router-dom";
import {
  Portal,
} from "@/components/base/Portal";
import {
  AddToPlaylistButton,
} from "@/components/playlists/AddToPlaylistButton";
import {
  ShareSheet,
} from "@/components/design-system/share/ShareSheet";
import {
  ContributionSheet,
} from "@/components/feature/community/ContributionSheet";
import {
  useAuthUser,
} from "@/hooks/useAuthUser";
import {
  useEntityActions,
} from "@/hooks/useCommunityActions";
import {
  useScrollLock,
} from "@/hooks/useScrollLock";
import {
  getUserFollows,
  getUserSaves,
  type CommunityEntity,
} from "@/services/community";

type LooseRow =
  Record<string, unknown>;

export interface TrackActionsMenuProps {
  registryTrackId:
    | string
    | null
    | undefined;
  trackTitle: string;
  artistName: string;
  artistId?: string | null;
  artistSlug?: string | null;
  trackSlug?: string | null;
  trackHref?: string | null;
  releaseTitle?: string | null;
  releaseSlug?: string | null;
  artworkUrl?: string | null;
  onDiscuss?: (() => void) | null;
  compact?: boolean;
}

function matchesSavedTrack(
  row: unknown,
  registryTrackId: string,
  trackSlug?: string | null,
): boolean {
  if (
    !row ||
    typeof row !== "object" ||
    Array.isArray(row)
  ) {
    return false;
  }

  const record =
    row as LooseRow;

  return (
    record.entity_type === "track" &&
    (
      record.entity_id ===
        registryTrackId ||
      (
        Boolean(trackSlug) &&
        record.entity_slug ===
          trackSlug
      )
    )
  );
}

function matchesArtistFollow(
  row: unknown,
  artistId?: string | null,
  artistSlug?: string | null,
): boolean {
  if (
    !row ||
    typeof row !== "object" ||
    Array.isArray(row)
  ) {
    return false;
  }

  const record =
    row as LooseRow;

  if (
    record.target_type !== "artist"
  ) {
    return false;
  }

  return (
    (
      Boolean(artistId) &&
      record.target_id === artistId
    ) ||
    (
      Boolean(artistSlug) &&
      record.target_slug === artistSlug
    )
  );
}

function ActionRow({
  icon,
  label,
  onClick,
  active = false,
  pending = false,
}: {
  icon: string;
  label: string;
  onClick: () => void;
  active?: boolean;
  pending?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={pending}
      className={[
        "flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors",
        active
          ? "bg-[var(--wk-brand-soft)] text-[var(--wk-brand)]"
          : "text-[var(--wk-text)] hover:bg-[var(--wk-surface-raised)]",
        pending
          ? "cursor-wait opacity-60"
          : "",
      ].filter(Boolean).join(" ")}
    >
      <span
        className={[
          "flex h-8 w-8 shrink-0 items-center justify-center rounded-full",
          active
            ? "bg-[var(--wk-brand-soft)] text-[var(--wk-brand)]"
            : "bg-[var(--wk-surface-raised)] text-[var(--wk-text-muted)]",
        ].join(" ")}
      >
        <i
          className={[
            pending
              ? "ri-loader-4-line animate-spin"
              : icon,
            "text-[15px]",
          ].join(" ")}
          aria-hidden="true"
        />
      </span>

      <span className="min-w-0 flex-1 text-[12px] font-bold">
        {label}
      </span>

      {active ? (
        <i
          className="ri-check-line text-[14px]"
          aria-hidden="true"
        />
      ) : null}
    </button>
  );
}

export function TrackActionsMenu({
  registryTrackId,
  trackTitle,
  artistName,
  artistId = null,
  artistSlug = null,
  trackSlug = null,
  trackHref = null,
  releaseTitle = null,
  releaseSlug = null,
  artworkUrl = null,
  onDiscuss = null,
  compact = true,
}: TrackActionsMenuProps) {
  const navigate = useNavigate();
  const authUser = useAuthUser();
  const {
    setSaved,
    setFollow,
    loading: entityActionPending,
  } = useEntityActions(
    authUser.id || undefined,
  );

  const triggerRef =
    useRef<HTMLButtonElement>(null);

  const [open, setOpen] =
    useState(false);
  const [desktop, setDesktop] =
    useState(
      () =>
        typeof window !== "undefined"
          ? window.matchMedia(
              "(min-width: 640px)",
            ).matches
          : true,
    );
  const [anchor, setAnchor] =
    useState({
      top: 0,
      left: 0,
    });
  const [saved, setSavedLocal] =
    useState(false);
  const [following, setFollowing] =
    useState(false);
  const [shareOpen, setShareOpen] =
    useState(false);
  const [
    correctionOpen,
    setCorrectionOpen,
  ] = useState(false);
  const [stateLoading, setStateLoading] =
    useState(false);
  const [message, setMessage] =
    useState<string | null>(null);

  useScrollLock(
    open && !desktop,
  );

  const safeTrackTitle =
    trackTitle.trim() ||
    "Track";

  const trackPath =
    trackHref ||
    (
      artistSlug && trackSlug
        ? `/tracks/${artistSlug}/${trackSlug}`
        : trackSlug
          ? `/tracks/${trackSlug}`
          : null
    );

  const artistPath =
    artistSlug
      ? `/artists/${artistSlug}`
      : null;

  const releasePath =
    artistSlug && releaseSlug
      ? `/releases/${artistSlug}/${releaseSlug}`
      : null;

  const trackEntity =
    useMemo<CommunityEntity>(
      () => ({
        type: "track",
        id:
          registryTrackId ||
          undefined,
        slug:
          trackSlug ||
          undefined,
        url:
          trackPath ||
          (
            typeof window !==
              "undefined"
              ? window.location.href
              : "/music"
          ),
        title:
          safeTrackTitle,
        subtitle:
          artistName,
        imageUrl:
          artworkUrl ||
          undefined,
      }),
      [
        artistName,
        artworkUrl,
        registryTrackId,
        safeTrackTitle,
        trackPath,
        trackSlug,
      ],
    );

  const positionMenu =
    useCallback(
      () => {
        if (
          typeof window ===
            "undefined" ||
          !triggerRef.current
        ) {
          return;
        }

        const rect =
          triggerRef.current
            .getBoundingClientRect();

        const width = 288;
        const safeLeft =
          Math.max(
            12,
            Math.min(
              rect.right - width,
              window.innerWidth -
                width -
                12,
            ),
          );

        const safeTop =
          Math.min(
            rect.bottom + 8,
            Math.max(
              12,
              window.innerHeight -
                430,
            ),
          );

        setAnchor({
          top: safeTop,
          left: safeLeft,
        });
      },
      [],
    );

  const loadActionState =
    useCallback(
      async () => {
        if (
          !authUser.id ||
          !registryTrackId
        ) {
          return;
        }

        setStateLoading(true);

        try {
          const [
            saves,
            follows,
          ] =
            await Promise.all([
              getUserSaves(
                authUser.id,
              ),
              artistId ||
              artistSlug
                ? getUserFollows(
                    authUser.id,
                  )
                : Promise.resolve(
                    [],
                  ),
            ]);

          setSavedLocal(
            saves.some(
              (row) =>
                matchesSavedTrack(
                  row,
                  registryTrackId,
                  trackSlug,
                ),
            ),
          );

          setFollowing(
            follows.some(
              (row) =>
                matchesArtistFollow(
                  row,
                  artistId,
                  artistSlug,
                ),
            ),
          );
        } catch {
          setMessage(
            "Some action state could not be loaded.",
          );
        } finally {
          setStateLoading(false);
        }
      },
      [
        artistId,
        artistSlug,
        authUser.id,
        registryTrackId,
        trackSlug,
      ],
    );

  useEffect(
    () => {
      const media =
        window.matchMedia(
          "(min-width: 640px)",
        );

      const sync = () => {
        setDesktop(
          media.matches,
        );
      };

      sync();
      media.addEventListener(
        "change",
        sync,
      );

      return () => {
        media.removeEventListener(
          "change",
          sync,
        );
      };
    },
    [],
  );

  useEffect(
    () => {
      if (!open) return;

      positionMenu();
      void loadActionState();

      const onKey =
        (event: KeyboardEvent) => {
          if (
            event.key ===
            "Escape"
          ) {
            setOpen(false);
          }
        };

      window.addEventListener(
        "keydown",
        onKey,
      );
      window.addEventListener(
        "resize",
        positionMenu,
      );

      return () => {
        window.removeEventListener(
          "keydown",
          onKey,
        );
        window.removeEventListener(
          "resize",
          positionMenu,
        );
      };
    },
    [
      loadActionState,
      open,
      positionMenu,
    ],
  );

  const handleToggleSave =
    async () => {
      if (
        !registryTrackId ||
        entityActionPending
      ) {
        return;
      }

      setMessage(null);

      try {
        const result =
          await setSaved(
            {
              entityType:
                "track",
              entityId:
                registryTrackId,
              entitySlug:
                trackSlug ||
                undefined,
              entityUrl:
                trackPath ||
                undefined,
              title:
                safeTrackTitle,
              subtitle:
                artistName,
              imageUrl:
                artworkUrl ||
                undefined,
            },
            !saved,
          );

        if (result) {
          setSavedLocal(
            result.saved,
          );
        }
      } catch (error) {
        setMessage(
          error instanceof Error
            ? error.message
            : "Could not update Save.",
        );
      }
    };

  const handleToggleFollow =
    async () => {
      const targetId =
        artistId ||
        artistSlug;

      if (
        !targetId ||
        entityActionPending
      ) {
        return;
      }

      setMessage(null);

      try {
        const result =
          await setFollow(
            "artist",
            targetId,
            artistSlug ||
              undefined,
            !following,
          );

        if (result) {
          setFollowing(
            result.followed,
          );
        }
      } catch (error) {
        setMessage(
          error instanceof Error
            ? error.message
            : "Could not update Artist follow.",
        );
      }
    };

  const openMenu = () => {
    positionMenu();
    setMessage(null);
    setOpen(true);
  };

  const menuClass =
    desktop
      ? "fixed z-[111] w-72 overflow-hidden rounded-2xl border border-[var(--wk-border)] bg-[var(--wk-surface)] shadow-2xl"
      : "fixed inset-x-0 bottom-0 z-[111] max-h-[82dvh] overflow-hidden rounded-t-2xl border border-[var(--wk-border)] bg-[var(--wk-surface)] shadow-2xl";

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={(event) => {
          event.stopPropagation();
          openMenu();
        }}
        className={[
          "inline-flex shrink-0 items-center justify-center rounded-full border border-[var(--wk-border)] text-[var(--wk-text-muted)] transition-colors hover:bg-[var(--wk-surface-raised)] hover:text-[var(--wk-text)]",
          compact
            ? "h-9 w-9"
            : "h-10 w-10",
        ].join(" ")}
        aria-label={`More actions for ${safeTrackTitle}`}
        title="More Track actions"
      >
        <i
          className="ri-more-2-fill text-[18px]"
          aria-hidden="true"
        />
      </button>

      {open ? (
        <Portal>
          <div
            className={[
              "fixed inset-0 z-[110]",
              desktop
                ? "bg-transparent"
                : "bg-black/45",
            ].join(" ")}
            onMouseDown={() => {
              setOpen(false);
            }}
          />

          <section
            className={menuClass}
            style={
              desktop
                ? {
                    top:
                      anchor.top,
                    left:
                      anchor.left,
                  }
                : undefined
            }
            role="dialog"
            aria-modal="true"
            aria-label={`Actions for ${safeTrackTitle}`}
            onMouseDown={(event) => {
              event.stopPropagation();
            }}
          >
            <div className="flex items-center justify-between gap-3 border-b border-[var(--wk-border)] px-4 py-3">
              <div className="min-w-0">
                <div className="truncate text-[13px] font-black text-[var(--wk-text)]">
                  {safeTrackTitle}
                </div>
                <div className="truncate text-[10px] font-semibold text-[var(--wk-text-muted)]">
                  Track actions
                </div>
              </div>

              <button
                type="button"
                onClick={() => {
                  setOpen(false);
                }}
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[var(--wk-text-muted)] hover:bg-[var(--wk-surface-raised)]"
                aria-label="Close Track actions"
              >
                <i
                  className="ri-close-line text-[16px]"
                  aria-hidden="true"
                />
              </button>
            </div>

            <div
              data-scroll-lock="container"
              className="max-h-[64dvh] overflow-y-auto p-2"
            >
              {registryTrackId ? (
                <AddToPlaylistButton
                  trackId={registryTrackId}
                  trackTitle={safeTrackTitle}
                  menuRow
                />
              ) : null}

              {registryTrackId ? (
                <ActionRow
                  icon="ri-heart-line"
                  label={
                    saved
                      ? "Saved Track"
                      : "Save Track"
                  }
                  onClick={() => {
                    void handleToggleSave();
                  }}
                  active={saved}
                  pending={
                    stateLoading ||
                    entityActionPending
                  }
                />
              ) : null}

              {artistId ||
              artistSlug ? (
                <ActionRow
                  icon="ri-user-add-line"
                  label={
                    following
                      ? "Following Artist"
                      : "Follow Artist"
                  }
                  onClick={() => {
                    void handleToggleFollow();
                  }}
                  active={following}
                  pending={
                    stateLoading ||
                    entityActionPending
                  }
                />
              ) : null}

              <ActionRow
                icon="ri-share-forward-line"
                label="Share"
                onClick={() => {
                  setOpen(false);
                  setShareOpen(true);
                }}
              />

              {trackPath ? (
                <ActionRow
                  icon="ri-music-2-line"
                  label="View Track"
                  onClick={() => {
                    setOpen(false);
                    navigate(
                      trackPath,
                    );
                  }}
                />
              ) : null}

              {artistPath ? (
                <ActionRow
                  icon="ri-user-line"
                  label="Go to Artist"
                  onClick={() => {
                    setOpen(false);
                    navigate(
                      artistPath,
                    );
                  }}
                />
              ) : null}

              {releasePath ? (
                <ActionRow
                  icon="ri-album-line"
                  label={
                    releaseTitle
                      ? `Go to ${releaseTitle}`
                      : "Go to Release"
                  }
                  onClick={() => {
                    setOpen(false);
                    navigate(
                      releasePath,
                    );
                  }}
                />
              ) : null}

              {onDiscuss ? (
                <ActionRow
                  icon="ri-chat-3-line"
                  label="Discuss Track"
                  onClick={() => {
                    setOpen(false);
                    onDiscuss();
                  }}
                />
              ) : null}

              <ActionRow
                icon="ri-edit-line"
                label="Suggest a Correction"
                onClick={() => {
                  setOpen(false);
                  setCorrectionOpen(true);
                }}
              />

              {message ? (
                <div
                  role="status"
                  className="mx-2 mt-2 rounded-xl bg-[var(--wk-surface-raised)] px-3 py-2 text-[10px] font-semibold leading-relaxed text-[var(--wk-text-muted)]"
                >
                  {message}
                </div>
              ) : null}
            </div>
          </section>
        </Portal>
      ) : null}

      <ShareSheet
        item={{
          title:
            safeTrackTitle,
          subtitle:
            artistName,
          description:
            `${safeTrackTitle} by ${artistName}`,
          imageUrl:
            artworkUrl ||
            null,
          url:
            trackPath ||
            undefined,
          type:
            "track",
        }}
        open={shareOpen}
        onClose={() => {
          setShareOpen(false);
        }}
      />

      <ContributionSheet
        entity={trackEntity}
        open={correctionOpen}
        onClose={() => {
          setCorrectionOpen(false);
        }}
        userId={
          authUser.id ||
          undefined
        }
      />
    </>
  );
}
