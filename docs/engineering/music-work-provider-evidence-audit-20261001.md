# Music Work Provider Evidence Audit

Date: 1 October 2026

Status: **READ-ONLY CAPABILITY + FIELD-CHOICE PACKAGE — NO WORK BACKFILL OR PROVIDER ACQUISITION**

Programme authority:

- issue #1118 — real creator cohort rollout acceptance;
- `docs/engineering/wakilisha-music-data-standards-foundation.md`;
- existing Registry provider enrichment authority;
- existing Music Provenance Work / Track→Work admission authority.

## 1. Purpose

The creator-credit cohort exposed a structural gap:

- Recording credits can attach directly to `registry_tracks`;
- songwriting credits require a canonical `registry_works.id`;
- Production currently has no populated Work layer for the existing Track catalogue.

This package answers the question that must precede any mutation:

> For each current WAKILISHA Track, which external evidence sources can resolve the underlying musical Work, which fields are actually needed, which extra fields are available, and which fields is WAKILISHA permitted to retain?

This package is deliberately read-only.

It does not:

- call a provider API;
- create a Work;
- create a Track→Work link;
- create a Work contribution;
- promote a provider identifier;
- add credentials;
- mutate Production.

## 2. Durable package

### 2.1 Catalogue readiness report

`scripts/control-plane/report-music-work-provider-resolution-readonly.sql`

The report classifies every active Track using evidence already retained by WAKILISHA.

Resolution states:

- `already_work_linked`;
- `external_work_resolution_ready_with_retained_composer`;
- `external_work_resolution_ready_isrc`;
- `provider_collision_review`;
- `recording_identity_only_apple_policy_restricted`;
- `insufficient_provider_identity`.

An Apple Music identifier collision is also reported independently as
`has_apple_id_collision`.

An Apple-ID collision does **not** block ISRC-based Work resolution. ISRC provides an independent path to MusicBrainz, The MLC, ACRCloud, or another permitted Work source.

### 2.2 Provider field policy manifest

`config/music-work-provider-field-policy.v1.json`

Every provider field is classified as one of:

- Recording identity;
- Work identity;
- Work contributor;
- optional Registry enrichment;
- optional provider context;
- policy-blocked.

Provider availability does not equal permission to collect or retain a field.

### 2.3 Explicit field-choice planner

`scripts/control-plane/plan-music-work-provider-acquisition.mjs`

Default:

`work-evidence-only`

Optional profiles:

- `work-plus-registry-enrichment`;
- `review-all-available`.

The operator can also explicitly use:

- `--include provider.field`;
- `--exclude provider.field`.

Policy-blocked fields cannot be forced into a plan.

The planner itself performs no network calls and has no mutation authority.

Examples:

```bash
node scripts/control-plane/plan-music-work-provider-acquisition.mjs \
  --profile work-evidence-only \
  --providers musicbrainz,mlc,acrcloud

node scripts/control-plane/plan-music-work-provider-acquisition.mjs \
  --profile work-plus-registry-enrichment \
  --providers musicbrainz,acrcloud \
  --exclude acrcloud.genres

node scripts/control-plane/plan-music-work-provider-acquisition.mjs \
  --profile work-evidence-only \
  --providers acrcloud \
  --include acrcloud.album
```

The third command is an explicit operator decision to take an extra field that the default Work-evidence profile would not select.

## 3. Current Production readiness

Snapshot: 1 October 2026.

| Measure | Count |
| --- | ---: |
| Active Tracks | 2,407 |
| Tracks with ISRC | 2,097 |
| Tracks with retained Apple Music Track ID | 2,353 |
| Distinct retained Apple Music Track IDs | 2,279 |
| Tracks on any duplicated Apple Music ID | 141 |
| Current Track→Work links | 0 |
| Registry Works | 0 |

Read-only Work-resolution classification:

| State | Tracks |
| --- | ---: |
| ISRC-ready | 2,086 |
| ISRC-ready + retained composer evidence | 11 |
| Unique Apple recording identity only, Apple bulk Work use not approved | 197 |
| Apple provider collision review with no ISRC | 97 |
| Insufficient provider identity | 16 |

