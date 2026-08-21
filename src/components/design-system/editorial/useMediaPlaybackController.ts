import {
  useEffect,
  useRef,
  useState,
  type SyntheticEvent,
} from "react";

export function useMediaPlaybackController({
  durationSeconds = 0,
  sourceKey,
}: {
  durationSeconds?: number | null;
  sourceKey?: string | null;
}) {
  const mediaRef = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [playbackRate, setPlaybackRate] = useState(1);

  const duration = Math.max(
    Number(durationSeconds ?? 0),
    0,
  );

  useEffect(() => {
    const media = mediaRef.current;
    media?.pause();
    if (media) {
      media.currentTime = 0;
      media.playbackRate = 1;
    }
    setPlaying(false);
    setCurrentTime(0);
    setPlaybackRate(1);
  }, [sourceKey]);

  const seek = (seconds: number) => {
    const media = mediaRef.current;
    const availableDuration = Math.max(
      duration,
      media?.duration && Number.isFinite(media.duration)
        ? media.duration
        : 0,
    );
    const next = Math.min(
      Math.max(0, seconds),
      availableDuration,
    );

    if (media) media.currentTime = next;
    setCurrentTime(next);
  };

  const togglePlayback = async () => {
    const media = mediaRef.current;
    if (!media) return;

    if (media.paused) {
      await media.play();
    } else {
      media.pause();
    }
  };

  const changePlaybackRate = (rate: number) => {
    setPlaybackRate(rate);
    if (mediaRef.current) {
      mediaRef.current.playbackRate = rate;
    }
  };

  return {
    mediaRef,
    playing,
    currentTime,
    playbackRate,
    duration,
    seek,
    togglePlayback,
    changePlaybackRate,
    mediaEventHandlers: {
      onPlay: () => setPlaying(true),
      onPause: () => setPlaying(false),
      onTimeUpdate: (event: SyntheticEvent<HTMLAudioElement>) =>
        setCurrentTime(event.currentTarget.currentTime),
      onEnded: () => setPlaying(false),
    },
  };
}
