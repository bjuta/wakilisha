import { useEffect, useMemo, useState, useRef, useCallback } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useMagazineArticles, type MagazineArticle } from "@/services/magazineArticles";
import { getAuthorMeta } from "@/services/authorProfiles";
import { MagazineCard } from "./components/MagazineCard";
import { SectionCarousel } from "./components/SectionCarousel";
import { FeaturedArtistSpotlight } from "./components/FeaturedArtistSpotlight";
import { FeaturedGuideSpotlight } from "./components/FeaturedGuideSpotlight";
import { SkeletonMagazinePage } from "@/components/skeletons/Skeletons";
import { Chapter19FallbackImage } from "@/components/media/Chapter19FallbackImage";
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


/* ── Scroll reveal ── */
function useScrollReveal(deps: unknown[] = []) {
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("mag-reveal-visible");
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.08, rootMargin: "0px 0px -32px 0px" },
    );
    const els = document.querySelectorAll(".mag-reveal");
    els.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, deps);
}

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

  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [activeSection, setActiveSection] = useState("All");
  const heroRef = useRef<HTMLDivElement>(null);
  const heroImgRef = useRef<HTMLImageElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const { id: userId, loading: authLoading } = useAuthUser();
  const isAdmin = !authLoading && !!userId;

  useEffect(() => {
    if (loading) setStatus("loading");
    else if (error) setStatus("error");
    else setStatus("ready");
  }, [loading, error]);

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

  useScrollReveal([status]);

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
    () => Object.entries(sectionMap).sort((a, b) => b[1].length - a[1].length).slice(0, 3).map(([n]) => n),
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

    // Editor's Picks
    if (picks.length > 0) {
      defs.push({
        id: "picks",
        render: () => (
          <section className="mag-reveal">
            <SectionLabel>Editor's Picks</SectionLabel>
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
          <section className="mag-reveal">
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

    // Newsletter
    defs.push({
      id: "newsletter",
      render: () => (
        <NewsletterSubscribe
          formId="magazine-newsletter-form"
          headline="Read with us"
          description="Get weekly analysis, chart commentary, and industry signals delivered to your inbox."
          contextFields={{ wk_page_type: "magazine", wk_source_section: "newsletter_footer" }}
          analytics={{
            pageType: "magazine",
          }}
        />
      ),
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

  /* ── Scroll-spy: track which section is in view ── */
  useEffect(() => {
    if (status !== "ready") return;
    const els = document.querySelectorAll("[data-mag-section]");
    if (els.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        // Find the first section whose top is above the nav (roughly 80px from top)
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible.length > 0) {
          const id = visible[0].target.getAttribute("data-mag-section");
          if (id) setActiveSection(id);
        }
      },
      { rootMargin: "-80px 0px -60% 0px", threshold: 0 },
    );
    els.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, [status, orderedSections]);

  /* ── Human-readable label for each section ID ── */
  const sectionNavItems = useMemo(() => {
    const LABELS: Record<string, string> = {
      picks: "Editor's Picks",
      latest: "Latest",
      artists: "Featured Artists",
      guides: "Featured Guide",
      newsletter: "Newsletter",
    };
    return [
      { id: "All", label: "All" },
      ...orderedSections.map((s) => ({
        id: s.id,
        label: s.id.startsWith("block-") ? s.id.replace("block-", "") : (LABELS[s.id] || s.id),
      })),
    ];
  }, [orderedSections]);

  const scrollToSection = useCallback((id: string) => {
    if (id === "All") {
      const el = contentRef.current;
      if (el) {
        const top = el.getBoundingClientRect().top + window.scrollY - 80;
        window.scrollTo({ top, behavior: "smooth" });
      }
      return;
    }
    const el = document.querySelector(`[data-mag-section="${id}"]`);
    if (el) {
      setActiveSection(id);
      el.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, []);

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
                No articles found for "{searchQuery}"
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
            Stories that move East African culture forward.
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
          <p className="text-[15px] font-bold text-[var(--wk-text-muted)]">{error || "No stories yet."}</p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[var(--wk-bg)]">

      {/* ═══════════════════════ HERO ═══════════════════════ */}
      <div
        ref={heroRef}
        role="link"
        tabIndex={0}
        onClick={handleHeroOpen}
        onKeyDown={handleHeroKeyDown}
        aria-label={`Read ${heroStory.title}`}
        className="relative min-h-[88vh] flex items-end overflow-hidden bg-[#0a0a0a] block group cursor-pointer -mt-16"
      >
        {heroStory.heroUrl ? (
          <img
            ref={heroImgRef}
            src={heroStory.heroUrl}
            alt=""
            className="absolute inset-0 w-full h-full object-cover opacity-85 will-change-transform"
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

          <h1 className="text-[clamp(40px,6vw,80px)] font-black tracking-[-0.05em] leading-[0.92] max-w-[16ch] group-hover:opacity-90 transition-opacity duration-500">
            {heroStory.title}
          </h1>

          <p className="mt-5 text-[16px] lg:text-[18px] leading-relaxed text-white/60 max-w-[52ch]">
            {heroStory.dek}
          </p>

          <div className="flex items-center gap-2 mt-6 text-[12px] flex-wrap">
            <Link
              to={`/authors/${getAuthorMeta(heroStory.author).slug}`}
              className="inline-flex items-center gap-1.5 rounded-full bg-white/10 backdrop-blur-md border border-white/15 text-white/85 font-semibold px-3 py-1.5 hover:bg-white/18 hover:text-white transition-all"
              onClick={(e) => e.stopPropagation()}
            >
              {heroStory.author}
            </Link>
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

      {/* ═══════════════════════ STICKY SECTION NAV ═══════════════════════ */}
      <div className="sticky top-0 z-40 border-b border-[var(--wk-border)] bg-[color-mix(in_srgb,var(--wk-surface)_92%,transparent)] backdrop-blur-[20px]">
        <div className="max-w-[1280px] mx-auto px-6 lg:px-8 flex items-center gap-5 overflow-x-auto scrollbar-none py-3.5">
          <span className="text-[10px] font-black uppercase tracking-[0.22em] text-[var(--wk-brand)] shrink-0 hidden lg:flex items-center gap-2">
            <span className="w-6 h-px bg-[var(--wk-brand)]" />
            Sections
          </span>
          <div className="flex gap-1.5 shrink-0">
            {sectionNavItems.map(({ id, label }) => (
              <button
                key={id}
                onClick={() => scrollToSection(id)}
                className={`px-4 py-2 rounded-full text-[13px] font-bold tracking-[-0.005em] transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  activeSection === id
                    ? "bg-[var(--wk-brand)] text-[var(--wk-brand-on)]"
                    : "text-[var(--wk-text-soft)] hover:text-[var(--wk-text)] bg-transparent border border-transparent hover:border-[var(--wk-border)]"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ═══════════════════════ CONTENT BODY ═══════════════════════ */}
      <div ref={contentRef} data-mag-content className="max-w-[1280px] mx-auto px-6 lg:px-8 flex flex-col gap-20 py-16">

        {showDragHandles ? (
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

        {/* ── Footer ── */}
        <footer className="border-t border-[var(--wk-border)] pt-14 pb-8 text-center">
          <span className="text-[9px] font-black uppercase tracking-[0.24em] text-[var(--wk-brand)] mb-3 block">
            WAKILISHA Magazine
          </span>
          <p className="text-[24px] lg:text-[28px] font-black tracking-[-0.035em] text-[var(--wk-text)] leading-snug max-w-[420px] mx-auto">
            Stories that move East African culture forward.
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
      <section className="mag-reveal">
        <SectionLabel count={stories.length} href="/magazine">{section}</SectionLabel>
        <SectionCarousel stories={stories} />
      </section>
    );
  }

  // Alternate layouts based on a hash of the section name (stable regardless of drag order)
  const isEven = section.length % 2 === 0;

  if (isEven) {
    return (
      <section className="mag-reveal">
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
    <section className="mag-reveal">
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
      className="group flex gap-4 rounded-xl border border-[var(--wk-border)] bg-[var(--wk-surface)] p-4 hover:border-[var(--wk-border-strong)] hover:bg-[var(--wk-surface-raised)] transition-all duration-300 w-full h-full"
    >
      <div className="w-24 shrink-0 rounded-lg overflow-hidden bg-[var(--wk-surface-raised)] self-stretch min-h-[90px]">
        {story.heroUrl ? (
          <img
            src={story.heroUrl}
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
        <h4 className="text-[14px] font-black tracking-[-0.02em] leading-snug text-[var(--wk-text)] group-hover:text-[var(--wk-brand)] transition-colors line-clamp-2">
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
    <section className="mag-reveal">
      <NewsletterSubscribe
        formId="magazine-newsletter-form"
        headline="Read with us"
        description="Get weekly analysis, chart commentary, and industry signals delivered to your inbox."
        contextFields={{ wk_page_type: "magazine", wk_source_section: "newsletter_footer" }}
      />
    </section>
  );
}