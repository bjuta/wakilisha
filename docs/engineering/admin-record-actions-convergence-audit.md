# Admin Record Actions Convergence Audit

Status: candidate correction sprint

Date: 2026-08-23

## Why this follow-on exists

The original Admin Studio convergence milestone correctly extracted shared record identity, lifecycle status, save state, and collection chrome, but it stopped one layer too early for record actions. `AdminRecordHeader` standardized where actions appeared while Article and Playlist still owned competing action renderers and Audio received only the subset somebody happened to compose locally.

That was inconsistent with the Primitive Compounding Contract: same meaning, one primitive.

This follow-on does not reopen the closed Rich Editorial Canonical Primitives M1 database milestone. It corrects the Admin interaction layer and adds only the Audio lifecycle authority that the UI cannot truthfully invent.

## Canonical interaction primitive

`AdminRecordActions` is the canonical consumer-owned interaction primitive for record actions.

It owns:

- rail versus overflow placement;
- primary, secondary, ghost, and destructive tone grammar;
- button versus outbound-link rendering;
- disabled state presentation;
- overflow disclosure accessibility;
- outside-click and Escape dismissal;
- consistent icon, label, and menu treatment.

It does **not** import domain services, pages, Supabase, or lifecycle authority. Article, Playlist, and Audio decide which actions are permitted and pass callbacks or links into the primitive.

This keeps authority in each domain while preventing a new interaction grammar for the same semantic action.

## Consumer migration

Article now describes Preview, Save, Details, Review, Publish, View Live, Return to Draft, and Move to Trash through the shared primitive.

Playlist now describes Save, Details, Preview, Review, scheduling, publication, Archive, and Restore through the same primitive while Playlist services remain the command authority.

Audio now describes Save, Details, Review, Publish, View Live, Archive, and Restore through the same primitive. Audio-specific workspaces such as Sound, Chapters, Credits, Citations, and time-anchored Review remain domain composition.

## Audio authority correction

Production already had all of the ingredients proving that archive was a real Audio concept rather than a UI invention:

- `audio.publications` accepts `archived`;
- `editorial.resources` supports an archived lifecycle state;
- `delete_audio` is assigned to the roles allowed to retire Audio;
- immutable Audio versions, publication snapshots, feed identity, and enclosure identity already exist.

What was missing was a governed command path.

The correction therefore adds reversible Archive and Restore commands using the existing command-receipt and idempotency model. Archive hides active public delivery by clearing the current published pointer and retiring the Resource to private/archived state, while preserving immutable versions, snapshots, GUID/enclosure identity, and audit history. Restore returns the record to internal draft authority rather than silently republishing it.

Archive and Restore are appended to private lifecycle history and projected through the existing Admin Audio workspace read model.

## Preview boundary

Preview is intentionally not fabricated for Audio.

Article and Playlist already have version-bound preview-link authority. Audio currently has no equivalent preview-link table or resolver. Adding a button that merely looks like Preview would violate the same authority-first rule this sprint is correcting.

Until Audio gains an exact immutable-version preview route, the shared action primitive simply receives no Audio Preview action. The primitive standardizes meaning; it does not imply that every domain has every capability.

## Player and shell convergence in the same correction sprint

The public media shell also had semantic drift exposed by the same principle: playback backend, media kind, and editorial capability were being allowed to leak into UI behavior.

The correction keeps one persistent Player while:

- arbitrating HTML Audio, Apple Music, YouTube, and SoundCloud as mutually exclusive playback sessions;
- invalidating stale asynchronous provider starts;
- making Pause defensively pause every engine;
- retaining queue context separately from playback backend;
- preserving Music actions such as Save, Add to Playlist, Moments, Share, and Lyrics entry;
- giving spoken Audio ±15-second primary transport, Chapters, Transcript, playback speed, and secondary episode navigation;
- passing Registry preview URLs from Search into the actual Player descriptor;
- moving global Search into the desktop sidebar and removing the redundant desktop utility bar.

No provider is allowed to redefine what the current media item means.

## Primitive impact

Promoted/new canonical primitive:

- `admin.record-actions` — canonical interaction primitive; consumers: Article, Playlist, Audio.

Reused canonical primitives:

- `admin.record-header`
- `admin.save-state`
- `admin.status-badge`
- `editorial.discovery-workspace`

Intentionally domain-specific:

- Article preview/trash command authority;
- Playlist preview/schedule/archive command authority;
- Audio archive/restore command authority;
- Audio sound, transcript, chapters, and time-anchored review workspaces.

## Acceptance contract

This correction is complete only when:

1. primitive-compounding CI discovers Article, Playlist, and Audio as actual `AdminRecordActions` consumers;
2. no Article or Playlist local action renderer remains;
3. Audio Archive/Restore replays on a disposable Supabase preview from accepted main;
4. the permanent Audio lifecycle verifier passes on that preview;
5. generated `public,editorial` types and schema baseline are sealed from the same preview;
6. focused Admin, Player, Search, and Audio contract tests pass;
7. `npm run build:app` passes;
8. the PR CI is green before any production promotion.
