import {
  type KeyboardEvent,
  type RefObject,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { providerEmbedUrl } from "./providerSource";

export interface VideoPlaybackCaption {
  trackNumber: number;
  languageTag: string;
  label: string;
  kind: "captions" | "subtitles" | "forced_subtitles";
  src: string;
  isDefault: boolean;
}

export type VideoPlaybackSource =
  | {
      kind: "native";
      url: string;
      mimeType: string;
      adaptiveUrl?: string | null;
      adaptiveMimeType?: string | null;
      poster?: string | null;
      captions?: VideoPlaybackCaption[];
    }
  | {
      kind: "provider";
      sourceId?: string | null;
      providerKey: string;
      providerObjectId: string;
      canonicalUrl?: string | null;
    };

interface VideoPlaybackCanvasProps {
  source: VideoPlaybackSource;
  title: string;
  videoRef?: RefObject<HTMLVideoElement | null>;
  compact?: boolean;
  collapsed?: boolean;
  onCollapse?: () => void;
  onExpand?: () => void;
  onClose?: () => void;
  className?: string;
}

type FullscreenVideoElement = HTMLVideoElement & {
  webkitDisplayingFullscreen?: boolean;
  webkitSupportsFullscreen?: boolean;
  webkitEnterFullscreen?: () => void;
  webkitExitFullscreen?: () => void;
};

type FullscreenElement = HTMLElement & {
  webkitRequestFullscreen?: () => void | Promise<void>;
};

type FullscreenDocument = Document & {
  webkitFullscreenElement?: Element | null;
  webkitExitFullscreen?: () => void | Promise<void>;
};

function formatTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return "0:00";
  const whole = Math.floor(seconds);
  const hours = Math.floor(whole / 3600);
  const minutes = Math.floor((whole % 3600) / 60);
  const remaining = whole % 60;
  return hours > 0
    ? `${hours}:${String(minutes).padStart(2, "0")}:${String(remaining).padStart(2, "0")}`
    : `${minutes}:${String(remaining).padStart(2, "0")}`;
}

function trackKind(
  kind: VideoPlaybackCaption["kind"],
): "captions" | "subtitles" {
  return kind === "captions" ? "captions" : "subtitles";
}

