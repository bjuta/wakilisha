import {
  useEffect,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import { MediaPresentationSurface } from "@/components/design-system/media/MediaPresentationSurface";
import { VideoPlaybackCanvas } from "./VideoPlaybackCanvas";
import { platformIcon } from "./types";
import { providerSourceKey } from "./providerSource";
import type { VideoEmbedData, VideoMode } from "./types";

interface VideoOverlayProps {
  video: VideoEmbedData;
  videos: VideoEmbedData[];
  mode: VideoMode;
  onChangeMode: (m: VideoMode) => void;
  onNavigate: (dir: -1 | 1) => void;
}

export function VideoOverlay({
  video,
  videos,
  mode,
  onChangeMode,
  onNavigate,
}: VideoOverlayProps) {
  const [visible, setVisible] = useState(false);
  const [hovered, setHovered] = useState(false);
  const [animPhase, setAnimPhase] =
    useState<"entering" | "exiting" | "idle">("idle");
  const prevModeRef = useRef<VideoMode>(mode);
  const pipWidth = 320;
  const pipHeight = 180;

  useEffect(() => {
    const prev = prevModeRef.current;
    prevModeRef.current = mode;

    if (prev === "lightbox" && mode === "pip") {
      setAnimPhase("exiting");
      const timer = setTimeout(() => setAnimPhase("idle"), 550);
      return () => clearTimeout(timer);
    }

    if (prev === "pip" && mode === "lightbox") {
      setAnimPhase("entering");
      const timer = setTimeout(() => setAnimPhase("idle"), 550);
      return () => clearTimeout(timer);
    }
  }, [mode]);

  useEffect(() => {
    if (mode === "lightbox") {
      const timer = setTimeout(() => setVisible(true), 20);
      return () => clearTimeout(timer);
    }

    setVisible(false);
  }, [mode]);

  useEffect(() => {
    const handleKey = (event: KeyboardEvent) => {
      if (mode !== "lightbox") return;

      if (event.key === "ArrowLeft") {
        event.preventDefault();
        onNavigate(-1);
      }

      if (event.key === "ArrowRight") {
        event.preventDefault();
        onNavigate(1);
      }
    };

    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [mode, onNavigate]);

  const currentKey = providerSourceKey(video);
  const currentIndex = videos.findIndex(
    (candidate) => providerSourceKey(candidate) === currentKey,
  );
  const hasPrev = currentIndex > 0;
  const hasNext = currentIndex < videos.length - 1;

  if (mode === "closed") return null;

  const isLightbox = mode === "lightbox";
  const isPip = mode === "pip";

  const content = (
    <>
      {isLightbox ? (
        <div
          className={`fixed inset-0 z-[299] bg-black/90 backdrop-blur-md transition-opacity duration-300 ${
            visible ? "opacity-100" : "opacity-0"
          }`}
          aria-hidden="true"
        />
      ) : null}

      <MediaPresentationSurface
        mode={isLightbox ? "modal" : "floating"}
        draggable={isPip}
        lockScroll={isLightbox}
        onEscape={isLightbox ? () => onChangeMode("pip") : undefined}
        className="fixed z-[300] transition-all duration-500 ease-[cubic-bezier(0.4,0,0.2,1)]"
        onClick={isLightbox ? () => onChangeMode("pip") : undefined}
        style={{
          ...(isLightbox
            ? {
                inset: 0,
              }
            : {
                right: 24,
                bottom: 24,
              }),
          width: isLightbox ? "100%" : pipWidth,
          height: isLightbox ? "100%" : pipHeight,
          ...(isPip
            ? {
                borderRadius: "16px",
                boxShadow: "0 25px 50px -12px rgba(0,0,0,0.5)",
                border: "1px solid var(--wk-border)",
                overflow: "hidden",
              }
            : {}),
        }}
        onMouseEnter={() => isPip && setHovered(true)}
        onMouseLeave={() => isPip && setHovered(false)}
      >
        {({ dragHandleProps, dragging }) => (
          <>
            {isLightbox ? (
              <>
                {hasPrev ? (
                  <button
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation();
                      onNavigate(-1);
                    }}
                    className={`absolute left-3 top-1/2 z-20 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-white/10 text-white transition-all hover:scale-105 hover:bg-white/20 md:left-6 md:h-12 md:w-12 pointer-events-auto ${
                      visible ? "opacity-100" : "opacity-0"
                    }`}
                    aria-label="Previous video"
                  >
                    <i className="ri-arrow-left-line text-xl" />
                  </button>
                ) : null}

                {hasNext ? (
                  <button
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation();
                      onNavigate(1);
                    }}
                    className={`absolute right-3 top-1/2 z-20 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-white/10 text-white transition-all hover:scale-105 hover:bg-white/20 md:right-6 md:h-12 md:w-12 pointer-events-auto ${
                      visible ? "opacity-100" : "opacity-0"
                    }`}
                    aria-label="Next video"
                  >
                    <i className="ri-arrow-right-line text-xl" />
                  </button>
                ) : null}
              </>
            ) : null}

            {isPip ? (
              <>
                <div
                  className="absolute inset-0 z-10 cursor-pointer"
                  onClick={() => onChangeMode("lightbox")}
                  aria-label="Expand video"
                />
                <div
                  {...dragHandleProps}
                  className="absolute left-0 right-0 top-0 z-20 flex h-8 items-center justify-between bg-gradient-to-b from-black/80 via-black/60 to-transparent px-2.5 transition-opacity duration-200"
                  style={{
                    ...dragHandleProps.style,
                    opacity: hovered ? 1 : 0.75,
                  }}
                >
                  <div className="flex items-center gap-1.5">
                    <i className="ri-draggable text-[13px] text-white/70" />
                    <span className="max-w-[140px] truncate text-[10px] font-semibold text-white/80">
                      {video.title}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onPointerDown={(event) => event.stopPropagation()}
                      onClick={(event) => {
                        event.stopPropagation();
                        onChangeMode("lightbox");
                      }}
                      className="flex h-6 w-6 items-center justify-center rounded-full bg-white/20 text-white transition-all hover:bg-white/40 active:scale-90"
                      aria-label="Expand video"
                    >
                      <i className="ri-fullscreen-line text-[11px]" />
                    </button>
                    <button
                      type="button"
                      onPointerDown={(event) => event.stopPropagation()}
                      onClick={(event) => {
                        event.stopPropagation();
                        onChangeMode("closed");
                      }}
                      className="flex h-6 w-6 items-center justify-center rounded-full bg-white/20 text-white transition-all hover:bg-white/40 active:scale-90"
                      aria-label="Close video"
                    >
                      <i className="ri-close-line text-[11px]" />
                    </button>
                  </div>
                </div>

                {!hovered && !dragging ? (
                  <div className="pointer-events-none absolute right-10 top-2 z-20 flex items-center gap-1">
                    <div className="flex h-5 w-5 animate-pulse items-center justify-center rounded-full bg-white/25">
                      <i className="ri-fullscreen-line text-[9px] text-white" />
                    </div>
                  </div>
                ) : null}
              </>
            ) : null}

            {isLightbox ? (
              <button
                type="button"
                onClick={(event) => {
                  event.stopPropagation();
                  onChangeMode("pip");
                }}
                className={`absolute right-4 top-4 z-20 flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white transition-all hover:scale-105 hover:bg-white/20 pointer-events-auto ${
                  visible ? "opacity-100" : "opacity-0"
                }`}
                aria-label="Collapse to picture-in-picture"
              >
                <i className="ri-arrow-down-s-line text-xl" />
              </button>
            ) : null}

            {isLightbox ? (
              <div className="absolute bottom-5 left-1/2 z-20 -translate-x-1/2 text-[13px] font-semibold text-white/50">
                {currentIndex + 1} / {videos.length}
              </div>
            ) : null}

            <div
              className="absolute inset-0 flex items-center justify-center"
              style={{ padding: isLightbox ? "0 80px" : 0 }}
            >
              <div
                className={
                  isLightbox
                    ? "w-full max-w-[1100px]"
                    : "h-full w-full"
                }
                onClick={(event) => event.stopPropagation()}
              >
                <div
                  className={`relative overflow-hidden bg-black transition-all duration-500 ${
                    isLightbox
                      ? "rounded-2xl border border-white/10 shadow-2xl"
                      : "h-full w-full"
                  }`}
                  style={{
                    ...(isLightbox && { aspectRatio: "16 / 9" }),
                    transform:
                      animPhase === "exiting"
                        ? "scale(0.97)"
                        : animPhase === "entering"
                          ? "scale(1.03)"
                          : "scale(1)",
                    transition:
                      "transform 500ms cubic-bezier(0.4, 0, 0.2, 1), border-radius 500ms cubic-bezier(0.4, 0, 0.2, 1), box-shadow 500ms cubic-bezier(0.4, 0, 0.2, 1)",
                  }}
                >
                  <VideoPlaybackCanvas
                    source={{
                      kind: "provider",
                      sourceId: video.sourceId,
                      providerKey: video.providerKey,
                      providerObjectId: video.providerObjectId,
                      canonicalUrl: video.canonicalUrl,
                    }}
                    title={video.title}
                    className="absolute inset-0"
                  />
                </div>

                {isLightbox ? (
                  <div
                    className={`flex items-center gap-3 px-5 py-4 transition-all duration-300 md:px-6 md:py-5 ${
                      visible
                        ? "translate-y-0 opacity-100"
                        : "translate-y-2 opacity-0"
                    }`}
                  >
                    <span className="inline-flex items-center gap-1.5 rounded-md bg-white/10 px-2 py-1 text-[11px] font-black uppercase tracking-wider text-white/80">
                      <i
                        className={`${platformIcon(video.platform)} text-[10px]`}
                      />
                      {video.platform}
                    </span>
                    <h3 className="text-[15px] font-bold leading-snug text-white md:text-[17px]">
                      {video.title}
                    </h3>
                  </div>
                ) : null}
              </div>
            </div>
          </>
        )}
      </MediaPresentationSurface>
    </>
  );

  return createPortal(content, document.body);
}
