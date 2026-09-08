-- Permanent rollback-only verifier for Phase 8B.5 Candidate A.
-- Proves Safety Case identity, exact Message targeting, participant reporting,
-- Super Admin isolation, deliberate evidence inspection, quarantine projection,
-- canonical Message preservation, release recovery, and Community isolation.

begin;
set constraints all deferred;

do $structural$
declare
  v_migration_count bigint;
  v_head text;
  v_table_count bigint;
  v_rls_count bigint;
  v_command_count bigint;
  v_anon_exec bigint;
  v_list_definition text;
  v_detail_definition text;
  v_unread_definition text;
  v_read_definition text;
  v_inspect_definition text;
begin
  select count(*),max(version)
  into v_migration_count,v_head
  from supabase_migrations.schema_migrations;

  if v_migration_count<>110
     or v_head<>'20260907203000' then
    raise exception
      'PHASE_8B5_A_FAIL: expected 110 migrations at Candidate A head 20260907203000, got count=% head=%',
      v_migration_count,
      v_head;
  end if;

  if not exists(
    select 1
    from supabase_migrations.schema_migrations
    where version='20260907203000'
      and name='phase_8b5_candidate_a_safety_case_quarantine'
  ) then
    raise exception 'PHASE_8B5_A_FAIL: Candidate A migration history is missing';
  end if;

  select count(*) into v_table_count
  from information_schema.tables
  where table_schema='messaging'
    and table_name in (
      'safety_cases',
      'safety_case_targets',
      'safety_case_events',
      'message_quarantine'
    );

  if v_table_count<>4 then
    raise exception 'PHASE_8B5_A_FAIL: expected four Safety tables, got %',v_table_count;
  end if;

  select count(*) into v_rls_count
  from pg_class relation
  join pg_namespace namespace
    on namespace.oid=relation.relnamespace
  where namespace.nspname='messaging'
    and relation.relname in (
      'safety_cases',
      'safety_case_targets',
      'safety_case_events',
      'message_quarantine'
    )
    and relation.relrowsecurity;

  if v_rls_count<>4 then
    raise exception 'PHASE_8B5_A_FAIL: Safety RLS coverage is incomplete';
  end if;

  if exists(
    select 1
    from information_schema.role_table_grants grant_row
    where grant_row.table_schema='messaging'
      and grant_row.table_name in (
        'safety_cases',
        'safety_case_targets',
        'safety_case_events',
        'message_quarantine'
      )
      and grant_row.grantee in ('anon','authenticated','service_role')
  ) then
    raise exception 'PHASE_8B5_A_FAIL: browser/runtime roles have direct Safety table grants';
  end if;

  select count(*) into v_command_count
  from platform_private.command_types
  where enabled
    and command_type in (
      'messages.safety.report',
      'messages.safety.review.start',
      'messages.safety.quarantine.update',
      'messages.safety.resolve',
      'messages.safety.evidence.inspect'
    );

  if v_command_count<>5 then
    raise exception 'PHASE_8B5_A_FAIL: Safety command vocabulary is incomplete';
  end if;

  if to_regprocedure('public.report_message_safety_v1(uuid,text,text,text,uuid)') is null
     or to_regprocedure('public.list_messages_safety_cases_v1(text,timestamptz,uuid,integer)') is null
     or to_regprocedure('public.get_messages_safety_case_v1(uuid)') is null
     or to_regprocedure('public.start_messages_safety_review_v1(uuid,text,uuid)') is null
     or to_regprocedure('public.set_message_quarantine_v1(uuid,uuid,boolean,text,text,uuid)') is null
     or to_regprocedure('public.resolve_message_safety_case_v1(uuid,text,text,text,uuid)') is null
     or to_regprocedure('public.inspect_message_safety_evidence_v1(uuid,uuid,text,text,uuid)') is null then
    raise exception 'PHASE_8B5_A_FAIL: Safety RPC family is incomplete';
  end if;

  select count(*) into v_anon_exec
  from pg_proc procedure
  join pg_namespace namespace
    on namespace.oid=procedure.pronamespace
  where namespace.nspname='public'
    and procedure.proname in (
      'report_message_safety_v1',
      'list_messages_safety_cases_v1',
      'get_messages_safety_case_v1',
      'start_messages_safety_review_v1',
      'set_message_quarantine_v1',
      'resolve_message_safety_case_v1',
      'inspect_message_safety_evidence_v1'
    )
    and has_function_privilege('anon',procedure.oid,'EXECUTE');

  if v_anon_exec<>0 then
    raise exception 'PHASE_8B5_A_FAIL: anon can execute a Safety RPC';
  end if;

  v_list_definition:=pg_get_functiondef(
    'public.list_my_message_conversations(text,timestamptz,uuid,integer)'::regprocedure
  );
  v_detail_definition:=pg_get_functiondef(
    'public.get_my_message_conversation(uuid,timestamptz,uuid,integer)'::regprocedure
  );
  v_unread_definition:=pg_get_functiondef(
    'public.get_my_message_unread_counts()'::regprocedure
  );
  v_read_definition:=pg_get_functiondef(
    'public.mark_my_message_conversation_read(uuid,uuid)'::regprocedure
  );
  v_inspect_definition:=pg_get_functiondef(
    'public.inspect_message_safety_evidence_v1(uuid,uuid,text,text,uuid)'::regprocedure
  );

  if position('message_quarantine' in v_list_definition)=0
     or position('message_quarantine' in v_detail_definition)=0
     or position('message_quarantine' in v_unread_definition)=0
     or position('message_quarantine' in v_read_definition)=0 then
    raise exception 'PHASE_8B5_A_FAIL: ordinary Messages projection is not quarantine-aware';
  end if;

  if position('safety_case_targets' in v_inspect_definition)=0
     or position('evidence_viewed' in v_inspect_definition)=0
     or position('message_row.body' in lower(v_inspect_definition))=0 then
    raise exception 'PHASE_8B5_A_FAIL: evidence inspection is missing exact-target/log/body authority';
  end if;

  if exists(
    select 1
    from information_schema.columns
    where table_schema='messaging'
      and table_name in (
        'safety_cases',
        'safety_case_targets',
        'safety_case_events',
        'message_quarantine'
      )
      and column_name in (
        'body',
        'sha256',
        'storage_key',
        'bucket_name',
        'object_path'
      )
  ) then
    raise exception 'PHASE_8B5_A_FAIL: Safety storage duplicates Message/Media content authority';
  end if;
