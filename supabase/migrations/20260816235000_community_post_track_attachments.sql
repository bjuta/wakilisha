-- WAKILISHA M8C.2-M1: canonical Registry Track attachments for universal Posts.
-- A Post may contain text, photo, link, one canonical Track, or any combination.
-- Completely empty Posts remain invalid. Bare Quote Posts remain Reposts and remain invalid.

begin;

set local lock_timeout = '5s';
set local statement_timeout = '120s';

do $m8c2_preflight$
begin
  if to_regclass('public.community_posts') is null
     or to_regclass('public.registry_tracks') is null
     or to_regclass('public.registry_releases') is null
     or to_regclass('public.registry_track_artists') is null
     or to_regclass('public.registry_artists') is null
     or to_regclass('private.phase_0a_rpc_classification') is null then
    raise exception 'STOP: M8C.2 requires canonical Post, Registry Track, and RPC classification authority';
  end if;

  if not exists (
    select 1
    from pg_constraint constraint_row
    join pg_class relation
      on relation.oid=constraint_row.conrelid
    join pg_namespace namespace
      on namespace.oid=relation.relnamespace
    where namespace.nspname='public'
      and relation.relname='community_posts'
      and constraint_row.conname='artist_updates_body_length'
  ) then
    raise exception 'STOP: inherited artist_updates_body_length constraint is missing';
  end if;

  if exists (
    select 1
    from information_schema.columns
    where table_schema='public'
      and table_name='community_posts'
      and column_name='registry_track_id'
  ) then
    raise exception 'STOP: community_posts.registry_track_id already exists';
  end if;

  if to_regprocedure('public.community_publish_post(text,uuid,text,text,text,text)') is null
     or to_regprocedure('public.community_edit_post(uuid,text,text,text,text)') is null
     or to_regprocedure('public.community_quote_post(text,uuid,uuid,text,text,text,text)') is null
     or to_regprocedure('public.community_get_post(uuid)') is null
     or to_regprocedure('public.community_get_social_feed(integer,timestamp with time zone,text)') is null
     or to_regprocedure('private.community_present_post_actor(text,uuid,uuid)') is null
     or to_regprocedure('private.community_is_blocked_target(uuid,text,text)') is null then
    raise exception 'STOP: current M7/M8B Post authority is incomplete';
  end if;

  if to_regprocedure('public.community_publish_post(text,uuid,text,text,text,text,uuid)') is not null
     or to_regprocedure('public.community_edit_post(uuid,text,text,text,text,uuid)') is not null
     or to_regprocedure('public.community_quote_post(text,uuid,uuid,text,text,text,text,uuid)') is not null
     or to_regprocedure('private.community_present_post_track(uuid)') is not null
     or to_regprocedure('public.community_get_social_feed_legacy_m8c2(integer,timestamp with time zone,text)') is not null then
    raise exception 'STOP: M8C.2 Post Track authority already exists';
  end if;
end;
$m8c2_preflight$;

alter table public.community_posts
  add column registry_track_id uuid;

alter table public.community_posts
  add constraint community_posts_registry_track_id_fkey
    foreign key (registry_track_id)
    references public.registry_tracks(id)
    on update restrict
    on delete restrict;

create index community_posts_registry_track_idx
on public.community_posts (registry_track_id,published_at desc,id desc)
where registry_track_id is not null;

alter table public.community_posts
  drop constraint artist_updates_body_length;

alter table public.community_posts
  add constraint community_posts_body_length
    check (char_length(btrim(body)) <= 2000),
  add constraint community_posts_content_required
    check (
      nullif(btrim(body),'') is not null
      or nullif(btrim(coalesce(image_url,'')),'') is not null
      or nullif(btrim(coalesce(link_url,'')),'') is not null
      or registry_track_id is not null
    );

comment on column public.community_posts.registry_track_id is
  'Optional canonical Registry Track attached to this authored Post. Track identity is not copied into a second attachment domain.';

