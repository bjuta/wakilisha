import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { SkeletonStoryCard } from "@/components/skeletons/Skeletons";
import { STORIES, TRENDING_STORIES, SECTIONS } from "@/mocks/magazine";

export default function MobileMagazine() {
  const [activeSection, setActiveSection] = useState("All");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const t = setTimeout(() => setLoading(false), 500);
    return () => clearTimeout(t);
  }, []);

  const featured = STORIES[0];
  const rest = STORIES.slice(1).filter(
    (s) => activeSection === "All" || s.section === activeSection,
  );

  const largeStories = rest.slice(0, 2);
  const wideStory = rest[2];
  const smallStories = rest.slice(3, 6);

  return (
    <div className="min-h-screen">
      {/* Cover Story Hero — full cinematic, same as desktop */}
      <section className="relative min-h-[80dvh] flex items-end overflow-hidden">
        <div
          className="absolute inset-0"
          style={{
            backgroundImage: `url(${featured.heroUrl})`,
            backgroundSize: "cover",
            backgroundPosition: "center",
          }}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/30 to-black/10" />
        <div className="absolute inset-0 bg-gradient-to-r from-black/50 via-transparent to-transparent" />

        {/* Top bar — issue badge */}
        <div className="absolute top-0 left-0 right-0 z-10 px-5 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="rounded-full border border-white/20 bg-white/10 px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-white/80 backdrop-blur-sm">
              Issue 01
            </span>
            <span className="text-[10px] font-semibold uppercase tracking-wider text-white/50">
              May 2024
            </span>
          </div>
          <span className="text-[10px] font-semibold uppercase tracking-wider text-white/50">
            WAKILISHA Editorial
          </span>
        </div>

        <div className="relative w-full px-5 pb-12 pt-20">
          <div className="max-w-2xl">
            <div className="mb-4 flex items-center gap-3">
              <span className="rounded-full bg-[var(--wk-brand)] px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-[var(--wk-brand-on)]">
                {featured.section}
              </span>
              <span className="text-[12px] font-medium text-white/60">
                {featured.readingTime} min read
              </span>
            </div>
            <h1
              className="font-black leading-[0.92] tracking-[-0.04em] text-[#F0EFE8]"
              style={{ fontSize: "clamp(28px, 9vw, 48px)" }}
            >
              {featured.title}
            </h1>
            {featured.dek && (
              <p className="mt-4 max-w-md text-[15px] leading-relaxed text-white/65">
                {featured.dek}
              </p>
            )}
            <div className="mt-6 flex items-center gap-4">
              <Link
                to={`/magazine/${featured.slug}`}
                className="inline-flex items-center gap-2 rounded-full bg-[var(--wk-brand)] px-5 py-3 text-[13px] font-bold text-[var(--wk-brand-on)] whitespace-nowrap"
              >
                Read cover story
                <i className="ri-arrow-right-line" />
              </Link>
              <span className="text-[12px] text-white/50">
                by {featured.author}
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* Trending Strip */}
      <div className="border-y border-[var(--wk-border)] bg-[var(--wk-surface)]">
        <div className="flex items-center gap-4 overflow-x-auto px-5 py-3">
          <span className="shrink-0 text-[10px] font-bold uppercase tracking-wider text-[var(--wk-brand)]">
            Trending
          </span>
          {TRENDING_STORIES.map((story, i) => (
            <Link
              key={story.slug}
              to={`/magazine/${story.slug}`}
              className="group flex items-center gap-2 whitespace-nowrap rounded-full px-3 py-1.5 text-[12px] font-semibold text-[var(--wk-text-soft)] transition-colors hover:bg-[var(--wk-surface-raised)] hover:text-[var(--wk-text)]"
            >
              <span className="text-[var(--wk-brand)] font-bold">{i + 1}</span>
              <span className="truncate max-w-[160px]">{story.title}</span>
            </Link>
          ))}
        </div>
      </div>

      <div className="px-5 py-10">
        {/* Section filter */}
        <div className="mb-8 flex flex-wrap gap-2">
          {SECTIONS.map((s) => (
            <button
              key={s}
              onClick={() => setActiveSection(s)}
              className={`rounded-full px-4 py-2 text-[13px] font-semibold transition-all whitespace-nowrap ${
                activeSection === s
                  ? "bg-[var(--wk-brand)] text-[var(--wk-brand-on)]"
                  : "border border-[var(--wk-border)] text-[var(--wk-text-soft)] hover:bg-[var(--wk-surface-raised)]"
              }`}
            >
              {s}
            </button>
          ))}
        </div>

        {/* Asymmetric grid */}
        {activeSection === "All" && !loading && (
          <div className="space-y-6">
            {/* Two large stories side by side */}
            <div className="grid grid-cols-2 gap-3">
              {largeStories.map((story) => (
                <Link
                  key={story.slug}
                  to={`/magazine/${story.slug}`}
                  className="group flex flex-col gap-3"
                >
                  <div className="relative aspect-[16/10] overflow-hidden rounded-xl bg-[var(--wk-surface-raised)]">
                    <img
                      src={story.heroUrl}
                      alt={story.title}
                      className="h-full w-full object-cover object-top transition-transform duration-500 group-hover:scale-105"
                    />
                    <div className="absolute left-2 top-2">
                      <span className="rounded-full bg-[var(--wk-brand)] px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-[var(--wk-brand-on)]">
                        {story.section}
                      </span>
                    </div>
                  </div>
                  <h2 className="text-[14px] font-bold leading-snug tracking-[-0.02em] text-[var(--wk-text)] transition-colors group-hover:text-[var(--wk-brand)]">
                    {story.title}
                  </h2>
                  <div className="text-[10px] text-[var(--wk-text-faint)]">
                    {story.author} · {story.readingTime} min
                  </div>
                </Link>
              ))}
            </div>

            {/* Wide story — dominant */}
            {wideStory && (
              <Link
                to={`/magazine/${wideStory.slug}`}
                className="group flex flex-col gap-3 overflow-hidden rounded-xl border border-[var(--wk-border)] bg-[var(--wk-surface)]"
              >
                <div className="relative aspect-[16/9] overflow-hidden bg-[var(--wk-surface-raised)]">
                  <img
                    src={wideStory.heroUrl}
                    alt={wideStory.title}
                    className="h-full w-full object-cover object-top transition-transform duration-500 group-hover:scale-105"
                  />
                  <div className="absolute left-3 top-3">
                    <span className="rounded-full bg-[var(--wk-brand)] px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-[var(--wk-brand-on)]">
                      {wideStory.section}
                    </span>
                  </div>
                </div>
                <div className="p-4">
                  <h2 className="text-[18px] font-bold leading-tight tracking-[-0.03em] text-[var(--wk-text)] transition-colors group-hover:text-[var(--wk-brand)]">
                    {wideStory.title}
                  </h2>
                  <p className="mt-2 line-clamp-2 text-[13px] leading-relaxed text-[var(--wk-text-muted)]">
                    {wideStory.body?.[0]}
                  </p>
                  <div className="mt-3 text-[11px] text-[var(--wk-text-faint)]">
                    {wideStory.author} · {wideStory.date} · {wideStory.readingTime} min
                  </div>
                </div>
              </Link>
            )}

            {/* Three small stories */}
            <div className="grid grid-cols-1 gap-4">
              {smallStories.map((story) => (
                <Link
                  key={story.slug}
                  to={`/magazine/${story.slug}`}
                  className="group flex gap-3"
                >
                  <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-lg bg-[var(--wk-surface-raised)]">
                    <img
                      src={story.heroUrl}
                      alt={story.title}
                      className="h-full w-full object-cover object-top transition-transform duration-300 group-hover:scale-105"
                    />
                  </div>
                  <div className="min-w-0 flex-1">
                    <span className="text-[9px] font-bold uppercase tracking-wider text-[var(--wk-brand)]">{story.section}</span>
                    <h3 className="mt-0.5 text-[14px] font-bold leading-snug text-[var(--wk-text)] transition-colors group-hover:text-[var(--wk-brand)]">
                      {story.title}
                    </h3>
                    <div className="mt-1 text-[10px] text-[var(--wk-text-faint)]">
                      {story.author} · {story.readingTime} min
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* Filtered view */}
        {activeSection !== "All" && (
          <div className="space-y-4">
            {loading
              ? Array.from({ length: 4 }).map((_, i) => <SkeletonStoryCard key={i} />)
              : rest.map((story) => (
                  <Link
                    key={story.slug}
                    to={`/magazine/${story.slug}`}
                    className="group flex gap-3"
                  >
                    <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-lg bg-[var(--wk-surface-raised)]">
                      <img src={story.heroUrl} alt={story.title} className="h-full w-full object-cover" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <span className="text-[9px] font-bold uppercase tracking-wider text-[var(--wk-brand)]">{story.section}</span>
                      <h3 className="mt-0.5 text-[14px] font-bold leading-snug text-[var(--wk-text)]">{story.title}</h3>
                      <div className="mt-1 text-[10px] text-[var(--wk-text-faint)]">
                        {story.author} · {story.readingTime} min
                      </div>
                    </div>
                  </Link>
                ))}
          </div>
        )}
      </div>
    </div>
  );
}