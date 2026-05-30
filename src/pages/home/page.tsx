import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { WkTag } from "@/components/design-system/primitives/Tag";
import { WkButton } from "@/components/design-system/primitives/Button";
import { WkSurface } from "@/components/design-system/primitives/Surface";
import { ChartRow } from "@/components/design-system/music/ChartRow";
import { ArtistCard } from "@/components/design-system/registry/ArtistCard";
import { StoryCard } from "@/components/design-system/editorial/StoryCard";
import { SkeletonChartRow, SkeletonCard, SkeletonStoryCard } from "@/components/skeletons/Skeletons";
import { HOME_CHART_ENTRIES, HOME_FEATURED_ARTISTS, HOME_EDITORIAL_STORIES, HOME_GENRE_VERTICALS } from "@/mocks/home";

export default function Home() {
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const t = setTimeout(() => setLoading(false), 400);
    return () => clearTimeout(t);
  }, []);

  return (
    <>
      {/* Hero */}
      <section className="relative min-h-[520px] md:min-h-[640px] flex items-end overflow-hidden">
        <div
          className="absolute inset-0"
          style={{
            backgroundImage: "url(https://readdy.ai/api/search-image?query=African%20music%20culture%20panoramic%20editorial%20photography%2C%20vibrant%20concert%20crowd%2C%20dramatic%20stage%20lighting%2C%20cultural%20celebration%2C%20documentary%20style%2C%20warm%20tones%2C%20cinematic&width=1440&height=700&seq=hero-home&orientation=landscape)",
            backgroundSize: "cover",
            backgroundPosition: "top center",
          }}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/40 to-black/20" />
        <div className="wk-container relative w-full px-6 pb-14 pt-20">
          <div className="wk-eyebrow mb-5">The African music intelligence platform</div>
          <h1 className="wk-h-hero mb-4" style={{ color: "#F0EFE8", maxWidth: "680px" }}>
            Where the music graph lives.
          </h1>
          <p className="wk-copy mb-8 max-w-lg" style={{ color: "rgba(240,239,232,.75)" }}>
            Charts, artists, releases, labels, and editorial — rebuilt from the repaired cultural registry.
          </p>
          <div className="flex flex-wrap gap-3">
            <Link to="/charts">
              <WkButton variant="primary">
                <i className="ri-bar-chart-line" />
                View charts
              </WkButton>
            </Link>
            <Link to="/artists">
              <WkButton variant="ghost">
                Browse artists
              </WkButton>
            </Link>
          </div>

          <div className="mt-12 flex flex-wrap gap-6">
            {[
              { label: "Artists indexed", value: "4,200+" },
              { label: "Tracks catalogued", value: "18,000+" },
              { label: "Chart editions", value: "340+" },
              { label: "Releases", value: "6,800+" },
            ].map((stat) => (
              <div key={stat.label}>
                <div className="text-xl font-black text-[var(--wk-brand)]">{stat.value}</div>
                <div className="text-[12px] text-white/60">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Charts section */}
      <section className="py-16">
        <div className="wk-container px-6">
          <div className="mb-6 flex items-center justify-between">
            <div>
              <div className="wk-eyebrow mb-2">WAKILISHA charts</div>
              <h2 className="wk-h-section">Current rankings</h2>
            </div>
            <Link to="/charts">
              <WkButton variant="ghost">All charts</WkButton>
            </Link>
          </div>

          <WkSurface className="overflow-hidden">
            <div className="divide-y divide-[var(--wk-divider)]">
              {loading
                ? Array.from({ length: 5 }).map((_, i) => <SkeletonChartRow key={i} />)
                : HOME_CHART_ENTRIES.map((entry) => <ChartRow key={entry.rank} {...entry} />)}
            </div>
          </WkSurface>
        </div>
      </section>

      {/* Artists section */}
      <section className="py-16 bg-[var(--wk-bg-subtle)]">
        <div className="wk-container px-6">
          <div className="mb-6 flex items-center justify-between">
            <div>
              <div className="wk-eyebrow mb-2">Registry</div>
              <h2 className="wk-h-section">Featured artists</h2>
            </div>
            <Link to="/artists">
              <WkButton variant="ghost">Artist directory</WkButton>
            </Link>
          </div>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {loading
              ? Array.from({ length: 4 }).map((_, i) => <SkeletonCard key={i} />)
              : HOME_FEATURED_ARTISTS.map((artist) => <ArtistCard key={artist.slug} {...artist} />)}
          </div>
        </div>
      </section>

      {/* Genres section */}
      <section className="py-16">
        <div className="wk-container px-6">
          <div className="mb-6 flex items-center justify-between">
            <div>
              <div className="wk-eyebrow mb-2">Discovery</div>
              <h2 className="wk-h-section">Browse by genre</h2>
            </div>
            <Link to="/genres">
              <WkButton variant="ghost">All genres</WkButton>
            </Link>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {loading
              ? Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className="animate-pulse rounded-xl border border-[var(--wk-border)] bg-[var(--wk-surface)] p-5">
                    <div className="h-3 w-12 rounded bg-[var(--wk-surface-raised)] mb-1" />
                    <div className="h-5 w-32 rounded bg-[var(--wk-surface-raised)] mb-2" />
                    <div className="h-3 w-24 rounded bg-[var(--wk-surface-raised)]" />
                  </div>
                ))
              : HOME_GENRE_VERTICALS.map((g) => (
                  <Link
                    key={g.slug}
                    to={`/genres/${g.slug}`}
                    className="group relative overflow-hidden rounded-xl border border-[var(--wk-border)] bg-[var(--wk-surface)] p-5 transition-all hover:border-[var(--wk-border-2)]"
                  >
                    <div
                      className="absolute right-0 top-0 h-24 w-24 rounded-bl-full opacity-10 transition-opacity group-hover:opacity-15"
                      style={{ background: `var(${g.accentVar})` }}
                    />
                    <div className="mb-1 text-xs font-bold uppercase tracking-widest" style={{ color: `var(${g.accentVar})` }}>
                      Genre
                    </div>
                    <h3 className="text-[16px] font-black tracking-tight text-[var(--wk-text)]">{g.name}</h3>
                    <div className="mt-2 flex items-center gap-3 text-[12px] text-[var(--wk-text-muted)]">
                      <span>{g.artistCount} artists</span>
                      <span>{g.trackCount} tracks</span>
                    </div>
                  </Link>
                ))}
          </div>
        </div>
      </section>

      {/* Magazine section */}
      <section className="py-16 bg-[var(--wk-bg-subtle)]">
        <div className="wk-container px-6">
          <div className="mb-6 flex items-center justify-between">
            <div>
              <div className="wk-eyebrow mb-2">WAKILISHA magazine</div>
              <h2 className="wk-h-section">Editorial</h2>
            </div>
            <Link to="/magazine">
              <WkButton variant="ghost">Open magazine</WkButton>
            </Link>
          </div>

          <div className="grid gap-4 lg:grid-cols-3">
            <div className="lg:col-span-2">
              {loading ? <SkeletonStoryCard /> : <StoryCard {...HOME_EDITORIAL_STORIES[0]} isFeatured />}
            </div>
            <div className="flex flex-col gap-3">
              {loading
                ? Array.from({ length: 3 }).map((_, i) => <SkeletonStoryCard key={i} />)
                : HOME_EDITORIAL_STORIES.slice(1).map((story) => <StoryCard key={story.slug} {...story} />)}
            </div>
          </div>
        </div>
      </section>
    </>
  );
}