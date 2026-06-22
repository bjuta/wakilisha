-- WAKILISHA Community: commercial-grade public handle contract.
--
-- Handles are canonical public identity, URL slugs, mention targets, and
-- community reputation anchors. Keep the contract database-side so the UI can
-- never bypass uniqueness, reserved words, history, or ownership checks.

create extension if not exists pgcrypto;

alter table public.user_profiles add column if not exists username text;
alter table public.user_profiles add column if not exists username_normalized text;
alter table public.user_profiles add column if not exists username_updated_at timestamptz;
alter table public.user_profiles add column if not exists username_change_count integer not null default 0;
alter table public.user_profiles add column if not exists country text;
alter table public.user_profiles add column if not exists city text;
alter table public.user_profiles add column if not exists is_public boolean;

update public.user_profiles
set is_public = true
where is_public is null;

alter table public.user_profiles alter column is_public set default true;
alter table public.user_profiles alter column is_public set not null;

create table if not exists public.community_reserved_usernames (
  username text primary key,
  reason text not null default 'reserved',
  created_at timestamptz not null default now()
);

alter table public.community_reserved_usernames enable row level security;

drop policy if exists community_reserved_usernames_public_read on public.community_reserved_usernames;
create policy community_reserved_usernames_public_read
  on public.community_reserved_usernames
  for select
  to anon, authenticated
  using (true);

insert into public.community_reserved_usernames (username, reason) values
  ('admin', 'platform'),
  ('administrator', 'platform'),
  ('api', 'route'),
  ('auth', 'route'),
  ('charts', 'route'),
  ('deleted', 'system'),
  ('discover', 'route'),
  ('edit', 'route'),
  ('explore', 'route'),
  ('genres', 'route'),
  ('guides', 'route'),
  ('help', 'support'),
  ('login', 'auth'),
  ('logout', 'auth'),
  ('magazine', 'route'),
  ('moderator', 'platform'),
  ('mod', 'platform'),
  ('null', 'system'),
  ('official', 'platform'),
  ('privacy', 'legal'),
  ('profile', 'route'),
  ('profiles', 'route'),
  ('releases', 'route'),
  ('root', 'platform'),
  ('search', 'route'),
  ('settings', 'route'),
  ('support', 'support'),
  ('system', 'platform'),
  ('team', 'platform'),
  ('terms', 'legal'),
  ('tracks', 'route'),
  ('u', 'route'),
  ('undefined', 'system'),
  ('user', 'system'),
  ('users', 'route'),
  ('wakilisha', 'brand')
on conflict (username) do update set reason = excluded.reason;

create table if not exists public.user_profile_username_history (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.user_profiles(user_id) on delete cascade,
  old_username text,
  old_username_normalized text,
  new_username text not null,
  new_username_normalized text not null,
  changed_by uuid references auth.users(id) on delete set null,
  change_reason text not null default 'user_update',
  created_at timestamptz not null default now()
);

create index if not exists user_profile_username_history_user_idx
  on public.user_profile_username_history(user_id, created_at desc);

create index if not exists user_profile_username_history_old_idx
  on public.user_profile_username_history(old_username_normalized, created_at desc)
  where old_username_normalized is not null;

alter table public.user_profile_username_history enable row level security;

drop policy if exists user_profile_username_history_self_or_admin_read on public.user_profile_username_history;
create policy user_profile_username_history_self_or_admin_read
  on public.user_profile_username_history
  for select
  to authenticated
  using (user_id = auth.uid() or public.current_user_is_administrator());

create or replace function public.community_normalize_username(p_username text)
returns text
language sql
immutable
as $$
  select nullif(lower(trim(both from regexp_replace(coalesce(p_username, ''), '^@+', '', 'g'))), '');
$$;

create or replace function public.community_username_is_valid(p_username text)
returns boolean
language sql
immutable
as $$
  select coalesce(p_username ~ '^[a-z0-9]([a-z0-9_]{1,28}[a-z0-9])$', false);
$$;

create or replace function public.community_username_seed(p_seed text)
returns text
language plpgsql
immutable
as $$
declare
  v_seed text;
