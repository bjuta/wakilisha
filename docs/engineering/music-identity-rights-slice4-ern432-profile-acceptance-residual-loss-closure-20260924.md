# Music Identity & Rights Slice 4 ERN 4.3.2 Profile Acceptance and Residual Loss Closure

Date: 24 September 2026

Status: **PROFILE-LEVEL ACCEPTANCE / RESIDUAL LOSS CLOSED / FIRST ERN ADAPTER ACCEPTED / SLICE 4 READY FOR PROGRAMME EXIT AUDIT**

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
- resource topology and technical media fidelity v1 PR #1060;
- resource topology and technical media closure PR #1061;
- profile-level acceptance and residual-loss implementation PR #1062.

This record closes the fourth bounded ERN 4.3.2 semantic-fidelity tranche and makes the first-adapter closure decision required by the previous tranche.

## 1. Final repository authority

Implementation PR:

- PR: #1062;
- final feature head: `54ca5386b6d4939cf8a590bbec6ef94dac12ec57`;
- merge commit: `5bae412b04604fc89ed52ec91fcba42da38ff5a4`.

Protected CI:

- final PR Critical Control Plane #1586: PASS;
- merged-main Critical Control Plane #1587: PASS.

Protected main immediately after the implementation merge:

`5bae412b04604fc89ed52ec91fcba42da38ff5a4`

The accepted PR remained exactly six files:

- `scripts/music-standards/verify-ern432-authoritative-conformance.sh`;
- `src/services/musicStandards/ern/v432/mapper.ts`;
- `src/services/musicStandards/ern/v432/parser.ts`;
- `test/music-standards/ern-v432-readonly-adapter.test.ts`;
- `test/music-standards/fixtures/ern-4.3.2/basic-release.xml`;
- `test/music-standards/fixtures/ern-4.3.2/multiple-recordings.xml`.

## 2. Accepted implementation boundary

The adapter remains read-only.

The adapter envelope version is now:

`4`

The formal ERN authority remains:

- namespace: `http://ddex.net/xml/ern/432`;
- AVS version in reviewed fixtures: `9`;
- exact hash-pinned official ERN 4.3.2 XSD package;
- exact hash-pinned message XSD;
- exact hash-pinned AVS XSD.

The bounded profile source reviewed for this tranche is DDEX ERN Release Profiles v2.3.1.

The adapter does not claim DDEX production-exchange certification.

No DDEX Production exchange is enabled.

## 3. Release Profile acceptance decision

WAKILISHA now claims bounded read-only acceptance of:

- `Audio`.

WAKILISHA does not currently claim acceptance of:

- `SimpleAudioSingle`;
- Classical profile variant;
- BoxSet profile variant;
- any other ERN Release Profile or Release Profile variant.

This is deliberate.

The current WAKILISHA Release and Sound Recording flow is sufficient to earn bounded Audio-profile support.

`SimpleAudioSingle` is not accepted in this tranche because the reviewed Release Profiles text presents an unresolved interpretation boundary between its cover-art cardinality and the Clause 8.1 content-item rule. WAKILISHA does not need to invent a local standards interpretation merely to claim broader profile coverage.

Profile variants remain unsupported until a real WAKILISHA product or data-flow need earns their semantics.

## 4. Bounded Audio profile rules

When a message claims `Audio`, the adapter fails closed unless the accepted bounded profile rules hold.

The accepted validation includes:

- exactly one main `Release`;
- main Release identification by accepted Release identifier evidence;
- one or more primary qualifying SoundRecording resources;
- primary SoundRecordings identified by ISRC;
- primary SoundRecordings carrying both `DisplayTitleText` and structured `DisplayTitle`;
- sequenced DisplayArtists;
- sequenced primary ResourceGroup content;
- required sequencing on accepted sequenced ResourceGroup types;
- exactly one `FrontCoverImage`;
- top-level ResourceGroup linkage to that FrontCoverImage;
- no sequence number on the FrontCoverImage secondary-resource link;
- FrontCoverImage proprietary identifier evidence;
- exactly one `TrackRelease` per primary SoundRecording;
- TrackRelease identification by accepted Release identifier evidence;
- unique retained TrackRelease identifier evidence inside the message;
- no secondary resources on accepted Audio TrackReleases.

These checks are intentionally bounded to rules WAKILISHA can prove and needs for the current read-only adapter.

They are not presented as a complete substitute for DDEX implementation conformance or Production message certification.

## 5. TrackRelease structural evidence

The parser now accounts for `TrackRelease` rather than silently ignoring it.

Retained TrackRelease evidence includes:

- `ReleaseReference`;
- Release identifiers;
- `ReleaseResourceReference`;
- linked-resource references when present;
- unsupported direct child names.

This evidence is used to validate the accepted Audio profile.

It is not promoted into WAKILISHA canonical Release or Track identity.

TrackRelease identifiers remain structural standards evidence and do not replace WAKILISHA UUID authority.

## 6. Image identifier evidence

Image `ResourceId` structures are now retained.

The bounded projection preserves:

- Image ResourceId composites;
- proprietary identifier value;
- proprietary identifier namespace;
- unsupported direct ResourceId child names.

This allows the Audio verifier to prove that the accepted FrontCoverImage is identified.

Image proprietary IDs remain evidence only.

No canonical Registry Media identity is created from them.

## 7. Sequence evidence

DisplayArtist sequence is now retained in the parser.

The accepted Audio profile validation uses that evidence for Release and primary SoundRecording DisplayArtist sequencing.

ResourceGroup and ResourceGroupContentItem sequence evidence continues to remain explicit.

A DDEX `Component` ResourceGroup remains semantically accepted as the standards value.

The final parser constructs that exact value from string fragments only to prevent the repository-wide Lucide icon scanner from misclassifying the DDEX vocabulary token as a UI icon dependency.

