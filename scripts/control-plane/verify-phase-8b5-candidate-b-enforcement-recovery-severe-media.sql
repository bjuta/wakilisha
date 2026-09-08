-- Permanent rollback-only verifier for Phase 8B.5 Candidate B.
-- Proves graduated Messages enforcement, user recovery, exact severe Media
-- containment, normal Media-processing fail-closed behavior, scoped scan jobs,
-- canonical history preservation, and Community/global-account isolation.

begin;
set constraints all deferred;

-- Structural authority and migration seal.
do $structural$
declare
  v_migration_count bigint;
  v_head text;
  v_table_count bigint;
  v_rls_count bigint;
  v_command_count bigint;
  v_definition text;
  v_constraint text;
begin
  select count(*),max(version)
  into v_migration_count,v_head
  from supabase_migrations.schema_migrations;

  if v_migration_count<>111
     or v_head<>'20260908184500' then
    raise exception
      'PHASE_8B5_B_FAIL: expected 111 migrations at Candidate B head 20260908184500, got count=% head=%',
      v_migration_count,
      v_head;
  end if;

  if not exists(
    select 1
    from supabase_migrations.schema_migrations
    where version='20260907203000'
      and name='phase_8b5_candidate_a_safety_case_quarantine'
  ) then
    raise exception 'PHASE_8B5_B_FAIL: Candidate A migration history is missing';
  end if;

  if not exists(
    select 1
    from supabase_migrations.schema_migrations
    where version='20260908184500'
      and name='phase_8b5_candidate_b_enforcement_recovery_severe_media'
  ) then
    raise exception 'PHASE_8B5_B_FAIL: Candidate B migration history is missing';
  end if;

  select count(*) into v_table_count
  from information_schema.tables
  where table_schema='messaging'
    and table_name in (
      'safety_enforcements',
      'safety_appeals',
      'safety_media_containment'
    );

  if v_table_count<>3 then
    raise exception 'PHASE_8B5_B_FAIL: expected exactly three Candidate B tables, got %',v_table_count;
  end if;

  select count(*) into v_rls_count
  from pg_class relation
  join pg_namespace namespace on namespace.oid=relation.relnamespace
  where namespace.nspname='messaging'
    and relation.relname in (
      'safety_enforcements',
      'safety_appeals',
      'safety_media_containment'
    )
    and relation.relrowsecurity;

  if v_rls_count<>3 then
    raise exception 'PHASE_8B5_B_FAIL: Candidate B RLS coverage is incomplete';
  end if;

  if exists(
    select 1
    from information_schema.role_table_grants grant_row
    where grant_row.table_schema='messaging'
      and grant_row.table_name in (
        'safety_enforcements',
        'safety_appeals',
        'safety_media_containment'
      )
      and grant_row.grantee in ('anon','authenticated','service_role')
  ) then
    raise exception 'PHASE_8B5_B_FAIL: browser/runtime roles have direct Candidate B table grants';
  end if;

  if (
    select count(*)
    from information_schema.tables
    where table_schema='messaging'
      and table_name in (
        'safety_cases','safety_case_targets','safety_case_events','message_quarantine'
      )
  )<>4 then
    raise exception 'PHASE_8B5_B_FAIL: Candidate A four-table Safety authority changed';
  end if;

  select pg_get_constraintdef(oid)
  into v_constraint
  from pg_constraint
  where conrelid='messaging.safety_cases'::regclass
    and conname='safety_cases_current_disposition_check';

  if position('pending' in v_constraint)=0
     or position('no_action' in v_constraint)=0
     or position('quarantine' in v_constraint)=0
     or position('enforced' in v_constraint)=0 then
    raise exception 'PHASE_8B5_B_FAIL: Candidate A disposition extension is incomplete';
  end if;

  select pg_get_constraintdef(oid)
  into v_constraint
  from pg_constraint
  where conrelid='messaging.safety_case_events'::regclass
    and conname='safety_case_events_event_kind_check';

  if position('opened' in v_constraint)=0
     or position('signal_added' in v_constraint)=0
     or position('evidence_viewed' in v_constraint)=0
     or position('assessment_updated' in v_constraint)=0
     or position('enforcement_applied' in v_constraint)=0
     or position('appeal_resolved' in v_constraint)=0
     or position('media_contained' in v_constraint)=0
     or position('media_containment_released' in v_constraint)=0 then
    raise exception 'PHASE_8B5_B_FAIL: Safety event vocabulary convergence is incomplete';
  end if;

  with expected(command_type,job_type,accepted_event_type,success_event_type,failure_event_type,retry_event_type) as (
    values
      ('messages.safety.assessment.update','messages.safety.assessment.update.sync','messages.safety.assessment.update.accepted','messages.safety.assessment.update.succeeded','messages.safety.assessment.update.failed','messages.safety.assessment.update.retry_scheduled'),
      ('messages.safety.enforcement.update','messages.safety.enforcement.update.sync','messages.safety.enforcement.update.accepted','messages.safety.enforcement.update.succeeded','messages.safety.enforcement.update.failed','messages.safety.enforcement.update.retry_scheduled'),
      ('messages.safety.appeal.submit','messages.safety.appeal.submit.sync','messages.safety.appeal.submit.accepted','messages.safety.appeal.submit.succeeded','messages.safety.appeal.submit.failed','messages.safety.appeal.submit.retry_scheduled'),
      ('messages.safety.appeal.review.start','messages.safety.appeal.review.start.sync','messages.safety.appeal.review.start.accepted','messages.safety.appeal.review.start.succeeded','messages.safety.appeal.review.start.failed','messages.safety.appeal.review.start.retry_scheduled'),
      ('messages.safety.appeal.resolve','messages.safety.appeal.resolve.sync','messages.safety.appeal.resolve.accepted','messages.safety.appeal.resolve.succeeded','messages.safety.appeal.resolve.failed','messages.safety.appeal.resolve.retry_scheduled'),
      ('messages.safety.media.containment.update','messages.safety.media.containment.update.sync','messages.safety.media.containment.update.accepted','messages.safety.media.containment.update.succeeded','messages.safety.media.containment.update.failed','messages.safety.media.containment.update.retry_scheduled'),
      ('messages.safety.media.scan','messages.safety.media.scan','messages.safety.media.scan.accepted','messages.safety.media.scan.succeeded','messages.safety.media.scan.failed','messages.safety.media.scan.retry_scheduled')
  )
  select count(*) into v_command_count
  from expected
  join platform_private.command_types actual using(command_type)
  where actual.enabled
    and actual.job_type=expected.job_type
    and actual.accepted_event_type=expected.accepted_event_type
    and actual.success_event_type=expected.success_event_type
    and actual.failure_event_type=expected.failure_event_type
    and actual.retry_event_type=expected.retry_event_type;

  if v_command_count<>7 then
    raise exception 'PHASE_8B5_B_FAIL: seven Candidate B command contracts are not exact';
  end if;

  if to_regprocedure('public.update_messages_safety_assessment_v1(uuid,text,text,numeric,text,text,uuid)') is null
     or to_regprocedure('public.set_messages_safety_enforcement_v1(uuid,uuid,text,boolean,timestamptz,boolean,text,text,integer,integer,integer,text,uuid)') is null
     or to_regprocedure('public.get_my_message_safety_state_v1()') is null
     or to_regprocedure('public.submit_messages_safety_appeal_v1(uuid,text,text,uuid)') is null
     or to_regprocedure('public.list_messages_safety_appeals_v1(text,timestamptz,uuid,integer)') is null
     or to_regprocedure('public.start_messages_safety_appeal_review_v1(uuid,text,uuid)') is null
     or to_regprocedure('public.resolve_messages_safety_appeal_v1(uuid,text,text,text,text,timestamptz,boolean,integer,integer,integer,text,uuid)') is null
     or to_regprocedure('public.set_messages_safety_media_containment_v1(uuid,uuid,boolean,text,text,uuid)') is null
     or to_regprocedure('public.submit_messages_safety_media_scan_v1(uuid,uuid,text,uuid)') is null
     or to_regprocedure('public.claim_messages_safety_media_scan_jobs_v1(text,integer,integer)') is null
     or to_regprocedure('public.get_messages_safety_media_scan_target_v1(uuid,text)') is null
     or to_regprocedure('public.complete_messages_safety_media_scan_job_v1(uuid,text,jsonb)') is null
     or to_regprocedure('public.fail_messages_safety_media_scan_job_v1(uuid,text,text,boolean,integer)') is null
     or to_regprocedure('public.recover_expired_messages_safety_media_scan_jobs_v1(integer,integer)') is null then
    raise exception 'PHASE_8B5_B_FAIL: Candidate B RPC family is incomplete';
  end if;

  if has_function_privilege('anon','public.get_my_message_safety_state_v1()'::regprocedure,'EXECUTE')
     or has_function_privilege('anon','public.update_messages_safety_assessment_v1(uuid,text,text,numeric,text,text,uuid)'::regprocedure,'EXECUTE')
     or has_function_privilege('anon','public.submit_messages_safety_appeal_v1(uuid,text,text,uuid)'::regprocedure,'EXECUTE')
     or has_function_privilege('authenticated','public.claim_messages_safety_media_scan_jobs_v1(text,integer,integer)'::regprocedure,'EXECUTE')
     or has_function_privilege('authenticated','public.get_messages_safety_media_scan_target_v1(uuid,text)'::regprocedure,'EXECUTE') then
    raise exception 'PHASE_8B5_B_FAIL: Candidate B RPC grants are broader than designed';
  end if;

  if not has_function_privilege('authenticated','public.get_my_message_safety_state_v1()'::regprocedure,'EXECUTE')
     or not has_function_privilege('authenticated','public.submit_messages_safety_appeal_v1(uuid,text,text,uuid)'::regprocedure,'EXECUTE')
     or not has_function_privilege('service_role','public.claim_messages_safety_media_scan_jobs_v1(text,integer,integer)'::regprocedure,'EXECUTE')
     or not has_function_privilege('service_role','public.complete_messages_safety_media_scan_job_v1(uuid,text,jsonb)'::regprocedure,'EXECUTE') then
    raise exception 'PHASE_8B5_B_FAIL: Candidate B RPC grants are incomplete';
  end if;

  if exists(
    select 1
    from information_schema.columns
    where table_schema='messaging'
      and table_name in ('safety_enforcements','safety_appeals','safety_media_containment')
      and column_name in ('body','sha256','storage_path','storage_key','bucket_name','object_path')
  ) then
    raise exception 'PHASE_8B5_B_FAIL: Candidate B duplicated Message/Media content authority';
  end if;

  if not exists(
    select 1 from pg_indexes
    where schemaname='media'
      and tablename='file_objects'
      and indexname='file_objects_hash_size_idx'
      and indexdef ilike '%(sha256, byte_size)%'
  ) then
    raise exception 'PHASE_8B5_B_FAIL: canonical Media hash/size index was not reused';
  end if;

  if not exists(
    select 1 from pg_indexes
    where schemaname='messaging'
      and tablename='messages'
      and indexname='messages_sender_chronology_idx'
  ) then
    raise exception 'PHASE_8B5_B_FAIL: sender chronology index is missing';
  end if;

  v_definition:=pg_get_functiondef('public.start_message_conversation(uuid,text,jsonb,text,uuid,timestamptz)'::regprocedure);
  if position('assert_sender_safety_allows_v1' in v_definition)=0
     or position('conversation_start' in v_definition)=0 then
    raise exception 'PHASE_8B5_B_FAIL: generic Conversation start bypasses sender Safety';
  end if;

  v_definition:=pg_get_functiondef('public.start_field_submission_message_v1(uuid,bigint,text,text,uuid,timestamptz)'::regprocedure);
  if position('assert_sender_safety_allows_v1' in v_definition)=0
     or position('conversation_start' in v_definition)=0 then
    raise exception 'PHASE_8B5_B_FAIL: Field Conversation start bypasses sender Safety';
  end if;

  v_definition:=pg_get_functiondef('public.send_message(uuid,text,jsonb,text,uuid,timestamptz)'::regprocedure);
  if position('assert_sender_safety_allows_v1' in v_definition)=0
     or position('message_send' in v_definition)=0 then
    raise exception 'PHASE_8B5_B_FAIL: Message send bypasses sender Safety';
  end if;

  v_definition:=pg_get_functiondef('messaging.assert_sender_safety_allows_v1(uuid,uuid,text,text,jsonb)'::regprocedure);
  if position('lock_sender_safety_subject_v1' in v_definition)=0
     or position('send_cooldown' in v_definition)=0
     or position('send_rate_limit' in v_definition)=0
     or position('message_contains_link' in v_definition)=0
     or position('media_asset' in v_definition)=0 then
    raise exception 'PHASE_8B5_B_FAIL: common sender enforcement helper is incomplete';
  end if;

  v_definition:=pg_get_functiondef('messaging.lock_sender_safety_subject_v1(uuid)'::regprocedure);
  if position('messages-safety-subject:' in v_definition)=0 then
    raise exception 'PHASE_8B5_B_FAIL: sender Safety advisory lock key is missing';
  end if;

  if not exists(
    select 1
    from pg_trigger trigger_row
    join pg_class relation on relation.oid=trigger_row.tgrelid
    join pg_namespace namespace on namespace.oid=relation.relnamespace
    where namespace.nspname='platform_private'
      and relation.relname='jobs'
      and trigger_row.tgname='jobs_media_safety_guard'
      and not trigger_row.tgisinternal
  )
  or not exists(
    select 1
    from pg_trigger trigger_row
    join pg_class relation on relation.oid=trigger_row.tgrelid
    join pg_namespace namespace on namespace.oid=relation.relnamespace
    where namespace.nspname='media'
      and relation.relname='variants'
      and trigger_row.tgname='variants_media_safety_guard'
      and not trigger_row.tgisinternal
  )
  or not exists(
    select 1
    from pg_trigger trigger_row
    join pg_class relation on relation.oid=trigger_row.tgrelid
    join pg_namespace namespace on namespace.oid=relation.relnamespace
    where namespace.nspname='media'
      and relation.relname='variant_selections'
      and trigger_row.tgname='variant_selections_media_safety_guard'
      and not trigger_row.tgisinternal
  ) then
    raise exception 'PHASE_8B5_B_FAIL: normal Media processing guard triggers are incomplete';
  end if;

  v_definition:=pg_get_functiondef('public.claim_media_processing_jobs_v1(text,integer,integer)'::regprocedure);
  if position('media_file_is_safety_contained' in v_definition)=0 then
    raise exception 'PHASE_8B5_B_FAIL: normal Media claim can lease contained source work';
  end if;

  v_definition:=pg_get_functiondef('public.complete_media_processing_job_v1(uuid,text,jsonb)'::regprocedure);
  if position('lock_media_safety_identity_v1' in v_definition)=0
     or position('media_file_is_safety_contained' in v_definition)=0 then
    raise exception 'PHASE_8B5_B_FAIL: normal Media completion can bypass containment';
  end if;

  v_definition:=pg_get_functiondef('public.fail_media_processing_job_v1(uuid,text,text,boolean,integer)'::regprocedure);
  if position('cancel_media_processing_job_for_safety_v1' in v_definition)=0 then
    raise exception 'PHASE_8B5_B_FAIL: contained normal Media failure can return to retry';
  end if;

  v_definition:=pg_get_functiondef('public.recover_expired_media_processing_jobs_v1(integer,integer)'::regprocedure);
  if position('cancel_media_processing_job_for_safety_v1' in v_definition)=0 then
    raise exception 'PHASE_8B5_B_FAIL: contained expired Media work can return to retry';
  end if;

  v_definition:=pg_get_functiondef('public.resolve_media_asset_delivery(uuid,uuid,uuid,text)'::regprocedure);
  if position('assert_media_file_not_safety_contained_v1' in v_definition)=0 then
    raise exception 'PHASE_8B5_B_FAIL: canonical Media resolver ignores containment';
  end if;

  v_definition:=pg_get_functiondef('public.get_media_private_delivery_target_v1(uuid)'::regprocedure);
  if position('assert_media_file_not_safety_contained_v1' in v_definition)=0 then
    raise exception 'PHASE_8B5_B_FAIL: private Media delivery ignores containment';
  end if;

  v_definition:=pg_get_functiondef('audio.assert_publishable_version_media(uuid)'::regprocedure);
  if position('media_file_is_safety_contained' in v_definition)=0
     or position('waveform_data' in v_definition)=0 then
    raise exception 'PHASE_8B5_B_FAIL: Audio publication Media containment is incomplete';
  end if;

  v_definition:=pg_get_functiondef('public.get_public_audio_publication_m1(text)'::regprocedure);
  if position('audio.assert_publishable_version_media' in v_definition)=0 then
    raise exception 'PHASE_8B5_B_FAIL: public Audio payload bypasses publishability containment';
  end if;

  v_definition:=pg_get_functiondef('video.assert_publishable_publication_version(uuid)'::regprocedure);
  if position('media_file_is_safety_contained' in v_definition)=0
     or position('video_hls_master' in v_definition)=0 then
    raise exception 'PHASE_8B5_B_FAIL: Video publication containment is incomplete';
  end if;

  v_definition:=pg_get_functiondef('platform_private.get_public_video_publication_phase_7b(text,text)'::regprocedure);
  if position('assert_publishable_publication_version' in v_definition)=0 then
    raise exception 'PHASE_8B5_B_FAIL: public Video payload bypasses publishability authority';
  end if;

  v_definition:=pg_get_functiondef('public.get_public_video_caption_delivery_target(uuid,integer)'::regprocedure);
  if position('media_file_is_safety_contained' in v_definition)=0 then
    raise exception 'PHASE_8B5_B_FAIL: Video caption delivery ignores containment';
  end if;

  v_definition:=pg_get_functiondef('public.get_public_video_transcript_delivery_target(uuid)'::regprocedure);
  if position('media_file_is_safety_contained' in v_definition)=0 then
    raise exception 'PHASE_8B5_B_FAIL: Video Transcript delivery ignores containment';
  end if;

  v_definition:=pg_get_functiondef('audio.publication_version_review_media(uuid)'::regprocedure);
  if position('media_file_is_safety_contained' in v_definition)=0 then
    raise exception 'PHASE_8B5_B_FAIL: Audio review Media projection leaks contained delivery';
  end if;

  v_definition:=pg_get_functiondef('public.get_audio_editorial_media_context(uuid)'::regprocedure);
  if position('media_file_is_safety_contained' in v_definition)=0 then
    raise exception 'PHASE_8B5_B_FAIL: Audio editorial Media projection leaks contained delivery';
  end if;

  v_definition:=pg_get_functiondef('public.get_media_asset_v2(uuid)'::regprocedure);
  if position('media_file_is_safety_contained' in v_definition)=0 then
    raise exception 'PHASE_8B5_B_FAIL: Media asset detail leaks contained delivery';
  end if;

  v_definition:=pg_get_functiondef('public.read_media_assets_admin_v2(jsonb)'::regprocedure);
  if position('media_file_is_safety_contained' in v_definition)=0 then
    raise exception 'PHASE_8B5_B_FAIL: Media admin projection leaks contained delivery';
  end if;

  v_definition:=pg_get_functiondef('public.list_public_playlists(integer,timestamptz,uuid)'::regprocedure);
  if position('playlist_publication_payload_safety_v1' in v_definition)=0 then
    raise exception 'PHASE_8B5_B_FAIL: public Playlist list leaks snapshot cover containment';
  end if;

  v_definition:=pg_get_functiondef('public.get_public_playlist(text)'::regprocedure);
  if position('playlist_publication_payload_safety_v1' in v_definition)=0 then
    raise exception 'PHASE_8B5_B_FAIL: public Playlist payload leaks snapshot cover containment';
  end if;
  v_definition:=pg_get_functiondef('public.get_playlist_current_cover(uuid)'::regprocedure);
  if position('resolve_media_asset_delivery' in v_definition)=0 then
    raise exception 'PHASE_8B5_B_FAIL: current Playlist cover bypasses canonical containment-aware delivery';
  end if;

  v_definition:=pg_get_functiondef('public.get_playlist_cover_source(uuid,uuid)'::regprocedure);
  if position('media_file_is_safety_contained' in v_definition)=0 then
    raise exception 'PHASE_8B5_B_FAIL: Playlist cover source leaks contained canonical Media';
  end if;

