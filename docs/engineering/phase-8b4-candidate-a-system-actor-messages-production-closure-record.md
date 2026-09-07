# Phase 8B.4 Candidate A - Accountable System Messages Production Closure Record

**Status:** Production deployed and accepted  
**Date:** 7 September 2026  
**Merged main:** `5d1712e03b7f76ea992d83bf6b29a8c57a63bded`  
**Production migration count:** `104`  
**Production migration head:** `20260907061830_phase_8b4_system_actor_notification_fix`

## Scope closed

Candidate A closes the accountable System Actor + governed System Messages foundation for Phase 8B.4.

Shipped authority includes:

- private accountable System Actor identity in `platform_private`;
- explicit executor binding separate from actor identity;
- durable command principal `system:mizizi` using the existing command receipt authority;
- governed MIZIZI System Message send over canonical Messages storage;
- Super Admin-only recipient scope for Candidate A;
- mixed Human/System conversation presentation;
- System Actor request approval using the existing sender approval model;
- blocked human reply for MIZIZI under the Candidate A policy;
- safe direct-message notification projection with `actor_id = null` and no Message body in notification metadata;
- existing `/admin/messages` Agents surface for Messages-only enable/disable control;
- actor identity remaining active when only Messages permission is disabled.

Candidate A does not implement the scheduled MIZIZI standup, Field contributor/newsroom convergence, exact Resource Version workflow cards/actions, Safety, Legal, or public Messages audience expansion.

## Repository authority

Implementation PR #851 merged to `main` at:

```text
5d1712e03b7f76ea992d83bf6b29a8c57a63bded
```

Accepted migrations:

```text
20260907061655_phase_8b4_system_actor_messages.sql
20260907061830_phase_8b4_system_actor_notification_fix.sql
```

Permanent verifier:

```text
scripts/control-plane/verify-phase-8b4-system-actor-messages.sql
```

Protected Critical Control Plane acceptance passed, including:

```text
migration replay contract: PASS
migration replay tests: PASS
primitive compounding contract: PASS
critical security and lifecycle tests: PASS
live schema and migration-history drift: PASS
application build: PASS
```

The repository schema seal and replay proofs were advanced to the accepted 104-migration head before merge.

## Preview acceptance

Disposable Preview:

```text
name=phase-8b4-system-actor-messages
project_ref=bepufyydxueqjefgliux
branch_id=ba3555ac-8b93-45f3-b587-58c1f18a6385
```

The Preview database was accepted at:

```text
migration_count=104
migration_head=20260907061830
preview_project_status=ACTIVE_HEALTHY
branch_status=FUNCTIONS_DEPLOYED
```

Rollback-only behavioral acceptance proved:

```text
system principal system:mizizi: PASS
actor-scoped idempotent replay: PASS
notification actor_id NULL: PASS
notification body projection absent: PASS
mixed System/Human presentation: PASS
human reply blocked: PASS
non-Super-Admin recipient blocked: PASS
Messages-only MIZIZI kill control: PASS
actor identity remains active while Messages disabled: PASS
fixture persistence rollback-only: PASS
```

## Production SQL promotion

Production converged to:

```text
migration_count=104
migration_head=20260907061830
```

The Supabase branch promotion completed asynchronously after returning success. An attempted direct replay of the first migration then stopped safely at its preflight because Candidate A authority already existed. No duplicate Production mutation occurred.

Production verification confirmed:

```text
MIZIZI actor: active
MIZIZI Messages policy: enabled
recipient scope: super_admin_only
allow_human_reply: false
notification forward repair: present
```

The permanent rollback-only verifier then passed on Production with the same Candidate A matrix accepted in Preview.

No Supabase Edge Function deployment was required.

## Frontend Production deployment

The exact merged `main` frontend was deployed using the established Lightsail authority:

```text
host=35.176.52.252
ssh_user=ubuntu
live_root=/opt/wakilisha-react
backup_root=/opt/wakilisha-react-backups
```

Exact merged-main build authority:

