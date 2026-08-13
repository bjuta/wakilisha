import { Link } from "react-router-dom";
import { Ch19GradientImage } from "@/components/media/Ch19GradientImage";

interface CoverArtist {
  slug: string;
  name: string;
  imageUrl?: string;
  genres: string[];
  topChartPosition: number;
  spotlightBio: string;
  trackCount: number;
  country: string;
}

interface CoverStoriesProps {
  artists: CoverArtist[];
}

export function CoverStories({ artists }: CoverStoriesProps) {
  if (artists.length === 0) return null;

  const hero = artists[0];
  const side = artists.slice(1, 5);

  return (
    <section id="chart-focus" className="relative scroll-mt-20 overflow-hidden px-4 py-14 md:px-6 md:py-20">
      {/* Background accent */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute right-0 top-0 h-[500px] w-[500px] translate-x-1/2 rounded-full bg-[var(--wk-brand)] opacity-[0.02] blur-[100px]" />
      </div>

      <div className="wk-container-wide relative z-10">
        {/* Section header */}
        <div className="mb-10">
          <div className="wk-eyebrow mb-3">Chart focus</div>
          <h3 className="wk-h-page max-w-[16ch]">Artists near the top of the charts</h3>
        </div>

        {/* Asymmetric layout: 1 big hero + side stack */}
        <div className="flex flex-col gap-4 lg:flex-row lg:gap-5">
          {/* HERO CARD — spans 2/3 */}
          <Link
            to={`/artists/${hero.slug}`}
            className="group relative flex min-h-[420px] flex-col justify-end overflow-hidden rounded-2xl border border-[var(--wk-border)] bg-[var(--wk-surface)] transition-all duration-[var(--wk-d-standard)] hover:-translate-y-1 hover:border-[var(--wk-border-2)] lg:w-[62%] lg:min-h-[520px]"
          >
            {/* Image fill */}
            <div className="absolute inset-0 bg-[var(--wk-surface-raised)]">
              {hero.imageUrl ? (
                <img
                  src={hero.imageUrl}
                  alt={hero.name}
                  className="h-full w-full object-cover object-top transition-transform duration-[700ms] ease-out group-hover:scale-105"
                />
              ) : (
                <Ch19GradientImage slug={hero.slug} name={hero.name} />
              )}
            </div>

            {/* Gradient overlay */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/30 to-black/10" />

            {/* Content */}
            <div className="relative z-10 p-6 md:p-8 lg:p-10">
              {/* Badge */}
              <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-[var(--wk-brand)] px-3 py-1.5">
                <span className="text-[10px] font-extrabold uppercase tracking-[0.15em] text-[var(--wk-brand-on)]">Featured artist</span>
              </div>

              <h4 className="mb-3 font-black text-[clamp(28px,4vw,52px)] leading-[0.95] tracking-[-0.035em] text-white">
                {hero.name}
              </h4>
              <p className="mb-4 line-clamp-2 max-w-[52ch] text-[15px] leading-[1.6] text-white/60 md:text-[16px]">
                {hero.spotlightBio}
              </p>
              <div className="flex flex-wrap items-center gap-3 text-[13px] text-white/45">
                <span className="inline-flex items-center gap-1.5">
                  <i className="ri-bar-chart-line text-[12px]" />
                  Peak #{hero.topChartPosition}
                </span>
                {hero.country && hero.country !== "Unknown" && (
                  <>
                    <span>·</span>
                    <span>{hero.country}</span>
                  </>
                )}
                {hero.trackCount > 0 && (
                  <>
                    <span>·</span>
                    <span>
                      {hero.trackCount} {hero.trackCount === 1 ? "track" : "tracks"}
                    </span>
                  </>
                )}
              </div>
            </div>
          </Link>

          {/* SIDE STACK — 4 cards in 2x2 grid */}
          <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:w-[38%]">
            {side.map((artist) => (
              <Link
                key={artist.slug}
                to={`/artists/${artist.slug}`}
                className="group relative flex flex-col justify-end overflow-hidden rounded-xl border border-[var(--wk-border)] bg-[var(--wk-surface)] transition-all duration-[var(--wk-d-standard)] hover:-translate-y-1 hover:border-[var(--wk-border-2)]"
                style={{ minHeight: "200px" }}
              >
                <div className="absolute inset-0 bg-[var(--wk-surface-raised)]">
                  {artist.imageUrl ? (
                    <img
                      src={artist.imageUrl}
                      alt={artist.name}
                      className="h-full w-full object-cover object-top transition-transform duration-[var(--wk-d-slow)] group-hover:scale-105"
                    />
                  ) : (
                    <Ch19GradientImage slug={artist.slug} name={artist.name} />
                  )}
                </div>
                <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/20 to-transparent" />
                <div className="relative z-10 p-4">
                  <h5 className="text-[15px] font-extrabold leading-tight text-white md:text-[16px]">
                    {artist.name}
                  </h5>
                  <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-white/50">
                    {artist.country && artist.country !== "Unknown" && (
                      <>
                        <span>{artist.country}</span>
                        <span>·</span>
                      </>
                    )}
                    <span>#{artist.topChartPosition}</span>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-1">
                    {artist.genres.slice(0, 2).map((g) => (
                      <span key={g} className="rounded-full border border-white/15 bg-white/8 px-2 py-0.5 text-[9px] font-semibold text-white/70 backdrop-blur-sm">
                        {g}
                      </span>
                    ))}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}