end
$structural$;

-- Canonical human fixtures.
create temporary table phase8b5_b_actors(
  actor_key text primary key,
  user_id uuid not null,
  person_resource_id uuid
) on commit drop;

create temporary table phase8b5_b_subjects(
  subject_key text primary key,
  user_id uuid not null,
  person_resource_id uuid,
  conversation_id uuid,
  sender_participant_id uuid,
  recipient_participant_id uuid,
  message_id uuid,
  case_id uuid,
  primary_enforcement_id uuid,
  secondary_enforcement_id uuid,
  appeal_id uuid,
  replacement_enforcement_id uuid
) on commit drop;

create temporary table phase8b5_b_media(
  file_key text primary key,
  file_id uuid not null,
  sha256 text not null,
  byte_size bigint not null,
  storage_path text not null
) on commit drop;

create temporary table phase8b5_b_jobs(
  job_key text primary key,
  receipt_id uuid not null,
  job_id uuid not null
) on commit drop;


create temporary table phase8b5_b_baseline(
  community_report_count bigint not null,
  community_block_count bigint not null,
  media_resource_id uuid not null
) on commit drop;

insert into phase8b5_b_baseline(
  community_report_count,community_block_count,media_resource_id
)
values(
  (select count(*) from public.community_reports),
  (select count(*) from public.community_blocks),
  gen_random_uuid()
);

