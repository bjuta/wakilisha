import { useState, useMemo, useEffect } from "react";
import { Link } from "react-router-dom";
import { usePlayer } from "@/context/PlayerContext";
import { ArtistCard } from "@/components/design-system/registry/ArtistCard";
import { ReleaseCard } from "@/components/design-system/registry/ReleaseCard";
import { slugify } from "@/services/repairedContent/client";
import { useArtistSearchSuggestions } from "@/hooks/useArtistSearchSuggestions";
import { useArtistSearchData, type ArtistSearchItem } from "@/hooks/useArtistSearchData";
import { useTrackSearchData, type TrackSearchItem } from "@/hooks/useTrackSearchData";
import { useGenreSearchData, type GenreSearchItem } from "@/hooks/useGenreSearchData";
import { useLabelSearchData, type LabelSearchItem } from "@/hooks/useLabelSearchData";
import { useChartSearchData, type ChartSearchItem } from "@/hooks/useChartSearchData";
import { SkeletonBlock } from "@/components/skeletons/Skeletons";
import { listReleases, type RepairedRelease } from "@/services/repairedContent/client";
import { buildReleaseSearchSnippet } from "@/services/cultureContext/releaseAdapters";
import { useMagazineArticles } from "@/services/magazineArticles";
import { buildMagazineIssues, issueUrl, type MagazineIssue } from "@/services/magazineIssues";
import { buildIssueEditorialSystem } from "@/services/magazineNlg";
import type { MagazineIssueExperience } from "@/services/magazineIssueEngine";

const TABS = ["All", "Artists", "Tracks", "Releases", "Genres", "Labels", "Charts", "Magazine"] as const;

type Tab = (typeof TABS)[number];
type MagazineIssueSearchItem = { issue: MagazineIssue; experience: MagazineIssueExperience };

