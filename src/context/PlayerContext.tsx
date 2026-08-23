import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { trackEvent } from "@/services/analytics";
import {
  getAppleMusicPlaybackSnapshot,
  getAuthorizedMusicKit,
  pauseAppleMusic,
  playAppleMusicCatalogSong,
  resumeAppleMusic,
  seekAppleMusic,
  stopAppleMusic,
} from "@/services/appleMusicPlayback";
import { recordListeningEvent } from "@/services/listeningHistory";
import { ProviderPlaybackCanvas } from "@/components/design-system/music/ProviderPlaybackCanvas";
import {
  getYouTubePlaybackSnapshot,
  pauseYouTube,
  playYouTubeTrack,
  resumeYouTube,
  seekYouTube,
  setYouTubeVolume,
  stopYouTube,
} from "@/services/player/youtubePlayback";
import {
  pauseSoundCloud,
  playSoundCloudTrack,
  readSoundCloudPlaybackSnapshot,
  resumeSoundCloud,
  seekSoundCloud,
  setSoundCloudVolume,
  stopSoundCloud,
} from "@/services/player/soundCloudPlayback";
import { PlaybackSessionArbiter } from "@/services/player/playbackSession";

export type PlaybackBackend =
  | "audio"
  | "apple"
  | "youtube"
  | "soundcloud";

export type PlaylistPlaybackEngine =
  | "audio"
  | "apple_music"
  | "youtube"
  | "soundcloud"
  | "unavailable";

export type PlayerMediaKind =
  | "music_track"
  | "audio_episode"
  | "standalone_audio";

export interface PlayerTrack {
  id: string;
  registryTrackId?: string | null;
  title: string;
  artist: string;
  artworkUrl?: string;
  album?: string;
  duration?: number;
  isPlayable?: boolean;
  isExplicit?: boolean;
  source?: string;
  previewUrl?: string;
  appleMusicId?: string | null;
  appleMusicCatalogId?: string | null;
  playbackEngine?: PlaylistPlaybackEngine;
  providerKey?: string | null;
  providerObjectId?: string | null;
  providerUrl?: string | null;
  providerEmbedUrl?: string | null;
  artistSlug?: string;
  trackSlug?: string;

  mediaKind?: PlayerMediaKind;
  canonicalPath?: string | null;
  creatorLabel?: string | null;
  contextLabel?: string | null;
  playbackAvailability?: "full" | "excerpt" | "unavailable";
  chapters?: Array<{ id: string; startSeconds: number; title: string }>;
  transcript?: { url: string; label?: string | null } | null;
  capabilities?: Record<string, unknown>;
}

function readPlaybackPrefs(): {
  autoplay: boolean;
  explicitFilter: boolean;
  appleMusicConnected: boolean;
  appleMusicToken: string | null;
  preferApplePreviews: boolean;
} {
  try {
    const raw = localStorage.getItem("wk-playback-v2");
    if (!raw) {
      return {
        autoplay: false,
        explicitFilter: false,
        appleMusicConnected: false,
        appleMusicToken: null,
        preferApplePreviews: false,
      };
    }

    const prefs = JSON.parse(raw);
    return {
      autoplay: prefs.autoplay === true,
      explicitFilter: prefs.explicitFilter === true,
      appleMusicConnected: prefs.appleMusicConnected === true,
      appleMusicToken:
        typeof prefs.appleMusicToken === "string"
          ? prefs.appleMusicToken
          : null,
      preferApplePreviews: prefs.preferApplePreviews === true,
    };
  } catch {
    return {
      autoplay: false,
      explicitFilter: false,
      appleMusicConnected: false,
      appleMusicToken: null,
      preferApplePreviews: false,
    };
  }
}

