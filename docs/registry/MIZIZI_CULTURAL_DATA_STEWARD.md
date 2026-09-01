# MIZIZI Cultural Data Steward

## Status

MIZIZI is the permanent WAKILISHA Registry data-hygiene agent.

Current state: PR #772 merged and the preventive Track identity write boundary is production accepted. The historical MIZIZI apply command has not been run.

Agent key: `mizizi`

Rule-set version: `1.0.0`

## Production acceptance, 1 September 2026

The preventive write boundary is live in production.

- canonical migration history: 78 migrations through `20260901114500_mizizi_track_identity_write_boundary.sql`
- permanent SQL verifier: pass in production
- `ingest-artist-discography`: production version 58, exact merged source
- `registry-enrichment-review`: production version 33, exact merged source
- `chart-ingest-api`: production version 82, exact merged source
- `scrape-artist-data`: production version 46, exact merged source
- shared `registry-track-identity.ts` helper: exact merged source in all four deployed bundles
- JWT behavior preserved: true / true / true / false respectively
- active Track count after promotion: 2,101
- MIZIZI review items after promotion: 0
- MIZIZI canonical write events after promotion: 0
- historical MIZIZI apply run: no

Production promotion changed the canonical Track creation boundary and the four automatic Track writers. It did **not** rewrite historical Registry rows, create review work, or run the steward against the existing cultural corpus.

## Release taxonomy and public identity, accepted 1 September 2026

Release taxonomy is now an explicit WAKILISHA cultural-data invariant:

- exactly 1 resolvable active Track means Single
- 2 through 6 resolvable active Tracks means EP
- 7 or more resolvable active Tracks means Album

"Resolvable active Track" means an active `registry_release_tracks` membership whose target is an active `registry_tracks` row. A relationship row whose Track target is missing or inactive remains Registry evidence but must not manufacture public Release identity.

Public page policy is separate from MIZIZI:

- Releases is the collective domain for Singles, EPs, and Albums
- Singles remain in Releases, Artist Discography, and Appears On
- a Single does not own a dedicated Release detail page
- a Single resolves publicly to its one canonical Track route
- EPs and Albums own Release detail pages
- canonical Track public routes remain `/tracks/{artist-slug}/{track-slug}`
- Registry Track UUID remains internal identity

MIZIZI's role is to keep Registry data consistent with this accepted model, not to own React routing or sitemap policy.

The first read-only production audit against resolvable active Track membership found:

- 841 active Releases
- 13 active Releases with zero resolvable active Tracks
- 673 canonical Singles by Track count
- 53 canonical EPs by Track count
- 102 canonical Albums by Track count
- 32 active stored Release-type mismatches
  - 11 stored EPs resolve to Singles
  - 19 stored Albums resolve to EPs
  - 2 stored EPs resolve to Albums
- 18 bad active Release-membership relationships across 13 active Releases

The public readers and sitemap authority now ignore those bad relationship rows when deriving public Release identity. The rows themselves have not been deleted or rewritten.

The Release taxonomy rule is accepted product/Registry policy but is not yet part of MIZIZI rule-set v1.0.0 apply behavior. The next MIZIZI rule-set change should add a deterministic `release_taxonomy_drift` rule, prove expected-value write behavior and provenance, then audit before any production apply.

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
- a Track slug repeats the explicit primary artist inside an artist-scoped route
- a Track slug contains a structured featured artist credit that has leaked into identity
- a chart entry has a canonical Track ID and its stored Track slug differs from that canonical Track

Auto-fixes must:

1. compare the expected current value before writing
2. preserve the old public path through `wk_slug_redirects`
3. write a `registry_canonical_write_events` record
4. repair derived downstream references that are keyed to the same canonical ID
5. remain idempotent

### Review

Review is an escalation, not the default destination for untidy data.

MIZIZI creates review work only when a human decision is required to unblock a material canonical repair or protect public correctness.

Examples:

- a collision blocks an otherwise safe canonical slug repair
- explicit primary-artist scope is missing for an artist-scoped Track repair
- a current pointer cannot be tied safely to the canonical Track being repaired
- two plausible canonical identities remain after typed Registry authority and provider evidence are exhausted
- a culturally meaningful title or version distinction must actually be changed now

Review uses the existing Registry review system.

### Observe

Observe is the default for findings that are useful to measure but do not require a human decision now.

Observed findings do not create Registry review items.

Examples:

- featured-credit notation inside a display title
- provider packaging inside a Release title or non-public Release slug
- an unexplained legacy slug mismatch that is not safe to auto-repair
- chart artist presentation that differs from Registry primary-credit presentation

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

The candidate slug is derived from the title. Feature-credit presentation is removed from route identity only when a structured featured-Artist credit proves that the matching fragment is a credit rather than cultural title text.

Automatic repair requires at least one positive structural noise signal. Feature syntax in a string is not structural proof by itself. A mere difference between the current slug and a title-derived slug is not enough.

Non-credit version information such as `Remix` is preserved.

### `track_slug_identity_mismatch`

Detects a Track slug that differs from the minimal title-derived candidate without a positive structural noise signal.

This is observe-only in v1. The mismatch may encode collision history, transliteration, a version distinction, or an earlier editorial choice that string cleanup cannot safely interpret. It does not create review work unless a later material repair is blocked by it.

### `track_title_credit_noise`

