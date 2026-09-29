# Public Music Identity — Multi-MainArtist Track Route-Binding Authority

Date: 29 September 2026

Parent programme: #1068

Current Track actual-zero slice: #1094

Status: **FORWARD ARCHITECTURE DECISION — DOCUMENTED, NOT YET IMPLEMENTED**

## Purpose

This document fixes the public Track identity contract for recordings with more
than one legitimate primary / main artist.

It supersedes any earlier interpretation that a public Track must have exactly
one primary Artist or that one Track UUID may belong to only one Artist route
namespace.

The Registry still has one immutable Track identity per Sound Recording. Public
presentation may bind that one Track to more than one Artist namespace when
authoritative artist-role evidence establishes multiple MainArtists.

This is a routing and presentation decision. It does not reopen the completed
Registry mutation-authority convergence programme.

## DDEX / ERN semantic basis

WAKILISHA adopts the ERN distinction between:

- one consumer-facing artist display;
- multiple ordered artist contributors;
- `MainArtist` as principal billing;
- `FeaturedArtist` as featured billing.

Multiple `MainArtist` entries are valid and must not be coerced into one
"primary" Artist merely to satisfy WAKILISHA routing.

The public URL model is WAKILISHA-specific. DDEX does not define WAKILISHA
routes.

## Core identity invariant

A Track has exactly one immutable Registry Track UUID and one semantic Track
slug.

Example:

```
Track UUID: T123
title: Summer
trackSlug: summer
```

If authoritative evidence establishes:

```
1. Kethan  — MainArtist
2. Bensoul — MainArtist
```

the Registry still contains one Track identity:

```
T123 | Summer | summer
```

WAKILISHA may expose more than one Artist-scoped public route binding for that
same Track.

It must not create:

- a second Track UUID for the second MainArtist;
- a second artist-specific Track slug;
- a synthetic collaboration Artist solely for routing;
- an automatic numeric, date, UUID, hash or random suffix.

## Public route-binding invariant

The routable identity tuple is:

```
(MainArtist UUID, semanticTrackSlug) -> exactly one Registry Track UUID
```

Equivalently at public presentation time:

```
/tracks/{mainArtistSlug}/{semanticTrackSlug}
```

must resolve unambiguously to one Track UUID.

A single Track UUID may own more than one such tuple when it has more than one
authoritatively established MainArtist.

For the example above, both may be valid:

```
/tracks/kethan/summer  -> T123
/tracks/bensoul/summer -> T123
```

These are two presentation bindings for one Track identity. They are not two
Tracks and they do not require two `registry_tracks.slug` values.

## Canonical URL rule

Every publicly routable Track has exactly one canonical public route.

For a multi-MainArtist Track:

1. authoritative display / billing sequence determines MainArtist order;
2. the first routable MainArtist in that authoritative sequence owns the
   canonical URL;
3. later MainArtists may own additional valid Artist-scoped presentation
   routes to the same Track UUID;
4. alternate MainArtist routes emit the canonical URL of the sequence-1
   MainArtist;
5. alternate MainArtist routes are first-class route bindings, not historical
   redirects and not entries in `wk_slug_redirects`.

If authoritative MainArtist ordering is absent, contradictory or ambiguous,
WAKILISHA must fail closed into review. Ingest order, UUID order, creation time,
alphabetical order and arbitrary application order are not authority for
canonical-route selection.

## Artist-profile membership is not inferred from the URL

Artist profile membership is a Registry relationship question, not a routing
question.

A Track belongs in an Artist's primary discography when authoritative
Track↔Artist role data establishes that Artist as `MainArtist`.

A Track belongs in an Artist's featured / appearances presentation when
authoritative Track↔Artist role data establishes that Artist as
`FeaturedArtist`.

Therefore:

```
Artist profile -> Track↔Artist role -> Track UUID
```

is authoritative.

This is prohibited:

```
Artist profile membership <- URL prefix
```

A Track must never appear in another Artist's primary discography merely because
a route can be constructed under that Artist's slug.

### Example: co-main recording

```
Track: Summer
Kethan  — MainArtist, sequence 1
Bensoul — MainArtist, sequence 2
```

Presentation:

```
Kethan profile
  Primary discography
    Summer -> /tracks/kethan/summer

Bensoul profile
  Primary discography
    Summer -> /tracks/bensoul/summer
```

Both routes resolve to the same Track UUID.

### Example: featured recording

If authoritative evidence instead establishes:

```
Kethan  — MainArtist
Bensoul — FeaturedArtist
```

presentation becomes:

```
Kethan profile
  Primary discography
    Summer -> /tracks/kethan/summer

Bensoul profile
  Featured / Appearances
    Summer -> canonical Track presentation
```

