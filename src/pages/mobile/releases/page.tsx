import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { RELEASES, RELEASE_FILTERS, RELEASE_GENRE_BREAKDOWN } from "@/mocks/releases";

export default function MobileReleases() {
  const [filter, setFilter] = useState("All");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const t = setTimeout(() => setLoading(false), 500);
    return () => clearTimeout(t);
  }, []);

  const filtered = filter === "All" ? RELEASES : RELEASES.filter((r) => r.releaseType === filter);

  return (
    <div className="min-h-screen">
      {/* Cinematic Hero */}
      <section className="relative min-h-[360px] flex items-end overflow-hidden">
        <div
          className="absolute inset-0"
          style={{
            backgroundImage: "url(https://readdy.ai/api/search-image?query=Abstract%20music%20album%20covers%20and%20vinyl%20records%20floating%20in%20dark%20space%2C%20colorful%20square%20artworks%2C%20warm%20studio%20lighting%2C%20artistic%20collection%20display%2C%20no%20text%2C%20cinematic%2C%20high%20contrast%2C%20editorial%20photography%20style&width=1400&height=600&seq=release-hero-v2&orientation=landscape)",
            backgroundSize: "cover",
            backgroundPosition: "center",
          }}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-[var(--wk-bg)] via-[var(--wk-bg)]/70 to-[var(--wk-bg)]/30" />

        <div className="relative w-full px-5 pb-10 pt-20">
          <div className="text-[10px] font-extrabold uppercase tracking-[0.22em] text-[var(--wk-brand)] mb-3 flex items-center gap-2">
            <span className="w-5 h-px bg-[var(--wk-brand)]" />
            Registry
          </div>
          <h1 className="font-black leading-[0.92] tracking-[-0.055em] text-[var(--wk-text)]" style={{ fontSize: "clamp(36px, 12vw, 56px)" }}>
            Release catalog
          </h1>
          <p className="mt-3 max-w-sm text-[14px] leading-relaxed text-[var(--wk-text-soft)]">
            {RELEASES.length} releases catalogued. Albums, EPs, and singles.
          </p>
        </div>
      </section>

      {/* Genre breakdown */}
      {!loading && (
        <div className="px-5 py-6">
          <div className="mb-4 text-[10px] font-extrabold uppercase tracking-[0.22em] text-[var(--wk-brand)] flex items-center gap-2">
            <span className="w-5 h-px bg-[var(--wk-brand)]" />
            By genre
          </div>
          <div className="space-y-2">
            {RELEASE_GENRE_BREAKDOWN.map((g) => (
              <div
                key={g.genre}
                className="relative overflow-hidden rounded-xl border border-[var(--wk-border)] bg-[var(--wk-surface)] px-4 py-3"
              >
                <div className="absolute bottom-0 left-0 h-1 rounded-full" style={{ width: `${g.percentage}%`, background: `var(${g.accentVar})` }} />
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="h-6 w-1 rounded-full" style={{ background: `var(${g.accentVar})` }} />
                    <div>
                      <div className="text-[13px] font-bold text-[var(--wk-text)]">{g.genre}</div>
                      <div className="text-[11px] text-[var(--wk-text-muted)]">{g.count} releases</div>
                    </div>
                  </div>
                  <div className="text-[13px] font-black text-[var(--wk-brand)]">{g.percentage}%</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="px-5 py-4">
        <div className="flex flex-wrap gap-2">
          {RELEASE_FILTERS.map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`rounded-full px-4 py-2 text-[12px] font-semibold transition-all whitespace-nowrap ${
                filter === f
                  ? "bg-[var(--wk-brand)] text-[var(--wk-brand-on)]"
                  : "border border-[var(--wk-border)] text-[var(--wk-text-soft)] hover:bg-[var(--wk-surface-raised)]"
              }`}
            >
              {f}
            </button>
          ))}
        </div>
        <div className="mt-3 text-[12px] text-[var(--wk-text-muted)]">
          {filtered.length} release{filtered.length !== 1 ? "s" : ""}
        </div>
      </div>

      {/* Release grid */}
      <div className="px-5 pb-8">
        <div className="grid grid-cols-2 gap-3">
          {loading
            ? Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="animate-pulse rounded-xl border border-[var(--wk-border)] bg-[var(--wk-surface)] overflow-hidden">
                  <div className="aspect-square bg-[var(--wk-surface-raised)]" />
                  <div className="p-3 space-y-2">
                    <div className="h-4 w-3/4 rounded bg-[var(--wk-surface-raised)]" />
                    <div className="h-3 w-1/2 rounded bg-[var(--wk-surface-raised)]" />
                  </div>
                </div>
              ))
            : filtered.map((release) => (
                <Link
                  key={release.slug}
                  to={`/releases/${release.slug}`}
                  className="group rounded-xl border border-[var(--wk-border)] bg-[var(--wk-surface)] overflow-hidden transition-all hover:border-[var(--wk-border-2)]"
                >
                  <div className="relative aspect-square bg-[var(--wk-surface-raised)]">
                    {release.artworkUrl ? (
                      <img
                        src={release.artworkUrl}
                        alt={release.title}
                        className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center">
                        <i className="ri-album-line text-3xl text-[var(--wk-text-faint)]" />
                      </div>
                    )}
                  </div>
                  <div className="p-3">
                    <h3 className="text-[13px] font-bold text-[var(--wk-text)] truncate">{release.title}</h3>
                    <div className="text-[11px] text-[var(--wk-text-muted)] truncate">{release.artist}</div>
                    <div className="mt-2 flex items-center gap-2">
                      <span className="rounded-full bg-[var(--wk-brand-soft)] px-2 py-0.5 text-[9px] font-bold text-[var(--wk-brand)] uppercase">{release.releaseType}</span>
                      <span className="text-[10px] text-[var(--wk-text-faint)]">{release.year}</span>
                    </div>
                  </div>
                </Link>
              ))}
        </div>
      </div>
    </div>
  );
}