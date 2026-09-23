# Music Identity & Rights Slice 4 First Adapter Selection

Date: 23 September 2026

Status: **READ-ONLY NEED AUDIT / FIRST IMPLEMENTATION BOUNDARY SELECTED**

Programme authority:

- issue #1039;
- `docs/engineering/wakilisha-music-data-dictionary-v1.md`;
- `docs/engineering/music-identity-rights-slice4-standards-adapter-contracts-20260923.md`;
- protected main at audit open: `8df9110d1970843dd6bc9f50376b6969657778af`.

This audit selects the first executable Slice 4 adapter from current WAKILISHA product/data-flow evidence. It does not authorize a Production network integration or canonical writer.

## 1. Decision

The first executable Slice 4 adapter is:

**DDEX ERN 4.3.2 read-only mapping harness**

The first tranche is deliberately limited to:

- local/golden ERN fixtures;
- parser and structural validation;
- WAKILISHA adapter envelope;
- deterministic semantic mapping into `music-data-dictionary/v1`;
- explicit mapping-loss diagnostics;
- no canonical mutation;
- no Supabase write;
- no network exchange;
- no DDEX production messaging.

## 2. Why ERN is first

The current WAKILISHA retained music-data surface is already dominated by release/resource/provider metadata that maps naturally to ERN concepts.

Current Production Registry metadata includes:

### Releases

- 842 Releases with `apple_music_album_id`;
- 842 Releases with `apple_music_url`;
- 842 Releases with `genre_names`;
- 842 Releases with `record_label`;
- 842 Releases with retained source metadata.

### Tracks

- 2,399 Tracks with `apple_music_track_id`;
- 2,067 Tracks with `apple_music_album_id`;
- 405 Tracks with `apple_music_catalog_id`;
- existing ISRC authority on active Tracks;
- current provider/resource presentation paths for artwork and playback identity.

### Retained provider field observations

The current observation surface already includes Apple Music fields such as:

- `title`;
- `artist_names`;
- `duration_ms`;
- `genre`;
- `release_title`;
- `release_date`;
- `release_date_precision`;
- `disc_number`;
- `track_number`;
- `isrc`;
- `explicit`;
- `track_artwork_url`;
- `release_artwork_url`;
- `provider_url`.

Spotify observations also retain fields including:

- title;
- artist names;
- ISRC;
- UPC;
- label name;
- release title/date;
- artwork;
- provider URL.

This is much closer to ERN's Release, SoundRecording resource, Display Artist, contributor, identifier, label, artwork and release metadata surface than to the other candidate standards.

## 3. Existing repository seams ERN can exercise without new authority

The repository already contains:

- provider ingestion and enrichment;
- `provider_field_observations`;
- `provider_entity_links`;
- `registry_track_provider_links`;
- exact external identifier assertion admission;
- exact Release-to-Label admission;
- exact Track/Artist Media-asset binding;
- Track/Release/Artist canonical UUID authority;
- read-only public and admin projections;
- retained raw provider payloads.

An ERN harness can therefore prove standards mapping against domain concepts that WAKILISHA already understands without inventing Work, Contribution, or Rights data.

## 4. Why RIN is not first

RIN is the better standard for studio-session provenance, contributors, instruments, engineers, recording components, and early recording metadata.

WAKILISHA currently retains only a narrow composer observation seam from provider payloads and does not yet have a populated canonical:

- Work catalogue;
- Track Contribution catalogue;
- Work Contribution catalogue;
- recording-component/stem authority.

Current Production counts remain:

- Works: 0;
- Track-to-Work links: 0;
- Track Contributions: 0;
- Work Contributions: 0.

Selecting RIN first would therefore force the harness to model mostly hypothetical data rather than current WAKILISHA flow.

RIN remains a later Slice 4 adapter once WAKILISHA has a real studio/contributor intake use case or retained RIN-shaped source data.

## 5. Why RDR is not first

RDR is the correct family for recording-side rights, performers, mandates, claims and claim conflicts.

Current Production has:

- Rights Claims: 0.

The Rights Claim schema correctly exists as authority, but there is not yet a live rights-claim ingestion flow that would justify making RDR the first executable mapping harness.

RDR remains important and should be implemented when WAKILISHA has a concrete neighbouring-rights intake/exchange need.

## 6. Why MWN/BWARM is not first

MWN and BWARM are strong fits for Musical Work, writers, publishers, Work right shares, Work-to-Recording references and related identifiers.

Current Production has:

- Works: 0;
- Track-to-Work links: 0;
- Work Contributions: 0;
- Rights Claims: 0.

