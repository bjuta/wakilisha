-- QPR4A Publishing workspace authority foundation.
--
-- Publishing owns operational planning, assignments, channels, and event
-- history. Canonical content and editorial authority remain governed by
-- editorial.resources and resource-specific lifecycle RPCs.

begin;

do $publishing_foundation_preflight$
begin
  if to_regclass('editorial.resources') is null then
    raise exception 'STOP: editorial.resources does not exist';
  end if;

  if to_regclass('editorial.resource_kinds') is null then
    raise exception 'STOP: editorial.resource_kinds does not exist';
  end if;

  if to_regclass('public.user_profiles') is null then
    raise exception 'STOP: public.user_profiles does not exist';
  end if;

  if to_regclass('public.capability_definitions') is null then
    raise exception 'STOP: public.capability_definitions does not exist';
  end if;

  if to_regclass('public.role_capabilities') is null then
    raise exception 'STOP: public.role_capabilities does not exist';
  end if;

  if to_regprocedure(
    'public.current_user_has_capability(text)'
  ) is null then
    raise exception
      'STOP: current_user_has_capability does not exist';
  end if;

  if to_regprocedure(
    'public.current_user_is_administrator()'
  ) is null then
    raise exception
      'STOP: current_user_is_administrator does not exist';
  end if;

  if to_regclass(
    'editorial.article_scheduled_publications'
  ) is null then
    raise exception
      'STOP: governed Article scheduling authority does not exist';
  end if;

  if to_regclass(
    'editorial.article_lifecycle_events'
  ) is null then
    raise exception
      'STOP: governed Article lifecycle authority does not exist';
  end if;
end;
$publishing_foundation_preflight$;

insert into public.capability_definitions (
  capability_key,
  label,
  domain,
  description
)
values (
  'manage_publishing',
  'Manage publishing',
  'content',
  'Create and manage operational Publishing records, assignments, channels, and plans.'
)
on conflict (capability_key)
do update set
  label = excluded.label,
  domain = excluded.domain,
  description = excluded.description,
  updated_at = now();

insert into public.role_capabilities (
  role_key,
  capability_key
)
values
  ('administrator', 'manage_publishing'),
  ('editor', 'manage_publishing')
on conflict (role_key, capability_key)
do nothing;

create table editorial.publishing_content_kinds (
  kind text primary key,
  label text not null,
  description text not null,
  canonical_resource_kind text
    references editorial.resource_kinds(kind)
    on update cascade
    on delete restrict,
  enabled boolean not null default true,
  sort_order integer not null default 100,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint publishing_content_kinds_key_check
    check (kind ~ '^[a-z][a-z0-9_]*$'),

  constraint publishing_content_kinds_label_check
    check (nullif(btrim(label), '') is not null)
);

comment on table editorial.publishing_content_kinds is
  'Controlled operational content kinds used by the Publishing workspace.';

create table editorial.publishing_channels (
  channel_key text primary key,
  label text not null,
  description text not null,
  enabled boolean not null default true,
  sort_order integer not null default 100,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint publishing_channels_key_check
    check (channel_key ~ '^[a-z][a-z0-9_]*$'),

  constraint publishing_channels_label_check
    check (nullif(btrim(label), '') is not null)
);

comment on table editorial.publishing_channels is
  'Controlled destinations used to plan and track Publishing distribution.';

create table editorial.publishing_items (
  id uuid primary key default gen_random_uuid(),

  resource_id uuid
    references editorial.resources(id)
    on update cascade
    on delete restrict,

  title text not null,

  content_kind text not null
    references editorial.publishing_content_kinds(kind)
    on update cascade
    on delete restrict,

  brief text,

  production_stage text not null default 'idea',

  planning_state text not null default 'active',

  priority text not null default 'normal',

  owner_id uuid
    references auth.users(id)
    on delete set null,

  production_deadline timestamptz,

  planned_publish_at timestamptz,

  record_version bigint not null default 1,

  created_by uuid default auth.uid()
    references auth.users(id)
    on delete set null,

  updated_by uuid default auth.uid()
    references auth.users(id)
    on delete set null,

  created_at timestamptz not null default now(),

  updated_at timestamptz not null default now(),

  constraint publishing_items_title_check
    check (nullif(btrim(title), '') is not null),

  constraint publishing_items_production_stage_check
    check (
      production_stage in (
        'idea',
        'assigned',
        'producing',
        'production_review',
        'revisions',
        'ready'
      )
    ),

  constraint publishing_items_planning_state_check
    check (
      planning_state in (
        'active',
        'paused',
        'dropped',
        'archived'
      )
    ),

  constraint publishing_items_priority_check
    check (
      priority in (
        'low',
        'normal',
        'high',
        'urgent'
      )
    ),

  constraint publishing_items_record_version_check
    check (record_version > 0)
);

comment on table editorial.publishing_items is
  'Operational Publishing records linked optionally to canonical resources.';

comment on column editorial.publishing_items.planned_publish_at is
  'Operational intent only. For linked Articles, governed Article scheduling remains authoritative.';

comment on column editorial.publishing_items.record_version is
  'Monotonic optimistic-concurrency version required by every Publishing mutation RPC.';

create unique index publishing_items_one_open_resource_idx
  on editorial.publishing_items(resource_id)
  where resource_id is not null
    and planning_state <> 'archived';

create index publishing_items_stage_idx
  on editorial.publishing_items(
    production_stage,
    planning_state,
    updated_at desc
  );

create index publishing_items_owner_idx
  on editorial.publishing_items(owner_id)
  where owner_id is not null;

create index publishing_items_deadline_idx
  on editorial.publishing_items(production_deadline)
  where production_deadline is not null
    and planning_state = 'active';

