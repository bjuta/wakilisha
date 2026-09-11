# Messages Operations UX Gate E Production Closure

Status: **CLOSED IN PRODUCTION**

Issue: **#891 Messages Operations UX & Control Surface Convergence**

Gate: **E - final responsive, keyboard, accessibility, and adversarial UX acceptance**

Production authority:

```text
main=72b194ad895b5c910edbe0c897588d84640572ef
interaction_foundation_pr=901
interaction_foundation_merge=97459de1a1cd0aa7b6801492813826583732bf3d
viewport_integrity_pr=905
viewport_integrity_merge=f34739f0acc376c299778b6cd483b5cb3e988a1b
legal_mobile_workbench_pr=906
legal_mobile_workbench_merge=35669888c38c091b55525e4496fb1b8149802d61
legal_disclosure_mobile_pr=907
legal_disclosure_mobile_merge=72b194ad895b5c910edbe0c897588d84640572ef
production_project_ref=pgzizndxdyhqmtyywjmt
production_migration_count=113
production_migration_head=20260910103000
frontend_index_sha256=bccea060791cecf5a47c778dfa9f13614c58e22b73b8f7832f716b2e44097a35
frontend_entry=assets/index-C2bayUnr.js
frontend_entry_sha256=2e6e632bc15be92f1b7491006f4b0220dba5fd35e1ba6410fbdbb8d758488635
frontend_file_count=3709
rollback_backup=/opt/wakilisha-react-backups/legal-disclosure-package-overflow-20260911T120806Z-72b194ad
```

## Closure statement

Gate E is accepted and closed in Production.

Messages Operations now meets the final responsive, keyboard, focus, accessibility, and narrow-viewport acceptance required by #891. The accepted Production surface uses the shared WAKILISHA interaction architecture introduced during Gate E rather than bespoke Messages-only keyboard or overlay machinery.

The Gate E acceptance cycle also exposed two genuine mobile layout defects in the Legal workbench. Those defects were fixed and permanently covered by browser contracts before closure. Gate E was not closed while the real-device failures remained reproducible.

## Interaction architecture consumed by Messages Operations

Gate E depended on the site-wide interaction foundation tracked by #902 and established in PR #901.

Accepted shared behavior includes:

- WAKILISHA-owned visual and API surfaces over headless accessible interaction behavior;
- React Aria Components beneath canonical WAKILISHA wrappers where composite interaction behavior is required;
- shared `SearchableSelect`, Sheet, Tabs, workflow, inspector, timeline, status, toggle, date/time, and entity-picking primitives;
- DOM behavioral contracts using Vitest, jsdom, Testing Library, user-event, and jest-dom;
- Playwright real-browser interaction acceptance;
- axe browser accessibility checks for the critical interaction fixture;
- repository-wide browser-native chrome debt accounting and CI enforcement;
- no source-text assertion used as a substitute for actual keyboard, focus, overlay, or responsive behavior.

Messages Operations consumes this architecture directly. Gate E did not introduce a second Messages-specific focus manager, keyboard state machine, modal stack, or selection engine.

## Site-wide viewport integrity foundation

Real-device acceptance exposed a broader mobile viewport failure mode in which small editable controls and intrinsic-width content could leave Safari visually enlarged or horizontally displaced.

PR #905 established a reusable viewport integrity layer rather than applying a page-local workaround.

Accepted viewport integrity behavior includes:

- normal scalable viewport authority with `width=device-width`, `initial-scale=1.0`, and `viewport-fit=cover`;
- intentional user pinch zoom remains enabled;
- no `user-scalable=no`, `maximum-scale=1`, or equivalent zoom suppression;
- `text-size-adjust` is controlled at the document boundary;
- editable controls receive a 16 CSS px floor on narrow or coarse-pointer clients to prevent browser-initiated focus zoom;
- `VisualViewport` and document-overflow observations are exposed through structured `wk_viewport_integrity_violation` events;
- the observer reports problems but never fights or resets intentional user zoom;
- document-level overflow is not hidden with a global `overflow-x: hidden` workaround;
- Chromium and an iPhone-profile WebKit project permanently exercise the viewport integrity contract in the existing protected browser lane.

