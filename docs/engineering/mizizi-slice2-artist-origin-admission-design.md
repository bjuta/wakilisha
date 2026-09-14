# MIZIZI Slice 2 — Artist Origin Admission V1

Date: 14 September 2026

Status: **DESIGN AUTHORITY — IMPLEMENTATION NOT YET PRODUCTION-ACTIVE**

Issue: #935

Programme authority: `docs/engineering/mizizi-registry-authority-security-convergence-programme.md`

Base authority: `8797ebed112fb044e361a24b80382e724adbe055`

## 1. Objective

Prove the first complete typed Registry mutation through the Slice 2 governance foundation without giving the MIZIZI Mind ambient Production authority.

V1 admits exactly one missing canonical Artist origin fact:

- `registry_artists.origin_iso2`
- `registry_artists.origin_confidence`

It does not rename, merge, archive, create, delete, split, rebuild, or modify Artist identity, membership, credits, relationships, provider IDs, status, slug, or unrelated metadata.

## 2. Why this operation

Artist origin is the smallest existing legitimate canonical mutation that still exercises the complete governance path:

- evidence provenance;
- deterministic admission;
- narrow capability;
- exact target binding;
- stale-state rejection;
- one-shot grant issuance;
- idempotency;
- canonical write evidence;
- operation/write causality;
- independent verification;
- kill-switch semantics.

It is deliberately lower blast radius than discography rebuild, membership replacement, Artist merge/decouple, Track duplicate repair, or relationship convergence.

## 3. Production facts established before implementation

Read-only Production audit on 14 September 2026 established:

- 1,227 Registry Artists;
- 542 Artists with `origin_iso2`;
- 685 Artists without `origin_iso2`;
- 26 distinct stored origin codes;
- no origin-specific database constraint on `registry_artists`;
- no stored non-uppercase origin code;
- no stored non-two-character origin code;
- no stored confidence outside `0..1`;
- 349 historical Artists have an origin but null confidence;
- 1,034 Artists have null confidence overall;
- existing non-null confidence values range from `0.85` to `1.0`.

Those historical rows are not cleanup scope for V1.

`registry_canonical_write_events` currently contains 552 rows: 520 Track and 32 Release events. It contains zero Artist rows. The table has only its primary-key constraint and its columns are domain-generic enough to represent Artist field writes. V1 therefore reuses it explicitly for Artist write evidence instead of creating a second canonical-write ledger.

## 4. Legacy authority observed

### `backfill-artist-origin`

The current Edge Function:

1. authenticates a bearer user;
2. creates a service-role database client;
3. derives Artist origin from `metadata.country` or MusicBrainz;
4. writes `registry_artists.origin_iso2` and `origin_confidence` directly.

It does not enforce `manage_registry` or a narrower Registry capability before the service-role canonical write.

V1 does **not** delete or broadly patch this function. Observation/resolution and canonical admission are split first; writer convergence happens only after the typed path is proven.

### Charts origin writer

`chart_set_artist_origin_for_charts(...)` is a separate service-role-executable `SECURITY DEFINER` writer with chart-specific provenance/audit semantics. It can set `origin_iso2` and confidence `1`.

V1 does not silently replace this path. It is convergence debt to address only after the first typed admission is proven.

## 5. Capability boundary

The existing `manage_registry` capability is too broad for an autonomous System Actor.

V1 adds one narrow capability to the existing canonical vocabulary:

`admit_registry_artist_origin`

Domain: `registry`

Meaning: admit one evidence-backed missing Artist origin through the typed Registry broker.

No parallel capability registry is created.

Human administrators continue to use existing human Registry authority. A standing MIZIZI grant for the narrow capability must be explicitly issued by a human with `manage_registry` and remains revocable/expiring.

## 6. Operation identity

Operation key: `registry.artist_origin.admit`

Version: `1`

Risk: `low`

Subject type: `artist`

Budgets:

- exact targets: `1`
- maximum affected rows: `1`
- exact-grant TTL ceiling: `300` seconds
- existing target required: yes
- independent verifier required: yes

V1 never accepts arbitrary table names, column names, SQL fragments, JSON patch objects, or multiple targets.

## 7. V1 mutation semantics

An Artist is admissible only when all of the following remain true at execution time:

- the Artist exists;
- status is `active` or `draft`;
- current `origin_iso2` is null/blank;
- the exact canonical row still matches the execution grant's expected-state fingerprint;
- proposed ISO2 is a real ISO-3166-1 alpha-2 code and canonical uppercase;
- proposed confidence is between `0.90` and `1.00` inclusive;
- one active admissible evidence assertion exists and is bound into the plan;
- the operation type is enabled;
- the System Actor is active;
- the System Actor standing capability grant is active and unexpired;
- the current executor is bound to MIZIZI;
- the exact grant is active, unexpired, untampered, one-shot, one-row, and target-complete.

V1 rejects overwriting an established Artist origin, even when new evidence disagrees. Conflict/correction semantics require a later operation version or review workflow.

## 8. Evidence assertion primitive

V1 introduces a Registry-scoped append-only evidence assertion contract in `platform_private` rather than treating fetched/provider text as control authority.

An assertion binds:

- typed Registry subject;
- claim key;
- normalized claim payload;
- trust class;
- source kind;
- source reference;
- source payload fingerprint;
- observation time;
- recorder principal;
- deterministic assertion fingerprint.

Trust labels remain the programme labels:

- `TRUSTED_CONTROL`
- `INTERNAL_FACT`
- `EXTERNAL_EVIDENCE`
- `USER_CONTENT`
- `WEB_UNTRUSTED`

