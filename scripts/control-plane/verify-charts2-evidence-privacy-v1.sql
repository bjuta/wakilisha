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


  if not has_function_privilege(
      'service_role','public.charts2_get_collector_method_v1(text)','EXECUTE'
    ) or not has_function_privilege(
      'service_role','public.charts2_commit_verified_original_v1(jsonb)','EXECUTE'
    ) or has_function_privilege(
      'anon','public.charts2_get_collector_method_v1(text)','EXECUTE'
    ) or has_function_privilege(
      'authenticated','public.charts2_commit_verified_original_v1(jsonb)','EXECUTE'
    ) or has_function_privilege(
      'anon','public.charts2_commit_verified_original_v1(jsonb)','EXECUTE'
    ) then
    raise exception 'charts2_capture_service_only_rpc_grant_invalid';
  end if;

  if exists(select 1 from public.charts2_get_collector_method_v1('apple_ke')) then
    raise exception 'charts2_held_source_unexpectedly_collectable';
  end if;

  begin
    perform public.charts2_commit_verified_original_v1(
      jsonb_build_object(
        'source_key','mdundo_ke',
        'captured_by','00000000-0000-4000-8000-000000000001',
        'original_sha256',repeat('b',64),
        'observations',jsonb_build_array(jsonb_build_object('rank',1))
      )
    );
    raise exception 'charts2_unverified_rpc_should_reject';
  exception when others then
    if sqlerrm <> 'charts2_receipt_unverified' then raise; end if;
  end;

  -- Local transaction only: prove that a reviewed first-party YouTube POST
  -- becomes retrievable while a separately reviewed Apple POST cannot.
  -- Both review changes are discarded by the enclosing rollback.
  update platform_private.charts2_source_methods_v1
  set exact_endpoint='https://charts.youtube.com/youtubei/v1/browse?alt=json',
      reviewed_method='POST',
      review_state='collector_admitted',
      reviewed_by='00000000-0000-4000-8000-000000000001'::uuid,
      reviewed_at=now()-interval '1 minute',
      authorization_expires_at=now()+interval '1 hour',
      access_evidence_sha256=repeat('a',64),
      method_revision=1
  where source_key='youtube_ke';

  if (select count(*) from public.charts2_get_collector_method_v1('youtube_ke')
      where reviewed_method='POST'
        and exact_endpoint='https://charts.youtube.com/youtubei/v1/browse?alt=json'
        and method_revision=1) <> 1 then
    raise exception 'charts2_youtube_native_post_method_gate_invalid';
  end if;

  update platform_private.charts2_source_methods_v1
  set exact_endpoint='https://music.apple.com/ke/playlist/top-100-kenya/pl.0b36ea82865d4adeb9d1d62207aab172',
      reviewed_method='POST',
      review_state='collector_admitted',
      reviewed_by='00000000-0000-4000-8000-000000000001'::uuid,
      reviewed_at=now()-interval '1 minute',
      authorization_expires_at=now()+interval '1 hour',
      access_evidence_sha256=repeat('b',64),
      method_revision=1
  where source_key='apple_ke';

  if exists (select 1 from public.charts2_get_collector_method_v1('apple_ke')) then
    raise exception 'charts2_non_youtube_post_unexpectedly_admitted';
  end if;
  raise notice 'WK_CHARTS2_LOCAL_YOUTUBE_POST_ONLY=PASS';

  raise notice 'WK_CHARTS2_LOCAL_SERVICE_RPC_HELD_AND_PRIVATE=PASS';

  raise notice 'WK_CHARTS2_LOCAL_PRIVATE_EVIDENCE_DB_SECURITY=PASS';
end
$charts2_verify$;
-- Governed method admission, revocation, stale revision, private proof,
-- and append-only review records. Synthetic fixture, unlinked local DB only.
do $charts2_method_review$
declare
  fake_actor uuid := '00000000-0000-4000-8000-000000009991'::uuid;
  sample_sha text := repeat('c',64);
  sample_key text := 'youtube_ke/cc/' || repeat('c',64) || '.json';
  sample_probe uuid;
  result jsonb;