No MainArtist route binding is created for Bensoul merely because Bensoul is
credited on the recording.

## Slug semantics are independent of artist-role repair

Collaborator billing does not belong in canonical Track slug identity.

For example:

```
title evidence: Summer (feat. Bensoul)
dirty slug:     summer-feat-bensoul
semantic slug:  summer
```

The fact that collaborator-credit packaging contaminates the slug is separate
from the question of whether Bensoul is ultimately proven to be MainArtist,
FeaturedArtist or another contributor role.

Therefore WAKILISHA must not require already-correct structured credits before it
can recognize collaborator-credit contamination in a public Track slug.

Structured-credit uncertainty may block automatic credit mutation. It must not
make a collaborator-bearing slug canonical.

## Proposed durable route-binding authority

Implementation may use a dedicated materialized authority or an equivalent
derived/indexed representation, but the semantics must be equivalent to:

```
registry_track_public_routes

track_id
artist_id
artist_slug
track_slug
artist_role
display_sequence
is_canonical
```

This table name is a design placeholder until implementation review. The
contract is normative; the physical schema name is not.

Required invariants:

- every active route binding references one active/resolvable Registry Track;
- every active route binding references an Artist with authoritative
  `MainArtist` role for that Track;
- `track_slug` equals the Track's semantic public slug;
- `artist_slug` is presentation data for the bound Artist, not Track identity;
- `(artist_id, track_slug)` resolves to at most one active Track UUID;
- every public Track has exactly one canonical route binding;
- one Track may have multiple active route bindings only when multiple
  MainArtists are authoritative;
- `is_canonical=true` belongs to the first authoritative MainArtist sequence;
- no FeaturedArtist-only credit earns a MainArtist route binding;
- no route binding may create a Registry Track identity.

## Collision behavior

Collision checks are Artist-scoped.

For each proposed MainArtist route binding:

```
(MainArtist UUID, semanticTrackSlug)
```

WAKILISHA must determine whether that tuple already resolves to another active
Track UUID.

If it does:

- automatic suffixing: prohibited;
- automatic identity approval: prohibited;
- different ISRC alone: insufficient;
- cross-Artist same slug: irrelevant;
- human recording-identity review: required unless authoritative evidence
  deterministically binds the observation to the existing Track.

A co-main Track is checked independently in every MainArtist namespace it earns.

Example:

```
Track T123
MainArtists: Artist A, Artist B
slug: summer
```

Both must be safe:

```
(Artist A, summer) -> T123
(Artist B, summer) -> T123
```

A collision under Artist B cannot be ignored merely because Artist A's route is
collision-free.

## Writer/admission contract

No canonical Track write path may create or change public Track identity without
passing the same route-binding and semantic-slug policy.

The shared policy must be consumed by, at minimum:

- Track Intake;
- reviewed Discography ingestion;
- Chart materialization when canonical Track creation is required;
- Admin Track identity/profile mutation;
- MIZIZI Track canonicalization;
- duplicate/identity convergence when survivor identity changes;
- any future privileged Registry Track writer admitted by the canonical writer
  inventory.

Existing exact-grant / typed-operation / independent-verifier authority remains
the execution boundary. This decision adds semantic policy convergence; it does
not authorize a second mutation framework.

## MIZIZI responsibilities

MIZIZI is the steward and verifier of this contract, not a janitor behind
inconsistent writers.

MIZIZI must be able to detect independently:

- collaborator-credit tokens in public Track slugs;
- Track↔Artist role contradictions;
- missing or ambiguous MainArtist sequence;
- MainArtist route bindings missing for authoritative co-main Tracks;
- route bindings incorrectly created for FeaturedArtist-only credits;
- one `(MainArtist, semanticTrackSlug)` tuple resolving to more than one Track
  UUID;
- one Track carrying multiple route bindings without authoritative multi-main
  evidence;
- canonical binding not matching authoritative MainArtist sequence;
- any governed writer producing a Track identity that violates the shared
  policy.

Detection of a dirty slug must not depend on structured credits already being
correct.

## Public-read and SEO behavior

For a multi-MainArtist Track:

- every earned MainArtist route binding may render the same Track page;
- all bindings resolve by canonical Track UUID;
- only the sequence-1 MainArtist route is the canonical URL;
- secondary MainArtist routes emit the sequence-1 canonical URL;
- sitemap/canonical discovery should expose the canonical URL once;
- Artist profiles may link through their own earned MainArtist route so the
  Track presents naturally within that Artist's namespace;
- Search, Charts, Community and editorial references remain UUID-backed and
  must not manufacture duplicate Track identities from alternate routes.

No redirect infrastructure is introduced.

## Migration from the current single-primary assumption

Before implementation, the programme must audit every current dependency that
assumes exactly one Track primary Artist.

