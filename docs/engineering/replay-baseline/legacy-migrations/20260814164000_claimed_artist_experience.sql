-- WAKILISHA M3: Claimed Artist experience.
--
-- Constitution:
-- - registry_artists remains canonical cultural identity authority.
-- - verified Artist representatives may manage bounded public presentation only.
-- - canonical Registry facts are never written by claimed-Artist commands.
-- - Registry corrections enter the existing community contribution and correction path.
-- - M2 remains authority for claims, representation, permissions, and team lifecycle.

begin;

do $m3_preflight$
begin
  if to_regclass('public.registry_artists') is null
     or to_regclass('public.artist_representations') is null
     or to_regclass('public.artist_claim_requests') is null
     or to_regclass('public.artist_representation_events') is null
     or to_regclass('public.user_profiles') is null
     or to_regclass('public.community_contributions') is null
  then
    raise exception
      'STOP: Required Registry, M2 representation, account, or contribution authority is missing';
  end if;

  if to_regprocedure('public.community_get_artist_representation_state(uuid)') is null
     or to_regprocedure('public.community_submit_artist_claim(uuid,text,text,jsonb)') is null
     or to_regprocedure('public.community_admin_get_artist_claims(text,integer)') is null
     or to_regprocedure('public.community_admin_decide_artist_claim(uuid,text,text,boolean,boolean,boolean,boolean)') is null
     or to_regprocedure('public.community_artist_invite_representative(uuid,text,text,boolean,boolean,boolean,boolean)') is null
     or to_regprocedure('public.community_artist_accept_representation(uuid)') is null
     or to_regprocedure('public.community_artist_update_representative(uuid,text,boolean,boolean,boolean,boolean)') is null
     or to_regprocedure('public.community_artist_revoke_representation(uuid,text)') is null
     or to_regprocedure('public.community_create_contribution(uuid,text,text,text,text,jsonb)') is null
     or to_regprocedure('editorial.record_artist_representation_event(uuid,text,uuid,uuid,uuid,jsonb)') is null
  then
    raise exception
      'STOP: Required M2 or contribution command authority is missing';
  end if;

  if to_regclass('public.artist_profile_presentations') is not null then
    raise exception
      'STOP: M3 Artist presentation authority already exists';
  end if;
end;
$m3_preflight$;

create table public.artist_profile_presentations (
  artist_id uuid primary key
    references public.registry_artists(id)
    on delete cascade,
  bio text,
  profile_image_url text,
  hero_image_url text,
  website_url text,
  public_email text,
  social_links jsonb not null default '{}'::jsonb,
  updated_by uuid
    references auth.users(id)
    on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint artist_profile_presentations_bio_length
    check (
      bio is null
      or char_length(bio) <= 4000
    ),
  constraint artist_profile_presentations_profile_image_url_length
    check (
      profile_image_url is null
      or char_length(profile_image_url) <= 2048
    ),
  constraint artist_profile_presentations_hero_image_url_length
    check (
      hero_image_url is null
      or char_length(hero_image_url) <= 2048
    ),
  constraint artist_profile_presentations_website_url_length
    check (
      website_url is null
      or char_length(website_url) <= 2048
    ),
  constraint artist_profile_presentations_public_email_length
    check (
      public_email is null
      or char_length(public_email) <= 320
    ),
  constraint artist_profile_presentations_social_links_object
    check (
      jsonb_typeof(social_links) = 'object'
    )
);

alter table public.artist_profile_presentations
  enable row level security;

revoke all
on table public.artist_profile_presentations
from anon, authenticated;

alter table public.artist_representation_events
  drop constraint artist_representation_events_event_type_check;

alter table public.artist_representation_events
  add constraint artist_representation_events_event_type_check
  check (
    event_type in (
      'claim_submitted',
      'claim_withdrawn',
      'claim_verified',
      'claim_rejected',
      'representation_invited',
      'representation_accepted',
      'representation_updated',
      'representation_revoked',
      'profile_presentation_updated'
    )
  );

create or replace function editorial.current_artist_representation(
  p_artist_id uuid
)
returns public.artist_representations
language sql
stable
security definer
set search_path = pg_catalog, public, editorial
as $$
  select representation.*
  from public.artist_representations representation
  where representation.artist_id = p_artist_id
    and representation.user_id = auth.uid()
    and representation.status = 'active'
  order by representation.created_at desc
  limit 1
$$;

revoke all
on function editorial.current_artist_representation(uuid)
from public, anon, authenticated;

create or replace function public.community_get_artist_public_presentation(
  p_artist_id uuid
)
returns jsonb
language plpgsql
stable
security definer
set search_path = pg_catalog, public, editorial
as $$
declare
  v_result jsonb;