end
$structural$;

do $fixture$
declare
  v_sender uuid:=gen_random_uuid();
  v_recipient uuid:=gen_random_uuid();
  v_super_admin uuid:=gen_random_uuid();
  v_ordinary_admin uuid:=gen_random_uuid();
begin
  create temporary table phase8b5_a_fixture(
    sender_user_id uuid,
    recipient_user_id uuid,
    super_admin_user_id uuid,
    ordinary_admin_user_id uuid,
    sender_person_id uuid,
    recipient_person_id uuid,
    super_admin_person_id uuid,
    ordinary_admin_person_id uuid,
    conversation_id uuid,
    sender_participant_id uuid,
    recipient_participant_id uuid,
    message_id uuid,
    safety_case_id uuid,
    evidence_event_id uuid,
    community_report_count_before bigint,
    community_block_count_before bigint
  ) on commit drop;

  insert into phase8b5_a_fixture(
    sender_user_id,
    recipient_user_id,
    super_admin_user_id,
    ordinary_admin_user_id,
    community_report_count_before,
    community_block_count_before
  )
  values(
    v_sender,
    v_recipient,
    v_super_admin,
    v_ordinary_admin,
    (select count(*) from public.community_reports),
    (select count(*) from public.community_blocks)
  );

  insert into auth.users(
    id,aud,role,email,raw_app_meta_data,raw_user_meta_data,
    created_at,updated_at,is_sso_user,is_anonymous
  )
  values
  (
    v_sender,'authenticated','authenticated',
    'phase8b5-a-sender@example.invalid',
    jsonb_build_object('provider','email','providers',jsonb_build_array('email')),
    jsonb_build_object('name','Phase 8B5 Safety Sender'),
    now(),now(),false,false
  ),
  (
    v_recipient,'authenticated','authenticated',
    'phase8b5-a-recipient@example.invalid',
    jsonb_build_object('provider','email','providers',jsonb_build_array('email')),
    jsonb_build_object('name','Phase 8B5 Safety Recipient'),
    now(),now(),false,false
  ),
  (
    v_super_admin,'authenticated','authenticated',
    'phase8b5-a-super@example.invalid',
    jsonb_build_object('provider','email','providers',jsonb_build_array('email')),
    jsonb_build_object('name','Phase 8B5 Safety Super Admin'),
    now(),now(),false,false
  ),
  (
    v_ordinary_admin,'authenticated','authenticated',
    'phase8b5-a-admin@example.invalid',
    jsonb_build_object('provider','email','providers',jsonb_build_array('email')),
    jsonb_build_object('name','Phase 8B5 Safety Administrator'),
    now(),now(),false,false
  );