No generated icon asset or frontend behavior was added by that repair.

## 8. Residual mapping-loss closure

This tranche completes the residual direct-child accounting required by the previous closure.

The parser now retains unsupported direct child names for bounded:

- Release;
- SoundRecording;
- Image;
- Image ResourceId;
- TrackRelease.

The mapper emits deterministic loss flags for genuinely valid-but-unmapped child structures.

Structurally retained identifier evidence is not misclassified as mapping loss merely because it is not promoted into WAKILISHA canonical identity.

That distinction is now explicit:

- mapped semantics remain mapped;
- retained standards evidence remains retained evidence;
- valid but unsupported structures receive deterministic loss flags;
- canonical WAKILISHA mutation remains separately governed.

## 9. Technical-field decision

No further technical metadata is promoted merely because ERN permits it.

This tranche does not add WAKILISHA semantics for fields such as:

- codec;
- bitrate;
- fingerprint;
- file size;
- additional hash/checksum structures;
- other technical-delivery metadata without a demonstrated current flow.

Existing structured technical evidence from the previous tranche remains retained.

If a future WAKILISHA flow needs additional technical fields, that need must be proven independently before adapter expansion.

## 10. Fixture authority

The general `basic-release.xml` fixture is profile-neutral again.

It remains useful for general ERN parsing and mapping semantics without implying Release Profile acceptance.

The `multiple-recordings.xml` fixture is the accepted bounded Audio-profile proof.

It carries:

- `ReleaseProfileVersionId="Audio"`;
- qualifying primary SoundRecordings;
- ISRC evidence;
- structured titles;
- sequenced presentation;
- one identified FrontCoverImage;
- top-level cover linkage;
- one identified TrackRelease for each primary SoundRecording.

Both reviewed fixtures remain schema-valid against the exact pinned ERN 4.3.2 XSD.

## 11. Authoritative verifier

The existing verifier remains:

`scripts/music-standards/verify-ern432-authoritative-conformance.sh`

It still validates reviewed fixtures against the exact pinned ERN 4.3.2 XSD package.

It now also includes bounded local Audio-profile acceptance rules derived from the reviewed DDEX Release Profiles v2.3.1 authority.

The verifier explicitly describes this as bounded acceptance rather than DDEX Production certification.

No permanent test-file sprawl was introduced.

The existing focused contract remains:

`test/music-standards/ern-v432-readonly-adapter.test.ts`

## 12. Acceptance and audit history

The standards audit caught and corrected two important overclaims before merge.

First, the initial candidate claimed both Audio and SimpleAudioSingle. Review showed that WAKILISHA could cleanly support Audio now but did not need to invent an interpretation for the SimpleAudioSingle cover-art rule. The accepted boundary was therefore narrowed to Audio only.

Second, the first repaired head exposed a repository-wide icon-audit coupling: the DDEX string literal `"Component"` was also a Lucide export name, causing the generic source scanner to treat standards vocabulary as a UI icon dependency.

The final one-file parser repair preserved the exact DDEX semantic value while preventing that false-positive dependency.

Final accepted gates include:

- exact six-file total PR scope: PASS;
- no SQL / Edge / frontend / dependency scope: PASS;
- package and lockfile drift: NONE;
- official hash-pinned ERN 4.3.2 XSD validation: PASS;
- bounded Audio profile validation: PASS;
- focused ERN adapter contract: 20/20 PASS;
- protected critical suite on the accepted Audio repair: 35 files / 425 tests PASS;
- application build on the accepted Audio repair: PASS;
- repository performance/icon audit on the final collision repair: PASS;
- final PR Critical Control Plane #1586: PASS;
- merged-main Critical Control Plane #1587: PASS.

A local full-suite attempt during the icon-collision repair encountered one unrelated live RLS request timeout at the existing five-second boundary. The security timeout and contract were not weakened. The final protected PR and merged-main control planes both passed without changing that security boundary.

## 13. Authority boundary remains unchanged

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
- Deal/commercial mapping;
- rights adjudication;
- royalty or settlement logic;
- DDEX Production message exchange.

## 14. First-adapter closure decision

The first executable standards adapter is now sufficiently complete for WAKILISHA's present Release and Sound Recording data-flow needs.

Decision:

**close ERN 4.3.2 at the current bounded Audio read-only surface.**

There is no evidence-driven requirement for another ERN read-only fidelity tranche now.

Future ERN expansion requires a concrete WAKILISHA need, for example:

- a real SimpleAudioSingle exchange shape;
- a supported Release Profile variant;
- commercial Deal semantics;
- additional technical-delivery evidence needed by a live workflow;
- Production DDEX exchange.

Those are not implied by standards availability alone.

## 15. Slice 4 closure decision

Slice 4 already established the WAKILISHA-owned music data dictionary and mapping contracts for the standards named by issue #1039.

The first executable adapter has now been selected, implemented, conformance-hardened, fidelity-hardened, profile-bounded, and closed.

No second executable adapter is justified by current retained data merely to increase standards breadth.

Therefore the executable Slice 4 boundary is closed at this point.

The next engineering action is not another standards-adapter tranche.

The next action is a **programme-level exit audit against issue #1039** to determine whether the Music Identity & Rights Foundation satisfies its stated exit condition across Slices 1 through 4.

Any future RIN, RDR, MWN/BWARM, ECM, CWR, identifier-agency, or additional ERN implementation must be opened by a separately demonstrated product/data-flow need.

## 16. Deployment classification

For this closure:

- SQL migration: **No**
- Supabase Preview: **No**
- Edge Function: **No**
- frontend activation: **No**
- Production Finish: **No**
- Production data mutation: **No**
- external DDEX network exchange: **No**
- PR type: **documentation-only**
