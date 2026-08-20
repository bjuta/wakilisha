-- Phase 6A M4: final Audio editorial authority and canonical editor support.
-- This migration closes internal Audio authoring authority without creating public Audio delivery routes.

begin;

insert into media.usage_roles (
  usage_role,
  label,
  description,
  enabled,
  sort_order
)
values (
  'audio_transcript',
  'Audio transcript',
  'Exact transcript Media revision selected for one Audio publication.',
  true,
  36
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
    'audio.publication.transcript.set',
    'audio.publication.transcript.set.sync',
    'audio.publication.transcript.set.accepted',
    'audio.publication.transcript.set.succeeded',
    'audio.publication.transcript.set.failed',
    'audio.publication.transcript.set.retry_scheduled',
    true
  ),
  (
    'audio.publication.chapters.replace',
    'audio.publication.chapters.replace.sync',
    'audio.publication.chapters.replace.accepted',
    'audio.publication.chapters.replace.succeeded',
    'audio.publication.chapters.replace.failed',
    'audio.publication.chapters.replace.retry_scheduled',
    true
  ),
  (
    'audio.publication.trust.citations.replace',
    'audio.publication.trust.citations.replace.sync',
    'audio.publication.trust.citations.replace.accepted',
    'audio.publication.trust.citations.replace.succeeded',
    'audio.publication.trust.citations.replace.failed',
    'audio.publication.trust.citations.replace.retry_scheduled',
    true
  ),
  (
    'audio.publication.trust.credits.replace',
    'audio.publication.trust.credits.replace.sync',
    'audio.publication.trust.credits.replace.accepted',
    'audio.publication.trust.credits.replace.succeeded',
    'audio.publication.trust.credits.replace.failed',
    'audio.publication.trust.credits.replace.retry_scheduled',
    true
  );

create table audio.publication_chapters (
  id uuid primary key default extensions.gen_random_uuid(),
  publication_id uuid not null references audio.publications(id) on delete cascade,
  chapter_number integer not null check (chapter_number >= 1),
  start_seconds numeric(12,3) not null check (start_seconds >= 0),
  title text not null check (nullif(btrim(title), '') is not null),
  chapter_url text,
  image_url text,
  created_by uuid references auth.users(id),
  updated_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (publication_id, chapter_number),
  unique (publication_id, start_seconds)
);

alter table audio.publication_chapters enable row level security;
revoke all on audio.publication_chapters from public, anon, authenticated;

create index audio_publication_chapters_publication_start_idx
  on audio.publication_chapters(publication_id, start_seconds, chapter_number);

create table audio.publication_version_chapters (
  publication_version_id uuid not null references audio.publication_versions(id) on delete cascade,
  chapter_number integer not null check (chapter_number >= 1),
  start_seconds numeric(12,3) not null check (start_seconds >= 0),
  title text not null check (nullif(btrim(title), '') is not null),
  chapter_url text,
  image_url text,
  primary key (publication_version_id, chapter_number),
  unique (publication_version_id, start_seconds)
);

alter table audio.publication_version_chapters enable row level security;
revoke all on audio.publication_version_chapters from public, anon, authenticated;

alter table audio.publication_versions
  add column transcript_media_asset_id uuid,
  add column transcript_media_revision_id uuid;

alter table audio.publication_versions
  add constraint audio_publication_versions_transcript_pair_check
  check (
    (transcript_media_asset_id is null and transcript_media_revision_id is null)
    or
    (transcript_media_asset_id is not null and transcript_media_revision_id is not null)
  ),
  add constraint audio_publication_versions_transcript_asset_fk
  foreign key (transcript_media_asset_id)
  references media.assets(id),
  add constraint audio_publication_versions_transcript_revision_fk
  foreign key (transcript_media_revision_id)
  references media.asset_revisions(id);

create index audio_publication_versions_transcript_revision_idx
  on audio.publication_versions(transcript_media_revision_id)
  where transcript_media_revision_id is not null;

create unique index audio_publication_one_active_transcript_idx
  on media.usage_links(target_id)
  where target_authority = 'editorial'
    and target_kind = 'audio_publication'
    and target_version_id is null
    and usage_role = 'audio_transcript'
    and usage_state = 'active';

create table editorial.audio_publication_version_trust_revisions (
  publication_version_id uuid primary key references audio.publication_versions(id) on delete cascade,
  citation_revision bigint not null default 1 check (citation_revision >= 1),
  credit_revision bigint not null default 1 check (credit_revision >= 1),
  updated_by uuid references auth.users(id),
  updated_at timestamptz not null default now()
);

alter table editorial.audio_publication_version_trust_revisions enable row level security;
revoke all on editorial.audio_publication_version_trust_revisions from public, anon, authenticated;


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
      'standalone_audio'
    )
  ),
  add constraint resource_citations_target_type_check
  check (
    (resource_kind = 'article' and target_version_type = 'article_version')
    or (
      resource_kind in ('playlist','playlist_item')
      and target_version_type = 'playlist_version'
    )
    or (
      resource_kind in ('audio_episode','standalone_audio')
      and target_version_type = 'audio_publication_version'
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
      'standalone_audio'
    )
  ),
  add constraint resource_credits_target_type_check
  check (
    (resource_kind = 'article' and target_version_type = 'article_version')
    or (
      resource_kind in ('playlist','playlist_item')
      and target_version_type = 'playlist_version'
    )
    or (
      resource_kind in ('audio_episode','standalone_audio')
      and target_version_type = 'audio_publication_version'
    )
  );

create table platform_private.audio_trust_copy_authorizations (
  authorization_token uuid primary key,
  source_version_id uuid not null references audio.publication_versions(id) on delete cascade,
  target_version_id uuid not null references audio.publication_versions(id) on delete cascade,
  backend_pid integer not null,
  transaction_id bigint not null,
  created_at timestamptz not null default now()
);
revoke all on platform_private.audio_trust_copy_authorizations from public, anon, authenticated;


create table platform_private.audio_transcript_mutation_authorizations (
  token uuid primary key,
  actor_id uuid not null references auth.users(id),
  publication_id uuid not null references audio.publications(id) on delete cascade,
  command_receipt_id uuid not null references platform_private.command_receipts(id) on delete cascade,
  created_at timestamptz not null default now()
);
revoke all on platform_private.audio_transcript_mutation_authorizations from public, anon, authenticated;

create table platform_private.audio_chapter_mutation_authorizations (
  token uuid primary key,
  actor_id uuid not null references auth.users(id),
  publication_id uuid not null references audio.publications(id) on delete cascade,
  command_receipt_id uuid not null references platform_private.command_receipts(id) on delete cascade,
  created_at timestamptz not null default now()
);
revoke all on platform_private.audio_chapter_mutation_authorizations from public, anon, authenticated;

create function platform_private.guard_audio_transcript_usage_mutation()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, auth, platform_private
as $function$
declare
  v_token uuid;
  v_target_id uuid;
  v_actor_id uuid;
  v_is_audio_transcript boolean;
begin
  v_is_audio_transcript :=
    (
      tg_op <> 'DELETE'
      and new.target_authority = 'editorial'
      and new.target_kind = 'audio_publication'
      and new.usage_role = 'audio_transcript'
    )
    or
    (
      tg_op <> 'INSERT'
      and old.target_authority = 'editorial'
      and old.target_kind = 'audio_publication'
      and old.usage_role = 'audio_transcript'
    );

  if not v_is_audio_transcript then
    if tg_op = 'DELETE' then return old; end if;
    return new;
  end if;

  v_target_id := case when tg_op='DELETE' then old.target_id else new.target_id end;

  begin
    v_token := nullif(current_setting('wakilisha.audio_transcript_mutation_token',true),'')::uuid;
  exception when others then
    v_token := null;
  end;

  v_actor_id := auth.uid();

  if v_token is null
     or v_actor_id is null
     or not exists (
       select 1
       from platform_private.audio_transcript_mutation_authorizations authz
       where authz.token=v_token
         and authz.actor_id=v_actor_id
         and authz.publication_id=v_target_id
     )
  then
    raise exception using
      errcode='42501',
      message='Audio transcript usage must be changed through the governed Audio transcript command.';
  end if;

  if tg_op='DELETE' then return old; end if;
  return new;
end;
$function$;


create trigger audio_transcript_usage_governed_mutation
before insert or update or delete on media.usage_links
for each row execute function platform_private.guard_audio_transcript_usage_mutation();

create function platform_private.guard_audio_chapter_mutation()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, auth, platform_private
as $function$
declare
  v_token uuid;
  v_publication_id uuid;
  v_actor_id uuid;
