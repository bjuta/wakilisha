# MIZIZI Slice 3 Tranche B High-Blast Convergence

Date: **22 September 2026**

Status: **ACTIVE IMPLEMENTATION DESIGN / PRODUCTION PREFLIGHT**

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

## Tranche boundary

Tranche B is one high-blast rollback boundary.

Track duplicate repair is already Production accepted as the first component of
that tranche. The remaining work must now be completed as one coherent job:

1. Artist decouple exact reviewed authority and low-level internalization;
2. safe Artist merge exact reviewed authority and mature-engine internalization;
3. old manual Artist merge dependency/traffic proof and retirement when clean;
4. one consolidated final writer/grant/lineage/postcondition contract;
5. one clean Production-parity Preview;
6. one remaining Tranche B replay and behavior acceptance cycle;
7. one implementation PR;
8. one remaining Tranche B Production promotion and closure.

There is no separate Artist-decouple family PR, safe-merge family PR, or old
manual-merge family PR.

## Ten-year infrastructure rule

This tranche must improve long-lived authority without manufacturing abstraction
debt.

The accepted shared Registry exact-operation kernel is already an earned
primitive. It owns the common lifecycle for:

- evidence;
- human review sealing;
- exact execution grants;
- exact targets;
- subject-state fingerprints;
- target-set fingerprints;
- mutation operations;
- canonical write events;
- operation/write-event linkage;
- verifier lifecycle;
- grant expiry/revocation;
- zero standing autonomous mutation authority.

Artist decouple and safe Artist merge must compound that substrate.

Their domain semantics remain separate:

- exact state fingerprints;
- mutation engines;
- row budgets;
- operation types;
- accepted audit/event contracts;
- independent postconditions.

Do **not** introduce a generic Artist mutation framework merely because both
operations touch Artist credits.

A new shared helper is justified only if the implementation proves one narrow,
stable invariant is genuinely duplicated and cannot correctly remain in the
existing Registry kernel.

## Current Artist decouple authority

Current product road:

`public.admin_apply_artist_decouple_decision(uuid)`

Current mature low-level mutator:

`public.admin_decouple_registry_artist(uuid,jsonb,text,boolean,uuid)`

Current Admin caller:

`src/pages/admin/registry/artist-aliases/decouple/page.tsx`

Production body seals:

```text
admin_apply_artist_decouple_decision(uuid)
73e3aab71dbac4ba2ac89dd6f6fc8d8876b4f8633cda691282efa0d67be4fce8

admin_decouple_registry_artist(uuid,jsonb,text,boolean,uuid)
bf2e8410e11af4207d064a800b7405045098ea0442742941a4fe5f55d026463e
```

Current execution grants:

- `anon`: neither road executable;
- `authenticated`: both roads executable;
- `service_role`: both roads executable.

The direct low-level executable road is authority debt.

The reviewed decision wrapper remains the product boundary.

Current accepted historical state:

```text
registry_artist_decouple_decisions=1
applied_decisions=1
artist_credit_decoupled audit events=2
artist split lineage rows=2
```

Accepted split lineage authority derives from:

`registry_audit_log.action='artist_credit_decoupled'`

with source authority:

`registry_audit_log:artist_credit_decoupled`.

That contract is frozen.

## Current safe Artist merge authority

Current product road:

`public.admin_safe_merge_registry_artists(uuid,uuid,text,boolean,text)`

Current Admin caller:

`src/pages/admin/registry/artist-aliases/page.tsx`

Production body seal:

```text
c5a595d6cd76da5df7d92d7e54449a270a3423cfffc8d8b0ce67eb85af3fd075
```

Current execution grants:

- `anon`: no EXECUTE;
- `authenticated`: EXECUTE;
- `service_role`: EXECUTE.

Accepted mature behavior includes:

- source/canonical Artist validation;
- source alias retarget/admission;
- existing alias retargeting;
- duplicate Track credits archived rather than destroyed;
- surviving Track credits moved to canonical Artist;
- duplicate Release credits archived rather than destroyed;
- surviving Release credits moved to canonical Artist;
- Chart projection repair;
- Track metadata repair;
- canonical Artist metadata enrichment;
- optional source Artist archival;
- `registry_artist_resolution_events.action='artist_merge'`;
- preserved source/replacement/Track/Release/Chart snapshots.

Production event-to-lineage state at entry:

```text
successful artist_merge events=4
artist merge lineage rows=4
```

The mature algorithm is frozen unless a correctness defect is independently
proved.

## Old manual Artist merge retirement candidate

Legacy executable road:

`public.admin_merge_registry_artists(uuid,uuid,text,boolean)`

Production body seal:

```text
880f3fe1419b4ed9676ee0cbc14ca4b6193f0ef52475d25117df6a2325a151bd
```

Current execution grants:

- `anon`: no EXECUTE;
- `authenticated`: EXECUTE;
- `service_role`: EXECUTE.

Current repository audit proves:

- no current `src/` caller;
- no current database-function caller.

