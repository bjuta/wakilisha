# WAKILISHA Programme Status

## Phase 7B closure reconciliation - 3 September 2026

**Phase 7B Public Video product is CLOSED and production accepted.**

The real exit-gate Video remains `Monday Morning in September`.

Final accepted production authority:

- runtime main: `b0ffd4718094e9cca8d66de711cdc8e27a448548`
- migrations: `83`
- migration head: `20260903085155_phase_7b_public_video_transcript_authority.sql`
- frontend entry: `assets/index-cocVN-2T.js`
- frontend entry SHA-256: `535c06db6538bb25ff3e8f8dcf01f821f71a6022c74c541e6f09a37489a85d9b`
- frontend index SHA-256: `f183a37a2a03ded8b3b70519c8560d065af8f59ad5c245dfae6c9bfa2b4a8984`
- frontend dist-tree SHA-256: `7f1dc4a1a889d9c996231b14cd2f4cd776d436e37d0047aabd8225c8580090f2`
- Edge Function `video-public-delivery`: ACTIVE v8
- final published Video: v16, `4ab5a5bb-b0f4-4b8b-8ea2-94fe1be8786e`

The accepted exit proof includes:

- HLS master plus governed 360p and 720p renditions with MP4 fallback
- desktop/mobile playback, settings, quality, captions, and fullscreen acceptance
- governed public transcript authority and protected TXT delivery
- real transcript presentation on the public Video
- corrected Sheng caption through a fresh immutable working, submitted, approved, and published lifecycle
- desktop/mobile proof that the corrected 00:12 through 00:14 cue appears and expires correctly
- preserved historical v12 caption authority
- final disposable transcript preview deletion

Canonical closure record:

- `docs/engineering/phase-7b-closure-record.md`

**Current numbered work is now Phase 8: Field Capture.**

## Current production reconciliation - 2 September 2026

The latest production-accepted runtime main is:

`a2331f8b521ed19b451f148c8b53721e51747aca`

Current production authority:

- migrations: `80`
- migration head: `20260902205000_phase_7b_v4a_adaptive_video_media_foundation.sql`
- frontend entry: `assets/index-CIyckr53.js`
- frontend entry SHA-256: `66d5d645025d048693d4d8b24809bfbb9f30ffaf68be3dac376b6d4bd13ce93e`
- frontend index SHA-256: `a6a7b5ea75a6c53b423972d92c1107d8cc6b4b96cac174124fc4fe7b3faa014c`
- frontend dist-tree SHA-256: `d06e3d3d84caecdb38b754cc1a04f1c9b522bda98ac942b8fff5d3ebd4358e68`
- rollback snapshot: `/opt/wakilisha-react-backups/community-track-registry-identity-75b42377`

The current accepted adjacent Registry/public-identity work includes:

- one-track public identity convergence through PRs #771, #775, #777, #778, and #780
- MIZIZI preventive Track identity authority through PRs #772 and #774
- historical MIZIZI Track identity apply accepted through PR #793 and governed run #28: 440 repairs / 66 blocked reviews / 857 MIZIZI redirects
- historical MIZIZI Release taxonomy apply accepted through PR #797 and governed run #9: 32 writes / 0 remaining candidates / 11 EP to Single / 19 Album to EP / 2 EP to Album
- Release taxonomy and Single public-destination convergence through PR #781
- orphan Release-membership target integrity through PR #782
- canonical Track public route remains `/tracks/{artist-slug}/{track-slug}`
- Registry UUID remains internal identity and does not replace the public Track route grammar
- Community Track discussion identity is now Registry-ID-first through PR #785
- same-slug Tracks under different Artists retain distinct Community threads
- canonical Track UUID plus mismatched Artist-scoped route fails closed
- production Community identity acceptance is recorded in `docs/engineering/community-track-registry-identity-production-closure-record.md`

Release taxonomy is now:

- 1 resolvable active Track: Single
- 2 through 6 resolvable active Tracks: EP
- 7 or more resolvable active Tracks: Album

Singles remain Release records and remain visible in Releases, Artist Discography, and Appears On, but they do not own a dedicated Release detail page. Their public destination is the one canonical Track.

Production acceptance is recorded in:

- `docs/engineering/release-taxonomy-membership-integrity-closure-record.md`

Historical MIZIZI Track apply and historical Release taxonomy apply are both production accepted and closed.

Canonical historical MIZIZI closure records:

- `docs/engineering/mizizi-historical-track-production-closure-record.md`
- `docs/engineering/mizizi-historical-release-taxonomy-production-closure-record.md`

## Phase 7A closure reconciliation - 31 August 2026

