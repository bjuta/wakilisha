-- WAKILISHA M4: Artist Updates -> Following.
--
-- Constitution:
-- - M2 representation permission can_post_updates is the only Artist Update write authority.
-- - Artist Updates are authored public output, not inferred Registry activity.
-- - Releases remain Registry-derived output and are never presented as Artist-authored posts.
-- - Artist Updates and Releases share the existing three-output-per-Artist Following limit.
-- - Follow identities stay self-only.
-- - Save and Reaction capability extends to currently published Artist Updates only.

begin;

do $m4_artist_updates_preflight$
begin
  if to_regclass('public.registry_artists') is null
     or to_regclass('public.artist_representations') is null
     or to_regclass('public.artist_representation_events') is null
     or to_regclass('public.community_follows') is null
     or to_regclass('public.community_saves') is null
     or to_regclass('public.community_reactions') is null
     or to_regclass('private.phase_0a_rpc_classification') is null
  then
    raise exception
      'STOP: Required Registry, representation, Following, Save, Reaction, or RPC classification authority is missing';
  end if;

  if to_regprocedure('editorial.current_artist_representation(uuid)') is null
     or to_regprocedure('editorial.record_artist_representation_event(uuid,text,uuid,uuid,uuid,jsonb)') is null
     or to_regprocedure('public.community_get_following_feed(integer,timestamp with time zone,text)') is null
     or to_regprocedure('public.community_set_saved_state(text,text,text,text,text,text,text,boolean)') is null
     or to_regprocedure('public.community_get_reaction_state_for_public_targets(jsonb)') is null
     or to_regprocedure('public.community_react_to_target(text,uuid,text)') is null
  then
    raise exception
      'STOP: Required M3 Artist or current Following/Save/Reaction command authority is incomplete';
  end if;

  if to_regclass('public.artist_updates') is not null
     or to_regprocedure('public.community_publish_artist_update(uuid,text,text,text,text)') is not null
     or to_regprocedure('public.community_edit_artist_update(uuid,text,text,text,text)') is not null
     or to_regprocedure('public.community_withdraw_artist_update(uuid,text)') is not null
     or to_regprocedure('public.community_get_artist_update(uuid)') is not null
     or to_regprocedure('public.community_get_artist_manage_updates(uuid,integer)') is not null
  then
    raise exception
      'STOP: M4 Artist Update authority already exists';
  end if;
end;
$m4_artist_updates_preflight$;

create table public.artist_updates (
  id uuid primary key default gen_random_uuid(),
  artist_id uuid not null
    references public.registry_artists(id)
    on delete cascade,
  representation_id uuid
    references public.artist_representations(id)
    on delete set null,
  author_user_id uuid
    references auth.users(id)
    on delete set null,
  body text not null,
  image_url text,
  link_url text,
  link_label text,
  status text not null default 'published',
  published_at timestamptz not null default now(),
  withdrawn_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint artist_updates_body_length
    check (
      char_length(btrim(body)) between 1 and 2000
    ),
  constraint artist_updates_image_url_length
    check (
      image_url is null
      or char_length(image_url) <= 2048
    ),
  constraint artist_updates_link_url_length
    check (
      link_url is null
      or char_length(link_url) <= 2048
    ),
  constraint artist_updates_link_label_length
    check (
      link_label is null
      or char_length(link_label) <= 120
    ),
  constraint artist_updates_status_check
    check (
      status in (
        'published',
        'withdrawn'
      )
    )
);

create index artist_updates_artist_publication_idx
on public.artist_updates (
  artist_id,
  status,
  published_at desc,
  id desc
);

alter table public.artist_updates
  enable row level security;

revoke all
on table public.artist_updates
from anon, authenticated;

alter table public.artist_representation_events
  drop constraint artist_representation_events_event_type_check;

alter table public.artist_representation_events
  add constraint artist_representation_events_event_type_check
  check (
    event_type in (
      'claim_submitted',
      'claim_withdrawn',
      'claim_verified',
      'claim_rejected',
      'representation_invited',
      'representation_accepted',
      'representation_updated',
      'representation_revoked',
      'profile_presentation_updated',
      'artist_update_published',
      'artist_update_edited',
      'artist_update_withdrawn'
    )
  );

