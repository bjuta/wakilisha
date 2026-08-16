-- WAKILISHA M8B-M2: Quote Post presentation, Repost feed activity, and Block-aware social reads.
-- Reposts remain Post content with a distinct activity key, while Quote Posts remain canonical Posts.

begin;

do $m8b_m2_preflight$
begin
  if to_regclass('public.community_posts') is null
     or to_regclass('public.community_post_reposts') is null
     or to_regclass('public.community_blocks') is null then
    raise exception 'STOP: M8B-M1 authority is required before M8B-M2';
  end if;

  if not exists (
    select 1
    from information_schema.columns
    where table_schema='public'
      and table_name='community_posts'
      and column_name='quoted_post_id'
  ) then
    raise exception 'STOP: M8B-M1 quoted Post authority is missing';
  end if;

  if to_regprocedure('private.community_is_blocked_target(uuid,text,text)') is null
     or to_regprocedure('public.community_get_post(uuid)') is null
     or to_regprocedure('public.community_get_social_feed(integer,timestamp with time zone,text)') is null then
    raise exception 'STOP: required M8B-M1 and M7 reader authority is incomplete';
  end if;

  if to_regprocedure('private.community_present_post_actor(text,uuid,uuid)') is not null
     or to_regprocedure('public.community_get_social_feed_legacy_m8b(integer,timestamp with time zone,text)') is not null then
    raise exception 'STOP: M8B-M2 read authority already exists';
  end if;
end;
$m8b_m2_preflight$;

create or replace function private.community_present_post_actor(
  p_actor_type text,
  p_person_resource_id uuid,
  p_artist_id uuid
)
returns jsonb
language plpgsql
stable
security definer
set search_path=pg_catalog,public,editorial,private
as $$
declare
  v_type text:=lower(btrim(coalesce(p_actor_type,'')));
  v_actor jsonb;
begin
  if v_type='person' and p_person_resource_id is not null then
    select jsonb_build_object(
      'type','person',
      'id',person.resource_id,
      'slug',regexp_replace(alias.path,'^/people/',''),
      'name',presentation.value->>'display_name',
      'image_url',presentation.value->>'avatar_url',
      'canonical_path',alias.path,
      'official',false
    )
    into v_actor
    from editorial.people person
    join editorial.resources resource
      on resource.id=person.resource_id
     and resource.resource_kind='person'
    join editorial.person_identity_links link
      on link.person_resource_id=person.resource_id
     and link.link_state='active'
     and link.user_id is not null
    join public.user_profiles profile
      on profile.user_id=link.user_id
     and profile.status='active'
     and profile.is_public
    cross join lateral (
      select editorial.resolve_person_presentation(
        person.resource_id
      ) as value
    ) presentation
    join lateral (
      select candidate.path
      from editorial.resource_aliases candidate
      where candidate.resource_id=person.resource_id
        and candidate.is_canonical
        and candidate.retired_at is null
      order by candidate.created_at
      limit 1
    ) alias on true
    where person.resource_id=p_person_resource_id
      and person.person_state='active'
      and resource.lifecycle_state='active'
      and resource.visibility='public'
      and nullif(
        btrim(
          coalesce(
            presentation.value->>'display_name',
            ''
          )
        ),
        ''
      ) is not null
    limit 1;

    return v_actor;
  end if;

  if v_type='artist' and p_artist_id is not null then
    select jsonb_build_object(
      'type','artist',
      'id',artist.id,
      'slug',artist.slug,
      'name',artist.display_name,
      'image_url',coalesce(
        presentation.profile_image_url,
        artist.public_image_url
      ),
      'canonical_path','/artists/'||artist.slug,
      'official',true
    )
    into v_actor
    from public.registry_artists artist
    left join public.artist_profile_presentations presentation
      on presentation.artist_id=artist.id
    where artist.id=p_artist_id
      and artist.status='active'
    limit 1;

    return v_actor;
  end if;

  return null;
end;
$$;

revoke all on function private.community_present_post_actor(text,uuid,uuid)
from public,anon,authenticated;

create or replace function private.community_guard_quoted_post_link()
returns trigger
language plpgsql
security definer
set search_path=pg_catalog,public,private
as $$
begin
  if new.quoted_post_id is distinct from old.quoted_post_id then
    raise exception
      'quoted_post_link_is_immutable'
      using errcode='22023';
  end if;

  return new;
end;
$$;

revoke all on function private.community_guard_quoted_post_link()
from public,anon,authenticated;

create trigger trg_community_posts_quoted_post_immutable
before update of quoted_post_id
on public.community_posts
for each row
execute function private.community_guard_quoted_post_link();

create or replace function public.community_get_post(
  p_post_id uuid
)
returns jsonb
language plpgsql
stable
security definer
set search_path=pg_catalog,public,editorial,private
as $$
declare
  v_post public.community_posts%rowtype;
  v_actor jsonb;
  v_actor_path text;
  v_quoted public.community_posts%rowtype;
  v_quoted_actor jsonb;
  v_quoted_actor_path text;
  v_quoted_payload jsonb;