insert into phase8b5_b_actors(actor_key,user_id)
values
  ('recipient',gen_random_uuid()),
  ('super_admin',gen_random_uuid()),
  ('ordinary_admin',gen_random_uuid());

insert into phase8b5_b_subjects(subject_key,user_id)
values
  ('low',gen_random_uuid()),
  ('severe',gen_random_uuid()),
  ('appeal',gen_random_uuid()),
  ('modified',gen_random_uuid()),
  ('media',gen_random_uuid());

insert into auth.users(
  id,aud,role,email,raw_app_meta_data,raw_user_meta_data,
  created_at,updated_at,is_sso_user,is_anonymous
)
select
  actor.user_id,
  'authenticated',
  'authenticated',
  'phase8b5-b-'||actor.actor_key||'-'||left(actor.user_id::text,8)||'@example.invalid',
  jsonb_build_object('provider','email','providers',jsonb_build_array('email')),
  jsonb_build_object('name','Phase 8B5 B '||actor.actor_key),
  now(),now(),false,false
from phase8b5_b_actors actor
union all
select
  subject.user_id,
  'authenticated',
  'authenticated',
  'phase8b5-b-'||subject.subject_key||'-'||left(subject.user_id::text,8)||'@example.invalid',
  jsonb_build_object('provider','email','providers',jsonb_build_array('email')),
  jsonb_build_object('name','Phase 8B5 B '||subject.subject_key),
  now(),now(),false,false
from phase8b5_b_subjects subject;

set constraints all immediate;
set constraints all deferred;

update phase8b5_b_actors actor
set person_resource_id=link.person_resource_id
from editorial.person_identity_links link
where link.user_id=actor.user_id
  and link.link_state='active';

update phase8b5_b_subjects subject
set person_resource_id=link.person_resource_id
from editorial.person_identity_links link
where link.user_id=subject.user_id
  and link.link_state='active';

do $identity_assert$
begin
  if exists(select 1 from phase8b5_b_actors where person_resource_id is null)
     or exists(select 1 from phase8b5_b_subjects where person_resource_id is null) then
    raise exception 'PHASE_8B5_B_FAIL: canonical Person fixture provisioning failed';
  end if;
end
$identity_assert$;

insert into public.user_role_assignments(
  user_id,role_key,status,assigned_by,assigned_at,notes,created_at,updated_at
)
select user_id,'super_admin','active',null::uuid,now(),'Phase 8B.5 Candidate B rollback verifier',now(),now()
from phase8b5_b_actors where actor_key='super_admin'
union all
select user_id,'administrator','active',null::uuid,now(),'Phase 8B.5 Candidate B rollback verifier',now(),now()
from phase8b5_b_actors where actor_key='ordinary_admin'
union all
select user_id,'author','active',null::uuid,now(),'Phase 8B.5 Candidate B rollback verifier',now(),now()
from phase8b5_b_actors where actor_key='recipient'
union all
select user_id,'author','active',null::uuid,now(),'Phase 8B.5 Candidate B rollback verifier',now(),now()
from phase8b5_b_subjects;

-- The low-severity sender also owns newsroom Field intake capability so the
-- Conversation-start restriction can be exercised through both accepted start paths.
insert into public.user_role_assignments(
  user_id,role_key,status,assigned_by,assigned_at,notes,created_at,updated_at
)
select user_id,'editor','active',null::uuid,now(),'Phase 8B.5 Candidate B Field start verifier',now(),now()
from phase8b5_b_subjects where subject_key='low'
union all
select user_id,'field_contributor','active',null::uuid,now(),'Phase 8B.5 Candidate B Field start verifier',now(),now()
from phase8b5_b_actors where actor_key='recipient';

create temporary table phase8b5_b_field_fixture(
  field_resource_id uuid primary key
) on commit drop;
insert into phase8b5_b_field_fixture values(gen_random_uuid());

insert into editorial.resources(id,resource_kind,owner_id,visibility,lifecycle_state,created_by)
select f.field_resource_id,'field_submission',a.user_id,'private','active',a.user_id
from phase8b5_b_field_fixture f
cross join phase8b5_b_actors a
where a.actor_key='recipient';

insert into editorial.field_submissions(
  resource_id,resource_kind,submission_reference,owner_user_id,submitter_mode,current_revision,submission_state,
  newsroom_identity_mode,public_attribution_preference,contact_preference,follow_up_permission,preferred_contact_channel,
  rights_declaration,consent_declaration,declared_sensitivity,source_protection_request,embargo_request_mode,location_mode,
  created_by,updated_by,received_at,correlation_id
)
select f.field_resource_id,'field_submission',
       'FS-'||to_char(now(),'YYYYMMDD')||'-'||upper(left(replace(f.field_resource_id::text,'-',''),10)),
       a.user_id,'authenticated',1,'received','standard','do_not_name','account_contact','allowed','messages',
       'owns_or_controls','granted','none','internal','none','not_collected',a.user_id,a.user_id,now(),gen_random_uuid()
from phase8b5_b_field_fixture f
cross join phase8b5_b_actors a
where a.actor_key='recipient';

-- One direct Conversation and baseline Message for every subject.
do $conversation_fixture$
declare
  v_subject record;
  v_recipient_user uuid;
  v_recipient_person uuid;
  v_conversation uuid;
  v_sender_participant uuid;
  v_recipient_participant uuid;
  v_message uuid;
begin
  select user_id,person_resource_id
  into v_recipient_user,v_recipient_person
  from phase8b5_b_actors
  where actor_key='recipient';

  for v_subject in select * from phase8b5_b_subjects order by subject_key loop
    insert into messaging.conversations(
      security_classification,status,created_at,last_activity_at,correlation_id
    ) values('standard','active',now(),now(),gen_random_uuid())
    returning id into v_conversation;

    insert into messaging.conversation_participants(
      conversation_id,actor_kind,person_resource_id,user_id,
      membership_status,mailbox_folder,first_contact_state
    ) values(
      v_conversation,'human',v_subject.person_resource_id,v_subject.user_id,
      'active','inbox','accepted'
    ) returning id into v_sender_participant;

    insert into messaging.conversation_participants(
      conversation_id,actor_kind,person_resource_id,user_id,
      membership_status,mailbox_folder,first_contact_state
    ) values(
      v_conversation,'human',v_recipient_person,v_recipient_user,
      'active','inbox','accepted'
    ) returning id into v_recipient_participant;

    update messaging.conversations
    set created_by_participant_id=v_sender_participant
    where id=v_conversation;

    insert into messaging.messages(
      conversation_id,sender_participant_id,message_kind,body,
      accepted_at,client_created_at,correlation_id
    ) values(
      v_conversation,v_sender_participant,'text',
      'Candidate B baseline '||v_subject.subject_key||' Message',
      now(),now(),gen_random_uuid()
    ) returning id into v_message;

    insert into messaging.message_receipts(
      message_id,participant_id,conversation_id,delivery_state,delivered_at
    ) values(v_message,v_recipient_participant,v_conversation,'delivered',now());

    update phase8b5_b_subjects
    set conversation_id=v_conversation,
        sender_participant_id=v_sender_participant,
        recipient_participant_id=v_recipient_participant,
        message_id=v_message
    where subject_key=v_subject.subject_key;
  end loop;
end
$conversation_fixture$;

-- A canonical Media Resource reference that the low subject is allowed to reference.
insert into editorial.resources(
  id,resource_kind,owner_id,visibility,lifecycle_state,created_by
)
select
  (select media_resource_id from phase8b5_b_baseline),
  'media_asset',
  user_id,
  'internal',
  'active',
  user_id
from phase8b5_b_subjects
where subject_key='low';

grant select,update on phase8b5_b_actors to authenticated,service_role;
grant select,update on phase8b5_b_subjects to authenticated,service_role;
grant select,update on phase8b5_b_media to authenticated,service_role;
grant select,update on phase8b5_b_jobs to authenticated,service_role;

-- Participant creates the five exact Candidate A Safety Cases.
select set_config(
  'request.jwt.claims',
  (select jsonb_build_object('sub',user_id::text,'role','authenticated')::text
   from phase8b5_b_actors where actor_key='recipient'),
  true
);
set local role authenticated;

