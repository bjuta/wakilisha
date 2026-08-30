# Phase 7A K0 Resource Version Foundation — Invariants

## Current-state reconciliation — 30 August 2026

**The kernel movement described in this document is closed.**

Current authority is recorded in
`docs/engineering/phase-7a-kernel-closure-record.md`.

The accepted kernel baseline is production **64/AR3**:
`20260830070752_phase_7a_k4c_ar3_article_cross_system_reader_convergence_typed_event_retirement`.

Playlist and Audio typed lifecycle pointer compatibility is physically retired.
Playlist/Audio typed event writers are retired.
Article typed lifecycle readers/writers are retired.
Video uses the shared Resource kernel directly and has no typed lifecycle/review ledger.

A bounded post-kernel hardening candidate at commit
`79b26e4c8db83fe178459c4c497c8fbc8714bb2b`
repairs two separately tracked business-logic defects and freezes retained typed
event tables as inaccessible historical evidence. It does **not** reopen this
kernel milestone.

Any older `Status`, `Current boundary`, `Next test`, production migration
count, or preview instruction below is historical evidence for that checkpoint,
not the current programme state.


This file records the implementation invariants before SQL is added.

1. `editorial.resource_versions.id` must equal the existing typed domain version UUID.
2. `editorial.resource_versions.resource_id` is the stable WAKILISHA Resource identity.
3. `editorial.resource_versions.version_type` is controlled vocabulary, not an arbitrary application string.
4. `editorial.resource_versions.version_kind` preserves lifecycle snapshot kind where the typed domain exposes it.
5. `editorial.resource_versions.version_number` preserves the typed domain sequence where one exists.
6. `editorial.resource_versions.content_fingerprint` preserves the typed immutable snapshot fingerprint where one exists.
7. Registration is additive and idempotent. A conflicting attempt for an existing version UUID must fail.
8. K0 must not become the content authority. Domain tables remain authoritative for payload shape and immutability.
9. K0 must not alter `editorial.resources.current_*_version_id` constraints or values.
10. K0 must not alter `editorial.playlist_resources.current_*_version_id` or `editorial.audio_publication_resources.current_*_version_id`.
11. Existing shared `target_version_type` values remain accepted during K0; migration of shared consumers to Resource Version FK authority is a later convergence step.
12. No browser role receives direct write access to Resource Version authority.
13. Resource Version actor provenance preserves the historical actor UUID without a live Auth foreign key that could mutate the immutable envelope during account retirement.
