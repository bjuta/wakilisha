# Phase 8B.5 Candidate C Production Closure

Status: **CLOSED IN PRODUCTION**

Candidate: **Phase 8B.5 Candidate C — Legal preservation and scoped disclosure**

Production authority after final frontend repair:

```text
main=01a78981b103372abce2a99d9f7629a775ba51e3
implementation_pr=889
frontend_delivery_fix_pr=890
production_supabase_ref=pgzizndxdyhqmtyywjmt
production_lightsail_host=35.176.52.252
```

## Closure statement

Candidate C is closed in Production. WAKILISHA now has server-enforced Legal Request Case authority, finite preservation scope, exact-object preservation, human response classification, deliberate restricted-evidence inspection, exact disclosure package production, approval, durable generation, explicit release, purpose-audited signed delivery, preservation release, and case closure without creating a broad administrator export path.

The controlled Production canary proved that an exact Message can be scoped, preserved, classified, inspected, packaged, generated, released, delivered, and released from preservation while an adjacent Message in the same canary Conversation remains outside the preserved and disclosed object set.

## Exact shipped authority

### Database

Production migration:

```text
20260909080000_phase_8b5_candidate_c_legal_preservation_scoped_disclosure.sql
```

Accepted migration SHA-256:

```text
5f30231f46f5cd18e7318e101295a92c5215eb0fc35ffb2191380a7b70d9de95
```

Production migration history after apply:

```text
migration_count=112
migration_head=20260909080000
```

Permanent Production verifier completed successfully after the one-time migration apply. The final verifier result included:

```text
legal_cases=1
legal_events=26
packages=1
preserved_objects=1
verification=PASS
```

The migration was applied once. It was not reapplied during runtime, frontend, canary, or closure work.

### Media receiver

Final Production receiver source SHA-256:

```text
60175b230064d1063c92538833e260c3e943facf1ebac1b0e7b49cd8b061f480
```

Receiver systemd unit remained unchanged:

```text
9b646bee324c90a49f9de5174f7e9db021af34f3ede31c5c659404daedae3648
```

Candidate C added only the restricted private Legal disclosure path. Existing Media ingress remained healthy throughout deployment and acceptance.

Receiver rollback snapshot:

```text
/opt/wakilisha-media-receiver-backups/phase8b5-candidate-c-runtime-20260909T193215Z-cbd8861b
```

### Legal disclosure worker

Final worker source SHA-256:

```text
30f42769216978f67fe74066e17cea21c7759302ac5eda4d025c444ff1912951
```

Final worker systemd unit SHA-256:

```text
0f07d00e6cde400e4b577872f7583f75a0cf9f1258c5756b9a5083f41ccd156d
```

The worker uses the established Production Lightsail runtime, existing shared durable job authority, and least-privilege writable roots:

```text
/opt/wakilisha-media/private-files/legal-disclosures
/opt/wakilisha-legal-disclosure-processing
```

The Media processor remains Media-only. No second scheduler, queue, retry system, or outbox was introduced.

### Edge delivery authority

`media-upload-api` was promoted to Production as Candidate C version 30 with the existing custom JWT contract preserved:

```text
status=ACTIVE
version=30
verify_jwt=false
```

Candidate C Legal delivery is resolved through the dedicated Legal capability path. Generic Media delivery remains denied for Legal disclosure files.

### Frontend

The Candidate C frontend was first activated from merged implementation main, then one browser-delivery acceptance defect was found: the signed Legal URL was opened through a delayed programmatic `_blank` handoff after asynchronous authorization, allowing Chrome popup policy to block the user delivery.

The backend authorization itself had succeeded and was correctly audited, so this was classified as a frontend/browser UX defect only.

PR #890 replaced the popup-dependent handoff with same-context navigation and added a regression contract. No SQL, Edge, receiver, worker, package, scope, or preservation authority changed.

Final merged Production authority:

```text
01a78981b103372abce2a99d9f7629a775ba51e3
```

Final frontend activation passed exact local/Lightsail parity, Nginx validation, direct-origin smoke, and public HTTPS smoke.

Frontend rollback snapshots retained during Candidate C promotion include:

```text
/opt/wakilisha-react-backups/phase8b5-candidate-c-20260909T194311Z-cbd8861b
```

and the later popup-fix deployment snapshot recorded by the Production deployment gate.

## Controlled Production Legal canary

Run identity:

```text
run_id=20260909T195845Z-caf744e1
case_id=4cee4f2d-9a6c-47c0-b95c-d613fd7f7360
conversation_id=d7345aa8-da0b-450b-a830-3d02dd05a6cc
target_message_id=94f82856-6bf2-4309-8dab-b0d5bbec24a7
adjacent_message_id=abfa1697-8979-4812-9bf6-4285c063ad71
preserved_object_id=362bf816-d358-4733-8e3e-44e79edd44f9
package_id=24b5bd68-f8cd-4fe5-9bbd-0b944bad62a8
generation_job_id=1cb7ace7-a06f-4698-a751-c54d8a6d7d98
package_file_object_id=b529c12c-f806-4608-836f-2a8f781a25ec
```