For Artist Origin V1, autonomous admission accepts only `EXTERNAL_EVIDENCE` or `INTERNAL_FACT` assertions that meet the deterministic confidence policy. `USER_CONTENT` and `WEB_UNTRUSTED` can be stored as evidence but cannot directly authorize this operation.

Evidence is immutable after recording. A new observation produces a new assertion; it does not rewrite history.

## 9. Exact-grant issuer correction

The inert foundation required every execution grant to carry `issued_by_user_id`. That is correct for human issuance but cannot model deterministic autonomous policy issuance without falsely impersonating a human.

V1 converges this before use:

- standing System Actor capability grants remain human-granted;
- exact one-shot execution grants gain an explicit issuer principal;
- human-issued exact grants bind `user:<uuid>` to the matching user ID;
- policy-issued exact grants bind a `policy:<key>` principal and have no fake human user ID;
- every exact grant records the deterministic policy ruleset version;
- immutable-grant guards are extended to cover the new issuer fields.

This is a governance correction, not an authority expansion.

## 10. Deterministic policy

Ruleset: `registry-artist-origin-admission-v1`

The policy gateway derives the exact plan from the evidence assertion; the MIZIZI Mind does not supply arbitrary mutation structure.

The normalized plan contains only:

- operation key/version;
- Artist UUID;
- evidence assertion UUID/fingerprint;
- proposed `origin_iso2`;
- proposed `origin_confidence`;
- expected canonical subject-state fingerprint;
- trust class;
- policy ruleset version.

The gateway computes and stores:

- plan fingerprint;
- exact one-target fingerprint;
- max rows `1`;
- five-minute-or-shorter expiry;
- idempotency key.

Any plan, target, state, capability, expiry, or policy drift rejects execution.

## 11. Human standing-grant control

A narrow authenticated admin RPC will allow a user with `manage_registry` to issue or revoke the MIZIZI Artist-origin standing capability.

Issuance must:

- bind actor `mizizi`;
- bind capability `admit_registry_artist_origin`;
- bind the V1 operation/scope;
- have an explicit human grantor;
- have a reason;
- have a bounded expiration;
- reject overlapping active grants.

Grant and revoke actions are written to existing `registry_audit_log`.

The standing grant is not an exact mutation authorization. It only allows the deterministic policy gateway to issue short-lived exact grants within its scope.

## 12. Canonical execution

The dedicated Artist-origin executor performs only this operation:

1. begin/consume the exact grant through `begin_registry_mutation_operation`;
2. lock the exact Artist row;
3. revalidate expected state after the lock;
4. revalidate evidence, plan, operation version, capability, and budgets;
5. update only `origin_iso2` and `origin_confidence` on exactly one Artist;
6. write two `registry_canonical_write_events` rows, one for each canonical field;
7. link both write events to the Registry mutation operation;
8. mark the operation write as succeeded with verifier still pending.

No generic Registry patch surface is introduced.

## 13. Independent verification

Verification is a separate call/transaction from canonical execution.

The verifier must prove:

- operation identity and version;
- exact Artist target;
- final Artist values equal the bound plan;
- expected evidence assertion remains the operation source;
- exactly two linked canonical write events exist;
- the linked events are exactly `origin_iso2` and `origin_confidence`;
- their before/after values agree with the operation result;
- affected rows equals `1`;
- no unrelated canonical field was part of the operation contract.

Only then does `verifier_status` become `passed`.

A failed verifier remains visible and is a circuit-breaker signal; it is not rewritten into success.

## 14. Kill switches

V1 has layered kill switches:

1. disable `registry.artist_origin.admit/1`;
2. revoke/expire the MIZIZI standing capability grant;
3. deactivate the MIZIZI System Actor;
4. deactivate the executor binding.

The foundation already rejects resume of a non-terminal operation after the actor, standing grant, or operation type is disabled.

## 15. Runtime boundary

The MIZIZI Mind does not receive:

- Production `postgres` credentials;
- `service_role`;
- arbitrary SQL;
- a generic database query tool;
- a generic Registry patch tool.

The repository-owned broker accepts typed Artist-origin inputs and invokes only the evidence/policy/executor/verifier functions required by V1.

The current direct-`postgres` MIZIZI runner remains classified convergence debt. V1 does not claim that debt is retired merely because this one operation no longer needs a generic mutation interface.

## 16. Activation discipline

Schema deployment and authority activation are separate.

The candidate migration may install the narrow capability, operation definition, evidence primitive, policy/executor/verifier functions, and admin standing-grant controls, but Production must remain unable to execute the operation until acceptance explicitly enables the operation and a human standing grant exists.

Preview acceptance will prove:

- positive one-row admission with rollback-safe fixture;
- stale state rejection;
- tampered plan rejection;
- target-set drift rejection;
- invalid ISO2 rejection;
- confidence threshold rejection;
- inadmissible trust-class rejection;
- expired/revoked/consumed grant rejection;
- disabled operation rejection;
- wrong capability rejection;
- wrong executor rejection;
- row-budget rejection;
- idempotent replay behavior;
- independent verifier behavior;
- no role-authority leakage.

Production activation remains a separate post-merge controlled action.

## 17. Explicit non-goals

V1 does not:

- backfill 685 missing Artist origins;
- repair the 349 historical origin-without-confidence rows;
- overwrite any established Artist origin;
- retire or delete `backfill-artist-origin`;
- retire or alter the Charts origin writer;
- generalize all Artist enrichment into one operation;
- create a universal cultural entity table;
- give MIZIZI `manage_registry`;
- make provider/web evidence trusted control;
- authorize Slice 3 retirement.
