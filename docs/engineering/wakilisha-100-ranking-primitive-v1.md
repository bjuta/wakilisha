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


## Independent synthetic research challenge | 11 November 2026

A source-independent diagnostic is committed at \`scripts/acceptance/wk100-ranking-research-challenge.mjs\` (Node 22, zero network, database, provider egress, or publishing dependencies). Its exact Git blob SHA was independently compared to the local runner **after** execution. It constructs 240 hypothetical canonical identities, five source-family rankings (seven simulated Apple days and a count-bearing YouTube panel), and independent second-implementation recomputation of the full score. The resulting Top 100 IDs and integer micro-scores match the actual v1 ranking primitive in **all three** scenarios. The diagnostic never changes the canonical five-family weights or the calculation code.

The challenge then recomputes **counterfactual rankings** without one provider (its 20-point reference share remains unfilled, never redistributed), with one family's share raised to 30 points and the other four set to 17.5 each, and with an independent nonlinear head-focused positional curve instead of the original linear rank formula. All these counterfactuals are **research comparisons**, not selectable formulas or executable publisher policies.

| Simulated cross-provider scenario | Head-focused alternative: original Top 10 retained | Worst leave-one-family-out: Top 10 retained | Worst 30/17.5 sensitivity: Top 10 retained |
| --- | ---: | ---: | ---: |
| Correlated ranking panels | 10/10 | 9/10 | 9/10 |
| Deliberately conflicting rankings | **4/10** | **3/10** | **5/10** |
| One reversed core provider | 10/10 | 10/10 | 10/10 |

**Interpretation:** the challenge is capable of detecting material instability instead of hardcoding a PASS. In the conflicting case, changing the rank curve or omitting one provider substantially changes the Top 10; the one-reversed-source case preserves the Top 10 but changes mid-chart ranks (the nonlinear alternative has a median **12-place** absolute movement among the original Top 100). Therefore Top-10 retention alone is insufficient as an acceptance statistic. These numbers are entirely **synthetic**, do not imply a real source distribution, and **do not validate 20% shares or a universal launch threshold**.

Normalized linear Borda is algebraically equivalent to the currently selected \`q(r,d)\`; reporting a Borda match as an independent scientific model victory would be misleading. The present independent comparisons are actual alternative ranking curves and provider-influence counterfactuals. A provider-native partial-ranking/likelihood model, observed real-source correlations, missingness-censoring effects, coverage balance and defensible confidence intervals remain empirical research gates. They can be evaluated offline on qualified archived observations without waiting for another physical week; if those observations are insufficient, the evidence is recorded as insufficient rather than substituted.

The active W7 evidence review has also been moved to a five-family \`wk100-ranking-evidence-review.mjs\` contract. This screen no longer imports the retired six-family methodology proposal; it cannot claim original-byte attestation, Registry identity, confirmed coverage, score, freeze, or publish authority. Legacy \`methodologyCandidate/v2\` validation remains only for preserved historical draft compatibility.



## Restricted exact-evidence handoff | 11 November 2026

**Engineering candidate, not hosted or Production acceptance.** The existing draft PR adds two **server-only** reusable modules:

- `supabase/functions/_shared/wk100-ranking-attested-reader.mjs`: takes only explicit selected receipt IDs; reads the existing `wk_chart_capture_attempts_v1`, `wk_chart_capture_contracts_v1`, `wk_chart_capture_rows_v1`, exact provider ID links, and active `registry_tracks` from a restricted server-owned Supabase client. Retrieves original bytes from the existing private `wk-chart-raw-evidence-v1` Storage bucket. It does not query “latest” or admit new providers.
- `supabase/functions/_shared/wk100-ranking-attested-evidence.mjs`: binds every receipt ID to its contract, EAT week, full-depth status, original object's exact week/source-key/SHA path, and SHA-256 of independently read private bytes; replays the existing native source parser and independently compares rank, provider ID, title, artist and count fields with each immutable captured row. It invokes the existing W4 exact provider-link-to-active-Registry projector, refuses unresolved/ambiguous/inactive identities, and requires the **calling trusted server's current W5 eligibility evaluator** to return `ELIGIBLE`, the exact saved policy digest, and a Registry-facts SHA for each row. The resulting Registry-facts digest is computed over sorted evidence relationships, so changed Registry facts change the private ranking digest. The module finally invokes only the existing **fixed five-family ordinal primitive** and enforces `canStage=false`, `canPublish=false`.

No new SQL, source collector, Edge route, client action, score-storage table, public API, publication path, deployment, or paid preview is created. The caller must independently authenticate and authorize its server context, acquire a sealed source/receipt selection from the established research governance, and supply an actual current W5 evaluator. **These are mandatory external authorities, not capabilities created or certified by this helper.** A `candidate` capture contract is not a qualified scoring source. Callers must never provide frontend-selected records, pretend that a digest is an authentication signature, or return private evidence/score details to the browser.

### Focused code/denial proof

Isolated Node 22 regression `test/charts/wk100-ranking-attested-evidence.test.mjs`: **3/3 PASS** locally. The test uses an in-memory Supabase/PostgREST-shaped service reader, synthetic private original bytes, simulated Registry-link responses, a **stub W5 callback** and a synthetic native parser. It checks that the bridge returns the same ranking digest after exact receipt reordering, that a changed Registry-facts digest changes the ranking digest, and that tampered private bytes, wrong source paths, missing receipts, altered captured rows, partial-depth captures, invalid family/market, missing exact Registry links, excluded/stale W5 verdicts, false YouTube period references, forged counts and denied private Storage all hold. Exact committed source blob SHA fingerprints are recorded in the PR. This verifies **adapter logic under explicit synthetic dependencies**, not full actual provider parser integration, a real authenticated hosted reader or first-party data.

### Immediate remaining blockers (not calendar delays)

A read-only Production count of 9 November 2026 receipt statuses found: **Apple 1 succeeded/full-depth**, **Shazam 1 succeeded/full-depth**, **Mdundo 1 partial-depth**, **YouTube 0** and **Audiomack 0**. Thus no genuine complete five-family, eleven-checkpoint Edition input exists for this week. Do not reclassify the Mdundo missing row, invent six Apple daily observations, or treat a synthetic five-source fixture as live evidence.

The initial v1 calculator requires every listed source row to have one canonical active, W5-eligible Track ID. The genuine Shazam first-party rank/artist/title CSV does not include a provider ID, and real source panels can contain excluded recordings. **This is a deliberate fail-closed research limitation of the current private bridge, not a mandate to invent matches or suppress source positions.** Before W8 can rank real evidence, independently decide how unresolvable or excluded rows preserve original Top-N depth while earning no unearned canonical credit. Implement that under a separately tested, versioned contract; never compress rank positions or silently count excluded rows.

Next acceptance includes exact-head full Node/build/Chromium checks; actual native-parser replay against retained private originals; existing signed-in capability, source governance and current W5 evaluator wiring; ambiguity, correction/revocation and concurrency tests; and empirical comparison with real qualified source observations. None of those requires waiting for two elapsed calendar weeks. The already accepted earlier Phase 1 logical-week and W5C/W6 genuine JWT/Registry tests remain accepted at their original commits.


## Governed W5 and original source-position candidate | 11 November 2026

**Implementation candidate only. Tests at the new head are NOT RUN; do not promote to accepted or Production authority.** The private server reader now requires a signed-in actor with `manage_ingest`, `manage_charts`, and `view_registry`; reads the current revisioned weekly policy via `wk100_get_admin_draft_v1`; verifies its saved `ingestPolicySha256`; and reads the current Registry Track, credit, Artist and Release facts through existing exact-ID authorities. It passes the existing W4 identity projection and saved weekly policy to `projectWk100EligibilityPreview`, which applies the existing full-filter evaluator. There is no second W5 rule engine, fake browser-provided eligibility verdict, or source-rank rewrite.

Every complete original panel retains positions `1..depth`, including positions whose W4 identity is unresolved, conflicting or inactive and positions W5 excludes. The private ranking primitive accepts explicit `EXCLUDED`, `REVIEW_REQUIRED`, or `CONFLICTED` held rows only with `recordingId:null`. Held rows retain their native rank (and YouTube native count for source integrity), but never receive normalized credit or a provisional canonical ID. Eligible rows must still carry a verified active canonical recording. The Apple seven-panel family denominator remains seven even when some positions are held; rank gaps are never compressed. The private attestation digest includes per-row source identity, W5 outcome and Registry-facts SHA, and the ranked digest includes exact native held positions and dispositions. `heldPositions` reports aggregate private research counts. A healthy source Top-N omission is likewise not proof of zero listening.

This does **not** authorize staging or publishing a result with unresolved positions. `canStage=false` and `canPublish=false` remain hardcoded. A real W8 caller still needs independently accepted source-method admission, genuine signed-in runtime proof, qualified provider periods, one consistent Registry/policy sealing boundary, full original-byte receipts, scientific research review, current-head full build/browser checks and governed approval. Real evidence is still insufficient: seven genuine Apple daily positions plus full capture from all remaining families have not been proved. Missing/partial source panels continue to fail closed; the 99/100 Mdundo original cannot be padded.
