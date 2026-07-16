# Phase 2B audit: Article review and publication lifecycle

Date: 16 July 2026

## Phase target

Phase 2B moves Articles from durable draft saving into a real editorial lifecycle.

Authoritative build scope:

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

Exit gate:

- one real Article completes the full lifecycle
- the public page is served from a stable version
- later draft changes cannot alter the published version silently

## Current production baseline

Phase 2A is complete.

The Article editor now has:

- durable `draft_version` locking
- transactional versioned save
- durable autosave
- recovery from the latest autosave
- immutable Article versions
- visible version history
- normalized Article taxonomy snapshots

Manual production smoke proved:

- Save Draft works
- autosave no longer errors
- reload preserves saved edits
- Revision History displays stored versions

## What already exists

The Article editor already has UI paths for:

- Save Draft
- Submit for Review
- Publish
- Schedule
- Unpublish
- status change
- preview link generation
- trash
- restore from trash
- version restore from Revision History

The public magazine route already reads published Article data.

Preview nonce support already exists for private draft preview.

## What is not Phase 2B-grade yet

### 1. Review lifecycle is status mutation, not a lifecycle authority

Current submit and publish flows are mostly direct `wp_status` changes through `save_article_versioned`.

That is not enough for Phase 2B.

Needed:

- explicit review event records
- actor
- prior state
- resulting state
- target Article resource
- target Article version
- review note or requested changes
- transactional transition commands

### 2. Publication does not yet point to a stable published version

Publishing currently updates the current Article row.

Needed:

- publish a specific immutable Article version
- store a stable published version pointer
- serve public pages from that published snapshot
- allow later draft edits without changing the live page silently

### 3. Scheduling is not yet an executable lifecycle

The UI can set future status and date, but there is no durable scheduled publication command/job contract.

Needed:

- schedule a specific version
- create an inspectable job or command receipt
- publish only the scheduled version
- avoid accidental publication of later draft edits

### 4. Requested changes and approval are missing as first-class actions

The editor has pending status but no complete review action model.

Needed:

- submit for review
- request changes
- approve
- record review notes
- keep immutable submitted and approved versions
- prevent silent mutation of approved versions

### 5. Archive and restore are not governed lifecycle transitions

Trash and restore exist, but restore is not yet integrated into versioned lifecycle and provenance.

Needed:

- archive command
- restore command
- review or provenance event
- public exposure rules

### 6. Public preview is not exact version preview

Preview nonce allows draft access, but it is not clearly tied to a specific immutable version.

Needed:

- preview a specific working/submitted version
- ensure reviewer preview is identical to what can be approved or published

### 7. Public read model is still not the Article publication contract

Phase 2B asks for a cached Article read model.

Needed:

- stable read model for public Article detail
- public page reads published snapshot/read model
- cache invalidation when publication changes
- no silent dependence on editable draft state

## Proposed PR 2B shape

PR 2B should be one implementation PR unless the migration becomes too large.

### Database

Add Article lifecycle authority:

- review event table
- publication snapshot table or published read model table
- resource lifecycle pointer updates
- explicit lifecycle command RPCs

Likely commands:

- `submit_article_for_review`
- `request_article_changes`
- `approve_article_version`
- `schedule_article_publication`
- `publish_article_version`
- `archive_article`
- `restore_article`

Each command should:

- require authenticated actor
- check capabilities
- lock the Article resource
- require expected draft/version where appropriate
- create or target immutable versions
- write review/provenance style events
- update pointers transactionally
- return a receipt-like result

### Frontend

Update Article editor to call lifecycle commands instead of raw status saves for:

- Submit for Review
- Request Changes
- Approve
- Publish
- Schedule
- Unpublish or Archive
- Restore

Update UI to show:

- review state
- current submitted version
- approved version
- published version
- meaningful publication/review dates
- lifecycle event history

### Public

Update public Article delivery to read from the published snapshot/read model.

The live public page must not change when an editor keeps working on a draft after publication.

## Non-goals for PR 2B

Do not build the full shared trust layer yet.

Defer to Phase 3:

- reusable sources
- citations
- credits
- corrections
- public provenance beyond lifecycle dates/events

Do not build Inquiry Mode.

Do not rebuild Article editor as an Institute-specific editor.

Do not build generic lifecycle infrastructure for every future output unless needed to close Article 2B cleanly.

## Acceptance test

Use one real Article.

Required proof:

1. save draft
2. submit a specific version for review
3. request changes
4. resubmit
5. approve the submitted version
6. publish the approved version
7. confirm public page reads the published version
8. make a later draft edit
9. confirm public page does not change silently
10. schedule or archive/restore if included in the implementation slice
11. confirm lifecycle history shows who did what and when

## Production safety

Phase 2B will require schema changes and frontend changes.

No production changes were made by this audit.
