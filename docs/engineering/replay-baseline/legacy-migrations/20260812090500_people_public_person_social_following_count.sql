-- People public Person social following count.
-- Extends the existing aggregate social summary with a public Following count
-- for public account identities explicitly linked to the Person.
-- No follower/following identity list is exposed.

do $preflight$
begin
  if to_regprocedure(
       'public.get_public_person_social_summary(uuid)'
     ) is null
     or to_regprocedure(
       'public.community_get_user_follows(uuid)'
     ) is null
     or to_regclass(
       'editorial.person_identity_links'
     ) is null
     or to_regclass(
       'editorial.people'
     ) is null
     or to_regclass(
       'editorial.resources'
     ) is null
     or to_regclass(
       'public.user_profiles'
     ) is null
     or to_regclass(
       'public.community_follows'
     ) is null
  then
    raise exception
      'STOP: Required Person social/follow authority is incomplete.';
  end if;
end;
$preflight$;


create or replace function
  public.get_public_person_social_summary(
    p_person_resource_id uuid
  )
returns jsonb
language plpgsql
stable
security definer
set search_path to
  'pg_catalog',
  'public',
  'editorial'
as $function$
declare
  v_person record;
  v_follower_count integer;
  v_following_count integer;
begin
  begin
    select *
    into v_person
    from editorial.resolve_person_follow_target(
      p_person_resource_id
    );
  exception
    when others then
      return null;
  end;

  if not v_person.followable then
    return null;
  end if;

  select count(*)::integer
  into v_follower_count
  from public.community_follows follow
  where follow.target_type =
        'person'
    and follow.target_id =
        v_person.person_resource_id::text;

  select count(
           distinct follow.target_id
         )::integer
  into v_following_count
  from public.community_follows follow
  where follow.target_type =
        'person'
    and exists (
      select 1
      from editorial.person_identity_links link
      join public.user_profiles profile
        on profile.user_id =
           link.user_id
      where link.person_resource_id =
            v_person.person_resource_id
        and link.link_state =
            'active'
        and link.user_id =
            follow.user_id
        and profile.status =
            'active'
        and profile.is_public
    );

  return jsonb_build_object(
    'person_id',
      v_person.person_resource_id,
    'follower_count',
      v_follower_count,
    'following_count',
      v_following_count
  );
end;
$function$;


revoke all on function
  public.get_public_person_social_summary(
    uuid
  )
from public;

grant execute on function
  public.get_public_person_social_summary(
    uuid
  )
to anon, authenticated, service_role;


comment on function
  public.get_public_person_social_summary(
    uuid
  )
is
  'Public Person social aggregate: stable Person id, follower count, and Person-only following count for active public linked accounts. Never returns follower/following identities or lists.';
