import { useState } from "react";
import { useParams, Link } from "react-router-dom";
import { usePlayer } from "@/context/PlayerContext";
const TRACK_DETAILS: any[] = [];
function getTrackBySlug(_slug: string): any { return undefined; }
function getRelatedTracks(_artistSlug: string, _excludeSlug: string): any[] { return []; }
function getTimedLyrics(_trackSlug: string): any { return undefined; }
import { TrackChartHistorySection } from "@/components/charts/TrackChartHistory";
import { SyncedLyricsDisplay } from "@/components/lyrics/SyncedLyricsDisplay";
import { WkIcon } from "@/components/design-system/Icon";

const TABS = ["Overview", "Chart stats", "Lyrics", "Credits"] as const;
type Tab = typeof TABS[number];

function formatDuration(seconds: number): string {
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

function ChartSparklineMobile({ data }: { data: number[] }) {
  if (!data || data.length < 2) return null;
  const max = Math.max(...data);
  const min = Math.min(...data);
  const range = max - min || 1;
  const w = 300;
  const h = 64;
  const padX = 4;
  const padY = 6;
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
      <svg viewBox={`0 0 ${w} ${h}`} className="h-[64px] w-full" preserveAspectRatio="none">
        <defs>
          <linearGradient id="sparkFillMob" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--wk-brand)" stopOpacity="0.2" />
            <stop offset="100%" stopColor="var(--wk-brand)" stopOpacity="0" />
          </linearGradient>
        </defs>
        <path d={areaPath} fill="url(#sparkFillMob)" />
        <path d={path} fill="none" stroke="var(--wk-brand)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      <div className="mt-1 flex items-center justify-between text-[9px] text-[var(--wk-text-faint)]"><span>Week {data.length} ago</span><span>Current</span></div>
    </div>
  );
}

function StreamingBadge({ platform }: { platform: string }) {
  const iconMap: Record<string, any> = {
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
    <span className="inline-flex items-center gap-1 rounded-full border border-[var(--wk-border)] px-2.5 py-1.5 text-[11px] font-semibold text-[var(--wk-text)]">
      <WkIcon name={iconMap[platform] || "Music2"} size={13} style={{ color: colorMap[platform] || "var(--wk-brand)" }} />
      {platform}
    </span>
  );
}

