import type { PublicAudioPublication } from "./audioPublicModel";
import {
  playerMediaItem,
  type PlayerMediaItem,
} from "@/services/player/playerExperience";

export function publicAudioPlayerItem(
  publication: PublicAudioPublication,
): PlayerMediaItem {
  const primaryCredit =
    publication.credits.find(
      (credit) => credit.isPrimary,
    )?.displayName ??
    publication.credits[0]?.displayName ??
    null;
  const creatorLabel =
    primaryCredit ??
    publication.show?.title ??
    "WAKILISHA";
  const contextLabel =
    publication.show?.title &&
    publication.show.title !== creatorLabel
      ? publication.show.title
      : null;

  return playerMediaItem(
    {
      id: publication.publicationId,
      title: publication.title,
      artist: creatorLabel,
      album: publication.show?.title ?? undefined,
      duration:
        publication.delivery.durationSeconds ?? undefined,
      isPlayable: true,
      source: "WAKILISHA",
      previewUrl: publication.delivery.url,
      playbackEngine: "audio",
    },
    {
      mediaKind:
        publication.publicationKind === "episode"
          ? "audio_episode"
          : "standalone_audio",
      canonicalPath: publication.canonicalPath,
      creatorLabel,
      contextLabel,
      playbackAvailability: "full",
      chapters: publication.chapters.map((chapter) => ({
        id: `chapter-${chapter.chapterNumber}`,
        startSeconds: chapter.startSeconds,
        title: chapter.title,
      })),
      transcript: publication.transcript?.url
        ? {
            url: publication.transcript.url,
            label: "Transcript",
          }
        : null,
      capabilities: {
        previousNext: false,
        jumpBySeconds: 15,
        shuffle: false,
        repeat: false,
        lyrics: false,
        moments: false,
        addToPlaylist: false,
        save: false,
        chapters: publication.chapters.length > 0,
        transcript: Boolean(publication.transcript?.url),
        playbackSpeed: true,
      },
    },
  );
}
