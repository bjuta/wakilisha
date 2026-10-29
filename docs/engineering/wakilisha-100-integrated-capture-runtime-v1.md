# WAKILISHA 100: Integrated candidate-capture runtime v1

**Owner:** WAKILISHA Engineering, issue #1264. **Status:** integrated implementation, not authorization to poll or publish. This replaces the earlier micro-gate plan with one code and database change, one accepted Preview proof, protected PR CI, and controlled Production promotion.

## Independent research versus unattended collection (29 October 2026 clarification)

WAKILISHA independently observes and reports publicly available chart facts, conducts researcher-directed work with tools it has written, archives its own research evidence, and calculates an original proprietary commercial chart. See [Independent Research and Source Qualification v1](wakilisha-100-independent-research-source-qualification-v1.md). This programme does **not** assume that every public factual observation or original WAKILISHA ranking needs a provider partnership.

This specific document, however, governs an **unattended Edge collector** making HTTP requests with immutable database and Storage writes. A request is not exempt from an applicable automated-access restriction merely because a WAKILISHA researcher authored or manually launched its script. Thus the separate reviewed source-method decision, sealed source manifest, exact endpoint and permit/restriction evidence, host/quota/period checks, disabled-by-default `WK100_CAPTURE_ENABLED` and independent activation remain mandatory **for this runtime**. The `authorization_ref` is a traceable source-method decision; it is **not** a claim that all sources require a negotiated licence or that WAKILISHA's editorial authority comes from a provider.

The original source shortlist is a research hypothesis, not a mandate to obtain agreements from five providers before advancing source qualification. No source is activated by this clarification.

## Existing authority