**Phase 7A Video publication authority is CLOSED and production accepted.**

The Resource-kernel movement, post-kernel hardening, K5A, K5B, K5C, K5D, K5E, and the real Video exit-gate follow-through are accepted baseline.

The real Phase 7A exit-gate Video is `Monday Morning in September`.

Final immutable lifecycle:

- working v5
- submitted v6
- approved v7
- published v8

The final published v8 preserves exact native Media source authority and one governed Sheng closed-caption track with language tag `und-x-sheng`.

Final production authority:

- accepted production/frontend main: `a8e10350dccd5a5b1cd5b49001a4cf8839a76bd9`
- production migration count: `75`
- production migration head: `20260831080826_video_caption_language_private_use_tags`
- production frontend entry: `assets/index-S6v7xwyD.js`
- production frontend entry SHA-256: `e878fec7815bfd014c50d3f3273259f5f74e5aeb63a3f918060bb1f0eb16ae74`

The real exit path exposed bounded gaps in Media governance placement, native source integrity, deferred Resource binding authority, post-publication revision UI, review-action lineage, and private-use caption language tags. Each was repaired without creating competing Video-owned authority or weakening the publish safety gate.

Canonical Phase 7A closure record:

- `docs/engineering/phase-7a-closure-record.md`

The immediate numbered work is now **Phase 7B: Public Video product**.

Status date: 31 August 2026

Phase 7A closure migration head: `20260831080826`

Phase 7A closure migration count: `75`

## Status authority

This file is the current status overlay for `docs/institute/two-workspace-pilot-audit-and-build-plan.md`.

The long-form plan remains the architectural, product-doctrine, phase-scope, engineering-rule, and five-year durability authority.

Where the long-form plan's current phase, immediate next implementation, or completion status conflicts with this file, use this file.

The compact navigation view is `docs/roadmap/wakilisha-master-programme-map.md`.

## Current numbered work

**Phase 8: Field Capture**

Phases 0 through 7B are closed.

Phase 6B Public Audio closed by explicit programme decision on 25 August 2026. The former real-podcast exercise is retained as non-blocking Audio operational acceptance and is not falsely recorded as completed.

Current references:

- `docs/engineering/phase-7b-closure-record.md`
- `docs/roadmap/wakilisha-master-programme-map.md`
- `docs/engineering/charts-public-source-accessibility-soak-wip.md`
- `docs/engineering/primitive-compounding-contract.md`

Production opening baseline for 7A:

- repository main: `dae3de2dc9fb021496eb0fe0c4d4f0338f676a88`
- migrations: `50`
- migration head: `20260825102000`
- frontend entry: `assets/index-COVa-f0y.js`

## Phase 5 closure

### Phase 5A: Canonical Playlist authority

Complete through PR #587 and PR #588.

### Phase 5B: Public Playlist product

Complete through the production acceptance sequence that followed the initial Phase 5B product shipment.

Evidence includes PR #590 through PR #599, including the first governed publication of `Top 50 Kenyan Songs Of 2025`, public product delivery, Registry canonicalization, lifecycle parity, exact version-bound Preview, and published-update review continuity.

The Phase 5 programme exit gate was:

> one real Playlist is reviewed and published end to end

That gate is satisfied.

## Post-Phase-5 Interlude

After the Playlist exit gate, WAKILISHA moved through adjacent product and platform work before returning to the numbered programme.

That accepted baseline includes:

- Registry-led onboarding
- universal Posts and the desktop application shell
- Community social graph
- Personal Playlists
- Track curation reach
- canonical Post Track and rich Link attachments
- Post Drafts and authored Threads
- canonical mentions and Notifications
- migration-history and public-read hardening
- Article Author to Person convergence
- governed account identity retirement
- Organization identity and public repertoire
- Article and Artist prerender reliability

The detailed ledger remains `docs/roadmap/post-phase-5-interlude-ledger.md`.

## Phase 6A closure

Phase 6A now provides the accepted internal Audio system:

- Show, Season, Episode, and Standalone Audio identity
- typed Resource bindings and Audio capabilities
- immutable Audio versions
- full-length governed Audio delivery
- exact master/revision binding
- Chapters and Transcript Media binding
- shared Credits and Citations
- Review and publication lifecycle
- stable GUID and enclosure identity
- canonical Audio Admin Studio collection and editor
- lifecycle History
- Audio Editorial Workbench
- canonical waveform and technical Media context
- time-point and time-range submitted-version review
- rich comments/replies and resolve/reopen workflow