begin
  if not has_function_privilege('service_role',
      'public.charts2_record_youtube_method_probe_v1(uuid,text,date,text,text,integer,integer)',
      'EXECUTE') or
     has_function_privilege('authenticated',
      'public.charts2_record_youtube_method_probe_v1(uuid,text,date,text,text,integer,integer)',
      'EXECUTE') or
     has_function_privilege('anon',
      'public.charts2_decide_youtube_method_v1(text,uuid,integer,text)','EXECUTE') or
     not has_function_privilege('authenticated',
      'public.charts2_decide_youtube_method_v1(text,uuid,integer,text)','EXECUTE') or
     has_table_privilege('authenticated',
      'platform_private.charts2_source_method_probes_v1','SELECT') or
     has_table_privilege('authenticated',
      'platform_private.charts2_source_method_decisions_v1','INSERT')
  then raise exception 'charts2_review_privileges_broadened'; end if;
  begin
    perform public.charts2_decide_youtube_method_v1(
      'hold',null,0,'Unauthenticated caller must not approve or hold source');
    raise exception 'charts2_method_unauthorized_review_allowed';
  exception when others then
    if sqlerrm <> 'charts2_method_review_not_authorized' then raise; end if;
  end;
  begin
    perform public.charts2_record_youtube_method_probe_v1(
      fake_actor,'weekly:20261106:20261112:ke','2026-11-12'::date,
      sample_sha,sample_key,700,100);
    raise exception 'charts2_method_unverified_object_allowed';
  exception when others then
    if sqlerrm <> 'charts2_method_probe_original_unverified' then raise; end if;
  end;
  -- Only disposable schema metadata; no actual original provider data is
  -- manufactured or treated as Production success.
  insert into storage.objects(bucket_id,name)
  values ('charts2-evidence-private-v1',sample_key);
  update platform_private.charts2_source_methods_v1
  set review_state='held',reviewed_method=null,exact_endpoint=null,
      reviewed_by=null,reviewed_at=null,authorization_expires_at=null,
      access_evidence_sha256=null,method_revision=0
  where source_key='youtube_ke';
  insert into auth.users(id) values(fake_actor);
  insert into public.user_role_assignments(user_id,role_key,status)
  values(fake_actor,'chart_editor_global','active');
  perform set_config('request.jwt.claim.sub',fake_actor::text,true);
  perform set_config('request.jwt.claim.role','authenticated',true);
  insert into platform_private.charts2_source_method_probes_v1
    (target_period_key,provider_week_ending_date,actor_id,
     expected_method_revision,original_sha256,original_object_key,
     original_byte_length,observed_depth)
  values ('weekly:20261106:20261112:ke','2026-11-12',fake_actor,
          0,sample_sha,sample_key,700,100)
  returning id into sample_probe;
  execute 'set local role authenticated';
  result:=public.charts2_decide_youtube_method_v1(
    'admit',sample_probe,0,
    'I approve first-party YouTube Kenya Top Songs POST for evidence-only manual collection.');
  if result->>'review_state' <> 'collector_admitted' or
     result->>'method_revision' <> '1' then
    raise exception 'charts2_review_approved_state_invalid';
  end if;
  -- The GET collector RPC is service-only: never grant it to an actor.
  execute 'reset role';
  if (select count(*) from public.charts2_get_collector_method_v1('youtube_ke')) <> 1 then
    raise exception 'charts2_review_approved_method_unavailable';
  end if;
  execute 'set local role authenticated';
  begin
    perform public.charts2_decide_youtube_method_v1(
      'admit',sample_probe,0,
      'I approve first-party YouTube Kenya Top Songs POST for evidence-only manual collection.');
    raise exception 'charts2_review_stale_revision_allowed';
  exception when others then
    if sqlerrm <> 'charts2_method_review_revision_conflict' then raise; end if;
  end;
  result:=public.charts2_decide_youtube_method_v1(
    'hold',null,1,'Revocation of the synthetic local source-method admission.');
  if result->>'review_state' <> 'held' or result->>'method_revision' <> '2' then
    raise exception 'charts2_method_revocation_failed';
  end if;
  execute 'reset role';
  if exists(select 1 from public.charts2_get_collector_method_v1('youtube_ke')) then
    raise exception 'charts2_method_revocation_failed';
  end if;
  if (select count(*) from platform_private.charts2_source_method_decisions_v1
      where actor_id=fake_actor) <> 2 then
    raise exception 'charts2_review_audit_not_append_only';
  end if;
  begin
    delete from platform_private.charts2_source_method_probes_v1
    where id=sample_probe;
    raise exception 'charts2_review_probe_deleted';
  exception when others then
    if sqlerrm <> 'charts2_evidence_is_immutable' then raise; end if;
  end;
  begin
    update platform_private.charts2_source_method_decisions_v1
    set acknowledged_scope='unauthorized change' where actor_id=fake_actor;
    raise exception 'charts2_review_audit_mutable';
  exception when others then
    if sqlerrm <> 'charts2_evidence_is_immutable' then raise; end if;
  end;
  raise notice 'WK_CHARTS2_LOCAL_GOVERNED_METHOD_REVIEW_AND_REVOCATION=PASS';
end
$charts2_method_review$;

-- Four non-YouTube source methods: identical signed-in approval and
-- revocation boundary, tested with local-only synthetic Storage metadata.
-- No first-party network success is implied by fixture-only acceptance.
do $charts2_four_get_review$
declare
  fake_actor uuid := '00000000-0000-4000-8000-000000009991'::uuid;
  src text; provider_name text; endpoint text; extension text;
  mark text; sha text; keyname text; probe jsonb; decided jsonb;
  current_method text;
