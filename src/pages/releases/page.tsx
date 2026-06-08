import { useState, useEffect, useCallback, useMemo } from "react";
import { Link } from "react-router-dom";
import { AlbumModal } from "@/components/design-system/releases/AlbumModal";
import { ShareButton } from "@/components/design-system/share/ShareSheet";
import { WkIcon } from "@/components/design-system/Icon";
import {
  listReleases,
  listLabels,
  releaseUrl,
  type RepairedRelease,
  type RepairedLabel,
} from "@/services/repairedContent/client";

type Release = RepairedRelease;
type SortKey = "newest" | "updated" | "artist" | "title";

const ALL = "All";

export default function Releases() {
  const [typeFilter, setTypeFilter] = useState(ALL);
  const [yearFilter, setYearFilter] = useState(ALL);
  const [artistFilter, setArtistFilter] = useState(ALL);
  const [query, setQuery] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("newest");
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

  const releaseTypes = useMemo(() => [ALL, ...uniqueSorted(releases.map((r) => r.releaseType).filter(Boolean))], [releases]);
  const releaseYears = useMemo(() => [ALL, ...uniqueSorted(releases.map((r) => yearValue(r.year)).filter(Boolean)).sort((a, b) => Number(b) - Number(a))], [releases]);
  const releaseArtists = useMemo(() => [ALL, ...uniqueSorted(releases.map((r) => r.artist).filter(Boolean)).slice(0, 24)], [releases]);

  const filtered = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return [...releases]
      .filter((release) => typeFilter === ALL || release.releaseType === typeFilter)
      .filter((release) => yearFilter === ALL || yearValue(release.year) === yearFilter)
      .filter((release) => artistFilter === ALL || release.artist === artistFilter)
      .filter((release) => {
        if (!normalizedQuery) return true;
        return [release.title, release.artist, release.labelName, release.releaseType, release.year]
          .filter(Boolean)
          .join(" ")
          .toLowerCase()
          .includes(normalizedQuery);
      })
      .sort((a, b) => sortReleases(a, b, sortKey));
  }, [artistFilter, query, releases, sortKey, typeFilter, yearFilter]);

  const featured = filtered[0] || releases[0];
  const recentlyAdded = [...releases].sort((a, b) => sortReleases(a, b, "newest")).slice(0, 6);
  const freshShelf = filtered.slice(0, 8).map((release) => ({ release }));

  const catalogStats = {
    total: releases.length,
    visible: filtered.length,
    albums: releases.filter((r) => r.releaseType.toLowerCase() === "album").length,
    eps: releases.filter((r) => r.releaseType.toLowerCase() === "ep").length,
    labelsRepresented: labels.length,
  };

  if (loading) {
    return (
      <main className="min-h-screen bg-[var(--wk-bg)]">
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
      <main className="min-h-screen wk-container px-6 py-20 bg-[var(--wk-bg)]">
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
    <main className="min-h-screen bg-[var(--wk-bg)]">
      <section className="album41-hero">
        {featured && <HeroAmbient release={featured} />}
        <div className="album41-shade" />
        <div className="album41-inner wk-container-wide">
          {featured && (
            <>
              <div className="album41-cover bg-[var(--wk-surface)] border border-[var(--wk-border)]">
                <ReleaseArtwork release={featured} />
              </div>
              <div>
                <div className="album41-kicker">
                  <WkIcon name="Album" size={14} /> Releases catalog
                </div>
                <h1 className="album41-title">Albums & releases</h1>
                <div className="album41-artist">
                  <span>{featured.title}</span>
                </div>
                <p className="album41-desc mt-4 max-w-2xl">
                  Browse registry-backed albums, EPs and singles across the WAKILISHA catalog. Filter by artist, year or format, then open the canonical release page.
                </p>
                <div className="album41-meta">
                  <span>
                    <WkIcon name="Disc3" size={14} /> {catalogStats.total} releases
                  </span>
                  <span>
                    <WkIcon name="ListFilter" size={14} /> {catalogStats.visible} visible
                  </span>
                  <span>
                    <WkIcon name="Building2" size={14} /> {catalogStats.labelsRepresented} labels
                  </span>
                </div>
                <div className="album41-actions">
                  <button onClick={() => setModalRelease(featured)} className="wk-button wk-button-lg wk-button-primary">
                    <WkIcon name="Eye" size={18} /> Preview featured
                  </button>
                  <Link to={releaseUrl(featured)} className="wk-button wk-button-lg wk-button-ghost">
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
          <Stat value={catalogStats.total} label="Catalog" />
          <Stat value={catalogStats.visible} label="Visible" />
          <Stat value={catalogStats.albums} label="Albums" />
          <Stat value={catalogStats.eps} label="EPs" />
        </div>

        <section className="mb-10 rounded-2xl border border-[var(--wk-border)] bg-[var(--wk-surface)] p-4 md:p-5">
          <div className="section-head !mb-4">
            <div>
              <div className="section-kicker">Discovery controls</div>
              <h2 className="section-title">Find releases faster</h2>
            </div>
            <p className="section-copy">Filters stay within the design system and only operate on public, ready release shells.</p>
          </div>
          <div className="grid gap-3 md:grid-cols-[minmax(0,1.4fr)_repeat(3,minmax(0,0.8fr))]">
            <label className="block">
              <span className="sr-only">Search releases</span>
              <div className="flex items-center gap-2 rounded-xl border border-[var(--wk-border)] bg-[var(--wk-bg)] px-3 py-2.5">
                <WkIcon name="Search" size={15} className="text-[var(--wk-text-faint)]" />
                <input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Search title, artist, label…"
                  className="w-full bg-transparent text-[14px] font-semibold text-[var(--wk-text)] outline-none placeholder:text-[var(--wk-text-faint)]"
                />
              </div>
            </label>
            <FilterSelect label="Type" value={typeFilter} options={releaseTypes} onChange={setTypeFilter} />
            <FilterSelect label="Year" value={yearFilter} options={releaseYears} onChange={setYearFilter} />
            <FilterSelect label="Sort" value={sortKey} options={["newest", "updated", "artist", "title"]} onChange={(value) => setSortKey(value as SortKey)} />
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            {releaseArtists.map((artist) => (
              <button
                key={artist}
                onClick={() => setArtistFilter(artist)}
                className={`directory-filter ${artistFilter === artist ? "on" : ""}`}
              >
                {artist}
              </button>
            ))}
          </div>
        </section>

        <section className="mb-12">
          <div className="section-head">
            <div>
              <div className="section-kicker">Curated shelf</div>
              <h2 className="section-title">Release shelf</h2>
            </div>
            <p className="section-copy">The first row reflects your current filters and sort order.</p>
          </div>
          <div className="flex gap-4 overflow-x-auto pb-2 scrollbar-hide">
            {freshShelf.slice(0, 8).map((item) => (
              <ReleaseTile key={`${item.release.artist}-${item.release.slug}`} release={item.release} onPreview={setModalRelease} wide />
            ))}
          </div>
        </section>

        <section>
          <div className="section-head">
            <div>
              <div className="section-kicker">Directory</div>
              <h2 className="section-title">Catalog directory</h2>
            </div>
            <p className="section-copy">
              Showing {filtered.length} of {releases.length} registry-backed releases.
            </p>
          </div>
          <div className="artist-directory-grid">
            {filtered.map((release) => (
              <ReleaseTile key={`${release.artist}-${release.slug}`} release={release} onPreview={setModalRelease} />
            ))}
          </div>
          {filtered.length === 0 && (
            <div className="artist-empty">
              <WkIcon name="Disc3" size={32} />
              <div className="mt-3">No releases match these filters.</div>
              <button
                onClick={() => {
                  setQuery("");
                  setTypeFilter(ALL);
                  setYearFilter(ALL);
                  setArtistFilter(ALL);
                  setSortKey("newest");
                }}
                className="wk-button wk-button-sm wk-button-ghost mt-4"
              >
                Clear filters
              </button>
            </div>
          )}
        </section>

        <section className="pg-layout cols-2 pb-10">
          <div className="pg-block">
            <div className="pg-block-label">Recently added</div>
            <div className="space-y-3">
              {recentlyAdded.map((release) => (
                <button
                  key={`${release.artist}-${release.slug}`}
                  onClick={() => setModalRelease(release)}
                  className="artist-list-item w-full px-0 text-left"
                >
                  <div className="artist-list-ava artist-list-avatar overflow-hidden">
                    <ReleaseArtwork release={release} />
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
            <h3 className="pg-block-title">Releases are registry-backed.</h3>
            <p className="pg-block-body">
              This page is powered by ready release shells, registry artwork fallbacks, and canonical release relationships. Non-ready shells stay out of public discovery.
            </p>
          </div>
        </section>
      </div>

      <AlbumModal open={Boolean(modalRelease)} release={modalRelease} onClose={() => setModalRelease(null)} />
    </main>
  );
}

function FilterSelect({ label, value, options, onChange }: { label: string; value: string; options: string[]; onChange: (value: string) => void }) {
  return (
    <label className="block">
      <span className="mb-1 block text-[10px] font-extrabold uppercase tracking-[0.16em] text-[var(--wk-text-faint)]">{label}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="w-full rounded-xl border border-[var(--wk-border)] bg-[var(--wk-bg)] px-3 py-2.5 text-[13px] font-bold text-[var(--wk-text)] outline-none"
      >
        {options.map((option) => (
          <option key={option} value={option}>{optionLabel(option)}</option>
        ))}
      </select>
    </label>
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
  const label = isRealLabel(release.labelName) ? release.labelName : "Registry shell";
  return (
    <div className={`artist-card ${wide ? "w-[240px] shrink-0" : ""}`}>
      <button
        onClick={() => onPreview(release)}
        className="artist-card-img block w-full overflow-hidden text-left bg-[var(--wk-surface)]"
      >
        <ReleaseArtwork release={release} />
      </button>
      <div className="artist-card-body">
        <div className="artist-card-name">{release.title}</div>
        <div className="artist-card-meta">
          {release.artist} · {yearValue(release.year) || "Unknown year"} · {trackCountLabel(release.trackCount)}
        </div>
        <div className="artist-card-tags">
          <span className="tag tag-sm">{release.releaseType}</span>
          <span className="tag tag-sm">{label}</span>
        </div>
        <div className="mt-3 flex gap-2">
          <button onClick={() => onPreview(release)} className="wk-button wk-button-sm wk-button-primary">
            <WkIcon name="Eye" size={13} /> Preview
          </button>
          <Link to={releaseUrl(release)} className="wk-button wk-button-sm wk-button-ghost">
            <WkIcon name="ArrowUpRight" size={13} /> Open
          </Link>
        </div>
      </div>
    </div>
  );
}

function HeroAmbient({ release }: { release: Release }) {
  const [failed, setFailed] = useState(false);
  if (!release.artworkUrl || failed) {
    return <div className="album41-ambient opacity-30 bg-[radial-gradient(circle_at_20%_80%,rgba(133,196,65,0.22),transparent_32%),radial-gradient(circle_at_82%_22%,rgba(255,255,255,0.16),transparent_30%)]" />;
  }
  return (
    <>
      <img src={release.artworkUrl} alt="" className="hidden" onError={() => setFailed(true)} />
      <div className="album41-ambient" style={{ backgroundImage: `url("${release.artworkUrl}")` }} />
    </>
  );
}

function ReleaseArtwork({ release }: { release: Release }) {
  const [failed, setFailed] = useState(false);
  const canUseArtwork = Boolean(release.artworkUrl && !failed);
  if (canUseArtwork) {
    return <img src={release.artworkUrl} alt={release.title} className="h-full w-full object-cover" onError={() => setFailed(true)} />;
  }
  const initial = release.title.trim()[0]?.toUpperCase() || "W";
  return (
    <div className="relative flex h-full w-full flex-col justify-between overflow-hidden bg-[linear-gradient(135deg,#f7f9f1_0%,#dfe8d6_54%,#7fa64a_100%)] p-4 text-[#101510]">
      <div className="absolute -right-8 -top-8 h-24 w-24 rounded-full bg-white/25" />
      <div className="absolute -bottom-10 -left-10 h-32 w-32 rounded-full bg-black/10" />
      <div className="relative z-10 text-[9px] font-black uppercase tracking-[0.28em] text-[#30451f]">WAKILISHA</div>
      <div className="relative z-10">
        <div className="mb-2 text-[44px] font-black leading-none tracking-[-0.08em]">{initial}</div>
        <div className="line-clamp-2 text-[13px] font-black leading-[0.95] tracking-[-0.04em]">{release.title}</div>
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

function uniqueSorted(values: string[]): string[] {
  return Array.from(new Set(values.map((value) => value.trim()).filter(Boolean))).sort((a, b) => a.localeCompare(b));
}

function yearValue(value: string): string {
  if (!value || value === "Unknown year") return "";
  return value.match(/\d{4}/)?.[0] || "";
}

function sortReleases(a: Release, b: Release, key: SortKey): number {
  if (key === "artist") return a.artist.localeCompare(b.artist) || a.title.localeCompare(b.title);
  if (key === "title") return a.title.localeCompare(b.title) || a.artist.localeCompare(b.artist);
  const aYear = Number(yearValue(a.year) || 0);
  const bYear = Number(yearValue(b.year) || 0);
  return bYear - aYear || a.title.localeCompare(b.title);
}

function optionLabel(value: string): string {
  if (value === "newest") return "Newest";
  if (value === "updated") return "Recently updated";
  if (value === "artist") return "Artist A-Z";
  if (value === "title") return "Title A-Z";
  return value;
}

function trackCountLabel(count: number): string {
  if (!count) return "tracks pending";
  return `${count} track${count === 1 ? "" : "s"}`;
}

function isRealLabel(label: string): boolean {
  const normalized = label.trim().toLowerCase();
  return Boolean(normalized && normalized !== "wakilisha registry" && normalized !== "unknown" && normalized !== "independent");
}
