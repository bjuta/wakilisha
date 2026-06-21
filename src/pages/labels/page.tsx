import { useState, useEffect, useCallback, useRef } from "react";
import { Link } from "react-router-dom";
import { ShareButton } from "@/components/design-system/share/ShareSheet";
import { WkIcon } from "@/components/design-system/Icon";
import { Chapter19FallbackImage } from "@/components/media/Chapter19FallbackImage";
import {
  listLabelsPaginated,
  getLabelCatalogStats,
  type PublicLabel,
  type LabelCatalogStats,
} from "@/services/publicContent/client";

type SortKey = "prominence" | "name" | "artists" | "releases";

const ALL = "All";
const INITIAL_LIMIT = 24;
const LOAD_MORE_LIMIT = 20;

function useDebouncedValue<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}

export default function Labels() {
  const [country, setCountry] = useState(ALL);
  const [searchInput, setSearchInput] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("prominence");

  const debouncedSearch = useDebouncedValue(searchInput, 350);

  const [labels, setLabels] = useState<PublicLabel[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [stats, setStats] = useState<LabelCatalogStats>({ total: 0, totalArtists: 0, totalReleases: 0, featuredCount: 0, countries: [] });
  const [featuredLabels, setFeaturedLabels] = useState<PublicLabel[]>([]);

  const [pageLoading, setPageLoading] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [metaLoading, setMetaLoading] = useState(true);
  const [pageError, setPageError] = useState<string | null>(null);
  const [metaError, setMetaError] = useState<string | null>(null);

  const [reloadKey, setReloadKey] = useState(0);

  // Reset data when filters change
  useEffect(() => {
    setLabels([]);
    setTotalCount(0);
    setPageError(null);
    setReloadKey((prev) => prev + 1);
  }, [country, debouncedSearch, sortKey]);

  const loadMeta = useCallback(async () => {
    setMetaLoading(true);
    setMetaError(null);
    try {
      const [statsData, topLabels] = await Promise.all([
        getLabelCatalogStats(),
        listLabelsPaginated({ page: 1, pageSize: 10, countryFilter: undefined, search: undefined }),
      ]);
      setStats(statsData);
      setFeaturedLabels(topLabels.labels.filter((l) => l.artistImageUrl).slice(0, 10));
    } catch (err) {
      setMetaError(err instanceof Error ? err.message : "Could not load label metadata.");
    } finally {
      setMetaLoading(false);
    }
  }, []);

  useEffect(() => {
    loadMeta();
  }, [loadMeta]);

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      setPageLoading(true);
      setPageError(null);
      try {
        const result = await listLabelsPaginated({
          page: 1,
          pageSize: INITIAL_LIMIT,
          countryFilter: country === ALL ? undefined : country,
          search: debouncedSearch || undefined,
        });

        let sorted = [...result.labels];
        if (sortKey === "name") {
          sorted.sort((a, b) => a.name.localeCompare(b.name));
        } else if (sortKey === "artists") {
          sorted.sort((a, b) => b.artistCount - a.artistCount);
        } else if (sortKey === "releases") {
          sorted.sort((a, b) => b.releaseCount - a.releaseCount);
        }
        // "prominence" is default server sort (artistCount + releaseCount)

        if (!cancelled) {
          setLabels(sorted);
          setTotalCount(result.totalCount);
        }
      } catch (err) {
        if (!cancelled) {
          setPageError(err instanceof Error ? err.message : "Could not load labels.");
        }
      } finally {
        if (!cancelled) setPageLoading(false);
      }
    };
    run();
    return () => { cancelled = true; };
  }, [reloadKey, country, debouncedSearch, sortKey]);

  const loadMore = useCallback(async () => {
    if (isLoadingMore || labels.length >= totalCount) return;
    setIsLoadingMore(true);
    setPageError(null);
    try {
      const nextPage = Math.floor(labels.length / LOAD_MORE_LIMIT) + 1;
      const result = await listLabelsPaginated({
        page: nextPage,
        pageSize: LOAD_MORE_LIMIT,
        countryFilter: country === ALL ? undefined : country,
        search: debouncedSearch || undefined,
      });

      let sorted = [...result.labels];
      if (sortKey === "name") {
        sorted.sort((a, b) => a.name.localeCompare(b.name));
      } else if (sortKey === "artists") {
        sorted.sort((a, b) => b.artistCount - a.artistCount);
      } else if (sortKey === "releases") {
        sorted.sort((a, b) => b.releaseCount - a.releaseCount);
      }

      setLabels((prev) => [...prev, ...sorted]);
    } catch (err) {
      setPageError(err instanceof Error ? err.message : "Could not load more labels.");
    } finally {
      setIsLoadingMore(false);
    }
  }, [labels.length, totalCount, isLoadingMore, country, debouncedSearch, sortKey]);

  const hasMore = labels.length < totalCount && totalCount > 0;
  const showingTo = labels.length;

  if (metaLoading) {
    return <LabelsLoading />;
  }

  if (metaError && featuredLabels.length === 0) {
    return (
      <main className="min-h-screen wk-container px-6 py-20 bg-[var(--wk-bg)]">
        <div className="max-w-2xl mx-auto rounded-2xl border border-[var(--wk-border)] bg-[var(--wk-surface)] p-8 text-center">
          <WkIcon name="Building2" size={42} className="mx-auto mb-4 text-[var(--wk-text-faint)]" />
          <h1 className="wk-h-section mb-2">Could not load labels</h1>
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
      <FeaturedLabelCarousel labels={featuredLabels} catalogStats={stats} />

      <div className="wk-container-wide px-4 py-10 md:px-6">
        <div className="chart-stats-strip mb-10">
          <Stat value={stats.total} label="Labels" />
          <Stat value={totalCount} label="Showing" />
          <Stat value={stats.totalArtists.toLocaleString()} label="Artists" />
          <Stat value={stats.totalReleases.toLocaleString()} label="Releases" />
        </div>

        <section className="mb-10 rounded-2xl border border-[var(--wk-border)] bg-[var(--wk-surface)] p-4 md:p-5">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between mb-5">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-[var(--wk-brand)]/20 bg-[var(--wk-brand-soft)]/40 px-3 py-1 text-[11px] font-extrabold uppercase tracking-[0.18em] text-[var(--wk-brand)] mb-3">
                <WkIcon name="Search" size={12} />
                Discovery
              </div>
              <h2 className="text-[clamp(22px,3vw,32px)] font-black leading-[0.92] tracking-[-0.04em] text-[var(--wk-text)]">
                Find labels
              </h2>
            </div>
            <FilterSelect label="Sort" value={sortKey} options={["prominence", "name", "artists", "releases"]} onChange={(value) => setSortKey(value as SortKey)} />
          </div>

          <div className="flex items-center gap-2 rounded-xl border border-[var(--wk-border)] bg-[var(--wk-bg)] px-3 py-2.5 mb-3">
            <WkIcon name="Search" size={15} className="text-[var(--wk-text-faint)]" />
            <input
              value={searchInput}
              onChange={(event) => setSearchInput(event.target.value)}
              placeholder="Search labels or countries..."
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

          <div className="flex flex-wrap gap-1.5">
            <button
              onClick={() => setCountry(ALL)}
              className={`rounded-full px-3 py-1 text-[11px] font-bold transition-all whitespace-nowrap border cursor-pointer ${
                country === ALL
                  ? "bg-[var(--wk-brand)] border-[var(--wk-brand)] text-white"
                  : "border-[var(--wk-border)] bg-[var(--wk-bg)] text-[var(--wk-text-muted)] hover:text-[var(--wk-text)] hover:border-[var(--wk-border-2)]"
              }`}
            >
              All
            </button>
            {stats.countries.slice(0, 14).map((name) => (
              <button
                key={name}
                onClick={() => setCountry(name)}
                className={`rounded-full px-3 py-1 text-[11px] font-bold transition-all whitespace-nowrap border cursor-pointer ${
                  country === name
                    ? "bg-[var(--wk-brand)] border-[var(--wk-brand)] text-white"
                    : "border-[var(--wk-border)] bg-[var(--wk-bg)] text-[var(--wk-text-muted)] hover:text-[var(--wk-text)] hover:border-[var(--wk-border-2)]"
                }`}
              >
                {name}
              </button>
            ))}
          </div>
        </section>

        <section>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between mb-6">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-[var(--wk-brand)]/20 bg-[var(--wk-brand-soft)]/40 px-3 py-1 text-[11px] font-extrabold uppercase tracking-[0.18em] text-[var(--wk-brand)] mb-3">
                <WkIcon name="Building2" size={12} />
                Label directory
              </div>
              <h2 className="text-[clamp(22px,3vw,32px)] font-black leading-[0.92] tracking-[-0.04em] text-[var(--wk-text)]">
                All labels
              </h2>
            </div>
            <p className="text-[12px] font-semibold text-[var(--wk-text-muted)]">
              {totalCount > 0
                ? `Showing ${showingTo} of ${totalCount}`
                : "No labels found"}
            </p>
          </div>

          {pageLoading ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4 md:gap-5">
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
              <WkIcon name="Building2" size={36} className="mx-auto text-[var(--wk-text-faint)]" />
              <p className="mt-4 text-[15px] font-semibold text-[var(--wk-text-muted)]">{pageError}</p>
              <button onClick={() => setReloadKey((k) => k + 1)} className="wk-button wk-button-sm wk-button-primary mt-5 cursor-pointer">
                <i className="ri-refresh-line" /> Retry
              </button>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4 md:gap-5">
                {labels.map((label) => (
                  <LabelCard key={label.slug} label={label} />
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

              {labels.length === 0 && (
                <div className="rounded-2xl border border-dashed border-[var(--wk-border)] p-20 text-center">
                  <WkIcon name="Building2" size={36} className="mx-auto text-[var(--wk-text-faint)]" />
                  <h3 className="mt-4 text-[20px] font-black text-[var(--wk-text)]">No labels match</h3>
                  <p className="mx-auto mt-2 max-w-md text-[14px] font-semibold leading-relaxed text-[var(--wk-text-muted)]">
                    Try a different search or clear the country filter to see more labels.
                  </p>
                  <button
                    onClick={() => { setSearchInput(""); setCountry(ALL); setSortKey("prominence"); }}
                    className="wk-button wk-button-sm wk-button-primary mt-5 cursor-pointer"
                  >
                    <i className="ri-refresh-line" /> Clear filters
                  </button>
                </div>
              )}
            </>
          )}
        </section>
      </div>
    </main>
  );
}

/* ── Featured Label Carousel ── */
function FeaturedLabelCarousel({
  labels,
  catalogStats,
}: {
  labels: PublicLabel[];
  catalogStats: LabelCatalogStats;
}) {
  const [activeIndex, setActiveIndex] = useState(0);
  const scrollerRef = useRef<HTMLDivElement>(null);
  const active = labels[activeIndex] || labels[0];

  useEffect(() => setActiveIndex(0), [labels]);

  const scrollTo = (index: number) => {
    const nextIndex = Math.max(0, Math.min(index, labels.length - 1));
    setActiveIndex(nextIndex);
    const slide = scrollerRef.current?.children[nextIndex] as HTMLElement | undefined;
    slide?.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
  };

  if (!active) return null;

  const roster = (active.featuredArtists || []).slice(0, 5);

  return (
    <section className="relative min-h-[78vh] overflow-hidden border-b border-[var(--wk-border)] bg-[#0d120a] text-white">
      <CarouselBackground label={active} />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_12%_20%,rgba(133,196,65,0.32),transparent_34%),linear-gradient(90deg,rgba(0,0,0,0.82)_0%,rgba(0,0,0,0.58)_42%,rgba(0,0,0,0.24)_100%)]" />
      <div className="relative z-10 flex min-h-[78vh] flex-col justify-end">
        <div className="wk-container-wide w-full px-4 pb-8 pt-24 md:px-6 lg:pb-12 lg:pt-32">
          <div className="grid items-end gap-8 lg:grid-cols-[minmax(0,1fr)_420px]">
            <div className="max-w-4xl">
              <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1.5 text-[11px] font-extrabold uppercase tracking-[0.18em] text-white/85 backdrop-blur">
                <WkIcon name="Building2" size={13} /> Label directory
              </div>
              <h1 className="font-[var(--wk-font-display)] text-[clamp(56px,9vw,128px)] font-black leading-[0.82] tracking-[-0.075em] text-white drop-shadow-2xl">
                Labels
              </h1>
              <p className="mt-6 max-w-2xl text-[17px] font-semibold leading-[1.75] text-white/74 md:text-[19px]">
                Record labels, imprints, distributors, and music institutions mapped as ecosystems — rosters, releases, chart presence, and country footprint.
              </p>
              <div className="mt-7 flex flex-wrap items-center gap-3 text-[12px] font-extrabold text-white/82">
                <span className="inline-flex items-center gap-2 rounded-full border border-white/16 bg-white/10 px-3 py-2 backdrop-blur">
                  <WkIcon name="Building2" size={14} /> {catalogStats.total} labels
                </span>
                <span className="inline-flex items-center gap-2 rounded-full border border-white/16 bg-white/10 px-3 py-2 backdrop-blur">
                  <WkIcon name="User2" size={14} /> {catalogStats.totalArtists.toLocaleString()} artists
                </span>
                <span className="inline-flex items-center gap-2 rounded-full border border-white/16 bg-white/10 px-3 py-2 backdrop-blur">
                  <WkIcon name="Disc3" size={14} /> {catalogStats.totalReleases.toLocaleString()} releases
                </span>
                <span className="inline-flex items-center gap-2 rounded-full border border-white/16 bg-white/10 px-3 py-2 backdrop-blur">
                  <WkIcon name="Globe" size={14} /> {catalogStats.countries.length} countries
                </span>
              </div>
            </div>
            <div className="rounded-[28px] border border-white/16 bg-black/24 p-4 shadow-2xl backdrop-blur-xl">
              <div className="aspect-square overflow-hidden rounded-2xl bg-white/10">
                {active.artistImageUrl ? (
                  <img
                    src={active.artistImageUrl}
                    alt={active.name}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <Chapter19FallbackImage
                    slug={active.slug}
                    name={active.name}
                    className="w-full h-full object-cover"
                  />
                )}
              </div>
              <div className="mt-4">
                <div className="text-[11px] font-extrabold uppercase tracking-[0.18em] text-[var(--wk-brand)]">Featured label</div>
                <h2 className="mt-1 line-clamp-2 text-[30px] font-black leading-[0.95] tracking-[-0.05em] text-white">{active.name}</h2>
                <div className="mt-3 text-[13px] font-bold text-white/70">
                  {active.country || "Global"} &middot; {active.artistCount} artists &middot; {active.releaseCount} releases
                </div>
                {roster.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {roster.map((artist) => (
                      <span key={artist} className="rounded-full border border-white/15 bg-white/10 px-2.5 py-0.5 text-[10px] font-bold text-white/70 backdrop-blur">
                        {artist}
                      </span>
                    ))}
                  </div>
                )}
                <div className="mt-4 flex flex-wrap gap-2">
                  <Link to={`/labels/${active.slug}`} className="wk-button wk-button-primary cursor-pointer whitespace-nowrap">
                    <WkIcon name="ArrowUpRight" size={15} /> Open
                  </Link>
                  <ShareButton item={{ title: active.name, subtitle: `${active.artistCount} artists`, description: `${active.name} \u2014 ${active.country || "Global"} label with ${active.artistCount} artists and ${active.releaseCount} releases.`, type: "page" }} />
                </div>
              </div>
            </div>
          </div>
          {labels.length > 1 && (
            <div className="mt-10">
              <div ref={scrollerRef} className="flex snap-x gap-3 overflow-x-auto pb-3 scrollbar-hide">
                {labels.map((label, index) => (
                  <button
                    key={label.slug}
                    onClick={() => scrollTo(index)}
                    className={`group relative h-28 w-[220px] shrink-0 snap-start overflow-hidden rounded-2xl border text-left transition-all md:w-[260px] cursor-pointer ${
                      activeIndex === index
                        ? "border-[var(--wk-brand)] shadow-[0_0_0_1px_var(--wk-brand)]"
                        : "border-white/16 hover:border-white/35"
                    }`}
                  >
                    <div className="absolute inset-0">
                      {label.artistImageUrl ? (
                        <img src={label.artistImageUrl} alt={label.name} className="w-full h-full object-cover" />
                      ) : (
                        <Chapter19FallbackImage slug={label.slug} name={label.name} className="w-full h-full object-cover" />
                      )}
                    </div>
                    <div className="absolute inset-0 bg-gradient-to-t from-black/88 via-black/38 to-transparent" />
                    <div className="absolute inset-x-0 bottom-0 p-3">
                      <div className="line-clamp-1 text-[14px] font-black text-white">{label.name}</div>
                      <div className="line-clamp-1 text-[11px] font-bold text-white/70">{label.country || "Global"} &middot; {label.artistCount} artists</div>
                    </div>
                  </button>
                ))}
              </div>
              <div className="mt-3 flex items-center justify-between gap-4">
                <div className="flex gap-2">
                  {labels.map((label, index) => (
                    <button
                      key={`dot-${label.slug}-${index}`}
                      aria-label={`Show ${label.name}`}
                      onClick={() => scrollTo(index)}
                      className={`h-2 rounded-full transition-all cursor-pointer ${
                        activeIndex === index ? "w-8 bg-[var(--wk-brand)]" : "w-2 bg-white/35 hover:bg-white/65"
                      }`}
                    />
                  ))}
                </div>
                <div className="flex gap-2">
                  <button onClick={() => scrollTo(activeIndex - 1)} className="rounded-full border border-white/18 bg-white/10 p-2 text-white backdrop-blur hover:bg-white/16 cursor-pointer" aria-label="Previous featured label">
                    <WkIcon name="ChevronLeft" size={18} />
                  </button>
                  <button onClick={() => scrollTo(activeIndex + 1)} className="rounded-full border border-white/18 bg-white/10 p-2 text-white backdrop-blur hover:bg-white/16 cursor-pointer" aria-label="Next featured label">
                    <WkIcon name="ChevronRight" size={18} />
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

/* ── Label Card ── */
function LabelCard({ label }: { label: PublicLabel }) {
  const roster = (label.featuredArtists || []).slice(0, 3);

  return (
    <div className="group flex flex-col">
      <Link to={`/labels/${label.slug}`} className="relative aspect-square rounded-xl overflow-hidden bg-[var(--wk-bg)] border border-[var(--wk-border)] mb-3">
        {label.artistImageUrl ? (
          <img src={label.artistImageUrl} alt={label.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
        ) : (
          <Chapter19FallbackImage slug={label.slug} name={label.name} className="w-full h-full object-cover" />
        )}
        <div className="absolute top-2.5 left-2.5">
          <span className="inline-flex items-center rounded-full bg-black/50 px-2 py-0.5 text-[9px] font-extrabold uppercase tracking-[0.12em] text-white backdrop-blur-sm">
            {label.country || "Global"}
          </span>
        </div>
        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent p-3 pt-8">
          <div className="text-[13px] font-extrabold text-white leading-tight line-clamp-1">{label.name}</div>
        </div>
      </Link>

      <Link to={`/labels/${label.slug}`} className="text-[13px] font-extrabold text-[var(--wk-text)] group-hover:text-[var(--wk-brand)] transition-colors leading-tight truncate">
        {label.name}
      </Link>
      <div className="text-[12px] font-bold text-[var(--wk-text-muted)] truncate mt-0.5">
        {label.artistCount} artists &middot; {label.releaseCount} releases
      </div>
      {roster.length > 0 && (
        <div className="mt-1.5 flex flex-wrap gap-1">
          {roster.map((artist) => (
            <span key={artist} className="text-[10px] font-semibold text-[var(--wk-text-faint)] truncate max-w-[80px]">
              {artist}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

/* ── Loading skeleton ── */
function LabelsLoading() {
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
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
          {Array.from({ length: 12 }).map((_, i) => (
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

/* ── Filter select ── */
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
          <option key={option} value={option}>{sortOptionLabel(option)}</option>
        ))}
      </select>
    </label>
  );
}

/* ── Stat pill ── */
function Stat({ value, label }: { value: string | number; label: string }) {
  return <div className="chart-stat-card"><div className="chart-stat-value">{value}</div><div className="chart-stat-label">{label}</div></div>;
}

/* ── Helpers ── */
function sortOptionLabel(value: string): string {
  if (value === "prominence") return "Most prominent";
  if (value === "name") return "Name A-Z";
  if (value === "artists") return "Most artists";
  if (value === "releases") return "Most releases";
  return value;
}

function CarouselBackground({ label }: { label: PublicLabel }) {
  const [failed, setFailed] = useState(false);
  if (!label.artistImageUrl || failed) {
    return <div className="absolute inset-0 bg-[radial-gradient(circle_at_18%_75%,rgba(133,196,65,0.42),transparent_32%),radial-gradient(circle_at_82%_16%,rgba(255,255,255,0.20),transparent_30%),linear-gradient(135deg,#101510,#1d2f12)]" />;
  }
  return (
    <>
      <img src={label.artistImageUrl} alt="" className="hidden" onError={() => setFailed(true)} />
      <div className="absolute inset-0 scale-105 bg-cover bg-center opacity-75 blur-[2px]" style={{ backgroundImage: `url("${label.artistImageUrl}")` }} />
    </>
  );
}