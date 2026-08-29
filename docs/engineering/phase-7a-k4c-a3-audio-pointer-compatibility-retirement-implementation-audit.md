# Phase 7A K4C-A3: Audio Pointer Compatibility Retirement Implementation Audit

Status: REPOSITORY SEALED. READY FOR PR/CI.

Opened: 28 August 2026

Design authority:

`docs/engineering/phase-7a-k4c-audio-command-convergence-design.md`

Accepted main / production baseline:

- accepted main: `d444d95a625ea19f920d08a4ad637a2a9392a72f`
- production migrations: `60`
- production head:
  `20260828135801_phase_7a_k4c_a2_audio_remaining_pointer_convergence`
- K4C-A2 production verifier: PASS
- business typed Audio pointer readers: `0`
- typed Audio pointer writers: `1`
- typed/Resource pointer drift: `0`
- A2 disposable preview: deleted after production parity and advisor acceptance

## Purpose

A3 retires the final Audio half of the Phase 7A K1 lifecycle-position
compatibility layer.

A1 moved Audio review/lifecycle event authority onto shared Resource event
ledgers. A2 moved all governed Audio business pointer readers and writers onto
canonical `editorial.resources` lifecycle pointers.

A3 therefore does not redesign business behavior. It removes only the
compatibility machinery that no live business command or reader needs anymore:

1. the Audio typed-to-Resource synchronization trigger
2. the shared Resource-to-typed synchronization trigger
3. the two now-unreferenced K1 synchronization helpers
4. the four typed Audio pointer foreign keys
5. the four typed Audio lifecycle pointer columns

Audio binding identity remains physical through
`editorial.audio_publication_resources(resource_id, resource_kind,
publication_id)`.

Typed Audio review/lifecycle event tables also remain as historical
compatibility. A3 is pointer retirement only.

## Production A3 opening proof

Independent production introspection after A2 established:

- functions mentioning `editorial.audio_publication_resources`: `27`
- business functions reading typed Audio pointer columns: `0`
- business functions writing typed Audio pointer columns: `0`
- total typed pointer writers: `1`
- sole remaining typed pointer writer:
  `editorial.sync_typed_lifecycle_from_resource()`
- typed Audio pointer columns: `4`
- typed Audio pointer foreign keys: `4`
- pointer parity drift: `0`

The sole remaining pointer reader/writer is the K1 Resource-to-typed
compatibility helper. It is not business authority.

## Helper and trigger dependency proof

The two K1 synchronization helpers have no live function or view consumers.

`editorial.sync_resource_lifecycle_from_typed_binding()`:

- exact MD5:
  `1a9a366b7a26d023aa589767a2024651`
- incoming trigger dependencies: `1`
- dependent trigger:
  `audio_publication_resources_sync_shared_lifecycle`
- non-trigger function/view consumers: `0`

`editorial.sync_typed_lifecycle_from_resource()`:

- exact MD5:
  `619a2bd22f9066594f84dada7a119902`
- incoming trigger dependencies: `1`
- dependent trigger:
  `resources_sync_typed_lifecycle_compatibility`
- non-trigger function/view consumers: `0`
- helper is already Audio-only after Playlist P3

Exact trigger definitions at A3 open:

`audio_publication_resources_sync_shared_lifecycle`

- relation: `editorial.audio_publication_resources`
- function:
  `editorial.sync_resource_lifecycle_from_typed_binding()`
- fires after insert or update of the four typed pointer columns

`resources_sync_typed_lifecycle_compatibility`

- relation: `editorial.resources`
- function:
  `editorial.sync_typed_lifecycle_from_resource()`
- fires after insert or update of the four canonical Resource pointer columns

## Typed pointer foreign keys

A3 opens with exactly four typed Audio pointer foreign keys:

1. `audio_publication_resources_working_version_fkey`
2. `audio_publication_resources_submitted_version_fkey`
3. `audio_publication_resources_approved_version_fkey`
4. `audio_publication_resources_published_version_fkey`

