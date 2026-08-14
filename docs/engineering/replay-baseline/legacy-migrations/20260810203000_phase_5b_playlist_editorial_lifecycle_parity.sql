-- Phase 5B M232: Playlist editorial lifecycle parity and governed Curator authority.
--
-- Adds the missing Playlist lifecycle primitives needed by the shared editorial
-- editor while preserving existing Playlist, Registry, Media, Trust, Review,
-- playback, and publication authority.
--
-- M232 is intentionally additive. It does not redesign the frontend.

begin;

do $phase_5b_m232_preflight$
declare
  v_playlist_id uuid;
  v_resource_id uuid;
  v_published_version_id uuid;
  v_top50_version_count bigint;
  v_top50_credit_count bigint;
  v_existing_playlist_curator_credit_count bigint;
  v_hafare_count bigint;
begin
  if to_regclass('public.wk_playlists') is null
     or to_regclass('editorial.playlist_resources') is null
     or to_regclass('editorial.playlist_versions') is null
     or to_regclass('editorial.playlist_version_items') is null
     or to_regclass('editorial.playlist_version_trust_revisions') is null
     or to_regclass('editorial.playlist_publication_snapshots') is null
     or to_regclass('editorial.resource_credits') is null
     or to_regclass('editorial.credits') is null
     or to_regclass('editorial.credit_governance') is null
     or to_regclass('editorial.credit_roles') is null
     or to_regclass('public.registry_authors') is null
     or to_regclass('public.user_profiles') is null
  then
    raise exception
      'STOP: Required Playlist, Trust, or identity authority is incomplete';
  end if;

  if to_regprocedure(
       'platform_private.begin_authenticated_resource_command(text,uuid,text,jsonb)'
     ) is null
     or to_regprocedure(
       'platform_private.complete_resource_command(uuid,jsonb)'
     ) is null
     or to_regprocedure(
       'platform_private.reject_resource_command(uuid,text,text,jsonb)'
     ) is null
     or to_regprocedure(
       'editorial.current_user_can_edit_playlist(uuid)'
     ) is null
     or to_regprocedure(
       'editorial.current_user_can_publish_playlist(uuid)'
     ) is null
     or to_regprocedure(
       'editorial.playlist_current_content_fingerprint(uuid)'
     ) is null
     or to_regprocedure(
       'editorial.playlist_version_snapshot_json(uuid)'
     ) is null
     or to_regprocedure(
       'editorial.materialize_playlist_publication_snapshot(uuid,timestamp with time zone,uuid,uuid)'
     ) is null
  then
    raise exception
      'STOP: Required Playlist command or publication helpers are incomplete';
  end if;

  if not exists (
    select 1
    from public.capability_definitions
    where capability_key = 'publish_playlists'
  ) or not exists (
    select 1
    from public.capability_definitions
    where capability_key = 'delete_playlists'
  ) then
    raise exception
      'STOP: Required Playlist capabilities are missing';
  end if;

  if not exists (
    select 1
    from editorial.credit_roles
    where credit_role = 'curator'
      and enabled
  ) then
    raise exception
      'STOP: Enabled Curator Credit role is missing';
  end if;

  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'wk_playlists'
      and column_name = 'curator_credit_id'
  ) then
    raise exception
      'STOP: wk_playlists.curator_credit_id already exists';
  end if;

  if to_regclass('editorial.playlist_scheduled_publications') is not null
     or to_regclass('editorial.playlist_lifecycle_events') is not null
     or to_regclass('public.wk_playlist_preview_links') is not null
  then
    raise exception
      'STOP: One or more M232 lifecycle tables already exist';
  end if;

  if exists (
    select 1
    from platform_private.command_types
    where command_type in (
      'playlist.curator.set',
      'playlist.schedule',
      'playlist.unschedule',
      'playlist.unpublish',
      'playlist.archive',
      'playlist.restore'
    )
  ) then
    raise exception
      'STOP: One or more M232 command types already exist';
  end if;

  if to_regprocedure(
       'public.set_playlist_curator(uuid,bigint,uuid,uuid,text,uuid)'
     ) is not null
     or to_regprocedure(
       'public.schedule_playlist_publication(uuid,bigint,uuid,timestamp with time zone,text,text,uuid)'
     ) is not null
     or to_regprocedure(
       'public.unschedule_playlist_publication(uuid,bigint,text,text,uuid)'
     ) is not null
     or to_regprocedure(
       'public.publish_due_playlist_publications(integer)'
     ) is not null
     or to_regprocedure(
       'public.unpublish_playlist(uuid,bigint,text,text,uuid)'
     ) is not null
     or to_regprocedure(
       'public.archive_playlist(uuid,bigint,text,text,uuid)'
     ) is not null
     or to_regprocedure(
       'public.restore_playlist_from_archive(uuid,bigint,text,text,uuid)'
     ) is not null
     or to_regprocedure(
       'public.create_playlist_preview_link(uuid,uuid,timestamp with time zone)'
     ) is not null
     or to_regprocedure(
       'public.resolve_playlist_preview_nonce(text)'
     ) is not null
  then
    raise exception
      'STOP: One or more M232 public functions already exist';
  end if;

  select
    playlist.id,
    binding.resource_id,
    binding.current_published_version_id
  into
    v_playlist_id,
    v_resource_id,
    v_published_version_id
  from public.wk_playlists playlist
  join editorial.playlist_resources binding
    on binding.playlist_id = playlist.id
  where playlist.slug = 'top-50-kenyan-songs-of-2025'
    and playlist.title = 'Top 50 Kenyan Songs Of 2025'
    and playlist.status = 'published'
    and playlist.authority_revision = 54
    and playlist.curator_label = 'Hafare Segelan';

  if v_playlist_id is null
     or v_resource_id is null
     or v_published_version_id is null
  then
    raise exception
      'STOP: Top 50 accepted publication identity no longer matches';
  end if;

  if not exists (
    select 1
    from editorial.playlist_versions version
    where version.id = v_published_version_id
      and version.playlist_id = v_playlist_id
      and version.resource_id = v_resource_id
      and version.version_kind = 'published'
      and version.content_fingerprint =
        '59e4c0e4320357750ca71981e27ecfa89e3a7aef4074efe5f3453d63d0f548b7'
      and version.item_count = 50
  ) then
    raise exception
      'STOP: Top 50 published version no longer matches accepted fingerprint';
  end if;

  select count(*)
  into v_top50_version_count
  from editorial.playlist_versions version
  where version.playlist_id = v_playlist_id
    and version.resource_id = v_resource_id
    and version.version_kind in (
      'submitted',
      'approved',
      'published'
    )
    and version.content_fingerprint =
      '59e4c0e4320357750ca71981e27ecfa89e3a7aef4074efe5f3453d63d0f548b7'
    and version.item_count = 50;

  if v_top50_version_count <> 3 then
    raise exception
      'STOP: Expected three accepted Top 50 immutable versions, found %',
      v_top50_version_count;
  end if;

  select count(*)
  into v_top50_credit_count
  from editorial.resource_credits attachment
  join editorial.playlist_versions version
    on version.id = attachment.target_version_id
  where version.playlist_id = v_playlist_id
    and attachment.target_version_type = 'playlist_version';

  if v_top50_credit_count <> 0 then
    raise exception
      'STOP: Top 50 acquired Playlist Credits after the accepted audit';
  end if;

  select count(*)
  into v_existing_playlist_curator_credit_count
  from editorial.resource_credits attachment
  join editorial.playlist_versions version
    on version.id = attachment.target_version_id
  join editorial.credits credit
    on credit.id = attachment.credit_id
  where attachment.target_version_type = 'playlist_version'
    and attachment.resource_kind = 'playlist'
    and credit.credit_role = 'curator';

  if v_existing_playlist_curator_credit_count <> 0 then
    raise exception
      'STOP: Existing Playlist Curator attachments require explicit durable-identity convergence before M232';
  end if;

  select count(*)
  into v_hafare_count
  from public.registry_authors author_record
  where author_record.id =
          'c318a8c5-3ad8-4adc-9991-953ab24e7da6'::uuid
    and author_record.slug = 'hafare-segelan'
    and author_record.name = 'Hafare Segelan';

  if v_hafare_count <> 1 then
    raise exception
      'STOP: Hafare Segelan Registry Author no longer matches accepted identity';
  end if;
end;
$phase_5b_m232_preflight$;

-- RLS hardening. These tables already deny anon/authenticated direct mutation
-- through grants. Existing security-definer RPCs remain the application path.

alter table editorial.article_lifecycle_events
  enable row level security;

alter table editorial.article_scheduled_publications
  enable row level security;

alter table editorial.playlist_item_resources
  enable row level security;

alter table editorial.playlist_versions
  enable row level security;

alter table editorial.playlist_version_items
  enable row level security;

alter table editorial.playlist_version_trust_revisions
  enable row level security;

-- Durable Curator Credit identity. curator_label remains a temporary display
-- cache for backward compatibility until the Playlist editor cutover removes
-- free-text curator editing.

alter table public.wk_playlists
  add column curator_credit_id uuid;

alter table public.wk_playlists
  add constraint wk_playlists_curator_credit_fkey
  foreign key (curator_credit_id)
  references editorial.credits(id)
  on delete restrict;

create index wk_playlists_curator_credit_idx
  on public.wk_playlists(curator_credit_id)
  where curator_credit_id is not null;

comment on column public.wk_playlists.curator_credit_id is
  'Governed Curator Credit selected for the Playlist. curator_label is a compatibility display cache.';

create or replace function
  editorial.assert_playlist_curator_credit(
    p_credit_id uuid
  )
returns table(
  credit_id uuid,
  display_name text,
  registry_author_slug text,
  user_username text
)
language plpgsql
stable
security definer
set search_path to
  'pg_catalog',
  'public',
  'editorial'
as $function$
begin
  return query
  select
    credit.id,
    credit.display_name_snapshot,
    credit.registry_author_slug_snapshot,
    credit.user_username_snapshot
  from editorial.credits credit
  join editorial.credit_governance governance
    on governance.credit_id = credit.id
  where credit.id = p_credit_id
    and credit.credit_role = 'curator'
    and credit.external_contributor_id is null
    and num_nonnulls(
          credit.user_id,
          credit.registry_author_id
        ) = 1
    and governance.credit_state = 'active'
    and governance.public_safe
    and nullif(
          btrim(credit.display_name_snapshot),
          ''
        ) is not null;

  if not found then
    raise exception
      'Choose an active public Curator linked to a WAKILISHA user or Registry Author';
  end if;
end;
$function$;

revoke all
on function editorial.assert_playlist_curator_credit(uuid)
from public, anon, authenticated;

create or replace function
  editorial.resolve_playlist_curator_credit(
    p_registry_author_id uuid,
    p_user_id uuid,
    p_actor_id uuid
  )
returns table(
  credit_id uuid,
  display_name text,
  registry_author_slug text,
  user_username text
)
language plpgsql
security definer
set search_path to
  'pg_catalog',
  'public',
  'editorial'
as $function$
declare
  v_display_name text;
  v_registry_author_slug text;
  v_user_username text;
  v_credit_id uuid;
begin
  if num_nonnulls(
       p_registry_author_id,
       p_user_id
     ) <> 1
  then
    raise exception
      'Choose exactly one Curator identity';
  end if;

  if p_registry_author_id is not null then
    select
      nullif(btrim(author_record.name), ''),
      nullif(btrim(author_record.slug), '')
    into
      v_display_name,
      v_registry_author_slug
    from public.registry_authors author_record
    where author_record.id = p_registry_author_id;

    if not found
       or v_display_name is null
       or v_registry_author_slug is null
    then
      raise exception
        'Registry Author is missing or incomplete';
    end if;

    select credit.id
    into v_credit_id
    from editorial.credits credit
    join editorial.credit_governance governance
      on governance.credit_id = credit.id
    where credit.credit_role = 'curator'
      and credit.registry_author_id =
            p_registry_author_id
      and credit.registry_author_slug_snapshot =
            v_registry_author_slug
      and credit.display_name_snapshot =
            v_display_name
      and governance.credit_state = 'active'
      and governance.public_safe
    order by credit.created_at, credit.id
    limit 1;

  else
    select
      nullif(btrim(profile.display_name), ''),
      nullif(btrim(profile.username), '')
    into
      v_display_name,
      v_user_username
    from public.user_profiles profile
    where profile.user_id = p_user_id
      and profile.status = 'active'
      and profile.is_public;

    if not found
       or v_display_name is null
    then
      raise exception
        'Active WAKILISHA user profile with a display name was not found';
    end if;

    select credit.id
    into v_credit_id
    from editorial.credits credit
    join editorial.credit_governance governance
      on governance.credit_id = credit.id
    where credit.credit_role = 'curator'
      and credit.user_id = p_user_id
      and credit.user_username_snapshot
            is not distinct from
            v_user_username
      and credit.display_name_snapshot =
            v_display_name
      and governance.credit_state = 'active'
      and governance.public_safe
    order by credit.created_at, credit.id
    limit 1;
  end if;

  if v_credit_id is null then
    insert into editorial.credits (
      credit_role,
      user_id,
      registry_author_id,
      external_contributor_id,
      display_name_snapshot,
      role_label_snapshot,
      registry_author_slug_snapshot,
      user_username_snapshot,
      credit_note,
      created_by
    )
    values (
      'curator',
      p_user_id,
      p_registry_author_id,
      null,
      v_display_name,
      'Curator',
      v_registry_author_slug,
      v_user_username,
      null,
      p_actor_id
    )
    returning id
    into v_credit_id;

    insert into editorial.credit_governance (
      credit_id,
      public_safe,
      credit_state,
      governance_revision,
      reason,
      updated_by,
      updated_at
    )
    values (
      v_credit_id,
      true,
      'active',
      1,
      null,
      p_actor_id,
      now()
    );
  end if;

  credit_id := v_credit_id;
  display_name := v_display_name;
  registry_author_slug := v_registry_author_slug;
  user_username := v_user_username;
  return next;
end;
$function$;

revoke all
on function editorial.resolve_playlist_curator_credit(
  uuid,
  uuid,
  uuid
)
from public, anon, authenticated;

create or replace function
  editorial.enforce_playlist_curator_credit_identity()
returns trigger
language plpgsql
security definer
set search_path to
  'pg_catalog',
  'editorial'
as $function$
declare
  v_curator record;
begin
  if new.curator_credit_id is null then
    return new;
  end if;

  select
    credit.id as credit_id,
    credit.display_name_snapshot as display_name
  into v_curator
  from editorial.credits credit
  where credit.id = new.curator_credit_id;

  if not found then
    raise exception
      'Playlist Curator Credit no longer exists';
  end if;

  if tg_op = 'INSERT'
     or new.curator_credit_id
          is distinct from old.curator_credit_id
  then
    perform 1
    from editorial.assert_playlist_curator_credit(
      new.curator_credit_id
    );
  elsif new.curator_label
          is distinct from old.curator_label
        and new.curator_label
          is distinct from v_curator.display_name
  then
    raise exception
      'Use the Curator picker to change Playlist attribution';
  end if;

  new.curator_label := v_curator.display_name;
  return new;
