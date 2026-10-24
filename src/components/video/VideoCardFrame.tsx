import { useEffect, useState } from "react";

interface VideoCardFrameProps {
  title: string;
  thumbnail?: string | null;
  thumbnailFallbacks?: string[];
  badge?: string | null;
  counter?: string | null;
  duration?: string | null;
  compact?: boolean;
  className?: string;
}

export function VideoCardFrame({
  title,
  thumbnail,
  thumbnailFallbacks,
  badge,
  counter,
  duration,
  compact = false,
  className = "",
}: VideoCardFrameProps) {
  const [imgLoaded, setImgLoaded] = useState(false);
  const [imgError, setImgError] = useState(false);
  const [thumbnailIndex, setThumbnailIndex] = useState(0);
  const fallbackKey = thumbnailFallbacks?.join("|") ?? "";

  useEffect(() => {
    setImgLoaded(false);
    setImgError(false);
    setThumbnailIndex(0);
  }, [thumbnail, fallbackKey]);

  const thumbnailSources = thumbnail
    ? [thumbnail, ...(thumbnailFallbacks ?? [])]
    : [];
  const currentThumbnail = thumbnailSources[thumbnailIndex] ?? null;

  const advanceThumbnail = () => {
    setImgLoaded(false);
    if (thumbnailIndex + 1 < thumbnailSources.length) {
      setThumbnailIndex(thumbnailIndex + 1);
    } else {
      setImgError(true);
    }
  };

  return (
    <div
      className={
        compact
          ? `flex min-w-0 items-center gap-3 ${className}`
          : `overflow-hidden rounded-2xl border border-[var(--wk-border)] bg-[var(--wk-surface)] transition-all duration-300 group-hover:border-[var(--wk-border-strong)] ${className}`
      }
    >
      <div
        className={
          compact
            ? "relative aspect-video w-[132px] shrink-0 overflow-hidden rounded-xl bg-[var(--wk-surface-raised)] sm:w-[156px]"
            : "relative aspect-video w-full overflow-hidden bg-[var(--wk-surface-raised)]"
        }
      >
        {currentThumbnail && !imgError ? (
          <>
            <img
              key={currentThumbnail}
              src={currentThumbnail}
              alt=""
              className={`h-full w-full object-cover transition-all duration-500 group-hover:scale-[1.035] ${imgLoaded ? "opacity-100" : "opacity-0"}`}
              loading="lazy"
              onLoad={(event) => {
                // A missing YouTube HD size can decode as a tiny valid JPEG.
                // Never stretch that placeholder into an article hero.
                if (thumbnailSources.length > 1 && event.currentTarget.naturalWidth <= 120) {
                  advanceThumbnail();
                } else {
                  setImgLoaded(true);
                }
              }}
              onError={advanceThumbnail}
            />
            {!imgLoaded ? (
              <div className="absolute inset-0 animate-pulse bg-[var(--wk-surface-raised)]" />
            ) : null}
          </>
        ) : (
          <div className="flex h-full w-full items-center justify-center">
            <i className="ri-film-line text-3xl text-[var(--wk-text-faint)]" />
          </div>
        )}

        <div className="absolute inset-0 bg-gradient-to-t from-black/55 via-black/5 to-transparent" />

        {badge ? (
          <span className="absolute left-2.5 top-2.5 rounded-md bg-black/65 px-2 py-1 text-[9px] font-black uppercase tracking-[0.12em] text-white/90 backdrop-blur-sm">
            {badge}
          </span>
        ) : null}

        <span className="absolute inset-0 flex items-center justify-center">
          <span className={`flex items-center justify-center rounded-full bg-[var(--wk-brand)] text-[var(--wk-brand-on)] shadow-lg transition-transform duration-200 group-hover:scale-105 ${compact ? "h-9 w-9" : "h-14 w-14 md:h-16 md:w-16"}`}>
            <i className={`ri-play-fill ${compact ? "text-lg" : "text-2xl md:text-[28px]"}`} />
          </span>
        </span>

        {duration ? (
          <span className="absolute bottom-2 right-2 rounded-md bg-black/70 px-1.5 py-0.5 text-[10px] font-bold text-white">
            {duration}
          </span>
        ) : counter ? (
          <span className="absolute bottom-2 right-2 rounded-md bg-black/70 px-1.5 py-0.5 text-[10px] font-bold text-white">
            {counter}
          </span>
        ) : null}
      </div>

      {compact ? (
        <div className="min-w-0 flex-1 py-1">
          <h3 className="line-clamp-2 text-[13px] font-black leading-snug text-[var(--wk-text)] transition-colors group-hover:text-[var(--wk-brand)] sm:text-[14px]">
            {title}
          </h3>
        </div>
      ) : (
        <div className="px-4 py-3.5 md:px-5 md:py-4">
          <h3 className="line-clamp-2 text-[14px] font-bold leading-snug text-[var(--wk-text)] transition-colors group-hover:text-[var(--wk-brand)] md:text-[15px]">
            {title}
          </h3>
        </div>
      )}
    </div>
  );
}