begin
  v_publication_id := case when tg_op='DELETE' then old.publication_id else new.publication_id end;

  begin
    v_token := nullif(current_setting('wakilisha.audio_chapter_mutation_token',true),'')::uuid;
  exception when others then
    v_token := null;
  end;

  v_actor_id := auth.uid();

  if v_token is null
     or v_actor_id is null
     or not exists (
       select 1
       from platform_private.audio_chapter_mutation_authorizations authz
       where authz.token=v_token
         and authz.actor_id=v_actor_id
         and authz.publication_id=v_publication_id
     )
  then
    raise exception using
      errcode='42501',
      message='Audio chapters must be changed through the governed Audio chapter command.';
  end if;

  if tg_op='DELETE' then return old; end if;
  return new;
end;
$function$;


create trigger audio_publication_chapters_governed_mutation
before insert or update or delete on audio.publication_chapters
for each row execute function platform_private.guard_audio_chapter_mutation();

create function platform_private.begin_audio_trust_copy_authorization(
  p_source_version_id uuid,
  p_target_version_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog, platform_private, audio, extensions
as $function$
declare
  v_token uuid := extensions.gen_random_uuid();
  v_source audio.publication_versions%rowtype;
  v_target audio.publication_versions%rowtype;
begin
  select * into v_source from audio.publication_versions where id = p_source_version_id;
  select * into v_target from audio.publication_versions where id = p_target_version_id;

  if v_source.id is null or v_target.id is null
     or v_source.resource_id <> v_target.resource_id
     or v_source.publication_id <> v_target.publication_id
  then
    raise exception 'Audio Trust copy requires versions of the same publication Resource.';
  end if;

  insert into platform_private.audio_trust_copy_authorizations (
    authorization_token, source_version_id, target_version_id, backend_pid, transaction_id
  )
  values (v_token, p_source_version_id, p_target_version_id, pg_backend_pid(), txid_current());

  perform set_config('wakilisha.audio_trust_copy_token', v_token::text, true);
  return v_token;
end;
$function$;

create function platform_private.end_audio_trust_copy_authorization(
  p_authorization_token uuid
)
returns void
language plpgsql
security definer
set search_path = pg_catalog, platform_private
as $function$
begin
  delete from platform_private.audio_trust_copy_authorizations
  where authorization_token = p_authorization_token
    and backend_pid = pg_backend_pid()
    and transaction_id = txid_current();

  perform set_config('wakilisha.audio_trust_copy_token', '', true);
end;
$function$;

create function audio.current_publication_transcript(
  p_publication_id uuid
)
returns table (
  usage_link_id uuid,
  asset_id uuid,
  asset_revision_id uuid
)
language sql
stable
security definer
set search_path = pg_catalog, media
as $function$
  select
    usage.id,
    usage.asset_id,
    usage.asset_revision_id
  from media.usage_links usage
  where usage.target_authority = 'editorial'
    and usage.target_kind = 'audio_publication'
    and usage.target_id = p_publication_id
    and usage.target_version_id is null
    and usage.usage_role = 'audio_transcript'
    and usage.usage_state = 'active'
  order by usage.created_at desc, usage.id
  limit 1;
$function$;

create function audio.enforce_publication_version_transcript_integrity()
returns trigger
language plpgsql
set search_path = pg_catalog, audio, media
as $function$
begin
  if new.transcript_media_asset_id is null then
    return new;
  end if;

  if not exists (
    select 1
    from media.assets asset
    join media.asset_revisions revision
      on revision.id = new.transcript_media_revision_id
     and revision.asset_id = asset.id
    where asset.id = new.transcript_media_asset_id
      and asset.asset_kind = 'transcript'
      and asset.lifecycle_state = 'active'
  ) then
    raise exception 'Audio version transcript must bind one exact Transcript Media revision.';
  end if;

  return new;
end;
$function$;


create trigger audio_publication_version_transcript_integrity
before insert or update of transcript_media_asset_id, transcript_media_revision_id
on audio.publication_versions
for each row execute function audio.enforce_publication_version_transcript_integrity();

create function audio.prevent_publication_version_chapter_mutation()
returns trigger
language plpgsql
set search_path = pg_catalog
as $function$
begin
  raise exception 'Audio publication version chapters are immutable.';
end;
$function$;


create trigger audio_publication_version_chapters_immutable
before update or delete on audio.publication_version_chapters
for each row execute function audio.prevent_publication_version_chapter_mutation();

-- Extend shared Trust attachment integrity only for typed Audio publication versions.
create or replace function editorial.assert_resource_version_trust_attachment()
returns trigger
language plpgsql
set search_path = pg_catalog, editorial, audio
as $function$
declare
  v_playlist_version editorial.playlist_versions%rowtype;
  v_audio_version audio.publication_versions%rowtype;
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

create function editorial.prevent_immutable_audio_trust_mutation()
returns trigger
language plpgsql
set search_path = pg_catalog, editorial, audio, platform_private
as $function$
declare
  v_kind text;
  v_token_text text;
  v_token uuid;
  v_authorization platform_private.audio_trust_copy_authorizations%rowtype;
begin
  if tg_op in ('UPDATE','DELETE')
     and old.target_version_type = 'audio_publication_version'
  then
    select version.version_kind into v_kind
    from audio.publication_versions version
    where version.id = old.target_version_id;

    if v_kind in ('submitted','approved','published') then
      raise exception 'Trust attached to immutable Audio version % cannot be changed.', old.target_version_id;
    end if;
  end if;

  if tg_op not in ('INSERT','UPDATE')
     or new.target_version_type <> 'audio_publication_version'
  then
    if tg_op = 'DELETE' then return old; end if;
    return new;
  end if;

  select version.version_kind into v_kind
  from audio.publication_versions version
  where version.id = new.target_version_id;

  if v_kind not in ('submitted','approved','published') then
    return new;
  end if;

  if tg_op = 'UPDATE' then
    raise exception 'Trust cannot be moved into immutable Audio version %.', new.target_version_id;
  end if;

  v_token_text := nullif(current_setting('wakilisha.audio_trust_copy_token', true), '');
  if v_token_text is null then
    raise exception 'Trust cannot be attached directly to immutable Audio version %.', new.target_version_id;
  end if;

  begin
    v_token := v_token_text::uuid;
  exception when invalid_text_representation then
    raise exception 'Immutable Audio Trust copy authorization is invalid.';
  end;

  select auth.* into v_authorization
  from platform_private.audio_trust_copy_authorizations auth
  where auth.authorization_token = v_token
    and auth.backend_pid = pg_backend_pid()
    and auth.transaction_id = txid_current()
    and auth.target_version_id = new.target_version_id;

  if not found then
    raise exception 'Immutable Audio Trust copy authorization is invalid.';
  end if;

  if tg_table_name = 'resource_citations' then
    if not exists (
      select 1 from editorial.resource_citations source
      where source.target_version_type = 'audio_publication_version'
        and source.target_version_id = v_authorization.source_version_id
        and source.resource_id = new.resource_id
        and source.resource_kind = new.resource_kind
        and source.citation_id = new.citation_id
        and source.citation_purpose = new.citation_purpose
        and source.target_anchor_type = new.target_anchor_type
        and source.target_anchor_data = new.target_anchor_data
        and source.display_order = new.display_order
        and source.public_safe = new.public_safe
        and source.created_by is not distinct from new.created_by
    ) then
      raise exception 'Immutable Audio Citation copy does not match its authorized source snapshot.';
    end if;
  elsif tg_table_name = 'resource_credits' then
    if not exists (
      select 1 from editorial.resource_credits source
      where source.target_version_type = 'audio_publication_version'
        and source.target_version_id = v_authorization.source_version_id
        and source.resource_id = new.resource_id
        and source.resource_kind = new.resource_kind
        and source.credit_id = new.credit_id
        and source.display_order = new.display_order
        and source.is_primary = new.is_primary
        and source.public_safe = new.public_safe
        and source.created_by is not distinct from new.created_by
    ) then
      raise exception 'Immutable Audio Credit copy does not match its authorized source snapshot.';
    end if;
  end if;

  return new;
end;
$function$;


create trigger resource_citations_audio_immutable_guard
before insert or update or delete on editorial.resource_citations
for each row execute function editorial.prevent_immutable_audio_trust_mutation();


create trigger resource_credits_audio_immutable_guard
before insert or update or delete on editorial.resource_credits
for each row execute function editorial.prevent_immutable_audio_trust_mutation();

create function editorial.copy_audio_version_trust_to_version(
  p_source_version_id uuid,
  p_target_version_id uuid
)
returns void
language plpgsql
security definer
set search_path = pg_catalog, editorial, audio, platform_private
as $function$
declare
  v_token uuid;
  v_source audio.publication_versions%rowtype;
  v_target audio.publication_versions%rowtype;
begin
  select * into v_source from audio.publication_versions where id = p_source_version_id;
  select * into v_target from audio.publication_versions where id = p_target_version_id;

  if v_source.id is null or v_target.id is null
     or v_source.resource_id <> v_target.resource_id
     or v_source.publication_id <> v_target.publication_id
  then
    raise exception 'Audio Trust copy requires versions of the same publication.';
  end if;

  v_token := platform_private.begin_audio_trust_copy_authorization(
    p_source_version_id,
    p_target_version_id
  );

  insert into editorial.resource_citations (
    resource_id, resource_kind, target_version_type, target_version_id,
    citation_id, citation_purpose, target_anchor_type, target_anchor_data,
    display_order, public_safe, created_by
  )
  select
    source.resource_id, source.resource_kind, 'audio_publication_version', p_target_version_id,
    source.citation_id, source.citation_purpose, source.target_anchor_type, source.target_anchor_data,
    source.display_order, source.public_safe, source.created_by
  from editorial.resource_citations source
  where source.target_version_type = 'audio_publication_version'
    and source.target_version_id = p_source_version_id
    and source.resource_id = v_source.resource_id;

  insert into editorial.resource_credits (
    resource_id, resource_kind, target_version_type, target_version_id,
    credit_id, display_order, is_primary, public_safe, created_by
  )
  select
    source.resource_id, source.resource_kind, 'audio_publication_version', p_target_version_id,
    source.credit_id, source.display_order, source.is_primary, source.public_safe, source.created_by
  from editorial.resource_credits source
  where source.target_version_type = 'audio_publication_version'
    and source.target_version_id = p_source_version_id
    and source.resource_id = v_source.resource_id;

  insert into editorial.audio_publication_version_trust_revisions (
    publication_version_id, citation_revision, credit_revision, updated_by, updated_at
  )
  select
    p_target_version_id,
    coalesce(revision.citation_revision, 1),
    coalesce(revision.credit_revision, 1),
    revision.updated_by,
    now()
  from (select 1) seed
  left join editorial.audio_publication_version_trust_revisions revision
    on revision.publication_version_id = p_source_version_id
  on conflict (publication_version_id) do update
  set citation_revision = excluded.citation_revision,
      credit_revision = excluded.credit_revision,
      updated_by = excluded.updated_by,
      updated_at = excluded.updated_at;

  perform platform_private.end_audio_trust_copy_authorization(v_token);
exception when others then
  if v_token is not null then
    perform platform_private.end_audio_trust_copy_authorization(v_token);
  end if;
  raise;
end;
$function$;

create or replace function audio.publication_content_fingerprint(
  p_publication_id uuid
)
returns text
language sql
stable
set search_path = pg_catalog, audio, media, editorial, extensions
as $function$
  select encode(
    extensions.digest(
      convert_to(
        jsonb_build_object(
          'publication_kind', publication.publication_kind,
          'show_id', publication.show_id,
          'season_id', publication.season_id,
          'episode_number', publication.episode_number,
          'slug', publication.slug,
          'title', publication.title,
          'summary', publication.summary,
          'metadata', publication.metadata,
          'master_media_asset_id', master.asset_id,
          'master_media_revision_id', master.asset_revision_id,
          'audio_delivery_variant_id', master.audio_delivery_variant_id,
          'transcript_media_asset_id', transcript.asset_id,
          'transcript_media_revision_id', transcript.asset_revision_id,
          'chapters', coalesce(chapters.payload, '[]'::jsonb)
        )::text,
        'UTF8'
      ),
      'sha256'
    ),
    'hex'
  )
  from audio.publications publication
  left join lateral audio.current_publication_master(publication.id) master on true
  left join lateral audio.current_publication_transcript(publication.id) transcript on true
  left join lateral (
    select jsonb_agg(
      jsonb_build_object(
        'chapter_number', chapter.chapter_number,
        'start_seconds', chapter.start_seconds,
        'title', chapter.title,
        'chapter_url', chapter.chapter_url,
        'image_url', chapter.image_url
      )
      order by chapter.chapter_number
    ) as payload
    from audio.publication_chapters chapter
    where chapter.publication_id = publication.id
  ) chapters on true
  where publication.id = p_publication_id;
$function$;

create or replace function audio.insert_current_publication_snapshot(
  p_publication_id uuid,
  p_expected_authority_revision bigint,
  p_version_kind text,
  p_actor_id uuid
)
returns table (
  version_id uuid,
  version_number bigint,
  content_fingerprint text
)
language plpgsql
security definer
set search_path = pg_catalog, audio, editorial, media, extensions
as $function$
declare
  v_publication audio.publications%rowtype;
  v_binding editorial.audio_publication_resources%rowtype;
  v_master record;
  v_transcript record;
  v_version_number bigint;
  v_fingerprint text;
  v_version_id uuid;
  v_source_working_version_id uuid;
begin
  if p_version_kind not in ('working','submitted','approved','published') then
    raise exception 'Unsupported Audio version kind.';
  end if;

  select publication.* into v_publication
  from audio.publications publication
  where publication.id = p_publication_id;

  if not found then raise exception 'Audio publication does not exist.'; end if;
  if v_publication.authority_revision <> p_expected_authority_revision then
    raise exception 'Audio publication revision changed.';
  end if;

  select binding.* into v_binding
  from editorial.audio_publication_resources binding
  where binding.publication_id = p_publication_id;

  if not found then raise exception 'Audio publication Resource binding does not exist.'; end if;

  v_source_working_version_id := v_binding.current_working_version_id;

  select * into v_master from audio.current_publication_master(p_publication_id);
  select * into v_transcript from audio.current_publication_transcript(p_publication_id);

  v_fingerprint := audio.publication_content_fingerprint(p_publication_id);
  if v_fingerprint is null then raise exception 'Audio publication fingerprint could not be created.'; end if;

  select coalesce(max(version.version_number),0)+1 into v_version_number
  from audio.publication_versions version
  where version.publication_id = p_publication_id;

  v_version_id := extensions.gen_random_uuid();

  insert into audio.publication_versions (
    id, resource_id, publication_id, version_number, version_kind,
    source_authority_revision, publication_kind, show_id, season_id,
    episode_number, title, slug, summary, status, metadata,
    master_media_asset_id, master_media_revision_id, audio_delivery_variant_id,
    transcript_media_asset_id, transcript_media_revision_id,
    content_fingerprint, created_by
  )
  values (
    v_version_id, v_binding.resource_id, v_publication.id, v_version_number, p_version_kind,
    v_publication.authority_revision, v_publication.publication_kind, v_publication.show_id,
    v_publication.season_id, v_publication.episode_number, v_publication.title,
    v_publication.slug, v_publication.summary, v_publication.status, v_publication.metadata,
    v_master.asset_id, v_master.asset_revision_id, v_master.audio_delivery_variant_id,
    v_transcript.asset_id, v_transcript.asset_revision_id,
    v_fingerprint, p_actor_id
  );

  insert into audio.publication_version_chapters (
    publication_version_id, chapter_number, start_seconds, title, chapter_url, image_url
  )
  select
    v_version_id, chapter.chapter_number, chapter.start_seconds, chapter.title,
    chapter.chapter_url, chapter.image_url
  from audio.publication_chapters chapter
  where chapter.publication_id = p_publication_id
  order by chapter.chapter_number;

  if p_version_kind in ('working','submitted')
     and v_source_working_version_id is not null
     and v_source_working_version_id <> v_version_id
  then
    perform editorial.copy_audio_version_trust_to_version(
      v_source_working_version_id,
      v_version_id
    );
  elsif p_version_kind = 'working' then
    insert into editorial.audio_publication_version_trust_revisions(publication_version_id)
    values (v_version_id)
    on conflict (publication_version_id) do nothing;
  end if;

  version_id := v_version_id;
  version_number := v_version_number;
  content_fingerprint := v_fingerprint;
  return next;
end;
$function$;

create or replace function audio.copy_publication_version_snapshot(
  p_source_version_id uuid,
  p_version_kind text,
  p_status text,
  p_actor_id uuid
)
returns table (
  version_id uuid,
  version_number bigint,
  content_fingerprint text
)
language plpgsql
security definer
set search_path = pg_catalog, audio, editorial, extensions
as $function$
declare
  v_source audio.publication_versions%rowtype;
  v_version_id uuid;
  v_version_number bigint;
begin
  if p_version_kind not in ('approved','published') then
    raise exception 'Unsupported copied Audio version kind.';
  end if;

  if (p_version_kind='approved' and p_status<>'approved')
     or (p_version_kind='published' and p_status<>'published')
  then
    raise exception 'Audio copied version lifecycle status is invalid.';
  end if;

  select version.* into v_source
  from audio.publication_versions version
  where version.id = p_source_version_id;

  if not found then raise exception 'Source Audio version does not exist.'; end if;
  if p_version_kind='approved' and v_source.version_kind<>'submitted' then
    raise exception 'Approved Audio versions must copy an exact submitted version.';
  end if;
  if p_version_kind='published' and v_source.version_kind<>'approved' then
    raise exception 'Published Audio versions must copy an exact approved version.';
  end if;

  select coalesce(max(version.version_number),0)+1 into v_version_number
  from audio.publication_versions version
  where version.publication_id = v_source.publication_id;

  v_version_id := extensions.gen_random_uuid();

  insert into audio.publication_versions (
    id, resource_id, publication_id, version_number, version_kind,
    source_authority_revision, publication_kind, show_id, season_id,
    episode_number, title, slug, summary, status, metadata,
    master_media_asset_id, master_media_revision_id, audio_delivery_variant_id,
    transcript_media_asset_id, transcript_media_revision_id,
    content_fingerprint, created_by
  )
  values (
    v_version_id, v_source.resource_id, v_source.publication_id, v_version_number,
    p_version_kind, v_source.source_authority_revision, v_source.publication_kind,
    v_source.show_id, v_source.season_id, v_source.episode_number, v_source.title,
    v_source.slug, v_source.summary, p_status, v_source.metadata,
    v_source.master_media_asset_id, v_source.master_media_revision_id,
    v_source.audio_delivery_variant_id, v_source.transcript_media_asset_id,
    v_source.transcript_media_revision_id, v_source.content_fingerprint, p_actor_id
  );

  insert into audio.publication_version_chapters (
    publication_version_id, chapter_number, start_seconds, title, chapter_url, image_url
  )
  select
    v_version_id, chapter.chapter_number, chapter.start_seconds, chapter.title,
    chapter.chapter_url, chapter.image_url
  from audio.publication_version_chapters chapter
  where chapter.publication_version_id = p_source_version_id
  order by chapter.chapter_number;

  perform editorial.copy_audio_version_trust_to_version(
    p_source_version_id,
    v_version_id
  );

  version_id := v_version_id;
  version_number := v_version_number;
  content_fingerprint := v_source.content_fingerprint;
  return next;
end;
$function$;


create or replace function audio.assert_publishable_version_media(
  p_version_id uuid
)
returns table (
  asset_id uuid,
  asset_revision_id uuid,
  delivery_variant_id uuid,
  delivery_url text,
  mime_type text,
  byte_size bigint,
  sha256 text,
  duration_seconds numeric
)
language plpgsql
stable
security definer
set search_path = pg_catalog, audio, media
as $function$
declare
  v_version audio.publication_versions%rowtype;
begin
  select version.* into v_version
  from audio.publication_versions version
  where version.id = p_version_id;

  if not found
     or v_version.master_media_asset_id is null
     or v_version.master_media_revision_id is null
     or v_version.audio_delivery_variant_id is null
  then
    raise exception
      'Audio publication requires an exact master and full-length delivery before publication.';
  end if;

  return query
  select
    asset.id,
    revision.id,
    variant.id,
    file_object.delivery_url,
    file_object.mime_type,
    file_object.byte_size,
    file_object.sha256,
    nullif(
      file_object.technical_metadata #>> '{source_probe,duration_seconds}',
      ''
    )::numeric
  from media.assets asset
  join media.asset_revisions revision
    on revision.id = v_version.master_media_revision_id
   and revision.asset_id = asset.id
  join media.variants variant
    on variant.id = v_version.audio_delivery_variant_id
   and variant.asset_id = asset.id
   and variant.asset_revision_id = revision.id
   and variant.variant_role = 'audio_delivery'
  join media.file_objects file_object
    on file_object.id = variant.derived_file_object_id
  join media.asset_governance_versions governance
    on governance.id = asset.current_governance_version_id
   and governance.asset_id = asset.id
  where asset.id = v_version.master_media_asset_id
    and asset.asset_kind = 'audio'
    and asset.lifecycle_state = 'active'
    and file_object.verification_state = 'verified'
    and file_object.mime_type = 'audio/mpeg'
    and file_object.byte_size > 0
    and file_object.sha256 ~ '^[0-9a-f]{64}$'
    and file_object.delivery_url like
          'https://media.wakilisha.africa/derivatives/%'
    and governance.public_safety_state in (
          'approved_public',
          'approved_redacted'
        )
    and governance.consent_status in (
          'granted',
          'not_required'
        )
    and governance.rights_status <> 'restricted'
    and governance.embargo_state in (
          'none',
          'released'
        );

  if not found then
    raise exception
      'Audio publication Media is not approved for public delivery.';
  end if;

  if v_version.transcript_media_asset_id is not null then
    if not exists (
      select 1
      from media.assets transcript_asset
      join media.asset_revisions transcript_revision
        on transcript_revision.id = v_version.transcript_media_revision_id
       and transcript_revision.asset_id = transcript_asset.id
      join media.file_objects transcript_file
        on transcript_file.id = transcript_revision.original_file_object_id
      join media.asset_governance_versions transcript_governance
        on transcript_governance.id =
             transcript_asset.current_governance_version_id
       and transcript_governance.asset_id = transcript_asset.id
      where transcript_asset.id = v_version.transcript_media_asset_id
        and transcript_asset.asset_kind = 'transcript'
        and transcript_asset.lifecycle_state = 'active'
        and transcript_file.verification_state = 'verified'
        and transcript_governance.public_safety_state in (
              'approved_public',
              'approved_redacted'
            )
        and transcript_governance.consent_status in (
              'granted',
              'not_required'
            )
        and transcript_governance.rights_status <> 'restricted'
        and transcript_governance.embargo_state in (
              'none',
              'released'
            )
    ) then
      raise exception
        'Audio publication Transcript Media is not approved for public delivery.';
    end if;
  end if;
end;
$function$;

create function public.set_audio_publication_transcript(
  p_publication_id uuid,
  p_expected_authority_revision bigint,
  p_asset_id uuid,
  p_asset_revision_id uuid,
  p_idempotency_key text,
  p_correlation_id uuid default null
)
returns table (
  command_receipt_id uuid,
  receipt_status text,
  publication_id uuid,
  resource_id uuid,
  authority_revision bigint,
  transcript_usage_link_id uuid,
  transcript_media_asset_id uuid,
  transcript_media_revision_id uuid,
  result_payload jsonb,
  idempotent_replay boolean
)
language plpgsql
security definer
set search_path = pg_catalog, auth, public, editorial, audio, media, platform_private, extensions
as $function$
declare
  v_publication audio.publications%rowtype;
  v_binding editorial.audio_publication_resources%rowtype;
  v_current media.usage_links%rowtype;
  v_count bigint;
  v_begin record;
  v_read record;
  v_actor record;
  v_result jsonb;
  v_usage_id uuid;
  v_correlation uuid := coalesce(p_correlation_id, extensions.gen_random_uuid());
  v_token uuid := extensions.gen_random_uuid();
  v_same boolean := false;
begin
  if p_publication_id is null or p_expected_authority_revision is null or p_expected_authority_revision < 1
     or ((p_asset_id is null) <> (p_asset_revision_id is null))
  then raise exception using errcode='22023', message='Audio transcript request is invalid.'; end if;

  select * into v_publication from audio.publications where id=p_publication_id for update;
  if not found then raise exception using errcode='P0002', message='Audio publication does not exist.'; end if;
  if v_publication.status not in ('draft','changes_requested') then
    raise exception using errcode='55000', message='Audio transcript can be changed only while the publication is editable.';
  end if;

  select * into v_binding from editorial.audio_publication_resources as binding where binding.publication_id=p_publication_id for update;
  if not found then raise exception 'Audio publication Resource binding is missing.'; end if;
  if not editorial.current_user_can_edit_audio(v_binding.resource_id) then
    raise exception using errcode='42501', message='Audio edit permission is required.';
  end if;

  if p_asset_id is not null and not exists (
    select 1
    from media.assets asset
    join media.asset_revisions revision on revision.asset_id=asset.id and revision.id=p_asset_revision_id
    join media.file_objects original_file on original_file.id=revision.original_file_object_id
    where asset.id=p_asset_id
      and asset.asset_kind='transcript'
      and asset.lifecycle_state='active'
      and original_file.verification_state='verified'
  ) then
    raise exception using errcode='55000', message='Audio transcript requires one exact verified Transcript Media revision.';
  end if;

  select * into v_begin
  from platform_private.begin_authenticated_resource_command(
    'audio.publication.transcript.set',
    v_binding.resource_id,
    p_idempotency_key,
    jsonb_build_object(
      'publication_id',p_publication_id,
      'expected_authority_revision',p_expected_authority_revision,
      'asset_id',p_asset_id,
      'asset_revision_id',p_asset_revision_id,
      'correlation_id',v_correlation
    )
  );

  if v_begin.idempotent_replay then
    select * into v_read
    from platform_private.read_authenticated_resource_command_result(v_begin.command_receipt_id,true);

    command_receipt_id:=v_read.command_receipt_id;
    receipt_status:=v_read.receipt_status;
    publication_id:=p_publication_id;
    resource_id:=v_binding.resource_id;
    authority_revision:=nullif(v_read.result_payload->>'authority_revision','')::bigint;
    transcript_usage_link_id:=nullif(v_read.result_payload->>'transcript_usage_link_id','')::uuid;
    transcript_media_asset_id:=nullif(v_read.result_payload->>'transcript_media_asset_id','')::uuid;
    transcript_media_revision_id:=nullif(v_read.result_payload->>'transcript_media_revision_id','')::uuid;
    result_payload:=v_read.result_payload;
    idempotent_replay:=true;
    return next;
    return;
  end if;

  if v_publication.authority_revision <> p_expected_authority_revision then
    perform platform_private.reject_resource_command(
      v_begin.command_receipt_id,
      'audio_publication_revision_changed',
      'The Audio publication changed before its transcript could be updated.',
      jsonb_build_object('publication_id',p_publication_id,'authority_revision',v_publication.authority_revision)
    );
  else
    select count(*) into v_count
    from media.usage_links usage
    where usage.target_authority='editorial'
      and usage.target_kind='audio_publication'
      and usage.target_id=p_publication_id
      and usage.target_version_id is null
      and usage.usage_role='audio_transcript'
      and usage.usage_state='active';

    if v_count > 1 then raise exception 'Audio publication has more than one active transcript.'; end if;

    if v_count=1 then
      select * into v_current
      from media.usage_links usage
      where usage.target_authority='editorial'
        and usage.target_kind='audio_publication'
        and usage.target_id=p_publication_id
        and usage.target_version_id is null
        and usage.usage_role='audio_transcript'
        and usage.usage_state='active'
      for update;

      v_same := p_asset_id is not null
        and v_current.asset_id=p_asset_id
        and v_current.asset_revision_id=p_asset_revision_id
        and v_current.resolution_mode='exact_revision';
      v_usage_id:=v_current.id;
    else
      v_same := p_asset_id is null;
    end if;

    if not v_same then
      select * into v_actor from platform_private.command_actor_context();

      insert into platform_private.audio_transcript_mutation_authorizations (
        token,actor_id,publication_id,command_receipt_id
      )
      values (
        v_token,v_actor.actor_user_id,p_publication_id,v_begin.command_receipt_id
      );

      perform set_config('wakilisha.audio_transcript_mutation_token',v_token::text,true);

      if v_count=1 then
        update media.usage_links
        set usage_state='archived',
            usage_revision=usage_revision+1,
            state_reason='Replaced by governed Audio transcript command',
            state_changed_by=v_actor.actor_user_id,
            state_changed_at=now(),
            updated_at=now()
        where id=v_current.id;

        insert into media.events (
          asset_id,asset_revision_id,usage_link_id,event_type,actor_id,reason,
          prior_state,resulting_state,correlation_id
        )
        values (
          v_current.asset_id,v_current.asset_revision_id,v_current.id,'usage_archived',
          v_actor.actor_user_id,'Audio transcript replaced or cleared',
          jsonb_build_object('usage_state','active','usage_revision',v_current.usage_revision),
          jsonb_build_object('usage_state','archived','usage_revision',v_current.usage_revision+1),
          v_correlation
        );
      end if;

      if p_asset_id is not null then
        v_usage_id:=extensions.gen_random_uuid();
        insert into media.usage_links (
          id,asset_id,asset_revision_id,resolution_mode,target_authority,target_kind,
          target_id,target_version_kind,target_version_id,usage_role,placement_data,
          display_order,usage_state,usage_revision,created_by
        )
        values (
          v_usage_id,p_asset_id,p_asset_revision_id,'exact_revision','editorial',
          'audio_publication',p_publication_id,null,null,'audio_transcript','{}'::jsonb,
          0,'active',1,v_actor.actor_user_id
        );

        insert into media.events (
          asset_id,asset_revision_id,usage_link_id,event_type,actor_id,reason,
          resulting_state,correlation_id
        )
        values (
          p_asset_id,p_asset_revision_id,v_usage_id,'usage_attached',v_actor.actor_user_id,
          'Governed Audio transcript attached',
          jsonb_build_object(
            'usage_state','active','usage_revision',1,'target_authority','editorial',
            'target_kind','audio_publication','target_id',p_publication_id,
            'usage_role','audio_transcript','resolution_mode','exact_revision'
          ),
          v_correlation
        );
      else
        v_usage_id:=null;
      end if;

      delete from platform_private.audio_transcript_mutation_authorizations
      where token=v_token;
      perform set_config('wakilisha.audio_transcript_mutation_token','',true);

      update audio.publications publication
      set authority_revision=publication.authority_revision+1,
          updated_by=v_actor.actor_user_id,
          updated_at=now()
      where publication.id=p_publication_id
      returning * into v_publication;
    end if;

    v_result:=jsonb_build_object(
      'publication_id',p_publication_id,
      'resource_id',v_binding.resource_id,
      'authority_revision',v_publication.authority_revision,
      'transcript_usage_link_id',v_usage_id,
      'transcript_media_asset_id',p_asset_id,
      'transcript_media_revision_id',p_asset_revision_id,
      'transcript_changed',not v_same,
      'correlation_id',v_correlation
    );
    perform platform_private.complete_resource_command(v_begin.command_receipt_id,v_result);
  end if;

  select * into v_read
  from platform_private.read_authenticated_resource_command_result(v_begin.command_receipt_id,false);

  command_receipt_id:=v_read.command_receipt_id;
  receipt_status:=v_read.receipt_status;
  publication_id:=p_publication_id;
  resource_id:=v_binding.resource_id;
  authority_revision:=coalesce(nullif(v_read.result_payload->>'authority_revision','')::bigint,v_publication.authority_revision);
  transcript_usage_link_id:=nullif(v_read.result_payload->>'transcript_usage_link_id','')::uuid;
  transcript_media_asset_id:=nullif(v_read.result_payload->>'transcript_media_asset_id','')::uuid;
  transcript_media_revision_id:=nullif(v_read.result_payload->>'transcript_media_revision_id','')::uuid;
  result_payload:=v_read.result_payload;
  idempotent_replay:=false;
  return next;
end;
$function$;

create function public.replace_audio_publication_chapters(
  p_publication_id uuid,
  p_expected_authority_revision bigint,
  p_chapters jsonb,
  p_idempotency_key text,
  p_correlation_id uuid default null
)
returns table (
  command_receipt_id uuid,
  receipt_status text,
  publication_id uuid,
  resource_id uuid,
  authority_revision bigint,
  chapter_count integer,
  result_payload jsonb,
  idempotent_replay boolean
)
language plpgsql
security definer
set search_path = pg_catalog, auth, public, editorial, audio, platform_private, extensions
as $function$
declare
  v_publication audio.publications%rowtype;
  v_binding editorial.audio_publication_resources%rowtype;
  v_begin record;
  v_read record;
  v_actor record;
  v_result jsonb;
  v_count integer := 0;
  v_correlation uuid := coalesce(p_correlation_id,extensions.gen_random_uuid());
  v_token uuid := extensions.gen_random_uuid();
begin
  if jsonb_typeof(coalesce(p_chapters,'[]'::jsonb)) <> 'array' then
    raise exception using errcode='22023',message='Audio chapters must be a JSON array.';
  end if;

  select * into v_publication from audio.publications where id=p_publication_id for update;
  if not found then raise exception 'Audio publication does not exist.'; end if;
  if v_publication.status not in ('draft','changes_requested') then
    raise exception 'Audio chapters can be changed only while the publication is editable.';
  end if;

  select * into v_binding from editorial.audio_publication_resources as binding where binding.publication_id=p_publication_id for update;
  if not found then raise exception 'Audio publication Resource binding is missing.'; end if;
  if not editorial.current_user_can_edit_audio(v_binding.resource_id) then
    raise exception using errcode='42501',message='Audio edit permission is required.';
  end if;

  select * into v_begin from platform_private.begin_authenticated_resource_command(
    'audio.publication.chapters.replace',
    v_binding.resource_id,
    p_idempotency_key,
    jsonb_build_object(
      'publication_id',p_publication_id,'expected_authority_revision',p_expected_authority_revision,
      'chapters',coalesce(p_chapters,'[]'::jsonb),'correlation_id',v_correlation
    )
  );

  if v_begin.idempotent_replay then
    select * into v_read from platform_private.read_authenticated_resource_command_result(v_begin.command_receipt_id,true);
    command_receipt_id:=v_read.command_receipt_id; receipt_status:=v_read.receipt_status;
    publication_id:=p_publication_id; resource_id:=v_binding.resource_id;
    authority_revision:=nullif(v_read.result_payload->>'authority_revision','')::bigint;
    chapter_count:=coalesce(nullif(v_read.result_payload->>'chapter_count','')::integer,0);
    result_payload:=v_read.result_payload; idempotent_replay:=true; return next; return;
  end if;

  if v_publication.authority_revision <> p_expected_authority_revision then
    perform platform_private.reject_resource_command(
      v_begin.command_receipt_id,'audio_publication_revision_changed',
      'The Audio publication changed before its chapters could be saved.',
      jsonb_build_object('publication_id',p_publication_id,'authority_revision',v_publication.authority_revision)
    );
  else
    select * into v_actor from platform_private.command_actor_context();

    insert into platform_private.audio_chapter_mutation_authorizations (
      token,actor_id,publication_id,command_receipt_id
    )
    values (
      v_token,v_actor.actor_user_id,p_publication_id,v_begin.command_receipt_id
    );
    perform set_config('wakilisha.audio_chapter_mutation_token',v_token::text,true);

    if exists (
      select 1
      from (
        select
          ordinality,
          nullif(btrim(item->>'title'),'') as title,
          nullif(item->>'start_seconds','')::numeric as start_seconds,
          lag(nullif(item->>'start_seconds','')::numeric) over(order by ordinality) as prior_start
        from jsonb_array_elements(coalesce(p_chapters,'[]'::jsonb)) with ordinality as row(item,ordinality)
      ) parsed
      where parsed.title is null
         or parsed.start_seconds is null
         or parsed.start_seconds < 0
         or (parsed.prior_start is not null and parsed.start_seconds <= parsed.prior_start)
    ) then
      raise exception using errcode='22023', message='Audio chapters require titles and strictly increasing non-negative start times.';
    end if;

    delete from audio.publication_chapters as chapter where chapter.publication_id=p_publication_id;

    insert into audio.publication_chapters (
      publication_id,chapter_number,start_seconds,title,chapter_url,image_url,created_by,updated_by
    )
    select
      p_publication_id, row.ordinality::integer, (row.item->>'start_seconds')::numeric,
      btrim(row.item->>'title'), nullif(btrim(row.item->>'chapter_url'),''),
      nullif(btrim(row.item->>'image_url'),''),v_actor.actor_user_id,v_actor.actor_user_id
    from jsonb_array_elements(coalesce(p_chapters,'[]'::jsonb)) with ordinality as row(item,ordinality);

    get diagnostics v_count = row_count;

    delete from platform_private.audio_chapter_mutation_authorizations
    where token=v_token;
    perform set_config('wakilisha.audio_chapter_mutation_token','',true);

    update audio.publications publication
    set authority_revision=publication.authority_revision+1,updated_by=v_actor.actor_user_id,updated_at=now()
    where publication.id=p_publication_id returning * into v_publication;

    v_result:=jsonb_build_object(
      'publication_id',p_publication_id,'resource_id',v_binding.resource_id,
      'authority_revision',v_publication.authority_revision,'chapter_count',v_count,
      'correlation_id',v_correlation
    );
    perform platform_private.complete_resource_command(v_begin.command_receipt_id,v_result);
  end if;

  select * into v_read from platform_private.read_authenticated_resource_command_result(v_begin.command_receipt_id,false);
  command_receipt_id:=v_read.command_receipt_id; receipt_status:=v_read.receipt_status;
  publication_id:=p_publication_id; resource_id:=v_binding.resource_id;
  authority_revision:=coalesce(nullif(v_read.result_payload->>'authority_revision','')::bigint,v_publication.authority_revision);
  chapter_count:=coalesce(nullif(v_read.result_payload->>'chapter_count','')::integer,0);
  result_payload:=v_read.result_payload; idempotent_replay:=false; return next;
end;
$function$;

create function public.replace_audio_publication_version_citations(
  p_publication_version_id uuid,
  p_attachments jsonb,
  p_expected_citation_revision bigint,
  p_idempotency_key text,
  p_correlation_id uuid default null
)
returns table (
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
set search_path = pg_catalog, auth, public, editorial, audio, platform_private, extensions
as $function$
declare
  v_version audio.publication_versions%rowtype;
  v_publication audio.publications%rowtype;
  v_binding editorial.audio_publication_resources%rowtype;
  v_revision editorial.audio_publication_version_trust_revisions%rowtype;
  v_begin record; v_read record; v_actor record; v_result jsonb;
  v_count integer := 0; v_correlation uuid := coalesce(p_correlation_id,extensions.gen_random_uuid());
begin
  if jsonb_typeof(coalesce(p_attachments,'[]'::jsonb)) <> 'array' then raise exception 'Audio Citation attachments must be a JSON array.'; end if;

  select * into v_version from audio.publication_versions where id=p_publication_version_id;
  if not found or v_version.version_kind<>'working' then raise exception 'Audio Citation editing requires the current working version.'; end if;
  select * into v_binding from editorial.audio_publication_resources where resource_id=v_version.resource_id and publication_id=v_version.publication_id for update;
  if not found or v_binding.current_working_version_id<>p_publication_version_id then raise exception 'Audio Citation editing requires the current working version.'; end if;
  select * into v_publication from audio.publications where id=v_version.publication_id for update;
  if v_publication.status not in ('draft','changes_requested') then raise exception 'Audio Citations can be changed only while the publication is editable.'; end if;
  if not editorial.current_user_can_edit_audio(v_binding.resource_id) then raise exception using errcode='42501',message='Audio edit permission is required.'; end if;

  insert into editorial.audio_publication_version_trust_revisions(publication_version_id)
  values (p_publication_version_id) on conflict do nothing;
  select * into v_revision from editorial.audio_publication_version_trust_revisions as trust_revision where trust_revision.publication_version_id=p_publication_version_id for update;

  select * into v_begin from platform_private.begin_authenticated_resource_command(
    'audio.publication.trust.citations.replace',v_binding.resource_id,p_idempotency_key,
    jsonb_build_object('publication_version_id',p_publication_version_id,'expected_citation_revision',p_expected_citation_revision,'attachments',coalesce(p_attachments,'[]'::jsonb),'correlation_id',v_correlation)
  );

  if v_begin.idempotent_replay then
    select * into v_read from platform_private.read_authenticated_resource_command_result(v_begin.command_receipt_id,true);
    command_receipt_id:=v_read.command_receipt_id; receipt_status:=v_read.receipt_status; publication_version_id:=p_publication_version_id;
    citation_revision:=nullif(v_read.result_payload->>'citation_revision','')::bigint; attachment_count:=coalesce(nullif(v_read.result_payload->>'attachment_count','')::integer,0);
    result_payload:=v_read.result_payload; idempotent_replay:=true; return next; return;
  end if;

  if v_revision.citation_revision<>p_expected_citation_revision then
    perform platform_private.reject_resource_command(v_begin.command_receipt_id,'audio_citation_revision_changed','Audio Citation attachments changed before they could be saved.',jsonb_build_object('publication_version_id',p_publication_version_id,'citation_revision',v_revision.citation_revision));
  else
    select * into v_actor from platform_private.command_actor_context();
    delete from editorial.resource_citations where resource_id=v_binding.resource_id and target_version_type='audio_publication_version' and target_version_id=p_publication_version_id;

    insert into editorial.resource_citations (
      resource_id,resource_kind,target_version_type,target_version_id,citation_id,
      citation_purpose,target_anchor_type,target_anchor_data,display_order,public_safe,created_by
    )
    select
      v_binding.resource_id,v_binding.resource_kind,'audio_publication_version',p_publication_version_id,
      (row.item->>'citation_id')::uuid,coalesce(nullif(btrim(row.item->>'citation_purpose'),''),'supports'),
      coalesce(nullif(btrim(row.item->>'target_anchor_type'),''),'whole_version'),
      coalesce(row.item->'target_anchor_data','{}'::jsonb),row.ordinality::integer-1,
      coalesce((row.item->>'public_safe')::boolean,false),v_actor.actor_user_id
    from jsonb_array_elements(coalesce(p_attachments,'[]'::jsonb)) with ordinality row(item,ordinality);

    get diagnostics v_count=row_count;
    update editorial.audio_publication_version_trust_revisions as trust_revision
    set citation_revision=trust_revision.citation_revision+1,updated_by=v_actor.actor_user_id,updated_at=now()
    where trust_revision.publication_version_id=p_publication_version_id returning * into v_revision;

    v_result:=jsonb_build_object('publication_version_id',p_publication_version_id,'citation_revision',v_revision.citation_revision,'attachment_count',v_count,'correlation_id',v_correlation);
    perform platform_private.complete_resource_command(v_begin.command_receipt_id,v_result);
  end if;

  select * into v_read from platform_private.read_authenticated_resource_command_result(v_begin.command_receipt_id,false);
  command_receipt_id:=v_read.command_receipt_id; receipt_status:=v_read.receipt_status; publication_version_id:=p_publication_version_id;
  citation_revision:=coalesce(nullif(v_read.result_payload->>'citation_revision','')::bigint,v_revision.citation_revision);
  attachment_count:=coalesce(nullif(v_read.result_payload->>'attachment_count','')::integer,0); result_payload:=v_read.result_payload; idempotent_replay:=false; return next;
end;
$function$;

create function public.replace_audio_publication_version_credits(
  p_publication_version_id uuid,
  p_attachments jsonb,
  p_expected_credit_revision bigint,
  p_idempotency_key text,
  p_correlation_id uuid default null
)
returns table (
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
set search_path = pg_catalog, auth, public, editorial, audio, platform_private, extensions
as $function$
declare
  v_version audio.publication_versions%rowtype;
  v_publication audio.publications%rowtype;
  v_binding editorial.audio_publication_resources%rowtype;
  v_revision editorial.audio_publication_version_trust_revisions%rowtype;
  v_begin record; v_read record; v_actor record; v_result jsonb;
  v_count integer := 0; v_correlation uuid := coalesce(p_correlation_id,extensions.gen_random_uuid());
begin
  if jsonb_typeof(coalesce(p_attachments,'[]'::jsonb)) <> 'array' then raise exception 'Audio Credit attachments must be a JSON array.'; end if;

  select * into v_version from audio.publication_versions where id=p_publication_version_id;
  if not found or v_version.version_kind<>'working' then raise exception 'Audio Credit editing requires the current working version.'; end if;
  select * into v_binding from editorial.audio_publication_resources where resource_id=v_version.resource_id and publication_id=v_version.publication_id for update;
  if not found or v_binding.current_working_version_id<>p_publication_version_id then raise exception 'Audio Credit editing requires the current working version.'; end if;
  select * into v_publication from audio.publications where id=v_version.publication_id for update;
  if v_publication.status not in ('draft','changes_requested') then raise exception 'Audio Credits can be changed only while the publication is editable.'; end if;
  if not editorial.current_user_can_edit_audio(v_binding.resource_id) then raise exception using errcode='42501',message='Audio edit permission is required.'; end if;

  insert into editorial.audio_publication_version_trust_revisions(publication_version_id)
  values (p_publication_version_id) on conflict do nothing;
  select * into v_revision from editorial.audio_publication_version_trust_revisions as trust_revision where trust_revision.publication_version_id=p_publication_version_id for update;

  select * into v_begin from platform_private.begin_authenticated_resource_command(
    'audio.publication.trust.credits.replace',v_binding.resource_id,p_idempotency_key,
    jsonb_build_object('publication_version_id',p_publication_version_id,'expected_credit_revision',p_expected_credit_revision,'attachments',coalesce(p_attachments,'[]'::jsonb),'correlation_id',v_correlation)
  );

  if v_begin.idempotent_replay then
    select * into v_read from platform_private.read_authenticated_resource_command_result(v_begin.command_receipt_id,true);
    command_receipt_id:=v_read.command_receipt_id; receipt_status:=v_read.receipt_status; publication_version_id:=p_publication_version_id;
    credit_revision:=nullif(v_read.result_payload->>'credit_revision','')::bigint; attachment_count:=coalesce(nullif(v_read.result_payload->>'attachment_count','')::integer,0);
    result_payload:=v_read.result_payload; idempotent_replay:=true; return next; return;
  end if;

  if v_revision.credit_revision<>p_expected_credit_revision then
    perform platform_private.reject_resource_command(v_begin.command_receipt_id,'audio_credit_revision_changed','Audio Credit attachments changed before they could be saved.',jsonb_build_object('publication_version_id',p_publication_version_id,'credit_revision',v_revision.credit_revision));
  else
    select * into v_actor from platform_private.command_actor_context();
    delete from editorial.resource_credits where resource_id=v_binding.resource_id and target_version_type='audio_publication_version' and target_version_id=p_publication_version_id;

    insert into editorial.resource_credits (
      resource_id,resource_kind,target_version_type,target_version_id,credit_id,
      display_order,is_primary,public_safe,created_by
    )
    select
      v_binding.resource_id,v_binding.resource_kind,'audio_publication_version',p_publication_version_id,
      (row.item->>'credit_id')::uuid,row.ordinality::integer-1,
      coalesce((row.item->>'is_primary')::boolean,false),
      coalesce((row.item->>'public_safe')::boolean,false),v_actor.actor_user_id
    from jsonb_array_elements(coalesce(p_attachments,'[]'::jsonb)) with ordinality row(item,ordinality);

    get diagnostics v_count=row_count;
    update editorial.audio_publication_version_trust_revisions as trust_revision
    set credit_revision=trust_revision.credit_revision+1,updated_by=v_actor.actor_user_id,updated_at=now()
    where trust_revision.publication_version_id=p_publication_version_id returning * into v_revision;

    v_result:=jsonb_build_object('publication_version_id',p_publication_version_id,'credit_revision',v_revision.credit_revision,'attachment_count',v_count,'correlation_id',v_correlation);
    perform platform_private.complete_resource_command(v_begin.command_receipt_id,v_result);
  end if;

  select * into v_read from platform_private.read_authenticated_resource_command_result(v_begin.command_receipt_id,false);
  command_receipt_id:=v_read.command_receipt_id; receipt_status:=v_read.receipt_status; publication_version_id:=p_publication_version_id;
  credit_revision:=coalesce(nullif(v_read.result_payload->>'credit_revision','')::bigint,v_revision.credit_revision);
  attachment_count:=coalesce(nullif(v_read.result_payload->>'attachment_count','')::integer,0); result_payload:=v_read.result_payload; idempotent_replay:=false; return next;
end;
$function$;

create function public.list_admin_audio_publications()
returns jsonb
language plpgsql
stable
security definer
set search_path = pg_catalog, auth, public, editorial, audio
as $function$
declare
  v_actor uuid := auth.uid();
begin
  if v_actor is null then raise exception 'Not authenticated'; end if;
  if not (
    public.current_user_has_capability('view_audio')
    or public.current_user_has_capability('edit_own_audio')
    or public.current_user_has_capability('edit_others_audio')
  ) then raise exception using errcode='42501',message='Audio access is required.'; end if;

  return jsonb_build_object(
    'shows', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id',s.id,'title',s.title,'slug',s.slug,'description',s.description,
        'authority_revision',s.authority_revision
      ) order by lower(s.title),s.id)
      from audio.shows s
      join editorial.audio_show_resources binding
        on binding.show_id = s.id
      join editorial.resources resource_row
        on resource_row.id = binding.resource_id
      where public.current_user_has_capability('view_audio')
         or public.current_user_has_capability('edit_others_audio')
         or (
           public.current_user_has_capability('edit_own_audio')
           and resource_row.owner_id = v_actor
         )
    ),'[]'::jsonb),
    'seasons', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id',se.id,'show_id',se.show_id,'season_number',se.season_number,
        'title',se.title,'authority_revision',se.authority_revision
      ) order by se.show_id,se.season_number,se.id)
      from audio.seasons se
      join editorial.audio_season_resources binding
        on binding.season_id = se.id
      join editorial.resources resource_row
        on resource_row.id = binding.resource_id
      where public.current_user_has_capability('view_audio')
         or public.current_user_has_capability('edit_others_audio')
         or (
           public.current_user_has_capability('edit_own_audio')
           and resource_row.owner_id = v_actor
         )
    ),'[]'::jsonb),
    'publications', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id',p.id,'publication_kind',p.publication_kind,'show_id',p.show_id,'season_id',p.season_id,
        'episode_number',p.episode_number,'title',p.title,'slug',p.slug,'summary',p.summary,
        'status',p.status,'authority_revision',p.authority_revision,'updated_at',p.updated_at
      ) order by p.updated_at desc,p.id)
      from audio.publications p
      join editorial.audio_publication_resources binding
        on binding.publication_id = p.id
      join editorial.resources resource_row
        on resource_row.id = binding.resource_id
      where public.current_user_has_capability('view_audio')
         or public.current_user_has_capability('edit_others_audio')
         or (
           public.current_user_has_capability('edit_own_audio')
           and resource_row.owner_id = v_actor
         )
    ),'[]'::jsonb)
  );
