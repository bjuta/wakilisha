# #1094 — actual-zero forward review authority (implementation gate A)

## Status

**In progress; no Production deployment authorized.** Scope is the 8 October 2026 CLI-named migration `20261008180201_public_music_identity_track_actual_zero_forward_review_authority_v1.sql`.

The active corpus is **39** current observations (17 open scoped reviews, 7 earlier B1-resolved slugs with forward semantic debt, 12 new structured-feature slugs without a scoped review, 3 synthetic clean-base slug collisions), *not* the original September 39-review opening count. The source-bound decision manifest hash is `8bfc9955215d40389e586eea46a2fa6300bed2e9e9fe958d622a92bcac350e58`.

## Gate A implemented

`admin_materialize_public_music_identity_feature_review_v1(track_id,expected_state_fingerprint)` is an authenticated, `manage_registry`-capability-bound, `SECURITY DEFINER` RPC. It takes a row lock and refuses stale or null fingerprints, non-active Tracks, historical scoped review ownership, missing structured featured/principal credit evidence, unchanged or still-feature-bearing semantic candidates, overlapping active/needs-review Artist routes, and active Chart/Community projections.

On successful manual invocation it inserts **only** one open `mizizi_data_hygiene` scoped review, with current slug, proposed semantic slug, normalized structured contributor evidence, caller, and exact state fingerprint. It intentionally does **not** record a human approval, invoke a canonical operation, or alter a Track, credit, Release, Chart, Community, provider link, or redirect. Existing Admin human decision RPC remains the next distinct authority.

The migration is an additive authority contract, not a data backfill. The 12 new Tracks must be individually verified against the pinned manifest and materialized by an authorized human/admin. A successful migration does not mean any reviews have been inserted.

## Required subsequent gates (not implemented in Gate A)

1. **Historical B1 forward evidence:** Seven earlier B1 review decisions are immutable. Establish narrow continuation using the existing open `track_recording_identity_conflict/1.3.0` reviews and recorded decision `relatedRecordingIdentityReviewId` before any safe semantic slug correction. Do not reopen or overwrite previous reviews.
2. **Synthetic base collisions:** `colors-1672b8`, `desire-2a895a`, and `ficha-1d71c1` collide with `needs_review` clean-base peer shells. Their matching Apple ID is supporting evidence, not autonomous identity authority. Materialize bounded human duplicate causality, then use existing `registry.track.duplicate_repair/v1` and `registry.track_slug.canonicalize` only after canonical grant, pointer evidence, receipts, and independent verification. Colors has Chart references on **both** sides.
3. **Credit-gaps and Route shape:** Keep the 12 existing credit-gap reviews open until credit evidence is resolved; a single primary Artist is **not** a universal invariant. Do not invent canonical identities for missing named collaborator credits or Release-level role contradictions.

## Acceptance requirements

- Fresh 39-row census and full v2 manifest rebind before any action.
- Static Vitest and existing permanent SQL verifier pass.
- Clean baseline schema replay plus additive migration replay in disposable Preview.
- Negative caller, stale fingerprint, review history, collision, credit, and pointer tests.
- Protected CI and exact schema seal.
- No Production schema or Registry writes until all gates are independently green and explicitly staged.

The same `scripts/control-plane/verify-public-music-identity-track-review-finalization-v1.sql` gate carries the new admission checks; no standalone verifier family.

## 9 October 2026 — Historical B1 read-only revalidation

A fresh Production **read-only** query isolates exactly seven active feature-bearing Tracks with one resolved scoped slug review and one still-open `track_recording_identity_conflict/1.3.0` review each:

| Current Track slug | Resolved scoped slug reviews | Open recording-identity reviews |
| --- | ---: | ---: |
| `freak-it-feat-doc-spot` | 1 | 1 |
| `furaha-remix-feat-arrow-bwoy-nadia-mukami-kristoff-dogo-janja-exray` | 1 | 1 |
| `intro-feat-juliani` | 1 | 1 |
| `ngoma-feat-jedi-keys-bigman-chucho` | 1 | 1 |
| `siri-feat-xenia-manasseh-mtm-thuo` | 1 | 1 |
| `steam-feat-kato-change` | 1 | 1 |
| `vaccine-feat-tugi-mlamba` | 1 | 1 |

This count is **not** a grant to mutate or reopen the seven settled reviews. The next implementation must bind the existing forward open recording review to the historical recorded decision and exact current state, then enforce independent canonical-operation receipts. No such mutation authority has been accepted yet.

The latest protected CI workflow, run `37890381341`, finished with `critical-browser=success` and `critical-core=failure` at `Enforce migration replay contract`. It must remain failing until a real linked Preview ledger and recorded proof exist; changing `live-schema-baseline.json` without that proof is prohibited.

### Verified historical decision linkage

Read-only inspection of `registry_canonicalization_decisions` confirms that **all seven** historical B1 scoped reviews have one `public_music_identity_distinct_recording` decision. For each, `decision.after_payload->>'evidenceRecordingIdentityReviewId'` matches the exact **still-open** `track_recording_identity_conflict` review ID for that Track (7/7 true). The link lives in `after_payload`, **not** in `decision.metadata`; any forward implementation reading `metadata.relatedRecordingIdentityReviewId` would falsely report missing causality. Preserve each immutable recorded decision, its original semantic distinction and peer evidence, and the existing unresolved recording-review lifecycle.
