begin;

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
    p_owner_id,
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

revoke all on function public.create_publishing_item(
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

grant execute on function public.create_publishing_item(
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

commit;
