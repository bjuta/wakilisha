import type {
  MusicArtistSchema,
} from "@/components/seo/SchemaOrg";
import type {
  PublicReleaseArtist,
} from "@/services/publicContent/client";

export function buildReleaseSchemaArtists(
  artists:
    PublicReleaseArtist[] |
    null |
    undefined,
): MusicArtistSchema[] {
  const ordered = [
    ...(artists || []),
  ].sort(
    (a, b) =>
      a.creditOrder -
        b.creditOrder ||
      a.artistId.localeCompare(
        b.artistId,
      ),
  );

  const primary = ordered.filter(
    (artist) => artist.isPrimary,
  );
  const selected =
    primary.length > 0
      ? primary
      : ordered;

  return selected.map((artist) => ({
    "@type":
      artist.artistType === "solo"
        ? "Person"
        : "MusicGroup",
    name: artist.name,
    url: artist.slug
      ? `/artists/${artist.slug}`
      : undefined,
  }));
}
