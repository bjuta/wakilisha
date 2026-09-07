-- Phase 8B.5 Candidate A: private Messages Safety Case and quarantine authority.
--
-- Compounds canonical Messages, command receipts, Community semantics, Media
-- identity, and the existing Super Admin Messages control surface. Safety is a
-- peer authority. It does not rewrite Message history, duplicate Media bytes,
-- create account-wide enforcement, or introduce Legal disclosure authority.

begin;

set local statement_timeout = '180s';
set local lock_timeout = '5s';

select pg_catalog.pg_advisory_xact_lock(
  pg_catalog.hashtextextended(
    'phase-8b5-candidate-a-safety-case-quarantine',
    0
  )
);

do $preflight$
begin
  if to_regnamespace('messaging') is null
     or to_regclass('messaging.messages') is null
     or to_regclass('messaging.conversation_participants') is null
     or to_regclass('media.file_objects') is null
     or to_regclass('platform_private.command_types') is null
     or to_regclass('platform_private.command_receipts') is null
  then
    raise exception 'STOP: accepted Messages, Media, or command authority is incomplete';
  end if;

  if to_regprocedure('messaging.current_human_identity()') is null
     or to_regprocedure('messaging.command_correlation(uuid,text,text,uuid)') is null
     or to_regprocedure('platform_private.begin_authenticated_resource_command(text,uuid,text,jsonb)') is null
     or to_regprocedure('platform_private.complete_resource_command(uuid,jsonb)') is null
     or to_regprocedure('public.current_user_has_capability(text)') is null
     or to_regprocedure('public.list_my_message_conversations(text,timestamptz,uuid,integer)') is null
     or to_regprocedure('public.get_my_message_conversation(uuid,timestamptz,uuid,integer)') is null
     or to_regprocedure('public.get_my_message_unread_counts()') is null
     or to_regprocedure('public.mark_my_message_conversation_read(uuid,uuid)') is null
  then
    raise exception 'STOP: accepted Messages command/read authority is incomplete';
  end if;

  if not exists (
    select 1
    from public.role_capabilities
    where role_key='super_admin'
      and capability_key='manage_messages_control_center'
  ) then
    raise exception 'STOP: Messages Super Admin capability authority is missing';
  end if;

  if to_regclass('messaging.safety_cases') is not null
     or to_regclass('messaging.safety_case_targets') is not null
     or to_regclass('messaging.safety_case_events') is not null
     or to_regclass('messaging.message_quarantine') is not null
     or to_regprocedure('public.report_message_safety_v1(uuid,text,text,text,uuid)') is not null
  then
    raise exception 'STOP: Candidate A Safety authority already exists';
  end if;
end;
$preflight$;

insert into platform_private.command_types(
  command_type,
  job_type,
  accepted_event_type,
  success_event_type,
  failure_event_type,
  retry_event_type
)
values
(
  'messages.safety.report',
  'messages.safety.report.sync',
  'messages.safety.report.accepted',
  'messages.safety.report.succeeded',
  'messages.safety.report.failed',
  'messages.safety.report.retry_scheduled'
),
(
  'messages.safety.review.start',
  'messages.safety.review.start.sync',
  'messages.safety.review.start.accepted',
  'messages.safety.review.start.succeeded',
  'messages.safety.review.start.failed',
  'messages.safety.review.start.retry_scheduled'
),
(
  'messages.safety.quarantine.update',
  'messages.safety.quarantine.update.sync',
  'messages.safety.quarantine.update.accepted',
  'messages.safety.quarantine.update.succeeded',
  'messages.safety.quarantine.update.failed',
  'messages.safety.quarantine.update.retry_scheduled'
),
(
  'messages.safety.resolve',
  'messages.safety.resolve.sync',
  'messages.safety.resolve.accepted',
  'messages.safety.resolve.succeeded',
  'messages.safety.resolve.failed',
  'messages.safety.resolve.retry_scheduled'
),
(
  'messages.safety.evidence.inspect',
  'messages.safety.evidence.inspect.sync',
  'messages.safety.evidence.inspect.accepted',
  'messages.safety.evidence.inspect.succeeded',
  'messages.safety.evidence.inspect.failed',
  'messages.safety.evidence.inspect.retry_scheduled'
);

create table messaging.safety_cases (
  id uuid primary key default gen_random_uuid(),
  case_kind text not null default 'message_safety'
    check (case_kind='message_safety'),
  status text not null default 'open'
    check (status in ('open','under_review','resolved')),
  policy_category text not null
    check (
      octet_length(policy_category) between 2 and 64
      and policy_category ~ '^[a-z][a-z0-9_]{1,63}$'
    ),
  severity text not null default 'low'
    check (severity in ('low','medium','high','severe')),
  confidence numeric(5,4)
    check (confidence is null or (confidence >= 0 and confidence <= 1)),
  current_disposition text not null default 'pending'
    check (current_disposition in ('pending','no_action','quarantine')),
  source_kind text not null
    check (source_kind in ('user_report','staff','automated_signal')),
  source_ref text
    check (source_ref is null or octet_length(source_ref) <= 500),
  created_by_user_id uuid
    references auth.users(id)
    on update restrict
    on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  reviewed_by_user_id uuid
    references auth.users(id)
    on update restrict
    on delete set null,
  review_started_at timestamptz,
  resolved_by_user_id uuid
    references auth.users(id)
    on update restrict
    on delete set null,
  resolved_at timestamptz,
  resolution_note text
    check (resolution_note is null or octet_length(resolution_note) <= 4000),
  constraint safety_cases_review_shape_check
    check (
      (reviewed_by_user_id is null and review_started_at is null)
      or
      (reviewed_by_user_id is not null and review_started_at is not null)
    ),
  constraint safety_cases_resolution_shape_check
    check (
      (
        status <> 'resolved'
        and resolved_by_user_id is null
        and resolved_at is null
        and current_disposition in ('pending','quarantine')
      )
      or
      (
        status='resolved'
        and resolved_by_user_id is not null
        and resolved_at is not null
        and current_disposition in ('no_action','quarantine')
      )
    ),
  constraint safety_cases_time_check
    check (
      updated_at >= created_at
      and (review_started_at is null or review_started_at >= created_at)
      and (resolved_at is null or resolved_at >= created_at)
    )
);

create index safety_cases_queue_idx
on messaging.safety_cases(updated_at desc,id desc)
where status in ('open','under_review');

create index safety_cases_status_queue_idx
on messaging.safety_cases(status,updated_at desc,id desc);

