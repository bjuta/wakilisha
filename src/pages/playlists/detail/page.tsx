import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  Link,
  useParams,
  useSearchParams,
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
  PlaylistCoverPresentation,
} from "@/components/media/PlaylistCoverPresentation";
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
  MusicArtistDiscovery,
  type MusicArtistDiscoveryArtist,
} from "@/components/design-system/music/MusicArtistDiscovery";
import {
  PublicTrustSummary,
} from "@/components/design-system/trust/PublicTrustSummary";
import {
  ContextAnchorCommentDrawer,
  type ContextAnchorTarget,
} from "@/components/feature/community/ContextAnchorCommentDrawer";
import {
  ContributionSheet,
} from "@/components/feature/community/ContributionSheet";
import {
  CommunitySection,
} from "@/pages/magazine/article/components/CommunitySection";
import {
  useAuthUser,
} from "@/hooks/useAuthUser";
import {
  useEntityActions,
} from "@/hooks/useCommunityActions";
import {
  usePlayer,
  type PlayerTrack,
} from "@/context/PlayerContext";
import {
  getPublicPlaylist,
  getPublicPlaylistPreview,
} from "@/services/playlists/playlistPublicService";
import {
  getUserFollows,
  getUserSaves,
} from "@/services/community";
import {
  buildCommunityAuthUrl,
} from "@/services/community/authIntent";
import {
  buildVerifyEmailUrl,
} from "@/services/auth/accountVerification";
import {
  publicPlaylistTrackArtistLabel,
  toPlayerQueue,
  type PublicPlaylist,
  type PublicPlaylistCitation,
  type PublicPlaylistCredit,
  type PublicPlaylistTrack,
} from "@/services/playlists/playlistPublicModel";
import {
  PlaylistPreviewModeBanner,
} from "./components/PlaylistPreviewModeBanner";

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

function humanizeTrustToken(
  value: string,
): string {
  const normalized =
    value
      .trim()
      .replace(
        /[_-]+/g,
        " ",
      );

  if (!normalized) {
    return "";
  }

  return normalized
    .split(
      /\s+/,
    )
    .map(
      (
        word,
      ) =>
        word.charAt(
          0,
        ).toUpperCase() +
        word.slice(
          1,
        ),
    )
    .join(
      " ",
    );
}

function locatorScalar(
  value: unknown,
): string | null {
  if (
    typeof value ===
      "string" &&
    value.trim()
  ) {
    return value.trim();
  }

  if (
    typeof value ===
      "number" &&
    Number.isFinite(
      value,
    )
  ) {
    return String(
      value,
    );
  }

  return null;
}

function citationLocatorLabel(
  citation: PublicPlaylistCitation,
): string | null {
  const locator =
    citation.locator;

  const startPage =
    locatorScalar(
      locator.start_page,
    );

  const endPage =
    locatorScalar(
      locator.end_page,
    );

  if (
    startPage &&
    endPage
  ) {
    return `Pages ${startPage} to ${endPage}`;
  }

  const page =
    locatorScalar(
      locator.page,
    );

  if (page) {
    return `Page ${page}`;
  }

  const paragraph =
    locatorScalar(
      locator.paragraph,
    );

  if (paragraph) {
    return `Paragraph ${paragraph}`;
  }

  const chapter =
    locatorScalar(
      locator.chapter,
    );

  if (chapter) {
    return `Chapter ${chapter}`;
  }

  const section =
    locatorScalar(
      locator.section_heading,
    );

  if (section) {
    return section;
  }

  const milliseconds =
    typeof locator.milliseconds ===
      "number"
      ? locator.milliseconds
      : null;

  if (
    milliseconds !==
      null &&
    Number.isFinite(
      milliseconds,
    )
  ) {
    return `Timestamp ${formatDuration(
      milliseconds,
    )}`;
  }

  if (
    citation.locatorType ===
      "whole_source" ||
    !citation.locatorType
  ) {
    return null;
  }

  return humanizeTrustToken(
    citation.locatorType,
  );
}

function playlistTrustContextLabel(
  playlist: PublicPlaylist,
  resourceId: string,
): string | null {
  if (
    resourceId ===
    playlist.resourceId
  ) {
    return "Playlist";
  }

  const track =
    playlist.tracks.find(
      (
        item,
      ) =>
        item.playlistItemResourceId ===
        resourceId,
    );

  if (!track) {
    return null;
  }

  return `Track ${String(
    track.position,
  ).padStart(
    2,
    "0",
  )} · ${track.title}`;
}

