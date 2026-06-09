type JsonRecord = Record<string, unknown>;

type ProbeArgs = {
  storefront: string;
  albumId: string | null;
  url: string | null;
  include: string;
  saveRaw: boolean;
};

function getArg(name: string): string | null {
  const prefix = `--${name}=`;
  return process.argv.find((arg) => arg.startsWith(prefix))?.slice(prefix.length) ?? null;
}

function hasFlag(name: string): boolean {
  return process.argv.includes(`--${name}`);
}

function parseAppleMusicAlbumId(urlOrId: string | null): string | null {
  if (!urlOrId) return null;
  if (/^\d+$/.test(urlOrId)) return urlOrId;

  try {
    const url = new URL(urlOrId);
    const segments = url.pathname.split('/').filter(Boolean);
    const lastNumericSegment = [...segments].reverse().find((segment) => /^\d+$/.test(segment));
    return lastNumericSegment ?? url.searchParams.get('i');
  } catch {
    return null;
  }
}

function collectKeys(value: unknown, prefix = '', keys = new Set<string>()): Set<string> {
  if (!value || typeof value !== 'object') return keys;
  if (Array.isArray(value)) {
    value.slice(0, 3).forEach((item, index) => collectKeys(item, `${prefix}[${index}]`, keys));
    return keys;
  }

  for (const [key, child] of Object.entries(value as JsonRecord)) {
    const path = prefix ? `${prefix}.${key}` : key;
    keys.add(path);
    collectKeys(child, path, keys);
  }

  return keys;
}

function getAttributes(resource: unknown): JsonRecord {
  if (!resource || typeof resource !== 'object') return {};
  const maybeAttributes = (resource as JsonRecord).attributes;
  return maybeAttributes && typeof maybeAttributes === 'object' && !Array.isArray(maybeAttributes)
    ? (maybeAttributes as JsonRecord)
    : {};
}

function hasOwn(record: JsonRecord, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(record, key);
}

function summarizeFieldCoverage(label: string, attributes: JsonRecord): void {
  const fields = [
    'name',
    'artistName',
    'releaseDate',
    'trackCount',
    'recordLabel',
    'copyright',
    'genreNames',
    'artwork',
    'previews',
    'durationInMillis',
    'isrc',
    'url',
    'playParams',
  ];

  console.log(`\n${label} field coverage`);
  console.log('-'.repeat(80));
  console.table(
    fields.map((field) => ({
      field,
      present: hasOwn(attributes, field),
      value_type: hasOwn(attributes, field)
        ? Array.isArray(attributes[field])
          ? 'array'
          : typeof attributes[field]
        : 'missing',
    })),
  );
}

function summarizeKeys(label: string, value: unknown): void {
  console.log(`\n${label} observed keys`);
  console.log('-'.repeat(80));
  const keys = [...collectKeys(value)].sort();
  console.log(keys.slice(0, 120).join('\n') || '(no keys observed)');
  if (keys.length > 120) console.log(`... ${keys.length - 120} more keys omitted`);
}

async function run(): Promise<void> {
  const args: ProbeArgs = {
    storefront: getArg('storefront') ?? 'ke',
    albumId: parseAppleMusicAlbumId(getArg('album-id') ?? getArg('url')),
    url: getArg('url'),
    include: getArg('include') ?? 'tracks,artists',
    saveRaw: hasFlag('save-raw'),
  };

  const developerToken = process.env.APPLE_MUSIC_DEVELOPER_TOKEN;
  if (!developerToken) {
    throw new Error('APPLE_MUSIC_DEVELOPER_TOKEN is required. Paste/export it securely; do not commit it.');
  }

  if (!args.albumId) {
    throw new Error('Provide --album-id=<apple catalog album id> or --url=<apple music album url>.');
  }

  const endpoint = new URL(`https://api.music.apple.com/v1/catalog/${args.storefront}/albums/${args.albumId}`);
  endpoint.searchParams.set('include', args.include);

  console.log('\nWAKILISHA Phase 7B Apple Music Probe');
  console.log('='.repeat(80));
  console.log(`Storefront: ${args.storefront}`);
  console.log(`Album ID: ${args.albumId}`);
  if (args.url) console.log(`Source URL: ${args.url}`);
  console.log(`Include: ${args.include}`);

  const response = await fetch(endpoint, {
    headers: {
      Authorization: `Bearer ${developerToken}`,
      Accept: 'application/json',
    },
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Apple Music API request failed: ${response.status} ${response.statusText}\n${errorText}`);
  }

  const payload = (await response.json()) as JsonRecord;
  const album = Array.isArray(payload.data) ? payload.data[0] : null;
  const albumAttributes = getAttributes(album);
  const relationships = album && typeof album === 'object' ? (album as JsonRecord).relationships as JsonRecord | undefined : undefined;
  const tracks = relationships?.tracks && typeof relationships.tracks === 'object'
    ? ((relationships.tracks as JsonRecord).data as unknown[] | undefined) ?? []
    : [];
  const firstTrackAttributes = getAttributes(tracks[0]);

  summarizeFieldCoverage('Album attributes', albumAttributes);
  summarizeFieldCoverage('First track attributes', firstTrackAttributes);
  summarizeKeys('Album resource', album);
  summarizeKeys('First track resource', tracks[0]);

  console.log('\nProbe result');
  console.log('-'.repeat(80));
  console.table([
    {
      album_found: Boolean(album),
      tracks_found: tracks.length,
      album_has_artwork: hasOwn(albumAttributes, 'artwork'),
      album_has_record_label: hasOwn(albumAttributes, 'recordLabel'),
      album_has_release_date: hasOwn(albumAttributes, 'releaseDate'),
      first_track_has_duration: hasOwn(firstTrackAttributes, 'durationInMillis'),
      first_track_has_isrc: hasOwn(firstTrackAttributes, 'isrc'),
      first_track_has_previews: hasOwn(firstTrackAttributes, 'previews'),
    },
  ]);

  if (args.saveRaw) {
    const fs = await import('node:fs/promises');
    const path = await import('node:path');
    const dir = path.join(process.cwd(), 'provider_samples', 'apple_music');
    await fs.mkdir(dir, { recursive: true });
    const file = path.join(dir, `${args.storefront}-${args.albumId}.json`);
    await fs.writeFile(file, JSON.stringify(payload, null, 2));
    console.log(`\nSaved raw sample: ${file}`);
  }
}

run().catch((error) => {
  console.error('\nPhase 7B Apple Music probe failed.');
  console.error(error);
  process.exitCode = 1;
});