Slice 3 deliberately left provider `composerName` evidence review-only because raw contributor strings do not establish Work or Person identity.

Starting with MWN/BWARM would therefore put adapter breadth ahead of earned canonical data.

## 7. Why ECM is not first

ECM is highly relevant for duplicate-identifier and cluster evidence.

However, WAKILISHA already has:

- UUID canonical identity;
- identity lineage;
- external identifier assertion authority;
- duplicate repair governance;
- no current need to accept external cluster statements as a product flow.

ECM should later map into evidence/review, not direct merge authority.

It is not the best first harness for exercising the broad current Release/Track/provider data surface.

## 8. ERN 4.3.2 first-tranche mapping scope

The first harness should support only a bounded subset required to prove the adapter architecture.

### Required source concepts

- NewReleaseMessage or a minimal equivalent ERN 4.3.2 fixture structure;
- Release;
- SoundRecording resource;
- DisplayArtistName;
- DisplayArtist;
- Contributor where present;
- ISRC;
- product identifier where present;
- Release label text;
- Release/resource title;
- release date;
- genre where represented;
- artwork/image reference where represented.

### Required WAKILISHA mapped output

The harness must emit:

- adapter envelope;
- Release candidate descriptor;
- Track candidate descriptor;
- Artist/display evidence;
- contributor evidence without automatic Person/Contribution creation;
- external identifier candidates;
- label evidence;
- Media-reference evidence;
- mapping-loss flags.

It must not emit a canonical mutation command.

## 9. First-tranche non-goals

Do not implement in the first harness:

- ERN deal/commercial terms;
- pricing;
- availability windows;
- takedowns;
- territorial commercial rights;
- royalty/reporting flows;
- network delivery choreography;
- cloud-storage choreography;
- DDEX implementation credentials;
- Registry writes;
- Work creation;
- Person creation;
- Contribution creation;
- Rights Claim creation;
- Label creation;
- Media Asset creation.

Those remain separate future requirements.

## 10. Deterministic fixture matrix

The first implementation must contain local fixtures proving:

1. one Release with one SoundRecording;
2. one Release with multiple SoundRecordings;
3. one SoundRecording referenced by ISRC;
4. product identifier mapped to Release evidence;
5. DisplayArtistName retained separately from typed DisplayArtist;
6. Contributor retained separately from Display Artist;
7. unknown contributor party fails into review/evidence rather than identity creation;
8. unsupported ERN version fails closed;
9. malformed XML/structure fails closed;
10. omitted optional values remain omitted rather than defaulted;
11. unsupported Deal content is explicitly loss-flagged;
12. deterministic repeat parse/mapping yields identical output;
13. no parser/mapper path performs database DML or network access.

## 11. Adapter implementation shape

Preferred repository shape:

```text
src/services/musicStandards/
  contracts.ts
  ern/
    v432/
      parser.ts
      mapper.ts

test/music-standards/
  fixtures/ern-4.3.2/
  ern-v432-readonly-adapter.test.ts
```

The exact file names may adjust to existing repository conventions, but the boundary must remain one standards service and one ERN versioned adapter.

Avoid:

- Edge Function first;
- database function parser;
- generic "standards engine";
- generic JSON-to-table mutation;
- standard-specific persistence tables.

## 12. Parsing dependency rule

Before adding any XML dependency, implementation must inspect current repository dependencies.

If an existing safe XML parser is already present, reuse it.

If not, adding one dependency is permissible only when:

- it is narrowly scoped to parsing;
- package-lock changes are reviewed;
- no transitive dependency materially expands browser/runtime authority;
- the adapter remains server/test-side where appropriate;
- the library does not perform network access.

Do not hand-roll a general XML parser.

## 13. Acceptance gate

The first ERN harness is accepted only when:

- all fixtures run locally;
- deterministic mapping tests pass;
- unsupported/malformed input fails closed;
- no network access exists;
- no database mutation exists;
- no Supabase migration is added;
- no new Edge Function is added;
- no frontend path depends on the adapter;
- full protected critical CI passes;
- application build passes if code is included in the app bundle;
- the resulting adapter contract remains subordinate to `music-data-dictionary/v1`.

## 14. Deployment classification

For this selection record:

- SQL migration: **No**
- Supabase Preview: **No**
- Edge Function: **No**
- frontend deployment: **No**
- Production Finish: **No**
- Production mutation: **No**
- network integration: **No**
- PR type: **documentation-only**

The next action after this selection is implementation of the ERN 4.3.2 read-only local/golden-fixture harness from exact protected main.
