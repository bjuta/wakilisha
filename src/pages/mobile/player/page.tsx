import { useNavigate } from "react-router-dom";
import { usePlayer } from "@/context/PlayerContext";

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
        <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-white/5"><i className="ri-music-2-line text-2xl text-white/25" /></div>
        <h2 className="fp-track-name">No track playing</h2>
        <p className="mt-2 text-[13px] text-white/45">Tap play on any track to start listening.</p>
        <button onClick={() => nav(-1)} className="mt-6 auth-btn auth-btn-primary">Go back</button>
      </div>
    );
  }

  const formatTime = (seconds: number) => `${Math.floor(seconds / 60)}:${Math.floor(seconds % 60).toString().padStart(2, "0")}`;
  const pct = Math.max(0, Math.min(1, progress || 0));
  const activeLyric = Math.floor((currentTime / (duration || 1)) * LYRICS.length) % LYRICS.length;

  return (
    <div className="wk-mobile-v5 full-player">
      <div className="fp-ambient" style={{ background: `radial-gradient(circle at 50% 20%, rgba(132,194,65,.18), transparent 55%)` }} />
      <div className="fp-topbar">
        <button className="fp-topbar-btn" onClick={() => nav(-1)}><i className="ri-arrow-down-s-line text-xl" /></button>
        <div className="fp-topbar-title">Now Playing</div>
        <button className="fp-topbar-btn"><i className="ri-more-2-line" /></button>
      </div>

      <div className="fp-art-zone">
        {currentTrack.artworkUrl ? <img src={currentTrack.artworkUrl} alt={currentTrack.title} /> : <div className="aspect-square bg-[#1a2a10]" />}
      </div>

      <div className="fp-controls">
        <div className="fp-track-info">
          <div className="min-w-0">
            <h1 className="fp-track-name">{currentTrack.title}</h1>
            <div className="fp-track-artist">{currentTrack.artist}{currentTrack.source ? ` · ${currentTrack.source}` : ""}</div>
          </div>
          <button className="fp-like"><i className="ri-heart-line" /></button>
        </div>

        <div className="fp-scrub">
          <div className="fp-scrub-bar" onClick={(e) => { const r = e.currentTarget.getBoundingClientRect(); seek(((e.clientX - r.left) / r.width) * duration); }}>
            <div className="fp-scrub-fill" style={{ width: `${pct * 100}%` }} />
            <div className="fp-scrub-thumb" style={{ left: `${pct * 100}%` }} />
          </div>
          <div className="fp-times"><span>{formatTime(currentTime)}</span><span>{formatTime(duration)}</span></div>
        </div>

        <div className="fp-btns">
          <button className="fp-btn"><i className="ri-shuffle-line" /></button>
          <button className="fp-btn" onClick={prev} disabled={!canGoPrev}><i className="ri-skip-back-fill text-xl" /></button>
          <button className="fp-play-btn" onClick={togglePlay} disabled={currentTrack.isPlayable === false}><i className={isPlaying ? "ri-pause-fill text-3xl" : "ri-play-fill text-3xl"} /></button>
          <button className="fp-btn" onClick={next} disabled={!canGoNext}><i className="ri-skip-forward-fill text-xl" /></button>
          <button className="fp-btn"><i className="ri-repeat-line" /></button>
        </div>

        <div className="fp-lyrics">
          <p className="fp-lyric active">{LYRICS[activeLyric]}</p>
          <p className="fp-lyric">{LYRICS[(activeLyric + 1) % LYRICS.length]}</p>
        </div>

        {queue.length > 1 && <div className="mt-4 text-center text-[11px] text-white/35">{queueIndex + 1} / {queue.length} in queue</div>}
      </div>
    </div>
  );
}
