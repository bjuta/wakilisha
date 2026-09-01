import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { Link } from "react-router-dom";
import { AlbumModal } from "@/components/design-system/releases/AlbumModal";
import type { ModalRelease } from "@/components/design-system/releases/AlbumModal";
import { ShareButton } from "@/components/design-system/share/ShareSheet";
import { WkIcon } from "@/components/design-system/Icon";
import {
  listReleasesPaginated,
  getReleaseCatalogStats,
  getReleaseFilterArtists,
  getReleaseFilterYears,
  getRelease,
  releaseUrl,
  slugify,
  type PublicRelease,
  type ReleaseCatalogStats,
} from "@/services/publicContent/client";
import {
  buildReleaseHeroIntro,
  buildReleaseSeoDescription,
  releaseEmptyStateCopy,
} from "@/services/cultureContext/releaseAdapters";

type Release = PublicRelease;
type SortKey = "newest" | "updated" | "artist" | "title";
type ReleaseTypeFilter = "All" | "Single" | "EP" | "Album";

const ALL = "All";
const INITIAL_LIMIT = 30;
const LOAD_MORE_LIMIT = 20;

function useDebouncedValue<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}

export default function Releases() {
  const [typeFilter, setTypeFilter] = useState<ReleaseTypeFilter>("All");
  const [yearFilter, setYearFilter] = useState(ALL);
  const [artistFilter, setArtistFilter] = useState(ALL);
  const [searchInput, setSearchInput] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("newest");

  const debouncedSearch = useDebouncedValue(searchInput, 350);

  const [releases, setReleases] = useState<Release[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [stats, setStats] = useState<ReleaseCatalogStats>({ total: 0, singles: 0, albums: 0, eps: 0 });
  const [filterArtists, setFilterArtists] = useState<string[]>([]);
  const [filterYears, setFilterYears] = useState<string[]>([]);
  const [featuredReleases, setFeaturedReleases] = useState<Release[]>([]);

  const [pageLoading, setPageLoading] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [metaLoading, setMetaLoading] = useState(true);
  const [pageError, setPageError] = useState<string | null>(null);
  const [metaError, setMetaError] = useState<string | null>(null);

  const [modalRelease, setModalRelease] = useState<Release | null>(null);
  const [modalReleaseDetail, setModalReleaseDetail] = useState<ModalRelease | null>(null);

  const [reloadKey, setReloadKey] = useState(0);

  // Reset data when filters change
  useEffect(() => {
    setReleases([]);
    setTotalCount(0);
    setPageError(null);
    setReloadKey((prev) => prev + 1);
  }, [typeFilter, yearFilter, artistFilter, debouncedSearch, sortKey]);

  const loadMeta = useCallback(async () => {
    setMetaLoading(true);
    setMetaError(null);
    try {
      const [statsData, artists, years, featuredData] = await Promise.all([
        getReleaseCatalogStats(),
        getReleaseFilterArtists(30),
        getReleaseFilterYears(),
        listReleasesPaginated({ offset: 0, limit: 20, sortKey: "newest" }),
      ]);
      setStats(statsData);
      setFilterArtists(artists);
      setFilterYears(years);
      const withArtwork = featuredData.releases.filter(
        (r) => r.artworkUrl && !r.artworkUrl.startsWith("data:image/svg")
      );
      setFeaturedReleases(withArtwork.slice(0, 10));
    } catch (err) {
      setMetaError("Could not load release details.");
    } finally {
      setMetaLoading(false);
    }
  }, []);

  useEffect(() => {
    loadMeta();
  }, [loadMeta]);

  const loadInitial = useCallback(async () => {
    setPageLoading(true);
    setPageError(null);
    try {
      const result = await listReleasesPaginated({
        offset: 0,
        limit: INITIAL_LIMIT,
        typeFilter: typeFilter === "All" ? undefined : typeFilter,
        yearFilter: yearFilter === ALL ? undefined : yearFilter,
        artistFilter: artistFilter === ALL ? undefined : artistFilter,
        search: debouncedSearch || undefined,
        sortKey,
      });
      setReleases(result.releases);
      setTotalCount(result.totalCount);
    } catch (err) {
      setPageError("Could not load releases.");
    } finally {
      setPageLoading(false);
    }
  }, [reloadKey, typeFilter, yearFilter, artistFilter, debouncedSearch, sortKey]);

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      setPageLoading(true);
      setPageError(null);
      try {
        const result = await listReleasesPaginated({
          offset: 0,
          limit: INITIAL_LIMIT,
          typeFilter: typeFilter === "All" ? undefined : typeFilter,
          yearFilter: yearFilter === ALL ? undefined : yearFilter,
          artistFilter: artistFilter === ALL ? undefined : artistFilter,
          search: debouncedSearch || undefined,
          sortKey,
        });
        if (!cancelled) {
          setReleases(result.releases);
          setTotalCount(result.totalCount);
        }
      } catch (err) {
        if (!cancelled) {
          setPageError("Could not load releases.");
        }
      } finally {
        if (!cancelled) setPageLoading(false);
      }
    };
    run();
    return () => { cancelled = true; };
  }, [reloadKey, typeFilter, yearFilter, artistFilter, debouncedSearch, sortKey]);

  useEffect(() => {
    if (!modalRelease) {
      setModalReleaseDetail(null);
      return;
    }

    const artistSlug = slugify(modalRelease.artist);
    let cancelled = false;

    getRelease(artistSlug, modalRelease.slug).then((detail) => {
      if (cancelled) return;
      if (detail && detail.tracks.length > 0) {
        setModalReleaseDetail({
          slug: detail.slug,
          title: detail.title,
          artist: detail.artist,
          releaseType: detail.releaseType,
          year: detail.year,
          labelName: detail.labelName,
          artworkUrl: detail.artworkUrl,
          trackCount: detail.trackCount,
          tracks: detail.tracks.map((t) => ({
            title: t.title,
            duration: formatDurationSeconds(t.duration),
            artists: t.artist,
            previewUrl: t.previewUrl,
          })),
        });
      } else {
        setModalReleaseDetail(null);
      }
    }).catch(() => {
      if (!cancelled) setModalReleaseDetail(null);
    });

    return () => { cancelled = true; };
  }, [modalRelease]);

  const loadMore = useCallback(async () => {
    if (isLoadingMore || releases.length >= totalCount) return;
    setIsLoadingMore(true);
    setPageError(null);
    try {
      const result = await listReleasesPaginated({
        offset: releases.length,
        limit: LOAD_MORE_LIMIT,
        typeFilter: typeFilter === "All" ? undefined : typeFilter,
        yearFilter: yearFilter === ALL ? undefined : yearFilter,
        artistFilter: artistFilter === ALL ? undefined : artistFilter,
        search: debouncedSearch || undefined,
        sortKey,
      });
      setReleases((prev) => [...prev, ...result.releases]);
    } catch (err) {
      setPageError("Could not load more releases.");
    } finally {
      setIsLoadingMore(false);
    }
  }, [releases.length, totalCount, isLoadingMore, typeFilter, yearFilter, artistFilter, debouncedSearch, sortKey]);

  const releaseTypes: ReleaseTypeFilter[] = useMemo(() => ["All", "Single", "EP", "Album"], []);

  const typeCounts: Record<ReleaseTypeFilter, number> = useMemo(() => ({
    All: stats.total,
    Single: stats.singles,
    EP: stats.eps,
    Album: stats.albums,
  }), [stats]);

  const hasMore = releases.length < totalCount && totalCount > 0;
  const showingTo = releases.length;

  const catalogStats = useMemo(() => ({
    total: stats.total,
    visible: totalCount,
    singles: stats.singles,
    albums: stats.albums,
    eps: stats.eps,
  }), [stats, totalCount]);

  if (metaLoading) {
    return <ReleasesLoading />;
  }

  if (metaError && !featuredReleases.length) {
    return (
      <main className="min-h-screen wk-container px-6 py-20 bg-[var(--wk-bg)]">
        <div className="max-w-2xl mx-auto rounded-2xl border border-[var(--wk-border)] bg-[var(--wk-surface)] p-8 text-center">
          <WkIcon name="Disc3" size={42} className="mx-auto mb-4 text-[var(--wk-text-faint)]" />
          <h1 className="wk-h-section mb-2">Could not load releases</h1>
          <p className="text-[var(--wk-text-muted)] mb-6">{metaError}</p>
          <button onClick={loadMeta} className="wk-button wk-button-primary cursor-pointer">
            <i className="ri-refresh-line" /> Retry
          </button>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[var(--wk-bg)]">
      <FeaturedReleaseCarousel
        releases={featuredReleases}
        catalogStats={catalogStats}
        onPreview={setModalRelease}
      />

      <div className="wk-container-wide px-4 py-10 md:px-6">
        <div className="chart-stats-strip mb-10">
          <Stat value={stats.total} label="Releases" />
          <Stat value={totalCount} label="Showing" />
          <Stat value={stats.singles} label="Singles" />
          <Stat value={stats.eps} label="EPs" />
          <Stat value={stats.albums} label="Albums" />
        </div>

        <section className="mb-10 rounded-2xl border border-[var(--wk-border)] bg-[var(--wk-surface)] p-4 md:p-5">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between mb-5">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-[var(--wk-brand)]/20 bg-[var(--wk-brand-soft)]/40 px-3 py-1 text-[11px] font-extrabold uppercase tracking-[0.18em] text-[var(--wk-brand)] mb-3">
                <WkIcon name="Search" size={12} />
                Discovery
              </div>
              <h2 className="text-[clamp(22px,3vw,32px)] font-black leading-[0.92] tracking-[-0.04em] text-[var(--wk-text)]">
                Find releases
              </h2>
            </div>
            <div className="flex items-center gap-1.5 p-1 rounded-full border border-[var(--wk-border)] bg-[var(--wk-bg)]">
              {releaseTypes.map((f) => (
                <button
                  key={f}
                  onClick={() => setTypeFilter(f)}
                  className={`rounded-full px-4 py-1.5 text-[12px] font-bold transition-all whitespace-nowrap cursor-pointer ${
                    typeFilter === f
                      ? "bg-[var(--wk-brand)] text-white"
                      : "text-[var(--wk-text-muted)] hover:text-[var(--wk-text)]"
                  }`}
                >
                  {f}
                  <span className={`ml-1 text-[11px] ${typeFilter === f ? "text-white/60" : "text-[var(--wk-text-faint)]"}`}>
                    {typeCounts[f]}
                  </span>
                </button>
              ))}
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-[minmax(0,1.4fr)_repeat(2,minmax(0,0.8fr))]">
            <label className="block">
              <span className="sr-only">Search releases</span>
              <div className="flex items-center gap-2 rounded-xl border border-[var(--wk-border)] bg-[var(--wk-bg)] px-3 py-2.5">
                <WkIcon name="Search" size={15} className="text-[var(--wk-text-faint)]" />
                <input
                  value={searchInput}
                  onChange={(event) => setSearchInput(event.target.value)}
                  placeholder="Search title, artist, label..."
                  className="w-full bg-transparent text-[14px] font-semibold text-[var(--wk-text)] outline-none placeholder:text-[var(--wk-text-faint)]"
                />
                {searchInput && (
                  <button
                    onClick={() => setSearchInput("")}
                    className="text-[var(--wk-text-faint)] hover:text-[var(--wk-text)] cursor-pointer"
                    aria-label="Clear search"
                  >
                    <WkIcon name="X" size={14} />
                  </button>
                )}
              </div>
            </label>
            <FilterSelect label="Year" value={yearFilter} options={[ALL, ...filterYears]} onChange={setYearFilter} />
            <FilterSelect label="Sort" value={sortKey} options={["newest", "updated", "artist", "title"]} onChange={(value) => setSortKey(value as SortKey)} />
          </div>

          <div className="mt-3 flex flex-wrap gap-1.5">
            {filterArtists.map((artist) => (
              <button
                key={artist}
                onClick={() => setArtistFilter(artist)}
                className={`rounded-full px-3 py-1 text-[11px] font-bold transition-all whitespace-nowrap border cursor-pointer ${
                  artistFilter === artist
                    ? "bg-[var(--wk-brand)] border-[var(--wk-brand)] text-white"
                    : "border-[var(--wk-border)] bg-[var(--wk-bg)] text-[var(--wk-text-muted)] hover:text-[var(--wk-text)] hover:border-[var(--wk-border-2)]"
                }`}
              >
                {artist}
              </button>
            ))}
          </div>
        </section>

        <section>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between mb-6">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-[var(--wk-brand)]/20 bg-[var(--wk-brand-soft)]/40 px-3 py-1 text-[11px] font-extrabold uppercase tracking-[0.18em] text-[var(--wk-brand)] mb-3">
                <WkIcon name="Disc3" size={12} />
                Release shelf
              </div>
              <h2 className="text-[clamp(22px,3vw,32px)] font-black leading-[0.92] tracking-[-0.04em] text-[var(--wk-text)]">
                All releases
              </h2>
            </div>
            <p className="text-[12px] font-semibold text-[var(--wk-text-muted)]">
              {totalCount > 0
                ? `Showing ${showingTo} of ${totalCount}`
                : "No releases found"}
            </p>
          </div>

          {pageLoading ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4 md:gap-5">
              {Array.from({ length: INITIAL_LIMIT }).map((_, i) => (
                <div key={i} className="space-y-3">
                  <div className="aspect-square rounded-xl border border-[var(--wk-border)] bg-[var(--wk-surface)] animate-pulse" />
                  <div className="h-3 w-3/4 rounded bg-[var(--wk-surface-raised)] animate-pulse" />
                  <div className="h-3 w-1/2 rounded bg-[var(--wk-surface-raised)] animate-pulse" />
                </div>
              ))}
            </div>
          ) : pageError ? (
            <div className="rounded-2xl border border-[var(--wk-border)] bg-[var(--wk-surface)] p-12 text-center">
              <WkIcon name="Disc3" size={36} className="mx-auto text-[var(--wk-text-faint)]" />
              <p className="mt-4 text-[15px] font-semibold text-[var(--wk-text-muted)]">{pageError}</p>
              <button onClick={loadInitial} className="wk-button wk-button-sm wk-button-primary mt-5 cursor-pointer">
                <i className="ri-refresh-line" /> Retry
              </button>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4 md:gap-5">
                {releases.map((release) => (
                  <ReleaseArtworkCard
                    key={`${release.artist}-${release.slug}`}
                    release={release}
                    onPreview={setModalRelease}
                  />
                ))}
              </div>

              {hasMore && (
                <div className="mt-10 flex justify-center">
                  <button
                    onClick={loadMore}
                    disabled={isLoadingMore}
                    className="wk-button wk-button-primary cursor-pointer whitespace-nowrap disabled:opacity-50"
                  >
                    {isLoadingMore ? (
                      <>
                        <i className="ri-loader-4-line animate-spin" /> Loading...
                      </>
                    ) : (
                      <>
                        <i className="ri-arrow-down-line" /> Load more
                      </>
                    )}
                  </button>
                </div>
              )}

              {releases.length === 0 && (
                <ReleaseEmptyState onClear={() => { setSearchInput(""); setTypeFilter("All"); setYearFilter(ALL); setArtistFilter(ALL); setSortKey("newest"); }} />
              )}
            </>
          )}
        </section>
      </div>

      <AlbumModal
        open={Boolean(modalRelease)}
        release={modalReleaseDetail || (modalRelease ? {
          slug: modalRelease.slug,
          title: modalRelease.title,
          artist: modalRelease.artist,
          releaseType: modalRelease.releaseType,
          year: modalRelease.year,
          labelName: modalRelease.labelName,
          artworkUrl: modalRelease.artworkUrl,
          trackCount: modalRelease.trackCount,
        } : null)}
        onClose={() => { setModalRelease(null); setModalReleaseDetail(null); }}
      />
    </main>
  );
}

