-- Phase 7A K5C: Video Version Trust Convergence
-- Extends the existing shared Credits/Citations authority to exact Video
-- Resource Versions. No Video-owned Trust identity or alternate ledger is created.

do $preflight$
declare
  v_constraint text;
begin
  if to_regclass('editorial.resource_credits') is null
     or to_regclass('editorial.resource_citations') is null
     or to_regclass('editorial.credits') is null
     or to_regclass('editorial.citations') is null
     or to_regclass('video.publication_versions') is null
     or to_regclass('editorial.video_publication_resources') is null
     or to_regclass('editorial.resources') is null
     or to_regclass('platform_private.command_types') is null
  then
    raise exception 'STOP: K5C requires accepted shared Trust, Video Version, Resource, and command authority.';
  end if;

  if to_regprocedure('editorial.assert_resource_version_trust_attachment()') is null
     or to_regprocedure('video.insert_current_publication_snapshot(uuid,bigint,text,uuid)') is null
     or to_regprocedure('video.copy_publication_version_snapshot(uuid,text,uuid)') is null
     or to_regprocedure('public.get_admin_video_publication_workspace(uuid)') is null
     or to_regprocedure('editorial.current_user_can_edit_video(uuid)') is null
  then
    raise exception 'STOP: K5C prerequisite authority helpers are incomplete.';
  end if;

  if to_regclass('editorial.video_publication_version_trust_revisions') is not null
     or to_regclass('platform_private.video_trust_copy_authorizations') is not null
     or to_regprocedure('public.replace_video_publication_version_credits(uuid,jsonb,bigint,text,uuid)') is not null
     or to_regprocedure('public.replace_video_publication_version_citations(uuid,jsonb,bigint,text,uuid)') is not null
     or to_regprocedure('public.list_video_trust_attachment_candidates()') is not null
  then
    raise exception 'STOP: K5C Video Trust convergence surface already exists.';
  end if;

  if exists (
    select 1
    from platform_private.command_types
    where command_type in (
      'video.publication.trust.credits.replace',
      'video.publication.trust.citations.replace'
    )
  ) then
    raise exception 'STOP: K5C Video Trust command vocabulary already exists.';
  end if;

  select pg_get_constraintdef(oid)
  into v_constraint
  from pg_constraint
  where conrelid='editorial.resource_credits'::regclass
    and conname='resource_credits_resource_kind_check';

  if position('standalone_video' in coalesce(v_constraint,'')) > 0
     or position('video_episode' in coalesce(v_constraint,'')) > 0
  then
    raise exception 'STOP: shared Credit attachment authority already includes Video unexpectedly.';
  end if;
end;
$preflight$;

create table editorial.video_publication_version_trust_revisions (
  publication_version_id uuid primary key
    references video.publication_versions(id) on delete cascade,
  citation_revision bigint not null default 1 check (citation_revision >= 1),
  credit_revision bigint not null default 1 check (credit_revision >= 1),
  updated_by uuid references auth.users(id),
  updated_at timestamptz not null default now()
);

alter table editorial.video_publication_version_trust_revisions
  enable row level security;

revoke all
  on editorial.video_publication_version_trust_revisions
  from public, anon, authenticated, service_role;

alter table editorial.resource_citations
  drop constraint resource_citations_resource_kind_check,
  drop constraint resource_citations_target_type_check;

alter table editorial.resource_citations
  add constraint resource_citations_resource_kind_check
  check (
    resource_kind in (
      'article',
      'playlist',
      'playlist_item',
      'audio_episode',
      'standalone_audio',
      'video_episode',
      'standalone_video'
    )
  ),
  add constraint resource_citations_target_type_check
  check (
    (resource_kind='article' and target_version_type='article_version')
    or (
      resource_kind in ('playlist','playlist_item')
      and target_version_type='playlist_version'
    )
    or (
      resource_kind in ('audio_episode','standalone_audio')
      and target_version_type='audio_publication_version'
    )
    or (
      resource_kind in ('video_episode','standalone_video')
      and target_version_type='video_publication_version'
    )
  );

alter table editorial.resource_credits
  drop constraint resource_credits_resource_kind_check,
  drop constraint resource_credits_target_type_check;

alter table editorial.resource_credits
  add constraint resource_credits_resource_kind_check
  check (
    resource_kind in (
      'article',
      'playlist',
      'playlist_item',
      'audio_episode',
      'standalone_audio',
      'video_episode',
      'standalone_video'
    )
  ),
  add constraint resource_credits_target_type_check
  check (
    (resource_kind='article' and target_version_type='article_version')
    or (
      resource_kind in ('playlist','playlist_item')
      and target_version_type='playlist_version'
    )
    or (
      resource_kind in ('audio_episode','standalone_audio')
      and target_version_type='audio_publication_version'
    )
    or (
      resource_kind in ('video_episode','standalone_video')
      and target_version_type='video_publication_version'
    )
  );

insert into platform_private.command_types (
  command_type,
  job_type,
  accepted_event_type,
  success_event_type,
  failure_event_type,
  retry_event_type,
  enabled
)
values
  (
    'video.publication.trust.credits.replace',
    'video.publication.trust.credits.replace.sync',
    'video.publication.trust.credits.replace.accepted',
    'video.publication.trust.credits.replace.succeeded',
    'video.publication.trust.credits.replace.failed',
    'video.publication.trust.credits.replace.retry_scheduled',
    true
  ),
  (
    'video.publication.trust.citations.replace',
    'video.publication.trust.citations.replace.sync',
    'video.publication.trust.citations.replace.accepted',
    'video.publication.trust.citations.replace.succeeded',
    'video.publication.trust.citations.replace.failed',
    'video.publication.trust.citations.replace.retry_scheduled',
    true
  );

create table platform_private.video_trust_copy_authorizations (
  authorization_token uuid primary key,
  source_version_id uuid not null
    references video.publication_versions(id) on delete cascade,
  target_version_id uuid not null
    references video.publication_versions(id) on delete cascade,
  backend_pid integer not null,
  transaction_id bigint not null,
  created_at timestamptz not null default now()
);

revoke all
  on platform_private.video_trust_copy_authorizations
  from public, anon, authenticated, service_role;

create function platform_private.begin_video_trust_copy_authorization(
  p_source_version_id uuid,
  p_target_version_id uuid
)
returns uuid
language plpgsql
security definer
set search_path to 'pg_catalog','platform_private','video','extensions'
as $f$
declare
  v_token uuid := extensions.gen_random_uuid();
  v_source video.publication_versions%rowtype;
  v_target video.publication_versions%rowtype;
begin
  select * into v_source
  from video.publication_versions
  where id=p_source_version_id;

  select * into v_target
  from video.publication_versions
  where id=p_target_version_id;

  if v_source.id is null
     or v_target.id is null
     or v_source.resource_id<>v_target.resource_id
     or v_source.publication_id<>v_target.publication_id
  then
    raise exception 'Video Trust copy requires versions of the same publication Resource.';
  end if;

  insert into platform_private.video_trust_copy_authorizations(
    authorization_token,source_version_id,target_version_id,
    backend_pid,transaction_id
  )
  values(
    v_token,p_source_version_id,p_target_version_id,
    pg_backend_pid(),txid_current()
  );

  perform set_config('wakilisha.video_trust_copy_token',v_token::text,true);
  return v_token;
