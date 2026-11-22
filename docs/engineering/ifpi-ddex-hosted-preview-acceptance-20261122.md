# IFPI/DDEX distinct recording: authenticated hosted Preview acceptance

**Accepted 2026-11-22.** [GitHub Critical Control Plane run 44987731816](https://github.com/bjuta/wakilisha/actions/runs/44987731816), `hosted-preview-ifpi-ddex` job `137101939963`: **SUCCESS**, receipt `IFPI_DDEX_HOSTED_PREVIEW_ACCEPTANCE=PASS`. The non-secret one-shot state ledger is in the run's `ifpi-ddex-hosted-preview-one-shot` artifact.

**Scope:** PR #1421 on dedicated isolated Registry Preview `psycfvdphmvcwdhjjggf`, migration head `20261121194628` (272 migrations), Edge `ingest-artist-discography` v96. The candidate's seven original implementation/proof files were unchanged during the temporary CI instrumentation. Hosted acceptance ran against Git head `1afb6ac7328b0ddd565af45b457fcd088c5b03ba`.

**Real authenticated client class:** An existing disposable operator (user `f1834c7d-c925-4c3d-9c03-bbee8a8a08c3`) signed in via GoTrue Admin-generated magic link and public OTP verification in ephemeral CI, **without resetting a password**. The server-only Admin key was never passed to Chromium, was not recorded in the receipt, and was erased after the run. A genuine Chromium browser running on an approved localhost Origin used only the authenticated user JWT to prove CORS/Edge ingress, `manage_registry`, immutable evidence preparation/preview, and actual hosted `mode=apply`. The separate actual drawer interaction fixture had passed the existing protected Chromium suite previously; this acceptance proves hosted signed-in browser HTTP and persistence rather than a deployed-Production UI journey.

**Positive Edge HTTP 200** independently checked after the job with read-only Preview SQL:

| Check | Result |
| --- | --- |
| Original ISRC `KEWAK2614169` | Track `062aad7b-cc4f-5b4f-8902-4e82cb85faf3` preserved; slug `selected-preview` and original single membership `d8b4d8d0-afff-536a-834d-f2754521c792` intact |
| Same title, different valid ISRC `KEWAK2614170` | Distinct Track `a63a7fbd-9838-5162-836f-3474fc5336c3`, slug `selected-preview-kewak2614170` |
| New ISRC `KEWAK2614172` | New Track `005081fe-760c-52f9-8b81-91701204de5a` |
| Selected new Release | `ecf17b34-b70d-5b5c-8d84-b9a1af7561ba`, exactly **three distinct ordered Track memberships** |
| Original global Track metadata | Unchanged across real browser readback |
| Unselected observed album | **Zero** canonical Releases |

**Negative hosted Edge HTTP 409** for contradictory same-Apple Track identifier and different ISRC `KEWAK2614171`: **zero** contradictory canonical Tracks and **zero** rejected Releases created.

**Release gate:** The existing disposable PostgreSQL 272-migration replay and protected critical suites were already green for the original seven-file candidate. Retire the acceptance-only CI job/runner before merging and require final clean-head protected checks. At this checkpoint Production remains migration **271**, Edge **v95**, with **no** synthetic test ISRCs; it was not touched. Merge is not deployment. Apply only the exact native migration, the affected Production Edge Function, and the canonical frontend Finish if the merged product changes require it; independently verify Production before retrying Bien's `Alusa Continua`. Charts Preview remains untouched.