export default function MobileTrackDetail() {
  const { slug } = useParams<{ slug: string }>();
  const { playTrack, currentTrack, isPlaying, togglePlay } = usePlayer();
  const [activeTab, setActiveTab] = useState<Tab>("Overview");
  const [copied, setCopied] = useState(false);

  const track = getTrackBySlug(slug || "");
  const related = track?.artistSlug ? getRelatedTracks(track.artistSlug, track.slug) : [];

  if (!track) {
    return (
      <div className="wk-mobile-v5 px-5 py-20 text-center">
        <WkIcon name="Music2" size={38} className="mx-auto mb-3 text-[var(--wk-text-faint)]" />
        <p className="text-[var(--wk-text-muted)]">Track not found</p>
        <Link to="/charts" className="mt-4 inline-block text-[14px] font-bold text-[var(--wk-brand)]">Back to charts</Link>
      </div>
    );
  }

  const isCurrentTrack = currentTrack?.id === track.slug;
  const isTrackPlaying = isCurrentTrack && isPlaying;

  const handlePlay = () => {
    if (!track.isPlayable) return;
    if (isCurrentTrack) { togglePlay(); return; }
    playTrack(
      { id: track.slug, title: track.title, artist: track.artist, artworkUrl: track.artworkUrl, isPlayable: track.isPlayable, source: track.source, duration: track.duration },
      TRACK_DETAILS.filter((t) => t.isPlayable).map((t) => ({ id: t.slug, title: t.title, artist: t.artist, artworkUrl: t.artworkUrl, isPlayable: t.isPlayable, source: t.source, duration: t.duration }))
    );
  };

  const handleShare = () => {
    navigator.clipboard?.writeText(window.location.href);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="wk-mobile-v5 min-h-screen">
      <section className="relative flex min-h-[300px] items-end overflow-hidden">
        {track.artworkUrl && <><div className="absolute inset-0" style={{ backgroundImage: `url(${track.artworkUrl})`, backgroundSize: "cover", backgroundPosition: "center" }} /><div className="absolute inset-0 bg-gradient-to-t from-[var(--wk-bg)] via-[var(--wk-bg)]/70 to-[var(--wk-bg)]/30" /></>}
        <div className="relative w-full px-5 pb-6 pt-16">
          <div className="mb-2 flex items-center gap-2">
            <Link to="/charts" className="flex items-center gap-2 text-[10px] font-extrabold uppercase tracking-[0.22em] text-[var(--wk-brand)]"><span className="h-px w-5 bg-[var(--wk-brand)]" />Charts</Link>
            <span className="rounded-full bg-[var(--wk-brand-soft)] px-2 py-0.5 text-[9px] font-bold uppercase text-[var(--wk-brand)]">#{track.rank}</span>
            {track.movement === "new" && <span className="rounded-full bg-[var(--wk-brand)] px-2 py-0.5 text-[9px] font-bold uppercase text-[var(--wk-brand-on)]">New Entry</span>}
          </div>
          <h1 className="font-black leading-[0.92] tracking-[-0.04em] text-[var(--wk-text)]" style={{ fontSize: "clamp(28px, 9vw, 44px)" }}>{track.title}</h1>
          <div className="mt-2 flex flex-wrap items-center gap-2 text-[13px] text-[var(--wk-text-muted)]">
            {track.artistSlug ? <Link to={`/artists/${track.artistSlug}`} className="font-semibold text-[var(--wk-text-soft)]">{track.artist}</Link> : <span className="font-semibold text-[var(--wk-text-soft)]">{track.artist}</span>}
            <span>·</span><span>{track.genre}</span><span>·</span><span>{track.label}</span>
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-3 text-[11px] text-[var(--wk-text-muted)]">
            {track.streamCount && <span className="inline-flex items-center gap-1"><WkIcon name="Headphones" size={13} className="text-[var(--wk-brand)]" />{track.streamCount}</span>}
            {track.duration && <span className="inline-flex items-center gap-1"><WkIcon name="Clock3" size={13} />{formatDuration(track.duration)}</span>}
            {track.peakPosition && <span className="inline-flex items-center gap-1"><WkIcon name="Trophy" size={13} className="text-[var(--wk-brand)]" />Peak #{track.peakPosition}</span>}
          </div>
        </div>
      </section>

      <div className="flex gap-3 px-5 py-4">
        <button onClick={handlePlay} disabled={!track.isPlayable} className="mobile-pressable flex h-12 flex-1 items-center justify-center gap-2 rounded-xl bg-[var(--wk-brand)] text-[14px] font-bold text-[var(--wk-brand-on)] disabled:cursor-not-allowed disabled:opacity-40">
          <WkIcon name={isTrackPlaying ? "Pause" : "Play"} size={16} />{isTrackPlaying ? "Pause" : track.isPlayable ? "Play" : "Preview"}
        </button>
        <button onClick={handleShare} className="mobile-pressable flex h-12 flex-1 items-center justify-center gap-2 rounded-xl border border-[var(--wk-border)] bg-[var(--wk-surface)] text-[14px] font-bold text-[var(--wk-text)]">
          <WkIcon name={copied ? "Check" : "Share2"} size={16} className={copied ? "text-[var(--wk-success)]" : undefined} />{copied ? "Copied" : "Share"}
        </button>
      </div>

      {track.streamingLinks && track.streamingLinks.length > 0 && <div className="flex flex-wrap gap-2 px-5 pb-4"><span className="mb-1 w-full text-[10px] font-bold uppercase tracking-wider text-[var(--wk-text-muted)]">Listen on</span>{track.streamingLinks.map((link) => <StreamingBadge key={link.platform} platform={link.platform} />)}</div>}

      <div className="flex gap-0 overflow-x-auto border-b border-[var(--wk-divider)] px-4" style={{ scrollbarWidth: "none" }}>
        {TABS.map((tab) => <button key={tab} onClick={() => setActiveTab(tab)} className={`mobile-pressable whitespace-nowrap py-3 pr-4 text-[12px] font-bold transition-all ${activeTab === tab ? "border-b-[1.5px] border-[var(--wk-brand)] text-[var(--wk-brand)]" : "text-[var(--wk-text-faint)]"}`}>{tab}</button>)}
      </div>

      <div className="pb-4">
        {activeTab === "Overview" && <OverviewTab track={track} related={related} />}
        {activeTab === "Chart stats" && <ChartStatsTab track={track} />}
        {activeTab === "Lyrics" && <LyricsTab track={track} />}
        {activeTab === "Credits" && <CreditsTab track={track} />}
      </div>

      {track.artistSlug && (
        <div className="border-t border-[var(--wk-border)] px-5 py-5">
          <h3 className="mb-3 text-[11px] font-black uppercase tracking-wider text-[var(--wk-text-muted)]">Artist</h3>
          <Link to={`/artists/${track.artistSlug}`} className="mobile-pressable flex items-center gap-3 rounded-xl border border-[var(--wk-border)] bg-[var(--wk-surface)] p-3">
            <div className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-full bg-[var(--wk-surface-raised)]">{track.artistImage ? <img src={track.artistImage} alt={track.artist} className="h-full w-full object-cover" /> : <WkIcon name="User" size={18} className="text-[var(--wk-text-muted)]" />}</div>
            <div className="min-w-0 flex-1"><div className="truncate text-[13px] font-bold text-[var(--wk-text)]">{track.artist}</div><div className="text-[11px] text-[var(--wk-text-muted)]">View artist page</div></div>
            <WkIcon name="ChevronRight" size={16} className="text-[var(--wk-text-faint)]" />
          </Link>
        </div>
      )}
    </div>
  );
}

function OverviewTab({ track, related }: { track: NonNullable<ReturnType<typeof getTrackBySlug>>; related: typeof TRACK_DETAILS }) {
  return <div><div className="grid grid-cols-4 gap-px border-b border-[var(--wk-border)]" style={{ background: "var(--wk-border)" }}>{[{ label: "Rank", value: `#${track.rank}` },{ label: "Peak", value: `#${track.peakPosition}` },{ label: "Weeks", value: track.weeksOnChart },{ label: "Year", value: track.releaseYear || "—" }].map((stat) => <div key={stat.label} className="bg-[var(--wk-surface)] px-2 py-3 text-center"><div className="text-[16px] font-black text-[var(--wk-brand)]">{stat.value}</div><div className="text-[9px] font-bold uppercase tracking-wider text-[var(--wk-text-muted)]">{stat.label}</div></div>)}</div><MetaRows track={track} />{related.length > 0 && <div className="px-5 py-5"><div className="mb-3 text-[11px] font-black uppercase tracking-wider text-[var(--wk-text-muted)]">More from {track.artist.split(" ft.")[0].split(" ft ")[0]}</div><div className="grid grid-cols-2 gap-3">{related.map((rel) => <Link key={rel.slug} to={`/tracks/${rel.slug}`} className="mobile-pressable overflow-hidden rounded-xl border border-[var(--wk-border)] bg-[var(--wk-surface)]"><div className="relative aspect-square bg-[var(--wk-surface-raised)]"><img src={rel.artworkUrl} alt={rel.title} className="h-full w-full object-cover" />{rel.rank && <div className="absolute left-2 top-2 flex h-6 w-6 items-center justify-center rounded-full bg-black/60 text-[10px] font-black text-white">#{rel.rank}</div>}</div><div className="p-2.5"><div className="truncate text-[12px] font-bold text-[var(--wk-text)]">{rel.title}</div><div className="truncate text-[10px] text-[var(--wk-text-muted)]">{rel.artist}</div><div className="mt-1 text-[9px] text-[var(--wk-text-faint)]">{rel.weeksOnChart} wks on chart</div></div></Link>)}</div></div>}</div>;
}

function MetaRows({ track }: { track: NonNullable<ReturnType<typeof getTrackBySlug>> }) {
  const rows = [{ label: "Genre", value: track.genre }, { label: "Label", value: track.label }, track.albumTitle ? { label: "Album", value: track.albumTitle } : null, track.releaseYear ? { label: "Released", value: track.releaseYear } : null, track.source ? { label: "Source", value: track.source } : null, { label: "Playable", value: track.isPlayable ? "Full track" : "Preview only" }].filter(Boolean) as { label: string; value: string | number }[];
  return <div className="divide-y divide-[var(--wk-divider)] border-b border-[var(--wk-divider)]">{rows.map((row) => <div key={row.label} className="flex items-center justify-between px-5 py-3"><span className="text-[13px] text-[var(--wk-text-soft)]">{row.label}</span><span className="text-[14px] font-bold text-[var(--wk-text)]">{row.value}</span></div>)}</div>;
}

function ChartStatsTab({ track }: { track: NonNullable<ReturnType<typeof getTrackBySlug>> }) {
  return <div>{track.chartHistory && track.chartHistory.length > 1 && <div className="border-b border-[var(--wk-divider)] px-5 py-5"><div className="mb-2 text-[11px] font-black uppercase tracking-wider text-[var(--wk-text-muted)]">Chart journey · {track.chartHistory.length} weeks</div><div className="mb-3 flex items-end gap-4"><div><div className="text-[9px] uppercase tracking-wider text-[var(--wk-text-faint)]">Current</div><div className="text-[24px] font-black text-[var(--wk-brand)]">#{track.rank}</div></div><div className="h-8 w-px bg-[var(--wk-divider)]" /><div><div className="text-[9px] uppercase tracking-wider text-[var(--wk-text-faint)]">Peak</div><div className="text-[18px] font-black text-[var(--wk-text)]">#{track.peakPosition}</div></div><div className="h-8 w-px bg-[var(--wk-divider)]" /><div><div className="text-[9px] uppercase tracking-wider text-[var(--wk-text-faint)]">Weeks</div><div className="text-[18px] font-black text-[var(--wk-text)]">{track.weeksOnChart}</div></div></div><ChartSparklineMobile data={track.chartHistory} /></div>}

      {/* Public chart history from chartsPublic service */}
      <TrackChartHistorySection
        trackSlug={track.slug}
        trackRank={track.rank ?? 0}
        trackPeak={track.peakPosition ?? 0}
        trackWeeks={track.weeksOnChart ?? 0}
        trackHistory={track.chartHistory}
        compact
      />

      <div className="divide-y divide-[var(--wk-divider)] border-b border-[var(--wk-divider)]">{[{ label: "Current position", value: `#${track.rank}` },{ label: "Peak position", value: `#${track.peakPosition}` },{ label: "Weeks on chart", value: track.weeksOnChart },track.previousWeek && track.previousWeek > 0 ? { label: "Previous week", value: `#${track.previousWeek}` } : null,track.duration ? { label: "Duration", value: formatDuration(track.duration) } : null,track.streamCount ? { label: "Verified streams", value: track.streamCount } : null].filter(Boolean).map((row: any) => <div key={row.label} className="flex items-center justify-between px-5 py-3"><span className="text-[13px] text-[var(--wk-text-soft)]">{row.label}</span><span className="text-[14px] font-bold text-[var(--wk-text)]">{row.value}</span></div>)}<div className="flex items-center justify-between px-5 py-3"><span className="text-[13px] text-[var(--wk-text-soft)]">Movement</span><MovementBadge movement={track.movement} amount={track.movementAmount} /></div></div></div>;
}

function LyricsTab({ track }: { track: NonNullable<ReturnType<typeof getTrackBySlug>> }) {
  const { isPlaying, currentTrack } = usePlayer();
  const timedLyrics = getTimedLyrics(track.slug);
  const isThisTrackPlaying = currentTrack?.id === track.slug && isPlaying;

  const handleContribute = () => {
    window.REACT_APP_NAVIGATE?.(`/tracks/${track.slug}/lyrics/contribute`);
  };

  if (timedLyrics && timedLyrics.lines.length > 0) {
    return (
      <div className="px-5 py-5">
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1.5 rounded-xl border border-[var(--wk-border)] bg-[var(--wk-surface)] px-3 py-2 text-[11px] text-[var(--wk-text-muted)]">
            <WkIcon name="UserStar" size={13} className="text-[var(--wk-brand)]" />
            <span>Contributed by <span className="font-bold text-[var(--wk-text)]">{timedLyrics.submitterName}</span></span>
          </div>
          <div className="flex items-center gap-1 rounded-xl border border-[var(--wk-border)] bg-[var(--wk-surface)] px-2.5 py-2 text-[11px]">
            <button className="flex items-center gap-1 rounded-lg px-1.5 py-0.5 transition-all hover:bg-[var(--wk-brand)]/10 hover:text-[var(--wk-brand)]" title="Upvote">
              <WkIcon name="ArrowUp" size={12} /><span className="text-[var(--wk-text)] font-semibold">{timedLyrics.upvotes}</span>
            </button>
            <span className="h-3 w-px bg-[var(--wk-divider)]" />
            <button className="flex items-center gap-1 rounded-lg px-1.5 py-0.5 transition-all hover:bg-red-500/10 hover:text-red-500" title="Downvote">
              <WkIcon name="ArrowDown" size={12} /><span className="text-[var(--wk-text-muted)]">{timedLyrics.downvotes}</span>
            </button>
          </div>
          {timedLyrics.status === 'approved' ? (
            <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-[9px] font-bold uppercase text-emerald-600">Verified</span>
          ) : timedLyrics.status === 'pending_review' ? (
            <span className="rounded-full bg-amber-500/10 px-2 py-0.5 text-[9px] font-bold uppercase text-amber-600">Under Review</span>
          ) : null}
          <button onClick={handleContribute} className="ml-auto flex items-center gap-1 rounded-xl border border-[var(--wk-border)] bg-[var(--wk-surface)] px-3 py-2 text-[11px] font-semibold text-[var(--wk-text-soft)]">
            <WkIcon name="Edit" size={11} /> Revise
          </button>
        </div>
        <SyncedLyricsDisplay lines={timedLyrics.lines} isPlaying={isThisTrackPlaying} />
        {!isThisTrackPlaying && (
          <div className="mt-3 text-center text-[11px] text-[var(--wk-text-faint)]">Play this track to see lyrics come alive</div>
        )}
      </div>
    );
  }

  if (!track.lyrics) return (
    <div className="py-10 text-center">
      <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-[var(--wk-surface-raised)]"><WkIcon name="FileText" size={28} className="text-[var(--wk-text-faint)]" /></div>
      <h3 className="mb-2 text-[16px] font-bold text-[var(--wk-text)]">No lyrics yet</h3>
      <p className="mx-auto mb-5 max-w-[260px] text-[13px] leading-relaxed text-[var(--wk-text-muted)]">Be the first to contribute timed lyrics and get credited.</p>
      <button onClick={handleContribute} className="inline-flex items-center gap-2 rounded-xl bg-[var(--wk-brand)] px-5 py-2.5 text-[13px] font-bold text-white">
        <WkIcon name="Edit" size={14} /> Contribute lyrics
      </button>
      <div className="mt-4 flex items-center justify-center gap-4 text-[10px] text-[var(--wk-text-faint)]">
        <span className="inline-flex items-center gap-1"><WkIcon name="UserStar" size={12} /> You get credit</span>
        <span className="inline-flex items-center gap-1"><WkIcon name="Users" size={12} /> Community reviewed</span>
      </div>
    </div>
  );

  return (
    <div className="px-5 py-5">
      {track.lyricsContributor && <div className="mb-4 flex items-center gap-1.5 rounded-xl border border-[var(--wk-border)] bg-[var(--wk-surface)] px-3 py-2 text-[11px] text-[var(--wk-text-muted)]"><WkIcon name="UserStar" size={14} className="text-[var(--wk-brand)]" /><span>Contributed by <span className="font-bold text-[var(--wk-text)]">{track.lyricsContributor.name}</span>{track.lyricsContributor.source && <span className="text-[var(--wk-text-faint)]"> · {track.lyricsContributor.source}</span>}</span></div>}
      <div className="rounded-2xl border border-[var(--wk-border)] bg-[var(--wk-surface)] p-5"><p className="text-[15px] leading-[2] text-[var(--wk-text)]"><span className="float-left mr-2 mt-1 font-black leading-none text-[var(--wk-brand)]" style={{ fontSize: "clamp(36px, 8vw, 48px)" }}>{track.lyrics.charAt(0)}</span><span className="whitespace-pre-line">{track.lyrics.slice(1)}</span></p></div>
    </div>
  );
}

function CreditsTab({ track }: { track: NonNullable<ReturnType<typeof getTrackBySlug>> }) {
  if (!track.credits || track.credits.length === 0) return <div className="px-5 py-12 text-center text-[var(--wk-text-muted)]"><WkIcon name="Users" size={32} className="mx-auto mb-3" />No credit information available.</div>;
  return <div className="divide-y divide-[var(--wk-divider)] border-b border-[var(--wk-divider)]">{track.credits.map((credit, i) => <div key={i} className="flex items-center justify-between px-5 py-3"><span className="text-[12px] text-[var(--wk-text-faint)]">{credit.role}</span><span className="text-[13px] font-bold text-[var(--wk-text)]">{credit.name}</span></div>)}</div>;
}
