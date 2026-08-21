# Admin Studio convergence audit

Status: CLOSED AND PROVEN IN PRODUCTION

Closure date: 21 August 2026

## Closure note

The three-surface proof is complete. Article, Playlist, and Audio now consume the same record-shell primitives where concepts overlap, while their domain-specific workspaces remain purpose-built.

The reusable residue from this milestone is no longer governed only by this audit. It is now registered and enforced through `docs/engineering/primitive-compounding-contract.md`, `scripts/control-plane/primitive-registry.json`, and the Critical Control Plane.

## Why this exists

Before Phase 6B, Admin Studio needed to stop behaving like a collection of separately designed CMS screens.

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

Playlist detail independently reimplemented most of the same shell semantics before convergence:

- record identity
- lifecycle status
- saved / unsaved / saving state
- Save
- Details
- primary and secondary lifecycle actions
- version/revision metadata

Domain-specific concepts that remain Playlist-specific:

- ordered Track composition
- Registry Track resolution
- playback validation
- Registry intake
- curator assignment
- cover presentation
- Track notes

### Audio

Audio initially reimplemented the shared concepts a third time with local `WorkflowPill`, local `SectionHeader`, a bespoke page header, bespoke action styling, and bespoke section cards.

Its domain-specific concepts remain legitimate:

- show / season / episode hierarchy
- master audio
- transcript
- chapters
- podcast identity / enclosure
- Audio-specific review constraints

The duplication was in the shell and semantic presentation, not in those domain workflows.

## Accidental duplication removed or governed

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

## Proven primitive architecture

Reusable primitives live under `src/components/design-system/admin` and `src/components/design-system/editorial`.

Canonical three-domain proof now includes:

- `AdminRecordHeader`
- `AdminStatusBadge`
- `AdminSaveState`
- `AdminCollectionHeader`

Audio-proven candidates include:

- `AdminWorkspaceSection`
- `AdminModeComposer`
- `EditorialWorkflowRail`
- `EditorialCommentEditor`
- `MediaTransport`
- `MediaTimeline`

Candidate does not mean unfinished. It means one real domain has proven the contract and a second domain has not yet proven the reusable boundary.

## Convergence rule

Extract -> converge -> migrate.

1. Extract the stable shell semantics from real product work.
2. Make existing consumers converge with no intended behavior change.
3. Recompose the next domain from the same semantics where they genuinely match.
4. Promote a candidate only after another real domain proves it.

A primitive is valid only when it represents the same WAKILISHA concept across domains. Domain-specific workflow must not be flattened merely to increase reuse.

## Product rule

The goal is not that every screen looks identical.

The goal is that every screen knows what the same thing means.

A status, owner, version, Credit, Citation, Media binding, relationship, lifecycle action, or history event should not acquire a new visual or interaction grammar because a different domain team implemented the page.

## Original implementation boundary

This convergence milestone was frontend-only.

It did not introduce schema changes, new capabilities, new lifecycle states, or changes to Article, Playlist, or Audio domain authority.

## Acceptance result

Accepted:

- Article, Playlist, and Audio use the same record-shell primitives where concepts overlap
- duplicate lifecycle-tone helpers were removed from the converged surfaces
- duplicate save-state rendering was removed from Article and Playlist
- Audio no longer owns a local generic section-header primitive
- domain workflows remained behaviorally intact
- focused contracts and application build passed
- production visual smoke confirmed the three surfaces still expose their domain-specific operations

This milestone is closed. Future convergence is governed by the Primitive Compounding Contract rather than by reopening this audit.