The broader site-wide browser-native chrome migration remains tracked by #902. Gate E closure does not claim that #902 is complete.

## Legal mobile convergence discovered during Production acceptance

The first real iPhone pass proved that browser focus zoom was not the only mobile failure. The Legal selected-case workbench could still exceed the viewport through intrinsic sizing.

PR #906 fixed the outer Legal workbench by combining two reusable principles:

- long canonical identifiers use the shared `wk-identity-wrap` invariant with `overflow-wrap: anywhere`;
- mobile grid tracks and selected workbench surfaces use `minmax(0,1fr)` and `min-w-0` so descendants cannot dictate document width.

A second real iPhone pass proved the outer page was then stable, but isolated one remaining overflow inside **Disclosure -> Exact disclosure packages**.

PR #907 fixed that nested boundary by:

- giving the Disclosure package grid an explicit `minmax(0,1fr)` mobile track and bounded desktop tracks;
- adding `min-w-0` containment to the package list, package button, and package detail surface;
- preserving the full exact package production reference with `wk-identity-wrap` instead of truncation;
- keeping the status badge shrink-safe and within the package card;
- adding the exact nested package/reference/status geometry to the existing Chromium and mobile WebKit regression fixture.

No global clipping rule, browser zoom suppression, or content truncation was used to hide these failures.

## Permanent browser acceptance

The final nested Disclosure correction was accepted locally before PR creation with:

```text
viewport static control plane=PASS
targeted viewport browser=10/10 PASS
full browser acceptance=14/14 PASS
focused Messages Operations=45/45 PASS
browser chrome ledger=394 baseline PASS
build:app=PASS
protected critical=304/304 PASS
changed paths=5
Production mutation=NONE
```

Exact-head Critical Control Plane run:

```text
run_number=1127
run_id=34595438437
head=74bb19b95c6aea80e6e09c1237bdadaf09e072ef
conclusion=SUCCESS
```

The exact PR-head run reproduced the viewport integrity and Chromium + WebKit browser acceptance before merge.

PR #907 then merged to protected `main` as:

```text
72b194ad895b5c910edbe0c897588d84640572ef
```

Post-merge Critical Control Plane run:

```text
run_number=1128
run_id=34596054078
head=72b194ad895b5c910edbe0c897588d84640572ef
conclusion=SUCCESS
```

The post-merge run again passed:

```text
canonical Production runner validation=PASS
browser-chrome debt ledger=PASS
viewport integrity=PASS
DOM interaction contracts=PASS
Chromium + WebKit install=PASS
real-browser interaction acceptance=PASS
migration replay=PASS
primitive compounding=PASS
media/control-plane contracts=PASS
security and lifecycle=PASS
public authority checks=PASS
schema and migration drift=PASS
application build=PASS
```

## Production frontend promotion

Gate E remained frontend and control-plane work only. No Production SQL, migration, Supabase Edge Function, or hosted worker deployment was required.

The final exact merged `main` frontend was promoted through the canonical Production frontend runner version 2.

The runner reran protected critical and executed the full `npm run build` Production build rather than the narrower pre-PR `build:app` gate.

Accepted Production deployment evidence:

```text
DEPLOYED_MAIN=72b194ad895b5c910edbe0c897588d84640572ef
PROTECTED_CRITICAL=PASS
MERGED_MAIN_BUILD=PASS
PREVIEW_REF_IN_DIST=NO
PRODUCTION_REF_IN_DIST=YES
LOCAL_INDEX_SHA256=bccea060791cecf5a47c778dfa9f13614c58e22b73b8f7832f716b2e44097a35
REMOTE_INDEX_SHA256=bccea060791cecf5a47c778dfa9f13614c58e22b73b8f7832f716b2e44097a35
LOCAL_ENTRY=assets/index-C2bayUnr.js
LOCAL_ENTRY_SHA256=2e6e632bc15be92f1b7491006f4b0220dba5fd35e1ba6410fbdbb8d758488635
REMOTE_ENTRY_SHA256=2e6e632bc15be92f1b7491006f4b0220dba5fd35e1ba6410fbdbb8d758488635
LOCAL_FILE_COUNT=3709
REMOTE_FILE_COUNT=3709
STAGED_ARTIFACT_PARITY=PASS
LIGHTSAIL_BUILD_PARITY=PASS
NGINX_VALIDATION=PASS
DIRECT_ORIGIN_SMOKE=PASS
PUBLIC_HTTPS_SMOKE=PASS
REMOTE_STAGE_CLEANUP=PASS
```

