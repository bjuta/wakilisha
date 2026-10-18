import "@/styles/wakilisha-magazine-38-44.css";
import { useScrollRevealElements } from "@/hooks/useScrollReveal";
import { useEffect, useMemo, useState, useRef, useCallback } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useMagazineArticles, type MagazineArticle } from "@/services/magazineArticles";
import { MagazineCard } from "./components/MagazineCard";
import { SectionCarousel } from "./components/SectionCarousel";
import { FeaturedArtistSpotlight } from "./components/FeaturedArtistSpotlight";
import { FeaturedGuideSpotlight } from "./components/FeaturedGuideSpotlight";
import { SkeletonMagazinePage } from "@/components/skeletons/Skeletons";
import { Chapter19FallbackImage } from "@/components/media/Chapter19FallbackImage";
import { ResponsiveMediaImage } from "@/components/media/ResponsiveMediaImage";
import { useAuthUser } from "@/hooks/useAuthUser";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
  arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { NewsletterSubscribe } from "@/components/feature/NewsletterSubscribe";
import { ArticleAuthorIdentity } from "@/components/design-system/editorial/ArticleAuthorIdentity";


function computeIssueInfo(articles: MagazineArticle[]) {
  if (!articles.length) return { number: 1, date: "June 2026" };
  const latest = articles[0];
  const d = latest.date ? new Date(latest.date) : new Date();
  const safe = Number.isNaN(d.getTime()) ? new Date() : d;
  const year = safe.getFullYear();
  const month = safe.getMonth() + 1;
  return {
    number: Math.max(1, (year - 2024) * 12 + month),
    date: safe.toLocaleDateString("en", { month: "long", year: "numeric" }),
  };
}

const MIN_HOMEPAGE_SECTION_STORIES = 3;

/* ── Section header ── */
function SectionLabel({ children, count, href }: { children: string; count?: number; href?: string }) {
  return (
    <div className="flex items-end justify-between mb-8 gap-4 flex-wrap">
      <div className="flex items-center gap-3">
        <span className="text-[10px] font-black uppercase tracking-[0.22em] text-[var(--wk-brand)]">
          {children}
        </span>
        {count !== undefined && (
          <span className="text-[11px] font-semibold text-[var(--wk-text-faint)] bg-[var(--wk-surface)] border border-[var(--wk-border)] px-2.5 py-0.5 rounded-full">
            {count} {count === 1 ? "story" : "stories"}
          </span>
        )}
      </div>
      {href && (
        <Link to={href} className="text-[12px] font-bold text-[var(--wk-text-muted)] hover:text-[var(--wk-brand)] transition-colors flex items-center gap-1 whitespace-nowrap">
          View all <i className="ri-arrow-right-line text-[11px]" />
        </Link>
      )}
    </div>
  );
}

/* ── Section type for sortable registry ── */
type SectionDef = {
  id: string;
  render: () => React.ReactNode;
};

/* ── Sortable wrapper for any section (drag handle for admins) ── */
function SortableBlock({
  id,
  enabled,
  children,
}: {
  id: string;
  enabled: boolean;
  children: React.ReactNode;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id, disabled: !enabled });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.35 : 1,
    position: "relative",
    zIndex: isDragging ? 40 : 1,
  };

  if (!enabled) return <>{children}</>;

  return (
    <div ref={setNodeRef} style={style} className="group/sortable">
      <button
        {...attributes}
        {...listeners}
        className="absolute -left-9 top-2 w-7 h-7 flex items-center justify-center rounded-md opacity-0 group-hover/sortable:opacity-100 hover:bg-[var(--wk-surface)] cursor-grab active:cursor-grabbing transition-all z-10"
        aria-label={`Drag to reorder ${id}`}
      >
        <i className="ri-draggable text-[var(--wk-text-faint)] text-[18px]" />
      </button>
      {children}
    </div>
  );
}

