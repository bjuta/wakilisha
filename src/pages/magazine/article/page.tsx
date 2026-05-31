import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { STORIES, SECTIONS } from "@/mocks/magazine";
import { ShareButton } from "@/components/design-system/share/ShareSheet";
import { WkIcon } from "@/components/design-system/Icon";

function sectionMeta(name: string) {
  return SECTIONS.find((section: any) => (typeof section === "string" ? section : section.name) === name) as any || SECTIONS[0] as any;
}

export default function ArticlePage() {
  const { slug } = useParams<{ slug: string }>();
  const [progress, setProgress] = useState(0);
  const article = STORIES.find((story) => story.slug === slug) ?? STORIES[0];
  const meta = sectionMeta(article?.section || "Article");
  const related = STORIES.filter((story) => story.slug !== article?.slug && story.section === article?.section).slice(0, 3);
  const paragraphs = article?.body?.length ? article.body : article?.dek ? [article.dek] : [];
  const firstEmbedSeed = article?.relatedEntities?.[0];

  useEffect(() => {
    const onScroll = () => {
      const doc = document.documentElement;
      const max = doc.scrollHeight - window.innerHeight;
      setProgress(max > 0 ? window.scrollY / max : 0);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const pullQuote = useMemo(() => paragraphs.find((p) => p.length > 90) ?? paragraphs[0], [paragraphs]);

  if (!article) {
    return <div className="wk-container px-6 py-20 text-[var(--wk-text-muted)]">Article not found.</div>;
  }

  return (
    <main className="min-h-screen">
      <div className="article-progress"><span style={{ transform: `scaleX(${progress})` }} /></div>

      <section className="article-hero">
        <img className="article-hero-img" src={article.heroUrl} alt="" />
        <Link to="/magazine" className="article-back"><WkIcon name="ArrowLeft" size={14} /> WAKILISHA Magazine</Link>
        <div className="article-hero-inner wk-container-wide">
          <div className="article-kicker" style={{ background: meta.color || "var(--wk-brand)" }}>{article.section}</div>
          <h1 className="article-title">{article.title}</h1>
          {article.dek && <p className="article-dek">{article.dek}</p>}
          <div className="article-byline">
            <span>By {article.author}</span>
            <span>{article.date || "Undated"}</span>
            <span>{article.readingTime} min read</span>
            {article.readCount ? <span>{article.readCount.toLocaleString()} reads</span> : null}
          </div>
        </div>
      </section>

      <div className="article-shell">
        <article className="article-body">
          {paragraphs.map((paragraph, index) => (
            <div key={`${index}-${paragraph.slice(0, 10)}`}>
              <p className={index === 0 ? "lead dropcap" : ""}>{paragraph}</p>
              {index === 1 && pullQuote && <blockquote className="article-pullquote">“{pullQuote}”</blockquote>}
              {index === 2 && firstEmbedSeed && (
                <Link to={`/${firstEmbedSeed.type === "track" ? "tracks" : firstEmbedSeed.type === "release" ? "releases" : firstEmbedSeed.type === "genre" ? "genres" : "artists"}/${firstEmbedSeed.slug}`} className="article-inline-embed">
                  <div className="article-embed-art"><WkIcon name="Music2" size={20} /></div>
                  <div>
                    <div className="artist-list-name">{firstEmbedSeed.name}</div>
                    <div className="artist-list-sub">Inline registry embed · {firstEmbedSeed.type}</div>
                  </div>
                  <WkIcon name="ArrowRight" size={16} />
                </Link>
              )}
            </div>
          ))}
        </article>

        <aside className="article-sidebar">
          <div className="article-sidebox">
            <div className="article-sidebox-title">Actions</div>
            <div className="grid gap-2">
              <ShareButton item={{ title: article.title, subtitle: article.author, description: article.dek, imageUrl: article.heroUrl, type: "article" }} />
              <button className="btn btn-md btn-ghost"><WkIcon name="Bookmark" size={16} /> Save</button>
            </div>
          </div>
          <div className="article-sidebox">
            <div className="article-sidebox-title">Reading</div>
            <div className="artist-list-sub">{article.readingTime} min · {paragraphs.length} paragraphs</div>
          </div>
          {article.tags?.length > 0 && (
            <div className="article-sidebox">
              <div className="article-sidebox-title">Topics</div>
              <div className="article-tags">{article.tags.map((tag) => <span key={tag} className="tag tag-sm">{tag}</span>)}</div>
            </div>
          )}
          {article.relatedEntities?.length > 0 && (
            <div className="article-sidebox">
              <div className="article-sidebox-title">Related graph</div>
              <div className="space-y-2">
                {article.relatedEntities.slice(0, 5).map((entity) => (
                  <Link key={`${entity.type}-${entity.slug}`} to={`/${entity.type === "track" ? "tracks" : entity.type === "release" ? "releases" : entity.type === "genre" ? "genres" : "artists"}/${entity.slug}`} className="artist-list-sub block hover:text-[var(--wk-brand)]">
                    {entity.name}
                  </Link>
                ))}
              </div>
            </div>
          )}
        </aside>
      </div>

      <section className="article-related">
        <div className="section-head">
          <div>
            <div className="section-kicker">Related stories</div>
            <h2 className="section-title">Continue reading</h2>
          </div>
        </div>
        <div className="mag-grid trio">
          {related.length ? related.map((story) => <RelatedStory key={story.slug} story={story} />) : STORIES.filter((story) => story.slug !== article.slug).slice(0, 3).map((story) => <RelatedStory key={story.slug} story={story} />)}
        </div>
      </section>
    </main>
  );
}

function RelatedStory({ story }: { story: typeof STORIES[number] }) {
  return (
    <Link to={`/magazine/${story.slug}`} className="mag-story-card">
      <div className="mag-story-art"><img src={story.heroUrl} alt="" /></div>
      <div className="mag-story-pad">
        <div className="mag-story-section">{story.section}</div>
        <h3 className="mag-story-title">{story.title}</h3>
        <div className="mag-story-meta">{story.author} · {story.readingTime} min</div>
      </div>
    </Link>
  );
}
