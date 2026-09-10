# Messages Operations UX Gate C: Legal Picker Read Authority

Status: **DESIGN / AUTHORITY REFINEMENT**

Issue: **#891 Messages Operations UX & Control Surface Convergence**

Base authority:

```text
main=5728844bf3f843c483203bd7ef50929e9bca9822
Gate_A=MERGED
Gate_B=MERGED
Phase_8B5_Candidate_C=CLOSED_IN_PRODUCTION
```

## Purpose

Seal the one backend exception proven necessary for Gate C Legal workflow convergence before any new SQL or frontend mutation.

The existing Candidate C Legal authority remains canonical. This refinement does not change Legal Request Case lifecycle, preservation semantics, classification semantics, disclosure approval, generation, release, delivery, immutable event history, Media authority, or role/capability ownership.

It authorizes only narrow, read-only, case-bound picker projections required to remove routine raw UUID entry from the Legal operator workflow.

## Proven gap

Gate A and Gate B established WAKILISHA-owned picker, date/time, workflow, command, inspection, audit, state, and Messages Operations primitives.

The current Candidate C Legal UI still requires browser/native or implementation-shaped operator input for:

- request kind;
- notice restriction state;
- received date/time;
- scope kind;
- exact Message UUID;
- Conversation UUID plus accepted time window;
- Media file object UUID;
- Resource Version UUID;
- optional assigned/review user UUID;
- response classification;
- package object checkbox selection.

The enum/date/selection controls can be converged frontend-only.

The canonical server read surface cannot currently discover a new Legal scope target or eligible Legal reviewer safely:

```text
public.list_messages_legal_cases_v1(...)
public.get_messages_legal_case_v1(...)
public.list_messages_legal_preserved_objects_v1(...)
public.get_messages_legal_disclosure_package_v1(...)
```

Ordinary `search_message_recipients` is not suitable authority. It is a Messages recipient-discovery surface for starting Conversations, returns Person Resource identity rather than Legal assignment user identity, and is governed by ordinary Messages audience/recipient rules rather than an active Legal Request Case.

Therefore Gate C has a proven safe picker-read projection gap under the exception already authorized by `messages-operations-ux-control-surface-authority-audit.md`.

## Locked backend exception

Gate C may add exactly two browser-reachable read-only RPCs.

### 1. Case-bound Legal scope target search

```text
public.search_messages_legal_scope_targets_v1(
  p_case_id uuid,
  p_target_kind text,
  p_query text,
  p_limit integer default 20
)
```

`p_target_kind` is exactly one of:

```text
message
conversation
media_file
resource_version
```

The function returns a bounded safe presentation only:

```text
target_kind text
target_id uuid
label text
context text null
occurred_at timestamptz null
related_id uuid null
```

`related_id` may carry the canonical Conversation id for a Message result when useful to distinguish otherwise similar results. It must not become a generic relationship dump.

The function must:

1. require an authenticated current human;
2. require `messaging.current_messages_super_admin()`;
3. require `public.current_user_has_capability('manage_messages_legal_cases')`;
4. require that `p_case_id` resolves to the exact Legal Request Case being worked;
5. reject blank/undersized search input rather than returning a browse-all dataset;
6. clamp result count to a small upper bound of 20;
7. return canonical ids only from the already accepted Message, Conversation, Media file-object, and Resource Version authorities;
8. expose safe distinguishing metadata only;
9. never return Message body, Message attachment payload, signed/private Media URL, Media bytes, Resource Version payload, Legal evidence, package manifest, service secret, or unrestricted JSON;
10. remain `stable`, read-only, and free of command/job/outbox/event mutation;
11. revoke execution from `public`, `anon`, and `service_role` and grant only to `authenticated`;
12. fail closed when Legal capability or exact case authority is missing.

Search matching may use canonical identifier text and existing safe presentation/identity metadata required to distinguish results. It must not create or persist a second search index or denormalized Legal-owned copy of private content.

### 2. Eligible Legal reviewer search

```text
public.search_messages_legal_reviewers_v1(
  p_case_id uuid,
  p_query text,
  p_limit integer default 20
)
```

The function returns only operators currently eligible to receive Legal Request Case assignment:

