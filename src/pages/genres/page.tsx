import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { PageHero } from "@/components/design-system/primitives/PageHero";
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
    <>
      <PageHero
        eyebrow="Discovery"
        title="Genre directory"
        subtitle="Browse the WAKILISHA cultural map by genre. Each genre surfaces artists, tracks, and releases from the graph."
      />

      <div className="wk-container px-6 py-10">
        {/* Trending genres */}
        {!loading && (
          <div className="mb-10">
            <div className="mb-4 flex items-center gap-3">
              <div className="wk-eyebrow">Trending now</div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {TRENDING_GENRES.map((g) => (
                <Link
                  key={g.slug}
                  to={`/genres/${g.slug}`}
                  className="group relative overflow-hidden rounded-xl border border-[var(--wk-border)] bg-[var(--wk-surface)] p-5 transition-all hover:border-[var(--wk-border-2)]"
                >
                  <div
                    className="absolute right-0 top-0 h-24 w-24 rounded-bl-full opacity-10 transition-opacity group-hover:opacity-15"
                    style={{ background: `var(${g.accentVar})` }}
                  />
                  <div className="mb-2 flex items-center gap-2">
                    <div className="flex h-6 w-6 items-center justify-center rounded-full bg-[var(--wk-brand-soft)] text-[var(--wk-brand)]">
                      <i className="ri-fire-line text-xs" />
                    </div>
                    <span className="text-[11px] font-bold uppercase tracking-wider text-[var(--wk-brand)]">
                      Trending
                    </span>
                  </div>
                  <h3 className="text-[16px] font-black tracking-tight text-[var(--wk-text)]">{g.name}</h3>
                  <div className="mt-2 flex items-center gap-3 text-[12px] text-[var(--wk-text-muted)]">
                    <span>{g.artistCount} artists</span>
                    <span>{g.trackCount} tracks</span>
                  </div>
                  <div className="mt-2 text-[11px] text-[var(--wk-text-faint)]">
                    {g.growth > 0 && <span className="text-[var(--wk-success)]">+{g.growth}% this month</span>}
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* All genres */}
        <div className="mb-4 flex items-center justify-between">
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
    </>
  );
}