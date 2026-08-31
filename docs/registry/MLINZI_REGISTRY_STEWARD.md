# Mlinzi Registry Steward

Status: FOUNDATION CANDIDATE

Agent name: **Mlinzi**

Technical role: WAKILISHA Registry Steward

## Why Mlinzi exists

WAKILISHA's cultural-data moat is not the volume of provider data it can copy.

The moat is that WAKILISHA can preserve evidence, resolve identity, remove structural noise, and publish a clean cultural graph without erasing where the facts came from.

Provider data, chart snapshots, imports, and old migrations will continue to introduce noise for as long as the Registry exists. That is expected. The system must be able to absorb noisy evidence without turning the canonical Registry, public URLs, APIs, analysis, UI, or UX into the same noise.

Mlinzi is the permanent steward for that boundary.

## The core rule

**Raw evidence may be messy. Canonical cultural identity should not be.**

Mlinzi never treats source evidence and canonical presentation as the same thing.

Examples:

- A provider may call a one-track package a Release. WAKILISHA may keep that provider Release record for provenance while publicly treating the object as a Track.
- A provider title may contain `(feat. Artist)`. WAKILISHA may preserve that title observation while keeping the featured Artist in the canonical credit graph and out of a redundant public slug.
- A chart row may preserve exactly what a chart source printed while a public chart surface presents the linked canonical Registry Track and Artist.
- A legacy slug may contain `artist--title`. The old route is preserved as a permanent redirect while the canonical route becomes minimal.

## What Mlinzi is not

Mlinzi is not an LLM that guesses cultural facts.

It is not a new admin queue.

It is not a second Registry authority.

It is not allowed to rewrite raw provider or chart evidence merely to make the source look cleaner.

It compounds existing authority:

- canonical Registry entities
- canonical Track and Release Artist credit graphs
- canonical `registry_release_tracks` membership
- provider observations and entity links
- canonical write audit events
- permanent slug redirects

## Decision model

Every finding has one of four dispositions.

### 1. Auto repair

Use when the intended canonical state is provable from existing authority and the mutation is reversible or route-safe.

Current examples:

- remove a duplicated primary Artist prefix from a Track slug when that Artist already owns the route scope
- remove a featured Artist clause from a Track slug when every named participant is proven by active non-primary canonical Track credits
- preserve meaningful version words such as Remix, Live, Acoustic, Radio Edit, or Part 2 while removing structural credit text
- reconcile missing Release Artist links from the Track Artist graph when the Release has exactly one active Track
- create permanent old-path to new-path redirects before changing a canonical slug

Auto repair is the default for deterministic structural noise.

### 2. Leave alone

Use when the current canonical value is already correct or the source variation does not matter.

No task is created.

### 3. Defer and retry

Use when evidence is incomplete, a candidate collides with another canonical route, a redirect already points elsewhere, or the difference cannot be proven structural.

The canonical value is left untouched.

No admin task is created.

The next Mlinzi pass reevaluates the finding after more canonical or provider evidence exists.

### 4. Human required

Human review is the last resort.

A finding may become human-required only when all of these are true:

1. the conflict is identity-affecting or redirect-affecting
2. it remains unresolved after repeated automatic passes
3. it materially affects a public route, merge, attribution, or cultural identity decision
4. deterministic evidence still cannot choose safely

This prevents the Registry review outtray from becoming a wastebasket for machine-solvable work.

## Automaticity policy

Mlinzi should become more automatic as evidence quality improves.

### Tier A: deterministic structural evidence

Auto repair immediately.

Examples:

- canonical relationship graph proves featured credits
- one active Track proves a one-track Release relationship mirror
- a route scope proves an Artist prefix is redundant
- a previous path can be preserved with a permanent redirect

### Tier B: strong source consensus

Eligible for automatic canonical enrichment when:

- stable provider identifiers agree on the same entity
- trusted observations agree on the same field
- no human-approved canonical value conflicts
- the change does not create an identity collision

This tier can expand over time without changing the Tier A guarantees.

### Tier C: unresolved disagreement

Do not mutate canonical identity.

Retry automatically as more evidence arrives.

Do not create admin work by default.

### Tier D: persistent material ambiguity

Human review only.

This should remain a very small fraction of Registry volume.

## Slug policy

A public slug is an address, not a credit roll.

Track route identity should be minimal and stable:

```text
/tracks/{primary-artist-slug}/{track-title-slug}
```

For Tracks inside a multi-track Release:

```text
/releases/{release-artist-slug}/{release-slug}/{track-title-slug}
```

Slug construction may include culturally meaningful title or version language, but should not duplicate data already modeled structurally.

### Slug noise that can be auto removed when proven

