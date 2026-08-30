# Video Publish Deferred Binding Integrity Repair

Status: CANDIDATE — REAL PUBLISH FAILURE PROVED IN PRODUCTION

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
