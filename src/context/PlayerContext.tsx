import { createContext, useContext, useState, useCallback, useRef, useEffect } from "react";
import { trackEvent } from "@/services/analytics";

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
  artistSlug?: string; // for deep-linking (contribute lyrics, etc.)
  trackSlug?: string; // for deep-linking (contribute lyrics, etc.)
}

export type RepeatMode = "off" | "all" | "one";

export interface PlaySource {
  pageType?: string;
  entitySlug?: string;
  entityType?: string;
  sourceSection?: string;
}

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
  playTrack: (track: PlayerTrack, queue?: PlayerTrack[], playSource?: PlaySource) => void;
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
  const sourceContextRef = useRef<PlaySource | null>(null);
  const playedAtRef = useRef<number>(0);
  const skipFlagRef = useRef(false);
  const currentTrackRef = useRef<PlayerTrack | null>(null);
  const isPlayingRef = useRef(false);

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

  // Sync refs to current state for analytics callbacks
  useEffect(() => { currentTrackRef.current = currentTrack; }, [currentTrack]);
  useEffect(() => { isPlayingRef.current = isPlaying; }, [isPlaying]);

  // ─── Handle track end (auto-advance) ───
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !currentTrack) return;

    const dur = audio.duration && Number.isFinite(audio.duration) && audio.duration > 0
      ? audio.duration
      : (currentTrack.duration || 0);

    if (audio.ended && dur > 0) {
      // Fire player_complete for the finished track (only if not a manual skip)
      if (!skipFlagRef.current && currentTrack) {
        trackEvent("player_complete", {
          pageType: sourceContextRef.current?.pageType,
          entitySlug: currentTrack.id,
          entityType: "track",
          context: {
            track_title: currentTrack.title,
            artist: currentTrack.artist,
            play_duration_ms: Date.now() - playedAtRef.current,
            source_section: sourceContextRef.current?.sourceSection,
          },
        });
      }
      skipFlagRef.current = false;

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

            // Fire player_play for auto-advanced track
            trackEvent("player_play", {
              pageType: sourceContextRef.current?.pageType,
              entitySlug: nextTrack.id,
              entityType: "track",
              context: {
                track_title: nextTrack.title,
                artist: nextTrack.artist,
                album: nextTrack.album ?? null,
                source: nextTrack.source ?? null,
                source_section: sourceContextRef.current?.sourceSection,
                queue_size: queue.length,
                auto_advance: true,
              },
            });
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

            // Fire player_play for wrap-around track
            trackEvent("player_play", {
              pageType: sourceContextRef.current?.pageType,
              entitySlug: firstTrack.id,
              entityType: "track",
              context: {
                track_title: firstTrack.title,
                artist: firstTrack.artist,
                album: firstTrack.album ?? null,
                source: firstTrack.source ?? null,
                source_section: sourceContextRef.current?.sourceSection,
                queue_size: queue.length,
                auto_advance: true,
                wrap_around: true,
              },
            });
          }
        }
      }
    }
  }, [audioRef.current?.ended, currentTrack, queue, queueIndex, repeatMode, isShuffle]);

  // ─── Play a track ───
  const playTrack = useCallback((track: PlayerTrack, newQueue?: PlayerTrack[], playSource?: PlaySource) => {
    const audio = audioRef.current;
    if (!audio) return;

    // If switching tracks, fire player_skip for the previous track
    if (currentTrackRef.current && currentTrackRef.current.id !== track.id && isPlayingRef.current) {
      skipFlagRef.current = true;
      trackEvent("player_skip", {
        pageType: sourceContextRef.current?.pageType,
        entitySlug: currentTrackRef.current.id,
        entityType: "track",
        context: {
          track_title: currentTrackRef.current.title,
          artist: currentTrackRef.current.artist,
          play_duration_ms: Date.now() - playedAtRef.current,
          source_page_type: sourceContextRef.current?.pageType,
          source_section: sourceContextRef.current?.sourceSection,
          direction: "manual_select",
        },
      });
    }

    sourceContextRef.current = playSource ?? null;
    playedAtRef.current = Date.now();

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

    // Fire player_play event
    trackEvent("player_play", {
      pageType: playSource?.pageType,
      entitySlug: track.id,
      entityType: "track",
      context: {
        track_title: track.title,
        artist: track.artist,
        album: track.album ?? null,
        source: track.source ?? null,
        source_section: playSource?.sourceSection ?? null,
        queue_size: fullQueue.length,
      },
    });
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

    if (currentTrackRef.current && isPlayingRef.current) {
      trackEvent("player_pause", {
        pageType: sourceContextRef.current?.pageType,
        entitySlug: currentTrackRef.current.id,
        entityType: "track",
        context: {
          track_title: currentTrackRef.current.title,
          artist: currentTrackRef.current.artist,
          play_duration_ms: Date.now() - playedAtRef.current,
          source_section: sourceContextRef.current?.sourceSection,
        },
      });
    }

    audio.pause();
  }, []);

  // ─── Next track ───
  const next = useCallback(() => {
    const audio = audioRef.current;
    if (!audio || queue.length === 0) return;

    const prevTrack = currentTrackRef.current;
    skipFlagRef.current = true;

    let nextIdx: number;
    if (isShuffle) {
      const currentShuffledPos = shuffledOrderRef.current.indexOf(queueIndex);
      const nextShuffledPos = currentShuffledPos + 1;
      if (nextShuffledPos < shuffledOrderRef.current.length) {
        nextIdx = shuffledOrderRef.current[nextShuffledPos];
      } else if (repeatMode === "all") {
        nextIdx = shuffledOrderRef.current[0];
      } else {
        // Fire player_skip for end-of-queue
        if (prevTrack) {
          trackEvent("player_skip", {
            pageType: sourceContextRef.current?.pageType,
            entitySlug: prevTrack.id,
            entityType: "track",
            context: {
              track_title: prevTrack.title,
              artist: prevTrack.artist,
              play_duration_ms: Date.now() - playedAtRef.current,
              source_section: sourceContextRef.current?.sourceSection,
              direction: "next_end_of_queue",
            },
          });
        }
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
          if (prevTrack) {
            trackEvent("player_skip", {
              pageType: sourceContextRef.current?.pageType,
              entitySlug: prevTrack.id,
              entityType: "track",
              context: {
                track_title: prevTrack.title,
                artist: prevTrack.artist,
                play_duration_ms: Date.now() - playedAtRef.current,
                source_section: sourceContextRef.current?.sourceSection,
                direction: "next_end_of_queue",
              },
            });
          }
          audio.pause();
          setIsPlaying(false);
          return;
        }
      }
    }

    const nextTrack = queue[nextIdx];
    if (!nextTrack) return;

    // Fire player_skip for the previous track
    if (prevTrack && prevTrack.id !== nextTrack.id) {
      trackEvent("player_skip", {
        pageType: sourceContextRef.current?.pageType,
        entitySlug: prevTrack.id,
        entityType: "track",
        context: {
          track_title: prevTrack.title,
          artist: prevTrack.artist,
          play_duration_ms: Date.now() - playedAtRef.current,
          source_section: sourceContextRef.current?.sourceSection,
          direction: "next",
        },
      });
    }

    playedAtRef.current = Date.now();

    setCurrentTrack(nextTrack);
    setQueueIndex(nextIdx);
    setCurrentTime(0);
    setDuration(nextTrack.duration || 0);

    if (nextTrack.previewUrl) {
      audio.src = nextTrack.previewUrl;
      audio.play().catch(() => {});
    }

    // Fire player_play for the new track
    trackEvent("player_play", {
      pageType: sourceContextRef.current?.pageType,
      entitySlug: nextTrack.id,
      entityType: "track",
      context: {
        track_title: nextTrack.title,
        artist: nextTrack.artist,
        album: nextTrack.album ?? null,
        source: nextTrack.source ?? null,
        source_section: sourceContextRef.current?.sourceSection,
        queue_size: queue.length,
      },
    });
  }, [queue, queueIndex, isShuffle, repeatMode]);

  // ─── Previous track ───
  const prev = useCallback(() => {
    const audio = audioRef.current;
    if (!audio || queue.length === 0) return;

    const prevTrack = currentTrackRef.current;

    // If more than 3 seconds in, restart current track
    if (audio.currentTime > 3) {
      skipFlagRef.current = true;

      if (prevTrack) {
        trackEvent("player_skip", {
          pageType: sourceContextRef.current?.pageType,
          entitySlug: prevTrack.id,
          entityType: "track",
          context: {
            track_title: prevTrack.title,
            artist: prevTrack.artist,
            play_duration_ms: Date.now() - playedAtRef.current,
            source_section: sourceContextRef.current?.sourceSection,
            direction: "restart",
          },
        });
      }

      playedAtRef.current = Date.now();
      audio.currentTime = 0;
      if (!audio.paused) {
        audio.play().catch(() => {});
      }

      if (prevTrack) {
        trackEvent("player_play", {
          pageType: sourceContextRef.current?.pageType,
          entitySlug: prevTrack.id,
          entityType: "track",
          context: {
            track_title: prevTrack.title,
            artist: prevTrack.artist,
            album: prevTrack.album ?? null,
            source: prevTrack.source ?? null,
            source_section: sourceContextRef.current?.sourceSection,
            queue_size: queue.length,
          },
        });
      }
      return;
    }

    const { prevIdx } = isShuffle
      ? (() => {
          const currentShuffledPos = shuffledOrderRef.current.indexOf(queueIndex);
          const prevShuffledPos = currentShuffledPos - 1;
          return {
            prevIdx: prevShuffledPos >= 0 ? shuffledOrderRef.current[prevShuffledPos] : queueIndex,
          };
        })()
      : { prevIdx: queueIndex - 1 >= 0 ? queueIndex - 1 : 0 };

    const targetTrack = queue[prevIdx];
    if (!targetTrack) return;

    // Fire player_skip for the previous track
    if (prevTrack && prevTrack.id !== targetTrack.id) {
      skipFlagRef.current = true;
      trackEvent("player_skip", {
        pageType: sourceContextRef.current?.pageType,
        entitySlug: prevTrack.id,
        entityType: "track",
        context: {
          track_title: prevTrack.title,
          artist: prevTrack.artist,
          play_duration_ms: Date.now() - playedAtRef.current,
          source_section: sourceContextRef.current?.sourceSection,
          direction: "prev",
        },
      });
    }

    playedAtRef.current = Date.now();

    setCurrentTrack(targetTrack);
    setQueueIndex(prevIdx);
    setCurrentTime(0);
    setDuration(targetTrack.duration || 0);

    if (targetTrack.previewUrl) {
      audio.src = targetTrack.previewUrl;
      audio.play().catch(() => {});
    }

    // Fire player_play for the new track
    trackEvent("player_play", {
      pageType: sourceContextRef.current?.pageType,
      entitySlug: targetTrack.id,
      entityType: "track",
      context: {
        track_title: targetTrack.title,
        artist: targetTrack.artist,
        album: targetTrack.album ?? null,
        source: targetTrack.source ?? null,
        source_section: sourceContextRef.current?.sourceSection,
        queue_size: queue.length,
      },
    });
  }, [queue, queueIndex, isShuffle]);

  // ─── Play from queue ───
  const playFromQueue = useCallback((index: number) => {
    const audio = audioRef.current;
    if (!audio || index < 0 || index >= queue.length) return;
    const track = queue[index];
    if (!track) return;

    // Fire player_skip for previous track if switching
    if (currentTrackRef.current && currentTrackRef.current.id !== track.id && isPlayingRef.current) {
      skipFlagRef.current = true;
      trackEvent("player_skip", {
        pageType: sourceContextRef.current?.pageType,
        entitySlug: currentTrackRef.current.id,
        entityType: "track",
        context: {
          track_title: currentTrackRef.current.title,
          artist: currentTrackRef.current.artist,
          play_duration_ms: Date.now() - playedAtRef.current,
          source_section: sourceContextRef.current?.sourceSection,
          direction: "queue_select",
        },
      });
    }

    playedAtRef.current = Date.now();

    setQueueIndex(index);
    setCurrentTrack(track);
    setCurrentTime(0);
    setDuration(track.duration || 0);

    if (track.previewUrl) {
      audio.src = track.previewUrl;
      audio.play().catch(() => {});
    }

    // Fire player_play
    trackEvent("player_play", {
      pageType: sourceContextRef.current?.pageType,
      entitySlug: track.id,
      entityType: "track",
      context: {
        track_title: track.title,
        artist: track.artist,
        album: track.album ?? null,
        source: track.source ?? null,
        source_section: sourceContextRef.current?.sourceSection,
        queue_size: queue.length,
      },
    });
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