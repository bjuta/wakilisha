# Phase 7A K4C-P3: Playlist Pointer Compatibility Retirement Implementation Audit

Status: PREVIEW SEALED - READY FOR PRE-PR PROMOTION

Opened: 27 August 2026

Accepted main at implementation open:

`9df0198d87e4ff939f55ce7b245a676a08d1947e`

Accepted production migration head at implementation open:

`20260827182809_phase_7a_k4c_p2_playlist_pointer_writer_convergence`

Accepted production migration count at implementation open:

`57`

Design authority:

`docs/engineering/phase-7a-k4c-playlist-command-convergence-design.md`

## Purpose

K4C-P3 retires the Playlist half of K1 lifecycle-position duplication after
K4C-P1 moved Playlist event authority to shared Resource ledgers and K4C-P2
moved all governed Playlist pointer writes to
`editorial.resources.current_*_version_id`.

P3 removes the four typed pointer columns from:

`editorial.playlist_resources`

without modifying Audio pointer compatibility.

## Production-sealed P2 baseline

At P3 open:

- production migration count: 57
- production migration head: `20260827182809`
- K4C-P2 permanent verifier: PASS
- governed direct Playlist typed-pointer writers: 0
- Playlist pointer parity drift: 0
- typed Playlist event writers: 0
- only remaining typed Playlist pointer writer:
  `editorial.sync_typed_lifecycle_from_resource()`
- production Supabase previews from P2: deleted
- P2 local deployment worktree: removed

## True remaining Playlist reader surface

A broad function scan initially found 22 functions mentioning
`playlist_resources` and lifecycle-pointer field names.

Alias/row-variable analysis narrowed the true typed-pointer reader surface to
17 functions:

1. `public.archive_playlist`
2. `public.create_playlist_preview_link`
3. `public.create_public_playlist_missing_track_submission`
4. `editorial.copy_playlist_working_trust_to_working_successor`
5. `editorial.list_current_public_person_work`
6. `editorial.playlist_working_trust_target`
7. `editorial.require_exact_working_snapshot_for_curated_submission`
8. `public.get_public_playlist`
9. `public.list_public_playlists`
10. `private.community_get_reaction_state_for_public_targets_legacy_m7`
11. `private.community_resolve_save_target`
12. `public.publish_playlist_version`
13. `public.restore_playlist_from_archive`
14. `public.save_resource_version_editorial_metadata`
15. `public.schedule_playlist_publication`
16. `public.snapshot_playlist_working_version`
17. `public.unpublish_playlist`

Five broad-scan functions are already canonical and do not require P3 reader
rewrites:

- `public.get_playlist_review_workspace`
- `public.publish_due_playlist_publications`
- `public.review_playlist`
- `public.submit_playlist_for_review`
- `public.unschedule_playlist_publication`

No `src/` browser code directly reads the typed Playlist pointer columns.

## Schema dependency surface

Production retains exactly four typed Playlist pointer columns:

- `current_working_version_id`
- `current_submitted_version_id`
- `current_approved_version_id`
- `current_published_version_id`

They carry exactly four composite foreign keys to
`editorial.playlist_versions`:

- `playlist_resources_working_version_fkey`
- `playlist_resources_submitted_version_fkey`
- `playlist_resources_approved_version_fkey`
- `playlist_resources_published_version_fkey`

No view, materialized view, policy, or index depends on these columns.

## K1 trigger boundary

The shared typed-to-Resource helper is used by two triggers:

- Playlist:
  `playlist_resources_sync_shared_lifecycle`
- Audio:
  `audio_publication_resources_sync_shared_lifecycle`

P3 removes only the Playlist trigger.

The shared helper:

`editorial.sync_resource_lifecycle_from_typed_binding()`

must remain byte-identical because Audio still uses it.

Accepted MD5:

`1a9a366b7a26d023aa589767a2024651`

The Resource-to-typed helper:

`editorial.sync_typed_lifecycle_from_resource()`

currently contains both Playlist and Audio branches.

Accepted pre-P3 MD5:

`4f52dd85356906f9f6fb2e9dcd24551a`

P3 removes only its Playlist branch. The exact expected Audio-only definition
MD5 is:

`619a2bd22f9066594f84dada7a119902`

The Resource trigger
`resources_sync_typed_lifecycle_compatibility` remains because Audio still
needs reverse synchronization.

## Audio do-not-touch seal

Production evidence at P3 open:

- Audio typed pointer columns: 4
- Audio pointer parity drift: 0
- Audio binding rows: 2
- Audio binding fingerprint:
  `c17ca0cd697903d0a61a7ed2e4a9fb51`
- typed-to-Resource helper MD5:
  `1a9a366b7a26d023aa589767a2024651`

The shared editorial metadata RPC must move only its Playlist working-pointer
read to `editorial.resources`. Its Audio branch must continue reading and
writing `editorial.audio_publication_resources.current_working_version_id`.

## Playlist data seal

Production Playlist binding rows: 3.

