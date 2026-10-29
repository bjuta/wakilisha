# WK100 Shazam: Trusted Read-Only Registry Snapshot and Recording Review v1

**Programme:** #1264. **Status:** source-only engineering slice, not Registry admission, source collection, Production deployment, Edition scoring or publication. **Date:** 29 October 2026.

## Purpose and accepted authority

The first genuine Shazam Kenya Top 200 public CSV was downloaded by a researcher on 29 October 2026 at `19:41:23Z` and securely retained as original bytes on the operator Mac. The accepted observation contains **200 discovery ranks** and explicitly has **zero canonical Track matches**. The original SHA-256 is `771209bf966548f4594dab542bca1b9ffb3ec571f7441f5f41d2791c1e58ef17`. Native provider measurement dates remain unverified. This slice does not touch or re-download that CSV.

Existing authority is [provider identity / Registry / MIZIZI jurisdiction](provider-identity-registry-mizizi-jurisdiction-contract-20261006.md): source rank, title and artist are **observations**, not canonical identity. Exact normalized titles and artist similarities are **review candidates only**. Registry Tracks own canonical recording identity; the Registry's governed provider links, external-identifier assertions, review cases, and identity lineage remain the only admission/mutation authorities. No `shazam_ke:<rank>` pseudo-provider ID, auto ISRC attribution, new identity table, or fuzzy-matching write is permitted.

## Production read-only audit (29 October 2026)

The Production project `pgzizndxdyhqmtyywjmt` showed:

- **2,122 active** `registry_tracks` rows; all have syntactically valid and unique ISRCs (0 missing, 0 duplicated active, 0 invalid).
- Additional non-active Tracks remain in Registry: 48 archived, 6 draft, and 308 needs-review. They must not become accepted snapshot targets.
- **208 Track lineage events** in the existing lineage ledger; the live Registry/governance path must check successor/conflict state when admitting any later identity.
- Independent read-only SQL digest for the **ordered complete active ID/status/ISRC index**: `6c386e4fa95ed780bfcfecfbda67bfc1ee976c8483fa92a254c7df879949f864`.

This digest is a **time-specific independent authority observation**, not a permanent truth. If Registry changes before exporting, do not change the export to match a stale fingerprint. Obtain a new independently verified fingerprint from the accepted read-only control plane and use that new value explicitly. Do not commit Registry IDs, ISRC lists, secrets or exported bytes to GitHub.

## Read-only snapshot exporter

`scripts/charts/wk100-shazam-registry-snapshot-readonly.mjs` uses the repository's existing `pg` dependency. A guarded operator CLI may be invoked only with a privately provided `WK100_REGISTRY_DATABASE_URL` belonging to WAKILISHA Production and an **independently pinned** full-index digest.

- It permits either the exact Production direct host/username pair or the recognized Production project-keyed Supabase pooler identity; rejects wrong projects, wrong DB, unverified TLS mode and missing private credentials. Secrets are never echoed.
- Within a single `BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY`, it obtains every active Registry Track's UUID, status and ISRC ordered by UUID. A **separate database aggregate from that same snapshot** returns count, unique ISRC count, syntax errors, and a Postgres `pgcrypto` SHA-256 of the exact ordered record stream.
- Before constructing any snapshot, the exporter verifies all IDs, sorted order, active status, uniqueness, canonical ISRC, the server-computed checksum and the **independently supplied external digest**. A row omission, duplicate, stale index, duplicate/invalid ISRC or wrong source fails closed. A failed transaction issues `ROLLBACK`.
- It emits exactly `wk100-shazam-registry-snapshot-v1`: `{schema_version,as_of,coverage:'complete_active_isrc_index',tracks:[{id,status:'active',isrc}]}`. This shape is accepted by the already-merged `prepareShazamRegistryReview` API. `as_of` comes from the database transaction, not the operator's laptop clock.
- The full snapshot is created **only in a private operator-owned 0700 directory**, keyed by SHA-256, with a 0600 create-only file and independent readback. It returns only count/digests, never Registry IDs, ISRCs, or DB credentials to stdout.

**Independent-pinning requirement:** a submitter generating both an arbitrary snapshot and its own expected digest is **not** independent verification. The current expected index fingerprint came from a separate authenticated Production read-only SQL inspection. Passing the exporter tests does not automatically prove any future live export was independently pinned.

### Operator usage contract (not executed in this slice)

1. Obtain a narrowly scoped, verified Production **read-only** PostgreSQL connection in the existing Mac control plane; set `WK100_REGISTRY_DATABASE_URL` privately without pasting it into chat, terminal history, logs or GitHub.
2. Obtain or reconfirm the expected complete active-index fingerprint through an independent, authenticated Production read-only channel. The value observed on 29 October was `6c386e4fa95ed780bfcfecfbda67bfc1ee976c8483fa92a254c7df879949f864`; a subsequent Registry change requires a fresh fingerprint.
3. Run the following from an exact verified checkout of the accepted source branch:

```bash
node scripts/charts/wk100-shazam-registry-snapshot-readonly.mjs \
  --archive-dir "$HOME/.wakilisha-private/wk100/registry-snapshots" \
  --expected-index-sha256 '6c386e4fa95ed780bfcfecfbda67bfc1ee976c8483fa92a254c7df879949f864'
```

The command fails safely if the expected index is stale, credentials are missing, the project binding differs, the private directory is not secure, or database validation fails. A fresh expected digest must be independently reviewed, not calculated from an untrusted supplied file.

## Shazam recording reconciliation, not matching by appearance

The 200 Shazam rows still have `provider_track_id:null` and `recording_id:null`. The accepted `prepareShazamRegistryReview` function requires independently SHA-256-pinned CSV bytes, full active Registry snapshot, a separately pinned review manifest and row-specific source/identity evidence. Its reviewers must be distinct. A proposed Registry UUID/ISRC must be present as a single **active** identity in the snapshot, with the exact observed Shazam rank, title and artist and an independent recording-identity evidence reference. It returns a private **proposal**, not a canonical link.

The newly exported snapshot is a **candidate validation index**. It is not Shazam recognition-to-ISRC proof: a title and artist string can correspond to many versions, releases, remasters, edits or performances. There is no legitimate automatic Shazam-to-ISRC inference in the source CSV.

Before anyone approves an identity proposal, separately confirm evidence for the precise recording, check current Registry status and lineage after the snapshot, use the existing Registry review/typed operation authority, and independently verify the resulting write-event/identity lineage. Neither this exporter nor its test harness performs that action.

## Tests and release gates

Focused Node tests cover completeness/counts and independent hash, server/query mismatch, deleted or inserted rows, invalid/duplicate/unsorted IDs/ISRCs, archived IDs, a stale digest, transaction `ROLLBACK`, TLS/project constraints, private file ownership and readback, plus compatibility with the existing Shazam **review-only** packet. No tests can claim real identity approvals without actual rank-specific independent recording evidence.

**No Production mutations, new Supabase branches, SQL migrations, Edge deployment, provider requests, public Edition, or chart scoring.** A source-only PR should be opened only after full Mac acceptance at the exact tested HEAD, including the established Charts/critical-core and frontend build gates. Real read-only snapshot export is a separately observed operational acceptance, not implied by synthetic tests. Programme #1264 stays OPEN.