with report as (
  select public.report_message_safety_v1(
    (select message_id from phase8b5_b_subjects where subject_key='low'),
    'harassment','Candidate B low case','phase8b5-b-report-low-0001',null
  ) as payload
)
update phase8b5_b_subjects set case_id=(report.payload->>'safety_case_id')::uuid
from report where subject_key='low';

with report as (
  select public.report_message_safety_v1(
    (select message_id from phase8b5_b_subjects where subject_key='severe'),
    'abuse','Candidate B severe case','phase8b5-b-report-severe-0001',null
  ) as payload
)
update phase8b5_b_subjects set case_id=(report.payload->>'safety_case_id')::uuid
from report where subject_key='severe';

with report as (
  select public.report_message_safety_v1(
    (select message_id from phase8b5_b_subjects where subject_key='appeal'),
    'harassment','Candidate B appeal case','phase8b5-b-report-appeal-0001',null
  ) as payload
)
update phase8b5_b_subjects set case_id=(report.payload->>'safety_case_id')::uuid
from report where subject_key='appeal';

with report as (
  select public.report_message_safety_v1(
    (select message_id from phase8b5_b_subjects where subject_key='modified'),
    'spam','Candidate B modified appeal case','phase8b5-b-report-modified-0001',null
  ) as payload
)
update phase8b5_b_subjects set case_id=(report.payload->>'safety_case_id')::uuid
from report where subject_key='modified';

with report as (
  select public.report_message_safety_v1(
    (select message_id from phase8b5_b_subjects where subject_key='media'),
    'severe_media','Candidate B severe Media case','phase8b5-b-report-media-0001',null
  ) as payload
)
update phase8b5_b_subjects set case_id=(report.payload->>'safety_case_id')::uuid
from report where subject_key='media';

reset role;

-- Ordinary Administrator never receives Candidate B control authority.
select set_config(
  'request.jwt.claims',
  (select jsonb_build_object('sub',user_id::text,'role','authenticated')::text
   from phase8b5_b_actors where actor_key='ordinary_admin'),
  true
);
set local role authenticated;

do $ordinary_admin_denial$
begin
  begin
    perform public.update_messages_safety_assessment_v1(
      (select case_id from phase8b5_b_subjects where subject_key='low'),
      'harassment','low',0.5,'Ordinary Admin must not decide Safety.',
      'phase8b5-b-admin-denied-0001',null
    );
    raise exception 'PHASE_8B5_B_FAIL: ordinary Administrator updated Safety assessment';
  exception when sqlstate '42501' then null; end;

  begin
    perform public.list_messages_safety_appeals_v1(null,null,null,50);
    raise exception 'PHASE_8B5_B_FAIL: ordinary Administrator read Safety appeals';
  exception when sqlstate '42501' then null; end;
end
$ordinary_admin_denial$;

reset role;

-- Super Admin starts review and sets reviewed assessment authority.
select set_config(
  'request.jwt.claims',
  (select jsonb_build_object('sub',user_id::text,'role','authenticated')::text
   from phase8b5_b_actors where actor_key='super_admin'),
  true
);
set local role authenticated;

select public.start_messages_safety_review_v1(
  (select case_id from phase8b5_b_subjects where subject_key='low'),
  'phase8b5-b-review-low-0001',null
);
select public.start_messages_safety_review_v1(
  (select case_id from phase8b5_b_subjects where subject_key='severe'),
  'phase8b5-b-review-severe-0001',null
);
select public.start_messages_safety_review_v1(
  (select case_id from phase8b5_b_subjects where subject_key='appeal'),
  'phase8b5-b-review-appeal-0001',null
);
select public.start_messages_safety_review_v1(
  (select case_id from phase8b5_b_subjects where subject_key='modified'),
  'phase8b5-b-review-modified-0001',null
);
select public.start_messages_safety_review_v1(
  (select case_id from phase8b5_b_subjects where subject_key='media'),
  'phase8b5-b-review-media-0001',null
);

select public.update_messages_safety_assessment_v1(
  (select case_id from phase8b5_b_subjects where subject_key='low'),
  'harassment','low',0.5,'Reviewed low severity.',
  'phase8b5-b-assess-low-0001',null
);
select public.update_messages_safety_assessment_v1(
  (select case_id from phase8b5_b_subjects where subject_key='severe'),
  'abuse','severe',0.95,'Reviewed severe severity.',
  'phase8b5-b-assess-severe-0001',null
);
select public.update_messages_safety_assessment_v1(
  (select case_id from phase8b5_b_subjects where subject_key='appeal'),
  'harassment','high',0.8,'Reviewed high severity.',
  'phase8b5-b-assess-appeal-0001',null
);
select public.update_messages_safety_assessment_v1(
  (select case_id from phase8b5_b_subjects where subject_key='modified'),
  'spam','medium',0.7,'Reviewed medium severity.',
  'phase8b5-b-assess-modified-0001',null
);
select public.update_messages_safety_assessment_v1(
  (select case_id from phase8b5_b_subjects where subject_key='media'),
  'severe_media','severe',0.99,'Reviewed severe Media severity.',
  'phase8b5-b-assess-media-0001',null
);

-- Low severity cannot jump to high-tier action.
do $graduation_reject$
begin
  begin
    perform public.set_messages_safety_enforcement_v1(
      (select case_id from phase8b5_b_subjects where subject_key='low'),
      (select message_id from phase8b5_b_subjects where subject_key='low'),
      'messaging_suspended',true,now()+interval '1 hour',false,
      'Temporary restriction.','Low severity cannot suspend.',
      null,null,null,'phase8b5-b-low-illegal-suspend-0001',null
    );
    raise exception 'PHASE_8B5_B_FAIL: low severity applied messaging_suspended';
  exception when sqlstate '42501' then null; end;
end
$graduation_reject$;

-- Warning is accountable notice only.
with applied as (
  select public.set_messages_safety_enforcement_v1(
    (select case_id from phase8b5_b_subjects where subject_key='low'),
    (select message_id from phase8b5_b_subjects where subject_key='low'),
    'warning',true,null,false,
    'Please follow the Messages rules.','Reviewed low-level warning.',
    null,null,null,'phase8b5-b-low-warning-0001',null
  ) as payload
)
update phase8b5_b_subjects
set primary_enforcement_id=(applied.payload->>'enforcement_id')::uuid
from applied where subject_key='low';

reset role;

select set_config(
  'request.jwt.claims',
  (select jsonb_build_object('sub',user_id::text,'role','authenticated')::text
   from phase8b5_b_subjects where subject_key='low'),
  true
);
set local role authenticated;

create temporary table phase8b5_b_warning_send as
select * from public.send_message(
  (select conversation_id from phase8b5_b_subjects where subject_key='low'),
  'Warning does not block this canonical send.',
  '[]'::jsonb,
  'phase8b5-b-warning-send-0001',null,now()
);

reset role;

do $warning_assert$
begin
  if (select message_id from phase8b5_b_warning_send) is null then
    raise exception 'PHASE_8B5_B_FAIL: warning blocked canonical Message send';
  end if;

  if not exists(
    select 1
    from messaging.safety_enforcements enforcement
    join phase8b5_b_subjects subject on subject.primary_enforcement_id=enforcement.id
    where subject.subject_key='low'
      and enforcement.subject_user_id=subject.user_id
      and enforcement.subject_person_resource_id=subject.person_resource_id
      and enforcement.source_message_id=subject.message_id
      and enforcement.enforcement_kind='warning'
  ) then
    raise exception 'PHASE_8B5_B_FAIL: exact Message target did not derive exact human sender';
  end if;
end
$warning_assert$;

-- Cooldown and canonical chronology.
select set_config(
  'request.jwt.claims',
  (select jsonb_build_object('sub',user_id::text,'role','authenticated')::text
   from phase8b5_b_actors where actor_key='super_admin'),
  true
);
set local role authenticated;

select public.set_messages_safety_enforcement_v1(
  (select case_id from phase8b5_b_subjects where subject_key='low'),
  (select message_id from phase8b5_b_subjects where subject_key='low'),
  'send_cooldown',true,now()+interval '1 hour',false,
  'Please wait before sending again.','One-hour chronology cooldown.',
  3600,null,null,'phase8b5-b-low-cooldown-0001',null
);

reset role;
select set_config(
  'request.jwt.claims',
  (select jsonb_build_object('sub',user_id::text,'role','authenticated')::text
   from phase8b5_b_subjects where subject_key='low'),
  true
);
set local role authenticated;

do $cooldown_denial$
declare
  v_access jsonb;
begin
  v_access:=public.get_my_message_access();
  if coalesce((v_access->>'can_send')::boolean,true)
     or coalesce((v_access->>'can_start')::boolean,true)
     or not coalesce((v_access->>'visible')::boolean,false)
     or v_access->'send_limited_until' is null then
    raise exception 'PHASE_8B5_B_FAIL: cooldown safe access projection is inconsistent with send authority';
  end if;

  begin
    perform public.send_message(
      (select conversation_id from phase8b5_b_subjects where subject_key='low'),
      'This cooldown send must fail.','[]'::jsonb,
      'phase8b5-b-cooldown-denied-0001',null,now()
    );
    raise exception 'PHASE_8B5_B_FAIL: cooldown allowed canonical send';
  exception when sqlstate '42501' then null; end;
end
$cooldown_denial$;

reset role;
select set_config(
  'request.jwt.claims',
  (select jsonb_build_object('sub',user_id::text,'role','authenticated')::text
   from phase8b5_b_actors where actor_key='super_admin'),
  true
);
set local role authenticated;

select public.set_messages_safety_enforcement_v1(
  (select case_id from phase8b5_b_subjects where subject_key='low'),
  (select message_id from phase8b5_b_subjects where subject_key='low'),
  'send_cooldown',false,null,false,
  'Cooldown released.','Cooldown released for verifier.',
  null,null,null,'phase8b5-b-low-cooldown-release-0001',null
);

