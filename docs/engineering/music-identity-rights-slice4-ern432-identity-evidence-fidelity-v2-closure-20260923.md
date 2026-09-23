# Music Identity & Rights Slice 4 ERN 4.3.2 Identity Evidence Fidelity v2 Closure

Date: 23 September 2026

Status: **IDENTITY EVIDENCE FIDELITY V2 ACCEPTED / NEXT READ-ONLY RESOURCE TOPOLOGY TRANCHE OPEN**

Programme authority:

- issue #1039;
- Slice 4 data dictionary and adapter design PR #1052;
- first-adapter selection PR #1053;
- ERN read-only adapter v1 PR #1054;
- ERN adapter v1 closure PR #1055;
- authoritative ERN 4.3.2 conformance repair PR #1056;
- authoritative conformance closure PR #1057;
- identity evidence fidelity v2 PR #1058.

This record closes the second bounded ERN 4.3.2 semantic-coverage tranche.

## 1. Final repository authority

Implementation PR:

- PR: #1058;
- feature head: `3ec59b80314d9cb66fcbe6c894d7babb213ee3f7`;
- merge commit: `de84a8a1b00cc6672eb2594b61ddb8bf5fb56df9`.

Protected CI:

- PR Critical Control Plane run #1576: PASS;
- merged-main Critical Control Plane run #1577: PASS.

Protected main immediately after the implementation merge:

`de84a8a1b00cc6672eb2594b61ddb8bf5fb56df9`

## 2. Accepted implementation boundary

The adapter remains read-only.

The v2 semantic fidelity tranche now preserves the following ERN 4.3.2 message context:

- `AvsVersionId`;
- `ReleaseProfileVersionId`;
- `ReleaseProfileVariantVersionId`;
- `LanguageAndScriptCode`.

The adapter envelope version is now:

`2`

The namespace and formal schema authority remain unchanged:

`http://ddex.net/xml/ern/432`

The permanent hash-pinned ERN 4.3.2 XSD verifier introduced in the previous tranche remains authoritative.

## 3. Party identifier evidence

The parser now preserves Party identifier evidence for:

- ISNI;
- DPID;
- IPI name number;
- IPN;
- CISAC society ID;
- proprietary identifiers, including their Namespace attribute.

This evidence remains evidence only.

The mapper does not infer or create:

- Person identity;
- Organisation identity;
- Artist identity;
- Label identity;
- canonical WAKILISHA UUIDs.

Recognized WAKILISHA dictionary mappings remain bounded:

- ISNI -> `isni`;
- DPID -> `ddex_party_id`;
- IPI name number -> `ipi`;
- IPN -> `ipn`.

Recognized Party identifier evidence is marked `review_required` because typed identity resolution remains separately governed.

CISAC society IDs and proprietary identifiers are preserved but currently have no direct music-data-dictionary/v1 canonical scheme mapping. Those are explicitly loss-flagged rather than discarded.

## 4. Sound Recording evidence fidelity

The parser now preserves:

- SoundRecording `Type`;
- SoundRecording `Duration`;
- every `SoundRecordingEdition`;
- each edition `Type`;
- every edition `ResourceId`;
- `ResourceId@IsReplaced`;
- ISRC;
- namespaced CatalogNumber;
- namespaced ProprietaryId.

The previous first-ISRC-only collapse is retired.

Every preserved ISRC is emitted as Track identifier evidence under the existing `isrc` scheme.

CatalogNumber and ProprietaryId remain preserved source evidence and receive explicit partial-loss flags because there is no direct first-tranche Track identifier mapping for them.

No Track UUID is created or inferred.

## 5. Release identifier evidence fidelity

The parser now preserves Release identifier evidence for:

- GRid;
- ICPN;
- namespaced CatalogNumber;
- namespaced ProprietaryId.

ICPN retains the existing:

`ICPN -> gtin`

mapping.

GRid, CatalogNumber and ProprietaryId remain preserved evidence and are explicitly loss-flagged where the current WAKILISHA dictionary has no direct Release identifier mapping.

No Release UUID is created or inferred.

## 6. Mapping-loss behavior

The adapter now reports more granular evidence-loss conditions inside otherwise valid ERN structures.

Examples include:

- Party identifier schemes that are retained but do not have a direct WAKILISHA dictionary mapping;
- recognized Party identifier schemes that still require typed identity review;
- recording CatalogNumber and ProprietaryId evidence;
- Release GRid, CatalogNumber and ProprietaryId evidence.