end;
$f$;

create function platform_private.end_video_trust_copy_authorization(
  p_authorization_token uuid
)
returns void
language plpgsql
security definer
set search_path to 'pg_catalog','platform_private'
as $f$
begin
  delete from platform_private.video_trust_copy_authorizations
  where authorization_token=p_authorization_token
    and backend_pid=pg_backend_pid()
    and transaction_id=txid_current();

  perform set_config('wakilisha.video_trust_copy_token','',true);
end;
$f$;

revoke all
  on function platform_private.begin_video_trust_copy_authorization(uuid,uuid)
  from public, anon, authenticated, service_role;
revoke all
  on function platform_private.end_video_trust_copy_authorization(uuid)
  from public, anon, authenticated, service_role;

create function editorial.prevent_immutable_video_trust_mutation()
returns trigger
language plpgsql
set search_path to 'pg_catalog','editorial','video','platform_private'
as $f$
declare
  v_kind text;
  v_token_text text;
  v_token uuid;
  v_authorization platform_private.video_trust_copy_authorizations%rowtype;
begin
  if tg_op in ('UPDATE','DELETE')
     and old.target_version_type='video_publication_version'
  then
    select version_kind
    into v_kind
    from video.publication_versions
    where id=old.target_version_id;

    if v_kind in ('submitted','approved','published') then
      raise exception
        'Trust attached to immutable Video version % cannot be changed.',
        old.target_version_id;
    end if;
  end if;

  if tg_op not in ('INSERT','UPDATE')
     or new.target_version_type<>'video_publication_version'
  then
    if tg_op='DELETE' then return old; end if;
    return new;
  end if;

  select version_kind
  into v_kind
  from video.publication_versions
  where id=new.target_version_id;

  if v_kind not in ('submitted','approved','published') then
    return new;
  end if;

  if tg_op='UPDATE' then
    raise exception
      'Trust cannot be moved into immutable Video version %.',
      new.target_version_id;
  end if;

  v_token_text := nullif(
    current_setting('wakilisha.video_trust_copy_token',true),
    ''
  );

  if v_token_text is null then
    raise exception
      'Trust cannot be attached directly to immutable Video version %.',
      new.target_version_id;
  end if;

  begin
    v_token := v_token_text::uuid;
  exception when invalid_text_representation then
    raise exception 'Immutable Video Trust copy authorization is invalid.';
  end;

  select copy_auth.*
  into v_authorization
  from platform_private.video_trust_copy_authorizations copy_auth
  where copy_auth.authorization_token=v_token
    and copy_auth.backend_pid=pg_backend_pid()
    and copy_auth.transaction_id=txid_current()
    and copy_auth.target_version_id=new.target_version_id;

  if not found then
    raise exception 'Immutable Video Trust copy authorization is invalid.';
  end if;

  if tg_table_name='resource_citations' then
    if not exists (
      select 1
      from editorial.resource_citations source
      where source.target_version_type='video_publication_version'
        and source.target_version_id=v_authorization.source_version_id
        and source.resource_id=new.resource_id
        and source.resource_kind=new.resource_kind
        and source.citation_id=new.citation_id
        and source.citation_purpose=new.citation_purpose
        and source.target_anchor_type=new.target_anchor_type
        and source.target_anchor_data=new.target_anchor_data
        and source.display_order=new.display_order
        and source.public_safe=new.public_safe
        and source.created_by is not distinct from new.created_by
    ) then
      raise exception
        'Immutable Video Citation copy does not match its authorized source snapshot.';
    end if;
  elsif tg_table_name='resource_credits' then
    if not exists (
      select 1
      from editorial.resource_credits source
      where source.target_version_type='video_publication_version'
        and source.target_version_id=v_authorization.source_version_id
        and source.resource_id=new.resource_id
        and source.resource_kind=new.resource_kind
        and source.credit_id=new.credit_id
        and source.display_order=new.display_order
        and source.is_primary=new.is_primary
        and source.public_safe=new.public_safe
        and source.created_by is not distinct from new.created_by
    ) then
      raise exception
        'Immutable Video Credit copy does not match its authorized source snapshot.';
    end if;
  else
    raise exception 'Unsupported Video Trust attachment table: %',tg_table_name;
  end if;

  return new;
end;
$f$;

revoke all
  on function editorial.prevent_immutable_video_trust_mutation()
  from public, anon, authenticated, service_role;

create trigger resource_citations_video_immutable_guard
before insert or update or delete
on editorial.resource_citations
for each row
execute function editorial.prevent_immutable_video_trust_mutation();

create trigger resource_credits_video_immutable_guard
before insert or update or delete
on editorial.resource_credits
for each row
execute function editorial.prevent_immutable_video_trust_mutation();

create function editorial.copy_video_version_trust_to_version(
  p_source_version_id uuid,
  p_target_version_id uuid
)
returns void
language plpgsql
security definer
set search_path to 'pg_catalog','editorial','video','platform_private'
as $f$
declare
  v_token uuid;
  v_source video.publication_versions%rowtype;
  v_target video.publication_versions%rowtype;
begin
  select * into v_source
  from video.publication_versions
  where id=p_source_version_id;

  select * into v_target
  from video.publication_versions
  where id=p_target_version_id;

  if v_source.id is null
     or v_target.id is null
     or v_source.resource_id<>v_target.resource_id
     or v_source.publication_id<>v_target.publication_id
  then
    raise exception 'Video Trust copy requires versions of the same publication.';
  end if;

  v_token := platform_private.begin_video_trust_copy_authorization(
    p_source_version_id,
    p_target_version_id
  );

  insert into editorial.resource_citations(
    resource_id,resource_kind,target_version_type,target_version_id,
    citation_id,citation_purpose,target_anchor_type,target_anchor_data,
    display_order,public_safe,created_by
  )
  select
    source.resource_id,source.resource_kind,'video_publication_version',
    p_target_version_id,source.citation_id,source.citation_purpose,
    source.target_anchor_type,source.target_anchor_data,
    source.display_order,source.public_safe,source.created_by
  from editorial.resource_citations source
  where source.target_version_type='video_publication_version'
    and source.target_version_id=p_source_version_id
    and source.resource_id=v_source.resource_id;

  insert into editorial.resource_credits(
    resource_id,resource_kind,target_version_type,target_version_id,
    credit_id,display_order,is_primary,public_safe,created_by
  )
  select
    source.resource_id,source.resource_kind,'video_publication_version',
    p_target_version_id,source.credit_id,source.display_order,
    source.is_primary,source.public_safe,source.created_by
  from editorial.resource_credits source
  where source.target_version_type='video_publication_version'
    and source.target_version_id=p_source_version_id
    and source.resource_id=v_source.resource_id;

  insert into editorial.video_publication_version_trust_revisions(
    publication_version_id,citation_revision,credit_revision,updated_by,updated_at
  )
  select
    p_target_version_id,
    coalesce(revision.citation_revision,1),
    coalesce(revision.credit_revision,1),
    revision.updated_by,
    now()
  from (select 1) seed
  left join editorial.video_publication_version_trust_revisions revision
    on revision.publication_version_id=p_source_version_id
  on conflict(publication_version_id) do update
  set citation_revision=excluded.citation_revision,
      credit_revision=excluded.credit_revision,
      updated_by=excluded.updated_by,
      updated_at=excluded.updated_at;

  perform platform_private.end_video_trust_copy_authorization(v_token);
