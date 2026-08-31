import {
  parseLegacyProviderUrl,
  providerLabel,
  providerSourceKey,
  type CanonicalVideoProviderSource,
} from "./providerSource";

export interface VideoEmbedData extends CanonicalVideoProviderSource {
  sourceId: string | null;
  canonicalUrl: string | null;
  title: string;
  platform: string;
  thumbnail: string | null;
}

export type VideoMode = "lightbox" | "pip" | "closed";

export function getYouTubeId(url: string): string | null {
  const source = parseLegacyProviderUrl(url);
  return source?.providerKey === "youtube"
    ? source.providerObjectId
    : null;
}

export function getVimeoId(url: string): string | null {
  const source = parseLegacyProviderUrl(url);
  return source?.providerKey === "vimeo"
    ? source.providerObjectId
    : null;
}

export function detectPlatform(url: string): string {
  const source = parseLegacyProviderUrl(url);
  return source ? providerLabel(source.providerKey) : "Video";
}

export function getThumbnail(_url: string): string | null {
  // Avoid noisy 404s from old, private, or deleted provider thumbnails.
  // Provider-backed surfaces may supply a known thumbnail explicitly.
  return null;
}

export function platformIcon(platform: string): string {
  switch (platform) {
    case "YouTube":
      return "ri-youtube-fill";
    case "Vimeo":
      return "ri-vimeo-fill";
    default:
      return "ri-film-line";
  }
}

export const VIDEO_MARKER_PREFIX = "WK_VIDEO_";

/**
 * Preserves legacy Article HTML as historical content while resolving supported
 * provider iframes into canonical Video source identity for presentation.
 */
export function transformArticleHtmlForVideoEmbeds(
  html: string,
  canonicalSources: CanonicalVideoProviderSource[] = [],
): {
  markedHtml: string;
  videos: VideoEmbedData[];
} {
  if (!html) return { markedHtml: "", videos: [] };

  const sourceByKey = new Map(
    canonicalSources.map((source) => [providerSourceKey(source), source]),
  );
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, "text/html");
  const iframes = doc.querySelectorAll("iframe");
  const videos: VideoEmbedData[] = [];

  iframes.forEach((iframe) => {
    const src = iframe.getAttribute("src") || "";
    const legacySource = parseLegacyProviderUrl(src);
    if (!legacySource) return;

    const resolvedSource =
      sourceByKey.get(providerSourceKey(legacySource)) ?? legacySource;
    const title =
      iframe.getAttribute("title") ||
      `${providerLabel(resolvedSource.providerKey)} video`;
    const markerIndex = videos.length;
    const marker = doc.createComment(
      `${VIDEO_MARKER_PREFIX}${markerIndex}`,
    );

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

    videos.push({
      sourceId: resolvedSource.sourceId ?? null,
      providerKey: resolvedSource.providerKey,
      providerObjectId: resolvedSource.providerObjectId,
      canonicalUrl: resolvedSource.canonicalUrl ?? null,
      title,
      platform: providerLabel(resolvedSource.providerKey),
      thumbnail: getThumbnail(src),
    });
  });

  return { markedHtml: doc.body.innerHTML, videos };
}
