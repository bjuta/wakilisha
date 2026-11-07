# WK100 Phase 1: Service Scheduler Boundary and Release Inventory

**Status:** Candidate implementation only. This document does not admit a real source, activate a timer, apply a migration, enable provider access, establish a qualifying week or grant publication. This belongs to the existing [four-phase control plan](./wakilisha-100-four-phase-delivery-and-admin-handoff-v1.md) and issue #1338.

**Local acceptance operation:** Before running another WAKILISHA 100 PG17/GoTrue/Storage acceptance on the Mac, follow [WK100 isolated local Docker coexistence and acceptance](./wk100-disposable-local-docker-coexistence-and-acceptance-v1.md). The operator-reported 5 November 2026 245-migration disposable PASS does not itself authorize hosted source capture, scoring or release.

## One collector, separate authorities

1. W2A appends a *candidate* source proposal. An ordinary proposal does not start a job.
2. A signed-in reviewer records a separately audited method decision. A reviewed `collector_admitted` decision requires an active super-admin and exact proposal revision, approved native parser, real source-method evidence identifiers, endpoint SHA-256, credential reference and bounded expiry. Retirement is terminal. Source proposals and reviews share a per-source transaction lock.
3. A signed-in super-admin independently enrolls an exact immutable **candidate capture contract**, using current proposal and method decision revisions plus a reviewed adapter-code SHA-256. The enrollment RPC shares the per-source advisory transaction lock, records immutable operator provenance, allows only one initial capture contract per source, and returns `canCollect=false`. Direct `service_role` table insertion is revoked. No operator can make a collector-ready source by writing a contract directly.
4. A service-only database function returns a method only when its *latest decision* and the *latest proposal* agree and the independently enrolled contract matches exactly. It exposes metadata, never a provider URL or credential. A separate service-only Boolean function checks source, contract version, endpoint SHA, credential reference and parser class at capture time.
5. A sealed server manifest independently pins the concrete HTTPS endpoint and allowed method. Both the scheduler **and direct capture worker** require the exact currently approved constitution version; a service-role token alone cannot bypass it.
6. The proposed `wk100-source-scheduler` Edge function computes current EAT slots from the accepted kernel. It reads attempt history, plans bounded nonpublishing jobs only for current admitted contract versions, and invokes the existing `wk-chart-capture` worker. The worker independently rechecks current method admission before reservation and before network transport. Existing PostgreSQL leases and immutable raw-Storage receipts remain authoritative.
7. No code in this path admits evidence for scoring, edits MIZIZI facts, or publishes a chart. All returned `canScore` and `canPublish` flags remain false.

## Runtime dependencies requiring independent preflight

| Dependency | Location | Required proof before hosted fixture |
| --- | --- | --- |
| Legacy signed service-role JWT | Supabase gateway, caller Authorization and apikey | Verify gateway JWT validation is active and token's signed project ref matches the target. Never print token. |
| `WK100_CAPTURE_PROJECT_REF` | Both Edge functions | Check exact project-ref metadata. The project API URL is derived from the verified signed JWT, not a request body or untrusted URL. |
| `WK100_SOURCE_SCHEDULER_ENABLED` | Scheduler Edge function | Explicit true only following release authorization. Default absent or false. |
| `WK100_CAPTURE_ENABLED` | Both Edge functions | Explicit true only following release authorization. Separate runtime secret inventory per function. |
| `WK100_SOURCE_CONSTITUTION_VERSION` | Scheduler and Capture Edge functions | Same exact founder-approved constitution version on BOTH functions. Direct service-role capture calls must fail closed if it is absent, expired, or no longer current. |
| `WK100_CAPTURE_SOURCE_MANIFEST` and `WK100_CAPTURE_SOURCE_MANIFEST_SHA256` | Both Edge functions | Confirm byte-identical manifest and SHA seal, exact reviewed endpoint, credential identifier, parser class, native period key and expiry. Do not log manifest contents. |
| `WK100_APPLE_MUSIC_DEVELOPER_TOKEN` | Capture Edge function only, when Apple route admitted | Check presence and provider route permissions, not value. Credentials can travel only to Apple's `api.music.apple.com/v1/catalog/ke/charts` with `types=songs&chart=most-played`. |
| `wk-chart-raw-evidence-v1` private Storage and capture SQL RPCs | Exact Supabase project | Full migration replay, bucket ACL, SHA-256 byte readback, create-only object name, three-minute lease and live role revocation proof. |
| Timed trigger | Not created by this branch | Establish an explicitly approved service-only five-minute source using an accepted Supabase scheduling mechanism. Prove Preview service secrets and ingress first. Never create a live cron while collection is disabled. |

