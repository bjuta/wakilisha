import { useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import { WkIcon } from "@/components/design-system/Icon";
import { ShareButton } from "@/components/design-system/share/ShareSheet";
import type { MagazineArticle } from "@/services/magazineArticles";
import { ArticleAuthorIdentity } from "@/components/design-system/editorial/ArticleAuthorIdentity";

interface IssueCoverHeroProps {
  story: MagazineArticle;
  issueNumber: number;
  issueDate: string;
}

export function IssueCoverHero({ story, issueNumber, issueDate }: IssueCoverHeroProps) {
  const heroRef = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);

  useEffect(() => {
    const hero = heroRef.current;
    const img = imgRef.current;
    if (!hero || !img) return;

    const handleScroll = () => {
      const scrollY = window.scrollY;
      const heroHeight = hero.offsetHeight;
      const progress = Math.min(scrollY / heroHeight, 1);
      const scale = 1 + progress * 0.08;
      const opacity = 0.85 - progress * 0.35;
      img.style.transform = `scale(${scale})`;
      img.style.opacity = String(Math.max(opacity, 0.4));
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <section ref={heroRef} className="mag-hero-v2">
      <div className="mag-hero-v2-media">
        <img
          ref={imgRef}
          className="mag-hero-v2-img"
          src={story.heroUrl}
          alt={story.title}
        />
        <div className="mag-hero-v2-overlay" />
        <div className="mag-hero-v2-grain" />
      </div>

      <div className="mag-hero-v2-content">
        <div className="mag-hero-v2-issue-badge">
          <span className="mag-hero-v2-issue-num">Issue {issueNumber}</span>
          <span className="mag-hero-v2-issue-sep">·</span>
          <span>{issueDate}</span>
        </div>

        <div className="mag-hero-v2-eyebrow">
          <WkIcon name="Newspaper" size={14} />
          <span>Cover Story</span>
        </div>

        <h1 className="mag-hero-v2-title">{story.title}</h1>

        {story.dek && <p className="mag-hero-v2-dek">{story.dek}</p>}

        <div className="mag-hero-v2-meta">
          <ArticleAuthorIdentity name={story.author} personPath={story.authorPersonPath}

            className="mag-hero-v2-avatar hover:opacity-80 transition-opacity"
          >
            <span>{story.author.slice(0, 2).toUpperCase()}</span>
          </ArticleAuthorIdentity>
          <div className="mag-hero-v2-meta-text">
            <ArticleAuthorIdentity name={story.author} personPath={story.authorPersonPath}

              className="mag-hero-v2-author hover:text-white/90 transition-colors"
            >
              By {story.author}
            </ArticleAuthorIdentity>
            <span className="mag-hero-v2-sep">·</span>
            <span>{story.date || "Undated"}</span>
            <span className="mag-hero-v2-sep">·</span>
            <span>{story.readingTime} min read</span>
          </div>
        </div>

        <div className="mag-hero-v2-actions">
          <Link to={`/magazine/${story.slug}`} className="mag-hero-v2-cta">
            Read the cover story
            <WkIcon name="ArrowRight" size={16} />
          </Link>
          <ShareButton
            item={{
              title: story.title,
              subtitle: story.author,
              description: story.dek,
              imageUrl: story.heroUrl,
              type: "article",
            }}
          />
        </div>
      </div>

      <div className="mag-hero-v2-scroll-hint">
        <div className="mag-hero-v2-scroll-line" />
      </div>
    </section>
  );
}