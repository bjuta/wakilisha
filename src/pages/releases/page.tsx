import { useState, useEffect } from "react";
import { PageHero } from "@/components/design-system/primitives/PageHero";
import { WkTag } from "@/components/design-system/primitives/Tag";
import { ReleaseCard } from "@/components/design-system/registry/ReleaseCard";
import { SkeletonSquare } from "@/components/skeletons/Skeletons";
import { RELEASES, RELEASE_FILTERS, RELEASE_GENRE_BREAKDOWN } from "@/mocks/releases";

export default function Releases() {
  const [filter, setFilter] = useState("All");
  const [viewMode, setViewMode] = useState<"grid" | "timeline">("grid");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const t = setTimeout(() => setLoading(false), 500);
    return () => clearTimeout(t);
  }, []);

  const filtered = filter === "All" ? RELEASES : RELEASES.filter((r) => r.releaseType === filter);

  return (
    <div className="min-h-screen">
      {/* Cinematic Hero — release catalog */}
      <section className="relative min-h-[400px] md:min-h-[520px] flex items-end overflow-hidden">
        <div
          className="absolute inset-0"
          style={{
            backgroundImage: "url(https://readdy.ai/api/search-image?query=Abstract%20music%20album%20covers%20and%20vinyl%20records%20floating%20in%20dark%20space%2C%20colorful%20square%20artworks%2C%20warm%20studio%20lighting%2C%20artistic%20collection%20display%2C%20no%20text%2C%20cinematic%2C%20high%20contrast%2C%20editorial%20photography%20style&width=1400&height=600&seq=release-hero-v2&orientation=landscape)",
            backgroundSize: "cover",
            backgroundPosition: "center",
          }}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-black/20" />
        <div className="relative wk-container-wide w-full px-6 pb-12 pt-20 md:pb-16">
          <div className="wk-eyebrow mb-4" style={{ color: "var(--wk-brand)" }}>
            Registry
          </div>
          <h1 className="font-black leading-[0.92] tracking-[-0.055em] text-[#F0EFE8]" style={{ fontSize: "clamp(40px, 6vw, 80px)" }}>
            Release catalog
          </h1>
          <p className="mt-4 max-w-xl text-[16px] leading-relaxed text-white/70">
            {RELEASES.length} releases catalogued. Albums, EPs, and singles from the repaired graph.
          </p>
        </div>
      </section>

      <div className="wk-container-wide px-6 py-10">
        {/* Genre breakdown — visual bars */}
        {!loading && (
          <div className="mb-10">
            <div className="mb-4 flex items-center gap-3">
              <div className="wk-eyebrow">By genre</div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {RELEASE_GENRE_BREAKDOWN.map((g) => (
                <div
                  key={g.genre}
                  className="group relative overflow-hidden rounded-xl border border-[var(--wk-border)] bg-[var(--wk-surface)] px-4 py-4 transition-all hover:border-[var(--wk-border-2)]"
                >
                  <div className="absolute bottom-0 left-0 h-1 rounded-full transition-all" style={{ width: `${g.percentage}%`, background: `var(${g.accentVar})` }} />
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div
                        className="h-8 w-1 rounded-full"
                        style={{ background: `var(${g.accentVar})` }}
                      />
                      <div>
                        <div className="text-[14px] font-bold text-[var(--wk-text)]">{g.genre}</div>
                        <div className="text-[12px] text-[var(--wk-text-muted)]">{g.count} releases</div>
                      </div>
                    </div>
                    <div className="text-[14px] font-black text-[var(--wk-brand)]">{g.percentage}%</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Filters + view toggle */}
        <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap gap-2">
            {RELEASE_FILTERS.map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`rounded-full px-4 py-2 text-[13px] font-semibold transition-all whitespace-nowrap ${
                  filter === f
                    ? "bg-[var(--wk-brand)] text-[var(--wk-brand-on)]"
                    : "border border-[var(--wk-border)] text-[var(--wk-text-soft)] hover:bg-[var(--wk-surface-raised)]"
                }`}
              >
                {f}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-1 rounded-full border border-[var(--wk-border)] bg-[var(--wk-surface)] p-1">
            <button
              onClick={() => setViewMode("grid")}
              className={`flex h-7 w-7 items-center justify-center rounded-full text-[13px] transition-all ${
                viewMode === "grid"
                  ? "bg-[var(--wk-brand)] text-[var(--wk-brand-on)]"
                  : "text-[var(--wk-text-muted)] hover:text-[var(--wk-text)]"
              }`}
              aria-label="Grid view"
            >
              <i className="ri-layout-grid-line" />
            </button>
            <button
              onClick={() => setViewMode("timeline")}
              className={`flex h-7 w-7 items-center justify-center rounded-full text-[13px] transition-all ${
                viewMode === "timeline"
                  ? "bg-[var(--wk-brand)] text-[var(--wk-brand-on)]"
                  : "text-[var(--wk-text-muted)] hover:text-[var(--wk-text)]"
              }`}
              aria-label="Timeline view"
            >
              <i className="ri-list-check" />
            </button>
          </div>
        </div>

        <div className="mb-4 text-[13px] text-[var(--wk-text-muted)]">
          {filtered.length} release{filtered.length !== 1 ? "s" : ""}
        </div>

        {/* Grid view */}
        {viewMode === "grid" && (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {loading
              ? Array.from({ length: 8 }).map((_, i) => <SkeletonSquare key={i} />)
              : filtered.map((release) => <ReleaseCard key={release.slug} {...release} />)}
          </div>
        )}

        {/* Timeline view */}
        {viewMode === "timeline" && (
          <div className="space-y-3">
            {loading
              ? Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className="animate-pulse flex items-center gap-4 rounded-xl border border-[var(--wk-border)] bg-[var(--wk-surface)] p-4">
                    <div className="h-14 w-14 rounded-lg bg-[var(--wk-surface-raised)]" />
                    <div className="flex-1 space-y-2">
                      <div className="h-4 w-48 rounded bg-[var(--wk-surface-raised)]" />
                      <div className="h-3 w-24 rounded bg-[var(--wk-surface-raised)]" />
                    </div>
                  </div>
                ))
              : filtered.map((release) => (
                  <div
                    key={release.slug}
                    className="flex items-center gap-4 rounded-xl border border-[var(--wk-border)] bg-[var(--wk-surface)] p-4 transition-all hover:border-[var(--wk-border-2)]"
                  >
                    <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-lg bg-[var(--wk-surface-raised)]">
                      {release.artworkUrl ? (
                        <img
                          src={release.artworkUrl}
                          alt={release.title}
                          className="h-full w-full object-cover object-top"
                        />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center">
                          <i className="ri-album-line text-xl text-[var(--wk-text-faint)]" />
                        </div>
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <h3 className="truncate text-[14px] font-bold text-[var(--wk-text)]">{release.title}</h3>
                        <WkTag>{release.releaseType}</WkTag>
                      </div>
                      <div className="text-[12px] text-[var(--wk-text-muted)]">{release.artist}</div>
                      <div className="mt-1 flex items-center gap-3 text-[11px] text-[var(--wk-text-faint)]">
                        <span>{release.year}</span>
                        {release.trackCount && <span>{release.trackCount} tracks</span>}
                        {release.labelName && <span>{release.labelName}</span>}
                      </div>
                    </div>
                  </div>
                ))}
          </div>
        )}
      </div>
    </div>
  );
}