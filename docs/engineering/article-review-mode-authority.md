# Article review mode authority

## Purpose

Quality PR 2 introduces three document modes:

- Write
- Suggest
- View

These modes share one Article Workspace and one rendering authority.

## Version authority

Write mode edits the current working Article draft.

Suggest mode targets the immutable version referenced by:

`editorial.resources.current_submitted_version_id`

View mode renders that same governed version in a read-only editor.

Suggestions must never target:

- legacy recovery rows
- temporary autosaves
- an unversioned browser state
- a manual-save version that may later be pruned
- the public publication snapshot

## Initial suggestion scope

The first implementation supports body-text operations:

- insert
- replace
- delete

Each suggestion records:

- Article resource
- Article
- immutable target version
- target version fingerprint
- target field
- ProseMirror text positions for editor navigation
- selected text
- prefix context
- suffix context
- proposed replacement
- complete proposed content HTML
- authenticated creator
- status
- decision record
- applied Article version, when accepted

The initial target field is `content_html`.

Title and summary suggestions may use the same authority later.

## Anchor behaviour

Suggestions use an immutable target version plus bounded text context.

An anchor contains:

- ProseMirror start position
- ProseMirror end position
- selected quote
- prefix context
- suffix context

The positions exist for editor highlighting and navigation. They are not HTML string offsets and must never be used by the database to splice `content_html`.

The complete proposed HTML snapshot is the application payload. The bounded anchor remains the human-readable explanation and visual location of the proposed change.

A suggestion is stale when:

- its target is no longer the current submitted version
- its target fingerprint differs
- the anchor cannot be resolved uniquely
- the proposed operation conflicts with the working draft

Quality PR 2 does not silently rebase ambiguous suggestions.

## Decisions

Suggestion decisions are separate from Article lifecycle decisions.

Article lifecycle remains responsible for:

- submitted
- changes requested
- approved
- scheduled
- published
- unpublished
- archived
- restored

Suggestion records remain responsible for:

- open
- accepted
- rejected
- withdrawn
- stale

An accepted suggestion must reference the new durable `review_applied` Article version that contains the applied change.

A `review_applied` version is immutable and is not part of ordinary manual-save pruning.

An acceptance must not merely change a status flag.

## Acceptance flow

A later transactional RPC will:

1. lock the open suggestion
2. verify the submitted target version and fingerprint
3. verify the target remains the current submitted version
4. verify governed Article review authority
5. verify the expected draft version
6. apply the complete proposed HTML snapshot through versioned Article authority
7. record the resulting Article version
8. mark the suggestion accepted
9. append the decision event
10. move the pending Article back to draft review work
11. mark competing suggestions against the superseded review state as stale

## Comments

Internal Article review comments use dedicated editorial tables.

The public community comment tables remain public discussion infrastructure and are not reused as internal editorial authority.

The visual drawer and composer patterns may be reused.

## Identity

Quality PR 2 stores authenticated account IDs from `auth.users`.

It does not create a second contributor or public-person authority.

Public credit and account-to-person linking remain Phase 3A work.

## Access

Review records are authenticated-only.

A user may participate when they:

- can edit the Article
- can make governed Article review decisions
- are an administrator

The `view_review_queue` capability alone does not grant access to internal Article review records.

Anonymous users cannot read review records.


## Rendering

View mode uses the existing Article editor in read-only mode.

It does not create a second public renderer and does not replace Exact Public Preview.

## Initial review-round acceptance boundary

Quality PR 2 accepts at most one suggestion from each immutable submitted review round.

Each suggestion stores a complete proposed Article document derived from the submitted version. Once one suggestion is accepted, the Article returns to draft and the submitted snapshot is no longer the active editing state. Remaining open suggestions from that submitted version are marked stale and preserved in history.

This is deliberate. Quality PR 2 does not silently rebase a full-document proposal onto a changed draft.

Editors may reconsider the remaining feedback after revising and resubmitting the Article. A later phase may introduce explicit rebasing or multi-suggestion composition, but it must not infer or merge editorial changes silently.

## Review acceptance write authority

`public.save_article_versioned` remains the author and editor save command.

`public.accept_article_suggestion` remains the governed reviewer decision command. It delegates Article mutation and immutable version creation to the private `editorial.apply_article_review_snapshot` authority.

Authenticated clients cannot execute the private command directly. This prevents a reviewer from creating a `review_applied` version without an accepted suggestion record and decision event.

## Review actor labels

Review records store authenticated account IDs. Workspace display labels come from `public.user_profiles.display_name`.

The review workspace does not expose `auth.users.email`.
