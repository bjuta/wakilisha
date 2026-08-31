import { useScrollReveal } from "@/hooks/useScrollReveal";
import type { PublicArtistVideo } from "@/services/publicContent/client";
import { trackEvent } from "@/services/analytics";
import {
  VideoCard,
  VideoOverlay,
  useVideoPlayer,
  parseLegacyProviderUrl,
  providerLabel,
  providerSourceKey,
  type VideoEmbedData,
  type VideoPlayEvent,
} from "@/components/video";

interface ArtistVideosProps {
  videos: PublicArtistVideo[];
  artistSlug?: string;
}

function toVideoEmbedData(video: PublicArtistVideo): VideoEmbedData | null {
  const legacy = video.url ? parseLegacyProviderUrl(video.url) : null;
  const providerKey = video.providerKey || legacy?.providerKey || "";
  const providerObjectId =
    video.providerObjectId || legacy?.providerObjectId || "";

  if (!providerKey || !providerObjectId) return null;

  return {
    sourceId: video.sourceId || legacy?.sourceId || null,
    providerKey,
    providerObjectId,
    canonicalUrl: video.canonicalUrl || legacy?.canonicalUrl || null,
    title: video.title,
    platform: video.platform || providerLabel(providerKey),
    thumbnail: video.thumbnail || null,
  };
}

export function ArtistVideos({ videos, artistSlug }: ArtistVideosProps) {
  const videoEmbeds = videos
    .map(toVideoEmbedData)
    .filter((video): video is VideoEmbedData => video !== null);

  const handleVideoEvent = (event: VideoPlayEvent) => {
    trackEvent("video_play", {
      pageType: "artist_detail",
      entitySlug: artistSlug,
      entityType: "artist",
      context: {
        action: event.action,
        video_source_id: event.videoSourceId,
        provider_key: event.providerKey,
        provider_object_id: event.providerObjectId,
        canonical_url: event.canonicalUrl,
        platform: event.platform,
        video_title: event.videoTitle,
        video_index: event.index,
        total_videos: videoEmbeds.length,
        opened_at: event.openedAt,
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

  const activeVideo =
    activeIndex !== null ? videoEmbeds[activeIndex] : null;

  if (videoEmbeds.length === 0) return null;

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
          {videoEmbeds.length} {videoEmbeds.length === 1 ? "video" : "videos"}
        </span>
      </div>

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {videoEmbeds.map((video, index) => (
          <VideoCard
            key={video.sourceId || providerSourceKey(video)}
            video={video}
            index={index}
            total={videoEmbeds.length}
            onPlay={handlePlay}
            className=""
          />
        ))}
      </div>

      {activeVideo ? (
        <VideoOverlay
          video={activeVideo}
          videos={videoEmbeds}
          mode={mode}
          onChangeMode={handleChangeMode}
          onNavigate={handleNavigate}
        />
      ) : null}
    </section>
  );
}