create or replace function public.community_publish_artist_update(
  p_artist_id uuid,
  p_body text,
  p_image_url text default null,
  p_link_url text default null,
  p_link_label text default null
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, editorial
as $$
declare
  v_actor uuid := auth.uid();
  v_rep public.artist_representations%rowtype;
  v_artist_slug text;
  v_body text := btrim(coalesce(p_body, ''));
  v_image_url text := nullif(btrim(coalesce(p_image_url, '')), '');
  v_link_url text := nullif(btrim(coalesce(p_link_url, '')), '');
  v_link_label text := nullif(btrim(coalesce(p_link_label, '')), '');
  v_update public.artist_updates%rowtype;
begin
  if v_actor is null then
    raise exception 'authentication_required';
  end if;

  select *
  into v_rep
  from editorial.current_artist_representation(p_artist_id);

  if v_rep.id is null
     or not v_rep.can_post_updates
  then
    raise exception 'insufficient_artist_update_privilege';
  end if;

  select artist.slug
  into v_artist_slug
  from public.registry_artists artist
  where artist.id = p_artist_id
    and artist.status = 'active';

  if v_artist_slug is null then
    raise exception 'artist_not_found';
  end if;

  if char_length(v_body) < 1
     or char_length(v_body) > 2000
  then
    raise exception 'invalid_artist_update_body';
  end if;

  if v_image_url is not null
     and (
       char_length(v_image_url) > 2048
       or v_image_url !~* '^https?://'
     )
  then
    raise exception 'invalid_artist_update_image_url';
  end if;

  if v_link_url is not null
     and (
       char_length(v_link_url) > 2048
       or v_link_url !~* '^https?://'
     )
  then
    raise exception 'invalid_artist_update_link_url';
  end if;

  if v_link_label is not null
     and (
       char_length(v_link_label) > 120
       or v_link_url is null
     )
  then
    raise exception 'invalid_artist_update_link_label';
  end if;

  insert into public.artist_updates (
    artist_id,
    representation_id,
    author_user_id,
    body,
    image_url,
    link_url,
    link_label,
    status
  )
  values (
    p_artist_id,
    v_rep.id,
    v_actor,
    v_body,
    v_image_url,
    v_link_url,
    v_link_label,
    'published'
  )
  returning *
  into v_update;

  perform editorial.record_artist_representation_event(
    p_artist_id,
    'artist_update_published',
    null,
    v_rep.id,
    v_actor,
    jsonb_build_object(
      'artist_update_id', v_update.id,
      'published_at', v_update.published_at
    )
  );

  return jsonb_build_object(
    'id', v_update.id,
    'artist_id', v_update.artist_id,
    'body', v_update.body,
    'image_url', v_update.image_url,
    'link_url', v_update.link_url,
    'link_label', v_update.link_label,
    'status', v_update.status,
    'published_at', v_update.published_at,
    'updated_at', v_update.updated_at,
    'canonical_path',
      '/artists/' || v_artist_slug || '/updates/' || v_update.id::text
  );
end;
$$;

revoke all
on function public.community_publish_artist_update(uuid,text,text,text,text)
from public, anon;

grant execute
on function public.community_publish_artist_update(uuid,text,text,text,text)
to authenticated;

create or replace function public.community_edit_artist_update(
  p_update_id uuid,
  p_body text,
  p_image_url text default null,
  p_link_url text default null,
  p_link_label text default null
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, editorial
as $$
declare
  v_actor uuid := auth.uid();
  v_rep public.artist_representations%rowtype;
  v_artist_slug text;
  v_body text := btrim(coalesce(p_body, ''));
  v_image_url text := nullif(btrim(coalesce(p_image_url, '')), '');
  v_link_url text := nullif(btrim(coalesce(p_link_url, '')), '');
  v_link_label text := nullif(btrim(coalesce(p_link_label, '')), '');
  v_update public.artist_updates%rowtype;
begin
  if v_actor is null then
    raise exception 'authentication_required';
  end if;

  select *
  into v_update
  from public.artist_updates
  where id = p_update_id
  for update;

  if not found then
    raise exception 'artist_update_not_found';
  end if;

  if v_update.status <> 'published' then
    raise exception 'artist_update_not_editable';
  end if;

  select *
  into v_rep
  from editorial.current_artist_representation(v_update.artist_id);

  if v_rep.id is null
     or not v_rep.can_post_updates
  then
    raise exception 'insufficient_artist_update_privilege';
  end if;

  if char_length(v_body) < 1
     or char_length(v_body) > 2000
  then
    raise exception 'invalid_artist_update_body';
  end if;

  if v_image_url is not null
     and (
       char_length(v_image_url) > 2048
       or v_image_url !~* '^https?://'
     )
  then
    raise exception 'invalid_artist_update_image_url';
  end if;

  if v_link_url is not null
     and (
       char_length(v_link_url) > 2048
       or v_link_url !~* '^https?://'
     )
  then
    raise exception 'invalid_artist_update_link_url';
  end if;

  if v_link_label is not null
     and (
       char_length(v_link_label) > 120
       or v_link_url is null
     )
  then
    raise exception 'invalid_artist_update_link_label';
  end if;

  update public.artist_updates
  set
    body = v_body,
    image_url = v_image_url,
    link_url = v_link_url,
    link_label = v_link_label,
    updated_at = now()
  where id = p_update_id
  returning *
  into v_update;

  select artist.slug
  into v_artist_slug
  from public.registry_artists artist
  where artist.id = v_update.artist_id;

  perform editorial.record_artist_representation_event(
    v_update.artist_id,
    'artist_update_edited',
    null,
    v_rep.id,
    v_actor,
    jsonb_build_object(
      'artist_update_id', v_update.id,
      'updated_at', v_update.updated_at
    )
  );

  return jsonb_build_object(
    'id', v_update.id,
    'artist_id', v_update.artist_id,
    'body', v_update.body,
    'image_url', v_update.image_url,
    'link_url', v_update.link_url,
    'link_label', v_update.link_label,
    'status', v_update.status,
    'published_at', v_update.published_at,
    'updated_at', v_update.updated_at,
    'canonical_path',
      '/artists/' || v_artist_slug || '/updates/' || v_update.id::text
  );
end;
$$;

revoke all
on function public.community_edit_artist_update(uuid,text,text,text,text)
from public, anon;

grant execute
on function public.community_edit_artist_update(uuid,text,text,text,text)
to authenticated;

create or replace function public.community_withdraw_artist_update(
  p_update_id uuid,
  p_reason text
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, editorial
as $$
declare
  v_actor uuid := auth.uid();
  v_rep public.artist_representations%rowtype;
  v_reason text := btrim(coalesce(p_reason, ''));
  v_update public.artist_updates%rowtype;
begin
  if v_actor is null then
    raise exception 'authentication_required';
  end if;

  select *
  into v_update
  from public.artist_updates
  where id = p_update_id
  for update;

  if not found then
    raise exception 'artist_update_not_found';
  end if;

  if v_update.status <> 'published' then
    raise exception 'artist_update_not_withdrawable';
  end if;

  select *
  into v_rep
  from editorial.current_artist_representation(v_update.artist_id);

  if v_rep.id is null
     or not v_rep.can_post_updates
  then
    raise exception 'insufficient_artist_update_privilege';
  end if;

  if char_length(v_reason) < 3
     or char_length(v_reason) > 1000
  then
    raise exception 'invalid_artist_update_withdrawal_reason';
  end if;

  update public.artist_updates
  set
    status = 'withdrawn',
    withdrawn_at = now(),
    updated_at = now()
  where id = p_update_id
  returning *
  into v_update;

  perform editorial.record_artist_representation_event(
    v_update.artist_id,
    'artist_update_withdrawn',
    null,
    v_rep.id,
    v_actor,
    jsonb_build_object(
      'artist_update_id', v_update.id,
      'reason', v_reason,
      'withdrawn_at', v_update.withdrawn_at
    )
  );

  return jsonb_build_object(
    'id', v_update.id,
    'status', v_update.status,
    'withdrawn_at', v_update.withdrawn_at
  );
end;
$$;

revoke all
on function public.community_withdraw_artist_update(uuid,text)
from public, anon;

grant execute
on function public.community_withdraw_artist_update(uuid,text)
to authenticated;

create or replace function public.community_get_artist_update(
  p_update_id uuid
)
returns jsonb
language plpgsql
stable
security definer
set search_path = pg_catalog, public
as $$
declare
  v_result jsonb;
begin
  select jsonb_build_object(
    'id', artist_update.id,
    'artist_id', artist_update.artist_id,
    'body', artist_update.body,
    'image_url', artist_update.image_url,
    'link_url', artist_update.link_url,
    'link_label', artist_update.link_label,
    'status', artist_update.status,
    'published_at', artist_update.published_at,
    'updated_at', artist_update.updated_at,
    'canonical_path',
      '/artists/' || artist.slug || '/updates/' || artist_update.id::text,
    'artist', jsonb_build_object(
      'id', artist.id,
      'slug', artist.slug,
      'display_name', artist.display_name,
      'image_url', coalesce(
        presentation.profile_image_url,
        artist.public_image_url
      )
    )
  )
  into v_result
  from public.artist_updates artist_update
  join public.registry_artists artist
    on artist.id = artist_update.artist_id
  left join public.artist_profile_presentations presentation
    on presentation.artist_id = artist.id
  where artist_update.id = p_update_id
    and artist_update.status = 'published'
    and artist.status = 'active';

  if v_result is null then
    raise exception 'artist_update_not_found';
  end if;

  return v_result;
end;
$$;

revoke all
on function public.community_get_artist_update(uuid)
from public;

grant execute
on function public.community_get_artist_update(uuid)
to anon, authenticated;

create or replace function public.community_get_artist_manage_updates(
  p_artist_id uuid,
  p_limit integer default 30
)
returns jsonb
language plpgsql
stable
security definer
set search_path = pg_catalog, public, editorial
as $$
declare
  v_actor uuid := auth.uid();
  v_rep public.artist_representations%rowtype;
  v_limit integer :=
    least(
      greatest(
        coalesce(p_limit, 30),
        1
      ),
      100
    );
  v_artist_slug text;
  v_result jsonb;
begin
  if v_actor is null then
    raise exception 'authentication_required';
  end if;

  select *
  into v_rep
  from editorial.current_artist_representation(p_artist_id);

  if v_rep.id is null
     or not v_rep.can_post_updates
  then
    raise exception 'insufficient_artist_update_privilege';
  end if;

  select slug
  into v_artist_slug
  from public.registry_artists
  where id = p_artist_id;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', managed.id,
        'artist_id', managed.artist_id,
        'body', managed.body,
        'image_url', managed.image_url,
        'link_url', managed.link_url,
        'link_label', managed.link_label,
        'status', managed.status,
        'published_at', managed.published_at,
        'withdrawn_at', managed.withdrawn_at,
        'updated_at', managed.updated_at,
        'canonical_path',
          '/artists/' || v_artist_slug || '/updates/' || managed.id::text
      )
      order by managed.published_at desc, managed.id desc
    ),
    '[]'::jsonb
  )
  into v_result
  from (
    select artist_update.*
    from public.artist_updates artist_update
    where artist_update.artist_id = p_artist_id
    order by artist_update.published_at desc, artist_update.id desc
    limit v_limit
  ) managed;

  return v_result;