function usePlaybackPrefs() {
  const [prefs, setPrefs] = useState(readPlaybackPrefs);

  useEffect(() => {
    const refresh = () => setPrefs(readPlaybackPrefs());
    const onStorage = (event: StorageEvent) => {
      if (event.key === "wk-playback-v2") refresh();
    };
    window.addEventListener("storage", onStorage);
    window.addEventListener("wk-playback-changed", refresh);
    return () => {
      window.removeEventListener("storage", onStorage);
      window.removeEventListener("wk-playback-changed", refresh);
    };
  }, []);

  return prefs;
}

export type RepeatMode = "off" | "all" | "one";

export interface PlaySource {
  pageType?: string;
  entitySlug?: string;
  entityType?: string;
  sourceSection?: string;
  label?: string;
}

interface PlayerContextValue {
  currentTrack: PlayerTrack | null;
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  volume: number;
  playbackRate: number;
  queue: PlayerTrack[];
  queueIndex: number;
  queueContext: PlaySource | null;
  repeatMode: RepeatMode;
  isShuffle: boolean;
  isFullPlayerOpen: boolean;
  playbackBackend: PlaybackBackend;
  playbackSourceLabel: string | null;
  playTrack: (
    track: PlayerTrack,
    queue?: PlayerTrack[],
    playSource?: PlaySource,
  ) => void;
  togglePlay: () => void;
  pause: () => void;
  next: () => void;
  prev: () => void;
  playFromQueue: (index: number) => void;
  seek: (time: number) => void;
  setVolume: (vol: number) => void;
  setPlaybackRate: (rate: number) => void;
  toggleRepeat: () => void;
  toggleShuffle: () => void;
  openFullPlayer: () => void;
  closeFullPlayer: () => void;
  canGoNext: boolean;
  canGoPrev: boolean;
  progress: number;
}

const PlayerContext = createContext<PlayerContextValue | null>(null);

