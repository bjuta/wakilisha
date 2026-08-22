import { supabase } from "@/lib/supabase";
import {
  decodePublicAudioPublication,
  type PublicAudioPublication,
} from "./audioPublicModel";

export async function getPublicAudioPublication(
  slug: string,
): Promise<PublicAudioPublication | null> {
  const normalizedSlug = slug.trim();
  if (!normalizedSlug) return null;

  const { data, error } = await supabase.rpc(
    "get_public_audio_publication",
    { p_slug: normalizedSlug },
  );

  if (error) {
    throw new Error(
      `Could not load this recording: ${error.message}`,
    );
  }

  return decodePublicAudioPublication(data);
}

export async function getPublicStandaloneAudio(
  slug: string,
): Promise<PublicAudioPublication | null> {
  const publication = await getPublicAudioPublication(slug);

  if (
    !publication ||
    publication.publicationKind !== "standalone" ||
    publication.canonicalPath !== `/audio/${publication.slug}`
  ) {
    return null;
  }

  return publication;
}
