import {
  type FormEvent,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  Link,
  useNavigate,
  useParams,
} from "react-router-dom";
import { WkIcon } from "@/components/design-system/Icon";
import { ShareButton } from "@/components/design-system/share/ShareSheet";
import { PlaylistCoverPresentation } from "@/components/media/PlaylistCoverPresentation";
import { MetaTags } from "@/components/seo/MetaTags";
import { AddToPlaylistButton } from "@/components/playlists/AddToPlaylistButton";
import {
  usePlayer,
  type PlayerTrack,
} from "@/context/PlayerContext";
import { useAuthUser } from "@/hooks/useAuthUser";
import {
  archivePersonalPlaylist,
  getMyPersonalPlaylistByRoute,
  getPublicPersonalPlaylist,
  removePersonalPlaylistItem,
  reorderPersonalPlaylistItems,
  updatePersonalPlaylist,
  type PersonalPlaylistDetail,
} from "@/services/playlists/personalPlaylistService";

function artistLabel(
  names: string[],
): string {
  return names.length > 0
    ? names.join(", ")
    : "WAKILISHA";
}

function durationLabel(
  milliseconds:
    | number
    | null,
): string {
  if (
    !milliseconds ||
    milliseconds <= 0
  ) {
    return "";
  }

  const seconds =
    Math.round(
      milliseconds /
        1000,
    );

  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}

