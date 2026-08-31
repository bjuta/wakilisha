# Phase 7A Video Publication Authority Closure Record

Status: CLOSED - PRODUCTION ACCEPTED

Date: 31 August 2026

Accepted production/frontend main:

`a8e10350dccd5a5b1cd5b49001a4cf8839a76bd9`

Production schema authority:

- migration count: `75`
- migration head: `20260831080826_video_caption_language_private_use_tags`
- TypeScript schema seal: unchanged from accepted public/editorial production snapshot
- Supabase Edge Function deployment: none for final closure
- Readdy Finish: not used

Final production frontend:

- entry: `assets/index-S6v7xwyD.js`
- entry SHA-256: `e878fec7815bfd014c50d3f3273259f5f74e5aeb63a3f918060bb1f0eb16ae74`
- index SHA-256: `919d48b740a8bdce39337cce39c161f2769273cf50cb2e8b17b4f842395df77a`
- files: `4477`
- exact remote checksum parity: PASS
- public HTTPS home: `200`
- public HTTPS Video Admin route: `200`
- rollback snapshot: `/opt/wakilisha-react-backups/phase7a-k5b-video-editor-20260831T084352Z-a8e10350`

## Closure instrument

The real Phase 7A exit-gate Video is:

`Monday Morning in September`

Publication / Resource id:

`114618c2-2246-4503-9202-4a6631159d96`

Shared Show Episode:

- Show: `The Sounds of Nairobi`
- Episode: `Monday Morning in September`, Episode 1

Classification:

`Documentary`

Visibility:

`public`

The Video is a real WAKILISHA-owned production recording, not synthetic acceptance content.

## Canonical source authority

Native source:

- source id: `32e32961-8156-4fbe-9ce2-f52712b25c38`
- Media asset id: `f35f5416-920a-45f1-995b-65492a48a144`
- Media revision id: `678e502b-c049-4b1b-81b1-08d4399868ff`
- source file: `IMG_0133.MOV`
- file verification: `verified`
- selected usage role: `video_master`
- resolution mode: exact revision

The source Media was governed for public use through canonical Media governance:

- rights: `owned`
- consent: `granted`
- source protection: `public`
- public safety: `approved_public`
- retention: `retain`
- embargo: none

No Video-owned rights or consent subsystem was introduced.

## Governed caption authority

The final Video carries one real governed closed-caption track.

Caption file:

`monday-morning-in-september.sheng.vtt`

Caption Media authority:

- asset id: `bf758bdf-188e-4860-94a4-ac364bb67c0d`
- exact Media revision: `49427742-501d-44a0-951e-da56e51992ae`
- Media kind: `caption`
- verification: `verified`
- language tag: `und-x-sheng`
- track kind: `captions`
- label: `Sheng`
- default: true

Caption governance version 2 is public-ready:

- rights: `owned`
- consent: `granted`
- source protection: `public`
- public safety: `approved_public`
- retention: `retain`
- embargo: none

The final published Video version carries an active exact-revision `video_caption` usage bound to that caption revision.

The language tag `und-x-sheng` required one narrow standards-aligned authority repair so private-use caption language tags are accepted without weakening malformed-tag rejection.

## Immutable lifecycle proof

The original publication cycle was preserved:

| Version | Kind | Fingerprint |
| --- | --- | --- |
| v1 | working | `431948128b81364063ee797d53088a0c9b767e6b8987a4c3c3798c413288358e` |
| v2 | submitted | same |
| v3 | approved | same |
| v4 | published | same |

The captioned post-publication revision then produced:

| Version | Kind | Fingerprint |
| --- | --- | --- |
| v5 | working | `228e93ca257f031106e7cc0f083b0fec3ff9964a27399e39c64044fd9e3bfe4e` |
| v6 | submitted | same |
| v7 | approved | same |
| v8 | published | same |

Final published version:

- version id: `959651c7-d058-44ae-9ad6-b797c5c0f7b8`
- version number: `8`
- kind: `published`
- content fingerprint: `228e93ca257f031106e7cc0f083b0fec3ff9964a27399e39c64044fd9e3bfe4e`
- source authority revision: `6`

Final Video publication authority revision:

`9`

