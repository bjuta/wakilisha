-- WAKILISHA M8C.3-M2: authored Thread presentation.
-- Keep canonical Post readers authoritative, expose Thread context on each Post,
-- and collapse Thread replies in Following so one authored Thread enters the feed once.

begin;

set local lock_timeout = '5s';
set local statement_timeout = '120s';

do $m8c3_presentation_preflight$
begin
  if to_regclass('public.community_post_threads') is null
     or to_regclass('public.community_posts') is null
     or to_regprocedure('public.community_get_post(uuid)') is null
     or to_regprocedure('public.community_get_social_feed(integer,timestamp with time zone,text)') is null
     or to_regprocedure('public.community_get_thread(uuid)') is null
     or to_regprocedure('public.community_get_post_thread_context(uuid)') is null then
    raise exception 'STOP: M8C.3 Thread authority must exist before presentation';
  end if;

  if to_regprocedure('public.community_get_post_legacy_m8c3(uuid)') is not null
     or to_regprocedure('public.community_get_social_feed_legacy_m8c3(integer,timestamp with time zone,text)') is not null then
    raise exception 'STOP: M8C.3 Thread presentation wrapper already exists';
  end if;
end;
$m8c3_presentation_preflight$;

alter function public.community_get_post(uuid)
rename to community_get_post_legacy_m8c3;

revoke all
on function public.community_get_post_legacy_m8c3(uuid)
from public,anon,authenticated;

grant execute
on function public.community_get_post_legacy_m8c3(uuid)
to service_role;

create function public.community_get_post(
  p_post_id uuid
)
returns jsonb
language plpgsql
stable
security definer
set search_path=pg_catalog,public
as $function$
declare
  v_payload jsonb;
  v_thread_id uuid;
  v_thread_position integer;
begin
  v_payload:=public.community_get_post_legacy_m8c3(p_post_id);
  if v_payload is null then return null; end if;

  select post.thread_id,post.thread_position
  into v_thread_id,v_thread_position
  from public.community_posts post
  where post.id=p_post_id;

  return v_payload || jsonb_build_object(
    'thread_id',v_thread_id,
    'thread_position',v_thread_position
  );
end;
$function$;

revoke all on function public.community_get_post(uuid) from public;
grant execute on function public.community_get_post(uuid) to anon,authenticated;

alter function public.community_get_social_feed(
  integer,
  timestamp with time zone,
  text
)
rename to community_get_social_feed_legacy_m8c3;

revoke all
on function public.community_get_social_feed_legacy_m8c3(
  integer,
  timestamp with time zone,
  text
)
from public,anon,authenticated;

grant execute
on function public.community_get_social_feed_legacy_m8c3(
  integer,
  timestamp with time zone,
  text
)
to service_role;

create function public.community_get_social_feed(
  p_limit integer default 30,
  p_before_published_at timestamp with time zone default null,
  p_before_item_key text default null
)
returns jsonb
language plpgsql
stable
security definer
set search_path=pg_catalog,public
as $function$
declare
  v_feed jsonb;
  v_items jsonb;
begin
  v_feed:=public.community_get_social_feed_legacy_m8c3(
    p_limit,
    p_before_published_at,
    p_before_item_key
  );

  select coalesce(
    jsonb_agg(item.value order by item.ordinality),
    '[]'::jsonb
  )
  into v_items
  from jsonb_array_elements(
    coalesce(v_feed->'items','[]'::jsonb)
  ) with ordinality item(value,ordinality)
  where not (
    item.value->>'item_type' in ('post','artist_update')
    and nullif(item.value->'post'->>'id','') is not null
    and exists (
      select 1
      from public.community_posts post
      where post.id=(item.value->'post'->>'id')::uuid
        and post.thread_id is not null
        and post.status='published'
        and post.thread_position > (
          select min(sibling.thread_position)
          from public.community_posts sibling
          where sibling.thread_id=post.thread_id
            and sibling.status='published'
        )
    )
  );

  return jsonb_set(
    coalesce(v_feed,'{}'::jsonb),
    '{items}',
    v_items,
    true
  );
end;
$function$;

revoke all
on function public.community_get_social_feed(
  integer,
  timestamp with time zone,
  text
)
from public,anon;

grant execute
on function public.community_get_social_feed(
  integer,
  timestamp with time zone,
  text
)
to authenticated;

insert into private.phase_0a_rpc_classification (
  function_signature,access_class,rationale,reviewed_at
)
values
  (
    'community_get_post(uuid)',
    'public_read',
    'Reads one published canonical Post and adds only its authored Thread identity and position when present.',
    now()
  ),
  (
    'community_get_social_feed(integer,timestamp with time zone,text)',
    'authenticated_read',
    'Reads the authenticated social feed while presenting one visible entry per authored Thread and preserving canonical Post payloads.',
    now()
  )
on conflict (function_signature)
do update
set
  access_class=excluded.access_class,
  rationale=excluded.rationale,
  reviewed_at=excluded.reviewed_at;

commit;
