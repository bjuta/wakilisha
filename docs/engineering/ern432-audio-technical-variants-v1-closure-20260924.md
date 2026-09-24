# ERN 4.3.2 Audio Technical Variants v1 Closure

Date: 24 September 2026

Status: **CLOSED / READ-ONLY TECHNICAL VARIANT EVIDENCE ACCEPTED**

Issue authority:

- issue #1065, `ERN 4.3.2 audio technical variants — preserve premium delivery evidence`.

Implementation authority:

- implementation PR #1066;
- final feature head: `9ee40ff2f26e3627d7ae6742c1fd04f5459c9475`;
- merge commit: `82b11d34ae7b222b9bc3f0cd741a58c4c88316b5`;
- PR Critical Control Plane #1592: PASS;
- merged-main Critical Control Plane #1593: PASS.

Protected main immediately after implementation merge:

`82b11d34ae7b222b9bc3f0cd741a58c4c88316b5`

## 1. Purpose

This tranche was opened after the Music Identity & Rights Foundation programme closed because a concrete product need was identified.

A distributor ERN 4.3.2 feed may contain multiple technical sound-delivery files for one SoundRecording edition, including higher-resolution and immersive/spatial alternatives.

WAKILISHA must not collapse those delivery variants to the first file or discard the technical evidence needed for future product badging, routing or playback policy.

The goal of this tranche is evidence preservation only.

It does not authorize Production DDEX ingestion, Registry mutation, media ingestion or product-tier classification.

## 2. Accepted adapter boundary

The ERN adapter envelope version is now:

`5`

The parser continues to preserve every `SoundRecordingEdition`.

For each edition it preserves every `TechnicalDetails` block.

For each technical-details block it preserves every `DeliveryFile` independently and in source order.

There is no first-file selection or collapse.

## 3. TechnicalDetails evidence now retained

For each accepted SoundRecording technical-details block, the adapter retains:

- `TechnicalResourceDetailsReference`;
- `LanguageAndScriptCode`;
- `ApplicableTerritoryCode`;
- `IsDefault`;
- `HasImmersiveAudioMetadata`;
- ordered `DeliveryFile` evidence;
- unsupported residual child names.

The ERN 4.3.2 XSD shape is respected.

In particular, `ApplicableTerritoryCode` is read as the XML attribute defined by the accepted schema.

## 4. DeliveryFile evidence now retained

For every audio `DeliveryFile`, the adapter retains:

- `Type`;
- `AudioCodecType`;
- codec namespace;
- codec user-defined value;
- `BitRate` value;
- bitrate unit;
- `NumberOfChannels`;
- `NumberOfAudioObjects`;
- `SamplingRate` value;
- sampling-rate unit;
- `BitsPerSample`;
- `BitDepth`;
- existing File/URI evidence;
- `IsProvidedInDelivery`;
- unsupported residual child names.

No codec normalization or provider-specific codec rewrite is introduced.

## 5. Immersive/spatial evidence decision

WAKILISHA does not infer spatial or immersive audio from codec or bitrate.

The retained ERN field:

`HasImmersiveAudioMetadata`

is the standards evidence for immersive-audio metadata.

The adapter does not create an `is_spatial` field.

A future product surface may derive a badge or routing decision from reviewed retained evidence, but that policy is outside the ingestion parser.

## 6. High-resolution evidence decision

The adapter does not invent a universal `audio_tier` or high-resolution threshold.

High-resolution product classification may depend on some combination of:

- codec;
- sampling rate;
- bit depth;
- bitrate;
- delivery status;
- provider policy;
- future WAKILISHA product policy.

Those facts are now retained so such a policy can be introduced later without reparsing source messages or rebuilding the evidence model.

The parser itself remains standards-evidence code, not product-policy code.

## 7. Multiple-delivery-file proof

The accepted fixture now contains:

- one non-immersive edition with two independent DeliveryFiles;
- one immersive edition with its own DeliveryFile.

The non-immersive edition proves independent retention of:

- FLAC, 2304 kbps, 96 kHz, 24-bit delivery;
- AAC, 320 kbps, 48 kHz, 24-bit delivery.

The immersive edition proves:

- explicit `HasImmersiveAudioMetadata=true`;
- user-defined Dolby codec evidence;
- channel/object evidence;
- independent file URI evidence.

The permanent focused contract proves that the two delivery files remain distinct and ordered.

## 8. Registry persistence boundary

This tranche does not write technical evidence into `public.registry_tracks`.

It adds no new Registry column.

The existing Registry Track metadata extension surface remains available for a future governed Production ingestion/runtime tranche if Product needs a canonical accepted technical snapshot.

Any such future write must separately define:

- exact accepted source evidence;
- the governed Track mutation authority;
- stale-state protection;
- review/admission rules where required;
- canonical metadata key shape;
- verification;
- rollback and audit behavior.

Direct parser-to-Registry DML remains prohibited.

## 9. No premium-asset ingestion yet

This tranche preserves technical references and facts only.

It does not:

- download distributor files;
- ingest premium audio binaries;
- create Registry Media assets;
- bind media assets to Tracks;
- generate signed URLs;
- choose a preferred playback variant;
- route premium playback;
- expose a product badge.

Those are separate runtime/product concerns.

## 10. Validation

The accepted candidate was validated at exact feature head:

`9ee40ff2f26e3627d7ae6742c1fd04f5459c9475`

Local validation proved:

- exact five-file implementation scope;
- no package/dependency drift;
- no SQL, Edge or frontend scope;
- official hash-pinned ERN 4.3.2 XSD validation: PASS;
- bounded Audio profile verifier: PASS;
- technical audio variant verifier: PASS;
- focused ERN adapter contract: 21/21 PASS;
- protected critical suite: 35 files / 426 tests PASS;
- performance/icon audit: PASS;
- Lucide sprite remains 316 icons;
- full application build: PASS;
- zero post-test worktree residue.

Protected GitHub validation then proved:

- PR Critical Control Plane #1592: PASS;
- merged-main Critical Control Plane #1593: PASS.

## 11. Exact implementation scope

The accepted implementation touched exactly five files:

- `scripts/music-standards/verify-ern432-authoritative-conformance.sh`;
- `src/services/musicStandards/ern/v432/mapper.ts`;
- `src/services/musicStandards/ern/v432/parser.ts`;
- `test/music-standards/ern-v432-readonly-adapter.test.ts`;
- `test/music-standards/fixtures/ern-4.3.2/basic-release.xml`.

No SQL migration, Supabase Edge Function, frontend file or dependency file was part of the implementation.

## 12. Explicitly excluded scope

This tranche does not reopen or add:

- SimpleAudioSingle;
- Classical or BoxSet variants;
- CWR;
- RIN;
- RDR;
- MWN/BWARM;
- ECM;
- Deal/commercial semantics;
- DDEX Production exchange;
- canonical Registry mutation;
- provider file ingestion;
- Media asset creation/binding;
- product badge UI;
- premium playback routing.

Those require separate evidence-driven needs.

## 13. Closure decision

The information-loss problem identified in #1065 is closed.

The ERN 4.3.2 read-only adapter now preserves the premium-audio technical variant evidence required for future product decisions without collapsing multiple delivery files and without prematurely converting standards evidence into product policy or canonical mutation.

Decision:

**close #1065 after this closure record merges and merged-main Critical Control Plane passes.**

## 14. Deployment classification

For this closure:

- SQL migration: **No**
- Supabase Preview: **No**
- Edge Function: **No**
- frontend activation: **No**
- Production Finish: **No**
- Production data mutation: **No**
- external DDEX network exchange: **No**
- PR type: **documentation-only**
