import {
  type RefObject,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

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
      poster?: string | null;
      captions?: VideoPlaybackCaption[];
    }
  | {
      kind: "provider";
      embedUrl: string;
      providerKey?: string | null;
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
  const [captionMenuOpen, setCaptionMenuOpen] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [fullscreen, setFullscreen] = useState(false);

  const syncCaptionTracks = useCallback(() => {
    const element = videoRef.current;
    if (!element) return;
    for (let index = 0; index < element.textTracks.length; index += 1) {
      const textTrack = element.textTracks[index];
      const caption = captions[index];
      textTrack.mode =
        caption && caption.trackNumber === activeCaptionTrack
          ? "showing"
          : "disabled";
    }
  }, [activeCaptionTrack, captions, videoRef]);

  useEffect(() => {
    syncCaptionTracks();
  }, [syncCaptionTracks]);

  useEffect(() => {
    const onFullscreenChange = () => {
      setFullscreen(document.fullscreenElement === shellRef.current);
    };
    document.addEventListener("fullscreenchange", onFullscreenChange);
    return () => document.removeEventListener("fullscreenchange", onFullscreenChange);
  }, []);

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

  const cycleSpeed = () => {
    const element = videoRef.current;
    if (!element) return;
    const rates = [1, 1.25, 1.5, 2, 0.75];
    const index = rates.indexOf(element.playbackRate);
    const next = rates[(index + 1) % rates.length];
    element.playbackRate = next;
    setPlaybackRate(next);
  };

  const toggleFullscreen = async () => {
    const shell = shellRef.current;
    if (!shell) return;
    if (document.fullscreenElement) {
      await document.exitFullscreen();
      return;
    }
    await shell.requestFullscreen();
  };

  const handleKeyboard = (event: React.KeyboardEvent<HTMLDivElement>) => {
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
      setCaptionMenuOpen((open) => !open);
    }
  };

  if (source.kind === "provider") {
    return (
      <div
        ref={shellRef}
        className={joinClasses(
          "relative h-full w-full overflow-hidden bg-black",
          className,
        )}
      >
        <iframe
          src={source.embedUrl}
          title={title}
          className="absolute inset-0 h-full w-full border-0"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
          allowFullScreen
          referrerPolicy="strict-origin-when-cross-origin"
        />
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

  const selectedCaption = captions.find(
    (caption) => caption.trackNumber === activeCaptionTrack,
  );

  return (
    <div
      ref={shellRef}
      tabIndex={0}
      onKeyDown={handleKeyboard}
      className={joinClasses(
        "group relative h-full w-full overflow-hidden bg-black text-white outline-none",
        className,
      )}
      aria-label={`Video player for ${title}`}
    >
      <video
        ref={videoRef}
        playsInline
        preload="metadata"
        poster={source.poster || undefined}
        className="block max-h-[78svh] min-h-[220px] w-full bg-black object-contain sm:max-h-[76vh]"
        onClick={() => void togglePlay()}
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
        <source src={source.url} type={source.mimeType} />
        {captions.map((caption) => (
          <track
            key={caption.trackNumber}
            kind={trackKind(caption.kind)}
            src={caption.src}
            srcLang={caption.languageTag}
            label={caption.label}
            default={caption.isDefault}
          />
        ))}
        Your browser does not support HTML video.
      </video>

      {!compact ? (
        <div className="pointer-events-none absolute inset-x-0 top-0 flex items-start justify-between bg-gradient-to-b from-black/70 via-black/20 to-transparent p-3 sm:p-4">
          <div className="pointer-events-auto flex items-center gap-2">
            {onCollapse ? (
              <button
                type="button"
                onClick={onCollapse}
                className="flex h-9 w-9 items-center justify-center rounded-full bg-black/45 text-white backdrop-blur-sm transition hover:bg-black/65"
                aria-label="Collapse video"
              >
                <i className="ri-contract-up-down-line text-[16px]" />
              </button>
            ) : null}
          </div>

          {captions.length ? (
            <div className="pointer-events-auto relative">
              <button
                type="button"
                onClick={() => setCaptionMenuOpen((open) => !open)}
                className={joinClasses(
                  "inline-flex h-9 items-center gap-1.5 rounded-lg border px-2.5 text-[11px] font-black backdrop-blur-sm transition",
                  activeCaptionTrack !== null
                    ? "border-[var(--wk-brand)] bg-[var(--wk-brand)] text-[var(--wk-brand-on)]"
                    : "border-white/35 bg-black/45 text-white",
                )}
                aria-expanded={captionMenuOpen}
                aria-label="Captions"
              >
                <span className="rounded border border-current px-1 text-[9px] leading-4">CC</span>
                <span>{selectedCaption?.label || "Captions"}</span>
              </button>

              {captionMenuOpen ? (
                <div className="absolute right-0 top-11 z-30 w-56 overflow-hidden rounded-xl border border-white/15 bg-[#171717]/98 shadow-2xl">
                  <div className="border-b border-white/10 px-4 py-3">
                    <p className="text-[12px] font-black">Captions</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setActiveCaptionTrack(null);
                      setCaptionMenuOpen(false);
                    }}
                    className="flex w-full items-center justify-between px-4 py-3 text-left text-[12px] font-semibold transition hover:bg-white/5"
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
                        setCaptionMenuOpen(false);
                      }}
                      className="flex w-full items-center justify-between border-t border-white/10 px-4 py-3 text-left text-[12px] font-semibold transition hover:bg-white/5"
                    >
                      <span>
                        <span className="block">{caption.label}</span>
                        <span className="mt-0.5 block text-[10px] font-medium text-white/50">
                          {caption.languageTag}
                        </span>
                      </span>
                      {activeCaptionTrack === caption.trackNumber ? <i className="ri-check-line text-[var(--wk-brand)]" /> : null}
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
          ) : null}
        </div>
      ) : null}

      <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 via-black/55 to-transparent px-3 pb-3 pt-16 sm:px-4 sm:pb-4">
        {!compact ? (
          <div className="pointer-events-auto mb-3">
            <input
              type="range"
              min={0}
              max={Math.max(duration, 0.01)}
              step={0.1}
              value={Math.min(currentTime, duration || 0)}
              onChange={(event) => seek(Number(event.target.value))}
              className="h-1.5 w-full cursor-pointer accent-[var(--wk-brand)]"
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
                onClick={cycleSpeed}
                className="h-9 rounded-full px-2 text-[11px] font-black text-white transition hover:bg-white/10"
                aria-label="Change playback speed"
              >
                {playbackRate}x
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