end;
$$;

revoke all
on function public.community_get_artist_manage_updates(uuid,integer)
from public, anon;

grant execute
on function public.community_get_artist_manage_updates(uuid,integer)
to authenticated;

insert into private.phase_0a_rpc_classification (
  function_signature,
  access_class,
  rationale
)
values
  (
    'community_publish_artist_update(uuid,text,text,text,text)',
    'authenticated_command',
    'Publishes an Artist-authored Update only for an active Artist representation with can_post_updates.'
  ),
  (
    'community_edit_artist_update(uuid,text,text,text,text)',
    'authenticated_command',
    'Edits a currently published Artist Update only through active can_post_updates representation authority.'
  ),
  (
    'community_withdraw_artist_update(uuid,text)',
    'authenticated_command',
    'Withdraws a published Artist Update from public reads and Following through active can_post_updates authority.'
  ),
  (
    'community_get_artist_update(uuid)',
    'public_read',
    'Returns one currently published Artist Update and its active Registry Artist identity without exposing representative account identity.'
  ),
  (
    'community_get_artist_manage_updates(uuid,integer)',
    'authenticated_read',
    'Returns the bounded management history for an Artist only to an active representative with can_post_updates.'
  )
on conflict (function_signature)
do update
set
  access_class = excluded.access_class,
  rationale = excluded.rationale,
  reviewed_at = now();