function ReleaseArtworkCard({ release, onPreview }: { release: Release; onPreview: (release: Release) => void }) {
  const displayYear = yearValue(release.year);
  const typeLabel = release.releaseType || "Release";
  const href = releaseUrl(release);

  return (
    <div className="group flex flex-col">
      <Link to={href} className="relative aspect-square rounded-xl overflow-hidden bg-[var(--wk-bg)] border border-[var(--wk-border)] mb-3">
        <ReleaseArtworkImage release={release} />
        <div className="absolute top-2.5 left-2.5">
          <span className="inline-flex items-center rounded-full bg-black/50 px-2 py-0.5 text-[9px] font-extrabold uppercase tracking-[0.12em] text-white backdrop-blur-sm">
            {typeLabel}
          </span>
        </div>
        {release.trackCount !== undefined && release.trackCount > 0 && (
          <div className="absolute bottom-2.5 right-2.5">
            <span className="inline-flex items-center rounded-full bg-black/50 px-2 py-0.5 text-[9px] font-bold text-white/80 backdrop-blur-sm">
              {release.trackCount} {release.trackCount === 1 ? "track" : "tracks"}
            </span>
          </div>
        )}
        {release.trackCount > 1 ? (
          <div className="absolute inset-0 flex items-center justify-center bg-black/0 group-hover:bg-black/30 transition-colors duration-300">
            <button
              onClick={(e) => { e.preventDefault(); onPreview(release); }}
              className="opacity-0 group-hover:opacity-100 translate-y-1 group-hover:translate-y-0 transition-all duration-200 inline-flex items-center gap-1.5 rounded-full bg-white/90 px-3.5 py-2 text-[11px] font-extrabold text-black backdrop-blur cursor-pointer whitespace-nowrap"
            >
              <WkIcon name="Eye" size={12} />
              Look inside
            </button>
          </div>
        ) : null}
      </Link>

      <Link to={href} className="text-[13px] font-extrabold text-[var(--wk-text)] group-hover:text-[var(--wk-brand)] transition-colors leading-tight truncate">
        {release.title}
      </Link>
      <div className="text-[12px] font-bold text-[var(--wk-text)] truncate mt-0.5">
        {release.artist}{displayYear ? ` \u00b7 ${displayYear}` : ""}
      </div>
    </div>
  );
}

