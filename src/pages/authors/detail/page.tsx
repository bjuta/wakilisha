import { useEffect, useState, useMemo, useRef, useCallback } from 'react';
import { Link, useParams } from 'react-router-dom';
import { WkIcon } from '@/components/design-system/Icon';
import { getArticlesByAuthor, type MagazineArticle } from '@/services/magazineArticles';
import { getAuthorMeta } from '@/services/authorProfiles';

type SortMode = 'latest' | 'oldest' | 'longest';

const BATCH_SIZE = 8;
const LOAD_MORE = 6;
const FEATURED_COUNT = 5;

const SORT_OPTIONS: { mode: SortMode; label: string; icon: string }[] = [
  { mode: 'latest', label: 'Latest first', icon: 'ri-arrow-down-line' },
  { mode: 'oldest', label: 'Oldest first', icon: 'ri-arrow-up-line' },
  { mode: 'longest', label: 'Longest reads', icon: 'ri-time-line' },
];

export default function AuthorProfilePage() {
  const { slug } = useParams<{ slug: string }>();
  const [articles, setArticles] = useState<MagazineArticle[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeCategory, setActiveCategory] = useState<string>('all');
  const [sortMode, setSortMode] = useState<SortMode>('latest');
  const [visibleCount, setVisibleCount] = useState(BATCH_SIZE);
  const [sortOpen, setSortOpen] = useState(false);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const sortWrapRef = useRef<HTMLDivElement>(null);

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

  // Close sort dropdown on outside click
  useEffect(() => {
    if (!sortOpen) return;
    const handler = (e: MouseEvent) => {
      if (sortWrapRef.current && !sortWrapRef.current.contains(e.target as Node)) {
        setSortOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [sortOpen]);

  // Compute sections & counts
  const { sections, sectionCounts } = useMemo(() => {
    const map: Record<string, number> = {};
    for (const a of articles) {
      const sec = a.section || 'Uncategorized';
      map[sec] = (map[sec] || 0) + 1;
    }
    const sorted = Object.entries(map).sort((a, b) => b[1] - a[1]);
    return { sections: sorted.map(([name]) => name), sectionCounts: map };
  }, [articles]);

  // Filter & sort
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

  // Featured articles (first FEATURED_COUNT) + rest
  const hasFeatured = filteredArticles.length >= 3;
  const featuredArticles = useMemo(
    () => (hasFeatured ? filteredArticles.slice(0, FEATURED_COUNT) : []),
    [filteredArticles, hasFeatured],
  );
  const gridArticles = useMemo(
    () => (hasFeatured ? filteredArticles.slice(FEATURED_COUNT) : filteredArticles),
    [filteredArticles, hasFeatured],
  );

  // Group grid articles by section only when showing "all"
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

  // Reset visible count
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


  const firstName = authorMeta.displayName.split(' ')[0];

  // Build carousel items (duplicated for infinite scroll illusion)
  const carouselItems = useMemo(() => {
    if (featuredArticles.length <= 1) return [];
    const items = featuredArticles.slice(1); // skip first (used as hero)
    // Duplicate for seamless loop
    return [...items, ...items];
  }, [featuredArticles]);

  // --- Render a card for the grid (positions start after featured) ---
  const renderGridCard = useCallback((story: MagazineArticle, globalIndex: number) => {
    const patternIdx = globalIndex % 10;

    // Portrait card (pos 3, 8) — taller, image-heavy
    if (patternIdx === 3 || patternIdx === 8) {
      return (
        <Link key={`${story.slug}-${globalIndex}`} to={`/magazine/${story.slug}`} className="author-mag-card-portrait">
          <div className="author-mag-card-portrait-image">
            <img src={story.heroUrl} alt="" loading="lazy" className="w-full h-full object-cover" />
          </div>
          <div className="author-mag-card-portrait-body">
            <span className="author-mag-card-section">{story.section}</span>
            <h3 className="author-mag-card-portrait-title">{story.title}</h3>
            {story.dek && (
              <p className="author-mag-card-portrait-dek">{story.dek}</p>
            )}
            <div className="author-mag-card-meta mt-3">
              <span>{story.readingTime} min</span>
              <span className="author-mag-card-meta-sep">&middot;</span>
              <span>{story.date}</span>
            </div>
          </div>
        </Link>
      );
    }

    // Feature card (pos 0, 5) — full-width
    if (patternIdx === 0 || patternIdx === 5) {
      return (
        <Link key={`${story.slug}-${globalIndex}`} to={`/magazine/${story.slug}`} className="author-mag-card-feature">
          <div className="author-mag-card-feature-image">
            <img src={story.heroUrl} alt="" loading="lazy" className="w-full h-full object-cover" />
          </div>
          <div className="author-mag-card-feature-body">
            <span className="author-mag-card-section">{story.section}</span>
            <h3 className="author-mag-card-feature-title">{story.title}</h3>
            {story.dek && (
              <p className="author-mag-card-feature-dek">{story.dek}</p>
            )}
            <div className="author-mag-card-meta">
              <span>{story.readingTime} min read</span>
              <span className="author-mag-card-meta-sep">&middot;</span>
              <span>{story.date}</span>
            </div>
          </div>
        </Link>
      );
    }

    // Wide horizontal (pos 7)
    if (patternIdx === 7) {
      return (
        <Link key={`${story.slug}-${globalIndex}`} to={`/magazine/${story.slug}`} className="author-mag-card-wide">
          <div className="author-mag-card-wide-image">
            <img src={story.heroUrl} alt="" loading="lazy" className="w-full h-full object-cover" />
          </div>
          <div className="author-mag-card-wide-body">
            <span className="author-mag-card-section">{story.section}</span>
            <h3 className="author-mag-card-wide-title">{story.title}</h3>
            {story.dek && (
              <p className="author-mag-card-wide-dek">{story.dek}</p>
            )}
            <div className="author-mag-card-meta mt-2">
              <span>{story.readingTime} min</span>
              <span className="author-mag-card-meta-sep">&middot;</span>
              <span>{story.date}</span>
            </div>
          </div>
        </Link>
      );
    }

    // Medium cards (pos 1, 2, 4, 6, 9)
    return (
      <Link key={`${story.slug}-${globalIndex}`} to={`/magazine/${story.slug}`} className="author-mag-card-medium">
        <div className="author-mag-card-medium-image">
          <img src={story.heroUrl} alt="" loading="lazy" />
        </div>
        <div className="author-mag-card-medium-body">
          <span className="author-mag-card-section">{story.section}</span>
          <h3 className="author-mag-card-medium-title">{story.title}</h3>
          {story.dek && (
            <p className="author-mag-card-medium-dek">{story.dek}</p>
          )}
          <div className="author-mag-card-meta mt-2">
            <span>{story.readingTime} min</span>
            <span className="author-mag-card-meta-sep">&middot;</span>
            <span>{story.date}</span>
          </div>
        </div>
      </Link>
    );
  }, []);

  return (
    <main className="min-h-screen bg-[var(--wk-bg)]">
      {/* ── Full-bleed cover hero ── */}
      <section className="relative overflow-hidden" style={{ height: "48vh", minHeight: "300px" }}>
        <img
          src={authorMeta.coverUrl}
          alt=""
          className="absolute inset-0 w-full h-full object-cover object-top"
        />
        {/* gradient fades to page background at bottom — same trick as article page */}
        <div
          className="absolute inset-0"
          style={{ background: "linear-gradient(to bottom, rgba(0,0,0,0.12) 0%, rgba(0,0,0,0.18) 50%, var(--wk-bg) 100%)" }}
        />
        {/* Back nav */}
        <div className="absolute top-5 left-6 right-6 z-20 flex items-center justify-between">
          <Link
            to="/magazine"
            className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-black/25 backdrop-blur-sm px-4 py-2 text-[11px] font-bold uppercase tracking-wider text-white/85 hover:bg-black/45 transition-all whitespace-nowrap"
          >
            <WkIcon name="ArrowLeft" size={13} />
            Magazine
          </Link>
        </div>
      </section>

      {/* ── Floating profile card (same pattern as article page) ── */}
      <div
        className="relative z-10 rounded-t-[28px] bg-[var(--wk-bg)]"
        style={{ marginTop: "-64px", boxShadow: "0 -8px 48px -12px rgba(0,0,0,0.12)" }}
      >
        {/* Avatar peeks above the card boundary */}
        <div className="absolute -top-12 left-8 xl:left-12">
          <div className="relative">
            <div className="w-24 h-24 rounded-full overflow-hidden border-4 border-[var(--wk-bg)] bg-[var(--wk-brand)] shadow-md">
              <img
                src={authorMeta.avatarUrl}
                alt={authorMeta.displayName}
                className="w-full h-full object-cover"
              />
            </div>
            <div className="absolute -bottom-1 -right-1 w-7 h-7 rounded-full bg-[var(--wk-brand)] border-2 border-[var(--wk-bg)] flex items-center justify-center text-[var(--wk-brand-on)]">
              <WkIcon name="PenLine" size={11} />
            </div>
          </div>
        </div>

        <div className="max-w-[1280px] mx-auto px-6 xl:px-8">
          {/* Name / bio / actions row */}
          <div className="flex items-start justify-between gap-6 pt-16 pb-7 border-b border-[var(--wk-border)] flex-wrap">
            <div className="min-w-0">
              <h1 className="text-[28px] lg:text-[38px] font-black tracking-[-0.045em] text-[var(--wk-text)] leading-tight">
                {authorMeta.displayName}
              </h1>
              <div className="flex items-center gap-2 mt-2 flex-wrap">
                <span className="text-[12px] font-semibold text-[var(--wk-text-muted)]">WAKILISHA Contributor</span>
                <span className="text-[var(--wk-text-faint)]">&middot;</span>
                <span className="inline-flex items-center gap-1.5 text-[12px] font-bold text-[var(--wk-brand)]">
                  <WkIcon name="PenLine" size={12} />{authorMeta.role}
                </span>
              </div>
              {authorMeta.bio && (
                <p className="mt-3 text-[14px] leading-relaxed text-[var(--wk-text-soft)] max-w-[58ch]">
                  {authorMeta.bio}
                </p>
              )}
            </div>
            <div className="flex items-center gap-3 shrink-0 pt-1">
              <Link
                to="/magazine"
                className="inline-flex items-center gap-2 rounded-full border border-[var(--wk-border)] bg-[var(--wk-surface)] px-5 py-2.5 text-[13px] font-bold text-[var(--wk-text-soft)] hover:border-[var(--wk-brand)] hover:text-[var(--wk-brand)] transition-all whitespace-nowrap"
              >
                <WkIcon name="BookOpen" size={14} /> All stories
              </Link>
            </div>
          </div>

          {/* Stats strip */}
          <div className="flex gap-10 py-5 border-b border-[var(--wk-border)] flex-wrap">
            <div>
              <div className="text-[28px] font-black tracking-[-0.05em] leading-tight text-[var(--wk-text)]">{articles.length}</div>
              <div className="text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--wk-text-faint)] mt-0.5">Articles</div>
            </div>
            <div>
              <div className="text-[28px] font-black tracking-[-0.05em] leading-tight text-[var(--wk-text)]">{sections.length}</div>
              <div className="text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--wk-text-faint)] mt-0.5">Sections</div>
            </div>
            <div>
              <div className="text-[28px] font-black tracking-[-0.05em] leading-tight text-[var(--wk-text)]">
                {articles.reduce((sum, a) => sum + a.readingTime, 0)}
              </div>
              <div className="text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--wk-text-faint)] mt-0.5">Min read</div>
            </div>
            <div>
              <div className="text-[16px] font-black tracking-[-0.02em] leading-tight text-[var(--wk-text)] pt-1.5">
                {articles.length > 0 ? articles[0].date : '—'}
              </div>
              <div className="text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--wk-text-faint)] mt-0.5">Latest</div>
            </div>
          </div>
        </div>

        {/* Loading */}
        {loading && (
          <div className="mt-8 space-y-5">
            <div className="grid grid-cols-4 gap-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="author-mag-summary-item animate-pulse">
                  <div className="h-9 w-9 rounded-[10px] bg-[var(--wk-surface-raised)]" />
                  <div className="h-3 w-20 rounded bg-[var(--wk-surface-raised)] mt-1" />
                  <div className="h-6 w-16 rounded bg-[var(--wk-surface-raised)]" />
                </div>
              ))}
            </div>
            <div className="h-[420px] rounded-2xl bg-[var(--wk-surface)] animate-pulse" />
            <div className="author-mag-grid">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className={`${i === 0 ? 'col-span-3' : ''} rounded-2xl border border-[var(--wk-border)] bg-[var(--wk-surface)] animate-pulse`}>
                  <div className={`${i === 0 ? 'aspect-[2/1]' : 'aspect-[16/10]'} bg-[var(--wk-surface-raised)]`} />
                  <div className="p-5 space-y-3">
                    <div className="h-3 w-16 rounded bg-[var(--wk-surface-raised)]" />
                    <div className="h-5 w-3/4 rounded bg-[var(--wk-surface-raised)]" />
                    <div className="h-3 w-1/2 rounded bg-[var(--wk-surface-raised)]" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Error */}
        {!loading && error && (
          <div className="mt-8 rounded-2xl border border-[var(--wk-danger)]/20 bg-[var(--wk-danger)]/5 p-10 text-center">
            <WkIcon name="AlertCircle" size={32} className="mx-auto mb-4 text-[var(--wk-danger)]" />
            <p className="text-sm font-bold text-[var(--wk-text-muted)]">{error}</p>
            <button
              onClick={() => window.location.reload()}
              className="mt-5 inline-flex items-center gap-2 rounded-lg bg-[var(--wk-surface-raised)] px-5 py-2.5 text-sm font-bold text-[var(--wk-text)] transition-colors hover:bg-[var(--wk-surface)]"
            >
              <WkIcon name="RotateCw" size={14} /> Retry
            </button>
          </div>
        )}

        {/* Empty */}
        {!loading && !error && articles.length === 0 && (
          <div className="mt-8 rounded-2xl border border-dashed border-[var(--wk-border)] p-16 text-center">
            <WkIcon name="FileX" size={36} className="mx-auto mb-4 text-[var(--wk-text-faint)]" />
            <p className="text-sm font-bold text-[var(--wk-text-muted)]">No published articles yet.</p>
            <Link
              to="/magazine"
              className="mt-5 inline-flex items-center gap-2 rounded-lg bg-[var(--wk-brand)] px-5 py-2.5 text-sm font-bold text-[var(--wk-brand-on)] transition-opacity hover:opacity-90"
            >
              <WkIcon name="BookOpen" size={14} /> Browse magazine
            </Link>
          </div>
        )}

        {/* Content */}
        {!loading && !error && articles.length > 0 && (
          <>
            {/* ====== FEATURED SECTION ====== */}
            {hasFeatured && featuredArticles.length > 0 && (
              <div className="mt-8">
                {/* Featured Hero Cover */}
                <Link to={`/magazine/${featuredArticles[0].slug}`} className="author-mag-featured-hero block">
                  <div className="author-mag-featured-hero-image">
                    <img src={featuredArticles[0].heroUrl} alt="" className="w-full h-full object-cover" />
                  </div>
                  <div className="author-mag-featured-hero-overlay">
                    <div className="author-mag-featured-hero-eye">Featured Story</div>
                    <h2 className="author-mag-featured-hero-title">{featuredArticles[0].title}</h2>
                    {featuredArticles[0].dek && (
                      <p className="author-mag-featured-hero-dek">{featuredArticles[0].dek}</p>
                    )}
                    <div className="author-mag-featured-hero-meta">
                      <span>{featuredArticles[0].section}</span>
                      <span>&middot;</span>
                      <span>{featuredArticles[0].readingTime} min read</span>
                      <span>&middot;</span>
                      <span>{featuredArticles[0].date}</span>
                    </div>
                  </div>
                </Link>

                {/* Carousel — more featured stories */}
                {carouselItems.length > 0 && (
                  <div className="author-mag-carousel-wrap">
                    <div className="author-mag-carousel-label">
                      <span className="author-mag-carousel-label-text">More from {firstName}</span>
                      <span className="author-mag-carousel-label-line" />
                    </div>
                    <div className="author-mag-carousel-track-wrap">
                      <div className="author-mag-carousel-track">
                        {carouselItems.map((story, i) => (
                          <Link
                            key={`carousel-${story.slug}-${i}`}
                            to={`/magazine/${story.slug}`}
                            className="author-mag-carousel-card"
                          >
                            <div className="author-mag-carousel-card-image">
                              <img src={story.heroUrl} alt="" loading="lazy" className="w-full h-full object-cover" />
                            </div>
                            <div className="author-mag-carousel-card-body">
                              <div className="author-mag-carousel-card-section">{story.section}</div>
                              <h3 className="author-mag-carousel-card-title">{story.title}</h3>
                              {story.dek && (
                                <p className="author-mag-carousel-card-dek">{story.dek}</p>
                              )}
                              <div className="author-mag-card-meta">
                                <span>{story.readingTime} min</span>
                                <span className="author-mag-card-meta-sep">&middot;</span>
                                <span>{story.date}</span>
                              </div>
                            </div>
                          </Link>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {/* Divider before grid */}
                <div className="author-mag-featured-divider">
                  <span className="author-mag-featured-divider-line" />
                  <span className="author-mag-featured-divider-text">All Stories</span>
                  <span className="author-mag-featured-divider-line" />
                </div>
              </div>
            )}


            {/* ====== FILTER BAR (v2 with integrated sort dropdown) ====== */}
            {!hasFeatured && (
              <div className="profile-dt-section-head">
                <div className="profile-dt-section-kicker">Articles</div>
                <h2 className="profile-dt-section-title">Stories by {firstName}</h2>
              </div>
            )}

            <div className="author-mag-filter-bar-v2">
              <div className="author-mag-filter-pills-v2">
                <button
                  className={`author-mag-filter-pill-v2 ${activeCategory === 'all' ? 'active' : ''}`}
                  onClick={() => setActiveCategory('all')}
                >
                  All
                  <span className="pill-count-v2">{articles.length}</span>
                </button>
                {sections.map((section) => (
                  <button
                    key={section}
                    className={`author-mag-filter-pill-v2 ${activeCategory === section ? 'active' : ''}`}
                    onClick={() => setActiveCategory(activeCategory === section ? 'all' : section)}
                  >
                    {section}
                    <span className="pill-count-v2">{sectionCounts[section]}</span>
                  </button>
                ))}
              </div>

              {/* Sort dropdown */}
              <div className="author-mag-sort-wrap" ref={sortWrapRef}>
                <button
                  className={`author-mag-sort-trigger ${sortOpen ? 'open' : ''}`}
                  onClick={() => setSortOpen((p) => !p)}
                >
                  <i className={`${SORT_OPTIONS.find((o) => o.mode === sortMode)?.icon || 'ri-arrow-down-line'} text-xs`} />
                  <span>{SORT_OPTIONS.find((o) => o.mode === sortMode)?.label || 'Sort'}</span>
                  <i className="ri-arrow-down-s-line text-xs author-mag-sort-trigger-icon" />
                </button>
                {sortOpen && (
                  <div className="author-mag-sort-dropdown">
                    {SORT_OPTIONS.map((opt) => (
                      <button
                        key={opt.mode}
                        className={`author-mag-sort-option ${sortMode === opt.mode ? 'active' : ''}`}
                        onClick={() => { setSortMode(opt.mode); setSortOpen(false); }}
                      >
                        <i className={`${opt.icon} text-sm`} />
                        <span>{opt.label}</span>
                        {sortMode === opt.mode && (
                          <i className="ri-check-line text-sm author-mag-sort-option-check" />
                        )}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Empty filtered */}
            {filteredArticles.length === 0 && (
              <div className="author-mag-empty">
                <div className="author-mag-empty-icon">
                  <WkIcon name="SearchX" size={32} />
                </div>
                <div className="author-mag-empty-title">No articles in {activeCategory}</div>
                <div className="author-mag-empty-sub">
                  {firstName} hasn't written any {activeCategory} articles yet. Try a different filter.
                </div>
                <button
                  className="mt-5 inline-flex items-center gap-2 rounded-lg bg-[var(--wk-surface-raised)] px-4 py-2 text-sm font-bold text-[var(--wk-text)] hover:bg-[var(--wk-surface)] transition-colors"
                  onClick={() => setActiveCategory('all')}
                >
                  <WkIcon name="RotateCw" size={14} /> Show all
                </button>
              </div>
            )}

            {/* ====== GRID (below featured) ====== */}
            {filteredArticles.length > 0 && gridArticles.length > 0 && sectionGroups && (
              <div className="author-mag-sections">
                {sectionGroups.map((group, gi) => {
                  const groupStartIndex = sectionGroups
                    .slice(0, gi)
                    .reduce((sum, g) => sum + g.items.length, 0);

                  if (groupStartIndex >= visibleCount) return null;

                  return (
                    <div key={group.section} className="author-mag-group">
                      <div className="author-mag-group-header">
                        <span className="author-mag-group-kicker">{group.section}</span>
                        <span className="author-mag-group-count">{group.items.length} article{group.items.length !== 1 ? 's' : ''}</span>
                      </div>
                      <div className="author-mag-grid">
                        {group.items.map((story, i) => {
                          const gi2 = groupStartIndex + i;
                          if (gi2 >= visibleCount) return null;
                          return renderGridCard(story, gi2);
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {filteredArticles.length > 0 && gridArticles.length > 0 && !sectionGroups && (
              <div className="author-mag-grid">
                {gridArticles.map((story, i) => {
                  if (i >= visibleCount) return null;
                  return renderGridCard(story, i);
                })}
              </div>
            )}

            {/* No grid articles but featured exists */}
            {filteredArticles.length > 0 && gridArticles.length === 0 && (
              <div className="author-mag-sentinel">
                <div className="author-mag-sentinel-done">
                  <span className="author-mag-sentinel-done-line" />
                  <span className="author-mag-sentinel-done-text">
                    All {filteredArticles.length} articles shown above
                  </span>
                  <span className="author-mag-sentinel-done-line" />
                </div>
              </div>
            )}

            {/* Infinite scroll sentinel */}
            {gridArticles.length > 0 && (
              <div ref={sentinelRef} className="author-mag-sentinel">
                {hasMore ? (
                  <div className="author-mag-sentinel-loading">
                    <div className="author-mag-sentinel-spinner" />
                    <span className="author-mag-sentinel-text">
                      Loading more stories&hellip;
                    </span>
                  </div>
                ) : visibleCount > BATCH_SIZE ? (
                  <div className="author-mag-sentinel-done">
                    <span className="author-mag-sentinel-done-line" />
                    <span className="author-mag-sentinel-done-text">
                      All {gridArticles.length} articles loaded
                    </span>
                    <span className="author-mag-sentinel-done-line" />
                  </div>
                ) : null}
              </div>
            )}
          </>
        )}
      </div>
    </main>
  );
}