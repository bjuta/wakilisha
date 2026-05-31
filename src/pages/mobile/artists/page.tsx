import { useState } from "react";
import { Link } from "react-router-dom";
import { ARTISTS, ARTIST_FILTERS } from "@/mocks/artists";

export default function MobileArtists() {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("All");
  const filtered = ARTISTS.filter((artist) => {
    const q = query.trim().toLowerCase();
    const matchesQuery = !q || artist.name.toLowerCase().includes(q) || artist.genres.some((g) => g.toLowerCase().includes(q));
    const matchesFilter = filter === "All" || artist.genres.includes(filter);
    return matchesQuery && matchesFilter;
  });

  return (
    <div className="wk-mobile-v5">
      <section className="charts-hdr">
        <div className="charts-ed-badge"><i className="ri-user-voice-line" /> The voices</div>
        <h1 className="charts-title">Artists</h1>
        <p className="charts-meta">{ARTISTS.length} artists shaping the sound of now.</p>
      </section>

      <div className="search-bar-zone">
        <label className="search-input">
          <i className="ri-search-line search-input-icon" />
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search artists" />
        </label>
      </div>

      <div className="charts-filter-row">
        {ARTIST_FILTERS.slice(0, 10).map((item) => (
          <button key={item} onClick={() => setFilter(item)} className={`charts-filter ${filter === item ? "on" : ""}`}>{item}</button>
        ))}
      </div>

      <div className="spec-section-hd">Chart artists</div>
      <div className="phn-scroll-row">
        {ARTISTS.filter((artist) => artist.isChartArtist).slice(0, 8).map((artist) => (
          <Link key={artist.slug} to={`/artists/${artist.slug}`} className="acard" style={{ width: 156, flex: "0 0 auto" }}>
            <img src={artist.imageUrl} alt="" />
            <div className="acard-overlay">
              <div className="acard-name">{artist.name}{artist.isChartArtist && <span className="acard-badge">✓</span>}</div>
              <div className="acard-meta">#{artist.topChartPosition || "—"} · {artist.genres[0]}</div>
            </div>
          </Link>
        ))}
      </div>

      <div className="spec-section-hd">Full directory · {filtered.length}</div>
      <div className="artist-grid-2col">
        {filtered.map((artist) => (
          <Link key={artist.slug} to={`/artists/${artist.slug}`} className="acard">
            <img src={artist.imageUrl} alt="" />
            <div className="acard-overlay">
              <div className="acard-name">{artist.name}{artist.isChartArtist && <span className="acard-badge">✓</span>}</div>
              <div className="acard-meta">{artist.genres.slice(0, 2).join(", ")} · {artist.country}</div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
