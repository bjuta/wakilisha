import { useState, useEffect, useCallback, useRef } from "react";
import { createPortal } from "react-dom";
import { useScrollReveal } from "@/hooks/useScrollReveal";
import { useScrollLock } from "@/hooks/useScrollLock";
import type { RepairedArtistVideo } from "@/services/repairedContent/client";

interface ArtistVideosProps {
  videos: RepairedArtistVideo[];
}

/* ------------------------------------------------------------------ */
/*  Lightbox                                                          */
/* ------------------------------------------------------------------ */

function VideoLightbox({
  video,
  videos,
  onClose,
  onNavigate,
}: {
  video: RepairedArtistVideo;
  videos: RepairedArtistVideo[];
  onClose: () => void;
  onNavigate: (dir: -1 | 1) => void;
}) {
  useScrollLock(true);
  const [visible, setVisible] = useState(false);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    const t = setTimeout(() => setVisible(true), 16);
    return () => clearTimeout(t);
  }, []);

  const handleKey = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowLeft") onNavigate(-1);
      if (e.key === "ArrowRight") onNavigate(1);
    },
    [onClose, onNavigate]
  );

  useEffect(() => {
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [handleKey]);

  const currentIndex = videos.findIndex((v) => v.id === video.id);
  const hasPrev = currentIndex > 0;
  const hasNext = currentIndex < videos.length - 1;

  return createPortal(
    <div
      className={`fixed inset-0 z-[300] flex items-center justify-center transition-opacity duration-300 ${visible ? "opacity-100" : "opacity-0"}`}
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Video player"
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/90 backdrop-blur-md" />

      {/* Navigation — prev */}
      {hasPrev && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onNavigate(-1);
          }}
          className="absolute left-3 md:left-6 top-1/2 z-20 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-white/10 text-white transition-all hover:bg-white/20 hover:scale-105 md:h-12 md:w-12"
          aria-label="Previous video"
        >
          <i className="ri-arrow-left-line text-xl" />
        </button>
      )}

      {/* Navigation — next */}
      {hasNext && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onNavigate(1);
          }}
          className="absolute right-3 md:right-6 top-1/2 z-20 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-white/10 text-white transition-all hover:bg-white/20 hover:scale-105 md:h-12 md:w-12"
          aria-label="Next video"
        >
          <i className="ri-arrow-right-line text-xl" />
        </button>
      )}

      {/* Close */}
      <button
        onClick={onClose}
        className="absolute top-4 right-4 z-20 flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white transition-all hover:bg-white/20 hover:scale-105"
        aria-label="Close video"
      >
        <i className="ri-close-line text-xl" />
      </button>

      {/* Content */}
      <div
        className={`relative z-10 w-full max-w-[1100px] px-5 transition-all duration-300 ${visible ? "scale-100 translate-y-0" : "scale-[0.96] translate-y-2"}`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="overflow-hidden rounded-2xl border border-[var(--wk-border-strong)] bg-[var(--wk-surface-strong)] shadow-2xl">
          {/* Video player */}
          <div className="relative aspect-video w-full bg-black">
            <iframe
              ref={iframeRef}
              src={video.url}
              title={video.title}
              className="absolute inset-0 h-full w-full"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
              allowFullScreen
              referrerPolicy="strict-origin-when-cross-origin"
            />
          </div>

          {/* Title bar */}
          <div className="flex items-center gap-3 px-5 py-4 md:px-6 md:py-5">
            <span className="inline-flex items-center gap-1.5 rounded-md bg-[var(--wk-danger-soft)] px-2 py-1 text-[11px] font-black uppercase tracking-wider text-[var(--wk-danger)]">
              <i className="ri-youtube-fill text-[10px]" />
              YouTube
            </span>
            <h3 className="text-[15px] font-bold leading-snug text-[var(--wk-text)] md:text-[17px]">
              {video.title}
            </h3>
          </div>
        </div>

        {/* Counter */}
        <div className="mt-4 text-center text-[13px] font-semibold text-white/50">
          {currentIndex + 1} / {videos.length}
        </div>
      </div>
    </div>,
    document.body
  );
}

/* ------------------------------------------------------------------ */
/*  Video Card                                                        */
/* ------------------------------------------------------------------ */

