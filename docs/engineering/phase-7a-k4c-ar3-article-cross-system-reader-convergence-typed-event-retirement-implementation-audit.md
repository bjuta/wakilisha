# Phase 7A K4C-AR3: Article Cross-System Reader Convergence and Typed-Event Retirement Implementation Audit

Status: PREVIEW SCHEMA + RUNTIME ACCEPTED. WAITING CANONICAL NATIVE MIGRATION PUSH.

Opened: 30 August 2026

Design authority:

`docs/engineering/phase-7a-k4c-article-command-convergence-design.md`

Accepted main / production baseline:

- accepted main:
  `f7c321827db21f2a878d3ec231d93c44f4079caa`
- production migrations: `63`
- production head:
  `20260830063344_phase_7a_k4c_ar2_article_publication_scheduling_event_convergence`
- AR2 permanent production verifier: PASS
- production pending migrations: `0`
- remaining typed Article lifecycle writers: `0`
- remaining typed Article lifecycle readers: `2`

Canonical AR3 migration identity:

`20260830070752_phase_7a_k4c_ar3_article_cross_system_reader_convergence_typed_event_retirement`

The migration timestamp was minted with pinned Supabase CLI `2.107.0` from
exact accepted main and exact 63/AR2 production state.

## Purpose

AR3 closes K4C Article event-authority convergence.

Its scope is deliberately narrower than AR1 and AR2:

1. move the final Corrections publication-proof reader from typed Article
   lifecycle history to canonical shared Resource lifecycle history
2. move the final Publishing editorial-state reader from typed Article
   lifecycle history to canonical shared Resource lifecycle history
3. require zero live function/view/materialized-view/RLS-policy dependency on
   `editorial.article_lifecycle_events`
4. keep the typed table physically present as immutable historical
   compatibility
5. preserve all 35 historical typed rows exactly

AR3 is not a storage-retirement migration.

It does not drop the typed table.

## Canonical opening boundary

The Mac opening gate proved:

- accepted main:
  `f7c321827db21f2a878d3ec231d93c44f4079caa`
- production project ref:
  `pgzizndxdyhqmtyywjmt`
- production migration count: `63`
- production head: `20260830063344`
- pending migrations: `0`
- Supabase CLI: `2.107.0`
- AR3 branch:
  `agent/phase-7a-k4c-ar3-article-cross-system-reader-convergence-typed-event-retirement`
- canonical migration initial SHA-256:
  `e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855`

No database mutation occurred during opening.

## Final dependency scan

Production contains exactly two persisted functions that reference
`editorial.article_lifecycle_events`:

1. `editorial.correction_article_publication_proof(uuid)`
   - accepted MD5:
     `3bdd9467a857da7a8f6373a50e237295`
2. `editorial.derive_publishing_editorial_state(uuid)`
   - accepted MD5:
     `f89b6060e68ae2e1154f689a741dc831`

Production dependency scan also proved:

- typed Article lifecycle writers: `0`
- views referencing typed history: `0`
- materialized views referencing typed history: `0`
- RLS policies referencing typed history: `0`

AR3 exit requires all persisted live dependency counts to reach `0`.

## No-data preview baseline rule

Supabase disposable preview branches replay schema/migration history without
production content rows.

Therefore AR3 accepts exactly two historical-data baselines:

- production: `35` typed rows, fingerprint
  `dd7ac00209d19f3f369fb0d9b3e1e6a1`, and at least 35 shared Article rows
- no-data disposable preview: `0` typed rows, empty fingerprint
  `d41d8cd98f00b204e9800998ecf8427e`, and `0` shared Article rows

Any other typed row count is a hard stop.

In both environments AR3 snapshots the starting typed row count/fingerprint and
requires them to remain byte-identical after the migration.

The first transactional preview attempt stopped before mutation because the
initial candidate incorrectly required the production 35-row fingerprint on a
no-data preview. That false environmental assumption was repaired before any
candidate schema apply or canonical migration-history stamp.

## Historical typed table identity

At AR3 open:

- typed Article lifecycle rows: `35`
- typed history fingerprint:
  `dd7ac00209d19f3f369fb0d9b3e1e6a1`
- shared Article lifecycle rows: `35`
- unmapped typed rows: `0`

The typed table:

- remains physically present
- has RLS enabled
- grants no SELECT to `anon`, `authenticated`, or `service_role`
- grants no INSERT/UPDATE/DELETE to those roles

AR3 snapshots row count/fingerprint before work and requires them unchanged after
work.

The migration contains no typed-table INSERT, UPDATE, DELETE, or DROP.

## Corrections reader convergence

Target:

`editorial.correction_article_publication_proof(uuid)`

AR3 preserves the exact result shape:

- case Resource id
- application id
- affected Resource id
- Article id
- challenged version id
- application resulting version id
- corrected/published version id
- content fingerprint
- Article slug

AR3 changes only the lifecycle proof source.

Before AR3, proof requires an `editorial.article_lifecycle_events`
`published` row for the exact target Resource + Article + published Version.

After AR3, proof requires an
`editorial.resource_lifecycle_events` `published` row for the exact target
Resource + published Resource Version.

Article identity remains independently constrained by:

- the Correction Application
- the correction Article Version
- the Article Resource binding
- the current published Resource Version
- the active public publication snapshot
- the live Article row
- the publication fingerprint equality check

The shared event does not need a duplicate Article id column because the
Resource binding and Article Version already establish that identity.

## Corrections caller ratchet

AR3 does not rewrite any downstream Corrections caller.

Pinned production callers:

1. `editorial.assert_correction_public_note_integrity()`
   - MD5 `9fcaaee0694f103fc7b64e9f3b01549f`
2. `editorial.validate_correction_case_history(uuid)`
   - MD5 `ffa4fbba0c8cb7a19f015a39d3864adf`
3. `public.close_correction_case(...)`
   - MD5 `933345920e74c08a217d4c02d00271ec`
4. `public.public_get_article_correction_notes(text)`
   - MD5 `f4495500ba9e1ecd6a7b95c8769d3e8d`
5. `public.publish_correction_note(...)`
   - MD5 `9bd8f5d6b14da2c98bb95b46f8e482c6`

Migration preflight and permanent verifier both byte-pin all five.

## Publishing reader convergence

Target:

`editorial.derive_publishing_editorial_state(uuid)`

AR3 preserves:

- null Resource -> `not_linked`
- Publishing item visibility permission gate
- missing Resource -> `not_linked`
- Article latest `changes_requested` override
- published Resource state semantics
- approved pointer fallback
- submitted pointer fallback
- draft fallback

The only source change is the Article latest-action scan:

before:

`editorial.article_lifecycle_events`

after:

`editorial.resource_lifecycle_events`

The action vocabulary remains:

- `submitted`
- `changes_requested`
- `approved`
- `scheduled`
- `published`
- `unpublished`
- `archived`
- `restored`

Ordering remains `created_at DESC, id DESC` to preserve the old reader's
deterministic latest-event semantics for the imported 35 historical rows.

## Function privilege preservation

AR3 does not introduce a new privileged function.

It preserves the accepted existing surfaces explicitly after replacement.

Corrections proof:

- SECURITY INVOKER SQL function
- fixed search path:
  `pg_catalog, public, editorial`
- `service_role`: EXECUTE
- `authenticated`: no EXECUTE
- `anon`: no EXECUTE

Publishing state derivation:

- SECURITY DEFINER
- fixed search path:
  `pg_catalog, editorial`
- `authenticated`: EXECUTE
- `service_role`: EXECUTE
- `anon`: no EXECUTE

This explicit ACL restoration protects against preview/default-function
privilege drift.

## AR1 and AR2 ratchets

AR3 does not modify governed review or publication command authority.

Permanent verifier byte-pins:

AR1 review/list functions:

- submit:
  `539bf98f189212294b8e1ce65d97e00e`
- request changes:
  `0421228df4bf205da2f663cc14c41e80`
- approve:
  `707058aadc9c53746bfcaaa62d893f7f`