end;
$function$;

revoke all
on function editorial.enforce_playlist_curator_credit_identity()
from public, anon, authenticated;

create trigger wk_playlists_curator_credit_identity
before insert or update of curator_credit_id, curator_label
on public.wk_playlists
for each row
execute function
  editorial.enforce_playlist_curator_credit_identity();

create or replace function
  editorial.enforce_playlist_curator_attachment_authority()
returns trigger
language plpgsql
security definer
set search_path to
  'pg_catalog',
  'public',
  'editorial'
as $function$
declare
  v_target_version_type text;
  v_resource_kind text;
  v_target_version_id uuid;
  v_resource_id uuid;
  v_credit_id uuid;
  v_credit_role text;
  v_playlist_id uuid;
  v_version_kind text;
  v_curator_credit_id uuid;
begin
  if tg_op = 'DELETE' then
    v_target_version_type := old.target_version_type;
    v_resource_kind := old.resource_kind;
    v_target_version_id := old.target_version_id;
    v_resource_id := old.resource_id;
    v_credit_id := old.credit_id;
  else
    v_target_version_type := new.target_version_type;
    v_resource_kind := new.resource_kind;
    v_target_version_id := new.target_version_id;
    v_resource_id := new.resource_id;
    v_credit_id := new.credit_id;
  end if;

  if v_target_version_type <> 'playlist_version'
     or v_resource_kind <> 'playlist'
  then
    if tg_op = 'DELETE' then
      return old;
    end if;
    return new;
  end if;

  select
    version.playlist_id,
    version.version_kind
  into
    v_playlist_id,
    v_version_kind
  from editorial.playlist_versions version
  where version.id = v_target_version_id
    and version.resource_id = v_resource_id;

  if v_playlist_id is null then
    raise exception
      'Playlist Curator attachment requires a valid Playlist version';
  end if;

  select playlist.curator_credit_id
  into v_curator_credit_id
  from public.wk_playlists playlist
  where playlist.id = v_playlist_id;

  select credit.credit_role
  into v_credit_role
  from editorial.credits credit
  where credit.id = v_credit_id;

  if v_credit_role is distinct from 'curator' then
    if tg_op = 'DELETE' then
      return old;
    end if;

    if tg_op = 'INSERT'
       and v_version_kind = 'working'
       and v_curator_credit_id is not null
    then
      new.display_order := new.display_order + 1;
    end if;

    return new;
  end if;

  if tg_op = 'DELETE' then
    if v_curator_credit_id is not null
       and v_credit_id = v_curator_credit_id
    then
      -- Generic Credit replacement deletes the requested target set before
      -- reinserting it. Preserve the durable Curator row so ordinary Credit
      -- editing can coexist with Playlist attribution.
      return null;
    end if;

    return old;
  end if;

  if v_curator_credit_id is null
     or v_credit_id is distinct from v_curator_credit_id
  then
    raise exception
      'Use the Playlist Curator picker before attaching Curator credit';
  end if;

  new.display_order := 0;
  new.is_primary := true;
  new.public_safe := true;

  return new;
end;
$function$;

revoke all
on function
  editorial.enforce_playlist_curator_attachment_authority()
from public, anon, authenticated;

create trigger resource_credits_playlist_curator_authority
before insert or update or delete
on editorial.resource_credits
for each row
execute function
  editorial.enforce_playlist_curator_attachment_authority();

-- Durable Curator identity is materialized first on the mutable working
-- snapshot. The existing immutable Trust-copy authorization then carries that
-- exact Credit through submitted, approved, scheduled, and published versions.

create or replace function
  editorial.attach_playlist_curator_to_working_snapshot()
returns trigger
language plpgsql
security definer
set search_path to
  'pg_catalog',
  'public',
  'editorial'
as $function$
declare
  v_version editorial.playlist_versions%rowtype;
  v_playlist public.wk_playlists%rowtype;
  v_curator record;
begin
  select version.*
  into v_version
  from editorial.playlist_versions version
  where version.id = new.playlist_version_id;

  if not found
     or v_version.version_kind <> 'working'
  then
    return new;
  end if;

  select playlist.*
  into v_playlist
  from public.wk_playlists playlist
  where playlist.id = v_version.playlist_id;

  if v_playlist.curator_credit_id is null then
    return new;
  end if;

  select *
  into v_curator
  from editorial.assert_playlist_curator_credit(
    v_playlist.curator_credit_id
  );

  insert into editorial.resource_credits (
    resource_id,
    resource_kind,
    target_version_type,
    target_version_id,
    credit_id,
    display_order,
    is_primary,
    public_safe,
    created_by
  )
  values (
    v_version.resource_id,
    'playlist',
    'playlist_version',
    v_version.id,
    v_curator.credit_id,
    0,
    true,
    true,
    new.updated_by
  )
  on conflict (
    target_version_id,
    resource_id,
    credit_id
  )
  do nothing;

  return new;
end;
$function$;

revoke all
on function
  editorial.attach_playlist_curator_to_working_snapshot()
from public, anon, authenticated;

create trigger playlist_working_snapshot_curator_credit
after insert
on editorial.playlist_version_trust_revisions
for each row
execute function
  editorial.attach_playlist_curator_to_working_snapshot();

create or replace function
  editorial.require_exact_working_snapshot_for_curated_submission()
returns trigger
language plpgsql
security definer
set search_path to
  'pg_catalog',
  'public',
  'editorial'
as $function$
declare
  v_curator_credit_id uuid;
begin
  if new.version_kind <> 'submitted' then
    return new;
  end if;

  select playlist.curator_credit_id
  into v_curator_credit_id
  from public.wk_playlists playlist
  where playlist.id = new.playlist_id;

  if v_curator_credit_id is null then
    return new;
  end if;

  if not exists (
    select 1
    from editorial.playlist_resources binding
    join editorial.playlist_versions working
      on working.id = binding.current_working_version_id
    join editorial.resource_credits attachment
      on attachment.target_version_type = 'playlist_version'
     and attachment.target_version_id = working.id
     and attachment.resource_id = working.resource_id
     and attachment.resource_kind = 'playlist'
     and attachment.credit_id = v_curator_credit_id
     and attachment.display_order = 0
     and attachment.is_primary
     and attachment.public_safe
    where binding.playlist_id = new.playlist_id
      and binding.resource_id = new.resource_id
      and working.version_kind = 'working'
      and working.content_fingerprint = new.content_fingerprint
      and working.item_count = new.item_count
      and working.source_authority_revision = new.source_authority_revision
  ) then
    raise exception
      'Save the Playlist before submitting for Review so Curator identity can be frozen';
  end if;

  return new;
end;
$function$;

revoke all
on function
  editorial.require_exact_working_snapshot_for_curated_submission()
from public, anon, authenticated;

create trigger playlist_curated_submission_requires_working
before insert
on editorial.playlist_versions
for each row
execute function
  editorial.require_exact_working_snapshot_for_curated_submission();

-- Working Trust copy carries the Curator from the exact working snapshot at
-- display order zero. Item-level Trust ordering is unchanged.

create or replace function
  editorial.copy_playlist_working_trust_to_version(
    p_resource_id uuid,
    p_source_working_version_id uuid,
    p_target_version_id uuid
  )
returns void
language plpgsql
security definer
set search_path to
  'pg_catalog',
  'editorial'
as $function$
declare
  v_copy_authorization uuid;
  v_target_curator_credit_id uuid;
  v_root_offset integer := 0;
begin
  if p_source_working_version_id is null then
    return;
  end if;

  select attachment.credit_id
  into v_target_curator_credit_id
  from editorial.resource_credits attachment
  join editorial.credits credit
    on credit.id = attachment.credit_id
  where attachment.target_version_type =
          'playlist_version'
    and attachment.target_version_id =
          p_target_version_id
    and attachment.resource_id =
          p_resource_id
    and attachment.resource_kind = 'playlist'
    and credit.credit_role = 'curator'
  order by attachment.display_order, attachment.id
  limit 1;

  if v_target_curator_credit_id is not null then
    v_root_offset := 1;
  end if;

  v_copy_authorization :=
    platform_private.begin_playlist_trust_copy_authorization(
      p_source_working_version_id,
      p_target_version_id
    );

  insert into editorial.resource_citations (
    resource_id,
    resource_kind,
    target_version_type,
    target_version_id,
    citation_id,
    citation_purpose,
    target_anchor_type,
    target_anchor_data,
    display_order,
    public_safe,
    created_by
  )
  select
    citation.resource_id,
    citation.resource_kind,
    'playlist_version',
    p_target_version_id,
    citation.citation_id,
    citation.citation_purpose,
    citation.target_anchor_type,
    citation.target_anchor_data,
    citation.display_order,
    citation.public_safe,
    citation.created_by
  from editorial.resource_citations citation
  where citation.target_version_type =
          'playlist_version'
    and citation.target_version_id =
          p_source_working_version_id
    and (
      (
        citation.resource_kind = 'playlist'
        and citation.resource_id = p_resource_id
      )
      or (
        citation.resource_kind = 'playlist_item'
        and exists (
          select 1
          from editorial.playlist_version_items item
          where item.playlist_version_id =
                  p_target_version_id
            and item.playlist_item_resource_id =
                  citation.resource_id
        )
      )
    );

  insert into editorial.resource_credits (
    resource_id,
    resource_kind,
    target_version_type,
    target_version_id,
    credit_id,
    display_order,
    is_primary,
    public_safe,
    created_by
  )
  select
    root_credit.resource_id,
    root_credit.resource_kind,
    'playlist_version',
    p_target_version_id,
    root_credit.credit_id,
    v_root_offset
      + (
          row_number() over (
            order by
              root_credit.display_order,
              root_credit.id
          )
        )::integer
      - 1,
    root_credit.is_primary,
    root_credit.public_safe,
    root_credit.created_by
  from editorial.resource_credits root_credit
  where root_credit.target_version_type =
          'playlist_version'
    and root_credit.target_version_id =
          p_source_working_version_id
    and root_credit.resource_kind = 'playlist'
    and root_credit.resource_id = p_resource_id
    and (
      v_target_curator_credit_id is null
      or root_credit.credit_id <>
           v_target_curator_credit_id
    )
  order by
    root_credit.display_order,
    root_credit.id;

  insert into editorial.resource_credits (
    resource_id,
    resource_kind,
    target_version_type,
    target_version_id,
    credit_id,
    display_order,
    is_primary,
    public_safe,
    created_by
  )
  select
    item_credit.resource_id,
    item_credit.resource_kind,
    'playlist_version',
    p_target_version_id,
    item_credit.credit_id,
    item_credit.display_order,
    item_credit.is_primary,
    item_credit.public_safe,
    item_credit.created_by
  from editorial.resource_credits item_credit
  where item_credit.target_version_type =
          'playlist_version'
    and item_credit.target_version_id =
          p_source_working_version_id
    and item_credit.resource_kind =
          'playlist_item'
    and exists (
      select 1
      from editorial.playlist_version_items item
      where item.playlist_version_id =
              p_target_version_id
        and item.playlist_item_resource_id =
              item_credit.resource_id
    );

  perform
    platform_private.end_playlist_trust_copy_authorization(
      v_copy_authorization
    );
end;
$function$;

revoke all
on function
  editorial.copy_playlist_working_trust_to_version(
    uuid,
    uuid,
    uuid
  )
from public, anon, authenticated;

-- Governed lifecycle command vocabulary.

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
    'playlist.curator.set',
    'playlist.curator.set.sync',
    'playlist.curator.set.accepted',
    'playlist.curator.set.succeeded',
    'playlist.curator.set.failed',
    'playlist.curator.set.retry_scheduled',
    true
  ),
  (
    'playlist.schedule',
    'playlist.schedule.sync',
    'playlist.schedule.accepted',
    'playlist.schedule.succeeded',
    'playlist.schedule.failed',
    'playlist.schedule.retry_scheduled',
    true
  ),
  (
    'playlist.unschedule',
    'playlist.unschedule.sync',
    'playlist.unschedule.accepted',
    'playlist.unschedule.succeeded',
    'playlist.unschedule.failed',
    'playlist.unschedule.retry_scheduled',
    true
  ),
  (
    'playlist.unpublish',
    'playlist.unpublish.sync',
    'playlist.unpublish.accepted',
    'playlist.unpublish.succeeded',
    'playlist.unpublish.failed',
    'playlist.unpublish.retry_scheduled',
    true
  ),
  (
    'playlist.archive',
    'playlist.archive.sync',
    'playlist.archive.accepted',
    'playlist.archive.succeeded',
    'playlist.archive.failed',
    'playlist.archive.retry_scheduled',
    true
  ),
  (
    'playlist.restore',
    'playlist.restore.sync',
    'playlist.restore.accepted',
    'playlist.restore.succeeded',
    'playlist.restore.failed',
    'playlist.restore.retry_scheduled',
    true
  );

-- Selecting a Curator uses Playlist edit authority and resolves or creates the
-- narrow shared Curator Credit internally. Writers/authors do not need global
-- manage_credits authority just to attribute the Playlist they can edit.

create or replace function
  public.set_playlist_curator(
    p_playlist_id uuid,
    p_expected_authority_revision bigint,
    p_registry_author_id uuid,
    p_user_id uuid,
    p_idempotency_key text,
    p_correlation_id uuid default null
  )
returns table(
  command_receipt_id uuid,
  receipt_status text,
  playlist_id uuid,
  resource_id uuid,
  authority_revision bigint,
  curator_credit_id uuid,
  curator_label text,
  lifecycle_status text,
  result_payload jsonb,
  idempotent_replay boolean
)
language plpgsql
security definer
set search_path to
  'pg_catalog',
  'public',
  'auth',
  'editorial',
  'platform_private'
as $function$
declare
  v_actor uuid := auth.uid();
  v_playlist public.wk_playlists%rowtype;
  v_resource_id uuid;
  v_curator record;
  v_credit_id uuid;
  v_display_name text;
  v_changed boolean := false;
  v_begin record;
  v_read record;
  v_result jsonb;
  v_correlation_id uuid :=
    coalesce(
      p_correlation_id,
      gen_random_uuid()
    );