-- Rate limit reads canonical accepted Message chronology, not a counter table.
select public.set_messages_safety_enforcement_v1(
  (select case_id from phase8b5_b_subjects where subject_key='low'),
  (select message_id from phase8b5_b_subjects where subject_key='low'),
  'send_rate_limit',true,now()+interval '1 hour',false,
  'Temporary sending limit.','One accepted Message per hour.',
  null,1,3600,'phase8b5-b-low-rate-0001',null
);

reset role;
select set_config(
  'request.jwt.claims',
  (select jsonb_build_object('sub',user_id::text,'role','authenticated')::text
   from phase8b5_b_subjects where subject_key='low'),
  true
);
set local role authenticated;

do $rate_denial$
begin
  begin
    perform public.send_message(
      (select conversation_id from phase8b5_b_subjects where subject_key='low'),
      'This rate-limited send must fail.','[]'::jsonb,
      'phase8b5-b-rate-denied-0001',null,now()
    );
    raise exception 'PHASE_8B5_B_FAIL: rate limit allowed canonical send';
  exception when sqlstate '42501' then null; end;
end
$rate_denial$;

reset role;
select set_config(
  'request.jwt.claims',
  (select jsonb_build_object('sub',user_id::text,'role','authenticated')::text
   from phase8b5_b_actors where actor_key='super_admin'),
  true
);
set local role authenticated;
select public.set_messages_safety_enforcement_v1(
  (select case_id from phase8b5_b_subjects where subject_key='low'),
  (select message_id from phase8b5_b_subjects where subject_key='low'),
  'send_rate_limit',false,null,false,
  'Sending limit released.','Rate limit released for verifier.',
  null,null,null,'phase8b5-b-low-rate-release-0001',null
);

-- Upgrade reviewed assessment to medium for orthogonal content/start controls.
select public.update_messages_safety_assessment_v1(
  (select case_id from phase8b5_b_subjects where subject_key='low'),
  'harassment','medium',0.7,'Reviewed medium controls.',
  'phase8b5-b-assess-low-medium-0001',null
);

select public.set_messages_safety_enforcement_v1(
  (select case_id from phase8b5_b_subjects where subject_key='low'),
  (select message_id from phase8b5_b_subjects where subject_key='low'),
  'links_restricted',true,now()+interval '1 hour',false,
  'Links are temporarily restricted.','Link-bearing Messages restricted.',
  null,null,null,'phase8b5-b-links-0001',null
);
reset role;
select set_config(
  'request.jwt.claims',
  (select jsonb_build_object('sub',user_id::text,'role','authenticated')::text
   from phase8b5_b_subjects where subject_key='low'),
  true
);
set local role authenticated;
do $link_denial$
begin
  begin
    perform public.send_message(
      (select conversation_id from phase8b5_b_subjects where subject_key='low'),
      'Please visit https://example.invalid now.','[]'::jsonb,
      'phase8b5-b-link-denied-0001',null,now()
    );
    raise exception 'PHASE_8B5_B_FAIL: link restriction allowed link-bearing Message';
  exception when sqlstate '42501' then null; end;
end
$link_denial$;
reset role;
select set_config(
  'request.jwt.claims',
  (select jsonb_build_object('sub',user_id::text,'role','authenticated')::text
   from phase8b5_b_actors where actor_key='super_admin'),
  true
);
set local role authenticated;
select public.set_messages_safety_enforcement_v1(
  (select case_id from phase8b5_b_subjects where subject_key='low'),
  (select message_id from phase8b5_b_subjects where subject_key='low'),
  'links_restricted',false,null,false,
  'Link restriction released.','Verifier release.',null,null,null,
  'phase8b5-b-links-release-0001',null
);

select public.set_messages_safety_enforcement_v1(
  (select case_id from phase8b5_b_subjects where subject_key='low'),
  (select message_id from phase8b5_b_subjects where subject_key='low'),
  'media_restricted',true,now()+interval '1 hour',false,
  'Media sharing is temporarily restricted.','Canonical Media Resource references restricted.',
  null,null,null,'phase8b5-b-media-ref-0001',null
);
reset role;
select set_config(
  'request.jwt.claims',
  (select jsonb_build_object('sub',user_id::text,'role','authenticated')::text
   from phase8b5_b_subjects where subject_key='low'),
  true
);
set local role authenticated;
do $media_reference_denial$
begin
  begin
    perform public.send_message(
      (select conversation_id from phase8b5_b_subjects where subject_key='low'),
      'This canonical Media Resource reference must fail.',
      jsonb_build_array(jsonb_build_object(
        'resource_id',(select media_resource_id from phase8b5_b_baseline),
        'resource_version_id',null,
        'presentation_kind','resource'
      )),
      'phase8b5-b-media-ref-denied-0001',null,now()
    );
    raise exception 'PHASE_8B5_B_FAIL: media restriction allowed canonical Media Resource reference';
  exception when sqlstate '42501' then null; end;
end
$media_reference_denial$;
reset role;
select set_config(
  'request.jwt.claims',
  (select jsonb_build_object('sub',user_id::text,'role','authenticated')::text
   from phase8b5_b_actors where actor_key='super_admin'),
  true
);
set local role authenticated;
select public.set_messages_safety_enforcement_v1(
  (select case_id from phase8b5_b_subjects where subject_key='low'),
  (select message_id from phase8b5_b_subjects where subject_key='low'),
  'media_restricted',false,null,false,
  'Media restriction released.','Verifier release.',null,null,null,
  'phase8b5-b-media-ref-release-0001',null
);

select public.set_messages_safety_enforcement_v1(
  (select case_id from phase8b5_b_subjects where subject_key='low'),
  (select message_id from phase8b5_b_subjects where subject_key='low'),
  'conversation_start_restricted',true,now()+interval '1 hour',false,
  'New conversations are temporarily restricted.','Conversation start restriction.',
  null,null,null,'phase8b5-b-start-restrict-0001',null
);
reset role;
select set_config(
  'request.jwt.claims',
  (select jsonb_build_object('sub',user_id::text,'role','authenticated')::text
   from phase8b5_b_subjects where subject_key='low'),
  true
);
set local role authenticated;
do $start_denial$
begin
  begin
    perform public.start_message_conversation(
      (select person_resource_id from phase8b5_b_actors where actor_key='recipient'),
      'New Conversation start must be denied.','[]'::jsonb,
      'phase8b5-b-start-denied-0001',null,now()
    );
    raise exception 'PHASE_8B5_B_FAIL: conversation-start restriction allowed generic start';
  exception when sqlstate '42501' then null; end;

  begin
    perform * from public.start_field_submission_message_v1(
      (select field_resource_id from phase8b5_b_field_fixture),
      1,
      'Field Conversation start must be denied.',
      'phase8b5-b-field-start-denied-0001',null,now()
    );
    raise exception 'PHASE_8B5_B_FAIL: conversation-start restriction allowed Field start';
  exception when sqlstate '42501' then null; end;
end
$start_denial$;
reset role;
select set_config(
  'request.jwt.claims',
  (select jsonb_build_object('sub',user_id::text,'role','authenticated')::text
   from phase8b5_b_actors where actor_key='super_admin'),
  true
);
set local role authenticated;
select public.set_messages_safety_enforcement_v1(
  (select case_id from phase8b5_b_subjects where subject_key='low'),
  (select message_id from phase8b5_b_subjects where subject_key='low'),
  'conversation_start_restricted',false,null,false,
  'Conversation start restriction released.','Verifier release.',null,null,null,
  'phase8b5-b-start-release-0001',null
);

-- Severe-category bypass: direct removal with no lower-step history.
with applied as (
  select public.set_messages_safety_enforcement_v1(
    (select case_id from phase8b5_b_subjects where subject_key='severe'),
    (select message_id from phase8b5_b_subjects where subject_key='severe'),
    'messaging_removed',true,null,true,
    'Messages access has been removed.','Reviewed severe direct removal.',
    null,null,null,'phase8b5-b-severe-remove-0001',null
  ) as payload
)
update phase8b5_b_subjects
set primary_enforcement_id=(applied.payload->>'enforcement_id')::uuid
from applied where subject_key='severe';

reset role;
do $severe_bypass_assert$
begin
  if (
    select count(*)
    from messaging.safety_enforcements enforcement
    join phase8b5_b_subjects subject on subject.case_id=enforcement.safety_case_id
    where subject.subject_key='severe'
  )<>1
  or not exists(
    select 1
    from messaging.safety_enforcements enforcement
    join phase8b5_b_subjects subject on subject.primary_enforcement_id=enforcement.id
    where subject.subject_key='severe'
      and enforcement.enforcement_kind='messaging_removed'
      and enforcement.status='active'
  ) then
    raise exception 'PHASE_8B5_B_FAIL: severe direct removal required or created lower-step history';
  end if;
end
$severe_bypass_assert$;

select set_config(
  'request.jwt.claims',
  (select jsonb_build_object('sub',user_id::text,'role','authenticated')::text
   from phase8b5_b_subjects where subject_key='severe'),
  true
);
set local role authenticated;
do $hard_denial_safe_state$
declare
  v_state jsonb;
  v_access jsonb;
begin
  v_state:=public.get_my_message_safety_state_v1();
  v_access:=public.get_my_message_access();

  if coalesce((v_state->>'can_send')::boolean,true)
     or coalesce((v_state->>'can_start')::boolean,true)
     or not coalesce((v_access->>'visible')::boolean,false)
     or position('messaging_removed' in v_state::text)=0 then
    raise exception 'PHASE_8B5_B_FAIL: hard sanction did not preserve safe recovery state';
  end if;

  begin
    perform public.send_message(
      (select conversation_id from phase8b5_b_subjects where subject_key='severe'),
      'Hard sanction must block send.','[]'::jsonb,
      'phase8b5-b-severe-send-denied-0001',null,now()
    );
    raise exception 'PHASE_8B5_B_FAIL: messaging_removed allowed send';
  exception when sqlstate '42501' then null; end;
