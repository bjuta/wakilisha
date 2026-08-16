import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  Link,
} from "react-router-dom";
import {
  WkIcon,
} from "@/components/design-system/Icon";
import {
  Portal,
} from "@/components/base/Portal";
import {
  useScrollLock,
} from "@/hooks/useScrollLock";
import {
  useAuthUser,
} from "@/hooks/useAuthUser";
import {
  getUserProfileWithStats,
} from "@/services/community";
import {
  addPersonalPlaylistTrack,
  createPersonalPlaylist,
  getMyPersonalPlaylist,
  listMyPersonalPlaylists,
  type PersonalPlaylistDetail,
  type PersonalPlaylistSummary,
} from "@/services/playlists/personalPlaylistService";

export function AddToPlaylistButton({
  trackId,
  trackTitle,
  compact = false,
  iconOnly = false,
  reactionStyle = false,
  menuRow = false,
}: {
  trackId: string | null | undefined;
  trackTitle: string;
  compact?: boolean;
  iconOnly?: boolean;
  reactionStyle?: boolean;
  menuRow?: boolean;
}) {
  const authUser = useAuthUser();
  const trackLabel =
    trackTitle.trim() ||
    "this Track";
  const [open, setOpen] = useState(false);
  const [playlists, setPlaylists] =
    useState<PersonalPlaylistSummary[]>([]);
  const [playlistDetails, setPlaylistDetails] =
    useState<Record<string, PersonalPlaylistDetail>>({});
  const [loading, setLoading] = useState(false);
  const [pendingPlaylistId, setPendingPlaylistId] =
    useState<string | null>(null);
  const [duplicateConfirmPlaylistId, setDuplicateConfirmPlaylistId] =
    useState<string | null>(null);
  const [message, setMessage] =
    useState<string | null>(null);
  const [ownerUsername, setOwnerUsername] =
    useState("");
  const [creatingNew, setCreatingNew] =
    useState(false);
  const [newPlaylistTitle, setNewPlaylistTitle] =
    useState("");
  const [creatingPlaylist, setCreatingPlaylist] =
    useState(false);

  useScrollLock(open);

  const loadPlaylists = useCallback(
    async () => {
      if (!authUser.id) return;

      setLoading(true);

      try {
        const [
          playlistRows,
          profile,
        ] = await Promise.all([
          listMyPersonalPlaylists(),
          getUserProfileWithStats(
            authUser.id,
          ),
        ]);

        const detailResults =
          await Promise.allSettled(
            playlistRows.map(
              (playlist) =>
                getMyPersonalPlaylist(
                  playlist.playlistId,
                ),
            ),
          );

        const nextDetails: Record<string, PersonalPlaylistDetail> = {};

        detailResults.forEach(
          (result, index) => {
            if (
              result.status === "fulfilled" &&
              result.value
            ) {
              nextDetails[
                playlistRows[index].playlistId
              ] = result.value;
            }
          },
        );

        setPlaylists(
          playlistRows,
        );
        setPlaylistDetails(
          nextDetails,
        );
        setOwnerUsername(
          profile?.username ?? "",
        );
      } catch (error) {
        setMessage(
          error instanceof Error
            ? error.message
            : "Could not load your Playlists.",
        );
      } finally {
        setLoading(false);
      }
    },
    [authUser.id],
  );

  useEffect(
    () => {
      if (open) {
        void loadPlaylists();
      }
    },
    [loadPlaylists, open],
  );

  const membershipCounts = useMemo(
    () =>
      Object.fromEntries(
        playlists.map(
          (playlist) => [
            playlist.playlistId,
            (playlistDetails[playlist.playlistId]?.tracks ?? []).filter(
              (track) =>
                track.registryTrackId === trackId,
            ).length,
          ],
        ),
      ) as Record<string, number>,
    [
      playlistDetails,
      playlists,
      trackId,
    ],
  );

  if (!trackId) return null;

  const handleOpen = () => {
    if (authUser.loading) return;

    if (!authUser.id) {
      const returnTo =
        typeof window !== "undefined"
          ? `${window.location.pathname}${window.location.search}`
          : "/music";

      window.location.assign(
        `/auth?returnTo=${encodeURIComponent(returnTo)}`,
      );
      return;
    }

    setMessage(null);
    setDuplicateConfirmPlaylistId(null);
    setOpen(true);
  };

  const handleAdd = async (
    playlist: PersonalPlaylistSummary,
    allowDuplicate = false,
  ) => {
    const existingCount =
      membershipCounts[playlist.playlistId] ?? 0;

    if (
      existingCount > 0 &&
      !allowDuplicate
    ) {
      setDuplicateConfirmPlaylistId(
        playlist.playlistId,
      );
      setMessage(null);
      return;
    }

    setPendingPlaylistId(
      playlist.playlistId,
    );
    setDuplicateConfirmPlaylistId(null);
    setMessage(null);

    try {
      const detail =
        playlistDetails[playlist.playlistId] ??
        await getMyPersonalPlaylist(
          playlist.playlistId,
        );

      if (!detail) {
        throw new Error(
          "This Playlist is no longer available.",
        );
      }

      await addPersonalPlaylistTrack(
        playlist.playlistId,
        detail.authorityRevision,
        trackId,
        {
          allowDuplicate,
        },
      );

      setMessage(
        allowDuplicate
          ? `Added another copy of "${trackLabel}" to "${playlist.title}".`
          : `Saved "${trackLabel}" to "${playlist.title}".`,
      );

      await loadPlaylists();
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Could not add this Track.",
      );
    } finally {
      setPendingPlaylistId(null);
    }
  };

  const duplicateConfirmPlaylist =
    playlists.find(
      (playlist) =>
        playlist.playlistId ===
        duplicateConfirmPlaylistId,
    ) ?? null;

  const handleCreateAndAdd = async () => {
    const title =
      newPlaylistTitle.trim();

    if (
      !title ||
      creatingPlaylist
    ) {
      return;
    }

    setCreatingPlaylist(true);
    setMessage(null);

    try {
      const created =
        await createPersonalPlaylist({
          title,
          visibility: "private",
        });

      if (
        !created.playlistId ||
        created.authorityRevision < 1
      ) {
        throw new Error(
          "Could not create this Playlist.",
        );
      }

      try {
        await addPersonalPlaylistTrack(
          created.playlistId,
          created.authorityRevision,
          trackId,
        );

        setMessage(
          `Created "${title}" and added "${trackLabel}".`,
        );
        setNewPlaylistTitle("");
        setCreatingNew(false);
      } catch {
        setMessage(
          `Created "${title}", but "${trackLabel}" was not added. Choose the new Playlist below to try again.`,
        );
        setNewPlaylistTitle("");
        setCreatingNew(false);
      }

      await loadPlaylists();
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Could not create this Playlist.",
      );
    } finally {
      setCreatingPlaylist(false);
    }
  };

  const createPlaylistForm = (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        void handleCreateAndAdd();
      }}
      className="rounded-xl border border-[var(--wk-border)] bg-[var(--wk-surface-raised)]/55 p-3"
    >
      <label
        htmlFor="wk-inline-playlist-title"
        className="text-[11px] font-black text-[var(--wk-text)]"
      >
        Create a new Playlist
      </label>

      <p className="mt-1 text-[10px] leading-relaxed text-[var(--wk-text-muted)]">
        Start a new vibe without leaving this Track.
      </p>

      <input
        id="wk-inline-playlist-title"
        type="text"
        value={newPlaylistTitle}
        onChange={(event) => {
          setNewPlaylistTitle(
            event.target.value,
          );
        }}
        maxLength={300}
        autoComplete="off"
        placeholder="Name the vibe"
        className="mt-3 h-10 w-full rounded-lg border border-[var(--wk-border)] bg-[var(--wk-surface)] px-3 text-[12px] font-bold text-[var(--wk-text)] outline-none transition-colors placeholder:text-[var(--wk-text-faint)] focus:border-[var(--wk-brand)]"
      />

      <div className="mt-2 text-[9px] font-semibold text-[var(--wk-text-muted)]">
        Starts Private. You can change this later.
      </div>

      <div className="mt-3 flex items-center gap-2">
        <button
          type="submit"
          disabled={
            creatingPlaylist ||
            !newPlaylistTitle.trim()
          }
          className="inline-flex h-8 items-center gap-1.5 rounded-full bg-[var(--wk-brand)] px-3 text-[10px] font-black text-white disabled:cursor-not-allowed disabled:opacity-50"
        >
          <WkIcon
            name={
              creatingPlaylist
                ? "Loader2"
                : "Plus"
            }
            size={13}
            className={
              creatingPlaylist
                ? "animate-spin"
                : undefined
            }
          />
          Create and add
        </button>

        {playlists.length > 0 ? (
          <button
            type="button"
            disabled={creatingPlaylist}
            onClick={() => {
              setCreatingNew(false);
              setNewPlaylistTitle("");
            }}
            className="inline-flex h-8 items-center rounded-full px-3 text-[10px] font-black text-[var(--wk-text-muted)] hover:bg-[var(--wk-surface)] disabled:opacity-50"
          >
            Cancel
          </button>
        ) : null}
      </div>
    </form>
  );

  return (
    <>
      <button
        type="button"
        onClick={handleOpen}
        className={[
          "inline-flex items-center justify-center gap-1.5 font-bold transition-colors",
          menuRow
            ? "w-full justify-start rounded-xl px-3 py-2.5 text-[12px] text-[var(--wk-text)] hover:bg-[var(--wk-surface-raised)]"
            : reactionStyle
              ? "h-10 w-10 rounded-full p-0 text-[var(--wk-text-muted)] hover:bg-[var(--wk-surface-raised)] hover:text-[var(--wk-text)]"
              : "rounded-lg border border-[var(--wk-border)] text-[var(--wk-text)] hover:border-[var(--wk-border-2)] hover:bg-[var(--wk-surface-raised)]",
          menuRow
            ? ""
            : reactionStyle
              ? ""
              : iconOnly
                ? compact
                  ? "h-8 w-8 p-0 text-[11px]"
                  : "h-9 w-9 p-0 text-[12px]"
                : compact
                  ? "h-8 px-2.5 text-[11px]"
                  : "h-9 px-3 text-[12px]",
        ].filter(Boolean).join(" ")}
        aria-label="Add to Playlist"
        title="Add to Playlist"
      >
        <WkIcon
          name="ListMusic"
          size={menuRow ? 17 : reactionStyle ? 17 : compact ? 14 : 16}
        />
        <span className={menuRow ? undefined : iconOnly || reactionStyle ? "sr-only" : undefined}>
          Add to Playlist
        </span>
      </button>

      {open ? (
        <Portal>
          <div
            className="fixed inset-0 z-[120] flex items-end justify-center bg-black/45 p-0 sm:items-center sm:p-5"
          role="presentation"
          onMouseDown={(event) => {
            if (
              event.target ===
              event.currentTarget
            ) {
              setOpen(false);
            }
          }}
        >
          <section
            className="max-h-[78dvh] w-full overflow-hidden rounded-t-2xl border border-[var(--wk-border)] bg-[var(--wk-surface)] shadow-2xl sm:max-w-md sm:rounded-2xl"
            role="dialog"
            aria-modal="true"
            aria-label="Add Track to Playlist"
          >
            <header className="flex items-center justify-between border-b border-[var(--wk-border)] px-5 py-4">
              <div>
                <div className="text-[15px] font-black text-[var(--wk-text)]">
                  Choose a Playlist
                </div>
              </div>

              <button
                type="button"
                onClick={() => setOpen(false)}
                className="flex h-8 w-8 items-center justify-center rounded-full text-[var(--wk-text-muted)] hover:bg-[var(--wk-surface-raised)]"
                aria-label="Close"
              >
                <WkIcon
                  name="X"
                  size={16}
                />
              </button>
            </header>

            <div className="max-h-[56dvh] overflow-y-auto p-3">
              {loading ? (
                <div className="px-3 py-10 text-center text-sm font-semibold text-[var(--wk-text-muted)]">
                  Loading your Playlists...
                </div>
              ) : playlists.length === 0 ? (
                <div className="px-3 py-8 text-center">
                  <WkIcon
                    name="ListMusic"
                    size={28}
                    className="mx-auto text-[var(--wk-text-faint)]"
                  />

                  <h3 className="mt-3 text-sm font-black text-[var(--wk-text)]">
                    Make your first Playlist
                  </h3>

                  <p className="mx-auto mt-2 max-w-xs text-[12px] leading-relaxed text-[var(--wk-text-muted)]">
                    Create a Playlist, then save "{trackLabel}" to it.
                  </p>

                  <div className="mt-5 text-left">
                    {createPlaylistForm}
                  </div>
                </div>
              ) : (
                <div className="space-y-1">
                  <button
                    type="button"
                    disabled={
                      pendingPlaylistId !== null ||
                      creatingPlaylist
                    }
                    onClick={() => {
                      setMessage(null);
                      setCreatingNew(
                        (current) =>
                          !current,
                      );
                    }}
                    className="flex w-full items-center gap-3 rounded-xl border border-dashed border-[var(--wk-border)] px-3 py-3 text-left transition-colors hover:border-[var(--wk-brand)]/45 hover:bg-[var(--wk-surface-raised)] disabled:opacity-60"
                  >
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--wk-brand-soft)] text-[var(--wk-brand)]">
                      <WkIcon
                        name="Plus"
                        size={15}
                      />
                    </span>

                    <span className="min-w-0">
                      <span className="block text-[12px] font-black text-[var(--wk-text)]">
                        Create new Playlist
                      </span>
                      <span className="mt-0.5 block text-[10px] font-semibold text-[var(--wk-text-muted)]">
                        Start a new vibe with "{trackLabel}".
                      </span>
                    </span>
                  </button>

                  {creatingNew ? (
                    <div className="pb-2">
                      {createPlaylistForm}
                    </div>
                  ) : null}

                  {duplicateConfirmPlaylist ? (
                    <div
                      className="mx-1 mb-2 rounded-xl border border-[var(--wk-brand)]/25 bg-[var(--wk-brand-soft)]/45 p-3"
                      role="status"
                    >
                      <div className="flex items-start gap-3">
                        <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[var(--wk-brand-soft)] text-[var(--wk-brand)]">
                          <WkIcon
                            name="AlertCircle"
                            size={14}
                          />
                        </span>

                        <div className="min-w-0 flex-1">
                          <p className="text-[11px] font-black leading-relaxed text-[var(--wk-text)]">
                            "{trackLabel}" is already in "{duplicateConfirmPlaylist.title}". Add another copy?
                          </p>

                          <p className="mt-1 text-[10px] leading-relaxed text-[var(--wk-text-muted)]">
                            You can keep duplicates when that is what you want.
                          </p>

                          <div className="mt-3 flex items-center gap-2">
                            <button
                              type="button"
                              disabled={pendingPlaylistId !== null}
                              onClick={() => {
                                void handleAdd(
                                  duplicateConfirmPlaylist,
                                  true,
                                );
                              }}
                              className="inline-flex h-8 items-center rounded-full bg-[var(--wk-brand)] px-3 text-[10px] font-black text-white disabled:opacity-60"
                            >
                              Add again
                            </button>

                            <button
                              type="button"
                              disabled={pendingPlaylistId !== null}
                              onClick={() => {
                                setDuplicateConfirmPlaylistId(
                                  null,
                                );
                              }}
                              className="inline-flex h-8 items-center rounded-full px-3 text-[10px] font-black text-[var(--wk-text-muted)] hover:bg-[var(--wk-surface)] disabled:opacity-60"
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  ) : null}

                  {playlists.map(
                    (playlist) => {
                      const existingCount =
                        membershipCounts[playlist.playlistId] ?? 0;

                      return (
                      <button
                        key={playlist.playlistId}
                        type="button"
                        disabled={pendingPlaylistId !== null}
                        onClick={() => {
                          void handleAdd(
                            playlist,
                          );
                        }}
                        className="flex w-full items-center justify-between gap-4 rounded-xl px-3 py-3 text-left hover:bg-[var(--wk-surface-raised)] disabled:opacity-60"
                      >
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <div className="text-[13px] font-black leading-snug text-[var(--wk-text)]">
                              {existingCount > 0
                                ? `"${trackLabel}" is already in "${playlist.title}"`
                                : `Save "${trackLabel}" to "${playlist.title}"`}
                            </div>

                            {existingCount > 0 ? (
                              <span className="rounded-full bg-[var(--wk-brand-soft)] px-2 py-0.5 text-[9px] font-black uppercase tracking-[0.08em] text-[var(--wk-brand)]">
                                Already added
                              </span>
                            ) : null}
                          </div>

                          <div className="mt-1 flex items-center gap-2 text-[10px] font-bold text-[var(--wk-text-muted)]">
                            <span>
                              {playlist.itemCount}{" "}
                              {playlist.itemCount === 1
                                ? "Track"
                                : "Tracks"}
                            </span>
                            <span>·</span>
                            <span className="capitalize">
                              {playlist.visibility}
                            </span>
                            {existingCount > 0 ? (
                              <>
                                <span>·</span>
                                <span>
                                  {existingCount} {existingCount === 1 ? "copy already" : "copies already"}
                                </span>
                              </>
                            ) : null}
                          </div>
                        </div>

                        <WkIcon
                          name={
                            pendingPlaylistId ===
                            playlist.playlistId
                              ? "Loader2"
                              : existingCount > 0
                                ? "AlertCircle"
                                : "ArrowRight"
                          }
                          size={16}
                          className={
                            pendingPlaylistId ===
                            playlist.playlistId
                              ? "animate-spin text-[var(--wk-brand)]"
                              : existingCount > 0
                                ? "text-[var(--wk-brand)]"
                                : "text-[var(--wk-text-faint)]"
                          }
                        />
                      </button>
                      );
                    },
                  )}
                </div>
              )}

              {message ? (
                <div className="mx-3 my-3 rounded-lg bg-[var(--wk-surface-raised)] px-3 py-2 text-[11px] font-bold text-[var(--wk-text-muted)]">
                  {message}
                </div>
              ) : null}
            </div>

            <footer className="border-t border-[var(--wk-border)] px-5 py-3">
              <Link
                to={
                  ownerUsername
                    ? `/u/${ownerUsername}/playlists`
                    : "/profile"
                }
                onClick={() => setOpen(false)}
                className="text-[11px] font-black text-[var(--wk-brand)] hover:underline"
              >
                Manage your Playlists
              </Link>
            </footer>
          </section>
          </div>
        </Portal>
      ) : null}
    </>
  );
}