alter table public.community_saves
  drop constraint community_saves_entity_type_capability_check;

alter table public.community_saves
  add constraint community_saves_entity_type_capability_check
  check (
    entity_type = any (
      array[
        'article'::text,
        'playlist'::text,
        'track'::text,
        'release'::text,
        'chart_edition'::text,
        'artist_update'::text
      ]
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
set search_path = pg_catalog, public, private
as $$
declare
  v_user_id uuid := auth.uid();
  v_saved boolean := coalesce(p_saved, false);
  v_type text := lower(btrim(coalesce(p_entity_type, '')));
  v_title text := nullif(btrim(coalesce(p_title, '')), '');
  v_subtitle text := nullif(btrim(coalesce(p_subtitle, '')), '');
  v_image_url text := nullif(btrim(coalesce(p_image_url, '')), '');
  v_target record;
begin
  if v_user_id is null then
    raise exception
      'Not authenticated'
      using errcode = '42501';
  end if;

  if v_type = 'artist_update' then
    select
      'artist_update'::text as canonical_type,
      artist_update.id::text as canonical_id,
      artist_update.id::text as canonical_slug,
      '/artists/' || artist.slug || '/updates/' || artist_update.id::text
        as canonical_url,
      (
        artist_update.status = 'published'
        and artist.status = 'active'
      ) as saveable
    into v_target
    from public.artist_updates artist_update
    join public.registry_artists artist
      on artist.id = artist_update.artist_id
    where artist_update.id::text =
          btrim(coalesce(p_entity_id, ''))
       or artist_update.id::text =
          btrim(coalesce(p_entity_slug, ''))
    limit 1;

    if v_target.canonical_id is null then
      raise exception
        'Artist Update Save target does not exist'
        using errcode = 'P0002';
    end if;
  else
    select *
    into v_target
    from private.community_resolve_save_target(
      p_entity_type,
      p_entity_id,
      p_entity_slug,
      p_entity_url
    );
  end if;

  if v_saved
     and not v_target.saveable
  then
    raise exception
      'Target is not publicly saveable'
      using errcode = '22023';
  end if;

  if v_saved
     and v_title is null
  then
    raise exception
      'Title is required when saving'
      using errcode = '22023';
  end if;

  perform pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      v_user_id::text
      || '|save|'
      || v_target.canonical_type
      || '|'
      || v_target.canonical_id,
      0
    )
  );

  if v_saved then
    insert into public.community_saves (
      user_id,
      entity_type,
      entity_id,
      entity_slug,
      entity_url,
      title,
      subtitle,
      image_url
    )
    values (
      v_user_id,
      v_target.canonical_type,
      v_target.canonical_id,
      v_target.canonical_slug,
      coalesce(
        v_target.canonical_url,
        nullif(
          btrim(
            coalesce(
              p_entity_url,
              ''
            )
          ),
          ''
        )
      ),
      v_title,
      v_subtitle,
      v_image_url
    )
    on conflict (
      user_id,
      entity_type,
      entity_id
    )
    do update
    set
      entity_slug = excluded.entity_slug,
      entity_url = excluded.entity_url,
      title = excluded.title,
      subtitle = excluded.subtitle,
      image_url = excluded.image_url;
  else
    delete from public.community_saves
    where user_id = v_user_id
      and entity_type = v_target.canonical_type
      and entity_id = v_target.canonical_id;
  end if;

  return jsonb_build_object(
    'saved', v_saved,
    'entity_type', v_target.canonical_type,
    'entity_id', v_target.canonical_id,
    'entity_slug', v_target.canonical_slug,
    'entity_url', v_target.canonical_url
  );
end;
$$;