Direct-origin and public HTTPS smoke returned `200` for:

```text
/
/messages
/admin/messages
```

The local, staged, live, direct-origin, and public entry authority converged on the accepted Production artifact.

Rollback authority is preserved at:

```text
/opt/wakilisha-react-backups/legal-disclosure-package-overflow-20260911T120806Z-72b194ad
```

## Real iPhone Safari Production acceptance

The final closure decision includes actual iPhone Safari evidence. Playwright WebKit was treated as a permanent regression engine, not as a substitute for the real client class.

The real-device acceptance initially exposed two defects and therefore prevented premature Gate E closure:

1. the selected Legal case could exceed the viewport through the outer workbench and long case identity;
2. after the outer workbench was corrected, the nested Disclosure package grid could still overflow through a long package reference and status badge.

Both defects were fixed, redeployed, and retested before closure.

Final accepted iPhone Safari result for the previously failing Disclosure surface:

```text
DISCLOSURE PACKAGE CARD FITS VIEWPORT=PASS
PACKAGE REFERENCE WRAPS=PASS
RELEASED BADGE REMAINS VISIBLE=PASS
PACKAGE DETAIL FITS VIEWPORT=PASS
NO HORIZONTAL PAGE DRIFT=PASS
NO CORRECTIVE PINCH REQUIRED=PASS
```

The accepted result proves the corrected page remains fitted without requiring the operator to pinch the page back to the layout viewport.

## Authority preservation

Gate E introduced no competing backend authority.

Accepted state:

```text
Production SQL=NOT REQUIRED
Production migration=NOT REQUIRED
Supabase Edge Function deployment=NOT REQUIRED
Hosted worker deployment=NOT REQUIRED
Messages authority changes=NONE
Safety authority changes=NONE
Legal command/state authority changes=NONE
Media worker authority changes=NONE
Audit authority changes=NONE
Production migration authority=113 / 20260910103000
```

The work changed interaction architecture, frontend presentation, browser acceptance, viewport integrity, and responsive containment only.

## Relationship to site-wide interaction migration

Issue #902 remains open.

Its broader program still owns migration of the repository-wide visible browser-native chrome debt across public, admin, Registry, charts, media, settings, and editorial surfaces, followed by zero-debt enforcement and closure.

The current browser-chrome ledger remains a controlled debt baseline rather than a zero-debt claim:

```text
current_native_chrome_debt=394
```

Gate E closes because the Messages Operations acceptance bar is satisfied on the shared architecture. It does not close the separate site-wide #902 program.

## Closure decision

Gate E is closed in Production.

Accepted state:

```text
Shared interaction foundation=ACCEPTED
Messages Operations canonical primitives=ACCEPTED
Keyboard and focus browser contracts=PASS
Accessibility browser contract=PASS
Viewport integrity control plane=PASS
Chromium browser acceptance=PASS
Mobile WebKit browser acceptance=PASS
Actual iPhone Safari Production acceptance=PASS
Legal outer mobile workbench containment=PASS
Legal Disclosure package mobile containment=PASS
User pinch zoom preserved=PASS
Unexpected focus zoom prevention=PASS
Document overflow observability=PASS
Protected Critical=PASS
Merged-main full Production build=PASS
Lightsail deployment=PASS
Staged artifact parity=PASS
Live artifact parity=PASS
Nginx validation=PASS
Direct-origin smoke=PASS
Public HTTPS smoke=PASS
Server authority changes=NONE
Production migrations=113 / 20260910103000
```

Issue #891 is ready to close as completed.

Phase 8B.6 issue #872 is now unblocked and becomes the active next Phase 8B gate.

Issue #902 remains open for the separate site-wide browser-native chrome migration and zero-debt enforcement program.
