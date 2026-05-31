import { useState, useMemo } from "react";
import { Link } from "react-router-dom";
import { ARTISTS } from "@/mocks/artists";
import { TRACK_DETAILS } from "@/mocks/trackDetails";
import { RELEASES } from "@/mocks/releases";
import { GENRES } from "@/mocks/genres";
import { LABELS } from "@/mocks/labels";
import { CHART_DATA } from "@/mocks/charts";
import { WkIcon } from "@/components/design-system/Icon";

const hot = ["Burna Boy", "Afrobeats", "Amapiano", "Tems", "Wizkid", "Asake", "Davido", "Rema"];

const browse = [
  { icon: "BarChart3", label: "Charts", to: "/charts" },
  { icon: "Mic2", label: "Artists", to: "/artists" },
  { icon: "Album", label: "Releases", to: "/releases" },
  { icon: "FolderMusic", label: "Genres", to: "/genres" },
  { icon: "Building2", label: "Labels", to: "/labels" },
  { icon: "Newspaper", label: "Magazine", to: "/magazine" },
] as const;

export default function MobileSearch() {
  const [query, setQuery] = useState("");
  const q = query.trim().toLowerCase();
  const results = useMemo(() => {
    if (!q) return null;
    return {
      artists: ARTISTS.filter((a) => a.name.toLowerCase().includes(q) || a.genres.some((g) => g.toLowerCase().includes(q))).slice(0, 6),
      tracks: TRACK_DETAILS.filter((t) => t.title.toLowerCase().includes(q) || t.artist.toLowerCase().includes(q)).slice(0, 8),
      releases: RELEASES.filter((r) => r.title.toLowerCase().includes(q) || r.artist.toLowerCase().includes(q)).slice(0, 6),
      genres: GENRES.filter((g) => g.name.toLowerCase().includes(q)).slice(0, 8),
      labels: LABELS.filter((l) => l.name.toLowerCase().includes(q) || (l.country || "").toLowerCase().includes(q)).slice(0, 8),
      charts: CHART_DATA.filter((c) => c.title.toLowerCase().includes(q) || c.artist.toLowerCase().includes(q) || (c.genre || "").toLowerCase().includes(q)).slice(0, 8),
    };
  }, [q]);

  return (
    <div className="wk-mobile-v5">
      <div className="search-bar-zone">
        <label className="search-input">
          <WkIcon name="Search" size={17} className="search-input-icon" />
          <input value={query} onChange={(e) => setQuery(e.target.value)} autoFocus placeholder="Search music, artists, charts..." />
          {query && <button onClick={() => setQuery("")} className="search-input-icon" aria-label="Clear search"><WkIcon name="X" size={17} /></button>}
        </label>
      </div>

      {!results && (
        <div className="search-sections">
          <div className="search-section-label">Trending</div>
          <div className="search-chip-row">
            {hot.map((term) => <button key={term} onClick={() => setQuery(term)} className="search-chip hot mobile-pressable">{term}</button>)}
          </div>
          <div className="search-section-label">Browse</div>
          <div className="grid grid-cols-2 gap-2">
            {browse.map((item) => (
              <Link key={item.to} to={item.to} className="mobile-pressable rounded-[14px] border border-[var(--wk-border)] bg-[var(--wk-surface-raised)] p-4">
                <WkIcon name={item.icon as any} size={20} className="mb-2 text-[var(--wk-brand)]" />
                <span className="text-[13px] font-bold text-[var(--wk-text)]">{item.label}</span>
              </Link>
            ))}
          </div>
        </div>
      )}

      {results && (
        <div className="search-sections">
          {results.artists.length > 0 && <ResultSection title={`Artists · ${results.artists.length}`}>{results.artists.map((a) => <ArtistHit key={a.slug} artist={a} />)}</ResultSection>}
          {results.tracks.length > 0 && <ResultSection title={`Tracks · ${results.tracks.length}`}>{results.tracks.map((t) => <TrackHit key={t.slug} track={t} />)}</ResultSection>}
          {results.charts.length > 0 && <ResultSection title={`Chart entries · ${results.charts.length}`}>{results.charts.map((c) => <ChartHit key={c.rank} entry={c} />)}</ResultSection>}
          {results.releases.length > 0 && <ResultSection title={`Releases · ${results.releases.length}`}>{results.releases.map((r) => <ReleaseHit key={r.slug} release={r} />)}</ResultSection>}
          {results.genres.length > 0 && <ResultSection title={`Genres · ${results.genres.length}`}>{results.genres.map((g) => <Link key={g.slug} to={`/genres/${g.slug}`} className="search-chip mobile-pressable">{g.name}</Link>)}</ResultSection>}
          {results.labels.length > 0 && <ResultSection title={`Labels · ${results.labels.length}`}>{results.labels.map((l) => <Link key={l.slug} to={`/labels/${l.slug}`} className="lbl-row"><div className="lbl-avatar">{l.name[0]}</div><div><div className="lbl-name">{l.name}</div><div className="lbl-meta">{l.artistCount} artists · {l.releaseCount} releases</div></div><WkIcon name="ChevronRight" size={16} className="lbl-chevron" /></Link>)}</ResultSection>}
        </div>
      )}
    </div>
  );
}