begin
  v_seed := lower(coalesce(p_seed, ''));
  v_seed := regexp_replace(v_seed, '[^a-z0-9_]+', '_', 'g');
  v_seed := regexp_replace(v_seed, '_+', '_', 'g');
  v_seed := trim(both '_' from v_seed);

  if length(coalesce(v_seed, '')) < 3 then
    v_seed := 'user';
  end if;

  v_seed := left(v_seed, 24);
  v_seed := trim(both '_' from v_seed);

  if length(coalesce(v_seed, '')) < 3 then
    v_seed := 'user';
  end if;

  if v_seed !~ '^[a-z0-9]' then
    v_seed := 'user' || v_seed;
  end if;

  if v_seed !~ '[a-z0-9]$' then
    v_seed := v_seed || 'user';
  end if;

  return left(v_seed, 24);
end;
$$;

create or replace function public.community_username_is_reserved(p_username text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.community_reserved_usernames r
    where r.username = public.community_normalize_username(p_username)
  );
$$;

create or replace function public.community_generate_username(
  p_user_id uuid,
  p_email text,
  p_display_name text default null
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_base text;
  v_candidate text;
  v_suffix text;
  v_attempt integer := 0;
begin
  v_base := public.community_username_seed(
    coalesce(
      nullif(p_display_name, ''),
      nullif(split_part(coalesce(p_email, ''), '@', 1), ''),
      'user'
    )
  );

  v_candidate := v_base;

  if public.community_username_is_reserved(v_candidate)
    or exists (
      select 1
      from public.user_profiles up
      where up.username_normalized = v_candidate
        and up.user_id <> p_user_id
    )
  then
    v_suffix := '_' || left(replace(coalesce(p_user_id::text, gen_random_uuid()::text), '-', ''), 8);
    v_candidate := left(v_base, 30 - length(v_suffix)) || v_suffix;
  end if;

  while public.community_username_is_reserved(v_candidate)
    or exists (
      select 1
      from public.user_profiles up
      where up.username_normalized = v_candidate
        and up.user_id <> p_user_id
    )
  loop
    v_attempt := v_attempt + 1;
    v_suffix := '_' || left(replace(coalesce(p_user_id::text, gen_random_uuid()::text), '-', ''), 6) || v_attempt::text;
    v_candidate := left(v_base, 30 - length(v_suffix)) || v_suffix;

    if v_attempt > 99 then
      raise exception 'could not generate unique username for user %', p_user_id;
    end if;
  end loop;

  return v_candidate;
end;
$$;

-- Backfill every existing profile with a stable, unique, valid username.
do $$
declare
  v_profile record;
  v_base text;
  v_candidate text;
  v_suffix text;
  v_attempt integer;
begin
  drop table if exists pg_temp.wk_taken_usernames;
  create temporary table wk_taken_usernames (
    username_normalized text primary key
  ) on commit drop;

  insert into wk_taken_usernames (username_normalized)
  select username from public.community_reserved_usernames
  on conflict do nothing;

  for v_profile in
    select user_id, email, display_name, username, created_at
    from public.user_profiles
    order by created_at nulls last, user_id
  loop
    v_candidate := public.community_normalize_username(v_profile.username);

    if v_candidate is null
      or not public.community_username_is_valid(v_candidate)
      or exists (select 1 from wk_taken_usernames where username_normalized = v_candidate)
    then
      v_base := public.community_username_seed(
        coalesce(
          nullif(v_profile.username, ''),
          nullif(v_profile.display_name, ''),
          nullif(split_part(coalesce(v_profile.email, ''), '@', 1), ''),
          'user'
        )
      );
      v_candidate := v_base;
    end if;

    if not public.community_username_is_valid(v_candidate)
      or exists (select 1 from wk_taken_usernames where username_normalized = v_candidate)
    then
      v_suffix := '_' || left(replace(v_profile.user_id::text, '-', ''), 8);
      v_candidate := left(v_base, 30 - length(v_suffix)) || v_suffix;
    end if;

    v_attempt := 0;
    while not public.community_username_is_valid(v_candidate)
      or exists (select 1 from wk_taken_usernames where username_normalized = v_candidate)
    loop
      v_attempt := v_attempt + 1;
      v_suffix := '_' || left(replace(v_profile.user_id::text, '-', ''), 6) || v_attempt::text;
      v_candidate := left(v_base, 30 - length(v_suffix)) || v_suffix;

      if v_attempt > 99 then
        raise exception 'could not backfill unique username for user %', v_profile.user_id;
      end if;
    end loop;

    update public.user_profiles
    set
      username = v_candidate,
      username_normalized = v_candidate,
      updated_at = now()
    where user_id = v_profile.user_id;

    insert into wk_taken_usernames (username_normalized)
    values (v_candidate)
    on conflict do nothing;
  end loop;
end;
$$;

create unique index if not exists user_profiles_username_normalized_unique
  on public.user_profiles(username_normalized);

alter table public.user_profiles drop constraint if exists user_profiles_username_format;
alter table public.user_profiles add constraint user_profiles_username_format
  check (username_normalized is null or public.community_username_is_valid(username_normalized));

alter table public.user_profiles drop constraint if exists user_profiles_username_sync;
alter table public.user_profiles add constraint user_profiles_username_sync
  check (username_normalized is null or username_normalized = public.community_normalize_username(username));

create or replace function public.community_profile_json(p_profile public.user_profiles)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'user_id', p_profile.user_id,
    'email', p_profile.email,
    'username', p_profile.username_normalized,
    'username_normalized', p_profile.username_normalized,
    'display_name', coalesce(p_profile.display_name, split_part(coalesce(p_profile.email, ''), '@', 1), 'WAKILISHA user'),
    'bio', coalesce(p_profile.bio, ''),
    'country', coalesce(p_profile.country, ''),
    'city', coalesce(p_profile.city, ''),
    'avatar_url', p_profile.avatar_url,
    'role_labels', coalesce((
      select array_agg(ura.role_key order by rd.priority, ura.role_key)
      from public.user_role_assignments ura
      left join public.role_definitions rd on rd.role_key = ura.role_key
      where ura.user_id = p_profile.user_id
        and ura.status = 'active'
        and (ura.expires_at is null or ura.expires_at > now())
    ), array[]::text[]),
    'trust_level', 0,
    'reputation_score', 0,
    'comment_count', 0,
    'contribution_count', 0,
    'is_public', coalesce(p_profile.is_public, true),
    'created_at', p_profile.created_at,
    'updated_at', p_profile.updated_at
  );
