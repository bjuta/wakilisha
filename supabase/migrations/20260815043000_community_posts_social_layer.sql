-- WAKILISHA M7: universal community Posts social layer.
-- Promote Artist Updates into the canonical post store rather than creating a second ledger.
-- Keep Artist Update public-target semantics for compatibility; Person-authored Posts use target type post.

begin;

do $m7_preflight$
declare v_kind "char";
begin
  select c.relkind into v_kind
  from pg_catalog.pg_class c
  join pg_catalog.pg_namespace n on n.oid=c.relnamespace
  where n.nspname='public' and c.relname='artist_updates';

  if v_kind is distinct from 'r'::"char" then
    raise exception 'STOP: public.artist_updates must be the M4 table before M7';
  end if;
  if to_regclass('public.community_posts') is not null then
    raise exception 'STOP: public.community_posts already exists';
  end if;
  if to_regclass('editorial.people') is null
     or to_regclass('editorial.person_identity_links') is null
     or to_regclass('public.user_profiles') is null
     or to_regclass('public.community_follows') is null
     or to_regclass('public.community_saves') is null
     or to_regclass('public.community_reactions') is null
     or to_regclass('private.phase_0a_rpc_classification') is null then
    raise exception 'STOP: required Person or Community authority is missing';
  end if;
  if to_regprocedure('editorial.current_artist_representation(uuid)') is null
     or to_regprocedure('editorial.resolve_person_presentation(uuid)') is null
     or to_regprocedure('public.community_get_following_feed(integer,timestamp with time zone,text)') is null
     or to_regprocedure('public.community_set_saved_state(text,text,text,text,text,text,text,boolean)') is null
     or to_regprocedure('public.community_get_reaction_state_for_public_targets(jsonb)') is null
     or to_regprocedure('public.community_react_to_target(text,uuid,text)') is null then
    raise exception 'STOP: required Community RPC authority is incomplete';
  end if;
end;
$m7_preflight$;

alter table public.artist_updates rename to community_posts;
alter table public.community_posts alter column artist_id drop not null;
alter table public.community_posts
  add column actor_type text not null default 'artist',
  add column person_resource_id uuid;

alter table public.community_posts
  add constraint community_posts_actor_type_check check (actor_type in ('person','artist')),
  add constraint community_posts_person_resource_id_fkey
    foreign key (person_resource_id) references editorial.people(resource_id)
    on update restrict on delete restrict,
  add constraint community_posts_actor_identity_check check (
    (actor_type='artist' and artist_id is not null and person_resource_id is null)
    or
    (actor_type='person' and person_resource_id is not null and artist_id is null and representation_id is null)
  );

create index community_posts_person_publication_idx
on public.community_posts (person_resource_id,status,published_at desc,id desc)
where actor_type='person';

create index community_posts_actor_publication_idx
on public.community_posts (actor_type,status,published_at desc,id desc);

revoke all on table public.community_posts from anon, authenticated;

create view public.artist_updates as
select
  post.id, post.artist_id, post.representation_id, post.author_user_id,
  post.body, post.image_url, post.link_url, post.link_label, post.status,
  post.published_at, post.withdrawn_at, post.created_at, post.updated_at
from public.community_posts post
where post.actor_type='artist' and post.artist_id is not null;

revoke all on table public.artist_updates from anon, authenticated;

create or replace function editorial.current_person_post_actor()
returns uuid
language sql
stable
security definer
set search_path=pg_catalog,public,editorial
as $$
  select link.person_resource_id
  from editorial.person_identity_links link
  join editorial.people person on person.resource_id=link.person_resource_id
  join editorial.resources resource
    on resource.id=person.resource_id and resource.resource_kind='person'
  join public.user_profiles profile on profile.user_id=link.user_id
  where link.user_id=auth.uid()
    and link.link_state='active'
    and person.person_state='active'
    and resource.lifecycle_state='active'
    and resource.visibility='public'
    and profile.status='active'
    and profile.is_public
  order by link.created_at desc, link.id desc
  limit 1
$$;

revoke all on function editorial.current_person_post_actor()
from public,anon,authenticated;