create or replace function public.community_react_to_target(
  p_target_type text,
  p_target_id uuid,
  p_reaction_type text
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_user_id uuid := auth.uid();
  v_target_type text :=
    nullif(
      trim(
        coalesce(
          p_target_type,
          ''
        )
      ),
      ''
    );
  v_reaction_type text :=
    nullif(
      trim(
        coalesce(
          p_reaction_type,
          ''
        )
      ),
      ''
    );
  v_existing uuid;
  v_created boolean;
  v_reaction_count integer;
begin
  if v_user_id is null then
    raise exception
      'Not authenticated'
      using errcode = '42501';
  end if;

  if v_target_type is null
     or p_target_id is null
  then
    raise exception
      'Reaction target is required'
      using errcode = '22023';
  end if;

  if v_reaction_type is null
     or char_length(v_reaction_type) > 32
     or v_reaction_type ~ '[[:cntrl:]]'
     or v_reaction_type ~ '[[:space:]]'
     or (
       octet_length(v_reaction_type) =
       char_length(v_reaction_type)
       and v_reaction_type not in (
         'signal',
         'memory',
         'context',
         'fire',
         'agree'
       )
     )
  then
    raise exception
      'Unsupported reaction type'
      using errcode = '22023';
  end if;

  if v_target_type = 'artist_update' then
    perform 1
    from public.artist_updates artist_update
    join public.registry_artists artist
      on artist.id = artist_update.artist_id
    where artist_update.id = p_target_id
      and artist_update.status = 'published'
      and artist.status = 'active';

    if not found then
      raise exception
        'Reaction target is not currently public'
        using errcode = '22023';
    end if;
  end if;

  perform pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      v_user_id::text
      || '|'
      || v_target_type
      || '|'
      || p_target_id::text
      || '|'
      || v_reaction_type,
      0
    )
  );

  if v_target_type = 'comment' then
    perform 1
    from public.community_comments comment
    where comment.id = p_target_id
    for update;

    if not found then
      raise exception
        'Comment not found'
        using errcode = '22023';
    end if;
  end if;

  delete from public.community_reactions
  where user_id = v_user_id
    and target_type = v_target_type
    and target_id = p_target_id
    and reaction_type = v_reaction_type
  returning id
  into v_existing;

  if found then
    v_created := false;
  else
    insert into public.community_reactions (
      user_id,
      target_type,
      target_id,
      reaction_type
    )
    values (
      v_user_id,
      v_target_type,
      p_target_id,
      v_reaction_type
    );

    v_created := true;
  end if;

  if v_target_type = 'comment' then
    select count(*)::integer
    into v_reaction_count
    from public.community_reactions reaction
    where reaction.target_type = 'comment'
      and reaction.target_id = p_target_id;

    update public.community_comments
    set reaction_count = v_reaction_count
    where id = p_target_id;
  else
    v_reaction_count := null;
  end if;

  return jsonb_build_object(
    'created', v_created,
    'reaction_type', v_reaction_type,
    'reaction_count', v_reaction_count
  );
end;
$$;

create or replace function public.community_get_reaction_state_for_public_targets(
  p_targets jsonb
)
returns jsonb
language plpgsql
stable
security definer
set search_path = pg_catalog, public, editorial
as $$
declare
  v_user_id uuid := auth.uid();
  v_targets jsonb := coalesce(p_targets, '[]'::jsonb);
  v_target_count integer;
  v_target jsonb;
  v_target_type text;
  v_target_id_text text;
  v_target_id uuid;