create index publishing_items_publish_plan_idx
  on editorial.publishing_items(planned_publish_at)
  where planned_publish_at is not null
    and planning_state = 'active';

create table editorial.publishing_item_assignees (
  item_id uuid not null
    references editorial.publishing_items(id)
    on update cascade
    on delete cascade,

  user_id uuid not null
    references auth.users(id)
    on delete cascade,

  assignment_role text not null,

  assigned_by uuid default auth.uid()
    references auth.users(id)
    on delete set null,

  created_at timestamptz not null default now(),

  primary key (
    item_id,
    user_id,
    assignment_role
  ),

  constraint publishing_item_assignees_role_check
    check (
      assignment_role in (
        'owner',
        'editor',
        'writer',
        'producer',
        'designer',
        'photographer',
        'video',
        'social',
        'reviewer',
        'other'
      )
    )
);

comment on table editorial.publishing_item_assignees is
  'Internal operational assignments. These records are not public credits.';

create index publishing_item_assignees_user_idx
  on editorial.publishing_item_assignees(
    user_id,
    created_at desc
  );

create table editorial.publishing_item_channels (
  item_id uuid not null
    references editorial.publishing_items(id)
    on update cascade
    on delete cascade,

  channel_key text not null
    references editorial.publishing_channels(channel_key)
    on update cascade
    on delete restrict,

  is_primary boolean not null default false,

  created_by uuid default auth.uid()
    references auth.users(id)
    on delete set null,

  created_at timestamptz not null default now(),

  primary key (
    item_id,
    channel_key
  )
);

comment on table editorial.publishing_item_channels is
  'Controlled distribution destinations attached to a Publishing item.';

create unique index publishing_item_channels_one_primary_idx
  on editorial.publishing_item_channels(item_id)
  where is_primary;

create table editorial.publishing_item_events (
  id uuid primary key default gen_random_uuid(),

  item_id uuid not null
    references editorial.publishing_items(id)
    on update cascade
    on delete restrict,

  action text not null,

  prior_record_version bigint not null,

  resulting_record_version bigint not null,

  prior_values jsonb not null default '{}'::jsonb,

  resulting_values jsonb not null default '{}'::jsonb,

  note text,

  metadata jsonb not null default '{}'::jsonb,

  actor_id uuid default auth.uid()
    references auth.users(id)
    on delete set null,

  created_at timestamptz not null default now(),

  constraint publishing_item_events_action_check
    check (
      action in (
        'created',
        'details_updated',
        'production_stage_changed',
        'planning_state_changed',
        'resource_linked',
        'assignee_added',
        'assignee_removed',
        'channel_added',
        'channel_removed'
      )
    ),

  constraint publishing_item_events_version_check
    check (
      (
        action = 'created'
        and prior_record_version = 0
        and resulting_record_version = 1
      )
      or (
        action <> 'created'
        and prior_record_version >= 1
        and resulting_record_version =
          prior_record_version + 1
      )
    )
);

comment on table editorial.publishing_item_events is
  'Append-only operational history for Publishing item changes.';

create index publishing_item_events_item_idx
  on editorial.publishing_item_events(
    item_id,
    created_at desc
  );

create or replace function
  editorial.current_user_can_manage_publishing()
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public
as $function$
  select
    auth.role() = 'service_role'
    or coalesce(
      public.current_user_is_administrator(),
      false
    )
    or coalesce(
      public.current_user_has_capability(
        'manage_publishing'
      ),
      false
    );
$function$;

revoke all on function
  editorial.current_user_can_manage_publishing()
from public, anon;

grant execute on function
  editorial.current_user_can_manage_publishing()
to authenticated, service_role;

create or replace function
  editorial.current_user_can_view_publishing_item(
    p_item_id uuid
  )
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public, editorial
as $function$
  select
    auth.role() = 'service_role'
    or editorial.current_user_can_manage_publishing()
    or coalesce(
      public.current_user_has_capability(
        'view_publishing_dashboard'
      ),
      false
    )
    or exists (
      select 1
      from editorial.publishing_items item
      where item.id = p_item_id
        and (
          item.owner_id = auth.uid()
          or item.created_by = auth.uid()
          or exists (
            select 1
            from editorial.publishing_item_assignees assignee
            where assignee.item_id = item.id
              and assignee.user_id = auth.uid()
          )
        )
    );
$function$;

revoke all on function
  editorial.current_user_can_view_publishing_item(uuid)
from public, anon;

grant execute on function
  editorial.current_user_can_view_publishing_item(uuid)
to authenticated, service_role;

create or replace function
  editorial.assert_publishing_item_integrity()
returns trigger
language plpgsql
security invoker
set search_path = pg_catalog, editorial
as $function$
declare
  v_expected_resource_kind text;
  v_actual_resource_kind text;
begin
  if tg_op = 'UPDATE' then
    if new.id is distinct from old.id
       or new.created_by is distinct from old.created_by
       or new.created_at is distinct from old.created_at
    then
      raise exception
        'Publishing item identity and creation metadata are immutable';
    end if;

    if old.resource_id is not null
       and new.resource_id is distinct from old.resource_id
    then
      raise exception
        'A linked Publishing item cannot be unlinked or retargeted';
    end if;

    if new.record_version <> old.record_version + 1 then
      raise exception
        'Publishing item record_version must advance by exactly one';
    end if;
  end if;

  select kind.canonical_resource_kind
  into v_expected_resource_kind
  from editorial.publishing_content_kinds kind
  where kind.kind = new.content_kind
    and kind.enabled = true;

  if not found then
    raise exception
      'Publishing content kind is missing or disabled';
  end if;

  if new.resource_id is not null then
    if v_expected_resource_kind is null then
      raise exception
        'This Publishing content kind cannot link a canonical resource';
    end if;

    select resource.resource_kind
    into v_actual_resource_kind
    from editorial.resources resource
    where resource.id = new.resource_id;

    if not found then
      raise exception
        'Publishing canonical resource does not exist';
    end if;

    if v_actual_resource_kind
       <> v_expected_resource_kind
    then
      raise exception
        'Publishing content kind % requires resource kind %, received %',
        new.content_kind,
        v_expected_resource_kind,
        v_actual_resource_kind;
    end if;
  end if;

  return new;