PR #683 merged the final Audio Editorial Workbench. The migration `20260821095406_audio_editorial_workbench_time_anchored_review.sql` is live in production. Production closed at 37 migrations with zero pending repository migrations.

Authenticated browser acceptance passed, and the final disposable Supabase preview was deleted after closure.

Admin Studio convergence across Article, Playlist, and Audio is also accepted. Its reusable residue is now governed by the Primitive Compounding Contract.

## Phase 6 closure

### Phase 6A — Audio publication authority and internal editorial product

**CLOSED.**

The accepted Phase 6A authority remains documented in:

`docs/engineering/phase-6a-closure-record.md`

### Phase 6B — Public Audio product

**CLOSED 25 AUGUST 2026.**

M1 and M2 remain closed. Their production corrections and the post-M2 convergence programme through PR #706 are accepted baseline.

The earlier real-podcast exercise was retired as a programme-blocking gate by explicit programme decision. It was not falsely marked completed; `Monday Morning in September` remained a draft at closure. The exercise remains available as non-blocking Audio operational acceptance.

Canonical record:

`docs/engineering/phase-6b-closure-record.md`

## Tracked adjacent WIP: Kenya Charts public-source durability proof

**WIP / ATTEMPT 2 RUNNING.**

This work remains intentionally outside the numbered programme sequence. It does not advance Phase 8 and must not be treated as numbered programme progress.

The research is testing whether WAKILISHA can operate a long-lived Kenya-first chart from public or ordinary developer-accessible music evidence without requiring privileged DSP data relationships.

Empirical access probes on 24 August 2026 established successful Kenya-specific public access for Apple, YouTube, Mdundo, Audiomack, Boomplay, and Shazam. Spotify remains optional/non-core because the tested public Kenya CSV route returned an HTML shell rather than a proved chart dataset.

The first seven-day soak attempt is formally invalidated.

It started at `2026-08-24T13:52:43Z`, captured only two runs across 6.77 hours, then falsely finalized because the controller compared elapsed seconds with `7*24`, a threshold of 168 seconds instead of 604800 seconds. The two raw observations remain valid short-term accessibility evidence, but they do not constitute a durability proof.

Attempt 1 was preserved before repair. The original capture SHA-256 values are:

- `20260824T135243Z.json`: `1f024bb765afb22c19b140065502650a7ecee01a3b1180e246c81594e92ff883`
- `20260824T203856Z.json`: `d394bd450ba1f71a3155dfb8668734aec199454ab52f1855038b77d65d34ae59`

The repaired controller now uses the exact seven-day threshold `7*24*60*60 = 604800` seconds. Before any new source request, attempt 2 passed syntax, static, plist, empty-state, not-loaded, and synthetic boundary checks including 167:59:59 false and exactly 168 hours true.

Attempt 2 is now the authoritative running soak.

- start UTC: `2026-09-03T12:29:31Z`
- start Africa/Nairobi: 3 September 2026 at 15:29:31 EAT
- seven-day boundary UTC: `2026-09-10T12:29:31Z`
- seven-day boundary Africa/Nairobi: 10 September 2026 at 15:29:31 EAT
- cadence: every 6 hours
- LaunchAgent: `africa.wakilisha.chart-source-soak-v2`
- local root: `~/Library/Application Support/WAKILISHA/chart-source-soak-v2`

Attempt-2 first observation:

- Apple: HTTP 200, parse pass, depth 100
- YouTube: HTTP 200, parse pass, depth 100
- Mdundo: HTTP 200, parse pass, depth 100
- Audiomack: HTTP 200, parse pass, depth 100
- Boomplay: HTTP 403, parse fail
- Shazam: HTTP 200, parse pass, depth 200

The Boomplay 403 remains in the experiment unchanged. It is evidence about source durability and must not be patched away during the soak.

Controller state after the first attempt-2 capture proved:

```text
SOAK_ELAPSED_HOURS=0.01
SOAK_RUN_COUNT=1
SOAK_WINDOW_COMPLETE=NO
STDERR_EMPTY=PASS
COMPLETE_MARKER_ABSENT=PASS
SOAK_V2_STARTED=PASS
```

Do not restart, manually trigger, reset, rewrite, or remove a source from attempt 2 unless a separate diagnosed control-plane failure requires it. Do not close or redesign the chart methodology before the completed seven-day evidence bundle is analyzed.

Known follow-up remains unchanged: raw observations can prove the same recording across multiple source records and providers while downstream candidate `source_count` still resolves to `1`. Repair independent observation-source identity through the existing ingestion/scoring pipeline before changing the scoring formula.

Provider genres remain non-authoritative. WAKILISHA Registry genre authority must continue to decide cultural classification and chart eligibility.