function VideoCard({
  video,
  index,
  total,
  onPlay,
}: {
  video: RepairedArtistVideo;
  index: number;
  total: number;
  onPlay: (idx: number) => void;
}) {
  const [imgLoaded, setImgLoaded] = useState(false);
  const [imgError, setImgError] = useState(false);
  const [hovered, setHovered] = useState(false);

  return (
    <button
      onClick={() => onPlay(index)}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className="group relative block w-full overflow-hidden rounded-2xl border border-[var(--wk-border)] bg-[var(--wk-surface)] text-left transition-all duration-300 hover:border-[var(--wk-border-strong)]"
      aria-label={`Play video: ${video.title}`}
    >
      {/* Thumbnail */}
      <div className="relative aspect-video w-full overflow-hidden bg-[var(--wk-surface-raised)]">
        {video.thumbnail && !imgError ? (
          <>
            <img
              src={video.thumbnail}
              alt={video.title}
              className={`h-full w-full object-cover transition-all duration-700 ${hovered ? "scale-[1.06]" : "scale-100"} ${imgLoaded ? "opacity-100" : "opacity-0"}`}
              onLoad={() => setImgLoaded(true)}
              onError={() => setImgError(true)}
            />
            {!imgLoaded && (
              <div className="absolute inset-0 flex items-center justify-center">
                <i className="ri-film-line text-3xl text-[var(--wk-text-faint)]" />
              </div>
            )}
          </>
        ) : (
          <div className="flex h-full w-full items-center justify-center">
            <i className="ri-youtube-line text-5xl text-[var(--wk-text-faint)]" />
          </div>
        )}

        {/* Cinematic overlay — always visible at bottom, intensifies on hover */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/5 to-transparent" />
        <div
          className={`absolute inset-0 bg-black/20 transition-opacity duration-300 ${hovered ? "opacity-100" : "opacity-0"}`}
        />

        {/* Platform badge */}
        <div className="absolute top-3 left-3">
          <span className="inline-flex items-center gap-1 rounded-md bg-black/60 px-2 py-1 text-[10px] font-black uppercase tracking-wider text-white backdrop-blur-sm">
            <i className="ri-youtube-fill text-[9px]" />
            YouTube
          </span>
        </div>

        {/* Play button */}
        <div className="absolute inset-0 flex items-center justify-center">
          <div
            className={`flex h-14 w-14 items-center justify-center rounded-full bg-[var(--wk-brand)] text-[var(--wk-brand-on)] transition-all duration-300 md:h-16 md:w-16 ${hovered ? "scale-100 opacity-100" : "scale-75 opacity-0"}`}
            style={{ transitionTimingFunction: "var(--wk-ease-snap)" }}
          >
            <i className="ri-play-fill text-2xl md:text-[28px]" />
          </div>
        </div>

        {/* Video index / total */}
        <div className="absolute bottom-3 right-3">
          <span className="inline-flex items-center rounded-md bg-black/60 px-2 py-1 text-[11px] font-bold text-white backdrop-blur-sm">
            {index + 1} / {total}
          </span>
        </div>
      </div>

      {/* Title */}
      <div className="px-4 py-3.5 md:px-5 md:py-4">
        <h4 className="text-[14px] font-bold leading-snug text-[var(--wk-text)] line-clamp-2 transition-colors duration-200 group-hover:text-[var(--wk-brand)] md:text-[15px]">
          {video.title}
        </h4>
      </div>
    </button>
  );
}

/* ------------------------------------------------------------------ */
/*  Main Section                                                      */
/* ------------------------------------------------------------------ */

export function ArtistVideos({ videos }: ArtistVideosProps) {
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const { ref, revealed } = useScrollReveal<HTMLElement>(0.1);

  const activeVideo = activeIndex !== null && videos ? videos[activeIndex] : null;

  const navigate = useCallback(
    (dir: -1 | 1) => {
      if (activeIndex === null || !videos) return;
      const next = activeIndex + dir;
      if (next >= 0 && next < videos.length) {
        setActiveIndex(next);
      }
    },
    [activeIndex, videos]
  );

  if (!videos || videos.length === 0) return null;

  return (
    <section
      ref={ref}
      className={`${revealed ? "is-visible" : ""} reveal-up`}
    >
      {/* Header — matches Discography section quality */}
      <div className="mb-7 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between md:mb-8">
        <div>
          <div className="wk-eyebrow mb-2">Watch</div>
          <h2 className="text-[clamp(26px,3vw,40px)] font-black leading-[0.92] tracking-[-0.04em] text-[var(--wk-text)]">
            Videos
          </h2>
        </div>

        <span className="inline-flex items-center gap-2 rounded-full border border-[var(--wk-border)] bg-[var(--wk-surface)] px-4 py-2 text-[12px] font-bold text-[var(--wk-text-muted)]">
          <i className="ri-film-line text-[13px]" />
          {videos.length} {videos.length === 1 ? "video" : "videos"}
        </span>
      </div>

      {/* Video grid — 3 columns on desktop, 2 on tablet, 1 on mobile */}
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {videos.map((video, idx) => (
          <VideoCard
            key={video.id}
            video={video}
            index={idx}
            total={videos.length}
            onPlay={setActiveIndex}
          />
        ))}
      </div>

      {/* Lightbox */}
      {activeVideo && (
        <VideoLightbox
          video={activeVideo}
          videos={videos}
          onClose={() => setActiveIndex(null)}
          onNavigate={navigate}
        />
      )}
    </section>
  );
}