```text
MERGED_MAIN=5d1712e03b7f76ea992d83bf6b29a8c57a63bded
LOCAL_INDEX_SHA256=f4c605d940f5736e3e55c3817d1147bd836aaca326cdb9e2f1a764934ac1a7b6
LOCAL_FILE_COUNT=3702
```

An initial deployment attempt reached exact parity and passed `nginx -t`, then rolled back because an extra direct-origin certificate verification check failed on the local CA chain. Read-only diagnosis proved both public HTTPS and the same origin with certificate verification bypassed returned HTTP 200 on `/`, `/messages`, and `/admin/messages`. The extra origin certificate check was not part of the accepted WAKILISHA Lightsail deployment contract and was removed from rollback authority.

The controlled redeploy then passed:

```text
LOCAL_INDEX_SHA256=f4c605d940f5736e3e55c3817d1147bd836aaca326cdb9e2f1a764934ac1a7b6
REMOTE_INDEX_SHA256=f4c605d940f5736e3e55c3817d1147bd836aaca326cdb9e2f1a764934ac1a7b6
LOCAL_FILE_COUNT=3702
REMOTE_FILE_COUNT=3702
LIGHTSAIL_BUILD_PARITY=PASS
NGINX_VALIDATION=PASS
HOME_HTTP=200
MESSAGES_HTTP=200
ADMIN_MESSAGES_HTTP=200
PHASE_8B4_PRODUCTION_HTTPS_SMOKE=PASS
PHASE_8B4_LIGHTSAIL_FRONTEND_DEPLOY=PASS
```

Final frontend rollback authority:

```text
/opt/wakilisha-react-backups/phase8b4-redeploy-20260907T065158Z-5d1712e0
```

## Authenticated Production browser acceptance

The live Super Admin Messages Control Center visually proved:

- `Messaging agents = 1`;
- `MIZIZI Cultural Data Steward` rendered as the registered System Actor;
- actor key `mizizi` rendered;
- purpose `operational_update` rendered;
- recipient scope `super admin only` rendered;
- replies `blocked` rendered;
- initial Messages state rendered `MESSAGES ON` with the `Disable Messages` control;
- after disabling, the surface rendered `MESSAGES OFF` with the `Enable Messages` control.

The normal user `/messages` surface also loaded successfully after deployment with Inbox, Requests, Spam, and Archive navigation and no visible regression.

A final Production policy read confirmed the re-enable completed successfully:

```text
actor_key=mizizi
actor_status=active
messaging_enabled=true
revision=3
recipient_scope=super_admin_only
allow_human_reply=false
```

`revision=3` proves the accepted sequence:

```text
initial enabled revision 1
-> disable revision 2
-> re-enable revision 3
```

No scheduled MIZIZI conversation is required for Candidate A closure. The scheduled operational standup belongs to the next Phase 8B.4 vertical, while the real System send path itself is already proved by the permanent Preview and Production verifier.

## Preview cleanup

Immediately before deletion:

```text
Production: migration_count=104, migration_head=20260907061830
Preview:    migration_count=104, migration_head=20260907061830
```

The disposable Preview branch was then deleted successfully. No temporary Supabase Preview cost remains for Candidate A.

## Closure decision

Phase 8B.4 Candidate A is closed in Production.

Accepted state:

```text
Repository implementation: MERGED
Production SQL: PASS
Production migration parity: PASS
Permanent verifier: PASS
Replay proofs/schema seal: PASS
Edge Functions: NOT REQUIRED
Exact merged-main build: PASS
Lightsail deployment: PASS
Build parity: PASS
Nginx validation: PASS
Production HTTPS smoke: PASS
Authenticated Agents presentation: PASS
Messages-only disable: PASS
Messages-only re-enable: PASS
User Messages regression smoke: PASS
Rollback authority: PRESERVED
Disposable Preview: DELETED
```

Phase 8B.4 remains open. The next required vertical proof is Field contributor <-> newsroom Messages without creating Field-owned messaging authority. After that, Phase 8B.4 still requires exact Resource Version editorial workflow projection/action through Messages while the target Resource's existing review command remains mutation authority.
