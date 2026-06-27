import { Link } from "react-router-dom";
import { getAuthorMeta } from "@/services/authorProfiles";
import type { MagazineArticle } from "@/services/magazineArticles";

interface EditorPicksProps {
  stories: MagazineArticle[];
}

export function EditorPicks({ stories }: EditorPicksProps) {
  if (!stories.length) return null;

  return (
    <section className="mag-picks-v2">
      <div className="mag-picks-v2-header">
        <div className="mag-picks-v2-eyebrow">Editor’s picks</div>
        <h2 className="mag-picks-v2-heading">Selected from the graph</h2>
      </div>

      <div className="mag-picks-v2-grid">
        {stories.map((story) => (
          <Link
            key={story.slug}
            to={`/magazine/${story.slug}`}
            className="mag-picks-v2-card"
          >
            <div className="mag-picks-v2-image">
              <img src={story.heroUrl} alt="" />
              <div className="mag-picks-v2-image-overlay" />
            </div>
            <div className="mag-picks-v2-content">
              <span className="mag-picks-v2-section">{story.section}</span>
              <h3 className="mag-picks-v2-title">{story.title}</h3>
              {story.dek && (
                <p className="mag-picks-v2-dek">{story.dek}</p>
              )}
              <div className="mag-picks-v2-meta">
                <Link
                  to={`/authors/${getAuthorMeta(story.author).slug}`}
                  className="hover:text-[var(--wk-brand)] transition-colors"
                >
                  {story.author}
                </Link>
                <span className="mag-picks-v2-meta-sep">·</span>
                <span>{story.readingTime} min</span>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}