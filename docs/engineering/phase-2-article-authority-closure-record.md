# Phase 2 closure record: Article authority

Date: 21 July 2026

## Status

Closed.

## Repository baseline

Phase 2 is closed against repository main:

- `e2d401b Merge pull request #484 from bjuta/fix/seo-metadata-manifest-abort`

## Production runtime baseline

The Phase 2C Article Editor runtime was deployed from:

- `f951ff9 Merge pull request #483 from bjuta/feature/phase-2c-history-lifecycle-promotion`

PR #484 is a build-pipeline fix only. It does not require a production deploy.

## Phase scope

Phase 2 established Article authority.

It delivered:

- durable Article drafts
- immutable Article versions
- truthful autosave
- recovery
- optimistic concurrency
- transactional versioned save
- normalized Article taxonomy relationships
- governed review lifecycle
- requested changes
- approval
- scheduling foundation
- publication snapshots
- exact preview foundation
- archive and restore
- public snapshot stability
- Article Editor workbench modes
- visible lifecycle history
- visible revision history
- visible recovery powers

## Pull requests

Phase 2 closed through:

- PR #460: Durable Article versions migration
- PR #461: Versioned Article editor adoption
- PR #463: Article editor runtime hotfix for autosave and version history
- PR #464: Article save runtime hotfix for versioned save
- PR #467: Article lifecycle foundation
- PR #469: Phase 2B Edge and preview foundation
- PR #470: Governed review closure
- PR #481: Publish version kind hotfix record
- PR #482: Article editor workbench shell
- PR #483: History and lifecycle promotion
- PR #484: SEO metadata manifest abort fallback

## Production proof

The full production Article lifecycle was proven with one real Article.

The proof covered:

1. Draft
2. Submit for Review
3. Request Changes
4. revised Draft
5. Submit again
6. Approve
7. Publish
8. later Draft edit
9. public unchanged verification
10. Archive
11. Restore

## Public stability proof

The public Article page remained served from the stable published version after a later draft edit.

This confirms the Phase 2 publication contract:

- approved immutable version is the publish target
- published snapshot is the public read source
- later draft work does not silently alter the public page

## Editor proof

The production Article Editor now exposes the necessary workbench capabilities:

- Write
- Media
- SEO and Social
- Review
- Publishing
- History
- Recovery

History and Recovery were production-smoked after deployment.

## Build-pipeline proof

PR #484 fixed the SEO metadata manifest abort failure.

The build now handles an unavailable optional SEO metadata manifest by writing a valid manifest artifact and continuing to prerender and audit.

Full `npm run build` passed on main after PR #484.

## Closure gates

Passed.

- Drafts survive interruption.
- Stale clients cannot silently overwrite newer content.
- Submitted, approved, and published versions are immutable snapshots.
- A real Article completed the full governed lifecycle.
- Public delivery remained stable after later draft edits.
- Archive and restore were verified through the current Article workflow.
- The editor visibly explains lifecycle and revision history.
- Phase 2 support tooling is stable enough for Phase 3 planning.

## Deferred to Phase 3

Phase 3 begins the shared trust layer:

- reusable Sources
- Citations
- Credits
- Corrections
- Provenance

Phase 3 must reuse the closed Article authority rather than reopening it.