- accept suggestion:
  `d92af169eeb9e48e65e4c749cf9e6403`
- lifecycle list:
  `f5c977c58e87556e18f0fd07573dabe3`

AR2 publication functions:

- direct publish:
  `b2d6c14458a6a1b9824565c715237ef9`
- schedule:
  `c7a5df4d7de4d740fb680f4dc52dfc46`
- due scheduled publish:
  `12311085f7d61e044468e6c6cabbfd9e`
- unpublish:
  `e4904cf58a152dffe23345c9c077ece3`
- archive:
  `e5575e7ac122b98128e341898a0052c7`
- restore:
  `82d29071e92b4e09825c76f1b2b6a883`

AR2 internal bridges:

- authenticated Article bridge:
  `26320c4bf9c707e36912a0cea7bda82c`
- service scheduled-publication bridge:
  `4a1a1912f298d05ad96c70969efd54d8`

Shared lifecycle append helper:

`d84d503da70733c010a93025bca7cda7`

## Candidate files

AR3 currently contains exactly four candidate files:

1. `supabase/migrations/20260830070752_phase_7a_k4c_ar3_article_cross_system_reader_convergence_typed_event_retirement.sql`
2. `scripts/control-plane/verify-phase-7a-k4c-ar3-article-cross-system-reader-convergence-typed-event-retirement.sql`
3. `test/control-plane/phase-7a-k4c-ar3-article-cross-system-reader-convergence-typed-event-retirement.test.ts`
4. this implementation audit

## Permanent verifier contract

The AR3 verifier requires:

- typed table physically present
- exactly 35 typed historical rows
- accepted typed fingerprint unchanged
- every typed row fully represented in shared history
- zero function/procedure references to typed Article history
- zero view references
- zero materialized-view references
- zero RLS-policy references
- Corrections proof reads shared lifecycle history
- Corrections result shape unchanged
- all five downstream Corrections callers byte-identical
- Publishing derivation reads shared lifecycle history
- Publishing state vocabulary and pointer fallbacks preserved
- Publishing SECURITY DEFINER/search-path boundary preserved
- exact Corrections and Publishing function ACLs preserved
- AR1 review/list authority byte-identical
- AR2 publication/command authority byte-identical
- shared lifecycle helper byte-identical
- typed historical table RLS/app-role perimeter unchanged
- Playlist/Audio pointer-retirement ratchets remain closed
- Video typed-event authority remains absent

Acceptance marker:

`PHASE_7A_K4C_AR3_ARTICLE_CROSS_SYSTEM_READER_CONVERGENCE_TYPED_EVENT_RETIREMENT_PASS`

## Preview acceptance plan

AR3 requires a fresh disposable preview from the sealed 63/AR2 production
boundary.

Acceptance must include:

1. exact 63/AR2 baseline replay
2. AR2 permanent verifier PASS at baseline
3. full candidate transactional dry-run
4. no typed table row/fingerprint mutation
5. AR3 permanent verifier PASS after candidate schema apply
6. runtime Publishing state proof against new shared review lifecycle events
7. runtime Corrections publication-proof equivalence fixture
8. zero fixture residue
9. advisor comparison
10. generated database-type parity
11. canonical native migration stamp with exact `20260830070752`
12. post-stamp permanent verifier
13. post-stamp runtime smoke
14. replay proof and live-schema seal
15. focused AR3 tests
16. critical control-plane suite
17. application build
18. exact changed-file scope
19. protected PR/CI
20. separate production SQL promotion
21. independent production parity seal
22. paid preview deletion only after production seal

## Current boundary

Production remains untouched at exact 63/AR2.

AR3 is not yet preview-proven.

No Edge Function deployment is required.

No frontend deployment is required.

No Readdy update is required.


## Preview schema/runtime acceptance

Disposable preview v1:

- branch id: `aa012186-eb38-4ac1-8e1c-bdb07add663b`
- project ref: `dofqvxhcatqbqlaguqyz`
- hourly cost: `$0.01344`
- baseline history: exact `63/AR2`
- AR2 permanent verifier at baseline: PASS
- no-data typed Article rows: `0`
- no-data typed fingerprint:
  `d41d8cd98f00b204e9800998ecf8427e`
