# WAKILISHA 100: Fixed Ranking Primitive v1

**Decision:** 11 November 2026. **Delivery authority:** #1338, draft PR #1356. **Implementation state:** pure private ranking candidate, not admitted public Edition. **This supersedes W7's editable methodology proposal, its six-family weight-entry screen and its four mandatory Spotify editorial rankings.** It does not rewrite or delete historical research, evidence, drafts or prior chart programmes.

## Research claim and source constitution

WAKILISHA 100 is a **Kenya-oriented, cross-platform chart traction index** combining ranked consumption and discovery observations. It is **not** a Kenya listening census or a count of streams, listeners, plays or distinct persons.

The five fixed core source families are **Apple Music, Shazam, Mdundo, YouTube and Audiomack**, each one bounded independent family. There is no ordinary operator control to add a sixth scoring family, change numerical source shares, or choose a different formula. The previous four Spotify editorial playlists remain attributable, replaceable research references but supply **zero** inaugural ranking points. Playlist insertion, ordering, and presence do not establish consumption. A future genuine Kenya Spotify consumption source would require a separately reviewed, prospectively versioned scientific specification and truthful access/provenance. It cannot inherit the editorial family or silently alter a published Edition.

Collector source proposals and source-method reviews remain active in **Collect**, because acquisition methods, genuine period semantics, permissions, and source health are distinct from ranking-source selection. The fixed ranking constitution does not bypass those controls.

## Initial mathematical convention

The specification ID is `wk100-kenya-traction-ordinal-v1`; implement it once as a pure Edge/Node compatible module in `supabase/functions/_shared/wk100-ranking-primitive.mjs`.

For verified rank `r` in a complete original provider list with declared depth `d`, use a normalized **ordinal** rank credit:

`q(r,d) = (d-r+1)/d`.

A position **not listed** in a healthy, fully captured Top-N list receives no positive **positional** credit from that list. This is not a claim of zero streams. A failed, stale, missing, partial-depth or ambiguous source is held as **incomplete evidence**, never zero-filled or redistributed.

Five independent family contributions each have a **fixed reference share of 20 percentage points**. This equal allocation is a declared initial design convention, not a scientifically estimated relative audience share. The composite index is:

`S(track) = 20 × (qApple + qShazam + qMdundo + qYouTube + qAudiomack)`.

Daily Apple ranks are aggregated by averaging seven separate, qualified EAT-day positional credits **inside Apple's single 20-point contribution**. Daily observations never become a synthetic weekly streaming total, nor seven platform votes. The other four source families currently require one verified capture per Edition week. YouTube must retain genuine count-bearing weekly Top Songs observation and provider-declared week. **Native counts are integrity-checked, but the inaugural ordinal comparator does not convert counts into streams or overweight cardinal data.** Source-native date-only periods remain date-only. Do not invent UTC start/end times when the first party only publishes calendar dates. Provider-defined weekly end dates may differ from the Monday EAT Edition boundary: provenance records the difference, while the selected observed source must be fresh within the Edition's EAT operational week.

The actual code computes exact deterministic six-decimal scores using integer micros, ranks descending, and resolves mathematical ties by canonical Registry recording UUID ascending. That tie break is reproducibility plumbing, not popularity evidence. It creates a complete **private Top 100 candidate only when** all five complete original lists and seven Apple observations are present and the combined set has at least 100 unique resolved recording IDs. Otherwise the pure function fails closed. The submitted Registry and policy SHA values are shape-checked; the pure calculation **does not verify raw Storage bytes, signatures, real JWTs, source admission or Registry truth**. Only a separate trusted server boundary may construct attested input from existing immutable receipts and current Registry authority.

## Infrastructure, archival and publication authority

The private ranking function has no arbitrary formula input, no generic source URL, no operational clock or external provider transport. Its output has a deterministic SHA-256 digest and explicit `canStage=false`, `canPublish=false`. Future W8 trusted attestation must independently recheck each original receipt, current canonical identity and eligibility-policy digest in the existing immutable ledger. Then the existing governed publisher, not this mathematical helper, controls Edition approval, staging, publication, withdrawal and historical replay. A future licensed radio/API endpoint must read the **same sealed canonical Edition** as the website, not recompute or customize its ranking.

The old `top_songs_weighted_v1`, `v1.0.1`, W7 `methodologyCandidate/v2`, and saved six-family proposals remain historical records for other chart programmes or audit. New W7 proposal entry is retired from active Admin, and new/changed `methodologyCandidate` payloads are denied by the draft API. The existing source intake, W2A method admission and private capture controls are not deleted. Do not change already-applied migrations to erase old records.

## Empirical research acceptance (no calendar wait)

Two accelerated application weeks were already accepted during Phase 1 (7 November), using an injected logical EAT clock with independent current-clock PostgreSQL/GoTrue/Storage tests. **Do not rerun or wait two physical weeks** to re-prove that substrate.

The new pure ranking module was tested directly with Node 22 using complete synthetic snapshots for the logical EAT weeks of 9 and 16 November 2026. Tests exercise deterministic ordered-input-independent digest and Top 100, correct five-family normalization, Apple one-vote handling, Spotify exclusion, exact receipt identity, missing depth and checkpoint refusal, current-week evidence cutoff, native period dates and count ordering, mismatched native metric, fake Registry IDs, invalid source market and no publish authority. This is a **synthetic private calculation proof**, not five genuine 2026 provider receipts.

Before the inaugural genuine W8 ranking, perform immediate offline shadow comparison against archived source originals where verified, including a Borda/partial-order comparator, missingness and source loss, family-dominance and leave-one-source-out stability, sensitivity to plausible unequal source weights, Top-N censoring, recording identity mistakes, and provenance replay. Record any unresolved disagreements and do not tune the formula to reach a preferred song order. Confirm cadence and source-date alignment from real first-party facts; all five complete genuine weekly source inputs are not currently present. The 9 November register contains Apple 100/100, Shazam 200/200, Mdundo 99/100 (authentic partial), YouTube held and Audiomack held. Those genuine originals may be used for **research**, not relabelled as a valid five-source ranking week.

The current exact head requires **new build, consolidated tests, real browser and later trusted signed-in W8 integration acceptance**. Existing W5C/W6 and Phase 1 passes remain historical evidence at their accepted SHAs, not automatic green checks for new W7 code. No Production SQL, Edge, cron, frontend activation, scoring, stage or publication is authorized by this document.
