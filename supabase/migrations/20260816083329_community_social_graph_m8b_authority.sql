-- WAKILISHA M8B-M1: durable social graph authority for Repost, Quote Post, Block, and Post Report.
-- Extend the canonical Post, Follow, Report, and Notification ledgers instead of creating parallel product systems.

begin;

do $m8b_preflight$
begin
  if to_regclass('public.community_posts') is null
     or to_regclass('public.community_follows') is null
     or to_regclass('public.community_reports') is null
     or to_regclass('public.community_notifications') is null
     or to_regclass('private.phase_0a_rpc_classification') is null then
    raise exception 'STOP: required M8B authority tables are missing';
  end if;

  if to_regprocedure('editorial.current_person_post_actor()') is null
     or to_regprocedure('editorial.current_artist_representation(uuid)') is null
     or to_regprocedure('private.community_resolve_follow_target(text,text,text)') is null
     or to_regprocedure('public.community_get_post(uuid)') is null
     or to_regprocedure('public.community_set_follow_state(text,text,text,boolean)') is null
     or to_regprocedure('public.community_report_comment(uuid,text,text)') is null then
    raise exception 'STOP: required M8B RPC authority is incomplete';
  end if;

  if exists (
    select 1
    from information_schema.columns
    where table_schema='public'
      and table_name='community_posts'
      and column_name='quoted_post_id'
  ) or to_regclass('public.community_post_reposts') is not null
     or to_regclass('public.community_blocks') is not null
     or exists (
       select 1
       from information_schema.columns
       where table_schema='public'
         and table_name='community_reports'
         and column_name='post_id'
     ) then
    raise exception 'STOP: M8B-M1 schema authority already exists';
  end if;

  if exists (
    select 1
    from public.community_reports report
    where pg_catalog.num_nonnulls(
      report.comment_id,
      report.profile_id
    ) <> 1
  ) then
    raise exception 'STOP: existing community_reports rows violate single-target authority';
  end if;
end;
$m8b_preflight$;

alter table public.community_posts
  add column quoted_post_id uuid;

alter table public.community_posts
  add constraint community_posts_quoted_post_id_fkey
    foreign key (quoted_post_id)
    references public.community_posts(id)
    on update restrict
    on delete restrict,
  add constraint community_posts_quoted_post_not_self_check
    check (quoted_post_id is null or quoted_post_id <> id);

create index community_posts_quoted_post_idx
on public.community_posts (quoted_post_id)
where quoted_post_id is not null;

create table public.community_post_reposts (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null
    references public.community_posts(id)
    on update restrict
    on delete restrict,
  actor_type text not null,
  person_resource_id uuid
    references editorial.people(resource_id)
    on update restrict
    on delete restrict,
  artist_id uuid
    references public.registry_artists(id)
    on update restrict
    on delete restrict,
  representation_id uuid
    references public.artist_representations(id)
    on update restrict
    on delete set null,
  author_user_id uuid
    references auth.users(id)
    on delete set null,
  status text not null default 'active',
  withdrawn_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint community_post_reposts_actor_type_check
    check (actor_type in ('person','artist')),
  constraint community_post_reposts_status_check
    check (status in ('active','withdrawn')),
  constraint community_post_reposts_actor_identity_check
    check (
      (
        actor_type='person'
        and person_resource_id is not null
        and artist_id is null
        and representation_id is null
      )
      or
      (
        actor_type='artist'
        and artist_id is not null
        and person_resource_id is null
      )
    ),
  constraint community_post_reposts_status_time_check
    check (
      (status='active' and withdrawn_at is null)
      or
      (status='withdrawn' and withdrawn_at is not null)
    )
);

create unique index community_post_reposts_person_identity_key
on public.community_post_reposts (post_id,person_resource_id)
where actor_type='person';

create unique index community_post_reposts_artist_identity_key
on public.community_post_reposts (post_id,artist_id)
where actor_type='artist';

create index community_post_reposts_post_active_idx
on public.community_post_reposts (post_id,created_at desc,id desc)
where status='active';

create index community_post_reposts_person_active_idx
on public.community_post_reposts (person_resource_id,created_at desc,id desc)
where actor_type='person' and status='active';

