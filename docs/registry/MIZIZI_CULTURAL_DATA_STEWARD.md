# MIZIZI Cultural Data Steward

## Status

MIZIZI is the permanent WAKILISHA Registry data-hygiene agent.

Agent key: `mizizi`

Rule-set version: `1.0.0`

## Why MIZIZI exists

One of WAKILISHA's deepest long-term advantages is cultural provenance.

A canonical identifier must be clean enough for stable routes, APIs, search, analysis, and future machine use without throwing away the original cultural evidence that produced the record.

The Registry currently contains historical noise such as:

- featured-artist credits embedded in Track slugs
- primary artists repeated inside Track slugs even though the route is already artist-scoped
- provider packaging such as `-single` embedded in Release titles and slugs
- chart slugs drifting away from the canonical Track even when a canonical Track ID is already present
- old canonicalization conventions that were repaired by one-off migrations rather than one permanent steward

MIZIZI turns those isolated cleanups into one durable institutional capability.

## Name

Mizizi means roots.

The name is deliberate. MIZIZI cleans canonical identity without cutting the record away from its roots.

## Authority

MIZIZI does not own cultural truth.

The Registry owns cultural truth.

MIZIZI reads Registry authority and performs data-hygiene work under existing Registry governance.

It reuses:

- `registry_tracks`
- `registry_releases`
- `registry_track_artists`
- `registry_release_artists`
- `registry_release_tracks`
- `provider_field_observations`
- `provider_entity_links`
- `registry_review_items`
- `registry_canonical_write_events`
- `wk_slug_redirects`
- canonical chart links

MIZIZI must not create a parallel identity store, evidence store, or correction system.

## Core principle

Separate the thing from the metadata around the thing.

For a Track:

- the Track title is identity
- the primary artist is a structural relationship
- featured artists are structural relationships
- the Release is structural context
- provider labels are evidence
- chart placement is measurement
- a public slug should contain only the minimum identity required inside its route scope

Example:

Dirty identity:

`/tracks/agent-mgumbe/agent-mgumbe--ficha-white-feat-jovie-jovv-shappaman-kxobie`

Target identity:

`/tracks/agent-mgumbe/ficha-white`

The removed artist and credit information is not deleted. It remains available from structural credits and provider evidence.

## Three dispositions

### Auto-fix candidate

MIZIZI may auto-fix only when the Registry already proves the answer and the change is reversible.

Examples:

- a Track slug contains feature-credit noise and the clean candidate is collision-free in its canonical scope
- a Track slug repeats the primary artist inside an artist-scoped route
- a chart entry has a canonical Track ID and its stored Track slug differs from that canonical Track

Auto-fixes must:

1. compare the expected current value before writing
2. preserve the old public path through `wk_slug_redirects`
3. write a `registry_canonical_write_events` record
4. repair derived downstream references that are keyed to the same canonical ID
5. remain idempotent

### Review

MIZIZI sends changes to review when they may alter cultural meaning.

Examples:

- removing `feat.` text from a canonical Track title
- resolving a slug collision
- deciding whether a remix, live version, edit, language marker, or movement label is part of the work's identity
- changing a Release title
- changing a chart artist when source presentation and Registry primary-artist authority disagree
- adding a missing credit

Review uses the existing Registry review system.

### Observe

Provider payloads, raw source labels, historical aliases, and old values remain evidence.

Cleaning canonical identity must never mean destroying source memory.

## Rule set v1

### `track_slug_identity_noise`

Detects:

- `feat`
- `featuring`
- `ft`
- featured-artist slugs repeated inside the Track slug
- primary-artist prefixes repeated inside the Track slug

The candidate slug is derived from the title after removing only featured-credit notation.

Non-credit version information such as `Remix` is preserved.

### `track_title_credit_noise`

Detects featured-credit notation inside the canonical Track title.

This is review-only in v1 because titles are cultural data.

### `release_title_provider_packaging`

Detects exact provider packaging suffixes such as:

- ` - Single`
- ` - EP`
- ` - Album`

This is review-only in v1.

Phrases such as `The Album` are not treated as provider suffixes.

### `release_slug_provider_packaging`

