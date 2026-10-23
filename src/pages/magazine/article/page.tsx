import { NewsletterSubscribe } from "@/components/feature/NewsletterSubscribe";
import "@/styles/wakilisha-magazine-38-44.css";
import "@/styles/wakilisha-workbook-p1-p11-authority.css";
import { useEffect, useState, useRef, useMemo, useCallback } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import {
  useMagazineArticle,
  useMagazineArticles,
  getRelatedArticles,
  type MagazineArticle,
} from "@/services/magazineArticles";

import { transformReleaseShortcodes } from "@/utils/transformReleaseShortcodes";
import { transformArtistShortcodes } from "@/utils/transformArtistShortcodes";
import { WkIcon } from "@/components/design-system/Icon";
import { ArticleFloatHeader } from "./components/ArticleFloatHeader";
import { ArticleRelated } from "./components/ArticleRelated";
import { ArticleContentRenderer, transformArticleHtmlForVideoEmbeds } from "./components/ArticleVideoEmbeds";
import { transformArticleHtmlForReleaseEmbeds, enrichAllReleasesFromRegistry, resolveRegistryReleaseMarkers } from "./components/ArticleReleaseEmbeds";
import { resolveArtistMarkers } from "./components/ArticleArtistEmbeds";
import { buildContentSegments } from "./components/ArticleEmbedUtils";
import { SkeletonArticlePage } from "@/components/skeletons/Skeletons";
import { Chapter19FallbackImage } from "@/components/media/Chapter19FallbackImage";
import { ResponsiveMediaImage } from "@/components/media/ResponsiveMediaImage";
import { MetaTags } from "@/components/seo/MetaTags";
import { SchemaOrg } from "@/components/seo/SchemaOrg";
import { checkArticleScheduling } from "@/services/articles/articleAdminService";
import { resolveTrackMarkers } from "./components/ArticleTrackEmbeds";
import { transformTrackShortcodes } from "@/utils/transformTrackShortcodes";
import { injectMediaCaptions, buildAssetCaptionMap } from "@/utils/injectMediaCaptions";
import { useScrollDepthTracking } from "@/hooks/useScrollDepthTracking";
import { useAuthUser } from "@/hooks/useAuthUser";
import { CommunitySection } from "./components/CommunitySection";
import { CommunityActionSheet } from "@/components/feature/community/CommunityActionSheet";
import { ArticlePreviewModeBanner } from "./components/ArticlePreviewModeBanner";

/* Remove InlineMediaGallery — captions now render inline alongside their images */

