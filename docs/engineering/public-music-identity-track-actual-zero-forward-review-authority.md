# Public Music Identity #1094: governed Track review admission

**Implementation candidate. Not deployed or accepted.**

## Corrected architectural ownership

No parallel Admin review materialization RPC. Extend the established `mizizi_private.queue_registry_review_v1` broker under its existing `mizizi_executor` authority. The accepted generic broker uses slug rule version `1.2.0`, while the accepted #1094 Admin decision/finalization contract requires `track_slug_identity_noise/1.1.0`. Both ends must change together. The separate `track_slug_credit_evidence_gap/1.3.0` and recording-identity broker remains unchanged.

The additive, CLI-minted migration `20261008180201_public_music_identity_track_actual_zero_forward_review_authority_v1.sql` changes the existing broker to admit only high-confidence, structurally evidenced Track feature-credit noise at rule version 1.1.0. It leaves the 1.2.0 generic lane intact, preserves MIZIZI-only execution, and does not grant the actor new canonical mutation rights. Repeat submission of the same still-open 1.1.0 finding returns the existing review; changed fingerprints and historical resolved/credit-gap review ownership fail closed.

The existing `analyzeTrackIdentity` emits 1.1.0 for `track_slug_identity_noise` findings. In both review and apply modes the MIZIZI runner queues structurally proven feature-slug debt through its existing `queueReview` entrypoint, instead of automatically rewriting an active public identity. The runner reads *all* historical scoped slug/credit reviews (including resolved ones) and refuses duplicate admissions. The broker independently rejects historical review ownership, current recording-review ownership, missing structured featured/principal evidence, stale/current or incorrect semantic candidates, same-Artist route collisions, and current Chart/Community projections.

This is review creation only, not human approval, duplicate judgment, automatic canonical repair, or a grant. Continue to use existing `admin_record_public_music_identity_track_review_decision_v1`, MIZIZI mutation operations, independently verified receipts, and finalization.

## Current evidence and explicit remaining work

The 8 October read-only Production census covered **39 current cases**: 17 already-open scoped reviews (5 identity-noise, 12 credit-gap), seven B1-resolved feature-slug Tracks with forward debt and open recording reviews, 12 new feature-bearing Tracks with no scoped review, and three synthetic suffix/clean-base peer collisions. These are *not* the original September 39-review opening count.

The twelve new candidates have structured featured and principal evidence, a changed semantic candidate under the accepted writer, zero Chart/Community projections and zero same-Artist target route collisions. An authorized MIZIZI review run must still prove the exact expected admissions and zero canonical changes; no Production review was created in this implementation work.

All seven historical B1 decisions are `public_music_identity_distinct_recording`, with exact open recording review IDs in `after_payload.evidenceRecordingIdentityReviewId` (7/7 match). Do not reopen their resolved scoped slug reviews. Recording review causality must be reconciled with their stored semantic-distinction and peer evidence before any forward canonical operation.

The three synthetic collisions `colors-1672b8`, `desire-2a895a`, `ficha-1d71c1` each have a `needs_review` clean-base shell and matching Apple Music Track ID. Earlier identity evidence associated the corresponding Apple Music Track IDs, but direct current provider-link coverage is asymmetric: the active Colors Track has no Apple link while its clean-base peer does, and the DESIRE and Ficha clean-base peers have no Apple links while their active counterparts do. Absence of a direct link must not be reinterpreted as a different recording. Provider identity still requires reviewed provenance and a human duplicate decision. Use only the accepted `registry.track.duplicate_repair/v1` and `registry.track_slug.canonicalize` authority after a bound human decision, exact grant, route-peer review, and independent Chart/Community/provider/Release/redirect receipt verification. Colors has current Chart pointers on both identities (9 active synthetic + 8 clean-base peer); DESIRE has 17 active Chart pointers and one Community thread, and Ficha has six active Chart pointers. These surfaces must be reconciled by the accepted engines, not overwritten directly.

## Exit gates

1. Validate broker versioning and executor isolation, a clean 12-candidate review-only run, stale-fingerprint refusal, resolved-review refusal, no-feature and collision refusal, idempotence, and zero canonical mutation in Preview.
2. Record a genuine linked-Preview replay proof and update generated database types and the preview schema seal via the repository's **existing** recorder. Never invent these artifacts or bypass the migration replay gate.
3. Human-govern the outstanding 17 open scoped reviews, B1 forward decisions, and three synthetic pairs through existing Registry authorities. Do not auto-resolve human semantic or collaborator-credit ambiguities.
4. Verify all current pointers, provider identities, historical redirect evidence, public route continuity, no active feature-noise/synthetic debt, and no open scoped reviews. Run the existing `public-music-identity-track-actual-zero-audit.mjs` in `assert-zero` mode.
5. Protected CI, verification SQL and Production acceptance must be complete before merging the full slice or closing #1094 and parent #1068.

No Production mutation or deployment is authorized by code staged here.

## Human authority receipts and execution boundary — 9 October 2026

**Explicit approved instructions (do not re-decide):** the twelve SoFresh 254 clean-slug proposals (#1094 issue-comment 6076248565), preserving every recorded featured credit; and D1/D2/D3 same-recording judgments (#1094 issue-comment 6077120942), retaining the active suffix-bearing Track UUID as survivor of each pair, with later clean-slug canonicalization. These are human intent receipts, not authenticated Registry decisions or Production mutation grants.

**Provider research, not yet authenticated approval:** B1–B12 credit/role findings (#1094 issue-comment 6076785407) and C1–C5 identity/billing findings (#1094 issue-comment 6076846479). They establish supporting evidence and candidates. They do **not** automatically authorize co-primary credit rewrites, retirement, or new recording distinctions. Bind to exact provider/Artist identities and use the existing Admin decision path.

**Seven historical B1 recording decisions:** retain the seven stored `public_music_identity_distinct_recording` decisions whose `after_payload.evidenceRecordingIdentityReviewId` matches still-open recording reviews. No recreation or re-approval of the settled decisions.

**Critical original issue constraint:** #1094 requires **zero new Track/Release redirect rows**, historical redirect evidence unchanged, and no new compatibility service. All accepted duplicate/slug operations must be proved compatible with this boundary before any execution. A proposal to create fresh redirects is NOT accepted by the issue even if it appeared in a previous research comment. Chart/Community/provider pointer continuity, canonical lineage and public route behavior still require verification.

**Release status:** no Preview branch currently provisioned, no actual Preview replay proof, no generated schema seal/types for the proposed SQL, no Production mutation. Stage and test the full implementation through the established deployment workflow before advancing the draft PR. No CI bypass.
