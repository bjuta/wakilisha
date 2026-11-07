# WK100 Phase 1 source-method candidate — NOT A MIGRATION

This file is the draft for the next **CLI-minted** migration, not executable
release authority. It records private, immutable method decisions separately
from candidate proposals and captured original provider observations.

An admitted-method event requires (a) the current proposal revision,
(b) real signed-in `manage_ingest` and `manage_charts` capabilities,
(c) an active `super_admin` assignment, and (d) source-specific parser
class, evidence digests, exact endpoint digest, a non-secret credential reference
and expiry. It does NOT prove provider consent, fill in absent original bytes,
configure private credentials, activate the collector or create a source contract.

**Still to prove before minting into `supabase/migrations`:** real
PostgreSQL 17 full-chain replay, current JWT role checks, expired/malformed
and race negatives, read-only verifier, exact CLI filename, data-less hosted
Preview proof and schema snapshots. No Production migration is authorized.

**Architectural gap still open:** the scheduler must read truly governed source
decisions and bind exact approved routes/credentials to the *existing*
`wk-chart-capture` worker. The source dispatch planner does not itself
provide network access, RPCs or cron. Complete this in the same integrated
Phase 1 PR with the native Admin W1/W2/W2A/W3 controls and real provider
method qualification.

No source is enrolled, enabled or admitted by adding this file.