For Preview, compare the presence of every required custom Edge secret with Production without printing values. Verify origin, method, gateway JWT, requested client class and complete external path separately. A healthy database Preview alone does not establish runtime readiness. Never use Production credentials or immutable acceptance fixtures in a data-less Preview without accepted authorization.

## Scheduler semantics and safeguards

- The scheduler accepts no source, URL, timestamp, or credential from the request. Only a verified service-role caller may invoke it. Disabled calls do no DB or provider work.
- Every invocation uses the current EAT week, the signed-infrastructure project boundary, and the latest service-only database decision. The manifest admits no source by itself.
- Each job must fall inside the existing twenty-minute native EAT slot. There is no fabricated backfill, no second independent source observation from retries, and no unauthorized historic period projection.
- Jobs are limited to four per trigger. The exact worker SQL reservation and lease decide whether concurrent callers own a slot. An Edge retry or timeout is not evidence of a successful capture.
- Quarantined, stale, superseded, expired, conflicting, or partially recorded observations remain blocked. Operator recovery must not invent or overwrite captured bytes.
- The scheduler itself is not yet registered with a timed trigger. It is *not* proof of automatic recurring operation.

## Remaining Phase 1 acceptance and release holds

1. CLI-mint the **single forward method migration** using the accepted Mac Supabase CLI after isolated PG17 acceptance, then generate real data-less Preview schema and replay receipts. Never invent a timestamp or apply SQL directly to Production.
2. Run full fresh migration-chain GoTrue/Storage and both protected Edge endpoints against a Preview with proved secret parity. Verify service and non-service JWT denials, current-method pause/revocation between planning and transport, concurrent slot reservation, malformed provider response quarantine and raw-byte SHA readback.
3. Qualify all six source-method dossiers. Founder must explicitly approve real source access and native reporting intervals. No synthetic digest, source label, or test token qualifies a provider.
4. Activate a genuine timed trigger only after accepted release authorization. Prove **two successive prospective EAT weeks** automatically without weekly code, SQL, downloads or manual provider files, including missingness and incidents. Synthetic two-week timing tests prove only the mechanics.
5. Complete W1/W2/W2A/W3 Admin recovery, incident control and immutable review history. Keep scoring, MIZIZI identity mutation and publisher authority separate throughout.

Until every conjunctive exit gate is proven, Phase 1 remains **open**. A green PR or merged candidate code is not itself an unattended-source or Production launch authorization.


## Additional direct-worker and multi-version protections

The capture worker enforces the exact current constitution version independently
of scheduler dispatch, on initial admission and again just before source
transport. A service-role token by itself cannot bypass constitution approval.
For each source ID, only one admitted contract version may be dispatched.
Historical candidate contract versions do not block a newer admitted contract;
competing admitted versions fail closed until an explicit operator resolution.


## Immutable adapter-digest binding

The separately enrolled capture contract's `adapter_sha256` must equal
the SHA-256 pinned in the byte-sealed source manifest. Both scheduler planning
and direct worker capture reject missing, malformed, or divergent digests.
The parser *class* and `adapter_version` must also match. Reviewers must
derive the accepted digest from the actual adapter artifact, not from a
browser-supplied claim. This check does not itself establish external provider
permission or collection readiness.

## Contract-enrollment authority (candidate; not a completed release)

The method-review Edge endpoint supports the separate
`enroll_capture_contract` action. The client supplies only source key,
contract version, reviewed adapter SHA-256, and exact expected proposal/method
revision numbers. The server forwards the caller's GoTrue JWT; it never uses
a service-role token for Admin requests. Only PostgreSQL may create the
contract and append `platform_private.wk100_capture_contract_enrollments_v1`
with actual actor provenance. The native Admin confirms all returned
identities and nonpublishing flags; an unconfirmed response remains a failure.

The baseline `service_role` grant on `wk_chart_capture_contracts_v1`
is deliberately narrowed to SELECT. No public or authenticated direct INSERT
grant is introduced. The sealed source manifest and founder constitution remain
independent. Contract enrollment is a prerequisite, never the final authority.

**Acceptance still pending for this addition:** isolated PG17 real-role test
must exercise direct service-role INSERT denial, denied editor enrollment,
accepted super-admin enrollment, stale proposal/decision denial, duplicate
contract denial, immutable enrollment audit and no durable fixture after
rollback; real GoTrue/hosted Edge tests and clean CLI replay must follow.