```text
user_id uuid
display_name text
secondary_label text null
```

The function must:

1. enforce the same authenticated Super Admin and `manage_messages_legal_cases` authority;
2. require the exact Legal Request Case context;
3. return only active users whose current role/capability assignment makes them eligible to operate the Legal case;
4. expose only bounded identity presentation needed for selection;
5. return no auth secret, session data, password material, private metadata JSON, or unrelated user profile data;
6. remain read-only and bounded to 20 results;
7. revoke execution from `public`, `anon`, and `service_role` and grant only to `authenticated`.

Gate C may also retain the existing backend behavior where a blank explicit reviewer assignment lets `start_messages_legal_review_v1` assign the current authorized Super Admin. The picker must not manufacture a different assignment authority.

## Search and privacy doctrine

These projections are not a general Super Admin private Messages browser.

They exist only inside an already-created Legal Request Case and only for an operator holding the narrow Legal management capability.

The UI must not preload broad result sets. Search starts only after deliberate operator input. Results must be compact and safe. Private evidence remains separately purpose-audited through `inspect_message_legal_evidence_v1` after preservation materialization.

The private-content boundary therefore remains server-enforced:

```text
safe target discovery != evidence inspection
safe metadata != Message body
case management != ambient Conversation access
```

## Gate C frontend convergence authority

With those reads available, Gate C must recompose `MessagesLegalPanel` around the accepted workflow:

```text
Request → Review → Scope → Evidence → Disclosure → Approval → Generation → Release → Delivery → Closure
```

The rail is a projection of canonical backend state only.

The Legal workspace must:

- keep a compact case queue/list separate from the active case workbench;
- show current/completed/blocked/upcoming workflow stages;
- emphasize the next valid governed action rather than every possible command equally;
- replace request-kind, notice, scope-kind, and classification native selects with WAKILISHA controls;
- replace browser-native date/time with the shared WAKILISHA DateTimePicker;
- use the case-bound scope target picker for Message, Conversation, Media, and Resource Version selection;
- use the eligible reviewer picker where explicit assignment is offered;
- remove routine raw UUID fields from the normal operator path;
- move evidence into the deliberate Inspector surface;
- move raw hashes, fingerprints, generated manifest text, and machine detail behind advanced inspection;
- render Legal events through the contextual AuditTimeline rather than a dominant raw history block;
- replace native package-object checkboxes with a WAKILISHA-owned selection control;
- use governed CommandSheet composition for human-reason actions;
- poll bounded worker-backed package states (`queued`, `generating`) while the active package/case remains selected, then stop polling at a terminal/non-worker state;
- preserve the accepted same-context released-package delivery behavior;
- preserve every Candidate C command name, expected-revision check, idempotency contract, approval fingerprint rule, preservation rule, and release/closure prerequisite.

## SQL boundary

The new migration may contain only the two safe read projections plus directly required comments/grants/helper-local code.

It must not:

- alter Candidate C Legal table shape;
- alter Messages canonical table shape;
- alter Media or Resource tables;
- add a Legal search/index table;
- add a capability or role;
- change existing Legal command functions;
- change Legal event vocabulary;
- add a worker, queue, scheduler, job type, or Edge Function;
- widen ordinary Messages participant reads;
- grant `service_role` browser-style Legal discovery.

A permanent read-only verifier must prove function signatures, grants, capability guards, case binding, result bounds, safe returned fields, absence of prohibited payload fields, and no new table authority.

## Deployment classification

Gate C is now classified as:

```text
SQL migration needed: YES, narrow safe read projection only
Supabase Edge Function deploy needed: NO
Media receiver deploy needed: NO
Legal worker deploy needed: NO
Frontend deploy needed: YES
PR needed: YES after Preview acceptance
```

SQL follows the normal migration workflow: disposable Preview first, schema/type/proof seal, protected PR/CI/merge, then Production SQL separately from the exact merged main before the merged frontend is promoted.

## Exit gate

Gate C is accepted only when a representative Legal Request Case can be operated without browser-native workflow chrome and without routine UUID entry, while deliberate evidence inspection, exact scoped disclosure authority, approval fingerprinting, generation, release, delivery, and closure remain unchanged.