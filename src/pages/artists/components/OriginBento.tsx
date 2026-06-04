import { Link } from "react-router-dom";
import { getCountryFlagUrl, getCountryAccent, getCountryLabel } from "@/utils/countries";
import { Ch19GradientImage } from "@/components/media/Ch19GradientImage";

interface OriginArtist {
  slug: string;
  name: string;
  imageUrl?: string;
}

interface OriginGroup {
  country: string;
  artistCount: number;
  chartCount: number;
  risingCount: number;
  artists: OriginArtist[];
}

interface OriginBentoProps {
  groups: OriginGroup[];
}

export function OriginBento({ groups }: OriginBentoProps) {
  if (groups.length === 0) return null;

  const sorted = [...groups].sort((a, b) => b.artistCount - a.artistCount);
  const [hero, ...rest] = sorted;

  return (
    <section className="px-4 py-14 md:px-6 md:py-20">
      <div className="wk-container-wide">
        <div className="mb-10">
          <div className="wk-eyebrow mb-3">By origin</div>
          <h3 className="wk-h-page max-w-[16ch]">Where the sound comes from</h3>
        </div>

        {/* Featured hero country tile — full width */}
        {hero && (() => {
          const heroAccent = getCountryAccent(hero.country);
          const heroFlagUrl = getCountryFlagUrl(hero.country, 160);
          return (
            <Link
              to={`/artists?country=${encodeURIComponent(hero.country)}`}
              style={{ "--ca": heroAccent } as React.CSSProperties}
              className="group mb-4 flex flex-col overflow-hidden rounded-2xl border border-[var(--wk-border)] bg-[var(--wk-surface)] transition-all duration-[var(--wk-d-standard)] hover:border-[var(--wk-border-2)] md:flex-row"
            >
              {/* Left: flag + identity — tinted with country accent */}
              <div
                className="relative flex shrink-0 flex-col justify-center p-6 md:w-[280px] md:p-8 lg:w-[320px]"
                style={{
                  background: `linear-gradient(160deg, color-mix(in srgb, var(--ca) 22%, transparent) 0%, color-mix(in srgb, var(--ca) 5%, transparent) 100%)`,
                }}
              >
                {heroFlagUrl && (
                  <img
                    src={heroFlagUrl}
                    alt={`${hero.country} flag`}
                    className="mb-3 w-[72px] rounded-md object-cover shadow-sm md:w-[80px]"
                    style={{
                      boxShadow: `0 2px 8px color-mix(in srgb, var(--ca) 25%, transparent)`,
                    }}
                  />
                )}
                <h4 className="text-[22px] font-black tracking-[-0.03em] text-[var(--wk-text)] md:text-[26px]">
                  {hero.country}
                </h4>
                <p className="mt-2 text-[13px] font-semibold text-[var(--wk-text-muted)]">
                  {hero.artistCount} artists · {hero.chartCount} on the charts
                </p>
                {hero.risingCount > 0 && (
                  <span className="mt-3 inline-flex w-fit items-center gap-1.5 rounded-full bg-[var(--wk-success-soft)] px-3 py-1.5 text-[11px] font-bold text-[var(--wk-success)]">
                    <i className="ri-fire-line text-[10px]" />
                    {hero.risingCount} rising
                  </span>
                )}
                <div className="mt-auto hidden pt-6 md:block">
                  <span
                    className="inline-flex items-center gap-1.5 text-[12px] font-bold transition-all group-hover:gap-2.5"
                    style={{ color: "var(--ca)" }}
                  >
                    Explore artists
                    <i className="ri-arrow-right-line text-[14px]" />
                  </span>
                </div>
              </div>

              {/* Right: artist names grid */}
              <div className="flex flex-1 flex-col justify-center p-6 md:p-8">
                <p className="mb-4 text-[11px] font-bold uppercase tracking-[0.14em] text-[var(--wk-text-faint)]">Featured artists</p>
                <div className="flex flex-wrap gap-2">
                  {hero.artists.slice(0, 8).map((a) => (
                    <span
                      key={a.slug}
                      className="inline-flex items-center gap-2 rounded-full border border-[var(--wk-border)] bg-[var(--wk-bg-subtle)] px-3.5 py-2 text-[13px] font-semibold text-[var(--wk-text)] transition-all hover:border-[var(--wk-border-2)] hover:bg-[var(--wk-surface-raised)]"
                    >
                      <span className="h-5 w-5 shrink-0 overflow-hidden rounded-full bg-[var(--wk-surface-raised)]">
                        {a.imageUrl ? (
                          <img src={a.imageUrl} alt="" className="h-full w-full object-cover object-top" />
                        ) : (
                          <Ch19GradientImage slug={a.slug} name={a.name} />
                        )}
                      </span>
                      {a.name}
                    </span>
                  ))}
                </div>
              </div>
            </Link>
          );
        })()}

        {/* Rest of countries — clean 3-column grid */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:gap-4 lg:grid-cols-3">
          {rest.map((group) => {
            const accent = getCountryAccent(group.country);
            const flagUrl = getCountryFlagUrl(group.country, 80);
            return (
              <Link
                key={group.country}
                to={`/artists?country=${encodeURIComponent(group.country)}`}
                style={{ "--ca": accent } as React.CSSProperties}
                className="group relative flex flex-col rounded-xl border border-[var(--wk-border)] bg-[var(--wk-surface)] p-5 transition-all duration-[var(--wk-d-standard)] hover:-translate-y-1 md:p-6"
              >
                {/* Top accent line — country color */}
                <div
                  className="absolute inset-x-0 top-0 h-[3px] rounded-t-xl opacity-0 transition-opacity group-hover:opacity-100"
                  style={{ background: `linear-gradient(90deg, var(--ca), color-mix(in srgb, var(--ca) 60%, transparent))` }}
                />

                {/* Header */}
                <div className="mb-4 flex items-center gap-3">
                  {flagUrl ? (
                    <img
                      src={flagUrl}
                      alt={`${group.country} flag`}
                      className="h-[28px] w-[42px] shrink-0 rounded-[3px] object-cover shadow-sm md:h-[32px] md:w-[48px]"
                    />
                  ) : (
                    <span className="flex h-[28px] w-[42px] shrink-0 items-center justify-center rounded-[3px] bg-[var(--wk-surface-raised)] text-[16px] md:h-[32px] md:w-[48px]">🌍</span>
                  )}
                  <div className="min-w-0">
                    <h4 className="truncate text-[16px] font-extrabold tracking-[-0.02em] text-[var(--wk-text)] md:text-[17px]">
                      {group.country}
                    </h4>
                    <span className="text-[12px] font-semibold text-[var(--wk-text-muted)]">
                      {group.artistCount} artists
                    </span>
                  </div>
                  <div
                    className="ml-auto shrink-0 text-[var(--wk-text-faint)] transition-all group-hover:translate-x-0.5"
                    style={{ color: "var(--wk-text-faint)" }}
                  >
                    <i className="ri-arrow-right-s-line text-lg group-hover:text-[var(--ca)] transition-colors" />
                  </div>
                </div>

                {/* Stats row */}
                <div className="mb-4 flex flex-wrap gap-3 text-[11px]">
                  {group.chartCount > 0 && (
                    <span className="inline-flex items-center gap-1 font-bold text-[var(--wk-text-soft)]">
                      <i className="ri-bar-chart-line text-[10px]" style={{ color: "var(--ca)" }} />
                      {group.chartCount} chart{group.chartCount !== 1 ? "s" : ""}
                    </span>
                  )}
                  {group.risingCount > 0 && (
                    <span className="inline-flex items-center gap-1 font-bold text-[var(--wk-text-soft)]">
                      <i className="ri-fire-line text-[10px] text-[var(--wk-success)]" />
                      {group.risingCount} rising
                    </span>
                  )}
                </div>

                {/* Artist pills */}
                <div className="mt-auto flex flex-wrap gap-1.5">
                  {group.artists.slice(0, 4).map((a) => (
                    <span
                      key={a.slug}
                      className="rounded-full border border-[var(--wk-border)] bg-[var(--wk-bg-subtle)] px-2.5 py-1 text-[11px] font-semibold text-[var(--wk-text-soft)]"
                    >
                      {a.name}
                    </span>
                  ))}
                  {group.artists.length > 4 && (
                    <span className="rounded-full px-2.5 py-1 text-[11px] font-semibold text-[var(--wk-text-faint)]">
                      +{group.artists.length - 4} more
                    </span>
                  )}
                </div>

                {/* Subtle bottom wash on hover */}
                <div
                  className="pointer-events-none absolute inset-x-0 bottom-0 h-1/2 rounded-b-xl opacity-0 transition-opacity duration-[var(--wk-d-standard)] group-hover:opacity-100"
                  style={{
                    background: `linear-gradient(to top, color-mix(in srgb, var(--ca) 5%, transparent), transparent)`,
                  }}
                />
              </Link>
            );
          })}
        </div>
      </div>
    </section>
  );
}