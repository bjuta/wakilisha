# Phase 4A closure record: Media authority redesign

Date: 7 August 2026

## Status

Closed.

## Repository baseline

Phase 4A is closed against repository main:

- `f6800cb5 Remove stale retired admin import links (#580)`

PR #579 retired the WordPress runtime and Media URL compatibility surfaces.

PR #580 removed the final stale Admin Import navigation references and supplied
the final production retirement build.

## Production schema baseline

The accepted live schema baseline is:

- authoritative migrations: 199
- latest migration: `20260806192259_media_url_cutover.sql`
- generated public-schema types match production

The three final retirement migrations are:

- `20260806162000_retire_wordpress_runtime.sql`
- `20260806184500_hard_delete_unrecoverable_guides.sql`
- `20260806192259_media_url_cutover.sql`

The linked migration ledger is current.

## Phase scope

Phase 4A established canonical Media authority before the larger upload and
processing pipeline.

It delivered:

- stable logical Media identity
- versioned Media governance
- immutable file-object identity
- immutable asset revisions
- immutable variants
- governed active variant selection
- typed usage links
- append-only Media events
- compatibility identity bridge
- governed public delivery resolution
- governed batch compatibility reads
- public Media read cutover
- Article inline Media read cutover
- administrative Media read cutover
- governed Media Library commands
- immutable upload registration
- immutable replacement
- archive behavior
- removal of ordinary in-place file overwrite
- browser Media CORS
- active legacy Media URL cutover
- WordPress runtime retirement
- final stale Admin Import navigation retirement

## Pull-request sequence

Phase 4A was established and closed through PR #559 to PR #580.

Major checkpoints include:

- PR #559: Media authority boundary
- PR #560: Media schema contract
- PR #561 to PR #569: canonical Media schema, identity, commands, usage authority,
  read models, and live-schema reconciliation
- PR #570 to PR #572: legacy delivery resolver and governed batch adapter
- PR #573 to PR #575: shared public read cutover, Article inline read cutover,
  and dead track-artwork lookup retirement
- PR #576: public Media read-lane acceptance
- PR #577: administrative Media read cutover
- PR #578: Media write authority and immutable replacement acceptance
- PR #579: WordPress runtime and Media URL compatibility retirement
- PR #580: stale retired Admin Import navigation cleanup and final frontend
  retirement acceptance

## Accepted Media authority proof

The final accepted Media write-authority proof recorded:

- canonical logical assets: 1,080
- governance versions: 1,080
- compatibility rows: 1,080
- legacy identity bridges: 1,080
- usage links: 987
- immutable file objects: 4
- asset revisions: 2
- variants: 2
- variant selections: 2

The proof asset was archived after acceptance.

Both immutable original revisions and both registered responsive derivatives
remain preserved.

## Immutable replacement proof

The accepted proof established that:

- an upload creates a new immutable file object
- the original SHA-256 is registered and verified
- the responsive derivative is independently registered and verified
- replacement creates a new immutable revision
- replacement uses a new storage path
- the prior revision remains preserved
- current revision selection advances without rewriting the prior master
- archive preserves identity and revision history

This satisfies the Phase 4A requirement that one logical asset can safely hold
an original and several derivatives.

## Public and administrative cutover

The public Media lane was moved behind governed read authority.

Accepted public surfaces include:

- Artists
- Releases
- Articles
- Labels
- Tracks
- Guides
- shared image enrichment
- Article inline Media captions

Administrative Media reads were also moved behind the authenticated canonical
read adapter.

The Media Library write path now uses governed Media commands.

Ordinary public and administrative Media work no longer treats direct
compatibility-table access as canonical Media authority.

## WordPress runtime retirement

WordPress is no longer a WAKILISHA runtime, migration path, source connector,
fallback, or administrative Media authority.

The repository retirement removed:

- administrative WordPress import routes
- the Media migration route
- WordPress connection and mapping services
- legacy WordPress import services
- WordPress import package commands
- WordPress audit and migration tooling
- dedicated WordPress Edge Function source
- twelve completed database staging and promotion functions
- the empty raw WordPress item table
- frontend WordPress image rewrite compatibility

The final production check also removed 13 deployed WordPress or one-time
backfill Edge Functions:

- `backfill-article-authors`
- `backfill-article-hero-images`
- `backfill-article-hero-storage`
- `create-wp-run`
- `enrich-artist-discography`
- `finalize-wp-staging`
- `migrate-media-from-wp`
- `migrate-wp-images`
- `process-wp-import`
- `update-guide-pages`
- `wp-connect-proxy`
- `wp-db-stage`
- `scrape-author-data`

All 13 were verified absent after deletion.

## Final infrastructure retirement correction

