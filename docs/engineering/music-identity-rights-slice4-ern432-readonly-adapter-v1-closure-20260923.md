# Music Identity & Rights Slice 4 ERN 4.3.2 Read-Only Adapter v1 Closure

Date: 23 September 2026

Status: **ERN 4.3.2 READ-ONLY ADAPTER V1 ACCEPTED / CONFORMANCE HARDENING OPEN**

Programme authority:

- issue #1039;
- Slice 4 dictionary and adapter design PR #1052;
- first-adapter selection PR #1053;
- implementation PR #1054;
- `docs/engineering/wakilisha-music-data-dictionary-v1.md`;
- `docs/engineering/music-identity-rights-slice4-standards-adapter-contracts-20260923.md`;
- `docs/engineering/music-identity-rights-slice4-first-adapter-selection-ern432-20260923.md`.

This record closes the first executable Slice 4 adapter tranche and opens the next read-only hardening boundary.

## 1. Final repository authority

Implementation PR:

- PR: #1054;
- feature head: `8538432ea592dca092244bc6c6ab7407f4312be0`;
- merge commit: `35a516bf051f390a1b0c79b80bf1e003c7408d67`.

Protected CI:

- PR Critical Control Plane run #1568: PASS;
- merged-main Critical Control Plane run #1569: PASS.

Protected main after merge:

`35a516bf051f390a1b0c79b80bf1e003c7408d67`

## 2. Accepted implementation scope

The accepted adapter is deliberately bounded to local/read-only standards interpretation.

Added authority:

- `src/services/musicStandards/contracts.ts`;
- `src/services/musicStandards/ern/v432/parser.ts`;
- `src/services/musicStandards/ern/v432/mapper.ts`;
- `test/music-standards/ern-v432-readonly-adapter.test.ts`;
- six local ERN fixture files under `test/music-standards/fixtures/ern-4.3.2/`;
- direct dev dependency `saxes@6.0.0`;
- permanent ERN contract wired into `test:critical`.

No new persistence authority was added.

## 3. Local acceptance receipt

The candidate was built from exact protected main:

`9b832137b82234dd60cb76dd887092283f573ec4`

The corrected exact candidate scope contained 12 files and no SQL, Edge, or frontend activation paths.

Accepted gates:

- direct `saxes@6.0.0` dependency and lock proof: PASS;
- static no-network / no-database-mutation proof: PASS;
- focused ERN adapter contract: 10/10 PASS;
- protected critical suite: 35 files / 415 tests PASS;
- full app build: PASS;
- worktree diff check: PASS;
- staged diff check: PASS;
- exact staged scope: PASS;
- unstaged/untracked residue: NONE;
- remote feature tip equals local commit: PASS.

## 4. Accepted semantics

The adapter emits a WAKILISHA-owned envelope with:

- adapter key/version;
- external standard/version;
- message/record type;
- source party/reference;
- observation timestamp where supplied;
- payload SHA-256 fingerprint;
- mapping profile;
- mapping result;
- mapping-loss flags;
- typed mapped data.

The ERN mapper currently produces read-only candidate/evidence projections for:

- Releases;
- SoundRecordings;
- ISRC;
- product identifier / ICPN evidence;
- Display Artist evidence;
- contributor evidence;
- label evidence;
- image/Media evidence.

The implementation deliberately keeps:

- Display Artist separate from contributor identity;
- contributor evidence separate from Person or canonical Contribution creation;
- label evidence separate from Registry Label or Organisation-to-Label identity;
- standards structure separate from WAKILISHA canonical mutation authority.

## 5. Fail-closed and parser safety boundary

The parser currently enforces bounded local XML handling including:

- one XML root;
- expected ERN 4.3 namespace;
- required `ResourceList`;
- required `ReleaseList`;
- malformed XML rejection;
- DOCTYPE rejection;
- maximum XML byte size;
- maximum XML depth;
- maximum XML element count.

The first-tranche mapper explicitly loss-flags unsupported top-level content such as `DealList` rather than silently claiming semantic coverage.

## 6. No-mutation proof

The adapter source contains no:

- `fetch()`;
- `XMLHttpRequest`;
- Supabase client import;
- `createClient()`;
- SQL DML;
- `supabase.rpc()` canonical mutation path.

There is no:

- SQL migration;
- Supabase Preview;
- Edge Function;
- frontend activation;
- Production data mutation;
- DDEX production network exchange.

## 7. Standards-conformance distinction

This v1 adapter proves WAKILISHA semantic mapping behavior against local golden fixtures.

It does **not** yet claim complete ERN 4.3.2 schema/profile conformance.

DDEX currently identifies ERN 4.3.2 as the current ERN Part 1 baseline XML Schema and recommends implementing the most recent ERN 4.3.x version. DDEX also provides an XML validator and formal XSD as the syntax authority.

Primary references:

- https://kb.ddex.net/reference-material/standards-specifications/
- https://kb.ddex.net/implementing-each-standard/electronic-release-notification-message-suite-%28ern%29/
- https://kb.ddex.net/reference-material/data-dictionaries/

DDEX documents `http://ddex.net/xml/ern/43` as the ERN 4.3 namespace. The namespace itself therefore identifies the ERN 4.3 family rather than proving every message semantic is uniquely a 4.3.2-conformant profile instance.

That distinction is now an explicit next gate.

## 8. Next tranche: ERN 4.3.2 conformance hardening

The next executable boundary remains read-only.

Required work:

1. obtain or pin the authoritative ERN 4.3.2 XSD/schema artifacts or an equivalent reproducible validation input;
2. add authoritative DDEX sample fixtures where licensing and repository-distribution terms permit, otherwise add provenance-pinned derived/non-copyright fixture assertions;
3. validate fixture structure against the exact ERN 4.3.2 schema before semantic mapping;
4. explicitly model current `AvsVersionId` handling rather than conflating allowed-value-set version with message-structure version;
5. prove namespace/profile/version behavior for supported and unsupported ERN 4.3-family inputs;
6. expand coverage for namespace-aware attributes, resource references, Party resolution and representative Release/SoundRecording structures;
7. keep Deal/commercial semantics unsupported unless separately designed;
8. preserve deterministic mapping and mapping-loss behavior;
9. retain the no-network/no-database-mutation contract;
10. document any DDEX implementation-licence requirements before any future production exchange.

The hardening tranche must not introduce network exchange or canonical writes.

## 9. Exit conclusion

The first executable Slice 4 adapter is accepted.

WAKILISHA now has a versioned, deterministic, local/read-only ERN mapping seam that remains subordinate to:

`music-data-dictionary/v1`

The next work is standards-conformance hardening, not Production integration.

## 10. Deployment classification

For this closure/opening record:

- SQL migration: **No**
- Supabase Preview: **No**
- Edge Function: **No**
- frontend activation: **No**
- Production Finish: **No**
- Production data mutation: **No**
- external network integration: **No**
- PR type: **documentation-only**
