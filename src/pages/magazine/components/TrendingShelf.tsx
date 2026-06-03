import { useRef } from "react";
import { Link } from "react-router-dom";
import type { RepairedStory } from "@/services/repairedContent/client";

interface TrendingShelfProps {
  stories: RepairedStory[];
}

export function TrendingShelf({ stories }: TrendingShelfProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  const scroll = (direction: "left" | "right") => {
    const el = scrollRef.current;
    if (!el) return;
    const scrollAmount = direction === "left" ? -320 : 320;
    el.scrollBy({ left: scrollAmount, behavior: "smooth" });
  };

  if (!stories.length) return null;

  return (
    <section className="mag-trending-v2">
      <div className="mag-trending-v2-header">
        <div className="mag-trending-v2-title-group">
          <div className="mag-trending-v2-eyebrow">Trending now</div>
          <h2 className="mag-trending-v2-heading">What people are reading</h2>
        </div>
        <div className="mag-trending-v2-arrows">
          <button
            onClick={() => scroll("left")}
            className="mag-trending-v2-arrow"
            aria-label="Scroll left"
          >
            <i className="ri-arrow-left-line" />
          </button>
          <button
            onClick={() => scroll("right")}
            className="mag-trending-v2-arrow"
            aria-label="Scroll right"
          >
            <i className="ri-arrow-right-line" />
          </button>
        </div>
      </div>

      <div className="mag-trending-v2-scroll" ref={scrollRef}>
        {stories.map((story, index) => (
          <Link
            key={story.slug}
            to={`/magazine/${story.slug}`}
            className="mag-trending-v2-card"
          >
            <div className="mag-trending-v2-rank">
              <span className="mag-trending-v2-rank-num">{index + 1}</span>
            </div>
            <div className="mag-trending-v2-image">
              <img src={story.heroUrl} alt="" />
              <div className="mag-trending-v2-image-overlay" />
            </div>
            <div className="mag-trending-v2-content">
              <span className="mag-trending-v2-section">{story.section}</span>
              <h3 className="mag-trending-v2-card-title">{story.title}</h3>
              <div className="mag-trending-v2-card-meta">
                <span>{story.author}</span>
                <span className="mag-trending-v2-meta-sep">·</span>
                <span>{story.readingTime} min</span>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}