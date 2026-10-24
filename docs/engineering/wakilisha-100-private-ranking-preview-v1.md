# WAKILISHA 100: Private Multi-Source Ranking Preview v1

**Issue:** [#1264](https://github.com/bjuta/wakilisha/issues/1264). **Status:** executable **offline, nonpublishing prototype**, not an approved methodology, source admission, Admin UI, or flagship launch. The `bjuta/wakilisha` repository is **public**. Never commit real provider identities, legal reference identifiers, private source evidence, actual adopted weights, or raw observations here.

## What works

- `scripts/charts/wk100-private-preview.mjs` validates a local candidate input and produces a deterministically ordered Top 100, each recording's operator count, rank-based contributions, coverage flags, and a leave-one-operator-out sensitivity audit.
- `scripts/charts/wk100-private-preview-cli.mjs` runs entirely offline without service credentials, HTTP calls, database or Registry writes. It takes one **private JSON input outside this repository**, hashes its exact bytes, and creates two local files in a **fresh, restricted directory outside the repository**: `private-audit.json` and `public-methodology-summary.json`.
- `private-audit.json` contains the source/operator keys, declared native periods, authority references, declared raw hashes, ranking contributions, proposed method input, all Top 100 positions, and sensitivity metrics. Classify this report as restricted.
- `public-methodology-summary.json` contains a human-readable methodology summary and scope caveat but **no provider keys, raw evidence digests, proprietary weights, or input names**. It is a draft, not a public deployment. The public file should not be released without editorial review.
- The algorithm is a **generic, deliberately provisional ordinal-rank consensus proxy**. Each private behavior family has a confidential weight and an explicit fixed number of operator slots. Missing operators retain their unfilled share: no reallocation. Rank snapshots are **not** plays, stream counts, votes, or new consumption events. The proxy is NOT the approved WK100 formula and must not silently replace v1.0.1 legacy scoring.
- Validation rejects unsupported data classes, non-Kenyan market, unknown periods, rank gaps, duplicate sources/operators/recordings, unsupported fields including injected counts, invalid Registry-shaped recording IDs, unknown/private method fields, insufficient native ranked depth, and mixed synthetic/approved candidates.
- Proposed thresholds for distinct operators, distinct behavior families, Top 100 cross-operator corroboration, and maximum operator share are supplied **privately at run time**. Passing these thresholds is a simulation result, **not proof** of Kenya-wide representation.
- Outputs always set `can_publish:false`; the private report also sets `can_promote_to_edition:false` and `can_write_registry:false`.

## Private input shape (synthetic illustration only)

The caller supplies a JSON object with precisely these top-level keys:

- `schema_version`: `wk100-private-preview-v1`
- `week_start_eat`: a Monday date, e.g. `2026-10-19`
- `dataset_mode`: `synthetic` or `authorized_candidate`
- `method`: `version` (`preview-...`), `behavior_weights` (positive weights totaling 1), `operator_slots` (reserved source counts per behavior), `minimum_operators`, `minimum_behaviors`, `minimum_corrob_tracks`, `maximum_operator_share`
- `sources`: between 2 and 8 independent operators, each described by `source_key`, `operator_key`, `behavior` (`consumption`, `discovery`, `video_consumption`, `broadcast_exposure`), `market=KE`, `expected_depth` (1–200), `native_period` (`starts_at`, `ends_at`, `evidence_ref`), `authority_ref`, `admission`, `raw_sha256`, and `entries`.
- Each `entries` row is exactly `{ "recording_id": "<MIZIZI UUID>", "rank": <ordinal> }`, ranked 1 through `expected_depth` without duplicates. A complete list, not invented zero-count gaps, is required.

The unit-test fixture has **four synthetic operator names**, 120 synthetic MIZIZI-shaped UUIDs, and **illustrative, non-authoritative** weights. Never substitute those test identifiers or ratios for real admission or production methodology.

**Critical evidence limits:** A well-formed `authority_ref`, `raw_sha256`, `native_period`, or UUID is **not** independently attested here. This offline program does not read the original provider response to validate its hash, check any actual partnership or user contract, verify provider-native period truth, consult MIZIZI, assess source representativeness, or prove a real source had a lawful capture method. `authorized_candidate` is an operator assertion, not a permission grant.

## Run locally, only after preparing a private data manifest

On an accepted local checkout with Node.js 22 or another version supporting `structuredClone`, put an authorized or synthetic manifest **outside** the repo in a non-world-readable file. The paths below are placeholders: their existence is not asserted.

```bash
chmod 600 "$HOME/Private/WK100/private-preview-input.json"
node scripts/charts/wk100-private-preview-cli.mjs \
  --input "$HOME/Private/WK100/private-preview-input.json" \
  --output-dir "$HOME/Private/WK100/preview-20261019-01"
```

The output directory **must not exist**, and its parent must be outside the public repository and not world-writable. The CLI refuses symlinked input and publicly readable source input. The output folder and both files use 0700 and 0600 permissions, respectively. It never overwrites a previous report. The process prints success or a typed error **without dumping private input**.

Run synthetic acceptance from the repository root:

```bash
node --test test/charts/wk100-private-preview.test.mjs
```

The protected Critical Control Plane also executes this deterministic local-only suite. No credentials or live provider calls are necessary.

## Next real engineering work, not conflated with this proof

This is a **working local preview foundation**, not the promised signed-in Admin Charts workbench. The next slice must wire **actual, separately governed private source intake** (authorized provider delivery, API, or vetted offline file) to the already deployed private evidence, immutable receipt and MIZIZI identity authorities. It must prove server-only privacy and leakage resistance before adding a private Admin API. The actual proprietary formula must reside in a protected server-side authority, not public git or frontend JavaScript.

Do not create Production fixtures, enable `WK100_CAPTURE_ENABLED`, call disputed providers, create new cron jobs, publish a chart, or change scoring authority based on this preview. Existing [source-admission register](wakilisha-100-source-access-admission-register-v1.md) remains fail closed; **zero WK100 source methods are authorized for autonomous Production collection**. Issue #1264 remains open.
