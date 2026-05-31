import { useState, useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import { WkTag } from "@/components/design-system/primitives/Tag";
import { ReleaseCard } from "@/components/design-system/registry/ReleaseCard";
import { SkeletonSquare } from "@/components/skeletons/Skeletons";
import {
  RELEASES,
  RELEASE_FILTERS,
  FEATURED_RELEASE,
  NEW_THIS_WEEK,
  EDITORIAL_PICKS,
  CHART_CONNECTED_RELEASES,
  LABEL_SPOTLIGHTS,
  CATALOG_STATS,
} from "@/mocks/releases";

export default function Releases() {
  const [filter, setFilter] = useState("All");
  const [loading, setLoading] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const t = setTimeout(() => setLoading(false), 500);
    return () => clearTimeout(t);
  }, []);

  const filtered =
    filter === "All" ? RELEASES : RELEASES.filter((r) => r.releaseType === filter);

  const scrollNew = (dir: "left" | "right") => {
    if (!scrollRef.current) return;
    const amount = dir === "left" ? -340 : 340;
    scrollRef.current.scrollBy({ left: amount, behavior: "smooth" });
  };

  return (
    <div className="min-h-screen">
      {/* ===== FEATURED HERO ===== */}
      <section className="relative min-h-[520px] md:min-h-[620px] flex items-end overflow-hidden">
        <div
          className="absolute inset-0"
          style={{
            backgroundImage: `url(${FEATURED_RELEASE.release.artworkUrl})`,
            backgroundSize: "cover",
            backgroundPosition: "center",
          }}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-[var(--wk-bg)] via-[var(--wk-bg)]/80 to-[var(--wk-bg)]/40" />
        <div className="absolute inset-0 bg-gradient-to-r from-[var(--wk-bg)]/60 via-transparent to-transparent" />

        <div className="relative wk-container-wide w-full px-6 pb-12 pt-20 md:pb-20">
          <div className="flex flex-col gap-8 lg:flex-row lg:items-end lg:gap-12">
            {/* Left: editorial text */}
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-4">
                <span className="rounded-full bg-[var(--wk-brand)] px-3 py-1 text-[11px] font-bold text-[var(--wk-brand-on)] uppercase tracking-wider">
                  {FEATURED_RELEASE.tag}
                </span>
                <span className="text-[12px] text-[var(--wk-text-muted)]">{FEATURED_RELEASE.readTime}</span>
              </div>
              <h1
                className="font-black leading-[0.92] tracking-[-0.055em] text-[var(--wk-text)]"
                style={{ fontSize: "clamp(36px, 5vw, 72px)" }}
              >
                {FEATURED_RELEASE.headline}
              </h1>
              <div className="mt-4 flex items-center gap-3">
                <div className="h-10 w-10 overflow-hidden rounded-full bg-[var(--wk-surface-raised)]">
                  <img
                    src={FEATURED_RELEASE.release.artworkUrl}
                    alt=""
                    className="h-full w-full object-cover"
                  />
                </div>
                <div>
                  <div className="text-[14px] font-bold text-[var(--wk-text)]">
                    {FEATURED_RELEASE.release.title}
                  </div>
                  <div className="text-[12px] text-[var(--wk-text-muted)]">
                    {FEATURED_RELEASE.release.artist} · {FEATURED_RELEASE.release.year}
                  </div>
                </div>
              </div>
              <p className="mt-5 max-w-xl text-[15px] leading-relaxed text-[var(--wk-text-soft)]">
                {FEATURED_RELEASE.blurb}
              </p>
              <div className="mt-6 flex items-center gap-3">
                <Link
                  to={`/releases/${FEATURED_RELEASE.release.slug}`}
                  className="inline-flex items-center gap-2 rounded-full bg-[var(--wk-brand)] px-6 py-3 text-[13px] font-bold text-[var(--wk-brand-on)] transition-all hover:opacity-90"
                >
                  <i className="ri-play-fill text-base" />
                  Listen now
                </Link>
                <Link
                  to={`/releases/${FEATURED_RELEASE.release.slug}`}
                  className="inline-flex items-center gap-2 rounded-full border border-[var(--wk-border)] px-6 py-3 text-[13px] font-semibold text-[var(--wk-text)] transition-all hover:bg-[var(--wk-surface-raised)]"
                >
                  Read review
                </Link>
              </div>
            </div>

            {/* Right: big artwork card */}
            <div className="hidden lg:block shrink-0">
              <Link
                to={`/releases/${FEATURED_RELEASE.release.slug}`}
                className="group relative block overflow-hidden rounded-2xl border border-[var(--wk-border)] shadow-none"
                style={{ width: "280px", height: "280px" }}
              >
                <img
                  src={FEATURED_RELEASE.release.artworkUrl}
                  alt={FEATURED_RELEASE.release.title}
                  className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                />
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-all" />
                <div className="absolute bottom-3 right-3 flex h-10 w-10 items-center justify-center rounded-full bg-[var(--wk-brand)] text-[var(--wk-brand-on)] opacity-0 transition-all group-hover:opacity-100">
                  <i className="ri-play-fill text-lg" />
                </div>
              </Link>
            </div>
          </div>
        </div>
      </section>

      <div className="wk-container-wide px-6 py-12">
        {/* ===== QUICK STATS ===== */}
        {!loading && (
          <div className="mb-12 grid grid-cols-2 gap-3 md:grid-cols-4 lg:grid-cols-5">
            <div className="rounded-xl border border-[var(--wk-border)] bg-[var(--wk-surface)] px-4 py-4">
              <div className="text-[11px] font-semibold uppercase tracking-wider text-[var(--wk-text-muted)]">This week</div>
              <div className="mt-1 text-[22px] font-black text-[var(--wk-brand)]">{CATALOG_STATS.thisWeek}</div>
              <div className="text-[12px] text-[var(--wk-text-faint)]">new release</div>
            </div>
            <div className="rounded-xl border border-[var(--wk-border)] bg-[var(--wk-surface)] px-4 py-4">
              <div className="text-[11px] font-semibold uppercase tracking-wider text-[var(--wk-text-muted)]">This month</div>
              <div className="mt-1 text-[22px] font-black text-[var(--wk-brand)]">{CATALOG_STATS.thisMonth}</div>
              <div className="text-[12px] text-[var(--wk-text-faint)]">new releases</div>
            </div>
            <div className="rounded-xl border border-[var(--wk-border)] bg-[var(--wk-surface)] px-4 py-4">
              <div className="text-[11px] font-semibold uppercase tracking-wider text-[var(--wk-text-muted)]">On the charts</div>
              <div className="mt-1 text-[22px] font-black text-[var(--wk-brand)]">{CATALOG_STATS.chartConnected}</div>
              <div className="text-[12px] text-[var(--wk-text-faint)]">releases connected</div>
            </div>
            <div className="rounded-xl border border-[var(--wk-border)] bg-[var(--wk-surface)] px-4 py-4">
              <div className="text-[11px] font-semibold uppercase tracking-wider text-[var(--wk-text-muted)]">Labels</div>
              <div className="mt-1 text-[22px] font-black text-[var(--wk-brand)]">{CATALOG_STATS.labelsRepresented}</div>
              <div className="text-[12px] text-[var(--wk-text-faint)]">represented</div>
            </div>
            <div className="col-span-2 md:col-span-4 lg:col-span-1 rounded-xl border border-[var(--wk-border)] bg-[var(--wk-surface)] px-4 py-4">
              <div className="text-[11px] font-semibold uppercase tracking-wider text-[var(--wk-text-muted)]">Total catalog</div>
              <div className="mt-1 text-[22px] font-black text-[var(--wk-text)]">{CATALOG_STATS.total}</div>
              <div className="text-[12px] text-[var(--wk-text-faint)]">releases</div>
            </div>
          </div>
        )}

        {/* ===== NEW THIS WEEK ===== */}
        <div className="mb-14">
          <div className="mb-5 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="wk-eyebrow">New this week</div>
              <span className="rounded-full bg-[var(--wk-brand)] px-2 py-0.5 text-[10px] font-bold text-[var(--wk-brand-on)]">
                {NEW_THIS_WEEK.length}
              </span>
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={() => scrollNew("left")}
                className="flex h-8 w-8 items-center justify-center rounded-full border border-[var(--wk-border)] text-[var(--wk-text-muted)] transition-all hover:bg-[var(--wk-surface-raised)] hover:text-[var(--wk-text)]"
              >
                <i className="ri-arrow-left-line text-sm" />
              </button>
              <button
                onClick={() => scrollNew("right")}
                className="flex h-8 w-8 items-center justify-center rounded-full border border-[var(--wk-border)] text-[var(--wk-text-muted)] transition-all hover:bg-[var(--wk-surface-raised)] hover:text-[var(--wk-text)]"
              >
                <i className="ri-arrow-right-line text-sm" />
              </button>
            </div>
          </div>
          <div
            ref={scrollRef}
            className="flex gap-4 overflow-x-auto pb-2 scrollbar-hide"
            style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
          >
            {NEW_THIS_WEEK.map((item) => (
              <Link
                key={item.release.slug}
                to={`/releases/${item.release.slug}`}
                className="group shrink-0"
                style={{ width: "240px" }}
              >
                <div className="relative overflow-hidden rounded-xl border border-[var(--wk-border)] bg-[var(--wk-surface)]">
                  <div className="relative aspect-square bg-[var(--wk-surface-raised)]">
                    <img
                      src={item.release.artworkUrl}
                      alt={item.release.title}
                      className="h-full w-full object-cover object-top transition-transform duration-500 group-hover:scale-105"
                    />
                    {item.tag && (
                      <div className="absolute left-3 top-3">
                        <span
                          className={`rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider ${
                            item.tagColor === "brand"
                              ? "bg-[var(--wk-brand)] text-[var(--wk-brand-on)]"
                              : "bg-black/60 text-white"
                          }`}
                        >
                          {item.tag}
                        </span>
                      </div>
                    )}
                    <div className="absolute inset-0 flex items-center justify-center opacity-0 transition-all group-hover:opacity-100">
                      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[var(--wk-brand)] text-[var(--wk-brand-on)]">
                        <i className="ri-play-fill text-xl" />
                      </div>
                    </div>
                  </div>
                  <div className="p-3">
                    <h3 className="truncate text-[14px] font-bold text-[var(--wk-text)]">{item.release.title}</h3>
                    <div className="truncate text-[12px] text-[var(--wk-text-muted)]">{item.release.artist}</div>
                    <div className="mt-1.5 flex items-center gap-2">
                      <span className="rounded-full bg-[var(--wk-brand-soft)] px-2 py-0.5 text-[10px] font-bold text-[var(--wk-brand)] uppercase">
                        {item.release.releaseType}
                      </span>
                      <span className="text-[11px] text-[var(--wk-text-faint)]">{item.release.year}</span>
                    </div>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>

        {/* ===== CHART-CONNECTED ===== */}
        <div className="mb-14">
          <div className="mb-5 flex items-center justify-between">
            <div className="wk-eyebrow">On the charts right now</div>
            <Link
              to="/charts"
              className="text-[13px] font-semibold text-[var(--wk-brand)] transition-all hover:underline"
            >
              View charts →
            </Link>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {CHART_CONNECTED_RELEASES.map((item) => (
              <Link
                key={item.release.slug}
                to={`/releases/${item.release.slug}`}
                className="group flex items-center gap-4 rounded-xl border border-[var(--wk-border)] bg-[var(--wk-surface)] p-4 transition-all hover:border-[var(--wk-border-2)]"
              >
                <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-lg bg-[var(--wk-surface-raised)]">
                  <img
                    src={item.release.artworkUrl}
                    alt={item.release.title}
                    className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                  />
                </div>
                <div className="min-w-0 flex-1">
                  <h3 className="truncate text-[14px] font-bold text-[var(--wk-text)]">{item.release.title}</h3>
                  <div className="text-[12px] text-[var(--wk-text-muted)]">{item.release.artist}</div>
                  <div className="mt-1.5 flex flex-wrap items-center gap-2">
                    {item.chartTracks.map((track, i) => (
                      <span
                        key={track}
                        className="inline-flex items-center gap-1 rounded-full bg-[var(--wk-brand-soft)] px-2 py-0.5 text-[10px] font-bold text-[var(--wk-brand)]"
                      >
                        <i className="ri-bar-chart-line text-[10px]" />
                        #{item.positions[i]} {track}
                      </span>
                    ))}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>

        {/* ===== EDITORIAL PICKS ===== */}
        <div className="mb-14">
          <div className="mb-5">
            <div className="wk-eyebrow">Editorial picks</div>
            <p className="mt-1 text-[13px] text-[var(--wk-text-muted)]">
              Releases our editors think you should hear
            </p>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {EDITORIAL_PICKS.map((pick) => (
              <Link
                key={pick.release.slug}
                to={`/releases/${pick.release.slug}`}
                className="group flex flex-col rounded-xl border border-[var(--wk-border)] bg-[var(--wk-surface)] overflow-hidden transition-all hover:border-[var(--wk-border-2)]"
              >
                <div className="relative aspect-square bg-[var(--wk-surface-raised)]">
                  <img
                    src={pick.release.artworkUrl}
                    alt={pick.release.title}
                    className="h-full w-full object-cover object-top transition-transform duration-500 group-hover:scale-105"
                  />
                  <div className="absolute left-3 top-3">
                    <span className="rounded-full bg-black/70 px-2.5 py-1 text-[10px] font-bold text-white uppercase tracking-wider">
                      {pick.pickType}
                    </span>
                  </div>
                </div>
                <div className="flex flex-1 flex-col p-4">
                  <h3 className="text-[14px] font-bold text-[var(--wk-text)]">{pick.release.title}</h3>
                  <div className="text-[12px] text-[var(--wk-text-muted)]">{pick.release.artist}</div>
                  <p className="mt-2 flex-1 text-[13px] leading-relaxed text-[var(--wk-text-soft)]">
                    {pick.blurb}
                  </p>
                  <div className="mt-3 flex items-center gap-2 text-[11px] text-[var(--wk-text-faint)]">
                    <span className="rounded-full bg-[var(--wk-brand-soft)] px-2 py-0.5 text-[10px] font-bold text-[var(--wk-brand)] uppercase">
                      {pick.release.releaseType}
                    </span>
                    <span>{pick.release.year}</span>
                    {pick.release.trackCount && <span>{pick.release.trackCount} tracks</span>}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>

        {/* ===== LABEL SPOTLIGHTS ===== */}
        <div className="mb-14">
          <div className="mb-5">
            <div className="wk-eyebrow">Label spotlight</div>
            <p className="mt-1 text-[13px] text-[var(--wk-text-muted)]">
              The labels shaping the sound
            </p>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {LABEL_SPOTLIGHTS.map((spot) => (
              <div
                key={spot.label}
                className="rounded-xl border border-[var(--wk-border)] bg-[var(--wk-surface)] p-5 transition-all hover:border-[var(--wk-border-2)]"
              >
                <div className="flex items-center justify-between">
                  <h3 className="text-[16px] font-bold text-[var(--wk-text)]">{spot.label}</h3>
                  <span className="text-[12px] text-[var(--wk-text-muted)]">{spot.totalReleases} releases</span>
                </div>
                <p className="mt-1 text-[13px] text-[var(--wk-text-soft)]">{spot.description}</p>
                <div className="mt-4 flex items-center gap-3">
                  {spot.releases.slice(0, 3).map((r) => (
                    <Link
                      key={r.slug}
                      to={`/releases/${r.slug}`}
                      className="group relative shrink-0 overflow-hidden rounded-lg"
                      style={{ width: "56px", height: "56px" }}
                      title={`${r.title} — ${r.artist}`}
                    >
                      <img
                        src={r.artworkUrl}
                        alt={r.title}
                        className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-110"
                      />
                    </Link>
                  ))}
                  {spot.releases.length > 3 && (
                    <span className="text-[12px] text-[var(--wk-text-muted)]">+{spot.releases.length - 3}</span>
                  )}
                </div>
                <Link
                  to={`/labels/${spot.slug}`}
                  className="mt-4 inline-block text-[13px] font-semibold text-[var(--wk-brand)] transition-all hover:underline"
                >
                  Explore label →
                </Link>
              </div>
            ))}
          </div>
        </div>

        {/* ===== EXPLORE THE CATALOG ===== */}
        <div className="mb-6">
          <div className="mb-5 flex items-center justify-between">
            <div>
              <div className="wk-eyebrow">Explore the catalog</div>
              <p className="mt-1 text-[13px] text-[var(--wk-text-muted)]">
                Every release in the repaired graph
              </p>
            </div>
          </div>

          <div className="mb-6 flex flex-wrap gap-2">
            {RELEASE_FILTERS.map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`rounded-full px-4 py-2 text-[13px] font-semibold transition-all whitespace-nowrap ${
                  filter === f
                    ? "bg-[var(--wk-brand)] text-[var(--wk-brand-on)]"
                    : "border border-[var(--wk-border)] text-[var(--wk-text-soft)] hover:bg-[var(--wk-surface-raised)]"
                }`}
              >
                {f}
              </button>
            ))}
          </div>

          <div className="mb-4 text-[13px] text-[var(--wk-text-muted)]">
            {filtered.length} release{filtered.length !== 1 ? "s" : ""}
          </div>

          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
            {loading
              ? Array.from({ length: 8 }).map((_, i) => <SkeletonSquare key={i} />)
              : filtered.map((release) => (
                  <ReleaseCard key={release.slug} {...release} />
                ))}
          </div>
        </div>
      </div>
    </div>
  );
}