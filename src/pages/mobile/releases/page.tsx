import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import {
  listReleases,
  listLabels,
  releaseUrl,
  type PublicRelease,
  type PublicLabel,
} from "@/services/publicContent/client";

export default function MobileReleases() {
  const [releases, setReleases] = useState<PublicRelease[]>([]);
  const [labels, setLabels] = useState<PublicLabel[]>([]);
  const [filter, setFilter] = useState("All");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const [releasesData, labelsData] = await Promise.all([
          listReleases(),
          listLabels(),
        ]);
        if (!alive) return;
        setReleases(releasesData);
        setLabels(labelsData);
      } catch (err) {
        if (!alive) return;
        setError(err instanceof Error ? err.message : "Could not load releases.");
      } finally {
        if (alive) setLoading(false);
      }
    };
    load();
    return () => { alive = false; };
  }, []);

  const releaseFilters = ["All", ...Array.from(new Set(releases.map((r) => r.releaseType))).filter(Boolean)];
  const filtered =
    filter === "All" ? releases : releases.filter((r) => r.releaseType === filter);

  const featured = releases[0];
  const newThisWeek = releases.slice(0, 4);

  const catalogStats = {
    total: releases.length,
    thisWeek: releases.filter((r) => {
      try {
        const y = Number(r.year);
        return y >= 2026;
      } catch {
        return false;
      }
    }).length,
    thisMonth: releases.filter((r) => {
      try {
        const y = Number(r.year);
        return y >= 2025;
      } catch {
        return false;
      }
    }).length,
    labelsRepresented: labels.length,
  };

  if (loading) {
    return (
      <div className="min-h-screen">
        <section className="relative min-h-[420px] flex items-end overflow-hidden">
          <div className="absolute inset-0 bg-[var(--wk-surface-raised)] animate-pulse" />
          <div className="relative w-full px-5 pb-8 pt-20 space-y-4">
            <div className="h-4 w-32 rounded bg-[var(--wk-surface)] animate-pulse" />
            <div className="h-10 w-3/4 rounded bg-[var(--wk-surface)] animate-pulse" />
            <div className="h-4 w-1/2 rounded bg-[var(--wk-surface)] animate-pulse" />
          </div>
        </section>
        <div className="px-5 py-6 grid grid-cols-2 gap-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="rounded-xl border border-[var(--wk-border)] bg-[var(--wk-surface)] px-3 py-3 animate-pulse">
              <div className="h-3 w-16 rounded bg-[var(--wk-surface-raised)]" />
              <div className="mt-2 h-6 w-8 rounded bg-[var(--wk-surface-raised)]" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center px-5">
        <div className="text-center">
          <i className="ri-album-line mb-4 block text-4xl text-[var(--wk-text-faint)]" />
          <div className="text-[16px] font-bold text-[var(--wk-text)] mb-2">Could not load releases</div>
          <div className="text-[13px] text-[var(--wk-text-muted)] mb-4">{error}</div>
          <button
            onClick={() => window.location.reload()}
            className="inline-flex items-center gap-2 rounded-full bg-[var(--wk-brand)] px-5 py-2.5 text-[12px] font-bold text-[var(--wk-brand-on)]"
          >
            <i className="ri-refresh-line text-base" />
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      {/* ===== FEATURED HERO ===== */}
      {featured && (
        <section className="relative min-h-[420px] flex items-end overflow-hidden">
          <div
            className="absolute inset-0"
            style={{
              backgroundImage: `url(${featured.artworkUrl})`,
              backgroundSize: "cover",
              backgroundPosition: "center",
            }}
          />
          <div className="absolute inset-0 bg-gradient-to-t from-[var(--wk-bg)] via-[var(--wk-bg)]/80 to-[var(--wk-bg)]/40" />

          <div className="relative w-full px-5 pb-8 pt-20">
            <span className="mb-3 inline-block rounded-full bg-[var(--wk-brand)] px-3 py-1 text-[10px] font-bold text-[var(--wk-brand-on)] uppercase tracking-wider">
              Featured release
            </span>
            <h1
              className="font-black leading-[0.92] tracking-[-0.055em] text-[var(--wk-text)]"
              style={{ fontSize: "clamp(32px, 10vw, 48px)" }}
            >
              {featured.title}
            </h1>
            <div className="mt-3 flex items-center gap-3">
              <div className="h-8 w-8 overflow-hidden rounded-full bg-[var(--wk-surface-raised)]">
                <img
                  src={featured.artworkUrl}
                  alt=""
                  className="h-full w-full object-cover"
                />
              </div>
              <div>
                <div className="text-[13px] font-bold text-[var(--wk-text)]">
                  {featured.artist}
                </div>
                <div className="text-[11px] text-[var(--wk-text-muted)]">
                  {featured.releaseType} · {featured.year}
                </div>
              </div>
            </div>
            <p className="mt-3 text-[13px] leading-relaxed text-[var(--wk-text-soft)]">
              {featured.description || `${featured.title} is a ${featured.releaseType.toLowerCase()} by ${featured.artist}, released in ${featured.year}. Part of the WAKILISHA catalog.`}
            </p>
            <div className="mt-4 flex items-center gap-2">
              <Link
                to={releaseUrl(featured)}
                className="inline-flex items-center gap-2 rounded-full bg-[var(--wk-brand)] px-5 py-2.5 text-[12px] font-bold text-[var(--wk-brand-on)] active:scale-[0.97] transition-transform"
              >
                <i className="ri-play-fill text-base" />
                Listen now
              </Link>
              <Link
                to={releaseUrl(featured)}
                className="inline-flex items-center gap-2 rounded-full border border-[var(--wk-border)] px-5 py-2.5 text-[12px] font-semibold text-[var(--wk-text)] active:scale-[0.97] transition-transform"
              >
                Read review
              </Link>
            </div>
          </div>
        </section>
      )}

      {/* ===== STATS ===== */}
      <div className="px-5 py-6">
        <div className="grid grid-cols-2 gap-2">
          <div className="rounded-xl border border-[var(--wk-border)] bg-[var(--wk-surface)] px-3 py-3">
            <div className="text-[10px] font-semibold uppercase tracking-wider text-[var(--wk-text-muted)]">This week</div>
            <div className="mt-0.5 text-[20px] font-black text-[var(--wk-brand)]">{catalogStats.thisWeek}</div>
          </div>
          <div className="rounded-xl border border-[var(--wk-border)] bg-[var(--wk-surface)] px-3 py-3">
            <div className="text-[10px] font-semibold uppercase tracking-wider text-[var(--wk-text-muted)]">This month</div>
            <div className="mt-0.5 text-[20px] font-black text-[var(--wk-brand)]">{catalogStats.thisMonth}</div>
          </div>
          <div className="rounded-xl border border-[var(--wk-border)] bg-[var(--wk-surface)] px-3 py-3">
            <div className="text-[10px] font-semibold uppercase tracking-wider text-[var(--wk-text-muted)]">Labels</div>
            <div className="mt-0.5 text-[20px] font-black text-[var(--wk-brand)]">{catalogStats.labelsRepresented}</div>
          </div>
        </div>
      </div>

      {/* ===== NEW THIS WEEK ===== */}
      {newThisWeek.length > 0 && (
        <div className="px-5 py-4">
          <div className="mb-3 flex items-center justify-between">
            <div className="text-[10px] font-extrabold uppercase tracking-[0.22em] text-[var(--wk-brand)] flex items-center gap-2">
              <span className="w-5 h-px bg-[var(--wk-brand)]" />
              New this week
            </div>
            <span className="text-[10px] text-[var(--wk-text-muted)]">{newThisWeek.length} new</span>
          </div>
          <div className="flex gap-3 overflow-x-auto pb-2 snap-x snap-mandatory" style={{ scrollbarWidth: "none" }}>
            {newThisWeek.map((release) => (
              <Link
                key={release.slug}
                to={releaseUrl(release)}
                className="group shrink-0 snap-start active:scale-[0.98] active:opacity-80 transition-all"
                style={{ width: "160px" }}
              >
                <div className="relative overflow-hidden rounded-xl border border-[var(--wk-border)] bg-[var(--wk-surface)]">
                  <div className="relative aspect-square bg-[var(--wk-surface-raised)]">
                    <img
                      src={release.artworkUrl}
                      alt={release.title}
                      className="h-full w-full object-cover"
                    />
                    <div className="absolute left-2 top-2">
                      <span className="rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider bg-[var(--wk-brand)] text-[var(--wk-brand-on)]">
                        Just dropped
                      </span>
                    </div>
                  </div>
                  <div className="p-2.5">
                    <h3 className="text-[12px] font-bold text-[var(--wk-text)] truncate">{release.title}</h3>
                    <div className="text-[10px] text-[var(--wk-text-muted)] truncate">{release.artist}</div>
                    <div className="mt-1 flex items-center gap-1.5">
                      <span className="rounded-full bg-[var(--wk-brand-soft)] px-1.5 py-0.5 text-[9px] font-bold text-[var(--wk-brand)] uppercase">
                        {release.releaseType}
                      </span>
                      <span className="text-[9px] text-[var(--wk-text-faint)]">{release.year}</span>
                    </div>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* ===== EDITORIAL PICKS ===== */}
      {releases.length > 0 && (
        <div className="px-5 py-4">
          <div className="mb-3 text-[10px] font-extrabold uppercase tracking-[0.22em] text-[var(--wk-brand)] flex items-center gap-2">
            <span className="w-5 h-px bg-[var(--wk-brand)]" />
            Editorial picks
          </div>
          <div className="space-y-3">
            {releases.slice(1, 5).map((release) => (
              <Link
                key={release.slug}
                to={releaseUrl(release)}
                className="group flex gap-3 rounded-xl border border-[var(--wk-border)] bg-[var(--wk-surface)] p-3 overflow-hidden active:scale-[0.98] active:opacity-80 transition-all"
              >
                <div className="h-20 w-20 shrink-0 overflow-hidden rounded-lg bg-[var(--wk-surface-raised)]">
                  <img
                    src={release.artworkUrl}
                    alt={release.title}
                    className="h-full w-full object-cover"
                  />
                </div>
                <div className="flex flex-1 flex-col min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="text-[13px] font-bold text-[var(--wk-text)]">{release.title}</h3>
                  </div>
                  <div className="text-[11px] text-[var(--wk-text-muted)]">{release.artist}</div>
                  <p className="mt-1 text-[11px] leading-relaxed text-[var(--wk-text-soft)] line-clamp-2">
                    {release.description || `${release.title} is a ${release.releaseType.toLowerCase()} by ${release.artist}, released in ${release.year}.`}
                  </p>
                  <div className="mt-1.5 flex items-center gap-2">
                    <span className="inline-block rounded-full bg-[var(--wk-brand-soft)] px-1.5 py-0.5 text-[9px] font-bold text-[var(--wk-brand)] uppercase">
                      {release.releaseType}
                    </span>
                    <span className="text-[9px] text-[var(--wk-text-faint)]">{release.year}</span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* ===== LABEL SPOTLIGHTS ===== */}
      {labels.length > 0 && (
        <div className="px-5 py-4">
          <div className="mb-3 text-[10px] font-extrabold uppercase tracking-[0.22em] text-[var(--wk-brand)] flex items-center gap-2">
            <span className="w-5 h-px bg-[var(--wk-brand)]" />
            Label spotlight
          </div>
          <div className="space-y-3">
            {labels.slice(0, 3).map((label) => {
              const labelReleases = releases.filter((r) => r.labelName === label.name).slice(0, 3);
              return (
                <div key={label.slug} className="rounded-xl border border-[var(--wk-border)] bg-[var(--wk-surface)] p-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-[14px] font-bold text-[var(--wk-text)]">{label.name}</h3>
                    <span className="text-[11px] text-[var(--wk-text-muted)]">{labelReleases.length} releases</span>
                  </div>
                  <p className="mt-1 text-[12px] text-[var(--wk-text-soft)]">
                    {label.description || `Releases on ${label.name}.`}
                  </p>
                  <div className="mt-3 flex items-center gap-2">
                    {labelReleases.map((r) => (
                      <Link
                        key={r.slug}
                        to={releaseUrl(r)}
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
                  </div>
                  <Link
                    to={`/labels/${label.slug}`}
                    className="mt-2 inline-block text-[12px] font-semibold text-[var(--wk-brand)] active:scale-[0.97] transition-transform"
                  >
                    Explore label →
                  </Link>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ===== EXPLORE CATALOG ===== */}
      <div className="px-5 py-4">
        <div className="mb-3 text-[10px] font-extrabold uppercase tracking-[0.22em] text-[var(--wk-brand)] flex items-center gap-2">
          <span className="w-5 h-px bg-[var(--wk-brand)]" />
          Explore catalog
        </div>
        <div className="flex flex-wrap gap-2 mb-3">
          {releaseFilters.map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`rounded-full px-4 py-2 text-[12px] font-semibold transition-all whitespace-nowrap active:scale-[0.96] ${
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
          {filtered.map((release) => (
            <Link
              key={release.slug}
              to={releaseUrl(release)}
              className="group rounded-xl border border-[var(--wk-border)] bg-[var(--wk-surface)] overflow-hidden active:scale-[0.98] active:opacity-80 transition-all"
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