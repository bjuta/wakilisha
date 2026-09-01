import {
  hasDedicatedPublicReleasePage,
  releaseTypeLabelFromActiveTrackCount,
  releaseTaxonomyFromActiveTrackCount,
} from "../../supabase/functions/_shared/release-taxonomy.ts";

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
  const trackCount = Number(release.trackCount || 0);
  const isSingle =
    trackCount === 1 ||
    String(release.releaseType || "").trim().toLowerCase() === "single";

  if (
    isSingle &&
    release.singleTrackSlug
  ) {
    const trackArtistSlug =
      release.singleTrackArtistSlug ||
      artistSlug;

    if (trackArtistSlug) {
      return `/tracks/${trackArtistSlug}/${release.singleTrackSlug}`;
    }
  }

  // A Single never owns a dedicated Release detail page.
  // If a producer lacks canonical Track identity, fail closed to the
  // Releases collection instead of manufacturing a ghost Release URL.
  if (isSingle) {
    return "/releases";
  }

  return `/releases/${artistSlug}/${release.slug}`;
}