create or replace function private.community_present_post_track(
  p_registry_track_id uuid
)
returns jsonb
language sql
stable
security definer
set search_path=pg_catalog,public,private
as $function$
  select jsonb_strip_nulls(
    jsonb_build_object(
      'id',track.id,
      'title',track.title,
      'artist_name',artist_credit.artist_name,
      'artist_slug',artist_credit.artist_slug,
      'artwork_url',coalesce(track.artwork_url,release.artwork_url),
      'preview_url',track.preview_url,
      'duration_ms',track.duration_ms,
      'track_slug',track.slug,
      'release_id',release.id,
      'release_title',release.title,
      'release_slug',release.slug,
      'canonical_path',case
        when artist_credit.artist_slug is not null
         and track.slug is not null
          then '/tracks/'||artist_credit.artist_slug||'/'||track.slug
        else null
      end
    )
  )
  from public.registry_tracks track
  left join public.registry_releases release
    on release.id=track.release_id
   and release.status='active'
  left join lateral (
    select
      coalesce(artist.display_name,link.artist_name_text) as artist_name,
      artist.slug as artist_slug
    from public.registry_track_artists link
    left join public.registry_artists artist
      on artist.id=link.artist_id
     and artist.status='active'
    where link.track_id=track.id
      and link.status='active'
      and coalesce(artist.display_name,link.artist_name_text) is not null
    order by
      link.is_primary desc,
      link.credit_order,
      link.id
    limit 1
  ) artist_credit on true
  where track.id=p_registry_track_id
    and track.status='active';
$function$;

revoke all
on function private.community_present_post_track(uuid)
from public,anon,authenticated;

grant execute
on function private.community_present_post_track(uuid)
to service_role;

-- Replace the public Post reader in place so every existing Post surface inherits
-- the same Track presentation and the M8B blocked-Quote semantics remain intact.
create or replace function public.community_get_post(
  p_post_id uuid
)
returns jsonb
language plpgsql
stable
security definer
set search_path=pg_catalog,public,editorial,private
as $function$
declare
  v_post public.community_posts%rowtype;
  v_actor jsonb;
  v_actor_path text;
  v_track jsonb;
  v_quoted public.community_posts%rowtype;
  v_quoted_actor jsonb;
  v_quoted_actor_path text;
  v_quoted_track jsonb;
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

  if v_post.registry_track_id is not null then
    v_track:=private.community_present_post_track(
      v_post.registry_track_id
    );
  end if;

  if nullif(btrim(v_post.body),'') is null
     and nullif(btrim(coalesce(v_post.image_url,'')),'') is null
     and nullif(btrim(coalesce(v_post.link_url,'')),'') is null
     and v_post.registry_track_id is not null
     and v_track is null then
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

      if v_quoted.registry_track_id is not null then
        v_quoted_track:=private.community_present_post_track(
          v_quoted.registry_track_id
        );
      end if;

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
        elsif nullif(btrim(v_quoted.body),'') is null
              and nullif(btrim(coalesce(v_quoted.image_url,'')),'') is null
              and nullif(btrim(coalesce(v_quoted.link_url,'')),'') is null
              and v_quoted.registry_track_id is not null
              and v_quoted_track is null
        then
          v_quoted_payload:=jsonb_build_object(
            'id',v_quoted.id,
            'available',false,
            'unavailable_reason','unavailable'
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
            'track',v_quoted_track,
            'published_at',v_quoted.published_at,
            'canonical_path',
              case
                when v_quoted.actor_type='person'
                  then v_quoted_actor_path||'/posts/'||v_quoted.id::text
                else v_quoted_actor_path||'/updates/'||v_quoted.id::text
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
    'actor_id',case
      when v_post.actor_type='person'
        then v_post.person_resource_id
      else v_post.artist_id
    end,
    'body',v_post.body,
    'image_url',v_post.image_url,
    'link_url',v_post.link_url,
    'link_label',v_post.link_label,
    'track',v_track,
    'status',v_post.status,
    'published_at',v_post.published_at,
    'withdrawn_at',v_post.withdrawn_at,
    'updated_at',v_post.updated_at,
    'quoted_post_id',v_post.quoted_post_id,
    'quoted_post',v_quoted_payload,
    'canonical_path',case
      when v_post.actor_type='person'
        then v_actor_path||'/posts/'||v_post.id::text
      else v_actor_path||'/updates/'||v_post.id::text
    end,
    'actor',v_actor
  );
