import { useMemo, useState, useEffect, useCallback, useRef } from "react";
import { Link } from "react-router-dom";
import { ShareButton } from "@/components/design-system/share/ShareSheet";
import { WkIcon } from "@/components/design-system/Icon";
import { Chapter19FallbackImage } from "@/components/media/Chapter19FallbackImage";
import { listGenres, type PublicGenre } from "@/services/publicContent/client";

const filters = ["All", "High activity", "Artist-rich", "Track-rich"];

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

export default function MobileGenres() {
  const [activeFilter, setActiveFilter] = useState("All");
  const [query, setQuery] = useState("");
  const [genres, setGenres] = useState<PublicGenre[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await listGenres();
      setGenres(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load genres.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);
  useScrollReveal([loading]);

  const totalArtists = genres.reduce((s, g) => s + g.artistCount, 0);
  const totalTracks = genres.reduce((s, g) => s + g.trackCount, 0);
  const sortedByActivity = useMemo(() => [...genres].sort((a, b) => b.trackCount - a.trackCount), [genres]);
  const spotlight = sortedByActivity[0];
  const compactGenres = sortedByActivity.slice(1, 4);

  const filteredGenres = useMemo(() => {
    const q = query.trim().toLowerCase();
    return genres.filter((g) => {
      const mq = !q || g.name.toLowerCase().includes(q) || g.representativeArtists?.some((a) => a.toLowerCase().includes(q));
      const mf = activeFilter === "All" || (activeFilter === "High activity" && g.trackCount >= 100) || (activeFilter === "Artist-rich" && g.artistCount >= 25) || (activeFilter === "Track-rich" && g.trackCount >= 50);
      return mq && mf;
    });
  }, [activeFilter, query, genres]);

  const trendingGenres = useMemo(() => sortedByActivity.slice(0, 8), [sortedByActivity]);

  if (loading) {
    return (
      <main className="min-h-screen">
        <div className="genre43-hero-skel"><div className="h-4 w-32 rounded bg-white/10 animate-pulse" /><div className="h-16 w-96 rounded bg-white/10 animate-pulse mt-6" /></div>
        <div className="wk-container-wide px-4 py-10"><div className="grid grid-cols-2 gap-3">{Array.from({ length: 6 }).map((_, i) => (<div key={i} className="rounded-xl border border-[var(--wk-border)] bg-[var(--wk-surface)] overflow-hidden"><div className="h-28 bg-[var(--wk-surface-raised)] animate-pulse" /><div className="p-3 space-y-2"><div className="h-4 w-3/4 rounded bg-[var(--wk-surface-raised)] animate-pulse" /></div></div>))}</div></div>
      </main>
    );
  }

  if (error) {
    return (
      <main className="min-h-screen wk-container px-6 py-20">
        <div className="max-w-2xl mx-auto rounded-2xl border border-[var(--wk-border)] bg-[var(--wk-surface)] p-8 text-center">
          <WkIcon name="Compass" size={42} className="mx-auto mb-4 text-[var(--wk-text-faint)]" />
          <h1 className="wk-h-section mb-2">Could not load genres</h1>
          <p className="text-[var(--wk-text-muted)] mb-6">{error}</p>
          <button onClick={loadData} className="wk-button wk-button-primary"><i className="ri-refresh-line" /> Retry</button>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[var(--wk-bg)]">
      <section className="genre43-hero">
        <div className="genre43-hero-overlay" />
        <div className="genre43-hero-content">
          <div className="genre43-hero-badge"><WkIcon name="Compass" size={12} /> Cultural territories</div>
          <h1 className="genre43-hero-title">Genres</h1>
          <p className="genre43-hero-sub">Browse WAKILISHA by genre: artists, tracks, activity, representative voices, and routes into the music.</p>
          <div className="genre43-hero-row">
            <div className="genre43-hero-search-wrap">
              <i className="ri-search-line genre43-hero-search-icon" />
              <input className="genre43-hero-search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search genre or artist..." />
            </div>
            <ShareButton item={{ title: "WAKILISHA Genre Directory", subtitle: `${genres.length} genres`, description: "Browse the WAKILISHA cultural map by genre.", type: "page" }} />
          </div>
          <div className="genre43-hero-stats">
            <div className="genre43-hero-stat"><span className="genre43-hero-stat-val">{genres.length}</span><span className="genre43-hero-stat-lbl">Genres</span></div>
            <div className="genre43-hero-stat"><span className="genre43-hero-stat-val">{totalArtists.toLocaleString()}</span><span className="genre43-hero-stat-lbl">Artists</span></div>
            <div className="genre43-hero-stat"><span className="genre43-hero-stat-val">{totalTracks.toLocaleString()}</span><span className="genre43-hero-stat-lbl">Tracks</span></div>
          </div>
        </div>
        <div className="genre43-hero-scroll-hint"><div className="genre43-hero-scroll-line" /></div>
      </section>

      <div className="genre43-toolbar">
        <div className="genre43-toolbar-inner">
          <div className="genre43-filter-pills">
            {filters.map((f) => (<button key={f} onClick={() => setActiveFilter(f)} className={`genre43-filter-pill ${activeFilter === f ? "on" : ""}`}>{f}</button>))}
          </div>
        </div>
      </div>

      <div className="genre43-body">
        {spotlight && (
          <section className="genre43-reveal">
            <SectionLabel>Spotlight</SectionLabel>
            <div className="genre43-asym-grid">
              <Link to={`/genres/${spotlight.slug}`} className="genre43-spot-card group">
                <Chapter19FallbackImage slug={spotlight.slug} name={spotlight.name} className="genre43-spot-artwork" />
                <div className="genre43-spot-gradient" />
                <div className="genre43-spot-info">
                  <div className="genre43-spot-kicker">Most active genre</div>
                  <h2 className="genre43-spot-title">{spotlight.name}</h2>
                  <div className="genre43-spot-meta-row"><span>{spotlight.artistCount} artists</span><span className="genre43-spot-dot" /><span>{spotlight.trackCount} tracks</span></div>
                  <p className="genre43-spot-desc">Artists represented: {spotlight.representativeArtists?.slice(0, 4).join(", ") || "more context soon"}.</p>
                </div>
              </Link>
              <div className="genre43-compact-stack">
                {compactGenres.map((g, i) => (
                  <Link key={g.slug} to={`/genres/${g.slug}`} className="genre43-compact-card group">
                    <div className="genre43-compact-artwork-wrap"><Chapter19FallbackImage slug={g.slug} name={g.name} className="genre43-compact-artwork" /></div>
                    <div className="genre43-compact-body"><div className="genre43-compact-rank">#{i + 2}</div><h4 className="genre43-compact-name">{g.name}</h4><div className="genre43-compact-meta"><span>{g.artistCount} artists</span><span className="genre43-compact-dot" /><span>{g.trackCount} tracks</span></div></div>
                  </Link>
                ))}
              </div>
            </div>
          </section>
        )}

        {trendingGenres.length > 0 && (
          <section className="genre43-reveal">
            <SectionLabel count={trendingGenres.length}>Trending genres</SectionLabel>
            <div className="genre43-grid">{trendingGenres.map((g) => (<GenreCard key={g.slug} genre={g} />))}</div>
          </section>
        )}

        <div className="genre43-reveal genre43-pullquote">
          <div className="genre43-pullquote-inner"><div className="genre43-pullquote-line" /><p className="genre43-pullquote-text">Genres are routes into sound, not people. Each one is mapped through texture, colour, rhythm, and cultural geography.</p><div className="genre43-pullquote-line" /></div>
        </div>

        <section className="genre43-reveal">
          <SectionLabel count={filteredGenres.length}>Full directory</SectionLabel>
          <div className="genre43-grid">{filteredGenres.map((g) => (<GenreCard key={g.slug} genre={g} />))}</div>
          {filteredGenres.length === 0 && (<div className="genre43-empty"><WkIcon name="Compass" size={32} /><span>No genres match this search.</span></div>)}
        </section>

        <footer className="genre43-reveal genre43-footer">
          <span className="genre43-footer-brand">WAKILISHA Genres</span>
          <p className="genre43-footer-tagline">{genres.length} genres across the continent. Each one mapped through artists, tracks, and context.</p>
          <p className="genre43-footer-meta">{totalArtists.toLocaleString()} artists &middot; {totalTracks.toLocaleString()} tracks</p>
        </footer>
      </div>
    </main>
  );
}

function SectionLabel({ children, count }: { children: string; count?: number }) {
  return (<div className="genre43-section-label-row"><div className="genre43-section-label-left"><span className="genre43-section-label-text">{children}</span>{count !== undefined && <span className="genre43-section-label-count">{count}</span>}</div></div>);
}

function GenreCard({ genre }: { genre: PublicGenre }) {
  return (
    <Link to={`/genres/${genre.slug}`} className="genre43-card group">
      <div className="genre43-card-artwork-wrap">
        <Chapter19FallbackImage slug={genre.slug} name={genre.name} className="genre43-card-artwork" />
        <div className="genre43-card-artwork-name">{genre.name}</div>
      </div>
      <div className="genre43-card-body">
        <div className="genre43-card-stats-row">
          <div className="genre43-card-stat-pill"><strong>{genre.artistCount}</strong><span>Artists</span></div>
          <div className="genre43-card-stat-pill"><strong>{genre.trackCount}</strong><span>Tracks</span></div>
        </div>
        {genre.representativeArtists && genre.representativeArtists.length > 0 && (
          <div className="genre43-card-roster">{genre.representativeArtists.slice(0, 4).map((a) => (<span key={a} className="genre43-card-roster-tag">{a}</span>))}</div>
        )}
      </div>
    </Link>
  );
}