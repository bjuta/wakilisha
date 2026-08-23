begin;

-- Rich editorial canonical primitives, Milestone 1.
-- Shared version-bound Discovery authority for Article, Playlist, and Audio.

do $preflight$
declare
  v_conflicting_names bigint;
  v_duplicate_snapshot_terms bigint;
begin
  if to_regclass('editorial.article_versions') is null
     or to_regclass('editorial.playlist_versions') is null
     or to_regclass('editorial.playlist_resources') is null
     or to_regclass('editorial.playlist_version_items') is null
     or to_regclass('editorial.playlist_version_trust_revisions') is null
     or to_regclass('editorial.resource_citations') is null
     or to_regclass('editorial.resource_credits') is null
     or to_regclass('audio.publication_versions') is null
     or to_regclass('audio.publication_version_chapters') is null
     or to_regclass('editorial.audio_publication_resources') is null
     or to_regclass('public.registry_taxonomy_terms') is null
     or to_regclass('editorial.resources') is null
  then
    raise exception 'STOP: Rich editorial M1 dependencies are missing';
  end if;

  if to_regprocedure('editorial.playlist_current_content_fingerprint(uuid)') is null
     or to_regprocedure('audio.publication_content_fingerprint(uuid)') is null
     or to_regprocedure('editorial.current_user_can_view_playlist(uuid)') is null
     or to_regprocedure('editorial.current_user_can_edit_playlist(uuid)') is null
     or to_regprocedure('editorial.current_user_can_view_audio(uuid)') is null
     or to_regprocedure('editorial.current_user_can_edit_audio(uuid)') is null
     or to_regprocedure('platform_private.begin_authenticated_resource_command(text,uuid,text,jsonb)') is null
     or to_regprocedure('platform_private.complete_resource_command(uuid,jsonb)') is null
     or to_regprocedure('platform_private.reject_resource_command(uuid,text,text,jsonb)') is null
     or to_regprocedure('platform_private.read_authenticated_resource_command_result(uuid,boolean)') is null
     or to_regprocedure('editorial.copy_audio_version_trust_to_version(uuid,uuid)') is null
  then
    raise exception 'STOP: Rich editorial M1 authority helpers are missing';
  end if;

  if to_regclass('editorial.resource_version_taxonomy_terms') is not null
     or to_regclass('editorial.resource_version_editorial_metadata') is not null
     or to_regprocedure('public.get_resource_version_editorial_metadata(text,uuid)') is not null
     or to_regprocedure('public.save_resource_version_editorial_metadata(text,uuid,bigint,uuid[],uuid[],text,text,text[],text,text,uuid)') is not null
     or exists (
       select 1
       from platform_private.command_types command_type
       where command_type.command_type = 'editorial.discovery.save'
     )
  then
    raise exception 'STOP: Rich editorial M1 authority already exists';
  end if;

  if not exists (
    select 1
    from pg_indexes
    where schemaname = 'public'
      and tablename = 'registry_taxonomy_terms'
      and indexname = 'registry_taxonomy_terms_slug_unique_idx'
      and indexdef like '%UNIQUE INDEX% (slug)%'
  ) then
    raise exception 'STOP: Expected global taxonomy slug index is missing or already changed';
  end if;

  with snapshot_terms as (
    select version.id as version_id, 'category'::text as taxonomy,
           term.value ->> 'slug' as slug,
           term.value ->> 'name' as name
    from editorial.article_versions version
    cross join lateral jsonb_array_elements(version.category_snapshot) with ordinality term(value, ordinality)
    union all
    select version.id, 'post_tag'::text,
           term.value ->> 'slug', term.value ->> 'name'
    from editorial.article_versions version
    cross join lateral jsonb_array_elements(version.tag_snapshot) with ordinality term(value, ordinality)
  )
  select count(*)
  into v_conflicting_names
  from (
    select taxonomy, slug
    from snapshot_terms
    where nullif(btrim(slug), '') is not null
    group by taxonomy, slug
    having count(distinct name) > 1
  ) conflicts;

  if v_conflicting_names <> 0 then
    raise exception 'STOP: Historical Article taxonomy snapshots contain conflicting names for the same taxonomy and slug';
  end if;

  with snapshot_terms as (
    select version.id as version_id, 'category'::text as taxonomy,
           term.value ->> 'slug' as slug
    from editorial.article_versions version
    cross join lateral jsonb_array_elements(version.category_snapshot) term(value)
    union all
    select version.id, 'post_tag'::text,
           term.value ->> 'slug'
    from editorial.article_versions version
    cross join lateral jsonb_array_elements(version.tag_snapshot) term(value)
  )
  select count(*)
  into v_duplicate_snapshot_terms
  from (
    select version_id, taxonomy, slug
    from snapshot_terms
    group by version_id, taxonomy, slug
    having count(*) > 1
  ) duplicates;

  if v_duplicate_snapshot_terms <> 0 then
    raise exception 'STOP: Historical Article taxonomy snapshots contain duplicate terms inside one version';
  end if;
end;
$preflight$;

-- Taxonomy identity is scoped by taxonomy, not globally by slug.
drop index public.registry_taxonomy_terms_slug_unique_idx;
create unique index registry_taxonomy_terms_taxonomy_slug_unique_idx
  on public.registry_taxonomy_terms (taxonomy, slug);

-- Reconstruct any historical terms that snapshots preserved but the Registry
-- could not hold while slug uniqueness was global.
with snapshot_terms as (
  select 'category'::text as taxonomy,
         term.value ->> 'slug' as slug,
         term.value ->> 'name' as name
  from editorial.article_versions version
  cross join lateral jsonb_array_elements(version.category_snapshot) term(value)
  union all
  select 'post_tag'::text,
         term.value ->> 'slug',
         term.value ->> 'name'
  from editorial.article_versions version
  cross join lateral jsonb_array_elements(version.tag_snapshot) term(value)
), canonical as (
  select taxonomy, slug, min(name) as name
  from snapshot_terms
  where nullif(btrim(slug), '') is not null
    and nullif(btrim(name), '') is not null
  group by taxonomy, slug
)
insert into public.registry_taxonomy_terms (
  taxonomy,
  slug,
  name,
  description,
  status,
  source_kind,
  source_entity,
  metadata,
  created_at,
  updated_at
)
select
  term.taxonomy,
  term.slug,
  term.name,
  null,
  'active',
  'editorial_version_backfill',
  'article_versions',
  jsonb_build_object('backfilled_from_immutable_article_versions', true),
  now(),
  now()
from canonical term
where not exists (
  select 1
  from public.registry_taxonomy_terms existing
  where existing.taxonomy = term.taxonomy
    and existing.slug = term.slug
);

create table editorial.resource_version_editorial_metadata (
  target_version_type text not null,
  target_version_id uuid not null,
  resource_id uuid not null references editorial.resources(id) on delete cascade,
  resource_kind text not null,
  seo_title text,
  seo_description text,
  seo_keywords text[] not null default '{}'::text[],
  focus_keyword text,
  metadata_revision bigint not null default 1,
  updated_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (target_version_type, target_version_id),
  check (target_version_type in ('article_version','playlist_version','audio_publication_version')),
  check (metadata_revision >= 1),
  check (seo_title is null or char_length(seo_title) <= 180),
  check (seo_description is null or char_length(seo_description) <= 500),
  check (focus_keyword is null or char_length(focus_keyword) <= 160),
  check (cardinality(seo_keywords) <= 30)
);

create index resource_version_editorial_metadata_resource_idx
  on editorial.resource_version_editorial_metadata (resource_id, target_version_type);

create table editorial.resource_version_taxonomy_terms (
  target_version_type text not null,
  target_version_id uuid not null,
  resource_id uuid not null references editorial.resources(id) on delete cascade,
  resource_kind text not null,
  taxonomy text not null,
  taxonomy_term_id uuid not null references public.registry_taxonomy_terms(id) on delete restrict,
  term_slug_snapshot text not null,
  term_name_snapshot text not null,
  display_order integer not null default 0,
  created_by uuid,
  created_at timestamptz not null default now(),
  primary key (target_version_type, target_version_id, taxonomy, taxonomy_term_id),
  unique (target_version_type, target_version_id, taxonomy, display_order),
  check (target_version_type in ('article_version','playlist_version','audio_publication_version')),
  check (taxonomy in ('category','post_tag')),
  check (nullif(btrim(term_slug_snapshot), '') is not null),
  check (nullif(btrim(term_name_snapshot), '') is not null),
  check (display_order >= 0)
);

create index resource_version_taxonomy_terms_resource_idx
  on editorial.resource_version_taxonomy_terms (resource_id, target_version_type, taxonomy);

