import { useState, useMemo } from "react";
import { Link } from "react-router-dom";
import { ARTISTS, ARTIST_FILTERS, ARTIST_STATS } from "@/mocks/artists";
import { WkIcon } from "@/components/design-system/Icon";

export default function MobileArtists() {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("All");
  const [alphaFilter, setAlphaFilter] = useState("All");

  const filtered = ARTISTS.filter((artist) => {
    const q = query.trim().toLowerCase();
    const matchesQuery = !q || artist.name.toLowerCase().includes(q) || artist.genres.some((g) => g.toLowerCase().includes(q));
    const matchesFilter = filter === "All" || artist.genres.includes(filter);
    const matchesAlpha = alphaFilter === "All" || artist.name.toUpperCase().startsWith(alphaFilter);
    return matchesQuery && matchesFilter && matchesAlpha;
  });

  const chartArtists = useMemo(() => ARTISTS.filter((a) => a.isChartArtist).sort((a, b) => a.topChartPosition - b.topChartPosition), []);
  const risingArtists = useMemo(() => ARTISTS.filter((a) => a.isRising && !a.isChartArtist), []);
  const genreShelves = useMemo(() => {
    const allGenres = Array.from(new Set(ARTISTS.flatMap((a) => a.genres)));
    return allGenres
      .map((genre) => ({ genre, artists: ARTISTS.filter((a) => a.genres.includes(genre)) }))
      .filter((s) => s.artists.length >= 2)
      .sort((a, b) => b.artists.length - a.artists.length)
      .slice(0, 5);
  }, []);
  const originGroups = useMemo(() => {
    const groups: Record<string, typeof ARTISTS> = {};
    ARTISTS.forEach((a) => { if (!groups[a.country]) groups[a.country] = []; groups[a.country].push(a); });
    return Object.entries(groups).sort(([, a], [, b]) => b.length - a.length).slice(0, 8);
  }, []);

  const ALPHABETS = ["A","B","C","D","E","F","G","H","I","J","K","L","M","N","O","P","Q","R","S","T","U","V","W","X","Y","Z"];

  return (
    <div className="wk-mobile-v5">
      <section className="charts-hdr">
        <div className="charts-ed-badge"><WkIcon name="Mic2" size={14} /> The voices</div>
        <h1 className="charts-title">Artists</h1>
        <p className="charts-meta">{ARTIST_STATS.totalArtists} artists shaping the sound of now.</p>
      </section>

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

      <div className="spec-section-hd">Chart artists</div>
      <div className="phn-scroll-row">
        {chartArtists.slice(0, 10).map((artist) => <ArtistCard key={artist.slug} artist={artist} width={156} />)}
      </div>

      {genreShelves.map((shelf) => (
        <div key={shelf.genre}>
          <div className="spec-section-hd">{shelf.genre}</div>
          <div className="phn-scroll-row">
            {shelf.artists.slice(0, 8).map((artist) => <ArtistCard key={artist.slug} artist={artist} width={140} />)}
          </div>
        </div>
      ))}

      {risingArtists.length > 0 && (
        <>
          <div className="spec-section-hd">Rising stars</div>
          <div className="phn-scroll-row">
            {risingArtists.slice(0, 8).map((artist) => <ArtistCard key={artist.slug} artist={artist} width={140} />)}
          </div>
        </>
      )}

      <div className="spec-section-hd">By country</div>
      <div className="flex flex-col gap-2 px-5 pb-4">
        {originGroups.map(([country, artists]) => (
          <div key={country} className="rounded-xl border border-[var(--wk-border)] bg-[var(--wk-surface)] p-3">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-[14px] font-bold text-[var(--wk-text)]">{country}</span>
              <span className="text-[11px] text-[var(--wk-text-muted)]">{artists.length} artists</span>
            </div>
            <div className="flex gap-2 overflow-x-auto pb-1" style={{ scrollbarWidth: "none" }}>
              {artists.slice(0, 5).map((a) => (
                <Link key={a.slug} to={`/artists/${a.slug}`} className="mobile-pressable shrink-0">
                  <div className="h-10 w-10 overflow-hidden rounded-full border border-[var(--wk-border)] bg-[var(--wk-surface-raised)]"><img src={a.imageUrl} alt="" className="h-full w-full object-cover object-top" /></div>
                </Link>
              ))}
              {artists.length > 5 && <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-[var(--wk-border)] bg-[var(--wk-surface-raised)] text-[10px] font-bold text-[var(--wk-text-muted)]">+{artists.length - 5}</div>}
            </div>
          </div>
        ))}
      </div>

      <div className="spec-section-hd">Full directory · {ARTISTS.length}</div>
      <div className="search-bar-zone">
        <label className="search-input">
          <WkIcon name="Search" size={17} className="search-input-icon" />
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search artists" />
          {query && <button onClick={() => setQuery("")} className="search-input-icon" aria-label="Clear artist search"><WkIcon name="X" size={17} /></button>}
        </label>
      </div>

      <div className="flex flex-wrap gap-1 px-5 pb-2">
        {["All", ...ALPHABETS].map((letter) => (
          <button key={letter} onClick={() => setAlphaFilter(letter)} className={`mobile-pressable h-7 min-w-[28px] rounded-md px-1.5 text-[11px] font-bold transition-all ${alphaFilter === letter ? "bg-[var(--wk-brand)] text-[var(--wk-brand-on)]" : "border border-[var(--wk-border)] text-[var(--wk-text-muted)]"}`}>{letter}</button>
        ))}
      </div>

      <div className="charts-filter-row">
        {ARTIST_FILTERS.slice(0, 12).map((item) => (
          <button key={item} onClick={() => setFilter(item)} className={`charts-filter mobile-pressable ${filter === item ? "on" : ""}`}>{item}</button>
        ))}
      </div>

      <div className="px-5 pb-2 text-[12px] text-[var(--wk-text-muted)]">
        {filtered.length} artist{filtered.length !== 1 ? "s" : ""}{filter !== "All" && ` in ${filter}`}{alphaFilter !== "All" && ` starting with ${alphaFilter}`}
      </div>

      <div className="artist-grid-2col">
        {filtered.map((artist) => <ArtistCard key={artist.slug} artist={artist} />)}
      </div>

      {filtered.length === 0 && (
        <div className="px-5 py-12 text-center text-[var(--wk-text-muted)]">
          <WkIcon name="UserSearch" size={32} className="mx-auto mb-3" />
          No artists match this search.
        </div>
      )}
    </div>
  );
}

function ArtistCard({ artist, width }: { artist: typeof ARTISTS[number]; width?: number }) {
  return (
    <Link key={artist.slug} to={`/artists/${artist.slug}`} className="acard mobile-pressable" style={width ? { width, flex: "0 0 auto" } : undefined}>
      <img src={artist.imageUrl} alt="" />
      <div className="acard-overlay">
        <div className="acard-name">{artist.name}{artist.isChartArtist && <span className="acard-badge">✓</span>}</div>
        <div className="acard-meta">{artist.isChartArtist ? `#${artist.topChartPosition || "—"} · ` : ""}{artist.genres[0]} · {artist.country}</div>
      </div>
    </Link>
  );
}
