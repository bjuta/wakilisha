import { supabase } from "@/lib/supabase";
import {
  decodePublicShow,
  decodePublicShowEpisode,
  type PublicShowDetail,
  type PublicShowEpisode,
} from "./showPublicModel";

export async function getPublicShow(
  slug: string,
): Promise<PublicShowDetail | null> {
  const normalizedSlug = slug.trim();
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
  const normalizedShowSlug = showSlug.trim();
  const normalizedEpisodeSlug = episodeSlug.trim();

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

  return decodePublicShowEpisode(data);
}
