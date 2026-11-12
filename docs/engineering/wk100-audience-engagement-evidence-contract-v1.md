# WAKILISHA 100 — Audience Engagement Evidence Contract v1

**Programme:** [WK100 #1264](https://github.com/bjuta/wakilisha/issues/1264)  
**Date:** 30 October 2026  
**Status:** Phase 1 research and method-design proposal. **Not** an adopted weight, source admission, event collector, scoring-engine change or publication approval.  
**Scope:** Spotify user-generated playlists, independently observed audience playlisting, social attention, and future WAKILISHA first-party engagement.

## Exactly two phases

1. **Phase 1 — source evidence, semantics and private methodological validation.** Verify provenance and native clocks; classify the unit of every source; define independence, privacy, anti-manipulation and bounded influence; backtest with private, honestly labelled evidence. Accept only a documented candidate recommendation, **not** an Edition or an unattended ingestion job.
2. **Phase 2 — approved engineering and production admission.** Implement the *approved* engagement behavior in the existing WK100 shared kernel and intake/receipt/identity paths, with native regression, adversarial and anti-fraud acceptance, private-source and production controls, a complete prospective EAT week, guarded editorial decision and separately authorized publication. No extra phases, new chart backend, or scoring activation by documentation alone.

**Do not rename the current four-behavior prototype to pretend the fifth family exists.** The accepted `wk100-private-preview-core.mjs` supports `consumption`, `video_consumption`, `discovery`, and `broadcast_exposure`. Audience engagement needs an explicit future contract amendment and kernel tests in Phase 2. It is not `consumption`, `broadcast_exposure`, a native stream count, or a new operator merely because a playlist is public.

## Editorial measurement model

| Family | Admissible meaning | Prohibited inference |
| --- | --- | --- |
| Consumption | Platform's ranked listening/consumption evidence, with its actual native metric | Rank converted into stream counts or claimed national audience size |
| Discovery | Recognition/search/discovery intent, for example Shazam | An identification converted into a play |
| Video consumption | Provider-native video chart/view evidence, kept distinct from audio streams | Views silently combined with audio plays |
| Broadcast exposure | Independently grounded station/airplay evidence | Unverified station text/playlist positions treated as measured spins |
| **Audience engagement — proposed, optional** | Evidence of independent people choosing to save, add, curate, share, or participate around a recording, where those actions and their provenance are actually attested | Playlist position, social mentions, follower totals, reposts, promotional placements or screenshots treated as verified listeners or plays |

Audience activity helps explain cultural participation and emerging discovery. It must **supplement, not replace**, consumption/discovery. The chart is an independently governed Kenyan music ranking, not a composite of unrelated platform popularity badges.

## Source-specific candidate rules

### Spotify UGC panel: historical asset, **not yet admitted**

- The September historical soak measured a **fixed 20-playlist panel** over **28 observations**: 556/560 parseable responses (~99.3%). That demonstrates historical transport durability, **not current endpoint access, representativeness, rights or eligibility**. Never reuse those historical snapshots as an October 2026 prospective week.
- The **entire Spotify panel is one provider-level source/operator** for independence and maximum-share calculations. Twenty playlists are **not** twenty independent operators; overlapping curator control, duplicated tracks and amplification chains must be assessed within the panel.
- A provider's playlist placement is a **state observation**. An item's appearance, order, `added_at` when actually supplied, or difference between snapshots must not be labelled as a play, a listener, a new save, a native Kenya stream, or a verified audience-event count.
- Before a playlist observation can influence scoring, prove an eligible and repeatable exact source method, at least two independently evidenced playlist states when measuring change, stable playlist identity and curator provenance, source-native timestamps and Kenya-relevance basis. An English title, Kenyan-themed playlist name or public Spotify URL alone does not prove Kenyan listenership.
- February/March 2026 Spotify Development Mode restrictions mean the standard Web API returns playlist items only for playlists the authenticated account owns or collaborates on; extended quota mode has separate behavior. Do not assume the old 20-playlist request is reproducible under the user's present app mode. [Spotify migration guide](https://developer.spotify.com/documentation/web-api/tutorials/february-2026-migration-guide).
- Spotify's published [Developer Policy](https://developer.spotify.com/policy) restricts analysis of Spotify Content/Service to create derived listenership metrics. The owner-directed research baseline is not a blanket ban on observing public facts, but this **concrete API/method-and-derived-use constraint** requires exact-method review. **No circumvention, alternate endpoint substitution, credential escalation, or unreviewed commercial score admission.** The present disposition is `RESEARCH_REVIEW_REQUIRED / COLLECTOR_DEFERRED / SCORING_DEFERRED`.

### Other social platforms: separate candidates, not a pooled raw count

- Prefer independently attested, source-native creation timestamps and stable recording references. Distinguish original user creations from reposts, paid placements, bot networks, influencer coordination, editorial campaigns and platform-driven recommendation exposure.
- Do not add raw mentions, hashtag counts, follower counts, views and shares together. A platform may provide *some* of those signals; each still requires a metric-specific definition and an eligible exact acquisition method.
- Count independent social operators only where independence can be defended. Syndicated copies of one action and repeated accounts of one promoter are **not** corroboration from independent people or providers.
- Zero historical coverage is not proof of low audience demand. Social observations stay `research_only` until sample bias, Kenyan market basis, consent/privacy, native times and adversarial controls are verified.

### WAKILISHA first-party playlists and saves: preferred future native-event path

- Use events WAKILISHA actually governs, such as a legitimate user adding a canonical Track to their own playlist or explicitly saving it. Do **not** assume the existing playlist product already produces a WK100-suitable immutable event stream.
- An authentic first-party event has its own `occurred_at` UTC timestamp. Assign its **observation/event week** by the established half-open `[Monday 00:00 EAT, following Monday 00:00 EAT)` interval. This does **not** backfill a provider-native chart's unknown seven-day measurement bounds.
- The minimum future private evidence shape is a pseudonymous actor reference, governed recording identity (or a review-needed candidate reference), action type, original event ID, UTC occurrence time, event source, whether initiated by the person, and an anti-duplication/reversal state. No raw personal identities, private playlists, exact location, sensitive interests or profile data in public ranking artifacts.
- Only opted-in, proportionately processed, privacy-reviewed actions may be considered. A deleted/unshared/private playlist is not automatically a publicly publishable endorsement. Bot/employee/artist-team/self-promotional actions and collusive loops require explicit rules. Editorial playlists and WAKILISHA-curated placements must not count as independent audience votes.
- Assign no Kenya market identity from IP, language, display name or ethnicity alone. Define a privacy-respecting market-validation rule and publish an **aggregate** coverage confidence rather than exposing individuals.

## Temporal and recording-identity contract

1. Preserve three distinct clocks: **event occurrence** (if actually evidenced), **source's native measurement period** (only when provider-attested), and **WAKILISHA observation/capture time**. A daily list, an undated playlist, and a source-described weekly chart do not become one shared week because they were all visited on 30 October.
2. The existing WK100 evidence kernel uses Kenya-local Monday-to-Monday EAT windows and refuses invented source-native boundaries. For retrospective or repeated snapshots, compute **observed-in-window** coverage separately; never silently stamp the full tracking week onto a single source state.
3. Preserve source-native Track IDs and exact evidence hash/receipt. Combine two providers' rank evidence as corroboration **only after separately governed MIZIZI/Registry identity resolution**, never because titles look alike. A provisional source evidence ID stays provisional and does not manufacture corroboration.
4. One real individual or curator action should make at most one eligible contribution per governed action window; duplicate uploads, reshares, collusive lists, automatic playlist copies and repeated state observations are capped or excluded. Document precise deduplication keys *before* considering collection.
5. When a required behavior or operator is missing, **do not redistribute its reserved weight** to surviving sources. Missing data is a coverage gap, not evidence of zero public interest.

## Influence and manipulation: **simulation parameters, not adopted policy**

- Backtest a reserved **audience engagement family** at *0%, 5%, 7.5%, and 10% of total model weight*. Those numbers are **hypotheses only**. Final weights, subweights, caps, week, source constitution and threshold are confidential decisions outside the public repository.
- Treat Spotify (if an exact method is later qualified) as a **subsource of audience engagement** under the one-provider cap, not a distinct national consumption operator. Other social sources and WAKILISHA first-party signals may be distinct only after ownership/independence review.
- Evaluate rank movement of the top 100, leave-one-source-out stability, rank volatility, cross-operator identity-resolved corroboration, concentration by curator/campaign/actor, Kenyan-market coverage, and robustness to adversarial bursts. Report missingness and size of unrepresented populations.
- Required negative fixtures: one person adding the same track to 20 playlists; 20 playlists controlled by one organization; a bot-created sudden surge; social repost amplification; an editorial/artist-controlled placement; missing Spotify; unknown country; missing native timestamps; repeated snapshot of unchanged state; disputed Track identity. These cannot independently raise a candidate into the Top 100.
- At Phase 1 completion, either recommend a bounded audience family with reviewed evidence and material benefit, or explicitly defer the family to a future evidence cycle. **Neither outcome creates a third phase.** Do not block the honest nonpublishing evidence audit merely because a supplementary source is absent.

## Two-phase acceptance and release ledger

| Gate | Phase 1 exit: evidence decision | Phase 2 exit: implementation/release |
| --- | --- | --- |
| Source semantics | Native metric, market basis, publisher/operator, correct chart-vs-UGC classification | Enforced adapter and source-method allowlist |
| Timing | Original timestamps, observed week and provider-native period kept distinct; unknowns documented | Prospective EAT receipt/checkpoint replay with fail-closed unknown-period handling |
| Identity | Exact provider IDs/hashes, private provisional IDs, separate MIZIZI review | Tested canonical identity mapping; no inferred duplicate-vote inflation |
| Independence | Spotify 20-playlist panel = one operator; source/control relationships reviewed | Operator-slot cap, correlated-source attacks and no-weight-reallocation tests |
| Privacy and fraud | Data minimisation, consent and adversarial hypotheses reviewed | Production-appropriate permissions, dedup/reversal and abuse regression tests |
| Weighting | Private 0/5/7.5/10% simulations and caveats; **no weight adopted by this document** | Owner-approved confidential method, sensitivity gates and exact authorized inputs |
| Publication | **Never allowed in Phase 1** | Separately signed editorial, source and Production gates; only a subsequently authorized Edition may publish |

### Current October 2026 evidence inventory

- **Shazam KE:** 200 source-native discovery ranks, exact bytes retained; native period boundary unresolved.
- **Mdundo KE:** 100 full-depth ranked provider tracks, original-byte evidence and weekly-update description; exact underlying measurement bounds not attested.
- **Apple KE public playlist:** 100 ranked Apple song identities in original head metadata and JSON-LD, daily updated; not a measured native seven-day period.
- **Audiomack KE:** original HTML retained; ranked recording identity mapping unresolved.
- **Spotify UGC:** 20-list/28-observation **September historical technical soak only**; no October native scoring receipt; current method not qualified.
- **Social and first-party engagement:** design candidates only; **zero** independently accepted WK100 engagement receipts.

**Release invariant:** `can_publish=false`; no accepted WK100 Edition, real score, production collector/cron, SQL, Edge, frontend, public real-row files, or MIZIZI mutations follow from this research contract. Preserve the private source roster, real recording evidence and confidential weight experiments outside public GitHub.

## Existing controlling references

- [Independent research and source qualification](wakilisha-100-independent-research-source-qualification-v1.md) (29 October founder-directed research model).
- [Source access and admission register](wakilisha-100-source-access-admission-register-v1.md) (method-specific capture admission, not general public-fact prohibition).
- [Private ranking preview](wakilisha-100-private-ranking-preview-v1.md) (four-current-behavior, nonpublishing prototype, reserved operator slots and closed weights).
- [September chart-source reliability soak](charts-public-source-accessibility-soak-final.md) (the historical 20-playlist / 28-observation technical evidence).
- [Playlist product authority](phase-5b-public-playlist-product-design.md) (first-party playlist product exists, but that is not evidence of WK100 scoring events).
- [Spotify February 2026 migration guide](https://developer.spotify.com/documentation/web-api/tutorials/february-2026-migration-guide) and [Spotify Developer Policy](https://developer.spotify.com/policy) (exact Spotify API method/use to be reviewed).