The legacy algorithm is not equivalent to safe merge. It physically deletes
duplicate Track/Release credit rows before moving survivors, while safe merge
archives duplicates and preserves the accepted resolution-event contract.

Therefore the correct convergence is retirement after bounded dependency proof,
not wrapping the old function as a second supported merge mode.

Retirement must preserve rollback source in retained migration/history
authority and add a permanent negative verifier proving the executable road no
longer exists.

## Artist creation during decouple

`public.admin_create_registry_artist_for_decouple(text,text,text,text)`

already composes the accepted reviewed Artist identity exact-grant primitive.

This tranche must preserve that composition and must not recreate direct Artist
identity insertion inside decouple authority.

## Target authority shape

### Artist decouple

Preserve:

`public.admin_apply_artist_decouple_decision(uuid)`

as the reviewed human product command.

Internalize the mature mutator behind a private engine boundary.

The exact operation must freeze at minimum:

- decision ID and effective review state;
- source Artist identity/state;
- exact replacement Artist identities/states;
- selected Track credit scope;
- selected Release credit scope;
- current Chart rows addressed by affected canonical credits;
- source lifecycle/archive intent;
- exact expected-state fingerprint;
- exact target-set fingerprint;
- candidate-specific row budget.

Execution must serialize/recheck relevant mutable state before entering the
mature engine.

Independent verification must prove:

- every intended Track credit points to the correct replacement Artist;
- every intended Release credit points to the correct replacement Artist;
- no actionable credit remains on the combined source where it should not;
- current Chart projection agrees with canonical Track + primary Artist credit;
- source lifecycle matches the reviewed decision;
- `artist_credit_decoupled` audit event semantics remain intact;
- event-to-split-lineage coverage is complete;
- operation/write-event causality is complete;
- no active exact decouple grant remains at rest;
- no succeeded operation lacks verifier PASS.

### Safe Artist merge

Preserve the current human product signature unless implementation evidence
proves a caller change is required:

`public.admin_safe_merge_registry_artists(uuid,uuid,text,boolean,text)`

Move the mature mutation algorithm behind a private engine boundary.

The exact operation must freeze at minimum:

- source Artist identity/state;
- canonical Artist identity/state;
- merge reason;
- archive intent;
- source and canonical alias state;
- Track credit rows for source/canonical collision scope;
- Release credit rows for source/canonical collision scope;
- affected Chart rows;
- affected Track metadata projection;
- exact expected-state fingerprint;
- exact target-set fingerprint;
- candidate-specific row budget.

Independent verification must prove:

- source alias resolves to canonical Artist;
- all aliases formerly targeting source are retargeted correctly;
- duplicate Track credits are archived, not destroyed;
- surviving Track credits point to canonical Artist;
- duplicate Release credits are archived, not destroyed;
- surviving Release credits point to canonical Artist;
- Chart projection agrees with canonical credits;
- current Track metadata projection no longer points at source identity;
- source Artist lifecycle matches archive intent;
- `registry_artist_resolution_events.action='artist_merge'` remains intact;
- event-to-merge-lineage coverage is complete;
- operation/write-event causality is complete;
- no active exact Artist-merge grant remains at rest;
- no succeeded operation lacks verifier PASS.

## Operation naming and primitive discipline

The implementation uses two domain-specific typed operations, capabilities, and System Actors because the existing namespaces are free and the two mutation semantics are genuinely different.

Those are not new generic primitives. They are typed policy records describing
two genuinely different high-blast operations on top of the existing shared
kernel.

The implementation should prefer the smallest domain-specific helper set
required for:

- current-user/capability binding;
- state fingerprinting;
- evidence recording;
- exact grant issuance;
- execution;
- independent verification.

If decouple and merge need identical helper behavior that is already available
in the shared kernel, reuse it directly.

If they need similar but semantically different helpers, keep them separate
rather than hiding domain meaning behind boolean or mode parameters.

## Migration shape

The remaining Tranche B implementation should prefer one coherent forward
migration if the complete SQL remains reviewable and rollback authority remains
clear.

Multiple migration files are allowed only when a real replay/rollback boundary
requires them. They must still be replayed and accepted together as one Tranche
B candidate.

Migration filenames must be created by the repository-required Supabase CLI.
No migration timestamp will be invented manually.

## Permanent verification shape

Do not add one permanent static test file per operation.

Preferred consolidation:

- extend the existing MIZIZI cultural-data steward source contract for static
  migration/manifest intent;
- add one consolidated Tranche B high-blast SQL verifier or extend the closest
  authoritative Registry writer verifier if doing so remains readable;
- continue to run the shared review verifier;
- continue to run the Identity + Projection Lineage verifier;
- continue to run the canonical Registry writer inventory verifier.

Database invariants belong in SQL verifiers, not duplicated source-string tests.

## One Preview rule

The remaining candidate gets one clean Production-parity Preview.

That Preview must prove, in one coherent cycle:

