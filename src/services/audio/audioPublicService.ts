import { supabase } from "@/lib/supabase";
import {
  decodePublicAudioPublication,
  type PublicAudioPublication,
} from "./audioPublicModel";
import {
  decodePublicShow,
  type PublicShowDetail,
} from "@/services/shows/showPublicModel";

type UnknownRecord = Record<string, unknown>;

export interface PublicAudioIndex {
  standalone: PublicAudioPublication[];
  shows: PublicShowDetail[];
}

function record(value: unknown): UnknownRecord {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as UnknownRecord
    : {};
}

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

export async function getPublicAudioIndex(
  limit = 24,
): Promise<PublicAudioIndex> {
  const safeLimit = Math.max(1, Math.min(Math.trunc(limit) || 24, 60));
  const { data, error } = await supabase.rpc(
    "get_public_audio_index",
    { p_limit: safeLimit },
  );

  if (error) throw error;

  const root = record(data);
  const standalone = Array.isArray(root.standalone)
    ? root.standalone
        .map(decodePublicAudioPublication)
        .filter((value): value is PublicAudioPublication => value !== null)
    : [];
  const shows = Array.isArray(root.shows)
    ? root.shows
        .map(decodePublicShow)
        .filter((value): value is PublicShowDetail => value !== null)
    : [];

  return { standalone, shows };
}
