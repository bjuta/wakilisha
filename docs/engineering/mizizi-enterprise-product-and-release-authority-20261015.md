# MIZIZI Enterprise Product and Release Authority

**Current as of:** 15 October 2026 (Africa/Nairobi).
**Status:** Binding product direction and honest engineering status. This document does not authorize a grant, migration, external customer connection, Production promotion, or PR merge.
**Repository:** `bjuta/wakilisha`. Active implementation: [draft PR #1227](https://github.com/bjuta/wakilisha/pull/1227), [Slice 1 issue #1226](https://github.com/bjuta/wakilisha/issues/1226).
**Evidence boundary:** Last independently verified source and CI commit before this documentation pass: `733b845234c5fa102f54f78696e1c7c263f71bc0`. Any later documentation commit requires its own exact-commit CI; it does not inherit green status automatically.

## 1. Commercial north star and product identity

**Build MIZIZI as licensable enterprise cultural intelligence and data-governance infrastructure, not merely a WAKILISHA administration feature.** WAKILISHA is the first implementation and proving ground. The potential market includes Universal Music Group, Sony Music Entertainment, Warner Music Group, and downstream independent labels, publishers, distributors, rights administrators, and catalogue owners. These are **intended customer classes**, not contracted customers, confirmed design partners, available integrations, or evidence of purchasing intent.

An authorized catalogue operator should eventually be able to connect a permitted catalogue, observe changing external and first-party evidence, investigate unfamiliar identity/credit/recording/rights-claim discrepancies, retain dated contradiction and source lineage, compare suggestions with independent adjudication, execute only permitted verified operations, and export correction receipts to agreed recipients. Its own catalogue remains under its own authority; MIZIZI must not replace the customer's canonical catalogue or silently rewrite musical, legal, or cultural truth.

Protect the governing WAKILISHA distinction: **do not primitive the culture; primitive the governance.** A Person, Artist persona, Recording, Track, Work, Release, credit, right, and commercial relationship have distinct semantics and provenance. Similar names, provider IDs, and model confidence are not identity or legal authority.

## 2. Three meanings of licence must never be conflated

1. **Commercial software licence:** a contractual customer right to use MIZIZI software, APIs, a managed service, or an approved private deployment, with explicit data-processing, security, SLA, usage, and support terms. Pricing, procurement, exclusivity, data residency, and deployment model are not yet agreed.
2. **MIZIZI operational stewardship licence:** a scoped, revocable, expiring governance capability for an exact claim family, action family, tenant, policy version, and verified evidence standard. A high model score or a passed regression scenario cannot issue or expand it. T4 and Never Licensed restrictions remain binding.
3. **Underlying music, evidence, and source rights:** copyright, neighboring/related rights, creator permissions, provider terms, and rights of evidence disclosure. Neither a commercial software licence nor an internal stewardship licence transfers them.

Enterprise tenants must not be required to license their private datasets into WAKILISHA's Registry or train a cross-customer model. Shared learning, if any, is allowed only where the contract and legal/source permissions expressly authorize it; otherwise models, evidence, retention, and learning remain segregated. Useful reusable methods may be measured across customers only using lawful, nonleaking aggregates and separately approved controls.

## 3. What exists today, with strict evidence levels

| Capability | Verified engineering state | What is not claimed |
|---|---|---|
| Canonical WAKILISHA Registry and reviewed mutation receipts | Existing Production Registry, typed exact grants, human review and independently verified historical operations are reused. | No new autonomous MIZIZI Production canonical writer. |
| Durable case and observation memory | Slice 1 DB01/02/03/05, case journal, snapshots, observation replay fence, source-bound admission, and access/hold primitives installed in isolated Preview. | No operational multi-customer learning memory or continuous first-party learning cohort. |
| Shared job/outbox integration | Typed `mizizi.case_research_v1` research-job route reuses `platform_private.jobs`, receipts, leases, retry/recovery and exact case binding. Disposable PostgreSQL/JWT checks passed. | No continuously scheduled Production MIZIZI worker, active Preview research-job backlog, or proven million-job capacity. |
| Real operator controls | Signed-in localhost browser against isolated Preview proved one internal owner bootstrap and a real issued/released audited Hold Writes. Other role, concurrency, worker, and hold negatives ran in disposable local CI. | Not public-hosted Preview parity, a Production Headquarters acceptance, or a real queued canonical Registry writer under hold. |
| Historical D1/D2/D3 integrity | Current read-only Production audit: DESIRE decision recorded and review open, blocked on archived Artist alias credit; Ficha and Colors completed through their already verified historical repair receipts. Read-only UI reader verifies all three separate decisions or returns unverified. | No DESIRE canonical repair, repeated Ficha/Colors operation, or signed-in Production browser proof of the new generic view. |
| Independent learning and calibration | Architecture and planned source/claim/outcome contracts are defined. Existing Registry provenance is reusable. | No running model-assisted open-world research loop, independently sampled accuracy windows, measured self-improvement, or earned automation licence. |
| Partner isolation and delivery | Required tenancy, permission, and delivery contracts are specified for Slice 3. | No real second enterprise workspace, contracted customer, authorized downstream delivery ACK, or cross-tenant Production proof. |

**Live control snapshot, read-only, 15 October 2026:** isolated Preview project `nkgfoppunmnkcumalxqp` contains 230 applied migrations, head `20261014182214`, one internal workspace and one unrevoked owner membership, zero durable cases, zero recorded case observations, zero research jobs, zero active learned licences, and zero Registry reviews. Its research command type is registered; there is no `registry.%` queued canonical writer command type. Production project `pgzizndxdyhqmtyywjmt` remains at 216 migrations, head `20261009181647`, without these Slice 1 Headquarters migrations.

**Acceptance scope:** original frozen 40-scenario ledger v15: 38 `LOCAL_EXECUTED`, two `PARTIAL_EVIDENCE` (C17 and H37, expressly assigned to Slice 3 by owner decision), and all 40 `production_acceptance=NOT_RUN`. The latest pre-documentation protected workflows are [Critical #38697260006](https://github.com/bjuta/wakilisha/actions/runs/38697260006) and [Disposable PostgreSQL/real JWT #38697259875](https://github.com/bjuta/wakilisha/actions/runs/38697259875), all five jobs successful on `733b8452`. This does not accept a deployed release.

The original scenario matrix is a regression inventory, **not** the limits of the brain, an actual customer accuracy dataset, a training cohort, or a claim of scale. Prototype `mizizi.html` organisations, licence charts, nightly counts, and activity are fictional design references.

## 4. Binding enterprise architecture tests

- **Client ownership and portability:** typed catalogue import/export, durable provenance, explicit provider/source terms, customer-selectable retention, verifiable deletion and segregation, replaceable adapters, and contractually defined data location. MIZIZI must not consume customer credentials or export private evidence outside an approved scope.
- **Open-world investigation:** new observations can create typed uncertainty and safe research without being pre-enumerated as forty scenarios. A novel family defaults to investigate/hold/request-human; it does not inherit mutation permission.
- **Independent learning:** predictions and source confidence are frozen before a separate authorized human/outcome verdict. Maintain a dated replay and prospective holdout set, stratification, severity-weighted false merges, source independence, provider/territory drift, calibration uncertainty, disputes, and revocation triggers. Automatic decisions must never grade themselves.
- **Bounded actions:** use existing Registry or authorized customer adapters with exact operation family, frozen evidence and target set, independently issued short-lived grant, execution-time hold/licence recheck, independent verifier, finalizer, and durable receipts. Never run arbitrary model-authored SQL.
- **Tenant security:** separate private catalogue/evidence/permission stores or verified row-level tenant policy, deny unauthorized reads, including counts/search/timing/cross-tenant shared IDs. Separate customer identities, operators, technical support, and governors. Real second-tenant exercise belongs to original C17 in Slice 3; no fake partners.
- **Recipient delivery:** separately licensed, consented connections with source-specific visibility, per-recipient idempotent correction versions, partial ACK/rejection handling, no fictional claim a recipient adopted a change.
- **Economic scale:** measure checks, unique observations, research jobs, adjudications, verified canonical mutations, and delivery attempts separately. Test sustained throughput, backlog age, per-job cost, p95 latency, retry, dead-letter, source quotas, and independent mistake rates at realistic and synthetic volumes. A goal of millions of daily checks/jobs is a **target, not benchmark evidence**.

A paid enterprise buyer's acceptance requires convincing outcomes on a consented, representative catalogue: meaningful precision/recall or appropriately calibrated risk, reproducible avoided or corrected errors, measurable human effort saved, bounded financial/provider cost, secure isolation and deletion behavior, integration success, and auditable incident/recovery performance. No major-label endorsement, pilot, data licence, or procurement is implied.

## 5. The three existing slices, with enterprise exit meaning

**Slice 1, now:** complete reusable, securely governed case/job/decision/recovery Headquarters. No additional framework, enterprise tenant, new queue, or autonomous Registry writer. Close the existing draft only after authentic D1 blocked / D2-D3 completed browser evidence, remaining source and authorization review, signed-in role and mobile/desktop checks, exact CI, and the existing separate protected Production SQL/frontend promotion gates. Current work should converge on exit, not new unit-test families.

**Slice 2, next:** implement lawful incremental sources, provenance and contradiction memory, independent bounded model/provider research, public/contributor permission-aware Cores, challenges, and shadow outcome calibration. Require an **unfamiliar, source-supported case** to be researched and durably preserved, independently adjudicated, then used to demonstrate a measured prospective evaluation improvement without acquiring write authority.

**Slice 3, after Slice 2:** implement tenant and customer isolation, genuine queued canonical Registry writer under hold, scoped earned licence governance and revocation, customer export/ACK, full operational scheduling, and production-scale load/cost/accuracy proofs. Original C17 genuine two-workspace case boundary and original H37 queued canonical writer denial are mandatory, not waived. Seek a consented nonmajor catalogue pilot before claiming global-major readiness.

These are the existing three slices. Do not add phases or defer all enterprise requirements until the third slice: define compatibility, privacy, retention, contract portability, and measurement from the first.

## 6. Current release gates and next bounded engineering work

1. Classify the **existing Production** unrestricted `authenticated SELECT USING (true)` policies and SELECT grants on `public.registry_review_items` and `public.registry_canonicalization_decisions`. Verify intended consumers, record field sensitivity, and exercise real privileged/nonprivileged browser and API calls. This is a confirmed database policy surface, **not yet a proven vulnerability or authorization bypass**, and is not a reason to blindly change live RLS.
2. Independently verify the generic Headquarters renders D1 blocked and D2/D3 resolved from the exact Production historical receipts; do not replay or alter those repairs. Preserve DESIRE's open review.
3. Complete owner-accepted desktop/mobile and authenticated release gates, CI consolidation, evidence sealing and Production isolation preflight. Commit/merge and promote only through the existing explicit approved release sequence, with separate SQL, frontend and post-deploy receipts.
4. Then start Slice 2 against one genuinely new, source-backed, permission-safe research and learning outcome, with a measured feedback loop.

**Promotion matrix right now:** new SQL: no; Edge: no; Production frontend/Finish Update: no; PR merge: no; no new grant, rebootstrap, or customer data import. The current documentation pass may update the draft branch, but must not alter migration/test classifications or present itself as Production acceptance.

## 7. Change discipline and source authority

Live deployed state outranks accepted receipts, which outrank repository contracts and older design notes. Keep early 10–14 October design/Preview acceptance documents as historical snapshots, not fresh deployment statements. Changes must carry exact SHA and protected CI. No silent schema repair, fictitious metrics, duplicate infrastructure, unauthorized customer data, or stale permission assumptions.

Authoritative companions: [Architecture](mizizi-headquarters-product-architecture-v1-20261010.md), [code-change register](mizizi-headquarters-code-change-register-v1-20261010.md), [three-slice exit contract](mizizi-headquarters-implementation-exit-contract-v1-20261010.md), [original forty acceptance ledger](mizizi-slice1-original-40-scenario-acceptance-ledger-20261014.json), and [historical #1094 evidence](mizizi-actual-run-learning-1094.md).
