-- Phase 1 evidence privacy gate for unlinked local migrations.
-- All fixtures live in a rolled-back transaction; never target Production.
\set ON_ERROR_STOP on
begin;

do $charts2_verify$
declare
  v_receipt uuid;
  v_rows integer;
begin
  select count(*) into v_rows from platform_private.charts2_source_methods_v1;
  if v_rows <> 5 then
    raise exception 'charts2_method_registry_expected_five_got_%',v_rows;
  end if;
  if exists (
    select 1 from platform_private.charts2_source_methods_v1
    where review_state <> 'held' or reviewed_by is not null
       or authorization_expires_at is not null or method_revision <> 0
       or expected_depth <> case when source_key = 'shazam_ke' then 200 else 100 end
  ) then
    raise exception 'charts2_method_registry_unreviewed_admission_or_depth';
  end if;

  if has_schema_privilege('anon','platform_private','USAGE')
     or has_schema_privilege('authenticated','platform_private','USAGE')
     or has_table_privilege('anon','platform_private.charts2_capture_receipts_v1','SELECT')
     or has_table_privilege('authenticated','platform_private.charts2_capture_receipts_v1','SELECT')
     or has_table_privilege('anon','platform_private.charts2_source_methods_v1','INSERT')
     or has_table_privilege('authenticated','platform_private.charts2_source_methods_v1','UPDATE')
  then
    raise exception 'charts2_private_schema_exposed';
  end if;

  if not exists (
    select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace
    where n.nspname='platform_private'
      and c.relname='charts2_capture_receipts_v1' and c.relrowsecurity
  ) then
    raise exception 'charts2_capture_rls_disabled';
  end if;

  if (select count(*) from storage.buckets where id='charts2-evidence-private-v1'
    and name='charts2-evidence-private-v1' and public=false
    and file_size_limit=4000000) <> 1
  then
    raise exception 'charts2_bucket_not_private_or_missing';
  end if;

  if exists (select 1 from pg_policies where schemaname='storage'
    and tablename='objects' and
    (coalesce(qual,'') like '%charts2-evidence-private-v1%' or
     coalesce(with_check,'') like '%charts2-evidence-private-v1%'))
  then
    raise exception 'charts2_storage_policy_granted';
  end if;

  insert into platform_private.charts2_capture_receipts_v1
    (source_key, source_endpoint, capture_mode, observed_at,
     original_object_key, original_byte_length, original_sha256,
     original_verified_at, original_content_type,
     expected_depth, observed_depth, observations, parser_version)
  values
    ('mdundo_ke','https://mdundo.com/top-charts/ke',
     'research_original_upload','2026-11-18 12:00:00+00',
     'disposable-ci/sha256/a01','100',
     repeat('a',64), now(),'text/html',100,1,
     '[{"rank":1,"provider_track_id":"fixture-1"}]'::jsonb,
     'charts2-ci-1')
  returning id into v_receipt;

  if not exists (
    select 1 from platform_private.charts2_capture_receipts_v1
    where id=v_receipt and observed_status='partial_depth'
      and candidate_only=true and can_score=false and can_publish=false
  ) then
    raise exception 'charts2_candidate_receipt_not_held';
  end if;

  begin
    update platform_private.charts2_capture_receipts_v1
    set original_byte_length=101 where id=v_receipt;
    raise exception 'charts2_unexpected_update_allowed';
  exception when others then
    if sqlerrm <> 'charts2_evidence_is_immutable' then raise; end if;
  end;

  begin
    delete from platform_private.charts2_capture_receipts_v1 where id=v_receipt;
    raise exception 'charts2_unexpected_delete_allowed';
  exception when others then
    if sqlerrm <> 'charts2_evidence_is_immutable' then raise; end if;
  end;

  begin
    insert into platform_private.charts2_capture_receipts_v1
      (source_key, source_endpoint, capture_mode, observed_at,
       original_object_key, original_byte_length, original_sha256,
       original_verified_at, original_content_type,
       expected_depth, observed_depth, observations, parser_version)
    values
      ('mdundo_ke','https://mdundo.com/top-charts/ke',
       'research_original_upload','2026-11-18 12:00:00+00',
       'disposable-ci/sha256/a02',100,repeat('b',64),now(),'text/html',
       100,1,'[{"rank":2,"provider_track_id":"fixture-2"}]'::jsonb,
       'charts2-ci-1');
    raise exception 'charts2_unexpected_invalid_rank_allowed';
  exception when others then
    if sqlerrm <> 'charts2_capture_rank_sequence_invalid' then raise; end if;
  end;

  raise notice 'WK_CHARTS2_LOCAL_PRIVATE_EVIDENCE_DB_SECURITY=PASS';
end
$charts2_verify$;
rollback;
\echo WK_CHARTS2_LOCAL_PRIVATE_EVIDENCE_ROLLBACK=PASS