create table messaging.safety_case_targets (
  id uuid primary key default gen_random_uuid(),
  safety_case_id uuid not null
    references messaging.safety_cases(id)
    on update restrict
    on delete restrict,
  message_id uuid
    references messaging.messages(id)
    on update restrict
    on delete restrict,
  media_file_object_id uuid
    references media.file_objects(id)
    on update restrict
    on delete restrict,
  linked_at timestamptz not null default now(),
  constraint safety_case_targets_exactly_one_target_check
    check (pg_catalog.num_nonnulls(message_id,media_file_object_id)=1),
  constraint safety_case_targets_message_identity_key
    unique(safety_case_id,message_id),
  constraint safety_case_targets_media_identity_key
    unique(safety_case_id,media_file_object_id)
);

create index safety_case_targets_message_idx
on messaging.safety_case_targets(message_id,safety_case_id)
where message_id is not null;

create index safety_case_targets_media_idx
on messaging.safety_case_targets(media_file_object_id,safety_case_id)
where media_file_object_id is not null;

create table messaging.safety_case_events (
  id uuid primary key default gen_random_uuid(),
  safety_case_id uuid not null
    references messaging.safety_cases(id)
    on update restrict
    on delete restrict,
  event_kind text not null
    check (
      event_kind in (
        'opened',
        'signal_added',
        'review_started',
        'quarantined',
        'released',
        'resolved',
        'evidence_viewed'
      )
    ),
  actor_kind text not null
    check (actor_kind in ('human','system','automation')),
  actor_user_id uuid
    references auth.users(id)
    on update restrict
    on delete set null,
  actor_person_resource_id uuid
    references editorial.people(resource_id)
    on update restrict
    on delete restrict,
  actor_key text,
  command_receipt_id uuid
    references platform_private.command_receipts(id)
    on update restrict
    on delete restrict,
  occurred_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb,
  constraint safety_case_events_actor_shape_check
    check (
      (
        actor_kind='human'
        and actor_user_id is not null
        and actor_person_resource_id is not null
        and actor_key is null
      )
      or
      (
        actor_kind in ('system','automation')
        and actor_user_id is null
        and actor_person_resource_id is null
        and actor_key is not null
        and actor_key ~ '^[a-z][a-z0-9_.:-]{1,99}$'
      )
    ),
  constraint safety_case_events_metadata_size_check
    check (octet_length(metadata::text) <= 12000)
);

create index safety_case_events_case_chronology_idx
on messaging.safety_case_events(safety_case_id,occurred_at,id);

create table messaging.message_quarantine (
  id uuid primary key default gen_random_uuid(),
  message_id uuid not null
    references messaging.messages(id)
    on update restrict
    on delete restrict,
  safety_case_id uuid not null,
  status text not null default 'active'
    check (status in ('active','released')),
  policy_category text not null
    check (
      octet_length(policy_category) between 2 and 64
      and policy_category ~ '^[a-z][a-z0-9_]{1,63}$'
    ),
  placed_at timestamptz not null default now(),
  placed_by_user_id uuid not null
    references auth.users(id)
    on update restrict
    on delete restrict,
  released_at timestamptz,
  released_by_user_id uuid
    references auth.users(id)
    on update restrict
    on delete restrict,
  release_note text
    check (release_note is null or octet_length(release_note) <= 2000),
  command_receipt_id uuid
    references platform_private.command_receipts(id)
    on update restrict
    on delete restrict,
  constraint message_quarantine_case_message_fkey
    foreign key(safety_case_id,message_id)
    references messaging.safety_case_targets(safety_case_id,message_id)
    on update restrict
    on delete restrict,
  constraint message_quarantine_status_shape_check
    check (
      (
        status='active'
        and released_at is null
        and released_by_user_id is null
        and release_note is null
      )
      or
      (
        status='released'
        and released_at is not null
        and released_by_user_id is not null
        and released_at >= placed_at
      )
    )
);

create unique index message_quarantine_one_active_per_message_key
on messaging.message_quarantine(message_id)
where status='active';

create index message_quarantine_case_idx
on messaging.message_quarantine(safety_case_id,placed_at desc,id desc);

alter table messaging.safety_cases enable row level security;
alter table messaging.safety_case_targets enable row level security;
alter table messaging.safety_case_events enable row level security;
alter table messaging.message_quarantine enable row level security;

revoke all on table messaging.safety_cases
from public,anon,authenticated,service_role;
revoke all on table messaging.safety_case_targets
from public,anon,authenticated,service_role;
revoke all on table messaging.safety_case_events
from public,anon,authenticated,service_role;
revoke all on table messaging.message_quarantine
from public,anon,authenticated,service_role;

create or replace function messaging.reject_immutable_safety_evidence_mutation()
returns trigger
language plpgsql
set search_path=pg_catalog
as $$
begin
  raise exception 'Safety targets and Safety events are immutable.';
end
$$;

revoke all on function messaging.reject_immutable_safety_evidence_mutation()
from public,anon,authenticated,service_role;

create trigger safety_case_targets_immutable
before update or delete on messaging.safety_case_targets
for each row execute function messaging.reject_immutable_safety_evidence_mutation();

create trigger safety_case_events_immutable
before update or delete on messaging.safety_case_events
for each row execute function messaging.reject_immutable_safety_evidence_mutation();

create or replace function messaging.current_messages_super_admin()
returns table(user_id uuid,person_resource_id uuid)
language plpgsql
stable
security definer
set search_path=pg_catalog,auth,public,editorial,messaging
as $$
declare
  me record;
begin
  select * into me from messaging.current_human_identity();

  if not exists (
    select 1
    from public.user_role_assignments assignment
    where assignment.user_id=me.user_id
      and assignment.role_key='super_admin'
      and assignment.status='active'
      and (assignment.expires_at is null or assignment.expires_at>now())
  ) or not public.current_user_has_capability('manage_messages_control_center') then
    raise exception
      'Messages Safety requires active Super Admin authority.'
      using errcode='42501';
  end if;

  return query
  select me.user_id,me.person_resource_id;
end
$$;

revoke all on function messaging.current_messages_super_admin()
from public,anon,authenticated,service_role;

