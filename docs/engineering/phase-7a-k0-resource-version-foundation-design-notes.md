# Phase 7A K0 Resource Version Foundation — Invariants

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