- duplicated primary Artist prefix
- `feat.`, `ft.`, or `featuring` clauses whose people exactly match canonical non-primary credits
- provider packaging labels that are already represented structurally
- accidental punctuation repetition

### Information that is not automatically stripped

- Remix
- Live
- Acoustic
- Radio Edit
- Part numbers
- language that is actually part of the work's title
- unexplained suffixes when a collision or version distinction may exist

## Route safety

Mlinzi never changes a canonical slug first and hopes links survive.

The order is:

1. prove the candidate
2. prove route-scope uniqueness
3. inspect existing redirects for conflict
4. create permanent path-aware redirects
5. change the canonical slug
6. append a canonical write event
7. verify the new route and the old redirect

For a Track that appears inside a multi-track Release, Mlinzi preserves both standalone and release-scoped historical paths where they exist.

## Relationship policy

`registry_release_tracks` is Release membership authority.

`registry_tracks.release_id` is compatibility data and must not be strengthened into a second membership authority.

For a Release with exactly one active Track, Track Artist credits can safely fill missing Release Artist credits because both records describe the same provider package.

For multi-track Releases, Mlinzi does not copy every Track collaborator into the Release Artist graph. A featured artist on one album Track is not automatically a release-level artist.

## Chart policy

Chart source facts are provenance.

Mlinzi should not make a historical chart source "cleaner" by overwriting what the source printed.

The clean public model is:

```text
raw chart evidence
      |
      v
canonical Track / Artist link
      |
      v
clean public presentation
```

When a chart entry has a canonical Track or Artist ID, public endpoints and UI should prefer canonical Registry identity while retaining raw chart text as evidence.

A mismatch between raw chart text and the linked canonical entity is a steward signal, not permission to destroy the raw evidence.

## Current production evidence

Audit date: 2026-08-31

Current active Registry shape:

- 2,101 active Tracks
- 841 active Release records
- 685 active Release records have exactly one active Track
- 156 active Release records have more than one active Track
- 2,039 active Tracks have canonical `registry_release_tracks` membership while the old `registry_tracks.release_id` pointer is null

Relationship integrity audit:

- 191 active Releases are missing at least one Artist who exists on one of their canonical Tracks
- 108 affected Releases are one-track Releases
- those 108 one-track Releases contain 151 deterministically repairable missing Artist links

Preliminary slug audit:

- 52 active Track slugs differ from a direct slugification of their stored title
- 496 active Track slugs contain feature-credit tokens
- 17 active Track records show the legacy `artist--title` pattern inside the high-signal structural-noise set
- 488 Track records are preliminary structural-noise candidates before Mlinzi's exact participant, collision, and redirect proof

The 488 number is deliberately not called an automatic-repair count yet. Mlinzi must prove each candidate against canonical credits and route safety before mutation.

## Runtime

Runner:

`scripts/registry/mlinzi-registry-steward.ts`

Policy:

`src/services/registry/steward/mlinzi.ts`

Audit only:

```bash
npm run registry:mlinzi:audit
```

Bounded audit:

```bash
npm run registry:mlinzi:audit -- --limit=500 --since=2026-08-01
```

Safe apply:

```bash
npm run registry:mlinzi:apply
```

Apply mode is intentionally explicit. The runner uses an advisory lock so two stewards cannot mutate the same authority concurrently.

## Provenance of every repair

Every applied mutation must leave durable evidence.

Slug repair:

- old canonical value
- new canonical value
- rule that justified the repair
- agent actor `mlinzi`
- permanent redirect from every known public route form
- canonical write event

One-track Release Artist parity:

- source Track ID
- source Track credit ID
- copied canonical Artist ID
- original credit role and ordering
- Mlinzi rule in metadata
- canonical write event

This is the moat: WAKILISHA can explain not only what it believes now, but how it got there.

## Scale model

Mlinzi's policy is pure and deterministic. Runtime execution is bounded.

Today it can scan thousands of rows.

At millions or billions of observations, the same policy can run through:

- keyset pagination
- updated-at watermarks
- provider-ingest events
- partition-local batches
- queue workers
- route-collision indexes
- set-based database candidates

The important invariant is that scale changes execution mechanics, not cultural truth rules.

No future volume should require an LLM to decide whether `feat. Artist` belongs in a slug when the canonical credit graph already answers the question.

## Manual-review budget

The target is not "every uncertainty becomes review."

The target is:

```text
deterministic repair     -> automatic
strong consensus         -> automatic
weak evidence            -> hold and retry
persistent material risk -> human
```

If Mlinzi begins generating large volumes of human tasks, that is a failure in the steward design and should trigger a policy or evidence-pipeline improvement before more reviewers are added.