begin
  if v_actor is null then
    raise exception 'Not authenticated';
  end if;

  if num_nonnulls(
       p_registry_author_id,
       p_user_id
     ) > 1
  then
    raise exception
      'Choose one Curator identity';
  end if;

  select playlist.*
  into v_playlist
  from public.wk_playlists playlist
  where playlist.id = p_playlist_id
  for update;

  if not found then
    raise exception 'Playlist does not exist';
  end if;

  select binding.resource_id
  into v_resource_id
  from editorial.playlist_resources binding
  where binding.playlist_id = p_playlist_id;

  if v_resource_id is null then
    raise exception
      'Playlist Resource binding does not exist';
  end if;

  if not editorial.current_user_can_edit_playlist(
    v_resource_id
  ) then
    raise exception
      'Playlist edit permission is required';
  end if;

  select *
  into v_begin
  from platform_private.begin_authenticated_resource_command(
    'playlist.curator.set',
    v_resource_id,
    p_idempotency_key,
    jsonb_build_object(
      'playlist_id',
        p_playlist_id,
      'expected_authority_revision',
        p_expected_authority_revision,
      'registry_author_id',
        p_registry_author_id,
      'user_id',
        p_user_id,
      'correlation_id',
        v_correlation_id
    )
  );

  if v_begin.idempotent_replay then
    select *
    into v_read
    from platform_private.read_authenticated_resource_command_result(
      v_begin.command_receipt_id,
      true
    );

    command_receipt_id :=
      v_read.command_receipt_id;
    receipt_status :=
      v_read.receipt_status;
    playlist_id := p_playlist_id;
    resource_id := v_read.resource_id;
    authority_revision :=
      nullif(
        v_read.result_payload
          ->> 'authority_revision',
        ''
      )::bigint;
    curator_credit_id :=
      nullif(
        v_read.result_payload
          ->> 'curator_credit_id',
        ''
      )::uuid;
    curator_label :=
      nullif(
        v_read.result_payload
          ->> 'curator_label',
        ''
      );
    lifecycle_status :=
      v_read.result_payload
        ->> 'lifecycle_status';
    result_payload :=
      v_read.result_payload;
    idempotent_replay := true;
    return next;
    return;
  end if;

  if p_expected_authority_revision is null
     or p_expected_authority_revision < 1
     or v_playlist.authority_revision
          <> p_expected_authority_revision
  then
    perform platform_private.reject_resource_command(
      v_begin.command_receipt_id,
      'playlist_revision_changed',
      'The Playlist changed before the Curator could be updated.',
      jsonb_build_object(
        'playlist_id',
          p_playlist_id,
        'authority_revision',
          v_playlist.authority_revision,
        'lifecycle_status',
          v_playlist.status
      )
    );
  else
    if num_nonnulls(
         p_registry_author_id,
         p_user_id
       ) = 1
    then
      select *
      into v_curator
      from editorial.resolve_playlist_curator_credit(
        p_registry_author_id,
        p_user_id,
        v_actor
      );

      v_credit_id := v_curator.credit_id;
      v_display_name := v_curator.display_name;
    else
      v_credit_id := null;
      v_display_name := null;
    end if;

    v_changed :=
      v_playlist.curator_credit_id
        is distinct from v_credit_id
      or v_playlist.curator_label
        is distinct from v_display_name;

    if v_changed then
      update public.wk_playlists playlist
      set
        curator_credit_id = v_credit_id,
        curator_label = v_display_name,
        authority_revision =
          playlist.authority_revision + 1
      where playlist.id = p_playlist_id
      returning playlist.*
      into v_playlist;
    end if;

    v_result := jsonb_build_object(
      'playlist_id',
        p_playlist_id,
      'resource_id',
        v_resource_id,
      'authority_revision',
        v_playlist.authority_revision,
      'curator_credit_id',
        v_playlist.curator_credit_id,
      'curator_label',
        v_playlist.curator_label,
      'lifecycle_status',
        v_playlist.status,
      'changed',
        v_changed,
      'correlation_id',
        v_correlation_id
    );

    perform platform_private.complete_resource_command(
      v_begin.command_receipt_id,
      v_result
    );
  end if;

  select *
  into v_read
  from platform_private.read_authenticated_resource_command_result(
    v_begin.command_receipt_id,
    false
  );

  command_receipt_id :=
    v_read.command_receipt_id;
  receipt_status :=
    v_read.receipt_status;
  playlist_id := p_playlist_id;
  resource_id := v_read.resource_id;
  authority_revision :=
    nullif(
      v_read.result_payload
        ->> 'authority_revision',
      ''
    )::bigint;
  curator_credit_id :=
    nullif(
      v_read.result_payload
        ->> 'curator_credit_id',
      ''
    )::uuid;
  curator_label :=
    nullif(
      v_read.result_payload
        ->> 'curator_label',
      ''
    );
  lifecycle_status :=
    v_read.result_payload
      ->> 'lifecycle_status';
  result_payload :=
    v_read.result_payload;
  idempotent_replay := false;
  return next;
end;
$function$;

revoke all
on function public.set_playlist_curator(
  uuid,
  bigint,
  uuid,
  uuid,
  text,
  uuid
)
from public, anon;

grant execute
on function public.set_playlist_curator(
  uuid,
  bigint,
  uuid,
  uuid,
  text,
  uuid
)
to authenticated;

-- Scheduled immutable Playlist versions.

alter table editorial.playlist_versions
  drop constraint playlist_versions_kind_check;

alter table editorial.playlist_versions
  add constraint playlist_versions_kind_check
  check (
    version_kind in (
      'working',
      'submitted',
      'approved',
      'scheduled',
      'published'
    )
  );

create or replace function
  editorial.protect_playlist_immutable_trust_attachment()
returns trigger
language plpgsql
security invoker
set search_path to
  'pg_catalog',
  'editorial'
as $function$
declare
  v_version_kind text;
begin
  if old.target_version_type <> 'playlist_version'
  then
    if tg_op = 'DELETE' then
      return old;
    end if;

    return new;
  end if;

  select version.version_kind
  into v_version_kind
  from editorial.playlist_versions version
  where version.id = old.target_version_id;

  if v_version_kind in (
    'submitted',
    'approved',
    'scheduled',
    'published'
  ) then
    raise exception
      'Trust attachments on submitted, approved, scheduled, or published Playlist versions are immutable';
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;

  return new;
end;
$function$;

create or replace function
  platform_private.begin_playlist_trust_copy_authorization(
    p_source_version_id uuid,
    p_target_version_id uuid
  )
returns uuid
language plpgsql
security definer
set search_path to
  'pg_catalog',
  'editorial',
  'platform_private'
as $function$
declare
  v_source editorial.playlist_versions%rowtype;
  v_target editorial.playlist_versions%rowtype;
  v_token uuid := gen_random_uuid();
begin
  select source.*
  into v_source
  from editorial.playlist_versions source
  where source.id = p_source_version_id;

  if not found then
    raise exception
      'Playlist Trust copy source version does not exist';
  end if;

  select target.*
  into v_target
  from editorial.playlist_versions target
  where target.id = p_target_version_id;

  if not found then
    raise exception
      'Playlist Trust copy target version does not exist';
  end if;

  if v_source.resource_id
       is distinct from v_target.resource_id
     or v_source.playlist_id
          is distinct from v_target.playlist_id
     or v_source.content_fingerprint
          is distinct from v_target.content_fingerprint
     or v_source.item_count
          is distinct from v_target.item_count
     or v_source.source_authority_revision
          is distinct from v_target.source_authority_revision
  then
    raise exception
      'Playlist Trust can only be copied between exact snapshots of the same Playlist';
  end if;

  if not (
    (
      v_source.version_kind = 'working'
      and v_target.version_kind = 'submitted'
    )
    or
    (
      v_source.version_kind = 'submitted'
      and v_target.version_kind = 'approved'
    )
    or
    (
      v_source.version_kind = 'approved'
      and v_target.version_kind = 'scheduled'
    )
    or
    (
      v_source.version_kind = 'scheduled'
      and v_target.version_kind = 'published'
    )
    or
    (
      v_source.version_kind = 'approved'
      and v_target.version_kind = 'published'
    )
  ) then
    raise exception
      'Unsupported Playlist Trust copy transition: % to %',
      v_source.version_kind,
      v_target.version_kind;
  end if;

  insert into
    platform_private.playlist_trust_copy_authorizations (
      authorization_token,
      backend_pid,
      transaction_id,
      source_version_id,
      target_version_id
    )
  values (
    v_token,
    pg_backend_pid(),
    txid_current(),
    p_source_version_id,
    p_target_version_id
  );

  perform set_config(
    'wakilisha.playlist_trust_copy_token',
    v_token::text,
    true
  );

  return v_token;
end;
$function$;

create or replace function
  editorial.copy_playlist_lifecycle_version(
    p_source_version_id uuid,
    p_target_version_kind text,
    p_actor_id uuid
  )
returns table(
  version_id uuid,
  version_number bigint,
  content_fingerprint text,
  item_count integer
)
language plpgsql
security definer
set search_path to
  'pg_catalog',
  'public',
  'editorial',
  'platform_private'
as $function$
declare
  v_source editorial.playlist_versions%rowtype;
  v_version_id uuid;
  v_version_number bigint;
  v_copy_authorization uuid;
begin
  select source.*
  into v_source
  from editorial.playlist_versions source
  where source.id = p_source_version_id;

  if not found then
    raise exception
      'Source Playlist version does not exist';
  end if;

  if not (
    (
      v_source.version_kind = 'approved'
      and p_target_version_kind = 'scheduled'
    )
    or
    (
      v_source.version_kind = 'scheduled'
      and p_target_version_kind = 'published'
    )
  ) then
    raise exception
      'Unsupported Playlist lifecycle copy: % to %',
      v_source.version_kind,
      p_target_version_kind;
  end if;

  perform 1
  from public.wk_playlists playlist
  where playlist.id = v_source.playlist_id
  for update;

  select coalesce(
    max(version.version_number),
    0
  ) + 1
  into v_version_number
  from editorial.playlist_versions version
  where version.resource_id =
          v_source.resource_id;

  v_version_id := gen_random_uuid();

  insert into editorial.playlist_versions (
    id,
    resource_id,
    playlist_id,
    version_number,
    version_kind,
    source_authority_revision,
    title,
    slug,
    description,
    curator_label,
    status,
    metadata,
    item_count,
    content_fingerprint,
    cover_asset_id,
    cover_asset_revision_id,
    cover_placement_data,
    cover_display_order,
    cover_alt_text_snapshot,
    cover_caption_snapshot,
    cover_credit_snapshot,
    created_by
  )
  values (
    v_version_id,
    v_source.resource_id,
    v_source.playlist_id,
    v_version_number,
    p_target_version_kind,
    v_source.source_authority_revision,
    v_source.title,
    v_source.slug,
    v_source.description,
    v_source.curator_label,
    p_target_version_kind,
    v_source.metadata,
    v_source.item_count,
    v_source.content_fingerprint,
    v_source.cover_asset_id,
    v_source.cover_asset_revision_id,
    v_source.cover_placement_data,
    v_source.cover_display_order,
    v_source.cover_alt_text_snapshot,
    v_source.cover_caption_snapshot,
    v_source.cover_credit_snapshot,
    p_actor_id
  );

  insert into editorial.playlist_version_trust_revisions (
    playlist_version_id,
    citation_revision,
    credit_revision,
    updated_by,
    updated_at
  )
  values (
    v_version_id,
    1,
    1,
    p_actor_id,
    now()
  );

  insert into editorial.playlist_version_items (
    playlist_version_id,
    playlist_item_resource_id,
    playlist_item_id,
    position,
    registry_track_id,
    registry_release_id,
    provider_key,
    provider_track_id,
    provider_url,
    title,
    artist_names,
    release_title,
    artwork_url,
    preview_url,
    duration_ms,
    isrc,
    match_status,
    match_confidence,
    normalization_payload,
    notes
  )
  select
    v_version_id,
    item.playlist_item_resource_id,
    item.playlist_item_id,
    item.position,
    item.registry_track_id,
    item.registry_release_id,
    item.provider_key,
    item.provider_track_id,
    item.provider_url,
    item.title,
    item.artist_names,
    item.release_title,
    item.artwork_url,
    item.preview_url,
    item.duration_ms,
    item.isrc,
    item.match_status,
    item.match_confidence,
    item.normalization_payload,
    item.notes
  from editorial.playlist_version_items item
  where item.playlist_version_id =
          p_source_version_id
  order by item.position;

  v_copy_authorization :=
    platform_private.begin_playlist_trust_copy_authorization(
      p_source_version_id,
      v_version_id
    );

  insert into editorial.resource_citations (
    resource_id,
    resource_kind,
    target_version_type,
    target_version_id,
    citation_id,
    citation_purpose,
    target_anchor_type,
    target_anchor_data,
    display_order,
    public_safe,
    created_by
  )
  select
    citation.resource_id,
    citation.resource_kind,
    'playlist_version',
    v_version_id,
    citation.citation_id,
    citation.citation_purpose,
    citation.target_anchor_type,
    citation.target_anchor_data,
    citation.display_order,
    citation.public_safe,
    citation.created_by
  from editorial.resource_citations citation
  where citation.target_version_type =
          'playlist_version'
    and citation.target_version_id =
          p_source_version_id;

  insert into editorial.resource_credits (
    resource_id,
    resource_kind,
    target_version_type,
    target_version_id,
    credit_id,
    display_order,
    is_primary,
    public_safe,
    created_by
  )
  select
    credit.resource_id,
    credit.resource_kind,
    'playlist_version',
    v_version_id,
    credit.credit_id,
    credit.display_order,
    credit.is_primary,
    credit.public_safe,
    credit.created_by
  from editorial.resource_credits credit
  where credit.target_version_type =
          'playlist_version'
    and credit.target_version_id =
          p_source_version_id;

  perform
    platform_private.end_playlist_trust_copy_authorization(
      v_copy_authorization
    );

  version_id := v_version_id;
  version_number := v_version_number;
  content_fingerprint :=
    v_source.content_fingerprint;
  item_count := v_source.item_count;
  return next;
end;
$function$;

revoke all
on function editorial.copy_playlist_lifecycle_version(
  uuid,
  text,
  uuid
)
from public, anon, authenticated;

-- Scheduling and lifecycle history.

create table editorial.playlist_scheduled_publications (
  id uuid primary key default gen_random_uuid(),
  resource_id uuid not null,
  playlist_id uuid not null,
  version_id uuid not null,
  command_receipt_id uuid not null,
  run_after timestamptz not null,
  status text not null default 'scheduled',
  note text,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  published_at timestamptz,
  failure_reason text,

  constraint playlist_scheduled_publications_binding_fkey
    foreign key (resource_id, playlist_id)
    references editorial.playlist_resources(
      resource_id,
      playlist_id
    )
    on update cascade
    on delete restrict,

  constraint playlist_scheduled_publications_version_fkey
    foreign key (
      version_id,
      resource_id,
      playlist_id
    )
    references editorial.playlist_versions(
      id,
      resource_id,
      playlist_id
    )
    on update cascade
    on delete restrict,

  constraint playlist_scheduled_publications_receipt_fkey
    foreign key (command_receipt_id)
    references platform_private.command_receipts(id)
    on delete restrict,

  constraint playlist_scheduled_publications_actor_fkey
    foreign key (created_by)
    references auth.users(id)
    on delete set null,

  constraint playlist_scheduled_publications_status_check
    check (
      status in (
        'scheduled',
        'published',
        'cancelled',
        'failed'
      )
    ),

  constraint playlist_scheduled_publications_run_after_check
    check (run_after > created_at),

  constraint playlist_scheduled_publications_receipt_key
    unique (command_receipt_id)
);

