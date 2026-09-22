# MIZIZI Slice 3 Tranche B — Artist Decouple Exact Authority Design

Date: **22 September 2026**

Status: **DESIGN / PRODUCTION PREFLIGHT — NO MUTATION YET**

Programme issue: **#962 MIZIZI Slice 3: Obsolete Authority Retirement & Bypass Closure**

Branch base:

```text
a969cebe6e2bfc8a273b769bf02bbb34513d4f03
```

Production project:

```text
pgzizndxdyhqmtyywjmt
```

Production migration authority at entry:

```text
migration_count=169
migration_head=20260922054353_registry_track_duplicate_repair_authority_v1
```

This family begins only after the Track duplicate repair family reached
Production acceptance and its bounded closure PR merged.

## Current product boundary

The current Admin Artist-decouple product calls:

`public.admin_apply_artist_decouple_decision(uuid)`

That reviewed apply wrapper delegates to:

`public.admin_decouple_registry_artist(uuid,jsonb,text,boolean,uuid)`

Current Product caller:

`src/pages/admin/registry/artist-aliases/decouple/page.tsx`

The product therefore already has the correct high-level shape: a reviewed
decision command above a mature lower-level mutation algorithm.

## Frozen Production function seals

Production preflight body SHA-256 values:

```text
admin_apply_artist_decouple_decision(uuid)
73e3aab71dbac4ba2ac89dd6f6fc8d8876b4f8633cda691282efa0d67be4fce8

admin_decouple_registry_artist(uuid,jsonb,text,boolean,uuid)
bf2e8410e11af4207d064a800b7405045098ea0442742941a4fe5f55d026463e
```

The first implementation candidate must treat the mature lower-level body as
frozen unless an independently proven correctness defect requires change.

## Current execution boundary

Production currently proves:

- `admin_apply_artist_decouple_decision(uuid)`
  - `anon`: no EXECUTE;
  - `authenticated`: EXECUTE;
  - `service_role`: EXECUTE.
- `admin_decouple_registry_artist(...)`
  - `anon`: no EXECUTE;
  - `authenticated`: EXECUTE;
  - `service_role`: EXECUTE.

The direct authenticated/service-role road to the low-level mutator is the
authority debt this family must remove.

The reviewed product wrapper remains the intended human product boundary.

## Existing reviewed-decision and lineage state

Production snapshot at entry:

```text
registry_artist_decouple_decisions=1
approved_decisions=0
applied_decisions=1
artist_credit_decoupled audit events=2
artist split lineage rows=2
```

Current Identity + Projection Lineage derives Artist split history from:

`registry_audit_log.action='artist_credit_decoupled'`

with source authority:

`registry_audit_log:artist_credit_decoupled`

That accepted event-to-lineage contract is frozen.

## Current manifest authority

`admin_apply_artist_decouple_decision(uuid)`:

- risk: **critical**;
- disposition: `keep_converge`;
- future boundary:
  `reviewed_decouple_command_plus_dedicated_exact_operation`.

`admin_decouple_registry_artist(...)`:

- risk: **critical**;
- disposition: `retire_or_internalize`;
- future boundary:
  `reviewed_decouple_command_plus_dedicated_exact_operation`.

`admin_create_registry_artist_for_decouple(...)` is already accepted over the
reviewed Artist identity exact-grant primitive and is not a second Artist
creation algorithm to preserve.

## Accepted mature behavior to preserve

The accepted stale-contract audit records that the lower-level mutator:

- moves Track Artist credits;
- moves Release Artist credits;
- updates current Chart projection;
- blocks the combined alias;
- optionally archives the source Artist;
- emits `registry_audit_log.action='artist_credit_decoupled'`.

The governed replacement must not rewrite those semantics merely to resemble a
newer implementation.

## Target authority boundary

The implementation must:

1. preserve the reviewed decision product command;
2. internalize the mature lower-level decouple mutator;
3. bind execution to the exact approved decision;
4. freeze the exact source Artist and replacement Artist identities;
5. freeze current relevant state before execution;
6. use the existing shared Registry evidence/review/exact-grant/operation
   journal substrate;
7. enforce a bounded exact row budget;
8. independently verify resulting Track Artist credits;
9. independently verify resulting Release Artist credits;
10. independently verify current Chart projection against canonical credits;
11. preserve `artist_credit_decoupled` audit semantics;
12. preserve complete Artist split lineage;
13. return exact grants to zero at rest;
14. deny `anon`, `authenticated`, and `service_role` direct execution of
    the private mature engine.

No new generic Registry governance kernel is authorized by this design.

## Namespace preflight

Production currently has no conflicting decouple-specific:

- capability definition;
- typed Registry operation;
- System Actor.

Final names are not frozen by this preflight alone. The implementation must use
the smallest names consistent with existing Registry exact-operation
conventions and permanent verifier clarity.

## Artist creation composition

Artist creation needed by a decouple review must continue to reuse the accepted:

`public.admin_create_registry_artist_for_decouple(text,text,text,text)`

reviewed identity composition.

This family must not reintroduce a second direct Artist-creation algorithm.

## Acceptance sequence

Before merge:

1. exact current-main base;
2. current Production function/body/grant preflight;
3. frozen design + manifest contract;
4. repository-generated migration filename when implementation begins;
5. focused static tests;
6. fresh Production-parity Preview;
7. native repository migration replay;
8. permanent Artist decouple authority verifier;
9. shared review verifier;
10. Identity + Projection Lineage verifier;
11. Registry canonical writer inventory verifier;
12. adversarial direct private-engine denial;
13. real authenticated Admin Artist-decouple product-path acceptance against a
    disposable/rollback fixture;
14. exact grants return to zero at rest;
15. protected PR CI;
16. merge;
17. canonical Production SQL promotion from exact merged main;
18. independent Production verification;
19. bounded Artist-decouple Production closure;
20. advance to safe Artist merge only after acceptance.

## Deployment classification

At this design checkpoint:

- SQL migration needed now: **No — implementation migration not created yet**
- Edge Function deploy needed now: **No**
- frontend deploy needed now: **Not established; preserve current caller unless
  implementation proves a caller change is required**
- Production mutation authorized now: **No**
- Preview needed now: **No — only after implementation candidate exists**
- Mac needed now: **No**
