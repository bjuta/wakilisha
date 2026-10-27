import { createContext, useContext, useState, useCallback, useRef, useEffect } from "react";
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
import { resolvePreviewCrossfadeSeconds } from "@/services/player/crossfadePolicy";
import { WakilishaMixEngine, equalPowerLevels, resolveMixableAudioSource, safeTempoMatchRate } from "@/services/player/WakilishaMixEngine";
import { startPlaybackAccountSync } from "@/services/player/playbackAccountSync";
import { ProviderPlaybackCanvas } from "@/components/design-system/music/ProviderPlaybackCanvas";
import {
  getYouTubePlaybackSnapshot,
  pauseYouTube,
  playYouTubeTrack,
  resumeYouTube,
  stopYouTube,
  seekYouTube,
  setYouTubeVolume,
} from "@/services/player/youtubePlayback";
import {
  pauseSoundCloud,
  playSoundCloudTrack,
  readSoundCloudPlaybackSnapshot,
  resumeSoundCloud,
  stopSoundCloud,
  seekSoundCloud,
  setSoundCloudVolume,
} from "@/services/player/soundCloudPlayback";
import {
  PlaybackArbiter,
  type PlaybackSessionId,
} from "@/services/player/playbackArbiter";
import {
  clearUpcomingQueue,
  moveQueueItem as moveQueueItemModel,
  removeQueueItem as removeQueueItemModel,
  resolveQueueOrder,
} from "@/services/player/queueModel";

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

export interface PlayerTrack {
  id: string;
  registryTrackId?: string | null;
  title: string;
  artist: string;
  artworkUrl?: string;
  album?: string;
  releaseId?: string;
  duration?: number; // seconds
  isPlayable?: boolean;
  isExplicit?: boolean;
  source?: string; // e.g. "YouTube", "Spotify", "SoundCloud"
  previewUrl?: string; // playable URL (preview or full-length audio)
  bpm?: number | null;
  appleMusicId?: string | null; // Apple Music catalog song id
  appleMusicCatalogId?: string | null; // Apple Music catalog song id alias
  playbackEngine?: PlaylistPlaybackEngine;
  providerKey?: string | null;
  providerObjectId?: string | null;
  providerUrl?: string | null;
  providerEmbedUrl?: string | null;
  artistSlug?: string; // for deep-linking
  trackSlug?: string; // for deep-linking
}

