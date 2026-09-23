# Music Identity & Rights — Slice 3 Read-Only Metadata Acquisition Reports

Date: 23 September 2026

Status: **READ-ONLY REPORTING PACKAGE — NO BACKFILL OR PRODUCTION MUTATION**

Programme authority:

- issue #1039 — `Music Identity & Rights Foundation — UUID Charts, Works, Contributions, Rights`;
- `docs/engineering/wakilisha-music-data-standards-foundation.md`;
- Slice 2 Production authority on protected main:
  `80e5c62ab49bcb5b9ef0bf826471690f31634884`.

## 1. Purpose

Slice 3 begins with retained evidence, not network acquisition and not canonical
mutation.

The first executable package is therefore three read-only candidate reports that
answer:

1. which provider identifiers are already retained and which assignments are
   unambiguous versus duplicated;
2. which Release label strings exactly match existing Label/Organisation
   authority and which Apple Music composer strings are already retained for
   review;
3. which existing artwork URLs can reuse an already-active Registry Media asset
   by exact URL identity.

The reports do not:

- create or update Registry entities;
- create Works or Contributions;
- create external identifier assertions;
- link Releases to Labels;
- link composers to People;
- fetch provider/network data;
- use fuzzy name matching;
- infer rights;
- rewrite media bindings.

## 2. Durable report package

### 2.1 Provider identifier candidates

`scripts/control-plane/report-music-metadata-provider-identifiers.sql`

Reads provider identifiers retained in Registry metadata for:

- Track Apple Music IDs;
- Artist Apple Music IDs;
- Artist Spotify IDs from the two existing metadata keys;
- Release Apple Music album IDs.

The report deduplicates cases where one canonical entity stores the same
identifier under more than one legacy metadata key.

Each source value is classified as:

- `deterministic_candidate` when it is assigned to exactly one WAKILISHA UUID
  for that entity type and scheme;
- `review_only_duplicate_assignment` when the same provider value is assigned
  to more than one WAKILISHA UUID.

This classification does not itself authorize promotion. WAKILISHA UUID remains
canonical identity.

### 2.2 Release label and composer evidence

`scripts/control-plane/report-music-metadata-label-composer-candidates.sql`

The Release-label report reads `registry_releases.metadata.record_label`.

Matching is deliberately narrow:

- trim surrounding whitespace;
- collapse repeated whitespace;
- compare case-insensitively;
- do not remove punctuation;
- do not use trigram, edit-distance, embedding, or other fuzzy matching.

Rows are classified as:

- `exact_label_candidate`;
- `review_only_unmatched`;
- `review_only_ambiguous`.

The composer report reads retained Apple Music
`raw_payload.data[0].attributes.composerName` evidence.

`provider_field_observations` preserves the same raw provider payload beside
several typed field observations. The report therefore deduplicates composer
evidence by provider item + raw composer string so a reviewer sees one
source-level candidate rather than repeated field rows.

Composer strings remain:

`review_only_raw_composer_evidence`

The report does not split names or guess Person identity.

### 2.3 Media reuse candidates

`scripts/control-plane/report-music-metadata-media-reuse-candidates.sql`

Reads current:

- Release `artwork_url`;
- Track `artwork_url`;
- Artist `public_image_url`.

The only reuse match is exact URL equality against an active
`registry_media_assets.url`.

Rows are classified as:

- `already_typed`;
- `exact_url_reuse_candidate`;
- `review_only_no_existing_asset`;
- `review_only_multiple_exact_assets`.

No fuzzy URL, title, filename, or image-similarity inference is used.

## 3. Read-only contract

All three reports:

- begin with `begin transaction read only`;
- end with `rollback`;
- contain no mutating SQL;
- contain no network/http invocation.

The permanent contract test is:

`test/registry/music-metadata-slice3-readonly-reports.test.ts`

It is included in `npm run test:critical`.

## 4. Production audit snapshot

The counts below are an audit snapshot from 23 September 2026. They are not
hard-coded thresholds in the report scripts.