begin
  if v_user_id is null then
    raise exception
      'Not authenticated'
      using errcode = '42501';
  end if;

  if jsonb_typeof(v_targets) <> 'array' then
    raise exception
      'Reaction targets must be a JSON array'
      using errcode = '22023';
  end if;

  v_target_count := jsonb_array_length(v_targets);

  if v_target_count > 100 then
    raise exception
      'Too many reaction targets'
      using errcode = '22023';
  end if;

  for v_target in
    select value
    from jsonb_array_elements(v_targets)
  loop
    if jsonb_typeof(v_target) <> 'object' then
      raise exception
        'Each reaction target must be an object'
        using errcode = '22023';
    end if;

    v_target_type :=
      lower(
        btrim(
          coalesce(
            v_target ->> 'target_type',
            ''
          )
        )
      );

    v_target_id_text :=
      btrim(
        coalesce(
          v_target ->> 'target_id',
          ''
        )
      );

    if v_target_type not in (
      'article',
      'playlist',
      'release',
      'artist_update'
    ) then
      raise exception
        'Unsupported public reaction target type'
        using errcode = '22023';
    end if;

    if v_target_id_text = '' then
      raise exception
        'Reaction target id is required'
        using errcode = '22023';
    end if;

    begin
      v_target_id := v_target_id_text::uuid;
    exception
      when invalid_text_representation then
        raise exception
          'Reaction target id must be a UUID'
          using errcode = '22023';
    end;

    if v_target_type = 'article' then
      perform 1
      from editorial.resources resource
      where resource.id = v_target_id
        and resource.resource_kind = 'article'
        and resource.visibility = 'public'
        and resource.lifecycle_state = 'published'
        and resource.current_published_version_id is not null;

    elsif v_target_type = 'playlist' then
      perform 1
      from editorial.resources resource
      join editorial.playlist_resources playlist_resource
        on playlist_resource.resource_id = resource.id
      where resource.id = v_target_id
        and resource.resource_kind = 'playlist'
        and resource.visibility = 'public'
        and resource.lifecycle_state = 'published'
        and playlist_resource.current_published_version_id is not null;

    elsif v_target_type = 'release' then
      perform 1
      from public.registry_releases release
      where release.id = v_target_id
        and release.status = 'active'
        and release.release_date is not null
        and release.release_date <= current_date
        and nullif(
          btrim(
            coalesce(
              release.slug,
              ''
            )
          ),
          ''
        ) is not null;

    elsif v_target_type = 'artist_update' then
      perform 1
      from public.artist_updates artist_update
      join public.registry_artists artist
        on artist.id = artist_update.artist_id
      where artist_update.id = v_target_id
        and artist_update.status = 'published'
        and artist.status = 'active';
    end if;

    if not found then
      raise exception
        'Reaction target is not currently public'
        using errcode = '22023';
    end if;
  end loop;

  return (
    with requested_raw as (
      select
        lower(
          btrim(
            target.value ->> 'target_type'
          )
        ) as target_type,
        (
          btrim(
            target.value ->> 'target_id'
          )
        )::uuid as target_id,
        target.ordinality
      from jsonb_array_elements(v_targets)
      with ordinality
        as target(
          value,
          ordinality
        )
    ),
    requested as (
      select
        requested_raw.target_type,
        requested_raw.target_id,
        min(requested_raw.ordinality) as ordinality
      from requested_raw
      group by
        requested_raw.target_type,
        requested_raw.target_id
    ),
    reaction_rows as (
      select
        requested.target_type,
        requested.target_id,
        reaction.reaction_type,
        count(reaction.id)::integer as reaction_count,
        bool_or(
          reaction.user_id = v_user_id
        ) as viewer_reacted
      from requested
      join public.community_reactions reaction
        on reaction.target_type = requested.target_type
       and reaction.target_id = requested.target_id
      group by
        requested.target_type,
        requested.target_id,
        reaction.reaction_type
    ),
    target_state as (
      select
        requested.target_type,
        requested.target_id,
        requested.ordinality,
        coalesce(
          sum(reaction_rows.reaction_count),
          0
        )::integer as reaction_count,
        coalesce(
          jsonb_agg(
            jsonb_build_object(
              'reaction_type', reaction_rows.reaction_type,
              'count', reaction_rows.reaction_count,
              'viewer_reacted', reaction_rows.viewer_reacted
            )
            order by
              reaction_rows.reaction_count desc,
              reaction_rows.reaction_type
          ) filter (
            where reaction_rows.reaction_type is not null
          ),
          '[]'::jsonb
        ) as reactions
      from requested
      left join reaction_rows
        on reaction_rows.target_type = requested.target_type
       and reaction_rows.target_id = requested.target_id
      group by
        requested.target_type,
        requested.target_id,
        requested.ordinality
    )
    select jsonb_build_object(
      'targets',
      coalesce(
        jsonb_agg(
          jsonb_build_object(
            'target_type', target_state.target_type,
            'target_id', target_state.target_id,
            'reaction_count', target_state.reaction_count,
            'reactions', target_state.reactions
          )
          order by target_state.ordinality
        ),
        '[]'::jsonb
      )
    )
    from target_state
  );
end;
$$;

create or replace function public.community_get_following_feed(
  p_limit integer default 30,
  p_before_published_at timestamp with time zone default null,
  p_before_item_key text default null
)
returns jsonb
language plpgsql
stable
security definer
set search_path = pg_catalog, public, editorial
as $$
declare
  v_user_id uuid := auth.uid();
  v_limit integer :=
    least(
      greatest(
        coalesce(p_limit, 30),
        1
      ),
      50
    );
  v_recent_cutoff timestamptz :=
    now() - interval '180 days';
  v_items jsonb;
