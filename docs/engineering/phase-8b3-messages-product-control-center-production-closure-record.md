# Phase 8B.3 Messages Product and Control Center Production Closure Record

**Status:** Production deployed and closed  
**Date:** 7 September 2026  
**Merged main:** `73d41bc33d9d4cefb09dce41c594f3567aa70258`  
**Production migration head:** `20260907003000_phase_8b_messages_core_verifier_runtime_state_independence`  
**Production migration count:** `102`

## Scope

This record closes Phase 8B.3, Product + Super Admin Control Center.

The shipped scope includes:

- user Messages surfaces;
- Profile messaging privacy settings;
- recipient discovery, including email matching without exposing email as a result field;
- DM notification integration through the existing notifications primitive;
- mobile and desktop notification access;
- shared sign-out behavior;
- Super Admin Messages Control Center at `/admin/messages`;
- server-enforced Super Admin access boundaries;
- ordinary Administrator denial for the Control Center.

This closure does not close Phase 8B as a programme. Phase 8B.4, 8B.5, and 8B.6 remain future work under `docs/engineering/phase-8b-messages-authority-and-product-contract.md`.

## Merge and repository authority

Phase 8B.3 merged to `main` at:

```text
73d41bc33d9d4cefb09dce41c594f3567aa70258
```

The pre-merge branch verification recorded:

- six permanent SQL verifiers: PASS;
- six replay proofs: PASS;
- critical suite: 304 tests PASS;
- focused route/chrome suite: 13 tests PASS;
- full build: PASS;
- schema verify: PASS;
- diff integrity: PASS.

The final authoritative schema baseline records:

```text
migration_count=102
migration_head=20260907003000
```

The final migration is:

```text
supabase/migrations/20260907003000_phase_8b_messages_core_verifier_runtime_state_independence.sql
```

The permanent product verifier is:

```text
scripts/control-plane/verify-phase-8b-messages-product-control-center.sql
```

## Production SQL promotion

Production SQL promotion completed before frontend activation.

Final Production authority:

```text
migration_count=102
migration_head=20260907003000
```

The Production chain matched the accepted Preview chain exactly at closure.

The final verifier family passed on Production, including the repaired runtime-state-independent Messages core verifier.

No Supabase Edge Function deployment was required for Phase 8B.3.

## Frontend Production deployment

The exact merged `main` frontend was deployed to the established Lightsail frontend authority.

Deployment authority:

```text
host=35.176.52.252
ssh_user=ubuntu
ssh_key=$HOME/.ssh/LightsailDefaultKey-eu-west-wk.pem
live_root=/opt/wakilisha-react
backup_root=/opt/wakilisha-react-backups
```

The deployment used the accepted WAKILISHA frontend mechanism:

1. prove exact clean merged `main`;
2. use the exact merged-main `dist` build;
3. create a timestamped copy of the current live tree;
4. deploy `dist/` with `rsync -az --delete` through `sudo rsync`;
5. compare local and remote `index.html` SHA-256;
6. compare local and remote file counts;
7. run `sudo nginx -t`;
8. run Production HTTPS smoke checks.

## Build parity proof

The deployed frontend matched the local merged-main build exactly:

```text
LOCAL_INDEX_SHA256=be1beedd5f6f7ae1465abebb062d5afad1f0f82c96238bb108ddd6945e700fa0
REMOTE_INDEX_SHA256=be1beedd5f6f7ae1465abebb062d5afad1f0f82c96238bb108ddd6945e700fa0
LOCAL_FILE_COUNT=3702
REMOTE_FILE_COUNT=3702
LIGHTSAIL_BUILD_PARITY=PASS
```

Nginx validation passed:

```text
nginx: the configuration file /etc/nginx/nginx.conf syntax is ok
nginx: configuration file /etc/nginx/nginx.conf test is successful
NGINX_VALIDATION=PASS
```

## Production smoke

The post-deploy HTTPS smoke passed:

```text
HOME_HTTP=200
MESSAGES_HTTP=200
ADMIN_MESSAGES_HTTP=200
PHASE_8B3_PRODUCTION_HTTPS_SMOKE=PASS
```

The checked routes were:

```text
https://wakilisha.africa/
https://wakilisha.africa/messages
https://wakilisha.africa/admin/messages
```

The deployment closed with:

```text
PHASE_8B3_LIGHTSAIL_FRONTEND_DEPLOY=PASS
```

## Rollback authority

The exact pre-deploy frontend tree was preserved at:

```text
/opt/wakilisha-react-backups/phase8b3-20260906T231205Z-73d41bc3
```

If rollback is required, this backup is the accepted pre-8B.3 frontend authority for this deployment event.

Database rollback is not implied by frontend rollback. The Phase 8B.3 SQL chain is additive and remains governed by forward migration authority.

## Browser acceptance already proven before Production promotion

Preview browser acceptance proved the narrow Messages product before Production promotion, including:

- Super Admin and internal-user DM exchange;
- send and reply behavior;
- recipient discovery;
- recipient discovery by email after the forward SQL correction;
- notifications bell and unread badge;
- DM notification feed;
- notification click-through to Messages;
- desktop notifications access;
- mobile notifications access;
- mobile short-page top-bar accessibility;
- mobile and desktop sign-out discoverability;
- ordinary Administrator denial from the Super Admin Messages surface;
- Member denial where required by the initial audience boundary.

A second eligible Production Messages recipient was not present at final closure. Production had one active Person-linked `staff` recipient in the enabled Messages audience. The Preview two-user exchange therefore remains the behavior proof for send/reply and notification round-trip. No disposable Production user was created solely to repeat an already-proven interaction.

This is recorded as a non-blocking Production acceptance note, not a Phase 8B.3 defect.

## Preview closure

The disposable Supabase Preview was:

```text
name=phase8b-messages-product-control-center
project_ref=gphnecflxuljewnotmlz
branch_id=df65dda7-cb12-4581-967b-f10bbffc9b32
```

Immediately before deletion, Preview and Production matched exactly:

```text
Production: migration_count=102, migration_head=20260907003000
Preview:    migration_count=102, migration_head=20260907003000
```

The Preview branch was then deleted successfully.

## Closure decision

Phase 8B.3 is closed.

Accepted state:

```text
Production SQL: PASS
Production migration parity: PASS
Permanent verifiers: PASS
Replay proofs: PASS
Edge Function deployment: NOT REQUIRED
Merged-main frontend build: PASS
Lightsail frontend deployment: PASS
Build parity: PASS
Nginx validation: PASS
Production HTTPS smoke: PASS
Rollback backup: PRESERVED
Disposable Preview: DELETED
```

No additional Phase 8B.3 implementation work is required unless a new Production defect is observed.

The next numbered Messages work is Phase 8B.4, System Actors + Real Verticals, under the accepted six-phase Messages contract.