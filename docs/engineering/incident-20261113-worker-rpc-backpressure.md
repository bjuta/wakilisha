# Production PostgREST schema-cache retry storm: 13 November 2026

## Independent read-only log evidence

Window: **18:03–18:20 UTC**, after `public-content-read` v119.

- 1,149 PostgREST log events.
- 524 `PGRST002` messages: `Could not query the database for the schema cache. Retrying.`
- 246 log events for `/rpc/recover_expired_media_processing_jobs_v1`.
- 246 log events for `/rpc/recover_expired_messages_legal_disclosure_jobs_v1`.
- 30 PostgreSQL log events; seven timeout mentions.
- A separate trivial read-only SQL connection (`SELECT 1`) still failed with a connection timeout.

These are **log entries, not proof of 246 distinct SQL executions**. The workers' request paths and `Python-urllib` client class match the existing Lightsail Python worker code.

## Confirmed source-level amplification

1. `ops/media-processor/worker.py` retries its recovery and claim RPC sequence after any loop exception using a fixed `POLL_SECONDS` delay (default five seconds).
2. `ops/legal-disclosure-worker/worker.py` makes its initial recovery request **outside** the retry loop. If PostgREST returns 503, the process exits; the installed `Restart=always` and `RestartSec=5` can then produce another request almost immediately. A failed recovery inside the loop also returns to the five-second poll delay.
3. Both polling RPC clients previously allowed up to 120 seconds of blocking socket activity.

## Scoped engineering correction (not deployed)

- Keep existing RPC names, payloads, service-role auth, authorization, job leases, receipt and retry-state semantics.
- Set polling-only HTTP read timeout to 10 seconds. Long-running job RPC calls retain their previous 120-second default.
- Retry transient worker-loop failures with bounded exponential backoff and jitter, capped at 120 seconds. Reset delays after a successful recovery and claim.
- Move initial Legal recovery inside the supervised loop, so transient PostgREST errors no longer restart the entire process every five seconds.
- Add a self-contained offline Python 503 simulation invoked by `test/ops/incident-20261113-worker-backpressure.test.ts`, and include that test in the existing `test:critical` command. No new CI workflow.

## Production acceptance / release gates

1. Before deployment: run Python compile checks and focused offline 503 simulation on the exact commit. Verify no failing established Media/Legal tests.
2. On Lightsail: **read only**, verify actual deployed worker source SHA-256 and systemd `ExecStart`, `Restart` and effective live service state; do not assume repo files are current Production binaries.
3. If live source differs from the checked baseline, stop and reconcile drift. Never overwrite an unknown deployed worker.
4. Deploy **only** the two worker files, preserving secure service-role secrets, env files, systemd hardening, media files and job stores. Keep exact pre-change backups and Python compile gates before service restart.
5. Restart services one at a time, verify process stays active, recovery failures back off rather than restart, and watch PostgREST `PGRST002`, 503, and RPC request volume after activation.
6. Restore exact prior source and restart from backup on any new failure.
7. Do not declare DB healthy until SQL connectivity, memory, Disk I/O and selected critical authenticated calls have actually recovered.

No SQL changes, Supabase compute change, Registry correction, WK100 source programme work, or infrastructure addition is authorized by this worker correction.
