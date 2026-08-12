do $verify_structure$
declare
  v_definition text;
  v_owner_comments_definition text;
  v_owner_replies_definition text;
begin
  if to_regprocedure(
       'public.list_public_person_community_activity(uuid,text,integer)'
     ) is null
  then
    raise exception
      'STOP: Public Person community-activity projection is missing.';
  end if;

  if not has_function_privilege(
       'anon',
       'public.list_public_person_community_activity(uuid,text,integer)',
       'EXECUTE'
     )
     or not has_function_privilege(
       'authenticated',
       'public.list_public_person_community_activity(uuid,text,integer)',
       'EXECUTE'
     )
  then
    raise exception
      'STOP: Public Person community-activity grants are incomplete.';
  end if;

  if not exists (
    select 1
    from private.phase_0a_rpc_classification
    where function_signature =
          'list_public_person_community_activity(uuid,text,integer)'
      and access_class =
          'public_read'
  ) then
    raise exception
      'STOP: Public Person community-activity RPC is not classified as public_read.';
  end if;

  v_definition :=
    lower(
      pg_get_functiondef(
        'public.list_public_person_community_activity(uuid,text,integer)'::regprocedure
      )
    );

  if position(
       'person_identity_links'
       in v_definition
     ) = 0
     or position(
       'link.link_state'
       in v_definition
     ) = 0
     or position(
       'profile.is_public'
       in v_definition
     ) = 0
     or position(
       'resource.visibility'
       in v_definition
     ) = 0
     or position(
       'comment_row.deleted_at'
       in v_definition
     ) = 0
     or position(
       'thread.status'
       in v_definition
     ) = 0
     or position(
       'comment_row.parent_id'
       in v_definition
     ) = 0
  then
    raise exception
      'STOP: Public Person community-activity privacy or identity guards are incomplete.';
  end if;

  v_owner_comments_definition :=
    lower(
      pg_get_functiondef(
        'public.community_get_user_comments(uuid,integer)'::regprocedure
      )
    );

  v_owner_replies_definition :=
    lower(
      pg_get_functiondef(
        'public.community_get_user_replies(uuid,integer)'::regprocedure
      )
    );

  if position(
       'auth.uid()'
       in v_owner_comments_definition
     ) = 0
     or position(
       'auth.uid()'
       in v_owner_replies_definition
     ) = 0
  then
    raise exception
      'STOP: Existing account-owned comment/reply RPCs lost their self-service guard.';
  end if;
end;
$verify_structure$;


do $verify_live_rows$
begin
  if exists (
    with account_people as (
      select
        link.person_resource_id,
        link.user_id
      from editorial.person_identity_links link
      join editorial.people person
        on person.resource_id =
           link.person_resource_id
      join editorial.resources resource
        on resource.id =
           person.resource_id
       and resource.resource_kind =
           'person'
      join public.user_profiles profile
        on profile.user_id =
           link.user_id
      where link.link_state =
            'active'
        and link.user_id is not null
        and person.person_state =
            'active'
        and resource.lifecycle_state =
            'active'
        and resource.visibility =
            'public'
        and profile.status =
            'active'
        and profile.is_public
    )
    select 1
    from account_people account_person
    cross join lateral
      public.list_public_person_community_activity(
        account_person.person_resource_id,
        'comment',
        50
      ) activity
    join public.community_threads thread
      on thread.id =
         activity.thread_id
    where activity.author_id
          is distinct from
          account_person.user_id
       or activity.parent_id
          is not null
       or activity.deleted_at
          is not null
       or activity.status
          in (
            'deleted',
            'removed',
            'spam'
          )
       or thread.status::text =
          'hidden'
  ) then
    raise exception
      'STOP: Public Person Comment projection leaked a non-public or wrong-account row.';
  end if;

  if exists (
    with account_people as (
      select
        link.person_resource_id,
        link.user_id
      from editorial.person_identity_links link
      join editorial.people person
        on person.resource_id =
           link.person_resource_id
      join editorial.resources resource
        on resource.id =
           person.resource_id
       and resource.resource_kind =
           'person'
      join public.user_profiles profile
        on profile.user_id =
           link.user_id
      where link.link_state =
            'active'
        and link.user_id is not null
        and person.person_state =
            'active'
        and resource.lifecycle_state =
            'active'
        and resource.visibility =
            'public'
        and profile.status =
            'active'
        and profile.is_public
    )
    select 1
    from account_people account_person
    cross join lateral
      public.list_public_person_community_activity(
        account_person.person_resource_id,
        'reply',
        50
      ) activity
    join public.community_threads thread
      on thread.id =
         activity.thread_id
    where activity.author_id
          is distinct from
          account_person.user_id
       or activity.parent_id
          is null
       or activity.deleted_at
          is not null
       or activity.status
          in (
            'deleted',
            'removed',
            'spam'
          )
       or thread.status::text =
          'hidden'
  ) then
    raise exception
      'STOP: Public Person Reply projection leaked a non-public or wrong-account row.';
  end if;
end;
$verify_live_rows$;


select jsonb_build_object(
  'verification',
    'PASS',
  'active_account_people',
    (
      select count(*)
      from editorial.person_identity_links link
      join editorial.people person
        on person.resource_id =
           link.person_resource_id
      join editorial.resources resource
        on resource.id =
           person.resource_id
       and resource.resource_kind =
           'person'
      join public.user_profiles profile
        on profile.user_id =
           link.user_id
      where link.link_state =
            'active'
        and link.user_id is not null
        and person.person_state =
            'active'
        and resource.lifecycle_state =
            'active'
        and resource.visibility =
            'public'
        and profile.status =
            'active'
        and profile.is_public
    ),
  'public_comment_rows_sampled',
    (
      select count(*)
      from editorial.person_identity_links link
      cross join lateral
        public.list_public_person_community_activity(
          link.person_resource_id,
          'comment',
          50
        ) activity
      where link.link_state =
            'active'
        and link.user_id is not null
    ),
  'public_reply_rows_sampled',
    (
      select count(*)
      from editorial.person_identity_links link
      cross join lateral
        public.list_public_person_community_activity(
          link.person_resource_id,
          'reply',
          50
        ) activity
      where link.link_state =
            'active'
        and link.user_id is not null
    )
) as people_public_community_activity;
