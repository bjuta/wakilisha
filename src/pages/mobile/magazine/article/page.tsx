import { NewsletterSubscribe } from "@/components/feature/NewsletterSubscribe";
import "@/styles/wakilisha-magazine-38-44.css";
import "@/styles/wakilisha-workbook-p1-p11-authority.css";
import { useState, useEffect, useMemo, useCallback } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import {
  useMagazineArticle,
  useMagazineArticles,
} from "@/services/magazineArticles";
import { transformReleaseShortcodes } from "@/utils/transformReleaseShortcodes";
import { transformArtistShortcodes } from "@/utils/transformArtistShortcodes";
import { transformTrackShortcodes } from "@/utils/transformTrackShortcodes";
import { SkeletonArticlePage } from "@/components/skeletons/Skeletons";
import { Chapter19FallbackImage } from "@/components/media/Chapter19FallbackImage";
import { ResponsiveMediaImage } from "@/components/media/ResponsiveMediaImage";
import { ArticleContentRenderer, transformArticleHtmlForVideoEmbeds } from "@/pages/magazine/article/components/ArticleVideoEmbeds";
import { transformArticleHtmlForReleaseEmbeds } from "@/pages/magazine/article/components/ArticleReleaseEmbeds";
import { resolveArtistMarkers } from "@/pages/magazine/article/components/ArticleArtistEmbeds";
import { resolveTrackMarkers } from "@/pages/magazine/article/components/ArticleTrackEmbeds";
import { buildContentSegments } from "@/pages/magazine/article/components/ArticleEmbedUtils";
import { injectMediaCaptions, buildAssetCaptionMap } from "@/utils/injectMediaCaptions";
import { CommunityActionSheet } from "@/components/feature/community/CommunityActionSheet";
import { CommunitySection } from "@/pages/magazine/article/components/CommunitySection";
import { SchemaOrg } from "@/components/seo/SchemaOrg";
import { useScrollDepthTracking } from "@/hooks/useScrollDepthTracking";
import { useAuthUser } from "@/hooks/useAuthUser";
import { ArticlePreviewModeBanner } from "@/pages/magazine/article/components/ArticlePreviewModeBanner";
import { ArticleAuthorIdentity } from "@/components/design-system/editorial/ArticleAuthorIdentity";
import { ArticleRelated } from "@/pages/magazine/article/components/ArticleRelated";

function formatReadCount(count: number): string {
  if (count >= 1000) return `${(count / 1000).toFixed(1)}k`;
  return String(count);
}



function getPrerenderedMobileArticleHeroSource(
  slug: string | undefined,
): string | undefined {
  if (
    typeof document === "undefined"
    || !slug
  ) {
    return undefined;
  }

  const expectedPath =
    `/magazine/${encodeURIComponent(
      slug,
    )}`;

  const preload =
    Array.from(
      document.querySelectorAll<HTMLLinkElement>(
        'link[data-wakilisha-lcp-preload="article"]',
      ),
    ).find(
      (link) =>
        link.getAttribute(
          "data-wakilisha-lcp-path",
        ) === expectedPath,
    );

  const href =
    preload?.href;

  if (!href) {
    return undefined;
  }

  try {
    const url =
      new URL(
        href,
      );

    const derivative =
      url.pathname.match(
        /^\/__image\/w\d+(\/uploads\/.*)$/,
      );

    if (
      url.hostname ===
        "media.wakilisha.africa"
      && derivative?.[1]
    ) {
      url.pathname =
        derivative[1];

      return url.href;
    }
  } catch {
    return href;
  }

  return href;
}