### 4.1 Provider identifiers

After collapsing duplicate legacy metadata keys on the same canonical entity:

| Entity / scheme | Assignments | Distinct values | Deterministic rows | Review rows |
| --- | ---: | ---: | ---: | ---: |
| Artist / Apple Music | 308 | 307 | 306 | 2 |
| Artist / Spotify | 451 | 446 | 441 | 10 |
| Release / Apple Music | 842 | 841 | 840 | 2 |
| Track / Apple Music | 2,399 | 2,289 | 2,188 | 211 |

A deterministic row means one provider value currently points to one canonical
UUID in retained metadata. It remains evidence until a later governed promotion
path is accepted.

Duplicate provider assignments are review-only and must not be globally
canonicalized from these reports.

### 4.2 Release labels

Production currently contains:

- 842 Releases with nonblank `record_label` metadata;
- 230 distinct retained label strings;
- 524 Releases with one exact existing Registry Label match under
  case/whitespace-only normalization;
- 0 Releases with an exact Organisation `display_name` match under the same
  normalization.

The absence of an exact Organisation match is not evidence that no Organisation
relationship exists. It only means retained Release label text does not
deterministically establish one.

### 4.3 Composer evidence

Apple Music raw payloads currently contain:

- 891 provider-field observation rows carrying `composerName`;
- 50 distinct provider-item/composer pairs after source-level deduplication;
- 49 distinct raw composer strings.

This is sufficient evidence to build a review queue later. It is not sufficient
to infer Person identity, Work identity, or Work Contribution rows
automatically.

### 4.4 Existing media

Current direct artwork/image coverage includes:

- 842 Release artwork URLs;
- 2,452 Track artwork URLs;
- 170 Releases already carrying a typed `artwork_image_id`;
- 306 Tracks already carrying a typed `artwork_image_id`;
- 307 Artists already carrying a typed `public_image_id`.

Exact-active-URL reuse candidates found by the report:

- 1 Artist;
- 251 Tracks;
- 0 Releases at this snapshot.

Rows without an exact existing asset remain review-only/no-existing-asset.
No new asset is created by this package.

## 5. Interpretation

The audit proves that meaningful metadata improvement can begin from evidence
already retained inside WAKILISHA.

The next backfill design does not need to start with a provider scrape.

The strongest current opportunities are:

1. deterministic provider-ID assertions, excluding duplicate assignments;
2. exact Release-to-Label review candidates;
3. composer evidence review based on retained Apple payloads;
4. exact-URL Media reuse candidates.

But these remain distinct domains:

- provider identifier assertion;
- Label/Organisation reconciliation;
- Work/Contribution reconciliation;
- Media binding.

One generic backfill mutation is not justified.

## 6. Scope locks

This Slice 3 reporting package must not be interpreted as authority to:

- auto-promote provider IDs;
- merge Registry entities from provider IDs;
- create Person rows from composer strings;
- create Work or Contribution rows from composer strings;
- link Releases to Labels from fuzzy name matching;
- create Organisation identity from label text;
- overwrite current artwork bindings;
- create Media assets from URL presence alone;
- run external network acquisition;
- mutate Production.

Any later promotion/backfill implementation must define a separate governed
write path with provenance, review, exact expected-state protection, and
independent verification.

## 7. Exit for the reporting sub-slice

The read-only reporting sub-slice is complete when:

- all three report files execute successfully against current Production;
- the contract test proves the package stays read-only and non-fuzzy;
- protected CI passes;
- the engineering record is merged.

No Preview is required because there is no schema or runtime mutation.

## 8. Deployment classification

For this package:

- SQL migration needed: **No**
- Supabase Preview needed: **No**
- Supabase Edge Function deploy needed: **No**
- frontend deploy needed: **No**
- Production Finish update needed: **No**
- Production mutation: **No**

The next Slice 3 step, if separately accepted, is to design governed promotion
paths from these reports rather than mutating directly from retained evidence.