begin
  if not has_function_privilege('service_role',
       'public.charts2_record_get_method_probe_v1(text,uuid,text,text,integer,integer)','EXECUTE')
     or has_function_privilege('authenticated',
       'public.charts2_record_get_method_probe_v1(text,uuid,text,text,integer,integer)','EXECUTE')
     or has_function_privilege('anon',
       'public.charts2_decide_get_method_v1(text,text,uuid,integer,text)','EXECUTE')
     or not has_function_privilege('authenticated',
       'public.charts2_decide_get_method_v1(text,text,uuid,integer,text)','EXECUTE')
  then raise exception 'charts2_get_review_acl_failure'; end if;
  for src,provider_name,endpoint,extension,mark in
    select * from (values
      ('apple_ke','Apple Music Kenya Top 100',
       'https://music.apple.com/ke/playlist/top-100-kenya/pl.0b36ea82865d4adeb9d1d62207aab172','.html','d'),
      ('mdundo_ke','Mdundo Kenya Top Songs',
       'https://play.mdundo.com/top-charts/ke','.html','e'),
      ('audiomack_ke','Audiomack Kenya Weekly 100',
       'https://audiomack.com/geo-charts/playlist/kenya','.html','f'),
      ('shazam_ke','Shazam Kenya Top 200',
       'https://www.shazam.com/services/charts/csv/top-200/kenya','.csv','9')
    ) as fixed(source_key,title,source_endpoint,file_extension,sha_character)
  loop
    update platform_private.charts2_source_methods_v1
    set review_state='held',reviewed_method=null,exact_endpoint=null,
        reviewed_by=null,reviewed_at=null,authorization_expires_at=null,
        access_evidence_sha256=null,method_revision=0
    where source_key=src;
    sha:=repeat(mark,64);
    keyname:=src||'/'||substring(sha,1,2)||'/'||sha||extension;
    begin
      perform public.charts2_record_get_method_probe_v1(src,fake_actor,sha,keyname,700,
        case when src='shazam_ke' then 200 else 100 end);
      raise exception 'charts2_get_probe_missing_original_allowed';
    exception when others then
      if sqlerrm <> 'charts2_get_probe_original_unverified' then raise; end if;
    end;
    insert into storage.objects(bucket_id,name,metadata)
    values('charts2-evidence-private-v1',keyname,
           jsonb_build_object('size',700,'mimetype',
             case when src='shazam_ke' then 'text/csv' else 'text/html' end));
    probe:=public.charts2_record_get_method_probe_v1(src,fake_actor,sha,keyname,700,
      case when src='shazam_ke' then 200 else 100 end);
    if probe->>'source_key' <> src or probe->>'expected_revision' <> '0' or
       (probe->>'probe_id')::uuid is null then
      raise exception 'charts2_get_probe_revision_invalid_%',src;
    end if;
    perform set_config('request.jwt.claim.sub',fake_actor::text,true);
    perform set_config('request.jwt.claim.role','authenticated',true);
    execute 'set local role authenticated';
    decided:=public.charts2_decide_get_method_v1(src,'admit',
      (probe->>'probe_id')::uuid,0,
      'I approve first-party '||provider_name||' GET for evidence-only manual collection.');
    if decided->>'review_state'<>'collector_admitted' or
       decided->>'method_revision'<>'1' then
      raise exception 'charts2_get_review_admission_failed_%',src;
    end if;
    begin
      perform public.charts2_decide_get_method_v1(src,'admit',
        (probe->>'probe_id')::uuid,0,
        'I approve first-party '||provider_name||' GET for evidence-only manual collection.');
      raise exception 'charts2_get_stale_review_allowed';
    exception when others then
      if sqlerrm <> 'charts2_method_review_revision_conflict' then raise; end if;
    end;
    execute 'reset role';
    if (select count(*) from public.charts2_get_collector_method_v1(src)
        where reviewed_method='GET' and exact_endpoint=endpoint and method_revision=1) <> 1
    then raise exception 'charts2_get_collector_method_missing_%',src; end if;
    execute 'set local role authenticated';
    decided:=public.charts2_decide_get_method_v1(src,'hold',null,1,
      'Revocation of the disposable four-source GET method admission.');
    if decided->>'review_state'<>'held' or decided->>'method_revision'<>'2'
    then raise exception 'charts2_get_revocation_failed_%',src; end if;
    execute 'reset role';
    if exists(select 1 from public.charts2_get_collector_method_v1(src)) then
      raise exception 'charts2_get_revocation_leaked_%',src;
    end if;
  end loop;
  if (select count(*) from platform_private.charts2_source_method_decisions_v1
      where source_key <> 'youtube_ke') <> 8 then
    raise exception 'charts2_four_get_decision_audit_missing';
  end if;
  begin
    insert into platform_private.charts2_source_method_probes_v1
      (source_key,exact_endpoint,reviewed_method,
       actor_id,expected_method_revision,original_sha256,
       original_object_key,original_byte_length,observed_depth)
    values
      ('apple_ke','https://play.mdundo.com/top-charts/ke','GET',fake_actor,0,
       repeat('b',64),'apple_ke/bb/'||repeat('b',64)||'.html',700,100);
    raise exception 'charts2_get_cross_source_endpoint_allowed';
  exception when check_violation then null;
  end;
  -- Widening the probe table must never make a native YouTube week optional.
  begin
    insert into platform_private.charts2_source_method_probes_v1
      (source_key,exact_endpoint,reviewed_method,
       target_period_key,provider_week_ending_date,
       actor_id,expected_method_revision,original_sha256,
       original_object_key,original_byte_length,observed_depth)
    values
      ('youtube_ke','https://charts.youtube.com/youtubei/v1/browse?alt=json',
       'POST',null,'2026-11-12'::date,fake_actor,0,repeat('a',64),
       'youtube_ke/aa/'||repeat('a',64)||'.json',700,100);
    raise exception 'charts2_youtube_null_provider_week_key_allowed';
  exception when check_violation then null;
  end;
  raise notice 'WK_CHARTS2_LOCAL_FOUR_FIRST_PARTY_GET_REVIEW_AND_REVOCATION=PASS';
end
$charts2_four_get_review$;

-- Official export authority, local-only synthetic Storage metadata and rows.
-- The actual CSV bytes are tested separately; no provider success is invented.
do $charts2_official_export$
declare
  actor uuid:='00000000-0000-4000-8000-000000009991'::uuid;
  sha text:=repeat('7',64);
  keyname text:='youtube_ke/77/'||repeat('7',64)||'.csv';
  positions jsonb;
  p jsonb;
  rid uuid;
  before_method jsonb;
