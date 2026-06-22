-- WAKILISHA Settings: repair avatar storage, profile avatar persistence,
-- and settings-safe Apple Music setup UX.
--
-- The settings UI uploads avatars through the `avatars` storage bucket. Ensure
-- the bucket exists, the object path is owned by the current auth user, and the
-- community profile RPC can persist avatar_url alongside the existing profile
-- fields.

alter table public.user_profiles add column if not exists avatar_url text;
alter table public.user_profiles add column if not exists bio text;
alter table public.user_profiles add column if not exists country text;
alter table public.user_profiles add column if not exists city text;
alter table public.user_profiles add column if not exists is_public boolean;

update public.user_profiles
set is_public = true
where is_public is null;

alter table public.user_profiles alter column is_public set default true;
alter table public.user_profiles alter column is_public set not null;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'avatars',
  'avatars',
  true,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp']::text[]
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists avatars_public_read on storage.objects;
create policy avatars_public_read
  on storage.objects
  for select
  to public
  using (bucket_id = 'avatars');

drop policy if exists avatars_authenticated_insert_own on storage.objects;
create policy avatars_authenticated_insert_own
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists avatars_authenticated_update_own on storage.objects;
create policy avatars_authenticated_update_own
  on storage.objects
  for update
  to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  )
  with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists avatars_authenticated_delete_own on storage.objects;
create policy avatars_authenticated_delete_own
  on storage.objects
  for delete
  to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

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

  return jsonb_build_object(
    'user_id', v_profile.user_id,
    'email', v_profile.email,
    'display_name', coalesce(v_profile.display_name, split_part(coalesce(v_profile.email, ''), '@', 1), 'WAKILISHA user'),
    'bio', coalesce(v_profile.bio, ''),
    'country', coalesce(v_profile.country, ''),
    'city', coalesce(v_profile.city, ''),
    'avatar_url', v_profile.avatar_url,
    'is_public', coalesce(v_profile.is_public, true),
    'created_at', v_profile.created_at,
    'updated_at', v_profile.updated_at
  );
end;
$$;

drop function if exists public.community_update_profile(uuid, text, text, text, text, boolean);
drop function if exists public.community_update_profile(uuid, text, text, text, text, boolean, text, boolean);

create function public.community_update_profile(
  p_user_id uuid,
  p_display_name text default null,
  p_bio text default null,
  p_country text default null,
  p_city text default null,
  p_is_public boolean default true,
  p_avatar_url text default null,
  p_clear_avatar boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_profile public.user_profiles%rowtype;
begin
  perform public.community_ensure_user_account(p_user_id);

  update public.user_profiles
  set
    display_name = p_display_name,
    bio = p_bio,
    country = p_country,
    city = p_city,
    is_public = coalesce(p_is_public, true),
    avatar_url = case
      when coalesce(p_clear_avatar, false) then null
      when p_avatar_url is not null then p_avatar_url
      else avatar_url
    end,
    updated_at = now()
  where user_id = p_user_id
  returning * into v_profile;

  if not found then
    raise exception 'profile % not found', p_user_id;
  end if;

  return jsonb_build_object(
    'user_id', v_profile.user_id,
    'email', v_profile.email,
    'display_name', coalesce(v_profile.display_name, split_part(coalesce(v_profile.email, ''), '@', 1), 'WAKILISHA user'),
    'bio', coalesce(v_profile.bio, ''),
    'country', coalesce(v_profile.country, ''),
    'city', coalesce(v_profile.city, ''),
    'avatar_url', v_profile.avatar_url,
    'is_public', coalesce(v_profile.is_public, true),
    'created_at', v_profile.created_at,
    'updated_at', v_profile.updated_at
  );
end;
$$;

grant execute on function public.community_get_user_profile(uuid) to anon, authenticated;
grant execute on function public.community_update_profile(uuid, text, text, text, text, boolean, text, boolean) to authenticated;
