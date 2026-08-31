import { VideoCardFrame } from "./VideoCardFrame";
import type { VideoEmbedData } from "./types";

interface VideoCardProps {
  video: VideoEmbedData;
  index: number;
  total: number;
  onPlay: (idx: number) => void;
  className?: string;
}

export function VideoCard({
  video,
  index,
  total,
  onPlay,
  className = "my-8",
}: VideoCardProps) {
  return (
    <button
      type="button"
      onClick={() => onPlay(index)}
      className={`group block w-full text-left ${className}`}
      aria-label={`Play video: ${video.title}`}
    >
      <VideoCardFrame
        title={video.title}
        thumbnail={video.thumbnail}
        badge={video.platform}
        counter={total > 1 ? `${index + 1} / ${total}` : null}
      />
    </button>
  );
}