function ReleaseEmptyState({ onClear }: { onClear: () => void }) {
  const empty = releaseEmptyStateCopy(true);
  return (
    <div className="rounded-2xl border border-dashed border-[var(--wk-border)] p-20 text-center">
      <WkIcon name="Disc3" size={36} className="mx-auto text-[var(--wk-text-faint)]" />
      <h3 className="mt-4 text-[20px] font-black text-[var(--wk-text)]">{empty.title}</h3>
      <p className="mx-auto mt-2 max-w-md text-[14px] font-semibold leading-relaxed text-[var(--wk-text-muted)]">
        {empty.body}
      </p>
      <button
        onClick={onClear}
        className="wk-button wk-button-sm wk-button-primary mt-5 cursor-pointer"
      >
        {empty.action}
      </button>
    </div>
  );
}

function ReleaseArtworkImage({ release }: { release: Release }) {
  const [failed, setFailed] = useState(false);

  if (release.artworkUrl && !failed) {
    return (
      <img
        src={release.artworkUrl}
        alt={release.title}
        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
        onError={() => setFailed(true)}
      />
    );
  }

  const initial = (release.title || "W").trim()[0]?.toUpperCase() || "W";
  return (
    <div className="relative flex h-full w-full flex-col justify-between overflow-hidden bg-[linear-gradient(135deg,#f7f9f1_0%,#dfe8d6_54%,#7fa64a_100%)] p-4 text-[#101510]">
      <div className="absolute -right-8 -top-8 h-24 w-24 rounded-full bg-white/25" />
      <div className="absolute -bottom-10 -left-10 h-32 w-32 rounded-full bg-black/10" />
      <div className="relative z-10 text-[9px] font-black uppercase tracking-[0.28em] text-[#30451f]">WAKILISHA</div>
      <div className="relative z-10">
        <div className="mb-2 text-[44px] font-black leading-none tracking-[-0.08em]">{initial}</div>
        <div className="line-clamp-2 text-[13px] font-black leading-[0.95] tracking-[-0.04em]">{release.title}</div>
      </div>
    </div>
  );
}

