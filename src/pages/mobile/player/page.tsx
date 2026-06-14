import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { usePlayer } from "@/context/PlayerContext";
import { WkIcon } from "@/components/design-system/Icon";

export default function MobilePlayer() {
  const nav = useNavigate();
  const {
    currentTrack,
    isPlaying,
    togglePlay,
    next,
    prev,
    canGoNext,
    canGoPrev,
    currentTime,
    duration,
    progress,
    seek,
    queue,
    queueIndex,
    isShuffle,
    repeatMode,
    toggleShuffle,
    toggleRepeat,
  } = usePlayer();
  const [liked, setLiked] = useState(false);

  if (!currentTrack) {
    return (
      <div className="wk-mobile-v5 full-player mobile-full-player flex min-h-screen flex-col items-center justify-center px-6 text-center">
        <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-[var(--wk-surface-raised)]"><WkIcon name="Music2" size={26} className="text-[var(--wk-text-faint)]" /></div>
        <h2 className="fp-track-name">No track playing</h2>
        <p className="mt-2 text-[13px] text-[var(--wk-text-muted)]">Tap play on any track to start listening.</p>
        <button onClick={() => nav(-1)} className="mt-6 auth-btn auth-btn-primary">Go back</button>
      </div>
    );
  }

  const formatTime = (seconds: number) => `${Math.floor(seconds / 60)}:${Math.floor(seconds % 60).toString().padStart(2, "0")}`;
  const pct = Math.max(0, Math.min(1, progress || 0));
  const upcoming = queue.slice(queueIndex + 1, queueIndex + 4);

  return (
    <div className="wk-mobile-v5 full-player mobile-full-player">
      <div className="fp-ambient" style={{ backgroundImage: currentTrack.artworkUrl ? `url(${currentTrack.artworkUrl})` : undefined, backgroundSize: "cover", backgroundPosition: "center" }} />
      <div className="fp-topbar">
        <button className="fp-topbar-btn mobile-pressable" onClick={() => nav(-1)} aria-label="Collapse player"><WkIcon name="ChevronDown" size={22} /></button>
        <div className="fp-topbar-title">Now Playing</div>
        <button className="fp-topbar-btn mobile-pressable" aria-label="More player actions"><WkIcon name="MoreHorizontal" size={20} /></button>
      </div>

      <div className="fp-art-zone">
        {currentTrack.artworkUrl ? <img src={currentTrack.artworkUrl} alt={currentTrack.title} className="h-full w-full object-cover" /> : <div className="aspect-square bg-[var(--wk-surface-raised)]" />}
      </div>

      <div className="fp-controls">
        <div className="fp-track-info">
          <div className="min-w-0">
            <h1 className="fp-track-name">{currentTrack.title}</h1>
            <div className="fp-track-artist">{currentTrack.artist}{currentTrack.source ? ` · ${currentTrack.source}` : ""}</div>
          </div>
          <button onClick={() => setLiked((v) => !v)} className={`fp-like mobile-pressable ${liked ? "text-[var(--wk-brand)]" : ""}`} aria-label="Save track"><WkIcon name="Heart" size={23} fill={liked ? "currentColor" : "none"} /></button>
        </div>

        <div className="fp-meta-pills">
          {currentTrack.source && <span className="fp-meta-pill"><WkIcon name="Radio" size={12} /> {currentTrack.source}</span>}
          <span className="fp-meta-pill"><WkIcon name="Clock3" size={12} /> {formatTime(duration || currentTrack.duration || 0)}</span>
          <span className="fp-meta-pill"><WkIcon name="ListMusic" size={12} /> {queue.length || 1} in queue</span>
        </div>

        <div className="fp-scrub">
          <div className="fp-scrub-bar" onClick={(e) => { const r = e.currentTarget.getBoundingClientRect(); seek(((e.clientX - r.left) / r.width) * duration); }}>
            <div className="fp-scrub-fill" style={{ width: `${pct * 100}%` }} />
            <div className="fp-scrub-thumb" style={{ left: `${pct * 100}%` }} />
          </div>
          <div className="fp-times"><span>{formatTime(currentTime)}</span><span>{formatTime(duration)}</span></div>
        </div>

        <div className="fp-btns">
          <button onClick={toggleShuffle} className={`fp-btn mobile-pressable ${isShuffle ? "on" : ""}`} aria-label="Shuffle"><WkIcon name="Shuffle" size={22} /></button>
          <button className="fp-btn mobile-pressable" onClick={prev} disabled={!canGoPrev} aria-label="Previous"><WkIcon name="SkipBack" size={24} /></button>
          <button className="fp-play-btn mobile-pressable" onClick={togglePlay} disabled={currentTrack.isPlayable === false} aria-label={isPlaying ? "Pause" : "Play"}><WkIcon name={isPlaying ? "Pause" : "Play"} size={28} fill="currentColor" /></button>
          <button className="fp-btn mobile-pressable" onClick={next} disabled={!canGoNext} aria-label="Next"><WkIcon name="SkipForward" size={24} /></button>
          <button onClick={toggleRepeat} className={`fp-btn mobile-pressable ${repeatMode !== "off" ? "on" : ""}`} aria-label="Repeat"><WkIcon name={repeatMode === "one" ? "Repeat1" : "Repeat2"} size={22} /></button>
        </div>

        <div className="fp-lyrics">
          <p className="fp-lyric" style={{ opacity: 0.5 }}>No synced lyrics available</p>
        </div>

        {upcoming.length > 0 && (
          <div className="fp-queue-strip">
            <div className="fp-queue-head"><span>Up next</span><span>{queueIndex + 1} / {queue.length}</span></div>
            {upcoming.map((track) => (
              <div key={track.id} className="fp-queue-row">
                <div className="fp-queue-art">{track.artworkUrl ? <img src={track.artworkUrl} alt="" /> : <WkIcon name="Music2" size={14} />}</div>
                <div className="min-w-0"><div className="fp-queue-title">{track.title}</div><div className="fp-queue-sub">{track.artist}</div></div>
                <WkIcon name="ChevronRight" size={14} className="text-[var(--wk-text-faint)]" />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
