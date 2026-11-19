# Charts 2.0 Phase 2 — private scoring and Registry identity v1

**Status:** Take 1 implementation and proof; not a Phase 2 acceptance or launch.
**Authority:** [Approved three-phase plan](charts-2-0-three-phase-execution-plan.md), parent [#1391](https://github.com/bjuta/wakilisha/issues/1391).
**Runtime boundary:** `supabase/functions/_shared/charts2-private-scoring-v1.mjs`, pure module. No RPC, Edge deployment, public API, Registry write, edition write or scheduler is introduced by Take 1.

## Source authority

Production Phase 1 independently verified five first-party signed-in captures, 600 consecutive-ranked observations, all original Storage readbacks and immutable receipt references. This does **not** establish synchronized weeks or canonical track identity.

| Source | Native depth | Weight | Temporal truth |
| --- | ---: | ---: | --- |
| YouTube KE Weekly Top Songs | 100 | 30 | Provider-declared week ending 12 Nov 2026 |
| Mdundo KE Top Songs | 100 | 25 | Observed 19 Nov 2026; provider period unknown |
| Apple Music KE Top 100 | 100 | 20 | Observed 19 Nov 2026; provider period unknown |
| Audiomack KE Weekly 100 | 100 | 15 | Provider updated 18 Nov 2026; no inferred weekly boundary |
| Shazam KE Top 200 | 200 | 10 | Observed 19 Nov 2026; discovery, not audio streams |

**Current live Registry identity inventory (read-only on 19 Nov):** Of 600 observations, one Apple provider ID joins `registry_track_provider_links`, but its `match_method` is `exact_title_artist`; it is **not** strong ID authority. No observation currently has a strong, accepted provider-ID link. All 200 Shazam observations lack a provider track ID. These are a real Phase 2 identity-review task, **not a reason to fabricate matches or a 100-song candidate.**

## Exact ordinal arithmetic

Methodology version `consumption_led_cultural_presence_v1`; scoring policy `charts2-private-ordinal-v1`.

For a real observed position `rank` in the source's declared `depth`:

`credit_points = source_weight_points * (depth - rank + 1) / depth`.

All depths are exactly 100 or 200, so use **integer credit units at 200 units per one point**:

`credit_units = source_weight_points * (200 / depth) * (depth - rank + 1)`.

The total never exceeds 20,000 credit units (100.00 points); Shazam rank 200 earns 10 units = 0.05 points, never 10 or 200 streams. No floating-point accumulation or hidden rounding. Each genuine source contributes at most once per **Registry-authorized canonical Track UUID**. Missing positions/sources yield *no awarded credit*, never measured zero listening.

Exact score ties are ordered by **canonical Track UUID in ascending lexical order**, a predeclared deterministic, non-editorial rule. This is for private preview; no rank is published, frozen, or inserted into Chart V2 in Take 1.

## Identity and completeness (fail closed)

A server caller in Take 2 must independently read the immutable Phase 1 receipts and `registry_track_provider_links` from authorized database operations. The pure kernel does **not** authorize untrusted client payloads. Never expose it as a browser-callable scoring authority.

Only a Registry provider link with `match_status=matched`, an explicitly strong method `exact_provider_id` or `reviewed_provider_id`, a verified active Track UUID and its existing UUID link key may award cross-platform credit. Existing `exact_title_artist` and `fuzzy_title_artist` links remain review clues, not matches. Existing Registry/MIZIZI identity and lineage authority must be consulted by the server-side review path; do not create a second Registry authority. Any ambiguous or contradictory provider identity blocks an automatic freeze. Duplicate provider rows identifying one recording on the same source cannot multiply its credit.

For every source, validate the immutable receipt schema, exact official endpoint, KE market, SHA-addressed original key, server-side Storage verification marker, 100/200 native depth, unique contiguous real ranks, original clock, evidence-only flags, and chosen receipt revision. A duplicate or missing source receipt is rejected. Partial depth remains partial; it never gains a synthetic row. YouTube keeps the provider-declared native period; the other providers retain their exact observed and provider-update timestamps.

The output is a **private, nonpersisted review preview** with per-source receipt lineage, exact integer score contributions, unresolved identity queue, conflicts and review state. It always says `frozen=false, can_publish=false`. It cannot itself produce a frozen 100-position edition.

## Three-take handoff

- **Take 1 (this work):** exact scoring and Registry identity quarantine, adversarial deterministic tests, no Production mutation.
- **Take 2:** authenticated server-only score preview, source-health and identity review through existing Registry/MIZIZI authority; one custom Admin Charts Studio. Persist only reviewed decisions through canonical CLI migration.
- **Take 3:** persisted immutable, reproducible private freeze; permissions, concurrency, adversarial and real desktop/mobile acceptance, full protected CI/Production gates and closure. Fail closed if 100 genuinely Registry-qualified recordings are not obtained. No public edition until separately approved Phase 3.

Phase 2 must not be called complete merely because five provider captures contain 600 ranks.
