-- Harden notification RPCs so Alerts never throws noisy 400s during normal browsing.
-- These functions return safe empty payloads when auth is missing/mismatched instead of raising.

create or replace function public.community_get_unread_count()
returns jsonb
language plpgsql
security definer
set search_path = public
stable
as $$
declare
  v_count integer := 0;
begin
  if auth.uid() is null then
    return jsonb_build_object('count', 0);
  end if;

  select count(*)::integer
  into v_count
  from public.community_notifications
  where user_id = auth.uid()
    and read_at is null;

  return jsonb_build_object('count', coalesce(v_count, 0));
end;
$$;

create or replace function public.community_get_user_notifications(
  p_user_id uuid,
  p_limit integer default 30
)
returns jsonb
language plpgsql
security definer
set search_path = public
stable
as $$
declare
  v_limit integer := least(greatest(coalesce(p_limit, 30), 1), 100);
  v_notifications jsonb := '[]'::jsonb;
begin
  if auth.uid() is null or auth.uid() <> p_user_id then
    return '[]'::jsonb;
  end if;

  select coalesce(jsonb_agg(to_jsonb(notification_row) order by notification_row.created_at desc), '[]'::jsonb)
  into v_notifications
  from (
    select
      n.id,
      n.user_id,
      n.actor_id,
      n.notification_type,
      n.entity_type,
      n.entity_id,
      n.entity_slug,
      n.comment_id,
      coalesce(n.metadata, '{}'::jsonb) as metadata,
      n.read_at,
      n.created_at
    from public.community_notifications n
    where n.user_id = p_user_id
    order by n.created_at desc
    limit v_limit
  ) notification_row;

  return coalesce(v_notifications, '[]'::jsonb);
end;
$$;

create or replace function public.community_mark_all_read()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_updated integer := 0;
begin
  if auth.uid() is null then
    return jsonb_build_object('updated', 0);
  end if;

  with updated_rows as (
    update public.community_notifications
    set read_at = now()
    where user_id = auth.uid()
      and read_at is null
    returning id
  )
  select count(*)::integer into v_updated from updated_rows;

  return jsonb_build_object('updated', coalesce(v_updated, 0));
end;
$$;

create or replace function public.community_mark_notification_read(
  p_notification_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_notification public.community_notifications%rowtype;
begin
  if auth.uid() is null then
    return jsonb_build_object('notification', null, 'updated', false);
  end if;

  update public.community_notifications
  set read_at = coalesce(read_at, now())
  where id = p_notification_id
    and user_id = auth.uid()
  returning * into v_notification;

  if v_notification.id is null then
    return jsonb_build_object('notification', null, 'updated', false);
  end if;

  return jsonb_build_object(
    'notification', to_jsonb(v_notification),
    'updated', true
  );
end;
$$;

grant execute on function public.community_get_unread_count() to anon, authenticated;
grant execute on function public.community_get_user_notifications(uuid, integer) to anon, authenticated;
grant execute on function public.community_mark_all_read() to anon, authenticated;
grant execute on function public.community_mark_notification_read(uuid) to anon, authenticated;
