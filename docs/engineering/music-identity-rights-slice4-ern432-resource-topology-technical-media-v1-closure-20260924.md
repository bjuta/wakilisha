# Music Identity & Rights Slice 4 ERN 4.3.2 Resource Topology and Technical Media Fidelity v1 Closure

Date: 24 September 2026

Status: **RESOURCE TOPOLOGY / TECHNICAL MEDIA FIDELITY V1 ACCEPTED / NEXT READ-ONLY PROFILE-LEVEL ACCEPTANCE TRANCHE OPEN**

Programme authority:

- issue #1039;
- Slice 4 data dictionary and adapter design PR #1052;
- first-adapter selection PR #1053;
- ERN read-only adapter v1 PR #1054;
- ERN adapter v1 closure PR #1055;
- authoritative ERN 4.3.2 conformance repair PR #1056;
- authoritative conformance closure PR #1057;
- identity evidence fidelity v2 PR #1058;
- identity evidence closure PR #1059;
- resource topology and technical media fidelity v1 PR #1060.

This record closes the third bounded ERN 4.3.2 semantic-fidelity tranche.

## 1. Final repository authority

Implementation PR:

- PR: #1060;
- feature head: `be54fb9a913b475589c640d0f130088c08e1d7ec`;
- merge commit: `3070a825813207a125c5c40ed02a58127dbbbcc9`.

Protected CI:

- PR Critical Control Plane run #1580: PASS;
- merged-main Critical Control Plane run #1581: PASS.

Protected main immediately after the implementation merge:

`3070a825813207a125c5c40ed02a58127dbbbcc9`

## 2. Accepted implementation boundary

The adapter remains read-only.

The adapter envelope version is now:

`3`

The formal ERN authority remains:

- namespace: `http://ddex.net/xml/ern/432`;
- AVS version in reviewed fixtures: `9`;
- exact hash-pinned official ERN 4.3.2 XSD package;
- exact hash-pinned message XSD;
- exact hash-pinned AVS XSD.

No DDEX Production exchange is enabled.

## 3. ResourceGroup topology fidelity

The parser now preserves structured ERN ResourceGroup topology rather than collapsing all descendant references into one flat list.

Preserved topology includes:

- nested `ResourceGroup` hierarchy;
- `ResourceGroupType`;
- ResourceGroup `SequenceNumber`;
- `ResourceGroupContentItem` sequence;
- primary `ReleaseResourceReference`;
- secondary `LinkedReleaseResourceReference`;
- linked-resource attributes including:
  - `LinkDescription`;
  - `LanguageAndScriptCode`;
  - `Namespace`;
  - `UserDefinedValue`;
  - `SequenceNumber`;
  - `IsMultiFile`;
- bounded ResourceGroupContentItem flags:
  - `IsBonusResource`;
  - `IsInstantGratificationResource`;
  - `IsPreOrderIncentiveResource`.

The compatibility `resourceReferences` field remains available, but it is now derived only from primary `ReleaseResourceReference` values.

Linked secondary resources are no longer silently flattened into the primary-resource compatibility view.

## 4. Front-cover relationship correction

The reviewed Audio fixture now models the FrontCoverImage as a secondary linked Release resource.

The prior schema-valid but semantically lossy shape:

- `A1` as `ReleaseResourceReference`;
- `A_IMG1` also as `ReleaseResourceReference`;

has been replaced with:

- `A1` as the primary `ReleaseResourceReference`;
- `A_IMG1` as `LinkedReleaseResourceReference` with `LinkDescription="CoverArt"`.

The corrected fixture remains valid against the exact pinned ERN 4.3.2 XSD.

## 5. Nested and sequenced resource groups

The multiple-recordings fixture now covers nested ResourceGroup hierarchy.

The reviewed structure includes:

- an outer ResourceGroup;
- a nested ResourceGroup with `ResourceGroupType="Component"`;
- explicit group sequence;
- explicit content-item sequence;
- primary references for both SoundRecordings.

This fixture also validates against the exact pinned ERN 4.3.2 XSD.

## 6. Image technical-media evidence

Image technical details are now preserved as structured evidence.

The adapter preserves:

- `TechnicalResourceDetailsReference`;
- structured `File`;
- `File/URI`.

The existing top-level Image `uri` compatibility field remains available, but it is now derived from the structured technical-detail/File/URI projection rather than an arbitrary first descendant URI.

This prevents unrelated descendant URIs from silently becoming the Image media location.

No canonical Registry Media asset is created or bound from this evidence.

## 7. SoundRecording technical-media evidence

SoundRecordingEdition technical details are now preserved.

The adapter preserves:

- `TechnicalResourceDetailsReference`;
- each bounded `DeliveryFile`;
- DeliveryFile `Type`;
- structured `File`;
- `File/URI`.