$$;

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

  v_username := public.community_generate_username(p_user_id, v_email, v_display_name);

  insert into public.user_profiles (
    user_id,
    email,
    username,
    username_normalized,
    display_name,
    status,
    metadata,
    created_at,
    updated_at
  ) values (
    p_user_id,
    v_email,
    v_username,
    v_username,
    v_display_name,
    'active',
    jsonb_build_object('created_by', 'community_ensure_user_account'),
    now(),
    now()
  )
  on conflict (user_id) do update set
    email = coalesce(excluded.email, public.user_profiles.email),
    username = coalesce(public.user_profiles.username, excluded.username),
    username_normalized = coalesce(public.user_profiles.username_normalized, excluded.username_normalized),
    display_name = coalesce(public.user_profiles.display_name, excluded.display_name),
    status = coalesce(public.user_profiles.status, 'active'),
    updated_at = now();

  -- Keep legacy community_profiles environments hydrated without making it the
  -- canonical identity table.
  if to_regclass('public.community_profiles') is not null then
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

drop function if exists public.community_get_user_profile(uuid);
create function public.community_get_user_profile(p_user_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_profile public.user_profiles%rowtype;
begin
  if p_user_id is null then
    return null;
  end if;

  if auth.uid() is not null and (p_user_id = auth.uid() or public.current_user_is_administrator()) then
    perform public.community_ensure_user_account(p_user_id);
  end if;

  select * into v_profile
  from public.user_profiles
  where user_id = p_user_id;

  if not found then
    return null;
  end if;

  if coalesce(v_profile.is_public, true) = false
    and (
      auth.uid() is null
      or (v_profile.user_id <> auth.uid() and not public.current_user_is_administrator())
    ) then
    return null;
  end if;

  return public.community_profile_json(v_profile);
end;
$$;

drop function if exists public.community_get_profile_by_username(text);
create function public.community_get_profile_by_username(p_username text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_username text;
  v_profile public.user_profiles%rowtype;
begin
  v_username := public.community_normalize_username(p_username);

  if v_username is null or not public.community_username_is_valid(v_username) then
    return null;
  end if;

  select * into v_profile
  from public.user_profiles
  where username_normalized = v_username;

  if not found then
    return null;
  end if;

  if coalesce(v_profile.is_public, true) = false
    and (
      auth.uid() is null
      or (v_profile.user_id <> auth.uid() and not public.current_user_is_administrator())
    ) then
    return null;
  end if;

  return public.community_profile_json(v_profile);
end;
$$;

drop function if exists public.community_get_profiles_batch(uuid[]);
create function public.community_get_profiles_batch(p_user_ids uuid[])
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(jsonb_object_agg(up.user_id::text, public.community_profile_json(up)), '{}'::jsonb)
  from public.user_profiles up
  where up.user_id = any(coalesce(p_user_ids, array[]::uuid[]))
    and (
      coalesce(up.is_public, true) = true
      or up.user_id = auth.uid()
      or public.current_user_is_administrator()
    );
$$;

drop function if exists public.community_username_available(text);
create function public.community_username_available(p_username text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_username text;
  v_existing_user_id uuid;
begin
  v_username := public.community_normalize_username(p_username);

  if v_username is null or not public.community_username_is_valid(v_username) then
    return jsonb_build_object(
      'available', false,
      'normalized', v_username,
      'reason', 'invalid_format',
      'message', 'Use 3-30 lowercase letters, numbers, and underscores. Start and end with a letter or number.'
    );
  end if;

  if public.community_username_is_reserved(v_username) then
    return jsonb_build_object(
      'available', false,
      'normalized', v_username,
      'reason', 'reserved',
      'message', 'That handle is reserved.'
    );
  end if;

  select user_id into v_existing_user_id
  from public.user_profiles
  where username_normalized = v_username;

  if found and v_existing_user_id = auth.uid() then
    return jsonb_build_object(
      'available', true,
      'normalized', v_username,
      'reason', 'current',
      'message', 'This is your current handle.'
    );
  end if;

  if found then
    return jsonb_build_object(
      'available', false,
      'normalized', v_username,
      'reason', 'taken',
      'message', 'That handle is already taken.'
    );
  end if;

  if exists (
    select 1
    from public.user_profile_username_history h
    where h.old_username_normalized = v_username
      and h.user_id <> coalesce(auth.uid(), '00000000-0000-0000-0000-000000000000'::uuid)
      and h.created_at > now() - interval '30 days'
  ) then
    return jsonb_build_object(
      'available', false,
      'normalized', v_username,
      'reason', 'recently_released',
      'message', 'That handle was recently released and is temporarily protected.'
    );
  end if;

  return jsonb_build_object(
    'available', true,
    'normalized', v_username,
    'reason', 'available',
    'message', 'Handle available.'
  );
end;
$$;

drop function if exists public.community_update_username(text);
create function public.community_update_username(p_username text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid;
  v_username text;
  v_profile public.user_profiles%rowtype;
  v_old_username text;
  v_old_username_normalized text;
  v_is_admin boolean;
begin
  v_user_id := auth.uid();

  if v_user_id is null then
    raise exception 'authentication required';
  end if;

  perform public.community_ensure_user_account(v_user_id);

  v_username := public.community_normalize_username(p_username);

  if v_username is null or not public.community_username_is_valid(v_username) then
    raise exception 'invalid handle: use 3-30 lowercase letters, numbers, and underscores; start and end with a letter or number';
  end if;

  if public.community_username_is_reserved(v_username) then
    raise exception 'handle % is reserved', v_username;
  end if;

  v_is_admin := public.current_user_is_administrator();

  select * into v_profile
  from public.user_profiles
  where user_id = v_user_id
  for update;

  if not found then
    raise exception 'profile % not found', v_user_id;
  end if;

  if v_profile.username_normalized = v_username then
    return jsonb_build_object(
      'changed', false,
      'profile', public.community_profile_json(v_profile)
    );
  end if;

  if not v_is_admin
    and coalesce(v_profile.username_change_count, 0) > 0
    and v_profile.username_updated_at is not null
    and v_profile.username_updated_at > now() - interval '14 days'
  then
    raise exception 'handle can only be changed once every 14 days';
  end if;

  if exists (
    select 1
    from public.user_profiles up
    where up.username_normalized = v_username
      and up.user_id <> v_user_id
  ) then
    raise exception 'handle % is already taken', v_username;
  end if;

  if exists (
    select 1
    from public.user_profile_username_history h
    where h.old_username_normalized = v_username
      and h.user_id <> v_user_id
      and h.created_at > now() - interval '30 days'
  ) then
    raise exception 'handle % was recently released and is temporarily protected', v_username;
  end if;

  v_old_username := v_profile.username;
  v_old_username_normalized := v_profile.username_normalized;

  update public.user_profiles
  set
    username = v_username,
    username_normalized = v_username,
    username_updated_at = now(),
    username_change_count = coalesce(username_change_count, 0) + 1,
    updated_at = now()
  where user_id = v_user_id
  returning * into v_profile;

  insert into public.user_profile_username_history (
    user_id,
    old_username,
    old_username_normalized,
    new_username,
    new_username_normalized,
    changed_by,
    change_reason
  ) values (
    v_user_id,
    v_old_username,
    v_old_username_normalized,
    v_profile.username,
    v_profile.username_normalized,
    v_user_id,
    'user_update'
  );

  return jsonb_build_object(
    'changed', true,
    'profile', public.community_profile_json(v_profile)
  );
end;
$$;

drop function if exists public.community_create_profile(uuid, text, text);
create function public.community_create_profile(
  p_user_id uuid,
  p_username text,
  p_display_name text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid;
  v_username text;
  v_profile public.user_profiles%rowtype;
begin
  v_actor := auth.uid();

  if v_actor is null then
    raise exception 'authentication required';
  end if;

  if p_user_id <> v_actor and not public.current_user_is_administrator() then
    raise exception 'not allowed';
  end if;

  perform public.community_ensure_user_account(p_user_id);

  v_username := public.community_normalize_username(p_username);

  if v_username is null or not public.community_username_is_valid(v_username) then
    raise exception 'invalid handle: use 3-30 lowercase letters, numbers, and underscores; start and end with a letter or number';
  end if;

  if public.community_username_is_reserved(v_username) then
    raise exception 'handle % is reserved', v_username;
  end if;

  if exists (
    select 1
    from public.user_profiles up
    where up.username_normalized = v_username
      and up.user_id <> p_user_id
  ) then
    raise exception 'handle % is already taken', v_username;
  end if;

  update public.user_profiles
  set
    username = v_username,
    username_normalized = v_username,
    display_name = coalesce(nullif(p_display_name, ''), display_name),
    username_updated_at = coalesce(username_updated_at, now()),
    updated_at = now()
  where user_id = p_user_id
  returning * into v_profile;

  return public.community_profile_json(v_profile);
end;
$$;

grant execute on function public.community_normalize_username(text) to anon, authenticated;
grant execute on function public.community_username_is_valid(text) to anon, authenticated;
grant execute on function public.community_username_is_reserved(text) to anon, authenticated;
grant execute on function public.community_username_available(text) to anon, authenticated;
grant execute on function public.community_update_username(text) to authenticated;
grant execute on function public.community_create_profile(uuid, text, text) to authenticated;
grant execute on function public.community_get_user_profile(uuid) to anon, authenticated;
grant execute on function public.community_get_profile_by_username(text) to anon, authenticated;
grant execute on function public.community_get_profiles_batch(uuid[]) to anon, authenticated;
