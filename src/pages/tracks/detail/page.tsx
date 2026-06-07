import { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import { usePlayer } from "@/context/PlayerContext";
import { getTrack, type RepairedTrackDetail } from "@/services/repaired/client";
import { TrackChartHistorySection } from "@/components/charts/TrackChartHistory";
import { SyncedLyricsDisplay } from "@/components/lyrics/SyncedLyricsDisplay";
import { WkIcon } from "@/components/design-system/Icon";

type TrackViewModel = {
  slug: string;
  title: string;
  artist: string;
  artistSlug: string;
  genre: string;
  label: string;
  labelSlug: string;
  genreSlug: string;
  rank: number;
  peakPosition: number;
  weeksOnChart: number;
  movement: "up" | "down" | "new" | "same";
  movementAmount: number;
  previousWeek: number | null;
  artworkUrl: string;
  duration: number;
  streamCount: string | null;
  releaseYear: string;
  source: string;
  isPlayable: boolean;
  albumTitle: string;
  credits: Array<{ role: string; name: string }>;
  chartHistory: number[];
  streamingLinks: Array<{ platform: string; url: string }>;
  lyrics: string | null;
  lyricsContributor: { name: string; source?: string } | null;
  artistImage: string;
};

function apiToViewModel(api: RepairedTrackDetail): TrackViewModel {
  const raw = api as any;
  const trackData = raw.track ?? raw;
  const metadata = trackData.metadata ?? {};
  const artistData = raw.artist ?? {};
  const releaseData = raw.release ?? trackData.release ?? null;
  const labelData = raw.label ?? null;
  const artistName = artistData.name || metadata.artist_name || metadata.artist || "WAKILISHA Registry";
  const resolvedArtistSlug = artistData.slug || metadata.artistSlug || metadata.artist_slug || "";
  const history = Array.isArray(raw.chartHistory) ? raw.chartHistory : [];
  const currentRank = raw.currentRank ?? metadata.topChartPosition ?? 0;
  const prevRank = raw.previousRank ?? (history.length > 1 ? history[history.length - 2] : 0);

  const rawMovement = String(raw.movement || "").toLowerCase();
  let movement: TrackViewModel["movement"] = ["up", "down", "new", "same"].includes(rawMovement)
    ? (rawMovement as TrackViewModel["movement"])
    : "same";
  let movementAmount = Number(raw.movementAmount ?? 0) || 0;

  if (!rawMovement) {
    if (!prevRank || prevRank <= 0) movement = "new";
    else if (currentRank > 0 && currentRank < prevRank) { movement = "up"; movementAmount = prevRank - currentRank; }
    else if (currentRank > 0 && currentRank > prevRank) { movement = "down"; movementAmount = currentRank - prevRank; }
  }

  const primaryGenre = api.genres && api.genres.length > 0 ? api.genres[0].name : "Unknown";
  const primaryGenreSlug = api.genres && api.genres.length > 0 ? api.genres[0].slug : "";
  const duration = trackData.durationMs ? Math.round(trackData.durationMs / 1000) : (trackData.duration || 0);
  const artworkUrl = trackData.artworkUrl || releaseData?.artworkUrl || artistData?.imageUrl || "";

  return {
    slug: trackData.slug,
    title: trackData.title,
    artist: artistName,
    artistSlug: resolvedArtistSlug,
    genre: primaryGenre,
    genreSlug: primaryGenreSlug,
    label: labelData?.name || metadata.label_name || "Unknown",
    labelSlug: labelData?.slug || "",
    rank: currentRank,
    peakPosition: raw.peakRank ?? metadata.topChartPosition ?? currentRank,
    weeksOnChart: raw.weeksOnChart ?? metadata.chartCount ?? history.length ?? 0,
    movement,
    movementAmount,
    previousWeek: prevRank > 0 ? prevRank : null,
    artworkUrl,
    duration,
    streamCount: null,
    releaseYear: releaseData?.releaseDate ? releaseData.releaseDate.split("-")[0] : String(metadata.release_date || "").slice(0, 4),
    source: "WAKILISHA Registry",
    isPlayable: false,
    albumTitle: releaseData?.title || "",
    credits: [],
    chartHistory: history,
    streamingLinks: [],
    lyrics: null,
    lyricsContributor: null,
    artistImage: artistData.imageUrl || "",
  };
}

function getRelatedTracks(_artistSlug: string, _excludeSlug: string): TrackViewModel[] { return []; }
function getTimedLyrics(_trackSlug: string): any { return undefined; }

const TABS = ["Overview", "Chart stats", "Lyrics", "Credits"] as const;
type Tab = (typeof TABS)[number];

function formatDuration(seconds: number): string {
  if (!seconds || seconds <= 0) return "";
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function MovementBadge({ movement, amount }: { movement?: string; amount?: number }) {
  if (movement === "new") return <span className="rounded bg-[var(--wk-brand-soft)] px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-[var(--wk-brand)]">New</span>;
  if (movement === "up") return <span className="flex items-center gap-0.5 text-[12px] font-bold text-[var(--wk-brand)]"><WkIcon name="ArrowUp" size={13} /> {amount}</span>;
  if (movement === "down") return <span className="flex items-center gap-0.5 text-[12px] font-bold text-[var(--wk-danger)]"><WkIcon name="ArrowDown" size={13} /> {amount}</span>;
  return <span className="text-[12px] text-[var(--wk-text-faint)]">—</span>;
}

function ChartSparkline({ data }: { data: number[] }) {
  if (!data || data.length < 2) return null;
  const max = Math.max(...data);
  const min = Math.min(...data);
  const range = max - min || 1;
  const w = 600;
  const h = 120;
  const padX = 8;
  const padY = 10;
  const step = (w - padX * 2) / (data.length - 1);
  const points = data.map((val, i) => {
    const x = padX + i * step;
    const y = h - padY - ((val - min) / range) * (h - padY * 2);
    return `${x},${y}`;
  });
  const path = points.map((p, i) => `${i === 0 ? "M" : "L"} ${p}`).join(" ");
  const areaPath = `${path} L ${points[points.length - 1].split(",")[0]},${h} L ${points[0].split(",")[0]},${h} Z`;
  return (
    <div className="w-full">
      <svg viewBox={`0 0 ${w} ${h}`} className="h-[120px] w-full" preserveAspectRatio="none">
        <defs>
          <linearGradient id="sparkFillDesktop" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--wk-brand)" stopOpacity="0.2" />
            <stop offset="100%" stopColor="var(--wk-brand)" stopOpacity="0" />
          </linearGradient>
        </defs>
        <path d={areaPath} fill="url(#sparkFillDesktop)" />
        <path d={path} fill="none" stroke="var(--wk-brand)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      <div className="mt-1 flex items-center justify-between text-[10px] text-[var(--wk-text-faint)]"><span>Week {data.length} ago</span><span>Current</span></div>
    </div>
  );
}

function StreamingBadge({ platform }: { platform: string }) {
  const iconMap: Record<string, string> = {
    Spotify: "Radio",
    "Apple Music": "Music2",
    YouTube: "Youtube",
    Tidal: "AudioWaveform",
    Deezer: "Music2",
    Audiomack: "Headphones",
    Boomplay: "PlayCircle",
  };
  const colorMap: Record<string, string> = {
    Spotify: "#1DB954",
    "Apple Music": "#FA243C",
    YouTube: "#FF0000",
    Tidal: "var(--wk-text)",
    Deezer: "#EF5466",
    Audiomack: "#FF8A00",
    Boomplay: "#E91E63",
  };
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-[var(--wk-border)] px-3 py-2 text-[12px] font-semibold text-[var(--wk-text)]">
      <WkIcon name={iconMap[platform] || "Music2"} size={14} style={{ color: colorMap[platform] || "var(--wk-brand)" }} />
      {platform}
    </span>
  );
}

