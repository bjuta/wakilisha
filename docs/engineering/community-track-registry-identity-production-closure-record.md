# Community Track Registry Identity — Production Closure Record

## Status

**CLOSED — production accepted 2 September 2026.**

This record closes the Community Track identity convergence shipped through PR #785.

## Accepted authority

- merged application main: `75b42377a8bc676ae78588c588356ab4a6995bd4`
- production migration count: `79`
- production migration head: `20260901170500_community_track_registry_identity.sql`
- migration SHA-256: `2d60e8309421a5f74b085f9861b12b5e6bef051721335353ff31e49e213a0f6c`
- production frontend entry: `assets/index-CIyckr53.js`
- production frontend entry SHA-256: `66d5d645025d048693d4d8b24809bfbb9f30ffaf68be3dac376b6d4bd13ce93e`
- production frontend index SHA-256: `a6a7b5ea75a6c53b423972d92c1107d8cc6b4b96cac174124fc4fe7b3faa014c`
- complete accepted dist-tree SHA-256: `d06e3d3d84caecdb38b754cc1a04f1c9b522bda98ac942b8fff5d3ebd4358e68`
- rollback snapshot: `/opt/wakilisha-react-backups/community-track-registry-identity-75b42377`

## Product and identity result

Community Track discussion identity is now Registry-ID-first.

- durable identity is the canonical Registry Track UUID
- public Track grammar remains `/tracks/{artist-slug}/{track-slug}`
- same-slug Tracks under different Artists no longer collapse into one Community thread
- legacy Track threads are rebound only when deterministic
- canonical UUID plus mismatched Artist-scoped route fails closed rather than falling through to legacy compatibility
- non-Track slug uniqueness remains protected
- `(entity_type, entity_id)` remains the durable Community thread uniqueness boundary

## Preview proof

Disposable Supabase preview:

- project ref: `mnklyhthlyjmiegukaox`
- branch id: `888a914f-2e84-462d-8997-c1156dd92b7d`
- baseline: 78 migrations / `20260901114500`
- candidate apply: PASS
- resulting preview ledger: 79 / `20260901170500`
- permanent verifier: PASS
- rollback-only behavior proof: PASS
- fixture residue: 0

The preview was deleted after production acceptance. No paid preview branches remain.

## Production SQL acceptance

Repository migration promotion used only:

`bash scripts/control-plane/promote-repository-migrations.sh`

Production post-promotion state:

- all 79 repository migration versions present at matching timestamps
- zero pending repository migrations
- schema verification PASS
- no migration-history repair, raw SQL migration helper, or production history rewrite used

Permanent verifier result:

- `community_track_registry_identity_pass`
- Track threads: 1083
- Registry-bound Track threads: 910
- intentionally legacy-unbound compatibility rows: 173

The verifier does not require unsafe forced backfill of those 173 legacy compatibility rows.

## Frontend acceptance

Exact merged-main production build passed:

- focused Community contract: 7/7
- complete production build and build-output audits
- full staged artifact byte manifest
- remote stage/live byte parity
- Nginx validation
- direct-origin redirect-aware index and entry parity
- public HTTPS index and entry parity
- home route HTTP 200
- canonical Track route HTTP 200

Temporary deployment residue was removed only after public acceptance. The permanent rollback snapshot remains.

## Deployment classification

- SQL migration needed: No — live and accepted
- Supabase Edge Function deploy needed: No
- frontend deploy needed: No — live and accepted
- Production Finish update needed: No
- PR needed now: documentation reconciliation only
- preview needed: No — deleted

## Programme boundary

This is accepted adjacent Registry/public-identity work. It does not create a new numbered phase and does not reopen Phase 7A.

Phase 7B Public Video remains the current numbered phase.

Historical MIZIZI apply remains separate and unrun.
