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

  if to_regprocedure(
    'public.add_publishing_item_channel(uuid,bigint,text,boolean,text)'
  ) is null then
    raise exception
      'STOP: add_publishing_item_channel does not exist';
  end if;

  if to_regprocedure(
    'public.remove_publishing_item_channel(uuid,bigint,text,text)'
  ) is null then
    raise exception
      'STOP: remove_publishing_item_channel does not exist';
  end if;

  if to_regprocedure(
    'public.set_publishing_item_primary_channel(uuid,bigint,text,text)'
  ) is null then
    raise exception
      'STOP: set_publishing_item_primary_channel does not exist';
  end if;
end;
$preflight$;

create or replace function
  public.add_publishing_item_channel(
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
      as item_channel
    set is_primary = false
    where item_channel.item_id = p_item_id
      and item_channel.is_primary = true;
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
    'channel_added',
    v_item.record_version,
    v_updated.record_version,
    editorial.publishing_item_snapshot(
      v_item
    ),
    editorial.publishing_item_snapshot(
      v_updated
    ),
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
  record_version :=
    v_updated.record_version;

  return next;
end;
$function$;

create or replace function
  public.remove_publishing_item_channel(
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
    as item_channel
  where item_channel.item_id = p_item_id
    and item_channel.channel_key =
      p_channel_key;

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
    'channel_removed',
    v_item.record_version,
    v_updated.record_version,
    editorial.publishing_item_snapshot(
      v_item
    ),
    editorial.publishing_item_snapshot(
      v_updated
    ),
    nullif(btrim(p_note), ''),
    jsonb_build_object(
      'channelKey',
      p_channel_key
    ),
    auth.uid()
  );

  item_id := v_updated.id;
  record_version :=
    v_updated.record_version;

  return next;
end;
$function$;

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
    as item_channel
  set is_primary = false
  where item_channel.item_id = p_item_id
    and item_channel.is_primary = true;

  update editorial.publishing_item_channels
    as item_channel
  set is_primary = true
  where item_channel.item_id = p_item_id
    and item_channel.channel_key =
      p_channel_key;

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

revoke all on function
  public.set_publishing_item_primary_channel(
    uuid,
    bigint,
    text,
    text
  )
from public, anon;

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

grant execute on function
  public.set_publishing_item_primary_channel(
    uuid,
    bigint,
    text,
    text
  )
to authenticated, service_role;

commit;
