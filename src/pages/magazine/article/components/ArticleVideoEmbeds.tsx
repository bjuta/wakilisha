import { type ContentSegment } from "./ArticleEmbedUtils";
import { ReleaseEmbedCard } from "./ArticleReleaseEmbeds";
import { ArtistEmbedCard } from "./ArticleArtistEmbeds";
import { TrackEmbedCard } from "./ArticleTrackEmbeds";
import { trackEvent } from "@/services/analytics";
import {
  VideoCard,
  VideoOverlay,
  useVideoPlayer,
  transformArticleHtmlForVideoEmbeds,
  type VideoEmbedData,
  type VideoPlayEvent,
} from "@/components/video";

export type { VideoEmbedData } from "@/components/video";
export { transformArticleHtmlForVideoEmbeds } from "@/components/video";

export function ArticleContentRenderer({
  segments,
  videos,
  releases,
  artists,
  tracks,
  proseClass = "article-content-v2",
  articleSlug,
}: {
  segments: ContentSegment[];
  videos: VideoEmbedData[];
  releases: import("./ArticleReleaseEmbeds").ReleaseEmbedData[];
  artists?: import("./ArticleArtistEmbeds").ArtistEmbedData[];
  tracks?: import("./ArticleTrackEmbeds").TrackEmbedData[];
  proseClass?: string;
  articleSlug?: string;
}) {
  const handleVideoEvent = (ev: VideoPlayEvent) => {
    trackEvent("video_play", {
      pageType: "article",
      entitySlug: articleSlug,
      entityType: "article",
      context: {
        action: ev.action,
        video_source_id: ev.videoSourceId,
        provider_key: ev.providerKey,
        provider_object_id: ev.providerObjectId,
        canonical_url: ev.canonicalUrl,
        platform: ev.platform,
        video_title: ev.videoTitle,
        video_index: ev.index,
        total_videos: videos.length,
        opened_at: ev.openedAt,
        source_section: "article_body",
      },
    });
  };

  const {
    activeIndex,
    mode,
    handlePlay,
    handleNavigate,
    handleChangeMode,
  } = useVideoPlayer(videos, handleVideoEvent);

  if (segments.length === 0 && videos.length === 0 && releases.length === 0 && (artists?.length ?? 0) === 0 && (tracks?.length ?? 0) === 0) return null;

  return (
    <>
      {segments.map((seg, i) => {
        if (seg.type === "html") {
          return (
            <div className={proseClass} key={`seg-${i}`}>
              <div dangerouslySetInnerHTML={{ __html: seg.html }} />
            </div>
          );
        }
        if (seg.type === "video") {
          const videoIdx = videos.indexOf(seg.data);
          return (
            <div key={`seg-${i}`} className="article-embed-spacing">
              <VideoCard
                video={seg.data}
                index={videoIdx}
                total={videos.length}
                onPlay={handlePlay}
              />
            </div>
          );
        }
        if (seg.type === "release") {
          return (
            <div key={`seg-${i}`} className="article-embed-spacing">
              <ReleaseEmbedCard release={seg.data} articleSlug={articleSlug} />
            </div>
          );
        }
        if (seg.type === "artist") {
          return (
            <div key={`seg-${i}`} className="article-embed-spacing">
              <ArtistEmbedCard artist={seg.data} />
            </div>
          );
        }
        if (seg.type === "track") {
          return (
            <div key={`seg-${i}`} className="article-embed-spacing">
              <TrackEmbedCard track={seg.data} articleSlug={articleSlug} />
            </div>
          );
        }
        return null;
      })}
      {activeIndex !== null && videos[activeIndex] && (
        <VideoOverlay
          video={videos[activeIndex]}
          videos={videos}
          mode={mode}
          onChangeMode={handleChangeMode}
          onNavigate={handleNavigate}
        />
      )}
    </>
  );
}