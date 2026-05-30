import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { LABELS, FEATURED_LABELS } from "@/mocks/labels";

export default function MobileLabels() {
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const t = setTimeout(() => setLoading(false), 500);
    return () => clearTimeout(t);
  }, []);

  const filtered = LABELS.filter(
    (l) =>
      !query.trim() ||
      l.name.toLowerCase().includes(query.toLowerCase()) ||
      (l.country || "").toLowerCase().includes(query.toLowerCase()),
  );

  return (
    <div className="min-h-screen">
      {/* Institutional Hero */}
      <section className="relative min-h-[360px] flex items-end overflow-hidden">
        <div
          className="absolute inset-0"
          style={{
            backgroundImage: "url(https://readdy.ai/api/search-image?query=Abstract%20music%20industry%20institutional%20background%2C%20geometric%20patterns%2C%20vinyl%20records%20and%20sound%20waves%2C%20dark%20professional%20aesthetic%20with%20green%20and%20gold%20accents%2C%20no%20text%2C%20cinematic%20lighting%2C%20editorial%20style&width=1400&height=600&seq=label-hero-v2&orientation=landscape)",
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
            Labels
          </h1>
          <p className="mt-3 max-w-sm text-[14px] leading-relaxed text-[var(--wk-text-soft)]">
            {LABELS.length} record labels active in the African music industry.
          </p>
        </div>
      </section>

      {/* Featured labels */}
      {!loading && (
        <div className="px-5 py-6">
          <div className="mb-4 text-[10px] font-extrabold uppercase tracking-[0.22em] text-[var(--wk-brand)] flex items-center gap-2">
            <span className="w-5 h-px bg-[var(--wk-brand)]" />
            Featured labels
          </div>
          <div className="mobile-scroll-row">
            {FEATURED_LABELS.map((label) => (
              <div key={label.slug} className="relative flex-none w-[260px] overflow-hidden rounded-xl border border-[var(--wk-border)] bg-[var(--wk-surface)] p-4">
                <div className="absolute right-0 top-0 h-20 w-20 rounded-bl-full bg-[var(--wk-brand-soft)] opacity-40" />
                <div className="mb-2 flex items-center gap-2">
                  <span className="rounded-full bg-[var(--wk-brand-soft)] px-2 py-0.5 text-[9px] font-bold text-[var(--wk-brand)] uppercase">Featured</span>
                  {label.country && (
                    <span className="text-[10px] text-[var(--wk-text-muted)]">{label.country}</span>
                  )}
                </div>
                <h3 className="text-[16px] font-black text-[var(--wk-text)]">{label.name}</h3>
                <div className="mt-2 flex items-center gap-3 text-[12px] text-[var(--wk-text-muted)]">
                  <span><i className="ri-user-line text-[10px] mr-1" />{label.artistCount} artists</span>
                  <span><i className="ri-album-line text-[10px] mr-1" />{label.releaseCount} releases</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Search */}
      <div className="px-5 py-4">
        <div className="relative">
          <i className="ri-search-line absolute left-3 top-1/2 -translate-y-1/2 text-[var(--wk-text-muted)]" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search labels or countries..."
            className="w-full rounded-full border border-[var(--wk-border)] bg-[var(--wk-surface)] py-2.5 pl-10 pr-4 text-[13px] text-[var(--wk-text)] placeholder:text-[var(--wk-text-faint)] outline-none focus:border-[var(--wk-brand)]"
          />
        </div>
      </div>

      {/* Label list */}
      <div className="px-5 pb-6">
        <div className="mb-3 text-[12px] text-[var(--wk-text-muted)]">
          {filtered.length} label{filtered.length !== 1 ? "s" : ""}
        </div>

        <div className="space-y-2">
          {loading
            ? Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="animate-pulse rounded-xl border border-[var(--wk-border)] bg-[var(--wk-surface)] p-4">
                  <div className="h-5 w-40 rounded bg-[var(--wk-surface-raised)] mb-2" />
                  <div className="h-3 w-24 rounded bg-[var(--wk-surface-raised)] mb-4" />
                  <div className="flex gap-4">
                    <div className="h-3 w-16 rounded bg-[var(--wk-surface-raised)]" />
                    <div className="h-3 w-16 rounded bg-[var(--wk-surface-raised)]" />
                  </div>
                </div>
              ))
            : filtered.map((label) => (
                <div key={label.slug} className="rounded-xl border border-[var(--wk-border)] bg-[var(--wk-surface)] p-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-[15px] font-bold text-[var(--wk-text)]">{label.name}</h3>
                    {label.country && (
                      <span className="text-[10px] font-semibold text-[var(--wk-text-muted)]">{label.country}</span>
                    )}
                  </div>
                  <div className="mt-2 flex items-center gap-3 text-[12px] text-[var(--wk-text-muted)]">
                    <span><i className="ri-user-line text-[10px] mr-1" />{label.artistCount} artists</span>
                    <span><i className="ri-album-line text-[10px] mr-1" />{label.releaseCount} releases</span>
                  </div>
                  {label.featuredArtists && label.featuredArtists.length > 0 && (
                    <div className="mt-3 border-t border-[var(--wk-divider)] pt-2 text-[11px] text-[var(--wk-text-faint)]">
                      {label.featuredArtists.slice(0, 3).join(", ")}
                    </div>
                  )}
                </div>
              ))}
        </div>

        {filtered.length === 0 && !loading && (
          <div className="py-12 text-center text-[var(--wk-text-muted)]">
            <i className="ri-building-2-line mb-3 block text-4xl" />
            No labels match this search.
          </div>
        )}
      </div>
    </div>
  );
}