exception when others then
  if v_token is not null then
    perform platform_private.end_video_trust_copy_authorization(v_token);
  end if;
  raise;
end;
$f$;

revoke all
  on function editorial.copy_video_version_trust_to_version(uuid,uuid)
  from public, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION editorial.assert_resource_version_trust_attachment()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'pg_catalog', 'editorial', 'audio', 'video'
AS $function$
declare
  v_playlist_version editorial.playlist_versions%rowtype;
  v_audio_version audio.publication_versions%rowtype;
  v_video_version video.publication_versions%rowtype;
begin
  if new.resource_kind = 'article' then
    if new.target_version_type <> 'article_version' then
      raise exception 'Article Trust attachments require article_version targets';
    end if;

    if not exists (
      select 1 from editorial.article_versions version
      where version.id = new.target_version_id
        and version.resource_id = new.resource_id
    ) then
      raise exception 'Trust attachment Article version must belong to the supplied resource';
    end if;

    if not exists (
      select 1
      from editorial.article_resources binding
      where binding.resource_id = new.resource_id
        and binding.resource_kind = 'article'
        and exists (
          select 1 from editorial.article_versions version
          where version.id = new.target_version_id
            and version.article_id = binding.article_id
        )
    ) then
      raise exception 'Trust attachment requires a valid Article resource binding';
    end if;

    insert into editorial.article_version_trust_revisions(article_version_id)
    values (new.target_version_id)
    on conflict (article_version_id) do nothing;

    perform 1
    from editorial.article_version_trust_revisions revision
    where revision.article_version_id = new.target_version_id
    for update;

  elsif new.resource_kind in ('playlist','playlist_item') then
    if new.target_version_type <> 'playlist_version' then
      raise exception 'Playlist Trust attachments require playlist_version targets';
    end if;

    select version.* into v_playlist_version
    from editorial.playlist_versions version
    where version.id = new.target_version_id;

    if not found then
      raise exception 'Playlist Trust attachment version was not found';
    end if;

    if new.resource_kind = 'playlist' then
      if v_playlist_version.resource_id <> new.resource_id then
        raise exception 'Playlist Trust attachment must target the Playlist Resource belonging to the version';
      end if;
    elsif not exists (
      select 1
      from editorial.playlist_version_items item
      where item.playlist_version_id = new.target_version_id
        and item.playlist_item_resource_id = new.resource_id
    ) then
      raise exception 'Playlist-item Trust attachment must target an item present in the Playlist version';
    end if;

    insert into editorial.playlist_version_trust_revisions(playlist_version_id)
    values (new.target_version_id)
    on conflict (playlist_version_id) do nothing;

    perform 1
    from editorial.playlist_version_trust_revisions revision
    where revision.playlist_version_id = new.target_version_id
    for update;

  elsif new.resource_kind in ('audio_episode','standalone_audio') then
    if new.target_version_type <> 'audio_publication_version' then
      raise exception 'Audio Trust attachments require audio_publication_version targets';
    end if;

    select version.* into v_audio_version
    from audio.publication_versions version
    where version.id = new.target_version_id;

    if not found
       or v_audio_version.resource_id <> new.resource_id
    then
      raise exception 'Audio Trust attachment version must belong to the supplied Audio Resource';
    end if;

    if not exists (
      select 1
      from editorial.audio_publication_resources binding
      where binding.resource_id = new.resource_id
        and binding.publication_id = v_audio_version.publication_id
        and binding.resource_kind = new.resource_kind
    ) then
      raise exception 'Audio Trust attachment requires a valid typed Audio publication binding';
    end if;

    insert into editorial.audio_publication_version_trust_revisions(publication_version_id)
    values (new.target_version_id)
    on conflict (publication_version_id) do nothing;

    perform 1
    from editorial.audio_publication_version_trust_revisions revision
    where revision.publication_version_id = new.target_version_id
    for update;

  elsif new.resource_kind in ('standalone_video','video_episode') then
    if new.target_version_type <> 'video_publication_version' then
      raise exception 'Video Trust attachments require video_publication_version targets';
    end if;

    select version.* into v_video_version
    from video.publication_versions version
    where version.id = new.target_version_id;

    if not found
       or v_video_version.resource_id <> new.resource_id
    then
      raise exception 'Video Trust attachment version must belong to the supplied Video Resource';
    end if;

    if not exists (
      select 1
      from editorial.video_publication_resources binding
      where binding.resource_id = new.resource_id
        and binding.publication_id = v_video_version.publication_id
        and binding.resource_kind = new.resource_kind
    ) then
      raise exception 'Video Trust attachment requires a valid typed Video publication binding';
    end if;

    insert into editorial.video_publication_version_trust_revisions(publication_version_id)
    values (new.target_version_id)
    on conflict (publication_version_id) do nothing;

    perform 1
    from editorial.video_publication_version_trust_revisions revision
    where revision.publication_version_id = new.target_version_id
    for update;

  else
    raise exception 'Unsupported Trust attachment Resource kind: %', new.resource_kind;
  end if;

  if tg_table_name = 'resource_citations' then
    perform editorial.validate_citation_target_anchor(
      new.target_anchor_type,
      new.target_anchor_data
    );

    if new.public_safe
       and not exists (
         select 1 from editorial.citations citation
         where citation.id = new.citation_id
           and citation.public_safe
           and citation.citation_state = 'active'
       )
    then
      raise exception 'Public-safe Citation attachment requires an active public-safe Citation';
    end if;

  elsif tg_table_name = 'resource_credits' then
    if new.public_safe
       and not exists (
         select 1 from editorial.credit_governance governance
         where governance.credit_id = new.credit_id
           and governance.public_safe
           and governance.credit_state = 'active'
       )
    then
      raise exception 'Public-safe Credit attachment requires active public-safe governance';
    end if;
  else
    raise exception 'Unsupported Trust attachment table: %', tg_table_name;
  end if;

  return new;
end;
$function$;