At minimum, review:

- public Track route resolution;
- Artist profile discography queries;
- Track detail presentation;
- canonical URL generation;
- Search indexing;
- sitemap generation;
- Chart/public-content projections;
- Community Track routes;
- Release/Single-to-Track presentation;
- Admin Track credit editing;
- MIZIZI actual-zero route audit;
- Track creation collision-state functions;
- any verifier that currently treats `primaryArtistCount <> 1` as intrinsically
  invalid.

The corrected rule is not "exactly one primary Artist."

The corrected rule is:

> every public Track has an authoritative ordered artist-role set; one or more
> MainArtists are valid; every MainArtist route binding is Artist-scoped and
> unambiguous; exactly one binding is canonical.

## Acceptance gates

The Public Music Identity programme must not close until tests and fresh
Production audit prove:

- Track UUID duplication introduced for co-main presentation: **0**;
- artist-specific duplicate Track slugs introduced: **0**;
- synthetic collaboration Artists created solely for routing: **0**;
- active co-main Tracks missing an earned MainArtist route binding: **0**;
- FeaturedArtist-only credits receiving MainArtist route bindings: **0**;
- active `(MainArtist, semanticTrackSlug)` tuples resolving to multiple Track
  UUIDs: **0**;
- canonical Track routes chosen from ingest order or arbitrary ordering: **0**;
- public Track memberships inferred from URL namespace instead of Track↔Artist
  authority: **0**;
- dirty collaborator-bearing canonical Track slugs outside explicit review:
  **0**;
- alternate co-main routes implemented through `wk_slug_redirects`: **0**;
- generated UUID-bearing Track URLs: **0**;
- same Track UUID renders consistently from every earned MainArtist route;
- secondary MainArtist routes emit the same sequence-1 canonical URL;
- Artist A's primary discography contains the Track only when Artist A is an
  authoritative MainArtist;
- FeaturedArtist presentation is separated from primary discography according
  to role;
- existing ERN/DDEX adapter regression contract remains green;
- canonical writer inventory remains green;
- exact-grant / verifier / zero-authority-at-rest contracts remain green.

## Adversarial fixtures

Permanent acceptance must include at least:

1. one MainArtist;
2. two MainArtists with authoritative sequence;
3. three MainArtists with authoritative sequence;
4. one MainArtist + one FeaturedArtist;
5. two MainArtists + one FeaturedArtist;
6. same semantic Track slug under unrelated Artists;
7. collision in only the second MainArtist namespace;
8. missing MainArtist sequence;
9. contradictory provider role evidence;
10. dirty `feat.` slug where structured credits are wrong;
11. a secondary MainArtist profile linking through its own route binding;
12. a FeaturedArtist profile presenting the Track as an appearance without
    gaining a MainArtist route binding.

## What not to build

- one Track row per MainArtist;
- one artist-specific `registry_tracks.slug` per MainArtist;
- a synthetic "Artist A & Artist B" identity solely for routing;
- a requirement that every Track has exactly one primary Artist;
- FeaturedArtist route ownership masquerading as MainArtist ownership;
- automatic collision suffixes;
- redirect rows for alternate co-main presentation routes;
- route-derived Artist discography membership;
- credit mutation inferred blindly from title text;
- a second Registry mutation framework.

## Decision summary

WAKILISHA public Track identity is one Track UUID plus one semantic Track slug.

Artist ownership/presentation is many-to-one:

```
MainArtist A ─┐
              ├─ route bindings ─> Track UUID T123 / semantic slug summer
MainArtist B ─┘
```

Artist-profile membership comes from authoritative Track↔Artist roles.

Public routing reflects those roles without duplicating the Track.

Exactly one route is canonical, selected from authoritative MainArtist sequence.
Additional MainArtist routes are valid first-class presentation bindings to the
same Track UUID and are not redirects.


## Contributor-provenance dependency

The route-binding contract in this document governs public Artist billing and
Track presentation identity only.

It must not be interpreted as a complete music-provenance graph.

A 29 September 2026 Production audit confirmed that the canonical contribution
authorities installed by the Music Identity & Rights foundation currently
contain:

- `public.registry_track_contributions`: **0 rows**;
- `public.registry_work_contributions`: **0 rows**;

and that both typed admission operations remain disabled.

Accordingly, Track↔Artist billing authority can determine MainArtist /
FeaturedArtist presentation and route entitlement, but it cannot stand in for
the complete participant graph of a Recording or Musical Work.

The forward contributor completion contract is documented in:

`docs/engineering/music-provenance-contributor-graph-operational-gap.md`

Public Music Identity implementation must not manufacture contributor-looking
credits by parsing display strings while that canonical contribution graph
remains unpopulated.