end
$fixture$;

set constraints all immediate;
set constraints all deferred;

update phase8b5_a_fixture fixture
set sender_person_id=link.person_resource_id
from editorial.person_identity_links link
where link.user_id=fixture.sender_user_id
  and link.link_state='active';

update phase8b5_a_fixture fixture
set recipient_person_id=link.person_resource_id
from editorial.person_identity_links link
where link.user_id=fixture.recipient_user_id
  and link.link_state='active';

update phase8b5_a_fixture fixture
set super_admin_person_id=link.person_resource_id
from editorial.person_identity_links link
where link.user_id=fixture.super_admin_user_id
  and link.link_state='active';

update phase8b5_a_fixture fixture
set ordinary_admin_person_id=link.person_resource_id
from editorial.person_identity_links link
where link.user_id=fixture.ordinary_admin_user_id
  and link.link_state='active';

do $identity_assert$
begin
  if exists(
    select 1
    from phase8b5_a_fixture
    where sender_person_id is null
       or recipient_person_id is null
       or super_admin_person_id is null
       or ordinary_admin_person_id is null
  ) then
    raise exception 'PHASE_8B5_A_FAIL: canonical Person fixture provisioning failed';
  end if;
end
$identity_assert$;

insert into public.user_role_assignments(
  user_id,role_key,status,assigned_by,assigned_at,notes,created_at,updated_at
)
select super_admin_user_id,'super_admin','active',null::uuid,now(),'Phase 8B.5 Candidate A rollback verifier',now(),now()
from phase8b5_a_fixture
union all
select ordinary_admin_user_id,'administrator','active',null::uuid,now(),'Phase 8B.5 Candidate A rollback verifier',now(),now()
from phase8b5_a_fixture
union all
select sender_user_id,'subscriber','active',null::uuid,now(),'Phase 8B.5 Candidate A rollback verifier',now(),now()
from phase8b5_a_fixture
union all
select recipient_user_id,'subscriber','active',null::uuid,now(),'Phase 8B.5 Candidate A rollback verifier',now(),now()
from phase8b5_a_fixture;

with conversation as (
  insert into messaging.conversations(
    security_classification,status,created_at,last_activity_at,correlation_id
  )
  values('standard','active',now(),now(),gen_random_uuid())
  returning id
)
update phase8b5_a_fixture fixture
set conversation_id=conversation.id
from conversation;

with sender_participant as (
  insert into messaging.conversation_participants(
    conversation_id,actor_kind,person_resource_id,user_id,
    membership_status,mailbox_folder,first_contact_state
  )
  select
    conversation_id,'human',sender_person_id,sender_user_id,
    'active','inbox','accepted'
  from phase8b5_a_fixture
  returning id
)
update phase8b5_a_fixture fixture
set sender_participant_id=sender_participant.id
from sender_participant;

with recipient_participant as (
  insert into messaging.conversation_participants(
    conversation_id,actor_kind,person_resource_id,user_id,
    membership_status,mailbox_folder,first_contact_state
  )
  select
    conversation_id,'human',recipient_person_id,recipient_user_id,
    'active','inbox','accepted'
  from phase8b5_a_fixture
  returning id
)
update phase8b5_a_fixture fixture
set recipient_participant_id=recipient_participant.id
from recipient_participant;

update messaging.conversations conversation
set created_by_participant_id=fixture.sender_participant_id
from phase8b5_a_fixture fixture
where conversation.id=fixture.conversation_id;

with message as (
  insert into messaging.messages(
    conversation_id,sender_participant_id,message_kind,body,
    accepted_at,client_created_at,correlation_id
  )
  select
    conversation_id,sender_participant_id,'text',
    'Candidate A exact evidence body 7f2d2f3a',
    now(),now(),gen_random_uuid()
  from phase8b5_a_fixture
  returning id
)
update phase8b5_a_fixture fixture
set message_id=message.id
from message;