create unique index
  playlist_scheduled_publications_active_playlist_uidx
on editorial.playlist_scheduled_publications(
  playlist_id
)
where status = 'scheduled';

create index playlist_scheduled_publications_due_idx
on editorial.playlist_scheduled_publications(
  status,
  run_after
);

alter table editorial.playlist_scheduled_publications
  enable row level security;

revoke all
on editorial.playlist_scheduled_publications
from public, anon, authenticated;

grant select, insert, update
on editorial.playlist_scheduled_publications
to service_role;

create table editorial.playlist_lifecycle_events (
  id uuid primary key default gen_random_uuid(),
  resource_id uuid not null,
  playlist_id uuid not null,
  event_number bigint not null,
  version_id uuid,
  action text not null,
  prior_status text,
  resulting_status text not null,
  note text,
  metadata jsonb not null default '{}'::jsonb,
  actor_id uuid,
  command_receipt_id uuid not null,
  created_at timestamptz not null default now(),

  constraint playlist_lifecycle_events_binding_fkey
    foreign key (resource_id, playlist_id)
    references editorial.playlist_resources(
      resource_id,
      playlist_id
    )
    on update cascade
    on delete restrict,

  constraint playlist_lifecycle_events_version_fkey
    foreign key (
      version_id,
      resource_id,
      playlist_id
    )
    references editorial.playlist_versions(
      id,
      resource_id,
      playlist_id
    )
    on update cascade
    on delete restrict,

  constraint playlist_lifecycle_events_actor_fkey
    foreign key (actor_id)
    references auth.users(id)
    on delete set null,

  constraint playlist_lifecycle_events_receipt_fkey
    foreign key (command_receipt_id)
    references platform_private.command_receipts(id)
    on delete restrict,

  constraint playlist_lifecycle_events_number_check
    check (event_number >= 1),

  constraint playlist_lifecycle_events_action_check
    check (
      action in (
        'scheduled',
        'unscheduled',
        'published',
        'unpublished',
        'archived',
        'restored'
      )
    ),

  constraint playlist_lifecycle_events_status_check
    check (
      resulting_status in (
        'draft',
        'ready_for_review',
        'in_review',
        'changes_requested',
        'approved',
        'scheduled',
        'published',
        'archived'
      )
      and (
        prior_status is null
        or prior_status in (
          'draft',
          'ready_for_review',
          'in_review',
          'changes_requested',
          'approved',
          'scheduled',
          'published',
          'archived'
        )
      )
    ),

  constraint playlist_lifecycle_events_metadata_check
    check (jsonb_typeof(metadata) = 'object'),

  constraint playlist_lifecycle_events_resource_number_key
    unique (resource_id, event_number),

  constraint playlist_lifecycle_events_receipt_action_key
    unique (command_receipt_id, action)
);

create index playlist_lifecycle_events_playlist_created_idx
on editorial.playlist_lifecycle_events(
  playlist_id,
  created_at desc
);

alter table editorial.playlist_lifecycle_events
  enable row level security;

revoke all
on editorial.playlist_lifecycle_events
from public, anon, authenticated;

grant select, insert
on editorial.playlist_lifecycle_events
to service_role;

create or replace function
  editorial.protect_playlist_lifecycle_event()
returns trigger
language plpgsql
security invoker
set search_path to 'pg_catalog'
as $function$
begin
  raise exception
    'Playlist lifecycle events are append-only';
end;
$function$;

revoke all
on function
  editorial.protect_playlist_lifecycle_event()
from public, anon, authenticated;

create trigger playlist_lifecycle_events_append_only
before update or delete
on editorial.playlist_lifecycle_events
for each row
execute function
  editorial.protect_playlist_lifecycle_event();

create or replace function
  editorial.append_playlist_lifecycle_event(
    p_resource_id uuid,
    p_playlist_id uuid,
    p_version_id uuid,
    p_action text,
    p_prior_status text,
    p_resulting_status text,
    p_note text,
    p_actor_id uuid,
    p_command_receipt_id uuid,
    p_metadata jsonb default '{}'::jsonb
  )
returns uuid
language plpgsql
security definer
set search_path to
  'pg_catalog',
  'editorial'
as $function$
declare
  v_existing_id uuid;
  v_event_number bigint;
  v_event_id uuid;
begin
  select event.id
  into v_existing_id
  from editorial.playlist_lifecycle_events event
  where event.command_receipt_id =
          p_command_receipt_id
    and event.action = p_action;

  if v_existing_id is not null then
    return v_existing_id;
  end if;

  select coalesce(
    max(event.event_number),
    0
  ) + 1
  into v_event_number
  from editorial.playlist_lifecycle_events event
  where event.resource_id = p_resource_id;

  insert into editorial.playlist_lifecycle_events (
    resource_id,
    playlist_id,
    event_number,
    version_id,
    action,
    prior_status,
    resulting_status,
    note,
    metadata,
    actor_id,
    command_receipt_id
  )
  values (
    p_resource_id,
    p_playlist_id,
    v_event_number,
    p_version_id,
    p_action,
    p_prior_status,
    p_resulting_status,
    nullif(btrim(p_note), ''),
    coalesce(p_metadata, '{}'::jsonb),
    p_actor_id,
    p_command_receipt_id
  )
  returning id
  into v_event_id;

  return v_event_id;
end;
$function$;

revoke all
on function editorial.append_playlist_lifecycle_event(
  uuid,
  uuid,
  uuid,
  text,
  text,
  text,
  text,
  uuid,
  uuid,
  jsonb
)
from public, anon, authenticated;

create or replace function
  editorial.record_playlist_publication_lifecycle_event()
returns trigger
language plpgsql
security definer
set search_path to
  'pg_catalog',
  'editorial'
as $function$
declare
  v_schedule_id uuid;
  v_prior_status text;
begin
  select scheduled.id
  into v_schedule_id
  from editorial.playlist_scheduled_publications scheduled
  where scheduled.command_receipt_id =
          new.command_receipt_id
  order by scheduled.created_at desc
  limit 1;

  v_prior_status :=
    case
      when v_schedule_id is null
        then 'approved'
      else 'scheduled'
    end;

  perform editorial.append_playlist_lifecycle_event(
    new.resource_id,
    new.playlist_id,
    new.version_id,
    'published',
    v_prior_status,
    'published',
    null,
    new.published_by,
    new.command_receipt_id,
    jsonb_strip_nulls(
      jsonb_build_object(
        'publication_snapshot_id',
          new.id,
        'scheduled_publication_id',
          v_schedule_id,
        'published_at',
          new.published_at
      )
    )
  );

  return new;
end;
$function$;

revoke all
on function
  editorial.record_playlist_publication_lifecycle_event()
from public, anon, authenticated;

create trigger playlist_publication_lifecycle_event
after insert
on editorial.playlist_publication_snapshots
for each row
execute function
  editorial.record_playlist_publication_lifecycle_event();

-- Schedule the exact current approved version.

create or replace function
  public.schedule_playlist_publication(
    p_playlist_id uuid,
    p_expected_authority_revision bigint,
    p_approved_version_id uuid,
    p_publish_at timestamptz,
    p_idempotency_key text,
    p_note text default null,
    p_correlation_id uuid default null
  )
returns table(
  command_receipt_id uuid,
  receipt_status text,
  playlist_id uuid,
  resource_id uuid,
  authority_revision bigint,
  version_id uuid,
  version_number bigint,
  lifecycle_status text,
  result_payload jsonb,
  idempotent_replay boolean
)
language plpgsql
security definer
set search_path to
  'pg_catalog',
  'public',
  'auth',
  'editorial',
  'platform_private'
as $function$
declare
  v_actor uuid := auth.uid();
  v_playlist public.wk_playlists%rowtype;
  v_binding editorial.playlist_resources%rowtype;
  v_approved editorial.playlist_versions%rowtype;
  v_scheduled record;
  v_schedule_id uuid;
  v_source_version_id uuid;
  v_begin record;
  v_read record;
  v_result jsonb;
  v_correlation_id uuid :=
    coalesce(
      p_correlation_id,
      gen_random_uuid()
    );
begin
  if v_actor is null then
    raise exception 'Not authenticated';
  end if;

  if p_publish_at is null
     or p_publish_at <= now()
  then
    raise exception
      'Scheduled publish time must be in the future';
  end if;

  select playlist.*
  into v_playlist
  from public.wk_playlists playlist
  where playlist.id = p_playlist_id
  for update;

  if not found then
    raise exception 'Playlist does not exist';
  end if;

  select binding.*
  into v_binding
  from editorial.playlist_resources binding
  where binding.playlist_id = p_playlist_id
  for update;

  if not found then
    raise exception
      'Playlist Resource binding does not exist';
  end if;

  if not editorial.current_user_can_publish_playlist(
    v_binding.resource_id
  ) then
    raise exception
      'Playlist publication permission is required';
  end if;

  v_source_version_id :=
    coalesce(
      p_approved_version_id,
      v_binding.current_approved_version_id
    );

  select *
  into v_begin
  from platform_private.begin_authenticated_resource_command(
    'playlist.schedule',
    v_binding.resource_id,
    p_idempotency_key,
    jsonb_build_object(
      'playlist_id',
        p_playlist_id,
      'expected_authority_revision',
        p_expected_authority_revision,
      'approved_version_id',
        v_source_version_id,
      'publish_at',
        p_publish_at,
      'note',
        nullif(btrim(p_note), ''),
      'correlation_id',
        v_correlation_id
    )
  );

  if v_begin.idempotent_replay then
    select *
    into v_read
    from platform_private.read_authenticated_resource_command_result(
      v_begin.command_receipt_id,
      true
    );

    command_receipt_id := v_read.command_receipt_id;
    receipt_status := v_read.receipt_status;
    playlist_id := p_playlist_id;
    resource_id := v_read.resource_id;
    authority_revision :=
      nullif(
        v_read.result_payload ->> 'authority_revision',
        ''
      )::bigint;
    version_id :=
      nullif(
        v_read.result_payload ->> 'version_id',
        ''
      )::uuid;
    version_number :=
      nullif(
        v_read.result_payload ->> 'version_number',
        ''
      )::bigint;
    lifecycle_status :=
      v_read.result_payload ->> 'lifecycle_status';
    result_payload := v_read.result_payload;
    idempotent_replay := true;
    return next;
    return;
  end if;

  if p_expected_authority_revision is null
     or p_expected_authority_revision < 1
     or v_playlist.authority_revision <>
          p_expected_authority_revision
  then
    perform platform_private.reject_resource_command(
      v_begin.command_receipt_id,
      'playlist_revision_changed',
      'The Playlist changed before publication could be scheduled.',
      jsonb_build_object(
        'playlist_id',
          p_playlist_id,
        'authority_revision',
          v_playlist.authority_revision,
        'lifecycle_status',
          v_playlist.status
      )
    );

  elsif v_playlist.status <> 'approved'
        or v_source_version_id is null
        or v_binding.current_approved_version_id
             is distinct from
             v_source_version_id
  then
    perform platform_private.reject_resource_command(
      v_begin.command_receipt_id,
      'playlist_not_schedulable',
      'Only the exact current approved Playlist version can be scheduled.',
      jsonb_build_object(
        'playlist_id',
          p_playlist_id,
        'lifecycle_status',
          v_playlist.status,
        'current_approved_version_id',
          v_binding.current_approved_version_id
      )
    );

  elsif exists (
    select 1
    from editorial.playlist_scheduled_publications scheduled
    where scheduled.playlist_id = p_playlist_id
      and scheduled.status = 'scheduled'
  )
  then
    perform platform_private.reject_resource_command(
      v_begin.command_receipt_id,
      'playlist_schedule_exists',
      'This Playlist already has an active publication schedule.',
      jsonb_build_object(
        'playlist_id',
          p_playlist_id
      )
    );

  else
    select approved.*
    into v_approved
    from editorial.playlist_versions approved
    where approved.id = v_source_version_id
      and approved.resource_id =
            v_binding.resource_id
      and approved.playlist_id =
            p_playlist_id
      and approved.version_kind = 'approved';

    if not found then
      perform platform_private.reject_resource_command(
        v_begin.command_receipt_id,
        'approved_version_invalid',
        'The approved Playlist version is no longer schedulable.',
        jsonb_build_object(
          'playlist_id',
            p_playlist_id,
          'approved_version_id',
            v_source_version_id
        )
      );
    end if;

    if exists (
      select 1
      from platform_private.command_receipts receipt
      where receipt.id =
              v_begin.command_receipt_id
        and receipt.status = 'accepted'
    ) then
      select *
      into v_scheduled
      from editorial.copy_playlist_lifecycle_version(
        v_approved.id,
        'scheduled',
        v_actor
      );

      insert into editorial.playlist_scheduled_publications (
        resource_id,
        playlist_id,
        version_id,
        command_receipt_id,
        run_after,
        note,
        created_by
      )
      values (
        v_binding.resource_id,
        p_playlist_id,
        v_scheduled.version_id,
        v_begin.command_receipt_id,
        p_publish_at,
        nullif(btrim(p_note), ''),
        v_actor
      )
      returning id
      into v_schedule_id;

      update public.wk_playlists playlist
      set
        status = 'scheduled',
        authority_revision =
          playlist.authority_revision + 1
      where playlist.id = p_playlist_id
      returning playlist.*
      into v_playlist;

      perform editorial.append_playlist_lifecycle_event(
        v_binding.resource_id,
        p_playlist_id,
        v_scheduled.version_id,
        'scheduled',
        'approved',
        'scheduled',
        p_note,
        v_actor,
        v_begin.command_receipt_id,
        jsonb_build_object(
          'scheduled_publication_id',
            v_schedule_id,
          'publish_at',
            p_publish_at,
          'correlation_id',
            v_correlation_id
        )
      );

      v_result := jsonb_build_object(
        'playlist_id',
          p_playlist_id,
        'resource_id',
          v_binding.resource_id,
        'authority_revision',
          v_playlist.authority_revision,
        'approved_version_id',
          v_approved.id,
        'version_id',
          v_scheduled.version_id,
        'version_number',
          v_scheduled.version_number,
        'scheduled_publication_id',
          v_schedule_id,
        'publish_at',
          p_publish_at,
        'lifecycle_status',
          'scheduled',
        'correlation_id',
          v_correlation_id
      );

      perform platform_private.complete_resource_command(
        v_begin.command_receipt_id,
        v_result
      );
    end if;
  end if;

  select *
  into v_read
  from platform_private.read_authenticated_resource_command_result(
    v_begin.command_receipt_id,
    false
  );

  command_receipt_id := v_read.command_receipt_id;
  receipt_status := v_read.receipt_status;
  playlist_id := p_playlist_id;
  resource_id := v_read.resource_id;
  authority_revision :=
    nullif(
      v_read.result_payload ->> 'authority_revision',
      ''
    )::bigint;
  version_id :=
    nullif(
      v_read.result_payload ->> 'version_id',
      ''
    )::uuid;
  version_number :=
    nullif(
      v_read.result_payload ->> 'version_number',
      ''
    )::bigint;
  lifecycle_status :=
    v_read.result_payload ->> 'lifecycle_status';
  result_payload := v_read.result_payload;
  idempotent_replay := false;
  return next;
