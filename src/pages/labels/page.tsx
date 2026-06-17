import { useMemo, useState, useEffect, useCallback, useRef } from "react";
import { Link } from "react-router-dom";
import { ShareButton } from "@/components/design-system/share/ShareSheet";
import { WkIcon } from "@/components/design-system/Icon";
import { Chapter19FallbackImage } from "@/components/media/Chapter19FallbackImage";
import {
  listLabelsPaginated,
  getLabelCatalogStats,
  type PublicLabel,
  type LabelCatalogStats,
} from "@/services/publicContent/client";

const PAGE_SIZE = 24;

/* ── Scroll reveal ── */
function useScrollReveal(deps: unknown[] = []) {
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("label43-reveal-visible");
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.06, rootMargin: "0px 0px -28px 0px" },
    );
    const els = document.querySelectorAll(".label43-reveal");
    els.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, deps);
}

export default function Labels() {
  const [query, setQuery] = useState("");
  const [country, setCountry] = useState("All");
  const [page, setPage] = useState(1);
  const [labels, setLabels] = useState<PublicLabel[]>([]);
  const [stats, setStats] = useState<LabelCatalogStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const heroRef = useRef<HTMLDivElement>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [statsData, pageData] = await Promise.all([
        getLabelCatalogStats(),
        listLabelsPaginated({
          page: 1,
          pageSize: PAGE_SIZE,
          countryFilter: country,
          search: query,
        }),
      ]);
      setStats(statsData);
      setLabels(pageData.labels);
      setPage(1);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load labels.");
    } finally {
      setLoading(false);
    }
  }, [query, country]);

  const loadPage = useCallback(async (targetPage: number) => {
    setLoading(true);
    setError(null);
    try {
      const pageData = await listLabelsPaginated({
        page: targetPage,
        pageSize: PAGE_SIZE,
        countryFilter: country,
        search: query,
      });
      setLabels(pageData.labels);
      setPage(targetPage);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load labels.");
    } finally {
      setLoading(false);
    }
  }, [query, country]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useScrollReveal([loading, page]);

  const totalPages = useMemo(() => {
    if (!stats) return 1;
    // Approximate total from filtered count — we need to refetch on filter change
    return Math.max(1, Math.ceil((stats?.total || 0) / PAGE_SIZE));
  }, [stats]);

  // Use current page for display sections
  const sortedByProminence = useMemo(
    () => [...labels].sort(
      (a, b) => b.artistCount + b.releaseCount - (a.artistCount + a.releaseCount),
    ),
    [labels],
  );

  const spotlight = sortedByProminence[0];
  const compactLabels = sortedByProminence.slice(1, 4);
  const featuredLabels = labels.filter((l) => l.isFeatured);
  const totalArtists = stats?.totalArtists ?? 0;
  const totalReleases = stats?.totalReleases ?? 0;
  const featuredCount = stats?.featuredCount ?? 0;
  const countries = stats?.countries ?? [];
  const totalLabels = stats?.total ?? 0;

  const countryGroups = countries.map((name) => ({
    name,
    count: labels.filter((l) => l.country === name).length,
  }));

  const updateCountry = (next: string) => {
    setCountry(next);
    setPage(1);
  };

  if (loading && labels.length === 0) {
    return (
      <main className="min-h-screen">
        <div className="label43-hero-skel">
          <div className="h-4 w-32 rounded bg-white/10 animate-pulse" />
          <div className="h-16 w-96 rounded bg-white/10 animate-pulse mt-6" />
          <div className="h-5 w-[500px] rounded bg-white/10 animate-pulse mt-4" />
        </div>
        <div className="wk-container-wide px-4 py-10 md:px-6">
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="rounded-xl border border-[var(--wk-border)] bg-[var(--wk-surface)] overflow-hidden">
                <div className="h-32 bg-[var(--wk-surface-raised)] animate-pulse" />
                <div className="p-3 space-y-2">
                  <div className="h-4 w-3/4 rounded bg-[var(--wk-surface-raised)] animate-pulse" />
                  <div className="h-3 w-1/2 rounded bg-[var(--wk-surface-raised)] animate-pulse" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </main>
    );
  }

  if (error && labels.length === 0) {
    return (
      <main className="min-h-screen wk-container px-6 py-20">
        <div className="max-w-2xl mx-auto rounded-2xl border border-[var(--wk-border)] bg-[var(--wk-surface)] p-8 text-center">
          <WkIcon name="Building2" size={42} className="mx-auto mb-4 text-[var(--wk-text-faint)]" />
          <h1 className="wk-h-section mb-2">Could not load labels</h1>
          <p className="text-[var(--wk-text-muted)] mb-6">{error}</p>
          <button onClick={() => loadData()} className="wk-button wk-button-primary">
            <i className="ri-refresh-line" /> Retry
          </button>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[var(--wk-bg)]">

      {/* ═══════════════════════ HERO ═══════════════════════ */}
      <section ref={heroRef} className="label43-hero-v2">
        <div className="label43-hero-overlay" />
        <div className="label43-hero-content">
          <div className="label43-hero-badge">
            <WkIcon name="Building2" size={12} /> Institutions
          </div>
          <h1 className="label43-hero-title">Labels</h1>
          <p className="label43-hero-sub">
            Record labels, imprints, distributors, and music institutions mapped as
            ecosystems — rosters, releases, chart presence, country footprint, and
            catalog relationships.
          </p>
          <div className="label43-hero-row">
            <div className="label43-hero-search-wrap">
              <i className="ri-search-line label43-hero-search-icon" />
              <input
                className="label43-hero-search"
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setPage(1);
                }}
                placeholder="Search labels, countries, or roster artists..."
              />
            </div>
            <ShareButton
              item={{
                title: "WAKILISHA Labels",
                subtitle: `${totalLabels} labels`,
                description:
                  "Browse WAKILISHA labels and music institutions by country, roster, catalog and chart presence.",
                type: "page",
              }}
            />
          </div>
          <div className="label43-hero-stats">
            <div className="label43-hero-stat">
              <span className="label43-hero-stat-val">{totalLabels}</span>
              <span className="label43-hero-stat-lbl">Labels</span>
            </div>
            <div className="label43-hero-stat">
              <span className="label43-hero-stat-val">{totalArtists.toLocaleString()}</span>
              <span className="label43-hero-stat-lbl">Artists</span>
            </div>
            <div className="label43-hero-stat">
              <span className="label43-hero-stat-val">{totalReleases.toLocaleString()}</span>
              <span className="label43-hero-stat-lbl">Releases</span>
            </div>
            <div className="label43-hero-stat">
              <span className="label43-hero-stat-val">{featuredCount}</span>
              <span className="label43-hero-stat-lbl">Featured</span>
            </div>
          </div>
        </div>
        {/* Scroll hint */}
        <div className="label43-hero-scroll-hint">
          <div className="label43-hero-scroll-line" />
        </div>
      </section>

      {/* ═══════════════════════ STICKY NAV ═══════════════════════ */}
      <div className="label43-toolbar-v2">
        <div className="label43-toolbar-inner">
          <span className="label43-toolbar-label">Countries</span>
          <div className="label43-country-pills">
            <button
              onClick={() => updateCountry("All")}
              className={`label43-country-pill ${country === "All" ? "on" : ""}`}
            >
              All
            </button>
            {countries.slice(0, 13).map((item) => (
              <button
                key={item}
                onClick={() => updateCountry(item)}
                className={`label43-country-pill ${country === item ? "on" : ""}`}
              >
                {item}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ═══════════════════════ CONTENT BODY ═══════════════════════ */}
      <div className="label43-body">

        {/* ── Spotlight · asymmetrical (1 large + 3 compact) ── */}
        {spotlight && (
          <section className="label43-reveal">
            <SectionLabel>Spotlight</SectionLabel>
            <div className="label43-asym-grid">
              <Link to={`/labels/${spotlight.slug}`} className="label43-spot-card-v2 group">
                <Chapter19FallbackImage
                  slug={spotlight.slug}
                  name={spotlight.name}
                  className="label43-spot-artwork"
                />
                <div className="label43-spot-gradient" />
                <div className="label43-spot-info">
                  <div className="label43-spot-kicker">Most prominent label</div>
                  <h2 className="label43-spot-title">{spotlight.name}</h2>
                  <div className="label43-spot-meta-row">
                    <span>{spotlight.country || "Global"}</span>
                    <span className="label43-spot-dot" />
                    <span>{spotlight.artistCount} artists</span>
                    <span className="label43-spot-dot" />
                    <span>{spotlight.releaseCount} releases</span>
                  </div>
                  <p className="label43-spot-desc">
                    {spotlight.description ||
                      `${spotlight.name} is represented in the WAKILISHA registry as a label ecosystem with roster, catalog and chart relationships.`}
                  </p>
                </div>
              </Link>
              <div className="label43-compact-stack">
                {compactLabels.map((label, i) => (
                  <Link key={label.slug} to={`/labels/${label.slug}`} className="label43-compact-card group">
                    <div className="label43-compact-artwork-wrap">
                      <Chapter19FallbackImage
                        slug={label.slug}
                        name={label.name}
                        className="label43-compact-artwork"
                      />
                    </div>
                    <div className="label43-compact-body">
                      <div className="label43-compact-rank">#{i + 2}</div>
                      <h4 className="label43-compact-name">{label.name}</h4>
                      <div className="label43-compact-meta">
                        <span>{label.country || "Global"}</span>
                        <span className="label43-compact-dot" />
                        <span>{label.artistCount} artists</span>
                        <span className="label43-compact-dot" />
                        <span>{label.releaseCount} releases</span>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          </section>
        )}

        {/* ── Featured labels · symmetrical grid ── */}
        {featuredLabels.length > 0 && (
          <section className="label43-reveal">
            <SectionLabel count={featuredLabels.length}>Featured institutions</SectionLabel>
            <div className="label43-grid-v2">
              {featuredLabels.slice(0, 8).map((label) => (
                <LabelCard key={label.slug} label={label} />
              ))}
            </div>
          </section>
        )}

        {/* ── Pullquote · visual rhythm break ── */}
        <div className="label43-reveal label43-pullquote">
          <div className="label43-pullquote-inner">
            <div className="label43-pullquote-line" />
            <p className="label43-pullquote-text">
              Labels are not logos. They are systems of influence — rosters,
              catalogs, countries, and chart presence. Every institution carries
              its own character.
            </p>
            <div className="label43-pullquote-line" />
          </div>
        </div>

        {/* ── Country footprint · horizontal carousel ── */}
        {countryGroups.length > 0 && (
          <section className="label43-reveal">
            <SectionLabel count={countryGroups.length}>Country footprint</SectionLabel>
            <CountryCarousel groups={countryGroups} onSelect={updateCountry} />
          </section>
        )}

        {/* ── Full directory · section blocks ── */}
        <section id="label-directory" className="label43-reveal">
          <SectionLabel count={labels.length} href="#label-directory">
            Full directory
          </SectionLabel>

          {/* First row: asymmetrical if we have enough labels */}
          {labels.length >= 4 && page === 1 ? (
            <div className="label43-asym-grid mb-6">
              <LabelCard variant="hero" label={labels[0]} />
              <div className="label43-compact-stack">
                {labels.slice(1, 4).map((label) => (
                  <Link key={label.slug} to={`/labels/${label.slug}`} className="label43-compact-card group">
                    <div className="label43-compact-artwork-wrap">
                      <Chapter19FallbackImage
                        slug={label.slug}
                        name={label.name}
                        className="label43-compact-artwork"
                      />
                    </div>
                    <div className="label43-compact-body">
                      <h4 className="label43-compact-name">{label.name}</h4>
                      <div className="label43-compact-meta">
                        <span>{label.country || "Global"}</span>
                        <span className="label43-compact-dot" />
                        <span>{label.artistCount} artists</span>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          ) : null}

          {/* Remaining grid */}
          <div className="label43-grid-v2">
            {(page === 1 ? labels.slice(labels.length >= 4 ? 4 : 0) : labels).map((label) => (
              <LabelCard key={label.slug} label={label} />
            ))}
          </div>

          {labels.length === 0 && !loading && (
            <div className="label43-empty">
              <WkIcon name="Building2" size={32} />
              <span>No labels match this search.</span>
            </div>
          )}

          {totalPages > 1 && (
            <div className="label43-pagination">
              <button
                className="label43-page-btn"
                disabled={page === 1}
                onClick={() => loadPage(Math.max(1, page - 1))}
              >
                <WkIcon name="ArrowLeft" size={14} />
              </button>
              <span className="label43-page-indicator">
                Page {page} of {totalPages}
              </span>
              <button
                className="label43-page-btn"
                disabled={page === totalPages}
                onClick={() => loadPage(Math.min(totalPages, page + 1))}
              >
                <WkIcon name="ArrowRight" size={14} />
              </button>
            </div>
          )}
        </section>

        {/* ── Footer ── */}
        <footer className="label43-reveal label43-footer">
          <span className="label43-footer-brand">WAKILISHA Registry</span>
          <p className="label43-footer-tagline">
            {totalLabels} labels across {countries.length} countries.
            Every institution mapped as an ecosystem.
          </p>
          <p className="label43-footer-meta">
            {totalArtists.toLocaleString()} artists &middot; {totalReleases.toLocaleString()} releases &middot; {featuredCount} featured
          </p>
        </footer>
      </div>
    </main>
  );
}

/* ── Section label ── */
function SectionLabel({
  children,
  count,
  href,
}: {
  children: string;
  count?: number;
  href?: string;
}) {
  return (
    <div className="label43-section-label-row">
      <div className="label43-section-label-left">
        <span className="label43-section-label-text">{children}</span>
        {count !== undefined && (
          <span className="label43-section-label-count">{count}</span>
        )}
      </div>
      {href && (
        <Link to={href} className="label43-section-label-link">
          View all <i className="ri-arrow-right-line text-[11px]" />
        </Link>
      )}
    </div>
  );
}

/* ── Country carousel ── */
function CountryCarousel({
  groups,
  onSelect,
}: {
  groups: { name: string; count: number }[];
  onSelect: (name: string) => void;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);

  return (
    <div className="label43-carousel-wrap">
      <div
        ref={scrollRef}
        className="label43-carousel"
      >
        {groups.map((group) => (
          <button
            key={group.name}
            onClick={() => onSelect(group.name)}
            className="label43-carousel-card group"
          >
            <div className="label43-carousel-artwork">
              <Chapter19FallbackImage
                slug={`country-${group.name.toLowerCase().replace(/\s+/g, "-")}`}
                name={group.name}
                className="label43-carousel-img"
              />
              <div className="label43-carousel-gradient" />
              <div className="label43-carousel-content">
                <span className="label43-carousel-name">{group.name}</span>
                <span className="label43-carousel-count">
                  {group.count} label{group.count === 1 ? "" : "s"}
                </span>
              </div>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

/* ── Label card · ch19 gradient artwork ── */
function LabelCard({
  label,
  variant = "standard",
}: {
  label: PublicLabel;
  variant?: "standard" | "hero";
}) {
  const roster = (label.featuredArtists || []).slice(0, 5);

  if (variant === "hero") {
    return (
      <Link to={`/labels/${label.slug}`} className="label43-card-hero group">
        <Chapter19FallbackImage
          slug={label.slug}
          name={label.name}
          className="label43-card-hero-artwork"
        />
        <div className="label43-card-hero-overlay" />
        <div className="label43-card-hero-info">
          {label.isFeatured && (
            <span className="label43-card-hero-badge">
              <i className="ri-star-fill text-[9px]" /> Featured
            </span>
          )}
          <h3 className="label43-card-hero-name">{label.name}</h3>
          <div className="label43-card-hero-meta">
            <span>{label.country || "Global"}</span>
            <span className="label43-hero-meta-dot" />
            <span>{label.artistCount} artists</span>
            <span className="label43-hero-meta-dot" />
            <span>{label.releaseCount} releases</span>
          </div>
          {roster.length > 0 && (
            <div className="label43-card-hero-roster">
              {roster.map((artist) => (
                <span key={artist} className="label43-card-hero-roster-tag">
                  {artist}
                </span>
              ))}
            </div>
          )}
        </div>
      </Link>
    );
  }

  return (
    <Link to={`/labels/${label.slug}`} className="label43-card-v2 group">
      <div className="label43-card-artwork-wrap">
        <Chapter19FallbackImage
          slug={label.slug}
          name={label.name}
          className="label43-card-artwork"
        />
        {label.isFeatured && (
          <span className="label43-card-featured-badge">
            <i className="ri-star-fill text-[9px]" /> Featured
          </span>
        )}
        <div className="label43-card-artwork-name">{label.name}</div>
      </div>
      <div className="label43-card-body">
        <div className="label43-card-meta">
          <span className="label43-card-country">
            <i className="ri-map-pin-line text-[10px]" />
            {label.country || "Global"}
          </span>
          <span className="label43-card-dot" />
          <span>{label.releaseCount} releases</span>
        </div>
        <div className="label43-card-stats-row">
          <div className="label43-card-stat-pill">
            <strong>{label.artistCount}</strong>
            <span>Artists</span>
          </div>
          <div className="label43-card-stat-pill">
            <strong>{label.releaseCount}</strong>
            <span>Releases</span>
          </div>
          <div className="label43-card-stat-pill">
            <strong>{roster.length}</strong>
            <span>Roster</span>
          </div>
        </div>
        {roster.length > 0 && (
          <div className="label43-card-roster">
            {roster.map((artist) => (
              <span key={artist} className="label43-card-roster-tag">
                {artist}
              </span>
            ))}
          </div>
        )}
      </div>
    </Link>
  );
}