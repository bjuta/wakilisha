import { useRef } from "react";
import { Link } from "react-router-dom";

interface Label {
  slug: string;
  name: string;
  country?: string;
  artistCount: number;
  releaseCount: number;
  isFeatured?: boolean;
  description?: string;
}

interface FeaturedLabelsShelfProps {
  labels: Label[];
}

export function FeaturedLabelsShelf({ labels }: FeaturedLabelsShelfProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  const scroll = (dir: "left" | "right") => {
    if (!scrollRef.current) return;
    const amount = dir === "left" ? -400 : 400;
    scrollRef.current.scrollBy({ left: amount, behavior: "smooth" });
  };

  return (
    <section className="py-14 md:py-20">
      <div className="wk-container px-6">
        <div className="mb-8 flex items-end justify-between">
          <div>
            <div className="wk-eyebrow mb-3">Featured</div>
            <h3 className="text-[clamp(28px,3.5vw,48px)] font-black leading-[0.92] tracking-[-0.04em] text-[var(--wk-text)]">
              Labels that matter
            </h3>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={() => scroll("left")}
              className="flex h-8 w-8 items-center justify-center rounded-full border border-[var(--wk-border)] text-[var(--wk-text-muted)] transition-all hover:bg-[var(--wk-surface-raised)] hover:text-[var(--wk-text)]"
            >
              <i className="ri-arrow-left-line text-sm" />
            </button>
            <button
              onClick={() => scroll("right")}
              className="flex h-8 w-8 items-center justify-center rounded-full border border-[var(--wk-border)] text-[var(--wk-text-muted)] transition-all hover:bg-[var(--wk-surface-raised)] hover:text-[var(--wk-text)]"
            >
              <i className="ri-arrow-right-line text-sm" />
            </button>
          </div>
        </div>
      </div>

      <div
        ref={scrollRef}
        className="flex gap-4 overflow-x-auto px-6 pb-2 scrollbar-hide"
        style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
      >
        {labels.map((label) => (
          <Link
            key={label.slug}
            to={`/labels/${label.slug}`}
            className="group relative block shrink-0 overflow-hidden rounded-xl border border-[var(--wk-border)] bg-[var(--wk-surface)] transition-all hover:border-[var(--wk-border-2)]"
            style={{ width: "340px" }}
          >
            {/* Top accent bar */}
            <div className="h-1.5 bg-[var(--wk-brand)]" />

            <div className="p-5">
              <div className="mb-4 flex items-center justify-between">
                <span className="inline-flex items-center gap-1 rounded-full bg-[var(--wk-brand-soft)] px-2.5 py-1 text-[10px] font-bold text-[var(--wk-brand)] uppercase tracking-wider">
                  <i className="ri-star-line text-[9px]" />
                  Featured
                </span>
                {label.country && (
                  <span className="text-[11px] text-[var(--wk-text-muted)]">{label.country}</span>
                )}
              </div>

              <div className="mb-4 flex items-center gap-3">
                <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-[var(--wk-brand)] text-[24px] font-black text-[var(--wk-brand-on)]">
                  {label.name.split(/[\s&]/)[0].charAt(0)}
                </div>
                <h4 className="text-[20px] font-black text-[var(--wk-text)]">{label.name}</h4>
              </div>

              {label.description && (
                <p className="mb-4 line-clamp-2 text-[13px] leading-[1.5] text-[var(--wk-text-muted)]">
                  {label.description}
                </p>
              )}

              <div className="flex items-center gap-4 border-t border-[var(--wk-border)] pt-4 text-[12px] text-[var(--wk-text-muted)]">
                <span className="inline-flex items-center gap-1">
                  <i className="ri-user-line text-[11px] text-[var(--wk-brand)]" />
                  {label.artistCount} artists
                </span>
                <span className="inline-flex items-center gap-1">
                  <i className="ri-album-line text-[11px] text-[var(--wk-brand)]" />
                  {label.releaseCount} releases
                </span>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}