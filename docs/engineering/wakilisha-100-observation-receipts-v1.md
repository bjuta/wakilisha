# WAKILISHA 100: Observation Receipts v1

**State:** CLI-minted schema candidate. Not applied to Production and not a working collector.

## Authority

- Canonical migration path: `supabase/migrations/20261019152307_wk_chart_observation_receipts_v1.sql`.
- Minted on JB's accepted Mac with Supabase CLI **2.107.0** after clean fast-forward to `main` commit `2db7d1505c926a5e51529453feda7af8799481a7`.
- Production at inspection: **231** migration records, head `20261015091718`; zero active chart jobs; 18 published R&B editions. Existing editions are not touched by this change.
- Issue [#1260](https://github.com/bjuta/wakilisha/issues/1260). Pure ingestion kernel and source parsers are already merged.

## Database boundary

Four small product-level tables (not retired `chart_research_*`):

1. `wk_chart_capture_contracts_v1`: append-only, versioned *candidate* source specification. The schema cannot mark any source as approved. Frequency, native metric, chart depth, parser digest and Kenya scope are explicit.
2. `wk_chart_capture_attempts_v1`: one append-only receipt per contract, checkpoint and retry number. Stores status, raw-body SHA-256, private-object key, provider period proof and depth, or typed failure. The repeated fetch of the same chart is not additional consumption.
3. `wk_chart_capture_rows_v1`: immutable source-native ranks and available provider identifiers/observed title/artist. The row guard rejects malformed rank/depth or mismatched cardinal units. No direct Registry assertions.
4. `wk_chart_weekly_freezes_v1`: immutable, **blocked-only**, timestamped evidence digest and captured attempt IDs. A database trigger verifies references belong to the target week. `can_publish=false` is enforced by a SQL check.

The migration adds no scheduler, no service, no raw bucket, no source contract seed, no published edition and no automatic chart scoring. All four tables have RLS enabled, no policies, and only `service_role` SELECT and INSERT privileges. No browser or normal authenticated user can read or write them. BEFORE UPDATE/DELETE triggers block mutation even when privileged SQL is used normally. Security-definer validation trigger helpers have no client RPC execution rights.

**Evidence limits:** these tables do not themselves prove the HTTP response was lawful, official, uniquely Kenyan, or captured at the claimed time. A raw SHA-256 without a durable private object, independently checked against the actual bytes, is not enough. The future collector must store raw bytes in an approved private bucket or storage authority and verify both the digest and metadata. The weekly freeze hash remains an unverified producer claim until independent replay reproduces it. No storage bucket was invented here before its retention and access contract is accepted.

## Required acceptance order

1. Confirm branch scope and exact migration filename authority; inspect full migration diff.
2. Rebuild a clean disposable Supabase Preview through existing CLI deployment procedures. On historical replay failure, stop and diagnose instead of hot-patching the preview.
3. Apply only the new receipt migration in Preview. Run `scripts/control-plane/verify-wk-chart-observation-receipts-v1.sql` **read-only**.
4. Prove `anon`, ordinary `authenticated`, and privileged `service_role` negative/positive access with approved test connections. Verify append-only restrictions and cross-table receipt-row/freeze constraints inside the rollback-only `scripts/acceptance/wk-chart-observation-receipts-v1-preview.sql` fixture. Confirm no chart job was armed.
5. Prove no old R&B editions, Registry records or public API payloads changed.
6. Clean any Preview fixtures and seal acceptance evidence. Only after all checks may the candidate be committed, pushed and submitted to protected CI. Production SQL is a separate explicit gate, followed by verification. No Edge/frontend deployment in this schema-only slice.

## Subsequent slice

Build the credential-safe provider collector, private raw-data retention, monitoring, job schedule and a complete retrospective/prospective evidence replay. Sources remain candidate-only until the legitimate product constitution, source periods and editorial authority are accepted. Preserve the first WAKILISHA 100 publication and legacy edition-deletion work as separate later release gates.
