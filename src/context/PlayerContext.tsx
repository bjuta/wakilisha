import { createContext, useContext, useState, useCallback, useRef, useEffect } from "react";

export interface PlayerTrack {
  id: string;
  title: string;
  artist: string;
  artworkUrl?: string;
  album?: string;
  duration?: number; // seconds
  isPlayable?: boolean;
  source?: string; // e.g. "YouTube", "Spotify", "SoundCloud"
}

export type RepeatMode = "off" | "all" | "one";

interface PlayerContextValue {
  currentTrack: PlayerTrack | null;
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  volume: number;
  queue: PlayerTrack[];
  queueIndex: number;
  repeatMode: RepeatMode;
  isShuffle: boolean;
  isFullPlayerOpen: boolean;
  playTrack: (track: PlayerTrack, queue?: PlayerTrack[]) => void;
  togglePlay: () => void;
  pause: () => void;
  next: () => void;
  prev: () => void;
  seek: (time: number) => void;
  setVolume: (vol: number) => void;
  toggleRepeat: () => void;
  toggleShuffle: () => void;
  openFullPlayer: () => void;
  closeFullPlayer: () => void;
  canGoNext: boolean;
  canGoPrev: boolean;
  progress: number; // 0-1
}

const PlayerContext = createContext<PlayerContextValue | null>(null);

function deriveDuration(track: PlayerTrack | null): number {
  if (!track) return 0;
  if (track.duration) return track.duration;
  // Deterministic pseudo-duration based on title length
  const base = 180 + ((track.title.length * 7) % 120);
  return base;
}

