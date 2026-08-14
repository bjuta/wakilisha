-- People public community activity.
-- Exposes only public Comment/Reply presentation for an account explicitly linked
-- to an active public Person. Existing owner-only account RPCs remain unchanged.

do $preflight$
begin
  if to_regprocedure(
       'public.community_get_user_comments(uuid,integer)'
     ) is null
     or to_regprocedure(
       'public.community_get_user_replies(uuid,integer)'
     ) is null
     or to_regprocedure(
       'public.get_public_person(text)'
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
  then
    raise exception
      'STOP: Required People/community authority is incomplete.';
  end if;
end;
$preflight$;


create or replace function
  public.list_public_person_community_activity(
    p_person_resource_id uuid,
    p_activity_kind text default 'comment',
    p_limit integer default 20
  )
returns table(
  id uuid,
  thread_id uuid,
  parent_id uuid,
  root_id uuid,
  author_id uuid,
  body_markdown text,
  body_plain text,
  body_html text,
  depth integer,
  path text,
  status text,
  is_pinned boolean,
  is_editor_pick boolean,
  upvote_count integer,
  downvote_count integer,
  reply_count integer,
  reaction_count integer,
  report_count integer,
  score integer,
  created_at timestamptz,
  updated_at timestamptz,
  edited_at timestamptz,
  deleted_at timestamptz,
  thread_title text,
  thread_entity_type text,
  thread_entity_id text,
  thread_entity_slug text,
  thread_entity_url text,
  anchor_type text,
  anchor_time_ms integer,
  anchor_end_time_ms integer,
  anchor_label text,
  context_entity_type text,
  context_entity_id text,
  context_entity_slug text,
  context_label text
)
language plpgsql
stable
security definer
set search_path to
  'pg_catalog',
  'public',
  'editorial'
as $function$
declare
  v_user_id uuid;
  v_activity_kind text :=
    lower(
      btrim(
        coalesce(
          p_activity_kind,
          ''
        )
      )
    );
begin
  if p_person_resource_id is null then
    raise exception
      'Person is required'
      using errcode = '22023';
  end if;

  if v_activity_kind not in (
    'comment',
    'reply'
  ) then
    raise exception
      'Activity kind must be comment or reply'
      using errcode = '22023';
  end if;

  select link.user_id
  into v_user_id
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
  where link.person_resource_id =
        p_person_resource_id
    and link.link_state =
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
  limit 1;

  if v_user_id is null then
    return;
  end if;

  return query
  select
    comment_row.id,
    comment_row.thread_id,
    comment_row.parent_id,
    comment_row.root_id,
    comment_row.author_id,
    comment_row.body_markdown,
    comment_row.body_plain,
    comment_row.body_html,
    coalesce(
      comment_row.depth,
      0
    )::integer,
    comment_row.path::text,
    comment_row.status::text,
    coalesce(
      comment_row.is_pinned,
      false
    ),
    coalesce(
      comment_row.is_editor_pick,
      false
    ),
    coalesce(
      comment_row.upvote_count,
      0
    )::integer,
    coalesce(
      comment_row.downvote_count,
      0
    )::integer,
    coalesce(
      comment_row.reply_count,
      0
    )::integer,
    coalesce(
      comment_row.reaction_count,
      0
    )::integer,
    coalesce(
      comment_row.report_count,
      0
    )::integer,
    coalesce(
      comment_row.score,
      0
    )::integer,
    comment_row.created_at,
    comment_row.updated_at,
    comment_row.edited_at,
    comment_row.deleted_at,
    thread.title,
    thread.entity_type::text,
    thread.entity_id::text,
    thread.entity_slug,
    thread.entity_url,
    comment_row.anchor_type,
    comment_row.anchor_time_ms,
    comment_row.anchor_end_time_ms,
    comment_row.anchor_label,
    comment_row.context_entity_type,
    comment_row.context_entity_id,
    comment_row.context_entity_slug,
    comment_row.context_label
  from public.community_comments comment_row
  join public.community_threads thread
    on thread.id =
       comment_row.thread_id
  where comment_row.author_id =
        v_user_id
    and (
      (
        v_activity_kind =
        'comment'
        and comment_row.parent_id
            is null
      )
      or
      (
        v_activity_kind =
        'reply'
        and comment_row.parent_id
            is not null
      )
    )
    and comment_row.deleted_at
        is null
    and comment_row.status::text
        not in (
          'deleted',
          'removed',
          'spam'
        )
    and thread.status::text <>
        'hidden'
  order by
    comment_row.created_at desc,
    comment_row.id desc
  limit least(
    greatest(
      coalesce(
        p_limit,
        20
      ),
      1
    ),
    50
  );
end;
$function$;


comment on function
  public.list_public_person_community_activity(
    uuid,
    text,
    integer
  )
is
  'Public Comment/Reply projection for an active public account-linked Person. Does not expose Saves, Following lists, follower identities, private profile state, or unlinked account activity.';


revoke all on function
  public.list_public_person_community_activity(
    uuid,
    text,
    integer
  )
from public;

revoke execute on function
  public.list_public_person_community_activity(
    uuid,
    text,
    integer
  )
from anon, authenticated, service_role;

grant execute on function
  public.list_public_person_community_activity(
    uuid,
    text,
    integer
  )
to anon, authenticated, service_role;


insert into private.phase_0a_rpc_classification (
  function_signature,
  access_class,
  rationale,
  reviewed_at
)
values (
  'list_public_person_community_activity(uuid,text,integer)',
  'public_read',
  'Reviewed public Person community-activity projection. Resolves only an explicit active account identity link and returns only public-safe Comment/Reply presentation.',
  now()
)
on conflict (function_signature)
do update
set
  access_class =
    excluded.access_class,
  rationale =
    excluded.rationale,
  reviewed_at =
    excluded.reviewed_at;