end;
$function$;

revoke all on function
  editorial.assert_publishing_item_integrity()
from public, anon, authenticated;

create trigger publishing_items_integrity
before insert or update
on editorial.publishing_items
for each row
execute function editorial.assert_publishing_item_integrity();

create or replace function
  editorial.protect_publishing_item_event()
returns trigger
language plpgsql
security invoker
set search_path = pg_catalog
as $function$
begin
  raise exception
    'Publishing item events are append-only';
end;
$function$;

revoke all on function
  editorial.protect_publishing_item_event()
from public, anon, authenticated;

create trigger publishing_item_events_append_only
before update or delete
on editorial.publishing_item_events
for each row
execute function editorial.protect_publishing_item_event();

create or replace function
  editorial.publishing_item_snapshot(
    p_item editorial.publishing_items
  )
returns jsonb
language sql
stable
security invoker
set search_path = pg_catalog
as $function$
  select jsonb_build_object(
    'id', p_item.id,
    'resourceId', p_item.resource_id,
    'title', p_item.title,
    'contentKind', p_item.content_kind,
    'brief', p_item.brief,
    'productionStage', p_item.production_stage,
    'planningState', p_item.planning_state,
    'priority', p_item.priority,
    'ownerId', p_item.owner_id,
    'productionDeadline', p_item.production_deadline,
    'plannedPublishAt', p_item.planned_publish_at,
    'recordVersion', p_item.record_version
  );
$function$;

revoke all on function
  editorial.publishing_item_snapshot(
    editorial.publishing_items
  )
from public, anon, authenticated;

create or replace function
  editorial.derive_publishing_editorial_state(
    p_resource_id uuid
  )
returns text
language plpgsql
stable
security definer
set search_path = pg_catalog, editorial
as $function$
declare
  v_resource editorial.resources%rowtype;
  v_latest_article_action text;
begin
  if p_resource_id is null then
    return 'not_linked';
  end if;

  if not exists (
    select 1
    from editorial.publishing_items item
    where item.resource_id = p_resource_id
      and editorial.current_user_can_view_publishing_item(
        item.id
      )
  ) then
    raise exception
      using
        errcode = '42501',
        message = 'Permission denied';
  end if;

  select resource.*
  into v_resource
  from editorial.resources resource
  where resource.id = p_resource_id;

  if not found then
    return 'not_linked';
  end if;

  if v_resource.resource_kind = 'article' then
    select event.action
    into v_latest_article_action
    from editorial.article_lifecycle_events event
    where event.resource_id = p_resource_id
      and event.action in (
        'submitted',
        'changes_requested',
        'approved',
        'scheduled',
        'published',
        'unpublished',
        'archived',
        'restored'
      )
    order by
      event.created_at desc,
      event.id desc
    limit 1;

    if v_latest_article_action =
       'changes_requested'
    then
      return 'changes_requested';
    end if;
  end if;

  if v_resource.lifecycle_state = 'published'
     and (
       v_resource.resource_kind <> 'article'
       or v_resource.current_published_version_id
          is not null
     )
  then
    return 'published';
  end if;

  if v_resource.current_approved_version_id
     is not null
  then
    return 'approved';
  end if;

  if v_resource.current_submitted_version_id
     is not null
  then
    return 'submitted';
  end if;

  return 'draft';
end;
$function$;

revoke all on function
  editorial.derive_publishing_editorial_state(uuid)
from public, anon;

grant execute on function
  editorial.derive_publishing_editorial_state(uuid)
to authenticated, service_role;

create or replace function
  editorial.derive_publishing_publication_state(
    p_item_id uuid
  )
returns text
language plpgsql
stable
security definer
set search_path = pg_catalog, editorial
as $function$
declare
  v_item editorial.publishing_items%rowtype;
  v_resource editorial.resources%rowtype;
begin
  if not editorial.current_user_can_view_publishing_item(
    p_item_id
  ) then
    raise exception
      using
        errcode = '42501',
        message = 'Permission denied';
  end if;

  select item.*
  into v_item
  from editorial.publishing_items item
  where item.id = p_item_id;

  if not found then
    return 'unscheduled';
  end if;

  if v_item.planning_state = 'archived' then
    return 'archived';
  end if;

  if v_item.planning_state = 'dropped' then
    return 'dropped';
  end if;

  if v_item.planning_state = 'paused' then
    return 'paused';
  end if;

  if v_item.resource_id is null then
    if v_item.planned_publish_at is not null then
      return 'scheduled';
    end if;

    return 'unscheduled';
  end if;

  select resource.*
  into v_resource
  from editorial.resources resource
  where resource.id = v_item.resource_id;

  if not found then
    return 'unscheduled';
  end if;

  if v_resource.lifecycle_state = 'published'
     and (
       v_resource.resource_kind <> 'article'
       or v_resource.current_published_version_id
          is not null
     )
  then
    return 'published';
  end if;

  if v_resource.resource_kind = 'article' then
    if exists (
      select 1
      from editorial.article_scheduled_publications schedule
      where schedule.resource_id = v_resource.id
        and schedule.status = 'scheduled'
    ) then
      return 'scheduled';
    end if;

    return 'unscheduled';
  end if;

  if v_item.planned_publish_at is not null then
    return 'scheduled';
  end if;

  return 'unscheduled';
