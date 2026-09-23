# Music Identity & Rights Slice 4 ERN 4.3.2 Authoritative Conformance v1 Closure

Date: 23 September 2026

Status: **AUTHORITATIVE ERN 4.3.2 CONFORMANCE V1 ACCEPTED / NEXT READ-ONLY COVERAGE TRANCHE OPEN**

Programme authority:

- issue #1039;
- Slice 4 data dictionary and adapter design PR #1052;
- first-adapter selection PR #1053;
- ERN read-only adapter v1 PR #1054;
- ERN adapter v1 closure PR #1055;
- authoritative conformance repair PR #1056.

This record closes the first authoritative ERN 4.3.2 conformance-hardening tranche.

## 1. Final repository authority

Conformance implementation PR:

- PR: #1056;
- feature head: `26ab6e8f1afeb038288e2cf4ca68e5dd877be346`;
- merge commit: `60fbd03076cbecbd5d6e9e74762d23b1ab781636`.

Protected CI:

- PR Critical Control Plane run #1572: PASS;
- merged-main Critical Control Plane run #1573 attempt 1: FAIL on one unrelated remote RLS timeout;
- merged-main Critical Control Plane run #1573 attempt 2: PASS.

The failed first main attempt was diagnosed before rerun. The sole failure was:

`test/security/rls-policies.test.ts`

case:

`admin_settings_secrets: anonymous select returns 0 or error`

The test exceeded the existing 5-second Vitest timeout at 5005 ms. The same RLS suite otherwise continued to pass, including later reads/writes against the same Production Supabase project. No ERN/XSD gate failed. The failed workflow was rerun without code change and completed successfully.

This transient RLS timing event is therefore recorded as unrelated acceptance-harness/remote-service timing, not an ERN conformance product failure. If it recurs, it should be addressed as separate RLS test-harness reliability work rather than folded into the music-standards adapter.

Protected main after merge:

`60fbd03076cbecbd5d6e9e74762d23b1ab781636`

## 2. Accepted authoritative DDEX inputs

The permanent verifier uses the official DDEX ERN 4.3.2 XSD ZIP:

`https://service.ddex.net/doc/Standards/ERN432/ERN-3305%20-%20ERN%20Part%201%20Definition%20of%20messages%20v4.3.2%20XSD.zip`

Reviewed hashes:

- XSD ZIP:
  `bbd5012204ea3dbf08025e58768570650d9f65775b0022f5a93770c0dd411938`;
- `release-notification.xsd`:
  `def25b4e72696c9bbc1fed84962acc3a9bae2bc92ef25f8393c99b362aa53a6a`;
- `allowed-value-sets.xsd`:
  `87e99fe74f57a640dce0d3247d16b3b52358562c1dbefc4617eb8a9b7360d943`.

The verifier fails closed if any of these bytes differ.

The XSD files themselves are not vendored into the repository. They are downloaded into a temporary validation directory at test time and removed after verification.

## 3. Corrected ERN 4.3.2 authority

The accepted adapter now uses:

`http://ddex.net/xml/ern/432`

as the ERN 4.3.2 message namespace.

The previous `/ern/43` acceptance was incorrect for a component that claimed exact ERN 4.3.2 support.

The current fixture authority also uses:

`AvsVersionId="9"`

independently from the ERN structural version.

## 4. Corrected structural mappings

The conformance repair aligns the read-only parser with the authoritative schema for the currently supported subset.

Accepted corrections include:

- ISRC extraction from `SoundRecordingEdition/ResourceId/ISRC`;
- contributor role values from the ERN `Role/Value` wrapper;
- Release genre extraction from `DisplayGenre`;
- schema-valid `SoundRecording`, `Image`, `Release`, Party, reference and header structures in positive fixtures;
- required root `LanguageAndScriptCode`;
- required `AvsVersionId`;
- schema-valid Release, Resource and technical reference identifiers.

The mapper remains subordinate to `music-data-dictionary/v1`.

## 5. Permanent conformance verifier

Permanent verifier:

`scripts/music-standards/verify-ern432-authoritative-conformance.sh`

The verifier:

1. downloads the official ERN 4.3.2 XSD ZIP;
2. verifies exact reviewed ZIP/XSD/AVS hashes;
3. extracts the official schemas to a temporary directory;
4. validates the reviewed positive fixtures using `xmllint --nonet --schema`;
5. fails closed on schema drift or fixture non-conformance;
6. removes the temporary standards material after execution.

The verifier is wired into the existing:

`.github/workflows/critical-control-plane.yml`

No parallel workflow was added.

## 6. Accepted positive fixture set

The following local fixtures now validate against the pinned official ERN 4.3.2 XSD:

- `basic-release.xml`;
- `multiple-recordings.xml`;
- `unsupported-deal.xml`.

The unsupported-deal fixture is structurally valid ERN while the WAKILISHA mapper deliberately reports the Deal section as unsupported first-tranche semantic coverage.

Negative fixture behavior remains:

- old `/ern/43` namespace: rejected;
- malformed XML: rejected;
- DOCTYPE: rejected by the adapter safety contract.

## 7. Final local acceptance receipt

Exact base used for the repair candidate:

`954d79aad32f930488593551d38815d768d0fbf0`

Accepted local gates:

- exact 10-file candidate scope: PASS;
- no SQL / Edge / frontend activation scope: PASS;
- dependency and lockfile drift: NONE;
- official XSD ZIP hash: exact;
- official message XSD hash: exact;
- official AVS XSD hash: exact;
- three positive fixtures: authoritative XSD PASS;
- focused ERN adapter contract: 12/12 PASS;
- protected critical suite: 35 files / 417 tests PASS;
- full application build: PASS;
- `git diff --check`: PASS;
- exact staged scope: PASS;
- zero unstaged/untracked residue: PASS;
- remote feature tip equals local commit: PASS.

## 8. Authority boundary remains unchanged

This tranche added no canonical mutation capability.

There is still no:

- SQL migration;
- Supabase Preview;
- Supabase Edge Function;
- frontend activation;
- Production data mutation;
- canonical Registry DML;
- DDEX production message exchange;
- CWR export;
- external identifier registration;
- rights adjudication;
- royalty or settlement logic.

The adapter remains local/read-only.

## 9. What this conformance claim means

WAKILISHA may now claim that the reviewed local positive fixtures conform to the exact hash-pinned authoritative ERN 4.3.2 XML Schema used by the permanent verifier.

This does **not** mean:

- every valid ERN 4.3.2 message is semantically mapped;
- all ERN Release/Resource/Party/Deal fields are supported;
- all current DDEX profiles are supported;
- WAKILISHA has a licensed Production DDEX exchange;
- schema validity proves canonical WAKILISHA truth.

The existing four-stage boundary remains:

```text
syntax validity
  -> semantic mapping validity
  -> identity/evidence validity
  -> separately governed canonical admission
```

## 10. Next Slice 4 tranche

The next bounded tranche remains **read-only semantic coverage hardening**.

The goal is to expand tested ERN 4.3.2 mapping breadth only where a real WAKILISHA need exists.

Priority audit areas:

1. exact profile(s) WAKILISHA would realistically receive or export first;
2. additional representative SoundRecording and Release structures;
3. Party identifiers and typed Artist/Person/Organisation evidence;
4. namespace-aware attributes;
5. multiple SoundRecording editions;
6. additional Release/resource identifier forms;
7. technical Media references;
8. explicit mapping-loss coverage for valid-but-unsupported sections;
9. authoritative sample-message strategy that respects DDEX licensing and redistribution terms;
10. adapter-envelope compatibility across additional conforming fixtures.

Deal/commercial semantics remain unsupported unless separately designed.

Production exchange remains outside this tranche.

## 11. Deployment classification

For this closure record:

- SQL migration: **No**
- Supabase Preview: **No**
- Edge Function: **No**
- frontend activation: **No**
- Production Finish: **No**
- Production data mutation: **No**
- external network integration: **No**
- PR type: **documentation-only**
