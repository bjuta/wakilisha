import { useState, useCallback, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { useScrollLock } from "@/hooks/useScrollLock";
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
  const [pipPos, setPipPos] = useState({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);
  const [hovered, setHovered] = useState(false);
  const [animPhase, setAnimPhase] = useState<"entering" | "exiting" | "idle">("idle");
  const prevModeRef = useRef<VideoMode>(mode);
  const overlayRef = useRef<HTMLDivElement>(null);
  const dragStateRef = useRef({ startX: 0, startY: 0, posX: 0, posY: 0, rafId: 0 });
  const pipWidth = 320;
  const pipHeight = 180;

  useScrollLock(mode === "lightbox");

  useEffect(() => {
    const prev = prevModeRef.current;
    prevModeRef.current = mode;

    if (prev === "lightbox" && mode === "pip") {
      setAnimPhase("exiting");
      const t = setTimeout(() => setAnimPhase("idle"), 550);
      return () => clearTimeout(t);
    }
    if (prev === "pip" && mode === "lightbox") {
      setAnimPhase("entering");
      const t = setTimeout(() => setAnimPhase("idle"), 550);
      return () => clearTimeout(t);
    }
  }, [mode]);

  useEffect(() => {
    if (mode === "lightbox") {
      const t = setTimeout(() => setVisible(true), 20);
      return () => clearTimeout(t);
    } else {
      setVisible(false);
    }
  }, [mode]);

  useEffect(() => {
    if (mode === "pip") {
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      setPipPos({
        x: vw - pipWidth - 24,
        y: vh - pipHeight - 24,
      });
    }
  }, [mode]);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (mode === "lightbox") {
        if (e.key === "Escape") {
          e.preventDefault();
          onChangeMode("pip");
        }
        if (e.key === "ArrowLeft") {
          e.preventDefault();
          onNavigate(-1);
        }
        if (e.key === "ArrowRight") {
          e.preventDefault();
          onNavigate(1);
        }
      }
    };
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [mode, onChangeMode, onNavigate]);

  useEffect(() => {
    const handleResize = () => {
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      setPipPos((prev) => ({
        x: Math.max(0, Math.min(prev.x, vw - pipWidth)),
        y: Math.max(0, Math.min(prev.y, vh - pipHeight)),
      }));
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const handleDragStart = useCallback(
    (e: React.MouseEvent | React.TouchEvent) => {
      if (mode !== "pip") return;
      e.preventDefault();
      const clientX = "touches" in e ? e.touches[0].clientX : e.clientX;
      const clientY = "touches" in e ? e.touches[0].clientY : e.clientY;
      const el = overlayRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      dragStateRef.current = {
        startX: clientX,
        startY: clientY,
        posX: rect.left,
        posY: rect.top,
        rafId: 0,
      };
      setDragging(true);
    },
    [mode]
  );

  useEffect(() => {
    if (!dragging) return;
    const el = overlayRef.current;
    if (!el) return;
    el.style.transition = "none";

    const onMove = (e: MouseEvent | TouchEvent) => {
      const clientX = "touches" in e ? e.touches[0].clientX : e.clientX;
      const clientY = "touches" in e ? e.touches[0].clientY : e.clientY;
      const ds = dragStateRef.current;
      if (ds.rafId) cancelAnimationFrame(ds.rafId);
      ds.rafId = requestAnimationFrame(() => {
        if (!el) return;
        const dx = clientX - ds.startX;
        const dy = clientY - ds.startY;
        let nx = ds.posX + dx;
        let ny = ds.posY + dy;
        const vw = window.innerWidth;
        const vh = window.innerHeight;
        nx = Math.min(Math.max(0, nx), vw - pipWidth);
        ny = Math.min(Math.max(0, ny), vh - pipHeight);
        el.style.left = `${nx}px`;
        el.style.top = `${ny}px`;
      });
    };

    const onEnd = () => {
      if (el) el.style.transition = "";
      if (el) {
        const rect = el.getBoundingClientRect();
        setPipPos({ x: rect.left, y: rect.top });
      }
      setDragging(false);
      if (dragStateRef.current.rafId) {
        cancelAnimationFrame(dragStateRef.current.rafId);
      }
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onEnd);
      document.removeEventListener("touchmove", onMove);
      document.removeEventListener("touchend", onEnd);
    };

    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onEnd);
    document.addEventListener("touchmove", onMove, { passive: false });
    document.addEventListener("touchend", onEnd);

    return () => {
      if (el) el.style.transition = "";
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onEnd);
      document.removeEventListener("touchmove", onMove);
      document.removeEventListener("touchend", onEnd);
      if (dragStateRef.current.rafId) {
        cancelAnimationFrame(dragStateRef.current.rafId);
      }
    };
  }, [dragging]);

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
      {isLightbox && (
        <div
          className={`fixed inset-0 z-[299] bg-black/90 backdrop-blur-md transition-opacity duration-300 ${visible ? "opacity-100" : "opacity-0"}`}
          aria-hidden="true"
        />
      )}

      <div
        ref={overlayRef}
        className="fixed z-[300] transition-all duration-500 ease-[cubic-bezier(0.4,0,0.2,1)]"
        onClick={isLightbox ? () => onChangeMode("pip") : undefined}
        style={{
          ...(isLightbox
            ? { top: 0, left: 0, right: 0, bottom: 0 }
            : dragging
              ? {}
              : { top: pipPos.y, left: pipPos.x }),
          width: isLightbox ? "100%" : pipWidth,
          height: isLightbox ? "100%" : pipHeight,
          ...(isPip && {
            borderRadius: "16px",
            boxShadow: "0 25px 50px -12px rgba(0,0,0,0.5)",
            border: "1px solid var(--wk-border)",
            overflow: "hidden",
          }),
        }}
        onMouseEnter={() => isPip && setHovered(true)}
        onMouseLeave={() => isPip && setHovered(false)}
      >
        {isLightbox && (
          <>
            {hasPrev && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onNavigate(-1);
                }}
                className={`absolute left-3 md:left-6 top-1/2 z-20 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-white/10 text-white transition-all hover:bg-white/20 hover:scale-105 md:h-12 md:w-12 pointer-events-auto ${visible ? "opacity-100" : "opacity-0"}`}
                aria-label="Previous video"
              >
                <i className="ri-arrow-left-line text-xl" />
              </button>
            )}
            {hasNext && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onNavigate(1);
                }}
                className={`absolute right-3 md:right-6 top-1/2 z-20 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-white/10 text-white transition-all hover:bg-white/20 hover:scale-105 md:h-12 md:w-12 pointer-events-auto ${visible ? "opacity-100" : "opacity-0"}`}
                aria-label="Next video"
              >
                <i className="ri-arrow-right-line text-xl" />
              </button>
            )}
          </>
        )}

        {isPip && (
          <>
            <div
              className="absolute inset-0 z-10 cursor-pointer"
              onClick={() => onChangeMode("lightbox")}
              aria-label="Expand video"
            />
            <div
              className="absolute top-0 left-0 right-0 z-20 h-8 flex items-center justify-between px-2.5 bg-gradient-to-b from-black/80 via-black/60 to-transparent transition-opacity duration-200"
              onMouseDown={handleDragStart}
              onTouchStart={handleDragStart}
              style={{ cursor: dragging ? "grabbing" : "grab", opacity: hovered ? 1 : 0.75 }}
            >
              <div className="flex items-center gap-1.5">
                <i className="ri-draggable text-white/70 text-[13px]" />
                <span className="text-[10px] font-semibold text-white/80 truncate max-w-[140px]">
                  {video.title}
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                <button
                  onMouseDown={(e) => e.stopPropagation()}
                  onTouchStart={(e) => e.stopPropagation()}
                  onClick={(e) => {
                    e.stopPropagation();
                    onChangeMode("lightbox");
                  }}
                  className="flex h-6 w-6 items-center justify-center rounded-full bg-white/20 text-white hover:bg-white/40 active:scale-90 transition-all"
                  aria-label="Expand to full screen"
                >
                  <i className="ri-fullscreen-line text-[11px]" />
                </button>
                <button
                  onMouseDown={(e) => e.stopPropagation()}
                  onTouchStart={(e) => e.stopPropagation()}
                  onClick={(e) => {
                    e.stopPropagation();
                    onChangeMode("closed");
                  }}
                  className="flex h-6 w-6 items-center justify-center rounded-full bg-white/20 text-white hover:bg-white/40 active:scale-90 transition-all"
                  aria-label="Close video"
                >
                  <i className="ri-close-line text-[11px]" />
                </button>
              </div>
            </div>
            {!hovered && (
              <div className="absolute top-2 right-10 z-20 flex items-center gap-1 pointer-events-none">
                <div className="flex h-5 w-5 items-center justify-center rounded-full bg-white/25 animate-pulse">
                  <i className="ri-fullscreen-line text-[9px] text-white" />
                </div>
              </div>
            )}
          </>
        )}

        {isLightbox && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onChangeMode("pip");
            }}
            className={`absolute top-4 right-4 z-20 flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white transition-all hover:bg-white/20 hover:scale-105 pointer-events-auto ${visible ? "opacity-100" : "opacity-0"}`}
            aria-label="Collapse to picture-in-picture"
          >
            <i className="ri-arrow-down-s-line text-xl" />
          </button>
        )}

        {isLightbox && (
          <div className="absolute bottom-5 left-1/2 -translate-x-1/2 z-20 text-[13px] font-semibold text-white/50">
            {currentIndex + 1} / {videos.length}
          </div>
        )}

        <div className="absolute inset-0 flex items-center justify-center"
          style={{ padding: isLightbox ? "0 80px" : 0 }}
        >
          <div className={isLightbox ? "w-full max-w-[1100px]" : "w-full h-full"}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              className={`relative overflow-hidden bg-black transition-all duration-500 ${isLightbox ? "rounded-2xl border border-white/10 shadow-2xl" : "w-full h-full"}`}
              style={{
                ...(isLightbox && { aspectRatio: "16 / 9" }),
                transform: animPhase === "exiting"
                  ? "scale(0.97)"
                  : animPhase === "entering"
                    ? "scale(1.03)"
                    : "scale(1)",
                transition: "transform 500ms cubic-bezier(0.4, 0, 0.2, 1), border-radius 500ms cubic-bezier(0.4, 0, 0.2, 1), box-shadow 500ms cubic-bezier(0.4, 0, 0.2, 1)",
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

            {isLightbox && (
              <div className={`flex items-center gap-3 px-5 py-4 md:px-6 md:py-5 transition-all duration-300 ${visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-2"}`}>
                <span className="inline-flex items-center gap-1.5 rounded-md bg-white/10 px-2 py-1 text-[11px] font-black uppercase tracking-wider text-white/80">
                  <i className={`${platformIcon(video.platform)} text-[10px]`} />
                  {video.platform}
                </span>
                <h3 className="text-[15px] font-bold leading-snug text-white md:text-[17px]">
                  {video.title}
                </h3>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );

  return createPortal(content, document.body);
}