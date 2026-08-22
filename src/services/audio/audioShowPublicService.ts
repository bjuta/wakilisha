import { supabase } from "@/lib/supabase";
import {
  decodePublicAudioShow,
  type PublicAudioShowDetail,
} from "./audioShowPublicModel";

export async function getPublicAudioShow(
  slug: string,
): Promise<PublicAudioShowDetail | null> {
  const normalizedSlug = slug.trim();
  if (!normalizedSlug) return null;

  const { data, error } = await supabase.rpc(
    "get_public_audio_show",
    { p_slug: normalizedSlug },
  );

  if (error) {
    throw new Error(
      error.message || "Audio Show could not load.",
    );
  }

  return decodePublicAudioShow(data);
}
