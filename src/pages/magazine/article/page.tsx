import { useParams, Link } from "react-router-dom";
import { WkTag } from "@/components/design-system/primitives/Tag";
import { WkButton } from "@/components/design-system/primitives/Button";
import { StoryCard } from "@/components/design-system/editorial/StoryCard";
import { STORIES } from "@/mocks/magazine";

export default function ArticlePage() {
  const { slug } = useParams<{ slug: string }>();
  const article = STORIES.find((s) => s.slug === slug);

  if (!article) {
    return (
      <div className="wk-container px-6 py-20 text-center">
        <i className="ri-article-line mb-4 block text-5xl text-[var(--wk-text-faint)]" />
        <h1 className="wk-h-section mb-2">Article not found</h1>
        <p className="text-[var(--wk-text-muted)]">This story does not exist in the registry.</p>
        <Link to="/magazine" className="mt-6 inline-block">
          <WkButton variant="primary">Back to magazine</WkButton>
        </Link>
      </div>
    );
  }

  const relatedStories = STORIES.filter((s) => s.slug !== article.slug && s.section === article.section).slice(0, 3);

  return (
    <article>
      {/* Article Hero */}
      <section className="relative min-h-[420px] md:min-h-[520px] flex items-end overflow-hidden">
        {article.heroUrl && (
          <>
            <div
              className="absolute inset-0"
              style={{
                backgroundImage: `url(${article.heroUrl})`,
                backgroundSize: "cover",
                backgroundPosition: "center",
              }}
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-black/20" />
          </>
        )}
        <div className="relative wk-container px-6 pb-12 pt-20 w-full">
          <div className="mb-4 flex items-center gap-2">
            <WkTag variant="brand">{article.section}</WkTag>
            {article.readingTime && (
              <span className="text-[12px] text-white/60">{article.readingTime} min read</span>
            )}
          </div>
          <h1 className="wk-h-page mb-4 max-w-3xl" style={{ color: "#F0EFE8" }}>
            {article.title}
          </h1>
          {article.dek && (
            <p className="max-w-2xl text-[17px] leading-relaxed" style={{ color: "rgba(240,239,232,.8)" }}>
              {article.dek}
            </p>
          )}
          <div className="mt-6 flex items-center gap-3 text-[13px]" style={{ color: "rgba(240,239,232,.6)" }}>
            <span className="font-semibold text-white/80">{article.author}</span>
            <span>·</span>
            <span>{article.date}</span>
            {article.readCount && (
              <>
                <span>·</span>
                <span>{article.readCount.toLocaleString()} reads</span>
              </>
            )}
          </div>
        </div>
      </section>

      {/* Article Body */}
      <div className="wk-container px-6 py-12">
        <div className="mx-auto max-w-[var(--wk-w-text)]">
          <div className="space-y-6">
            {article.body?.map((paragraph, index) => (
              <p key={index} className="text-[16px] leading-[1.8] text-[var(--wk-text-soft)]">
                {paragraph}
              </p>
            ))}
          </div>

          {/* Tags */}
          {article.tags && article.tags.length > 0 && (
            <div className="mt-10 flex flex-wrap items-center gap-2">
              <span className="text-[12px] font-bold uppercase tracking-wider text-[var(--wk-text-muted)]">
                Topics
              </span>
              {article.tags.map((tag) => (
                <WkTag key={tag}>{tag}</WkTag>
              ))}
            </div>
          )}

          {/* Related Entities */}
          {article.relatedEntities && article.relatedEntities.length > 0 && (
            <div className="mt-10 rounded-xl border border-[var(--wk-border)] bg-[var(--wk-surface)] p-5">
              <h3 className="mb-3 text-[12px] font-bold uppercase tracking-wider text-[var(--wk-text-muted)]">
                Related in the graph
              </h3>
              <div className="flex flex-wrap gap-3">
                {article.relatedEntities.map((entity) => (
                  <Link
                    key={entity.slug}
                    to={`/${entity.type === "track" ? "tracks" : entity.type === "release" ? "releases" : entity.type === "chart" ? "charts" : entity.type === "genre" ? "genres" : "artists"}/${entity.slug}`}
                    className="flex items-center gap-2 rounded-full border border-[var(--wk-border)] bg-[var(--wk-bg-subtle)] px-3 py-1.5 text-[13px] font-semibold text-[var(--wk-text)] transition-all hover:border-[var(--wk-brand)]"
                  >
                    <i
                      className={
                        entity.type === "artist"
                          ? "ri-user-line"
                          : entity.type === "release"
                          ? "ri-album-line"
                          : entity.type === "track"
                          ? "ri-music-2-line"
                          : entity.type === "genre"
                          ? "ri-folder-music-line"
                          : "ri-bar-chart-line"
                      }
                    />
                    {entity.name}
                  </Link>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Read Next */}
      {relatedStories.length > 0 && (
        <section className="border-t border-[var(--wk-border)] bg-[var(--wk-bg-subtle)] py-14">
          <div className="wk-container px-6">
            <div className="mb-6 flex items-center gap-3">
              <div className="wk-eyebrow">Read next</div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {relatedStories.map((story) => (
                <StoryCard key={story.slug} {...story} />
              ))}
            </div>
          </div>
        </section>
      )}
    </article>
  );
}