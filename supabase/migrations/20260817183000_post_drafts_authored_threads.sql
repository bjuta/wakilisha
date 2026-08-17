-- WAKILISHA M8C.3-M1: private Post drafts and authored Thread authority.
-- Drafts live outside the public Post table so unpublished work cannot leak through
-- existing Post, profile, Following, or detail readers.
-- Published Threads remain canonical Posts. Thread metadata only groups same-author
-- Posts in a deterministic authored order.

begin;

set local lock_timeout = '5s';
set local statement_timeout = '120s';

do $m8c3_preflight$
begin
  if to_regclass('public.community_posts') is null
     or to_regclass('public.registry_tracks') is null
     or to_regclass('private.phase_0a_rpc_classification') is null
     or to_regprocedure('private.community_resolve_post_command_actor(text,uuid)') is null
     or to_regprocedure('private.community_present_post_track(uuid)') is null
     or to_regprocedure('public.community_publish_post(text,uuid,text,text,text,text,uuid)') is null
     or to_regprocedure('public.community_quote_post(text,uuid,uuid,text,text,text,text,uuid)') is null
     or to_regprocedure('public.community_get_post(uuid)') is null then
    raise exception 'STOP: M8C.3 requires the final M8C.2 Post authority';
  end if;

  if to_regclass('private.community_post_drafts') is not null
     or to_regclass('public.community_post_threads') is not null then
    raise exception 'STOP: Post draft or Thread authority already exists';
  end if;

  if exists (
    select 1
    from information_schema.columns
    where table_schema='public'
      and table_name='community_posts'
      and column_name in ('thread_id','thread_position')
  ) then
    raise exception 'STOP: community_posts already has Thread metadata';
  end if;
end;
$m8c3_preflight$;

create table private.community_post_drafts (
  id uuid primary key default gen_random_uuid(),
  draft_group_id uuid not null,
  position integer not null default 1,
  actor_type text not null,
  person_resource_id uuid,
  artist_id uuid,
  author_user_id uuid not null,
  body text not null default '',
  image_url text,
  link_url text,
  link_label text,
  registry_track_id uuid,
  quoted_post_id uuid,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  constraint community_post_drafts_actor_type_check
    check (actor_type in ('person','artist')),
  constraint community_post_drafts_actor_identity_check
    check (
      (actor_type='person' and person_resource_id is not null and artist_id is null)
      or
      (actor_type='artist' and artist_id is not null and person_resource_id is null)
    ),
  constraint community_post_drafts_position_check
    check (position > 0),
  constraint community_post_drafts_body_length
    check (char_length(btrim(body)) <= 2000),
  constraint community_post_drafts_link_label_check
    check (
      link_label is null
      or (
        char_length(btrim(link_label)) between 1 and 120
        and nullif(btrim(coalesce(link_url,'')),'') is not null
      )
    ),
  constraint community_post_drafts_person_fkey
    foreign key (person_resource_id)
    references editorial.people(resource_id)
    on update restrict on delete restrict,
  constraint community_post_drafts_artist_fkey
    foreign key (artist_id)
    references public.registry_artists(id)
    on update restrict on delete restrict,
  constraint community_post_drafts_track_fkey
    foreign key (registry_track_id)
    references public.registry_tracks(id)
    on update restrict on delete restrict,
  constraint community_post_drafts_quote_fkey
    foreign key (quoted_post_id)
    references public.community_posts(id)
    on update restrict on delete restrict,
  constraint community_post_drafts_owner_group_position_key
    unique (author_user_id,draft_group_id,position)
);

create index community_post_drafts_owner_updated_idx
on private.community_post_drafts (author_user_id,updated_at desc,id desc);

create index community_post_drafts_owner_group_idx
on private.community_post_drafts (author_user_id,draft_group_id,position,id);

revoke all on table private.community_post_drafts from public,anon,authenticated;
grant select,insert,update,delete on table private.community_post_drafts to service_role;

comment on table private.community_post_drafts is
  'Private mutable authored Post work. Browser access is only through owner-scoped security-definer RPCs.';

