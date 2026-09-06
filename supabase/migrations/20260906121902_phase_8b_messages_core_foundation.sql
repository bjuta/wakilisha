begin;

set local statement_timeout = '180s';
set local lock_timeout = '5s';

select pg_catalog.pg_advisory_xact_lock(
  pg_catalog.hashtextextended('phase-8b-messages-core-foundation', 0)
);

do $preflight$
begin
  if to_regnamespace('messaging') is not null
     or to_regclass('messaging.conversations') is not null
     or to_regclass('messaging.conversation_participants') is not null
     or to_regclass('messaging.messages') is not null
     or to_regclass('messaging.message_receipts') is not null
     or to_regclass('messaging.message_resource_references') is not null
     or to_regclass('messaging.user_sender_policies') is not null
     or to_regclass('messaging.sender_approvals') is not null
     or to_regclass('messaging.runtime_policy') is not null
  then
    raise exception 'STOP: Messages core authority already exists';
  end if;

  if to_regclass('public.role_definitions') is null
     or to_regclass('public.capability_definitions') is null
     or to_regclass('public.role_capabilities') is null
     or to_regclass('public.user_role_assignments') is null
     or to_regclass('public.user_profiles') is null
     or to_regclass('editorial.people') is null
     or to_regclass('editorial.resources') is null
     or to_regclass('editorial.resource_versions') is null
  then
    raise exception 'STOP: required identity, authorization, or Resource authority is incomplete';
  end if;

  if not exists (
    select 1 from public.role_definitions where role_key = 'administrator'
  ) then
    raise exception 'STOP: administrator role authority is missing';
  end if;

  if exists (
    select 1 from public.role_definitions where role_key = 'super_admin'
  ) then
    raise exception 'STOP: super_admin role already exists';
  end if;

  if exists (
    select 1 from public.capability_definitions
    where capability_key = 'manage_messages_control_center'
  ) then
    raise exception 'STOP: Messages Control Center capability already exists';
  end if;
end;
$preflight$;

create temporary table phase_8b_messages_core_baseline
on commit drop
as
select
  (select count(*) from public.user_role_assignments) as assignment_count,
  (select count(*) from editorial.resources) as resource_count,
  (select count(*) from editorial.resource_versions) as resource_version_count,
  (select count(*) from public.role_capabilities where role_key='administrator') as administrator_capability_count;

insert into public.role_definitions (
  role_key, label, description, priority, is_system
)
values (
  'super_admin',
  'Super Admin',
  'Highest-trust WAKILISHA operator role for explicitly restricted platform control surfaces. Assignment is always explicit.',
  1,
  true
);

insert into public.capability_definitions (
  capability_key, label, description, domain
)
values (
  'manage_messages_control_center',
  'Manage Messages Control Center',
  'Access and operate the Super Admin-only Messages control center and its governed platform controls.',
  'messages'
);

insert into public.role_capabilities (role_key, capability_key)
select 'super_admin', capability_key
from public.role_capabilities
where role_key = 'administrator';

insert into public.role_capabilities (role_key, capability_key)
values ('super_admin', 'manage_messages_control_center');

create schema messaging;

revoke all on schema messaging from public, anon, authenticated, service_role;

create table messaging.conversations (
  id uuid primary key default gen_random_uuid(),
  conversation_kind text not null default 'direct'
    check (conversation_kind in ('direct')),
  security_classification text not null default 'standard'
    check (security_classification in ('standard','restricted','confidential')),
  status text not null default 'active'
    check (status in ('active','closed')),
  created_by_participant_id uuid,
  created_at timestamptz not null default now(),
  last_activity_at timestamptz not null default now(),
  correlation_id uuid,
  constraint conversations_activity_time_check
    check (last_activity_at >= created_at)
);

