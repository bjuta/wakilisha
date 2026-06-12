import { useEffect, useState, useMemo, useRef } from 'react';
import { Link, useParams } from 'react-router-dom';
import { WkIcon } from '@/components/design-system/Icon';
import { getArticlesByAuthor, type MagazineArticle } from '@/services/magazineArticles';
import { getAuthorMeta, getVerticalColor, resolveAuthorMeta } from '@/services/authorProfiles';

type SortMode = 'latest' | 'oldest' | 'longest';
type AuthorMetaResolved = Awaited<ReturnType<typeof resolveAuthorMeta>>;

const BATCH_SIZE = 6;
const LOAD_MORE = 4;
const FEATURED_COUNT = 5;
const SECTION_BREAK_EVERY = 4;

const SORT_OPTIONS: { mode: SortMode; label: string; icon: string }[] = [
  { mode: 'latest', label: 'Latest', icon: 'ri-arrow-down-line' },
  { mode: 'oldest', label: 'Oldest', icon: 'ri-arrow-up-line' },
  { mode: 'longest', label: 'Longest', icon: 'ri-time-line' },
];

export default function MobileAuthorProfile() {
  const { slug } = useParams<{ slug: string }>();
  const [articles, setArticles] = useState<MagazineArticle[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeCategory, setActiveCategory] = useState<string>('all');
  const [sortMode, setSortMode] = useState<SortMode>('latest');
  const [visibleCount, setVisibleCount] = useState(BATCH_SIZE);
  const [authorMetaResolved, setAuthorMetaResolved] = useState<AuthorMetaResolved | null>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);

  const normalizedSlug = (slug || '').toLowerCase().replace(/[\s_-]+/g, '-');
  const fallbackMeta = getAuthorMeta(normalizedSlug);
  const authorMeta = authorMetaResolved ?? fallbackMeta;
  const firstName = authorMeta.displayName.split(' ')[0];

  useEffect(() => {
    if (!normalizedSlug) {
      setLoading(false);
      setError('No author specified');
      return;
    }

    let alive = true;
    setLoading(true);
    setError(null);

    // Fetch real author meta from registry_authors
    resolveAuthorMeta(normalizedSlug)
      .then((resolved) => {
        if (!alive) return;
        setAuthorMetaResolved(resolved);
      })
      .catch(() => {
        // Silent fallback
      });

    getArticlesByAuthor(normalizedSlug)
      .then((items) => {
        if (!alive) return;
        setArticles(items);
        setLoading(false);
      })
      .catch((err) => {
        if (!alive) return;
        setError(err instanceof Error ? err.message : 'Failed to load articles');
        setLoading(false);
      });

    return () => { alive = false; };
  }, [normalizedSlug]);

  const { sections, sectionCounts } = useMemo(() => {
    const map: Record<string, number> = {};
    for (const a of articles) {
      const sec = a.section || 'Uncategorized';
      map[sec] = (map[sec] || 0) + 1;
    }
    const sorted = Object.entries(map).sort((a, b) => b[1] - a[1]);
    return { sections: sorted.map(([name]) => name), sectionCounts: map };
  }, [articles]);

  const filteredArticles = useMemo(() => {
    let filtered = activeCategory === 'all'
      ? articles
      : articles.filter((a) => (a.section || 'Uncategorized') === activeCategory);

    switch (sortMode) {
      case 'oldest':
        return [...filtered].reverse();
      case 'longest':
        return [...filtered].sort((a, b) => b.readingTime - a.readingTime);
      default:
        return filtered;
    }
  }, [articles, activeCategory, sortMode]);

  const stats = useMemo(() => {
    if (articles.length === 0) return null;
    const totalMin = articles.reduce((s, a) => s + a.readingTime, 0);
    const topSection = sections[0] || '—';
    const topSectionPct = Math.round(((sectionCounts[topSection] || 0) / articles.length) * 100);
    return { totalMin, topSection, topSectionPct };
  }, [articles, sections, sectionCounts]);

  const hasFeatured = filteredArticles.length >= 3;
  const featuredArticles = useMemo(
    () => (hasFeatured ? filteredArticles.slice(0, FEATURED_COUNT) : []),
    [filteredArticles, hasFeatured],
  );
  const gridArticles = useMemo(
    () => (hasFeatured ? filteredArticles.slice(FEATURED_COUNT) : filteredArticles),
    [filteredArticles, hasFeatured],
  );

  const carouselItems = useMemo(() => {
    if (featuredArticles.length <= 1) return [];
    const items = featuredArticles.slice(1);
    return [...items, ...items];
  }, [featuredArticles]);

  const actualAreas = useMemo(() => {
    if (articles.length === 0) return authorMeta.areas;
    const set = new Set(authorMeta.areas);
    for (const sec of sections) {
      set.add(sec);
    }
    const ordered = authorMeta.areas.filter((a) => set.has(a));
    for (const a of Array.from(set)) {
      if (!ordered.includes(a)) ordered.push(a);
    }
    return ordered.slice(0, 4);
  }, [articles, sections, authorMeta.areas]);

  useEffect(() => { setVisibleCount(BATCH_SIZE); }, [activeCategory, sortMode]);

  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          setVisibleCount((prev) => {
            const next = prev + LOAD_MORE;
            return next >= gridArticles.length ? gridArticles.length : next;
          });
        }
      },
      { rootMargin: '300px' },
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [gridArticles.length]);

  const hasMore = visibleCount < gridArticles.length;

  /* ─── Row-based grid with alternating rhythm ─── */
  const visibleGridArticles = useMemo(
    () => gridArticles.slice(0, visibleCount),
    [gridArticles, visibleCount],
  );

  const cleanRows = useMemo(() => {
    const r: { articles: MagazineArticle[]; pattern: 'full' | 'compact' }[] = [];
    let idx = 0;
    while (idx < visibleGridArticles.length) {
      const pattern: 'full' | 'compact' = idx % 2 === 0 ? 'full' : 'compact';
      r.push({ articles: [visibleGridArticles[idx]], pattern });
      idx++;
    }
    return r;
  }, [visibleGridArticles]);

  /* ─── Render a full card ─── */
  const FullCard = ({ story }: { story: MagazineArticle }) => {
    const vc = getVerticalColor(story.section);
    return (
      <Link to={`/magazine/${story.slug}`} className="block">
        <div className="rounded-2xl overflow-hidden border border-[var(--wk-border)] bg-[var(--wk-surface)] active:scale-[0.985] transition-transform cursor-pointer">
          <div className="aspect-[16/10] overflow-hidden bg-[var(--wk-surface-raised)]">
            <img src={story.heroUrl} alt="" className="w-full h-full object-cover" loading="lazy" />
          </div>
          <div className="p-4">
            <span className="text-[9px] font-black uppercase tracking-[0.16em] mb-2 block" style={{ color: vc }}>
              {story.section}
            </span>
            <h3 className="text-[16px] font-black leading-[1.15] tracking-[-0.02em] text-[var(--wk-text)] mb-1.5 line-clamp-2">
              {story.title}
            </h3>
            {story.dek && (
              <p className="text-[12px] leading-[1.5] text-[var(--wk-text-soft)] line-clamp-2 mb-2">
                {story.dek}
              </p>
            )}
            <div className="flex items-center gap-2 text-[10px] font-semibold text-[var(--wk-text-muted)]">
              <span>{story.readingTime} min</span>
              <span className="text-[var(--wk-border-strong)]">&middot;</span>
              <span>{story.date}</span>
            </div>
          </div>
        </div>
      </Link>
    );
  };

  /* ─── Render a compact card ─── */
  const CompactCard = ({ story }: { story: MagazineArticle }) => {
    const vc = getVerticalColor(story.section);
    return (
      <Link to={`/magazine/${story.slug}`} className="block">
        <div className="rounded-xl overflow-hidden border border-[var(--wk-border)] bg-[var(--wk-surface)] flex gap-3 p-3 active:scale-[0.985] transition-transform cursor-pointer">
          <div className="w-[90px] h-[72px] flex-shrink-0 rounded-lg overflow-hidden bg-[var(--wk-surface-raised)]">
            <img src={story.heroUrl} alt="" className="w-full h-full object-cover" loading="lazy" />
          </div>
          <div className="min-w-0 flex flex-col justify-center">
            <span className="text-[8px] font-black uppercase tracking-[0.14em] mb-1 block" style={{ color: vc }}>
              {story.section}
            </span>
            <h3 className="text-[13px] font-black leading-[1.3] tracking-[-0.01em] text-[var(--wk-text)] line-clamp-2">
              {story.title}
            </h3>
            <div className="flex items-center gap-1.5 text-[9px] font-semibold text-[var(--wk-text-muted)] mt-1">
              <span>{story.readingTime} min</span>
              <span className="text-[var(--wk-border-strong)]">&middot;</span>
              <span>{story.date}</span>
            </div>
          </div>
        </div>
      </Link>
    );
  };

  return (
    <main className="wk-mobile-v5 min-h-screen bg-[var(--wk-bg)]">
      {/* ── Back nav bar ── */}
      <div className="sticky top-0 z-40 bg-[var(--wk-bg)]/90 backdrop-blur-md border-b border-[var(--wk-border)] px-4 h-12 flex items-center">
        <Link
          to="/magazine"
          className="inline-flex items-center gap-1.5 text-[11px] font-bold text-[var(--wk-text-muted)] active:text-[var(--wk-brand)] whitespace-nowrap cursor-pointer"
        >
          <WkIcon name="ArrowLeft" size={14} />
          Magazine
        </Link>
      </div>

      {/* ── HERO ── */}
      <div className="px-5 pt-6 pb-5">
        {/* Portrait */}
        <div className="w-[140px] h-[175px] rounded-2xl overflow-hidden bg-[var(--wk-surface-raised)] mb-5 relative">
          <img
            src={authorMeta.avatarUrl}
            alt={authorMeta.displayName}
            className="w-full h-full object-cover"
          />
          <div className="absolute bottom-2.5 right-2.5 w-7 h-7 rounded-lg bg-[var(--wk-brand)] text-[var(--wk-brand-on)] flex items-center justify-center border-2 border-[var(--wk-bg)]">
            <WkIcon name="PenLine" size={11} />
          </div>
        </div>

        {/* Eyebrow */}
        <div className="text-[9px] font-black uppercase tracking-[0.18em] text-[var(--wk-brand)] mb-2 flex items-center gap-2">
          <span className="w-5 h-0.5 bg-[var(--wk-brand)] rounded-full" />
          WAKILISHA Contributor
        </div>

        {/* Name */}
        <h1 className="text-[26px] font-black tracking-[-0.04em] leading-tight text-[var(--wk-text)] mb-1.5">
          {authorMeta.displayName}
        </h1>

        {/* Role + location */}
        <div className="flex items-center gap-2 flex-wrap mb-3">
          <span className="inline-flex items-center gap-1 text-[12px] font-bold text-[var(--wk-brand)]">
            <WkIcon name="Briefcase" size={11} className="opacity-70" />
            {authorMeta.role}
          </span>
          {authorMeta.location && (
            <>
              <span className="text-[var(--wk-text-faint)]">&middot;</span>
              <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-[var(--wk-text-muted)]">
                <i className="ri-map-pin-line text-[12px]" />
                {authorMeta.location}
              </span>
            </>
          )}
        </div>

        {/* Bio */}
        {authorMeta.bio && (
          <p className="text-[13px] leading-relaxed text-[var(--wk-text-soft)] mb-4">
            {authorMeta.bio}
          </p>
        )}

        {/* Areas */}
        {actualAreas.length > 0 && (
          <div className="flex items-center gap-2 mb-4 flex-wrap">
            <span className="text-[9px] font-bold uppercase tracking-[0.10em] text-[var(--wk-text-faint)]">
              Focus
            </span>
            {actualAreas.map((area) => (
              <span
                key={area}
                className="inline-flex items-center h-[24px] px-2.5 rounded-full text-[10px] font-bold border"
                style={{
                  color: `color-mix(in oklch, ${getVerticalColor(area)}, white 15%)`,
                  background: `color-mix(in oklch, ${getVerticalColor(area)}, transparent 85%)`,
                  borderColor: `color-mix(in oklch, ${getVerticalColor(area)}, transparent 70%)`,
                }}
              >
                {area}
              </span>
            ))}
          </div>
        )}

        {/* Social links */}
        {authorMeta.socialLinks.length > 0 && (
          <div className="flex items-center gap-2 mb-4">
            {authorMeta.socialLinks.map((link) => (
              <a
                key={link.label}
                href={link.url}
                className="w-[30px] h-[30px] rounded-lg flex items-center justify-center text-[var(--wk-text-muted)] bg-[var(--wk-surface)] border border-[var(--wk-border)] active:text-[var(--wk-brand)] active:border-[var(--wk-brand)] transition-colors cursor-pointer"
                target="_blank"
                rel="noopener noreferrer"
                aria-label={link.label}
              >
                <i className={`${link.icon} text-[15px]`} />
              </a>
            ))}
          </div>
        )}

        {/* Stats */}
        <div className="flex gap-6 py-4 border-t border-[var(--wk-border)]">
          <div>
            <div className="text-[20px] font-black tracking-[-0.03em] text-[var(--wk-text)] leading-tight">{articles.length}</div>
            <div className="text-[9px] font-bold uppercase tracking-[0.12em] text-[var(--wk-text-faint)] mt-0.5">Articles</div>
          </div>
          <div>
            <div className="text-[20px] font-black tracking-[-0.03em] text-[var(--wk-text)] leading-tight">{sections.length}</div>
            <div className="text-[9px] font-bold uppercase tracking-[0.12em] text-[var(--wk-text-faint)] mt-0.5">Verticals</div>
          </div>
          <div>
            <div className="text-[20px] font-black tracking-[-0.03em] text-[var(--wk-text)] leading-tight">
              {stats ? stats.totalMin : 0}
            </div>
            <div className="text-[9px] font-bold uppercase tracking-[0.12em] text-[var(--wk-text-faint)] mt-0.5">Min read</div>
          </div>
        </div>
      </div>

      {/* ── CONTENT ── */}
      {loading ? (
        <div className="px-5 space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="rounded-xl border border-[var(--wk-border)] bg-[var(--wk-surface)] p-4 animate-pulse">
              <div className="h-3 w-16 rounded bg-[var(--wk-surface-raised)] mb-3" />
              <div className="h-4 w-3/4 rounded bg-[var(--wk-surface-raised)] mb-2" />
              <div className="h-3 w-1/2 rounded bg-[var(--wk-surface-raised)]" />
            </div>
          ))}
        </div>
      ) : error ? (
        <div className="px-5 py-8 text-center">
          <WkIcon name="AlertCircle" size={24} className="mx-auto mb-2 text-[var(--wk-danger)]" />
          <p className="text-sm text-[var(--wk-text-muted)]">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="mt-3 inline-flex items-center gap-2 rounded-lg bg-[var(--wk-surface-raised)] px-4 py-2 text-xs font-bold text-[var(--wk-text)] cursor-pointer"
          >
            <WkIcon name="RotateCw" size={12} /> Retry
          </button>
        </div>
      ) : articles.length === 0 ? (
        <div className="px-5 py-10 text-center">
          <WkIcon name="FileX" size={28} className="mx-auto mb-2 text-[var(--wk-text-faint)]" />
          <p className="text-sm text-[var(--wk-text-muted)]">No published articles yet.</p>
          <p className="text-[11px] text-[var(--wk-text-faint)] mt-1">Check back soon for {firstName}'s first piece.</p>
          <Link
            to="/magazine"
            className="mt-3 inline-flex items-center gap-2 rounded-lg bg-[var(--wk-brand)] px-4 py-2 text-xs font-bold text-[var(--wk-brand-on)]"
          >
            <WkIcon name="BookOpen" size={12} /> Browse magazine
          </Link>
        </div>
      ) : (
        <>
          {/* ====== FEATURED ====== */}
          {hasFeatured && featuredArticles.length > 0 && (
            <div className="px-5 mb-5">
              <Link to={`/magazine/${featuredArticles[0].slug}`} className="block rounded-2xl overflow-hidden relative mb-3 cursor-pointer">
                <div className="aspect-[16/10] overflow-hidden bg-[var(--wk-surface-raised)]">
                  <img src={featuredArticles[0].heroUrl} alt="" className="w-full h-full object-cover" loading="lazy" />
                </div>
                <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/25 to-transparent flex flex-col justify-end p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="w-5 h-0.5 bg-[var(--wk-brand)] rounded-full" />
                    <span className="text-[9px] font-black uppercase tracking-[0.16em] text-white/85">Featured</span>
                  </div>
                  <h2 className="text-[17px] font-black leading-tight tracking-[-0.02em] text-white mb-1.5 line-clamp-2">
                    {featuredArticles[0].title}
                  </h2>
                  {featuredArticles[0].dek && (
                    <p className="text-[11px] leading-relaxed text-white/75 line-clamp-2 mb-2">
                      {featuredArticles[0].dek}
                    </p>
                  )}
                  <div className="flex items-center gap-2 text-[10px] font-semibold text-white/65">
                    <span style={{ color: getVerticalColor(featuredArticles[0].section) }}>{featuredArticles[0].section}</span>
                    <span>&middot;</span>
                    <span>{featuredArticles[0].readingTime} min</span>
                    <span>&middot;</span>
                    <span>{featuredArticles[0].date}</span>
                  </div>
                </div>
              </Link>

              {/* Carousel */}
              {carouselItems.length > 0 && (
                <div className="mb-4">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-[9px] font-black uppercase tracking-[0.12em] text-[var(--wk-text-faint)]">
                      More from {firstName}
                    </span>
                    <span className="flex-1 h-px bg-[var(--wk-divider)]" />
                  </div>
                  <div className="overflow-hidden rounded-xl">
                    <div className="flex gap-2 animate-scroll-mobile" style={{
                      animation: 'authorMagCarouselScrollMobile 30s linear infinite',
                      width: 'max-content',
                    }}>
                      {carouselItems.map((story, i) => (
                        <Link
                          key={`mcarousel-${story.slug}-${i}`}
                          to={`/magazine/${story.slug}`}
                          className="flex-shrink-0 w-[200px] rounded-xl overflow-hidden border border-[var(--wk-border)] bg-[var(--wk-surface)] cursor-pointer"
                        >
                          <div className="h-[110px] overflow-hidden bg-[var(--wk-surface-raised)]">
                            <img src={story.heroUrl} alt="" className="w-full h-full object-cover" loading="lazy" />
                          </div>
                          <div className="p-3">
                            <span className="text-[8px] font-black uppercase tracking-[0.12em] mb-1 block" style={{ color: getVerticalColor(story.section) }}>
                              {story.section}
                            </span>
                            <h3 className="text-[11px] font-black leading-snug text-[var(--wk-text)] line-clamp-2 mb-1">
                              {story.title}
                            </h3>
                            <div className="flex items-center gap-1.5 text-[9px] font-semibold text-[var(--wk-text-muted)]">
                              <span>{story.readingTime} min</span>
                              <span>&middot;</span>
                              <span>{story.date}</span>
                            </div>
                          </div>
                        </Link>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* Section divider */}
              <div className="flex items-center gap-3 my-5">
                <span className="flex-1 h-px bg-[var(--wk-divider)]" />
                <span className="text-[9px] font-black uppercase tracking-[0.16em] text-[var(--wk-text-faint)]">Articles</span>
                <span className="flex-1 h-px bg-[var(--wk-divider)]" />
              </div>
            </div>
          )}

          {/* Filter pills */}
          <div className="px-5 mb-3">
            <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
              <button
                className={`flex-shrink-0 h-7 px-3 rounded-full text-[10px] font-bold whitespace-nowrap transition-all ${
                  activeCategory === 'all'
                    ? 'bg-[var(--wk-brand)] text-[var(--wk-brand-on)]'
                    : 'bg-[var(--wk-surface)] text-[var(--wk-text-muted)] border border-[var(--wk-border)]'
                }`}
                onClick={() => setActiveCategory('all')}
              >
                All &middot; {articles.length}
              </button>
              {sections.map((section) => (
                <button
                  key={section}
                  className={`flex-shrink-0 h-7 px-3 rounded-full text-[10px] font-bold whitespace-nowrap transition-all ${
                    activeCategory === section
                      ? 'bg-[var(--wk-brand)] text-[var(--wk-brand-on)]'
                      : 'bg-[var(--wk-surface)] text-[var(--wk-text-muted)] border border-[var(--wk-border)]'
                  }`}
                  onClick={() => setActiveCategory(activeCategory === section ? 'all' : section)}
                >
                  {section} &middot; {sectionCounts[section]}
                </button>
              ))}
            </div>
          </div>

          {/* Sort */}
          <div className="px-5 mb-5">
            <div className="flex gap-0.5 bg-[var(--wk-surface)] border border-[var(--wk-border)] rounded-full p-0.5">
              {SORT_OPTIONS.map((opt) => (
                <button
                  key={opt.mode}
                  className={`flex-1 h-7 rounded-full text-[10px] font-bold flex items-center justify-center gap-1 transition-all ${
                    sortMode === opt.mode
                      ? 'bg-[var(--wk-brand)] text-[var(--wk-brand-on)]'
                      : 'text-[var(--wk-text-muted)]'
                  }`}
                  onClick={() => setSortMode(opt.mode)}
                >
                  <i className={`${opt.icon} text-[10px]`} />
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* ====== GRID ====== */}
          {filteredArticles.length === 0 ? (
            <div className="px-5 py-8 text-center">
              <WkIcon name="SearchX" size={24} className="mx-auto mb-2 text-[var(--wk-text-faint)]" />
              <p className="text-xs font-bold text-[var(--wk-text-muted)]">Nothing in {activeCategory}</p>
              <button
                className="mt-2 text-[11px] font-bold text-[var(--wk-brand)]"
                onClick={() => setActiveCategory('all')}
              >
                Show all articles
              </button>
            </div>
          ) : gridArticles.length === 0 ? (
            <div className="px-5 py-6 text-center">
              <div className="flex items-center gap-3 mb-4">
                <span className="flex-1 h-px bg-[var(--wk-divider)]" />
                <span className="text-[9px] font-black uppercase tracking-[0.14em] text-[var(--wk-text-faint)]">End</span>
                <span className="flex-1 h-px bg-[var(--wk-divider)]" />
              </div>
              <p className="text-[11px] font-semibold text-[var(--wk-text-muted)]">
                All {filteredArticles.length} articles shown above
              </p>
            </div>
          ) : (
            <div className="px-5 flex flex-col gap-3">
              {cleanRows.map((row, ri) => {
                const story = row.articles[0];
                const needsSectionBreak = ri > 0 && ri % SECTION_BREAK_EVERY === 0;

                return (
                  <div key={`m-row-${ri}`}>
                    {needsSectionBreak && (
                      <div className="flex items-center gap-3 my-6">
                        <span className="flex-1 h-px bg-[var(--wk-divider)]" />
                        <span className="text-[8px] font-black uppercase tracking-[0.16em] text-[var(--wk-text-faint)] whitespace-nowrap">
                          More from {firstName}
                        </span>
                        <span className="flex-1 h-px bg-[var(--wk-divider)]" />
                      </div>
                    )}
                    {row.pattern === 'compact' ? (
                      <CompactCard story={story} />
                    ) : (
                      <FullCard story={story} />
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* Infinite scroll sentinel */}
          {gridArticles.length > 0 && (
            <div ref={sentinelRef} className="flex justify-center py-8 px-5">
              {hasMore ? (
                <div className="space-y-3 w-full">
                  <div className="animate-pulse rounded-xl border border-[var(--wk-border)] bg-[var(--wk-surface)] p-4">
                    <div className="h-3 w-16 rounded bg-[var(--wk-surface-raised)] mb-3" />
                    <div className="h-4 w-3/4 rounded bg-[var(--wk-surface-raised)] mb-2" />
                    <div className="h-3 w-1/2 rounded bg-[var(--wk-surface-raised)]" />
                  </div>
                </div>
              ) : visibleCount > BATCH_SIZE ? (
                <div className="flex items-center gap-3 w-full">
                  <span className="flex-1 h-px bg-[var(--wk-divider)]" />
                  <span className="text-[10px] font-semibold text-[var(--wk-text-faint)] whitespace-nowrap">
                    All {gridArticles.length} articles loaded
                  </span>
                  <span className="flex-1 h-px bg-[var(--wk-divider)]" />
                </div>
              ) : null}
            </div>
          )}

          {/* Explore footer */}
          <div className="px-5 mt-8 pt-6 pb-10 border-t border-[var(--wk-border)] text-center">
            <p className="text-[11px] leading-relaxed text-[var(--wk-text-soft)] mb-4 max-w-[280px] mx-auto">
              {firstName} is part of WAKILISHA's cultural memory system.
            </p>
            <div className="flex items-center justify-center gap-2 flex-wrap">
              <Link
                to="/magazine"
                className="inline-flex items-center gap-1.5 h-8 px-4 rounded-full text-[11px] font-bold text-[var(--wk-text-soft)] bg-[var(--wk-surface)] border border-[var(--wk-border)] active:text-[var(--wk-brand)] active:border-[var(--wk-brand)] whitespace-nowrap"
              >
                <WkIcon name="BookOpen" size={12} />
                All stories
              </Link>
              <Link
                to="/artists"
                className="inline-flex items-center gap-1.5 h-8 px-4 rounded-full text-[11px] font-bold text-[var(--wk-text-soft)] bg-[var(--wk-surface)] border border-[var(--wk-border)] active:text-[var(--wk-brand)] active:border-[var(--wk-brand)] whitespace-nowrap"
              >
                <WkIcon name="Users" size={12} />
                Artists
              </Link>
            </div>
          </div>
        </>
      )}

      <div className="h-16" />
    </main>
  );
}