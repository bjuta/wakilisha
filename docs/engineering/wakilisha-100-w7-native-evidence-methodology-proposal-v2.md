# WAKILISHA 100: W7 Native-Evidence Methodology Proposal v2

## Superseding ranking-primitive decision | 11 November 2026

**Historical record, not active design or write authority.** The fixed [WAKILISHA 100 Ranking Primitive v1](./wakilisha-100-ranking-primitive-v1.md) supersedes the six-family editable percentage proposal, mandatory Spotify editorial inclusion, and all W7 "Save methodology" controls described below. Historical six-family proposals remain readable for audit, but new or changed candidate writes are rejected. Source-method approvals in Collect remain distinct evidence acquisition decisions and are not ranking formulas.

**Current private research decision:** five immutable ranking source families (Apple Music, Shazam, Mdundo, YouTube, Audiomack), zero Spotify ranking points, one fixed ordinal composite, independent reproducibility and sensitivity review before real-source W8 integration. No calendar-week wait, no new hosted preview, no autonomous source or public Edition activation. The text below remains as the original W7 v2 research proposal for chronology and replay.

---


**Scope:** WK100 issue #1338, same draft PR #1356. **State:** candidate only. No reviewed numeric weights, approved formula, source promotion, freeze, scoring, or publication. This document does not authorize W8.

## This is not the legacy methodology

The older `top_songs_weighted_v1` default and v1.0.1 scoring policy combine Spotify popularity, Apple positions, YouTube engagement, airplay, velocity, and an editorial adjustment. They are not the approved methodology for WAKILISHA 100. The first W7 draft only collected six percentages and did not define measurement meaning. W7 v2 explicitly protects the five core Kenya providers plus the four separately traced Spotify editorial playlist observations treated as **one** supplementary provider family.

| Family | Native evidence treatment | Unacceptable interpretation |
| --- | --- | --- |
| Apple Music | Kenya daily most-played chart position, retained as daily evidence | Weekly stream totals inferred from daily ranks |
| Shazam | Kenya discovery position within its independently verified source window | Streams, listens, or weekly consumption volume |
| Mdundo | Kenya ranked song-chart placement and verified observation period | Weekly count inferred from a weekly-updated page |
| YouTube | Kenya weekly song view counts only when the actual provider week and count are verified | Playlist order as weekly views |
| Audiomack | Kenya geo-chart placement | Disclosed native Kenya stream totals without evidence |
| Spotify editorial | Four separately sourced playlist inclusions/placements, one capped family | Four independent consumption sources or votes |

## Contract invariants

1. A candidate must name the exact Monday EAT week and match the saved eligibility-policy SHA.
2. Every one of the five core providers must have an explicitly proposed positive reserved weight, and Spotify editorial must have one positive smaller reserved weight. All six sum to 100 percent. These constraints validate a **proposal**, not a data-derived or approved allocation.
3. Native rank and cardinal counts cannot be equated. Source measurements and their reporting-period semantics are sealed to the explicit contract vocabulary. The contract does not manufacture weekly periods.
4. Absent sources retain their reserved share; there is no automatic redistribution, same-provider double voting, or invented fallback metric.
5. A contribution requires an admitted original, real native period, and confirmed Registry recording identity. Two independently qualified core providers remain a minimum source-coverage gate.
6. An independent leave-one-core-provider-out sensitivity review is required before any eventual freeze. Incomplete coverage blocks private ranking.
7. The proposed methodology is revision-controlled within the existing signed-in Admin weekly draft. Exact-policy saves are checked against the new proposal contract. An older saved proposal remains stale review evidence, not authorized ranking methodology.
8. The contract validator always returns `canScore=false`, `canFreeze=false`, and `canPublish=false`; no W7 freeze endpoint is introduced.

## What remains to finish W7

The native normalization formula, per-week evidence alignment and completeness thresholds, source-concentration limits, approval role, immutable approved version and independent signed-in freeze acceptance still require explicit reviewed decisions and implementation. The contract must not pretend otherwise. Avoid recording numeric production weights or private receipt identifiers in public GitHub.