create index community_post_reposts_artist_active_idx
on public.community_post_reposts (artist_id,created_at desc,id desc)
where actor_type='artist' and status='active';

alter table public.community_post_reposts enable row level security;

create policy community_post_reposts_own_read
on public.community_post_reposts
for select
using (author_user_id=auth.uid());

create policy community_post_reposts_admin_read
on public.community_post_reposts
for select
using (public.has_capability('view_community'));

revoke all on table public.community_post_reposts
from public,anon,authenticated;

create table public.community_blocks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null
    references auth.users(id)
    on delete cascade,
  target_type text not null,
  target_id text not null,
  target_slug text,
  status text not null default 'active',
  blocked_at timestamptz not null default now(),
  unblocked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint community_blocks_target_type_check
    check (target_type in ('person','artist')),
  constraint community_blocks_status_check
    check (status in ('active','revoked')),
  constraint community_blocks_status_time_check
    check (
      (status='active' and unblocked_at is null)
      or
      (status='revoked' and unblocked_at is not null)
    ),
  constraint community_blocks_user_target_key
    unique (user_id,target_type,target_id)
);

create index community_blocks_active_target_idx
on public.community_blocks (user_id,target_type,target_id)
where status='active';

alter table public.community_blocks enable row level security;

create policy community_blocks_own_read
on public.community_blocks
for select
using (user_id=auth.uid());

create policy community_blocks_admin_read
on public.community_blocks
for select
using (public.has_capability('view_community'));

revoke all on table public.community_blocks
from public,anon,authenticated;

alter table public.community_reports
  add column post_id uuid
    references public.community_posts(id)
    on update restrict
    on delete restrict;

alter table public.community_reports
  add constraint community_reports_exactly_one_target_check
  check (
    pg_catalog.num_nonnulls(
      comment_id,
      profile_id,
      post_id
    )=1
  );

create index community_reports_post_created_idx
on public.community_reports (post_id,created_at desc)
where post_id is not null;

create or replace function private.community_resolve_post_command_actor(
  p_actor_type text,
  p_actor_id uuid
)
returns table (
  resolved_actor_type text,
  person_resource_id uuid,
  artist_id uuid,
  representation_id uuid
)
language plpgsql
stable
security definer
set search_path=pg_catalog,public,editorial,private
as $$
declare
  v_user uuid:=auth.uid();
  v_type text:=lower(btrim(coalesce(p_actor_type,'')));
  v_person uuid;
  v_rep public.artist_representations%rowtype;
begin
  if v_user is null then
    raise exception 'authentication_required';
  end if;

  if v_type not in ('person','artist') or p_actor_id is null then
    raise exception 'invalid_post_actor';
  end if;

  if v_type='person' then
    v_person:=editorial.current_person_post_actor();

    if v_person is null or v_person is distinct from p_actor_id then
      raise exception 'insufficient_person_post_privilege';
    end if;

    return query
    select
      'person'::text,
      v_person,
      null::uuid,
      null::uuid;
    return;
  end if;

  select *
  into v_rep
  from editorial.current_artist_representation(p_actor_id);

  if v_rep.id is null or not v_rep.can_post_updates then
    raise exception 'insufficient_artist_update_privilege';
  end if;

  perform 1
  from public.registry_artists artist
  where artist.id=p_actor_id
    and artist.status='active';

  if not found then
    raise exception 'artist_not_found';
  end if;

  return query
  select
    'artist'::text,
    null::uuid,
    p_actor_id,
    v_rep.id;
end;
$$;

revoke all on function private.community_resolve_post_command_actor(text,uuid)
from public,anon,authenticated;

create or replace function private.community_is_blocked_target(
  p_user_id uuid,
  p_target_type text,
  p_target_id text
)
returns boolean
language sql
stable
security definer
set search_path=pg_catalog,public,private
as $$
  select exists (
    select 1
    from public.community_blocks block
    where block.user_id=p_user_id
      and block.target_type=p_target_type
      and block.target_id=p_target_id
      and block.status='active'
  )
$$;

revoke all on function private.community_is_blocked_target(uuid,text,text)
from public,anon,authenticated;