function ResultSection({ title, children }: { title: string; children: React.ReactNode }) {
  return <section className="mb-5"><div className="search-section-label">{title}</div><div className="space-y-2">{children}</div></section>;
}

function ArtistHit({ artist }: { artist: typeof ARTISTS[number] }) {
  return <Link to={`/artists/${artist.slug}`} className="lbl-row"><div className="lbl-avatar">{artist.imageUrl ? <img src={artist.imageUrl} alt="" /> : artist.name[0]}</div><div><div className="lbl-name">{artist.name}</div><div className="lbl-meta">{artist.genres.slice(0, 2).join(", ")}</div></div><WkIcon name="ChevronRight" size={16} className="lbl-chevron" /></Link>;
}
function TrackHit({ track }: { track: typeof TRACK_DETAILS[number] }) {
  return <Link to={`/tracks/${track.slug}`} className="lbl-row"><div className="lbl-avatar">{track.artworkUrl ? <img src={track.artworkUrl} alt="" /> : <WkIcon name="Music2" size={17} />}</div><div><div className="lbl-name">{track.title}</div><div className="lbl-meta">{track.artist}</div></div><WkIcon name="ChevronRight" size={16} className="lbl-chevron" /></Link>;
}
function ReleaseHit({ release }: { release: typeof RELEASES[number] }) {
  return <Link to={`/releases/${release.slug}`} className="lbl-row"><div className="lbl-avatar">{release.artworkUrl ? <img src={release.artworkUrl} alt="" /> : <WkIcon name="Album" size={17} />}</div><div><div className="lbl-name">{release.title}</div><div className="lbl-meta">{release.artist}</div></div><WkIcon name="ChevronRight" size={16} className="lbl-chevron" /></Link>;
}
function ChartHit({ entry }: { entry: typeof CHART_DATA[number] }) {
  return (
    <Link to={`/tracks/${entry.slug}`} className="lbl-row">
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--wk-brand)] text-[var(--wk-brand-on)] text-[11px] font-black">
        {entry.rank}
      </div>
      <div className="lbl-avatar overflow-hidden">
        {entry.artworkUrl ? <img src={entry.artworkUrl} alt="" className="h-full w-full object-cover" /> : <WkIcon name="Music2" size={17} />}
      </div>
      <div>
        <div className="lbl-name">{entry.title}</div>
        <div className="lbl-meta">{entry.artist} · {entry.genre}</div>
      </div>
      <WkIcon name="ChevronRight" size={16} className="lbl-chevron" />
    </Link>
  );
}
