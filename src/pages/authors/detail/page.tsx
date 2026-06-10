import { useEffect, useState, useMemo, useRef } from 'react';
import { Link, useParams } from 'react-router-dom';
import { WkIcon } from '@/components/design-system/Icon';
import { getArticlesByAuthor, type MagazineArticle } from '@/services/magazineArticles';
import { getAuthorMeta, getVerticalColor, resolveAuthorMeta, type AuthorRow } from '@/services/authorProfiles';

type SortMode = 'latest' | 'oldest' | 'longest';
type AuthorMetaResolved = Awaited<ReturnType<typeof resolveAuthorMeta>>;

const BATCH_SIZE = 8;
const LOAD_MORE = 6;
const FEATURED_COUNT = 5;

const SORT_OPTIONS: { mode: SortMode; label: string; icon: string }[] = [
  { mode: 'latest', label: 'Latest', icon: 'ri-arrow-down-line' },
  { mode: 'oldest', label: 'Oldest', icon: 'ri-arrow-up-line' },
  { mode: 'longest', label: 'Longest', icon: 'ri-time-line' },
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
  const [authorMetaResolved, setAuthorMetaResolved] = useState<AuthorMetaResolved | null>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const sortWrapRef = useRef<HTMLDivElement>(null);

  const normalizedSlug = (slug || '').toLowerCase().replace(/[\s_-]+/g, '-');
  // Fallback meta while real data loads
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

    // Fetch real author meta from wk_authors
    resolveAuthorMeta(normalizedSlug)
      .then((resolved) => {
        if (!alive) return;
        setAuthorMetaResolved(resolved);
      })
      .catch(() => {
        // Silent fallback — getAuthorMeta will handle it
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

  /* ─── Section counts ─── */
  const { sections, sectionCounts } = useMemo(() => {
    const map: Record<string, number> = {};
    for (const a of articles) {
      const sec = a.section || 'Uncategorized';
      map[sec] = (map[sec] || 0) + 1;
    }
    const sorted = Object.entries(map).sort((a, b) => b[1] - a[1]);
    return { sections: sorted.map(([name]) => name), sectionCounts: map };
  }, [articles]);

  /* ─── Filter & sort ─── */
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

  /* ─── Derived stats ─── */
  const stats = useMemo(() => {
    if (articles.length === 0) return null;
    const totalMin = articles.reduce((s, a) => s + a.readingTime, 0);
    const topSection = sections[0] || '—';
    const topSectionPct = Math.round(((sectionCounts[topSection] || 0) / articles.length) * 100);
    const dates = articles.map((a) => new Date(a.date)).filter((d) => !Number.isNaN(d.getTime()));
    const firstDate = dates.length > 0 ? dates[dates.length - 1] : null;
    const latestDate = dates.length > 0 ? dates[0] : null;
    const monthsActive = firstDate && latestDate
      ? Math.max(1, Math.ceil((latestDate.getTime() - firstDate.getTime()) / (1000 * 60 * 60 * 24 * 30)))
      : 0;
    return { totalMin, topSection, topSectionPct, monthsActive, firstDate, latestDate };
  }, [articles, sections, sectionCounts]);

  /* ─── Featured + grid split ─── */
  const hasFeatured = filteredArticles.length >= 3;
  const featuredArticles = useMemo(
    () => (hasFeatured ? filteredArticles.slice(0, FEATURED_COUNT) : []),
    [filteredArticles, hasFeatured],
  );
  const gridArticles = useMemo(
    () => (hasFeatured ? filteredArticles.slice(FEATURED_COUNT) : filteredArticles),
    [filteredArticles, hasFeatured],
  );

  /* ─── Carousel items ─── */
  const carouselItems = useMemo(() => {
    if (featuredArticles.length <= 1) return [];
    const items = featuredArticles.slice(1);
    return [...items, ...items];
  }, [featuredArticles]);

  useEffect(() => { setVisibleCount(BATCH_SIZE); }, [activeCategory, sortMode]);

  /* ─── Infinite scroll ─── */
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

  /* ─── Total computed areas from article sections ─── */
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
    return ordered.slice(0, 6);
  }, [articles, sections, authorMeta.areas]);

  /* ─── Row-based grid ─── */
  const visibleArticles = useMemo(
    () => gridArticles.slice(0, visibleCount),
    [gridArticles, visibleCount],
  );

  const rows = useMemo(() => {
    const r: { articles: MagazineArticle[]; pattern: 'three-up' | 'split' | 'full-bleed' }[] = [];
    let idx = 0;
    let rowIdx = 0;
    while (idx < visibleArticles.length) {
      const p = rowIdx % 4;
      let pattern: 'three-up' | 'split' | 'full-bleed';
      let consume: number;
      if (p === 0) { pattern = 'three-up'; consume = 3; }
      else if (p === 2) { pattern = 'full-bleed'; consume = 1; }
      else { pattern = 'split'; consume = 2; }
      const slice = visibleArticles.slice(idx, idx + consume);
      if (slice.length === 0) break;
      r.push({ articles: slice, pattern });
      idx += consume;
      rowIdx++;
    }
    return r;
  }, [visibleArticles]);

  const MediumCard = ({ story }: { story: MagazineArticle }) => {
    const vc = getVerticalColor(story.section);
    return (
      <Link
        to={`/magazine/${story.slug}`}
        className="group border border-[var(--wk-border)] rounded-2xl overflow-hidden bg-[var(--wk-surface)] hover:-translate-y-0.5 hover:border-[var(--wk-border-2)] transition-all duration-200 flex flex-col h-full"
      >
        <div className="aspect-[16/10] overflow-hidden bg-[var(--wk-surface-raised)]">
          <img src={story.heroUrl} alt="" loading="lazy" className="w-full h-full object-cover group-hover:scale-[1.03] transition-transform duration-500" />
        </div>
        <div className="p-5 flex flex-col flex-1">
          <span className="author-profile-card-section" style={{ color: vc }}>{story.section}</span>
          <h3 className="font-black text-[15px] leading-[1.16] tracking-[-0.02em] text-[var(--wk-text)] line-clamp-2 mb-2 group-hover:text-[var(--wk-brand)] transition-colors">{story.title}</h3>
          {story.dek && <p className="font-normal text-xs leading-[1.45] text-[var(--wk-text-soft)] line-clamp-2 mb-3">{story.dek}</p>}
          <div className="mt-auto flex items-center gap-2 text-[11px] font-semibold text-[var(--wk-text-muted)]">
            <span>{story.readingTime} min</span>
            <span className="text-[var(--wk-border-strong)]">&middot;</span>
            <span>{story.date}</span>
          </div>
        </div>
      </Link>
    );
  };

  const FeatureCard = ({ story, wide }: { story: MagazineArticle; wide?: boolean }) => {
    const vc = getVerticalColor(story.section);
    return (
      <Link
        to={`/magazine/${story.slug}`}
        className={`group border border-[var(--wk-border)] rounded-2xl overflow-hidden bg-[var(--wk-surface)] hover:-translate-y-0.5 hover:border-[var(--wk-border-2)] transition-all duration-200 grid grid-cols-1 sm:grid-cols-[1.2fr_1fr] h-full ${wide ? 'sm:grid-cols-[5fr_4fr]' : ''}`}
      >
        <div className="overflow-hidden bg-[var(--wk-surface-raised)] min-h-[160px] sm:min-h-0">
          <img src={story.heroUrl} alt="" loading="lazy" className="w-full h-full object-cover group-hover:scale-[1.03] transition-transform duration-500" />
        </div>
        <div className={`flex flex-col justify-center ${wide ? 'p-5 sm:p-7 md:p-9' : 'p-5 sm:p-6'}`}>
          <span className="author-profile-card-section" style={{ color: vc }}>{story.section}</span>
          <h3 className={`font-black tracking-[-0.03em] text-[var(--wk-text)] mb-2.5 group-hover:text-[var(--wk-brand)] transition-colors ${wide ? 'text-lg leading-[1.12] sm:text-[22px] sm:leading-[1.10] md:text-[26px]' : 'text-base leading-[1.18] sm:text-[17px] sm:leading-[1.15]'}`}>{story.title}</h3>
          {story.dek && <p className={`font-normal text-[var(--wk-text-soft)] line-clamp-2 ${wide ? 'text-xs leading-[1.5] sm:text-sm sm:leading-[1.55] mb-3 sm:mb-4' : 'text-[11px] leading-[1.5] sm:text-xs sm:leading-[1.5] mb-2 sm:mb-3'}`}>{story.dek}</p>}
          <div className="flex items-center gap-2 text-[11px] font-semibold text-[var(--wk-text-muted)]">
            <span>{story.readingTime} min</span>
            <span className="text-[var(--wk-border-strong)]">&middot;</span>
            <span>{story.date}</span>
          </div>
        </div>
      </Link>
    );
  };

  /* ─── ─── LOADING STATE ─── ─── */
  if (loading) {
    return (
      <main className="author-profile-shell">
        <div className="author-profile-content">
          {/* Hero skeleton */}
          <section className="author-profile-hero animate-pulse">
            <div className="author-profile-hero-portrait rounded-2xl bg-[var(--wk-surface-raised)]" />
            <div className="author-profile-hero-details">
              <div className="space-y-4">
                <div className="h-4 w-28 rounded-full bg-[var(--wk-surface-raised)]" />
                <div className="h-12 w-72 rounded-lg bg-[var(--wk-surface-raised)]" />
                <div className="h-5 w-44 rounded bg-[var(--wk-surface-raised)]" />
                <div className="space-y-2">
                  <div className="h-4 w-full rounded bg-[var(--wk-surface-raised)]" />
                  <div className="h-4 w-3/4 rounded bg-[var(--wk-surface-raised)]" />
                </div>
                <div className="flex gap-3">
                  <div className="h-8 w-20 rounded-full bg-[var(--wk-surface-raised)]" />
                  <div className="h-8 w-24 rounded-full bg-[var(--wk-surface-raised)]" />
                  <div className="h-8 w-16 rounded-full bg-[var(--wk-surface-raised)]" />
                </div>
              </div>
              <div className="flex gap-8 mt-6">
                <div className="h-16 w-20 rounded bg-[var(--wk-surface-raised)]" />
                <div className="h-16 w-20 rounded bg-[var(--wk-surface-raised)]" />
                <div className="h-16 w-20 rounded bg-[var(--wk-surface-raised)]" />
              </div>
            </div>
          </section>
          {/* Grid skeleton — mirroring the row rhythm */}
          <div className="flex flex-col mt-12">
            {/* Three-up row */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="rounded-2xl border border-[var(--wk-border)] bg-[var(--wk-surface)] overflow-hidden">
                  <div className="aspect-[16/10] bg-[var(--wk-surface-raised)] animate-pulse" />
                  <div className="p-5 space-y-3">
                    <div className="h-3 w-16 rounded bg-[var(--wk-surface-raised)] animate-pulse" />
                    <div className="h-5 w-3/4 rounded bg-[var(--wk-surface-raised)] animate-pulse" />
                    <div className="h-3 w-1/2 rounded bg-[var(--wk-surface-raised)] animate-pulse" />
                  </div>
                </div>
              ))}
            </div>
            {/* Section break skeleton */}
            <div className="flex items-center gap-4 my-9 sm:my-11">
              <span className="flex-1 h-px bg-[var(--wk-divider)]" />
              <span className="h-3 w-24 rounded bg-[var(--wk-surface-raised)] animate-pulse" />
              <span className="flex-1 h-px bg-[var(--wk-divider)]" />
            </div>
            {/* Split row */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5">
              <div className="sm:col-span-2 rounded-2xl border border-[var(--wk-border)] bg-[var(--wk-surface)] overflow-hidden">
                <div className="grid grid-cols-1 sm:grid-cols-[1.2fr_1fr]">
                  <div className="min-h-[120px] sm:min-h-[160px] bg-[var(--wk-surface-raised)] animate-pulse" />
                  <div className="p-5 sm:p-6 space-y-3">
                    <div className="h-3 w-16 rounded bg-[var(--wk-surface-raised)] animate-pulse" />
                    <div className="h-6 w-3/4 rounded bg-[var(--wk-surface-raised)] animate-pulse" />
                    <div className="h-3 w-1/2 rounded bg-[var(--wk-surface-raised)] animate-pulse" />
                  </div>
                </div>
              </div>
              <div className="sm:col-span-2 lg:col-span-1 rounded-2xl border border-[var(--wk-border)] bg-[var(--wk-surface)] overflow-hidden">
                <div className="aspect-[16/10] bg-[var(--wk-surface-raised)] animate-pulse" />
                <div className="p-5 space-y-3">
                  <div className="h-3 w-16 rounded bg-[var(--wk-surface-raised)] animate-pulse" />
                  <div className="h-5 w-3/4 rounded bg-[var(--wk-surface-raised)] animate-pulse" />
                  <div className="h-3 w-1/2 rounded bg-[var(--wk-surface-raised)] animate-pulse" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    );
  }

  /* ─── ─── ERROR STATE ─── ─── */
  if (error && articles.length === 0) {
    return (
      <main className="author-profile-shell">
        <div className="author-profile-content py-20 text-center">
          <WkIcon name="AlertCircle" size={36} className="mx-auto mb-4 text-[var(--wk-danger)]" />
          <p className="text-sm font-bold text-[var(--wk-text-muted)]">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="mt-5 inline-flex items-center gap-2 rounded-lg bg-[var(--wk-surface-raised)] px-5 py-2.5 text-sm font-bold text-[var(--wk-text)] hover:bg-[var(--wk-surface)] transition-colors cursor-pointer"
          >
            <WkIcon name="RotateCw" size={14} /> Retry
          </button>
        </div>
      </main>
    );
  }

  /* ─── ─── MAIN PAGE ─── ─── */
  return (
    <main className="author-profile-shell">
      <div className="author-profile-content">

        {/* ═══════════ HERO ═══════════ */}
        <section className="author-profile-hero">
          {/* Portrait */}
          <div className="author-profile-hero-portrait">
            <img
              src={authorMeta.avatarUrl}
              alt={authorMeta.displayName}
              className="w-full h-full object-cover"
            />
            <div className="author-profile-hero-portrait-badge">
              <WkIcon name="PenLine" size={12} />
            </div>
          </div>

          {/* Details */}
          <div className="author-profile-hero-details">
            {/* Eyebrow */}
            <div className="author-profile-hero-eyebrow">
              WAKILISHA Contributor
            </div>

            {/* Name */}
            <h1 className="author-profile-hero-name">{authorMeta.displayName}</h1>

            {/* Role + location */}
            <div className="author-profile-hero-role-row">
              <span className="author-profile-hero-role">
                <WkIcon name="Briefcase" size={13} className="opacity-70" />
                {authorMeta.role}
              </span>
              {authorMeta.location && (
                <>
                  <span className="author-profile-hero-dot">&middot;</span>
                  <span className="author-profile-hero-location">
                    <i className="ri-map-pin-line" />
                    {authorMeta.location}
                  </span>
                </>
              )}
              {authorMeta.joinedDate && (
                <>
                  <span className="author-profile-hero-dot">&middot;</span>
                  <span className="author-profile-hero-joined">
                    Since {(() => {
                      const d = new Date(authorMeta.joinedDate);
                      return d.toLocaleDateString('en', { month: 'short', year: 'numeric' });
                    })()}
                  </span>
                </>
              )}
            </div>

            {/* Bio */}
            {authorMeta.bio && (
              <p className="author-profile-hero-bio">{authorMeta.bio}</p>
            )}

            {/* Areas of focus */}
            {actualAreas.length > 0 && (
              <div className="author-profile-hero-areas">
                <span className="author-profile-hero-areas-label">Areas of focus</span>
                <div className="author-profile-hero-areas-tags">
                  {actualAreas.map((area) => (
                    <span
                      key={area}
                      className="author-profile-hero-area-tag"
                      style={{
                        '--area-color': getVerticalColor(area),
                      } as React.CSSProperties}
                    >
                      {area}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Social links */}
            {authorMeta.socialLinks.length > 0 && (
              <div className="author-profile-hero-socials">
                {authorMeta.socialLinks.map((link) => (
                  <a
                    key={link.label}
                    href={link.url}
                    className="author-profile-hero-social-link"
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={link.label}
                  >
                    <i className={`${link.icon} text-[17px]`} />
                  </a>
                ))}
              </div>
            )}

            {/* Stats */}
            <div className="author-profile-hero-stats">
              <div className="author-profile-hero-stat">
                <div className="author-profile-hero-stat-val">{articles.length}</div>
                <div className="author-profile-hero-stat-lbl">Articles</div>
              </div>
              <div className="author-profile-hero-stat">
                <div className="author-profile-hero-stat-val">
                  {stats ? stats.totalMin : 0}
                </div>
                <div className="author-profile-hero-stat-lbl">Min read</div>
              </div>
              <div className="author-profile-hero-stat">
                <div className="author-profile-hero-stat-val">{sections.length}</div>
                <div className="author-profile-hero-stat-lbl">Verticals</div>
              </div>
              {stats?.topSection && (
                <div className="author-profile-hero-stat">
                  <div className="author-profile-hero-stat-val">{stats.topSection}</div>
                  <div className="author-profile-hero-stat-lbl">Main beat</div>
                </div>
              )}
            </div>
          </div>
        </section>

        {/* ═══════════ BODY OF WORK ═══════════ */}
        {articles.length > 0 && (
          <>
            {/* Divider */}
            <div className="author-profile-divider">
              <span className="author-profile-divider-line" />
              <span className="author-profile-divider-text">Body of work</span>
              <span className="author-profile-divider-line" />
            </div>

            {/* ====== FEATURED SECTION ====== */}
            {hasFeatured && featuredArticles.length > 0 && (
              <div className="author-profile-featured-wrap">
                {/* Featured hero */}
                <Link
                  to={`/magazine/${featuredArticles[0].slug}`}
                  className="author-profile-featured-hero group"
                >
                  <div className="author-profile-featured-hero-image">
                    <img src={featuredArticles[0].heroUrl} alt="" className="w-full h-full object-cover" />
                  </div>
                  <div className="author-profile-featured-hero-overlay">
                    <div className="author-profile-featured-hero-eye">
                      Featured story
                    </div>
                    <h2 className="author-profile-featured-hero-title">{featuredArticles[0].title}</h2>
                    {featuredArticles[0].dek && (
                      <p className="author-profile-featured-hero-dek">{featuredArticles[0].dek}</p>
                    )}
                    <div className="author-profile-featured-hero-row">
                      <span style={{ color: getVerticalColor(featuredArticles[0].section) }}>{featuredArticles[0].section}</span>
                      <span>&middot;</span>
                      <span>{featuredArticles[0].readingTime} min read</span>
                      <span>&middot;</span>
                      <span>{featuredArticles[0].date}</span>
                    </div>
                  </div>
                </Link>

                {/* Carousel */}
                {carouselItems.length > 0 && (
                  <div className="author-profile-carousel-wrap">
                    <div className="author-profile-carousel-label">
                      <span>More from {firstName}</span>
                      <span className="author-profile-carousel-label-line" />
                    </div>
                    <div className="author-profile-carousel-track-wrap">
                      <div className="author-profile-carousel-track">
                        {carouselItems.map((story, i) => (
                          <Link
                            key={`carousel-${story.slug}-${i}`}
                            to={`/magazine/${story.slug}`}
                            className="author-profile-carousel-card group"
                          >
                            <div className="author-profile-carousel-card-image">
                              <img src={story.heroUrl} alt="" loading="lazy" className="w-full h-full object-cover" />
                            </div>
                            <div className="author-profile-carousel-card-body">
                              <span className="author-profile-card-section" style={{ color: getVerticalColor(story.section) }}>{story.section}</span>
                              <h3 className="author-profile-carousel-card-title">{story.title}</h3>
                              {story.dek && <p className="author-profile-carousel-card-dek">{story.dek}</p>}
                              <div className="author-profile-card-meta">
                                <span>{story.readingTime} min</span>
                                <span className="author-profile-card-meta-sep">&middot;</span>
                                <span>{story.date}</span>
                              </div>
                            </div>
                          </Link>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* ====== FILTER BAR ====== */}
            <div className="author-profile-filter-bar">
              <div className="author-profile-filter-pills">
                <button
                  className={`author-profile-filter-pill ${activeCategory === 'all' ? 'active' : ''}`}
                  onClick={() => setActiveCategory('all')}
                >
                  All
                  <span className="author-profile-filter-pill-count">{articles.length}</span>
                </button>
                {sections.map((sec) => (
                  <button
                    key={sec}
                    className={`author-profile-filter-pill ${activeCategory === sec ? 'active' : ''}`}
                    onClick={() => setActiveCategory(activeCategory === sec ? 'all' : sec)}
                    style={activeCategory === sec ? {} : { '--pill-color': getVerticalColor(sec) } as React.CSSProperties}
                  >
                    {sec}
                    <span className="author-profile-filter-pill-count">{sectionCounts[sec]}</span>
                  </button>
                ))}
              </div>

              {/* Sort */}
              <div className="author-profile-sort-wrap" ref={sortWrapRef}>
                <button
                  className={`author-profile-sort-trigger ${sortOpen ? 'open' : ''}`}
                  onClick={() => setSortOpen((p) => !p)}
                >
                  <i className={`${SORT_OPTIONS.find((o) => o.mode === sortMode)?.icon || 'ri-arrow-down-line'} text-xs`} />
                  <span>{SORT_OPTIONS.find((o) => o.mode === sortMode)?.label || 'Sort'}</span>
                  <i className="ri-arrow-down-s-line text-xs author-profile-sort-chevron" />
                </button>
                {sortOpen && (
                  <div className="author-profile-sort-dropdown">
                    {SORT_OPTIONS.map((opt) => (
                      <button
                        key={opt.mode}
                        className={`author-profile-sort-option ${sortMode === opt.mode ? 'active' : ''}`}
                        onClick={() => { setSortMode(opt.mode); setSortOpen(false); }}
                      >
                        <i className={`${opt.icon} text-sm`} />
                        <span>{opt.label}</span>
                        {sortMode === opt.mode && <i className="ri-check-line text-sm author-profile-sort-check" />}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* ====== EMPTY FILTERED ====== */}
            {filteredArticles.length === 0 && (
              <div className="author-profile-empty">
                <WkIcon name="SearchX" size={32} />
                <div className="author-profile-empty-title">No articles in {activeCategory}</div>
                <div className="author-profile-empty-sub">
                  {firstName} hasn't written any {activeCategory} articles yet.
                </div>
                <button
                  className="mt-5 inline-flex items-center gap-2 rounded-lg bg-[var(--wk-surface-raised)] px-4 py-2 text-sm font-bold text-[var(--wk-text)] hover:bg-[var(--wk-surface)] transition-colors cursor-pointer"
                  onClick={() => setActiveCategory('all')}
                >
                  <WkIcon name="RotateCw" size={14} /> Show all
                </button>
              </div>
            )}

            {/* ====== SYMMETRIC GRID ====== */}
            {filteredArticles.length > 0 && gridArticles.length > 0 && rows.length > 0 && (
              <div className="flex flex-col">
                {rows.map((row, rowIdx) => {
                  const needsSectionBreak = rowIdx > 0 && rowIdx % 3 === 0;
                  const sectionBreak = needsSectionBreak ? (
                    <div key={`section-break-${rowIdx}`} className="flex items-center gap-4 my-9 sm:my-11">
                      <span className="flex-1 h-px bg-[var(--wk-divider)]" />
                      <span className="text-[9px] sm:text-[10px] font-black uppercase tracking-[0.18em] text-[var(--wk-text-faint)] whitespace-nowrap">
                        {rowIdx <= 4 ? 'More stories' : 'Continuing'}
                      </span>
                      <span className="flex-1 h-px bg-[var(--wk-divider)]" />
                    </div>
                  ) : null;

                  const rowEl = (() => {
                    if (row.pattern === 'full-bleed') {
                      return <FeatureCard key={`row-${rowIdx}`} story={row.articles[0]} wide />;
                    }
                    if (row.pattern === 'split') {
                      if (row.articles.length < 2) {
                        return (
                          <div key={`row-${rowIdx}`} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5">
                            <div className="lg:col-span-1"><MediumCard story={row.articles[0]} /></div>
                          </div>
                        );
                      }
                      return (
                        <div key={`row-${rowIdx}`} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5">
                          <div className="sm:col-span-2"><FeatureCard story={row.articles[0]} /></div>
                          <div className="sm:col-span-2 lg:col-span-1"><MediumCard story={row.articles[1]} /></div>
                          {row.articles[2] && (
                            <div className="sm:col-span-2 lg:col-span-1"><MediumCard story={row.articles[2]} /></div>
                          )}
                        </div>
                      );
                    }
                    return (
                      <div key={`row-${rowIdx}`} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5">
                        {row.articles.map((story, i) => (
                          <MediumCard key={`${story.slug}-${i}`} story={story} />
                        ))}
                      </div>
                    );
                  })();

                  return (
                    <div key={`row-wrap-${rowIdx}`} className="flex flex-col">
                      {sectionBreak}
                      {rowEl}
                    </div>
                  );
                })}
              </div>
            )}

            {/* ====== ONLY FEATURED ====== */}
            {filteredArticles.length > 0 && gridArticles.length === 0 && (
              <div className="author-profile-sentinel">
                <span className="author-profile-sentinel-line" />
                <span className="author-profile-sentinel-text">
                  All {filteredArticles.length} articles shown above
                </span>
                <span className="author-profile-sentinel-line" />
              </div>
            )}

            {/* ====== INFINITE SCROLL ====== */}
            {gridArticles.length > 0 && (
              <div ref={sentinelRef} className="author-profile-sentinel">
                {hasMore ? (
                  <div className="author-profile-sentinel-loading">
                    <div className="author-profile-sentinel-spinner" />
                    <span>Loading more stories&hellip;</span>
                  </div>
                ) : visibleCount > BATCH_SIZE ? (
                  <>
                    <span className="author-profile-sentinel-line" />
                    <span className="author-profile-sentinel-text">
                      All {gridArticles.length} articles loaded
                    </span>
                    <span className="author-profile-sentinel-line" />
                  </>
                ) : null}
              </div>
            )}
          </>
        )}

        {/* ═══════════ EMPTY STATE ═══════════ */}
        {!loading && !error && articles.length === 0 && (
          <div className="author-profile-empty mt-8">
            <WkIcon name="FileX" size={36} />
            <div className="author-profile-empty-title">No published articles yet</div>
            <div className="author-profile-empty-sub">Check back soon for {firstName}'s first piece.</div>
            <Link
              to="/magazine"
              className="mt-5 inline-flex items-center gap-2 rounded-lg bg-[var(--wk-brand)] px-5 py-2.5 text-sm font-bold text-[var(--wk-brand-on)] hover:opacity-90 transition-opacity whitespace-nowrap"
            >
              <WkIcon name="BookOpen" size={14} /> Browse magazine
            </Link>
          </div>
        )}

        {/* ═══════════ EXPLORE CTA ═══════════ */}
        {articles.length > 0 && (
          <section className="author-profile-explore">
            <p className="author-profile-explore-text">
              {firstName} is part of WAKILISHA's cultural memory system — documenting and interpreting East African creative life.
            </p>
            <div className="author-profile-explore-links">
              <Link to="/magazine" className="author-profile-explore-link">
                <WkIcon name="BookOpen" size={15} />
                All stories
              </Link>
              <Link to="/guides" className="author-profile-explore-link">
                <WkIcon name="Compass" size={15} />
                Guides
              </Link>
              <Link to="/artists" className="author-profile-explore-link">
                <WkIcon name="Users" size={15} />
                Artists
              </Link>
            </div>
          </section>
        )}
      </div>
    </main>
  );
}