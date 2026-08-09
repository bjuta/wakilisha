import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  Link,
  useParams,
} from "react-router-dom";
import {
  WkIcon,
} from "@/components/design-system/Icon";
import {
  WkButton,
} from "@/components/design-system/primitives/Button";
import {
  ShareButton,
} from "@/components/design-system/share/ShareSheet";
import {
  Ch19GradientImage,
} from "@/components/media/Ch19GradientImage";
import {
  MetaTags,
} from "@/components/seo/MetaTags";
import {
  SchemaOrg,
} from "@/components/seo/SchemaOrg";
import {
  AnchorNavigator,
} from "@/components/design-system/navigation/AnchorNavigator";
import {
  ContextAnchorCommentDrawer,
  type ContextAnchorTarget,
} from "@/components/feature/community/ContextAnchorCommentDrawer";
import {
  CommunitySection,
} from "@/pages/magazine/article/components/CommunitySection";
import {
  useAuthUser,
} from "@/hooks/useAuthUser";
import {
  usePlayer,
  type PlayerTrack,
} from "@/context/PlayerContext";
import {
  getPublicPlaylist,
} from "@/services/playlists/playlistPublicService";
import {
  toPlayerQueue,
  type PublicPlaylist,
  type PublicPlaylistTrack,
} from "@/services/playlists/playlistPublicModel";

function formatDuration(
  milliseconds: number | null,
): string {
  if (
    milliseconds === null ||
    milliseconds <= 0
  ) {
    return "";
  }

  const seconds =
    Math.round(
      milliseconds / 1000,
    );

  const minutes =
    Math.floor(
      seconds / 60,
    );

  return `${minutes}:${String(
    seconds % 60,
  ).padStart(
    2,
    "0",
  )}`;
}

function trackArtistLabel(
  track: PublicPlaylistTrack,
): string {
  if (
    track.artistNames.length > 0
  ) {
    return track.artistNames.join(
      ", ",
    );
  }

  return (
    track.registry
      ?.primaryArtistName ??
    "Unknown artist"
  );
}

function playlistSummary(
  description: string | null,
): string | null {
  const value =
    description?.trim();

  if (!value) {
    return null;
  }

  const sentence =
    value.match(
      /^.*?[.!?](?:\s|$)/,
    )?.[0]?.trim() ??
    value;

  if (
    sentence.length <= 180
  ) {
    return sentence;
  }

  const shortened =
    sentence
      .slice(
        0,
        177,
      )
      .trimEnd();

  const boundary =
    shortened.lastIndexOf(
      " ",
    );

  return `${
    boundary > 120
      ? shortened.slice(
          0,
          boundary,
        )
      : shortened
  }...`;
}

function schemaDuration(
  milliseconds: number | null,
): string | undefined {
  if (
    milliseconds === null ||
    milliseconds <= 0
  ) {
    return undefined;
  }

  const seconds =
    Math.round(
      milliseconds / 1000,
    );

  const minutes =
    Math.floor(
      seconds / 60,
    );

  const remainder =
    seconds % 60;

  return `PT${minutes}M${remainder}S`;
}

function trackAnchorId(
  track: PublicPlaylistTrack,
): string {
  return `track-${track.playlistItemResourceId}`;
}

function PlaylistCover({
  playlist,
}: {
  playlist: PublicPlaylist;
}) {
  if (
    playlist.cover?.url
  ) {
    return (
      <img
        src={
          playlist.cover.url
        }
        alt={
          playlist.cover.altText ??
          playlist.title
        }
        className="h-full w-full object-cover"
      />
    );
  }

  return (
    <Ch19GradientImage
      slug={
        playlist.slug
      }
      name={
        playlist.title
      }
    />
  );
}