function highlight(text: string, query: string) {
  if (!text) return null;
  if (!query.trim()) return text;
  const parts = text.split(new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})`, "gi"));
  return parts.map((part, i) =>
    part.toLowerCase() === query.toLowerCase() ? (
      <mark key={i} className="rounded bg-[var(--wk-brand-soft)] px-0.5 text-[var(--wk-brand)]">{part}</mark>
    ) : (
      <span key={i}>{part}</span>
    )
  );
}

function SectionHeader({ title, count, onViewAll }: { title: string; count: number; onViewAll?: () => void }) {
  return (
    <div className="mb-4 flex items-center justify-between">
      <div className="text-[12px] font-black uppercase tracking-wider text-[var(--wk-text-muted)]">{title} · {count}</div>
      {onViewAll && count > 0 && (
        <button onClick={onViewAll} className="text-[12px] font-semibold text-[var(--wk-brand)]">
          View all <i className="ri-arrow-right-line" />
        </button>
      )}
    </div>
  );
}

function MagazineIssueResult({ item, query }: { item: MagazineIssueSearchItem; query: string }) {
  const { issue, experience } = item;
  return (
    <Link to={issueUrl(issue)} className="group relative overflow-hidden rounded-xl border border-[var(--wk-border)] bg-[var(--wk-surface)] p-5 transition-all hover:border-[var(--wk-brand)] hover:bg-[var(--wk-surface-raised)]">
      <div className="mb-2 flex items-center gap-2">
        <span className="rounded-full bg-[var(--wk-brand-soft)] px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.14em] text-[var(--wk-brand)]">
          {experience.archetypeLabel}
        </span>
        <span className="text-[11px] font-semibold text-[var(--wk-text-faint)]">{issue.issueLabel}</span>
      </div>
      <h3 className="text-[18px] font-black tracking-tight text-[var(--wk-text)] group-hover:text-[var(--wk-brand)] transition-colors">
        {highlight(issue.title, query)}
      </h3>
      <p className="mt-2 line-clamp-2 text-[13px] leading-snug text-[var(--wk-text-soft)]">
        {highlight(experience.searchSnippet, query)}
      </p>
      <p className="mt-3 line-clamp-2 text-[12px] leading-snug text-[var(--wk-text-muted)]">
        {highlight(experience.archiveBlurb, query)}
      </p>
      <span className="mag-start-here mt-4 inline-flex text-[11px] font-black uppercase tracking-[0.16em] text-[var(--wk-brand)]">Start here</span>
    </Link>
  );
}

export default function Search() {
  const [query, setQuery] = useState("");
  const [activeTab, setActiveTab] = useState<Tab>("All");
  const [loading, setLoading] = useState(false);
  const [releases, setReleases] = useState<RepairedRelease[]>([]);
  const [releasesLoading, setReleasesLoading] = useState(true);
  const { playTrack } = usePlayer();
  const { suggestions: trendingArtists, loading: trendingLoading } = useArtistSearchSuggestions(12);
  const { data: artistData } = useArtistSearchData();
  const { data: trackData } = useTrackSearchData();
  const { data: genreData } = useGenreSearchData();
  const { data: labelData } = useLabelSearchData();
  const { data: chartData } = useChartSearchData();
  const { articles: magazineArticles } = useMagazineArticles();

  const q = query.trim().toLowerCase();

  useEffect(() => {
    let alive = true;
    const load = async () => {
      setReleasesLoading(true);
      try {
        const data = await listReleases();
        if (!alive) return;
        setReleases(data);
      } catch (err) {
        console.error("Failed to load releases for search:", err);
      } finally {
        if (alive) setReleasesLoading(false);
      }
    };
    load();
    return () => { alive = false; };
  }, []);

  useEffect(() => {
    if (!q) { setLoading(false); return; }
    setLoading(true);
    const t = setTimeout(() => setLoading(false), 300);
    return () => clearTimeout(t);
  }, [q]);

  const magazineIssueData = useMemo<MagazineIssueSearchItem[]>(() => {
    return buildMagazineIssues(magazineArticles).map((issue) => ({ issue, experience: buildIssueEditorialSystem(issue) }));
  }, [magazineArticles]);

  const results = useMemo(() => {
    if (!q) return { artists: [] as ArtistSearchItem[], tracks: [] as TrackSearchItem[], releases: [] as RepairedRelease[], genres: [] as GenreSearchItem[], labels: [] as LabelSearchItem[], charts: [] as ChartSearchItem[], magazine: [] as MagazineIssueSearchItem[] };

    const artists = artistData.filter((a) => a.name.toLowerCase().includes(q) || a.genres.some((g) => g.toLowerCase().includes(q)) || (a.country || "").toLowerCase().includes(q) || a.contextText.toLowerCase().includes(q));
    const tracks = trackData.filter((t) => t.title.toLowerCase().includes(q) || t.artist.toLowerCase().includes(q) || t.genre.toLowerCase().includes(q) || t.label.toLowerCase().includes(q) || t.contextText.toLowerCase().includes(q));
    const filteredReleases = releasesLoading ? [] : releases.filter((r) => r.title.toLowerCase().includes(q) || r.artist.toLowerCase().includes(q) || (r.labelName || "").toLowerCase().includes(q) || buildReleaseSearchSnippet(r).toLowerCase().includes(q));
    const filteredGenres = genreData.filter((g) => g.name.toLowerCase().includes(q) || g.representativeArtists?.some((a) => a.toLowerCase().includes(q)) || g.contextText.toLowerCase().includes(q));
    const filteredLabels = labelData.filter((l) => l.name.toLowerCase().includes(q) || (l.country || "").toLowerCase().includes(q) || l.contextText.toLowerCase().includes(q));
    const filteredCharts = chartData.filter((c) => c.title.toLowerCase().includes(q) || c.artist.toLowerCase().includes(q) || c.contextText.toLowerCase().includes(q));
    const magazine = magazineIssueData.filter(({ issue, experience }) => [issue.title, issue.issueLabel, experience.archetypeLabel, experience.searchSnippet, experience.archiveBlurb, experience.cardBlurb].join(" ").toLowerCase().includes(q));

    return { artists, tracks, releases: filteredReleases, genres: filteredGenres, labels: filteredLabels, charts: filteredCharts, magazine };
  }, [q, artistData, trackData, releases, releasesLoading, genreData, labelData, chartData, magazineIssueData]);

  const total = results.artists.length + results.tracks.length + results.releases.length + results.genres.length + results.labels.length + results.charts.length + results.magazine.length;

  const handlePlayTrack = (track: TrackSearchItem) => {
    playTrack(
      { id: track.slug, title: track.title, artist: track.artist, artworkUrl: track.artworkUrl, isPlayable: track.isPlayable, source: track.source },
      [{ id: track.slug, title: track.title, artist: track.artist, artworkUrl: track.artworkUrl, isPlayable: track.isPlayable, source: track.source }]
    );
  };

  const showArtists = activeTab === "All" || activeTab === "Artists";
  const showTracks = activeTab === "All" || activeTab === "Tracks";
  const showReleases = activeTab === "All" || activeTab === "Releases";
  const showGenres = activeTab === "All" || activeTab === "Genres";
  const showLabels = activeTab === "All" || activeTab === "Labels";
  const showCharts = activeTab === "All" || activeTab === "Charts";
  const showMagazine = activeTab === "All" || activeTab === "Magazine";

  return (
    <div className="min-h-screen">
      <div className="wk-container-wide px-6 py-10 md:py-14">
        <div className="wk-eyebrow mb-4">Discovery</div>
        <h1 className="wk-h-page mb-6">Search WAKILISHA</h1>

        <div className="relative max-w-2xl">
          <i className="ri-search-line absolute left-4 top-1/2 -translate-y-1/2 text-[var(--wk-text-muted)] text-lg" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search artists, songs, releases, genres, labels, charts, issues..."
            className="w-full rounded-full border border-[var(--wk-border)] bg-[var(--wk-surface)] py-3.5 pl-12 pr-4 text-[15px] text-[var(--wk-text)] placeholder:text-[var(--wk-text-faint)] outline-none focus:border-[var(--wk-brand)]"
            autoFocus
          />
          {query && (
            <button onClick={() => setQuery("")} className="absolute right-4 top-1/2 -translate-y-1/2 text-[var(--wk-text-faint)] hover:text-[var(--wk-text)]">
              <i className="ri-close-line text-lg" />
            </button>
          )}
        </div>
      </div>

      {q && (
        <div className="border-b border-[var(--wk-border)] sticky top-0 z-10" style={{ background: "var(--wk-bg)" }}>
          <div className="wk-container-wide flex gap-1 overflow-x-auto px-6 py-2 scrollbar-hide">
            {TABS.map((tab) => {
              const count = tab === "All" ? total : tab === "Artists" ? results.artists.length : tab === "Tracks" ? results.tracks.length : tab === "Releases" ? results.releases.length : tab === "Genres" ? results.genres.length : tab === "Labels" ? results.labels.length : tab === "Charts" ? results.charts.length : results.magazine.length;
              return (
                <button key={tab} onClick={() => setActiveTab(tab)} className={`flex-none rounded-full px-4 py-2 text-[13px] font-semibold transition-all whitespace-nowrap ${activeTab === tab ? "bg-[var(--wk-brand)] text-[var(--wk-brand-on)]" : "border border-[var(--wk-border)] text-[var(--wk-text-soft)] hover:bg-[var(--wk-surface-raised)]"}`}>
                  {tab}{count > 0 && <span className="ml-1.5 text-[11px] opacity-80">{count}</span>}
                </button>
              );
            })}
          </div>
        </div>
      )}

      <div className="wk-container-wide px-6 py-8 md:py-12">
        {!q && (
          <div className="space-y-12">
            <div>
              <div className="wk-eyebrow mb-4">Browse</div>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                {[
                  { icon: "ri-bar-chart-line", label: "Charts", to: "/charts", desc: "This week’s charts" },
                  { icon: "ri-user-line", label: "Artists", to: "/artists", desc: "Artists" },
                  { icon: "ri-album-line", label: "Releases", to: "/releases", desc: "Albums, EPs and singles" },
                  { icon: "ri-folder-music-line", label: "Genres", to: "/genres", desc: "Sounds and scenes" },
                  { icon: "ri-building-2-line", label: "Labels", to: "/labels", desc: "Labels and collectives" },
                  { icon: "ri-article-line", label: "Magazine", to: "/magazine/issues", desc: "Issues and stories" },
                ].map((cat) => (
                  <Link key={cat.to} to={cat.to} className="group flex flex-col gap-2 rounded-xl border border-[var(--wk-border)] bg-[var(--wk-surface)] p-4 transition-all hover:border-[var(--wk-border-2)] hover:bg-[var(--wk-surface-raised)]">
                    <div className="flex items-center gap-2"><i className={`${cat.icon} text-[var(--wk-brand)]`} /><span className="text-[14px] font-bold text-[var(--wk-text)]">{cat.label}</span></div>
                    <span className="text-[12px] text-[var(--wk-text-muted)]">{cat.desc}</span>
                  </Link>
                ))}
              </div>
            </div>

            <div>
              <div className="wk-eyebrow mb-4">Jump in</div>
              {trendingLoading ? (
                <div className="flex flex-wrap gap-2">{Array.from({ length: 8 }).map((_, i) => <span key={i} className="rounded-full border border-[var(--wk-border)] bg-[var(--wk-surface)] px-4 py-2"><SkeletonBlock className="h-4 w-20 rounded" /></span>)}</div>
              ) : trendingArtists.length === 0 ? (
                <p className="text-[13px] text-[var(--wk-text-muted)]">Type a name, sound, place, or issue thread to get started.</p>
              ) : (
                <div className="flex flex-wrap gap-2">{trendingArtists.map((name) => <button key={name} onClick={() => setQuery(name)} className="rounded-full border border-[var(--wk-border)] bg-[var(--wk-surface)] px-4 py-2 text-[13px] font-semibold text-[var(--wk-text-soft)] transition-all hover:border-[var(--wk-brand)]/40 hover:text-[var(--wk-brand)]">{name}</button>)}</div>
              )}
            </div>
          </div>
        )}

        {q && loading && (
          <div className="py-20 space-y-6"><div className="max-w-2xl mx-auto space-y-3">{Array.from({ length: 4 }).map((_, i) => <div key={i} className="animate-pulse flex items-center gap-4 rounded-xl border border-[var(--wk-border)] bg-[var(--wk-surface)] p-4"><SkeletonBlock className="h-12 w-12 rounded-md" /><div className="flex-1 space-y-2"><SkeletonBlock className="h-4 w-1/3 rounded" /><SkeletonBlock className="h-3 w-2/3 rounded" /></div></div>)}</div></div>
        )}

        {q && !loading && total === 0 && (
          <div className="py-20 text-center text-[var(--wk-text-muted)]">
            <i className="ri-search-line mb-4 block text-5xl" />
            <div className="text-[18px] font-bold text-[var(--wk-text)] mb-2">Nothing came up for "{query}"</div>
            <div className="text-[14px]">Try another spelling, another name, or open a magazine issue from the sections below.</div>
          </div>
        )}

        {q && !loading && (
          <div className="space-y-10">
            {showMagazine && results.magazine.length > 0 && (
              <section>
                <SectionHeader title="Magazine issues" count={results.magazine.length} onViewAll={activeTab === "All" && results.magazine.length > 4 ? () => setActiveTab("Magazine") : undefined} />
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {results.magazine.slice(0, activeTab === "All" ? 4 : undefined).map((item) => <MagazineIssueResult key={item.issue.slug} item={item} query={query} />)}
                </div>
              </section>
            )}

            {showArtists && results.artists.length > 0 && <section><SectionHeader title="Artists" count={results.artists.length} onViewAll={activeTab === "All" && results.artists.length > 4 ? () => setActiveTab("Artists") : undefined} /><div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">{results.artists.slice(0, activeTab === "All" ? 4 : undefined).map((artist) => <ArtistCard key={artist.slug} {...artist} contextText={artist.contextText} />)}</div></section>}

            {showTracks && results.tracks.length > 0 && (
              <section><SectionHeader title="Tracks" count={results.tracks.length} onViewAll={activeTab === "All" && results.tracks.length > 6 ? () => setActiveTab("Tracks") : undefined} /><div className="rounded-2xl border border-[var(--wk-border)] bg-[var(--wk-surface)] overflow-hidden"><div className="divide-y divide-[var(--wk-divider)]">{results.tracks.slice(0, activeTab === "All" ? 6 : undefined).map((track) => { const meta = [track.artist, track.genre, track.label].filter(Boolean).join(" · "); return <div key={track.slug} className="group flex items-center gap-3 px-5 py-3 transition-colors hover:bg-[var(--wk-surface-raised)]"><div className="h-12 w-12 shrink-0 overflow-hidden rounded-md bg-[var(--wk-surface-raised)]"><img src={track.artworkUrl} alt="" className="h-full w-full object-cover" /></div><div className="min-w-0 flex-1"><Link to={`/tracks/${slugify(track.artist)}/${track.slug}`} className="text-[13px] font-bold text-[var(--wk-text)] hover:underline">{highlight(track.title, query)}</Link>{meta && <div className="text-[11px] text-[var(--wk-text-muted)]">{highlight(meta, query)}</div>}{track.contextText && <p className="mt-1 line-clamp-2 text-[12px] leading-snug text-[var(--wk-text-soft)]">{highlight(track.contextText, query)}</p>}</div><button onClick={() => handlePlayTrack(track)} disabled={!track.isPlayable} className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--wk-brand)] text-[var(--wk-brand-on)] opacity-0 transition-all group-hover:opacity-100 disabled:opacity-0" aria-label="Play"><i className="ri-play-mini-fill text-sm" /></button></div>; })}</div></div></section>
            )}

            {showReleases && results.releases.length > 0 && <section><SectionHeader title="Releases" count={results.releases.length} onViewAll={activeTab === "All" && results.releases.length > 4 ? () => setActiveTab("Releases") : undefined} /><div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">{results.releases.slice(0, activeTab === "All" ? 4 : undefined).map((release) => <ReleaseCard key={release.slug} {...release} contextText={buildReleaseSearchSnippet(release)} />)}</div></section>}

            {showGenres && results.genres.length > 0 && <section><SectionHeader title="Genres" count={results.genres.length} /><div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{results.genres.map((genre) => <Link key={genre.slug} to={`/genres/${genre.slug}`} className="group relative overflow-hidden rounded-xl border border-[var(--wk-border)] bg-[var(--wk-surface)] p-5 transition-all hover:border-[var(--wk-border-2)]"><div className="absolute right-0 top-0 h-32 w-32 rounded-bl-full opacity-[0.08] transition-opacity group-hover:opacity-[0.14]" style={{ background: genre.accentVar }} /><div className="mb-1 text-[11px] font-black uppercase tracking-[0.18em]" style={{ color: genre.accentVar }}>Genre</div><h3 className="text-[18px] font-black tracking-tight text-[var(--wk-text)]">{highlight(genre.name, query)}</h3>{genre.contextText && <p className="relative mt-2 line-clamp-2 text-[13px] leading-snug text-[var(--wk-text-soft)]">{highlight(genre.contextText, query)}</p>}</Link>)}</div></section>}

            {showLabels && results.labels.length > 0 && <section><SectionHeader title="Labels" count={results.labels.length} /><div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{results.labels.map((label) => <Link key={label.slug} to={`/labels/${label.slug}`} className="block rounded-xl border border-[var(--wk-border)] bg-[var(--wk-surface)] p-5 transition-all hover:border-[var(--wk-border-2)] hover:bg-[var(--wk-surface-raised)]"><div className="flex items-center justify-between mb-2"><h3 className="text-[16px] font-bold text-[var(--wk-text)]">{highlight(label.name, query)}</h3>{label.country && <span className="text-[11px] text-[var(--wk-text-muted)]">{label.country}</span>}</div>{label.contextText && <p className="mb-3 line-clamp-2 text-[13px] leading-snug text-[var(--wk-text-soft)]">{highlight(label.contextText, query)}</p>}</Link>)}</div></section>}

            {showCharts && results.charts.length > 0 && <section><SectionHeader title="Chart entries" count={results.charts.length} /><div className="rounded-2xl border border-[var(--wk-border)] bg-[var(--wk-surface)] overflow-hidden"><div className="divide-y divide-[var(--wk-divider)]">{results.charts.map((entry) => <div key={`${entry.rank}-${entry.slug}`} className="flex items-center gap-3 px-5 py-3"><div className="w-6 text-right text-[14px] font-black text-[var(--wk-brand)]">{entry.rank}</div><div className="h-10 w-10 shrink-0 overflow-hidden rounded-md bg-[var(--wk-surface-raised)]"><img src={entry.artworkUrl} alt="" className="h-full w-full object-cover" /></div><div className="min-w-0 flex-1"><Link to={`/tracks/${slugify(entry.artist)}/${entry.slug}`} className="text-[13px] font-bold text-[var(--wk-text)] hover:underline">{highlight(entry.title, query)}</Link><div className="text-[11px] text-[var(--wk-text-muted)]">{highlight(entry.artist, query)}</div>{entry.contextText && <p className="mt-1 line-clamp-2 text-[12px] leading-snug text-[var(--wk-text-soft)]">{highlight(entry.contextText, query)}</p>}</div></div>)}</div></div></section>}
          </div>
        )}
      </div>
    </div>
  );
}