end;
$function$;

create function public.get_admin_audio_publication_workspace(
  p_publication_id uuid
)
returns jsonb
language plpgsql
stable
security definer
set search_path = pg_catalog, auth, public, editorial, audio, media
as $function$
declare
  v_actor uuid := auth.uid();
  v_binding editorial.audio_publication_resources%rowtype;
begin
  if v_actor is null then raise exception 'Not authenticated'; end if;

  select * into v_binding
  from editorial.audio_publication_resources
  where publication_id=p_publication_id;

  if not found then raise exception 'Audio publication Resource binding does not exist.'; end if;

  if not (
    public.current_user_has_capability('view_audio')
    or editorial.current_user_can_edit_audio(v_binding.resource_id)
  ) then raise exception using errcode='42501',message='Audio access is required.'; end if;

  return jsonb_build_object(
    'publication', (
      select jsonb_build_object(
        'id',p.id,'publication_kind',p.publication_kind,'show_id',p.show_id,'season_id',p.season_id,
        'episode_number',p.episode_number,'title',p.title,'slug',p.slug,'summary',p.summary,
        'status',p.status,'authority_revision',p.authority_revision,'metadata',p.metadata,
        'created_at',p.created_at,'updated_at',p.updated_at
      )
      from audio.publications p where p.id=p_publication_id
    ),
    'resource_id',v_binding.resource_id,
    'versions',jsonb_build_object(
      'working',v_binding.current_working_version_id,
      'submitted',v_binding.current_submitted_version_id,
      'approved',v_binding.current_approved_version_id,
      'published',v_binding.current_published_version_id
    ),
    'master',(
      select jsonb_build_object(
        'usage_link_id',m.usage_link_id,'asset_id',m.asset_id,'asset_revision_id',m.asset_revision_id,
        'audio_delivery_variant_id',m.audio_delivery_variant_id
      )
      from audio.current_publication_master(p_publication_id) m
    ),
    'transcript',(
      select jsonb_build_object('usage_link_id',t.usage_link_id,'asset_id',t.asset_id,'asset_revision_id',t.asset_revision_id)
      from audio.current_publication_transcript(p_publication_id) t
    ),
    'chapters',coalesce((
      select jsonb_agg(jsonb_build_object(
        'id',c.id,'chapter_number',c.chapter_number,'start_seconds',c.start_seconds,
        'title',c.title,'chapter_url',c.chapter_url,'image_url',c.image_url
      ) order by c.chapter_number)
      from audio.publication_chapters c where c.publication_id=p_publication_id
    ),'[]'::jsonb),
    'review_events',coalesce((
      select jsonb_agg(jsonb_build_object(
        'id',e.id,'event_number',e.event_number,'action',e.action,'target_version_id',e.target_version_id,
        'result_version_id',e.result_version_id,'prior_status',e.prior_status,'resulting_status',e.resulting_status,
        'reason',e.reason,'actor_id',e.actor_id,'created_at',e.created_at
      ) order by e.event_number)
      from audio.publication_review_events e where e.publication_id=p_publication_id
    ),'[]'::jsonb),
    'trust',(
      select jsonb_build_object(
        'citation_revision',coalesce(r.citation_revision,1),
        'credit_revision',coalesce(r.credit_revision,1),
        'citations',coalesce((
          select jsonb_agg(jsonb_build_object(
            'attachment_id',a.id,'citation_id',a.citation_id,'citation_purpose',a.citation_purpose,
            'target_anchor_type',a.target_anchor_type,'target_anchor_data',a.target_anchor_data,
            'display_order',a.display_order,'public_safe',a.public_safe,
            'public_label',c.public_label,'quotation',c.quotation,'citation_state',c.citation_state
          ) order by a.display_order,a.id)
          from editorial.resource_citations a join editorial.citations c on c.id=a.citation_id
          where a.resource_id=v_binding.resource_id
            and a.target_version_type='audio_publication_version'
            and a.target_version_id=v_binding.current_working_version_id
        ),'[]'::jsonb),
        'credits',coalesce((
          select jsonb_agg(jsonb_build_object(
            'attachment_id',a.id,'credit_id',a.credit_id,'display_order',a.display_order,
            'is_primary',a.is_primary,'public_safe',a.public_safe,
            'credit_role',c.credit_role,'display_name',c.display_name_snapshot,
            'role_label',c.role_label_snapshot
          ) order by a.display_order,a.id)
          from editorial.resource_credits a join editorial.credits c on c.id=a.credit_id
          where a.resource_id=v_binding.resource_id
            and a.target_version_type='audio_publication_version'
            and a.target_version_id=v_binding.current_working_version_id
        ),'[]'::jsonb)
      )
      from (select 1) seed
      left join editorial.audio_publication_version_trust_revisions r
        on r.publication_version_id=v_binding.current_working_version_id
    ),
    'feed_identity',(
      select jsonb_build_object('guid',f.guid,'enclosure_url',f.enclosure_url)
      from audio.publication_feed_identities f where f.publication_id=p_publication_id
    ),
    'can_edit',editorial.current_user_can_edit_audio(v_binding.resource_id),
    'can_manage_review',public.current_user_has_capability('manage_review_queue'),
    'can_publish',editorial.current_user_can_publish_audio(v_binding.resource_id)
  );