export default function PersonPlaylistDetailPage() {
  const {
    username = "",
    playlistSlug = "",
  } =
    useParams<{
      username: string;
      playlistSlug: string;
    }>();

  const authUser =
    useAuthUser();

  const player =
    usePlayer();

  const navigate =
    useNavigate();

  const [
    playlist,
    setPlaylist,
  ] =
    useState<
      PersonalPlaylistDetail | null
    >(null);

  const [
    isOwner,
    setIsOwner,
  ] =
    useState(false);

  const [
    isEditing,
    setIsEditing,
  ] =
    useState(false);

  const [
    loading,
    setLoading,
  ] =
    useState(true);

  const [
    pending,
    setPending,
  ] =
    useState<
      string | null
    >(null);

  const [
    error,
    setError,
  ] =
    useState<
      string | null
    >(null);

  const [
    title,
    setTitle,
  ] =
    useState("");

  const [
    description,
    setDescription,
  ] =
    useState("");

  const [
    visibility,
    setVisibility,
  ] =
    useState<
      "private" | "public"
    >("private");

  const load =
    async () => {
      if (
        !username ||
        !playlistSlug
      ) {
        setPlaylist(null);
        setLoading(false);
        return;
      }

      setLoading(true);
      setError(null);

      try {
        let detail:
          | PersonalPlaylistDetail
          | null = null;

        let ownerView =
          false;

        if (authUser.id) {
          detail =
            await getMyPersonalPlaylistByRoute(
              username,
              playlistSlug,
            );

          ownerView =
            Boolean(detail);
        }

        if (!detail) {
          detail =
            await getPublicPersonalPlaylist(
              username,
              playlistSlug,
            );
        }

        setPlaylist(detail);
        setIsOwner(
          ownerView,
        );

        if (detail) {
          setTitle(
            detail.title,
          );

          setDescription(
            detail.description ??
              "",
          );

          setVisibility(
            detail.visibility,
          );
        }
      } catch (
        loadError
      ) {
        setError(
          loadError instanceof Error
            ? loadError.message
            : "Could not load this Playlist.",
        );
      } finally {
        setLoading(false);
      }
    };

  useEffect(
    () => {
      if (
        !authUser.loading
      ) {
        void load();
      }
    },
    [
      authUser.id,
      authUser.loading,
      playlistSlug,
      username,
    ],
  );

  const queue =
    useMemo<
      PlayerTrack[]
    >(
      () =>
        playlist?.tracks.map(
          (track) => ({
            id:
              track.registryTrackId ??
              track.playlistItemId,
            title:
              track.title,
            artist:
              artistLabel(
                track.artistNames,
              ),
            artworkUrl:
              track.artworkUrl ??
              undefined,
            album:
              track.releaseTitle ??
              undefined,
            duration:
              track.durationMs
                ? Math.round(
                    track.durationMs /
                      1000,
                  )
                : undefined,
            isPlayable:
              Boolean(
                track.previewUrl,
              ),
            previewUrl:
              track.previewUrl ??
              undefined,
            playbackEngine:
              "audio",
          }),
        ) ??
        [],
      [playlist],
    );

  const orderedIds =
    useMemo(
      () =>
        playlist?.tracks.map(
          (track) =>
            track.playlistItemId,
        ) ??
        [],
      [playlist],
    );

  const isMetadataDirty =
    useMemo(
      () => {
        if (!playlist) {
          return false;
        }

        return (
          title.trim() !==
            playlist.title ||
          (description.trim() ||
            null) !==
            (playlist.description ??
              null) ||
          visibility !==
            playlist.visibility
        );
      },
      [
        description,
        playlist,
        title,
        visibility,
      ],
    );

  const beginEditing =
    () => {
      if (
        !playlist ||
        playlist.lifecycleStatus ===
          "archived"
      ) {
        return;
      }

      setTitle(
        playlist.title,
      );
      setDescription(
        playlist.description ??
          "",
      );
      setVisibility(
        playlist.visibility,
      );
      setError(null);
      setIsEditing(true);
    };

  const cancelEditing =
    () => {
      if (!playlist) {
        return;
      }

      setTitle(
        playlist.title,
      );
      setDescription(
        playlist.description ??
          "",
      );
      setVisibility(
        playlist.visibility,
      );
      setError(null);
      setIsEditing(false);
    };

  const saveMetadata =
    async (
      event:
        FormEvent<HTMLFormElement>,
    ) => {
      event.preventDefault();

      if (
        !playlist ||
        !isOwner ||
        !isMetadataDirty ||
        !title.trim()
      ) {
        return;
      }

      setPending("save");
      setError(null);

      try {
        await updatePersonalPlaylist(
          playlist.playlistId,
          playlist.authorityRevision,
          {
            title:
              title.trim(),
            description:
              description.trim() ||
              null,
            visibility,
          },
        );

        await load();
        setIsEditing(false);
      } catch (
        saveError
      ) {
        setError(
          saveError instanceof Error
            ? saveError.message
            : "Could not save this Playlist.",
        );
      } finally {
        setPending(null);
      }
    };

  const moveTrack =
    async (
      index: number,
      direction:
        | -1
        | 1,
    ) => {
      if (
        !playlist ||
        !isOwner
      ) {
        return;
      }

      const targetIndex =
        index +
        direction;

      if (
        targetIndex <
          0 ||
        targetIndex >=
          orderedIds.length
      ) {
        return;
      }

      const next =
        [...orderedIds];

      [
        next[index],
        next[targetIndex],
      ] = [
        next[targetIndex],
        next[index],
      ];

      setPending(
        `move:${next[index]}`,
      );
      setError(null);

      try {
        await reorderPersonalPlaylistItems(
          playlist.playlistId,
          playlist.authorityRevision,
          next,
        );

        await load();
      } catch (
        moveError
      ) {
        setError(
          moveError instanceof Error
            ? moveError.message
            : "Could not change the Track order.",
        );
      } finally {
        setPending(null);
      }
    };

  const removeTrack =
    async (
      playlistItemId:
        string,
    ) => {
      if (
        !playlist ||
        !isOwner
      ) {
        return;
      }

      setPending(
        `remove:${playlistItemId}`,
      );
      setError(null);

      try {
        await removePersonalPlaylistItem(
          playlist.playlistId,
          playlistItemId,
          playlist.authorityRevision,
        );

        await load();
      } catch (
        removeError
      ) {
        setError(
          removeError instanceof Error
            ? removeError.message
            : "Could not remove this Track.",
        );
      } finally {
        setPending(null);
      }
    };

  const archive =
    async () => {
      if (
        !playlist ||
        !isOwner ||
        !window.confirm(
          `Archive "${playlist.title}"? It will stop being public, but its history will be preserved.`,
        )
      ) {
        return;
      }

      setPending(
        "archive",
      );
      setError(null);

      try {
        await archivePersonalPlaylist(
          playlist.playlistId,
          playlist.authorityRevision,
        );

        navigate(
          `/u/${encodeURIComponent(username)}/playlists`,
        );
      } catch (
        archiveError
      ) {
        setError(
          archiveError instanceof Error
            ? archiveError.message
            : "Could not archive this Playlist.",
        );
      } finally {
        setPending(null);
      }
    };

  if (loading) {
    return (
      <main className="min-h-screen bg-[var(--wk-bg)] px-5 py-14">
        <div className="wk-container-wide animate-pulse">
          <div className="h-72 rounded-2xl bg-[var(--wk-surface-raised)]" />
        </div>
      </main>
    );
  }

  if (
    error ||
    !playlist
  ) {
    return (
      <main className="min-h-screen bg-[var(--wk-bg)] px-5 py-16">
        <div className="wk-container-wide max-w-lg text-center">
          <WkIcon
            name="ListMusic"
            size={34}
            className="mx-auto text-[var(--wk-text-faint)]"
          />

          <h1 className="mt-4 text-xl font-black text-[var(--wk-text)]">
            Playlist not available
          </h1>

          <p className="mt-2 text-sm text-[var(--wk-text-muted)]">
            {error ??
              "This Playlist is private, archived, or no longer available."}
          </p>

          <Link
            to={`/u/${username}/playlists`}
            className="mt-5 inline-flex text-xs font-black text-[var(--wk-brand)] hover:underline"
          >
            View @{username} Playlists
          </Link>
        </div>
      </main>
    );
  }

  const archived =
    playlist.lifecycleStatus ===
    "archived";

  const ownerName =
    playlist.owner?.displayName ??
    (
      playlist.owner?.username
        ? `@${playlist.owner.username}`
        : `@${username}`
    );

  const firstPlayableIndex =
    queue.findIndex(
      (track) =>
        track.isPlayable,
    );

  return (
    <>
      <MetaTags
        title={
          playlist.title
        }
        description={
          playlist.description ??
          `${ownerName} made this Playlist on WAKILISHA.`
        }
        url={`https://wakilisha.africa/u/${username}/playlists/${playlist.slug}`}
      />

      <main className="min-h-screen bg-[var(--wk-bg)] pb-28">
        <section className="border-b border-[var(--wk-border)]">
          <div className="wk-container-wide grid gap-7 px-5 py-9 md:grid-cols-[260px_minmax(0,1fr)] md:px-6 md:py-12">
            <div>
              <div className="aspect-square overflow-hidden rounded-2xl bg-[var(--wk-surface-raised)]">
                <PlaylistCoverPresentation
                  src={null}
                  altText={null}
                  slug={
                    playlist.slug
                  }
                  title={
                    playlist.title
                  }
                />
              </div>

              {isOwner ? (
                <div className="mt-4 flex flex-wrap gap-2">
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-[var(--wk-surface-raised)] px-2.5 py-1.5 text-[10px] font-black capitalize text-[var(--wk-text-muted)]">
                    <WkIcon
                      name={
                        archived
                          ? "Archive"
                          : playlist.visibility ===
                              "public"
                            ? "Globe"
                            : "Lock"
                      }
                      size={12}
                    />
                    {archived
                      ? "Archived"
                      : playlist.visibility}
                  </span>
                </div>
              ) : null}
            </div>

            <div className="flex min-w-0 flex-col justify-end">
              <div className="text-[10px] font-black uppercase tracking-[0.16em] text-[var(--wk-brand)]">
                {isOwner
                  ? "Your Playlist"
                  : "Playlist"}
              </div>

              <h1 className="mt-3 text-3xl font-black tracking-[-0.04em] text-[var(--wk-text)] md:text-5xl">
                {playlist.title}
              </h1>

              {playlist.description ? (
                <p className="mt-4 max-w-2xl text-[14px] leading-relaxed text-[var(--wk-text-soft)]">
                  {
                    playlist.description
                  }
                </p>
              ) : null}

              <div className="mt-5 flex flex-wrap items-center gap-3 text-[11px] font-bold text-[var(--wk-text-muted)]">
                <Link
                  to={`/u/${username}`}
                  className="font-black text-[var(--wk-text)] hover:text-[var(--wk-brand)]"
                >
                  {ownerName}
                </Link>

                <span>·</span>

                <span>
                  {
                    playlist.itemCount
                  }{" "}
                  {
                    playlist.itemCount ===
                    1
                      ? "Track"
                      : "Tracks"
                  }
                </span>
              </div>

              <div className="mt-6 flex flex-wrap gap-2">
                {firstPlayableIndex >=
                0 ? (
                  <button
                    type="button"
                    onClick={() => {
                      player.playTrack(
                        queue[
                          firstPlayableIndex
                        ],
                        queue,
                        {
                          pageType:
                            "personal_playlist",
                          entitySlug:
                            playlist.slug,
                          entityType:
                            "playlist",
                          sourceSection:
                            "playlist_header",
                        },
                      );
                    }}
                    className="inline-flex h-10 items-center gap-2 rounded-full bg-[var(--wk-brand)] px-5 text-xs font-black text-white"
                  >
                    <WkIcon
                      name="Play"
                      size={15}
                      fill="currentColor"
                    />
                    Play
                  </button>
                ) : null}

                {playlist.visibility ===
                  "public" &&
                !archived ? (
                  <ShareButton
                    item={{
                      title:
                        playlist.title,
                      subtitle:
                        `Made by ${ownerName}`,
                      description:
                        playlist.description ??
                        undefined,
                      type:
                        "playlist",
                    }}
                  />
                ) : null}

                {isOwner &&
                !archived &&
                !isEditing ? (
                  <button
                    type="button"
                    onClick={
                      beginEditing
                    }
                    className="inline-flex h-10 items-center gap-2 rounded-full border border-[var(--wk-border)] px-4 text-xs font-black text-[var(--wk-text)] hover:bg-[var(--wk-surface-raised)]"
                  >
                    <WkIcon
                      name="Settings"
                      size={14}
                    />
                    Playlist settings
                  </button>
                ) : null}
              </div>
            </div>
          </div>
        </section>

        <div className="wk-container-wide px-5 py-8 md:px-6 md:py-10">
          {error ? (
            <div className="mb-5 rounded-xl border border-[var(--wk-border)] bg-[var(--wk-surface)] px-4 py-3 text-[12px] font-bold text-red-500">
              {error}
            </div>
          ) : null}

          {isOwner &&
          !archived &&
          isEditing ? (
            <form
              onSubmit={
                saveMetadata
              }
              className="settings49-pane mb-6 max-sm:!p-4"
            >
              <div className="settings49-pane-head max-sm:!mb-3 max-sm:!pb-3">
                <div>
                  <h2 className="settings49-pane-title max-sm:!text-[20px]">
                    Playlist settings
                  </h2>
                  <p className="settings49-pane-desc max-sm:!text-[12px] max-sm:!leading-5">
                    Change how this Playlist appears and who can see it.
                  </p>
                </div>
              </div>

              <div className="settings49-input-grid max-sm:!gap-3">
                <label className="settings49-field full">
                  <span className="settings49-label">
                    Name
                  </span>
                  <input
                    value={title}
                    onChange={(event) =>
                      setTitle(
                        event.target.value,
                      )}
                    className="settings49-input max-sm:!py-2"
                  />
                </label>

                <label className="settings49-field full">
                  <span className="settings49-label">
                    Description
                  </span>
                  <textarea
                    value={
                      description
                    }
                    onChange={(event) =>
                      setDescription(
                        event.target.value,
                      )}
                    rows={3}
                    className="settings49-textarea max-sm:!min-h-[76px] max-sm:!py-2"
                  />
                </label>
              </div>

              <div className="settings49-row mt-5 max-sm:!mt-4 max-sm:!py-3">
                <div className="settings49-row-left">
                  <div className="settings49-row-label">
                    Visibility
                  </div>
                  <p className="settings49-row-desc">
                    Private is only for you. Public can be opened and shared by anyone with the link.
                  </p>
                </div>

                <div className="flex shrink-0 gap-2 max-sm:mt-3">
                  {(
                    [
                      "private",
                      "public",
                    ] as const
                  ).map(
                    (option) => (
                      <button
                        key={option}
                        type="button"
                        onClick={() =>
                          setVisibility(
                            option,
                          )}
                        className={[
                          "wk-button wk-button-sm",
                          visibility ===
                          option
                            ? "wk-button-primary"
                            : "wk-button-ghost",
                        ].join(" ")}
                      >
                        <WkIcon
                          name={
                            option ===
                            "public"
                              ? "Globe"
                              : "Lock"
                          }
                          size={14}
                        />
                        <span className="capitalize">
                          {option}
                        </span>
                      </button>
                    ),
                  )}
                </div>
              </div>

              <div className="settings49-savebar max-sm:!mt-4 max-sm:!items-center max-sm:!gap-2 max-sm:!p-2.5">
                <div>
                  {pending ===
                  "save" ? (
                    <span className="settings49-unsaved">
                      <WkIcon
                        name="Loader2"
                        size={13}
                        className="animate-spin"
                      />
                      Saving
                    </span>
                  ) : isMetadataDirty ? (
                    <span className="settings49-unsaved">
                      <WkIcon
                        name="Pencil"
                        size={13}
                      />
                      Unsaved changes
                    </span>
                  ) : (
                    <span className="settings49-saved">
                      <WkIcon
                        name="Check"
                        size={13}
                      />
                      Up to date
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={
                      cancelEditing
                    }
                    disabled={
                      pending !==
                      null
                    }
                    className="wk-button wk-button-sm wk-button-ghost"
                  >
                    Discard
                  </button>

                  <button
                    type="submit"
                    disabled={
                      pending !==
                        null ||
                      !isMetadataDirty ||
                      !title.trim()
                    }
                    className="wk-button wk-button-sm wk-button-primary"
                  >
                    Save changes
                  </button>
                </div>
              </div>

              <div className="settings49-danger mt-6 max-sm:!mt-4 max-sm:!p-3">
                <div className="settings49-danger-title max-sm:!mb-1">
                  Archive Playlist
                </div>
                <p className="settings49-danger-copy max-sm:!mb-2 max-sm:!text-[11px] max-sm:!leading-4">
                  Remove this Playlist from public view while preserving its history.
                </p>
                <button
                  type="button"
                  disabled={
                    pending !==
                    null
                  }
                  onClick={() => {
                    void archive();
                  }}
                  className="wk-button wk-button-sm wk-button-ghost"
                >
                  <WkIcon
                    name="Archive"
                    size={14}
                  />
                  Archive Playlist
                </button>
              </div>
            </form>
          ) : null}

          {playlist.tracks.length ===
          0 ? (
            <section className="rounded-2xl border border-dashed border-[var(--wk-border)] py-12 text-center">
              <p className="text-sm font-black text-[var(--wk-text)]">
                This Playlist is empty.
              </p>

              {isOwner &&
              !archived ? (
                <Link
                  to="/music"
                  className="mt-3 inline-flex text-xs font-black text-[var(--wk-brand)] hover:underline"
                >
                  Find Tracks
                </Link>
              ) : null}
            </section>
          ) : (
            <ol className="overflow-hidden rounded-2xl border border-[var(--wk-border)] bg-[var(--wk-surface)]">
              {playlist.tracks.map(
                (
                  track,
                  index,
                ) => {
                  const playerTrack =
                    queue[
                      index
                    ];

                  const current =
                    player.currentTrack?.id ===
                    playerTrack?.id;

                  const playable =
                    Boolean(
                      playerTrack?.isPlayable,
                    );

                  return (
                    <li
                      key={
                        track.playlistItemId
                      }
                      className="flex items-center gap-3 border-b border-[var(--wk-divider)] px-3 py-3 last:border-b-0 md:px-4"
                    >
                      <button
                        type="button"
                        disabled={
                          !playable
                        }
                        onClick={() => {
                          if (
                            !playerTrack
                          ) {
                            return;
                          }

                          if (
                            current
                          ) {
                            player.togglePlay();
                          } else {
                            player.playTrack(
                              playerTrack,
                              queue,
                              {
                                pageType:
                                  "personal_playlist",
                                entitySlug:
                                  playlist.slug,
                                entityType:
                                  "playlist",
                                sourceSection:
                                  "track_list",
                              },
                            );
                          }
                        }}
                        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[var(--wk-text)] hover:bg-[var(--wk-surface-raised)] disabled:text-[var(--wk-text-faint)]"
                        aria-label={
                          playable
                            ? `Play ${track.title}`
                            : `${track.title} has no preview`
                        }
                      >
                        <WkIcon
                          name={
                            current &&
                            player.isPlaying
                              ? "Pause"
                              : "Play"
                          }
                          size={15}
                          fill={
                            current &&
                            player.isPlaying
                              ? "currentColor"
                              : "none"
                          }
                        />
                      </button>

                      <div className="h-10 w-10 shrink-0 overflow-hidden rounded-lg bg-[var(--wk-surface-raised)]">
                        {track.artworkUrl ? (
                          <img
                            src={
                              track.artworkUrl
                            }
                            alt=""
                            className="h-full w-full object-cover"
                          />
                        ) : null}
                      </div>

                      <div className="min-w-0 flex-1">
                        {track.trackPath ? (
                          <Link
                            to={
                              track.trackPath
                            }
                            className="block truncate text-[13px] font-black text-[var(--wk-text)] hover:text-[var(--wk-brand)]"
                          >
                            {
                              track.title
                            }
                          </Link>
                        ) : (
                          <div className="truncate text-[13px] font-black text-[var(--wk-text)]">
                            {
                              track.title
                            }
                          </div>
                        )}

                        <div className="mt-1 truncate text-[10px] font-bold text-[var(--wk-text-muted)]">
                          {
                            artistLabel(
                              track.artistNames,
                            )
                          }
                          {durationLabel(
                            track.durationMs,
                          )
                            ? ` · ${durationLabel(track.durationMs)}`
                            : ""}
                        </div>
                      </div>

                      {isOwner &&
                      !archived ? (
                        <div className="flex shrink-0 items-center gap-1">
                          <button
                            type="button"
                            disabled={
                              index ===
                                0 ||
                              pending !==
                                null
                            }
                            onClick={() => {
                              void moveTrack(
                                index,
                                -1,
                              );
                            }}
                            className="flex h-8 w-8 items-center justify-center rounded-lg text-[var(--wk-text-muted)] hover:bg-[var(--wk-surface-raised)] disabled:opacity-25"
                            aria-label={`Move ${track.title} up`}
                          >
                            <WkIcon
                              name="ArrowUp"
                              size={14}
                            />
                          </button>

                          <button
                            type="button"
                            disabled={
                              index ===
                                playlist.tracks.length -
                                  1 ||
                              pending !==
                                null
                            }
                            onClick={() => {
                              void moveTrack(
                                index,
                                1,
                              );
                            }}
                            className="flex h-8 w-8 items-center justify-center rounded-lg text-[var(--wk-text-muted)] hover:bg-[var(--wk-surface-raised)] disabled:opacity-25"
                            aria-label={`Move ${track.title} down`}
                          >
                            <WkIcon
                              name="ArrowDown"
                              size={14}
                            />
                          </button>

                          <button
                            type="button"
                            disabled={
                              pending !==
                              null
                            }
                            onClick={() => {
                              void removeTrack(
                                track.playlistItemId,
                              );
                            }}
                            className="flex h-8 w-8 items-center justify-center rounded-lg text-[var(--wk-text-muted)] hover:bg-[var(--wk-danger-soft)] hover:text-red-500 disabled:opacity-40"
                            aria-label={`Remove ${track.title}`}
                          >
                            <WkIcon
                              name={
                                pending ===
                                `remove:${track.playlistItemId}`
                                  ? "Loader2"
                                  : "Trash2"
                              }
                              size={14}
                              className={
                                pending ===
                                `remove:${track.playlistItemId}`
                                  ? "animate-spin"
                                  : ""
                              }
                            />
                          </button>
                        </div>
                      ) : (
                        <div className="hidden shrink-0 sm:block">
                          <AddToPlaylistButton
                            trackId={
                              track.registryTrackId
                            }
                            trackTitle={
                              track.title
                            }
                            compact
                          />
                        </div>
                      )}
                    </li>
                  );
                },
              )}
            </ol>
          )}

        </div>
      </main>
    </>
  );
}