Important:

- 141 Tracks have an Apple-ID collision;
- 44 of those Tracks also have an ISRC;
- those 44 remain externally resolvable and are **not** blocked by the Apple collision.

Therefore:

**2,097 / 2,407 active Tracks, 87.1%, can begin Work resolution immediately from ISRC without making Apple Music the Work-registry backbone.**

Existing typed provider-link coverage is much smaller than legacy metadata coverage:

- Apple Music typed Track links: 332 rows;
- Spotify typed Track links: 3 rows.

A later governed migration should converge valid legacy provider identities into the typed provider-link authority, but that is not part of this read-only package.

## 4. Provider evidence policy

The classifications below are operational acquisition policy, not a substitute for legal advice or provider-specific commercial agreements.

### 4.1 MusicBrainz

Role: **primary open Work-resolution source**

Official documentation:

- https://musicbrainz.org/doc/MusicBrainz_API
- https://musicbrainz.org/doc/MusicBrainz_API/Rate_Limiting

Useful chain:

```text
ISRC
  ↓
MusicBrainz Recording
  ↓
Recording → Work relationship
  ↓
Work MBID
  ├─ ISWC
  ├─ title
  ├─ composer
  └─ lyricist
```

MusicBrainz supports direct ISRC lookup, direct ISWC lookup, Work resources, and Work relationships.

The public service is rate limited and free for non-commercial use. A production commercial workflow needs an appropriate commercial arrangement or licensed-data path.

### 4.2 The MLC

Role: **strong Work + matched-recording authority for covered repertoire**

Official documentation:

- https://www.themlc.com/dataprograms
- https://www.themlc.com/musicalworksdatabasetermsuse

The MLC provides:

- Public Search API;
- BWARM bulk access;
- musical Works;
- parties;
- sound recordings;
- Work↔recording relationships;
- products/releases.

The published Musical Works Database terms allow database data to be used for lawful purposes.

Coverage is not assumed to be globally complete. MLC absence is not evidence that a Work does not exist.

### 4.3 ACRCloud

Role: **high-value Work-resolution aggregator / corroborator**

Official documentation:

- https://docs.acrcloud.com/reference/metadata-api
- https://acrcloud.com/terms/

The Metadata API accepts ISRC and supports:

`include_works=1`

When available, results can include:

- Works;
- ISWC;
- creators;
- composers;
- lyricists;
- IPI;
- cross-provider identities.

Optional provider/platform enrichment can also include album, release-date, genre and cross-platform IDs.

Those optional fields are **not selected by default**.

Production currently has no ACRCloud credential keys configured.

### 4.4 CISAC / ISWC

Role: **highest-strength external Work identifier**

Official documentation:

- https://www.iswc.org/third-parties
- https://www.iswc.org/open-data

Third-party lookup supports:

- ISWC → Work metadata;
- title + contributor → ISWC only when there is a single match.

Returned Work metadata can include:

- title;
- creator names;
- IPI Name Numbers.

Third-party API access is contracted and paid.

The downloadable open-data license is narrower and should only be used within its licensed purpose for Preferred / archived ISWC identification.

### 4.5 DDEX ERN / partner feeds

Role: **first-party supply-chain evidence**

Official standard:

- https://ddex.net/resources-orig/
- DDEX ERN Release Profiles.

For primary resources, ERN rules provide for:

- ISRC;
- identifiers for underlying musical Works, preferably ISWC, when reasonably available;
- Composer;
- Lyricist;
- ComposerLyricist;
- Adapter.

DDEX is a message standard, not a source database. WAKILISHA needs both the DDEX Implementation Licence and legitimate access to each partner feed.

### 4.6 Spotify

Role: **Recording corroboration only**

Official documentation:

- https://developer.spotify.com/documentation/web-api/reference/get-track
- https://developer.spotify.com/terms

Useful current fields include:

- Spotify Track ID;
- ISRC;
- Artist IDs;
- album/release context;
- duration.