function playlistCreditHref(
  credit: PublicPlaylistCredit,
): string | null {
  const authorSlug =
    credit.authorSlug
      ?.trim();

  if (authorSlug) {
    return `/people/${authorSlug}`;
  }

  const username =
    credit.username
      ?.trim();

  return username
    ? `/u/${username}`
    : null;
}

function playlistCuratorCredit(
  playlist: PublicPlaylist,
): PublicPlaylistCredit | null {
  return (
    playlist.credits.find(
      (credit) =>
        credit.resourceId ===
          playlist.resourceId &&
        credit.role
          .trim()
          .toLowerCase() ===
          "curator" &&
        credit.isPrimary,
    ) ??
    playlist.credits.find(
      (credit) =>
        credit.resourceId ===
          playlist.resourceId &&
        credit.role
          .trim()
          .toLowerCase() ===
          "curator",
    ) ??
    null
  );
}

function buildPlaylistTrustPresentation(
  playlist: PublicPlaylist,
) {
  return {
    credits:
      playlist.credits.map(
        (
          credit,
        ) => ({
          id:
            credit.creditId,
          displayName:
            credit.displayName,
          roleLabel:
            credit.roleLabel ??
            humanizeTrustToken(
              credit.role,
            ) ??
            "Contributor",
          note:
            credit.note,
          href:
            playlistCreditHref(
              credit,
            ),
          contextLabel:
            playlistTrustContextLabel(
              playlist,
              credit.resourceId,
            ),
        }),
      ),
    sources:
      playlist.citations.map(
        (
          citation,
        ) => ({
          id:
            citation.citationId,
          label:
            citation.publicLabel ??
            citation.source.title,
          title:
            citation.source.title,
          creator:
            citation.source.creator,
          publisher:
            citation.source.publisher,
          url:
            citation.source.url,
          publicationDate:
            citation.source.publicationDate,
          creditLine:
            citation.source.creditLine,
          locatorLabel:
            citationLocatorLabel(
              citation,
            ),
          contextLabel:
            playlistTrustContextLabel(
              playlist,
              citation.resourceId,
            ),
        }),
      ),
    corrections:
      playlist.corrections.map(
        (
          correction,
        ) => ({
          id:
            correction.id,
          note:
            correction.note,
          publishedAt:
            correction.publishedAt,
          contextLabel:
            playlistTrustContextLabel(
              playlist,
              correction.resourceId,
            ),
        }),
      ),
  };
}

function PlaylistTrackArtistLinks({
  track,
}: {
  track: PublicPlaylistTrack;
}) {
  if (
    track.artists.length === 0
  ) {
    return (
      <>
        {
          publicPlaylistTrackArtistLabel(
            track,
          )
        }
      </>
    );
  }

  return (
    <>
      {
        track.artists.map(
          (
            artist,
            index,
          ) => (
            <span
              key={
                artist.artistId
              }
            >
              {
                index > 0
                  ? ", "
                  : ""
              }
              {
                artist.artistSlug
                  ? (
                      <Link
                        to={
                          `/artists/${artist.artistSlug}`
                        }
                        className="transition-colors hover:text-[var(--wk-brand)] hover:underline"
                      >
                        {
                          artist.name
                        }
                      </Link>
                    )
                  : artist.name
              }
            </span>
          ),
        )
      }
    </>
  );
}

function buildPlaylistArtistDiscovery(
  playlist: PublicPlaylist,
): MusicArtistDiscoveryArtist[] {
  const artists =
    new Map<
      string,
      MusicArtistDiscoveryArtist
    >();

  for (
    const track
    of playlist.tracks
  ) {
    for (
      const artist
      of track.artists
    ) {
      let summary =
        artists.get(
          artist.artistId,
        );

      if (!summary) {
        summary = {
          artistId:
            artist.artistId,
          slug:
            artist.artistSlug,
          name:
            artist.name,
          imageUrl:
            artist.imageUrl,
          tracks:
            [],
        };

        artists.set(
          artist.artistId,
          summary,
        );
      }

      if (
        !summary.tracks.some(
          (
            item,
          ) =>
            item.id ===
            track.playlistItemResourceId,
        )
      ) {
        summary.tracks.push({
          id:
            track.playlistItemResourceId,
          title:
            track.title,
          position:
            track.position,
          anchorId:
            trackAnchorId(
              track,
            ),
          artworkUrl:
            track.artworkUrl,
        });
      }
    }
  }

  return Array.from(
    artists.values(),
  )
    .map(
      (
        artist,
      ) => ({
        ...artist,
        tracks:
          [...artist.tracks].sort(
            (
              left,
              right,
            ) =>
              left.position -
              right.position,
          ),
      }),
    )
    .sort(
      (
        left,
        right,
      ) => {
        const leftPosition =
          left.tracks[0]
            ?.position ??
          Number.MAX_SAFE_INTEGER;

        const rightPosition =
          right.tracks[0]
            ?.position ??
          Number.MAX_SAFE_INTEGER;

        return (
          leftPosition -
            rightPosition ||
          left.name.localeCompare(
            right.name,
          )
        );
      },
    );
}

