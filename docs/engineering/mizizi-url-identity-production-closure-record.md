# MIZIZI URL Identity Programme — Production Closure Record

## Status

**PRODUCTION SCHEMA ACCEPTED — Release slug apply is partially accepted at 731 / 737 and is fail-safe closed pending the six-row forward resume repair.**

This record closes the schema/control-plane deployment shipped through PR #1015.
The later governed Release-slug trigger did execute. Its first apply preserved
731 verified successes and then failed closed on six stale collision-family
siblings. Chart Track-slug canonicalization remains unrun.

## Accepted repository authority

- merged PR: #1015
- merged main: `723c7054abe5a50cc807ed791804e41e77d1880b`
- migration:
  `supabase/migrations/20260922143000_mizizi_url_identity_authority_window_close_v1.sql`
- migration SHA-256:
  `ce98fd2f1b6121941e665f0b85117f555debd209bf97169d91c97e2b9def0e94`
- Production project:
  `pgzizndxdyhqmtyywjmt`
- Production migration count/head:
  `171 / 20260922143000_mizizi_url_identity_authority_window_close_v1`
- public/editorial schema type SHA-256:
  `5d229c68d65b3360ecef98882ed059b09a2e57b43daf3343358d1231b14aa1d3`
- canonical Production schema seal generated:
  `2026-09-22T15:39:12Z`
- schema-seal mode/source:
  `production / pgzizndxdyhqmtyywjmt`

The public/editorial type hash is unchanged because this migration adds only a
private `mizizi_private` reduction primitive.

## Preview replay authority

Disposable Preview:

- name: `mizizi-url-identity-1013`
- branch id: `d5d4610d-2613-40ce-91b5-7f398ade3b10`
- project ref: `lscfgarfnhfqtohcdvmg`
- parent Production: `pgzizndxdyhqmtyywjmt`
- Production baseline replay: 170 migrations
- candidate native `supabase db push --linked`: PASS
- resulting Preview ledger:
  `171 / 20260922143000_mizizi_url_identity_authority_window_close_v1`
- zero pending after apply: PASS
- permanent SQL verifier:
  `MIZIZI_URL_IDENTITY_AUTHORITY_WINDOW_CLOSE_PASS`

Real reduction behavior was also accepted through a genuine JIT database
session:

- `session_user = mizizi_executor`
- `current_user = mizizi_executor`
- enabled operation closed to disabled
- standing grant closed to `expired`
- active exact descendants after close: 0
- exactly one close audit event
- JIT mapping restored
- temporary access returned disabled

The behavior fixture did not contain or mutate a Registry entity.

## Production deployment provenance

The Production migration was promoted through the repository's canonical
exact-main path.

After PR #1015 merged as
`723c7054abe5a50cc807ed791804e41e77d1880b`, a disposable promotion
launcher was created on
`ops/tmp-promote-url-identity-1015`.

An immediate commit-scoped workflow lookup returned no run, so a second
PR-triggered launcher was created. That interpretation was wrong: the original
push-triggered run had been delayed in GitHub's enqueue path and materialized
afterward.

The authoritative first launcher was:

- workflow run: `35748027416`
- job: `106814564828`
- trigger: push
- launcher head:
  `380dad3b8544963226c3677b7d5b93b492702822`

That job:

1. switched itself to exact protected `main`;
2. proved
   `HEAD = origin/main = 723c7054abe5a50cc807ed791804e41e77d1880b`;
3. linked exact Production
   `pgzizndxdyhqmtyywjmt`;
4. proved exactly one pending migration:
   `20260922143000_mizizi_url_identity_authority_window_close_v1.sql`;
5. invoked
   `bash scripts/control-plane/promote-repository-migrations.sh`;
6. the canonical script ran its own parity and native dry-run gates;
7. native `supabase db push --linked` applied the migration at
   `2026-09-22T15:33:16Z`;
8. the script verified zero pending migrations and emitted
   `REPOSITORY_MIGRATION_PROMOTION_PASS`.

Production Postgres logs independently corroborate the same apply:

- session:
  `6ab29fbb.293800`;
- database user:
  `cli_login_postgres`;
- application:
  `Supavisor`;
- exact reducer DDL began at
  `2026-09-22T15:33:16Z`;
- revoke/grant hardening completed by
  `2026-09-22T15:33:17Z`.

The second launcher, workflow run `35748103516`, started later. Its native
dry-run reported `Remote database is up to date` because the first launcher
had already completed the canonical promotion. It failed its exact pending-set
guard and did not mutate Production.

