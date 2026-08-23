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
import {
  usePlayer,
  type PlayerTrack,
} from "@/context/PlayerContext";
import {
  getRelease,
  listArtists,
  listReleasesPaginated,
  releaseUrl,
  slugify,
  type PublicArtist,
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
}: {
  src?: string | null;
  alt: string;
  className?: string;
}) {
  if (!src) {
    return (
      <div
        className={`flex h-full w-full items-end bg-[radial-gradient(circle_at_25%_20%,rgba(112,255,70,0.22),transparent_36%),linear-gradient(145deg,#262626,#090909)] p-3 ${className}`}
      >
        <span className="text-[11px] font-black leading-tight text-[var(--wk-text)]/65">
          {alt}
        </span>
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={alt}
      loading="lazy"
      className={`h-full w-full object-cover ${className}`}
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
    <article className="group flex min-w-[260px] flex-1 overflow-hidden rounded-xl border border-[var(--wk-border)] bg-[var(--wk-surface-raised)] transition hover:bg-[var(--wk-surface-strong)]">
      <PlayableArtwork
        label={release.title}
        onPlay={(event) => {
          event.stopPropagation();
          onPlay(release, "fresh-arrivals");
        }}
        isPlaying={active}
        pending={busy}
        className="h-[88px] w-[88px]"
        iconClassName="h-9 w-9 text-[15px]"
      >
        <MusicArtwork
          src={release.artworkUrl}
          alt=""
          className="transition-transform duration-500 group-hover:scale-[1.04]"
        />
      </PlayableArtwork>

      <div className="flex min-w-0 flex-1 items-center gap-2 p-3">
        <div className="min-w-0 flex-1">
          <Link
            to={releaseUrl(release)}
            className="block truncate text-[12px] font-black text-[var(--wk-text)] transition hover:text-[var(--wk-brand)]"
          >
            {release.title}
          </Link>
          <Link
            to={`/artists/${slugify(release.artist)}`}
            className="mt-1 block truncate text-[10px] font-semibold text-[var(--wk-text-soft)] hover:text-[var(--wk-text)]"
          >
            {release.artist}
          </Link>
          <p className="mt-1.5 truncate text-[9px] font-bold uppercase tracking-[0.08em] text-[var(--wk-text-muted)]">
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
          <div className="mb-2 text-[9px] font-black uppercase tracking-[0.16em] text-[var(--wk-brand)]">
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
        className="transition-transform duration-700 group-hover:scale-[1.035]"
      />
      <div className="absolute inset-0 bg-gradient-to-t from-black/95 via-black/40 to-black/5" />
      <div className="absolute inset-x-0 bottom-0 p-4">
        <div className="mb-2 text-[9px] font-black uppercase tracking-[0.16em] text-[var(--wk-brand)]">
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
        className="flex h-[260px] items-center justify-center rounded-xl border border-[var(--wk-border)] bg-[var(--wk-surface)] px-5 text-center text-[11px] font-semibold text-[var(--wk-text-muted)] transition hover:bg-[var(--wk-surface-raised)] hover:text-[var(--wk-text-soft)]"
      >
        Open the latest WAKILISHA charts
      </Link>
    );
  }

  return (
    <div className="space-y-2">
      {entries.slice(0, 3).map((entry) => (
        <div
          key={entry.id}
          className="flex items-center gap-2 rounded-lg border border-[var(--wk-border)] bg-[var(--wk-surface)] p-2"
        >
          <div className="w-5 shrink-0 text-center text-[12px] font-black text-[var(--wk-text-muted)]">
            {entry.rank}
          </div>
          <div className="h-10 w-10 shrink-0 overflow-hidden rounded-md bg-[var(--wk-surface-raised)]">
            <MusicArtwork
              src={entry.artworkUrl}
              alt={entry.trackTitle}
            />
          </div>
          <div className="min-w-0 flex-1">
            <div className="truncate text-[10px] font-black text-[var(--wk-text)]">
              {entry.trackTitle}
            </div>
            <div className="mt-0.5 truncate text-[9px] font-semibold text-[var(--wk-text-soft)]">
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
        className="flex h-[260px] flex-col items-center justify-center rounded-xl border border-[var(--wk-border)] bg-[var(--wk-surface)] px-5 text-center"
      >
        <WkIcon
          name="Users"
          size={19}
          className="mb-3 text-[var(--wk-brand)]"
        />
        <div className="text-[11px] font-black text-[var(--wk-text)]">
          Your people, here.
        </div>
        <p className="mt-2 max-w-[24ch] text-[10px] font-medium leading-relaxed text-[var(--wk-text-muted)]">
          Follow Artists and people to bring their new music and Posts into this space.
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

function DeepCard({
  to,
  title,
  body,
  icon,
  image,
}: {
  to: string;
  title: string;
  body: string;
  icon: Parameters<typeof WkIcon>[0]["name"];
  image?: string | null;
}) {
  return (
    <Link
      to={to}
      className="group relative min-h-[118px] overflow-hidden rounded-xl border border-[var(--wk-border)] bg-[var(--wk-surface)] p-4"
    >
      {image ? (
        <>
          <MusicArtwork
            src={image}
            alt=""
            className="absolute inset-0 opacity-45 transition-transform duration-700 group-hover:scale-[1.05]"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-black/95 via-black/76 to-black/38" />
        </>
      ) : null}

      <div className="relative">
        <WkIcon
          name={icon}
          size={15}
          className="mb-4 text-[var(--wk-brand)]"
        />
        <h3
          className={[
            "text-[13px] font-black",
            image
              ? "text-white drop-shadow-[0_1px_6px_rgba(0,0,0,0.44)]"
              : "text-[var(--wk-text)]",
          ].join(" ")}
        >
          {title}
        </h3>
        <p
          className={[
            "mt-1 text-[9px] font-semibold",
            image
              ? "text-white/76 drop-shadow-[0_1px_5px_rgba(0,0,0,0.4)]"
              : "text-[var(--wk-text-muted)]",
          ].join(" ")}
        >
          {body}
        </p>
      </div>

      <WkIcon
        name="ChevronRight"
        size={15}
        className={[
          "absolute bottom-4 right-4 transition-transform group-hover:translate-x-0.5",
          image
            ? "text-white/68"
            : "text-[var(--wk-text-muted)]",
        ].join(" ")}
      />
    </Link>
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
            3,
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
  const [followingItems, setFollowingItems] =
    useState<FollowingFeedItem[]>([]);
  const [loading, setLoading] =
    useState(true);
  const [busyReleaseId, setBusyReleaseId] =
    useState<string | null>(null);

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

  const activeReleaseTitle =
    currentTrack?.album || null;

  const handlePlayRelease =
    useCallback(
      async (
        release: PublicRelease,
        sourceSection: string,
      ) => {
        if (
          activeReleaseTitle ===
            release.title &&
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
        activeReleaseTitle,
        currentTrack,
        navigate,
        playTrack,
        togglePlay,
      ],
    );

  return (
    <div className="min-h-screen bg-[var(--wk-bg)] text-[var(--wk-text)]">
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
            <section className="wk-music-hero relative min-h-[430px] overflow-hidden border-b border-[var(--wk-border)] bg-[#0a0a0a]">
              {hero ? (
                <>
                  <div className="absolute inset-0">
                    <MusicArtwork
                      src={hero.artworkUrl}
                      alt={`${hero.title} artwork`}
                      className="object-cover object-center opacity-75"
                    />
                    <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(4,4,4,0.98)_0%,rgba(4,4,4,0.86)_29%,rgba(4,4,4,0.18)_67%,rgba(4,4,4,0.62)_100%)]" />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/20" />
                  </div>

                  <div className="relative grid min-h-[430px] gap-8 px-5 py-8 sm:px-8 xl:grid-cols-[minmax(0,1fr)_290px] xl:items-center xl:px-10">
                    <div className="max-w-[720px] self-center">
                      <div className="mb-4 inline-flex items-center rounded bg-[var(--wk-brand)]/10 px-2 py-1 text-[9px] font-black uppercase tracking-[0.15em] text-[var(--wk-brand)]">
                        Now Playing At WAKILISHA
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
                        <WkIcon
                          name="BadgeCheck"
                          size={17}
                          className="text-[var(--wk-brand)]"
                        />
                      </Link>

                      <p className="mt-3 max-w-[42ch] text-[13px] font-medium leading-relaxed text-[var(--wk-text-muted)]">
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
                                : activeReleaseTitle ===
                                      hero.title &&
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
                              activeReleaseTitle ===
                                hero.title &&
                              isPlaying
                                ? "none"
                                : "currentColor"
                            }
                          />
                          {activeReleaseTitle ===
                            hero.title &&
                          isPlaying
                            ? "Pause"
                            : "Play"}
                        </button>

                        <Link
                          to={releaseUrl(
                            hero,
                          )}
                          className="flex h-10 w-10 items-center justify-center rounded-full border border-[var(--wk-border-strong)] bg-black/20 text-[var(--wk-text-soft)] backdrop-blur transition hover:bg-white/10 hover:text-[var(--wk-text)]"
                          aria-label="Open release"
                        >
                          <WkIcon
                            name="Plus"
                            size={16}
                          />
                        </Link>

                        <button
                          type="button"
                          onClick={() =>
                            navigator.clipboard?.writeText(
                              `${window.location.origin}${releaseUrl(
                                hero,
                              )}`,
                            )
                          }
                          className="flex h-10 w-10 items-center justify-center rounded-full border border-[var(--wk-border-strong)] bg-black/20 text-[var(--wk-text-soft)] backdrop-blur transition hover:bg-white/10 hover:text-[var(--wk-text)]"
                          aria-label="Copy release link"
                        >
                          <WkIcon
                            name="Share2"
                            size={15}
                          />
                        </button>
                      </div>
                    </div>

                    <div className="hidden xl:block">
                      <div className="rounded-xl border border-[var(--wk-border)] bg-black/55 p-4 shadow-2xl backdrop-blur-xl">
                        <div className="text-[9px] font-black uppercase tracking-[0.14em] text-[var(--wk-text-faint)]">
                          In Focus
                        </div>
                        <div className="mt-2 text-[18px] font-black text-[var(--wk-text)]">
                          {hero.artist}
                        </div>
                        <div className="mt-1 text-[11px] font-medium text-[var(--wk-text-muted)]">
                          {hero.releaseType ||
                            "Release"}
                        </div>

                        <div className="mt-4 flex items-center gap-3">
                          <div className="h-[104px] w-[104px] shrink-0 overflow-hidden rounded-lg">
                            <MusicArtwork
                              src={
                                hero.artworkUrl
                              }
                              alt={`${hero.title} artwork`}
                            />
                          </div>
                          <div className="min-w-0">
                            <div className="text-[9px] font-black uppercase tracking-[0.12em] text-[var(--wk-text-faint)]">
                              Featured Release
                            </div>
                            <div className="mt-1 line-clamp-2 text-[13px] font-black leading-tight text-[var(--wk-text)]">
                              {hero.title}
                            </div>
                            <div className="mt-2 text-[9px] font-medium text-[var(--wk-text-faint)]">
                              {hero.labelName ||
                                "From The Registry"}
                            </div>
                          </div>
                        </div>

                        <Link
                          to={releaseUrl(
                            hero,
                          )}
                          className="mt-4 flex h-10 items-center justify-center gap-2 rounded-lg border border-[var(--wk-border-2)] text-[10px] font-bold text-[var(--wk-text-soft)] transition hover:bg-[var(--wk-surface-raised)]"
                        >
                          Explore Feature
                          <WkIcon
                            name="ChevronRight"
                            size={13}
                          />
                        </Link>
                      </div>
                    </div>
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

                <div className="hidden gap-2 sm:flex">
                  <button
                    type="button"
                    aria-label="Previous arrivals"
                    className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--wk-surface-raised)] text-[var(--wk-text-muted)]"
                  >
                    <WkIcon
                      name="ChevronLeft"
                      size={14}
                    />
                  </button>
                  <button
                    type="button"
                    aria-label="Next arrivals"
                    className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--wk-surface-raised)] text-[var(--wk-text-muted)]"
                  >
                    <WkIcon
                      name="ChevronRight"
                      size={14}
                    />
                  </button>
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
                        activeReleaseTitle ===
                          release.title &&
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
                      footer="Next up. Watch this space."
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

                {chartEntries.length ? (
                  <div className="min-w-[262px] flex-[1_0_262px] lg:max-w-[330px]">
                    <div className="mb-3 flex items-center justify-between gap-3">
                      <h2 className="truncate text-[14px] font-black uppercase tracking-[-0.025em]">
                        On The Charts
                      </h2>
                      <Link
                        to="/charts"
                        className="shrink-0 text-[9px] font-semibold text-[var(--wk-text-muted)] hover:text-[var(--wk-text)]"
                      >
                        See All
                      </Link>
                    </div>
                    <ChartMiniList
                      entries={chartEntries}
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

            <section
              id="go-deeper"
              className="px-5 py-5 sm:px-8"
            >
              <h2 className="mb-4 text-[17px] font-black uppercase tracking-[-0.03em]">
                Go Deeper
              </h2>

              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
                <DeepCard
                  to="/charts"
                  title="Charts"
                  body="See what is moving."
                  icon="ChartNoAxesColumnIncreasing"
                  image={
                    freshArrivals[0]
                      ?.artworkUrl
                  }
                />
                <DeepCard
                  to="/playlists"
                  title="Playlists"
                  body="Curated for the moment."
                  icon="ListMusic"
                  image={
                    featuredPlaylist?.coverUrl
                  }
                />
                <DeepCard
                  to="/artists"
                  title="Artists"
                  body="Discover more Artists."
                  icon="Users"
                  image={
                    registryArtist?.imageUrl
                  }
                />
                <DeepCard
                  to="/magazine"
                  title="Stories"
                  body="Long reads and interviews."
                  icon="Newspaper"
                  image={
                    heroArtist?.imageUrl
                  }
                />
                <DeepCard
                  to="/releases"
                  title="Releases"
                  body="Keep digging into the catalog."
                  icon="Disc3"
                  image={
                    freshArrivals[1]
                      ?.artworkUrl
                  }
                />
              </div>
            </section>
      </main>
    </div>
  );
}
