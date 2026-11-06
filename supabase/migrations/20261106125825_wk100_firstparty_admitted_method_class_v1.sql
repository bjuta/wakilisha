-- WK100 Phase 1: independent SQL enforcement of first-party method/transport class.
-- This is only an admission-compatibility guard. It neither selects a chart
-- source nor grants unattended access, scoring, publication or scheduler rights.
-- The path/timestamp for this file MUST be minted by the accepted Supabase CLI.
begin;
set local lock_timeout = '5s';
set local statement_timeout = '120s';

do $wk100_preflight$
begin
  if to_regclass('platform_private.wk100_source_method_decisions_v1') is null
     or to_regprocedure('public.wk100_review_source_method_v1(jsonb,integer)') is null
     or to_regprocedure('public.wk100_service_admitted_methods_v1()') is null
     or to_regprocedure('public.wk100_enroll_source_capture_contract_v1(text,text,text,integer,integer)') is null
     or exists (
       select 1 from pg_catalog.pg_constraint c
       where c.conname = 'wk100_firstparty_admitted_method_class_v1'
         and c.conrelid = 'platform_private.wk100_source_method_decisions_v1'::regclass
     )
  then
    raise exception 'WK100_FIRSTPARTY_SQL_AUTHORITY_BASELINE_DRIFT';
  end if;
  -- Refuse to grandfather any historically wrong first-party admissions.
  if exists (
    select 1 from platform_private.wk100_source_method_decisions_v1 d
    where d.decision_state='collector_admitted' and (
      (d.provider_key='youtube_ke' and (
         d.method_class is distinct from 'provider_api'
         or d.native_period_authority is distinct from 'provider_defined'))
      or (d.provider_key='audiomack_ke' and
         d.method_class is distinct from 'reviewed_page_adapter')
    )
  ) then
    raise exception 'WK100_FIRSTPARTY_EXISTING_ADMISSION_MISMATCH';
  end if;
end; $wk100_preflight$;

-- A table constraint independently guards every SQL writer, including the
-- SECURITY DEFINER Admin-review RPC. No new RPC, function grant, role,
-- trigger, schema type, or mutable historical decision is introduced.
alter table platform_private.wk100_source_method_decisions_v1
  add constraint wk100_firstparty_admitted_method_class_v1
  check (
    decision_state <> 'collector_admitted' or (
      (provider_key <> 'youtube_ke' or (
        method_class is not distinct from 'provider_api'
        and native_period_authority is not distinct from 'provider_defined'
      ))
      and
      (provider_key <> 'audiomack_ke'
        or method_class is not distinct from 'reviewed_page_adapter')
    )
  ) not valid;

alter table platform_private.wk100_source_method_decisions_v1
  validate constraint wk100_firstparty_admitted_method_class_v1;

comment on constraint wk100_firstparty_admitted_method_class_v1
  on platform_private.wk100_source_method_decisions_v1 is
  'SQL-level W2A provider-method parity: YouTube Kenya provider-defined API route; Audiomack Kenya reviewed first-party page route. No source admission or access permission granted.';

do $wk100_postcheck$
begin
  if not exists (
    select 1
    from pg_catalog.pg_constraint c
    where c.conname='wk100_firstparty_admitted_method_class_v1'
      and c.conrelid='platform_private.wk100_source_method_decisions_v1'::regclass
      and c.contype='c'
      and c.convalidated=true
  ) then
    raise exception 'WK100_FIRSTPARTY_SQL_PARITY_NOT_VALIDATED';
  end if;
end; $wk100_postcheck$;
commit;