end;
$function$;

revoke all on function
  editorial.derive_publishing_publication_state(uuid)
from public, anon;

grant execute on function
  editorial.derive_publishing_publication_state(uuid)
to authenticated, service_role;

alter table editorial.publishing_content_kinds
  enable row level security;

alter table editorial.publishing_channels
  enable row level security;

alter table editorial.publishing_items
  enable row level security;

alter table editorial.publishing_item_assignees
  enable row level security;

alter table editorial.publishing_item_channels
  enable row level security;

alter table editorial.publishing_item_events
  enable row level security;

create policy publishing_content_kinds_authenticated_read
on editorial.publishing_content_kinds
for select
to authenticated
using (auth.uid() is not null);

create policy publishing_channels_authenticated_read
on editorial.publishing_channels
for select
to authenticated
using (auth.uid() is not null);

create policy publishing_items_authorized_read
on editorial.publishing_items
for select
to authenticated
using (
  editorial.current_user_can_view_publishing_item(id)
);

create policy publishing_item_assignees_authorized_read
on editorial.publishing_item_assignees
for select
to authenticated
using (
  editorial.current_user_can_view_publishing_item(
    item_id
  )
);

create policy publishing_item_channels_authorized_read
on editorial.publishing_item_channels
for select
to authenticated
using (
  editorial.current_user_can_view_publishing_item(
    item_id
  )
);

create policy publishing_item_events_authorized_read
on editorial.publishing_item_events
for select
to authenticated
using (
  editorial.current_user_can_view_publishing_item(
    item_id
  )
);

revoke all
on editorial.publishing_content_kinds,
   editorial.publishing_channels,
   editorial.publishing_items,
   editorial.publishing_item_assignees,
   editorial.publishing_item_channels,
   editorial.publishing_item_events
from public, anon, authenticated;

grant select
on editorial.publishing_content_kinds,
   editorial.publishing_channels,
   editorial.publishing_items,
   editorial.publishing_item_assignees,
   editorial.publishing_item_channels,
   editorial.publishing_item_events
to authenticated;

grant all
on editorial.publishing_content_kinds,
   editorial.publishing_channels,
   editorial.publishing_items,
   editorial.publishing_item_assignees,
   editorial.publishing_item_channels,
   editorial.publishing_item_events
to service_role;

insert into editorial.publishing_content_kinds (
  kind,
  label,
  description,
  canonical_resource_kind,
  sort_order
)
values
  (
    'article',
    'Article',
    'Magazine, editorial, or cultural writing governed by the Article editor.',
    'article',
    10
  ),
  (
    'guide',
    'Guide',
    'Structured evergreen or practical editorial guidance.',
    null,
    20
  ),
  (
    'playlist',
    'Playlist',
    'Editorial music selection governed by the Playlist editor.',
    'playlist',
    30
  ),
  (
    'artist_dossier',
    'Artist dossier',
    'A substantial editorial treatment of an artist or collective.',
    null,
    40
  ),
  (
    'interview',
    'Interview',
    'Recorded, written, audio, or video interview work.',
    null,
    50
  ),
  (
    'chart_story',
    'Chart story',
    'Editorial work built around a chart result or chart movement.',
    null,
    60
  ),
  (
    'release_feature',
    'Release feature',
    'Editorial work centred on a release.',
    null,
    70
  ),
  (
    'track_feature',
    'Track feature',
    'Editorial work centred on a track.',
    null,
    80
  ),
  (
    'video',
    'Video',
    'Standalone video production.',
    null,
    90
  ),
  (
    'audio',
    'Audio',
    'Standalone audio production.',
    null,
    100
  ),
  (
    'social_post',
    'Social post',
    'A planned social publishing execution.',
    null,
    110
  ),
  (
    'newsletter',
    'Newsletter',
    'A newsletter issue or newsletter placement.',
    null,
    120
  ),
  (
    'live_coverage',
    'Live coverage',
    'Planned reporting or publishing from a live event.',
    null,
    130
  ),
  (
    'other',
    'Other',
    'Operational Publishing work not covered by another controlled kind.',
    null,
    999
  )
on conflict (kind)
do update set
  label = excluded.label,
  description = excluded.description,
  canonical_resource_kind =
    excluded.canonical_resource_kind,
  sort_order = excluded.sort_order,
  updated_at = now();

insert into editorial.publishing_channels (
  channel_key,
  label,
  description,
  sort_order
)
values
  (
    'website',
    'Website',
    'WAKILISHA public web publishing.',
    10
  ),
  (
    'newsletter',
    'Newsletter',
    'Email newsletter distribution.',
    20
  ),
  (
    'youtube',
    'YouTube',
    'YouTube video distribution.',
    30
  ),
  (
    'instagram',
    'Instagram',
    'Instagram publishing.',
    40
  ),
  (
    'tiktok',
    'TikTok',
    'TikTok publishing.',
    50
  ),
  (
    'facebook',
    'Facebook',
    'Facebook publishing.',
    60
  ),
  (
    'x',
    'X',
    'X publishing.',
    70
  ),
  (
    'linkedin',
    'LinkedIn',
    'LinkedIn publishing.',
    80
  ),
  (
    'audio',
    'Audio',
    'Audio platform distribution.',
    90
  ),
  (
    'other',
    'Other',
    'Another controlled or external distribution destination.',
    999
  )
on conflict (channel_key)
do update set
  label = excluded.label,
  description = excluded.description,
  sort_order = excluded.sort_order,
  updated_at = now();