CREATE OR REPLACE FUNCTION video.insert_current_publication_snapshot(p_publication_id uuid, p_expected_authority_revision bigint, p_version_kind text, p_actor_id uuid)
 RETURNS TABLE(version_id uuid, version_number bigint, content_fingerprint text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'video', 'editorial', 'media', 'extensions'
AS $function$
declare
  v_publication video.publications%rowtype;
  v_binding editorial.video_publication_resources%rowtype;
  v_resource editorial.resources%rowtype;
  v_source video.sources%rowtype;
  v_show_resource_id uuid;
  v_show_episode_resource_id uuid;
  v_slug text;
  v_title text;
  v_summary text;
  v_fingerprint text;
  v_version_number bigint;
  v_version_id uuid;
  v_source_working_version_id uuid;
begin
  if p_version_kind not in (
    'working',
    'submitted',
    'approved',
    'published'
  ) then
    raise exception 'Unsupported Video version kind.';
  end if;

  select publication.*
  into v_publication
  from video.publications publication
  where publication.id = p_publication_id;

  if not found then
    raise exception 'Video publication does not exist.';
  end if;

  if v_publication.authority_revision
       <> p_expected_authority_revision
  then
    raise exception 'Video publication revision changed.';
  end if;

  select binding.*
  into v_binding
  from editorial.video_publication_resources binding
  where binding.publication_id = p_publication_id;

  if not found then
    raise exception 'Video publication Resource binding does not exist.';
  end if;

  select resource_row.*
  into v_resource
  from editorial.resources resource_row
  where resource_row.id = v_binding.resource_id;

  if not found then
    raise exception 'Video publication Resource does not exist.';
  end if;

  v_source_working_version_id := v_resource.current_working_version_id;

  if v_publication.selected_source_id is null then
    raise exception
      'Video publication requires one selected source before snapshot.';
  end if;

  select source.*
  into v_source
  from video.sources source
  where source.id = v_publication.selected_source_id;

  if not found then
    raise exception 'Selected Video source does not exist.';
  end if;

  perform video.assert_current_publication_snapshot_integrity(
    p_publication_id
  );

  if v_publication.publication_kind = 'standalone' then
    v_show_resource_id := null;
    v_show_episode_resource_id := null;
    v_slug := v_publication.standalone_slug;
    v_title := v_publication.standalone_title;
    v_summary := v_publication.standalone_summary;
  else
    select
      episode.show_resource_id,
      episode.resource_id,
      episode.slug,
      episode.title,
      episode.summary
    into
      v_show_resource_id,
      v_show_episode_resource_id,
      v_slug,
      v_title,
      v_summary
    from editorial.video_episode_shared_links link
    join editorial.show_episodes episode
      on episode.resource_id = link.show_episode_resource_id
    where link.video_publication_id = p_publication_id;

    if not found then
      raise exception
        'Video Episode requires its exact shared Show Episode binding.';
    end if;
  end if;

  v_fingerprint :=
    video.publication_content_fingerprint(p_publication_id);

  if v_fingerprint is null then
    raise exception 'Video publication fingerprint could not be created.';
  end if;

  select coalesce(max(version_row.version_number), 0) + 1
  into v_version_number
  from video.publication_versions version_row
  where version_row.publication_id = p_publication_id;

  v_version_id := extensions.gen_random_uuid();

  insert into video.publication_versions (
    id,
    resource_id,
    publication_id,
    version_number,
    version_kind,
    source_authority_revision,
    publication_kind,
    show_resource_id,
    show_episode_resource_id,
    slug_snapshot,
    title_snapshot,
    summary_snapshot,
    classification,
    source_id,
    metadata,
    content_fingerprint,
    created_by
  )
  values (
    v_version_id,
    v_binding.resource_id,
    v_publication.id,
    v_version_number,
    p_version_kind,
    v_publication.authority_revision,
    v_publication.publication_kind,
    v_show_resource_id,
    v_show_episode_resource_id,
    v_slug,
    v_title,
    v_summary,
    v_publication.classification,
    v_source.id,
    v_publication.metadata,
    v_fingerprint,
    p_actor_id
  );

  insert into video.publication_version_caption_tracks (
    publication_version_id,
    track_number,
    media_asset_id,
    media_asset_revision_id,
    language_tag,
    track_kind,
    label,
    is_default
  )
  select
    v_version_id,
    row_number() over (
      order by track.display_order, track.id
    )::integer,
    track.media_asset_id,
    track.media_asset_revision_id,
    track.language_tag,
    track.track_kind,
    track.label,
    track.is_default
  from video.caption_tracks track
  where track.publication_id = p_publication_id
  order by track.display_order, track.id;

  insert into video.publication_version_chapters (
    publication_version_id,
    chapter_number,
    start_seconds,
    title,
    description
  )
  select
    v_version_id,
    chapter.chapter_number,
    chapter.start_seconds,
    chapter.title,
    chapter.description
  from video.publication_chapters chapter
  where chapter.publication_id = p_publication_id
  order by chapter.chapter_number;

  perform video.copy_current_media_usage_to_version(
    p_publication_id,
    v_version_id,
    p_actor_id
  );

  if p_version_kind in ('working','submitted')
     and v_source_working_version_id is not null
     and v_source_working_version_id <> v_version_id
  then
    perform editorial.copy_video_version_trust_to_version(
      v_source_working_version_id,
      v_version_id
    );
  elsif p_version_kind = 'working' then
    insert into editorial.video_publication_version_trust_revisions(publication_version_id)
    values (v_version_id)
    on conflict (publication_version_id) do nothing;
  end if;

  version_id := v_version_id;
  version_number := v_version_number;
  content_fingerprint := v_fingerprint;
  return next;
end;
$function$;


CREATE OR REPLACE FUNCTION video.copy_publication_version_snapshot(p_source_version_id uuid, p_version_kind text, p_actor_id uuid)
 RETURNS TABLE(version_id uuid, version_number bigint, content_fingerprint text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'video', 'editorial', 'media', 'extensions'
AS $function$
declare
  v_source video.publication_versions%rowtype;
  v_version_id uuid;
  v_version_number bigint;
begin
  if p_version_kind not in (
    'submitted',
    'approved',
    'published'
  ) then
    raise exception 'Unsupported copied Video version kind.';
  end if;

  select version_row.*
  into v_source
  from video.publication_versions version_row
  where version_row.id = p_source_version_id;

  if not found then
    raise exception 'Source Video publication version does not exist.';
  end if;

  select coalesce(max(version_row.version_number), 0) + 1
  into v_version_number
  from video.publication_versions version_row
  where version_row.publication_id = v_source.publication_id;

  v_version_id := extensions.gen_random_uuid();

  insert into video.publication_versions (
    id,
    resource_id,
    publication_id,
    version_number,
    version_kind,
    source_authority_revision,
    publication_kind,
    show_resource_id,
    show_episode_resource_id,
    slug_snapshot,
    title_snapshot,
    summary_snapshot,
    classification,
    source_id,
    metadata,
    content_fingerprint,
    created_by
  )
  values (
    v_version_id,
    v_source.resource_id,
    v_source.publication_id,
    v_version_number,
    p_version_kind,
    v_source.source_authority_revision,
    v_source.publication_kind,
    v_source.show_resource_id,
    v_source.show_episode_resource_id,
    v_source.slug_snapshot,
    v_source.title_snapshot,
    v_source.summary_snapshot,
    v_source.classification,
    v_source.source_id,
    v_source.metadata,
    v_source.content_fingerprint,
    p_actor_id
  );

  insert into video.publication_version_caption_tracks (
    publication_version_id,
    track_number,
    media_asset_id,
    media_asset_revision_id,
    language_tag,
    track_kind,
    label,
    is_default
  )
  select
    v_version_id,
    track.track_number,
    track.media_asset_id,
    track.media_asset_revision_id,
    track.language_tag,
    track.track_kind,
    track.label,
    track.is_default
  from video.publication_version_caption_tracks track
  where track.publication_version_id = v_source.id
  order by track.track_number;

  insert into video.publication_version_chapters (
    publication_version_id,
    chapter_number,
    start_seconds,
    title,
    description
  )
  select
    v_version_id,
    chapter.chapter_number,
    chapter.start_seconds,
    chapter.title,
    chapter.description
  from video.publication_version_chapters chapter
  where chapter.publication_version_id = v_source.id
  order by chapter.chapter_number;

  perform video.copy_version_media_usage(
    v_source.id,
    v_version_id,
    p_actor_id
  );

  perform editorial.copy_video_version_trust_to_version(
    v_source.id,
    v_version_id
  );

  version_id := v_version_id;
  version_number := v_version_number;
  content_fingerprint := v_source.content_fingerprint;
  return next;
end;
$function$;


create function public.replace_video_publication_version_citations(
  p_publication_version_id uuid,
  p_attachments jsonb,
  p_expected_citation_revision bigint,
  p_idempotency_key text,
  p_correlation_id uuid default null
)
returns table(
  command_receipt_id uuid,
  receipt_status text,
  publication_version_id uuid,
  citation_revision bigint,
  attachment_count integer,
  result_payload jsonb,
  idempotent_replay boolean
)
language plpgsql
security definer
set search_path to 'pg_catalog','auth','public','editorial','video','platform_private','extensions'
as $f$
declare
  v_version video.publication_versions%rowtype;
  v_binding editorial.video_publication_resources%rowtype;
  v_resource editorial.resources%rowtype;
  v_revision editorial.video_publication_version_trust_revisions%rowtype;
  v_begin record;
  v_read record;
  v_actor record;
  v_result jsonb;
  v_count integer:=0;
  v_correlation uuid:=coalesce(p_correlation_id,extensions.gen_random_uuid());
begin
  if jsonb_typeof(coalesce(p_attachments,'[]'::jsonb))<>'array'
     or jsonb_array_length(coalesce(p_attachments,'[]'::jsonb))>500
  then
    raise exception using errcode='22023',
      message='Video Citation attachments must be a bounded JSON array.';
  end if;

  select * into v_version
  from video.publication_versions
  where id=p_publication_version_id
    and version_kind='working';

  if not found then
    raise exception 'Video Citation editing requires a working Video version.';
  end if;

  select * into v_binding
  from editorial.video_publication_resources
  where resource_id=v_version.resource_id
    and publication_id=v_version.publication_id;

  if not found then
    raise exception 'Video Citation editing requires a valid Video Resource binding.';
  end if;

  select * into v_resource
  from editorial.resources
  where id=v_binding.resource_id
  for update;

  if v_resource.current_working_version_id is distinct from p_publication_version_id then
    raise exception 'Video Citation editing requires the exact current working version.';
  end if;

  if v_resource.lifecycle_state='archived' then
    raise exception 'Archived Video Trust cannot be edited.';
  end if;

  if not editorial.current_user_can_edit_video(v_binding.resource_id) then
    raise exception using errcode='42501',
      message='Video edit permission is required.';
  end if;

  insert into editorial.video_publication_version_trust_revisions(publication_version_id)
  values(p_publication_version_id)
  on conflict do nothing;

  select revision_row.* into v_revision
  from editorial.video_publication_version_trust_revisions revision_row
  where revision_row.publication_version_id=p_publication_version_id
  for update;

  select * into v_begin
  from platform_private.begin_authenticated_resource_command(
    'video.publication.trust.citations.replace',
    v_binding.resource_id,
    p_idempotency_key,
    jsonb_build_object(
      'publication_version_id',p_publication_version_id,
      'expected_citation_revision',p_expected_citation_revision,
      'attachments',coalesce(p_attachments,'[]'::jsonb),
      'correlation_id',v_correlation
    )
  );

  if v_begin.idempotent_replay then
    select * into v_read
    from platform_private.read_authenticated_resource_command_result(
      v_begin.command_receipt_id,true
    );
    command_receipt_id:=v_read.command_receipt_id;
    receipt_status:=v_read.receipt_status;
    publication_version_id:=p_publication_version_id;
    citation_revision:=nullif(v_read.result_payload->>'citation_revision','')::bigint;
    attachment_count:=coalesce(nullif(v_read.result_payload->>'attachment_count','')::integer,0);
    result_payload:=v_read.result_payload;
    idempotent_replay:=true;
    return next;
    return;
  end if;

  if v_revision.citation_revision<>p_expected_citation_revision then
    perform platform_private.reject_resource_command(
      v_begin.command_receipt_id,
      'video_citation_revision_changed',
      'Video Citation attachments changed before they could be saved.',
      jsonb_build_object(
        'publication_version_id',p_publication_version_id,
        'citation_revision',v_revision.citation_revision
      )
    );
  else
    select * into v_actor
    from platform_private.command_actor_context();

    delete from editorial.resource_citations
    where resource_id=v_binding.resource_id
      and target_version_type='video_publication_version'
      and target_version_id=p_publication_version_id;

    insert into editorial.resource_citations(
      resource_id,resource_kind,target_version_type,target_version_id,
      citation_id,citation_purpose,target_anchor_type,target_anchor_data,
      display_order,public_safe,created_by
    )
    select
      v_binding.resource_id,
      v_binding.resource_kind,
      'video_publication_version',
      p_publication_version_id,
      (item.value->>'citation_id')::uuid,
      coalesce(nullif(btrim(item.value->>'citation_purpose'),''),'supports'),
      coalesce(nullif(btrim(item.value->>'target_anchor_type'),''),'whole_version'),
      coalesce(item.value->'target_anchor_data','{}'::jsonb),
      item.ordinality::integer-1,
      coalesce((item.value->>'public_safe')::boolean,false),
      v_actor.actor_user_id
    from jsonb_array_elements(coalesce(p_attachments,'[]'::jsonb))
      with ordinality item(value,ordinality);

    get diagnostics v_count=row_count;

    update editorial.video_publication_version_trust_revisions revision
    set citation_revision=revision.citation_revision+1,
        updated_by=v_actor.actor_user_id,
        updated_at=now()
    where revision.publication_version_id=p_publication_version_id
    returning * into v_revision;

    v_result:=jsonb_build_object(
      'publication_version_id',p_publication_version_id,
      'citation_revision',v_revision.citation_revision,
      'attachment_count',v_count,
      'correlation_id',v_correlation
    );

    perform platform_private.complete_resource_command(
      v_begin.command_receipt_id,v_result
    );
  end if;

  select * into v_read
  from platform_private.read_authenticated_resource_command_result(
    v_begin.command_receipt_id,false
  );

  command_receipt_id:=v_read.command_receipt_id;
  receipt_status:=v_read.receipt_status;
  publication_version_id:=p_publication_version_id;
  citation_revision:=coalesce(
    nullif(v_read.result_payload->>'citation_revision','')::bigint,
    v_revision.citation_revision
  );
  attachment_count:=coalesce(
    nullif(v_read.result_payload->>'attachment_count','')::integer,
    0
  );
  result_payload:=v_read.result_payload;
  idempotent_replay:=false;
  return next;
end;
$f$;

create function public.replace_video_publication_version_credits(
  p_publication_version_id uuid,
  p_attachments jsonb,
  p_expected_credit_revision bigint,
  p_idempotency_key text,
  p_correlation_id uuid default null
)
returns table(
  command_receipt_id uuid,
  receipt_status text,
  publication_version_id uuid,
  credit_revision bigint,
  attachment_count integer,
  result_payload jsonb,
  idempotent_replay boolean
)
language plpgsql
security definer
set search_path to 'pg_catalog','auth','public','editorial','video','platform_private','extensions'
as $f$
declare
  v_version video.publication_versions%rowtype;
  v_binding editorial.video_publication_resources%rowtype;
  v_resource editorial.resources%rowtype;
  v_revision editorial.video_publication_version_trust_revisions%rowtype;
  v_begin record;
  v_read record;
  v_actor record;
  v_result jsonb;
  v_count integer:=0;
  v_correlation uuid:=coalesce(p_correlation_id,extensions.gen_random_uuid());
begin
  if jsonb_typeof(coalesce(p_attachments,'[]'::jsonb))<>'array'
     or jsonb_array_length(coalesce(p_attachments,'[]'::jsonb))>500
  then
    raise exception using errcode='22023',
      message='Video Credit attachments must be a bounded JSON array.';
  end if;

  select * into v_version
  from video.publication_versions
  where id=p_publication_version_id
    and version_kind='working';

  if not found then
    raise exception 'Video Credit editing requires a working Video version.';
  end if;

  select * into v_binding
  from editorial.video_publication_resources
  where resource_id=v_version.resource_id
    and publication_id=v_version.publication_id;

  if not found then
    raise exception 'Video Credit editing requires a valid Video Resource binding.';
  end if;

  select * into v_resource
  from editorial.resources
  where id=v_binding.resource_id
  for update;

  if v_resource.current_working_version_id is distinct from p_publication_version_id then
    raise exception 'Video Credit editing requires the exact current working version.';
  end if;

  if v_resource.lifecycle_state='archived' then
    raise exception 'Archived Video Trust cannot be edited.';
  end if;

  if not editorial.current_user_can_edit_video(v_binding.resource_id) then
    raise exception using errcode='42501',
      message='Video edit permission is required.';
  end if;

  insert into editorial.video_publication_version_trust_revisions(publication_version_id)
  values(p_publication_version_id)
  on conflict do nothing;

  select revision_row.* into v_revision
  from editorial.video_publication_version_trust_revisions revision_row
  where revision_row.publication_version_id=p_publication_version_id
  for update;

  select * into v_begin
  from platform_private.begin_authenticated_resource_command(
    'video.publication.trust.credits.replace',
    v_binding.resource_id,
    p_idempotency_key,
    jsonb_build_object(
      'publication_version_id',p_publication_version_id,
      'expected_credit_revision',p_expected_credit_revision,
      'attachments',coalesce(p_attachments,'[]'::jsonb),
      'correlation_id',v_correlation
    )
  );

  if v_begin.idempotent_replay then
    select * into v_read
    from platform_private.read_authenticated_resource_command_result(
      v_begin.command_receipt_id,true
    );
    command_receipt_id:=v_read.command_receipt_id;
    receipt_status:=v_read.receipt_status;
    publication_version_id:=p_publication_version_id;
    credit_revision:=nullif(v_read.result_payload->>'credit_revision','')::bigint;
    attachment_count:=coalesce(nullif(v_read.result_payload->>'attachment_count','')::integer,0);
    result_payload:=v_read.result_payload;
    idempotent_replay:=true;
    return next;
    return;
  end if;

  if v_revision.credit_revision<>p_expected_credit_revision then
    perform platform_private.reject_resource_command(
      v_begin.command_receipt_id,
      'video_credit_revision_changed',
      'Video Credit attachments changed before they could be saved.',
      jsonb_build_object(
        'publication_version_id',p_publication_version_id,
        'credit_revision',v_revision.credit_revision
      )
    );
  else
    select * into v_actor
    from platform_private.command_actor_context();

    delete from editorial.resource_credits
    where resource_id=v_binding.resource_id
      and target_version_type='video_publication_version'
      and target_version_id=p_publication_version_id;

    insert into editorial.resource_credits(
      resource_id,resource_kind,target_version_type,target_version_id,
      credit_id,display_order,is_primary,public_safe,created_by
    )
    select
      v_binding.resource_id,
      v_binding.resource_kind,
      'video_publication_version',
      p_publication_version_id,
      (item.value->>'credit_id')::uuid,
      item.ordinality::integer-1,
      coalesce((item.value->>'is_primary')::boolean,false),
      coalesce((item.value->>'public_safe')::boolean,false),
      v_actor.actor_user_id
    from jsonb_array_elements(coalesce(p_attachments,'[]'::jsonb))
      with ordinality item(value,ordinality);

    get diagnostics v_count=row_count;

    update editorial.video_publication_version_trust_revisions revision
    set credit_revision=revision.credit_revision+1,
        updated_by=v_actor.actor_user_id,
        updated_at=now()
    where revision.publication_version_id=p_publication_version_id
    returning * into v_revision;

    v_result:=jsonb_build_object(
      'publication_version_id',p_publication_version_id,
      'credit_revision',v_revision.credit_revision,
      'attachment_count',v_count,
      'correlation_id',v_correlation
    );

    perform platform_private.complete_resource_command(
      v_begin.command_receipt_id,v_result
    );
  end if;

  select * into v_read
  from platform_private.read_authenticated_resource_command_result(
    v_begin.command_receipt_id,false
  );

  command_receipt_id:=v_read.command_receipt_id;
  receipt_status:=v_read.receipt_status;
  publication_version_id:=p_publication_version_id;
  credit_revision:=coalesce(
    nullif(v_read.result_payload->>'credit_revision','')::bigint,
    v_revision.credit_revision
  );
  attachment_count:=coalesce(
    nullif(v_read.result_payload->>'attachment_count','')::integer,
    0
  );
  result_payload:=v_read.result_payload;
  idempotent_replay:=false;
  return next;
end;
$f$;

create function public.list_video_trust_attachment_candidates()
returns jsonb
language plpgsql
stable
security definer
set search_path to 'pg_catalog','auth','public','editorial'
as $f$
declare
  v_credits jsonb;
  v_citations jsonb;
begin
  if auth.uid() is null then
    raise exception using errcode='42501',
      message='Video Trust access requires an authenticated editor.';
  end if;

  if not (
    public.current_user_is_administrator()
    or public.current_user_has_capability('edit_own_video')
    or public.current_user_has_capability('edit_others_video')
  ) then
    raise exception using errcode='42501',
      message='Video edit permission is required.';
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
    'id',candidate.id,
    'display_name',candidate.display_name,
    'credit_role',candidate.credit_role,
    'role_label',candidate.role_label
  ) order by candidate.display_name,candidate.id),'[]'::jsonb)
  into v_credits
  from (
    select
      credit.id,
      credit.display_name_snapshot as display_name,
      credit.credit_role,
      credit.role_label_snapshot as role_label
    from editorial.credits credit
    join editorial.credit_governance governance
      on governance.credit_id=credit.id
    where governance.credit_state='active'
      and governance.public_safe
      and nullif(btrim(credit.display_name_snapshot),'') is not null
  ) candidate;

  select coalesce(jsonb_agg(jsonb_build_object(
    'id',candidate.id,
    'label',candidate.label,
    'source_title',candidate.source_title,
    'locator_label',candidate.locator_label
  ) order by candidate.label,candidate.id),'[]'::jsonb)
  into v_citations
  from (
    select
      citation.id,
      coalesce(nullif(btrim(citation.public_label),''),source_version.title) as label,
      source_version.title as source_title,
      case citation.locator_type
        when 'whole_source' then 'Whole Source'
        when 'timestamp' then 'Timestamp'
        when 'timestamp_range' then 'Time Range'
        when 'transcript_range' then 'Transcript Range'
        when 'page' then 'Page'
        when 'page_range' then 'Page Range'
        when 'paragraph' then 'Paragraph'
        when 'chapter' then 'Chapter'
        else initcap(replace(citation.locator_type,'_',' '))
      end as locator_label
    from editorial.citations citation
    join editorial.sources source
      on source.id=citation.source_id
    join editorial.source_versions source_version
      on source_version.id=citation.source_version_id
     and source_version.source_id=source.id
    where citation.citation_state='active'
      and citation.public_safe
      and source.source_state='active'
      and source.withdrawn_at is null
      and source.current_approved_version_id=citation.source_version_id
      and nullif(btrim(source_version.title),'') is not null
  ) candidate;

  return jsonb_build_object(
    'credits',v_credits,
    'citations',v_citations
  );
