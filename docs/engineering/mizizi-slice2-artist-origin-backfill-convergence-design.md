# MIZIZI Slice 2 — Artist Origin Backfill Convergence

Date: 14 September 2026

Status: **DESIGN AUTHORITY — IMPLEMENTATION NOT YET PRODUCTION-ACTIVE**

Issue: #937

Base authority: `123f936e5f8da5cef9987ec2747d9ecfe5dda53a`

Programme authority: `docs/engineering/mizizi-registry-authority-security-convergence-programme.md`

## 1. Objective

Converge the canonical-write side of `backfill-artist-origin` onto the typed Artist-origin admission authority proven by #935 / PR #936, while preserving the function's observation and resolution behavior.

The Edge Function may discover evidence. It must no longer possess ambient authority to mutate canonical Registry Artist origin fields.

This work remains inside Slice 2. It does not retire the Edge Function, does not touch `scrape-artist-data`, and does not begin Slice 3.

## 2. Entry authority

At entry:

- merged main is `123f936e5f8da5cef9987ec2747d9ecfe5dda53a`;
- Production migration head is `20260914193100`;
- `registry.artist_origin.admit/1` is installed and disabled;
- MIZIZI has no active Artist-origin standing grant;
- there are zero Artist-origin exact grants, operations, evidence assertions, and canonical write events;
- the #935 Preview has been deleted.

The existing typed operation remains the canonical mutation contract:

- one existing Artist;
- one-row maximum;
- `origin_iso2` + `origin_confidence` only;
- strict ISO2;
- confidence `0.90..1.00`;
- exact state fingerprint;
- exact target fingerprint;
- bound evidence;
- five-minute-or-shorter exact grant;
- independent verifier.

## 3. Current backfill authority

Production `backfill-artist-origin` is ACTIVE v21 with `verify_jwt=true`.

Its current flow is:

1. validate a bearer user;
2. create a service-role database client;
3. find active/draft Artists with missing origin;
4. normalize `metadata.country` or query MusicBrainz;
5. update `registry_artists.origin_iso2` and `origin_confidence` directly through service-role DML.

There is no `manage_registry` check before mutation.

The service-role credential is itself canonical mutation authority. Therefore deleting the visible `.update()` calls while leaving `SUPABASE_SERVICE_ROLE_KEY` in the function would not close the security gap.

## 4. Product caller defect discovered during audit

The Registry Artists page intentionally runs bulk backfill in chunks of 25.

The Artist detail page labels its action as an origin backfill for the current Artist, but sends only:

- `dry_run: false`;
- `use_musicbrainz: true`;
- `batch_size: 150`.

It sends no Artist ID. The Edge Function has no Artist-ID filter. Therefore the detail-page action can currently mutate up to 150 unrelated missing-origin Artists.

The converged contract must add an explicit `artist_id` request option and the detail page must use it.

Bulk backfill remains orchestration over many exact one-Artist admissions; it does not become a multi-row mutation primitive.

## 5. Read authority after convergence

Production authority already permits authenticated Registry admins to SELECT the required Artist rows while direct table UPDATE is not granted to `authenticated`.

Therefore the converged Edge Function will use:

- `SUPABASE_URL`;
- `SUPABASE_ANON_KEY`;
- the request bearer JWT.

It will not load `SUPABASE_SERVICE_ROLE_KEY`.

This gives the observer enough authority to:

- validate the caller;
- prove `manage_registry`;
- select eligible Artists through RLS;
- invoke the narrow admin admission RPCs.

It cannot perform direct canonical DML.

## 6. Human authority and execution actor are distinct

#935 correctly models MIZIZI as a System Actor whose policy-issued exact grants depend on a human-issued standing System-Actor capability grant.

Human admin backfill must not be recorded as `mizizi`.

The converged model preserves two separate facts:

1. **authority principal:** the authenticated human user with `manage_registry`;
2. **execution actor:** a narrow platform automation dedicated to human Artist-origin admission.

The automation actor does not receive autonomous standing authority. It can execute a human exact grant only while the authenticated user in the live request is the recorded exact-grant issuer and still has `manage_registry`.

## 7. Admin admission automation

Introduce System Actor:

`registry_artist_origin_admin`

Kind:

`automation`

Purpose:

Execute exact human-authorized `registry.artist_origin.admit/1` grants through the existing canonical executor.

The actor is not MIZIZI and must never receive a MIZIZI standing grant.

Its executor transport is the PostgREST `authenticator` database login role. This is transport identity only; it is not mutation authority.

The private evidence/policy/executor/verifier functions remain revoked from:

- `PUBLIC`;
- `anon`;
- `authenticated`;
- `service_role`.

Only capability-gated `SECURITY DEFINER` admin RPCs may enter the human exact-grant path.

## 8. Exact-grant convergence

The current exact-grant table requires a non-null `system_actor_capability_grant_id` for every grant. That is correct for autonomous System-Actor policy grants but too narrow for a directly human-authorized exact mutation.

Converge it without weakening the MIZIZI path:

### Policy/System-Actor exact grant

Must retain all current requirements:

- `issued_by_user_id is null`;
- `issued_by_principal_key = policy:<key>`;
- non-null active `system_actor_capability_grant_id`;
- active System Actor;
- active executor binding;
- active standing capability grant;
- enabled operation.

### Human exact grant

Must require:

- non-null `issued_by_user_id`;
- `issued_by_principal_key = user:<same uuid>`;
- null `system_actor_capability_grant_id`;
- fixed actor `registry_artist_origin_admin`;
- live `auth.uid()` equals `issued_by_user_id` at begin/resume;
- live user still has `manage_registry`;
- active admin automation actor;
- active admin executor binding;
- enabled operation;
- the same operation/plan/target/state/TTL/row-budget rules as policy grants.

Add a direct FK from `registry_execution_grants.actor_key` to `system_actors.actor_key` because the existing composite standing-grant FK does not enforce actor existence when the standing-grant ID is null.

No generic user grant surface is introduced. The only human exact-grant issuer in this substep is the Artist-origin admin bridge.

## 9. Evidence recording

Existing MIZIZI evidence recording remains unchanged.

Add a human evidence recorder that derives the recorder identity from `auth.uid()`; the caller cannot supply or spoof a user principal.

Extend `registry_evidence_assertions.recorded_by_principal_key` to admit:

`user:<uuid>`

for authenticated human evidence recording.

The human recorder must:

- require `manage_registry`;
- accept only the existing Artist-origin source kinds;
- preserve strict ISO2 and confidence bounds;
- preserve the same 30-day observation freshness window;
- preserve deterministic assertion fingerprinting and retry idempotency;
- store the same trust classification semantics as the existing operation.

Provider/web observations remain evidence, never authority.

## 10. Human exact-grant policy gateway

Add a private human gateway dedicated to Artist Origin V1.

It must derive the plan from the immutable evidence assertion and current canonical Artist state exactly as the MIZIZI gateway does.

It must never accept:

- table names;
- column names;
- arbitrary JSON patch payloads;
- arbitrary operation keys;
- arbitrary target sets;
- user-supplied expected-state hashes.

The human gateway records:

- actor `registry_artist_origin_admin`;
- issuer `user:<auth.uid()>`;
- `issued_by_user_id = auth.uid()`;
- no standing System-Actor grant;
- same ruleset semantics;
- one target;
- one row;
- exact expected state;
- five-minute-or-shorter expiry;
- deterministic idempotency key.

## 11. Public admin RPC boundary

Add two authenticated admin RPCs.

### Execute

A capability-gated RPC accepts only typed Artist-origin evidence inputs and an idempotency key.

It:

1. requires `auth.uid()`;
2. requires `manage_registry`;
3. records immutable evidence as the user;
4. issues the exact human grant;
5. executes the existing dedicated Artist-origin executor;
6. returns the operation ID and execution outcome.

The executor remains one-row and compare-and-set.

### Verify

A separate capability-gated RPC accepts the operation ID and calls the existing independent verifier.

The Edge Function must call execution and verification in separate RPC requests so verification remains a distinct transaction.

## 12. Operation activation

The operation type is currently disabled because #935 installed schema without activating mutation authority.

#937 may enable `registry.artist_origin.admit/1` for the human product path after Preview acceptance.

Enabling the operation does **not** enable autonomous MIZIZI execution because:

- no MIZIZI standing Artist-origin grant is created;
- no MIZIZI exact grant is created;
- the MIZIZI broker remains unable to pass the policy gateway without its explicit human standing grant.

The operation-level kill switch remains shared: disabling the operation immediately blocks both admin and future MIZIZI execution.

Rename/add the human-facing control RPC so the operation kill switch is not semantically named as a MIZIZI-only switch. Preserve the existing MIZIZI-named RPC as a compatibility wrapper if required.

## 13. Edge Function contract

The converged `backfill-artist-origin` function will:

- require bearer auth;
- use `SUPABASE_ANON_KEY`, never service role;
- require `manage_registry` before observation begins;
- accept optional exact `artist_id`;
- retain `dry_run`;
- retain optional MusicBrainz observation;
- bound bulk candidate count;
- resolve each Artist independently;
- for dry-run: return proposals only;
- for mutation: execute one exact admin admission RPC per Artist;
- call the verifier RPC separately for each successful execution;
- report rejected/inadmissible proposals without direct mutation fallback;
- never construct arbitrary SQL or a generic patch payload.

If the typed operation is disabled, observation-only dry-run remains usable but mutation requests fail closed.

## 14. Confidence behavior

The typed operation admits confidence `>= 0.90`.

Metadata normalization produces exactly `0.90` and remains admissible.

MusicBrainz can produce lower confidence. Those observations may be returned and/or recorded as evidence, but must not mutate canonical state below the admission threshold.

The Edge Function must report policy rejection rather than silently lowering the threshold or bypassing the broker.

## 15. Detail-page correction

The Artist detail caller must pass the current Artist UUID as `artist_id`.

The detail action must never fall back to an arbitrary missing-origin batch when the exact Artist is ineligible or already resolved.

Bulk page behavior remains chunked orchestration.

## 16. Charts remains separate

`chart_set_artist_origin_for_charts` remains outside this patch.

Reasons:

- its caller already supplies an explicit Artist ID;
- it carries chart-run/source provenance;
- it has its own chart-origin resolution audit lifecycle;
- its confidence semantics are currently fixed at `1`;
- its authority boundary is `chart-ingest-api`, not generic Registry backfill.

Those semantics deserve a separate convergence issue after #937.

## 17. Required adversarial acceptance

Preview acceptance must prove at minimum:

- unauthenticated request rejected;
- authenticated user without `manage_registry` rejected;
- Edge Function contains no service-role credential reference;
- authenticated role still has no direct Registry Artist UPDATE grant;
- detail request targets only its explicit Artist;
- bulk request is orchestration over one-row operations;
- disabled operation rejects mutation but dry-run still works;
- invalid ISO2 rejected;
- confidence below `0.90` rejected for admission;
- established origin overwrite rejected;
- stale state rejected;
- tampered evidence/plan rejected;
- human grant cannot execute under a different JWT user;
- human grant cannot execute after user capability loss;
- MIZIZI grant semantics remain unchanged;
- no MIZIZI standing grant is created;
- exact-grant replay is idempotent;
- verifier replay is idempotent;
- exactly two canonical write events are linked for one successful mutation;
- write-event actor/causality preserves the human issuer;
- no unrelated Artist field changes.

## 18. Production activation discipline

Implementation order:

1. create migration through the canonical Supabase CLI workflow;
2. implement the grant/evidence/begin-operation convergence;
3. update permanent SQL verifier;
4. remove service-role authority from the Edge Function;
5. fix exact-subject detail caller;
6. harden the privileged-writer manifest and Phase 0B verifier;
7. local tests;
8. disposable Preview replay;
9. adversarial acceptance;
10. deploy changed Edge Function to Preview and accept the real caller class;
11. seal replay/schema evidence;
12. open PR only after proof;
13. protected Critical Control Plane;
14. merge exact head;
15. canonical merged-main Production migration promotion;
16. deploy only the changed Edge Function from merged main;
17. independent Production acceptance.

## 19. Exit gate

#937 closes only when `backfill-artist-origin` no longer contains ambient service-role canonical mutation authority and all non-dry-run Artist-origin writes flow through exact human-issued grants and the canonical typed executor/verifier.

Completion of #937 does not close Slice 2 and does not authorize Slice 3 retirement.