Merged protected source foundation: `3bd3b8b69e93331a1c3975153846977de4f52fe8` (#1266). Production has exactly 233 migrations, head `20261019203244`, a private 4 MiB raw bucket, and four empty immutable receipt/freeze tables. No provider contracts, requests, scheduler or WAKILISHA 100 publication exist. Historic editions must not be modified.

The September public-source accessibility soak observed reliable technical access for Mdundo, Audiomack, Boomplay, Shazam and YouTube, with Apple amber and Spotify UGC supplementary. Those results **do not** prove legal/contractual permission or scoring admission. Native ranks, video views and discovery interest stay noninterchangeable.

## One implementation boundary

1. `wk-chart-capture` is a service-role-only Edge Function. It is deliberately **disabled by default**, requires the server-only `WK100_CAPTURE_ENABLED=true`, and will not run without a separately reviewed, SHA-256 sealed source-access manifest. A caller may select only the source ID, version, EAT week, exact slot and attempt number; **never a URL, token, HTTP headers, or parser**. No CORS/public client use. The manifest must independently contain exact approved HTTPS endpoint, GET, Kenya market, purpose, access reference, expiry and explicit enabled state. This repo ships **no manifest, URLs or credentials**. A configuration field is not itself a provider licence or approval.
2. `chart-capture-runtime.mjs` reuses the accepted hard-bounded `fetchCandidateBytes`, byte-verified `archiveCandidateBytes`, provider-native parsers and EAT checkpoint kernel. No source can run outside its contract EAT slot, 20-minute acquisition window or provider-access validity. A signed-in user is not a collector, and unverified provider responses never enter the database as successful evidence.
3. The CLI-minted forward migration `wk_chart_capture_runtime_v1` creates one private, RLS-on, no-direct-grants reservation table and only four tightly granted service-role RPCs. `reserve` owns one `(contract,slot,attempt)` with a three-minute lease; it fails concurrent claims rather than double fetching. Once a payload digest is bound, a resumed lease **must read the existing private object**, verify exact digest and **never repoll** for that attempt. `advance` records bound/uploaded/verified in order; `commit` inserts immutable receipt **and every ranked row in one PostgreSQL transaction**. A transport-failure receipt is similarly atomic. A separate attempt number records an intentional retry. The existing immutable trigger and source-native metric/depth checks remain authoritative.
4. Private object path is bound to its SHA-256 and slot, `upsert:false` is mandatory, and only an exact collision with equal private readback is recoverable. A failed upload or readback is **not** erased. The ledger is the orphan-recovery authority, not a new mutable observation row. Production WORM/administrator mutation resistance remains **unproven**; native Storage service-role privileged deletion still exists.
5. No cron, service seed, edition mutation, scoring, cross-source weighting, Registry write, public response content, chart freeze or publication. Historical published R&B editions remain intact. The accepted weekly freeze kernel continues to produce blocked/nonpublishing evidence until a separate source-methodology decision.

### Preview and Production backend binding

A hosted Edge invocation must pass Supabase gateway JWT validation (`verify_jwt=true`) and the collector's exact `service_role` claim/`apikey` match. Before any database or source access, a separately set, project-specific `WK100_CAPTURE_PROJECT_REF` environment value must exactly agree with the legacy JWT's gateway-verified signed `ref` claim. Missing, malformed or differing values fail closed; a Production service JWT cannot select its own database from Preview. `WK100_CAPTURE_PROJECT_REF` must be configured independently and verified in each environment before any future enabling, without printing secrets. The Edge disabled-state response is returned before any backend resolution, which requires no SQL access or source manifest. Local claim decoding is **not** a signature check. Never trust caller URLs, Host headers, injected `SUPABASE_URL` or deployment-ID formatting as database targets. The disabled state and missing source manifest still prevent source calls.

## Explicit access register before any live call

For each source, the operator must record and independently verify: exact official endpoint, operator/owner, lawful retrieval terms, API/credential mode and location, rate quota and retry rules, source-native period clock and territorial scope, format/MIME/adapter code hash, max depth, Preview and Production egress/DNS/secrets presence, and expires-at. For Boomplay, unresolved market/officiality cannot be inferred from a successful HTML parse. For Apple, the observed timeouts do not justify increasing the timeout unboundedly. For YouTube, a weekly period label must map to separately validated native boundaries; a WAKILISHA Monday EAT interval cannot be relabeled as provider weekly usage. Preserve all documentation of source decisions.

An approved source register is **not included in this change**. The operator must not set enable=true or schedule requests until approval evidence and runtime parity are accepted. No existing chart job is an acceptable implicit authority for WAKILISHA 100.

## Operational and release acceptance in one tranche

- Existing consolidated `test/charts/chart-weekly-evidence.test.mjs` owns persistent source/slot/transport/ledger orchestration assertions; do not introduce a parallel critical suite.
- CLI mint `supabase migration new wk_chart_capture_runtime_v1` on accepted Mac; use the **exact generated path** without renaming or calculating timestamp. Clean migration replay from 233, Preview native apply, permanent read-only SQL verifier and Preview transaction-rollback suite; retain code and SQL SHA evidence.
- Verify real service-role create-only private Storage API, duplicate rejection, independent readback digest, signed-in-token access denial, concurrent RPC lease uniqueness, crash-recovery of pre-existing exact object, and atomic rank-row rollback on corrupt rank before classifying runtime acceptance. Store any external fixture IDs in a durable ledger. Do not put production provider credentials or user details in logs.
- Check Preview Edge secrets/egress parity **before** any Edge integration fixture. Deploy the function to Preview only for explicit disabled-path and reviewable synthetic acceptance. Production Edge deployment, activation and scheduling are separately authorized after the PR, with no silent cron changes.
- Execute one local consolidated critical suite and build, one PR with protected CI, then a native Production SQL rollout and independent read-only verifier. No frontend change or Finish Update.

## Remaining honest boundary

Even after this PR, **candidate evidence is not admitted to chart scoring**. A real prospective observation week and its independently replayable hash cannot be declared complete without lawful source approval, actual durable provider bytes, verified native periods and a nonpublishing weekly freeze. Do not simulate a week, call repeated snapshots new plays, or publish on the strength of synthetic tests.
