import { supabase } from "@/lib/supabase";
import {
  decodePublicVideoPublication,
  type PublicVideoPublication,
} from "./videoPublicModel";

type UnknownRecord = Record<string, unknown>;

function record(value: unknown): UnknownRecord {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as UnknownRecord
    : {};
}

export interface PublicVideoIndex {
  items: PublicVideoPublication[];
}

export async function getPublicVideoPublication(
  slug: string,
  showSlug: string | null = null,
): Promise<PublicVideoPublication | null> {
  const normalizedSlug = slug.trim().toLowerCase();
  const normalizedShowSlug = showSlug?.trim().toLowerCase() || null;
  if (!normalizedSlug) return null;

  const { data, error } = await supabase.rpc(
    "get_public_video_publication",
    {
      p_slug: normalizedSlug,
      p_show_slug: normalizedShowSlug,
    },
  );

  if (error) {
    throw new Error(`Could not load this Video: ${error.message}`);
  }

  return decodePublicVideoPublication(data);
}

export async function getPublicVideoIndex(
  limit = 24,
): Promise<PublicVideoIndex> {
  const safeLimit = Math.max(1, Math.min(Math.trunc(limit) || 24, 60));
  const { data, error } = await supabase.rpc(
    "get_public_video_index",
    { p_limit: safeLimit },
  );

  if (error) throw error;

  const root = record(data);
  const items = Array.isArray(root.items)
    ? root.items
        .map(decodePublicVideoPublication)
        .filter((value): value is PublicVideoPublication => value !== null)
    : [];

  return { items };
}

export function publicVideoCaptionUrl(
  publication: PublicVideoPublication,
  trackNumber: number,
): string {
  const projectUrl = String(
    import.meta.env.VITE_PUBLIC_SUPABASE_URL || "",
  ).replace(/\/$/, "");

  if (!projectUrl) {
    throw new Error("Public Supabase URL is not configured.");
  }

  const url = new URL(
    `${projectUrl}/functions/v1/video-public-delivery`,
  );
  url.searchParams.set("kind", "caption");
  url.searchParams.set("version", publication.versionId);
  url.searchParams.set("track", String(trackNumber));
  return url.toString();
}