create table messaging.conversation_participants (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null
    references messaging.conversations(id)
    on update restrict
    on delete restrict,
  actor_kind text not null
    check (actor_kind in ('human','system','automation')),
  person_resource_id uuid
    references editorial.people(resource_id)
    on update restrict
    on delete restrict,
  user_id uuid
    references auth.users(id)
    on update restrict
    on delete set null,
  actor_key text,
  membership_status text not null default 'active'
    check (membership_status in ('active','left')),
  mailbox_folder text not null default 'inbox'
    check (mailbox_folder in ('inbox','requests','spam','archived')),
  first_contact_state text not null default 'not_applicable'
    check (first_contact_state in ('not_applicable','pending','accepted','declined')),
  joined_at timestamptz not null default now(),
  left_at timestamptz,
  mailbox_updated_at timestamptz not null default now(),
  constraint conversation_participants_actor_shape_check
    check (
      (
        actor_kind = 'human'
        and person_resource_id is not null
        and actor_key is null
      )
      or
      (
        actor_kind in ('system','automation')
        and person_resource_id is null
        and user_id is null
        and actor_key is not null
        and actor_key ~ '^[a-z][a-z0-9_.:-]{1,99}$'
      )
    ),
  constraint conversation_participants_membership_time_check
    check (
      (membership_status='active' and left_at is null)
      or (membership_status='left' and left_at is not null and left_at >= joined_at)
    ),
  constraint conversation_participants_request_folder_check
    check (
      first_contact_state <> 'pending'
      or mailbox_folder in ('requests','spam')
    ),
  constraint conversation_participants_id_conversation_key
    unique (id, conversation_id)
);

create unique index conversation_participants_human_identity_key
on messaging.conversation_participants (conversation_id, person_resource_id)
where actor_kind='human';

create unique index conversation_participants_actor_key_key
on messaging.conversation_participants (conversation_id, actor_kind, actor_key)
where actor_kind in ('system','automation');

create index conversation_participants_user_mailbox_idx
on messaging.conversation_participants (user_id, mailbox_folder, mailbox_updated_at desc, id desc)
where user_id is not null;

alter table messaging.conversations
  add constraint conversations_creator_participant_fkey
  foreign key (created_by_participant_id, id)
  references messaging.conversation_participants(id, conversation_id)
  on update restrict
  on delete restrict
  deferrable initially deferred;

create table messaging.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null
    references messaging.conversations(id)
    on update restrict
    on delete restrict,
  sender_participant_id uuid not null,
  message_kind text not null default 'text'
    check (message_kind in ('text','system_event')),
  body text,
  accepted_at timestamptz not null default now(),
  client_created_at timestamptz,
  correlation_id uuid,
  command_receipt_id uuid,
  constraint messages_body_shape_check
    check (
      (message_kind='text' and nullif(btrim(coalesce(body,'')), '') is not null and octet_length(body) <= 10000)
      or
      (message_kind='system_event' and (body is null or octet_length(body) <= 10000))
    ),
  constraint messages_sender_conversation_fkey
    foreign key (sender_participant_id, conversation_id)
    references messaging.conversation_participants(id, conversation_id)
    on update restrict
    on delete restrict,
  constraint messages_id_conversation_key
    unique (id, conversation_id)
);

create index messages_conversation_chronology_idx
on messaging.messages (conversation_id, accepted_at desc, id desc);

create table messaging.message_receipts (
  message_id uuid not null,
  participant_id uuid not null,
  conversation_id uuid not null,
  delivery_state text not null default 'pending'
    check (delivery_state in ('pending','delivered')),
  delivered_at timestamptz,
  read_at timestamptz,
  primary key (message_id, participant_id),
  constraint message_receipts_message_conversation_fkey
    foreign key (message_id, conversation_id)
    references messaging.messages(id, conversation_id)
    on update restrict
    on delete restrict,
  constraint message_receipts_participant_conversation_fkey
    foreign key (participant_id, conversation_id)
    references messaging.conversation_participants(id, conversation_id)
    on update restrict
    on delete restrict,
  constraint message_receipts_delivery_time_check
    check (
      (delivery_state='pending' and delivered_at is null and read_at is null)
      or
      (delivery_state='delivered' and delivered_at is not null and (read_at is null or read_at >= delivered_at))
    )
);

create index message_receipts_participant_unread_idx
on messaging.message_receipts (participant_id, delivery_state, message_id)
where read_at is null;

