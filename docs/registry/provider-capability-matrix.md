# Phase 6A Provider Capability Matrix

Phase 6A defines what each provider can safely contribute to the WAKILISHA registry enrichment and canonicalization workflow.

This is intentionally documentation-first. It does not add API calls, schema migrations, provider credentials, canonical registry writes, or public rendering changes.

## Product goal

Build a provider-aware release enrichment flow where existing registry releases, release shells, and staged provider items can be enriched before canonicalization.

The workflow should help an admin answer:

- What is missing from this registry release or release shell?
- Which provider can supply the missing field?
- How trustworthy is that provider for this field?
- What evidence supports the suggested value?
- Does this field need human review before applying?
- Can this release be safely canonicalized?

## Core principle

No provider response should be written directly into canonical registry tables without passing through staging, field-level observation, suggestion, provenance, and review rules.

Provider data should move through this path:

```text
provider API response
→ normalized provider payload
→ provider item / provider match candidate
→ field-level observations
→ enrichment suggestions
→ review / approval
→ canonical registry write
→ provenance + audit log
```

## Provider reliability tiers

| Tier | Meaning | Example use |
| --- | --- | --- |
| Strong identifier | Field can strongly identify a canonical entity. | ISRC, UPC/EAN, provider release ID, MusicBrainz MBID. |
| Strong enrichment | Field can usually enrich an already-confirmed entity. | Artwork, duration, track order, release date, track count. |
| Contextual enrichment | Field helps review but should not decide identity alone. | Genre, popularity, market availability, copyright text. |
| Media enrichment | Field enriches media/presentation, not canonical release identity. | YouTube video ID, thumbnails, channel, video duration. |
| Weak / provider-specific | Field may be missing, deprecated, inconsistent, or policy-bound. | Spotify preview URL, Spotify label/copyright fields, inferred labels. |

## Capability matrix

| Registry field / enrichment need | Spotify | Apple Music | MusicBrainz | YouTube | Deezer / Boomplay / Mdundo |
| --- | --- | --- | --- | --- | --- |
| Provider release ID | Yes | Yes | Release MBID / release-group MBID | No release concept | Validate later |
| Provider track ID | Yes | Yes | Recording MBID | Video ID only | Validate later |
| Provider artist ID | Yes | Yes | Artist MBID | Channel ID only | Validate later |
| Release title | Yes | Yes | Yes | Sometimes inferable from video title only | Validate later |
| Track title | Yes | Yes | Yes | Sometimes inferable from video title only | Validate later |
| Artist display name | Yes | Yes | Yes | Channel/title context only | Validate later |
| Artist relationships | Yes | Yes | Yes via artist credits | Weak | Validate later |
| Release date | Yes, with precision | Yes, validate storefront behavior | Yes, may vary by country/edition | Video publish date only | Validate later |
| Release type | Album / single / compilation context | Album / song catalog context, validate EP handling | Release group / release type context | No | Validate later |
| Track count | Yes | Yes | Yes when media/recordings included | No | Validate later |
| Track order | Yes | Yes | Yes when media/recordings included | No | Validate later |
| Disc number | Yes | Yes, validate | Yes when media included | No | Validate later |
| Track duration | Yes | Yes, validate units | Sometimes available | Video duration only | Validate later |
| ISRC | Track external IDs, when present | Validate live | Yes via recording/ISRC lookup | No | Validate later |
| UPC / barcode | Album external IDs, when present | Validate live | Barcode field | No | Validate later |
| Label | Present in some album responses but treat as weak/provider-specific | Validate live | Stronger when release match is confirmed | No | Validate later |
| Copyright | Present in some album responses; contextual | Validate live | Not primary | No | Validate later |
| Album artwork | Yes, with attribution and no-modification constraints | Yes, validate artwork templates/sizes | Via Cover Art Archive when available | Thumbnail only, not album artwork | Validate later |
| Preview URL | Nullable / may be unavailable; treat as optional | Validate live | No | Embed/video only | Validate later |
| Genre | Present but provider-specific | Present but provider-specific | Genres/tags when included | Category only, not music genre | Validate later |
| Market / storefront availability | Markets | Storefronts | Limited | Region restrictions | Validate later |
| Popularity / stats | Popularity fields | Not core registry identity | No | View/like stats | Validate later |
| Official video | No | Music video catalog possible, validate | URL relationships sometimes | Yes | Validate later |

## Provider-specific notes

### Spotify

Use Spotify first for structured release and track metadata because it has stable album, track, artist, and search endpoints.

Good for:

- release title
- release type
- release date and precision
- artwork candidates
- tracklist
- track order
- duration in milliseconds
- artist IDs and names
- ISRC when present on track external IDs
- UPC/EAN when present on album external IDs
- market availability

Cautions:

- Preview URLs may be missing or unavailable.
- Label/copyright fields should be treated as enrichment evidence, not sole canonical truth.
- Spotify artwork and metadata have attribution/policy constraints. Store provider URL and attribution status with any public use.
- Do not modify provider artwork.

### Apple Music

Apple Music should be treated as a high-value enrichment provider, especially because storefront-specific catalog data may be important for African releases.

Before hard-coding field assumptions, implement a live probe that saves raw samples from Kenyan/African releases.

Validate:

- artwork shape and template URL behavior
- preview URL availability
- release date shape
- track duration units
- ISRC availability
- record label availability
- genre shape
- storefront differences