create table public.community_post_threads (
  id uuid primary key default gen_random_uuid(),
  actor_type text not null,
  person_resource_id uuid,
  artist_id uuid,
  author_user_id uuid not null,
  created_at timestamp with time zone not null default now(),
  published_at timestamp with time zone not null default now(),
  constraint community_post_threads_actor_type_check
    check (actor_type in ('person','artist')),
  constraint community_post_threads_actor_identity_check
    check (
      (actor_type='person' and person_resource_id is not null and artist_id is null)
      or
      (actor_type='artist' and artist_id is not null and person_resource_id is null)
    ),
  constraint community_post_threads_person_fkey
    foreign key (person_resource_id)
    references editorial.people(resource_id)
    on update restrict on delete restrict,
  constraint community_post_threads_artist_fkey
    foreign key (artist_id)
    references public.registry_artists(id)
    on update restrict on delete restrict
);

revoke all on table public.community_post_threads from public,anon,authenticated;
grant select on table public.community_post_threads to service_role;

alter table public.community_posts
  add column thread_id uuid,
  add column thread_position integer;

alter table public.community_posts
  add constraint community_posts_thread_id_fkey
    foreign key (thread_id)
    references public.community_post_threads(id)
    on update restrict on delete restrict,
  add constraint community_posts_thread_pair_check
    check (
      (thread_id is null and thread_position is null)
      or
      (thread_id is not null and thread_position is not null and thread_position > 0)
    ),
  add constraint community_posts_thread_position_key
    unique (thread_id,thread_position);

create index community_posts_thread_idx
on public.community_posts (thread_id,thread_position,id)
where thread_id is not null;

comment on column public.community_posts.thread_id is
  'Optional authored Thread identity. The Post remains the canonical authored resource.';
comment on column public.community_posts.thread_position is
  'One-based deterministic position inside an authored Thread.';

create or replace function private.community_present_post_draft(
  p_draft_id uuid,
  p_user_id uuid
)
returns jsonb
language plpgsql
stable
security definer
set search_path=pg_catalog,public,private
as $function$
declare
  v_draft private.community_post_drafts%rowtype;
  v_track jsonb;
  v_quote jsonb;
begin
  select * into v_draft
  from private.community_post_drafts draft
  where draft.id=p_draft_id
    and draft.author_user_id=p_user_id;

  if not found then return null; end if;

  if v_draft.registry_track_id is not null then
    v_track:=private.community_present_post_track(v_draft.registry_track_id);
  end if;

  if v_draft.quoted_post_id is not null then
    v_quote:=public.community_get_post(v_draft.quoted_post_id);
  end if;

  return jsonb_build_object(
    'id',v_draft.id,
    'draft_group_id',v_draft.draft_group_id,
    'position',v_draft.position,
    'actor_type',v_draft.actor_type,
    'actor_id',case
      when v_draft.actor_type='person' then v_draft.person_resource_id
      else v_draft.artist_id
    end,
    'body',v_draft.body,
    'image_url',v_draft.image_url,
    'link_url',v_draft.link_url,
    'link_label',v_draft.link_label,
    'track',v_track,
    'quoted_post_id',v_draft.quoted_post_id,
    'quoted_post',v_quote,
    'created_at',v_draft.created_at,
    'updated_at',v_draft.updated_at
  );
end;
$function$;

revoke all
on function private.community_present_post_draft(uuid,uuid)
from public,anon,authenticated;
grant execute
on function private.community_present_post_draft(uuid,uuid)
to service_role;

