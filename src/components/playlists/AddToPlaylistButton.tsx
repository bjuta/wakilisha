import {
  useCallback,
  useEffect,
  useState,
} from "react";
import {
  Link,
} from "react-router-dom";
import {
  WkIcon,
} from "@/components/design-system/Icon";
import {
  useAuthUser,
} from "@/hooks/useAuthUser";
import {
  getUserProfileWithStats,
} from "@/services/community";
import {
  addPersonalPlaylistTrack,
  getMyPersonalPlaylist,
  listMyPersonalPlaylists,
  type PersonalPlaylistSummary,
} from "@/services/playlists/personalPlaylistService";

export function AddToPlaylistButton({
  trackId,
  trackTitle,
  compact = false,
}: {
  trackId: string | null | undefined;
  trackTitle: string;
  compact?: boolean;
}) {
  const authUser = useAuthUser();
  const trackLabel =
    trackTitle.trim() ||
    "this Track";
  const [open, setOpen] = useState(false);
  const [playlists, setPlaylists] =
    useState<PersonalPlaylistSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [pendingPlaylistId, setPendingPlaylistId] =
    useState<string | null>(null);
  const [message, setMessage] =
    useState<string | null>(null);
  const [ownerUsername, setOwnerUsername] =
    useState("");

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

        setPlaylists(
          playlistRows,
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
    setOpen(true);
  };

  const handleAdd = async (
    playlist: PersonalPlaylistSummary,
  ) => {
    setPendingPlaylistId(
      playlist.playlistId,
    );
    setMessage(null);

    try {
      const detail =
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
      );

      setMessage(
        `Saved "${trackLabel}" to "${playlist.title}".`,
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

  return (
    <>
      <button
        type="button"
        onClick={handleOpen}
        className={[
          "inline-flex items-center justify-center gap-1.5 rounded-lg border border-[var(--wk-border)] font-bold text-[var(--wk-text)] transition-colors hover:border-[var(--wk-border-2)] hover:bg-[var(--wk-surface-raised)]",
          compact
            ? "h-8 px-2.5 text-[11px]"
            : "h-9 px-3 text-[12px]",
        ].join(" ")}
        aria-label="Add to Playlist"
        title="Add to Playlist"
      >
        <WkIcon
          name="ListMusic"
          size={compact ? 14 : 16}
        />
        <span>
          Add to Playlist
        </span>
      </button>

      {open ? (
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

                  <Link
                    to={
                      ownerUsername
                        ? `/u/${ownerUsername}/playlists?create=1`
                        : "/profile"
                    }
                    onClick={() => setOpen(false)}
                    className="mt-5 inline-flex h-9 items-center gap-2 rounded-lg bg-[var(--wk-brand)] px-4 text-xs font-black text-white"
                  >
                    <WkIcon
                      name="Plus"
                      size={15}
                    />
                    Create Playlist
                  </Link>
                </div>
              ) : (
                <div className="space-y-1">
                  {playlists.map(
                    (playlist) => (
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
                          <div className="text-[13px] font-black leading-snug text-[var(--wk-text)]">
                            Save "{trackLabel}" to "{playlist.title}"
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
                          </div>
                        </div>

                        <WkIcon
                          name={
                            pendingPlaylistId ===
                            playlist.playlistId
                              ? "Loader2"
                              : "ArrowRight"
                          }
                          size={16}
                          className={
                            pendingPlaylistId ===
                            playlist.playlistId
                              ? "animate-spin text-[var(--wk-brand)]"
                              : "text-[var(--wk-text-faint)]"
                          }
                        />
                      </button>
                    ),
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
      ) : null}
    </>
  );
}
