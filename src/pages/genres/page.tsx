import { useMemo, useState, useEffect, useCallback, useRef } from "react";
import { Link } from "react-router-dom";
import { ShareButton } from "@/components/design-system/share/ShareSheet";
import { WkIcon } from "@/components/design-system/Icon";
import { Chapter19FallbackImage } from "@/components/media/Chapter19FallbackImage";
import {
  listGenresPaginated,
  getGenreCatalogStats,
  type PublicGenre,
  type GenreCatalogStats,
} from "@/services/publicContent/client";

const filters = ["All", "High activity", "Artist-rich", "Track-rich", "Recently updated"];
const PAGE_SIZE = 24;

function useScrollReveal(deps: unknown[] = []) {
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("genre43-reveal-visible");
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.06, rootMargin: "0px 0px -28px 0px" },
    );
    const els = document.querySelectorAll(".genre43-reveal");
    els.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, deps);
}

export default function Genres() {
  const [activeFilter, setActiveFilter] = useState("All");
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [genres, setGenres] = useState<PublicGenre[]>([]);
  const [stats, setStats] = useState<GenreCatalogStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [statsData, pageData] = await Promise.all([
        getGenreCatalogStats(),
        listGenresPaginated({
          page: 1,
          pageSize: PAGE_SIZE,
          search: query,
          activityFilter: activeFilter,
        }),
      ]);
      setStats(statsData);
      setGenres(pageData.genres);
      setPage(1);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load genres.");
    } finally {
      setLoading(false);
    }
  }, [query, activeFilter]);

  const loadPage = useCallback(async (targetPage: number) => {
    setLoading(true);
    setError(null);
    try {
      const pageData = await listGenresPaginated({
        page: targetPage,
        pageSize: PAGE_SIZE,
        search: query,
        activityFilter: activeFilter,
      });
      setGenres(pageData.genres);
      setPage(targetPage);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load genres.");
    } finally {
      setLoading(false);
    }
  }, [query, activeFilter]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useScrollReveal([loading, page]);

  const totalArtists = stats?.totalArtists ?? 0;
  const totalTracks = stats?.totalTracks ?? 0;
  const totalGenres = stats?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(totalGenres / PAGE_SIZE));

  const sortedByActivity = useMemo(
    () => [...genres].sort((a, b) => b.artistCount - a.artistCount),
    [genres],
  );

  const spotlight = sortedByActivity[0];
  const compactGenres = sortedByActivity.slice(1, 4);
  const trendingGenres = sortedByActivity.slice(0, 8);

  const updateFilter = (next: string) => {
    setActiveFilter(next);
    setPage(1);
  };

  if (loading && genres.length === 0) {
    return (
      <main className="min-h-screen">
        <div className="genre43-hero-skel">
          <div className="h-4 w-32 rounded bg-white/10 animate-pulse" />
          <div className="h-16 w-96 rounded bg-white/10 animate-pulse mt-6" />
          <div className="h-5 w-[500px] rounded bg-white/10 animate-pulse mt-4" />
        </div>
        <div className="wk-container-wide px-4 py-10 md:px-6">
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="rounded-xl border border-[var(--wk-border)] bg-[var(--wk-surface)] overflow-hidden">
                <div className="h-32 bg-[var(--wk-surface-raised)] animate-pulse" />
                <div className="p-3 space-y-2">
                  <div className="h-4 w-3/4 rounded bg-[var(--wk-surface-raised)] animate-pulse" />
                  <div className="h-3 w-1/2 rounded bg-[var(--wk-surface-raised)] animate-pulse" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </main>
    );
  }

  if (error && genres.length === 0) {
    return (
      <main className="min-h-screen wk-container px-6 py-20">
        <div className="max-w-2xl mx-auto rounded-2xl border border-[var(--wk-border)] bg-[var(--wk-surface)] p-8 text-center">
          <WkIcon name="Compass" size={42} className="mx-auto mb-4 text-[var(--wk-text-faint)]" />
          <h1 className="wk-h-section mb-2">Could not load genres</h1>
          <p className="text-[var(--wk-text-muted)] mb-6">{error}</p>
          <button onClick={() => loadData()} className="wk-button wk-button-primary">
            <i className="ri-refresh-line" /> Retry
          </button>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[var(--wk-bg)]">

      {/* ═══════════════════════ HERO ═══════════════════════ */}
      <section className="genre43-hero">
        <div className="genre43-hero-overlay" />
        <div className="genre43-hero-content">
          <div className="genre43-hero-badge">
            <WkIcon name="Compass" size={12} /> Cultural territories
          </div>
          <h1 className="genre43-hero-title">Genres</h1>
          <p className="genre43-hero-sub">
            Browse WAKILISHA by genre as living cultural territory: artists, tracks,
            activity, representative voices, and routes into discovery.
          </p>
          <div className="genre43-hero-row">
            <div className="genre43-hero-search-wrap">
              <i className="ri-search-line genre43-hero-search-icon" />
              <input
                className="genre43-hero-search"
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setPage(1);
                }}
                placeholder="Search genre or representative artist..."
              />
            </div>
            <ShareButton
              item={{
                title: "WAKILISHA Genre Directory",
                subtitle: `${totalGenres} genres`,
                description: "Browse the WAKILISHA cultural map by genre.",
                type: "page",
              }}
            />
          </div>
          <div className="genre43-hero-stats">
            <div className="genre43-hero-stat">
              <span className="genre43-hero-stat-val">{totalGenres}</span>
              <span className="genre43-hero-stat-lbl">Genres</span>
            </div>
            <div className="genre43-hero-stat">
              <span className="genre43-hero-stat-val">{totalArtists.toLocaleString()}</span>
              <span className="genre43-hero-stat-lbl">Artists</span>
            </div>
            <div className="genre43-hero-stat">
              <span className="genre43-hero-stat-val">{totalTracks.toLocaleString()}</span>
              <span className="genre43-hero-stat-lbl">Tracks</span>
            </div>
          </div>
        </div>
        <div className="genre43-hero-scroll-hint">
          <div className="genre43-hero-scroll-line" />
        </div>
      </section>

      {/* ═══════════════════════ STICKY NAV ═══════════════════════ */}
      <div className="genre43-toolbar">
        <div className="genre43-toolbar-inner">
          <span className="genre43-toolbar-label">Filter</span>
          <div className="genre43-filter-pills">
            {filters.map((f) => (
              <button
                key={f}
                onClick={() => updateFilter(f)}
                className={`genre43-filter-pill ${activeFilter === f ? "on" : ""}`}
              >
                {f}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ═══════════════════════ CONTENT BODY ═══════════════════════ */}
      <div className="genre43-body">

        {/* ── Spotlight · asymmetrical ── */}
        {spotlight && (
          <section className="genre43-reveal">
            <SectionLabel>Spotlight</SectionLabel>
            <div className="genre43-asym-grid">
              <Link to={`/genres/${spotlight.slug}`} className="genre43-spot-card group">
                <Chapter19FallbackImage
                  slug={spotlight.slug}
                  name={spotlight.name}
                  className="genre43-spot-artwork"
                />
                <div className="genre43-spot-gradient" />
                <div className="genre43-spot-info">
                  <div className="genre43-spot-kicker">Most active genre</div>
                  <h2 className="genre43-spot-title">{spotlight.name}</h2>
                  <div className="genre43-spot-meta-row">
                    <span>{spotlight.artistCount} artists</span>
                    <span className="genre43-spot-dot" />
                    <span>{spotlight.trackCount} tracks</span>
                  </div>
                  <p className="genre43-spot-desc">
                    Representative voices:{" "}
                    {spotlight.representativeArtists?.slice(0, 4).join(", ") ||
                      "registry pending"}.
                  </p>
                </div>
              </Link>
              <div className="genre43-compact-stack">
                {compactGenres.map((genre, i) => (
                  <Link key={genre.slug} to={`/genres/${genre.slug}`} className="genre43-compact-card group">
                    <div className="genre43-compact-artwork-wrap">
                      <Chapter19FallbackImage
                        slug={genre.slug}
                        name={genre.name}
                        className="genre43-compact-artwork"
                      />
                    </div>
                    <div className="genre43-compact-body">
                      <div className="genre43-compact-rank">#{i + 2}</div>
                      <h4 className="genre43-compact-name">{genre.name}</h4>
                      <div className="genre43-compact-meta">
                        <span>{genre.artistCount} artists</span>
                        <span className="genre43-compact-dot" />
                        <span>{genre.trackCount} tracks</span>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          </section>
        )}

        {/* ── Trending genres · symmetrical grid ── */}
        {trendingGenres.length > 0 && (
          <section className="genre43-reveal">
            <SectionLabel count={trendingGenres.length}>Trending genres</SectionLabel>
            <div className="genre43-grid">
              {trendingGenres.map((genre) => (
                <GenreCard key={genre.slug} genre={genre} />
              ))}
            </div>
          </section>
        )}

        {/* ── Pullquote ── */}
        <div className="genre43-reveal genre43-pullquote">
          <div className="genre43-pullquote-inner">
            <div className="genre43-pullquote-line" />
            <p className="genre43-pullquote-text">
              Genres are portals, not people. Every territory is mapped through
              texture, color, metadata density, and cultural routing — because
              sound deserves an ecosystem, not a headshot.
            </p>
            <div className="genre43-pullquote-line" />
          </div>
        </div>

        {/* ── Full directory ── */}
        <section className="genre43-reveal">
          <SectionLabel count={genres.length}>Full directory</SectionLabel>

          <div className="genre43-grid">
            {genres.map((genre) => (
              <GenreCard key={genre.slug} genre={genre} />
            ))}
          </div>

          {genres.length === 0 && !loading && (
            <div className="genre43-empty">
              <WkIcon name="Compass" size={32} />
              <span>No genres match this search.</span>
            </div>
          )}

          {totalPages > 1 && (
            <div className="genre43-pagination">
              <button
                className="genre43-page-btn"
                disabled={page === 1}
                onClick={() => loadPage(Math.max(1, page - 1))}
              >
                <WkIcon name="ArrowLeft" size={14} />
              </button>
              <span className="genre43-page-indicator">
                Page {page} of {totalPages}
              </span>
              <button
                className="genre43-page-btn"
                disabled={page === totalPages}
                onClick={() => loadPage(Math.min(totalPages, page + 1))}
              >
                <WkIcon name="ArrowRight" size={14} />
              </button>
            </div>
          )}
        </section>

        {/* ── Context block ── */}
        <section className="genre43-reveal genre43-context">
          <div className="genre43-context-inner">
            <div className="genre43-context-block">
              <span className="genre43-context-eyebrow">Recently active</span>
              <div className="genre43-context-list">
                {sortedByActivity.slice(0, 6).map((genre) => (
                  <Link
                    key={genre.slug}
                    to={`/genres/${genre.slug}`}
                    className="genre43-context-row group"
                  >
                    <div className="genre43-context-dot-brand" />
                    <span className="genre43-context-row-name">{genre.name}</span>
                    <span className="genre43-context-row-stat">{genre.artistCount} artists</span>
                    <i className="ri-arrow-right-s-line genre43-context-row-arrow" />
                  </Link>
                ))}
              </div>
            </div>
            <div className="genre43-context-block">
              <span className="genre43-context-eyebrow">Directory rule</span>
              <h3 className="genre43-context-title">Genres are portals.</h3>
              <p className="genre43-context-body">
                This chapter uses abstract visual treatment, metadata density,
                iconography, and cultural routing. Human photography belongs to
                artist pages, not genre cards. Every genre here carries a unique
                gradient identity derived from its name — a visual signature for
                each cultural territory.
              </p>
              <div className="genre43-context-stats">
                <div className="genre43-context-stat">
                  <span className="genre43-context-stat-val">{totalGenres}</span>
                  <span className="genre43-context-stat-lbl">Genres mapped</span>
                </div>
                <div className="genre43-context-stat">
                  <span className="genre43-context-stat-val">{totalTracks.toLocaleString()}</span>
                  <span className="genre43-context-stat-lbl">Tracks classified</span>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ── Footer ── */}
        <footer className="genre43-reveal genre43-footer">
          <span className="genre43-footer-brand">WAKILISHA Cultural Map</span>
          <p className="genre43-footer-tagline">
            {totalGenres} genres across the continent. Every territory mapped
            as a living ecosystem.
          </p>
          <p className="genre43-footer-meta">
            {totalArtists.toLocaleString()} artists &middot; {totalTracks.toLocaleString()} tracks
          </p>
        </footer>
      </div>
    </main>
  );
}

/* ── Section label ── */
function SectionLabel({ children, count }: { children: string; count?: number }) {
  return (
    <div className="genre43-section-label-row">
      <div className="genre43-section-label-left">
        <span className="genre43-section-label-text">{children}</span>
        {count !== undefined && (
          <span className="genre43-section-label-count">{count}</span>
        )}
      </div>
    </div>
  );
}

/* ── Genre card ── */
function GenreCard({ genre }: { genre: PublicGenre }) {
  return (
    <Link to={`/genres/${genre.slug}`} className="genre43-card group">
      <div className="genre43-card-artwork-wrap">
        <Chapter19FallbackImage
          slug={genre.slug}
          name={genre.name}
          className="genre43-card-artwork"
        />
        <div className="genre43-card-artwork-name">{genre.name}</div>
      </div>
      <div className="genre43-card-body">
        <div className="genre43-card-stats-row">
          <div className="genre43-card-stat-pill">
            <strong>{genre.artistCount}</strong>
            <span>Artists</span>
          </div>
          <div className="genre43-card-stat-pill">
            <strong>{genre.trackCount}</strong>
            <span>Tracks</span>
          </div>
        </div>
        {genre.representativeArtists && genre.representativeArtists.length > 0 && (
          <div className="genre43-card-roster">
            {genre.representativeArtists.slice(0, 4).map((artist) => (
              <span key={artist} className="genre43-card-roster-tag">{artist}</span>
            ))}
          </div>
        )}
      </div>
    </Link>
  );
}