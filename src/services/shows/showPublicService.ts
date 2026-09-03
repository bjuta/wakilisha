import { supabase } from "@/lib/supabase";
import {
  decodePublicShow,
  decodePublicShowEpisode,
  decodePublicShowIndex,
  type PublicShowDetail,
  type PublicShowEpisode,
  type PublicShowIndex,
} from "./showPublicModel";

export async function getPublicShow(
  slug: string,
): Promise<PublicShowDetail | null> {
  const normalizedSlug = slug.trim().toLowerCase();
  if (!normalizedSlug) return null;

  const { data, error } = await supabase.rpc(
    "get_public_show",
    { p_slug: normalizedSlug },
  );

  if (error) {
    throw new Error(
      `Could not load this Show: ${error.message}`,
    );
  }

  return decodePublicShow(data);
}

export async function getPublicShowEpisode(
  showSlug: string,
  episodeSlug: string,
): Promise<PublicShowEpisode | null> {
  const normalizedShowSlug = showSlug.trim().toLowerCase();
  const normalizedEpisodeSlug = episodeSlug.trim().toLowerCase();

  if (!normalizedShowSlug || !normalizedEpisodeSlug) return null;

  const { data, error } = await supabase.rpc(
    "get_public_show_episode",
    {
      p_show_slug: normalizedShowSlug,
      p_episode_slug: normalizedEpisodeSlug,
    },
  );

  if (error) {
    throw new Error(
      `Could not load this Episode: ${error.message}`,
    );
  }

  return decodePublicShowEpisode(data, normalizedShowSlug);
}

export async function getPublicShowIndex(
  limit = 24,
): Promise<PublicShowIndex> {
  const safeLimit = Math.max(1, Math.min(Math.trunc(limit) || 24, 60));

  const { data, error } = await supabase.rpc(
    "get_public_show_index",
    { p_limit: safeLimit },
  );

  if (error) {
    throw new Error(
      `Could not load Shows: ${error.message}`,
    );
  }

  return decodePublicShowIndex(data);
}