create index resource_version_taxonomy_terms_taxonomy_term_idx
  on editorial.resource_version_taxonomy_terms (taxonomy_term_id);

alter table editorial.resource_version_editorial_metadata enable row level security;
alter table editorial.resource_version_taxonomy_terms enable row level security;
revoke all on editorial.resource_version_editorial_metadata from public, anon, authenticated;
revoke all on editorial.resource_version_taxonomy_terms from public, anon, authenticated;
grant select, insert, update, delete on editorial.resource_version_editorial_metadata to service_role;
grant select, insert, update, delete on editorial.resource_version_taxonomy_terms to service_role;

create or replace function editorial.resolve_resource_version_identity(
  p_target_version_type text,
  p_target_version_id uuid
)
returns table (
  resource_id uuid,
  resource_kind text,
  version_kind text
)
language plpgsql
stable
security definer
set search_path = pg_catalog, public, editorial, audio
as $function$
begin
  if p_target_version_id is null then
    return;
  end if;

  if p_target_version_type = 'article_version' then
    return query
    select version.resource_id, resource.resource_kind, version.version_kind
    from editorial.article_versions version
    join editorial.resources resource on resource.id = version.resource_id
    where version.id = p_target_version_id;
  elsif p_target_version_type = 'playlist_version' then
    return query
    select version.resource_id, resource.resource_kind, version.version_kind
    from editorial.playlist_versions version
    join editorial.resources resource on resource.id = version.resource_id
    where version.id = p_target_version_id;
  elsif p_target_version_type = 'audio_publication_version' then
    return query
    select version.resource_id, resource.resource_kind, version.version_kind
    from audio.publication_versions version
    join editorial.resources resource on resource.id = version.resource_id
    where version.id = p_target_version_id;
  else
    raise exception 'Unsupported editorial version type: %', p_target_version_type;
  end if;
end;
$function$;

revoke all on function editorial.resolve_resource_version_identity(text, uuid) from public, anon, authenticated;
grant execute on function editorial.resolve_resource_version_identity(text, uuid) to service_role;

create or replace function editorial.assert_resource_version_editorial_identity()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, editorial, audio
as $function$
declare
  v_identity record;
  v_term public.registry_taxonomy_terms%rowtype;
begin
  select * into v_identity
  from editorial.resolve_resource_version_identity(
    new.target_version_type,
    new.target_version_id
  );

  if v_identity.resource_id is null then
    raise exception 'Editorial version identity does not exist';
  end if;

  if new.resource_id is distinct from v_identity.resource_id
     or new.resource_kind is distinct from v_identity.resource_kind
  then
    raise exception 'Editorial version Resource identity mismatch';
  end if;

  if tg_table_name = 'resource_version_taxonomy_terms' then
    select term.* into v_term
    from public.registry_taxonomy_terms term
    where term.id = new.taxonomy_term_id;

    if not found
       or v_term.taxonomy is distinct from new.taxonomy
    then
      raise exception 'Editorial taxonomy term does not match the requested taxonomy';
    end if;
  end if;

  return new;
end;
$function$;

revoke all on function editorial.assert_resource_version_editorial_identity()
  from public, anon, authenticated;
grant execute on function editorial.assert_resource_version_editorial_identity()
  to service_role;

create trigger resource_version_editorial_metadata_identity_guard
before insert or update on editorial.resource_version_editorial_metadata
for each row execute function editorial.assert_resource_version_editorial_identity();

create trigger resource_version_taxonomy_terms_identity_guard
before insert or update on editorial.resource_version_taxonomy_terms
for each row execute function editorial.assert_resource_version_editorial_identity();

create or replace function editorial.resource_version_editorial_metadata_json(
  p_target_version_type text,
  p_target_version_id uuid
)
returns jsonb
language sql
stable
security definer
set search_path = pg_catalog, public, editorial
as $function$
  select jsonb_build_object(
    'target_version_type', p_target_version_type,
    'target_version_id', p_target_version_id,
    'resource_id', metadata.resource_id,
    'resource_kind', metadata.resource_kind,
    'metadata_revision', coalesce(metadata.metadata_revision, 1),
    'categories', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id', attachment.taxonomy_term_id,
          'slug', attachment.term_slug_snapshot,
          'name', attachment.term_name_snapshot
        ) order by attachment.display_order
      )
      from editorial.resource_version_taxonomy_terms attachment
      where attachment.target_version_type = p_target_version_type
        and attachment.target_version_id = p_target_version_id
        and attachment.taxonomy = 'category'
    ), '[]'::jsonb),
    'tags', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id', attachment.taxonomy_term_id,
          'slug', attachment.term_slug_snapshot,
          'name', attachment.term_name_snapshot
        ) order by attachment.display_order
      )
      from editorial.resource_version_taxonomy_terms attachment
      where attachment.target_version_type = p_target_version_type
        and attachment.target_version_id = p_target_version_id
        and attachment.taxonomy = 'post_tag'
    ), '[]'::jsonb),
    'seo', jsonb_build_object(
      'title', metadata.seo_title,
      'description', metadata.seo_description,
      'keywords', to_jsonb(coalesce(metadata.seo_keywords, '{}'::text[])),
      'focus_keyword', metadata.focus_keyword
    )
  )
  from (
    select row_data.*
    from editorial.resource_version_editorial_metadata row_data
    where row_data.target_version_type = p_target_version_type
      and row_data.target_version_id = p_target_version_id
    union all
    select null::text, null::uuid, null::uuid, null::text,
           null::text, null::text, '{}'::text[], null::text,
           1::bigint, null::uuid, now(), now()
    where not exists (
      select 1
      from editorial.resource_version_editorial_metadata row_data
      where row_data.target_version_type = p_target_version_type
        and row_data.target_version_id = p_target_version_id
    )
    limit 1
  ) metadata;
$function$;

revoke all on function editorial.resource_version_editorial_metadata_json(text, uuid) from public, anon, authenticated;
grant execute on function editorial.resource_version_editorial_metadata_json(text, uuid) to service_role;

create or replace function editorial.resource_version_discovery_content_json(
  p_target_version_type text,
  p_target_version_id uuid
)
returns jsonb
language sql
stable
security definer
set search_path = pg_catalog, editorial
as $function$
  select editorial.resource_version_editorial_metadata_json(
    p_target_version_type,
    p_target_version_id
  )
  - 'target_version_type'
  - 'target_version_id'
  - 'resource_id'
  - 'resource_kind'
  - 'metadata_revision';
$function$;

revoke all on function editorial.resource_version_discovery_content_json(text, uuid) from public, anon, authenticated;
grant execute on function editorial.resource_version_discovery_content_json(text, uuid) to service_role;

create or replace function editorial.discovery_fingerprint_fragment(
  p_discovery jsonb
)
returns jsonb
language sql
immutable
set search_path = pg_catalog
as $function$
  select case
    when coalesce(jsonb_array_length(p_discovery -> 'categories'), 0) = 0
     and coalesce(jsonb_array_length(p_discovery -> 'tags'), 0) = 0
     and nullif(btrim(p_discovery -> 'seo' ->> 'title'), '') is null
     and nullif(btrim(p_discovery -> 'seo' ->> 'description'), '') is null
     and coalesce(jsonb_array_length(p_discovery -> 'seo' -> 'keywords'), 0) = 0
     and nullif(btrim(p_discovery -> 'seo' ->> 'focus_keyword'), '') is null
    then '{}'::jsonb
    else jsonb_build_object('discovery', p_discovery)
  end;
$function$;

revoke all on function editorial.discovery_fingerprint_fragment(jsonb) from public, anon, authenticated;
grant execute on function editorial.discovery_fingerprint_fragment(jsonb) to service_role;

create or replace function editorial.playlist_version_content_fingerprint_with_discovery(
  p_version_id uuid,
  p_discovery jsonb
)
returns text
language plpgsql
stable
security definer
set search_path = pg_catalog, editorial, extensions
as $function$
declare
  v_version editorial.playlist_versions%rowtype;
  v_items jsonb;
  v_cover jsonb := null;
  v_payload jsonb;