end;
$function$;

revoke all
on function public.schedule_playlist_publication(
  uuid,
  bigint,
  uuid,
  timestamp with time zone,
  text,
  text,
  uuid
)
from public, anon;

grant execute
on function public.schedule_playlist_publication(
  uuid,
  bigint,
  uuid,
  timestamp with time zone,
  text,
  text,
  uuid
)
to authenticated;

-- Remove an active schedule. If current Playlist content still matches the
-- scheduled snapshot, the prior approval remains valid. Otherwise the Playlist
-- returns to draft.

create or replace function
  public.unschedule_playlist_publication(
    p_playlist_id uuid,
    p_expected_authority_revision bigint,
    p_idempotency_key text,
    p_note text default null,
    p_correlation_id uuid default null
  )
returns table(
  command_receipt_id uuid,
  receipt_status text,
  playlist_id uuid,
  resource_id uuid,
  authority_revision bigint,
  version_id uuid,
  version_number bigint,
  lifecycle_status text,
  result_payload jsonb,
  idempotent_replay boolean
)
language plpgsql
security definer
set search_path to
  'pg_catalog',
  'public',
  'auth',
  'editorial',
  'platform_private'
as $function$
declare
  v_actor uuid := auth.uid();
  v_playlist public.wk_playlists%rowtype;
  v_binding editorial.playlist_resources%rowtype;
  v_schedule editorial.playlist_scheduled_publications%rowtype;
  v_scheduled_version editorial.playlist_versions%rowtype;
  v_current_fingerprint text;
  v_result_status text;
  v_begin record;
  v_read record;
  v_result jsonb;
  v_correlation_id uuid :=
    coalesce(
      p_correlation_id,
      gen_random_uuid()
    );
begin
  if v_actor is null then
    raise exception 'Not authenticated';
  end if;

  select playlist.*
  into v_playlist
  from public.wk_playlists playlist
  where playlist.id = p_playlist_id
  for update;

  if not found then
    raise exception 'Playlist does not exist';
  end if;

  select binding.*
  into v_binding
  from editorial.playlist_resources binding
  where binding.playlist_id = p_playlist_id
  for update;

  if not found then
    raise exception
      'Playlist Resource binding does not exist';
  end if;

  if not editorial.current_user_can_publish_playlist(
    v_binding.resource_id
  ) then
    raise exception
      'Playlist publication permission is required';
  end if;

  select scheduled.*
  into v_schedule
  from editorial.playlist_scheduled_publications scheduled
  where scheduled.playlist_id = p_playlist_id
    and scheduled.status = 'scheduled'
  order by scheduled.created_at desc
  limit 1
  for update;

  select *
  into v_begin
  from platform_private.begin_authenticated_resource_command(
    'playlist.unschedule',
    v_binding.resource_id,
    p_idempotency_key,
    jsonb_build_object(
      'playlist_id',
        p_playlist_id,
      'expected_authority_revision',
        p_expected_authority_revision,
      'scheduled_publication_id',
        v_schedule.id,
      'note',
        nullif(btrim(p_note), ''),
      'correlation_id',
        v_correlation_id
    )
  );

  if v_begin.idempotent_replay then
    select *
    into v_read
    from platform_private.read_authenticated_resource_command_result(
      v_begin.command_receipt_id,
      true
    );

    command_receipt_id := v_read.command_receipt_id;
    receipt_status := v_read.receipt_status;
    playlist_id := p_playlist_id;
    resource_id := v_read.resource_id;
    authority_revision :=
      nullif(
        v_read.result_payload ->> 'authority_revision',
        ''
      )::bigint;
    version_id :=
      nullif(
        v_read.result_payload ->> 'version_id',
        ''
      )::uuid;
    version_number :=
      nullif(
        v_read.result_payload ->> 'version_number',
        ''
      )::bigint;
    lifecycle_status :=
      v_read.result_payload ->> 'lifecycle_status';
    result_payload := v_read.result_payload;
    idempotent_replay := true;
    return next;
    return;
  end if;

  if p_expected_authority_revision is null
     or p_expected_authority_revision < 1
     or v_playlist.authority_revision <>
          p_expected_authority_revision
  then
    perform platform_private.reject_resource_command(
      v_begin.command_receipt_id,
      'playlist_revision_changed',
      'The Playlist changed before the schedule could be removed.',
      jsonb_build_object(
        'playlist_id',
          p_playlist_id,
        'authority_revision',
          v_playlist.authority_revision
      )
    );

  elsif v_schedule.id is null
        or v_playlist.status <> 'scheduled'
  then
    perform platform_private.reject_resource_command(
      v_begin.command_receipt_id,
      'playlist_not_scheduled',
      'This Playlist does not have an active publication schedule.',
      jsonb_build_object(
        'playlist_id',
          p_playlist_id,
        'lifecycle_status',
          v_playlist.status
      )
    );

  else
    select version.*
    into v_scheduled_version
    from editorial.playlist_versions version
    where version.id = v_schedule.version_id
      and version.playlist_id = p_playlist_id
      and version.resource_id =
            v_binding.resource_id
      and version.version_kind = 'scheduled';

    if not found then
      perform platform_private.reject_resource_command(
        v_begin.command_receipt_id,
        'scheduled_version_invalid',
        'The scheduled Playlist version is no longer valid.',
        jsonb_build_object(
          'playlist_id',
            p_playlist_id,
          'scheduled_publication_id',
            v_schedule.id
        )
      );
    end if;

    if exists (
      select 1
      from platform_private.command_receipts receipt
      where receipt.id =
              v_begin.command_receipt_id
        and receipt.status = 'accepted'
    ) then
      v_current_fingerprint :=
        editorial.playlist_current_content_fingerprint(
          p_playlist_id
        );

      v_result_status :=
        case
          when v_current_fingerprint =
               v_scheduled_version.content_fingerprint
            then 'approved'
          else 'draft'
        end;

      update editorial.playlist_scheduled_publications as scheduled
      set
        status = 'cancelled',
        updated_at = now()
      where scheduled.id = v_schedule.id;

      if v_result_status = 'draft' then
        update editorial.playlist_resources as binding
        set current_approved_version_id = null
        where binding.playlist_id = p_playlist_id;
      end if;

      update public.wk_playlists playlist
      set
        status = v_result_status,
        authority_revision =
          playlist.authority_revision + 1
      where playlist.id = p_playlist_id
      returning playlist.*
      into v_playlist;

      perform editorial.append_playlist_lifecycle_event(
        v_binding.resource_id,
        p_playlist_id,
        v_scheduled_version.id,
        'unscheduled',
        'scheduled',
        v_result_status,
        p_note,
        v_actor,
        v_begin.command_receipt_id,
        jsonb_build_object(
          'scheduled_publication_id',
            v_schedule.id,
          'content_still_matches_approved',
            v_result_status = 'approved',
          'correlation_id',
            v_correlation_id
        )
      );

      v_result := jsonb_build_object(
        'playlist_id',
          p_playlist_id,
        'resource_id',
          v_binding.resource_id,
        'authority_revision',
          v_playlist.authority_revision,
        'version_id',
          v_scheduled_version.id,
        'version_number',
          v_scheduled_version.version_number,
        'scheduled_publication_id',
          v_schedule.id,
        'lifecycle_status',
          v_result_status,
        'correlation_id',
          v_correlation_id
      );

      perform platform_private.complete_resource_command(
        v_begin.command_receipt_id,
        v_result
      );
    end if;
  end if;

  select *
  into v_read
  from platform_private.read_authenticated_resource_command_result(
    v_begin.command_receipt_id,
    false
  );

  command_receipt_id := v_read.command_receipt_id;
  receipt_status := v_read.receipt_status;
  playlist_id := p_playlist_id;
  resource_id := v_read.resource_id;
  authority_revision :=
    nullif(
      v_read.result_payload ->> 'authority_revision',
      ''
    )::bigint;
  version_id :=
    nullif(
      v_read.result_payload ->> 'version_id',
      ''
    )::uuid;
  version_number :=
    nullif(
      v_read.result_payload ->> 'version_number',
      ''
    )::bigint;
  lifecycle_status :=
    v_read.result_payload ->> 'lifecycle_status';
  result_payload := v_read.result_payload;
  idempotent_replay := false;
  return next;
end;
$function$;

revoke all
on function public.unschedule_playlist_publication(
  uuid,
  bigint,
  text,
  text,
  uuid
)
from public, anon;

grant execute
on function public.unschedule_playlist_publication(
  uuid,
  bigint,
  text,
  text,
  uuid
)
to authenticated;

-- Publish due scheduled Playlists. This follows the repaired Playlist-specific
-- publication-pointer path. It never writes a Playlist version UUID into the
-- generic Article-only editorial.resources.current_published_version_id.

create or replace function
  public.publish_due_playlist_publications(
    p_limit integer default 25
  )
returns table(
  playlist_id uuid,
  playlist_slug text,
  schedule_id uuid,
  version_id uuid,
  published_at timestamptz,
  status text
)
language plpgsql
security definer
set search_path to
  'pg_catalog',
  'public',
  'auth',
  'editorial'
as $function$
declare
  due_schedule
    editorial.playlist_scheduled_publications%rowtype;
  v_playlist public.wk_playlists%rowtype;
  v_binding editorial.playlist_resources%rowtype;
  v_scheduled editorial.playlist_versions%rowtype;
  v_published record;
  v_snapshot_id uuid;
  v_limit integer;
begin
  if auth.role() <> 'service_role'
     and not coalesce(
       public.current_user_is_administrator(),
       false
     )
     and not coalesce(
       public.current_user_has_capability(
         'publish_playlists'
       ),
       false
     )
  then
    raise exception
      'Playlist publication permission is required';
  end if;

  v_limit :=
    least(
      greatest(
        coalesce(p_limit, 25),
        1
      ),
      100
    );

  for due_schedule in
    select scheduled.*
    from editorial.playlist_scheduled_publications scheduled
    where scheduled.status = 'scheduled'
      and scheduled.run_after <= now()
    order by scheduled.run_after asc
    limit v_limit
    for update skip locked
  loop
    select playlist.*
    into v_playlist
    from public.wk_playlists playlist
    where playlist.id =
            due_schedule.playlist_id
    for update;

    if not found then
      update editorial.playlist_scheduled_publications as scheduled
      set
        status = 'failed',
        failure_reason = 'Playlist no longer exists.',
        updated_at = now()
      where scheduled.id = due_schedule.id;

      continue;
    end if;

    select binding.*
    into v_binding
    from editorial.playlist_resources binding
    where binding.playlist_id =
            due_schedule.playlist_id
      and binding.resource_id =
            due_schedule.resource_id
    for update;

    if not found then
      update editorial.playlist_scheduled_publications as scheduled
      set
        status = 'failed',
        failure_reason =
          'Playlist Resource binding no longer exists.',
        updated_at = now()
      where scheduled.id = due_schedule.id;

      continue;
    end if;

    select version.*
    into v_scheduled
    from editorial.playlist_versions version
    where version.id =
            due_schedule.version_id
      and version.resource_id =
            due_schedule.resource_id
      and version.playlist_id =
            due_schedule.playlist_id
      and version.version_kind = 'scheduled';

    if not found
       or v_playlist.status <> 'scheduled'
    then
      update editorial.playlist_scheduled_publications as scheduled
      set
        status = 'failed',
        failure_reason =
          'Scheduled Playlist lifecycle state is no longer publishable.',
        updated_at = now()
      where scheduled.id = due_schedule.id;

      continue;
    end if;

    select *
    into v_published
    from editorial.copy_playlist_lifecycle_version(
      v_scheduled.id,
      'published',
      due_schedule.created_by
    );

    update editorial.playlist_resources as binding
    set current_published_version_id =
          v_published.version_id
    where binding.playlist_id =
            due_schedule.playlist_id;

    update editorial.resources resource
    set
      lifecycle_state = 'published',
      visibility = 'public',
      updated_at = now()
    where resource.id =
            due_schedule.resource_id;

    update public.wk_playlists playlist
    set
      status = 'published',
      published_at = due_schedule.run_after,
      canonical_url =
        'https://wakilisha.africa/playlists/'
        || v_scheduled.slug,
      authority_revision =
        playlist.authority_revision + 1,
      updated_at = now()
    where playlist.id =
            due_schedule.playlist_id
    returning playlist.*
    into v_playlist;

    v_snapshot_id :=
      editorial.materialize_playlist_publication_snapshot(
        v_published.version_id,
        due_schedule.run_after,
        due_schedule.created_by,
        due_schedule.command_receipt_id
      );

    update editorial.playlist_scheduled_publications as scheduled
    set
      status = 'published',
      published_at = due_schedule.run_after,
      failure_reason = null,
      updated_at = now()
    where scheduled.id = due_schedule.id;

    playlist_id := due_schedule.playlist_id;
    playlist_slug := v_playlist.slug;
    schedule_id := due_schedule.id;
    version_id := v_published.version_id;
    published_at := due_schedule.run_after;
    status := 'published';
    return next;
  end loop;
end;
$function$;

revoke all
on function public.publish_due_playlist_publications(integer)
from public, anon;

grant execute
on function public.publish_due_playlist_publications(integer)
to authenticated, service_role;

-- Unpublish hides the current publication by clearing only the Playlist-specific
-- published-version pointer. If current content still matches the approved
-- snapshot, that approval remains publishable. Otherwise the Playlist returns
-- to draft.

create or replace function
  public.unpublish_playlist(
    p_playlist_id uuid,
    p_expected_authority_revision bigint,
    p_idempotency_key text,
    p_note text default null,
    p_correlation_id uuid default null
  )
