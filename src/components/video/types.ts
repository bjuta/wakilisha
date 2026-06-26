export interface VideoEmbedData {
  url: string;
  title: string;
  platform: string;
  thumbnail: string | null;
}

export type VideoMode = "lightbox" | "pip" | "closed";

export function getYouTubeId(url: string): string | null {
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/,
  ];
  for (const p of patterns) {
    const m = url.match(p);
    if (m) return m[1];
  }
  return null;
}

export function getVimeoId(url: string): string | null {
  const m = url.match(/vimeo\.com\/(\d+)/);
  return m ? m[1] : null;
}

export function detectPlatform(url: string): string {
  if (getYouTubeId(url)) return "YouTube";
  if (getVimeoId(url)) return "Vimeo";
  return "Video";
}

export function getThumbnail(_url: string): string | null {
  // Avoid noisy 404s from old/private/deleted YouTube thumbnails.
  // VideoCard already renders a branded platform fallback when no thumbnail is present.
  return null;
}

export function platformIcon(platform: string): string {
  switch (platform) {
    case "YouTube": return "ri-youtube-fill";
    case "Vimeo": return "ri-vimeo-fill";
    default: return "ri-film-line";
  }
}

export const VIDEO_MARKER_PREFIX = "WK_VIDEO_";

/**
 * Transforms article HTML by replacing iframe embeds with comment markers
 * and extracting video metadata. Returns the marked HTML and a list of videos.
 */
export function transformArticleHtmlForVideoEmbeds(html: string): {
  markedHtml: string;
  videos: VideoEmbedData[];
} {
  if (!html) return { markedHtml: "", videos: [] };

  const parser = new DOMParser();
  const doc = parser.parseFromString(html, "text/html");
  const iframes = doc.querySelectorAll("iframe");
  const videos: VideoEmbedData[] = [];

  iframes.forEach((iframe, idx) => {
    const src = iframe.getAttribute("src") || "";
    if (!src) return;

    const title = iframe.getAttribute("title") || `${detectPlatform(src)} video`;
    const platform = detectPlatform(src);
    const thumbnail = getThumbnail(src);

    const marker = doc.createComment(`${VIDEO_MARKER_PREFIX}${idx}`);

    const parent = iframe.parentElement;
    if (
      parent &&
      parent.tagName === "P" &&
      parent.childNodes.length === 1 &&
      (parent.textContent ?? "").trim() === ""
    ) {
      parent.replaceWith(marker);
    } else {
      iframe.replaceWith(marker);
    }

    videos.push({ url: src, title, platform, thumbnail });
  });

  return { markedHtml: doc.body.innerHTML, videos };
}