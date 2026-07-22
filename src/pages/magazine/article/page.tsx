import { useEffect, useState, useRef, useMemo, useCallback } from "react";
import { Link, useParams, useSearchParams, useNavigate } from "react-router-dom";
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
import { MetaTags } from "@/components/seo/MetaTags";
import { SchemaOrg } from "@/components/seo/SchemaOrg";
import { checkArticleScheduling, lookupSlugRedirect } from "@/services/articles/articleAdminService";
import { resolveTrackMarkers } from "./components/ArticleTrackEmbeds";
import { transformTrackShortcodes } from "@/utils/transformTrackShortcodes";
import { injectMediaCaptions, buildAssetCaptionMap } from "@/utils/injectMediaCaptions";
import { SharePopover } from "@/components/design-system/share/ShareSheet";
import { getShareCounts, getTotalShareCount } from "@/services/shareTracking";
import { useScrollDepthTracking } from "@/hooks/useScrollDepthTracking";
import { useAuthUser } from "@/hooks/useAuthUser";
import { CommunitySection } from "./components/CommunitySection";
import { CommunityActionSheet } from "@/components/feature/community/CommunityActionSheet";
import { ArticlePreviewModeBanner } from "./components/ArticlePreviewModeBanner";

/* Remove InlineMediaGallery — captions now render inline alongside their images */

// ── Inline share count badge (reused in hero and bottom) ─────────────────

function useArticleShareCount(pageUrl: string) {
  const [totalShares, setTotalShares] = useState(0);

  useEffect(() => {
    if (!pageUrl) return;
    let cancelled = false;
    getShareCounts(pageUrl).then((counts) => {
      if (cancelled) return;
      setTotalShares(getTotalShareCount(counts));
    }).catch(() => {});
    return () => { cancelled = true; };
  }, [pageUrl]);

  return totalShares;
}

