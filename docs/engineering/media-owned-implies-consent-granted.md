# Media Owned Rights -> Granted Consent Conditional

Status: PRODUCTION DATABASE ACCEPTED — FRONTEND ACTIVATION PENDING

Date: 30 August 2026

Accepted base:

`e385e36e9ce8af966fc258aac91cbb3d46af4a00`

Production baseline:

- migrations: `72`
- head: `20260830173552_phase_7a_k5e_native_source_integrity_convergence`
- real Video `Monday Morning in September`: approved immutable version exists
- publish remains blocked until Media governance is public-ready

## Product rule

WAKILISHA defines the governance conditional:

`rights_status = owned -> consent_status = granted`

Consent is therefore derived when the Media is owned. The reviewer should not be asked to make the same decision twice.

This is a business-logic conditional, not a new Video subsystem and not an interaction primitive.

## Canonical enforcement

The rule is enforced forward at `media.asset_governance_versions` through a bounded trigger.

The Media editor mirrors the canonical rule:

- selecting `Owned` immediately sets `Consent` to `Granted`
- the Consent control is disabled while Rights remains Owned
- the UI explains the derivation

The browser command boundary also normalizes the same conditional before calling the canonical governance writer.

## Historical integrity

Existing immutable governance history is not rewritten.

At discovery time there were legacy current governance rows with:

- `rights_status = owned`
- `consent_status = not_required`

Those rows predate this rule. They remain historical evidence and will converge only when a reviewer explicitly appends a new governance version.

No unrelated Media governance row is mutated by this change.

## Current real Video implication

For the existing `IMG_0133.MOV` Media asset:

- reviewer chooses Rights = Owned
- Consent becomes Granted automatically
- public source protection and public safety remain separate explicit governance decisions
- publication still cannot proceed until the complete publish-time Media governance gate passes

## Deployment classification

- SQL migration needed: Yes, preview first
- Supabase Edge Function deploy needed: No
- Readdy Finish update needed: No
- frontend deploy needed: Yes
- production content mutation before acceptance: No


## Preview acceptance

Accepted preview:

- project ref: `kqmxcluhahxvqjnjggoy`
- branch id: `bc5e0a19-cf27-4940-8aa5-aeeda160e4cd`
- migration count: `73`
- head: `20260830185038_media_owned_implies_consent_granted`

Permanent verifier:

`MEDIA_OWNED_CONSENT_RULE_PASS`

Rollback-only behavior proof:

`MEDIA_OWNED_CONSENT_RULE_BEHAVIOR_PASS`

The accepted behavior proof demonstrates:

- inserting `rights_status = owned` with a conflicting consent value is normalized to `consent_status = granted`
- a non-owned rights state preserves its explicit consent status
- no historical governance row is rewritten
- the fixture rolls back completely

Advisor disposition:

- no rule-specific Security Advisor finding
- no rule-specific Performance Advisor finding

Schema/type disposition:

- no browser RPC signature or generated TypeScript database surface changed
- the existing production `public,editorial` type SHA remains unchanged
- preview schema history advances only to migration 73 / `20260830185038`

## Protected CI

Pending.


## Protected CI acceptance

PR #751 passed protected Critical Control Plane #702 and merged at:

`ffa2ebb35816e39955f4437ca7f93e7faded903e`

The first PR run correctly stopped because the replay proof omitted the mandatory migration SHA and `baseline_replay = pass`. The proof metadata was repaired without changing runtime code, and #702 then passed the full protected control plane.

## Production promotion

The accepted migration bytes were promoted separately to production.

Production state:

- migration count: `73`
- authoritative production head: `20260830185526_media_owned_implies_consent_granted`
- permanent verifier: `MEDIA_OWNED_CONSENT_RULE_PASS`
- rule-specific Security Advisor findings: none
- rule-specific Performance Advisor findings: none

The production apply recorded the already-accepted migration bytes at Supabase's production timestamp `20260830185526`, rather than the preview timestamp `20260830185038`.

The repository migration filename and replay proof are rebound to the authoritative production timestamp. Migration bytes are unchanged and SQL is not replayed.

The paid preview retains its accepted preview history at `20260830185038`; its verifier continues to pass. This timestamp difference is preview metadata only. Production and repository history are the control-plane authority from this point forward.

No TypeScript database surface changed. The accepted `public,editorial` type SHA remains:

`97cd758416514afcf6b0e4f9bb140c2012074af4d38905ff5f4eae3cb80d17ce`

## Real Media state after production promotion

The real `IMG_0133.MOV` Media asset was not mutated by deployment.

It remains on governance version 1 with:

- Rights: Unknown
- Consent: Unknown
- Source protection: Internal
- Public safety: Internal

The next content action must use the governed Media editor after exact-main frontend activation. Selecting Rights = Owned will derive Consent = Granted automatically.