begin
  select *
  into v_post
  from public.community_posts post
  where post.id=p_post_id
    and post.status='published';

  if not found then
    return null;
  end if;

  v_actor:=private.community_present_post_actor(
    v_post.actor_type,
    v_post.person_resource_id,
    v_post.artist_id
  );

  if v_actor is null then
    return null;
  end if;

  v_actor_path:=v_actor->>'canonical_path';

  if v_post.quoted_post_id is not null then
    select *
    into v_quoted
    from public.community_posts quoted
    where quoted.id=v_post.quoted_post_id;

    if found and v_quoted.status='published' then
      v_quoted_actor:=private.community_present_post_actor(
        v_quoted.actor_type,
        v_quoted.person_resource_id,
        v_quoted.artist_id
      );

      if v_quoted_actor is not null then
        if auth.uid() is not null
           and private.community_is_blocked_target(
             auth.uid(),
             v_quoted.actor_type,
             case
               when v_quoted.actor_type='person'
                 then v_quoted.person_resource_id::text
               else v_quoted.artist_id::text
             end
           )
        then
          v_quoted_payload:=jsonb_build_object(
            'id',v_quoted.id,
            'available',false,
            'unavailable_reason','blocked',
            'actor_type',v_quoted.actor_type
          );
        else
          v_quoted_actor_path:=v_quoted_actor->>'canonical_path';

          v_quoted_payload:=jsonb_build_object(
            'id',v_quoted.id,
            'available',true,
            'actor',v_quoted_actor,
            'body',v_quoted.body,
            'image_url',v_quoted.image_url,
            'link_url',v_quoted.link_url,
            'link_label',v_quoted.link_label,
            'published_at',v_quoted.published_at,
            'canonical_path',
              case
                when v_quoted.actor_type='person'
                  then v_quoted_actor_path
                       ||'/posts/'
                       ||v_quoted.id::text
                else v_quoted_actor_path
                     ||'/updates/'
                     ||v_quoted.id::text
              end
          );
        end if;
      end if;
    end if;

    if v_quoted_payload is null then
      v_quoted_payload:=jsonb_build_object(
        'id',v_post.quoted_post_id,
        'available',false,
        'unavailable_reason','unavailable'
      );
    end if;
  end if;

  return jsonb_build_object(
    'id',v_post.id,
    'actor_type',v_post.actor_type,
    'actor_id',
      case
        when v_post.actor_type='person'
          then v_post.person_resource_id
        else v_post.artist_id
      end,
    'body',v_post.body,
    'image_url',v_post.image_url,
    'link_url',v_post.link_url,
    'link_label',v_post.link_label,
    'status',v_post.status,
    'published_at',v_post.published_at,
    'withdrawn_at',v_post.withdrawn_at,
    'updated_at',v_post.updated_at,
    'quoted_post_id',v_post.quoted_post_id,
    'quoted_post',v_quoted_payload,
    'canonical_path',
      case
        when v_post.actor_type='person'
          then v_actor_path||'/posts/'||v_post.id::text
        else v_actor_path||'/updates/'||v_post.id::text
      end,
    'actor',v_actor
  );
end;
$$;

revoke all on function public.community_get_post(uuid)
from public;
grant execute on function public.community_get_post(uuid)
to anon,authenticated;

alter function public.community_get_social_feed(
  integer,
  timestamp with time zone,
  text
)
rename to community_get_social_feed_legacy_m8b;

revoke all on function public.community_get_social_feed_legacy_m8b(
  integer,
  timestamp with time zone,
  text
)
from public,anon,authenticated;

create or replace function public.community_get_social_feed(
  p_limit integer default 30,
  p_before_published_at timestamp with time zone default null,
  p_before_item_key text default null
)
returns jsonb
language plpgsql
stable
security definer
set search_path=pg_catalog,public,editorial,private
as $$
declare
  v_user uuid:=auth.uid();
  v_limit integer:=least(
    greatest(
      coalesce(p_limit,30),
      1
    ),
    50
  );
  v_base jsonb;
  v_items jsonb;