function ArticleBottomShare({ article, shareText, onComment }: { article: MagazineArticle; shareText: string; onComment?: () => void }) {
  const [popoverOpen, setPopoverOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const pageUrl = typeof window !== "undefined" ? window.location.href : "";
  const totalShares = useArticleShareCount(pageUrl);

  return (
    <div className="rounded-2xl bg-[var(--wk-surface)] border border-[var(--wk-border)] p-6 lg:p-8 text-center">
      <p className="text-[15px] font-bold text-[var(--wk-text)] mb-1">Enjoyed this piece?</p>
      <p className="text-[13px] text-[var(--wk-text-muted)] mb-6">Share it with someone who cares about African creative life.</p>
      <div className="relative inline-block">
        <button
          ref={buttonRef as React.RefObject<HTMLButtonElement>}
          onClick={() => setPopoverOpen(!popoverOpen)}
          className="inline-flex items-center gap-2 h-11 px-6 rounded-full bg-[var(--wk-brand)] text-white text-[14px] font-bold hover:opacity-90 active:scale-95 transition-all cursor-pointer whitespace-nowrap"
        >
          <i className="ri-share-forward-line text-[16px]" />
          Share this article
          {totalShares > 0 && (
            <span className="inline-flex items-center justify-center min-w-[22px] h-[22px] px-[6px] rounded-full bg-white/20 text-white text-[11px] font-bold">
              {totalShares.toLocaleString()}
            </span>
          )}
        </button>

        <SharePopover
          open={popoverOpen}
          onClose={() => setPopoverOpen(false)}
          item={{
            title: article.title,
            subtitle: article.dek,
            url: pageUrl,
            type: "article",
            imageUrl: article.heroUrl,
          }}
          triggerRef={buttonRef as React.RefObject<HTMLElement>}
          onComment={onComment}
        />
      </div>
    </div>
  );
}

export default function ArticlePage() {
  const { slug } = useParams<{ slug: string }>();
  const [searchParams] = useSearchParams();
  const previewNonce = searchParams.get("preview");
  const navigate = useNavigate();
  const { article, loading: articleLoading, error: articleError } = useMagazineArticle(slug, previewNonce);
  const authUser = useAuthUser();
  const isLoggedIn = !authUser.loading && authUser.id.length > 0;

  useScrollDepthTracking({
    pageType: "article",
    entitySlug: slug,
    entityType: "article",
  });
  const { articles: allArticles } = useMagazineArticles();
  const [related, setRelated] = useState<MagazineArticle[]>([]);
  const [relatedLoading, setRelatedLoading] = useState(true);
  const [scrolled, setScrolled] = useState(false);
  const [copyDone, setCopyDone] = useState(false);
  const progressBarRef = useRef<HTMLDivElement>(null);
  const lastScrollState = useRef(false);
  const rawContentHtml = useMemo(() => article?.contentHtml ?? "", [article?.contentHtml]);
  const shortcodeMarked = useMemo(
    () => transformTrackShortcodes(transformReleaseShortcodes(transformArtistShortcodes(rawContentHtml))),
    [rawContentHtml]
  );
  const { markedHtml: videoMarked, videos: videoEmbeds } = useMemo(
    () => transformArticleHtmlForVideoEmbeds(shortcodeMarked),
    [shortcodeMarked]
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
  const [checkingRedirect, setCheckingRedirect] = useState(false);



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
    if (articleLoading || article || !slug) return;
    let alive = true;
    setCheckingRedirect(true);
    lookupSlugRedirect(slug)
      .then((newSlug) => { if (!alive) return; if (newSlug) navigate(`/magazine/${newSlug}`, { replace: true }); setCheckingRedirect(false); })
      .catch(() => { if (alive) setCheckingRedirect(false); });
    return () => { alive = false; };
  }, [slug, articleLoading, article, navigate]);

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

  const handleNavCopy = () => {
    navigator.clipboard?.writeText(window.location.href);
    setCopyDone(true);
    setTimeout(() => setCopyDone(false), 2500);
  };

  const [communitySheetOpen, setCommunitySheetOpen] = useState(false);

  const scrollToCommunity = useCallback(() => {
    const el = document.getElementById("community-section");
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, []);

  const shareText = article?.title ?? "";
  const pageUrl = typeof window !== "undefined" ? window.location.href : "";
  const heroShareCount = useArticleShareCount(pageUrl);

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

  if (articleLoading) return <SkeletonArticlePage />;
  if (checkingRedirect) return <div className="min-h-screen flex items-center justify-center"><div className="flex items-center gap-3 text-[var(--wk-text-muted)]"><i className="ri-loader-4-line animate-spin text-[20px]" /><span className="text-[14px]">Checking for updated link…</span></div></div>;
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
      {previewNonce ? <ArticlePreviewModeBanner /> : null}

      <MetaTags title={article.title} description={article.dek || `Read ${article.title} on WAKILISHA Magazine.`} imageUrl={article.heroUrl} url={typeof window !== "undefined" ? window.location.href : undefined} type="article" />
      <SchemaOrg
        data={{
          "@type": "Article",
          headline: article.title,
          description: article.dek || undefined,
          image: article.heroUrl,
          datePublished: article.date,
          author: article.author ? { "@type": "Person", name: article.author } : undefined,
          publisher: { "@type": "Organization", name: "WAKILISHA" },
          url: typeof window !== "undefined" ? window.location.href : undefined,
        }}
      />
      <div className="article-progress" ref={progressBarRef}><span style={{ transform: "scaleX(0)" }} /></div>
      <div className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${scrolled ? "opacity-100 translate-y-0" : "opacity-0 -translate-y-full pointer-events-none"} bg-[var(--wk-bg)]/95 backdrop-blur-md border-b border-[var(--wk-border)]`}>
        <div className="max-w-[1180px] mx-auto px-6 h-14 flex items-center gap-4"><Link to="/magazine" className="flex items-center gap-1.5 text-[12px] font-bold text-[var(--wk-text-muted)] hover:text-[var(--wk-brand)] transition-colors whitespace-nowrap shrink-0"><WkIcon name="ArrowLeft" size={14} />Magazine</Link><div className="h-4 w-px bg-[var(--wk-border)] shrink-0" /><h2 className="text-[13px] font-bold text-[var(--wk-text)] flex-1 min-w-0 truncate">{article.title}</h2><button onClick={handleNavCopy} className="ml-auto shrink-0 h-8 px-3 rounded-full border border-[var(--wk-border)] bg-[var(--wk-surface)] text-[11px] font-semibold text-[var(--wk-text-soft)] hover:border-[var(--wk-brand)] hover:text-[var(--wk-brand)] transition-all flex items-center gap-1.5 cursor-pointer whitespace-nowrap"><i className="ri-link-m" />{copyDone ? "Copied!" : "Share"}</button></div>
      </div>

      <section className="relative overflow-hidden" style={{ height: "70vh", minHeight: "480px" }}>
        {article.heroUrl ? <img src={article.heroUrl} alt={article.title} loading="lazy" className="absolute inset-0 w-full h-full object-cover" style={{ objectPosition: "50% 30%" }} /> : <Chapter19FallbackImage id={article.id} slug={article.slug} name={article.title} />}
        <div className="absolute top-0 left-0 right-0 z-20 px-6 py-5 flex items-center justify-between">
          <Link to="/magazine" className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-black/25 backdrop-blur-sm px-4 py-2 text-[11px] font-bold uppercase tracking-wider text-white/85 hover:bg-black/45 transition-all whitespace-nowrap"><WkIcon name="ArrowLeft" size={13} />Magazine</Link>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setCommunitySheetOpen(true)}
              className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-black/25 backdrop-blur-sm px-3 py-2 text-[11px] font-bold text-white/80 hover:bg-black/45 transition-all cursor-pointer whitespace-nowrap"
            >
              <i className="ri-more-2-line text-[16px]" />
            </button>
            <button onClick={handleNavCopy} className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-black/25 backdrop-blur-sm px-3 py-2 text-[11px] font-bold text-white/80 hover:bg-black/45 transition-all cursor-pointer whitespace-nowrap">
              <i className="ri-share-line" />{copyDone ? "Copied!" : "Share"}
              {heroShareCount > 0 && (
                <span className="inline-flex items-center justify-center min-w-[18px] h-[18px] px-[4px] rounded-full bg-white/20 text-white text-[10px] font-bold">
                  {heroShareCount.toLocaleString()}
                </span>
              )}
            </button>
          </div>
        </div>
      </section>

      <div className="relative z-10 rounded-t-[28px] bg-[var(--wk-bg)]" style={{ marginTop: "-64px", boxShadow: "0 -4px 32px -8px rgba(0,0,0,0.10), 0 4px 16px -4px rgba(0,0,0,0.06)" }}>
        <ArticleFloatHeader article={article} />
        <div className="max-w-[740px] mx-auto px-6 lg:px-8"><div className="h-px bg-[var(--wk-border)] mb-10" /></div>
        <article className="max-w-[740px] mx-auto px-6 lg:px-8 pb-12">
          <ArticleContentRenderer segments={displaySegments} videos={videoEmbeds} releases={finalReleases} artists={artistEmbeds} tracks={trackEmbeds} articleSlug={article.slug} />
        </article>
        <div className="max-w-[740px] mx-auto px-6 lg:px-8 pb-16">
          {article.categories?.length > 0 && <TagBlock label="Categories" items={article.categories} basePath="/categories" />}
          {article.tags?.length > 0 && <TagBlock label="Topics" items={article.tags} basePath="/tags" />}
          <ArticleBottomShare article={article} shareText={shareText} onComment={scrollToCommunity} />
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

      <ArticleRelated stories={related} loading={relatedLoading} />
      <section className="bg-[var(--wk-surface)] border-t border-[var(--wk-border)] py-16 px-6 text-center"><div className="max-w-[480px] mx-auto"><p className="text-[10px] font-black uppercase tracking-[0.22em] text-[var(--wk-brand)] mb-3">WAKILISHA Magazine</p><h3 className="text-[24px] lg:text-[28px] font-black tracking-[-0.035em] text-[var(--wk-text)] mb-6 leading-snug">Stories that move African creative life forward.</h3><Link to="/magazine" className="inline-flex items-center gap-2 rounded-full bg-[var(--wk-brand)] text-[var(--wk-brand-on)] px-7 py-3.5 text-[14px] font-black transition-all hover:-translate-y-0.5 whitespace-nowrap">Back to Magazine<WkIcon name="ArrowRight" size={16} /></Link></div></section>
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