begin
  if v_user_id is null then
    raise exception 'authentication required';
  end if;

  with self_follows as (
    select
      follow.target_type,
      follow.target_id,
      follow.target_slug,
      follow.created_at as followed_at
    from public.community_follows follow
    where follow.user_id = v_user_id
      and follow.target_type in (
        'person',
        'artist'
      )
  ),
  person_candidates as (
    select
      work.resource_kind as item_type,
      work.resource_id::text as item_id,
      work.resource_kind || ':' || work.resource_id::text as item_key,
      work.canonical_path,
      work.title,
      work.summary,
      work.image_url,
      work.published_at,
      follow.target_type as reason_target_type,
      follow.target_id as reason_target_id,
      follow.target_slug as reason_target_slug,
      follow.followed_at
    from (
      select *
      from self_follows
      where target_type = 'person'
    ) follow
    cross join lateral (
      with work as (
        select current_work.*
        from editorial.list_current_public_person_work(
          follow.target_id::uuid
        ) current_work
      ),
      ranked as (
        select
          work.*,
          row_number() over (
            order by
              work.published_at desc,
              work.resource_id desc
          ) as output_rank,
          count(*) filter (
            where work.published_at >= v_recent_cutoff
          ) over () as recent_count
        from work
      )
      select ranked.*
      from ranked
      where (
        ranked.published_at >= v_recent_cutoff
        and ranked.output_rank <= 3
      )
      or (
        ranked.recent_count = 0
        and ranked.output_rank = 1
      )
    ) work
  ),
  artist_raw_outputs as (
    select
      'release'::text as item_type,
      release.id::text as item_id,
      'release:' || release.id::text as item_key,
      '/releases/' || artist.slug || '/' || release.slug
        as canonical_path,
      release.title,
      release.description as summary,
      release.artwork_url as image_url,
      (
        release.release_date::timestamp
        at time zone 'UTC'
      ) as published_at,
      follow.target_type as reason_target_type,
      follow.target_id as reason_target_id,
      artist.slug as reason_target_slug,
      follow.followed_at
    from (
      select *
      from self_follows
      where target_type = 'artist'
    ) follow
    join public.registry_artists artist
      on artist.id::text = follow.target_id
     and artist.status = 'active'
    join public.registry_releases release
      on release.status = 'active'
     and release.release_date is not null
     and release.release_date <= current_date
     and nullif(
           btrim(
             coalesce(
               release.slug,
               ''
             )
           ),
           ''
         ) is not null
     and exists (
       select 1
       from public.registry_release_artists release_artist
       where release_artist.release_id = release.id
         and release_artist.artist_id = artist.id
         and release_artist.status = 'active'
         and release_artist.is_primary
     )

    union all

    select
      'artist_update'::text as item_type,
      artist_update.id::text as item_id,
      'artist_update:' || artist_update.id::text as item_key,
      '/artists/' || artist.slug || '/updates/' || artist_update.id::text
        as canonical_path,
      'Update from ' || artist.display_name as title,
      artist_update.body as summary,
      artist_update.image_url,
      artist_update.published_at,
      follow.target_type as reason_target_type,
      follow.target_id as reason_target_id,
      artist.slug as reason_target_slug,
      follow.followed_at
    from (
      select *
      from self_follows
      where target_type = 'artist'
    ) follow
    join public.registry_artists artist
      on artist.id::text = follow.target_id
     and artist.status = 'active'
    join public.artist_updates artist_update
      on artist_update.artist_id = artist.id
     and artist_update.status = 'published'
  ),
  artist_ranked as (
    select
      candidate.*,
      row_number() over (
        partition by candidate.reason_target_id
        order by
          candidate.published_at desc,
          candidate.item_key desc
      ) as output_rank,
      count(*) filter (
        where candidate.published_at >= v_recent_cutoff
      ) over (
        partition by candidate.reason_target_id
      ) as recent_count
    from artist_raw_outputs candidate
  ),
  artist_candidates as (
    select ranked.*
    from artist_ranked ranked
    where (
      ranked.published_at >= v_recent_cutoff
      and ranked.output_rank <= 3
    )
    or (
      ranked.recent_count = 0
      and ranked.output_rank = 1
    )
  ),
  candidate_rows as (
    select
      item_type,
      item_id,
      item_key,
      canonical_path,
      title,
      summary,
      image_url,
      published_at,
      reason_target_type,
      reason_target_id,
      reason_target_slug,
      followed_at
    from person_candidates

    union all

    select
      item_type,
      item_id,
      item_key,
      canonical_path,
      title,
      summary,
      image_url,
      published_at,
      reason_target_type,
      reason_target_id,
      reason_target_slug,
      followed_at
    from artist_candidates
  ),
  distinct_reason_rows as (
    select distinct
      candidate.item_type,
      candidate.item_id,
      candidate.item_key,
      candidate.canonical_path,
      candidate.title,
      candidate.summary,
      candidate.image_url,
      candidate.published_at,
      candidate.reason_target_type,
      candidate.reason_target_id,
      candidate.reason_target_slug,
      candidate.followed_at
    from candidate_rows candidate
    where candidate.published_at is not null
      and nullif(
            btrim(
              coalesce(
                candidate.canonical_path,
                ''
              )
            ),
            ''
          ) is not null
      and nullif(
            btrim(
              coalesce(
                candidate.title,
                ''
              )
            ),
            ''
          ) is not null
  ),
  grouped_items as (
    select
      candidate.item_type,
      candidate.item_id,
      candidate.item_key,
      min(candidate.canonical_path) as canonical_path,
      candidate.title,
      candidate.summary,
      candidate.image_url,
      candidate.published_at,
      jsonb_agg(
        jsonb_build_object(
          'target_type', candidate.reason_target_type,
          'target_id', candidate.reason_target_id,
          'target_slug', candidate.reason_target_slug,
          'followed_at', candidate.followed_at
        )
        order by
          candidate.reason_target_type,
          candidate.reason_target_slug,
          candidate.reason_target_id
      ) as matched_follows
    from distinct_reason_rows candidate
    group by
      candidate.item_type,
      candidate.item_id,
      candidate.item_key,
      candidate.title,
      candidate.summary,
      candidate.image_url,
      candidate.published_at
  ),
  page as (
    select item.*
    from grouped_items item
    where p_before_published_at is null
       or item.published_at < p_before_published_at
       or (
         p_before_item_key is not null
         and item.published_at = p_before_published_at
         and item.item_key < p_before_item_key
       )
    order by
      item.published_at desc,
      item.item_key desc
    limit v_limit
  )
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'item_type', page.item_type,
        'item_id', page.item_id,
        'item_key', page.item_key,
        'canonical_path', page.canonical_path,
        'title', page.title,
        'summary', page.summary,
        'image_url', page.image_url,
        'published_at', page.published_at,
        'matched_follows', page.matched_follows
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
    'mode', 'current_interest',
    'subject_types', jsonb_build_array(
      'person',
      'artist'
    ),
    'recent_window_days', 180,
    'per_subject_recent_limit', 3,
    'items', v_items
  );
end;
$$;