function PlaylistTrackRow({
  playlist,
  track,
  playerTrack,
  currentTrackId,
  isPlaying,
  expanded,
  showPublicActions,
  saved,
  savePending,
  onPlay,
  onToggle,
  onSave,
  onDiscuss,
  shareUrl,
}: {
  playlist: PublicPlaylist;
  track: PublicPlaylistTrack;
  playerTrack: PlayerTrack | undefined;
  currentTrackId: string | undefined;
  isPlaying: boolean;
  expanded: boolean;
  showPublicActions: boolean;
  saved: boolean;
  savePending: boolean;
  onPlay: () => void;
  onToggle: () => void;
  onSave: () => void;
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
    publicPlaylistTrackArtistLabel(
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
            <PlaylistTrackArtistLinks
              track={
                track
              }
            />
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
                          <PlaylistTrackArtistLinks
                            track={
                              track
                            }
                          />
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

              {
                showPublicActions
                  ? (
                      <div className="mt-5 flex flex-wrap items-center gap-3">
                        {
                          track.registry?.trackId
                            ? (
                                <button
                                  type="button"
                                  onClick={
                                    onSave
                                  }
                                  disabled={
                                    savePending
                                  }
                                  aria-pressed={
                                    saved
                                  }
                                  className="wk-button wk-button-soft"
                                >
                                  <WkIcon
                                    name="Bookmark"
                                    size={
                                      14
                                    }
                                  />
                                  {
                                    savePending
                                      ? "Updating..."
                                      : saved
                                        ? "Saved"
                                        : "Save track"
                                  }
                                </button>
                              )
                            : null
                        }

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
                    )
                  : null
              }
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

  const [searchParams] =
    useSearchParams();

  const previewNonce =
    searchParams
      .get("preview")
      ?.trim() ||
    null;

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

  const [
    missingTrackSuggestionOpen,
    setMissingTrackSuggestionOpen,
  ] =
    useState(
      false,
    );

  const [
    playlistSaved,
    setPlaylistSaved,
  ] =
    useState(
      false,
    );

  const [
    savedTrackIds,
    setSavedTrackIds,
  ] =
    useState<Set<string>>(
      () =>
        new Set(),
    );

  const [
    followedArtistIds,
    setFollowedArtistIds,
  ] =
    useState<Set<string>>(
      () =>
        new Set(),
    );

  const [
    playlistSavePending,
    setPlaylistSavePending,
  ] =
    useState(
      false,
    );

  const [
    trackSavePendingId,
    setTrackSavePendingId,
  ] =
    useState<string | null>(
      null,
    );

  const [
    followPendingArtistId,
    setFollowPendingArtistId,
  ] =
    useState<string | null>(
      null,
    );

  const {
    setFollow,
    setSaved,
  } =
    useEntityActions(
      user.id ||
      undefined,
    );

  const {
    currentTrack,
    isPlaying,
    queue: activeQueue,
    playTrack,
    togglePlay,
  } =
    usePlayer();

  const openMissingTrackSuggestion =
    useCallback(
      () => {
        if (
          user.loading
        ) {
          return;
        }

        if (
          !user.id
        ) {
          window.location.assign(
            buildCommunityAuthUrl(),
          );

          return;
        }

        if (
          !user.isEmailVerified
        ) {
          window.location.assign(
            buildVerifyEmailUrl(
              undefined,
              user.email,
            ),
          );

          return;
        }

        setMissingTrackSuggestionOpen(
          true,
        );
      },
      [
        user.loading,
        user.id,
        user.isEmailVerified,
        user.email,
      ],
    );

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
            previewNonce
              ? await getPublicPlaylistPreview(
                  slug,
                  previewNonce,
                )
              : await getPublicPlaylist(
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
        previewNonce,
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

  const playlistArtists =
    useMemo(
      () =>
        playlist
          ? buildPlaylistArtistDiscovery(
              playlist,
            )
          : [],
      [
        playlist,
      ],
    );

  const playlistTrust =
    useMemo(
      () =>
        playlist
          ? buildPlaylistTrustPresentation(
              playlist,
            )
          : null,
      [
        playlist,
      ],
    );

  useEffect(
    () => {
      let cancelled =
        false;

      if (
        !playlist ||
        !user.id ||
        previewNonce
      ) {
        setPlaylistSaved(
          false,
        );

        setSavedTrackIds(
          new Set(),
        );

        setFollowedArtistIds(
          new Set(),
        );

        return;
      }

      void Promise.all([
        getUserSaves(
          user.id,
        ),
        getUserFollows(
          user.id,
        ),
      ])
        .then(
          ([
            saves,
            follows,
          ]) => {
            if (
              cancelled
            ) {
              return;
            }

            const saveRows =
              saves.filter(
                (
                  row,
                ): row is Record<string, unknown> =>
                  Boolean(
                    row &&
                    typeof row ===
                      "object",
                  ),
              );

            const followRows =
              follows.filter(
                (
                  row,
                ): row is Record<string, unknown> =>
                  Boolean(
                    row &&
                    typeof row ===
                      "object",
                  ),
              );

            setPlaylistSaved(
              saveRows.some(
                (
                  row,
                ) =>
                  row.entity_type ===
                    "playlist" &&
                  row.entity_id ===
                    playlist.resourceId,
              ),
            );

            const registryTrackIds =
              new Set(
                playlist.tracks
                  .map(
                    (
                      track,
                    ) =>
                      track.registry
                        ?.trackId,
                  )
                  .filter(
                    (
                      value,
                    ): value is string =>
                      Boolean(
                        value,
                      ),
                  ),
              );

            setSavedTrackIds(
              new Set(
                saveRows
                  .filter(
                    (
                      row,
                    ) =>
                      row.entity_type ===
                        "track" &&
                      typeof row.entity_id ===
                        "string" &&
                      registryTrackIds.has(
                        row.entity_id,
                      ),
                  )
                  .map(
                    (
                      row,
                    ) =>
                      row.entity_id as string,
                  ),
              ),
            );

            const playlistArtistIds =
              new Set(
                playlistArtists.map(
                  (
                    artist,
                  ) =>
                    artist.artistId,
                ),
              );

            setFollowedArtistIds(
              new Set(
                followRows
                  .filter(
                    (
                      row,
                    ) =>
                      row.target_type ===
                        "artist" &&
                      typeof row.target_id ===
                        "string" &&
                      playlistArtistIds.has(
                        row.target_id,
                      ),
                  )
                  .map(
                    (
                      row,
                    ) =>
                      row.target_id as string,
                  ),
              ),
            );
          },
        )
        .catch(
          () => {
            if (
              !cancelled
            ) {
              setPlaylistSaved(
                false,
              );

              setSavedTrackIds(
                new Set(),
              );

              setFollowedArtistIds(
                new Set(),
              );
            }
          },
        );

      return () => {
        cancelled =
          true;
      };
    },
    [
      playlist,
      playlistArtists,
      previewNonce,
      user.id,
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

  const curatorCredit =
    playlistCuratorCredit(
      playlist,
    );

  const curatorHref =
    curatorCredit
      ? playlistCreditHref(
          curatorCredit,
        )
      : null;

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

  const handlePlaylistSave =
    async () => {
      if (
        playlistSavePending
      ) {
        return;
      }

      const desired =
        !playlistSaved;

      setPlaylistSavePending(
        true,
      );

      try {
        const result =
          await setSaved(
            {
              entityType:
                "playlist",
              entityId:
                playlist.resourceId,
              entitySlug:
                playlist.slug,
              entityUrl:
                canonicalUrl,
              title:
                playlist.title,
              subtitle:
                playlist.curatorLabel ??
                "WAKILISHA",
              imageUrl:
                playlist.cover?.url ??
                undefined,
            },
            desired,
          );

        if (
          result
        ) {
          setPlaylistSaved(
            result.saved,
          );
        }
      } finally {
        setPlaylistSavePending(
          false,
        );
      }
    };

  const handleTrackSave =
    async (
      track: PublicPlaylistTrack,
    ) => {
      const trackId =
        track.registry
          ?.trackId;

      if (
        !trackId ||
        trackSavePendingId
      ) {
        return;
      }

      const desired =
        !savedTrackIds.has(
          trackId,
        );

      setTrackSavePendingId(
        trackId,
      );

      try {
        const result =
          await setSaved(
            {
              entityType:
                "track",
              entityId:
                trackId,
              entitySlug:
                track.registry
                  ?.trackSlug ??
                undefined,
              entityUrl:
                track.registry
                  ?.trackPath
                  ? `https://wakilisha.africa${track.registry.trackPath}`
                  : `${canonicalUrl}#${trackAnchorId(
                      track,
                    )}`,
              title:
                track.title,
              subtitle:
                publicPlaylistTrackArtistLabel(
                  track,
                ),
              imageUrl:
                track.artworkUrl ??
                undefined,
            },
            desired,
          );

        if (
          result
        ) {
          setSavedTrackIds(
            (
              current,
            ) => {
              const next =
                new Set(
                  current,
                );

              if (
                result.saved
              ) {
                next.add(
                  trackId,
                );
              } else {
                next.delete(
                  trackId,
                );
              }

              return next;
            },
          );
        }
      } finally {
        setTrackSavePendingId(
          null,
        );
      }
    };

  const handleArtistFollow =
    async (
      artist: MusicArtistDiscoveryArtist,
    ) => {
      if (
        followPendingArtistId
      ) {
        return;
      }

      const desired =
        !followedArtistIds.has(
          artist.artistId,
        );

      setFollowPendingArtistId(
        artist.artistId,
      );

      try {
        const result =
          await setFollow(
            "artist",
            artist.artistId,
            artist.slug ??
              undefined,
            desired,
          );

        if (
          result
        ) {
          setFollowedArtistIds(
            (
              current,
            ) => {
              const next =
                new Set(
                  current,
                );

              if (
                result.followed
              ) {
                next.add(
                  artist.artistId,
                );
              } else {
                next.delete(
                  artist.artistId,
                );
              }

              return next;
            },
          );
        }
      } finally {
        setFollowPendingArtistId(
          null,
        );
      }
    };

  const openTrackDiscussion =
    (
      track: PublicPlaylistTrack,
    ) => {
      const artist =
        publicPlaylistTrackArtistLabel(
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
      {previewNonce ? (
        <PlaylistPreviewModeBanner />
      ) : null}

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
        robots={
          previewNonce
            ? "noindex, nofollow, noarchive"
            : undefined
        }
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
                    publicPlaylistTrackArtistLabel(
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
              <div className="mb-4 flex items-center gap-2 text-[10px] font-extrabold uppercase tracking-[0.22em] text-[#b9ee78] md:hidden">
                <WkIcon
                  name="ListMusic"
                  size={
                    12
                  }
                />
                Playlist
              </div>

              <div className="grid items-end gap-6 md:grid-cols-[170px_minmax(0,1fr)] md:gap-8">
                <div className="aspect-square w-[132px] overflow-hidden rounded-2xl border border-white/15 bg-black/20 shadow-2xl md:w-[170px]">
                  <PlaylistCoverPresentation
                    src={
                      playlist.cover?.url ??
                      null
                    }
                    altText={
                      playlist.cover?.altText ??
                      null
                    }
                    slug={
                      playlist.slug
                    }
                    title={
                      playlist.title
                    }
                    caption={
                      playlist.cover?.caption ??
                      null
                    }
                  />
                </div>

                <div className="min-w-0">
                  <div className="mb-3 hidden items-center gap-2 text-[10px] font-extrabold uppercase tracking-[0.22em] text-[#b9ee78] md:flex">
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
                    {
                      curatorHref
                        ? (
                            <Link
                              to={
                                curatorHref
                              }
                              className="text-white underline-offset-4 transition-colors hover:text-[#b9ee78] hover:underline"
                            >
                              {
                                playlist.curatorLabel ??
                                "WAKILISHA"
                              }
                            </Link>
                          )
                        : (
                            <span className="text-white">
                              {
                                playlist.curatorLabel ??
                                "WAKILISHA"
                              }
                            </span>
                          )
                    }
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

                    {
                      !previewNonce
                        ? (
                            <div
                              className="flex flex-wrap items-center gap-3 [--wk-text:#ffffff] [--wk-border-2:rgba(255,255,255,0.34)] [&_.wk-button]:bg-white/10 [&_.wk-button:hover]:bg-white/15"
                            >
                              <WkButton
                                variant="soft"
                                onClick={
                                  () => {
                                    void handlePlaylistSave();
                                  }
                                }
                                disabled={
                                  playlistSavePending
                                }
                              >
                                <WkIcon
                                  name="Bookmark"
                                  size={
                                    15
                                  }
                                />
                                {
                                  playlistSavePending
                                    ? "Updating..."
                                    : playlistSaved
                                      ? "Saved"
                                      : "Save Playlist"
                                }
                              </WkButton>

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
                          )
                        : null
                    }
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
                      publicPlaylistTrackArtistLabel(
                        track,
                      ),
                    searchText:
                      [
                        track.position,
                        track.title,
                        publicPlaylistTrackArtistLabel(
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
                      showPublicActions={
                        !previewNonce
                      }
                      saved={
                        Boolean(
                          track.registry
                            ?.trackId &&
                          savedTrackIds.has(
                            track.registry.trackId,
                          ),
                        )
                      }
                      savePending={
                        Boolean(
                          track.registry
                            ?.trackId &&
                          trackSavePendingId ===
                            track.registry.trackId,
                        )
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
                      onSave={
                        () => {
                          void handleTrackSave(
                            track,
                          );
                        }
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

            {
              !previewNonce
                ? (
                    <div className="mt-4 flex justify-end">
                      <button
                        type="button"
                        onClick={
                          openMissingTrackSuggestion
                        }
                        disabled={
                          user.loading
                        }
                        aria-haspopup="dialog"
                        className="inline-flex items-center gap-2 rounded-full border border-[var(--wk-border)] bg-[var(--wk-surface)] px-4 py-2.5 text-[12px] font-extrabold text-[var(--wk-text-soft)] transition-colors hover:border-[var(--wk-brand)] hover:text-[var(--wk-brand)] disabled:cursor-wait disabled:opacity-50"
                      >
                        <WkIcon
                          name="ListPlus"
                          size={
                            14
                          }
                        />
                        Suggest a missing track
                      </button>
                    </div>
                  )
                : null
            }
          </section>
        </div>

        <MusicArtistDiscovery
          heading="Artists in this Playlist"
          contextLabel={
            playlist.title
          }
          artists={
            playlistArtists.map(
              (
                artist,
              ) => ({
                ...artist,
                followed:
                  followedArtistIds.has(
                    artist.artistId,
                  ),
                followPending:
                  followPendingArtistId ===
                  artist.artistId,
              }),
            )
          }
          onJumpTo={
            jumpToTrack
          }
          onFollow={
            previewNonce
              ? undefined
              : (
                  artist,
                ) => {
                  void handleArtistFollow(
                    artist,
                  );
                }
          }
        />

        {
          playlistTrust
            ? (
                <PublicTrustSummary
                  mode={
                    previewNonce
                      ? "preview"
                      : "public"
                  }
                  provenance={{
                    firstPublishedAt:
                      playlist.provenance
                        .firstPublishedAt,
                    publishedAt:
                      playlist.provenance
                        .publishedAt,
                    versionNumber:
                      playlist.provenance
                        .versionNumber ||
                      playlist.versionNumber,
                  }}
                  credits={
                    playlistTrust.credits
                  }
                  sources={
                    playlistTrust.sources
                  }
                  corrections={
                    playlistTrust.corrections
                  }
                />
              )
            : null
        }

        {
          !previewNonce
            ? (
                <>
                  <CommunitySection
                    entity={
                      communityEntity
                    }
                    user={
                      user
                    }
                  />

                  <ContributionSheet
                    entity={
                      communityEntity
                    }
                    open={
                      missingTrackSuggestionOpen
                    }
                    onClose={
                      () =>
                        setMissingTrackSuggestionOpen(
                          false,
                        )
                    }
                    userId={
                      user.id ||
                      undefined
                    }
                    initialType="missing_track"
                    allowedTypes={[
                      "missing_track",
                    ]}
                    title="Suggest a missing track"
                    submitLabel="Submit suggestion"
                    descriptionLabel="Anything else we should know?"
                    descriptionPlaceholder="Optional context about why this track belongs here."
                    reviewNote="Suggestions are reviewed by our editorial team."
                    playlistSubmission={{
                      playlistId:
                        playlist.playlistId,
                      playlistSlug:
                        playlist.slug,
                    }}
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
                </>
              )
            : null
        }
      </main>
    </>
  );
}