begin
  select version.* into v_version
  from editorial.playlist_versions version
  where version.id = p_version_id;

  if not found then
    raise exception 'Playlist version does not exist';
  end if;

  if v_version.cover_asset_id is not null then
    v_cover := jsonb_build_object(
      'asset_id', v_version.cover_asset_id,
      'asset_revision_id', v_version.cover_asset_revision_id,
      'resolution_mode', 'exact_revision',
      'placement_data', v_version.cover_placement_data,
      'alt_text_snapshot', v_version.cover_alt_text_snapshot,
      'caption_snapshot', v_version.cover_caption_snapshot,
      'credit_snapshot', v_version.cover_credit_snapshot
    );
  end if;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'playlist_item_resource_id', item.playlist_item_resource_id,
        'playlist_item_id', item.playlist_item_id,
        'position', item.position,
        'registry_track_id', item.registry_track_id,
        'registry_release_id', item.registry_release_id,
        'provider_key', item.provider_key,
        'provider_track_id', item.provider_track_id,
        'provider_url', item.provider_url,
        'title', item.title,
        'artist_names', to_jsonb(item.artist_names),
        'release_title', item.release_title,
        'artwork_url', item.artwork_url,
        'preview_url', item.preview_url,
        'duration_ms', item.duration_ms,
        'isrc', item.isrc,
        'match_status', item.match_status,
        'match_confidence', item.match_confidence,
        'normalization_payload', item.normalization_payload,
        'notes', item.notes
      ) order by item.position
    ),
    '[]'::jsonb
  ) into v_items
  from editorial.playlist_version_items item
  where item.playlist_version_id = p_version_id;

  v_payload := jsonb_build_object(
    'playlist_id', v_version.playlist_id,
    'title', v_version.title,
    'slug', v_version.slug,
    'description', v_version.description,
    'curator_label', v_version.curator_label,
    'metadata', v_version.metadata,
    'cover', v_cover,
    'items', v_items
  ) || editorial.discovery_fingerprint_fragment(p_discovery);

  return encode(
    extensions.digest(
      convert_to(v_payload::text, 'UTF8'),
      'sha256'
    ),
    'hex'
  );
end;
$function$;

revoke all on function editorial.playlist_version_content_fingerprint_with_discovery(uuid, jsonb) from public, anon, authenticated;
grant execute on function editorial.playlist_version_content_fingerprint_with_discovery(uuid, jsonb) to service_role;

create or replace function audio.publication_version_content_fingerprint_with_discovery(
  p_version_id uuid,
  p_discovery jsonb
)
returns text
language plpgsql
stable
security definer
set search_path = pg_catalog, audio, editorial, extensions
as $function$
declare
  v_version audio.publication_versions%rowtype;
  v_chapters jsonb;
  v_payload jsonb;
begin
  select version.* into v_version
  from audio.publication_versions version
  where version.id = p_version_id;

  if not found then
    raise exception 'Audio publication version does not exist';
  end if;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'chapter_number', chapter.chapter_number,
        'start_seconds', chapter.start_seconds,
        'title', chapter.title,
        'chapter_url', chapter.chapter_url,
        'image_url', chapter.image_url
      ) order by chapter.chapter_number
    ),
    '[]'::jsonb
  ) into v_chapters
  from audio.publication_version_chapters chapter
  where chapter.publication_version_id = p_version_id;

  v_payload := jsonb_build_object(
    'publication_kind', v_version.publication_kind,
    'show_id', v_version.show_id,
    'season_id', v_version.season_id,
    'episode_number', v_version.episode_number,
    'slug', v_version.slug,
    'title', v_version.title,
    'summary', v_version.summary,
    'metadata', v_version.metadata,
    'master_media_asset_id', v_version.master_media_asset_id,
    'master_media_revision_id', v_version.master_media_revision_id,
    'audio_delivery_variant_id', v_version.audio_delivery_variant_id,
    'transcript_media_asset_id', v_version.transcript_media_asset_id,
    'transcript_media_revision_id', v_version.transcript_media_revision_id,
    'chapters', v_chapters
  ) || editorial.discovery_fingerprint_fragment(p_discovery);

  return encode(
    extensions.digest(
      convert_to(v_payload::text, 'UTF8'),
      'sha256'
    ),
    'hex'
  );
end;
$function$;

revoke all on function audio.publication_version_content_fingerprint_with_discovery(uuid, jsonb) from public, anon, authenticated;
grant execute on function audio.publication_version_content_fingerprint_with_discovery(uuid, jsonb) to service_role;

create or replace function editorial.copy_resource_version_editorial_metadata(
  p_source_version_type text,
  p_source_version_id uuid,
  p_target_version_type text,
  p_target_version_id uuid,
  p_actor_id uuid
)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public, editorial, audio
as $function$
declare
  v_source record;
  v_target record;
begin
  select * into v_source
  from editorial.resolve_resource_version_identity(
    p_source_version_type,
    p_source_version_id
  );

  select * into v_target
  from editorial.resolve_resource_version_identity(
    p_target_version_type,
    p_target_version_id
  );

  if v_source.resource_id is null or v_target.resource_id is null then
    raise exception 'Editorial Discovery copy requires existing source and target versions';
  end if;

  if v_source.resource_id is distinct from v_target.resource_id
     or v_source.resource_kind is distinct from v_target.resource_kind
  then
    raise exception 'Editorial Discovery copy cannot cross Resource identity';
  end if;

  insert into editorial.resource_version_editorial_metadata (
    target_version_type,
    target_version_id,
    resource_id,
    resource_kind,
    seo_title,
    seo_description,
    seo_keywords,
    focus_keyword,
    metadata_revision,
    updated_by,
    created_at,
    updated_at
  )
  select
    p_target_version_type,
    p_target_version_id,
    v_target.resource_id,
    v_target.resource_kind,
    source.seo_title,
    source.seo_description,
    source.seo_keywords,
    source.focus_keyword,
    1,
    p_actor_id,
    now(),
    now()
  from editorial.resource_version_editorial_metadata source
  where source.target_version_type = p_source_version_type
    and source.target_version_id = p_source_version_id
  on conflict (target_version_type, target_version_id)
  do update set
    resource_id = excluded.resource_id,
    resource_kind = excluded.resource_kind,
    seo_title = excluded.seo_title,
    seo_description = excluded.seo_description,
    seo_keywords = excluded.seo_keywords,
    focus_keyword = excluded.focus_keyword,
    metadata_revision = 1,
    updated_by = excluded.updated_by,
    updated_at = now();

  if not found then
    insert into editorial.resource_version_editorial_metadata (
      target_version_type,
      target_version_id,
      resource_id,
      resource_kind,
      metadata_revision,
      updated_by
    )
    values (
      p_target_version_type,
      p_target_version_id,
      v_target.resource_id,
      v_target.resource_kind,
      1,
      p_actor_id
    )
    on conflict (target_version_type, target_version_id) do nothing;
  end if;

  delete from editorial.resource_version_taxonomy_terms target
  where target.target_version_type = p_target_version_type
    and target.target_version_id = p_target_version_id;

  insert into editorial.resource_version_taxonomy_terms (
    target_version_type,
    target_version_id,
    resource_id,
    resource_kind,
    taxonomy,
    taxonomy_term_id,
    term_slug_snapshot,
    term_name_snapshot,
    display_order,
    created_by
  )
  select
    p_target_version_type,
    p_target_version_id,
    v_target.resource_id,
    v_target.resource_kind,
    source.taxonomy,
    source.taxonomy_term_id,
    source.term_slug_snapshot,
    source.term_name_snapshot,
    source.display_order,
    p_actor_id
  from editorial.resource_version_taxonomy_terms source
  where source.target_version_type = p_source_version_type
    and source.target_version_id = p_source_version_id
  order by source.taxonomy, source.display_order;
end;
$function$;

revoke all on function editorial.copy_resource_version_editorial_metadata(text, uuid, text, uuid, uuid) from public, anon, authenticated;
grant execute on function editorial.copy_resource_version_editorial_metadata(text, uuid, text, uuid, uuid) to service_role;

-- Historical Article materialization.
insert into editorial.resource_version_editorial_metadata (
  target_version_type,
  target_version_id,
  resource_id,
  resource_kind,
  seo_title,
  seo_description,
  seo_keywords,
  focus_keyword,
  metadata_revision,
  updated_by,
  created_at,
  updated_at
)
select
  'article_version',
  version.id,
  version.resource_id,
  resource.resource_kind,
  nullif(btrim(version.seo ->> 'title'), ''),
  nullif(btrim(version.seo ->> 'description'), ''),
  case
    when nullif(btrim(version.seo ->> 'keywords'), '') is null then '{}'::text[]
    else array(
      select btrim(keyword)
      from regexp_split_to_table(version.seo ->> 'keywords', ',') keyword
      where nullif(btrim(keyword), '') is not null
    )
  end,
  nullif(btrim(coalesce(version.seo ->> 'focusKeyword', version.seo ->> 'focus_keyword')), ''),
  1,
  version.created_by,
  version.created_at,
  version.created_at
from editorial.article_versions version
join editorial.resources resource on resource.id = version.resource_id;