begin
  select to_jsonb(m) into before_method from platform_private.charts2_source_methods_v1 m
    where source_key='youtube_ke';
  if before_method->>'review_state' is distinct from 'held' then
    raise exception 'charts2_export_fixture_native_method_not_held';
  end if;
  select jsonb_agg(jsonb_build_object(
    'rank',n,'title','Synthetic Track '||n,'artist','Synthetic Artist',
    'provider_track_id',lpad(n::text,11,'0'),
    'provider_url','https://www.youtube.com/watch?v='||lpad(n::text,11,'0'),
    'view_count',1000-n) order by n) into positions
    from generate_series(1,100) n;
  insert into storage.objects(bucket_id,name,metadata)
  values ('charts2-evidence-private-v1',keyname,
    jsonb_build_object('size',700,'mimetype','text/csv'));
  p:=jsonb_build_object(
    'source_key','youtube_ke','source_endpoint','https://charts.youtube.com/charts/TopSongs/ke',
    'capture_mode','official_export_upload','observed_at','2026-11-24T15:00:00Z',
    'original_object_key',keyname,'original_sha256',sha,'original_byte_length',700,
    'original_verified_at','2026-11-24T15:01:00Z','original_content_type','text/csv',
    'expected_depth',100,'observations',positions,
    'parser_version','charts2-youtube-official-export-v1','provider_updated_at',null,
    'provider_week_ending_date','2026-11-19',
    'native_period_authority','operator_confirmed_official_export',
    'method_revision',null,'captured_by',actor,'verification_state','server_sha256_storage_readback',
    'operator_export_acknowledgement',
    'I confirm this unmodified YouTube Charts CSV is Kenya Weekly Top Songs for the selected week.');
  begin
    perform public.charts2_commit_verified_original_v1(p-'operator_export_acknowledgement');
    raise exception 'charts2_export_missing_attestation_allowed';
  exception when check_violation then
    if sqlerrm<>'charts2_youtube_export_receipt_unqualified' then raise;end if;
  end;
  begin
    perform public.charts2_commit_verified_original_v1(
      p||jsonb_build_object('captured_by',gen_random_uuid()));
    raise exception 'charts2_export_unprivileged_actor_allowed';
  exception when insufficient_privilege then null;end;
  begin
    perform public.charts2_commit_verified_original_v1(
      p||jsonb_build_object('provider_week_ending_date','2026-11-18'));
    raise exception 'charts2_export_wrong_week_allowed';
  exception when check_violation then null;end;
  begin
    perform public.charts2_commit_verified_original_v1(
      jsonb_set(p,'{observations,0,view_count}','-1'::jsonb));
    raise exception 'charts2_export_invalid_count_allowed';
  exception when check_violation then
    if sqlerrm<>'charts2_youtube_export_rows_unqualified' then raise;end if;
  end;
  begin
    perform public.charts2_commit_verified_original_v1(
      jsonb_set(p,'{observations,1,view_count}','999999'::jsonb));
    raise exception 'charts2_export_inverted_view_order_allowed';
  exception when check_violation then
    if sqlerrm<>'charts2_youtube_export_view_order_invalid' then raise;end if;
  end;
  begin
    perform public.charts2_commit_verified_original_v1(
      p||jsonb_build_object('original_byte_length',701));
    raise exception 'charts2_export_unverified_storage_metadata_allowed';
  exception when check_violation then
    if sqlerrm<>'charts2_youtube_export_storage_metadata_mismatch' then raise;end if;
  end;
  begin
    perform public.charts2_commit_verified_original_v1(
      (p-'operator_export_acknowledgement')||jsonb_build_object('capture_mode','service_original','method_revision',1));
    raise exception 'charts2_export_collector_method_bypass_allowed';
  exception when others then
    if sqlerrm<>'charts2_source_method_not_admitted' then raise;end if;
  end;
  rid:=public.charts2_commit_verified_original_v1(p);
  if rid is null or public.charts2_commit_verified_original_v1(p) is distinct from rid
    or not exists (select 1 from platform_private.charts2_capture_receipts_v1
      where id=rid and captured_by=actor and original_sha256=sha
        and observed_depth=100 and original_content_type='text/csv'
        and capture_mode='official_export_upload'
        and native_period_authority='operator_confirmed_official_export'
        and provider_week_ending_date='2026-11-19'::date
        and method_revision is null and candidate_only and not can_score and not can_publish)
  then raise exception 'charts2_export_immutable_receipt_or_idempotency_failed';end if;
  begin
    perform public.charts2_commit_verified_original_v1(
      p||jsonb_build_object('provider_week_ending_date','2026-11-12'));
    raise exception 'charts2_export_same_bytes_different_period_allowed';
  exception when sqlstate 'PT409' then null;end;
  if (select to_jsonb(m) from platform_private.charts2_source_methods_v1 m
      where source_key='youtube_ke') is distinct from before_method
    or exists(select 1 from public.charts2_get_collector_method_v1('youtube_ke'))
  then raise exception 'charts2_export_changed_native_method_authority';end if;
  raise notice 'WK_CHARTS2_LOCAL_OFFICIAL_YOUTUBE_EXPORT_RECEIPT=PASS';
end
$charts2_official_export$;

-- Charts 2.0 Studio service-only read contract and versioned, private-only weights.
do $charts2_studio_snapshot$
declare
  snap jsonb;
  weights jsonb;
begin
  if not has_function_privilege('service_role',
       'public.charts2_studio_private_snapshot_v1()','EXECUTE')
     or has_function_privilege('authenticated',
       'public.charts2_studio_private_snapshot_v1()','EXECUTE')
     or has_function_privilege('anon',
       'public.charts2_studio_private_snapshot_v1()','EXECUTE')
  then raise exception 'charts2_studio_acl_broadened'; end if;
  select rule_set->'weights' into weights
  from public.wk_chart_methodologies_v2
  where methodology_version='consumption_led_cultural_presence_v1'
    and scoring_policy_version='charts2-private-ordinal-v1';
  if weights is null or
     weights <> '{"youtube_ke":30,"mdundo_ke":25,"apple_ke":20,"audiomack_ke":15,"shazam_ke":10}'::jsonb
  then raise exception 'charts2_studio_weights_invalid'; end if;
  snap:=public.charts2_studio_private_snapshot_v1();
  if snap->>'contract'<>'charts2-private-studio/v1' or
     pg_catalog.jsonb_typeof(snap->'receipts')<>'array' or
     pg_catalog.jsonb_typeof(snap->'registry_links')<>'array' or
     pg_catalog.jsonb_typeof(snap->'source_methods')<>'array' or
     pg_catalog.jsonb_typeof(snap->'history')<>'array' or
     snap->'methodology'->>'version'<>'consumption_led_cultural_presence_v1'
  then raise exception 'charts2_studio_snapshot_invalid'; end if;
  raise notice 'WK_CHARTS2_LOCAL_PRIVATE_STUDIO_SERVICE_READER=PASS';
