import { useState } from "react";
import { platformIcon } from "./types";
import type { VideoEmbedData } from "./types";

interface VideoCardProps {
  video: VideoEmbedData;
  index: number;
  total: number;
  onPlay: (idx: number) => void;
  className?: string;
}

export function VideoCard({ video, index, total, onPlay, className = "my-8" }: VideoCardProps) {
  const [imgLoaded, setImgLoaded] = useState(false);
  const [imgError, setImgError] = useState(false);
  const [hovered, setHovered] = useState(false);

  return (
    <button
      onClick={() => onPlay(index)}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className={`group relative block w-full overflow-hidden rounded-2xl border border-[var(--wk-border)] bg-[var(--wk-surface)] text-left transition-all duration-300 hover:border-[var(--wk-border-strong)] ${className}`}
      aria-label={`Play video: ${video.title}`}
    >
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
            <i className={`${platformIcon(video.platform)} text-5xl text-[var(--wk-text-faint)]`} />
          </div>
        )}

        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/5 to-transparent" />
        <div className={`absolute inset-0 bg-black/20 transition-opacity duration-300 ${hovered ? "opacity-100" : "opacity-0"}`} />

        <div className="absolute top-3 left-3">
          <span className="inline-flex items-center gap-1 rounded-md bg-black/60 px-2 py-1 text-[10px] font-black uppercase tracking-wider text-white backdrop-blur-sm">
            <i className={`${platformIcon(video.platform)} text-[9px]`} />
            {video.platform}
          </span>
        </div>

        <div className="absolute inset-0 flex items-center justify-center">
          <div
            className={`flex h-14 w-14 items-center justify-center rounded-full bg-[var(--wk-brand)] text-[var(--wk-brand-on)] transition-all duration-300 md:h-16 md:w-16 ${hovered ? "scale-100 opacity-100" : "scale-75 opacity-0"}`}
            style={{ transitionTimingFunction: "var(--wk-ease-snap)" }}
          >
            <i className="ri-play-fill text-2xl md:text-[28px]" />
          </div>
        </div>

        {total > 1 && (
          <div className="absolute bottom-3 right-3">
            <span className="inline-flex items-center rounded-md bg-black/60 px-2 py-1 text-[11px] font-bold text-white backdrop-blur-sm">
              {index + 1} / {total}
            </span>
          </div>
        )}
      </div>

      <div className="px-4 py-3.5 md:px-5 md:py-4">
        <h4 className="text-[14px] font-bold leading-snug text-[var(--wk-text)] line-clamp-2 transition-colors duration-200 group-hover:text-[var(--wk-brand)] md:text-[15px]">
          {video.title}
        </h4>
      </div>
    </button>
  );
}