with attachments as (
  select
    version.id as target_version_id,
    version.resource_id,
    resource.resource_kind,
    'category'::text as taxonomy,
    term.value ->> 'slug' as slug,
    term.value ->> 'name' as name,
    (term.ordinality - 1)::integer as display_order,
    version.created_by
  from editorial.article_versions version
  join editorial.resources resource on resource.id = version.resource_id
  cross join lateral jsonb_array_elements(version.category_snapshot) with ordinality term(value, ordinality)
  union all
  select
    version.id,
    version.resource_id,
    resource.resource_kind,
    'post_tag'::text,
    term.value ->> 'slug',
    term.value ->> 'name',
    (term.ordinality - 1)::integer,
    version.created_by
  from editorial.article_versions version
  join editorial.resources resource on resource.id = version.resource_id
  cross join lateral jsonb_array_elements(version.tag_snapshot) with ordinality term(value, ordinality)
)
insert into editorial.resource_version_taxonomy_terms (
  target_version_type,
  target_version_id,
  resource_id,
  resource_kind,
  taxonomy,
  taxonomy_term_id,
  term_slug_snapshot,
  term_name_snapshot,
  display_order,
  created_by
)
select
  'article_version',
  attachment.target_version_id,
  attachment.resource_id,
  attachment.resource_kind,
  attachment.taxonomy,
  term.id,
  attachment.slug,
  attachment.name,
  attachment.display_order,
  attachment.created_by
from attachments attachment
join public.registry_taxonomy_terms term
  on term.taxonomy = attachment.taxonomy
 and term.slug = attachment.slug;

-- Existing Playlist and Audio versions receive explicit empty shared authority.
insert into editorial.resource_version_editorial_metadata (
  target_version_type,
  target_version_id,
  resource_id,
  resource_kind,
  metadata_revision,
  updated_by,
  created_at,
  updated_at
)
select
  'playlist_version',
  version.id,
  version.resource_id,
  resource.resource_kind,
  1,
  version.created_by,
  version.created_at,
  version.created_at
from editorial.playlist_versions version
join editorial.resources resource on resource.id = version.resource_id;

insert into editorial.resource_version_editorial_metadata (
  target_version_type,
  target_version_id,
  resource_id,
  resource_kind,
  metadata_revision,
  updated_by,
  created_at,
  updated_at
)
select
  'audio_publication_version',
  version.id,
  version.resource_id,
  resource.resource_kind,
  1,
  version.created_by,
  version.created_at,
  version.created_at
from audio.publication_versions version
join editorial.resources resource on resource.id = version.resource_id;

-- Every new supported version materializes or copies Discovery automatically.
create or replace function editorial.materialize_resource_version_editorial_metadata()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, editorial, audio
as $function$
declare
  v_target_type text;
  v_resource_kind text;
  v_source_id uuid;
  v_expected_terms integer;
  v_inserted_terms integer;
begin
  if tg_table_schema = 'editorial' and tg_table_name = 'article_versions' then
    v_target_type := 'article_version';
  elsif tg_table_schema = 'editorial' and tg_table_name = 'playlist_versions' then
    v_target_type := 'playlist_version';
  elsif tg_table_schema = 'audio' and tg_table_name = 'publication_versions' then
    v_target_type := 'audio_publication_version';
  else
    raise exception 'Unsupported version table for editorial Discovery materialization';
  end if;

  select resource.resource_kind into v_resource_kind
  from editorial.resources resource
  where resource.id = new.resource_id;

  if v_resource_kind is null then
    raise exception 'Version Resource identity does not exist';
  end if;

  if v_target_type = 'article_version' then
    insert into editorial.resource_version_editorial_metadata (
      target_version_type, target_version_id, resource_id, resource_kind,
      seo_title, seo_description, seo_keywords, focus_keyword,
      metadata_revision, updated_by, created_at, updated_at
    )
    values (
      v_target_type,
      new.id,
      new.resource_id,
      v_resource_kind,
      nullif(btrim(new.seo ->> 'title'), ''),
      nullif(btrim(new.seo ->> 'description'), ''),
      case
        when nullif(btrim(new.seo ->> 'keywords'), '') is null then '{}'::text[]
        else array(
          select btrim(keyword)
          from regexp_split_to_table(new.seo ->> 'keywords', ',') keyword
          where nullif(btrim(keyword), '') is not null
        )
      end,
      nullif(btrim(coalesce(new.seo ->> 'focusKeyword', new.seo ->> 'focus_keyword')), ''),
      1,
      new.created_by,
      new.created_at,
      new.created_at
    );

    insert into editorial.resource_version_taxonomy_terms (
      target_version_type, target_version_id, resource_id, resource_kind,
      taxonomy, taxonomy_term_id, term_slug_snapshot, term_name_snapshot,
      display_order, created_by
    )
    select
      v_target_type,
      new.id,
      new.resource_id,
      v_resource_kind,
      source.taxonomy,
      term.id,
      source.slug,
      source.name,
      source.display_order,
      new.created_by
    from (
      select 'category'::text as taxonomy,
             item.value ->> 'slug' as slug,
             item.value ->> 'name' as name,
             (item.ordinality - 1)::integer as display_order
      from jsonb_array_elements(new.category_snapshot) with ordinality item(value, ordinality)
      union all
      select 'post_tag'::text,
             item.value ->> 'slug',
             item.value ->> 'name',
             (item.ordinality - 1)::integer
      from jsonb_array_elements(new.tag_snapshot) with ordinality item(value, ordinality)
    ) source
    join public.registry_taxonomy_terms term
      on term.taxonomy = source.taxonomy
     and term.slug = source.slug;

    get diagnostics v_inserted_terms = row_count;
    v_expected_terms := jsonb_array_length(new.category_snapshot) + jsonb_array_length(new.tag_snapshot);

    if v_inserted_terms <> v_expected_terms then
      raise exception 'Article version taxonomy snapshot could not be fully resolved to Registry terms';
    end if;

    return new;
  end if;

  if v_target_type = 'playlist_version' then
    select source.id into v_source_id
    from editorial.playlist_versions source
    where source.resource_id = new.resource_id
      and source.version_number < new.version_number
      and (
        (new.version_kind in ('working','submitted') and source.version_kind = 'working')
        or (new.version_kind = 'approved' and source.version_kind = 'submitted')
        or (new.version_kind = 'scheduled' and source.version_kind = 'approved')
        or (new.version_kind = 'published' and source.version_kind in ('scheduled','approved'))
      )
    order by source.version_number desc
    limit 1;
  else
    select source.id into v_source_id
    from audio.publication_versions source
    where source.resource_id = new.resource_id
      and source.version_number < new.version_number
      and (
        (new.version_kind in ('working','submitted') and source.version_kind = 'working')
        or (new.version_kind = 'approved' and source.version_kind = 'submitted')
        or (new.version_kind = 'published' and source.version_kind = 'approved')
      )
    order by source.version_number desc
    limit 1;
  end if;

  if v_source_id is not null then
    perform editorial.copy_resource_version_editorial_metadata(
      v_target_type,
      v_source_id,
      v_target_type,
      new.id,
      new.created_by
    );
  else
    insert into editorial.resource_version_editorial_metadata (
      target_version_type,
      target_version_id,
      resource_id,
      resource_kind,
      metadata_revision,
      updated_by,
      created_at,
      updated_at
    )
    values (
      v_target_type,
      new.id,
      new.resource_id,
      v_resource_kind,
      1,
      new.created_by,
      new.created_at,
      new.created_at
    );
  end if;

  return new;
end;
$function$;

revoke all on function editorial.materialize_resource_version_editorial_metadata()
  from public, anon, authenticated;
grant execute on function editorial.materialize_resource_version_editorial_metadata()
  to service_role;

create trigger article_version_editorial_metadata_materialize
after insert on editorial.article_versions
for each row execute function editorial.materialize_resource_version_editorial_metadata();

create trigger playlist_version_editorial_metadata_materialize
after insert on editorial.playlist_versions
for each row execute function editorial.materialize_resource_version_editorial_metadata();

create trigger audio_version_editorial_metadata_materialize
after insert on audio.publication_versions
for each row execute function editorial.materialize_resource_version_editorial_metadata();

-- Discovery is material content in Playlist fingerprints.
create or replace function editorial.playlist_current_content_fingerprint(p_playlist_id uuid)
returns text
language plpgsql
stable
security definer
set search_path = pg_catalog, public, editorial, media, extensions
as $function$
declare
  v_playlist public.wk_playlists%rowtype;
  v_resource_id uuid;
  v_working_version_id uuid;
  v_items jsonb;
  v_cover_count integer;
  v_cover jsonb := null;
