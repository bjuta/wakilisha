import { Link } from "react-router-dom";
import { getAuthorMeta } from "@/services/authorProfiles";
import type { MagazineArticle } from "@/services/magazineArticles";

interface CuratedGridProps {
  stories: MagazineArticle[];
}

export function CuratedGrid({ stories }: CuratedGridProps) {
  if (!stories.length) return null;

  const primary = stories[0];
  const secondary = stories.slice(1, 3);

  return (
    <section className="mag-curated">
      <div className="mag-curated-header">
        <div className="mag-curated-eyebrow">Curated for you</div>
        <h2 className="mag-curated-heading">Featured in this issue</h2>
      </div>

      <div className="mag-curated-grid">
        {primary && (
          <Link to={`/magazine/${primary.slug}`} className="mag-curated-primary">
            <div className="mag-curated-primary-image">
              <img src={primary.heroUrl} alt="" />
              <div className="mag-curated-primary-overlay" />
            </div>
            <div className="mag-curated-primary-content">
              <span className="mag-curated-primary-section">{primary.section}</span>
              <h3 className="mag-curated-primary-title">{primary.title}</h3>
              {primary.dek && <p className="mag-curated-primary-dek">{primary.dek}</p>}
              <div className="mag-curated-primary-meta">
                <Link
                  to={`/authors/${getAuthorMeta(primary.author).slug}`}
                  className="hover:text-[var(--wk-brand)] transition-colors"
                >
                  By {primary.author}
                </Link>
                <span className="mag-curated-meta-sep">·</span>
                <span>{primary.readingTime} min</span>
              </div>
            </div>
          </Link>
        )}

        <div className="mag-curated-secondary">
          {secondary.map((story) => (
            <Link
              key={story.slug}
              to={`/magazine/${story.slug}`}
              className="mag-curated-secondary-card"
            >
              <div className="mag-curated-secondary-image">
                <img src={story.heroUrl} alt="" />
              </div>
              <div className="mag-curated-secondary-content">
                <span className="mag-curated-secondary-section">{story.section}</span>
                <h4 className="mag-curated-secondary-title">{story.title}</h4>
                <div className="mag-curated-secondary-meta">
                  <Link
                    to={`/authors/${getAuthorMeta(story.author).slug}`}
                    className="hover:text-[var(--wk-brand)] transition-colors"
                  >
                    {story.author}
                  </Link>
                  <span className="mag-curated-meta-sep">·</span>
                  <span>{story.readingTime} min</span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}