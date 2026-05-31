import { useNavigate } from "react-router-dom";
import { usePlayer } from "@/context/PlayerContext";
import { WkIcon } from "@/components/design-system/Icon";

const LYRICS = [
  "The culture lives in the numbers",
  "From the coast to the valley",
  "We index the rhythm of the continent",
  "Charts in motion, every week",
];

export default function MobilePlayer() {
  const nav = useNavigate();
  const { currentTrack, isPlaying, togglePlay, next, prev, canGoNext, canGoPrev, currentTime, duration, progress, seek, queue, queueIndex } = usePlayer();

  if (!currentTrack) {
    return (
      <div className="wk-mobile-v5 flex min-h-screen flex-col items-center justify-center px-6 text-center">
        <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-[var(--wk-surface-raised)]"><WkIcon name="Music2" size={26} className="text-[var(--wk-text-faint)]" /></div>
        <h2 className="fp-track-name">No track playing</h2>
        <p className="mt-2 text-[13px] text-[var(--wk-text-muted)]">Tap play on any track to start listening.</p>
        <button onClick={() => nav(-1)} className="mt-6 auth-btn auth-btn-primary">Go back</button>
      </div>
    );
  }

  const formatTime = (seconds: number) => `${Math.floor(seconds / 60)}:${Math.floor(seconds % 60).toString().padStart(2, "0")}`;
  const pct = Math.max(0, Math.min(1, progress || 0));
  const activeLyric = Math.floor((currentTime / (duration || 1)) * LYRICS.length) % LYRICS.length;

  return (
    <div className="wk-mobile-v5 full-player mobile-full-player">
      <div className="fp-ambient" style={{ backgroundImage: currentTrack.artworkUrl ? `radial-gradient(circle at 50% 20%, rgba(var(--wk-brand-rgb),.22), transparent 55%), url(${currentTrack.artworkUrl})` : undefined, backgroundSize: "cover", filter: "blur(70px)", opacity: .32 }} />
      <div className="fp-topbar">
        <button className="fp-topbar-btn" onClick={() => nav(-1)} aria-label="Collapse player"><WkIcon name="ChevronDown" size={22} /></button>
        <div className="fp-topbar-title">Now Playing</div>
        <button className="fp-topbar-btn" aria-label="More player actions"><WkIcon name="MoreHorizontal" size={20} /></button>
      </div>

      <div className="fp-art-zone">
        {currentTrack.artworkUrl ? <img src={currentTrack.artworkUrl} alt={currentTrack.title} /> : <div className="aspect-square bg-[var(--wk-surface-raised)]" />}
      </div>

      <div className="fp-controls">
        <div className="fp-track-info">
          <div className="min-w-0">
            <h1 className="fp-track-name">{currentTrack.title}</h1>
            <div className="fp-track-artist">{currentTrack.artist}{currentTrack.source ? ` · ${currentTrack.source}` : ""}</div>
          </div>
          <button className="fp-like" aria-label="Save track"><WkIcon name="Heart" size={23} /></button>
        </div>

        <div className="fp-scrub">
          <div className="fp-scrub-bar" onClick={(e) => { const r = e.currentTarget.getBoundingClientRect(); seek(((e.clientX - r.left) / r.width) * duration); }}>
            <div className="fp-scrub-fill" style={{ width: `${pct * 100}%` }} />
            <div className="fp-scrub-thumb" style={{ left: `${pct * 100}%` }} />
          </div>
          <div className="fp-times"><span>{formatTime(currentTime)}</span><span>{formatTime(duration)}</span></div>
        </div>

        <div className="fp-btns">
          <button className="fp-btn" aria-label="Shuffle"><WkIcon name="Shuffle" size={22} /></button>
          <button className="fp-btn" onClick={prev} disabled={!canGoPrev} aria-label="Previous"><WkIcon name="SkipBack" size={24} /></button>
          <button className="fp-play-btn" onClick={togglePlay} disabled={currentTrack.isPlayable === false} aria-label={isPlaying ? "Pause" : "Play"}><WkIcon name={isPlaying ? "Pause" : "Play"} size={28} /></button>
          <button className="fp-btn" onClick={next} disabled={!canGoNext} aria-label="Next"><WkIcon name="SkipForward" size={24} /></button>
          <button className="fp-btn" aria-label="Repeat"><WkIcon name="Repeat2" size={22} /></button>
        </div>

        <div className="fp-lyrics">
          <p className="fp-lyric active">{LYRICS[activeLyric]}</p>
          <p className="fp-lyric">{LYRICS[(activeLyric + 1) % LYRICS.length]}</p>
        </div>

        {queue.length > 1 && <div className="mt-4 text-center text-[11px] text-[var(--wk-text-faint)]">{queueIndex + 1} / {queue.length} in queue</div>}
      </div>
    </div>
  );
}
