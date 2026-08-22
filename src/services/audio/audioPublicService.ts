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

export async function getPublicAudioEpisode(
  showSlug: string,
  episodeSlug: string,
): Promise<PublicAudioPublication | null> {
  const normalizedShowSlug = showSlug.trim();
  const normalizedEpisodeSlug = episodeSlug.trim();

  if (!normalizedShowSlug || !normalizedEpisodeSlug) return null;

  const { data, error } = await supabase.rpc(
    "get_public_audio_episode",
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

  const publication = decodePublicAudioPublication(data);

  if (
    !publication ||
    publication.publicationKind !== "episode" ||
    publication.show?.slug !== normalizedShowSlug ||
    publication.slug !== normalizedEpisodeSlug ||
    publication.canonicalPath !==
      `/shows/${normalizedShowSlug}/episodes/${normalizedEpisodeSlug}`
  ) {
    return null;
  }

  return publication;
}
