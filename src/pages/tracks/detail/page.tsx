import { Link, useParams } from "react-router-dom";
import { useMemo, useState } from "react";
import { usePlayer } from "@/context/PlayerContext";
import { TRACK_DETAILS, getTrackBySlug, getRelatedTracks } from "@/mocks/trackDetails";
import { ShareButton } from "@/components/design-system/share/ShareSheet";
import { WkIcon } from "@/components/design-system/Icon";

function formatDuration(seconds?: number): string {
  if (!seconds) return "—";
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

const platformIcon = (platform: string) => {
  const key = platform.toLowerCase();
  if (key.includes("youtube")) return "Youtube";
  if (key.includes("apple")) return "Music2";
  if (key.includes("spotify")) return "Radio";
  return "Headphones";
};

export default function TrackDetail() {
  const { slug } = useParams<{ slug: string }>();
  const { playTrack, currentTrack, isPlaying, togglePlay } = usePlayer();
  const [lyricsOpen, setLyricsOpen] = useState(false);
  const track = getTrackBySlug(slug || "");
  const related = track?.artistSlug ? getRelatedTracks(track.artistSlug, track.slug).slice(0, 6) : TRACK_DETAILS.filter((item) => item.slug !== slug).slice(0, 6);

  const queue = useMemo(() => TRACK_DETAILS.filter((item) => item.isPlayable).map((item) => ({
    id: item.slug,
    title: item.title,
    artist: item.artist,
    artworkUrl: item.artworkUrl,
    isPlayable: item.isPlayable,
    source: item.source,
    duration: item.duration,
  })), []);

  if (!track) {
    return (
      <main className="wk-container px-6 py-20 text-center">
        <WkIcon name="Music2" size={42} className="mx-auto mb-4 text-[var(--wk-text-faint)]" />
        <h1 className="wk-h-section mb-2">Track not found</h1>
        <p className="text-[var(--wk-text-muted)]">This track does not exist in the registry.</p>
        <Link to="/charts" className="btn btn-md btn-primary mt-6">Back to charts</Link>
      </main>
    );
  }

  const isCurrentTrack = currentTrack?.id === track.slug;
  const isTrackPlaying = isCurrentTrack && isPlaying;

  const play = () => {
    if (!track.isPlayable) return;
    if (isCurrentTrack) return togglePlay();
    playTrack({ id: track.slug, title: track.title, artist: track.artist, artworkUrl: track.artworkUrl, isPlayable: track.isPlayable, source: track.source, duration: track.duration }, queue);
  };

  const playRelated = (item: typeof track) => {
    if (!item.isPlayable) return;
    playTrack({ id: item.slug, title: item.title, artist: item.artist, artworkUrl: item.artworkUrl, isPlayable: item.isPlayable, source: item.source, duration: item.duration }, queue);
  };

  const waveform = Array.from({ length: 56 }, (_, i) => 18 + Math.round(Math.abs(Math.sin(i * 0.55) * 52) + (i % 7) * 2));
  const history = track.chartHistory ?? [];
  const lyricsPreview = track.lyrics?.split("\n").filter(Boolean).slice(0, 10).join("\n") ?? "Lyrics have not been added to this registry entry yet.";

  return (
    <main className="min-h-screen">
      <section className="track40-hero">
        <div className="track40-ambient" style={{ backgroundImage: `url(${track.artworkUrl})` }} />
        <div className="track40-shade" />
        <div className="track40-inner wk-container-wide">
          <div className="track40-art">
            <img src={track.artworkUrl} alt={track.title} />
            {track.rank && <div className="track40-rank">#{track.rank}</div>}
          </div>
          <div>
            <div className="track40-kicker">
              <span><WkIcon name="Music2" size={13} /> Track page</span>
              {track.movement && <span className="track40-pill brand">{track.movement === "new" ? "New entry" : `${track.movement} ${track.movementAmount ?? ""}`}</span>}
            </div>
            <h1 className="track40-title">{track.title}</h1>
            <div className="track40-artist">
              {track.artistSlug ? <Link to={`/artists/${track.artistSlug}`}>{track.artist}</Link> : <span>{track.artist}</span>}
              <span>·</span><span>{track.label}</span>
              {track.albumTitle && <><span>·</span><span>{track.albumTitle}</span></>}
            </div>
            <div className="track40-meta">
              <span><WkIcon name="Clock3" size={14} /> {formatDuration(track.duration)}</span>
              <span><WkIcon name="Trophy" size={14} /> Peak #{track.peakPosition ?? "—"}</span>
              <span><WkIcon name="Calendar" size={14} /> {track.releaseYear ?? "Year pending"}</span>
              <span><WkIcon name="AudioWaveform" size={14} /> {track.genre}</span>
            </div>
            <div className="track40-actions">
              <button onClick={play} disabled={!track.isPlayable} className="btn btn-lg btn-primary"><WkIcon name={isTrackPlaying ? "Pause" : "Play"} size={18} /> {isTrackPlaying ? "Pause" : "Play"}</button>
              <button className="btn btn-lg btn-ghost"><WkIcon name="Heart" size={18} /> Save</button>
              <ShareButton item={{ title: track.title, subtitle: track.artist, description: `${track.title} by ${track.artist} on WAKILISHA`, imageUrl: track.artworkUrl, type: "track" }} timestamp="0:00" />
              {track.lyrics && <button onClick={() => setLyricsOpen(true)} className="btn btn-lg btn-ghost"><WkIcon name="ScrollText" size={18} /> Lyrics</button>}
            </div>
            <div className="track40-wave" aria-hidden="true">
              {waveform.map((height, i) => <span key={i} className="track40-bar" style={{ height: `${height}%` }} />)}
            </div>
          </div>
        </div>
      </section>

      <div className="track40-body">
        <div className="grid gap-5">
          <section className="track40-card">
            <div className="track40-card-title"><WkIcon name="BarChart3" size={15} /> Chart history</div>
            <div className="track40-chart-grid">
              <Stat value={track.rank ? `#${track.rank}` : "—"} label="Current" />
              <Stat value={track.peakPosition ? `#${track.peakPosition}` : "—"} label="Peak" />
              <Stat value={track.weeksOnChart ?? 0} label="Weeks" />
              <Stat value={track.previousWeek ? `#${track.previousWeek}` : "—"} label="Previous" />
            </div>
            {history.length > 1 && (
              <div className="track40-spark">
                <svg viewBox="0 0 320 100" preserveAspectRatio="none" className="h-full w-full">
                  <polyline fill="none" stroke="var(--wk-brand)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" points={history.map((rank, i) => `${(i / Math.max(1, history.length - 1)) * 320},${Math.min(94, Math.max(6, rank * 4))}`).join(" ")} />
                </svg>
              </div>
            )}
          </section>

          <section className="track40-card">
            <div className="track40-card-title"><WkIcon name="Users" size={15} /> Credits</div>
            {(track.credits ?? [{ role: "Artist", name: track.artist }, { role: "Label", name: track.label }]).map((credit) => (
              <div key={`${credit.role}-${credit.name}`} className="track40-credit">
                <div className="track40-credit-role">{credit.role}</div>
                <div className="track40-credit-name">{credit.name}</div>
              </div>
            ))}
          </section>

          <section className="track40-card">
            <div className="track40-card-title"><WkIcon name="ScrollText" size={15} /> Lyrics / editorial text</div>
            <div className="track40-lyrics">{lyricsPreview}</div>
            {track.lyrics && <button onClick={() => setLyricsOpen(true)} className="btn btn-sm btn-ghost mt-4">Open lyrics</button>}
          </section>
        </div>

        <aside className="track40-side">
          <section className="track40-card">
            <div className="track40-card-title"><WkIcon name="Headphones" size={15} /> Listen on source</div>
            <div className="track40-platforms">
              {(track.streamingLinks ?? [{ platform: track.source || "Source", url: "#" }]).map((link) => (
                <a key={link.platform} href={link.url} className="track40-platform" onClick={(e) => link.url === "#" && e.preventDefault()}>
                  <WkIcon name={platformIcon(link.platform) as any} size={15} /> {link.platform}
                </a>
              ))}
            </div>
          </section>

          <section className="track40-card">
            <div className="track40-card-title"><WkIcon name="Album" size={15} /> Album context</div>
            <div className="artist-list-name">{track.albumTitle ?? "Single / registry track"}</div>
            <div className="artist-list-sub">{track.releaseYear ?? "Year pending"} · {track.label}</div>
            {track.albumSlug && <Link to={`/releases/${track.albumSlug}`} className="btn btn-sm btn-ghost mt-3">Open release</Link>}
          </section>

          <section className="track40-card">
            <div className="track40-card-title"><WkIcon name="Tags" size={15} /> Metadata</div>
            <div className="track40-tags">
              {[track.genre, track.label, track.source, track.releaseYear ? String(track.releaseYear) : null].filter(Boolean).map((tag) => <span key={tag as string} className="tag tag-sm">{tag}</span>)}
            </div>
          </section>

          <section className="track40-card">
            <div className="track40-card-title"><WkIcon name="ListMusic" size={15} /> Related tracks</div>
            {related.map((item) => (
              <div key={item.slug} className="track40-related">
                <Link to={`/tracks/${item.slug}`} className="track40-related-art"><img src={item.artworkUrl} alt="" /></Link>
                <Link to={`/tracks/${item.slug}`} className="min-w-0"><div className="track40-related-title">{item.title}</div><div className="track40-related-sub">{item.artist}</div></Link>
                <button onClick={() => playRelated(item)} className="chart-btn"><WkIcon name="Play" size={14} /></button>
              </div>
            ))}
          </section>
        </aside>
      </div>

      {lyricsOpen && (
        <div className="fixed inset-0 z-[230] flex items-end justify-center bg-black/60 backdrop-blur-sm" onClick={() => setLyricsOpen(false)}>
          <div className="share-sheet max-h-[82vh] overflow-auto" onClick={(e) => e.stopPropagation()}>
            <div className="share-handle" />
            <div className="mb-4 flex items-start justify-between gap-4"><div><div className="share-title">{track.title}</div><div className="share-sub">Lyrics contributed by {track.lyricsContributor?.name ?? "WAKILISHA"}</div></div><button className="chart-btn" onClick={() => setLyricsOpen(false)}><WkIcon name="X" size={16} /></button></div>
            <pre className="whitespace-pre-wrap font-[var(--wk-font-body)] text-[15px] leading-8 text-[var(--wk-text-soft)]">{track.lyrics}</pre>
          </div>
        </div>
      )}
    </main>
  );
}

function Stat({ value, label }: { value: string | number; label: string }) {
  return <div className="track40-stat"><div className="track40-stat-val">{value}</div><div className="track40-stat-lbl">{label}</div></div>;
}