end
$hard_denial_safe_state$;
reset role;

select set_config(
  'request.jwt.claims',
  (select jsonb_build_object('sub',user_id::text,'role','authenticated')::text
   from phase8b5_b_actors where actor_key='super_admin'),
  true
);
set local role authenticated;
select public.resolve_message_safety_case_v1(
  (select case_id from phase8b5_b_subjects where subject_key='severe'),
  'enforced','Severe Messages enforcement applied.',
  'phase8b5-b-severe-resolve-0001',null
);
select public.set_messages_safety_enforcement_v1(
  (select case_id from phase8b5_b_subjects where subject_key='severe'),
  (select message_id from phase8b5_b_subjects where subject_key='severe'),
  'messaging_removed',false,null,false,
  'Messages access restored.','Governed release after resolution.',
  null,null,null,'phase8b5-b-severe-release-0001',null
);
reset role;

do $historical_enforced_assert$
begin
  if (select current_disposition from messaging.safety_cases
      where id=(select case_id from phase8b5_b_subjects where subject_key='severe'))<>'enforced'
     or (select status from messaging.safety_enforcements
         where id=(select primary_enforcement_id from phase8b5_b_subjects where subject_key='severe'))<>'released' then
    raise exception 'PHASE_8B5_B_FAIL: release rewrote historical enforced case outcome';
  end if;
end
$historical_enforced_assert$;

-- Appeal: exact subject only, submission does not lift, reversal restores.
select set_config(
  'request.jwt.claims',
  (select jsonb_build_object('sub',user_id::text,'role','authenticated')::text
   from phase8b5_b_actors where actor_key='super_admin'),
  true
);
set local role authenticated;
with applied as (
  select public.set_messages_safety_enforcement_v1(
    (select case_id from phase8b5_b_subjects where subject_key='appeal'),
    (select message_id from phase8b5_b_subjects where subject_key='appeal'),
    'messaging_suspended',true,now()+interval '1 hour',true,
    'Messages access is temporarily suspended.','Appealable high-severity suspension.',
    null,null,null,'phase8b5-b-appeal-suspend-0001',null
  ) as payload
)
update phase8b5_b_subjects
set primary_enforcement_id=(applied.payload->>'enforcement_id')::uuid
from applied where subject_key='appeal';
reset role;

-- Another user cannot appeal an arbitrary enforcement ID.
select set_config(
  'request.jwt.claims',
  (select jsonb_build_object('sub',user_id::text,'role','authenticated')::text
   from phase8b5_b_subjects where subject_key='low'),
  true
);
set local role authenticated;
do $arbitrary_appeal_denied$
begin
  begin
    perform public.submit_messages_safety_appeal_v1(
      (select primary_enforcement_id from phase8b5_b_subjects where subject_key='appeal'),
      'I am not this enforcement subject.',
      'phase8b5-b-wrong-appeal-0001',null
    );
    raise exception 'PHASE_8B5_B_FAIL: arbitrary user appealed another subject enforcement';
  exception when sqlstate '42501' then null; end;
end
$arbitrary_appeal_denied$;
reset role;

select set_config(
  'request.jwt.claims',
  (select jsonb_build_object('sub',user_id::text,'role','authenticated')::text
   from phase8b5_b_subjects where subject_key='appeal'),
  true
);
set local role authenticated;
with appealed as (
  select public.submit_messages_safety_appeal_v1(
    (select primary_enforcement_id from phase8b5_b_subjects where subject_key='appeal'),
    'Please review this suspension.',
    'phase8b5-b-appeal-submit-0001',null
  ) as payload
)
update phase8b5_b_subjects
set appeal_id=(appealed.payload->>'appeal_id')::uuid
from appealed where subject_key='appeal';

create temporary table phase8b5_b_appeal_replay as
select public.submit_messages_safety_appeal_v1(
  (select primary_enforcement_id from phase8b5_b_subjects where subject_key='appeal'),
  'Please review this suspension.',
  'phase8b5-b-appeal-submit-0001',null
) as payload;

do $appeal_submission_assert$
declare v_state jsonb;
begin
  v_state:=public.get_my_message_safety_state_v1();
  if coalesce((v_state->>'can_send')::boolean,true) then
    raise exception 'PHASE_8B5_B_FAIL: appeal submission lifted enforcement';
  end if;

  if (select (payload->>'appeal_id')::uuid from phase8b5_b_appeal_replay)
       is distinct from
     (select appeal_id from phase8b5_b_subjects where subject_key='appeal') then
    raise exception 'PHASE_8B5_B_FAIL: appeal idempotent replay changed appeal identity';
  end if;

  begin
    perform public.submit_messages_safety_appeal_v1(
      (select primary_enforcement_id from phase8b5_b_subjects where subject_key='appeal'),
      'A second appeal must not exist.',
      'phase8b5-b-appeal-submit-0002',null
    );
    raise exception 'PHASE_8B5_B_FAIL: one enforcement received two appeals';
  exception when sqlstate '23505' then null; end;
end
$appeal_submission_assert$;
reset role;

select set_config(
  'request.jwt.claims',
  (select jsonb_build_object('sub',user_id::text,'role','authenticated')::text
   from phase8b5_b_actors where actor_key='super_admin'),
  true
);
set local role authenticated;
select public.start_messages_safety_appeal_review_v1(
  (select appeal_id from phase8b5_b_subjects where subject_key='appeal'),
  'phase8b5-b-appeal-review-0001',null
);
select public.resolve_messages_safety_appeal_v1(
  (select appeal_id from phase8b5_b_subjects where subject_key='appeal'),
  'reversed','Messages access restored.','Appeal review reversed the suspension.',
  null,null,null,null,null,null,
  'phase8b5-b-appeal-reverse-0001',null
);
reset role;

select set_config(
  'request.jwt.claims',
  (select jsonb_build_object('sub',user_id::text,'role','authenticated')::text
   from phase8b5_b_subjects where subject_key='appeal'),
  true
);
set local role authenticated;
create temporary table phase8b5_b_reversed_send as
select * from public.send_message(
  (select conversation_id from phase8b5_b_subjects where subject_key='appeal'),
  'Reversal restores canonical sending.','[]'::jsonb,
  'phase8b5-b-reversed-send-0001',null,now()
);
reset role;

do $reversal_assert$
begin
  if (select message_id from phase8b5_b_reversed_send) is null
     or (select status from messaging.safety_enforcements
         where id=(select primary_enforcement_id from phase8b5_b_subjects where subject_key='appeal'))<>'reversed' then
    raise exception 'PHASE_8B5_B_FAIL: reversed appeal did not restore eligibility/history';
  end if;
end
$reversal_assert$;

-- Upheld appeal preserves an independent enforcement.
select set_config(
  'request.jwt.claims',
  (select jsonb_build_object('sub',user_id::text,'role','authenticated')::text
   from phase8b5_b_actors where actor_key='super_admin'),
  true
);
set local role authenticated;
with applied as (
  select public.set_messages_safety_enforcement_v1(
    (select case_id from phase8b5_b_subjects where subject_key='appeal'),
    (select message_id from phase8b5_b_subjects where subject_key='appeal'),
    'links_restricted',true,now()+interval '1 hour',true,
    'Links remain temporarily restricted.','Appealable link restriction.',
    null,null,null,'phase8b5-b-upheld-links-0001',null
  ) as payload
)
update phase8b5_b_subjects
set secondary_enforcement_id=(applied.payload->>'enforcement_id')::uuid
from applied where subject_key='appeal';
reset role;
select set_config(
  'request.jwt.claims',
  (select jsonb_build_object('sub',user_id::text,'role','authenticated')::text
   from phase8b5_b_subjects where subject_key='appeal'),
  true
);
set local role authenticated;
with appealed as (
  select public.submit_messages_safety_appeal_v1(
    (select secondary_enforcement_id from phase8b5_b_subjects where subject_key='appeal'),
    'Please review the link restriction.',
    'phase8b5-b-upheld-submit-0001',null
  ) as payload
)
update phase8b5_b_subjects
set appeal_id=(appealed.payload->>'appeal_id')::uuid
from appealed where subject_key='appeal';
reset role;
select set_config(
  'request.jwt.claims',
  (select jsonb_build_object('sub',user_id::text,'role','authenticated')::text
   from phase8b5_b_actors where actor_key='super_admin'),
  true
);
set local role authenticated;
select public.start_messages_safety_appeal_review_v1(
  (select appeal_id from phase8b5_b_subjects where subject_key='appeal'),
  'phase8b5-b-upheld-review-0001',null
);
select public.resolve_messages_safety_appeal_v1(
  (select appeal_id from phase8b5_b_subjects where subject_key='appeal'),
  'upheld','The restriction remains in place.','Review upheld the restriction.',
  null,null,null,null,null,null,
  'phase8b5-b-upheld-resolve-0001',null
);
reset role;
do $upheld_assert$
begin
  if (select status from messaging.safety_enforcements
      where id=(select secondary_enforcement_id from phase8b5_b_subjects where subject_key='appeal'))<>'active' then
    raise exception 'PHASE_8B5_B_FAIL: upheld appeal changed enforcement state';
  end if;
end
$upheld_assert$;

