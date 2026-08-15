-- WAKILISHA: narrow read surfaces for owned Artist Studio launch and public Artist Posts.
-- This migration adds read RPCs only. It does not change tables or write authority.

begin;

do $preflight$
begin
  if to_regclass('public.artist_representations') is null
     or to_regclass('public.artist_profile_presentations') is null
     or to_regclass('public.registry_artists') is null
     or to_regclass('public.community_posts') is null
     or to_regclass('private.phase_0a_rpc_classification') is null then
    raise exception 'STOP: required Artist or Community authority is missing';
  end if;

  if to_regprocedure('public.community_get_post(uuid)') is null then
    raise exception 'STOP: canonical public Post reader is missing';
  end if;

  if to_regprocedure('public.community_get_my_artist_representations()') is not null then
    raise exception 'STOP: community_get_my_artist_representations already exists';
  end if;

  if to_regprocedure('public.community_list_artist_posts(uuid,integer)') is not null then
    raise exception 'STOP: community_list_artist_posts already exists';
  end if;
end;
$preflight$;

create function public.community_get_my_artist_representations()
returns jsonb
language sql
stable
security definer
set search_path = pg_catalog, public, editorial
as $$
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'representation_id', representation.id,
        'role', representation.representation_role,
        'status', representation.status,
        'permissions', jsonb_build_object(
          'profile', representation.can_manage_profile,
          'releases', representation.can_submit_releases,
          'updates', representation.can_post_updates,
          'team', representation.can_manage_team
        ),
        'artist', jsonb_build_object(
          'id', artist.id,
          'slug', artist.slug,
          'name', artist.display_name,
          'image_url', coalesce(
            presentation.profile_image_url,
            artist.public_image_url
          )
        )
      )
      order by
        case representation.status when 'active' then 0 else 1 end,
        representation.created_at,
        representation.id
    ),
    '[]'::jsonb
  )
  from public.artist_representations representation
  join public.registry_artists artist
    on artist.id = representation.artist_id
   and artist.status = 'active'
  left join public.artist_profile_presentations presentation
    on presentation.artist_id = artist.id
  where auth.uid() is not null
    and representation.user_id = auth.uid()
    and representation.status in ('active', 'pending')
$$;

revoke all
on function public.community_get_my_artist_representations()
from public, anon;

grant execute
on function public.community_get_my_artist_representations()
to authenticated, service_role;

create function public.community_list_artist_posts(
  p_artist_id uuid,
  p_limit integer default 20
)
returns jsonb
language sql
stable
security definer
set search_path = pg_catalog, public, editorial
as $$
  select coalesce(
    jsonb_agg(
      public.community_get_post(candidate.id)
      order by candidate.published_at desc, candidate.id desc
    ),
    '[]'::jsonb
  )
  from (
    select
      post.id,
      post.published_at
    from public.community_posts post
    join public.registry_artists artist
      on artist.id = post.artist_id
     and artist.status = 'active'
    where p_artist_id is not null
      and post.actor_type = 'artist'
      and post.artist_id = p_artist_id
      and post.status = 'published'
    order by post.published_at desc, post.id desc
    limit least(
      50,
      greatest(
        1,
        coalesce(p_limit, 20)
      )
    )
  ) candidate
$$;

revoke all
on function public.community_list_artist_posts(uuid, integer)
from public;

grant execute
on function public.community_list_artist_posts(uuid, integer)
to anon, authenticated, service_role;

insert into private.phase_0a_rpc_classification(
  function_signature,
  access_class,
  rationale,
  reviewed_at
)
values
  (
    'community_get_my_artist_representations()',
    'authenticated_read',
    'Reads only the signed-in account active or pending Artist representation choices and their bounded permissions.',
    now()
  ),
  (
    'community_list_artist_posts(uuid,integer)',
    'public_read',
    'Reads only currently published Posts for one active Registry Artist through the canonical public Post reader.',
    now()
  )
on conflict(function_signature)
do update set
  access_class = excluded.access_class,
  rationale = excluded.rationale,
  reviewed_at = excluded.reviewed_at;

commit;
