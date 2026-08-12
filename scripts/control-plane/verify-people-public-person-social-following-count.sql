do $verify$
declare
  v_row record;
  v_summary jsonb;
  v_expected_followers integer;
  v_expected_following integer;
  v_keys text[];
  v_public_people integer := 0;
  v_follow_reader_def text;
begin
  if to_regprocedure(
       'public.get_public_person_social_summary(uuid)'
     ) is null
     or to_regprocedure(
       'public.community_get_user_follows(uuid)'
     ) is null
  then
    raise exception
      'STOP: Required Person social functions are missing.';
  end if;

  if not has_function_privilege(
       'anon',
       'public.get_public_person_social_summary(uuid)',
       'EXECUTE'
     )
  then
    raise exception
      'STOP: Anonymous readers cannot execute the public Person social summary.';
  end if;

  if has_function_privilege(
       'anon',
       'public.community_get_user_follows(uuid)',
       'EXECUTE'
     )
  then
    raise exception
      'STOP: Anonymous readers can execute the private Following list reader.';
  end if;

  v_follow_reader_def :=
    lower(
      pg_get_functiondef(
        'public.community_get_user_follows(uuid)'::regprocedure
      )
    );

  if v_follow_reader_def !~
       'v_user_id[[:space:]]+uuid[[:space:]]*:=[[:space:]]*auth[.]uid[(][)]'
     or v_follow_reader_def !~
       'if[[:space:]]+p_user_id[[:space:]]+is[[:space:]]+distinct[[:space:]]+from[[:space:]]+v_user_id[[:space:]]+then'
     or v_follow_reader_def !~
       'where[[:space:]]+follow[.]user_id[[:space:]]*=[[:space:]]*v_user_id'
  then
    raise exception
      'STOP: Existing Following list reader is no longer self-only.';
  end if;

  for v_row in
    select
      person.resource_id
    from editorial.people person
    join editorial.resources resource
      on resource.id =
         person.resource_id
     and resource.resource_kind =
         'person'
    where person.person_state =
          'active'
      and resource.lifecycle_state =
          'active'
      and resource.visibility =
          'public'
    order by person.resource_id
  loop
    v_public_people :=
      v_public_people + 1;

    v_summary :=
      public.get_public_person_social_summary(
        v_row.resource_id
      );

    if v_summary is null then
      raise exception
        'STOP: Public Person % has no social summary.',
        v_row.resource_id;
    end if;

    select array_agg(
             key
             order by key
           )
    into v_keys
    from jsonb_object_keys(
           v_summary
         ) as keys(key);

    if v_keys is distinct from
       array[
         'follower_count',
         'following_count',
         'person_id'
       ]::text[]
    then
      raise exception
        'STOP: Public Person social summary exposed unexpected keys for %: %',
        v_row.resource_id,
        v_keys;
    end if;

    select count(*)::integer
    into v_expected_followers
    from public.community_follows follow
    where follow.target_type =
          'person'
      and follow.target_id =
          v_row.resource_id::text;

    select count(
             distinct follow.target_id
           )::integer
    into v_expected_following
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
              v_row.resource_id
          and link.link_state =
              'active'
          and link.user_id =
              follow.user_id
          and profile.status =
              'active'
          and profile.is_public
      );

    if coalesce(
         (
           v_summary ->>
           'follower_count'
         )::integer,
         -1
       ) <>
       v_expected_followers
    then
      raise exception
        'STOP: Follower count mismatch for Person %.',
        v_row.resource_id;
    end if;

    if coalesce(
         (
           v_summary ->>
           'following_count'
         )::integer,
         -1
       ) <>
       v_expected_following
    then
      raise exception
        'STOP: Following count mismatch for Person %.',
        v_row.resource_id;
    end if;
  end loop;

  if v_public_people = 0 then
    raise exception
      'STOP: No public People were available for social-summary verification.';
  end if;
end;
$verify$;


with public_people as (
  select
    person.resource_id,
    public.get_public_person_social_summary(
      person.resource_id
    ) as summary
  from editorial.people person
  join editorial.resources resource
    on resource.id =
       person.resource_id
   and resource.resource_kind =
       'person'
  where person.person_state =
        'active'
    and resource.lifecycle_state =
        'active'
    and resource.visibility =
        'public'
)
select jsonb_build_object(
  'verification',
    'PASS',
  'public_people',
    count(*),
  'follower_count_total',
    coalesce(
      sum(
        (
          summary ->>
          'follower_count'
        )::integer
      ),
      0
    ),
  'following_count_total',
    coalesce(
      sum(
        (
          summary ->>
          'following_count'
        )::integer
      ),
      0
    ),
  'public_identity_lists_exposed',
    false
) as people_public_person_social_following_count
from public_people;
