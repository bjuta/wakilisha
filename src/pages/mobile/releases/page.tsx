import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
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

export default function MobileReleases() {
  const [filter, setFilter] = useState("All");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const t = setTimeout(() => setLoading(false), 500);
    return () => clearTimeout(t);
  }, []);

  const filtered =
    filter === "All" ? RELEASES : RELEASES.filter((r) => r.releaseType === filter);

  return (
    <div className="min-h-screen">
      {/* ===== FEATURED HERO ===== */}
      <section className="relative min-h-[420px] flex items-end overflow-hidden">
        <div
          className="absolute inset-0"
          style={{
            backgroundImage: `url(${FEATURED_RELEASE.release.artworkUrl})`,
            backgroundSize: "cover",
            backgroundPosition: "center",
          }}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-[var(--wk-bg)] via-[var(--wk-bg)]/80 to-[var(--wk-bg)]/40" />

        <div className="relative w-full px-5 pb-8 pt-20">
          <span className="mb-3 inline-block rounded-full bg-[var(--wk-brand)] px-3 py-1 text-[10px] font-bold text-[var(--wk-brand-on)] uppercase tracking-wider">
            {FEATURED_RELEASE.tag}
          </span>
          <h1
            className="font-black leading-[0.92] tracking-[-0.055em] text-[var(--wk-text)]"
            style={{ fontSize: "clamp(32px, 10vw, 48px)" }}
          >
            {FEATURED_RELEASE.headline}
          </h1>
          <div className="mt-3 flex items-center gap-3">
            <div className="h-8 w-8 overflow-hidden rounded-full bg-[var(--wk-surface-raised)]">
              <img
                src={FEATURED_RELEASE.release.artworkUrl}
                alt=""
                className="h-full w-full object-cover"
              />
            </div>
            <div>
              <div className="text-[13px] font-bold text-[var(--wk-text)]">
                {FEATURED_RELEASE.release.title}
              </div>
              <div className="text-[11px] text-[var(--wk-text-muted)]">
                {FEATURED_RELEASE.release.artist}
              </div>
            </div>
          </div>
          <p className="mt-3 text-[13px] leading-relaxed text-[var(--wk-text-soft)]">
            {FEATURED_RELEASE.blurb}
          </p>
          <div className="mt-4 flex items-center gap-2">
            <Link
              to={`/releases/${FEATURED_RELEASE.release.slug}`}
              className="inline-flex items-center gap-2 rounded-full bg-[var(--wk-brand)] px-5 py-2.5 text-[12px] font-bold text-[var(--wk-brand-on)]"
            >
              <i className="ri-play-fill text-base" />
              Listen now
            </Link>
            <Link
              to={`/releases/${FEATURED_RELEASE.release.slug}`}
              className="inline-flex items-center gap-2 rounded-full border border-[var(--wk-border)] px-5 py-2.5 text-[12px] font-semibold text-[var(--wk-text)]"
            >
              Read review
            </Link>
          </div>
        </div>
      </section>

      {/* ===== STATS ===== */}
      {!loading && (
        <div className="px-5 py-6">
          <div className="grid grid-cols-2 gap-2">
            <div className="rounded-xl border border-[var(--wk-border)] bg-[var(--wk-surface)] px-3 py-3">
              <div className="text-[10px] font-semibold uppercase tracking-wider text-[var(--wk-text-muted)]">This week</div>
              <div className="mt-0.5 text-[20px] font-black text-[var(--wk-brand)]">{CATALOG_STATS.thisWeek}</div>
            </div>
            <div className="rounded-xl border border-[var(--wk-border)] bg-[var(--wk-surface)] px-3 py-3">
              <div className="text-[10px] font-semibold uppercase tracking-wider text-[var(--wk-text-muted)]">This month</div>
              <div className="mt-0.5 text-[20px] font-black text-[var(--wk-brand)]">{CATALOG_STATS.thisMonth}</div>
            </div>
            <div className="rounded-xl border border-[var(--wk-border)] bg-[var(--wk-surface)] px-3 py-3">
              <div className="text-[10px] font-semibold uppercase tracking-wider text-[var(--wk-text-muted)]">On charts</div>
              <div className="mt-0.5 text-[20px] font-black text-[var(--wk-brand)]">{CATALOG_STATS.chartConnected}</div>
            </div>
            <div className="rounded-xl border border-[var(--wk-border)] bg-[var(--wk-surface)] px-3 py-3">
              <div className="text-[10px] font-semibold uppercase tracking-wider text-[var(--wk-text-muted)]">Labels</div>
              <div className="mt-0.5 text-[20px] font-black text-[var(--wk-brand)]">{CATALOG_STATS.labelsRepresented}</div>
            </div>
          </div>
        </div>
      )}

      {/* ===== NEW THIS WEEK ===== */}
      <div className="px-5 py-4">
        <div className="mb-3 flex items-center justify-between">
          <div className="text-[10px] font-extrabold uppercase tracking-[0.22em] text-[var(--wk-brand)] flex items-center gap-2">
            <span className="w-5 h-px bg-[var(--wk-brand)]" />
            New this week
          </div>
          <span className="text-[10px] text-[var(--wk-text-muted)]">{NEW_THIS_WEEK.length} new</span>
        </div>
        <div className="flex gap-3 overflow-x-auto pb-2" style={{ scrollbarWidth: "none" }}>
          {NEW_THIS_WEEK.map((item) => (
            <Link
              key={item.release.slug}
              to={`/releases/${item.release.slug}`}
              className="group shrink-0"
              style={{ width: "160px" }}
            >
              <div className="relative overflow-hidden rounded-xl border border-[var(--wk-border)] bg-[var(--wk-surface)]">
                <div className="relative aspect-square bg-[var(--wk-surface-raised)]">
                  <img
                    src={item.release.artworkUrl}
                    alt={item.release.title}
                    className="h-full w-full object-cover"
                  />
                  {item.tag && (
                    <div className="absolute left-2 top-2">
                      <span
                        className={`rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider ${
                          item.tagColor === "brand"
                            ? "bg-[var(--wk-brand)] text-[var(--wk-brand-on)]"
                            : "bg-black/60 text-white"
                        }`}
                      >
                        {item.tag}
                      </span>
                    </div>
                  )}
                </div>
                <div className="p-2.5">
                  <h3 className="text-[12px] font-bold text-[var(--wk-text)] truncate">{item.release.title}</h3>
                  <div className="text-[10px] text-[var(--wk-text-muted)] truncate">{item.release.artist}</div>
                  <div className="mt-1 flex items-center gap-1.5">
                    <span className="rounded-full bg-[var(--wk-brand-soft)] px-1.5 py-0.5 text-[9px] font-bold text-[var(--wk-brand)] uppercase">
                      {item.release.releaseType}
                    </span>
                    <span className="text-[9px] text-[var(--wk-text-faint)]">{item.release.year}</span>
                  </div>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>

      {/* ===== CHART-CONNECTED ===== */}
      <div className="px-5 py-4">
        <div className="mb-3 flex items-center justify-between">
          <div className="text-[10px] font-extrabold uppercase tracking-[0.22em] text-[var(--wk-brand)] flex items-center gap-2">
            <span className="w-5 h-px bg-[var(--wk-brand)]" />
            On the charts
          </div>
          <Link to="/charts" className="text-[11px] font-semibold text-[var(--wk-brand)]">
            View charts →
          </Link>
        </div>
        <div className="space-y-2">
          {CHART_CONNECTED_RELEASES.map((item) => (
            <Link
              key={item.release.slug}
              to={`/releases/${item.release.slug}`}
              className="group flex items-center gap-3 rounded-xl border border-[var(--wk-border)] bg-[var(--wk-surface)] p-3"
            >
              <div className="h-14 w-14 shrink-0 overflow-hidden rounded-lg bg-[var(--wk-surface-raised)]">
                <img
                  src={item.release.artworkUrl}
                  alt={item.release.title}
                  className="h-full w-full object-cover"
                />
              </div>
              <div className="min-w-0 flex-1">
                <h3 className="text-[13px] font-bold text-[var(--wk-text)]">{item.release.title}</h3>
                <div className="text-[11px] text-[var(--wk-text-muted)]">{item.release.artist}</div>
                <div className="mt-1 flex flex-wrap items-center gap-1.5">
                  {item.chartTracks.map((track, i) => (
                    <span
                      key={track}
                      className="inline-flex items-center gap-1 rounded-full bg-[var(--wk-brand-soft)] px-2 py-0.5 text-[9px] font-bold text-[var(--wk-brand)]"
                    >
                      <i className="ri-bar-chart-line text-[9px]" />
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
      <div className="px-5 py-4">
        <div className="mb-3 text-[10px] font-extrabold uppercase tracking-[0.22em] text-[var(--wk-brand)] flex items-center gap-2">
          <span className="w-5 h-px bg-[var(--wk-brand)]" />
          Editorial picks
        </div>
        <div className="space-y-3">
          {EDITORIAL_PICKS.map((pick) => (
            <Link
              key={pick.release.slug}
              to={`/releases/${pick.release.slug}`}
              className="group flex gap-3 rounded-xl border border-[var(--wk-border)] bg-[var(--wk-surface)] p-3 overflow-hidden"
            >
              <div className="h-20 w-20 shrink-0 overflow-hidden rounded-lg bg-[var(--wk-surface-raised)]">
                <img
                  src={pick.release.artworkUrl}
                  alt={pick.release.title}
                  className="h-full w-full object-cover"
                />
              </div>
              <div className="flex flex-1 flex-col min-w-0">
                <div className="flex items-center gap-2">
                  <h3 className="text-[13px] font-bold text-[var(--wk-text)]">{pick.release.title}</h3>
                </div>
                <div className="text-[11px] text-[var(--wk-text-muted)]">{pick.release.artist}</div>
                <p className="mt-1 text-[11px] leading-relaxed text-[var(--wk-text-soft)] line-clamp-2">
                  {pick.blurb}
                </p>
                <div className="mt-1.5 flex items-center gap-2">
                  <span className="inline-block rounded-full bg-[var(--wk-brand-soft)] px-1.5 py-0.5 text-[9px] font-bold text-[var(--wk-brand)] uppercase">
                    {pick.pickType}
                  </span>
                  <span className="text-[9px] text-[var(--wk-text-faint)]">{pick.release.year}</span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>

      {/* ===== LABEL SPOTLIGHTS ===== */}
      <div className="px-5 py-4">
        <div className="mb-3 text-[10px] font-extrabold uppercase tracking-[0.22em] text-[var(--wk-brand)] flex items-center gap-2">
          <span className="w-5 h-px bg-[var(--wk-brand)]" />
          Label spotlight
        </div>
        <div className="space-y-3">
          {LABEL_SPOTLIGHTS.map((spot) => (
            <div key={spot.label} className="rounded-xl border border-[var(--wk-border)] bg-[var(--wk-surface)] p-4">
              <div className="flex items-center justify-between">
                <h3 className="text-[14px] font-bold text-[var(--wk-text)]">{spot.label}</h3>
                <span className="text-[11px] text-[var(--wk-text-muted)]">{spot.totalReleases}</span>
              </div>
              <p className="mt-1 text-[12px] text-[var(--wk-text-soft)]">{spot.description}</p>
              <div className="mt-3 flex items-center gap-2">
                {spot.releases.slice(0, 3).map((r) => (
                  <Link
                    key={r.slug}
                    to={`/releases/${r.slug}`}
                    className="relative shrink-0 overflow-hidden rounded-md"
                    style={{ width: "44px", height: "44px" }}
                  >
                    <img
                      src={r.artworkUrl}
                      alt={r.title}
                      className="h-full w-full object-cover"
                    />
                  </Link>
                ))}
                {spot.releases.length > 3 && (
                  <span className="text-[11px] text-[var(--wk-text-muted)]">+{spot.releases.length - 3}</span>
                )}
              </div>
              <Link
                to={`/labels/${spot.slug}`}
                className="mt-2 inline-block text-[12px] font-semibold text-[var(--wk-brand)]"
              >
                Explore label →
              </Link>
            </div>
          ))}
        </div>
      </div>

      {/* ===== EXPLORE CATALOG ===== */}
      <div className="px-5 py-4">
        <div className="mb-3 text-[10px] font-extrabold uppercase tracking-[0.22em] text-[var(--wk-brand)] flex items-center gap-2">
          <span className="w-5 h-px bg-[var(--wk-brand)]" />
          Explore catalog
        </div>
        <div className="flex flex-wrap gap-2 mb-3">
          {RELEASE_FILTERS.map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`rounded-full px-4 py-2 text-[12px] font-semibold transition-all whitespace-nowrap ${
                filter === f
                  ? "bg-[var(--wk-brand)] text-[var(--wk-brand-on)]"
                  : "border border-[var(--wk-border)] text-[var(--wk-text-soft)] hover:bg-[var(--wk-surface-raised)]"
              }`}
            >
              {f}
            </button>
          ))}
        </div>
        <div className="mb-3 text-[12px] text-[var(--wk-text-muted)]">
          {filtered.length} release{filtered.length !== 1 ? "s" : ""}
        </div>
        <div className="grid grid-cols-2 gap-3">
          {loading
            ? Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="animate-pulse rounded-xl border border-[var(--wk-border)] bg-[var(--wk-surface)] overflow-hidden">
                  <div className="aspect-square bg-[var(--wk-surface-raised)]" />
                  <div className="p-3 space-y-2">
                    <div className="h-4 w-3/4 rounded bg-[var(--wk-surface-raised)]" />
                    <div className="h-3 w-1/2 rounded bg-[var(--wk-surface-raised)]" />
                  </div>
                </div>
              ))
            : filtered.map((release) => (
                <Link
                  key={release.slug}
                  to={`/releases/${release.slug}`}
                  className="group rounded-xl border border-[var(--wk-border)] bg-[var(--wk-surface)] overflow-hidden"
                >
                  <div className="relative aspect-square bg-[var(--wk-surface-raised)]">
                    <img
                      src={release.artworkUrl}
                      alt={release.title}
                      className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                    />
                  </div>
                  <div className="p-3">
                    <h3 className="text-[13px] font-bold text-[var(--wk-text)] truncate">{release.title}</h3>
                    <div className="text-[11px] text-[var(--wk-text-muted)] truncate">{release.artist}</div>
                    <div className="mt-2 flex items-center gap-2">
                      <span className="rounded-full bg-[var(--wk-brand-soft)] px-2 py-0.5 text-[9px] font-bold text-[var(--wk-brand)] uppercase">{release.releaseType}</span>
                      <span className="text-[10px] text-[var(--wk-text-faint)]">{release.year}</span>
                    </div>
                  </div>
                </Link>
              ))}
        </div>
      </div>
    </div>
  );
}