begin
  select playlist.* into v_playlist
  from public.wk_playlists playlist
  where playlist.id = p_playlist_id;

  if not found then raise exception 'Playlist does not exist'; end if;

  select binding.resource_id, binding.current_working_version_id
  into v_resource_id, v_working_version_id
  from editorial.playlist_resources binding
  where binding.playlist_id = p_playlist_id;

  if v_resource_id is null then
    raise exception 'Playlist Resource binding does not exist';
  end if;

  select count(*) into v_cover_count
  from media.usage_links usage
  where usage.target_authority = 'editorial'
    and usage.target_kind = 'playlist'
    and usage.target_id = p_playlist_id
    and usage.target_version_id is null
    and usage.usage_role = 'playlist_cover'
    and usage.usage_state = 'active';

  if v_cover_count > 1 then
    raise exception 'Playlist has more than one active canonical cover';
  end if;

  if v_cover_count = 1 then
    select jsonb_build_object(
      'asset_id', usage.asset_id,
      'asset_revision_id', usage.asset_revision_id,
      'resolution_mode', usage.resolution_mode,
      'placement_data', usage.placement_data,
      'alt_text_snapshot', usage.alt_text_snapshot,
      'caption_snapshot', usage.caption_snapshot,
      'credit_snapshot', usage.credit_snapshot
    )
    into v_cover
    from media.usage_links usage
    where usage.target_authority = 'editorial'
      and usage.target_kind = 'playlist'
      and usage.target_id = p_playlist_id
      and usage.target_version_id is null
      and usage.usage_role = 'playlist_cover'
      and usage.usage_state = 'active';

    if v_cover ->> 'resolution_mode' <> 'exact_revision'
       or nullif(v_cover ->> 'asset_revision_id', '') is null
    then
      raise exception 'Playlist cover must resolve to an exact Media revision before snapshotting';
    end if;
  end if;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'playlist_item_resource_id', binding.resource_id,
        'playlist_item_id', item.id,
        'position', item.position,
        'registry_track_id', item.registry_track_id,
        'registry_release_id', item.registry_release_id,
        'provider_key', item.provider_key,
        'provider_track_id', item.provider_track_id,
        'provider_url', item.provider_url,
        'title', item.title,
        'artist_names', to_jsonb(item.artist_names),
        'release_title', item.release_title,
        'artwork_url', item.artwork_url,
        'preview_url', item.preview_url,
        'duration_ms', item.duration_ms,
        'isrc', item.isrc,
        'match_status', item.match_status,
        'match_confidence', item.match_confidence,
        'normalization_payload', item.normalization_payload,
        'notes', item.notes
      ) order by item.position
    ),
    '[]'::jsonb
  )
  into v_items
  from public.wk_playlist_items item
  join editorial.playlist_item_resources binding
    on binding.playlist_item_id = item.id
  where item.playlist_id = p_playlist_id
    and item.lifecycle_state = 'active';

  return encode(
    extensions.digest(
      convert_to(
        (
          jsonb_build_object(
            'playlist_id', p_playlist_id,
            'title', v_playlist.title,
            'slug', v_playlist.slug,
            'description', v_playlist.description,
            'curator_label', v_playlist.curator_label,
            'metadata', v_playlist.metadata,
            'cover', v_cover,
            'items', v_items
          )
          || editorial.discovery_fingerprint_fragment(
            editorial.resource_version_discovery_content_json(
              'playlist_version',
              v_working_version_id
            )
          )
        )::text,
        'UTF8'
      ),
      'sha256'
    ),
    'hex'
  );
end;
$function$;

-- Discovery is material content in Audio fingerprints.
create or replace function audio.publication_content_fingerprint(p_publication_id uuid)
returns text
language sql
stable
set search_path = pg_catalog, audio, media, editorial, extensions
as $function$
  select encode(
    extensions.digest(
      convert_to(
        (
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
          )
          || editorial.discovery_fingerprint_fragment(
            editorial.resource_version_discovery_content_json(
              'audio_publication_version',
              binding.current_working_version_id
            )
          )
        )::text,
        'UTF8'
      ),
      'sha256'
    ),
    'hex'
  )
  from audio.publications publication
  join editorial.audio_publication_resources binding
    on binding.publication_id = publication.id
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
      ) order by chapter.chapter_number
    ) as payload
    from audio.publication_chapters chapter
    where chapter.publication_id = publication.id
  ) chapters on true
  where publication.id = p_publication_id;
$function$;

insert into platform_private.command_types (
  command_type,
  job_type,
  accepted_event_type,
  success_event_type,
  failure_event_type,
  retry_event_type,
  enabled
)
values (
  'editorial.discovery.save',
  'editorial.discovery.save.sync',
  'editorial.discovery.save.accepted',
  'editorial.discovery.save.succeeded',
  'editorial.discovery.save.failed',
  'editorial.discovery.save.retry_scheduled',
  true
);

create or replace function public.get_resource_version_editorial_metadata(
  p_target_version_type text,
  p_target_version_id uuid
)
returns jsonb
language plpgsql
stable
security definer
set search_path = pg_catalog, public, auth, editorial, audio
as $function$
declare
  v_actor uuid := auth.uid();
  v_identity record;
begin
  if v_actor is null then
    raise exception 'Not authenticated';
  end if;

  if p_target_version_type not in ('playlist_version','audio_publication_version') then
    raise exception 'Discovery reads are not active for this version type';
  end if;

  select * into v_identity
  from editorial.resolve_resource_version_identity(
    p_target_version_type,
    p_target_version_id
  );

  if v_identity.resource_id is null then
    raise exception 'Editorial version does not exist';
  end if;

  if p_target_version_type = 'playlist_version' then
    if not editorial.current_user_can_view_playlist(v_identity.resource_id) then
      raise exception 'Playlist view permission is required';
    end if;
  elsif not editorial.current_user_can_view_audio(v_identity.resource_id) then
    raise exception 'Audio view permission is required';
  end if;

  return editorial.resource_version_editorial_metadata_json(
    p_target_version_type,
    p_target_version_id
  );
end;
$function$;

revoke all on function public.get_resource_version_editorial_metadata(text, uuid) from public, anon;
grant execute on function public.get_resource_version_editorial_metadata(text, uuid) to authenticated, service_role;

create or replace function editorial.copy_playlist_working_trust_to_working_successor(
  p_resource_id uuid,
  p_source_working_version_id uuid,
  p_target_working_version_id uuid
)
returns void
language plpgsql
security definer
set search_path = pg_catalog, editorial
as $function$
declare
  v_source editorial.playlist_versions%rowtype;
  v_target editorial.playlist_versions%rowtype;
  v_target_curator_credit_id uuid;
  v_root_offset integer := 0;
  v_source_core_fingerprint text;
  v_target_core_fingerprint text;