- no-data shared Article lifecycle rows: `0`

The first transactional candidate attempt stopped before mutation because the
initial candidate incorrectly required the production 35-row historical
fingerprint on a no-data preview. The candidate was repaired to accept only the
two legitimate environments:

- production: `35/dd7ac00209d19f3f369fb0d9b3e1e6a1`
- disposable no-data preview: `0/d41d8cd98f00b204e9800998ecf8427e`

Any other row count remains a hard stop.

The corrected full candidate transactional dry-run then passed and rolled back.

Candidate schema was subsequently applied through direct SQL without migration
history stamping for runtime acceptance.

Permanent AR3 verifier result:

`PHASE_7A_K4C_AR3_ARTICLE_CROSS_SYSTEM_READER_CONVERGENCE_TYPED_EVENT_RETIREMENT_PASS`

Observed on candidate schema:

- live typed Article dependency count: `0`
- typed Article rows: `0`
- shared Article lifecycle rows before fixtures: `0`
- typed historical table remained physically present
- no function/view/materialized-view/RLS-policy live dependency remained

## Publishing reader runtime proof

A rollback-safe owned Publishing-item fixture proved the rewritten
`editorial.derive_publishing_editorial_state(uuid)` behavior from shared
Resource lifecycle history.

Observed:

- `NULL` Resource -> `not_linked`
- draft Article Resource before lifecycle override -> `draft`
- shared `changes_requested` latest event ->
  `changes_requested`
- typed Article lifecycle writes: `0`

The fixture transaction rolled back.

## Corrections publication-proof runtime proof

A governed rollback-safe Corrections fixture drove a published Article through:

1. internal correction-case creation
2. triage against the current published Article Version
3. investigator assignment
4. linked evidence creation
5. evidence-ready investigation update
6. submit for decision
7. `correction_required` decision
8. `apply_article_correction`

All governed commands required for the final application succeeded.

The successful application intentionally did not change the published pointer;
the case reached `applied` while the correction version remained working
authority. Therefore publication proof correctly remained absent before a
matching corrected publication existed.

To isolate the AR3 reader contract without altering the mature Corrections
workflow, the rollback fixture then placed the correction version into the
canonical published state using existing primitives:

- `editorial.copy_article_lifecycle_version`
- `editorial.publish_article_snapshot`
- canonical Resource `current_published_version_id`
- one shared `published` Resource lifecycle event

The published copy preserved the correction version content fingerprint.

The rewritten
`editorial.correction_article_publication_proof(uuid)`
then returned the exact expected:

- case Resource id
- application id
- affected Article Resource id
- Article id
- challenged Article Version id
- correction application resulting Version id
- corrected published Version id
- matching content fingerprint
- Article slug

Observed:

- correction apply command: `succeeded`
- application fingerprint = published fingerprint
- shared `published` event satisfied publication proof
- typed Article lifecycle writes: `0`

The entire fixture transaction rolled back.

### Pre-existing correction republish behavior outside AR3

A normal post-correction review-submit/approve/publish fixture did not satisfy
the correction publication proof because the existing review submission path
recomputes Article snapshot fingerprint after changing `wp_status` to
`pending`. The later lifecycle copies preserve that recomputed fingerprint,
which can differ from the correction-version fingerprint.

This behavior predates AR3 and is not caused by the typed-to-shared reader
substitution. AR3 does not modify Corrections application, review, or
publication commands to hide that mismatch. Any repair belongs to a separate
bounded Corrections/publication milestone.

## Preview residue, advisor, and generated-schema acceptance

After all rollback-safe fixtures:

- fixture users: `0`
- fixture Articles: `0`
- typed Article lifecycle rows: `0`
- shared Article lifecycle rows: `0`
- preview migration count/head remained exact `63/AR2`
- live typed Article dependency count on candidate schema: `0`

AR3-relevant security advisor surface matched production:

- historical typed-table RLS/no-policy INFO: identical
- existing Article lifecycle-list SECURITY DEFINER WARN: identical
- no AR3-specific new security WARN/ERROR

