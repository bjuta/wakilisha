import { deepDecode } from "@/utils/decodeHtmlEntities";
import type {
  PublicGenreDetail,
  PublicLabelDetail,
  PublicTrackDetail,
} from "./types";

export const PUBLIC_API_BASE =
  import.meta.env.VITE_PUBLIC_API_BASE || "/api/v1";

export class PublicApiError extends Error {
  status: number;
  retryable: boolean;

  constructor(message: string, status = 500, retryable = false) {
    super(message);
    this.name = "PublicApiError";
    this.status = status;
    this.retryable = retryable;
  }
}

async function fetchPublic<T>(path: string): Promise<T> {
  const base = PUBLIC_API_BASE.replace(/\/$/, "");
  const target = `${base}${path.startsWith("/") ? path : `/${path}`}`;
  const response = await fetch(target, {
    headers: { Accept: "application/json" },
  });

  if (!response.ok) {
    throw new PublicApiError(
      `Public API request failed: ${response.status}`,
      response.status,
      response.status >= 500
    );
  }

  const payload = (await response.json()) as { data?: T };
  if (!payload || !("data" in payload)) {
    throw new PublicApiError(
      "Public API returned an invalid payload.",
      502,
      true
    );
  }

  return deepDecode(payload.data as T);
}

export function getGenre(
  slug: string
): Promise<PublicGenreDetail | null> {
  return fetchPublic<PublicGenreDetail | null>(
    `/genres/${encodeURIComponent(slug)}`
  );
}

export function getLabel(
  slug: string
): Promise<PublicLabelDetail | null> {
  return fetchPublic<PublicLabelDetail | null>(
    `/labels/${encodeURIComponent(slug)}`
  );
}

export function getTrack(
  artistSlug: string,
  trackSlug: string
): Promise<PublicTrackDetail | null> {
  return fetchPublic<PublicTrackDetail | null>(
    `/tracks/${encodeURIComponent(artistSlug)}/${encodeURIComponent(trackSlug)}`
  );
}