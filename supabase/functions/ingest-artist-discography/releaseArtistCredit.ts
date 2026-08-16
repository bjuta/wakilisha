function normalizeArtistName(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

function splitAlbumArtistNames(raw: string): string[] {
  if (!raw) return [];

  return raw
    .split(/\s*,\s*|\s+&\s+|\s+and\s+|\s+x\s+|\s+\+\s+/i)
    .map((value) => value.trim())
    .filter(Boolean);
}

export function albumArtistCreditIncludesArtist(
  albumArtistName: string,
  artistName: string,
): boolean {
  const target = normalizeArtistName(artistName);
  if (!target) return false;

  return splitAlbumArtistNames(albumArtistName).some(
    (candidate) => normalizeArtistName(candidate) === target,
  );
}

export type ReleaseArtistCreditKind =
  | "current_artist"
  | "explicit_additional_primary"
  | "discovered_album_artist";

export type ReleaseArtistCredit = {
  role: "primary_artist" | "featured_artist";
  is_primary: boolean;
  is_featured: boolean;
};

export function resolveReleaseArtistCredit(
  kind: ReleaseArtistCreditKind,
  currentArtistIsAlbumPrimary = false,
): ReleaseArtistCredit {
  const isPrimary =
    kind === "explicit_additional_primary"
    || (kind === "current_artist" && currentArtistIsAlbumPrimary);

  return {
    role: isPrimary ? "primary_artist" : "featured_artist",
    is_primary: isPrimary,
    is_featured: !isPrimary,
  };
}
