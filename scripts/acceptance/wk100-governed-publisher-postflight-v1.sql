-- WAKILISHA 100 #1329: read-only publisher + withdrawal schema/privilege acceptance after isolated Preview.
-- Does not grant authority, insert rows or mutate Production.
-- Expected: one row with pass=true. A SQL pass is NOT native fixture approval.
with expected(rel) as (
  values
    ('platform_private.wk100_governed_source_admissions_v1'),
    ('platform_private.wk100_private_replay_attestations_v1'),
    ('platform_private.wk100_governed_editorial_approvals_v1'),
    ('platform_private.wk100_governed_staged_editions_v1'),
    ('platform_private.wk100_pending_identity_investigations_v1'),
    ('platform_private.wk100_governed_publications_v1'),
    ('platform_private.wk100_governed_identity_links_v1'),
    ('platform_private.wk100_governed_withdrawals_v1')
), private_tables as (
  select e.rel, c.oid, c.relrowsecurity,
    coalesce(has_table_privilege('anon',c.oid,'SELECT'),false) as anon_read,
    coalesce(has_table_privilege('authenticated',c.oid,'INSERT'),false) as auth_insert,
    coalesce(has_table_privilege('service_role',c.oid,'INSERT'),false) as service_insert
  from expected e
  left join pg_class c on c.oid=to_regclass(e.rel)
), functions as (
  select
    to_regprocedure('public.wk100_admit_governed_source_v1(date,uuid,text)') as source_admit,
    to_regprocedure('public.wk100_attest_private_ranking_replay_v1(jsonb)') as raw_attest,
    to_regprocedure('public.wk100_register_governed_editorial_approval_v1(jsonb)') as editorial,
    to_regprocedure('public.wk100_stage_governed_weekly_edition_v1(date,text)') as stage,
    to_regprocedure('public.wk100_publish_governed_weekly_edition_v1(date,text)') as publish,
    to_regprocedure('public.wk100_link_governed_recording_identity_v1(text,integer,uuid,text)') as registry_link,
    to_regprocedure('public.wk100_withdraw_governed_weekly_edition_v1(date,text,text)') as withdrawal
), permissions as (
  select
    source_admit is not null and
      has_function_privilege('authenticated',source_admit,'EXECUTE') as source_auth,
    raw_attest is not null and
      has_function_privilege('service_role',raw_attest,'EXECUTE') and
      not has_function_privilege('authenticated',raw_attest,'EXECUTE') and
      not has_function_privilege('anon',raw_attest,'EXECUTE') as attest_service_only,
    editorial is not null and
      has_function_privilege('authenticated',editorial,'EXECUTE') as editorial_auth,
    stage is not null and
      has_function_privilege('authenticated',stage,'EXECUTE') as stage_auth,
    publish is not null and
      has_function_privilege('authenticated',publish,'EXECUTE') as publish_auth,
    registry_link is not null and
      has_function_privilege('authenticated',registry_link,'EXECUTE') as registry_auth,
    withdrawal is not null and
      has_function_privilege('authenticated',withdrawal,'EXECUTE') and
      not has_function_privilege('anon',withdrawal,'EXECUTE') and
      not has_function_privilege('service_role',withdrawal,'EXECUTE') as withdrawal_auth_only,
    coalesce((select prosecdef from pg_proc where oid=publish),false) as publisher_definer,
    coalesce((select prosecdef from pg_proc where oid=withdrawal),false) as withdrawal_definer
  from functions
), guards as (
  select
    (select count(*) from pg_trigger
      where tgrelid='public.wk_chart_editions_v2'::regclass
        and not tgisinternal and tgenabled='O'
        and tgname in ('wk100_block_direct_published_insert',
          'wk100_block_ungoverned_promotion',
          'wk_chart_editions_publish_integrity_guard_bu',
          'wk100_stage_edition_update_delete_guard'))=4 as edition_guards,
    (select count(*) from pg_trigger
      where tgrelid='public.wk_chart_entries_v2'::regclass
        and not tgisinternal and tgenabled='O'
        and tgname in ('wk100_stage_entry_update_delete_guard',
          'wk100_block_extra_staged_entry'))=2 as entry_guards,
    exists(select 1 from pg_indexes where schemaname='public'
      and tablename='wk_chart_editions_v2'
      and indexname='wk100_unique_program_edition_date_v1'
      and indexdef ilike '%UNIQUE INDEX%') as week_unique,
    (select pg_get_functiondef('public.wk_chart_editions_publish_integrity_guard()'::regprocedure))
      like '%chart_assert_publishable_edition(new.id)%' as legacy_unchanged,
    (select pg_get_functiondef('public.wk_chart_editions_publish_integrity_guard()'::regprocedure))
      like '%authorized_tx=txid_current()%' as wk100_promotion_proof,
    (select pg_get_functiondef(to_regprocedure('platform_private.wk100_block_direct_published_insert_v1()')))
      like '%s.authorized_tx=txid_current()%' as same_tx_edition_insert,
    (select pg_get_functiondef(to_regprocedure('platform_private.wk100_block_extra_staged_entry_v1()')))
      like '%s.authorized_tx=txid_current()%' as same_tx_entry_insert,
    (select pg_get_functiondef(to_regprocedure('public.wk100_publish_governed_weekly_edition_v1(date,text)')))
      like '%configured ranking quality floors%' as scoring_quality_gate,
    (select count(*) from pg_trigger where
      tgrelid='platform_private.wk100_governed_withdrawals_v1'::regclass
      and not tgisinternal and tgenabled='O' and
      tgname in ('wk100_withdrawal_receipt_immutable_rows',
                 'wk100_withdrawal_receipt_immutable_truncate'))=2 as withdrawal_immutable_guards,
    (select pg_get_functiondef(to_regprocedure('platform_private.wk100_block_ungoverned_promotion_v1()')))
      like '%w.authorized_tx=txid_current()%' as withdrawal_same_tx_guard,
    (select pg_get_functiondef(to_regprocedure('platform_private.wk100_block_staged_content_mutation_v1()')))
      like '%old.status=''published'' and new.status=''withdrawn''%' as withdrawal_staged_guard,
    (select pg_get_functiondef('public.wk100_withdraw_governed_weekly_edition_v1(date,text,text)'::regprocedure))
      like '%current_user_has_capability(''manage_charts'')%' as withdrawal_manager_gate,
    (select pg_get_functiondef('public.wk100_withdraw_governed_weekly_edition_v1(date,text,text)'::regprocedure))
      like '%current_user_has_capability(''publish_charts'')%' as withdrawal_publisher_gate
)
select
  (select count(*) from private_tables) as private_table_count,
  (select count(*) from private_tables where oid is not null
    and relrowsecurity and not anon_read and not auth_insert and not service_insert)
    as private_tables_with_required_controls,
  row_to_json(permissions) as role_permissions,
  row_to_json(guards) as publication_guards,
  (
    (select count(*) from private_tables)=8
    and (select count(*) from private_tables where oid is not null
      and relrowsecurity and not anon_read and not auth_insert and not service_insert)=8
    and (select bool_and(v) from permissions,
      lateral (values(source_auth),(attest_service_only),(editorial_auth),
        (stage_auth),(publish_auth),(registry_auth),(publisher_definer),
        (withdrawal_auth_only),(withdrawal_definer)) flags(v)) is true
    and (select bool_and(v) from guards,
      lateral (values(edition_guards),(entry_guards),(week_unique),
        (legacy_unchanged),(wk100_promotion_proof),
        (same_tx_edition_insert),(same_tx_entry_insert),(scoring_quality_gate),
        (withdrawal_immutable_guards),(withdrawal_same_tx_guard),(withdrawal_staged_guard),
        (withdrawal_manager_gate),(withdrawal_publisher_gate)) flags(v)) is true
  ) as pass
from permissions,guards;
