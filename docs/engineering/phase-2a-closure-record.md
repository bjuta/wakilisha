# Phase 2A closure record: Durable Article drafts and immutable versions

Date: 16 July 2026

## Status

Closed.

## Production scope

Phase 2A moved Article editing from fake or partial revision behaviour into a durable versioned workflow.

Production now has:

- monotonic Article `draft_version` locking
- immutable Article version snapshots
- baseline versions for all existing Articles
- working version pointers for all existing Articles
- durable autosave snapshots
- authorized latest autosave recovery
- authorized Article version history
- transactional versioned save
- normalized Article taxonomy relationships
- frontend Article editor adoption of versioned save and autosave

## Pull requests

- PR #460: Phase 2A durable Article versions migration
- PR #461: Phase 2A versioned Article editor adoption
- PR #463: Article editor runtime hotfix for autosave and version history
- PR #464: Article save runtime hotfix for versioned save

## Production migrations

- `20260715173634_phase_2a_durable_article_versions.sql`
- `20260716172500_phase_2a_article_editor_runtime_fix.sql`
- `20260716183000_phase_2a_save_article_versioned_runtime_fix.sql`

## Production frontend

Deployed to Lightsail host `35.176.52.252`.

Verified deployed assets included:

- `articleAdminService-Dsljt9dx.js`
- `ArticleEditorWorkspace-CPE9h7aY.js`

## Manual production proof

A real production Article editor smoke test confirmed:

- the editor loaded without the previous autosave function ambiguity error
- the legacy `wk_article_revisions` 403 stopped appearing
- Save Draft completed without `save_article_versioned` 400
- the content edit survived reload
- Revision History displayed the current version and the original autosaved version
- the remaining `ERR_BLOCKED_BY_CLIENT` console entry was browser extension noise, not WAKILISHA runtime failure

## Exit gate

Passed.

- Drafts survive interruption through durable autosave snapshots.
- Stale writes are guarded by `draft_version`.
- Article versions are reconstructable through immutable snapshots.

## Next phase

PR 2B: Review and publication lifecycle.

Build focus:

- review submission
- requested changes
- approval
- scheduling
- publication
- archive and restore
- publication snapshots
- meaningful dates
- cached Article read model
- exact public preview
