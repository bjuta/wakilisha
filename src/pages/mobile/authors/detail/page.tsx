import { useEffect, useState, useMemo, useRef } from 'react';
import { Link, useParams } from 'react-router-dom';
import { WkIcon } from '@/components/design-system/Icon';
import { getArticlesByAuthor, type MagazineArticle } from '@/services/magazineArticles';
import { getAuthorMeta } from '@/services/authorProfiles';

type SortMode = 'latest' | 'oldest' | 'longest';

const BATCH_SIZE = 6;
const LOAD_MORE = 4;
const FEATURED_COUNT = 5;

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
  const sentinelRef = useRef<HTMLDivElement>(null);

  const normalizedSlug = (slug || '').toLowerCase().replace(/[\s_-]+/g, '-');
  const authorMeta = getAuthorMeta(normalizedSlug);

  useEffect(() => {
    if (!normalizedSlug) {
      setLoading(false);
      setError('No author specified');
      return;
    }

    let alive = true;
    setLoading(true);
    setError(null);

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

  // Featured articles + grid
  const hasFeatured = filteredArticles.length >= 3;
  const featuredArticles = useMemo(
    () => (hasFeatured ? filteredArticles.slice(0, FEATURED_COUNT) : []),
    [filteredArticles, hasFeatured],
  );
  const gridArticles = useMemo(
    () => (hasFeatured ? filteredArticles.slice(FEATURED_COUNT) : filteredArticles),
    [filteredArticles, hasFeatured],
  );

  // Carousel items (duplicated for infinite loop)
  const carouselItems = useMemo(() => {
    if (featuredArticles.length <= 1) return [];
    const items = featuredArticles.slice(1);
    return [...items, ...items];
  }, [featuredArticles]);

  // Group by section for "all" view
  const sectionGroups = useMemo(() => {
    if (activeCategory !== 'all') return null;
    const groups: { section: string; items: MagazineArticle[] }[] = [];
    const seen = new Set<string>();
    for (const a of gridArticles) {
      const sec = a.section || 'Uncategorized';
      if (!seen.has(sec)) {
        seen.add(sec);
        groups.push({ section: sec, items: [] });
      }
    }
    for (const a of gridArticles) {
      const sec = a.section || 'Uncategorized';
      const group = groups.find((g) => g.section === sec);
      if (group) group.items.push(a);
    }
    return groups.filter((g) => g.items.length > 0);
  }, [gridArticles, activeCategory]);

  useEffect(() => { setVisibleCount(BATCH_SIZE); }, [activeCategory, sortMode]);

  // Infinite scroll
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

  // Summary stats
  const summary = useMemo(() => {
    if (articles.length === 0) return null;
    const totalWords = articles.reduce((sum, a) => sum + a.readingTime * 200, 0);
    const topSection = sections[0] || '—';
    const topSectionPct = sections.length > 0
      ? Math.round((sectionCounts[topSection] / articles.length) * 100)
      : 0;
    const dates = articles.map((a) => new Date(a.date)).filter((d) => !Number.isNaN(d.getTime()));
    const firstDate = dates.length > 0 ? dates[dates.length - 1] : null;
    const latestDate = dates.length > 0 ? dates[0] : null;
    const monthsActive = firstDate && latestDate
      ? Math.max(1, Math.ceil((latestDate.getTime() - firstDate.getTime()) / (1000 * 60 * 60 * 24 * 30)))
      : 0;
    return { topSection, topSectionPct, totalWords, monthsActive, firstDate, latestDate };
  }, [articles, sections, sectionCounts]);

  const firstName = authorMeta.displayName.split(' ')[0];

  // Build visible items with interleaved group headers
  const visibleItems = useMemo(() => {
    if (!sectionGroups) {
      return gridArticles.slice(0, visibleCount).map((story, gi) => ({
        type: 'card' as const, story, gi,
      }));
    }
    const items: (
      { type: 'header'; section: string; count: number }
      | { type: 'card'; story: MagazineArticle; gi: number }
    )[] = [];
    let gi = 0;
    for (const group of sectionGroups) {
      if (gi >= visibleCount) break;
      const cards = group.items.slice(0, Math.max(0, visibleCount - gi));
      if (cards.length === 0) continue;
      items.push({ type: 'header', section: group.section, count: group.items.length });
      for (const story of cards) {
        items.push({ type: 'card', story, gi });
        gi++;
      }
    }
    return items;
  }, [sectionGroups, gridArticles, visibleCount]);

  const renderMobileCard = (story: MagazineArticle, gi: number) => {
    const patternIdx = gi % 7;

    // Hero card (pos 0)
    if (patternIdx === 0) {
      return (
        <Link key={`${story.slug}-${gi}`} to={`/magazine/${story.slug}`} className="block mobile-pressable">
          <div className="rounded-2xl overflow-hidden border border-[var(--wk-divider)] bg-[var(--wk-surface)]">
            <div className="aspect-[16/9] overflow-hidden bg-[var(--wk-surface-raised)]">
              <img src={story.heroUrl} alt="" className="w-full h-full object-cover" loading="lazy" />
            </div>
            <div className="p-4">
              <div className="text-[9px] font-black uppercase tracking-[0.14em] text-[var(--wk-brand)] mb-2">
                {story.section}
              </div>
              <h3 className="text-[17px] font-black leading-tight tracking-[-0.02em] text-[var(--wk-text)] mb-2">
                {story.title}
              </h3>
              {story.dek && (
                <p className="text-xs leading-relaxed text-[var(--wk-text-soft)] line-clamp-2 mb-2">
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
    }

    // Compact horizontal (pos 3, 5)
    if (patternIdx === 3 || patternIdx === 5) {
      return (
        <Link key={`${story.slug}-${gi}`} to={`/magazine/${story.slug}`} className="block mobile-pressable">
          <div className="rounded-xl overflow-hidden border border-[var(--wk-divider)] bg-[var(--wk-surface)] flex gap-3 p-3">
            <div className="w-24 h-20 flex-shrink-0 rounded-lg overflow-hidden bg-[var(--wk-surface-raised)]">
              <img src={story.heroUrl} alt="" className="w-full h-full object-cover" loading="lazy" />
            </div>
            <div className="min-w-0 flex flex-col justify-center">
              <div className="text-[8px] font-black uppercase tracking-[0.12em] text-[var(--wk-brand)] mb-1">
                {story.section}
              </div>
              <h3 className="text-[13px] font-black leading-snug tracking-[-0.01em] text-[var(--wk-text)] line-clamp-2">
                {story.title}
              </h3>
              {story.dek && (
                <p className="text-[10px] leading-snug text-[var(--wk-text-soft)] line-clamp-1 mt-0.5">
                  {story.dek}
                </p>
              )}
              <div className="flex items-center gap-1.5 text-[9px] font-semibold text-[var(--wk-text-muted)] mt-1">
                <span>{story.readingTime} min</span>
                <span className="text-[var(--wk-border-strong)]">&middot;</span>
                <span>{story.date}</span>
              </div>
            </div>
          </div>
        </Link>
      );
    }

    // Standard card (pos 1, 2, 4, 6)
    return (
      <Link key={`${story.slug}-${gi}`} to={`/magazine/${story.slug}`} className="profile74-read-card mobile-pressable">
        <div className="profile74-read-art">
          <img src={story.heroUrl} alt="" loading="lazy" />
        </div>
        <div>
          <div className="profile74-read-tag">{story.section}</div>
          <div className="profile74-read-title">{story.title}</div>
          {story.dek && (
            <p className="text-[11px] leading-snug text-[var(--wk-text-soft)] line-clamp-2 mt-1 mb-0.5">
              {story.dek}
            </p>
          )}
          <div className="profile74-read-meta">
            {story.readingTime} min read &middot; {story.date}
          </div>
        </div>
      </Link>
    );
  };

  return (
    <main className="wk-mobile-v5 min-h-screen bg-[var(--wk-bg)]">
      {/* ── Full-bleed cover hero ── */}
      <section className="relative overflow-hidden" style={{ height: "42dvh", minHeight: "260px" }}>
        <img
          src={authorMeta.coverUrl}
          alt=""
          className="absolute inset-0 w-full h-full object-cover object-top"
        />
        {/* gradient fades to page background — same float card trick as article pages */}
        <div
          className="absolute inset-0"
          style={{ background: "linear-gradient(to bottom, rgba(0,0,0,0.14) 0%, rgba(0,0,0,0.2) 55%, var(--wk-bg) 100%)" }}
        />
        {/* Back nav */}
        <div className="absolute top-0 left-0 right-0 z-20 px-4 pt-safe-top py-4 flex items-center justify-between">
          <Link
            to="/magazine"
            className="inline-flex items-center gap-1.5 rounded-full border border-white/20 bg-black/25 backdrop-blur-sm px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-white/85 whitespace-nowrap"
          >
            <WkIcon name="ArrowLeft" size={13} />
            Magazine
          </Link>
        </div>
      </section>

      {/* ── Floating profile card ── */}
      <div
        className="relative z-10 rounded-t-[24px] bg-[var(--wk-bg)]"
        style={{ marginTop: "-52px", boxShadow: "0 -6px 32px -8px rgba(0,0,0,0.12)" }}
      >
        {/* Avatar peeks above the card boundary */}
        <div className="absolute -top-10 left-5">
          <div className="relative">
            <div className="w-20 h-20 rounded-full overflow-hidden border-[3px] border-[var(--wk-bg)] bg-[var(--wk-brand)] shadow-md">
              <img
                src={authorMeta.avatarUrl}
                alt={authorMeta.displayName}
                className="w-full h-full object-cover"
              />
            </div>
            <div className="absolute -bottom-0.5 -right-0.5 w-6 h-6 rounded-full bg-[var(--wk-brand)] border-2 border-[var(--wk-bg)] flex items-center justify-center text-[var(--wk-brand-on)]">
              <WkIcon name="PenLine" size={10} />
            </div>
          </div>
        </div>

        {/* Profile content — top padding clears avatar */}
        <div className="px-5 pt-14 pb-5 border-b border-[var(--wk-border)]">
          <h1 className="text-[24px] font-black tracking-[-0.04em] leading-tight text-[var(--wk-text)]">
            {authorMeta.displayName}
          </h1>
          <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
            <span className="text-[11px] font-semibold text-[var(--wk-text-muted)]">WAKILISHA Contributor</span>
            <span className="text-[var(--wk-text-faint)]">&middot;</span>
            <span className="inline-flex items-center gap-1 text-[11px] font-bold text-[var(--wk-brand)]">
              <WkIcon name="PenLine" size={11} />{authorMeta.role}
            </span>
          </div>
          {authorMeta.bio && (
            <p className="mt-2.5 text-[13px] leading-relaxed text-[var(--wk-text-soft)] line-clamp-3">
              {authorMeta.bio}
            </p>
          )}

          {/* Stats row */}
          <div className="flex gap-6 mt-4 pt-4 border-t border-[var(--wk-border)]">
            <div>
              <div className="text-[20px] font-black tracking-[-0.04em] text-[var(--wk-text)] leading-tight">{articles.length}</div>
              <div className="text-[9px] font-bold uppercase tracking-[0.14em] text-[var(--wk-text-faint)] mt-0.5">Articles</div>
            </div>
            <div>
              <div className="text-[20px] font-black tracking-[-0.04em] text-[var(--wk-text)] leading-tight">{sections.length}</div>
              <div className="text-[9px] font-bold uppercase tracking-[0.14em] text-[var(--wk-text-faint)] mt-0.5">Sections</div>
            </div>
            <div>
              <div className="text-[20px] font-black tracking-[-0.04em] text-[var(--wk-text)] leading-tight">
                {articles.reduce((s, a) => s + a.readingTime, 0)}
              </div>
              <div className="text-[9px] font-bold uppercase tracking-[0.14em] text-[var(--wk-text-faint)] mt-0.5">Min read</div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2.5 mt-4">
            <Link
              to="/magazine"
              className="inline-flex items-center gap-1.5 rounded-full border border-[var(--wk-border)] bg-[var(--wk-surface)] px-4 py-2 text-[12px] font-bold text-[var(--wk-text-soft)] whitespace-nowrap active:scale-[0.97] transition-transform"
            >
              <WkIcon name="BookOpen" size={13} /> All stories
            </Link>
          </div>
        </div>

      {loading ? (
        <div className="profile74-reads-list">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="profile74-read-card animate-pulse">
              <div className="profile74-read-art bg-[var(--wk-surface-raised)]" />
              <div className="space-y-2">
                <div className="h-3 w-16 rounded bg-[var(--wk-surface-raised)]" />
                <div className="h-4 w-3/4 rounded bg-[var(--wk-surface-raised)]" />
                <div className="h-3 w-1/2 rounded bg-[var(--wk-surface-raised)]" />
              </div>
            </div>
          ))}
        </div>
      ) : error ? (
        <div className="px-5 py-8 text-center">
          <WkIcon name="AlertCircle" size={24} className="mx-auto mb-2 text-[var(--wk-danger)]" />
          <p className="text-sm text-[var(--wk-text-muted)]">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="mt-3 inline-flex items-center gap-2 rounded-lg bg-[var(--wk-surface-raised)] px-4 py-2 text-xs font-bold text-[var(--wk-text)]"
          >
            <WkIcon name="RotateCw" size={12} /> Retry
          </button>
        </div>
      ) : articles.length === 0 ? (
        <div className="px-5 py-10 text-center">
          <WkIcon name="FileX" size={28} className="mx-auto mb-2 text-[var(--wk-text-faint)]" />
          <p className="text-sm text-[var(--wk-text-muted)]">No published articles yet.</p>
          <Link
            to="/magazine"
            className="mt-3 inline-flex items-center gap-2 rounded-lg bg-[var(--wk-brand)] px-4 py-2 text-xs font-bold text-[var(--wk-brand-on)]"
          >
            <WkIcon name="BookOpen" size={12} /> Browse magazine
          </Link>
        </div>
      ) : (
        <>
          {/* ====== FEATURED HERO (mobile) ====== */}
          {hasFeatured && featuredArticles.length > 0 && (
            <div className="px-5 mt-2">
              <Link to={`/magazine/${featuredArticles[0].slug}`} className="block rounded-2xl overflow-hidden relative mb-3">
                <div className="aspect-[16/9] overflow-hidden bg-[var(--wk-surface-raised)]">
                  <img src={featuredArticles[0].heroUrl} alt="" className="w-full h-full object-cover" loading="lazy" />
                </div>
                <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/20 to-transparent flex flex-col justify-end p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="w-5 h-0.5 bg-[var(--wk-brand)] rounded-full" />
                    <span className="text-[9px] font-black uppercase tracking-[0.16em] text-white/85">Featured</span>
                  </div>
                  <h2 className="text-lg font-black leading-tight tracking-[-0.02em] text-white mb-1.5 line-clamp-2">
                    {featuredArticles[0].title}
                  </h2>
                  {featuredArticles[0].dek && (
                    <p className="text-xs leading-relaxed text-white/75 line-clamp-2 mb-2">
                      {featuredArticles[0].dek}
                    </p>
                  )}
                  <div className="flex items-center gap-2 text-[10px] font-semibold text-white/65">
                    <span>{featuredArticles[0].section}</span>
                    <span>&middot;</span>
                    <span>{featuredArticles[0].readingTime} min</span>
                    <span>&middot;</span>
                    <span>{featuredArticles[0].date}</span>
                  </div>
                </div>
              </Link>

              {/* Mobile carousel */}
              {carouselItems.length > 0 && (
                <div className="mb-3">
                  <div className="flex items-center gap-2 mb-2 px-1">
                    <span className="text-[9px] font-black uppercase tracking-[0.14em] text-[var(--wk-text-faint)]">
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
                          className="flex-shrink-0 w-[220px] rounded-xl overflow-hidden border border-[var(--wk-divider)] bg-[var(--wk-surface)]"
                        >
                          <div className="h-[120px] overflow-hidden bg-[var(--wk-surface-raised)]">
                            <img src={story.heroUrl} alt="" className="w-full h-full object-cover" loading="lazy" />
                          </div>
                          <div className="p-3">
                            <div className="text-[8px] font-black uppercase tracking-[0.14em] text-[var(--wk-brand)] mb-1">
                              {story.section}
                            </div>
                            <h3 className="text-[12px] font-black leading-snug text-[var(--wk-text)] line-clamp-2 mb-1">
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

              {/* Divider */}
              <div className="flex items-center gap-2 mb-3">
                <span className="flex-1 h-px bg-[var(--wk-divider)]" />
                <span className="text-[9px] font-black uppercase tracking-[0.14em] text-[var(--wk-text-faint)]">All Stories</span>
                <span className="flex-1 h-px bg-[var(--wk-divider)]" />
              </div>
            </div>
          )}

          {/* Summary strip */}
          {summary && (
            <div className="px-5 mt-2">
              <div className="grid grid-cols-2 gap-2">
                <div className="rounded-xl border border-[var(--wk-divider)] bg-[var(--wk-surface)] p-3">
                  <div className="text-[9px] font-black uppercase tracking-[0.12em] text-[var(--wk-text-faint)] mb-0.5">
                    Top section
                  </div>
                  <div className="text-sm font-black text-[var(--wk-text)]">{summary.topSection}</div>
                  <div className="text-[10px] font-semibold text-[var(--wk-text-muted)]">{summary.topSectionPct}% of work</div>
                </div>
                <div className="rounded-xl border border-[var(--wk-divider)] bg-[var(--wk-surface)] p-3">
                  <div className="text-[9px] font-black uppercase tracking-[0.12em] text-[var(--wk-text-faint)] mb-0.5">
                    Total words
                  </div>
                  <div className="text-sm font-black text-[var(--wk-text)]">
                    {summary.totalWords >= 1000 ? `${Math.round(summary.totalWords / 1000)}K` : summary.totalWords.toLocaleString()}
                  </div>
                  <div className="text-[10px] font-semibold text-[var(--wk-text-muted)]">~{summary.monthsActive}mo writing</div>
                </div>
              </div>
            </div>
          )}

          {/* Section heading (when no featured) */}
          {!hasFeatured && (
            <div className="profile74-section-head">
              <div className="profile74-section-kicker">Articles</div>
              <h2 className="profile74-section-title">Stories by {firstName}</h2>
            </div>
          )}

          {/* Category filter pills — horizontal scroll */}
          <div className="px-5 mt-3 mb-2">
            <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
              <button
                className={`flex-shrink-0 h-8 px-3 rounded-full text-[11px] font-bold whitespace-nowrap transition-all ${
                  activeCategory === 'all'
                    ? 'bg-[var(--wk-brand)] text-[var(--wk-brand-on)]'
                    : 'bg-[var(--wk-surface)] text-[var(--wk-text-muted)] border border-[var(--wk-divider)]'
                }`}
                onClick={() => setActiveCategory('all')}
              >
                All &middot; {articles.length}
              </button>
              {sections.map((section) => (
                <button
                  key={section}
                  className={`flex-shrink-0 h-8 px-3 rounded-full text-[11px] font-bold whitespace-nowrap transition-all ${
                    activeCategory === section
                      ? 'bg-[var(--wk-brand)] text-[var(--wk-brand-on)]'
                      : 'bg-[var(--wk-surface)] text-[var(--wk-text-muted)] border border-[var(--wk-divider)]'
                  }`}
                  onClick={() => setActiveCategory(activeCategory === section ? 'all' : section)}
                >
                  {section} &middot; {sectionCounts[section]}
                </button>
              ))}
            </div>
          </div>

          {/* Sort as inline segmented control */}
          <div className="px-5 mb-4">
            <div className="flex gap-0.5 bg-[var(--wk-surface)] border border-[var(--wk-divider)] rounded-full p-0.5">
              {SORT_OPTIONS.map((opt) => (
                <button
                  key={opt.mode}
                  className={`flex-1 h-7 rounded-full text-[10px] font-bold flex items-center justify-center gap-1 transition-all ${
                    sortMode === opt.mode
                      ? 'bg-[var(--wk-brand)] text-[var(--wk-brand-on)] shadow-sm'
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

          {/* Articles grid */}
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
              <p className="text-[11px] font-semibold text-[var(--wk-text-muted)]">
                All {filteredArticles.length} articles shown above
              </p>
            </div>
          ) : (
            <div className="px-5 space-y-3">
              {visibleItems.map((item, idx) => {
                if (item.type === 'header') {
                  return (
                    <div key={`hdr-${item.section}`} className="flex items-center gap-3 pt-3 pb-1">
                      <span className="text-sm font-black text-[var(--wk-text)]">{item.section}</span>
                      <span className="text-[10px] font-semibold text-[var(--wk-text-muted)]">{item.count} article{item.count !== 1 ? 's' : ''}</span>
                    </div>
                  );
                }
                return renderMobileCard(item.story, item.gi);
              })}
            </div>
          )}

          {/* Infinite scroll sentinel */}
          {gridArticles.length > 0 && (
            <div ref={sentinelRef} className="flex justify-center py-8 px-5">
              {hasMore ? (
                <div className="flex items-center gap-3">
                  <div className="w-5 h-5 border-2 border-[var(--wk-border)] border-t-[var(--wk-brand)] rounded-full animate-spin" />
                  <span className="text-xs font-semibold text-[var(--wk-text-muted)]">Loading more&hellip;</span>
                </div>
              ) : visibleCount > BATCH_SIZE ? (
                <span className="text-[10px] font-semibold text-[var(--wk-text-faint)]">
                  All {gridArticles.length} articles loaded
                </span>
              ) : null}
            </div>
          )}
        </>
      )}

      <div className="h-16" />
      </div> {/* closes float card */}
    </main>
  );
}