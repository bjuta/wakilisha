import { AppleMusicAdapter, AppleMusicAdapterError } from '../../src/services/registry/provider-adapters/apple-music-adapter';

type Args = {
  albumIdOrUrl: string | null;
  storefronts: string[];
  include: string;
  json: boolean;
};

function getArg(name: string): string | null {
  const prefix = `--${name}=`;
  return process.argv.find((arg) => arg.startsWith(prefix))?.slice(prefix.length) ?? null;
}

function hasFlag(name: string): boolean {
  return process.argv.includes(`--${name}`);
}

function parseArgs(): Args {
  const albumIdOrUrl = getArg('album-id') ?? getArg('url');
  const storefronts = (getArg('storefronts') ?? getArg('storefront') ?? 'ke')
    .split(',')
    .map((storefront) => storefront.trim())
    .filter(Boolean);

  return {
    albumIdOrUrl,
    storefronts,
    include: getArg('include') ?? 'tracks,artists',
    json: hasFlag('json'),
  };
}

async function run(): Promise<void> {
  const args = parseArgs();

  if (!args.albumIdOrUrl) {
    throw new Error('Provide --album-id=<apple catalog album id> or --url=<apple music album url>.');
  }

  console.log('\nWAKILISHA Phase 7B.2 Apple Music Adapter Test');
  console.log('='.repeat(80));
  console.log(`Album input: ${args.albumIdOrUrl}`);
  console.log(`Storefronts: ${args.storefronts.join(', ')}`);
  console.log(`Include: ${args.include}`);

  const results = [];

  for (const storefront of args.storefronts) {
    const adapter = AppleMusicAdapter.fromEnv(storefront);
    const release = await adapter.fetchAlbum(args.albumIdOrUrl, {
      storefront,
      include: args.include,
    });

    const firstTrack = release.tracks[0] ?? null;
    const summary = {
      storefront,
      provider: release.provider,
      providerReleaseId: release.providerReleaseId,
      title: release.release.title,
      artist: release.release.artistDisplayName,
      releaseDate: release.release.releaseDate,
      releaseDatePrecision: release.release.releaseDatePrecision,
      releaseType: release.release.releaseType,
      trackCount: release.release.trackCount,
      normalizedTracks: release.tracks.length,
      label: release.release.labelName,
      upc: release.release.upc,
      genres: release.release.genres.join(', '),
      artworkUrl: release.artwork.url,
      firstTrackTitle: firstTrack?.title ?? null,
      firstTrackDurationMs: firstTrack?.durationMs ?? null,
      firstTrackIsrc: firstTrack?.isrc ?? null,
      firstTrackPreviewUrl: firstTrack?.previewUrl ?? null,
    };

    results.push(summary);
  }

  if (args.json) {
    console.log(JSON.stringify(results, null, 2));
    return;
  }

  console.log('\nNormalized adapter summaries');
  console.log('-'.repeat(80));
  console.table(results);
}

run().catch((error) => {
  console.error('\nPhase 7B.2 Apple Music adapter test failed.');

  if (error instanceof AppleMusicAdapterError) {
    console.error(error.message);
    if (error.status) console.error(`Status: ${error.status}`);
    if (error.responseBody) console.error(error.responseBody);
  } else {
    console.error(error);
  }

  process.exitCode = 1;
});
