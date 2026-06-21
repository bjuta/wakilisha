import { useState, useCallback, useRef } from "react";
import type { VideoMode } from "./types";

export interface VideoPlayEvent {
  action: "open" | "close";
  videoUrl: string;
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

export function useVideoPlayer(
  videos?: { url: string; platform: string; title: string }[],
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
      const vid = videos?.[idx];
      if (vid && onPlayEvent) {
        onPlayEvent({
          action: "open",
          videoUrl: vid.url,
          platform: vid.platform,
          videoTitle: vid.title,
          index: idx,
          openedAt: now,
        });
      }
    },
    [videos, onPlayEvent],
  );

  const handleNavigate = useCallback(
    (dir: -1 | 1) => {
      setActiveIndex((prev) => {
        if (prev === null) return prev;
        const next = prev + dir;
        if (videos && (next < 0 || next >= videos.length)) return prev;
        // Fire close for current, open for next
        const currentVid = videos?.[prev];
        const nextVid = videos?.[next];
        if (currentVid && onPlayEvent) {
          onPlayEvent({
            action: "close",
            videoUrl: currentVid.url,
            platform: currentVid.platform,
            videoTitle: currentVid.title,
            index: prev,
            openedAt: openedAtRef.current ?? undefined,
          });
        }
        const now = Date.now();
        openedAtRef.current = now;
        if (nextVid && onPlayEvent && next >= 0) {
          onPlayEvent({
            action: "open",
            videoUrl: nextVid.url,
            platform: nextVid.platform,
            videoTitle: nextVid.title,
            index: next,
            openedAt: now,
          });
        }
        return next;
      });
    },
    [videos, onPlayEvent],
  );

  const handleChangeMode = useCallback(
    (m: VideoMode) => {
      if (m === "closed" && activeIndex !== null && onPlayEvent) {
        const vid = videos?.[activeIndex];
        if (vid) {
          onPlayEvent({
            action: "close",
            videoUrl: vid.url,
            platform: vid.platform,
            videoTitle: vid.title,
            index: activeIndex,
            openedAt: openedAtRef.current ?? undefined,
          });
        }
        openedAtRef.current = null;
      }
      setMode(m);
      if (m === "closed") {
        setActiveIndex(null);
      }
    },
    [activeIndex, videos, onPlayEvent],
  );

  const close = useCallback(() => {
    if (activeIndex !== null && onPlayEvent) {
      const vid = videos?.[activeIndex];
      if (vid) {
        onPlayEvent({
          action: "close",
          videoUrl: vid.url,
          platform: vid.platform,
          videoTitle: vid.title,
          index: activeIndex,
          openedAt: openedAtRef.current ?? undefined,
        });
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