# WAKILISHA 100: Four-Phase Delivery and Final Admin Handoff

**Status:** controlling delivery plan, not implementation acceptance or permission to deploy or publish.  
**Date:** 2 November 2026 (EAT).  
**Delivery issue:** [#1338](https://github.com/bjuta/wakilisha/issues/1338).  
**Source and editorial authority:** [#1264](https://github.com/bjuta/wakilisha/issues/1264).  
**Accepted code baseline:** [PR #1333](https://github.com/bjuta/wakilisha/pull/1333), merged as \`561a323503a21184a36c8e5453c0024d329b8abc\`.

## 1. Product Contract

Deliver **one** Admin-operated, multi-source weekly WAKILISHA 100 chart of music consumption and discovery in Kenya. The complete path is:

**Qualified source -> automatic original-evidence collection -> recording deduplication -> MIZIZI and Registry reconciliation -> full eligibility evaluation -> human metadata correction and deterministic re-evaluation -> reproducible private Top 100 -> independent editorial approval -> explicit per-week publication.**

The Admin is an editor and decision-maker, not a weekly downloader, file uploader, developer, or database operator. Regular weeks must work without GitHub, SQL, Supabase Dashboard, CLI, secrets changes, code patches, or engineer-authored source files.

These are **four acceptance phases inside one existing delivery issue**, not four products, new tracking issues, or automatic permission to add permanent CI tests. Parallelize independently testable work when safe, while retaining the exit gates and final handoff.

**No surprise flagship:** collection, scoring, CI, merge, deployment, staging, and green health checks never authorize public release. A first public WAKILISHA 100 Edition needs a separate, explicit founder launch instruction. Later Editions still need an authorized, auditable Admin decision for their exact frozen EAT week. Do not implement automatic public publication.

## 2. Audited Starting Point (not release authority)

On 2 November 2026, current merged \`main\` and independent read-only Production checks established:

- Production \`pgzizndxdyhqmtyywjmt\` held **236 migrations**. The three forward WK100 migrations \`20261102084046\`, \`20261102084049\`, \`20261102084052\` had not been applied. Recheck exact live state before any deployment.
- Legacy ingest had **21 runs, 10,216 raw observations**, and predominantly Spotify/Apple playlist sources. These are historical, **not** a current qualified WK100 observation period.
- Existing Registry Artists and Tracks and the MIZIZI chart broker provide real reuse value. They are not permission to mint canonical identities from uncertain provider rows.
- \`chart-ingest-api\`, \`chart-provider-fetch\`, and \`wk-chart-capture\` have been deployed; WK100 capture contracts, capture attempts, captured rank rows, and weekly freezes were **zero**.
- The guarded WK100 publisher SQL exists in Production, including source admission, replay attestation, independent editorial approval, staging, publication and identity-link controls. The associated private ledgers were **all empty**. Deployed SQL does not prove a working Admin publication path.
- WK100 had **zero Editions and zero published entries**.
- WK100 generic dry-run and publish actions are intentionally blocked in the old Ingest UI. The frozen full-filter stage is review-only and does not authorize scoring. The current preview displays only 20 flagged rows.
- Eligibility profile, market scope and methodology definitions have browser-local persistence in the legacy path. A shared, reviewed server-side version must become authoritative for WK100.
- The existing \`origin_iso2\` queue and reset of downstream eligibility/scoring stages are the pattern to generalize, not rebuild.
- Critical merged-main checks were green at this accepted SHA. That is not end-to-end source, operator, or Production acceptance.

**Never promote historical documentation or a passing isolated test to current Production authority.**

## 3. Authority and Reuse Map

| Boundary | Reuse | Do not create or bypass |
| --- | --- | --- |
| Original source collection | \`wk-chart-capture\`, private Storage, capture receipts, EAT kernel and existing parsers | A second collector or source evidence ledger |
| Provider enrichment | Existing Apple/Spotify discovery and metadata logic where current access is verified | Assumed public playlist availability or obsolete API guarantees |
| Recording identity | Legacy candidate normalization, MIZIZI-governed Registry Artist, Track, credit and origin operations | Automatic recording merge from similar title/lead Artist |
| Eligibility | Frozen policy snapshot, full-filter evaluator and review-only stage | Another partial filter engine, or invented claims of 104 executed rules |
| Corrections | Artist-origin review/reset, audit events, governed Registry broker | Destructive provider-evidence edits or silent published-Edition reset |
| Ranking | WK100 private evidence and replay kernel | Generic playlist occurrence counts treated as comparable weekly streams |
| Publication | Installed WK100 governed admission, attestation, approval, staging and publish RPCs | Direct V2 writes, service-key exposure, or generic \`publishImmediately:true\` |
| Admin experience | Existing Charts Ingest, Review, No Match, Artist Resolution and Editions surfaces | Fragmented developer-dependent steps for a normal week |

The binding cultural model is **assertion -> evidence -> review / reconciliation -> canonical fact**. Editorial decisions are not Registry facts, and a Kenya chart appearance does not imply an Artist's \`origin_iso2\`.

## Phase 1. Multi-Source Collection and Automated Research

**Goal:** qualified, replayable Kenyan music evidence is captured every week without ordinary manual downloads/uploads.

**Work:**

1. Implement one durable **Admin-managed Source Registry**, covering provider, exact Kenya surface and ID, operator identity, method, permitted access evidence, metric class, native period, rank depth, parser revision, credential reference, EAT cadence, refresh budget, and qualification/health status.
2. Investigate and qualify **YouTube, Spotify, Boomplay, Apple Music, Mdundo, and Shazam**, plus representative optional services including Audiomack and genuine airplay where demonstrably useful. Each named core provider must have an independently verified usable method or a documented unqualified state. Provider count does not equal chart credibility.
3. Extend \`wk-chart-capture\` and current native parsers/adapters. Prefer provider API, offered export fetched on the server, or separately qualified public-page observation method. A playlist listing is not a stream count; a YouTube playlist is not the weekly YouTube chart metric; Shazam recognition/discovery is not audio streaming. Reverify actual Spotify endpoint/access behavior. Public-fact research does **not** automatically require a negotiated partnership, but unattended collection must respect the verified source-specific method and concrete restrictions.
4. Record original private bytes, SHA-256, provider response, observed timestamp, native reporting period, territory, rank/count meaning, provenance and attempt identity. Do not manufacture a native week from the capture time.
5. Schedule collection, detect corrupt/schema-drifted payloads, quarantine bad sources, expose source health, and support bounded idempotent retry. The ordinary Admin never downloads and uploads CSVs. Manual original-byte upload is an exceptional, validated recovery route.

**Phase 1 exit, all required:**

- [ ] Six named core platforms explicitly assessed; YouTube and Spotify actively addressed, not dropped for convenience.
- [ ] Founder-approved qualified source constitution supports credible Kenyan consumption/discovery coverage with a real, reproducible observation sample.
- [ ] Two successive EAT week slots can collect automatically with exact source-byte and period verification, without per-week code, hardcoded hashes, or manual downloads.
- [ ] Malformed, missing, duplicate, unauthorized or stale source evidence is held or quarantined, and retry cannot fabricate an independent observation.
- [ ] Collection alone cannot publish, score unapproved evidence, or mutate Registry facts.

**Output:** private, versioned source evidence and explicit gaps for identity review.

## Phase 2. MIZIZI, Registry, Full Eligibility and Admin Corrections

**Goal:** identify real recordings, resolve false filter flags, and safely recompute affected results.

**Work:**

1. Converge existing Ingest, No Match, Artist Resolution, Review Queue and MIZIZI workflows into one searchable **Filter Review and Correction Workbench**. Use verified ISRC/provider links and governed canonical recording identity. Similar titles are match candidates, not authority to merge originals, remixes, acoustic, live, re-recorded or remastered versions.
2. Inventory the **approximately 104 founder-referenced filters** against real profiles and executable predicates. The count is an estimate, not a verified exact contract. Map every applicable filter to field, evidence, disposition, correction or policy authority, dependencies, and regression acceptance.
3. Evaluate each predicate as \`ELIGIBLE\`, \`EXCLUDED\`, \`REVIEW_REQUIRED\`, or \`CONFLICTED\` with reason codes. No incomplete rule silently passes. Replace the review-only downstream hold **only after** independent source period, Registry completeness, authorization and full-filter enforcement pass.
4. Support Admin corrections to factual metadata including Artist attribution, primary/featured credits, version/remix flags, release dates/types, genres, languages, explicit metadata, ISRC/provider IDs, and \`origin_iso2\`. Keep factual correction separate from an audited exclusion and from a proposed **week-wide policy revision**.
5. Preserve original provider values, evidence, proposer, reviewer, reason, old/new value, policy digest and timestamp. MIZIZI may suggest evidence; it must not self-approve or overwrite canonical Registry values. Use governed Artist/Track/credit/origin authority, retaining accepted facts for subsequent weeks.
6. Implement **Apply Corrections and Re-evaluate**, with version/digest conflict checks and before/after impact preview. Invalidate affected filter, score, shortlist, review and approval states. Recompute from existing original observations **without refetching or uploading**. Preserve manual exclusions and audit history. Committed/published Editions use a separately governed revision, not a destructive reset.
7. Give the Admin a complete searchable/paginated queue, batch review with justified shared values, and explainable stale/conflicting edit rejection.

**Phase 2 exit, all required:**

- [ ] All applicable filters have explicit executed outcomes, evidence and correct/review/exclude/policy-revision dispositions. No arbitrary first-20 review limit.
- [ ] Realistic cases for false remix labels, Artist misattribution, credits, missing/conflicted \`origin_iso2\`, recording versions, release/explicit fields, language/genre, provider collisions and unknown evidence produce correct outcomes.
- [ ] Single and batch correction/re-evaluation are deterministic, idempotent, audit-preserving, and never duplicate source evidence or canonical Registry entities.
- [ ] Denied roles, stale versions, simultaneous Admin corrections, and interrupted updates fail safely.
- [ ] Independent scoring/publication blocks remain in effect until proven cleared.

**Output:** source-bound, correctly reconciled or explicitly provisional candidates with audited eligibility decisions.

## Phase 3. Reproducible Ranking, Editorial Governance and Publisher

**Goal:** generate a defensible private Top 100 and connect it to the existing protected publisher.

**Work:**

1. Converge WK100 private ranking and eligibility decisions with the accepted Phase 1 source constitution and Phase 2 identity. Keep native source metrics and periods distinct. Avoid counting duplicate same-operator observations as independent corroboration.
2. Make methodology, eligibility profile, source weights and market scope **server-side reviewed, versioned and immutable once frozen for an Edition**, not browser-local authority. Preserve input, method and source digests, coverage, uncertainty, ranking score contributions and rejected candidates.
3. Compute a reproducible private Top 100. If fewer than 100 qualified entries have sufficient evidence, block staging; never pad with invented candidates. Provisional observations cannot create fictitious multi-source identity corroboration.
4. Reuse the installed WK100 governed SQL publisher. Complete trusted server-side raw-byte replay, source admission, signed-in role checking, attestation, independent editorial approval and private staging from the Admin UI. Do not build a second publisher.
5. Implement the explicit progression: **Draft -> Evidence Verified -> Identity and Eligibility Reviewed -> Private Ranked Candidate -> Independent Approval -> Private Staged -> Explicit Publish**. Changing accepted source evidence, methodology or identity invalidates stale approvals.
6. Support Admin-owned idempotent publication, revision, correction and withdrawal with immutable history, current database role checks, exact-week/digest binding and existing legacy programme guards intact.

**Phase 3 exit, all required:**

- [ ] Same sealed evidence and methodology replay to the same exact private ranking and explanation.
- [ ] A genuine-source-lineage private candidate of exactly 100 is independently verifiable; unresolved evidence does not receive fictional measurements.
- [ ] Independent approval and private staging operate through the existing authority. Revoked users, forged approvals, changed scores, stale digests and second conflicting publications are denied.
- [ ] Publish, correction and withdrawal contracts pass in an isolated environment. **Do not publish an actual flagship Edition as a test.**
- [ ] Automatic collection, private ranking and deployment cannot publish by themselves.

**Output:** complete Admin-operated private Edition lifecycle, ready for full operational acceptance.

## Phase 4. Two-Week Acceptance, Controlled Production Deployment and Handoff

**Goal:** demonstrate ordinary weekly operation without engineers, deploy the accepted integrated product once, and stop implementation.

**Work:**

1. Operate **two consecutive EAT weeks** end-to-end in the existing unlinked local disposable test environment using real JWT, Registry, Storage and browser-class behavior. Exercise valid and missing sources, malformed payloads, retries, duplicate and remix conflicts, missing Artist origin, correction, policy change, re-evaluation, independent editorial approval, rejected roles and default-no-publication.
2. Separately prove genuine current-source qualification and evidence. Synthetic two-week rehearsal proves workflow mechanics, not Kenyan consumption facts.
3. Consolidate existing critical/domain/SQL/real-browser tests. No automatic extra permanent suite or new milestone scaffolding. Verify real fixture lifecycle: tracked IDs, always-run teardown, stopped-container and volume absence, independently verified zero residue, including interrupted paths. **Never create disposable test Admins or immutable test receipts in accepted Preview/Production.** The founder is never a cleanup mechanism.
4. Audit exact merged-main migrations and generated filenames, SQL postflight, source-method admission, secrets/role/CORS/runtime dependencies, real browser acceptance, CI, and production regression risk. Every new dependency must be proven rather than guessed.
5. Only after complete green acceptance and **separate founder deployment approval**, promote exact-main Production SQL via the repository workflow, deploy only required JWT-gated Edge functions, build and activate the merged-main frontend, then execute nonpublishing smoke/canary checks. Keep collector and research intake OFF until separately authorized. Confirm all public WK100 editions remain absent after deployment.
6. Deliver the role-specific Admin runbook: source configuration/health, Monday week, MIZIZI match and credits, origin corrections, all filters, re-evaluation, private ranking, editorial approval, intentional publishing, safe revision/withdrawal and recovery. Verify operator permissions and one normal next-week walkthrough without code, SQL, CLI, GitHub or provider downloads.
7. On founder acceptance, **handoff is final and engineering stops for ordinary weekly editions**. A provider's genuinely breaking external change is a distinct maintenance authorization, not a reason to rebuild weekly.

**Phase 4 exit, all required:**

- [ ] Two successive weekly cycles, all correction/approval/error paths, and independent automatic fixture cleanup pass.
- [ ] Genuine evidence/qualification and frozen ranking are verified separately from synthetic tests.
- [ ] Exact-head CI, SQL/Edge/frontend deployment controls, real-client and publisher denial/rollback checks pass.
- [ ] Production canary proves **zero unauthorized public WK100 Editions**, preserved unrelated programmes and no unwanted data mutations.
- [ ] An authorized Admin runs the next week completely through Admin, with no developer actions.
- [ ] Founder accepts the working operational walkthrough and runbook, with deployment and handoff receipts in #1338.

## 4. Cardinal Cross-Phase Rules

1. **One owner per authority:** extend existing capture, Registry, filter, ranking, and publisher systems. No competing implementation.
2. **Truthful measurements:** playlist appearance is not stream count; Shazam discovery is not streaming; provider-native periods cannot be invented; Kenya observation does not establish Artist \`origin_iso2\`.
3. **Evidence survives correction:** never rewrite provider originals; separate facts, policy choices, editorial exceptions, canonical identity and published revision.
4. **Security survives convenience:** use caller-scoped JWT/role authority, RLS and private source/score provenance; MIZIZI suggestions are not autonomous canonical writes.
5. **No fixtures left behind:** use isolated local integration stack and independent automated whole-lifecycle teardown; no manual founder cleanup.
6. **No false PASS:** native/static, local integration, real browser, hosted ingress, Production SQL and genuine source evidence prove different gates.
7. **No accidental flagship:** the inaugural public Edition requires explicit separate founder authorization after deployment; every later Edition needs its exact-week governed Admin publish action.
8. **No phase or CI sprawl:** retain unique protective tests, retire redundant assertions, and track one implementation delivery under #1338.
9. **No routine engineering after handoff:** source roster and ordinary eligibility/editorial choices live in Admin. Unexpected provider breakage must quarantine safely.

## 5. Release Decision Register

| Decision | Authority as of this plan |
| --- | --- |
| Write implementation code | Begin only upon a new implementation instruction after this plan is accepted |
| Add Producer / Source contracts in Production | Not authorized by this document |
| Apply the three pending WK100 Production migrations | Not authorized |
| Activate WK100 unattended capture or research intake | Not authorized |
| Publish the first public WAKILISHA 100 Edition | Not authorized; requires separate founder launch instruction |
| Run a final Production deployment | Only after the four phase gates pass and founder approves |
| Publish normal later weekly Editions | Separate authorized Admin action against each frozen and approved week |

## 6. Referenced Contracts

- [Final implementation issue #1338](https://github.com/bjuta/wakilisha/issues/1338), [source and editorial programme #1264](https://github.com/bjuta/wakilisha/issues/1264), and [merged foundation #1333](https://github.com/bjuta/wakilisha/pull/1333).
- [Integrated capture runtime](wakilisha-100-integrated-capture-runtime-v1.md), [independent research/source qualification](wakilisha-100-independent-research-source-qualification-v1.md), [source admission register](wakilisha-100-source-access-admission-register-v1.md), and [weekly evidence kernel](wakilisha-100-weekly-evidence-kernel-v1.md).
- [Private ranking](wakilisha-100-private-ranking-preview-v1.md), [governed Edition publisher](wk100-governed-edition-publication-contract-v1.md), [MIZIZI chart materialization closure](mizizi-slice2-chart-materialization-production-closure.md), and [Artist-origin authority](mizizi-slice2-chart-origin-and-artist-creation-design.md).
- Binding WAKILISHA Project language/tone, cultural operating doctrine, collaboration, and deployment workflow documents. Exact current deployed state takes precedence over stale historical checkpoints.

**Final definition of done:** WAKILISHA collects qualified Kenya-source evidence automatically, reconciles recordings through MIZIZI, lets Admin correct every correctable filter fact and re-evaluate without recollection, privately ranks truthfully, and publishes only through explicit human authority. Two-week operational proof, one controlled Production deployment, and founder-accepted Admin handoff close implementation.