begin
  select version.* into v_source
  from editorial.playlist_versions version
  where version.id = p_source_working_version_id;

  select version.* into v_target
  from editorial.playlist_versions version
  where version.id = p_target_working_version_id;

  if v_source.id is null or v_target.id is null
     or v_source.version_kind <> 'working'
     or v_target.version_kind <> 'working'
     or v_source.resource_id is distinct from p_resource_id
     or v_target.resource_id is distinct from p_resource_id
     or v_source.playlist_id is distinct from v_target.playlist_id
     or v_source.source_authority_revision is distinct from v_target.source_authority_revision
     or v_source.item_count is distinct from v_target.item_count
     or v_target.version_number <= v_source.version_number
  then
    raise exception 'Playlist Discovery Trust copy requires ordered working versions of the same exact Playlist authority';
  end if;

  if not exists (
    select 1
    from editorial.playlist_resources binding
    where binding.resource_id = p_resource_id
      and binding.playlist_id = v_source.playlist_id
      and binding.current_working_version_id = p_source_working_version_id
  ) then
    raise exception 'Playlist Discovery Trust source must be the current working version';
  end if;

  v_source_core_fingerprint :=
    editorial.playlist_version_content_fingerprint_with_discovery(
      p_source_working_version_id,
      '{}'::jsonb
    );
  v_target_core_fingerprint :=
    editorial.playlist_version_content_fingerprint_with_discovery(
      p_target_working_version_id,
      '{}'::jsonb
    );

  if v_source_core_fingerprint is distinct from v_target_core_fingerprint then
    raise exception 'Playlist Discovery Trust successor changed frozen Playlist content';
  end if;

  select attachment.credit_id
  into v_target_curator_credit_id
  from editorial.resource_credits attachment
  join editorial.credits credit
    on credit.id = attachment.credit_id
  where attachment.target_version_type = 'playlist_version'
    and attachment.target_version_id = p_target_working_version_id
    and attachment.resource_id = p_resource_id
    and attachment.resource_kind = 'playlist'
    and credit.credit_role = 'curator'
  order by attachment.display_order, attachment.id
  limit 1;

  if v_target_curator_credit_id is not null then
    v_root_offset := 1;
  end if;

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
    p_target_working_version_id,
    citation.citation_id,
    citation.citation_purpose,
    citation.target_anchor_type,
    citation.target_anchor_data,
    citation.display_order,
    citation.public_safe,
    citation.created_by
  from editorial.resource_citations citation
  where citation.target_version_type = 'playlist_version'
    and citation.target_version_id = p_source_working_version_id
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
          where item.playlist_version_id = p_target_working_version_id
            and item.playlist_item_resource_id = citation.resource_id
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
    p_target_working_version_id,
    root_credit.credit_id,
    v_root_offset
      + (row_number() over (
          order by root_credit.display_order, root_credit.id
        ))::integer
      - 1,
    root_credit.is_primary,
    root_credit.public_safe,
    root_credit.created_by
  from editorial.resource_credits root_credit
  where root_credit.target_version_type = 'playlist_version'
    and root_credit.target_version_id = p_source_working_version_id
    and root_credit.resource_kind = 'playlist'
    and root_credit.resource_id = p_resource_id
    and (
      v_target_curator_credit_id is null
      or root_credit.credit_id <> v_target_curator_credit_id
    )
  order by root_credit.display_order, root_credit.id;

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
    p_target_working_version_id,
    item_credit.credit_id,
    item_credit.display_order,
    item_credit.is_primary,
    item_credit.public_safe,
    item_credit.created_by
  from editorial.resource_credits item_credit
  where item_credit.target_version_type = 'playlist_version'
    and item_credit.target_version_id = p_source_working_version_id
    and item_credit.resource_kind = 'playlist_item'
    and exists (
      select 1
      from editorial.playlist_version_items item
      where item.playlist_version_id = p_target_working_version_id
        and item.playlist_item_resource_id = item_credit.resource_id
    );
end;
$function$;

revoke all on function editorial.copy_playlist_working_trust_to_working_successor(uuid, uuid, uuid)
  from public, anon, authenticated;
grant execute on function editorial.copy_playlist_working_trust_to_working_successor(uuid, uuid, uuid)
  to service_role;

create or replace function public.save_resource_version_editorial_metadata(
  p_target_version_type text,
  p_target_version_id uuid,
  p_expected_metadata_revision bigint,
  p_category_ids uuid[],
  p_tag_ids uuid[],
  p_seo_title text,
  p_seo_description text,
  p_seo_keywords text[],
  p_focus_keyword text,
  p_idempotency_key text,
  p_correlation_id uuid default null
)
returns table (
  command_receipt_id uuid,
  receipt_status text,
  resource_id uuid,
  target_version_id uuid,
  metadata_revision bigint,
  result_payload jsonb,
  error_code text,
  error_message text,
  idempotent_replay boolean
)
language plpgsql
security definer
set search_path = pg_catalog, public, auth, editorial, audio, platform_private, extensions
as $function$
declare
  v_actor uuid := auth.uid();
  v_identity record;
  v_playlist public.wk_playlists%rowtype;
  v_audio audio.publications%rowtype;
  v_source_playlist_version editorial.playlist_versions%rowtype;
  v_source_audio_version audio.publication_versions%rowtype;
  v_source_metadata editorial.resource_version_editorial_metadata%rowtype;
  v_current_working_version_id uuid;
  v_begin record;
  v_read record;
  v_result jsonb;
  v_new_revision bigint;
  v_new_version_id uuid;
  v_new_version_number bigint;
  v_discovery jsonb;
  v_fingerprint text;
  v_current_fingerprint text;
  v_category_ids uuid[] := coalesce(p_category_ids, '{}'::uuid[]);
  v_tag_ids uuid[] := coalesce(p_tag_ids, '{}'::uuid[]);
  v_keywords text[] := coalesce(p_seo_keywords, '{}'::text[]);
  v_correlation_id uuid := coalesce(p_correlation_id, extensions.gen_random_uuid());
