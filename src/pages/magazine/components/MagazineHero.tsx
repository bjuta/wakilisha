import { useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import { WkIcon } from "@/components/design-system/Icon";
import { ShareButton } from "@/components/design-system/share/ShareSheet";
import type { RepairedStory } from "@/services/repairedContent/client";

interface MagazineHeroProps {
  story: RepairedStory;
}

export function MagazineHero({ story }: MagazineHeroProps) {
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
        <div className="mag-hero-v2-eyebrow">
          <WkIcon name="Newspaper" size={14} />
          <span>{story.section}</span>
        </div>

        <h1 className="mag-hero-v2-title">{story.title}</h1>

        {story.dek && <p className="mag-hero-v2-dek">{story.dek}</p>}

        <div className="mag-hero-v2-meta">
          <div className="mag-hero-v2-avatar">
            <span>{story.author.slice(0, 2).toUpperCase()}</span>
          </div>
          <div className="mag-hero-v2-meta-text">
            <span className="mag-hero-v2-author">By {story.author}</span>
            <span className="mag-hero-v2-sep">·</span>
            <span>{story.date || "Undated"}</span>
            <span className="mag-hero-v2-sep">·</span>
            <span>{story.readingTime} min read</span>
          </div>
        </div>

        <div className="mag-hero-v2-actions">
          <Link
            to={`/magazine/${story.slug}`}
            className="mag-hero-v2-cta"
          >
            Read cover story
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