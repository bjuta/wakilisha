# WAKILISHA browser-native choice controls Production closure

Status: **CLOSED IN PRODUCTION**

Parent: **#902 Eliminate browser-native UI chrome across WAKILISHA**

Slice: **#912 Slice 2A: Eliminate native choice controls site-wide**

Implementation PR: **#914 Migrate WAKILISHA choice controls off browser-native chrome**

Merged Production authority:

```text
main=a310093e47d37d1371d7cb8970478c3cc4f49cc2
```

## Closure statement

Slice 2A is accepted and closed in Production.

The accepted frontend removes the owned native select, checkbox, and radio chrome debt through canonical WAKILISHA primitives while preserving interaction semantics and protected control-plane acceptance.

The controlled browser-native chrome baseline after the merge is 132, with native select, checkbox, and radio debt at zero. The next active family is #915, which owns the remaining native field controls.

## Protected acceptance before Production

Exact PR-head Critical Control Plane completed successfully before merge. The final assertion-only repair was commit `7a979d19346a4b55650dfc58a52c82edd6d6a1ab`.

PR #914 then squash-merged to protected `main` as:

```text
a310093e47d37d1371d7cb8970478c3cc4f49cc2
```

The protected acceptance covered the site-wide browser-chrome ledger, DOM interaction contracts, Chromium and WebKit real-browser acceptance, primitive compounding, viewport integrity, migration replay, security and lifecycle contracts, schema and migration drift, and the application build.

## Production deployment

The exact merged `main` frontend was deployed through the canonical Production frontend runner version 2:

```text
scripts/deploy/production-frontend.sh
```

Accepted deployment evidence:

```text
DEPLOYED_MAIN=a310093e47d37d1371d7cb8970478c3cc4f49cc2
PROTECTED_CRITICAL=PASS
CRITICAL_TESTS=304/304 PASS
MERGED_MAIN_BUILD=PASS
PREVIEW_REF_IN_DIST=NO
PRODUCTION_REF_IN_DIST=YES
LOCAL_INDEX_SHA256=46b2b44e48ac0676ab6358130de1ce1f24c4cee765bf8e386f82a284e1038f76
LOCAL_ENTRY=assets/index-hoEZqdE_.js
LOCAL_ENTRY_SHA256=5e8172cc83a51439d6c91e0f805d3cd4cffa597b5050d1a3c4619474b09dbf2c
LOCAL_FILE_COUNT=3715
STAGED_ARTIFACT_PARITY=PASS
FRONTEND_ACTIVATION=COMPLETE
REMOTE_INDEX_SHA256=46b2b44e48ac0676ab6358130de1ce1f24c4cee765bf8e386f82a284e1038f76
REMOTE_ENTRY_SHA256=5e8172cc83a51439d6c91e0f805d3cd4cffa597b5050d1a3c4619474b09dbf2c
REMOTE_FILE_COUNT=3715
LIGHTSAIL_BUILD_PARITY=PASS
NGINX_VALIDATION=PASS
```

Rollback authority was preserved at:

```text
/opt/wakilisha-react-backups/ui-chrome-choice-controls-20260912T071042Z-a310093e
```

## Interrupted smoke and recovery

The first direct-origin smoke was interrupted because the Lightsail instance itself became unavailable after frontend activation. The failure presented as:

```text
origin TCP 443=REFUSED
origin SSH 22=TIMEOUT during follow-up
Cloudflare public routes=521
```

This was not treated as a frontend artifact failure because staged and live filesystem parity had already passed exactly, and Nginx configuration validation had passed before the instance became unavailable.

No rollback was performed.

After the Lightsail instance recovered, the final acceptance proved the serving path and exact public artifact:

```text
LIGHTSAIL_SSH=PASS
NGINX_SERVICE=active
NGINX_LISTEN_80=PASS
NGINX_LISTEN_443=PASS
ORIGIN_SELF_ROUTE_/=200
ORIGIN_SELF_ROUTE_/messages=200
ORIGIN_SELF_ROUTE_/admin/messages=200
DIRECT_ORIGIN_ROUTE_/=200
DIRECT_ORIGIN_ROUTE_/messages=200
DIRECT_ORIGIN_ROUTE_/admin/messages=200
PUBLIC_ROUTE_/=200
PUBLIC_ROUTE_/messages=200
PUBLIC_ROUTE_/admin/messages=200
PUBLIC_ENTRY_SHA256=5e8172cc83a51439d6c91e0f805d3cd4cffa597b5050d1a3c4619474b09dbf2c
PUBLIC_ENTRY_PARITY=PASS
```

The recovered public entry hash exactly matched the merged-main Production build entry hash.

## Authority preservation

Slice 2A changed frontend interaction architecture only.

```text
Production SQL=NOT REQUIRED
Production migration=NOT REQUIRED
Supabase Edge Function deployment=NOT REQUIRED
Hosted worker deployment=NOT REQUIRED
Backend authority change=NONE
Additional frontend activation button=NONE
```

The canonical frontend Production sequence is merged protected main, Production runner, exact artifact parity, Nginx validation, origin smoke, and public HTTPS smoke. There is no separate `Finish update` step in the current deployment workflow.

## Closure decision

Accepted state:

```text
Native select debt=0
Native checkbox debt=0
Native radio debt=0
Controlled browser-chrome baseline=132
Protected Critical=PASS
Merged-main Production build=PASS
Lightsail deployment=PASS
Staged artifact parity=PASS
Live artifact parity=PASS
Nginx serving=PASS
Direct-origin smoke=PASS
Public HTTPS smoke=PASS
Public entry parity=PASS
Rollback authority=PRESERVED
```

#912 and #914 are complete. #915 is unblocked and becomes the active #902 implementation slice.
