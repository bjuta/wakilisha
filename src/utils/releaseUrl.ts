import {
  hasDedicatedPublicReleasePage,
  releaseTypeLabelFromActiveTrackCount,
  releaseTaxonomyFromActiveTrackCount,
} from "../../supabase/functions/_shared/release-taxonomy.ts";
import { trackUrl } from "./trackUrl";

export {
  hasDedicatedPublicReleasePage,
  releaseTypeLabelFromActiveTrackCount,
  releaseTaxonomyFromActiveTrackCount,
};

export function slugify(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

export type PublicReleaseRouteInput = {
  slug: string;
  artist: string;
  artistSlug?: string;
  trackCount?: number;
  releaseType?: string | null;
  singleTrackSlug?: string | null;
  singleTrackArtistSlug?: string | null;
};

export function releaseUrl(release: PublicReleaseRouteInput): string {
  const artistSlug =
    release.artistSlug ||
    slugify(release.artist);
  const rawTrackCount = release.trackCount;
  const hasTrackCount =
    rawTrackCount !== undefined &&
    rawTrackCount !== null &&
    Number.isFinite(Number(rawTrackCount));
  const trackCount = hasTrackCount
    ? Math.max(0, Math.floor(Number(rawTrackCount)))
    : null;
  const releaseType = String(
    release.releaseType || "",
  ).trim().toLowerCase();
  const isSingle =
    trackCount === 1 ||
    releaseType === "single";

  if (isSingle && release.singleTrackSlug) {
    const trackArtistSlug =
      release.singleTrackArtistSlug ||
      artistSlug;

    if (trackArtistSlug) {
      return trackUrl(
        release.singleTrackSlug,
        [trackArtistSlug],
      );
    }
  }

  if (isSingle) {
    return "/releases";
  }

  const isKnownMultiTrack =
    (trackCount !== null && trackCount >= 2) ||
    releaseType === "ep" ||
    releaseType === "album";

  if (!isKnownMultiTrack) {
    return "/releases";
  }

  return `/releases/${artistSlug}/${release.slug}`;
}