create or replace function public.community_get_post(p_post_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path=pg_catalog,public,editorial
as $$
declare
  v_post public.community_posts%rowtype;
  v_path text; v_slug text; v_name text; v_image text;
  v_official boolean:=false;
begin
  select * into v_post
  from public.community_posts post
  where post.id=p_post_id and post.status='published';
  if not found then return null; end if;

  if v_post.actor_type='person' then
    select
      alias.path,
      regexp_replace(alias.path,'^/people/',''),
      presentation.value->>'display_name',
      presentation.value->>'avatar_url'
    into v_path,v_slug,v_name,v_image
    from editorial.people person
    join editorial.resources resource
      on resource.id=person.resource_id and resource.resource_kind='person'
    join editorial.person_identity_links link
      on link.person_resource_id=person.resource_id
     and link.link_state='active' and link.user_id is not null
    join public.user_profiles profile
      on profile.user_id=link.user_id
     and profile.status='active' and profile.is_public
    cross join lateral (
      select editorial.resolve_person_presentation(person.resource_id) as value
    ) presentation
    join lateral (
      select a.path
      from editorial.resource_aliases a
      where a.resource_id=person.resource_id
        and a.is_canonical and a.retired_at is null
      order by a.created_at
      limit 1
    ) alias on true
    where person.resource_id=v_post.person_resource_id
      and person.person_state='active'
      and resource.lifecycle_state='active'
      and resource.visibility='public'
    limit 1;
    if v_path is null or nullif(btrim(coalesce(v_name,'')),'') is null then
      return null;
    end if;
  elsif v_post.actor_type='artist' then
    select
      '/artists/'||artist.slug,
      artist.slug,
      artist.display_name,
      coalesce(presentation.profile_image_url,artist.public_image_url),
      true
    into v_path,v_slug,v_name,v_image,v_official
    from public.registry_artists artist
    left join public.artist_profile_presentations presentation
      on presentation.artist_id=artist.id
    where artist.id=v_post.artist_id and artist.status='active';
    if not found then return null; end if;
  else
    return null;
  end if;

  return jsonb_build_object(
    'id',v_post.id,
    'actor_type',v_post.actor_type,
    'actor_id',case when v_post.actor_type='person'
                    then v_post.person_resource_id else v_post.artist_id end,
    'body',v_post.body,
    'image_url',v_post.image_url,
    'link_url',v_post.link_url,
    'link_label',v_post.link_label,
    'status',v_post.status,
    'published_at',v_post.published_at,
    'withdrawn_at',v_post.withdrawn_at,
    'updated_at',v_post.updated_at,
    'canonical_path',case when v_post.actor_type='person'
      then v_path||'/posts/'||v_post.id::text
      else v_path||'/updates/'||v_post.id::text end,
    'actor',jsonb_build_object(
      'type',v_post.actor_type,
      'id',case when v_post.actor_type='person'
                then v_post.person_resource_id else v_post.artist_id end,
      'slug',v_slug,'name',v_name,'image_url',v_image,
      'canonical_path',v_path,'official',v_official
    )
  );
end;
$$;

revoke all on function public.community_get_post(uuid) from public;
grant execute on function public.community_get_post(uuid) to anon,authenticated;
create or replace function public.community_publish_post(
  p_actor_type text,
  p_actor_id uuid,
  p_body text,
  p_image_url text default null,
  p_link_url text default null,
  p_link_label text default null
)
returns jsonb
language plpgsql
security definer
set search_path=pg_catalog,public,editorial
as $$
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
  if char_length(v_body) not between 1 and 2000 then raise exception 'invalid_post_body'; end if;
  if v_image is not null and (char_length(v_image)>2048 or v_image !~* '^https?://') then raise exception 'invalid_post_image_url'; end if;
  if v_link is not null and (char_length(v_link)>2048 or v_link !~* '^https?://') then raise exception 'invalid_post_link_url'; end if;
  if v_label is not null and (char_length(v_label)>120 or v_link is null) then raise exception 'invalid_post_link_label'; end if;

  if v_type='person' then
    v_person:=editorial.current_person_post_actor();
    if v_person is null or v_person is distinct from p_actor_id then
      raise exception 'insufficient_person_post_privilege';
    end if;
    insert into public.community_posts(
      actor_type,person_resource_id,artist_id,representation_id,
      author_user_id,body,image_url,link_url,link_label,status
    ) values (
      'person',v_person,null,null,v_actor,v_body,v_image,v_link,v_label,'published'
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
      author_user_id,body,image_url,link_url,link_label,status
    ) values (
      'artist',null,p_actor_id,v_rep.id,v_actor,v_body,v_image,v_link,v_label,'published'
    ) returning * into v_post;

    perform editorial.record_artist_representation_event(
      p_actor_id,'artist_update_published',null,v_rep.id,v_actor,
      jsonb_build_object(
        'artist_update_id',v_post.id,'post_id',v_post.id,'published_at',v_post.published_at
      )
    );
  end if;

  return public.community_get_post(v_post.id);
end;
$$;

revoke all on function public.community_publish_post(text,uuid,text,text,text,text)
from public,anon;
grant execute on function public.community_publish_post(text,uuid,text,text,text,text)
to authenticated;

create or replace function public.community_edit_post(
  p_post_id uuid,
  p_body text,
  p_image_url text default null,
  p_link_url text default null,
  p_link_label text default null
)
returns jsonb
language plpgsql
security definer
set search_path=pg_catalog,public,editorial
as $$
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
  if char_length(v_body) not between 1 and 2000 then raise exception 'invalid_post_body'; end if;
  if v_image is not null and (char_length(v_image)>2048 or v_image !~* '^https?://') then raise exception 'invalid_post_image_url'; end if;
  if v_link is not null and (char_length(v_link)>2048 or v_link !~* '^https?://') then raise exception 'invalid_post_link_url'; end if;
  if v_label is not null and (char_length(v_label)>120 or v_link is null) then raise exception 'invalid_post_link_label'; end if;

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
  set body=v_body,image_url=v_image,link_url=v_link,link_label=v_label,updated_at=now()
  where id=p_post_id
  returning * into v_post;

  if v_post.actor_type='artist' then
    perform editorial.record_artist_representation_event(
      v_post.artist_id,'artist_update_edited',null,v_rep.id,v_actor,
      jsonb_build_object('artist_update_id',v_post.id,'post_id',v_post.id,'updated_at',v_post.updated_at)
    );
  end if;
  return public.community_get_post(v_post.id);
end;
$$;

revoke all on function public.community_edit_post(uuid,text,text,text,text)
from public,anon;
grant execute on function public.community_edit_post(uuid,text,text,text,text)
to authenticated;
create or replace function public.community_withdraw_post(
  p_post_id uuid,
  p_reason text
)
returns jsonb
language plpgsql
security definer
set search_path=pg_catalog,public,editorial
as $$
declare
  v_actor uuid:=auth.uid();
  v_person uuid;
  v_rep public.artist_representations%rowtype;
  v_reason text:=btrim(coalesce(p_reason,''));
  v_post public.community_posts%rowtype;
begin
  if v_actor is null then raise exception 'authentication_required'; end if;
  if char_length(v_reason) not between 3 and 1000 then raise exception 'invalid_post_withdrawal_reason'; end if;

  select * into v_post from public.community_posts post
  where post.id=p_post_id for update;
  if not found then raise exception 'post_not_found'; end if;
  if v_post.status<>'published' then raise exception 'post_not_withdrawable'; end if;

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
  set status='withdrawn',withdrawn_at=now(),updated_at=now()
  where id=p_post_id
  returning * into v_post;

  if v_post.actor_type='artist' then
    perform editorial.record_artist_representation_event(
      v_post.artist_id,'artist_update_withdrawn',null,v_rep.id,v_actor,
      jsonb_build_object(
        'artist_update_id',v_post.id,'post_id',v_post.id,
        'reason',v_reason,'withdrawn_at',v_post.withdrawn_at
      )
    );
  end if;

  return jsonb_build_object(
    'id',v_post.id,'status',v_post.status,'withdrawn_at',v_post.withdrawn_at
  );
end;
$$;

revoke all on function public.community_withdraw_post(uuid,text)
from public,anon;
grant execute on function public.community_withdraw_post(uuid,text)
to authenticated;

-- Wrap the existing Save command instead of reimplementing its mature target logic.
alter function public.community_set_saved_state(text,text,text,text,text,text,text,boolean)
set schema private;
alter function private.community_set_saved_state(text,text,text,text,text,text,text,boolean)
rename to community_set_saved_state_legacy_m7;
revoke all on function private.community_set_saved_state_legacy_m7(text,text,text,text,text,text,text,boolean)
from public,anon,authenticated;

alter table public.community_saves
drop constraint community_saves_entity_type_capability_check;
alter table public.community_saves
add constraint community_saves_entity_type_capability_check
check (
  entity_type in (
    'article','playlist','track','release','chart_edition','artist_update','post'
  )
);

create or replace function public.community_set_saved_state(
  p_entity_type text,
  p_entity_id text,
  p_entity_slug text,
  p_entity_url text,
  p_title text,
  p_subtitle text,
  p_image_url text,
  p_saved boolean
)
returns jsonb
language plpgsql
security definer
set search_path=pg_catalog,public,private,editorial
as $$
declare
  v_user uuid:=auth.uid();
  v_type text:=lower(btrim(coalesce(p_entity_type,'')));
  v_id uuid;
  v_post public.community_posts%rowtype;
  v_public jsonb;
  v_title text:=nullif(btrim(coalesce(p_title,'')),'');
begin
  if v_type<>'post' then
    return private.community_set_saved_state_legacy_m7(
      p_entity_type,p_entity_id,p_entity_slug,p_entity_url,
      p_title,p_subtitle,p_image_url,p_saved
    );
  end if;

  if v_user is null then raise exception 'Not authenticated' using errcode='42501'; end if;
  begin
    v_id:=btrim(coalesce(p_entity_id,p_entity_slug,''))::uuid;
  exception when invalid_text_representation then
    raise exception 'Post Save target requires a UUID' using errcode='22023';
  end;

  select * into v_post from public.community_posts post where post.id=v_id;
  if not found then raise exception 'Post Save target does not exist' using errcode='P0002'; end if;

  -- Artist-authored rows retain the existing artist_update public target.
  if v_post.actor_type='artist' then
    return private.community_set_saved_state_legacy_m7(
      'artist_update',v_post.id::text,v_post.id::text,p_entity_url,
      p_title,p_subtitle,p_image_url,p_saved
    );
  end if;

  v_public:=public.community_get_post(v_post.id);
  if v_public is null then
    raise exception 'Target is not publicly saveable' using errcode='22023';
  end if;
  if coalesce(p_saved,false) and v_title is null then
    raise exception 'Title is required when saving' using errcode='22023';
  end if;

  perform pg_advisory_xact_lock(
    pg_catalog.hashtextextended(v_user::text||'|save|post|'||v_post.id::text,0)
  );

  if coalesce(p_saved,false) then
    insert into public.community_saves(
      user_id,entity_type,entity_id,entity_slug,entity_url,title,subtitle,image_url
    ) values (
      v_user,'post',v_post.id::text,v_post.id::text,
      v_public->>'canonical_path',v_title,
      nullif(btrim(coalesce(p_subtitle,'')),''),
      nullif(btrim(coalesce(p_image_url,'')),'')
    )
    on conflict (user_id,entity_type,entity_id)
    do update set
      entity_slug=excluded.entity_slug,
      entity_url=excluded.entity_url,
      title=excluded.title,
      subtitle=excluded.subtitle,
      image_url=excluded.image_url;
  else
    delete from public.community_saves
    where user_id=v_user and entity_type='post' and entity_id=v_post.id::text;
  end if;

  return jsonb_build_object(
    'saved',coalesce(p_saved,false),
    'entity_type','post',
    'entity_id',v_post.id::text,
    'entity_slug',v_post.id::text,
    'entity_url',v_public->>'canonical_path'
  );
end;
$$;

revoke all on function public.community_set_saved_state(text,text,text,text,text,text,text,boolean)
from public,anon;
grant execute on function public.community_set_saved_state(text,text,text,text,text,text,text,boolean)
to authenticated;
-- Wrap reaction write so Post targets are validated before reaching mature toggle logic.
alter function public.community_react_to_target(text,uuid,text) set schema private;
alter function private.community_react_to_target(text,uuid,text)
rename to community_react_to_target_legacy_m7;
revoke all on function private.community_react_to_target_legacy_m7(text,uuid,text)
from public,anon,authenticated;

create or replace function public.community_react_to_target(
  p_target_type text,
  p_target_id uuid,
  p_reaction_type text
)
returns jsonb
language plpgsql
security definer
set search_path=pg_catalog,public,private
as $$
declare
  v_type text:=lower(btrim(coalesce(p_target_type,'')));
  v_post public.community_posts%rowtype;
begin
  if v_type='post' then
    select * into v_post
    from public.community_posts post
    where post.id=p_target_id;

    if not found
       or v_post.actor_type<>'person'
       or public.community_get_post(p_target_id) is null then
      raise exception 'Reaction target is not currently public' using errcode='22023';
    end if;
  end if;

  return private.community_react_to_target_legacy_m7(
    p_target_type,p_target_id,p_reaction_type
  );
end;
$$;

revoke all on function public.community_react_to_target(text,uuid,text)
from public,anon;
grant execute on function public.community_react_to_target(text,uuid,text)
to authenticated;

-- Wrap reaction-state reads. Existing targets delegate to the mature authority;
-- Person Post targets are validated and aggregated from the same reaction ledger.
alter function public.community_get_reaction_state_for_public_targets(jsonb)
set schema private;
alter function private.community_get_reaction_state_for_public_targets(jsonb)
rename to community_get_reaction_state_for_public_targets_legacy_m7;
revoke all on function private.community_get_reaction_state_for_public_targets_legacy_m7(jsonb)
from public,anon,authenticated;

create or replace function public.community_get_reaction_state_for_public_targets(
  p_targets jsonb
)
returns jsonb
language plpgsql
stable
security definer
set search_path=pg_catalog,public,private
as $$
declare
  v_user uuid:=auth.uid();
  v_targets jsonb:=coalesce(p_targets,'[]'::jsonb);
  v_legacy jsonb;
  v_posts jsonb;
  v_post_target jsonb;
  v_id uuid;
begin
  if v_user is null then raise exception 'Not authenticated' using errcode='42501'; end if;
  if jsonb_typeof(v_targets)<>'array' then
    raise exception 'Reaction targets must be a JSON array' using errcode='22023';
  end if;
  if jsonb_array_length(v_targets)>100 then
    raise exception 'Too many reaction targets' using errcode='22023';
  end if;

  v_legacy:=(
    select coalesce(jsonb_agg(value),'[]'::jsonb)
    from jsonb_array_elements(v_targets)
    where lower(btrim(coalesce(value->>'target_type','')))<>'post'
  );

  v_posts:=(
    select coalesce(jsonb_agg(value),'[]'::jsonb)
    from jsonb_array_elements(v_targets)
    where lower(btrim(coalesce(value->>'target_type','')))='post'
  );

  for v_post_target in select value from jsonb_array_elements(v_posts)
  loop
    begin
      v_id:=(v_post_target->>'target_id')::uuid;
    exception when invalid_text_representation then
      raise exception 'Reaction target id must be a UUID' using errcode='22023';
    end;

    perform 1
    from public.community_posts post
    where post.id=v_id
      and post.actor_type='person'
      and public.community_get_post(post.id) is not null;

    if not found then
      raise exception 'Reaction target is not currently public' using errcode='22023';
    end if;
  end loop;

  v_legacy:=private.community_get_reaction_state_for_public_targets_legacy_m7(v_legacy);

  return jsonb_build_object(
    'targets',
    coalesce(v_legacy->'targets','[]'::jsonb)
    ||
    coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'target_type','post',
          'target_id',requested.target_id,
          'reaction_count',coalesce(summary.reaction_count,0),
          'reactions',coalesce(summary.reactions,'[]'::jsonb)
        )
        order by requested.ordinality
      )
      from (
        select
          (value->>'target_id')::uuid as target_id,
          ordinality
        from jsonb_array_elements(v_posts) with ordinality
      ) requested
      left join lateral (
        select
          coalesce(sum(reaction.count_for_type),0)::integer as reaction_count,
          coalesce(
            jsonb_agg(
              jsonb_build_object(
                'reaction_type',reaction.reaction_type,
                'count',reaction.count_for_type,
                'viewer_reacted',reaction.viewer_reacted
              )
              order by reaction.count_for_type desc,reaction.reaction_type
            ),
            '[]'::jsonb
          ) as reactions
        from (
          select
            row.reaction_type,
            count(*)::integer as count_for_type,
            bool_or(row.user_id=v_user) as viewer_reacted,
            min(row.id) as id
          from public.community_reactions row
          where row.target_type='post'
            and row.target_id=requested.target_id
          group by row.reaction_type
        ) reaction
      ) summary on true
    ),'[]'::jsonb)
  );
