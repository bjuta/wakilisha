# Account Identity Retirement Implementation Audit

Date: 19 August 2026

## Status

Implementation audit and milestone boundary for permanent retirement of a live Auth account while preserving Person identity governance history.

Accepted merged main:

`598ccb9f0cc5f5d5f0de80819be660454279b2be`

No account is retired by the migration itself.

## Approved production target

User:

`7ea8fb65-287b-409e-9bb9-a81bc74e4e75`

Username:

`beautahj`

Person Resource:

`12604a1a-3b9a-44ca-8c11-9f5805d7137e`

Person identity link:

`360a80db-60fe-4254-bba1-b07d6da788ab`

Canonical Person path:

`/people/beautahj`

## Reviewed live production footprint

Before retirement:

- Auth user exists and is active.
- public profile exists, username `beautahj`, public and active.
- Person is active at identity revision 1.
- Person Resource is public and active.
- one active account-provisioning Person identity link exists and is preferred.
- one append-only `person_created` event references that exact link.
- one canonical `/people/beautahj` alias exists.
- 0 Credits.
- 0 Posts.
- 0 Comments.
- 0 Person-target Follows.
- 4 account-owned Follows.
- 4 account-owned Community Activity rows.
- one Auth identity and one Auth session exist.
- one claimed guest-follow intent exists.
- one Registry onboarding user-state row exists.
- one community profile exists.
- one subscriber role assignment exists.
- one admin audit row references the target account with `ON DELETE SET NULL`.

A full FK audit found exactly one live deletion blocker:

`editorial.person_identity_links.user_id -> public.user_profiles.user_id ON DELETE RESTRICT`

All other current target-account references either cascade on Auth deletion or become null safely.

## Why ordinary Person unlink is not enough

`public.unlink_person_identity(...)` is already the authoritative governed unlink command.

It correctly:

- requires `manage_people_identity`;
- validates Person revision;
- retires the active identity link;
- clears preferred identity when needed;
- increments Person identity revision;
- appends `identity_unlinked` evidence;
- refreshes Person visibility;
- records a durable command receipt.

However it intentionally preserves the historical link row and therefore leaves `person_identity_links.user_id` populated.

Because that column references `public.user_profiles(user_id)` with `ON DELETE RESTRICT`, deleting the Auth user would still cascade toward a profile row that cannot be deleted.

The solution must preserve historical account identity without weakening or dropping that FK boundary.

## New generic authority

The migration introduces:

1. `editorial.retired_account_identities`
   - durable tombstone keyed by the historical Auth user UUID;
   - preserves the Person, identity link, username snapshot, reason, actor, correlation, and outer command receipt;
   - does not depend on the live Auth user row.

2. `editorial.person_identity_links.retired_user_id_snapshot`
   - preserves the old Auth user UUID on retired/superseded historical links;
   - references the retired-account tombstone rather than `user_profiles`;
   - is mutually exclusive with live `user_id`.

3. a narrowly extended identity-link immutability trigger
   - ordinary retargeting remains forbidden;
   - the only new source transition allowed is:
     - historical link already `retired` or `superseded`;
     - live `user_id` becomes null;
     - `retired_user_id_snapshot` becomes the exact same UUID.

4. command type `account.identity_retire`.

5. `public.retire_account_identity(...)`
   - requires both `manage_people_identity` and `manage_users`;
   - cannot retire the current administrator's own account;
   - rejects privileged target operators;
   - dynamically scans every `RESTRICT` / `NO ACTION` FK to `auth.users` or `user_profiles` and refuses retirement if durable blockers exist;
   - reuses `public.unlink_person_identity(...)` rather than reproducing unlink internals;
   - creates the retired-account tombstone;
   - converts all retired/superseded historical account links to tombstone-backed UUID snapshots;
   - archives the Person only when no other active identity remains;
   - retires all remaining public Person aliases only when the Person is orphaned and archived;
   - deletes the Auth user only after all blocker and historical-identity checks pass;
   - relies on existing cascade / `SET NULL` FK behavior for ordinary account-owned state;
   - emits a durable `account.identity_retire` command receipt.

## Expected approved beautahj command sequence

Starting state:

- Person revision 1.
- account identity link active and preferred.

Execution:

1. `person.identity_unlink` retires the account identity link and moves Person revision 1 -> 2.
2. historical link copies the exact target user UUID into `retired_user_id_snapshot` and clears live `user_id`.
3. no active identities remain, so Person becomes archived and revision 2 -> 3.
4. `person_archived` append-only evidence is written.
5. `/people/beautahj` is retired from public routing.
6. Person Resource becomes internal + archived with no owner.
7. Auth user is deleted.
8. account-owned cascade state disappears through existing FKs.
9. outer `account.identity_retire` receipt succeeds.

Expected final state:

- Auth user absent.
- public profile absent.
- Person retained as archived audit tombstone at revision 3.
- original identity link retained as retired audit evidence.
- original `person_created` event retained unchanged.
- `identity_unlinked` and `person_archived` events present.
- historical Auth UUID preserved in `retired_user_id_snapshot` and `retired_account_identities`.
- `/people/beautahj` no longer public.
- no account-owned Follow, activity, role, profile, Auth session, or onboarding state remains.

## Preview acceptance

Before production execution:

- full accepted migration history must remain green;
- migration authority must apply cleanly to the retained disposable preview;
- a preview-only throwaway account must exercise the same command path;
- blocker detection must be demonstrated;
- successful retirement must preserve historical Person events and link identity while deleting live Auth/profile state;
- permanent verifier shape must remain read-only;
- focused static tests and production build must pass;
- exact migration-history parity must be preserved.

## Explicit non-goals

This milestone does not:

- delete or rewrite Person identity events;
- delete historical Person identity links;
- drop or weaken the live `person_identity_links.user_id -> user_profiles` FK;
- modify the canonical Beautah Person created by Article Author convergence;
- reserve usernames globally;
- change `/u/:username` routing rules;
- converge `/authors/:slug` frontend routes;
- delete privileged operator accounts.

Frontend `/authors` convergence remains a separate later gate.

## Preview proof completed

Retained preview project:

`coikpfdhqhdcnzijwiwr`

The exact migration candidate applied cleanly and the preview ledger was aligned to:

`20260819150000_account_identity_retirement_authority`

A disposable account-backed Person was exercised through the same governed command path.

Blocker proof:

- one preview-only `seo_content_overrides` row referenced the disposable Auth user through two real `NO ACTION` foreign keys;
- `account.identity_retire` returned a rejected receipt with error code `account_retirement_blocked`;
- blocker evidence named both `created_by` and `updated_by` constraints;
- the Auth user, Person revision 1, and active identity link remained unchanged.

Successful retirement proof after removing only that disposable blocker:

- outer account-retirement receipt succeeded;
- governed `person.identity_unlink` receipt succeeded;
- Auth user was deleted;
- Person became `archived` at identity revision 3;
- preferred identity was cleared;
- historical identity link remained with state `retired`;
- live `user_id` became null;
- exact historical Auth UUID moved to `retired_user_id_snapshot`;
- one retired-account tombstone was preserved;
- permanent generic read-only verifier returned `PASS` with one retired account, one historical snapshot link, and one archived orphan Person.

The preview proof used only disposable preview identities. Production `beautahj` was not modified during preview validation.