create or replace view public.wk_publishing_workspace_items
with (
  security_invoker = true,
  security_barrier = true
)
as
select
  item.id,
  item.resource_id,
  resource.resource_kind,
  item.title,
  item.content_kind,
  kind.label as content_kind_label,
  item.brief,
  item.production_stage,
  item.planning_state,
  editorial.derive_publishing_editorial_state(
    item.resource_id
  ) as editorial_state,
  editorial.derive_publishing_publication_state(
    item.id
  ) as publication_state,
  item.priority,
  item.owner_id,
  coalesce(
    owner_profile.display_name,
    item.owner_id::text
  ) as owner_label,
  item.production_deadline,
  item.planned_publish_at,
  item.record_version,
  resource.current_working_version_id,
  resource.current_submitted_version_id,
  resource.current_approved_version_id,
  resource.current_published_version_id,
  coalesce(
    (
      select jsonb_agg(
        jsonb_build_object(
          'userId',
          assignee.user_id,
          'label',
          coalesce(
            assignee_profile.display_name,
            assignee.user_id::text
          ),
          'role',
          assignee.assignment_role,
          'assignedBy',
          assignee.assigned_by,
          'createdAt',
          assignee.created_at
        )
        order by
          assignee.assignment_role,
          assignee.created_at
      )
      from editorial.publishing_item_assignees assignee
      left join public.user_profiles assignee_profile
        on assignee_profile.user_id = assignee.user_id
      where assignee.item_id = item.id
    ),
    '[]'::jsonb
  ) as assignees,
  coalesce(
    (
      select jsonb_agg(
        jsonb_build_object(
          'key',
          item_channel.channel_key,
          'label',
          channel.label,
          'isPrimary',
          item_channel.is_primary,
          'createdAt',
          item_channel.created_at
        )
        order by
          item_channel.is_primary desc,
          channel.sort_order,
          channel.label
      )
      from editorial.publishing_item_channels item_channel
      join editorial.publishing_channels channel
        on channel.channel_key =
          item_channel.channel_key
      where item_channel.item_id = item.id
    ),
    '[]'::jsonb
  ) as channels,
  item.created_by,
  coalesce(
    creator_profile.display_name,
    item.created_by::text
  ) as created_by_label,
  item.updated_by,
  coalesce(
    updater_profile.display_name,
    item.updated_by::text
  ) as updated_by_label,
  item.created_at,
  item.updated_at
from editorial.publishing_items item
join editorial.publishing_content_kinds kind
  on kind.kind = item.content_kind
left join editorial.resources resource
  on resource.id = item.resource_id
left join public.user_profiles owner_profile
  on owner_profile.user_id = item.owner_id
left join public.user_profiles creator_profile
  on creator_profile.user_id = item.created_by
left join public.user_profiles updater_profile
  on updater_profile.user_id = item.updated_by;

revoke all on public.wk_publishing_workspace_items
from public, anon, authenticated;

grant select on public.wk_publishing_workspace_items
to authenticated, service_role;

create or replace function public.create_publishing_item(
  p_title text,
  p_content_kind text,
  p_resource_id uuid default null,
  p_owner_id uuid default null,
  p_brief text default null,
  p_production_stage text default 'idea',
  p_priority text default 'normal',
  p_production_deadline timestamptz default null,
  p_planned_publish_at timestamptz default null,
  p_note text default null
)
returns table (
  item_id uuid,
  record_version bigint
)
language plpgsql
security definer
set search_path = pg_catalog, public, editorial
as $function$
declare
  v_item editorial.publishing_items%rowtype;
begin
  if auth.uid() is null then
    raise exception
      using
        errcode = '42501',
        message = 'Authentication required';
  end if;

  if not editorial.current_user_can_manage_publishing() then
    raise exception
      using
        errcode = '42501',
        message = 'Permission denied';
  end if;

  if nullif(btrim(p_title), '') is null then
    raise exception 'A Publishing item title is required';
  end if;

  insert into editorial.publishing_items (
    resource_id,
    title,
    content_kind,
    brief,
    production_stage,
    priority,
    owner_id,
    production_deadline,
    planned_publish_at,
    created_by,
    updated_by
  )
  values (
    p_resource_id,
    btrim(p_title),
    p_content_kind,
    nullif(btrim(p_brief), ''),
    p_production_stage,
    p_priority,
    coalesce(p_owner_id, auth.uid()),
    p_production_deadline,
    p_planned_publish_at,
    auth.uid(),
    auth.uid()
  )
  returning *
  into v_item;

  insert into editorial.publishing_item_events (
    item_id,
    action,
    prior_record_version,
    resulting_record_version,
    resulting_values,
    note,
    actor_id
  )
  values (
    v_item.id,
    'created',
    0,
    1,
    editorial.publishing_item_snapshot(v_item),
    nullif(btrim(p_note), ''),
    auth.uid()
  );

  item_id := v_item.id;
  record_version := v_item.record_version;
  return next;
end;
$function$;

create or replace function public.update_publishing_item(
  p_item_id uuid,
  p_expected_record_version bigint,
  p_title text,
  p_content_kind text,
  p_owner_id uuid,
  p_brief text,
  p_production_stage text,
  p_planning_state text,
  p_priority text,
  p_production_deadline timestamptz,
  p_planned_publish_at timestamptz,
  p_note text default null
)
returns table (
  item_id uuid,
  record_version bigint
)
language plpgsql
security definer
set search_path = pg_catalog, public, editorial
as $function$
declare
  v_item editorial.publishing_items%rowtype;
  v_updated editorial.publishing_items%rowtype;
  v_action text;
