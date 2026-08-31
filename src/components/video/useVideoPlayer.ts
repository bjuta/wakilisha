import { useState, useCallback, useRef } from "react";
import type { VideoEmbedData, VideoMode } from "./types";

export interface VideoPlayEvent {
  action: "open" | "close";
  videoSourceId: string | null;
  providerKey: string;
  providerObjectId: string;
  canonicalUrl: string | null;
  platform: string;
  videoTitle: string;
  index: number;
  openedAt?: number;
}

export type VideoPlayEventHandler = (event: VideoPlayEvent) => void;

export interface VideoPlayerState {
  activeIndex: number | null;
  mode: VideoMode;
  handlePlay: (idx: number) => void;
  handleNavigate: (dir: -1 | 1) => void;
  handleChangeMode: (m: VideoMode) => void;
  close: () => void;
}

function buildPlayEvent(
  video: VideoEmbedData,
  action: VideoPlayEvent["action"],
  index: number,
  openedAt?: number,
): VideoPlayEvent {
  return {
    action,
    videoSourceId: video.sourceId,
    providerKey: video.providerKey,
    providerObjectId: video.providerObjectId,
    canonicalUrl: video.canonicalUrl,
    platform: video.platform,
    videoTitle: video.title,
    index,
    openedAt,
  };
}

export function useVideoPlayer(
  videos?: VideoEmbedData[],
  onPlayEvent?: VideoPlayEventHandler,
): VideoPlayerState {
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const [mode, setMode] = useState<VideoMode>("closed");
  const openedAtRef = useRef<number | null>(null);

  const handlePlay = useCallback(
    (idx: number) => {
      setActiveIndex(idx);
      setMode("lightbox");
      const now = Date.now();
      openedAtRef.current = now;
      const video = videos?.[idx];
      if (video && onPlayEvent) {
        onPlayEvent(buildPlayEvent(video, "open", idx, now));
      }
    },
    [videos, onPlayEvent],
  );

  const handleNavigate = useCallback(
    (dir: -1 | 1) => {
      setActiveIndex((previous) => {
        if (previous === null) return previous;
        const next = previous + dir;
        if (videos && (next < 0 || next >= videos.length)) return previous;

        const currentVideo = videos?.[previous];
        const nextVideo = videos?.[next];
        if (currentVideo && onPlayEvent) {
          onPlayEvent(
            buildPlayEvent(
              currentVideo,
              "close",
              previous,
              openedAtRef.current ?? undefined,
            ),
          );
        }

        const now = Date.now();
        openedAtRef.current = now;
        if (nextVideo && onPlayEvent && next >= 0) {
          onPlayEvent(buildPlayEvent(nextVideo, "open", next, now));
        }

        return next;
      });
    },
    [videos, onPlayEvent],
  );

  const handleChangeMode = useCallback(
    (nextMode: VideoMode) => {
      if (nextMode === "closed" && activeIndex !== null && onPlayEvent) {
        const video = videos?.[activeIndex];
        if (video) {
          onPlayEvent(
            buildPlayEvent(
              video,
              "close",
              activeIndex,
              openedAtRef.current ?? undefined,
            ),
          );
        }
        openedAtRef.current = null;
      }

      setMode(nextMode);
      if (nextMode === "closed") {
        setActiveIndex(null);
      }
    },
    [activeIndex, videos, onPlayEvent],
  );

  const close = useCallback(() => {
    if (activeIndex !== null && onPlayEvent) {
      const video = videos?.[activeIndex];
      if (video) {
        onPlayEvent(
          buildPlayEvent(
            video,
            "close",
            activeIndex,
            openedAtRef.current ?? undefined,
          ),
        );
      }
      openedAtRef.current = null;
    }

    setMode("closed");
    setActiveIndex(null);
  }, [activeIndex, videos, onPlayEvent]);

  return {
    activeIndex,
    mode,
    handlePlay,
    handleNavigate,
    handleChangeMode,
    close,
  };
}
