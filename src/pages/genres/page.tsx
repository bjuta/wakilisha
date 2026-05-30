import { useState, useEffect } from "react";
import { PageHero } from "@/components/design-system/primitives/PageHero";
import { GenreCard } from "@/components/design-system/registry/GenreCard";
import { GENRES } from "@/mocks/genres";

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
        <div className="mb-4 text-[13px] text-[var(--wk-text-muted)]">
          {GENRES.length} genres · {GENRES.reduce((s, g) => s + g.artistCount, 0).toLocaleString()} artists total
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