begin
  if auth.uid() is null then
    raise exception
      using
        errcode = '42501',
        message = 'Authentication required';
  end if;

  if not editorial.current_user_can_manage_publishing() then
    raise exception
      using
        errcode = '42501',
        message = 'Permission denied';
  end if;

  select item.*
  into v_item
  from editorial.publishing_items item
  where item.id = p_item_id
  for update;

  if not found then
    raise exception
      using
        errcode = 'P0002',
        message = 'Publishing item not found';
  end if;

  if v_item.record_version
     <> p_expected_record_version
  then
    raise exception
      using
        errcode = '40001',
        message = format(
          'STALE_PUBLISHING_ITEM_VERSION: expected %s, current %s',
          p_expected_record_version,
          v_item.record_version
        );
  end if;

  if nullif(btrim(p_title), '') is null then
    raise exception 'A Publishing item title is required';
  end if;

  if not (
    v_item.title
      is distinct from btrim(p_title)
    or v_item.content_kind
      is distinct from p_content_kind
    or v_item.owner_id
      is distinct from p_owner_id
    or v_item.brief
      is distinct from nullif(btrim(p_brief), '')
    or v_item.production_stage
      is distinct from p_production_stage
    or v_item.planning_state
      is distinct from p_planning_state
    or v_item.priority
      is distinct from p_priority
    or v_item.production_deadline
      is distinct from p_production_deadline
    or v_item.planned_publish_at
      is distinct from p_planned_publish_at
  ) then
    raise exception
      'Publishing item update made no changes';
  end if;

  if v_item.production_stage
       is distinct from p_production_stage
     and v_item.planning_state
       is not distinct from p_planning_state
  then
    v_action := 'production_stage_changed';
  elsif v_item.planning_state
       is distinct from p_planning_state
     and v_item.production_stage
       is not distinct from p_production_stage
  then
    v_action := 'planning_state_changed';
  else
    v_action := 'details_updated';
  end if;

  update editorial.publishing_items item
  set
    title = btrim(p_title),
    content_kind = p_content_kind,
    owner_id = p_owner_id,
    brief = nullif(btrim(p_brief), ''),
    production_stage = p_production_stage,
    planning_state = p_planning_state,
    priority = p_priority,
    production_deadline = p_production_deadline,
    planned_publish_at = p_planned_publish_at,
    record_version = item.record_version + 1,
    updated_by = auth.uid(),
    updated_at = now()
  where item.id = p_item_id
  returning item.*
  into v_updated;

  insert into editorial.publishing_item_events (
    item_id,
    action,
    prior_record_version,
    resulting_record_version,
    prior_values,
    resulting_values,
    note,
    actor_id
  )
  values (
    v_updated.id,
    v_action,
    v_item.record_version,
    v_updated.record_version,
    editorial.publishing_item_snapshot(v_item),
    editorial.publishing_item_snapshot(v_updated),
    nullif(btrim(p_note), ''),
    auth.uid()
  );

  item_id := v_updated.id;
  record_version := v_updated.record_version;
  return next;
end;
$function$;

create or replace function public.link_publishing_item_resource(
  p_item_id uuid,
  p_expected_record_version bigint,
  p_resource_id uuid,
  p_note text default null
)
returns table (
  item_id uuid,
  record_version bigint
)
language plpgsql
security definer
set search_path = pg_catalog, public, editorial
as $function$
declare
  v_item editorial.publishing_items%rowtype;
  v_updated editorial.publishing_items%rowtype;
begin
  if auth.uid() is null then
    raise exception
      using
        errcode = '42501',
        message = 'Authentication required';
  end if;

  if not editorial.current_user_can_manage_publishing() then
    raise exception
      using
        errcode = '42501',
        message = 'Permission denied';
  end if;

  select item.*
  into v_item
  from editorial.publishing_items item
  where item.id = p_item_id
  for update;

  if not found then
    raise exception 'Publishing item not found';
  end if;

  if v_item.record_version
     <> p_expected_record_version
  then
    raise exception
      'STALE_PUBLISHING_ITEM_VERSION: expected %, current %',
      p_expected_record_version,
      v_item.record_version;
  end if;

  if v_item.resource_id is not null then
    raise exception
      'Publishing item already has a canonical resource';
  end if;

  update editorial.publishing_items item
  set
    resource_id = p_resource_id,
    record_version = item.record_version + 1,
    updated_by = auth.uid(),
    updated_at = now()
  where item.id = p_item_id
  returning item.*
  into v_updated;

  insert into editorial.publishing_item_events (
    item_id,
    action,
    prior_record_version,
    resulting_record_version,
    prior_values,
    resulting_values,
    note,
    actor_id
  )
  values (
    v_updated.id,
    'resource_linked',
    v_item.record_version,
    v_updated.record_version,
    editorial.publishing_item_snapshot(v_item),
    editorial.publishing_item_snapshot(v_updated),
    nullif(btrim(p_note), ''),
    auth.uid()
  );

  item_id := v_updated.id;
  record_version := v_updated.record_version;
  return next;
end;
$function$;

create or replace function public.add_publishing_item_assignee(
  p_item_id uuid,
  p_expected_record_version bigint,
  p_user_id uuid,
  p_assignment_role text,
  p_note text default null
)
returns table (
  item_id uuid,
  record_version bigint
)
language plpgsql
security definer
set search_path = pg_catalog, public, editorial, auth
as $function$
declare
  v_item editorial.publishing_items%rowtype;
  v_updated editorial.publishing_items%rowtype;
