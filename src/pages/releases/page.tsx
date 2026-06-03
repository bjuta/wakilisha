import { useState, useEffect, useCallback } from "react";
import { Link } from "react-router-dom";
import { AlbumModal } from "@/components/design-system/releases/AlbumModal";
import { ShareButton } from "@/components/design-system/share/ShareSheet";
import { WkIcon } from "@/components/design-system/Icon";
import {
  listReleases,
  listLabels,
  type RepairedRelease,
  type RepairedLabel,
} from "@/services/repairedContent/client";

type Release = RepairedRelease;

export default function Releases() {
  const [filter, setFilter] = useState("All");
  const [modalRelease, setModalRelease] = useState<Release | null>(null);
  const [releases, setReleases] = useState<Release[]>([]);
  const [labels, setLabels] = useState<RepairedLabel[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [releasesData, labelsData] = await Promise.all([
        listReleases(),
        listLabels(),
      ]);
      setReleases(releasesData);
      setLabels(labelsData);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load releases.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const releaseFilters = ["All", ...Array.from(new Set(releases.map((r) => r.releaseType))).filter(Boolean)];
  const filtered =
    filter === "All"
      ? releases
      : releases.filter((release) => release.releaseType === filter);

  const featured = releases[0];
  const featuredRelease = featured
    ? {
        release: featured,
        headline: `The latest from ${featured.artist}`,
        blurb: `${featured.title} is a ${featured.releaseType.toLowerCase()} by ${featured.artist}, released in ${featured.year}. Part of the WAKILISHA catalog.`,
        tag: "Featured release",
        chartTrack: featured.title,
        chartPosition: 1,
        readTime: "4 min",
      }
    : null;

  const newThisWeek = releases.slice(0, 4).map((release) => ({
    release,
    tag: "Just dropped",
    tagColor: "brand" as const,
  }));

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
        return y >= 2026;
      } catch {
        return false;
      }
    }).length,
    chartConnected: Math.min(releases.length, 6),
    labelsRepresented: labels.length,
  };

  if (loading) {
    return (
      <main className="min-h-screen">
        <section className="album41-hero">
          <div className="album41-shade" />
          <div className="album41-inner wk-container-wide">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              <div className="space-y-4">
                <div className="h-4 w-40 rounded bg-[var(--wk-surface-raised)] animate-pulse" />
                <div className="h-12 w-3/4 rounded bg-[var(--wk-surface-raised)] animate-pulse" />
                <div className="h-4 w-1/2 rounded bg-[var(--wk-surface-raised)] animate-pulse" />
                <div className="h-4 w-2/3 rounded bg-[var(--wk-surface-raised)] animate-pulse" />
                <div className="flex gap-3 mt-6">
                  <div className="h-10 w-28 rounded bg-[var(--wk-surface-raised)] animate-pulse" />
                  <div className="h-10 w-28 rounded bg-[var(--wk-surface-raised)] animate-pulse" />
                </div>
              </div>
              <div className="h-64 rounded-xl bg-[var(--wk-surface-raised)] animate-pulse" />
            </div>
          </div>
        </section>
        <div className="wk-container-wide px-4 py-10 md:px-6">
          <div className="h-6 w-48 rounded bg-[var(--wk-surface-raised)] animate-pulse mb-6" />
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="animate-pulse rounded-xl border border-[var(--wk-border)] bg-[var(--wk-surface)] overflow-hidden">
                <div className="aspect-square bg-[var(--wk-surface-raised)]" />
                <div className="p-3 space-y-2">
                  <div className="h-4 w-3/4 rounded bg-[var(--wk-surface-raised)]" />
                  <div className="h-3 w-1/2 rounded bg-[var(--wk-surface-raised)]" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </main>
    );
  }

  if (error) {
    return (
      <main className="min-h-screen wk-container px-6 py-20">
        <div className="max-w-2xl mx-auto rounded-2xl border border-[var(--wk-border)] bg-[var(--wk-surface)] p-8 text-center">
          <WkIcon name="Disc3" size={42} className="mx-auto mb-4 text-[var(--wk-text-faint)]" />
          <h1 className="wk-h-section mb-2">Could not load releases</h1>
          <p className="text-[var(--wk-text-muted)] mb-6">{error}</p>
          <button onClick={loadData} className="wk-button wk-button-primary">
            <i className="ri-refresh-line" /> Retry
          </button>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen">
      <section className="album41-hero">
        {featured && (
          <div className="album41-ambient" style={{ backgroundImage: `url(${featured.artworkUrl})` }} />
        )}
        <div className="album41-shade" />
        <div className="album41-inner wk-container-wide">
          {featured && (
            <>
              <div className="album41-cover">
                <img src={featured.artworkUrl} alt={featured.title} />
              </div>
              <div>
                <div className="album41-kicker">
                  <WkIcon name="Album" size={14} /> Releases catalog
                </div>
                <h1 className="album41-title">Albums & releases</h1>
                <div className="album41-artist">
                  <span>{featuredRelease?.headline}</span>
                </div>
                <p className="album41-desc mt-4 max-w-2xl">{featuredRelease?.blurb}</p>
                <div className="album41-meta">
                  <span>
                    <WkIcon name="Disc3" size={14} /> {catalogStats.total} releases
                  </span>
                  <span>
                    <WkIcon name="BarChart3" size={14} /> {catalogStats.chartConnected} chart-connected
                  </span>
                  <span>
                    <WkIcon name="Building2" size={14} /> {catalogStats.labelsRepresented} labels
                  </span>
                </div>
                <div className="album41-actions">
                  <button onClick={() => setModalRelease(featured)} className="wk-button wk-button-lg wk-button-primary">
                    <WkIcon name="Play" size={18} /> Preview featured
                  </button>
                  <Link to={`/releases/${featured.slug}`} className="wk-button wk-button-lg wk-button-ghost">
                    <WkIcon name="ArrowUpRight" size={18} /> Full page
                  </Link>
                  <ShareButton
                    item={{
                      title: "WAKILISHA Releases",
                      subtitle: `${catalogStats.total} releases`,
                      description: "Browse albums, EPs, singles and compilations in the WAKILISHA catalog.",
                      imageUrl: featured.artworkUrl,
                      type: "album",
                    }}
                  />
                </div>
              </div>
            </>
          )}
        </div>
      </section>

      <div className="wk-container-wide px-4 py-10 md:px-6">
        <div className="chart-stats-strip mb-10">
          <Stat value={catalogStats.thisWeek} label="This week" />
          <Stat value={catalogStats.thisMonth} label="This month" />
          <Stat value={catalogStats.chartConnected} label="On charts" />
          <Stat value={catalogStats.total} label="Catalog" />
        </div>

        <section>
          <div className="section-head">
            <div>
              <div className="section-kicker">New this week</div>
              <h2 className="section-title">Fresh release shelf</h2>
            </div>
            <p className="section-copy">
              Album cards open a rich modal first, then allow full navigation.
            </p>
          </div>
          <div className="flex gap-4 overflow-x-auto pb-2 scrollbar-hide">
            {newThisWeek.map((item) => (
              <ReleaseTile key={item.release.slug} release={item.release} onPreview={setModalRelease} wide />
            ))}
          </div>
        </section>

        <section>
          <div className="section-head">
            <div>
              <div className="section-kicker">Filters</div>
              <h2 className="section-title">Catalog directory</h2>
            </div>
            <div className="directory-filters">
              {releaseFilters.map((item) => (
                <button
                  key={item}
                  onClick={() => setFilter(item)}
                  className={`directory-filter ${filter === item ? "on" : ""}`}
                >
                  {item}
                </button>
              ))}
            </div>
          </div>
          <div className="artist-directory-grid">
            {filtered.map((release) => (
              <ReleaseTile key={release.slug} release={release} onPreview={setModalRelease} />
            ))}
          </div>
          {filtered.length === 0 && (
            <div className="artist-empty">
              <WkIcon name="Disc3" size={32} />
              <div className="mt-3">No releases match this filter.</div>
            </div>
          )}
        </section>

        <section className="pg-layout cols-2 pb-10">
          <div className="pg-block">
            <div className="pg-block-label">Recently added</div>
            <div className="space-y-3">
              {releases.slice(0, 6).map((release) => (
                <button
                  key={release.slug}
                  onClick={() => setModalRelease(release)}
                  className="artist-list-item w-full px-0 text-left"
                >
                  <div className="artist-list-ava artist-list-avatar">
                    <img src={release.artworkUrl} alt="" />
                  </div>
                  <div>
                    <div className="artist-list-name">{release.title}</div>
                    <div className="artist-list-sub">
                      {release.artist} · {release.releaseType}
                    </div>
                  </div>
                  <WkIcon name="ArrowRight" size={16} />
                </button>
              ))}
            </div>
          </div>
          <div className="pg-block">
            <div className="pg-block-label">Data source</div>
            <h3 className="pg-block-title">Releases are now registry-backed.</h3>
            <p className="pg-block-body">
              This page hydrates from the canonical WAKILISHA registry through the V2 API.
            </p>
          </div>
        </section>
      </div>

      <AlbumModal open={Boolean(modalRelease)} release={modalRelease} onClose={() => setModalRelease(null)} />
    </main>
  );
}

