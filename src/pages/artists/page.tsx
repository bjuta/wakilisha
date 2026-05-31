import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { PageHero } from "@/components/design-system/PageHero";
import { ShareButton } from "@/components/design-system/share/ShareSheet";
import { WkIcon } from "@/components/design-system/Icon";
import { ARTISTS, ARTIST_FILTERS, ALPHABET, ARTIST_STATS } from "@/mocks/artists";

type ViewMode = "grid" | "list";
const PAGE_SIZE = 24;

const countryLabel = (country?: string) => country || "Unknown origin";

export default function Artists() {
  const [filter, setFilter] = useState("All");
  const [alphaFilter, setAlphaFilter] = useState("All");
  const [query, setQuery] = useState("");
  const [view, setView] = useState<ViewMode>("grid");
  const [page, setPage] = useState(1);

  const coverArtists = useMemo(() => ARTISTS.filter((a) => a.isChartArtist).sort((a, b) => (a.topChartPosition || 999) - (b.topChartPosition || 999)).slice(0, 4), []);
  const featured = coverArtists[0] ?? ARTISTS[0];
  const sideArtists = coverArtists.slice(1, 4);
  const recentlyAdded = ARTISTS.slice(-6).reverse();

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return ARTISTS.filter((artist) => {
      const matchesFilter = filter === "All" || artist.genres.some((g) => g === filter);
      const matchesQuery = !q || artist.name.toLowerCase().includes(q) || artist.genres.some((g) => g.toLowerCase().includes(q)) || countryLabel(artist.country).toLowerCase().includes(q);
      const matchesAlpha = alphaFilter === "All" || artist.name.toUpperCase().startsWith(alphaFilter);
      return matchesFilter && matchesQuery && matchesAlpha;
    });
  }, [filter, alphaFilter, query]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const stats = [
    { value: ARTIST_STATS.totalArtists.toLocaleString(), label: "Artists" },
    { value: ARTIST_STATS.chartArtists.toLocaleString(), label: "Chart artists" },
    { value: ARTIST_STATS.totalTracks.toLocaleString(), label: "Tracks" },
  ];

  const updateFilter = (next: string) => { setFilter(next); setPage(1); };
  const updateAlpha = (next: string) => { setAlphaFilter(next); setPage(1); };

  return (
    <div className="min-h-screen">
      <div className="wk-container-wide px-4 md:px-6">
        <PageHero
          variant="artist"
          eyebrow={<><WkIcon name="Mic2" size={14} /> The voices</>}
          title="Artists"
          subtitle="A human, photographic directory of WAKILISHA artists: chart voices, rising names, country scenes, genre lanes, and registry relationships."
          backgroundImage={featured?.imageUrl}
          stats={stats}
          actions={<ShareButton item={{ title: "WAKILISHA Artists", subtitle: `${ARTISTS.length} artists`, description: "Browse WAKILISHA artists by genre, chart presence, origin, and alphabetical index.", imageUrl: featured?.imageUrl, type: "artist" }} />}
        />

        {featured && (
          <section className="artist-featured">
            <Link to={`/artists/${featured.slug}`} className="artist-feature-card">
              {featured.imageUrl && <img src={featured.imageUrl} alt="" />}
              <div className="artist-feature-body">
                <div className="artist-feature-kicker">Featured artist</div>
                <h2 className="artist-feature-name">{featured.name}</h2>
                <div className="artist-feature-meta">{countryLabel(featured.country)} · {featured.genres.slice(0, 3).join(", ")} · {featured.trackCount} tracks</div>
                <div className="artist-feature-actions">
                  {featured.isChartArtist && <span className="artist-status"><WkIcon name="BadgeCheck" size={12} /> Chart artist</span>}
                  {featured.isRising && <span className="artist-status"><WkIcon name="TrendingUp" size={12} /> Rising</span>}
                </div>
              </div>
            </Link>
            <div className="artist-side-list">
              {sideArtists.map((artist) => (
                <Link key={artist.slug} to={`/artists/${artist.slug}`} className="artist-side-card">
                  <div className="artist-side-img">{artist.imageUrl && <img src={artist.imageUrl} alt="" />}</div>
                  <div className="min-w-0">
                    <div className="artist-list-name">{artist.name}</div>
                    <div className="artist-list-sub">#{artist.topChartPosition || "—"} · {artist.genres[0]} · {countryLabel(artist.country)}</div>
                  </div>
                  <WkIcon name="ArrowRight" size={16} />
                </Link>
              ))}
            </div>
          </section>
        )}

        <div className="directory-toolbar">
          <div className="directory-filters">
            {ARTIST_FILTERS.slice(0, 12).map((f) => (
              <button key={f} onClick={() => updateFilter(f)} className={`directory-filter ${filter === f ? "on" : ""}`}>{f}</button>
            ))}
          </div>
          <div className="directory-tools">
            <input className="directory-search" value={query} onChange={(e) => { setQuery(e.target.value); setPage(1); }} placeholder="Search artist, genre, or country" />
            <div className="view-toggle" aria-label="View mode">
              <button className={view === "grid" ? "on" : ""} onClick={() => setView("grid")}><WkIcon name="Grid2X2" size={15} /></button>
              <button className={view === "list" ? "on" : ""} onClick={() => setView("list")}><WkIcon name="List" size={15} /></button>
            </div>
          </div>
        </div>

        <div className="az-strip">
          <button onClick={() => updateAlpha("All")} className={`az-btn ${alphaFilter === "All" ? "on" : ""}`}>All</button>
          {ALPHABET.map((letter) => <button key={letter} onClick={() => updateAlpha(letter)} className={`az-btn ${alphaFilter === letter ? "on" : ""}`}>{letter}</button>)}
        </div>

        <section>
          <div className="section-head">
            <div>
              <div className="section-kicker">Full artist directory</div>
              <h2 className="section-title">{filtered.length} artists found</h2>
            </div>
            <p className="section-copy">Grid mode prioritizes photographic browsing. List mode prioritizes dense comparison across origin, genre, tracks, releases, and chart presence.</p>
          </div>

          {view === "grid" ? (
            <div className="artist-directory-grid">
              {paginated.map((artist) => <ArtistTile key={artist.slug} artist={artist} />)}
            </div>
          ) : (
            <div className="artist-directory-list">
              {paginated.map((artist) => <ArtistListRow key={artist.slug} artist={artist} />)}
            </div>
          )}

          {filtered.length === 0 && <div className="artist-empty"><WkIcon name="UserSearch" size={32} /><div className="mt-3">No artists match this search.</div></div>}

          {totalPages > 1 && (
            <div className="mt-8 flex items-center justify-center gap-2">
              <button className="directory-filter" disabled={page === 1} onClick={() => setPage(Math.max(1, page - 1))}><WkIcon name="ArrowLeft" size={14} /></button>
              <span className="text-[12px] font-bold text-[var(--wk-text-muted)]">Page {page} of {totalPages}</span>
              <button className="directory-filter" disabled={page === totalPages} onClick={() => setPage(Math.min(totalPages, page + 1))}><WkIcon name="ArrowRight" size={14} /></button>
            </div>
          )}
        </section>

        <section className="pg-layout cols-2 pb-10">
          <div className="pg-block">
            <div className="pg-block-label">Recently added</div>
            <div className="space-y-2">
              {recentlyAdded.map((artist) => <ArtistListRow key={artist.slug} artist={artist} compact />)}
            </div>
          </div>
          <div className="pg-block">
            <div className="pg-block-label">Directory rule</div>
            <h3 className="pg-block-title">Artists are human and photographic.</h3>
            <p className="pg-block-body">Unlike genres, artist cards should preserve portrait/image presence, identity, status, country, genre metadata, and chart relevance. The directory must work both as a beautiful browse page and a dense registry.</p>
          </div>
        </section>
      </div>
    </div>
  );
}

