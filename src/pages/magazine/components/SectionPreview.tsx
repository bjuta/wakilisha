import { Link } from "react-router-dom";
import { getAuthorMeta } from "@/services/authorProfiles";
import type { MagazineArticle } from "@/services/magazineArticles";

interface SectionPreviewProps {
  stories: MagazineArticle[];
  onSectionFilter: (section: string) => void;
}

export function SectionPreview({ stories, onSectionFilter }: SectionPreviewProps) {
  if (!stories.length) return null;

  const sectionMap = stories.reduce((acc, story) => {
    const section = story.section || "Article";
    if (!acc[section]) acc[section] = [];
    acc[section].push(story);
    return acc;
  }, {} as Record<string, MagazineArticle[]>);

  const sections = Object.keys(sectionMap).sort();

  return (
    <section className="mag-section-preview">
      <div className="mag-section-preview-header">
        <div className="mag-section-preview-eyebrow">Browse by section</div>
        <h2 className="mag-section-preview-heading">More to explore</h2>
      </div>

      <div className="mag-section-preview-grid">
        {sections.map((section) => {
          const sectionStories = sectionMap[section].slice(0, 2);
          const totalCount = sectionMap[section].length;
          return (
            <div key={section} className="mag-section-preview-card">
              <div className="mag-section-preview-card-header">
                <span className="mag-section-preview-name">{section}</span>
                <button
                  onClick={() => onSectionFilter(section)}
                  className="mag-section-preview-view-all"
                >
                  View all {totalCount}
                  <i className="ri-arrow-right-line" />
                </button>
              </div>
              <div className="mag-section-preview-stories">
                {sectionStories.map((story) => (
                  <Link
                    key={story.slug}
                    to={`/magazine/${story.slug}`}
                    className="mag-section-preview-story"
                  >
                    <div className="mag-section-preview-story-image">
                      <img src={story.heroUrl} alt="" />
                    </div>
                    <div className="mag-section-preview-story-content">
                      <h4 className="mag-section-preview-story-title">
                        {story.title}
                      </h4>
                      <div className="mag-section-preview-story-meta">
                        <Link
                          to={`/authors/${getAuthorMeta(story.author).slug}`}
                          className="hover:text-[var(--wk-brand)] transition-colors"
                        >
                          {story.author}
                        </Link>
                        <span className="mag-section-preview-meta-sep">·</span>
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