begin
  if auth.uid() is null
     or not editorial.current_user_can_manage_publishing()
  then
    raise exception
      using
        errcode = '42501',
        message = 'Permission denied';
  end if;

  select item.*
  into v_item
  from editorial.publishing_items item
  where item.id = p_item_id
  for update;

  if not found then
    raise exception 'Publishing item not found';
  end if;

  if v_item.record_version
     <> p_expected_record_version
  then
    raise exception
      'STALE_PUBLISHING_ITEM_VERSION: expected %, current %',
      p_expected_record_version,
      v_item.record_version;
  end if;

  if not exists (
    select 1
    from auth.users target_user
    where target_user.id = p_user_id
  ) then
    raise exception 'Publishing assignee does not exist';
  end if;

  if exists (
    select 1
    from editorial.publishing_item_assignees assignee
    where assignee.item_id = p_item_id
      and assignee.user_id = p_user_id
      and assignee.assignment_role =
        p_assignment_role
  ) then
    raise exception
      'Publishing assignment already exists';
  end if;

  insert into editorial.publishing_item_assignees (
    item_id,
    user_id,
    assignment_role,
    assigned_by
  )
  values (
    p_item_id,
    p_user_id,
    p_assignment_role,
    auth.uid()
  );

  update editorial.publishing_items item
  set
    record_version = item.record_version + 1,
    updated_by = auth.uid(),
    updated_at = now()
  where item.id = p_item_id
  returning item.*
  into v_updated;

  insert into editorial.publishing_item_events (
    item_id,
    action,
    prior_record_version,
    resulting_record_version,
    prior_values,
    resulting_values,
    note,
    metadata,
    actor_id
  )
  values (
    p_item_id,
    'assignee_added',
    v_item.record_version,
    v_updated.record_version,
    editorial.publishing_item_snapshot(v_item),
    editorial.publishing_item_snapshot(v_updated),
    nullif(btrim(p_note), ''),
    jsonb_build_object(
      'userId',
      p_user_id,
      'assignmentRole',
      p_assignment_role
    ),
    auth.uid()
  );

  item_id := v_updated.id;
  record_version := v_updated.record_version;
  return next;
end;
$function$;

create or replace function public.remove_publishing_item_assignee(
  p_item_id uuid,
  p_expected_record_version bigint,
  p_user_id uuid,
  p_assignment_role text,
  p_note text default null
)
returns table (
  item_id uuid,
  record_version bigint
)
language plpgsql
security definer
set search_path = pg_catalog, public, editorial
as $function$
declare
  v_item editorial.publishing_items%rowtype;
  v_updated editorial.publishing_items%rowtype;
begin
  if auth.uid() is null
     or not editorial.current_user_can_manage_publishing()
  then
    raise exception
      using
        errcode = '42501',
        message = 'Permission denied';
  end if;

  select item.*
  into v_item
  from editorial.publishing_items item
  where item.id = p_item_id
  for update;

  if not found then
    raise exception 'Publishing item not found';
  end if;

  if v_item.record_version
     <> p_expected_record_version
  then
    raise exception
      'STALE_PUBLISHING_ITEM_VERSION: expected %, current %',
      p_expected_record_version,
      v_item.record_version;
  end if;

  delete from editorial.publishing_item_assignees
  where item_id = p_item_id
    and user_id = p_user_id
    and assignment_role = p_assignment_role;

  if not found then
    raise exception 'Publishing assignment not found';
  end if;

  update editorial.publishing_items item
  set
    record_version = item.record_version + 1,
    updated_by = auth.uid(),
    updated_at = now()
  where item.id = p_item_id
  returning item.*
  into v_updated;

  insert into editorial.publishing_item_events (
    item_id,
    action,
    prior_record_version,
    resulting_record_version,
    prior_values,
    resulting_values,
    note,
    metadata,
    actor_id
  )
  values (
    p_item_id,
    'assignee_removed',
    v_item.record_version,
    v_updated.record_version,
    editorial.publishing_item_snapshot(v_item),
    editorial.publishing_item_snapshot(v_updated),
    nullif(btrim(p_note), ''),
    jsonb_build_object(
      'userId',
      p_user_id,
      'assignmentRole',
      p_assignment_role
    ),
    auth.uid()
  );

  item_id := v_updated.id;
  record_version := v_updated.record_version;
  return next;
end;
$function$;

create or replace function public.add_publishing_item_channel(
  p_item_id uuid,
  p_expected_record_version bigint,
  p_channel_key text,
  p_is_primary boolean default false,
  p_note text default null
)
returns table (
  item_id uuid,
  record_version bigint
)
language plpgsql
security definer
set search_path = pg_catalog, public, editorial
as $function$
declare
  v_item editorial.publishing_items%rowtype;
  v_updated editorial.publishing_items%rowtype;