The reviewed fixture includes an Audio delivery file and validates against the exact pinned ERN 4.3.2 XSD.

This evidence remains source evidence only.

No provider ingestion, object storage mutation, signed URL generation, playback registration, or canonical Media binding is introduced.

## 8. Explicit residual-loss accounting

Valid resource-topology or technical-media child fields outside this bounded projection are no longer silently ignored.

The parser retains the unsupported child names at the structural boundary.

The mapper emits deterministic `partial` loss flags for those fields.

This applies to bounded residual fields inside:

- ResourceGroup;
- ResourceGroupContentItem;
- Image TechnicalDetails;
- Image File;
- SoundRecording TechnicalDetails;
- Audio DeliveryFile;
- Audio File.

This does not imply that every field should be mapped. It makes unsupported valid structure visible and reviewable.

## 9. Fixture and local acceptance

Exact implementation base:

`65845b1c1485c52108e4d67d83e92f19d419cf24`

Accepted candidate hashes:

- `src/services/musicStandards/ern/v432/parser.ts`
  `e86adbdb0939e5a3b5620f3e301346ee850e8ac9fafe011e202c56d234d455c2`;
- `src/services/musicStandards/ern/v432/mapper.ts`
  `f6057cf1edc2d59431c519d673457c6ee5de2d62d5091d38f7d733377cb78fe1`;
- `test/music-standards/ern-v432-readonly-adapter.test.ts`
  `db1482e8518202da3dac78044d339b38c4f62bb7ae42ca3e14e74c9de947070f`;
- `test/music-standards/fixtures/ern-4.3.2/basic-release.xml`
  `f776bb0ac355a33e651d51d21d6ac141d644803fcd0b7e97fe6801b597270ef9`;
- `test/music-standards/fixtures/ern-4.3.2/multiple-recordings.xml`
  `fc75dea52d250b8ee43f98ff2c8c03633b0d26aeb7b5af8369f405fead4dfa27`.

Accepted gates:

- exact five-file scope: PASS;
- no SQL / Edge / frontend / dependency scope: PASS;
- package and lockfile drift: NONE;
- authoritative ERN 4.3.2 XSD validation: PASS;
- static read-only / no-network contract: PASS;
- focused ERN adapter contract: 16/16 PASS;
- full protected critical suite: 35 files / 421 tests PASS;
- full application build: PASS;
- `git diff --check`: PASS;
- exact staged scope: PASS;
- zero unstaged or untracked residue: PASS;
- remote feature tip equals local commit: PASS;
- PR Critical Control Plane #1580: PASS;
- merged-main Critical Control Plane #1581: PASS.

## 10. Authority boundary remains unchanged

This tranche added no canonical mutation capability.

There is still no:

- SQL migration;
- Supabase Preview;
- Supabase Edge Function;
- frontend activation;
- Production data mutation;
- canonical Registry DML;
- canonical Media asset creation or binding;
- provider file ingestion;
- signed URL generation;
- automatic Party identity resolution;
- Deal/commercial semantics;
- rights adjudication;
- royalty or settlement logic;
- DDEX Production exchange.

## 11. Next bounded Slice 4 tranche

The next executable tranche is:

**ERN 4.3.2 profile-level acceptance and residual mapping-loss closure**

This remains read-only.

The purpose is to decide whether the first ERN adapter is sufficiently complete for WAKILISHA's present data-flow needs before expanding into another standard.

Primary audit candidates:

1. formalize which ERN 4.3.2 Release Profiles WAKILISHA claims to accept now;
2. validate profile-level rules that are stricter than XSD validity;
3. prove Audio and any accepted SimpleAudioSingle shape independently;
4. inventory every remaining valid child structure encountered by those accepted profiles;
5. classify each residual field as:
   - mapped;
   - intentionally preserved only as structural evidence;
   - explicitly unsupported with deterministic loss flag;
6. decide whether codec, bitrate, fingerprint, file-size, hash or other technical fields are currently earned by a real WAKILISHA flow;
7. avoid mapping fields merely because ERN permits them;
8. produce a first-adapter closure decision:
   - close ERN 4.3.2 at the current bounded surface; or
   - identify one final evidence-driven read-only gap;
9. keep Deal/commercial semantics separately governed;
10. keep DDEX Production exchange separately governed.

The next tranche must not expand into Media mutation, rights, settlement, commercial availability, or network exchange.

## 12. Deployment classification

For this closure:

- SQL migration: **No**
- Supabase Preview: **No**
- Edge Function: **No**
- frontend activation: **No**
- Production Finish: **No**
- Production data mutation: **No**
- external DDEX network exchange: **No**
- PR type: **documentation-only**
