# Phase 8B.4 Candidate B - Field Contributor / Newsroom Messages Production Closure Record

**Status:** Production deployed and accepted  
**Date:** 7 September 2026  
**Merged main:** `a8b98fe5a3d781aeb672b57b2bf57360e787254a`  
**Production migration count:** `108`  
**Production migration head:** `20260907075816_phase_8b4_field_messages_scope_policy_guard`

## Scope closed

Candidate B closes the real Field contributor <-> newsroom Messages vertical for Phase 8B.4.

Shipped authority includes:

- explicit Field follow-up policy using `follow_up_permission`, `preferred_contact_channel`, and `contact_point_id`;
- contributor Messages follow-up choice in the authenticated `/field` product flow;
- Field newsroom read authority through existing capability checks;
- canonical Field -> Messages bridge through `public.start_field_submission_message_v1`;
- exact governed Field Resource references in canonical Messages storage;
- workflow-scoped contributor reply under `audience_mode=internal` without broadening global Messages start authority;
- `can_start` and `can_send` separation so an authorized Field contributor may reply in the scoped Conversation but may not start unrelated Messages;
- immediate scoped-send revocation when current Field contact policy no longer permits Messages;
- `/messages?conversation=<uuid>` deep-link support;
- `/admin/field?submission=<uuid>` exact submission addressing;
- authorized governed Field Resource cards in Messages with `Open in Field` navigation while Field remains the mutation authority;
- generic governed-reference fallback for viewers who cannot resolve the owning Field workflow.

Candidate B does not duplicate Field intake, review, Media, Resource, notification, or messaging authority inside Messages.

## Repository authority

Candidate B implementation PR #854 merged, governed Resource navigation closure fix PR #855 merged, and terminal-safe Production backfill repair PR #856 merged.

Final accepted merged `main`:

```text
a8b98fe5a3d781aeb672b57b2bf57360e787254a
```

Accepted migrations:

```text
20260907075239_phase_8b4_field_messages.sql
20260907075350_phase_8b4_field_messages_uuid_resolution_fix.sql
20260907075655_phase_8b4_field_messages_hardening.sql
20260907075816_phase_8b4_field_messages_scope_policy_guard.sql
```

Permanent verifier:

```text
scripts/control-plane/verify-phase-8b4-field-messages.sql
```

Protected Critical Control Plane acceptance passed on the Candidate B implementation and repair heads, including migration replay enforcement, live schema drift, critical security/lifecycle contracts, targeted Field/Messages product tests, and application build.

## Preview acceptance

Disposable Candidate B Preview:

```text
branch_name=phase-8b4-field-messages
branch_id=7c5b57e2-207a-47bb-a53c-fbb659f732b6
project_ref=gmwnyorylzietjwxytoa
cost=$0.01344/hour
```

The accepted Preview schema authority was:

```text
migration_count=108
migration_head=20260907075816
```

Backend behavioral and permanent verifier acceptance proved:

```text
Field contact-policy convergence: PASS
newsroom -> contributor Message start: PASS
exact Field Resource reference: PASS
idempotent bridge replay: PASS
non-Messages preferred channel blocked: PASS
retired contributor identity blocked: PASS
contributor newsroom bridge blocked: PASS
unauthorized staff newsroom bridge blocked: PASS
contributor scoped reply under internal audience: PASS
contributor unrelated recipient search/start blocked: PASS
current-policy revocation kills scoped send: PASS
Conversation membership does not leak Field Resource authority: PASS
```

Preview browser acceptance proved:

```text
EDITOR FIELD INTAKE: PASS
EDITOR MESSAGE START: PASS
MESSAGES DEEP LINK: PASS
CONTRIBUTOR CONVERSATION ACCESS: PASS
CONTRIBUTOR UNRELATED NEW MESSAGE BLOCKED: PASS
EDITOR SEES CONTRIBUTOR REPLY: PASS
GOVERNED RESOURCE CARD: PASS
OPEN IN FIELD NAVIGATION: PASS
EXACT FIELD SUBMISSION SELECTED: PASS
```

## Production SQL promotion and terminal-row repair

The first direct Production apply correctly stopped on historical terminal Field rows because the existing Phase 8A mutation guard rejected the Candidate B one-time compatibility backfill.

Production rollback was complete:

```text
migration_count=104
migration_head=20260907061830
candidate_b_column_exists=false
field_state_counts={"cancelled":8,"submitted":3}
```

The migration was repaired without weakening runtime Phase 8A protection. The repaired one-time backfill:

1. disables only `field_submissions_protect_mutation` inside the migration transaction;
2. performs the deterministic contact-policy compatibility backfill;
3. flushes deferred Field Resource-binding constraint events with `set constraints all immediate`;
4. re-enables `field_submissions_protect_mutation` immediately;
5. returns constraints to deferred mode for the remainder of the migration.

A rollback-only Production-shaped proof using terminal `submitted` and `cancelled` rows passed before Production retry. The repaired migration was resealed with:

```text
MIGRATION_SHA256=fccea161f6f7c6da07d8b6d14ad8a5a510b0db2f6aa3ec2296138503dacb17d9
```