Fingerprint of complete Playlist binding data excluding the four retiring
pointer columns:

`2bb4d0072dfee1fe94774a5046be1a59`

P3 must preserve this fingerprint.

## Function-security seal

The 17 reader functions have:

- exact accepted definition hashes pinned in the migration preflight
- combined owner / SECURITY DEFINER / search-path metadata MD5:
  `e19fe333693147b6c9e38f009eb4fe19`
- semantic ACL MD5:
  `e6cb95df88445a397e83e00733882b9f`
- ACL rows: 43

The migration snapshots function owner, SECURITY DEFINER state, config/search
path, and ACL before rewrite and requires exact equality afterward.

## Rewrite strategy

P3 follows the P2 fail-closed pattern instead of copying complete function
bodies.

Seven row-reader functions receive:

1. one `editorial.resources%rowtype` variable
2. a joint binding + Resource read/lock
3. exact replacement of `v_binding.current_*` reads with
   `v_resource.current_*`

Ten remaining inline readers use exact accepted fragment substitutions.

Every replacement requires the accepted old fragment count before executing
the otherwise unchanged `pg_get_functiondef` body.

## Column retirement sequence

Only after all readers are rewritten:

1. narrow `sync_typed_lifecycle_from_resource()` to Audio only
2. drop `playlist_resources_sync_shared_lifecycle`
3. drop the four Playlist pointer foreign keys
4. drop the four Playlist typed pointer columns without CASCADE
5. prove non-pointer Playlist data unchanged
6. prove Audio compatibility unchanged

## Preview acceptance

A fresh disposable preview must first replay all 57 accepted migrations through
K4C-P2.

Only after baseline replay is healthy may P3 apply.

Post-apply proof must include:

- zero Playlist typed pointer columns
- zero Playlist typed pointer readers
- zero Playlist typed pointer writers
- Playlist typed-to-Resource trigger absent
- Resource-to-typed helper Audio-only
- shared Resource-to-typed trigger retained
- Audio typed-to-Resource trigger retained
- Audio typed pointer columns remain 4
- Audio pointer parity drift remains 0
- Audio binding fingerprint unchanged
- Playlist non-pointer fingerprint unchanged
- P1 shared-event authority remains canonical
- typed Playlist event writers remain 0
- typed Video event authority remains absent
- all changed function ACL/security metadata preserved
- generated public/editorial types reflect the four removed Playlist fields
- no frontend implementation change required

Behavioral rollback fixtures should exercise at minimum:

1. working snapshot reuse/new snapshot
2. preview-link default version resolution
3. Discovery metadata successor
4. schedule / direct publish / unpublish / archive / restore
5. public Playlist lookup/list
6. public missing-track submission eligibility
7. Trust current-working checks
8. community public-target/save-target resolution
9. Audio working metadata path unchanged

## Non-goals

K4C-P3 does not:

- drop Playlist typed review/lifecycle event history tables
- remove Audio typed pointer columns
- remove the Audio typed-to-Resource trigger
- remove the shared Resource-to-typed trigger
- modify Article authority
- modify Video authority
- change Playlist browser contracts
- change frontend code
- deploy Edge Functions
- update Readdy
- remove `wk_playlists.status`

## Deployment boundary

Current candidate phase:

- SQL migration needed: Yes, preview-proven and ready for PR
- canonical migration filename minted: Yes
- Supabase Edge Function deploy needed: No
- Readdy Finish update needed: No
- frontend deploy needed: No
- generated database types expected to change after preview: Completed from canonical preview
- production mutation: No
- PR ready: Yes after exact-scope commit and push

## Exit condition

K4C-P3 closes when:

- all live Playlist functions consume canonical Resource lifecycle pointers
- four Playlist typed pointer columns are physically removed
- Playlist typed-to-Resource synchronization is retired
- Resource-to-typed synchronization no longer includes Playlist
- Audio compatibility remains intact
- preview/replay/production proof is sealed

## Preview compile correction

The first canonical-preview P3 apply attempt stopped transactionally before the
migration was recorded.

PostgreSQL returned:

`record variable cannot be part of multiple-item INTO list (SQLSTATE 42601)`

The rejected generated reader shape was:

`select binding, resource into v_binding, v_resource ...`

Both targets are `%rowtype` composite variables, which PL/pgSQL does not allow
in one multi-item `INTO` target list.

The corrected fail-closed reader mechanism keeps the same joint
Playlist-binding + canonical-Resource query and lock, but reads both composite
rows into one `record` variable:

- `select binding as binding_row, resource as resource_row`
- `into v_pair`
- `v_binding := v_pair.binding_row`
- `v_resource := v_pair.resource_row`

A canonical-preview transactional probe proved this composite-pair assignment
pattern before the candidate was changed.

The failed apply rolled back completely:

- preview migration count remained 57
- preview migration head remained K4C-P2 (`20260827182809`)
- all four Playlist typed pointer columns remained
- Playlist synchronization trigger remained
- reverse-sync helper MD5 remained
  `4f52dd85356906f9f6fb2e9dcd24551a`
