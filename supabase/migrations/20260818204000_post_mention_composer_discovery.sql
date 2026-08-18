-- WAKILISHA M8C.4-M2: authenticated Mention discovery for the Post composer.
-- Published Mention authority remains server-owned by the canonical M8C.4 resolver.

begin;

set local lock_timeout = '5s';
set local statement_timeout = '120s';

do $m8c4_m2_preflight$
begin
  if to_regclass('public.user_profiles') is null
     or to_regclass('editorial.person_identity_links') is null
     or to_regprocedure('editorial.resolve_person_follow_target(uuid)') is null
     or to_regprocedure('public.community_get_post_mentions(uuid)') is null
     or to_regprocedure('private.community_resolve_post_mentions(text)') is null then
    raise exception 'STOP: M8C.4-M2 requires accepted Person and Mention authority';
  end if;

  if to_regprocedure('public.community_search_mention_suggestions(text,integer)') is not null then
    raise exception 'STOP: Post Mention composer discovery already exists';
  end if;
end;
$m8c4_m2_preflight$;

create function public.community_search_mention_suggestions(
  p_query text,
  p_limit integer default 8
)
returns table (
  handle text,
  display_name text,
  avatar_url text,
  person_id uuid,
  canonical_path text
)
language sql
stable
security definer
set search_path=pg_catalog,public,editorial,private
as $function$
  with input as (
    select
      lower(btrim(coalesce(p_query,''))) as query,
      least(greatest(coalesce(p_limit,8),1),8) as result_limit
  ),
  candidates as (
    select
      profile.username_normalized as handle,
      coalesce(
        nullif(btrim(profile.display_name),''),
        profile.username_normalized
      ) as display_name,
      profile.avatar_url,
      resolved.person_resource_id as person_id,
      resolved.canonical_path,
      case
        when profile.username_normalized like input.query || '%' then 0
        else 1
      end as username_rank,
      case
        when lower(coalesce(profile.display_name,'')) like input.query || '%' then 0
        else 1
      end as display_rank
    from input
    join public.user_profiles profile
      on profile.status='active'
     and profile.is_public
    join editorial.person_identity_links link
      on link.user_id=profile.user_id
     and link.link_state='active'
    cross join lateral editorial.resolve_person_follow_target(
      link.person_resource_id
    ) resolved
    where resolved.followable
      and input.query ~ '^[a-z0-9_]{1,30}$'
      and (
        profile.username_normalized like input.query || '%'
        or lower(coalesce(profile.display_name,'')) like '%' || input.query || '%'
      )
  )
  select
    candidate.handle,
    candidate.display_name,
    candidate.avatar_url,
    candidate.person_id,
    candidate.canonical_path
  from candidates candidate
  order by
    candidate.username_rank,
    candidate.display_rank,
    candidate.handle
  limit (
    select input.result_limit
    from input
  );
$function$;

revoke all
on function public.community_search_mention_suggestions(text,integer)
from public,anon,authenticated;

grant execute
on function public.community_search_mention_suggestions(text,integer)
to authenticated,service_role;

comment on function public.community_search_mention_suggestions(text,integer) is
  'Authenticated Post composer discovery over the same active public Person-backed usernames used by canonical Post Mention authority.';

commit;