Canonical WIP record:

- `docs/engineering/charts-public-source-accessibility-soak-wip.md`

The WIP closes only after attempt 2 is analyzed into a Green / Amber / Red viability decision, source qualification grades, single-source-loss degradation behavior, evidence-plumbing repairs, and the recommended Kenya chart source constitution.

## Phase 7B V4A adaptive Video production acceptance

Phase 7B V4A is **CLOSED / production accepted**.

Accepted V4A authority:

- PR #800 merged at `a2331f8b521ed19b451f148c8b53721e51747aca`
- PR Critical #911: PASS
- protected-main Critical #912: PASS
- Primitive Compounding contract: PASS
- production migrations: 80
- production migration head: `20260902205000`
- canonical Media processing profiles are now shared authority for Audio publication delivery and adaptive Video
- no Video-specific processing RPC was created
- Audio compatibility functions delegate to the shared processing-profile primitive
- production Media processor worker SHA-256:
  `cfc176d6c77cbcba92a1bc92dab41aa02e42614adcaa5a1f26d1643e30f96079`
- accepted FFmpeg/FFprobe: `6.1.1-3ubuntu5`
- real Video adaptive processing: succeeded on attempt 1
- adaptive variants: 5
- adaptive selections: 5
- Media `variant_registered` events: 5
- Media `variant_activated` events: 5
- public HLS master / 360p / 720p derivative byte acceptance: PASS
- public byte-range delivery: PASS for both rendition media files
- public Video reader intentionally remains on the accepted v8 MP4 during V4A
- disposable Supabase preview deleted after production acceptance

Canonical record:

- `docs/engineering/phase-7b-v4a-adaptive-video-media-foundation.md`

V4A closed the adaptive Media foundation only. The product-facing gates that remained after V4A are now also production accepted through V4B, V4C, governed transcript publication, caption cue-expiry repair, and the real immutable caption-correction lifecycle.

Phase 7B is now closed. See:

- `docs/engineering/phase-7b-closure-record.md`

## Immediate numbered programme work

**Phase 8: Field Capture is CURRENT.**

Phases 0 through 7B are closed. Do not reopen Phase 7A or Phase 7B unless production evidence invalidates a closed authority contract.

Phase 8 begins from the accepted Video, Media, Trust, Review, and publication primitives already in production. Its programme target remains safe mobile intake, newsroom triage, and promotion, exiting through a weak-network capture that reaches private review and becomes a safe draft without losing provenance.

The September Registry/public-identity detour remains accepted adjacent baseline. It does not create a new numbered phase.

Immediate adjacent Registry state remains:

1. MIZIZI v1.1.0 implements the accepted Release taxonomy invariant without changing public route grammar
2. the historical Track identity apply is production accepted: 440 canonical repairs, 66 blocked review items, and 857 MIZIZI redirects
3. the fresh post-apply Track audit is 561 findings: 66 blocked slug candidates, 492 title-credit observations, and 3 unexplained slug mismatches
4. the historical Release taxonomy apply is production accepted: 32 canonical writes, 0 remaining taxonomy candidates, and exact transition split 11 EP to Single / 19 Album to EP / 2 EP to Album
5. preserve the 18 bad active Release-membership relationships across 13 active Releases as evidence while preventing them from manufacturing public identity; the fresh Release post-apply audit is 1,430 observations with 0 taxonomy candidates

The remaining Registry review evidence can continue under its existing governance without blocking Phase 8.

## Primitive compounding rule

Phase 6B is the first numbered phase that begins with the Primitive Compounding Contract already active in CI.

Every milestone must record whether it:

- reuses an existing primitive
- creates a candidate primitive from a real need
- promotes a candidate after a second-domain proof
- extends an existing primitive from new field learning
- deliberately retains domain-specific implementation

Do not build a universal screen. Do not rebuild a concept WAKILISHA has already learned.

## Phase 7A exit gate

One real Video publication must move through the canonical internal Video workflow with exact Media authority, poster/caption/transcript/chapter semantics as applicable, shared Credits/Citations, immutable review versions, governed publication, and reconstructable History.

Desktop/mobile public Video delivery belongs to Phase 7B, not 7A.

## Programme continuity

The roadmap is an orientation tool, not a prohibition on detours.

If building Phase 6B exposes adjacent work that is better solved first, that work can be done. When it settles, reconcile the map so the project continues with a shared understanding of what changed and what remains.

## Deployment state of this status correction

- SQL migration needed: No
- Supabase Edge Function deployment needed: No
- frontend deployment needed: No
- Readdy Finish update needed: No
- production runtime change needed: No
