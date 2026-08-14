begin;

set local statement_timeout = '180s';
set local lock_timeout = '5s';

do $phase_4a_m5b_preflight$
declare
  v_active_usage_count bigint;
  v_distinct_asset_count bigint;
  v_distinct_url_count bigint;
  v_fingerprint text;
  v_definition text;
begin
  if to_regprocedure(
    'public.resolve_media_asset_delivery(uuid,uuid,uuid,text)'
  ) is null then
    raise exception
      'STOP: Migration 5A Media resolver does not exist';
  end if;

  select pg_get_functiondef(
    'public.resolve_media_asset_delivery(uuid,uuid,uuid,text)'::regprocedure
  )
  into v_definition;

  if position(
    'Legacy Media compatibility URL changed after capture'
    in v_definition
  ) = 0 then
    raise exception
      'STOP: Migration 5A compatibility lane is missing';
  end if;

  if to_regprocedure(
    'public.resolve_legacy_media_asset_lite_batch(uuid[],text[])'
  ) is not null then
    raise exception
      'STOP: Migration 5B read adapter already exists';
  end if;

  select
    count(*),
    count(distinct usage_row.asset_id),
    count(distinct compatibility_row.url)
  into
    v_active_usage_count,
    v_distinct_asset_count,
    v_distinct_url_count
  from media.usage_links usage_row
  join public.registry_media_assets compatibility_row
    on compatibility_row.id = usage_row.asset_id
  where usage_row.usage_state = 'active'
    and usage_row.resolution_mode =
      'legacy_snapshot';

  if v_active_usage_count <> 985 then
    raise exception
      'STOP: Expected 985 active legacy usages, found %',
      v_active_usage_count;
  end if;

  if v_distinct_asset_count = 0
     or v_distinct_asset_count > 1000
  then
    raise exception
      'STOP: Active legacy asset count is outside the adapter batch boundary: %',
      v_distinct_asset_count;
  end if;

  if v_distinct_url_count <> v_distinct_asset_count then
    raise exception
      'STOP: Active legacy URL uniqueness is not safe for URL lookup: assets %, URLs %',
      v_distinct_asset_count,
      v_distinct_url_count;
  end if;

  if exists (
    select 1
    from media.usage_links usage_row
    join media.legacy_asset_links bridge_row
      on bridge_row.asset_id = usage_row.asset_id
    join public.registry_media_assets compatibility_row
      on compatibility_row.id =
        bridge_row.legacy_asset_id
    where usage_row.usage_state = 'active'
      and usage_row.resolution_mode =
        'legacy_snapshot'
      and (
        compatibility_row.status <> 'active'
        or nullif(
          btrim(compatibility_row.url),
          ''
        ) is null
        or btrim(compatibility_row.url)
          is distinct from
            btrim(
              bridge_row.legacy_snapshot ->> 'url'
            )
      )
  ) then
    raise exception
      'STOP: Active legacy URL parity changed after Migration 5A';
  end if;

  select md5(
    string_agg(
      to_jsonb(asset_row)::text,
      E'\n'
      order by asset_row.id::text
    )
  )
  into v_fingerprint
  from public.registry_media_assets asset_row;

  if v_fingerprint <>
     'f32e074f96b01549b5e597ad8b5f4324'
  then
    raise exception
      'STOP: Compatibility asset fingerprint changed: %',
      v_fingerprint;
  end if;

  select md5(
    coalesce(
      string_agg(
        concat_ws(
          '|',
          source_namespace.nspname,
          source_table.relname,
          constraint_row.conname,
          pg_get_constraintdef(
            constraint_row.oid,
            true
          )
        ),
        E'\n'
        order by
          source_namespace.nspname,
          source_table.relname,
          constraint_row.conname
      ),
      ''
    )
  )
  into v_fingerprint
  from pg_constraint constraint_row
  join pg_class source_table
    on source_table.oid =
      constraint_row.conrelid
  join pg_namespace source_namespace
    on source_namespace.oid =
      source_table.relnamespace
  join pg_class referenced_table
    on referenced_table.oid =
      constraint_row.confrelid
  join pg_namespace referenced_namespace
    on referenced_namespace.oid =
      referenced_table.relnamespace
  where constraint_row.contype = 'f'
    and source_namespace.nspname <> 'media'
    and referenced_namespace.nspname = 'public'
    and referenced_table.relname =
      'registry_media_assets';

  if v_fingerprint <>
     '54274ae6a613d38c257c543ccf7050cc'
  then
    raise exception
      'STOP: Compatibility foreign-key fingerprint changed: %',
      v_fingerprint;
  end if;
end;
$phase_4a_m5b_preflight$;

create or replace function public.resolve_legacy_media_asset_lite_batch(
  p_asset_ids uuid[] default null,
  p_urls text[] default null
)
returns table (
  requested_asset_id uuid,
  requested_url text,
  id uuid,
  slug text,
  title text,
  url text,
  mime_type text,
  media_kind text,
  metadata jsonb,
  usage_link_id uuid,
  resolved_mode text
)
language plpgsql
security definer
set search_path = pg_catalog, public, media
as $function$
declare
  v_asset_ids uuid[];
  v_urls text[];
  v_lookup_by_id boolean;
  v_lookup_by_url boolean;
  v_candidate record;
  v_resolved record;
