import { Link } from "react-router-dom";
import { getAuthorMeta } from "@/services/authorProfiles";
import type { MagazineArticle } from "@/services/magazineArticles";

interface ArchiveStripProps {
  stories: MagazineArticle[];
}

export function ArchiveStrip({ stories }: ArchiveStripProps) {
  if (!stories.length) return null;

  return (
    <section className="mag-archive">
      <div className="mag-archive-header">
        <div className="mag-archive-eyebrow">From the archive</div>
        <h2 className="mag-archive-heading">Earlier stories worth your time</h2>
      </div>

      <div className="mag-archive-grid">
        {stories.map((story) => (
          <Link
            key={story.slug}
            to={`/magazine/${story.slug}`}
            className="mag-archive-card"
          >
            <div className="mag-archive-image">
              <img src={story.heroUrl} alt="" />
              <div className="mag-archive-image-overlay" />
            </div>
            <div className="mag-archive-content">
              <span className="mag-archive-section">{story.section}</span>
              <h3 className="mag-archive-title">{story.title}</h3>
              <div className="mag-archive-meta">
                <Link
                  to={`/authors/${getAuthorMeta(story.author).slug}`}
                  className="hover:text-[var(--wk-brand)] transition-colors"
                >
                  {story.author}
                </Link>
                <span className="mag-archive-meta-sep">·</span>
                <span>{story.date}</span>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}