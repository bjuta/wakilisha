# Media Owned Rights -> Granted Consent Conditional

Status: PREVIEW ACCEPTED — AWAITING PROTECTED CI

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