begin
  select coalesce(
    array_agg(distinct value_row.asset_id),
    array[]::uuid[]
  )
  into v_asset_ids
  from unnest(
    coalesce(p_asset_ids, array[]::uuid[])
  ) as value_row(asset_id)
  where value_row.asset_id is not null;

  select coalesce(
    array_agg(distinct btrim(value_row.url)),
    array[]::text[]
  )
  into v_urls
  from unnest(
    coalesce(p_urls, array[]::text[])
  ) as value_row(url)
  where nullif(btrim(value_row.url), '') is not null;

  v_lookup_by_id :=
    cardinality(v_asset_ids) > 0;
  v_lookup_by_url :=
    cardinality(v_urls) > 0;

  if v_lookup_by_id = v_lookup_by_url then
    raise exception
      'Media lite batch requires exactly one lookup set';
  end if;

  if greatest(
    cardinality(v_asset_ids),
    cardinality(v_urls)
  ) > 1000 then
    raise exception
      'Media lite batch exceeds 1000 unique lookup values';
  end if;

  for v_candidate in
    select
      compatibility_row.id,
      compatibility_row.slug,
      compatibility_row.title,
      compatibility_row.url
        as compatibility_url,
      compatibility_row.mime_type,
      compatibility_row.media_kind,
      compatibility_row.metadata,
      usage_choice.usage_link_id
    from public.registry_media_assets
      compatibility_row
    join lateral (
      select usage_row.id as usage_link_id
      from media.usage_links usage_row
      where usage_row.asset_id =
        compatibility_row.id
        and usage_row.usage_state = 'active'
        and usage_row.resolution_mode =
          'legacy_snapshot'
      order by
        usage_row.created_at,
        usage_row.id
      limit 1
    ) usage_choice
      on true
    where compatibility_row.status = 'active'
      and (
        (
          v_lookup_by_id
          and compatibility_row.id =
            any(v_asset_ids)
        )
        or
        (
          v_lookup_by_url
          and compatibility_row.url =
            any(v_urls)
        )
      )
    order by compatibility_row.id
  loop
    begin
      select resolved_row.*
      into v_resolved
      from public.resolve_media_asset_delivery(
        v_candidate.id,
        v_candidate.usage_link_id,
        null,
        null
      ) resolved_row;

      if found then
        return query
        select
          case
            when v_lookup_by_id
              then v_candidate.id
            else null::uuid
          end,
          case
            when v_lookup_by_url
              then v_candidate.compatibility_url
            else null::text
          end,
          v_candidate.id,
          v_candidate.slug,
          v_candidate.title,
          v_resolved.safe_delivery_url,
          coalesce(
            v_resolved.resolved_mime_type,
            v_candidate.mime_type
          ),
          v_candidate.media_kind,
          v_candidate.metadata,
          v_candidate.usage_link_id,
          v_resolved.resolved_mode;
      end if;
    exception
      when raise_exception then
        continue;
    end;
  end loop;
end;
$function$;

comment on function public.resolve_legacy_media_asset_lite_batch(
  uuid[],
  text[]
) is
  'Phase 4A transitional batch read adapter. Returns the existing lightweight Media shape only for active legacy usages accepted by the governed delivery resolver.';

revoke all on function public.resolve_legacy_media_asset_lite_batch(
  uuid[],
  text[]
)
from public, anon, authenticated;

grant execute on function public.resolve_legacy_media_asset_lite_batch(
  uuid[],
  text[]
)
to anon, authenticated, service_role;

do $phase_4a_m5b_assertions$
declare
  v_definition text;
  v_fingerprint text;
begin
  select pg_get_functiondef(
    'public.resolve_legacy_media_asset_lite_batch(uuid[],text[])'::regprocedure
  )
  into v_definition;

  if position(
    'public.resolve_media_asset_delivery'
    in v_definition
  ) = 0
     or position(
       'when raise_exception then'
       in v_definition
     ) = 0
     or position(
       'usage_row.resolution_mode ='
       in v_definition
     ) = 0
  then
    raise exception
      'STOP: Migration 5B adapter contract is incomplete';
  end if;

  if not has_function_privilege(
    'anon',
    'public.resolve_legacy_media_asset_lite_batch(uuid[],text[])',
    'EXECUTE'
  )
     or not has_function_privilege(
       'authenticated',
       'public.resolve_legacy_media_asset_lite_batch(uuid[],text[])',
       'EXECUTE'
     )
     or not has_function_privilege(
       'service_role',
       'public.resolve_legacy_media_asset_lite_batch(uuid[],text[])',
       'EXECUTE'
     )
  then
    raise exception
      'STOP: Migration 5B adapter grants are incomplete';
  end if;

  if (
    select count(*)
    from media.assets
  ) <> 1079
     or (
       select count(*)
       from media.legacy_asset_links
     ) <> 1079
     or (
       select count(*)
       from media.usage_links
     ) <> 987
     or (
       select count(*)
       from media.events
     ) <> 3147
     or (
       select count(*)
       from media.file_objects
     ) <> 0
     or (
       select count(*)
       from media.asset_revisions
     ) <> 0
     or (
       select count(*)
       from media.variants
     ) <> 0
     or (
       select count(*)
       from media.variant_selections
     ) <> 0
  then
    raise exception
      'STOP: Migration 5B changed canonical Media rows';
  end if;

  select md5(
    string_agg(
      to_jsonb(asset_row)::text,
      E'\n'
      order by asset_row.id::text
    )
  )
  into v_fingerprint
  from public.registry_media_assets asset_row;

  if v_fingerprint <>
     'f32e074f96b01549b5e597ad8b5f4324'
  then
    raise exception
      'STOP: Migration 5B changed compatibility rows: %',
      v_fingerprint;
  end if;
end;
$phase_4a_m5b_assertions$;

commit;