begin
  select jsonb_build_object(
    'artist_id', artist.id,
    'official', exists (
      select 1
      from public.artist_representations representation
      where representation.artist_id = artist.id
        and representation.status = 'active'
    ),
    'presentation', (
      select jsonb_build_object(
        'bio', presentation.bio,
        'profile_image_url', presentation.profile_image_url,
        'hero_image_url', presentation.hero_image_url,
        'website_url', presentation.website_url,
        'public_email', presentation.public_email,
        'social_links', presentation.social_links,
        'updated_at', presentation.updated_at
      )
      from public.artist_profile_presentations presentation
      where presentation.artist_id = artist.id
    )
  )
  into v_result
  from public.registry_artists artist
  where artist.id = p_artist_id
    and artist.status = 'active';

  if v_result is null then
    raise exception 'artist_not_found';
  end if;

  return v_result;
end;
$$;

grant execute
on function public.community_get_artist_public_presentation(uuid)
to anon, authenticated;

create or replace function public.community_save_artist_profile_presentation(
  p_artist_id uuid,
  p_bio text default null,
  p_profile_image_url text default null,
  p_hero_image_url text default null,
  p_website_url text default null,
  p_public_email text default null,
  p_social_links jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, editorial
as $$
declare
  v_actor uuid := auth.uid();
  v_rep public.artist_representations%rowtype;
  v_bio text := nullif(trim(coalesce(p_bio, '')), '');
  v_profile_image_url text := nullif(trim(coalesce(p_profile_image_url, '')), '');
  v_hero_image_url text := nullif(trim(coalesce(p_hero_image_url, '')), '');
  v_website_url text := nullif(trim(coalesce(p_website_url, '')), '');
  v_public_email text := nullif(lower(trim(coalesce(p_public_email, ''))), '');
  v_social_links jsonb := coalesce(p_social_links, '{}'::jsonb);
  v_key text;
  v_value text;
  v_result jsonb;
begin
  if v_actor is null then
    raise exception 'authentication_required';
  end if;

  select *
  into v_rep
  from editorial.current_artist_representation(p_artist_id);

  if v_rep.id is null
     or not v_rep.can_manage_profile
  then
    raise exception 'insufficient_artist_profile_privilege';
  end if;

  if v_bio is not null
     and char_length(v_bio) > 4000
  then
    raise exception 'artist_bio_too_long';
  end if;

  if v_profile_image_url is not null
     and (
       char_length(v_profile_image_url) > 2048
       or v_profile_image_url !~* '^https?://'
     )
  then
    raise exception 'invalid_profile_image_url';
  end if;

  if v_hero_image_url is not null
     and (
       char_length(v_hero_image_url) > 2048
       or v_hero_image_url !~* '^https?://'
     )
  then
    raise exception 'invalid_hero_image_url';
  end if;

  if v_website_url is not null
     and (
       char_length(v_website_url) > 2048
       or v_website_url !~* '^https?://'
     )
  then
    raise exception 'invalid_artist_website_url';
  end if;

  if v_public_email is not null
     and (
       char_length(v_public_email) > 320
       or v_public_email !~* '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'
     )
  then
    raise exception 'invalid_public_email';
  end if;

  if jsonb_typeof(v_social_links) <> 'object' then
    raise exception 'artist_social_links_must_be_object';
  end if;

  for v_key, v_value in
    select key, value
    from jsonb_each_text(v_social_links)
  loop
    if v_key not in (
      'instagram',
      'tiktok',
      'x',
      'youtube',
      'facebook',
      'spotify',
      'soundcloud'
    ) then
      raise exception 'unsupported_artist_social_link';
    end if;

    if nullif(trim(v_value), '') is not null
       and (
         char_length(v_value) > 2048
         or v_value !~* '^https?://'
       )
    then
      raise exception 'invalid_artist_social_link';
    end if;
  end loop;

  insert into public.artist_profile_presentations (
    artist_id,
    bio,
    profile_image_url,
    hero_image_url,
    website_url,
    public_email,
    social_links,
    updated_by
  )
  values (
    p_artist_id,
    v_bio,
    v_profile_image_url,
    v_hero_image_url,
    v_website_url,
    v_public_email,
    v_social_links,
    v_actor
  )
  on conflict (artist_id)
  do update set
    bio = excluded.bio,
    profile_image_url = excluded.profile_image_url,
    hero_image_url = excluded.hero_image_url,
    website_url = excluded.website_url,
    public_email = excluded.public_email,
    social_links = excluded.social_links,
    updated_by = excluded.updated_by,
    updated_at = now()
  returning jsonb_build_object(
    'artist_id', artist_id,
    'bio', bio,
    'profile_image_url', profile_image_url,
    'hero_image_url', hero_image_url,
    'website_url', website_url,
    'public_email', public_email,
    'social_links', social_links,
    'updated_at', updated_at
  )
  into v_result;

  perform editorial.record_artist_representation_event(
    p_artist_id,
    'profile_presentation_updated',
    null,
    v_rep.id,
    v_actor,
    jsonb_build_object(
      'presentation_updated_at', now()
    )
  );

  return v_result;
end;
$$;

revoke all
on function public.community_save_artist_profile_presentation(uuid,text,text,text,text,text,jsonb)
from public, anon;

grant execute
on function public.community_save_artist_profile_presentation(uuid,text,text,text,text,text,jsonb)
to authenticated;

create or replace function public.community_get_artist_team(
  p_artist_id uuid
)
returns jsonb
language plpgsql
stable
security definer
set search_path = pg_catalog, public, editorial
as $$
declare
  v_actor uuid := auth.uid();
  v_actor_rep public.artist_representations%rowtype;
  v_result jsonb;
begin
  if v_actor is null then
    raise exception 'authentication_required';
  end if;

  select *
  into v_actor_rep
  from editorial.current_artist_representation(p_artist_id);

  if v_actor_rep.id is null
     or not v_actor_rep.can_manage_team
  then
    raise exception 'insufficient_artist_team_privilege';
  end if;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'representation_id', representation.id,
        'user_id', representation.user_id,
        'username', profile.username,
        'display_name', profile.display_name,
        'role', representation.representation_role,
        'status', representation.status,
        'permissions', jsonb_build_object(
          'profile', representation.can_manage_profile,
          'releases', representation.can_submit_releases,
          'updates', representation.can_post_updates,
          'team', representation.can_manage_team
        ),
        'invited_at', representation.invited_at,
        'accepted_at', representation.accepted_at,
        'verified_at', representation.verified_at
      )
      order by
        case representation.status
          when 'active' then 0
          else 1
        end,
        representation.created_at asc
    ),
    '[]'::jsonb
  )
  into v_result
  from public.artist_representations representation
  left join public.user_profiles profile
    on profile.user_id = representation.user_id
  where representation.artist_id = p_artist_id
    and representation.status in ('pending', 'active');

  return v_result;