create table messaging.message_resource_references (
  id uuid primary key default gen_random_uuid(),
  message_id uuid not null
    references messaging.messages(id)
    on update restrict
    on delete restrict,
  resource_id uuid not null
    references editorial.resources(id)
    on update restrict
    on delete restrict,
  resource_version_id uuid,
  presentation_kind text not null
    check (presentation_kind in ('resource','version')),
  created_at timestamptz not null default now(),
  constraint message_resource_references_shape_check
    check (
      (presentation_kind='resource' and resource_version_id is null)
      or
      (presentation_kind='version' and resource_version_id is not null)
    ),
  constraint message_resource_references_version_fkey
    foreign key (resource_id, resource_version_id)
    references editorial.resource_versions(resource_id, id)
    on update restrict
    on delete restrict
);

create unique index message_resource_references_resource_identity_key
on messaging.message_resource_references (message_id, resource_id)
where presentation_kind='resource';

create unique index message_resource_references_version_identity_key
on messaging.message_resource_references (message_id, resource_id, resource_version_id)
where presentation_kind='version';

create index message_resource_references_resource_idx
on messaging.message_resource_references (resource_id, resource_version_id, message_id);

create table messaging.user_sender_policies (
  user_id uuid not null
    references auth.users(id)
    on update restrict
    on delete cascade,
  sender_category text not null
    check (sender_category in ('staff','system','contributors','members','public')),
  first_contact_disposition text not null
    check (first_contact_disposition in ('inbox','requests','reject')),
  allow_links boolean not null default false,
  allow_media boolean not null default false,
  allow_resource_references boolean not null default false,
  show_read_receipts boolean not null default false,
  updated_at timestamptz not null default now(),
  revision bigint not null default 1 check (revision >= 1),
  primary key (user_id, sender_category)
);

create table messaging.sender_approvals (
  id uuid primary key default gen_random_uuid(),
  recipient_person_resource_id uuid not null
    references editorial.people(resource_id)
    on update restrict
    on delete restrict,
  recipient_user_id uuid
    references auth.users(id)
    on update restrict
    on delete set null,
  sender_actor_kind text not null
    check (sender_actor_kind in ('human','system','automation')),
  sender_person_resource_id uuid
    references editorial.people(resource_id)
    on update restrict
    on delete restrict,
  sender_actor_key text,
  status text not null default 'active'
    check (status in ('active','revoked')),
  approved_at timestamptz not null default now(),
  revoked_at timestamptz,
  created_from_conversation_id uuid
    references messaging.conversations(id)
    on update restrict
    on delete restrict,
  updated_at timestamptz not null default now(),
  constraint sender_approvals_actor_shape_check
    check (
      (
        sender_actor_kind='human'
        and sender_person_resource_id is not null
        and sender_actor_key is null
      )
      or
      (
        sender_actor_kind in ('system','automation')
        and sender_person_resource_id is null
        and sender_actor_key is not null
        and sender_actor_key ~ '^[a-z][a-z0-9_.:-]{1,99}$'
      )
    ),
  constraint sender_approvals_not_self_check
    check (
      sender_actor_kind <> 'human'
      or sender_person_resource_id <> recipient_person_resource_id
    ),
  constraint sender_approvals_status_time_check
    check (
      (status='active' and revoked_at is null)
      or (status='revoked' and revoked_at is not null and revoked_at >= approved_at)
    )
);

create unique index sender_approvals_human_identity_key
on messaging.sender_approvals (recipient_person_resource_id, sender_person_resource_id)
where sender_actor_kind='human';

create unique index sender_approvals_actor_key_key
on messaging.sender_approvals (recipient_person_resource_id, sender_actor_kind, sender_actor_key)
where sender_actor_kind in ('system','automation');

create table messaging.runtime_policy (
  singleton boolean primary key default true check (singleton),
  audience_mode text not null default 'internal'
    check (audience_mode in ('internal','contributors','members','public')),
  revision bigint not null default 1 check (revision >= 1),
  updated_by uuid
    references auth.users(id)
    on update restrict
    on delete set null,
  updated_at timestamptz not null default now()
);

insert into messaging.runtime_policy (singleton, audience_mode, revision)
values (true, 'internal', 1);

create or replace function messaging.reject_immutable_message_mutation()
returns trigger
language plpgsql
set search_path = pg_catalog
as $$
begin
  raise exception 'Messages and Message Resource references are immutable.';
end;
$$;

revoke all on function messaging.reject_immutable_message_mutation()
from public, anon, authenticated, service_role;

