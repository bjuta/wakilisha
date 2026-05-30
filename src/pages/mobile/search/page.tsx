import { useState } from "react";
import { Link } from "react-router-dom";

const RECENT_SEARCHES = ["wakilisha", "afrobeats", "burna boy", "amapiano", "fela"];

const HOT = ["afrobeats", "amapiano", "gengetone", "bongo", "bongo flava", "gospel", "genge", "alte"];

export default function MobileSearch() {
  const [query, setQuery] = useState("");

  return (
    <div className="min-h-screen">
      {/* Search bar */}
      <div className="search-bar-zone">
        <div className="search-input">
          <i className="ri-search-line text-[var(--wk-text-muted)]" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search music, artists, charts..."
            className="flex-1 bg-transparent outline-none text-[var(--wk-text)] placeholder:text-[var(--wk-text-faint)]"
            autoFocus
          />
          {query && (
            <button onClick={() => setQuery("")} className="text-[var(--wk-text-faint)]">
              <i className="ri-close-line" />
            </button>
          )}
        </div>
      </div>

      <div className="search-sections">
        {/* Recent searches */}
        <div className="search-section-label">Recent</div>
        <div className="search-chip-row">
          {RECENT_SEARCHES.map((s) => (
            <button key={s} className="search-chip" onClick={() => setQuery(s)}>
              {s}
            </button>
          ))}
        </div>

        {/* Hot keywords */}
        <div className="search-section-label">Hot keywords</div>
        <div className="search-chip-row">
          {HOT.map((k) => (
            <button key={k} className="search-chip hot" onClick={() => setQuery(k)}>
              {k}
            </button>
          ))}
        </div>

        {/* Categories */}
        <div className="search-section-label">Categories</div>
        <div className="grid grid-cols-2 gap-2">
          {[
            { icon: "ri-bar-chart-line", label: "Charts", to: "/charts" },
            { icon: "ri-user-line", label: "Artists", to: "/artists" },
            { icon: "ri-album-line", label: "Releases", to: "/releases" },
            { icon: "ri-folder-music-line", label: "Genres", to: "/genres" },
            { icon: "ri-building-2-line", label: "Labels", to: "/labels" },
            { icon: "ri-article-line", label: "Magazine", to: "/magazine" },
          ].map((c) => (
            <Link
              key={c.to}
              to={c.to}
              className="flex items-center gap-2 rounded-xl border border-[var(--wk-border)] bg-[var(--wk-surface)] px-3 py-3 text-[var(--wk-text)]"
            >
              <i className={`${c.icon} text-[var(--wk-brand)]`} />
              <span className="text-[12px] font-bold">{c.label}</span>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}