// ─── Read playback prefs from localStorage ───
function readPlaybackPrefs(): {
  autoplay: boolean;
  crossfade: boolean;
  crossfadeSeconds: number;
  smartMix: boolean;
  explicitFilter: boolean;
  appleMusicConnected: boolean;
  appleMusicToken: string | null;
  preferApplePreviews: boolean;
} {
  try {
    const raw = localStorage.getItem("wk-playback-v2");
    if (!raw) {
      return {
        autoplay: true,
        crossfade: false,
        crossfadeSeconds: 6,
        smartMix: true,
        explicitFilter: false,
        appleMusicConnected: false,
        appleMusicToken: null,
        preferApplePreviews: false,
      };
    }

    const prefs = JSON.parse(raw);
    return {
      autoplay: prefs.autoplay !== false,
      crossfade: prefs.crossfade === true,
      crossfadeSeconds: Number.isFinite(prefs.crossfadeSeconds)
        ? Math.min(12, Math.max(3, Math.round(prefs.crossfadeSeconds))) : 6,
      smartMix: prefs.smartMix !== false,
      explicitFilter: prefs.explicitFilter === true,
      appleMusicConnected: prefs.appleMusicConnected === true,
      appleMusicToken: typeof prefs.appleMusicToken === "string" ? prefs.appleMusicToken : null,
      preferApplePreviews: prefs.preferApplePreviews === true,
    };
  } catch {
    return {
      autoplay: true,
      crossfade: false,
      crossfadeSeconds: 6,
      smartMix: true,
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
    const onStorage = (e: StorageEvent) => {
      if (e.key === "wk-playback-v2") setPrefs(readPlaybackPrefs());
    };
    window.addEventListener("storage", onStorage);
    // Also listen for same-tab changes
    const onCustom = () => setPrefs(readPlaybackPrefs());
    window.addEventListener("wk-playback-changed", onCustom);
    return () => {
      window.removeEventListener("storage", onStorage);
      window.removeEventListener("wk-playback-changed", onCustom);
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
  releasePath?: string;
}

export function playerTrackIdentity(
  track: PlayerTrack,
): string {
  return (
    track.registryTrackId?.trim() ||
    track.id
  );
}

function hasContinuousCollectionIntent(
  playSource: PlaySource | undefined,
  queueLength: number,
): boolean {
  if (queueLength <= 1) return false;

  return [
    "release",
    "playlist",
    "chart_edition",
  ].includes(
    playSource?.entityType || "",
  );
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
  queueOrder: number[];
  repeatMode: RepeatMode;
  isShuffle: boolean;
  isFullPlayerOpen: boolean;
  playbackBackend: PlaybackBackend;
  playbackSourceLabel: string | null;
  playSource: PlaySource | null;
  playTrack: (track: PlayerTrack, queue?: PlayerTrack[], playSource?: PlaySource) => void;
  togglePlay: () => void;
  pause: () => void;
  next: () => void;
  prev: () => void;
  playFromQueue: (index: number) => void;
  moveQueueItem: (fromIndex: number, toIndex: number) => void;
  removeQueueItem: (index: number) => void;
  clearUpcoming: () => void;
  seek: (time: number) => void;
  setVolume: (vol: number) => void;
  setPlaybackRate: (rate: number) => void;
  toggleRepeat: () => void;
  toggleShuffle: () => void;
  openFullPlayer: (panel?: "lyrics" | "comments" | "queue" | "more") => void;
  requestedPlayerPanel: "lyrics" | "comments" | "queue" | "more" | null;
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
  const [playbackRate, setPlaybackRateState] = useState(1);
  const [queue, setQueue] = useState<PlayerTrack[]>([]);
  const [queueIndex, setQueueIndex] = useState(0);
  const [repeatMode, setRepeatMode] = useState<RepeatMode>("off");
  const [isShuffle, setIsShuffle] = useState(false);
  const [isFullPlayerOpen, setIsFullPlayerOpen] = useState(false);
  const [requestedPlayerPanel, setRequestedPlayerPanel] = useState<"lyrics" | "comments" | "queue" | "more" | null>(null);
  const [playbackBackend, setPlaybackBackend] = useState<PlaybackBackend>("audio");

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const standbyAudioRef = useRef<HTMLAudioElement | null>(null);
  const mixEngineRef = useRef(new WakilishaMixEngine());
  const previewFadeRef = useRef<{
    outgoing: HTMLAudioElement;
    incoming: HTMLAudioElement;
    frame: number | null;
    fraction: number;
    usesMixer: boolean;
  } | null>(null);
  const previewFadeAttemptRef = useRef(0);
  const previewFadePendingRef = useRef(false);
  const previewFadeEndedDuringPendingRef = useRef(false);
  const previewFadeSuppressedRef = useRef(false);
  const startPreviewFadeRef = useRef<(audio: HTMLAudioElement) => void>(() => {});
  const volumeRef = useRef(0.8);
  const shuffledOrderRef = useRef<number[]>([]);
  const playbackBackendRef = useRef<PlaybackBackend>("audio");
  const applePollRef = useRef<number | null>(null);
  const providerPollRef = useRef<number | null>(null);
  const handleEndedRef = useRef<() => void>(() => {});
  const hasUserInteractedRef = useRef(false);
  const pendingPlayRef = useRef(false);
  const sourceContextRef = useRef<PlaySource | null>(null);
  const continuousCollectionRef =
    useRef(false);
  const playedAtRef = useRef<number>(0);
  const listeningHistoryWriteRef = useRef<number>(0);
  const skipFlagRef = useRef(false);
  const currentTrackRef = useRef<PlayerTrack | null>(null);
  const isPlayingRef = useRef(false);
  const playbackArbiterRef = useRef(new PlaybackArbiter());
  const htmlAudioSessionRef = useRef<PlaybackSessionId | null>(null);
  const playbackStartingRef = useRef(false);
  const restartInterruptedPlaybackRef = useRef(false);

  // ─── Read user playback preferences ───
  const playbackPrefs = usePlaybackPrefs();
  useEffect(() => startPlaybackAccountSync(), []);

  useEffect(() => {
    if (!playbackPrefs.appleMusicConnected) return;

    getAuthorizedMusicKit(playbackPrefs.appleMusicToken)
      .then(() => {
        if (localStorage.getItem("wk-debug-player") === "1") {
          console.info("[WAKILISHA] MusicKit ready");
        }
      })
      .catch((err) => {
        console.warn("[WAKILISHA] MusicKit prewarm failed:", err);
      });
  }, [playbackPrefs.appleMusicConnected, playbackPrefs.appleMusicToken]);

  const stopApplePolling = useCallback(() => {
    if (applePollRef.current !== null) {
      window.clearInterval(applePollRef.current);
      applePollRef.current = null;
    }
  }, []);

  const startApplePolling = useCallback(() => {
    stopApplePolling();

    applePollRef.current = window.setInterval(() => {
      const snapshot = getAppleMusicPlaybackSnapshot();
      if (!snapshot) return;

      setCurrentTime(snapshot.currentTime);
      if (snapshot.duration > 0) setDuration(snapshot.duration);
      setIsPlaying(snapshot.isPlaying);
    }, 750);
  }, [stopApplePolling]);

  const stopProviderPolling = useCallback(() => {
    if (providerPollRef.current !== null) {
      window.clearInterval(providerPollRef.current);
      providerPollRef.current = null;
    }
  }, []);

  const startYouTubePolling = useCallback(() => {
    stopProviderPolling();

    providerPollRef.current = window.setInterval(() => {
      if (
        playbackBackendRef.current !==
        "youtube"
      ) {
        return;
      }

      const snapshot =
        getYouTubePlaybackSnapshot();

      if (!snapshot) {
        return;
      }

      setCurrentTime(
        snapshot.currentTime,
      );

      if (
        snapshot.duration > 0
      ) {
        setDuration(
          snapshot.duration,
        );
      }

      setIsPlaying(
        snapshot.isPlaying,
      );
    }, 350);
  }, [
    stopProviderPolling,
  ]);

  const startSoundCloudPolling = useCallback(() => {
    stopProviderPolling();

    providerPollRef.current = window.setInterval(() => {
      if (
        playbackBackendRef.current !==
        "soundcloud"
      ) {
        return;
      }

      void readSoundCloudPlaybackSnapshot()
        .then((snapshot) => {
          if (
            !snapshot ||
            playbackBackendRef.current !==
              "soundcloud"
          ) {
            return;
          }

          setCurrentTime(
            snapshot.currentTime,
          );

          if (
            snapshot.duration > 0
          ) {
            setDuration(
              snapshot.duration,
            );
          }

          setIsPlaying(
            snapshot.isPlaying,
          );
        })
        .catch(() => {});
    }, 350);
  }, [
    stopProviderPolling,
  ]);

  useEffect(() => {
    return () => {
      playbackArbiterRef.current.invalidate();
      playbackStartingRef.current = false;
      restartInterruptedPlaybackRef.current = false;
      stopApplePolling();
      stopProviderPolling();
      void stopAppleMusic().catch(() => {});
      stopYouTube();
      stopSoundCloud();
    };
  }, [
    stopApplePolling,
    stopProviderPolling,
  ]);

  const isPlaybackSessionCurrent = useCallback((
    sessionId: PlaybackSessionId,
  ) => {
    return playbackArbiterRef.current.isCurrent(
      sessionId,
    );
  }, []);

  const cancelPreviewFade = useCallback(() => {
    previewFadeAttemptRef.current += 1;
    const wasPending = previewFadePendingRef.current;
    previewFadePendingRef.current = false;
    previewFadeEndedDuringPendingRef.current = false;
    if (wasPending) {
      const pending = standbyAudioRef.current;
      pending?.pause();
      pending?.removeAttribute("src");
      if (pending) mixEngineRef.current.setLevel(pending, 1, volumeRef.current);
    }
    const fade = previewFadeRef.current;
    previewFadeRef.current = null;
    if (fade) {
      if (fade.frame !== null) window.cancelAnimationFrame(fade.frame);
      for (const deck of [fade.outgoing, fade.incoming]) {
        if (deck !== audioRef.current) {
          deck.pause();
          deck.removeAttribute("src");
        }
      }
    }
    if (audioRef.current) mixEngineRef.current.setLevel(audioRef.current, 1, volumeRef.current);
  }, []);

  const silenceAllPlayback = useCallback(async (
    audio: HTMLAudioElement | null,
  ) => {
    stopApplePolling();
    stopProviderPolling();

    pendingPlayRef.current = false;
    htmlAudioSessionRef.current = null;
    cancelPreviewFade();

    // Silencing the stale audio argument could leave a second deck audible.
    for (const deck of new Set([audio, audioRef.current, standbyAudioRef.current])) {
      deck?.pause();
      deck?.removeAttribute("src");
    }

    stopYouTube();
    stopSoundCloud();

    await stopAppleMusic()
      .catch(() => {});
  }, [
    cancelPreviewFade,
    stopApplePolling,
    stopProviderPolling,
  ]);

  useEffect(() => {
    if (!playbackPrefs.crossfade &&
        (previewFadePendingRef.current || previewFadeRef.current)) {
      cancelPreviewFade();
    }
  }, [cancelPreviewFade, playbackPrefs.crossfade]);

  const playViaHtmlAudio = useCallback(async (
    track: PlayerTrack,
    audio: HTMLAudioElement,
    sessionId: PlaybackSessionId,
  ) => {
    if (!isPlaybackSessionCurrent(sessionId)) {
      return;
    }

    await silenceAllPlayback(audio);

    if (!isPlaybackSessionCurrent(sessionId)) {
      return;
    }

    playbackBackendRef.current = "audio";
    htmlAudioSessionRef.current = sessionId;
    setPlaybackBackend("audio");

    if (!track.previewUrl) {
      playbackStartingRef.current = false;
      setIsPlaying(false);
      return;
    }

    const activeAudio = audioRef.current || audio;
    const source = resolveMixableAudioSource(track.previewUrl);
    // Never attach a media element to Web Audio until native playback succeeds.
    // A suspended AudioContext or inaccessible transport must not mute music.
    const useMixTransport = playbackPrefs.crossfade &&
      source.mixable && mixEngineRef.current.isRunning();
    if (useMixTransport) {
      activeAudio.crossOrigin = "anonymous";
    } else {
      activeAudio.removeAttribute("crossorigin");
    }
    activeAudio.volume = volumeRef.current;
    activeAudio.src = useMixTransport ? source.url : track.previewUrl;
    pendingPlayRef.current = true;

    try {
      try {
        await activeAudio.play();
      } catch (initialError) {
        // Retry the original playable provider URL without a Web Audio graph.
        if (!useMixTransport || !isPlaybackSessionCurrent(sessionId)) throw initialError;
        activeAudio.pause();
        activeAudio.removeAttribute("crossorigin");
        activeAudio.src = track.previewUrl;
        await activeAudio.play();
      }
      if (useMixTransport && activeAudio.currentSrc.includes("/__wk-mix/") &&
          mixEngineRef.current.isRunning() &&
          mixEngineRef.current.prepare(activeAudio, source)) {
        mixEngineRef.current.setMasterVolume(volumeRef.current);
        mixEngineRef.current.setLevel(activeAudio, 1, volumeRef.current);
        if (playbackPrefs.smartMix) {
          mixEngineRef.current.analyzeShortAudio(source.url, track.duration || 30);
        }
      }

      if (
        !isPlaybackSessionCurrent(sessionId) ||
        htmlAudioSessionRef.current !== sessionId
      ) {
        return;
      }

      pendingPlayRef.current = false;
      playbackStartingRef.current = false;
      restartInterruptedPlaybackRef.current = false;
      setIsPlaying(true);
    } catch (err) {
      if (
        !isPlaybackSessionCurrent(sessionId) ||
        htmlAudioSessionRef.current !== sessionId
      ) {
        return;
      }

      console.warn(
        "Audio autoplay blocked:",
        err instanceof Error
          ? err.message
          : String(err),
      );

      pendingPlayRef.current = false;
      playbackStartingRef.current = false;
      setIsPlaying(false);
    }
  }, [
    isPlaybackSessionCurrent,
    silenceAllPlayback,
    playbackPrefs.crossfade,
    playbackPrefs.smartMix,
  ]);

  const playTrackSource = useCallback((
    track: PlayerTrack,
    audio: HTMLAudioElement,
  ) => {
    // Initialize/resume the audio graph during the user activation gesture.
    mixEngineRef.current.wake();
    const playbackSessionId =
      playbackArbiterRef.current.begin();

    playbackStartingRef.current = true;
    restartInterruptedPlaybackRef.current = false;
    setIsPlaying(false);

    const isCurrentSession = () =>
      isPlaybackSessionCurrent(
        playbackSessionId,
      );

    let fallbackStarted = false;

    const fallbackToPreview = async (
      message: string,
      error: unknown,
    ) => {
      if (
        !isCurrentSession() ||
        fallbackStarted
      ) {
        return;
      }

      fallbackStarted = true;

      console.warn(
        message,
        error,
      );

      if (track.previewUrl) {
        await playViaHtmlAudio(
          track,
          audio,
          playbackSessionId,
        );
      } else if (isCurrentSession()) {
        playbackStartingRef.current = false;
        setIsPlaying(false);
      }
    };

    void (async () => {
      await silenceAllPlayback(audio);

      if (!isCurrentSession()) {
        return;
      }

      if (
        track.playbackEngine === "youtube" &&
        track.providerObjectId
      ) {
        playbackBackendRef.current = "youtube";
        setPlaybackBackend("youtube");
        setCurrentTime(0);
        setDuration(
          track.duration || 0,
        );

        try {
          await playYouTubeTrack(
            track.providerObjectId,
            volume,
            {
              onSnapshot: (snapshot) => {
                if (
                  !isCurrentSession() ||
                  playbackBackendRef.current !==
                    "youtube"
                ) {
                  return;
                }

                if (snapshot.isPlaying) {
                  playbackStartingRef.current = false;
                  restartInterruptedPlaybackRef.current = false;
                }

                setCurrentTime(
                  snapshot.currentTime,
                );

                if (
                  snapshot.duration > 0
                ) {
                  setDuration(
                    snapshot.duration,
                  );
                }

                setIsPlaying(
                  snapshot.isPlaying,
                );
              },
              onEnded: () => {
                if (
                  isCurrentSession() &&
                  playbackBackendRef.current ===
                    "youtube"
                ) {
                  handleEndedRef.current();
                }
              },
              onError: (
                errorCode,
              ) => {
                if (
                  !isCurrentSession() ||
                  playbackBackendRef.current !==
                    "youtube"
                ) {
                  return;
                }

                void fallbackToPreview(
                  `YouTube playback failed with code ${errorCode}.`,
                  errorCode,
                );
              },
              onAutoplayBlocked: () => {
                if (
                  isCurrentSession() &&
                  playbackBackendRef.current ===
                    "youtube"
                ) {
                  playbackStartingRef.current = false;
                  setIsPlaying(false);
                }
              },
            },
          );

          if (
            isCurrentSession() &&
            playbackBackendRef.current ===
              "youtube"
          ) {
            startYouTubePolling();
          }
        } catch (error) {
          if (
            !isCurrentSession() ||
            playbackBackendRef.current !==
              "youtube"
          ) {
            return;
          }

          await fallbackToPreview(
            "YouTube playback failed, falling back to preview:",
            error,
          );
        }

        return;
      }

      if (
        track.playbackEngine === "soundcloud" &&
        track.providerUrl
      ) {
        playbackBackendRef.current = "soundcloud";
        setPlaybackBackend("soundcloud");
        setCurrentTime(0);
        setDuration(
          track.duration || 0,
        );

        try {
          await playSoundCloudTrack(
            track.providerUrl,
            volume,
            {
              onSnapshot: (snapshot) => {
                if (
                  !isCurrentSession() ||
                  playbackBackendRef.current !==
                    "soundcloud"
                ) {
                  return;
                }

                if (snapshot.isPlaying) {
                  playbackStartingRef.current = false;
                  restartInterruptedPlaybackRef.current = false;
                }

                setCurrentTime(
                  snapshot.currentTime,
                );

                if (
                  snapshot.duration > 0
                ) {
                  setDuration(
                    snapshot.duration,
                  );
                }

                setIsPlaying(
                  snapshot.isPlaying,
                );
              },
              onEnded: () => {
                if (
                  isCurrentSession() &&
                  playbackBackendRef.current ===
                    "soundcloud"
                ) {
                  handleEndedRef.current();
                }
              },
              onError: (error) => {
                if (
                  !isCurrentSession() ||
                  playbackBackendRef.current !==
                    "soundcloud"
                ) {
                  return;
                }

                void fallbackToPreview(
                  "SoundCloud playback failed, falling back to preview:",
                  error,
                );
              },
            },
          );

          if (
            isCurrentSession() &&
            playbackBackendRef.current ===
              "soundcloud"
          ) {
            startSoundCloudPolling();
          }
        } catch (error) {
          if (
            !isCurrentSession() ||
            playbackBackendRef.current !==
              "soundcloud"
          ) {
            return;
          }

          await fallbackToPreview(
            "SoundCloud playback failed, falling back to preview:",
            error,
          );
        }

        return;
      }

      const rawAppleMusicId =
        track.appleMusicCatalogId ||
        track.appleMusicId ||
        null;

      const appleMusicId =
        rawAppleMusicId
          ? String(
              rawAppleMusicId,
            ).trim()
          : null;

      const shouldUseAppleMusic =
        playbackPrefs.appleMusicConnected &&
        Boolean(
          appleMusicId,
        );

      if (
        !shouldUseAppleMusic ||
        !appleMusicId
      ) {
        await playViaHtmlAudio(
          track,
          audio,
          playbackSessionId,
        );
        return;
      }

      playbackBackendRef.current = "apple";
      setPlaybackBackend("apple");
      setCurrentTime(0);
      setDuration(
        track.duration || 0,
      );

      try {
        const started =
          await playAppleMusicCatalogSong(
            appleMusicId,
            playbackPrefs.appleMusicToken,
          );

        if (!isCurrentSession()) {
          return;
        }

        playbackStartingRef.current = false;

        if (!started) {
          setIsPlaying(false);
          return;
        }

        restartInterruptedPlaybackRef.current = false;
        setCurrentTime(0);
        setDuration(
          track.duration || 0,
        );
        setIsPlaying(true);

        startApplePolling();
      } catch (err) {
        if (!isCurrentSession()) {
          return;
        }

        await fallbackToPreview(
          "Apple Music playback failed, falling back to preview:",
          err,
        );
      }
    })().catch((error) => {
      if (!isCurrentSession()) {
        return;
      }

      playbackStartingRef.current = false;
      setIsPlaying(false);

      console.warn(
        "Playback startup failed:",
        error,
      );
    });
  }, [
    isPlaybackSessionCurrent,
    playbackPrefs.appleMusicConnected,
    playbackPrefs.appleMusicToken,
    playViaHtmlAudio,
    silenceAllPlayback,
    startApplePolling,
    startSoundCloudPolling,
    startYouTubePolling,
    volume,
  ]);

  // One active preview deck and one standby. Both share the event contract.
  // Only the active deck is allowed to update the public player state.
  useEffect(() => {
    const first = new Audio();
    const second = new Audio();
    first.preload = "auto";
    second.preload = "auto";
    first.volume = volumeRef.current;
    second.volume = volumeRef.current;
    audioRef.current = first;
    standbyAudioRef.current = second;

    const isActive = (audio: HTMLAudioElement) => {
      const sessionId = htmlAudioSessionRef.current;
      return audio === audioRef.current &&
        sessionId !== null &&
        playbackBackendRef.current === "audio" &&
        playbackArbiterRef.current.isCurrent(sessionId);
    };
    const bindDeck = (audio: HTMLAudioElement) => {
      const onTimeUpdate = () => {
        if (!isActive(audio)) return;
        if (audio.duration > 0 && Number.isFinite(audio.duration)) {
          setCurrentTime(audio.currentTime);
          // Seeking into the final seconds does not create an immediate fade.
          // Earlier seeks allow the next natural end to blend as usual.
          if (previewFadeSuppressedRef.current &&
              audio.duration - audio.currentTime > 12.5) {
            previewFadeSuppressedRef.current = false;
          }
          startPreviewFadeRef.current(audio);
        }
      };
      const onLoadedMetadata = () => {
        if (audio.duration > 0 && Number.isFinite(audio.duration)) {
          const source = resolveMixableAudioSource(audio.currentSrc || audio.src);
          if (source.mixable && mixEngineRef.current.hasDeck(audio)) {
            mixEngineRef.current.analyzeShortAudio(audio.currentSrc || source.url, audio.duration);
          }
          if (isActive(audio)) setDuration(audio.duration);
        }
      };
      const onEnded = () => {
        if (!isActive(audio)) return;
        if (previewFadePendingRef.current) {
          previewFadeEndedDuringPendingRef.current = true;
          return;
        }
        playbackStartingRef.current = false;
        setCurrentTime(audio.duration || 0);
        setIsPlaying(false);
        handleEndedRef.current();
      };
      const onPlay = () => {
        if (!isActive(audio)) return;
        pendingPlayRef.current = false;
        playbackStartingRef.current = false;
        restartInterruptedPlaybackRef.current = false;
        setIsPlaying(true);
      };
      const onPause = () => {
        if (isActive(audio) && !audio.ended) setIsPlaying(false);
      };
      const onError = () => {
        if (!isActive(audio)) return;
        console.warn("Audio playback error:", audio.error?.message || "unknown");
        pendingPlayRef.current = false;
        playbackStartingRef.current = false;
        setIsPlaying(false);
      };
      audio.addEventListener("timeupdate", onTimeUpdate);
      audio.addEventListener("loadedmetadata", onLoadedMetadata);
      audio.addEventListener("ended", onEnded);
      audio.addEventListener("play", onPlay);
      audio.addEventListener("pause", onPause);
      audio.addEventListener("error", onError);
      return () => {
        audio.removeEventListener("timeupdate", onTimeUpdate);
        audio.removeEventListener("loadedmetadata", onLoadedMetadata);
        audio.removeEventListener("ended", onEnded);
        audio.removeEventListener("play", onPlay);
        audio.removeEventListener("pause", onPause);
        audio.removeEventListener("error", onError);
      };
    };
    const unbindFirst = bindDeck(first);
    const unbindSecond = bindDeck(second);
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
      previewFadeAttemptRef.current += 1;
      const fade = previewFadeRef.current;
      if (fade?.frame !== null && fade?.frame !== undefined) {
        window.cancelAnimationFrame(fade.frame);
      }
      previewFadeRef.current = null;
      for (const audio of [first, second]) {
        audio.pause();
        audio.removeAttribute("src");
      }
      unbindFirst();
      unbindSecond();
      document.removeEventListener("click", unlock);
      document.removeEventListener("touchstart", unlock);
      document.removeEventListener("keydown", unlock);
      audioRef.current = null;
      standbyAudioRef.current = null;
      mixEngineRef.current.close();
    };
  }, []);

  // Sync refs to current state for analytics callbacks
  useEffect(() => { currentTrackRef.current = currentTrack; }, [currentTrack]);
  useEffect(() => { isPlayingRef.current = isPlaying; }, [isPlaying]);

  // ─── Local listening history / continue listening ───
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
  }, [currentTrack, isPlaying, currentTime, duration, playbackBackend]);

  // Handle completion for every playback backend.
  useEffect(() => {
    handleEndedRef.current = () => {
      const audio = audioRef.current;
      const finishedTrack =
        currentTrackRef.current;

      if (
        !audio ||
        !finishedTrack
      ) {
        return;
      }

      if (!skipFlagRef.current) {
        trackEvent(
          "player_complete",
          {
            pageType:
              sourceContextRef.current
                ?.pageType,
            entitySlug:
              finishedTrack.id,
            entityType: "track",
            context: {
              track_title:
                finishedTrack.title,
              artist:
                finishedTrack.artist,
              play_duration_ms:
                Date.now() -
                playedAtRef.current,
              source_section:
                sourceContextRef.current
                  ?.sourceSection,
            },
          },
        );
      }

      skipFlagRef.current =
        false;

      if (
        repeatMode === "one"
      ) {
        playedAtRef.current =
          Date.now();

        setCurrentTime(0);

        if (
          playbackBackendRef.current ===
          "youtube"
        ) {
          seekYouTube(0);
          resumeYouTube();
          startYouTubePolling();
          setIsPlaying(true);
          return;
        }

        if (
          playbackBackendRef.current ===
          "soundcloud"
        ) {
          seekSoundCloud(0);
          resumeSoundCloud();
          setIsPlaying(true);
          return;
        }

        if (
          playbackBackendRef.current ===
          "apple"
        ) {
          seekAppleMusic(0)
            .then(
              () =>
                resumeAppleMusic(),
            )
            .catch(() => {});

          setIsPlaying(true);
          return;
        }

        audio.currentTime = 0;

        audio
          .play()
          .catch(() => {});

        return;
      }

      if (!playbackPrefs.autoplay && repeatMode !== "all") {
        setIsPlaying(false);
        return;
      }

      const hasNext =
        repeatMode === "all" ||
        (
          isShuffle
            ? shuffledOrderRef.current
                .indexOf(
                  queueIndex,
                ) <
              shuffledOrderRef.current
                .length -
                1
            : queueIndex <
              queue.length - 1
        );

      if (!hasNext) {
        setIsPlaying(false);
        return;
      }

      let nextIdx =
        isShuffle
          ? shuffledOrderRef.current[
              shuffledOrderRef.current
                .indexOf(
                  queueIndex,
                ) + 1
            ]
          : queueIndex + 1;

      if (
        nextIdx === undefined ||
        nextIdx >= queue.length
      ) {
        if (
          repeatMode !== "all"
        ) {
          setIsPlaying(false);
          return;
        }

        nextIdx =
          isShuffle
            ? shuffledOrderRef
                .current[0]
            : 0;
      }

      {
        const maxIterations =
          queue.length;

        let iterations = 0;

        while (
          nextIdx !== undefined &&
          nextIdx < queue.length &&
          (
            queue[nextIdx]
              ?.isPlayable === false ||
            (
              playbackPrefs
                .explicitFilter &&
              queue[nextIdx]
                ?.isExplicit
            )
          ) &&
          iterations <
            maxIterations
        ) {
          iterations += 1;

          if (isShuffle) {
            const position =
              shuffledOrderRef.current
                .indexOf(
                  nextIdx,
                );

            nextIdx =
              position + 1 <
              shuffledOrderRef.current
                .length
                ? shuffledOrderRef
                    .current[
                      position + 1
                    ]
                : repeatMode ===
                    "all"
                  ? shuffledOrderRef
                      .current[0]
                  : undefined;
          } else {
            nextIdx += 1;

            if (
              nextIdx >=
                queue.length &&
              repeatMode ===
                "all"
            ) {
              nextIdx = 0;
            }
          }
        }
      }

      if (
        nextIdx === undefined ||
        nextIdx >= queue.length
      ) {
        setIsPlaying(false);
        return;
      }

      const nextTrack =
        queue[nextIdx];

      if (!nextTrack) {
        setIsPlaying(false);
        return;
      }

      const wrapped =
        repeatMode === "all" &&
        nextIdx ===
          (
            isShuffle
              ? shuffledOrderRef
                  .current[0]
              : 0
          );

      playedAtRef.current =
        Date.now();

      previewFadeSuppressedRef.current = false;
      setCurrentTrack(
        nextTrack,
      );

      setQueueIndex(
        nextIdx,
      );

      setCurrentTime(0);

      setDuration(
        nextTrack.duration || 0,
      );

      playTrackSource(
        nextTrack,
        audio,
      );

      trackEvent(
        "player_play",
        {
          pageType:
            sourceContextRef.current
              ?.pageType,
          entitySlug:
            nextTrack.id,
          entityType: "track",
          context: {
            track_title:
              nextTrack.title,
            artist:
              nextTrack.artist,
            album:
              nextTrack.album ??
              null,
            source:
              nextTrack.source ??
              null,
            source_section:
              sourceContextRef.current
                ?.sourceSection,
            queue_size:
              queue.length,
            auto_advance:
              true,
            wrap_around:
              wrapped,
          },
        },
      );
    };
  }, [
    isShuffle,
    playbackPrefs.autoplay,
    playbackPrefs.explicitFilter,
    playTrackSource,
    queue,
    queueIndex,
    repeatMode,
    startYouTubePolling,
  ]);

  // Chapter 25: transitions are automatic across HTML-audio media and cancelled
  // by every explicit playback action. The player state switches when
  // the incoming audio actually starts, never at the outgoing ended event.
  useEffect(() => {
    startPreviewFadeRef.current = (outgoing) => {
      if (previewFadePendingRef.current || previewFadeRef.current ||
          previewFadeSuppressedRef.current || !isPlayingRef.current ||
          !playbackPrefs.crossfade || !playbackPrefs.autoplay ||
          repeatMode === "one" || queue.length < 2 ||
          audioRef.current !== outgoing) return;

      const order = isShuffle ? shuffledOrderRef.current : queue.map((_, i) => i);
      const position = order.indexOf(queueIndex);
      if (position < 0) return;
      const nextIdx = order[position + 1] ?? (repeatMode === "all" ? order[0] : undefined);
      if (nextIdx === undefined || nextIdx === queueIndex) return;
      const nextTrack = queue[nextIdx];
      if (!nextTrack || nextTrack.isPlayable === false ||
          (playbackPrefs.explicitFilter && nextTrack.isExplicit) ||
          (nextTrack.playbackEngine && nextTrack.playbackEngine !== "audio")) return;

      const seconds = resolvePreviewCrossfadeSeconds({
        enabled: playbackPrefs.crossfade,
        continuousPlayback: playbackPrefs.autoplay,
        selectedSeconds: playbackPrefs.crossfadeSeconds,
        sourceEntityType: sourceContextRef.current?.entityType,
        shuffled: isShuffle,
        repeatOne: repeatMode === "one",
        automatic: true,
        backend: playbackBackendRef.current,
        nextPrefersApple: playbackPrefs.appleMusicConnected &&
          Boolean(nextTrack.appleMusicCatalogId || nextTrack.appleMusicId),
        currentPreviewUrl: currentTrackRef.current?.previewUrl,
        nextPreviewUrl: nextTrack.previewUrl,
        currentDuration: outgoing.duration,
        nextDuration: nextTrack.duration || 0,
      });
      const remaining = outgoing.duration - outgoing.currentTime;
      if (!seconds || remaining > seconds || remaining <= 0.05) return;
      const incoming = standbyAudioRef.current;
      const session = htmlAudioSessionRef.current;
      if (!incoming || incoming === outgoing || session === null) return;

      incoming.pause();
      // The standby deck is prepared early, so its buffer is usually warm.
      const source = resolveMixableAudioSource(nextTrack.previewUrl!);
      const usesMixer = source.mixable && mixEngineRef.current.isRunning() &&
        mixEngineRef.current.hasDeck(outgoing) &&
        mixEngineRef.current.prepare(incoming, source);
      if (usesMixer) {
        mixEngineRef.current.setLevel(incoming, 0, volumeRef.current);
      } else {
        // Never start two full-volume streams when native gain is fixed (iOS).
        try { incoming.volume = 0; } catch { previewFadeSuppressedRef.current = true; return; }
        if (incoming.volume > 0.001) { previewFadeSuppressedRef.current = true; return; }
      }
      incoming.playbackRate = outgoing.playbackRate;
      if (playbackPrefs.smartMix) {
        const currentSource = resolveMixableAudioSource(currentTrackRef.current?.previewUrl || "");
        const outgoingBpm = currentTrackRef.current?.bpm || mixEngineRef.current.bpmFor(currentSource.url);
        const incomingBpm = nextTrack.bpm || mixEngineRef.current.bpmFor(source.url);
        const tempoRate = safeTempoMatchRate(outgoingBpm, incomingBpm);
        incoming.playbackRate = outgoing.playbackRate * tempoRate;
        (incoming as HTMLAudioElement & { preservesPitch?: boolean }).preservesPitch = true;
      }
      if (incoming.src !== new URL(source.url, window.location.origin).href) incoming.src = source.url;
      previewFadePendingRef.current = true;
      previewFadeEndedDuringPendingRef.current = false;
      const attempt = ++previewFadeAttemptRef.current;
      void incoming.play().then(() => {
        if (attempt !== previewFadeAttemptRef.current ||
            htmlAudioSessionRef.current !== session ||
            !playbackArbiterRef.current.isCurrent(session) ||
            audioRef.current !== outgoing) {
          incoming.pause();
          incoming.removeAttribute("src");
          return;
        }
        previewFadePendingRef.current = false;
        previewFadeEndedDuringPendingRef.current = false;
        const finishedTrack = currentTrackRef.current;
        const fade = { outgoing, incoming, frame: null as number | null, fraction: 0, usesMixer };
        const startTime = window.performance.now();
        previewFadeRef.current = fade;
        audioRef.current = incoming;
        standbyAudioRef.current = outgoing;
        const outgoingPlayedAt = playedAtRef.current;
        const completedSource = sourceContextRef.current;
        skipFlagRef.current = false;
        previewFadeSuppressedRef.current = false;
        playedAtRef.current = Date.now();
        currentTrackRef.current = nextTrack;
        setCurrentTrack(nextTrack);
        setQueueIndex(nextIdx);
        setCurrentTime(incoming.currentTime);
        setDuration(nextTrack.duration || 0);
        setIsPlaying(true);
        recordListeningEvent(nextTrack, {
          kind: "start", backend: "audio", currentTime: incoming.currentTime,
          duration: nextTrack.duration || 0, playSource: sourceContextRef.current,
        });
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
            crossfade_seconds: seconds,
          },
        });
        const completeOutgoing = () => {
          if (!finishedTrack) return;
          trackEvent("player_complete", {
            pageType: completedSource?.pageType,
            entitySlug: finishedTrack.id,
            entityType: "track",
            context: {
              track_title: finishedTrack.title,
              artist: finishedTrack.artist,
              play_duration_ms: Date.now() - outgoingPlayedAt,
              source_section: completedSource?.sourceSection,
            },
          });
          recordListeningEvent(finishedTrack, {
            kind: "complete", backend: "audio", currentTime: outgoing.duration,
            duration: outgoing.duration, playSource: completedSource,
          });
        };
        // A slow response after the old deck ended is a clean cut, not a
        // fade from silence. The incoming track is already active.
        if (outgoing.ended || outgoing.paused) {
          mixEngineRef.current.setLevel(incoming, 1, volumeRef.current);
          completeOutgoing();
          outgoing.pause();
          outgoing.removeAttribute("src");
          previewFadeRef.current = null;
          return;
        }
        const scheduled = usesMixer && mixEngineRef.current.beginFade(outgoing, incoming, seconds);
        const ramp = (now: number) => {
          if (previewFadeRef.current !== fade) return;
          fade.fraction = Math.min(1, Math.max(0, (now - startTime) / (seconds * 1000)));
          if (!scheduled) {
            const levels = equalPowerLevels(fade.fraction);
            mixEngineRef.current.setLevel(outgoing, levels.outgoing, volumeRef.current);
            mixEngineRef.current.setLevel(incoming, levels.incoming, volumeRef.current);
          }
          if (fade.fraction < 1) {
            fade.frame = window.requestAnimationFrame(ramp);
          } else {
            completeOutgoing();
            outgoing.pause();
            outgoing.removeAttribute("src");
            outgoing.playbackRate = 1;
            mixEngineRef.current.setLevel(outgoing, 1, volumeRef.current);
            mixEngineRef.current.setLevel(incoming, 1, volumeRef.current);
            incoming.playbackRate = 1;
            previewFadeRef.current = null;
          }
        };
        fade.frame = window.requestAnimationFrame(ramp);
      }).catch(() => {
        if (attempt !== previewFadeAttemptRef.current) return;
        previewFadePendingRef.current = false;
        previewFadeSuppressedRef.current = true;
        incoming.pause();
        incoming.removeAttribute("src");
        mixEngineRef.current.setLevel(incoming, 1, volumeRef.current);
        if (previewFadeEndedDuringPendingRef.current &&
            htmlAudioSessionRef.current === session) {
          previewFadeEndedDuringPendingRef.current = false;
          handleEndedRef.current();
        }
      });
    };
    return () => { startPreviewFadeRef.current = () => {}; };
  }, [
    isShuffle, playbackPrefs.appleMusicConnected, playbackPrefs.autoplay,
    playbackPrefs.crossfade, playbackPrefs.crossfadeSeconds, playbackPrefs.smartMix,
    playbackPrefs.explicitFilter,
    queue, queueIndex, repeatMode,
  ]);


  // Warm the next permitted audio source and analyze short media before n - fade.
  useEffect(() => {
    if (!playbackPrefs.autoplay || !playbackPrefs.crossfade || !isPlaying ||
        playbackBackend !== "audio" || !mixEngineRef.current.isRunning() ||
        previewFadePendingRef.current || previewFadeRef.current) return;
    const order = isShuffle ? shuffledOrderRef.current : queue.map((_, index) => index);
    const position = order.indexOf(queueIndex);
    const nextIndex = order[position + 1] ?? (repeatMode === "all" ? order[0] : undefined);
    if (nextIndex === undefined || nextIndex === queueIndex) return;
    const candidate = queue[nextIndex];
    const standby = standbyAudioRef.current;
    if (!candidate?.previewUrl || !standby || candidate.isPlayable === false ||
        (candidate.playbackEngine && candidate.playbackEngine !== "audio")) return;
    const source = resolveMixableAudioSource(candidate.previewUrl);
    if (!source.mixable || !mixEngineRef.current.prepare(standby, source)) return;
    if (standby.src !== new URL(source.url, window.location.origin).href) {
      standby.src = source.url;
      standby.load();
    }
    if (playbackPrefs.smartMix) {
      mixEngineRef.current.analyzeShortAudio(source.url, candidate.duration || 30);
    }
  }, [isPlaying, playbackBackend, playbackPrefs.autoplay, playbackPrefs.crossfade,
    playbackPrefs.smartMix, isShuffle, queue, queueIndex, repeatMode]);

  // ─── Play a track ───
  const playTrack = useCallback((track: PlayerTrack, newQueue?: PlayerTrack[], playSource?: PlaySource) => {
    const audio = audioRef.current;
    if (!audio) return;

    // If switching tracks, fire player_skip for the previous track
    if (
      currentTrackRef.current &&
      playerTrackIdentity(
        currentTrackRef.current,
      ) !== playerTrackIdentity(track) &&
      isPlayingRef.current
    ) {
      skipFlagRef.current = true;
      trackEvent("player_skip", {
        pageType: sourceContextRef.current?.pageType,
        entitySlug:
          playerTrackIdentity(
            currentTrackRef.current,
          ),
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

    recordListeningEvent(track, {
      kind: "start",
      backend: playbackBackendRef.current,
      currentTime: 0,
      duration: track.duration || 0,
      playSource,
    });

    const fullQueue =
      newQueue && newQueue.length > 0
        ? newQueue
        : [track];
    const selectedIdentity =
      playerTrackIdentity(track);
    const idx = fullQueue.findIndex(
      (item) =>
        playerTrackIdentity(item) ===
        selectedIdentity,
    );
    const safeIdx = idx >= 0 ? idx : 0;

    continuousCollectionRef.current =
      hasContinuousCollectionIntent(
        playSource,
        fullQueue.length,
      );

    previewFadeSuppressedRef.current = false;
    skipFlagRef.current = false;
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

    const mediaKind =
      (track as PlayerTrack & {
        mediaKind?: string;
      }).mediaKind;

    if (
      mediaKind !== "audio_episode" &&
      mediaKind !== "standalone_audio"
    ) {
      setPlaybackRateState(1);
      audio.playbackRate = 1;
    }

    // Load audio source
    playTrackSource(track, audio);

    // Fire player_play event
    trackEvent("player_play", {
      pageType: playSource?.pageType,
      entitySlug:
        playerTrackIdentity(track),
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
  }, [isShuffle, playTrackSource]);

  // ─── Pause ───
  const pauseActivePlayback =
    useCallback(() => {
      const audio =
        audioRef.current;

      stopApplePolling();
      stopProviderPolling();

      if (playbackStartingRef.current) {
        playbackArbiterRef.current.invalidate();

        playbackStartingRef.current = false;
        restartInterruptedPlaybackRef.current = true;
        setIsPlaying(false);

        void silenceAllPlayback(audio);
        return;
      }

      cancelPreviewFade();
      audio?.pause();
      pauseYouTube();
      pauseSoundCloud();

      void pauseAppleMusic()
        .catch(() => {});

      setIsPlaying(false);
    }, [
      cancelPreviewFade,
      silenceAllPlayback,
      stopApplePolling,
      stopProviderPolling,
    ]);

  // ─── Toggle play/pause ───
  const togglePlay = useCallback(() => {
    const audio = audioRef.current;

    if (
      !audio ||
      !currentTrack
    ) {
      return;
    }

    const appleSnapshot =
      playbackBackendRef.current ===
        "apple"
        ? getAppleMusicPlaybackSnapshot()
        : null;

    const activePlayback =
      isPlaying ||
      (
        playbackBackendRef.current ===
          "audio" &&
        !audio.paused &&
        !audio.ended
      ) ||
      appleSnapshot?.isPlaying === true;

    if (activePlayback) {
      pauseActivePlayback();
      return;
    }

    // At the exhausted end of a list, Play starts the collection again.
    if (
      !isPlaying &&
      duration > 0 &&
      currentTime >= duration - 0.1 &&
      queue.length > 1 &&
      (isShuffle
        ? shuffledOrderRef.current.indexOf(queueIndex) === shuffledOrderRef.current.length - 1
        : queueIndex === queue.length - 1)
    ) {
      const startIndex = isShuffle ? shuffledOrderRef.current[0] : 0;
      const firstTrack = queue[startIndex];
      if (firstTrack) {
        playTrack(firstTrack, queue, sourceContextRef.current || undefined);
        return;
      }
    }

    if (
      restartInterruptedPlaybackRef.current
    ) {
      restartInterruptedPlaybackRef.current = false;

      playTrackSource(
        currentTrack,
        audio,
      );
      return;
    }

    if (
      playbackBackendRef.current ===
      "youtube"
    ) {
      resumeYouTube();
      startYouTubePolling();
      setIsPlaying(true);
      return;
    }

    if (
      playbackBackendRef.current ===
      "soundcloud"
    ) {
      resumeSoundCloud();
      setIsPlaying(true);
      return;
    }

    if (
      playbackBackendRef.current ===
      "apple"
    ) {
      resumeAppleMusic()
        .catch(() => {});

      setIsPlaying(true);
      startApplePolling();
      return;
    }

    if (!currentTrack.previewUrl) {
      return;
    }

    if (audio.ended) {
      audio.currentTime = 0;
    }

    audio
      .play()
      .catch(() => {});
  }, [
    currentTrack,
    currentTime,
    duration,
    isPlaying,
    isShuffle,
    pauseActivePlayback,
    playTrack,
    playTrackSource,
    queue,
    queueIndex,
    startApplePolling,
    startYouTubePolling,
  ]);

  const pause = useCallback(() => {
    if (
      currentTrackRef.current &&
      isPlayingRef.current
    ) {
      trackEvent(
        "player_pause",
        {
          pageType:
            sourceContextRef.current
              ?.pageType,
          entitySlug:
            currentTrackRef.current
              .id,
          entityType: "track",
          context: {
            track_title:
              currentTrackRef.current
                .title,
            artist:
              currentTrackRef.current
                .artist,
            play_duration_ms:
              Date.now() -
              playedAtRef.current,
            source_section:
              sourceContextRef.current
                ?.sourceSection,
          },
        },
      );
    }

    pauseActivePlayback();
  }, [
    pauseActivePlayback,
  ]);

  // ─── Next track ───
  const next = useCallback(() => {
    previewFadeSuppressedRef.current = false;
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
        pauseActivePlayback();
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
          pauseActivePlayback();
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

    previewFadeSuppressedRef.current = false;
    setCurrentTrack(nextTrack);
    setQueueIndex(nextIdx);
    setCurrentTime(0);
    setDuration(nextTrack.duration || 0);

    playTrackSource(nextTrack, audio);

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
  }, [
    isShuffle,
    pauseActivePlayback,
    playTrackSource,
    queue,
    queueIndex,
    repeatMode,
  ]);

  // ─── Previous track ───
  const prev = useCallback(() => {
    previewFadeSuppressedRef.current = false;
    const audio = audioRef.current;
    if (!audio || queue.length === 0) return;

    const prevTrack = currentTrackRef.current;

    // If more than 3 seconds in, restart current track
    const activeCurrentTime =
      playbackBackendRef.current ===
        "audio"
        ? audio.currentTime
        : currentTime;

    if (
      activeCurrentTime > 3
    ) {
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
      if (
        playbackBackendRef.current ===
        "youtube"
      ) {
        seekYouTube(0);

        if (
          isPlayingRef.current
        ) {
          resumeYouTube();
          startYouTubePolling();
        }
      } else if (
        playbackBackendRef.current ===
        "soundcloud"
      ) {
        seekSoundCloud(0);

        if (
          isPlayingRef.current
        ) {
          resumeSoundCloud();
        }
      } else if (
        playbackBackendRef.current ===
        "apple"
      ) {
        seekAppleMusic(0)
          .catch(() => {});

        if (
          isPlayingRef.current
        ) {
          resumeAppleMusic()
            .catch(() => {});
        }
      } else {
        audio.currentTime = 0;

        if (!audio.paused) {
          audio
            .play()
            .catch(() => {});
        }
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

    playTrackSource(targetTrack, audio);

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
  }, [
    currentTime,
    isShuffle,
    playTrackSource,
    queue,
    queueIndex,
    startYouTubePolling,
  ]);

  // ─── Play from queue ───
  const playFromQueue = useCallback((index: number) => {
    previewFadeSuppressedRef.current = false;
    const audio = audioRef.current;
    if (!audio || index < 0 || index >= queue.length) return;
    const track = queue[index];
    if (!track) return;

    // Fire player_skip for previous track if switching
    if (
      currentTrackRef.current &&
      playerTrackIdentity(
        currentTrackRef.current,
      ) !== playerTrackIdentity(track) &&
      isPlayingRef.current
    ) {
      skipFlagRef.current = true;
      trackEvent("player_skip", {
        pageType: sourceContextRef.current?.pageType,
        entitySlug:
          playerTrackIdentity(
            currentTrackRef.current,
          ),
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
    previewFadeSuppressedRef.current = false;

    setQueueIndex(index);
    setCurrentTrack(track);
    setCurrentTime(0);
    setDuration(track.duration || 0);

    playTrackSource(track, audio);

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
  }, [queue, playTrackSource]);

  // ─── Seek ───
  const seek = useCallback((
    time: number,
  ) => {
    const audio =
      audioRef.current;

    if (!audio) return;
    cancelPreviewFade();
    previewFadeSuppressedRef.current = true;

    const max =
      playbackBackendRef.current ===
        "audio"
        ? (
            audio.duration &&
            Number.isFinite(
              audio.duration,
            )
              ? audio.duration
              : duration ||
                time
          )
        : duration || time;

    const clamped =
      Math.max(
        0,
        Math.min(
          time,
          max || time,
        ),
      );

    if (
      playbackBackendRef.current ===
      "youtube"
    ) {
      seekYouTube(
        clamped,
      );
    } else if (
      playbackBackendRef.current ===
      "soundcloud"
    ) {
      seekSoundCloud(
        clamped,
      );
    } else if (
      playbackBackendRef.current ===
      "apple"
    ) {
      seekAppleMusic(
        clamped,
      ).catch(() => {});
    } else {
      audio.currentTime =
        clamped;
    }

    setCurrentTime(
      clamped,
    );
  }, [
    cancelPreviewFade,
    duration,
  ]);

  // ─── Volume ───
  const handleSetVolume = useCallback((vol: number) => {
    const audio = audioRef.current;
    const clamped = Math.max(
      0,
      Math.min(
        1,
        vol,
      ),
    );

    volumeRef.current = clamped;
    setVolumeState(clamped);
    mixEngineRef.current.setMasterVolume(clamped);

    const fade = previewFadeRef.current;
    if (fade && !fade.usesMixer) {
      const levels = equalPowerLevels(fade.fraction);
      mixEngineRef.current.setLevel(fade.outgoing, levels.outgoing, clamped);
      mixEngineRef.current.setLevel(fade.incoming, levels.incoming, clamped);
    } else if (!fade && audio) {
      mixEngineRef.current.setLevel(audio, 1, clamped);
    }

    setYouTubeVolume(
      clamped,
    );

    setSoundCloudVolume(
      clamped,
    );
  }, []);

  const handleSetPlaybackRate = useCallback((
    rate: number,
  ) => {
    const clamped = Math.max(
      0.5,
      Math.min(2, rate),
    );

    setPlaybackRateState(clamped);

    if (audioRef.current) {
      audioRef.current.playbackRate = clamped;
    }
    if (standbyAudioRef.current) standbyAudioRef.current.playbackRate = clamped;
  }, []);

  // Sync initial volume to audio element
  useEffect(() => {
    const audio = audioRef.current;
    if (audio) {
      audio.volume = volume;
      volumeRef.current = volume;
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

  // ─── Queue management ───
  const moveQueueItem = useCallback((
    fromIndex: number,
    toIndex: number,
  ) => {
    if (isShuffle) return;

    const mutation = moveQueueItemModel(
      queue,
      queueIndex,
      fromIndex,
      toIndex,
    );

    if (mutation.queue === queue) return;

    setQueue(mutation.queue);
    setQueueIndex(mutation.queueIndex);
    shuffledOrderRef.current = mutation.playbackOrder;
  }, [
    isShuffle,
    queue,
    queueIndex,
  ]);

  const removeQueueItem = useCallback((
    index: number,
  ) => {
    const mutation = removeQueueItemModel(
      queue,
      queueIndex,
      shuffledOrderRef.current,
      index,
      isShuffle,
    );

    if (mutation.queue === queue) return;

    setQueue(mutation.queue);
    setQueueIndex(mutation.queueIndex);
    shuffledOrderRef.current = mutation.playbackOrder;
  }, [
    isShuffle,
    queue,
    queueIndex,
  ]);

  const clearUpcoming = useCallback(() => {
    const mutation = clearUpcomingQueue(
      queue,
      queueIndex,
      shuffledOrderRef.current,
      isShuffle,
    );

    if (
      mutation.queue.length === queue.length &&
      mutation.queueIndex === queueIndex
    ) {
      return;
    }

    setQueue(mutation.queue);
    setQueueIndex(mutation.queueIndex);
    shuffledOrderRef.current = mutation.playbackOrder;
  }, [
    isShuffle,
    queue,
    queueIndex,
  ]);

  // ─── Full player ───
  const openFullPlayer = useCallback((panel?: "lyrics" | "comments" | "queue" | "more") => {
    setRequestedPlayerPanel(panel ?? null);
    setIsFullPlayerOpen(true);
  }, []);
  const closeFullPlayer = useCallback(() => setIsFullPlayerOpen(false), []);

  const queueOrder = resolveQueueOrder(
    queue.length,
    queueIndex,
    shuffledOrderRef.current,
    isShuffle,
  );

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
  const playbackSourceLabel =
    playbackBackend === "apple"
      ? "Apple Music"
      : playbackBackend === "youtube"
        ? "YouTube"
        : playbackBackend === "soundcloud"
          ? "SoundCloud"
          : (
              currentTrack?.source ??
              null
            );

  const value: PlayerContextValue = {
    currentTrack,
    isPlaying,
    currentTime,
    duration,
    volume,
    playbackRate,
    queue,
    queueIndex,
    queueOrder,
    repeatMode,
    isShuffle,
    isFullPlayerOpen,
    playbackBackend,
    playbackSourceLabel,
    playSource: sourceContextRef.current,
    playTrack,
    togglePlay,
    pause,
    next,
    prev,
    playFromQueue,
    moveQueueItem,
    removeQueueItem,
    clearUpcoming,
    seek,
    setVolume: handleSetVolume,
    setPlaybackRate: handleSetPlaybackRate,
    toggleRepeat,
    toggleShuffle,
    openFullPlayer,
    requestedPlayerPanel,
    closeFullPlayer,
    canGoNext,
    canGoPrev,
    progress,
  };

  return (
    <PlayerContext.Provider value={value}>
      {children}
      <ProviderPlaybackCanvas
        backend={playbackBackend}
        trackTitle={
          currentTrack?.title ??
          null
        }
        isFullPlayerOpen={
          isFullPlayerOpen
        }
      />
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