- production remained untouched

## Preview exact-rewrite guard correction

The second canonical-preview P3 apply attempt also stopped transactionally
before migration history advanced.

The row-reader compile correction passed. The apply then stopped on the
migration's own fail-closed exact-rewrite guard:

`STOP: K4C-P3 canonical replacement already exists in editorial.list_current_public_person_work(uuid)`

The guard was too broad. It rejected a function whenever the replacement token
already appeared anywhere else in the function body, even when the exact old
typed-pointer fragment was still present at the expected count.

Live canonical-preview inspection proved:

- rewrites 10 through 70: expected old fragment present exactly once;
  replacement fragment absent
- rewrite 80 (`editorial.list_current_public_person_work`):
  old token present exactly twice; canonical token already present twice in
  unrelated canonical Resource reads
- rewrites 90 and 100:
  old token present exactly once; canonical token already present twice in
  unrelated canonical Resource reads

The correct fail-closed authority is the exact old-fragment occurrence count,
which was already enforced immediately before the redundant guard.

The redundant "new fragment already exists somewhere in the function" check
was therefore removed. The exact old-fragment count remains mandatory before
every replacement.

A canonical-preview transaction proved the corrected entire exact-rewrite block
and rolled it back with marker:

`K4C_P3_EXACT_REWRITE_GUARD_FIX_PASS`

Production remained untouched.

## Canonical preview acceptance seal

Canonical preview:

- project ref: `sgkhsyrlcfrpvgafmvit`
- branch id: `af065b45-40d6-49e1-b563-a40287d300c5`
- migration count: 58
- migration head: `20260827205119`
- migration SHA-256:
  `6e45c4b377c6d1d07f52b3c54bb9fd71e3990804016a520233d19851980c3184`
- generated database types SHA-256:
  `b881539a4d8b8d09c3eb44301757320d80b820222c79c37634145a9b9b6acb3f`
- replay proof SHA-256:
  `e2edb17d55d3510f2141a2d1ab90386ecfbc9e5f3f428f29b9c50528a0f1c8ce`
- live-schema baseline SHA-256:
  `66a6531e78c75a6e81248c23b30fe640cd3018032c5406e9cd96331f7a63213a`

The preview was first reduced to a true WAKILISHA application-zero state and
source-replayed through all 57 accepted K4C-P2 migrations before P3 was
allowed to apply.

The source-replayed 57/K4C-P2 baseline matched production across the complete
18-function P3-sensitive security and ACL surface before candidate apply.

P3 then reached 58 migrations / `20260827205119` with zero pending.

Permanent verifier:

`PHASE_7A_K4C_P3_PLAYLIST_POINTER_COMPATIBILITY_RETIREMENT_PASS`

Independent structural acceptance:

- Playlist typed pointer columns: 0
- Playlist typed-to-Resource compatibility trigger: 0
- Playlist `v_binding.current_*` readers: 0
- typed Playlist event writers: 0
- Audio typed pointer columns: 4
- Audio pointer parity drift: 0
- Audio typed-to-Resource trigger: 1
- shared Resource-to-typed trigger retained: 1
- typed-to-Resource helper MD5:
  `1a9a366b7a26d023aa589767a2024651`
- Audio-only Resource-to-typed helper MD5:
  `619a2bd22f9066594f84dada7a119902`
- typed Video review/lifecycle tables: absent

Changed/sensitive function execution perimeter is byte-sealed against
production:

- security metadata MD5:
  `ebc1e24dc0821df353c25f06d2793b7a`
- ACL MD5:
  `a858636aaa88b6337eb483f8d4f570ca`
- ACL rows: 44

Rollback-safe runtime fixture:

`K4C_P3_RUNTIME_ROLLBACK_FIXTURES_PASS`

The fixture proved:

1. a valid Playlist Resource and working Resource Version can set
   `editorial.resources.current_working_version_id` after the typed Playlist
   pointer columns are gone
2. `editorial.playlist_working_trust_target` resolves that canonical working
   pointer correctly
3. canonical Resource -> typed Audio working-pointer synchronization remains
   live
4. typed Audio -> canonical Resource working-pointer synchronization remains
   live
5. all deferred binding/version integrity constraints pass when forced
   immediate
6. the transaction rolls back with zero fixture residue

Advisor acceptance after P3 and the rollback fixture:

- security: 693 total = 108 INFO / 585 WARN
- performance: 1196 total = 961 INFO / 235 WARN
- preview-only security WARN/ERROR versus production: 0
- preview-only performance WARN/ERROR versus production: 0
- the additional performance INFO findings are empty-preview unused-index
  noise, not P3 regressions

The full final migration body was also executed once against the canonical
preview with only its terminal `COMMIT` replaced by `ROLLBACK` before the
native apply. The full transactional rehearsal passed and left migration
history at 57/K4C-P2 with P3 still pending before the successful native apply.