end;
$$;

revoke all on function public.community_get_reaction_state_for_public_targets(jsonb)
from public,anon;
grant execute on function public.community_get_reaction_state_for_public_targets(jsonb)
to authenticated;
create or replace function public.community_get_social_feed(
  p_limit integer default 30,
  p_before_published_at timestamptz default null,
  p_before_item_key text default null
)
returns jsonb
language plpgsql
stable
security definer
set search_path=pg_catalog,public,editorial
as $$
declare
  v_user uuid:=auth.uid();
  v_limit integer:=least(greatest(coalesce(p_limit,30),1),50);
  v_self uuid;
  v_self_slug text;
  v_self_path text;
  v_self_name text;
  v_self_image text;
  v_self_since timestamptz;
  v_base jsonb;
  v_items jsonb;
begin
  if v_user is null then raise exception 'authentication required'; end if;

  v_self:=editorial.current_person_post_actor();

  if v_self is not null then
    select
      alias.path,
      regexp_replace(alias.path,'^/people/',''),
      presentation.value->>'display_name',
      presentation.value->>'avatar_url',
      profile.created_at
    into v_self_path,v_self_slug,v_self_name,v_self_image,v_self_since
    from editorial.people person
    join editorial.person_identity_links link
      on link.person_resource_id=person.resource_id
     and link.link_state='active' and link.user_id=v_user
    join public.user_profiles profile
      on profile.user_id=v_user and profile.status='active' and profile.is_public
    cross join lateral (
      select editorial.resolve_person_presentation(person.resource_id) as value
    ) presentation
    join lateral (
      select a.path
      from editorial.resource_aliases a
      where a.resource_id=person.resource_id
        and a.is_canonical and a.retired_at is null
      order by a.created_at
      limit 1
    ) alias on true
    where person.resource_id=v_self
    limit 1;
  end if;

  v_base:=public.community_get_following_feed(
    50,p_before_published_at,p_before_item_key
  );

  with person_subjects as (
    select
      follow.target_id::uuid as person_id,
      coalesce(
        nullif(btrim(coalesce(follow.target_slug,'')),''),
        regexp_replace(alias.path,'^/people/','')
      ) as person_slug,
      follow.created_at as followed_at,
      false as is_self
    from public.community_follows follow
    left join lateral (
      select a.path
      from editorial.resource_aliases a
      where a.resource_id=follow.target_id::uuid
        and a.is_canonical and a.retired_at is null
      order by a.created_at
      limit 1
    ) alias on follow.target_type='person'
    where follow.user_id=v_user
      and follow.target_type='person'

    union all

    select v_self,v_self_slug,coalesce(v_self_since,now()),true
    where v_self is not null and v_self_slug is not null
  ),
  ranked_posts as (
    select
      post.id,
      post.body,
      post.image_url,
      post.link_url,
      post.link_label,
      post.published_at,
      subject.person_id,
      subject.person_slug,
      subject.followed_at,
      subject.is_self,
      row_number() over (
        partition by subject.person_id
        order by post.published_at desc,post.id desc
      ) as output_rank
    from person_subjects subject
    join public.community_posts post
      on post.actor_type='person'
     and post.person_resource_id=subject.person_id
     and post.status='published'
    where post.published_at>=now()-interval '180 days'
  ),
  person_items as (
    select
      'post'::text as item_type,
      ranked.id::text as item_id,
      'post:'||ranked.id::text as item_key,
      '/people/'||ranked.person_slug||'/posts/'||ranked.id::text as canonical_path,
      left(regexp_replace(ranked.body,E'[\n\r]+',' ','g'),90) as title,
      ranked.body as summary,
      ranked.image_url,
      ranked.link_url,
      ranked.link_label,
      ranked.published_at,
      jsonb_build_array(
        jsonb_build_object(
          'target_type','person',
          'target_id',ranked.person_id::text,
          'target_slug',ranked.person_slug,
          'followed_at',ranked.followed_at,
          'is_self',ranked.is_self
        )
      ) as matched_follows
    from ranked_posts ranked
    where ranked.output_rank<=3
      and (
        p_before_published_at is null
        or ranked.published_at<p_before_published_at
        or (
          p_before_item_key is not null
          and ranked.published_at=p_before_published_at
          and 'post:'||ranked.id::text<p_before_item_key
        )
      )
  ),
  base_items as (
    select
      item.value->>'item_type' as item_type,
      item.value->>'item_id' as item_id,
      item.value->>'item_key' as item_key,
      item.value->>'canonical_path' as canonical_path,
      item.value->>'title' as title,
      item.value->>'summary' as summary,
      item.value->>'image_url' as image_url,
      null::text as link_url,
      null::text as link_label,
      (item.value->>'published_at')::timestamptz as published_at,
      coalesce(item.value->'matched_follows','[]'::jsonb) as matched_follows
    from jsonb_array_elements(coalesce(v_base->'items','[]'::jsonb)) item(value)
  ),
  combined as (
    select * from base_items
    union all
    select * from person_items
  ),
  page as (
    select *
    from combined
    order by published_at desc,item_key desc
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
        'matched_follows',page.matched_follows
      )
      order by page.published_at desc,page.item_key desc
    ),
    '[]'::jsonb
  ) into v_items
  from page;

  return jsonb_build_object(
    'mode','current_interest',
    'subject_types',jsonb_build_array('person','artist'),
    'recent_window_days',180,
    'per_subject_recent_limit',3,
    'viewer_actor',
      case when v_self is null or v_self_path is null then null
      else jsonb_build_object(
        'type','person','id',v_self,'slug',v_self_slug,
        'name',v_self_name,'image_url',v_self_image,
        'canonical_path',v_self_path,'official',false
      ) end,
    'items',v_items
  );
