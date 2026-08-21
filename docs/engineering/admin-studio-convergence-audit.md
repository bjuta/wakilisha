# Admin Studio convergence audit

## Why this exists

Before Phase 6B, Admin Studio needs to stop behaving like a collection of separately designed CMS screens.

The supplied Palantir operating-model study is the useful lens: different applications can remain purpose-built while sharing the same objects, relationships, permissions, actions, lineage, and operational state. The reusable system is not a universal screen. It is a governed semantic layer plus reusable interface primitives.

WAKILISHA already has the underlying authority needed for this direction: canonical Resources, immutable versions, capability checks, governed Credits/Citations, Media bindings, lifecycle events, and domain relationships. The admin UI should reveal that shared operating model instead of reimplementing it per content type.

## Current three-surface audit

### Articles

Strongest current detail-shell pattern.

Shared concepts already visible:

- record identity: Article title + slug + owner
- lifecycle status
- saved / unsaved / saving state
- Preview
- Save
- Details
- review/publication primary action
- overflow actions
- immutable version/review state

Domain-specific concepts that must remain Article-specific:

- rich document editor
- writing context
- suggestions
- Article metadata
- Article trust workspace
- publication checklist

### Playlists

Playlist detail independently reimplements most of the same shell semantics:

- record identity
- lifecycle status
- saved / unsaved / saving state
- Save
- Details
- primary and secondary lifecycle actions
- version/revision metadata

Domain-specific concepts that must remain Playlist-specific:

- ordered Track composition
- Registry Track resolution
- playback validation
- Registry intake
- curator assignment
- cover presentation
- Track notes

### Audio

Audio currently reimplements the shared concepts a third time with local `WorkflowPill`, local `SectionHeader`, a bespoke page header, bespoke action styling, and bespoke section cards.

Its domain-specific concepts are legitimate and should remain:

- show / season / episode hierarchy
- master audio
- transcript
- chapters
- podcast identity / enclosure
- Audio-specific review constraints

The duplication is in the shell and semantic presentation, not in those domain workflows.

## Accidental duplication to remove

The following are organization-level Admin Studio concepts, not Article/Playlist/Audio concepts:

1. record header / breadcrumb
2. lifecycle badge and status tone
3. save-state indicator
4. record metadata line
5. action rail
6. Details affordance
7. workspace section framing
8. collection-page heading
9. loading / empty / error framing
10. relationship editor patterns
11. lifecycle / version history presentation
12. trust relationship presentation

## Target primitive architecture

Create reusable primitives under `src/components/design-system/admin`.

### Immediate primitives

- `AdminRecordHeader`
  - domain breadcrumb
  - title
  - lifecycle status
  - metadata
  - contextual badges
  - action rail
  - optional footer

- `AdminStatusBadge`
  - one lifecycle-to-tone mapping across Admin Studio
  - supports Article (`publish`, `pending`, `future`) and governed-resource (`published`, `ready_for_review`, `in_review`, `changes_requested`, `approved`, `archived`) vocabularies

- `AdminSaveState`
  - Saved / Unsaved / Saving / submitted-or-read-only state

- `AdminWorkspaceSection`
  - shared section surface, icon, title, explanatory note, optional section action

- `AdminCollectionHeader`
  - shared directory/index page heading and action area

### Follow-on primitives after three-surface proof

Do not prematurely generalize these until Article, Playlist, and Audio expose the exact repeated requirements:

- `AdminDetailsDrawer`
- `AdminRelationEditor`
- `AdminVersionPanel`
- `AdminLifecycleHistory`
- `AdminRecordList`
- `AdminRecordListItem`
- `AdminMediaBinding`
- `AdminEmptyState`

## Convergence rule

Extract -> converge -> migrate.

1. Extract the stable shell semantics from Article + Playlist.
2. Make Article + Playlist consume organization-level primitives with no intended behavior change.
3. Recompose Audio from the same primitives.
4. Only then extend the primitives to other Admin Studio surfaces.

A primitive is valid only when it represents the same WAKILISHA concept across domains. Domain-specific workflow must not be flattened merely to increase reuse.

## Product rule

The goal is not that every screen looks identical.

The goal is that every screen knows what the same thing means.

A status, owner, version, Credit, Citation, Media binding, relationship, lifecycle action, or history event should not acquire a new visual or interaction grammar because a different domain team implemented the page.

## First implementation boundary

This milestone is frontend-only.

In scope:

- shared Admin Studio primitives
- Article detail shell convergence
- Playlist detail shell convergence
- Audio detail shell convergence
- Article / Playlist / Audio collection-header and status convergence where behavior is unchanged
- focused structural regression tests

Out of scope:

- schema changes
- new capabilities
- new lifecycle states
- changing Article editor behavior
- changing Playlist ordering or Registry behavior
- changing Audio publication authority
- redesigning unrelated admin areas before the three-surface primitive set is proven

## Acceptance

The milestone is accepted when:

- Article, Playlist, and Audio use the same record-shell primitives where concepts overlap
- duplicate lifecycle-tone helpers are removed from those surfaces
- duplicate save-state rendering is removed from Article and Playlist
- Audio no longer owns a local generic section-header primitive
- domain workflows remain behaviorally intact
- focused contracts and application build pass
- production visual smoke confirms the three surfaces still expose their domain-specific operations
