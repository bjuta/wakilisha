import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { GENRES, TRENDING_GENRES } from "@/mocks/genres";

export default function MobileGenres() {
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const t = setTimeout(() => setLoading(false), 400);
    return () => clearTimeout(t);
  }, []);

  return (
    <div className="min-h-screen">
      {/* Cinematic Hero — cultural territories feel */}
      <section className="relative min-h-[360px] flex items-end overflow-hidden">
        <div
          className="absolute inset-0"
          style={{
            backgroundImage: "url(https://readdy.ai/api/search-image?query=Abstract%20African%20cultural%20soundscape%20visualization%2C%20colorful%20geometric%20patterns%20representing%20music%20genres%2C%20warm%20and%20cool%20tones%20blending%2C%20dark%20background%2C%20artistic%20digital%20art%2C%20no%20text%2C%20cinematic%20lighting%2C%20high%20contrast&width=1400&height=600&seq=genre-hero-v2&orientation=landscape)",
            backgroundSize: "cover",
            backgroundPosition: "center",
          }}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-[var(--wk-bg)] via-[var(--wk-bg)]/70 to-[var(--wk-bg)]/30" />

        <div className="relative w-full px-5 pb-10 pt-20">
          <div className="text-[10px] font-extrabold uppercase tracking-[0.22em] text-[var(--wk-brand)] mb-3 flex items-center gap-2">
            <span className="w-5 h-px bg-[var(--wk-brand)]" />
            Discovery
          </div>
          <h1 className="font-black leading-[0.92] tracking-[-0.055em] text-[var(--wk-text)]" style={{ fontSize: "clamp(36px, 12vw, 56px)" }}>
            Genre directory
          </h1>
          <p className="mt-3 max-w-sm text-[14px] leading-relaxed text-[var(--wk-text-soft)]">
            Browse the WAKILISHA cultural map by genre.
          </p>
        </div>
      </section>

      {/* Trending genres */}
      {!loading && (
        <div className="px-5 py-8">
          <div className="mb-4 text-[10px] font-extrabold uppercase tracking-[0.22em] text-[var(--wk-brand)] flex items-center gap-2">
            <span className="w-5 h-px bg-[var(--wk-brand)]" />
            Trending now
          </div>
          <div className="mobile-scroll-row">
            {TRENDING_GENRES.map((g) => (
              <Link
                key={g.slug}
                to={`/genres/${g.slug}`}
                className="group relative flex-none w-[240px] overflow-hidden rounded-xl border border-[var(--wk-border)] bg-[var(--wk-surface)] p-4"
              >
                <div
                  className="absolute right-0 top-0 h-28 w-28 rounded-bl-full opacity-[0.08]"
                  style={{ background: `var(${g.accentVar})` }}
                />
                <div className="mb-2 flex items-center gap-2">
                  <div className="flex h-5 w-5 items-center justify-center rounded-full bg-[var(--wk-brand-soft)] text-[var(--wk-brand)]">
                    <i className="ri-fire-line text-[10px]" />
                  </div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--wk-brand)]">Trending</span>
                  {g.growth > 0 && (
                    <span className="text-[10px] font-bold text-[var(--wk-success)]">+{g.growth}%</span>
                  )}
                </div>
                <h3 className="text-[16px] font-black tracking-tight text-[var(--wk-text)]">{g.name}</h3>
                <div className="mt-2 flex items-center gap-3 text-[12px] text-[var(--wk-text-muted)]">
                  <span><i className="ri-user-line text-[10px] mr-1" />{g.artistCount}</span>
                  <span><i className="ri-music-2-line text-[10px] mr-1" />{g.trackCount}</span>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* All genres */}
      <div className="px-5 py-6">
        <div className="mb-3 text-[12px] text-[var(--wk-text-muted)]">
          {GENRES.length} genres · {GENRES.reduce((s, g) => s + g.artistCount, 0).toLocaleString()} artists total
        </div>
        <div className="grid grid-cols-1 gap-2">
          {loading
            ? Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="animate-pulse rounded-xl border border-[var(--wk-border)] bg-[var(--wk-surface)] p-4">
                  <div className="h-3 w-12 rounded bg-[var(--wk-surface-raised)] mb-1" />
                  <div className="h-5 w-32 rounded bg-[var(--wk-surface-raised)] mb-2" />
                  <div className="h-3 w-24 rounded bg-[var(--wk-surface-raised)]" />
                </div>
              ))
            : GENRES.map((g) => (
                <Link
                  key={g.slug}
                  to={`/genres/${g.slug}`}
                  className="group relative flex items-center gap-3 overflow-hidden rounded-xl border border-[var(--wk-border)] bg-[var(--wk-surface)] p-4"
                >
                  <div className="h-8 w-1 rounded-full" style={{ background: `var(${g.accentVar})` }} />
                  <div className="flex-1 min-w-0">
                    <div className="text-[10px] font-bold uppercase tracking-wider text-[var(--wk-brand)]">Genre</div>
                    <h3 className="text-[16px] font-black tracking-tight text-[var(--wk-text)]">{g.name}</h3>
                    <div className="mt-1 flex items-center gap-3 text-[12px] text-[var(--wk-text-muted)]">
                      <span><i className="ri-user-line text-[10px] mr-1" />{g.artistCount}</span>
                      <span><i className="ri-music-2-line text-[10px] mr-1" />{g.trackCount}</span>
                    </div>
                  </div>
                  <i className="ri-arrow-right-s-line text-[var(--wk-text-faint)]" />
                </Link>
              ))}
        </div>
      </div>
    </div>
  );
}