insert into messaging.message_receipts(
  message_id,participant_id,conversation_id,delivery_state,delivered_at
)
select
  message_id,recipient_participant_id,conversation_id,'delivered',now()
from phase8b5_a_fixture;

update messaging.conversations conversation
set last_activity_at=now()
from phase8b5_a_fixture fixture
where conversation.id=fixture.conversation_id;

grant select,update on phase8b5_a_fixture to authenticated;

select set_config(
  'request.jwt.claims',
  (
    select jsonb_build_object(
      'sub',recipient_user_id::text,
      'role','authenticated'
    )::text
    from phase8b5_a_fixture
  ),
  true
);
set local role authenticated;

with report as (
  select public.report_message_safety_v1(
    (select message_id from phase8b5_a_fixture),
    'harassment',
    'Please review this Message.',
    'phase8b5-a-report-0001',
    null
  ) as payload
)
update phase8b5_a_fixture fixture
set safety_case_id=(report.payload->>'safety_case_id')::uuid
from report;

create temporary table phase8b5_a_report_replay as
select public.report_message_safety_v1(
  (select message_id from phase8b5_a_fixture),
  'harassment',
  'Please review this Message.',
  'phase8b5-a-report-0001',
  null
) as payload;

do $participant_assert$
declare
  v_case uuid;
  v_message uuid;
begin
  select safety_case_id,message_id
  into v_case,v_message
  from phase8b5_a_fixture;

  if v_case is null
     or (select count(*) from messaging.safety_cases where id=v_case)<>1
     or (select count(*) from messaging.safety_case_targets where safety_case_id=v_case and message_id=v_message)<>1
     or (select count(*) from messaging.safety_case_events where safety_case_id=v_case and event_kind='opened')<>1 then
    raise exception 'PHASE_8B5_A_FAIL: participant report did not create one exact Safety Case target/event';
  end if;

  if (select (payload->>'safety_case_id')::uuid from phase8b5_a_report_replay)<>v_case
     or (select count(*) from messaging.safety_case_events where safety_case_id=v_case and event_kind='opened')<>1 then
    raise exception 'PHASE_8B5_A_FAIL: participant report replay duplicated Safety authority';
  end if;

  if (select count(*) from public.community_reports)<>(select community_report_count_before from phase8b5_a_fixture)
     or (select count(*) from public.community_blocks)<>(select community_block_count_before from phase8b5_a_fixture) then
    raise exception 'PHASE_8B5_A_FAIL: private Message report mutated Community moderation storage';
  end if;

  begin
    perform public.list_messages_safety_cases_v1(null,null,null,50);
    raise exception 'PHASE_8B5_A_FAIL: ordinary participant read the Super Admin Safety queue';
  exception when sqlstate '42501' then null; end;
end
$participant_assert$;

reset role;

select set_config(
  'request.jwt.claims',
  (
    select jsonb_build_object(
      'sub',ordinary_admin_user_id::text,
      'role','authenticated'
    )::text
    from phase8b5_a_fixture
  ),
  true
);
set local role authenticated;

do $ordinary_admin_denial$
begin
  begin
    perform public.get_messages_safety_case_v1(
      (select safety_case_id from phase8b5_a_fixture)
    );
    raise exception 'PHASE_8B5_A_FAIL: ordinary Administrator read Safety Case detail';
  exception when sqlstate '42501' then null; end;
end
$ordinary_admin_denial$;

reset role;

select set_config(
  'request.jwt.claims',
  (
    select jsonb_build_object(
      'sub',super_admin_user_id::text,
      'role','authenticated'
    )::text
    from phase8b5_a_fixture
  ),
  true
);
set local role authenticated;

create temporary table phase8b5_a_queue as
select public.list_messages_safety_cases_v1(null,null,null,50) as payload;

create temporary table phase8b5_a_safe_detail as
select public.get_messages_safety_case_v1(
  (select safety_case_id from phase8b5_a_fixture)
) as payload;

do $safe_projection_assert$
begin
  if position(
    'Candidate A exact evidence body 7f2d2f3a'
    in (select payload::text from phase8b5_a_queue)
  )>0
     or position(
       'Candidate A exact evidence body 7f2d2f3a'
       in (select payload::text from phase8b5_a_safe_detail)
     )>0 then
    raise exception 'PHASE_8B5_A_FAIL: Safety queue/detail leaked Message body before inspection';
  end if;