function PlaylistTrackRow({
  playlist,
  track,
  playerTrack,
  currentTrackId,
  isPlaying,
  expanded,
  onPlay,
  onToggle,
  onDiscuss,
  shareUrl,
}: {
  playlist: PublicPlaylist;
  track: PublicPlaylistTrack;
  playerTrack: PlayerTrack | undefined;
  currentTrackId: string | undefined;
  isPlaying: boolean;
  expanded: boolean;
  onPlay: () => void;
  onToggle: () => void;
  onDiscuss: () => void;
  shareUrl: string;
}) {
  const playable =
    Boolean(
      playerTrack &&
      playerTrack.isPlayable !== false,
    );

  const isCurrent =
    Boolean(
      playerTrack &&
      currentTrackId ===
        playerTrack.id,
    );

  const isThisPlaying =
    isCurrent &&
    isPlaying;

  const duration =
    formatDuration(
      track.durationMs,
    );

  const artist =
    trackArtistLabel(
      track,
    );

  const trackPath =
    track.registry
      ?.trackPath;

  const releasePath =
    track.registry
      ?.releasePath;

  const hasMoreInfo =
    Boolean(
      track.notes ||
      trackPath ||
      releasePath ||
      track.releaseTitle,
    );

  return (
    <article
      id={
        trackAnchorId(
          track,
        )
      }
      className={[
        "scroll-mt-36 border-b border-[var(--wk-divider)] last:border-b-0",
        isCurrent
          ? "bg-[var(--wk-brand-soft)]/25"
          : "",
      ].join(
        " ",
      )}
    >
      <div className="group flex items-center gap-3 px-3 py-3.5 transition-colors hover:bg-[var(--wk-surface-raised)] sm:px-4">
        <div className="w-8 shrink-0 text-center text-[12px] font-extrabold tabular-nums text-[var(--wk-text-faint)]">
          {String(
            track.position,
          ).padStart(
            2,
            "0",
          )}
        </div>

        <div className="h-12 w-12 shrink-0 overflow-hidden rounded-lg bg-[var(--wk-surface-raised)]">
          {
            track.artworkUrl
              ? (
                  <img
                    src={
                      track.artworkUrl
                    }
                    alt=""
                    loading="lazy"
                    className="h-full w-full object-cover"
                  />
                )
              : (
                  <Ch19GradientImage
                    slug={
                      track.registry
                        ?.trackSlug ??
                      track.playlistItemResourceId
                    }
                    name={
                      track.title
                    }
                  />
                )
          }
        </div>

        <div className="min-w-0 flex-1">
          {
            trackPath
              ? (
                  <Link
                    to={
                      trackPath
                    }
                    className="block truncate text-[14px] font-extrabold text-[var(--wk-text)] transition-colors hover:text-[var(--wk-brand)]"
                  >
                    {
                      track.title
                    }
                  </Link>
                )
              : (
                  <div className="truncate text-[14px] font-extrabold text-[var(--wk-text)]">
                    {
                      track.title
                    }
                  </div>
                )
          }

          <div className="mt-0.5 truncate text-[11px] font-semibold text-[var(--wk-text-muted)]">
            {
              artist
            }
          </div>
        </div>

        {
          duration
            ? (
                <div className="hidden shrink-0 text-[12px] font-bold tabular-nums text-[var(--wk-text-faint)] sm:block">
                  {
                    duration
                  }
                </div>
              )
            : null
        }

        <button
          type="button"
          disabled={
            !playable
          }
          onClick={
            onPlay
          }
          aria-label={
            isThisPlaying
              ? `Pause ${track.title}`
              : `Play ${track.title}`
          }
          className={[
            "flex h-9 w-9 shrink-0 items-center justify-center rounded-full transition-colors",
            isCurrent
              ? "bg-[var(--wk-brand)] text-[var(--wk-brand-on)]"
              : "border border-[var(--wk-border)] bg-[var(--wk-bg)] text-[var(--wk-text)] hover:border-[var(--wk-brand)]/40 hover:text-[var(--wk-brand)]",
            !playable
              ? "cursor-not-allowed opacity-35"
              : "cursor-pointer",
          ].join(
            " ",
          )}
        >
          <WkIcon
            name={
              isThisPlaying
                ? "Pause"
                : "Play"
            }
            size={
              14
            }
          />
        </button>

        <button
          type="button"
          onClick={
            onToggle
          }
          aria-expanded={
            expanded
          }
          aria-controls={
            `track-more-${track.playlistItemResourceId}`
          }
          aria-label={
            expanded
              ? `Close more about ${track.title}`
              : `More about ${track.title}`
          }
          className={[
            "flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-[var(--wk-border)] bg-[var(--wk-bg)] text-[var(--wk-text-muted)] transition-all hover:border-[var(--wk-brand)]/35 hover:text-[var(--wk-text)]",
            expanded
              ? "rotate-90"
              : "",
          ].join(
            " ",
          )}
        >
          <WkIcon
            name="ChevronRight"
            size={
              15
            }
          />
        </button>
      </div>

      <div
        style={{
          display:
            "grid",
          gridTemplateRows:
            expanded
              ? "1fr"
              : "0fr",
          transition:
            "grid-template-rows 220ms ease",
        }}
      >
        <div className="overflow-hidden">
          <div
            id={
              `track-more-${track.playlistItemResourceId}`
            }
            className="border-t border-[var(--wk-divider)] bg-[var(--wk-bg-subtle)] px-4 py-5 sm:px-6 md:py-6"
          >
            <div className="mx-auto max-w-3xl">
              {
                track.notes
                  ? (
                      <p className="max-w-[70ch] text-[15px] leading-7 text-[var(--wk-text-soft)] md:text-[16px]">
                        {
                          track.notes
                        }
                      </p>
                    )
                  : null
              }

              {
                hasMoreInfo
                  ? (
                      <div className="mt-5 flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-[var(--wk-border)] pt-4 text-[12px] font-semibold text-[var(--wk-text-muted)]">
                        <span>
                          {
                            artist
                          }
                        </span>

                        {
                          track.releaseTitle
                            ? (
                                <span>
                                  {
                                    track.releaseTitle
                                  }
                                </span>
                              )
                            : null
                        }

                        {
                          trackPath
                            ? (
                                <Link
                                  to={
                                    trackPath
                                  }
                                  className="inline-flex items-center gap-1.5 font-bold text-[var(--wk-brand)] hover:underline"
                                >
                                  Track page
                                  <WkIcon
                                    name="ArrowUpRight"
                                    size={
                                      12
                                    }
                                  />
                                </Link>
                              )
                            : null
                        }

                        {
                          releasePath
                            ? (
                                <Link
                                  to={
                                    releasePath
                                  }
                                  className="inline-flex items-center gap-1.5 font-bold text-[var(--wk-brand)] hover:underline"
                                >
                                  Release
                                  <WkIcon
                                    name="ArrowUpRight"
                                    size={
                                      12
                                    }
                                  />
                                </Link>
                              )
                            : null
                        }
                      </div>
                    )
                  : null
              }

              <div className="mt-5 flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={
                    onDiscuss
                  }
                  className="wk-button wk-button-soft"
                >
                  <WkIcon
                    name="MessageCircle"
                    size={
                      14
                    }
                  />
                  Discuss this track
                </button>

                <ShareButton
                  item={{
                    title:
                      `${track.title} by ${artist}`,
                    subtitle:
                      `Track ${track.position} · ${playlist.title}`,
                    description:
                      track.notes ??
                      undefined,
                    imageUrl:
                      track.artworkUrl ??
                      playlist.cover?.url ??
                      undefined,
                    url:
                      shareUrl,
                    type:
                      "track",
                  }}
                  size="label"
                  variant="light"
                  label="Share"
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </article>
  );
}