The first PR 4B infrastructure audit found one remaining production-only
compatibility layer: Media-origin Nginx still consulted the copied local
`wp-content/uploads` mirror and local/staging Nginx retained an unused proxy to
the former WordPress host.

Production release
`phase4a-nginx-media-retirement-20260807T091124Z` corrected this by:

- promoting 4,822 Media files and 407,479,887 bytes into canonical `/uploads`
- verifying all promoted bytes by SHA-256
- overwriting zero canonical files
- preserving three differing canonical collisions
- removing the old WordPress-host proxy
- removing Media-origin `wp-content` fallback
- preserving the historical public `/wp-content/uploads/*` redirect
- retaining the complete 5,717-file mirror for rollback

See
`docs/engineering/phase-4a-nginx-media-runtime-retirement-acceptance-record.md`.

## Active legacy Media URL cutover

The accepted production cutover reported:

- active legacy Media URL rows: 0
- historical analytics rows intentionally preserved: 8
- archived Media tombstones intentionally preserved: 2
- external document rows intentionally preserved: 3
- provenance rows intentionally preserved: 6

Historical evidence was preserved rather than rewritten indiscriminately.

## Final frontend acceptance

The final production frontend was deployed from:

- main commit `f6800cb5`
- entry `assets/index-kj620d2B.js`
- entry SHA-256
  `56373459ff0c8047970f9382dd566b86ea4e51756cb8e679d38373df169ce2d2`

The deployment was verified by exact file hashes on the Lightsail host.

Production smoke acceptance returned HTTP 200 for:

- `/`
- `/charts`
- `/artists`
- `/magazine`

The live build contains:

- no `/admin/imports` navigation
- no `wpImageRewrite`
- no `rewriteWpImageUrl`
- no `rewriteWpImageUrls`
- no `WP_UPLOADS_BASE`
- no retired WordPress Admin Import route implementation

The Media origin responded at its root with HTTP 404. That is accepted because
the origin is reachable and has no homepage contract; actual Media delivery
occurs on registered asset paths.

Final rollback backup:

`/opt/wakilisha-react-backups/phase4a-final-retirement-f6800cb5-20260807T072910Z`

## CI acceptance

The post-merge Critical Control Plane completed successfully on `f6800cb5`.

Accepted run:

- workflow: Critical Control Plane
- run: `31157265567`
- event: push
- job: `critical`
- conclusion: success

The job included:

- critical security and lifecycle tests
- live schema drift detection
- application build

## Exit gates

Passed.

- Existing Media assets remain usable.
- One logical asset can safely hold an original and several derivatives.
- Immutable replacement preserves earlier masters and revisions.
- Ordinary public Media reads use governed authority.
- Ordinary administrative Media reads use governed authority.
- Ordinary Media writes use governed commands.
- No editor depends on the retired frontend WordPress Media rewrite layer.
- Active legacy Media URLs were cut over without erasing accepted historical
  evidence.
- WordPress runtime execution surfaces are retired.
- The Media origin no longer consults the WordPress filesystem namespace.
- The old WordPress-host proxy is absent from active Nginx configuration.
- Historical `/wp-content/uploads/*` requests redirect to canonical Media.
- The final frontend build is live and production-smoked.

## Residual historical compatibility boundary

Phase 4A closure does not pretend that all historical WordPress-named data has
been physically deleted.

Thirty-seven WordPress-named columns and four matching indexes were deliberately
preserved because they may carry historical identifiers or status values used
by canonical WAKILISHA records.

The frozen Institute also retains a narrow compatibility read surface.

Earlier Phase 4A acceptance recorded compatibility policies, grants, and
foreign-key relationships that could not be contracted safely before their
consumers and preservation requirements were understood.

These residual structures are not active WordPress runtime authority and are
not a reason to keep Phase 4A open.

Any later source-field neutralization, compatibility policy contraction, grant
contraction, or foreign-key replacement must be handled as a separate
evidence-led preservation or hardening checkpoint.

That work must:

- prove exact live dependencies first
- preserve canonical content and provenance
- preserve frozen-boundary behavior until intentionally retired
- avoid inventing legacy metadata
- avoid restoring WordPress runtime behavior
- use forward migrations rather than rewriting applied history

## Deferred to PR 4B

PR 4B owns the upload and processing pipeline:

- resumable upload sessions
- direct multipart transfer
- upload retry
- completion verification
- processing jobs
- audio derivatives
- video renditions
- poster frames
- thumbnails
- waveform data
- transcripts
- captions
- signed private delivery
- public CDN delivery
- storage reconciliation
- orphan cleanup
- failed-processing recovery

PR 4B must extend the closed Phase 4A authority rather than replace it.

See:

`docs/engineering/phase-4b-upload-processing-kickoff.md`