create or replace function public.report_message_safety_v1(
  p_message_id uuid,
  p_policy_category text,
  p_note text,
  p_idempotency_key text,
  p_correlation_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path=pg_catalog,auth,public,editorial,messaging,platform_private
as $$
declare
  me record;
  participant_id uuid;
  message_row messaging.messages%rowtype;
  category text:=lower(btrim(coalesce(p_policy_category,'')));
  note text:=nullif(btrim(coalesce(p_note,'')),'');
  correlation uuid;
  begin_row record;
  existing_case uuid;
  case_id uuid;
  event_id uuid;
  result jsonb;
begin
  select * into me from messaging.current_human_identity();

  if p_message_id is null
     or category !~ '^[a-z][a-z0-9_]{1,63}$'
     or octet_length(category)>64
     or (note is not null and octet_length(note)>2000) then
    raise exception
      'Message Safety report input is invalid.'
      using errcode='22023';
  end if;

  correlation:=messaging.command_correlation(
    me.user_id,
    'messages.safety.report',
    p_idempotency_key,
    p_correlation_id
  );

  select * into begin_row
  from platform_private.begin_authenticated_resource_command(
    'messages.safety.report',
    me.person_resource_id,
    p_idempotency_key,
    jsonb_strip_nulls(
      jsonb_build_object(
        'message_id',p_message_id,
        'policy_category',category,
        'note',note,
        'correlation_id',correlation
      )
    )
  );

  if begin_row.idempotent_replay then
    return begin_row.result_payload;
  end if;

  select participant.id
  into participant_id
  from messaging.conversation_participants participant
  join messaging.messages message
    on message.conversation_id=participant.conversation_id
  where message.id=p_message_id
    and participant.person_resource_id=me.person_resource_id
    and participant.user_id=me.user_id
    and participant.membership_status='active'
  limit 1;

  if participant_id is null then
    raise exception
      'Active Conversation participation is required to report this Message.'
      using errcode='42501';
  end if;

  select *
  into message_row
  from messaging.messages message
  where message.id=p_message_id;

  if message_row.id is null then
    raise exception 'The Message was not found.' using errcode='P0002';
  end if;

  if message_row.sender_participant_id=participant_id then
    raise exception
      'A sender cannot report their own Message.'
      using errcode='22023';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      'messages-safety-report:'||me.user_id::text||':'||p_message_id::text,
      0
    )
  );

  select safety_case.id
  into existing_case
  from messaging.safety_cases safety_case
  join messaging.safety_case_targets target
    on target.safety_case_id=safety_case.id
   and target.message_id=p_message_id
  where safety_case.source_kind='user_report'
    and safety_case.created_by_user_id=me.user_id
    and safety_case.status in ('open','under_review')
  order by safety_case.created_at,safety_case.id
  limit 1;

  if existing_case is not null then
    result:=jsonb_build_object(
      'safety_case_id',existing_case,
      'message_id',p_message_id,
      'status',(
        select status from messaging.safety_cases where id=existing_case
      ),
      'created',false,
      'correlation_id',correlation
    );
    perform platform_private.complete_resource_command(
      begin_row.command_receipt_id,
      result
    );
    return result;
  end if;

  insert into messaging.safety_cases(
    case_kind,
    status,
    policy_category,
    severity,
    current_disposition,
    source_kind,
    created_by_user_id,
    created_at,
    updated_at
  )
  values(
    'message_safety',
    'open',
    category,
    'low',
    'pending',
    'user_report',
    me.user_id,
    now(),
    now()
  )
  returning id into case_id;

  insert into messaging.safety_case_targets(
    safety_case_id,
    message_id,
    linked_at
  )
  values(case_id,p_message_id,now());

  insert into messaging.safety_case_events(
    safety_case_id,
    event_kind,
    actor_kind,
    actor_user_id,
    actor_person_resource_id,
    command_receipt_id,
    occurred_at,
    metadata
  )
  values(
    case_id,
    'opened',
    'human',
    me.user_id,
    me.person_resource_id,
    begin_row.command_receipt_id,
    now(),
    jsonb_strip_nulls(
      jsonb_build_object(
        'policy_category',category,
        'note',note,
        'message_id',p_message_id
      )
    )
  )
  returning id into event_id;

  result:=jsonb_build_object(
    'safety_case_id',case_id,
    'message_id',p_message_id,
    'status','open',
    'created',true,
    'event_id',event_id,
    'correlation_id',correlation
  );

  perform platform_private.complete_resource_command(
    begin_row.command_receipt_id,
    result
  );

  return result;
end
$$;

create or replace function public.list_messages_safety_cases_v1(
  p_status text default null,
  p_before_updated_at timestamptz default null,
  p_before_case_id uuid default null,
  p_limit integer default 50
)
returns jsonb
language plpgsql
stable
security definer
set search_path=pg_catalog,auth,public,editorial,messaging
as $$
declare
  admin_identity record;
  status_filter text:=nullif(lower(btrim(coalesce(p_status,''))), '');
  limit_value integer:=greatest(1,least(coalesce(p_limit,50),100));
begin
  select * into admin_identity from messaging.current_messages_super_admin();

  if status_filter is not null
     and status_filter not in ('open','under_review','resolved') then
    raise exception 'Safety Case status filter is invalid.' using errcode='22023';
  end if;

  return coalesce((
    select jsonb_agg(row_json order by updated_at desc,case_id desc)
    from (
      select
        safety_case.id as case_id,
        safety_case.updated_at,
        jsonb_build_object(
          'case_id',safety_case.id,
          'status',safety_case.status,
          'policy_category',safety_case.policy_category,
          'severity',safety_case.severity,
          'current_disposition',safety_case.current_disposition,
          'source_kind',safety_case.source_kind,
          'created_at',safety_case.created_at,
          'updated_at',safety_case.updated_at,
          'message_target_count',(
            select count(*)
            from messaging.safety_case_targets target
            where target.safety_case_id=safety_case.id
              and target.message_id is not null
          ),
          'media_target_count',(
            select count(*)
            from messaging.safety_case_targets target
            where target.safety_case_id=safety_case.id
              and target.media_file_object_id is not null
          ),
          'active_quarantine_count',(
            select count(*)
            from messaging.message_quarantine quarantine
            where quarantine.safety_case_id=safety_case.id
              and quarantine.status='active'
          )
        ) as row_json
      from messaging.safety_cases safety_case
      where (status_filter is null or safety_case.status=status_filter)
        and (
          p_before_updated_at is null
          or (safety_case.updated_at,safety_case.id)<(
            p_before_updated_at,
            coalesce(
              p_before_case_id,
              'ffffffff-ffff-ffff-ffff-ffffffffffff'::uuid
            )
          )
        )
      order by safety_case.updated_at desc,safety_case.id desc
      limit limit_value
    ) page
  ),'[]'::jsonb);
end
$$;

create or replace function public.get_messages_safety_case_v1(
  p_case_id uuid
)
returns jsonb
language plpgsql
stable
security definer
set search_path=pg_catalog,auth,public,editorial,messaging
as $$
declare
  admin_identity record;
  safety_case messaging.safety_cases%rowtype;