end;
$f$;

CREATE OR REPLACE FUNCTION public.get_admin_video_publication_workspace(p_publication_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'auth', 'public', 'editorial', 'video', 'media'
AS $function$
declare
  v_p video.publications%rowtype;
  v_b editorial.video_publication_resources%rowtype;
  v_r editorial.resources%rowtype;
  v_e editorial.show_episodes%rowtype;
  v_s editorial.shows%rowtype;
begin
  if auth.uid() is null then
    raise exception using errcode='42501',message='Video access requires an authenticated editor.';
  end if;

  select * into v_p from video.publications p where p.id=p_publication_id;
  if not found then raise exception using errcode='P0002',message='Video publication does not exist.'; end if;
  select * into v_b from editorial.video_publication_resources b where b.publication_id=p_publication_id;
  select * into v_r from editorial.resources r where r.id=v_b.resource_id;

  if not editorial.current_user_can_view_video(v_r.id) then
    raise exception using errcode='42501',message='Video access is required.';
  end if;

  if v_p.publication_kind='episode' then
    select e.* into v_e
    from editorial.video_episode_shared_links l
    join editorial.show_episodes e on e.resource_id=l.show_episode_resource_id
    where l.video_publication_id=p_publication_id;
    if not found then raise exception 'Video Episode shared Show Episode binding is missing.'; end if;

    select * into v_s from editorial.shows s where s.resource_id=v_e.show_resource_id;
    if not found then raise exception 'Shared Show does not exist.'; end if;
  end if;

  return jsonb_build_object(
    'publication',jsonb_build_object(
      'id',v_p.id,'publication_kind',v_p.publication_kind,
      'slug',case when v_p.publication_kind='standalone' then v_p.standalone_slug else v_e.slug end,
      'title',case when v_p.publication_kind='standalone' then v_p.standalone_title else v_e.title end,
      'summary',case when v_p.publication_kind='standalone' then v_p.standalone_summary else v_e.summary end,
      'classification',v_p.classification,'authority_revision',v_p.authority_revision,
      'metadata',v_p.metadata,'created_at',v_p.created_at,'updated_at',v_p.updated_at
    ),
    'resource',jsonb_build_object(
      'id',v_r.id,'resource_kind',v_r.resource_kind,'owner_id',v_r.owner_id,
      'visibility',v_r.visibility,'lifecycle_state',v_r.lifecycle_state,
      'versions',jsonb_build_object(
        'working',v_r.current_working_version_id,'submitted',v_r.current_submitted_version_id,
        'approved',v_r.current_approved_version_id,'published',v_r.current_published_version_id
      )
    ),
    'show',case when v_s.resource_id is null then null else jsonb_build_object(
      'resource_id',v_s.resource_id,'slug',v_s.slug,'title',v_s.title,
      'description',v_s.description,'authority_revision',v_s.authority_revision
    ) end,
    'show_episode',case when v_e.resource_id is null then null else jsonb_build_object(
      'resource_id',v_e.resource_id,'show_resource_id',v_e.show_resource_id,
      'slug',v_e.slug,'title',v_e.title,'summary',v_e.summary,
      'episode_number',v_e.episode_number,'authority_revision',v_e.authority_revision
    ) end,
    'selected_source',(
      select case when s.id is null then null else jsonb_build_object(
        'id',s.id,'source_kind',s.source_kind,'provider_key',s.provider_key,
        'provider_object_id',s.provider_object_id,'canonical_url',s.canonical_url,
        'media_asset_id',s.media_asset_id,'media_asset_revision_id',s.media_asset_revision_id,
        'source_metadata',s.source_metadata,'capabilities',video.source_capabilities(s.id),
        'created_at',s.created_at
      ) end
      from (select v_p.selected_source_id id) x
      left join video.sources s on s.id=x.id
    ),
    'poster',(
      select jsonb_build_object(
        'usage_link_id',u.id,'usage_revision',u.usage_revision,
        'asset_id',u.asset_id,'asset_revision_id',u.asset_revision_id,
        'placement_data',u.placement_data
      )
      from media.usage_links u
      where u.target_authority='video' and u.target_kind='video_publication'
        and u.target_id=p_publication_id and u.target_version_id is null
        and u.usage_role='video_poster' and u.usage_state='active'
      order by u.created_at desc,u.id desc limit 1
    ),
    'transcript',(
      select jsonb_build_object(
        'usage_link_id',u.id,'usage_revision',u.usage_revision,
        'asset_id',u.asset_id,'asset_revision_id',u.asset_revision_id,
        'placement_data',u.placement_data
      )
      from media.usage_links u
      where u.target_authority='video' and u.target_kind='video_publication'
        and u.target_id=p_publication_id and u.target_version_id is null
        and u.usage_role='video_transcript' and u.usage_state='active'
      order by u.created_at desc,u.id desc limit 1
    ),
    'captions',coalesce((
      select jsonb_agg(jsonb_build_object(
        'id',t.id,'media_asset_id',t.media_asset_id,'media_asset_revision_id',t.media_asset_revision_id,
        'language_tag',t.language_tag,'track_kind',t.track_kind,'label',t.label,
        'is_default',t.is_default,'display_order',t.display_order,'authority_revision',t.authority_revision
      ) order by t.display_order,t.id)
      from video.caption_tracks t where t.publication_id=p_publication_id
    ),'[]'::jsonb),
    'chapters',coalesce((
      select jsonb_agg(jsonb_build_object(
        'id',c.id,'chapter_number',c.chapter_number,'start_seconds',c.start_seconds,
        'title',c.title,'description',c.description
      ) order by c.chapter_number)
      from video.publication_chapters c where c.publication_id=p_publication_id
    ),'[]'::jsonb),
    'version_history',coalesce((
      select jsonb_agg(jsonb_build_object(
        'id',v.id,'version_number',v.version_number,'version_kind',v.version_kind,
        'content_fingerprint',v.content_fingerprint,'source_id',v.source_id,
        'created_by',v.created_by,'created_at',v.created_at
      ) order by v.version_number,v.id)
      from video.publication_versions v where v.publication_id=p_publication_id
    ),'[]'::jsonb),
    'review_events',coalesce((
      select jsonb_agg(jsonb_build_object(
        'id',e.id,'event_number',e.event_number,'target_version_id',e.target_version_id,
        'result_version_id',e.result_version_id,'action',e.action,'prior_status',e.prior_status,
        'resulting_status',e.resulting_status,'reason',e.reason,'actor_id',e.actor_id,'created_at',e.created_at
      ) order by e.event_number,e.id)
      from editorial.resource_review_events e where e.resource_id=v_r.id
    ),'[]'::jsonb),
    'lifecycle_events',coalesce((
      select jsonb_agg(jsonb_build_object(
        'id',e.id,'event_number',e.event_number,'version_id',e.version_id,
        'action',e.action,'prior_status',e.prior_status,'resulting_status',e.resulting_status,
        'note',e.note,'actor_id',e.actor_id,'created_at',e.created_at
      ) order by e.event_number,e.id)
      from editorial.resource_lifecycle_events e where e.resource_id=v_r.id
    ),'[]'::jsonb),
    'trust', (
      select jsonb_build_object(
        'citation_revision', coalesce(r.citation_revision, 1),
        'credit_revision', coalesce(r.credit_revision, 1),
        'citations', coalesce((
          select jsonb_agg(jsonb_build_object(
            'attachment_id', a.id,
            'citation_id', a.citation_id,
            'citation_purpose', a.citation_purpose,
            'target_anchor_type', a.target_anchor_type,
            'target_anchor_data', a.target_anchor_data,
            'display_order', a.display_order,
            'public_safe', a.public_safe,
            'public_label', c.public_label,
            'quotation', c.quotation,
            'citation_state', c.citation_state
          ) order by a.display_order,a.id)
          from editorial.resource_citations a
          join editorial.citations c on c.id=a.citation_id
          where a.resource_id=v_r.id
            and a.target_version_type='video_publication_version'
            and a.target_version_id=v_r.current_working_version_id
        ),'[]'::jsonb),
        'credits', coalesce((
          select jsonb_agg(jsonb_build_object(
            'attachment_id', a.id,
            'credit_id', a.credit_id,
            'display_order', a.display_order,
            'is_primary', a.is_primary,
            'public_safe', a.public_safe,
            'credit_role', c.credit_role,
            'display_name', c.display_name_snapshot,
            'role_label', c.role_label_snapshot
          ) order by a.display_order,a.id)
          from editorial.resource_credits a
          join editorial.credits c on c.id=a.credit_id
          where a.resource_id=v_r.id
            and a.target_version_type='video_publication_version'
            and a.target_version_id=v_r.current_working_version_id
        ),'[]'::jsonb)
      )
      from (select 1) seed
      left join editorial.video_publication_version_trust_revisions r
        on r.publication_version_id=v_r.current_working_version_id
    ),
    'classifications',coalesce((
      select jsonb_agg(jsonb_build_object(
        'classification',c.classification,'label',c.label,'description',c.description
      ) order by c.sort_order,c.classification)
      from video.publication_classifications c where c.enabled
    ),'[]'::jsonb),
    'source_providers',coalesce((
      select jsonb_agg(jsonb_build_object(
        'provider_key',s.provider_key,'label',s.label,'description',s.description
      ) order by s.sort_order,s.provider_key)
      from video.source_providers s where s.enabled
    ),'[]'::jsonb),
    'caption_track_kinds',coalesce((
      select jsonb_agg(jsonb_build_object(
        'track_kind',k.track_kind,'label',k.label,'description',k.description
      ) order by k.sort_order,k.track_kind)
      from video.caption_track_kinds k where k.enabled
    ),'[]'::jsonb),
    'capabilities',jsonb_build_object(
      'can_view',editorial.current_user_can_view_video(v_r.id),
      'can_edit',editorial.current_user_can_edit_video(v_r.id),
      'can_manage_review',coalesce(public.current_user_has_capability('manage_review_queue'),false),
      'can_publish',editorial.current_user_can_publish_video(v_r.id)
    )
  );
end;
$function$;


revoke all
  on function public.replace_video_publication_version_citations(uuid,jsonb,bigint,text,uuid)
  from public, anon, authenticated, service_role;
revoke all
  on function public.replace_video_publication_version_credits(uuid,jsonb,bigint,text,uuid)
  from public, anon, authenticated, service_role;
revoke all
  on function public.list_video_trust_attachment_candidates()
  from public, anon, authenticated, service_role;

grant execute
  on function public.replace_video_publication_version_citations(uuid,jsonb,bigint,text,uuid)
  to authenticated;
grant execute
  on function public.replace_video_publication_version_credits(uuid,jsonb,bigint,text,uuid)
  to authenticated;
grant execute
  on function public.list_video_trust_attachment_candidates()
  to authenticated;

do $postflight$
declare
  v_def text;
  v_count bigint;
begin
  select count(*)
  into v_count
  from platform_private.command_types
  where command_type in (
    'video.publication.trust.credits.replace',
    'video.publication.trust.citations.replace'
  )
    and enabled;

  if v_count<>2 then
    raise exception 'STOP: K5C Video Trust command vocabulary is incomplete.';
  end if;

  if has_schema_privilege('authenticated','video','USAGE')
     or exists (
       select 1
       from information_schema.role_table_grants
       where table_schema='editorial'
         and table_name='video_publication_version_trust_revisions'
         and grantee in ('PUBLIC','anon','authenticated','service_role')
     )
  then
    raise exception 'STOP: K5C leaked private Video or Trust revision authority.';
  end if;

  if not has_function_privilege(
       'authenticated',
       'public.replace_video_publication_version_credits(uuid,jsonb,bigint,text,uuid)',
       'EXECUTE'
     )
     or not has_function_privilege(
       'authenticated',
       'public.replace_video_publication_version_citations(uuid,jsonb,bigint,text,uuid)',
       'EXECUTE'
     )
     or has_function_privilege(
       'anon',
       'public.replace_video_publication_version_credits(uuid,jsonb,bigint,text,uuid)',
       'EXECUTE'
     )
     or has_function_privilege(
       'anon',
       'public.replace_video_publication_version_citations(uuid,jsonb,bigint,text,uuid)',
       'EXECUTE'
     )
  then
    raise exception 'STOP: K5C Video Trust execute boundary is incorrect.';
  end if;

  v_def:=pg_get_functiondef(
    'video.copy_publication_version_snapshot(uuid,text,uuid)'::regprocedure
  );
  if position('copy_video_version_trust_to_version' in v_def)=0 then
    raise exception 'STOP: immutable Video version copies do not preserve Trust.';
  end if;

  v_def:=pg_get_functiondef(
    'video.insert_current_publication_snapshot(uuid,bigint,text,uuid)'::regprocedure
  );
  if position('copy_video_version_trust_to_version' in v_def)=0 then
    raise exception 'STOP: new Video working snapshots do not preserve Trust.';
  end if;

  v_def:=pg_get_functiondef(
    'public.get_admin_video_publication_workspace(uuid)'::regprocedure
  );
  if position('''trust''' in v_def)=0
     or position('video_publication_version_trust_revisions' in v_def)=0
  then
    raise exception 'STOP: Video Admin workspace does not expose governed Trust.';
  end if;

  if to_regclass('video.credits') is not null
     or to_regclass('video.citations') is not null
  then
    raise exception 'STOP: K5C created competing Video Trust identity.';
  end if;
end;
$postflight$;