begin
  if v_actor is null then raise exception 'Not authenticated'; end if;

  if p_target_version_type not in ('playlist_version','audio_publication_version') then
    raise exception 'Discovery writes are not active for this version type';
  end if;

  if cardinality(v_category_ids) > 20
     or cardinality(v_tag_ids) > 50
     or cardinality(v_keywords) > 30
  then
    raise exception 'Discovery attachment limits were exceeded';
  end if;

  if exists (select 1 from unnest(v_category_ids) id group by id having count(*) > 1)
     or exists (select 1 from unnest(v_tag_ids) id group by id having count(*) > 1)
  then
    raise exception 'Discovery taxonomy selections cannot contain duplicates';
  end if;

  if exists (
    select 1 from unnest(v_keywords) keyword
    where nullif(btrim(keyword), '') is null or char_length(btrim(keyword)) > 160
  ) then
    raise exception 'Discovery keywords must be non-empty and no longer than 160 characters';
  end if;

  select * into v_identity
  from editorial.resolve_resource_version_identity(p_target_version_type, p_target_version_id);

  if v_identity.resource_id is null or v_identity.version_kind <> 'working' then
    raise exception 'Discovery writes require an existing working version';
  end if;

  if p_target_version_type = 'playlist_version' then
    select playlist.* into v_playlist
    from public.wk_playlists playlist
    join editorial.playlist_resources binding on binding.playlist_id = playlist.id
    where binding.resource_id = v_identity.resource_id
    for update of playlist;

    select binding.current_working_version_id into v_current_working_version_id
    from editorial.playlist_resources binding
    where binding.resource_id = v_identity.resource_id
    for update;

    select version.* into v_source_playlist_version
    from editorial.playlist_versions version
    where version.id = p_target_version_id;

    if not editorial.current_user_can_edit_playlist(v_identity.resource_id) then
      raise exception 'Playlist edit permission is required';
    end if;

    v_current_fingerprint := editorial.playlist_current_content_fingerprint(v_playlist.id);
  else
    select publication.* into v_audio
    from audio.publications publication
    join editorial.audio_publication_resources binding on binding.publication_id = publication.id
    where binding.resource_id = v_identity.resource_id
    for update of publication;

    select binding.current_working_version_id into v_current_working_version_id
    from editorial.audio_publication_resources binding
    where binding.resource_id = v_identity.resource_id
    for update;

    select version.* into v_source_audio_version
    from audio.publication_versions version
    where version.id = p_target_version_id;

    if not editorial.current_user_can_edit_audio(v_identity.resource_id) then
      raise exception 'Audio edit permission is required';
    end if;

    v_current_fingerprint := audio.publication_content_fingerprint(v_audio.id);
  end if;

  select metadata.* into v_source_metadata
  from editorial.resource_version_editorial_metadata metadata
  where metadata.target_version_type = p_target_version_type
    and metadata.target_version_id = p_target_version_id
  for update;

  if not found then
    raise exception 'Discovery metadata row does not exist for the working version';
  end if;

  select * into v_begin
  from platform_private.begin_authenticated_resource_command(
    'editorial.discovery.save',
    v_identity.resource_id,
    p_idempotency_key,
    jsonb_build_object(
      'target_version_type', p_target_version_type,
      'target_version_id', p_target_version_id,
      'expected_metadata_revision', p_expected_metadata_revision,
      'category_ids', to_jsonb(v_category_ids),
      'tag_ids', to_jsonb(v_tag_ids),
      'seo_title', nullif(btrim(p_seo_title), ''),
      'seo_description', nullif(btrim(p_seo_description), ''),
      'seo_keywords', to_jsonb(v_keywords),
      'focus_keyword', nullif(btrim(p_focus_keyword), ''),
      'correlation_id', v_correlation_id
    )
  );

  if v_begin.idempotent_replay then
    select * into v_read
    from platform_private.read_authenticated_resource_command_result(
      v_begin.command_receipt_id,
      true
    );

    command_receipt_id := v_read.command_receipt_id;
    receipt_status := v_read.receipt_status;
    resource_id := v_read.resource_id;
    target_version_id := nullif(v_read.result_payload ->> 'target_version_id', '')::uuid;
    metadata_revision := nullif(v_read.result_payload ->> 'metadata_revision', '')::bigint;
    result_payload := v_read.result_payload;
    error_code := v_read.error_code;
    error_message := v_read.error_message;
    idempotent_replay := true;
    return next;
    return;
  end if;

  if v_current_working_version_id is distinct from p_target_version_id then
    perform platform_private.reject_resource_command(
      v_begin.command_receipt_id,
      'editorial_discovery_working_version_changed',
      'Save Discovery against the current working version.',
      jsonb_build_object(
        'source_version_id', p_target_version_id,
        'current_working_version_id', v_current_working_version_id,
        'metadata_revision', v_source_metadata.metadata_revision
      )
    );
  elsif p_expected_metadata_revision is null
        or p_expected_metadata_revision < 1
        or v_source_metadata.metadata_revision <> p_expected_metadata_revision
  then
    perform platform_private.reject_resource_command(
      v_begin.command_receipt_id,
      'editorial_discovery_revision_changed',
      'Discovery changed before this save could be applied.',
      jsonb_build_object(
        'source_version_id', p_target_version_id,
        'metadata_revision', v_source_metadata.metadata_revision
      )
    );
  elsif p_target_version_type = 'playlist_version'
        and (
          v_playlist.status not in ('draft','changes_requested','published')
          or v_source_playlist_version.source_authority_revision <> v_playlist.authority_revision
          or v_source_playlist_version.content_fingerprint is distinct from v_current_fingerprint
        )
  then
    perform platform_private.reject_resource_command(
      v_begin.command_receipt_id,
      'editorial_discovery_playlist_working_version_stale',
      'Save the current Playlist working version before changing Discovery.',
      jsonb_build_object(
        'lifecycle_status', v_playlist.status,
        'authority_revision', v_playlist.authority_revision,
        'working_source_authority_revision', v_source_playlist_version.source_authority_revision
      )
    );
  elsif p_target_version_type = 'audio_publication_version'
        and (
          v_audio.status not in ('draft','changes_requested')
          or v_source_audio_version.source_authority_revision <> v_audio.authority_revision
          or v_source_audio_version.content_fingerprint is distinct from v_current_fingerprint
        )
  then
    perform platform_private.reject_resource_command(
      v_begin.command_receipt_id,
      'editorial_discovery_audio_working_version_stale',
      'Save the current Audio working version before changing Discovery.',
      jsonb_build_object(
        'lifecycle_status', v_audio.status,
        'authority_revision', v_audio.authority_revision,
        'working_source_authority_revision', v_source_audio_version.source_authority_revision
      )
    );
  elsif (
    select count(*)
    from public.registry_taxonomy_terms term
    where term.id = any(v_category_ids)
      and term.taxonomy = 'category'
      and term.status = 'active'
  ) <> cardinality(v_category_ids)
  then
    perform platform_private.reject_resource_command(
      v_begin.command_receipt_id,
      'editorial_discovery_category_invalid',
      'One or more selected Categories are not active Registry terms.',
      jsonb_build_object('metadata_revision', v_source_metadata.metadata_revision)
    );
  elsif (
    select count(*)
    from public.registry_taxonomy_terms term
    where term.id = any(v_tag_ids)
      and term.taxonomy = 'post_tag'
      and term.status = 'active'
  ) <> cardinality(v_tag_ids)
  then
    perform platform_private.reject_resource_command(
      v_begin.command_receipt_id,
      'editorial_discovery_tag_invalid',
      'One or more selected Tags are not active Registry terms.',
      jsonb_build_object('metadata_revision', v_source_metadata.metadata_revision)
    );
  else
    select jsonb_build_object(
      'categories', coalesce((
        select jsonb_agg(
          jsonb_build_object('id', term.id, 'slug', term.slug, 'name', term.name)
          order by selected.ordinality
        )
        from unnest(v_category_ids) with ordinality selected(id, ordinality)
        join public.registry_taxonomy_terms term on term.id = selected.id
      ), '[]'::jsonb),
      'tags', coalesce((
        select jsonb_agg(
          jsonb_build_object('id', term.id, 'slug', term.slug, 'name', term.name)
          order by selected.ordinality
        )
        from unnest(v_tag_ids) with ordinality selected(id, ordinality)
        join public.registry_taxonomy_terms term on term.id = selected.id
      ), '[]'::jsonb),
      'seo', jsonb_build_object(
        'title', nullif(btrim(p_seo_title), ''),
        'description', nullif(btrim(p_seo_description), ''),
        'keywords', to_jsonb(array(
          select btrim(keyword)
          from unnest(v_keywords) keyword
          where nullif(btrim(keyword), '') is not null
        )),
        'focus_keyword', nullif(btrim(p_focus_keyword), '')
      )
    ) into v_discovery;

    v_new_revision := v_source_metadata.metadata_revision + 1;
    v_new_version_id := extensions.gen_random_uuid();

    if p_target_version_type = 'playlist_version' then
      v_fingerprint := editorial.playlist_version_content_fingerprint_with_discovery(
        p_target_version_id,
        v_discovery
      );

      select coalesce(max(version.version_number), 0) + 1
      into v_new_version_number
      from editorial.playlist_versions version
      where version.resource_id = v_identity.resource_id;

      insert into editorial.playlist_versions (
        id, resource_id, playlist_id, version_number, version_kind,
        source_authority_revision, title, slug, description, curator_label,
        status, metadata, item_count, content_fingerprint,
        cover_asset_id, cover_asset_revision_id, cover_placement_data,
        cover_display_order, cover_alt_text_snapshot, cover_caption_snapshot,
        cover_credit_snapshot, created_by
      )
      values (
        v_new_version_id,
        v_source_playlist_version.resource_id,
        v_source_playlist_version.playlist_id,
        v_new_version_number,
        'working',
        v_source_playlist_version.source_authority_revision,
        v_source_playlist_version.title,
        v_source_playlist_version.slug,
        v_source_playlist_version.description,
        v_source_playlist_version.curator_label,
        v_source_playlist_version.status,
        v_source_playlist_version.metadata,
        v_source_playlist_version.item_count,
        v_fingerprint,
        v_source_playlist_version.cover_asset_id,
        v_source_playlist_version.cover_asset_revision_id,
        v_source_playlist_version.cover_placement_data,
        v_source_playlist_version.cover_display_order,
        v_source_playlist_version.cover_alt_text_snapshot,
        v_source_playlist_version.cover_caption_snapshot,
        v_source_playlist_version.cover_credit_snapshot,
        v_actor
      );

      insert into editorial.playlist_version_items (
        playlist_version_id, playlist_item_resource_id, playlist_item_id,
        position, registry_track_id, registry_release_id, provider_key,
        provider_track_id, provider_url, title, artist_names, release_title,
        artwork_url, preview_url, duration_ms, isrc, match_status,
        match_confidence, normalization_payload, notes
      )
      select
        v_new_version_id, item.playlist_item_resource_id, item.playlist_item_id,
        item.position, item.registry_track_id, item.registry_release_id,
        item.provider_key, item.provider_track_id, item.provider_url,
        item.title, item.artist_names, item.release_title, item.artwork_url,
        item.preview_url, item.duration_ms, item.isrc, item.match_status,
        item.match_confidence, item.normalization_payload, item.notes
      from editorial.playlist_version_items item
      where item.playlist_version_id = p_target_version_id
      order by item.position;

      insert into editorial.playlist_version_trust_revisions (
        playlist_version_id, citation_revision, credit_revision, updated_by, updated_at
      )
      select
        v_new_version_id,
        coalesce(revision.citation_revision, 1),
        coalesce(revision.credit_revision, 1),
        v_actor,
        now()
      from (select 1) seed
      left join editorial.playlist_version_trust_revisions revision
        on revision.playlist_version_id = p_target_version_id;

      perform editorial.copy_playlist_working_trust_to_working_successor(
        v_identity.resource_id,
        p_target_version_id,
        v_new_version_id
      );
    else
      v_fingerprint := audio.publication_version_content_fingerprint_with_discovery(
        p_target_version_id,
        v_discovery
      );

      select coalesce(max(version.version_number), 0) + 1
      into v_new_version_number
      from audio.publication_versions version
      where version.resource_id = v_identity.resource_id;

      insert into audio.publication_versions (
        id, resource_id, publication_id, version_number, version_kind,
        source_authority_revision, publication_kind, show_id, season_id,
        episode_number, title, slug, summary, status, metadata,
        master_media_asset_id, master_media_revision_id, audio_delivery_variant_id,
        transcript_media_asset_id, transcript_media_revision_id,
        content_fingerprint, created_by
      )
      values (
        v_new_version_id,
        v_source_audio_version.resource_id,
        v_source_audio_version.publication_id,
        v_new_version_number,
        'working',
        v_source_audio_version.source_authority_revision,
        v_source_audio_version.publication_kind,
        v_source_audio_version.show_id,
        v_source_audio_version.season_id,
        v_source_audio_version.episode_number,
        v_source_audio_version.title,
        v_source_audio_version.slug,
        v_source_audio_version.summary,
        v_source_audio_version.status,
        v_source_audio_version.metadata,
        v_source_audio_version.master_media_asset_id,
        v_source_audio_version.master_media_revision_id,
        v_source_audio_version.audio_delivery_variant_id,
        v_source_audio_version.transcript_media_asset_id,
        v_source_audio_version.transcript_media_revision_id,
        v_fingerprint,
        v_actor
      );

      insert into audio.publication_version_chapters (
        publication_version_id, chapter_number, start_seconds, title, chapter_url, image_url
      )
      select
        v_new_version_id, chapter.chapter_number, chapter.start_seconds,
        chapter.title, chapter.chapter_url, chapter.image_url
      from audio.publication_version_chapters chapter
      where chapter.publication_version_id = p_target_version_id
      order by chapter.chapter_number;

      perform editorial.copy_audio_version_trust_to_version(
        p_target_version_id,
        v_new_version_id
      );
    end if;

    update editorial.resource_version_editorial_metadata metadata
    set
      seo_title = nullif(btrim(p_seo_title), ''),
      seo_description = nullif(btrim(p_seo_description), ''),
      seo_keywords = array(
        select btrim(keyword)
        from unnest(v_keywords) keyword
        where nullif(btrim(keyword), '') is not null
      ),
      focus_keyword = nullif(btrim(p_focus_keyword), ''),
      metadata_revision = v_new_revision,
      updated_by = v_actor,
      updated_at = now()
    where metadata.target_version_type = p_target_version_type
      and metadata.target_version_id = v_new_version_id;

    if not found then
      raise exception 'Successor working version Discovery metadata was not materialized';
    end if;

    delete from editorial.resource_version_taxonomy_terms attachment
    where attachment.target_version_type = p_target_version_type
      and attachment.target_version_id = v_new_version_id;

    insert into editorial.resource_version_taxonomy_terms (
      target_version_type, target_version_id, resource_id, resource_kind,
      taxonomy, taxonomy_term_id, term_slug_snapshot, term_name_snapshot,
      display_order, created_by
    )
    select
      p_target_version_type,
      v_new_version_id,
      v_identity.resource_id,
      v_identity.resource_kind,
      'category',
      selected.id,
      term.slug,
      term.name,
      (selected.ordinality - 1)::integer,
      v_actor
    from unnest(v_category_ids) with ordinality selected(id, ordinality)
    join public.registry_taxonomy_terms term on term.id = selected.id;

    insert into editorial.resource_version_taxonomy_terms (
      target_version_type, target_version_id, resource_id, resource_kind,
      taxonomy, taxonomy_term_id, term_slug_snapshot, term_name_snapshot,
      display_order, created_by
    )
    select
      p_target_version_type,
      v_new_version_id,
      v_identity.resource_id,
      v_identity.resource_kind,
      'post_tag',
      selected.id,
      term.slug,
      term.name,
      (selected.ordinality - 1)::integer,
      v_actor
    from unnest(v_tag_ids) with ordinality selected(id, ordinality)
    join public.registry_taxonomy_terms term on term.id = selected.id;

    if p_target_version_type = 'playlist_version' then
      update editorial.playlist_resources binding
      set current_working_version_id = v_new_version_id
      where binding.resource_id = v_identity.resource_id;

      if editorial.playlist_current_content_fingerprint(v_playlist.id)
           is distinct from v_fingerprint
      then
        raise exception 'Playlist Discovery successor fingerprint did not match current content';
      end if;
    else
      update editorial.audio_publication_resources binding
      set current_working_version_id = v_new_version_id
      where binding.resource_id = v_identity.resource_id;

      if audio.publication_content_fingerprint(v_audio.id)
           is distinct from v_fingerprint
      then
        raise exception 'Audio Discovery successor fingerprint did not match current content';
      end if;
    end if;

    v_result := jsonb_build_object(
      'resource_id', v_identity.resource_id,
      'source_version_id', p_target_version_id,
      'target_version_type', p_target_version_type,
      'target_version_id', v_new_version_id,
      'version_number', v_new_version_number,
      'metadata_revision', v_new_revision,
      'content_fingerprint', v_fingerprint,
      'lifecycle_status', case
        when p_target_version_type = 'playlist_version' then v_playlist.status
        else v_audio.status
      end,
      'correlation_id', v_correlation_id
    );

    perform platform_private.complete_resource_command(
      v_begin.command_receipt_id,
      v_result
    );
  end if;

  select * into v_read
  from platform_private.read_authenticated_resource_command_result(
    v_begin.command_receipt_id,
    false
  );

  command_receipt_id := v_read.command_receipt_id;
  receipt_status := v_read.receipt_status;
  resource_id := v_read.resource_id;
  target_version_id := nullif(v_read.result_payload ->> 'target_version_id', '')::uuid;
  metadata_revision := nullif(v_read.result_payload ->> 'metadata_revision', '')::bigint;
  result_payload := v_read.result_payload;
  error_code := v_read.error_code;
  error_message := v_read.error_message;
  idempotent_replay := false;
  return next;