end;
$$;

revoke all
on function public.community_get_artist_team(uuid)
from public, anon;

grant execute
on function public.community_get_artist_team(uuid)
to authenticated;

create or replace function public.community_submit_artist_registry_correction(
  p_artist_id uuid,
  p_field_key text,
  p_proposed_value text,
  p_reason text
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, editorial
as $$
declare
  v_actor uuid := auth.uid();
  v_rep public.artist_representations%rowtype;
  v_artist_slug text;
  v_field_key text := lower(trim(coalesce(p_field_key, '')));
  v_proposed_value text := trim(coalesce(p_proposed_value, ''));
  v_reason text := trim(coalesce(p_reason, ''));
  v_result jsonb;
begin
  if v_actor is null then
    raise exception 'authentication_required';
  end if;

  select *
  into v_rep
  from editorial.current_artist_representation(p_artist_id);

  if v_rep.id is null
     or not v_rep.can_manage_profile
  then
    raise exception 'insufficient_artist_profile_privilege';
  end if;

  if v_field_key not in (
    'display_name',
    'artist_type',
    'origin_iso2',
    'discography',
    'credits',
    'other'
  ) then
    raise exception 'unsupported_registry_correction_field';
  end if;

  if char_length(v_proposed_value) < 1
     or char_length(v_proposed_value) > 4000
  then
    raise exception 'invalid_registry_correction_value';
  end if;

  if char_length(v_reason) < 10
     or char_length(v_reason) > 4000
  then
    raise exception 'invalid_registry_correction_reason';
  end if;

  select artist.slug
  into v_artist_slug
  from public.registry_artists artist
  where artist.id = p_artist_id
    and artist.status = 'active';

  if v_artist_slug is null then
    raise exception 'artist_not_found';
  end if;

  v_result := public.community_create_contribution(
    null,
    'artist',
    p_artist_id::text,
    v_artist_slug,
    'artist_registry_correction',
    jsonb_build_object(
      'field_key', v_field_key,
      'proposed_value', v_proposed_value,
      'reason', v_reason,
      'representation_id', v_rep.id
    )
  );

  return v_result;
end;
$$;

revoke all
on function public.community_submit_artist_registry_correction(uuid,text,text,text)
from public, anon;

grant execute
on function public.community_submit_artist_registry_correction(uuid,text,text,text)
to authenticated;

commit;