Proposes a minimal Release slug when an exact provider packaging suffix has been identified in the title.

This is review-only in v1.

### `chart_track_slug_drift`

A chart entry with a canonical Track ID must use the canonical Track slug as derived presentation data.

This is an auto-fix candidate.

### `chart_artist_slug_drift`

Flags chart artist-slug disagreement with the canonical Registry primary artist.

This remains review-only in v1 because chart source presentation may intentionally differ from Registry primary-credit presentation.

## Current production baseline, 31 August 2026

Read-only production audit:

- 2,101 active Tracks
- 526 Track slug changes proposed by the conservative v1 identity rule
- 496 proposed Track slug changes currently collision-free
- 490 Track slugs containing `feat`, `ft`, or `featuring`
- 37 Track slugs repeating the primary artist with a double-hyphen prefix
- 841 active Releases
- 739 Release slugs carrying packaging suffixes such as `-single`
- 1,788 chart entries linked to canonical Tracks
- 161 chart entries whose Track slug differs from the linked canonical Track slug
- 95 chart Track slugs containing feature-credit markers

These numbers are a baseline, not an automatic mutation plan.

## Scale contract

MIZIZI must still work when WAKILISHA stores a billion cultural data points. Full scans may be partitioned across deterministic shards, and each worker keeps only bounded batch state, aggregate counters, a small sample, and its latest keyset cursor.

The runner therefore uses these rules:

- keyset pagination, never offset pagination for large scans
- bounded batches
- optional `updated_at` watermarks for incremental runs
- deterministic fingerprints for idempotency
- optional hash sharding for parallel workers
- vectorized relationship lookups per batch
- expected-value writes to prevent stale mutation
- no full-table in-memory loading
- no dependence on public route strings as identity authority
- canonical IDs and explicit structural relationships before string heuristics
- only explicit active primary-artist credits may authorize automatic artist-scoped identity repair
- streaming aggregate counters and bounded samples instead of retaining full finding sets in memory

At high scale, MIZIZI should run in two ways:

1. inline validation during intake so new dirt is stopped near the source
2. asynchronous stewardship passes for historical and cross-system drift

The pure rule engine must remain shared between both paths.

## Provenance contract

Every applied canonical change must retain:

- entity type
- canonical entity ID
- field changed
- before value
- after value
- rule ID
- rule-set version
- confidence
- source evidence
- actor `mizizi`
- timestamp
- redirect impact when public identity changed

MIZIZI must never overwrite raw provider observations.

## Collision policy

A clean-looking slug is not automatically safe.

Before a Track slug is auto-applied, MIZIZI must verify that the candidate does not collide inside every public identity scope that can resolve the Track.

A collision becomes a review item.

MIZIZI must not solve collisions by appending arbitrary numbers unless an accepted identity policy explicitly authorizes that suffix.

## Route policy

Old public routes are institutional memory.

When canonical slug identity changes, the old path must continue to resolve permanently.

No silent 404 migration is acceptable.

## Safety policy

MIZIZI must not:

- delete provider evidence
- delete old slugs without redirects
- infer a missing artist merely from a string when Registry identity is unresolved
- strip version labels such as Remix, Live, Acoustic, Edit, or Mix without an explicit rule and evidence
- merge canonical entities merely because their cleaned slugs match
- auto-change culturally meaningful titles in v1
- bypass Registry review for ambiguous findings
- use AI similarity as identity authority
- write production changes in audit mode

## Commands

Audit only:

`npm run registry:mizizi:audit`

Apply auto-fix-safe findings:

`npm run registry:mizizi:apply -- --confirm=MIZIZI_APPLY`

Useful runner options:

- `--entity=track|release|chart|all`
- `--batch-size=500`
- `--limit=5000`
- `--limit=0` for an unlimited streaming scan
- `--since=2026-08-31T00:00:00Z`
- `--shard-count=8`
- `--shard-index=0`

Audit mode is the default.

## Product consequence

Public APIs, search, charts, analytics, UI, and future datasets should receive canonical minimal identity.

Credits and provider packaging belong in typed fields and relationships, not inside identity strings.

That separation is what makes WAKILISHA's provenance useful rather than merely abundant.