function ReleaseTile({
  release,
  onPreview,
  wide = false,
}: {
  release: Release;
  onPreview: (release: Release) => void;
  wide?: boolean;
}) {
  return (
    <div className={`artist-card ${wide ? "w-[240px] shrink-0" : ""}`}>
      <button
        onClick={() => onPreview(release)}
        className="artist-card-img block w-full text-left"
      >
        <img src={release.artworkUrl} alt={release.title} />
      </button>
      <div className="artist-card-body">
        <div className="artist-card-name">{release.title}</div>
        <div className="artist-card-meta">
          {release.artist} · {release.year} · {release.trackCount} tracks
        </div>
        <div className="artist-card-tags">
          <span className="tag tag-sm">{release.releaseType}</span>
          <span className="tag tag-sm">{release.labelName}</span>
        </div>
        <div className="mt-3 flex gap-2">
          <button onClick={() => onPreview(release)} className="wk-button wk-button-sm wk-button-primary">
            <WkIcon name="Eye" size={13} /> Preview
          </button>
          <Link to={`/releases/${release.slug}`} className="wk-button wk-button-sm wk-button-ghost">
            <WkIcon name="ArrowUpRight" size={13} /> Open
          </Link>
        </div>
      </div>
    </div>
  );
}

function Stat({ value, label }: { value: string | number; label: string }) {
  return (
    <div className="chart-stat-card">
      <div className="chart-stat-value">{value}</div>
      <div className="chart-stat-label">{label}</div>
    </div>
  );
}