export default function Magazine() {
  const { articles: stories, loading, error } = useMagazineArticles();
  const [searchParams] = useSearchParams();
  const searchQuery = (searchParams.get("search") || "").trim();
  const isSearchMode = searchQuery.length > 0;

  const status: "loading" | "ready" | "error" =
    loading
      ? "loading"
      : error
        ? "error"
        : "ready";
  const [selectedMagazineSection, setSelectedMagazineSection] = useState("All");
  const heroRef = useRef<HTMLDivElement>(null);
  const heroImgRef = useRef<HTMLImageElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const { id: userId, loading: authLoading } = useAuthUser();
  const isAdmin = !authLoading && !!userId;

  /* Parallax scroll on hero image */
  useEffect(() => {
    const hero = heroRef.current;
    const img = heroImgRef.current;
    if (!hero || !img) return;
    const onScroll = () => {
      const scrollY = window.scrollY;
      const h = hero.offsetHeight;
      const p = Math.min(scrollY / h, 1);
      img.style.transform = `scale(${1 + p * 0.06})`;
      img.style.opacity = String(Math.max(0.85 - p * 0.3, 0.4));
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [status]);

  useScrollRevealElements([status]);

  const { number: issueNum, date: issueDate } = useMemo(
    () => computeIssueInfo(stories),
    [stories],
  );

  const heroStory = stories[0];
  const picks = stories.slice(1, 5);
  const latest = stories.slice(5, 11);
  const sectionBlockStories = stories.slice(11);

  const sectionMap = useMemo(() => {
    const map: Record<string, MagazineArticle[]> = {};
    for (const story of sectionBlockStories) {
      const sec = story.section || "Article";
      if (!map[sec]) map[sec] = [];
      map[sec].push(story);
    }
    return map;
  }, [sectionBlockStories]);

  const topSections = useMemo(
    () =>
      Object.entries(sectionMap)
        .filter(
          ([, sectionStories]) =>
            sectionStories.length
            >= MIN_HOMEPAGE_SECTION_STORIES,
        )
        .sort(
          (a, b) =>
            b[1].length - a[1].length,
        )
        .slice(0, 3)
        .map(([name]) => name),
    [sectionMap],
  );

  const navigate = useNavigate();
  const heroArticleUrl = heroStory ? `/magazine/${heroStory.slug}` : "/magazine";

  const handleHeroOpen = useCallback((event: React.MouseEvent<HTMLDivElement>) => {
    const target = event.target instanceof Element ? event.target : null;
    if (target?.closest("a,button")) return;
    navigate(heroArticleUrl);
  }, [navigate, heroArticleUrl]);

  const handleHeroKeyDown = useCallback((event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== "Enter" && event.key !== " ") return;
    const target = event.target instanceof Element ? event.target : null;
    if (target?.closest("a,button")) return;
    event.preventDefault();
    navigate(heroArticleUrl);
  }, [navigate, heroArticleUrl]);

  /* ── Search results when ?search= is present ── */
  const searchResults = useMemo(() => {
    if (!isSearchMode) return [];
    const q = searchQuery.toLowerCase();
    return stories.filter((s) => {
      if (s.title?.toLowerCase().includes(q)) return true;
      if (s.author?.toLowerCase().includes(q)) return true;
      if (s.section?.toLowerCase().includes(q)) return true;
      if (s.dek?.toLowerCase().includes(q)) return true;
      if (s.excerpt) {
        const text = typeof s.excerpt === "string" ? s.excerpt : (s.excerpt as { rendered?: string })?.rendered || "";
        if (text.toLowerCase().includes(q)) return true;
      }
      return false;
    });
  }, [isSearchMode, searchQuery, stories]);

  /* ── Full section order for all sections (drag-and-drop, admin only) ── */
  const ORDER_STORAGE_KEY = "wk-magazine-full-section-order";

  const [sectionOrder, setSectionOrder] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem(ORDER_STORAGE_KEY);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
  );

  /* Keep a ref to the latest section IDs so the drag handler never uses a stale closure */
  const sectionIdsRef = useRef<string[]>([]);

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;
      if (!over || active.id === over.id) return;

      const activeId = String(active.id);
      const overId = String(over.id);

      setSectionOrder((prev) => {
        if (prev.length === 0) {
          const currentIds = sectionIdsRef.current;
          const aIdx = currentIds.indexOf(activeId);
          const bIdx = currentIds.indexOf(overId);
          if (aIdx === -1 || bIdx === -1) return prev;
          const reordered = arrayMove([...currentIds], aIdx, bIdx);
          try { localStorage.setItem(ORDER_STORAGE_KEY, JSON.stringify(reordered)); } catch { /* noop */ }
          return reordered;
        }

        const oldIdx = prev.indexOf(activeId);
        const newIdx = prev.indexOf(overId);
        if (oldIdx === -1 || newIdx === -1) return prev;

        const reordered = arrayMove([...prev], oldIdx, newIdx);
        try { localStorage.setItem(ORDER_STORAGE_KEY, JSON.stringify(reordered)); } catch { /* noop */ }
        return reordered;
      });
    },
    [],
  );

  /* ── Build ordered section definitions (always full page, no filtering) ── */
  const orderedSections = useMemo((): SectionDef[] => {
    const defs: SectionDef[] = [];

    // Editor’s Picks
    if (picks.length > 0) {
      defs.push({
        id: "picks",
        render: () => (
          <section className="wk-reveal">
            <SectionLabel>Editor’s Picks</SectionLabel>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 lg:items-stretch">
              <div className="lg:h-full">
                <MagazineCard variant="hero" story={picks[0]} rank={1} />
              </div>
              <div className="grid grid-cols-1 gap-5 lg:grid-rows-3">
                {picks.slice(1, 4).map((story, i) => (
                  <div key={story.slug} className="flex">
                    <CompactCardFill story={story} rank={i + 2} />
                  </div>
                ))}
              </div>
            </div>
          </section>
        ),
      });
    }

    // Latest Stories
    if (latest.length > 0) {
      defs.push({
        id: "latest",
        render: () => (
          <section className="wk-reveal">
            <SectionLabel count={latest.length} href="/magazine">Latest Stories</SectionLabel>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {latest.map((story) => (
                <MagazineCard key={story.slug} variant="standard" story={story} />
              ))}
            </div>
          </section>
        ),
      });
    }

    // Featured Artists
    defs.push({
      id: "artists",
      render: () => <FeaturedArtistSpotlight />,
    });

    // Section blocks — top 3 by story count
    for (const section of topSections) {
      const secStories = sectionMap[section] || [];
      if (secStories.length === 0) continue;
      const sectionId = `block-${section}`;
      defs.push({
        id: sectionId,
        render: () => <SectionBlockContent section={section} stories={secStories} />,
      });
    }

    // Featured Guide
    defs.push({
      id: "guides",
      render: () => <FeaturedGuideSpotlight />,
    });

    // Order: prefer saved order, fall back to default
    if (sectionOrder.length > 0) {
      const ordered = sectionOrder
        .filter((id) => defs.some((d) => d.id === id))
        .map((id) => defs.find((d) => d.id === id)!);
      // Append any new sections not in the saved order
      const seen = new Set(ordered.map((d) => d.id));
      for (const def of defs) {
        if (!seen.has(def.id)) ordered.push(def);
      }
      return ordered;
    }

    return defs;
  }, [picks, latest, topSections, sectionMap, sectionOrder]);

  const sectionIds = useMemo(() => orderedSections.map((s) => s.id), [orderedSections]);
  sectionIdsRef.current = sectionIds;
  const showDragHandles = isAdmin && orderedSections.length > 1;

  // Only show source-backed section filters. Workbook P10 filters, never scroll-jumps.
  const magazineSections = useMemo(() => {
    const sections = new Set(stories.map((story) => story.section).filter(Boolean));
    const preferred = ["Music", "Film", "Fashion", "Food", "Language", "Places"];
    return ["All", ...preferred.filter((section) => sections.has(section)),
      ...Array.from(sections).filter((section) => !preferred.includes(section)).sort()];
  }, [stories]);

  const filteredMagazineStories = useMemo(
    () => selectedMagazineSection === "All"
      ? stories
      : stories.filter((story) => story.section === selectedMagazineSection),
    [selectedMagazineSection, stories],
  );

  if (status === "loading") {
    return <SkeletonMagazinePage />;
  }

  /* ── Search results mode ── */
  if (isSearchMode) {
    return (
      <main className="min-h-screen bg-[var(--wk-bg)]">
        {/* Search header */}
        <div className="border-b border-[var(--wk-border)] bg-[var(--wk-surface)]">
          <div className="max-w-[1280px] mx-auto px-6 lg:px-8 py-10">
            <Link
              to="/magazine"
              className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-[var(--wk-text-soft)] hover:text-[var(--wk-brand)] transition-colors mb-6"
            >
              <i className="ri-arrow-left-line text-sm" />
              Back to Magazine
            </Link>
            <h1 className="text-[clamp(28px,4vw,48px)] font-black tracking-[-0.04em] text-[var(--wk-text)]">
              Articles featuring <span className="text-[var(--wk-brand)]">"{searchQuery}"</span>
            </h1>
            <p className="mt-2 text-[14px] text-[var(--wk-text-soft)]">
              {searchResults.length} {searchResults.length === 1 ? "result" : "results"} found
            </p>
          </div>
        </div>

        {/* Results grid */}
        <div className="max-w-[1280px] mx-auto px-6 lg:px-8 py-12">
          {searchResults.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-[var(--wk-surface)] border border-[var(--wk-border)]">
                <i className="ri-search-line text-[var(--wk-text-faint)] text-[28px]" />
              </div>
              <p className="mt-5 text-[16px] font-bold text-[var(--wk-text-muted)]">
                No stories found for "{searchQuery}"
              </p>
              <p className="mt-1.5 text-[13px] text-[var(--wk-text-faint)] max-w-sm">
                Try a different search term or browse the full magazine.
              </p>
              <Link
                to="/magazine"
                className="mt-6 rounded-full bg-[var(--wk-brand)] px-5 py-2.5 text-[13px] font-bold text-[var(--wk-brand-on)] hover:opacity-90 transition-opacity"
              >
                Browse Magazine
              </Link>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {searchResults.map((story) => (
                <MagazineCard key={story.slug} variant="standard" story={story} />
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <footer className="border-t border-[var(--wk-border)] py-14 text-center">
          <span className="text-[9px] font-black uppercase tracking-[0.24em] text-[var(--wk-brand)] mb-3 block">
            WAKILISHA Magazine
          </span>
          <p className="text-[24px] lg:text-[28px] font-black tracking-[-0.035em] text-[var(--wk-text)] leading-snug max-w-[420px] mx-auto">
            Music, art, and stories from East Africa.
          </p>
        </footer>
      </main>
    );
  }

  if (status === "error" || !heroStory) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-[var(--wk-bg)]">
        <div className="text-center px-6">
          <i className="ri-error-warning-line text-[var(--wk-text-faint)] text-[40px] mb-4 block" />
          <h1 className="text-[20px] font-bold text-[var(--wk-text-muted)]">{error ? "We couldn't load the magazine. Try again in a moment." : "No stories yet."}</h1>
        </div>
      </main>
    );
  }

  return (
    <main data-wk-workbook-screen="magazine" className="min-h-screen bg-[var(--wk-bg)]">

      {/* ═══════════════════════ HERO ═══════════════════════ */}
      <div
        ref={heroRef}
        role="link"
        tabIndex={0}
        onClick={handleHeroOpen}
        onKeyDown={handleHeroKeyDown}
        aria-label={`Read ${heroStory.title}`}
        className="relative min-h-[78vh] flex items-end overflow-hidden bg-[#0a0a0a] block group cursor-pointer"
      >
        {heroStory.heroUrl ? (
          <ResponsiveMediaImage
            ref={heroImgRef}
            src={heroStory.heroUrl}
            preset="hero"
            loading="eager"
            fetchPriority="high"
            decoding="async"
            data-wakilisha-magazine-hero="true"
            alt=""
            className="absolute inset-0 w-full h-full object-cover opacity-85"
          />
        ) : (
          <Chapter19FallbackImage
            id={heroStory.id}
            slug={heroStory.slug}
            name={heroStory.title}
          />
        )}
        <div className="absolute inset-0 bg-gradient-to-b from-black/10 via-black/25 to-black/90" />

        <div className="relative z-10 w-full max-w-[1280px] mx-auto px-6 lg:px-8 pb-16 pt-28 text-white">

          <p className="mb-4 text-[11px] font-bold uppercase tracking-[0.18em] text-[var(--wk-brand)]">{heroStory.section} · Cover story</p>
          <h1 className="text-[clamp(40px,6vw,80px)] font-black tracking-[-0.05em] leading-[0.92] max-w-[16ch] group-hover:opacity-90 transition-opacity duration-500">
            {heroStory.title}
          </h1>

          <p className="mt-5 text-[16px] lg:text-[18px] leading-relaxed text-white/60 max-w-[52ch]">
            {heroStory.dek}
          </p>

          <div className="mt-6 flex flex-wrap items-center gap-3">
            <Link to={heroArticleUrl} className="inline-flex min-h-11 items-center gap-2 bg-white px-5 text-[13px] font-bold text-black transition-opacity hover:opacity-85">Read the story <span aria-hidden="true">→</span></Link>
          </div>

          <div className="flex items-center gap-2 mt-6 text-[12px] flex-wrap">
            <ArticleAuthorIdentity name={heroStory.author} personPath={heroStory.authorPersonPath}

              className="inline-flex items-center gap-1.5 rounded-full bg-white/10 backdrop-blur-md border border-white/15 text-white/85 font-semibold px-3 py-1.5 hover:bg-white/18 hover:text-white transition-all"
              onClick={(e) => e.stopPropagation()}
            >
              {heroStory.author}
            </ArticleAuthorIdentity>
            <span className="inline-flex items-center rounded-full bg-white/10 backdrop-blur-md border border-white/15 text-white/65 px-3 py-1.5">
              {heroStory.date || issueDate}
            </span>
            <span className="inline-flex items-center rounded-full bg-white/10 backdrop-blur-md border border-white/15 text-white/65 px-3 py-1.5">
              {heroStory.readingTime} min read
            </span>
          </div>
        </div>

        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-10 hidden lg:flex flex-col items-center gap-2">
          <div className="w-px h-12 bg-gradient-to-b from-white/40 to-transparent" />
        </div>
      </div>

      {/* Source-backed Magazine section filters, Workbook P10 */}
      <nav aria-label="Magazine sections" className="sticky top-0 z-40 border-b border-[var(--wk-border)] bg-[var(--wk-surface)]/95 backdrop-blur-lg">
        <div className="mx-auto flex max-w-[1280px] items-center gap-2 overflow-x-auto px-5 py-3 [scrollbar-width:none] sm:px-8">
          {magazineSections.map((section) => (
            <button
              key={section}
              type="button"
              aria-pressed={selectedMagazineSection === section}
              onClick={() => setSelectedMagazineSection(section)}
              className={`min-h-11 shrink-0 border-b-2 px-3 text-[13px] font-semibold transition-colors ${selectedMagazineSection === section
                ? "border-[var(--wk-brand)] text-[var(--wk-text)]"
                : "border-transparent text-[var(--wk-text-muted)] hover:text-[var(--wk-text)]"}`}
            >
              {section}
            </button>
          ))}
        </div>
      </nav>

      {/* ═══════════════════════ CONTENT BODY ═══════════════════════ */}
      <div ref={contentRef} data-mag-content className="max-w-[1280px] mx-auto px-5 sm:px-8 flex flex-col gap-14 lg:gap-20 py-10 lg:py-16">

        {selectedMagazineSection !== "All" ? (
          <section aria-live="polite" className="min-h-[260px]">
            <div className="mb-6 flex items-baseline justify-between border-b border-[var(--wk-border)] pb-4">
              <h2 className="text-[26px] font-black tracking-[-0.04em] text-[var(--wk-text)]">
                {selectedMagazineSection}
              </h2>
              <span className="text-[12px] text-[var(--wk-text-muted)]">{filteredMagazineStories.length} stories</span>
            </div>
            <div className="grid grid-cols-1 gap-x-6 gap-y-8 sm:grid-cols-2 lg:grid-cols-3">
              {filteredMagazineStories.map((story) => (
                <MagazineCard key={story.slug} variant="standard" story={story} />
              ))}
            </div>
          </section>
        ) : showDragHandles ? (
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext
              items={sectionIds}
              strategy={verticalListSortingStrategy}
            >
              <div className="flex flex-col gap-20">
                {orderedSections.map((def) => (
                  <SortableBlock key={def.id} id={def.id} enabled={showDragHandles}>
                    <div data-mag-section={def.id}>{def.render()}</div>
                  </SortableBlock>
                ))}
              </div>
            </SortableContext>
          </DndContext>
        ) : (
          <div className="flex flex-col gap-20">
            {orderedSections.map((def) => (
              <div key={def.id} data-mag-section={def.id}>{def.render()}</div>
            ))}
          </div>
        )}

        <div data-wk-magazine-newsletter className="mx-auto w-full max-w-[800px] border-t border-[var(--wk-border)] pt-10">
          <NewsletterCTA />
        </div>

        {/* ── Footer ── */}
        <footer className="border-t border-[var(--wk-border)] pt-14 pb-8 text-center">
          <span className="text-[9px] font-black uppercase tracking-[0.24em] text-[var(--wk-brand)] mb-3 block">
            WAKILISHA Magazine
          </span>
          <p className="text-[24px] lg:text-[28px] font-black tracking-[-0.035em] text-[var(--wk-text)] leading-snug max-w-[420px] mx-auto">
            Music, art, and stories from East Africa.
          </p>
          <p className="mt-3 text-[12px] text-[var(--wk-text-faint)]">
            Issue {issueNum} · {issueDate}
          </p>
        </footer>
      </div>
    </main>
  );
}

/* ── Section block content (Music carousel, even grid, odd hero+compact) ── */
function SectionBlockContent({ section, stories }: { section: string; stories: MagazineArticle[] }) {
  const isMusic = section.toLowerCase() === "music";

  if (isMusic) {
    return (
      <section className="wk-reveal">
        <SectionLabel count={stories.length} href="/magazine">{section}</SectionLabel>
        <SectionCarousel stories={stories} />
      </section>
    );
  }

  // Alternate layouts based on a hash of the section name (stable regardless of drag order)
  const isEven = section.length % 2 === 0;

  if (isEven) {
    return (
      <section className="wk-reveal">
        <SectionLabel count={stories.length} href="/magazine">{section}</SectionLabel>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {stories.slice(0, 3).map((story, i) => (
            <MagazineCard key={story.slug} variant="standard" story={story} rank={i + 1} />
          ))}
        </div>
      </section>
    );
  }

  return (
    <section className="wk-reveal">
      <SectionLabel count={stories.length} href="/magazine">{section}</SectionLabel>
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-5 lg:items-stretch">
        {stories.slice(0, 1).map((story) => (
          <div key={story.slug} className="lg:col-span-3 lg:h-full">
            <MagazineCard variant="hero" story={story} rank={1} />
          </div>
        ))}
        <div className="lg:col-span-2 grid grid-cols-1 gap-5 lg:grid-rows-3">
          {stories.slice(1, 4).map((story, i) => (
            <div key={story.slug} className="flex">
              <CompactCardFill story={story} rank={i + 2} />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ── Compact card that stretches to fill row height ── */
function CompactCardFill({ story, rank }: { story: MagazineArticle; rank: number }) {
  const url = `/magazine/${story.slug}`;
  return (
    <Link
      to={url}
      className="group flex h-full w-full gap-4 border-b border-[var(--wk-border)] py-4"
    >
      <div className="aspect-[3/2] w-[38%] shrink-0 overflow-hidden rounded-[12px] bg-[var(--wk-surface-raised)]">
        {story.heroUrl ? (
          <ResponsiveMediaImage
            src={story.heroUrl}
            preset="thumbnail"
            loading="lazy"
            fetchPriority="low"
            decoding="async"
            alt=""
            className="w-full h-full object-cover object-top transition-transform duration-500 group-hover:scale-110"
          />
        ) : (
          <Chapter19FallbackImage
            id={story.id}
            slug={story.slug}
            name={story.title}
          />
        )}
      </div>
      <div className="flex flex-col justify-center gap-1.5 flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-[9px] font-black uppercase tracking-[0.16em] text-[var(--wk-brand)]">{story.section}</span>
          <span className="text-[10px] font-bold text-[var(--wk-text-faint)] opacity-40">#{rank}</span>
        </div>
        <h4 className="line-clamp-2 text-[17px] font-bold leading-[1.25] tracking-[-0.02em] text-[var(--wk-text)] group-hover:text-[var(--wk-brand)]">
          {story.title}
        </h4>
        {story.dek && (
          <p className="text-[12px] leading-relaxed text-[var(--wk-text-soft)] line-clamp-3">
            {story.dek.length > 160 ? story.dek.slice(0, 160).trimEnd() + "…" : story.dek}
          </p>
        )}
        <div className="flex items-center gap-1.5 text-[11px] text-[var(--wk-text-faint)] mt-auto pt-1">
          <span className="font-semibold truncate max-w-[14ch]">{story.author}</span>
          <span className="text-[var(--wk-border-strong)] shrink-0">·</span>
          <span className="shrink-0">{story.readingTime} min</span>
        </div>
      </div>
    </Link>
  );
}

/* ── Inline Newsletter component ── */
function NewsletterCTA() {
  return (
    <section className="wk-reveal">
      <NewsletterSubscribe
          variant="compact"
        formId="magazine-newsletter-form"
        headline="Read with us"
        description="Get new stories and charts in your inbox."
        contextFields={{ wk_page_type: "magazine", wk_source_section: "newsletter_footer" }}
      />
    </section>
  );
}