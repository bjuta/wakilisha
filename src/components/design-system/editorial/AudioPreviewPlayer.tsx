import { useEffect, useRef, useState } from "react";
import { MediaTransport } from "./MediaTransport";
import { SeekRail } from "@/components/design-system/player/SeekRail";
import { WkSlider } from "@/components/design-system/primitives/Slider";

export function AudioPreviewPlayer({
  src,
  title = "Audio preview",
  className = "",
}: {
  src: string;
  title?: string;
  className?: string;
}) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [volume, setVolume] = useState(1);

  useEffect(() => {
    setPlaying(false);
    setCurrentTime(0);
    setDuration(0);
  }, [src]);

  const seek = (seconds: number) => {
    const audio = audioRef.current;
    const safeDuration = Number.isFinite(audio?.duration) && (audio?.duration ?? 0) > 0
      ? audio!.duration
      : duration;
    const next = Math.min(Math.max(0, seconds), Math.max(0, safeDuration));
    if (audio) audio.currentTime = next;
    setCurrentTime(next);
  };

  const togglePlayback = async () => {
    const audio = audioRef.current;
    if (!audio) return;
    if (audio.paused) await audio.play();
    else audio.pause();
  };

  const changeRate = (rate: number) => {
    setPlaybackRate(rate);
    if (audioRef.current) audioRef.current.playbackRate = rate;
  };

  const changeVolume = (next: number) => {
    setVolume(next);
    if (audioRef.current) audioRef.current.volume = next;
  };

  return (
    <div className={`space-y-2 ${className}`.trim()}>
      <audio
        ref={audioRef}
        src={src}
        preload="metadata"
        className="hidden"
        onLoadedMetadata={(event) => {
          const nextDuration = event.currentTarget.duration;
          setDuration(Number.isFinite(nextDuration) ? nextDuration : 0);
        }}
        onDurationChange={(event) => {
          const nextDuration = event.currentTarget.duration;
          setDuration(Number.isFinite(nextDuration) ? nextDuration : 0);
        }}
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onTimeUpdate={(event) => setCurrentTime(event.currentTarget.currentTime)}
        onEnded={() => setPlaying(false)}
      />
      <MediaTransport
        playing={playing}
        currentTime={currentTime}
        duration={duration}
        playbackRate={playbackRate}
        onToggle={() => void togglePlayback()}
        onSeekBy={(delta) => seek(currentTime + delta)}
        onPlaybackRateChange={changeRate}
      />
      <SeekRail
        label={`${title} position`}
        currentTime={currentTime}
        duration={duration}
        onSeek={seek}
        step={5}
      />
      <WkSlider
        value={volume}
        onChange={changeVolume}
        min={0}
        max={1}
        step={0.05}
        ariaLabel={`${title} volume`}
        showValueLabel={false}
      />
    </div>
  );
}