end;
$function$;

revoke all
on function public.community_get_post(uuid)
from public;

grant execute
on function public.community_get_post(uuid)
to anon,authenticated;

-- Keep the final M8B feed contract authoritative while normalizing titles for
-- bodyless Posts. The Following client requires a non-empty activity title even
-- when the authored Post itself is photo-only, link-only, or Track-only.
alter function public.community_get_social_feed(
  integer,
  timestamp with time zone,
  text
)
rename to community_get_social_feed_legacy_m8c2;

revoke all
on function public.community_get_social_feed_legacy_m8c2(
  integer,
  timestamp with time zone,
  text
)
from public,anon,authenticated;

create function public.community_get_social_feed(
  p_limit integer default 30,
  p_before_published_at timestamp with time zone default null,
  p_before_item_key text default null
)
returns jsonb
language plpgsql
stable
security definer
set search_path=pg_catalog,public,private
as $function$
declare
  v_feed jsonb;
  v_items jsonb;
begin
  v_feed:=public.community_get_social_feed_legacy_m8c2(
    p_limit,
    p_before_published_at,
    p_before_item_key
  );

  select coalesce(
    jsonb_agg(
      case
        when item.value->>'item_type' in ('post','artist_update')
         and nullif(btrim(coalesce(item.value->>'title','')),'') is null
        then jsonb_set(
          item.value,
          '{title}',
          to_jsonb(
            coalesce(
              nullif(
                btrim(
                  coalesce(
                    item.value->'post'->'track'->>'title',
                    ''
                  )
                ),
                ''
              ),
              nullif(
                btrim(
                  coalesce(
                    item.value->'post'->>'link_label',
                    ''
                  )
                ),
                ''
              ),
              case
                when nullif(
                  btrim(
                    coalesce(
                      item.value->'post'->'actor'->>'name',
                      ''
                    )
                  ),
                  ''
                ) is not null
                then 'Post from '
                     || (item.value->'post'->'actor'->>'name')
                else 'Post'
              end
            )
          ),
          true
        )
        else item.value
      end
      order by item.ordinality
    ),
    '[]'::jsonb
  )
  into v_items
  from jsonb_array_elements(
    coalesce(
      v_feed->'items',
      '[]'::jsonb
    )
  ) with ordinality item(value,ordinality);

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

-- Retire the caption-gated writer signatures before replacing them. Leaving both
-- signatures behind would create ambiguous PostgREST RPC authority.
drop function public.community_publish_post(text,uuid,text,text,text,text);
drop function public.community_edit_post(uuid,text,text,text,text);
drop function public.community_quote_post(text,uuid,uuid,text,text,text,text);

delete from private.phase_0a_rpc_classification
where function_signature in (
  'community_publish_post(text,uuid,text,text,text,text)',
  'community_edit_post(uuid,text,text,text,text)',
  'community_quote_post(text,uuid,uuid,text,text,text,text)'
);