1. exact baseline replay from current Production;
2. complete remaining Tranche B migration replay;
3. permanent Tranche B high-blast verifier;
4. shared review verifier;
5. Identity + Projection Lineage verifier;
6. canonical writer inventory verifier;
7. private-engine execution denial;
8. old manual merge non-existence;
9. exact grants zero at rest;
10. real authenticated Artist-decouple product behavior;
11. real authenticated safe Artist-merge product behavior;
12. rollback/cleanup of disposable fixtures;
13. no Preview-only patch becomes promotion authority.

Do not create one Preview per function.

## CI integrity review

Before PR readiness:

- classify every touched test/assertion as authoritative, duplicated,
  superseded, scaffolding, runtime-only, or permanent;
- remove superseded per-family scaffolding where the final Tranche B contract
  owns the invariant;
- justify any net CI growth;
- prefer one coherent durable contract over chronological test accumulation.

## Production sequence

After one accepted candidate:

1. protected PR CI;
2. merge;
3. canonical repository SQL promotion from exact merged main;
4. Production migration-history verification;
5. consolidated permanent Production verifier stack;
6. schema seal reconciliation if required;
7. no frontend deploy unless source caller bytes actually changed;
8. disposable Preview deletion;
9. one remaining Tranche B Production closure;
10. fresh #962 exit audit.

## What not to touch

Unless direct evidence proves otherwise:

- do not redesign the shared Registry kernel;
- do not rewrite mature decouple or safe-merge algorithms;
- do not alter Artist identity materialization semantics;
- do not weaken review authority;
- do not create standing autonomous grants;
- do not collapse merge and split into one generic operation;
- do not restore direct browser table mutation;
- do not change unrelated frontend/admin workflows;
- do not reopen accepted Track duplicate implementation.

## Deployment classification at this checkpoint

- SQL migration needed now: **Not yet, until CLI generates the canonical file**
- Edge Function deploy needed: **No**
- Production Finish update needed: **No**
- frontend deploy needed: **No current evidence**
- PR needed now: **Draft only for the one coherent remaining Tranche B job**
- Preview needed now: **Not until the complete candidate exists**
- Production mutation authorized now: **No**


## Frozen operation envelopes

Production sizing evidence at design time:

```text
max current Track credits for one Artist = 327
max current Release credits for one Artist = 69
max current Chart rows for one Artist = 54
max combined current projection rows = 415
p99 combined current projection rows = 108.74
```

Historical accepted safe merge already moved 36 Track credits and 17 Release
credits in one operation.

The typed outer envelopes are therefore frozen as:

### Artist decouple

- operation: `registry.artist.decouple/v1`;
- capability: `decouple_registry_artist`;
- actor: `registry_artist_decouple_admin`;
- risk: **critical**;
- exact Artist targets: source plus at most thirty-one replacements, maximum **32**;
- outer row ceiling: **16384**;
- grant TTL: **300 seconds**;
- human approval: **required**;
- verifier: **required**.

The 16384 ceiling is not the normal budget. Evidence must compute a
candidate-specific exact row budget from the frozen decision/credit/projection
scope. The outer ceiling only prevents an unexpectedly explosive split. It conservatively covers the current independent live maxima upper bound at thirty-one replacements while avoiding a new narrow product cap.

### Safe Artist merge

- operation: `registry.artist.merge/v1`;
- capability: `merge_registry_artist`;
- actor: `registry_artist_merge_admin`;
- risk: **critical**;
- exact Artist targets: source + canonical, maximum **2**;
- outer row ceiling: **1024**;
- grant TTL: **300 seconds**;
- human approval: **required**;
- verifier: **required**.

Evidence must compute the exact candidate budget from source/canonical alias,
credit, Chart, Track metadata, Artist lifecycle, resolution-event, and journal
scope.

## Old manual Artist merge retirement proof

Production read-only proof at design time found:

- no current `src/` caller;
- no current database-function/procedure caller;
- no view reference;
- no trigger reference;
- PostgreSQL function traffic counters unavailable because
  `track_functions=none`.

The old function body SHA-256 remains:

`880f3fe1419b4ed9676ee0cbc14ca4b6193f0ef52475d25117df6a2325a151bd`.

The old algorithm is materially inferior to the accepted safe-merge algorithm
for historical integrity because it deletes duplicate Track/Release credit rows
instead of archiving them and does not own the accepted
`registry_artist_resolution_events action='artist_merge'` event contract.

The forward candidate therefore retires the executable public function and
preserves rollback source in retained migration history. The permanent
consolidated verifier requires the old regprocedure to be absent.

## Shared review composition

The accepted kernel's
`registry_execution_grant_target_review_seal` trigger creates/links one shared
review case per exact target and records the approving human issuer against the
immutable evidence/grant.

Artist decouple therefore retains its domain-specific
`registry_artist_decouple_decisions` row as the product decision while the
shared kernel seals exact execution approval for source/replacement Artist
targets. This is composition, not a second review system.
