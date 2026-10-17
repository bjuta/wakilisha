# MIZIZI QV2 — existing Preview acceptance (17 October 2026)

**Scope:** Existing `nkgfoppunmnkcumalxqp` Preview only, no branch creation, reset, seed, Production migration or frontend deployment.

## Exact source and test evidence

- [Supabase CLI 2.107.0 filename authority #39066809190](https://github.com/bjuta/wakilisha/actions/runs/39066809190): `20261017202800_mizizi_governed_question_freeze_v1.sql`.
- [Isolated 231→235→236 PostgreSQL and genuine GoTrue/JWT #39067363103](https://github.com/bjuta/wakilisha/actions/runs/39067363103) **PASS**. Real signed-in steward command, same-user idempotent retry, altered-payload, anonymous, nonmember, reviewer and stale-case denial; active DB05 Hold denies freeze and released Hold permits a new immutable revision. Worker/corpus tests and local container/Auth volume cleanup pass.
- [Exact one-file existing-Preview CLI apply #39067798512](https://github.com/bjuta/wakilisha/actions/runs/39067798512) **PASS**. Required **235/head 20261017185928** and exactly one pending QV2 migration. Post-state **236/head 20261017202800**; case, two research passes, one membership, one Hold, one job and receipt-link fingerprints unchanged. No Preview fixture.
- **Independent connected read-only SQL verifier** `scripts/control-plane/verify-mizizi-question-freeze-v1.sql` passed after apply. Extra read-only introspection confirmed **236** migrations, **0** question rows, forced RLS, authorized `authenticated` RPC, denied anonymous/service-role RPC, and denied direct authenticated table writes.
- [Real Preview public/editorial typegen and seal #39067971355](https://github.com/bjuta/wakilisha/actions/runs/39067971355) **PASS**. The workflow wrote source-hashed `src/types/database.types.ts`, `docs/engineering/live-schema-baseline.json` and `docs/engineering/replay-proofs/20261017202800_mizizi_governed_question_freeze_v1.sql.json`, removing both temporary workflows.
- A redundant [one-shot #39067971324](https://github.com/bjuta/wakilisha/actions/runs/39067971324) was triggered before temporary workflow removal. Its **235-only pre-state guard stopped** on already updated Preview; no duplicate migration or data write happened.

## Authority boundary

Only steward/owner humans with real active membership/capability may call `public.admin_mizizi_freeze_case_question_v1`. The command uses DB02 locked case revision, shared DB05 Hold admission, QV1 immutable question fingerprinting and stable question UUID replay. It creates **questions**, not accepted source evidence, source-family independence, consent, ACH grades, Registry decisions or public records.

Draft order: **#1243 → #1248 → #1249 → #1250**. Production is still at 231 migrations and its separate URL-identity temporary-access security release gate remains unresolved. Latest exact-head Critical core/browser checks and predecessor reviews remain mandatory before any merge. No Mac action is needed for this isolated Preview acceptance.