export function PlayerProvider({ children }: { children: React.ReactNode }) {
  const [currentTrack, setCurrentTrack] = useState<PlayerTrack | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(0.8);
  const [queue, setQueue] = useState<PlayerTrack[]>([]);
  const [queueIndex, setQueueIndex] = useState(0);
  const [repeatMode, setRepeatMode] = useState<RepeatMode>("off");
  const [isShuffle, setIsShuffle] = useState(false);
  const [isFullPlayerOpen, setIsFullPlayerOpen] = useState(false);

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const shuffledOrderRef = useRef<number[]>([]);

  const clearPlaybackInterval = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  const startPlaybackInterval = useCallback(() => {
    clearPlaybackInterval();
    intervalRef.current = setInterval(() => {
      setCurrentTime((prev) => {
        const dur = deriveDuration(currentTrack);
        if (prev >= dur) {
          // Track ended — auto-advance
          return prev;
        }
        return prev + 1;
      });
    }, 1000);
  }, [currentTrack, clearPlaybackInterval]);

  // Handle track end (auto-advance)
  useEffect(() => {
    const dur = deriveDuration(currentTrack);
    if (currentTime >= dur && dur > 0 && isPlaying) {
      if (repeatMode === "one") {
        setCurrentTime(0);
        startPlaybackInterval();
      } else {
        // Auto next
        const hasNext =
          repeatMode === "all" ||
          (isShuffle
            ? shuffledOrderRef.current.length > 0 &&
              shuffledOrderRef.current.indexOf(queueIndex) < shuffledOrderRef.current.length - 1
            : queueIndex < queue.length - 1);

        if (hasNext) {
          // Trigger next
          const nextIdx = isShuffle
            ? shuffledOrderRef.current[shuffledOrderRef.current.indexOf(queueIndex) + 1]
            : queueIndex + 1;

          if (nextIdx !== undefined && nextIdx < queue.length) {
            const nextTrack = queue[nextIdx];
            setCurrentTrack(nextTrack);
            setQueueIndex(nextIdx);
            setCurrentTime(0);
            setDuration(deriveDuration(nextTrack));
            startPlaybackInterval();
          } else if (repeatMode === "all" && queue.length > 0) {
            const firstIdx = isShuffle ? shuffledOrderRef.current[0] : 0;
            const firstTrack = queue[firstIdx];
            setCurrentTrack(firstTrack);
            setQueueIndex(firstIdx);
            setCurrentTime(0);
            setDuration(deriveDuration(firstTrack));
            startPlaybackInterval();
          } else {
            setIsPlaying(false);
            clearPlaybackInterval();
          }
        } else {
          setIsPlaying(false);
          clearPlaybackInterval();
        }
      }
    }
  }, [currentTime, currentTrack, isPlaying, queue, queueIndex, repeatMode, isShuffle, startPlaybackInterval, clearPlaybackInterval]);

  // Start/stop interval when play state changes
  useEffect(() => {
    if (isPlaying && currentTrack) {
      startPlaybackInterval();
    } else {
      clearPlaybackInterval();
    }
    return () => clearPlaybackInterval();
  }, [isPlaying, currentTrack, startPlaybackInterval, clearPlaybackInterval]);

  const playTrack = useCallback((track: PlayerTrack, newQueue?: PlayerTrack[]) => {
    const fullQueue = newQueue && newQueue.length > 0 ? newQueue : [track];
    const idx = fullQueue.findIndex((t) => t.id === track.id);
    const safeIdx = idx >= 0 ? idx : 0;

    setQueue(fullQueue);
    setQueueIndex(safeIdx);
    setCurrentTrack(track);
    setCurrentTime(0);
    setDuration(deriveDuration(track));
    setIsPlaying(true);

    if (isShuffle) {
      // Generate shuffled order with current track first
      const indices = fullQueue.map((_, i) => i).filter((i) => i !== safeIdx);
      for (let i = indices.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [indices[i], indices[j]] = [indices[j], indices[i]];
      }
      shuffledOrderRef.current = [safeIdx, ...indices];
    } else {
      shuffledOrderRef.current = fullQueue.map((_, i) => i);
    }
  }, [isShuffle]);

  const togglePlay = useCallback(() => {
    if (!currentTrack) return;
    if (currentTrack.isPlayable === false) return;
    setIsPlaying((prev) => !prev);
  }, [currentTrack]);

  const pause = useCallback(() => {
    setIsPlaying(false);
  }, []);

  const next = useCallback(() => {
    if (queue.length === 0) return;

    let nextIdx: number;
    if (isShuffle) {
      const currentShuffledPos = shuffledOrderRef.current.indexOf(queueIndex);
      const nextShuffledPos = currentShuffledPos + 1;
      if (nextShuffledPos < shuffledOrderRef.current.length) {
        nextIdx = shuffledOrderRef.current[nextShuffledPos];
      } else if (repeatMode === "all") {
        nextIdx = shuffledOrderRef.current[0];
      } else {
        setIsPlaying(false);
        return;
      }
    } else {
      nextIdx = queueIndex + 1;
      if (nextIdx >= queue.length) {
        if (repeatMode === "all") {
          nextIdx = 0;
        } else {
          setIsPlaying(false);
          return;
        }
      }
    }

    const nextTrack = queue[nextIdx];
    if (!nextTrack) return;

    setCurrentTrack(nextTrack);
    setQueueIndex(nextIdx);
    setCurrentTime(0);
    setDuration(deriveDuration(nextTrack));
    setIsPlaying(true);
  }, [queue, queueIndex, isShuffle, repeatMode]);

  const prev = useCallback(() => {
    if (queue.length === 0) return;

    let prevIdx: number;
    if (isShuffle) {
      const currentShuffledPos = shuffledOrderRef.current.indexOf(queueIndex);
      const prevShuffledPos = currentShuffledPos - 1;
      if (prevShuffledPos >= 0) {
        prevIdx = shuffledOrderRef.current[prevShuffledPos];
      } else {
        prevIdx = queueIndex;
      }
    } else {
      prevIdx = queueIndex - 1;
      if (prevIdx < 0) {
        prevIdx = 0;
      }
    }

    if (currentTime > 3) {
      // If we're more than 3 seconds in, restart current track instead of going prev
      setCurrentTime(0);
      setIsPlaying(true);
      return;
    }

    const prevTrack = queue[prevIdx];
    if (!prevTrack) return;

    setCurrentTrack(prevTrack);
    setQueueIndex(prevIdx);
    setCurrentTime(0);
    setDuration(deriveDuration(prevTrack));
    setIsPlaying(true);
  }, [queue, queueIndex, isShuffle, currentTime]);

  const seek = useCallback((time: number) => {
    const dur = deriveDuration(currentTrack);
    const clamped = Math.max(0, Math.min(time, dur));
    setCurrentTime(clamped);
  }, [currentTrack]);

  const handleSetVolume = useCallback((vol: number) => {
    setVolume(Math.max(0, Math.min(1, vol)));
  }, []);

  const toggleRepeat = useCallback(() => {
    setRepeatMode((prev) => {
      if (prev === "off") return "all";
      if (prev === "all") return "one";
      return "off";
    });
  }, []);

  const toggleShuffle = useCallback(() => {
    setIsShuffle((prev) => {
      const next = !prev;
      if (next && queue.length > 0) {
        // Regenerate shuffle with current first
        const indices = queue.map((_, i) => i).filter((i) => i !== queueIndex);
        for (let i = indices.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [indices[i], indices[j]] = [indices[j], indices[i]];
        }
        shuffledOrderRef.current = [queueIndex, ...indices];
      } else {
        shuffledOrderRef.current = queue.map((_, i) => i);
      }
      return next;
    });
  }, [queue, queueIndex]);

  const openFullPlayer = useCallback(() => {
    setIsFullPlayerOpen(true);
  }, []);

  const closeFullPlayer = useCallback(() => {
    setIsFullPlayerOpen(false);
  }, []);

  const canGoNext = queue.length > 0 && (
    repeatMode !== "off" ||
    (isShuffle
      ? shuffledOrderRef.current.indexOf(queueIndex) < shuffledOrderRef.current.length - 1
      : queueIndex < queue.length - 1)
  );

  const canGoPrev = queue.length > 0 && (
    (isShuffle
      ? shuffledOrderRef.current.indexOf(queueIndex) > 0
      : queueIndex > 0) ||
    currentTime > 3
  );

  const progress = duration > 0 ? currentTime / duration : 0;

  const value: PlayerContextValue = {
    currentTrack,
    isPlaying,
    currentTime,
    duration,
    volume,
    queue,
    queueIndex,
    repeatMode,
    isShuffle,
    isFullPlayerOpen,
    playTrack,
    togglePlay,
    pause,
    next,
    prev,
    seek,
    setVolume: handleSetVolume,
    toggleRepeat,
    toggleShuffle,
    openFullPlayer,
    closeFullPlayer,
    canGoNext,
    canGoPrev,
    progress,
  };

  return (
    <PlayerContext.Provider value={value}>
      {children}
    </PlayerContext.Provider>
  );
}

export function usePlayer() {
  const ctx = useContext(PlayerContext);
  if (!ctx) {
    throw new Error("usePlayer must be used within a PlayerProvider");
  }
  return ctx;
}