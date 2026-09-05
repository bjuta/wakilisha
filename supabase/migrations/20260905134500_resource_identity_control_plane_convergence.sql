-- WAKILISHA Resource identity + replay ACL control-plane convergence.
--
-- Repairs three audited control-plane gaps at exact 91 / 20260905102000 authority:
-- 1. restore the playlist_item branch and typed-table trigger in the shared
--    Resource binding invariant;
-- 2. converge every existing Registry Artist to one stable Resource identity
--    and keep future Registry Artists synchronized;
-- 3. close the remaining native-preview relation privilege parity gap for
--    TRUNCATE / REFERENCES / TRIGGER / MAINTAIN without changing CRUD authority.
--
-- Historical migration rows are not rewritten.

begin;

set local statement_timeout = '180s';
set local lock_timeout = '5s';

select pg_catalog.pg_advisory_xact_lock(
  pg_catalog.hashtextextended(
    'resource-identity-control-plane-convergence',
    0
  )
);

do $preflight$
declare
  v_binding_definition text;
  v_rel_fp text;
begin
  if (select count(*) from supabase_migrations.schema_migrations) <> 91
     or (select max(version) from supabase_migrations.schema_migrations) <> '20260905102000'
  then
    raise exception
      'STOP: Resource/control-plane convergence requires exact 91 / 20260905102000 predecessor authority';
  end if;

  if (select count(*) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public') <> 764
     or (select count(*) from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relkind in ('r','p','v','m','f')) <> 235
     or (select count(*) from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relkind='S') <> 4
  then
    raise exception
      'STOP: public authority object inventory drifted before Resource/control-plane convergence';
  end if;

  if to_regclass('editorial.playlist_item_resources') is null
     or to_regclass('editorial.registry_artist_resources') is null
     or to_regclass('public.registry_artists') is null
     or to_regprocedure('editorial.assert_resource_binding_integrity()') is null
  then
    raise exception
      'STOP: required Resource or Registry authority is missing';
  end if;

  if exists (
    select 1
    from editorial.registry_artist_resources b
    left join public.registry_artists a on a.id=b.artist_id
    left join editorial.resources r
      on r.id=b.resource_id
     and r.resource_kind='registry_artist'
    where a.id is null or r.id is null
  ) then
    raise exception
      'STOP: Registry Artist typed binding contains an orphan or kind mismatch';
  end if;

  if exists (
    select artist_id
    from editorial.registry_artist_resources
    group by artist_id
    having count(*) <> 1
  ) then
    raise exception
      'STOP: Registry Artist typed binding is not one-to-one';
  end if;

  if exists (
    select 1
    from public.registry_artists
    where status not in ('active','draft','needs_review','archived')
  ) then
    raise exception
      'STOP: Registry Artist status vocabulary drifted';
  end if;

  v_binding_definition :=
    pg_get_functiondef(
      'editorial.assert_resource_binding_integrity()'::regprocedure
    );

  if position('when ''article''' in v_binding_definition)=0
     or position('when ''playlist''' in v_binding_definition)=0
     or position('when ''registry_artist''' in v_binding_definition)=0
     or position('when ''correction_case''' in v_binding_definition)=0
     or position('when ''media_asset''' in v_binding_definition)=0
     or position('when ''person''' in v_binding_definition)=0
     or position('when ''organization''' in v_binding_definition)=0
     or position('when ''audio_show''' in v_binding_definition)=0
     or position('when ''audio_season''' in v_binding_definition)=0
     or position('when ''audio_episode''' in v_binding_definition)=0
     or position('when ''standalone_audio''' in v_binding_definition)=0
     or position('when ''show''' in v_binding_definition)=0
     or position('when ''show_episode''' in v_binding_definition)=0
     or position('when ''video_episode''' in v_binding_definition)=0
     or position('when ''standalone_video''' in v_binding_definition)=0
     or position('when ''field_submission''' in v_binding_definition)=0
  then
    raise exception
      'STOP: existing Resource binding branches drifted before repair';
  end if;

  if position('when ''playlist_item''' in v_binding_definition) > 0 then
    raise exception
      'STOP: playlist_item Resource binding branch already exists; repair assumptions changed';
  end if;

  with rels as (
    select c.oid,n.nspname,c.relname,c.relkind
    from pg_class c
    join pg_namespace n on n.oid=c.relnamespace
    where n.nspname='public'
      and c.relkind in ('r','p','v','m','f')
  ),
  rel_matrix as (
    select
      nspname||'.'||relname||'|'||relkind::text||'|'||role_name||'|'||priv
        as item,
      has_table_privilege(role_name,oid,priv) as allowed
    from rels
    cross join (values ('anon'),('authenticated'),('service_role'))
      roles(role_name)
    cross join (
      values
        ('SELECT'),('INSERT'),('UPDATE'),('DELETE'),
        ('TRUNCATE'),('REFERENCES'),('TRIGGER'),('MAINTAIN')
    ) p(priv)
  )
  select md5(
    string_agg(
      item||'|'||allowed::text,
      E'\n'
      order by item
    )
  )
  into v_rel_fp
  from rel_matrix;

  if v_rel_fp not in (
    'd63c327fbab82ece6250d15d93cdb905',
    '4917769c1828fafa2f3bacbc77a5c5b9'
  ) then
    raise exception
      'STOP: full public relation ACL matrix is neither accepted Production nor known native-preview drift: %',
      v_rel_fp;
  end if;
end;
$preflight$;

create or replace function editorial.assert_resource_binding_integrity()
returns trigger
language plpgsql
security definer
set search_path to 'pg_catalog', 'editorial', 'audio'
as $function$
declare
  target_resource_id uuid;
  target_kind text;
  binding_count integer;
begin
  if tg_table_name = 'resources' then
    if tg_op = 'DELETE' then
      return null;
    end if;
    target_resource_id := new.id;
  else
    if tg_op = 'DELETE' then
      target_resource_id := old.resource_id;
    else
      target_resource_id := new.resource_id;
    end if;
  end if;

  select resource_kind
  into target_kind
  from editorial.resources
  where id = target_resource_id;

  if not found then
    return null;
  end if;

  case target_kind
    when 'article' then
      select count(*) into binding_count
      from editorial.article_resources
      where resource_id = target_resource_id;
    when 'playlist' then
      select count(*) into binding_count
      from editorial.playlist_resources
      where resource_id = target_resource_id;
    when 'playlist_item' then
      select count(*) into binding_count
      from editorial.playlist_item_resources
      where resource_id = target_resource_id;
    when 'registry_artist' then
      select count(*) into binding_count
      from editorial.registry_artist_resources
      where resource_id = target_resource_id;
    when 'correction_case' then
      select count(*) into binding_count
      from editorial.correction_cases
      where resource_id = target_resource_id;
    when 'media_asset' then
      select count(*) into binding_count
      from editorial.media_asset_resources
      where resource_id = target_resource_id;
    when 'person' then
      select count(*) into binding_count
      from editorial.people
      where resource_id = target_resource_id;
    when 'organization' then
      select count(*) into binding_count
      from editorial.organizations
      where resource_id = target_resource_id;
    when 'audio_show' then
      select count(*) into binding_count
      from editorial.audio_show_resources
      where resource_id = target_resource_id;
    when 'audio_season' then
      select count(*) into binding_count
      from editorial.audio_season_resources
      where resource_id = target_resource_id;
    when 'audio_episode' then
      select count(*) into binding_count
      from editorial.audio_publication_resources
      where resource_id = target_resource_id
        and resource_kind = 'audio_episode';
    when 'standalone_audio' then
      select count(*) into binding_count
      from editorial.audio_publication_resources
      where resource_id = target_resource_id
        and resource_kind = 'standalone_audio';
    when 'show' then
      select count(*) into binding_count
      from editorial.shows
      where resource_id = target_resource_id;
    when 'show_episode' then
      select count(*) into binding_count
      from editorial.show_episodes
      where resource_id = target_resource_id;
    when 'video_episode' then
      select count(*) into binding_count
      from editorial.video_publication_resources
      where resource_id = target_resource_id
        and resource_kind = 'video_episode';
    when 'standalone_video' then
      select count(*) into binding_count
      from editorial.video_publication_resources
      where resource_id = target_resource_id
        and resource_kind = 'standalone_video';
    when 'field_submission' then
      select count(*) into binding_count
      from editorial.field_submissions
      where resource_id = target_resource_id
        and resource_kind = 'field_submission';
    else
      raise exception
        'Unsupported resource kind: %',
        target_kind;
  end case;

  if binding_count <> 1 then
    raise exception
      'Resource % with kind % must have exactly one typed binding.',
      target_resource_id,
      target_kind;
  end if;

  return null;
end;
$function$;

revoke all
  on function editorial.assert_resource_binding_integrity()
  from public, anon, authenticated, service_role;

do $playlist_item_trigger$
begin
  if not exists (
    select 1
    from pg_trigger
    where tgrelid='editorial.playlist_item_resources'::regclass
      and tgname='playlist_item_resources_binding_integrity'
      and not tgisinternal
  ) then
    create constraint trigger playlist_item_resources_binding_integrity
    after insert or update or delete
    on editorial.playlist_item_resources
    deferrable initially deferred
    for each row
    execute function editorial.assert_resource_binding_integrity();
  end if;
end;
$playlist_item_trigger$;

create or replace function editorial.ensure_registry_artist_resource_identity()
returns trigger
language plpgsql
security definer
set search_path to 'pg_catalog', 'public', 'editorial'
as $function$
declare
  v_resource_id uuid;
  v_visibility text;
  v_lifecycle text;
begin
  v_visibility :=
    case
      when new.status='active' then 'public'
      else 'internal'
    end;

  v_lifecycle :=
    case
      when new.status='draft' then 'draft'
      when new.status='archived' then 'archived'
      else 'active'
    end;

  select resource_id
  into v_resource_id
  from editorial.registry_artist_resources
  where artist_id=new.id;

  if v_resource_id is null then
    insert into editorial.resources(
      resource_kind,
      visibility,
      lifecycle_state
    )
    values (
      'registry_artist',
      v_visibility,
      v_lifecycle
    )
    returning id into v_resource_id;

    insert into editorial.registry_artist_resources(
      resource_id,
      resource_kind,
      artist_id
    )
    values (
      v_resource_id,
      'registry_artist',
      new.id
    );
  else
    update editorial.resources
    set
      visibility=v_visibility,
      lifecycle_state=v_lifecycle,
      updated_at=now()
    where id=v_resource_id
      and resource_kind='registry_artist';
  end if;

  return new;
end;
$function$;

revoke all
  on function editorial.ensure_registry_artist_resource_identity()
  from public, anon, authenticated, service_role;

drop trigger if exists
  registry_artists_resource_identity_sync
on public.registry_artists;

create trigger registry_artists_resource_identity_sync
after insert or update of status
on public.registry_artists
for each row
execute function editorial.ensure_registry_artist_resource_identity();

create temporary table pg_temp.registry_artist_resource_backfill (
  artist_id uuid primary key,
  resource_id uuid not null unique,
  visibility text not null,
  lifecycle_state text not null
) on commit drop;

insert into pg_temp.registry_artist_resource_backfill(
  artist_id,
  resource_id,
  visibility,
  lifecycle_state
)
select
  artist.id,
  extensions.gen_random_uuid(),
  case
    when artist.status='active' then 'public'
    else 'internal'
  end,
  case
    when artist.status='draft' then 'draft'
    when artist.status='archived' then 'archived'
    else 'active'
  end
from public.registry_artists artist
left join editorial.registry_artist_resources binding
  on binding.artist_id=artist.id
where binding.artist_id is null;

insert into editorial.resources(
  id,
  resource_kind,
  visibility,
  lifecycle_state
)
select
  resource_id,
  'registry_artist',
  visibility,
  lifecycle_state
from pg_temp.registry_artist_resource_backfill;

insert into editorial.registry_artist_resources(
  resource_id,
  resource_kind,
  artist_id
)
select
  resource_id,
  'registry_artist',
  artist_id
from pg_temp.registry_artist_resource_backfill;

do $acl$
declare
  rel text;
begin
  foreach rel in array array[
    'artist_claim_evidence',
    'artist_claim_requests',
    'artist_profile_presentations',
    'artist_representation_events',
    'artist_representations',
    'community_artist_username_reservations',
    'registry_missing_artist_intake_queue',
    'registry_missing_artist_latest_submission',
    'registry_provenance_links',
    'registry_provider_track_suggestion_artists',
    'registry_provider_track_suggestions',
    'registry_relationship_consolidation_queue',
    'registry_relationship_duplicate_keys',
    'registry_relationship_endpoint_work_queue',
    'registry_relationship_evidence_readiness_queue',
    'registry_unresolved_relationship_endpoints',
    'wk_article_preview_links',
    'wk_playlist_items',
    'wk_playlist_preview_links',
    'wk_playlists',
    'wk_publishing_channels',
    'wk_publishing_content_kinds',
    'wk_publishing_workspace_items',
    'wk_resource_index',
    'wk_resource_owner_index'
  ] loop
    if to_regclass('public.'||quote_ident(rel)) is null then
      raise exception
        'STOP: expected relation missing during ACL convergence: %',
        rel;
    end if;

    execute format(
      'revoke truncate, references, trigger on table public.%I from anon, authenticated',
      rel
    );
  end loop;

  foreach rel in array array[
    'artist_claim_evidence',
    'artist_claim_requests',
    'artist_profile_presentations',
    'artist_representation_events',
    'artist_representations',
    'community_artist_username_reservations',
    'registry_missing_artist_intake_queue',
    'registry_missing_artist_latest_submission',
    'registry_provenance_links',
    'registry_relationship_consolidation_queue',
    'registry_relationship_duplicate_keys',
    'registry_relationship_endpoint_work_queue',
    'registry_relationship_evidence_readiness_queue',
    'registry_unresolved_relationship_endpoints',
    'wk_article_preview_links',
    'wk_playlist_preview_links',
    'wk_publishing_channels',
    'wk_publishing_content_kinds',
    'wk_publishing_workspace_items',
    'wk_resource_index',
    'wk_resource_owner_index'
  ] loop
    execute format(
      'revoke maintain on table public.%I from anon, authenticated',
      rel
    );
  end loop;
end;
$acl$;

set constraints all immediate;
set constraints all deferred;

do $postcheck$
declare
  v_binding_definition text;
  v_rel_fp text;
begin
  if exists (
    select 1
    from public.registry_artists artist
    left join editorial.registry_artist_resources binding
      on binding.artist_id=artist.id
    left join editorial.resources resource_row
      on resource_row.id=binding.resource_id
     and resource_row.resource_kind='registry_artist'
    where binding.artist_id is null
       or resource_row.id is null
  ) then
    raise exception
      'STOP: Registry Artist Resource convergence left an unbound artist';
  end if;

  if (
    select count(*)
    from editorial.registry_artist_resources
  ) <> (
    select count(*)
    from public.registry_artists
  ) then
    raise exception
      'STOP: Registry Artist Resource cardinality does not match canonical Registry';
  end if;

  if exists (
    select 1
    from public.registry_artists artist
    join editorial.registry_artist_resources binding
      on binding.artist_id=artist.id
    join editorial.resources resource_row
      on resource_row.id=binding.resource_id
    where resource_row.visibility is distinct from
          case when artist.status='active' then 'public' else 'internal' end
       or resource_row.lifecycle_state is distinct from
          case
            when artist.status='draft' then 'draft'
            when artist.status='archived' then 'archived'
            else 'active'
          end
  ) then
    raise exception
      'STOP: Registry Artist Resource lifecycle mapping drifted';
  end if;

  v_binding_definition :=
    pg_get_functiondef(
      'editorial.assert_resource_binding_integrity()'::regprocedure
    );

  if position('when ''playlist_item''' in v_binding_definition)=0
     or not (
       select prosecdef
       from pg_proc
       where oid='editorial.assert_resource_binding_integrity()'::regprocedure
     )
     or (
       select proconfig
       from pg_proc
       where oid='editorial.assert_resource_binding_integrity()'::regprocedure
     ) is distinct from
       array['search_path=pg_catalog, editorial, audio']::text[]
  then
    raise exception
      'STOP: shared Resource binding function did not preserve accepted authority';
  end if;

  if not exists (
    select 1
    from pg_trigger
    where tgrelid='editorial.playlist_item_resources'::regclass
      and tgname='playlist_item_resources_binding_integrity'
      and tgdeferrable
      and tginitdeferred
      and not tgisinternal
  ) then
    raise exception
      'STOP: playlist_item typed binding trigger was not restored';
  end if;

  if not exists (
    select 1
    from pg_trigger
    where tgrelid='public.registry_artists'::regclass
      and tgname='registry_artists_resource_identity_sync'
      and not tgisinternal
  ) then
    raise exception
      'STOP: Registry Artist Resource provisioning trigger is missing';
  end if;

  with rels as (
    select c.oid,n.nspname,c.relname,c.relkind
    from pg_class c
    join pg_namespace n on n.oid=c.relnamespace
    where n.nspname='public'
      and c.relkind in ('r','p','v','m','f')
  ),
  rel_matrix as (
    select
      nspname||'.'||relname||'|'||relkind::text||'|'||role_name||'|'||priv
        as item,
      has_table_privilege(role_name,oid,priv) as allowed
    from rels
    cross join (values ('anon'),('authenticated'),('service_role'))
      roles(role_name)
    cross join (
      values
        ('SELECT'),('INSERT'),('UPDATE'),('DELETE'),
        ('TRUNCATE'),('REFERENCES'),('TRIGGER'),('MAINTAIN')
    ) p(priv)
  )
  select md5(
    string_agg(
      item||'|'||allowed::text,
      E'\n'
      order by item
    )
  )
  into v_rel_fp
  from rel_matrix;

  if v_rel_fp <> 'd63c327fbab82ece6250d15d93cdb905' then
    raise exception
      'STOP: full public relation ACL parity did not converge: %',
      v_rel_fp;
  end if;
end;
$postcheck$;

commit;