-- Modified appeal atomically replaces with a narrower action.
select set_config(
  'request.jwt.claims',
  (select jsonb_build_object('sub',user_id::text,'role','authenticated')::text
   from phase8b5_b_actors where actor_key='super_admin'),
  true
);
set local role authenticated;
with applied as (
  select public.set_messages_safety_enforcement_v1(
    (select case_id from phase8b5_b_subjects where subject_key='modified'),
    (select message_id from phase8b5_b_subjects where subject_key='modified'),
    'send_rate_limit',true,now()+interval '2 hours',true,
    'Temporary sending limit.','One Message per hour before appeal modification.',
    null,1,3600,'phase8b5-b-modified-rate-0001',null
  ) as payload
)
update phase8b5_b_subjects
set primary_enforcement_id=(applied.payload->>'enforcement_id')::uuid
from applied where subject_key='modified';
reset role;
select set_config(
  'request.jwt.claims',
  (select jsonb_build_object('sub',user_id::text,'role','authenticated')::text
   from phase8b5_b_subjects where subject_key='modified'),
  true
);
set local role authenticated;
with appealed as (
  select public.submit_messages_safety_appeal_v1(
    (select primary_enforcement_id from phase8b5_b_subjects where subject_key='modified'),
    'Please narrow this sending limit.',
    'phase8b5-b-modified-submit-0001',null
  ) as payload
)
update phase8b5_b_subjects
set appeal_id=(appealed.payload->>'appeal_id')::uuid
from appealed where subject_key='modified';
reset role;
select set_config(
  'request.jwt.claims',
  (select jsonb_build_object('sub',user_id::text,'role','authenticated')::text
   from phase8b5_b_actors where actor_key='super_admin'),
  true
);
set local role authenticated;
select public.start_messages_safety_appeal_review_v1(
  (select appeal_id from phase8b5_b_subjects where subject_key='modified'),
  'phase8b5-b-modified-review-0001',null
);
with resolved as (
  select public.resolve_messages_safety_appeal_v1(
    (select appeal_id from phase8b5_b_subjects where subject_key='modified'),
    'modified','Only a warning remains.','Rate limit narrowed to warning.',
    'warning',now()+interval '1 hour',true,null,null,null,
    'phase8b5-b-modified-resolve-0001',null
  ) as payload
)
update phase8b5_b_subjects
set replacement_enforcement_id=(resolved.payload->>'replacement_enforcement_id')::uuid
from resolved where subject_key='modified';
reset role;

do $modified_assert$
begin
  if (select status from messaging.safety_enforcements
      where id=(select primary_enforcement_id from phase8b5_b_subjects where subject_key='modified'))<>'superseded'
     or (select superseded_by_enforcement_id from messaging.safety_enforcements
         where id=(select primary_enforcement_id from phase8b5_b_subjects where subject_key='modified'))
          is distinct from
        (select replacement_enforcement_id from phase8b5_b_subjects where subject_key='modified')
     or (select enforcement_kind from messaging.safety_enforcements
         where id=(select replacement_enforcement_id from phase8b5_b_subjects where subject_key='modified'))<>'warning'
     or (select status from messaging.safety_enforcements
         where id=(select replacement_enforcement_id from phase8b5_b_subjects where subject_key='modified'))<>'active' then
    raise exception 'PHASE_8B5_B_FAIL: modified appeal did not atomically preserve/narrow enforcement history';
  end if;
end
$modified_assert$;

-- Canonical severe Media fixtures.
with inserted as (
  insert into media.file_objects(
    id,sha256,byte_size,mime_type,original_filename,file_extension,
    storage_provider,storage_namespace,storage_path,delivery_url,
    technical_metadata,verification_state,verified_by,verified_at
  )
  select
    gen_random_uuid(),repeat('a',64),4096,'image/png','candidate-b-a.png','png',
    'lightsail_media','lightsail-media','private-files/phase8b5-b/a.png',
    'https://media.wakilisha.africa/phase8b5-b/a.png','{}'::jsonb,'verified',
    (select user_id from phase8b5_b_actors where actor_key='super_admin'),now()
  returning id,sha256,byte_size,storage_path
)
insert into phase8b5_b_media(file_key,file_id,sha256,byte_size,storage_path)
select 'a',id,sha256,byte_size,storage_path from inserted;

-- Create B with the exact same immutable bytes identity.

with inserted as (
  insert into media.file_objects(
    id,sha256,byte_size,mime_type,original_filename,file_extension,
    storage_provider,storage_namespace,storage_path,delivery_url,
    technical_metadata,verification_state,verified_by,verified_at
  )
  select
    gen_random_uuid(),repeat('a',64),4096,'image/png','candidate-b-b.png','png',
    'lightsail_media','lightsail-media','private-files/phase8b5-b/b.png',
    'https://media.wakilisha.africa/phase8b5-b/b.png','{}'::jsonb,'verified',
    (select user_id from phase8b5_b_actors where actor_key='super_admin'),now()
  returning id,sha256,byte_size,storage_path
)
insert into phase8b5_b_media(file_key,file_id,sha256,byte_size,storage_path)
select 'b',id,sha256,byte_size,storage_path from inserted;

insert into messaging.safety_case_targets(safety_case_id,media_file_object_id,linked_at)
select case_id,(select file_id from phase8b5_b_media where file_key='a'),now()
from phase8b5_b_subjects where subject_key='media';

-- Minimal Media processing receipts/jobs created before containment.
do $processing_fixture$
declare
  v_resource uuid;
  v_actor uuid;
  v_source uuid;
  v_receipt uuid;
  v_job uuid;
  v_key text;
begin
  select media_resource_id into v_resource from phase8b5_b_baseline;
  select user_id into v_actor from phase8b5_b_actors where actor_key='super_admin';
  select file_id into v_source from phase8b5_b_media where file_key='a';

  foreach v_key in array array['queued','running_fail','running_complete','expired_recover'] loop
    insert into platform_private.command_receipts(
      command_type,resource_id,principal_key,actor_user_id,idempotency_key,
      request_fingerprint,request_payload,status
    ) values(
      'media.process_revision',v_resource,'user:'||v_actor::text,v_actor,
      'phase8b5-b-job-'||v_key,
      md5('phase8b5-b-job-'||v_key)||md5(v_key),
      jsonb_build_object('source_file_object_id',v_source),
      'accepted'
    ) returning id into v_receipt;

    if v_key='queued' then
      insert into platform_private.jobs(
        command_receipt_id,resource_id,command_type,job_key,job_type,
        status,max_attempts,input_payload
      ) values(
        v_receipt,v_resource,'media.process_revision','primary','media.process_revision',
        'queued',4,jsonb_build_object('source_file_object_id',v_source)
      ) returning id into v_job;
    elsif v_key='expired_recover' then
      insert into platform_private.jobs(
        command_receipt_id,resource_id,command_type,job_key,job_type,
        status,attempt_count,max_attempts,locked_by,locked_at,lease_expires_at,
        started_at,input_payload
      ) values(
        v_receipt,v_resource,'media.process_revision','primary','media.process_revision',
        'running',1,4,'phase8b5-worker',now()-interval '2 minutes',now()-interval '1 minute',
        now()-interval '2 minutes',jsonb_build_object('source_file_object_id',v_source)
      ) returning id into v_job;
    else
      insert into platform_private.jobs(
        command_receipt_id,resource_id,command_type,job_key,job_type,
        status,attempt_count,max_attempts,locked_by,locked_at,lease_expires_at,
        started_at,input_payload
      ) values(
        v_receipt,v_resource,'media.process_revision','primary','media.process_revision',
        'running',1,4,'phase8b5-worker',now(),now()+interval '30 minutes',
        now(),jsonb_build_object('source_file_object_id',v_source)
      ) returning id into v_job;
    end if;

    insert into phase8b5_b_jobs(job_key,receipt_id,job_id)
    values(v_key,v_receipt,v_job);
  end loop;
end
$processing_fixture$;

-- Apply severe exact-file containment as the Super Admin.
select set_config(
  'request.jwt.claims',
  (select jsonb_build_object('sub',user_id::text,'role','authenticated')::text
   from phase8b5_b_actors where actor_key='super_admin'),
  true
);
set local role authenticated;
create temporary table phase8b5_b_containment_result as
select public.set_messages_safety_media_containment_v1(
  (select case_id from phase8b5_b_subjects where subject_key='media'),
  (select file_id from phase8b5_b_media where file_key='a'),
  true,'Contain exact severe Media bytes.','phase8b5-b-contain-0001',null
) as payload;
reset role;

do $containment_assert$
begin
  if (select (payload->>'matched_file_count')::integer from phase8b5_b_containment_result)<>2
     or (
       select count(*)
       from messaging.safety_media_containment containment
       where containment.status='active'
         and containment.media_file_object_id in (
           select file_id from phase8b5_b_media where file_key in ('a','b')
         )
     )<>2
     or not exists(
       select 1
       from messaging.safety_case_targets target
       where target.safety_case_id=(select case_id from phase8b5_b_subjects where subject_key='media')
         and target.media_file_object_id=(select file_id from phase8b5_b_media where file_key='b')
     ) then
    raise exception 'PHASE_8B5_B_FAIL: exact verified hash/size containment expansion failed';
  end if;

  if (select status from platform_private.jobs
      where id=(select job_id from phase8b5_b_jobs where job_key='queued'))<>'cancelled'
     or (select error_code from platform_private.command_receipts
         where id=(select receipt_id from phase8b5_b_jobs where job_key='queued'))<>'safety_contained' then
    raise exception 'PHASE_8B5_B_FAIL: queued normal Media work was not cancelled through existing job/receipt state';
  end if;

  if (select status from platform_private.jobs
      where id=(select job_id from phase8b5_b_jobs where job_key='running_fail'))<>'running'
     or (select status from platform_private.jobs
         where id=(select job_id from phase8b5_b_jobs where job_key='running_complete'))<>'running' then
    raise exception 'PHASE_8B5_B_FAIL: containment stole an active normal Media worker lease';
  end if;
end
$containment_assert$;

-- Future exact-hash canonical file fails closed without a copied Safety hash.
with inserted as (
  insert into media.file_objects(
    id,sha256,byte_size,mime_type,original_filename,file_extension,
    storage_provider,storage_namespace,storage_path,delivery_url,
    technical_metadata,verification_state,verified_by,verified_at
  )
  select
    gen_random_uuid(),repeat('a',64),4096,'image/png','candidate-b-future.png','png',
    'lightsail_media','lightsail-media','private-files/phase8b5-b/future.png',
    'https://media.wakilisha.africa/phase8b5-b/future.png','{}'::jsonb,'verified',
    (select user_id from phase8b5_b_actors where actor_key='super_admin'),now()
  returning id,sha256,byte_size,storage_path
)
insert into phase8b5_b_media(file_key,file_id,sha256,byte_size,storage_path)
select 'future',id,sha256,byte_size,storage_path from inserted;