function ArtistTile({ artist }: { artist: typeof ARTISTS[number] }) {
  return (
    <Link to={`/artists/${artist.slug}`} className="artist-card">
      <div className="artist-card-img">{artist.imageUrl && <img src={artist.imageUrl} alt="" />}</div>
      {artist.isChartArtist && <div className="artist-card-verify"><WkIcon name="BadgeCheck" size={12} /></div>}
      <div className="artist-card-body">
        <div className="artist-card-name">{artist.name}</div>
        <div className="artist-card-meta">{countryLabel(artist.country)} · {artist.trackCount} tracks · {artist.releaseCount} releases</div>
        <div className="artist-card-tags">{artist.genres.slice(0, 2).map((genre) => <span key={genre} className="tag tag-sm">{genre}</span>)}</div>
      </div>
    </Link>
  );
}

function ArtistListRow({ artist, compact = false }: { artist: typeof ARTISTS[number]; compact?: boolean }) {
  return (
    <Link to={`/artists/${artist.slug}`} className="artist-list-item">
      <div className="artist-list-ava artist-list-avatar">{artist.imageUrl && <img src={artist.imageUrl} alt="" />}</div>
      <div className="min-w-0">
        <div className="artist-list-name">{artist.name} {artist.isChartArtist && <span className="text-[var(--wk-brand)]">✓</span>}</div>
        <div className="artist-list-sub">{countryLabel(artist.country)} · {artist.genres.slice(0, compact ? 1 : 3).join(", ")}</div>
      </div>
      <div className="artist-list-stat">{artist.isChartArtist ? `#${artist.topChartPosition}` : artist.trackCount}</div>
    </Link>
  );
}
