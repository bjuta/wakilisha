import { useState, useMemo } from "react";
import { Link } from "react-router-dom";
import { ARTISTS, ARTIST_FILTERS, ARTIST_STATS } from "@/mocks/artists";

export default function MobileArtists() {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("All");
  const [alphaFilter, setAlphaFilter] = useState("All");

  const filtered = ARTISTS.filter((artist) => {
    const q = query.trim().toLowerCase();
    const matchesQuery =
      !q ||
      artist.name.toLowerCase().includes(q) ||
      artist.genres.some((g) => g.toLowerCase().includes(q));
    const matchesFilter =
      filter === "All" || artist.genres.includes(filter);
    const matchesAlpha =
      alphaFilter === "All" || artist.name.toUpperCase().startsWith(alphaFilter);
    return matchesQuery && matchesFilter && matchesAlpha;
  });

  const chartArtists = useMemo(
    () =>
      ARTISTS.filter((a) => a.isChartArtist).sort(
        (a, b) => a.topChartPosition - b.topChartPosition
      ),
    []
  );

  const risingArtists = useMemo(
    () => ARTISTS.filter((a) => a.isRising && !a.isChartArtist),
    []
  );

  const genreShelves = useMemo(() => {
    const allGenres = Array.from(new Set(ARTISTS.flatMap((a) => a.genres)));
    return allGenres
      .map((genre) => ({
        genre,
        artists: ARTISTS.filter((a) => a.genres.includes(genre)),
      }))
      .filter((s) => s.artists.length >= 2)
      .sort((a, b) => b.artists.length - a.artists.length)
      .slice(0, 5);
  }, []);

  const originGroups = useMemo(() => {
    const groups: Record<string, typeof ARTISTS> = {};
    ARTISTS.forEach((a) => {
      if (!groups[a.country]) groups[a.country] = [];
      groups[a.country].push(a);
    });
    return Object.entries(groups)
      .sort(([, a], [, b]) => b.length - a.length)
      .slice(0, 8);
  }, []);

  const ALPHABETS = ["A","B","C","D","E","F","G","H","I","J","K","L","M","N","O","P","Q","R","S","T","U","V","W","X","Y","Z"];

  return (
    <div className="wk-mobile-v5">
      {/* Header */}
      <section className="charts-hdr">
        <div className="charts-ed-badge"><i className="ri-user-voice-line" /> The voices</div>
        <h1 className="charts-title">Artists</h1>
        <p className="charts-meta">{ARTIST_STATS.totalArtists} artists shaping the sound of now.</p>
      </section>

      {/* Stats strip */}
      <div className="grid grid-cols-4 gap-px border-y border-[var(--wk-border)]" style={{ background: "var(--wk-border)" }}>
        {[
          { label: "Artists", value: ARTIST_STATS.totalArtists },
          { label: "Chart", value: ARTIST_STATS.chartArtists },
          { label: "Tracks", value: ARTIST_STATS.totalTracks },
          { label: "Countries", value: originGroups.length },
        ].map((stat) => (
          <div key={stat.label} className="bg-[var(--wk-surface)] px-2 py-3 text-center">
            <div className="text-[16px] font-black text-[var(--wk-brand)]">{stat.value}</div>
            <div className="text-[9px] font-bold uppercase tracking-wider text-[var(--wk-text-muted)]">{stat.label}</div>
          </div>
        ))}
      </div>

      {/* Chart artists shelf */}
      <div className="spec-section-hd">Chart artists</div>
      <div className="phn-scroll-row">
        {chartArtists.slice(0, 10).map((artist) => (
          <Link key={artist.slug} to={`/artists/${artist.slug}`} className="acard" style={{ width: 156, flex: "0 0 auto" }}>
            <img src={artist.imageUrl} alt="" />
            <div className="acard-overlay">
              <div className="acard-name">
                {artist.name}
                <span className="acard-badge">✓</span>
              </div>
              <div className="acard-meta">#{artist.topChartPosition || "—"} · {artist.genres[0]}</div>
            </div>
          </Link>
        ))}
      </div>

      {/* Genre shelves — same as desktop */}
      {genreShelves.map((shelf) => (
        <div key={shelf.genre}>
          <div className="spec-section-hd">{shelf.genre}</div>
          <div className="phn-scroll-row">
            {shelf.artists.slice(0, 8).map((artist) => (
              <Link key={artist.slug} to={`/artists/${artist.slug}`} className="acard" style={{ width: 140, flex: "0 0 auto" }}>
                <img src={artist.imageUrl} alt="" />
                <div className="acard-overlay">
                  <div className="acard-name">{artist.name}</div>
                  <div className="acard-meta">{artist.country}</div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      ))}

      {/* Rising stars */}
      {risingArtists.length > 0 && (
        <>
          <div className="spec-section-hd">Rising stars</div>
          <div className="phn-scroll-row">
            {risingArtists.slice(0, 8).map((artist) => (
              <Link key={artist.slug} to={`/artists/${artist.slug}`} className="acard" style={{ width: 140, flex: "0 0 auto" }}>
                <img src={artist.imageUrl} alt="" />
                <div className="acard-overlay">
                  <div className="acard-name">{artist.name}</div>
                  <div className="acard-meta">{artist.genres[0]}</div>
                </div>
              </Link>
            ))}
          </div>
        </>
      )}

      {/* Country / origin groups */}
      <div className="spec-section-hd">By country</div>
      <div className="px-5 pb-4 flex flex-col gap-2">
        {originGroups.map(([country, artists]) => (
          <div key={country} className="rounded-xl border border-[var(--wk-border)] bg-[var(--wk-surface)] p-3">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[14px] font-bold text-[var(--wk-text)]">{country}</span>
              <span className="text-[11px] text-[var(--wk-text-muted)]">{artists.length} artists</span>
            </div>
            <div className="flex gap-2 overflow-x-auto pb-1" style={{ scrollbarWidth: "none" }}>
              {artists.slice(0, 5).map((a) => (
                <Link key={a.slug} to={`/artists/${a.slug}`} className="shrink-0">
                  <div className="h-10 w-10 overflow-hidden rounded-full border border-[var(--wk-border)] bg-[var(--wk-surface-raised)]">
                    <img src={a.imageUrl} alt="" className="h-full w-full object-cover object-top" />
                  </div>
                </Link>
              ))}
              {artists.length > 5 && (
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-[var(--wk-border)] bg-[var(--wk-surface-raised)] text-[10px] font-bold text-[var(--wk-text-muted)]">
                  +{artists.length - 5}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Full directory with search + filters */}
      <div className="spec-section-hd">Full directory · {ARTISTS.length}</div>

      <div className="search-bar-zone">
        <label className="search-input">
          <i className="ri-search-line search-input-icon" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search artists"
          />
          {query && (
            <button onClick={() => setQuery("")} className="search-input-icon">
              <i className="ri-close-line" />
            </button>
          )}
        </label>
      </div>

      {/* Alphabet filter */}
      <div className="px-5 pb-2 flex flex-wrap gap-1">
        {["All", ...ALPHABETS].map((letter) => (
          <button
            key={letter}
            onClick={() => setAlphaFilter(letter)}
            className={`h-7 min-w-[28px] rounded-md px-1.5 text-[11px] font-bold transition-all ${
              alphaFilter === letter
                ? "bg-[var(--wk-brand)] text-[var(--wk-brand-on)]"
                : "border border-[var(--wk-border)] text-[var(--wk-text-muted)]"
            }`}
          >
            {letter}
          </button>
        ))}
      </div>

      {/* Genre filter */}
      <div className="charts-filter-row">
        {ARTIST_FILTERS.slice(0, 12).map((item) => (
          <button
            key={item}
            onClick={() => setFilter(item)}
            className={`charts-filter ${filter === item ? "on" : ""}`}
          >
            {item}
          </button>
        ))}
      </div>

      {/* Results count */}
      <div className="px-5 pb-2 text-[12px] text-[var(--wk-text-muted)]">
        {filtered.length} artist{filtered.length !== 1 ? "s" : ""}
        {filter !== "All" && ` in ${filter}`}
        {alphaFilter !== "All" && ` starting with ${alphaFilter}`}
      </div>

      <div className="artist-grid-2col">
        {filtered.map((artist) => (
          <Link key={artist.slug} to={`/artists/${artist.slug}`} className="acard">
            <img src={artist.imageUrl} alt="" />
            <div className="acard-overlay">
              <div className="acard-name">
                {artist.name}
                {artist.isChartArtist && <span className="acard-badge">✓</span>}
              </div>
              <div className="acard-meta">
                {artist.genres.slice(0, 2).join(", ")} · {artist.country}
              </div>
            </div>
          </Link>
        ))}
      </div>

      {filtered.length === 0 && (
        <div className="px-5 py-12 text-center text-[var(--wk-text-muted)]">
          <i className="ri-user-search-line mb-3 block text-3xl" />
          No artists match this search.
        </div>
      )}
    </div>
  );
}