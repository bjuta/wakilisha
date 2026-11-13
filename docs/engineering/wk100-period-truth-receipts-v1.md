# WK100 period-truth receipts v1

**Engineering authority:** issue [#1366](https://github.com/bjuta/wakilisha/issues/1366), parent #1338 / source programme #1264. **Migration authority:** `20261113101448_wk100_period_truth_receipts_v1.sql` generated on the founder's Mac by Supabase CLI, not minted by chat. **Status:** candidate on `fix/wk100-period-truth-receipts-20261113`; no Production SQL/Edge activation in this patch.

## Why the separate service commit v2 exists

The original `wk_chart_runtime_commit_v1` remains byte-identical, retaining backward compatibility and preserving immutable historical receipts. It accepts true provider-native UTC boundaries but the deployed five-source collector always supplied null, yielding `unknown`. A new service-role-only `wk_chart_runtime_commit_v2` atomically checks the **latest** W2A method and proposal revision at commit, with its current authorization, source/contract/parser and exact upstream ref, before giving a receipt period status. Neither role-based browser access nor an unreviewed candidate method can invoke or confer this authority.

## Distinct truth classes

- **Four as-of methods:** Apple, Shazam, Mdundo, Audiomack. When the latest reviewed W2A method is `observed_as_of`, a new successfully parsed/partial receipt stores `observed_as_of` and the exact reviewed policy ref from privileged SQL. The actual source observation instant remains `fetched_at`; `native_period_start/end` remain NULL. Do **not** describe this as a provider-native week or playback total.
- **YouTube weekly Top Songs:** The genuine first-party raw response is validated against the requested completed weekly chart and declares `CHART_PERIOD_TYPE_WEEKLY` and `endDate`. The worker re-parses the archived original and passes `youtube_week_end:YYYY-MM-DD`; v2 persists `provider_declared_end_date` with no fabricated UTC start/end. A request-period string or unrelated period metadata is insufficient; missing endDate means parse_failed. This class is **not** qualified for W8 private ranking until separately reviewed native start/period alignment is proven from independent provider evidence.
- **Failed/partial:** A parse failure stores `unknown` and its immutable private raw object. A partial depth may retain an as-of policy but still cannot satisfy the full-depth W8 checkpoint. Missing Apple days or a late YouTube native week cannot be filled by repeat snapshots.
- **Historical originals:** The 9 and 13 November Production receipts remain unchanged and `unknown`. No silent historical upgrade, Backfill SQL UPDATE, or inferred provider-date bounds.

## Release and rollback boundary

This migration is additive: two broadened CHECK constraints and one new RPC. No rows, credentials, URLs, cron entries, editions, scoring data or Registry identities change. Only `service_role` may execute v2. The old v1 RPC remains available for legacy consumers but its unknown-period receipts do not score. The replacement Edge import is one RPC-name change in `wk-chart-capture`; the scheduler code is not changed. The W8 read-only selector explicitly holds provider-declared **end-date-only** receipts; the restricted W8 reader never treats them as a seven-day UTC window. Neither this code nor a successful capture enables scoring, staging, publishing or unattended collection.

## Acceptance gates

1. Existing `chart-weekly-evidence.test.mjs` and `wk100-ranking-attested-evidence.test.mjs` cover original endDate proof, spoofed requested period rejection, failed parse, unresolved YouTube identity, and W8 end-date-only HOLD. The source-admin domain contract remains in the focused test group. CI additions are folded into existing suites, not new milestone suites.
2. Validate clean local baseline migration replay on disposable PG17; inspect the generated filename and run an explicit transaction-rollback verifier of v2 current-W2A matching, method revocation, forged UTC bounds and wrong provider endDate. No direct Production SQL or credentials in disposable tests.
3. Prove Preview secrets, service-only JWT/RPC access, private raw digest, actual Edge period classification, and 3-minute lease/create-only semantics. Rerun tests plus consolidated critical and `npm run build:app` on exact head.
4. PR protected CI, merge, then separately authorize and independently verify Production SQL followed by capture Edge deployment. Historical Production originals remain immutable. Source approvals expire 27 Nov 2026 at 14:20:06 EAT; an unattended two-week prospective soak is **not authorized** by the earlier supervised-trial approval.

## Read-only SQL checks after Preview apply

```sql
select conname, pg_get_constraintdef(oid)
from pg_constraint
where conrelid='public.wk_chart_capture_attempts_v1'::regclass
  and conname in ('wk_chart_capture_attempt_native_period',
    'wk_chart_capture_attempts_v1_native_period_authority_check');

select has_function_privilege('service_role',
    'public.wk_chart_runtime_commit_v2(uuid,uuid,text,jsonb,text,timestamptz,timestamptz,text,text)',
    'EXECUTE') as service_allowed,
  has_function_privilege('authenticated',
    'public.wk_chart_runtime_commit_v2(uuid,uuid,text,jsonb,text,timestamptz,timestamptz,text,text)',
    'EXECUTE') as signed_in_denied,
  has_function_privilege('anon',
    'public.wk_chart_runtime_commit_v2(uuid,uuid,text,jsonb,text,timestamptz,timestamptz,text,text)',
    'EXECUTE') as anon_denied;
```

Expected privilege booleans: `true, false, false`. Never mistake schema/privilege proof for live original replay or a qualifying 11-checkpoint EAT week.
