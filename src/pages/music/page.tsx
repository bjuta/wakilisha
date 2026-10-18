import "@/styles/wakilisha-workbook-surface-fidelity.css";
import "@/styles/wakilisha-workbook-p1-p11-authority.css";
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  Link,
  useNavigate,
} from "react-router-dom";
import {
  WkIcon,
} from "@/components/design-system/Icon";
import { PlayableArtwork } from "@/components/design-system/music/PlayableArtwork";
import { AddToPlaylistButton } from "@/components/playlists/AddToPlaylistButton";
import { ShareSheet } from "@/components/design-system/share/ShareSheet";
import {
  usePlayer,
  type PlayerTrack,
} from "@/context/PlayerContext";
import {
  getRelease,
  listArtists,
  listGenres,
  listReleasesPaginated,
  releaseUrl,
  slugify,
  type PublicArtist,
  type PublicGenre,
  type PublicRelease,
} from "@/services/publicContent/client";
import {
  listPublicPlaylists,
} from "@/services/playlists/playlistPublicService";
import type {
  PublicPlaylistListItem,
} from "@/services/playlists/playlistPublicModel";
import {
  getChartFamilies,
  getLatestChartEditionWithEntries,
} from "@/services/chartsPublic/client";
import type {
  ChartEditionEntry,
} from "@/services/chartsPublic/types";
import {
  getFollowingFeed,
  type FollowingFeedItem,
} from "@/services/community/followingFeed";

const RELEASE_LIMIT = 18;
const PLAYLIST_LIMIT = 6;

function hasImage(value?: string | null) {
  return Boolean(
    value &&
      !value.startsWith("data:image/svg"),
  );
}

function formatRelativeTime(value: string) {
  const timestamp = new Date(value).getTime();
  if (!Number.isFinite(timestamp)) return "";

  const diffMs = Date.now() - timestamp;
  const hours = Math.max(0, Math.floor(diffMs / 3_600_000));

  if (hours < 1) return "Now";
  if (hours < 24) return `${hours}h`;

  const days = Math.floor(hours / 24);
  return `${days}d`;
}

