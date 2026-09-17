# MIZIZI Gate C Data-Bound Replay Authority Repair - Stage 1

Status: **LOCAL CANDIDATE - NO PRODUCTION CHANGE**

## Trigger

A fresh disposable Supabase Preview created for MIZIZI Slice 3 D1 repeatedly stopped at migration `20260916182000_registry_relationship_authority_convergence_v1`.

The Preview was healthy but zero-data. Its migration ledger stopped at `20260916120400`.

Read-only diagnosis proved the Gate C migration requires exact historical Production rows for:

- Mejja
- Fik Fameica
- Siaka
- Mtoto wa Khadija
- two exact historical legacy relationships
- two exact evidence links

A surgical fixture made the migration replayable, proving the blocker was the migration's Production-data dependency rather than missing schema.

That fixture was diagnostic only. It is not an accepted deployment workflow.

## Authority classification

Gate C combines two different responsibilities.

### Historical Production reconciliation

The following are one-time Production history and must not remain required by fresh replay:

- exact legacy `cultural_entities` to Registry identity mapping;
- exact relationship UUID preservation;
- exact historical review/evidence drift checks;
- typed relationship/evidence backfill;
- accepted review-state restoration;
- migration provenance for the historical rows.

### Enduring replay authority

A fresh database must reconstruct only the fail-closed boundary:

- core music identity cannot be created or rewritten through `cultural_entities`;
- legacy relationships involving a core music endpoint cannot mutate;
- evidence links attached to those historical core relationships cannot mutate.

## Stage 1

Stage 1 adds:

`20260917121000_registry_relationship_replay_authority_v1.sql`

It reproduces only those three fail-closed function/trigger contracts and their privilege revocations.

The original `20260916182000` migration remains active during Stage 1. This is intentional.

Stage 1 must be applied and verified in Production before Stage 2 removes the old migration from active replay authority and repairs the Production migration ledger.

## Stage 2 acceptance target

After Stage 1 Production acceptance:

1. preserve the exact `20260916182000` SQL under `docs/engineering/replay-baseline/retired-active-migrations/`;
2. remove it from `supabase/migrations/`;
3. mark Production migration `20260916182000` reverted in migration history only;
4. create a brand-new zero-data Supabase Preview;
5. prove the active migration chain reaches the then-current Production head with no fixture seeding;
6. run the replay-authority verifier;
7. delete the Preview.

Only after that proof may MIZIZI Slice 3 D1 Preview acceptance resume.

## Deployment classification

- D1 changes: **untouched**
- SQL migration in Stage 1: **Yes**
- Production application data mutation: **No**
- Existing Gate C historical rows: **untouched**
- Existing Gate C migration retired in Stage 1: **No**
- Edge deploy: **No**
- Frontend deploy: **No**
- Finish update: **No**
