export interface CanonicalVideoProviderSource {
  sourceId?: string | null;
  providerKey: string;
  providerObjectId: string;
  canonicalUrl?: string | null;
}

const YOUTUBE_ID = /^[A-Za-z0-9_-]{11}$/;
const VIMEO_ID = /^\d+$/;

function cleanProviderKey(value: string): string {
  return value.trim().toLowerCase();
}

export function providerLabel(providerKey: string): string {
  switch (cleanProviderKey(providerKey)) {
    case "youtube":
      return "YouTube";
    case "vimeo":
      return "Vimeo";
    default:
      return "Video";
  }
}

export function canonicalProviderUrl(
  providerKey: string,
  providerObjectId: string,
): string | null {
  const key = cleanProviderKey(providerKey);
  const id = providerObjectId.trim();

  if (key === "youtube" && YOUTUBE_ID.test(id)) {
    return `https://www.youtube.com/watch?v=${id}`;
  }

  if (key === "vimeo" && VIMEO_ID.test(id)) {
    return `https://vimeo.com/${id}`;
  }

  return null;
}

export function providerEmbedUrl(
  source: Pick<
    CanonicalVideoProviderSource,
    "providerKey" | "providerObjectId"
  >,
): string | null {
  const key = cleanProviderKey(source.providerKey);
  const id = source.providerObjectId.trim();

  if (key === "youtube" && YOUTUBE_ID.test(id)) {
    return `https://www.youtube.com/embed/${encodeURIComponent(id)}?rel=0&modestbranding=1`;
  }

  if (key === "vimeo" && VIMEO_ID.test(id)) {
    return `https://player.vimeo.com/video/${encodeURIComponent(id)}`;
  }

  return null;
}

export function providerThumbnailUrl(
  source: Pick<
    CanonicalVideoProviderSource,
    "providerKey" | "providerObjectId"
  >,
): string | null {
  const key = cleanProviderKey(source.providerKey);
  const id = source.providerObjectId.trim();

  if (key === "youtube" && YOUTUBE_ID.test(id)) {
    return `https://img.youtube.com/vi/${encodeURIComponent(id)}/mqdefault.jpg`;
  }

  return null;
}

export function parseLegacyProviderUrl(
  rawUrl: string,
): CanonicalVideoProviderSource | null {
  const url = rawUrl.trim();
  if (!url) return null;

  const youtubePatterns = [
    /(?:youtube\.com\/watch\?(?:[^#\s]*&)?v=)([A-Za-z0-9_-]{11})/i,
    /(?:youtube(?:-nocookie)?\.com\/embed\/)([A-Za-z0-9_-]{11})/i,
    /(?:youtube\.com\/shorts\/)([A-Za-z0-9_-]{11})/i,
    /(?:youtu\.be\/)([A-Za-z0-9_-]{11})/i,
  ];

  for (const pattern of youtubePatterns) {
    const match = url.match(pattern);
    if (match?.[1]) {
      const providerObjectId = match[1];
      return {
        sourceId: null,
        providerKey: "youtube",
        providerObjectId,
        canonicalUrl: canonicalProviderUrl("youtube", providerObjectId),
      };
    }
  }

  const vimeoMatch = url.match(
    /(?:player\.)?vimeo\.com\/(?:video\/)?(\d+)/i,
  );
  if (vimeoMatch?.[1]) {
    const providerObjectId = vimeoMatch[1];
    return {
      sourceId: null,
      providerKey: "vimeo",
      providerObjectId,
      canonicalUrl: canonicalProviderUrl("vimeo", providerObjectId),
    };
  }

  return null;
}

export function providerSourceKey(
  source: Pick<
    CanonicalVideoProviderSource,
    "providerKey" | "providerObjectId"
  >,
): string {
  return `${cleanProviderKey(source.providerKey)}:${source.providerObjectId.trim()}`;
}
