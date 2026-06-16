import { deepDecode } from "@/utils/decodeHtmlEntities";
import type {
  RepairedGenreDetail,
  RepairedLabelDetail,
  RepairedTrackDetail,
} from "./types";

export const PUBLIC_API_BASE =
  import.meta.env.VITE_WAKILISHA_PUBLIC_API_BASE || "/api/v1";

export class RepairedApiError extends Error {
  status: number;
  retryable: boolean;

  constructor(message: string, status = 500, retryable = false) {
    super(message);
    this.name = "RepairedApiError";
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
    throw new RepairedApiError(
      `Public API request failed: ${response.status}`,
      response.status,
      response.status >= 500
    );
  }

  const payload = (await response.json()) as { data?: T };
  if (!payload || !("data" in payload)) {
    throw new RepairedApiError(
      "Public API returned an invalid payload.",
      502,
      true
    );
  }

  return deepDecode(payload.data as T);
}

export function getGenre(
  slug: string
): Promise<RepairedGenreDetail | null> {
  return fetchPublic<RepairedGenreDetail | null>(
    `/genres/${encodeURIComponent(slug)}`
  );
}

export function getLabel(
  slug: string
): Promise<RepairedLabelDetail | null> {
  return fetchPublic<RepairedLabelDetail | null>(
    `/labels/${encodeURIComponent(slug)}`
  );
}

export function getTrack(
  slug: string
): Promise<RepairedTrackDetail | null> {
  return fetchPublic<RepairedTrackDetail | null>(
    `/tracks/${encodeURIComponent(slug)}`
  );
}