create or replace function private.community_guard_follow_against_blocks()
returns trigger
language plpgsql
security definer
set search_path=pg_catalog,public,private
as $$
begin
  if new.target_type in ('person','artist')
     and private.community_is_blocked_target(
       new.user_id,
       new.target_type,
       new.target_id
     ) then
    raise exception
      'Blocked targets cannot be followed'
      using errcode='42501';
  end if;

  return new;
end;
$$;

revoke all on function private.community_guard_follow_against_blocks()
from public,anon,authenticated;

create trigger trg_community_follows_block_guard
before insert or update of user_id,target_type,target_id
on public.community_follows
for each row
execute function private.community_guard_follow_against_blocks();

create or replace function public.community_set_block_state(
  p_target_type text,
  p_target_id text,
  p_target_slug text,
  p_blocked boolean
)
returns jsonb
language plpgsql
security definer
set search_path=pg_catalog,public,editorial,private
as $$
declare
  v_user uuid:=auth.uid();
  v_blocked boolean:=coalesce(p_blocked,false);
  v_target record;
  v_rep public.artist_representations%rowtype;
  v_block public.community_blocks%rowtype;
begin
  if v_user is null then
    raise exception
      'Not authenticated'
      using errcode='42501';
  end if;

  select *
  into v_target
  from private.community_resolve_follow_target(
    p_target_type,
    p_target_id,
    p_target_slug
  );

  if v_target.canonical_type not in ('person','artist') then
    raise exception
      'Unsupported Block target type'
      using errcode='22023';
  end if;

  if v_target.canonical_type='person'
     and exists (
       select 1
       from editorial.person_identity_links link
       where link.person_resource_id=v_target.canonical_id::uuid
         and link.user_id=v_user
         and link.link_state='active'
     ) then
    raise exception
      'A user cannot block their own Person'
      using errcode='22023';
  end if;

  if v_target.canonical_type='artist' then
    select *
    into v_rep
    from editorial.current_artist_representation(
      v_target.canonical_id::uuid
    );

    if v_rep.id is not null then
      raise exception
        'A user cannot block an Artist they represent'
        using errcode='22023';
    end if;
  end if;

  perform pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      v_user::text
      || '|block|'
      || v_target.canonical_type
      || '|'
      || v_target.canonical_id,
      0
    )
  );

  if v_blocked then
    insert into public.community_blocks (
      user_id,
      target_type,
      target_id,
      target_slug,
      status,
      blocked_at,
      unblocked_at,
      updated_at
    )
    values (
      v_user,
      v_target.canonical_type,
      v_target.canonical_id,
      v_target.canonical_slug,
      'active',
      now(),
      null,
      now()
    )
    on conflict (user_id,target_type,target_id)
    do update
    set
      target_slug=excluded.target_slug,
      status='active',
      blocked_at=now(),
      unblocked_at=null,
      updated_at=now()
    returning *
    into v_block;

    delete from public.community_follows follow
    where follow.user_id=v_user
      and follow.target_type=v_target.canonical_type
      and follow.target_id=v_target.canonical_id;
  else
    update public.community_blocks block
    set
      status='revoked',
      unblocked_at=now(),
      updated_at=now()
    where block.user_id=v_user
      and block.target_type=v_target.canonical_type
      and block.target_id=v_target.canonical_id
      and block.status='active'
    returning *
    into v_block;

    if v_block.id is null then
      select *
      into v_block
      from public.community_blocks block
      where block.user_id=v_user
        and block.target_type=v_target.canonical_type
        and block.target_id=v_target.canonical_id
      limit 1;
    end if;
  end if;

  return jsonb_build_object(
    'blocked',v_blocked,
    'block_id',v_block.id,
    'target_type',v_target.canonical_type,
    'target_id',v_target.canonical_id,
    'target_slug',v_target.canonical_slug
  );
end;
$$;

revoke all on function public.community_set_block_state(text,text,text,boolean)
from public,anon;
grant execute on function public.community_set_block_state(text,text,text,boolean)
to authenticated;

create or replace function public.community_get_block_state(
  p_target_type text,
  p_target_id text,
  p_target_slug text
)
returns jsonb
language plpgsql
stable
security definer
set search_path=pg_catalog,public,private
as $$
declare
  v_user uuid:=auth.uid();
  v_target record;
  v_block public.community_blocks%rowtype;