The current Web API does not provide the Work identity layer required here.

Spotify developer terms restrict long-term storage and compilation of Spotify Content and require developers to request only data needed for the application.

Accordingly Spotify is not Work authority and optional Spotify enrichment should not be silently persisted.

### 4.7 Apple Music API / MusicKit

Role: **existing retained evidence; not approved as bulk independent Work-registry acquisition**

Official documentation:

- https://developer.apple.com/documentation/musickit/song
- https://developer.apple.com/la/support/terms/apple-developer-program-license-agreement/

Apple technically exposes useful fields such as:

- Apple song identity;
- ISRC;
- `composerName`;
- composers;
- title;
- album;
- genres;
- for classical material, `workName`.

However, the current Apple Developer Program License Agreement ties MusicKit use to facilitating access to end-user Apple Music subscriptions.

Therefore this manifest does not authorize a new bulk Apple Work-registry backfill.

Previously retained Apple IDs and provider observations remain evidence already held by WAKILISHA and can help route/reconcile review.

### 4.8 Apple Music Feed

Role: **blocked for this purpose**

Official documentation:

- https://developer.apple.com/documentation/AppleMusicFeed

Apple explicitly prohibits Feed data from being used to power/enhance internal systems or for music/artist analysis unrelated to promoting Apple Music.

The field manifest blocks Apple Music Feed completely for this programme.

### 4.9 YouTube and SoundCloud

Role: **secondary media / recording corroboration**

Neither is Work authority.

Useful evidence may include:

- media/track identity;
- title;
- uploader/channel;
- duration;
- SoundCloud ISRC when supplied;
- release context.

These sources are optional and are not selected by the default Work-evidence profile unless a field is explicitly needed for Recording identity.

## 5. Field-choice doctrine

Provider payloads commonly contain more fields than a specific Work-resolution run needs.

WAKILISHA must distinguish:

```text
provider can return field
        ≠
WAKILISHA should acquire field
        ≠
WAKILISHA may retain field
        ≠
field may become canonical
```

The default is data minimisation.

### Work Evidence Only

Take only evidence necessary to answer:

- which Recording is this?;
- which Work does it embody?;
- which external Work identifiers support that resolution?;
- who is credited as a Work creator/contributor?;
- which external party identifier supports that contributor?

### Work + Registry Enrichment

Adds separately selected enrichment such as:

- Work language;
- Work type;
- publisher context;
- album/release context;
- release date;
- selected cross-platform identifiers.

### Review All Available

Makes all **policy-eligible** fields visible for operator selection/review.

It still does not acquire policy-blocked fields.

## 6. Provider-source precedence

For Work resolution, preferred evidence order is:

1. direct partner DDEX Work identity / ISWC;
2. CISAC ISWC identity where licensed;
3. MusicBrainz Recording→Work relation with Work MBID / ISWC;
4. MLC Work↔recording match;
5. ACRCloud Work / ISWC / IPI metadata;
6. creator evidence and human reconciliation;
7. provider contributor text without a Work identity.

Spotify, YouTube and SoundCloud do not move a candidate into canonical Work identity by themselves.

Apple retained composer evidence remains supporting evidence, not the acquisition backbone.

## 7. Next executable step

After this read-only package is accepted:

1. add a **read-only MusicBrainz ISRC probe** against a small deterministic Track sample;
2. measure:
   - no Recording match;
   - one Recording / one Work;
   - one Recording / multiple Works;
   - multiple Recording matches;
   - Work with/without ISWC;
   - contributor relationship coverage;
3. add equivalent non-mutating probes for MLC and ACRCloud when access is available;
4. present optional fields before acquisition using the same field manifest;
5. produce an evidence-tier distribution;
6. only then design governed Work creation / Track→Work admission.

No provider probe should write canonical Registry state.

## 8. Deployment classification

For this package:

- SQL migration: **No**
- Preview: **No**
- Edge deployment: **No**
- frontend deployment: **No**
- Production mutation: **No**
- external provider calls in the audit: **No**

The package can be merged after protected CI and the read-only Production report pass.