function getPrerenderedArticleHeroSource(
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

export default function ArticlePage() {
  const { slug } = useParams<{ slug: string }>();
  const [searchParams] = useSearchParams();
  const previewNonce = searchParams.get("preview");
  const { article, loading: articleLoading, error: articleError } = useMagazineArticle(slug, previewNonce);
  const authUser = useAuthUser();
  const isLoggedIn = !authUser.loading && authUser.id.length > 0;
  const prerenderedArticleHeroSource =
    getPrerenderedArticleHeroSource(
      slug,
    );

  useScrollDepthTracking({
    pageType: "article",
    entitySlug: slug,
    entityType: "article",
  });
  const { articles: allArticles } = useMagazineArticles();
  const [related, setRelated] = useState<MagazineArticle[]>([]);
  const [relatedLoading, setRelatedLoading] = useState(true);
  const [scrolled, setScrolled] = useState(false);
  const progressBarRef = useRef<HTMLDivElement>(null);
  const lastScrollState = useRef(false);
  const rawContentHtml = useMemo(() => article?.contentHtml ?? "", [article?.contentHtml]);
  const shortcodeMarked = useMemo(
    () => transformTrackShortcodes(transformReleaseShortcodes(transformArtistShortcodes(rawContentHtml))),
    [rawContentHtml]
  );
  const { markedHtml: videoMarked, videos: videoEmbeds } = useMemo(
    () => transformArticleHtmlForVideoEmbeds(
      shortcodeMarked,
      article?.videoSources ?? [],
    ),
    [shortcodeMarked, article?.videoSources]
  );
  const { markedHtml: finalMarked, releases: releaseEmbeds } = useMemo(
    () => transformArticleHtmlForReleaseEmbeds(videoMarked),
    [videoMarked]
  );

  // Combined processing: enrich WP-scraped embeds + resolve registry markers
  const [finalHtml, setFinalHtml] = useState(finalMarked);
  const [finalReleases, setFinalReleases] = useState(releaseEmbeds);
  const [artistEmbeds, setArtistEmbeds] = useState<import("./components/ArticleArtistEmbeds").ArtistEmbedData[]>([]);
  const [trackEmbeds, setTrackEmbeds] = useState<import("./components/ArticleTrackEmbeds").TrackEmbedData[]>([]);

  useEffect(() => {
    let alive = true;
    async function process() {
      // Step 1: Enrich WP-scraped releases from registry
      let enriched = releaseEmbeds;
      if (releaseEmbeds.length > 0) {
        enriched = await enrichAllReleasesFromRegistry(releaseEmbeds);
      }
      if (!alive) return;

      // Step 2: Resolve registry release markers (inserted from admin editor)
      const resolved = await resolveRegistryReleaseMarkers(finalMarked, enriched);
      if (!alive) return;

      // Step 3: Resolve artist registry markers
      const artistResolved = await resolveArtistMarkers(resolved.markedHtml);
      if (!alive) return;

      // Step 4: Resolve track registry markers
      const trackResolved = await resolveTrackMarkers(artistResolved.markedHtml);
      if (!alive) return;

      setFinalHtml(trackResolved.markedHtml);
      setFinalReleases(resolved.releases);
      setArtistEmbeds(artistResolved.artists);
      setTrackEmbeds(trackResolved.tracks);
    }
    process();
    return () => { alive = false; };
  }, [finalMarked, releaseEmbeds]);

  const segments = useMemo(
    () => buildContentSegments(finalHtml, videoEmbeds, finalReleases, artistEmbeds, trackEmbeds),
    [finalHtml, videoEmbeds, finalReleases, artistEmbeds, trackEmbeds]
  );

  // Inject caption <figcaption> tags for images linked to media assets
  // with stored captions, so captions render inline alongside their images.
  const captionedHtml = useMemo(() => {
    if (!article?.mediaAssets?.length) return null;
    const assetMap = buildAssetCaptionMap(article.mediaAssets);
    return injectMediaCaptions(finalHtml, assetMap);
  }, [finalHtml, article?.mediaAssets]);

  const captionedSegments = useMemo(() => {
    if (!captionedHtml) return segments;
    return buildContentSegments(captionedHtml, videoEmbeds, finalReleases, artistEmbeds, trackEmbeds);
  }, [captionedHtml, videoEmbeds, finalReleases, artistEmbeds, trackEmbeds, segments]);

  const displaySegments = captionedHtml ? captionedSegments : segments;
  const [isScheduled, setIsScheduled] = useState(false);
  const [scheduledDate, setScheduledDate] = useState<string | null>(null);



  useEffect(() => {
    if (!article) return;
    let alive = true;
    setRelatedLoading(true);
    getRelatedArticles(article, 3)
      .then((items) => { if (alive) { setRelated(items); setRelatedLoading(false); } })
      .catch(() => { if (alive) { setRelated(allArticles.filter((a) => a.slug !== article.slug).slice(0, 3)); setRelatedLoading(false); } });
    return () => { alive = false; };
  }, [article, allArticles]);

  useEffect(() => {
    if (!slug) return;
    let alive = true;
    checkArticleScheduling(slug)
      .then((result) => {
        if (!alive || !result) return;
        if (result.isScheduled && result.scheduledDate) {
          setIsScheduled(true);
          setScheduledDate(result.scheduledDate);
        }
      })
      .catch(() => {});
    return () => { alive = false; };
  }, [slug]);

  useEffect(() => {
    let rafId: number | null = null;
    const onScroll = () => {
      if (rafId !== null) return;
      rafId = requestAnimationFrame(() => {
        rafId = null;
        const doc = document.documentElement;
        const max = doc.scrollHeight - window.innerHeight;
        if (progressBarRef.current) {
          const pct = max > 0 ? window.scrollY / max : 0;
          (progressBarRef.current.firstChild as HTMLElement).style.transform = `scaleX(${pct})`;
        }
        const nowScrolled = window.scrollY > window.innerHeight * 0.55;
        if (nowScrolled !== lastScrollState.current) {
          lastScrollState.current = nowScrolled;
          setScrolled(nowScrolled);
        }
      });
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => { window.removeEventListener("scroll", onScroll); if (rafId !== null) cancelAnimationFrame(rafId); };
  }, []);

  const [communitySheetOpen, setCommunitySheetOpen] = useState(false);

  const scrollToCommunity = useCallback(() => {
    const el = document.getElementById("community-section");
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
    }
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
      subtitle: article.dek,
      imageUrl: article.heroUrl,
    };
  }, [article?.slug, article?.id, article?.title, article?.dek, article?.heroUrl]);

  if (articleLoading) {
    return (
      <main className="min-h-screen bg-[var(--wk-bg)]">
        <section
          key="article-hero-shell"
          data-wakilisha-article-loading-hero="true"
          className="relative aspect-[3/2] overflow-hidden"
        >
          {prerenderedArticleHeroSource ? (
            <ResponsiveMediaImage
              key="article-hero-media"
              src={prerenderedArticleHeroSource}
              preset="hero"
              alt=""
              aria-hidden="true"
              loading="eager"
              fetchPriority="high"
              decoding="async"
              data-wakilisha-article-hero="true"
              className="absolute inset-0 w-full h-full object-cover"
              style={{
                objectPosition: "50% 30%",
              }}
            />
          ) : null}

          <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />

          <div className="absolute inset-x-0 bottom-0 z-10 px-6 pb-8">
            <p
              role="status"
              className="text-[13px] font-bold text-white/75"
            >
              Loading story…
            </p>
          </div>
        </section>

        <div
          key="article-loading-body"
          className="relative z-10 min-h-[420px] rounded-t-[28px] bg-[var(--wk-bg)]"
          style={{
            marginTop: "-64px",
          }}
        />
      </main>
    );
  }
  if (articleError) return <div className="min-h-screen flex items-center justify-center"><div className="text-center"><WkIcon name="AlertCircle" size={32} className="mx-auto mb-3 text-[var(--wk-danger)]" /><p className="text-sm text-[var(--wk-text-muted)]">We couldn't load this story. Try again in a moment.</p></div></div>;
  if (!article) return <div className="min-h-screen flex items-center justify-center"><div className="text-center"><WkIcon name="FileX" size={32} className="mx-auto mb-3 text-[var(--wk-text-faint)]" /><p className="text-sm text-[var(--wk-text-muted)]">This story isn't available.</p></div></div>;

  if (isScheduled) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-[var(--wk-bg)]">
        <div className="text-center max-w-md mx-auto px-6">
          <div className="flex h-16 w-16 items-center justify-center mx-auto mb-5 rounded-2xl bg-[var(--wk-brand-soft)] text-[var(--wk-brand)]"><WkIcon name="CalendarClock" size={28} /></div>
          <h1 className="text-[22px] font-black text-[var(--wk-text)] mb-2">Coming Soon</h1>
          <p className="text-[14px] text-[var(--wk-text-muted)] mb-1">This article is scheduled and will be published on:</p>
          <p className="text-[16px] font-bold text-[var(--wk-brand)] mb-5">{scheduledDate ? new Date(scheduledDate).toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric", hour: "2-digit", minute: "2-digit" }) : "soon"}</p>
          <Link to="/magazine" className="inline-flex items-center gap-2 rounded-full border border-[var(--wk-border)] bg-[var(--wk-surface)] px-5 py-2.5 text-[13px] font-bold text-[var(--wk-text-soft)] hover:border-[var(--wk-brand)] hover:text-[var(--wk-brand)] transition-all whitespace-nowrap"><WkIcon name="ArrowLeft" size={14} />Back to Magazine</Link>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[var(--wk-bg)]">
      <section data-wk-workbook-hero="article" key="article-hero-shell" className="relative flex aspect-[3/2] items-end justify-center overflow-hidden bg-[#0b0b0b]">
        {article.heroUrl ? (
          <ResponsiveMediaImage
            key="article-hero-media"
            src={article.heroUrl}
            preset="hero"
            alt={article.title}
            loading="eager"
            fetchPriority="high"
            decoding="async"
            data-wakilisha-article-hero="true"
            className="absolute inset-0 w-full h-full object-cover"
            style={{ objectPosition: "50% 30%" }}
          />
        ) : (
          <Chapter19FallbackImage
            id={article.id}
            slug={article.slug}
            name={article.title}
          />
        )}
        <div className="absolute top-0 left-0 right-0 z-20 px-6 py-5 flex items-center justify-end">
          
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setCommunitySheetOpen(true)}
              aria-label="Article actions"
              className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-black/25 backdrop-blur-sm px-3 py-2 text-[11px] font-bold text-white/80 hover:bg-black/45 transition-all cursor-pointer whitespace-nowrap"
            >
              <i className="ri-more-2-line text-[16px]" />
            </button>

          </div>
        </div>
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-[#0b0b0b] via-black/50 to-black/15" />
        <div className="relative z-10 mx-auto max-w-[820px] px-6 pb-12 text-center text-[#f5f5f4]">
          <p className="text-[11px] font-bold uppercase tracking-[.15em] text-[#85c441]">{article.section} · {article.readingTime} min read</p>
          <h1 className="mx-auto mt-4 max-w-[17ch] text-[clamp(42px,5.5vw,72px)] font-extrabold leading-[.97] tracking-[-.055em]">{article.title}</h1>
          {article.dek && <p className="mx-auto mt-5 max-w-[60ch] text-[16px] leading-[1.55] text-white/80">{article.dek}</p>}
        </div>
      </section>

      {previewNonce ? <ArticlePreviewModeBanner /> : null}

      <MetaTags title={article.title} description={article.dek || `Read ${article.title} on WAKILISHA Magazine.`} imageUrl={article.heroUrl} url={typeof window !== "undefined" ? window.location.href : undefined} type="article" />
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
      <div className="article-progress" ref={progressBarRef}><span style={{ transform: "scaleX(0)" }} /></div>
      <div className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${scrolled ? "opacity-100 translate-y-0" : "opacity-0 -translate-y-full pointer-events-none"} bg-[var(--wk-bg)]/95 backdrop-blur-md border-b border-[var(--wk-border)]`}>
        <div className="max-w-[1180px] mx-auto px-6 h-14 flex items-center gap-4"><Link to="/magazine" className="flex items-center gap-1.5 text-[12px] font-bold text-[var(--wk-text-muted)] hover:text-[var(--wk-brand)] transition-colors whitespace-nowrap shrink-0"><WkIcon name="ArrowLeft" size={14} />Magazine</Link><div className="h-4 w-px bg-[var(--wk-border)] shrink-0" /><h2 className="text-[13px] font-bold text-[var(--wk-text)] flex-1 min-w-0 truncate">{article.title}</h2></div>
      </div>



      <div data-wk-article-category={article.section.trim().toLowerCase()}
        className="wk-workbook-article-paper relative z-10">
        <div className="wk-reference-article-columns mx-auto grid w-full max-w-[1260px] gap-8 px-5 pt-9 lg:grid-cols-[190px_minmax(0,680px)_190px] lg:gap-10 lg:px-8">
          <ArticleFloatHeader article={article} />
          <article className="min-w-0 pb-12">
            <ArticleContentRenderer segments={displaySegments} videos={videoEmbeds} releases={finalReleases} artists={artistEmbeds} tracks={trackEmbeds} articleSlug={article.slug} />
          </article>
          <aside className="hidden self-start lg:block" aria-label="People in this story">
            {artistEmbeds.length > 0 && (
              <>
                <h2 className="mb-4 text-[11px] font-bold uppercase tracking-[.14em] text-[var(--wk-text-muted)]">In this story</h2>
                <div className="space-y-4">
                  {artistEmbeds.slice(0,6).map((artist) => (
                    <Link key={artist.slug} to={`/artists/${artist.slug}`} className="flex items-center gap-2.5 text-[13px] font-semibold text-[var(--wk-text)] hover:text-[var(--wk-brand)]">
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--wk-surface-raised)]">{artist.name.charAt(0)}</span>
                      <span className="line-clamp-2">{artist.name}</span>
                    </Link>
                  ))}
                </div>
              </>
            )}
          </aside>
        </div>
        <div className="mx-auto max-w-[740px] px-6 pb-16 lg:px-8">
          {article.categories?.length > 0 && <TagBlock label="Categories" items={article.categories} basePath="/categories" />}
          {article.tags?.length > 0 && <TagBlock label="Topics" items={article.tags} basePath="/tags" />}
        </div>

        {communityEntity && (
          <CommunitySection
            entity={communityEntity}
            user={isLoggedIn ? authUser : null}
          />
        )}

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

      <ArticleRelated stories={related.filter((item) => item.slug !== article.slug)} loading={relatedLoading} />
      <div data-wk-article-newsletter className="mx-auto w-full max-w-[780px] border-t border-[var(--wk-border)] px-5 py-12 sm:px-8">
        <NewsletterSubscribe
          variant="default"
          formId="article-newsletter"
          headline="Read with us"
          description="Get new stories and charts in your inbox."
          contextFields={{ wk_page_type: "article", wk_source_section: "article_footer" }}
        />
      </div>

    </main>
  );
}

function slugFor(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function TagBlock({ label, items, basePath }: { label: string; items: string[]; basePath: string }) {
  return (
    <div className="mb-6">
      <p className="text-[10px] font-black uppercase tracking-[0.22em] text-[var(--wk-text-faint)] mb-3">{label}</p>
      <div className="flex flex-wrap gap-2">
        {items.map((item) => <Link key={item} to={`${basePath}/${slugFor(item)}`} className="px-3 py-1.5 rounded-full border border-[var(--wk-border)] text-[11px] font-semibold text-[var(--wk-text-soft)] hover:border-[var(--wk-brand)] hover:text-[var(--wk-brand)] cursor-pointer transition-all">{item}</Link>)}
      </div>
    </div>
  );
}