This extends the earlier unsupported-top-level-section model without changing Deal/commercial semantics.

Mapping-loss reporting remains deterministic for identical bytes and mapping profile.

## 7. Fixture coverage

The authoritative fixture set remains schema-valid under the exact pinned official ERN 4.3.2 XSD.

The enriched fixtures now cover:

- Audio profile signalling;
- Release profile variant signalling;
- language/script context;
- Party ISNI and DPID;
- Party IPI name number and IPN;
- CISAC society and proprietary Party identifiers;
- multiple SoundRecording editions;
- multiple ResourceIds;
- `IsReplaced`;
- multiple ISRC observations for one SoundRecording;
- recording CatalogNumber and ProprietaryId;
- Release GRid, ICPN, CatalogNumber and ProprietaryId.

The Deal fixture remains structurally valid while Deal semantics remain unsupported.

## 8. Final local acceptance receipt

Exact base:

`fc9dbdcfa578af2c811933e02cf61e66e8629b62`

Accepted candidate hashes:

- `src/services/musicStandards/ern/v432/parser.ts`
  `954bbb135c9d4b4c3bd0c7f420b3a9387b57aeccfca33b30cc9fd6a06fc2028a`;
- `src/services/musicStandards/ern/v432/mapper.ts`
  `3cabc0a7b673e241799da28c5e280a6fd1e9e76527fd64f7fa7867d26dbbae0b`;
- `test/music-standards/ern-v432-readonly-adapter.test.ts`
  `2f0bc96343c113c9eece5d435bf567102c4c145ea238c7427919fd4f8b2a8225`;
- `test/music-standards/fixtures/ern-4.3.2/basic-release.xml`
  `76e00cf1f9178540531b9806d94a0bb538a6e023b123e221301b552804b8e41d`;
- `test/music-standards/fixtures/ern-4.3.2/multiple-recordings.xml`
  `881c6018ebdc64825b8759ab00029a0a02b0eef0003a66f2a396bba6af6456ef`.

Accepted gates:

- exact five-file scope: PASS;
- no SQL / Edge / frontend / dependency scope: PASS;
- package and lockfile drift: NONE;
- authoritative ERN 4.3.2 XSD validation: PASS;
- static read-only / no-network contract: PASS;
- focused ERN adapter contract: 14/14 PASS;
- full protected critical suite: 35 files / 419 tests PASS;
- full application build: PASS;
- `git diff --check`: PASS;
- exact staged scope: PASS;
- zero unstaged or untracked residue: PASS;
- remote feature tip equals local commit: PASS;
- PR Critical Control Plane #1576: PASS;
- merged-main Critical Control Plane #1577: PASS.

## 9. Authority boundary remains unchanged

This tranche added no canonical mutation capability.

There is still no:

- SQL migration;
- Supabase Preview;
- Supabase Edge Function;
- frontend activation;
- Production data mutation;
- canonical Registry DML;
- automatic identity resolution from Party identifiers;
- DDEX Production exchange;
- CWR export;
- identifier registration;
- rights adjudication;
- Deal/commercial semantics;
- royalty or settlement logic.

## 10. Next bounded Slice 4 tranche

The next executable tranche is:

**ERN 4.3.2 resource topology and technical media fidelity**

This remains read-only.

Primary audit and implementation candidates:

1. preserve `ResourceGroup` ordering and nested relationship semantics;
2. preserve `ReleaseResourceReference` and `LinkedReleaseResourceReference` distinctly;
3. preserve technical-resource references without conflating them with presentation URLs;
4. preserve Image and SoundRecording technical-detail references;
5. preserve resource-sequence information needed by the Audio and SimpleAudioSingle profiles;
6. add explicit mapping-loss flags for valid resource-topology structures not yet represented by the WAKILISHA adapter;
7. keep Media asset canonical binding separately governed;
8. keep Deal/commercial semantics unsupported;
9. keep Production DDEX exchange outside this tranche.

The next tranche should not expand into rights, settlement, commercial availability, or canonical Media mutation.

## 11. Deployment classification

For this closure:

- SQL migration: **No**
- Supabase Preview: **No**
- Edge Function: **No**
- frontend activation: **No**
- Production Finish: **No**
- Production data mutation: **No**
- external DDEX network exchange: **No**
- PR type: **documentation-only**