do $m4_artist_updates_postflight$
declare
  v_event_constraint text;
  v_save_constraint text;
  v_publish_definition text;
  v_edit_definition text;
  v_withdraw_definition text;
  v_public_reader_definition text;
  v_feed_definition text;
  v_save_definition text;
  v_reaction_reader_definition text;
  v_reaction_writer_definition text;
begin
  if to_regclass('public.artist_updates') is null then
    raise exception 'FAIL: Artist Update table was not created';
  end if;

  if not exists (
    select 1
    from pg_class c
    join pg_namespace n
      on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relname = 'artist_updates'
      and c.relrowsecurity
  ) then
    raise exception 'FAIL: Artist Update RLS is not enabled';
  end if;

  if has_table_privilege(
       'anon',
       'public.artist_updates',
       'SELECT'
     )
     or has_table_privilege(
       'authenticated',
       'public.artist_updates',
       'SELECT'
     )
     or has_table_privilege(
       'authenticated',
       'public.artist_updates',
       'INSERT'
     )
  then
    raise exception 'FAIL: Direct Artist Update table privilege leaked';
  end if;

  if to_regprocedure('public.community_publish_artist_update(uuid,text,text,text,text)') is null
     or to_regprocedure('public.community_edit_artist_update(uuid,text,text,text,text)') is null
     or to_regprocedure('public.community_withdraw_artist_update(uuid,text)') is null
     or to_regprocedure('public.community_get_artist_update(uuid)') is null
     or to_regprocedure('public.community_get_artist_manage_updates(uuid,integer)') is null
  then
    raise exception 'FAIL: One or more M4 Artist Update functions are missing';
  end if;

  select pg_get_constraintdef(oid)
  into v_event_constraint
  from pg_constraint
  where conrelid = 'public.artist_representation_events'::regclass
    and conname = 'artist_representation_events_event_type_check';

  if v_event_constraint is null
     or position('artist_update_published' in v_event_constraint) = 0
     or position('artist_update_edited' in v_event_constraint) = 0
     or position('artist_update_withdrawn' in v_event_constraint) = 0
  then
    raise exception 'FAIL: Artist representation event ledger was not extended for M4';
  end if;

  select pg_get_constraintdef(oid)
  into v_save_constraint
  from pg_constraint
  where conrelid = 'public.community_saves'::regclass
    and conname = 'community_saves_entity_type_capability_check';

  if v_save_constraint is null
     or position('artist_update' in v_save_constraint) = 0
  then
    raise exception 'FAIL: Save capability does not include Artist Updates';
  end if;

  select pg_get_functiondef(
    'public.community_publish_artist_update(uuid,text,text,text,text)'::regprocedure
  ) into v_publish_definition;

  select pg_get_functiondef(
    'public.community_edit_artist_update(uuid,text,text,text,text)'::regprocedure
  ) into v_edit_definition;

  select pg_get_functiondef(
    'public.community_withdraw_artist_update(uuid,text)'::regprocedure
  ) into v_withdraw_definition;

  select pg_get_functiondef(
    'public.community_get_artist_update(uuid)'::regprocedure
  ) into v_public_reader_definition;

  select pg_get_functiondef(
    'public.community_get_following_feed(integer,timestamp with time zone,text)'::regprocedure
  ) into v_feed_definition;

  select pg_get_functiondef(
    'public.community_set_saved_state(text,text,text,text,text,text,text,boolean)'::regprocedure
  ) into v_save_definition;

  select pg_get_functiondef(
    'public.community_get_reaction_state_for_public_targets(jsonb)'::regprocedure
  ) into v_reaction_reader_definition;

  select pg_get_functiondef(
    'public.community_react_to_target(text,uuid,text)'::regprocedure
  ) into v_reaction_writer_definition;

  if position('can_post_updates' in v_publish_definition) = 0
     or position('can_post_updates' in v_edit_definition) = 0
     or position('can_post_updates' in v_withdraw_definition) = 0
  then
    raise exception 'FAIL: Artist Update writes are not bound to can_post_updates';
  end if;

  if position('status = ''published''' in v_public_reader_definition) = 0 then
    raise exception 'FAIL: Public Artist Update reader is not publication-bound';
  end if;

  if position('artist_updates' in v_feed_definition) = 0
     or position('registry_release_artists' in v_feed_definition) = 0
     or position('artist_raw_outputs' in v_feed_definition) = 0
  then
    raise exception 'FAIL: Following does not merge Artist Updates with Registry Releases';
  end if;

  if position('artist_update' in v_save_definition) = 0
     or position('artist_update' in v_reaction_reader_definition) = 0
     or position('artist_update' in v_reaction_writer_definition) = 0
  then
    raise exception 'FAIL: Artist Update Save or Reaction capability is incomplete';
  end if;

  if v_publish_definition ~* '(insert|update|delete)[[:space:]]+(into[[:space:]]+)?public[.]registry_artists'
     or v_edit_definition ~* '(insert|update|delete)[[:space:]]+(into[[:space:]]+)?public[.]registry_artists'
     or v_withdraw_definition ~* '(insert|update|delete)[[:space:]]+(into[[:space:]]+)?public[.]registry_artists'
  then
    raise exception 'FAIL: Artist Update command can write canonical Registry Artist rows';
  end if;
end;
$m4_artist_updates_postflight$;

commit;