begin
  if v_user is null then
    raise exception
      'Not authenticated'
      using errcode='42501';
  end if;

  select *
  into v_target
  from private.community_resolve_follow_target(
    p_target_type,
    p_target_id,
    p_target_slug
  );

  if v_target.canonical_type not in ('person','artist') then
    raise exception
      'Unsupported Block target type'
      using errcode='22023';
  end if;

  select *
  into v_block
  from public.community_blocks block
  where block.user_id=v_user
    and block.target_type=v_target.canonical_type
    and block.target_id=v_target.canonical_id
    and block.status='active'
  limit 1;

  return jsonb_build_object(
    'blocked',v_block.id is not null,
    'block_id',v_block.id,
    'target_type',v_target.canonical_type,
    'target_id',v_target.canonical_id,
    'target_slug',v_target.canonical_slug
  );
end;
$$;

revoke all on function public.community_get_block_state(text,text,text)
from public,anon;
grant execute on function public.community_get_block_state(text,text,text)
to authenticated;

create or replace function public.community_set_post_repost_state(
  p_actor_type text,
  p_actor_id uuid,
  p_post_id uuid,
  p_reposted boolean
)
returns jsonb
language plpgsql
security definer
set search_path=pg_catalog,public,editorial,private
as $$
declare
  v_user uuid:=auth.uid();
  v_reposted boolean:=coalesce(p_reposted,false);
  v_actor record;
  v_post public.community_posts%rowtype;
  v_repost public.community_post_reposts%rowtype;
  v_changed boolean:=false;
  v_actor_id text;
  v_post_actor_id text;
begin
  if v_user is null then
    raise exception 'authentication_required';
  end if;

  select *
  into v_actor
  from private.community_resolve_post_command_actor(
    p_actor_type,
    p_actor_id
  );

  select *
  into v_post
  from public.community_posts post
  where post.id=p_post_id
  for update;

  if not found then
    raise exception 'post_not_found';
  end if;

  v_actor_id:=case
    when v_actor.resolved_actor_type='person'
      then v_actor.person_resource_id::text
    else v_actor.artist_id::text
  end;

  v_post_actor_id:=case
    when v_post.actor_type='person'
      then v_post.person_resource_id::text
    else v_post.artist_id::text
  end;

  if v_reposted then
    if v_post.status<>'published' then
      raise exception 'post_not_repostable';
    end if;

    if private.community_is_blocked_target(
      v_user,
      v_post.actor_type,
      v_post_actor_id
    ) then
      raise exception
        'blocked_post_target'
        using errcode='42501';
    end if;
  end if;

  perform pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      v_actor.resolved_actor_type
      || '|'
      || v_actor_id
      || '|repost|'
      || p_post_id::text,
      0
    )
  );

  select *
  into v_repost
  from public.community_post_reposts repost
  where repost.post_id=p_post_id
    and repost.actor_type=v_actor.resolved_actor_type
    and (
      (
        v_actor.resolved_actor_type='person'
        and repost.person_resource_id=v_actor.person_resource_id
      )
      or
      (
        v_actor.resolved_actor_type='artist'
        and repost.artist_id=v_actor.artist_id
      )
    )
  for update;

  if v_reposted then
    if v_repost.id is null then
      insert into public.community_post_reposts (
        post_id,
        actor_type,
        person_resource_id,
        artist_id,
        representation_id,
        author_user_id,
        status,
        withdrawn_at
      )
      values (
        p_post_id,
        v_actor.resolved_actor_type,
        v_actor.person_resource_id,
        v_actor.artist_id,
        v_actor.representation_id,
        v_user,
        'active',
        null
      )
      returning *
      into v_repost;

      v_changed:=true;
    elsif v_repost.status<>'active' then
      update public.community_post_reposts repost
      set
        representation_id=v_actor.representation_id,
        author_user_id=v_user,
        status='active',
        withdrawn_at=null,
        updated_at=now()
      where repost.id=v_repost.id
      returning *
      into v_repost;

      v_changed:=true;
    end if;
  elsif v_repost.id is not null
        and v_repost.status='active' then
    update public.community_post_reposts repost
    set
      status='withdrawn',
      withdrawn_at=now(),
      updated_at=now()
    where repost.id=v_repost.id
    returning *
    into v_repost;

    v_changed:=true;
  end if;

  if v_reposted
     and v_changed
     and v_post.author_user_id is not null
     and v_post.author_user_id<>v_user
     and not private.community_is_blocked_target(
       v_post.author_user_id,
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
      v_post.author_user_id,
      v_user,
      'post_repost',
      'post',
      p_post_id::text,
      jsonb_build_object(
        'repost_id',v_repost.id,
        'actor_type',v_actor.resolved_actor_type,
        'actor_id',v_actor_id,
        'canonical_path',
          public.community_get_post(p_post_id)->>'canonical_path'
      )
    );
  end if;

  return jsonb_build_object(
    'reposted',v_reposted and v_repost.id is not null and v_repost.status='active',
    'repost_id',v_repost.id,
    'post_id',p_post_id,
    'actor_type',v_actor.resolved_actor_type,
    'actor_id',v_actor_id,
    'changed',v_changed
  );