Detects featured-credit notation inside the canonical Track title.

This is observe-only in v1 because titles are cultural data. MIZIZI records the pattern without creating an admin task.

### `release_title_provider_packaging`

Detects exact provider packaging suffixes such as:

- ` - Single`
- ` - EP`
- ` - Album`

This is observe-only in v1. Provider packaging is measured without creating an admin task.

Phrases such as `The Album` are not treated as provider suffixes.

### `release_slug_provider_packaging`

Proposes a minimal Release slug when an exact provider packaging suffix has been identified in the title.

This is observe-only in v1. MIZIZI does not create a second review item for a derived slug while Release rewrite and redirect policy remains unsealed.

### `chart_track_slug_drift`

A chart entry with a canonical Track ID must use the canonical Track slug as derived presentation data.

This is an auto-fix candidate.

### `chart_artist_slug_drift`

Flags chart artist-slug disagreement with the canonical Registry primary artist.

This remains observe-only in v1 because chart source presentation may intentionally differ from Registry primary-credit presentation. A difference alone is not an admin task.

## Current production baseline, 1 September 2026

Read-only production audit:

- 2,101 active Tracks
- 490 Track slugs containing `feat`, `ft`, or `featuring`
- 492 Track titles containing feature-credit notation
- 37 Track slugs repeating the primary artist with a double-hyphen prefix
- 82 active duplicate Track-slug groups containing 187 Tracks
- 841 active Releases
- 673 Singles by resolvable active Track count
- 53 EPs by resolvable active Track count
- 102 Albums by resolvable active Track count
- 13 active Releases with zero resolvable active Tracks
- 32 active stored Release-type mismatches against the accepted 1 / 2-6 / 7+ taxonomy
- 18 bad active Release-membership relationships across those 13 zero-resolvable Releases
- 739 Release slugs carrying provider packaging suffixes
- 738 Release titles carrying provider packaging suffixes
- 56 multi-Track Release slugs carrying provider packaging suffixes
- 1,800 chart entries linked to canonical Tracks
- 161 chart entries whose Track slug differs from the linked canonical Track slug
- 95 chart Track slugs containing feature-credit markers
- 91 chart artist slugs differing from canonical primary-Artist presentation
- zero MIZIZI review items in production because MIZIZI apply has never run

These numbers are a baseline, not an automatic mutation plan. Passive findings do not become admin work merely because they exist.

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

## Write-boundary contract

MIZIZI is preventive as well as corrective.

The same pure Track route-identity rule is shared by the live automatic Registry writers that can create Track identity:

- `ingest-artist-discography`
- `registry-enrichment-review`
- `chart-ingest-api`
- `scrape-artist-data`

The reviewed SQL creation authority `admin_create_registry_track_from_intake_enriched` is sealed separately by migration `20260901114500_mizizi_track_identity_write_boundary.sql`.

The write boundary follows these rules:

1. a Track route slug is title-scoped inside its canonical Artist route, not globally unique
2. primary Artist identity is never repeated inside a new Track slug
3. random or arbitrary collision suffixes are not canonical identity policy
4. feature-credit presentation leaves route identity only when structured featured-Artist evidence proves the matching fragment
5. the same clean Track slug may exist under different Artists
6. the same clean Track slug under the same primary Artist fails closed as an identity collision
7. ISRC matches preserve existing canonical Track slugs instead of rewriting them from a new provider title
8. old dirty identities remain resolvable evidence and are repaired through MIZIZI plus redirects, not destructive source rewriting

The SQL migration replaces the existing function definition only. Applying the migration does not rewrite an existing Registry row.

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

## Current-pointer and historical-observation policy

A canonical slug change can affect other products, but not every stored slug should be rewritten.

MIZIZI distinguishes:

- current pointers that are expected to follow canonical identity
- historical observations that record what existed at the time

Current Track pointers currently include saved Track presentation and discussion-thread presentation. When a safe Track slug is applied, MIZIZI updates current saves by canonical Track ID and updates a discussion thread only when its stored URL proves that the thread belongs to the Track being changed.

Historical analytics, activity, contribution, notification, provider, and resolution records are not rewritten. Their old strings remain evidence and can be resolved through canonical IDs, aliases, and redirects during analysis.

The production audit also exposed Community primitive debt:

- 82 active Track slug values are shared by more than one active Track
- those duplicate slug groups contain 187 active Tracks
- 50 duplicate slug groups already have a Track discussion thread
- `community_threads` still has global uniqueness on Track `entity_slug`

This means a slug alone cannot be a durable Track discussion identity. MIZIZI v1 refuses a Track write when a current thread target collides or when an old thread cannot be tied to the Track by its stored URL.

The long-term Community repair is to make canonical Registry Track ID the thread identity authority and keep slug only as presentation and compatibility data.

## Route policy

Old public routes are institutional memory.

When canonical slug identity changes, the old path must continue to resolve permanently.

No silent 404 migration is acceptable.

## Outtray budget

MIZIZI must not turn a hygiene scan into a work generator.

A passive finding is telemetry until one of two things is true:

1. typed Registry authority proves a reversible repair, in which case MIZIZI applies it automatically
2. a human decision is genuinely required to unblock a material repair or protect public correctness, in which case MIZIZI creates one idempotent review item

This means title observations, Release packaging observations, unexplained low-risk mismatches, and chart artist presentation differences do not create review items by default.

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