end
$charts2_studio_snapshot$;

-- Phase 2 private freeze stays immutable, actor-authorized, and invisible to Data API.
do $charts2_freeze_authority$
begin
  if to_regclass('platform_private.charts2_private_freezes_v1') is null
    or to_regprocedure('public.charts2_private_freeze_preflight_v1()') is null
    or to_regprocedure('public.charts2_freeze_private_candidate_v1(text,uuid,text)') is null
    or to_regprocedure('platform_private.charts2_compute_private_freeze_v1()') is null
  then raise exception 'charts2_private_freeze_missing';end if;

  if not exists (
    select 1 from pg_catalog.pg_class c
    join pg_catalog.pg_namespace n on n.oid=c.relnamespace
    where n.nspname='platform_private'
      and c.relname='charts2_private_freezes_v1' and c.relrowsecurity
  ) or has_schema_privilege('anon','platform_private','USAGE')
    or has_schema_privilege('authenticated','platform_private','USAGE')
    or has_table_privilege('anon','platform_private.charts2_private_freezes_v1','SELECT')
    or has_table_privilege('authenticated','platform_private.charts2_private_freezes_v1','SELECT')
    or has_table_privilege('service_role','platform_private.charts2_private_freezes_v1','INSERT')
  then raise exception 'charts2_freeze_table_privacy_failure'; end if;

  if not has_function_privilege('service_role',
    'public.charts2_private_freeze_preflight_v1()','EXECUTE')
    or has_function_privilege('anon',
      'public.charts2_private_freeze_preflight_v1()','EXECUTE')
    or has_function_privilege('authenticated',
      'public.charts2_private_freeze_preflight_v1()','EXECUTE')
    or not has_function_privilege('authenticated',
      'public.charts2_freeze_private_candidate_v1(text,uuid,text)','EXECUTE')
    or has_function_privilege('anon',
      'public.charts2_freeze_private_candidate_v1(text,uuid,text)','EXECUTE')
    or has_function_privilege('service_role',
      'public.charts2_freeze_private_candidate_v1(text,uuid,text)','EXECUTE')
    or has_function_privilege('authenticated',
      'platform_private.charts2_compute_private_freeze_v1()','EXECUTE')
  then raise exception 'charts2_freeze_rpc_grant_boundary_failure'; end if;

  if not exists (
    select 1 from pg_catalog.pg_trigger t
    join pg_catalog.pg_class c on c.oid=t.tgrelid
    join pg_catalog.pg_namespace n on n.oid=c.relnamespace
    where n.nspname='platform_private'
      and c.relname='charts2_private_freezes_v1'
      and t.tgname='charts2_private_freezes_immutable_v1'
      and not t.tgisinternal
  ) then raise exception 'charts2_freeze_immutable_trigger_missing';end if;

  if exists (select 1 from platform_private.charts2_private_freezes_v1)
  then raise exception 'charts2_freeze_local_fixture_leak';end if;

  raise notice 'WK_CHARTS2_LOCAL_PRIVATE_FREEZE_AUTHORITY=PASS';
end
$charts2_freeze_authority$;

-- Replace ONLY the SQL reader inside the disposable verifier transaction.
-- This exercise never creates Production originals or canonical Registry links.
create or replace function public.charts2_studio_private_snapshot_v1()
returns jsonb language plpgsql stable security definer
set search_path=''
as $synthetic$
declare
  spec record;
  i integer;
  receipts jsonb:='[]'::jsonb;
  links jsonb:='[]'::jsonb;
  observations jsonb;
  method jsonb;
  sha text;
  rid text;
  track_uuid text;
  provider_key text;
  native_period text;
  ending text;
  ext text;
  export_mode boolean:=coalesce(current_setting('wk.charts2_ci_official_export',true),'no') in ('yes','bad_week');
