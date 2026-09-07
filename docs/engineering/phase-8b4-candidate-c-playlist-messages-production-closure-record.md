# Phase 8B.4 Candidate C - Exact Playlist Review through Messages Production Closure Record

**Status:** Production deployed and accepted  
**Date:** 7 September 2026  
**Merged main:** `31d26b7444efb3c6f978897b4013dc71b15f96c7`  
**Production migration count:** `109`  
**Production migration head:** `20260907142000_phase_8b4_playlist_messages`

## Scope closed

Candidate C closes the exact-version editorial workflow vertical for Phase 8B.4 by projecting Playlist Review into canonical Messages while preserving the existing Playlist review command as the sole mutation authority.

Shipped behavior includes:

- `Discuss in Messages` from the owning Playlist workspace for the exact submitted Resource Version;
- canonical Messages Resource references with `presentation_kind=version`;
- permission-safe Playlist Review projection through `public.get_message_playlist_review_projection_v1(uuid,uuid)`;
- exact title, version number, Playlist state, authority revision, and current submitted-version projection;
- `Start Review` when the exact submitted Playlist is `ready_for_review`;
- `Request Changes` and `Approve` when the exact submitted Playlist is `in_review`;
- no `Publish` action in Messages;
- review-participation and review-management authority kept separate;
- stale authority-revision and stale submitted-version rejection delegated to the existing canonical `public.review_playlist(...)` command;
- generic governed-reference fallback when the viewer cannot resolve the private Playlist Review projection.

Candidate C does not create a Messages-owned review command, publication command, Playlist item authority, Registry authority, Media authority, or second editorial workflow engine.

## Repository authority

Candidate C design PR #858 merged before implementation.

Candidate C implementation PR #859 merged with final implementation head:

```text
1f3eba224ada620469c8f76321b70368aedf7cb1
```

Final merged `main`:

```text
31d26b7444efb3c6f978897b4013dc71b15f96c7
```

Accepted migration:

```text
20260907142000_phase_8b4_playlist_messages.sql
```

Accepted migration SHA256:

```text
e330f89b8c264a90e98422b100ed7a752ac1106131f1ecaa8bda4c8885ce1bdc
```

Permanent verifier:

```text
scripts/control-plane/verify-phase-8b4-playlist-messages.sql
```

Protected Critical Control Plane acceptance on the sealed implementation head:

```text
Critical Control Plane #1050: SUCCESS
head=1f3eba224ada620469c8f76321b70368aedf7cb1
```

## Preview replay diagnosis and acceptance

Supabase Preview branch status was observed to advance ahead of direct database migration replay. Early direct-ledger snapshots at `33 @ 20260820160500` and `89 @ 20260904190000` were intermediate replay checkpoints rather than valid terminal migration failures.

The accepted authority rule was therefore direct database ledger state, not branch metadata.

The first real Candidate C migration attempt exposed one narrow PL/pgSQL implementation defect:

```text
ERROR: 42601
record variable cannot be part of multiple-item INTO list
```

The invalid `%rowtype` load was repaired by separating Playlist Resource loading from Playlist binding resolution. The failed migration transaction rolled back completely before the repair was applied.

Final disposable Candidate C Preview:

```text
branch_id=85674663-4c31-448b-9a80-2f3920c53399
project_ref=dsnpgcwmtkwcovucwroi
cost=$0.01344/hour
```

Accepted Preview schema authority:

```text
migration_count=109
migration_head=20260907142000
```

The permanent verifier passed on Preview:

```text
PHASE_8B4_PLAYLIST_MESSAGES_VERIFIER_PASS
```

Rollback-only behavioral acceptance proved:

```text
authorized manager exact-version projection: PASS
read-only analyst exact-version projection: PASS
analyst review actions hidden: PASS
projection does not mutate Playlist state: PASS
stale authority revision rejected: PASS
stale submitted version rejected: PASS
canonical start_review mutation succeeds: PASS
refreshed in_review action policy: PASS
analyst canonical mutation blocked: PASS
```

## Replay proof and schema seal

The migration replay contract initially blocked PR #859 because Candidate C had not yet recorded its replay proof or Preview-sealed generated schema types.

The accepted Mac seal generated the exact Preview schema snapshot and wrote:

```text
docs/engineering/replay-proofs/20260907142000_phase_8b4_playlist_messages.sql.json
docs/engineering/live-schema-baseline.json
src/types/database.types.ts
```

Accepted Preview-sealed schema types SHA256:

```text
f90e86260df3789245aa3f55a03fdd0cee61b49721f950ada64f807e238d26b4
```

Local replay-control acceptance:

```text
MIGRATION_REPLAY_CONTRACT=PASS
MIGRATION_REPLAY_CONTRACT_TEST=PASS
SEALED_TYPES_BUILD=PASS
```

That seal produced final Candidate C head `1f3eba224ada620469c8f76321b70368aedf7cb1`, after which protected Critical Control Plane #1050 passed.

## Preview browser acceptance

Disposable Preview identities were created for a manager and a read-only analyst. One exact submitted Playlist fixture was used to prove the real user-visible workflow.

Browser acceptance passed:

```text
MANAGER EXACT-VERSION CARD: PASS
MANAGER START REVIEW ACTION: PASS
ANALYST EXACT-VERSION CARD: PASS
ANALYST REVIEW ACTIONS HIDDEN: PASS
MANAGER START REVIEW THROUGH MESSAGES: PASS
CARD REFRESHES TO IN REVIEW: PASS
REQUEST CHANGES AVAILABLE: PASS
APPROVE AVAILABLE: PASS
PUBLISH ABSENT FROM MESSAGES: PASS
```

The persisted Preview state confirmed the same exact Message Resource Version reference and a canonical `review_started` event created by `public.review_playlist(...)`.