### MusicBrainz

MusicBrainz should be treated as an open metadata backbone and conflict-resolution source.

Good for:

- MBIDs
- release vs release-group distinction
- release country/date variants
- label and barcode data
- recording lookup
- ISRC lookup
- artist credits
- tracklist verification
- duplicate detection
- open provenance

Cautions:

- Public API must be rate-limited and cached.
- Data quality varies by release coverage.
- Use it as strong evidence when a match is confirmed, not as a replacement for local editorial review.

### YouTube

YouTube should be used for media enrichment, not release canonicalization.

Good for:

- official video URL
- thumbnails
- video duration
- channel ID/name
- published date
- embed/player metadata
- view/stat context

Cautions:

- YouTube video date is not release date.
- YouTube thumbnails are not album artwork.
- YouTube does not provide ISRC, UPC, label, or canonical album structure through the standard video API.

### Deezer, Boomplay, Mdundo

These providers should be added after Spotify, Apple Music, and MusicBrainz prove the normalized adapter contract.

Do not block Phase 6 on them.

Use them later for:

- additional African catalog coverage
- cross-provider confirmation
- local market availability
- alternate artwork/preview links where policy allows

## Normalized provider payload target

All provider adapters should output a common release shape.

```ts
export type NormalizedProviderRelease = {
  provider: "spotify" | "apple_music" | "musicbrainz" | "youtube" | "deezer" | "boomplay" | "mdundo";
  providerReleaseId: string | null;
  providerUrl: string | null;
  release: {
    title: string;
    normalizedTitle: string;
    artistDisplayName: string | null;
    artistNames: string[];
    releaseDate: string | null;
    releaseDatePrecision: "day" | "month" | "year" | "unknown";
    releaseType: "album" | "single" | "ep" | "compilation" | "unknown";
    trackCount: number | null;
    upc: string | null;
    ean: string | null;
    labelName: string | null;
    copyrightText: string | null;
    genres: string[];
    storefrontOrMarket: string | null;
  };
  artwork: {
    url: string | null;
    width: number | null;
    height: number | null;
    providerRules: string[];
  };
  tracks: NormalizedProviderTrack[];
  artists: NormalizedProviderArtist[];
  raw: unknown;
};

export type NormalizedProviderTrack = {
  providerTrackId: string | null;
  providerUrl: string | null;
  title: string;
  normalizedTitle: string;
  artistNames: string[];
  discNumber: number | null;
  trackNumber: number | null;
  durationMs: number | null;
  isrc: string | null;
  previewUrl: string | null;
  explicit: boolean | null;
};

export type NormalizedProviderArtist = {
  providerArtistId: string | null;
  providerUrl: string | null;
  name: string;
  normalizedName: string;
  role: "primary_artist" | "featured_artist" | "album_artist" | "unknown";
};
```

## Enrichment targets

The first enrichment flow should prioritize fields that make old releases easier to canonicalize.

Priority fields:

1. Artwork
2. Provider release links
3. Provider artist links
4. Tracklist
5. Track order
6. Track duration
7. ISRC
8. UPC / barcode
9. Release date
10. Label
11. Preview URL
12. Official video URL
13. Genre / tags
14. Copyright text

## Matching rules

### Strong match signals

- Same provider ID already linked to registry entity.
- Exact ISRC match for tracks.
- Exact UPC/barcode match for releases.
- MusicBrainz MBID already linked.
- Same artist + normalized release title + same release date + same track count.
- Same artist + same release title + matching tracklist fingerprint.

### Medium match signals

- Same artist + normalized title + nearby release year.
- Same normalized title + matching track count.
- Same title + provider artist candidate match.

### Weak match signals

- Same title only.
- Similar artwork only.
- YouTube title similarity only.
- Provider genre similarity only.

## Suggested review states

Provider and enrichment records should move through explicit states:

```text
draft
needs_review
ready_for_enrichment
ready_for_canonicalization
canonicalized
blocked
rejected
conflict
```

## Safe automation rules

Can be auto-suggested and sometimes auto-applied after a confirmed match:

- Track duration
- Track order
- Provider IDs
- ISRC where title, artist, and duration also match
- Artwork where provider match is confirmed and policy requirements are satisfied

Must require review:

- Release title changes
- Artist relationship changes
- Release date conflicts
- Label changes
- Release type changes
- Canonical release creation
- Duplicate merges

Never automatic in early phases:

- Delete canonical entity
- Merge artists
- Replace manually curated editorial metadata
- Publish public entity without preview gate

## Phase 6A acceptance criteria

- The provider capability matrix exists in `docs/registry/provider-capability-matrix.md`.
- It defines provider strengths, cautions, and reliability tiers.
- It defines the normalized provider payload target.
- It identifies the first enrichment targets for release canonicalization.
- It does not modify runtime code.
- It does not add API credentials.
- It does not add schema migrations.
- It does not write canonical registry data.
- Existing Phase 5B/5C commands remain untouched.

## Next phases unlocked by this document

- Phase 6B: normalized provider TypeScript contracts.
- Phase 6C: field observation and enrichment suggestion schema.
- Phase 7A: Spotify adapter and probe.
- Phase 7B: Apple Music probe and adapter.
- Phase 7C: MusicBrainz adapter with queue/rate limiting.
- Phase 8: enrichment scanner for incomplete registry releases and release shells.
- Phase 9: Release Enrichment Studio UI.