begin
  select jsonb_build_object(
    'version','consumption_led_cultural_presence_v1',
    'scoring_policy_version','charts2-private-ordinal-v1',
    'rule_set',rule_set) into method
  from public.wk_chart_methodologies_v2
  where methodology_version='consumption_led_cultural_presence_v1';

  for spec in
    select * from (values
      ('youtube_ke','youtube','a',100,1,'application/json','.json',
        'https://charts.youtube.com/youtubei/v1/browse?alt=json'),
      ('mdundo_ke','mdundo','b',100,2,'text/html','.html',
        'https://play.mdundo.com/top-charts/ke'),
      ('apple_ke','apple_music','c',100,3,'text/html','.html',
        'https://music.apple.com/ke/playlist/top-100-kenya/pl.0b36ea82865d4adeb9d1d62207aab172'),
      ('audiomack_ke','audiomack','d',100,4,'text/html','.html',
        'https://audiomack.com/geo-charts/playlist/kenya'),
      ('shazam_ke','shazam','e',200,5,'text/csv','.csv',
        'https://www.shazam.com/services/charts/csv/top-200/kenya')
    ) v(source_key,provider_key,sha_letter,depth,receipt_number,mime,extension,endpoint)
  loop
    sha:=repeat(spec.sha_letter,64);
    rid:='00000000-0000-4000-8000-'||lpad(spec.receipt_number::text,12,'0');
    select coalesce(jsonb_agg(
      jsonb_build_object('rank',num,'title','Fixture Track '||num,
        'artist','Fixture Artist',
        'provider_track_id',case when spec.source_key='shazam_ke' then null
             else spec.source_key||':'||num end)
      order by num),'[]'::jsonb)
    into observations
    from generate_series(1,spec.depth) num;
    native_period:=case when spec.source_key='youtube_ke'
      then 'provider_declared_end_date' else 'unknown' end;
    ending:=case when spec.source_key='youtube_ke' then '2026-11-12'
      else null end;
    if spec.source_key='youtube_ke' and export_mode then
      native_period:='operator_confirmed_official_export';
      if current_setting('wk.charts2_ci_official_export',true)='bad_week' then ending:='2026-11-11';end if;
      select jsonb_agg(jsonb_build_object(
        'rank',num,'title','Fixture Track '||num,'artist','Fixture Artist',
        'provider_track_id',lpad(num::text,11,'0'),
        'provider_url','https://www.youtube.com/watch?v='||lpad(num::text,11,'0'),
        'view_count',1000-num) order by num)
      into observations from generate_series(1,100) num;
    end if;
    receipts:=receipts||jsonb_build_array(jsonb_build_object(
      'id',rid,
      'receipt_schema','charts2-original-receipt/v1',
      'source_key',spec.source_key,'market','KE',
      'source_endpoint',case when export_mode and spec.source_key='youtube_ke'
        then 'https://charts.youtube.com/charts/TopSongs/ke' else spec.endpoint end,
      'method_revision',case when export_mode and spec.source_key='youtube_ke' then null else 1 end,
      'capture_mode',case when export_mode and spec.source_key='youtube_ke'
        then 'official_export_upload' else 'service_original' end,
      'parser_version',case when export_mode and spec.source_key='youtube_ke'
        then 'charts2-youtube-official-export-v1' else 'charts2-ci-1' end,
      'original_bucket','charts2-evidence-private-v1',
      'original_object_key',spec.source_key||'/'||
        left(sha,2)||'/'||sha||case when export_mode and spec.source_key='youtube_ke' then '.csv' else spec.extension end,
      'original_sha256',sha,'original_byte_length',1024,
      'original_content_type',case when export_mode and spec.source_key='youtube_ke' then 'text/csv' else spec.mime end,
      'observed_at','2026-11-19T10:00:00Z',
      'original_verified_at','2026-11-19T10:01:00Z',
      'native_period_authority',native_period,
      'provider_week_ending_date',ending,
      'expected_depth',spec.depth,'observed_depth',spec.depth,
      'observed_status','succeeded',
      'candidate_only',true,'can_score',false,'can_publish',false,
      'observations',observations));

    if spec.source_key='apple_ke' then
      for i in 1..100 loop
        track_uuid:='00000000-0000-4000-8000-'||lpad(i::text,12,'0');
        links:=links||jsonb_build_array(jsonb_build_object(
          'id','00000000-0000-4000-8000-'||lpad((1000+i)::text,12,'0'),
          'track_id',track_uuid,
          'provider_key',spec.provider_key,
          'provider_track_id','apple_ke:'||i,
          'match_method','manual','match_status','matched',
          'match_confidence',1,'track_status','active',
          'review_evidence',jsonb_build_object(
            'charts2_studio_review_v1',true,'source_key','apple_ke',
            'receipt_id',rid,'original_sha256',sha,
            'provider_track_id','apple_ke:'||i,
            'review_note','Independently reviewed exact version-specific recording evidence for this native chart track.',
            'evidence_url','https://example.org/fixture-evidence/'||i)));
      end loop;
    end if;
  end loop;
  return jsonb_build_object(
    'contract','charts2-private-studio/v1',
    'methodology',method,'receipts',receipts,'registry_links',links,
    'history','[]'::jsonb,'source_methods','[]'::jsonb);
end
$synthetic$;

do $charts2_freeze_actual_100$
declare
  a jsonb;
  b jsonb;
  c jsonb;
begin
  perform set_config('wk.charts2_ci_official_export','no',true);
  a:=public.charts2_private_freeze_preflight_v1();
  b:=public.charts2_private_freeze_preflight_v1();
  if a->>'contract' is distinct from 'charts2-private-freeze-preflight/v1'
     or (a->>'freeze_ready')::boolean is distinct from true
     or (a->>'eligible_count')::integer is distinct from 100
     or (a->>'unresolved_count')::integer is distinct from 500
     or (a->>'conflict_count')::integer is distinct from 0
     or jsonb_array_length(a->'ranking')<>100
     or a->'ranking'->0->>'track_id' is distinct from
        '00000000-0000-4000-8000-000000000001'
     or (a->'ranking'->0->>'score_units')::integer<>4000
     or a->'ranking'->0->>'score_points' is distinct from '20.00'
     or (a->'ranking'->99->>'score_units')::integer<>40
     or a->>'input_sha256' is distinct from b->>'input_sha256'
     or a->>'ranking_sha256' is distinct from b->>'ranking_sha256'
     or length(a->>'input_sha256')<>64
     or length(a->>'ranking_sha256')<>64
  then raise exception 'charts2_private_freeze_100_rank_replay_failed';end if;
  raise notice 'WK_CHARTS2_LOCAL_PRIVATE_FREEZE_100_EXACT_REPLAY=PASS';
  perform set_config('wk.charts2_ci_official_export','yes',true);
  c:=public.charts2_private_freeze_preflight_v1();
  if (c->>'freeze_ready')::boolean is distinct from true
     or (c->>'eligible_count')::integer is distinct from 100
     or (c->>'unresolved_count')::integer is distinct from 500
     or (c->>'conflict_count')::integer is distinct from 0
     or c->>'ranking_sha256' is distinct from a->>'ranking_sha256'
     or c->>'input_sha256' is not distinct from a->>'input_sha256'
     or not exists(select 1 from jsonb_array_elements(c->'source_receipts') r
       where r->>'source_key'='youtube_ke'
         and r->>'native_period_authority'='operator_confirmed_official_export'
         and r->>'provider_week_ending_date'='2026-11-12')
  then raise exception 'charts2_export_freeze_parity_failed';end if;
  perform set_config('wk.charts2_ci_official_export','bad_week',true);
  begin
    perform public.charts2_private_freeze_preflight_v1();
    raise exception 'charts2_export_freeze_wrong_week_allowed';
  exception when others then
    if sqlerrm<>'charts2_freeze_youtube_export_unqualified' then raise;end if;
  end;
  perform set_config('wk.charts2_ci_official_export','no',true);
  raise notice 'WK_CHARTS2_LOCAL_OFFICIAL_YOUTUBE_EXPORT_FREEZE_PARITY=PASS';
