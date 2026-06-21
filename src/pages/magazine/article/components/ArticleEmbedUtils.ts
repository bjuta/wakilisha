import type { VideoEmbedData } from "@/components/video";
import type { ReleaseEmbedData } from "./ArticleReleaseEmbeds";
import type { ArtistEmbedData } from "./ArticleArtistEmbeds";
import type { TrackEmbedData } from "./ArticleTrackEmbeds";

/* ------------------------------------------------------------------ */
/*  Content Segment types                                              */
/* ------------------------------------------------------------------ */

export type ContentSegment =
  | { type: "html"; html: string }
  | { type: "video"; data: VideoEmbedData }
  | { type: "release"; data: ReleaseEmbedData }
  | { type: "artist"; data: ArtistEmbedData }
  | { type: "track"; data: TrackEmbedData };

/* ------------------------------------------------------------------ */
/*  Marker helpers                                                     */
/* ------------------------------------------------------------------ */

import { VIDEO_MARKER_PREFIX } from "@/components/video";
export const RELEASE_MARKER_PREFIX = "WK_RELEASE_";
export const ARTIST_MARKER_PREFIX = "WK_REGISTRY_ARTIST";
export const TRACK_MARKER_PREFIX = "WK_TRACK_";

/**
 * Splits marked HTML by video, release, artist, and track markers into ordered segments.
 */
export function buildContentSegments(
  markedHtml: string,
  videos: VideoEmbedData[],
  releases: ReleaseEmbedData[],
  artists: ArtistEmbedData[] = [],
  tracks: TrackEmbedData[] = [],
): ContentSegment[] {
  if (!markedHtml) return [];

  const markerPattern = new RegExp(
    `<!--(?:${VIDEO_MARKER_PREFIX}(\\d+)|${RELEASE_MARKER_PREFIX}(\\d+)|${ARTIST_MARKER_PREFIX}(\\d+)|${TRACK_MARKER_PREFIX}(\\d+))-->`,
    "g",
  );

  const segments: ContentSegment[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = markerPattern.exec(markedHtml)) !== null) {
    const before = markedHtml.slice(lastIndex, match.index);
    if (before) {
      segments.push({ type: "html", html: before });
    }

    if (match[1] !== undefined) {
      const idx = parseInt(match[1], 10);
      if (idx < videos.length) {
        segments.push({ type: "video", data: videos[idx] });
      }
    } else if (match[2] !== undefined) {
      const idx = parseInt(match[2], 10);
      if (idx < releases.length) {
        segments.push({ type: "release", data: releases[idx] });
      }
    } else if (match[3] !== undefined) {
      const idx = parseInt(match[3], 10);
      if (idx < artists.length) {
        segments.push({ type: "artist", data: artists[idx] });
      }
    } else if (match[4] !== undefined) {
      const idx = parseInt(match[4], 10);
      if (idx < tracks.length) {
        segments.push({ type: "track", data: tracks[idx] });
      }
    }

    lastIndex = markerPattern.lastIndex;
  }

  const trailing = markedHtml.slice(lastIndex);
  if (trailing) {
    segments.push({ type: "html", html: trailing });
  }

  return segments;
}