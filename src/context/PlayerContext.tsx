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
  previewUrl?: string; // actual audio URL for playback
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
  playFromQueue: (index: number) => void;
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

export function PlayerProvider({ children }: { children: React.ReactNode }) {
  const [currentTrack, setCurrentTrack] = useState<PlayerTrack | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolumeState] = useState(0.8);
  const [queue, setQueue] = useState<PlayerTrack[]>([]);
  const [queueIndex, setQueueIndex] = useState(0);
  const [repeatMode, setRepeatMode] = useState<RepeatMode>("off");
  const [isShuffle, setIsShuffle] = useState(false);
  const [isFullPlayerOpen, setIsFullPlayerOpen] = useState(false);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const shuffledOrderRef = useRef<number[]>([]);
  const hasUserInteractedRef = useRef(false);
  const pendingPlayRef = useRef(false);

  // ─── Create audio element once ───
  useEffect(() => {
    const audio = new Audio();
    audio.preload = "auto";
    audioRef.current = audio;

    const onTimeUpdate = () => {
      if (audio.duration && Number.isFinite(audio.duration)) {
        setCurrentTime(audio.currentTime);
      }
    };

    const onLoadedMetadata = () => {
      if (audio.duration && Number.isFinite(audio.duration) && audio.duration > 0) {
        setDuration(audio.duration);
      }
    };

    const onEnded = () => {
      // Will be handled in the useEffect watcher below
      setCurrentTime(audio.duration || 0);
      setIsPlaying(false);
    };

    const onPlay = () => setIsPlaying(true);
    const onPause = () => {
      // Only set to false if not triggered by ended (ended fires pause first)
      if (!audio.ended) {
        setIsPlaying(false);
      }
    };

    const onError = () => {
      console.warn("Audio playback error:", audio.error?.message || "unknown");
      setIsPlaying(false);
    };

    audio.addEventListener("timeupdate", onTimeUpdate);
    audio.addEventListener("loadedmetadata", onLoadedMetadata);
    audio.addEventListener("ended", onEnded);
    audio.addEventListener("play", onPlay);
    audio.addEventListener("pause", onPause);
    audio.addEventListener("error", onError);

    // Capture first user interaction to unlock audio
    const unlock = () => {
      hasUserInteractedRef.current = true;
      document.removeEventListener("click", unlock);
      document.removeEventListener("touchstart", unlock);
      document.removeEventListener("keydown", unlock);
    };
    document.addEventListener("click", unlock);
    document.addEventListener("touchstart", unlock);
    document.addEventListener("keydown", unlock);

    return () => {
      audio.pause();
      audio.removeAttribute("src");
      audio.removeEventListener("timeupdate", onTimeUpdate);
      audio.removeEventListener("loadedmetadata", onLoadedMetadata);
      audio.removeEventListener("ended", onEnded);
      audio.removeEventListener("play", onPlay);
      audio.removeEventListener("pause", onPause);
      audio.removeEventListener("error", onError);
      document.removeEventListener("click", unlock);
      document.removeEventListener("touchstart", unlock);
      document.removeEventListener("keydown", unlock);
      audioRef.current = null;
    };
  }, []);

  // ─── Handle track end (auto-advance) ───
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !currentTrack) return;

    const dur = audio.duration && Number.isFinite(audio.duration) && audio.duration > 0
      ? audio.duration
      : (currentTrack.duration || 0);

    if (audio.ended && dur > 0) {
      if (repeatMode === "one") {
        audio.currentTime = 0;
        audio.play().catch(() => {});
      } else {
        const hasNext =
          repeatMode === "all" ||
          (isShuffle
            ? shuffledOrderRef.current.indexOf(queueIndex) < shuffledOrderRef.current.length - 1
            : queueIndex < queue.length - 1);

        if (hasNext) {
          const nextIdx = isShuffle
            ? shuffledOrderRef.current[shuffledOrderRef.current.indexOf(queueIndex) + 1]
            : queueIndex + 1;

          if (nextIdx !== undefined && nextIdx < queue.length) {
            const nextTrack = queue[nextIdx];
            setCurrentTrack(nextTrack);
            setQueueIndex(nextIdx);
            setCurrentTime(0);
            setDuration(nextTrack.duration || 0);
            // Load and play the next track
            if (nextTrack.previewUrl) {
              audio.src = nextTrack.previewUrl;
              audio.play().catch(() => {});
            }
          } else if (repeatMode === "all" && queue.length > 0) {
            const firstIdx = isShuffle ? shuffledOrderRef.current[0] : 0;
            const firstTrack = queue[firstIdx];
            setCurrentTrack(firstTrack);
            setQueueIndex(firstIdx);
            setCurrentTime(0);
            setDuration(firstTrack.duration || 0);
            if (firstTrack.previewUrl) {
              audio.src = firstTrack.previewUrl;
              audio.play().catch(() => {});
            }
          }
        }
      }
    }
  }, [audioRef.current?.ended, currentTrack, queue, queueIndex, repeatMode, isShuffle]);

  // ─── Play a track ───
  const playTrack = useCallback((track: PlayerTrack, newQueue?: PlayerTrack[]) => {
    const audio = audioRef.current;
    if (!audio) return;

    const fullQueue = newQueue && newQueue.length > 0 ? newQueue : [track];
    const idx = fullQueue.findIndex((t) => t.id === track.id);
    const safeIdx = idx >= 0 ? idx : 0;

    setQueue(fullQueue);
    setQueueIndex(safeIdx);
    setCurrentTrack(track);
    setCurrentTime(0);

    // Use real duration if available, fall back to 0 (will be set by audio metadata)
    setDuration(track.duration || 0);

    if (isShuffle) {
      const indices = fullQueue.map((_, i) => i).filter((i) => i !== safeIdx);
      for (let i = indices.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [indices[i], indices[j]] = [indices[j], indices[i]];
      }
      shuffledOrderRef.current = [safeIdx, ...indices];
    } else {
      shuffledOrderRef.current = fullQueue.map((_, i) => i);
    }

    // Load audio source
    if (track.previewUrl) {
      audio.src = track.previewUrl;
      pendingPlayRef.current = true;
      audio.play().catch((err) => {
        // Autoplay blocked - that's OK, user can click play
        console.warn("Audio autoplay blocked:", err.message);
        pendingPlayRef.current = false;
      });
    }
  }, [isShuffle]);

  // ─── Toggle play/pause ───
  const togglePlay = useCallback(() => {
    const audio = audioRef.current;
    if (!audio || !currentTrack) return;
    if (!currentTrack.previewUrl) return;

    if (audio.paused || audio.ended) {
      if (audio.ended) {
        audio.currentTime = 0;
      }
      audio.play().catch(() => {});
    } else {
      audio.pause();
    }
  }, [currentTrack]);

  // ─── Pause ───
  const pause = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.pause();
  }, []);

  // ─── Next track ───
  const next = useCallback(() => {
    const audio = audioRef.current;
    if (!audio || queue.length === 0) return;

    let nextIdx: number;
    if (isShuffle) {
      const currentShuffledPos = shuffledOrderRef.current.indexOf(queueIndex);
      const nextShuffledPos = currentShuffledPos + 1;
      if (nextShuffledPos < shuffledOrderRef.current.length) {
        nextIdx = shuffledOrderRef.current[nextShuffledPos];
      } else if (repeatMode === "all") {
        nextIdx = shuffledOrderRef.current[0];
      } else {
        audio.pause();
        setIsPlaying(false);
        return;
      }
    } else {
      nextIdx = queueIndex + 1;
      if (nextIdx >= queue.length) {
        if (repeatMode === "all") {
          nextIdx = 0;
        } else {
          audio.pause();
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
    setDuration(nextTrack.duration || 0);

    if (nextTrack.previewUrl) {
      audio.src = nextTrack.previewUrl;
      audio.play().catch(() => {});
    }
  }, [queue, queueIndex, isShuffle, repeatMode]);

  // ─── Previous track ───
  const prev = useCallback(() => {
    const audio = audioRef.current;
    if (!audio || queue.length === 0) return;

    // If more than 3 seconds in, restart current track
    if (audio.currentTime > 3) {
      audio.currentTime = 0;
      if (!audio.paused) {
        audio.play().catch(() => {});
      }
      return;
    }

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

    const prevTrack = queue[prevIdx];
    if (!prevTrack) return;

    setCurrentTrack(prevTrack);
    setQueueIndex(prevIdx);
    setCurrentTime(0);
    setDuration(prevTrack.duration || 0);

    if (prevTrack.previewUrl) {
      audio.src = prevTrack.previewUrl;
      audio.play().catch(() => {});
    }
  }, [queue, queueIndex, isShuffle]);

  // ─── Play from queue ───
  const playFromQueue = useCallback((index: number) => {
    const audio = audioRef.current;
    if (!audio || index < 0 || index >= queue.length) return;
    const track = queue[index];
    if (!track) return;

    setQueueIndex(index);
    setCurrentTrack(track);
    setCurrentTime(0);
    setDuration(track.duration || 0);

    if (track.previewUrl) {
      audio.src = track.previewUrl;
      audio.play().catch(() => {});
    }
  }, [queue]);

  // ─── Seek ───
  const seek = useCallback((time: number) => {
    const audio = audioRef.current;
    if (!audio) return;
    const max = audio.duration && Number.isFinite(audio.duration) ? audio.duration : 0;
    const clamped = Math.max(0, Math.min(time, max || time));
    audio.currentTime = clamped;
    setCurrentTime(clamped);
  }, []);

  // ─── Volume ───
  const handleSetVolume = useCallback((vol: number) => {
    const audio = audioRef.current;
    const clamped = Math.max(0, Math.min(1, vol));
    setVolumeState(clamped);
    if (audio) {
      audio.volume = clamped;
    }
  }, []);

  // Sync initial volume to audio element
  useEffect(() => {
    const audio = audioRef.current;
    if (audio) {
      audio.volume = volume;
    }
  }, []);

  // ─── Repeat ───
  const toggleRepeat = useCallback(() => {
    setRepeatMode((prev) => {
      if (prev === "off") return "all";
      if (prev === "all") return "one";
      return "off";
    });
  }, []);

  // ─── Shuffle ───
  const toggleShuffle = useCallback(() => {
    setIsShuffle((prev) => {
      const next = !prev;
      if (next && queue.length > 0) {
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

  // ─── Full player ───
  const openFullPlayer = useCallback(() => setIsFullPlayerOpen(true), []);
  const closeFullPlayer = useCallback(() => setIsFullPlayerOpen(false), []);

  // ─── Navigation state ───
  const canGoNext = queue.length > 0 && (
    repeatMode !== "off" ||
    (isShuffle
      ? shuffledOrderRef.current.indexOf(queueIndex) < shuffledOrderRef.current.length - 1
      : queueIndex < queue.length - 1)
  );

  const canGoPrev = queue.length > 0 && (
    (isShuffle
      ? shuffledOrderRef.current.indexOf(queueIndex) > 0
      : queueIndex > 0)
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
    playFromQueue,
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