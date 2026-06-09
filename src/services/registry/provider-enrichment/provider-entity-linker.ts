import type { NormalizedProviderRelease } from '../../../types/registry/normalized-provider-payload';

export type ProviderEntityLinkInput = {
  registryEntityType: 'release' | 'track' | 'artist';
  registryEntityId: string;
  provider: NormalizedProviderRelease['provider'];
  providerEntityId: string;
  providerUrl: string | null;
  matchStatus: 'candidate' | 'confirmed' | 'rejected';
  confidenceScore: number;
};

export type ProviderEntityLinkBuildOptions = {
  registryReleaseId: string;
  includeTrackLinks?: boolean;
  includeArtistLinks?: boolean;
};

export function buildProviderEntityLinks(
  release: NormalizedProviderRelease,
  options: ProviderEntityLinkBuildOptions,
): ProviderEntityLinkInput[] {
  const links: ProviderEntityLinkInput[] = [];

  if (release.providerReleaseId) {
    links.push({
      registryEntityType: 'release',
      registryEntityId: options.registryReleaseId,
      provider: release.provider,
      providerEntityId: release.providerReleaseId,
      providerUrl: release.providerUrl,
      matchStatus: 'candidate',
      confidenceScore: 0.85,
    });
  }

  if (options.includeTrackLinks) {
    release.tracks.forEach((track) => {
      if (!track.providerTrackId) return;

      links.push({
        registryEntityType: 'track',
        registryEntityId: options.registryReleaseId,
        provider: release.provider,
        providerEntityId: track.providerTrackId,
        providerUrl: track.providerUrl,
        matchStatus: 'candidate',
        confidenceScore: 0.7,
      });
    });
  }

  if (options.includeArtistLinks) {
    release.artists.forEach((artist) => {
      if (!artist.providerArtistId) return;

      links.push({
        registryEntityType: 'artist',
        registryEntityId: options.registryReleaseId,
        provider: release.provider,
        providerEntityId: artist.providerArtistId,
        providerUrl: artist.providerUrl,
        matchStatus: 'candidate',
        confidenceScore: 0.7,
      });
    });
  }

  return links;
}
