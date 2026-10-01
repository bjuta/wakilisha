# Creator Cohort Track ISRC Projection

Date: 1 October 2026

Status: **IMPLEMENTATION DESIGN - NO PRODUCTION MUTATION YET**

Programme authority:

- issue #1118, real creator cohort rollout acceptance;
- merged Work provider evidence audit PR #1131;
- existing `registry_provider_link_admin` exact-grant authority;
- Music Identity & Rights identifier assertion authority.

## Purpose

The songwriting cohort exposed a Work-resolution dependency. A large part of the current Registry already retains typed provider evidence that can improve Recording identity before any new external acquisition.

Production contains 247 active Tracks whose canonical `registry_tracks.isrc` is null while an accepted typed Apple provider link already retains an ISRC.

A read-only collision audit classifies those rows as:

- 209 deterministic projection candidates;
- 34 rows whose retained ISRC is already used by another active Registry Track;
- 2 rows sharing a candidate ISRC across multiple current candidate Tracks;
- 2 provider-match review rows.

Only the 209 deterministic rows are in scope for automatic governed projection.

## Existing evidence

For the 332 active typed Apple Track links:

- all 332 retain `registry_track_provider_links.isrc`;
- all 332 retain `raw_payload.song.attributes.isrc`;
- 318 retain `raw_payload.song.attributes.composerName`;
- no link-vs-payload ISRC conflict was found;
- no Registry-vs-provider ISRC conflict was found among Tracks that already carry a canonical ISRC.

Of the 209 deterministic projection candidates, 199 also retain composer evidence.

No new Apple API request is needed for this tranche.

## Identity model

ISRC identifies the sound recording. It does not replace the WAKILISHA Track UUID.

The durable identity model remains:

```text
registry_tracks.id
  |
  +-- registry_external_identifier_assertions
  |     scheme_key = 'isrc'
  |
  +-- registry_tracks.isrc
        hot-path projection
```

A correct admission must keep the identifier assertion and the hot-path projection causally bound to the same retained evidence.

## Existing authority that must be reused

Reuse:

- actor: `registry_provider_link_admin`;
- authority mode: human exact grant;
- required capability: `manage_registry`;
- Registry mutation operation framework;
- Registry evidence assertions;
- canonical write events;
- independent verifier.

Do not create a second provider/Track administrator actor.

The current `registry.track.provider_link.admit/v1` operation must not be widened. It governs provider-link state, not canonical Track ISRC projection.

## New operation

Proposed operation:

`registry.track.isrc_projection.admit/v1`

Proposed capability:

`admit_registry_track_isrc_projection`

Semantics:

- one existing non-archived Track;
- one existing typed Apple provider link bound to that Track;
- current `registry_tracks.isrc` must be null;
- provider link status must be `matched`;
- match method must be `exact_title_artist`;
- match confidence must be at least 0.93;
- provider-link ISRC must be nonblank and scheme-valid;
- retained raw-payload ISRC must equal the provider-link ISRC;
- that ISRC must occur on exactly one eligible retained candidate Track;
- no other active Registry Track may already carry the ISRC;
- no overwrite;
- no reconciliation;
- no Track merge;
- no provider-link rewrite.

## Atomic write

One successful operation should produce exactly:

1. one ISRC assertion in `registry_external_identifier_assertions`;
2. one `registry_tracks.isrc` projection;
3. canonical write-event causality for both effects;
4. one verified mutation operation.

The identifier assertion should initially preserve evidence semantics rather than claim independent rights-authority verification.

The hot-path projection is accepted because the exact same typed provider evidence has passed the deterministic candidate contract.

## Stale-state protection

The grant freezes:

- Track state fingerprint;
- provider-link state fingerprint;
- candidate-state fingerprint;
- evidence assertion fingerprint;
- target Track UUID;
- provider-link UUID;
- normalized ISRC.

Execution must fail closed if any of those values change.

Immediately before writing, the executor must repeat:

- Track ISRC-null check;
- exact provider-link match checks;
- link/payload ISRC equality;
- candidate uniqueness check;
- active Registry ISRC collision check.

## Idempotency

If the same exact operation already succeeded and verifies:

- return the accepted state;
- do not create another assertion;
- do not create another write event;
- do not issue durable standing authority.

If the Track already carries the exact ISRC and the bound identifier assertion exists, the public wrapper may report `already_current`.

If the Track carries a different ISRC, fail closed.

## Review-only rows

The following remain outside automatic admission:

- ISRC already present on another active Track;
- same retained ISRC attached to multiple candidate Tracks;
- fuzzy provider match;
- link/payload ISRC disagreement;
- archived/missing Track;
- stale or changed provider link.

These should route to existing Track identity / duplicate review rather than being forced through the projection operation.

## Expected impact

If all 209 deterministic candidates remain current at execution time:

- current canonical ISRC coverage: 2,097 / 2,407;
- after projection: 2,306 / 2,407;
- projected coverage: 95.8%.

199 newly projected Tracks would also have retained composer evidence available for later Work/contributor resolution.

Counts are audit snapshots, not hard-coded mutation targets. The execution manifest must be frozen immediately before Production apply.

## Deployment sequence

1. generate migration with `supabase migration new`;
2. add operation, private broker functions, public wrapper and verifier;
3. add permanent SQL verifier and focused contract tests;
4. replay clean disposable Preview;
5. test deterministic success;
6. test duplicate ISRC rejection;
7. test existing canonical ISRC rejection;
8. test fuzzy provider-link rejection;
9. test stale provider-link and stale Track state;
10. test idempotent replay;
11. prove zero durable execution grants at rest;
12. protected CI;
13. merge;
14. Production schema deploy;
15. freeze the 209-candidate manifest again against current Production;
16. execute only still-deterministic rows;
17. surgically resume failures only;
18. final zero-unaccounted candidate audit.

## Scope locks

This tranche does not:

- create Works;
- create Track-to-Work links;
- split composer strings;
- create People;
- acquire fresh Apple data;
- call MusicBrainz, MLC, ACRCloud, Spotify, or another provider;
- resolve the 38 review-only ISRC rows;
- overwrite an existing Track ISRC;
- infer Work identity from Track title.

It improves the Recording identity substrate so Work resolution can continue from a much stronger baseline.
