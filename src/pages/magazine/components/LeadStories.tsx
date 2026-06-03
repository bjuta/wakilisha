import { Link } from "react-router-dom";
import type { RepairedStory } from "@/services/repairedContent/client";

interface LeadStoriesProps {
  stories: RepairedStory[];
}

export function LeadStories({ stories }: LeadStoriesProps) {
  if (!stories.length) return null;

  const primary = stories[0];
  const secondary = stories[1];

  return (
    <section className="mag-lead-v2">
      <div className="mag-lead-v2-grid">
        {primary && (
          <Link
            to={`/magazine/${primary.slug}`}
            className="mag-lead-v2-primary"
          >
            <div className="mag-lead-v2-primary-image">
              <img src={primary.heroUrl} alt="" />
              <div className="mag-lead-v2-primary-overlay" />
            </div>
            <div className="mag-lead-v2-primary-content">
              <span className="mag-lead-v2-primary-section">
                {primary.section}
              </span>
              <h2 className="mag-lead-v2-primary-title">{primary.title}</h2>
              {primary.dek && (
                <p className="mag-lead-v2-primary-dek">{primary.dek}</p>
              )}
              <div className="mag-lead-v2-primary-meta">
                <span>By {primary.author}</span>
                <span className="mag-lead-v2-meta-sep">·</span>
                <span>{primary.readingTime} min</span>
                <span className="mag-lead-v2-meta-sep">·</span>
                <span>{primary.date}</span>
              </div>
            </div>
          </Link>
        )}

        {secondary && (
          <Link
            to={`/magazine/${secondary.slug}`}
            className="mag-lead-v2-secondary"
          >
            <div className="mag-lead-v2-secondary-image">
              <img src={secondary.heroUrl} alt="" />
            </div>
            <div className="mag-lead-v2-secondary-content">
              <span className="mag-lead-v2-secondary-section">
                {secondary.section}
              </span>
              <h3 className="mag-lead-v2-secondary-title">{secondary.title}</h3>
              {secondary.dek && (
                <p className="mag-lead-v2-secondary-dek">{secondary.dek}</p>
              )}
              <div className="mag-lead-v2-secondary-meta">
                <span>By {secondary.author}</span>
                <span className="mag-lead-v2-meta-sep">·</span>
                <span>{secondary.readingTime} min</span>
              </div>
            </div>
          </Link>
        )}
      </div>
    </section>
  );
}