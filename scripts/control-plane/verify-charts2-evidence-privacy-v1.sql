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

rollback;
\echo WK_CHARTS2_LOCAL_PRIVATE_EVIDENCE_ROLLBACK=PASS