export default function MobileArticle() {
  const { slug } = useParams<{ slug: string }>();
  const [searchParams] = useSearchParams();
  const previewNonce = searchParams.get("preview");
  const prerenderedArticleHeroSource =
    getPrerenderedMobileArticleHeroSource(
      slug,
    );

  useScrollDepthTracking({
    pageType: "article",
    entitySlug: slug,
    entityType: "article",
  });

  const { article, loading, error } = useMagazineArticle(slug, previewNonce);
  const { articles: allArticles, loading: relatedLoading } = useMagazineArticles();
  const authUser = useAuthUser();
  const isLoggedIn = !authUser.loading && authUser.id.length > 0;

  const [progress, setProgress] = useState(0);
  const [communitySheetOpen, setCommunitySheetOpen] = useState(false);

  const scrollToCommunity = useCallback(() => {
    const el = document.getElementById("community-section");
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, []);

  const contentHtml = article?.contentHtml ?? "";
  const shortcodeMarked = useMemo(
    () => transformTrackShortcodes(transformReleaseShortcodes(transformArtistShortcodes(contentHtml))),
    [contentHtml]
  );
  const { markedHtml: videoMarked, videos: videoEmbeds } = useMemo(
    () => transformArticleHtmlForVideoEmbeds(
      shortcodeMarked,
      article?.videoSources ?? [],
    ),
    [shortcodeMarked, article?.videoSources]
  );
  const { markedHtml: releaseMarked, releases: releaseEmbeds } = useMemo(
    () => transformArticleHtmlForReleaseEmbeds(videoMarked),
    [videoMarked]
  );

  const [finalHtml, setFinalHtml] = useState(releaseMarked);
  const [artistEmbeds, setArtistEmbeds] = useState<import("@/pages/magazine/article/components/ArticleArtistEmbeds").ArtistEmbedData[]>([]);
  const [trackEmbeds, setTrackEmbeds] = useState<import("@/pages/magazine/article/components/ArticleTrackEmbeds").TrackEmbedData[]>([]);

  useEffect(() => {
    let alive = true;
    async function process() {
      const resolved = await resolveArtistMarkers(releaseMarked);
      if (!alive) return;
      const trackResolved = await resolveTrackMarkers(resolved.markedHtml);
      if (!alive) return;
      setFinalHtml(trackResolved.markedHtml);
      setArtistEmbeds(resolved.artists);
      setTrackEmbeds(trackResolved.tracks);
    }
    process();
    return () => { alive = false; };
  }, [releaseMarked]);

  const segments = useMemo(
    () => buildContentSegments(finalHtml, videoEmbeds, releaseEmbeds, artistEmbeds, trackEmbeds),
    [finalHtml, videoEmbeds, releaseEmbeds, artistEmbeds, trackEmbeds]
  );

  // Inject caption <figcaption> tags for images linked to media assets
  const captionedHtml = useMemo(() => {
    if (!article?.mediaAssets?.length) return null;
    const assetMap = buildAssetCaptionMap(article.mediaAssets);
    return injectMediaCaptions(finalHtml, assetMap);
  }, [finalHtml, article?.mediaAssets]);

  const captionedSegments = useMemo(() => {
    if (!captionedHtml) return segments;
    return buildContentSegments(captionedHtml, videoEmbeds, releaseEmbeds, artistEmbeds, trackEmbeds);
  }, [captionedHtml, videoEmbeds, releaseEmbeds, artistEmbeds, trackEmbeds, segments]);

  const displaySegments = captionedHtml ? captionedSegments : segments;

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


  // Memoize community entities so useCommunityThread doesn't re-fetch on every scroll
  const communityEntity = useMemo(() => {
    if (!article) return null;
    return {
      type: "article" as const,
      slug: article.slug,
      id: article.id,
      url: typeof window !== "undefined" ? window.location.href : "",
      title: article.title,
    };
  }, [article?.slug, article?.id, article?.title]);

  const actionEntity = useMemo(() => {
    if (!article) return null;
    return {
      type: "article" as const,
      slug: article.slug,
      id: article.id,
      url: typeof window !== "undefined" ? window.location.href : "",
      title: article.title,
      subtitle: article.author,
      imageUrl: article.heroUrl,
    };
  }, [article?.slug, article?.id, article?.title, article?.author, article?.heroUrl]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[var(--wk-bg)]">
        {previewNonce ? <ArticlePreviewModeBanner /> : null}

        <section
          key="mobile-article-hero-shell"
          data-wakilisha-mobile-article-loading-hero="true"
          className="relative aspect-[4/5] overflow-hidden"
        >
          {prerenderedArticleHeroSource ? (
            <ResponsiveMediaImage
              key="mobile-article-hero-media"
              src={prerenderedArticleHeroSource}
              preset="hero"
              alt=""
              aria-hidden="true"
              loading="eager"
              fetchPriority="high"
              decoding="async"
              data-wakilisha-article-hero="true"
              className="absolute inset-0 w-full h-full object-cover object-top"
            />
          ) : null}

          <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />

          <div className="absolute inset-x-0 bottom-0 z-10 px-5 pb-7">
            <p
              role="status"
              className="text-[13px] font-bold text-white/75"
            >
              Loading story…
            </p>
          </div>
        </section>

        <div
          key="mobile-article-content-shell"
          className="relative z-10 min-h-[360px] bg-[var(--wk-bg)]"
        />
      </div>
    );
  }

  if (error || !article) {
    return (
      <div className="min-h-screen flex items-center justify-center px-5">
        <div className="text-center">
          <i className="ri-article-line mb-3 block text-4xl text-[var(--wk-text-faint)]" />
          <p className="text-[var(--wk-text-muted)]">{error || "Article not found"}</p>
        </div>
      </div>
    );
  }

  const relatedStories = allArticles
    .filter((s) => s.slug !== article.slug)
    .slice(0, 3);

  const initials = article.author.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase();

  return (
    <div data-wk-workbook-screen="article-mobile" className="min-h-screen bg-[var(--wk-bg)]">
      {previewNonce ? <ArticlePreviewModeBanner /> : null}

      <section key="mobile-article-hero-shell" className="relative aspect-[4/5] overflow-hidden">
        {article.heroUrl ? (
          <ResponsiveMediaImage
            key="mobile-article-hero-media"
            src={article.heroUrl}
            preset="hero"
            alt={article.title}
            loading="eager"
            fetchPriority="high"
            decoding="async"
            data-wakilisha-article-hero="true"
            className="absolute inset-0 w-full h-full object-cover object-top"
          />
        ) : (
          <Chapter19FallbackImage
            id={article.id}
            slug={article.slug}
            name={article.title}
          />
        )}
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-[#0b0b0b] via-black/30 to-black/10" />
        <div className="absolute inset-x-0 bottom-0 z-10 px-5 pb-8 text-[#f5f5f4]">
          <p className="text-[11px] font-bold uppercase tracking-[.14em] text-[#85c441]">
            {article.section} · {article.readingTime} min read
          </p>
          <h1 className="mt-3 max-w-[18ch] text-[clamp(34px,9vw,52px)] font-extrabold leading-[.99] tracking-[-.048em]">
            {article.title}
          </h1>
        </div>
      </section>

      {/* Reading progress */}
      <div key="mobile-article-progress" className="fixed top-0 left-0 right-0 z-50 h-[2px] bg-transparent">
        <div
          className="h-full bg-[var(--wk-brand)] origin-left transition-transform duration-100"
          style={{ transform: `scaleX(${progress})` }}
        />
      </div>

      {/* Full-bleed hero */}
      <SchemaOrg
        data={{
          "@type": "Article",
          headline: article.title,
          description: article.dek || undefined,
          image: article.heroUrl,
          datePublished: article.date,
          author: article.authorPersonPath ? { "@type": "Person", name: article.author, url: article.authorPersonPath }
            : article.authorOrganizationPath
              ? { "@type": "Organization", name: article.author, url: article.authorOrganizationPath }
              : undefined,
          publisher: { "@type": "Organization", name: "WAKILISHA" },
          url: typeof window !== "undefined" ? window.location.href : undefined,
        }}
      />


      {/* ── Floating content card ── */}
      <div
        key="mobile-article-content-shell"
        data-wk-article-category={article.section.trim().toLowerCase()}
        className="wk-workbook-article-paper relative z-10 min-h-[360px]"
      >
        <div className="px-5 pt-8 pb-6">
          {/* Author details and contextual article actions */}
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <ArticleAuthorIdentity name={article.author} personPath={article.authorPersonPath} organizationPath={article.authorOrganizationPath}

                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--wk-surface-raised)] text-[11px] font-bold text-[var(--wk-text)]"
              >
                {initials}
              </ArticleAuthorIdentity>
              <div>
                <ArticleAuthorIdentity name={article.author} personPath={article.authorPersonPath} organizationPath={article.authorOrganizationPath}

                  className="text-[13px] font-bold text-[var(--wk-text)] block leading-tight"
                >
                  {article.author}
                </ArticleAuthorIdentity>
                <span className="text-[11px] text-[var(--wk-text-muted)]">{article.date}</span>
              </div>
            </div>
            <button
              type="button"
              data-wk-article-actions-trigger="byline"
              aria-label="Article actions"
              aria-haspopup="dialog"
              aria-expanded={communitySheetOpen}
              onClick={() => setCommunitySheetOpen(true)}
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-[var(--wk-border)] bg-[var(--wk-surface)] text-[var(--wk-text)] transition-colors hover:bg-[var(--wk-surface-raised)]"
            >
              <i className="ri-more-2-line text-[18px]" aria-hidden="true" />
            </button>
          </div>
        </div>

        {/* Article body */}
        <div className="px-5 pb-10">
          <ArticleContentRenderer segments={displaySegments} videos={videoEmbeds} releases={releaseEmbeds} artists={artistEmbeds} tracks={trackEmbeds} proseClass="article-content-v2-mobile" articleSlug={article.slug} />
        </div>

        {/* Tags */}
        {article.tags && article.tags.length > 0 && (
          <div className="px-5 pb-8">
            <p className="text-[9px] font-black uppercase tracking-[0.2em] text-[var(--wk-text-faint)] mb-3">Topics</p>
            <div className="flex flex-wrap gap-2">
              {article.tags.map((tag) => (
                <span
                  key={tag}
                  className="rounded-full border border-[var(--wk-border)] px-3 py-1 text-[11px] font-semibold text-[var(--wk-text-soft)]"
                >
                  {tag}
                </span>
              ))}
            </div>
          </div>
        )}

      </div>

      {/* Community Section */}
      {communityEntity && (
        <CommunitySection
          entity={communityEntity}
          user={isLoggedIn ? authUser : null}
        />
      )}

      <ArticleRelated stories={relatedStories} loading={relatedLoading} />
      <div data-wk-article-newsletter className="border-t border-[var(--wk-border)] px-5 py-10">
        <NewsletterSubscribe
          variant="default"
          formId="article-newsletter-mobile"
          headline="Read with us"
          description="Get new stories and charts in your inbox."
          contextFields={{ wk_page_type: "article", wk_source_section: "article_footer" }}
        />
      </div>

      {/* Community Action Sheet */}
      {actionEntity && (
        <CommunityActionSheet
          entity={actionEntity}
          open={communitySheetOpen}
          onClose={() => setCommunitySheetOpen(false)}
          userId={isLoggedIn ? authUser.id : undefined}
          onComment={scrollToCommunity}
        />
      )}
    </div>
  );
}