The target was an explicitly non-sensitive engineering acceptance Message. The adjacent Message existed only as a leakage sentinel.

### Scope and preservation proof

The canary proved:

```text
scope_count=1
target_scope_count=1
adjacent_scope_count=0
preserved_count=1
target_preserved_count=1
adjacent_preserved_count=0
```

The target object was materialized, classified `responsive`, and deliberately inspected. The adjacent Message was never preserved.

### Package exactness

Frozen package selection fingerprint:

```text
4743ccb292745cd14bc9696121a0abb15a341514abfcec64d04ffcd71ad2844e
```

Generated artifact:

```text
manifest_sha256=6b96d124f5fcb3a28f1eb1dac99f8e01b83d58b81d0d80c645af3e541eba2ad8
package_sha256=4cc6da0965576a4b2522622297e1b84bc81753124c958a5147f045f63dfc08fc
package_byte_size=2292
```

Restricted path:

```text
private-files/legal-disclosures/4cee4f2d-9a6c-47c0-b95c-d613fd7f7360/24b5bd68-f8cd-4fe5-9bbd-0b944bad62a8/production.zip
```

The downloaded Production ZIP was independently inspected. It contained exactly:

```text
manifest.json
objects/000001-message-362bf816-d358-4733-8e3e-44e79edd44f9.json
```

The disclosed payload was the exact target Message. The adjacent Message was absent as a disclosed object and appeared only in `documented_omissions` as intentionally outside the authorized scope.

### Delivery proof

Two purpose-audited Legal package delivery events remain in immutable history:

1. the first server-side signed-delivery authorization, whose browser handoff was blocked by Chrome popup policy;
2. the post-fix successful browser delivery using the same released package.

The first event is retained because it truthfully occurred. It is not cleaned up or rewritten.

After PR #890 and frontend-only redeployment:

```text
DELIVERY_DOWNLOAD=PASS
```

No browser popup permission change was required.

## Final Production state

Final read-only closure audit:

```text
case_status=closed
case_revision=6
active_scope_count=0
released_scope_count=1
held_object_count=0
released_object_count=1
target_preserved_count=1
adjacent_preserved_count=0
released_package_count=1
inflight_package_count=0
package_sha256=4cc6da0965576a4b2522622297e1b84bc81753124c958a5147f045f63dfc08fc
case_closed_events=1
scope_released_events=1
preservation_released_events=1
delivery_events=2
```

This is the intended residue model: no active Legal duty remains, while immutable case, preservation, package, delivery, and audit history remain durable.

## Preview cleanup

The disposable Candidate C Supabase Preview branch was retained through Production runtime and frontend acceptance, then deleted after the final Production canary closed.

```text
preview_branch_id=3eaf0234-6c7d-43b7-9c5f-7373d2b7fd64
preview_deleted=YES
```

## Acceptance conclusions

Candidate C Production acceptance proves:

- Legal Request Case authority remains separate from Safety Case authority;
- preservation remains separate from disclosure;
- private evidence is not ambiently rendered;
- exact Message scope materializes only the intended object;
- adjacent Message leakage is prevented;
- human response classification gates disclosure selection;
- disclosure preparation freezes an exact selection fingerprint;
- package approval is bound to that exact selection;
- generation is durable and worker-backed;
- generated package and manifest hashes are explicit and stable;
- release is a separate accountable transition;
- Legal delivery is purpose-audited and restricted to the Legal private path;
- generic Media delivery cannot become an ambient Legal export route;
- browser delivery works without popup permission after PR #890;
- scope and preservation release are explicit and ordered;
- closed cases retain immutable history while no active hold/scope duty remains;
- Super Admin operation remains server-enforced;
- no unrestricted administrator export endpoint was introduced.

## Product UX follow-up

The Production canary also exposed a separate product-design problem in `/admin/messages`: technically correct authority is currently surfaced through an overly long engineering-console-style page, native browser controls, raw UUID entry, persistent runtime/control metadata, and manually reconstructed multi-step workflows.

That UX debt is not a Candidate C authority defect. Candidate C remains closed. It is being carried forward as a dedicated Messages Operations UX & Control Surface Convergence slice before final Phase 8B antifragile closure.

The convergence direction includes:

- no browser-native interaction chrome for admin workflows;
- WAKILISHA-owned pickers, selectors, date/time controls, confirmations, inspectors, and workflow primitives;
- entity pickers instead of routine raw UUID entry;
- Legal as a guided case workflow rather than a long stack of state-machine actions;
- Runtime Audience and Private Content Boundary as deliberate control areas rather than persistent dashboard facts;
- dedicated System Actor management;
- dedicated Agent Reviews & Updates operations;
- deliberate Super Administration tooling;
- contextual audit/history rather than audit dominating the primary work canvas.

## Closure

**Phase 8B.5 Candidate C: CLOSED IN PRODUCTION.**
