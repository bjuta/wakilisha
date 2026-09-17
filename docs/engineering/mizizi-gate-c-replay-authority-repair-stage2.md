# MIZIZI Gate C Replay Authority Repair Stage 2

Date: 17 September 2026

## Status

Local retirement candidate. Production migration-history repair has not yet
been executed. No PR has been pushed or merged.

## Accepted predecessor

Stage 1 is merged on main at:

`2c80d97c120ffde32532e852882f07b9690f2ea5`

Production accepted the replay-safe replacement at migration head:

`20260917121000_registry_relationship_replay_authority_v1.sql`

The permanent relationship replay-authority verifier passed in Production.

## Retirement target

The Production-data-bound migration is:

`20260916182000_registry_relationship_authority_convergence_v1.sql`

Its accepted SHA-256 is:

`01fea943170f3cd3486d2d65f3635dbe4d9c0d8d25632905a379ba52d7c9fdf1`

Stage 2 preserves those exact bytes at:

`docs/engineering/replay-baseline/retired-active-migrations/20260916182000_registry_relationship_authority_convergence_v1.sql`

and removes the file from `supabase/migrations`.

The archived SQL remains historical evidence only. It is not active replay
authority.

## Enduring authority

Fresh databases reconstruct Gate C fail-closed authority only from:

`20260917121000_registry_relationship_replay_authority_v1.sql`

That replacement owns the three enduring mutation guards for:

- core cultural entities;
- legacy core relationships;
- legacy core relationship evidence.

## Control-plane hardening

Stage 2 strengthens `verify-migration-replay-contract.mjs`.

A deleted active migration now requires more than a receipt path. The verifier
loads the deleted migration from the merge base and proves the retired receipt
is byte-identical. A changed receipt fails the replay contract.

## Cutover order

The order is intentionally the same as the established August 19 retirement
pattern:

1. prepare and test this Stage 2 branch locally;
2. do not merge while Production still records `20260916182000`;
3. repair only the Production migration ledger with native Supabase
   `migration repair --status reverted 20260916182000`;
4. prove Production application schema/data remain unchanged and Stage 1 guards
   still pass;
5. run `schema:verify` and protected CI against the Stage 2 branch;
6. merge Stage 2 only after Production history matches the branch;
7. create a brand-new zero-data Preview with no manual fixtures;
8. prove full replay reaches the accepted active head;
9. run the permanent Gate C verifier;
10. delete the disposable Preview.

## Deployment classification

- application SQL mutation: no;
- Production migration-history repair: required after local candidate acceptance;
- Production application data mutation: no;
- Edge deploy: no;
- frontend deploy: no;
- Finish update: no;
- D1 mutation: no.