end;
$function$;

revoke all on function public.save_resource_version_editorial_metadata(text, uuid, bigint, uuid[], uuid[], text, text, text[], text, text, uuid) from public, anon;
grant execute on function public.save_resource_version_editorial_metadata(text, uuid, bigint, uuid[], uuid[], text, text, text[], text, text, uuid) to authenticated, service_role;

-- Backfill must be exact before the migration can commit.
do $verify_backfill$
declare
  v_expected_terms bigint;
  v_actual_terms bigint;
  v_article_versions bigint;
  v_article_metadata bigint;
  v_playlist_versions bigint;
  v_playlist_metadata bigint;
  v_audio_versions bigint;
  v_audio_metadata bigint;
  v_playlist_fingerprint_mismatches bigint;
  v_audio_fingerprint_mismatches bigint;
begin
  select count(*) into v_article_versions from editorial.article_versions;
  select count(*) into v_article_metadata
  from editorial.resource_version_editorial_metadata
  where target_version_type = 'article_version';

  select count(*) into v_playlist_versions from editorial.playlist_versions;
  select count(*) into v_playlist_metadata
  from editorial.resource_version_editorial_metadata
  where target_version_type = 'playlist_version';

  select count(*) into v_audio_versions from audio.publication_versions;
  select count(*) into v_audio_metadata
  from editorial.resource_version_editorial_metadata
  where target_version_type = 'audio_publication_version';

  select sum(jsonb_array_length(category_snapshot) + jsonb_array_length(tag_snapshot))
  into v_expected_terms
  from editorial.article_versions;

  select count(*) into v_actual_terms
  from editorial.resource_version_taxonomy_terms
  where target_version_type = 'article_version';

  if v_article_versions <> v_article_metadata
     or v_playlist_versions <> v_playlist_metadata
     or v_audio_versions <> v_audio_metadata
  then
    raise exception 'STOP: Shared editorial metadata backfill did not cover every supported version';
  end if;

  if coalesce(v_expected_terms, 0) <> v_actual_terms then
    raise exception 'STOP: Article taxonomy backfill did not preserve every snapshot attachment';
  end if;

  select count(*) into v_playlist_fingerprint_mismatches
  from editorial.playlist_versions version
  where version.content_fingerprint is distinct from
    editorial.playlist_version_content_fingerprint_with_discovery(
      version.id,
      editorial.resource_version_discovery_content_json(
        'playlist_version',
        version.id
      )
    );

  if v_playlist_fingerprint_mismatches <> 0 then
    raise exception 'STOP: Existing Playlist version fingerprints changed under empty Discovery';
  end if;

  select count(*) into v_audio_fingerprint_mismatches
  from editorial.audio_publication_resources binding
  join audio.publications publication
    on publication.id = binding.publication_id
  join audio.publication_versions version
    on version.id = binding.current_working_version_id
   and version.resource_id = binding.resource_id
  where publication.status in ('draft','changes_requested')
    and version.version_kind = 'working'
    and version.source_authority_revision = publication.authority_revision
    and version.content_fingerprint is distinct from
      audio.publication_version_content_fingerprint_with_discovery(
        version.id,
        editorial.resource_version_discovery_content_json(
          'audio_publication_version',
          version.id
        )
      );

  if v_audio_fingerprint_mismatches <> 0 then
    raise exception 'STOP: Current editable Audio working fingerprint changed under empty Discovery';
  end if;
end;
$verify_backfill$;

notify pgrst, 'reload schema';
commit;
