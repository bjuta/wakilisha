# Video Publish Deferred Binding Integrity Repair

Status: PRODUCTION DATABASE ACCEPTED — REAL PUBLISH RETRY PENDING

Date: 30 August 2026

Accepted base:

`9f88bd0f58f5480009777cb9069474fe5d07ccc9`

Production baseline:

- migrations: `73`
- head: `20260830185526_media_owned_implies_consent_granted`
- real Video approved version: `7ebd6ce4-1855-4886-9549-f3a880335308`
- real Media governance: public-ready

## Real rendered failure

The first real governed Video Publish attempt rendered:

`permission denied for table video_publication_resources`

No published version was created.

## Diagnosis

`public.publish_video_publication_version(...)` is correctly `SECURITY DEFINER` and owned by `postgres`.

The failure is downstream in the existing deferred constraint trigger:

- trigger: `editorial.resources_binding_integrity`
- function: `editorial.assert_resource_binding_integrity()`
- trigger mode: `DEFERRABLE INITIALLY DEFERRED`
- function mode before repair: `SECURITY INVOKER`

The function reads private typed binding tables including:

`editorial.video_publication_resources`

Authenticated browser roles intentionally have no direct SELECT privilege on those tables.

Because the integrity trigger is deferred, it can execute after the governed command boundary has returned to the authenticated caller. At that point the invoker-mode trigger attempts a private table read and fails.

This is not a request to expose `video_publication_resources` to browser roles.

## Repair

The canonical cross-resource binding integrity trigger becomes `SECURITY DEFINER` under its existing `postgres` owner with a fixed search path.

Direct EXECUTE remains revoked from:

- public
- anon
- authenticated
- service_role

The function is trigger-only internal authority.

## Scope and security

This repair does not:

- grant browser SELECT on any private editorial binding table
- bypass the binding invariant
- weaken RLS
- create a Video-specific duplicate invariant
- change frontend code
- change public Media governance
- mutate the real Video during deployment

The same shared binding integrity function covers Article, Playlist, Audio, Person, Organization, Show, Correction, Media, and Video Resources. Fixing the shared trigger is therefore the narrowest correct repair.

## Deployment classification

- SQL migration needed: Yes, preview first
- Edge Function: No
- frontend deploy: No
- Readdy Finish: No
- production content mutation before acceptance: No


## Preview acceptance

Accepted preview:

- project ref: `osxkuuqlfhbmiykdwena`
- branch id: `d44a1d1c-6200-42b9-89a8-96ba7367484f`
- migration count: `74`
- head: `20260830193925_video_publish_deferred_binding_integrity`

Migration SHA-256:

`b6dd5da6fa841612c8724b699ee421f85230ce8ef9274fbdc23b844450ae1d67`

Permanent verifier:

`VIDEO_PUBLISH_DEFERRED_BINDING_INTEGRITY_PASS`

Verifier SHA-256:

`f316d9cb6033d3836ca41373903aa64af18e40fcf5eaf36cc0ece861e7d632e0`

Rollback-only behavior proof:

`VIDEO_PUBLISH_DEFERRED_BINDING_INTEGRITY_BEHAVIOR_PASS`

The behavior proof inserted one rollback-only standalone Video Resource + typed publication binding, switched to the authenticated role, and forced all deferred constraints immediate. The shared binding trigger successfully read the private Video binding table under internal authority.

Advisor disposition:

- no repair-specific Security Advisor finding
- no repair-specific Performance Advisor finding

No TypeScript database surface changed.

## Protected CI

PR #753 passed protected Critical Control Plane #709 and merged at:

`16c5e59c3cac850c97ff5fb3c1afaa32d68ef57d`

## Production promotion

The accepted migration bytes were promoted separately to production.

Production now has:

- migration count: `74`
- head: `20260830194344_video_publish_deferred_binding_integrity`
- permanent verifier: `VIDEO_PUBLISH_DEFERRED_BINDING_INTEGRITY_PASS`

Supabase recorded the accepted bytes at production timestamp `20260830194344`, while the preview had recorded `20260830193925`. The repository filename and replay proof are rebound to the production timestamp without changing migration bytes or replaying SQL.

The accepted preview timestamp bytes are preserved under:

`docs/engineering/replay-baseline/retired-active-migrations/20260830193925_video_publish_deferred_binding_integrity.sql`

No frontend redeploy is required.

## Real Video state before retry

The failed Publish attempt did not create a published version.

The real Video remains:

- approved version: `7ebd6ce4-1855-4886-9549-f3a880335308`
- published pointer: null
- Media governance: public-ready

The next gate is the same real Publish action.