export default function TrackDetail() {
  const { artistSlug, slug } = useParams<{ slug: string }>();
  const { playTrack, currentTrack, isPlaying, togglePlay } = usePlayer();
  const [activeTab, setActiveTab] = useState<Tab>("Overview");
  const [copied, setCopied] = useState(false);
  const [track, setTrack] = useState<TrackViewModel | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    if (!slug) { setLoading(false); setError("No track slug provided"); return; }
    setLoading(true);
    setError(null);
    getTrack(slug, artistSlug)
      .then((apiData) => {
        if (!alive) return;
        if (!apiData) {
          setError("Track not found in the registry.");
          setLoading(false);
          return;
        }
        setTrack(apiToViewModel(apiData));
        setLoading(false);
      })
      .catch((err) => {
        if (!alive) return;
        setError(err instanceof Error ? err.message : "Could not load track.");
        setLoading(false);
      });
    return () => { alive = false; };
  }, [artistSlug, slug]);

  if (loading) {
    return (
      <main className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="mx-auto mb-4 h-20 w-20 rounded-2xl bg-[var(--wk-surface-raised)] animate-pulse" />
          <p className="text-[15px] font-semibold text-[var(--wk-text-muted)]">Loading track&hellip;</p>
        </div>
      </main>
    );
  }

  if (error || !track) {
    return (
      <main className="min-h-screen px-6 py-20 text-center">
        <WkIcon name="Music2" size={42} className="mx-auto mb-4 text-[var(--wk-text-faint)]" />
        <h1 className="mb-2 text-[28px] font-black text-[var(--wk-text)]">Track not found</h1>
        <p className="text-[var(--wk-text-muted)]">{error || "This track does not exist in the registry."}</p>
        <Link to="/charts" className="inline-block mt-6 rounded-xl bg-[var(--wk-brand)] px-6 py-3 text-[14px] font-bold text-[var(--wk-brand-on)]">Back to charts</Link>
      </main>
    );
  }

  const related = track.artistSlug ? getRelatedTracks(track.artistSlug, track.slug) : [];
  const isCurrentTrack = currentTrack?.id === track.slug;
  const isTrackPlaying = isCurrentTrack && isPlaying;

  const handlePlay = () => {
    if (!track.isPlayable) return;
    if (isCurrentTrack) { togglePlay(); return; }
    playTrack(
      { id: track.slug, title: track.title, artist: track.artist, artworkUrl: track.artworkUrl, isPlayable: track.isPlayable, source: track.source, duration: track.duration },
      [track].filter((t) => t.isPlayable).map((t) => ({ id: t.slug, title: t.title, artist: t.artist, artworkUrl: t.artworkUrl, isPlayable: t.isPlayable, source: t.source, duration: t.duration }))
    );
  };

  const handleShare = () => {
    navigator.clipboard?.writeText(window.location.href);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <main className="min-h-screen">
      <section className="track40-hero relative flex min-h-[420px] items-end overflow-hidden lg:min-h-[520px]">
        {track.artworkUrl && <>
          <div className="absolute inset-0" style={{ backgroundImage: `url(${track.artworkUrl})`, backgroundSize: "cover", backgroundPosition: "center" }} />
          <div className="absolute inset-0 bg-gradient-to-t from-[var(--wk-bg)] via-[var(--wk-bg)]/70 to-[var(--wk-bg)]/30" />
        </>}
        <div className="relative w-full px-6 pb-8 pt-20 lg:px-10 lg:pb-12 lg:pt-24">
          <div className="mx-auto max-w-[1100px]">
            <div className="mb-3 flex items-center gap-3">
              <Link to="/charts" className="flex items-center gap-2 text-[11px] font-extrabold uppercase tracking-[0.22em] text-[var(--wk-brand)]"><span className="h-px w-5 bg-[var(--wk-brand)]" />Charts</Link>
              {track.rank > 0 && <span className="rounded-full bg-[var(--wk-brand-soft)] px-2.5 py-0.5 text-[10px] font-bold uppercase text-[var(--wk-brand)]">#{track.rank}</span>}
              {track.movement === "new" && <span className="rounded-full bg-[var(--wk-brand)] px-2.5 py-0.5 text-[10px] font-bold uppercase text-[var(--wk-brand-on)]">New Entry</span>}
            </div>
            <h1 className="font-black leading-[0.92] tracking-[-0.04em] text-[var(--wk-text)]" style={{ fontSize: "clamp(36px, 6vw, 72px)" }}>{track.title}</h1>
            <div className="mt-3 flex flex-wrap items-center gap-2 text-[14px] text-[var(--wk-text-muted)]">
              {track.artistSlug ? (
                <Link to={`/artists/${track.artistSlug}`} className="font-semibold text-[var(--wk-text-soft)] hover:text-[var(--wk-brand)] transition-colors">{track.artist}</Link>
              ) : (
                <span className="font-semibold text-[var(--wk-text-soft)]">{track.artist}</span>
              )}
              {track.genre && track.genre !== "Unknown" && (
                <>
                  <span>·</span>
                  <Link to={`/genres/${track.genreSlug}`} className="hover:text-[var(--wk-brand)] transition-colors">{track.genre}</Link>
                </>
              )}
              {track.label && track.label !== "Unknown" && (
                <>
                  <span>·</span>
                  <Link to={`/labels/${track.labelSlug}`} className="hover:text-[var(--wk-brand)] transition-colors">{track.label}</Link>
                </>
              )}
            </div>
            <div className="mt-4 flex flex-wrap items-center gap-4 text-[12px] text-[var(--wk-text-muted)]">
              {track.streamCount && <span className="inline-flex items-center gap-1"><WkIcon name="Headphones" size={14} className="text-[var(--wk-brand)]" />{track.streamCount}</span>}
              {track.duration > 0 && <span className="inline-flex items-center gap-1"><WkIcon name="Clock3" size={14} />{formatDuration(track.duration)}</span>}
              {track.peakPosition > 0 && <span className="inline-flex items-center gap-1"><WkIcon name="Trophy" size={14} className="text-[var(--wk-brand)]" />Peak #{track.peakPosition}</span>}
              {track.releaseYear && <span className="inline-flex items-center gap-1"><WkIcon name="Calendar" size={14} />{track.releaseYear}</span>}
            </div>
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-[1100px] px-6 lg:px-10">
        <div className="flex gap-3 py-5">
          <button onClick={handlePlay} disabled={!track.isPlayable} className="flex h-14 flex-1 items-center justify-center gap-2 rounded-xl bg-[var(--wk-brand)] text-[15px] font-bold text-[var(--wk-brand-on)] transition-all hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40">
            <WkIcon name={isTrackPlaying ? "Pause" : "Play"} size={18} />{isTrackPlaying ? "Pause" : track.isPlayable ? "Play" : "Preview"}
          </button>
          <button onClick={handleShare} className="flex h-14 flex-1 items-center justify-center gap-2 rounded-xl border border-[var(--wk-border)] bg-[var(--wk-surface)] text-[15px] font-bold text-[var(--wk-text)] transition-all hover:bg-[var(--wk-surface-raised)]">
            <WkIcon name={copied ? "Check" : "Share2"} size={18} className={copied ? "text-[var(--wk-success)]" : undefined} />{copied ? "Copied" : "Share"}
          </button>
        </div>

        {track.streamingLinks && track.streamingLinks.length > 0 && (
          <div className="flex flex-wrap gap-2 pb-5">
            <span className="mb-1 w-full text-[11px] font-bold uppercase tracking-wider text-[var(--wk-text-muted)]">Listen on</span>
            {track.streamingLinks.map((link) => <StreamingBadge key={link.platform} platform={link.platform} />)}
          </div>
        )}

        <div className="flex gap-0 overflow-x-auto border-b border-[var(--wk-divider)]" style={{ scrollbarWidth: "none" }}>
          {TABS.map((tab) => (
            <button key={tab} onClick={() => setActiveTab(tab)} className={`whitespace-nowrap py-3 pr-5 text-[13px] font-bold transition-all ${activeTab === tab ? "border-b-[2px] border-[var(--wk-brand)] text-[var(--wk-brand)]" : "text-[var(--wk-text-faint)] hover:text-[var(--wk-text-muted)]"}`}>
              {tab}
            </button>
          ))}
        </div>

        <div className="pb-6">
          {activeTab === "Overview" && <OverviewTab track={track} related={related} />}
          {activeTab === "Chart stats" && <ChartStatsTab track={track} />}
          {activeTab === "Lyrics" && <LyricsTab track={track} />}
          {activeTab === "Credits" && <CreditsTab track={track} />}
        </div>

        {track.artistSlug && (
          <div className="border-t border-[var(--wk-border)] py-8">
            <h3 className="mb-4 text-[12px] font-black uppercase tracking-wider text-[var(--wk-text-muted)]">Artist</h3>
            <Link to={`/artists/${track.artistSlug}`} className="flex items-center gap-4 rounded-xl border border-[var(--wk-border)] bg-[var(--wk-surface)] p-4 transition-all hover:bg-[var(--wk-surface-raised)]">
              <div className="flex h-14 w-14 items-center justify-center overflow-hidden rounded-full bg-[var(--wk-surface-raised)]">
                {track.artistImage ? <img src={track.artistImage} alt={track.artist} className="h-full w-full object-cover" /> : <WkIcon name="User" size={20} className="text-[var(--wk-text-muted)]" />}
              </div>
              <div className="min-w-0 flex-1">
                <div className="truncate text-[15px] font-bold text-[var(--wk-text)]">{track.artist}</div>
                <div className="text-[12px] text-[var(--wk-text-muted)]">View artist page</div>
              </div>
              <WkIcon name="ChevronRight" size={18} className="text-[var(--wk-text-faint)]" />
            </Link>
          </div>
        )}
      </div>
    </main>
  );
}

function OverviewTab({ track, related }: { track: TrackViewModel; related: TrackViewModel[] }) {
  return (
    <div>
      <div className="grid grid-cols-4 gap-px border-b border-[var(--wk-border)]" style={{ background: "var(--wk-border)" }}>
        {[{ label: "Rank", value: track.rank > 0 ? `#${track.rank}` : "—" },{ label: "Peak", value: track.peakPosition > 0 ? `#${track.peakPosition}` : "—" },{ label: "Weeks", value: track.weeksOnChart || "—" },{ label: "Year", value: track.releaseYear || "—" }].map((stat) => (
          <div key={stat.label} className="bg-[var(--wk-surface)] px-3 py-4 text-center lg:py-5">
            <div className="text-[20px] font-black text-[var(--wk-brand)] lg:text-[24px]">{stat.value}</div>
            <div className="mt-1 text-[10px] font-bold uppercase tracking-wider text-[var(--wk-text-muted)]">{stat.label}</div>
          </div>
        ))}
      </div>
      <MetaRows track={track} />
      {related.length > 0 && (
        <div className="py-6">
          <div className="mb-4 text-[12px] font-black uppercase tracking-wider text-[var(--wk-text-muted)]">More from {track.artist.split(" ft.")[0].split(" ft ")[0]}</div>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {related.map((rel) => (
              <Link key={rel.slug} to={`/tracks/${rel.slug}`} className="overflow-hidden rounded-xl border border-[var(--wk-border)] bg-[var(--wk-surface)] transition-all hover:border-[var(--wk-brand)]">
                <div className="relative aspect-square bg-[var(--wk-surface-raised)]">
                  <img src={rel.artworkUrl} alt={rel.title} className="h-full w-full object-cover" />
                  {rel.rank > 0 && <div className="absolute left-2 top-2 flex h-7 w-7 items-center justify-center rounded-full bg-black/60 text-[11px] font-black text-white">#{rel.rank}</div>}
                </div>
                <div className="p-3">
                  <div className="truncate text-[13px] font-bold text-[var(--wk-text)]">{rel.title}</div>
                  <div className="truncate text-[11px] text-[var(--wk-text-muted)]">{rel.artist}</div>
                  <div className="mt-1 text-[10px] text-[var(--wk-text-faint)]">{rel.weeksOnChart} wks on chart</div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function MetaRows({ track }: { track: TrackViewModel }) {
  const rows = [
    { label: "Genre", value: track.genre, link: track.genre && track.genre !== "Unknown" ? `/genres/${track.genreSlug}` : undefined },
    { label: "Label", value: track.label, link: track.label && track.label !== "Unknown" ? `/labels/${track.labelSlug}` : undefined },
    track.albumTitle ? { label: "Album", value: track.albumTitle } : null,
    track.releaseYear ? { label: "Released", value: track.releaseYear } : null,
    track.source ? { label: "Source", value: track.source } : null,
    { label: "Playable", value: track.isPlayable ? "Full track" : "Preview only" },
  ].filter(Boolean) as Array<{ label: string; value: string | number; link?: string }>;
  return (
    <div className="divide-y divide-[var(--wk-divider)] border-b border-[var(--wk-divider)]">
      {rows.map((row) => (
        <div key={row.label} className="flex items-center justify-between px-4 py-3 lg:px-6 lg:py-4">
          <span className="text-[14px] text-[var(--wk-text-soft)]">{row.label}</span>
          {row.link ? (
            <Link to={row.link} className="text-[15px] font-bold text-[var(--wk-text)] hover:text-[var(--wk-brand)] transition-colors">{row.value}</Link>
          ) : (
            <span className="text-[15px] font-bold text-[var(--wk-text)]">{row.value}</span>
          )}
        </div>
      ))}
    </div>
  );
}

function ChartStatsTab({ track }: { track: TrackViewModel }) {
  return (
    <div>
      {track.chartHistory && track.chartHistory.length > 1 && (
        <div className="border-b border-[var(--wk-divider)] px-4 py-6 lg:px-6 lg:py-8">
          <div className="mb-3 text-[12px] font-black uppercase tracking-wider text-[var(--wk-text-muted)]">Chart journey · {track.chartHistory.length} weeks</div>
          <div className="mb-4 flex items-end gap-6">
            <div>
              <div className="text-[10px] uppercase tracking-wider text-[var(--wk-text-faint)]">Current</div>
              <div className="text-[32px] font-black text-[var(--wk-brand)]">#{track.rank}</div>
            </div>
            <div className="h-10 w-px bg-[var(--wk-divider)]" />
            <div>
              <div className="text-[10px] uppercase tracking-wider text-[var(--wk-text-faint)]">Peak</div>
              <div className="text-[24px] font-black text-[var(--wk-text)]">#{track.peakPosition}</div>
            </div>
            <div className="h-10 w-px bg-[var(--wk-divider)]" />
            <div>
              <div className="text-[10px] uppercase tracking-wider text-[var(--wk-text-faint)]">Weeks</div>
              <div className="text-[24px] font-black text-[var(--wk-text)]">{track.weeksOnChart}</div>
            </div>
          </div>
          <ChartSparkline data={track.chartHistory} />
        </div>
      )}

      <TrackChartHistorySection
        trackSlug={track.slug}
        trackRank={track.rank ?? 0}
        trackPeak={track.peakPosition ?? 0}
        trackWeeks={track.weeksOnChart ?? 0}
        trackHistory={track.chartHistory}
      />

      <div className="divide-y divide-[var(--wk-divider)] border-b border-[var(--wk-divider)]">
        {([
          track.rank > 0 ? { label: "Current position", value: `#${track.rank}` } : null,
          track.peakPosition > 0 ? { label: "Peak position", value: `#${track.peakPosition}` } : null,
          track.weeksOnChart > 0 ? { label: "Weeks on chart", value: track.weeksOnChart } : null,
          track.previousWeek && track.previousWeek > 0 ? { label: "Previous week", value: `#${track.previousWeek}` } : null,
          track.duration > 0 ? { label: "Duration", value: formatDuration(track.duration) } : null,
          track.streamCount ? { label: "Verified streams", value: track.streamCount } : null,
        ].filter(Boolean) as Array<{ label: string; value: string | number }>).map((row) => (
          <div key={row.label} className="flex items-center justify-between px-4 py-3 lg:px-6 lg:py-4">
            <span className="text-[14px] text-[var(--wk-text-soft)]">{row.label}</span>
            <span className="text-[15px] font-bold text-[var(--wk-text)]">{row.value}</span>
          </div>
        ))}
        <div className="flex items-center justify-between px-4 py-3 lg:px-6 lg:py-4">
          <span className="text-[14px] text-[var(--wk-text-soft)]">Movement</span>
          <MovementBadge movement={track.movement} amount={track.movementAmount} />
        </div>
      </div>
    </div>
  );
}

function LyricsTab({ track }: { track: TrackViewModel }) {
  const { isPlaying, currentTrack } = usePlayer();
  const timedLyrics = getTimedLyrics(track.slug);
  const isThisTrackPlaying = currentTrack?.id === track.slug && isPlaying;

  const handleContribute = () => {
    window.REACT_APP_NAVIGATE?.(artistSlug ? `/tracks/${artistSlug}/${track.slug}/lyrics/contribute` : `/tracks/${track.slug}/lyrics/contribute`);
  };

  if (timedLyrics && timedLyrics.lines && timedLyrics.lines.length > 0) {
    return (
      <div className="px-4 py-6 lg:px-6 lg:py-8">
        <div className="mb-5 flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 rounded-xl border border-[var(--wk-border)] bg-[var(--wk-surface)] px-4 py-2.5 text-[12px] text-[var(--wk-text-muted)]">
            <WkIcon name="UserStar" size={15} className="text-[var(--wk-brand)]" />
            <span>
              Contributed by <span className="font-bold text-[var(--wk-text)]">{timedLyrics.submitterName}</span>
              {timedLyrics.sourceDescription && (
                <span className="text-[var(--wk-text-faint)]"> · {timedLyrics.sourceDescription}</span>
              )}
            </span>
          </div>
          <div className="flex items-center gap-1.5 rounded-xl border border-[var(--wk-border)] bg-[var(--wk-surface)] px-3 py-2.5 text-[12px]">
            <button className="flex items-center gap-1 rounded-lg px-2 py-1 transition-all hover:bg-[var(--wk-brand)]/10 hover:text-[var(--wk-brand)]" title="Upvote">
              <WkIcon name="ArrowUp" size={14} />
              <span className="text-[var(--wk-text)] font-semibold">{timedLyrics.upvotes}</span>
            </button>
            <span className="h-4 w-px bg-[var(--wk-divider)]" />
            <button className="flex items-center gap-1 rounded-lg px-2 py-1 transition-all hover:bg-red-500/10 hover:text-red-500" title="Downvote">
              <WkIcon name="ArrowDown" size={14} />
              <span className="text-[var(--wk-text-muted)]">{timedLyrics.downvotes}</span>
            </button>
          </div>
          {timedLyrics.status === 'approved' ? (
            <span className="rounded-full bg-emerald-500/10 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-emerald-600">Verified</span>
          ) : timedLyrics.status === 'pending_review' ? (
            <span className="rounded-full bg-amber-500/10 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-amber-600">Under Review</span>
          ) : null}
          <button onClick={handleContribute} className="ml-auto flex items-center gap-1.5 rounded-xl border border-[var(--wk-border)] bg-[var(--wk-surface)] px-4 py-2.5 text-[12px] font-semibold text-[var(--wk-text-soft)] transition-all hover:border-[var(--wk-brand)] hover:text-[var(--wk-brand)]">
            <WkIcon name="Edit" size={13} />
            Submit revision
          </button>
        </div>
        <SyncedLyricsDisplay lines={timedLyrics.lines} isPlaying={isThisTrackPlaying} />
        {!isThisTrackPlaying && (
          <div className="mt-4 text-center text-[12px] text-[var(--wk-text-faint)]">
            Play this track to see lyrics come alive
          </div>
        )}
      </div>
    );
  }

  if (!track.lyrics) {
    return (
      <div className="py-16 text-center">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-[var(--wk-surface-raised)]">
          <WkIcon name="FileText" size={32} className="text-[var(--wk-text-faint)]" />
        </div>
        <h3 className="mb-2 text-[18px] font-bold text-[var(--wk-text)]">No lyrics yet</h3>
        <p className="mx-auto mb-6 max-w-[360px] text-[14px] leading-relaxed text-[var(--wk-text-muted)]">
          Be the first to contribute timed lyrics for this track. Your name gets credited and the community votes on accuracy.
        </p>
        <button onClick={handleContribute} className="inline-flex items-center gap-2 rounded-xl bg-[var(--wk-brand)] px-6 py-3 text-[14px] font-bold text-[var(--wk-brand-on)] transition-all hover:opacity-90">
          <WkIcon name="Edit" size={16} />
          Contribute lyrics
        </button>
        <div className="mt-5 flex items-center justify-center gap-5 text-[11px] text-[var(--wk-text-faint)]">
          <span className="inline-flex items-center gap-1"><WkIcon name="UserStar" size={14} /> You get credit</span>
          <span className="inline-flex items-center gap-1"><WkIcon name="Users" size={14} /> Community reviewed</span>
          <span className="inline-flex items-center gap-1"><WkIcon name="Clock3" size={14} /> Timed &amp; synced</span>
        </div>
      </div>
    );
  }

  return (
    <div className="px-4 py-6 lg:px-6 lg:py-8">
      {track.lyricsContributor && (
        <div className="mb-5 flex items-center gap-2 rounded-xl border border-[var(--wk-border)] bg-[var(--wk-surface)] px-4 py-3 text-[12px] text-[var(--wk-text-muted)]">
          <WkIcon name="UserStar" size={16} className="text-[var(--wk-brand)]" />
          <span>Contributed by <span className="font-bold text-[var(--wk-text)]">{track.lyricsContributor.name}</span>{track.lyricsContributor.source && <span className="text-[var(--wk-text-faint)]"> · {track.lyricsContributor.source}</span>}</span>
        </div>
      )}
      <div className="rounded-2xl border border-[var(--wk-border)] bg-[var(--wk-surface)] p-6 lg:p-8">
        <p className="text-[16px] leading-[2] text-[var(--wk-text)] lg:text-[18px] lg:leading-[2.2]">
          <span className="float-left mr-3 mt-1 font-black leading-none text-[var(--wk-brand)]" style={{ fontSize: "clamp(44px, 6vw, 72px)" }}>{track.lyrics.charAt(0)}</span>
          <span className="whitespace-pre-line">{track.lyrics.slice(1)}</span>
        </p>
      </div>
    </div>
  );
}

function CreditsTab({ track }: { track: TrackViewModel }) {
  if (!track.credits || track.credits.length === 0) {
    return (
      <div className="px-4 py-12 text-center text-[var(--wk-text-muted)]">
        <WkIcon name="Users" size={36} className="mx-auto mb-3" />
        <p className="text-[14px]">No credit information available.</p>
      </div>
    );
  }
  return (
    <div className="divide-y divide-[var(--wk-divider)] border-b border-[var(--wk-divider)]">
      {track.credits.map((credit, i) => (
        <div key={i} className="flex items-center justify-between px-4 py-3 lg:px-6 lg:py-4">
          <span className="text-[13px] text-[var(--wk-text-faint)]">{credit.role}</span>
          <span className="text-[14px] font-bold text-[var(--wk-text)]">{credit.name}</span>
        </div>
      ))}
    </div>
  );
}