The prior published v4 remains in immutable history and was not mutated when the captioned revision was created.

## Real gaps exposed and closed

The real exit-gate workflow exposed concrete product and authority gaps. Each was repaired at the narrowest correct layer.

### 1. Working Media governance was incorrectly conflated with publishability

A newly uploaded verified internal Video master could not be attached to a draft because exact-revision validation also required public-use governance.

K5E separated:

- exact active verified Media eligibility for working composition
- public-use rights, consent, retention, embargo, source protection, and public safety at publish time

The publish-time safety gate remained strict.

### 2. Native source integrity duplicated the same premature public gate

The K2 native source trigger still rejected internal verified Media during source registration.

The trigger was converged to exact source identity and verification only. Public governance remained at publish time.

### 3. Deferred shared Resource binding integrity executed under caller privileges

The first real Publish failed because the deferred shared Resource binding trigger tried to read private binding tables as the authenticated caller.

The shared trigger was repaired as internal `SECURITY DEFINER` authority without granting browser reads on private binding tables.

### 4. Published Video could not begin a governed post-publication revision

The backend already supported post-publication working snapshots, but the frontend treated published Video as read-only.

The Video Editor was activated for governed post-publication revisions while stale lifecycle pointers were kept from surfacing invalid actions.

### 5. Post-publication review action visibility followed the live public lifecycle label instead of version lineage

After v5 submitted v6, the old public v4 correctly kept the Resource lifecycle label `published`, but the frontend still showed `Send to Review` and hid Review actions.

Action visibility now follows immutable version lineage:

- submit only when working is newer than submitted/approved/published
- review when a newer submitted replacement exists
- publish when a newer approved replacement exists

### 6. Caption language validation rejected the Sheng private-use tag

The initial validator rejected `und-x-sheng`.

The caption language-tag grammar now accepts a normalized private-use suffix while retaining existing tags and malformed-tag rejection.

### 7. Caption Media remained internal at publish time

The first captioned replacement Publish was correctly blocked because the new VTT asset still had default internal governance.

The canonical Media governance UI was used to record the real public clearance. No publish bypass was added.

## Exit-gate disposition

Phase 7A required one real Video to prove the canonical internal workflow.

The real Video now proves:

- correct Video Resource identity
- shared Show Episode binding
- exact governed native Video Source
- exact version-bound Media master usage
- canonical Media governance
- a real governed caption track
- immutable working, submitted, approved, and published versions
- governed review decisions
- replacement publication after an already published version
- content fingerprint continuity through review
- changed fingerprint when publication content changed
- exact caption Media revision continuity into the published version
- preserved prior published history
- shared Credits/Citations capability without fabricating inapplicable evidence
- shared Corrections/provenance continuity without inventing a correction
- reconstructability from immutable version authority rather than mutable draft state

Poster, transcript, chapters, Credits, and Citations were not manufactured where the real work did not require them.

Phase 7A is therefore CLOSED.

## Public product boundary

Phase 7A closes internal Video publication authority.

It does not claim Phase 7B.

Public responsive Video routes, public discovery, public SEO, public caption delivery UX, and the complete public Video product remain Phase 7B work.

## Accepted final pull requests

Final exit-gate follow-through includes:

- PR #753, shared deferred binding integrity repair
- PR #754, production history seal
- PR #756, governed post-publication revision UI
- PR #757, private-use caption language tags
- PR #758, caption language production-history seal
- PR #759, post-publication review action lineage

## Deployment checklist

- SQL migration needed: No, all accepted Phase 7A SQL is already live
- Supabase Edge Function deploy needed: No
- Readdy Finish update needed: No
- frontend deploy needed: No, exact accepted frontend is live
- PR needed now: documentation closure only
- next numbered phase: Phase 7B Public Video product

## Preview disposition

The final disposable production-parity preview is no longer an acceptance dependency once this closure record and the current-status documentation merge through protected CI.

Delete the preview after the documentation closure PR is green and merged.

## Acceptance statement

WAKILISHA now has canonical internal Video publication authority proven by a real WAKILISHA-owned Video through exact Media binding, governed accessibility, immutable review, approval, replacement publication, and preserved history.

Phase 7A is closed.