A subsequent read-only forensic audit also proved:

- no Supabase GitHub Integration connection was attached to the Production
  project through the queried Management API surface;
- no Supabase Production action run existed in the 15:20-15:45 UTC window;
- the merge-commit Critical workflow was running anonymous RLS tests at the
  exact apply time and had not reached its linked Supabase CLI drift checks;
- pinned Supabase CLI `v2.107.0` source confirms `supabase link` does not
  apply repository migration files.

Therefore the Production apply provenance is fully attributed: **the first
exact-main disposable launcher executed the repository's canonical promotion
script successfully**. There was no external or unexplained migration writer.

The incident was orchestration ambiguity, not migration-authority drift. Its
preventive control is now a permanent serialized Production-promotion workflow,
with one manual dispatch, an exact main SHA, an exact reviewed pending set, and
the same canonical script.

## Production SQL acceptance

Permanent verifier:

`MIZIZI_URL_IDENTITY_AUTHORITY_WINDOW_CLOSE_PASS`

Zero-at-rest authority after Production apply:

- enabled stewardship operation types: 0
- active MIZIZI standing capability grants: 0
- active MIZIZI exact execution grants: 0

Reducer ACL:

- `mizizi_executor` execute: yes
- `authenticated` execute: no
- `service_role` execute: no

Post-DDL Supabase security advisor inspection found no candidate-specific
finding for
`mizizi_private.close_stewardship_authority_window_v1(text,uuid,text)`.

## Release apply partial-stop receipt

Governed run `35757733981` entered with the exact 737-candidate Release
fingerprint and exact human authority. It completed 731 one-row operations with
independent verifier PASS and 731 matching canonical write events.

The runner reported:

- `applied = 731`;
- `stale = 6`;
- `queued_for_review = 0`;
- `observed_findings = 737`.

The authority-window reducer then succeeded before final acceptance:

- Release operation returned disabled;
- standing grant returned expired;
- active exact descendants: zero;
- active standing / exact authority at rest: 0 / 0;
- JIT mapping restored;
- Production temporary access disabled.

Final acceptance correctly failed on
`verifiedDelta=731 expected 737`. The six successes missing from that delta
were not lost writes; they were never executed because the dynamic Release plan
changed after the first sibling in each collision pair had already adopted its
date fallback.

Read-only reconstruction proves the 731 stored exact plan payloads plus the six
provenance-repaired remaining plans still produce the original 737-candidate
fingerprint exactly. The programme therefore remains resumable without
replaying accepted writes or widening authority.

## Current URL-identity programme boundary

Accepted automatic mutation families remain only:

- `release_slug` → `registry.release_slug.canonicalize/v1`
- `chart_track_slug` → `registry.chart_track_slug.synchronize/v1`

Still non-automatic:

- Track slug: blocked review work
- Release title packaging: observe-only
- Chart Artist slug: observe-only

The control plane cannot manufacture its own standing authority. Any future apply
still requires an already-issued exact human `manage_registry` grant, the exact
operation enabled by that human authority, exact reviewed candidate
fingerprints, exact merged-main trigger authority, and the JIT
`mizizi_executor` transport.

## Deployment classification

- repository migration present in Production: yes
- Production verifier: PASS
- Production zero-at-rest authority: PASS
- Edge Function deployment: none
- frontend deployment: none
- Production Release-slug cleanup mutation: **partial — 731 verified writes accepted, six exact rows remain**
- Production Release-slug canonical write events: **731**
- remaining deterministic Release-slug candidates: **6**
- Release operation after partial stop: **disabled**
- active MIZIZI standing/exact grants after partial stop: **0 / 0**
- partial-run control-plane artifact: `10708079992`
- partial-run artifact SHA-256:
  `32e662ffbba5870c3819da96f2caff140d178d2876b5a52e74b4b6156d2e090d`
- Chart Track-slug cleanup mutation: **not run**
- forward repair required before resume:
  `20260922171632_mizizi_release_slug_resume_integrity_v1.sql`
- schema seal: public/editorial type hash remains unchanged by the private-function repair


## Release resume repair Production promotion

Repair PR **#1025** merged to protected main as:

`a2157a4bba5adc2fb097092cfb5b56db250044a4`

Canonical repository migration promotion ran through workflow
`Repository Migration Production Promotion`, run
`35766731078`, bound to that exact merged-main SHA and the exact reviewed
pending filename:

`20260922171632_mizizi_release_slug_resume_integrity_v1.sql`

The promoter passed:

- exact protected-main authority;
- exact Production project link;
- exact reviewed pending-set check;
- canonical `scripts/control-plane/promote-repository-migrations.sh`;
- native `supabase db push --linked`;
- zero-pending post-promotion verification.

Accepted durable Production schema state:

- project ref: `pgzizndxdyhqmtyywjmt`;
- migration count: **172**;
- migration head: `20260922171632`;
- repair ledger row: present;
- permanent verifier:
  `MIZIZI_RELEASE_SLUG_RESUME_INTEGRITY_PASS`;
- committed public/editorial type SHA-256 remains
  `5d229c68d65b3360ecef98882ed059b09a2e57b43daf3343358d1231b14aa1d3`;
- the promoted repair replaces only private planner authority and introduces no
  public/editorial type surface.

Post-promotion Registry state remains deliberately unchanged:

- verified Release-slug operations: **731**;
- Release-slug canonical write events: **731**;
- remaining deterministic Release-slug candidates: **6**;
- Release operation enabled: **false**;
- active standing/exact MIZIZI grants: **0 / 0**.

Production security advisor inspection reports no finding naming the repaired
Release planner, the resume-integrity migration, or `mizizi_private`.

The disposable Preview branch
`d64d23b3-4150-437c-8fdc-db83c8482ec7`
(`ltcwajcrqdbefhulzibv`) was deleted after Production acceptance. Supabase
branch inventory returned to **Production/main only**.

No Registry cleanup mutation was executed by this promotion. A separate,
freshly reviewed human approval and trigger is still required for the exact
six-row resume.


## Final Release-slug resume acceptance

The six-row forward resume is Production accepted.

Human approval:

- grant:
  `833e42c4-44ae-46f8-8014-3a38aef6235d`;
- approved main:
  `84e26cd90dff9d839b62138db8e336cf698d86ef`;
- approved resume fingerprint:
  `2be28e013ce904e2a05f5d3c368304684c08a6ad7eadfe23a99c57162d0091b2`;
- original 737-programme fingerprint:
  `b96da159df4ffa8b19a5bb39574995a6b25cac2552823ef24af8f737fb1278be`.

Protected trigger review:

- PR: **#1030**;
- changed files: **1**;
- changed lines: **1 addition / 1 deletion**;
- URL-identity PR preflight:
  `35769222291`: **PASS**;
- preflight authority mode:
  `reviewed_human_authority`;
- preflight Release programme state:
  `accepted_partial`;
- preflight Registry mutation: **NO**;
- Critical:
  `35769222206`: **PASS**.

Merged trigger authority:

`605d08052b12478b75151c8d41ab6c29e5c6b9dd`

Authoritative Production apply:

- workflow:
  `MIZIZI URL Identity Production Control Plane`;
- run:
  `35769680464`;
- event:
  `push`;
- exact head:
  `605d08052b12478b75151c8d41ab6c29e5c6b9dd`;
- result:
  **PASS**;
- evidence artifact:
  `mizizi-url-identity-production-control-plane-35769680464`;
- artifact id:
  `10713493272`;
- artifact SHA-256:
  `3219105d22c025e4929c71fbfba9f7fe1b410abf09feb7afbc9faeb4a555d8d8`.

The control plane executed exactly six one-row Release operations. Independent
Production inspection proves every descended exact grant was consumed, every
operation succeeded with `affected_rows = 1`, every verifier passed, and the
final stored slug equals the frozen planned slug.

Final six slugs:

- `nilotic-ep` -> `nilotic-2022-04-01`;
- `wameyo-single` -> `wameyo-2025-10-10`;
- `maybe-single` -> `maybe-2022-09-23`;
- `kesho-ep` -> `kesho-2023-10-27`;
- `catch-a-vibe-ep` -> `catch-a-vibe-2021-03-26`;
- `son-of-the-city-ep` -> `son-of-the-city-2020-11-22`.

All six matching canonical write events are
`canonicalize_release_slug / succeeded / system:mizizi`.
The Release title strings remain unchanged.

Final Release programme ledger:

- verified operations: **737**;
- canonical write events: **737**;
- remaining deterministic Release-slug candidates: **0**;
- fresh post-apply Release audit findings: **0**.

Authority closure:

- Release operation enabled: **false**;
- final human grant status: **expired**;
- active MIZIZI standing grants: **0**;
- active exact grants: **0**;
- JIT mapping restored;
- Production temporary access disabled at rest.

Permanent verifier after the final apply:

`MIZIZI_RELEASE_SLUG_RESUME_INTEGRITY_PASS`

Push Critical run `35769680551`: **PASS** through replay, browser
acceptance, security/RLS, live schema drift and application build.

### Parent programme remains open

This closes the Release-slug mutation family only. Current Production still
contains:

- **66** open Track `mizizi_data_hygiene` review items; and
- **161** derived Chart Track-slug drifts.

Issue #1013 therefore remains open for those two boundaries. Release-slug
authority must remain closed unless new evidence creates a new separately
reviewed programme.


## Final Chart Track-slug Production acceptance

Human approval:

- grant:
  `c5c518d4-4fbf-4ee4-9379-47b13a598add`;
- approved main:
  `9272ce3c31b9c4402f7b21f1f4b8aae3c48e8b8a`;
- candidate count:
  **161**;
- candidate fingerprint:
  `28a3b8362f8721ad4f35045a2cd938d265adf35373b522b492054af80eb8a910`;
- operation:
  `registry.chart_track_slug.synchronize/v1`.

Protected trigger review:

- PR:
  **#1032**;
- changed file:
  `.github/mizizi-url-identity-production-apply.json`;
- URL-identity PR preflight:
  `35771365881`: **PASS**;
- preflight authority mode:
  `reviewed_human_authority`;
- preflight current Chart Track-slug candidates:
  **161**;
- preflight Release programme state:
  `accepted_final`;
- preflight Registry mutation:
  **NO**;
- Critical:
  `35771366123`: **PASS**.

Merged trigger authority:

`6109dc18f1e79c45d4c04a92cff51f4563daf2de`

Authoritative Production apply:

- workflow:
  `MIZIZI URL Identity Production Control Plane`;
- run:
  `35771792617`;
- event:
  `push`;
- exact head:
  `6109dc18f1e79c45d4c04a92cff51f4563daf2de`;
- result:
  **PASS**;
- evidence artifact:
  `mizizi-url-identity-production-control-plane-35771792617`;
- artifact id:
  `10714830965`;
- artifact SHA-256:
  `965e6e5500ea00f9a78e0480e2ee61506a28a69c6ffc9a36b0069202fe1e87f9`.

The accepted apply reported:

- applied Chart rows: **161**;
- queued-for-review: **0**;
- stale outcomes: **0**;
- Chart Artist observations remained observe-only;
- human authority reduced before final acceptance;
- JIT mapping restored;
- Production temporary access disabled at rest.

Independent Production proof after the run:

- exact child execution grants descended from the approval:
  **161**;
- consumed child grants:
  **161**;
- succeeded + verifier-passed typed operations:
  **161**;
- operations with `affected_rows = 1`:
  **161**;
- final Chart slug exactly equals the frozen planned slug and current canonical
  Track slug:
  **161**;
- mismatches:
  **0**;
- matching canonical write events:
  **161**;
- remaining Chart Track-slug drift:
  **0**.

Authority closure:

- Chart operation enabled:
  **false**;
- final human grant status:
  **expired**;
- active MIZIZI standing grants:
  **0**;
- active exact grants:
  **0**.

Cross-family preservation:

- Release verified operations:
  **737**;
- Release canonical write events:
  **737**;
- Release remaining deterministic slug candidates:
  **0**;
- open Track `mizizi_data_hygiene` review items:
  **66**, unchanged.

Push Critical run `35771792584`:
**PASS** through replay, browser acceptance, security/RLS, live-schema drift and
application build.

The 91 Chart Artist-slug findings remain observe-only and were not authorized
for mutation by this slice.

### Post-Chart control-plane seal

After the accepted 161-row apply, the current Chart candidate set is correctly
zero. Future protected preflight must recognize that exact accepted-final
boundary by reconstructing the original Chart programme from succeeded verified
grant history and requiring the reconstructed candidate fingerprint to remain:

`28a3b8362f8721ad4f35045a2cd938d265adf35373b522b492054af80eb8a910`.

This prevents the closed 161-candidate authority from being silently forgotten
or reused for future new Chart drift.

### Remaining #1013 work

The automatic Release-slug and derived Chart Track-slug families are closed.
Issue #1013 remains open only for the **66** Track
`mizizi_data_hygiene` review items.

Those review rows are not automatic Track-write authority.