returns table(
  command_receipt_id uuid,
  receipt_status text,
  playlist_id uuid,
  resource_id uuid,
  authority_revision bigint,
  version_id uuid,
  version_number bigint,
  lifecycle_status text,
  result_payload jsonb,
  idempotent_replay boolean
)
language plpgsql
security definer
set search_path to
  'pg_catalog',
  'public',
  'auth',
  'editorial',
  'platform_private'
as $function$
declare
  v_actor uuid := auth.uid();
  v_playlist public.wk_playlists%rowtype;
  v_binding editorial.playlist_resources%rowtype;
  v_published editorial.playlist_versions%rowtype;
  v_approved editorial.playlist_versions%rowtype;
  v_current_fingerprint text;
  v_prior_status text;
  v_result_status text;
  v_begin record;
  v_read record;
  v_result jsonb;
  v_correlation_id uuid :=
    coalesce(
      p_correlation_id,
      gen_random_uuid()
    );
begin
  if v_actor is null then
    raise exception 'Not authenticated';
  end if;

  select playlist.*
  into v_playlist
  from public.wk_playlists playlist
  where playlist.id = p_playlist_id
  for update;

  if not found then
    raise exception 'Playlist does not exist';
  end if;

  v_prior_status := v_playlist.status;

  select binding.*
  into v_binding
  from editorial.playlist_resources binding
  where binding.playlist_id = p_playlist_id
  for update;

  if not found then
    raise exception
      'Playlist Resource binding does not exist';
  end if;

  if not editorial.current_user_can_publish_playlist(
    v_binding.resource_id
  ) then
    raise exception
      'Playlist publication permission is required';
  end if;

  if v_binding.current_published_version_id
       is not null
  then
    select version.*
    into v_published
    from editorial.playlist_versions version
    where version.id =
      v_binding.current_published_version_id;
  end if;

  if v_binding.current_approved_version_id
       is not null
  then
    select version.*
    into v_approved
    from editorial.playlist_versions version
    where version.id =
      v_binding.current_approved_version_id;
  end if;

  select *
  into v_begin
  from platform_private.begin_authenticated_resource_command(
    'playlist.unpublish',
    v_binding.resource_id,
    p_idempotency_key,
    jsonb_build_object(
      'playlist_id',
        p_playlist_id,
      'expected_authority_revision',
        p_expected_authority_revision,
      'published_version_id',
        v_binding.current_published_version_id,
      'note',
        nullif(btrim(p_note), ''),
      'correlation_id',
        v_correlation_id
    )
  );

  if v_begin.idempotent_replay then
    select *
    into v_read
    from platform_private.read_authenticated_resource_command_result(
      v_begin.command_receipt_id,
      true
    );

    command_receipt_id := v_read.command_receipt_id;
    receipt_status := v_read.receipt_status;
    playlist_id := p_playlist_id;
    resource_id := v_read.resource_id;
    authority_revision :=
      nullif(
        v_read.result_payload ->> 'authority_revision',
        ''
      )::bigint;
    version_id :=
      nullif(
        v_read.result_payload ->> 'version_id',
        ''
      )::uuid;
    version_number :=
      nullif(
        v_read.result_payload ->> 'version_number',
        ''
      )::bigint;
    lifecycle_status :=
      v_read.result_payload ->> 'lifecycle_status';
    result_payload := v_read.result_payload;
    idempotent_replay := true;
    return next;
    return;
  end if;

  if p_expected_authority_revision is null
     or p_expected_authority_revision < 1
     or v_playlist.authority_revision <>
          p_expected_authority_revision
  then
    perform platform_private.reject_resource_command(
      v_begin.command_receipt_id,
      'playlist_revision_changed',
      'The Playlist changed before it could be unpublished.',
      jsonb_build_object(
        'playlist_id',
          p_playlist_id,
        'authority_revision',
          v_playlist.authority_revision
      )
    );

  elsif v_binding.current_published_version_id is null
  then
    perform platform_private.reject_resource_command(
      v_begin.command_receipt_id,
      'playlist_not_published',
      'This Playlist does not have a public version to unpublish.',
      jsonb_build_object(
        'playlist_id',
          p_playlist_id,
        'lifecycle_status',
          v_playlist.status
      )
    );

  else
    v_current_fingerprint :=
      editorial.playlist_current_content_fingerprint(
        p_playlist_id
      );

    v_result_status :=
      case
        when v_approved.id is not null
         and v_current_fingerprint =
               v_approved.content_fingerprint
          then 'approved'
        else 'draft'
      end;

    if v_result_status = 'draft' then
      update editorial.playlist_resources as binding
      set current_approved_version_id = null
      where binding.playlist_id = p_playlist_id;
    end if;

    update editorial.playlist_resources as binding
    set current_published_version_id = null
    where binding.playlist_id = p_playlist_id;

    update editorial.resources resource
    set
      lifecycle_state =
        case
          when v_result_status = 'approved'
            then 'active'
          else 'draft'
        end,
      visibility = 'private',
      updated_at = now()
    where resource.id =
            v_binding.resource_id;

    update public.wk_playlists playlist
    set
      status = v_result_status,
      authority_revision =
        playlist.authority_revision + 1,
      updated_at = now()
    where playlist.id = p_playlist_id
    returning playlist.*
    into v_playlist;

    perform editorial.append_playlist_lifecycle_event(
      v_binding.resource_id,
      p_playlist_id,
      v_published.id,
      'unpublished',
      v_prior_status,
      v_result_status,
      p_note,
      v_actor,
      v_begin.command_receipt_id,
      jsonb_build_object(
        'correlation_id',
          v_correlation_id
      )
    );

    v_result := jsonb_build_object(
      'playlist_id',
        p_playlist_id,
      'resource_id',
        v_binding.resource_id,
      'authority_revision',
        v_playlist.authority_revision,
      'version_id',
        v_published.id,
      'version_number',
        v_published.version_number,
      'lifecycle_status',
        v_result_status,
      'correlation_id',
        v_correlation_id
    );

    perform platform_private.complete_resource_command(
      v_begin.command_receipt_id,
      v_result
    );
  end if;

  select *
  into v_read
  from platform_private.read_authenticated_resource_command_result(
    v_begin.command_receipt_id,
    false
  );

  command_receipt_id := v_read.command_receipt_id;
  receipt_status := v_read.receipt_status;
  playlist_id := p_playlist_id;
  resource_id := v_read.resource_id;
  authority_revision :=
    nullif(
      v_read.result_payload ->> 'authority_revision',
      ''
    )::bigint;
  version_id :=
    nullif(
      v_read.result_payload ->> 'version_id',
      ''
    )::uuid;
  version_number :=
    nullif(
      v_read.result_payload ->> 'version_number',
      ''
    )::bigint;
  lifecycle_status :=
    v_read.result_payload ->> 'lifecycle_status';
  result_payload := v_read.result_payload;
  idempotent_replay := false;
  return next;
end;
$function$;

revoke all
on function public.unpublish_playlist(
  uuid,
  bigint,
  text,
  text,
  uuid
)
from public, anon;

grant execute
on function public.unpublish_playlist(
  uuid,
  bigint,
  text,
  text,
  uuid
)
to authenticated;

create or replace function
  public.archive_playlist(
    p_playlist_id uuid,
    p_expected_authority_revision bigint,
    p_idempotency_key text,
    p_note text default null,
    p_correlation_id uuid default null
  )
returns table(
  command_receipt_id uuid,
  receipt_status text,
  playlist_id uuid,
  resource_id uuid,
  authority_revision bigint,
  version_id uuid,
  version_number bigint,
  lifecycle_status text,
  result_payload jsonb,
  idempotent_replay boolean
)
language plpgsql
security definer
set search_path to
  'pg_catalog',
  'public',
  'auth',
  'editorial',
  'platform_private'
as $function$
declare
  v_actor uuid := auth.uid();
  v_playlist public.wk_playlists%rowtype;
  v_binding editorial.playlist_resources%rowtype;
  v_target editorial.playlist_versions%rowtype;
  v_prior_status text;
  v_begin record;
  v_read record;
  v_result jsonb;
  v_correlation_id uuid :=
    coalesce(
      p_correlation_id,
      gen_random_uuid()
    );
begin
  if v_actor is null then
    raise exception 'Not authenticated';
  end if;

  if not (
    coalesce(
      public.current_user_is_administrator(),
      false
    )
    or coalesce(
      public.current_user_has_capability(
        'delete_playlists'
      ),
      false
    )
  ) then
    raise exception
      'Playlist archive permission is required';
  end if;

  select playlist.*
  into v_playlist
  from public.wk_playlists playlist
  where playlist.id = p_playlist_id
  for update;

  if not found then
    raise exception 'Playlist does not exist';
  end if;

  v_prior_status := v_playlist.status;

  select binding.*
  into v_binding
  from editorial.playlist_resources binding
  where binding.playlist_id = p_playlist_id
  for update;

  if not found then
    raise exception
      'Playlist Resource binding does not exist';
  end if;

  select version.*
  into v_target
  from editorial.playlist_versions version
  where version.id = coalesce(
    v_binding.current_working_version_id,
    v_binding.current_submitted_version_id,
    v_binding.current_approved_version_id,
    v_binding.current_published_version_id
  );

  select *
  into v_begin
  from platform_private.begin_authenticated_resource_command(
    'playlist.archive',
    v_binding.resource_id,
    p_idempotency_key,
    jsonb_build_object(
      'playlist_id',
        p_playlist_id,
      'expected_authority_revision',
        p_expected_authority_revision,
      'note',
        nullif(btrim(p_note), ''),
      'correlation_id',
        v_correlation_id
    )
  );

  if v_begin.idempotent_replay then
    select *
    into v_read
    from platform_private.read_authenticated_resource_command_result(
      v_begin.command_receipt_id,
      true
    );

    command_receipt_id := v_read.command_receipt_id;
    receipt_status := v_read.receipt_status;
    playlist_id := p_playlist_id;
    resource_id := v_read.resource_id;
    authority_revision :=
      nullif(
        v_read.result_payload ->> 'authority_revision',
        ''
      )::bigint;
    version_id :=
      nullif(
        v_read.result_payload ->> 'version_id',
        ''
      )::uuid;
    version_number :=
      nullif(
        v_read.result_payload ->> 'version_number',
        ''
      )::bigint;
    lifecycle_status :=
      v_read.result_payload ->> 'lifecycle_status';
    result_payload := v_read.result_payload;
    idempotent_replay := true;
    return next;
    return;
  end if;

  if p_expected_authority_revision is null
     or p_expected_authority_revision < 1
     or v_playlist.authority_revision <>
          p_expected_authority_revision
  then
    perform platform_private.reject_resource_command(
      v_begin.command_receipt_id,
      'playlist_revision_changed',
      'The Playlist changed before it could be archived.',
      jsonb_build_object(
        'playlist_id',
          p_playlist_id,
        'authority_revision',
          v_playlist.authority_revision
      )
    );

  elsif v_playlist.status = 'archived'
  then
    perform platform_private.reject_resource_command(
      v_begin.command_receipt_id,
      'playlist_already_archived',
      'This Playlist is already archived.',
      jsonb_build_object(
        'playlist_id',
          p_playlist_id
      )
    );

  else
    update editorial.playlist_scheduled_publications as scheduled
    set
      status = 'cancelled',
      updated_at = now()
    where scheduled.playlist_id = p_playlist_id
      and scheduled.status = 'scheduled';

    update editorial.playlist_resources as binding
    set current_published_version_id = null
    where binding.playlist_id = p_playlist_id;

    update editorial.resources resource
    set
      lifecycle_state = 'archived',
      visibility = 'private',
      updated_at = now()
    where resource.id =
            v_binding.resource_id;

    update public.wk_playlists playlist
    set
      status = 'archived',
      authority_revision =
        playlist.authority_revision + 1,
      updated_at = now()
    where playlist.id = p_playlist_id
    returning playlist.*
    into v_playlist;

    perform editorial.append_playlist_lifecycle_event(
      v_binding.resource_id,
      p_playlist_id,
      v_target.id,
      'archived',
      v_prior_status,
      'archived',
      p_note,
      v_actor,
      v_begin.command_receipt_id,
      jsonb_build_object(
        'correlation_id',
          v_correlation_id
      )
    );

    v_result := jsonb_build_object(
      'playlist_id',
        p_playlist_id,
      'resource_id',
        v_binding.resource_id,
      'authority_revision',
        v_playlist.authority_revision,
      'version_id',
        v_target.id,
      'version_number',
        v_target.version_number,
      'lifecycle_status',
        'archived',
      'correlation_id',
        v_correlation_id
    );

    perform platform_private.complete_resource_command(
      v_begin.command_receipt_id,
      v_result
    );
  end if;

  select *
  into v_read
  from platform_private.read_authenticated_resource_command_result(
    v_begin.command_receipt_id,
    false
  );

  command_receipt_id := v_read.command_receipt_id;
  receipt_status := v_read.receipt_status;
  playlist_id := p_playlist_id;
  resource_id := v_read.resource_id;
  authority_revision :=
    nullif(
      v_read.result_payload ->> 'authority_revision',
      ''
    )::bigint;
  version_id :=
    nullif(
      v_read.result_payload ->> 'version_id',
      ''
    )::uuid;
  version_number :=
    nullif(
      v_read.result_payload ->> 'version_number',
      ''
    )::bigint;
  lifecycle_status :=
    v_read.result_payload ->> 'lifecycle_status';
  result_payload := v_read.result_payload;
  idempotent_replay := false;
  return next;
end;
$function$;

revoke all
on function public.archive_playlist(
  uuid,
  bigint,
  text,
  text,
  uuid
)
from public, anon;

grant execute
on function public.archive_playlist(
  uuid,
  bigint,
  text,
  text,
  uuid
)
to authenticated;

create or replace function
  public.restore_playlist_from_archive(
    p_playlist_id uuid,
    p_expected_authority_revision bigint,
    p_idempotency_key text,
    p_note text default null,
    p_correlation_id uuid default null
  )
returns table(
  command_receipt_id uuid,
  receipt_status text,
  playlist_id uuid,
  resource_id uuid,
  authority_revision bigint,
  version_id uuid,
  version_number bigint,
  lifecycle_status text,
  result_payload jsonb,
  idempotent_replay boolean
)
language plpgsql
security definer
set search_path to
  'pg_catalog',
  'public',
  'auth',
  'editorial',
  'platform_private'
as $function$
declare
  v_actor uuid := auth.uid();
  v_playlist public.wk_playlists%rowtype;
  v_binding editorial.playlist_resources%rowtype;
  v_target editorial.playlist_versions%rowtype;
  v_begin record;
  v_read record;
  v_result jsonb;
  v_correlation_id uuid :=
    coalesce(
      p_correlation_id,
      gen_random_uuid()
    );
