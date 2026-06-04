import { Link } from "react-router-dom";
import { getAuthorMeta } from "@/services/authorProfiles";
import type { MagazineArticle } from "@/services/magazineArticles";

interface SectionSpotlightProps {
  stories: MagazineArticle[];
}

export function SectionSpotlight({ stories }: SectionSpotlightProps) {
  if (!stories.length) return null;

  const sectionMap = stories.reduce((acc, story) => {
    if (!acc[story.section]) acc[story.section] = [];
    acc[story.section].push(story);
    return acc;
  }, {} as Record<string, MagazineArticle[]>);

  const sections = Object.keys(sectionMap).sort();

  return (
    <section className="mag-spotlight-v2">
      <div className="mag-spotlight-v2-header">
        <div className="mag-spotlight-v2-eyebrow">By section</div>
        <h2 className="mag-spotlight-v2-heading">Browse by topic</h2>
      </div>

      <div className="mag-spotlight-v2-grid">
        {sections.map((section) => {
          const sectionStories = sectionMap[section].slice(0, 3);
          return (
            <div key={section} className="mag-spotlight-v2-card">
              <div className="mag-spotlight-v2-card-header">
                <span className="mag-spotlight-v2-section-name">{section}</span>
                <span className="mag-spotlight-v2-count">
                  {sectionMap[section].length} stories
                </span>
              </div>
              <div className="mag-spotlight-v2-stories">
                {sectionStories.map((story) => (
                  <Link
                    key={story.slug}
                    to={`/magazine/${story.slug}`}
                    className="mag-spotlight-v2-story"
                  >
                    <div className="mag-spotlight-v2-story-image">
                      <img src={story.heroUrl} alt="" />
                    </div>
                    <div className="mag-spotlight-v2-story-content">
                      <h4 className="mag-spotlight-v2-story-title">
                        {story.title}
                      </h4>
                      <div className="mag-spotlight-v2-story-meta">
                        <Link
                          to={`/authors/${getAuthorMeta(story.author).slug}`}
                          className="hover:text-[var(--wk-brand)] transition-colors"
                        >
                          {story.author}
                        </Link>
                        <span className="mag-spotlight-v2-meta-sep">·</span>
                        <span>{story.readingTime} min</span>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}