-- WAKILISHA Community: repair notification preference account-row dependency.
--
-- The settings page reads/writes notification prefs through RPCs. In production,
-- existing/admin auth users can reach those RPCs before the durable account row
-- referenced by community_notification_preferences exists, which causes a 409 FK
-- conflict. Keep the fix database-side so RLS remains intact and the frontend can
-- keep using the same RPC contract.

create table if not exists public.community_notification_preferences (
  user_id uuid primary key references public.user_profiles(user_id) on delete cascade,
  email_digest boolean not null default true,
  chart_alerts boolean not null default true,
  artist_drops boolean not null default true,
  reply_notifications boolean not null default true,
  mention_notifications boolean not null default true,
  follow_notifications boolean not null default false,
  contribution_notifications boolean not null default false,
  marketing_emails boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.community_notification_preferences enable row level security;

drop policy if exists community_notification_preferences_own_select on public.community_notification_preferences;
create policy community_notification_preferences_own_select
  on public.community_notification_preferences
  for select
  to authenticated
  using (user_id = auth.uid() or public.current_user_is_administrator());

drop policy if exists community_notification_preferences_own_insert on public.community_notification_preferences;
create policy community_notification_preferences_own_insert
  on public.community_notification_preferences
  for insert
  to authenticated
  with check (user_id = auth.uid() or public.current_user_is_administrator());

drop policy if exists community_notification_preferences_own_update on public.community_notification_preferences;
create policy community_notification_preferences_own_update
  on public.community_notification_preferences
  for update
  to authenticated
  using (user_id = auth.uid() or public.current_user_is_administrator())
  with check (user_id = auth.uid() or public.current_user_is_administrator());

-- Backfill the durable account rows for existing Supabase Auth users.
insert into public.user_profiles (user_id, email, display_name, status, metadata, created_at, updated_at)
select
  au.id,
  au.email,
  coalesce(
    au.raw_user_meta_data->>'full_name',
    au.raw_user_meta_data->>'name',
    split_part(coalesce(au.email, ''), '@', 1),
    'WAKILISHA user'
  ),
  'active',
  jsonb_build_object('created_by', 'notification_prefs_fk_repair'),
  now(),
  now()
from auth.users au
where not exists (
  select 1
  from public.user_profiles up
  where up.user_id = au.id
)
on conflict (user_id) do update set
  email = coalesce(excluded.email, public.user_profiles.email),
  display_name = coalesce(public.user_profiles.display_name, excluded.display_name),
  status = coalesce(public.user_profiles.status, 'active'),
  updated_at = now();

create or replace function public.community_ensure_user_account(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_email text;
  v_display_name text;
  v_username text;
  v_cols text[];
  v_vals text[];
  v_updates text[];
begin
  if p_user_id is null then
    raise exception 'user_id is required';
  end if;

  if auth.uid() is null then
    raise exception 'authentication required';
  end if;

  if p_user_id <> auth.uid() and not public.current_user_is_administrator() then
    raise exception 'not allowed';
  end if;

  select
    au.email,
    coalesce(
      au.raw_user_meta_data->>'full_name',
      au.raw_user_meta_data->>'name',
      split_part(coalesce(au.email, ''), '@', 1),
      'WAKILISHA user'
    )
  into v_email, v_display_name
  from auth.users au
  where au.id = p_user_id;

  if not found then
    raise exception 'auth user % not found', p_user_id;
  end if;

  insert into public.user_profiles (user_id, email, display_name, status, metadata, created_at, updated_at)
  values (
    p_user_id,
    v_email,
    v_display_name,
    'active',
    jsonb_build_object('created_by', 'community_ensure_user_account'),
    now(),
    now()
  )
  on conflict (user_id) do update set
    email = coalesce(excluded.email, public.user_profiles.email),
    display_name = coalesce(public.user_profiles.display_name, excluded.display_name),
    status = coalesce(public.user_profiles.status, 'active'),
    updated_at = now();

  -- Some community tables were introduced separately from the durable auth
  -- profile table. If community_profiles exists and notification prefs point to
  -- it in an older environment, ensure that row too without assuming every
  -- optional column exists.
  if to_regclass('public.community_profiles') is not null then
    v_username := regexp_replace(
      lower(coalesce(nullif(split_part(coalesce(v_email, ''), '@', 1), ''), 'user')),
      '[^a-z0-9_]+',
      '_',
      'g'
    );
    v_username := trim(both '_' from v_username);
    v_username := left(coalesce(nullif(v_username, ''), 'user'), 24) || '_' || replace(left(p_user_id::text, 8), '-', '');

    v_cols := array['user_id'];
    v_vals := array['$1'];
    v_updates := array[]::text[];

    if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'community_profiles' and column_name = 'username') then
      v_cols := array_append(v_cols, 'username');
      v_vals := array_append(v_vals, '$2');
      v_updates := array_append(v_updates, 'username = coalesce(public.community_profiles.username, excluded.username)');
    end if;

    if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'community_profiles' and column_name = 'display_name') then
      v_cols := array_append(v_cols, 'display_name');
      v_vals := array_append(v_vals, '$3');
      v_updates := array_append(v_updates, 'display_name = coalesce(public.community_profiles.display_name, excluded.display_name)');
    end if;

    if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'community_profiles' and column_name = 'email') then
      v_cols := array_append(v_cols, 'email');
      v_vals := array_append(v_vals, '$4');
      v_updates := array_append(v_updates, 'email = coalesce(excluded.email, public.community_profiles.email)');
    end if;

    if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'community_profiles' and column_name = 'is_public') then
      v_cols := array_append(v_cols, 'is_public');
      v_vals := array_append(v_vals, 'true');
    end if;

    if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'community_profiles' and column_name = 'created_at') then
      v_cols := array_append(v_cols, 'created_at');
      v_vals := array_append(v_vals, 'now()');
    end if;

    if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'community_profiles' and column_name = 'updated_at') then
      v_cols := array_append(v_cols, 'updated_at');
      v_vals := array_append(v_vals, 'now()');
      v_updates := array_append(v_updates, 'updated_at = now()');
    end if;

    execute format(
      'insert into public.community_profiles (%s) values (%s) on conflict (user_id) do update set %s',
      array_to_string(v_cols, ', '),
      array_to_string(v_vals, ', '),
      case
        when coalesce(array_length(v_updates, 1), 0) > 0 then array_to_string(v_updates, ', ')
        else 'user_id = excluded.user_id'
      end
    ) using p_user_id, v_username, v_display_name, v_email;
  end if;