## Production SQL promotion

Production predecessor authority before Candidate C:

```text
migration_count=108
migration_head=20260907075816
```

The exact merged-main Production dry-run contained only:

```text
20260907142000_phase_8b4_playlist_messages.sql
```

Production apply acceptance:

```text
PRODUCTION_DB_PUSH=PASS
PRODUCTION_AFTER_COUNT=109
PRODUCTION_AFTER_HEAD=20260907142000
PRODUCTION_LEDGER_109=PASS
PRODUCTION_SCHEMA_SNAPSHOT=PASS
PHASE_8B4_CANDIDATE_C_PRODUCTION_SQL=PASS
```

The permanent Candidate C verifier then executed on Production without exception.

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
DEPLOYED_MAIN=31d26b7444efb3c6f978897b4013dc71b15f96c7
LOCAL_INDEX_SHA256=ed1437d3fdc4127f1413140d01df8cb0fc03b84b2e30c4921e539cc084703eab
REMOTE_INDEX_SHA256=ed1437d3fdc4127f1413140d01df8cb0fc03b84b2e30c4921e539cc084703eab
LOCAL_FILE_COUNT=298
REMOTE_FILE_COUNT=298
INDEX_SHA_PARITY=PASS
FILE_COUNT_PARITY=PASS
NGINX_TEST=PASS
PUBLIC_HTTPS_SMOKE=PASS
PHASE_8B4_CANDIDATE_C_PRODUCTION_FRONTEND_DEPLOY=PASS
```

Public HTTPS smoke returned HTTP 200 on:

```text
/
/messages
/admin/messages
/admin/content/playlists
```

Rollback authority:

```text
/opt/wakilisha-react-backups/20260907T155133Z
```

## Real Production exact-version acceptance

No existing Production Playlist was in an active review state, so acceptance used a real Playlist created and submitted through the live Admin Studio workflow rather than mutating historical editorial state backward.

Real Production Playlist:

```text
title=Top 100 Kenyan Songs Released in 2026
playlist_id=2cf8aadc-368e-4f23-8c4e-8efbb79feb99
resource_id=2cf8aadc-368e-4f23-8c4e-8efbb79feb99
submitted_version_id=79fe0a19-c4c8-4c99-b409-be93bf0c26c6
version_number=2
initial_status=ready_for_review
initial_authority_revision=3
```

The existing Production account `beautahj@gmail.com` was explicitly granted the existing `analyst` role for acceptance. Its final review capability boundary was:

```text
view_review_queue=true
manage_review_queue=false
```

The Super Admin retained review-management authority.

Production browser acceptance passed:

```text
PRODUCTION MANAGER EXACT-VERSION CARD: PASS
PRODUCTION MANAGER START REVIEW ACTION: PASS
PRODUCTION ANALYST EXACT-VERSION CARD: PASS
PRODUCTION ANALYST REVIEW ACTIONS HIDDEN: PASS
PRODUCTION START REVIEW THROUGH MESSAGES: PASS
PRODUCTION CARD REFRESHES TO IN REVIEW: PASS
PRODUCTION REQUEST CHANGES AVAILABLE: PASS
PRODUCTION APPROVE AVAILABLE: PASS
PRODUCTION PUBLISH ABSENT FROM MESSAGES: PASS
```

Independent persisted Production proof:

```text
migration_count=109
migration_head=20260907142000
playlist_status=in_review
authority_revision=4
submitted_version_id=79fe0a19-c4c8-4c99-b409-be93bf0c26c6
message_id=da524b6d-f6eb-4a0a-bd58-7b5cb41636af
conversation_id=27c51557-924d-4f76-ab57-c66e73d064dd
presentation_kind=version
review_action=review_started
review_prior_status=ready_for_review
review_resulting_status=in_review
review_command_receipt_id=3b30bb6b-2256-420c-8cdd-cea4fbdf6125
```

The existing canonical Playlist review command remains the mutation authority. Messages carries context and permitted actions only.

## Operational housekeeping

The paid Candidate C Preview was deleted after Production acceptance:

```text
branch_id=85674663-4c31-448b-9a80-2f3920c53399
delete=PASS
```

The Supabase branch control plane then showed only the default Production branch. No Candidate C Preview cost remains.

The local Preview Vite process used for browser acceptance is disposable local tooling and is not part of Production authority.

## Follow-up observed during Production acceptance

A separate Playlist authoring limitation was observed while creating the real Production acceptance Playlist: Playlist description is still a plain textarea and cannot express governed inline links, canonical Artist references, Track/Release references, or richer editorial structure.

This is not a Candidate C defect and is excluded from the closure decision below. It is the next contained Playlist editor enhancement and should reuse the existing governed Article rich-content architecture rather than introduce a second editor stack.

## Closure decision

Phase 8B.4 Candidate C is closed in Production.

Candidate C also completes the three required Phase 8B.4 vertical proofs:

```text
MIZIZI -> Super Admin governed operational Message: PASS
Field contributor <-> newsroom through canonical Messages: PASS
exact Resource Version editorial workflow projection/action through Messages: PASS
```

Accepted state:

```text
Repository implementation: MERGED
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
Real exact Playlist Version reference: PASS
Read-only analyst review projection: PASS
Analyst review mutation controls hidden: PASS
Start Review through Messages: PASS
Canonical Playlist review event persistence: PASS
Request Changes / Approve projection after transition: PASS
Publish remains in Playlist workspace: PASS
Playlist remains owning review authority: PASS
Global Messages audience remains internal: PASS
Paid Preview cleanup: PASS
Rollback authority: PRESERVED
```

Phase 8B.4 exit gate is satisfied. The next numbered Messages slice may proceed independently; the Playlist rich-description enhancement is a separate Product/Editorial follow-up discovered during this acceptance.