## W7 evidence-chain review implementation, 11 November 2026

The existing source-proposal and saved-week draft contracts remain authoritative. The W7 Admin now projects a **read-only evidence-review** from the source-health readback, current source-method decision readback and already-reconciled proposal/method/contract identities. Code: \`reviewWk100MethodologyEvidence\` in the existing \`wk100-methodology-candidate.mjs\`; the Admin never writes a new qualification record through this view.

This projection is intentionally conservative and **cannot approve weights, score, freeze or publish**:

- It reports a separate evidence chain for each of the five core families, never five unnamed metric buckets. A raw SHA, enrolled contract and method decision are separate checks; none individually establishes source qualification.
- Candidate method evidence requires current proposal/revision reconciliation, the exact capture-contract version, the **latest** method decision, a recognized native metric and a retained original. A later pause, retirement, stale proposal, ambiguous duplicate decision, partial capture without retained original, or mismatched method version cannot pass this candidate check.
- YouTube requires \`rank_and_count\` as the native count-bearing contract, not a rank-only playlist surrogate. The other four core families remain rank observations. This does not infer streams or weekly counts from rank.
- A \`provider_defined\` native interval must carry explicit-offset timestamps, a forward interval and a window contained within the selected EAT week before it can be a candidate. An \`observed_as_of\` method has a distinct current-week observed instant and is **not** certified weekly measurement. Native reporting windows that cross this EAT boundary require **separate reviewed temporal alignment** rather than conversion by the UI.
- Count source-method chains by **distinct core family**. Do not count multiple originals from one provider as independent core coverage; don't treat Spotify's four playlists as four providers. The four editorial research observations still need their own verifiable references, positions and timestamps; no positive Spotify attestation can be inferred from the source-health summary.
- Even if two candidate core chains are displayed, \`sourceCoverageConfirmed=false\`, \`spotifyEditorialProven=false\`, \`nativeFormulaApproved=false\`, \`weekCompletenessApproved=false\`, \`concentrationAndSensitivityApproved=false\`, and \`independentApprovalRecorded=false\`. \`canScore=false\`, \`canFreeze=false\`, and \`canPublish=false\` remain non-negotiable.

### Engineering decisions still required for governed W7

A **numerically explicit** approved methodology must specify: (1) a rank-position transformation based only on verified provider depth, (2) a distinct YouTube count transformation using exact source-native week and auditable count evidence, (3) the treatment of multiple genuine Apple daily observations without calling them a weekly stream total, (4) one capped Spotify editorial inclusion/placement contribution with four retained playlist sources, (5) whether and how native windows qualify against an EAT Edition week, (6) per-family minimum receipt/completeness thresholds and unreallocated missingness, (7) source-concentration and leave-one-core-provider-out sensitivity tolerances, and (8) exact independent reviewer capabilities, proposal digest, version lock and append-only freeze proof.

These are **unapproved decisions, not implied defaults**. The founder's chosen source order is not numeric weighting authority. The existing W7 v2 candidate may retain explicitly proposed weights, but does not authorize a formula or rank output. Avoid minting a freeze SQL migration until these decisions and independent signature authority are accepted. Do not reuse the legacy \`top_songs_weighted_v1\` formula by assumption.

The same existing consolidated WK100 source-domain tests now include evidence-chain and stale-authorization negative cases. The previous 52/52 Node / 32/32 Chromium acceptance belongs to commit \`4aee9879\`; this later W7 revision needs its **own exact-head integrated acceptance**. No new workflow, SQL migration, preview, source collector, scoring endpoint or Production deployment was introduced.

W5C/W6 subsequently passed exact-head \`4aee9879\` genuine disposable GoTrue JWT, typed canonical Registry writer, immutable audit and W6 independent full-receipt/drift acceptance; those historical results do not automatically validate new W7 commits. W8 ranking and the first public Edition remain out of scope.
