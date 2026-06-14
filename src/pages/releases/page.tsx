import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { Link } from "react-router-dom";
import { AlbumModal } from "@/components/design-system/releases/AlbumModal";
import type { ModalRelease } from "@/components/design-system/releases/AlbumModal";
import { ShareButton } from "@/components/design-system/share/ShareSheet";
import { WkIcon } from "@/components/design-system/Icon";
import { supabase } from "@/lib/supabase";
import {
  listReleases,
  listLabels,
  releaseUrl,
  getRelease,
  slugify,
  type RepairedRelease,
  type RepairedLabel,
} from "@/services/repairedContent/client";

type Release = RepairedRelease;
type SortKey = "newest" | "updated" | "artist" | "title";
type MediaRow = { slug: string | null; title: string | null; url: string; source_kind: string | null; source_entity: string | null };

const ALL = "All";
const PAGE_SIZE = 48;

export default function Releases() {
  const [typeFilter, setTypeFilter] = useState(ALL);
  const [yearFilter, setYearFilter] = useState(ALL);
  const [artistFilter, setArtistFilter] = useState(ALL);
  const [query, setQuery] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("newest");
  const [page, setPage] = useState(1);
  const [modalRelease, setModalRelease] = useState<Release | null>(null);
  const [modalReleaseDetail, setModalReleaseDetail] = useState<ModalRelease | null>(null);
  const [modalLoading, setModalLoading] = useState(false);
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
      setReleases(await hydrateReleaseArtwork(releasesData));
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

  useEffect(() => {
    setPage(1);
  }, [artistFilter, query, sortKey, typeFilter, yearFilter]);

  useEffect(() => {
    if (!modalRelease) {
      setModalReleaseDetail(null);
      return;
    }

    const artistSlug = slugify(modalRelease.artist);
    let cancelled = false;
    setModalLoading(true);

    getRelease(artistSlug, modalRelease.slug).then((detail) => {
      if (cancelled) return;
      if (detail && detail.tracks.length > 0) {
        setModalReleaseDetail({
          slug: detail.slug,
          title: detail.title,
          artist: detail.artist,
          releaseType: detail.releaseType,
          year: detail.year,
          labelName: detail.labelName,
          artworkUrl: detail.artworkUrl,
          trackCount: detail.trackCount,
          tracks: detail.tracks.map((t) => ({
            title: t.title,
            duration: formatDurationSeconds(t.duration),
            artists: t.artist,
            previewUrl: t.previewUrl,
          })),
        });
      } else {
        setModalReleaseDetail(null);
      }
      setModalLoading(false);
    }).catch(() => {
      if (!cancelled) {
        setModalReleaseDetail(null);
        setModalLoading(false);
      }
    });

    return () => { cancelled = true; };
  }, [modalRelease]);

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

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pagedReleases = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);
  const showingFrom = filtered.length ? (safePage - 1) * PAGE_SIZE + 1 : 0;
  const showingTo = Math.min(safePage * PAGE_SIZE, filtered.length);
  const featuredReleases = useMemo(() => pickFeaturedReleases(filtered.length ? filtered : releases), [filtered, releases]);
  const recentlyAdded = useMemo(() => [...releases].sort((a, b) => sortReleases(a, b, "newest")).slice(0, 6), [releases]);
  const freshShelf = filtered.slice(0, 8).map((release) => ({ release }));

  const catalogStats = {
    total: releases.length,
    visible: filtered.length,
    albums: releases.filter((r) => r.releaseType.toLowerCase() === "album").length,
    eps: releases.filter((r) => r.releaseType.toLowerCase() === "ep").length,
    labelsRepresented: labels.length,
  };

  if (loading) {
    return <ReleasesLoading />;
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
      <FeaturedReleaseCarousel releases={featuredReleases} catalogStats={catalogStats} onPreview={setModalRelease} />

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
                <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search title, artist, label…" className="w-full bg-transparent text-[14px] font-semibold text-[var(--wk-text)] outline-none placeholder:text-[var(--wk-text-faint)]" />
              </div>
            </label>
            <FilterSelect label="Type" value={typeFilter} options={releaseTypes} onChange={setTypeFilter} />
            <FilterSelect label="Year" value={yearFilter} options={releaseYears} onChange={setYearFilter} />
            <FilterSelect label="Sort" value={sortKey} options={["newest", "updated", "artist", "title"]} onChange={(value) => setSortKey(value as SortKey)} />
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            {releaseArtists.map((artist) => (
              <button key={artist} onClick={() => setArtistFilter(artist)} className={`directory-filter ${artistFilter === artist ? "on" : ""}`}>
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
              Showing {showingFrom}-{showingTo} of {filtered.length} registry-backed releases.
            </p>
          </div>
          <div className="artist-directory-grid">
            {pagedReleases.map((release) => (
              <ReleaseTile key={`${release.artist}-${release.slug}`} release={release} onPreview={setModalRelease} />
            ))}
          </div>
          {filtered.length > PAGE_SIZE && (
            <Pagination page={safePage} totalPages={totalPages} onPageChange={setPage} />
          )}
          {filtered.length === 0 && (
            <div className="artist-empty">
              <WkIcon name="Disc3" size={32} />
              <div className="mt-3">No releases match these filters.</div>
              <button onClick={() => { setQuery(""); setTypeFilter(ALL); setYearFilter(ALL); setArtistFilter(ALL); setSortKey("newest"); }} className="wk-button wk-button-sm wk-button-ghost mt-4">
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
                <button key={`${release.artist}-${release.slug}`} onClick={() => setModalRelease(release)} className="artist-list-item w-full px-0 text-left">
                  <div className="artist-list-ava artist-list-avatar overflow-hidden"><ReleaseArtwork release={release} /></div>
                  <div>
                    <div className="artist-list-name">{release.title}</div>
                    <div className="artist-list-sub">{release.artist} · {release.releaseType}</div>
                  </div>
                  <WkIcon name="ArrowRight" size={16} />
                </button>
              ))}
            </div>
          </div>
          <div className="pg-block">
            <div className="pg-block-label">Data source</div>
            <h3 className="pg-block-title">Releases are registry-backed.</h3>
            <p className="pg-block-body">This page is powered by ready release shells, registry artwork hydration, and canonical release relationships. Non-ready shells stay out of public discovery.</p>
          </div>
        </section>
      </div>

      <AlbumModal open={Boolean(modalRelease)} release={modalReleaseDetail || (modalRelease ? { slug: modalRelease.slug, title: modalRelease.title, artist: modalRelease.artist, releaseType: modalRelease.releaseType, year: modalRelease.year, labelName: modalRelease.labelName, artworkUrl: modalRelease.artworkUrl, trackCount: modalRelease.trackCount } : null)} onClose={() => { setModalRelease(null); setModalReleaseDetail(null); }} />
    </main>
  );
}

function ReleasesLoading() {
  return (
    <main className="min-h-screen bg-[var(--wk-bg)]">
      <section className="relative overflow-hidden border-b border-[var(--wk-border)] bg-[var(--wk-bg)]">
        <div className="wk-container-wide px-4 py-20 md:px-6 lg:py-28">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <div className="space-y-4">
              <div className="h-4 w-40 rounded bg-[var(--wk-surface-raised)] animate-pulse" />
              <div className="h-16 w-3/4 rounded bg-[var(--wk-surface-raised)] animate-pulse" />
              <div className="h-4 w-1/2 rounded bg-[var(--wk-surface-raised)] animate-pulse" />
              <div className="h-4 w-2/3 rounded bg-[var(--wk-surface-raised)] animate-pulse" />
            </div>
            <div className="h-72 rounded-2xl bg-[var(--wk-surface-raised)] animate-pulse" />
          </div>
        </div>
      </section>
      <div className="wk-container-wide px-4 py-10 md:px-6">
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
          {Array.from({ length: 12 }).map((_, i) => <div key={i} className="h-64 rounded-xl border border-[var(--wk-border)] bg-[var(--wk-surface)] animate-pulse" />)}
        </div>
      </div>
    </main>
  );
}

function FeaturedReleaseCarousel({ releases, catalogStats, onPreview }: { releases: Release[]; catalogStats: { total: number; visible: number; albums: number; eps: number; labelsRepresented: number }; onPreview: (release: Release) => void }) {
  const [activeIndex, setActiveIndex] = useState(0);
  const scrollerRef = useRef<HTMLDivElement>(null);
  const active = releases[activeIndex] || releases[0];

  useEffect(() => setActiveIndex(0), [releases]);

  const scrollTo = (index: number) => {
    const nextIndex = Math.max(0, Math.min(index, releases.length - 1));
    setActiveIndex(nextIndex);
    const slide = scrollerRef.current?.children[nextIndex] as HTMLElement | undefined;
    slide?.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
  };

  if (!active) return null;

  return (
    <section className="relative min-h-[78vh] overflow-hidden border-b border-[var(--wk-border)] bg-[#0d120a] text-white">
      <CarouselBackground release={active} />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_12%_20%,rgba(133,196,65,0.32),transparent_34%),linear-gradient(90deg,rgba(0,0,0,0.82)_0%,rgba(0,0,0,0.58)_42%,rgba(0,0,0,0.24)_100%)]" />
      <div className="relative z-10 flex min-h-[78vh] flex-col justify-end">
        <div className="wk-container-wide w-full px-4 pb-8 pt-24 md:px-6 lg:pb-12 lg:pt-32">
          <div className="grid items-end gap-8 lg:grid-cols-[minmax(0,1fr)_420px]">
            <div className="max-w-4xl">
              <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1.5 text-[11px] font-extrabold uppercase tracking-[0.18em] text-white/85 backdrop-blur"><WkIcon name="Sparkles" size={13} /> Releases discovery</div>
              <h1 className="font-[var(--wk-font-display)] text-[clamp(56px,9vw,128px)] font-black leading-[0.82] tracking-[-0.075em] text-white drop-shadow-2xl">Albums & releases</h1>
              <p className="mt-6 max-w-2xl text-[17px] font-semibold leading-[1.75] text-white/74 md:text-[19px]">A registry-backed release shelf for albums, EPs and singles across WAKILISHA. Swipe through featured records, then filter the full catalog below.</p>
              <div className="mt-7 flex flex-wrap items-center gap-3 text-[12px] font-extrabold text-white/82">
                <span className="inline-flex items-center gap-2 rounded-full border border-white/16 bg-white/10 px-3 py-2 backdrop-blur"><WkIcon name="Disc3" size={14} /> {catalogStats.total} releases</span>
                <span className="inline-flex items-center gap-2 rounded-full border border-white/16 bg-white/10 px-3 py-2 backdrop-blur"><WkIcon name="ListFilter" size={14} /> {catalogStats.visible} visible</span>
                <span className="inline-flex items-center gap-2 rounded-full border border-white/16 bg-white/10 px-3 py-2 backdrop-blur"><WkIcon name="Building2" size={14} /> {catalogStats.labelsRepresented} labels</span>
              </div>
            </div>
            <div className="rounded-[28px] border border-white/16 bg-black/24 p-4 shadow-2xl backdrop-blur-xl">
              <div className="aspect-square overflow-hidden rounded-2xl bg-white/10"><ReleaseArtwork release={active} /></div>
              <div className="mt-4">
                <div className="text-[11px] font-extrabold uppercase tracking-[0.18em] text-[var(--wk-brand)]">Featured release</div>
                <h2 className="mt-1 line-clamp-2 text-[30px] font-black leading-[0.95] tracking-[-0.05em] text-white">{active.title}</h2>
                <div className="mt-3 text-[13px] font-bold text-white/70">{active.artist} · {yearValue(active.year) || "Unknown year"} · {trackCountLabel(active.trackCount)}</div>
                <div className="mt-4 flex flex-wrap gap-2">
                  <button onClick={() => onPreview(active)} className="wk-button wk-button-primary"><WkIcon name="Eye" size={15} /> Preview</button>
                  <Link to={releaseUrl(active)} className="wk-button wk-button-ghost border-white/20 bg-white/10 text-white hover:bg-white/16"><WkIcon name="ArrowUpRight" size={15} /> Open</Link>
                  <ShareButton item={{ title: active.title, subtitle: active.artist, description: `${active.releaseType} by ${active.artist} on WAKILISHA`, imageUrl: active.artworkUrl, type: "album" }} />
                </div>
              </div>
            </div>
          </div>
          <div className="mt-10">
            <div ref={scrollerRef} className="flex snap-x gap-3 overflow-x-auto pb-3 scrollbar-hide">
              {releases.map((release, index) => (
                <button key={`${release.artist}-${release.slug}`} onClick={() => scrollTo(index)} className={`group relative h-28 w-[220px] shrink-0 snap-start overflow-hidden rounded-2xl border text-left transition-all md:w-[260px] ${activeIndex === index ? "border-[var(--wk-brand)] shadow-[0_0_0_1px_var(--wk-brand)]" : "border-white/16 hover:border-white/35"}`}>
                  <div className="absolute inset-0"><ReleaseArtwork release={release} /></div>
                  <div className="absolute inset-0 bg-gradient-to-t from-black/88 via-black/38 to-transparent" />
                  <div className="absolute inset-x-0 bottom-0 p-3"><div className="line-clamp-1 text-[14px] font-black text-white">{release.title}</div><div className="line-clamp-1 text-[11px] font-bold text-white/70">{release.artist}</div></div>
                </button>
              ))}
            </div>
            <div className="mt-3 flex items-center justify-between gap-4">
              <div className="flex gap-2">{releases.map((release, index) => <button key={`dot-${release.slug}-${index}`} aria-label={`Show ${release.title}`} onClick={() => scrollTo(index)} className={`h-2 rounded-full transition-all ${activeIndex === index ? "w-8 bg-[var(--wk-brand)]" : "w-2 bg-white/35 hover:bg-white/65"}`} />)}</div>
              <div className="flex gap-2"><button onClick={() => scrollTo(activeIndex - 1)} className="rounded-full border border-white/18 bg-white/10 p-2 text-white backdrop-blur hover:bg-white/16" aria-label="Previous featured release"><WkIcon name="ChevronLeft" size={18} /></button><button onClick={() => scrollTo(activeIndex + 1)} className="rounded-full border border-white/18 bg-white/10 p-2 text-white backdrop-blur hover:bg-white/16" aria-label="Next featured release"><WkIcon name="ChevronRight" size={18} /></button></div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function Pagination({ page, totalPages, onPageChange }: { page: number; totalPages: number; onPageChange: (page: number) => void }) {
  const pages = paginationWindow(page, totalPages);
  return (
    <nav className="mt-8 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[var(--wk-border)] bg-[var(--wk-surface)] p-3" aria-label="Release directory pagination">
      <button disabled={page <= 1} onClick={() => onPageChange(page - 1)} className="wk-button wk-button-sm wk-button-ghost disabled:opacity-40"><WkIcon name="ChevronLeft" size={14} /> Previous</button>
      <div className="flex flex-wrap items-center gap-2">
        {pages.map((item, index) => item === "…" ? <span key={`ellipsis-${index}`} className="px-1 text-[var(--wk-text-faint)]">…</span> : <button key={item} onClick={() => onPageChange(item)} className={`h-9 min-w-9 rounded-xl border px-3 text-[12px] font-black ${page === item ? "border-[var(--wk-brand)] bg-[var(--wk-brand)] text-white" : "border-[var(--wk-border)] bg-[var(--wk-bg)] text-[var(--wk-text)]"}`}>{item}</button>)}
      </div>
      <button disabled={page >= totalPages} onClick={() => onPageChange(page + 1)} className="wk-button wk-button-sm wk-button-ghost disabled:opacity-40">Next <WkIcon name="ChevronRight" size={14} /></button>
    </nav>
  );
}

function CarouselBackground({ release }: { release: Release }) {
  const [failed, setFailed] = useState(false);
  if (!release.artworkUrl || failed) return <div className="absolute inset-0 bg-[radial-gradient(circle_at_18%_75%,rgba(133,196,65,0.42),transparent_32%),radial-gradient(circle_at_82%_16%,rgba(255,255,255,0.20),transparent_30%),linear-gradient(135deg,#101510,#1d2f12)]" />;
  return <><img src={release.artworkUrl} alt="" className="hidden" onError={() => setFailed(true)} /><div className="absolute inset-0 scale-105 bg-cover bg-center opacity-75 blur-[2px]" style={{ backgroundImage: `url("${release.artworkUrl}")` }} /></>;
}

function FilterSelect({ label, value, options, onChange }: { label: string; value: string; options: string[]; onChange: (value: string) => void }) {
  return <label className="block"><span className="mb-1 block text-[10px] font-extrabold uppercase tracking-[0.16em] text-[var(--wk-text-faint)]">{label}</span><select value={value} onChange={(event) => onChange(event.target.value)} className="w-full rounded-xl border border-[var(--wk-border)] bg-[var(--wk-bg)] px-3 py-2.5 text-[13px] font-bold text-[var(--wk-text)] outline-none">{options.map((option) => <option key={option} value={option}>{optionLabel(option)}</option>)}</select></label>;
}

function ReleaseTile({ release, onPreview, wide = false }: { release: Release; onPreview: (release: Release) => void; wide?: boolean }) {
  const label = isRealLabel(release.labelName) ? release.labelName : "Registry shell";
  return <div className={`artist-card ${wide ? "w-[240px] shrink-0" : ""}`}><button onClick={() => onPreview(release)} className="artist-card-img block w-full overflow-hidden text-left bg-[var(--wk-surface)]"><ReleaseArtwork release={release} /></button><div className="artist-card-body"><div className="artist-card-name">{release.title}</div><div className="artist-card-meta">{release.artist} · {yearValue(release.year) || "Unknown year"} · {trackCountLabel(release.trackCount)}</div><div className="artist-card-tags"><span className="tag tag-sm">{release.releaseType}</span><span className="tag tag-sm">{label}</span></div><div className="mt-3 flex gap-2"><button onClick={() => onPreview(release)} className="wk-button wk-button-sm wk-button-primary"><WkIcon name="Eye" size={13} /> Preview</button><Link to={releaseUrl(release)} className="wk-button wk-button-sm wk-button-ghost"><WkIcon name="ArrowUpRight" size={13} /> Open</Link></div></div></div>;
}

function ReleaseArtwork({ release }: { release: Release }) {
  const [failed, setFailed] = useState(false);
  const canUseArtwork = Boolean(release.artworkUrl && !failed);
  if (canUseArtwork) return <img src={release.artworkUrl} alt={release.title} className="h-full w-full object-cover" onError={() => setFailed(true)} />;
  const initial = release.title.trim()[0]?.toUpperCase() || "W";
  return <div className="relative flex h-full w-full flex-col justify-between overflow-hidden bg-[linear-gradient(135deg,#f7f9f1_0%,#dfe8d6_54%,#7fa64a_100%)] p-4 text-[#101510]"><div className="absolute -right-8 -top-8 h-24 w-24 rounded-full bg-white/25" /><div className="absolute -bottom-10 -left-10 h-32 w-32 rounded-full bg-black/10" /><div className="relative z-10 text-[9px] font-black uppercase tracking-[0.28em] text-[#30451f]">WAKILISHA</div><div className="relative z-10"><div className="mb-2 text-[44px] font-black leading-none tracking-[-0.08em]">{initial}</div><div className="line-clamp-2 text-[13px] font-black leading-[0.95] tracking-[-0.04em]">{release.title}</div></div></div>;
}

function Stat({ value, label }: { value: string | number; label: string }) {
  return <div className="chart-stat-card"><div className="chart-stat-value">{value}</div><div className="chart-stat-label">{label}</div></div>;
}

function uniqueSorted(values: string[]): string[] { return Array.from(new Set(values.map((value) => value.trim()).filter(Boolean))).sort((a, b) => a.localeCompare(b)); }
function yearValue(value: string): string { if (!value || value === "Unknown year") return ""; return value.match(/\d{4}/)?.[0] || ""; }
function sortReleases(a: Release, b: Release, key: SortKey): number { if (key === "artist") return a.artist.localeCompare(b.artist) || a.title.localeCompare(b.title); if (key === "title") return a.title.localeCompare(b.title) || a.artist.localeCompare(b.artist); const aYear = Number(yearValue(a.year) || 0); const bYear = Number(yearValue(b.year) || 0); return bYear - aYear || a.title.localeCompare(b.title); }
function optionLabel(value: string): string { if (value === "newest") return "Newest"; if (value === "updated") return "Recently updated"; if (value === "artist") return "Artist A-Z"; if (value === "title") return "Title A-Z"; return value; }
function trackCountLabel(count: number): string { if (!count) return "tracks pending"; return `${count} track${count === 1 ? "" : "s"}`; }
function isRealLabel(label: string): boolean { const normalized = label.trim().toLowerCase(); return Boolean(normalized && normalized !== "wakilisha registry" && normalized !== "unknown" && normalized !== "independent"); }
function isGeneratedArtwork(url: string): boolean { return !url || url.startsWith("data:image/svg+xml"); }
function normalized(value: string): string { return value.toLowerCase().normalize("NFKD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""); }
function pickFeaturedReleases(releases: Release[]): Release[] { const withArtwork = releases.filter((release) => !isGeneratedArtwork(release.artworkUrl)); const source = withArtwork.length >= 5 ? withArtwork : releases; return source.slice(0, 10); }
function paginationWindow(page: number, totalPages: number): Array<number | "…"> { if (totalPages <= 7) return Array.from({ length: totalPages }, (_, index) => index + 1); const pages = new Set([1, totalPages, page - 1, page, page + 1].filter((item) => item >= 1 && item <= totalPages)); const sorted = Array.from(pages).sort((a, b) => a - b); return sorted.flatMap((item, index) => index > 0 && item - sorted[index - 1] > 1 ? ["…" as const, item] : [item]); }
function formatDurationSeconds(seconds: number): string {
  if (!seconds || seconds <= 0) return "";
  const min = Math.floor(seconds / 60);
  const sec = seconds % 60;
  return `${min}:${String(sec).padStart(2, "0")}`;
}

async function hydrateReleaseArtwork(releases: Release[]): Promise<Release[]> {
  const generatedCount = releases.filter((release) => isGeneratedArtwork(release.artworkUrl)).length;
  if (!generatedCount) return releases;

  const { data, error } = await supabase
    .from("registry_media_assets")
    .select("slug, title, url, source_kind, source_entity")
    .eq("status", "active")
    .eq("media_kind", "image")
    .range(0, 7999);

  if (error) {
    console.warn(`WAKILISHA release artwork hydration failed: ${error.message}`);
    return releases;
  }

  const mediaRows = ((data || []) as MediaRow[]).filter((row) => row.url);
  if (!mediaRows.length) return releases;

  return releases.map((release) => {
    if (!isGeneratedArtwork(release.artworkUrl)) return release;
    const match = bestMediaMatch(release, mediaRows);
    return match ? { ...release, artworkUrl: match.url } : release;
  });
}

function bestMediaMatch(release: Release, rows: MediaRow[]): MediaRow | null {
  const releaseSlug = normalized(release.slug);
  const titleSlug = normalized(release.title);
  const artistSlug = normalized(release.artist);
  let best: { row: MediaRow; score: number } | null = null;

  for (const row of rows) {
    const haystack = normalized([row.slug, row.title, row.url].filter(Boolean).join(" "));
    let score = 0;
    if (haystack.includes(releaseSlug)) score += 9;
    if (titleSlug && haystack.includes(titleSlug)) score += 7;
    if (artistSlug && haystack.includes(artistSlug)) score += 3;
    if (row.source_kind === "wordpress_database") score += 1;
    if (score >= 7 && (!best || score > best.score)) best = { row, score };
  }

  return best?.row || null;
}