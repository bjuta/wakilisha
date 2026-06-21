export type { VideoEmbedData, VideoMode } from "./types";
export {
  getYouTubeId,
  getVimeoId,
  detectPlatform,
  getThumbnail,
  platformIcon,
  VIDEO_MARKER_PREFIX,
  transformArticleHtmlForVideoEmbeds,
} from "./types";
export { VideoCard } from "./VideoCard";
export { VideoOverlay } from "./VideoOverlay";
export { useVideoPlayer } from "./useVideoPlayer";
export type { VideoPlayerState, VideoPlayEvent, VideoPlayEventHandler } from "./useVideoPlayer";