begin
  if v_actor is null then
    raise exception 'Not authenticated';
  end if;

  select playlist.*
  into v_playlist
  from public.wk_playlists playlist
  where playlist.id = p_playlist_id
  for update;

  if not found then
    raise exception 'Playlist does not exist';
  end if;

  select binding.*
  into v_binding
  from editorial.playlist_resources binding
  where binding.playlist_id = p_playlist_id
  for update;

  if not found then
    raise exception
      'Playlist Resource binding does not exist';
  end if;

  if not editorial.current_user_can_edit_playlist(
    v_binding.resource_id
  ) then
    raise exception
      'Playlist edit permission is required';
  end if;

  select version.*
  into v_target
  from editorial.playlist_versions version
  where version.id = coalesce(
    v_binding.current_working_version_id,
    v_binding.current_submitted_version_id,
    v_binding.current_approved_version_id,
    v_binding.current_published_version_id
  );

  select *
  into v_begin
  from platform_private.begin_authenticated_resource_command(
    'playlist.restore',
    v_binding.resource_id,
    p_idempotency_key,
    jsonb_build_object(
      'playlist_id',
        p_playlist_id,
      'expected_authority_revision',
        p_expected_authority_revision,
      'note',
        nullif(btrim(p_note), ''),
      'correlation_id',
        v_correlation_id
    )
  );

  if v_begin.idempotent_replay then
    select *
    into v_read
    from platform_private.read_authenticated_resource_command_result(
      v_begin.command_receipt_id,
      true
    );

    command_receipt_id := v_read.command_receipt_id;
    receipt_status := v_read.receipt_status;
    playlist_id := p_playlist_id;
    resource_id := v_read.resource_id;
    authority_revision :=
      nullif(
        v_read.result_payload ->> 'authority_revision',
        ''
      )::bigint;
    version_id :=
      nullif(
        v_read.result_payload ->> 'version_id',
        ''
      )::uuid;
    version_number :=
      nullif(
        v_read.result_payload ->> 'version_number',
        ''
      )::bigint;
    lifecycle_status :=
      v_read.result_payload ->> 'lifecycle_status';
    result_payload := v_read.result_payload;
    idempotent_replay := true;
    return next;
    return;
  end if;

  if p_expected_authority_revision is null
     or p_expected_authority_revision < 1
     or v_playlist.authority_revision <>
          p_expected_authority_revision
  then
    perform platform_private.reject_resource_command(
      v_begin.command_receipt_id,
      'playlist_revision_changed',
      'The Playlist changed before it could be restored.',
      jsonb_build_object(
        'playlist_id',
          p_playlist_id,
        'authority_revision',
          v_playlist.authority_revision
      )
    );

  elsif v_playlist.status <> 'archived'
  then
    perform platform_private.reject_resource_command(
      v_begin.command_receipt_id,
      'playlist_not_archived',
      'Only an archived Playlist can be restored.',
      jsonb_build_object(
        'playlist_id',
          p_playlist_id,
        'lifecycle_status',
          v_playlist.status
      )
    );

  else
    update editorial.resources resource
    set
      lifecycle_state = 'draft',
      visibility = 'private',
      updated_at = now()
    where resource.id =
            v_binding.resource_id;

    update public.wk_playlists playlist
    set
      status = 'draft',
      authority_revision =
        playlist.authority_revision + 1,
      updated_at = now()
    where playlist.id = p_playlist_id
    returning playlist.*
    into v_playlist;

    perform editorial.append_playlist_lifecycle_event(
      v_binding.resource_id,
      p_playlist_id,
      v_target.id,
      'restored',
      'archived',
      'draft',
      p_note,
      v_actor,
      v_begin.command_receipt_id,
      jsonb_build_object(
        'correlation_id',
          v_correlation_id
      )
    );

    v_result := jsonb_build_object(
      'playlist_id',
        p_playlist_id,
      'resource_id',
        v_binding.resource_id,
      'authority_revision',
        v_playlist.authority_revision,
      'version_id',
        v_target.id,
      'version_number',
        v_target.version_number,
      'lifecycle_status',
        'draft',
      'correlation_id',
        v_correlation_id
    );

    perform platform_private.complete_resource_command(
      v_begin.command_receipt_id,
      v_result
    );
  end if;

  select *
  into v_read
  from platform_private.read_authenticated_resource_command_result(
    v_begin.command_receipt_id,
    false
  );

  command_receipt_id := v_read.command_receipt_id;
  receipt_status := v_read.receipt_status;
  playlist_id := p_playlist_id;
  resource_id := v_read.resource_id;
  authority_revision :=
    nullif(
      v_read.result_payload ->> 'authority_revision',
      ''
    )::bigint;
  version_id :=
    nullif(
      v_read.result_payload ->> 'version_id',
      ''
    )::uuid;
  version_number :=
    nullif(
      v_read.result_payload ->> 'version_number',
      ''
    )::bigint;
  lifecycle_status :=
    v_read.result_payload ->> 'lifecycle_status';
  result_payload := v_read.result_payload;
  idempotent_replay := false;
  return next;
end;
$function$;

revoke all
on function public.restore_playlist_from_archive(
  uuid,
  bigint,
  text,
  text,
  uuid
)
from public, anon;

grant execute
on function public.restore_playlist_from_archive(
  uuid,
  bigint,
  text,
  text,
  uuid
)
to authenticated;

-- Version-bound Playlist Preview, matching the existing Article nonce model.

create table public.wk_playlist_preview_links (
  id uuid primary key default gen_random_uuid(),
  nonce text not null unique default gen_random_uuid()::text,
  playlist_id uuid not null
    references public.wk_playlists(id)
    on delete cascade,
  version_id uuid not null
    references editorial.playlist_versions(id)
    on delete cascade,
  created_by uuid
    references auth.users(id)
    on delete set null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  revoked_at timestamptz,

  constraint wk_playlist_preview_links_nonce_check
    check (nullif(btrim(nonce), '') is not null),

  constraint wk_playlist_preview_links_expiry_check
    check (expires_at > created_at)
);

create index wk_playlist_preview_links_active_nonce_idx
on public.wk_playlist_preview_links(nonce)
where revoked_at is null;

create index wk_playlist_preview_links_playlist_created_idx
on public.wk_playlist_preview_links(
  playlist_id,
  created_at desc
);

alter table public.wk_playlist_preview_links
  enable row level security;

revoke all
on public.wk_playlist_preview_links
from public, anon, authenticated;

grant select, insert, update, delete
on public.wk_playlist_preview_links
to service_role;

create policy wk_playlist_preview_links_service_role_all
on public.wk_playlist_preview_links
for all
to service_role
using (true)
with check (true);

create or replace function
  public.create_playlist_preview_link(
    p_playlist_id uuid,
    p_version_id uuid default null,
    p_expires_at timestamptz default null
  )
returns table(
  nonce text,
  expires_at timestamptz,
  version_id uuid
)
language plpgsql
security definer
set search_path to
  'pg_catalog',
  'public',
  'auth',
  'editorial'
as $function$
declare
  v_binding editorial.playlist_resources%rowtype;
  v_version editorial.playlist_versions%rowtype;
  v_version_id uuid;
  v_nonce text := gen_random_uuid()::text;
  v_expires_at timestamptz :=
    coalesce(
      p_expires_at,
      now() + interval '7 days'
    );
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  if v_expires_at <= now() then
    raise exception
      'Preview expiry must be in the future';
  end if;

  select binding.*
  into v_binding
  from editorial.playlist_resources binding
  where binding.playlist_id = p_playlist_id;

  if not found then
    raise exception
      'Playlist Resource binding does not exist';
  end if;

  if not editorial.current_user_can_participate_playlist_review(
    v_binding.resource_id
  ) then
    raise exception
      'Playlist Preview permission is required';
  end if;

  v_version_id :=
    coalesce(
      p_version_id,
      v_binding.current_working_version_id,
      v_binding.current_submitted_version_id,
      v_binding.current_approved_version_id,
      v_binding.current_published_version_id
    );

  select version.*
  into v_version
  from editorial.playlist_versions version
  where version.id = v_version_id
    and version.playlist_id = p_playlist_id
    and version.resource_id =
          v_binding.resource_id;

  if not found then
    raise exception
      'Playlist Preview requires an immutable Playlist version';
  end if;

  insert into public.wk_playlist_preview_links (
    nonce,
    playlist_id,
    version_id,
    created_by,
    expires_at
  )
  values (
    v_nonce,
    p_playlist_id,
    v_version.id,
    auth.uid(),
    v_expires_at
  );

  nonce := v_nonce;
  expires_at := v_expires_at;
  version_id := v_version.id;
  return next;
end;
$function$;

revoke all
on function public.create_playlist_preview_link(
  uuid,
  uuid,
  timestamp with time zone
)
from public, anon;

grant execute
on function public.create_playlist_preview_link(
  uuid,
  uuid,
  timestamp with time zone
)
to authenticated, service_role;

create or replace function
  public.resolve_playlist_preview_nonce(
    p_nonce text
  )
returns jsonb
language sql
stable
security definer
set search_path to
  'pg_catalog',
  'public',
  'editorial'
as $function$
  with active_link as (
    select link.*
    from public.wk_playlist_preview_links link
    where link.nonce = p_nonce
      and link.revoked_at is null
      and link.expires_at > now()
    limit 1
  ),
  snapshot as (
    select
      link.*,
      editorial.playlist_version_snapshot_json(
        link.version_id
      ) as snapshot_json
    from active_link link
  )
  select
    snapshot.snapshot_json
    ||
    jsonb_build_object(
      'preview_nonce',
        snapshot.nonce,
      'preview_expires_at',
        snapshot.expires_at,
      'credits',
        coalesce(
          (
            select jsonb_agg(
              jsonb_build_object(
                'resource_id',
                  attachment.resource_id,
                'resource_kind',
                  attachment.resource_kind,
                'display_order',
                  attachment.display_order,
                'is_primary',
                  attachment.is_primary,
                'credit_id',
                  credit.id,
                'role',
                  credit.credit_role,
                'role_label',
                  credit.role_label_snapshot,
                'display_name',
                  credit.display_name_snapshot,
                'note',
                  credit.credit_note,
                'author_slug',
                  credit.registry_author_slug_snapshot,
                'username',
                  credit.user_username_snapshot
              )
              order by
                attachment.resource_kind,
                attachment.resource_id,
                attachment.display_order
            )
            from editorial.resource_credits attachment
            join editorial.credits credit
              on credit.id = attachment.credit_id
            join editorial.credit_governance governance
              on governance.credit_id = credit.id
            left join editorial.external_contributors contributor
              on contributor.id =
                   credit.external_contributor_id
            where attachment.target_version_type =
                    'playlist_version'
              and attachment.target_version_id =
                    snapshot.version_id
              and attachment.public_safe
              and governance.public_safe
              and governance.credit_state = 'active'
              and (
                credit.external_contributor_id is null
                or (
                  contributor.contributor_state = 'active'
                  and contributor.public_safe
                  and contributor.consent_status in (
                    'granted',
                    'not_required'
                  )
                )
              )
          ),
          '[]'::jsonb
        )
    )
  from snapshot;
$function$;

revoke all
on function public.resolve_playlist_preview_nonce(text)
from public;

grant execute
on function public.resolve_playlist_preview_nonce(text)
to anon, authenticated, service_role;

-- Extend the existing Review workspace rather than granting direct lifecycle
-- table access to the frontend.

create or replace function public.get_playlist_review_workspace(
  p_playlist_id uuid
)
returns jsonb
language plpgsql
stable
security definer
set search_path to
  'pg_catalog',
  'public',
  'auth',
  'editorial'
as $function$
declare
  v_playlist public.wk_playlists%rowtype;
  v_binding editorial.playlist_resources%rowtype;
  v_review_events jsonb;
  v_lifecycle_events jsonb;
  v_schedule jsonb;
  v_curator jsonb;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  select playlist.*
  into v_playlist
  from public.wk_playlists playlist
  where playlist.id = p_playlist_id;

  if not found then
    raise exception 'Playlist does not exist';
  end if;

  select binding.*
  into v_binding
  from editorial.playlist_resources binding
  where binding.playlist_id = p_playlist_id;

  if not found then
    raise exception
      'Playlist Resource binding does not exist';
  end if;

  if not editorial.current_user_can_participate_playlist_review(
    v_binding.resource_id
  ) then
    raise exception
      'Playlist Review participation permission is required';
  end if;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', event.id,
        'event_number', event.event_number,
        'target_version_id', event.target_version_id,
        'result_version_id', event.result_version_id,
        'action', event.action,
        'prior_status', event.prior_status,
        'resulting_status', event.resulting_status,
        'reason', event.reason,
        'actor_id', event.actor_id,
        'command_receipt_id', event.command_receipt_id,
        'correlation_id', event.correlation_id,
        'created_at', event.created_at
      )
      order by event.event_number
    ),
    '[]'::jsonb
  )
  into v_review_events
  from editorial.playlist_review_events event
  where event.resource_id =
          v_binding.resource_id;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', event.id,
        'event_number', event.event_number,
        'version_id', event.version_id,
        'action', event.action,
        'prior_status', event.prior_status,
        'resulting_status', event.resulting_status,
        'note', event.note,
        'metadata', event.metadata,
        'actor_id', event.actor_id,
        'command_receipt_id', event.command_receipt_id,
        'created_at', event.created_at
      )
      order by event.event_number
    ),
    '[]'::jsonb
  )
  into v_lifecycle_events
  from editorial.playlist_lifecycle_events event
  where event.resource_id =
          v_binding.resource_id;

  select jsonb_build_object(
    'id', scheduled.id,
    'version_id', scheduled.version_id,
    'run_after', scheduled.run_after,
    'status', scheduled.status,
    'note', scheduled.note,
    'created_by', scheduled.created_by,
    'created_at', scheduled.created_at,
    'updated_at', scheduled.updated_at,
    'published_at', scheduled.published_at,
    'failure_reason', scheduled.failure_reason
  )
  into v_schedule
  from editorial.playlist_scheduled_publications scheduled
  where scheduled.playlist_id = p_playlist_id
  order by scheduled.created_at desc
  limit 1;

  if v_playlist.curator_credit_id is not null then
    select jsonb_build_object(
      'credit_id', credit.id,
      'role', credit.credit_role,
      'display_name', credit.display_name_snapshot,
      'author_slug', credit.registry_author_slug_snapshot,
      'username', credit.user_username_snapshot,
      'registry_author_id', credit.registry_author_id,
      'user_id', credit.user_id,
      'public_safe', governance.public_safe,
      'credit_state', governance.credit_state,
      'governance_revision',
        governance.governance_revision
    )
    into v_curator
    from editorial.credits credit
    join editorial.credit_governance governance
      on governance.credit_id = credit.id
    where credit.id =
      v_playlist.curator_credit_id;
  end if;

  return jsonb_build_object(
    'playlist',
      jsonb_build_object(
        'id', v_playlist.id,
        'title', v_playlist.title,
        'slug', v_playlist.slug,
        'description', v_playlist.description,
        'curator_credit_id',
          v_playlist.curator_credit_id,
        'curator_label',
          v_playlist.curator_label,
        'status', v_playlist.status,
        'authority_revision',
          v_playlist.authority_revision,
        'metadata', v_playlist.metadata,
        'created_at', v_playlist.created_at,
        'updated_at', v_playlist.updated_at
      ),
    'resource_id',
      v_binding.resource_id,
    'current_working_version_id',
      v_binding.current_working_version_id,
    'current_submitted_version_id',
      v_binding.current_submitted_version_id,
    'current_approved_version_id',
      v_binding.current_approved_version_id,
    'current_published_version_id',
      v_binding.current_published_version_id,
    'working_version',
      editorial.playlist_version_snapshot_json(
        v_binding.current_working_version_id
      ),
    'submitted_version',
      editorial.playlist_version_snapshot_json(
        v_binding.current_submitted_version_id
      ),
    'approved_version',
      editorial.playlist_version_snapshot_json(
        v_binding.current_approved_version_id
      ),
    'published_version',
      editorial.playlist_version_snapshot_json(
        v_binding.current_published_version_id
      ),
    'curator', v_curator,
    'schedule', v_schedule,
    'review_events', v_review_events,
    'lifecycle_events', v_lifecycle_events,
    'can_edit',
      editorial.current_user_can_edit_playlist(
        v_binding.resource_id
      ),
    'can_manage_review',
      coalesce(
        public.current_user_is_administrator(),
        false
      )
      or coalesce(
        public.current_user_has_capability(
          'manage_review_queue'
        ),
        false
      ),
    'can_publish',
      editorial.current_user_can_publish_playlist(
        v_binding.resource_id
      )
  );