end;
$$;

revoke all on function public.community_set_post_repost_state(text,uuid,uuid,boolean)
from public,anon;
grant execute on function public.community_set_post_repost_state(text,uuid,uuid,boolean)
to authenticated;

create or replace function public.community_get_actor_repost_state(
  p_actor_type text,
  p_actor_id uuid,
  p_post_ids uuid[]
)
returns jsonb
language plpgsql
stable
security definer
set search_path=pg_catalog,public,private
as $$
declare
  v_actor record;
  v_ids uuid[]:=coalesce(p_post_ids,array[]::uuid[]);
  v_result jsonb;
begin
  select *
  into v_actor
  from private.community_resolve_post_command_actor(
    p_actor_type,
    p_actor_id
  );

  if coalesce(array_length(v_ids,1),0)>100 then
    raise exception
      'too_many_post_ids'
      using errcode='22023';
  end if;

  with ids as (
    select distinct unnest(v_ids) as post_id
  ),
  published as (
    select ids.post_id
    from ids
    join public.community_posts post
      on post.id=ids.post_id
     and post.status='published'
  )
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'post_id',published.post_id,
        'repost_count',(
          select count(*)::integer
          from public.community_post_reposts count_repost
          where count_repost.post_id=published.post_id
            and count_repost.status='active'
        ),
        'viewer_reposted',viewer_repost.id is not null,
        'viewer_repost_id',viewer_repost.id
      )
      order by published.post_id
    ),
    '[]'::jsonb
  )
  into v_result
  from published
  left join public.community_post_reposts viewer_repost
    on viewer_repost.post_id=published.post_id
   and viewer_repost.status='active'
   and viewer_repost.actor_type=v_actor.resolved_actor_type
   and (
     (
       v_actor.resolved_actor_type='person'
       and viewer_repost.person_resource_id=v_actor.person_resource_id
     )
     or
     (
       v_actor.resolved_actor_type='artist'
       and viewer_repost.artist_id=v_actor.artist_id
     )
   );

  return coalesce(v_result,'[]'::jsonb);
end;
$$;

revoke all on function public.community_get_actor_repost_state(text,uuid,uuid[])
from public,anon;
grant execute on function public.community_get_actor_repost_state(text,uuid,uuid[])
to authenticated;

create or replace function public.community_quote_post(
  p_actor_type text,
  p_actor_id uuid,
  p_quoted_post_id uuid,
  p_body text,
  p_image_url text default null,
  p_link_url text default null,
  p_link_label text default null
)
returns jsonb
language plpgsql
security definer
set search_path=pg_catalog,public,editorial,private
as $$
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
  if v_user is null then
    raise exception 'authentication_required';
  end if;

  if p_quoted_post_id is null then
    raise exception 'quoted_post_required';
  end if;

  if char_length(v_body) not between 1 and 2000 then
    raise exception 'invalid_post_body';
  end if;

  if v_image is not null
     and (
       char_length(v_image)>2048
       or v_image !~* '^https?://'
     ) then
    raise exception 'invalid_post_image_url';
  end if;

  if v_link is not null
     and (
       char_length(v_link)>2048
       or v_link !~* '^https?://'
     ) then
    raise exception 'invalid_post_link_url';
  end if;

  if v_label is not null
     and (
       char_length(v_label)>120
       or v_link is null
     ) then
    raise exception 'invalid_post_link_label';
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
    raise exception
      'blocked_post_target'
      using errcode='42501';
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
        'canonical_path',
          public.community_get_post(v_post.id)->>'canonical_path'
      )
    );
  end if;

  return public.community_get_post(v_post.id);