end;
$$;

drop function if exists public.community_get_notification_prefs(uuid);

create function public.community_get_notification_prefs(p_user_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_prefs public.community_notification_preferences%rowtype;
begin
  perform public.community_ensure_user_account(p_user_id);

  insert into public.community_notification_preferences (
    user_id,
    email_digest,
    chart_alerts,
    artist_drops,
    reply_notifications,
    mention_notifications,
    follow_notifications,
    contribution_notifications,
    marketing_emails,
    created_at,
    updated_at
  ) values (
    p_user_id,
    true,
    true,
    true,
    true,
    true,
    false,
    false,
    false,
    now(),
    now()
  )
  on conflict (user_id) do nothing;

  select * into v_prefs
  from public.community_notification_preferences
  where user_id = p_user_id;

  return jsonb_build_object(
    'user_id', v_prefs.user_id,
    'email_digest', coalesce(v_prefs.email_digest, true),
    'chart_alerts', coalesce(v_prefs.chart_alerts, true),
    'artist_drops', coalesce(v_prefs.artist_drops, true),
    'reply_notifications', coalesce(v_prefs.reply_notifications, true),
    'mention_notifications', coalesce(v_prefs.mention_notifications, true),
    'follow_notifications', coalesce(v_prefs.follow_notifications, false),
    'contribution_notifications', coalesce(v_prefs.contribution_notifications, false),
    'marketing_emails', coalesce(v_prefs.marketing_emails, false),
    'created_at', v_prefs.created_at,
    'updated_at', v_prefs.updated_at
  );
end;
$$;

drop function if exists public.community_update_notification_prefs(
  uuid,
  boolean,
  boolean,
  boolean,
  boolean,
  boolean,
  boolean,
  boolean,
  boolean
);

create function public.community_update_notification_prefs(
  p_user_id uuid,
  p_email_digest boolean,
  p_chart_alerts boolean,
  p_artist_drops boolean,
  p_reply_notifications boolean,
  p_mention_notifications boolean,
  p_follow_notifications boolean,
  p_contribution_notifications boolean,
  p_marketing_emails boolean
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_prefs public.community_notification_preferences%rowtype;
begin
  perform public.community_ensure_user_account(p_user_id);

  insert into public.community_notification_preferences (
    user_id,
    email_digest,
    chart_alerts,
    artist_drops,
    reply_notifications,
    mention_notifications,
    follow_notifications,
    contribution_notifications,
    marketing_emails,
    created_at,
    updated_at
  ) values (
    p_user_id,
    coalesce(p_email_digest, true),
    coalesce(p_chart_alerts, true),
    coalesce(p_artist_drops, true),
    coalesce(p_reply_notifications, true),
    coalesce(p_mention_notifications, true),
    coalesce(p_follow_notifications, false),
    coalesce(p_contribution_notifications, false),
    coalesce(p_marketing_emails, false),
    now(),
    now()
  )
  on conflict (user_id) do update set
    email_digest = excluded.email_digest,
    chart_alerts = excluded.chart_alerts,
    artist_drops = excluded.artist_drops,
    reply_notifications = excluded.reply_notifications,
    mention_notifications = excluded.mention_notifications,
    follow_notifications = excluded.follow_notifications,
    contribution_notifications = excluded.contribution_notifications,
    marketing_emails = excluded.marketing_emails,
    updated_at = now();

  select * into v_prefs
  from public.community_notification_preferences
  where user_id = p_user_id;

  return jsonb_build_object(
    'user_id', v_prefs.user_id,
    'email_digest', coalesce(v_prefs.email_digest, true),
    'chart_alerts', coalesce(v_prefs.chart_alerts, true),
    'artist_drops', coalesce(v_prefs.artist_drops, true),
    'reply_notifications', coalesce(v_prefs.reply_notifications, true),
    'mention_notifications', coalesce(v_prefs.mention_notifications, true),
    'follow_notifications', coalesce(v_prefs.follow_notifications, false),
    'contribution_notifications', coalesce(v_prefs.contribution_notifications, false),
    'marketing_emails', coalesce(v_prefs.marketing_emails, false),
    'created_at', v_prefs.created_at,
    'updated_at', v_prefs.updated_at
  );
end;
$$;

grant execute on function public.community_ensure_user_account(uuid) to authenticated;
grant execute on function public.community_get_notification_prefs(uuid) to authenticated;
grant execute on function public.community_update_notification_prefs(uuid, boolean, boolean, boolean, boolean, boolean, boolean, boolean, boolean) to authenticated;
