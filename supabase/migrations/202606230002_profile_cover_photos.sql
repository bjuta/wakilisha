-- WAKILISHA Community: commercial-grade profile cover photos.
--
-- Profile covers are public identity media. They must be account-scoped,
-- size-limited, MIME-limited, persisted on user_profiles, and returned from
-- the canonical profile JSON used across private/public profile surfaces.

alter table public.user_profiles add column if not exists cover_url text;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'profile-covers',
  'profile-covers',
  true,
  8388608,
  array['image/jpeg', 'image/png', 'image/webp']::text[]
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists profile_covers_public_read on storage.objects;
create policy profile_covers_public_read
  on storage.objects
  for select
  to public
  using (bucket_id = 'profile-covers');

drop policy if exists profile_covers_authenticated_insert_own on storage.objects;
create policy profile_covers_authenticated_insert_own
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'profile-covers'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists profile_covers_authenticated_update_own on storage.objects;
create policy profile_covers_authenticated_update_own
  on storage.objects
  for update
  to authenticated
  using (
    bucket_id = 'profile-covers'
    and (storage.foldername(name))[1] = auth.uid()::text
  )
  with check (
    bucket_id = 'profile-covers'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists profile_covers_authenticated_delete_own on storage.objects;
create policy profile_covers_authenticated_delete_own
  on storage.objects
  for delete
  to authenticated
  using (
    bucket_id = 'profile-covers'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

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
    'cover_url', p_profile.cover_url,
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

drop function if exists public.community_update_profile(uuid, text, text, text, text, boolean);
drop function if exists public.community_update_profile(uuid, text, text, text, text, boolean, text, boolean);
drop function if exists public.community_update_profile(uuid, text, text, text, text, boolean, text, boolean, text, boolean);

create function public.community_update_profile(
  p_user_id uuid,
  p_display_name text default null,
  p_bio text default null,
  p_country text default null,
  p_city text default null,
  p_is_public boolean default true,
  p_avatar_url text default null,
  p_clear_avatar boolean default false,
  p_cover_url text default null,
  p_clear_cover boolean default false
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
    cover_url = case
      when coalesce(p_clear_cover, false) then null
      when p_cover_url is not null then p_cover_url
      else cover_url
    end,
    updated_at = now()
  where user_id = p_user_id
  returning * into v_profile;

  if not found then
    raise exception 'profile % not found', p_user_id;
  end if;

  return public.community_profile_json(v_profile);
end;
$$;

grant execute on function public.community_update_profile(uuid, text, text, text, text, boolean, text, boolean, text, boolean) to authenticated;