end;
$$;

revoke all on function public.community_quote_post(text,uuid,uuid,text,text,text,text)
from public,anon;
grant execute on function public.community_quote_post(text,uuid,uuid,text,text,text,text)
to authenticated;

create or replace function public.community_report_post(
  p_post_id uuid,
  p_reason text,
  p_details text default ''
)
returns jsonb
language plpgsql
security definer
set search_path=pg_catalog,public
as $$
declare
  v_user uuid:=auth.uid();
  v_reason text:=nullif(trim(coalesce(p_reason,'')),'');
  v_details text:=trim(coalesce(p_details,''));
  v_report jsonb;
  v_report_count integer;
begin
  if v_user is null then
    raise exception
      'Not authenticated'
      using errcode='42501';
  end if;

  if p_post_id is null then
    raise exception
      'Post is required'
      using errcode='22023';
  end if;

  if v_reason not in (
    'spam',
    'harassment',
    'hate_or_abuse',
    'misinformation',
    'privacy',
    'copyright',
    'off_topic',
    'other'
  ) then
    raise exception
      'Unsupported report reason'
      using errcode='22023';
  end if;

  perform 1
  from public.community_posts post
  where post.id=p_post_id
    and post.status='published'
  for share;

  if not found then
    raise exception
      'Post not found'
      using errcode='22023';
  end if;

  perform pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      v_user::text
      || '|report-post|'
      || p_post_id::text
      || '|'
      || v_reason
      || '|'
      || v_details,
      0
    )
  );

  select to_jsonb(report.*)
  into v_report
  from public.community_reports report
  where report.reporter_id=v_user
    and report.post_id=p_post_id
    and report.reason=v_reason
    and coalesce(report.details,'')=v_details
    and report.status='pending'
  order by report.created_at desc
  limit 1;

  if v_report is not null then
    select count(*)::integer
    into v_report_count
    from public.community_reports report
    where report.post_id=p_post_id;

    return jsonb_build_object(
      'report',v_report,
      'report_count',v_report_count,
      'created',false
    );
  end if;

  insert into public.community_reports (
    reporter_id,
    post_id,
    reason,
    details
  )
  values (
    v_user,
    p_post_id,
    v_reason,
    v_details
  )
  returning to_jsonb(community_reports.*)
  into v_report;

  select count(*)::integer
  into v_report_count
  from public.community_reports report
  where report.post_id=p_post_id;

  return jsonb_build_object(
    'report',v_report,
    'report_count',v_report_count,
    'created',true
  );
end;
$$;

revoke all on function public.community_report_post(uuid,text,text)
from public,anon;
grant execute on function public.community_report_post(uuid,text,text)
to authenticated;

insert into private.phase_0a_rpc_classification (
  function_signature,
  access_class,
  rationale
)
values
  (
    'community_set_block_state(text,text,text,boolean)',
    'authenticated_command',
    'Sets the signed-in user Block state for one canonical Person or Artist, immediately removing an existing Follow.'
  ),
  (
    'community_get_block_state(text,text,text)',
    'authenticated_read',
    'Reads only the signed-in user Block state for one canonical Person or Artist.'
  ),
  (
    'community_set_post_repost_state(text,uuid,uuid,boolean)',
    'authenticated_command',
    'Sets durable Repost state for a currently authorized Person or Artist Post actor without deleting historical Repost identity.'
  ),
  (
    'community_get_actor_repost_state(text,uuid,uuid[])',
    'authenticated_read',
    'Reads bounded Repost counts and the authorized actor viewer state for published Posts.'
  ),
  (
    'community_quote_post(text,uuid,uuid,text,text,text,text)',
    'authenticated_command',
    'Publishes a canonical Post with one immutable quoted Post reference under existing Person or Artist posting authority.'
  ),
  (
    'community_report_post(uuid,text,text)',
    'authenticated_command',
    'Creates or reuses a pending Post report in the existing Community moderation ledger.'
  )
on conflict (function_signature)
do update
set
  access_class=excluded.access_class,
  rationale=excluded.rationale,
  reviewed_at=now();

commit;
