import { Link } from "react-router-dom";
import { VideoCardFrame } from "./VideoCardFrame";
import type { PublicVideoPublication } from "@/services/video/videoPublicModel";

function formatDuration(seconds: number | null): string | null {
  if (!seconds || seconds <= 0) return null;
  const whole = Math.round(seconds);
  const minutes = Math.floor(whole / 60);
  const remaining = whole % 60;
  return `${minutes}:${String(remaining).padStart(2, "0")}`;
}

function label(publication: PublicVideoPublication): string {
  const classification = publication.classification.replace(/[_-]+/g, " ");
  return publication.episode?.episodeNumber
    ? `${classification} · Episode ${publication.episode.episodeNumber}`
    : classification;
}

export function PublicVideoCard({
  publication,
  compact = false,
  className = "",
}: {
  publication: PublicVideoPublication;
  compact?: boolean;
  className?: string;
}) {
  const duration = publication.delivery.kind === "native_media"
    ? formatDuration(publication.delivery.durationSeconds)
    : null;

  return (
    <Link
      to={publication.canonicalPath}
      className={`group block min-w-0 ${className}`}
      aria-label={`Watch ${publication.title}`}
    >
      <VideoCardFrame
        title={publication.title}
        thumbnail={publication.poster?.url}
        badge={label(publication)}
        duration={duration}
        compact={compact}
      />
      {compact ? (
        <div className="ml-[144px] -mt-8 hidden min-w-0 sm:ml-[168px]" />
      ) : null}
    </Link>
  );
}
