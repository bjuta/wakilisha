# WAKILISHA 100: W7 Native-Evidence Methodology Proposal v2

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

W5C durable correction decisions and W6 true before/after correction acceptance remain open in the same PR. W8 ranking and the first public Edition are explicitly out of scope.