begin
  select * into admin_identity from messaging.current_messages_super_admin();

  select * into safety_case
  from messaging.safety_cases
  where id=p_case_id;

  if safety_case.id is null then
    raise exception 'Safety Case was not found.' using errcode='P0002';
  end if;

  return jsonb_build_object(
    'case',jsonb_build_object(
      'case_id',safety_case.id,
      'status',safety_case.status,
      'policy_category',safety_case.policy_category,
      'severity',safety_case.severity,
      'confidence',safety_case.confidence,
      'current_disposition',safety_case.current_disposition,
      'source_kind',safety_case.source_kind,
      'created_by_user_id',safety_case.created_by_user_id,
      'created_at',safety_case.created_at,
      'updated_at',safety_case.updated_at,
      'reviewed_by_user_id',safety_case.reviewed_by_user_id,
      'review_started_at',safety_case.review_started_at,
      'resolved_by_user_id',safety_case.resolved_by_user_id,
      'resolved_at',safety_case.resolved_at,
      'resolution_note',safety_case.resolution_note
    ),
    'targets',coalesce((
      select jsonb_agg(target_json order by linked_at,target_id)
      from (
        select
          target.linked_at,
          target.id as target_id,
          case
            when target.message_id is not null then
              jsonb_build_object(
                'target_id',target.id,
                'target_type','message',
                'message_id',target.message_id,
                'conversation_id',message.conversation_id,
                'accepted_at',message.accepted_at,
                'sender',messaging.participant_identity_json(
                  sender.actor_kind,
                  sender.person_resource_id,
                  sender.actor_key
                ),
                'linked_at',target.linked_at
              )
            else
              jsonb_build_object(
                'target_id',target.id,
                'target_type','media_file',
                'media_file_object_id',target.media_file_object_id,
                'linked_at',target.linked_at
              )
          end as target_json
        from messaging.safety_case_targets target
        left join messaging.messages message
          on message.id=target.message_id
        left join messaging.conversation_participants sender
          on sender.id=message.sender_participant_id
        where target.safety_case_id=safety_case.id
      ) targets
    ),'[]'::jsonb),
    'events',coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'event_id',event.id,
          'event_kind',event.event_kind,
          'actor_kind',event.actor_kind,
          'actor_user_id',event.actor_user_id,
          'actor_person_resource_id',event.actor_person_resource_id,
          'actor_key',event.actor_key,
          'occurred_at',event.occurred_at,
          'metadata',event.metadata
        )
        order by event.occurred_at,event.id
      )
      from messaging.safety_case_events event
      where event.safety_case_id=safety_case.id
    ),'[]'::jsonb),
    'quarantine',coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'quarantine_id',quarantine.id,
          'message_id',quarantine.message_id,
          'status',quarantine.status,
          'policy_category',quarantine.policy_category,
          'placed_at',quarantine.placed_at,
          'released_at',quarantine.released_at,
          'release_note',quarantine.release_note
        )
        order by quarantine.placed_at,quarantine.id
      )
      from messaging.message_quarantine quarantine
      where quarantine.safety_case_id=safety_case.id
    ),'[]'::jsonb)
  );
end
$$;