AR3-relevant performance advisor surface matched production:

- two historical typed-table unindexed-FK INFO findings: identical
- no AR3-specific new performance WARN/ERROR

Generated TypeScript database types:

- production byte length: `618219`
- preview byte length: `618219`
- exact equality: PASS

Because preview v1 contains direct-SQL candidate schema without canonical
migration-history stamping, it must be deleted rather than reset/reused for
native migration promotion.

## Canonical native preview and repository seal

Canonical AR3 migration bytes were promoted natively to fresh disposable
preview v2.

Preview v2:

- branch id: `0c2d4630-b3ea-48f1-8b14-71ede252bf14`
- project ref: `ktaufbpkeqcajrdrwcye`
- baseline before push: exact `63/AR2`
- canonical pending migration count before push: `1`
- canonical migration:
  `20260830070752_phase_7a_k4c_ar3_article_cross_system_reader_convergence_typed_event_retirement.sql`
- migration SHA-256:
  `432bb3e9a769cfab1359840133380452fe24a80933621b185912de7d32f17d9c`
- focused AR3 tests before push: `14/14 PASS`
- application build before push: PASS
- native `supabase db push --linked`: PASS
- preview migration count after push: `64`
- preview migration head after push: `20260830070752`
- preview pending migrations after push: `0`
- production mutation: none

Independent post-stamp preview verification proved:

- permanent AR3 verifier:
  `PHASE_7A_K4C_AR3_ARTICLE_CROSS_SYSTEM_READER_CONVERGENCE_TYPED_EVENT_RETIREMENT_PASS`
- typed Article lifecycle rows in no-data preview: `0`
- shared Article lifecycle rows in no-data preview: `0`
- remaining live typed Article dependencies: `0`
- Corrections proof ACL:
  - `PUBLIC`: no EXECUTE
  - `anon`: no EXECUTE
  - `authenticated`: no EXECUTE
  - `service_role`: EXECUTE
- Publishing state ACL:
  - `PUBLIC`: no EXECUTE
  - `anon`: no EXECUTE
  - `authenticated`: EXECUTE
  - `service_role`: EXECUTE
- historical typed Article table remains inaccessible to
  `anon`, `authenticated`, and `service_role`

A fresh rollback-safe post-stamp Publishing fixture proved:

- `NULL` Resource -> `not_linked`
- draft Article Resource -> `draft`
- shared latest `changes_requested` event -> `changes_requested`
- typed Article lifecycle writes: `0`
- fixture residue after rollback: `0`

Post-stamp advisor parity:

- AR3-relevant security advisor findings: identical production/preview
- AR3-relevant performance advisor findings: identical production/preview
- no AR3-specific new security or performance finding

Generated TypeScript database types remained byte-identical between production
and preview:

- production length: `618219`
- preview length: `618219`
- equality: PASS

Canonical repository replay/schema seal then completed from preview v2.

Repository seal identities:

- database types SHA-256:
  `f5d7e92d437cffa9f8b7baa55996f5e94f39886de9317b29fde641702a7a1a67`
- live-schema baseline SHA-256:
  `3d435793db6e429b55f2e3ed52a7774c776cfb7dfa2a5f43a7963c3a4ea0e321`
- replay proof SHA-256:
  `0617f328087147d66db74a7d71ff13ef13aa71339f0352401a55cba8073bcab2`
- migration replay contract: PASS
- repository schema snapshot:
  exact `64` active migrations at canonical AR3
- production migration history:
  exact `63/AR2`
- production pending set:
  exactly one forward-only canonical AR3 migration
- focused AR3 test:
  `14/14 PASS`
- critical control-plane suite:
  `24` files / `259` tests PASS
- application build:
  PASS
- exact repository changed-file perimeter:
  six files
- production mutation:
  none
- Edge Function deployment:
  none
- frontend deployment:
  none
- Readdy update:
  none

AR3 is repository-sealed and ready for protected PR/CI.

Production remains exact `63/AR2` with canonical AR3 as the sole pending
migration.