create trigger messages_immutable
before update or delete on messaging.messages
for each row execute function messaging.reject_immutable_message_mutation();

create trigger message_resource_references_immutable
before update or delete on messaging.message_resource_references
for each row execute function messaging.reject_immutable_message_mutation();

alter table messaging.conversations enable row level security;
alter table messaging.conversation_participants enable row level security;
alter table messaging.messages enable row level security;
alter table messaging.message_receipts enable row level security;
alter table messaging.message_resource_references enable row level security;
alter table messaging.user_sender_policies enable row level security;
alter table messaging.sender_approvals enable row level security;
alter table messaging.runtime_policy enable row level security;

revoke all on all tables in schema messaging from public, anon, authenticated, service_role;
revoke all on all sequences in schema messaging from public, anon, authenticated, service_role;

create or replace function messaging.verify_core_foundation()
returns jsonb
language plpgsql
stable
security invoker
set search_path = pg_catalog, public, editorial, messaging
as $$
declare
  v_admin_capabilities bigint;
  v_super_capabilities bigint;
  v_missing_admin_capabilities bigint;
  v_super_assignments bigint;
  v_policy_count bigint;
begin
  select count(*) into v_admin_capabilities
  from public.role_capabilities
  where role_key='administrator';

  select count(*) into v_super_capabilities
  from public.role_capabilities
  where role_key='super_admin';

  select count(*) into v_missing_admin_capabilities
  from public.role_capabilities admin_cap
  where admin_cap.role_key='administrator'
    and not exists (
      select 1
      from public.role_capabilities super_cap
      where super_cap.role_key='super_admin'
        and super_cap.capability_key=admin_cap.capability_key
    );

  select count(*) into v_super_assignments
  from public.user_role_assignments
  where role_key='super_admin';

  select count(*) into v_policy_count
  from messaging.runtime_policy;

  if v_missing_admin_capabilities <> 0 then
    raise exception 'STOP: super_admin is missing % administrator capability/capabilities', v_missing_admin_capabilities;
  end if;

  if not exists (
    select 1 from public.role_capabilities
    where role_key='super_admin'
      and capability_key='manage_messages_control_center'
  ) then
    raise exception 'STOP: super_admin lacks Messages Control Center capability';
  end if;

  if exists (
    select 1 from public.role_capabilities
    where capability_key='manage_messages_control_center'
      and role_key <> 'super_admin'
  ) then
    raise exception 'STOP: Messages Control Center capability leaked beyond super_admin';
  end if;

  if v_super_assignments <> 0 then
    raise exception 'STOP: structural Messages migration unexpectedly assigned super_admin';
  end if;

  if v_policy_count <> 1
     or not exists (
       select 1 from messaging.runtime_policy
       where singleton and audience_mode='internal' and revision=1
     ) then
    raise exception 'STOP: Messages runtime policy singleton is invalid';
  end if;

  if exists (
    select 1
    from information_schema.table_privileges
    where table_schema='messaging'
      and grantee in ('anon','authenticated')
  ) then
    raise exception 'STOP: browser role has direct Messages table privilege';
  end if;

  return jsonb_build_object(
    'ok', true,
    'administrator_capabilities', v_admin_capabilities,
    'super_admin_capabilities', v_super_capabilities,
    'super_admin_assignments', v_super_assignments,
    'audience_mode', 'internal'
  );
end;
$$;

revoke all on function messaging.verify_core_foundation()
from public, anon, authenticated, service_role;

select messaging.verify_core_foundation();

do $postflight$
declare
  v_baseline record;
begin
  select * into v_baseline from phase_8b_messages_core_baseline;

  if (select count(*) from public.user_role_assignments) <> v_baseline.assignment_count then
    raise exception 'STOP: Messages structural migration changed user role assignments';
  end if;

  if (select count(*) from editorial.resources) <> v_baseline.resource_count
     or (select count(*) from editorial.resource_versions) <> v_baseline.resource_version_count then
    raise exception 'STOP: Messages structural migration changed Resource authority';
  end if;

  if (select count(*) from public.role_capabilities where role_key='super_admin')
     <> v_baseline.administrator_capability_count + 1 then
    raise exception 'STOP: super_admin capability cardinality is invalid';
  end if;
end;
$postflight$;

commit;