end
$safe_projection_assert$;

select public.start_messages_safety_review_v1(
  (select safety_case_id from phase8b5_a_fixture),
  'phase8b5-a-review-0001',
  null
);

with evidence as (
  select public.inspect_message_safety_evidence_v1(
    (select safety_case_id from phase8b5_a_fixture),
    (select message_id from phase8b5_a_fixture),
    'Review reported Message evidence.',
    'phase8b5-a-evidence-0001',
    null
  ) as payload
)
update phase8b5_a_fixture fixture
set evidence_event_id=(evidence.payload->>'evidence_event_id')::uuid
from evidence;

create temporary table phase8b5_a_evidence_replay as
select public.inspect_message_safety_evidence_v1(
  (select safety_case_id from phase8b5_a_fixture),
  (select message_id from phase8b5_a_fixture),
  'Review reported Message evidence.',
  'phase8b5-a-evidence-0001',
  null
) as payload;

do $evidence_assert$
declare
  v_case uuid;
  v_message uuid;
begin
  select safety_case_id,message_id into v_case,v_message
  from phase8b5_a_fixture;

  if (select payload->>'body' from phase8b5_a_evidence_replay)<>'Candidate A exact evidence body 7f2d2f3a'
     or (select count(*) from messaging.safety_case_events where safety_case_id=v_case and event_kind='evidence_viewed')<>1
     or (select evidence_event_id from phase8b5_a_fixture) is null then
    raise exception 'PHASE_8B5_A_FAIL: deliberate evidence inspection/replay authority failed';
  end if;

  if exists(
    select 1
    from platform_private.command_receipts receipt
    where receipt.command_type='messages.safety.evidence.inspect'
      and (
        position('Candidate A exact evidence body 7f2d2f3a' in coalesce(receipt.result_payload::text,''))>0
      )
  ) then
    raise exception 'PHASE_8B5_A_FAIL: command receipt duplicated inspected Message body';
  end if;
end
$evidence_assert$;

select public.set_message_quarantine_v1(
  (select safety_case_id from phase8b5_a_fixture),
  (select message_id from phase8b5_a_fixture),
  true,
  'Contain while this case is reviewed.',
  'phase8b5-a-quarantine-0001',
  null
);

reset role;

select set_config(
  'request.jwt.claims',
  (
    select jsonb_build_object(
      'sub',recipient_user_id::text,
      'role','authenticated'
    )::text
    from phase8b5_a_fixture
  ),
  true
);
set local role authenticated;

create temporary table phase8b5_a_quarantined_detail as
select public.get_my_message_conversation(
  (select conversation_id from phase8b5_a_fixture),
  null,null,50
) as payload;

create temporary table phase8b5_a_quarantined_unread as
select public.get_my_message_unread_counts() as payload;

create temporary table phase8b5_a_quarantined_read as
select public.mark_my_message_conversation_read(
  (select conversation_id from phase8b5_a_fixture),
  null
) as payload;

do $quarantine_projection_assert$
begin
  if position(
    (select message_id::text from phase8b5_a_fixture)
    in (select payload->'messages' from phase8b5_a_quarantined_detail)::text
  )>0
     or position(
       'Candidate A exact evidence body 7f2d2f3a'
       in (select payload->'messages' from phase8b5_a_quarantined_detail)::text
     )>0 then
    raise exception 'PHASE_8B5_A_FAIL: quarantined Message remained in ordinary detail projection';
  end if;

  if coalesce(
       ((select payload from phase8b5_a_quarantined_unread)->>'inbox')::bigint,
       0
     )<>0 then
    raise exception 'PHASE_8B5_A_FAIL: quarantined Message remained in unread projection';
  end if;

  if ((select payload from phase8b5_a_quarantined_read)->>'marked_read')::bigint<>0 then
    raise exception 'PHASE_8B5_A_FAIL: quarantined Message was marked read';
  end if;

  if (select body from messaging.messages where id=(select message_id from phase8b5_a_fixture))<>'Candidate A exact evidence body 7f2d2f3a'
     or (select count(*) from messaging.message_quarantine where message_id=(select message_id from phase8b5_a_fixture) and status='active')<>1 then
    raise exception 'PHASE_8B5_A_FAIL: quarantine rewrote Message history or failed to preserve active placement';
  end if;
end
$quarantine_projection_assert$;