function joinClasses(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

export function VideoPlaybackCanvas({
  source,
  title,
  videoRef: externalVideoRef,
  compact = false,
  collapsed = false,
  onCollapse,
  onExpand,
  onClose,
  className = "",
}: VideoPlaybackCanvasProps) {
  const internalVideoRef = useRef<HTMLVideoElement>(null);
  const shellRef = useRef<HTMLDivElement>(null);
  const videoRef = externalVideoRef ?? internalVideoRef;
  const captions = useMemo(
    () => source.kind === "native" ? source.captions ?? [] : [],
    [source],
  );
  const defaultCaption = captions.find((caption) => caption.isDefault);
  const [activeCaptionTrack, setActiveCaptionTrack] = useState<number | null>(
    defaultCaption?.trackNumber ?? null,
  );
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [fullscreen, setFullscreen] = useState(false);
  const [controlsVisible, setControlsVisible] = useState(true);
  const [activeCueLines, setActiveCueLines] = useState<string[]>([]);
  const [deliveryMode, setDeliveryMode] = useState<
    "mp4" | "hls-native" | "hls-mse"
  >("mp4");
  const controlsHideTimerRef = useRef<number | null>(null);

  const syncCaptionTracks = useCallback(() => {
    const element = videoRef.current;
    if (!element) return;
    for (let index = 0; index < element.textTracks.length; index += 1) {
      const textTrack = element.textTracks[index];
      const caption = captions[index];
      textTrack.mode =
        caption && caption.trackNumber === activeCaptionTrack
          ? "hidden"
          : "disabled";
    }
  }, [activeCaptionTrack, captions, videoRef]);

  useEffect(() => {
    syncCaptionTracks();
  }, [syncCaptionTracks]);

  useEffect(() => {
    const element = videoRef.current;

    if (!element || source.kind !== "native") {
      setDeliveryMode("mp4");
      return;
    }

    let cancelled = false;
    let hlsInstance: {
      destroy: () => void;
    } | null = null;

    const fallbackToMp4 = () => {
      if (cancelled) return;

      const resumeTime = Number.isFinite(element.currentTime)
        ? element.currentTime
        : 0;
      const resumePlayback = !element.paused;

      hlsInstance?.destroy();
      hlsInstance = null;

      const restorePlayback = () => {
        if (resumeTime > 0 && Number.isFinite(element.duration)) {
          element.currentTime = Math.min(
            resumeTime,
            Math.max(0, element.duration - 0.1),
          );
        }
        if (resumePlayback) {
          void element.play().catch(() => undefined);
        }
      };

      element.src = source.url;
      element.load();
      element.addEventListener(
        "loadedmetadata",
        restorePlayback,
        { once: true },
      );
      setDeliveryMode("mp4");
    };

    const adaptiveUrl = source.adaptiveUrl?.trim() || "";
    const adaptiveMimeType =
      source.adaptiveMimeType?.trim() || "";

    if (
      !adaptiveUrl
      || adaptiveMimeType !== "application/vnd.apple.mpegurl"
    ) {
      element.src = source.url;
      setDeliveryMode("mp4");
      return;
    }

    if (element.canPlayType(adaptiveMimeType)) {
      element.src = adaptiveUrl;
      setDeliveryMode("hls-native");
      return;
    }

    void import("hls.js")
      .then(({ default: Hls }) => {
        if (cancelled) return;

        if (!Hls.isSupported()) {
          fallbackToMp4();
          return;
        }

        const hls = new Hls();
        hlsInstance = hls;

        hls.on(Hls.Events.ERROR, (_event, data) => {
          if (data.fatal) {
            fallbackToMp4();
          }
        });

        hls.loadSource(adaptiveUrl);
        hls.attachMedia(element);
        setDeliveryMode("hls-mse");
      })
      .catch(() => {
        fallbackToMp4();
      });

    return () => {
      cancelled = true;
      hlsInstance?.destroy();
    };
  }, [
    source,
    videoRef,
  ]);

  useEffect(() => {
    const element = videoRef.current;
    if (!element || source.kind !== "native") {
      setActiveCueLines([]);
      return;
    }

    const readActiveCues = () => {
      if (activeCaptionTrack === null) {
        setActiveCueLines([]);
        return;
      }

      const selectedIndex = captions.findIndex(
        (caption) => caption.trackNumber === activeCaptionTrack,
      );
      const selectedTrack =
        selectedIndex >= 0
          ? element.textTracks[selectedIndex]
          : null;
      const activeCues = selectedTrack?.activeCues;

      if (!selectedTrack || !activeCues) {
        setActiveCueLines([]);
        return;
      }

      const lines: string[] = [];
      for (let index = 0; index < activeCues.length; index += 1) {
        const cue = activeCues[index];
        if (cue && "text" in cue) {
          const vttCue = cue as VTTCue;
          const htmlText =
            typeof vttCue.getCueAsHTML === "function"
              ? vttCue.getCueAsHTML().textContent
              : null;
          const text = (htmlText || vttCue.text || "").trim();
          if (text) lines.push(text);
        }
      }
      setActiveCueLines(lines);
    };

    const bindCueListeners = () => {
      syncCaptionTracks();
      for (let index = 0; index < element.textTracks.length; index += 1) {
        element.textTracks[index].removeEventListener(
          "cuechange",
          readActiveCues,
        );
        element.textTracks[index].addEventListener(
          "cuechange",
          readActiveCues,
        );
      }
      readActiveCues();
    };

    bindCueListeners();
    element.textTracks.addEventListener("addtrack", bindCueListeners);

    return () => {
      element.textTracks.removeEventListener("addtrack", bindCueListeners);
      for (let index = 0; index < element.textTracks.length; index += 1) {
        element.textTracks[index].removeEventListener(
          "cuechange",
          readActiveCues,
        );
      }
    };
  }, [
    activeCaptionTrack,
    captions,
    source.kind,
    syncCaptionTracks,
    videoRef,
  ]);

  const clearControlsHideTimer = useCallback(() => {
    if (controlsHideTimerRef.current !== null) {
      window.clearTimeout(controlsHideTimerRef.current);
      controlsHideTimerRef.current = null;
    }
  }, []);

  const revealControls = useCallback(() => {
    setControlsVisible(true);
    clearControlsHideTimer();
    if (playing && !settingsOpen && !compact) {
      controlsHideTimerRef.current = window.setTimeout(() => {
        setControlsVisible(false);
        controlsHideTimerRef.current = null;
      }, 2400);
    }
  }, [
    clearControlsHideTimer,
    compact,
    playing,
    settingsOpen,
  ]);

  useEffect(() => {
    if (!playing || settingsOpen || compact) {
      clearControlsHideTimer();
      setControlsVisible(true);
      return;
    }

    revealControls();
    return clearControlsHideTimer;
  }, [
    clearControlsHideTimer,
    compact,
    playing,
    revealControls,
    settingsOpen,
  ]);

  useEffect(() => {
    const element = videoRef.current as FullscreenVideoElement | null;
    const fullscreenDocument = document as FullscreenDocument;

    const syncFullscreenState = () => {
      const shell = shellRef.current;
      const wrapperFullscreen = Boolean(
        shell
        && (
          document.fullscreenElement === shell
          || fullscreenDocument.webkitFullscreenElement === shell
        ),
      );
      const nativeVideoFullscreen = Boolean(
        element?.webkitDisplayingFullscreen,
      );
      setFullscreen(wrapperFullscreen || nativeVideoFullscreen);
    };

    document.addEventListener("fullscreenchange", syncFullscreenState);
    document.addEventListener(
      "webkitfullscreenchange",
      syncFullscreenState as EventListener,
    );
    element?.addEventListener(
      "webkitbeginfullscreen",
      syncFullscreenState as EventListener,
    );
    element?.addEventListener(
      "webkitendfullscreen",
      syncFullscreenState as EventListener,
    );
    syncFullscreenState();

    return () => {
      document.removeEventListener("fullscreenchange", syncFullscreenState);
      document.removeEventListener(
        "webkitfullscreenchange",
        syncFullscreenState as EventListener,
      );
      element?.removeEventListener(
        "webkitbeginfullscreen",
        syncFullscreenState as EventListener,
      );
      element?.removeEventListener(
        "webkitendfullscreen",
        syncFullscreenState as EventListener,
      );
    };
  }, [videoRef]);

  const togglePlay = async () => {
    const element = videoRef.current;
    if (!element) return;
    if (element.paused) {
      await element.play();
    } else {
      element.pause();
    }
  };

  const skip = (seconds: number) => {
    const element = videoRef.current;
    if (!element) return;
    const next = Math.max(0, Math.min(element.duration || 0, element.currentTime + seconds));
    element.currentTime = next;
  };

  const seek = (value: number) => {
    const element = videoRef.current;
    if (!element) return;
    element.currentTime = value;
    setCurrentTime(value);
  };

  const toggleMute = () => {
    const element = videoRef.current;
    if (!element) return;
    element.muted = !element.muted;
  };

  const setSpeed = (rate: number) => {
    const element = videoRef.current;
    if (!element) return;
    element.playbackRate = rate;
    setPlaybackRate(rate);
    setSettingsOpen(false);
  };

  const toggleFullscreen = async () => {
    const shell = shellRef.current as FullscreenElement | null;
    const element = videoRef.current as FullscreenVideoElement | null;
    if (!shell || !element) return;

    const fullscreenDocument = document as FullscreenDocument;
    const wrapperFullscreen =
      document.fullscreenElement === shell
      || fullscreenDocument.webkitFullscreenElement === shell;

    if (wrapperFullscreen) {
      if (typeof document.exitFullscreen === "function") {
        await document.exitFullscreen();
      } else if (typeof fullscreenDocument.webkitExitFullscreen === "function") {
        await Promise.resolve(fullscreenDocument.webkitExitFullscreen());
      }
      return;
    }

    if (element.webkitDisplayingFullscreen) {
      element.webkitExitFullscreen?.();
      return;
    }

    const canUseWrapperFullscreen =
      document.fullscreenEnabled
      && typeof shell.requestFullscreen === "function";

    if (canUseWrapperFullscreen) {
      try {
        await shell.requestFullscreen();
        return;
      } catch {
        // Fall through to WebKit-native video fullscreen.
      }
    }

    if (
      !document.fullscreenEnabled
      && element.webkitSupportsFullscreen !== false
      && typeof element.webkitEnterFullscreen === "function"
    ) {
      element.webkitEnterFullscreen();
      return;
    }

    if (typeof shell.webkitRequestFullscreen === "function") {
      try {
        await Promise.resolve(shell.webkitRequestFullscreen());
        return;
      } catch {
        // Fall through to WebKit-native video fullscreen.
      }
    }

    if (
      element.webkitSupportsFullscreen !== false
      && typeof element.webkitEnterFullscreen === "function"
    ) {
      element.webkitEnterFullscreen();
    }
  };

  const handleKeyboard = (event: KeyboardEvent<HTMLDivElement>) => {
    if (source.kind !== "native") return;
    if (event.key === " " || event.key.toLowerCase() === "k") {
      event.preventDefault();
      void togglePlay();
    } else if (event.key === "ArrowLeft") {
      event.preventDefault();
      skip(-10);
    } else if (event.key === "ArrowRight") {
      event.preventDefault();
      skip(10);
    } else if (event.key.toLowerCase() === "m") {
      event.preventDefault();
      toggleMute();
    } else if (event.key.toLowerCase() === "c" && captions.length) {
      event.preventDefault();
      setSettingsOpen((open) => !open);
    } else if (event.key === "Escape" && settingsOpen) {
      setSettingsOpen(false);
    }
    revealControls();
  };

  if (source.kind === "provider") {
    const embedUrl = providerEmbedUrl(source);
    return (
      <div
        ref={shellRef}
        className={joinClasses(
          "relative h-full w-full overflow-hidden bg-black",
          className,
        )}
        data-wk-video-source-id={source.sourceId || undefined}
        data-wk-video-provider={source.providerKey}
      >
        {embedUrl ? (
          <iframe
            src={embedUrl}
            title={title}
            className="absolute inset-0 h-full w-full border-0"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            allowFullScreen
            referrerPolicy="strict-origin-when-cross-origin"
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center p-6 text-center text-sm text-white/70">
            This Video provider does not have an embeddable public player.
          </div>
        )}
        {collapsed ? (
          <div className="pointer-events-none absolute inset-x-0 top-0 flex items-center justify-between bg-gradient-to-b from-black/85 to-transparent p-2">
            <span className="truncate pr-3 text-[11px] font-bold text-white/90">
              {title}
            </span>
            <span className="pointer-events-auto flex gap-1">
              {onExpand ? (
                <button
                  type="button"
                  onClick={onExpand}
                  className="flex h-7 w-7 items-center justify-center rounded-full bg-black/55 text-white"
                  aria-label="Expand video"
                >
                  <i className="ri-fullscreen-line text-[13px]" />
                </button>
              ) : null}
              {onClose ? (
                <button
                  type="button"
                  onClick={onClose}
                  className="flex h-7 w-7 items-center justify-center rounded-full bg-black/55 text-white"
                  aria-label="Close video"
                >
                  <i className="ri-close-line text-[13px]" />
                </button>
              ) : null}
            </span>
          </div>
        ) : onCollapse ? (
          <button
            type="button"
            onClick={onCollapse}
            className="absolute right-3 top-3 z-10 flex h-9 w-9 items-center justify-center rounded-full bg-black/60 text-white backdrop-blur-sm"
            aria-label="Collapse video"
          >
            <i className="ri-contract-up-down-line text-[16px]" />
          </button>
        ) : null}
      </div>
    );
  }

  return (
    <div
      ref={shellRef}
      tabIndex={0}
      onKeyDown={handleKeyboard}
      onPointerMove={revealControls}
      onPointerDown={revealControls}
      onFocus={revealControls}
      className={joinClasses(
        "group relative h-full w-full overflow-hidden bg-black text-white outline-none",
        className,
      )}
      aria-label={`Video player for ${title}`}
      data-wk-video-delivery={deliveryMode}
    >
      <video
        ref={videoRef}
        crossOrigin="anonymous"
        playsInline
        preload="metadata"
        poster={source.poster || undefined}
        className="block max-h-[78svh] min-h-[220px] w-full bg-black object-contain sm:max-h-[76vh]"
        onClick={() => {
          if (!controlsVisible && playing) {
            revealControls();
            return;
          }
          void togglePlay();
        }}
        onLoadedMetadata={(event) => {
          setDuration(event.currentTarget.duration || 0);
          setMuted(event.currentTarget.muted);
          setPlaybackRate(event.currentTarget.playbackRate);
          syncCaptionTracks();
        }}
        onDurationChange={(event) => setDuration(event.currentTarget.duration || 0)}
        onTimeUpdate={(event) => setCurrentTime(event.currentTarget.currentTime)}
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onVolumeChange={(event) => setMuted(event.currentTarget.muted)}
        onRateChange={(event) => setPlaybackRate(event.currentTarget.playbackRate)}
      >
        {!source.adaptiveUrl ? (
          <source src={source.url} type={source.mimeType} />
        ) : null}
        {captions.map((caption) => (
          <track
            key={caption.trackNumber}
            kind={trackKind(caption.kind)}
            src={caption.src}
            srcLang={caption.languageTag}
            label={caption.label}
            onLoad={() => {
              syncCaptionTracks();
              revealControls();
            }}
          />
        ))}
        Your browser does not support HTML video.
      </video>

      {activeCueLines.length ? (
        <div
          className={joinClasses(
            "pointer-events-none absolute inset-x-0 z-20 flex justify-center px-5 transition-[bottom] duration-200",
            controlsVisible || settingsOpen || !playing
              ? "bottom-24 sm:bottom-28"
              : "bottom-6",
          )}
          data-wk-video-captions="active"
        >
          <div className="max-w-[88%] whitespace-pre-line rounded-lg bg-black/78 px-3 py-1.5 text-center text-[16px] font-semibold leading-snug text-white shadow-lg [text-shadow:0_1px_2px_rgba(0,0,0,0.95)] sm:max-w-[72%] sm:text-[18px]">
            {activeCueLines.join("\n")}
          </div>
        </div>
      ) : null}

      {!compact && onCollapse && (controlsVisible || settingsOpen || !playing) ? (
        <div className="pointer-events-none absolute inset-x-0 top-0 bg-gradient-to-b from-black/60 via-black/10 to-transparent p-3 sm:p-4">
          <button
            type="button"
            onClick={onCollapse}
            className="pointer-events-auto flex h-9 w-9 items-center justify-center rounded-full bg-black/45 text-white backdrop-blur-sm transition hover:bg-black/65"
            aria-label="Collapse video"
          >
            <i className="ri-contract-up-down-line text-[16px]" />
          </button>
        </div>
      ) : null}

      {!compact && settingsOpen ? (
        <div className="absolute bottom-16 right-3 z-30 w-[min(18rem,calc(100%-1.5rem))] overflow-hidden rounded-2xl border border-white/15 bg-[#171717]/98 shadow-2xl backdrop-blur-xl sm:right-4">
          <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
            <p className="text-[12px] font-black">Settings</p>
            <button
              type="button"
              onClick={() => setSettingsOpen(false)}
              className="flex h-7 w-7 items-center justify-center rounded-full text-white/75 transition hover:bg-white/10 hover:text-white"
              aria-label="Close video settings"
            >
              <i className="ri-close-line text-[15px]" />
            </button>
          </div>

          {captions.length ? (
            <div className="border-b border-white/10 px-4 py-3">
              <p className="mb-2 text-[10px] font-black uppercase tracking-[0.14em] text-white/45">
                Captions
              </p>
              <div className="space-y-1">
                <button
                  type="button"
                  onClick={() => {
                    setActiveCaptionTrack(null);
                    setSettingsOpen(false);
                  }}
                  className="flex w-full items-center justify-between rounded-lg px-2 py-2 text-left text-[12px] font-semibold transition hover:bg-white/5"
                >
                  <span>Off</span>
                  {activeCaptionTrack === null ? <i className="ri-check-line text-[var(--wk-brand)]" /> : null}
                </button>
                {captions.map((caption) => (
                  <button
                    key={caption.trackNumber}
                    type="button"
                    onClick={() => {
                      setActiveCaptionTrack(caption.trackNumber);
                      setSettingsOpen(false);
                    }}
                    className="flex w-full items-center justify-between rounded-lg px-2 py-2 text-left text-[12px] font-semibold transition hover:bg-white/5"
                  >
                    <span>
                      <span className="block">{caption.label}</span>
                      <span className="mt-0.5 block text-[10px] font-medium text-white/45">
                        {caption.languageTag}
                      </span>
                    </span>
                    {activeCaptionTrack === caption.trackNumber ? <i className="ri-check-line text-[var(--wk-brand)]" /> : null}
                  </button>
                ))}
              </div>
            </div>
          ) : null}

          <div className="px-4 py-3">
            <p className="mb-2 text-[10px] font-black uppercase tracking-[0.14em] text-white/45">
              Playback speed
            </p>
            <div className="grid grid-cols-5 gap-1">
              {[0.75, 1, 1.25, 1.5, 2].map((rate) => (
                <button
                  key={rate}
                  type="button"
                  onClick={() => setSpeed(rate)}
                  className={joinClasses(
                    "rounded-lg px-1.5 py-2 text-[11px] font-black transition",
                    playbackRate === rate
                      ? "bg-[var(--wk-brand)] text-[var(--wk-brand-on)]"
                      : "bg-white/5 text-white/75 hover:bg-white/10 hover:text-white",
                  )}
                  aria-label={`Set playback speed to ${rate}x`}
                >
                  {rate}x
                </button>
              ))}
            </div>
          </div>
        </div>
      ) : null}

      <div
        className={joinClasses(
          "pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 via-black/55 to-transparent px-3 pb-3 pt-16 transition-opacity duration-200 sm:px-4 sm:pb-4",
          controlsVisible || settingsOpen || !playing
            ? "opacity-100"
            : "opacity-0",
        )}
        aria-hidden={playing && !controlsVisible && !settingsOpen}
      >
        {!compact ? (
          <div className="pointer-events-auto mb-3">
            <input
              type="range"
              min={0}
              max={Math.max(duration, 0.01)}
              step={0.1}
              value={Math.min(currentTime, duration || 0)}
              onChange={(event) => seek(Number(event.target.value))}
              className="h-1.5 w-full cursor-pointer"
              style={{ accentColor: "var(--wk-brand)" }}
              aria-label="Video progress"
            />
            <div className="mt-1 flex justify-between text-[10px] font-semibold text-white/75">
              <span>{formatTime(currentTime)}</span>
              <span>{formatTime(duration)}</span>
            </div>
          </div>
        ) : null}

        <div className="pointer-events-auto flex items-center gap-1.5 sm:gap-2">
          <button
            type="button"
            onClick={() => void togglePlay()}
            className={joinClasses(
              "flex items-center justify-center rounded-full bg-white text-black transition hover:scale-105",
              compact ? "h-9 w-9" : "h-10 w-10 sm:h-11 sm:w-11",
            )}
            aria-label={playing ? "Pause video" : "Play video"}
          >
            <i className={playing ? "ri-pause-fill text-lg" : "ri-play-fill text-lg"} />
          </button>

          {!compact ? (
            <>
              <button
                type="button"
                onClick={() => skip(-10)}
                className="flex h-9 w-9 items-center justify-center rounded-full text-white transition hover:bg-white/10"
                aria-label="Rewind 10 seconds"
              >
                <i className="ri-replay-10-line text-[18px]" />
              </button>
              <button
                type="button"
                onClick={() => skip(10)}
                className="flex h-9 w-9 items-center justify-center rounded-full text-white transition hover:bg-white/10"
                aria-label="Forward 10 seconds"
              >
                <i className="ri-forward-10-line text-[18px]" />
              </button>
            </>
          ) : null}

          <span className="ml-auto flex items-center gap-1 sm:gap-2">
            {!compact ? (
              <button
                type="button"
                onClick={() => setSettingsOpen((open) => !open)}
                className={joinClasses(
                  "flex h-9 w-9 items-center justify-center rounded-full text-white transition hover:bg-white/10",
                  settingsOpen && "bg-white/10",
                )}
                aria-label="Video settings"
                aria-expanded={settingsOpen}
              >
                <i className="ri-settings-3-line text-[18px]" />
              </button>
            ) : null}
            <button
              type="button"
              onClick={toggleMute}
              className="flex h-9 w-9 items-center justify-center rounded-full text-white transition hover:bg-white/10"
              aria-label={muted ? "Unmute video" : "Mute video"}
            >
              <i className={muted ? "ri-volume-mute-line text-[18px]" : "ri-volume-up-line text-[18px]"} />
            </button>

            {collapsed ? (
              <>
                {onExpand ? (
                  <button
                    type="button"
                    onClick={onExpand}
                    className="flex h-9 w-9 items-center justify-center rounded-full text-white transition hover:bg-white/10"
                    aria-label="Expand video"
                  >
                    <i className="ri-fullscreen-line text-[18px]" />
                  </button>
                ) : null}
                {onClose ? (
                  <button
                    type="button"
                    onClick={onClose}
                    className="flex h-9 w-9 items-center justify-center rounded-full text-white transition hover:bg-white/10"
                    aria-label="Close video"
                  >
                    <i className="ri-close-line text-[18px]" />
                  </button>
                ) : null}
              </>
            ) : (
              <button
                type="button"
                onClick={() => void toggleFullscreen()}
                className="flex h-9 w-9 items-center justify-center rounded-full text-white transition hover:bg-white/10"
                aria-label={fullscreen ? "Exit fullscreen" : "Enter fullscreen"}
              >
                <i className={fullscreen ? "ri-fullscreen-exit-line text-[18px]" : "ri-fullscreen-line text-[18px]"} />
              </button>
            )}
          </span>
        </div>
      </div>
    </div>
  );
}
