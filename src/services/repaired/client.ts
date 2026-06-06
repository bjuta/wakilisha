import type {
  RepairedGenreDetail,
  RepairedLabelDetail,
  RepairedTrackDetail,
} from "./types";

export const PUBLIC_API_BASE =
  import.meta.env.VITE_WAKILISHA_PUBLIC_API_BASE ||
  "/__wakilisha-v2-api/wp-json/wakilisha/v2";

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

async function fetchRepaired<T>(path: string): Promise<T> {
  const base = PUBLIC_API_BASE.replace(/\/$/, "");
  const target = `${base}${path.startsWith("/") ? path : `/${path}`}`;
  const response = await fetch(target, {
    headers: { Accept: "application/json" },
  });

  if (!response.ok) {
    throw new RepairedApiError(
      `Repaired API request failed: ${response.status}`,
      response.status,
      response.status >= 500
    );
  }

  const payload = (await response.json()) as { data?: T };
  if (!payload || !("data" in payload)) {
    throw new RepairedApiError(
      "Repaired API returned an invalid payload.",
      502,
      true
    );
  }

  return payload.data as T;
}

export function getGenre(
  slug: string
): Promise<RepairedGenreDetail | null> {
  return fetchRepaired<RepairedGenreDetail | null>(
    `/repaired/genres/${encodeURIComponent(slug)}`
  );
}

export function getLabel(
  slug: string
): Promise<RepairedLabelDetail | null> {
  return fetchRepaired<RepairedLabelDetail | null>(
    `/repaired/labels/${encodeURIComponent(slug)}`
  );
}

export function getTrack(
  slug: string
): Promise<RepairedTrackDetail | null> {
  return fetchRepaired<RepairedTrackDetail | null>(
    `/repaired/tracks/${encodeURIComponent(slug)}`
  );
}