end
$charts2_freeze_actual_100$;

-- Charts 2.0 origin-neutrality uses the retained Chart V2 integrity RPC.
-- All three draft rows are disposable, in this verifier's outer transaction.
insert into public.wk_chart_editions_v2
(id,program_id,edition_slug,edition_label,entry_count,status,
 methodology_version,scoring_policy_version,chart_size)
values
('charts2-ci-origin-new','top100','ci-origin-new','CI new origin',1,'draft',
 'consumption_led_cultural_presence_v1','charts2-private-ordinal-v1',100),
('charts2-ci-origin-legacy','top100','ci-origin-legacy','CI legacy origin',1,'draft',
 'weighted_streaming_v1','legacy_policy',100),
('charts2-ci-origin-rnb','toprnb','ci-origin-rnb','CI RnB origin',1,'draft',
 'consumption_led_cultural_presence_v1','charts2-private-ordinal-v1',20);

insert into public.wk_chart_entries_v2
(id,edition_id,rank,track_title,artist_slug,artist_name,total_score)
values
('charts2-ci-origin-entry-new','charts2-ci-origin-new',1,
 'CI Recording','no-such-origin-ci-fixture','No Such CI Artist',1),
('charts2-ci-origin-entry-legacy','charts2-ci-origin-legacy',1,
 'CI Recording','no-such-origin-ci-fixture','No Such CI Artist',1),
('charts2-ci-origin-entry-rnb','charts2-ci-origin-rnb',1,
 'CI Recording','no-such-origin-ci-fixture','No Such CI Artist',1);

do $charts2_origin_neutral_acceptance$
declare v_new jsonb;v_legacy jsonb;v_rnb jsonb;
begin
  v_new:=public.chart_get_edition_integrity_report('charts2-ci-origin-new');
  v_legacy:=public.chart_get_edition_integrity_report('charts2-ci-origin-legacy');
  v_rnb:=public.chart_get_edition_integrity_report('charts2-ci-origin-rnb');

  if v_new->'blockers' ? 'unresolved_artist_origins'
     or v_new->'blockers' ? 'country_ineligible_entries'
     or not (v_new->'blockers' ? 'charts2_publisher_not_enabled')
     or not (v_new->'blockers' ? 'charts2_requires_exact_100')
     or v_new->>'publishable' <> 'false'
     or jsonb_array_length(v_new->'invalidRows') <> 0
  then raise exception 'charts2_origin_neutral_new_guard_failed: %',v_new;
  end if;

  if not (v_legacy->'blockers' ? 'unresolved_artist_origins')
     or v_legacy->'blockers' ? 'charts2_publisher_not_enabled'
  then raise exception 'charts2_origin_neutral_legacy_changed: %',v_legacy;
  end if;

  if not (v_rnb->'blockers' ? 'unresolved_artist_origins')
     or v_rnb->'blockers' ? 'charts2_publisher_not_enabled'
  then raise exception 'charts2_origin_neutral_toprnb_changed: %',v_rnb;
  end if;

  raise notice 'WK_CHARTS2_ORIGIN_NEUTRAL_LEGACY_AND_RNB_PRESERVED=PASS';
end
$charts2_origin_neutral_acceptance$;

-- Chart→Registry convergence is accepted only through existing governed
-- operations. All fixtures below are entirely rolled back and never use a
-- hosted or Production database. This SQL role simulation is not a genuine
-- signed-in browser/JWT runtime acceptance.
do $charts2_registry_convergence_v1$
declare
  actor_id uuid:=gen_random_uuid();
  youtube_receipt uuid:=gen_random_uuid();
  shazam_receipt uuid:=gen_random_uuid();
  youtube_sha text:=repeat('a',64);
  shazam_sha text:=repeat('b',64);
  positions jsonb;
  intake jsonb;
  artist_intake jsonb;
  credit jsonb;
  canonical_track uuid;
  approved jsonb;
  revoked jsonb;
  independent_note text:=
    'Independent review verified this exact recording and each distinct Artist credit against a reliable release and provider source.';