export function PlayerProvider({ children }: { children: React.ReactNode }) {
  const [currentTrack, setCurrentTrack] = useState<PlayerTrack | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolumeState] = useState(0.8);
  const [playbackRate, setPlaybackRateState] = useState(1);
  const [queue, setQueue] = useState<PlayerTrack[]>([]);
  const [queueIndex, setQueueIndex] = useState(0);
  const [queueContext, setQueueContext] = useState<PlaySource | null>(null);
  const [repeatMode, setRepeatMode] = useState<RepeatMode>("off");
  const [isShuffle, setIsShuffle] = useState(false);
  const [isFullPlayerOpen, setIsFullPlayerOpen] = useState(false);
  const [playbackBackend, setPlaybackBackend] = useState<PlaybackBackend>("audio");

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const shuffledOrderRef = useRef<number[]>([]);
  const playbackBackendRef = useRef<PlaybackBackend>("audio");
  const playbackRateRef = useRef(1);
  const playbackAuthorityRef = useRef(new PlaybackSessionArbiter());
  const applePollRef = useRef<number | null>(null);
  const providerPollRef = useRef<number | null>(null);
  const handleEndedRef = useRef<() => void>(() => {});
  const sourceContextRef = useRef<PlaySource | null>(null);
  const playedAtRef = useRef(0);
  const listeningHistoryWriteRef = useRef(0);
  const skipFlagRef = useRef(false);
  const currentTrackRef = useRef<PlayerTrack | null>(null);
  const isPlayingRef = useRef(false);

  const playbackPrefs = usePlaybackPrefs();

  useEffect(() => {
    if (!playbackPrefs.appleMusicConnected) return;
    getAuthorizedMusicKit(playbackPrefs.appleMusicToken).catch((error) => {
      if (localStorage.getItem("wk-debug-player") === "1") {
        console.warn("[WAKILISHA] MusicKit prewarm failed", error);
      }
    });
  }, [playbackPrefs.appleMusicConnected, playbackPrefs.appleMusicToken]);

  useEffect(() => {
    currentTrackRef.current = currentTrack;
  }, [currentTrack]);

  useEffect(() => {
    isPlayingRef.current = isPlaying;
  }, [isPlaying]);

  useEffect(() => {
    playbackRateRef.current = playbackRate;
  }, [playbackRate]);

  const stopApplePolling = useCallback(() => {
    if (applePollRef.current !== null) {
      window.clearInterval(applePollRef.current);
      applePollRef.current = null;
    }
  }, []);

  const stopProviderPolling = useCallback(() => {
    if (providerPollRef.current !== null) {
      window.clearInterval(providerPollRef.current);
      providerPollRef.current = null;
    }
  }, []);

  const startApplePolling = useCallback(() => {
    stopApplePolling();
    applePollRef.current = window.setInterval(() => {
      if (playbackBackendRef.current !== "apple") return;
      const snapshot = getAppleMusicPlaybackSnapshot();
      if (!snapshot) return;
      setCurrentTime(snapshot.currentTime);
      if (snapshot.duration > 0) setDuration(snapshot.duration);
      setIsPlaying(snapshot.isPlaying);
    }, 750);
  }, [stopApplePolling]);

  const startYouTubePolling = useCallback(() => {
    stopProviderPolling();
    providerPollRef.current = window.setInterval(() => {
      if (playbackBackendRef.current !== "youtube") return;
      const snapshot = getYouTubePlaybackSnapshot();
      if (!snapshot) return;
      setCurrentTime(snapshot.currentTime);
      if (snapshot.duration > 0) setDuration(snapshot.duration);
      setIsPlaying(snapshot.isPlaying);
    }, 350);
  }, [stopProviderPolling]);

  const startSoundCloudPolling = useCallback(() => {
    stopProviderPolling();
    providerPollRef.current = window.setInterval(() => {
      if (playbackBackendRef.current !== "soundcloud") return;
      void readSoundCloudPlaybackSnapshot()
        .then((snapshot) => {
          if (!snapshot || playbackBackendRef.current !== "soundcloud") return;
          setCurrentTime(snapshot.currentTime);
          if (snapshot.duration > 0) setDuration(snapshot.duration);
          setIsPlaying(snapshot.isPlaying);
        })
        .catch(() => {});
    }, 350);
  }, [stopProviderPolling]);

  const stopEveryEngine = useCallback(
    (audio: HTMLAudioElement) => {
      stopApplePolling();
      stopProviderPolling();
      audio.pause();
      audio.removeAttribute("src");
      stopYouTube();
      stopSoundCloud();
      void stopAppleMusic().catch(() => {});
    },
    [stopApplePolling, stopProviderPolling],
  );

  const pauseEveryEngine = useCallback(
    (audio: HTMLAudioElement | null) => {
      stopApplePolling();
      stopProviderPolling();
      audio?.pause();
      pauseYouTube();
      pauseSoundCloud();
      void pauseAppleMusic().catch(() => {});
      setIsPlaying(false);
    },
    [stopApplePolling, stopProviderPolling],
  );

  const playTrackSource = useCallback(
    (track: PlayerTrack, audio: HTMLAudioElement) => {
      const sessionId = playbackAuthorityRef.current.claim();
      stopEveryEngine(audio);
      setCurrentTime(0);
      setDuration(track.duration || 0);

      const sessionIsCurrent = () =>
        playbackAuthorityRef.current.isCurrent(sessionId);

      const chooseBackend = (backend: PlaybackBackend) => {
        if (!sessionIsCurrent()) return false;
        playbackBackendRef.current = backend;
        setPlaybackBackend(backend);
        return true;
      };

      const playHtmlAudio = () => {
        if (!sessionIsCurrent()) return;
        if (!track.previewUrl) {
          setIsPlaying(false);
          return;
        }

        chooseBackend("audio");
        audio.src = track.previewUrl;
        audio.playbackRate =
          track.mediaKind && track.mediaKind !== "music_track"
            ? playbackRateRef.current
            : 1;

        void audio.play().catch((error) => {
          if (!sessionIsCurrent()) return;
          console.warn("Audio autoplay blocked:", error instanceof Error ? error.message : error);
          setIsPlaying(false);
        });
      };

      const fallbackToPreview = (message: string, error: unknown) => {
        if (!sessionIsCurrent()) return;
        console.warn(message, error);
        stopEveryEngine(audio);
        playHtmlAudio();
      };

      if (track.playbackEngine === "youtube" && track.providerObjectId) {
        chooseBackend("youtube");
        void playYouTubeTrack(track.providerObjectId, volume, {
          onSnapshot: (snapshot) => {
            if (!sessionIsCurrent() || playbackBackendRef.current !== "youtube") return;
            setCurrentTime(snapshot.currentTime);
            if (snapshot.duration > 0) setDuration(snapshot.duration);
            setIsPlaying(snapshot.isPlaying);
          },
          onEnded: () => {
            if (sessionIsCurrent() && playbackBackendRef.current === "youtube") {
              handleEndedRef.current();
            }
          },
          onError: (errorCode) =>
            fallbackToPreview(`YouTube playback failed with code ${errorCode}.`, errorCode),
          onAutoplayBlocked: () => {
            if (sessionIsCurrent()) setIsPlaying(false);
          },
        })
          .then(() => {
            if (sessionIsCurrent() && playbackBackendRef.current === "youtube") {
              startYouTubePolling();
            }
          })
          .catch((error) =>
            fallbackToPreview("YouTube playback failed, falling back to preview:", error),
          );
        return;
      }

      if (track.playbackEngine === "soundcloud" && track.providerUrl) {
        chooseBackend("soundcloud");
        void playSoundCloudTrack(track.providerUrl, volume, {
          onSnapshot: (snapshot) => {
            if (!sessionIsCurrent() || playbackBackendRef.current !== "soundcloud") return;
            setCurrentTime(snapshot.currentTime);
            if (snapshot.duration > 0) setDuration(snapshot.duration);
            setIsPlaying(snapshot.isPlaying);
          },
          onEnded: () => {
            if (sessionIsCurrent() && playbackBackendRef.current === "soundcloud") {
              handleEndedRef.current();
            }
          },
          onError: (error) =>
            fallbackToPreview("SoundCloud playback failed, falling back to preview:", error),
        })
          .then(() => {
            if (sessionIsCurrent() && playbackBackendRef.current === "soundcloud") {
              startSoundCloudPolling();
            }
          })
          .catch((error) =>
            fallbackToPreview("SoundCloud playback failed, falling back to preview:", error),
          );
        return;
      }

      const appleMusicId = String(
        track.appleMusicCatalogId || track.appleMusicId || "",
      ).trim();
      const useApple =
        playbackPrefs.appleMusicConnected && Boolean(appleMusicId);

      if (!useApple) {
        playHtmlAudio();
        return;
      }

      chooseBackend("apple");
      void playAppleMusicCatalogSong(
        appleMusicId,
        playbackPrefs.appleMusicToken,
      )
        .then(() => {
          if (!sessionIsCurrent()) {
            void stopAppleMusic().catch(() => {});
            return;
          }

          const snapshot = getAppleMusicPlaybackSnapshot();
          if (!snapshot?.isPlaying) {
            setIsPlaying(false);
            return;
          }

          setCurrentTime(snapshot.currentTime || 0);
          if (snapshot.duration > 0) setDuration(snapshot.duration);
          setIsPlaying(true);
          startApplePolling();
        })
        .catch((error) =>
          fallbackToPreview("Apple Music playback failed, falling back to preview:", error),
        );
    },
    [
      playbackPrefs.appleMusicConnected,
      playbackPrefs.appleMusicToken,
      startApplePolling,
      startSoundCloudPolling,
      startYouTubePolling,
      stopEveryEngine,
      volume,
    ],
  );

  useEffect(() => {
    const audio = new Audio();
    audio.preload = "auto";
    audio.volume = volume;
    audioRef.current = audio;

    const onTimeUpdate = () => {
      if (playbackBackendRef.current !== "audio") return;
      if (Number.isFinite(audio.currentTime)) setCurrentTime(audio.currentTime);
    };
    const onLoadedMetadata = () => {
      if (playbackBackendRef.current !== "audio") return;
      if (Number.isFinite(audio.duration) && audio.duration > 0) {
        setDuration(audio.duration);
      }
    };
    const onEnded = () => {
      if (playbackBackendRef.current !== "audio") return;
      setCurrentTime(Number.isFinite(audio.duration) ? audio.duration : 0);
      setIsPlaying(false);
      handleEndedRef.current();
    };
    const onPlay = () => {
      if (playbackBackendRef.current === "audio") setIsPlaying(true);
    };
    const onPause = () => {
      if (playbackBackendRef.current === "audio" && !audio.ended) setIsPlaying(false);
    };
    const onError = () => {
      if (playbackBackendRef.current === "audio") setIsPlaying(false);
    };

    audio.addEventListener("timeupdate", onTimeUpdate);
    audio.addEventListener("loadedmetadata", onLoadedMetadata);
    audio.addEventListener("ended", onEnded);
    audio.addEventListener("play", onPlay);
    audio.addEventListener("pause", onPause);
    audio.addEventListener("error", onError);

    return () => {
      playbackAuthorityRef.current.invalidate();
      stopEveryEngine(audio);
      audio.removeEventListener("timeupdate", onTimeUpdate);
      audio.removeEventListener("loadedmetadata", onLoadedMetadata);
      audio.removeEventListener("ended", onEnded);
      audio.removeEventListener("play", onPlay);
      audio.removeEventListener("pause", onPause);
      audio.removeEventListener("error", onError);
      audioRef.current = null;
    };
    // The singleton media element is intentionally created once.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    return () => {
      stopApplePolling();
      stopProviderPolling();
    };
  }, [stopApplePolling, stopProviderPolling]);

  useEffect(() => {
    if (!currentTrack || !isPlaying) return;
    const now = Date.now();
    const nearEnd = duration > 0 && currentTime >= duration - 2;
    if (!nearEnd && now - listeningHistoryWriteRef.current < 5000) return;
    listeningHistoryWriteRef.current = now;
    recordListeningEvent(currentTrack, {
      kind: nearEnd ? "complete" : "progress",
      backend: playbackBackend,
      currentTime,
      duration,
      playSource: sourceContextRef.current,
    });
  }, [currentTrack, currentTime, duration, isPlaying, playbackBackend]);

  const emitPlayEvent = useCallback((track: PlayerTrack, context?: Record<string, unknown>) => {
    trackEvent("player_play", {
      pageType: sourceContextRef.current?.pageType,
      entitySlug: track.id,
      entityType: track.mediaKind ?? "track",
      context: {
        track_title: track.title,
        artist: track.artist,
        album: track.album ?? null,
        source: track.source ?? null,
        source_section: sourceContextRef.current?.sourceSection,
        ...(context ?? {}),
      },
    });
  }, []);

  const startQueueItem = useCallback(
    (track: PlayerTrack, index: number, context?: Record<string, unknown>) => {
      const audio = audioRef.current;
      if (!audio) return;
      playedAtRef.current = Date.now();
      setCurrentTrack(track);
      setQueueIndex(index);
      setCurrentTime(0);
      setDuration(track.duration || 0);
      if (!track.mediaKind || track.mediaKind === "music_track") {
        playbackRateRef.current = 1;
        setPlaybackRateState(1);
      }
      playTrackSource(track, audio);
      emitPlayEvent(track, context);
    },
    [emitPlayEvent, playTrackSource],
  );

  const playTrack = useCallback(
    (track: PlayerTrack, newQueue?: PlayerTrack[], playSource?: PlaySource) => {
      const audio = audioRef.current;
      if (!audio) return;

      if (
        currentTrackRef.current &&
        currentTrackRef.current.id !== track.id &&
        isPlayingRef.current
      ) {
        skipFlagRef.current = true;
        trackEvent("player_skip", {
          pageType: sourceContextRef.current?.pageType,
          entitySlug: currentTrackRef.current.id,
          entityType: currentTrackRef.current.mediaKind ?? "track",
          context: {
            direction: "manual_select",
            source_section: sourceContextRef.current?.sourceSection,
          },
        });
      }

      sourceContextRef.current = playSource ?? null;
      setQueueContext(playSource ?? null);
      const fullQueue = newQueue?.length ? newQueue : [track];
      const found = fullQueue.findIndex((candidate) => candidate.id === track.id);
      const index = found >= 0 ? found : 0;
      setQueue(fullQueue);

      if (isShuffle) {
        const rest = fullQueue.map((_, candidate) => candidate).filter((candidate) => candidate !== index);
        for (let position = rest.length - 1; position > 0; position -= 1) {
          const swap = Math.floor(Math.random() * (position + 1));
          [rest[position], rest[swap]] = [rest[swap], rest[position]];
        }
        shuffledOrderRef.current = [index, ...rest];
      } else {
        shuffledOrderRef.current = fullQueue.map((_, candidate) => candidate);
      }

      recordListeningEvent(track, {
        kind: "start",
        backend: playbackBackendRef.current,
        currentTime: 0,
        duration: track.duration || 0,
        playSource,
      });
      startQueueItem(track, index, { queue_size: fullQueue.length });
    },
    [isShuffle, startQueueItem],
  );

  const pauseActivePlayback = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;
    pauseEveryEngine(audio);
  }, [pauseEveryEngine]);

  const pause = useCallback(() => {
    if (currentTrackRef.current && isPlayingRef.current) {
      trackEvent("player_pause", {
        pageType: sourceContextRef.current?.pageType,
        entitySlug: currentTrackRef.current.id,
        entityType: currentTrackRef.current.mediaKind ?? "track",
        context: {
          play_duration_ms: Date.now() - playedAtRef.current,
          source_section: sourceContextRef.current?.sourceSection,
        },
      });
    }
    pauseActivePlayback();
  }, [pauseActivePlayback]);

  const togglePlay = useCallback(() => {
    const audio = audioRef.current;
    const track = currentTrackRef.current;
    if (!audio || !track) return;

    if (isPlayingRef.current) {
      pauseActivePlayback();
      return;
    }

    if (playbackBackendRef.current === "youtube") {
      audio.pause();
      void pauseAppleMusic().catch(() => {});
      pauseSoundCloud();
      resumeYouTube();
      startYouTubePolling();
      setIsPlaying(true);
      return;
    }

    if (playbackBackendRef.current === "soundcloud") {
      audio.pause();
      void pauseAppleMusic().catch(() => {});
      pauseYouTube();
      resumeSoundCloud();
      startSoundCloudPolling();
      setIsPlaying(true);
      return;
    }

    if (playbackBackendRef.current === "apple") {
      audio.pause();
      pauseYouTube();
      pauseSoundCloud();
      const snapshot = getAppleMusicPlaybackSnapshot();
      if (snapshot) {
        void resumeAppleMusic().catch(() => {});
        startApplePolling();
        setIsPlaying(true);
      } else {
        playTrackSource(track, audio);
      }
      return;
    }

    void pauseAppleMusic().catch(() => {});
    pauseYouTube();
    pauseSoundCloud();
    if (!track.previewUrl) return;
    if (audio.ended) audio.currentTime = 0;
    audio.playbackRate =
      track.mediaKind && track.mediaKind !== "music_track"
        ? playbackRateRef.current
        : 1;
    void audio.play().catch(() => setIsPlaying(false));
  }, [
    pauseActivePlayback,
    playTrackSource,
    startApplePolling,
    startSoundCloudPolling,
    startYouTubePolling,
  ]);

  const orderedAdjacentIndex = useCallback(
    (direction: 1 | -1): number | null => {
      if (!queue.length) return null;
      if (isShuffle) {
        const position = shuffledOrderRef.current.indexOf(queueIndex);
        const targetPosition = position + direction;
        if (targetPosition >= 0 && targetPosition < shuffledOrderRef.current.length) {
          return shuffledOrderRef.current[targetPosition];
        }
        if (repeatMode === "all") {
          return direction > 0
            ? shuffledOrderRef.current[0]
            : shuffledOrderRef.current[shuffledOrderRef.current.length - 1];
        }
        return null;
      }

      const target = queueIndex + direction;
      if (target >= 0 && target < queue.length) return target;
      if (repeatMode === "all") return direction > 0 ? 0 : queue.length - 1;
      return null;
    },
    [isShuffle, queue.length, queueIndex, repeatMode],
  );

  const next = useCallback(() => {
    const targetIndex = orderedAdjacentIndex(1);
    if (targetIndex === null) {
      pauseActivePlayback();
      return;
    }
    const track = queue[targetIndex];
    if (!track) return;
    skipFlagRef.current = true;
    startQueueItem(track, targetIndex, { direction: "next", queue_size: queue.length });
  }, [orderedAdjacentIndex, pauseActivePlayback, queue, startQueueItem]);

  const prev = useCallback(() => {
    const audio = audioRef.current;
    if (!audio || !currentTrackRef.current) return;
    const activeTime =
      playbackBackendRef.current === "audio" ? audio.currentTime : currentTime;

    if (activeTime > 3) {
      const target = currentTrackRef.current;
      if (playbackBackendRef.current === "youtube") seekYouTube(0);
      else if (playbackBackendRef.current === "soundcloud") seekSoundCloud(0);
      else if (playbackBackendRef.current === "apple") void seekAppleMusic(0).catch(() => {});
      else audio.currentTime = 0;
      setCurrentTime(0);
      emitPlayEvent(target, { direction: "restart", queue_size: queue.length });
      return;
    }

    const targetIndex = orderedAdjacentIndex(-1);
    if (targetIndex === null) return;
    const track = queue[targetIndex];
    if (!track) return;
    skipFlagRef.current = true;
    startQueueItem(track, targetIndex, { direction: "previous", queue_size: queue.length });
  }, [currentTime, emitPlayEvent, orderedAdjacentIndex, queue, startQueueItem]);

  const playFromQueue = useCallback(
    (index: number) => {
      if (index < 0 || index >= queue.length) return;
      const track = queue[index];
      if (!track) return;
      skipFlagRef.current = true;
      startQueueItem(track, index, { direction: "queue_select", queue_size: queue.length });
    },
    [queue, startQueueItem],
  );

  const seek = useCallback(
    (time: number) => {
      const audio = audioRef.current;
      if (!audio) return;
      const max =
        playbackBackendRef.current === "audio" && Number.isFinite(audio.duration)
          ? audio.duration
          : duration || time;
      const clamped = Math.max(0, Math.min(time, max || time));

      if (playbackBackendRef.current === "youtube") seekYouTube(clamped);
      else if (playbackBackendRef.current === "soundcloud") seekSoundCloud(clamped);
      else if (playbackBackendRef.current === "apple") void seekAppleMusic(clamped).catch(() => {});
      else audio.currentTime = clamped;

      setCurrentTime(clamped);
    },
    [duration],
  );

  const handleSetVolume = useCallback((value: number) => {
    const clamped = Math.max(0, Math.min(1, value));
    setVolumeState(clamped);
    if (audioRef.current) audioRef.current.volume = clamped;
    setYouTubeVolume(clamped);
    setSoundCloudVolume(clamped);
  }, []);

  const handleSetPlaybackRate = useCallback((value: number) => {
    const clamped = Math.max(0.5, Math.min(2, value));
    playbackRateRef.current = clamped;
    setPlaybackRateState(clamped);
    if (audioRef.current && playbackBackendRef.current === "audio") {
      audioRef.current.playbackRate = clamped;
    }
  }, []);

  const toggleRepeat = useCallback(() => {
    setRepeatMode((current) =>
      current === "off" ? "all" : current === "all" ? "one" : "off",
    );
  }, []);

  const toggleShuffle = useCallback(() => {
    setIsShuffle((current) => {
      const nextValue = !current;
      if (nextValue && queue.length) {
        const rest = queue.map((_, index) => index).filter((index) => index !== queueIndex);
        for (let position = rest.length - 1; position > 0; position -= 1) {
          const swap = Math.floor(Math.random() * (position + 1));
          [rest[position], rest[swap]] = [rest[swap], rest[position]];
        }
        shuffledOrderRef.current = [queueIndex, ...rest];
      } else {
        shuffledOrderRef.current = queue.map((_, index) => index);
      }
      return nextValue;
    });
  }, [queue, queueIndex]);

  useEffect(() => {
    handleEndedRef.current = () => {
      const track = currentTrackRef.current;
      if (!track) return;

      if (!skipFlagRef.current) {
        trackEvent("player_complete", {
          pageType: sourceContextRef.current?.pageType,
          entitySlug: track.id,
          entityType: track.mediaKind ?? "track",
          context: {
            play_duration_ms: Date.now() - playedAtRef.current,
            source_section: sourceContextRef.current?.sourceSection,
          },
        });
      }
      skipFlagRef.current = false;

      if (repeatMode === "one") {
        const audio = audioRef.current;
        if (!audio) return;
        startQueueItem(track, queueIndex, { auto_advance: true, repeat_one: true });
        return;
      }

      if (!playbackPrefs.autoplay) {
        setIsPlaying(false);
        return;
      }

      const targetIndex = orderedAdjacentIndex(1);
      if (targetIndex === null) {
        setIsPlaying(false);
        return;
      }
      const target = queue[targetIndex];
      if (!target) return;
      startQueueItem(target, targetIndex, { auto_advance: true, queue_size: queue.length });
    };
  }, [
    orderedAdjacentIndex,
    playbackPrefs.autoplay,
    queue,
    queueIndex,
    repeatMode,
    startQueueItem,
  ]);

  const canGoNext = orderedAdjacentIndex(1) !== null;
  const canGoPrev = orderedAdjacentIndex(-1) !== null;
  const progress = duration > 0 ? Math.max(0, Math.min(1, currentTime / duration)) : 0;
  const playbackSourceLabel =
    playbackBackend === "apple"
      ? "Apple Music"
      : playbackBackend === "youtube"
        ? "YouTube"
        : playbackBackend === "soundcloud"
          ? "SoundCloud"
          : currentTrack?.source ?? null;

  const value: PlayerContextValue = {
    currentTrack,
    isPlaying,
    currentTime,
    duration,
    volume,
    playbackRate,
    queue,
    queueIndex,
    queueContext,
    repeatMode,
    isShuffle,
    isFullPlayerOpen,
    playbackBackend,
    playbackSourceLabel,
    playTrack,
    togglePlay,
    pause,
    next,
    prev,
    playFromQueue,
    seek,
    setVolume: handleSetVolume,
    setPlaybackRate: handleSetPlaybackRate,
    toggleRepeat,
    toggleShuffle,
    openFullPlayer: () => setIsFullPlayerOpen(true),
    closeFullPlayer: () => setIsFullPlayerOpen(false),
    canGoNext,
    canGoPrev,
    progress,
  };

  return (
    <PlayerContext.Provider value={value}>
      {children}
      <ProviderPlaybackCanvas
        backend={playbackBackend}
        trackTitle={currentTrack?.title ?? null}
        isFullPlayerOpen={isFullPlayerOpen}
      />
    </PlayerContext.Provider>
  );
}

export function usePlayer() {
  const context = useContext(PlayerContext);
  if (!context) {
    throw new Error("usePlayer must be used within a PlayerProvider");
  }
  return context;
}