Each is a deferrable composite FK into
`audio.publication_versions(id, resource_id, publication_id)` with
`ON DELETE RESTRICT`.

Production introspection also proved that none of the four typed pointer
columns participates in an index.

Tracked column dependencies are limited to:

- the four typed pointer FKs
- the Audio typed-to-Resource trigger

The migration still uses ordinary `DROP` semantics. It does not request
dependent-object removal. Any hidden dependency therefore fails the migration
instead of being removed implicitly.

## Data preservation seal

Production at A3 open:

- Audio binding rows: `2`
- non-pointer Audio binding fingerprint:
  `f2b2844aa5b9a82eb01b8b558268946b`
- canonical Resource fingerprint for those bindings:
  `37b16727b9c5de44c6cb45afd99dd9cd`
- pointer parity drift: `0`

The migration snapshots and compares:

- Audio binding row count
- all non-pointer Audio binding data
- canonical Resource rows for Audio bindings
- non-pointer Audio binding constraints
- all non-compatibility Audio business/helper function definitions and
  security metadata

A3 must not mutate any of those surfaces.

## Accepted A2 business body seal

A3 pins the ten A2-converged function bodies before compatibility retirement:

- `public.archive_audio_publication`:
  `54fd407decbc70816bb174589e7411fb`
- `audio.insert_current_publication_snapshot`:
  `a0c3b0c9ef0f77b87389250bbf971a4b`
- `audio.publication_content_fingerprint`:
  `ecb29761c632e3da1ba823e3f2cd516c`
- `public.create_audio_publication`:
  `4c4afedcf8320a02337128c325e53c0d`
- `public.get_public_audio_publication_m1`:
  `1688adaa942a4075cd37603c9d96fd2e`
- `public.replace_audio_publication_version_citations`:
  `c3777c4bffb0b4cb738ca9e2fcd333ef`
- `public.replace_audio_publication_version_credits`:
  `b17e6ea50a73dd4aa654c41f5d722e17`
- `public.restore_audio_publication_from_archive`:
  `287d39ea790c900ce0637018804f2a52`
- `public.save_resource_version_editorial_metadata`:
  `29c6262375c537571611a01ae02ad03c`
- `public.snapshot_audio_publication_working_version`:
  `5f84c8ace1bacd2ca3586adbbc7e4a1b`

A3 does not rewrite any of these functions.

## Migration strategy

The A3 migration is deliberately smaller than Playlist P3.

Playlist P3 first had to converge remaining Playlist readers and narrow the
shared reverse-sync helper to Audio. A2 has already completed the equivalent
Audio business convergence.

A3 therefore performs only fail-closed retirement:

1. require accepted A2 business definitions
2. require all four typed pointer columns and exact FK definitions
3. require exact trigger definitions
4. require exact helper MD5s
5. require one trigger dependency per helper and zero function/view consumers
6. require zero business typed-pointer readers
7. require exactly one typed-pointer writer: the K1 reverse-sync helper
8. require zero typed-pointer index participation
9. require pointer parity zero
10. drop the two compatibility triggers
11. drop both now-unreferenced helpers
12. drop the four typed pointer FKs
13. drop the four typed pointer columns
14. prove the binding now contains only
    `resource_id`, `resource_kind`, and `publication_id`
15. prove non-pointer binding data, Resource rows, constraints and business
    function bodies are unchanged
16. prove no typed Audio pointer reader or writer remains

No `GRANT`, `REVOKE`, RPC rewrite, event rewrite, Media change, or frontend
change is part of A3.

## Cross-domain ratchets

A3 must preserve:

- A1 typed Audio event-writer retirement
- typed Audio review/lifecycle tables as historical compatibility
- Playlist P3 pointer retirement
- absence of Playlist compatibility trigger
- K4B/K4C Video boundary: no typed Video review/lifecycle event authority
- A2 Audio RPC signatures, bodies, search paths, volatility and execution
  perimeter
- Audio Media/public-read contracts

## Browser and RPC boundary

