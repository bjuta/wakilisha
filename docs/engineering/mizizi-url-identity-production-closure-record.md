# MIZIZI URL Identity Programme — Production Closure Record

## Status

**PRODUCTION SCHEMA ACCEPTED — governed Registry apply remains separately human-authorized.**

This record closes the schema/control-plane deployment shipped through PR #1015.
It does **not** authorize or claim execution of the Release-slug or Chart Track-slug
canonicalization programme itself.

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

Immediately after merge, an independent ledger check still showed Production at
170 migrations with the candidate absent.

A disposable exact-main promotion launcher was then prepared. Before its
canonical promotion step could run, its pinned Supabase CLI
`db push --dry-run --linked` reported:

`Remote database is up to date.`

An independent Production ledger read then showed the exact canonical candidate
version present at the head.

Therefore:

- the disposable launcher **did not apply** the migration;
- the canonical promotion step in that launcher was skipped;
- the exact external/native apply actor or process is not observable through the
  available GitHub/Supabase connector metadata;
- no repository workflow contains an automatic `supabase db push` path;
- the live ledger version and name exactly match the repository migration.

Per the stopped-deployment rule, the already-completed Production mutation was
not replayed merely to manufacture a cleaner deployment log. Closure resumed
with read-only live-state verification.

This provenance gap must remain recorded; it is not rewritten as a successful
canonical-script promotion.

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
- Production Registry cleanup mutation: **not run by this closure**
- schema seal: Production reconciliation required in this closure PR
- disposable Preview: delete only after this closure PR is merged
