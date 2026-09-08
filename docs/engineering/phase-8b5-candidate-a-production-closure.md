# Phase 8B.5 Candidate A Production Closure

## Scope

Candidate A closes the private Messages Safety Case and quarantine authority required by #869.

The accepted implementation extends canonical Messages and the existing `/admin/messages` control surface. It does not create a second Message store, Media authority, Community moderation store, retry system, or admin route.

## Repository Authority

- Candidate A implementation PR: #876
- Production schema seal PR: #877
- Inspected evidence render hotfix PR: #878
- Accepted protected main after the hotfix: `9b3d8564687e98e7870066d316252e6333d74ac3`
- Candidate A migration: `20260907203000_phase_8b5_candidate_a_safety_case_quarantine.sql`
- Candidate A migration SHA-256: `8fd15fc5f1d33cb04cc06cbf3970bf1f77fc0cd3ac257ec1a6bd42a196152f3c`
- Permanent verifier: `scripts/control-plane/verify-phase-8b5-candidate-a-safety-case-quarantine.sql`

## Accepted Authority

Candidate A adds four peer tables in the existing `messaging` schema:

- `messaging.safety_cases`
- `messaging.safety_case_targets`
- `messaging.safety_case_events`
- `messaging.message_quarantine`

Direct browser and runtime table access is revoked. Row-level security remains enabled. Safety operations use the existing Messages capability and server-side RPC authority.

The accepted command vocabulary is:

- `messages.safety.report`
- `messages.safety.review.start`
- `messages.safety.quarantine.update`
- `messages.safety.resolve`
- `messages.safety.evidence.inspect`

The accepted RPC family is:

- `public.report_message_safety_v1`
- `public.list_messages_safety_cases_v1`
- `public.get_messages_safety_case_v1`
- `public.start_messages_safety_review_v1`
- `public.set_message_quarantine_v1`
- `public.resolve_message_safety_case_v1`
- `public.inspect_message_safety_evidence_v1`

## Preview Acceptance

Candidate A was replayed on a fresh disposable Supabase Preview before Production promotion.

Accepted Preview facts:

- migration count: 110
- migration head: `20260907203000`
- all four Safety tables present with row-level security enabled
- zero direct `anon`, `authenticated`, or `service_role` table grants on the Safety tables
- all five Safety command types enabled
- all seven Safety RPCs present
- zero anonymous Safety RPC execution
- ordinary Messages projections quarantine-aware
- evidence inspection bound to the exact Safety Case target and exact Message body
- no Message or Media body, SHA, storage key, bucket, or object path duplicated into Safety tables

The permanent rollback-only verifier passed on Preview after verifier fixture and role-scope corrections.

The canonical replay proof is:

`docs/engineering/replay-proofs/20260907203000_phase_8b5_candidate_a_safety_case_quarantine.sql.json`

The Preview schema seal generated database types SHA-256:

`bd22bcb40373f2a445447dc60f78a4013b3bf1d669964f93b858db2dca60dba8`

The disposable Preview branch `phase-8b5-candidate-a-preview-final` was deleted after Production acceptance.

## Production Database Acceptance

Candidate A was promoted from exact merged `main` using the repository migration promotion path.

Accepted Production facts:

- Production project: `pgzizndxdyhqmtyywjmt`
- migration count before Candidate A: 109
- migration head before Candidate A: `20260907142000`
- exactly one pending migration before promotion
- migration count after Candidate A: 110
- migration head after Candidate A: `20260907203000`
- zero pending migrations after promotion
- permanent rollback-only Candidate A verifier: PASS
- Production-generated database types matched the accepted Preview type hash
- Production schema seal PR #877 merged

No Supabase Edge Function deployment was required.

## Production Frontend Acceptance

Candidate A frontend acceptance required one presentation hotfix after controlled Production testing found that inspected evidence was returned correctly but immediately cleared by the subsequent safe-detail refresh.

PR #878 corrected that state ordering without changing Safety authority or database behavior.

The first hotfix deployment used `npm run build:app`, which produced only the Vite application artifact. Because Production deployment uses `rsync --delete`, that deployment reduced the live tree from 3,706 files to 300 files and removed generated SEO and prerender files. The SPA route smoke checks remained green, which exposed a deployment acceptance gap rather than an application failure.

The deployment was corrected forward from exact merged `main` using the complete `npm run build` contract required by the Production runbook.

Accepted final frontend facts:

- deployed main: `9b3d8564687e98e7870066d316252e6333d74ac3`
- complete Production build: PASS
- Admin route splitting audit: 100 lazy imports
- Public route splitting audit: 71 lazy imports and 179 route paths
- SEO metadata manifest: 3,418 entries
- SEO prerender output: 3,403 route HTML files written
- final live file count: 3,706
- local and live index SHA-256: `f62a63975d2c55cfc04a9cff959f39f9f12b37e6077c49e7bd9485fd65385ba3`
- local and live entry asset: `assets/index-Bx_QTSIx.js`
- local and live entry SHA-256: `c7f87cf8425bdb80679f8d0e53d35ccc0b7e94848aa7b8d2bba14d8bfe3b71e7`
- local tree SHA-256: `496883cf729cac8555a3bdfb01d434f7ee68cf300ec1cafca58c335edd7bb4f0`
- rollback snapshot: `/opt/wakilisha-react-backups/phase8b5-fullbuild-repair-20260908T125858Z-9b3d8564`
- Nginx validation: PASS
- direct origin HTTPS: PASS for `/`, `/messages`, `/admin/messages`, `/magazine`, `/charts`, `/artists`, `/playlists`, `/sitemap.html`, and `/sitemap.xml`
- public HTTPS: PASS for the same routes

## Authenticated Production Acceptance

A real incoming Message in the existing Super Admin conversation was used for controlled acceptance.

Accepted flow:

- participant Report control exposed only on the received Message
- Harassment report created one Safety Case
- reporting did not punish the sender automatically
- safe case detail did not expose Message content before inspection
- Start Review moved the case to Under Review
- Inspect Evidence required a reason before access
- exact Message body rendered only after deliberate evidence inspection
- quarantine removed the Message from ordinary delivery/read presentation without deleting canonical Message history
- release restored the Message to the ordinary conversation
- resolution completed as `no_action`

Final Production Safety Case facts:

- case ID: `c27e2eb0-fbe9-42eb-b6ae-3a6e5d8f06f3`
- status: `resolved`
- disposition: `no_action`
- evidence inspection events: 3
- quarantine events: 1
- release events: 1
- quarantine history status: `released`

The three evidence inspection events are preserved as truthful audit history. Two were produced while diagnosing the frontend render defect, and the final inspection proved the repaired presentation path.

## Exit Gate

Candidate A satisfies #869:

- Safety Case is peer authority bound to exact Message identity
- reports remain signals rather than verdicts
- quarantine stops governed propagation without destructive deletion
- canonical Message content remains intact
- restricted evidence does not auto-render for Super Admin
- evidence inspection is deliberate and audited
- Safety operations extend `/admin/messages`
- ordinary Messages projections do not expose hidden Safety metadata
- private Message reports do not use Community moderation storage
- existing command receipt and runtime authority is reused

Candidate A does not implement Candidate B enforcement, appeal/recovery, or severe Media handling, and does not implement Candidate C Legal preservation or disclosure authority.

## Deployment Classification

- SQL migration needed: No, live and verified at migration 110
- Supabase Edge Function deploy needed: No
- Production Finish update needed: No
- Frontend deploy needed: No, complete Production build is live and verified
- PR needed after this closure record: No runtime PR
- Next slice: Phase 8B.5 Candidate B, #870
