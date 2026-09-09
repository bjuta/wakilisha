# Phase 8B.5 Candidate B Production Closure Record

**Status:** Production accepted and closed  
**Date:** 9 September 2026  
**Accepted merged main before closure docs:** `597a0cfeb6d443fa93584cfc2ff304b7fe84d2f8`  
**Production migration head:** `20260908184500_phase_8b5_candidate_b_enforcement_recovery_severe_media`  
**Production migration count:** `111`

## Scope

This record closes Phase 8B.5 Candidate B, Enforcement, recovery, and severe Media boundary.

Accepted scope includes:

- graduated Messages enforcement for warning, cooldown, rate limit, links, Media references, conversation starts, suspension, and removal;
- severe-category bypass where policy permits;
- report counts and provider signals remaining evidence, not verdict authority;
- accountable and idempotent enforcement mutations;
- appeal submission, review, reversal, modification, and recovery state;
- exact canonical Media identity for severe matching and containment;
- isolated scan/job processing through existing jobs, outbox, retry, and dead-letter primitives;
- participant-safe restriction state that does not expose internal Safety review notes;
- Super Admin controls within the existing `/admin/messages` Safety Case surface.

Candidate C, Legal Request Cases and disclosure production, remains out of scope and follows this closure.

## Repository authority

Candidate B implementation merged through PR #882.

The Production verifier fixture repair merged through PR #883.

The Production schema seal merged through PR #884.

The permanent verifier is:

```text
scripts/control-plane/verify-phase-8b5-candidate-b-enforcement-recovery-severe-media.sql
```

Accepted verifier SHA-256:

```text
5f762f0c8db7ee68b0b418976bd1a0351960d6f16795c30ec8cfdbe63dc85e59
```

The canonical repository migration is:

```text
supabase/migrations/20260908184500_phase_8b5_candidate_b_enforcement_recovery_severe_media.sql
```

## Production SQL promotion

Production promotion used the native Supabase CLI from exact merged main so the canonical repository migration version remained authoritative.

Final Production history:

```text
migration_count=111
migration_head=20260908184500
```

A post-promotion dry run reported the remote database as up to date.

No Supabase Edge Function deployment was required.

## Production verifier acceptance

The permanent Candidate B verifier passed on Production after one verifier-only fixture repair to align the Field Submission reference with the existing canonical `FS-YYYYMMDD-XXXXXXXXXX` contract.

The repair changed no Production schema and required no data repair.

Final verifier summary:

```text
verification=PASS
migration_count=111
migration_head=20260908184500
candidate_b_tables=3
candidate_b_commands=7
subjects=5
provider_signal_events=1
active_media_containment=0
```

Rollback residue checks found no durable verifier test users, role assignments, Media fixtures, or Candidate B command receipts.

## Frontend Production deployment

The exact merged-main frontend at `597a0cfeb6d443fa93584cfc2ff304b7fe84d2f8` was built and deployed to the established Lightsail frontend authority.

Build authority:

```text
LOCAL_INDEX_SHA256=1132941549ddd946cd121165a048b58f15741ed10397de4fad3e0f5f05924e26
LOCAL_ENTRY=assets/index-Dp7Vm1xS.js
LOCAL_ENTRY_SHA256=abaedf9f72541a64c4404e76fc8321ff921ba5996757e0ca1d36c96d63f8d8c1
LOCAL_FILE_COUNT=3706
```

Remote parity:

```text
REMOTE_INDEX_SHA256=1132941549ddd946cd121165a048b58f15741ed10397de4fad3e0f5f05924e26
REMOTE_ENTRY_SHA256=abaedf9f72541a64c4404e76fc8321ff921ba5996757e0ca1d36c96d63f8d8c1
REMOTE_FILE_COUNT=3706
LIGHTSAIL_BUILD_PARITY=PASS
NGINX_VALIDATION=PASS
```

Rollback snapshot:

```text
/opt/wakilisha-react-backups/phase8b5-candidate-b-20260908T213213Z-597a0cfe
```

Direct-origin and public HTTPS smoke both returned `200` for:

```text
/
/messages
/admin/messages
/magazine
/charts
/artists
/playlists
/sitemap.html
/sitemap.xml
```

The public entry asset SHA-256 matched the deployed Lightsail artifact exactly.

The direct-origin certificate is a Cloudflare Origin CA certificate, so direct-origin acceptance intentionally bypassed local public-CA verification while public HTTPS acceptance retained normal certificate verification.

## Authenticated Production canary

A real existing Messages conversation was used. No disposable Production user was created.

The canary proved:

```text
NEW SAFETY CASE=PASS
REPORT DOES NOT AUTO-ENFORCE=PASS
START REVIEW=PASS
ASSESSMENT=PASS
WARNING APPLY=PASS
PARTICIPANT SAFETY STATE=PASS
INTERNAL NOTE HIDDEN=PASS
APPEAL SUBMIT=PASS
APPEAL REVERSE=PASS
FINAL EFFECTIVE ENFORCEMENTS=0
```

The canary Safety Case was resolved after appeal reversal with:

```text
status=resolved
current_disposition=no_action
enforcement_rows=1
effective_enforcements=0
appeal_rows=1
unresolved_appeals=0
appeal_resolution=reversed
```

Resolution note:

```text
Candidate B Production acceptance complete. Warning reversed on appeal; no effective restriction remains.
```

This preserves historical enforcement and appeal evidence while accurately recording that no restriction remained effective at final resolution.

## Severe Media acceptance

No unsafe sample content was introduced into Production merely to exercise severe Media controls.

The permanent verifier already proved exact canonical Media matching, containment, release, isolated scan job authority, and clean rollback behavior. This is accepted as the Production behavior proof for the severe Media boundary.

## Preview closure

The disposable Supabase Preview was:

```text
name=phase-8b5-candidate-b-preview-v2
project_ref=ughnlbuqffffoorucwyw
branch_id=f89e47f8-6a42-45b6-aea2-d683a97fc754
```

The Preview carried a Supabase-assigned Candidate B migration version `20260908182345`, while the canonical repository and Production authority use `20260908184500`.

Preview was therefore never used as promotion authority.

After Production SQL, verifier, frontend, and authenticated canary acceptance completed, the disposable Preview branch was deleted successfully.

## Closure decision

Phase 8B.5 Candidate B is closed.

Accepted state:

```text
Production SQL=PASS
Canonical migration identity=PASS
Permanent Production verifier=PASS
Verifier rollback cleanliness=PASS
Repository schema seal=PASS
Supabase Edge Function deployment=NOT REQUIRED
Merged-main frontend build=PASS
Lightsail deployment=PASS
Build parity=PASS
Nginx validation=PASS
Direct-origin HTTPS smoke=PASS
Public HTTPS smoke=PASS
Authenticated enforcement canary=PASS
Participant-safe appeal and recovery=PASS
Severe Media verifier boundary=PASS
Disposable Preview=DELETED
```

The next Phase 8B.5 slice is Candidate C, Legal Request Cases and disclosure production.