function MusicArtwork({
  src,
  alt,
  className = "",
  fit = "cover",
  loading = "lazy",
}: {
  src?: string | null;
  alt: string;
  className?: string;
  fit?: "cover" | "contain";
  loading?: "lazy" | "eager";
}) {
  // A Registry URL may expire or fail upstream. Do not leave a blank image
  // rectangle or pretend that a generated texture is approved cover art.
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  if (!src || failedSrc === src) {
    return (
      <div
        className={`flex h-full w-full flex-col items-center justify-center gap-2 bg-[var(--wk-surface-raised)] p-3 text-center ${className}`}
      >
        <WkIcon name="Music" size={23} className="text-[var(--wk-text-faint)]" />
        {alt ? <span className="line-clamp-2 text-[11px] font-semibold leading-tight text-[var(--wk-text-muted)]">{alt}</span> : null}
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={alt}
      loading={loading}
      fetchPriority={loading === "eager" ? "high" : undefined}
      onError={() => setFailedSrc(src)}
      className={`h-full w-full ${fit === "contain" ? "object-contain" : "object-cover"} ${className}`}
    />
  );
}

function CompactRelease({
  release,
  onPlay,
  active,
  busy,
}: {
  release: PublicRelease;
  onPlay: (release: PublicRelease, source: string) => void;
  active: boolean;
  busy: boolean;
}) {
  return (
    <article className="group flex min-w-[272px] flex-1 overflow-hidden rounded-[16px] border border-[var(--wk-border)] bg-[var(--wk-surface)] transition-colors hover:bg-[var(--wk-surface-raised)]">
      <PlayableArtwork
        label={release.title}
        onPlay={(event) => {
          event.stopPropagation();
          onPlay(release, "fresh-arrivals");
        }}
        isPlaying={active}
        pending={busy}
        className="aspect-square w-[100px] shrink-0"
        iconClassName="h-9 w-9 text-[15px]"
      >
        <MusicArtwork
          src={release.artworkUrl}
          alt=""
          fit="contain"
          className="transition-transform duration-500 group-hover:scale-[1.04]"
        />
      </PlayableArtwork>

      <div className="flex min-w-0 flex-1 items-center gap-2 p-3">
        <div className="min-w-0 flex-1">
          <Link
            to={releaseUrl(release)}
            className="block line-clamp-2 text-[15px] font-bold leading-tight text-[var(--wk-text)] transition hover:text-[var(--wk-brand)]"
          >
            {release.title}
          </Link>
          <Link
            to={`/artists/${slugify(release.artist)}`}
            className="mt-1 block truncate text-[13px] font-medium text-[var(--wk-text-soft)] hover:text-[var(--wk-text)]"
          >
            {release.artist}
          </Link>
          <p className="mt-1.5 truncate text-[12px] font-medium text-[var(--wk-text-muted)]">
            {release.releaseType || "Release"}
            {release.trackCount > 1
              ? ` · ${release.trackCount} tracks`
              : ""}
          </p>
        </div>

      </div>
    </article>
  );
}

function EditorialArtistCard({
  artist,
  eyebrow,
  footer,
}: {
  artist: PublicArtist;
  eyebrow?: string;
  footer?: string;
}) {
  return (
    <Link
      to={`/artists/${artist.slug}`}
      className="group relative block h-[176px] overflow-hidden rounded-xl border border-[var(--wk-border)] bg-[var(--wk-surface)]"
    >
      <MusicArtwork
        src={artist.imageUrl}
        alt={artist.name}
        className="transition-transform duration-700 group-hover:scale-[1.035]"
      />
      <div className="absolute inset-0 bg-gradient-to-t from-black/95 via-black/40 to-black/5" />
      <div className="absolute inset-x-0 bottom-0 p-4">
        {eyebrow ? (
          <div className="mb-2 text-[9px] font-black uppercase tracking-[0.16em] text-[#B6EB79]">
            {eyebrow}
          </div>
        ) : null}
        <h3 className="text-[17px] font-black leading-tight tracking-[-0.03em] text-white drop-shadow-[0_1px_8px_rgba(0,0,0,0.42)]">
          {artist.name}
        </h3>
        <p className="mt-1 text-[10px] font-semibold text-white/78 drop-shadow-[0_1px_6px_rgba(0,0,0,0.38)]">
          {footer ||
            [
              artist.country,
              artist.releaseCount
                ? `${artist.releaseCount} releases`
                : null,
            ]
              .filter(Boolean)
              .join(" · ")}
        </p>
      </div>
    </Link>
  );
}

function PlaylistFeature({
  playlist,
}: {
  playlist: PublicPlaylistListItem;
}) {
  return (
    <Link
      to={`/playlists/${playlist.slug}`}
      className="group relative block h-[176px] overflow-hidden rounded-xl border border-[var(--wk-border)] bg-[var(--wk-surface)]"
    >
      <MusicArtwork
        src={playlist.coverUrl}
        alt={
          playlist.coverAltText ||
          playlist.title
        }
        fit="contain"
        className="transition-transform duration-700 group-hover:scale-[1.035]"
      />
      <div className="absolute inset-0 bg-gradient-to-t from-black/95 via-black/40 to-black/5" />
      <div className="absolute inset-x-0 bottom-0 p-4">
        <div className="mb-2 text-[9px] font-black uppercase tracking-[0.16em] text-[#B6EB79]">
          {playlist.curatorLabel ||
            "WAKILISHA"}
        </div>
        <h3 className="text-[17px] font-black leading-tight tracking-[-0.03em] text-white drop-shadow-[0_1px_8px_rgba(0,0,0,0.42)]">
          {playlist.title}
        </h3>
        <p className="mt-1 text-[10px] font-semibold text-white/78 drop-shadow-[0_1px_6px_rgba(0,0,0,0.38)]">
          {playlist.itemCount} tracks
        </p>
      </div>
    </Link>
  );
}

function ChartMiniList({
  entries,
}: {
  entries: ChartEditionEntry[];
}) {
  if (!entries.length) {
    return (
      <Link
        to="/charts"
        className="flex min-h-[112px] items-center justify-center rounded-xl border border-[var(--wk-border)] bg-[var(--wk-surface)] px-5 text-center text-[14px] font-semibold text-[var(--wk-text)] transition hover:border-[var(--wk-brand)] hover:bg-[var(--wk-surface-raised)]"
      >
        Open the latest WAKILISHA charts
      </Link>
    );
  }

  return (
    <div className="space-y-2">
      {entries.slice(0, 10).map((entry) => (
        <div
          key={entry.id}
          className="flex min-h-[62px] items-center gap-3 rounded-xl border border-[var(--wk-border)] bg-[var(--wk-surface)] p-2.5 transition-colors hover:bg-[var(--wk-surface-raised)]"
        >
          <div className="w-6 shrink-0 text-center text-[15px] font-bold text-[var(--wk-text-muted)]">
            {entry.rank}
          </div>
          <div className="h-11 w-11 shrink-0 overflow-hidden rounded-md bg-[var(--wk-surface-raised)]">
            <MusicArtwork
              src={entry.artworkUrl}
              alt={entry.trackTitle}
              fit="contain"
            />
          </div>
          <div className="min-w-0 flex-1">
            <div className="truncate text-[13px] font-bold text-[var(--wk-text)]">
              {entry.trackTitle}
            </div>
            <div className="mt-0.5 truncate text-[11px] font-medium text-[var(--wk-text-soft)]">
              {entry.artistNames.join(", ")}
            </div>
          </div>
          <AddToPlaylistButton
            trackId={entry.canonicalTrackId}
            trackTitle={entry.trackTitle}
            compact
            iconOnly
          />
        </div>
      ))}
      <Link
        to="/charts"
        className="flex h-8 items-center justify-center rounded-lg bg-[var(--wk-surface-raised)] text-[9px] font-bold text-[var(--wk-text-soft)] transition hover:bg-white/[0.1] hover:text-[var(--wk-text)]"
      >
        View Full Chart
      </Link>
    </div>
  );
}

function FollowingMiniList({
  items,
}: {
  items: FollowingFeedItem[];
}) {
  if (!items.length) {
    return (
      <Link
        to="/following"
        className="flex min-h-[150px] flex-col items-center justify-center rounded-xl border border-[var(--wk-border)] bg-[var(--wk-surface)] px-5 text-center"
      >
        <WkIcon
          name="Users"
          size={19}
          className="mb-3 text-[var(--wk-brand)]"
        />
        <div className="text-[11px] font-black text-[var(--wk-text)]">
          No new music yet.
        </div>
        <p className="mt-2 max-w-[24ch] text-[10px] font-medium leading-relaxed text-[var(--wk-text-muted)]">
          Follow artists and people to see what they release.
        </p>
      </Link>
    );
  }

  return (
    <div className="space-y-2">
      {items.slice(0, 3).map((item) => (
        <Link
          key={item.itemKey}
          to={item.canonicalPath}
          className="flex min-h-[62px] gap-2 rounded-lg border border-[var(--wk-border)] bg-[var(--wk-surface)] p-2 transition hover:bg-[var(--wk-surface-raised)]"
        >
          <div className="h-10 w-10 shrink-0 overflow-hidden rounded-full bg-[var(--wk-surface-raised)]">
            <MusicArtwork
              src={item.imageUrl}
              alt={item.title}
            />
          </div>
          <div className="min-w-0 flex-1">
            <div className="line-clamp-1 text-[10px] font-black text-[var(--wk-text)]">
              {item.title}
            </div>
            <div className="mt-1 line-clamp-1 text-[9px] font-medium text-[var(--wk-text-muted)]">
              {item.summary ||
                item.itemType.replace(
                  "_",
                  " ",
                )}
            </div>
          </div>
          <span className="shrink-0 text-[8px] font-semibold text-[var(--wk-text-faint)]">
            {formatRelativeTime(
              item.publishedAt,
            )}
          </span>
        </Link>
      ))}
    </div>
  );
}

async function loadChartEntries() {
  try {
    const familiesResult =
      await getChartFamilies();

    for (
      const family of
      familiesResult.data.families.slice(
        0,
        8,
      )
    ) {
      const slug =
        family.publicSlug ||
        family.slug ||
        family.seriesSlug ||
        family.familyKey;

      if (!slug) continue;

      try {
        const latest =
          await getLatestChartEditionWithEntries(
            slug,
            family.marketSlug,
          );

        if (latest.data.entries.length) {
          return latest.data.entries.slice(
            0,
            10,
          );
        }
      } catch {
        // Try the next published chart family.
      }
    }
  } catch {
    // Chart panel has a truthful directory fallback.
  }

  return [];
}

export default function MusicDiscoveryPage() {
  const navigate = useNavigate();

  const {
    currentTrack,
    isPlaying,
    playTrack,
    togglePlay,
  } = usePlayer();

  const [releases, setReleases] =
    useState<PublicRelease[]>([]);
  const [artists, setArtists] =
    useState<PublicArtist[]>([]);
  const [playlists, setPlaylists] =
    useState<
      PublicPlaylistListItem[]
    >([]);
  const [chartEntries, setChartEntries] =
    useState<ChartEditionEntry[]>([]);
  const [genres, setGenres] = useState<PublicGenre[]>([]);
  const [followingItems, setFollowingItems] =
    useState<FollowingFeedItem[]>([]);
  const [loading, setLoading] =
    useState(true);
  const [busyReleaseId, setBusyReleaseId] =
    useState<string | null>(null);
  const [shareRelease, setShareRelease] =
    useState<PublicRelease | null>(null);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      setLoading(true);

      const [
        releaseResult,
        artistResult,
        playlistResult,
        chartResult,
        followingResult,
        genreResult,
      ] =
        await Promise.allSettled([
          listReleasesPaginated({
            offset: 0,
            limit: RELEASE_LIMIT,
            sortKey: "newest",
          }),
          listArtists(),
          listPublicPlaylists({
            limit: PLAYLIST_LIMIT,
          }),
          loadChartEntries(),
          getFollowingFeed({
            limit: 3,
          }),
          listGenres(),
        ]);

      if (cancelled) return;

      if (
        releaseResult.status ===
        "fulfilled"
      ) {
        setReleases(
          releaseResult.value.releases,
        );
      }

      if (
        artistResult.status ===
        "fulfilled"
      ) {
        setArtists(
          artistResult.value,
        );
      }

      if (
        playlistResult.status ===
        "fulfilled"
      ) {
        setPlaylists(
          playlistResult.value,
        );
      }

      if (
        chartResult.status ===
        "fulfilled"
      ) {
        setChartEntries(
          chartResult.value,
        );
      }

      if (
        followingResult.status ===
        "fulfilled"
      ) {
        setFollowingItems(
          followingResult.value.items,
        );
      }

      if (genreResult.status === "fulfilled") {
        setGenres(genreResult.value.filter((genre) => genre.name && genre.slug));
      }

      setLoading(false);
    };

    load();

    return () => {
      cancelled = true;
    };
  }, []);

  const hero =
    useMemo(
      () =>
        releases.find((release) =>
          hasImage(
            release.artworkUrl,
          ),
        ) ||
        releases[0] ||
        null,
      [releases],
    );

  const heroArtist =
    useMemo(() => {
      if (!hero) return null;

      const slug =
        slugify(hero.artist);

      return (
        artists.find(
          (artist) =>
            artist.slug === slug,
        ) ||
        artists.find(
          (artist) =>
            artist.name
              .trim()
              .toLowerCase() ===
            hero.artist
              .trim()
              .toLowerCase(),
        ) ||
        null
      );
    }, [artists, hero]);

  const freshArrivals =
    useMemo(
      () =>
        releases
          .filter(
            (release) =>
              release.id !== hero?.id,
          )
          .slice(0, 5),
      [hero?.id, releases],
    );

  const risingArtist =
    useMemo(
      () =>
        artists.find(
          (artist) =>
            artist.isRising &&
            hasImage(
              artist.imageUrl,
            ),
        ) || null,
      [artists],
    );

  const registryArtist =
    useMemo(
      () =>
        artists.find(
          (artist) =>
            artist.id !==
              risingArtist?.id &&
            artist.releaseCount > 0 &&
            hasImage(
              artist.imageUrl,
            ),
        ) || null,
      [
        artists,
        risingArtist?.id,
      ],
    );

  const featuredPlaylist =
    playlists[0] || null;

  const activeReleaseId =
    currentTrack?.releaseId || null;

  const handlePlayRelease =
    useCallback(
      async (
        release: PublicRelease,
        sourceSection: string,
      ) => {
        if (
          activeReleaseId ===
            release.id &&
          currentTrack
        ) {
          togglePlay();
          return;
        }

        setBusyReleaseId(
          release.id,
        );

        try {
          const detail =
            await getRelease(
              slugify(
                release.artist,
              ),
              release.slug,
            );

          if (
            !detail?.tracks.length
          ) {
            navigate(
              releaseUrl(
                release,
              ),
            );
            return;
          }

          const queue: PlayerTrack[] =
            detail.tracks.map(
              (track) => ({
                id: track.id,
                registryTrackId:
                  track.id,
                title:
                  track.title,
                artist:
                  track.artist,
                artworkUrl:
                  track.artworkUrl ||
                  release.artworkUrl,
                album:
                  release.title,
                releaseId:
                  release.id,
                duration:
                  track.duration,
                previewUrl:
                  track.previewUrl,
                appleMusicId:
                  track.appleMusicId,
                appleMusicCatalogId:
                  track.appleMusicCatalogId,
                isPlayable:
                  Boolean(
                    track.previewUrl ||
                      track.appleMusicId ||
                      track.appleMusicCatalogId,
                  ),
                source:
                  "WAKILISHA Registry",
                artistSlug:
                  slugify(
                    release.artist,
                  ),
                trackSlug:
                  track.slug,
              }),
            );

          const firstPlayable =
            queue.find(
              (track) =>
                track.isPlayable,
            ) || queue[0];

          if (!firstPlayable) {
            navigate(
              releaseUrl(
                release,
              ),
            );
            return;
          }

          playTrack(
            firstPlayable,
            queue,
            {
              pageType:
                "music",
              entitySlug:
                release.slug,
              entityType:
                "release",
              sourceSection,
            },
          );
        } finally {
          setBusyReleaseId(
            null,
          );
        }
      },
      [
        activeReleaseId,
        currentTrack,
        navigate,
        playTrack,
        togglePlay,
      ],
    );

  return (
    <div data-wk-workbook-screen="music" className="min-h-screen bg-[var(--wk-bg)] text-[var(--wk-text)]">
      <style>{`
        .wk-music-hero {
          --wk-text: #ffffff;
          --wk-text-soft: rgba(255,255,255,.78);
          --wk-text-muted: rgba(255,255,255,.58);
          --wk-text-faint: rgba(255,255,255,.34);
          --wk-border: rgba(255,255,255,.10);
          --wk-border-2: rgba(255,255,255,.16);
          --wk-border-strong: rgba(255,255,255,.24);
        }
      `}</style>
      <main>
            <section className="wk-music-hero relative min-h-[430px] overflow-hidden rounded-[24px] bg-[#0a0a0a]">
              {hero ? (
                <>
                  <div className="absolute inset-0">
                    <MusicArtwork
                      src={hero.artworkUrl}
                      alt={`${hero.title} artwork`}
                      loading="eager"
                      className="object-cover object-center opacity-75"
                    />
                    <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(4,4,4,0.98)_0%,rgba(4,4,4,0.86)_29%,rgba(4,4,4,0.18)_67%,rgba(4,4,4,0.62)_100%)]" />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/20" />
                  </div>

                  <div className="relative grid min-h-[430px] gap-8 px-5 py-10 sm:px-8 lg:grid-cols-[minmax(0,1fr)_minmax(260px,410px)] lg:items-center lg:gap-12 lg:px-10">
                    <div className="max-w-[720px] self-center">
                      <div className="mb-4 inline-flex items-center rounded bg-black/50 px-2.5 py-1.5 text-[10px] font-bold uppercase tracking-[0.15em] text-[#B6EB79]">
                        Featured release
                      </div>

                      <h1 className="max-w-[11ch] text-[clamp(46px,6vw,86px)] font-black uppercase leading-[0.87] tracking-[-0.055em] text-[var(--wk-text)]">
                        {hero.title}
                      </h1>

                      <Link
                        to={`/artists/${slugify(
                          hero.artist,
                        )}`}
                        className="mt-4 inline-flex items-center gap-2 text-[24px] font-black tracking-[-0.035em] text-[var(--wk-text)] hover:text-[var(--wk-brand)]"
                      >
                        {hero.artist}
                      </Link>

                      <p className="mt-3 max-w-[42ch] text-[13px] font-medium leading-relaxed text-[var(--wk-text-soft)]">
                        {hero.description ||
                          `${hero.releaseType || "Release"} · ${hero.year || "From the Registry"}`}
                      </p>

                      <div className="mt-6 flex flex-wrap items-center gap-3">
                        <button
                          type="button"
                          onClick={() =>
                            handlePlayRelease(
                              hero,
                              "music-hero",
                            )
                          }
                          className="inline-flex h-11 items-center gap-2 rounded-full bg-white px-5 text-[12px] font-black text-black transition hover:scale-[1.015]"
                        >
                          <WkIcon
                            name={
                              busyReleaseId ===
                              hero.id
                                ? "LoaderCircle"
                                : activeReleaseId ===
                                      hero.id &&
                                    isPlaying
                                  ? "Pause"
                                  : "Play"
                            }
                            size={15}
                            className={
                              busyReleaseId ===
                              hero.id
                                ? "animate-spin"
                                : ""
                            }
                            fill={
                              activeReleaseId ===
                                hero.id &&
                              isPlaying
                                ? "none"
                                : "currentColor"
                            }
                          />
                          {activeReleaseId ===
                            hero.id &&
                          isPlaying
                            ? "Pause"
                            : "Play"}
                        </button>

                        <Link
                          to={releaseUrl(
                            hero,
                          )}
                          className="inline-flex min-h-11 items-center gap-2 rounded-full border border-white/30 bg-black/30 px-4 text-[12px] font-semibold text-white backdrop-blur transition hover:bg-white/15"
                          aria-label="Open release"
                        >
                          <WkIcon name="ArrowUpRight" size={16} />
                          Release
                        </Link>

                        <button
                          type="button"
                          onClick={() =>
                            setShareRelease(
                              hero,
                            )
                          }
                          className="flex h-10 w-10 items-center justify-center rounded-full border border-[var(--wk-border-strong)] bg-black/20 text-[var(--wk-text-soft)] backdrop-blur transition hover:bg-white/10 hover:text-[var(--wk-text)]"
                          aria-label="Share release"
                        >
                          <WkIcon
                            name="Share2"
                            size={15}
                          />
                        </button>
                      </div>
                    </div>

                    <Link
                      to={releaseUrl(hero)}
                      aria-label={`Open ${hero.title}`}
                      className="order-first mx-auto block aspect-square w-full max-w-[410px] overflow-hidden rounded-[16px] bg-black/50 lg:order-last"
                    >
                      <MusicArtwork
                        src={hero.artworkUrl}
                        alt={`${hero.title} cover artwork`}
                        fit="contain"
                        loading="eager"
                        className="h-full w-full"
                      />
                    </Link>
                  </div>
                </>
              ) : (
                <div className="flex min-h-[430px] items-center justify-center">
                  <div className="text-[12px] font-semibold text-[var(--wk-text-faint)]">
                    {loading
                      ? "Loading music..."
                      : "Music is on the way."}
                  </div>
                </div>
              )}
            </section>

            <nav aria-label="Music discovery" className="flex gap-1.5 overflow-x-auto border-b border-[var(--wk-border)] px-5 py-3 sm:px-8 [scrollbar-width:none]">
              {[
                { label: "For You", to: "/following" },
                { label: "New", to: "#fresh-arrivals" },
                { label: "Charts", to: "/charts" },
                { label: "Genres", to: "#music-genres" },
                { label: "Playlists", to: "/playlists" },
                { label: "Labels", to: "/labels" },
              ].map((item) => (
                <Link key={item.label} to={item.to} className="inline-flex min-h-11 shrink-0 items-center rounded-full px-4 text-[13px] font-semibold text-[var(--wk-text-muted)] transition hover:bg-[var(--wk-surface-raised)] hover:text-[var(--wk-text)]">
                  {item.label}
                </Link>
              ))}
            </nav>

            <section
              id="fresh-arrivals"
              className="border-b border-[var(--wk-border)] px-5 py-5 sm:px-8"
            >
              <div className="mb-4 flex items-end justify-between gap-4">
                <div className="flex items-baseline gap-5">
                  <h2 className="text-[19px] font-black uppercase tracking-[-0.03em] text-[var(--wk-text)]">
                    Fresh Arrivals
                  </h2>
                  <Link
                    to="/releases"
                    className="text-[10px] font-medium text-[var(--wk-text)]/44 hover:text-[var(--wk-text)]"
                  >
                    See All
                  </Link>
                </div>


              </div>

              <div className="flex gap-3 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                {freshArrivals.map(
                  (release) => (
                    <CompactRelease
                      key={release.id}
                      release={release}
                      onPlay={
                        handlePlayRelease
                      }
                      active={
                        activeReleaseId ===
                          release.id &&
                        isPlaying
                      }
                      busy={
                        busyReleaseId ===
                        release.id
                      }
                    />
                  ),
                )}
              </div>
            </section>


            <section id="music-genres" className="border-b border-[var(--wk-border)] px-5 py-8 sm:px-8">
              <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.12fr)] lg:gap-12">
                <div>
                  <div className="mb-5 flex items-center justify-between gap-4">
                    <h2 className="text-[24px] font-bold tracking-[-0.04em] text-[var(--wk-text)]">On the Charts</h2>
                    <Link to="/charts" className="text-[12px] font-semibold text-[var(--wk-text-muted)] hover:text-[var(--wk-text)]">All Charts →</Link>
                  </div>
                  <ChartMiniList entries={chartEntries} />
                </div>
                <div>
                  <div className="mb-5 flex items-center justify-between gap-4">
                    <h2 className="text-[24px] font-bold tracking-[-0.04em] text-[var(--wk-text)]">Genres</h2>
                    <Link to="/genres" className="text-[12px] font-semibold text-[var(--wk-text-muted)] hover:text-[var(--wk-text)]">All Genres →</Link>
                  </div>
                  {genres.length > 0 ? (
                    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                      {genres.slice(0, 6).map((genre) => (
                        <Link
                          key={genre.id}
                          to={`/genres/${genre.slug}`}
                          aria-label={`Explore ${genre.name}`}
                          className="group flex min-h-[124px] min-w-0 flex-col overflow-hidden rounded-[14px] border border-[var(--wk-border)] bg-[var(--wk-surface)] transition-colors hover:border-[var(--wk-brand)] hover:bg-[var(--wk-surface-raised)]"
                        >
                          {hasImage(genre.artistImageUrl) ? (
                            <div className="h-[92px] w-full overflow-hidden bg-[var(--wk-surface-raised)]">
                              <MusicArtwork src={genre.artistImageUrl} alt="" className="transition-transform duration-500 group-hover:scale-[1.04]" />
                            </div>
                          ) : null}
                          <span className="flex min-h-[72px] items-center justify-between gap-2 px-4 py-3">
                            <span className="min-w-0 break-words text-[15px] font-bold leading-[1.25] text-[var(--wk-text)] sm:text-[17px]">{genre.name}</span>
                            <WkIcon name="ArrowUpRight" size={17} className="shrink-0 text-[var(--wk-brand)]" />
                          </span>
                        </Link>
                      ))}
                    </div>
                  ) : (
                    <Link to="/genres" className="inline-flex min-h-11 items-center text-[14px] text-[var(--wk-text-muted)] underline-offset-4 hover:underline">
                      Browse Genres
                    </Link>
                  )}
                </div>
              </div>
            </section>

            <section className="border-b border-[var(--wk-border)] px-5 py-5 sm:px-8">
              <div className="flex gap-4 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                {risingArtist ? (
                  <div
                    id="on-the-radar"
                    className="min-w-[238px] flex-[1_0_238px] lg:max-w-[310px]"
                  >
                    <div className="mb-3 flex items-center justify-between gap-3">
                      <h2 className="truncate text-[14px] font-black uppercase tracking-[-0.025em]">
                        On The Radar
                      </h2>
                      <Link
                        to="/artists"
                        className="shrink-0 text-[9px] font-semibold text-[var(--wk-text-muted)] hover:text-[var(--wk-text)]"
                      >
                        See All
                      </Link>
                    </div>
                    <EditorialArtistCard
                      artist={risingArtist}
                      
                    />
                  </div>
                ) : null}

                {featuredPlaylist ? (
                  <div className="min-w-[238px] flex-[1_0_238px] lg:max-w-[310px]">
                    <div className="mb-3 flex items-center justify-between gap-3">
                      <h2 className="truncate text-[14px] font-black uppercase tracking-[-0.025em]">
                        Worth Hearing
                      </h2>
                      <Link
                        to="/playlists"
                        className="shrink-0 text-[9px] font-semibold text-[var(--wk-text-muted)] hover:text-[var(--wk-text)]"
                      >
                        See All
                      </Link>
                    </div>
                    <PlaylistFeature
                      playlist={featuredPlaylist}
                    />
                  </div>
                ) : null}

                {registryArtist ? (
                  <div
                    id="from-the-registry"
                    className="min-w-[238px] flex-[1_0_238px] lg:max-w-[310px]"
                  >
                    <div className="mb-3 flex items-center justify-between gap-3">
                      <h2 className="truncate text-[14px] font-black uppercase tracking-[-0.025em]">
                        From The Registry
                      </h2>
                      <Link
                        to="/artists"
                        className="shrink-0 text-[9px] font-semibold text-[var(--wk-text-muted)] hover:text-[var(--wk-text)]"
                      >
                        See All
                      </Link>
                    </div>
                    <EditorialArtistCard
                      artist={registryArtist}
                    />
                  </div>
                ) : null}

                {followingItems.length ? (
                  <div className="min-w-[262px] flex-[1_0_262px] lg:max-w-[330px]">
                    <div className="mb-3 flex items-center justify-between gap-3">
                      <h2 className="truncate text-[14px] font-black uppercase tracking-[-0.025em]">
                        From Your People
                      </h2>
                      <Link
                        to="/following"
                        className="shrink-0 text-[9px] font-semibold text-[var(--wk-text-muted)] hover:text-[var(--wk-text)]"
                      >
                        See All
                      </Link>
                    </div>
                    <FollowingMiniList
                      items={followingItems}
                    />
                  </div>
                ) : null}
              </div>
            </section>

      </main>

      {shareRelease ? (
        <ShareSheet
          item={{
            title: shareRelease.title,
            subtitle:
              shareRelease.artist,
            description:
              shareRelease.description,
            imageUrl:
              shareRelease.artworkUrl,
            url:
              typeof window !==
              "undefined"
                ? `${window.location.origin}${releaseUrl(
                    shareRelease,
                  )}`
                : releaseUrl(
                    shareRelease,
                  ),
            type: "album",
          }}
          open={Boolean(shareRelease)}
          onClose={() =>
            setShareRelease(null)
          }
        />
      ) : null}
    </div>
  );
}
