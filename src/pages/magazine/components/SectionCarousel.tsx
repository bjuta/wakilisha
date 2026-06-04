import { useRef, useState, useEffect, useCallback } from "react";
import { MagazineCard } from "./MagazineCard";
import type { MagazineArticle } from "@/services/magazineArticles";

export function SectionCarousel({ stories }: { stories: MagazineArticle[] }) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(true);

  const updateArrows = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    setCanScrollLeft(el.scrollLeft > 4);
    setCanScrollRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 4);
  }, []);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    updateArrows();
    el.addEventListener("scroll", updateArrows, { passive: true });
    window.addEventListener("resize", updateArrows);
    return () => {
      el.removeEventListener("scroll", updateArrows);
      window.removeEventListener("resize", updateArrows);
    };
  }, [updateArrows, stories]);

  const scroll = (dir: "left" | "right") => {
    const el = scrollRef.current;
    if (!el) return;
    const cardWidth = el.querySelector(":scope > div")?.getBoundingClientRect().width ?? 300;
    const gap = 20;
    const amount = (cardWidth + gap) * (dir === "right" ? 1 : -1);
    el.scrollBy({ left: amount, behavior: "smooth" });
  };

  return (
    <div className="relative group/carousel">
      {/* Left arrow */}
      <button
        onClick={() => scroll("left")}
        className={`absolute -left-2 top-1/2 -translate-y-1/2 z-10 w-10 h-10 rounded-full bg-[var(--wk-surface)] border border-[var(--wk-border)] flex items-center justify-center transition-all duration-200 cursor-pointer ${
          canScrollLeft
            ? "opacity-0 group-hover/carousel:opacity-100 hover:bg-[var(--wk-brand)] hover:border-[var(--wk-brand)] hover:text-[var(--wk-brand-on)]"
            : "opacity-0 pointer-events-none"
        }`}
        aria-label="Scroll left"
      >
        <i className="ri-arrow-left-s-line text-[18px]" />
      </button>

      {/* Cards */}
      <div
        ref={scrollRef}
        className="flex gap-5 overflow-x-auto scroll-smooth scrollbar-none pb-2 -mx-6 lg:-mx-8 px-6 lg:px-8"
      >
        {stories.map((story, i) => (
          <div
            key={story.slug}
            className="shrink-0 w-[85vw] sm:w-[42vw] lg:w-[calc((100%-40px)/3)]"
          >
            <MagazineCard variant="standard" story={story} rank={i + 1} />
          </div>
        ))}
      </div>

      {/* Right arrow */}
      <button
        onClick={() => scroll("right")}
        className={`absolute -right-2 top-1/2 -translate-y-1/2 z-10 w-10 h-10 rounded-full bg-[var(--wk-surface)] border border-[var(--wk-border)] flex items-center justify-center transition-all duration-200 cursor-pointer ${
          canScrollRight
            ? "opacity-0 group-hover/carousel:opacity-100 hover:bg-[var(--wk-brand)] hover:border-[var(--wk-brand)] hover:text-[var(--wk-brand-on)]"
            : "opacity-0 pointer-events-none"
        }`}
        aria-label="Scroll right"
      >
        <i className="ri-arrow-right-s-line text-[18px]" />
      </button>
    </div>
  );
}