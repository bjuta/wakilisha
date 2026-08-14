begin;

do $preflight$
begin
  if to_regclass(
    'editorial.publishing_items'
  ) is null then
    raise exception
      'STOP: editorial.publishing_items does not exist';
  end if;

  if to_regclass(
    'editorial.publishing_item_channels'
  ) is null then
    raise exception
      'STOP: editorial.publishing_item_channels does not exist';
  end if;

  if to_regclass(
    'editorial.publishing_item_events'
  ) is null then
    raise exception
      'STOP: editorial.publishing_item_events does not exist';
  end if;

  if to_regclass(
    'public.user_profiles'
  ) is null then
    raise exception
      'STOP: public.user_profiles does not exist';
  end if;

  if to_regclass(
    'public.user_role_assignments'
  ) is null then
    raise exception
      'STOP: public.user_role_assignments does not exist';
  end if;

  if to_regclass(
    'public.role_capabilities'
  ) is null then
    raise exception
      'STOP: public.role_capabilities does not exist';
  end if;

  if to_regprocedure(
    'editorial.current_user_can_manage_publishing()'
  ) is null then
    raise exception
      'STOP: Publishing permission helper does not exist';
  end if;
end;
$preflight$;

alter table editorial.publishing_item_events
  drop constraint if exists
    publishing_item_events_action_check;

alter table editorial.publishing_item_events
  add constraint publishing_item_events_action_check
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
      'channel_removed',
      'channel_primary_changed'
    )
  );

create or replace function
  public.list_publishing_assignable_users()
returns table (
  user_id uuid,
  label text,
  email text,
  role_labels text[]
)
language plpgsql
stable
security definer
set search_path = pg_catalog, public, editorial
as $function$
begin
  if auth.uid() is null
     or not editorial.current_user_can_manage_publishing()
  then
    raise exception
      using
        errcode = '42501',
        message = 'Permission denied';
  end if;

  return query
  select
    profile.user_id,
    coalesce(
      nullif(btrim(profile.display_name), ''),
      nullif(btrim(profile.email), ''),
      nullif(btrim(profile.username), ''),
      profile.user_id::text
    ) as label,
    profile.email,
    array_agg(
      distinct role_definition.label
      order by role_definition.label
    ) as role_labels
  from public.user_profiles profile
  join public.user_role_assignments assignment
    on assignment.user_id = profile.user_id
  join public.role_definitions role_definition
    on role_definition.role_key =
      assignment.role_key
  where profile.status = 'active'
    and assignment.status = 'active'
    and (
      assignment.expires_at is null
      or assignment.expires_at > now()
    )
    and exists (
      select 1
      from public.role_capabilities capability
      where capability.role_key =
        assignment.role_key
        and capability.capability_key in (
          'manage_publishing',
          'view_dashboard',
          'view_admin_readonly',
          'edit_own_articles'
        )
    )
  group by
    profile.user_id,
    profile.display_name,
    profile.email,
    profile.username
  order by
    lower(
      coalesce(
        nullif(btrim(profile.display_name), ''),
        nullif(btrim(profile.email), ''),
        nullif(btrim(profile.username), ''),
        profile.user_id::text
      )
    ),
    profile.user_id;
end;
$function$;

comment on function
  public.list_publishing_assignable_users()
is
  'Returns active internal users who may receive operational Publishing assignments.';

create or replace function
  public.set_publishing_item_primary_channel(
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
  v_previous_primary_channel_key text;
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
    from editorial.publishing_item_channels item_channel
    where item_channel.item_id = p_item_id
      and item_channel.channel_key =
        p_channel_key
  ) then
    raise exception
      'Publishing channel attachment not found';
  end if;

  select item_channel.channel_key
  into v_previous_primary_channel_key
  from editorial.publishing_item_channels item_channel
  where item_channel.item_id = p_item_id
    and item_channel.is_primary = true
  limit 1;

  if v_previous_primary_channel_key =
     p_channel_key
  then
    raise exception
      'Publishing channel is already primary';
  end if;

  update editorial.publishing_item_channels
  set is_primary = false
  where item_id = p_item_id
    and is_primary = true;

  update editorial.publishing_item_channels
  set is_primary = true
  where item_id = p_item_id
    and channel_key = p_channel_key;

  if not found then
    raise exception
      'Publishing channel attachment not found';
  end if;

  update editorial.publishing_items item
  set
    record_version =
      item.record_version + 1,
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
    'channel_primary_changed',
    v_item.record_version,
    v_updated.record_version,
    editorial.publishing_item_snapshot(
      v_item
    ),
    editorial.publishing_item_snapshot(
      v_updated
    ),
    nullif(btrim(p_note), ''),
    jsonb_strip_nulls(
      jsonb_build_object(
        'channelKey',
        p_channel_key,
        'previousPrimaryChannelKey',
        v_previous_primary_channel_key
      )
    ),
    auth.uid()
  );

  item_id := v_updated.id;
  record_version :=
    v_updated.record_version;

  return next;
end;
$function$;

comment on function
  public.set_publishing_item_primary_channel(
    uuid,
    bigint,
    text,
    text
  )
is
  'Marks one attached Publishing channel as primary through optimistic concurrency and append-only history.';

revoke all on function
  public.list_publishing_assignable_users()
from public, anon;

revoke all on function
  public.set_publishing_item_primary_channel(
    uuid,
    bigint,
    text,
    text
  )
from public, anon;

grant execute on function
  public.list_publishing_assignable_users()
to authenticated, service_role;

grant execute on function
  public.set_publishing_item_primary_channel(
    uuid,
    bigint,
    text,
    text
  )
to authenticated, service_role;

commit;
