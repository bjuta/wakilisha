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
  singleTrackSlug?: string | null;
  singleTrackArtistSlug?: string | null;
};

export function releaseUrl(release: PublicReleaseRouteInput): string {
  const artistSlug =
    release.artistSlug ||
    slugify(release.artist);
  const trackCount = Number(release.trackCount || 0);

  if (
    trackCount === 1 &&
    release.singleTrackSlug
  ) {
    const trackArtistSlug =
      release.singleTrackArtistSlug ||
      artistSlug;

    if (trackArtistSlug) {
      return `/tracks/${trackArtistSlug}/${release.singleTrackSlug}`;
    }
  }

  return `/releases/${artistSlug}/${release.slug}`;
}