end;
$$;

revoke all on function public.community_get_social_feed(integer,timestamp with time zone,text)
from public,anon;
grant execute on function public.community_get_social_feed(integer,timestamp with time zone,text)
to authenticated;
insert into private.phase_0a_rpc_classification(
  function_signature,access_class,rationale,reviewed_at
)
values
  (
    'community_get_post(uuid)',
    'public_read',
    'Reads only currently published Posts whose Person or Artist actor is public.',
    now()
  ),
  (
    'community_publish_post(text,uuid,text,text,text,text)',
    'authenticated_command',
    'Publishes as the signed-in Person or through existing Artist representation authority.',
    now()
  ),
  (
    'community_edit_post(uuid,text,text,text,text)',
    'authenticated_command',
    'Edits only the signed-in Person own Post or an Artist Post under current representation authority.',
    now()
  ),
  (
    'community_withdraw_post(uuid,text)',
    'authenticated_command',
    'Withdraws only the signed-in Person own Post or an Artist Post under current representation authority.',
    now()
  ),
  (
    'community_get_social_feed(integer,timestamp with time zone,text)',
    'authenticated_read',
    'Extends Following with the signed-in Person own Posts and Posts from followed Persons.',
    now()
  )
on conflict(function_signature)
do update set
  access_class=excluded.access_class,
  rationale=excluded.rationale,
  reviewed_at=excluded.reviewed_at;

commit;
