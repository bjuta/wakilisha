import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { GenreCard } from "@/components/design-system/registry/GenreCard";
import { WkTag } from "@/components/design-system/primitives/Tag";
import { GENRES, TRENDING_GENRES } from "@/mocks/genres";

export default function Genres() {
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const t = setTimeout(() => setLoading(false), 400);
    return () => clearTimeout(t);
  }, []);

  return (
    <div className="min-h-screen">
      {/* Cinematic Hero — cultural territories feel */}
      <section className="relative min-h-[400px] md:min-h-[520px] flex items-end overflow-hidden">
        <div
          className="absolute inset-0"
          style={{
            backgroundImage: "url(https://readdy.ai/api/search-image?query=Abstract%20African%20cultural%20soundscape%20visualization%2C%20colorful%20geometric%20patterns%20representing%20music%20genres%2C%20warm%20and%20cool%20tones%20blending%2C%20dark%20background%2C%20artistic%20digital%20art%2C%20no%20text%2C%20cinematic%20lighting%2C%20high%20contrast&width=1400&height=600&seq=genre-hero-v2&orientation=landscape)",
            backgroundSize: "cover",
            backgroundPosition: "center",
          }}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-black/20" />
        <div className="relative wk-container-wide w-full px-6 pb-12 pt-20 md:pb-16">
          <div className="wk-eyebrow mb-4" style={{ color: "var(--wk-brand)" }}>
            Discovery
          </div>
          <h1 className="font-black leading-[0.92] tracking-[-0.055em] text-[#F0EFE8]" style={{ fontSize: "clamp(40px, 6vw, 80px)" }}>
            Genre directory
          </h1>
          <p className="mt-4 max-w-xl text-[16px] leading-relaxed text-white/70">
            Browse the WAKILISHA cultural map by genre. Each genre surfaces artists, tracks, and releases from the graph.
          </p>
        </div>
      </section>

      <div className="wk-container-wide px-6 py-10">
        {/* Trending genres — horizontal shelf, more visual */}
        {!loading && (
          <div className="mb-12">
            <div className="mb-5 flex items-center gap-3">
              <div className="wk-eyebrow">Trending now</div>
            </div>
            <div className="flex gap-3 overflow-x-auto pb-4 scrollbar-hide">
              {TRENDING_GENRES.map((g) => (
                <Link
                  key={g.slug}
                  to={`/genres/${g.slug}`}
                  className="group relative flex-none w-[280px] overflow-hidden rounded-xl border border-[var(--wk-border)] bg-[var(--wk-surface)] p-5 transition-all hover:border-[var(--wk-border-2)]"
                >
                  <div
                    className="absolute right-0 top-0 h-32 w-32 rounded-bl-full opacity-[0.08] transition-opacity group-hover:opacity-[0.14]"
                    style={{ background: `var(${g.accentVar})` }}
                  />
                  <div className="mb-3 flex items-center gap-2">
                    <div className="flex h-6 w-6 items-center justify-center rounded-full bg-[var(--wk-brand-soft)] text-[var(--wk-brand)]">
                      <i className="ri-fire-line text-xs" />
                    </div>
                    <span className="text-[11px] font-bold uppercase tracking-wider text-[var(--wk-brand)]">Trending</span>
                    {g.growth > 0 && (
                      <span className="text-[11px] font-bold text-[var(--wk-success)]">+{g.growth}%</span>
                    )}
                  </div>
                  <h3 className="text-[18px] font-black tracking-tight text-[var(--wk-text)]">{g.name}</h3>
                  <div className="mt-3 flex items-center gap-3 text-[13px] text-[var(--wk-text-muted)]">
                    <span className="inline-flex items-center gap-1"><i className="ri-user-line" /> {g.artistCount} artists</span>
                    <span className="inline-flex items-center gap-1"><i className="ri-music-2-line" /> {g.trackCount} tracks</span>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* All genres — grid with visual weight */}
        <div className="mb-5 flex items-center justify-between">
          <div className="text-[13px] text-[var(--wk-text-muted)]">
            {GENRES.length} genres · {GENRES.reduce((s, g) => s + g.artistCount, 0).toLocaleString()} artists total
          </div>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {loading
            ? Array.from({ length: 9 }).map((_, i) => (
                <div key={i} className="animate-pulse rounded-xl border border-[var(--wk-border)] bg-[var(--wk-surface)] p-5">
                  <div className="h-3 w-12 rounded bg-[var(--wk-surface-raised)] mb-1" />
                  <div className="h-5 w-32 rounded bg-[var(--wk-surface-raised)] mb-2" />
                  <div className="h-3 w-48 rounded bg-[var(--wk-surface-raised)] mb-2" />
                  <div className="flex gap-2">
                    <div className="h-5 w-16 rounded-full bg-[var(--wk-surface-raised)]" />
                    <div className="h-5 w-16 rounded-full bg-[var(--wk-surface-raised)]" />
                    <div className="h-5 w-16 rounded-full bg-[var(--wk-surface-raised)]" />
                  </div>
                </div>
              ))
            : GENRES.map((g) => <GenreCard key={g.slug} {...g} />)}
        </div>
      </div>
    </div>
  );
}