do $future_match_assert$
begin
  if not messaging.media_file_is_safety_contained(
    (select file_id from phase8b5_b_media where file_key='future')
  ) then
    raise exception 'PHASE_8B5_B_FAIL: future exact-hash canonical file escaped active containment';
  end if;
end
$future_match_assert$;

-- Job creation/output completion/fail/recovery remain fail-closed while contained.
do $contained_job_insert_denied$
declare
  v_resource uuid;
  v_actor uuid;
  v_source uuid;
  v_receipt uuid;
begin
  select media_resource_id into v_resource from phase8b5_b_baseline;
  select user_id into v_actor from phase8b5_b_actors where actor_key='super_admin';
  select file_id into v_source from phase8b5_b_media where file_key='a';

  begin
    insert into platform_private.command_receipts(
      command_type,resource_id,principal_key,actor_user_id,idempotency_key,
      request_fingerprint,request_payload,status
    ) values(
      'media.process_revision',v_resource,'user:'||v_actor::text,v_actor,
      'phase8b5-b-job-contained-new',
      repeat('c',64),jsonb_build_object('source_file_object_id',v_source),'accepted'
    ) returning id into v_receipt;

    insert into platform_private.jobs(
      command_receipt_id,resource_id,command_type,job_key,job_type,status,max_attempts,input_payload
    ) values(
      v_receipt,v_resource,'media.process_revision','primary','media.process_revision',
      'queued',4,jsonb_build_object('source_file_object_id',v_source)
    );

    raise exception 'PHASE_8B5_B_FAIL: contained source created a new normal Media job';
  exception when sqlstate '55000' then null; end;
end
$contained_job_insert_denied$;

select set_config('request.jwt.claims','{"role":"service_role"}',true);
set local role service_role;

create temporary table phase8b5_b_fail_result as
select public.fail_media_processing_job_v1(
  (select job_id from phase8b5_b_jobs where job_key='running_fail'),
  'phase8b5-worker','Worker observed containment.',true,60
) as payload;

do $contained_complete_denied$
begin
  begin
    perform public.complete_media_processing_job_v1(
      (select job_id from phase8b5_b_jobs where job_key='running_complete'),
      'phase8b5-worker','{}'::jsonb
    );
    raise exception 'PHASE_8B5_B_FAIL: contained source completed normal Media processing';
  exception when sqlstate '55000' then null; end;
end
$contained_complete_denied$;

create temporary table phase8b5_b_recover_result as
select public.recover_expired_media_processing_jobs_v1(10,30) as recovered;

reset role;

do $processing_terminal_assert$
begin
  if (select payload->>'job_status' from phase8b5_b_fail_result)<>'cancelled'
     or (select status from platform_private.jobs
         where id=(select job_id from phase8b5_b_jobs where job_key='running_fail'))<>'cancelled'
     or (select status from platform_private.jobs
         where id=(select job_id from phase8b5_b_jobs where job_key='expired_recover'))<>'cancelled'
     or (select recovered from phase8b5_b_recover_result)<1 then
    raise exception 'PHASE_8B5_B_FAIL: contained running/expired normal Media work returned to retry or succeeded';
  end if;
end
$processing_terminal_assert$;

-- Scoped Safety scan: existing job substrate, exact lease, sanitized signal only.
select set_config(
  'request.jwt.claims',
  (select jsonb_build_object('sub',user_id::text,'role','authenticated')::text
   from phase8b5_b_actors where actor_key='super_admin'),
  true
);
set local role authenticated;
create temporary table phase8b5_b_scan_submit as
select public.submit_messages_safety_media_scan_v1(
  (select case_id from phase8b5_b_subjects where subject_key='media'),
  (select file_id from phase8b5_b_media where file_key='a'),
  'phase8b5-b-scan-submit-0001',null
) as payload;
reset role;

select set_config('request.jwt.claims','{"role":"service_role"}',true);
set local role service_role;
create temporary table phase8b5_b_scan_claim as
select * from public.claim_messages_safety_media_scan_jobs_v1(
  'phase8b5-scan-worker',1,900
);
create temporary table phase8b5_b_scan_target as
select public.get_messages_safety_media_scan_target_v1(
  (select job_id from phase8b5_b_scan_claim),
  'phase8b5-scan-worker'
) as payload;
create temporary table phase8b5_b_scan_complete as
select public.complete_messages_safety_media_scan_job_v1(
  (select job_id from phase8b5_b_scan_claim),
  'phase8b5-scan-worker',
  jsonb_build_object(
    'provider_key','candidate_b_fixture',
    'provider_version','1.0',
    'classification_label','review_signal',
    'confidence',0.91,
    'provider_reference','fixture-001',
    'scanned_at',now()
  )
) as payload;
reset role;

do $scan_assert$
declare
  v_case uuid;
  v_file uuid;
begin
  select case_id into v_case from phase8b5_b_subjects where subject_key='media';
  select file_id into v_file from phase8b5_b_media where file_key='a';

  if (select safety_case_id from phase8b5_b_scan_claim) is distinct from v_case
     or (select media_file_object_id from phase8b5_b_scan_claim) is distinct from v_file
     or not exists(
       select 1
       from platform_private.jobs job
       where job.id=(select job_id from phase8b5_b_scan_claim)
         and job.command_type='messages.safety.media.scan'
         and job.job_type='messages.safety.media.scan'
     )
     or (select payload->>'media_file_object_id' from phase8b5_b_scan_target)<>v_file::text
     or (select payload->>'job_status' from phase8b5_b_scan_complete)<>'succeeded'
     or (
       select count(*)
       from messaging.safety_case_events event
       where event.safety_case_id=v_case
         and event.event_kind='signal_added'
         and event.metadata->>'provider_key'='candidate_b_fixture'
     )<>1 then
    raise exception 'PHASE_8B5_B_FAIL: scoped Safety scan lease/target/completion contract failed';
  end if;

  if exists(
    select 1
    from messaging.safety_case_events event
    where event.safety_case_id=v_case
      and event.event_kind='signal_added'
      and (
        event.metadata ? 'sha256'
        or event.metadata ? 'storage_path'
        or event.metadata ? 'raw_payload'
        or event.metadata ? 'access_token'
      )
  ) then
    raise exception 'PHASE_8B5_B_FAIL: scan signal persisted forbidden Media/provider data';
  end if;

  if exists(
    select 1 from messaging.safety_enforcements enforcement
    where enforcement.safety_case_id=v_case
  ) then
    raise exception 'PHASE_8B5_B_FAIL: provider signal created automatic human enforcement';
  end if;
end
$scan_assert$;

-- Release exact containment; future exact match becomes Safety-eligible again.
select set_config(
  'request.jwt.claims',
  (select jsonb_build_object('sub',user_id::text,'role','authenticated')::text
   from phase8b5_b_actors where actor_key='super_admin'),
  true
);
set local role authenticated;
select public.set_messages_safety_media_containment_v1(
  (select case_id from phase8b5_b_subjects where subject_key='media'),
  (select file_id from phase8b5_b_media where file_key='a'),
  false,'Release exact Media containment after review.','phase8b5-b-contain-release-0001',null
);
reset role;

do $release_media_assert$
begin
  if messaging.media_file_is_safety_contained(
       (select file_id from phase8b5_b_media where file_key='future')
     )
     or exists(
       select 1
       from messaging.safety_media_containment containment
       where containment.safety_case_id=(select case_id from phase8b5_b_subjects where subject_key='media')
         and containment.status='active'
     ) then
    raise exception 'PHASE_8B5_B_FAIL: releasing last exact-match containment did not restore Safety eligibility';
  end if;

  if (select sha256 from media.file_objects
      where id=(select file_id from phase8b5_b_media where file_key='a'))<>repeat('a',64)
     or (select byte_size from media.file_objects
         where id=(select file_id from phase8b5_b_media where file_key='a'))<>4096
     or (select storage_path from media.file_objects
         where id=(select file_id from phase8b5_b_media where file_key='a'))<>'private-files/phase8b5-b/a.png' then
    raise exception 'PHASE_8B5_B_FAIL: Safety containment rewrote canonical Media identity';
  end if;
end
$release_media_assert$;

-- Community and canonical Message history remain peer authorities.
do $isolation_assert$
begin
  if exists(
    select 1
    from messaging.messages message_row
    join phase8b5_b_subjects subject on subject.message_id=message_row.id
    where message_row.body is distinct from 'Candidate B baseline '||subject.subject_key||' Message'
  ) then
    raise exception 'PHASE_8B5_B_FAIL: Candidate B rewrote canonical baseline Message history';
  end if;

  if (select count(*) from public.community_reports)
       <>(select community_report_count from phase8b5_b_baseline)
     or (select count(*) from public.community_blocks)
       <>(select community_block_count from phase8b5_b_baseline) then
    raise exception 'PHASE_8B5_B_FAIL: Candidate B mutated Community moderation storage';
  end if;
end
$isolation_assert$;

select jsonb_build_object(
  'verification','PASS',
  'migration_count',(select count(*) from supabase_migrations.schema_migrations),
  'migration_head',(select max(version) from supabase_migrations.schema_migrations),
  'candidate_b_tables',3,
  'candidate_b_commands',7,
  'subjects',(select count(*) from phase8b5_b_subjects),
  'active_media_containment',(
    select count(*) from messaging.safety_media_containment containment
    where containment.safety_case_id=(select case_id from phase8b5_b_subjects where subject_key='media')
      and containment.status='active'
  ),
  'provider_signal_events',(
    select count(*) from messaging.safety_case_events event
    where event.safety_case_id=(select case_id from phase8b5_b_subjects where subject_key='media')
      and event.event_kind='signal_added'
      and event.metadata->>'provider_key'='candidate_b_fixture'
  )
) as phase_8b5_candidate_b_enforcement_recovery_severe_media_verification;

rollback;