function FeaturedReleaseCarousel({ releases, catalogStats, onPreview }: { releases: Release[]; catalogStats: { total: number; visible: number; singles: number; albums: number; eps: number }; onPreview: (release: Release) => void }) {
  const [activeIndex, setActiveIndex] = useState(0);
  const scrollerRef = useRef<HTMLDivElement>(null);
  const active = releases[activeIndex] || releases[0];

  useEffect(() => setActiveIndex(0), [releases]);

  const scrollTo = (index: number) => {
    const nextIndex = Math.max(0, Math.min(index, releases.length - 1));
    setActiveIndex(nextIndex);
    const slide = scrollerRef.current?.children[nextIndex] as HTMLElement | undefined;
    slide?.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
  };

  if (!active) return null;

  const activeIntro = buildReleaseHeroIntro(active);
  const shareDescription = buildReleaseSeoDescription(active);

  return (
    <section className="relative min-h-[78vh] overflow-hidden border-b border-[var(--wk-border)] bg-[#0d120a] text-white">
      <CarouselBackground release={active} />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_12%_20%,rgba(133,196,65,0.32),transparent_34%),linear-gradient(90deg,rgba(0,0,0,0.82)_0%,rgba(0,0,0,0.58)_42%,rgba(0,0,0,0.24)_100%)]" />
      <div className="relative z-10 flex min-h-[78vh] flex-col justify-end">
        <div className="wk-container-wide w-full px-4 pb-8 pt-24 md:px-6 lg:pb-12 lg:pt-32">
          <div className="grid items-end gap-8 lg:grid-cols-[minmax(0,1fr)_420px]">
            <div className="max-w-4xl">
              <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1.5 text-[11px] font-extrabold uppercase tracking-[0.18em] text-white/85 backdrop-blur">
                <WkIcon name="Sparkles" size={13} /> Release shelf
              </div>
              <h1 className="font-[var(--wk-font-display)] text-[clamp(56px,9vw,128px)] font-black leading-[0.82] tracking-[-0.075em] text-white drop-shadow-2xl">
                Singles, EPs, and albums
              </h1>
              <p className="mt-6 max-w-2xl text-[17px] font-semibold leading-[1.75] text-white/74 md:text-[19px]">
                Browse the records moving through WAKILISHA. New drops, older gems, and releases that deserve more love.
              </p>
              <div className="mt-7 flex flex-wrap items-center gap-3 text-[12px] font-extrabold text-white/82">
                <span className="inline-flex items-center gap-2 rounded-full border border-white/16 bg-white/10 px-3 py-2 backdrop-blur">
                  <WkIcon name="Disc3" size={14} /> {catalogStats.total} releases
                </span>
                <span className="inline-flex items-center gap-2 rounded-full border border-white/16 bg-white/10 px-3 py-2 backdrop-blur">
                  <WkIcon name="ListFilter" size={14} /> {catalogStats.visible} showing
                </span>
                <span className="inline-flex items-center gap-2 rounded-full border border-white/16 bg-white/10 px-3 py-2 backdrop-blur">
                  <WkIcon name="Music" size={14} /> {catalogStats.singles} singles
                </span>
                <span className="inline-flex items-center gap-2 rounded-full border border-white/16 bg-white/10 px-3 py-2 backdrop-blur">
                  <WkIcon name="ListMusic" size={14} /> {catalogStats.eps} EPs
                </span>
                <span className="inline-flex items-center gap-2 rounded-full border border-white/16 bg-white/10 px-3 py-2 backdrop-blur">
                  <WkIcon name="Album" size={14} /> {catalogStats.albums} albums
                </span>
              </div>
            </div>
            <div className="rounded-[28px] border border-white/16 bg-black/24 p-4 shadow-2xl backdrop-blur-xl">
              <div className="aspect-square overflow-hidden rounded-2xl bg-white/10">
                <ReleaseArtworkImage release={active} />
              </div>
              <div className="mt-4">
                <div className="text-[11px] font-extrabold uppercase tracking-[0.18em] text-[var(--wk-brand)]">Featured release</div>
                <h2 className="mt-1 line-clamp-2 text-[30px] font-black leading-[0.95] tracking-[-0.05em] text-white">{active.title}</h2>
                <div className="mt-3 text-[13px] font-bold text-white/70">
                  {active.artist} \u00b7 {yearValue(active.year) || "Unknown year"} \u00b7 {trackCountLabel(active.trackCount)}
                </div>
                <p className="mt-3 line-clamp-3 text-[13px] font-semibold leading-relaxed text-white/72">
                  {activeIntro}
                </p>
                <div className="mt-4 flex flex-wrap gap-2">
                  {active.trackCount > 1 ? (
                    <button onClick={() => onPreview(active)} className="wk-button wk-button-primary cursor-pointer whitespace-nowrap">
                      <WkIcon name="Eye" size={15} /> Look inside
                    </button>
                  ) : null}
                  <Link to={releaseUrl(active)} className="wk-button wk-button-ghost border-white/20 bg-white/10 text-white hover:bg-white/16 whitespace-nowrap">
                    <WkIcon name="ArrowUpRight" size={15} /> {active.trackCount === 1 ? "Open track" : "Open"}
                  </Link>
                  <ShareButton item={{ title: active.title, subtitle: active.artist, description: shareDescription, imageUrl: active.artworkUrl, type: "album" }} />
                </div>
              </div>
            </div>
          </div>
          <div className="mt-10">
            <div ref={scrollerRef} className="flex snap-x gap-3 overflow-x-auto pb-3 scrollbar-hide">
              {releases.map((r, index) => (
                <button
                  key={`${r.artist}-${r.slug}`}
                  onClick={() => scrollTo(index)}
                  className={`group relative h-28 w-[220px] shrink-0 snap-start overflow-hidden rounded-2xl border text-left transition-all md:w-[260px] cursor-pointer ${
                    activeIndex === index
                      ? "border-[var(--wk-brand)] shadow-[0_0_0_1px_var(--wk-brand)]"
                      : "border-white/16 hover:border-white/35"
                  }`}
                >
                  <div className="absolute inset-0"><ReleaseArtworkImage release={r} /></div>
                  <div className="absolute inset-0 bg-gradient-to-t from-black/88 via-black/38 to-transparent" />
                  <div className="absolute inset-x-0 bottom-0 p-3">
                    <div className="line-clamp-1 text-[14px] font-black text-white">{r.title}</div>
                    <div className="line-clamp-1 text-[11px] font-bold text-white/70">{r.artist}</div>
                  </div>
                </button>
              ))}
            </div>
            <div className="mt-3 flex items-center justify-between gap-4">
              <div className="flex gap-2">
                {releases.map((r, index) => (
                  <button
                    key={`dot-${r.slug}-${index}`}
                    aria-label={`Show ${r.title}`}
                    onClick={() => scrollTo(index)}
                    className={`h-2 rounded-full transition-all cursor-pointer ${
                      activeIndex === index ? "w-8 bg-[var(--wk-brand)]" : "w-2 bg-white/35 hover:bg-white/65"
                    }`}
                  />
                ))}
              </div>
              <div className="flex gap-2">
                <button onClick={() => scrollTo(activeIndex - 1)} className="rounded-full border border-white/18 bg-white/10 p-2 text-white backdrop-blur hover:bg-white/16 cursor-pointer" aria-label="Previous featured release">
                  <WkIcon name="ChevronLeft" size={18} />
                </button>
                <button onClick={() => scrollTo(activeIndex + 1)} className="rounded-full border border-white/18 bg-white/10 p-2 text-white backdrop-blur hover:bg-white/16 cursor-pointer" aria-label="Next featured release">
                  <WkIcon name="ChevronRight" size={18} />
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function ReleasesLoading() {
  return (
    <main className="min-h-screen bg-[var(--wk-bg)]">
      <section className="relative overflow-hidden border-b border-[var(--wk-border)] bg-[var(--wk-bg)]">
        <div className="wk-container-wide px-4 py-20 md:px-6 lg:py-28">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <div className="space-y-4">
              <div className="h-4 w-40 rounded bg-[var(--wk-surface-raised)] animate-pulse" />
              <div className="h-16 w-3/4 rounded bg-[var(--wk-surface-raised)] animate-pulse" />
              <div className="h-4 w-1/2 rounded bg-[var(--wk-surface-raised)] animate-pulse" />
              <div className="h-4 w-2/3 rounded bg-[var(--wk-surface-raised)] animate-pulse" />
            </div>
            <div className="h-72 rounded-2xl bg-[var(--wk-surface-raised)] animate-pulse" />
          </div>
        </div>
      </section>
      <div className="wk-container-wide px-4 py-10 md:px-6">
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
          {Array.from({ length: 15 }).map((_, i) => (
            <div key={i} className="space-y-3">
              <div className="aspect-square rounded-xl border border-[var(--wk-border)] bg-[var(--wk-surface)] animate-pulse" />
              <div className="h-3 w-3/4 rounded bg-[var(--wk-surface-raised)] animate-pulse" />
              <div className="h-3 w-1/2 rounded bg-[var(--wk-surface-raised)] animate-pulse" />
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}

function FilterSelect({ label, value, options, onChange }: { label: string; value: string; options: string[]; onChange: (value: string) => void }) {
  return (
    <label className="block">
      <span className="mb-1 block text-[10px] font-extrabold uppercase tracking-[0.16em] text-[var(--wk-text-faint)]">{label}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="w-full rounded-xl border border-[var(--wk-border)] bg-[var(--wk-bg)] px-3 py-2.5 text-[13px] font-bold text-[var(--wk-text)] outline-none cursor-pointer"
      >
        {options.map((option) => (
          <option key={option} value={option}>{optionLabel(option)}</option>
        ))}
      </select>
    </label>
  );
}

function Stat({ value, label }: { value: string | number; label: string }) {
  return <div className="chart-stat-card"><div className="chart-stat-value">{value}</div><div className="chart-stat-label">{label}</div></div>;
}

function yearValue(value: string): string {
  if (!value || value === "Unknown year") return "";
  return value.match(/\d{4}/)?.[0] || "";
}

function optionLabel(value: string): string {
  if (value === "newest") return "Newest";
  if (value === "updated") return "Recently updated";
  if (value === "artist") return "Artist A-Z";
  if (value === "title") return "Title A-Z";
  return value;
}

function trackCountLabel(count: number): string {
  if (!count) return "Tracklist coming soon";
  return `${count} track${count === 1 ? "" : "s"}`;
}

function CarouselBackground({ release }: { release: Release }) {
  const [failed, setFailed] = useState(false);
  if (!release.artworkUrl || failed) {
    return <div className="absolute inset-0 bg-[radial-gradient(circle_at_18%_75%,rgba(133,196,65,0.42),transparent_32%),radial-gradient(circle_at_82%_16%,rgba(255,255,255,0.20),transparent_30%),linear-gradient(135deg,#101510,#1d2f12)]" />;
  }
  return (
    <>
      <img src={release.artworkUrl} alt="" className="hidden" onError={() => setFailed(true)} />
      <div className="absolute inset-0 scale-105 bg-cover bg-center opacity-75 blur-[2px]" style={{ backgroundImage: `url("${release.artworkUrl}")` }} />
    </>
  );
}

function formatDurationSeconds(seconds: number): string {
  if (!seconds || seconds <= 0) return "";
  const min = Math.floor(seconds / 60);
  const sec = seconds % 60;
  return `${min}:${String(sec).padStart(2, "0")}`;
}