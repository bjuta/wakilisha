import { useScrollReveal } from "@/hooks/useScrollReveal";
import type { PublicArtistVideo } from "@/services/publicContent/client";
import { trackEvent } from "@/services/analytics";
import {
  VideoCard,
  VideoOverlay,
  useVideoPlayer,
  detectPlatform,
  getThumbnail,
  type VideoEmbedData,
  type VideoPlayEvent,
} from "@/components/video";

interface ArtistVideosProps {
  videos: PublicArtistVideo[];
  artistSlug?: string;
}

function toVideoEmbedData(video: PublicArtistVideo): VideoEmbedData {
  return {
    url: video.url,
    title: video.title,
    platform: video.platform || detectPlatform(video.url),
    thumbnail: video.thumbnail || getThumbnail(video.url),
  };
}

export function ArtistVideos({ videos, artistSlug }: ArtistVideosProps) {
  const videoEmbeds = videos.map(toVideoEmbedData);

  const handleVideoEvent = (ev: VideoPlayEvent) => {
    trackEvent("video_play", {
      pageType: "artist_detail",
      entitySlug: artistSlug,
      recordType: "artist",
      context: {
        action: ev.action,
        video_url: ev.videoUrl,
        platform: ev.platform,
        video_title: ev.videoTitle,
        video_index: ev.index,
        total_videos: videos.length,
        opened_at: ev.openedAt,
        source_section: "artist_videos",
      },
    });
  };

  const {
    activeIndex,
    mode,
    handlePlay,
    handleNavigate,
    handleChangeMode,
  } = useVideoPlayer(videoEmbeds, handleVideoEvent);
  const { ref, revealed } = useScrollReveal<HTMLElement>(0.1);

  const activeVideo = activeIndex !== null ? videoEmbeds[activeIndex] : null;

  if (!videos || videos.length === 0) return null;

  return (
    <section
      ref={ref}
      className={`${revealed ? "is-visible" : ""} reveal-up`}
    >
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

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {videoEmbeds.map((video, idx) => (
          <VideoCard
            key={video.url}
            video={video}
            index={idx}
            total={videoEmbeds.length}
            onPlay={handlePlay}
            className=""
          />
        ))}
      </div>

      {activeVideo && (
        <VideoOverlay
          video={activeVideo}
          videos={videoEmbeds}
          mode={mode}
          onChangeMode={handleChangeMode}
          onNavigate={handleNavigate}
        />
      )}
    </section>
  );
}