create or replace function public.start_messages_safety_review_v1(
  p_case_id uuid,
  p_idempotency_key text,
  p_correlation_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path=pg_catalog,auth,public,editorial,messaging,platform_private
as $$
declare
  admin_identity record;
  safety_case messaging.safety_cases%rowtype;
  correlation uuid;
  begin_row record;
  event_id uuid;
  result jsonb;
begin
  select * into admin_identity from messaging.current_messages_super_admin();

  correlation:=messaging.command_correlation(
    admin_identity.user_id,
    'messages.safety.review.start',
    p_idempotency_key,
    p_correlation_id
  );

  select * into begin_row
  from platform_private.begin_authenticated_resource_command(
    'messages.safety.review.start',
    admin_identity.person_resource_id,
    p_idempotency_key,
    jsonb_build_object(
      'safety_case_id',p_case_id,
      'correlation_id',correlation
    )
  );

  if begin_row.idempotent_replay then
    return begin_row.result_payload;
  end if;

  select * into safety_case
  from messaging.safety_cases
  where id=p_case_id
  for update;

  if safety_case.id is null then
    raise exception 'Safety Case was not found.' using errcode='P0002';
  end if;

  if safety_case.status='resolved' then
    raise exception 'A resolved Safety Case cannot restart review.' using errcode='22023';
  end if;

  if safety_case.status='under_review' then
    result:=jsonb_build_object(
      'safety_case_id',safety_case.id,
      'status',safety_case.status,
      'review_started_at',safety_case.review_started_at,
      'changed',false,
      'correlation_id',correlation
    );
    perform platform_private.complete_resource_command(
      begin_row.command_receipt_id,
      result
    );
    return result;
  end if;

  update messaging.safety_cases
  set
    status='under_review',
    reviewed_by_user_id=admin_identity.user_id,
    review_started_at=now(),
    updated_at=now()
  where id=safety_case.id
  returning * into safety_case;

  insert into messaging.safety_case_events(
    safety_case_id,
    event_kind,
    actor_kind,
    actor_user_id,
    actor_person_resource_id,
    command_receipt_id,
    occurred_at,
    metadata
  )
  values(
    safety_case.id,
    'review_started',
    'human',
    admin_identity.user_id,
    admin_identity.person_resource_id,
    begin_row.command_receipt_id,
    now(),
    '{}'::jsonb
  )
  returning id into event_id;

  result:=jsonb_build_object(
    'safety_case_id',safety_case.id,
    'status',safety_case.status,
    'review_started_at',safety_case.review_started_at,
    'changed',true,
    'event_id',event_id,
    'correlation_id',correlation
  );

  perform platform_private.complete_resource_command(
    begin_row.command_receipt_id,
    result
  );

  return result;
end
$$;

create or replace function public.set_message_quarantine_v1(
  p_case_id uuid,
  p_message_id uuid,
  p_quarantined boolean,
  p_reason text,
  p_idempotency_key text,
  p_correlation_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path=pg_catalog,auth,public,editorial,messaging,platform_private
as $$
declare
  admin_identity record;
  safety_case messaging.safety_cases%rowtype;
  reason text:=nullif(btrim(coalesce(p_reason,'')),'');
  correlation uuid;
  begin_row record;
  quarantine_row messaging.message_quarantine%rowtype;
  event_id uuid;
  result jsonb;
begin
  select * into admin_identity from messaging.current_messages_super_admin();

  if p_case_id is null
     or p_message_id is null
     or p_quarantined is null
     or reason is null
     or octet_length(reason)>2000 then
    raise exception 'Message quarantine input is invalid.' using errcode='22023';
  end if;

  correlation:=messaging.command_correlation(
    admin_identity.user_id,
    'messages.safety.quarantine.update',
    p_idempotency_key,
    p_correlation_id
  );

  select * into begin_row
  from platform_private.begin_authenticated_resource_command(
    'messages.safety.quarantine.update',
    admin_identity.person_resource_id,
    p_idempotency_key,
    jsonb_build_object(
      'safety_case_id',p_case_id,
      'message_id',p_message_id,
      'quarantined',p_quarantined,
      'reason',reason,
      'correlation_id',correlation
    )
  );

  if begin_row.idempotent_replay then
    return begin_row.result_payload;
  end if;

  select * into safety_case
  from messaging.safety_cases
  where id=p_case_id
  for update;

  if safety_case.id is null then
    raise exception 'Safety Case was not found.' using errcode='P0002';
  end if;

  if safety_case.status='resolved' then
    raise exception 'Resolved Safety Cases cannot change quarantine.' using errcode='22023';
  end if;

  if not exists (
    select 1
    from messaging.safety_case_targets target
    where target.safety_case_id=p_case_id
      and target.message_id=p_message_id
  ) then
    raise exception
      'The Safety Case does not target this Message.'
      using errcode='42501';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      'message-quarantine:'||p_message_id::text,
      0
    )
  );

  select * into quarantine_row
  from messaging.message_quarantine quarantine
  where quarantine.message_id=p_message_id
    and quarantine.status='active'
  for update;

  if p_quarantined then
    if quarantine_row.id is not null then
      if quarantine_row.safety_case_id<>p_case_id then
        raise exception
          'This Message is already quarantined by another Safety Case.'
          using errcode='40001';
      end if;

      result:=jsonb_build_object(
        'safety_case_id',p_case_id,
        'message_id',p_message_id,
        'quarantined',true,
        'quarantine_id',quarantine_row.id,
        'changed',false,
        'correlation_id',correlation
      );
      perform platform_private.complete_resource_command(
        begin_row.command_receipt_id,
        result
      );
      return result;
    end if;

    insert into messaging.message_quarantine(
      message_id,
      safety_case_id,
      status,
      policy_category,
      placed_at,
      placed_by_user_id,
      command_receipt_id
    )
    values(
      p_message_id,
      p_case_id,
      'active',
      safety_case.policy_category,
      now(),
      admin_identity.user_id,
      begin_row.command_receipt_id
    )
    returning * into quarantine_row;

    update messaging.safety_cases
    set current_disposition='quarantine',updated_at=now()
    where id=p_case_id;

    insert into messaging.safety_case_events(
      safety_case_id,
      event_kind,
      actor_kind,
      actor_user_id,
      actor_person_resource_id,
      command_receipt_id,
      occurred_at,
      metadata
    )
    values(
      p_case_id,
      'quarantined',
      'human',
      admin_identity.user_id,
      admin_identity.person_resource_id,
      begin_row.command_receipt_id,
      now(),
      jsonb_build_object(
        'message_id',p_message_id,
        'reason',reason,
        'quarantine_id',quarantine_row.id
      )
    )
    returning id into event_id;

    result:=jsonb_build_object(
      'safety_case_id',p_case_id,
      'message_id',p_message_id,
      'quarantined',true,
      'quarantine_id',quarantine_row.id,
      'changed',true,
      'event_id',event_id,
      'correlation_id',correlation
    );
  else
    if quarantine_row.id is null then
      result:=jsonb_build_object(
        'safety_case_id',p_case_id,
        'message_id',p_message_id,
        'quarantined',false,
        'changed',false,
        'correlation_id',correlation
      );
      perform platform_private.complete_resource_command(
        begin_row.command_receipt_id,
        result
      );
      return result;
    end if;

    if quarantine_row.safety_case_id<>p_case_id then
      raise exception
        'Another Safety Case owns the active quarantine.'
        using errcode='42501';
    end if;

    update messaging.message_quarantine
    set
      status='released',
      released_at=now(),
      released_by_user_id=admin_identity.user_id,
      release_note=reason
    where id=quarantine_row.id
    returning * into quarantine_row;

    update messaging.safety_cases
    set current_disposition='pending',updated_at=now()
    where id=p_case_id;

    insert into messaging.safety_case_events(
      safety_case_id,
      event_kind,
      actor_kind,
      actor_user_id,
      actor_person_resource_id,
      command_receipt_id,
      occurred_at,
      metadata
    )
    values(
      p_case_id,
      'released',
      'human',
      admin_identity.user_id,
      admin_identity.person_resource_id,
      begin_row.command_receipt_id,
      now(),
      jsonb_build_object(
        'message_id',p_message_id,
        'reason',reason,
        'quarantine_id',quarantine_row.id
      )
    )
    returning id into event_id;

    result:=jsonb_build_object(
      'safety_case_id',p_case_id,
      'message_id',p_message_id,
      'quarantined',false,
      'quarantine_id',quarantine_row.id,
      'changed',true,
      'event_id',event_id,
      'correlation_id',correlation
    );
  end if;

  perform platform_private.complete_resource_command(
    begin_row.command_receipt_id,
    result
  );

  return result;
end
$$;