begin
  if auth.uid() is null
     or not editorial.current_user_can_manage_publishing()
  then
    raise exception
      using
        errcode = '42501',
        message = 'Permission denied';
  end if;

  select item.*
  into v_item
  from editorial.publishing_items item
  where item.id = p_item_id
  for update;

  if not found then
    raise exception 'Publishing item not found';
  end if;

  if v_item.record_version
     <> p_expected_record_version
  then
    raise exception
      'STALE_PUBLISHING_ITEM_VERSION: expected %, current %',
      p_expected_record_version,
      v_item.record_version;
  end if;

  if not exists (
    select 1
    from editorial.publishing_channels channel
    where channel.channel_key = p_channel_key
      and channel.enabled = true
  ) then
    raise exception
      'Publishing channel is missing or disabled';
  end if;

  if exists (
    select 1
    from editorial.publishing_item_channels item_channel
    where item_channel.item_id = p_item_id
      and item_channel.channel_key = p_channel_key
  ) then
    raise exception
      'Publishing channel is already attached';
  end if;

  if p_is_primary then
    update editorial.publishing_item_channels
    set is_primary = false
    where item_id = p_item_id
      and is_primary = true;
  end if;

  insert into editorial.publishing_item_channels (
    item_id,
    channel_key,
    is_primary,
    created_by
  )
  values (
    p_item_id,
    p_channel_key,
    p_is_primary,
    auth.uid()
  );

  update editorial.publishing_items item
  set
    record_version = item.record_version + 1,
    updated_by = auth.uid(),
    updated_at = now()
  where item.id = p_item_id
  returning item.*
  into v_updated;

  insert into editorial.publishing_item_events (
    item_id,
    action,
    prior_record_version,
    resulting_record_version,
    prior_values,
    resulting_values,
    note,
    metadata,
    actor_id
  )
  values (
    p_item_id,
    'channel_added',
    v_item.record_version,
    v_updated.record_version,
    editorial.publishing_item_snapshot(v_item),
    editorial.publishing_item_snapshot(v_updated),
    nullif(btrim(p_note), ''),
    jsonb_build_object(
      'channelKey',
      p_channel_key,
      'isPrimary',
      p_is_primary
    ),
    auth.uid()
  );

  item_id := v_updated.id;
  record_version := v_updated.record_version;
  return next;
end;
$function$;

create or replace function public.remove_publishing_item_channel(
  p_item_id uuid,
  p_expected_record_version bigint,
  p_channel_key text,
  p_note text default null
)
returns table (
  item_id uuid,
  record_version bigint
)
language plpgsql
security definer
set search_path = pg_catalog, public, editorial
as $function$
declare
  v_item editorial.publishing_items%rowtype;
  v_updated editorial.publishing_items%rowtype;
begin
  if auth.uid() is null
     or not editorial.current_user_can_manage_publishing()
  then
    raise exception
      using
        errcode = '42501',
        message = 'Permission denied';
  end if;

  select item.*
  into v_item
  from editorial.publishing_items item
  where item.id = p_item_id
  for update;

  if not found then
    raise exception 'Publishing item not found';
  end if;

  if v_item.record_version
     <> p_expected_record_version
  then
    raise exception
      'STALE_PUBLISHING_ITEM_VERSION: expected %, current %',
      p_expected_record_version,
      v_item.record_version;
  end if;

  delete from editorial.publishing_item_channels
  where item_id = p_item_id
    and channel_key = p_channel_key;

  if not found then
    raise exception
      'Publishing channel attachment not found';
  end if;

  update editorial.publishing_items item
  set
    record_version = item.record_version + 1,
    updated_by = auth.uid(),
    updated_at = now()
  where item.id = p_item_id
  returning item.*
  into v_updated;

  insert into editorial.publishing_item_events (
    item_id,
    action,
    prior_record_version,
    resulting_record_version,
    prior_values,
    resulting_values,
    note,
    metadata,
    actor_id
  )
  values (
    p_item_id,
    'channel_removed',
    v_item.record_version,
    v_updated.record_version,
    editorial.publishing_item_snapshot(v_item),
    editorial.publishing_item_snapshot(v_updated),
    nullif(btrim(p_note), ''),
    jsonb_build_object(
      'channelKey',
      p_channel_key
    ),
    auth.uid()
  );

  item_id := v_updated.id;
  record_version := v_updated.record_version;
  return next;
end;
$function$;

revoke all on function
  public.create_publishing_item(
    text,
    text,
    uuid,
    uuid,
    text,
    text,
    text,
    timestamptz,
    timestamptz,
    text
  )
from public, anon;

revoke all on function
  public.update_publishing_item(
    uuid,
    bigint,
    text,
    text,
    uuid,
    text,
    text,
    text,
    text,
    timestamptz,
    timestamptz,
    text
  )
from public, anon;

revoke all on function
  public.link_publishing_item_resource(
    uuid,
    bigint,
    uuid,
    text
  )
from public, anon;

revoke all on function
  public.add_publishing_item_assignee(
    uuid,
    bigint,
    uuid,
    text,
    text
  )
from public, anon;

revoke all on function
  public.remove_publishing_item_assignee(
    uuid,
    bigint,
    uuid,
    text,
    text
  )
from public, anon;

revoke all on function
  public.add_publishing_item_channel(
    uuid,
    bigint,
    text,
    boolean,
    text
  )
from public, anon;

revoke all on function
  public.remove_publishing_item_channel(
    uuid,
    bigint,
    text,
    text
  )
from public, anon;

grant execute on function
  public.create_publishing_item(
    text,
    text,
    uuid,
    uuid,
    text,
    text,
    text,
    timestamptz,
    timestamptz,
    text
  )
to authenticated, service_role;

grant execute on function
  public.update_publishing_item(
    uuid,
    bigint,
    text,
    text,
    uuid,
    text,
    text,
    text,
    text,
    timestamptz,
    timestamptz,
    text
  )
to authenticated, service_role;

grant execute on function
  public.link_publishing_item_resource(
    uuid,
    bigint,
    uuid,
    text
  )
to authenticated, service_role;

grant execute on function
  public.add_publishing_item_assignee(
    uuid,
    bigint,
    uuid,
    text,
    text
  )
to authenticated, service_role;

grant execute on function
  public.remove_publishing_item_assignee(
    uuid,
    bigint,
    uuid,
    text,
    text
  )
to authenticated, service_role;

grant execute on function
  public.add_publishing_item_channel(
    uuid,
    bigint,
    text,
    boolean,
    text
  )
to authenticated, service_role;

grant execute on function
  public.remove_publishing_item_channel(
    uuid,
    bigint,
    text,
    text
  )
to authenticated, service_role;

commit;
