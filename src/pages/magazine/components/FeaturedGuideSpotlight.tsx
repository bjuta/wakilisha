import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { fetchFeaturedGuides, type FeaturedGuide } from "@/services/magazineFeaturedGuides";
import { Chapter19FallbackImage } from "@/components/media/Chapter19FallbackImage";

const GUIDE_COLOR_MAP: Record<string, string> = {
  "--wk-v-art": "#C7A06D",
  "--wk-v-language": "#6BA8F5",
  "--wk-v-music": "#84C241",
  "--wk-v-film": "#D6766A",
  "--wk-v-fashion": "#C7A06D",
  "--wk-v-food": "#E8A23A",
  "--wk-v-places": "#4FD9C2",
};

function getGuideAccent(guide: FeaturedGuide): string {
  if (guide.guide_color_var && GUIDE_COLOR_MAP[guide.guide_color_var]) {
    return GUIDE_COLOR_MAP[guide.guide_color_var];
  }
  return "var(--wk-brand)";
}

function formatGuideDate(dateStr: string | null): string {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("en", { month: "short", year: "numeric" });
}

export function FeaturedGuideSpotlight() {
  const [guides, setGuides] = useState<FeaturedGuide[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    fetchFeaturedGuides().then((data) => {
      if (!cancelled) {
        setGuides(data);
        setLoading(false);
      }
    }).catch(() => {
      if (!cancelled) setLoading(false);
    });
    return () => { cancelled = true; };
  }, []);

  if (loading) {
    return (
      <section className="mag-reveal">
        <div className="flex items-center gap-3 mb-8">
          <span className="w-7 h-px bg-[var(--wk-brand)]" />
          <span className="text-[10px] font-black uppercase tracking-[0.22em] text-[var(--wk-brand)]">Featured Guide</span>
        </div>
        <div className="animate-pulse rounded-2xl border border-[var(--wk-border)] bg-[var(--wk-surface)] overflow-hidden" style={{ minHeight: 320 }}>
          <div className="h-full w-full bg-[var(--wk-surface-raised)]" />
        </div>
      </section>
    );
  }

  if (guides.length === 0) return null;

  const primary = guides[0];
  const accent = getGuideAccent(primary);

  return (
    <section className="mag-reveal">
      <div className="flex items-end justify-between mb-8 gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <span className="text-[10px] font-black uppercase tracking-[0.22em] text-[var(--wk-brand)]">
            Featured Guide
          </span>
          <span className="text-[11px] font-semibold text-[var(--wk-text-faint)] bg-[var(--wk-surface)] border border-[var(--wk-border)] px-2.5 py-0.5 rounded-full">
            {guides.length} {guides.length === 1 ? "guide" : "guides"}
          </span>
        </div>
        <Link
          to="/guides"
          className="text-[12px] font-bold text-[var(--wk-text-muted)] hover:text-[var(--wk-brand)] transition-colors flex items-center gap-1 whitespace-nowrap"
        >
          All guides <i className="ri-arrow-right-line text-[11px]" />
        </Link>
      </div>

      {/* Primary featured guide — large hero card */}
      <Link
        to={`/guides/${primary.guide_slug}`}
        className="group relative block overflow-hidden rounded-2xl border border-[var(--wk-border)] bg-[var(--wk-surface)] transition-all duration-500 hover:border-[var(--wk-border-strong)] hover:-translate-y-1 cursor-pointer"
      >
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-0 lg:items-stretch">
          {/* Image side */}
          <div className="lg:col-span-3 relative overflow-hidden" style={{ minHeight: 320 }}>
            {primary.guide_hero_url ? (
              <img
                src={primary.guide_hero_url}
                alt={primary.guide_title}
                className="absolute inset-0 w-full h-full object-cover object-top transition-transform duration-700 group-hover:scale-105"
              />
            ) : (
              <div className="absolute inset-0 bg-[var(--wk-surface-raised)]">
                <Chapter19FallbackImage
                  id={primary.id}
                  slug={primary.guide_slug}
                  name={primary.guide_title}
                />
              </div>
            )}
            {/* Gradient overlay */}
            <div className="absolute inset-0 bg-gradient-to-r from-black/40 via-transparent to-transparent lg:bg-gradient-to-t lg:from-black/60 lg:via-black/10 lg:to-transparent" />
            {/* Format badge on image */}
            {primary.guide_format && (
              <div className="absolute top-5 left-5 z-10">
                <span
                  className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[11px] font-black uppercase tracking-wider text-white backdrop-blur-md"
                  style={{ backgroundColor: accent + "CC" }}
                >
                  <i className="ri-book-open-line text-[12px]" />
                  {primary.guide_format}
                </span>
              </div>
            )}
          </div>

          {/* Content side */}
          <div className="lg:col-span-2 flex flex-col justify-center p-6 lg:p-8 gap-4">
            {/* Decorative line */}
            <div className="flex items-center gap-3">
              <div className="w-8 h-px rounded-full" style={{ backgroundColor: accent }} />
              <span className="text-[10px] font-black uppercase tracking-[0.2em] text-[var(--wk-brand)]">
                Spotlight
              </span>
            </div>

            <h3 className="text-[clamp(24px,3vw,36px)] font-black tracking-[-0.04em] leading-[1.05] text-[var(--wk-text)] group-hover:text-[var(--wk-brand)] transition-colors duration-300">
              {primary.guide_title}
            </h3>

            {primary.guide_subtitle && (
              <p className="text-[15px] font-semibold text-[var(--wk-text-muted)] leading-snug">
                {primary.guide_subtitle}
              </p>
            )}

            {primary.guide_excerpt && (
              <p className="text-[14px] leading-relaxed text-[var(--wk-text-soft)] line-clamp-3">
                {primary.guide_excerpt}
              </p>
            )}

            <div className="flex items-center gap-3 pt-1">
              <span
                className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[12px] font-bold text-white transition-transform group-hover:translate-x-0.5"
                style={{ backgroundColor: accent }}
              >
                Read guide
                <i className="ri-arrow-right-line text-[12px]" />
              </span>
              {primary.guide_published_at && (
                <span className="text-[12px] text-[var(--wk-text-faint)] font-semibold">
                  {formatGuideDate(primary.guide_published_at)}
                </span>
              )}
            </div>
          </div>
        </div>
      </Link>

      {/* Secondary guides — compact row */}
      {guides.length > 1 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mt-5">
          {guides.slice(1).map((guide) => {
            const guideAccent = getGuideAccent(guide);
            return (
              <Link
                key={guide.id}
                to={`/guides/${guide.guide_slug}`}
                className="group relative flex flex-col overflow-hidden rounded-xl border border-[var(--wk-border)] bg-[var(--wk-surface)] transition-all duration-300 hover:border-[var(--wk-border-strong)] hover:-translate-y-1 cursor-pointer"
              >
                {/* Top accent bar */}
                <div className="h-1 w-full" style={{ backgroundColor: guideAccent }} />
                <div className="p-5 flex flex-col gap-3">
                  <div className="flex items-center gap-2">
                    {guide.guide_format && (
                      <span
                        className="text-[9px] font-black uppercase tracking-[0.16em] px-2 py-0.5 rounded-full text-white"
                        style={{ backgroundColor: guideAccent + "CC" }}
                      >
                        {guide.guide_format}
                      </span>
                    )}
                    {guide.guide_published_at && (
                      <span className="text-[11px] text-[var(--wk-text-faint)]">
                        {formatGuideDate(guide.guide_published_at)}
                      </span>
                    )}
                  </div>
                  <h4 className="text-[16px] font-black tracking-[-0.02em] leading-snug text-[var(--wk-text)] group-hover:text-[var(--wk-brand)] transition-colors line-clamp-2">
                    {guide.guide_title}
                  </h4>
                  {guide.guide_subtitle && (
                    <p className="text-[13px] text-[var(--wk-text-muted)] line-clamp-2">
                      {guide.guide_subtitle}
                    </p>
                  )}
                  <div className="flex items-center gap-1 text-[12px] font-bold mt-auto pt-1" style={{ color: guideAccent }}>
                    <span>Read guide</span>
                    <i className="ri-arrow-right-line text-[12px] transition-transform group-hover:translate-x-1" />
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </section>
  );
}