begin
  insert into auth.users(id) values(actor_id);
  perform set_config('request.jwt.claim.sub',actor_id::text,true);
  -- Signed-in alone must not grant Registry or Charts authority.
  begin
    perform public.admin_stage_charts2_track_intake_v1(
      'youtube_ke',youtube_receipt,youtube_sha,1);
    raise exception 'charts2_track_intake_unprivileged_allowed';
  exception when insufficient_privilege then null;end;
  insert into public.user_role_assignments(user_id,role_key,status)
    values(actor_id,'super_admin','active');
  if not public.current_user_has_capability('manage_charts')
     or not public.current_user_has_capability('manage_registry')
  then raise exception 'charts2_steward_capabilities_missing';end if;

  select jsonb_agg(jsonb_build_object('rank',n,'title','CI Original Recording',
    'artist','CI First Artist','provider_track_id','youtube-ci-'||n)
    order by n) into positions from generate_series(1,100) n;
  insert into platform_private.charts2_capture_receipts_v1(
    id,source_key,source_endpoint,method_revision,capture_mode,observed_at,
    original_object_key,original_byte_length,original_sha256,
    original_verified_at,original_content_type,expected_depth,observed_depth,
    observations,parser_version
  ) values (
    youtube_receipt,'youtube_ke','https://youtube.example.org/source',
    1,'research_original_upload',now(),'ci-youtube-'||youtube_receipt,
    512,youtube_sha,now(),'application/json',100,100,
    positions,'ci-original-v1'
  );
  intake:=public.admin_stage_charts2_track_intake_v1(
    'youtube_ke',youtube_receipt,youtube_sha,1);
  if intake->>'status' is distinct from 'needs_review'
     or (select count(*) from public.registry_provider_track_suggestion_artists
       where suggestion_id=(intake->>'suggestion_id')::uuid
         and credit_role='unresolved' and resolution_mode='unresolved')<>1
  then raise exception 'charts2_track_intake_original_credit_not_preserved';end if;
  if (public.admin_stage_charts2_track_intake_v1(
    'youtube_ke',youtube_receipt,youtube_sha,1
  )->>'idempotent_replay')::boolean is not true
  then raise exception 'charts2_track_intake_idempotent_replay_failed';end if;
  credit:=public.admin_append_charts2_track_intake_credit_v1(
    (intake->>'suggestion_id')::uuid,'CI Second Artist',
    independent_note,'https://example.org/ci-artist-evidence');
  if (credit->>'credit_order')::integer<>2
     or credit->>'credit_role' is distinct from 'unresolved'
  then raise exception 'charts2_additional_credit_prematurely_approved';end if;
  artist_intake:=public.admin_stage_charts2_artist_intake_v1(
    'youtube_ke',youtube_receipt,youtube_sha,1);
  if (artist_intake->>'staging_id') is null
     or not exists (
       select 1 from public.provider_intake_artist_staging a
       where a.id=(artist_intake->>'staging_id')::uuid
         and a.source_artist_name='CI First Artist'
         and a.source_origin_iso2 is null and a.source_spotify_id is null
         and a.source_metadata->>'chart_artist_claim_only'='true'
     )
  then raise exception 'charts2_artist_intake_invented_metadata';end if;
  -- A bad original cannot stage another governing identity.
  begin
    perform public.admin_stage_charts2_artist_intake_v1(
      'youtube_ke',youtube_receipt,repeat('f',64),1);
    raise exception 'charts2_stale_artist_source_allowed';
  exception when sqlstate 'PT409' then null;end;

  insert into public.registry_tracks(slug,title,normalized_title,status)
  values('ci-chart-'||substr(actor_id::text,1,8),
    'CI Original Recording','ci original recording','active')
  returning id into canonical_track;
  select jsonb_agg(jsonb_build_object('rank',n,'title','CI Original Recording',
    'artist','CI First Artist','provider_track_id',null)
    order by n) into positions from generate_series(1,200) n;
  insert into platform_private.charts2_capture_receipts_v1(
    id,source_key,source_endpoint,method_revision,capture_mode,observed_at,
    original_object_key,original_byte_length,original_sha256,
    original_verified_at,original_content_type,expected_depth,observed_depth,
    observations,parser_version
  ) values (
    shazam_receipt,'shazam_ke','https://shazam.example.org/source',
    1,'research_original_upload',now(),'ci-shazam-'||shazam_receipt,
    512,shazam_sha,now(),'application/json',200,200,
    positions,'ci-original-v1'
  );
  approved:=public.admin_review_charts2_no_id_observation_v1(
    shazam_receipt,shazam_sha,1,'approve',canonical_track,
    independent_note,'https://example.org/ci-track-evidence',null,
    'I independently verified this exact Shazam position and authorize its private Registry recording resolution.');
  if approved->>'event_id' is null
     or (select count(*) from platform_private.charts2_observation_review_events_v1
        where receipt_id=shazam_receipt and rank=1 and action='approve')<>1
  then raise exception 'charts2_shazam_approval_receipt_missing';end if;
  begin
    perform public.admin_review_charts2_no_id_observation_v1(
      shazam_receipt,shazam_sha,1,'approve',canonical_track,
      independent_note,'https://example.org/ci-track-evidence',
      gen_random_uuid(),
      'I independently verified this exact Shazam position and authorize its private Registry recording resolution.');
    raise exception 'charts2_shazam_stale_approval_allowed';
  exception when sqlstate 'PT409' then null;end;
  revoked:=public.admin_review_charts2_no_id_observation_v1(
    shazam_receipt,shazam_sha,1,'revoke',null,
    independent_note,'https://example.org/ci-correction-evidence',
    (approved->>'event_id')::uuid,
    'I revoke this exact private Shazam recording resolution after independent re-review.');
  if revoked->>'event_id' is null
     or (select count(*) from platform_private.charts2_observation_review_events_v1
         where receipt_id=shazam_receipt and rank=1)<>2
  then raise exception 'charts2_shazam_revocation_not_append_only';end if;
  begin
    update platform_private.charts2_observation_review_events_v1
    set action='approve' where id=(revoked->>'event_id')::uuid;
    raise exception 'charts2_shazam_review_ledger_mutable';
  exception when insufficient_privilege then null;end;
  if exists(select 1 from public.registry_track_provider_links
    where track_id=canonical_track)
  then raise exception 'charts2_shazam_fabricated_provider_link';end if;
  raise notice 'WK_CHARTS2_LOCAL_GOVERNED_REGISTRY_INTAKE_SHZAM_REVIEW=PASS';
end
$charts2_registry_convergence_v1$;

rollback;
\echo WK_CHARTS2_LOCAL_PRIVATE_EVIDENCE_ROLLBACK=PASS
