# Messages Operations UX Gate C Production Closure

Status: **CLOSED IN PRODUCTION**

Issue: **#891 Messages Operations UX & Control Surface Convergence**

Gate: **C — Legal workflow convergence**

Production authority:

```text
main=6892623d9bc74b2c8e39bdde45c2ebe89ca1ac3f
implementation_pr=897
implementation_commit=a0a3da4aabc5039af95bce318230b441e632e722
production_project_ref=pgzizndxdyhqmtyywjmt
production_migration_count=113
production_migration_head=20260910103000
frontend_index_sha256=b6adf6d33ca40ac49f1cdb98200641e8ede2741ca7194595ee9a713147e23289
frontend_file_count=3708
rollback_backup=/opt/wakilisha-react-backups/gate-c-20260910T174538Z-6892623d
```

## Closure statement

Gate C is accepted and closed in Production.

The Messages Operations Legal workspace now presents the existing Candidate C Legal authority as a guided WAKILISHA operator workflow without replacing, weakening, or duplicating the server-side command/state authority accepted during Phase 8B.5.

The browser-facing workflow is:

```text
Request → Review → Scope → Evidence → Disclosure → Approval → Generation → Release → Delivery → Closure
```

The rail is a projection of canonical backend state only. It is not a new state machine.

## Delivered product convergence

Gate C replaced implementation-shaped Legal interaction patterns with WAKILISHA-owned controls and contextual work surfaces.

Accepted outcomes include:

- Legal Request Case queue and focused workbench composition;
- guided workflow rail with current, complete, available, and blocked stages;
- governed next-action projection;
- WAKILISHA SearchableSelect / EntityPicker discovery instead of routine UUID entry;
- WAKILISHA DateTimePicker instead of browser-native date/time chrome;
- CommandSheet surfaces for reason-bearing governed actions;
- purpose-audited evidence Inspector with private payload hidden by default;
- disclosure package Inspector with hashes, fingerprints, paths, and manifest hidden behind deliberate advanced reveal;
- contextual AuditTimeline instead of ambient raw event payloads;
- custom disclosure object selection instead of native checkbox presentation;
- selected-package polling only while worker-backed status is queued or generating;
- queue filter convergence after case status transitions;
- premature case closure blocked while canonical closure prerequisites remain unmet;
- long machine identifiers/fingerprints wrapped safely inside the Inspector;
- shared Sheet primitive repaired to use the common Portal and unambiguous right/bottom positioning.

## Narrow safe picker-read authority

The authority audit proved that routine Legal picker UX required two safe read projections that did not previously exist.

Migration:

```text
20260910103000_messages_operations_ux_gate_c_legal_picker_reads.sql
```

Accepted functions:

```text
public.search_messages_legal_scope_targets_v1(uuid,text,text,integer)
public.search_messages_legal_reviewers_v1(uuid,text,integer)
```

The functions are read-only, capability-gated, case-bound, result-capped, and expose safe metadata only. They do not expose Message body, private Media locators/technical metadata, Resource Version fingerprints, Legal evidence, or another mutation authority.

The generated schema/type seal and migration replay proof were produced from the accepted disposable Preview before Production promotion.

## Preview acceptance

Disposable Preview authority used for Gate C acceptance:

```text
preview_project_ref=txphyupoqtqhaytpival
preview_branch_id=e3452755-f844-4230-ad2e-c9c0e1528dd2
preview_schema=113 / 20260910103000
```

The Preview proved:

- unauthorized authenticated users are denied both picker reads;
- unknown Legal cases are denied;
- invalid target kinds are denied;
- undersized search queries are denied;
- result count is clamped to 20;
- Message, Conversation, Media file, and Resource Version target kinds resolve from safe metadata;
- reviewer discovery returns only eligible active Super Admin identity authority;
- Message body does not leak through target discovery;
- private Media delivery URL / technical metadata do not leak through target discovery;
- Resource Version content fingerprint does not leak through target discovery.

A rollback-only database behavior fixture left no durable residue.

A separate browser fixture then proved the real WAKILISHA client against the disposable Preview.

## Browser acceptance

### Desktop

Accepted end-to-end browser checkpoints:

1. open a Legal Request Case using custom request/date/notice controls;
2. start review using the governed right-side CommandSheet;
3. search/select the eligible Preview Super Admin reviewer by identity, not UUID;
4. add an Exact Message scope through case-bound safe metadata search;
5. materialize the scope into exactly one held Message object;
6. prove the adjacent fixture Message was not silently preserved;
7. inspect private Message evidence only through explicit purpose-audited Inspector reveal;
8. classify the exact held Message Responsive through the WAKILISHA picker;
9. prepare a disclosure package with exactly one selected Responsive Message;
10. inspect machine-level package authority only through deliberate advanced reveal;
11. approve the exact package selection and expose Generate only after approval.

Generation was deliberately not invoked during Gate C Preview UI acceptance because the Legal disclosure worker architecture was out of scope and already had separate Candidate C authority.

### Narrow / mobile

Narrow viewport acceptance passed for:

- Messages Operations workspace navigation;
- Legal case/workflow composition;
- right-side CommandSheet and Inspector behavior;
- custom pickers without clipping;
- package fingerprint wrapping;
- blocked Close Legal Case control while active scope/holds remained;
- System Actors workspace reachability and responsive composition.

## Shared Sheet defect found and repaired during browser acceptance

The first real Start Review browser test exposed a shared interaction primitive defect: Sheet rendered the overlay but not a usable right-side panel.

The root cause was in the shared Sheet primitive, not Legal RPC/data authority. Sheet lacked the common Portal behavior used by Modal and combined contradictory relative/absolute panel positioning.

The repair:

- renders Sheet through the shared Portal;
- uses the fixed flex overlay as the positioning authority;
- uses one unambiguous right-side or bottom alignment contract;
- keeps scroll locking, focus, Escape, backdrop close, and internal scrolling intact;
- is covered by the Gate A primitive regression contract.

The same repair protects both CommandSheet and Inspector consumers.

## Test acceptance

Final focused Gate A + Gate B + Gate C contracts:

```text
33 / 33 PASS
```

Protected critical suite:

```text
304 / 304 PASS
```

Full production build:

```text
PASS
```

PR #897 protected `critical` completed successfully before merge.

## Production SQL promotion

Production was proven at 112 migrations / `20260909080000` with both Gate C picker functions absent before promotion.

The merged repository migration was then promoted from exact merged `main`.

Post-apply Production authority:

```text
migration_count=113
migration_head=20260910103000
scope_picker_exists=true
reviewer_picker_exists=true
```

The permanent Gate C SQL verifier passed in a read-only Production transaction, proving:

- exact migration history;
- exact RPC signatures and return contracts;
- stable + security-definer metadata;
- correct execution grants;
- Legal capability enforcement;
- case binding;
- 20-result bound;
- expected canonical search sources;
- prohibited private fields absent;
- no mutation authority in the picker functions;
- no new table authority introduced by Gate C.

The repository live-schema equality verifier then proved committed `public,editorial` generated types match Production and that there were zero pending migrations.

## Production frontend promotion

Frontend promotion used the existing WAKILISHA Lightsail deployment contract from exact merged `main`.

Accepted evidence:

```text
merged_main=6892623d9bc74b2c8e39bdde45c2ebe89ca1ac3f
local_index_sha256=b6adf6d33ca40ac49f1cdb98200641e8ede2741ca7194595ee9a713147e23289
remote_index_sha256=b6adf6d33ca40ac49f1cdb98200641e8ede2741ca7194595ee9a713147e23289
local_file_count=3708
remote_file_count=3708
nginx_validation=PASS
home_http=200
messages_http=200
admin_messages_http=200
```

Pre-deploy rollback authority was preserved at:

```text
/opt/wakilisha-react-backups/gate-c-20260910T174538Z-6892623d
```

## Production browser acceptance

Final read-only Production browser acceptance passed:

```text
PRODUCTION MESSAGES OPERATIONS: PASS
PRODUCTION LEGAL WORKBENCH: PASS
PRODUCTION NARROW VIEWPORT: PASS
```

The existing closed Candidate C Production canary rendered correctly through the new Legal workbench. No new Production Legal case, evidence mutation, package approval, generation, or delivery was created merely to repeat behavior already proven on Preview.

## Disposable Preview cleanup

After Production browser acceptance, disposable Preview branch:

```text
messages-operations-ux-gate-c-picker-reads
preview_project_ref=txphyupoqtqhaytpival
preview_branch_id=e3452755-f844-4230-ad2e-c9c0e1528dd2
```

was deleted successfully.

This removed the disposable Auth operator and browser acceptance fixture with the Preview itself. No Preview residue is retained as release authority.

A final Production read proved Production remained at:

```text
migration_count=113
migration_head=20260910103000
scope_picker_exists=true
reviewer_picker_exists=true
```

## Authority intentionally unchanged

Gate C did not redesign or replace:

- Candidate C Legal command semantics;
- Legal preservation/disclosure canonical tables;
- Legal disclosure worker architecture;
- Media receiver / Legal delivery authority;
- command receipts, jobs, retries, or outbox authority;
- immutable audit authority;
- Safety authority semantics;
- public Messages audience authority.

No Supabase Edge Function, Media receiver, or Legal worker deployment was required for Gate C.

## Gate C closure

```text
GATE_A=MERGED
GATE_B=MERGED
GATE_C=CLOSED_IN_PRODUCTION
ISSUE_891=OPEN
NEXT_GATE=GATE_D_SAFETY_CONVERGENCE
PHASE_8B6_ISSUE=872
PHASE_8B6_STATUS=BLOCKED_BY_ISSUE_891
```

#891 remains open because Gate D and Gate E are still required before the Messages Operations convergence slice is complete.

The next implementation gate is **Gate D — Safety convergence**. It must apply the same workspace, inspection, action, custom-control, and responsive patterns to Safety while preserving Candidate A/B server authority exactly.

Phase 8B.6 issue #872 remains gated until #891 is fully accepted and closed in Production.