Repository search found no browser/runtime source dependency on
`editorial.audio_publication_resources`.

Generated `src/types/database.types.ts` still contains the four pointer fields
at local-candidate time because production is still 60/A2.

After canonical A3 preview apply, database types must be regenerated from the
preview. The expected semantic type change is removal of the four typed pointer
fields from the `audio_publication_resources` Row/Insert/Update shapes.

No browser RPC contract is expected to change because A3 does not alter any
public function body or signature.

## Legacy debt deliberately outside A3

The pre-existing working-snapshot reuse defect discovered during A2 remains a
separate bounded repair.

A3 does not modify
`public.snapshot_audio_publication_working_version` and must not absorb that
legacy business-logic issue into compatibility retirement.

## Local candidate gate

No disposable preview exists for A3.

The required local gate before any paid preview is created is:

1. exact clean accepted-main branch
2. native `supabase migration new` file creation
3. exact four-file candidate scope:
   - migration
   - permanent verifier
   - focused test
   - this audit
4. focused A3/A2/P3/Primitive Compounding tests
5. critical suite
6. application build
7. diff/whitespace gate
8. production remains exactly 60/A2
9. dry-run shows exactly one pending A3 migration

Only after that gate passes may one A3-only disposable preview be created.

## Preview acceptance plan

The future A3 preview must:

1. source-replay all 60 accepted migrations through A2
2. prove baseline 60/A2 and zero drift
3. execute the full final A3 migration once with terminal `COMMIT` replaced by
   `ROLLBACK`
4. remain 60/A2 after rollback rehearsal
5. apply the exact same migration bytes natively
6. reach 61/A3 with zero pending
7. run the permanent verifier independently
8. run a narrow rollback-safe behavior fixture proving canonical Resource
   working pointer operation and Audio binding identity after typed columns are
   gone
9. regenerate database types
10. run security/performance advisor comparison
11. record canonical replay/schema proof
12. delete the disposable preview only after production verification

## Deployment boundary

- SQL migration needed: Yes
- Supabase Edge Function deploy needed: No
- frontend deploy needed: No
- Readdy Finish update needed: No
- generated database types expected to change: Yes, after preview
- production mutation before merge: No
- disposable preview currently exists: Yes, A3-only preview `ypnjfbesuqtiugtqvmqq`
- production remains at 60/A2
- next allowed action: repository replay/schema seal against the accepted 61/A3 preview


## Accepted preview evidence

A3 used one disposable preview created only after the full local candidate gate
passed.

Preview identity:

- project ref: `ypnjfbesuqtiugtqvmqq`
- branch id: `22be33da-7f73-4ce4-9c80-f53fd61bed82`
- parent production project: `pgzizndxdyhqmtyywjmt`
- `with_data=false`

Accepted baseline before A3:

- migration count: `60`
- migration head: `20260828135801`
- merged A2 permanent verifier: PASS
- business typed pointer readers: `0`
- total typed pointer writers: `1`
- pointer drift: `0`

The branch had an initial provisioning race while schema replay was still
settling. No A3 SQL was applied during that period. The baseline was accepted
only after the branch reached `FUNCTIONS_DEPLOYED`, the migration ledger reached
60/A2, the live writer count matched production, and the complete merged A2
verifier passed.

### Full migration rollback rehearsal

The exact migration bytes, SHA-256
`a5419ac98008e9e8fd7f782fd69a974bbd846d7d9ba873043d7f944e39d20015`,
were executed start-to-finish on the accepted 60/A2 preview with only the
terminal `COMMIT` replaced by `ROLLBACK`.

Rehearsal SHA-256:

`220928c20395e4fef4ce43de6a24b4522297990e393de25279793bd716048c79`

After rollback:

- preview remained `60/A2`
- A3 remained the only pending migration
- merged A2 permanent verifier still passed
- no migration-history entry existed for A3

### Native preview application

The same migration bytes were then applied natively with the pinned Supabase
CLI.

Accepted preview state:

- migration count: `61`
- migration head: `20260829092902`
- pending migrations: `0`
- A3 permanent verifier: PASS
- typed Audio pointer columns: `0`
- business typed pointer readers: `0`
- typed pointer writers: `0`
- compatibility triggers: `0`
- compatibility helpers: `0`

### Governed behavior proof

A rollback-safe authenticated administrator fixture exercised the Audio
commands after the compatibility layer was physically absent. It proved:

- Audio publication creation succeeds with the binding reduced to
  `resource_id`, `resource_kind`, and `publication_id`
- canonical `editorial.resources.current_working_version_id` is established on
  create
- a new working snapshot advances the canonical Resource working pointer
- Citation and Credit replacement operate against canonical current-working
  authority
- archive clears canonical published authority
- restore returns the publication to draft
- neither compatibility helper nor compatibility trigger exists
- fixture rollback residue: `0`

Acceptance marker:

`K4C_A3_TARGETED_GOVERNED_BEHAVIOR_PROOF_PASS`

The known pre-existing snapshot-reuse branch defect was deliberately avoided by
forcing the new-snapshot path. That defect remains outside A3.

### Business-function and advisor parity

The ten A2-converged Audio business functions are byte/security identical
between production 60/A2 and preview 61/A3.

Shared authority fingerprint:

`fe36948d9ed37ce50d65249034530189`

Advisor comparison:

- new A3-relevant security findings: `0`
- A3-relevant performance differences: only `unused_index` INFO for existing
  indexes on `editorial.resources` and `audio.publication_versions` in the
  fresh preview
- A3 creates no index and no security perimeter

Production remained untouched at `60/A2` throughout preview acceptance.

## Repository seal plan (completed)

Before PR/CI, the repository seal requires:

1. regenerate `src/types/database.types.ts` from the accepted 61/A3 preview
2. verify the retired Audio binding pointer fields are absent from Row / Insert /
   Update while accepting the repository's required production-runtime metadata
   normalization
3. record the canonical replay proof for migration `20260829092902`
4. seal `docs/engineering/live-schema-baseline.json` to the accepted preview
5. verify replay and live-schema contracts
6. rerun focused, critical, build, diff, and exact-scope gates
7. commit and push only after all of those pass

Items 1-7 are complete.

## Repository replay/schema seal

Canonical replay/schema seal completed from the accepted 61/A3 preview.

- migration head: `20260829092902`
- migration SHA-256: `a5419ac98008e9e8fd7f782fd69a974bbd846d7d9ba873043d7f944e39d20015`
- permanent verifier SHA-256: `d48ec9354c6d9dc9d26640da0f3ac82d2e1ed9b8e7cb6054a84c4cca49f1f55c`
- generated database types SHA-256: `f5d7e92d437cffa9f8b7baa55996f5e94f39886de9317b29fde641702a7a1a67`
- live-schema baseline SHA-256: `7751d19b1188021550c7f8fbdabee1b52324e59a8a1e589874f04f660790b20e`
- replay proof SHA-256: `f4d8d04217a347cd274b3f054fa303f7487197e84841806d4686b941585f3583`
- schema delta: the four retired Audio binding pointer fields are absent from Row / Insert / Update
- runtime metadata normalization: `PostgrestVersion` changed from `14.17` on accepted main to current production runtime `14.5`, as required by `normalize-database-types-runtime-metadata.mjs`
- exact generated-type proof: accepted main with those 12 Audio pointer properties removed and runtime metadata normalized to `14.5` hashes to `f5d7e92d437cffa9f8b7baa55996f5e94f39886de9317b29fde641702a7a1a67`, exactly matching the canonical generated file
- replay contract: PASS

A3 is repository-sealed and ready for PR/CI.

## Final PR-byte gates

- focused A3/A2/A1/Playlist P3/Primitive Compounding gate: PASS
- critical control-plane suite: PASS
- application build: PASS
- replay contract: PASS
- live-schema contract: PASS
- exact seven-file PR scope: PASS

A3 is ready for PR/CI.
