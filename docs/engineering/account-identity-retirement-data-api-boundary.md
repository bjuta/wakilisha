# Account retirement Data API deferred-integrity repair

Date: 15 September 2026

## Status

Root-cause repair for the real Data API failure discovered while cleaning the
successful Artist-enrichment Production runtime-smoke principal.

The historical-event freeze compatibility repair remains valid and independent.
Migration `20260915213000` restored Auth deletion through the frozen historical
event tables. A later real PostgREST retirement still failed with:

`42501 permission denied for table people`

## Evidence that isolated the failure

The same Production administrator JWT and the same governed retirement command
were executed in a rollback-only database session with
`current_user = authenticated`. The retirement completed through account
deletion and Person archival, and rollback restored the target cleanly.

A first Preview repair moved the privileged implementation out of `public`,
introduced a SECURITY INVOKER public facade, and kept the executor
SECURITY DEFINER in a non-exposed schema. Real `supabase-js` acceptance still
failed with the identical `42501`.

That disproved "SECURITY DEFINER in public" as the root cause.

## Proven root cause

Person identity integrity is enforced by DEFERRABLE INITIALLY DEFERRED
constraint triggers.

Account retirement mutates:

- `editorial.person_identity_links`;
- `editorial.people`;
- Person Resource visibility/lifecycle state.

The relevant deferred triggers include:

- `editorial.people_identity_integrity`;
- `editorial.people_merge_cycle_integrity`;
- `editorial.person_identity_links_preferred_integrity`.

The first and third execute
`editorial.assert_person_identity_integrity()`. The merge-cycle trigger executes
`editorial.assert_person_merge_cycle_integrity()`.

Those integrity functions are intentionally SECURITY INVOKER. They read
`editorial.people` and related private identity state.

Before this repair, the postgres-owned retirement function returned before the
deferred constraints were fired. In a PostgREST request, the transaction then
reached commit under the outer authenticated role. The deferred integrity
triggers ran there, attempted to read `editorial.people`, and correctly hit the
private-table ACL.

This is the same transaction-boundary class already documented and repaired for
Auth signup by
`20260815084011_repair_auth_signup_person_deferred_integrity_context.sql`.
That accepted repair forces the reviewed Person/Resource constraints to
IMMEDIATE while still inside a postgres-owned SECURITY DEFINER function, then
restores them to DEFERRED.

## Accepted architecture

The stable application contract remains:

`public.retire_account_identity(...)`

It is a narrow SECURITY INVOKER facade that checks:

- authenticated JWT context;
- `manage_people_identity`;
- `manage_users`.

It delegates to:

`account_identity_private.retire_account_identity(...)`

That function is a postgres-owned SECURITY DEFINER transaction orchestrator.
It:

1. establishes the reviewed Person/Resource constraints as DEFERRED;
2. calls the original retirement implementation, moved intact to
   `account_identity_private.retire_account_identity_core(...)`;
3. forces the six reviewed constraints to IMMEDIATE before privileged execution
   returns;
4. therefore executes all retirement-generated deferred integrity under
   postgres authority;
5. restores those constraints to DEFERRED for the surrounding transaction;
6. only then returns to the Data API.

The original core still owns every account-retirement semantic:

- capability validation;
- self-retirement refusal;
- target Person/revision/link verification;
- privileged-target refusal;
- durable FK blocker scan;
- governed Person unlink;
- retired UUID snapshot;
- tombstone;
- orphan Person archival;
- alias retirement;
- Auth deletion;
- command receipt/idempotency.

## Security properties intentionally preserved

This repair does **not**:

- grant `authenticated` SELECT on `editorial.people`;
- grant `authenticated` SELECT on `auth.users`;
- make the Person integrity trigger functions SECURITY DEFINER globally;
- grant authenticated execution of the private retirement core;
- use service-role account deletion as the product path;
- use a DB-session-only Production cleanup path;
- bypass command receipts;
- special-case the smoke fixture;
- weaken the historical-event freeze.

The private schema contains only the retirement orchestrator and original core.
It is not a Data API schema.

## Required acceptance

The disposable Preview must prove, through real `supabase-js` HTTP:

1. no-capability caller receives `42501`;
2. private schema is not exposed through the Data API;
3. administrator Auth login succeeds;
4. the public retirement RPC returns a succeeded receipt;
5. Auth/profile/roles disappear;
6. Person archives at revision 3;
7. historical link retains the retired Auth UUID snapshot;
8. tombstone and Person events exist;
9. generic retirement verifier passes;
10. historical-event freeze verifier passes;
11. the new boundary verifier proves the deferred-integrity flush and rejects
    broader privilege changes;
12. generated public/editorial types remain byte-identical;
13. migration replay contract is sealed from that exact Preview;
14. full critical tests and build pass.

Production promotion is forbidden until every gate is green.