create or replace function public.resolve_message_safety_case_v1(
  p_case_id uuid,
  p_disposition text,
  p_resolution_note text,
  p_idempotency_key text,
  p_correlation_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path=pg_catalog,auth,public,editorial,messaging,platform_private
as $$
declare
  admin_identity record;
  safety_case messaging.safety_cases%rowtype;
  disposition text:=lower(btrim(coalesce(p_disposition,'')));
  resolution_note text:=nullif(btrim(coalesce(p_resolution_note,'')),'');
  correlation uuid;
  begin_row record;
  active_quarantine_count bigint;
  event_id uuid;
  result jsonb;
begin
  select * into admin_identity from messaging.current_messages_super_admin();

  if p_case_id is null
     or disposition not in ('no_action','quarantine')
     or resolution_note is null
     or octet_length(resolution_note)>4000 then
    raise exception 'Safety Case resolution input is invalid.' using errcode='22023';
  end if;

  correlation:=messaging.command_correlation(
    admin_identity.user_id,
    'messages.safety.resolve',
    p_idempotency_key,
    p_correlation_id
  );

  select * into begin_row
  from platform_private.begin_authenticated_resource_command(
    'messages.safety.resolve',
    admin_identity.person_resource_id,
    p_idempotency_key,
    jsonb_build_object(
      'safety_case_id',p_case_id,
      'disposition',disposition,
      'resolution_note',resolution_note,
      'correlation_id',correlation
    )
  );

  if begin_row.idempotent_replay then
    return begin_row.result_payload;
  end if;

  select * into safety_case
  from messaging.safety_cases
  where id=p_case_id
  for update;

  if safety_case.id is null then
    raise exception 'Safety Case was not found.' using errcode='P0002';
  end if;

  if safety_case.status='resolved' then
    if safety_case.current_disposition<>disposition then
      raise exception
        'Safety Case is already resolved with another disposition.'
        using errcode='40001';
    end if;

    result:=jsonb_build_object(
      'safety_case_id',safety_case.id,
      'status',safety_case.status,
      'disposition',safety_case.current_disposition,
      'resolved_at',safety_case.resolved_at,
      'changed',false,
      'correlation_id',correlation
    );
    perform platform_private.complete_resource_command(
      begin_row.command_receipt_id,
      result
    );
    return result;
  end if;

  select count(*) into active_quarantine_count
  from messaging.message_quarantine quarantine
  where quarantine.safety_case_id=p_case_id
    and quarantine.status='active';

  if disposition='no_action' and active_quarantine_count<>0 then
    raise exception
      'Release active quarantine before resolving with no action.'
      using errcode='22023';
  end if;

  if disposition='quarantine' and active_quarantine_count=0 then
    raise exception
      'An active quarantine is required for the quarantine disposition.'
      using errcode='22023';
  end if;

  update messaging.safety_cases
  set
    status='resolved',
    current_disposition=disposition,
    resolved_by_user_id=admin_identity.user_id,
    resolved_at=now(),
    resolution_note=resolution_note,
    updated_at=now(),
    reviewed_by_user_id=coalesce(
      reviewed_by_user_id,
      admin_identity.user_id
    ),
    review_started_at=coalesce(review_started_at,now())
  where id=p_case_id
  returning * into safety_case;

  insert into messaging.safety_case_events(
    safety_case_id,
    event_kind,
    actor_kind,
    actor_user_id,
    actor_person_resource_id,
    command_receipt_id,
    occurred_at,
    metadata
  )
  values(
    p_case_id,
    'resolved',
    'human',
    admin_identity.user_id,
    admin_identity.person_resource_id,
    begin_row.command_receipt_id,
    now(),
    jsonb_build_object(
      'disposition',disposition,
      'resolution_note',resolution_note,
      'active_quarantine_count',active_quarantine_count
    )
  )
  returning id into event_id;

  result:=jsonb_build_object(
    'safety_case_id',safety_case.id,
    'status',safety_case.status,
    'disposition',safety_case.current_disposition,
    'resolved_at',safety_case.resolved_at,
    'changed',true,
    'event_id',event_id,
    'correlation_id',correlation
  );

  perform platform_private.complete_resource_command(
    begin_row.command_receipt_id,
    result
  );

  return result;
end
$$;

create or replace function public.inspect_message_safety_evidence_v1(
  p_case_id uuid,
  p_message_id uuid,
  p_reason text,
  p_idempotency_key text,
  p_correlation_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path=pg_catalog,auth,public,editorial,messaging,platform_private
as $$
declare
  admin_identity record;
  reason text:=nullif(btrim(coalesce(p_reason,'')),'');
  correlation uuid;
  begin_row record;
  event_id uuid;
  message_row messaging.messages%rowtype;
  sender messaging.conversation_participants%rowtype;
  receipt_result jsonb;
  evidence jsonb;
begin
  select * into admin_identity from messaging.current_messages_super_admin();

  if p_case_id is null
     or p_message_id is null
     or reason is null
     or octet_length(reason)>2000 then
    raise exception 'Evidence inspection input is invalid.' using errcode='22023';
  end if;

  if not exists (
    select 1
    from messaging.safety_case_targets target
    where target.safety_case_id=p_case_id
      and target.message_id=p_message_id
  ) then
    raise exception
      'The Safety Case does not target this Message.'
      using errcode='42501';
  end if;

  select * into message_row
  from messaging.messages
  where id=p_message_id;

  if message_row.id is null then
    raise exception 'The Message was not found.' using errcode='P0002';
  end if;

  select * into sender
  from messaging.conversation_participants
  where id=message_row.sender_participant_id;

  correlation:=messaging.command_correlation(
    admin_identity.user_id,
    'messages.safety.evidence.inspect',
    p_idempotency_key,
    p_correlation_id
  );

  select * into begin_row
  from platform_private.begin_authenticated_resource_command(
    'messages.safety.evidence.inspect',
    admin_identity.person_resource_id,
    p_idempotency_key,
    jsonb_build_object(
      'safety_case_id',p_case_id,
      'message_id',p_message_id,
      'reason',reason,
      'correlation_id',correlation
    )
  );

  if not begin_row.idempotent_replay then
    insert into messaging.safety_case_events(
      safety_case_id,
      event_kind,
      actor_kind,
      actor_user_id,
      actor_person_resource_id,
      command_receipt_id,
      occurred_at,
      metadata
    )
    values(
      p_case_id,
      'evidence_viewed',
      'human',
      admin_identity.user_id,
      admin_identity.person_resource_id,
      begin_row.command_receipt_id,
      now(),
      jsonb_build_object(
        'message_id',p_message_id,
        'reason',reason
      )
    )
    returning id into event_id;

    receipt_result:=jsonb_build_object(
      'safety_case_id',p_case_id,
      'message_id',p_message_id,
      'evidence_event_id',event_id,
      'correlation_id',correlation
    );

    perform platform_private.complete_resource_command(
      begin_row.command_receipt_id,
      receipt_result
    );
  else
    event_id:=nullif(
      begin_row.result_payload->>'evidence_event_id',
      ''
    )::uuid;
  end if;

  evidence:=jsonb_build_object(
    'safety_case_id',p_case_id,
    'message_id',message_row.id,
    'conversation_id',message_row.conversation_id,
    'message_kind',message_row.message_kind,
    'body',message_row.body,
    'accepted_at',message_row.accepted_at,
    'client_created_at',message_row.client_created_at,
    'sender',messaging.participant_identity_json(
      sender.actor_kind,
      sender.person_resource_id,
      sender.actor_key
    ),
    'sender_actor_kind',sender.actor_kind,
    'sender_person_resource_id',sender.person_resource_id,
    'sender_actor_key',sender.actor_key,
    'evidence_event_id',event_id,
    'idempotent_replay',begin_row.idempotent_replay
  );

  return evidence;
end
$$;

-- Active quarantine changes ordinary Messages projection only. Canonical Message
-- rows and receipt history remain intact.
create or replace function public.mark_my_message_conversation_read(
  p_conversation_id uuid,
  p_through_message_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path=pg_catalog,auth,public,editorial,messaging
as $$
declare
  me record;
  participant_id uuid;
  cutoff timestamptz;
  read_at_value timestamptz:=now();
  marked bigint;
begin
  select * into me from messaging.current_human_identity();

  select participant.id into participant_id
  from messaging.conversation_participants participant
  where participant.conversation_id=p_conversation_id
    and participant.person_resource_id=me.person_resource_id
    and participant.user_id=me.user_id
    and participant.membership_status='active';

  if participant_id is null then
    raise exception
      'Active conversation membership is required.'
      using errcode='42501';
  end if;

  if p_through_message_id is null then
    cutoff:='infinity'::timestamptz;
  else
    select message.accepted_at into cutoff
    from messaging.messages message
    where message.id=p_through_message_id
      and message.conversation_id=p_conversation_id
      and not exists (
        select 1
        from messaging.message_quarantine quarantine
        where quarantine.message_id=message.id
          and quarantine.status='active'
      );

    if cutoff is null then
      raise exception
        'The Message is not available in this Conversation.'
        using errcode='P0002';
    end if;
  end if;

  update messaging.message_receipts receipt
  set read_at=coalesce(receipt.read_at,read_at_value)
  from messaging.messages message
  where receipt.message_id=message.id
    and receipt.participant_id=participant_id
    and receipt.conversation_id=p_conversation_id
    and message.accepted_at<=cutoff
    and receipt.read_at is null
    and not exists (
      select 1
      from messaging.message_quarantine quarantine
      where quarantine.message_id=message.id
        and quarantine.status='active'
    );

  get diagnostics marked=row_count;

  return jsonb_build_object(
    'conversation_id',p_conversation_id,
    'marked_read',marked,
    'read_at',read_at_value
  );
end
$$;

create or replace function public.get_my_message_unread_counts()
returns jsonb
language plpgsql
stable
security definer
set search_path=pg_catalog,auth,public,editorial,messaging
as $$
declare
  me record;
begin
  select * into me from messaging.current_human_identity();

  return coalesce((
    select jsonb_object_agg(folder,unread_count)
    from (
      select
        participant.mailbox_folder as folder,
        count(*)::bigint as unread_count
      from messaging.message_receipts receipt
      join messaging.conversation_participants participant
        on participant.id=receipt.participant_id
      where participant.user_id=me.user_id
        and participant.person_resource_id=me.person_resource_id
        and participant.membership_status='active'
        and receipt.read_at is null
        and not exists (
          select 1
          from messaging.message_quarantine quarantine
          where quarantine.message_id=receipt.message_id
            and quarantine.status='active'
        )
      group by participant.mailbox_folder
    ) counts
  ),'{}'::jsonb);
end
$$;

create or replace function public.list_my_message_conversations(
  p_folder text default 'inbox',
  p_before_last_activity_at timestamptz default null,
  p_before_conversation_id uuid default null,
  p_limit integer default 30
)
returns jsonb
language plpgsql
stable
security definer
set search_path=pg_catalog,auth,public,editorial,messaging
as $$
declare
  me record;
  folder_filter text;
  limit_value integer;
begin
  select * into me from messaging.current_human_identity();
  folder_filter:=lower(btrim(coalesce(p_folder,'inbox')));
  limit_value:=greatest(1,least(coalesce(p_limit,30),100));

  if folder_filter not in ('inbox','requests','spam','archived') then
    raise exception 'Message folder is invalid.' using errcode='22023';
  end if;

  return coalesce((
    select jsonb_agg(
      item
      order by
        (item->>'last_activity_at')::timestamptz desc,
        (item->>'conversation_id')::uuid desc
    )
    from (
      select jsonb_build_object(
        'conversation_id',conversation.id,
        'security_classification',conversation.security_classification,
        'status',conversation.status,
        'mailbox_folder',mine.mailbox_folder,
        'first_contact_state',mine.first_contact_state,
        'last_activity_at',conversation.last_activity_at,
        'other_participant',messaging.participant_identity_json(
          other.actor_kind,
          other.person_resource_id,
          other.actor_key
        ),
        'latest_message',(
          select jsonb_build_object(
            'id',message.id,
            'body',message.body,
            'accepted_at',message.accepted_at,
            'sender',messaging.participant_identity_json(
              sender.actor_kind,
              sender.person_resource_id,
              sender.actor_key
            ),
            'sender_actor_kind',sender.actor_kind,
            'sender_person_resource_id',sender.person_resource_id,
            'sender_actor_key',sender.actor_key
          )
          from messaging.messages message
          join messaging.conversation_participants sender
            on sender.id=message.sender_participant_id
          where message.conversation_id=conversation.id
            and not exists (
              select 1
              from messaging.message_quarantine quarantine
              where quarantine.message_id=message.id
                and quarantine.status='active'
            )
          order by message.accepted_at desc,message.id desc
          limit 1
        ),
        'unread_count',(
          select count(*)
          from messaging.message_receipts receipt
          where receipt.participant_id=mine.id
            and receipt.read_at is null
            and not exists (
              select 1
              from messaging.message_quarantine quarantine
              where quarantine.message_id=receipt.message_id
                and quarantine.status='active'
            )
        )
      ) as item
      from messaging.conversation_participants mine
      join messaging.conversations conversation
        on conversation.id=mine.conversation_id
      left join messaging.conversation_participants other
        on other.conversation_id=conversation.id
       and other.id<>mine.id
       and other.membership_status='active'
      where mine.user_id=me.user_id
        and mine.person_resource_id=me.person_resource_id
        and mine.membership_status='active'
        and mine.mailbox_folder=folder_filter
        and (
          p_before_last_activity_at is null
          or (conversation.last_activity_at,conversation.id)<(
            p_before_last_activity_at,
            coalesce(
              p_before_conversation_id,
              'ffffffff-ffff-ffff-ffff-ffffffffffff'::uuid
            )
          )
        )
      order by conversation.last_activity_at desc,conversation.id desc
      limit limit_value
    ) page
  ),'[]'::jsonb);
end
$$;

create or replace function public.get_my_message_conversation(
  p_conversation_id uuid,
  p_before_accepted_at timestamptz default null,
  p_before_message_id uuid default null,
  p_limit integer default 50
)
returns jsonb
language plpgsql
stable
security definer
set search_path=pg_catalog,auth,public,editorial,messaging
as $$
declare
  me record;
  mine messaging.conversation_participants%rowtype;
  limit_value integer;
begin
  select * into me from messaging.current_human_identity();
  limit_value:=greatest(1,least(coalesce(p_limit,50),100));

  select participant.* into mine
  from messaging.conversation_participants participant
  where participant.conversation_id=p_conversation_id
    and participant.user_id=me.user_id
    and participant.person_resource_id=me.person_resource_id
    and participant.membership_status='active';

  if mine.id is null then
    raise exception
      'Active conversation membership is required.'
      using errcode='42501';
  end if;

  return jsonb_build_object(
    'conversation',(
      select jsonb_build_object(
        'id',conversation.id,
        'security_classification',conversation.security_classification,
        'status',conversation.status,
        'mailbox_folder',mine.mailbox_folder,
        'first_contact_state',mine.first_contact_state,
        'created_at',conversation.created_at,
        'last_activity_at',conversation.last_activity_at
      )
      from messaging.conversations conversation
      where conversation.id=p_conversation_id
    ),
    'participants',(
      select jsonb_agg(
        messaging.participant_identity_json(
          participant.actor_kind,
          participant.person_resource_id,
          participant.actor_key
        ) || jsonb_build_object(
          'membership_status',participant.membership_status
        )
        order by participant.joined_at,participant.id
      )
      from messaging.conversation_participants participant
      where participant.conversation_id=p_conversation_id
    ),
    'messages',coalesce((
      select jsonb_agg(message_json order by accepted_at desc,message_id desc)
      from (
        select
          message.id as message_id,
          message.accepted_at,
          jsonb_build_object(
            'id',message.id,
            'message_kind',message.message_kind,
            'body',message.body,
            'accepted_at',message.accepted_at,
            'client_created_at',message.client_created_at,
            'sender',messaging.participant_identity_json(
              sender.actor_kind,
              sender.person_resource_id,
              sender.actor_key
            ),
            'sender_actor_kind',sender.actor_kind,
            'sender_person_resource_id',sender.person_resource_id,
            'sender_actor_key',sender.actor_key,
            'my_read_at',my_receipt.read_at,
            'recipient_read_at',case
              when sender.id=mine.id then (
                select case
                  when coalesce(
                    policy.show_read_receipts,
                    messaging.default_show_read_receipts(
                      messaging.user_sender_category(me.user_id)
                    )
                  ) then recipient_receipt.read_at
                  else null
                end
                from messaging.message_receipts recipient_receipt
                join messaging.conversation_participants recipient
                  on recipient.id=recipient_receipt.participant_id
                left join messaging.user_sender_policies policy
                  on policy.user_id=recipient.user_id
                 and policy.sender_category=messaging.user_sender_category(me.user_id)
                where recipient_receipt.message_id=message.id
                  and recipient.id<>mine.id
                order by recipient.id
                limit 1
              )
              else null
            end,
            'resource_references',coalesce((
              select jsonb_agg(
                jsonb_build_object(
                  'resource_id',reference.resource_id,
                  'resource_version_id',reference.resource_version_id,
                  'presentation_kind',reference.presentation_kind
                )
                order by reference.created_at,reference.id
              )
              from messaging.message_resource_references reference
              where reference.message_id=message.id
                and messaging.can_user_reference_resource(
                  me.user_id,
                  reference.resource_id,
                  reference.resource_version_id
                )
            ),'[]'::jsonb)
          ) as message_json
        from messaging.messages message
        join messaging.conversation_participants sender
          on sender.id=message.sender_participant_id
        left join messaging.message_receipts my_receipt
          on my_receipt.message_id=message.id
         and my_receipt.participant_id=mine.id
        where message.conversation_id=p_conversation_id
          and not exists (
            select 1
            from messaging.message_quarantine quarantine
            where quarantine.message_id=message.id
              and quarantine.status='active'
          )
          and (
            p_before_accepted_at is null
            or (message.accepted_at,message.id)<(
              p_before_accepted_at,
              coalesce(
                p_before_message_id,
                'ffffffff-ffff-ffff-ffff-ffffffffffff'::uuid
              )
            )
          )
        order by message.accepted_at desc,message.id desc
        limit limit_value
      ) page
    ),'[]'::jsonb)
  );
end
$$;

revoke all on function public.report_message_safety_v1(uuid,text,text,text,uuid)
from public,anon;
revoke all on function public.list_messages_safety_cases_v1(text,timestamptz,uuid,integer)
from public,anon;
revoke all on function public.get_messages_safety_case_v1(uuid)
from public,anon;
revoke all on function public.start_messages_safety_review_v1(uuid,text,uuid)
from public,anon;
revoke all on function public.set_message_quarantine_v1(uuid,uuid,boolean,text,text,uuid)
from public,anon;
revoke all on function public.resolve_message_safety_case_v1(uuid,text,text,text,uuid)
from public,anon;
revoke all on function public.inspect_message_safety_evidence_v1(uuid,uuid,text,text,uuid)
from public,anon;

revoke all on function public.mark_my_message_conversation_read(uuid,uuid)
from public,anon;
revoke all on function public.get_my_message_unread_counts()
from public,anon;
revoke all on function public.list_my_message_conversations(text,timestamptz,uuid,integer)
from public,anon;
revoke all on function public.get_my_message_conversation(uuid,timestamptz,uuid,integer)
from public,anon;

grant execute on function public.report_message_safety_v1(uuid,text,text,text,uuid)
to authenticated;
grant execute on function public.list_messages_safety_cases_v1(text,timestamptz,uuid,integer)
to authenticated;
grant execute on function public.get_messages_safety_case_v1(uuid)
to authenticated;
grant execute on function public.start_messages_safety_review_v1(uuid,text,uuid)
to authenticated;
grant execute on function public.set_message_quarantine_v1(uuid,uuid,boolean,text,text,uuid)
to authenticated;
grant execute on function public.resolve_message_safety_case_v1(uuid,text,text,text,uuid)
to authenticated;
grant execute on function public.inspect_message_safety_evidence_v1(uuid,uuid,text,text,uuid)
to authenticated;

grant execute on function public.mark_my_message_conversation_read(uuid,uuid)
to authenticated;
grant execute on function public.get_my_message_unread_counts()
to authenticated;
grant execute on function public.list_my_message_conversations(text,timestamptz,uuid,integer)
to authenticated;
grant execute on function public.get_my_message_conversation(uuid,timestamptz,uuid,integer)
to authenticated;

comment on table messaging.safety_cases is
  'Private Messages Safety Case identity and current review/disposition summary. Peer authority; never a Message or Media body store.';
comment on table messaging.safety_case_targets is
  'Immutable exact target bindings from a Safety Case to canonical Message or Media file identity.';
comment on table messaging.safety_case_events is
  'Append-only Safety Case chronology including deliberate evidence inspection events.';
comment on table messaging.message_quarantine is
  'Historical exact-Message quarantine placements. Active rows suppress ordinary projection without rewriting canonical Message history.';
comment on function public.inspect_message_safety_evidence_v1(uuid,uuid,text,text,uuid) is
  'Super Admin-only exact Message evidence inspection. Logs an immutable evidence_viewed event before returning the targeted Message body; never returns adjacent Conversation history.';

commit;