end;
$function$;

-- Exact Top 50 Curator convergence. Reuse an existing active public Curator
-- Credit for Hafare if one exists, otherwise create the narrow Registry-backed
-- Credit with a database-generated identity. Do not change Playlist authority
-- revision or immutable content fingerprints.

do $phase_5b_m232_top50_curator_convergence$
declare
  v_playlist public.wk_playlists%rowtype;
  v_binding editorial.playlist_resources%rowtype;
  v_author public.registry_authors%rowtype;
  v_curator record;
  v_credit_id uuid;
  v_version record;
  v_immutable_guard_count bigint;
  v_immutable_guard_trigger text;
begin
  select playlist.*
  into v_playlist
  from public.wk_playlists playlist
  where playlist.slug =
          'top-50-kenyan-songs-of-2025'
    and playlist.title =
          'Top 50 Kenyan Songs Of 2025'
    and playlist.status = 'published'
    and playlist.authority_revision = 54
    and playlist.curator_label =
          'Hafare Segelan'
  for update;

  if not found then
    raise exception
      'STOP: Top 50 Playlist changed before Curator convergence';
  end if;

  select binding.*
  into v_binding
  from editorial.playlist_resources binding
  where binding.playlist_id = v_playlist.id
  for update;

  if not found then
    raise exception
      'STOP: Top 50 Playlist Resource binding is missing';
  end if;

  select author_record.*
  into v_author
  from public.registry_authors author_record
  where author_record.id =
          'c318a8c5-3ad8-4adc-9991-953ab24e7da6'::uuid
    and author_record.slug = 'hafare-segelan'
    and author_record.name = 'Hafare Segelan';

  if not found then
    raise exception
      'STOP: Hafare Segelan Registry Author is missing';
  end if;

  if to_regprocedure(
       'editorial.prevent_immutable_playlist_trust_mutation()'
     ) is null
  then
    raise exception
      'STOP: Immutable Playlist Trust insert guard is missing';
  end if;

  select
    count(*),
    min(trigger_row.tgname)
  into
    v_immutable_guard_count,
    v_immutable_guard_trigger
  from pg_trigger trigger_row
  join pg_class relation
    on relation.oid = trigger_row.tgrelid
  join pg_namespace namespace
    on namespace.oid = relation.relnamespace
  where namespace.nspname = 'editorial'
    and relation.relname = 'resource_credits'
    and not trigger_row.tgisinternal
    and trigger_row.tgfoid =
      'editorial.prevent_immutable_playlist_trust_mutation()'::regprocedure
    and trigger_row.tgenabled <> 'D';

  if v_immutable_guard_count <> 1
     or nullif(
          btrim(v_immutable_guard_trigger),
          ''
        ) is null
  then
    raise exception
      'STOP: Expected exactly one enabled immutable Playlist Trust guard on resource_credits, found %',
      v_immutable_guard_count;
  end if;

  select *
  into v_curator
  from editorial.resolve_playlist_curator_credit(
    v_author.id,
    null,
    null
  );

  v_credit_id := v_curator.credit_id;

  update public.wk_playlists
  set
    curator_credit_id = v_credit_id,
    curator_label = v_author.name
  where id = v_playlist.id;

  -- Migration-only historical convergence.
  --
  -- Runtime immutable Trust remains authoritative. Only the existing
  -- immutable INSERT guard on resource_credits is disabled here. The normal
  -- resource_credits integrity trigger and the M232 Curator-identity trigger
  -- remain enabled. PostgreSQL DDL is transactional, so any failure restores
  -- the original trigger state with the transaction rollback.
  execute format(
    'alter table editorial.resource_credits disable trigger %I',
    v_immutable_guard_trigger
  );

  for v_version in
    select
      version.id,
      version.resource_id,
      version.created_by
    from editorial.playlist_versions version
    where version.playlist_id = v_playlist.id
      and version.resource_id =
            v_binding.resource_id
      and version.version_kind in (
        'submitted',
        'approved',
        'published'
      )
      and version.content_fingerprint =
        '59e4c0e4320357750ca71981e27ecfa89e3a7aef4074efe5f3453d63d0f548b7'
      and version.item_count = 50
    order by version.version_number
  loop
    insert into editorial.resource_credits (
      resource_id,
      resource_kind,
      target_version_type,
      target_version_id,
      credit_id,
      display_order,
      is_primary,
      public_safe,
      created_by
    )
    values (
      v_version.resource_id,
      'playlist',
      'playlist_version',
      v_version.id,
      v_credit_id,
      0,
      true,
      true,
      v_version.created_by
    );

    update editorial.playlist_version_trust_revisions
    set
      credit_revision =
        credit_revision + 1,
      updated_at = now()
    where playlist_version_id =
            v_version.id;
  end loop;

  execute format(
    'alter table editorial.resource_credits enable trigger %I',
    v_immutable_guard_trigger
  );

  if not exists (
    select 1
    from pg_trigger trigger_row
    join pg_class relation
      on relation.oid = trigger_row.tgrelid
    join pg_namespace namespace
      on namespace.oid = relation.relnamespace
    where namespace.nspname = 'editorial'
      and relation.relname = 'resource_credits'
      and trigger_row.tgname =
            v_immutable_guard_trigger
      and not trigger_row.tgisinternal
      and trigger_row.tgfoid =
        'editorial.prevent_immutable_playlist_trust_mutation()'::regprocedure
      and trigger_row.tgenabled <> 'D'
  ) then
    raise exception
      'STOP: Immutable Playlist Trust guard was not restored after Top 50 Curator convergence';
  end if;

  if (
    select count(*)
    from editorial.resource_credits attachment
    join editorial.playlist_versions version
      on version.id =
           attachment.target_version_id
    where version.playlist_id =
            v_playlist.id
      and attachment.target_version_type =
            'playlist_version'
      and attachment.resource_kind = 'playlist'
      and attachment.resource_id =
            v_binding.resource_id
      and attachment.credit_id =
            v_credit_id
      and attachment.public_safe
      and attachment.is_primary
  ) <> 3 then
    raise exception
      'STOP: Top 50 Curator Credit did not converge across all immutable versions';
  end if;
end;
$phase_5b_m232_top50_curator_convergence$;

-- Backfill the already accepted first publication into the lifecycle ledger.

do $phase_5b_m232_top50_publication_history$
declare
  v_snapshot editorial.playlist_publication_snapshots%rowtype;
begin
  select snapshot.*
  into v_snapshot
  from editorial.playlist_publication_snapshots snapshot
  join public.wk_playlists playlist
    on playlist.id = snapshot.playlist_id
  join editorial.playlist_resources binding
    on binding.playlist_id = playlist.id
   and binding.current_published_version_id =
         snapshot.version_id
  where playlist.slug =
          'top-50-kenyan-songs-of-2025'
  order by snapshot.published_at desc
  limit 1;

  if not found then
    raise exception
      'STOP: Top 50 publication snapshot is missing';
  end if;

  perform editorial.append_playlist_lifecycle_event(
    v_snapshot.resource_id,
    v_snapshot.playlist_id,
    v_snapshot.version_id,
    'published',
    'approved',
    'published',
    'First accepted Phase 5B Playlist publication.',
    v_snapshot.published_by,
    v_snapshot.command_receipt_id,
    jsonb_build_object(
      'publication_snapshot_id',
        v_snapshot.id,
      'published_at',
        v_snapshot.published_at,
      'backfilled_by_m232',
        true
    )
  );
end;
$phase_5b_m232_top50_publication_history$;

do $phase_5b_m232_postconditions$
declare
  v_command_count bigint;
  v_rls_count bigint;
  v_top50_credit_count bigint;
begin
  select count(*)
  into v_command_count
  from platform_private.command_types
  where command_type in (
    'playlist.curator.set',
    'playlist.schedule',
    'playlist.unschedule',
    'playlist.unpublish',
    'playlist.archive',
    'playlist.restore'
  )
    and enabled;

  if v_command_count <> 6 then
    raise exception
      'STOP: Expected six enabled M232 command types, found %',
      v_command_count;
  end if;

  select count(*)
  into v_rls_count
  from pg_class relation
  join pg_namespace namespace
    on namespace.oid = relation.relnamespace
  where (
    namespace.nspname,
    relation.relname
  ) in (
    ('editorial','article_lifecycle_events'),
    ('editorial','article_scheduled_publications'),
    ('editorial','playlist_item_resources'),
    ('editorial','playlist_versions'),
    ('editorial','playlist_version_items'),
    ('editorial','playlist_version_trust_revisions')
  )
    and relation.relrowsecurity;

  if v_rls_count <> 6 then
    raise exception
      'STOP: Expected six hardened lifecycle/version tables, found %',
      v_rls_count;
  end if;

  if to_regclass(
       'editorial.playlist_scheduled_publications'
     ) is null
     or to_regclass(
       'editorial.playlist_lifecycle_events'
     ) is null
     or to_regclass(
       'public.wk_playlist_preview_links'
     ) is null
     or to_regprocedure(
       'public.set_playlist_curator(uuid,bigint,uuid,uuid,text,uuid)'
     ) is null
     or to_regprocedure(
       'public.schedule_playlist_publication(uuid,bigint,uuid,timestamp with time zone,text,text,uuid)'
     ) is null
     or to_regprocedure(
       'public.unschedule_playlist_publication(uuid,bigint,text,text,uuid)'
     ) is null
     or to_regprocedure(
       'public.publish_due_playlist_publications(integer)'
     ) is null
     or to_regprocedure(
       'public.unpublish_playlist(uuid,bigint,text,text,uuid)'
     ) is null
     or to_regprocedure(
       'public.archive_playlist(uuid,bigint,text,text,uuid)'
     ) is null
     or to_regprocedure(
       'public.restore_playlist_from_archive(uuid,bigint,text,text,uuid)'
     ) is null
     or to_regprocedure(
       'public.create_playlist_preview_link(uuid,uuid,timestamp with time zone)'
     ) is null
     or to_regprocedure(
       'public.resolve_playlist_preview_nonce(text)'
     ) is null
  then
    raise exception
      'STOP: One or more M232 lifecycle or Preview functions are missing';
  end if;

  if not exists (
    select 1
    from public.wk_playlists playlist
    join editorial.credits credit
      on credit.id = playlist.curator_credit_id
    join editorial.credit_governance governance
      on governance.credit_id = credit.id
    join public.registry_authors author_record
      on author_record.id =
           credit.registry_author_id
    where playlist.slug =
            'top-50-kenyan-songs-of-2025'
      and playlist.status = 'published'
      and playlist.authority_revision = 54
      and playlist.curator_label =
            'Hafare Segelan'
      and credit.credit_role = 'curator'
      and governance.credit_state = 'active'
      and governance.public_safe
      and author_record.id =
        'c318a8c5-3ad8-4adc-9991-953ab24e7da6'::uuid
      and author_record.slug = 'hafare-segelan'
  ) then
    raise exception
      'STOP: Top 50 durable Curator authority did not converge';
  end if;

  select count(*)
  into v_top50_credit_count
  from editorial.resource_credits attachment
  join editorial.playlist_versions version
    on version.id =
         attachment.target_version_id
  join public.wk_playlists playlist
    on playlist.id =
         version.playlist_id
  join editorial.credits credit
    on credit.id =
         attachment.credit_id
  where playlist.slug =
          'top-50-kenyan-songs-of-2025'
    and version.version_kind in (
      'submitted',
      'approved',
      'published'
    )
    and attachment.resource_kind = 'playlist'
    and attachment.public_safe
    and attachment.is_primary
    and attachment.display_order = 0
    and credit.credit_role = 'curator'
    and credit.registry_author_slug_snapshot =
          'hafare-segelan';

  if v_top50_credit_count <> 3 then
    raise exception
      'STOP: Expected three historical Top 50 Curator attachments, found %',
      v_top50_credit_count;
  end if;

  if (
    select count(*)
    from jsonb_array_elements(
      coalesce(
        public.get_public_playlist(
          'top-50-kenyan-songs-of-2025'
        ) -> 'credits',
        '[]'::jsonb
      )
    ) credit
    where credit ->> 'role' = 'curator'
      and credit ->> 'display_name' =
            'Hafare Segelan'
      and credit ->> 'author_slug' =
            'hafare-segelan'
  ) <> 1 then
    raise exception
      'STOP: Public Top 50 Curator Credit is not linkable';
  end if;

  if not exists (
    select 1
    from public.wk_playlists playlist
    join editorial.playlist_resources binding
      on binding.playlist_id = playlist.id
    join editorial.playlist_versions version
      on version.id =
           binding.current_published_version_id
    where playlist.slug =
            'top-50-kenyan-songs-of-2025'
      and playlist.status = 'published'
      and playlist.authority_revision = 54
      and version.version_kind = 'published'
      and version.content_fingerprint =
        '59e4c0e4320357750ca71981e27ecfa89e3a7aef4074efe5f3453d63d0f548b7'
      and version.item_count = 50
  ) then
    raise exception
      'STOP: Top 50 publication identity changed during M232';
  end if;
end;
$phase_5b_m232_postconditions$;

commit;