export default function PublicPlaylistDetailPage() {
  const {
    slug = "",
  } =
    useParams<{
      slug: string;
    }>();

  const user =
    useAuthUser();

  const [
    playlist,
    setPlaylist,
  ] =
    useState<PublicPlaylist | null>(
      null,
    );

  const [
    loading,
    setLoading,
  ] =
    useState(
      true,
    );

  const [
    error,
    setError,
  ] =
    useState<string | null>(
      null,
    );

  const [
    expandedTrackId,
    setExpandedTrackId,
  ] =
    useState<string | null>(
      null,
    );

  const [
    selectedAnchor,
    setSelectedAnchor,
  ] =
    useState<ContextAnchorTarget | null>(
      null,
    );

  const {
    currentTrack,
    isPlaying,
    queue: activeQueue,
    playTrack,
    togglePlay,
  } =
    usePlayer();

  const load =
    useCallback(
      async () => {
        setLoading(
          true,
        );

        setError(
          null,
        );

        try {
          const result =
            await getPublicPlaylist(
              slug,
            );

          setPlaylist(
            result,
          );
        } catch {
          setError(
            "Could not load this Playlist.",
          );

          setPlaylist(
            null,
          );
        } finally {
          setLoading(
            false,
          );
        }
      },
      [
        slug,
      ],
    );

  useEffect(
    () => {
      void load();
    },
    [
      load,
    ],
  );

  const queue =
    useMemo(
      () =>
        playlist
          ? toPlayerQueue(
              playlist,
            )
          : [],
      [
        playlist,
      ],
    );

  const firstPlayableIndex =
    useMemo(
      () =>
        queue.findIndex(
          (
            track,
          ) =>
            track.isPlayable !==
            false,
        ),
      [
        queue,
      ],
    );

  const isThisPlaylistQueue =
    useMemo(
      () =>
        queue.length > 0 &&
        activeQueue.length ===
          queue.length &&
        queue.every(
          (
            track,
            index,
          ) =>
            activeQueue[
              index
            ]?.id ===
            track.id,
        ),
      [
        activeQueue,
        queue,
      ],
    );

  const playSource =
    playlist
      ? {
          pageType:
            "playlist",
          entitySlug:
            playlist.slug,
          entityType:
            "playlist",
        }
      : undefined;

  const handleHeroPlay =
    () => {
      if (
        !playlist ||
        firstPlayableIndex < 0
      ) {
        return;
      }

      if (
        isThisPlaylistQueue &&
        currentTrack
      ) {
        togglePlay();
        return;
      }

      playTrack(
        queue[
          firstPlayableIndex
        ],
        queue,
        {
          ...playSource,
          sourceSection:
            "playlist_hero",
        },
      );
    };

  const handleTrackPlay =
    (
      index: number,
    ) => {
      if (
        !playlist
      ) {
        return;
      }

      const track =
        queue[
          index
        ];

      if (
        !track ||
        track.isPlayable ===
          false
      ) {
        return;
      }

      if (
        currentTrack?.id ===
        track.id
      ) {
        togglePlay();
        return;
      }

      playTrack(
        track,
        queue,
        {
          ...playSource,
          sourceSection:
            "playlist_tracklist",
        },
      );
    };

  const jumpToTrack =
    useCallback(
      (
        anchorId: string,
      ) => {
        const element =
          document.getElementById(
            anchorId,
          );

        if (
          !element
        ) {
          return;
        }

        const url =
          `${window.location.pathname}${window.location.search}#${anchorId}`;

        window.history.replaceState(
          null,
          "",
          url,
        );

        element.scrollIntoView({
          behavior:
            "smooth",
          block:
            "start",
        });
      },
      [],
    );

  useEffect(
    () => {
      if (
        !playlist ||
        typeof window ===
          "undefined"
      ) {
        return;
      }

      const anchorId =
        decodeURIComponent(
          window.location.hash.replace(
            /^#/,
            "",
          ),
        );

      if (
        !anchorId.startsWith(
          "track-",
        )
      ) {
        return;
      }

      const timer =
        window.setTimeout(
          () => {
            document
              .getElementById(
                anchorId,
              )
              ?.scrollIntoView({
                block:
                  "start",
              });
          },
          50,
        );

      return () =>
        window.clearTimeout(
          timer,
        );
    },
    [
      playlist,
    ],
  );

  if (
    loading
  ) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-[var(--wk-bg)]">
        <div className="text-center">
          <WkIcon
            name="ListMusic"
            size={
              46
            }
            className="mx-auto mb-4 animate-pulse text-[var(--wk-text-faint)]"
          />

          <p className="text-[15px] font-semibold text-[var(--wk-text-muted)]">
            Opening Playlist...
          </p>
        </div>
      </main>
    );
  }

  if (
    error
  ) {
    return (
      <main className="min-h-screen bg-[var(--wk-bg)]">
        <div className="wk-container px-5 py-20 md:px-6">
          <div className="mx-auto max-w-md text-center">
            <WkIcon
              name="ListMusic"
              size={
                42
              }
              className="mx-auto mb-4 text-[var(--wk-text-faint)]"
            />

            <h1 className="wk-h-section">
              Could not load Playlist
            </h1>

            <p className="wk-copy mt-3">
              {
                error
              }
            </p>

            <WkButton
              onClick={
                () => {
                  void load();
                }
              }
              className="mt-6"
            >
              Try again
            </WkButton>
          </div>
        </div>
      </main>
    );
  }

  if (
    !playlist
  ) {
    return (
      <main className="min-h-screen bg-[var(--wk-bg)]">
        <div className="wk-container px-5 py-20 md:px-6">
          <div className="mx-auto max-w-md text-center">
            <WkIcon
              name="ListMusic"
              size={
                42
              }
              className="mx-auto mb-4 text-[var(--wk-text-faint)]"
            />

            <h1 className="wk-h-section">
              Playlist not found
            </h1>

            <p className="wk-copy mt-3">
              We could not find a Playlist at this address.
            </p>

            <Link
              to="/playlists"
              className="wk-button wk-button-soft mt-6"
            >
              Browse Playlists
            </Link>
          </div>
        </div>
      </main>
    );
  }

  const canonicalUrl =
    `https://wakilisha.africa/playlists/${playlist.slug}`;

  const shareBaseUrl =
    canonicalUrl;

  const description =
    playlist.description ??
    `${playlist.title}, curated by ${playlist.curatorLabel ?? "WAKILISHA"}.`;

  const summary =
    playlistSummary(
      playlist.description,
    );

  const heroButtonLabel =
    isThisPlaylistQueue
      ? (
          isPlaying
            ? "Pause"
            : "Resume"
        )
      : "Play Playlist";

  const communityEntity = {
    type:
      "playlist" as const,
    id:
      playlist.resourceId,
    slug:
      playlist.slug,
    url:
      canonicalUrl,
    title:
      playlist.title,
    subtitle:
      playlist.curatorLabel ??
      "WAKILISHA",
    description:
      playlist.description ??
      undefined,
    imageUrl:
      playlist.cover?.url ??
      null,
  };

  const openTrackDiscussion =
    (
      track: PublicPlaylistTrack,
    ) => {
      const artist =
        trackArtistLabel(
          track,
        );

      setSelectedAnchor({
        anchorType:
          "playlist_track",
        contextEntityType:
          "playlist_item",
        contextEntityId:
          track.playlistItemResourceId,
        contextEntitySlug:
          track.registry
            ?.trackSlug ??
          null,
        contextLabel:
          `#${track.position} · ${track.title}`,
        anchorLabel:
          `Track ${track.position}`,
        title:
          track.title,
        subtitle:
          `${artist} · ${playlist.title}`,
        imageUrl:
          track.artworkUrl,
        placeholder:
          `Talk about ${track.title} in this Playlist...`,
      });
    };

  return (
    <>
      <MetaTags
        title={
          playlist.title
        }
        description={
          description
        }
        imageUrl={
          playlist.cover?.url ??
          undefined
        }
        url={
          canonicalUrl
        }
        type="music.playlist"
      />

      <SchemaOrg
        data={{
          "@type":
            "MusicPlaylist",
          name:
            playlist.title,
          description:
            playlist.description ??
            undefined,
          image:
            playlist.cover?.url ??
            undefined,
          numTracks:
            playlist.itemCount,
          url:
            canonicalUrl,
          creator: {
            "@type":
              "Organization",
            name:
              playlist.curatorLabel ??
              "WAKILISHA",
            url:
              "https://wakilisha.africa",
          },
          track:
            playlist.tracks.map(
              (
                track,
              ) => ({
                "@type":
                  "MusicRecording" as const,
                name:
                  track.title,
                position:
                  track.position,
                duration:
                  schemaDuration(
                    track.durationMs,
                  ),
                url:
                  `${canonicalUrl}#${trackAnchorId(
                    track,
                  )}`,
                byArtist: {
                  "@type":
                    "MusicGroup" as const,
                  name:
                    trackArtistLabel(
                      track,
                    ),
                  url:
                    track.registry
                      ?.primaryArtistSlug
                      ? `https://wakilisha.africa/artists/${track.registry.primaryArtistSlug}`
                      : undefined,
                },
              }),
            ),
        }}
      />

      <main className="min-h-screen bg-[var(--wk-bg)] pb-28">
        <section className="relative -mt-16 min-h-[470px] overflow-hidden pt-16 md:min-h-[520px]">
          {
            playlist.cover?.url
              ? (
                  <div
                    className="absolute inset-0 scale-110"
                    style={{
                      backgroundImage:
                        `url("${playlist.cover.url}")`,
                      backgroundSize:
                        "cover",
                      backgroundPosition:
                        "center",
                      filter:
                        "blur(26px) saturate(1.15)",
                    }}
                  />
                )
              : (
                  <div className="absolute inset-0 bg-[radial-gradient(circle_at_18%_72%,rgba(92,142,37,0.42),transparent_34%),radial-gradient(circle_at_78%_18%,rgba(12,13,10,0.75),transparent_42%)]" />
                )
          }

          <div className="absolute inset-0 bg-gradient-to-t from-black/95 via-black/75 to-black/45" />

          <div className="relative z-10 flex min-h-[410px] items-end md:min-h-[460px]">
            <div className="wk-container-wide w-full px-5 pb-10 pt-14 md:px-6 md:pb-14">
              <div className="grid items-end gap-6 md:grid-cols-[170px_minmax(0,1fr)] md:gap-8">
                <div className="aspect-square w-[132px] overflow-hidden rounded-2xl border border-white/15 bg-black/20 shadow-2xl md:w-[170px]">
                  <PlaylistCover
                    playlist={
                      playlist
                    }
                  />
                </div>

                <div className="min-w-0">
                  <div className="mb-3 flex items-center gap-2 text-[10px] font-extrabold uppercase tracking-[0.22em] text-[#b9ee78]">
                    <WkIcon
                      name="ListMusic"
                      size={
                        12
                      }
                    />
                    Playlist
                  </div>

                  <h1
                    className="max-w-[860px] font-[var(--wk-font-display)] font-black leading-[0.94] tracking-[-0.05em] text-white"
                    style={{
                      fontSize:
                        "clamp(36px, 5vw, 68px)",
                    }}
                  >
                    {
                      playlist.title
                    }
                  </h1>

                  <div className="mt-3 text-[13px] font-bold text-white/75 md:text-[15px]">
                    Curated by{" "}
                    <span className="text-white">
                      {
                        playlist.curatorLabel ??
                        "WAKILISHA"
                      }
                    </span>
                    <span className="mx-2 text-white/40">
                      ·
                    </span>
                    {
                      playlist.itemCount
                    } tracks
                  </div>

                  {
                    summary
                      ? (
                          <p className="mt-4 max-w-2xl text-[14px] leading-6 text-white/80 md:text-[15px]">
                            {
                              summary
                            }
                          </p>
                        )
                      : null
                  }

                  <div className="mt-6 flex flex-wrap items-center gap-3">
                    <WkButton
                      onClick={
                        handleHeroPlay
                      }
                      disabled={
                        firstPlayableIndex < 0
                      }
                    >
                      <WkIcon
                        name={
                          isThisPlaylistQueue &&
                          isPlaying
                            ? "Pause"
                            : "Play"
                        }
                        size={
                          16
                        }
                      />
                      {
                        heroButtonLabel
                      }
                    </WkButton>

                    <div
                      className="[--wk-text:#ffffff] [--wk-border-2:rgba(255,255,255,0.34)] [&_.wk-button]:bg-white/10 [&_.wk-button:hover]:bg-white/15"
                    >
                      <ShareButton
                        item={{
                          title:
                            playlist.title,
                          subtitle:
                            playlist.curatorLabel ??
                            "WAKILISHA",
                          description,
                          imageUrl:
                            playlist.cover?.url ??
                            undefined,
                          url:
                            shareBaseUrl,
                          type:
                            "playlist",
                        }}
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {
          playlist.description
            ? (
                <div className="wk-container-wide px-5 pt-8 md:px-6 md:pt-10">
                  <details className="mx-auto max-w-5xl rounded-2xl border border-[var(--wk-border)] bg-[var(--wk-surface)] group">
                    <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-5 py-4 text-[13px] font-extrabold text-[var(--wk-text)] marker:hidden md:px-6">
                      <span>
                        About this Playlist
                      </span>

                      <span className="text-[11px] font-bold text-[var(--wk-text-muted)]">
                        <span className="group-open:hidden">
                          Read more
                        </span>
                        <span className="hidden group-open:inline">
                          Read less
                        </span>
                      </span>
                    </summary>

                    <div className="border-t border-[var(--wk-border)] px-5 py-5 md:px-6">
                      <p className="max-w-[72ch] text-[15px] leading-7 text-[var(--wk-text-soft)]">
                        {
                          playlist.description
                        }
                      </p>
                    </div>
                  </details>
                </div>
              )
            : null
        }

        <div className="sticky top-0 z-30 mt-8 border-y border-[var(--wk-border)] bg-[var(--wk-bg)]/95 backdrop-blur md:top-16">
          <div className="wk-container-wide flex justify-end px-5 py-3 md:px-6">
            <AnchorNavigator
              label="Jump to track"
              items={
                playlist.tracks.map(
                  (
                    track,
                  ) => ({
                    id:
                      trackAnchorId(
                        track,
                      ),
                    prefix:
                      String(
                        track.position,
                      ).padStart(
                        2,
                        "0",
                      ),
                    label:
                      track.title,
                    meta:
                      trackArtistLabel(
                        track,
                      ),
                    searchText:
                      [
                        track.position,
                        track.title,
                        trackArtistLabel(
                          track,
                        ),
                      ].join(
                        " ",
                      ),
                  }),
                )
              }
              onNavigate={
                jumpToTrack
              }
            />
          </div>
        </div>

        <div className="wk-container-wide px-5 py-8 md:px-6 md:py-10">
          <section className="mx-auto max-w-5xl">
            <div className="overflow-hidden rounded-2xl border border-[var(--wk-border)] bg-[var(--wk-surface)]">
              {
                playlist.tracks.map(
                  (
                    track,
                    index,
                  ) => (
                    <PlaylistTrackRow
                      key={
                        track.playlistItemResourceId
                      }
                      playlist={
                        playlist
                      }
                      track={
                        track
                      }
                      playerTrack={
                        queue[
                          index
                        ]
                      }
                      currentTrackId={
                        currentTrack?.id
                      }
                      isPlaying={
                        isPlaying
                      }
                      expanded={
                        expandedTrackId ===
                        track.playlistItemResourceId
                      }
                      onPlay={
                        () =>
                          handleTrackPlay(
                            index,
                          )
                      }
                      onToggle={
                        () =>
                          setExpandedTrackId(
                            (
                              current,
                            ) =>
                              current ===
                              track.playlistItemResourceId
                                ? null
                                : track.playlistItemResourceId,
                          )
                      }
                      onDiscuss={
                        () =>
                          openTrackDiscussion(
                            track,
                          )
                      }
                      shareUrl={
                        `${shareBaseUrl}#${trackAnchorId(
                          track,
                        )}`
                      }
                    />
                  ),
                )
              }
            </div>
          </section>
        </div>

        <CommunitySection
          entity={
            communityEntity
          }
          user={
            user
          }
        />

        <ContextAnchorCommentDrawer
          open={
            Boolean(
              selectedAnchor,
            )
          }
          onClose={
            () =>
              setSelectedAnchor(
                null,
              )
          }
          entity={
            communityEntity
          }
          target={
            selectedAnchor
          }
        />
      </main>
    </>
  );
}