create function public.community_publish_post(
  p_actor_type text,
  p_actor_id uuid,
  p_body text,
  p_image_url text default null,
  p_link_url text default null,
  p_link_label text default null,
  p_registry_track_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path=pg_catalog,public,editorial
as $function$
declare
  v_actor uuid:=auth.uid();
  v_type text:=lower(btrim(coalesce(p_actor_type,'')));
  v_person uuid;
  v_rep public.artist_representations%rowtype;
  v_body text:=btrim(coalesce(p_body,''));
  v_image text:=nullif(btrim(coalesce(p_image_url,'')),'');
  v_link text:=nullif(btrim(coalesce(p_link_url,'')),'');
  v_label text:=nullif(btrim(coalesce(p_link_label,'')),'');
  v_post public.community_posts%rowtype;
begin
  if v_actor is null then raise exception 'authentication_required'; end if;
  if v_type not in ('person','artist') or p_actor_id is null then
    raise exception 'invalid_post_actor';
  end if;
  if char_length(v_body)>2000 then raise exception 'invalid_post_body'; end if;
  if v_image is not null and (char_length(v_image)>2048 or v_image !~* '^https?://') then raise exception 'invalid_post_image_url'; end if;
  if v_link is not null and (char_length(v_link)>2048 or v_link !~* '^https?://') then raise exception 'invalid_post_link_url'; end if;
  if v_label is not null and (char_length(v_label)>120 or v_link is null) then raise exception 'invalid_post_link_label'; end if;
  if v_body='' and v_image is null and v_link is null and p_registry_track_id is null then
    raise exception 'invalid_post_content';
  end if;

  if p_registry_track_id is not null then
    perform 1
    from public.registry_tracks track
    where track.id=p_registry_track_id
      and track.status='active';
    if not found then raise exception 'post_track_not_available' using errcode='22023'; end if;
  end if;

  if v_type='person' then
    v_person:=editorial.current_person_post_actor();
    if v_person is null or v_person is distinct from p_actor_id then
      raise exception 'insufficient_person_post_privilege';
    end if;
    insert into public.community_posts(
      actor_type,person_resource_id,artist_id,representation_id,
      author_user_id,body,image_url,link_url,link_label,registry_track_id,status
    ) values (
      'person',v_person,null,null,v_actor,v_body,v_image,v_link,v_label,p_registry_track_id,'published'
    ) returning * into v_post;
  else
    select * into v_rep from editorial.current_artist_representation(p_actor_id);
    if v_rep.id is null or not v_rep.can_post_updates then
      raise exception 'insufficient_artist_update_privilege';
    end if;
    perform 1 from public.registry_artists artist
    where artist.id=p_actor_id and artist.status='active';
    if not found then raise exception 'artist_not_found'; end if;

    insert into public.community_posts(
      actor_type,person_resource_id,artist_id,representation_id,
      author_user_id,body,image_url,link_url,link_label,registry_track_id,status
    ) values (
      'artist',null,p_actor_id,v_rep.id,v_actor,v_body,v_image,v_link,v_label,p_registry_track_id,'published'
    ) returning * into v_post;

    perform editorial.record_artist_representation_event(
      p_actor_id,'artist_update_published',null,v_rep.id,v_actor,
      jsonb_build_object(
        'artist_update_id',v_post.id,
        'post_id',v_post.id,
        'registry_track_id',v_post.registry_track_id,
        'published_at',v_post.published_at
      )
    );
  end if;

  return public.community_get_post(v_post.id);
end;
$function$;

revoke all
on function public.community_publish_post(text,uuid,text,text,text,text,uuid)
from public,anon;

grant execute
on function public.community_publish_post(text,uuid,text,text,text,text,uuid)
to authenticated;

create function public.community_edit_post(
  p_post_id uuid,
  p_body text,
  p_image_url text default null,
  p_link_url text default null,
  p_link_label text default null,
  p_registry_track_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path=pg_catalog,public,editorial
as $function$
declare
  v_actor uuid:=auth.uid();
  v_person uuid;
  v_rep public.artist_representations%rowtype;
  v_body text:=btrim(coalesce(p_body,''));
  v_image text:=nullif(btrim(coalesce(p_image_url,'')),'');
  v_link text:=nullif(btrim(coalesce(p_link_url,'')),'');
  v_label text:=nullif(btrim(coalesce(p_link_label,'')),'');
  v_post public.community_posts%rowtype;
begin
  if v_actor is null then raise exception 'authentication_required'; end if;
  select * into v_post from public.community_posts post
  where post.id=p_post_id for update;
  if not found then raise exception 'post_not_found'; end if;
  if v_post.status<>'published' then raise exception 'post_not_editable'; end if;
  if char_length(v_body)>2000 then raise exception 'invalid_post_body'; end if;
  if v_image is not null and (char_length(v_image)>2048 or v_image !~* '^https?://') then raise exception 'invalid_post_image_url'; end if;
  if v_link is not null and (char_length(v_link)>2048 or v_link !~* '^https?://') then raise exception 'invalid_post_link_url'; end if;
  if v_label is not null and (char_length(v_label)>120 or v_link is null) then raise exception 'invalid_post_link_label'; end if;
  if v_body='' and v_image is null and v_link is null and p_registry_track_id is null then
    raise exception 'invalid_post_content';
  end if;

  if p_registry_track_id is not null then
    perform 1
    from public.registry_tracks track
    where track.id=p_registry_track_id
      and track.status='active';
    if not found then raise exception 'post_track_not_available' using errcode='22023'; end if;
  end if;

  if v_post.actor_type='person' then
    v_person:=editorial.current_person_post_actor();
    if v_person is null
       or v_person is distinct from v_post.person_resource_id
       or v_post.author_user_id is distinct from v_actor then
      raise exception 'insufficient_person_post_privilege';
    end if;
  elsif v_post.actor_type='artist' then
    select * into v_rep from editorial.current_artist_representation(v_post.artist_id);
    if v_rep.id is null or not v_rep.can_post_updates then
      raise exception 'insufficient_artist_update_privilege';
    end if;
  else
    raise exception 'invalid_post_actor';
  end if;

  update public.community_posts
  set
    body=v_body,
    image_url=v_image,
    link_url=v_link,
    link_label=v_label,
    registry_track_id=p_registry_track_id,
    updated_at=now()
  where id=p_post_id
  returning * into v_post;

  if v_post.actor_type='artist' then
    perform editorial.record_artist_representation_event(
      v_post.artist_id,'artist_update_edited',null,v_rep.id,v_actor,
      jsonb_build_object(
        'artist_update_id',v_post.id,
        'post_id',v_post.id,
        'registry_track_id',v_post.registry_track_id,
        'updated_at',v_post.updated_at
      )
    );
  end if;

  return public.community_get_post(v_post.id);
end;
$function$;

revoke all
on function public.community_edit_post(uuid,text,text,text,text,uuid)
from public,anon;

grant execute
on function public.community_edit_post(uuid,text,text,text,text,uuid)
to authenticated;

create function public.community_quote_post(
  p_actor_type text,
  p_actor_id uuid,
  p_quoted_post_id uuid,
  p_body text,
  p_image_url text default null,
  p_link_url text default null,
  p_link_label text default null,
  p_registry_track_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path=pg_catalog,public,editorial,private
as $function$
declare
  v_user uuid:=auth.uid();
  v_actor record;
  v_quoted public.community_posts%rowtype;
  v_post public.community_posts%rowtype;
  v_body text:=btrim(coalesce(p_body,''));
  v_image text:=nullif(btrim(coalesce(p_image_url,'')),'');
  v_link text:=nullif(btrim(coalesce(p_link_url,'')),'');
  v_label text:=nullif(btrim(coalesce(p_link_label,'')),'');
  v_actor_id text;
  v_quoted_actor_id text;
begin
  if v_user is null then raise exception 'authentication_required'; end if;
  if p_quoted_post_id is null then raise exception 'quoted_post_required'; end if;
  if char_length(v_body)>2000 then raise exception 'invalid_post_body'; end if;
  if v_image is not null and (char_length(v_image)>2048 or v_image !~* '^https?://') then raise exception 'invalid_post_image_url'; end if;
  if v_link is not null and (char_length(v_link)>2048 or v_link !~* '^https?://') then raise exception 'invalid_post_link_url'; end if;
  if v_label is not null and (char_length(v_label)>120 or v_link is null) then raise exception 'invalid_post_link_label'; end if;
  if v_body='' and v_image is null and v_link is null and p_registry_track_id is null then
    raise exception 'invalid_post_content';
  end if;

  if p_registry_track_id is not null then
    perform 1
    from public.registry_tracks track
    where track.id=p_registry_track_id
      and track.status='active';
    if not found then raise exception 'post_track_not_available' using errcode='22023'; end if;
  end if;

  select *
  into v_actor
  from private.community_resolve_post_command_actor(
    p_actor_type,
    p_actor_id
  );

  select *
  into v_quoted
  from public.community_posts post
  where post.id=p_quoted_post_id
  for share;

  if not found or v_quoted.status<>'published' then
    raise exception 'quoted_post_not_available';
  end if;

  v_actor_id:=case
    when v_actor.resolved_actor_type='person'
      then v_actor.person_resource_id::text
    else v_actor.artist_id::text
  end;

  v_quoted_actor_id:=case
    when v_quoted.actor_type='person'
      then v_quoted.person_resource_id::text
    else v_quoted.artist_id::text
  end;

  if private.community_is_blocked_target(
    v_user,
    v_quoted.actor_type,
    v_quoted_actor_id
  ) then
    raise exception 'blocked_post_target' using errcode='42501';
  end if;

  insert into public.community_posts (
    actor_type,
    person_resource_id,
    artist_id,
    representation_id,
    author_user_id,
    body,
    image_url,
    link_url,
    link_label,
    registry_track_id,
    quoted_post_id,
    status
  )
  values (
    v_actor.resolved_actor_type,
    v_actor.person_resource_id,
    v_actor.artist_id,
    v_actor.representation_id,
    v_user,
    v_body,
    v_image,
    v_link,
    v_label,
    p_registry_track_id,
    p_quoted_post_id,
    'published'
  )
  returning *
  into v_post;

  if v_actor.resolved_actor_type='artist' then
    perform editorial.record_artist_representation_event(
      v_actor.artist_id,
      'artist_update_published',
      null,
      v_actor.representation_id,
      v_user,
      jsonb_build_object(
        'artist_update_id',v_post.id,
        'post_id',v_post.id,
        'quoted_post_id',p_quoted_post_id,
        'registry_track_id',v_post.registry_track_id,
        'published_at',v_post.published_at
      )
    );
  end if;

  if v_quoted.author_user_id is not null
     and v_quoted.author_user_id<>v_user
     and not private.community_is_blocked_target(
       v_quoted.author_user_id,
       v_actor.resolved_actor_type,
       v_actor_id
     ) then
    insert into public.community_notifications (
      user_id,
      actor_id,
      notification_type,
      entity_type,
      entity_id,
      metadata
    )
    values (
      v_quoted.author_user_id,
      v_user,
      'post_quote',
      'post',
      v_post.id::text,
      jsonb_build_object(
        'quoted_post_id',p_quoted_post_id,
        'actor_type',v_actor.resolved_actor_type,
        'actor_id',v_actor_id,
        'canonical_path',public.community_get_post(v_post.id)->>'canonical_path'
      )
    );
  end if;

  return public.community_get_post(v_post.id);
end;
$function$;

revoke all
on function public.community_quote_post(text,uuid,uuid,text,text,text,text,uuid)
from public,anon;

grant execute
on function public.community_quote_post(text,uuid,uuid,text,text,text,text,uuid)
to authenticated;

insert into private.phase_0a_rpc_classification (
  function_signature,
  access_class,
  rationale,
  reviewed_at
)
values
  (
    'community_publish_post(text,uuid,text,text,text,text,uuid)',
    'authenticated_command',
    'Publishes one canonical Post as the signed-in Person or represented Artist, with optional canonical Registry Track identity.'
  , now()),
  (
    'community_edit_post(uuid,text,text,text,text,uuid)',
    'authenticated_command',
    'Edits authored Post content and optional canonical Registry Track identity under existing Person or Artist authority.'
  , now()),
  (
    'community_quote_post(text,uuid,uuid,text,text,text,text,uuid)',
    'authenticated_command',
    'Publishes authored Quote Post content with one immutable quoted Post reference and optional canonical Registry Track identity.'
  , now()),
  (
    'community_get_social_feed(integer,timestamp with time zone,text)',
    'authenticated_read',
    'Reads the final Block-aware social feed while keeping bodyless Posts addressable with a stable activity title and canonical Post payload.'
  , now())
on conflict (function_signature)
do update
set
  access_class=excluded.access_class,
  rationale=excluded.rationale,
  reviewed_at=excluded.reviewed_at;

commit;