reset role;

select set_config(
  'request.jwt.claims',
  (
    select jsonb_build_object(
      'sub',super_admin_user_id::text,
      'role','authenticated'
    )::text
    from phase8b5_a_fixture
  ),
  true
);
set local role authenticated;

select public.set_message_quarantine_v1(
  (select safety_case_id from phase8b5_a_fixture),
  (select message_id from phase8b5_a_fixture),
  false,
  'Release after review.',
  'phase8b5-a-release-0001',
  null
);

select public.resolve_message_safety_case_v1(
  (select safety_case_id from phase8b5_a_fixture),
  'no_action',
  'Reviewed and released.',
  'phase8b5-a-resolve-0001',
  null
);

reset role;

select set_config(
  'request.jwt.claims',
  (
    select jsonb_build_object(
      'sub',recipient_user_id::text,
      'role','authenticated'
    )::text
    from phase8b5_a_fixture
  ),
  true
);
set local role authenticated;

create temporary table phase8b5_a_released_detail as
select public.get_my_message_conversation(
  (select conversation_id from phase8b5_a_fixture),
  null,null,50
) as payload;

create temporary table phase8b5_a_released_unread as
select public.get_my_message_unread_counts() as payload;

create temporary table phase8b5_a_released_read as
select public.mark_my_message_conversation_read(
  (select conversation_id from phase8b5_a_fixture),
  null
) as payload;

do $release_assert$
begin
  if position(
    'Candidate A exact evidence body 7f2d2f3a'
    in (select payload->'messages' from phase8b5_a_released_detail)::text
  )=0 then
    raise exception 'PHASE_8B5_A_FAIL: released Message did not return to ordinary projection';
  end if;

  if coalesce(
       ((select payload from phase8b5_a_released_unread)->>'inbox')::bigint,
       0
     )<>1 then
    raise exception 'PHASE_8B5_A_FAIL: released Message did not return to unread projection';
  end if;

  if ((select payload from phase8b5_a_released_read)->>'marked_read')::bigint<>1 then
    raise exception 'PHASE_8B5_A_FAIL: released Message could not be marked read';
  end if;

  if (select count(*) from messaging.message_quarantine where message_id=(select message_id from phase8b5_a_fixture))<>1
     or (select count(*) from messaging.message_quarantine where message_id=(select message_id from phase8b5_a_fixture) and status='released')<>1
     or (select count(*) from messaging.safety_case_events where safety_case_id=(select safety_case_id from phase8b5_a_fixture) and event_kind='quarantined')<>1
     or (select count(*) from messaging.safety_case_events where safety_case_id=(select safety_case_id from phase8b5_a_fixture) and event_kind='released')<>1 then
    raise exception 'PHASE_8B5_A_FAIL: quarantine history was not preserved exactly';
  end if;

  if (select status from messaging.safety_cases where id=(select safety_case_id from phase8b5_a_fixture))<>'resolved'
     or (select current_disposition from messaging.safety_cases where id=(select safety_case_id from phase8b5_a_fixture))<>'no_action' then
    raise exception 'PHASE_8B5_A_FAIL: final Safety Case resolution is incorrect';
  end if;

  if (select count(*) from public.community_reports)<>(select community_report_count_before from phase8b5_a_fixture)
     or (select count(*) from public.community_blocks)<>(select community_block_count_before from phase8b5_a_fixture) then
    raise exception 'PHASE_8B5_A_FAIL: Safety acceptance mutated Community moderation storage';
  end if;
end
$release_assert$;

reset role;

select jsonb_build_object(
  'verification','PASS',
  'migration_count',(select count(*) from supabase_migrations.schema_migrations),
  'migration_head',(select max(version) from supabase_migrations.schema_migrations),
  'safety_case_id',(select safety_case_id from phase8b5_a_fixture),
  'message_id',(select message_id from phase8b5_a_fixture),
  'case_status',(select status from messaging.safety_cases where id=(select safety_case_id from phase8b5_a_fixture)),
  'quarantine_history',(select count(*) from messaging.message_quarantine where message_id=(select message_id from phase8b5_a_fixture)),
  'evidence_views',(select count(*) from messaging.safety_case_events where safety_case_id=(select safety_case_id from phase8b5_a_fixture) and event_kind='evidence_viewed')
) as phase_8b5_candidate_a_safety_case_quarantine_verification;

rollback;