create or replace function public.community_save_post_draft(
  p_draft_id uuid,
  p_draft_group_id uuid,
  p_position integer,
  p_actor_type text,
  p_actor_id uuid,
  p_body text,
  p_image_url text,
  p_link_url text,
  p_link_label text,
  p_registry_track_id uuid,
  p_quoted_post_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path=pg_catalog,public,editorial,private
as $function$
declare
  v_user uuid:=auth.uid();
  v_actor record;
  v_existing private.community_post_drafts%rowtype;
  v_saved private.community_post_drafts%rowtype;
  v_group uuid;
  v_position integer;
  v_body text:=btrim(coalesce(p_body,''));
  v_image text:=nullif(btrim(coalesce(p_image_url,'')),'');
  v_link text:=nullif(btrim(coalesce(p_link_url,'')),'');
  v_label text:=nullif(btrim(coalesce(p_link_label,'')),'');
begin
  if v_user is null then raise exception 'authentication_required'; end if;
  if p_actor_id is null then raise exception 'invalid_post_actor'; end if;
  if char_length(v_body)>2000 then raise exception 'invalid_post_body'; end if;
  if v_image is not null and (char_length(v_image)>2048 or v_image !~* '^https?://') then
    raise exception 'invalid_post_image_url';
  end if;
  if v_link is not null and (char_length(v_link)>2048 or v_link !~* '^https?://') then
    raise exception 'invalid_post_link_url';
  end if;
  if v_label is not null and (char_length(v_label)>120 or v_link is null) then
    raise exception 'invalid_post_link_label';
  end if;

  select * into v_actor
  from private.community_resolve_post_command_actor(p_actor_type,p_actor_id);

  if p_registry_track_id is not null then
    perform 1 from public.registry_tracks track
    where track.id=p_registry_track_id and track.status='active';
    if not found then raise exception 'post_track_not_available' using errcode='22023'; end if;
  end if;

  if p_quoted_post_id is not null then
    perform 1 from public.community_posts post
    where post.id=p_quoted_post_id and post.status='published';
    if not found then raise exception 'quoted_post_not_available'; end if;
  end if;

  if p_draft_id is not null then
    select * into v_existing
    from private.community_post_drafts draft
    where draft.id=p_draft_id
      and draft.author_user_id=v_user
    for update;
    if not found then raise exception 'post_draft_not_found'; end if;
  end if;

  v_group:=coalesce(p_draft_group_id,v_existing.draft_group_id,gen_random_uuid());

  perform 1
  from private.community_post_drafts sibling
  where sibling.author_user_id=v_user
    and sibling.draft_group_id=v_group
    and sibling.id is distinct from p_draft_id
    and (
      sibling.actor_type is distinct from v_actor.resolved_actor_type
      or sibling.person_resource_id is distinct from v_actor.person_resource_id
      or sibling.artist_id is distinct from v_actor.artist_id
    );
  if found then raise exception 'thread_draft_actor_mismatch'; end if;

  if p_position is not null and p_position<1 then
    raise exception 'invalid_thread_position';
  end if;

  if p_position is not null then
    v_position:=p_position;
  elsif p_draft_id is not null then
    v_position:=v_existing.position;
  else
    select coalesce(max(sibling.position),0)+1 into v_position
    from private.community_post_drafts sibling
    where sibling.author_user_id=v_user
      and sibling.draft_group_id=v_group;
  end if;

  if p_draft_id is null then
    insert into private.community_post_drafts (
      draft_group_id,position,actor_type,person_resource_id,artist_id,
      author_user_id,body,image_url,link_url,link_label,registry_track_id,
      quoted_post_id
    ) values (
      v_group,v_position,v_actor.resolved_actor_type,
      v_actor.person_resource_id,v_actor.artist_id,v_user,
      v_body,v_image,v_link,v_label,p_registry_track_id,p_quoted_post_id
    ) returning * into v_saved;
  else
    update private.community_post_drafts
    set
      draft_group_id=v_group,
      position=v_position,
      actor_type=v_actor.resolved_actor_type,
      person_resource_id=v_actor.person_resource_id,
      artist_id=v_actor.artist_id,
      body=v_body,
      image_url=v_image,
      link_url=v_link,
      link_label=v_label,
      registry_track_id=p_registry_track_id,
      quoted_post_id=p_quoted_post_id,
      updated_at=now()
    where id=p_draft_id
      and author_user_id=v_user
    returning * into v_saved;
  end if;

  return private.community_present_post_draft(v_saved.id,v_user);
end;
$function$;

revoke all
on function public.community_save_post_draft(uuid,uuid,integer,text,uuid,text,text,text,text,uuid,uuid)
from public,anon;
grant execute
on function public.community_save_post_draft(uuid,uuid,integer,text,uuid,text,text,text,text,uuid,uuid)
to authenticated;

create or replace function public.community_get_post_drafts(
  p_actor_type text,
  p_actor_id uuid
)
returns jsonb
language plpgsql
stable
security definer
set search_path=pg_catalog,public,private
as $function$
declare
  v_user uuid:=auth.uid();
  v_actor record;
  v_items jsonb;
begin
  if v_user is null then raise exception 'authentication_required'; end if;

  select * into v_actor
  from private.community_resolve_post_command_actor(p_actor_type,p_actor_id);

  select coalesce(
    jsonb_agg(
      private.community_present_post_draft(draft.id,v_user)
      order by group_meta.updated_at desc,draft.draft_group_id,draft.position,draft.id
    ),
    '[]'::jsonb
  ) into v_items
  from private.community_post_drafts draft
  join lateral (
    select max(sibling.updated_at) as updated_at
    from private.community_post_drafts sibling
    where sibling.author_user_id=v_user
      and sibling.draft_group_id=draft.draft_group_id
  ) group_meta on true
  where draft.author_user_id=v_user
    and draft.actor_type=v_actor.resolved_actor_type
    and draft.person_resource_id is not distinct from v_actor.person_resource_id
    and draft.artist_id is not distinct from v_actor.artist_id;

  return v_items;
end;
$function$;

revoke all
on function public.community_get_post_drafts(text,uuid)
from public,anon;
grant execute
on function public.community_get_post_drafts(text,uuid)
to authenticated;

create or replace function public.community_delete_post_draft(
  p_draft_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path=pg_catalog,private
as $function$
declare
  v_user uuid:=auth.uid();
  v_group uuid;
begin
  if v_user is null then raise exception 'authentication_required'; end if;

  delete from private.community_post_drafts draft
  where draft.id=p_draft_id
    and draft.author_user_id=v_user
  returning draft.draft_group_id into v_group;

  if v_group is null then raise exception 'post_draft_not_found'; end if;

  return jsonb_build_object(
    'deleted',true,
    'draft_id',p_draft_id,
    'draft_group_id',v_group
  );
end;
$function$;

revoke all on function public.community_delete_post_draft(uuid) from public,anon;
grant execute on function public.community_delete_post_draft(uuid) to authenticated;

create or replace function public.community_reorder_post_draft_group(
  p_draft_group_id uuid,
  p_draft_ids uuid[]
)
returns jsonb
language plpgsql
security definer
set search_path=pg_catalog,private
as $function$
declare
  v_user uuid:=auth.uid();
  v_count integer;
  v_requested integer;
  v_item record;
begin
  if v_user is null then raise exception 'authentication_required'; end if;
  if p_draft_group_id is null or p_draft_ids is null then
    raise exception 'invalid_thread_draft_order';
  end if;

  v_requested:=cardinality(p_draft_ids);
  if v_requested<1 or v_requested>50 then raise exception 'invalid_thread_draft_order'; end if;

  select count(*) into v_count
  from private.community_post_drafts draft
  where draft.author_user_id=v_user
    and draft.draft_group_id=p_draft_group_id;

  if v_count<>v_requested
     or (select count(distinct item_id) from unnest(p_draft_ids) item_id)<>v_requested
     or exists (
       select 1 from unnest(p_draft_ids) item_id
       where not exists (
         select 1 from private.community_post_drafts draft
         where draft.id=item_id
           and draft.author_user_id=v_user
           and draft.draft_group_id=p_draft_group_id
       )
     ) then
    raise exception 'invalid_thread_draft_order';
  end if;

  for v_item in
    select item_id,ordinality
    from unnest(p_draft_ids) with ordinality ordered(item_id,ordinality)
  loop
    update private.community_post_drafts
    set position=1000+v_item.ordinality,
        updated_at=now()
    where id=v_item.item_id and author_user_id=v_user;
  end loop;

  update private.community_post_drafts draft
  set position=ordered.ordinality,
      updated_at=now()
  from unnest(p_draft_ids) with ordinality ordered(item_id,ordinality)
  where draft.id=ordered.item_id
    and draft.author_user_id=v_user
    and draft.draft_group_id=p_draft_group_id;

  return jsonb_build_object(
    'draft_group_id',p_draft_group_id,
    'ordered_draft_ids',to_jsonb(p_draft_ids)
  );
end;
$function$;

revoke all on function public.community_reorder_post_draft_group(uuid,uuid[]) from public,anon;
grant execute on function public.community_reorder_post_draft_group(uuid,uuid[]) to authenticated;

create or replace function public.community_publish_post_draft_group(
  p_draft_group_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path=pg_catalog,public,editorial,private
as $function$
declare
  v_user uuid:=auth.uid();
  v_count integer;
  v_actor_type text;
  v_actor_id uuid;
  v_person_id uuid;
  v_artist_id uuid;
  v_actor record;
  v_thread_id uuid;
  v_draft private.community_post_drafts%rowtype;
  v_payload jsonb;
  v_post_id uuid;
  v_posts jsonb:='[]'::jsonb;
  v_expected_position integer:=0;
begin
  if v_user is null then raise exception 'authentication_required'; end if;
  if p_draft_group_id is null then raise exception 'post_draft_group_required'; end if;

  select
    count(*),
    min(draft.actor_type),
    min(draft.person_resource_id),
    min(draft.artist_id)
  into v_count,v_actor_type,v_person_id,v_artist_id
  from private.community_post_drafts draft
  where draft.author_user_id=v_user
    and draft.draft_group_id=p_draft_group_id;

  if v_count<1 then raise exception 'post_draft_group_not_found'; end if;
  if v_count>50 then raise exception 'thread_too_long'; end if;

  if exists (
    select 1
    from private.community_post_drafts draft
    where draft.author_user_id=v_user
      and draft.draft_group_id=p_draft_group_id
      and (
        draft.actor_type is distinct from v_actor_type
        or draft.person_resource_id is distinct from v_person_id
        or draft.artist_id is distinct from v_artist_id
      )
  ) then
    raise exception 'thread_draft_actor_mismatch';
  end if;

  v_actor_id:=case when v_actor_type='person' then v_person_id else v_artist_id end;
  select * into v_actor
  from private.community_resolve_post_command_actor(v_actor_type,v_actor_id);

  if v_count>1 then
    insert into public.community_post_threads (
      actor_type,person_resource_id,artist_id,author_user_id
    ) values (
      v_actor.resolved_actor_type,
      v_actor.person_resource_id,
      v_actor.artist_id,
      v_user
    ) returning id into v_thread_id;
  end if;

  for v_draft in
    select *
    from private.community_post_drafts draft
    where draft.author_user_id=v_user
      and draft.draft_group_id=p_draft_group_id
    order by draft.position,draft.id
    for update
  loop
    v_expected_position:=v_expected_position+1;

    if nullif(btrim(v_draft.body),'') is null
       and nullif(btrim(coalesce(v_draft.image_url,'')),'') is null
       and nullif(btrim(coalesce(v_draft.link_url,'')),'') is null
       and v_draft.registry_track_id is null then
      raise exception 'invalid_post_content';
    end if;

    if v_draft.quoted_post_id is null then
      v_payload:=public.community_publish_post(
        v_actor.resolved_actor_type,
        v_actor_id,
        v_draft.body,
        v_draft.image_url,
        v_draft.link_url,
        v_draft.link_label,
        v_draft.registry_track_id
      );
    else
      v_payload:=public.community_quote_post(
        v_actor.resolved_actor_type,
        v_actor_id,
        v_draft.quoted_post_id,
        v_draft.body,
        v_draft.image_url,
        v_draft.link_url,
        v_draft.link_label,
        v_draft.registry_track_id
      );
    end if;

    v_post_id:=nullif(v_payload->>'id','')::uuid;
    if v_post_id is null then raise exception 'post_publish_failed'; end if;

    if v_thread_id is not null then
      update public.community_posts
      set thread_id=v_thread_id,
          thread_position=v_expected_position,
          updated_at=now()
      where id=v_post_id
        and author_user_id=v_user;

      if not found then raise exception 'thread_post_link_failed'; end if;
    end if;

    v_posts:=v_posts || jsonb_build_array(public.community_get_post(v_post_id));
  end loop;

  delete from private.community_post_drafts draft
  where draft.author_user_id=v_user
    and draft.draft_group_id=p_draft_group_id;

  return jsonb_build_object(
    'draft_group_id',p_draft_group_id,
    'thread_id',v_thread_id,
    'post_count',v_count,
    'posts',v_posts
  );
end;
$function$;

revoke all on function public.community_publish_post_draft_group(uuid) from public,anon;
grant execute on function public.community_publish_post_draft_group(uuid) to authenticated;

create or replace function public.community_get_thread(
  p_thread_id uuid
)
returns jsonb
language plpgsql
stable
security definer
set search_path=pg_catalog,public
as $function$
declare
  v_thread public.community_post_threads%rowtype;
  v_items jsonb;
begin
  select * into v_thread
  from public.community_post_threads thread
  where thread.id=p_thread_id;

  if not found then return null; end if;

  select coalesce(
    jsonb_agg(item.payload order by item.thread_position,item.post_id),
    '[]'::jsonb
  ) into v_items
  from (
    select
      post.id as post_id,
      post.thread_position,
      public.community_get_post(post.id) as payload
    from public.community_posts post
    where post.thread_id=p_thread_id
      and post.status='published'
  ) item
  where item.payload is not null;

  if jsonb_array_length(v_items)=0 then return null; end if;

  return jsonb_build_object(
    'id',v_thread.id,
    'actor_type',v_thread.actor_type,
    'actor_id',case
      when v_thread.actor_type='person' then v_thread.person_resource_id
      else v_thread.artist_id
    end,
    'published_at',v_thread.published_at,
    'items',v_items
  );
end;
$function$;

revoke all on function public.community_get_thread(uuid) from public;
grant execute on function public.community_get_thread(uuid) to anon,authenticated;

create or replace function public.community_get_post_thread_context(
  p_post_id uuid
)
returns jsonb
language sql
stable
security definer
set search_path=pg_catalog,public
as $function$
  select case
    when post.status<>'published' or post.thread_id is null then null
    else jsonb_build_object(
      'thread_id',post.thread_id,
      'position',post.thread_position,
      'item_count',(
        select count(*)
        from public.community_posts sibling
        where sibling.thread_id=post.thread_id
          and sibling.status='published'
      )
    )
  end
  from public.community_posts post
  where post.id=p_post_id;
$function$;

revoke all on function public.community_get_post_thread_context(uuid) from public;
grant execute on function public.community_get_post_thread_context(uuid) to anon,authenticated;

insert into private.phase_0a_rpc_classification (
  function_signature,access_class,rationale,reviewed_at
)
values
  (
    'community_save_post_draft(uuid,uuid,integer,text,uuid,text,text,text,text,uuid,uuid)',
    'authenticated_command',
    'Creates or updates private mutable Post work for the signed-in canonical Person or represented Artist without entering any public Post reader.',
    now()
  ),
  (
    'community_get_post_drafts(text,uuid)',
    'authenticated_read',
    'Reads only the signed-in author own private Post drafts after resolving current Person or Artist posting authority.',
    now()
  ),
  (
    'community_delete_post_draft(uuid)',
    'authenticated_command',
    'Deletes one private Post draft owned by the signed-in author.',
    now()
  ),
  (
    'community_reorder_post_draft_group(uuid,uuid[])',
    'authenticated_command',
    'Reorders every item in one owner-scoped authored Thread draft with a complete deterministic order.',
    now()
  ),
  (
    'community_publish_post_draft_group(uuid)',
    'authenticated_command',
    'Atomically publishes one draft or an ordered same-author Thread by reusing the canonical Post and Quote Post writers.',
    now()
  ),
  (
    'community_get_thread(uuid)',
    'public_read',
    'Reads the published canonical Posts that belong to one authored Thread in deterministic order.',
    now()
  ),
  (
    'community_get_post_thread_context(uuid)',
    'public_read',
    'Returns published Thread identity, position, and visible item count for one canonical Post.',
    now()
  )
on conflict (function_signature)
do update
set
  access_class=excluded.access_class,
  rationale=excluded.rationale,
  reviewed_at=excluded.reviewed_at;

commit;
