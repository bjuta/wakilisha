# WAKILISHA 100: Private Raw Source Evidence v1

**State:** migration candidate only; minted on accepted Mac with Supabase CLI 2.107.0, **not applied to Production**. This document describes the intended boundary, not a working collector.

## Exact authority

- Issue: [#1264](https://github.com/bjuta/wakilisha/issues/1264). Parent issue #1260 is closed; runtime evidence acceptance remains outstanding.
- Existing protected main: `5ac753fa92be084f83bf473806cb6b98f8e34f36`.
- CLI-minted filename: `supabase/migrations/20261019203244_wk_chart_private_raw_evidence_v1.sql`. Never remint, regenerate, or rename it.
- Exact predecessor migration: `20261019152307_wk_chart_observation_receipts_v1.sql`; accepted Production history was 232 migrations.

## Boundary introduced by this one migration

Create **one** Supabase Storage bucket, `wk-chart-raw-evidence-v1`, with `public=false`, max payload **4 MiB (4,194,304 bytes)**, allowlisted MIME types `application/json`, `text/html`, `text/csv`, `application/octet-stream`, and no storage versioning or automatic lifecycle deletion. No Storage RLS policies are added. All existing `storage.objects` policies are for the four named, unrelated media buckets; the migration fails closed if their current scope drifts.

No bucket content, source contract row, receipt, user policy, scheduled job, Edge Function, or chart edition is created. Existing media buckets remain unchanged. The 18 accepted published historical R&B editions must remain untouched.

## Future server-only uploader contract (NOT delivered here)

1. An independently admitted source contract, legally usable origin, authenticated provider endpoint if required, expected native publication period, rate limit and approved EAT slot are required **before** any collection. A parser fixture is not authorization to poll a live provider.
2. Stream response bytes under an explicit timeout and **4 MiB cap**, reject redirects to unapproved origins, distinguish network failures from HTTP failures, and classify partial/censored source depth. Never print provider tokens or raw protected responses in public logs.
3. Compute SHA-256 over **exact captured bytes**. Use a collision-resistant private key in a stable versioned form such as `v1/YYYY-MM-DD/source_key/YYYYMMDDTHHMMSSZ-attempt_number/sha256.ext`, respecting the pre-existing receipt `raw_object_key` constraints. No arbitrary raw HTTP URL may enter a receipt.
4. Use the **service-role server-only Storage client**, `upsert:false` and a unique path. Confirm the object exists by **download from the private Storage API**, independently compare bytes and SHA-256, then insert the immutable capture attempt and ranked rows. Partial writes, object-orphan reconciliation and retries require explicit acceptance; an API upload success alone does not establish durable evidence.
5. Never expose a bucket public URL, publish a signed URL, send raw bytes to a browser, rewrite existing objects, convert discovery counts into streams, or grant a capture receipt any scoring/publication authority.

**Limit:** This bucket is private, but Storage service-role holders and infrastructure administrators still have elevated mutation authority. SQL alone does **not** prove permanent byte immutability, prevent administrator deletion, or guarantee retention. Do not call it an append-only raw archive until an accepted create-only uploader, audit/retention controls, no-overwrite tests and independent byte readback are proven. Storage lifecycle is deliberately not activated before a product retention decision; this also means long-lived storage costs require explicit monitoring.

## Required gate sequence

- Stage only four files from the accepted minted path. Verify exact SHA-256 checks, no broader diff and Bash 3.2-compatible staging.
- Replay the existing 232 migrations on the already-approved disposable WK100 Preview, if it still exists and remains isolated. Apply only the new migration through the **native Supabase CLI**. Do not use a raw-SQL or connector-generated migration helper. Do not presume Preview secrets inherited Production.
- Run `scripts/control-plane/verify-wk-chart-private-raw-evidence-v1.sql` read-only; then run rollback-only `scripts/acceptance/wk-chart-private-raw-evidence-v1-preview.sql` to prove anonymous/authenticated denial and service-role metadata visibility. Confirm no fixture rows or objects remain. These checks do **not** prove a live Storage upload.
- Separately prove real Supabase Storage API upload/download with temporary fixture bytes and replay digest under an accepted Preview runtime-secret parity audit **before** writing a collector. Stop on any first unexpected failure. Clean up fixture objects using an approved evidence ledger.
- Prepare repository schema types/baseline and migration replay proof using the pinned CLI workflow, then protected CI. Only after all gates may this become a PR and a distinct controlled Production SQL promotion. No new chart polling, scoring, publication or frontend release is included.

## Explicit exclusions

No data-source constitution, provider transport, source scheduler, broad Storage policy, publication change, direct Registry write, historical R&B edition deletion, new chart study or D11/D11B resurrection. Finish Update and Edge deployment are not part of this schema-only boundary.