end;
$function$;

-- Internal helpers are callable only through their owning governed command paths.
revoke all on function platform_private.guard_audio_transcript_usage_mutation()
from public, anon, authenticated, service_role;
revoke all on function platform_private.guard_audio_chapter_mutation()
from public, anon, authenticated, service_role;
revoke all on function platform_private.begin_audio_trust_copy_authorization(uuid,uuid)
from public, anon, authenticated, service_role;
revoke all on function platform_private.end_audio_trust_copy_authorization(uuid)
from public, anon, authenticated, service_role;
revoke all on function audio.current_publication_transcript(uuid)
from public, anon, authenticated, service_role;
revoke all on function audio.enforce_publication_version_transcript_integrity()
from public, anon, authenticated, service_role;
revoke all on function audio.prevent_publication_version_chapter_mutation()
from public, anon, authenticated, service_role;
revoke all on function editorial.prevent_immutable_audio_trust_mutation()
from public, anon, authenticated, service_role;
revoke all on function editorial.copy_audio_version_trust_to_version(uuid,uuid)
from public, anon, authenticated, service_role;

-- Public-schema SECURITY DEFINER endpoints must not inherit PostgreSQL's
-- default PUBLIC execute privilege. Expose only to authenticated callers and
-- service-role automation; every endpoint still performs capability checks.
revoke all on function public.list_admin_audio_publications()
from public, anon;
revoke all on function public.get_admin_audio_publication_workspace(uuid)
from public, anon;
revoke all on function public.set_audio_publication_transcript(uuid,bigint,uuid,uuid,text,uuid)
from public, anon;
revoke all on function public.replace_audio_publication_chapters(uuid,bigint,jsonb,text,uuid)
from public, anon;
revoke all on function public.replace_audio_publication_version_citations(uuid,jsonb,bigint,text,uuid)
from public, anon;
revoke all on function public.replace_audio_publication_version_credits(uuid,jsonb,bigint,text,uuid)
from public, anon;

grant execute on function public.list_admin_audio_publications() to authenticated, service_role;
grant execute on function public.get_admin_audio_publication_workspace(uuid) to authenticated, service_role;
grant execute on function public.set_audio_publication_transcript(uuid,bigint,uuid,uuid,text,uuid) to authenticated, service_role;
grant execute on function public.replace_audio_publication_chapters(uuid,bigint,jsonb,text,uuid) to authenticated, service_role;
grant execute on function public.replace_audio_publication_version_citations(uuid,jsonb,bigint,text,uuid) to authenticated, service_role;
grant execute on function public.replace_audio_publication_version_credits(uuid,jsonb,bigint,text,uuid) to authenticated, service_role;

comment on function public.list_admin_audio_publications() is
  'Authenticated capability-scoped Audio Editor list read model.';
comment on function public.get_admin_audio_publication_workspace(uuid) is
  'Authenticated capability-scoped canonical Audio Editor workspace read model.';

commit;