The final Production apply then passed:

```text
PRODUCTION_DB_PUSH=PASS
PRODUCTION_AFTER_COUNT=108
PRODUCTION_AFTER_HEAD=20260907075816
PRODUCTION_LEDGER_108=PASS
PHASE_8B4_CANDIDATE_B_PRODUCTION_SQL_RETRY=PASS
```

The permanent rollback-only Production verifier returned:

```text
PHASE_8B4_FIELD_MESSAGES_VERIFIER_PASS
```

No Supabase Edge Function deployment was required.

## Frontend Production deployment

The exact merged `main` frontend was deployed through the established Lightsail authority:

```text
host=35.176.52.252
ssh_user=ubuntu
live_root=/opt/wakilisha-react
backup_root=/opt/wakilisha-react-backups
```

Accepted deployment proof:

```text
DEPLOYED_MAIN=a8b98fe5a3d781aeb672b57b2bf57360e787254a
LOCAL_INDEX_SHA256=fa1d2e30ecb1597d87752066fc03aaea68fb7d034afca21686cb108092b4c0e2
REMOTE_INDEX_SHA256=fa1d2e30ecb1597d87752066fc03aaea68fb7d034afca21686cb108092b4c0e2
LOCAL_FILE_COUNT=298
REMOTE_FILE_COUNT=298
INDEX_SHA_PARITY=PASS
FILE_COUNT_PARITY=PASS
NGINX_TEST=PASS
PUBLIC_HTTPS_SMOKE=PASS
PHASE_8B4_CANDIDATE_B_PRODUCTION_FRONTEND_DEPLOY=PASS
```

Public HTTPS smoke returned HTTP 200 on:

```text
/
/messages
/admin/messages
/admin/field
```

Rollback authority:

```text
/opt/wakilisha-react-backups/20260907T114323Z
```

## Real Production vertical acceptance

### MIZIZI -> Super Admin

A real Production operational standup was sent through the accepted System Actor command path.

Accepted authority:

```text
principal_key=system:mizizi
sender_actor_kind=system
sender_actor_key=mizizi
receipt_status=succeeded
conversation_id=31dba54a-26a5-4acf-88e1-f6fe85eff96a
message_id=6a94e043-9b6f-40ba-84a5-2d415386c3f6
mailbox_folder=inbox
first_contact_state=accepted
notification_type=direct_message
notification_actor_id=NULL
notification_body_projection_absent=true
```

### Distinct real Field contributor <-> newsroom

A distinct Production contributor account was granted only the existing `field_contributor` role while retaining `subscriber`:

```text
roles=subscriber,field_contributor
capabilities=read_own_field_capture,submit_field_capture
```

That contributor created a real submission through `/field`:

```text
submission_reference=FS-20260907-7DDAC27499
resource_id=239c65cc-443c-46cd-8a69-4d572cecce87
submission_state=submitted
current_revision=3
follow_up_permission=allowed
preferred_contact_channel=messages
owner_distinct_from_super_admin=true
```

The Super Admin opened the exact newsroom submission and sent:

```text
Can you share a little more context for the newsroom?
```

Canonical Conversation authority:

```text
conversation_id=27c51557-924d-4f76-ab57-c66e73d064dd
editor_message_id=cd5c3bff-6d36-48eb-bbc9-16d4d1726beb
resource_id=239c65cc-443c-46cd-8a69-4d572cecce87
resource_version_id=NULL
presentation_kind=resource
```

The contributor's live access projection was:

```text
visible=true
can_send=true
can_start=false
audience_mode=internal
sender_category=contributors
conversation_visible=true
```

The contributor replied:

```text
Here is the additional context for the newsroom.
```

Persisted Production proof:

```text
contributor_message_id=0e7d41e4-249e-4c29-95c0-61e4953d9dd5
message_count=2
editor_message_exists=true
contributor_reply_exists=true
field_reference_intact=true
```

Browser acceptance confirmed the Super Admin saw the contributor reply and that the governed Field Submission card remained actionable with `Open in Field`. On the contributor side, the same governed reference remained non-authoritative and did not expose newsroom Field access.

## Closure decision

Phase 8B.4 Candidate B is closed in Production.

Accepted state:

```text
Repository implementation: MERGED
Terminal-row migration repair: MERGED
Production SQL: PASS
Production migration parity: PASS
Permanent Production verifier: PASS
Replay proof/schema seal: PASS
Edge Functions: NOT REQUIRED
Exact merged-main build: PASS
Lightsail deployment: PASS
Index SHA parity: PASS
File-count parity: PASS
Nginx validation: PASS
Production HTTPS smoke: PASS
Real MIZIZI -> Super Admin standup: PASS
Real distinct Field contributor submission: PASS
Newsroom -> contributor Message: PASS
Contributor scoped reply: PASS
Editor sees contributor reply: PASS
Governed Field Resource navigation: PASS
Field remains owning authority: PASS
Global Messages audience remains internal: PASS
Rollback authority: PRESERVED
```

Phase 8B.4 remains open. Candidate C is next: exact-version editorial Resource review projection/action through Messages while the owning Resource's existing review command remains the sole mutation authority.
