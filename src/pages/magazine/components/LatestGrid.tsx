import { Link } from "react-router-dom";
import type { RepairedStory } from "@/services/repairedContent/client";

interface LatestGridProps {
  stories: RepairedStory[];
}

export function LatestGrid({ stories }: LatestGridProps) {
  if (!stories.length) return null;

  return (
    <section className="mag-latest-v2">
      <div className="mag-latest-v2-header">
        <div className="mag-latest-v2-eyebrow">Latest</div>
        <h2 className="mag-latest-v2-heading">More from WAKILISHA Magazine</h2>
      </div>

      <div className="mag-latest-v2-grid">
        {stories.map((story, index) => (
          <Link
            key={story.slug}
            to={`/magazine/${story.slug}`}
            className={`mag-latest-v2-card ${
              index === 0 ? "mag-latest-v2-card-featured" : ""
            }`}
          >
            <div className="mag-latest-v2-image">
              <img src={story.heroUrl} alt="" />
              <div className="mag-latest-v2-image-overlay" />
            </div>
            <div className="mag-latest-v2-content">
              <span className="mag-latest-v2-section">{story.section}</span>
              <h3 className="mag-latest-v2-title">{story.title}</h3>
              {story.dek && index === 0 && (
                <p className="mag-latest-v2-dek">{story.dek}</p>
              )}
              <div className="mag-latest-v2-meta">
                <span>{story.author}</span>
                <span className="mag-latest-v2-meta-sep">·</span>
                <span>{story.readingTime} min</span>
                <span className="mag-latest-v2-meta-sep">·</span>
                <span>{story.date}</span>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}