begin
  if v_user is null then
    raise exception 'authentication required';
  end if;

  v_base:=public.community_get_social_feed_legacy_m8b(
    50,
    p_before_published_at,
    p_before_item_key
  );

  with base_rows as (
    select
      item.value->>'item_type' as item_type,
      item.value->>'item_id' as item_id,
      item.value->>'item_key' as item_key,
      item.value->>'canonical_path' as canonical_path,
      item.value->>'title' as title,
      item.value->>'summary' as summary,
      item.value->>'image_url' as image_url,
      item.value->>'link_url' as link_url,
      item.value->>'link_label' as link_label,
      (item.value->>'published_at')::timestamptz as published_at,
      coalesce(
        item.value->'matched_follows',
        '[]'::jsonb
      ) as matched_follows,
      case
        when item.value->>'item_type' in ('post','artist_update')
          then public.community_get_post(
            (item.value->>'item_id')::uuid
          )
        else null
      end as post_payload,
      null::jsonb as repost_actor,
      null::uuid as repost_id
    from jsonb_array_elements(
      coalesce(
        v_base->'items',
        '[]'::jsonb
      )
    ) item(value)
  ),
  base_filtered as (
    select *
    from base_rows base
    where (
      base.item_type not in ('post','artist_update')
      or (
        base.post_payload is not null
        and not private.community_is_blocked_target(
          v_user,
          base.post_payload->'actor'->>'type',
          base.post_payload->'actor'->>'id'
        )
      )
    )
  ),
  followed_subjects as (
    select
      follow.target_type,
      follow.target_id,
      follow.target_slug,
      follow.created_at as followed_at,
      false as is_self
    from public.community_follows follow
    where follow.user_id=v_user
      and follow.target_type in ('person','artist')

    union all

    select
      'person'::text,
      v_base->'viewer_actor'->>'id',
      v_base->'viewer_actor'->>'slug',
      now(),
      true
    where v_base->'viewer_actor'->>'type'='person'
      and nullif(
        btrim(
          coalesce(
            v_base->'viewer_actor'->>'id',
            ''
          )
        ),
        ''
      ) is not null
  ),
  repost_rows as (
    select
      case
        when post_payload.value->'actor'->>'type'='artist'
          then 'artist_update'::text
        else 'post'::text
      end as item_type,
      repost.post_id::text as item_id,
      'repost:'||repost.id::text as item_key,
      post_payload.value->>'canonical_path' as canonical_path,
      left(
        regexp_replace(
          coalesce(
            post_payload.value->>'body',
            ''
          ),
          E'[\\n\\r]+',
          ' ',
          'g'
        ),
        90
      ) as title,
      post_payload.value->>'body' as summary,
      post_payload.value->>'image_url' as image_url,
      post_payload.value->>'link_url' as link_url,
      post_payload.value->>'link_label' as link_label,
      repost.created_at as published_at,
      jsonb_build_array(
        jsonb_build_object(
          'target_type',subject.target_type,
          'target_id',subject.target_id,
          'target_slug',subject.target_slug,
          'followed_at',subject.followed_at,
          'is_self',subject.is_self
        )
      ) as matched_follows,
      post_payload.value as post_payload,
      private.community_present_post_actor(
        repost.actor_type,
        repost.person_resource_id,
        repost.artist_id
      ) as repost_actor,
      repost.id as repost_id
    from followed_subjects subject
    join public.community_post_reposts repost
      on repost.actor_type=subject.target_type
     and repost.status='active'
     and (
       (
         repost.actor_type='person'
         and repost.person_resource_id::text=subject.target_id
       )
       or
       (
         repost.actor_type='artist'
         and repost.artist_id::text=subject.target_id
       )
     )
    cross join lateral (
      select public.community_get_post(
        repost.post_id
      ) as value
    ) post_payload
    where post_payload.value is not null
      and not private.community_is_blocked_target(
        v_user,
        post_payload.value->'actor'->>'type',
        post_payload.value->'actor'->>'id'
      )
      and (
        p_before_published_at is null
        or repost.created_at<p_before_published_at
        or (
          p_before_item_key is not null
          and repost.created_at=p_before_published_at
          and 'repost:'||repost.id::text<p_before_item_key
        )
      )
  ),
  combined as (
    select * from base_filtered
    union all
    select * from repost_rows
  ),
  page as (
    select *
    from combined
    where canonical_path is not null
      and published_at is not null
      and item_key is not null
    order by
      published_at desc,
      item_key desc
    limit v_limit
  )
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'item_type',page.item_type,
        'item_id',page.item_id,
        'item_key',page.item_key,
        'canonical_path',page.canonical_path,
        'title',page.title,
        'summary',page.summary,
        'image_url',page.image_url,
        'link_url',page.link_url,
        'link_label',page.link_label,
        'published_at',page.published_at,
        'matched_follows',page.matched_follows,
        'post',page.post_payload,
        'repost_actor',page.repost_actor,
        'repost_id',page.repost_id
      )
      order by
        page.published_at desc,
        page.item_key desc
    ),
    '[]'::jsonb
  )
  into v_items
  from page;

  return jsonb_build_object(
    'mode',v_base->>'mode',
    'subject_types',coalesce(
      v_base->'subject_types',
      jsonb_build_array('person','artist')
    ),
    'recent_window_days',
      coalesce(
        (v_base->>'recent_window_days')::integer,
        180
      ),
    'per_subject_recent_limit',
      coalesce(
        (v_base->>'per_subject_recent_limit')::integer,
        3
      ),
    'viewer_actor',v_base->'viewer_actor',
    'items',v_items
  );
end;
$$;

revoke all on function public.community_get_social_feed(
  integer,
  timestamp with time zone,
  text
)
from public,anon;
grant execute on function public.community_get_social_feed(
  integer,
  timestamp with time zone,
  text
)
to authenticated;

update private.phase_0a_rpc_classification
set
  access_class='authenticated_read',
  rationale='Self-only Block-aware social feed layered on canonical Following, Posts, and durable Repost activity without exposing private Follow or Block rows.',
  reviewed_at=now()
where function_signature='community_get_social_feed(integer,timestamp with time zone,text)';

commit;
